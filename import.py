# ============================================================
# import.py — циклический импорт видов из inbox/
# Запуск: py import.py
#         py import.py --force
#
# Логика одного цикла:
#   1. Читаем inbox/data.txt
#   2. Валидируем (18 полей, id в species.js, status, name)
#   3. Защита: если id+хэш текста совпали с предыдущим импортом — блок
#   4. Пишем data/species/{id}.json
#   5. Только после успеха — перемещаем картинку в img/species/{id}.png
#
# После цикла — ждём Enter для следующего вида. Ctrl+C — выход.
# ============================================================

import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

INBOX_DIR        = Path("inbox")
HUB_FILE         = INBOX_DIR / "data.txt"
SPECIES_JS       = Path("js/species.js")
SPECIES_JSON_DIR = Path("data/species")
SPECIES_IMG_DIR  = Path("img/species")

REQUIRED_FIELDS = [
    "id", "name", "latin", "status",
    "order", "family", "taxonomic_position",
    "description_short", "description_full",
    "spread_general", "spread_omsk",
    "habitats", "abundance", "biology",
    "limiting_factors", "protection_measures",
    "sources", "authors"
]

# Память последнего успешного импорта
last_import = {
    "id": None,
    "hash": None,
    "name": None,
}


# ---------- Утилиты вывода ----------
def info(msg): print(f"  {msg}")
def ok(msg):   print(f"  ✅ {msg}")
def warn(msg): print(f"  ⚠️  {msg}")
def err(msg):  print(f"  ❌ {msg}")
def bad(msg):  print(f"  🚫 {msg}")


# ---------- Поиск картинки ----------
def find_image():
    images = sorted(INBOX_DIR.glob("*.png"))
    if not images:
        return None
    if len(images) > 1:
        warn(f"В inbox/ несколько .png — беру первый: {images[0].name}")
        warn("Остальные НЕ трогаю.")
    return images[0]


# ---------- Чтение JSON ----------
def read_text_safe(path):
    """Возвращает (text, error). Читает UTF-8, потом cp1251. Снимает BOM."""
    raw = path.read_bytes()
    if raw.startswith(b'\xef\xbb\xbf'):
        raw = raw[3:]
    try:
        return raw.decode("utf-8"), None
    except UnicodeDecodeError:
        pass
    try:
        return raw.decode("cp1251"), None
    except UnicodeDecodeError as e:
        return None, f"Не удалось прочитать файл: {e}"


def parse_json(text):
    try:
        return json.loads(text), None
    except json.JSONDecodeError as e:
        return None, f"Ошибка JSON: {e}"


# ---------- База id ----------
def load_species_ids():
    if not SPECIES_JS.exists():
        return None
    text = SPECIES_JS.read_text(encoding="utf-8").lstrip('\ufeff')
    ids = re.findall(r"id:\s*['\"]([^'\"]+)['\"]", text)
    return set(ids)


# ---------- Валидация ----------
def validate(data, species_ids, force=False):
    errors = []

    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        err(f"Отсутствуют поля: {', '.join(missing)}")
        errors.append("missing_fields")
    else:
        ok(f"Все {len(REQUIRED_FIELDS)} полей на месте")

    species_id = (data.get("id") or "").strip()
    if not species_id:
        err("Поле 'id' пустое или отсутствует")
        errors.append("empty_id")
    elif species_ids is None:
        warn("js/species.js не найден — проверка id пропущена")
    elif species_id not in species_ids:
        err(f"id '{species_id}' НЕ найден в species.js")
        err(f"   → проверь опечатку или добавь вид в базу")
        errors.append("unknown_id")
    else:
        ok(f"id '{species_id}' найден в species.js")

    status = data.get("status")
    if not isinstance(status, int) or not (0 <= status <= 7):
        err(f"Поле 'status' = {status!r}, должно быть число 0..7")
        errors.append("bad_status")
    else:
        ok(f"status = {status} (корректно)")

    name = (data.get("name") or "").strip()
    latin = (data.get("latin") or "").strip()
    if not name:
        err("Поле 'name' пустое")
        errors.append("empty_name")
    else:
        ok(f"name = «{name}»")
    if not latin:
        warn("Поле 'latin' пустое (не критично)")

    # status_text — опционально. Если нет, будет типовое из config.
    if not (data.get("status_text") or "").strip():
        warn("Поле 'status_text' пустое — в свитке будет типовая формулировка.")
    else:
        ok("status_text задан (индивидуальная формулировка)")

    empty_fields = [f for f in REQUIRED_FIELDS if f in data and data[f] == ""]
    if empty_fields:
        info(f"Пустые поля (это норма): {', '.join(empty_fields)}")

    if errors:
        if force:
            warn("Есть ошибки, но включён --force. Продолжаем.")
            return True
        bad("Импорт отменён.")
        return False
    return True


