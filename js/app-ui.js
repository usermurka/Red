// ============================================================
// ПОСТРОЕНИЕ ИНТЕРФЕЙСА: переключатель карт, слои, подменю категорий, счётчики
// ============================================================

(function () {
'use strict';
const App = window.App;
const esc = window.esc || window.escapeHtml;
const xyToGeo = window.xyToGeo;

Object.assign(App, {
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
});
})();
