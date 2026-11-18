// ============================================================
// РЕЖИМ «ИГРЫ» — медали (достижения) и сохранение прогресса
// ============================================================
// Единый реестр достижений всех мини-игр. Игры вызывают
//   Achievements.unlock('<game>', '<ach-id>')
// при получении достижения. Прогресс хранится в localStorage
// (ключ red_book_games_progress_v1). В режиме «Игры» на месте
// карты показывается витрина медалей; кнопки «Сохранить» /
// «Загрузить» выгружают и загружают прогресс JSON-файлом.

const Achievements = {

  STORAGE_KEY: 'red_book_games_progress_v1',
  SCROLLS_SEEN_KEY: 'red_book_scrolls_seen_v1',

  // Порядок обхода игр для кнопки «Следующая игра →»
  GAMES_ORDER: ['quiz', 'match', 'memo', 'erudite', 'latin', 'habitat', 'status', 'family'],

  // Счётчики сыгранных партий (для кросс-игровых медалей) —
  // хранятся отдельно от медалей, обнуляются только при импорте прогресса.
  meta: null,

  bumpMeta(key, delta = 1) {
    if (!this.progress) this.load();
    this.meta = this.progress._meta || {};
    const step = (typeof delta === 'number' && Number.isFinite(delta) && delta > 0)
      ? Math.floor(delta) : 1;
    this.meta[key] = (this.meta[key] || 0) + step;
    this.progress._meta = this.meta;
    this.persist();
    return this.meta[key];
  },

  bumpGameCounter(gameKey) {
    const n = this.bumpMeta('gamesPlayed:' + gameKey);
    // Медаль «Игроман»: суммарно 25 партий во всех играх
    const total = this.GAMES_ORDER.reduce((s, g) => s + (this.meta['gamesPlayed:' + g] || 0), 0);
    if (total >= 25) this.unlock('cross', 'igromania');
    return n;
  },

  // ---------- Множество увиденных свитков видов ----------
  // Хранится ОТДЕЛЬНО от progress._meta: sanitize() пропускает в _meta
  // только числа, а для медалей «все птицы/растения/грибы» нужен
  // именно набор speciesId.

  loadScrollsSeen() {
    try {
      const raw = localStorage.getItem(this.SCROLLS_SEEN_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr)
        ? arr.filter(x => typeof x === 'string' && x.length > 0 && x.length < 128)
        : []);
    } catch (e) {
      return new Set();
    }
  },

  saveScrollsSeen(set) {
    try {
      const arr = Array.from(set).filter(x => typeof x === 'string');
      localStorage.setItem(this.SCROLLS_SEEN_KEY, JSON.stringify(arr));
    } catch (e) { /* noop */ }
  },

  bumpScrollsSeen(speciesId) {
    if (typeof speciesId !== 'string' || !speciesId) return;
    const seen = this.loadScrollsSeen();
    if (seen.has(speciesId)) {
      // Уже видели — счётчик не трогаем, но медали проверить не мешает
      // (на случай, если они были добавлены в реестр позже).
      this.checkExplorerMedals();
      return;
    }
    seen.add(speciesId);
    this.saveScrollsSeen(seen);
    // Счётчик для прогресс-бара дашборда
    this.bumpMeta('scrollsSeen');
    this.checkExplorerMedals();
  },

  // ---------- Справочники для медалей «Исследователя» ----------
  // Список ID птиц из SPECIES (класс Птицы – AVES). Нужен отдельно,
  // потому что App.detectCategory() различает только animals/plants/
  // lichens/fungi, а «птицы» — подмножество animals.
  BIRDS: [
    'gavia_arctica', 'podiceps_ruficollis', 'podiceps_griseigena',
    'pelecanus_crispus', 'pelecanus_onocrotalus',
    'ixobrychus_minutus', 'egretta_alba', 'ciconia_nigra',
    'phoenicopterus_roseus',
    'branta_bernicla', 'rufibrenta_ruficollis', 'anser_erythropus',
    'cygnus_olor', 'cygnus_cygnus', 'cygnus_bewickii',
    'tadorna_ferruginea', 'tadorna_tadorna',
    'aythya_nyroca', 'netta_rufina', 'oxyura_leucocephala',
    'pandion_haliaetus', 'pernis_apivorus', 'circus_macrourus',
    'buteo_rufinus', 'aquila_nipalensis', 'aquila_clanga',
    'aquila_heliaca', 'aquila_chrysaetos', 'haliaeetus_albicilla',
    'aegypius_monachus', 'falco_rusticolus', 'falco_cherrug',
    'falco_peregrinus', 'falco_columbarius', 'falco_subbuteo',
    'falco_vespertinus', 'falco_naumanni',
    'perdix_perdix',
    'grus_leucogeranus', 'grus_monacha', 'grus_grus',
    'anthropoides_virgo', 'crex_crex', 'gallinula_chloropus',
    'otis_tarda', 'tetrax_tetrax', 'chlamydotis_undulata',
    'burhinus_oedicnemus', 'chettusia_gregaria',
    'recurvirostra_avosetta', 'himantopus_himantopus',
    'haematopus_ostralegus', 'tringa_nebularia',
    'gallinago_megala', 'numenius_tenuirostris',
    'numenius_arquata', 'numenius_phaeopus', 'limosa_limosa',
    'limnodromus_semipalmatus', 'glareola_nordmanni',
    'larus_ichthyaetus', 'hydroprogne_caspia', 'sterna_albifrons',
    'nyctea_scandiaca', 'bubo_bubo', 'otus_scops',
    'athene_noctua', 'aegolius_funereus', 'glaucidium_passerinum',
    'surnia_ulula', 'strix_nebulosa',
    'coracias_garrulus', 'alcedo_atthis', 'merops_apiaster', 'upupa_epops',
    'dryocopus_martius',
    'melanocorypha_leucoptera', 'melanocorypha_yeltoniensis',
    'eremophila_alpestris', 'anthus_campestris', 'anthus_richardi',
    'anthus_hodgsoni', 'lanius_excubitor', 'lanius_minor',
    'locustella_certhiola', 'acrocephalus_paludicola',
    'sylvia_atricapilla', 'regulus_regulus', 'luscinia_luscinia',
    'zoothera_dauma', 'tarsiger_cyanurus', 'panurus_biarmicus',
    'uragus_sibiricus', 'loxia_curvirostra', 'pinicola_enucleator'
  ],

  // Кэш: speciesId -> 'animals' | 'plants' | 'lichens' | 'fungi' | null.
  // Заполняется один раз при первом обращении; сбрасывается при импорте
  // прогресса (species-данные не меняются в рантайме).
  _categoryCache: null,

  _getCategoryCache() {
    if (this._categoryCache) return this._categoryCache;
    const cache = new Map();
    if (typeof App !== 'undefined' && typeof App.detectCategory === 'function'
      && typeof App.collectAllSpecies === 'function') {
      try {
        App.collectAllSpecies().forEach(sp => {
          if (!sp || !sp.id) return;
          const cat = App.detectCategory(sp.id);
          if (cat) cache.set(String(sp.id), cat);
        });
      } catch (e) { /* App ещё не готов — соберём позже */ }
    }
    if (cache.size) this._categoryCache = cache;
    return cache;
  },

  // Список всех speciesId из SPECIES_DATA (или пустой массив, если данных нет)
  _allSpeciesIds() {
    if (typeof window !== 'undefined' && window.SPECIES_DATA
      && typeof window.SPECIES_DATA === 'object') {
      return Object.keys(window.SPECIES_DATA);
    }
    return [];
  },

  // ID видов указанной категории (animals/plants/lichens/fungi)
  _speciesIdsOfCategory(categoryKey) {
    const cache = this._getCategoryCache();
    const out = [];
    cache.forEach((cat, id) => { if (cat === categoryKey) out.push(id); });
    return out;
  },

  // Сколько «своих» видов у каждой категории (для прогресс-баров/медалей).
  // Возвращает { animals: N, plants: N, lichens: N, fungi: N }.
  _categoryTotals() {
    const totals = { animals: 0, plants: 0, lichens: 0, fungi: 0 };
    this._getCategoryCache().forEach((cat) => {
      if (totals[cat] != null) totals[cat]++;
    });
    return totals;
  },

  // ---------- Медали «Исследователя» ----------
  // Вызывается из:
  //  • bumpScrollsSeen() — после добавления нового свитка;
  //  • app-regions.js → saveRegion()/saveMigration() (обычная ветка);
  //  • app-render.js  → saveModal() (обычная ветка);
  //  • journal.js     → saveRecord() (после успешного сохранения).
  // Идемпотентна: unlock() сам проверяет, получена ли медаль.
  checkExplorerMedals() {
    const seen = this.loadScrollsSeen();
    const seenSize = seen.size;

    // 1. Счётчики свитков
    if (seenSize >= 1) this.unlock('explorer', 'first_scroll');
    if (seenSize >= 10) this.unlock('explorer', 'explorer10');
    if (seenSize >= 25) this.unlock('explorer', 'explorer25');
    if (seenSize >= 50) this.unlock('explorer', 'explorer50');
    const allIds = this._allSpeciesIds();
    if (allIds.length > 0 && seenSize >= allIds.length) {
      this.unlock('explorer', 'explorer_all');
    }

    // 2. Действия на карте и в дневнике
    const App = (typeof window !== 'undefined') ? window.App : null;
    if (App) {
      if (Array.isArray(App.markers) && App.markers.length >= 1) {
        this.unlock('explorer', 'first_marker');
      }
      if (Array.isArray(App.regions) && App.regions.length >= 1) {
        this.unlock('explorer', 'cartographer');
      }
      if (Array.isArray(App.migrations) && App.migrations.length >= 1) {
        this.unlock('explorer', 'first_migration');
      }
    }
    if (typeof Journal !== 'undefined' && Array.isArray(Journal.records)
      && Journal.records.length >= 1) {
      this.unlock('explorer', 'diarist');
    }

    // 3. Категорийные медали — только когда кэш категорий уже собран
    //    (App.detectCategory доступен). Иначе пропускаем: значит, App
    //    ещё не инициализирован, а такие вызовы до App.init быть не могут.
    const cache = this._getCategoryCache();
    if (!cache.size) return;

    // 3a. Хотя бы по одному виду из каждой категории
    const coveredCats = new Set();
    seen.forEach(id => {
      const cat = cache.get(String(id));
      if (cat) coveredCats.add(cat);
    });
    if (coveredCats.has('animals') && coveredCats.has('plants')
      && coveredCats.has('lichens') && coveredCats.has('fungi')) {
      this.unlock('explorer', 'all_groups');
    }

    // 3b. Полное покрытие категории. Сравниваем «увидено» с «всего»,
    //     но только если для категории вообще есть виды в базе.
    const totals = this._categoryTotals();
    const seenOf = (cat) => {
      let n = 0;
      seen.forEach(id => { if (cache.get(String(id)) === cat) n++; });
      return n;
    };
    if (totals.animals > 0 && seenOf('animals') >= totals.animals) {
      this.unlock('explorer', 'zoologist');
    }
    if (totals.plants > 0 && seenOf('plants') >= totals.plants) {
      this.unlock('explorer', 'botanist');
    }
    if (totals.lichens > 0 && seenOf('lichens') >= totals.lichens) {
      this.unlock('explorer', 'lichenologist');
    }
    if (totals.fungi > 0 && seenOf('fungi') >= totals.fungi) {
      this.unlock('explorer', 'mycologist');
    }

    // 3c. Орнитолог: все 95 птиц из явного списка BIRDS.
    //     Проверяем, что каждая птица из списка есть в seen.
    if (this.BIRDS.length > 0) {
      let got = 0;
      for (let i = 0; i < this.BIRDS.length; i++) {
        if (seen.has(this.BIRDS[i])) got++;
      }
      if (got >= this.BIRDS.length) {
        this.unlock('explorer', 'orinthologist');
      }
    }
  },

  CATALOG: [
    { game: 'quiz', title: 'Викторина', icon: '🎲', openBtn: 'btn-quiz', achievements: [
      { id: 'perfect',    icon: '🏆', name: 'Настоящий биолог',          hint: '90%+ верных ответов' },
      { id: 'good', icon: '✅', name: 'Хороший результат', hint: '60%+ верных ответов' },
      { id: 'first_win',  icon: '📖', name: 'Первое завершение',         hint: 'Пройти викторину до конца' },
      { id: 'centurion',  icon: '💯', name: 'Сотник знаний',             hint: 'Набрать 100 верных ответов суммарно' },
      { id: 'streak5',    icon: '🔥', name: 'Пять в ряд',                hint: 'Серия из 5 верных ответов подряд' },
      { id: 'speed',      icon: '⚡', name: 'Метеор',                    hint: 'Ответить верно быстрее 3 секунд' },
      { id: 'marathon',   icon: '🎭', name: 'Марафонец викторин',        hint: 'Сыграть 10 викторин' },
      { id: 'noswipes',   icon: '🧠', name: 'Энциклопедия',              hint: 'Финиш без единой ошибки' }
    ]},
    { game: 'match', title: 'Найди пару', icon: '🧩', openBtn: 'btn-match', achievements: [
      { id: 'flawless',   icon: '👑', name: 'Без единой ошибки',         hint: 'Полная победа без ошибок' },
      { id: 'eagle',      icon: '🏆', name: 'Орлиный глаз',              hint: 'Победа с ≤3 ошибками' },
      { id: 'naturalist', icon: '🌟', name: 'Внимательный натуралист',   hint: 'Победа с ≤8 ошибками' },
      { id: 'persistent', icon: '💪', name: 'Упорство и труд', hint: 'Собрать все пары' },
      { id: 'chain3',     icon: '⛓️', name: 'Тройная цепь',              hint: '3 пары подряд без единой ошибки' },
      { id: 'tenwins',    icon: '🗂️', name: 'Коллекционер пар',          hint: 'Собрать 10 побед в «Найди пару»' },
      { id: 'sharpshooter',icon:'🎯', name: 'Меткий систематик',         hint: 'Победить ровно с 1 ошибкой' }
    ]},
    {
      game: 'memo', title: 'Мемо', icon: '🃏', openBtn: 'btn-memo', achievements: [
        { id: 'photo', icon: '👑', name: 'Фотографическая память', hint: 'Победа за ≤22 ходов' },
        { id: 'expert', icon: '🏆', name: 'Знаток Красной книги', hint: 'Победа за ≤24 хода' },
        { id: 'attentive', icon: '🌟', name: 'Внимательный натуралист', hint: 'Победа за ≤26 ходов' },
        { id: 'firststep', icon: '🌱', name: 'Первый шаг в науке', hint: 'Выиграть партию мемо' },
        { id: 'memoryking', icon: '♟️', name: 'Повелитель удачи', hint: 'Победа за ≤18 ходов' },
        { id: 'deduction', icon: '🕵️', name: 'Дедукция', hint: '5 найденных пар подряд с первой попытки' },
        { id: 'tenrounds', icon: '🃏', name: 'Десять раундов', hint: 'Выиграть 10 партий мемо' }
      ]
    },
    { game: 'erudite', title: 'Эрудит', icon: '🦉', openBtn: 'btn-erudite', achievements: [
      { id: 'linguist',   icon: '👑', name: 'Лингвист Красной книги',    hint: 'Все слова + серия 4+' },
      { id: 'ortho',      icon: '🏆', name: 'Знаток орфографии',         hint: '9 из 10 слов' },
      { id: 'philologist',icon: '🌟', name: 'Начинающий филолог',        hint: 'Решить половину слов' },
      { id: 'letters', icon: '✏️', name: 'Первые буквы', hint: 'Завершить игру' },
      { id: 'polyglot',   icon: '🈶', name: 'Полиглот',                  hint: 'Решить все 10 слов за игру' },
      { id: 'frugal',     icon: '🪙', name: 'Академик-экономист',        hint: 'Пройти игру вообще без подсказок' },
      { id: 'poet',       icon: '✒️', name: 'Поэт фауны',                hint: 'Серия из 6 слов подряд' },
      { id: 'scrabble',   icon: '🔤', name: 'Скрабблист',                hint: 'Собрать 100 букв суммарно' }
    ]},
    { game: 'latin', title: 'Латынь', icon: '🏛️', openBtn: 'btn-latin', achievements: [
      { id: 'keeper',     icon: '👑', name: 'Хранитель латыни',          hint: 'Ни одной ошибки за игру' },
      { id: 'linguist',   icon: '🔥', name: 'Лингвист-натуралист',       hint: '2 идеальных раунда' },
      { id: 'translator', icon: '🏆', name: 'Точный переводчик',         hint: 'Победа с ≤3 ошибками' },
      { id: 'student',    icon: '🎓', name: 'Ученик систематика',        hint: 'Пройти все раунды' },
      { id: 'allpairs',   icon: '🏛️', name: 'Магистр латыни',            hint: 'Решить все 15 пар за игру' },
      { id: 'speedlatin', icon: '⚡', name: 'Быстрый систематик',        hint: 'Закрыть раунд за 20 секунд или меньше' },
      { id: 'glossary',   icon: '📜', name: 'Глоссарий',                 hint: 'Решить 50 пар суммарно' }
    ]},
    { game: 'habitat', title: 'Среда обитания', icon: '🌍', openBtn: 'btn-habitat', achievements: [
      { id: 'keeper',   icon: '👑', name: 'Хранитель экосистем',         hint: 'Пройти игру без единой ошибки' },
      { id: 'expert',   icon: '🏆', name: 'Знаток биотопов',             hint: 'Пройти игру с ≤2 ошибками' },
      { id: 'ranger', icon: '🌲', name: 'Лесной рейнджер', hint: 'Пройти все раунды игры' },
      { id: 'quick',    icon: '⚡', name: 'Молниеносный эколог',         hint: 'Верный ответ быстрее 2 секунд' },
      { id: 'serial',   icon: '🔥', name: 'Серия открытий',              hint: '8 верных ответов подряд' }
    ]},
    { game: 'status', title: 'Статус', icon: '🎖️', openBtn: 'btn-status', achievements: [
      { id: 'flawless', icon: '👑', name: 'Канцлер Красной книги',       hint: 'Финиш без единой ошибки' },
      { id: 'expert',   icon: '🏆', name: 'Знаток категорий',            hint: '90%+ верных ответов' },
      { id: 'good', icon: '👍', name: 'Хороший результат', hint: '60%+ верных ответов' },
      { id: 'first_win', icon: '🏁', name: 'Первая категория', hint: 'Завершить игру' },
      { id: 'streak5',  icon: '🔥', name: 'Пять статусов подряд',        hint: 'Серия из 5 верных ответов' },
      { id: 'speed',    icon: '⚡', name: 'Быстрый оценщик',             hint: 'Ответить верно быстрее 2 секунд' },
      { id: 'centurion',icon: '💯', name: 'Сотник категорий',            hint: '100 верных ответов суммарно' }
    ]},
    {
      game: 'family', title: 'Систематик', icon: '🗂️', openBtn: 'btn-family', achievements: [
        { id: 'professor', icon: '👑', name: 'Академик систематике', hint: 'Ни одной ошибки за игру' },
        { id: 'practitioner', icon: '🏆', name: 'Систематик-практик', hint: 'Победа с ≤2 ошибками' },
        { id: 'systematicist', icon: '🎓', name: 'Юный систематик', hint: 'Пройти все раунды игры' },
        { id: 'perfectround', icon: '⚡', name: 'Безупречный раунд', hint: 'Закрыть раунд без ошибок' }
      ]
    },
    {
      game: 'explorer', title: 'Исследователь', icon: '📖', openBtn: null, achievements: [
        { id: 'first_scroll', icon: '📜', name: 'Первый шаг', hint: 'Открыть первый свиток вида' },
        { id: 'explorer10', icon: '🔍', name: 'Исследователь', hint: 'Открыть 10 разных свитков' },
        { id: 'explorer25', icon: '🧭', name: 'Натуралист', hint: 'Открыть 25 разных свитков' },
        { id: 'explorer50', icon: '🗺️', name: 'Краевед', hint: 'Открыть 50 разных свитков' },
        { id: 'explorer_all', icon: '🏅', name: 'Полный охват', hint: 'Открыть все свитки видов' },
        { id: 'first_marker', icon: '📍', name: 'Первый вклад', hint: 'Поставить первый маркер' },
        { id: 'cartographer', icon: '✏️', name: 'Картограф', hint: 'Нарисовать первую область' },
        { id: 'first_migration', icon: '⇔', name: 'Мигрант', hint: 'Нарисовать первую линию миграции' },
        { id: 'diarist', icon: '📔', name: 'Хранитель дневника', hint: 'Первая запись в дневнике' },
        { id: 'zoologist', icon: '🦅', name: 'Зоолог', hint: 'Открыть свитки всех животных' },
        { id: 'orinthologist', icon: '🪶', name: 'Орнитолог', hint: 'Открыть свитки всех птиц' },
        { id: 'botanist', icon: '🌳', name: 'Ботаник', hint: 'Открыть свитки всех растений' },
        { id: 'lichenologist', icon: '🍃', name: 'Лихенолог', hint: 'Открыть свитки всех лишайников' },
        { id: 'mycologist', icon: '🍄', name: 'Миколог', hint: 'Открыть свитки всех грибов' },
        { id: 'all_groups', icon: '🌐', name: 'Все группы', hint: 'Открыть хотя бы по одному виду из каждой категории' }
      ]
    },
    {
      game: 'cross', title: 'Общие', icon: '🌍', openBtn: 'btn-games', achievements: [
      { id: 'collector',  icon: '🎖️', name: 'Коллекционер',              hint: 'Медали хотя бы в 4 разных играх' },
      { id: 'triplecrown',icon: '👑', name: 'Тройная корона',            hint: 'Все коронные 👑-медали сразу в 3 играх' },
      { id: 'half',       icon: '🥈', name: 'Половина пути',             hint: 'Собрать половину всех медалей' },
      { id: 'grandmaster',icon: '🏅', name: 'Грандмастер',               hint: 'Собрать ВСЕ медали реестра' },
      { id: 'igromania',  icon: '🕹️', name: 'Игроман',                   hint: 'Сыграть 25 партий суммарно' }
    ]}
  ],

  progress: null,

  init() {
    this.load();

    const btnGames = document.getElementById('btn-games');
    if (btnGames) btnGames.addEventListener('click', () => this.enterGamesMode());
    // Выход из режима «Игры» — через клики по ЛЮБОЙ кнопке переключателя
    // режимов (гость/разработчик/дневник). Слушатель на document ловит и
    // прямые клики пользователя, и программные клики App'а.
    document.addEventListener('click', (e) => {
      if (!this.gamesModeActive) return;
      const btn = e.target.closest && e.target.closest('#btn-guest, #btn-developer, #btn-journal');
      if (btn) this.exitGamesMode();
    });
    const btnSave = document.getElementById('btn-save-progress');
    if (btnSave) btnSave.addEventListener('click', () => this.saveToFile());
    const btnLoad = document.getElementById('btn-load-progress');
    if (btnLoad) btnLoad.addEventListener('click', () => this.promptLoadFile());
    const fileInput = document.getElementById('progress-file-input');
    if (fileInput) fileInput.addEventListener('change', (e) => this.importFromFile(e));

    // Крупные кнопки выбора игр в левой панели режима «Игры»
    this.CATALOG.forEach(g => {
      const b = document.getElementById('btn-open-' + g.game);
      if (b) b.addEventListener('click', () => this.openGame(g.game));
    });
  },

  // ---------- Прогресс ----------

  defaultProgress() {
    return { version: 1, savedAt: null, unlocked: {} };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      this.progress = raw ? this.sanitize(JSON.parse(raw)) : this.defaultProgress();
    } catch (e) {
      console.warn('Achievements: повреждён прогресс, начинаем заново.', e);
      this.progress = this.defaultProgress();
    }
    // Счётчики партий/ответов всегда доступны как объект (иначе дашборд
    // и bumpGameCounter работают с null до первого bumpMeta).
    this.meta = this.progress._meta || {};
  },

  // Строгая проверка структуры перед записью в DOM/href (защита от битого файла)
  sanitize(obj) {
    const p = this.defaultProgress();
    if (!obj || typeof obj !== 'object') return p;
    if (typeof obj.savedAt === 'number' && Number.isFinite(obj.savedAt)) p.savedAt = obj.savedAt;
    // Счётчики партий переносим вместе с прогрессом
    if (obj._meta && typeof obj._meta === 'object') {
      const meta = {};
      Object.keys(obj._meta).forEach(k => {
        const v = obj._meta[k];
        if (typeof k === 'string' && k.length < 64 && typeof v === 'number' &&
            Number.isFinite(v) && v >= 0 && v <= 1e6) meta[k] = Math.floor(v);
      });
      p._meta = meta;
    }
    if (obj.unlocked && typeof obj.unlocked === 'object') {
      Object.keys(obj.unlocked).forEach(game => {
        const ids = obj.unlocked[game];
        if (!Array.isArray(ids)) return;
        const cat = this.CATALOG.find(c => c.game === game);
        if (!cat) return;
        ids.forEach(id => {
          if (typeof id === 'string' && cat.achievements.some(a => a.id === id)) {
            p.unlocked[game] = p.unlocked[game] || [];
            if (!p.unlocked[game].includes(id)) p.unlocked[game].push(id);
          }
        });
      });
    }
    return p;
  },

  persist() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.progress));
    } catch (e) {
      console.warn('Achievements: не удалось сохранить прогресс локально.', e);
    }
  },

  unlock(game, achId) {
    if (!this.progress) this.load();
    const cat = this.CATALOG.find(c => c.game === game);
    if (!cat) return false;
    const ach = cat.achievements.find(a => a.id === achId);
    if (!ach) return false;
    this.progress.unlocked[game] = this.progress.unlocked[game] || [];
    const isNew = !this.progress.unlocked[game].includes(achId);
    if (isNew) {
      this.progress.unlocked[game].push(achId);
      this.persist();
      if (this.gamesModeActive) this.renderShowcase();
      this.toast(`🏅 Новая медаль: «${ach.name}» (${cat.title})`);
      this.checkCrossMedals(game);
    }
    return isNew;
  },

  // Кросс-игровые медали: проверяются после каждой новой медали
  checkCrossMedals(justUnlockedGame) {
    if (justUnlockedGame !== 'cross') {
      // «Коллекционер»: ≥4 игры, в КАЖДОЙ из которых ≥3 медали.
      // Раньше порог был «≥4 игры с любой медалью» — пользователь
      // получал медаль, собрав по 1 медали в 4 играх, что ощущалось
      // «дешёво». Теперь нужно реально поиграть в каждую.
      const gamesWithThree = this.CATALOG.filter(g =>
        g.game !== 'cross' &&
        (this.progress.unlocked[g.game] || []).length >= 3
      ).length;
      if (gamesWithThree >= 4) this.unlock('cross', 'collector');

      // «Тройная корона»: все коронные 👑-медали собраны хотя бы в 3 играх сразу
      const crownGames = this.CATALOG.filter(g => g.game !== 'cross').filter(g => {
        const crowns = g.achievements.filter(a => a.icon === '👑');
        const got = this.progress.unlocked[g.game] || [];
        return crowns.length > 0 && crowns.every(c => got.includes(c.id));
      }).length;
      if (crownGames >= 3) this.unlock('cross', 'triplecrown');
    }

    const total = this.CATALOG.reduce((n, g) => n + g.achievements.length, 0);
    const got = this.totalUnlocked();
    if (got * 2 >= total) this.unlock('cross', 'half');
    if (got >= total) this.unlock('cross', 'grandmaster');
  },

  isUnlocked(game, achId) {
    return !!(this.progress && this.progress.unlocked[game] &&
              this.progress.unlocked[game].includes(achId));
  },

  totalUnlocked() {
    let n = 0;
    this.CATALOG.forEach(g => {
      const ids = (this.progress.unlocked || {})[g.game] || [];
      n += g.achievements.filter(a => ids.includes(a.id)).length;
    });
    return n;
  },

  // ---------- Режим «Игры» ----------
  // На главной странице игр нет — только кнопка перехода в режим.
  // В режиме «Игры» сверху остаются обычные переключатели режимов
  // («Режим гостя», «Режим разработчика») — они же и выполняют выход.

  enterGamesMode() {
    // Если режим уже активен, но витрина пуста (например, renderShowcase
    // упал из-за progress === null при восстановлении сессии) — не выходим,
    // а доводим состояние до конца и перерисовываем.
    if (this.gamesModeActive) {
      const list = document.getElementById('medals-list');
      if (list && list.childElementCount === 0) this.renderShowcase();
      return;
    }
    this.gamesModeActive = true;
    document.body.classList.add('games-mode');
    this.setModeButtons();

    // Витрина медалей — на месте рабочей области карты
    const showcase = document.getElementById('games-showcase');
    if (showcase) showcase.classList.remove('hidden');

    // Прячем все секции карты на панели: остаётся только сетка режимов 2×2
    // + выбор игр + прогресс. Кнопки режимов НЕ трогаем.
    // Заголовок панели не скрываем — меняем текст на «Режим Игры».
    const hideSelectors = [
      '#map-switcher', '#status-layers', '#layers',
      '#btn-open-list', '.toggle-grid', '#developer-tools',
      '.actions-row', '#stats-panel', '#hint'
    ];
    this._hiddenByGamesMode = [];
    hideSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.classList.contains('hidden')) {
          el.classList.add('hidden');
          this._hiddenByGamesMode.push(el);
        }
      });
    });

    // Запоминаем и подменяем заголовок панели
    const title = document.getElementById('sidebar-title');
    if (title) {
      this._savedTitleHtml = title.innerHTML;
      title.textContent = 'Красная Книга Омской области';
    }

    // Показываем меню режима «Игры»
    const gamesMenu = document.getElementById('games-menu');
    if (gamesMenu) {
      gamesMenu.classList.remove('hidden');
      gamesMenu.setAttribute('data-active', 'true');
    }

    this.renderShowcase();
  },

  exitGamesMode() {
    if (!this.gamesModeActive) return;
    this.gamesModeActive = false;
    document.body.classList.remove('games-mode');

    const showcase = document.getElementById('games-showcase');
    if (showcase) showcase.classList.add('hidden');

    // Возвращаем ТОЛЬКО те секции, которые скрыли мы (devTools/hint
    // управляются App'ом и остаются в том состоянии, которое он задал)
    (this._hiddenByGamesMode || []).forEach(el => el.classList.remove('hidden'));
    this._hiddenByGamesMode = [];

    // Возвращаем заголовок панели
    const title = document.getElementById('sidebar-title');
    if (title && typeof this._savedTitleHtml === 'string') {
      title.innerHTML = this._savedTitleHtml;
      this._savedTitleHtml = null;
    }

    const gamesMenu = document.getElementById('games-menu');
    if (gamesMenu) {
      gamesMenu.removeAttribute('data-active');
      gamesMenu.classList.add('hidden');
    }

    // Подсказку карты App решит сам при следующем updateHint;
    // если она была активна до входа в игры — восстанавливаем видимость
    this.setModeButtons();
  },

  // Подсветка активного переключателя режимов сверху
  setModeButtons() {
    const btnGuest = document.getElementById('btn-guest');
    const btnDev = document.getElementById('btn-developer');
    const btnGamesEl = document.getElementById('btn-games');
    if (btnGamesEl) btnGamesEl.classList.toggle('active', !!this.gamesModeActive);
    if (this.gamesModeActive) {
      if (btnGuest) btnGuest.classList.remove('active');
      if (btnDev) btnDev.classList.remove('active');
    } else {
      const isDev = typeof App !== 'undefined' && App.developerMode;
      if (btnGuest) btnGuest.classList.toggle('active', !isDev);
      if (btnDev) btnDev.classList.toggle('active', !!isDev);
    }
  },

  openGame(gameKey) {
    const cat = this.CATALOG.find(g => g.game === gameKey);
    if (!cat) return;
    const btn = document.getElementById(cat.openBtn);
    if (btn) btn.click();
  },

  nextGame(currentKey) {
    const i = this.GAMES_ORDER.indexOf(currentKey);
    const nextKey = this.GAMES_ORDER[(i + 1) % this.GAMES_ORDER.length];
    this.openGame(nextKey);
  },

  // ---------- Дашборд «Мой прогресс» ----------
  // Рендерит секции над витриной медалей:
  //   1) Сводка (N% медалей собрано);
  //   2) Прогресс по играм (список CATALOG + explorer);
  //   3) Открыто видов в свитках (N из M);
  //   4) Ближайшие медали (раскрывающийся список);
  //   5) Что ещё можно сделать (подсказки).
  // Заглушка 2G.1: пока только сводка и прогресс по играм.
  // Ближайшие медали и подсказки — в 2G.3/2G.4.
  renderDashboard() {
    const host = document.getElementById('dashboard-block');
    if (!host) return;
    host.innerHTML = '';

    if (!this.progress) this.load();

    const totalAch = this.CATALOG.reduce((n, g) => n + g.achievements.length, 0);
    const gotAch = this.totalUnlocked();
    const pct = totalAch > 0 ? Math.round((gotAch / totalAch) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'db-card';

    // --- 1. Сводка ---
    const summary = document.createElement('div');
    summary.className = 'db-summary';
    summary.innerHTML =
      `<div class="db-big">${pct}%</div>` +
      `<div class="db-big-label">медалей собрано · ${gotAch} из ${totalAch}</div>`;
    card.appendChild(summary);

    // --- 2. Прогресс по играм ---
    // cross — не игра, а сводная категория; в списке игр её не показываем
    // (она и так видна в «Сводке» и «Ближайших медалях»).
    const rows = document.createElement('div');
    rows.className = 'db-rows';
    this.CATALOG.forEach(g => {
      if (g.game === 'cross') return;

      const ids = (this.progress.unlocked || {})[g.game] || [];
      const earned = g.achievements.filter(a => ids.includes(a.id)).length;
      const total = g.achievements.length;
      const rowPct = total > 0 ? (earned / total) * 100 : 0;

      // explorer — «сыграно» = число увиденных свитков; игры — gamesPlayed.
      const played = (g.game === 'explorer')
        ? this.loadScrollsSeen().size
        : (this.meta && this.meta['gamesPlayed:' + g.game]) || 0;
      const playedLabel = (g.game === 'explorer')
        ? `видов в свитках: ${played}`
        : `сыграно: ${played} парт.`;

      const row = document.createElement('div');
      row.className = 'db-row';
      row.innerHTML =
        `<div class="db-row-icon">${g.icon}</div>` +
        `<div class="db-row-title">${g.title}</div>` +
        `<div class="db-row-count">${earned}/${total}</div>` +
        `<div class="db-bar"><div class="db-bar-fill" style="width:${rowPct}%"></div></div>` +
        `<div class="db-row-played">${playedLabel}</div>`;
      rows.appendChild(row);
    });
    card.appendChild(rows);

    // --- 3. Открыто видов в свитках ---
    const seenSize = this.loadScrollsSeen().size;
    const totalSpecies = this._allSpeciesIds().length;
    const scrollPct = totalSpecies > 0 ? (seenSize / totalSpecies) * 100 : 0;
    const scrolls = document.createElement('div');
    scrolls.className = 'db-scrolls';
    scrolls.innerHTML =
      `<div class="db-scrolls-title">Открыто видов в свитках</div>` +
      `<div class="db-scrolls-count">${seenSize} из ${totalSpecies}` +
      (totalSpecies > 0 ? ` (${Math.round(scrollPct)}%)` : '') + `</div>` +
      `<div class="db-bar"><div class="db-bar-fill" style="width:${scrollPct}%"></div></div>`;
    card.appendChild(scrolls);

    // --- 4. Ближайшие медали ---
    // Берём по одной недополученной медали из каждой игры, сортируем
    // игры по проценту собранного (где больше собрано — та «ближе»),
    // показываем до 12 строк.
    const closest = [];
    this.CATALOG.forEach(g => {
      const ids = (this.progress.unlocked || {})[g.game] || [];
      const earned = g.achievements.filter(a => ids.includes(a.id)).length;
      const total = g.achievements.length;
      if (earned >= total) return; // всё собрано — пропускаем
      const next = g.achievements.find(a => !ids.includes(a.id));
      if (!next) return;
      closest.push({
        game: g,
        ach: next,
        earned,
        total,
        ratio: total > 0 ? earned / total : 0
      });
    });
    closest.sort((a, b) => b.ratio - a.ratio);
    const closestTop = closest.slice(0, 12);

    if (closestTop.length > 0) {
      const det = document.createElement('details');
      det.className = 'db-closest';
      const summary = document.createElement('summary');
      summary.textContent = `Ближайшие медали · к получению осталось ${closest.length}`;
      det.appendChild(summary);
      const list = document.createElement('div');
      list.className = 'db-closest-list';
      closestTop.forEach(item => {
        const row = document.createElement('div');
        row.className = 'db-closest-item';
        row.innerHTML =
          `<span class="db-closest-game">${item.game.icon} ${item.game.title}</span>` +
          `${item.ach.icon} <strong>${item.ach.name}</strong> — ${item.ach.hint}`;
        list.appendChild(row);
      });
      det.appendChild(list);
      card.appendChild(det);
    }

    // --- 5. Что ещё можно сделать ---
    // 3–5 подсказок, только для НЕ выполненных действий. Если всё
    // выполнено — секция не рендерится вовсе.
    const suggestions = [];
    const seen = this.loadScrollsSeen();
    const seenCount = seen.size;
    const totalSpeciesAll = this._allSpeciesIds().length;
    if (totalSpeciesAll > 0 && seenCount < totalSpeciesAll) {
      const need = Math.min(5, totalSpeciesAll - seenCount);
      suggestions.push(`📖 Открой ещё ${need} новых свитков видов (сейчас открыто ${seenCount} из ${totalSpeciesAll})`);
    }

    // Игра с наименьшим числом медалей (среди тех, где ещё не всё собрано)
    let leastGame = null;
    let leastEarned = Infinity;
    this.CATALOG.forEach(g => {
      if (g.game === 'cross' || g.game === 'explorer') return; // только игры
      const ids = (this.progress.unlocked || {})[g.game] || [];
      const earned = g.achievements.filter(a => ids.includes(a.id)).length;
      if (earned >= g.achievements.length) return; // всё собрано
      if (earned < leastEarned) {
        leastEarned = earned;
        leastGame = g;
      }
    });
    if (leastGame) {
      suggestions.push(`🎮 Сыграй в «${leastGame.title}» — там меньше всего медалей (${leastEarned} из ${leastGame.achievements.length})`);
    }

    const App = (typeof window !== 'undefined') ? window.App : null;
    if (App) {
      if (!Array.isArray(App.regions) || App.regions.length === 0) {
        suggestions.push('✏️ Нарисуй первую область в режиме разработчика — медаль «Картограф»');
      }
    }

    // Проверяем записи в памяти, а если их нет — смотрим в localStorage.
    // Это защищает подсказку от ситуации, когда renderDashboard вызывается
    // раньше, чем Journal.init() успел загрузить данные из хранилища.
    let hasJournalRecords = false;
    if (typeof Journal !== 'undefined' && Array.isArray(Journal.records) && Journal.records.length > 0) {
      hasJournalRecords = true;
    } else {
      try {
        const raw = localStorage.getItem('red_book_journal');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) hasJournalRecords = true;
        }
      } catch (e) { /* битый JSON — считаем, что записей нет */ }
    }
    if (!hasJournalRecords) {
      suggestions.push('📔 Заполни полевой дневник первой записью — медаль «Хранитель дневника»');
    }

    if (App && (!Array.isArray(App.markers) || App.markers.length === 0)) {
      suggestions.push('📍 Поставь первый маркер на карте — медаль «Первый вклад»');
    }

    // Показываем не больше 5 подсказок, не больше 5 по счёту
    const topSuggestions = suggestions.slice(0, 5);
    if (topSuggestions.length > 0) {
      const sug = document.createElement('div');
      sug.className = 'db-suggestions';
      sug.innerHTML =
        `<div class="db-suggestions-title">💡 Что ещё можно сделать</div>` +
        `<ul class="db-suggestions-list">` +
        topSuggestions.map(s => `<li>${s}</li>`).join('') +
        `</ul>`;
      card.appendChild(sug);
    }

    host.appendChild(card);
  },

  renderShowcase() {
  // Прогресс мог ещё не загрузиться (init идёт через setTimeout(100)),
    // а restoreSessionState вызывает enterGamesMode() сразу после App.init.
    // Без этого список медалей остаётся пустым до выхода/возврата в режим.
    if (!this.progress) this.load();

    // Дашборд «Мой прогресс» — над витриной медалей.
    this.renderDashboard();

    const list = document.getElementById('medals-list');
    if (!list) return;
    list.innerHTML = '';

    // Считаем коронные 👑-медали: в игре ровно одна корона — она «особая»
    const crownCount = {};
    this.CATALOG.forEach(g => {
      crownCount[g.game] = g.achievements.filter(a => a.icon === '👑').length;
    });

    this.CATALOG.forEach(g => {
      const ids = (this.progress.unlocked || {})[g.game] || [];
      const earned = g.achievements.filter(a => ids.includes(a.id)).length;

      const section = document.createElement('section');
      section.className = 'medals-game';

      const head = document.createElement('div');
      head.className = 'medals-game-head';
      const titleSpan = document.createElement('span');
      titleSpan.textContent = `${g.icon} ${g.title}`;
      const countSpan = document.createElement('span');
      countSpan.className = 'medals-count';
      countSpan.textContent = `${earned}/${g.achievements.length}`;
      head.appendChild(titleSpan);
      head.appendChild(countSpan);
      section.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'medals-grid';
      g.achievements.forEach(a => {
        const got = ids.includes(a.id);
        const m = document.createElement('div');
        let cls = 'medal' + (got ? '' : ' locked');
        if (a.icon === '👑') cls += crownCount[g.game] === 1 ? ' medal-crown' : ' medal-top';
        else if (/^[🏅🥇]$/.test(a.icon)) cls += ' medal-top';
        else if (/^[🏆⚡🔥💯🎯📜♟️⛓️🕹️🈶✒️🪙]$/.test(a.icon)) cls += ' medal-epic';
        m.className = cls;
        m.title = got ? `Медаль получена: «${a.name}» — ${a.hint}` : `Ещё не получена. Как получить: ${a.hint}`;

        // Медальон: круглая «монета» с лентой
        const pendant = document.createElement('div');
        pendant.className = 'medal-pendant';
        const ribbon = document.createElement('div');
        ribbon.className = 'medal-ribbon';
        const coin = document.createElement('div');
        coin.className = 'medal-coin';
        coin.textContent = got ? a.icon : '🔒';
        pendant.appendChild(ribbon);
        pendant.appendChild(coin);

        const nameEl = document.createElement('div');
        nameEl.className = 'medal-name';
        nameEl.textContent = a.name;

        const hintEl = document.createElement('div');
        hintEl.className = 'medal-hint';
        hintEl.textContent = a.hint;

        const statusEl = document.createElement('div');
        statusEl.className = 'medal-status';
        statusEl.textContent = got ? '✔ получена' : 'не получена';

        m.appendChild(pendant);
        m.appendChild(nameEl);
        m.appendChild(hintEl);
        m.appendChild(statusEl);
        grid.appendChild(m);
      });
      section.appendChild(grid);
      list.appendChild(section);
    });

    const info = document.getElementById('games-progress-info');
    if (info) {
      const total = this.CATALOG.reduce((n, g) => n + g.achievements.length, 0);
      const got = this.totalUnlocked();
      info.textContent = `Получено медалей: ${got} из ${total}` +
        (this.progress.savedAt
          ? ` · последний экспорт: ${new Date(this.progress.savedAt).toLocaleString('ru-RU')}`
          : '');
    }
  },

  updateProgressInfo() {
    const info = document.getElementById('games-progress-info');
    if (!info) return;
    const total = this.CATALOG.reduce((n, g) => n + g.achievements.length, 0);
    info.textContent = `Получено медалей: ${this.totalUnlocked()} из ${total}`;
  },

  // ---------- Экспорт / импорт прогресса ----------

  saveToFile() {
    this.progress.savedAt = Date.now();
    this.persist();
    this.renderShowcase();

    const blob = new Blob([JSON.stringify(this.progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    a.href = url;
    a.download = `red-book-progress-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast('💾 Прогресс с медалями сохранён в файл');
  },

  promptLoadFile() {
    const input = document.getElementById('progress-file-input');
    if (input) input.click();
  },

  importFromFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // можно импортировать один и тот же файл повторно
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // защита от гигантских файлов
    if (file.size > MAX_SIZE) {
      alert('Файл слишком большой (максимум 5 МБ).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const clean = this.sanitize(data);
        const hadAny = data && typeof data === 'object' && data.unlocked &&
                       typeof data.unlocked === 'object';
        const incoming = Object.values(clean.unlocked)
          .reduce((n, arr) => n + arr.length, 0);
        if (!hadAny || incoming === 0) {
          alert('В файле нет корректных достижений. Ожидается JSON, ранее сохранённый кнопкой «Сохранить».');
          return;
        }
        // Объединяем: медали из файла добавляются к текущим, ничего не теряется
        this.progress = clean;
        this.persist();
        this.renderShowcase();
        this.toast(`📂 Загружено медалей: ${incoming}`);
      } catch (e) {
        alert('Не удалось прочитать файл: повреждённый JSON.');
      }
    };
    reader.onerror = () => alert('Ошибка чтения файла.');
    reader.readAsText(file);
  },

  toast(msg) {
    // Простой самодостаточный тост (не зависит от API App)
    try {
      let el = document.getElementById('ach-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'ach-toast';
        el.className = 'ach-toast';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.classList.add('visible');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
    } catch (e) { /* noop */ }
    console.info(msg);
  }
};

document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  Achievements.init();
}, 100));
