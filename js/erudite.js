// Игра «Эрудит»: собери название вида из перемешанных букв по картинке
//
// Доработки по замечаниям игрока:
//  • Название из двух слов теперь группируется: слоты собраны в
//    блоки-слова («красный» и «коршун» — два отдельных блока).
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
    img.src = `img/species/${item.speciesId}.png`;
    img.alt = 'Описание скрыто — угадай вид!'; // не подсвечиваем название заранее

    this.buildTray();
    this.renderSlots();
    this.renderHintButtons();
    this.updateStats();
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
    // Тащим плитку из лотка — drop: ставим в этот слот
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('drop-hover');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-hover'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drop-hover');
      let raw = '';
      try { raw = e.dataTransfer.getData('text/plain'); } catch (err) { /* noop */ }
      const ti = parseInt(raw, 10);
      if (!Number.isNaN(ti)) this.placeAt(ti, i);
    });
    // Тащим уже поставленную букву — переставляем/возвращаем в лоток
    slot.addEventListener('dragstart', (e) => {
      const p = this.placed[i];
      if (!p || this.revealedSlots.has(i)) { e.preventDefault(); return; }
      this._dragFromSlot = i;
      try { e.dataTransfer.setData('text/slot', String(i)); } catch (err) { /* noop */ }
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

  // Цена подсказки с учётом уже открытых букв: платим только за новые.
  hintCost(key) {
    const P = this.HINT_PRICES;
    switch (key) {
      case 'firstLetter': {
        const total = this.firstLetterIndices().filter(i => !this.revealedSlots.has(i)).length;
        return total * P.firstLetter;
      }
      case 'vowels': {
        const total = this.vowelIndices().filter(i => !this.revealedSlots.has(i)).length;
        return total * P.vowels;
      }
      case 'shuffle':
        return P.shuffle;
      case 'revealOne': {
        const free = [];
        for (let i = 0; i < this.letters.length; i++) {
          if (this.letters[i] !== ' ' && !this.revealedSlots.has(i) && !this.placed[i]) free.push(i);
        }
        return free.length ? P.revealOne : 0;
      }
      default:
        return Infinity;
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
      const nothingLeft = cost === 0 && key !== 'shuffle';
      const priceTxt = (paid > 0 && extra > 0) ? `+${extra}🪙` : `${cost}🪙`;
      btn.innerHTML = `${this.hintLabel(key)} <span class="hint-cost">${priceTxt}</span>`;
      btn.disabled = this.locked || !affordable || nothingLeft;
      if (nothingLeft) btn.classList.add('used');
      if (!affordable && !nothingLeft) btn.classList.add('expensive');
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

    // Списываем не больше фактической стоимости новых букв
    this.balance -= Math.min(extra, this.balance);
    this.hintPaid[key] = Math.max(paid, cost);
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
  showNextBtn() {
    const btn = document.getElementById('erudite-next-btn');
    if (!btn) return;
    const last = this.round >= this.queue.length - 1;
    btn.textContent = last ? 'Итоги игры →' : 'Дальше →';
    btn.classList.remove('hidden');
    try { btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
  },

  hideNextBtn() {
    const btn = document.getElementById('erudite-next-btn');
    if (btn) btn.classList.add('hidden');
  },

  advanceRound() {
    this.hideNextBtn();
    const hintEl = document.getElementById('erudite-hint');
    hintEl.classList.remove('good', 'bad');
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
