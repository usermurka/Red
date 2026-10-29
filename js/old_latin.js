// ============================================================
// ИГРА «ЛАТЫНЬ» (Latin Match)
// Соедини русское название вида с его латинским названием.
// Раунды по 5 пар, таймер на раунд, серии, достижения.
// ============================================================

const LatinGame = {
    PAIRS_PER_ROUND: 5,
    TOTAL_ROUNDS: 3,
    ROUND_TIME: 45, // секунд на раунд

    init() {
        document.getElementById('btn-latin').addEventListener('click', () => this.open());
        document.getElementById('latin-close').addEventListener('click', () => this.close());
        document.getElementById('latin-restart').addEventListener('click', () => this.startGame());
        document.getElementById('latin-restart-btn').addEventListener('click', () => this.startGame());
        const nextBtn = document.getElementById('latin-next-round-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.continueToNextRound());
    },

    open() {
        document.getElementById('latin-modal').classList.remove('hidden');
        document.getElementById('app').style.pointerEvents = 'none';
        this.startGame();
    },

    close() {
        document.getElementById('latin-modal').classList.add('hidden');
        this.stopTimer();
        document.getElementById('app').style.pointerEvents = '';
    },

    startGame() {
        this.round = 0;
        this.score = 0;      // решённые пары за игру
        this.streak = 0;     // текущая серия (раунды без ошибок)
        this.bestStreak = 0;
        this.mistakes = 0;   // всего ошибочных соединений
        this.perfectRounds = 0;
        this.usedIds = new Set();
        this.hideNextRoundBtn();
        document.getElementById('latin-end-screen').classList.add('hidden');
        this.nextRound();
    },

    showNextRoundBtn() {
        const btn = document.getElementById('latin-next-round-btn');
        if (!btn) return;
        btn.textContent = (this.round >= this.TOTAL_ROUNDS)
            ? 'Итоги игры →' : 'Продолжить →';
        btn.classList.remove('hidden');
    },

    hideNextRoundBtn() {
        const btn = document.getElementById('latin-next-round-btn');
        if (btn) btn.classList.add('hidden');
    },

    // Игра останавливается после раунда и ждёт нажатия «Продолжить»
    continueToNextRound() {
        this.hideNextRoundBtn();
        this.nextRound();
    },

    nextRound() {
        if (this.round >= this.TOTAL_ROUNDS) {
            this.finishGame();
            return;
        }
        this.round++;
        this.roundMistakes = 0;
        this.matchedCount = 0;
        this.selectedCell = null;
        this.locked = false;
        this.hideNextRoundBtn();

        const all = App.collectAllSpecies().filter(sp => sp.name && sp.latin);
        if (all.length < this.PAIRS_PER_ROUND) {
            alert('Недостаточно видов в базе для игры.');
            this.close();
            return;
        }

        // Выбор уникальных видов за всю игру
        const pool = all.filter(sp => !this.usedIds.has(sp.id));
        const source = pool.length >= this.PAIRS_PER_ROUND ? pool : all;
        const selected = [];
        while (selected.length < this.PAIRS_PER_ROUND) {
            const sp = source[Math.floor(Math.random() * source.length)];
            if (!selected.find(s => s.id === sp.id)) {
                selected.push(sp);
                this.usedIds.add(sp.id);
            }
        }

        // Обновляем шапку
        document.getElementById('latin-round-label').innerHTML =
            `Раунд <strong id="latin-q-num">${this.round}</strong> из ${this.TOTAL_ROUNDS}`;
        document.getElementById('latin-score-right').textContent = this.score;
        document.getElementById('latin-score-wrong').textContent = this.mistakes;
        document.getElementById('latin-streak-block').style.opacity = this.streak > 0 ? '1' : '0.3';
        document.getElementById('latin-score-streak').textContent = this.streak;

        // Формируем сетку: строки [рус. название | лат. название], колонки перемешаны независимо
        const names = this.shuffle(selected.map(sp => ({ kind: 'ru', speciesId: sp.id, text: sp.name })));
        const latins = this.shuffle(selected.map(sp => ({ kind: 'la', speciesId: sp.id, text: this.shortLatin(sp.latin) })));

        this.roundSpecies = selected;

        const grid = document.getElementById('latin-grid');
        grid.innerHTML = '';
        for (let i = 0; i < this.PAIRS_PER_ROUND; i++) {
            const row = document.createElement('div');
            row.className = 'latin-row';
            row.appendChild(this.makeCell(names[i]));
            row.appendChild(this.makeCell(latins[i]));
            grid.appendChild(row);
        }

        // Пять перевёрнутых карточек с фотографиями видов раунда (как в мемо).
        // Порядок — по списку выбранных видов; фото скрыто, пока пара не угадана.
        this.renderPhotoCards(selected);

        this.startTimer();
    },

    renderPhotoCards(speciesList) {
        const strip = document.getElementById('latin-photos');
        if (!strip) return;
        strip.innerHTML = '';
        speciesList.forEach(sp => {
            const card = document.createElement('div');
            card.className = 'latin-photo-card';
            card.dataset.speciesId = sp.id;

            const inner = document.createElement('div');
            inner.className = 'latin-photo-inner';

            const back = document.createElement('div');
            back.className = 'latin-photo-back';
            back.innerHTML = 'КРАСНАЯ<br>КНИГА';

            const front = document.createElement('div');
            front.className = 'latin-photo-front';
            const img = document.createElement('img');
            img.src = `img/species/${sp.id}.png`;
            img.alt = sp.name || '';
            img.loading = 'lazy';
            img.addEventListener('error', () => {
                // Нет фотографии — показываем текстовый плейсхолдер вместо битой картинки
                img.remove();
                const ph = document.createElement('div');
                ph.className = 'latin-photo-placeholder';
                ph.textContent = (sp.name || '').split(' ')[0];
                front.appendChild(ph);
            });
            front.appendChild(img);

            inner.appendChild(back);
            inner.appendChild(front);
            card.appendChild(inner);
            strip.appendChild(card);
        });
    },

    flipPhotoFor(speciesId) {
        const strip = document.getElementById('latin-photos');
        if (!strip) return;
        const card = strip.querySelector(`.latin-photo-card[data-species-id="${CSS.escape(String(speciesId))}"]`);
        if (card) card.classList.add('flipped');
    },

    // Сокращает латинское название: убирает авторский хвост и всё после первой запятой
    shortLatin(latin) {
        return String(latin || '').split(',')[0].trim();
    },

    makeCell(data) {
        const el = document.createElement('div');
        el.className = 'latin-cell latin-' + data.kind;
        el.textContent = data.text; // textContent — безопасная вставка (без XSS)
        el.dataset.speciesId = data.speciesId;
        el.dataset.kind = data.kind;
        el.addEventListener('click', () => this.handleClick(el));
        return el;
    },

    handleClick(el) {
        if (this.locked) return;
        if (el.classList.contains('matched') || el.classList.contains('shake')) return;

        if (!this.selectedCell) {
            this.selectedCell = el;
            el.classList.add('selected');
            return;
        }

        const first = this.selectedCell;
        if (first === el) { // повторный клик — снимаем выбор
            el.classList.remove('selected');
            this.selectedCell = null;
            return;
        }

        if (first.dataset.kind === el.dataset.kind) {
            // выбрали два одинаковых типа — переключаем выбор
            first.classList.remove('selected');
            this.selectedCell = el;
            el.classList.add('selected');
            return;
        }

        if (first.dataset.speciesId === el.dataset.speciesId) {
            // Верно!
            first.classList.remove('selected');
            first.classList.add('matched');
            el.classList.add('matched');
            this.selectedCell = null;
            this.matchedCount++;
            this.score++;
            document.getElementById('latin-score-right').textContent = this.score;

            // Переворачиваем карточку с фотографией угаданного вида
            this.flipPhotoFor(first.dataset.speciesId);

            if (this.matchedCount === this.PAIRS_PER_ROUND) {
                this.stopTimer();
                if (this.roundMistakes === 0) {
                    this.streak++;
                    this.perfectRounds++;
                    this.bestStreak = Math.max(this.bestStreak, this.streak);
                } else {
                    this.streak = 0;
                }
                document.getElementById('latin-streak-block').style.opacity = this.streak > 0 ? '1' : '0.3';
                document.getElementById('latin-score-streak').textContent = this.streak;
                // Игра останавливается: новый раунд — только по кнопке «Продолжить»
                this.showNextRoundBtn();
            }
        } else {
            // Неверно
            this.mistakes++;
            this.roundMistakes++;
            this.streak = 0;
            document.getElementById('latin-score-wrong').textContent = this.mistakes;
            document.getElementById('latin-streak-block').style.opacity = '0.3';
            document.getElementById('latin-score-streak').textContent = '0';

            this.locked = true;
            el.classList.add('selected', 'shake');
            setTimeout(() => {
                first.classList.remove('selected');
                el.classList.remove('selected', 'shake');
                this.selectedCell = null;
                this.locked = false;
            }, 500);
        }
    },

    startTimer() {
        this.stopTimer();
        this.timeLeft = this.ROUND_TIME;
        const bar = document.getElementById('latin-timer-bar');
        bar.style.width = '100%';
        this._timer = setInterval(() => {
            this.timeLeft--;
            bar.style.width = Math.max(0, (this.timeLeft / this.ROUND_TIME) * 100) + '%';
            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.showEndScreen('⏱ Время вышло!');
            }
        }, 1000);
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
        const titleEl = document.getElementById('latin-end-title');
        const achieveEl = document.getElementById('latin-end-achieve');
        document.getElementById('latin-final-score').textContent = this.score;
        document.getElementById('latin-final-mistakes').textContent = this.mistakes;

        titleEl.textContent = titleText;

        // Достижения (синхронизируем с общими медалями режима «Игры»)
        let achieve = '';
        if (titleText.startsWith('🏆')) {
            this.unlockAch('student'); // пройдены все раунды — базовая медаль
            if (this.mistakes === 0) {
                achieve = 'Достижение: «Хранитель латыни» — ни одной ошибки!';
                this.unlockAch('keeper');
            } else if (this.perfectRounds >= 2) {
                achieve = 'Достижение: «Лингвист-натуралист» — 2 идеальных раунда подряд!';
                this.unlockAch('linguist');
            } else if (this.mistakes <= 3) {
                achieve = 'Достижение: «Точный переводчик»';
                this.unlockAch('translator');
            } else {
                achieve = 'Достижение: «Ученик систематика»';
            }
        } else {
            achieve = this.score > 0
                ? `Вы успели решить ${this.score} пар(ы). Попробуйте ещё раз!`
                : 'Ни одна пара не решена. Не сдавайтесь!';
        }
        achieveEl.textContent = achieve;

        document.getElementById('latin-end-screen').classList.remove('hidden');
    },

    // Выдача медали через общий реестр достижений (если тот загружен)
    unlockAch(achId) {
        try {
            if (typeof Achievements !== 'undefined' && Achievements.unlock) {
                Achievements.unlock('latin', achId);
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
    if (typeof App === 'undefined') {
        console.warn('LatinGame: App не загружен — игра не запущена.');
        return;
    }
    LatinGame.init();
}, 200));
