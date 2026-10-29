// ============================================================
// СВИТОК О ВИДЕ, ОБЛАСТИ ОБИТАНИЯ И МИГРАЦИИ: геометрия слоёв, рисование, модалки, режимы
// ============================================================

(function () {
'use strict';
const App = window.App;
const esc = window.esc || window.escapeHtml;
const xyToGeo = window.xyToGeo;

Object.assign(App, {
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
          <h3>${esc(name)}</h3>
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
          Их можно добавить в файл <code>js/species-data.js</code> (объект <code>SPECIES_DATA</code>)
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
          <li class="scroll-nearby-item" data-species-id="${esc(sp.id)}" style="cursor:pointer;">
            <span class="scroll-nearby-name">${esc(sp.name)}</span>
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
              <span class="scroll-nearby-name">${esc(name)}${countLabel}</span>
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
  getMapLayerOffset() {
    const img = this.map || document.getElementById('map');
    const layer = this.markersLayer;
    if (!img || !layer) return { x: 0, y: 0 };

    let dx = 0, dy = 0;
    try {
      const ir = img.getBoundingClientRect();
      const lr = layer.getBoundingClientRect();
      // Делим на текущий zoom: гетBoundingClientRect учитывает transform
      // wrapper'а, а left/top маркеров — нет.
      const z = this.zoom || 1;
      dx = (ir.left - lr.left) / z;
      dy = (ir.top - lr.top) / z;
    } catch (e) { /* layout ещё не готов — нулевой зазор */ }

    // Ручные поправки (можно подвигать эти цифры вверху объекта App)
    dx += this.markerAlignX;
    dy += this.markerAlignY;
    return { x: dx, y: dy };
  },

  // Отдельная пара поправок для контуров областей (SVG-слой)
  getRegionLayerOffset() {
    const off = this.getMapLayerOffset();
    return {
      x: off.x - this.markerAlignX + this.regionAlignX,
      y: off.y - this.markerAlignY + this.regionAlignY
    };
  },

  // ============================================================
  // Ручная растяжка слоёв вокруг ЦЕНРА карты (Scale-параметры выше)
  // ============================================================
  // Позиция в пикселях слоя пересчитывается так, что центр карты остаётся
  // неподвижным, а края симметрично расходятся/сходятся при scale != 1.
  applyLayerScale(px, py, w, h, sx, sy) {
    if (sx === 1 && sy === 1) return { x: px, y: py };
    return {
      x: w / 2 + (px - w / 2) * sx,
      y: h / 2 + (py - h / 2) * sy
    };
  },

  // То же для координат внутри SVG-слоя областей: вместо ручной правки
  // каждой точки проще растянуть весь svg — viewBox остаётся прежним,
  // поэтому все контуры масштабируются автоматически вокруг центра.
  // Возвращает строку transform или 'none'.
  getRegionSvgTransform() {
    const sx = this.regionScaleX || 1;
    const sy = this.regionScaleY || 1;
    if (sx === 1 && sy === 1) return 'none';
    return `scale(${sx}, ${sy})`;
  },

  // Обратная растяжка: перевод координат клика/курсора (проценты ОТ КАРТИНКИ)
  // обратно в «сырые» проценты хранилища, чтобы новые точки, поставленные
  // при включённой растяжке regionScaleX/Y, ложились ровно под курсор.
  unscaleRegionPercent(px, py) {
    const sx = this.regionScaleX || 1;
    const sy = this.regionScaleY || 1;
    if (sx === 1 && sy === 1) return { x: px, y: py };
    return {
      x: 50 + (px - 50) / sx,
      y: 50 + (py - 50) / sy
    };
  },

  updateMarkerPositions() {
    // Если открыт свиток или панель справочника, не тратим ресурсы на пересчет карты
    const scroll = document.getElementById('species-scroll');
    if (scroll && !scroll.classList.contains('hidden')) return;

    const img = document.getElementById('map');
    if (!img || !img.naturalWidth) return;

    // Маркеры и SVG-слой областей теперь лежат ВНУТРИ #map-wrapper:
    // их координаты задаются относительно самой картинки карты и
    // наследуют pan/зум через transform wrapper'а. Поэтому при
    // панорамировании здесь ничего пересчитывать не нужно — метод
    // вызывается только когда меняются РЕАЛЬНЫЕ размеры карты
    // (resize окна, загрузка новой подложки, открытие панели).

    // Незамасштабированные размеры CONTENT-области картинки
    // (clientWidth/clientHeight — без рамок) и автоматическая
    // компенсация зазора между уголком слоя и уголком картинки.
    const mapW = img.clientWidth;
    const mapH = img.clientHeight;
    const regOff = this.getRegionLayerOffset();

    // --- СЛОЙ ОБЛАСТЕЙ (SVG) ---
    // Растягиваем svg ровно поверх картинки внутри wrapper'а;
    // viewBox уже равен naturalWidth/naturalHeight (см. renderRegions).
    const svg = document.getElementById('regions-layer');
    if (svg) {
      svg.style.left = regOff.x + 'px';
      svg.style.top = regOff.y + 'px';
      svg.style.width = mapW + 'px';
      svg.style.height = mapH + 'px';
      // Ручная растяжка контуров вокруг центра слоя (regionScaleX/Y)
      svg.style.transformOrigin = '50% 50%';
      svg.style.transform = this.getRegionSvgTransform();
    }

    // --- МАРКЕРЫ ---
    const elMap = new Map();
    this.markersLayer.querySelectorAll('.marker').forEach(el => {
      const id = el.dataset.id;
      if (id) elMap.set(Number(id), el);
    });

    const mkOff = this.getMapLayerOffset();
    this.markers.forEach(m => {
      const el = elMap.get(m.id);
      if (!el) return;
      // Позиции — в процентах от размеров карты + компенсация зазора
      // + ручная растяжка вокруг центра (markerScaleX/Y);
      // масштаб и сдвиг применяет браузер через transform wrapper'а.
      const pos = this.applyLayerScale(
        m.x / 100 * mapW + mkOff.x,
        m.y / 100 * mapH + mkOff.y,
        mapW, mapH,
        this.markerScaleX || 1, this.markerScaleY || 1
      );
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
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
          <div class="region-marker-item" data-marker-ids="${esc(idsAttr)}" style="cursor:pointer; padding:3px 8px 3px 24px; display:flex; align-items:center; gap:6px; border-bottom: 1px dotted rgba(0,0,0,0.05);">
            <span class="nearby-name" style="flex:1;">${esc(g.name)}${countLabel}</span>
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

    LocalStore.saveMigrations(this.migrations);

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

    LocalStore.saveRegions(this.regions);

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
  loadFromFile(path) {
    if (window.MARKERS_DATA) {
      this.processLoadedData(window.MARKERS_DATA);
      return;
    }

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

    // --- ПРИ ЗАГРУЗКЕ ДАННЫХ НИЧЕГО НЕ ВЫДЕЛЯЕМ ---
    // Маркеры/области/линии остаются скрытыми, пока пользователь
    // явно не выберет вид/фильтр. Режим «только выделенные» включён.
    this.mapOnlyHighlighted = true;
    this.isAllHighlighted = false;

    // Сохраняем в localStorage
    LocalStore.save(this.markers);
    LocalStore.saveRegions(this.regions);
    LocalStore.saveMigrations(this.migrations);

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
  async checkPassword() {
    const password = document.getElementById('password-input').value;
    // Сравниваем SHA-256 хэш введённого пароля с хэшем из config.js,
    // чтобы сам пароль не хранился в исходниках в открытом виде.
    let ok = false;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
      const hex = Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      ok = hex === CONFIG.ui.developerPasswordHash;
    } catch (e) {
      console.error('Password hash failed:', e);
      document.getElementById('password-error').textContent =
        'Браузер не поддерживает WebCrypto (нужен HTTPS или localhost)';
      return;
    }
    if (ok) {
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
    if (devTools) {
      devTools.classList.toggle('hidden', !isDeveloper);
      // В режиме «Игры» панели карты скрыты — не показываем их и при смене режима
      if (typeof Achievements !== 'undefined' && Achievements.gamesModeActive) {
        devTools.classList.add('hidden');
      }
    }

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

    // Меню игр управляется режимом «Игры» (Achievements), а не гость/разработчик.
    // В игровом режиме devTools остаётся скрытым (см. выше).
    if (!(typeof Achievements !== 'undefined' && Achievements.gamesModeActive)) {
      const gamesMenu = document.getElementById('games-menu');
      if (gamesMenu) gamesMenu.classList.add('hidden');
    }

    // Обновляем подсказку через общий метод
    this.updateHintForSerial();

    this.tooltip.style.display = 'none';

    // Сбрасываем мигание при смене режима
    this.flashingIds.clear();
    if (this._flashTimer) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }
  }

});
})();
