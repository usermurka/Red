// Игра «Эрудит»: собери название вида из перемешанных букв по картинке
//
// Доработки по замечаниям игрока:
//  • Название из двух слов теперь группируется: слоты собраны в
//    блоки-слова («красный» и «коршун» — два отдельных блока).
//  • Фото: при отсутствии файла показываем текстовый плейсхолдер,
//    картинка больше не «пропадает» (битая иконка вместо фото).
//  • Кнопка «Дальше →» ВСЕГДА на месте (окно не прыгает): до конца
//    раунда она бледная и неактивная, а в конце раунда становится
//    активной и занимает место кнопки «Пропустить слово» (⏭) —
//    пропускать собранное/проверенное слово уже не нужно.
//  • Подсказка «Открыть букву» — МНОГОРАЗОВАЯ: пока в слотах есть
//    незаполненные клетки, кнопка остаётся доступной; каждое
//    нажатие открывает ещё одну букву за 12🪙 (цена фиксирована).
//  • Цены подсказок динамические и зависят от длины слова:
//      - «Первые буквы» — 5 монет за букву (2 слова = 10 монет);
//      - «Все гласные» — 3 монеты за каждую гласную;
//      - «Открыть букву» — 12 монет (одна буква);
//      - «Перемешать» — 4 монеты.
//    Если часть букв уже открыта ранее — кнопка показывает доплату
//    («+N🪙») и списывает только разницу с уже уплаченным.
//  • Буквы можно перетаскивать на ЛЮБУЮ позицию (drag&drop), а не
//    только набирать по порядку; клик по букве — резервный способ.
const EruditeGame = {
  ROUNDS: 10,
  MIN_WORD_LEN: 4,          // длина слова без учёта пробелов
  MAX_WORD_LEN: 16,         // общая длина с пробелом между словами
  START_BALANCE: 10,        // стартовый банк баллов
  BASE_LETTER_REWARD: 2,    // базовых баллов за каждую верно угаданную букву
  LONG_WORD_STEP: 6,        // за каждые полных 6 букв слова — множитель сложности +1
  LONG_WORD_MAX_MULT: 3,    // потолок множителя за длину
  WORD_BONUS: 5,            // бонус за собранное слово целиком
  STREAK_BONUS: 3,          // доп. бонус за серию (умножается на серию)
  PARTIAL_LETTER_REWARD: 1, // баллов за каждую букву на верном месте (слово не собрано)
  // Базовые цены подсказок (пересчитываются под конкретное слово)
  HINT_PRICES: {
    firstLetter: 5,   // за каждую первую букву слова
    vowels: 3,        // за каждую гласную букву
    shuffle: 4,       // фиксированная
    revealOne: 12,    // за одну открытую букву
  },
  VOWELS: 'аеёиоуыэюя',

  init() {
    document.getElementById('btn-erudite').addEventListener('click', () => this.open());
    document.getElementById('erudite-close').addEventListener('click', () => this.close());
    document.getElementById('erudite-restart').addEventListener('click', () => this.startGame());
    // Крестик на финальном экране — закрыть игру
    document.querySelector('#erudite-end-screen .game-close-x')?.addEventListener('click', () => this.close());
    document.getElementById('erudite-restart-btn').addEventListener('click', () => this.startGame());
    document.getElementById('erudite-backspace').addEventListener('click', () => this.undoLast());
    document.getElementById('erudite-skip').addEventListener('click', () => this.skipWord());
    // Переход к следующему раунду — ТОЛЬКО по явной кнопке.
    const nextBtn = document.getElementById('erudite-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => this.advanceRound());

    // Кнопки подсказок (делегирование — один слушатель вместо N)
    const hintsEl = document.getElementById('erudite-hints');
    if (hintsEl) {
      hintsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.erudite-hint-btn');
        if (!btn || btn.disabled) return;
        this.buyHint(btn.dataset.hint);
      });
    }

    // Поддержка аппаратной клавиатуры (Desktop / Android)
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('erudite-modal');
      if (!modal || modal.classList.contains('hidden')) return;
      if (e.key === 'Backspace') { e.preventDefault(); this.undoLast(); return; }
      if (e.key === 'Enter') { e.preventDefault(); this.checkWord(); return; }
      const ch = (e.key || '').toLocaleLowerCase('ru-RU');
      if (/^[а-яё]$/.test(ch)) this.tryPlaceLetter(ch);
    });
  },

  open() {
    document.getElementById('erudite-modal').classList.remove('hidden');
    document.getElementById('app').style.pointerEvents = 'none';
    document.getElementById('erudite-modal').style.pointerEvents = 'auto';
    this.startGame();
  },

  close() {
    document.getElementById('erudite-modal').classList.add('hidden');
    document.getElementById('app').style.pointerEvents = '';
  },

  startGame() {
    document.getElementById('erudite-end-screen').classList.add('hidden');
    this.hideNextBtn();
    this.round = 0;
    this.score = 0;          // итоговые очки (не тратятся)
    this.balance = this.START_BALANCE; // банк баллов для подсказок
    this.streak = 0;
    this.bestStreak = 0;
    this.solvedCount = 0;
    document.getElementById('erudite-total').textContent = this.ROUNDS;

    const all = App.collectAllSpecies().filter(sp => sp && sp.id && sp.name);
    const usable = all.filter(sp => {
      const w = this.normalizeWord(sp.name);
      const lettersOnly = w.replace(/ /g, '');
      return lettersOnly.length >= this.MIN_WORD_LEN && w.length <= this.MAX_WORD_LEN;
    });
    if (usable.length < this.ROUNDS) {
      alert(`Недостаточно коротких названий для игры (нужно минимум ${this.ROUNDS}).`);
      return;
    }
    // Уникальные слова на раунды
    const seen = new Set();
    this.queue = [];
    const shuffled = this.shuffle(usable);
    for (const sp of shuffled) {
      const w = this.normalizeWord(sp.name);
      if (seen.has(w)) continue;
      seen.add(w);
      this.queue.push({ speciesId: sp.id, name: sp.name, word: w });
      if (this.queue.length >= this.ROUNDS) break;
    }
    this.updateStats();
    this.nextRound();
  },

  nextRound() {
    if (this.round >= this.queue.length) { this.finishGame(); return; }
    const item = this.queue[this.round];
    this.current = item;
    // Индексы букв слова (позиция в массиве == позиция в слове)
    this.letters = Array.from(item.word);
    // Слово разбивается на блоки по пробелам: название из двух слов
    // визуально группируется под соответствующими словами.
    this.words = item.word.split(' ').filter(Boolean);
    this.placed = new Array(this.letters.length).fill(null); // {letter, trayIndex}
    this.locked = false;
    this.checked = false;
    this.hintPaid = {};      // сколько уже заплачено за подсказку в этом раунде
    this.revealedSlots = new Set(); // слоты, открытые подсказкой (зафиксированы)

    document.getElementById('erudite-round').textContent = this.round + 1;
    document.getElementById('erudite-hint').textContent = '';

    const img = document.getElementById('erudite-img');
    img.classList.remove('hidden');
    // Убираем «заглушку» прошлого раунда, иначе новое фото не покажется
    const picBox = img.parentElement;
    if (picBox) picBox.classList.remove('has-placeholder');
    picBox?.querySelector('.erudite-img-ph')?.remove();
    img.src = `img/species/${item.speciesId}.png`;
    img.alt = 'Описание скрыто — угадай вид!'; // не подсвечиваем название заранее
    if (!img.dataset.phBound) {
      img.dataset.phBound = '1';
      // Файла фото нет — вместо битой картинки показываем плейсхолдер,
      // иначе игроку кажется, что «изображение пропало».
      img.addEventListener('error', () => this.showPicturePlaceholder());
    }

    this.buildTray();
    this.renderSlots();
    this.renderHintButtons();
    // Начало раунда: «Дальше →» на месте, но бледная/неактивная,
    // а «Пропустить слово» — активна (раунд ещё не закончен).
    this.setNextBtnIdle(true);
    this.updateStats();
  },

  // Текстовая заглушка вместо отсутствующего файла фото.
  // Показываем её классом на контейнере (см. css/erudite.css), а не
  // инлайновым style.display — иначе центрирование «съедается» и
  // кажется, что изображение пропало.
  showPicturePlaceholder() {
    const img = document.getElementById('erudite-img');
    if (!img) return;
    const box = img.parentElement;
    if (!box) return;
    let ph = box.querySelector('.erudite-img-ph');
    if (!ph) {
      ph = document.createElement('div');
      ph.className = 'erudite-img-ph';
      ph.textContent = 'Фото недоступно';
      box.appendChild(ph);
    }
    box.classList.add('has-placeholder');
  },

  normalizeWord(name) {
    // Отсекаем всё в скобках (латинские названия и примечания), затем нормализуем.
    // Пробел между словами сохраняется: «красный коршун» -> «красный коршун».
    let s = String(name || '');
    s = s.replace(/\([^)]*\)/g, ' ');           // убрать содержимое (...)
    s = s.replace(/[«»"']/g, ' ');              // кавычки как разделители
    s = s.toLocaleLowerCase('ru-RU');
    s = s.replace(/[^а-яёa-z ]/gi, ' ');        // только русские буквы, латиница и пробелы (без учёта регистра)
    s = s.replace(/\s+/g, ' ').trim();
    // Латиницу внутри оставшегося текста вырезаем (напр. «Canis lupus» без скобок)
    s = s.replace(/[a-z]+/gi, '').replace(/\s+/g, ' ').trim();
    return s;
  },

  buildTray() {
    const letters = this.letters.filter(ch => ch !== ' ');
    this.tray = this.shuffle(letters.map((ch, i) => ({ letter: ch, used: false, origIndex: i })));
    this.renderTray();
  },

  renderTray() {
    const trayEl = document.getElementById('erudite-tray');
    trayEl.innerHTML = '';
    this.tray.forEach((tile, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'erudite-tile' + (tile.used ? ' used' : '');
      btn.textContent = tile.letter.toUpperCase();
      btn.disabled = !!tile.used;
      btn.draggable = !tile.used && !this.locked; // буквы можно тащить на любую позицию
      btn.dataset.index = idx;
      btn.title = 'Перетащи на нужную клетку или нажми';
      // dragstart обязателен: без setDragStart() в Firefox перетаскивание
      // не запускается вообще (буквы «не перетаскивались»).
      btn.addEventListener('dragstart', (e) => {
        if (tile.used || this.locked) { e.preventDefault(); return; }
        const id = String(idx);
        try {
          e.dataTransfer.setData('text/plain', id);
          e.dataTransfer.setData('application/x-erudite-tile', id);
          e.dataTransfer.effectAllowed = 'move';
        } catch (err) { /* noop */ }
        this._dragFromTray = idx;
        btn.classList.add('dragging');
      });
      btn.addEventListener('dragend', () => {
        btn.classList.remove('dragging');
        this._dragFromTray = null;
      });
      btn.addEventListener('click', () => this.onTileClick(idx));
      trayEl.appendChild(btn);
    });
  },

  // Первый свободный слот (для резервного клика по букве)
  nextFreeSlot() {
    for (let i = 0; i < this.letters.length; i++) {
      if (this.letters[i] === ' ') continue;
      if (this.revealedSlots.has(i)) continue;
      if (!this.placed[i]) return i;
    }
    return -1;
  },

  // Поместить плитку в конкретный слот (или переставить уже стоящую букву)
  placeAt(trayIndex, slotIdx) {
    if (this.locked) return false;
    const tile = this.tray[trayIndex];
    if (!tile || tile.used) return false;
    if (slotIdx < 0 || slotIdx >= this.letters.length) return false;
    if (this.letters[slotIdx] === ' ' || this.revealedSlots.has(slotIdx)) return false;
    const prev = this.placed[slotIdx];
    if (prev) {                       // слот занят — возвращаем прежнюю букву в лоток
      this.tray[prev.trayIndex].used = false;
    }
    tile.used = true;
    this.placed[slotIdx] = { letter: tile.letter, trayIndex };
    this.renderTray();
    this.renderSlots();
    if (this.isComplete()) this.checkWord();
    return true;
  },

  onTileClick(trayIndex) {
    if (this.locked) return;
    const slotIdx = this.nextFreeSlot();
    if (slotIdx === -1) return;
    this.placeAt(trayIndex, slotIdx);
  },

  tryPlaceLetter(ch) {
    if (this.locked) return;
    const idx = this.tray.findIndex(t => !t.used && t.letter === ch);
    if (idx !== -1) this.onTileClick(idx);
  },

  undoLast() {
    if (this.locked) return;
    for (let i = this.letters.length - 1; i >= 0; i--) {
      const p = this.placed[i];
      if (p && !this.revealedSlots.has(i)) {
        this.tray[p.trayIndex].used = false;
        this.placed[i] = null;
        this.renderTray();
        this.renderSlots();
        return;
      }
    }
  },

  isComplete() {
    for (let i = 0; i < this.letters.length; i++) {
      if (this.letters[i] === ' ') continue;
      if (!this.placed[i] && !this.revealedSlots.has(i)) return false;
    }
    return true;
  },

  // Число букв слова (без пробелов)
  lettersCount(word) {
    return Array.from(word).filter(ch => ch !== ' ').length;
  },

  // Множитель сложности за длину: 1x до 6 букв, 2x до 12, максимум 3x
  lengthMultiplier(letters) {
    return Math.min(1 + Math.floor(letters / this.LONG_WORD_STEP), this.LONG_WORD_MAX_MULT);
  },

  // ---------- Рендер слотов: буквы grouped по словам ----------
  renderSlots() {
    const slotsEl = document.getElementById('erudite-slots');
    slotsEl.innerHTML = '';
    let pos = 0; // абсолютная позиция буквы в слове (для placed/revealed)
    this.words.forEach((w) => {
      const group = document.createElement('div');
      group.className = 'erudite-word-group';
      for (let k = 0; k < w.length; k++) {
        const i = pos++;
        const slot = document.createElement('div');
        slot.className = 'erudite-slot';
        slot.dataset.slot = i;
        const revealed = this.revealedSlots.has(i);
        const placed = this.placed[i];
        if (revealed) {
          slot.textContent = w[k].toUpperCase();
          slot.classList.add('filled', 'revealed');
        } else if (placed) {
          slot.textContent = placed.letter.toUpperCase();
          slot.classList.add('filled');
          if (this.checked) {
            slot.classList.add(placed.letter === w[k] ? 'correct' : 'wrong');
          }
        } else {
          slot.classList.add('empty');
        }
        this.attachSlotDnD(slot, i);
        group.appendChild(slot);
      }
      slotsEl.appendChild(group);
      pos++; // пропущенный пробел между словами
    });
  },

  attachSlotDnD(slot, i) {
    if (this.locked) return;
    const canDrag = !this.revealedSlots.has(i);
    if (canDrag) slot.draggable = true; // уже поставленную букву можно тащить дальше
    // Тащим плитку из лотка или букву из другого слота — drop: ставим в этот слот
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* noop */ }
      slot.classList.add('drop-hover');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-hover'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drop-hover');
      let raw = '';
      try {
        raw = e.dataTransfer.getData('application/x-erudite-tile')
           || e.dataTransfer.getData('text/plain');
      } catch (err) { /* noop */ }
      const ti = parseInt(raw, 10);
      if (!Number.isNaN(ti)) { this.placeAt(ti, i); return; }
      // Перестановка буквы из другого слота
      let fromSlot = null;
      try { fromSlot = e.dataTransfer.getData('text/slot'); } catch (err) { /* noop */ }
      if (fromSlot === null || fromSlot === '') fromSlot = this._dragFromSlot;
      const fi = parseInt(fromSlot, 10);
      if (!Number.isNaN(fi)) this.moveSlotToSlot(fi, i);
    });
    // Тащим уже поставленную букву — переставляем/возвращаем в лоток
    slot.addEventListener('dragstart', (e) => {
      const p = this.placed[i];
      if (!p || this.revealedSlots.has(i)) { e.preventDefault(); return; }
      this._dragFromSlot = i;
      try {
        e.dataTransfer.setData('text/slot', String(i));
        e.dataTransfer.effectAllowed = 'move';
      } catch (err) { /* noop */ }
      slot.classList.add('dragging');
    });
    slot.addEventListener('dragend', () => {
      slot.classList.remove('dragging');
      this._dragFromSlot = null;
    });
    // Клик по занятому слоту — снять букву обратно в лоток
    slot.addEventListener('click', () => {
      if (this.locked) return;
      const p = this.placed[i];
      if (p && !this.revealedSlots.has(i)) {
        this.tray[p.trayIndex].used = false;
        this.placed[i] = null;
        this.renderTray();
        this.renderSlots();
      }
    });
  },

  // Перенести букву из одного слота в другой (освободив прежнюю клетку)
  moveSlotToSlot(fromIdx, toIdx) {
    if (this.locked) return false;
    if (fromIdx === toIdx) return false;
    const p = this.placed[fromIdx];
    if (!p || this.revealedSlots.has(fromIdx)) return false;
    if (this.letters[toIdx] === ' ' || this.revealedSlots.has(toIdx)) return false;
    this.placed[fromIdx] = null;
    const prev = this.placed[toIdx];
    if (prev) this.tray[prev.trayIndex].used = false; // прежнюю букву — в лоток
    this.placed[toIdx] = p;
    this.renderTray();
    this.renderSlots();
    if (this.isComplete()) this.checkWord();
    return true;
  },

  /* ===== Система подсказок за баллы (цены зависят от слова) ===== */

  // Абсолютные индексы первых букв каждого слова
  firstLetterIndices() {
    const res = [];
    let pos = 0;
    this.words.forEach(w => { res.push(pos); pos += w.length + 1; });
    return res;
  },

  vowelIndices() {
    const res = [];
    for (let i = 0; i < this.letters.length; i++) {
      const ch = this.letters[i];
      if (ch !== ' ' && this.VOWELS.includes(ch)) res.push(i);
    }
    return res;
  },

  // Сколько букв реально откроет подсказка при текущем состоянии слотов
  hintUnits(key) {
    switch (key) {
      case 'firstLetter':
        return this.firstLetterIndices().filter(i => !this.revealedSlots.has(i)).length;
      case 'vowels':
        return this.vowelIndices().filter(i => !this.revealedSlots.has(i)).length;
      case 'revealOne': {
        let free = 0;
        for (let i = 0; i < this.letters.length; i++) {
          if (this.letters[i] !== ' ' && !this.revealedSlots.has(i) && !this.placed[i]) free++;
        }
        return free;
      }
      default:
        return 1; // «Перемешать» — фиксированная цена за действие
    }
  },

  // Цена подсказки с учётом уже открытых букв: платим только за новые.
  // «Открыть букву» — многоразовая: пока есть что открывать, цена
  // всегда 12🪙 за следующее нажатие.
  hintCost(key) {
    const P = this.HINT_PRICES;
    switch (key) {
      case 'firstLetter': return this.hintUnits('firstLetter') * P.firstLetter;
      case 'vowels':      return this.hintUnits('vowels') * P.vowels;
      case 'shuffle':     return P.shuffle;
      case 'revealOne':   return this.hintUnits('revealOne') > 0 ? P.revealOne : 0;
      default:            return Infinity;
    }
  },

  hintLabel(key) {
    switch (key) {
      case 'firstLetter': return 'Первые буквы';
      case 'vowels': return 'Все гласные';
      case 'shuffle': return 'Перемешать';
      case 'revealOne': return 'Открыть букву';
      default: return key;
    }
  },

  // Подпись цены на кнопке: для многоразовой подсказки — полная цена,
  // для «пакетных» — доплата, если часть букв уже открыта ранее.
  hintPriceText(key, cost, paid, extra) {
    if (key === 'revealOne') return `${cost}🪙`;
    if (paid > 0 && extra > 0) return `+${extra}🪙`;
    return `${cost}🪙`;
  },

  renderHintButtons() {
    const hintsEl = document.getElementById('erudite-hints');
    if (!hintsEl) return;
    hintsEl.innerHTML = '';
    for (const key of Object.keys(this.HINT_PRICES)) {
      const cost = this.hintCost(key);
      const paid = this.hintPaid[key] || 0;
      const extra = Math.max(0, cost - paid); // доплата, если часть букв уже открыта
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'erudite-hint-btn';
      btn.dataset.hint = key;
      const affordable = this.balance >= extra;
      // «Открыть букву» и «Перемешать» — многоразовые: не «сгорают»
      const reusable = key === 'revealOne' || key === 'shuffle';
      const nothingLeft = cost === 0 && !reusable;
      btn.innerHTML = `${this.hintLabel(key)} <span class="hint-cost">${this.hintPriceText(key, cost, paid, extra)}</span>`;
      btn.disabled = this.locked || !affordable || nothingLeft;
      if (nothingLeft) btn.classList.add('used');
      if (!affordable && !nothingLeft) btn.classList.add('expensive');
      if (reusable) btn.classList.add('repeatable');
      hintsEl.appendChild(btn);
    }
  },

  buyHint(key) {
    if (this.locked) return;
    const cost = this.hintCost(key);
    const paid = this.hintPaid[key] || 0;
    const extra = Math.max(0, cost - paid);
    if (key !== 'shuffle' && cost === 0) {
      this.showHintMessage('Здесь открывать уже нечего!', 'bad');
      return;
    }
    if (this.balance < extra) {
      this.showHintMessage(`Недостаточно баллов: нужно ${extra}, есть ${this.balance}. Угадывай буквами!`, 'bad');
      return;
    }

    switch (key) {
      case 'firstLetter': {
        this.firstLetterIndices().forEach(i => this.revealSlot(i));
        break;
      }
      case 'vowels': {
        this.vowelIndices().forEach(i => this.revealSlot(i));
        break;
      }
      case 'shuffle': {
        const free = this.tray.filter(t => !t.used);
        if (free.length < 2) { this.showHintMessage('Перемешивать нечего!', 'bad'); return; }
        const letters = this.shuffle(free.map(t => t.letter));
        let k = 0;
        this.tray = this.tray.map(t => (t.used ? t : { ...t, letter: letters[k++] }));
        this.renderTray();
        break;
      }
      case 'revealOne': {
        const candidates = [];
        for (let i = 0; i < this.letters.length; i++) {
          if (this.letters[i] !== ' ' && !this.revealedSlots.has(i) && !this.placed[i]) candidates.push(i);
        }
        if (!candidates.length) { this.showHintMessage('Все буквы уже на месте!', 'bad'); return; }
        this.revealSlot(candidates[Math.floor(Math.random() * candidates.length)]);
        break;
      }
      default:
        return;
    }

    // Списываем не больше фактической стоимости новых букв.
    // Для многоразовой «Открыть букву» платим 12🪙 за каждое нажатие,
    // а не один раз за раунд.
    const charge = key === 'revealOne' ? cost : Math.min(extra, this.balance);
    this.balance -= Math.min(charge, this.balance);
    this.hintPaid[key] = key === 'revealOne' ? 0 : Math.max(paid, cost);
    if (key === 'revealOne') {
      const left = this.hintUnits('revealOne');
      this.showHintMessage(left
        ? `Открыта ещё одна буква. Осталось открытых мест: ${left}.`
        : 'Открыта последняя свободная буква.', 'good');
    }
    this.updateStats();
    this.renderHintButtons();
    if (this.isComplete()) this.checkWord();
  },

  revealSlot(i) {
    const ch = this.letters[i];
    if (ch === ' ' || this.revealedSlots.has(i)) return;
    // Если буква уже стояла игроком — освободим плитку
    const p = this.placed[i];
    if (p) {
      this.tray[p.trayIndex].used = false;
      this.placed[i] = null;
    }
    this.revealedSlots.add(i);
    // Забираем из лотка плитку с такой же буквой, если она ещё свободна:
    // открытая подсказкой буква не должна оставаться в наборе.
    const dupIdx = this.tray.findIndex(t => !t.used && t.letter === ch);
    if (dupIdx !== -1) {
      this.tray[dupIdx].used = true;
      this.tray[dupIdx].revealedFor = i; // привязка к слоту — для возврата при откате
    }
    this.renderTray();
    this.renderSlots();
  },

  showHintMessage(text, cls) {
    const hintEl = document.getElementById('erudite-hint');
    hintEl.textContent = text;
    hintEl.classList.remove('good', 'bad');
    if (cls) hintEl.classList.add(cls);
  },

  checkWord() {
    if (this.locked || !this.isComplete()) return;
    this.locked = true;
    this.checked = true;
    this.renderSlots();

    let guess = '';
    for (let i = 0; i < this.letters.length; i++) {
      const ch = this.letters[i];
      if (ch === ' ') { guess += ' '; continue; }
      if (this.revealedSlots.has(i)) { guess += ch; continue; }
      guess += this.placed[i] ? this.placed[i].letter : '';
    }
    const correct = guess === this.current.word;

    // Буквы игрока на верных местах (открытые подсказкой не считаются — за них уже заплачено)
    let rightOnPosition = 0;
    for (let i = 0; i < this.letters.length; i++) {
      const ch = this.letters[i];
      if (ch === ' ' || this.revealedSlots.has(i)) continue;
      const p = this.placed[i];
      if (p && p.letter === ch) rightOnPosition++;
    }

    if (correct) {
      // Банк пополняется: буквы × множитель за длину + бонус + серия
      const letters = this.lettersCount(this.current.word);
      const mult = this.lengthMultiplier(letters);
      const earned = letters * this.BASE_LETTER_REWARD * mult + this.WORD_BONUS
        + this.streak * this.STREAK_BONUS;
      this.balance += earned;
      this.score += earned;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.solvedCount += 1;
      const multInfo = mult > 1 ? ` (×${mult} за длину)` : '';
      const streakInfo = this.streak > 1 ? `, серия ×${this.streak}` : '';
      this.showHintMessage(`Верно! Это — ${this.current.name}. +${earned} баллов${multInfo}${streakInfo}`, 'good');
    } else {
      // Слово не собрано, но верные буквы на своих местах тоже приносят баллы
      const partial = rightOnPosition * this.PARTIAL_LETTER_REWARD;
      if (partial > 0) {
        this.balance += partial;
        this.score += partial;
      }
      this.streak = 0;
      const partialInfo = partial > 0 ? ` +${partial} баллов за ${rightOnPosition} верн. букв` : '';
      this.showHintMessage(`Ошибка. Правильное слово: «${this.current.word.toUpperCase()}» (${this.current.name})${partialInfo}`, 'bad');
    }
    this.updateStats();
    this.renderHintButtons();
    // Итог раунда остаётся на экране; переход — по кнопке «Дальше →»
    this.showNextBtn();
  },

  skipWord() {
    if (this.locked) return;
    this.locked = true;
    this.streak = 0;
    this.showHintMessage(`Пропущено: «${this.current.word.toUpperCase()}» (${this.current.name})`, 'bad');
    this.updateStats();
    this.renderHintButtons();
    this.showNextBtn();
  },

  // ---------- Переход вперёд только по кнопке ----------
  // Кнопка «Дальше →» никогда не появляется и не исчезает (иначе окно
  // «прыгает»): она всегда на месте, но до конца раунда — бледная
  // (класс is-idle) и неактивная. В конце раунда она активируется,
  // а «Пропустить слово» в это время прячется — её место занимает «Дальше».
  setNextBtnIdle(idle) {
    const btn = document.getElementById('erudite-next-btn');
    if (!btn) return;
    const skipBtn = document.getElementById('erudite-skip');
    // Все три кнопки («Убрать», «Пропустить», «Дальше») стоят в одну
    // строку: «Пропустить» не прячется — она просто отключается, когда
    // раунд завершён и нужно жать «Дальше».
    if (idle) {
      btn.classList.add('is-idle');
      btn.classList.remove('is-active');
      btn.disabled = true;
      btn.textContent = 'Дальше →';
      if (skipBtn) { skipBtn.classList.remove('hidden'); skipBtn.disabled = false; }
    } else {
      btn.classList.remove('is-idle');
      btn.classList.add('is-active');
      btn.disabled = false;
      if (skipBtn) { skipBtn.classList.add('hidden'); skipBtn.disabled = true; } // «Дальше» заменяет «Пропустить слово»
      try { btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
    }
  },

  showNextBtn() { this.setNextBtnIdle(false); },

  hideNextBtn() { this.setNextBtnIdle(true); },

  advanceRound() {
    this.setNextBtnIdle(true);
    const hintEl = document.getElementById('erudite-hint');
    hintEl.classList.remove('good', 'bad');
    hintEl.textContent = '';
    this.checked = false;
    this.round++;
    this.nextRound();
  },

  updateStats() {
    document.getElementById('erudite-score').textContent = this.score;
    document.getElementById('erudite-streak').textContent = this.streak;
    const balEl = document.getElementById('erudite-balance');
    if (balEl) balEl.textContent = this.balance;
  },

  finishGame() {
    document.getElementById('erudite-final-solved').textContent = this.solvedCount;
    document.getElementById('erudite-final-total').textContent = this.queue.length;
    document.getElementById('erudite-final-streak').textContent = this.bestStreak;
    const finalScoreEl = document.getElementById('erudite-final-score');
    if (finalScoreEl) finalScoreEl.textContent = this.score;

    const titleEl = document.getElementById('erudite-end-title');
    const achieveEl = document.getElementById('erudite-end-achieve');
    if (this.solvedCount === this.queue.length && this.bestStreak >= 4) {
      titleEl.textContent = '👑 Великий Эрудит!';
      achieveEl.textContent = 'Достижение получено: «Лингвист Красной книги»';
      this.unlockAch('linguist');
    } else if (this.solvedCount >= this.queue.length - 1) {
      titleEl.textContent = '🏆 Отличный результат!';
      achieveEl.textContent = 'Достижение получено: «Знаток орфографии»';
      this.unlockAch('ortho');
    } else if (this.solvedCount >= Math.ceil(this.queue.length / 2)) {
      titleEl.textContent = '🌟 Хорошая работа!';
      achieveEl.textContent = 'Достижение получено: «Начинающий филолог»';
      this.unlockAch('philologist');
    } else {
      titleEl.textContent = '🌱 Тренируйся ещё!';
      achieveEl.textContent = 'Достижение получено: «Первые буквы»';
    }
    this.unlockAch('letters');
    document.getElementById('erudite-end-screen').classList.remove('hidden');
  },

  // Выдача медали через общий реестр достижений (если тот загружен)
  unlockAch(achId) {
    try {
      if (typeof Achievements !== 'undefined' && Achievements.unlock) {
        Achievements.unlock('erudite', achId);
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
            EruditeGame.init();
        } catch (e) {
            console.error('EruditeGame: ошибка инициализации:', e);
        }
    };
    tryInit();
}, 200));
