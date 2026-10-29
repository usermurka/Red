// ============================================================
// ЯДРО ПРИЛОЖЕНИЯ: глобальные помощники, состояние приложения, инициализация
// ============================================================

// Экранирует HTML-спецсимволы, чтобы данные из JSON / localStorage / импорта
// не ломали вёрстку и не выполняли случайный скрипт (защита от XSS).
// Доступно другим модулям через window.escapeHtml (journal.js и др.).
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}
window.escapeHtml = escapeHtml;

// Безопасная вставка текста в innerHTML-шаблоны: то же, что escapeHtml,
// но читаемое имя на месте вызова. Доступна модулям как window.esc.
const esc = escapeHtml;
window.esc = esc;

// Пересчет координат из процентов (x, y) в реальные (широта, долгота).
// Доступна модулям как window.xyToGeo.
function xyToGeo(x, y) {
  const b = CONFIG.mapGeoBounds;
  // Линейная интерполяция: находим долю x и y между опорными точками
  const lon = b.lon1 + (b.lon2 - b.lon1) * ((x - b.x1) / (b.x2 - b.x1));
  const lat = b.lat1 + (b.lat2 - b.lat1) * ((y - b.y1) / (b.y2 - b.y1));
  return { lat, lon };
}
window.xyToGeo = xyToGeo;

