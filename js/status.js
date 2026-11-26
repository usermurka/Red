// ============================================================
// ИГРА «СТАТУС» (Rarity Guess)
// По фотографии и описанию определи категорию редкости вида
// в Красной книге (0–6). 10 вопросов, таймер на вопрос,
// серии, достижения.
//
// Что исправлено по замечаниям игрока:
//  • Фото больше не «развёрнуто рубашкой»: карточка сразу
//    открывается (класс flipped), при отсутствии файла —
//    текстовый плейсхолдер.
//  • После ответа результат («✔ Верно… / ✘ Неверно…») остаётся
//    на экране до явного нажатия кнопки «Дальше →» — никакого
//    автоматического перекидывания на следующий вопрос.
//  • Статус «3 — Обычный вид» встречается в базе чаще всего,
//    поэтому вопросы с ним стали реже (~25% вместо ~40%):
//    тыкать «три» наугад перестало быть выгодной стратегией.
//  • Рядом с карточкой — панель с данными из Красной книги
//    (полная формулировка категории + статус вида в базе).
// ============================================================

const StatusGame = {
    TOTAL_QUESTIONS: 10,
    TIME_PER_QUESTION: 30, // секунд — новая карточка требует читать текст
    COMMON_STATUS: 3,      // «обычный» — самый массовый в базе
    COMMON_SHARE: 0.25,    // целевая доля таких вопросов в партии
    // ---- Банк и подсказка ----
    START_BANK: 10,        // банк на старте каждой партии
    HINT_COST: 3,          // цена открытия status_text
    // ---- Очки за расстояние по шкале категорий ----
    PTS_EXACT: 10,         // diff = 0
    PTS_NEAR: 5,           // diff = 1 (соседняя категория)
    PTS_FAR: 2,            // diff = 2 (через одну категорию)
    // ---- Веса взвешенной лотереи выбора вида ----
    GROUP_ANIMAL_W: 2.0,   // все животные (SPECIES.animals)
    GROUP_BIRD_W: 0.5,     // птицы — собственный вес поверх группового
    GROUP_OTHER_W: 1.0,    // растения, лишайники, грибы и прочее
    LOTTERY_SCALE: 10,     // масштаб весов к целым числам копий в мешке

    init() {
        document.getElementById('btn-status').addEventListener('click', () => this.open());
        document.getElementById('status-close').addEventListener('click', () => this.close());
        document.getElementById('status-restart').addEventListener('click', () => this.startGame());
        // Крестик на финальном экране — закрыть игру
        document.querySelector('#status-end-screen .game-close-x')?.addEventListener('click', () => this.close());
        document.getElementById('status-restart-btn').addEventListener('click', () => this.startGame());
        const nextBtn = document.getElementById('status-next-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextQuestion());
    },

    open() {
        document.getElementById('status-modal').classList.remove('hidden');
        document.getElementById('app').style.pointerEvents = 'none';
        document.getElementById('status-modal').style.pointerEvents = 'auto';
        this.startGame();
    },

    close() {
        document.getElementById('status-modal').classList.add('hidden');
        GameEnd.leave('status');
        this.stopTimer();
        document.getElementById('app').style.pointerEvents = '';
    },

    startGame() {
        this.qNum = 0;
        this.score = 0;      // верных ответов
        this.mistakes = 0;   // ошибочных ответов
        this.streak = 0;
        this.bestStreak = 0;
        this.usedIds = new Set();
        this.commonUsed = 0; // сколько раз за партию выпал статус «3»
        this.bank = this.START_BANK; // банк партии: метрика, не ресурс между партиями
        this.renderBank();
        this.hideNextBtn();
        document.getElementById('status-result').classList.add('hidden');
        document.getElementById('status-end-screen').classList.add('hidden');
        
        // Возвращаем кнопки управления при старте новой игры
        const topControls = document.querySelector('#status-modal .quiz-top-controls');
        if (topControls) {
            topControls.style.display = '';
        }

        GameEnd.leave('status');
        this.nextQuestion();
    },

    statusList() {
        // Категории редкости из общего справочника CONFIG (цвета подписи совпадают с картой)
        return (window.CONFIG && CONFIG.statuses) ? CONFIG.statuses : [];
    },

    // Кнопка «Дальше →» ВСЕГДА на месте (окно не прыгает): до ответа
    // она бледная (is-idle) и неактивная, после ответа — активная.
    showNextBtn(label) {
        const btn = document.getElementById('status-next-btn');
        if (!btn) return;
        btn.textContent = label || 'Дальше →';
        btn.classList.remove('hidden', 'is-idle');
        btn.classList.add('is-active');
        btn.disabled = false;
        try { btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
    },

    hideNextBtn() {
        const btn = document.getElementById('status-next-btn');
        if (!btn) return;
        btn.textContent = 'Дальше →';
        btn.classList.remove('hidden', 'is-active');
        btn.classList.add('is-idle');
        btn.disabled = true;
    },

    // ---------- Выбор вида: «анти-трёшка» + взвешенная лотерея ----------
    // В базе видов со статусом 3 значительно больше, чем с другими,
    // поэтому долю статуса 3 ограничиваем значением COMMON_SHARE.
    // Финальный шаг выбора — не равновероятная вытяжка, а лотерейный
    // мешок по группам: животные (всё дерево SPECIES.animals) вес
    // GROUP_ANIMAL_W; птицы (поддерево «Класс Птицы – AVES») —
    // GROUP_BIRD_W поверх группового; остальные группы — GROUP_OTHER_W.
    speciesGroupMap() {
        // Карта «id вида → { animal, bird }» одним обходом дерева SPECIES.
        // Кешируется на всё время жизни страницы.
        if (this._groupMap) return this._groupMap;
        const map = Object.create(null);
        const root = window.SPECIES;
        if (!root) { this._groupMap = map; return map; }
        const walk = (node, inAnimals, inBirds) => {
            const label = String(node.label || '');
            const birdsHere = inBirds || /Класс Птицы|AVES/i.test(label);
            (node.species || []).forEach(sp => {
                if (sp && sp.id) map[sp.id] = { animal: inAnimals, bird: birdsHere };
            });
            (node.classes || []).forEach(c => walk(c, inAnimals, birdsHere));
            (node.orders || []).forEach(o => walk(o, inAnimals, birdsHere));
        };
        Object.entries(root).forEach(([key, group]) => {
            walk(group, key === 'animals', false);
        });
        this._groupMap = map;
        return map;
    },

    speciesWeight(sp) {
        const g = this.speciesGroupMap()[sp.id];
        if (g && g.animal) {
            // Птицы — собственный вес GROUP_BIRD_W (0.5) вместо группового:
            // по ТЗ птица получает 5 копий против 20 у прочих животных
            // (в 4 раза реже остальных животных, в 2 — растений).
            return g.bird ? this.GROUP_BIRD_W : this.GROUP_ANIMAL_W;
        }
        return this.GROUP_OTHER_W;
    },

    pickSpecies(all) {
        const common = all.filter(sp => sp.status === this.COMMON_STATUS);
        const other = all.filter(sp => sp.status !== this.COMMON_STATUS);
        const allowedCommon = Math.ceil(this.COMMON_SHARE * this.TOTAL_QUESTIONS);
        const canTakeCommon = this.commonUsed < allowedCommon;
        // Если других видов нет — пусть будет «3», деваться некуда
        const pool = (canTakeCommon || !other.length) && common.length ? common :
            (other.length ? other : common);
        // Приоритет «неиспользованных» сохраняется: если в пуле остались
        // виды без повторов — тянем только из них.
        const fresh = pool.filter(s => !this.usedIds.has(s.id));
        const bag = fresh.length ? fresh : pool;
        // Лотерейный мешок: copies = round(вес × LOTTERY_SCALE)
        // животное — 20 копий, обычный вид — 10, птица — 5.
        const tickets = [];
        for (const sp of bag) {
            const copies = Math.max(1, Math.round(this.speciesWeight(sp) * this.LOTTERY_SCALE));
            for (let i = 0; i < copies; i++) tickets.push(sp);
        }
        const sp = tickets[Math.floor(Math.random() * tickets.length)];
        if (sp.status === this.COMMON_STATUS) this.commonUsed++;
        return sp;
    },

    // ---------- Банк очков партии ----------
    renderBank() {
        const el = document.getElementById('status-bank');
        if (el) el.textContent = this.bank;
        // Любое изменение банка сбрасывает состояние отказа замка:
        // повторный клик после пополнения должен снова работать.
        const lock = document.querySelector('#status-card .st-lock-row.st-lock-denied');
        if (lock) {
            lock.classList.remove('st-lock-denied');
            lock.innerHTML = this.lockLabelHtml();
        }
    },

    lockLabelHtml() {
        return `🔒 Формулировка категории — открыть за ${this.HINT_COST} 🪙`;
    },

    // Клик по строке-замке ДО ответа: списать HINT_COST и показать status_text.
    onLockClick() {
        if (this.answered || this.hintShown) return; // после ответа замок уже открыт бесплатно
        // Замок на десктопе живёт в #status-lock-slot (мобильный —
        // в мини-свитке, но там замка нет; вызов защищён if (row)).
        const row = document.querySelector('#status-lock-slot .st-lock-row')
            || document.querySelector('#status-card .st-lock-row');
        if (!row) return;
        if (this.bank < this.HINT_COST) {
            // Отказ без списания; повторный клик после пополнения сработает
            row.classList.add('st-lock-denied');
            row.innerHTML = `Не хватает очков (нужно ${this.HINT_COST} 🪙)`;
            return;
        }
        this.bank -= this.HINT_COST; // ровно HINT_COST, в минус банк не уходит
        this.renderBank();
        this.showStatusText(true);   // paid = true
    },

    // Раскрытие полного status_text под строкой-замком.
    // paid — оплачена ли подсказка (paid=false после ответа — бесплатно).
    // Идемпотентна: повторный вызов НЕ создаёт второй блок (это был баг:
    // после клика по замку и затем ответа текст «Подсказка:» и
    // «Формулировка категории:» дублировались).
    showStatusText(paid) {
        const txt = this.fullStatusText(this.currentSpecies);
        const html = `<span class="st-status-text-label">${paid ? 'Подсказка:' : 'Формулировка категории:'}</span> ` +
            escHtml(txt || 'Сведений нет.');

        // 1) Слот правой колонки (десктоп).
        const slot = document.getElementById('status-lock-slot');
        if (slot) {
            // Если замок ещё стоит — заменяем его на текст.
            const row = slot.querySelector('.st-lock-row');
            if (row) {
                slot.innerHTML = `<div class="st-status-text">${html}</div>`;
                this.hintShown = true;
                return;
            }
            // Если текст уже есть — обновляем, но НЕ дублируем.
            const existing = slot.querySelector('.st-status-text');
            if (existing) {
                existing.innerHTML = html;
                this.hintShown = true;
                return;
            }
        }

        // 2) Фолбэк: старое место в карточке (мобильный/на случай пустого слота).
        const card = document.getElementById('status-card');
        if (!card) { this.hintShown = true; return; }
        let body = card.querySelector('.st-status-text');
        if (!body) {
            body = document.createElement('div');
            body.className = 'st-status-text';
            card.appendChild(body);
        }
        body.innerHTML = html;
        const row = card.querySelector('.st-lock-row');
        if (row) row.remove();
        this.hintShown = true;
    },

    // Кнопка «📖 Читать в свитке» в правой колонке (десктоп) —
    // показывается ТОЛЬКО после ответа/тайм-аута. На мобильном
    // слот скрыт CSS, кнопка живёт в #status-info-panel (как раньше).
    renderReadFullButton() {
        const slot = document.getElementById('status-read-full-slot');
        if (!slot) return;
        if (slot.querySelector('.ms-open-full')) return; // уже показана
        const sp = this.currentSpecies;
        if (!sp) return;
        slot.innerHTML = '';
        slot.appendChild(MiniScroll.footerButton(sp.id, () => this.close()));
    },

    // После ответа/тайм-аута заменяем сокращённые факторы на полные
    // в правой колонке (десктоп). На мобильном слот скрыт CSS —
    // там полный текст и так в свитке #status-info-panel.
    renderFullFactors() {
        const slot = document.getElementById('status-factors-slot');
        if (!slot) return;
        const sp = this.currentSpecies;
        if (!sp) return;
        const full = this.factorsText(sp);
        slot.innerHTML = `
            <div class="st-factors">
                <div class="st-factors-title">Лимитирующие факторы</div>
                <div class="st-factors-body">${escHtml(full || 'Сведений нет.')}</div>
            </div>`;
    },

    // Полная формулировка категории для карточки (без обрезки):
    // сначала из развёрнутой записи SPECIES_DATA, затем из объекта вида.
    fullStatusText(sp) {
        const full = (window.SPECIES_DATA && sp && sp.id) ? window.SPECIES_DATA[sp.id] : null;
        const raw = (full && full.status_text) || (sp && sp.status_text) || '';
        return String(raw).replace(/\s+/g, ' ').trim();
    },

    // Развёрнутые лимитирующие факторы: та же цепочка источников.
    // Пустое поле — осознанный сигнал («Сведений нет.»), не ошибка.
    factorsText(sp) {
        const full = (window.SPECIES_DATA && sp && sp.id) ? window.SPECIES_DATA[sp.id] : null;
        const raw = (full && full.limiting_factors) || (sp && sp.limiting_factors) || '';
        return String(raw).replace(/\s+/g, ' ').trim();
    },

    // (expandFactors удалён: блок факторов всегда развёрнут полностью)

    nextQuestion() {
        if (this.qNum >= this.TOTAL_QUESTIONS) {
            this.stopTimer();
            this.finishGame();
            return;
        }
        // Переход вперёд — только по кнопке: если на вопрос ещё не
        // ответили и таймер идёт, повторный вызов игнорируем.
        if (this.awaitingNext) { this.awaitingNext = false; }
        else if (this._timer) return;
        this.qNum++;
        this.answered = false;
        this.awaitingNext = false;
        this.hintShown = false; // замок расходуется на один вопрос — рисуем заново
        this.questionStartTs = Date.now();
        this.hideNextBtn();

        const all = App.collectAllSpecies().filter(sp => sp.name &&
            typeof sp.status === 'number' && !this.usedIds.has(sp.id));
        if (!all.length) {
            alert('Недостаточно видов в базе для игры.');
            this.close();
            return;
        }
        const sp = this.pickSpecies(all);
        this.usedIds.add(sp.id);
        this.currentSpecies = sp;

        document.getElementById('status-q-num').textContent = this.qNum;
        document.getElementById('status-score-right').textContent = this.score;
        document.getElementById('status-score-wrong').textContent = this.mistakes;
        document.getElementById('status-streak-block').style.opacity = this.streak > 0 ? '1' : '0.3';
        document.getElementById('status-score-streak').textContent = this.streak;
        this.renderBank();

        // Карточка вида. ВАЖНО: класс flipped добавлен сразу — иначе
        // 3D-переворот из latin.css показывает «рубашку» вместо фото
        // (в играх «Среда обитания»/«Статус» карточку никто не переворачивает).
        // Карточка вида — ТОЛЬКО фото (название/латынь/факторы/замок
        // живут в отдельных слотах правой колонки; на мобильном —
        // в прежнем месте через #status-info-panel и CSS-порядок).
        // Класс flipped добавлен сразу — иначе 3D-переворот из latin.css
        // показывает «рубашку» вместо фото.
        const card = document.getElementById('status-card');
        card.innerHTML = `
            <div class="latin-photo-card st-photo-card flipped">
                <div class="latin-photo-inner">
                    <div class="latin-photo-back">КРАСНАЯ<br>КНИГА</div>
                    <div class="latin-photo-front"><img src="img/species/${sp.id}.png" alt="" loading="lazy"></div>
                </div>
            </div>`;
        const img = card.querySelector('img');
        img.addEventListener('error', () => {
            // Нет фотографии — текстовый плейсхолдер вместо битой картинки
            img.remove();
            const ph = document.createElement('div');
            ph.className = 'latin-photo-placeholder';
            ph.textContent = (sp.name || '').split(' ')[0];
            card.querySelector('.latin-photo-front').appendChild(ph);
        });

        // Правая колонка (десктоп): название+латынь, замок и факторы —
        // в отдельные слоты. На мобильном слоты скрыты (CSS), а данные
        // попадают в свиток #status-info-panel через renderInfoPanel().
        const factors = this.factorsText(sp);
        const headSlot = document.getElementById('status-head-slot');
        if (headSlot) {
            headSlot.innerHTML = `
                <div class="st-name">${escHtml(sp.name)}</div>
                <div class="st-latin">${escHtml(String(sp.latin || '').split(',')[0].trim())}</div>`;
        }
        const lockSlot = document.getElementById('status-lock-slot');
        if (lockSlot) {
            // Полная замена innerHTML — старый текст от прошлого вопроса
            // не остаётся (важно после «Подсказка:» на предыдущем вопросе).
            lockSlot.innerHTML = `<button type="button" class="st-lock-row">${this.lockLabelHtml()}</button>`;
            lockSlot.querySelector('.st-lock-row').addEventListener('click', () => this.onLockClick());
        }
        const factorsSlot = document.getElementById('status-factors-slot');
        if (factorsSlot) {
            // Блок всегда развёрнут полностью: без ограничения высоты
            // и без внутренней прокрутки (и до, и после ответа).
            factorsSlot.innerHTML = `
                <div class="st-factors">
                    <div class="st-factors-title">Лимитирующие факторы</div>
                    <div class="st-factors-body">${escHtml(factors || 'Сведений нет.')}</div>
                </div>`;
        }
        // Кнопка «Читать в свитке» до ответа скрыта — очищаем слот.
        // (Заполнится в checkAnswer()/тайм-ауте через renderReadFullButton.)
        const readFullSlot = document.getElementById('status-read-full-slot');
        if (readFullSlot) readFullSlot.innerHTML = '';

        this.renderInfoPanel(sp);
        // Данные из Красной книги скрыты до ответа игрока — иначе
        // категория редкости читается прямо из панели.
        this.setInfoVisible(false);

        // Варианты ответов: все категории из CONFIG + подпись цвета
        const zone = document.getElementById('status-options');
        zone.innerHTML = '';
        const statuses = this.statusList();
        this.correctStatus = sp.status;
        statuses.forEach(st => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'status-option-btn';
            btn.dataset.value = st.value;
            btn.innerHTML =
                `<span class="st-chip" style="background:${st.color}"></span>` +
                `<span class="st-num">${st.value}</span> ${escHtml(st.label)}`;
            btn.addEventListener('click', () => this.checkAnswer(st.value, btn));
            zone.appendChild(btn);
        });

        document.getElementById('status-result').classList.add('hidden');
        this.startTimer();
    },

    // ---------- Мини-свиток «Данные из Красной книги» ----------
    // Единый для всех игр (js/mini-scroll.js): появляется ПОСЛЕ ЛЮБОГО
    // ответа (или когда время вышло) с подсветкой и кнопкой
    // «📖 Читать в свитке». До ответа скрыт — иначе категория
    // редкости читается прямо из текста источника.

    setInfoVisible(visible) {
        if (!visible) MiniScroll.hide('status-info-panel');
        // показ строится в renderInfoPanel() по явному вызову
    },

    highlightStatusText(text, statusValue) {
        // Подсветка ключевых слов категории редкости в тексте статуса
        const esc = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let html = esc(text);
        const wordsByStatus = {
            0: ['не подтверждено', 'исчезнувший', 'исчезновения'],
            1: ['угроз', 'критическ', 'исчезнуть'],
            2: ['сокращающ', 'уменьшилась', 'численность'],
            3: ['обычный', 'стабильн', 'достаточн'],
            4: ['неопределённ', 'мало данных', 'недостаточно'],
            5: ['восстановлен', 'изменён', 'статус'],
            6: ['высокая', 'благополучн', 'увеличен']
        };
        const words = wordsByStatus[statusValue] || [];
        words.forEach(w => {
            const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-яё]*)', 'gi');
            html = html.replace(re, '<mark class="ms-hl">$1</mark>');
        });
        return html;
    },

    renderInfoPanel(sp) {
        const full = (window.SPECIES_DATA && sp.id) ? window.SPECIES_DATA[sp.id] : null;
        const st = this.statusList().find(s => s.value === sp.status);
        const txt = (s) => escHtml(String(s || '').replace(/\s+/g, ' ').trim()).replace(/\n/g, '<br>');

        const blocks = [];
        // По требованию пользователя в мини-свитке игры «Статус»
        // остаются ТОЛЬКО два блока: «Статус вида в базе» и
        // «Численность и лимитирующие факторы». Блок с описанием
        // категории редкости убран.
        blocks.push({
            title: 'Статус вида в базе',
            // По требованию: в игре «Статус» мини-свиток БЕЗ подсветок —
            // обычный экранированный текст.
            html: `<div class="si-small">${txt(sp.status_text || (full && full.status_text))}</div>`
        });
        // Блок свёрнут по умолчанию (<details>/<summary>) — так же,
        // как «Распространение в Омской области» в игре «Среда обитания»
        // (js/habitat.js). title оставляем пустым (null), чтобы
        // mini-scroll.js не рисовал дубликат заголовка.
        const abundanceHtml =
            `<div class="ms-block-body si-small" style="margin-top: 6px;">${txt(full.abundance)}${full.abundance && full.limiting_factors ? ' ' : ''}${txt(full.limiting_factors)}</div>`;
        const fallbackHtml =
            `<div class="ms-block-body si-small" style="margin-top: 6px;">Поле «Лимитирующие факторы» в базе пусто — ориентируйтесь на статус вида.</div>`;
        blocks.push({
            title: null,
            html: `
                <details class="ms-details">
                    <summary class="ms-block-title">Численность и лимитирующие факторы</summary>
                    ${(full && (full.abundance || full.limiting_factors)) ? abundanceHtml : fallbackHtml}
                </details>
            `
        });

        const msData = {
            title: sp.name,
            latin: sp.latin || '',
            // По требованию пользователя строка «номер статуса + его
            // название» из мини-свитка убрана (информация о статусе
            // и так есть в блоках ниже).
            status: null,
            blocks: blocks
        };

        // 1) Мобильный / планшет: прежний мини-свиток в #status-info-panel.
        MiniScroll.show({
            modalId: 'status-modal',
            panelId: 'status-info-panel',
            speciesId: sp.id,
            data: msData
        });
        const panel = document.getElementById('status-info-panel');
        if (panel && !panel.querySelector('.ms-open-full')) {
            panel.appendChild(MiniScroll.footerButton(sp.id, () => this.close()));
        }
        // На десктопе мини-свиток в правой колонке больше не рендерится:
        // название+латынь — в #status-head-slot, факторы — в
        // #status-factors-slot, полный свиток — по кнопке «Читать в свитке».
    },

    shortText(txt) {
        const s = String(txt || '').replace(/\s+/g, ' ').trim();
        return s.length > 180 ? s.slice(0, 177) + '…' : s;
    },

    checkAnswer(value, btn) {
        if (this.answered) return;
        this.answered = true;
        this.awaitingNext = true;
        this.stopTimer();
        const elapsed = (Date.now() - this.questionStartTs) / 1000;
        const resultEl = document.getElementById('status-result');

        // Оценивание по расстоянию на шкале категорий: diff = |ответ − категория|
        const diff = Math.abs(Number(value) - Number(this.correctStatus));
        let pts = 0;
        if (diff === 0) pts = this.PTS_EXACT;
        else if (diff === 1) pts = this.PTS_NEAR;
        else if (diff === 2) pts = this.PTS_FAR;

        // Подсветим правильный вариант (во всех случаях)
        const rightBtn = document.querySelector(
            `#status-options .status-option-btn[data-value="${this.correctStatus}"]`);
        if (rightBtn) rightBtn.classList.add('st-correct');

        if (pts > 0) {
            this.bank += pts; // банк не уходит в минус; начисление без ограничений сверху
            if (diff === 0) {
                // Точное попадание — единственный случай роста «верно» и серии
                this.score++;
                this.streak++;
                this.bestStreak = Math.max(this.bestStreak, this.streak);
                if (elapsed <= 2) this.unlockAch('speed');
                if (this.streak >= 5) this.unlockAch('streak5');
                resultEl.textContent = `✔ Точно! +${this.PTS_EXACT} 🪙`;
                resultEl.className = 'status-result ok';
            } else {
                // Соседняя (+5) или через одну (+2): серия СОХРАНЯЕТСЯ
                // (не растёт и не сбрасывается), счётчики «верно/неверно» не растут.
                // Выбранный вариант краснеет всегда, кроме точного попадания.
                btn.classList.add('st-wrong');
                resultEl.textContent = diff === 1
                    ? `≈ Соседняя категория! +${this.PTS_NEAR} 🪙`
                    : `≈ Через одну категорию! +${this.PTS_FAR} 🪙`;
                resultEl.className = 'status-result near';
            }
        } else {
            // Промах на 3+ категории — засчитывается как «неверно»
            this.mistakes++;
            this.streak = 0;
            btn.classList.add('st-wrong');
            resultEl.textContent = '✘ Мимо';
            resultEl.className = 'status-result bad';
        }
        resultEl.classList.remove('hidden');
        // Ответ дан (любой!) — замок открывается бесплатно, мини-свиток
        // показывается для сверки с источником. До ответа они скрыты.
        this.showStatusText(false);
        this.renderBank();
        this.renderInfoPanel(this.currentSpecies);
        // Десктоп: кнопка «Читать в свитке» в правой колонке — ТОЛЬКО
        // после ответа (до ответа слот пуст, см. nextQuestion()).
        this.renderReadFullButton();

        document.getElementById('status-score-right').textContent = this.score;
        document.getElementById('status-score-wrong').textContent = this.mistakes;
        document.getElementById('status-streak-block').style.opacity = this.streak > 0 ? '1' : '0.3';
        document.getElementById('status-score-streak').textContent = this.streak;

        // Никакого автоследующего вопроса: ждём нажатия «Дальше →»
        const last = this.qNum >= this.TOTAL_QUESTIONS;
        this.showNextBtn(last ? 'Итоги игры →' : 'Дальше →');
    },

    // Видимый обратный отсчёт: тонкая полоса НЕ показывала, что время
    // идёт. Теперь над полем вопроса — круглые часы с числом секунд,
    // которые краснеют на последних секундах и останавливаются после
    // ответа/выхода времени.
    renderTimer() {
        const el = document.getElementById('status-timer-count');
        const track = document.getElementById('status-timer-track');
        const t = Math.max(0, Math.ceil(this.timeLeft || 0));
        if (el) {
            el.textContent = `⏳ ${t} с`;
            const frac = this.TIME_PER_QUESTION ? (t / this.TIME_PER_QUESTION) : 0;
            el.classList.toggle('st-time-warning', frac <= 0.34);
        }
        if (track) track.classList.add('st-timer-running');
    },

    freezeTimerDisplay() {
        const track = document.getElementById('status-timer-track');
        if (track) track.classList.remove('st-timer-running');
    },

    startTimer() {
        this.stopTimer();
        this.timeLeft = this.TIME_PER_QUESTION;
        const bar = document.getElementById('status-timer-bar');
        bar.style.width = '100%';
        this.renderTimer();
        this._timer = setInterval(() => {
            this.timeLeft -= 0.5;
            bar.style.width = Math.max(0, (this.timeLeft / this.TIME_PER_QUESTION) * 100) + '%';
            this.renderTimer();
            if (this.timeLeft <= 0) {
                this.stopTimer();
                // Время вышло — засчитываем ошибку, но дальше идём только по кнопке.
                // Банк при тайм-ауте НЕ меняется; замок открывается бесплатно.
                this.answered = true;
                this.awaitingNext = true;
                this.mistakes++;
                this.streak = 0;
                const resultEl = document.getElementById('status-result');
                // По требованию пользователя: при истечении времени —
                // только «⏱ Время вышло!» (правильный ответ показан
                // подсветкой кнопки и в мини-свитке).
                resultEl.textContent = '⏱ Время вышло!';
                resultEl.className = 'status-result bad';
                resultEl.classList.remove('hidden');
                // Тайм-аут — замок и мини-свиток открываются бесплатно.
                this.showStatusText(false);
                this.renderInfoPanel(this.currentSpecies);
                // Десктоп: «Читать в свитке» — после ответа/тайм-аута.
                this.renderReadFullButton();
                const rightBtn = document.querySelector(
                    `#status-options .status-option-btn[data-value="${this.correctStatus}"]`);
                if (rightBtn) rightBtn.classList.add('st-correct');
                document.getElementById('status-score-wrong').textContent = this.mistakes;
                const last = this.qNum >= this.TOTAL_QUESTIONS;
                this.showNextBtn(last ? 'Итоги игры →' : 'Дальше →');
            }
        }, 500);
    },

    stopTimer() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        // Отсчёт остановлен — часы «замирают» на последнем значении
        this.freezeTimerDisplay();
    },

    finishGame() {
        this.hideNextBtn();
        this.showEndScreen();
    },

    showEndScreen() {
        // Принудительно скрываем кнопки управления (крестик и перезагрузку),
        // чтобы на финальном экране остался только один крестик.
        const topControls = document.querySelector('#status-modal .quiz-top-controls');
        if (topControls) {
            topControls.style.display = 'none';
        }

        const titleEl = document.getElementById('status-end-title');
        const achieveEl = document.getElementById('status-end-achieve');
        // Главный показатель партии — банк; «верно/неверно» остаются справочными.
        document.getElementById('status-final-bank').textContent = this.bank;
        document.getElementById('status-final-score').textContent = this.score;
        document.getElementById('status-final-mistakes').textContent = this.mistakes;

        // Процент считается от ЗАРАБОТАННОГО: (банк − START_BANK) / (10 × PTS_EXACT).
        const earnedMax = this.TOTAL_QUESTIONS * this.PTS_EXACT;
        const pct = Math.max(0, this.bank - this.START_BANK) / earnedMax;
        titleEl.textContent = pct >= 0.9 ? '🏆 Блестяще!' : (pct >= 0.6 ? '🌿 Хороший результат!' : '🌱 Продолжайте учиться!');
        achieveEl.textContent = `Достижение: «Первое заключение» · Итог: ${this.bank} 🪙`;

        this.unlockAch('first_win');
        // Пороги — в заработанных очках: good ≥ 60, expert ≥ 90
        if (this.bank - this.START_BANK >= 60) this.unlockAch('good');
        if (this.bank - this.START_BANK >= 90) this.unlockAch('expert');
        // flawless — партия без единого полного промаха (промахи diff≥3 и тайм-ауты;
        // ответы +5/+2 не мешают)
        if (this.mistakes === 0) this.unlockAch('flawless');

        try {
            if (typeof Achievements !== 'undefined') {
                if (Achievements.bumpGameCounter) Achievements.bumpGameCounter('status');
                // Суммарная медаль «Сотник категорий»: 100 верных ответов за все партии.
                // bumpMeta(key, delta) увеличивает счётчик на delta и возвращает
                // новое значение — без временного обнуления this.score.
                if (Achievements.bumpMeta) {
                    const totalRight = Achievements.bumpMeta('statusRightTotal', this.score);
                    if (totalRight >= 100) Achievements.unlock('status', 'centurion');
                }
            }
        } catch (e) { /* noop */ }

        document.getElementById('status-end-screen').classList.remove('hidden');
        GameEnd.enter('status'); // скрыть поле игры и ↺/✕
    },

    unlockAch(achId) {
        try {
            if (typeof Achievements !== 'undefined' && Achievements.unlock) {
                Achievements.unlock('status', achId);
            }
        } catch (e) { /* noop */ }
    }
};

document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    // Повторные попытки, если App ещё не готов (не «вешаем» страницу)
    let attempts = 0;
    const tryInit = () => {
        if (!window.App) {
            attempts++;
            if (attempts <= 20) setTimeout(tryInit, 500);
            return;
        }
        try {
            StatusGame.init();
        } catch (e) {
            console.error('StatusGame: ошибка инициализации:', e);
        }
    };
    tryInit();
}, 200));
