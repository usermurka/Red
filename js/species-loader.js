// ============================================================
// ЗАГРУЗЧИК ДАННЫХ О ВИДАХ
// Сначала пробует взять данные из window.SPECIES_DATA (для file://)
// Если нет — идёт fetch('data/species/{id}.json')
// ============================================================

const SpeciesLoader = {

  // Кэш, чтобы не грузить один и тот же вид дважды
  _cache: {},

  // Основной метод. Возвращает Promise с данными вида.
  // Если данных нет — вернёт null.
  load(speciesId) {
    // 1. Уже в кэше — отдаём сразу (в т.ч. если там null — данных нет)
    if (speciesId in this._cache) {
      return Promise.resolve(this._cache[speciesId]);
    }

    // 2. Есть в window.SPECIES_DATA? (для file://)
    if (window.SPECIES_DATA && window.SPECIES_DATA[speciesId]) {
      const data = window.SPECIES_DATA[speciesId];
      this._cache[speciesId] = data;
      return Promise.resolve(data);
    }

    // 3. Пробуем fetch (для Live Server)
    return fetch(`data/species/${speciesId}.json`)
      .then(response => {
        if (!response.ok) throw new Error('Файл не найден: ' + speciesId);
        return response.json();
      })
      .then(data => {
        this._cache[speciesId] = data;
        return data;
      })
      .catch(err => {
        console.log('Данные о виде не загружены:', speciesId, err.message);
        this._cache[speciesId] = null;
        return null;
      });
  },

  // Есть ли данные о виде (без загрузки)
  has(speciesId) {
    if (window.SPECIES_DATA && window.SPECIES_DATA[speciesId]) return true;
    return false;
  }

};