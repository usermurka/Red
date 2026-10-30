// ============================================================
// ИГРА «СТАТУС» (Rarity Guess)
// По фотографии и описанию определи категорию редкости вида
// в Красной книге (0–6). 10 вопросов, таймер на вопрос,
// серии, достижения.
// ============================================================

// Локальный экранировщик (в app-core.js есть только window.esc/window.escapeHtml)
function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

const StatusGame = {
    TOTAL_QUESTIONS: 10,
    TIME_PER_QUESTION: 15, // секунд

    init() {
        document.getElementById('btn-status').addEventListener('click', () => this.open());
        document.getElementById('status-close').addEventListener('click', () => this.close());
        document.getElementById('status-restart').addEventListener('click', () => this.startGame());
        // Крестик на финальном экране — закрыть игру
        document.querySelector('#status-end-screen .game-close-x')?.addEventListener('click', () => this.close());
        document.getElementById('status-restart-btn').addEventListener('click', () => this.startGame());
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
        document.getElementById('status-end-screen').classList.add('hidden');
        this.nextQuestion();
    },

    statusList() {
        // Категории редкости из общего справочника CONFIG (цвета подписи совпадают с картой)
        return (window.CONFIG && CONFIG.statuses) ? CONFIG.statuses : [];
    },

    nextQuestion() {
        if (this.qNum >= this.TOTAL_QUESTIONS) {
            this.stopTimer();
            this.finishGame();
            return;
        }
        this.qNum++;
        this.answered = false;
        this.questionStartTs = Date.now();

        const all = App.collectAllSpecies().filter(sp => sp.name &&
            typeof sp.status === 'number' && !this.usedIds.has(sp.id));
        if (!all.length) {
            alert('Недостаточно видов в базе для игры.');
            this.close();
            return;
        }
        let sp = all[Math.floor(Math.random() * all.length)];
        // Держим виды уникальными внутри партии (повтор возможен только если база мала)
        if (this.usedIds.has(sp.id)) {
            const fresh = all.filter(s => !this.usedIds.has(s.id));
            if (fresh.length) sp = fresh[Math.floor(Math.random() * fresh.length)];
        }
        this.usedIds.add(sp.id);
        this.currentSpecies = sp;

        document.getElementById('status-q-num').textContent = this.qNum;
        document.getElementById('status-score-right').textContent = this.score;
        document.getElementById('status-score-wrong').textContent = this.mistakes;
        document.getElementById('status-streak-block').style.opacity = this.streak > 0 ? '1' : '0.3';
        document.getElementById('status-score-streak').textContent = this.streak;

        // Карточка вида
        const card = document.getElementById('status-card');
        card.innerHTML = `
            <div class="latin-photo-card st-photo-card">
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

    shortText(txt) {
        const s = String(txt || '').replace(/\s+/g, ' ').trim();
        return s.length > 180 ? s.slice(0, 177) + '…' : s;
    },

    checkAnswer(value, btn) {
        if (this.answered) return;
        this.answered = true;
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

        document.getElementById('status-score-right').textContent = this.score;
        document.getElementById('status-score-wrong').textContent = this.mistakes;
        document.getElementById('status-streak-block').style.opacity = this.streak > 0 ? '1' : '0.3';
        document.getElementById('status-score-streak').textContent = this.streak;

        setTimeout(() => this.nextQuestion(), 1600);
    },

    startTimer() {
        this.stopTimer();
        this.timeLeft = this.TIME_PER_QUESTION;
        const bar = document.getElementById('status-timer-bar');
        bar.style.width = '100%';
        this._timer = setInterval(() => {
            this.timeLeft -= 0.5;
            bar.style.width = Math.max(0, (this.timeLeft / this.TIME_PER_QUESTION) * 100) + '%';
            if (this.timeLeft <= 0) {
                this.stopTimer();
                // Время вышло — засчитываем как ошибку и идём дальше
                this.answered = true;
                this.mistakes++;
                this.streak = 0;
                const resultEl = document.getElementById('status-result');
                resultEl.textContent = '⏱ Время вышло!';
                resultEl.className = 'status-result bad';
                resultEl.classList.remove('hidden');
                const rightBtn = document.querySelector(
                    `#status-options .status-option-btn[data-value="${this.correctStatus}"]`);
                if (rightBtn) rightBtn.classList.add('st-correct');
                document.getElementById('status-score-wrong').textContent = this.mistakes;
                setTimeout(() => this.nextQuestion(), 1600);
            }
        }, 500);
    },

    stopTimer() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    },

    finishGame() {
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