# ---------- Один цикл ----------
def process_one(force, counter):
    """Возвращает True, если импорт прошёл. None — если хотим выйти."""
    print()
    print("=" * 50)
    print(f"  Импорт #{counter}")
    print("=" * 50)

    # 1. Проверка входных данных
    if not INBOX_DIR.exists():
        err(f"Папка {INBOX_DIR}/ не найдена. Запусти скрипт из корня проекта.")
        return False

    if not HUB_FILE.exists():
        err(f"Файл {HUB_FILE} не найден. Создай его и вставь JSON.")
        return False

    # 2. Читаем текст data.txt
    text, text_err = read_text_safe(HUB_FILE)
    if text is None:
        err(text_err)
        return False

    # 3. Хэш содержимого
    current_hash = hashlib.md5(text.encode("utf-8")).hexdigest()

    # 4. Парсим JSON
    data, parse_err = parse_json(text)
    if data is None:
        err(parse_err)
        return False

    species_id = (data.get("id") or "").strip()

    # 5. 🛡️ Защита от «забыла поменять JSON»
    if not force and species_id and species_id == last_import["id"]:
        if current_hash == last_import["hash"]:
            bad(f"ID '{species_id}' и содержимое data.txt совпадают с предыдущим импортом.")
            bad(f"   Похоже, ты забыла поменять JSON.")
            bad(f"   Поменяй data.txt и нажми Enter. Или запусти с --force.")
            return False
        else:
            info(f"ID совпадает с предыдущим ('{species_id}'), но текст изменился.")
            info(f"   Значит, ты правила вид — продолжаем.")

    # 6. Ищем картинку
    img_src = find_image()
    if not img_src:
        err("В inbox/ нет ни одного .png")
        return False

    # 7. Валидация
    species_ids = load_species_ids()
    if species_ids is not None:
        info(f"В базе species.js: {len(species_ids)} id")
    else:
        warn("js/species.js не найден — проверка id не работает")

    print()
    print("  Проверки:")
    if not validate(data, species_ids, force=force):
        return False

    # 8. Запись JSON
    print()
    info(f"Импортирую: {species_id}")

    SPECIES_JSON_DIR.mkdir(parents=True, exist_ok=True)
    SPECIES_IMG_DIR.mkdir(parents=True, exist_ok=True)

    json_dst = SPECIES_JSON_DIR / f"{species_id}.json"
    img_dst  = SPECIES_IMG_DIR  / f"{species_id}.png"

    existed = json_dst.exists()
    json_dst.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    if existed:
        ok(f"JSON  → {json_dst}  (перезаписан)")
    else:
        ok(f"JSON  → {json_dst}")

    # 9. ТОЛЬКО ПОСЛЕ УСПЕШНОЙ ЗАПИСИ — картинка
    try:
        shutil.move(str(img_src), str(img_dst))
        ok(f"Фото  → {img_dst}  (перемещено, из inbox удалено)")
    except Exception as e:
        warn(f"JSON записан, но картинку переместить не удалось: {e}")
        warn("   Разберись с картинкой вручную, JSON уже на месте.")

    # 10. Запоминаем для защиты от повторов
    last_import["id"] = species_id
    last_import["hash"] = current_hash
    last_import["name"] = data.get("name", species_id)

    print()
    print(f"🎉 Вид «{data.get('name', species_id)}» импортирован.")
    return True


# ---------- Основной цикл ----------
def main():
    force = "--force" in sys.argv

    print()
    print("=" * 50)
    print("  Циклический импорт видов из inbox/")
    if force:
        print("  ⚡ Режим --force: проверки отключены")
    print("  Ctrl+C — выход.")
    print("=" * 50)

    counter = 0
    success_count = 0

    while True:
        counter += 1
        try:
            result = process_one(force, counter)
            if result:
                success_count += 1
        except KeyboardInterrupt:
            print()
            print("👋 Прервано пользователем.")
            break
        except Exception as e:
            err(f"Непредвиденная ошибка: {e}")

        print()
        print("─" * 50)
        print(f"  Цикл #{counter}. Успешных импортов: {success_count}.")
        if last_import["id"]:
            print(f"  Последний: {last_import['id']} — «{last_import['name']}»")
        print("─" * 50)

        try:
            input("  ▶  Меняешь data.txt и картинку, затем Enter для следующего (Ctrl+C — выход): ")
        except KeyboardInterrupt:
            print()
            print("👋 Выход.")
            break
        except EOFError:
            print()
            break


if __name__ == "__main__":
    main()