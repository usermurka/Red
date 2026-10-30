// ============================================================
// Единый «мини-свиток» для всех игр (Викторина, Среда обитания, Статус)
// ------------------------------------------------------------
// Механика (важно!): после ответа игроку показывается узкий свиток в
// стиле Красной книги — пергамент, рваные края, золотая рамка — с
// информацией из книги и кнопкой «📖 Читать в свитке», которая
// открывает полный свиток вида (App.openSpeciesScroll).
// Панель живёт справа от игровой панели, как в викторине: слегка
// заходит под неё (margin-left:-30px), появляется со скольжением
// справа (slideInRight).
//
// Игры передают только данные (title/latin/status/blocks); разметка,
// стили и поведение общие — правки дизайна делаются в одном месте
// (.mini-scroll в css/mini-scroll.css).
// ============================================================
window.MiniScroll = {
    // Контейнер-обёртка (как #quiz-info-panel в викторине).
    // Вставляется ПЕРВЫМ дочерним элементом модалки — рядом с игровой
    // панелью-«скроллом» по flex-линии, а не внутрь неё.
    ensurePanel(id, modalId) {
        let panel = document.getElementById(id);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = id;
            panel.className = 'mini-scroll-panel hidden';
            const modal = document.getElementById(modalId) || document.body;
            // Вставляем ВНУТРЬ модалки, сразу перед игровой панелью-«скроллом»:
            // тогда свиток стоит рядом с ней на той же flex-линии и не
            // перекрывается тёмным фоном/блюром подложки модалки.
            const gamePanel = modal.querySelector('.latin-scroll, .quiz-scroll, .match-scroll');
            if (gamePanel) modal.insertBefore(panel, gamePanel);
            else modal.appendChild(panel);
        }
        return panel;
    },

    // Построение содержимого свитка.
    // data = { title, latin, status:{value,color,label}, blocks:[{title, html, text}] }
    build(data) {
        const wrap = document.createElement('div');
        wrap.className = 'mini-scroll';

        const h = document.createElement('h3');
        h.textContent = data.title || '';
        wrap.appendChild(h);

        const lat = document.createElement('div');
        lat.className = 'ms-latin';
        lat.textContent = data.latin || '';
        wrap.appendChild(lat);

        if (data.status) {
            const st = document.createElement('div');
            st.className = 'ms-status';
            const badge = document.createElement('span');
            badge.className = 'ms-status-badge';
            badge.textContent = data.status.value;
            badge.style.background = data.status.color || '#a33';
            const txt = document.createElement('span');
            txt.className = 'ms-status-text';
            txt.textContent = data.status.label || '';
            st.appendChild(badge);
            st.appendChild(txt);
            wrap.appendChild(st);
        }

        (data.blocks || []).forEach(b => {
            if (!b || !(b.html || b.text)) return;
            const block = document.createElement('div');
            block.className = 'ms-block';
            const t = document.createElement('div');
            t.className = 'ms-block-title';
            t.textContent = b.title;
            block.appendChild(t);
            const body = document.createElement('div');
            body.className = 'ms-block-body';
            if (b.html) body.innerHTML = b.html; else body.textContent = b.text;
            block.appendChild(body);
            wrap.appendChild(block);
        });

        return wrap;
    },

    // Кнопка «📖 Читать в свитке» — общий переход к полному свитку вида.
    footerButton(speciesId, closeFn) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-next-btn ms-open-full';
        btn.textContent = '📖 Читать в свитке';
        btn.addEventListener('click', () => {
            MiniScroll.openFullAndClose(speciesId, closeFn);
        });
        return btn;
    },

    // Показать мини-свиток внутри модального окна игры.
    // opts = { modalId, panelId, speciesId, data }
    // ВАЖНО: modalId передаётся всегда — панель вставляется ПЕРВЫМ
    // дочерним элементом модалки (рядом с игровой панелью по flex-линии).
    show(opts) {
        const modal = document.getElementById(opts.modalId);
        if (!modal) return;
        const panel = this.ensurePanel(opts.panelId, opts.modalId);
        panel.innerHTML = '';
        panel.appendChild(this.build(opts.data));
        panel.classList.remove('hidden');
        // Разрешаем клики по свитку, даже если модалка «закрыта» для app
        panel.style.pointerEvents = 'auto';
        if (opts.speciesId != null) this._speciesId = opts.speciesId;
    },

    hide(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('hidden');
    },

    // Общий переход «Читать в свитке» → полный свиток вида + закрытие игры.
    openFullAndClose(speciesId, closeFn) {
        try {
            if (window.App && App.openSpeciesScroll && speciesId != null) {
                App.openSpeciesScroll(speciesId);
            }
        } catch (e) { /* noop */ }
        if (typeof closeFn === 'function') closeFn();
    }
};
