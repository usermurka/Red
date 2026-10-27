// Игра «Эрудит»: собери название вида из перемешанных букв по картинке
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
  HINTS: {                  // система подсказок и их цены в баллах
    firstLetter: { cost: 5,  label: 'Первая буква' },
    vowels:      { cost: 8,  label: 'Все гласные' },
    shuffle:     { cost: 4,  label: 'Перемешать' },
    revealOne:   { cost: 12, label: 'Открыть букву' },
  },

  init() {
    document.getElementById('btn-erudite').addEventListener('click', () => this.open());
    document.getElementById('erudite-close').addEventListener('click', () => this.close());
    document.getElementById('erudite-restart').addEventListener('click', () => this.startGame());
    document.getElementById('erudite-restart-btn').addEventListener('click', () => this.startGame());
    document.getElementById('erudite-backspace').addEventListener('click', () => this.undoLast());
    document.getElementById('erudite-skip').addEventListener('click', () => this.skipWord());

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
      if (e.key === ' ') { e.preventDefault(); this.placeSpace(); return; }
      const ch = (e.key || '').toLocaleLowerCase('ru-RU');
      if (/^[а-яё]$/.test(ch)) this.tryPlaceLetter(ch);
    });
  },

  open() {
    document.getElementById('erudite-modal').classList.remove('hidden');
    document.getElementById('app').style.pointerEvents = 'none';
    this.startGame();
  },

  close() {
    document.getElementById('erudite-modal').classList.add('hidden');
    document.getElementById('app').style.pointerEvents = '';
  },

  startGame() {
    document.getElementById('erudite-end-screen').classList.add('hidden');
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
    this.placed = []; // [{letter|null, trayIndex|null}] — null означает пробел
    this.locked = false;
    this.checked = false;
    this.hintsUsed = {};       // какие подсказки уже куплены в этом раунде
    this.revealedSlots = new Set(); // слоты, открытые подсказкой (зафиксированы)

    document.getElementById('erudite-round').textContent = this.round + 1;
    document.getElementById('erudite-hint').textContent = '';

    const img = document.getElementById('erudite-img');
    img.src = `img/species/${item.speciesId}.png`;
    img.alt = 'Описание скрыто — угадай вид!'; // не подсвечиваем название заранее

    this.buildTray(item.word);
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

  buildTray(word) {
    const letters = Array.from(word).filter(ch => ch !== ' ');
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
      btn.dataset.index = idx;
      btn.addEventListener('click', () => this.onTileClick(idx));
      trayEl.appendChild(btn);
    });
  },

  // Позиция следующего слота, который нужно заполнить (пропуская зафиксированные/пробелы)
  nextFreeSlot() {
    const word = this.current.word;
    for (let i = 0; i < word.length; i++) {
      if (word[i] === ' ') continue;               // пробел заполняется автоматически
      if (this.revealedSlots.has(i)) continue;     // открыт подсказкой
      if (!this.placed[i]) return i;
    }
    return -1;
  },

  onTileClick(trayIndex) {
    if (this.locked) return;
    const tile = this.tray[trayIndex];
    if (!tile || tile.used) return;
    const slotIdx = this.nextFreeSlot();
    if (slotIdx === -1) return;
    tile.used = true;
    this.placed[slotIdx] = { letter: tile.letter, trayIndex };
    this.renderTray();
    this.renderSlots();
    if (this.isComplete()) this.checkWord();
  },

  tryPlaceLetter(ch) {
    if (this.locked) return;
    const idx = this.tray.findIndex(t => !t.used && t.letter === ch);
    if (idx !== -1) this.onTileClick(idx);
  },

  placeSpace() {
    // Пробел в слове расставляется автоматически — кнопка/клавиша ничего не делают
  },

  undoLast() {
    if (this.locked) return;
    const word = this.current.word;
    for (let i = word.length - 1; i >= 0; i--) {
      const p = this.placed[i];
      if (p && !this.revealedSlots.has(i)) {
        this.tray[p.trayIndex].used = false;
        delete this.placed[i];
        this.placed.length = word.length;
        this.renderTray();
        this.renderSlots();
        return;
      }
    }
  },

  isComplete() {
    const word = this.current.word;
    for (let i = 0; i < word.length; i++) {
      if (word[i] === ' ') continue;
      // Слот считается заполненным, если в нём стоит буква игрока ИЛИ он открыт подсказкой
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

  renderSlots() {
    const slotsEl = document.getElementById('erudite-slots');
    slotsEl.innerHTML = '';
    const word = this.current.word;
    for (let i = 0; i < word.length; i++) {
      const slot = document.createElement('div');
      if (word[i] === ' ') {
        slot.className = 'erudite-slot space';
        slot.setAttribute('aria-hidden', 'true');
        slotsEl.appendChild(slot);
        continue;
      }
      slot.className = 'erudite-slot';
      const revealed = this.revealedSlots.has(i);
      const placed = this.placed[i];
      if (revealed) {
        slot.textContent = word[i].toUpperCase();
        slot.classList.add('filled', 'revealed');
      } else if (placed) {
        slot.textContent = placed.letter.toUpperCase();
        slot.classList.add('filled');
        if (this.checked) {
          slot.classList.add(placed.letter === word[i] ? 'correct' : 'wrong');
        }
      } else {
        slot.classList.add('empty');
      }
      slotsEl.appendChild(slot);
    }
  },

  /* ===== Система подсказок за баллы ===== */

  renderHintButtons() {
    const hintsEl = document.getElementById('erudite-hints');
    if (!hintsEl) return;
    hintsEl.innerHTML = '';
    for (const [key, hint] of Object.entries(this.HINTS)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'erudite-hint-btn';
      btn.dataset.hint = key;
      const used = !!this.hintsUsed[key];
      const affordable = this.balance >= hint.cost;
      btn.innerHTML = `${hint.label} <span class="hint-cost">${hint.cost}🪙</span>`;
      btn.disabled = this.locked || used || !affordable;
      if (used) btn.classList.add('used');
      if (!affordable && !used) btn.classList.add('expensive');
      hintsEl.appendChild(btn);
    }
  },

  buyHint(key) {
    if (this.locked) return;
    const hint = this.HINTS[key];
    if (!hint || this.hintsUsed[key]) return;
    if (this.balance < hint.cost) {
      this.showHintMessage(`Недостаточно баллов: нужно ${hint.cost}, есть ${this.balance}. Угадывай буквами!`, 'bad');
      return;
    }
    const word = this.current.word;
    let applied = false;

    switch (key) {
      case 'firstLetter': {
        // Первая буква каждого слова
        for (let i = 0; i < word.length; i++) {
          if (word[i] !== ' ' && (i === 0 || word[i - 1] === ' ')) this.revealSlot(i);
        }
        applied = true;
        break;
      }
      case 'vowels': {
        const vowels = 'а е ё и о у ы э ю я'.split(' '); // гласные, ё явным токеном U+0451
        for (let i = 0; i < word.length; i++) {
          if (vowels.includes(word[i])) this.revealSlot(i);
        }
        applied = true;
        break;
      }
      case 'shuffle': {
        const free = this.tray.filter(t => !t.used);
        const letters = this.shuffle(free.map(t => t.letter));
        let k = 0;
        this.tray = this.tray.map(t => (t.used ? t : { ...t, letter: letters[k++] }));
        this.renderTray();
        applied = true;
        break;
      }
      case 'revealOne': {
        // Открыть одну неизвестную букву в случайной свободной позиции
        const candidates = [];
        for (let i = 0; i < word.length; i++) {
          if (word[i] !== ' ' && !this.revealedSlots.has(i) && !this.placed[i]) candidates.push(i);
        }
        if (!candidates.length) { this.showHintMessage('Все буквы уже на месте!', 'bad'); return; }
        this.revealSlot(candidates[Math.floor(Math.random() * candidates.length)]);
        applied = true;
        break;
      }
    }

    if (!applied) return;
    this.hintsUsed[key] = true;
    this.balance -= hint.cost;
    this.updateStats();
    this.renderHintButtons();
    if (this.isComplete()) this.checkWord();
  },

  revealSlot(i) {
    const word = this.current.word;
    if (word[i] === ' ' || this.revealedSlots.has(i)) return;
    // Если буква уже стояла игроком — освободим плитку
    const p = this.placed[i];
    if (p) {
      this.tray[p.trayIndex].used = false;
      delete this.placed[i];
    }
    this.revealedSlots.add(i);
    // Забираем из лотка плитку с такой же буквой, если она ещё свободна:
    // открытая подсказкой буква не должна оставаться в наборе.
    const dupIdx = this.tray.findIndex(t => !t.used && t.letter === word[i]);
    if (dupIdx !== -1) {
      this.tray[dupIdx].used = true;
      this.tray[dupIdx].revealedFor = i; // привязка к слоту — для возврата при откате
    }
    this.renderTray();
    this.renderSlots();
  },

  // Возврат «конфискованной» плитки в лоток, если слот перестал быть открытым
  restoreTrayForSlot(i) {
    const idx = this.tray.findIndex(t => t.used && t.revealedFor === i);
    if (idx !== -1) {
      this.tray[idx].used = false;
      delete this.tray[idx].revealedFor;
    }
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

    const word = this.current.word;
    let guess = '';
    for (let i = 0; i < word.length; i++) {
      if (word[i] === ' ') { guess += ' '; continue; }
      if (this.revealedSlots.has(i)) { guess += word[i]; continue; }
      guess += this.placed[i] ? this.placed[i].letter : '';
    }
    const correct = guess === word;

    // Буквы игрока на верных местах (открытые подсказкой не считаются — за них уже заплачено)
    let rightOnPosition = 0;
    for (let i = 0; i < word.length; i++) {
      if (word[i] === ' ' || this.revealedSlots.has(i)) continue;
      const p = this.placed[i];
      if (p && p.letter === word[i]) rightOnPosition++;
    }

    if (correct) {
      // Банк пополняется: буквы × множитель за длину + бонус + серия
      const letters = this.lettersCount(word);
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
      this.showHintMessage(`Ошибка. Правильное слово: «${word.toUpperCase()}» (${this.current.name})${partialInfo}`, 'bad');
    }
    this.updateStats();
    this.renderHintButtons();

    setTimeout(() => {
      const hintEl = document.getElementById('erudite-hint');
      hintEl.classList.remove('good', 'bad');
      this.checked = false;
      this.round++;
      this.nextRound();
    }, 2200);
  },

  skipWord() {
    if (this.locked) return;
    this.locked = true;
    this.streak = 0;
    this.showHintMessage(`Пропущено: «${this.current.word.toUpperCase()}» (${this.current.name})`, 'bad');
    this.updateStats();
    this.renderHintButtons();
    setTimeout(() => {
      this.checked = false;
      this.round++;
      this.nextRound();
    }, 1500);
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
    } else if (this.solvedCount >= this.queue.length - 1) {
      titleEl.textContent = '🏆 Отличный результат!';
      achieveEl.textContent = 'Достижение получено: «Знаток орфографии»';
    } else if (this.solvedCount >= Math.ceil(this.queue.length / 2)) {
      titleEl.textContent = '🌟 Хорошая работа!';
      achieveEl.textContent = 'Достижение получено: «Начинающий филолог»';
    } else {
      titleEl.textContent = '🌱 Тренируйся ещё!';
      achieveEl.textContent = 'Достижение получено: «Первые буквы»';
    }
    document.getElementById('erudite-end-screen').classList.remove('hidden');
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
    console.warn('EruditeGame: App не загружен — игра не запущена.');
    return;
  }
  EruditeGame.init();
}, 200));
