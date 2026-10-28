// ============================================================
// ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ
// ============================================================

// Экранирует HTML-спецсимволы, чтобы данные из JSON не ломали вёрстку
// и не выполняли случайный скрипт (защита от XSS в свитке о виде).
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

// Пересчет координат из процентов (x, y) в реальные (широта, долгота)
function xyToGeo(x, y) {
  const b = CONFIG.mapGeoBounds;
  // Линейная интерполяция: находим долю x и y между опорными точками
  const lon = b.lon1 + (b.lon2 - b.lon1) * ((x - b.x1) / (b.x2 - b.x1));
  const lat = b.lat1 + (b.lat2 - b.lat1) * ((y - b.y1) / (b.y2 - b.y1));
  return { lat, lon };
}

const App = {

  markers: [],
  developerMode: false,
  pendingMarker: null,
  showBadges: false,
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
  showIcons: false,  // показывать иконки категорий на маркерах
  showMarkers: true,        // показывать ли маркеры на карте
  showRegions: true,        // показывать ли области обитания
  showHighlightAnim: true,   // подсветка всегда включена (галочка убрана из UI)
  regionMode: false,        // режим рисования области
  currentRegionPoints: [],  // текущие точки рисуемой области
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

  this.markers = Storage.load();
  this.regions = Storage.loadRegions();
  this.migrations = Storage.loadMigrations();

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


  // ============================================================
  // Построение интерфейса
  // ============================================================

  buildMapSwitcher() {
    const container = document.getElementById('map-switcher');
    container.innerHTML = '';
    CONFIG.maps.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.className = 'map-option' + (i === CONFIG.ui.defaultMapIndex ? ' active' : '');
      btn.dataset.map = m.src;
      btn.textContent = m.label;
      container.appendChild(btn);
    });
    this.map.src = CONFIG.maps[CONFIG.ui.defaultMapIndex].src;
  },

  buildLayers() {
    const container = document.getElementById('layers');
    container.innerHTML = '';
    CONFIG.categories.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.dataset.cat = cat.key;
      row.innerHTML = `
        <span class="cat-icon">${cat.icon || '●'}</span>
        <span class="cat-label">${cat.label}</span>
        <span class="cat-count" data-count-cat="${cat.key}">0</span>
      `;
      container.appendChild(row);
    });

    // --- Клик по строке слоя: ТОЛЬКО открыть/закрыть подменю ---
    container.addEventListener('click', (e) => {
      const row = e.target.closest('.layer-row');
      if (!row) return;
      const catKey = row.dataset.cat;

      // Открываем подменю (toggle)
      this.openLayerSubmenu(catKey, row);
    });
  },

  // Строит шкалу статусов 0..7 для фильтра в сайдбаре.
  // Логика мультивыбора — как у слоёв категорий.
  buildStatusLayers() {
    const container = document.getElementById('status-layers');
    if (!container) return;
    container.innerHTML = '';

    CONFIG.statuses.forEach(s => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'status-layer-btn';
      btn.dataset.value = s.value;
      btn.style.background = s.color;
      btn.innerHTML = `<span class="status-layer-num">${s.value}</span>`;
      btn.title = s.value + ' — ' + s.label;

      btn.addEventListener('click', () => {
        if (this.listStatuses.has(s.value)) {
          this.listStatuses.delete(s.value);
        } else {
          this.listStatuses.add(s.value);
        }
        // Сбрасываем фильтр по конкретным видам — он несовместим с новым выбором статусов
        this.listSpeciesIds = null;
        this.updateStatusLayerHighlight();

        // Обновляем выделение на карте
        this.syncHighlightedFromFilters();

        // Открываем справочник
        this.openSpeciesPanel('browse');
      });

      container.appendChild(btn);
    });

    this.updateStatusLayerHighlight();
  },

  // Подсвечивает выбранные кнопки в шкале статусов
  updateStatusLayerHighlight() {
    const container = document.getElementById('status-layers');
    if (!container) return;
    container.querySelectorAll('.status-layer-btn').forEach(btn => {
      const val = Number(btn.dataset.value);
      btn.classList.toggle('selected', this.listStatuses.has(val));
    });
  },  

  // Подсвечивает строки слоёв, у которых есть выбранные виды
  updateLayerFilterHighlight() {
    const container = document.getElementById('layers');
    if (!container) return;

    // Если нет активного фильтра по видам — снимаем подсветку со всех строк
    if (!this.listSpeciesIds || this.listSpeciesIds.size === 0) {
      container.querySelectorAll('.layer-row').forEach(row => {
        row.classList.remove('filter-active');
      });
      return;
    }

    container.querySelectorAll('.layer-row').forEach(row => {
      const catKey = row.dataset.cat;
      // Проверяем, есть ли хоть один вид из этой категории в listSpeciesIds
      let hasSelectedSpecies = false;
      for (const speciesId of this.listSpeciesIds) {
        if (this.detectCategory(speciesId) === catKey) {
          hasSelectedSpecies = true;
          break;
        }
      }
      row.classList.toggle('filter-active', hasSelectedSpecies);
    });
  },

    // ============================================================
  // ВЫПАДАЮЩЕЕ ПОДМЕНЮ СЛОЯ (категории)
  // ============================================================

  // Обновляет классы .active у открытого подменю без его пересоздания
  updateLayerSubmenuHighlight() {
    const menu = document.getElementById('layer-submenu');
    if (!menu) return;

    const isNodeActive = (node) => {
      if (!this.listSpeciesIds || this.listSpeciesIds.size === 0) return false;
      const ids = this.collectSpeciesIdsFromNode(node);
      return ids.length > 0 && ids.every(id => this.listSpeciesIds.has(id));
    };

    // Проходим по всем строкам меню (и первого, и второго уровня)
    menu.querySelectorAll('.submenu-item').forEach((el, index) => {
      // Восстанавливаем связь DOM-элемента с объектом узла
      // (для этого мы будем сохранять ссылку на узел в data-атрибут при создании)
      const node = el._nodeRef;
      if (node) {
        el.classList.toggle('active', isNodeActive(node));
      }
    });
  },

  // Открывает/закрывает подменю для категории.
  // rowEl — DOM-строка слоя, к которой «липнет» меню.
  openLayerSubmenu(catKey, rowEl) {
    const existing = document.getElementById('layer-submenu');

    // Toggle: повторный клик по той же строке закрывает меню
    if (existing) {
      const sameCat = existing.dataset.cat === catKey;
      this.closeLayerSubmenu();
      if (sameCat) return;
    }

    // Просто открываем меню, ничего не трогая на карте

    const menu = document.createElement('div');
    menu.id = 'layer-submenu';
    menu.className = 'layer-submenu';
    menu.dataset.cat = catKey;

    const cat = CONFIG.categories.find(c => c.key === catKey);
    const group = SPECIES[catKey];

    // Заголовок
    const header = document.createElement('div');
    header.className = 'submenu-header';
    header.innerHTML = `<span class="submenu-icon">${cat.icon || '●'}</span><span>${cat.label}</span>`;
    header.addEventListener('click', () => {
      this.selectLayerNode(catKey, group, cat.label);
    });
    menu.appendChild(header);

    // Уровни: типы → классы (глубже не идём)
    if (group) {
      this.buildSubmenuLevels(menu, group, catKey);
    }

    document.body.appendChild(menu);
    this.positionLayerSubmenu(menu, rowEl);

    // Закрытие по клику вне меню
    setTimeout(() => {
      document.addEventListener('mousedown', this._onLayerSubmenuOutside);
    }, 0);

    // «Прилипание» к строке при скролле/ресайзе
    this._layerSubmenuRow = rowEl;
    window.addEventListener('scroll', this._onLayerSubmenuReposition, true);
    window.addEventListener('resize', this._onLayerSubmenuReposition);
  },

  closeLayerSubmenu() {
    const menu = document.getElementById('layer-submenu');
    if (menu) menu.remove();
    document.removeEventListener('mousedown', this._onLayerSubmenuOutside);
    window.removeEventListener('scroll', this._onLayerSubmenuReposition, true);
    window.removeEventListener('resize', this._onLayerSubmenuReposition);
    this._layerSubmenuRow = null;
  },

  // Позиционирует меню справа от строки слоя
  positionLayerSubmenu(menu, rowEl) {
    if (!rowEl) return;
    const r = rowEl.getBoundingClientRect();
    const menuW = 280;
    let left = r.right + 4;
    // Если не влезает — показываем слева от строки
    if (left + menuW > window.innerWidth - 8) {
      left = Math.max(8, r.left - menuW - 4);
    }
    menu.style.position = 'fixed';
    menu.style.left = left + 'px';
    menu.style.top = r.top + 'px';
    menu.style.width = menuW + 'px';
  },

  // Строит уровни «тип → класс» внутри меню
  buildSubmenuLevels(menu, group, catKey) {
    const firstLevel = group.classes || group.orders || [];

    // Хелпер: проверяет, все ли виды узла сейчас выбраны
    const isNodeActive = (node) => {
      if (!this.listSpeciesIds || this.listSpeciesIds.size === 0) return false;
      const ids = this.collectSpeciesIdsFromNode(node);
      return ids.length > 0 && ids.every(id => this.listSpeciesIds.has(id));
    };

    firstLevel.forEach(node => {
      const typeEl = document.createElement('div');
      typeEl.className = 'submenu-type';

      const typeTitle = document.createElement('div');
      typeTitle.className = 'submenu-item' + (isNodeActive(node) ? ' active' : '');
      typeTitle.textContent = this.shortNodeLabel(node.label || '');
      typeTitle._nodeRef = node; // <-- сохраняем ссылку
      typeTitle.addEventListener('click', () => {
        this.selectLayerNode(catKey, node, node.label);
      });
      typeEl.appendChild(typeTitle);

      // Второй уровень: classes или orders
      const secondLevel = node.classes || node.orders || [];
      if (secondLevel.length > 0) {
        const childWrap = document.createElement('div');
        childWrap.className = 'submenu-children';

        secondLevel.forEach(child => {
          const childEl = document.createElement('div');
          childEl.className = 'submenu-class';
          const childTitle = document.createElement('div');
          childTitle.className = 'submenu-item' + (isNodeActive(child) ? ' active' : '');
          childTitle.textContent = this.shortNodeLabel(child.label || '');
          childTitle._nodeRef = child; // <-- сохраняем ссылку
          childTitle.addEventListener('click', () => {
            this.selectLayerNode(catKey, child, child.label);
          });
          childEl.appendChild(childTitle);
          childWrap.appendChild(childEl);
        });

        typeEl.appendChild(childWrap);
      }

      menu.appendChild(typeEl);
    });
  },

  // Обрезает длинные названия до тире (—, –, -)
  shortNodeLabel(label) {
    if (!label) return '';
    // Ищем длинное тире, среднее тире или дефис с пробелами вокруг
    const match = label.match(/\s*[—–-]\s+/);
    if (match && match.index > 0) {
      return label.slice(0, match.index).trim();
    }
    // Если нет пробелов, но есть просто длинное тире
    const idxLong = label.indexOf('—');
    if (idxLong > 0) return label.slice(0, idxLong).trim();

    const idxMid = label.indexOf('–');
    if (idxMid > 0) return label.slice(0, idxMid).trim();

    return label;
  },

  // Собирает всех speciesId-потомков узла (включая вложенные classes/orders)
  collectSpeciesIdsFromNode(node) {
    const ids = [];
    const walk = (n) => {
      if (n.species) n.species.forEach(s => { if (s.id) ids.push(s.id); });
      if (n.classes) n.classes.forEach(walk);
      if (n.orders) n.orders.forEach(walk);
    };
    walk(node);
    return ids;
  },

  // Клик по узлу меню (заголовок / тип / класс)
  selectLayerNode(catKey, node, label) {
    // 1. Включаем категорию в listFilter (внутренний фильтр)
    this.listFilter.add(catKey);
    this.updateLayerFilterHighlight();

    // 2. Собираем всех потомков узла
    const speciesIds = this.collectSpeciesIdsFromNode(node);

    // Инициализируем Set, если его нет
    if (!this.listSpeciesIds) {
      this.listSpeciesIds = new Set();
    }

    const allAlreadySelected = speciesIds.length > 0 && speciesIds.every(id => this.listSpeciesIds.has(id));

    if (allAlreadySelected) {
      // Если все виды уже выбраны — удаляем их (снимаем галочку)
      speciesIds.forEach(id => this.listSpeciesIds.delete(id));
    } else {
      // Иначе — добавляем (ставим галочку)
      speciesIds.forEach(id => this.listSpeciesIds.add(id));
    }

    // Если после удаления список стал пустым — ОСТАВЛЯЕМ его пустым (Set(0)),
    // чтобы карта очистилась, а не показывала всю категорию.

    // Обновляем визуальную подсветку активных пунктов
    this.updateLayerSubmenuHighlight();
    this.updateLayerFilterHighlight();

    // Пересобираем выделение на карте
    this.syncHighlightedFromFilters();

    // Обновляем справочник
    this.openSpeciesPanel('browse');
  },

  // Заглушка (чекбоксы удалены, управление только через подменю)
  setCategoryCheckboxState(catKey, checked) {
    // Больше не используется
  },

  // Пересобирает highlightedIds и подсветки из текущих фильтров:
  // - чекбоксы категорий (какие категории вообще показывать)
  // - listStatuses (статусы)
  // - listSpeciesIds (конкретные виды из подменю)
  syncHighlightedFromFilters() {
    // Какие категории выбраны в listFilter (клики по строкам слоёв / подменю)
    // Если listFilter пуст — значит, ни одна категория не выбрана → карта пустая.
    const filterCats = this.listFilter;

    // Все виды справочника
    let species = this.collectAllSpecies();

    // 1. Фильтрация по категориям и видам
    if (filterCats.size > 0) {
      species = species.filter(s => filterCats.has(this.detectCategory(s.id)));
    } else if (this.listStatuses.size > 0) {
      // Если выбраны только статусы — не обнуляем список
    } else {
      species = [];
    }

    // 2.1 Фильтр по конкретным видам (listSpeciesIds)
    // null = фильтр не задан (показываем всё, что прошло по категориям)
    // Set(0) = фильтр задан, но пуст (показываем пустую карту)
    if (this.listSpeciesIds !== null) {
      if (this.listSpeciesIds.size === 0) {
        species = []; // Пустой фильтр = пустая карта
      } else {
        species = species.filter(s => this.listSpeciesIds.has(s.id));
      }
    }

    // 3. Фильтр по статусам (только если задан)
    if (this.listStatuses.size > 0) {
      species = species.filter(s => this.listStatuses.has(s.status));
    }

    const allowedIds = new Set(species.map(s => s.id));

    // Пересобираем highlightedIds — только маркеры разрешённых видов
    this.highlightedIds.clear();
    this.markers.forEach(m => {
      if (m.speciesId && allowedIds.has(m.speciesId)) {
        this.highlightedIds.add(m.id);
      }
    });

    // Области и миграции — тоже только для разрешённых видов
    this.highlightedSpeciesRegions.clear();
    this.regions.forEach(r => {
      if (r.speciesList) {
        r.speciesList.forEach(sp => {
          if (allowedIds.has(sp.speciesId)) {
            this.highlightedSpeciesRegions.add(sp.speciesId);
          }
        });
      }
    });

    this.highlightedSpeciesMigrations.clear();
    this.migrations.forEach(m => {
      if (m.speciesId && allowedIds.has(m.speciesId)) {
        this.highlightedSpeciesMigrations.add(m.speciesId);
      }
    });

    // Перерисовка карты и справочника
    this.render();
    this.renderSpeciesTree(document.getElementById('species-search').value.trim().toLowerCase());
    this.updateSpeciesBrowseCounter();
  },

  // «Прилипание» меню к строке
  _onLayerSubmenuOutside(e) {
    const menu = document.getElementById('layer-submenu');
    if (!menu) return;
    if (menu.contains(e.target)) return;
    // Клик по самой строке слоя — обработает openLayerSubmenu (toggle)
    if (e.target.closest('.layer-row')) return;
    App.closeLayerSubmenu();
  },

  _onLayerSubmenuReposition() {
    const menu = document.getElementById('layer-submenu');
    const row = App._layerSubmenuRow;
    if (!menu || !row) return;
    App.positionLayerSubmenu(menu, row);
  },

  buildStatusScale() {
    const container = document.getElementById('status-scale');
    if (!container) return;
    container.innerHTML = '';
    CONFIG.statuses.forEach(s => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'status-btn';
      btn.dataset.value = s.value;
      btn.style.background = s.color;
      btn.textContent = s.value;
      btn.title = s.label;
      btn.addEventListener('click', () => this.selectStatus(s.value));
      container.appendChild(btn);
    });
  },

  selectStatus(value) {
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.querySelector(`.status-btn[data-value="${value}"]`);
    if (btn) btn.classList.add('selected');
    const status = CONFIG.statuses.find(s => s.value === value);
    const label = document.getElementById('status-label');
    if (label) label.textContent = status ? status.label : '';
    this.selectedStatus = value;
  },

  updateCounters() {
    CONFIG.categories.forEach(cat => {
      const count = this.markers.filter(m => m.category === cat.key).length;
      document.querySelectorAll(`[data-count-cat="${cat.key}"]`).forEach(el => {
        el.textContent = count;
      });
    });
  },

    // Обновляет статистику в сайдбаре
  updateStats() {
    // Всего видов в базе
    let totalSpecies = 0;
    const countSpecies = (node) => {
      let c = 0;
      if (node.species) c += node.species.length;
      if (node.classes) node.classes.forEach(x => c += countSpecies(x));
      if (node.orders) node.orders.forEach(x => c += countSpecies(x));
      return c;
    };
    Object.values(SPECIES).forEach(group => {
      totalSpecies += countSpecies(group);
    });

    // Уникальные виды, у которых есть маркеры или области
    const markedSpecies = new Set();
    this.markers.forEach(m => {
      if (m.speciesId) markedSpecies.add(m.speciesId);
    });
    this.regions.forEach(r => {
      if (r.speciesList) {
        r.speciesList.forEach(sp => markedSpecies.add(sp.speciesId));
      }
    });

    // Обновляем цифры
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('stat-total', totalSpecies);
    setText('stat-marked', markedSpecies.size);
    setText('stat-markers', this.markers.length);
    setText('stat-regions', this.regions.length);
  },

  // Обновляет отображение радиуса «поблизости» в панели статистики
  // (текстовое значение + value у input).
  applyNearbyRadiusUI() {
    const valueEl = document.getElementById('nearby-radius-value');
    const inputEl = document.getElementById('nearby-radius-input');
    if (valueEl) valueEl.textContent = this.nearbyRadiusKm;
    if (inputEl) inputEl.value = this.nearbyRadiusKm;
  },

  // Устанавливает радиус «поблизости», валидирует и сохраняет в localStorage.
  // Возвращает нормализованное значение.
  setNearbyRadius(value) {
    let v = Number(value);

    // Если не число — берём дефолт
    if (isNaN(v)) {
      v = CONFIG.ui.nearbyRadiusKm;
    }

    // Ограничиваем по min/max
    if (v < CONFIG.ui.nearbyRadiusMin) v = CONFIG.ui.nearbyRadiusMin;
    if (v > CONFIG.ui.nearbyRadiusMax) v = CONFIG.ui.nearbyRadiusMax;

    // Округляем до целого
    v = Math.round(v);

    this.nearbyRadiusKm = v;

    // Сохраняем в localStorage
    try {
      localStorage.setItem(CONFIG.ui.nearbyRadiusStorageKey, v);
    } catch (e) {
      console.warn('Не удалось сохранить радиус «поблизости»:', e);
    }

    // Обновляем UI
    this.applyNearbyRadiusUI();

    return v;
  },

  // ============================================================
  // События
  // ============================================================

  bindEvents() {
    this.map.addEventListener('click', (e) => this.onMapClick(e));

    document.getElementById('btn-developer').addEventListener('click', () => this.tryEnterDeveloperMode());
    document.getElementById('btn-guest').addEventListener('click', () => this.setMode(false));

    // Модалка пароля
    document.getElementById('btn-password-ok').addEventListener('click', () => this.checkPassword());
    document.getElementById('btn-password-cancel').addEventListener('click', () => {
      document.getElementById('password-modal').classList.add('hidden');
    });

    // Enter в поле пароля — войти
    document.getElementById('password-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.checkPassword();
      if (e.key === 'Escape') document.getElementById('password-modal').classList.add('hidden');
    });

    document.getElementById('layers').addEventListener('change', () => {
      this.render();
      this.renderRegions();
    });

    document.getElementById('map-switcher').addEventListener('click', (e) => {
      const btn = e.target.closest('.map-option');
      if (!btn) return;
      document.querySelectorAll('.map-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.map.src = btn.dataset.map;
      // Когда новая картинка загрузится — пересчитать маркеры
      this.map.addEventListener('load', () => {
        this.updateMarkerPositions();
      }, { once: true });
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      Storage.exportAll(this.markers, this.regions, this.migrations);
    });

    // Экспорт в GeoJSON
    document.getElementById('btn-export-geojson').addEventListener('click', () => {
      const features = [];

      // 1. Маркеры (Point)
      this.markers.forEach(m => {
        const geo = xyToGeo(m.x, m.y);
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [geo.lon, geo.lat] },
          properties: {
            name: m.name,
            speciesId: m.speciesId,
            category: m.category,
            status: m.status,
            markerType: m.markerType
          }
        });
      });

      // 2. Области (Polygon)
      this.regions.forEach(r => {
        r.speciesList.forEach(sp => {
          // Переводим все точки области в координаты
          const coords = r.points.map(p => {
            const geo = xyToGeo(p[0], p[1]);
            return [geo.lon, geo.lat];
          });
          // GeoJSON требует, чтобы полигон был замкнут (первая точка = последняя)
          coords.push(coords[0]);

          features.push({
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [coords] },
            properties: {
              speciesName: sp.speciesName,
              speciesId: sp.speciesId,
              intensity: sp.intensity || r.intensity
            }
          });
        });
      });

      // 3. Миграции (LineString)
      this.migrations.forEach(m => {
        if (!m.points || m.points.length < 2) return;
        const coords = m.points.map(p => {
          const geo = xyToGeo(p[0], p[1]);
          return [geo.lon, geo.lat];
        });

        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: {
            speciesName: m.speciesName,
            speciesId: m.speciesId,
            category: m.category
          }
        });
      });

      const geojson = {
        type: "FeatureCollection",
        features: features
      };

      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'red-book-omsk.geojson';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        Storage.importAll(file, (data) => {
          // Поддержка обоих форматов: старый (массив маркеров) и новый (объект с markers + regions + migrations)
          if (Array.isArray(data)) {
            this.markers = data;
            this.regions = [];
            this.migrations = [];
          } else {
            this.markers = data.markers || [];
            this.regions = data.regions || [];
            this.migrations = data.migrations || [];
          }
          this.highlightedIds.clear();
          this.highlightedSpeciesRegions.clear();
          this.highlightedSpeciesMigrations.clear();

          // --- ПРИНУДИТЕЛЬНО ВЫДЕЛЯЕМ ВСЁ ИЗ ЗАГРУЖЕННОГО ФАЙЛА ---
          this.markers.forEach(m => this.highlightedIds.add(m.id));
          this.migrations.forEach(m => {
            if (m.speciesId) this.highlightedSpeciesMigrations.add(m.speciesId);
          });
          this.regions.forEach(r => {
            if (r.speciesList) {
              r.speciesList.forEach(sp => this.highlightedSpeciesRegions.add(sp.speciesId));
            }
          });
          this.mapOnlyHighlighted = false;
          const toggle = document.getElementById('toggle-species-only-highlighted');
          if (toggle) toggle.checked = false;
          // ---------------------------------------------------------

          Storage.save(this.markers);
          Storage.saveRegions(this.regions);
          Storage.saveMigrations(this.migrations);
          this.render();
        });
      }
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('Удалить все маркеры, области и линии миграций? Это действие необратимо.')) {
        this.markers = [];
        this.regions = [];
        this.migrations = [];
        this.highlightedIds.clear();
        Storage.save(this.markers);
        Storage.saveRegions(this.regions);
        Storage.saveMigrations(this.migrations);
        this.render();
      }
    });

    document.getElementById('btn-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('btn-save').addEventListener('click', () => this.saveModal());

    document.addEventListener('click', (e) => {
      // Если прямо сейчас тащим тултип — не закрываем его
      if (isDraggingTooltip) return;

      const inTooltip = this.tooltip.contains(e.target);
      const isMarker = e.target.classList.contains('marker');
      const isRegion = e.target.classList.contains('region-polygon');
      if (!inTooltip && !isMarker && !isRegion) {
        this.tooltip.style.display = 'none';
        if (this.highlightedRegionId !== null) {
          this.highlightedRegionId = null;
          this.renderRegions();
        }
      }
    });

    document.getElementById('btn-open-list').addEventListener('click', () => {
      // Сброс всех фильтров справочника
      this.listFilter = new Set();
      this.listStatuses = new Set();
      this.listSpeciesIds = null;
      this.updateLayerFilterHighlight();
      this.updateStatusLayerHighlight();
      this.openSpeciesPanel('browse');
    });

    // --- Радиус зоны «поблизости» ---

    const nearbyDisplay = document.getElementById('nearby-radius-display');
    const nearbyInput = document.getElementById('nearby-radius-input');

    // Двойной клик по тексту — вход в режим редактирования
    if (nearbyDisplay && nearbyInput) {
      nearbyDisplay.addEventListener('dblclick', () => {
        nearbyInput.value = this.nearbyRadiusKm;
        nearbyDisplay.classList.add('hidden');
        nearbyInput.classList.remove('hidden');
        nearbyInput.focus();
        nearbyInput.select();
      });

      // Enter — применить
      nearbyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.setNearbyRadius(nearbyInput.value);
          nearbyInput.classList.add('hidden');
          nearbyDisplay.classList.remove('hidden');
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          // Отменяем — просто вернуть прежнее значение и спрятать input
          nearbyInput.value = this.nearbyRadiusKm;
          nearbyInput.classList.add('hidden');
          nearbyDisplay.classList.remove('hidden');
        }
      });

      // Потеря фокуса — тоже применить (это и есть 'change')
      nearbyInput.addEventListener('change', () => {
        this.setNearbyRadius(nearbyInput.value);
        nearbyInput.classList.add('hidden');
        nearbyDisplay.classList.remove('hidden');
      });
    }

