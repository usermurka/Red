// ============================================================
// ОБЩАЯ ПОДСКАЗКА (зависит от режима), утилиты и кнопка «Показать на карте»
// ============================================================

(function () {
'use strict';
const App = window.App;
const esc = window.esc || window.escapeHtml;
const xyToGeo = window.xyToGeo;

Object.assign(App, {
  updateHintUI() {
    const hintText = document.getElementById('hint-text');
    const hintBtn = document.getElementById('hint-show-btn');
    if (!hintText) return;

    // 1. Если включен серийный режим — показываем его подсказки
    if (this.serialMode) {
      this.updateHintForSerial();
      hintBtn.classList.add('hidden');
      return;
    }

    // 2. Собираем уникальные виды, у которых ЕСТЬ выделенные маркеры
    const visibleSpeciesIds = new Set();

    // Проходимся по ВСЕМ выделенным маркерам и смотрим их вид
    this.highlightedIds.forEach(id => {
      const m = this.markers.find(x => x.id === id);
      if (m && m.speciesId) {
        visibleSpeciesIds.add(m.speciesId);
      }
    });

    // 3. Если виден ровно один вид на карте
    if (visibleSpeciesIds.size === 1) {
      const sid = [...visibleSpeciesIds][0];
      const sp = this.findSpeciesById(sid);
      if (sp) {
        hintText.innerHTML = `<strong>Текущий вид:</strong> ${sp.name}`;
        hintBtn.classList.add('hidden');
        return;
      }
    }

    // 4. Если вид только что выбран (lastUsed задан), показываем его
    if (this.lastUsed) {
      const sp = this.findSpeciesById(this.lastUsed.speciesId);
      if (sp) {
        hintText.innerHTML = `<strong>Текущий вид:</strong> ${sp.name}`;
        hintBtn.classList.add('hidden');
        return;
      }
    }

    // 5. Стандартные подсказки
    if (!this.developerMode) {
      hintText.innerHTML = 'Режим просмотра. Кликните по маркеру, чтобы увидеть описание.';
      hintBtn.classList.add('hidden');
    } else {
      hintText.innerHTML = 'Кликните по карте, чтобы поставить маркер.';
      hintBtn.classList.add('hidden');

      if (visibleSpeciesIds.size === 0 && this.lastUsed) {
        hintText.innerHTML = `Все маркеры скрыты фильтрами.`;
        hintBtn.classList.remove('hidden');
      }
    }
  },

  // Быстрое отображение текущего вида из серийного режима
  showSelectedSpecies() {
    if (!this.lastUsed) return;
    const sid = this.lastUsed.speciesId;

    this.mapOnlyHighlighted = true;
    this.highlightedIds.clear();
    this.highlightedSpeciesRegions.clear();
    this.highlightedSpeciesMigrations.clear();
    this.highlightedRegionId = null;

    this.markers.forEach(m => {
      if (m.speciesId === sid) this.highlightedIds.add(m.id);
    });
    this.regions.forEach(r => {
      if (r.speciesList) {
        r.speciesList.forEach(sp => {
          if (sp.speciesId === sid) this.highlightedSpeciesRegions.add(sp.speciesId);
        });
      }
    });
    this.migrations.forEach(m => {
      if (m.speciesId === sid) this.highlightedSpeciesMigrations.add(m.speciesId);
      if (m.speciesList) {
        m.speciesList.forEach(sp => {
          if (sp.speciesId === sid) this.highlightedSpeciesMigrations.add(sp.speciesId);
        });
      }
    });

    this.render();
  }

});

// Точка входа: старт приложения после загрузки DOM.
document.addEventListener('DOMContentLoaded', () => {
  try {
    App.init();
  } catch (e) {
    console.error('App: ошибка инициализации:', e);
  }
});
})();
