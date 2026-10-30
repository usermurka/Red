// ============================================================
// ИГРА «СРЕДА ОБИТАНИЯ» (Habitat Sort)
// Определи, к какому типу местообитаний относится вид:
// лес, степь, водоём или болото. Раунды по 5 видов, таймер
// на раунд, серии без ошибок, достижения.
//
// Что исправлено по замечаниям игрока:
//  • Окно с данными из Красной книги — единый мини-свиток как в
//    «Викторине» (js/mini-scroll.js): появляется СПРАВА от игровой
//    панели при ЛЮБОМ ответе (верном и неверном), текст поля
//    «Места обитания» подсвечивает ключевые слова выбранной среды,
//    внизу — кнопка «📖 Читать в свитке».
//  • Таймер раунда встаёт на паузу сразу после ответа и продолжается
//    только по нажатию «Продолжить →» — чтобы можно было почитать.
//  • Конец раунда больше не выглядит «глюком»: появляется
//    баннер с итогом, а переход — только по кнопке
//    «Продолжить →» (никаких резких автосмен вида).
//  • После верного ответа пара «Вид — среда» остаётся в
//    журнале внизу экрана и не исчезает.
//  • Карточка показывается рубашкой вверх и открывается по
//    клику (как в «Латыни») — меньше случайных тычков.
// ============================================================

