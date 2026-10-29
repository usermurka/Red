// ============================================================
// СОБЫТИЯ КАРТЫ: обработчики, зум, панорамирование, мобильный интерфейс, мигание
// ============================================================

(function () {
'use strict';
const App = window.App;
const esc = window.esc || window.escapeHtml;
const xyToGeo = window.xyToGeo;

Object.assign(App, {
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
      LocalStore.exportAll(this.markers, this.regions, this.migrations);
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
        LocalStore.importAll(file, (data) => {
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

          // --- Импортированные данные НЕ выделяются автоматически:
          // загруженные маркеры/области/линии остаются скрытыми, пока
          // пользователь не выберет вид/фильтр. (mapOnlyHighlighted при
          // необходимости включается кнопкой «Только выделенные».) ---

          LocalStore.save(this.markers);
          LocalStore.saveRegions(this.regions);
          LocalStore.saveMigrations(this.migrations);
          this.render();
        });
      }
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('Удалить все маркеры, области и линии миграций? Это действие необратимо.')) {
        this.markers = [];
        this.regions = [];
        this.migrations = [];
        // Снимаем ВСЕ выделения — вместе с данными, чтобы после обновления
        // страницы логика «выделено/не выделено» не ломалась.
        this.highlightedIds.clear();
        this.highlightedSpeciesRegions.clear();
        this.highlightedSpeciesMigrations.clear();
        this.highlightedRegionId = null;
        this.isAllHighlighted = false;
        this.mapOnlyHighlighted = true;
        LocalStore.save(this.markers);
        LocalStore.saveRegions(this.regions);
        LocalStore.saveMigrations(this.migrations);
        this.render();
        this.updateStats();
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

    // --- Тач: панорамирование и pinch-зум (мобильные устройства) ---
    this.container.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.container.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.container.addEventListener('touchend', (e) => this.onTouchEnd(e));
    this.container.addEventListener('touchcancel', (e) => this.onTouchEnd(e));

    // --- Мобильный интерфейс: панель-меню, зум-кнопки, затемнение ---
    this.bindMobileControls();

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
  onWheel(e) {
    // В режиме «Игры» витрина медалей перекрывает карту: колесо должно
    // скроллить витрину, а не зумить карту под ней.
    if (typeof Achievements !== 'undefined' && Achievements.gamesModeActive) return;

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
  // Панорамирование (перетаскивание карты) — мышь + тач
  // ============================================================

  // --- Тач: панорамирование одним пальцем, pinch-зум двумя ---
  onTouchStart(e) {
    // Не мешаем работе внутри тултипа / подменю / панели
    if (e.target.closest('#tooltip') || e.target.closest('.layer-submenu')) return;

    if (e.touches.length === 1) {
      const t = e.touches[0];

      // тап по маркеру или клик по SVG-области обрабатывается штатно
      if (t.target.classList && t.target.classList.contains('marker')) return;

      this.isPanning = true;
      this.pinchActive = false;
      this.panStartX = t.clientX;
      this.panStartY = t.clientY;
      this.panStartPanX = this.panX;
      this.panStartPanY = this.panY;
      this._touchMoved = false;
      this.container.classList.add('panning');
    } else if (e.touches.length === 2) {
      // Вторая рука — переключаемся в режим pinch
      this.isPanning = false;
      this.pinchActive = true;
      this.container.classList.remove('panning');
      this.pinchStartDist = this.getTouchDistance(e.touches);
      this.pinchStartZoom = this.zoom;
      const rect = this.container.getBoundingClientRect();
      this.pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      this.pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      e.preventDefault();
    }
  },

  getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  onTouchMove(e) {
    if (this.pinchActive && e.touches.length >= 2) {
      e.preventDefault();

      const dist = this.getTouchDistance(e.touches);
      if (!this.pinchStartDist || this.pinchStartDist === 0) return;

      let newZoom = this.pinchStartZoom * (dist / this.pinchStartDist);
      newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

      // точка под центром щипка остаётся на месте
      const oldZoom = this.zoom;
      if (newZoom !== oldZoom) {
        const mx = this.pinchCenterX;
        const my = this.pinchCenterY;
        this.panX = mx - (mx - this.panX) * (newZoom / oldZoom);
        this.panY = my - (my - this.panY) * (newZoom / oldZoom);
        this.zoom = newZoom;
        this.applyTransform();
      }
      this._touchMoved = true;
      return;
    }

    if (this.isPanning && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - this.panStartX;
      const dy = t.clientY - this.panStartY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this._touchMoved = true;

      // на мобильных при движении не даём браузеру скроллить страницу
      if (this._touchMoved) e.preventDefault();

      this.panX = this.panStartPanX + dx;
      this.panY = this.panStartPanY + dy;
      this.applyTransform();
    }
  },

  onTouchEnd(e) {
    if (e.touches.length === 0) {
      this.isPanning = false;
      this.pinchActive = false;
      this.container.classList.remove('panning');

      // если это был свайп, а не тап — гасим следующий за ним click,
      // чтобы не поставить случайный маркер/не показать лишний тултип
      if (this._touchMoved) {
        this._suppressClickUntil = Date.now() + 350;
      }
    } else if (e.touches.length === 1) {
      // pinch завершился, остался один палец — продолжаем панорамирование
      this.pinchActive = false;
      const t = e.touches[0];
      this.isPanning = true;
      this.panStartX = t.clientX;
      this.panStartY = t.clientY;
      this.panStartPanX = this.panX;
      this.panStartPanY = this.panY;
    }
  },

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

    // Сохраняем только последние координаты; применяем трансформ не чаще
    // одного раза на кадр анимации (mousemove приходит в разы чаще refresh rate)
    this._panLastEvent = e;
    if (this._panRafPending) return;
    this._panRafPending = true;
    requestAnimationFrame(() => {
      this._panRafPending = false;
      const ev = this._panLastEvent;
      if (!this.isPanning || !ev) return;

      const dx = ev.clientX - this.panStartX;
      const dy = ev.clientY - this.panStartY;

      this.panX = this.panStartPanX + dx;
      this.panY = this.panStartPanY + dy;

      this.applyTransform();
    });
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

    // Единственный transform на wrapper: карта, маркеры и слои областей
    // движутся и масштабируются синхронно (аппаратно), без пересчётов.
    wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;

    // Позиции слоёв заданы внутри wrapper'а и наследуют transform —
    // но всё же пересчитываем их через rAF (как в исходной версии):
    // это подстраховка на случай, если зазор картинки/слоя изменился
    // (например, браузер иначе округлил размеры при новом масштабе).
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      this.updateMarkerPositions();
    });
  },
  isMobileLayout() {
    return window.matchMedia('(max-width: 820px)').matches;
  },

  bindMobileControls() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const btnToggle = document.getElementById('btn-sidebar-toggle');
    const btnClose = document.getElementById('btn-sidebar-close');

    const openSidebar = () => {
      if (!sidebar) return;
      sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('visible');
      document.body.classList.add('sidebar-open');
    };

    const closeSidebar = () => {
      if (!sidebar) return;
      sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('visible');
      document.body.classList.remove('sidebar-open');
    };

    if (btnToggle) btnToggle.addEventListener('click', openSidebar);
    if (btnClose) btnClose.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    // Закрытие панели по клику на пункте меню (чтобы сразу видеть результат)
    if (sidebar) {
      sidebar.addEventListener('click', (e) => {
        if (!this.isMobileLayout()) return;
        const clickedButton = e.target.closest('#games-menu button, #btn-open-list, .map-option, #map-switcher button');
        // Кнопки смены режима не закрывают панель: в режиме «Игры» это единственный способ выйти
        if (clickedButton && clickedButton.closest('.mode-switch')) return;
        if (clickedButton) {
          // небольшая задержка, чтобы обработчик кнопки отработал
          setTimeout(closeSidebar, 150);
        }
      });
    }

    // Escape тоже закрывает панель
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    // При смене размера окна — если вернулись на десктоп, снимаем состояние «открыто»
    window.addEventListener('resize', () => {
      if (!this.isMobileLayout()) closeSidebar();
    });

    // --- Кнопки зума на карте ---
    const zoomIn = document.getElementById('btn-zoom-in');
    const zoomOut = document.getElementById('btn-zoom-out');
    const zoomReset = document.getElementById('btn-zoom-reset');

    const stepZoom = (factor) => {
      const rect = this.container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const oldZoom = this.zoom;
      let newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * factor));
      if (newZoom === oldZoom) return;

      this.panX = centerX - (centerX - this.panX) * (newZoom / oldZoom);
      this.panY = centerY - (centerY - this.panY) * (newZoom / oldZoom);
      this.zoom = newZoom;

      if (this.zoom <= this.minZoom) {
        this.zoom = this.minZoom;
        this.panX = 0;
        this.panY = 0;
      }
      this.applyTransform();
    };

    if (zoomIn) zoomIn.addEventListener('click', () => stepZoom(1.35));
    if (zoomOut) zoomOut.addEventListener('click', () => stepZoom(1 / 1.35));
    if (zoomReset) zoomReset.addEventListener('click', () => {
      this.zoom = this.minZoom;
      this.panX = 0;
      this.panY = 0;
      this.applyTransform();
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

});
})();
