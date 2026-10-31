// Экранирование HTML: используем ЕДИНУЮ глобальную window.escHtml из
// app-core.js. Собственное объявление escHtml здесь убрано: дубли
// идентификатора в глобальной области видимости ломали загрузку
// последующих скриптов (в т.ч. «Систематика»).

// Двойной клик по карточке — увеличение изображения. Увеличение
// ОТМЕНЯЕТСЯ КЛИКОМ В ЛЮБОМ МЕСТЕ экрана (по требованию игрока
// авто-сброс по таймеру убран — картинка не «прыгает» сама).
function resetMatchZoom() {
    document.querySelectorAll('.match-card.zoomed').forEach(z => z.classList.remove('zoomed'));
}

const MatchGame = {
    TOTAL_PAIRS: 10,
    init() {
        document.getElementById('btn-match').addEventListener('click', () => this.open());
        document.getElementById('match-close').addEventListener('click', () => this.close());
        document.getElementById('match-restart').addEventListener('click', () => this.startGame());
        // Крестик на финальном экране — закрыть игру
        document.querySelector('#match-end-screen .game-close-x')?.addEventListener('click', () => this.close());
        document.getElementById('match-restart-btn').addEventListener('click', () => this.startGame());

        // Сброс увеличения по клику в ЛЮБОМ месте экрана (в т.ч. по самой
        // карточке): dblclick всегда «догоняет» второй click и возвращает
        // зум, поэтому однократный клик картинку всегда отменяет.
        document.addEventListener('click', () => resetMatchZoom(), true);
    },
    open() {
        document.getElementById('match-modal').classList.remove('hidden');
        document.getElementById('app').style.pointerEvents = 'none';
        document.getElementById('match-modal').style.pointerEvents = 'auto';
        this.startGame();
    },
    close() {
        document.getElementById('match-modal').classList.add('hidden');
        GameEnd.leave('match');
        document.getElementById('app').style.pointerEvents = '';
    },
    startGame() {
        document.getElementById('match-end-screen').classList.add('hidden');
        GameEnd.leave('match');
        const grid = document.getElementById('match-grid');
        grid.innerHTML = '';

        // Добавляем счетчик ошибок
        this.mistakes = 0;

        const all = App.collectAllSpecies();
        if (all.length < this.TOTAL_PAIRS) {
            alert('Недостаточно видов в базе для игры (нужно минимум ' + this.TOTAL_PAIRS + ').');
            return;
        }
        const selected = [];
        // 4x5 = 20 карточек = 10 пар
        while (selected.length < this.TOTAL_PAIRS) {
            const sp = all[Math.floor(Math.random() * all.length)];
            if (!selected.find(s => s.id === sp.id)) selected.push(sp);
        }

        let cards = [];
        selected.forEach(sp => {
            cards.push({ type: 'img', id: sp.id, speciesId: sp.id });
            cards.push({ type: 'text', id: sp.id, speciesId: sp.id, name: sp.name });
        });
        cards = this.shuffle(cards);

        this.selectedCard = null;
        this.matchedCount = 0;

        cards.forEach(c => {
            const el = document.createElement('div');
            el.className = 'match-card';
            el.dataset.type = c.type;
            el.dataset.speciesId = c.speciesId;
            if (c.type === 'img') {
                el.innerHTML = `<img src="img/species/${c.id}.png" onerror="this.src='img/species/placeholder.png'">`;
            } else {
                el.innerHTML = `<span>${escHtml(c.name)}</span>`;
            }
            el.addEventListener('click', () => this.handleClick(el));
            // Двойной клик — рассмотреть изображение (только карточки с картинкой).
            // Срабатывает ПОСЛЕ сброса (капчер-слушатель на document), поэтому
            // успевает применить зум; отменяется следующим одиночным кликом.
            el.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (c.type !== 'img' || el.classList.contains('matched')) return;
                resetMatchZoom();
                el.classList.add('zoomed');
            });
            grid.appendChild(el);
        });
    },
    handleClick(el) {
        if (el.classList.contains('matched')) return;

        // Второй клик по выделенной карточке — снять выделение
        if (el.classList.contains('selected')) {
            el.classList.remove('selected');
            this.selectedCard = null;
            return;
        }

        if (!this.selectedCard) {
            this.selectedCard = el;
            el.classList.add('selected');
        } else {
            const first = this.selectedCard;
            const second = el;

            if (first.dataset.type === second.dataset.type) {
                // Кликнули на два одинаковых типа (два фото или два текста). Отменяем выбор.
                first.classList.remove('selected');
                this.selectedCard = second;
                second.classList.add('selected');
                return;
            }

            if (first.dataset.speciesId === second.dataset.speciesId) {
                // Совпало!
                first.classList.add('matched');
                second.classList.add('matched');
                first.classList.remove('selected');
                this.selectedCard = null;
                this.matchedCount++;
                if (this.matchedCount === this.TOTAL_PAIRS) { // все пары найдены
                    setTimeout(() => {
                        document.getElementById('match-final-moves').textContent = this.mistakes;

                        const titleEl = document.getElementById('match-end-title');
                        const achieveEl = document.getElementById('match-end-achieve');

                        // Логика ачивок для Найди пару (21 пара)
                        if (this.mistakes === 0) {
                            titleEl.textContent = '👑 Абсолютный чемпион!';
                            achieveEl.textContent = 'Получено достижение: «Без единой ошибки»';
                            this.unlockAch('flawless');
                        } else if (this.mistakes <= 3) {
                            titleEl.textContent = '🏆 Отличный результат!';
                            achieveEl.textContent = 'Получено достижение: «Орлиный глаз»';
                            this.unlockAch('eagle');
                        } else if (this.mistakes <= 8) {
                            titleEl.textContent = '🌟 Хорошая работа!';
                            achieveEl.textContent = 'Получено достижение: «Внимательный натуралист»';
                            this.unlockAch('naturalist');
                        } else {
                            titleEl.textContent = '🌱 Победа!';
                            achieveEl.textContent = 'Получено достижение: «Упорство и труд»';
                        }
                        this.unlockAch('persistent');

                        document.getElementById('match-end-screen').classList.remove('hidden');
                        GameEnd.enter('match'); // скрыть поле игры и ↺/✕
                    }, 500);
                }
            } else {
                // Не совпало
                this.mistakes++;
                second.classList.add('selected');
                document.getElementById('match-grid').style.pointerEvents = 'none';
                setTimeout(() => {
                    first.classList.remove('selected');
                    second.classList.remove('selected');
                    this.selectedCard = null;
                    document.getElementById('match-grid').style.pointerEvents = 'auto';
                }, 600);
            }
        }
    },
    // Выдача медали через общий реестр достижений (если тот загружен)
    unlockAch(achId) {
        try {
            if (typeof Achievements !== 'undefined' && Achievements.unlock) {
                Achievements.unlock('match', achId);
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
            MatchGame.init();
        } catch (e) {
            console.error('MatchGame: ошибка инициализации:', e);
        }
    };
    tryInit();
}, 200));
