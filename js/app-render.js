// ============================================================
// ОТРИСОВКА КАРТЫ: подсказка режима, клик по карте, маркеры, модалка маркера
// ============================================================

(function () {
'use strict';
const App = window.App;
const esc = window.esc || window.escapeHtml;
const xyToGeo = window.xyToGeo;

Object.assign(App, {
  // ============================================================
  // Режим разработчика / гостя: серийный режим
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
  updateSerialChangeSpeciesButton() {
    const btn = document.getElementById('btn-serial-change-species');
    if (!btn) return;

    // Вид теперь один на всю сессию — lastUsed
    const hasSpecies = !!this.lastUsed;

    btn.textContent = hasSpecies
      ? 'Сменить вид для серии'
      : 'Задать вид для серии';
  },
  onMapClick(e) {
    // После свайпа по карте браузер может «доиграть» click — игнорируем его
    if (this._suppressClickUntil && Date.now() < this._suppressClickUntil) return;

    if (!this.developerMode) return;
    if (e.target.classList.contains('marker')) return;

    // Координаты видов (x/y в процентах) привязаны к КАРТИНКЕ, а не к wrapper'у.
    // getBoundingClientRect() даёт реальное положение content-области картинки
    // на экране (с учётом pan/зума wrapper'а и любых рамок), поэтому клик
    // всегда попадает ровно туда, куда смотрит пользователь.
    const rect = this.map.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    // Если включён режим рисования области — добавляем точку.
    // Точки областей хранятся в «сырых» процентах и растягиваются при
    // отрисовке (regionScaleX/Y), поэтому кликовые координаты нужно
    // прогнать через ОБРАТНУЮ растяжку — иначе новый контур уедет от курсора.
    if (this.regionMode) {
      const rp = this.unscaleRegionPercent(x, y);
      this.addRegionPoint(rp.x, rp.y);
      return;
    }

    // Если включён режим рисования миграции — добавляем точку
    // (линии миграций рисуются в том же SVG-слое — тоже обратная растяжка)
    if (this.migrationMode) {
      const mp = this.unscaleRegionPercent(x, y);
      this.addMigrationPoint(mp.x, mp.y);
      return;
    }

    // Если клик не в маркер и не в режиме разработчика — проверяем, нет ли тут областей
    if (!this.developerMode) {
      const rp = this.unscaleRegionPercent(x, y);
      const regionsHere = this.findRegionsAtPoint(rp.x, rp.y);
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

      LocalStore.save(this.markers);
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

    LocalStore.save(this.markers);
    this.render();
    this.closeModal();

    if (this.serialMode) {
      this.setSerialMode(true);
    }
  },
  render() {
    this.markersLayer.innerHTML = '';
    // Берем активные категории из нашего внутреннего фильтра
    const activeCats = [...this.listFilter];

    // Кэшируем геометрию карты один раз на весь рендер.
    // Маркеры лежат внутри #map-wrapper — координаты относительные
    // картинки + автоматическая компенсация зазора (getMapLayerOffset).
    const img = document.getElementById('map');
    const renderWidth = img ? img.clientWidth : 0;
    const renderHeight = img ? img.clientHeight : 0;
    const mkOff = this.getMapLayerOffset();

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
      const px = (m.x / 100) * renderWidth + mkOff.x;
      const py = (m.y / 100) * renderHeight + mkOff.y;
      // Ручная растяжка маркеров вокруг центра карты (markerScaleX/Y)
      const pos = this.applyLayerScale(px, py, renderWidth, renderHeight,
        this.markerScaleX || 1, this.markerScaleY || 1);

      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
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


});
})();
