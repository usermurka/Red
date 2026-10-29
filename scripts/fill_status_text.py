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

from species_store import load_species_data, save_species_data

SPECIES_DATA_JS  = Path("js/species-data.js")
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
    Возвращает (all_count, unfilled_sorted_ids).
    unfilled_sorted_ids — id видов из js/species-data.js без status_text,
    отсортированные по порядку из species.js.
    """
    if not SPECIES_DATA_JS.exists():
        err(f"Файл {SPECIES_DATA_JS} не найден.")
        sys.exit(1)

    store = load_species_data()
    unfilled = [sid for sid, data in store.items()
                if not ((data or {}).get("status_text") or "").strip()]

    # Индекс: id -> порядковый номер в species.js
    order_index = {sid: i for i, sid in enumerate(species_order)}
    BIG = len(species_order) + 10000  # для тех, кого нет в species.js

    unfilled.sort(key=lambda sid: order_index.get(store.get(sid, {}).get("id", ""), BIG))
    return len(store), unfilled


def load_json(store, sid):
    return store.get(sid, {})


def save_json(store, sid, data):
    store[sid] = data
    save_species_data(store)


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

    store = load_species_data()

    info(f"Всего видов в базе: {total_all}")
    info(f"Без status_text: {len(unfilled)}")

    idx = 0
    done_session = 0
    history = []  # для отмены

    while idx < len(unfilled):
        sid = unfilled[idx]
        data = load_json(store, sid)

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
            prev_sid, prev_old_text = history.pop()
            prev_data = load_json(store, prev_sid)
            prev_data["status_text"] = prev_old_text
            save_json(store, prev_sid, prev_data)
            idx = unfilled.index(prev_sid)
            done_session -= 1
            info(f"Откатили: {prev_sid}")
            continue

        if user_input == "":
            info(f"Пропускаю {sid}")
            idx += 1
            continue

        # --- Сохранить формулировку ---
        old_text = (data.get("status_text") or "").strip()
        data["status_text"] = user_input
        save_json(store, sid, data)

        history.append((sid, old_text))
        done_session += 1
        ok(f"Сохранено в js/species-data.js («{sid}»)")
        idx += 1

    print()
    print("=" * 60)
    print(f"  Готово! Обработано за сессию: {done_session}")
    print("=" * 60)


if __name__ == "__main__":
    main()