// ------------------------------------------------------------
// Базовый объект приложения: поля состояния + init().
// Остальные модули дополняют его методами так:
//     Object.assign(App, { method() { ... }, ... });
// Порядок загрузки в index.html:
//     core -> ui -> map -> regions -> species -> render -> tooltips -> guide
// ------------------------------------------------------------
window.App = {
  markers: [],
  developerMode: false,
  pendingMarker: null,
  showBadges: true,
  selectedSpecies: null,
  selectedMarkerType: null,
  selectedStatus: 3,
  highlightedIds: new Set(),
  highlightedSpeciesRegions: new Set(),     // speciesId, у которых показывать области
  highlightedSpeciesMigrations: new Set(),  // speciesId, у которых показывать миграции
  highlightedRegionId: null,  // id подсвеченной области
  flashingIds: new Set(),     // id маркеров, которые сейчас мигают (кратковременно)
  _flashTimer: null,          // таймер сброса мигания
  listFilter: new Set(),      // Set категорий для фильтра в справочнике (мультивыбор)
  listStatuses: new Set(),    // Set статусов 0..7 для фильтра в справочнике (мультивыбор)
  listSpeciesIds: null,       // Set speciesId для фильтра по конкретным видам (из подменю слоёв). null = не задан  
  lastUsed: null,          // последний выбранный вид: { name, speciesId, speciesName, category, status }
  lastMarkerType: null,    // формат маркера (breeding / single / ... / null) — отдельно от вида
  serialMode: false,  // серийный режим — клик по карте сразу ставит маркер
  isSettingSerial: false,  // открыта модалка только для задания параметров серии
  showIcons: true,  // показывать иконки категорий на маркерах
  showMarkers: true,        // показывать ли маркеры на карте
  showRegions: true,        // показывать ли области обитания
  showHighlightAnim: true,   // подсветка всегда включена (галочка убрана из UI)
  regionMode: false,        // режим рисования области
  currentRegionPoints: [],  // текущие точки рисуемой области

  // --- ТОНКАЯ РУЧНАЯ ПОДСТРОЙКА СМЕЩЕНИЯ МАРКЕРОВ И ОБЛАСТЕЙ ---
  // Маркеры и SVG-слой областей лежат ВНУТРИ #map-wrapper и позиционируются
  // от его левого верхнего угла (padding-box). Если границы слоя и картинки
  // расходятся (рамка/outline у <img>, padding у wrapper'а) — слои «съезжают».
  // getMapLayerOffset() ниже вычисляет этот зазор автоматически; сюда можно
  // добавить ручную поправку в CSS-пикселях (до масштабирования transform'ом):
  //   markerAlignX/Y — сдвиг маркеров по горизонтали/вертикали
  //   regionAlignX/Y — сдвиг контуров областей (SVG-слоя)
  // Пример: markerAlignY: -3 сдвинет все маркеры на 3px вверх.
  markerAlignX: 0,
  markerAlignY: 0,
  regionAlignX: 5,
  regionAlignY: 5,

  // РАСТЯЖКА / МАСШТАБ слоёв вокруг ЦЕНРА карты (для ручной подстройки).
  // Если одна точка области совпадает, а противоположный край «отъезжает» —
  // это расхождение масштаба, а не сдвига. Коэффициенты задаются отдельно
  // для маркеров и областей; 1 = без изменений.
  //   *ScaleX > 1 — слой растягивается шире, < 1 — сжимается (центр неподвижен)
  //   *ScaleY    — то же по вертикали
  // Растяжка применяется ОТНОСИТЕЛЬНО ЦЕНТРА: точки в центре карты остаются
  // на месте, а края расходятся симметрично. Удобно подгонять так: сначала
  // выставить alignX/Y по центру, затем ScaleX по левому/правому краю, ScaleY
  // по верхнему/нижнему.
  // Пример: regionScaleX: 1.02 растянет контуры областей на 2% ширине.
  markerScaleX: 1,
  markerScaleY: 1,
  regionScaleX: 1.02,
  regionScaleY: 1.02,
  regions: [],  // сохранённые области обитания
  migrations: [],  // сохранённые линии миграций
  showMigrations: true,  // показывать ли линии миграций на карте
  migrationMode: false,        // режим рисования линии миграции
  currentMigrationPoints: [],  // текущие точки рисуемой линии (макс 2)
  pickingMigrationSpecies: false,  // открыт ли справочник для выбора вида миграции
  pendingMigrationPoints: null,    // временно сохранённые точки для модалки
  // Режим открытой модалки области / миграции:
  //   null       — обычная (после рисования)
  //   'serial'   — задание вида для серии (без точек)
  _regionModalMode: null,
  _migrationModalMode: null,
  selectedRegionIntensity: 'weak',  // интенсивность для новой области
  regionSpecies: null,               // выбранный вид для области
  pickingRegionSpecies: false,       // открыт ли справочник для выбора вида области
  activeRegionSpeciesId: null,  // какой вид сейчас показываем на карте (для областей)
  listSearchQuery: '',  // поиск в панели списка
  mapOnlyHighlighted: true,  // на карте — только подсвеченные маркеры
  nearbyRadiusKm: 10,   // радиус зоны «поблизости» в км (реальное значение)
  expandedGroups: new Set(),  // ключи раскрытых групп в списке
  speciesView: 'tree',   // 'tree' или 'alpha' — режим отображения справочника
  speciesPanelMode: 'pick',  // 'pick' — выбор вида (из модалки), 'browse' — просмотр (из сайдбара)
  isAllHighlighted: true, // Состояние кнопки выделения (true = все выделены)
  expandState: 0, // 0 = свернуто, 1 = развернуты группы, 2 = развернуты и виды   // Состояние кнопки разворачивания (false = все свернуты)
  listView: 'tree',      // 'tree' или 'alpha' — режим отображения списка "Все виды"  
  
  // --- Зум и панорамирование ---
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panStartPanX: 0,
  panStartPanY: 0,
  minZoom: 1,
  maxZoom: 5,

  init() {
    this.map = document.getElementById('map');
    this.container = document.getElementById('map-container');
    this.markersLayer = document.getElementById('markers-layer');
    this.tooltip = document.getElementById('tooltip');
    this.modal = document.getElementById('modal');

  this.markers = LocalStore.load();
  this.regions = LocalStore.loadRegions();
  this.migrations = LocalStore.loadMigrations();

  // --- ПРИ СТАРТЕ НИЧЕГО НЕ ВЫДЕЛЕНО (все объекты скрыты) ---
  this.highlightedIds.clear();
  this.highlightedSpeciesRegions.clear();
  this.highlightedSpeciesMigrations.clear();
  this.highlightedRegionId = null;
  // Включаем режим "только выделенные" — раз ничего не выделено, карта будет пустой
  this.mapOnlyHighlighted = true;
  this.isAllHighlighted = false;
// ----------------------------------------------

    // Загружаем радиус «поблизости» из localStorage
    try {
      const saved = localStorage.getItem(CONFIG.ui.nearbyRadiusStorageKey);
      if (saved !== null) {
        const v = Number(saved);
        if (!isNaN(v) && v >= CONFIG.ui.nearbyRadiusMin && v <= CONFIG.ui.nearbyRadiusMax) {
          this.nearbyRadiusKm = v;
        }
      }
    } catch (e) {
      console.warn('Не удалось загрузить радиус «поблизости»:', e);
    }

    // Если localStorage пустой — пробуем загрузить из файла data/red-book-omsk.json
    if (this.markers.length === 0 && this.regions.length === 0 && this.migrations.length === 0) {
      this.loadFromFile('data/red-book-omsk.json');
    }

    // Всегда показываем только выделенные (галочка убрана из UI)
    this.mapOnlyHighlighted = true;

    this.buildMapSwitcher();
    this.buildLayers();
    this.buildStatusLayers();
    this.buildStatusScale();

    this.bindEvents();
    this.render();

    // Режим по умолчанию из CONFIG
    this.setMode(CONFIG.ui.defaultMode === 'developer');

    // Обновляем статистику
    this.updateStats();

    // Синхронизируем поле радиуса «поблизости» с сохранённым значением
    this.applyNearbyRadiusUI();

    // Следим за изменением размеров контейнера карты:
    // когда открывается/закрывается боковая панель, окно меняет размер и т.п.
    // — пересчитываем позиции маркеров.
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        this.updateMarkerPositions();
      });
      ro.observe(this.container);
    }

    // На всякий случай — пересчёт при изменении размера окна
    window.addEventListener('resize', () => {
      this.updateMarkerPositions();
    });

    // И когда картинка карты загрузилась/сменилась
    this.map.addEventListener('load', () => {
      this.updateMarkerPositions();
    });
  },
};
