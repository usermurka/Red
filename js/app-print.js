// ============================================================
// ПЕЧАТНАЯ КАРТОЧКА ВИДА «как страница из книги»
// ============================================================

(function () {
    'use strict';
    const App = window.App;
    const esc = window.esc || window.escapeHtml || (s => String(s == null ? '' : s));

    const LEVEL_PREFIXES = [
        'Тип', 'Класс', 'Отряд', 'Семейство', 'Отдел', 'Порядок',
        'Подкласс', 'Подотряд', 'Надотряд', 'Надсемейство', 'Царство', 'Род'
    ];

    function cleanLabel(raw) {
        if (!raw) return '';
        let s = String(raw).trim();
        for (const p of LEVEL_PREFIXES) {
            const re = new RegExp('^' + p + '\\s+', 'i');
            if (re.test(s)) { s = s.replace(re, ''); break; }
        }
        s = s.replace(/\s*[–—-]\s*[A-ZА-ЯЁ][a-zа-яёA-ZА-ЯЁ\s,.-]*$/, '');
        return s.trim();
    }

    Object.assign(App, {

        buildClassificationChain(speciesId) {
            if (!speciesId || !window.SPECIES) return [];
            const chain = [];
            const walk = (node, path) => {
                const label = node.label ? cleanLabel(node.label) : '';
                const here = label ? [...path, label] : path;
                if (node.species && node.species.some(s => s.id === speciesId)) {
                    chain.push(...here);
                    return true;
                }
                for (const key of ['classes', 'orders', 'families']) {
                    if (Array.isArray(node[key])) {
                        for (const child of node[key]) {
                            if (walk(child, here)) return true;
                        }
                    }
                }
                return false;
            };
            for (const group of Object.values(window.SPECIES)) {
                if (walk(group, [])) break;
            }
            return chain;
        },

        wrapPrintPage(html, data) {
            if (!data || !data.id) return html;
            const speciesId = data.id;
            const chain = this.buildClassificationChain(speciesId);
            const breadcrumbs = chain.map(esc).join('<span class="print-sep">›</span>');

            const now = new Date();
            const dateStr = now.toLocaleDateString('ru-RU');

            return `
      <div class="print-page" data-species-id="${esc(speciesId)}">
        <header class="print-header">
          <span class="print-header-left">КРАСНАЯ КНИГА ОМСКОЙ ОБЛАСТИ</span>
          <span class="print-header-right">2-е изд., 2015 г.</span>
        </header>
        
        ${breadcrumbs ? `<nav class="print-breadcrumbs">${breadcrumbs}</nav>` : ''}
        
        ${html}

        <footer class="print-footer">
          <div class="print-footer-row">
            <span>© Файт А. М., 2026, Омск. По данным Красной книги Омской области.</span>
            <span>Открыто: <span class="print-footer-date">${dateStr}</span> · speciesId: ${esc(speciesId)}</span>
          </div>
        </footer>
      </div>
    `;
        },

        injectPrintButton(root) {
            if (!root) return;
            const left = root.querySelector('.scroll-titlebar-left');
            if (!left || left.querySelector('.scroll-print-btn')) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'scroll-print-btn';
            btn.title = 'Печать карточки вида';
            btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 6 2 18 2 18 9"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
      </svg>
      <span>Печать</span>
    `;
            btn.addEventListener('click', (e) => { e.preventDefault(); this.printSpeciesScroll(); });
            left.appendChild(btn);
        },

        injectMinimap(root) {
            const rightCol = root.querySelector('.scroll-col-right');
            if (!rightCol || rightCol.querySelector('.print-minimap-wrap')) return;

            const page = root.querySelector('.print-page');
            const speciesId = page && page.dataset ? page.dataset.speciesId : '';
            if (!speciesId) return;

            if (typeof this.renderSpeciesMiniMap !== 'function') return;

            const mapHtml = this.renderSpeciesMiniMap(speciesId);
            if (!mapHtml) return;

            const wrap = document.createElement('div');
            wrap.className = 'print-minimap-wrap';
            wrap.innerHTML = mapHtml;

            // Вставляем после таксономии
            const taxonomy = rightCol.querySelector('.scroll-taxonomy');
            if (taxonomy) {
                taxonomy.insertAdjacentElement('afterend', wrap);
            } else {
                const figure = rightCol.querySelector('.scroll-figure');
                if (figure) {
                    figure.insertAdjacentElement('afterend', wrap);
                } else {
                    rightCol.appendChild(wrap);
                }
            }

            if (wrap.querySelector('.scroll-photo-map-empty')) {
                wrap.classList.add('is-empty-map');
            }
        },

        async printSpeciesScroll() {
            const scroll = document.getElementById('species-scroll');
            if (!scroll) return;

            // 1. Раскрываем все details
            const details = Array.from(scroll.querySelectorAll('details'));
            const wasOpen = details.map(d => d.open);
            details.forEach(d => { d.open = true; });

            // 2. Обновляем дату
            const dateEl = scroll.querySelector('.print-footer-date');
            if (dateEl) dateEl.textContent = new Date().toLocaleDateString('ru-RU');

            const columns = scroll.querySelector('.scroll-columns');
            const leftCol = columns ? columns.querySelector('.scroll-col-left') : null;
            const rightCol = columns ? columns.querySelector('.scroll-col-right') : null;

            // Запоминаем исходное положение узлов для восстановления
            const restore = [];
            const remember = (el) => {
                if (!el) return;
                restore.push({ el, parent: el.parentNode, next: el.nextSibling });
            };

            const createdWrappers = [];

            const wrapFloat = (el, cls, clearLeft = false) => {
                if (!el || !el.parentNode) return null;
                remember(el);
                const w = document.createElement('div');
                w.className = 'print-float ' + cls + (clearLeft ? ' print-float-clear' : '');
                el.parentNode.insertBefore(w, el);
                w.appendChild(el);
                createdWrappers.push(w);
                return w;
            };

            // Убираем буквицу на время печати (снимаем класс, вернём в finally)
            const dropcaps = Array.from(scroll.querySelectorAll('.scroll-dropcap'));
            dropcaps.forEach(el => el.classList.remove('scroll-dropcap'));

            try {
                if (columns && leftCol && rightCol) {
                    // Собираем float-блоки из правой колонки
                    const figure = rightCol.querySelector('.scroll-figure');
                    const taxonomy = rightCol.querySelector('.scroll-taxonomy');
                    const minimap = rightCol.querySelector('.print-minimap-wrap');

                    // Фото и таксономия — float слева, друг под другом
                    const figWrap = wrapFloat(figure, 'print-float-figure');
                    const taxWrap = wrapFloat(taxonomy, 'print-float-taxonomy', true);

                    // Карта — тоже float слева, сразу под таксономией.
                    // Без принудительного разрыва: если не влезет на первую
                    // страницу — сама перепрыгнет на следующую, а текст
                    // затечёт на оставшееся место.
                    const mapWrap = wrapFloat(minimap, 'print-float-map', true);

                    // Вставляем в левую колонку в порядке: фото, таксономия, карта.
                    // Вставка в начало в обратном порядке, чтобы сверху оказалось фото.
                    if (mapWrap) leftCol.insertBefore(mapWrap, leftCol.firstChild);
                    if (taxWrap) leftCol.insertBefore(taxWrap, leftCol.firstChild);
                    if (figWrap) leftCol.insertBefore(figWrap, leftCol.firstChild);

                    // Скрываем опустевшую правую колонку на печати
                    rightCol.classList.add('print-col-collapsed');
                }

                // Подвал — в конец print-page, чтобы не прятался
                const footer = scroll.querySelector('.print-footer');
                const printPage = scroll.querySelector('.print-page');
                if (footer && printPage && footer.parentNode !== printPage) {
                    remember(footer);
                    printPage.appendChild(footer);
                }

                // Карта без данных
                const minimapEl = scroll.querySelector('.print-minimap-wrap');
                if (minimapEl && minimapEl.querySelector('.scroll-photo-map-empty')) {
                    minimapEl.classList.add('is-empty-map');
                }

                // Печать
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                window.print();
            } finally {
                // Восстанавливаем узлы в обратном порядке
                for (let i = restore.length - 1; i >= 0; i--) {
                    const { el, parent, next } = restore[i];
                    if (!parent) continue;
                    if (next && next.parentNode === parent) {
                        parent.insertBefore(el, next);
                    } else {
                        parent.appendChild(el);
                    }
                }

                // Удаляем созданные обёртки
                createdWrappers.forEach(w => {
                    if (w.parentNode) w.parentNode.removeChild(w);
                });

                if (rightCol) rightCol.classList.remove('print-col-collapsed');

                // Возвращаем буквицу
                dropcaps.forEach(el => el.classList.add('scroll-dropcap'));

                details.forEach((d, i) => { d.open = wasOpen[i]; });
            }
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const body = document.getElementById('scroll-body');
        if (!body) return;

        const tryInject = () => {
            App.injectPrintButton(body);
            App.injectMinimap(body);
        };

        const mo = new MutationObserver(() => { queueMicrotask(tryInject); });
        mo.observe(body, { childList: true, subtree: false });
        tryInject();
    });
})();