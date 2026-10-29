// ============================================================
// СПРАВОЧНИК ВИДОВ: панель выбора/просмотра, дерево таксонов, поиск и фильтры
// ============================================================

(function () {
'use strict';
const App = window.App;
const esc = window.esc || window.escapeHtml;
const xyToGeo = window.xyToGeo;

Object.assign(App, {
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

      let filtered;
      if (query) {
        // Не вызываем toLowerCase() для каждой записи при каждом нажатии клавиши:
        // кэшируем «сниженный» текст поиска; инвалидация — при изменении
        // ссылки на собранный список видов (перезагрузка данных и т.п.)
        if (allSpecies !== this._searchCacheRef) {
          this._searchCacheRef = allSpecies;
          this._searchCacheList = allSpecies.map(s => ({
            s, hay: ((s.name || '') + ' ' + (s.latin || '')).toLowerCase(),
          }));
        }
        filtered = this._searchCacheList.filter(e => e.hay.includes(query)).map(e => e.s);
      } else {
        filtered = allSpecies;
      }
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
        <span class="species-status-badge" style="background:${statusConfig ? esc(statusConfig.color) : '#999'};">
          ${species.status}
        </span>
        <div style="flex:1;">
          <span class="species-name">${esc(species.name)}</span>
          <span class="species-latin">${esc(species.latin)}</span>
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
        <span class="species-status-badge" style="background:${statusConfig ? esc(statusConfig.color) : '#999'};">
          ${species.status}
        </span>
        <div style="flex:1;">
          <span class="species-name">${esc(species.name)}</span>
          <span class="species-latin">${esc(this.shortNodeLabel(species.latin))}</span>
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
      <span class="species-status-badge" style="background:${statusConfig ? esc(statusConfig.color) : '#999'};">
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
          LocalStore.saveMigrations(this.migrations);
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
          LocalStore.saveRegions(this.regions);
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


});
})();
