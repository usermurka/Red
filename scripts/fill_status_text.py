# ============================================================
# fill_status_text.py — полуручное заполнение status_text
# Запуск: py fill_status_text.py
#
# Порядок обхода — как в js/species.js (по систематике).
# Если id нет в species.js — такие файлы идут В КОНЦЕ.
#
# Управление:
#   <вставить текст> + Enter  — сохранить и идти дальше
#   Enter (пустая строка)     — пропустить вид
#   u + Enter                 — вернуться к предыдущему виду
#   q + Enter                 — выйти (прогресс сохранится)
# ============================================================

import json
import re
import sys
from pathlib import Path

SPECIES_JSON_DIR = Path("data/species")
SPECIES_JS       = Path("js/species.js")


def info(msg): print(f"  {msg}")
def ok(msg):   print(f"  ✅ {msg}")
def warn(msg): print(f"  ⚠️  {msg}")
def err(msg):  print(f"  ❌ {msg}")


def load_species_order():
    """Возвращает список id из species.js В ПОРЯДКЕ следования."""
    if not SPECIES_JS.exists():
        err(f"Файл {SPECIES_JS} не найден.")
        sys.exit(1)
    text = SPECIES_JS.read_text(encoding="utf-8").lstrip('\ufeff')
    ids = re.findall(r"id:\s*['\"]([^'\"]+)['\"]", text)
    return ids


def find_unfilled(species_order):
    """
    Возвращает (all_files_count, unfilled_sorted_list).
    unfilled_sorted_list — пути к JSON-ам без status_text,
    отсортированные по порядку из species.js.
    """
    if not SPECIES_JSON_DIR.exists():
        err(f"Папка {SPECIES_JSON_DIR}/ не найдена.")
        sys.exit(1)

    files = sorted(SPECIES_JSON_DIR.glob("*.json"))
    unfilled = []

    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            warn(f"Не читается {f.name}: {e}")
            continue
        if not (data.get("status_text") or "").strip():
            unfilled.append(f)

    # Индекс: id -> порядковый номер в species.js
    order_index = {sid: i for i, sid in enumerate(species_order)}
    BIG = len(species_order) + 10000  # для тех, кого нет в species.js

    def sort_key(path):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            sid = data.get("id", "")
        except Exception:
            sid = ""
        return order_index.get(sid, BIG)

    unfilled.sort(key=sort_key)
    return len(files), unfilled


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path, data):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def show_progress(current_idx, total_unfilled, total_all, done_this_session):
    print()
    print("─" * 60)
    print(f"  Вид {current_idx} из {total_unfilled} (пустых)")
    print(f"  Всего в базе: {total_all}. Заполнено за сессию: {done_this_session}.")
    print("─" * 60)


def main():
    print()
    print("=" * 60)
    print("  Полуручное заполнение status_text")
    print("  Порядок — как в js/species.js")
    print("  Enter — пропустить, u — назад, q — выход")
    print("=" * 60)

    species_order = load_species_order()
    info(f"В species.js: {len(species_order)} id")

    total_all, unfilled = find_unfilled(species_order)

    if not unfilled:
        print()
        ok("Все виды уже имеют status_text. Работа не требуется.")
        return

    info(f"Всего файлов: {total_all}")
    info(f"Без status_text: {len(unfilled)}")

    idx = 0
    done_session = 0
    history = []  # для отмены

    while idx < len(unfilled):
        path = unfilled[idx]
        data = load_json(path)

        show_progress(idx + 1, len(unfilled), total_all, done_session)

        status = data.get("status", "?")
        print(f"  ID:    {data.get('id', '—')}")
        print(f"  Имя:   {data.get('name', '—')}")
        print(f"  Лат.:  {data.get('latin', '—')}")
        print(f"  Status: {status}")
        print()

        try:
            user_input = input("  ▶  Вставь формулировку статуса (Enter — пропустить, u — назад, q — выход):\n  > ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            info("Выход по Ctrl+C. Прогресс сохранён.")
            return

        # --- Команды ---
        if user_input.lower() == "q":
            print()
            info("Выход. Прогресс сохранён.")
            info(f"Заполнено за сессию: {done_session}")
            return

        if user_input.lower() == "u":
            if not history:
                warn("Нечего отменять — это первый вид в сессии.")
                continue
            prev_path, prev_old_text = history.pop()
            prev_data = load_json(prev_path)
            prev_data["status_text"] = prev_old_text
            save_json(prev_path, prev_data)
            idx = unfilled.index(prev_path)
            done_session -= 1
            info(f"Откатили: {prev_path.name}")
            continue

        if user_input == "":
            info(f"Пропускаю {path.name}")
            idx += 1
            continue

        # --- Сохранить формулировку ---
        old_text = (data.get("status_text") or "").strip()
        data["status_text"] = user_input
        save_json(path, data)

        history.append((path, old_text))
        done_session += 1
        ok(f"Сохранено в {path.name}")
        idx += 1

    print()
    print("=" * 60)
    print(f"  Готово! Обработано за сессию: {done_session}")
    print("=" * 60)


if __name__ == "__main__":
    main()