// Кнопка-переключатель: Выделить всех / Снять выделение
// Действует только на ВИДИМЫЕ в справочнике виды (с учётом фильтров)
// Кнопка "Выделить всех / Снять выделение" — действует ТОЛЬКО на видимые виды
    document.getElementById('btn-species-toggle-all').addEventListener('click', () => {
      const visibleSpecies = this.getVisibleSpecies();
      const visibleIds = new Set(visibleSpecies.map(s => s.id));

      // Есть ли ХОТЬ ЧТО-ТО выделенное среди видимых видов?
      const hasAnyHighlighted = visibleSpecies.some(sp => {
        const hasMarker = this.markers.some(
          m => m.speciesId === sp.id && this.highlightedIds.has(m.id)
        );
        const hasRegion = this.highlightedSpeciesRegions.has(sp.id);
        const hasMigration = this.highlightedSpeciesMigrations.has(sp.id);
        return hasMarker || hasRegion || hasMigration;
      });

      if (hasAnyHighlighted) {
        // Снимаем выделение со ВСЕГО, не только с видимых:
        // пользователь ждёт «Снять выделение» = очистить карту полностью,
        // а не только в пределах текущего фильтра.
        this.highlightedIds.clear();
        this.highlightedSpeciesRegions.clear();
        this.highlightedSpeciesMigrations.clear();
        this.highlightedRegionId = null;
      } else {
        // Ничего не выделено — выделяем все видимые виды
        this.markers.forEach(m => {
          if (visibleIds.has(m.speciesId)) this.highlightedIds.add(m.id);
        });
        this.regions.forEach(r => {
          if (r.speciesList) {
            r.speciesList.forEach(sp => {
              if (visibleIds.has(sp.speciesId)) this.highlightedSpeciesRegions.add(sp.speciesId);
            });
          }
        });
        this.migrations.forEach(m => {
          if (m.speciesId && visibleIds.has(m.speciesId)) {
            this.highlightedSpeciesMigrations.add(m.speciesId);
          }
        });
      }

      this.render();
      this.renderSpeciesTree(document.getElementById('species-search').value.trim().toLowerCase());
      this.updateSpeciesBrowseCounter();
    });

    // Кнопка-переключатель (3 состояния): Развернуть всё -> Показать больше -> Свернуть всё
    document.getElementById('btn-species-toggle-expand').addEventListener('click', (e) => {
      const btn = e.target;
      
      // Переключаем состояние по кругу: 0 -> 1 -> 2 -> 0
      this.expandState = (this.expandState + 1) % 3;

      const groups = document.querySelectorAll('#species-tree .species-group');
      const browseItems = document.querySelectorAll('#species-tree .species-browse-children');

      if (this.expandState === 0) {
        // 1. Свернуть всё
        groups.forEach(el => {
          el.classList.add('collapsed');
          const icon = el.querySelector('.toggle-icon');
          if (icon) icon.textContent = '▶';
        });
        browseItems.forEach(el => el.classList.add('collapsed'));
        btn.textContent = 'Развернуть всё';
        
      } else if (this.expandState === 1) {
        // 2. Развернуть все группы (иерархию), но виды оставить свернутыми
        groups.forEach(el => {
          el.classList.remove('collapsed');
          const icon = el.querySelector('.toggle-icon');
          if (icon) icon.textContent = '▼';
        });
        browseItems.forEach(el => el.classList.add('collapsed'));
        btn.textContent = 'Показать больше';
        
      } else if (this.expandState === 2) {
        // 3. Показать больше (развернуть всё, включая данные видов)
        groups.forEach(el => {
          el.classList.remove('collapsed');
          const icon = el.querySelector('.toggle-icon');
          if (icon) icon.textContent = '▼';
        });
        browseItems.forEach(el => el.classList.remove('collapsed'));
        btn.textContent = 'Свернуть всё';
      }
    });

    /*// Галочка «На карте показывать только выделенные» в справочнике
    document.getElementById('toggle-species-only-highlighted').addEventListener('change', (e) => {
      this.mapOnlyHighlighted = e.target.checked;
      this.render();
      this.renderSpeciesTree(document.getElementById('species-search').value.trim().toLowerCase());
      this.updateSpeciesBrowseCounter();
    });*/

    // Показ/скрытие маркеров
    document.getElementById('toggle-markers').addEventListener('change', (e) => {
      this.showMarkers = e.target.checked;
      this.render();
    });

    // Показ/скрытие областей обитания
    document.getElementById('toggle-regions').addEventListener('change', (e) => {
      this.showRegions = e.target.checked;
      this.renderRegions();
    });

    // Показ/скрытие линий миграций
    document.getElementById('toggle-migrations').addEventListener('change', (e) => {
      this.showMigrations = e.target.checked;
      this.renderRegions();
    });  

    // Режим рисования области
    document.getElementById('btn-region-mode').addEventListener('click', () => {
      this.toggleRegionMode(!this.regionMode);
    });

    // Завершить область
    document.getElementById('btn-region-finish').addEventListener('click', () => {
      this.finishRegion();
    });

    // Отменить рисование
    document.getElementById('btn-region-cancel').addEventListener('click', () => {
      this.cancelRegion();
    });

    // Режим рисования миграции
    document.getElementById('btn-migration-mode').addEventListener('click', () => {
      this.toggleMigrationMode(!this.migrationMode);
    });

    // Отменить рисование линии
    document.getElementById('btn-migration-cancel').addEventListener('click', () => {
      this.cancelMigration();
    });

    // Модалка миграции — клик по полю открывает справочник
    document.getElementById('migration-species').addEventListener('click', () => {
      this.pickingMigrationSpecies = true;
      this.openSpeciesPanel('pick');
    });

    // Сохранить линию миграции
    document.getElementById('btn-migration-save').addEventListener('click', () => {
      this.saveMigration();
    });

    // Отмена модалки миграции
    document.getElementById('btn-migration-cancel-modal').addEventListener('click', () => {
      this.closeMigrationModal();
    });  

    // Модалка области — клик по полю открывает справочник
    document.getElementById('region-species').addEventListener('click', () => {
      this.pickingRegionSpecies = true;
      this.openSpeciesPanel('pick');
    });

    // Интенсивность
    document.getElementById('region-intensity').addEventListener('click', (e) => {
      const btn = e.target.closest('.intensity-btn');
      if (!btn) return;
      this.selectedRegionIntensity = btn.dataset.intensity;
      this.renderIntensityButtons();
    });

    // Сохранить область
    document.getElementById('btn-region-save').addEventListener('click', () => {
      this.saveRegion();
    });

    // Отмена области
    document.getElementById('btn-region-cancel-modal').addEventListener('click', () => {
      this.closeRegionModal();
    });

        // Свиток о виде — закрытие
    document.getElementById('scroll-close').addEventListener('click', () => {
      this.closeSpeciesScroll();
    });

    // Клик по затемнённому фону — тоже закрывает свиток
    document.getElementById('species-scroll').addEventListener('click', (e) => {
      if (e.target.id === 'species-scroll') {
        this.closeSpeciesScroll();
      }
    });

    // Escape — закрывает свиток
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const scroll = document.getElementById('species-scroll');
        if (scroll && !scroll.classList.contains('hidden')) {
          this.closeSpeciesScroll();
        }
      }
    });

    // Модалка маркера — клик по полю открывает справочник
    document.getElementById('input-species').addEventListener('click', () => {
      this.openSpeciesPanel('pick');
    });

    document.getElementById('btn-species-close').addEventListener('click', () => {
      document.getElementById('species-panel').classList.add('hidden');
      this.speciesPanelMode = 'pick';
      setTimeout(() => this.updateMarkerPositions(), 300);
    });

    document.getElementById('species-search').addEventListener('input', (e) => {
      this.renderSpeciesTree(e.target.value.trim().toLowerCase());
    });

    // Переключатель иерархия / алфавит в справочнике
    document.getElementById('btn-species-view-tree').addEventListener('click', () => {
      this.speciesView = 'tree';
      document.getElementById('btn-species-view-tree').classList.add('active');
      document.getElementById('btn-species-view-alpha').classList.remove('active');
      this.renderSpeciesTree(document.getElementById('species-search').value.trim().toLowerCase());
    });

    document.getElementById('btn-species-view-alpha').addEventListener('click', () => {
      this.speciesView = 'alpha';
      document.getElementById('btn-species-view-alpha').classList.add('active');
      document.getElementById('btn-species-view-tree').classList.remove('active');
      this.renderSpeciesTree(document.getElementById('species-search').value.trim().toLowerCase());
    });

    // Показ/скрытие шильдика редкости
    document.getElementById('toggle-badges').addEventListener('change', (e) => {
      this.showBadges = e.target.checked;
      this.render();
    });

    // Показ/скрытие иконок категорий
    document.getElementById('toggle-icons').addEventListener('change', (e) => {
      this.showIcons = e.target.checked;
      this.render();
    });

    // Анимация мигания подсвеченных маркеров
    // (убран из UI — подсветка теперь всегда включена,
    //  но код оставлен на случай возврата)
    // document.getElementById('toggle-highlight-anim').addEventListener('change', (e) => {
    //   this.showHighlightAnim = e.target.checked;
    //   this.render();
    // });

    // Серийный режим — кнопка-переключатель
    document.getElementById('btn-serial').addEventListener('click', () => {
      this.setSerialMode(!this.serialMode);
    });

    // «Скрыть объекты на карте» — снимаем выделение и включаем «только выделенные»
    document.getElementById('btn-hide-all').addEventListener('click', () => {
      this.highlightedIds.clear();
      this.highlightedSpeciesRegions.clear();
      this.highlightedSpeciesMigrations.clear();
      this.highlightedRegionId = null;

      this.mapOnlyHighlighted = true;
      const toggle = document.getElementById('toggle-species-only-highlighted');
      if (toggle) toggle.checked = true;

      this.render();

      // Если справочник открыт в режиме browse — обновим счётчик
      if (this.speciesPanelMode === 'browse' &&
        !document.getElementById('species-panel').classList.contains('hidden')) {
        this.updateSpeciesBrowseCounter();
      }
    });

    // «Отобразить выбранный вид» — подсвечиваем текущий вид из серийного режима
    document.getElementById('btn-show-selected').addEventListener('click', () => {
      if (!this.lastUsed) {
        alert('Сначала задайте вид для серии (кнопка «Задать вид для серии»).');
        return;
      }

      const sid = this.lastUsed.speciesId;

      // Включаем режим «показывать только выделенные», если он был выключен
      this.mapOnlyHighlighted = true;

      // Очищаем все предыдущие выделения
      this.highlightedIds.clear();
      this.highlightedSpeciesRegions.clear();
      this.highlightedSpeciesMigrations.clear();
      this.highlightedRegionId = null;

      // Добавляем маркеры
      this.markers.forEach(m => {
        if (m.speciesId === sid) this.highlightedIds.add(m.id);
      });

      // Добавляем области
      this.regions.forEach(r => {
        if (r.speciesList) {
          r.speciesList.forEach(sp => {
            if (sp.speciesId === sid) this.highlightedSpeciesRegions.add(sp.speciesId);
          });
        }
      });

      // Добавляем миграции
      this.migrations.forEach(m => {
        if (m.speciesId === sid) this.highlightedSpeciesMigrations.add(m.speciesId);
        // Проверяем также массивы speciesList у миграций
        if (m.speciesList) {
          m.speciesList.forEach(sp => {
            if (sp.speciesId === sid) this.highlightedSpeciesMigrations.add(sp.speciesId);
          });
        }
      });

      this.render();

      // Если справочник открыт — обновляем счётчик
      if (this.speciesPanelMode === 'browse' &&
        !document.getElementById('species-panel').classList.contains('hidden')) {
        this.updateSpeciesBrowseCounter();
      }
    });

    // «Задать/Сменить вид для серии» — открывает модалку в зависимости от подрежима
    document.getElementById('btn-serial-change-species').addEventListener('click', () => {
      // Если активен режим областей — модалка области (без точек)
      if (this.regionMode) {
        this.openRegionModalForSerial();
        return;
      }
      // Если активен режим миграций — модалка миграции (без точек)
      if (this.migrationMode) {
        this.openMigrationModalForSerial();
        return;
      }
      // Иначе — обычная модалка маркера
      this.pendingMarker = null;
      this.isSettingSerial = true;
      this.openModal();
    });

    // --- Зум колесом мыши ---
    this.container.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // --- Панорамирование мышью ---
    this.container.addEventListener('mousedown', (e) => this.onPanStart(e));
    window.addEventListener('mousemove', (e) => this.onPanMove(e));
    window.addEventListener('mouseup', () => this.onPanEnd());

      // ============================================================
    // ПЕРЕТАСКИВАНИЕ ТУЛТИПА МЫШЬЮ
    // ============================================================
    let isDraggingTooltip = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let tooltipStartLeft = 0;
    let tooltipStartTop = 0;

    this.tooltip.addEventListener('mousedown', (e) => {
      // Тянем только за "ручку" (заголовок)
      const handle = e.target.closest('.tooltip-drag-handle');
      if (!handle) return;

      e.preventDefault(); // Чтобы не выделялся текст при перетаскивании
      
      isDraggingTooltip = true;
      
      // Запоминаем, где мышка, и где был тултип
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      tooltipStartLeft = parseInt(this.tooltip.style.left) || 0;
      tooltipStartTop = parseInt(this.tooltip.style.top) || 0;
      
      this.tooltip.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingTooltip) return;
      
      // Вычисляем, насколько сдвинулась мышь
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      
      // Применяем сдвиг к тултипу
      this.tooltip.style.left = (tooltipStartLeft + dx) + 'px';
      this.tooltip.style.top = (tooltipStartTop + dy) + 'px';
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingTooltip) {
        isDraggingTooltip = false;
        this.tooltip.style.cursor = 'default';
      }
    });  
  },

    // ============================================================
  // Зум колесом мыши (к курсору)
  // ============================================================
  onWheel(e) {
    // Если курсор над тултипом или подменю — не зумим карту, даем проскроллить контент
    if (e.target.closest('#tooltip') || e.target.closest('.layer-submenu') || e.target.closest('#species-panel') || e.target.closest('#species-scroll')) {
      return;
    }

    e.preventDefault();

    const rect = this.container.getBoundingClientRect();

    // Позиция курсора относительно контейнера
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Текущий масштаб
    const oldZoom = this.zoom;

    // Определяем новый масштаб
    const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    let newZoom = oldZoom * delta;
    newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

    if (newZoom === oldZoom) return;

    // Магия: точка под курсором остаётся на месте
    // Формула: pan_new = mouse - (mouse - pan_old) * (newZoom / oldZoom)
    this.panX = mouseX - (mouseX - this.panX) * (newZoom / oldZoom);
    this.panY = mouseY - (mouseY - this.panY) * (newZoom / oldZoom);
    this.zoom = newZoom;

    // Если вернулись к 1x — сбрасываем сдвиг
    if (this.zoom <= this.minZoom) {
      this.zoom = this.minZoom;
      this.panX = 0;
      this.panY = 0;
    }

    this.applyTransform();
  },

  // ============================================================
  // Панорамирование (перетаскивание карты)
  // ============================================================
  onPanStart(e) {
    // Только левая кнопка мыши
    if (e.button !== 0) return;

    // Не начинаем панорамирование, если кликнули по маркеру
    if (e.target.classList.contains('marker')) return;

    // Не начинаем панорамирование, если кликнули внутри тултипа
    if (this.tooltip.contains(e.target)) return;

    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panStartPanX = this.panX;
    this.panStartPanY = this.panY;

    this.container.classList.add('panning');
    e.preventDefault();
  },

  onPanMove(e) {
    if (!this.isPanning) return;

    const dx = e.clientX - this.panStartX;
    const dy = e.clientY - this.panStartY;

    this.panX = this.panStartPanX + dx;
    this.panY = this.panStartPanY + dy;

    this.applyTransform();
  },

  onPanEnd() {
    if (!this.isPanning) return;
    this.isPanning = false;
    this.container.classList.remove('panning');
  },

  // ============================================================
  // Применяем transform к обёртке карты
  // ============================================================
  applyTransform() {
    const wrapper = document.getElementById('map-wrapper');
    if (!wrapper) return;

    wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;

    // Маркеры вне wrapper'а — пересчитываем их позиции через rAF,
    // чтобы не дёргать layout на каждый пиксель движения мыши.
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      this.updateMarkerPositions();
    });
  },

  // Кратковременно мигает указанными маркерами.
  // idsArray — массив id маркеров.
  flashMarkers(idsArray, options = {}) {
    // Опция: спрятать тултип на время мигания (чтобы увидеть карту)
    const hideTooltip = options.hideTooltip === true;

    // Если просят спрятать — запоминаем позицию и скрываем
    let savedTooltipState = null;
    if (hideTooltip && this.tooltip.style.display === 'block') {
      savedTooltipState = {
        left: this.tooltip.style.left,
        top: this.tooltip.style.top
      };
      this.tooltip.style.display = 'none';
    }

    // Сбрасываем предыдущий таймер, если был
    if (this._flashTimer) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }

    // Ставим новые id и перерисовываем — маркеры получат класс highlighted
    this.flashingIds = new Set(idsArray);
    this.render();

    // Через 1.2 секунды снимаем мигание и возвращаем тултип
    this._flashTimer = setTimeout(() => {
      this.flashingIds.clear();
      this._flashTimer = null;
      this.render();

      // Возвращаем тултип на прежнее место
      if (savedTooltipState) {
        this.tooltip.style.left = savedTooltipState.left;
        this.tooltip.style.top = savedTooltipState.top;
        this.tooltip.style.display = 'flex';
      }
    }, 1200);
  },

  // ============================================================
  // СВИТОК О ВИДЕ
  // ============================================================

  // Открывает полноэкранное окно с крупной мини-картой вида
  openSpeciesMiniMapFull(speciesId) {
    // 1. Создаём оверлей
    const overlay = document.createElement('div');
    overlay.id = 'species-map-fullscreen';
    
    // 2. Получаем HTML карты (используем уже написанный метод)
    const mapHtml = this.renderSpeciesMiniMap(speciesId);
    
    // 3. Находим вид для заголовка
    const sp = this.findSpeciesById(speciesId);
    const name = sp ? sp.name : 'Карта';

    overlay.innerHTML = `
      <div class="fullscreen-map-content">
        <div class="fullscreen-map-header">
          <h3>${name}</h3>
          <button class="fullscreen-map-close" title="Закрыть">✕</button>
        </div>
        <div class="fullscreen-map-body">
          ${mapHtml}
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);

    // 4. Навешиваем обработчики
    const closeBtn = overlay.querySelector('.fullscreen-map-close');
    closeBtn.addEventListener('click', () => overlay.remove());
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  },

  openSpeciesScroll(speciesId, markerId = null) {
    const scroll = document.getElementById('species-scroll');
    const body = document.getElementById('scroll-body');
    if (!scroll || !body) return;

    // Показываем окно сразу — с индикатором загрузки
    body.innerHTML = '<div class="scroll-loading">Загрузка данных…</div>';
    scroll.classList.remove('hidden');

    // Запоминаем, с какого маркера открыли (если открыли)
    this._scrollOriginMarkerId = markerId;

    // Пытаемся найти вид в справочнике species.js (для имени, латыни, статуса)
    const speciesMeta = this.findSpeciesById(speciesId);

    // Загружаем подробные данные из JSON
    SpeciesLoader.load(speciesId).then(data => {
      if (data) {
        body.innerHTML = this.renderSpeciesScroll(data, markerId);
      } else {
        body.innerHTML = this.renderEmptyScroll(speciesId, speciesMeta, markerId);
      }
      const scrollBody = body.querySelector('.scroll-body-scroll');
      if (scrollBody) scrollBody.scrollTop = 0;

      // Клик по глобусу — открыть карту
      const globeBtn = body.querySelector('#scroll-photo-globe-btn');
      if (globeBtn) {
        globeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.openSpeciesMiniMapFull(data.id);
        });
      }

      // Обработчики клика по соседям — открываем их свитки
      body.querySelectorAll('.scroll-nearby-item').forEach(item => {
        item.addEventListener('click', () => {
          const sid = item.dataset.speciesId;
          if (sid) this.openSpeciesScroll(sid);
        });
      });
    });
  },

  // Рисует статичную мини-карту вида: img/map3.png + SVG-слой
  // с маркерами, областями и миграциями ТОЛЬКО этого вида.
  renderSpeciesMiniMap(speciesId) {
    if (!speciesId) return '';

    const myMarkers = this.markers.filter(m => m.speciesId === speciesId);
    const myRegions = this.regions.filter(r =>
      r.speciesList && r.speciesList.some(sp => sp.speciesId === speciesId)
    );
    const myMigrations = this.migrations.filter(m => {
      if (m.speciesId === speciesId) return true;
      if (m.speciesList && m.speciesList.some(sp => sp.speciesId === speciesId)) return true;
      return false;
    });

    const hasMarkers = myMarkers.length > 0;
    const hasRegions = myRegions.length > 0;
    const hasMigrations = myMigrations.length > 0;

    const emptyHint = (!hasMarkers && !hasRegions && !hasMigrations)
      ? `<div class="scroll-photo-map-empty">На карте пока нет данных о виде</div>`
      : '';

    const markersHtml = myMarkers.map(m => {
      const catConfig = CONFIG.categories.find(c => c.key === m.category);
      const statusConfig = CONFIG.statuses.find(s => s.value === m.status);
      const formatSet = (m.category === 'animals')
        ? CONFIG.markers.animals
        : CONFIG.markers.plants;
      const fmt = formatSet.find(f => f.key === m.markerType);

      const color = fmt ? fmt.color : (catConfig ? catConfig.color : '#999');
      const symbol = fmt ? fmt.symbol : '●';

      return `
        <div class="scroll-photo-marker"
             style="left:${m.x}%;top:${m.y}%;color:${color};">
          ${symbol}
          ${statusConfig ? `<span class="scroll-photo-marker-badge"
              style="background:${statusConfig.color};">${statusConfig.value}</span>` : ''}
        </div>
      `;
    }).join('');

    const regionPolygons = myRegions.map(r => {
      const intensity = r.intensity || 'weak';
      const pts = r.points.map(([x, y]) => `${x},${y}`).join(' ');
      return `<polygon points="${pts}"
                        class="scroll-photo-region ${intensity}" />`;
    }).join('');

    const arrowDefs = hasMigrations ? `
      <defs>
        <marker id="scroll-arrow-end" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="3" markerHeight="3" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1a3a2e" />
        </marker>
        <marker id="scroll-arrow-start" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="3" markerHeight="3" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#1a3a2e" />
        </marker>
      </defs>
    ` : '';

    const migrationLines = myMigrations.map(mig => {
      if (!mig.points || mig.points.length < 2) return '';
      const [p1, p2] = mig.points;
      return `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"
                    class="scroll-photo-migration"
                    marker-start="url(#scroll-arrow-start)"
                    marker-end="url(#scroll-arrow-end)" />`;
    }).join('');

    return `
      <div class="scroll-photo-map-wrap">
        <!-- Обертка с точными пропорциями карты map3.png (1103 x 1600) -->
        <div class="scroll-photo-map-inner">
          <img src="img/map3.png" alt="Карта распространения" class="scroll-photo-map-img">
          <svg class="scroll-photo-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${arrowDefs}
            ${regionPolygons}
            ${migrationLines}
          </svg>
          <div class="scroll-photo-map-markers">${markersHtml}</div>
        </div>
        ${emptyHint}
        <div class="scroll-photo-map-legend">
          ${hasMarkers    ? `<span>📍 ${myMarkers.length} марк.</span>` : ''}
          ${hasRegions    ? `<span>🌍 ${myRegions.length} обл.</span>` : ''}
          ${hasMigrations ? `<span>⇔ ${myMigrations.length} мигр.</span>` : ''}
        </div>
      </div>
    `;
  },

  // Рисует полный свиток по данным JSON
    renderSpeciesScroll(data, markerId = null) {
      const statusConfig = CONFIG.statuses.find(s => s.value === data.status);

    // ---- Фотография с кнопкой карты ----
    const photoHtml = `
      <figure class="scroll-figure scroll-figure-flip" style="position: relative;">
        <img class="scroll-photo"
             src="img/species/${data.id}.png"
             alt="${escapeHtml(data.name)}"
             onerror="this.parentNode.innerHTML='&lt;div class=\\'scroll-photo-placeholder\\'&gt;Фотография пока не добавлена&lt;/div&gt;'">
        
        <!-- Кнопка-глобус для открытия карты -->
        <button type="button" class="scroll-photo-globe-btn"
                id="scroll-photo-globe-btn" title="Показать карту распространения">
          🌍
        </button>
        
        <figcaption class="scroll-caption">${escapeHtml(data.latin)}</figcaption>
      </figure>
    `;

    // ---- Левая колонка: таксономия ----
    const taxonomyHtml = `
      <dl class="scroll-taxonomy">
        ${data.order ? `<dt>Отряд</dt><dd>${data.order}</dd>` : ''}
        ${data.family ? `<dt>Семейство</dt><dd>${data.family}</dd>` : ''}
        ${data.taxonomic_position ? `<dt>Таксономическое положение</dt><dd>${data.taxonomic_position}</dd>` : ''}
      </dl>
    `;

      // ---- Секции описания (аккордеон через <details>) ----
      const sections = [
        { title: 'Краткое описание вида', key: 'description_short', dropcap: true, openByDefault: true },
        { title: 'Общее распространение', key: 'spread_general' },
        { title: 'Распространение в Омской области', key: 'spread_omsk' },
        { title: 'Места обитания', key: 'habitats' },
        { title: 'Численность и тенденции её изменения', key: 'abundance' },
        { title: 'Особенности биологии и экологии', key: 'biology' },
        { title: 'Лимитирующие факторы', key: 'limiting_factors' },
        { title: 'Меры охраны', key: 'protection_measures' },
        { title: 'Источники информации', key: 'sources' }
      ];

      let sectionsHtml = '';
      sections.forEach(sec => {
        if (data[sec.key]) {
          const cls = sec.dropcap ? 'scroll-section scroll-dropcap' : 'scroll-section';
          const openAttr = sec.openByDefault ? ' open' : '';
          sectionsHtml += `
          <details class="scroll-block"${openAttr}>
            <summary class="scroll-heading">${sec.title}</summary>
            <div class="${cls}">${escapeHtml(data[sec.key])}</div>
          </details>
        `;
        }
      });

    // ---- Авторы ----
      const authorsHtml = data.authors
        ? `<section class="scroll-block scroll-authors">
           <h4 class="scroll-heading">Авторы-составители</h4>
           <div class="scroll-section">${escapeHtml(data.authors)}</div>
         </section>`
        : '';

    // ---- Счётчики ----
    const markerCount = this.markers.filter(m => m.speciesId === data.id).length;
    const regionCount = this.regions.filter(r => r.speciesId === data.id).length;
    const migrationCount = this.migrations.filter(m => m.speciesId === data.id).length;

    const countsHtml = (markerCount > 0 || regionCount > 0 || migrationCount > 0) ? `
      <div class="scroll-counts">
        ${markerCount > 0 ? `<div class="scroll-count-item">📍 <strong>${markerCount}</strong> маркеров на карте</div>` : ''}
        ${regionCount > 0 ? `<div class="scroll-count-item">🌍 <strong>${regionCount}</strong> областей обитания</div>` : ''}
        ${migrationCount > 0 ? `<div class="scroll-count-item">⇔ <strong>${migrationCount}</strong> линий миграций</div>` : ''}
      </div>
    ` : '';

    // ---- Текст статуса: если у вида свой, берём его; иначе — типовой из config ----
    const statusDescription = (data.status_text || '').trim() || (statusConfig ? statusConfig.description : '');

    // ---- Финальная сборка ----
      return `
      <div class="scroll-fixed-header">
        <header class="scroll-titlebar">
          <div class="scroll-titlebar-left"></div>
          <div class="scroll-titlebar-right">КРАСНАЯ КНИГА ОМСКОЙ ОБЛАСТИ</div>
        </header>
        <h2 class="scroll-name">${escapeHtml(data.name)}</h2>
        <div class="scroll-latin">${escapeHtml(data.latin)}</div>
      </div>

      <div class="scroll-body-scroll">
        ${statusDescription ? `
          <div class="scroll-status-block">
            <div class="scroll-status-seal">
              <svg viewBox="0 0 100 100" width="60" height="60" aria-hidden="true">
                <!-- внешний цветной круг -->
                <circle cx="50" cy="50" r="46"
                        fill="${statusConfig ? statusConfig.color : '#666'}"
                        stroke="rgba(255,255,255,0.9)"
                        stroke-width="2"/>
                <!-- тонкая внешняя золотая обводка -->
                <circle cx="50" cy="50" r="48"
                        fill="none"
                        stroke="rgba(138,106,30,0.7)"
                        stroke-width="1"/>
                <!-- пунктирная внутренняя — эффект «оттиска» -->
                <circle cx="50" cy="50" r="38"
                        fill="none"
                        stroke="rgba(255,255,255,0.55)"
                        stroke-width="1.2"
                        stroke-dasharray="3 3"/>
                <!-- цифра по центру -->
                <text x="50" y="64"
                      text-anchor="middle"
                      font-family="system-ui, 'Segoe UI', Arial, sans-serif"
                      font-size="42"
                      font-weight="bold"
                      fill="#ffffff"
                      style="paint-order: stroke; stroke: rgba(0,0,0,0.15); stroke-width: 1px;">
                  ${statusConfig ? statusConfig.value : '?'}
                </text>
              </svg>
            </div>
            <div class="scroll-status-body">
              <div class="scroll-status-caption">
                Статус ${statusConfig ? statusConfig.value : ''} · ${statusConfig ? statusConfig.label : ''}
              </div>
              <div class="scroll-status-text">${statusDescription}</div>
            </div>
          </div>
        ` : ''}
        <div class="scroll-columns">
          <div class="scroll-col-left">
            ${sectionsHtml}
            ${authorsHtml}
            ${countsHtml}
          </div>
          <div class="scroll-col-right">
            ${photoHtml}
            ${taxonomyHtml}
          </div>
        </div>
        ${this.renderScrollNeighbours(data.id, markerId)}
      </div>
    `;
  },

  // Рисует минимальный свиток, если JSON не найден
    renderEmptyScroll(speciesId, speciesMeta, markerId = null) {
    if (!speciesMeta) {
      return `<div class="scroll-empty">Данные о виде отсутствуют.</div>`;
    }

    const statusConfig = CONFIG.statuses.find(s => s.value === speciesMeta.status);
    const markerCount = this.markers.filter(m => m.speciesId === speciesId).length;
    const regionCount = this.regions.filter(r => r.speciesId === speciesId).length;
    const migrationCount = this.migrations.filter(m => m.speciesId === speciesId).length;
    const statusDescription = statusConfig ? statusConfig.description : '';

    return `
      <div class="scroll-fixed-header">
        <header class="scroll-titlebar">
          <div class="scroll-titlebar-left"></div>
          <div class="scroll-titlebar-right">КРАСНАЯ КНИГА ОМСКОЙ ОБЛАСТИ</div>
        </header>
        <h2 class="scroll-name">${speciesMeta.name}</h2>
        <div class="scroll-latin">${speciesMeta.latin || ''}</div>
      </div>

      <div class="scroll-body-scroll">
        ${statusDescription ? `
          <div class="scroll-status-block">
            <div class="scroll-status-seal">
              <svg viewBox="0 0 100 100" width="60" height="60" aria-hidden="true">
                <!-- внешний цветной круг -->
                <circle cx="50" cy="50" r="46"
                        fill="${statusConfig ? statusConfig.color : '#666'}"
                        stroke="rgba(255,255,255,0.9)"
                        stroke-width="2"/>
                <!-- тонкая внешняя золотая обводка -->
                <circle cx="50" cy="50" r="48"
                        fill="none"
                        stroke="rgba(138,106,30,0.7)"
                        stroke-width="1"/>
                <!-- пунктирная внутренняя — эффект «оттиска» -->
                <circle cx="50" cy="50" r="38"
                        fill="none"
                        stroke="rgba(255,255,255,0.55)"
                        stroke-width="1.2"
                        stroke-dasharray="3 3"/>
                <!-- цифра по центру -->
                <text x="50" y="64"
                      text-anchor="middle"
                      font-family="system-ui, 'Segoe UI', Arial, sans-serif"
                      font-size="42"
                      font-weight="bold"
                      fill="#ffffff"
                      style="paint-order: stroke; stroke: rgba(0,0,0,0.15); stroke-width: 1px;">
                  ${statusConfig ? statusConfig.value : '?'}
                </text>
              </svg>
            </div>
            <div class="scroll-status-body">
              <div class="scroll-status-caption">
                Статус ${statusConfig ? statusConfig.value : ''} · ${statusConfig ? statusConfig.label : ''}
              </div>
              <div class="scroll-status-text">${statusDescription}</div>
            </div>
          </div>
        ` : ''}
        <div class="scroll-empty">
          <strong>Подробные данные о виде пока не добавлены</strong>
          Их можно добавить в файл <code>data/species/${speciesId}.json</code>
        </div>

        ${(markerCount > 0 || regionCount > 0 || migrationCount > 0) ? `
          <div class="scroll-counts">
            ${markerCount > 0 ? `<div class="scroll-count-item">📍 <strong>${markerCount}</strong> маркеров на карте</div>` : ''}
            ${regionCount > 0 ? `<div class="scroll-count-item">🌍 <strong>${regionCount}</strong> областей обитания</div>` : ''}
            ${migrationCount > 0 ? `<div class="scroll-count-item">⇔ <strong>${migrationCount}</strong> линий миграций</div>` : ''}
          </div>
        ` : ''}

        ${this.renderScrollNeighbours(speciesId, markerId)}
      </div>
    `;
  },

  closeSpeciesScroll() {
    const scroll = document.getElementById('species-scroll');
    if (scroll) scroll.classList.add('hidden');
  },

  // Рисует блоки «Входит в области обитания» и «Также поблизости»
  // для свитка о виде. Если markerId задан — берёт данные ТОЛЬКО
  // для этого маркера, иначе — по всем маркерам вида.
  renderScrollNeighbours(speciesId, markerId = null) {

    // Определяем, откуда брать маркеры
    let sourceMarkers;
    let fromMarker = false;

    if (markerId !== null) {
      const m = this.markers.find(x => x.id === markerId);
      sourceMarkers = m ? [m] : [];
      fromMarker = true;
    } else {
      sourceMarkers = this.markers.filter(m => m.speciesId === speciesId);
    }

    if (sourceMarkers.length === 0) return '';

    // Хелпер для получения названия класса вида
    const getClassLabel = (sid) => {
      let classLabel = 'Без класса';
      if (sid) {
        const searchClass = (node, path) => {
          if (node.species && node.species.some(s => s.id === sid)) {
            const classNode = path.slice().reverse().find(p =>
              p.startsWith('Класс') || p.startsWith('Отдел') || p.startsWith('Семейство') || p.startsWith('Порядок')
            );
            return classNode || path[path.length - 1] || node.label;
          }
          if (node.classes) {
            for (const c of node.classes) {
              const res = searchClass(c, [...path, c.label]);
              if (res) return res;
            }
          }
          if (node.orders) {
            for (const o of node.orders) {
              const res = searchClass(o, [...path, o.label]);
              if (res) return res;
            }
          }
          return null;
        };
        const category = this.detectCategory(sid);
        const groupData = SPECIES[category];
        if (groupData) classLabel = searchClass(groupData, [groupData.label]) || 'Другие виды';
      }
      return this.shortNodeLabel(classLabel);
    };

    // ---- 1. Области обитания ----
    const regionSpeciesIds = new Set();
    sourceMarkers.forEach(m => {
      const here = this.findRegionsAtPoint(m.x, m.y);
      here.forEach(r => {
        if (r.speciesList) {
          r.speciesList.forEach(sp => {
            if (sp.speciesId !== speciesId) {
              regionSpeciesIds.add(sp.speciesId);
            }
          });
        }
      });
    });

    let regionsHtml = '';
    if (regionSpeciesIds.size > 0) {
      // Группируем по классам
      const grouped = new Map();
      regionSpeciesIds.forEach(sid => {
        const sp = this.findSpeciesById(sid);
        if (!sp) return;
        const cls = getClassLabel(sid);
        if (!grouped.has(cls)) grouped.set(cls, []);
        grouped.get(cls).push(sp);
      });

      const items = [...grouped.entries()].map(([cls, speciesArr]) => {
        const list = speciesArr.map(sp => `
          <li class="scroll-nearby-item" data-species-id="${sp.id}" style="cursor:pointer;">
            <span class="scroll-nearby-name">${sp.name}</span>
          </li>
        `).join('');

        return `
          <details class="taxonomy-group">
            <summary class="nearby-title" style="cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 6px 0;">
              <span style="font-size:10px; color:var(--gold-deep);">▶</span>
              <span style="font-size: 12px;">${cls}</span>
              <span style="color:#7a2d2d; font-size: 11px; font-weight: normal;">(${speciesArr.length})</span>
            </summary>
            <ul class="scroll-neighbours-list" style="margin-top: 4px; padding-left: 12px;">${list}</ul>
          </details>
        `;
      }).join('');

      regionsHtml = `
        <details class="scroll-neighbours-block scroll-block">
          <summary class="scroll-heading">Входит в области обитания${fromMarker ? ' (для выбранного маркера)' : ''}</summary>
          <div style="margin-top: 8px;">${items}</div>
        </details>
      `;
    }

    // ---- 2. Соседние маркеры (также поблизости) ----
    const nearbyGroups = new Map();
    sourceMarkers.forEach(m => {
      const nearby = this.findNearbyMarkers(m);
      nearby.forEach(n => {
        if (n.marker.speciesId === speciesId) return;
        const key = n.marker.speciesId || n.marker.name;
        if (!nearbyGroups.has(key)) {
          nearbyGroups.set(key, { marker: n.marker, count: 1, minDistance: n.distance });
        } else {
          const g = nearbyGroups.get(key);
          g.count++;
          if (n.distance < g.minDistance) g.minDistance = n.distance;
        }
      });
    });

    let nearbyHtml = '';
    if (nearbyGroups.size > 0) {
      const groupsArr = [...nearbyGroups.values()];
      // Группируем по классам
      const grouped = new Map();
      groupsArr.forEach(g => {
        const cls = getClassLabel(g.marker.speciesId);
        if (!grouped.has(cls)) grouped.set(cls, []);
        grouped.get(cls).push(g);
      });

      // Внутри каждого класса сортируем по расстоянию
      grouped.forEach((arr) => arr.sort((a, b) => a.minDistance - b.minDistance));

      const items = [...grouped.entries()].map(([cls, groupsArr]) => {
        const list = groupsArr.map(g => {
          const m = g.marker;
          const sp = this.findSpeciesById(m.speciesId);
          const st = CONFIG.statuses.find(s => s.value === m.status);
          const cat = CONFIG.categories.find(c => c.key === m.category);
          const icon = cat ? (cat.icon || '●') : '●';
          const name = sp ? sp.name : m.name;
          const countLabel = g.count > 1 ? ` <span class="scroll-nearby-count">×${g.count}</span>` : '';
          const statusBadge = st
            ? `<span class="scroll-nearby-status" style="background:${st.color}" title="${st.value} — ${st.label}">${st.value}</span>`
            : '';
          return `
            <li class="scroll-nearby-item" data-species-id="${m.speciesId}">
              <span class="scroll-nearby-icon">${icon}</span>
              <span class="scroll-nearby-name">${name}${countLabel}</span>
              ${statusBadge}
            </li>
          `;
        }).join('');

        return `
          <details class="taxonomy-group">
            <summary class="nearby-title" style="cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 6px 0;">
              <span style="font-size:10px; color:var(--gold-deep);">▶</span>
              <span style="font-size: 12px;">${cls}</span>
              <span style="color:#7a2d2d; font-size: 11px; font-weight: normal;">(${groupsArr.length})</span>
            </summary>
            <ul class="scroll-neighbours-list nearby" style="margin-top: 4px; padding-left: 12px;">${list}</ul>
          </details>
        `;
      }).join('');

      nearbyHtml = `
        <details class="scroll-neighbours-block scroll-block">
          <summary class="scroll-heading">Также поблизости${fromMarker ? ' (для выбранного маркера)' : ''}</summary>
          <div style="margin-top: 8px;">${items}</div>
        </details>
      `;
    }

    if (!regionsHtml && !nearbyHtml) return '';
    return `
      <div class="scroll-neighbours">
        ${regionsHtml}
        ${nearbyHtml}
      </div>
    `;
  },

  updateMarkerPositions() {
    // Если открыт свиток или панель справочника, не тратим ресурсы на пересчет карты
    const scroll = document.getElementById('species-scroll');
    if (scroll && !scroll.classList.contains('hidden')) return;

    const img = document.getElementById('map');
    if (!img || !img.naturalWidth) return;
    const mapRect = img.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    const left = mapRect.left - containerRect.left;
    const top = mapRect.top - containerRect.top;

    // --- ОПТИМИЗАЦИЯ SVG ---
    const svg = document.getElementById('regions-layer');
    if (svg) {
      // Вместо left/top используем transform — он не вызывает перерисовку внутренностей SVG
      svg.style.left = '0px';
      svg.style.top = '0px';

      // Задаем размеры контейнера (если они не изменились, браузер просто проигнорирует)
      svg.style.width = mapRect.width + 'px';
      svg.style.height = mapRect.height + 'px';

      // Двигаем весь SVG слой через GPU
      svg.style.transform = `translate(${left}px, ${top}px)`;
    }

    // --- ОПТИМИЗАЦИЯ МАРКЕРОВ ---
    // Кэш элементов маркеров по id — собираем один раз за вызов
    const elMap = new Map();
    this.markersLayer.querySelectorAll('.marker').forEach(el => {
      const id = el.dataset.id;
      if (id) elMap.set(Number(id), el);
    });

    // Получаем размеры видимой области экрана
    const containerW = this.container.clientWidth;
    const containerH = this.container.clientHeight;
    const pad = 100; // Запас за краями экрана

    // Для маркеров также лучше использовать transform вместо left/top,
    // но так как их много, мы просто расставляем их абсолютно (left/top) 
    // и скрываем невидимые.
    this.markers.forEach(m => {
      const el = elMap.get(m.id);
      if (!el) return;
      const px = left + (m.x / 100) * mapRect.width;
      const py = top + (m.y / 100) * mapRect.height;

      el.style.left = px + 'px';
      el.style.top = py + 'px';

      // ВИРТУАЛИЗАЦИЯ: если маркер за пределами видимой области — прячем его
      const isVisible = (
        px > -pad &&
        px < containerW + pad &&
        py > -pad &&
        py < containerH + pad
      );

      const currentDisplay = el.style.display;
      const targetDisplay = isVisible ? 'flex' : 'none';
      if (currentDisplay !== targetDisplay) {
        el.style.display = targetDisplay;
      }
    });
  },

  // ============================================================
  // Режим рисования областей
  // ============================================================

  toggleRegionMode(enabled) {
    if (enabled && !this.developerMode) {
      alert('Рисование областей доступно только в режиме разработчика');
      return;
    }

    // Взаимоисключение с режимом миграций
    if (enabled && this.migrationMode) {
      this.toggleMigrationMode(false);
    }

    this.regionMode = enabled;
    this.currentRegionPoints = [];

    // Перерисовываем маркеры и области, чтобы применить новое состояние кликов
    this.render();

    const btn = document.getElementById('btn-region-mode');
    if (btn) {
      btn.classList.toggle('active', enabled);
      btn.textContent = enabled ? 'Режим рисования: вкл' : 'Режим рисования: выкл';
    }

    const finishBtn = document.getElementById('btn-region-finish');
    const cancelBtn = document.getElementById('btn-region-cancel');
    if (finishBtn) finishBtn.classList.toggle('collapsed', !enabled);
    if (cancelBtn) cancelBtn.classList.toggle('collapsed', !enabled);

    // Обновляем подсказку и текст кнопки
    this.updateHintForSerial();
    // Меняем текст у кнопки «Задать/Сменить вид для серии»
    this.updateSerialChangeSpeciesButton();

    this.renderRegions();
  },

  // ============================================================
  // Режим рисования линий миграций
  // ============================================================

  toggleMigrationMode(enabled) {
    if (enabled && !this.developerMode) {
      alert('Рисование миграций доступно только в режиме разработчика');
      return;
    }

    // Взаимоисключение с режимом областей
    if (enabled && this.regionMode) {
      this.toggleRegionMode(false);
    }

    this.migrationMode = enabled;
    this.currentMigrationPoints = [];

    // Перерисовываем всё, чтобы применить новое состояние кликов
    this.render();

    const btn = document.getElementById('btn-migration-mode');
    if (btn) {
      btn.classList.toggle('active', enabled);
      btn.textContent = enabled ? 'Режим миграций: вкл' : 'Режим миграций: выкл';
    }

    const cancelBtn = document.getElementById('btn-migration-cancel');
    if (cancelBtn) cancelBtn.classList.toggle('collapsed', !enabled);

    // Обновляем подсказку и текст кнопки
    this.updateHintForSerial();
    this.updateSerialChangeSpeciesButton();

    this.renderRegions();
  },

  // Добавить точку в текущую линию миграции
  addMigrationPoint(x, y) {
    // Если уже две точки — начинаем заново (на случай странного клика)
    if (this.currentMigrationPoints.length >= 2) {
      this.currentMigrationPoints = [];
    }

    this.currentMigrationPoints.push([x, y]);
    this.renderRegions();

    // Если поставили вторую точку — сразу открываем модалку
    if (this.currentMigrationPoints.length === 2) {
      this.openMigrationModal();
    }
  },

  // Отменить рисование линии
  cancelMigration() {
    this.currentMigrationPoints = [];
    this.renderRegions();
    this.toggleMigrationMode(false);
  },

  // Добавить точку в текущую область
  addRegionPoint(x, y) {
    this.currentRegionPoints.push([x, y]);
    this.renderRegions();
  },

  // Завершить рисование — замкнуть и сохранить
  finishRegion() {
    if (this.currentRegionPoints.length < 3) {
      alert('Нужно минимум 3 точки, чтобы замкнуть область');
      return;
    }

    // Закрываем модалку маркера, если она открыта
    document.getElementById('modal').classList.add('hidden');

    // Сохраняем временно точки, откроем модалку
    this.pendingRegionPoints = this.currentRegionPoints.slice();
    this.currentRegionPoints = [];
    this.regionSpecies = null;
    this.selectedRegionIntensity = 'weak';

    // Предзаполняем из lastUsed, если вид задан
    const def = this.lastUsed;
    document.getElementById('region-species').value = def ? def.speciesName : '';
    document.getElementById('region-species-id').value = def ? def.speciesId : '';
    document.getElementById('region-name').value = def ? def.speciesName : '';
    const info = document.getElementById('region-category-info');
    if (info) {
      info.textContent = def
        ? (CONFIG.categories.find(c => c.key === def.category)?.label || '—')
        : '—';
    }

    // Подсветка интенсивности
    this.renderIntensityButtons();

    document.getElementById('region-modal').classList.remove('hidden');
    this.renderRegions();
    // Режим рисования не выключаем — можно сразу нарисовать следующую область
  },

  // Отменить рисование
  cancelRegion() {
    this.currentRegionPoints = [];
    this.renderRegions();
    this.toggleRegionMode(false);
  },

  // Показывать ли конкретную область
  // Область видна, если её вид сейчас подсвечен
  shouldShowRegion(region) {
    if (!this.showRegions) return false;
    if (!region.speciesList || region.speciesList.length === 0) return false;

    // Если галочка «показывать только выделенные» снята — показываем все области
    if (!this.mapOnlyHighlighted) return true;

    // Иначе — показываем, если хотя бы один вид из области выделен
    return region.speciesList.some(sp => this.highlightedSpeciesRegions.has(sp.speciesId));
  },

    // Проверка: точка (x, y в процентах) внутри полигона
  isPointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  // Найти все области, которые накрывают точку
  findRegionsAtPoint(x, y) {
    if (!this.regions || !this.regions.length) return [];
    return this.regions.filter(r => this.isPointInPolygon(x, y, r.points));
  },

  // Проверяет, пересекается ли отрезок (линия миграции) с полигоном (областью)
  isLineIntersectsPolygon(linePoints, polygonPoints) {
    if (!linePoints || linePoints.length < 2 || !polygonPoints || polygonPoints.length < 3) return false;

    // Вспомогательная функция: проверяет пересечение двух отрезков
    const doSegmentsIntersect = (p1, p2, p3, p4) => {
      const d1 = (p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0]);
      const d2 = (p4[0] - p3[0]) * (p2[1] - p3[1]) - (p4[1] - p3[1]) * (p2[0] - p3[0]);
      const d3 = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
      const d4 = (p2[0] - p1[0]) * (p4[1] - p1[1]) - (p2[1] - p1[1]) * (p4[0] - p1[0]);

      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
          ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
      }
      return false;
    };

    // Проверяем, пересекает ли линия миграции хотя бы одну сторону полигона
    const p1 = linePoints[0];
    const p2 = linePoints[1];

    for (let i = 0; i < polygonPoints.length; i++) {
      const p3 = polygonPoints[i];
      const p4 = polygonPoints[(i + 1) % polygonPoints.length];
      if (doSegmentsIntersect(p1, p2, p3, p4)) return true;
    }

    // Также проверяем, находится ли линия миграции полностью внутри области
    // (если она не пересекает стороны, но её середина внутри полигона)
    const midX = (p1[0] + p2[0]) / 2;
    const midY = (p1[1] + p2[1]) / 2;
    if (this.isPointInPolygon(midX, midY, polygonPoints)) {
      return true;
    }

    return false;
  },

  // Найти все маркеры, попадающие внутрь области
  findMarkersInRegion(region) {
    if (!region || !region.points) return [];
    return this.markers.filter(m => this.isPointInPolygon(m.x, m.y, region.points));
  },

  // Собирает HTML-блок «Маркеры внутри области» для тултипа
  // Группирует маркеры по таксономическим классам и отрядам
  renderMarkersInsideBlock() {
    const currentRegion = this.regions.find(r => r.id === this.highlightedRegionId);
    if (!currentRegion) return '';

    const markersInside = this.findMarkersInRegion(currentRegion);

    if (markersInside.length === 0) {
      return `
        <div class="nearby-block" style="margin-top:10px;">
          <div class="nearby-title">Маркеры внутри области: нет</div>
        </div>
      `;
    }

    // Группируем по speciesId (или name, если speciesId нет)
    const speciesGroups = new Map();  // key → { name, category, status, ids: [] }
    markersInside.forEach(m => {
      const key = m.speciesId || m.name;
      if (!speciesGroups.has(key)) {
        speciesGroups.set(key, {
          name: m.name,
          speciesId: m.speciesId,
          category: m.category,
          status: m.status,
          ids: []
        });
      }
      speciesGroups.get(key).ids.push(m.id);
    });

    // Теперь группируем виды по КЛАССАМ (таксономия)
    const taxonomyGroups = new Map(); // className -> { label, species: [] }

    speciesGroups.forEach(g => {
      let classLabel = 'Без класса';
      let categoryIcon = '●';

      if (g.speciesId) {
        // Ищем именно КЛАСС (или Отдел/Семейство, если классов нет) вида в SPECIES
        const searchClass = (node, path) => {
          // Если нашли вид в этом узле — возвращаем последний класс из пути
          if (node.species && node.species.some(s => s.id === g.speciesId)) {
            // Ищем в пути узел, который начинается с "Класс", "Отдел", "Семейство", "Порядок"
            const classNode = path.slice().reverse().find(p =>
              p.startsWith('Класс') || p.startsWith('Отдел') || p.startsWith('Семейство') || p.startsWith('Порядок')
            );
            return classNode || path[path.length - 1] || node.label;
          }
          // Рекурсивно идем вглубь
          if (node.classes) {
            for (const c of node.classes) {
              const res = searchClass(c, [...path, c.label]);
              if (res) return res;
            }
          }
          if (node.orders) {
            for (const o of node.orders) {
              const res = searchClass(o, [...path, o.label]);
              if (res) return res;
            }
          }
          return null;
        };

        const groupData = SPECIES[g.category];
        if (groupData) {
          classLabel = searchClass(groupData, [groupData.label]) || 'Другие виды';
        }
      }

      // СРАЗУ ОБРЕЗАЕМ НАЗВАНИЕ КЛАССА ЗДЕСЬ
      classLabel = this.shortNodeLabel(classLabel);

      const catConfig = CONFIG.categories.find(c => c.key === g.category);
      categoryIcon = catConfig ? catConfig.icon : '●';

      if (!taxonomyGroups.has(classLabel)) {
        taxonomyGroups.set(classLabel, { label: classLabel, icon: categoryIcon, species: [] });
      }
      taxonomyGroups.get(classLabel).species.push(g);
    });

    // Сортируем группы по алфавиту (чтобы не прыгали)
    const sortedGroups = [...taxonomyGroups.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));

    // Собираем HTML
    const items = sortedGroups.map(group => {
      const speciesHtml = group.species.map(g => {
        const st = CONFIG.statuses.find(s => s.value === g.status);
        const count = g.ids.length;
        const countLabel = count > 1 ? ` <span style="color:#7a2d2d;font-weight:600;">×${count}</span>` : '';
        const idsAttr = g.ids.join(',');

        return `
          <div class="region-marker-item" data-marker-ids="${idsAttr}" style="cursor:pointer; padding:3px 8px 3px 24px; display:flex; align-items:center; gap:6px; border-bottom: 1px dotted rgba(0,0,0,0.05);">
            <span class="nearby-name" style="flex:1;">${g.name}${countLabel}</span>
            ${st ? `<span class="nearby-status" style="background:${st.color}" title="${st.value} — ${st.label}">${st.value}</span>` : ''}
          </div>
        `;
      }).join('');

      return `
        <details class="taxonomy-group">
          <summary class="nearby-title" style="cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 6px 8px;">
            <span style="font-size:10px; color:var(--gold-deep);">▶</span>
            <span style="font-size: 12px;">${group.icon} ${group.label}</span>
            <span style="color:#7a2d2d; font-size: 11px; font-weight: normal;">(${group.species.length})</span>
          </summary>
          <div style="background: rgba(255,255,255,0.3); border-radius: 2px; margin-bottom: 8px;">
            ${speciesHtml}
          </div>
        </details>
      `;
    }).join('');

    return `
      <div class="nearby-block" style="margin-top:10px;">
        <div class="nearby-title" style="margin-bottom: 12px;">Маркеры внутри области (${speciesGroups.size} видов, ${markersInside.length} шт.):</div>
        ${items}
      </div>
    `;
  },

  // ============================================================
  // Модалка области обитания
  // ============================================================

  renderIntensityButtons() {
    document.querySelectorAll('.intensity-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.intensity === this.selectedRegionIntensity);
    });
  },

  closeRegionModal() {
    document.getElementById('region-modal').classList.add('hidden');
    this.pendingRegionPoints = null;
    this.regionSpecies = null;
    this.pickingRegionSpecies = false;
    this._regionModalMode = null;  // сбрасываем режим
  },

  // Открыть модалку области в режиме «задать вид для серии» (без точек)
  openRegionModalForSerial() {
    this._regionModalMode = 'serial';
    this.pendingRegionPoints = null;  // точек нет — это только выбор вида

    // Заполняем поля из lastUsed, если вид уже задан
    const def = this.lastUsed;
    document.getElementById('region-species').value = def ? def.speciesName : '';
    document.getElementById('region-species-id').value = def ? def.speciesId : '';
    document.getElementById('region-name').value = def ? def.speciesName : '';
    const info = document.getElementById('region-category-info');
    if (info) {
      info.textContent = def
        ? (CONFIG.categories.find(c => c.key === def.category)?.label || '—')
        : '—';
    }

    this.renderIntensityButtons();
    document.getElementById('region-modal').classList.remove('hidden');
  },

  // Открыть модалку миграции в режиме «задать вид для серии» (без точек)
  openMigrationModalForSerial() {
    this._migrationModalMode = 'serial';
    this.pendingMigrationPoints = null;

    const def = this.lastUsed;
    document.getElementById('migration-species').value = def ? def.speciesName : '';
    document.getElementById('migration-species-id').value = def ? def.speciesId : '';
    document.getElementById('migration-name').value = def ? def.speciesName : '';
    const info = document.getElementById('migration-category-info');
    if (info) {
      info.textContent = def
        ? (CONFIG.categories.find(c => c.key === def.category)?.label || '—')
        : '—';
    }

    document.getElementById('migration-modal').classList.remove('hidden');
  },

  // ============================================================
  // Модалка линии миграции
  // ============================================================

  openMigrationModal() {
    // Закрываем модалку маркера, если открыта
    document.getElementById('modal').classList.add('hidden');

    // Предзаполняем из lastUsed, если вид задан
    const def = this.lastUsed;
    document.getElementById('migration-species').value = def ? def.speciesName : '';
    document.getElementById('migration-species-id').value = def ? def.speciesId : '';
    document.getElementById('migration-name').value = def ? def.speciesName : '';
    const info = document.getElementById('migration-category-info');
    if (info) {
      info.textContent = def
        ? (CONFIG.categories.find(c => c.key === def.category)?.label || '—')
        : '—';
    }

    // Сохраняем точки
    this.pendingMigrationPoints = this.currentMigrationPoints.slice();

    // Показываем модалку
    document.getElementById('migration-modal').classList.remove('hidden');
  },

  closeMigrationModal() {
    document.getElementById('migration-modal').classList.add('hidden');
    this.pendingMigrationPoints = null;
    this.pickingMigrationSpecies = false;
    this._migrationModalMode = null;  // сбрасываем режим
    // Сбрасываем текущее рисование
    this.currentMigrationPoints = [];
    this.renderRegions();
  },

  saveMigration() {
    const speciesId = document.getElementById('migration-species-id').value;
    const speciesName = document.getElementById('migration-species').value;
    const category = this.detectCategory(speciesId);

    if (!speciesId || !category) {
      alert('Выберите вид из справочника');
      return;
    }

    // ---- Режим «задать вид для серии» (без точек) ----
    if (this._migrationModalMode === 'serial') {
      const speciesData = this.findSpeciesById(speciesId);
      this.lastUsed = {
        name: speciesName,
        speciesId,
        speciesName,
        category,
        status: speciesData ? speciesData.status : 0
      };

      this._migrationModalMode = null;
      this.closeMigrationModal();
      this.updateHintForSerial();
      this.updateSerialChangeSpeciesButton();
      return;
    }

    // ---- Обычный режим (после рисования линии) ----
    if (!this.pendingMigrationPoints || this.pendingMigrationPoints.length < 2) {
      alert('Линия миграции не задана (нужно две точки)');
      return;
    }

    this.migrations.push({
      id: Date.now(),
      speciesId,
      speciesName,
      category,
      points: this.pendingMigrationPoints.slice(),
      speciesList: [{ speciesId, speciesName, category }]
    });

    Storage.saveMigrations(this.migrations);

    // Автоматически подсвечиваем этот вид
    this.highlightedSpeciesMigrations.add(speciesId);

    // Обновляем lastUsed — вид становится общим для всей сессии
    const speciesData = this.findSpeciesById(speciesId);
    this.lastUsed = {
      name: speciesName,
      speciesId,
      speciesName,
      category,
      status: speciesData ? speciesData.status : 0
    };

    // Сбрасываем
    this.pendingMigrationPoints = null;
    this.currentMigrationPoints = [];
    this.closeMigrationModal();
    this.renderRegions();

    // Обновляем подсказку и текст кнопки
    this.updateHintForSerial();
    this.updateSerialChangeSpeciesButton();
  },

  saveRegion() {
    const speciesId = document.getElementById('region-species-id').value;
    const speciesName = document.getElementById('region-species').value;
    const category = this.detectCategory(speciesId);

    if (!speciesId || !category) {
      alert('Выберите вид из справочника');
      return;
    }

    // ---- Режим «задать вид для серии» (без точек) ----
    if (this._regionModalMode === 'serial') {
      // Просто обновляем lastUsed — вид становится общим для всей сессии
      const speciesData = this.findSpeciesById(speciesId);
      this.lastUsed = {
        name: speciesName,
        speciesId,
        speciesName,
        category,
        status: speciesData ? speciesData.status : 0
      };

      this._regionModalMode = null;
      this.closeRegionModal();

      // Обновляем подсказку и текст кнопки
      this.updateHintForSerial();
      this.updateSerialChangeSpeciesButton();
      return;
    }

    // ---- Обычный режим (после рисования области) ----
    if (!this.pendingRegionPoints || this.pendingRegionPoints.length < 3) {
      alert('Область не задана (нужно минимум 3 точки)');
      return;
    }

    this.regions.push({
      id: Date.now(),
      speciesList: [
        { speciesId: speciesId, speciesName: speciesName, category: category, intensity: this.selectedRegionIntensity }
      ],
      intensity: this.selectedRegionIntensity,
      points: this.pendingRegionPoints.slice()
    });

    Storage.saveRegions(this.regions);

    this.activeRegionSpeciesId = speciesId;

    // Автоматически подсвечиваем вид, чтобы область сразу появилась на карте
    this.highlightedSpeciesRegions.add(speciesId);

    // Обновляем lastUsed — вид становится общим для всей сессии
    const speciesData = this.findSpeciesById(speciesId);
    this.lastUsed = {
      name: speciesName,
      speciesId,
      speciesName,
      category,
      status: speciesData ? speciesData.status : 0
    };

    this.pendingRegionPoints = null;
    this.regionSpecies = null;
    this.closeRegionModal();
    this.renderRegions();

    // Обновляем подсказку и текст кнопки
    this.updateHintForSerial();
    this.updateSerialChangeSpeciesButton();
  },


  // Отрисовка слоя областей
  renderRegions() {
    // Дебаунс: если вызывается много раз подряд, откладываем выполнение
    if (this._regionsRaf) {
      cancelAnimationFrame(this._regionsRaf);
    }
    this._regionsRaf = requestAnimationFrame(() => {
      this._regionsRaf = null;
      this._doRenderRegions();
    });
  },

  _doRenderRegions() {
    const svg = document.getElementById('regions-layer');
    const img = document.getElementById('map');
    if (!svg || !img) return;

    // Если картинка ещё не загрузилась — попробуем позже
    if (!img.naturalWidth) {
      img.addEventListener('load', () => this._doRenderRegions(), { once: true });
      return;
    }

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Всегда обновляем viewBox под реальные размеры картинки
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

      // Чистим всё, кроме defs (стрелки переиспользуем)
      [...svg.childNodes].forEach(node => {
        if (node.nodeName !== 'defs') svg.removeChild(node);
      });

    // Рисуем текущее рисование (точки + линии)
    this.currentRegionPoints.forEach(([x, y]) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', (x / 100) * w);
      circle.setAttribute('cy', (y / 100) * h);
      circle.setAttribute('r', 6);
      circle.setAttribute('class', 'draw-point');
      svg.appendChild(circle);
    });

    if (this.currentRegionPoints.length >= 2) {
      const pointsStr = this.currentRegionPoints
        .map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`)
        .join(' ');

      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', pointsStr);
      polyline.setAttribute('class', 'draw-line');
      svg.appendChild(polyline);
    }

    // Рисуем текущую миграцию (точки + линия)
    this.currentMigrationPoints.forEach(([x, y]) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', (x / 100) * w);
      circle.setAttribute('cy', (y / 100) * h);
      circle.setAttribute('r', 6);
      circle.setAttribute('class', 'draw-migration-point');
      svg.appendChild(circle);
    });

    if (this.currentMigrationPoints.length === 2) {
      const [p1, p2] = this.currentMigrationPoints;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', (p1[0] / 100) * w);
      line.setAttribute('y1', (p1[1] / 100) * h);
      line.setAttribute('x2', (p2[0] / 100) * w);
      line.setAttribute('y2', (p2[1] / 100) * h);
      line.setAttribute('class', 'draw-migration-line');
      svg.appendChild(line);
    }

    // Рисуем уже сохранённые регионы (пока массив пустой, но логика на будущее)
    if (this.regions && Array.isArray(this.regions)) {
      const activeCats = [...this.listFilter];

      this.regions.forEach(region => {
        if (!this.showRegions) return;
        if (!region.speciesList) return;
        if (this.listFilter.size > 0) {
          const hasActiveCategory = region.speciesList.some(sp => activeCats.includes(sp.category));
          if (!hasActiveCategory) return;
        }
        if (!this.shouldShowRegion(region)) return;

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pts = region.points.map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`).join(' ');
        polygon.setAttribute('points', pts);

        // Подсветка, если эта область выбрана
        let cls = 'region-polygon ' + (region.intensity || 'weak');
        if (this.highlightedRegionId === region.id) {
          cls += ' highlighted';
        }
        polygon.setAttribute('class', cls);
        polygon.setAttribute('data-region-id', region.id);

        // Блокируем клик по области, если активен режим рисования, серийный режим или режим миграций
        const blockClick = this.regionMode || this.serialMode || this.migrationMode;

        if (blockClick) {
          polygon.style.pointerEvents = 'none';
        } else {
          polygon.style.pointerEvents = 'auto';
          polygon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onRegionClick(e, region);
          });
        }

        svg.appendChild(polygon);
      });
    }

      // Рисуем сохранённые линии миграций
      if (this.showMigrations && this.migrations && Array.isArray(this.migrations)) {
        const activeCats = [...this.listFilter];

        // defs со стрелками — создаём один раз и переиспользуем
        if (!svg.querySelector('#arrow-end')) {
          const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          defs.innerHTML = `
          <marker id="arrow-end" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1a3a2e" />
          </marker>
          <marker id="arrow-start" viewBox="0 0 10 10" refX="1" refY="5"
                  markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 10 0 L 0 5 L 10 10 z" fill="#1a3a2e" />
          </marker>
        `;
          svg.appendChild(defs);
        }

        this.migrations.forEach(mig => {
          if (this.listFilter.size > 0 && !activeCats.includes(mig.category)) return;

          // Если галочка «показывать только выделенные» снята — показываем все миграции
          // Иначе — только если хотя бы один её вид явно выделен
          if (this.mapOnlyHighlighted) {
            let hasHighlighted = this.highlightedSpeciesMigrations.has(mig.speciesId);
            if (!hasHighlighted && mig.speciesList) {
              hasHighlighted = mig.speciesList.some(sp => this.highlightedSpeciesMigrations.has(sp.speciesId));
            }
            if (!hasHighlighted) return;
          }

        if (!mig.points || mig.points.length < 2) return;

        const [p1, p2] = mig.points;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', (p1[0] / 100) * w);
        line.setAttribute('y1', (p1[1] / 100) * h);
        line.setAttribute('x2', (p2[0] / 100) * w);
        line.setAttribute('y2', (p2[1] / 100) * h);
        line.setAttribute('class', 'migration-line');
        line.setAttribute('data-migration-id', mig.id);
        line.setAttribute('marker-end', 'url(#arrow-end)');
        line.setAttribute('marker-start', 'url(#arrow-start)');

        // Блокируем клик, если активен режим рисования или серийный режим
        const blockClick = this.regionMode || this.migrationMode || this.serialMode;

        if (blockClick) {
          line.style.pointerEvents = 'none';
        } else {
          line.style.pointerEvents = 'auto';
          line.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onMigrationClick(e, mig);
          });
        }

        svg.appendChild(line);
      });
    }
  },

  // ============================================================
  // Режим разработчика / гостя
  // ============================================================

    setSerialMode(enabled) {
    if (enabled && !this.developerMode) {
      alert('Серийный режим доступен только в режиме разработчика');
      return;
    }

    this.serialMode = enabled;

    // Перерисовываем маркеры и области, чтобы применить новое состояние кликов
    this.render();

    const btn = document.getElementById('btn-serial');
    if (btn) {
      btn.classList.toggle('active', enabled);
      btn.textContent = enabled ? 'Серийный режим: вкл' : 'Серийный режим: выкл';
    }

    // Показываем/скрываем три дочерние кнопки
      const btnHideAll = document.getElementById('btn-hide-all');
      const btnShowSelected = document.getElementById('btn-show-selected');
      const btnChangeSpecies = document.getElementById('btn-serial-change-species');

      if (btnHideAll) btnHideAll.classList.toggle('collapsed', !enabled);
      if (btnShowSelected) btnShowSelected.classList.toggle('collapsed', !enabled);
      if (btnChangeSpecies) btnChangeSpecies.classList.toggle('collapsed', !enabled);

    // Обновляем текст кнопки «Задать/Сменить вид для серии»
    this.updateSerialChangeSpeciesButton();

    // Перерисовываем карту, чтобы применить/снять некликабельность маркеров
    this.render();

    // Обновляем подсказку
    this.updateHintForSerial();
  },

  // Автозагрузка данных из файла (если он есть)
  loadFromFile(path) {
    // 1. Если данные "зашиты" в файле markers-data.js (для работы без сервера)
    if (window.MARKERS_DATA) {
      this.processLoadedData(window.MARKERS_DATA);
      return;
    }

    // 2. Иначе пробуем скачать через fetch (для Live Server)
    fetch(path)
      .then(response => {
        if (!response.ok) throw new Error('Файл не найден');
        return response.json();
      })
      .then(data => {
        this.processLoadedData(data);
      })
      .catch(err => {
        console.log('Автозагрузка не удалась:', err.message);
      });
  },

  // Вспомогательный метод для обработки данных
  processLoadedData(data) {
    // Поддержка двух форматов
    if (Array.isArray(data)) {
      this.markers = data;
      this.regions = [];
      this.migrations = [];
    } else {
      this.markers = data.markers || [];
      this.regions = data.regions || [];
      this.migrations = data.migrations || [];
    }

    // --- ПРИНУДИТЕЛЬНАЯ КОНВЕРТАЦИЯ СТАРЫХ ОБЛАСТЕЙ ---
    this.regions.forEach(region => {
      if (!region.speciesList) {
        // Если есть старые поля, создаем из них speciesList
        if (region.speciesId) {
          region.speciesList = [
            { speciesId: region.speciesId, speciesName: region.speciesName, category: region.category }
          ];
        } else {
          // Если совсем пусто — создаем пустой массив, чтобы не падало
          region.speciesList = [];
        }
        // Удаляем старые поля, чтобы они не мешались
        delete region.speciesId;
        delete region.speciesName;
        delete region.category;
      }
    });

    // Выделяем всё по умолчанию
    this.markers.forEach(m => this.highlightedIds.add(m.id));
    this.regions.forEach(r => {
      if (r.speciesList) {
        r.speciesList.forEach(sp => this.highlightedSpeciesRegions.add(sp.speciesId));
      }
    });
    this.migrations.forEach(m => {
      if (m.speciesId) this.highlightedSpeciesMigrations.add(m.speciesId);
    });
    
    // Отключаем режим "только выделенные", чтобы всё было видно
    this.mapOnlyHighlighted = false;

    // Сохраняем в localStorage
    Storage.save(this.markers);
    Storage.saveRegions(this.regions);
    Storage.saveMigrations(this.migrations);

    // Перерисовываем
    this.render();
    this.updateStats();

    console.log('Данные успешно загружены!');
  },


  tryEnterDeveloperMode() {
    if (this.developerMode) return;

    // Открываем модалку пароля
    document.getElementById('password-input').value = '';
    document.getElementById('password-error').textContent = '';
    document.getElementById('password-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('password-input').focus(), 100);
  },

  // Проверка введённого пароля
  checkPassword() {
    const password = document.getElementById('password-input').value;
    if (password === CONFIG.ui.developerPassword) {
      document.getElementById('password-modal').classList.add('hidden');
      this.setMode(true);
    } else {
      document.getElementById('password-error').textContent = 'Неверный пароль';
      document.getElementById('password-input').value = '';
      document.getElementById('password-input').focus();
    }
  },

  setMode(isDeveloper) {
    this.developerMode = isDeveloper;

    // Весь блок «Режим разработчика» — только для разработчика
    const devTools = document.getElementById('developer-tools');
    if (devTools) devTools.classList.toggle('hidden', !isDeveloper);

    // Внутри блока: «Завершить» и «Отменить» — только если включён режим рисования
    const regionFinishBtn = document.getElementById('btn-region-finish');
    if (regionFinishBtn) {
      const showFinish = isDeveloper && this.regionMode;
      regionFinishBtn.classList.toggle('collapsed', !showFinish);
    }

    const regionCancelBtn = document.getElementById('btn-region-cancel');
    if (regionCancelBtn) {
      const showCancel = isDeveloper && this.regionMode;
      regionCancelBtn.classList.toggle('collapsed', !showCancel);
    }

    // В гостевом режиме серийный режим выключаем
    if (!isDeveloper && this.serialMode) {
      this.serialMode = false;

      const serialBtn = document.getElementById('btn-serial');
      if (serialBtn) {
        serialBtn.classList.remove('active');
        serialBtn.textContent = 'Серийный режим: выкл';
      }

      // Скрываем три подкнопки серийного режима
      const btnHideAll = document.getElementById('btn-hide-all');
      const btnShowSelected = document.getElementById('btn-show-selected');
      const btnChangeSpecies = document.getElementById('btn-serial-change-species');
      if (btnHideAll) btnHideAll.classList.add('collapsed');
      if (btnShowSelected) btnShowSelected.classList.add('collapsed');
      if (btnChangeSpecies) btnChangeSpecies.classList.add('collapsed');
    }

    document.getElementById('btn-developer').classList.toggle('active', isDeveloper);
    document.getElementById('btn-guest').classList.toggle('active', !isDeveloper);

    // Показываем игры только в режиме гостя
    const gamesMenu = document.getElementById('games-menu');
    if (gamesMenu) gamesMenu.classList.toggle('hidden', isDeveloper);

    // Обновляем подсказку через общий метод
    this.updateHintForSerial();

    this.tooltip.style.display = 'none';

    // Сбрасываем мигание при смене режима
    this.flashingIds.clear();
    if (this._flashTimer) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }
  },

  // ============================================================
  // Общая подсказка (зависит от режима)
  // ============================================================

  updateHintForSerial() {
    const hint = document.getElementById('hint');
    if (!hint) return;

    // --- Гостевой режим ---
    if (!this.developerMode) {
      hint.innerHTML = '<p>Режим просмотра. Кликните по маркеру, чтобы увидеть описание.</p>';
      return;
    }

    // --- Режим разработчика, серийный не активен ---
    if (!this.serialMode) {
      if (this.regionMode) {
        hint.innerHTML = `
          <p><strong>Режим рисования области</strong></p>
          <p>Кликайте по карте, чтобы поставить точки.</p>
          <p>Когда закончите — нажмите «Завершить область».</p>
        `;
        return;
      }
      if (this.migrationMode) {
        hint.innerHTML = `
          <p><strong>Режим рисования линии миграции</strong></p>
          <p>Кликните первую точку, потом вторую.</p>
          <p>Линия закроется автоматически.</p>
        `;
        return;
      }
      hint.innerHTML = '<p>Кликните по карте, чтобы поставить маркер.</p>';
      return;
    }

    // --- Серийный режим + области ---
    if (this.regionMode) {
      const def = this.lastUsed;
      hint.innerHTML = `
        <p><strong>Серийный режим + Области</strong></p>
        <p>Клик по карте добавляет точки области.</p>
        <p>После 3+ точек — «Завершить область».</p>
        ${def
          ? `<p>Вид: ${def.speciesName}</p>`
          : '<p>Вид не задан — выберите в модалке после рисования.</p>'}
      `;
      return;
    }

    // --- Серийный режим + миграции ---
    if (this.migrationMode) {
      const def = this.lastUsed;
      hint.innerHTML = `
        <p><strong>Серийный режим + Миграции</strong></p>
        <p>Клик по карте добавляет точки линии.</p>
        <p>После 2 точек откроется модалка.</p>
        ${def
          ? `<p>Вид: ${def.speciesName}</p>`
          : '<p>Вид не задан — выберите в модалке после рисования.</p>'}
      `;
      return;
    }

    // --- Только серийный режим (маркер) ---
    if (this.lastUsed) {
      const catConfig = CONFIG.categories.find(c => c.key === this.lastUsed.category);
      hint.innerHTML = `
        <p><strong>Серийный режим</strong></p>
        <p>Клик по карте ставит маркер:</p>
        <p>${this.lastUsed.name}<br>
        <span style="font-size:11px;opacity:0.8;">${catConfig ? catConfig.label : ''}</span></p>
      `;
    } else {
      hint.innerHTML = `
        <p><strong>Серийный режим</strong></p>
        <p>Сначала задайте вид для серии (кнопка в сайдбаре).</p>
      `;
    }
  },

  // ============================================================
  // Текст кнопки «Задать/Сменить вид для серии»
  // ============================================================

  updateSerialChangeSpeciesButton() {
    const btn = document.getElementById('btn-serial-change-species');
    if (!btn) return;

    // Вид теперь один на всю сессию — lastUsed
    const hasSpecies = !!this.lastUsed;

    btn.textContent = hasSpecies
      ? 'Сменить вид для серии'
      : 'Задать вид для серии';
  },

  // ============================================================
  // Логика карты
  // ============================================================

  onMapClick(e) {
    if (!this.developerMode) return;
    if (e.target.classList.contains('marker')) return;

    const rect = this.map.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    // Если включён режим рисования области — добавляем точку
    if (this.regionMode) {
      this.addRegionPoint(x, y);
      return;
    }

    // Если включён режим рисования миграции — добавляем точку
    if (this.migrationMode) {
      this.addMigrationPoint(x, y);
      return;
    }

    // Если клик не в маркер и не в режиме разработчика — проверяем, нет ли тут областей
    if (!this.developerMode) {
      const regionsHere = this.findRegionsAtPoint(x, y);
      if (regionsHere.length > 0) {
        this.showRegionsTooltip(e, regionsHere);
        return;
      }
    }

    // Если серийный режим включён — сразу ставим маркер без модалки
    if (this.serialMode && this.lastUsed) {
      // Проверяем, задан ли формат маркера
      if (!this.lastMarkerType) {
        // Формат не задан — открываем модалку, чтобы пользователь его выбрал
        this.pendingMarker = { x, y };
        this.openModal();
        return;
      }

      const newId = Date.now();
      this.markers.push({
        id: newId,
        name: this.lastUsed.name,
        speciesId: this.lastUsed.speciesId,
        speciesName: this.lastUsed.speciesName,
        category: this.lastUsed.category,
        status: this.lastUsed.status,
        markerType: this.lastMarkerType,
        x,
        y
      });

      // Автоматически подсвечиваем новый маркер
      this.highlightedIds.add(newId);

      Storage.save(this.markers);
      this.render();
      return;
    }

    // Обычный режим — клик по карте отключен (маркеры ставятся только в серийном режиме)
    // Заколебали маркеры из-за случайного клика по карте. Можно раскомментировать, все снов будет работать
    // this.pendingMarker = { x, y };
    // this.openModal();
  },

  openModal(id = null) {
    const title = document.getElementById('modal-title');
    const inputId = document.getElementById('input-id');
    const inputName = document.getElementById('input-name');
    const inputSpecies = document.getElementById('input-species');
    const inputSpeciesId = document.getElementById('input-species-id');
    const catInfo = document.getElementById('category-info');

    if (id) {
      const marker = this.markers.find(m => m.id === id);
      if (!marker) return;
      title.textContent = 'Редактировать маркер';
      inputId.value = marker.id;
      inputName.value = marker.name;
      inputSpecies.value = marker.speciesName || '';
      inputSpeciesId.value = marker.speciesId || '';
      document.getElementById('input-category').value = marker.category;
      this.selectStatus(marker.status);
      this.selectedMarkerType = marker.markerType || null;
      this.renderMarkerTypeSelect(marker.category);
      const catConfig = CONFIG.categories.find(c => c.key === marker.category);
      if (catInfo) catInfo.textContent = catConfig ? catConfig.label : '—';
      this.pendingMarker = { x: marker.x, y: marker.y, editing: true };
    } else {
      title.textContent = 'Новый маркер';
      inputId.value = '';

      // Если есть последний использованный выбор — берём его
      if (this.lastUsed) {
        inputSpecies.value = this.lastUsed.speciesName || '';
        inputSpeciesId.value = this.lastUsed.speciesId || '';
        inputName.value = this.lastUsed.name || '';
        document.getElementById('input-category').value = this.lastUsed.category || '';
        this.selectStatus(this.lastUsed.status);
        this.selectedMarkerType = this.lastMarkerType || null;
        this.renderMarkerTypeSelect(this.lastUsed.category);
        const catConfig = CONFIG.categories.find(c => c.key === this.lastUsed.category);
        if (catInfo) catInfo.textContent = catConfig ? catConfig.label : '—';
      } else {
        // Первый маркер — пустые поля
        inputSpecies.value = '';
        inputSpeciesId.value = '';
        inputName.value = '';
        document.getElementById('input-category').value = '';
        this.selectStatus(3);
        this.selectedMarkerType = null;
        this.renderMarkerTypeSelect(null);
        if (catInfo) catInfo.textContent = '—';
      }
    }

    this.modal.classList.remove('hidden');
    inputName.focus();
  },

  renderMarkerTypeSelect(categoryKey) {
    const container = document.getElementById('marker-type-select');
    if (!container) return;
    container.innerHTML = '';

    let set = null;
    if (categoryKey === 'animals') set = CONFIG.markers.animals;
    if (categoryKey === 'plants' || categoryKey === 'lichens' || categoryKey === 'fungi') set = CONFIG.markers.plants;

    if (!set) {
      container.innerHTML = '<div style="font-size:12px;color:#888;">Сначала выберите вид из справочника</div>';
      return;
    }

    set.forEach(mt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'marker-type-btn' + (this.selectedMarkerType === mt.key ? ' selected' : '');
      btn.title = mt.label;
      btn.innerHTML = `
        <span class="marker-symbol" style="color:${mt.color};">${mt.symbol}</span>
        <span>${mt.label}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectedMarkerType = mt.key;
        this.renderMarkerTypeSelect(categoryKey);
      });
      container.appendChild(btn);
    });
  },

  closeModal() {
    this.modal.classList.add('hidden');
    this.pendingMarker = null;
    this.isSettingSerial = false;
  },

  saveModal() {
    const name = document.getElementById('input-name').value.trim();
    if (!name) {
      alert('Выберите вид из справочника');
      return;
    }

    const id = document.getElementById('input-id').value;
    const category = document.getElementById('input-category').value;
    const speciesId = document.getElementById('input-species-id').value;
    const speciesName = document.getElementById('input-species').value;

    if (!category) {
      alert('Не удалось определить категорию. Выберите вид из справочника.');
      return;
    }

        if (!this.selectedMarkerType) {
      alert('Выберите формат маркера');
      return;
    }

    const marker = {
      name,
      speciesId,
      speciesName,
      category,
      status: this.selectedStatus,
      markerType: this.selectedMarkerType
    };

    // Запоминаем последний использованный вид
    this.lastUsed = {
      name,
      speciesId,
      speciesName,
      category,
      status: this.selectedStatus
    };
    // И отдельно — формат маркера
    this.lastMarkerType = this.selectedMarkerType;

    // Переключаем показ областей на этот вид
    this.activeRegionSpeciesId = speciesId;

    // Если это режим «Задать вид для серии» — маркер не создаём
    if (this.isSettingSerial) {
      this.isSettingSerial = false;
      this.closeModal();
      this.setSerialMode(true);
      return;
    }

    // Обычный режим — создаём или обновляем маркер
    if (id) {
      const existing = this.markers.find(m => m.id === Number(id));
      if (existing) Object.assign(existing, marker);
    } else if (this.pendingMarker) {
      const newId = Date.now();
      this.markers.push({
        id: newId,
        ...marker,
        x: this.pendingMarker.x,
        y: this.pendingMarker.y
      });
      // Автоматически подсвечиваем новый маркер
      this.highlightedIds.add(newId);
    } else {
      this.isSettingSerial = false;
      this.closeModal();
      this.setSerialMode(true);
      return;
    }

    Storage.save(this.markers);
    this.render();
    this.closeModal();

    if (this.serialMode) {
      this.setSerialMode(true);
    }
  },

  // ============================================================
  // Отрисовка маркеров
  // ============================================================

  render() {
    this.markersLayer.innerHTML = '';
    // Берем активные категории из нашего внутреннего фильтра
    const activeCats = [...this.listFilter];

    // Кэшируем геометрию карты один раз на весь рендер
    const img = document.getElementById('map');
    const mapRect = img ? img.getBoundingClientRect() : null;
    const containerRect = this.container.getBoundingClientRect();
    const renderLeft = mapRect ? mapRect.left - containerRect.left : 0;
    const renderTop = mapRect ? mapRect.top - containerRect.top : 0;
    const renderWidth = mapRect ? mapRect.width : 0;
    const renderHeight = mapRect ? mapRect.height : 0;

    const fragment = document.createDocumentFragment();

    // Кэшируем конфиги перед циклом (для ускорения)
    const catMap = new Map(CONFIG.categories.map(c => [c.key, c]));
    const statusMap = new Map(CONFIG.statuses.map(s => [s.value, s]));
    const animalFormats = new Map(CONFIG.markers.animals.map(f => [f.key, f]));
    const plantFormats = new Map(CONFIG.markers.plants.map(f => [f.key, f]));

    this.markers.forEach((m) => {
      if (!this.showMarkers) return;
      if (this.listFilter.size > 0 && !activeCats.includes(m.category)) return;

      // Если включено «На карте только выбранные» — показываем только подсвеченные
      if (this.mapOnlyHighlighted && !this.highlightedIds.has(m.id)) return;

      const catConfig = catMap.get(m.category);
      const statusConfig = statusMap.get(m.status);

      // Находим формат маркера
      let markerFormat = null;
      if (catConfig) {
        const set = catConfig.key === 'animals' ? animalFormats : plantFormats;
        markerFormat = set.get(m.markerType);
      }

      const el = document.createElement('div');
      el.className = 'marker';

      // Жёлтая обводка (хайлайт) — только для маркеров, которые сейчас мигают.
      // Управляется методом flashMarkers().
      if (!this.regionMode && !this.serialMode && this.flashingIds.has(m.id)) {
        el.classList.add('highlighted');
      }
      const px = renderLeft + (m.x / 100) * renderWidth;
      const py = renderTop + (m.y / 100) * renderHeight;

      el.style.left = px + 'px';
      el.style.top = py + 'px';
      el.dataset.id = m.id;

      // Символ формата (основной визуал маркера)
      if (markerFormat) {
        el.textContent = markerFormat.symbol;
        el.style.color = markerFormat.color;
      } else {
        // Если формат не выбран — простой кружок
        el.style.background = catConfig ? catConfig.color : '#999';
      }

      // Шильдик статуса (в правом верхнем углу)
      if (statusConfig) {
        const badge = document.createElement('span');
        badge.className = 'status-badge' + (this.showBadges ? '' : ' hidden');
        badge.style.background = statusConfig.color;
        badge.textContent = statusConfig.value;
        el.appendChild(badge);
      }

      // Иконка категории (в левом верхнем углу) — эмодзи
      if (catConfig && catConfig.icon && this.showIcons) {
        const iconBadge = document.createElement('span');
        iconBadge.className = 'category-badge';
        iconBadge.textContent = catConfig.icon;
        el.appendChild(iconBadge);
      }

      // Маркеры некликабельны, если активен серийный режим, режим рисования областей или миграций
      const blockMarkerClick = this.serialMode || this.regionMode || this.migrationMode;

      if (!blockMarkerClick) {
        // Обычный режим — маркер кликабелен
        el.style.pointerEvents = 'auto';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showTooltip(e, m);
        });
      } else {
        // Серийный режим или режим рисования — маркер некликабелен
        el.style.pointerEvents = 'none';
      }

      fragment.appendChild(el);
    });

    this.markersLayer.appendChild(fragment);

    this.updateCounters();
    this.renderRegions();
    this.updateStats();

    // Позиции уже выставлены выше; применяем transform только к wrapper'у,
    // без повторного пересчёта маркеров.
    const wrapper = document.getElementById('map-wrapper');
    if (wrapper) {
      wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    }

    // Обновляем плашку в правом нижнем углу
    this.updateHintUI();
  },

  // Находит маркеры, расположенные близко к заданному
  // Находит маркеры в радиусе «поблизости» (в километрах) вокруг заданного.
  // Радиус задаётся в км (this.nearbyRadiusKm) и переводится в экранные
  // пиксели через реальный масштаб карты — так он не зависит от зума
  // и размера окна.
  findNearbyMarkers(marker) {
    const img = document.getElementById('map');
    if (!img || !img.naturalWidth) return [];

    // Размеры карты на экране (уже с учётом зума)
    const rect = img.getBoundingClientRect();
    const screenWidth = rect.width;
    const screenHeight = rect.height;

    if (!this._markersScreenCache || this._markersScreenCache.w !== screenWidth) {
      this._markersScreenCache = {
        w: screenWidth,
        h: screenHeight,
        pts: this.markers.map(m => ({
          id: m.id,
          x: (m.x / 100) * screenWidth,
          y: (m.y / 100) * screenHeight,
          marker: m
        }))
      };
    }
    const cache = this._markersScreenCache;

    // Сколько километров в одном экранном пикселе прямо сейчас:
    // км_на_натуральный_пиксель * (натуральная ширина / экранная ширина)
    const kmPerNaturalPx = CONFIG.mapScale.kmPerNaturalPx;
    const naturalWidth = img.naturalWidth;
    const kmPerScreenPx = kmPerNaturalPx * naturalWidth / screenWidth;

    // Порог в экранных пикселях
    const thresholdPx = this.nearbyRadiusKm / kmPerScreenPx;

    // Координаты текущего маркера в экранных пикселях
    const mx = (marker.x / 100) * screenWidth;
    const my = (marker.y / 100) * screenHeight;

    const nearby = [];

    cache.pts.forEach(p => {
      if (p.id === marker.id) return;
      const dx = p.x - mx;
      const dy = p.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= thresholdPx) {
        const distKm = dist * kmPerScreenPx;
        nearby.push({ marker: p.marker, distance: dist, distanceKm: distKm });
      }
    });

    // Сортируем по расстоянию в пикселях (эквивалентно км)
    nearby.sort((a, b) => a.distance - b.distance);
    return nearby;
  },

  showTooltip(e, marker) {
    const containerRect = this.container.getBoundingClientRect();
    const statusConfig = CONFIG.statuses.find(s => s.value === marker.status);
    const statusText = statusConfig
      ? `${statusConfig.value} — ${statusConfig.label}`
      : 'Статус не указан';

    // Проверяем, в какие области попадает маркер
    const regionsHere = this.findRegionsAtPoint(marker.x, marker.y);
    const speciesList = [];
    const seen = new Set();
    regionsHere.forEach(r => {
      if (r.speciesList) {
        r.speciesList.forEach(sp => {
          if (!seen.has(sp.speciesId) && sp.speciesId !== marker.speciesId) {
            seen.add(sp.speciesId);
            speciesList.push(sp.speciesName || sp.speciesId);
          }
        });
      }
    });

    const regionsInfo = speciesList.length > 0
      ? `<div class="comment" style="margin-top:8px;padding-top:8px;border-top:1px dashed #ddd;">
           <strong style="color:#1a3a2e;">Входит в области обитания:</strong><br>
           ${regionsHere.map(r => r.speciesList || []).flat().map(sp => {
             if (sp.speciesId === marker.speciesId) return '';
             return `<div class="region-link-item" data-species-id="${sp.speciesId}" 
                          style="cursor: pointer; padding: 2px 4px; border-radius: 2px; transition: background 0.15s;"
                          title="Кликните, чтобы подсветить этот вид на карте">
                       ${sp.speciesName}
                     </div>`;
           }).join('')}
         </div>`
      : '';

    // Проверяем, участвует ли вид в миграциях
    const migrationsForSpecies = this.migrations.filter(m => m.speciesId === marker.speciesId);
    const migrationsInfo = migrationsForSpecies.length > 0
      ? `<div class="comment" style="margin-top:8px;padding-top:8px;border-top:1px dashed #ddd; color: var(--red-dark);">
           <strong style="color:#1a3a2e;">⇔ Участвует в миграциях:</strong> ${migrationsForSpecies.length} линий на карте
         </div>`
      : '';

    // Ищем соседей. Группируем по speciesId (или name) —
    // один вид = одна строка, даже если маркеров несколько.
    const nearby = this.findNearbyMarkers(marker);

    const nearbyGroups = new Map(); // key -> { marker, count }
    nearby.forEach(n => {
      const key = n.marker.speciesId || n.marker.name;
      if (!nearbyGroups.has(key)) {
        nearbyGroups.set(key, { marker: n.marker, count: 1 });
      } else {
        nearbyGroups.get(key).count++;
      }
    });

    const nearbyHtml = nearbyGroups.size > 0
      ? `<div class="nearby-block">
           <div class="nearby-title">Также поблизости (${nearbyGroups.size}):</div>
           ${[...nearbyGroups.values()].map(g => {
        const m = g.marker;
        const cat = CONFIG.categories.find(c => c.key === m.category);
        const st = CONFIG.statuses.find(s => s.value === m.status);
        const countLabel = g.count > 1 ? ` <span class="nearby-count">×${g.count}</span>` : '';
        return `<div class="nearby-item" data-marker-id="${m.id}">
               <span class="nearby-icon">${cat && cat.icon ? cat.icon : '●'}</span>
               <span class="nearby-name">${m.name}${countLabel}</span>
               ${st ? `<span class="nearby-status" style="background:${st.color}" title="${st.value} — ${st.label}">${st.value}</span>` : ''}
             </div>`;
      }).join('')}
         </div>`
      : '';

    // Лупа справа от названия — открывает вид в справочнике
    const gotoIcon = marker.speciesId
      ? `<span class="tooltip-goto" data-species-id="${marker.speciesId}" title="Изучить вид в справочнике">🔍</span>`
      : '';

    // Считаем координаты
    const geo = xyToGeo(marker.x, marker.y);
    const coordStr = `${geo.lat.toFixed(4)}° N, ${geo.lon.toFixed(4)}° E`;

    document.getElementById('tooltip-content').innerHTML = `
      <div id="tooltip-header">
        <!-- Компактные координаты над названием -->
        <div style="font-size: 10px; color: #999; font-family: monospace; margin-bottom: 2px; letter-spacing: 0.5px; line-height: 1;">
          ${coordStr}
        </div>

        <div class="tooltip-drag-handle" style="cursor: move; display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <div style="display: flex; align-items: center;">
            <b>${marker.name}</b>
            ${gotoIcon}
          </div>
          <span style="color: #999; font-size: 14px; user-select: none;">✥</span>
        </div>
        
        <span class="status" style="color:${statusConfig ? statusConfig.color : '#666'}">${statusText}</span>
      </div>
      <div id="tooltip-body">
        ${regionsInfo}
        ${migrationsInfo}
        ${nearbyHtml}
      </div>
    `;

    // Клик по лупе — открыть вид в справочнике
    const gotoEl = document.querySelector('#tooltip-content .tooltip-goto');
    if (gotoEl) {
      gotoEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const sid = gotoEl.dataset.speciesId;
        this.tooltip.style.display = 'none';
        this.openSpeciesPanel('browse', { focusSpeciesId: sid });
      });
    }

    // --- Клик по виду в блоке "Входит в области обитания" ---
    document.querySelectorAll('.region-link-item').forEach(item => {
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        
        const speciesId = item.dataset.speciesId;
        if (!speciesId) return;

        // 1. Сбрасываем ВСЕ предыдущие выделения
        this.highlightedIds.clear();
        this.highlightedSpeciesRegions.clear();
        this.highlightedSpeciesMigrations.clear();
        this.highlightedRegionId = null;

        // 2. Выделяем только этот вид и запоминаем его
        this.lastUsed = {
          name: this.findSpeciesById(speciesId)?.name || '',
          speciesId: speciesId,
          speciesName: this.findSpeciesById(speciesId)?.name || '',
          category: this.detectCategory(speciesId),
          status: this.findSpeciesById(speciesId)?.status || 0
        };
        this.highlightedSpeciesRegions.add(speciesId);
        this.highlightedSpeciesMigrations.add(speciesId);
        
        // 3. Выделяем все маркеры этого вида
        this.markers.forEach(m => {
          if (m.speciesId === speciesId) {
            this.highlightedIds.add(m.id);
          }
        });

        // 4. Перерисовываем карту
        this.render();
        
        // 5. Визуальный отклик: подсвечиваем выбранный элемент в тултипе
        document.querySelectorAll('.region-link-item').forEach(el => el.style.background = 'transparent');
        item.style.background = 'rgba(212, 180, 90, 0.3)';

        // 6. Мигаем маркерами этого вида
        const markersToFlash = this.markers.filter(m => m.speciesId === speciesId).map(m => m.id);
        if (markersToFlash.length > 0) {
          this.flashMarkers(markersToFlash);
        }

        // 7. Обновляем справочник и фокусируемся на виде
        this.updateSpeciesBrowseCounter();
        this.updateSpeciesTreeHighlightState();
        this.updateIsAllHighlightedFlag();
        this.updateHintUI(); // <-- Обновляем плашку

        // Открываем справочник и скроллим к виду
        this.openSpeciesPanel('browse');
        setTimeout(() => this.focusSpeciesInTree(speciesId), 50);
      });
      
      // Эффект наведения
      item.addEventListener('mouseenter', () => {
        if (item.style.background !== 'rgba(212, 180, 90, 0.3)') {
          item.style.background = 'rgba(212, 180, 90, 0.15)';
        }
      });
      item.addEventListener('mouseleave', () => {
        if (item.style.background !== 'rgba(212, 180, 90, 0.3)') {
          item.style.background = 'transparent';
        }
      });
    });

    // Обработчики клика по соседям
    document.querySelectorAll('.nearby-item').forEach(item => {
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = Number(item.dataset.markerId);
        const target = this.markers.find(m => m.id === id);
        if (!target) return;

        // 1. Сбрасываем ВСЕ предыдущие выделения
        this.highlightedIds.clear();
        this.highlightedSpeciesRegions.clear();
        this.highlightedSpeciesMigrations.clear();
        this.highlightedRegionId = null;

        // 2. Выделяем ВСЕ маркеры этого вида (соседа)
        this.markers.forEach(m => {
          if (m.speciesId === target.speciesId) {
            this.highlightedIds.add(m.id);
          }
        });

        // 3. Включаем его области и миграции
        if (target.speciesId) {
          this.highlightedSpeciesRegions.add(target.speciesId);
          this.highlightedSpeciesMigrations.add(target.speciesId);
        }

        // 4. Перерисовываем карту
        this.render();

        // 5. Мигаем (теперь мигаем всеми маркерами этого вида)
        const markersToFlash = this.markers.filter(m => m.speciesId === target.speciesId).map(m => m.id);
        this.flashMarkers(markersToFlash);

        // 6. Обновляем справочник и фокусируемся на виде
        this.updateSpeciesBrowseCounter();
        this.updateSpeciesTreeHighlightState();
        this.updateIsAllHighlightedFlag();
        this.updateHintUI(); // <-- Обновляем плашку

        // Открываем справочник и скроллим к виду
        this.openSpeciesPanel('browse');
        setTimeout(() => this.focusSpeciesInTree(target.speciesId), 50);
      });
    });

    const actions = document.getElementById('tooltip-actions');
    actions.style.display = this.developerMode ? 'flex' : 'none';
    actions.innerHTML = `
      <button id="btn-edit-marker" title="Редактировать">✏️ Редактировать</button>
      <button id="btn-delete-marker" class="danger" title="Удалить">🗑 Удалить</button>
    `;
    // Перенавешиваем обработчики, потому что innerHTML пересоздал кнопки
    document.getElementById('btn-edit-marker').addEventListener('click', () => {
      const id = Number(this.tooltip.dataset.markerId);
      this.openModal(id);
    });
    // Кнопка «Изучить вид в Красной книге»
    const scrollBtn = document.querySelector('#tooltip-content .scroll-open-btn');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = scrollBtn.dataset.speciesId;
        if (sid) this.openSpeciesScroll(sid, marker.id);
      });
    }
    document.getElementById('btn-delete-marker').addEventListener('click', () => {
      const id = Number(this.tooltip.dataset.markerId);
      const marker = this.markers.find(m => m.id === id);
      if (!marker) return;
      if (confirm(`Удалить маркер «${marker.name}»?`)) {
        this.markers = this.markers.filter(m => m.id !== id);
        this.highlightedIds.delete(id);
        Storage.save(this.markers);
        this.render();
        this.tooltip.style.display = 'none';
      }
    });

    this.tooltip.dataset.markerId = marker.id;

    // Сначала показываем тултип, чтобы узнать его реальные размеры
    this.tooltip.style.left = '0px';
    this.tooltip.style.top = '0px';
    this.tooltip.style.display = 'flex';

    const tooltipRect = this.tooltip.getBoundingClientRect();
    const tooltipW = tooltipRect.width;
    const tooltipH = tooltipRect.height;

    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;

    // Пробуем справа-снизу от курсора
    let left = clickX + 15;
    let top = clickY + 15;

    // Если уходит за правый край — сдвигаем влево
    if (left + tooltipW > this.container.clientWidth) {
      left = clickX - tooltipW - 15;
    }

    // Если уходит за нижний край — сдвигаем вверх
    if (top + tooltipH > this.container.clientHeight) {
      top = clickY - tooltipH - 15;
    }

    // Защита: тултип не должен вылезать за нижнюю границу контейнера
    if (top + tooltipH > this.container.clientHeight - 10) {
      top = this.container.clientHeight - tooltipH - 10;
    }

    // Если уходит за верхний край — прижимаем к верху
    if (top < 5) top = 5;

    // Если уходит за левый край — прижимаем к левому
    if (left < 5) left = 5;

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';

    // При раскрытии/закрытии спойлера пересчитываем позицию
    const details = this.tooltip.querySelector('.comment-details');
    if (details) {
      details.addEventListener('toggle', () => {
        this.repositionTooltip(e);
      });
    }
  },

  // Пересчёт позиции тултипа после изменения его размера
  repositionTooltip(e) {
    const containerRect = this.container.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const tooltipW = tooltipRect.width;
    const tooltipH = tooltipRect.height;

    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;

    let left = clickX + 15;
    let top = clickY + 15;

    if (left + tooltipW > this.container.clientWidth) {
      left = clickX - tooltipW - 15;
    }

    if (top + tooltipH > this.container.clientHeight) {
      top = clickY - tooltipH - 15;
    }

    if (top < 0) top = 5;
    if (left < 0) left = 5;

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  },

  // Клик по полигону области
    onRegionClick(e, region) {
    // --- НОВОЕ: Если мы в режиме объединения ---
    if (this._regionToMergeSource) {
      const sourceRegion = this.regions.find(r => r.id === this._regionToMergeSource);
      if (!sourceRegion) {
        this._regionToMergeSource = null;
        return;
      }

      if (sourceRegion.id === region.id) {
        alert('Нельзя объединить область саму с собой. Выберите другую.');
        return;
      }

      if (confirm(`Объединить область "${region.speciesList.map(s=>s.speciesName).join(', ')}" в основную?`)) {
        // Переносим виды из второй области в первую
        region.speciesList.forEach(sp => {
          if (!sourceRegion.speciesList.some(existing => existing.speciesId === sp.speciesId)) {
            sourceRegion.speciesList.push(sp);
            this.highlightedSpeciesRegions.add(sp.speciesId);
          }
        });

        // Удаляем вторую область
        this.regions = this.regions.filter(r => r.id !== region.id);
        Storage.saveRegions(this.regions);
      }

      this._regionToMergeSource = null;
      this.highlightedRegionId = null;
      this.renderRegions();
      this.tooltip.style.display = 'none';
      return;
    }

    // Запоминаем для подсветки
    this.highlightedRegionId = region.id;

    // Ищем все области, которые накрывают эту точку
    const rect = this.map.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const regionsHere = this.findRegionsAtPoint(x, y);

    // Показываем тултип
    this.showRegionTooltip(e, region, regionsHere);

    // Перерисовываем с подсветкой
    this.renderRegions();
  },

  // Клик по линии миграции
  onMigrationClick(e, migration) {
    // --- Если мы в режиме объединения линий ---
    if (this._migrationToMergeSource) {
      const sourceMig = this.migrations.find(m => m.id === this._migrationToMergeSource);
      if (!sourceMig) {
        this._migrationToMergeSource = null;
        return;
      }

      if (sourceMig.id === migration.id) {
        alert('Нельзя объединить линию саму с собой. Выберите другую.');
        return;
      }

      if (confirm(`Объединить линию "${migration.speciesName || migration.speciesId}" в основную?`)) {
      // Линия остается на своем месте, координаты не трогаем!

      // Собираем виды в массив (как у областей)
        if (!sourceMig.speciesList) {
          sourceMig.speciesList = [{
            speciesId: sourceMig.speciesId,
            speciesName: sourceMig.speciesName,
            category: sourceMig.category
          }];
        }

        // Добавляем виды из второй линии (если их там еще нет)
        if (migration.speciesList) {
          migration.speciesList.forEach(sp => {
            if (!sourceMig.speciesList.some(s => s.speciesId === sp.speciesId)) {
              sourceMig.speciesList.push(sp);
            }
          });
        } else if (migration.speciesId) {
          if (!sourceMig.speciesList.some(s => s.speciesId === migration.speciesId)) {
            sourceMig.speciesList.push({
              speciesId: migration.speciesId,
              speciesName: migration.speciesName,
              category: migration.category
            });
          }
        }

        // Удаляем вторую линию
        this.migrations = this.migrations.filter(m => m.id !== migration.id);
        Storage.saveMigrations(this.migrations);
      }

      this._migrationToMergeSource = null;
      this.renderRegions();
      this.tooltip.style.display = 'none';
      return;
    }

    const containerRect = this.container.getBoundingClientRect();

    // Ищем области, которые пересекает эта миграция
    const crossedRegions = this.regions.filter(r =>
      this.isLineIntersectsPolygon(migration.points, r.points)
    );

    let crossedHtml = '';
    if (crossedRegions.length > 0) {
      // Формируем карточки областей
      const regionCardsHtml = crossedRegions.map(r => {
        const speciesNames = r.speciesList.map(sp => {
          const int = sp.intensity || r.intensity || 'weak';
          const intLabel = int === 'strong' ? 'пост.' : 'непост.';
          return `<div class="tooltip-species-item" data-species-id="${sp.speciesId}" data-region-id="${r.id}" 
                       style="padding: 4px 2px; cursor: pointer; border-bottom: 1px dotted rgba(0,0,0,0.1); transition: background 0.15s; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 500; color: var(--ink); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 85%;">${sp.speciesName}</span>
                    <span style="font-size: 10px; color: var(--text-mid); flex-shrink: 0;">${intLabel}</span>
                  </div>`;
        }).join('');

        return `
          <div class="region-list-item" data-region-id="${r.id}"
               style="padding: 0 0 0 8px; margin-bottom: 4px; border: none; border-left: 3px solid var(--gold-deep);">
            <div class="region-list-info" style="width: 100%; display: flex; align-items: flex-start;">
               <div style="width: 100%;">
                  ${speciesNames}
               </div>
            </div>
          </div>
        `;
      }).join('');

      crossedHtml = `
        <div class="nearby-block" style="margin-top:10px; border-top: 1px dashed var(--parchment-deep); padding-top: 8px;">
          <div class="nearby-title">Пересекает области обитания (${crossedRegions.length}):</div>
          <div class="region-list">${regionCardsHtml}</div>
        </div>
      `;
    }

    // Собираем список названий видов (если линия слитая)
    let namesList = [];
    if (migration.speciesList && migration.speciesList.length > 0) {
      namesList = migration.speciesList.map(sp => sp.speciesName);
    } else {
      namesList = [migration.speciesName || migration.speciesId];
    }

    // Формируем аккуратный список (если видов несколько)
    let namesHtml = '';
    if (namesList.length === 1) {
      namesHtml = `<span style="font-size: 16px; font-weight: bold; letter-spacing: 0.3px;">${namesList[0]}</span>`;
    } else {
      namesHtml = `<div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px;">` +
        namesList.map(name => `<span style="font-size: 14px; font-weight: normal; line-height: 1.3; color: var(--ink);">${name}</span>`).join('') +
        `</div>`;
    }

    // Формируем кликабельный список видов для миграции
    let speciesListHtml = '';
    const migSpeciesArray = migration.speciesList || [{ speciesId: migration.speciesId, speciesName: migration.speciesName || migration.speciesId }];

    speciesListHtml = migSpeciesArray.map(sp => `
      <div class="species-link-item" data-species-id="${sp.speciesId}" style="cursor: pointer; font-size: 13px; color: var(--ink); padding: 3px 0; transition: color 0.15s; display: flex; justify-content: space-between; align-items: center;">
        <span>${sp.speciesName}</span>
        ${this.developerMode ? `<button class="mig-species-remove-btn" data-species-id="${sp.speciesId}" data-mig-id="${migration.id}" title="Удалить вид из миграции" style="background: none; border: none; color: var(--red-dark); cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1;">✕</button>` : ''}
      </div>
    `).join('');

    document.getElementById('tooltip-content').innerHTML = `
      <div id="tooltip-header">
        <div class="tooltip-drag-handle" style="cursor: move; display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span class="status" style="font-size: 13px; color: var(--red-dark); font-weight: bold;">Линия миграции</span>
          <span style="color: #999; font-size: 14px; user-select: none;">✥</span>
        </div>
        <div style="display: flex; flex-direction: column; margin-bottom: 4px;">
          ${speciesListHtml}
        </div>
      </div>
      <div id="tooltip-body">
        ${crossedHtml}
      </div>
    `;

    // Кнопки — только в режиме разработчика
    const actions = document.getElementById('tooltip-actions');
    if (this.developerMode) {
      actions.style.display = 'flex';
      actions.innerHTML = `
        <button id="btn-add-species-mig" title="Добавить вид в миграцию">➕ Добавить вид</button>
        <button id="btn-merge-migration" title="Объединить с другой">🔗 Объединить</button>
        <button id="btn-delete-migration" class="danger" title="Удалить линию">🗑 Удалить</button>
      `;
      document.getElementById('btn-add-species-mig').addEventListener('click', () => {
        this._migrationToAddSpecies = migration.id;
        this.tooltip.style.display = 'none';
        this.speciesPanelMode = 'pick';
        this.openSpeciesPanel('pick');
      });
      document.getElementById('btn-merge-migration').addEventListener('click', () => {
        this._migrationToMergeSource = migration.id;
        this.tooltip.style.display = 'none';
        alert('Теперь кликните по второй линии миграции, с которой нужно объединить эту.');
      });
      document.getElementById('btn-delete-migration').addEventListener('click', () => {
        if (confirm(`Удалить линию миграции вида «${migration.speciesName || migration.speciesId}»?`)) {
          this.deleteMigration(migration.id);
          this.tooltip.style.display = 'none';
        }
      });
    } else {
      actions.style.display = 'none';
      actions.innerHTML = '';
    }

    this.tooltip.dataset.migrationId = migration.id;
    this.tooltip.dataset.markerId = '';
    this.tooltip.dataset.regionId = '';
    this.tooltip.style.display = 'flex';

    // Обработчик удаления вида из миграции
    document.querySelectorAll('.mig-species-remove-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();

        const speciesId = btn.dataset.speciesId;
        const migId = Number(btn.dataset.migId);

        const mig = this.migrations.find(m => m.id === migId);
        if (!mig) return;

        // Если это не массив, значит удаляем единственный вид — удаляем всю линию
        if (!mig.speciesList || mig.speciesList.length <= 1) {
          if (confirm('Это единственный вид в линии. Удалить всю линию миграции?')) {
            this.migrations = this.migrations.filter(m => m.id !== migId);
            Storage.saveMigrations(this.migrations);
            this.tooltip.style.display = 'none';
            this.renderRegions();
          }
          return;
        }

        // Иначе просто удаляем вид из массива
        mig.speciesList = mig.speciesList.filter(sp => sp.speciesId !== speciesId);

        // Если удалили основной вид линии, назначаем новый основной и обновляем категорию
        if (mig.speciesId === speciesId) {
          mig.speciesId = mig.speciesList[0].speciesId;
          mig.speciesName = mig.speciesList[0].speciesName;
          mig.category = mig.speciesList[0].category;
        }

        Storage.saveMigrations(this.migrations);
        this.tooltip.style.display = 'none';
        this.renderRegions();
      });
    });

    // Обработчик клика по виду (в списке миграций и в карточках областей)
    document.querySelectorAll('.species-link-item, .tooltip-species-item').forEach(item => {
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const speciesId = item.dataset.speciesId;
        if (!speciesId) return;

        // 1. Сбрасываем ВСЕ предыдущие выделения
        this.highlightedIds.clear();
        this.highlightedSpeciesRegions.clear();
        this.highlightedSpeciesMigrations.clear();
        this.highlightedRegionId = null;

        // 2. Выделяем только этот вид
        this.highlightedSpeciesRegions.add(speciesId);
        this.highlightedSpeciesMigrations.add(speciesId);

        // 3. Выделяем все маркеры этого вида
        this.markers.forEach(m => {
          if (m.speciesId === speciesId) {
            this.highlightedIds.add(m.id);
          }
        });

        // 4. Перерисовываем карту
        this.render();

        // 5. Мигаем маркерами этого вида
        const markersToFlash = this.markers.filter(m => m.speciesId === speciesId).map(m => m.id);
        if (markersToFlash.length > 0) {
          this.flashMarkers(markersToFlash);
        }

        // 6. Обновляем справочник и фокусируемся на виде
        this.updateSpeciesBrowseCounter();
        this.updateSpeciesTreeHighlightState();
        this.updateIsAllHighlightedFlag();

        // Открываем справочник и скроллим к виду
        this.openSpeciesPanel('browse');
        setTimeout(() => this.focusSpeciesInTree(speciesId), 50);
      });
    });

    // Позиционируем рядом с курсором
    let left = e.clientX - containerRect.left + 15;
    let top = e.clientY - containerRect.top + 15;

    if (left + 320 > this.container.clientWidth) {
      left = e.clientX - containerRect.left - 320;
    }
    
    // Если не влезает по высоте — поднимаем выше курсора
    if (top + 150 > this.container.clientHeight) {
      top = e.clientY - containerRect.top - 150;
    }
    
    // Защита: прижимаем к границам
    if (top + 150 > this.container.clientHeight) {
      top = this.container.clientHeight - 150 - 10;
    }
    if (top < 5) top = 5;
    if (left < 5) left = 5;

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  },

  deleteMigration(migrationId) {
    this.migrations = this.migrations.filter(m => m.id !== migrationId);
    Storage.saveMigrations(this.migrations);
    this.renderRegions();
  },

  // Тултип для областей (показывает, какие виды тут отмечены)
  showRegionsTooltip(e, regions) {
    const containerRect = this.container.getBoundingClientRect();

    // Уникальные виды
    const speciesList = [];
    const seen = new Set();
    regions.forEach(r => {
      if (!seen.has(r.speciesId)) {
        seen.add(r.speciesId);
        speciesList.push(r.speciesName || r.speciesId);
      }
    });

    document.getElementById('tooltip-content').innerHTML = `
      <b>Область обитания</b><br>
      <span class="status">Здесь отмечены виды:</span>
      <div class="comment">${speciesList.join('<br>')}</div>
    `;

    const actions = document.getElementById('tooltip-actions');
    actions.style.display = 'none';

    this.tooltip.dataset.markerId = '';
    this.tooltip.style.display = 'flex';

    let left = e.clientX - containerRect.left + 15;
    let top = e.clientY - containerRect.top + 15;

    if (left + 300 > this.container.clientWidth) left = e.clientX - containerRect.left - 300;
    if (top + 200 > this.container.clientHeight) top = this.container.clientHeight - 200;

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  },

    showRegionTooltip(e, region, regionsHere) {
    const containerRect = this.container.getBoundingClientRect();

    // Уникальные области (по id)
    const uniqueRegions = [];
    const seenIds = new Set();
    regionsHere.forEach(r => {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        uniqueRegions.push(r);
      }
    });

    // Строим список областей
    const regionsListHtml = uniqueRegions.map(r => {
      const isCurrent = r.id === this.highlightedRegionId;
      const isDev = this.developerMode;
      
      // Формируем список видов (максимально компактно)
      const speciesNames = r.speciesList.map(sp => {
        const int = sp.intensity || r.intensity || 'weak';
        const intLabel = int === 'strong' ? 'пост.' : 'непост.';
        return `<div class="tooltip-species-item" data-species-id="${sp.speciesId}" data-region-id="${r.id}" 
                     style="padding: 4px 2px; cursor: pointer; border-bottom: 1px dotted rgba(0,0,0,0.1); transition: background 0.15s; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: 500; color: var(--ink); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">${sp.speciesName}</span>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 10px; color: var(--text-mid); flex-shrink: 0;">${intLabel}</span>
                    ${isDev ? `<button class="species-remove-btn" data-species-id="${sp.speciesId}" data-region-id="${r.id}" title="Удалить вид из области" style="background: none; border: none; color: var(--red-dark); cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1;">✕</button>` : ''}
                  </div>
                </div>`;
      }).join('');

      return `
        <div class="region-list-item${isCurrent ? ' current' : ''}"
             data-region-id="${r.id}"
             style="padding: 0 0 0 8px; margin-bottom: 4px; border: none; border-left: 3px solid var(--gold-deep);">
          <div class="region-list-info" style="width: 100%; display: flex; align-items: flex-start;">
             <div style="width: 100%;">
                ${speciesNames}
             </div>
             ${isDev ? `<button class="region-delete-btn" data-region-delete-id="${r.id}" title="Удалить область" style="border:none; background:none; cursor:pointer; padding:0; font-size: 10px; margin-left: 4px;">🗑</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Собираем блок маркеров внутри области
    const markersInsideHtml = this.renderMarkersInsideBlock();

    // --- Ищем линии миграций, которые пересекают выбранную область ---
    const currentRegion = this.regions.find(r => r.id === this.highlightedRegionId);
    let migrationsHtml = '';
    if (currentRegion) {
      const intersectingMigrations = this.migrations.filter(mig => 
        this.isLineIntersectsPolygon(mig.points, currentRegion.points)
      );

      if (intersectingMigrations.length > 0) {
        const migGroups = new Map();
        intersectingMigrations.forEach(mig => {
          const key = mig.speciesId || mig.speciesName;
          if (!migGroups.has(key)) {
            migGroups.set(key, { name: mig.speciesName || mig.speciesId, count: 1 });
          } else {
            migGroups.get(key).count++;
          }
        });

        const migItems = [...migGroups.values()].map(g => {
          const countLabel = g.count > 1 ? ` <span style="color:#7a2d2d;font-weight:600;">×${g.count}</span>` : '';
          return `<div class="region-marker-item" style="padding:3px 8px;">
                    <span class="nearby-icon">⇔</span>
                    <span class="nearby-name" style="flex:1;">${g.name}${countLabel}</span>
                  </div>`;
        }).join('');

        migrationsHtml = `
          <div class="nearby-block" style="margin-top:10px; border-top: 1px solid var(--parchment-deep); padding-top: 8px;">
            <div class="nearby-title">⇔ Пересекают эту область (${migGroups.size} видов):</div>
            ${migItems}
          </div>
        `;
      }
    }

      // Кнопки управления в режиме разработчика
      let devControlsHtml = '';
      if (this.developerMode && currentRegion) {
        devControlsHtml = `
        <div id="region-dev-controls" style="display: flex; flex-direction: column; gap: 6px;">
          <button id="btn-region-add-species" class="sub-btn" style="max-height: 40px; opacity: 1; padding: 6px; font-size: 12px; background: var(--parchment); color: var(--ink); border: 1px solid var(--gold-deep); cursor: pointer;">
            ➕ Добавить вид в область
          </button>
          <button id="btn-region-merge" class="sub-btn" style="max-height: 40px; opacity: 1; padding: 6px; font-size: 12px; background: #f5e3df; color: var(--red-dark); border: 1px solid #d9b8b0; cursor: pointer;">
            🔗 Объединить с другой областью
          </button>
        </div>
      `;
      }

      document.getElementById('tooltip-content').innerHTML = `
      <div id="tooltip-header">
        <div class="tooltip-drag-handle" style="cursor: move; display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <b>Область обитания</b>
          <span style="color: #999; font-size: 14px; user-select: none;">✥</span>
        </div>
        <span class="status" style="display: block;">Найдено областей в точке: ${uniqueRegions.length}</span>
      </div>
      <div id="tooltip-body">
        <div class="region-list">${regionsListHtml}</div>
        <div id="region-markers-block">${markersInsideHtml}</div>
        ${migrationsHtml}
      </div>
      ${devControlsHtml ? `<div id="tooltip-fixed-footer">${devControlsHtml}</div>` : ''}
    `;

    // Скрываем стандартные кнопки тултипа
    const actions = document.getElementById('tooltip-actions');
    actions.style.display = 'none';
    actions.innerHTML = '';

    // --- Обработчики кнопок ---
    
    // Удаление области
    document.querySelectorAll('.region-delete-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = Number(btn.dataset.regionDeleteId);
        const target = this.regions.find(r => r.id === id);
        if (!target) return;
        if (confirm(`Удалить область?`)) {
          this.deleteRegion(id);
          this.tooltip.style.display = 'none';
        }
      });
    });

    // --- Клик по конкретному виду внутри области ---
    document.querySelectorAll('.tooltip-species-item').forEach(item => {
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        
        const speciesId = item.dataset.speciesId;
        const targetRegionId = Number(item.dataset.regionId);
        
        if (!speciesId || !targetRegionId) return;

        // 1. Сбрасываем ВСЕ предыдущие выделения
        this.highlightedIds.clear();
        this.highlightedSpeciesRegions.clear();
        this.highlightedSpeciesMigrations.clear();
        this.highlightedRegionId = null;

        // 2. Подсвечиваем именно эту область
        this.highlightedRegionId = targetRegionId;

        // 3. Выделяем только этот вид (и его объекты)
        this.highlightedSpeciesRegions.add(speciesId);
        this.highlightedSpeciesMigrations.add(speciesId);
        
        // 4. Выделяем все маркеры этого вида
        const speciesMarkers = this.markers.filter(m => m.speciesId === speciesId);
        speciesMarkers.forEach(m => this.highlightedIds.add(m.id));

        // 5. Перерисовываем карту
        this.render();
        
        // 6. Делаем визуальный акцент в тултипе
        document.querySelectorAll('.tooltip-species-item').forEach(el => el.style.background = 'transparent');
        item.style.background = 'rgba(212, 180, 90, 0.3)';
        
        // 7. Подсвечиваем область в списке
        document.querySelectorAll('.region-list-item').forEach(el => {
            el.classList.toggle('current', Number(el.dataset.regionId) === targetRegionId);
        });

        // 8. Мигаем маркерами этого вида (чтобы вы точно увидели, где они)
        if (speciesMarkers.length > 0) {
          this.flashMarkers(speciesMarkers.map(m => m.id), { hideTooltip: false });
        }

        // 9. Обновляем справочник и фокусируемся на виде
        this.updateSpeciesBrowseCounter();
        this.updateSpeciesTreeHighlightState();
        this.updateIsAllHighlightedFlag();
        this.updateHintUI(); // <-- Обновляем плашку

        // Открываем справочник и скроллим к виду
        this.openSpeciesPanel('browse');
        setTimeout(() => this.focusSpeciesInTree(speciesId), 50);

        // ТУЛТИП НЕ ЗАКРЫВАЕМ И НЕ ПЕРЕКЛЮЧАЕМ!
      });
    });

        // --- Удаление конкретного вида из области ---
    document.querySelectorAll('.species-remove-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation(); // Останавливаем клик, чтобы он не выделял вид
        ev.preventDefault();

        const speciesId = btn.dataset.speciesId;
        const regionId = Number(btn.dataset.regionId);
        
        if (!speciesId || !regionId) return;

        const region = this.regions.find(r => r.id === regionId);
        if (!region) return;

        // Находим вид, чтобы узнать его название для подтверждения
        const speciesToRemove = region.speciesList.find(sp => sp.speciesId === speciesId);
        const name = speciesToRemove ? speciesToRemove.speciesName : 'этот вид';

        if (confirm(`Удалить вид «${name}» из этой области?`)) {
          // Удаляем вид из списка
          region.speciesList = region.speciesList.filter(sp => sp.speciesId !== speciesId);
          
          // Если в области больше не осталось видов — удаляем и саму область
          if (region.speciesList.length === 0) {
            this.regions = this.regions.filter(r => r.id !== regionId);
            this.highlightedRegionId = null;
          }
          
          // Сохраняем и перерисовываем
          Storage.saveRegions(this.regions);
          this.renderRegions();
          
          // Закрываем тултип (так как данные изменились)
          this.tooltip.style.display = 'none';
        }
      });
    });

    // Клик по маркеру внутри области (в блоке "Маркеры внутри области")
    document.querySelectorAll('.region-marker-item').forEach(mi => {
      mi.addEventListener('click', (mev) => {
        mev.stopPropagation();
        const idsStr = mi.dataset.markerIds || '';
        const ids = idsStr.split(',').map(s => Number(s)).filter(Boolean);
        
        if (ids.length === 0) return;

        // 1. Сбрасываем всё старое
        this.highlightedIds.clear();
        this.highlightedSpeciesRegions.clear();
        this.highlightedSpeciesMigrations.clear();
        this.highlightedRegionId = null;

        // 2. Находим вид по первому маркеру из списка
        const firstMarker = this.markers.find(m => m.id === ids[0]);
        if (!firstMarker) return;
        const speciesId = firstMarker.speciesId;

        // 3. Выделяем все маркеры этого вида
        this.markers.forEach(m => {
          if (m.speciesId === speciesId) {
            this.highlightedIds.add(m.id);
          }
        });

        // 4. Включаем его области и миграции
        this.highlightedSpeciesRegions.add(speciesId);
        this.highlightedSpeciesMigrations.add(speciesId);

        // 5. Перерисовываем
        this.render();

        // 6. Мигаем найденными маркерами
        this.flashMarkers(ids, { hideTooltip: true });

        // 7. Обновляем справочник
        this.updateSpeciesBrowseCounter();
        this.updateSpeciesTreeHighlightState();
        this.updateIsAllHighlightedFlag();
      });
    });

    // Добавление вида
    const btnAdd = document.getElementById('btn-region-add-species');
    if (btnAdd) {
      btnAdd.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this._regionToAddSpecies = currentRegion.id;
        this.tooltip.style.display = 'none';
        this.speciesPanelMode = 'pick';
        this.openSpeciesPanel('pick');
      });
    }

    // Объединение
    const btnMerge = document.getElementById('btn-region-merge');
    if (btnMerge) {
      btnMerge.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this._regionToMergeSource = currentRegion.id;
        this.tooltip.style.display = 'none';
        alert('Теперь кликните по второй области на карте, с которой нужно объединить эту.');
      });
    }

    this.tooltip.dataset.markerId = '';
    this.tooltip.dataset.regionId = region.id;
    this.tooltip.style.display = 'flex';

    let left = e.clientX - containerRect.left + 15;
    let top = e.clientY - containerRect.top + 15;

    if (left + 340 > this.container.clientWidth) {
      left = e.clientX - containerRect.left - 340;
    }
    
    if (top + 300 > this.container.clientHeight) {
      top = this.container.clientHeight - 300 - 10;
    }

    if (left < 5) left = 5;
    if (top < 5) top = 5;

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  },

  deleteRegion(regionId) {
    this.regions = this.regions.filter(r => r.id !== regionId);
    Storage.saveRegions(this.regions);
    this.highlightedRegionId = null;
    this.renderRegions();
  },

  // ============================================================
  // Справочник видов
  // ============================================================

  // Открывает панель справочника.
  // mode = 'pick'   — выбор вида (из модалки), полоса управления скрыта
  // mode = 'browse' — просмотр (из сайдбара/слоя), полоса управления видна
  openSpeciesPanel(mode = 'pick', options = {}) {
    this.speciesPanelMode = mode;
    const focusSpeciesId = options.focusSpeciesId || null;

    // Если передан явный список видов — ставим фильтр по ним.
    // Иначе (при открытии «все виды» / «слои» / статусы) — фильтр по видам не трогаем,
    // его сбрасывают вызывающие места (btn-open-list, статусы, чекбокс слоя).
    if (options.speciesIds) {
      if (options.speciesIds.length > 0) {
        this.listSpeciesIds = new Set(options.speciesIds);
      } else {
        this.listSpeciesIds = null; // Если пусто — показываем всё
      }
    }

    const panel = document.getElementById('species-panel');
    panel.classList.remove('hidden');

    // Полоса управления выделением — только в режиме просмотра
    const browseControls = document.getElementById('species-browse-controls');
    if (browseControls) {
      browseControls.classList.toggle('hidden', mode !== 'browse');
    }

    // Сбрасываем поиск
    document.getElementById('species-search').value = '';

    // Перерисовываем дерево (пока без изменений в логике рендера)
    this.renderSpeciesTree('');

    // Обновляем счётчик и синхронизируем галочку, если открыто в режиме browse
    if (mode === 'browse') {
      
      // Синхронизируем текст кнопки массового выделения
      this.updateIsAllHighlightedFlag();

      const btnToggleExpand = document.getElementById('btn-species-toggle-expand');
      if (btnToggleExpand) {
        if (this.expandState === 0) btnToggleExpand.textContent = 'Развернуть всё';
        else if (this.expandState === 1) btnToggleExpand.textContent = 'Показать больше';
        else btnToggleExpand.textContent = 'Свернуть всё';
      }
      
      this.updateSpeciesBrowseCounter();
    }

    // Заголовок панели — с учётом фильтра по категориям
    const title = document.querySelector('#species-header h3');
    if (title) {
      const labels = [];
      if (mode === 'browse' && this.listFilter.size > 0) {
        CONFIG.categories.forEach(c => {
          if (this.listFilter.has(c.key)) labels.push(c.label);
        });
      }
      title.textContent = labels.length > 0
        ? 'Справочник видов · ' + labels.join(', ')
        : 'Справочник видов';
    }

    // Синхронизируем подсветку строк слоёв и кнопок статусов
    this.updateLayerFilterHighlight();
    this.updateStatusLayerHighlight();

    setTimeout(() => document.getElementById('species-search').focus(), 100);
    setTimeout(() => this.updateMarkerPositions(), 300);

    // Скролл к виду + авто-раскрытие
    if (focusSpeciesId) {
      setTimeout(() => this.focusSpeciesInTree(focusSpeciesId), 50);
    }
  },

  // Находит вид в дереве справочника, раскрывает все родительские группы,
  // раскрывает строку самого вида (если есть данные),
  // скроллит к нему и кратко подсвечивает.
  focusSpeciesInTree(speciesId) {
    const container = document.getElementById('species-tree');
    if (!container) return;

    // 1. Находим строку вида по data-species-id
    const item = container.querySelector(`[data-species-id="${speciesId}"]`);
    if (!item) {
      // Вид не отображается — возможно, отфильтрован
      return;
    }

    // 2. Раскрываем все родительские группы
    //    (снимаем класс collapsed со всех .species-group выше)
    let node = item.parentElement;
    while (node && node !== container) {
      if (node.classList && node.classList.contains('species-group')) {
        node.classList.remove('collapsed');
        const title = node.querySelector('.species-group-title .toggle-icon');
        if (title) title.textContent = '▼';
      }
      node = node.parentElement;
    }

    // 3. Если у вида есть раскрывающийся блок — раскрываем его
    const wrapper = item.closest('.species-browse-item');
    if (wrapper) {
      const children = wrapper.querySelector('.species-browse-children');
      if (children && children.classList.contains('collapsed')) {
        children.classList.remove('collapsed');
        const toggle = wrapper.querySelector('.species-toggle');
        if (toggle) toggle.textContent = '▼';
      }
    }

    // 4. В режиме алфавита (если открыт) — просто скроллим к элементу
    // (он уже будет на месте, так как список плоский)
    if (this.speciesView === 'alpha') {
      requestAnimationFrame(() => {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        item.classList.add('focus-flash');
        setTimeout(() => item.classList.remove('focus-flash'), 1500);
      });
      return; // Дальше не идём, прокрутка уже сделана
    }

    // 5. Скроллим к элементу — по центру видимой области
    //    (используем requestAnimationFrame, чтобы DOM успел обновиться
    //     после раскрытия всех групп)
    requestAnimationFrame(() => {
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 5. Краткая подсветка (в течение 1.5 сек)
      item.classList.add('focus-flash');
      setTimeout(() => item.classList.remove('focus-flash'), 1500);
    });
  },

  renderSpeciesTree(query = '') {
    const container = document.getElementById('species-tree');
    container.innerHTML = '';

    // Фильтры работают только в режиме browse
    const isBrowse = this.speciesPanelMode === 'browse';
    const activeFilter = isBrowse ? this.listFilter : null;
    const hasFilter = activeFilter && activeFilter.size > 0;

    // Алфавитный режим — плоский список
    if (this.speciesView === 'alpha' || query) {
      let allSpecies = this.collectAllSpecies();

      // Фильтр по категориям
      if (hasFilter) {
        allSpecies = allSpecies.filter(s => activeFilter.has(this.detectCategory(s.id)));
      }

      // Фильтр по статусам
      if (isBrowse) {
        allSpecies = allSpecies.filter(s => this.passesStatusFilter(s));
      }

      const filtered = query
        ? allSpecies.filter(s => (s.name + ' ' + s.latin).toLowerCase().includes(query))
        : allSpecies;
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

      filtered.forEach(s => {
        const item = this.createSpeciesItem(s);
        if (item) container.appendChild(item);
      });

if (container.children.length === 0) {
  container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Ничего не найдено</div>';
}
this.updateIsAllHighlightedFlag();  // ← добавить
return;
    }

    // Иерархический режим
    Object.entries(SPECIES).forEach(([groupKey, group]) => {
      // Если фильтр по категориям задан и текущей группы в нём нет — пропускаем
      if (hasFilter && !activeFilter.has(groupKey)) return;

      const groupEl = this.createGroupNode(this.shortNodeLabel(group.label), () => {
        return group.classes.map(cls => this.createClassNode(cls)).filter(Boolean);
      });

      // Если внутри группы после фильтрации ничего не осталось — не показываем
      const childrenContainer = groupEl.querySelector('.species-group-children');
      if (childrenContainer && childrenContainer.children.length === 0) {
        return;
      }

      container.appendChild(groupEl);
    });
    this.updateIsAllHighlightedFlag();
  },

  // Собирает все виды из всех групп в плоский массив
  collectAllSpecies() {
    const result = [];
    const walk = (node) => {
      if (node.species) result.push(...node.species);
      if (node.classes) node.classes.forEach(walk);
      if (node.orders) node.orders.forEach(walk);
    };
    Object.values(SPECIES).forEach(walk);
    return result;
  },

  findSpecies(node, query) {
    let results = [];
    if (node.species) {
      node.species.forEach(s => {
        const haystack = (s.name + ' ' + s.latin).toLowerCase();
        if (haystack.includes(query)) results.push(s);
      });
    }
    if (node.classes) node.classes.forEach(c => results = results.concat(this.findSpecies(c, query)));
    if (node.orders) node.orders.forEach(o => results = results.concat(this.findSpecies(o, query)));
    return results;
  },

  createGroupNode(label, childrenFn, collapsed = false) {
    const el = document.createElement('div');
    el.className = 'species-group' + (collapsed ? ' collapsed' : '');
    el.dataset.groupLabel = label;

    const title = document.createElement('div');
    title.className = 'species-group-title';
    title.innerHTML = `<span class="toggle-icon">${collapsed ? '▶' : '▼'}</span> ${this.shortNodeLabel(label)}`;
    title.addEventListener('click', () => {
      const isCollapsed = el.classList.toggle('collapsed');
      title.querySelector('.toggle-icon').textContent = isCollapsed ? '▶' : '▼';
    });

    const children = document.createElement('div');
    children.className = 'species-group-children';
    childrenFn().forEach(c => children.appendChild(c));

    el.appendChild(title);
    el.appendChild(children);
    return el;
  },

  createClassNode(cls) {
    const node = this.createCollapsibleNode(this.shortNodeLabel(cls.label), () => {
      const result = [];
      if (cls.species) {
        cls.species.forEach(s => {
          const item = this.createSpeciesItem(s);
          if (item) result.push(item);
        });
      }
      if (cls.orders) {
        cls.orders.forEach(o => {
          const n = this.createOrderNode(o);
          if (n) result.push(n);
        });
      }
      if (cls.classes) {
        cls.classes.forEach(c => {
          const n = this.createClassNode(c);
          if (n) result.push(n);
        });
      }
      return result;
    });

    // Если внутри ничего не осталось — не показываем ветку
    const childrenContainer = node.querySelector('.species-group-children');
    if (childrenContainer && childrenContainer.children.length === 0) {
      return null;
    }
    return node;
  },

  createOrderNode(order) {
    const node = this.createCollapsibleNode(this.shortNodeLabel(order.label), () => {
      const result = [];
      if (order.species) {
        order.species.forEach(s => {
          const item = this.createSpeciesItem(s);
          if (item) result.push(item);
        });
      }
      if (order.orders) {
        order.orders.forEach(subOrder => {
          const n = this.createOrderNode(subOrder);
          if (n) result.push(n);
        });
      }
      return result;
    });

    const childrenContainer = node.querySelector('.species-group-children');
    if (childrenContainer && childrenContainer.children.length === 0) {
      return null;
    }
    return node;
  },

  // Универсальный сворачиваемый узел
  createCollapsibleNode(label, childrenFn) {
    const el = document.createElement('div');
    el.className = 'species-group collapsed';
    el.dataset.groupLabel = label;

    const title = document.createElement('div');
    title.className = 'species-group-title';
    title.innerHTML = `<span class="toggle-icon">▶</span> ${this.shortNodeLabel(label)}`;
    title.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = el.classList.toggle('collapsed');
      title.querySelector('.toggle-icon').textContent = isCollapsed ? '▶' : '▼';
    });

    const children = document.createElement('div');
    children.className = 'species-group-children';
    childrenFn().forEach(c => children.appendChild(c));

    el.appendChild(title);
    el.appendChild(children);
    return el;
  },

  createSpeciesItem(species) {
    // В режиме выбора — просто строка для клика
    if (this.speciesPanelMode !== 'browse') {
      const statusConfig = CONFIG.statuses.find(s => s.value === species.status);

      const el = document.createElement('div');
      el.className = 'species-item';
      el.innerHTML = `
        <span class="species-status-badge" style="background:${statusConfig ? statusConfig.color : '#999'};">
          ${species.status}
        </span>
        <div style="flex:1;">
          <span class="species-name">${species.name}</span>
          <span class="species-latin">${species.latin}</span>
        </div>
      `;

      el.addEventListener('click', () => this.pickSpecies(species));
      return el;
    }

    // В режиме просмотра применяем фильтр по статусам.
    // Если вид не проходит — возвращаем null, чтобы родитель его не добавлял.
    if (!this.passesStatusFilter(species)) return null;

    // Фильтр по конкретным видам (из выпадающего подменю слоёв).
    // Если listSpeciesIds задан — оставляем только виды из него.
    if (this.listSpeciesIds && this.listSpeciesIds.size > 0) {
      if (!this.listSpeciesIds.has(species.id)) return null;
    }

    // Раскрываемая строка с инфо о маркерах
    return this.createSpeciesBrowseRow(species);
  },

  // Строит раскрываемую строку вида для режима browse.
  // Если у вида нет ни маркеров, ни областей, ни миграций — возвращает
  // обычную строку без стрелочки и без раскрытия.
  createSpeciesBrowseRow(species) {
    const speciesId = species.id;
    const statusConfig = CONFIG.statuses.find(s => s.value === species.status);

    // Собираем данные по этому виду
    const markers = this.markers.filter(m => m.speciesId === speciesId);
    const regions = this.regions.filter(r => r.speciesList && r.speciesList.some(sp => sp.speciesId === speciesId));
    const migrations = this.migrations.filter(m => m.speciesId === speciesId);
    const hasData = markers.length > 0 || regions.length > 0 || migrations.length > 0;
    // Если данных нет — рисуем строку с пустой ячейкой под стрелку,
    // чтобы бейдж статуса встал в один ряд с видами, у которых есть данные.
    if (!hasData) {
      const el = document.createElement('div');
      el.className = 'species-item species-item-empty';
      el.dataset.speciesId = speciesId;
      el.innerHTML = `
        <span class="species-toggle species-toggle-empty"></span>
        <span class="species-status-badge" style="background:${statusConfig ? statusConfig.color : '#999'};">
          ${species.status}
        </span>
        <div style="flex:1;">
          <span class="species-name">${species.name}</span>
          <span class="species-latin">${this.shortNodeLabel(species.latin)}</span>
        </div>
        <span class="species-book" title="Изучить вид в Красной книге">📖</span>
      `;
      this.attachBookHandler(el, speciesId);
      return el;
    }

    // Есть данные — раскрываемая строка
    const groupKey = speciesId;
    const isExpanded = this.expandedGroups.has(groupKey);

    const wrapper = document.createElement('div');
    wrapper.className = 'species-browse-item';

    // Родительская строка
    const parent = document.createElement('div');
    parent.className = 'species-item species-item-group';
    parent.dataset.speciesId = speciesId;
    parent.innerHTML = `
      <span class="species-toggle">${isExpanded ? '▼' : '▶'}</span>
      <span class="species-status-badge" style="background:${statusConfig ? statusConfig.color : '#999'};">
        ${species.status}
      </span>
      <div style="flex:1;">
        <span class="species-name">${species.name}</span>
        <span class="species-latin">${this.shortNodeLabel(species.latin)}</span>
      </div>
      <span class="species-book" title="Изучить вид в Красной книге">📖</span>
    `;
    this.attachBookHandler(parent, speciesId);

    // Контейнер для раскрываемого содержимого
    const childContainer = document.createElement('div');
    childContainer.className = 'species-browse-children' + (isExpanded ? '' : ' collapsed');

    // --- Формируем единую строку иконок ---
    const iconsRow = document.createElement('div');
    iconsRow.className = 'species-browse-icons-row';

    // 1. Маркеры по форматам
    if (markers.length > 0) {
      const cat = this.detectCategory(speciesId);
      const formatSet = cat === 'animals' ? CONFIG.markers.animals : CONFIG.markers.plants;

      const byFormat = {};
      markers.forEach(m => {
        const key = m.markerType || 'none';
        if (!byFormat[key]) byFormat[key] = [];
        byFormat[key].push(m);
      });

      Object.entries(byFormat).forEach(([formatKey, items]) => {
        const format = formatSet.find(f => f.key === formatKey);
        const formatSymbol = format ? format.symbol : '·';
        const formatColor = format ? format.color : '#999';
        const allHighlighted = items.every(m => this.highlightedIds.has(m.id));

        const icon = document.createElement('div');
        icon.className = 'species-browse-icon-item' + (allHighlighted ? ' highlighted' : '');
        icon.title = format ? format.label : 'Маркеры';
        icon.innerHTML = `
          <span class="icon-symbol" style="color:${formatColor};">${formatSymbol}</span>
          <span class="icon-count">${items.length}</span>
        `;

        icon.addEventListener('click', (e) => {
          e.stopPropagation();
          const allHi = items.every(m => this.highlightedIds.has(m.id));
          if (allHi) {
            items.forEach(m => this.highlightedIds.delete(m.id));
          } else {
            items.forEach(m => this.highlightedIds.add(m.id));
          }
          this.render();
          this.updateSpeciesTreeHighlightState();
          this.updateSpeciesBrowseCounter();
        });

        iconsRow.appendChild(icon);
      });
    }

    // 2. Области обитания
    if (regions.length > 0) {
      const isRegionHighlighted = this.highlightedSpeciesRegions.has(speciesId);

      const icon = document.createElement('div');
      icon.className = 'species-browse-icon-item' + (isRegionHighlighted ? ' highlighted' : '');
      icon.title = 'Область обитания';
      icon.innerHTML = `
        <span class="icon-symbol" style="font-size:12px;">🌍</span>
        <span class="icon-count">${regions.length}</span>
      `;

      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.highlightedSpeciesRegions.has(speciesId)) {
          this.highlightedSpeciesRegions.delete(speciesId);
        } else {
          this.highlightedSpeciesRegions.add(speciesId);
        }
        this.render();
        this.updateSpeciesTreeHighlightState();
        this.updateSpeciesBrowseCounter();
      });

      iconsRow.appendChild(icon);
    }

    // 3. Линии миграций
    if (migrations.length > 0) {
      const isMigrationHighlighted = this.highlightedSpeciesMigrations.has(speciesId);

      const icon = document.createElement('div');
      icon.className = 'species-browse-icon-item' + (isMigrationHighlighted ? ' highlighted' : '');
      icon.title = 'Линии миграций';
      icon.innerHTML = `
        <span class="icon-symbol species-browse-symbol-mig">⇔</span>
        <span class="icon-count">${migrations.length}</span>
      `;

      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.highlightedSpeciesMigrations.has(speciesId)) {
          this.highlightedSpeciesMigrations.delete(speciesId);
        } else {
          this.highlightedSpeciesMigrations.add(speciesId);
        }
        this.render();
        this.updateSpeciesTreeHighlightState();
        this.updateSpeciesBrowseCounter();
      });

      iconsRow.appendChild(icon);
    }

    childContainer.appendChild(iconsRow);

    // Клик по родительской строке — раскрыть/свернуть
    parent.addEventListener('click', () => {
      const isCollapsedNow = childContainer.classList.contains('collapsed');
      childContainer.classList.toggle('collapsed');
      parent.querySelector('.species-toggle').textContent = isCollapsedNow ? '▼' : '▶';

      if (isCollapsedNow) {
        this.expandedGroups.add(groupKey);
      } else {
        this.expandedGroups.delete(groupKey);
      }
    });

    // Маркируем обёртку — по ней будем искать строку вида при скролле
    wrapper.dataset.speciesId = speciesId;

    wrapper.appendChild(parent);
    wrapper.appendChild(childContainer);
    return wrapper;
  },

  // Навешивает обработчик клика на книжечку внутри строки вида.
  // Клик не запускает раскрытие строки (stopPropagation),
  // а открывает свиток о виде.
  attachBookHandler(rowEl, speciesId) {
    const book = rowEl.querySelector('.species-book');
    if (!book) return;
    book.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.openSpeciesScroll(speciesId);
    });
  },

  pickSpecies(species) {
    const category = this.detectCategory(species.id);
    const catConfig = CONFIG.categories.find(c => c.key === category);

    // --- НОВОЕ: Добавление вида в существующую линию миграции ---
    if (this._migrationToAddSpecies) {
      const mig = this.migrations.find(m => m.id === this._migrationToAddSpecies);
      if (mig) {
        // Если у линии еще нет массива видов, создаем его из текущего
        if (!mig.speciesList) {
          mig.speciesList = [{ speciesId: mig.speciesId, speciesName: mig.speciesName, category: mig.category }];
        }

        // Добавляем вид, если его еще нет
        if (!mig.speciesList.some(sp => sp.speciesId === species.id)) {
          mig.speciesList.push({ speciesId: species.id, speciesName: species.name, category: category });
          Storage.saveMigrations(this.migrations);
          this.highlightedSpeciesMigrations.add(species.id);
        }

        // Перерисовываем карту, чтобы обновить линии
        this.renderRegions();
      }
      this._migrationToAddSpecies = null;
      document.getElementById('species-panel').classList.add('hidden');
      this.renderRegions();
      return;
    }

  // --- НОВОЕ: Добавление вида в существующую область ---
    if (this._regionToAddSpecies) {
      const region = this.regions.find(r => r.id === this._regionToAddSpecies);
      if (region) {
        // Проверяем, нет ли уже такого вида в области
        if (!region.speciesList.some(sp => sp.speciesId === species.id)) {
          region.speciesList.push({ speciesId: species.id, speciesName: species.name, category: category, intensity: region.intensity || 'weak' });
          Storage.saveRegions(this.regions);
          // Добавляем вид в список выделенных, чтобы область не пропала
          this.highlightedSpeciesRegions.add(species.id);
        }
      }
      this._regionToAddSpecies = null;
      document.getElementById('species-panel').classList.add('hidden');
      this.renderRegions();
      return;
    }

    // Если выбираем вид для области — заполняем поля модалки области
    if (this.pickingRegionSpecies) {
      document.getElementById('region-species').value = species.name;
      document.getElementById('region-species-id').value = species.id;
      document.getElementById('region-name').value = species.name;
      const regionInfo = document.getElementById('region-category-info');
      if (regionInfo) regionInfo.textContent = catConfig ? catConfig.label : '—';

      // Запоминаем как активный вид для показа областей
      this.activeRegionSpeciesId = species.id;

      this.pickingRegionSpecies = false;
      document.getElementById('species-panel').classList.add('hidden');
      return;
    }

    // Если выбираем вид для миграции — заполняем поля модалки миграции
    if (this.pickingMigrationSpecies) {
      document.getElementById('migration-species').value = species.name;
      document.getElementById('migration-species-id').value = species.id;
      document.getElementById('migration-name').value = species.name;
      const migInfo = document.getElementById('migration-category-info');
      if (migInfo) migInfo.textContent = catConfig ? catConfig.label : '—';

      this.pickingMigrationSpecies = false;
      document.getElementById('species-panel').classList.add('hidden');
      return;
    }

    // Обычный режим — для маркера
    document.getElementById('input-species').value = species.name;
    document.getElementById('input-species-id').value = species.id;
    document.getElementById('input-name').value = species.name;

    if (catConfig) {
      document.getElementById('input-category').value = category;
    }

    this.selectStatus(species.status);
    this.selectedMarkerType = null;
    this.renderMarkerTypeSelect(category);

    const catInfo = document.getElementById('category-info');
    if (catInfo) catInfo.textContent = catConfig ? catConfig.label : '—';

    document.getElementById('species-panel').classList.add('hidden');
  },

  detectCategory(speciesId) {
    if (!this._speciesCategoryCache) {
      this._speciesCategoryCache = new Map();
      const walk = (node, group) => {
        if (node.species) {
          node.species.forEach(s => this._speciesCategoryCache.set(s.id, group));
        }
        if (node.classes) node.classes.forEach(c => walk(c, group));
        if (node.orders) node.orders.forEach(o => walk(o, group));
      };
      for (const [groupKey, group] of Object.entries(SPECIES)) {
        walk(group, groupKey);
      }
    }
    return this._speciesCategoryCache.get(speciesId) || null;
  },

  // Проверяет, проходит ли вид фильтр по статусам.
  // Если фильтр пуст — пропускаем всех.
  passesStatusFilter(species) {
    if (this.listStatuses.size === 0) return true;
    return this.listStatuses.has(species.status);
  },  

  // Возвращает массив видов, которые сейчас отображаются в справочнике
