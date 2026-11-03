# -*- coding: utf-8 -*-
"""
make_screenshots.py — автоматическая «отрисовка» скриншотов приложения.

Проект полностью статический (HTML/CSS/JS + JSON-данные), поэтому все
скриншоты для документа можно не снимать руками, а «нарисовать»
программно: скрипт поднимает локальный HTTP-сервер, открывает приложение
в headless-браузере (Playwright / Chromium), через консоль браузера
вызывает методы приложения (App.render(), Journal.load(), HabitatGame.open()
и т. д.) и сохраняет PNG в папку screenshots/.

Номера файлов совпадают с номерами рисунков в chapter2_make_docx.py:
    01_main_map.png        — карта со слоями маркеров и областей (гость)
    02_sidebar_nav.png     — боковая панель навигации
    03_developer_tools.png — режим разработчика: панель инструментов
    04_species_scroll.png  — карточка вида («свиток»)
    05_journal_form.png    — форма новой записи дневника
    06_journal_list.png    — список записей дневника с мини-картой
    07_games_menu.png      — выбор игры: сетка восьми карточек
    08_habitat_game.png    — игра «Среда обитания» (панель КК скрыта)
    09_medals_showcase.png — витрина медалей

Запуск:
    pip install playwright
    playwright install chromium
    python scripts/make_screenshots.py

Зависимости: playwright (только stdlib http.server для раздачи).
"""

import http.server
import json
import socketserver
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # корень проекта
OUT_DIR = ROOT / "screenshots"
PORT = 8765
BASE_URL = f"http://127.0.0.1:{PORT}/index.html"
VIEWPORT = {"width": 1440, "height": 900}


# ----------------------------------------------------------------------
# Локальный сервер для раздачи проекта (нужен, чтобы fetch() работал)
# ----------------------------------------------------------------------
def start_server():
    handler = type("Quiet", (http.server.SimpleHTTPRequestHandler,),
                   {"log_message": lambda *a: None})
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


# ----------------------------------------------------------------------
# JS-хелперы: подготовка состояния приложения перед снимком
# ----------------------------------------------------------------------
# Выделить всё (маркеры + области + миграции всех видов) и перерисовать
JS_SHOW_ALL = """() => {
  App.highlightedIds = new Set(App.markers.map(m => m.id));
  App.highlightedSpeciesRegions = new Set(
    App.regions.flatMap(r => (r.speciesList || []).map(s => s.speciesId)));
  App.highlightedSpeciesMigrations = new Set(
    App.migrations.filter(m => m.speciesId).map(m => m.speciesId));
  App.showMarkers = true; App.showRegions = true; App.showMigrations = true;
  const tr = document.getElementById('toggle-regions');
  const tm = document.getElementById('toggle-migrations');
  const tk = document.getElementById('toggle-markers');
  if (tr) tr.checked = true; if (tm) tm.checked = true; if (tk) tk.checked = true;
  App.render();
  return {markers: App.markers.length, regions: App.regions.length};
}"""

# Закрыть тултипы/подсказки, чтобы не засоряли кадр
JS_CLEAN_OVERLAYS = """() => {
  const tt = document.getElementById('tooltip'); if (tt) tt.style.display = 'none';
  const sp = document.getElementById('species-panel'); if (sp) sp.classList.add('hidden');
}"""

# Открыть справочник (browse) и развернуть дерево
JS_OPEN_DIRECTORY = """() => {
  App.listFilter = new Set(); App.listStatuses = new Set(); App.listSpeciesIds = null;
  App.openSpeciesPanel('browse', {});
  const search = document.getElementById('species-search');
  if (search) search.value = '';
  App.renderSpeciesTree('');
  // раскрыть группы: кнопка «Развернуть всё» — дважды (группы, затем виды)
  const btn = document.getElementById('btn-species-toggle-expand');
  if (btn) { btn.click(); btn.click(); }
}"""

# Найти вид с наибольшим числом маркеров и открыть его свиток
JS_OPEN_SCROLL = """() => {
  const counts = {};
  App.markers.forEach(m => { counts[m.speciesId] = (counts[m.speciesId] || 0) + 1; });
  let best = null, bestN = 0;
  for (const [id, n] of Object.entries(counts)) {
    const sp = window.SPECIES_DATA && SPECIES_DATA[id];
    if (n > bestN && sp) { best = id; bestN = n; }
  }
  if (!best) {                      // запасной вариант — первый попавшийся id
    best = Object.keys(SPECIES_DATA || {})[0] || App.markers[0]?.speciesId;
  }
  App.openSpeciesScroll(best);
  return best;
}"""

# Дневник: подгрузить пример записей из data/field-journal-omsk.json
JS_LOAD_JOURNAL = """async () => {
  const resp = await fetch('data/field-journal-omsk.json');
  const data = await resp.json();
  localStorage.setItem('red_book_journal', JSON.stringify(data.journal));
  Journal.records = data.journal;
  Journal.renderList && Journal.renderList();
  return data.journal.length;
}"""

