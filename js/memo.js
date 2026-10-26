const MemoGame = {
    init() {
        document.getElementById('btn-memo').addEventListener('click', () => this.open());
        document.getElementById('memo-close').addEventListener('click', () => this.close());
        document.getElementById('memo-restart').addEventListener('click', () => this.startGame());
        document.getElementById('memo-restart-btn').addEventListener('click', () => this.startGame());
    },
    open() {
        document.getElementById('memo-modal').classList.remove('hidden');
        document.getElementById('app').style.pointerEvents = 'none';
        this.startGame();
    },
    close() {
        document.getElementById('memo-modal').classList.add('hidden');
        document.getElementById('app').style.pointerEvents = '';
    },
    startGame() {
        document.getElementById('memo-end-screen').classList.add('hidden');
        const grid = document.getElementById('memo-grid');
        grid.innerHTML = '';
        document.getElementById('memo-info-panel').classList.remove('hidden');
        const listContainer = document.getElementById('memo-species-list');
        listContainer.innerHTML = '';

        const rows = 4;
        const cols = 6;
        const totalCards = rows * cols; // 24
        const pairs = totalCards / 2;   // 12
        const size = cols;              // для расчета сетки

        // Динамический расчет размера карточек
        const maxGridWidth = grid.clientWidth - 40;
        const maxGridHeight = grid.clientHeight - 40;
        const gap = 10;

        // Вычисляем максимальный возможный размер карточки по ширине и высоте
        const cardSizeW = Math.floor((maxGridWidth - (cols - 1) * gap) / cols);
        const cardSizeH = Math.floor((maxGridHeight - (rows - 1) * gap) / rows);
        const cardSize = Math.min(cardSizeW, cardSizeH);

        grid.style.gridTemplateColumns = `repeat(${cols}, ${cardSize}px)`;
        grid.style.gridTemplateRows = `repeat(${rows}, ${cardSize}px)`;
        grid.style.justifyContent = 'center';
        grid.style.alignContent = 'center';

        this.moves = 0;
        document.getElementById('memo-moves').textContent = '0';
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.lockBoard = false;

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

                // Вычеркиваем вид в списке
                const foundLi = document.querySelector(`.memo-species-item[data-species-id="${first.dataset.speciesId}"]`);
                if (foundLi) {
                    foundLi.classList.add('found');
                }

                const totalPairs = 12; // 6x4 = 24 карточки = 12 пар
                if (this.matchedPairs === totalPairs) {
                    setTimeout(() => {
                        document.getElementById('memo-final-moves').textContent = this.moves;

                        // Логика выдачи ачивки
                        const titleEl = document.getElementById('memo-end-title');
                        const achieveEl = document.getElementById('memo-end-achieve');

                        // Идеальное количество ходов для 12 пар — это 12.
                        // 15 и меньше — очень хорошо. 20 и меньше — нормально.
                        if (this.moves <= 14) {
                            titleEl.textContent = '👑 Идеальная память!';
                            achieveEl.textContent = 'Достижение получено: «Фотографическая память»';
                        } else if (this.moves <= 20) {
                            titleEl.textContent = '🏆 Отличный результат!';
                            achieveEl.textContent = 'Достижение получено: «Знаток Красной книги»';
                        } else if (this.moves <= 28) {
                            titleEl.textContent = '🌟 Хорошая работа!';
                            achieveEl.textContent = 'Достижение получено: «Внимательный натуралист»';
                        } else {
                            titleEl.textContent = '🌱 Победа!';
                            achieveEl.textContent = 'Достижение получено: «Первый шаг в науке»';
                        }

                        document.getElementById('memo-end-screen').classList.remove('hidden');
                    }, 500);
                }
            } else {
                // Не совпало
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
        console.warn('MemoGame: App не загружен — игра не запущена.');
        return;
    }
    MemoGame.init();
}, 200));