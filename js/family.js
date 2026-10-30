// ============================================================
// ИГРА «СИСТЕМАТИК» (Family Sort)
// Разложи виды по систематическим группам: животные, растения,
// грибы, лишайники. 3 раунда по 6 карточек — перетаскивание
// (drag&drop) и касания (тап по карточке, затем по корзине).
// ============================================================

const FamilyGame = {
    CARDS_PER_ROUND: 6,
    TOTAL_ROUNDS: 3,
    ROUND_TIME: 60, // секунд на раунд

    init() {
        document.getElementById('btn-family').addEventListener('click', () => this.open());
        document.getElementById('family-close').addEventListener('click', () => this.close());
        document.getElementById('family-restart').addEventListener('click', () => this.startGame());
        // Крестик на финальном экране — закрыть игру
        document.querySelector('#family-end-screen .game-close-x')?.addEventListener('click', () => this.close());
        document.getElementById('family-restart-btn').addEventListener('click', () => this.startGame());
        const nextBtn = document.getElementById('family-next-round-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.continueToNextRound());
    },

    open() {
        document.getElementById('family-modal').classList.remove('hidden');
        document.getElementById('app').style.pointerEvents = 'none';
        document.getElementById('family-modal').style.pointerEvents = 'auto';
        this.startGame();
    },

    close() {
        document.getElementById('family-modal').classList.add('hidden');
        this.stopTimer();
        document.getElementById('app').style.pointerEvents = '';
    },

    startGame() {
        this.round = 0;
        this.score = 0;      // верно разложенные карточки за игру
        this.mistakes = 0;   // ошибочные помещения
        this.usedIds = new Set();
        this.hideNextRoundBtn();
        document.getElementById('family-end-screen').classList.add('hidden');
        this.nextRound();
    },

    showNextRoundBtn() {
        const btn = document.getElementById('family-next-round-btn');
        if (!btn) return;
        btn.textContent = (this.round >= this.TOTAL_ROUNDS) ? 'Итоги игры →' : 'Продолжить →';
        btn.classList.remove('hidden');
    },

    hideNextRoundBtn() {
        const btn = document.getElementById('family-next-round-btn');
        if (btn) btn.classList.add('hidden');
    },

    continueToNextRound() {
        this.hideNextRoundBtn();
        this.nextRound();
    },

    groups() {
        // Берём верхние таксономические группы из общего конфига
        return (window.CONFIG && CONFIG.categories) ? CONFIG.categories : [];
    },

    nextRound() {
        if (this.round >= this.TOTAL_ROUNDS) {
            this.finishGame();
            return;
        }
        this.round++;
        this.placedCount = 0;
        this.roundMistakes = 0;
        this.selectedCard = null;
        this.hideNextRoundBtn();

        const groups = this.groups();
        if (!groups.length) {
            alert('Не загружен справочник категорий.');
            this.close();
            return;
        }

        // Формируем пул: стараемся взять по 2 вида на группу (детект категории — как на карте)
        const all = App.collectAllSpecies().filter(sp => sp.name && !this.usedIds.has(sp.id));
        const byGroup = {};
        groups.forEach(g => byGroup[g.key] = []);
        all.forEach(sp => {
            const key = App.detectCategory(sp.id);
            if (byGroup[key]) byGroup[key].push(sp);
        });
        // Сколько карточек хотя бы одной группы доступно сейчас
        const available = Object.values(byGroup).reduce((n, l) => n + l.length, 0);
        let items = [];
        if (available >= this.CARDS_PER_ROUND) {
            // Полный набор: по 2 на группу + добор случайными до 6, при этом
            // в раунде гарантированно представлены минимум 2 разные группы
            const groupKeys = groups.map(g => g.key);
            groupKeys.forEach(k => {
                const list = this.shuffle(byGroup[k]);
                items.push(...list.slice(0, 2).map(sp => ({ sp, group: k })));
            });
            if (items.length < this.CARDS_PER_ROUND) {
                const rest = this.shuffle(all.filter(sp => !items.find(i => i.sp.id === sp.id)));
                for (const sp of rest) {
                    if (items.length >= this.CARDS_PER_ROUND) break;
                    items.push({ sp, group: App.detectCategory(sp.id) });
                }
            }
            if (items.length > this.CARDS_PER_ROUND) {
                items = this.shuffle(items).slice(0, this.CARDS_PER_ROUND);
            }
            // Если из-за нехватки видов группа представлена 1 картой — ок;
            // но если вдруг все карты одной группы, перемешаем для разнообразия
        } else {
            // Мало видов в базе — берём что есть (не меньше 2 карт)
            items = this.shuffle(all.map(sp => ({ sp, group: App.detectCategory(sp.id) })));
        }
        if (items.length < Math.min(this.CARDS_PER_ROUND, 2)) {
            alert('Недостаточно видов в базе для игры.');
            this.close();
            return;
        }
        items.forEach(i => this.usedIds.add(i.sp.id));
        this.roundItems = this.shuffle(items);

        document.getElementById('family-round-label').innerHTML =
            `Раунд <strong id="family-q-num">${this.round}</strong> из ${this.TOTAL_ROUNDS}`;
        this.updateScoreboard();

        this.renderTray();
        this.renderBaskets(groups);
        this.startTimer();
    },

    updateScoreboard() {
        document.getElementById('family-score-right').textContent = this.score;
        document.getElementById('family-score-wrong').textContent = this.mistakes;
    },

    renderTray() {
        const tray = document.getElementById('family-tray');
        tray.innerHTML = '';
        this.roundItems.forEach(item => {
            if (item.done) return;
            const card = document.createElement('div');
            card.className = 'family-card';
            card.draggable = true;
            card.dataset.speciesId = item.sp.id;

            const img = document.createElement('img');
            img.src = `img/species/${item.sp.id}.png`;
            img.alt = item.sp.name || '';
            img.loading = 'lazy';
            img.addEventListener('error', () => { img.src = 'img/species/placeholder.png'; });

            const name = document.createElement('div');
            name.className = 'fc-name';
            name.textContent = item.sp.name || '';

            card.appendChild(img);
            card.appendChild(name);

            card.addEventListener('dragstart', (e) => {
                this.selectedCard = item;
                card.classList.add('dragging');
                try { e.dataTransfer.setData('text/plain', item.sp.id); } catch (err) { /* noop */ }
            });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
            // Тап-режим (мобильные): выделить карточку, затем нажать на корзину
            card.addEventListener('click', () => {
                if (card.classList.contains('selected')) {
                    card.classList.remove('selected');
                    this.selectedCard = null;
                    return;
                }
                tray.querySelectorAll('.family-card.selected').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedCard = item;
            });

            tray.appendChild(card);
        });
    },

    renderBaskets(groups) {
        const zone = document.getElementById('family-baskets');
        zone.innerHTML = '';
        groups.forEach(g => {
            const basket = document.createElement('div');
            basket.className = 'family-basket family-basket-' + g.key;
            basket.dataset.group = g.key;

            const head = document.createElement('div');
            head.className = 'fb-head';
            head.textContent = `${g.icon} ${g.label}`;

            const slotWrap = document.createElement('div');
            slotWrap.className = 'fb-slots';

            basket.appendChild(head);
            basket.appendChild(slotWrap);

            const accept = (e) => {
                e.preventDefault();
                e.currentTarget.classList.add('fb-over');
            };
            basket.addEventListener('dragover', accept);
            basket.addEventListener('dragenter', accept);
            basket.addEventListener('dragleave', () => basket.classList.remove('fb-over'));
            basket.addEventListener('drop', (e) => {
                e.preventDefault();
                basket.classList.remove('fb-over');
                this.placeInto(g.key, basket);
            });
            // Тап-режим
            basket.addEventListener('click', () => this.placeInto(g.key, basket));

            zone.appendChild(basket);
        });
    },

    placeInto(groupKey, basketEl) {
        const item = this.selectedCard;
        if (!item || item.done) { this.selectedCard = null; return; }
        this.selectedCard = null;

        if (groupKey === item.group) {
            item.done = true;
            this.placedCount++;
            this.score++;
            this.updateScoreboard();

            // Мини-плитка с фото — в корзину
            const slots = basketEl.querySelector('.fb-slots');
            const mini = document.createElement('div');
            mini.className = 'fb-mini';
            mini.title = item.sp.name || '';
            const img = document.createElement('img');
            img.src = `img/species/${item.sp.id}.png`;
            img.alt = '';
            img.loading = 'lazy';
            img.addEventListener('error', () => {
                img.remove();
                mini.classList.add('fb-mini-text');
                mini.textContent = String(item.sp.name || '').split(' ')[0];
            });
            mini.appendChild(img);
            slots.appendChild(mini);

            // Убираем карточку из лотка
            const cardEl = document.querySelector(`#family-tray .family-card[data-species-id="${CSS.escape(String(item.sp.id))}"]`);
            if (cardEl) cardEl.remove();

            if (this.placedCount === this.roundItems.length) {
                this.stopTimer();
                if (this.roundMistakes === 0) this.unlockAch('perfectround');
                this.showNextRoundBtn();
            }
        } else {
            this.mistakes++;
            this.roundMistakes++;
            this.updateScoreboard();
            basketEl.classList.add('fb-shake');
            setTimeout(() => basketEl.classList.remove('fb-shake'), 500);
            // Снимаем выделение с карточки
            const cardEl = document.querySelector(`#family-tray .family-card[data-species-id="${CSS.escape(String(item.sp.id))}"]`);
            if (cardEl) cardEl.classList.remove('selected');
        }
    },

    startTimer() {
        this.stopTimer();
        this.timeLeft = this.ROUND_TIME;
        const bar = document.getElementById('family-timer-bar');
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
        const titleEl = document.getElementById('family-end-title');
        const achieveEl = document.getElementById('family-end-achieve');
        document.getElementById('family-final-score').textContent = this.score;
        document.getElementById('family-final-mistakes').textContent = this.mistakes;

        titleEl.textContent = titleText;

        let achieve = '';
        if (titleText.startsWith('🏆')) {
            this.unlockAch('systematicist'); // базовая медаль за прохождение
            if (this.mistakes === 0) {
                achieve = 'Достижение: «Академик систематике» — ни одной ошибки!';
                this.unlockAch('professor');
            } else if (this.mistakes <= 2) {
                achieve = 'Достижение: «Систематик-практик» — не более 2 ошибок!';
                this.unlockAch('practitioner');
            } else {
                achieve = 'Таксономия требует практики — попробуй ещё раз!';
            }
        } else {
            achieve = this.score > 0
                ? `Вы верно разложили ${this.score} карточек. Попробуйте ещё раз!`
                : 'Ни одна карточка не разложена верно. Не сдавайтесь!';
        }
        achieveEl.textContent = achieve;

        try {
            if (typeof Achievements !== 'undefined' && Achievements.bumpGameCounter) {
                Achievements.bumpGameCounter('family');
            }
        } catch (e) { /* noop */ }

        document.getElementById('family-end-screen').classList.remove('hidden');
    },

    unlockAch(achId) {
        try {
            if (typeof Achievements !== 'undefined' && Achievements.unlock) {
                Achievements.unlock('family', achId);
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
    const tryInit = () => {
        if (!window.App) {
            setTimeout(tryInit, 500);
            return;
        }
        try {
            FamilyGame.init();
        } catch (e) {
            console.error('FamilyGame: ошибка инициализации:', e);
        }
    };
    tryInit();
}, 200));
