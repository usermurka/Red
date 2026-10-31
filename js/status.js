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
    TIME_PER_QUESTION: 15, // секунд
    COMMON_STATUS: 3,      // «обычный» — самый массовый в базе
    COMMON_SHARE: 0.25,    // целевая доля таких вопросов в партии

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
        this.hideNextBtn();
        document.getElementById('status-result').classList.add('hidden');
        document.getElementById('status-end-screen').classList.add('hidden');
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

    // ---------- Выбор вида с «анти-трёшкой» ----------
    // В базе видов со статусом 3 значительно больше, чем с другими,
    // поэтому чисто случайный выбор даёт ~40% таких вопросов, и
    // нажатие «3» наугад становится выигрышной лотереей. Ограничиваем
    // долю статуса 3 значением COMMON_SHARE: не более ceil(доля×10)
    // таких вопросов на партию (остальные слоты — из прочих статусов).
    pickSpecies(all) {
        const common = all.filter(sp => sp.status === this.COMMON_STATUS);
        const other = all.filter(sp => sp.status !== this.COMMON_STATUS);
        const allowedCommon = Math.ceil(this.COMMON_SHARE * this.TOTAL_QUESTIONS);
        const canTakeCommon = this.commonUsed < allowedCommon;
        // Если других видов нет — пусть будет «3», деваться некуда
        const pool = (canTakeCommon || !other.length) && common.length ? common :
            (other.length ? other : common);
        let sp = pool[Math.floor(Math.random() * pool.length)];
        if (this.usedIds.has(sp.id)) {
            const fresh = pool.filter(s => !this.usedIds.has(s.id));
            if (fresh.length) sp = fresh[Math.floor(Math.random() * fresh.length)];
        }
        if (sp.status === this.COMMON_STATUS) this.commonUsed++;
        return sp;
    },

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

        // Карточка вида. ВАЖНО: класс flipped добавлен сразу — иначе
        // 3D-переворот из latin.css показывает «рубашку» вместо фото
        // (в играх «Среда обитания»/«Статус» карточку никто не переворачивает).
        const card = document.getElementById('status-card');
        card.innerHTML = `
            <div class="latin-photo-card st-photo-card flipped">
                <div class="latin-photo-inner">
                    <div class="latin-photo-back">КРАСНАЯ<br>КНИГА</div>
                    <div class="latin-photo-front"><img src="img/species/${sp.id}.png" alt="" loading="lazy"></div>
                </div>
            </div>
            <div class="st-name">${escHtml(sp.name)}</div>
            <div class="st-latin">${escHtml(String(sp.latin || '').split(',')[0].trim())}</div>
            <div class="st-desc">${escHtml(this.shortText(sp.status_text))}</div>`;
        const img = card.querySelector('img');
        img.addEventListener('error', () => {
            // Нет фотографии — текстовый плейсхолдер вместо битой картинки
            img.remove();
            const ph = document.createElement('div');
            ph.className = 'latin-photo-placeholder';
            ph.textContent = (sp.name || '').split(' ')[0];
            card.querySelector('.latin-photo-front').appendChild(ph);
        });

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
            html: `<div class="si-small">${this.highlightStatusText(sp.status_text || (full && full.status_text), sp.status).replace(/\n/g, '<br>')}</div>`
        });
        if (full && (full.abundance || full.limiting_factors)) {
            blocks.push({
                title: 'Численность и лимитирующие факторы',
                html: `<div class="si-small">${txt(full.abundance)}${full.abundance && full.limiting_factors ? ' ' : ''}${txt(full.limiting_factors)}</div>`
            });
        } else if (sp.status_text) {
            blocks.push({
                title: 'Численность и лимитирующие факторы',
                text: 'Поле «Лимитирующие факторы» в базе пусто — ориентируйтесь на статус вида.'
            });
        }

        MiniScroll.show({
            modalId: 'status-modal',
            panelId: 'status-info-panel',
            speciesId: sp.id,
            data: {
                title: sp.name,
                latin: sp.latin || '',
                // По требованию пользователя строка «номер статуса + его
                // название» из мини-свитка убрана (информация о статусе
                // и так есть в блоках ниже).
                status: null,
                blocks: blocks
            }
        });
        const panel = document.getElementById('status-info-panel');
        if (panel && !panel.querySelector('.ms-open-full')) {
            panel.appendChild(MiniScroll.footerButton(sp.id, () => this.close()));
        }
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
        const correct = value === this.correctStatus;
        const resultEl = document.getElementById('status-result');
        const st = this.statusList().find(s => s.value === this.correctStatus);

        // Подсветим правильный вариант
        const rightBtn = document.querySelector(
            `#status-options .status-option-btn[data-value="${this.correctStatus}"]`);
        if (rightBtn) rightBtn.classList.add('st-correct');

        if (correct) {
            this.score++;
            this.streak++;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            if (elapsed <= 2) this.unlockAch('speed');
            if (this.streak >= 5) this.unlockAch('streak5');
            resultEl.textContent = `✔ Верно! ${st ? st.label : ''} (${elapsed.toFixed(1)} с)`;
            resultEl.className = 'status-result ok';
        } else {
            this.mistakes++;
            this.streak = 0;
            btn.classList.add('st-wrong');
            resultEl.textContent = `✘ Неверно. Правильный ответ: ${st ? st.label : this.correctStatus}`;
            resultEl.className = 'status-result bad';
        }
        resultEl.classList.remove('hidden');
        // Ответ дан (любой!) — открываем мини-свиток с данными из
        // Красной книги и подсветкой, чтобы игрок мог свериться с
        // источником. До ответа свиток скрыт.
        this.renderInfoPanel(this.currentSpecies);

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
                // Время вышло — засчитываем ошибку, но дальше идём только по кнопке
                this.answered = true;
                this.awaitingNext = true;
                this.mistakes++;
                this.streak = 0;
                const resultEl = document.getElementById('status-result');
                const st = this.statusList().find(s => s.value === this.correctStatus);
                resultEl.textContent = `⏱ Время вышло! Правильный ответ: ${st ? `${st.value} — ${st.label}` : this.correctStatus}`;
                resultEl.className = 'status-result bad';
                resultEl.classList.remove('hidden');
                // Время вышло — тоже открываем мини-свиток с данными.
                this.renderInfoPanel(this.currentSpecies);
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
        const titleEl = document.getElementById('status-end-title');
        const achieveEl = document.getElementById('status-end-achieve');
        document.getElementById('status-final-score').textContent = this.score;
        document.getElementById('status-final-mistakes').textContent = this.mistakes;

        const pct = this.score / this.TOTAL_QUESTIONS;
        titleEl.textContent = pct >= 0.9 ? '🏆 Блестяще!' : (pct >= 0.6 ? '🌿 Хороший результат!' : '🌱 Продолжайте учиться!');
        achieveEl.textContent = 'Достижение: «Первая категория»';

        this.unlockAch('first_win');
        if (pct >= 0.6) this.unlockAch('good');
        if (pct >= 0.9) this.unlockAch('expert');
        if (this.mistakes === 0) this.unlockAch('flawless');

        try {
            if (typeof Achievements !== 'undefined') {
                if (Achievements.bumpGameCounter) Achievements.bumpGameCounter('status');
                // Суммарная медаль «Сотник категорий»: 100 верных ответов за все партии.
                // bumpMeta увеличивает счётчик на this.score и возвращает новое значение.
                if (Achievements.bumpMeta) {
                    const add = this.score;
                    this.score = 0; // передаём в bumpMeta только «прибавку»
                    const totalRight = Achievements.bumpMeta('statusRightTotal');
                    this.score = add;
                    if (totalRight >= 100) Achievements.unlock('status', 'centurion');
                }
            }
        } catch (e) { /* noop */ }

        document.getElementById('status-end-screen').classList.remove('hidden');
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
