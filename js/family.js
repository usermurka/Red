// ============================================================
// ИГРА «СИСТЕМАТИК» (Family Sort)
// Разложи виды по систематическим группам: животные, растения,
// грибы, лишайники. 6 раундов по 12 карточек — перетаскивание
// (drag&drop) и касания (тап по карточке, затем по корзине).
//
// Правила по замечаниям игрока:
//  • В лотке — карточки с изображением и названием; в корзины
//    («зоны распределения») карточка «встаёт» СТРОКОЙ с одним
//    названием (без картинки).
//  • Карточка ложится в ЛЮБУЮ корзину — это просто раскладка,
//    ошибка НЕ засчитывается и карточка НЕ «отскакивает».
//  • Раскладывать можно сколько угодно: строки из корзины
//    возвращаются в лоток тапом/перетаскиванием обратно.
//  • Результаты видны только после нажатия «✔ Проверить»:
//      - верные строки фиксируются (золотая рамка, снять нельзя);
//      - НЕВЕРНЫЕ строки исчезают из корзин и ВСЕ возвращаются
//        в лоток (исправлено: раньше при нескольких неверных
//        в одной корзине часть карточек «терялась», потому что
//        возврат искал элемент по id вида во всей игре);
//      - счёт ошибок пополняется только на проверке.
//  • Если всё верно — раунд НЕ переключается сам: появляется
//    баннер и кнопка «Продолжить →» (переход только по нажатию).
// ============================================================

// Экранирование HTML (защита при выводе названий видов; если модуль
// app-core.js уже загрузился — берём его версию)
const escHtml = (typeof window !== 'undefined' && window.escHtml)
    ? window.escHtml
    : function (str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    };