// с учётом активных фильтров по категориям (listFilter) и статусам (listStatuses).
getVisibleSpecies() {
  let allSpecies = this.collectAllSpecies();

  // Фильтр по категориям (слоям) — работает только если задан
  if (this.listFilter.size > 0) {
    allSpecies = allSpecies.filter(s => this.listFilter.has(this.detectCategory(s.id)));
  }

  // Фильтр по статусам — работает только если задан
  if (this.listStatuses.size > 0) {
    allSpecies = allSpecies.filter(s => this.listStatuses.has(s.status));
  }

  // Оставляем только виды, у которых есть хоть какие-то данные
  // (маркеры, области или миграции) — иначе «Выделить всех» будет
  // пытаться выделить пустые виды, и «Снять выделение» не появится.
  allSpecies = allSpecies.filter(sp => {
    const hasMarker = this.markers.some(m => m.speciesId === sp.id);
    const hasRegion = this.regions.some(r =>
      r.speciesList && r.speciesList.some(x => x.speciesId === sp.id)
    );
    const hasMigration = this.migrations.some(m => m.speciesId === sp.id);
    return hasMarker || hasRegion || hasMigration;
  });

  // Фильтр по конкретным видам (из выпадающего подменю слоёв)
  if (this.listSpeciesIds && this.listSpeciesIds.size > 0) {
    allSpecies = allSpecies.filter(s => this.listSpeciesIds.has(s.id));
  }

  return allSpecies;
},

