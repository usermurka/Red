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
    ROUND_SIZE: 5,          // видов в раунде
    TOTAL_ROUNDS: 3,        // раундов в игре
    ROUND_TIME: 40,         // секунд на раунд

    // Ключевые слова для отнесения вида к биому по тексту
    // «Места обитания» из карточки вида
    BIOMES: [
        { key: 'forest', label: 'Лес', icon: '🌲' },
        { key: 'steppe', label: 'Степь', icon: '🌾' },
        { key: 'water', label: 'Водоём', icon: '💧' },
        { key: 'bog', label: 'Болото', icon: '🥀' }
    ],
    KEYWORDS: {
        water: ['водоём', 'водоем', 'озеро', 'река', 'рек', 'пруда', 'пруд', 'водохранилищ',
            'пойменн', 'заросли тростника', 'надводн', 'прибрежн', 'болотн', 'топи', 'тальник',
            'сыроватн', 'влага', 'гидро', 'русла', 'русле', 'мелководий', 'нерест', 'стрежен',
            'омут', 'затопл', 'канал', 'ключев'],
        forest: ['лес', 'дремуч', 'хвойн', 'широколиствен', 'смешанн', 'березов', 'берёзов',
            'соснов', 'осин', 'ивняк', 'кустарников', 'подлесок', 'лесная подстилка',
            'лесов', 'леса', 'лесной', 'олышк', 'ельник', 'пихтов', 'кедров', 'лиственнич'],
        steppe: ['степь', 'полын', 'ковыл', 'разнотравь', 'засушлив', 'сухотняк',
            'открыт', 'луг', 'сольц', 'барабан', 'типчаков', 'склонов', 'берег',
            'отлог', 'пустыр', 'солонц', 'степных', 'степной'],
        bog: ['болото', 'торф', 'сфагн', 'осоков', 'кочкар', 'заболочен', 'мокр', 'сыр']
    },

    /* ============================================================
       ВЗВЕШЕННОЕ ОПРЕДЕЛЕНИЕ БИОМА (по замечанию игрока)
       ------------------------------------------------------------
       Подсчёт «сколько ключевых слов встретилось» устарел: редкие,
       но точные слова («дерево», «берег») весели столько же, сколько
       расплывчатые («открыт»). Теперь каждое слово имеет вес, а
       бонусные группы засчитываются ОДИН РАЗ на текст.

       Пример из замечания: «Предпочитает отдельные ДЕРЕВЬЯ у северной
       границы ЛЕСА, обрывы в долинах РЕК и ОЗЁР, скалы морских
       ПОБЕРЕЖИЙ.» → лес: 2+1 = 3; водоём: 3×(рек, озёр) + 2(побережий)
       = 8 → побеждает ВОДОЁМ, как и должно быть.

       Спорные stems разведены по биомам:
        • «берег/береж» — берег РЕКИ/ОЗЕРА (водоём, +2), крутой берег
          степного лога (степь, +1);
        • «болотн-» — прилагательное от «болото» (болото +2), но
          «луговато-болотные» луга остаются лугом (болото +1);
        • «сыр/влажн» — слабый признак (по +1), не решает исход.
       ============================================================ */
    BIOME_WEIGHTS: {
        water: [
            ['водоём', 3], ['водоем', 3], ['озер', 3], ['река', 3], ['рек', 3],
            ['пруд', 3], ['водохранилищ', 3], ['русел', 2], ['русла', 2], ['русле', 2],
            ['мелковод', 3], ['глубок', 2], ['нерест', 3], ['стрежен', 2], ['омут', 2],
            ['затопл', 2], ['разлив', 2], ['паводк', 2], ['пойменн', 2], ['пойм', 2],
            ['притоков', 2], ['канал', 2], ['ключев', 2], ['родник', 2],
            ['берег', 2], ['береж', 2], ['побереж', 2], ['прибрежн', 2], ['надводн', 2],
            ['заросли тростника', 3], ['тростник', 2], ['камыш', 2], ['рогоз', 2],
            ['чакан', 2], ['болотн', 1], ['тальник', 1], ['сыроватн', 1], ['влага', 1],
            ['влажн', 1], ['гидро', 2],
            /* Дополнения по замечанию игрока (подкаменщик сибирский):
               «в Иртыше в затонах ... у опор мостов, гидротехнических
               сооружений, дамб, ледорезов» — рыба живёт В ВОДОЁМЕ, но
               раньше водоём набирал лишь 2 балла («гидро»), и побеждала
               степь из-за фразы «степной ... природно-климатической зоны». */
            ['иртыш', 3], ['зырян', 2], ['ишим', 2],
            ['затон', 3], ['дамб', 3], ['ледорез', 2],
            ['проточн', 2], ['течени', 2], ['рыб', 2]
        ],
        forest: [
            ['лес', 2], ['дремуч', 3], ['хвойн', 3], ['широколиствен', 3], ['смешанн', 2],
            ['елов', 2], ['ельник', 3], ['пихтов', 2], ['кедров', 2], ['лиственнич', 2],
            ['соснов', 2], ['березов', 2], ['берёзов', 2], ['осин', 2], ['ивняк', 2],
            ['олышк', 2], ['кустарник', 2], ['подлесок', 2], ['лесная подстилка', 3],
            ['дерев', 2], ['древесн', 2], ['полян', 1], ['глухарин', 2], ['таёжн', 3],
            ['тайг', 3]
        ],
        steppe: [
            ['степь', 3], ['степных', 3], ['степной', 3], ['полын', 3], ['ковыл', 3],
            ['разнотравь', 3], ['засушлив', 2], ['сухотняк', 3], ['типчаков', 3],
            ['типчак', 3], ['солонц', 3], ['сольц', 3], ['пустыр', 3], ['отлог', 2],
            ['открыт', 1], ['луг', 2], ['лугов', 2], ['склонов', 1],
            ['склон', 1], ['берег', 1], ['береж', 1], ['барабан', 2],
            /* Дополнения по замечанию игрока («Сарсазан шишковатый»:
               «Мезогигрофит, галофит. Растет на пухлых солончаках»,
               местонахождения — котловина оз. Эбейты). Слово «солонц»
               раньше не ловило форму «солончак/солончаковый», а марке-
               ров засолённых степей не было вовсе — вид уходил в ЛЕС
               из-за слов «деревянистый» и «листочков» в описании. */
            ['солончак', 3], ['солончаков', 3], ['галофит', 3], ['галофильн', 3],
            ['поташник', 3], ['солянк', 2], ['шайоров', 2]
        ],
        bog: [
            ['болото', 4], ['заболочен', 3], ['торф', 3], ['сфагн', 3], ['осоков', 2],
            ['кочкар', 2], ['мокр', 2], ['сыр', 1], ['камыш', 1],
            ['топи', 2], ['болотн', 2]
        ]
    },

    // Порядок приоритета при одинаковом числе совпадений:
    // болото — самый специфичный биом, затем водоём, лес, степь
    BIOME_PRIORITY: ['bog', 'water', 'forest', 'steppe'],

    /* ============================================================
       СОЛОНЧАКИ И ГАЛОФИТЫ — ЭТО СТЕПЬ (по замечанию игрока)
       ------------------------------------------------------------
       Вид «Сарсазан шишковатый» («Мезогигрофит, галофит. Растет на
       пухлых солончаках.» + ботаническое описание «деревянистыми
       ветвями», «продолговатых… листочков») система упорно ставила
       в ЛЕС: слова «деревянистый» и «листочков» случайно содержат
       корни «дерев» и «елов» из лесного списка. А настоящих маркеров
       солончаковой степи в весах не было вовсе.

       Лечим двумя шагами:
        1) «солончак», «солонец», «галофит», «поташник» — сильные
           признаки ЗАСОЛЁННОЙ СТЕПИ (+3): именно так трактует их
           Красная книга Омской обл. (котловина оз. Эбейты —
           солончаковая степь, а не водоём и не лес);
        2) ложные срабатывания лесных корней убираем отрицательным
           весом −2 (сумма не может уйти ниже нуля — см. biomeOf).
       ============================================================ */
    NEGATIVE_WEIGHTS: {
        forest: [
            ['деревянист', -2],   // «деревянистые ветви» — про стебель, не про лес
            ['листочк', -2],      // «листочков околоцветника» ≠ «ель»
            ['одревеснев', -2]
        ]
    },

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
        this.mistakes = 0;     // всего ошибочных ответов (после первой попытки вопроса)
        this.streak = 0;       // серия верных ответов с первой попытки
        this.bestStreak = 0;
        this.fastest = null;   // самый быстрый верный ответ (сек)
        this.usedIds = new Set();
        this.logEntries = [];  // пары «вид — среда» за всю игру
        this.waitingContinue = false; // пауза после ответа до «Продолжить →»
        this._endAfterContinue = false; // финал показываем по кнопке, не по таймеру
        this._lastAnswerCorrect = null;
        this.hideNextRoundBtn();
        document.getElementById('habitat-round-banner').classList.add('hidden');
        // Пустой журнал не должен выглядеть «дырой» в окне —
        // показываем аккуратную подсказку, пока нет ни одной пары.
        this.renderEmptyLogNote();
        document.getElementById('habitat-end-screen').classList.add('hidden');
        this.nextRound();
    },

    renderEmptyLogNote() {
        const log = document.getElementById('habitat-log');
        if (!log) return;
        log.innerHTML = '';
        const note = document.createElement('div');
        note.className = 'habitat-log-empty-note';
        note.textContent = 'Здесь будут появляться пары «вид — среда» по вашим ответам.';
        log.appendChild(note);
    },

    removeEmptyLogNote() {
        const log = document.getElementById('habitat-log');
        if (!log) return;
        const note = log.querySelector('.habitat-log-empty-note');
        if (note) note.remove();
    },

    // ---------- Переходы между раундами — ТОЛЬКО по кнопке ----------

    // Мини-свиток «Данные из Красной книги» (единый для всех игр,
    // js/mini-scroll.js) скрыт до первого ответа в текущем вопросе:
    // текст поля «Места обитания» подсказывает биом.
    setInfoVisible(visible) {
        if (visible) return; // показ строится в renderInfoPanel()
        MiniScroll.hide('habitat-info-panel');
    },

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
        // Кнопка «Продолжить →» активна ВСЕГДА, когда игра ждёт игрока
        // (пауза после ответа / конец раунда). Если она бледная
        // (is-idle/disabled) — значит идти вперёд некуда: просто
        // снимаем зависшую паузу и продолжаем таймер, но НИКОГДА не
        // оставляем игру на месте с активной кнопкой (по замечанию
        // игрока: «когда все пять отвечены — надо ждать, пока истечёт
        // время, кнопка „Продолжить" не активна»).
        if (btn && btn.disabled) {
            if (this.waitingContinue) {
                this.waitingContinue = false;
                this.locked = false;
                this.resumeTimer();
            }
            return;
        }

        // Пауза ПОСЛЕ ОТВЕТА (не путать с паузой между раундами):
        // игра стоит, открыт мини-свиток. «Продолжить →» снимает паузу
        // и ОБЯЗАТЕЛЬНО двигает игру вперёд:
        //  • если последний ответ был ВЕРНЫМ — переходим к СЛЕДУЮЩЕМУ
        //    виду этого же раунда (по замечанию игрока кнопка раньше
        //    вновь открывала ПЕРВЫЙ вид и игра «стояла» на нём);
        //  • если ответ был НЕВЕРНЫМ — возвращаемся к ТОМУ ЖЕ виду,
        //    чтобы игрок мог выбрать другую среду, глядя на свиток.
        if (this.waitingContinue) {
            const wasCorrect = !!this._lastAnswerCorrect;
            this.waitingContinue = false;
            this._lastAnswerCorrect = null;
            this.locked = false;   // снова принимаем ответы
            this.hideNextRoundBtn();
            MiniScroll.hide('habitat-info-panel');
            if (wasCorrect) {
                // Страховка: если вдруг все виды раунда уже собраны,
                // а мы всё ещё в «паузе после ответа» — идём к следующему
                // раунду, а не крутим карточки одного раунда.
                if (this.matchedCount >= this.ROUND_SIZE) {
                    // Тот же сценарий, что и в answer(): раунд закрыт —
                    // сразу к следующему (или к финалу), таймер не ждём.
                    const banner = document.getElementById('habitat-round-banner');
                    if (banner) banner.classList.add('hidden');
                    MiniScroll.hide('habitat-info-panel');
                    if (this.round >= this.TOTAL_ROUNDS) {
                        this.stopTimer();
                        this.showEndScreen('🏆 Игра окончена!');
                    } else {
                        this.nextRound();
                    }
                } else {
                    // Верный ответ засчитан и пара уже в журнале — идём дальше.
                    // showNextCard() сам снимает паузу таймера (resumeTimer).
                    this.showNextCard();
                }
            } else {
                this.resumeTimer();
            }
            return;
        }

        // Все пять видов раунда отвечены (кнопка активна по завершении
        // раунда) — сразу ведём игрока дальше, не заставляя ждать
        // истечения таймера.
        this.proceedAfterRound();
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

    // ---------- Отнесение вида к кому-то из четырёх биомов ----------

    normalize(str) {
        return String(str || '').toLowerCase().replace(/ё/g, 'е');
    },

    // Формулы названий ПРИРОДНЫХ ЗОН («в пределах степной и лесостепной
    // природно-климатических зон») — это административно-географическая
    // справка, а не место обитания. Вырезаем их из текста перед подсчётом
    // весов, иначе рыба из Иртыша получала +3 степи за слово «степной».
    stripZonePhrases(hay) {
        return hay
            .replace(/(лесостеп|степ|полупустын|пустын|тундр|тайжн|лес)[а-яё]*(\s+-?\s*[а-яё]+){0,4}\s+природно[-\s]?[а-яё]*/g, ' ')
            .replace(/природно[-\s]?(климатичес|зон|област)[а-яё]*/g, ' ');
    },

    biomeOf(species) {
        // Поля habitats/description_short есть только в подробной карточке
        // из window.SPECIES_DATA (js/species-data.js), а не в списке SPECIES
        const full = (window.SPECIES_DATA && species && species.id)
            ? window.SPECIES_DATA[species.id] : null;
        let hay = this.normalize(((full && full.habitats) || '') + ' ' +
            ((full && full.description_short) || ''));
        if (!hay.trim()) return null;
        hay = this.stripZonePhrases(hay);

        // Взвешенный подсчёт (см. BIOME_WEIGHTS): побеждает биом с
        // наибольшей суммой весов встретившихся ключевых слов.
        // Порог уверенности — 3 балла (например, одно «болото» или
        // «степь»+«полынь» уже достаточно).
        let best = null, bestScore = 0;
        this.BIOME_PRIORITY.forEach(key => {
            const table = this.BIOME_WEIGHTS[key] || [];
            let score = 0;
            for (const [stem, w] of table) {
                if (w > 0 && hay.includes(stem)) score += w;
            }
            if (score > bestScore) { best = key; bestScore = score; }
        });
        return bestScore >= 3 ? best : null; // нужен уверенный сигнал
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
                const biome = this.biomeOf(sp);
                if (biome) entries.push({ sp, biome });
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

    // Карточка нового вида: сначала «рубашка», клик — открыть фото.
    showNextCard() {
        // Переходим к следующему вопросу — снимаем паузу, таймер снова тикает
        this.resumeTimer();
        this.currentIdx++;
        this._answeredCurrent = false;
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
            <div class="habitat-name">${escHtml(sp.name)}</div>
            <div class="habitat-latin">${escHtml(String(sp.latin || '').split(',')[0].trim())}</div>
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
        // Мини-свиток с данными из Красной книги — только после ответа.
        this._lastPickKey = null;
        this.setInfoVisible(false);
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

        // Подсветка ключевых слов — ТОЛЬКО при правильном ответе.
        // При ошибке свиток показывается чистым текстом, без подсветок.
        const hlText = (txt) => {
            let html = escHtml(txt).replace(/\n/g, '<br>');
            if (!correct) return html;
            const words = this.KEYWORDS[biomKey] || [];
            // длинные слова раньше — иначе короткие «съедят» вхождения длинных
            [...words].sort((a, b) => b.length - a.length).forEach(w => {
                const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-яё]*)', 'gi');
                html = html.replace(re, '<mark class="hl-' + biomKey + '" data-w>$1</mark>');
            });
            return html;
        };

        const blocks = [];
        if (habitats) {
            blocks.push({ title: 'Места обитания', html: hlText(habitats) });
        } else {
            blocks.push({ title: 'Места обитания', text: 'Поле «Места обитания» в базе пусто — ориентируйтесь на описание.' });
        }
        if (spread) blocks.push({ title: 'Распространение в Омской области', html: escHtml(spread).replace(/\n/g, '<br>') });
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
        const panel = document.getElementById('habitat-info-panel');
        if (panel && !panel.querySelector('.ms-open-full')) {
            panel.appendChild(MiniScroll.footerButton(sp.id, () => this.close()));
        }
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
        const correct = biomKey === item.biome;
        const firstTry = !this._answeredCurrent;
        // Запоминаем исход последнего ответа — по нему «Продолжить →»
        // решает: идти к следующему виду (верный) или остаться на
        // текущем для повторного выбора (неверный).
        this._lastAnswerCorrect = correct;

        // Любой ответ: ставим игру на паузу (таймер заморожен), чтобы
        // игрок мог спокойно прочитать мини-свиток с данными из
        // Красной книги. Снимается пауза кнопкой «Продолжить →».
        this.pauseTimer();
        this._lastPickKey = biomKey;
        // Свиток показываем при ЛЮБОМ ответе (верном и неверном);
        // подсветка ключевых слов — только при верном.
        this.renderInfoPanel(item, biomKey, correct); // свиток + подсветка выбранной среды

        if (correct) {
            const elapsed = (Date.now() - this.questionStartTs) / 1000;
            btn.classList.add('hab-correct');
            setTimeout(() => btn.classList.remove('hab-correct'), 600);

            if (firstTry) {
                this.score++;
                this.streak++;
                this.bestStreak = Math.max(this.bestStreak, this.streak);
                if (this.fastest == null || elapsed < this.fastest) this.fastest = elapsed;
                if (elapsed <= 2) this.unlockAch('quick');
                if (this.streak >= 8) this.unlockAch('serial');
                this.matchedCount++;
            }
            this.locked = false;
            this.updateScoreboard();
            // В журнал пишем ВЫБРАННУЮ игроком среду (биом), а не эталон:
            // «Стрепет — Лес ✘», затем при верном выборе «Стрепет — Степь ✔».
            this.addLogPair(item, true, biomKey);

            if (this.matchedCount >= this.ROUND_SIZE) {
                // Все пары раунда собраны. Игра НЕ должна ждать истечения
                // таймера — сразу показываем активную кнопку «Продолжить →»
                // (по замечанию игрока на мобильных: после пятого верного
                // ответа кнопка оставалась бледной, и приходилось ждать,
                // пока время «выйдет в ноль»).
                this.stopTimer();
                if (this.round >= this.TOTAL_ROUNDS) {
                    // Последний раунд закрыт — финал игры тоже по кнопке,
                    // чтобы игрок успел дочитать мини-свиток.
                    this.showRoundBanner(
                        `🏆 Все ${this.TOTAL_ROUNDS} раунда пройдены! Верно определено: ${this.score} видов.` +
                        (this.mistakes ? ` Ошибок за игру: ${this.mistakes}.` : ' Ни одной ошибки!'),
                        'Завершить игру 🏁');
                    this._endAfterContinue = true;   // «Продолжить» → экран итогов
                } else {
                    this.showRoundBanner(
                        `🎉 Раунд ${this.round} завершён! Верно определено: ${this.matchedCount} из ${this.ROUND_SIZE}.` +
                        (this.roundMistakes ? ` Ошибок в раунде: ${this.roundMistakes}.` : ' Ни одной ошибки!'),
                        'Продолжить →');
                }
                this.waitingContinue = false;        // это пауза МЕЖДУ раундами
                this.locked = true;                  // ответы больше не нужны
            } else {
                // НЕ показываем следующую карточку сразу: игра встаёт на
                // паузу до нажатия «Продолжить →» — есть время изучить свиток.
                this.showAnswerPauseBtn();
            }
        } else {
            if (firstTry) {
                // Первая ошибка в вопросе: засчитываем, но даём шанс
                // выбрать другой вариант, глядя на текст в свитке.
                this.mistakes++;
                this.roundMistakes++;
                this.streak = 0;
                this._answeredCurrent = true;
                this.updateScoreboard();
                this.addLogPair(item, false, biomKey);
            } else {
                // Повторная ошибка — тоже обновляем запись журнала
                this.addLogPair(item, false, biomKey);
            }
            btn.classList.add('hab-wrong');
            setTimeout(() => btn.classList.remove('hab-wrong'), 600);
            // Пауза после любого ответа: ждём «Продолжить →». После
            // снятия паузы можно выбрать другую среду для этого же вида.
            this.showAnswerPauseBtn();
        }
    },

    // Активировать кнопку «Продолжить →» как сигнал ПАУЗЫ ПОСЛЕ ОТВЕТА:
    // таймер стоит, свиток открыт, новые ответы не принимаются, пока
    // игрок не нажмёт кнопку (см. continueToNextRound -> waitingContinue).
    showAnswerPauseBtn() {
        this.waitingContinue = true;
        this.locked = true;
        this.showNextRoundBtn('Продолжить →');
    },

    // Журнал пар «вид — среда»: записи остаются до конца игры.
    // pickKey — биом, который реально выбрал игрок (пишем его, а не
    // правильный ответ). При верном выборе запись перечёркивается
    // крестиком и заменяется/подсвечивается галочкой.
    addLogPair(item, correct, pickKey) {
        const log = document.getElementById('habitat-log');
        if (!log) return;
        this.removeEmptyLogNote();
        const key = item.sp.id;
        const existing = log.querySelector(`[data-pair="${CSS.escape(key)}"]`);
        const pickedLabel = this.biomeLabel(pickKey || item.biome);
        if (existing) {
            if (correct) {
                existing.classList.remove('hl-miss');
                existing.classList.add('hl-hit');
                existing.innerHTML = `<span class="hl-mark">✔</span> ${escHtml(item.sp.name)} — <b>${pickedLabel}</b>`;
            } else {
                existing.innerHTML = `<span class="hl-mark">✘</span> ${escHtml(item.sp.name)} — <b>${pickedLabel}</b>`;
            }
            return;
        }
        const div = document.createElement('div');
        div.className = 'hl-entry ' + (correct ? 'hl-hit' : 'hl-miss');
        div.dataset.pair = key;
        div.innerHTML = `<span class="hl-mark">${correct ? '✔' : '✘'}</span> ` +
            `${escHtml(item.sp.name)} — <b>${pickedLabel}</b>`;
        log.appendChild(div);
    },

    biomeLabel(key) {
        const b = this.BIOMES.find(x => x.key === key);
        return b ? `${b.icon} ${b.label}` : '?';
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