const FamilyGame = {
    CARDS_PER_ROUND: 12,
    TOTAL_ROUNDS: 6,
    ROUND_TIME: 150, // секунд на раунд (12 карточек)

    init() {
        document.getElementById('btn-family').addEventListener('click', () => this.open());
        document.getElementById('family-close').addEventListener('click', () => this.close());
        document.getElementById('family-restart').addEventListener('click', () => this.startGame());
        // Крестик на финальном экране — закрыть игру
        document.querySelector('#family-end-screen .game-close-x')?.addEventListener('click', () => this.close());
        document.getElementById('family-restart-btn').addEventListener('click', () => this.startGame());
        const nextBtn = document.getElementById('family-next-round-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.continueToNextRound());
        const checkBtn = document.getElementById('family-check-btn');
        if (checkBtn) checkBtn.addEventListener('click', () => this.checkLayout());
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
        this.score = 0;      // верно зафиксированные карточки за игру (только после проверок)
        this.mistakes = 0;   // ошибочные помещения (фиксируются только проверкой)
        this.usedIds = new Set();
        this.hideNextRoundBtn();
        this.hideBanner();
        document.getElementById('family-check-result').classList.add('hidden');
        document.getElementById('family-end-screen').classList.add('hidden');
        this.nextRound();
    },

    showNextRoundBtn(label) {
        const btn = document.getElementById('family-next-round-btn');
        if (!btn) return;
        btn.textContent = label || ((this.round >= this.TOTAL_ROUNDS) ? 'Итоги игры →' : 'Продолжить →');
        // Кнопка всегда на месте (окно не «прыгает»): до конца раунда —
        // бледная и неактивная, после проверки — активная.
        btn.classList.remove('hidden', 'is-idle');
        btn.classList.add('is-active');
        btn.disabled = false;
        try { btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
    },

    hideNextRoundBtn() {
        const btn = document.getElementById('family-next-round-btn');
        if (!btn) return;
        btn.textContent = 'Продолжить →';
        btn.classList.remove('hidden', 'is-active');
        btn.classList.add('is-idle');
        btn.disabled = true;
    },

    showBanner(text) {
        const b = document.getElementById('family-round-banner');
        if (!b) return;
        b.textContent = text;
        b.classList.remove('hidden');
    },

    hideBanner() {
        const b = document.getElementById('family-round-banner');
        if (b) { b.classList.add('hidden'); b.textContent = ''; }
    },

    setCheckEnabled(enabled) {
        const btn = document.getElementById('family-check-btn');
        if (btn) btn.disabled = !enabled;
    },

    continueToNextRound() {
        this.hideNextRoundBtn();
        this.hideBanner();
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
        this.selectedCard = null;
        this.lockedAfterCheck = false; // после «всё верно» до нажатия «Продолжить»
        this.hideNextRoundBtn();
        this.hideBanner();
        document.getElementById('family-check-result').classList.add('hidden');
        document.getElementById('family-check-result').className = 'family-check-result hidden';
        this.setCheckEnabled(true);

        const groups = this.groups();
        if (!groups.length) {
            alert('Не загружен справочник категорий.');
            this.close();
            return;
        }

        // Формируем пул: по 3 вида на группу (детект категории — как на карте),
        // всего 12 карточек в раунде при четырёх группах
        const perGroup = Math.ceil(this.CARDS_PER_ROUND / Math.max(groups.length, 1));
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
            // Базовый набор: по 3 на группу; если где-то не хватает — добираем
            // из остальных групп и случайными видами до CARDS_PER_ROUND
            const groupKeys = groups.map(g => g.key);
            groupKeys.forEach(k => {
                const list = this.shuffle(byGroup[k]);
                items.push(...list.slice(0, perGroup).map(sp => ({ sp, group: k })));
            });
            if (items.length < this.CARDS_PER_ROUND) {
                // Добор: сначала «излишками» из групп, затем любыми свежими видами
                const extra = [];
                groupKeys.forEach(k => {
                    extra.push(...this.shuffle(byGroup[k]).slice(perGroup));
                });
                const chosenIds = new Set(items.map(i => i.sp.id));
                const rest = this.shuffle(extra.concat(
                    all.filter(sp => !chosenIds.has(sp.id) && !extra.find(e => e.id === sp.id))
                ));
                for (const sp of rest) {
                    if (items.length >= this.CARDS_PER_ROUND) break;
                    if (chosenIds.has(sp.id)) continue;
                    const key = App.detectCategory(sp.id);
                    if (!key) continue;
                    items.push({ sp, group: key });
                    chosenIds.add(sp.id);
                }
            }
            if (items.length > this.CARDS_PER_ROUND) {
                items = this.shuffle(items).slice(0, this.CARDS_PER_ROUND);
            }
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
        // placement: speciesId -> ключ корзины, в которую карточку положил игрок
        this.placement = {};
        this.roundFixed = 0; // верно зафиксировано в текущем раунде

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

    // ---------- Рендер лотка ----------
    renderTray() {
        const tray = document.getElementById('family-tray');
        tray.innerHTML = '';
        let freeCount = 0;
        this.roundItems.forEach(item => {
            if (item.done) return;              // зафиксированные проверкой живут в корзинах
            if (this.placement[item.sp.id]) return; // карточка уже лежит в корзине
            freeCount++;
            tray.appendChild(this.buildCard(item, true));
        });
        if (!freeCount) {
            const ph = document.createElement('div');
            ph.className = 'family-tray-empty';
            ph.textContent = 'Все карточки разложены — нажми «✔ Проверить»';
            tray.appendChild(ph);
        }
    },

    // Карточка вида: используется и в лотке, и внутри корзины
    buildCard(item, inTray) {
        const card = document.createElement('div');
        card.className = 'family-card' + (inTray ? '' : ' fb-in-basket');
        card.draggable = !this.lockedAfterCheck;
        card.dataset.speciesId = item.sp.id;

        const img = document.createElement('img');
        img.src = `img/species/${item.sp.id}.png`;
        img.alt = item.sp.name || '';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
            // Файла фото нет — текстовая заглушка вместо битой картинки
            img.remove();
            const ph = document.createElement('div');
            ph.className = 'fc-img-ph';
            ph.textContent = String(item.sp.name || '').split(' ')[0];
            card.insertBefore(ph, card.firstChild);
        });

        const name = document.createElement('div');
        name.className = 'fc-name';
        name.textContent = item.sp.name || '';

        card.appendChild(img);
        card.appendChild(name);

        card.addEventListener('dragstart', (e) => {
            if (this.lockedAfterCheck) { e.preventDefault(); return; }
            this.selectedCard = item;
            card.classList.add('dragging');
            try {
                e.dataTransfer.setData('text/plain', String(item.sp.id));
                e.dataTransfer.effectAllowed = 'move';
            } catch (err) { /* noop */ }
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        // Тап-режим (мобильные): выделить карточку, затем нажать на корзину.
        // Тап по строке в корзине — вернуть её в лоток (обработчик навешивается
        // отдельно в buildBasketRow).
        card.addEventListener('click', () => {
            if (this.lockedAfterCheck) return;
            if (card.classList.contains('selected')) {
                card.classList.remove('selected');
                this.selectedCard = null;
                return;
            }
            const trayEl = document.getElementById('family-tray');
            trayEl.querySelectorAll('.family-card.selected').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            this.selectedCard = item;
        });
        return card;
    },

    // Строка с названием вида — так карточка «встаёт» в зоне распределения
    // (без изображения, только название; клик — вернуть в лоток).
    buildBasketRow(item) {
        const row = document.createElement('div');
        row.className = 'family-card fb-row';
        row.dataset.speciesId = item.sp.id;
        row.draggable = !this.lockedAfterCheck;

        const name = document.createElement('div');
        name.className = 'fc-name fb-row-name';
        name.textContent = item.sp.name || '';
        row.appendChild(name);

        row.addEventListener('dragstart', (e) => {
            if (this.lockedAfterCheck) { e.preventDefault(); return; }
            this.selectedCard = item;
            row.classList.add('dragging');
            try {
                e.dataTransfer.setData('text/plain', String(item.sp.id));
                e.dataTransfer.effectAllowed = 'move';
            } catch (err) { /* noop */ }
        });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
        row.addEventListener('click', () => {
            if (this.lockedAfterCheck) return;
            this.returnToTray(item, row);
        });
        return row;
    },

    // Вернуть карточку из корзины в лоток (тап или перетаскивание в лоток).
    // tileEl — конкретный элемент строки: удаляем именно его (важно для
    // возврата нескольких неверных строк из одной корзины за проверку).
    returnToTray(item, tileEl) {
        delete this.placement[item.sp.id];
        if (tileEl && tileEl.parentElement) tileEl.parentElement.removeChild(tileEl);
        this.selectedCard = null;
        this.renderTray();
        this.refreshBasketEmptiness();
    },

    refreshBasketEmptiness() {
        document.querySelectorAll('#family-baskets .family-basket').forEach(basket => {
            const slots = basket.querySelector('.fb-slots');
            basket.classList.toggle('fb-empty', !slots.children.length);
        });
    },

    // ---------- Рендер корзин ----------
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
                if (this.lockedAfterCheck) return;
                e.preventDefault();
                e.currentTarget.classList.add('fb-over');
            };
            basket.addEventListener('dragover', accept);
            basket.addEventListener('dragenter', accept);
            basket.addEventListener('dragleave', () => basket.classList.remove('fb-over'));
            basket.addEventListener('drop', (e) => {
                e.preventDefault();
                basket.classList.remove('fb-over');
                // Определяем карточку по dataTransfer (надёжнее, чем по selectedCard)
                let id = '';
                try { id = e.dataTransfer.getData('text/plain'); } catch (err) { /* noop */ }
                const item = this.cardById(id) || this.selectedCard;
                this.placeInto(g.key, basket, item);
            });
            // Тап-режим: выбрал карточку → тап по корзине
            basket.addEventListener('click', (e) => {
                if (e.target.closest('.family-card')) return; // тап по самой плитке обработан ниже
                this.placeInto(g.key, basket, this.selectedCard);
            });

            zone.appendChild(basket);
        });
        this.refreshBasketEmptiness();

        // Лоток как зона дропа: перетащил карточку из корзины в лоток — вернули её
        const tray = document.getElementById('family-tray');
        const trayOver = (e) => {
            if (this.lockedAfterCheck) return;
            e.preventDefault();
            tray.classList.add('fb-over');
        };
        tray.addEventListener('dragover', trayOver);
        tray.addEventListener('dragenter', trayOver);
        tray.addEventListener('dragleave', () => tray.classList.remove('fb-over'));
        tray.addEventListener('drop', (e) => {
            e.preventDefault();
            tray.classList.remove('fb-over');
            let id = '';
            try { id = e.dataTransfer.getData('text/plain'); } catch (err) { /* noop */ }
            const item = this.cardById(id);
            if (!item || item.done) return;
            if (!this.placement[item.sp.id]) return; // она и так в лотке
            const tileEl = document.querySelector(
                `#family-baskets .family-card[data-species-id="${CSS.escape(String(item.sp.id))}"]`);
            this.returnToTray(item, tileEl);
        });
    },

    cardById(id) {
        if (!id) return null;
        return this.roundItems.find(i => String(i.sp.id) === String(id)) || null;
    },

    // Положить карточку в корзину. Ошибку НЕ проверяем — это просто раскладка.
    placeInto(groupKey, basketEl, item) {
        if (!item || item.done || this.lockedAfterCheck) { this.selectedCard = null; return; }
        this.selectedCard = null;

        // Если карточка уже лежала в другой корзине — убираем старую плитку
        const prevGroup = this.placement[item.sp.id];
        if (prevGroup) {
            const old = basketEl.ownerDocument.querySelector(
                `#family-baskets .family-basket[data-group="${CSS.escape(prevGroup)}"] .family-card[data-species-id="${CSS.escape(String(item.sp.id))}"]`);
            if (old) old.remove();
        }
        this.placement[item.sp.id] = groupKey;

        // Строка внутри корзины: только название; клик/дроп в лоток — вернуть карточку назад
        const tile = this.buildBasketRow(item);
        tile.title = (item.sp.name || '') + ' — нажми, чтобы вернуть в лоток';
        basketEl.querySelector('.fb-slots').appendChild(tile);

        // Убираем карточку из лотка
        const cardEl = document.querySelector(`#family-tray .family-card[data-species-id="${CSS.escape(String(item.sp.id))}"]`);
        if (cardEl) cardEl.remove();
        this.renderTray();          // обновить пустую заглушку лотка
        this.refreshBasketEmptiness();
    },

    // ---------- Проверка раскладки ----------
    // Вызывается ТОЛЬКО по кнопке «✔ Проверить». До этого момента
    // никаких ошибок игра не показывает и не засчитывает.
    checkLayout() {
        if (this.lockedAfterCheck) return;
        const items = this.roundItems;
        const placedCount = Object.keys(this.placement).length;
        const resultEl = document.getElementById('family-check-result');

        if (placedCount === 0) {
            resultEl.textContent = 'Сначала разложи хотя бы одну карточку в корзину.';
            resultEl.className = 'family-check-result warn';
            resultEl.classList.remove('hidden');
            return;
        }
        if (placedCount < items.length) {
            resultEl.textContent =
                `Разложено ${placedCount} из ${items.length}. Можно проверить сейчас или разложить остальные.`;
            resultEl.className = 'family-check-result warn';
            resultEl.classList.remove('hidden');
        } else {
            resultEl.classList.remove('hidden');
        }

        let wrong = 0, right = 0;
        const wrongList = [];
        const wrongIds = [];      // id неверных карточек — для возврата в лоток
        // Собираем элементы строк по data-атрибуту: id вида уникальны в раунде,
        // поэтому каждая неверная строка найдётся явно (в т.ч. несколько
        // неверных строк из одной корзины — раньше они «терялись»).
        const tiles = Array.from(
            document.querySelectorAll('#family-baskets .family-card[data-species-id]'));
        items.forEach(item => {
            const gkey = this.placement[item.sp.id];
            if (!gkey) return; // карточка осталась в лотке — не считаем
            const tileEl = tiles.find(el =>
                String(el.dataset.speciesId) === String(item.sp.id));
            const basketEl = tileEl ? tileEl.closest('.family-basket') : null;
            if (gkey === item.group) {
                right++;
                item.done = true;               // фиксируем: снять нельзя
                delete this.placement[item.sp.id];
                if (tileEl) {
                    tileEl.classList.add('fb-ok');
                    tileEl.draggable = false;
                    tileEl.title = item.sp.name + ' — верно';
                    // отключаем возврат по клику
                    const clone = tileEl.cloneNode(true);
                    tileEl.replaceWith(clone);
                }
            } else {
                wrong++;
                wrongIds.push(String(item.sp.id));
                wrongList.push(`${item.sp.name} → не «${this.groupLabel(gkey)}», а «${this.groupLabel(item.group)}»`);
                if (tileEl) tileEl.classList.add('fb-bad');
                if (basketEl) {
                    basketEl.classList.add('fb-wrong-flash');
                    setTimeout(() => basketEl.classList.remove('fb-wrong-flash'), 900);
                }
            }
        });

        this.mistakes += wrong;
        this.score += right;
        this.roundFixed += right;
        this.updateScoreboard();

        if (wrong > 0) {
            // Неверные строки возвращаем в лоток ВСЕ до единой — можно
            // разложить заново. Сначала синхронно чистим placement по
            // списку wrongIds (надёжнее, чем поиск элементов), затем
            // удаляем сами строки из DOM корзин и перерисовываем лоток.
            const wrongIdSet = new Set(wrongIds);
            wrongIdSet.forEach(id => {
                const it = this.cardById(id);
                if (it && !it.done) delete this.placement[it.sp.id];
            });
            setTimeout(() => {
                document.querySelectorAll('#family-baskets .family-card.fb-bad').forEach(el => {
                    if (el.parentElement) el.parentElement.removeChild(el);
                });
                this.renderTray();
                this.refreshBasketEmptiness();
            }, 800);
            resultEl.innerHTML =
                `<strong>Найдено ошибок: ${wrong}.</strong><br>` +
                escHtml(wrongList.join(' · ')) +
                '<br>Неверные карточки вернулись в лоток — разложи их по другим корзинам и снова нажми «✔ Проверить».';
            resultEl.className = 'family-check-result bad';
            return;
        }

        // Ошибок нет
        const remaining = items.filter(i => !i.done).length;
        if (remaining > 0) {
            resultEl.innerHTML =
                `Пока всё верно! ✔ Зафиксировано: ${right}. Осталось неразложенных карточек: ${remaining}.`;
            resultEl.className = 'family-check-result warn';
            return;
        }

        // Раунд пройден полностью — переход ТОЛЬКО по кнопке
        this.stopTimer();
        this.lockedAfterCheck = true;
        this.setCheckEnabled(false);
        if (this.mistakes === 0) this.unlockAch('perfectround');
        resultEl.className = 'family-check-result hidden';
        this.showBanner(`🎉 Раунд ${this.round} пройден! Все ${items.length} карточек в правильных группах.`);
        this.showNextRoundBtn(this.round >= this.TOTAL_ROUNDS ? 'Итоги игры →' : 'Продолжить →');
    },

    groupLabel(key) {
        const g = this.groups().find(x => x.key === key);
        return g ? g.label : key;
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
        this.stopTimer();
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
