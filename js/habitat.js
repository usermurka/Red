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
    ROUND_SIZE: 1,          // видов в раунде
    TOTAL_ROUNDS: 3,        // раундов в игре
    ROUND_TIME: 180,         // секунд на раунд

    // Восемь биомов (ключи совпадают с HABITATS_DB и Лист4 «биомы»).
    // tip — текст всплывающей подсказки для «Журнала биомов».
    BIOMES: [
        {
            key: 'bog', label: 'Болота', icon: '🥀',
            tip: 'Болота и заболоченные местообитания: верховые (сфагновые, рямы), переходные и низинные болота, осоково-гипновые топи, травяные и моховые болота, заболоченные луга и леса, сплавины, окраины болот, ключевые болота, заболоченные вырубки и гари, тростниковые займища, заболоченные поймы и берега водоёмов.'
        },
        {
            key: 'forest', label: 'Леса', icon: '🌲',
            tip: 'Лесные местообитания: темнохвойные (еловые, пихтовые, кедровые), светлохвойные (сосновые, лиственничные), смешанные, лиственные (берёзовые, осиновые, липовые, дубовые), пойменные и островные леса, колки, боры, лесополосы, лесные поляны, опушки, просеки, вырубки, старые гари, редколесья, закустаренные склоны, долинные и приречные леса, а также лесные болота и заболоченные леса.'
        },
        {
            key: 'meadow', label: 'Луга', icon: '🌿',
            tip: 'Луговые и остепнённые луговые местообитания: пойменные, суходольные, заливные, низинные, разнотравные, злаково-разнотравные, солонцеватые и остепнённые луга, лесные луга и поляны, опушки, залежи, пастбища, сенокосы, луговые степи, луговины, кустарниковые заросли по лугам, влажные высокотравные луга, прибрежные и приозёрные луга.'
        },
        {
            key: 'riparian', label: 'Прибрежные и пойменные', icon: '🌊',
            tip: 'Прибрежные и пойменные местообитания: берега рек, ручьёв, озёр, прудов, стариц, проток, затонов, водохранилищ, морей и морских побережий; поймы и речные долины; приречные леса и кустарники; ивняки, тростниковые заросли по берегам; песчаные, галечные, илистые и каменистые берега; речные острова, косы, отмели, пляжи; обрывистые берега; затопляемые и пересыхающие прибрежья.'
        },
        {
            key: 'rock', label: 'Скалы и каменистые обнажения', icon: '🪨',
            tip: 'Скальные и каменистые местообитания: выходы горных пород, скалы, обрывы, каменистые и щебнистые склоны, известняковые и меловые обнажения, гранитные валуны, каменистые россыпи, осыпи, песчаниковые обнажения, каменистые субстраты в степях и лесостепях, обрывистые склоны речных долин и озёрных котловин, скалы морских побережий, искусственные каменистые субстраты.'
        },
        {
            key: 'saline', label: 'Солончаки и засолённые', icon: '🧂',
            tip: 'Засолённые и солончаковые местообитания: солончаки (пухлые, мокрые, прибрежные), солонцы, солонцеватые и солончаковые луга, солоноватые и солёные озёра, горько-солёные водоёмы, засолённые почвы, галофитные сообщества (солеросово-лебедовые, поташниковые), солончаковые степи, солончаковые плешины, засолённые прибрежья, котловины солёных озёр.'
        },
        {
            key: 'steppe', label: 'Степи', icon: '🌾',
            tip: 'Степные и полупустынные местообитания: ковыльные, типчаково-ковыльные, полынно-злаковые, разнотравно-злаковые, луговые и опустыненные степи, каменистые и щебнистые степи, солонцеватые степи, степные склоны, балки, овраги, древние ложбины стока, степные западины, остепнённые участки, залежи, целинные степи, пастбища, агроландшафты в степной зоне, полупустыни.'
        },
        {
            key: 'water', label: 'Водоёмы', icon: '💧',
            tip: 'Водные и прибрежно-водные местообитания: реки (крупные, малые, таёжные, степные), озёра (пресные, солоноватые, солёные, эвтрофные, мезотрофные), пруды, старицы, затоны, протоки, водохранилища, лиманы, дельты рек, ручьи, ключи, временные водоёмы, пересыхающие лужи, сплавины, плёсы, мелководья, глубинные участки, илистые, песчаные и каменистые грунты, подводные и плавающие растения.'
        }
    ],
    
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
        GameEnd.leave('habitat');
        this.stopTimer();
        document.getElementById('app').style.pointerEvents = '';
    },

    startGame() {
        // Страховка: без базы HABITATS_DB игра не сможет собрать пул
        // видов (biomesOf вернёт [] для всех). Сообщаем игроку и выходим.
        if (!window.HABITATS_DB) {
            alert('База биомов не загружена (js/habitats-db.js).');
            return;
        }
        this.round = 0;
        this.score = 0;        // верные определения за игру
        this.mistakes = 0;     // всего ошибочных ответов (после первой попытки вопроса)
        this.streak = 0;       // серия верных ответов с первой попытки
        this.bestStreak = 0;
        this.fastest = null;   // самый быстрый верный ответ (сек)
        this.usedIds = new Set();
        this.waitingContinue = false; // пауза после ответа до «Продолжить →»
        this._endAfterContinue = false; // финал показываем по кнопке, не по таймеру
        this._lastAnswerCorrect = null;
        this._matchedBiomes = new Set();
        this._nextEnabled = false;
        this.hideNextRoundBtn();
        document.getElementById('habitat-round-banner').classList.add('hidden');
        // Свиток активен всегда: класс «пусто» мог остаться с прошлой игры.
        const modal = document.getElementById('habitat-modal');
        if (modal) modal.classList.remove('habitat-info-empty');

        // Возвращаем кнопки управления при старте новой игры
        const topControls = document.querySelector('#habitat-modal .quiz-top-controls');
        if (topControls) {
            topControls.style.display = '';
        }
        this.renderBiomesJournal();
        document.getElementById('habitat-end-screen').classList.add('hidden');
        GameEnd.leave('habitat'); // игровое поле снова видимо
        this.nextRound();
    },

    // «Журнал биомов»: карточки всех биомов с подсказками.
    // Десктоп — аккордеон (<details>), мобильный — тот же <details>
    // работает как всплывающее окно за счёт CSS (см. habitat.css).
    renderBiomesJournal() {
        const host = document.getElementById('habitat-biomes-journal');
        if (!host) return;
        host.innerHTML = '';
        this.BIOMES.forEach(b => {
            const det = document.createElement('details');
            det.className = 'hbiome-card hbiome-card-' + b.key;
            const sum = document.createElement('summary');
            sum.className = 'hbiome-card-head';
            sum.innerHTML = `<span class="hbiome-icon">${b.icon}</span>` +
                `<span class="hbiome-label">${escHtml(b.label)}</span>` +
                `<span class="hbiome-toggle">▶</span>`;
            const body = document.createElement('div');
            body.className = 'hbiome-card-body';
            body.textContent = b.tip;
            det.appendChild(sum);
            det.appendChild(body);
            // Аккордеон: при раскрытии одной карточки остальные
            // закрываются. Событие 'toggle' срабатывает и на открытие,
            // и на закрытие; реагируем только на open === true.
            det.addEventListener('toggle', () => {
                if (!det.open) return;
                host.querySelectorAll('details[open]').forEach(other => {
                    if (other !== det) other.open = false;
                });
            });
            host.appendChild(det);
        });
    },    

    // ---------- Переходы между раундами — ТОЛЬКО по кнопке ----------

    showNextRoundBtn(label) {
        const btn = document.getElementById('habitat-next-round-btn');
        if (!btn) return;
        btn.textContent = label || 'Продолжить →';
        // Кнопка всегда в DOM и занимает место: до конца раунда она
        // бледная (is-idle) и неактивная, в конце — активная (is-active).
        btn.classList.remove('hidden', 'is-idle');
        btn.classList.add('is-active');
        btn.disabled = false;
        // Если модалка «закрыта» для приложения (app), клики по кнопке
        // не пройдут — на время паузы открываем ей pointer-events.
        const modal = document.getElementById('habitat-modal');
        if (modal) modal.style.pointerEvents = 'auto';
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
        // Возвращаем обычное поведение модального окна игры
        const modal = document.getElementById('habitat-modal');
        if (modal) modal.style.pointerEvents = '';
    },

    continueToNextRound() {
        const btn = document.getElementById('habitat-next-round-btn');

        // ① Раунд полностью закрыт (все ROUND_SIZE карточек собраны
        // и текущая — последняя). Это может быть и «финал игры».
        if (this.roundFinished()) {
            this.waitingContinue = false;
            this.locked = true;
            this.stopTimer();
            if (this.round >= this.TOTAL_ROUNDS) {
                this._endAfterContinue = false;
                this.showEndScreen('🏆 Игра окончена!');
            } else {
                this.hideNextRoundBtn();
                const banner = document.getElementById('habitat-round-banner');
                if (banner) banner.classList.add('hidden');
                this.nextRound();
            }
            return;
        }

        // ② «Продолжить →» после неполного/неверного ответа.
        if (this._nextEnabled) {
            this._nextEnabled = false;
            this.waitingContinue = false;
            this.locked = false;
            this.hideNextRoundBtn();

            // Считаем неотмеченные правильные биомы за ошибки
            this._applyMissedBiomesAsErrors();

            this.resetScrollState(); // Сбрасываем свиток (закрываем details)
            MiniScroll.hide('habitat-info-panel');
            this.showNextCard();
            return;
        }

        // ③ Карточка собрана целиком (waitingContinue === true) —
        // «Продолжить →» переводит к следующей карточке.
        if (this.waitingContinue) {
            this.waitingContinue = false;
            this._lastAnswerCorrect = null;
            this.locked = false;
            this.hideNextRoundBtn();

            this.resetScrollState(); // Сбрасываем свиток (закрываем details)
            this.showNextCard();
            return;
        }

        // ③ Кнопка бледная (is-idle/disabled) — значит активной паузы
        // нет, и «Продолжить» нажата вне сценария (например, повторный
        // клик). На всякий случай возобновляем таймер, если он стоял.
        if (btn && btn.disabled) {
            this.resumeTimer();
            return;
        }

        // ④ Баннер «раунд завершён» (кнопка активна) — сразу ведём
        // игрока дальше, не заставляя ждать истечения таймера.
        this.proceedAfterRound();
    },

    // Раунд завершён, когда разобраны ВСЕ пять карточек (currentIdx дошёл
    // до последней) И пятый вид определён верно (matchedCount === 5).
    // Прежняя привязка только к числу верных ответов ломалась при ошибках
    // с исправлением: счётчик мог «проскочить» 5 раньше последней карточки
    // (зависание на шестом виде без картинки) либо, наоборот, не дойти до
    // неё никогда (приходится ждать, пока истечёт таймер).
    roundFinished() {
        return this.matchedCount >= this.ROUND_SIZE &&
            this.currentIdx >= this.ROUND_SIZE - 1;
    },

    // Реальный переход: баннер скрыть, паузу снять, следующий раунд
    // (или финал игры, если раунды кончились).
    proceedAfterRound() {
        this.hideNextRoundBtn();
        const banner = document.getElementById('habitat-round-banner');
        if (banner) banner.classList.add('hidden');
        this.waitingContinue = false;
        this.locked = false;
        // Игрок нажал «Продолжить» — читаем мини-свиток больше не нужно:
        // снимаем игру с паузы и возвращаем таймер к работе.
        this.paused = false;
        // Последний раунд уже закрыт — по кнопке показываем экран итогов,
        // а не пытаемся начать несуществующий четвёртый раунд.
        if (this._endAfterContinue) {
            this._endAfterContinue = false;
            this.stopTimer();
            this.showEndScreen('🏆 Игра окончена!');
            return;
        }
        this.nextRound();
    },

    // ---------- Отнесение вида к биомам (по базе HABITATS_DB) ----------

    // Возвращает массив ключей биомов вида (может быть пустым).
    biomesOf(species) {
        if (!species || species.id == null) return [];
        const db = window.HABITATS_DB || {};
        const list = db[species.id] || db[String(species.id)] || [];
        // дедупликация и валидация по известным ключам
        const known = new Set(this.BIOMES.map(b => b.key));
        return [...new Set(list)].filter(k => known.has(k));
    },

    // Возвращает один биом — используется для счётчиков/подсветки,
    // но карточка принимает любой из biomesOf().
    biomeOf(species) {
        const arr = this.biomesOf(species);
        return arr.length ? arr[0] : null;
    },

    pickRoundSpecies() {
        // Пул строим по ВСЕМ видам справочника SPECIES_DATA (в них есть
        // «habitats»), объединяя с краткой записью из SPECIES ради имени/статуса.
        // Ключи usedIds нормализуем через String(...) + нижний регистр, чтобы
        // избежать рассогласования типов/регистра ID (число vs строка) — иначе
        // один и тот же вид мог попадаться в пуле повторно.
        const key = (id) => String(id).toLowerCase();
        const byId = new Map(App.collectAllSpecies().map(sp => [key(sp.id), sp]));
        const entries = [];
        if (window.SPECIES_DATA) {
            for (const rawId of Object.keys(window.SPECIES_DATA)) {
                const id = key(rawId);
                if (this.usedIds.has(id)) continue;
                const sp = byId.get(id) || { id: rawId, name: (window.SPECIES_DATA[rawId] || {}).name || '' };
                if (!sp.name) continue;
                const biomes = this.biomesOf(sp);
                if (biomes.length) entries.push({ sp, biomes });
            }
        }
        const pool = this.shuffle(entries);
        const selected = pool.slice(0, this.ROUND_SIZE);
        selected.forEach(e => this.usedIds.add(key(e.sp.id)));
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
        this._matchedBiomes = new Set();   // собранные биомы текущей карточки
        
        this.renderBiomesJournal();
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
            // Подпись оставляем в DOM (для accessibility и всплывающей
            // подсказки title), но визуально скрываем через CSS на
            // десктопе и мобильных. Текст подписи виден в «Журнале
            // биомов» и в title-тултипе при наведении.
            btn.title = b.label;
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
        // Защита от «шестого вида без картинки» (замечание игрока): если
        // все пять карточек раунда уже показаны, дальше идти некуда —
        // вместо пустой карточки закрываем раунд активной кнопкой.
        if (this.currentIdx >= this.ROUND_SIZE - 1 && this.matchedCount >= this.ROUND_SIZE) {
            this.stopTimer();
            if (this.round >= this.TOTAL_ROUNDS) {
                this.showRoundBanner(
                    `🏆 Все ${this.TOTAL_ROUNDS} раунда пройдены! Верно определено: ${this.score} видов.`,
                    'Завершить игру 🏁');
                this._endAfterContinue = true;
            } else {
                this.showRoundBanner(
                    `🎉 Раунд ${this.round} завершён! Верно определено: ${this.matchedCount} из ${this.ROUND_SIZE}.`,
                    'Продолжить →');
            }
            this.waitingContinue = false;
            this.locked = true;
            return;
        }
        // Переходим к следующему вопросу — снимаем паузу, таймер снова тикает
        this.resumeTimer();
        this.currentIdx++;
        this._answeredCurrent = false;
        this._matchedCurrent = false; // новая карточка — пару ещё не собран
        this._matchedBiomes = new Set(); // обнуляем собранные биомы
        this._openDetails = null;        // раскрытые секции свитка — заново
        this._nextEnabled = false;       // «Продолжить →» ещё не активна

        // Сбрасываем визуальные отметки (галочки/крестики) со всех кнопок
        document.querySelectorAll('#habitat-biomes .habitat-biom').forEach(btn => {
            btn.classList.remove('hab-correct', 'hab-matched', 'hab-wrong');
            btn.disabled = false;
        });
        this.hideCardCompleteFeedback(); // Убираем плашку «Все верно!»

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
        this._lastPickKey = null;
        // Свиток активен ВСЕГДА: сразу при показе карточки строим его
        // в режиме «без ответа» — подсветки нет, но текст читается.
        this.renderInfoPanel(item, null, false);
    },

    // Мини-свиток справа от игровой панели (единый дизайн как в
    // «Викторине», js/mini-scroll.js): настоящий текст «Места
    // обитания» из базы + подсветка совпадений с ключевыми словами
    // выбранного биома. Показывается при ЛЮБОМ ответе.
    renderInfoPanel(item, biomKey, correct) {
        if (!item) return;
        const sp = item.sp;
        const full = (window.SPECIES_DATA && sp.id) ? window.SPECIES_DATA[sp.id] : null;
        const habitats = String((full && full.habitats) || '').replace(/\s+/g, ' ').trim();
        const spread = String((full && full.spread_omsk) || '').replace(/\s+/g, ' ').trim();

        // Запоминаем, какие <details> были раскрыты в прошлом рендере
        // (по тексту summary), чтобы после перерисовки свитка вернуть
        // их в открытое состояние. Сбрасывается только при переходе
        // к новой карточке (см. showNextCard → this._openDetails = null).
        const prevPanel = document.getElementById('habitat-info-panel');
        const prevOpen = new Set();
        if (prevPanel) {
            prevPanel.querySelectorAll('details[open]').forEach(d => {
                const s = d.querySelector('summary');
                if (s) prevOpen.add(s.textContent.trim());
            });
        }
        const restoreOpen = this._openDetails !== null
            ? new Set([...prevOpen, ...this._openDetails])
            : prevOpen;

        // Подсветка больше не нужна: база HABITATS_DB даёт точный
        // список биомов, а ключевые слова в тексте могут вводить в
        // заблуждение. Оставляем чистый текст с переносами строк.
        const hlText = (txt) => escHtml(txt).replace(/\n/g, '<br>');

        const blocks = [];
        // «Места обитания» — свёрнутый <details>, как «Распространение…».
        // Заголовок кладём внутрь <summary>, title=null — иначе
        // mini-scroll.js нарисует дубликат заголовка.
        if (habitats) {
            blocks.push({
                title: null,
                html: `
                    <details class="ms-details">
                        <summary class="ms-block-title">Места обитания</summary>
                        <div class="ms-block-body" style="margin-top: 6px;">${hlText(habitats)}</div>
                    </details>
                `
            });
        } else {
            blocks.push({
                title: null,
                html: `
                    <details class="ms-details">
                        <summary class="ms-block-title">Места обитания</summary>
                        <div class="ms-block-body" style="margin-top: 6px;">Поле «Места обитания» в базе пусто — ориентируйтесь на описание.</div>
                    </details>
                `
            });
        }
        if (spread) {
            // Оборачиваем блок в <details>, а сам ЗАГОЛОВОК кладём внутрь <summary>.
            // Так клик по заголовку будет сворачивать/разворачивать текст.
            // title оставляем пустым (null), чтобы mini-scroll.js не рисовал дубликат.
            blocks.push({
                title: null,
                html: `
                    <details class="ms-details">
                        <summary class="ms-block-title">Распространение в Омской области</summary>
                        <div class="ms-block-body" style="margin-top: 6px;">${escHtml(spread).replace(/\n/g, '<br>')}</div>
                    </details>
                `
            });
        }
        // По требованию пользователя из мини-свитка игры «Среда обитания»
        // блок «Краткое описание» убран — оставляем только справочную
        // информацию о местах обитания и распространении вида.

        const statusConfig = CONFIG.statuses.find(s => s.value === sp.status);
        // По требованию пользователя строка «номер статуса + название»
        // из мини-свитков убрана (см. также js/status.js).
        window.__MS_NO_STATUS_BADGE = true;
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
        window.__MS_NO_STATUS_BADGE = false;
        const modal = document.getElementById('habitat-modal');
        if (modal) modal.classList.toggle('habitat-info-empty', false);
        const panel = document.getElementById('habitat-info-panel');
        if (panel && !panel.querySelector('.ms-open-full')) {
            panel.appendChild(MiniScroll.footerButton(sp.id, () => this.close()));
        }

        // Восстанавливаем раскрытые <details> после перерисовки свитка.
        // Так «Места обитания» / «Распространение…», открытые игроком,
        // не сворачиваются при кликах по биомам этой же карточки.
        if (panel && restoreOpen.size) {
            panel.querySelectorAll('details').forEach(d => {
                const s = d.querySelector('summary');
                if (s && restoreOpen.has(s.textContent.trim())) d.open = true;
            });
        }
        // Запоминаем актуальный набор открытых секций — чтобы при
        // следующем рендере внутри той же карточки он сохранился.
        const currentOpen = new Set();
        if (panel) {
            panel.querySelectorAll('details[open]').forEach(d => {
                const s = d.querySelector('summary');
                if (s) currentOpen.add(s.textContent.trim());
            });
        }
        this._openDetails = currentOpen;
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
        // Игра на паузе до нажатия «Продолжить →» — ответы не принимаем
        if (this.waitingContinue || this.locked) return;

        // Биомы текущего вида (из базы HABITATS_DB)
        const needed = Array.isArray(item.biomes) ? item.biomes
            : (item.biome ? [item.biome] : []);
        if (!needed.length) return;

        // Уже собранный биом повторно не принимаем (и не штрафуем):
        // защита от «долбёжки» одной и той же кнопки.
        if (this._matchedBiomes.has(biomKey)) {
            btn.classList.add('hab-correct');
            setTimeout(() => btn.classList.remove('hab-correct'), 400);
            return;
        }

        const isTarget = needed.includes(biomKey);

        // Любой ответ: пауза таймера, свиток открыт (как было).
        this.pauseTimer();
        this._lastPickKey = biomKey;
        // Свиток теперь активен всегда (см. showNextCard), но обновляем
        // его на случай, если игрок ранее не открывал.
        this.renderInfoPanel(item, biomKey, isTarget);

        if (isTarget) {
            // ВЕРНО: +1 правильный, кнопка «собирается»
            this._matchedBiomes.add(biomKey);
            btn.classList.add('hab-correct', 'hab-matched');
            btn.disabled = true;

            // Счёт верных: в этом варианте каждый верный клик = +1.
            this.score++;
            this.updateScoreboard();

            // Если собран ВЕСЬ набор биомов вида — карточка закрыта.
            if (this._matchedBiomes.size >= needed.length) {
                this._matchedCurrent = true;
                this.matchedCount++;
                // Первая попытка была верной на всех биомах? Тогда серия.
                if (!this._answeredCurrent) {
                    this.streak++;
                    this.bestStreak = Math.max(this.bestStreak, this.streak);
                } else {
                    this.streak = 0;
                }
                this.updateScoreboard();

                // Показываем явное сообщение, что карточка собрана
                this.showCardCompleteFeedback();

                if (this.roundFinished()) {
                    this.finishRoundByButton();
                } else {
                    this.showAnswerPauseBtn();
                }
            } else {
                // Собрали ЧАСТЬ биомов — игру НЕ блокируем, клики по
                // оставшимся биомам принимаются. «Продолжить →» уже
                // активна: игрок сам решит, когда перейти.
                this.showAnswerButton();
            }
        } else {
            // НЕВЕРНО: +1 неправильный, кнопка мигает красным,
            // карточка остаётся открытой.
            this.mistakes++;
            this.roundMistakes++;
            if (!this._answeredCurrent) {
                this._answeredCurrent = true;
                this.streak = 0;
            }
            this.updateScoreboard();
            btn.classList.add('hab-wrong');
            setTimeout(() => btn.classList.remove('hab-wrong'), 600);
            // Неверный клик НЕ блокирует игру: можно пробовать другие
            // биомы. «Продолжить →» уже активна.
            this.showAnswerButton();
        }
    },

    // Считает неотмеченные правильные биомы текущей карточки ошибками.
    // Вызывается, когда игрок нажимает «Продолжить →», не собрав все
    // правильные биомы (или вообще не кликнув).
    _applyMissedBiomesAsErrors() {
        const item = this.currentCard();
        if (!item) return;
        const needed = Array.isArray(item.biomes) ? item.biomes : (item.biome ? [item.biome] : []);

        let missed = 0;
        needed.forEach(b => {
            if (!this._matchedBiomes.has(b)) missed++;
        });

        if (missed > 0) {
            this.mistakes += missed;
            this.roundMistakes += missed;
            this.streak = 0; // пропуск верных биомов сбрасывает серию
            this.updateScoreboard();
        }
    },

    // Раунд закрыт: баннер с итогом и активной кнопкой «Продолжить».
    finishRoundByButton() {
        this.stopTimer();
        if (this.round >= this.TOTAL_ROUNDS) {
            this.showRoundBanner(
                `🏆 Все ${this.TOTAL_ROUNDS} раунда пройдены!` +
                (this.mistakes ? ` Ошибок за игру: ${this.mistakes}.` : ' Ни одной ошибки!'),
                'Завершить игру 🏁');
            this._endAfterContinue = true;
            GameEnd.enter('habitat');
        } else {
            this.showRoundBanner(
                `🎉 Раунд ${this.round} завершён!` +
                (this.roundMistakes ? ` Ошибок в раунде: ${this.roundMistakes}.` : ' Ни одной ошибки!'),
                'Продолжить →');
        }
        this.waitingContinue = false;
        this.locked = true;
    },

    // Активировать кнопку «Продолжить →» как сигнал ПАУЗЫ ПОСЛЕ ОТВЕТА:
    // таймер стоит, свиток открыт, новые ответы не принимаются, пока
    // игрок не нажмёт кнопку (см. continueToNextRound -> waitingContinue).
    // Визуальный фидбек: все биомы вида найдены.
    showCardCompleteFeedback() {
        let banner = document.getElementById('habitat-card-complete');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'habitat-card-complete';
            banner.className = 'habitat-card-complete-banner';
            banner.textContent = '✔ Все верно!';
            // Вставляем сразу после сетки биомов
            const biomes = document.getElementById('habitat-biomes');
            if (biomes && biomes.parentNode) {
                biomes.parentNode.insertBefore(banner, biomes.nextSibling);
            }
        }
        banner.classList.remove('hidden');
    },

    hideCardCompleteFeedback() {
        const banner = document.getElementById('habitat-card-complete');
        if (banner) banner.classList.add('hidden');
    },

    // Полный сброс состояния мини-свитка. Закрывает все раскрытые
    // <details> и очищает сохранённый массив _openDetails, чтобы при
    // переходе на новую карточку свиток был полностью свёрнут.
    resetScrollState() {
        this._openDetails = null; // Забываем, что было раскрыто
        const panel = document.getElementById('habitat-info-panel');
        if (panel) {
            // На всякий случай принудительно закрываем все details в DOM
            panel.querySelectorAll('details').forEach(d => d.open = false);
        }
    },

    // Показывает активную «Продолжить →», но НЕ блокирует игру:
    // клики по биомам продолжают приниматься, пока игрок не нажмёт
    // кнопку. Флаг _nextEnabled используется в continueToNextRound.
    showAnswerButton() {
        this._nextEnabled = true;
        this.waitingContinue = false;
        this.locked = false;
        this.showNextRoundBtn('Продолжить →');
    },

    // Полная блокировка — только когда карточка собрана целиком
    // (все биомы угаданы). Это состояние «ждём перехода».
    showAnswerPauseBtn() {
        this.waitingContinue = true;
        this.locked = true;
        this.showNextRoundBtn('Продолжить →');
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
        this.renderTimer();
        this._timer = setInterval(() => {
            if (this.paused) return; // пауза до нажатия «Продолжить» — можно почитать
            this.timeLeft--;
            bar.style.width = Math.max(0, (this.timeLeft / this.ROUND_TIME) * 100) + '%';
            this.renderTimer();
            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.showEndScreen('⏱ Время вышло!');
            }
        }, 1000);
    },

    // Видимый обратный отсчёт — как в эталонной игре «Статус»:
    // число секунд краснеет на последних секундах, после ответа/паузы
    // таймер «замораживается» (пунктирная рамка, серый цвет).
    renderTimer() {
        const el = document.getElementById('habitat-timer-count');
        const track = document.getElementById('habitat-timer-track');
        const t = Math.max(0, Math.ceil(this.timeLeft || 0));
        if (el) {
            el.textContent = `⏳ ${t} с`;
            const frac = this.ROUND_TIME ? (t / this.ROUND_TIME) : 0;
            el.classList.toggle('st-time-warning', frac <= 0.34);
        }
        if (track) track.classList.add('st-timer-running');
    },

    freezeTimerDisplay() {
        const track = document.getElementById('habitat-timer-track');
        if (track) track.classList.remove('st-timer-running');
    },

    // Таймер встаёт на паузу при ЛЮБОМ ответе (игрок читает мини-свиток)
    // и продолжается при переходе к следующему вопросу или раунду.
    pauseTimer() {
        this.paused = true;
        this.freezeTimerDisplay();
    },

    resumeTimer() {
        if (this.paused && this._timer) {
            this.paused = false;
            const track = document.getElementById('habitat-timer-track');
            if (track) track.classList.add('st-timer-running');
        }
    },

    stopTimer() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        this.freezeTimerDisplay();
    },

    finishGame() {
        this.showEndScreen('🏆 Игра окончена!');
    },

    showEndScreen(titleText) {
        // Скрываем только сами кнопки управления, не трогая игровое окно
        const topControls = document.querySelector('#habitat-modal .quiz-top-controls');
        if (topControls) {
            topControls.style.display = 'none';
        }

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
        // Финал: прячем игровые ↺/✕ (было «двоение крестиков») и всё
        // игровое поле под полупрозрачной подложкой экрана итогов.
        GameEnd.enter('habitat');
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
