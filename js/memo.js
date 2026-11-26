// Экранирование HTML: используем ЕДИНУЮ глобальную window.escHtml из
// app-core.js. Собственное объявление escHtml убрано — дубликаты
// идентификатора в глобальной области ломали загрузку скриптов.

const MemoGame = {
    init() {
        document.getElementById('btn-memo').addEventListener('click', () => this.open());
        document.getElementById('memo-close').addEventListener('click', () => this.close());
        document.getElementById('memo-restart').addEventListener('click', () => this.startGame());
        // Крестик на финальном экране — закрыть игру
        document.querySelector('#memo-end-screen .game-close-x')?.addEventListener('click', () => this.close());
        document.getElementById('memo-restart-btn').addEventListener('click', () => this.startGame());
    },
    open() {
        document.getElementById('memo-modal').classList.remove('hidden');
        document.getElementById('app').style.pointerEvents = 'none';
        document.getElementById('memo-modal').style.pointerEvents = 'auto';
        // Раскладка грида зависит от его реальных размеров: сразу после
        // снятия .hidden clientWidth/clientHeight ещё могут быть 0 —
        // сетка схлопывалась в «тонкую полосу». Ждём один кадр, чтобы
        // браузер выполнил layout, и только тогда запускаем игру.
        requestAnimationFrame(() => this.startGame());
    },
    close() {
        document.getElementById('memo-modal').classList.add('hidden');
        GameEnd.leave('memo');
        document.body.classList.remove('quiz-end-open');
        GameEnd.leave('memo');
        document.getElementById('app').style.pointerEvents = '';
    },
    startGame() {
        document.getElementById('memo-end-screen').classList.add('hidden');
        GameEnd.leave('memo');
        document.body.classList.remove('quiz-end-open'); // вернуть игровые ↺/✕
        GameEnd.leave('memo');
        const grid = document.getElementById('memo-grid');
        grid.innerHTML = '';
        document.getElementById('memo-info-panel').classList.remove('hidden');
        const listContainer = document.getElementById('memo-species-list');
        listContainer.innerHTML = '';

        // Адаптивная раскладка: на мобильных — сетка 5×5, из них 24
        // карточки (12 пар) и одна ПУСТАЯ ячейка ровно по центру
        // (row 3, col 3) — по требованию игрока. На десктопе — 4×6.
        const isMobile = window.matchMedia('(max-width: 820px)').matches;
        let rows, cols;
        if (isMobile) { rows = 5; cols = 5; }        // 25 ячеек: 24 карты + пустой центр
        else            { rows = 4; cols = 6; }      // 24 карты = 12 пар
        const totalCells = rows * cols;              // 25 или 24
        const emptyCellIndex = isMobile ? Math.floor(totalCells / 2) : -1; // индекс центра (12)
        const pairs = (totalCells - (isMobile ? 1 : 0)) / 2;   // всегда 12 пар

        // Надежный расчет размеров
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isTablet = vw > 820 && vw <= 1100;

        // Ждем малейшего тика, чтобы DOM успел применить CSS
        // Если grid.clientWidth равен 0, высчитываем ширину вручную
        let availableWidth;
        if (grid.clientWidth > 0) {
            availableWidth = grid.clientWidth - 20; // минус паддинги
        } else {
            // На планшете и мобилке панель уходит вниз, ширина = 100vw
            availableWidth = vw - 24; 
        }

        // Увеличиваем доступную высоту, чтобы карточки были крупнее (дыры снизу больше не будет)
        const availableHeight = vh * (isMobile ? 0.65 : 0.60); 

        const gap = isMobile ? 5 : (isTablet ? 8 : 10);

        // Считаем идеальный размер карточки
        const cardSizeW = Math.floor((availableWidth - (cols - 1) * gap) / cols);
        const cardSizeH = Math.floor((availableHeight - (rows - 1) * gap) / rows);
        
        let cardSize = Math.min(cardSizeW, cardSizeH);
        
        let maxCardLimit = 130;
        if (isMobile) maxCardLimit = 92;
        else if (isTablet) maxCardLimit = 100; // Для планшета делаем чуть меньше, чтобы не выпирало

        cardSize = Math.max(36, Math.min(cardSize, maxCardLimit));

        // Сетка ровно по размеру карточек, без лишних растяжений
        grid.style.gridTemplateColumns = `repeat(${cols}, ${cardSize}px)`;
        grid.style.gridTemplateRows = `repeat(${rows}, ${cardSize}px)`;
        grid.style.gap = gap + 'px';
        grid.style.justifyContent = 'center';
        grid.style.alignContent = 'center';
        grid.style.width = '100%'; 
        grid.style.margin = '0';

        this.moves = 0;
        document.getElementById('memo-moves').textContent = '0';
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.lockBoard = false;
        this.perfectChain = 0; // серия угаданных пар без ошибок (для «Дедукции»)

        // Выбираем уникальные виды для пар
        const all = App.collectAllSpecies();
        const selected = [];
        while (selected.length < pairs) {
            const sp = all[Math.floor(Math.random() * all.length)];
            if (!selected.find(s => s.id === sp.id)) selected.push(sp);
        }

        let cards = [];
        selected.forEach(sp => {
            cards.push({ id: sp.id, speciesId: sp.id });
            cards.push({ id: sp.id, speciesId: sp.id });
        });
        cards = this.shuffle(cards);

        // Заполняем список видов в свитке
        selected.forEach(sp => {
            const li = document.createElement('li');
            li.className = 'memo-species-item';
            li.dataset.speciesId = sp.id;
            li.textContent = sp.name;
            listContainer.appendChild(li);
        });

        cards.forEach(c => {
            const el = document.createElement('div');
            el.className = 'memo-card';
            el.dataset.speciesId = c.speciesId;
            el.innerHTML = `
        <div class="memo-back">КРАСНАЯ<br>КНИГА</div>
        <div class="memo-front"><img src="img/species/${c.id}.png" onerror="this.src='img/species/placeholder.png'"></div>
      `;
            el.addEventListener('click', () => this.flipCard(el));
            grid.appendChild(el);
        });

        // Мобильная сетка 5×5: одна ячейка по центру — БЕЗ карточки.
        // Пустая заглушка ставится ровно в центр (grid-row/column),
        // поэтому порядок карт в DOM не меняется, а в центре грида
        // остаётся пустое место.
        if (emptyCellIndex >= 0) {
            const blank = document.createElement('div');
            blank.className = 'memo-cell-empty';
            blank.setAttribute('aria-hidden', 'true');
            blank.style.gridRow = Math.floor(emptyCellIndex / cols) + 1;
            blank.style.gridColumn = (emptyCellIndex % cols) + 1;
            grid.appendChild(blank);
        }
    },
    flipCard(el) {
        if (this.lockBoard || el.classList.contains('flipped') || el.classList.contains('matched')) return;

        el.classList.add('flipped');
        this.flippedCards.push(el);

        if (this.flippedCards.length === 2) {
            this.moves++;
            document.getElementById('memo-moves').textContent = this.moves;

            const first = this.flippedCards[0];
            const second = this.flippedCards[1];

            if (first.dataset.speciesId === second.dataset.speciesId) {
                // Совпало
                first.classList.add('matched');
                second.classList.add('matched');
                this.flippedCards = [];
                this.matchedPairs++;
                this.perfectChain++;
                // «Дедукция»: 5 найденных пар подряд с первой попытки.
                if (this.perfectChain >= 5) this.unlockAch('deduction');

                // НЕ вычёркиваем сразу — сделаем это после полёта карточки.
                // Передаём speciesId в showMatchedSpecies, он сам найдёт строку.
                const speciesId = first.dataset.speciesId;
                this.showMatchedSpecies(speciesId);
                // 24 карточки = 12 пар (мобильная сетка 5×5 с пустым
                // центром и десктопная 4×6 — обе на 12 пар)
                const totalPairs = 12;
                if (this.matchedPairs === totalPairs) {
                    setTimeout(() => {
                        document.getElementById('memo-final-moves').textContent = this.moves;

                        // Логика выдачи ачивки
                        const titleEl = document.getElementById('memo-end-title');
                        const achieveEl = document.getElementById('memo-end-achieve');

                        // Минимум ходов для 12 пар — 24 переворота = 12 ходов,
                        // но это возможно только при идеальном запоминании
                        // каждой карточки. Реалистичные пороги:
                        //   • ≤18 — «Повелитель удачи» (феноменальная память + удача);
                        //   • ≤22 — «Фотографическая память» (главная 👑);
                        //   • ≤24 — «Знаток Красной книги»;
                        //   • ≤26 — «Внимательный натуралист».
                        // «Повелитель удачи» — независимая медаль: выдаётся
                        // даже если игрок получил «Фотографическую память».
                        // Выдаём все медали, условия которых выполнены.
                        // Раньше стоял else-if, и при 22 ходах выдавалась только
                        // «Фотографическая память», а «Знаток» (≤24) пропускался.
                        if (this.moves <= 18) this.unlockAch('memoryking');
                        if (this.moves <= 22) this.unlockAch('photo');
                        if (this.moves <= 24) this.unlockAch('expert');
                        if (this.moves <= 26) this.unlockAch('attentive');
                        this.unlockAch('firststep');

                        // Визуальный титул на экране победы — по самому строгому
                        // выполненному условию (для красоты, на медали не влияет).
                        if (this.moves <= 22) {
                            titleEl.textContent = '👑 Идеальная память!';
                            achieveEl.textContent = 'Достижение получено: «Фотографическая память»';
                        } else if (this.moves <= 24) {
                            titleEl.textContent = '🏆 Отличный результат!';
                            achieveEl.textContent = 'Достижение получено: «Знаток Красной книги»';
                        } else if (this.moves <= 26) {
                            titleEl.textContent = '🌟 Хорошая работа!';
                            achieveEl.textContent = 'Достижение получено: «Внимательный натуралист»';
                        } else {
                            titleEl.textContent = '🌱 Победа!';
                            achieveEl.textContent = 'Достижение получено: «Первый шаг в науке»';
                        }

                        // Счётчик партий (для кросс-медали «Игроман»)
                        // и побед (для «Десяти раундов»: 10 побед).
                        try {
                            if (typeof Achievements !== 'undefined') {
                                // bumpGameCounter вызывается ТОЛЬКО при победе,
                                // поэтому gamesPlayed:memo == число побед.
                                if (Achievements.bumpGameCounter) {
                                    Achievements.bumpGameCounter('memo');
                                }
                                if (Achievements.bumpMeta) {
                                    const wins = Achievements.bumpMeta('memoWins');
                                    // «Десять раундов»: 10 побед. Проверяем и
                                    // memoWins (новый счётчик), и gamesPlayed:memo
                                    // (старые сохранения) — чтобы медаль не
                                    // терялась у тех, кто уже выиграл 10 раз.
                                    const played = Achievements.meta['gamesPlayed:memo'] || 0;
                                    if (wins >= 10 || played >= 10) {
                                        Achievements.unlock('memo', 'tenrounds');
                                    }
                                }
                            }
                        } catch (e) { /* noop */ }

                        document.getElementById('memo-end-screen').classList.remove('hidden');
                        try { GameEnd.enter('memo'); } catch (e) { /* noop */ }
                        // Прячем игровые ↺/✕ на финале — см. responsive.css
                        // (body.quiz-end-open). Класс вешаем ВСЕГДА и НА ВСЕХ ширинах.
                        document.body.classList.add('quiz-end-open');
                    }, 500);
                }
            } else {
                // Не совпало
                this.perfectChain = 0; // серия «с первой попытки» прервана
                this.lockBoard = true;
                setTimeout(() => {
                    first.classList.remove('flipped');
                    second.classList.remove('flipped');
                    this.flippedCards = [];
                    this.lockBoard = false;
                }, 800);
            }
        }
    },

    showMatchedSpecies(speciesId) {
        // Оверлей с фото убран по замечанию игрока (слишком долго «горел»).
        // Теперь: строка названия в списке подсвечивается (just-found),
        // затем вместо зачёркивания рядом появляется галочка (found → ✔).
        const foundLi = document.querySelector(
            `.memo-species-item[data-species-id="${speciesId}"]`
        );
        if (!foundLi) return;

        // 1) Подсветка названия (вспышка) — сразу при совпадении.
        foundLi.classList.add('just-found');

        // 2) Через 350 мс — галочка «✔» рядом (found), вспышку снимаем.
        setTimeout(() => {
            foundLi.classList.remove('just-found');
            foundLi.classList.add('found'); // CSS: ::after { content: '✔' }
        }, 500);
    },

    // Выдача медали через общий реестр достижений (если тот загружен)
    unlockAch(achId) {
        try {
            if (typeof Achievements !== 'undefined' && Achievements.unlock) {
                Achievements.unlock('memo', achId);
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
            MemoGame.init();
        } catch (e) {
            console.error('MemoGame: ошибка инициализации:', e);
        }
    };
    tryInit();
}, 200));
