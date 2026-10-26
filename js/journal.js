const Journal = {
    records: [],
    currentPoint: null, // Теперь это не одна точка, а массив
    tempPhotos: [],
    isPinMode: false,
    currentPhotoIndex: 0,
    currentPhotoList: [],

    pendingPins: [], // Временные точки для НОВОЙ записи

    init() {
        // Безопасная привязка кнопок
        const bind = (id, event, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, fn);
            else console.warn(`Элемент #${id} не найден в HTML!`);
        };

        bind('btn-journal', 'click', () => this.open());
        bind('journal-close', 'click', () => this.close());
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
                        const data = JSON.parse(ev.target.result);
                        if (data && Array.isArray(data.journal)) {
                            this.records = data.journal;
                            localStorage.setItem('red_book_journal', JSON.stringify(this.records));
                            this.renderMarkers();
                            this.renderList();
                            alert('Дневник успешно загружен!');
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

    open() {
        const modal = document.getElementById('journal-modal');
        if (!modal) return;

        modal.classList.remove('hidden');

        this.isPinMode = false;
        this.pendingPins = []; // Очищаем временные точки при открытии

        const pinBtn = document.getElementById('journal-add-pin-btn');
        const finishBtn = document.getElementById('journal-finish-pins-btn');
        const mapContainer = document.getElementById('journal-map-container');

        if (pinBtn) {
            pinBtn.classList.remove('active');
            pinBtn.textContent = '📍 Поставить метку';
        }
        if (finishBtn) {
            finishBtn.classList.add('hidden');
        }
        if (mapContainer) {
            mapContainer.classList.remove('pin-mode');
        }

        try {
            const saved = localStorage.getItem('red_book_journal');
            if (saved) {
                this.records = JSON.parse(saved);
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
        this.closeForm();

        // Возвращаем кнопку "Поставить метку" в исходное состояние
        this.isPinMode = false;
        const pinBtn = document.getElementById('journal-add-pin-btn');
        pinBtn.classList.remove('active');
        pinBtn.textContent = '📍 Поставить метку';
        document.getElementById('journal-map-container').classList.remove('pin-mode');

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
            this.renderPendingPins();
            this.renderList();
        }
    },

    saveToLocalStorage() {
        try {
            localStorage.setItem('red_book_journal', JSON.stringify(this.records));
        } catch (e) {
            alert('Ошибка сохранения! Возможно, фотографии слишком большие.');
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
                                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Подсвечиваем карточку
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
                photosHtml = `<div class="j-carousel">` +
                    rec.photos.map((p, index) => `<img src="${p}" class="journal-thumb" data-index="${index}">`).join('') +
                    `</div>`;
            }

            // Заменяем \n на <br>, чтобы переносы строк работали
            const formattedComment = (rec.comment || 'Без комментария').replace(/\n/g, '<br>');

            card.innerHTML = `
                <button class="j-delete" title="Удалить">✕</button>
                <h4>${rec.name}</h4>
                <div class="j-comment">${formattedComment}</div>
                ${photosHtml}
            `;

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

            // При клике на карточку - разворачиваем текст И мигают все её маркеры на карте
            card.addEventListener('click', (e) => {
                // Игнорируем клик по крестику или фото
                if (e.target.closest('.j-delete') || e.target.closest('.journal-thumb')) return;

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

        img.src = this.currentPhotoList[this.currentPhotoIndex];
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

document.addEventListener('DOMContentLoaded', () => setTimeout(() => Journal.init(), 300));