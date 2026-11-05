// ============================================================
// СОХРАНЕНИЕ СОСТОЯНИЯ ПРИЛОЖЕНИЯ МЕЖДУ ПЕРЕЗАГРУЗКАМИ СТРАНИЦЫ
// ============================================================
// При обновлении окна браузера (F5 / Ctrl+R) приложение раньше
// сбрасывалось на «стартовый экран»: пустая карта, гостевой режим,
// сброшенные зум/панорама, фильтры и т.п. Этот модуль сериализует
// UI-состояние App в sessionStorage и восстанавливает его сразу
// после загрузки данных (App.init), но до привязки событий
// (bindEvents) — так обработчики получают уже готовые чекбоксы,
// подсветку кнопок и позиции слоёв карты.
//
// Сохраняются только лёгкие поля состояния: списки маркеров,
// областей и миграций живут в localStorage (LocalStore), прогресс
// игр — в Achievements, записи дневника — в Journal.
//
// sessionStorage выбран специально: состояние возвращается после
// обновления/восстановления вкладки, но новая сессия (свежая вкладка)
// начинается с чистого стартового экрана.

(function () {
  'use strict';

  const KEY = 'red_book_omsk_session_state_v1';

  // Поля App, которые сохраняем как есть (строки, числа, boolean, null).
  const SCALAR_FIELDS = [
    'developerMode',
    'zoom', 'panX', 'panY',
    'showBadges', 'showIcons', 'showMarkers', 'showRegions', 'showMigrations',
    'mapOnlyHighlighted', 'isAllHighlighted',
    'speciesView', 'listView', 'speciesPanelMode',
    'expandState', 'nearbyRadiusKm',
    'serialMode', 'regionMode', 'migrationMode',
    'activeRegionSpeciesId', 'highlightedRegionId',
    'selectedSpecies', 'selectedMarkerType', 'selectedStatus',
    'lastUsed', 'lastMarkerType'
  ];

  // Поля-массивы / Set.
  const SET_FIELDS = [
    'highlightedIds',
    'highlightedSpeciesRegions',
    'highlightedSpeciesMigrations',
    'listFilter',
    'listStatuses',
    'expandedGroups'
  ];

  function serializeSet(v) {
    if (v instanceof Set) return Array.from(v);
    return Array.isArray(v) ? v.slice() : [];
  }

  function snapshot() {
    const App = window.App;
    if (!App) return null;
    const data = {};
    SCALAR_FIELDS.forEach(k => { data[k] = App[k]; });
    SET_FIELDS.forEach(k => { data[k] = serializeSet(App[k]); });
    // listSpeciesIds: null = фильтр не задан, пустой Set = пустая карта —
    // различие важно сохранять.
    data.listSpeciesIds = (App.listSpeciesIds instanceof Set)
      ? Array.from(App.listSpeciesIds)
      : (Array.isArray(App.listSpeciesIds) ? App.listSpeciesIds.slice() : null);

    // Дополнительные признаки интерфейса (не поля App).
    const panel = document.getElementById('species-panel');
    data.speciesPanelOpen = !!(panel && !panel.classList.contains('hidden'));
    data.gamesModeActive = !!(typeof Achievements !== 'undefined' &&
                              Achievements.gamesModeActive);
    const search = document.getElementById('species-search');
    data.listSearchQuery = search ? search.value : '';
    const tree = document.getElementById('species-tree');
    data.speciesTreeScrollTop = tree ? tree.scrollTop : 0;
    return data;
  }

  // Прямая запись в sessionStorage (без дебаунса).
  function saveNow() {
    try {
      const data = snapshot();
      if (data) sessionStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* переполнение/запрет storage — тихо игнорируем */
    }
  }

  let _debounceTimer = null;
  function scheduleSave() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null;
      saveNow();
    }, 300);
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ---------- Восстановление интерфейса ----------

  function restoreUi(data) {
    const App = window.App;

    // --- Фильтры справочника / выделения на карте ---
    SET_FIELDS.forEach(k => {
      const arr = data[k];
      if (Array.isArray(arr) && App[k] instanceof Set) {
        App[k] = new Set(arr);
      }
    });
    if ('listSpeciesIds' in data) {
      App.listSpeciesIds = Array.isArray(data.listSpeciesIds)
        ? new Set(data.listSpeciesIds)
        : null;
    }

    // --- Скалярные поля ---
    SCALAR_FIELDS.forEach(k => {
      if (k in data && data[k] !== undefined) App[k] = data[k];
    });

    // В рисование областей/миграций при восстановлении не возвращаемся:
    // незавершённые точки не сохраняем, режим выключаем.
    App.regionMode = false;
    App.migrationMode = false;
    App.currentRegionPoints = [];
    App.currentMigrationPoints = [];

    // --- Чекбоксы отображения объектов ---
    const toggleMap = {
      'toggle-markers': 'showMarkers',
      'toggle-regions': 'showRegions',
      'toggle-migrations': 'showMigrations',
      'toggle-badges': 'showBadges',
      'toggle-icons': 'showIcons'
    };
    Object.keys(toggleMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = !!App[toggleMap[id]];
    });

    // --- Активная карта (переключатель #map-switcher) ---
    const activeBtn = document.querySelector('.map-option.active');
    if (activeBtn && App.map) {
      App.map.src = activeBtn.dataset.map;
    }

    // --- Режим гость/разработчик + игры ---
    // setMode(false) внутри выключает серийный режим, поэтому порядок:
    // сначала режим, затем серийный.
    if (typeof Achievements !== 'undefined' && data.gamesModeActive) {
      Achievements.enterGamesMode();
    }
    App.setMode(!!App.developerMode);

    if (App.serialMode) {
      App.setSerialMode(true);
    } else {
      App.setSerialMode(false);
    }

    // --- Подсветка строк слоёв и кнопок статусов ---
    App.updateLayerFilterHighlight();
    App.updateStatusLayerHighlight();

    // --- Тултип: скрыть, если был открыт до перезагрузки ---
    if (App.tooltip) App.tooltip.style.display = 'none';

    // --- Зум/панорама и слои карты ---
    App.applyTransform();
    App.render();
    App.renderRegions();
    App.updateStats();

    // --- Открытая панель справочника ---
    if (data.speciesPanelOpen) {
      App.openSpeciesPanel(App.speciesPanelMode || 'browse', { autoOpen: false, userGesture: true });
      const search = document.getElementById('species-search');
      if (search && data.listSearchQuery) {
        search.value = data.listSearchQuery;
        App.renderSpeciesTree(data.listSearchQuery.trim().toLowerCase());
      }
      // Не даём openSpeciesPanel увести фокус в поиск — страница
      // после восстановления должна выглядеть так же, как до перезагрузки.
      if (search) search.blur();
      // Восстанавливаем прокрутку дерева видов после перерисовки
      if (data.speciesTreeScrollTop) {
        requestAnimationFrame(() => {
          const tree = document.getElementById('species-tree');
          if (tree) tree.scrollTop = data.speciesTreeScrollTop;
        });
      }
    }
  }

  // ---------- Точки сохранения ----------

  function installAutoSave() {
    // Любое изменение DOM (открытие панелей/модалок, классы кнопок,
    // чекбоксы, transform обёртки карты) → дебаунс-сохранение.
    if (window.MutationObserver) {
      const mo = new MutationObserver(scheduleSave);
      mo.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'style', 'checked', 'hidden'],
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    // Мгновенное сохранение перед выгрузкой страницы.
    window.addEventListener('pagehide', saveNow);
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
  }

  // Вызывается из App.init(): восстановить состояние, если оно есть.
  window.restoreSessionState = function () {
    const data = load();
    if (!data) return false;
    try {
      restoreUi(data);
    } catch (e) {
      console.warn('Не удалось восстановить состояние сессии:', e);
      return false;
    }
    return true;
  };

  window.saveSessionStateNow = saveNow;

  // После инициализации App навешиваем автосохранение.
  document.addEventListener('DOMContentLoaded', () => {
    installAutoSave();
  });
})();
