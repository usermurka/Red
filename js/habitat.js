// ============================================================
// ИГРА «СРЕДА ОБИТАНИЯ» (Habitat Sort)
// Определи, к какому типу местообитаний относится вид:
// лес, степь, водоём или болото. Раунды по 5 видов, таймер
// на раунд, серии без ошибок, достижения.
// ============================================================

// Локальный экранировщик (в app-core.js есть только window.esc/window.escapeHtml)
function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

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
            'омут', 'затопл', 'канаў', 'канал', 'ключев'],
        forest: ['лес', 'дремуч', 'хвойн', 'широколиствен', 'смешанн', 'березов', 'берёзов',
            'соснов', 'осин', 'ивняк', 'кустарников', 'подлесок', 'лесная подстилка',
            'лесов', 'леса', 'лесной', 'олышк', 'ельник', 'пихтов', 'кедров', 'лиственнич'],
        steppe: ['степь', 'полын', 'ковыл', 'разнотравь', 'засушлив', 'сухотняк',
            'открыт', 'луг', 'сольц', 'барабан', 'типчаков', 'склонов', 'бereg', 'берег',
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
        this.mistakes = 0;     // всего ошибочных ответов
        this.streak = 0;       // серия верных ответов подряд
        this.bestStreak = 0;
        this.fastest = null;   // самый быстрый верный ответ (сек)
        this.usedIds = new Set();
        this.hideNextRoundBtn();
        document.getElementById('habitat-end-screen').classList.add('hidden');
        this.nextRound();
    },

    showNextRoundBtn() {
        const btn = document.getElementById('habitat-next-round-btn');
        if (!btn) return;
        btn.textContent = (this.round >= this.TOTAL_ROUNDS) ? 'Итоги игры →' : 'Продолжить →';
        btn.classList.remove('hidden');
    },

    hideNextRoundBtn() {
        const btn = document.getElementById('habitat-next-round-btn');
        if (btn) btn.classList.add('hidden');
    },

    continueToNextRound() {
        this.hideNextRoundBtn();
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

    showNextCard() {
        this.currentIdx++;
        const item = this.currentCard();
        const card = document.getElementById('habitat-card');
        if (!item) { card.innerHTML = ''; return; }
        const sp = item.sp;
        card.innerHTML = `
            <div class="latin-photo-card">
                <div class="latin-photo-inner">
                    <div class="latin-photo-back">КРАСНАЯ<br>КНИГА</div>
                    <div class="latin-photo-front"><img src="img/species/${sp.id}.png" alt="" loading="lazy"></div>
                </div>
            </div>
            <div class="habitat-name">${escHtml(sp.name)}</div>
            <div class="habitat-latin">${escHtml(String(sp.latin || '').split(',')[0].trim())}</div>`;
        const img = card.querySelector('img');
        img.addEventListener('error', () => {
            // Нет фотографии — текстовый плейсхолдер вместо битой картинки
            img.remove();
            const ph = document.createElement('div');
            ph.className = 'latin-photo-placeholder';
            ph.textContent = (sp.name || '').split(' ')[0];
            card.querySelector('.latin-photo-front').appendChild(ph);
        });
        this.questionStartTs = Date.now();
    },

    updateScoreboard() {
        document.getElementById('habitat-score-right').textContent = this.score;
        document.getElementById('habitat-score-wrong').textContent = this.mistakes;
        document.getElementById('habitat-streak-block').style.opacity = this.streak > 0 ? '1' : '0.3';
        document.getElementById('habitat-score-streak').textContent = this.streak;
    },

    answer(biomKey, btn) {
        if (this.locked) return;
        const item = this.currentCard();
        if (!item) return;
        // Сброс блокировки предыдущего неверного ответа — иначе игра
        // «замирает» после второй ошибки в одном раунде
        this.locked = false;
        const correct = biomKey === item.biome;
        const elapsed = (Date.now() - this.questionStartTs) / 1000;

        if (correct) {
            btn.classList.add('hab-correct');
            setTimeout(() => btn.classList.remove('hab-correct'), 600);
            this.score++;
            this.streak++;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            if (this.fastest == null || elapsed < this.fastest) this.fastest = elapsed;
            if (elapsed <= 2) this.unlockAch('quick');
            if (this.streak >= 8) this.unlockAch('serial');
            this.matchedCount++;
            this.updateScoreboard();

            if (this.matchedCount === this.ROUND_SIZE) {
                this.stopTimer();
                this.showNextRoundBtn();
            } else {
                this.showNextCard();
            }
        } else {
            this.mistakes++;
            this.roundMistakes++;
            this.streak = 0;
            this.updateScoreboard();
            btn.classList.add('hab-wrong');
            this.locked = true;
            setTimeout(() => {
                btn.classList.remove('hab-wrong');
                this.locked = false;
            }, 600);
        }
    },

    startTimer() {
        this.stopTimer();
        this.timeLeft = this.ROUND_TIME;
        const bar = document.getElementById('habitat-timer-bar');
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