// Пересчитывает флаг isAllHighlighted: все ли ВИДИМЫЕ виды в справочнике выделены.
// Возвращает актуальное значение.
updateIsAllHighlightedFlag() {
  if (this.speciesPanelMode !== 'browse') return this.isAllHighlighted;

  const visibleSpecies = this.getVisibleSpecies();

  // Считаем "есть ли хоть что-то выделенное среди видимых видов"
  const hasAnyHighlighted = visibleSpecies.some(sp => {
    const hasMarker = this.markers.some(
      m => m.speciesId === sp.id && this.highlightedIds.has(m.id)
    );
    const hasRegion = this.highlightedSpeciesRegions.has(sp.id);
    const hasMigration = this.highlightedSpeciesMigrations.has(sp.id);
    return hasMarker || hasRegion || hasMigration;
  });

  this.isAllHighlighted = hasAnyHighlighted;

  const btn = document.getElementById('btn-species-toggle-all');
  if (btn) {
    btn.textContent = this.isAllHighlighted ? 'Снять выделение' : 'Выделить всех';
  }

  return this.isAllHighlighted;
},

  // ============================================================
  // Счётчик выделенных в справочнике (режим browse)
  // ============================================================

  // Обновляет счётчик выделенных в панели справочника (режим browse)
  updateSpeciesBrowseCounter() {
    const container = document.getElementById('species-browse-counter');
    if (!container) return;

    const markersCount = this.highlightedIds.size;

    // Уникальные виды с выделенными областями
    const highlightedRegionsSet = new Set();
    this.regions.forEach(r => {
      if (r.speciesList) {
        r.speciesList.forEach(sp => {
          if (this.highlightedSpeciesRegions.has(sp.speciesId)) {
            highlightedRegionsSet.add(sp.speciesId);
          }
        });
      }
    });
    const regionsCount = highlightedRegionsSet.size;

    // Уникальные виды с выделенными миграциями
    const highlightedMigrationsSet = new Set();
    this.migrations.forEach(m => {
      if (m.speciesId && this.highlightedSpeciesMigrations.has(m.speciesId)) {
        highlightedMigrationsSet.add(m.speciesId);
      }
    });
    const migrationsCount = highlightedMigrationsSet.size;

    if (markersCount === 0 && regionsCount === 0 && migrationsCount === 0) {
      container.textContent = 'Ничего не выделено';
      container.classList.add('empty');
      return;
    }

    container.classList.remove('empty');

    const parts = [];
    if (markersCount > 0) {
      parts.push(`<strong>${markersCount}</strong> ${this.plural(markersCount, 'маркер', 'маркера', 'маркеров')}`);
    }
    if (regionsCount > 0) {
      parts.push(`<strong>${regionsCount}</strong> ${this.plural(regionsCount, 'вид', 'вида', 'видов')} с областями`);
    }
    if (migrationsCount > 0) {
      parts.push(`<strong>${migrationsCount}</strong> ${this.plural(migrationsCount, 'вид', 'вида', 'видов')} с миграциями`);
    }

    container.innerHTML = 'Выделено: ' + parts.join(', ');
  },  

    // Обновляет только классы .highlighted у существующих DOM-элементов дерева,
  // НЕ пересобирая само дерево. Нужен, чтобы клик по маркеру/области/миграции
  // в справочнике не схлопывал раскрытые группы и виды.
  updateSpeciesTreeHighlightState() {
    const container = document.getElementById('species-tree');
    if (!container) return;

    // Виды: обновляем highlighted у раскрываемых строк
    container.querySelectorAll('.species-browse-item').forEach(wrapper => {
      const speciesId = wrapper.dataset.speciesId;
      if (!speciesId) return;

      const markers = this.markers.filter(m => m.speciesId === speciesId);
      const regions = this.regions.filter(r => r.speciesList && r.speciesList.some(sp => sp.speciesId === speciesId));
      const migrations = this.migrations.filter(m => m.speciesId === speciesId);

      // Собираем иконки в том же порядке, в котором они создавались
      const iconItems = wrapper.querySelectorAll('.species-browse-icons-row .species-browse-icon-item');
      let idx = 0;

      // Маркеры по форматам
      if (markers.length > 0) {
        const byFormat = {};
        markers.forEach(m => {
          const key = m.markerType || 'none';
          if (!byFormat[key]) byFormat[key] = [];
          byFormat[key].push(m);
        });

        Object.values(byFormat).forEach(items => {
          if (iconItems[idx]) {
            const allHi = items.every(m => this.highlightedIds.has(m.id));
            iconItems[idx].classList.toggle('highlighted', allHi);
          }
          idx++;
        });
      }

      // Область
      if (regions.length > 0) {
        if (iconItems[idx]) {
          iconItems[idx].classList.toggle('highlighted', this.highlightedSpeciesRegions.has(speciesId));
        }
        idx++;
      }

      // Миграции
      if (migrations.length > 0) {
        if (iconItems[idx]) {
          iconItems[idx].classList.toggle('highlighted', this.highlightedSpeciesMigrations.has(speciesId));
        }
        idx++;
      }
    });
  },

  // Склонение русских слов: plural(1, 'маркер', 'маркера', 'маркеров') → 'маркер'
  plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  },

  
  // Возвращает вид по его id из SPECIES (с кэшированием)
  findSpeciesById(speciesId) {
    if (!this._speciesCache) {
      this._speciesCache = new Map();
      const walk = (node) => {
        if (node.species) {
          node.species.forEach(s => this._speciesCache.set(s.id, s));
        }
        if (node.classes) node.classes.forEach(walk);
        if (node.orders) node.orders.forEach(walk);
      };
      Object.values(SPECIES).forEach(walk);
    }
    return this._speciesCache.get(speciesId) || null;
  },

  // Обновляет плашку в правом нижнем углу
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
};

document.addEventListener('DOMContentLoaded', () => App.init());