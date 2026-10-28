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

  // Порядок обхода игр для кнопки «Следующая игра →»
  GAMES_ORDER: ['quiz', 'match', 'memo', 'erudite', 'latin'],

  CATALOG: [
    { game: 'quiz', title: 'Викторина', icon: '🎲', openBtn: 'btn-quiz', achievements: [
      { id: 'perfect',   icon: '🏆', name: 'Настоящий биолог',        hint: '90%+ верных ответов' },
      { id: 'good',      icon: '🌿', name: 'Хороший результат',       hint: '60%+ верных ответов' },
      { id: 'first_win', icon: '📖', name: 'Первое завершение',       hint: 'Пройти викторину до конца' }
    ]},
    { game: 'match', title: 'Найди пару', icon: '🧩', openBtn: 'btn-match', achievements: [
      { id: 'flawless',  icon: '👑', name: 'Без единой ошибки',       hint: 'Полная победа без ошибок' },
      { id: 'eagle',     icon: '🏆', name: 'Орлиный глаз',            hint: 'Победа с ≤3 ошибками' },
      { id: 'naturalist',icon: '🌟', name: 'Внимательный натуралист', hint: 'Победа с ≤6 ошибками' },
      { id: 'persistent',icon: '🌱', name: 'Упорство и труд',         hint: 'Собрать все пары' }
    ]},
    { game: 'memo', title: 'Мемо', icon: '🃏', openBtn: 'btn-memo', achievements: [
      { id: 'photo',     icon: '👑', name: 'Фотографическая память',  hint: 'Победа за ≤14 ходов' },
      { id: 'expert',    icon: '🏆', name: 'Знаток Красной книги',    hint: 'Победа за ≤20 ходов' },
      { id: 'attentive', icon: '🌟', name: 'Внимательный натуралист', hint: 'Победа за ≤30 ходов' },
      { id: 'firststep', icon: '🌱', name: 'Первый шаг в науке',      hint: 'Выиграть партию мемо' }
    ]},
    { game: 'erudite', title: 'Эрудит', icon: '🦉', openBtn: 'btn-erudite', achievements: [
      { id: 'linguist',  icon: '👑', name: 'Лингвист Красной книги',  hint: 'Все слова + серия 4+' },
      { id: 'ortho',     icon: '🏆', name: 'Знаток орфографии',       hint: '9 из 10 слов' },
      { id: 'philologist',icon:'🌟', name: 'Начинающий филолог',      hint: 'Решить половину слов' },
      { id: 'letters',   icon: '🌱', name: 'Первые буквы',            hint: 'Завершить игру' }
    ]},
    { game: 'latin', title: 'Латынь', icon: '🏛️', openBtn: 'btn-latin', achievements: [
      { id: 'keeper',    icon: '👑', name: 'Хранитель латыни',        hint: 'Ни одной ошибки за игру' },
      { id: 'linguist',  icon: '🔥', name: 'Лингвист-натуралист',     hint: '2 идеальных раунда' },
      { id: 'translator',icon: '🏆', name: 'Точный переводчик',       hint: 'Победа с ≤3 ошибками' },
      { id: 'student',   icon: '🎓', name: 'Ученик систематика',      hint: 'Пройти все раунды' }
    ]}
  ],

  progress: null,

  init() {
    this.load();

    const btnGames = document.getElementById('btn-games');
    if (btnGames) btnGames.addEventListener('click', () => this.enterGamesMode());
    // Выход из режима «Игры» — через обычные переключатели режимов сверху
    const btnGuest = document.getElementById('btn-guest');
    if (btnGuest) btnGuest.addEventListener('click', () => this.exitGamesMode());
    const btnDev = document.getElementById('btn-developer');
    if (btnDev) btnDev.addEventListener('click', () => this.exitGamesMode());
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
  },

  // Строгая проверка структуры перед записью в DOM/href (защита от битого файла)
  sanitize(obj) {
    const p = this.defaultProgress();
    if (!obj || typeof obj !== 'object') return p;
    if (typeof obj.savedAt === 'number' && Number.isFinite(obj.savedAt)) p.savedAt = obj.savedAt;
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
    }
    return isNew;
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
    if (this.gamesModeActive) return;
    this.gamesModeActive = true;
    document.body.classList.add('games-mode');
    this.setModeButtons();

    // КАРТА ОСТАЁТСЯ ВИДИМОЙ — витрина медалей лежит ПОВЕРХ неё
    // (position:absolute внутри #map-container), поэтому медали видно сразу.
    const showcase = document.getElementById('games-showcase');
    if (showcase) showcase.classList.remove('hidden');

    // Прячем все секции карты на панели: остаётся только сетка режимов 2×2
    // + выбор игр + прогресс. Кнопки «Гость», «Разработчик» и «Игры» НЕ трогаем.
    const hideSelectors = [
      '#sidebar-title',
      '#sidebar > h2:not(#games-menu h2)', '#map-switcher', '#status-layers', '#layers',
      '#btn-open-list', '.toggle-grid', '#developer-tools',
      '.actions-row', '#stats-panel'
    ];
    hideSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { el.classList.add('hidden'); });
    });

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

    // Возвращаем секции панели (скрыватель — класс .hidden, его снимаем
    // только с тех элементов, которые скрыли мы; devTools управляется App.setMode)
    const restoreSelectors = [
      '#sidebar-title',
      '#sidebar > h2:not(#games-menu h2)', '#map-switcher', '#status-layers',
      '#layers', '#btn-open-list', '.toggle-grid',
      '.actions-row', '#stats-panel'
    ];
    restoreSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { el.classList.remove('hidden'); });
    });
    const devTools = document.getElementById('developer-tools');
    if (devTools && !App.developerMode) devTools.classList.remove('hidden');

    const gamesMenu = document.getElementById('games-menu');
    if (gamesMenu) {
      gamesMenu.removeAttribute('data-active');
      gamesMenu.classList.add('hidden');
    }

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

  renderShowcase() {
    const list = document.getElementById('medals-list');
    if (!list) return;
    list.innerHTML = '';

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
        m.className = 'medal' + (got ? '' : ' locked');
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