const HabitatGame = {
    ROUND_SIZE: 5,          // видов в раунде
    TOTAL_ROUNDS: 3,        // раундов в игре
    ROUND_TIME: 40,         // секунд на раунд

    // Ключевые слова для отнесения вида к биому по тексту
    // «Места обитания» из карточки вида
    BIOMES: [
        { key: 'forest', label: 'Лес', icon: '🌲' },
        { key: 'steppe', label: 'Степь', icon: '🌾' },
        { key: 'water', label: 'Водоём', icon: '💧' },
        { key: 'bog', label: 'Болото', icon: '🪷' }
    ],
    KEYWORDS: {
        water: ['водоём', 'водоем', 'озеро', 'река', 'рек', 'пруда', 'пруд', 'водохранилищ',
            'пойменн', 'заросли тростника', 'надводн', 'прибрежн', 'болотн', 'топи', 'тальник',
            'сыроватн', 'влага', 'гидро', 'русла', 'русле', 'мелководий', 'нерест', 'стрежен',
            'омут', 'затопл', 'канал', 'ключев'],
        forest: ['лес', 'дремуч', 'хвойн', 'широколиствен', 'смешанн', 'березов', 'берёзов',
            'соснов', 'осин', 'ивняк', 'кустарников', 'подлесок', 'лесная подстилка',
            'лесов', 'леса', 'лесной', 'олышк', 'ельник', 'пихтов', 'кедров', 'лиственнич'],
        steppe: ['степь', 'полын', 'ковыл', 'разнотравь', 'засушлив', 'сухотняк',
            'открыт', 'луг', 'сольц', 'барабан', 'типчаков', 'склонов', 'берег',
            'отлог', 'пустыр', 'солонц', 'степных', 'степной'],
        bog: ['болото', 'торф', 'сфагн', 'осоков', 'кочкар', 'заболочен', 'мокр', 'сыр']
    },

    // Порядок приоритета при одинаковом числе совпадений:
    // болото — самый специфичный биом, затем водоём, лес, степь
    BIOME_PRIORITY: ['bog', 'water', 'forest', 'steppe'],

    init() {
        document.getElementById('btn-habitat').addEventListener('click', () => this.open());
        document.getElementById('habitat-close').addEventListener('click', () => this.close());
        document.getElementById('habitat-restart').addEventListener('click', () => this.startGame());
        // Крестик на финальном экране — закрыть игру
        document.querySelector('#habitat-end-screen .game-close-x')?.addEventListener('click', () => this.close());
        document.getElementById('habitat-restart-btn').addEventListener('click', () => this.startGame());
        const nextBtn = document.getElementById('habitat-next-round-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.continueToNextRound());
    },

    open() {
        document.getElementById('habitat-modal').classList.remove('hidden');
        document.getElementById('app').style.pointerEvents = 'none';
        document.getElementById('habitat-modal').style.pointerEvents = 'auto';
        this.startGame();
    },

    close() {
        document.getElementById('habitat-modal').classList.add('hidden');
        this.stopTimer();
        document.getElementById('app').style.pointerEvents = '';
    },

    startGame() {
        this.round = 0;
        this.score = 0;        // верные определения за игру
        this.mistakes = 0;     // всего ошибочных ответов (после первой попытки вопроса)
        this.streak = 0;       // серия верных ответов с первой попытки
        this.bestStreak = 0;
        this.fastest = null;   // самый быстрый верный ответ (сек)
        this.usedIds = new Set();
        this.logEntries = [];  // пары «вид — среда» за всю игру
        this.hideNextRoundBtn();
        document.getElementById('habitat-round-banner').classList.add('hidden');
        document.getElementById('habitat-log').innerHTML = '';
        document.getElementById('habitat-end-screen').classList.add('hidden');
        this.nextRound();
    },

    // ---------- Переходы между раундами — ТОЛЬКО по кнопке ----------

    // Мини-свиток «Данные из Красной книги» (единый для всех игр,
    // js/mini-scroll.js) скрыт до первого ответа в текущем вопросе:
    // текст поля «Места обитания» подсказывает биом.
    setInfoVisible(visible) {
        if (visible) return; // показ строится в renderInfoPanel()
        MiniScroll.hide('habitat-info-panel');
    },

    showNextRoundBtn(label) {
        const btn = document.getElementById('habitat-next-round-btn');
        if (!btn) return;
        btn.textContent = label || 'Продолжить →';
        // Кнопка всегда в DOM и занимает место: до конца раунда она
        // бледная (is-idle) и неактивная, в конце — активная (is-active).
        btn.classList.remove('hidden', 'is-idle');
        btn.classList.add('is-active');
        btn.disabled = false;
        // чтобы игрок точно заметил появление кнопки — прокрутим к ней
        try { btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
    },

    hideNextRoundBtn() {
        const btn = document.getElementById('habitat-next-round-btn');
        if (!btn) return;
        btn.textContent = 'Продолжить →';
        btn.classList.remove('hidden', 'is-active');
        btn.classList.add('is-idle');
        btn.disabled = true;
    },

    continueToNextRound() {
        const btn = document.getElementById('habitat-next-round-btn');
        if (btn && btn.disabled) return; // по бледной кнопке не идём вперёд
        this.hideNextRoundBtn();
        document.getElementById('habitat-round-banner').classList.add('hidden');
        // Игрок нажал «Продолжить» — читаем мини-свиток больше не нужно:
        // снимаем игру с паузы и возвращаем таймер к работе.
        this.paused = false;
        this.nextRound();
    },

    // ---------- Отнесение вида к кому-то из четырёх биомов ----------

    normalize(str) {
        return String(str || '').toLowerCase().replace(/ё/g, 'е');
    },

    biomeOf(species) {
        // Поля habitats/description_short есть только в подробной карточке
        // из window.SPECIES_DATA (js/species-data.js), а не в списке SPECIES
        const full = (window.SPECIES_DATA && species && species.id)
            ? window.SPECIES_DATA[species.id] : null;
        const hay = this.normalize(((full && full.habitats) || '') + ' ' +
            ((full && full.description_short) || ''));
        if (!hay.trim()) return null;
        let best = null, bestHits = 0;
        this.BIOME_PRIORITY.forEach(key => {
            const hits = this.KEYWORDS[key].reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
            if (hits > bestHits) { best = key; bestHits = hits; }
        });
        return bestHits >= 2 ? best : null; // нужен уверенный сигнал
    },

    pickRoundSpecies() {
        // Пул строим по всем видам справочника, объединяя краткую запись
        // из SPECIES с подробной карточкой из SPECIES_DATA
        const all = App.collectAllSpecies()
            .filter(sp => sp.name && !this.usedIds.has(sp.id))
            .map(sp => ({ sp, biome: this.biomeOf(sp) }))
            .filter(e => e.biome);
        const pool = this.shuffle(all);
        const selected = pool.slice(0, this.ROUND_SIZE);
        // Если пригодных видов мало — допускаем повторное использование
        if (selected.length < this.ROUND_SIZE) {
            const any = this.shuffle(App.collectAllSpecies()
                .map(sp => ({ sp, biome: this.biomeOf(sp) }))
                .filter(e => e.biome));
            while (selected.length < this.ROUND_SIZE && any.length) {
                const cand = any.pop();
                if (!selected.find(s => s.sp.id === cand.sp.id)) selected.push(cand);
            }
        }
        selected.forEach(e => this.usedIds.add(e.sp.id));
        return selected;
    },

    nextRound() {
        if (this.round >= this.TOTAL_ROUNDS) {
            this.finishGame();
            return;
        }
        this.round++;
        this.roundMistakes = 0;
        this.matchedCount = 0;
        this.locked = false;
        this.questionStartTs = Date.now();
        this.hideNextRoundBtn();

        const items = this.pickRoundSpecies();
        if (items.length < this.ROUND_SIZE) {
            alert('Недостаточно видов в базе для игры.');
            this.close();
            return;
        }
        this.roundItems = items;
        this.currentIdx = -1;
        this.renderBiomButtons();
        this.updateScoreboard();

        document.getElementById('habitat-round-label').innerHTML =
            `Раунд <strong id="habitat-q-num">${this.round}</strong> из ${this.TOTAL_ROUNDS}`;

        this.showNextCard();
        this.startTimer();
    },

    renderBiomButtons() {
        const zone = document.getElementById('habitat-biomes');
        zone.innerHTML = '';
        this.BIOMES.forEach(b => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'habitat-biom habitat-biom-' + b.key;
            btn.dataset.biom = b.key;
            btn.innerHTML = `<span class="hb-icon">${b.icon}</span><span class="hb-label">${b.label}</span>`;
            btn.addEventListener('click', () => this.answer(b.key, btn));
            zone.appendChild(btn);
        });
    },

    currentCard() {
        return this.roundItems[this.currentIdx];
    },

    // Карточка нового вида: сначала «рубашка», клик — открыть фото.
    showNextCard() {
        // Переходим к следующему вопросу — снимаем паузу, таймер снова тикает
        this.resumeTimer();
        this.currentIdx++;
        this._answeredCurrent = false;
        const item = this.currentCard();
        const card = document.getElementById('habitat-card');
        if (!item) { card.innerHTML = ''; return; }
        const sp = item.sp;
        card.innerHTML = `
            <div class="latin-photo-card habitat-photo">
                <div class="latin-photo-inner">
                    <div class="latin-photo-back">КРАСНАЯ<br>КНИГА</div>
                    <div class="latin-photo-front"></div>
                </div>
            </div>
            <div class="habitat-name">${escHtml(sp.name)}</div>
            <div class="habitat-latin">${escHtml(String(sp.latin || '').split(',')[0].trim())}</div>
            <div class="habitat-tap-hint">👆 Нажми на карточку, чтобы открыть фото</div>`;
        const photo = card.querySelector('.habitat-photo');
        const front = card.querySelector('.latin-photo-front');
        const reveal = () => {
            if (photo.classList.contains('flipped')) return;
            photo.classList.add('flipped');
            card.querySelector('.habitat-tap-hint')?.classList.add('hidden');
            if (!front.querySelector('img, .latin-photo-placeholder')) {
                const img = document.createElement('img');
                img.src = `img/species/${sp.id}.png`;
                img.alt = '';
                img.loading = 'lazy';
                img.addEventListener('error', () => {
                    // Нет фотографии — текстовый плейсхолдер вместо битой картинки
                    img.remove();
                    const ph = document.createElement('div');
                    ph.className = 'latin-photo-placeholder';
                    ph.textContent = (sp.name || '').split(' ')[0];
                    front.appendChild(ph);
                });
                front.appendChild(img);
            }
        };
        photo.addEventListener('click', reveal);
        // Не заставляем ждать анимацию: открываем сразу после короткой паузы
        setTimeout(reveal, 450);
        this.questionStartTs = Date.now();
        // Мини-свиток с данными из Красной книги — только после ответа.
        this._lastPickKey = null;
        this.setInfoVisible(false);
    },

    // Мини-свиток справа от игровой панели (единый дизайн как в
    // «Викторине», js/mini-scroll.js): настоящий текст «Места
    // обитания» из базы + подсветка совпадений с ключевыми словами
    // выбранного биома. Показывается при ЛЮБОМ ответе.
    renderInfoPanel(item, biomKey) {
        if (!item) return;
        const sp = item.sp;
        const full = (window.SPECIES_DATA && sp.id) ? window.SPECIES_DATA[sp.id] : null;
        const habitats = String((full && full.habitats) || '').replace(/\s+/g, ' ').trim();
        const spread = String((full && full.spread_omsk) || '').replace(/\s+/g, ' ').trim();

        const hlText = (txt) => {
            let html = escHtml(txt).replace(/\n/g, '<br>');
            const words = this.KEYWORDS[biomKey] || [];
            // длинные слова раньше — иначе короткие «съедят» вхождения длинных
            [...words].sort((a, b) => b.length - a.length).forEach(w => {
                const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-яё]*)', 'gi');
                html = html.replace(re, '<mark class="hl-' + biomKey + '" data-w>$1</mark>');
            });
            return html;
        };

        const blocks = [];
        if (habitats) {
            blocks.push({ title: 'Места обитания', html: hlText(habitats) });
        } else {
            blocks.push({ title: 'Места обитания', text: 'Поле «Места обитания» в базе пусто — ориентируйтесь на описание.' });
        }
        if (spread) blocks.push({ title: 'Распространение в Омской области', html: escHtml(spread).replace(/\n/g, '<br>') });
        if (full && full.description_short) {
            blocks.push({ title: 'Краткое описание', html: escHtml(String(full.description_short).replace(/\s+/g, ' ').trim()).replace(/\n/g, '<br>') });
        }

        const statusConfig = CONFIG.statuses.find(s => s.value === sp.status);
        MiniScroll.show({
            modalId: 'habitat-modal',
            panelId: 'habitat-info-panel',
            speciesId: sp.id,
            data: {
                title: sp.name,
                latin: sp.latin || '',
                status: statusConfig ? { value: statusConfig.value, color: statusConfig.color, label: statusConfig.label } : null,
                blocks: blocks
            }
        });
        const panel = document.getElementById('habitat-info-panel');
        if (panel && !panel.querySelector('.ms-open-full')) {
            panel.appendChild(MiniScroll.footerButton(sp.id, () => this.close()));
        }
    },

    updateScoreboard() {
        document.getElementById('habitat-score-right').textContent = this.score;
        document.getElementById('habitat-score-wrong').textContent = this.mistakes;
        document.getElementById('habitat-streak-block').style.opacity = this.streak > 0 ? '1' : '0.3';
        document.getElementById('habitat-score-streak').textContent = this.streak;
    },

    answer(biomKey, btn) {
        const item = this.currentCard();
        if (!item) return;
        const correct = biomKey === item.biome;
        const firstTry = !this._answeredCurrent;

        // Любой ответ: ставим таймер на паузу, чтобы игрок мог спокойно
        // прочитать мини-свиток с данными из Красной книги. Пауза
        // снимается в continueToNextRound() («Продолжить →») или при
        // переходе к следующему вопросу (showNextCard -> resumeTimer).
        this.pauseTimer();
        this._lastPickKey = biomKey;
        this.renderInfoPanel(item, biomKey); // свиток + подсветка выбранной среды

        if (correct) {
            const elapsed = (Date.now() - this.questionStartTs) / 1000;
            btn.classList.add('hab-correct');
            setTimeout(() => btn.classList.remove('hab-correct'), 600);

            if (firstTry) {
                this.score++;
                this.streak++;
                this.bestStreak = Math.max(this.bestStreak, this.streak);
                if (this.fastest == null || elapsed < this.fastest) this.fastest = elapsed;
                if (elapsed <= 2) this.unlockAch('quick');
                if (this.streak >= 8) this.unlockAch('serial');
                this.matchedCount++;
            }
            this.locked = false;
            this.updateScoreboard();
            // В журнал пишем ВЫБРАННУЮ игроком среду (биом), а не эталон:
            // «Стрепет — Лес ✘», затем при верном выборе «Стрепет — Степь ✔».
            this.addLogPair(item, true, biomKey);

            if (this.matchedCount >= this.ROUND_SIZE) {
                // Раунд завершён: явно говорим об этом и ЖДЁМ нажатия
                // кнопки «Продолжить» — таймер остаётся на паузе.
                this.stopTimer(); // не заставляем ждать истечения времени
                this.showRoundBanner(
                    `🎉 Раунд ${this.round} завершён! Верно определено: ${this.matchedCount} из ${this.ROUND_SIZE}.` +
                    (this.roundMistakes ? ` Ошибок в раунде: ${this.roundMistakes}.` : ' Ни одной ошибки!'),
                    this.round >= this.TOTAL_ROUNDS ? 'Итоги игры →' : 'Продолжить →');
            } else {
                this.showNextCard();
            }
        } else {
            if (firstTry) {
                // Первая ошибка в вопросе: засчитываем, но даём шанс
                // выбрать другой вариант, глядя на подсвеченный текст.
                this.mistakes++;
                this.roundMistakes++;
                this.streak = 0;
                this._answeredCurrent = true;
                this.updateScoreboard();
                this.addLogPair(item, false, biomKey);
            } else {
                // Повторная ошибка — тоже обновляем запись журнала
                this.addLogPair(item, false, biomKey);
            }
            btn.classList.add('hab-wrong');
            this.locked = true;
            setTimeout(() => {
                btn.classList.remove('hab-wrong');
                this.locked = false;
                // Ответ разобран, свиток открыт — можно продолжать выбор,
                // но время НЕ тикает, пока игрок читает свиток. Переход к
                // следующему вопросу — по клику на новую карточку среды.
            }, 600);
        }
    },

    // Журнал пар «вид — среда»: записи остаются до конца игры.
    // pickKey — биом, который реально выбрал игрок (пишем его, а не
    // правильный ответ). При верном выборе запись перечёркивается
    // крестиком и заменяется/подсвечивается галочкой.
    addLogPair(item, correct, pickKey) {
        const log = document.getElementById('habitat-log');
        if (!log) return;
        const key = item.sp.id;
        const existing = log.querySelector(`[data-pair="${CSS.escape(key)}"]`);
        const pickedLabel = this.biomeLabel(pickKey || item.biome);
        if (existing) {
            if (correct) {
                existing.classList.remove('hl-miss');
                existing.classList.add('hl-hit');
                existing.innerHTML = `<span class="hl-mark">✔</span> ${escHtml(item.sp.name)} — <b>${pickedLabel}</b>`;
            } else {
                existing.innerHTML = `<span class="hl-mark">✘</span> ${escHtml(item.sp.name)} — <b>${pickedLabel}</b>`;
            }
            return;
        }
        const div = document.createElement('div');
        div.className = 'hl-entry ' + (correct ? 'hl-hit' : 'hl-miss');
        div.dataset.pair = key;
        div.innerHTML = `<span class="hl-mark">${correct ? '✔' : '✘'}</span> ` +
            `${escHtml(item.sp.name)} — <b>${pickedLabel}</b>`;
        log.appendChild(div);
    },

    biomeLabel(key) {
        const b = this.BIOMES.find(x => x.key === key);
        return b ? `${b.icon} ${b.label}` : '?';
    },

    showRoundBanner(text, btnLabel) {
        const banner = document.getElementById('habitat-round-banner');
        banner.textContent = text;
        banner.classList.remove('hidden');
        this.showNextRoundBtn(btnLabel);
    },

    startTimer() {
        this.stopTimer();
        this.paused = false;
        this.timeLeft = this.ROUND_TIME;
        const bar = document.getElementById('habitat-timer-bar');
        bar.style.width = '100%';
        this._timer = setInterval(() => {
            if (this.paused) return; // пауза до нажатия «Продолжить» — можно почитать
            this.timeLeft--;
            bar.style.width = Math.max(0, (this.timeLeft / this.ROUND_TIME) * 100) + '%';
            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.showEndScreen('⏱ Время вышло!');
            }
        }, 1000);
    },

    // Таймер встаёт на паузу при ЛЮБОМ ответе (игрок читает мини-свиток)
    // и продолжается при переходе к следующему вопросу или раунду.
    pauseTimer() {
        this.paused = true;
    },

    resumeTimer() {
        if (this.paused && this._timer) this.paused = false;
    },

    stopTimer() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    },

    finishGame() {
        this.showEndScreen('🏆 Игра окончена!');
    },

    showEndScreen(titleText) {
        const titleEl = document.getElementById('habitat-end-title');
        const achieveEl = document.getElementById('habitat-end-achieve');
        document.getElementById('habitat-final-score').textContent = this.score;
        document.getElementById('habitat-final-mistakes').textContent = this.mistakes;

        titleEl.textContent = titleText;

        let achieve = '';
        if (titleText.startsWith('🏆')) {
            this.unlockAch('ranger');   // базовая медаль за прохождение
            if (this.mistakes === 0) {
                achieve = 'Достижение: «Хранитель экосистем» — ни одной ошибки!';
                this.unlockAch('keeper');
            } else if (this.mistakes <= 2) {
                achieve = 'Достижение: «Знаток биотопов» — не более 2 ошибок!';
                this.unlockAch('expert');
            } else {
                achieve = 'Таксономический кружок — хорошее подспорье, попробуй ещё раз!';
            }
        } else {
            achieve = this.score > 0
                ? `Вы верно определили ${this.score} видов. Попробуйте ещё раз!`
                : 'Ни одного верного ответа. Не сдавайтесь!';
        }
        achieveEl.textContent = achieve;

        try {
            if (typeof Achievements !== 'undefined' && Achievements.bumpGameCounter) {
                Achievements.bumpGameCounter('habitat');
            }
        } catch (e) { /* noop */ }

        document.getElementById('habitat-end-screen').classList.remove('hidden');
    },

    unlockAch(achId) {
        try {
            if (typeof Achievements !== 'undefined' && Achievements.unlock) {
                Achievements.unlock('habitat', achId);
            }
        } catch (e) { /* noop */ }
    },

    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
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
            HabitatGame.init();
        } catch (e) {
            console.error('HabitatGame: ошибка инициализации:', e);
        }
    };
    tryInit();
}, 200));
