# ============================================================
# species_store.py — общий доступ к данным о видах
#
# Папка data/species/ заменена единым файлом js/species-data.js
# с объектом window.SPECIES_DATA = { "<id>": {...}, ... }.
# Этот модуль читает и перезаписывает его, предоставляя скриптам
# тот же интерфейс «словарь по id», что раньше давали JSON-файлы.
#
# Использование:
#   from species_store import load_species_data, save_species_data, SpeciesEntry
# ============================================================

import json
import re
from pathlib import Path

SPECIES_DATA_JS = Path("js") / "species-data.js"

_PREFIX_RE = re.compile(r"^window\.SPECIES_DATA\s*=\s*", re.DOTALL)


def _strip_js(text):
    """Вынуть JSON-объект из обёртки window.SPECIES_DATA = {...};"""
    text = text.lstrip("\ufeff").strip()
    m = _PREFIX_RE.match(text)
    if not m:
        raise ValueError(
            f"{SPECIES_DATA_JS}: не найден заголовок 'window.SPECIES_DATA = {{...}}'")
    body = text[m.end():]
    if body.endswith(";"):
        body = body[:-1]
    return json.loads(body)


def load_species_data():
    """Вернуть dict: { species_id: {...} }. Если файла нет — пустой dict."""
    if not SPECIES_DATA_JS.exists():
        return {}
    return _strip_js(SPECIES_DATA_JS.read_text(encoding="utf-8"))


def save_species_data(data):
    """Перезаписать js/species-data.js словарём { id: {...} }."""
    SPECIES_DATA_JS.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, ensure_ascii=False, indent=2)
    SPECIES_DATA_JS.write_text(
        "window.SPECIES_DATA = " + body + ";\n",
        encoding="utf-8",
    )


class SpeciesEntry:
    """
    Обёртка над записью вида в js/species-data.js с интерфейсом,
    привычным для старого кода, работавшего с файлами data/species/{id}.json:
    .name — «имя файла», .exists — есть ли вид в хранилище,
    load_json()/save_json(data) — чтение/запись записи вида.
    """

    def __init__(self, species_id, cache=None):
        self.id = species_id
        self.name = f"{species_id}.json"  # имя «как у старого файла» — для сообщений
        self._cache = cache if cache is not None else load_species_data()

    @property
    def exists(self):
        return self.id in self._cache

    def load_json(self):
        return self._cache.get(self.id)

    def save_json(self, data):
        self._cache[self.id] = data
        save_species_data(self._cache)

    def __str__(self):
        return f"js/species-data.js#{self.id}"


def all_entries(data=None):
    """Список SpeciesEntry по всем видам в хранилище (сортировка по id)."""
    if data is None:
        data = load_species_data()
    return [SpeciesEntry(sid, cache=data) for sid in sorted(data.keys())]
