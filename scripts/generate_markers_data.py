#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор js/markers-data.js из data/red-book-omsk.json.

По аналогии со species-data.js (window.SPECIES_DATA = {...}) создаёт файл
с «зашитыми» данными карты: window.MARKERS_DATA = { markers, regions, migrations }.
Это позволяет приложению работать без сервера (протокол file://), где fetch() недоступен.

Запуск из корня проекта:
    python3 scripts/generate_markers_data.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "red-book-omsk.json"
DST = ROOT / "js" / "markers-data.js"


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))

    payload = {
        "version": data.get("version", 3),
        "exportedAt": data.get("exportedAt", ""),
        "markers": data.get("markers", []),
        "regions": data.get("regions", []),
        "migrations": data.get("migrations", []),
    }

    body = json.dumps(payload, ensure_ascii=False, indent=2)

    DST.write_text(
        "// ============================================================\n"
        "// ДАННЫЕ КАРТЫ (маркеры, области обитания, линии миграций)\n"
        "// Сгенерировано из data/red-book-omsk.json скриптом\n"
        "// scripts/generate_markers_data.py — НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.\n"
        "// Подключается в index.html; приложение читает window.MARKERS_DATA,\n"
        "// что даёт работу без сервера (file://). Для обновления данных после\n"
        "// изменений в red-book-omsk.json запустите генератор заново.\n"
        "// ============================================================\n"
        f"window.MARKERS_DATA = {body};\n",
        encoding="utf-8",
    )

    print(f"OK: {DST.relative_to(ROOT)} — маркеров: {len(payload['markers'])}, "
          f"областей: {len(payload['regions'])}, миграций: {len(payload['migrations'])}")


if __name__ == "__main__":
    main()
