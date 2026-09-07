#!/usr/bin/env python3
"""Content management and validation for the personal site.

Source of truth:
  _thoughts/*.txt
  _works/Notes/*.md
  _works/Papers/*.md
  _dates/*.json

Generated files:
  data/thoughts.json
  data/works.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
THOUGHTS_DIR = ROOT / "_thoughts"
WORKS_DIR = ROOT / "_works"
DATES_DIR = ROOT / "_dates"
DATA_DIR = ROOT / "data"

THOUGHTS_DATES = DATES_DIR / "thoughts_dates.json"
WORKS_DATES = DATES_DIR / "works_dates.json"
THOUGHTS_DATA = DATA_DIR / "thoughts.json"
WORKS_DATA = DATA_DIR / "works.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"invalid ISO timestamp: {value!r}") from exc
    if dt.tzinfo is None:
        raise ValueError(f"timestamp must include timezone: {value!r}")
    return dt


def load_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")


def stable_id(key: str) -> int:
    digest = hashlib.blake2b(key.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") % 1_000_000_000_000


def read_dates(path: Path) -> dict[str, str]:
    data = load_json(path, {})
    if not isinstance(data, dict):
        raise ValueError(f"{path.relative_to(ROOT)} must contain a JSON object")
    for key, value in data.items():
        parse_iso(value)
    return data


def thought_items() -> list[dict]:
    dates = read_dates(THOUGHTS_DATES)
    items = []
    if not THOUGHTS_DIR.exists():
        return items

    for path in sorted(THOUGHTS_DIR.glob("*.txt")):
        if path.name not in dates:
            raise ValueError(f"missing date for _thoughts/{path.name}")
        content = path.read_text(encoding="utf-8").strip()
        if not content:
            raise ValueError(f"empty thought: _thoughts/{path.name}")
        items.append({
            "id": stable_id(f"thought:{path.name}"),
            "content": content,
            "time": dates[path.name],
        })

    items.sort(key=lambda item: parse_iso(item["time"]), reverse=True)
    return items


def work_items() -> list[dict]:
    dates = read_dates(WORKS_DATES)
    items = []

    for folder_name, category in (("Notes", "note"), ("Papers", "paper")):
        folder = WORKS_DIR / folder_name
        if not folder.exists():
            continue

        for path in sorted(folder.glob("*.md")):
            explicit_key = f"{folder_name}/{path.name}"
            legacy_key = path.name
            date = dates.get(explicit_key) or dates.get(legacy_key)
            if not date:
                raise ValueError(f"missing date for _works/{explicit_key}")
            parse_iso(date)

            content = path.read_text(encoding="utf-8")
            if not content.strip():
                raise ValueError(f"empty work: _works/{explicit_key}")

            title = path.stem
            for line in content.splitlines():
                if line.startswith("# "):
                    title = line[2:].strip() or title
                    break

            items.append({
                "id": stable_id(f"work:{explicit_key}"),
                "title": title,
                "category": category,
                "content": content,
                "time": date,
            })

    items.sort(key=lambda item: parse_iso(item["time"]), reverse=True)
    return items


def expected_data() -> dict[Path, dict]:
    return {
        THOUGHTS_DATA: {"thoughts": thought_items()},
        WORKS_DATA: {"works": work_items()},
    }


def build(check_only: bool = False) -> bool:
    ok = True
    for path, value in expected_data().items():
        expected = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        actual = path.read_text(encoding="utf-8") if path.exists() else ""
        if actual == expected:
            print(f"OK   {path.relative_to(ROOT)}")
            continue
        if check_only:
            print(f"FAIL {path.relative_to(ROOT)} is out of date")
            ok = False
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(expected, encoding="utf-8")
            print(f"WRITE {path.relative_to(ROOT)}")
    return ok


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs):
        attrs = dict(attrs)
        if tag in {"a", "link"} and attrs.get("href"):
            self.refs.append(("href", attrs["href"]))
        if tag in {"script", "img"} and attrs.get("src"):
            self.refs.append(("src", attrs["src"]))


def is_external_ref(ref: str) -> bool:
    if ref.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
        return True
    parsed = urlparse(ref)
    return bool(parsed.scheme or parsed.netloc)


def check_assets() -> list[str]:
    errors: list[str] = []
    for html_path in sorted(ROOT.glob("*.html")):
        parser = AssetParser()
        parser.feed(html_path.read_text(encoding="utf-8"))
        for _, ref in parser.refs:
            if is_external_ref(ref):
                continue
            clean = ref.split("#", 1)[0].split("?", 1)[0]
            if not clean:
                continue
            if clean.startswith("/"):
                errors.append(f"{html_path.name}: root-relative ref is deployment-sensitive: {ref}")
                continue
            target = (html_path.parent / clean).resolve()
            try:
                target.relative_to(ROOT)
            except ValueError:
                errors.append(f"{html_path.name}: ref escapes repo: {ref}")
                continue
            if not target.exists():
                errors.append(f"{html_path.name}: missing local asset: {ref}")
    return errors


def check_dates() -> list[str]:
    errors: list[str] = []
    thought_dates = read_dates(THOUGHTS_DATES)
    work_dates = read_dates(WORKS_DATES)

    thought_names = {p.name for p in THOUGHTS_DIR.glob("*.txt")} if THOUGHTS_DIR.exists() else set()
    extra_thought_dates = set(thought_dates) - thought_names
    for key in sorted(extra_thought_dates):
        errors.append(f"orphan thought date: {key}")

    valid_work_keys = set()
    valid_legacy_keys = set()
    for folder_name in ("Notes", "Papers"):
        folder = WORKS_DIR / folder_name
        if not folder.exists():
            continue
        for path in folder.glob("*.md"):
            valid_work_keys.add(f"{folder_name}/{path.name}")
            valid_legacy_keys.add(path.name)

    for key in sorted(work_dates):
        if key not in valid_work_keys and key not in valid_legacy_keys:
            errors.append(f"orphan work date: {key}")
    return errors


def check() -> bool:
    errors: list[str] = []
    try:
        if not build(check_only=True):
            errors.append("generated data is not synchronized")
        errors.extend(check_dates())
        errors.extend(check_assets())

        thoughts = load_json(THOUGHTS_DATA, {}).get("thoughts", [])
        works = load_json(WORKS_DATA, {}).get("works", [])
        ids = [item.get("id") for item in thoughts + works]
        if len(ids) != len(set(ids)):
            errors.append("duplicate generated IDs")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        errors.append(str(exc))

    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        return False

    print("Site check passed.")
    return True


def next_thought_name() -> str:
    numbers = []
    for path in THOUGHTS_DIR.glob("*.txt"):
        if path.stem.isdigit():
            numbers.append(int(path.stem))
    return f"{(max(numbers, default=0) + 1):03d}.txt"


def save_date(path: Path, key: str, value: str) -> None:
    parse_iso(value)
    dates = read_dates(path)
    dates[key] = value
    write_json(path, dates)


def add_thought(text: str, time_value: str) -> None:
    text = text.strip()
    if not text:
        raise ValueError("thought text cannot be empty")
    existing = {p.read_text(encoding="utf-8").strip() for p in THOUGHTS_DIR.glob("*.txt")}
    if text in existing:
        raise ValueError("duplicate thought content")

    THOUGHTS_DIR.mkdir(parents=True, exist_ok=True)
    name = next_thought_name()
    (THOUGHTS_DIR / name).write_text(text + "\n", encoding="utf-8")
    save_date(THOUGHTS_DATES, name, time_value)
    build()
    print(f"Added _thoughts/{name}")


def safe_title(title: str) -> str:
    title = title.strip()
    if not title:
        raise ValueError("title cannot be empty")
    if "/" in title or "\x00" in title or title in {".", ".."}:
        raise ValueError("title cannot contain '/' or NUL")
    return title


def add_work(category: str, title: str, source: Path, time_value: str) -> None:
    title = safe_title(title)
    if not source.exists() or not source.is_file():
        raise ValueError(f"content file not found: {source}")
    content = source.read_text(encoding="utf-8")
    if not content.strip():
        raise ValueError("content file is empty")

    folder_name = "Notes" if category == "note" else "Papers"
    folder = WORKS_DIR / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{title}.md"
    if target.exists():
        raise ValueError(f"work already exists: {target.relative_to(ROOT)}")
    shutil.copyfile(source, target)

    save_date(WORKS_DATES, f"{folder_name}/{target.name}", time_value)
    build()
    print(f"Added {target.relative_to(ROOT)}")


def migrate_work_dates() -> None:
    dates = read_dates(WORKS_DATES)
    changed = False
    for folder_name in ("Notes", "Papers"):
        folder = WORKS_DIR / folder_name
        if not folder.exists():
            continue
        for path in folder.glob("*.md"):
            explicit = f"{folder_name}/{path.name}"
            if explicit in dates:
                continue
            if path.name in dates:
                dates[explicit] = dates.pop(path.name)
                changed = True
    if changed:
        write_json(WORKS_DATES, dates)
        print("Migrated work date keys to category/filename format.")
    else:
        print("Work date keys already normalized.")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Manage personal-site content")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("build", help="regenerate data/*.json from source content")
    sub.add_parser("check", help="validate generated data, dates, and local asset refs")
    sub.add_parser("migrate-dates", help="normalize legacy work date keys")

    p_thought = sub.add_parser("add-thought", help="add a thought and rebuild data")
    p_thought.add_argument("text")
    p_thought.add_argument("--time", default=utc_now_iso())

    for name, category in (("add-note", "note"), ("add-paper", "paper")):
        p_work = sub.add_parser(name, help=f"add a {category} from a Markdown file")
        p_work.add_argument("title")
        p_work.add_argument("file", type=Path)
        p_work.add_argument("--time", default=utc_now_iso())

    args = parser.parse_args(argv)

    try:
        if args.command == "build":
            return 0 if build() else 1
        if args.command == "check":
            return 0 if check() else 1
        if args.command == "migrate-dates":
            migrate_work_dates()
            build()
            return 0
        if args.command == "add-thought":
            add_thought(args.text, args.time)
            return 0
        if args.command == "add-note":
            add_work("note", args.title, args.file, args.time)
            return 0
        if args.command == "add-paper":
            add_work("paper", args.title, args.file, args.time)
            return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
