const Journal = {
    records: [],
    currentPoint: null, // Теперь это не одна точка, а массив
    tempPhotos: [],
    isPinMode: false,
    currentPhotoIndex: 0,
    currentPhotoList: [],

    pendingPins: [], // Временные точки для НОВОЙ записи

    // Мобильно-планшетная компоновка дневника (≤1024px): список записей
    // идёт первым, карта спрятана и открывается отдельным окном.
    isCompactLayout() {
        return window.matchMedia('(max-width: 1024px)').matches;
    },

    // id последней записи, для которой открывали карту — её метки
    // подсвечиваются в окне карты немного другим цветом.
    highlightedRecordId: null,

    init() {
        // Безопасная привязка кнопок
        const bind = (id, event, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, fn);
            else console.warn(`Элемент #${id} не найден в HTML!`);
        };

        bind('btn-journal', 'click', () => {
            const modal = document.getElementById('journal-modal');
            if (modal && !modal.classList.contains('hidden')) this.close();
            else this.open();
        });
        bind('journal-close', 'click', () => this.close());

        // Мобильно-планшетная панель над карточками: «🗺 Открыть карту»
        const openMapBtn = document.getElementById('journal-open-map-btn');
        if (openMapBtn) {
            openMapBtn.addEventListener('click', () => {
                this.highlightedRecordId = null; // без привязки к карточке
                this.openMapOverlay();
            });
        }

        // Мобильно-планшетный дубль кнопки «Поставить метку» (вверху
        // дневника, перед карточками). Ведёт себя как оригинальная кнопка.
        const pinBtnMob = document.getElementById('journal-add-pin-btn-mob');
        if (pinBtnMob) {
            pinBtnMob.addEventListener('click', () => {
                const orig = document.getElementById('journal-add-pin-btn');
                if (orig) orig.click(); // одна логика — через исходную кнопку
            });
        }

        // Мобильно-планшетный дубль кнопки «Описать вид» в панели над
        // карточками. В окне карты originals скрыты (CSS), поэтому
        // finish вызывается напрямую.
        const finishBtnMob = document.getElementById('journal-finish-pins-btn-mob');
        if (finishBtnMob) {
            finishBtnMob.addEventListener('click', () => {
                if (this.pendingPins.length === 0) return;
                this.currentDescribingIndex = 0;
                this.openForm();
            });
        }

        // Мобильно-планшетное окно карты: кнопка закрытия и клик по фону
        bind('journal-map-overlay-close', 'click', () => this.closeMapOverlay());
        const mapOverlay = document.getElementById('journal-map-overlay');
        if (mapOverlay) {
            mapOverlay.addEventListener('click', (e) => {
                if (e.target === mapOverlay) this.closeMapOverlay();
            });
        }
        bind('journal-save-btn', 'click', () => this.exportData());
        bind('journal-load-btn', 'click', () => {
            const input = document.getElementById('journal-load-input');
            if (input) input.click();
        });

        bind('journal-form-cancel', 'click', () => this.closeForm());
        bind('journal-form-save', 'click', () => this.saveRecord());
        bind('journal-photo-input', 'change', (e) => this.handlePhotos(e));

        // Логика кнопки "Поставить метку"
        const pinBtn = document.getElementById('journal-add-pin-btn');
        const finishBtn = document.getElementById('journal-finish-pins-btn');
        const mapContainer = document.getElementById('journal-map-container');

        if (pinBtn && finishBtn && mapContainer) {
            // Включение режима меток
            pinBtn.addEventListener('click', () => {
                this.isPinMode = !this.isPinMode;
                pinBtn.classList.toggle('active', this.isPinMode);
                mapContainer.classList.toggle('pin-mode', this.isPinMode);
                pinBtn.textContent = this.isPinMode ? '❌ Отменить' : '📍 Поставить метку';
                this.syncPinButtons(this.isPinMode);

                // Мобильно-планшетная версия: карта спрятана — включение
                // режима меток должно показать окно карты.
                if (this.isPinMode && this.isCompactLayout()) {
                    this.openMapOverlay();
                }

                // Панель над карточками: показываем «Описать вид», когда
                // есть хотя бы одна временная метка (и прячем в остальных
                // случаях — дубли в окне карты не видны, панель и так
                // скрыта CSS в режиме карты, но синхронизируем всегда).
                this.updateFinishButtons();

                this.renderMarkers(); // <-- Просто перерисовываем, функция сама скроет/покажет

                if (!this.isPinMode) {
                    // Если отменили - очищаем точки
                    this.pendingPins = [];
                    this.renderMarkers();
                    finishBtn.classList.add('hidden');
                }
            });

            // Клик по карте добавляет точку
            mapContainer.addEventListener('click', (e) => {
                if (!this.isPinMode) return;

                const rect = e.target.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;

                if (x < 0 || x > 100 || y < 0 || y > 100) return;

                // Добавляем ВРЕМЕННУЮ точку
                this.pendingPins.push({ x, y });
                this.renderMarkers(); // <-- ВЫЗЫВАЕМ НОВУЮ ФУНКЦИЮ

                // Показываем кнопку "Описать вид", если есть хоть одна точка
                finishBtn.classList.remove('hidden');
                this.updateFinishButtons();
            });

            // Кнопка "Описать вид" (завершение)
            finishBtn.addEventListener('click', () => {
                if (this.pendingPins.length === 0) return;
                this.openForm(); // Открываем форму для ВСЕХ точек
            });
        }

        // Загрузка файла
        const loadInput = document.getElementById('journal-load-input');
        if (loadInput) {
            loadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        // Ограничиваем размер файла, чтобы огромный файл не «положил» вкладку
                        if (file.size > 20 * 1024 * 1024) {
                            throw new Error('файл слишком большой (максимум 20 МБ)');
                        }
                        const data = JSON.parse(ev.target.result);
                        if (data && Array.isArray(data.journal)) {
                            const clean = this.sanitizeRecords(data.journal);
                            if (clean.length === 0) {
                                throw new Error('в файле нет корректных записей');
                            }
                            this.records = clean;
                            localStorage.setItem('red_book_journal', JSON.stringify(this.records));
                            this.renderMarkers();
                            this.renderList();
                            alert(`Дневник успешно загружен! Записей: ${clean.length}`);
                        } else {
                            alert('Неверный формат файла дневника.');
                        }
                    } catch (err) {
                        alert('Ошибка чтения файла: ' + err.message);
                    }
                    loadInput.value = '';
                };
                reader.readAsText(file);
            });
        }
    },

    // Подсветка кнопки «Дневник» в меню как активной, пока дневник открыт.
    // В мобильно-планшетной версии при этом скрываются ⟳ (обновление карты)
    // и ☰ (вызов бокового меню) — для этого на <html> вешается класс
    // journal-open (CSS ≤1024px). На десктопе класс безвреден.
    setMenuActive(isActive) {
        const btn = document.getElementById('btn-journal');
        if (btn) btn.classList.toggle('active', !!isActive);
        document.documentElement.classList.toggle('journal-open', !!isActive);
    },

    // Синхронизация текстов/состояния мобильной кнопки-дубля
    syncPinButtons(active) {
        const mob = document.getElementById('journal-add-pin-btn-mob');
        if (mob) {
            mob.textContent = active ? '❌ Отменить' : '📍 Поставить метку';
            mob.classList.toggle('active', !!active);
        }
    },

    // Видимость кнопки «Описать вид» в мобильно-планшетной панели над
    // карточками — появляется, когда есть хотя бы одна временная метка.
    updateFinishButtons() {
        const mobFinish = document.getElementById('journal-finish-pins-btn-mob');
        if (!mobFinish) return;
        mobFinish.classList.toggle('hidden', this.pendingPins.length === 0);
    },

    // ============================================================
    // Мобильно-планшетное окно карты (≤1024px). Карта вынесена из
    // потока страницы в отдельный полноэкранный оверлей с кнопкой
    // закрытия. На десктопе не используется (там карта видна всегда).
    // ============================================================
    ensureMapOverlay() {
        const wrap = document.querySelector('.journal-map-wrap');
        if (!wrap) return null;
        let overlay = document.getElementById('journal-map-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'journal-map-overlay';
            overlay.className = 'hidden';
            overlay.innerHTML = `
                <div class="jmo-inner">
                    <button id="journal-map-overlay-close" type="button" aria-label="Закрыть карту и вернуться в дневник">⟵</button>
                    <div class="jmo-body"></div>
                </div>`;
            document.body.appendChild(overlay);
        }
        // Перекладываем блок карты (сохраняя все обработчики) внутрь оверлея
        const body = overlay.querySelector('.jmo-body');
        if (body && wrap.parentElement !== body) body.appendChild(wrap);
        return overlay;
    },

    openMapOverlay(recordId) {
        if (!this.isCompactLayout()) return; // на десктопе карта и так видна
        const overlay = this.ensureMapOverlay();
        if (!overlay) return;
        // Метки этой записи будут отличаться цветом в окне карты
        this.highlightedRecordId = (recordId !== undefined) ? recordId : null;
        overlay.classList.remove('hidden');
        document.documentElement.classList.add('journal-map-open');
        this.renderMarkers();
    },

    closeMapOverlay() {
        const overlay = document.getElementById('journal-map-overlay');
        if (overlay) overlay.classList.add('hidden');
        document.documentElement.classList.remove('journal-map-open');
    },

    // Возврат блока карты на своё место в модалке (для десктопы)
    restoreMapWrap() {
        const overlay = document.getElementById('journal-map-overlay');
        const wrap = document.querySelector('.journal-map-wrap');
        const content = document.querySelector('.journal-content');
        if (overlay && wrap && content && wrap.closest('#journal-map-overlay')) {
            content.insertBefore(wrap, content.firstChild);
        }
    },

    open() {
        const modal = document.getElementById('journal-modal');
        if (!modal) return;

        modal.classList.remove('hidden');
        this.setMenuActive(true);
        this.closeMapOverlay();

        this.isPinMode = false;
        this.pendingPins = []; // Очищаем временные точки при открытии

        const pinBtn = document.getElementById('journal-add-pin-btn');
        const finishBtn = document.getElementById('journal-finish-pins-btn');
        const mapContainer = document.getElementById('journal-map-container');

        if (pinBtn) {
            pinBtn.classList.remove('active');
            pinBtn.textContent = '📍 Поставить метку';
        }
        this.syncPinButtons(false);
        if (finishBtn) {
            finishBtn.classList.add('hidden');
        }
        this.updateFinishButtons();
        if (mapContainer) {
            mapContainer.classList.remove('pin-mode');
        }

        try {
            const saved = localStorage.getItem('red_book_journal');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.records = Array.isArray(parsed) ? this.sanitizeRecords(parsed) : [];
            }
        } catch (e) {
            console.warn('Ошибка загрузки дневника:', e);
        }

        this.renderMarkers();
        this.renderList();
    },

    close() {
        const modal = document.getElementById('journal-modal');
        if (modal) modal.classList.add('hidden');
        this.setMenuActive(false); // снимает и подсветку, и html.journal-open
        this.closeMapOverlay();
        // Возвращаем карту в поток — на десктопе она должна быть видна
        this.restoreMapWrap();
    },

    openForm() {
        document.getElementById('journal-species-name').value = '';
        document.getElementById('journal-comment').value = '';
        document.getElementById('journal-photo-input').value = '';
        document.getElementById('journal-photo-preview').innerHTML = '';
        this.tempPhotos = [];

        // Меняем заголовок, если меток несколько
        const title = document.querySelector('#journal-form-modal h3');
        if (this.pendingPins.length > 1) {
            title.textContent = `Наблюдение ${this.currentDescribingIndex + 1} из ${this.pendingPins.length}`;
        } else {
            title.textContent = 'Новое наблюдение';
        }

        document.getElementById('journal-form-modal').classList.remove('hidden');
    },

    closeForm() {
        document.getElementById('journal-form-modal').classList.add('hidden');
        this.currentPoint = null;
        this.tempPhotos = [];
    },

    handlePhotos(e) {
        const files = Array.from(e.target.files);
        const preview = document.getElementById('journal-photo-preview');

        if (files.length === 0) return;

        // Очищаем превью и массив ТОЛЬКО если это первый выбор
        if (this.tempPhotos.length === 0) {
            preview.innerHTML = '';
        }

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 800;

                    if (width > height && width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    } else if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

                    const previewImg = document.createElement('img');
                    previewImg.src = compressedDataUrl;
                    preview.appendChild(previewImg);
                    this.tempPhotos.push(compressedDataUrl);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Очищаем value инпута, чтобы можно было выбрать те же файлы снова, если нужно
        e.target.value = '';
    },

    saveRecord() {
        const name = document.getElementById('journal-species-name').value.trim();
        const comment = document.getElementById('journal-comment').value.trim();

        if (!name) {
            alert('Введите название вида (или ваше предположение).');
            return;
        }

        // Создаем ОДНУ запись, но с массивом всех поставленных точек
        const record = {
            id: Date.now(),
            pins: this.pendingPins, // <-- Сохраняем массив точек
            name: name,
            comment: comment,
            photos: this.tempPhotos
        };

        this.records.push(record);
        this.saveToLocalStorage();

        // Очищаем всё
        this.pendingPins = [];
        document.getElementById('journal-finish-pins-btn').classList.add('hidden');
        this.updateFinishButtons();
        this.closeForm();

        // Возвращаем кнопку "Поставить метку" в исходное состояние
        this.isPinMode = false;
        const pinBtn = document.getElementById('journal-add-pin-btn');
        pinBtn.classList.remove('active');
        pinBtn.textContent = '📍 Поставить метку';
        this.syncPinButtons(false);
        document.getElementById('journal-map-container').classList.remove('pin-mode');
        // Мобильно-планшетная версия: после сохранения закрываем окно карты —
        // игрок возвращается к списку записей (новая запись уже вверху).
        if (this.isCompactLayout()) {
            this.closeMapOverlay();
        }

        this.renderMarkers();
        this.renderList();
    },

    skipRecord() {
        // Просто переходим к следующей метке, не сохраняя
        this.nextPin();
    },

    nextPin() {
        this.currentDescribingIndex++;

        if (this.currentDescribingIndex < this.pendingPins.length) {
            // Есть еще метки - открываем форму для следующей
            this.tempPhotos = [];
            document.getElementById('journal-species-name').value = '';
            document.getElementById('journal-comment').value = '';
            document.getElementById('journal-photo-preview').innerHTML = '';

            // Обновляем заголовок
            const title = document.querySelector('#journal-form-modal h3');
            title.textContent = `Наблюдение ${this.currentDescribingIndex + 1} из ${this.pendingPins.length}`;
        } else {
            // Все метки обработаны
            this.pendingPins = []; // Очищаем временные
            document.getElementById('journal-describe-btn').classList.add('hidden');
            document.getElementById('journal-form-modal').classList.add('hidden');
            this.renderMarkers();
            this.renderList();
        }
    },

    saveToLocalStorage() {
        try {
            localStorage.setItem('red_book_journal', JSON.stringify(this.records));
            return true;
        } catch (e) {
            console.error('Journal save failed:', e);
            alert(e && e.name === 'QuotaExceededError'
                ? 'Хранилище переполнено! Удалите часть фото или записей и попробуйте снова.'
                : 'Ошибка сохранения журнала.');
            return false;
        }
    },

    // Отрисовка ВСЕХ маркеров (временных и сохранённых)
    renderMarkers() {
        const layer = document.getElementById('journal-markers-layer');
        if (!layer) return;
        layer.innerHTML = '';

        // 1. Сначала рисуем ВРЕМЕННЫЕ (красные, которые мы только что наставили)
        this.pendingPins.forEach((pin, index) => {
            const el = document.createElement('div');
            el.className = 'journal-marker';
            el.style.left = pin.x + '%';
            el.style.top = pin.y + '%';
            el.textContent = '?';
            el.style.background = 'var(--red-dark)'; // Красный цвет для новых
            el.style.pointerEvents = 'none'; // Временные нельзя кликать
            layer.appendChild(el);
        });

        // 2. Затем рисуем СОХРАНЕННЫЕ (только если не в режиме постановки)
        if (!this.isPinMode) {
            this.records.forEach((rec) => {
                // У одной записи теперь МАССИВ точек (rec.pins)
                if (rec.pins && Array.isArray(rec.pins)) {
                    rec.pins.forEach(pin => {
                        const el = document.createElement('div');
                        el.className = 'journal-marker saved';
                        // Метки записи, из которой открыли карту (моб. окно),
                        // немного отличаются цветом (золотой ореол)
                        if (this.highlightedRecordId !== null && rec.id === this.highlightedRecordId) {
                            el.classList.add('from-card');
                        }
                        el.style.left = pin.x + '%';
                        el.style.top = pin.y + '%';
                        el.textContent = '?';
                        el.title = rec.name;
                        el.dataset.recordId = rec.id; // Привязываем к записи

                        // При клике на маркер - подсвечиваем карточку
                        el.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const card = document.querySelector(`.journal-card[data-id="${rec.id}"]`);
                            if (card) {
                                // В мобильно-планшетной версии карта открыта
                                // окном поверх дневника — сначала закрываем
                                // окно, затем подсвечиваем нужную карточку.
                                this.closeMapOverlay();
                                card.classList.add('expanded');
                                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                card.style.boxShadow = '0 0 15px var(--gold)';
                                setTimeout(() => card.style.boxShadow = '', 1000);
                            }
                        });
                        layer.appendChild(el);
                    });
                }
            });
        }
    },

    // ============================================================
    // Валидация записей дневника (в т.ч. загруженных из файла).
    // Без неё импортированный JSON может содержать произвольные
    // данные (HTML/JS в полях, объекты вместо чисел), которые
    // затем попадают в DOM и localStorage.
    // ============================================================
    sanitizeRecords(list) {
        const isPct = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
        return list
            .filter((r) => r && typeof r === 'object')
            .map((r) => ({
                id: Number.isFinite(r.id) ? r.id : Date.now() + Math.floor(Math.random() * 1e6),
                name: String(r.name ?? '').slice(0, 200),
                comment: String(r.comment ?? '').slice(0, 5000),
                pins: Array.isArray(r.pins)
                    ? r.pins.filter((p) => p && isPct(p.x) && isPct(p.y)).slice(0, 500)
                    : [],
                photos: Array.isArray(r.photos)
                    ? r.photos.filter((p) => typeof p === 'string' && /^data:image\//i.test(p)).slice(0, 50)
                    : [],
            }))
            .filter((r) => r.pins.length > 0 || r.name);
    },

    renderList() {
        const list = document.getElementById('journal-list');
        if (!list) return;
        list.innerHTML = '';

        if (this.records.length === 0) {
            list.innerHTML = '<div class="journal-empty">Пока нет записей. Поставьте метку на карте.</div>';
            return;
        }

        this.records.forEach(rec => {
            const card = document.createElement('div');
            card.className = 'journal-card';
            card.dataset.id = rec.id;

            let photosHtml = '';
            if (rec.photos && rec.photos.length > 0) {
                // Разрешаем только data:image URL — это исключает javascript:,
                // data:text/html и прочие опасные схемы из импортируемых файлов
                const safePhotos = rec.photos.filter(p => typeof p === 'string' && /^data:image\//i.test(p));
                if (safePhotos.length > 0) {
                    photosHtml = `<div class="j-carousel">` +
                        safePhotos.map((p, index) => `<img src="${p}" class="journal-thumb" data-index="${index}" loading="lazy">`).join('') +
                        `</div>`;
                }
            }

            // Экранируем пользовательские данные (защита от XSS, в т.ч. через импорт),
            // затем возвращаем переносы строк уже в безопасном виде
            const safeName = ((window.escapeHtml ? window.escapeHtml(rec.name) : rec.name) || '') || 'Без названия';
            const rawComment = rec.comment || 'Без комментария';
            const safeComment = (window.escapeHtml ? window.escapeHtml(rawComment) : rawComment).replace(/\n/g, '<br>');

            card.innerHTML = `
                <div class="j-card-actions">
                    <button class="journal-open-map-btn" type="button" title="Открыть карту с метками этой записи">🗺</button>
                    <button class="j-delete" title="Удалить">✕</button>
                </div>
                <h4>${safeName}</h4>
                <div class="j-comment">${safeComment}</div>
                ${photosHtml}
            `;

            // Кнопка «🗺 Открыть карту» рядом с крестиком удаления — в каждой
            // карточке. В мобильно-планшетной версии открывает окно карты и
            // подсвечивает метки этой записи (десктоп: карта и так видна,
            // кнопка скрыта CSS).
            const mapBtn = card.querySelector('.journal-open-map-btn');
            if (mapBtn) {
                mapBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openMapOverlay(rec.id); // метки этой записи — другим цветом
                });
            }

            card.querySelector('.j-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Удалить эту запись из дневника?')) {
                    this.records = this.records.filter(r => r.id !== rec.id);
                    localStorage.setItem('red_book_journal', JSON.stringify(this.records));
                    this.renderMarkers();
                    this.renderList();
                }
            });

            // Вешаем обработчики на миниатюры
            card.querySelectorAll('.journal-thumb').forEach(thumb => {
                thumb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openPhoto(rec.id, Number(thumb.dataset.index));
                });
            });

            // При клике на карточку - РАЗВОРАЧИВАЕМ запись (и мигают её
            // маркеры, если карта открыта). Карту открывает отдельная
            // кнопка «🗺» рядом с крестиком удаления.
            card.addEventListener('click', (e) => {
                // Игнорируем клик по кнопкам в шапке карточки или фото
                if (e.target.closest('.j-card-actions') || e.target.closest('.journal-thumb')) return;

                // 1. Разворачиваем/сворачиваем текст
                card.classList.toggle('expanded');

                // 2. Подсвечиваем маркеры (только если они есть на карте)
                const markers = document.querySelectorAll(`.journal-marker[data-record-id="${rec.id}"]`);
                if (markers.length > 0) {
                    markers.forEach(m => {
                        m.style.transform = 'translate(-50%, -50%) scale(1.5)';
                        m.style.boxShadow = '0 0 15px var(--gold)';
                        setTimeout(() => {
                            m.style.transform = 'translate(-50%, -50%) scale(1)';
                            m.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
                        }, 1000);
                    });
                }
            });

            list.appendChild(card);
        });
    },

    openPhoto(recordId, photoIndex) {
        const rec = this.records.find(r => r.id === recordId);
        if (!rec || !rec.photos) return;

        this.currentPhotoList = rec.photos;
        this.currentPhotoIndex = photoIndex;

        this.updateGalleryView();

        const modal = document.getElementById('photo-gallery-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        const closeBtn = document.getElementById('gallery-close');
        const prevBtn = document.getElementById('gallery-prev');
        const nextBtn = document.getElementById('gallery-next');

        if (closeBtn && prevBtn && nextBtn) {
            const newClose = closeBtn.cloneNode(true);
            const newPrev = prevBtn.cloneNode(true);
            const newNext = nextBtn.cloneNode(true);

            closeBtn.parentNode.replaceChild(newClose, closeBtn);
            prevBtn.parentNode.replaceChild(newPrev, prevBtn);
            nextBtn.parentNode.replaceChild(newNext, nextBtn);

            newClose.addEventListener('click', () => modal.classList.add('hidden'));
            newPrev.addEventListener('click', () => this.changePhoto(-1));
            newNext.addEventListener('click', () => this.changePhoto(1));
        }

        modal.onclick = (e) => {
            if (e.target.id === 'photo-gallery-modal') {
                modal.classList.add('hidden');
            }
        };
    },

    changePhoto(direction) {
        this.currentPhotoIndex += direction;
        if (this.currentPhotoIndex < 0) {
            this.currentPhotoIndex = this.currentPhotoList.length - 1;
        } else if (this.currentPhotoIndex >= this.currentPhotoList.length) {
            this.currentPhotoIndex = 0;
        }
        this.updateGalleryView();
    },

    updateGalleryView() {
        const img = document.getElementById('gallery-current-img');
        if (!img) return;

        const currentPhoto = this.currentPhotoList[this.currentPhotoIndex] || '';
        // Защита от опасных схем (javascript: и т.п.) в данных журнала/импорта
        if (/^data:image\//i.test(currentPhoto)) {
            img.src = currentPhoto;
        } else {
            img.removeAttribute('src');
        }
        document.getElementById('gallery-current-num').textContent = this.currentPhotoIndex + 1;
        document.getElementById('gallery-total-num').textContent = this.currentPhotoList.length;

        const navBtns = document.querySelectorAll('.gallery-nav-btn');
        if (navBtns.length > 0) {
            if (this.currentPhotoList.length <= 1) {
                navBtns.forEach(btn => btn.style.display = 'none');
            } else {
                navBtns.forEach(btn => btn.style.display = 'flex');
            }
        }
    },

    exportData() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            journal: this.records
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'field-journal-omsk.json';
        a.click();
        URL.revokeObjectURL(url);
    }
};

document.addEventListener('DOMContentLoaded', () => Journal.init());