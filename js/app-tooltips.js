// ============================================================
// ТУЛТИПЫ МАРКЕРОВ, СОСЕДНИХ МАРКЕРОВ, ОБЛАСТЕЙ И ЛИНИЙ МИГРАЦИЙ
// ============================================================

(function () {
'use strict';
const App = window.App;
const esc = window.esc || window.escapeHtml;
const xyToGeo = window.xyToGeo;

Object.assign(App, {
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
             return `<div class="region-link-item" data-species-id="${esc(sp.speciesId)}" 
                          style="cursor: pointer; padding: 2px 4px; border-radius: 2px; transition: background 0.15s;"
                          title="Кликните, чтобы подсветить этот вид на карте">
                       ${esc(sp.speciesName)}
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
        return `<div class="nearby-item" data-marker-id="${esc(m.id)}">
               <span class="nearby-icon">${cat && cat.icon ? cat.icon : '●'}</span>
               <span class="nearby-name">${esc(m.name)}${countLabel}</span>
               ${st ? `<span class="nearby-status" style="background:${esc(st.color)}" title="${esc(st.value)} — ${esc(st.label)}">${esc(st.value)}</span>` : ''}
             </div>`;
      }).join('')}
         </div>`
      : '';

    // Лупа справа от названия — открывает вид в справочнике
    const gotoIcon = marker.speciesId
      ? `<span class="tooltip-goto" data-species-id="${esc(marker.speciesId)}" title="Изучить вид в справочнике">🔍</span>`
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
            <b>${esc(marker.name)}</b>
            ${gotoIcon}
          </div>
          <span style="color: #999; font-size: 14px; user-select: none;">✥</span>
        </div>
        
        <span class="status" style="color:${statusConfig ? esc(statusConfig.color) : '#666'}">${esc(statusText)}</span>
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
        LocalStore.save(this.markers);
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
        LocalStore.saveRegions(this.regions);
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
    // Координаты видов (x/y в процентах) привязаны к КАРТИНКЕ, а не к wrapper'у.
    // getBoundingClientRect() даёт реальное положение content-области картинки
    // на экране (с учётом pan/зума wrapper'а и любых рамок), поэтому клик
    // всегда попадает ровно туда, куда смотрит пользователь.
    const rect = this.map.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    // Обратная растяжка SVG-слоя (regionScaleX/Y), чтобы поиск областей
    // соответствовал растянутому контуру под курсором
    const rp = this.unscaleRegionPercent(x, y);
    const regionsHere = this.findRegionsAtPoint(rp.x, rp.y);

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
        LocalStore.saveMigrations(this.migrations);
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
          return `<div class="tooltip-species-item" data-species-id="${esc(sp.speciesId)}" data-region-id="${esc(r.id)}" 
                       style="padding: 4px 2px; cursor: pointer; border-bottom: 1px dotted rgba(0,0,0,0.1); transition: background 0.15s; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 500; color: var(--ink); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 85%;">${esc(sp.speciesName)}</span>
                    <span style="font-size: 10px; color: var(--text-mid); flex-shrink: 0;">${intLabel}</span>
                  </div>`;
        }).join('');

        return `
          <div class="region-list-item" data-region-id="${esc(r.id)}"
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
        namesList.map(name => `<span style="font-size: 14px; font-weight: normal; line-height: 1.3; color: var(--ink);">${esc(name)}</span>`).join('') +
        `</div>`;
    }

    // Формируем кликабельный список видов для миграции
    let speciesListHtml = '';
    const migSpeciesArray = migration.speciesList || [{ speciesId: migration.speciesId, speciesName: migration.speciesName || migration.speciesId }];

    speciesListHtml = migSpeciesArray.map(sp => `
      <div class="species-link-item" data-species-id="${esc(sp.speciesId)}" style="cursor: pointer; font-size: 13px; color: var(--ink); padding: 3px 0; transition: color 0.15s; display: flex; justify-content: space-between; align-items: center;">
        <span>${esc(sp.speciesName)}</span>
        ${this.developerMode ? `<button class="mig-species-remove-btn" data-species-id="${esc(sp.speciesId)}" data-mig-id="${esc(migration.id)}" title="Удалить вид из миграции" style="background: none; border: none; color: var(--red-dark); cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1;">✕</button>` : ''}
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
            LocalStore.saveMigrations(this.migrations);
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

        LocalStore.saveMigrations(this.migrations);
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
    LocalStore.saveMigrations(this.migrations);
    this.renderRegions();
  },

  // Тултип для областей (показывает, какие виды тут отмечены),
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
      <div class="comment">${speciesList.map(esc).join('<br>')}</div>
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
        return `<div class="tooltip-species-item" data-species-id="${esc(sp.speciesId)}" data-region-id="${esc(r.id)}" 
                     style="padding: 4px 2px; cursor: pointer; border-bottom: 1px dotted rgba(0,0,0,0.1); transition: background 0.15s; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: 500; color: var(--ink); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">${esc(sp.speciesName)}</span>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 10px; color: var(--text-mid); flex-shrink: 0;">${intLabel}</span>
                    ${isDev ? `<button class="species-remove-btn" data-species-id="${esc(sp.speciesId)}" data-region-id="${esc(r.id)}" title="Удалить вид из области" style="background: none; border: none; color: var(--red-dark); cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1;">✕</button>` : ''}
                  </div>
                </div>`;
      }).join('');

      return `
        <div class="region-list-item${isCurrent ? ' current' : ''}"
             data-region-id="${esc(r.id)}"
             style="padding: 0 0 0 8px; margin-bottom: 4px; border: none; border-left: 3px solid var(--gold-deep);">
          <div class="region-list-info" style="width: 100%; display: flex; align-items: flex-start;">
             <div style="width: 100%;">
                ${speciesNames}
             </div>
             ${isDev ? `<button class="region-delete-btn" data-region-delete-id="${esc(r.id)}" title="Удалить область" style="border:none; background:none; cursor:pointer; padding:0; font-size: 10px; margin-left: 4px;">🗑</button>` : ''}
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
                    <span class="nearby-name" style="flex:1;">${esc(g.name)}${countLabel}</span>
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
          LocalStore.saveRegions(this.regions);
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
    LocalStore.saveRegions(this.regions);
    this.highlightedRegionId = null;
    this.renderRegions();
  }

});
})();
