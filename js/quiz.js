const Quiz = {
    scoreRight: 0,
    scoreWrong: 0,
    currentStreak: 0,
    currentQuestionNum: 1,
    totalQuestions: 30,
    currentSpecies: null,
    isAnswered: false,
    timerId: null,
    timeLeft: 0,
    maxTime: 10,
    isGameActive: false, // Флаг, запущена ли игра (чтобы не сбрасывать при переоткрытии)

    init() {
        document.getElementById('btn-quiz').addEventListener('click', () => this.open());
        document.getElementById('quiz-close').addEventListener('click', () => this.close());
        document.getElementById('quiz-restart').addEventListener('click', () => this.startGame());
        document.getElementById('quiz-restart-btn').addEventListener('click', () => {
            if (confirm('Начать викторину заново? Текущий прогресс будет потерян.')) {
                this.startGame();
            }
        });

        document.getElementById('qi-open-full').addEventListener('click', () => {
            this.close();
            if (this.currentSpecies) {
                App.openSpeciesScroll(this.currentSpecies.id);
            }
        });
    },

    open() {
        document.getElementById('quiz-modal').classList.remove('hidden');
        document.getElementById('app').style.pointerEvents = 'none';
        document.getElementById('quiz-modal').style.pointerEvents = 'auto';

        // Если игра не была запущена или уже закончена — стартуем новую
        if (!this.isGameActive) {
            this.startGame();
        } else {
            // Если игра активна, просто снимаем с паузы текущий таймер
            if (!this.isAnswered && this.currentSpecies) {
                this.startTimer();
            }
        }
    },

    close() {
        this.stopTimer();
        document.getElementById('quiz-modal').classList.add('hidden');
        document.getElementById('app').style.pointerEvents = '';
        // НЕ сбрасываем isGameActive, чтобы сохранить прогресс
    },

    startGame() {
        this.isGameActive = true;
        this.scoreRight = 0;
        this.scoreWrong = 0;
        this.currentStreak = 0;
        this.currentQuestionNum = 1;

        document.getElementById('quiz-score-right').textContent = '0';
        document.getElementById('quiz-score-wrong').textContent = '0';
        document.getElementById('quiz-score-streak').textContent = '0';
        this.updateStreakUI();
        document.getElementById('quiz-q-num').textContent = '1';

        document.getElementById('quiz-end-screen').classList.add('hidden');
        document.getElementById('quiz-content').classList.remove('hidden');
        document.getElementById('quiz-info-panel').classList.add('hidden');

        this.startNewQuestion();
    },

    getRandomSpecies() {
        const all = App.collectAllSpecies();
        return all[Math.floor(Math.random() * all.length)];
    },

    startNewQuestion() {
        this.isAnswered = false;
        this.stopTimer();
        const optionsContainer = document.getElementById('quiz-options');
        const resultContainer = document.getElementById('quiz-result');
        optionsContainer.innerHTML = '';
        resultContainer.classList.add('hidden');
        document.getElementById('quiz-info-panel').classList.add('hidden');

        document.getElementById('quiz-q-num').textContent = this.currentQuestionNum;

        this.currentSpecies = this.getRandomSpecies();

        const img = document.getElementById('quiz-image');
        img.src = `img/species/${this.currentSpecies.id}.png`;
        img.onerror = () => { img.src = 'img/species/placeholder.png'; };

        const allSpecies = App.collectAllSpecies();
        const sameCat = allSpecies.filter(s =>
            App.detectCategory(s.id) === App.detectCategory(this.currentSpecies.id) &&
            s.id !== this.currentSpecies.id
        );
        let wrongOptions = this.shuffleArray(sameCat).slice(0, 3);

        if (wrongOptions.length < 3) {
            const others = allSpecies.filter(s => s.id !== this.currentSpecies.id && !wrongOptions.includes(s));
            wrongOptions = wrongOptions.concat(this.shuffleArray(others).slice(0, 3 - wrongOptions.length));
        }

        const options = this.shuffleArray([this.currentSpecies, ...wrongOptions]);

        options.forEach(sp => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.textContent = sp.name;
            btn.addEventListener('click', () => this.checkAnswer(sp.id, btn));
            optionsContainer.appendChild(btn);
        });

        // Если серия >= 5, то время 5 сек, иначе 10
        this.maxTime = this.currentStreak >= 5 ? 5 : 10;
        this.startTimer();
    },

    startTimer() {
        this.timeLeft = this.maxTime;
        const bar = document.getElementById('quiz-timer-bar');
        bar.style.width = '100%';
        bar.classList.remove('warning');

        this.timerId = setInterval(() => {
            this.timeLeft -= 0.1;
            const percent = (this.timeLeft / this.maxTime) * 100;
            bar.style.width = percent + '%';

            if (percent < 30) {
                bar.classList.add('warning');
            }

            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.timeOut();
            }
        }, 100);
    },

    stopTimer() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    },

    updateStreakUI() {
        const block = document.getElementById('quiz-streak-block');
        if (this.currentStreak > 0) {
            block.style.opacity = '1';
            block.classList.add('active');
        } else {
            block.style.opacity = '0.3';
            block.classList.remove('active');
        }
    },

    timeOut() {
        if (this.isAnswered) return;
        this.isAnswered = true;
        this.scoreWrong++;
        this.currentStreak = 0;
        this.updateStreakUI();
        document.getElementById('quiz-score-wrong').textContent = this.scoreWrong;
        document.getElementById('quiz-score-streak').textContent = '0';

        document.querySelectorAll('.quiz-option-btn').forEach(btn => {
            btn.style.pointerEvents = 'none';
            if (btn.textContent === this.currentSpecies.name) {
                btn.classList.add('correct');
            }
        });

        const resultContainer = document.getElementById('quiz-result');
        resultContainer.classList.remove('hidden');
        resultContainer.innerHTML = `<p style="color: #B71C1C;">Время вышло! Это <strong>${this.currentSpecies.name}</strong>.</p>`;

        this.showInfoPanel();
        this.showNextButton(resultContainer);
    },

    checkAnswer(selectedId, btnElement) {
        if (this.isAnswered) return;
        this.isAnswered = true;
        this.stopTimer();

        document.querySelectorAll('.quiz-option-btn').forEach(btn => {
            btn.style.pointerEvents = 'none';
        });

        const resultContainer = document.getElementById('quiz-result');
        resultContainer.classList.remove('hidden');
        const isCorrect = (selectedId === this.currentSpecies.id);

        if (isCorrect) {
            btnElement.classList.add('correct');
            this.scoreRight++;
            this.currentStreak++;
            document.getElementById('quiz-score-right').textContent = this.scoreRight;
            document.getElementById('quiz-score-streak').textContent = this.currentStreak;
            this.updateStreakUI();

            resultContainer.innerHTML = `<p style="color: #2E7D32;">Верно! Это <strong>${this.currentSpecies.name}</strong>.</p>`;
        } else {
            btnElement.classList.add('wrong');
            this.scoreWrong++;
            this.currentStreak = 0;
            document.getElementById('quiz-score-wrong').textContent = this.scoreWrong;
            document.getElementById('quiz-score-streak').textContent = '0';
            this.updateStreakUI();

            document.querySelectorAll('.quiz-option-btn').forEach(btn => {
                if (btn.textContent === this.currentSpecies.name) {
                    btn.classList.add('correct');
                }
            });
            resultContainer.innerHTML = `<p style="color: #B71C1C;">Неверно. Это <strong>${this.currentSpecies.name}</strong>.</p>`;
        }

        this.showInfoPanel();
        this.showNextButton(resultContainer);
    },

    showNextButton(container) {
        if (this.currentQuestionNum >= this.totalQuestions) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'quiz-next-btn';
            nextBtn.textContent = 'Показать результаты 🏆';
            nextBtn.addEventListener('click', () => this.finishGame());
            container.appendChild(nextBtn);
        } else {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'quiz-next-btn';
            nextBtn.textContent = 'Следующий вопрос →';
            nextBtn.addEventListener('click', () => {
                this.currentQuestionNum++;
                this.startNewQuestion();
            });
            container.appendChild(nextBtn);
        }
    },

    showInfoPanel() {
        const panel = document.getElementById('quiz-info-panel');
        panel.classList.remove('hidden');

        const sp = this.currentSpecies;
        document.getElementById('qi-name').textContent = sp.name;
        document.getElementById('qi-latin').textContent = sp.latin || '';

        const statusConfig = CONFIG.statuses.find(s => s.value === sp.status);
        const statusBlock = document.getElementById('qi-status');

        if (statusConfig) {
            statusBlock.querySelector('.qi-status-badge').textContent = statusConfig.value;
            statusBlock.querySelector('.qi-status-badge').style.background = statusConfig.color;
            statusBlock.querySelector('.qi-status-text').textContent = statusConfig.label;
        }

        SpeciesLoader.load(sp.id).then(data => {
            if (data && data.description_short) {
                document.getElementById('qi-desc').textContent = data.description_short;
            } else {
                document.getElementById('qi-desc').textContent = 'Краткое описание отсутствует.';
            }
        });
    },

    finishGame() {
        this.stopTimer();
        this.isGameActive = false; // Игра завершена
        document.getElementById('quiz-content').classList.add('hidden');
        document.getElementById('quiz-info-panel').classList.add('hidden');
        const endScreen = document.getElementById('quiz-end-screen');
        endScreen.classList.remove('hidden');

        const title = document.getElementById('quiz-end-title');
        const desc = document.getElementById('quiz-end-desc');
        const percent = (this.scoreRight / this.totalQuestions) * 100;

        if (percent >= 90) {
            title.textContent = '🏆 Вы настоящий биолог!';
            desc.textContent = `Вы ответили верно на ${this.scoreRight} из ${this.totalQuestions} вопросов. Отличное знание Красной книги!`;
        } else if (percent >= 60) {
            title.textContent = '🌿 Хороший результат!';
            desc.textContent = `Верных ответов: ${this.scoreRight} из ${this.totalQuestions}. Вы хорошо знаете природу, но есть куда стремиться.`;
        } else {
            title.textContent = '📖 Нужно повторить материал';
            desc.textContent = `Верных ответов: ${this.scoreRight} из ${this.totalQuestions}. Загляните в справочник видов, чтобы узнать больше!`;
        }
    },

    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof App === 'undefined') {
            console.warn('Quiz: App не загружен — игра не запущена.');
            return;
        }
        Quiz.init();
    }, 200);
});