JS_OPEN_JOURNAL = """() => {
  document.getElementById('btn-journal').click();
}"""

JS_OPEN_JOURNAL_FORM = """() => {
  Journal.pendingPins = [{x: 50.0, y: 68.9}];   // имитация поставленной точки
  Journal.openForm();
}"""

# Демо-прогресс игр: разблокируем часть медалей, чтобы витрина была живой
JS_SEED_PROGRESS = """() => {
  Achievements.load();
  const ids = id => Achievements.CATALOG.find(g => g.game === id)
                        .achievements.slice(0, 3).map(a => a.id);
  ['quiz', 'habitat', 'status', 'latin'].forEach(g => {
    Achievements.progress.unlocked[g] = ids(g);
  });
  Achievements.save && Achievements.save();
  return true;
}"""

JS_GAMES_MENU = """() => {
  document.getElementById('btn-games').click();
}"""

JS_HABITAT_GAME = """() => {
  HabitatGame.open();
}"""

JS_MEDALS = """() => {
  Achievements.enterGamesMode();
  Achievements.renderShowcase();
}"""


# ----------------------------------------------------------------------
# Основная функция
# ----------------------------------------------------------------------
def main():
    OUT_DIR.mkdir(exist_ok=True)
    from playwright.sync_api import sync_playwright

    httpd = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--allow-file-access-from-files"])
            page = browser.new_page(viewport=VIEWPORT, device_scale_factor=2)
            page.goto(BASE_URL, wait_until="networkidle")
            page.wait_for_timeout(1200)   # дождаться загрузки маркеров/фото

            def shot(name):
                path = OUT_DIR / name
                page.screenshot(path=str(path))
                print(f"  ✔ {path.name}")

            # 1. Главная: карта со всеми объектами
            print(json.dumps(page.evaluate(JS_SHOW_ALL)))
            page.wait_for_timeout(800)
            page.evaluate(JS_CLEAN_OVERLAYS)
            page.wait_for_timeout(300)
            shot("01_main_map.png")

            # 2. Боковая панель навигации — снимем только сам сайдбар
            page.locator("#sidebar").screenshot(path=str(OUT_DIR / "02_sidebar_nav.png"))
            print("  ✔ 02_sidebar_nav.png (только панель)")

            # 3. Режим разработчика
            page.evaluate("""() => {
              App.setMode(true);
              const dev = document.getElementById('developer-tools');
              if (dev) dev.classList.remove('hidden');
            }""")
            page.wait_for_timeout(500)
            shot("03_developer_tools.png")
            page.evaluate("() => App.setMode(false)")

            # 4. Справочник + карточка вида (свиток)
            page.evaluate(JS_OPEN_DIRECTORY)
            page.wait_for_timeout(600)
            shot("03b_species_directory.png")
            sid = page.evaluate(JS_OPEN_SCROLL)
            print("scroll species:", sid)
            page.wait_for_timeout(900)
            shot("04_species_scroll.png")
            page.evaluate("""() => {
              const sc = document.getElementById('species-scroll');
              if (sc) sc.classList.add('hidden');
              const sp = document.getElementById('species-panel');
              if (sp) sp.classList.add('hidden');
            }""")

            # 5–6. Дневник
            n = page.evaluate(JS_LOAD_JOURNAL)
            print("journal records:", n)
            page.evaluate(JS_OPEN_JOURNAL)
            page.wait_for_timeout(800)
            shot("06_journal_list.png")
            page.evaluate(JS_OPEN_JOURNAL_FORM)
            page.wait_for_timeout(600)
            shot("05_journal_form.png")
            page.evaluate("""() => {
              const fm = document.getElementById('journal-form-modal');
              if (fm) fm.classList.add('hidden');
              const jm = document.getElementById('journal-modal');
              if (jm) jm.classList.add('hidden');
            }""")

            # 7. Меню игр (с предварительно «наигранным» прогрессом медалей)
            page.evaluate(JS_SEED_PROGRESS)
            page.evaluate(JS_GAMES_MENU)
            page.wait_for_timeout(600)
            shot("07_games_menu.png")

            # 8. Игра «Среда обитания»
            page.evaluate(JS_HABITAT_GAME)
            page.wait_for_timeout(1200)
            shot("08_habitat_game.png")
            page.evaluate("() => HabitatGame.close()")
            page.wait_for_timeout(400)

            # 9. Витрина медалей
            page.evaluate(JS_MEDALS)
            page.wait_for_timeout(600)
            shot("09_medals_showcase.png")

            browser.close()
    finally:
        httpd.shutdown()

    print(f"\nГотово: скриншоты в {OUT_DIR}/")


if __name__ == "__main__":
    main()
