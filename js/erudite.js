// Игра «Эрудит»: собери название вида из перемешанных букв по картинке
const EruditeGame = {
  ROUNDS: 5,
  MIN_WORD_LEN: 4,
  MAX_WORD_LEN: 12,

  init() {
    document.getElementById('btn-erudite').addEventListener('click', () => this.open());
    document.getElementById('erudite-close').addEventListener('click', () => this.close());
    document.getElementById('erudite-restart').addEventListener('click', () => this.startGame());
    document.getElementById('erudite-restart-btn').addEventListener('click', () => this.startGame());
    document.getElementById('erudite-backspace').addEventListener('click', () => this.undoLast());
    document.getElementById('erudite-shuffle').addEventListener('click', () => this.shuffleTray());
    document.getElementById('erudite-skip').addEventListener('click', () => this.skipWord());

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
    this.startGame();
  },

  close() {
    document.getElementById('erudite-modal').classList.add('hidden');
    document.getElementById('app').style.pointerEvents = '';
  },

  startGame() {
    document.getElementById('erudite-end-screen').classList.add('hidden');
    this.round = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.solvedCount = 0;
    document.getElementById('erudite-total').textContent = this.ROUNDS;
    this.updateStats();

    const all = App.collectAllSpecies().filter(sp => sp && sp.id && sp.name);
    const usable = all.filter(sp => {
      const w = this.normalizeWord(sp.name);
      return w.length >= this.MIN_WORD_LEN && w.length <= this.MAX_WORD_LEN;
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
    this.nextRound();
  },

  nextRound() {
    if (this.round >= this.queue.length) { this.finishGame(); return; }
    const item = this.queue[this.round];
    this.current = item;
    this.placed = []; // [{letter, trayIndex}]
    this.locked = false;
    this.hintUsed = false;

    document.getElementById('erudite-round').textContent = this.round + 1;
    document.getElementById('erudite-hint').textContent = '';

    const img = document.getElementById('erudite-img');
    img.src = `img/species/${item.speciesId}.png`;
    img.alt = 'Описание скрыто — угадай вид!'; // не подсвечиваем название заранее

    this.buildTray(item.word);
    this.renderSlots();
  },

  normalizeWord(name) {
    return String(name || '')
      .toLocaleLowerCase('ru-RU')
      .replace(/[^а-яёa-z]/g, '');
  },

  buildTray(word) {
    const letters = Array.from(word);
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

  onTileClick(trayIndex) {
    if (this.locked) return;
    const tile = this.tray[trayIndex];
    if (!tile || tile.used) return;
    tile.used = true;
    this.placed.push({ letter: tile.letter, trayIndex });
    this.renderTray();
    this.renderSlots();
    if (this.placed.length === this.current.word.length) {
      this.checkWord();
    }
  },

  tryPlaceLetter(ch) {
    if (this.locked) return;
    const idx = this.tray.findIndex(t => !t.used && t.letter === ch);
    if (idx !== -1) this.onTileClick(idx);
  },

  undoLast() {
    if (this.locked || !this.placed.length) return;
    const last = this.placed.pop();
    this.tray[last.trayIndex].used = false;
    this.renderTray();
    this.renderSlots();
  },

  shuffleTray() {
    if (this.locked) return;
    const free = this.tray.filter(t => !t.used);
    const letters = this.shuffle(free.map(t => t.letter));
    let k = 0;
    this.tray = this.tray.map(t => (t.used ? t : { ...t, letter: letters[k++] }));
    this.renderTray();
  },

  renderSlots() {
    const slotsEl = document.getElementById('erudite-slots');
    slotsEl.innerHTML = '';
    const word = this.current.word;
    for (let i = 0; i < word.length; i++) {
      const slot = document.createElement('div');
      slot.className = 'erudite-slot';
      const placed = this.placed[i];
      if (placed) {
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

  checkWord() {
    if (this.locked || this.placed.length !== this.current.word.length) return;
    this.locked = true;
    this.checked = true;
    this.renderSlots();

    const guess = this.placed.map(p => p.letter).join('');
    const correct = guess === this.current.word;
    const hintEl = document.getElementById('erudite-hint');

    if (correct) {
      this.score += 10 + Math.max(0, 5 - this.streak) * 2;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.solvedCount += 1;
      hintEl.textContent = `Верно! Это — ${this.current.name}`;
      hintEl.classList.add('good');
    } else {
      this.streak = 0;
      hintEl.textContent = `Ошибка. Правильное слово: «${this.current.word.toUpperCase()}» (${this.current.name})`;
      hintEl.classList.add('bad');
    }
    this.updateStats();

    setTimeout(() => {
      hintEl.classList.remove('good', 'bad');
      this.checked = false;
      this.round++;
      this.nextRound();
    }, 1800);
  },

  skipWord() {
    if (this.locked) return;
    this.locked = true;
    this.streak = 0;
    const hintEl = document.getElementById('erudite-hint');
    hintEl.textContent = `Пропущено: «${this.current.word.toUpperCase()}» (${this.current.name})`;
    hintEl.classList.add('bad');
    this.updateStats();
    setTimeout(() => {
      hintEl.classList.remove('good', 'bad');
      this.round++;
      this.nextRound();
    }, 1500);
  },

  updateStats() {
    document.getElementById('erudite-score').textContent = this.score;
    document.getElementById('erudite-streak').textContent = this.streak;
  },

  finishGame() {
    document.getElementById('erudite-final-solved').textContent = this.solvedCount;
    document.getElementById('erudite-final-total').textContent = this.queue.length;
    document.getElementById('erudite-final-streak').textContent = this.bestStreak;

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
