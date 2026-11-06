#!/usr/bin/env python3
# ============================================================
# scripts/tree.py — дерево проекта → в буфер обмена.
#
# Скрипт лежит в <проект>/scripts/tree.py и всегда обходит
# <проект>/ (родителя своей папки), независимо от текущего cwd.
#
#   python scripts/tree.py                # в буфер + краткий отчёт
#   python scripts/tree.py --print        # ещё и в stdout
#   python scripts/tree.py --stdout       # только stdout, буфер не трогать
#   python scripts/tree.py --depth 3
#   python scripts/tree.py --out tree.txt
#   python scripts/tree.py --hidden
#
# Копирование: pyperclip, если установлен; иначе нативные утилиты
# (pbcopy / clip / wl-copy / xclip / xsel / clip.exe).
# ============================================================

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# Корень проекта = папка, В КОТОРОЙ лежит scripts/
PROJECT_ROOT = Path(__file__).resolve().parent.parent

IGNORE_DIRS = {
    'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out',
    '.next', '.nuxt', '.cache', '.parcel-cache', 'coverage',
    '.idea', '.vscode', '__pycache__', '.venv', 'venv',
    '.pytest_cache', '.mypy_cache', '.tox', 'target', 'bin', 'obj',
    'scripts',           # ← не показываем саму папку со скриптом
}

IGNORE_FILES = {
    '.DS_Store', 'Thumbs.db', 'package-lock.json', 'yarn.lock',
    'pnpm-lock.yaml', '.eslintcache',
}

BINARY_EXT = {
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
    '.mp3', '.mp4', '.wav', '.ogg', '.webm',
    '.zip', '.tar', '.gz', '.7z', '.rar',
    '.pdf', '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.exe', '.dll', '.so', '.dylib', '.class', '.jar',
    '.pyc', '.pyo', '.o', '.a', '.lib', '.wasm',
}


def human_size(n: int) -> str:
    if n < 1024:
        return f'{n} Б'
    if n < 1024 * 1024:
        return f'{n / 1024:.1f} КБ'
    if n < 1024 * 1024 * 1024:
        return f'{n / 1024 / 1024:.1f} МБ'
    return f'{n / 1024 / 1024 / 1024:.1f} ГБ'


def list_entries(directory: Path, show_hidden: bool):
    out = []
    try:
        entries = list(directory.iterdir())
    except OSError:
        return out
    for p in entries:
        name = p.name
        if not show_hidden and name.startswith('.'):
            continue
        try:
            if p.is_dir():
                if name in IGNORE_DIRS:
                    continue
                out.append((name, True))
            elif p.is_file():
                if name in IGNORE_FILES:
                    continue
                if p.suffix.lower() in BINARY_EXT:
                    continue
                out.append((name, False))
        except OSError:
            continue
    out.sort(key=lambda x: (not x[1], x[0].lower()))
    return out


class Stats:
    dirs = 0
    files = 0
    bytes = 0


def walk(root: Path, depth: int, max_depth: int,
         show_hidden: bool, lines: list, stats: Stats,
         prefix: str = ''):
    if depth > max_depth:
        lines.append(prefix + '… (глубина превышена)')
        return
    entries = list_entries(root, show_hidden)
    for i, (name, is_dir) in enumerate(entries):
        last = (i == len(entries) - 1)
        branch = '└── ' if last else '├── '
        child_prefix = prefix + ('    ' if last else '│   ')
        full = root / name
        if is_dir:
            stats.dirs += 1
            lines.append(prefix + branch + name + '/')
            walk(full, depth + 1, max_depth, show_hidden, lines, stats,
                 child_prefix)
        else:
            stats.files += 1
            try:
                size = full.stat().st_size
            except OSError:
                size = 0
            stats.bytes += size
            lines.append(prefix + branch + name + '  ' + human_size(size))


# ---------- Копирование в буфер ----------

def copy_via_pyperclip(text: str):
    try:
        import pyperclip  # type: ignore
    except ImportError:
        return None
    try:
        pyperclip.copy(text)
        return 'pyperclip'
    except Exception:
        return None


def copy_via_native(text: str):
    plat = sys.platform
    if plat.startswith('win'):
        candidates = [['clip']]
    elif plat == 'darwin':
        candidates = [['pbcopy']]
    else:
        candidates = [
            ['wl-copy'],
            ['xclip', '-selection', 'clipboard'],
            ['xsel', '--clipboard', '--input'],
            ['clip.exe'],
        ]
    for cmd in candidates:
        if shutil.which(cmd[0]) is None:
            continue
        try:
            p = subprocess.run(cmd, input=text.encode('utf-8'),
                               stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
            if p.returncode == 0:
                return cmd[0]
        except Exception:
            continue
    return None


def copy_to_clipboard(text: str):
    return copy_via_pyperclip(text) or copy_via_native(text)


# ---------- Точка входа ----------

def main():
    ap = argparse.ArgumentParser(
        description='Дерево проекта → в буфер обмена. '
                    'Корень обхода — папка, содержащая scripts/.',
    )
    ap.add_argument('--depth', '-d', type=int, default=10,
                    help='максимальная глубина (по умолчанию 10)')
    ap.add_argument('--print', dest='do_print', action='store_true',
                    help='печатать дерево в stdout (в дополнение к буферу)')
    ap.add_argument('--stdout', dest='only_stdout', action='store_true',
                    help='только в stdout, буфер не трогать')
    ap.add_argument('--out', default=None,
                    help='дополнительно записать в файл')
    ap.add_argument('--hidden', action='store_true',
                    help='показывать скрытые файлы')
    args = ap.parse_args()

    root = PROJECT_ROOT
    if not root.is_dir():
        print(f'Не найден корень проекта: {root}', file=sys.stderr)
        sys.exit(1)

    lines = [root.name + '/']
    stats = Stats()
    walk(root, 1, args.depth, args.hidden, lines, stats)

    lines.append('')
    lines.append(
        f'Папок: {stats.dirs} · Файлов: {stats.files} · '
        f'Размер: {human_size(stats.bytes)}'
    )
    text = '\n'.join(lines)

    if args.out:
        try:
            Path(args.out).write_text(text + '\n', encoding='utf-8')
        except OSError as e:
            print(f'Не удалось записать {args.out}: {e}', file=sys.stderr)

    if args.only_stdout or args.do_print:
        sys.stdout.write(text + '\n')

    if args.only_stdout:
        return

    how = copy_to_clipboard(text)
    if how:
        n_lines = text.count('\n') + 1
        n_bytes = len(text.encode('utf-8'))
        print(
            f'✓ Дерево {root.name}/ скопировано в буфер ({how}); '
            f'{n_lines} строк, {n_bytes / 1024:.1f} КБ',
            file=sys.stderr,
        )
    else:
        print(
            '✗ Буфер недоступен: установите pyperclip (pip install pyperclip) '
            'или одну из утилит: pbcopy (macOS), clip (Windows), '
            'wl-copy / xclip / xsel (Linux). Вывод в stdout:',
            file=sys.stderr,
        )
        sys.stdout.write(text + '\n')
        sys.exit(2)


if __name__ == '__main__':
    main()