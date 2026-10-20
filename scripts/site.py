#!/usr/bin/env python3
"""Build and validate the synchronized personal-site content."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CONTENT_DATES = ROOT / "_dates" / "content_dates.json"
KINDS = ("blogs", "notes", "works", "thoughts")
SOURCE_DIRS = {kind: ROOT / kind for kind in KINDS}
DATA_FILES = {kind: DATA_DIR / f"{kind}.json" for kind in KINDS}


def parse_iso(value: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"invalid ISO timestamp: {value!r}") from exc
    if dt.tzinfo is None:
        raise ValueError(f"timestamp must include timezone: {value!r}")
    return dt


def iso_from_mtime(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).replace(
        microsecond=0
    ).isoformat().replace("+00:00", "Z")


def load_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def stable_id(key: str) -> int:
    digest = hashlib.blake2b(key.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") % 1_000_000_000_000


def source_files(kind: str) -> list[Path]:
    root = SOURCE_DIRS[kind]
    if not root.exists():
        return []
    suffixes = {".md", ".pdf"} if kind == "works" else {".md"}
    return sorted(
        path for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in suffixes
    )


def content_key(kind: str, path: Path) -> str:
    return f"{kind}/{path.relative_to(SOURCE_DIRS[kind]).as_posix()}"


def read_dates() -> dict[str, str]:
    dates = load_json(CONTENT_DATES, {})
    if not isinstance(dates, dict):
        raise ValueError("_dates/content_dates.json must contain a JSON object")
    for value in dates.values():
        parse_iso(value)
    return dates


def ensure_dates(write: bool) -> dict[str, str]:
    dates = read_dates()
    changed = False
    valid = set()
    for kind in KINDS:
        for path in source_files(kind):
            key = content_key(kind, path)
            valid.add(key)
            if key not in dates:
                dates[key] = iso_from_mtime(path)
                changed = True
    stale = set(dates) - valid
    for key in stale:
        dates.pop(key, None)
        changed = True
    if changed and write:
        write_json(CONTENT_DATES, dict(sorted(dates.items())))
    return dates


def title_of(content: str, fallback: str) -> str:
    for line in content.splitlines():
        if line.startswith("# "):
            title = line[2:].strip()
            if title:
                return title
    return fallback


def plain_excerpt(content: str, limit: int = 180) -> str:
    lines: list[str] = []
    in_fence = False
    in_math = False
    fence = chr(96) * 3
    for raw in content.splitlines():
        line = raw.strip()
        if line.startswith(fence):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if line.startswith("$$"):
            in_math = not in_math
            continue
        if in_math or not line or line.startswith(("#", "[^")):
            continue
        lines.append(line)
        if len(" ".join(lines)) >= limit + 40:
            break
    plain = " ".join(lines)
    plain = re.sub(r"\$[^$]+\$", "", plain)
    plain = re.sub(r"\[\^[^\]]+\]", "", plain)
    plain = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", plain)
    plain = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", plain)
    plain = re.sub(r"[*_>~]", "", plain)
    plain = re.sub(r"\s+", " ", plain).strip()
    return plain if len(plain) <= limit else plain[: limit - 1].rstrip() + "…"


def thought_preview_fields(content: str) -> tuple[str | None, str]:
    paragraphs = [part.strip() for part in content.split("\n\n") if part.strip()]
    is_long = len(content) > 220 or len(paragraphs) > 1
    if not is_long:
        return None, content
    title = paragraphs[0] if paragraphs else None
    if title and title.startswith("# "):
        title = title[2:].strip()
    body = paragraphs[1] if len(paragraphs) > 1 else content
    return title, plain_excerpt(body, 150)


def build_items(dates: dict[str, str]) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {kind: [] for kind in KINDS}
    for kind in KINDS:
        for path in source_files(kind):
            key = content_key(kind, path)
            date = dates.get(key)
            if not date:
                raise ValueError(f"missing date for {key}")
            parse_iso(date)
            rel = path.relative_to(SOURCE_DIRS[kind]).as_posix()
            is_pdf = kind == "works" and path.suffix.lower() == ".pdf"
            content = "" if is_pdf else path.read_text(encoding="utf-8").strip()
            if not is_pdf and not content:
                raise ValueError(f"empty content: {key}")
            if kind == "blogs":
                result[kind].append({
                    "path": rel,
                    "title": title_of(content, path.stem),
                    "excerpt": plain_excerpt(content),
                    "modified": date,
                })
            elif kind == "thoughts":
                title, excerpt = thought_preview_fields(content)
                result[kind].append({
                    "id": stable_id(f"thought:{rel}"),
                    "path": rel,
                    "title": title,
                    "excerpt": excerpt,
                    "content": content,
                    "time": date,
                })
            elif kind == "works" and is_pdf:
                result[kind].append({
                    "id": stable_id(f"work:{rel}"),
                    "path": rel,
                    "title": path.stem,
                    "format": "pdf",
                    "url": f"works/{rel}",
                    "time": date,
                })
            else:
                item = {
                    "id": stable_id(f"{kind}:{rel}"),
                    "path": rel,
                    "title": title_of(content, path.stem),
                    "content": content,
                    "time": date,
                }
                if kind == "works":
                    item["format"] = "md"
                result[kind].append(item)
    for kind in KINDS:
        field = "modified" if kind == "blogs" else "time"
        result[kind].sort(key=lambda item: parse_iso(item[field]), reverse=True)
    return result


def expected_data(write_dates: bool) -> dict[Path, dict]:
    items = build_items(ensure_dates(write=write_dates))
    return {DATA_FILES[kind]: {kind: items[kind]} for kind in KINDS}


def build(check_only: bool = False) -> bool:
    ok = True
    for path, value in expected_data(write_dates=not check_only).items():
        expected = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        actual = path.read_text(encoding="utf-8") if path.exists() else ""
        if actual == expected:
            print(f"OK   {path.relative_to(ROOT)}")
        elif check_only:
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
        self.refs: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        attrs = dict(attrs)
        if tag in {"a", "link"} and attrs.get("href"):
            self.refs.append(attrs["href"])
        if tag in {"script", "img"} and attrs.get("src"):
            self.refs.append(attrs["src"])


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
        for ref in parser.refs:
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


def check() -> bool:
    errors: list[str] = []
    try:
        if not build(check_only=True):
            errors.append("generated data is not synchronized")
        errors.extend(check_assets())
        ids: list[int] = []
        for kind in ("notes", "works", "thoughts"):
            payload = load_json(DATA_FILES[kind], {}).get(kind, [])
            ids.extend(item.get("id") for item in payload)
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


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Manage synchronized personal-site content")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("build", help="regenerate data/*.json from Markdown mirrors")
    sub.add_parser("check", help="validate generated data and local asset refs")
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            return 0 if build() else 1
        if args.command == "check":
            return 0 if check() else 1
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
