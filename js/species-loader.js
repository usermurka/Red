// ============================================================
// ЗАГРУЗЧИК ДАННЫХ О ВИДАХ
// Данные берутся из window.SPECIES_DATA — объекта, «зашитого»
// в js/species-data.js (папка data/species/ больше не используется).
// ============================================================

const SpeciesLoader = {

  // Кэш, чтобы не возвращать один и тот же вид дважды
  _cache: {},

  // Основной метод. Возвращает Promise с данными вида.
  // Если данных нет — вернёт null.
  load(speciesId) {
    // 1. Уже в кэше — отдаём сразу (в т.ч. если там null — данных нет)
    if (speciesId in this._cache) {
      return Promise.resolve(this._cache[speciesId]);
    }

    // 2. Есть в window.SPECIES_DATA (js/species-data.js)?
    if (window.SPECIES_DATA && window.SPECIES_DATA[speciesId]) {
      const data = window.SPECIES_DATA[speciesId];
      this._cache[speciesId] = data;
      return Promise.resolve(data);
    }

    // 3. Данных нет — запоминаем и отдаём null
    this._cache[speciesId] = null;
    return Promise.resolve(null);
  },

  // Есть ли данные о виде (без загрузки)
  has(speciesId) {
    if (window.SPECIES_DATA && window.SPECIES_DATA[speciesId]) return true;
    return false;
  }

};