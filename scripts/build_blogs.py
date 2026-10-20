#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOGS = ROOT / "blogs"
OUT = ROOT / "data" / "blogs.json"


def title_of(text: str, fallback: str) -> str:
    for line in text.splitlines():
        match = re.match(r"^#\s+(.+?)\s*$", line)
        if match:
            return match.group(1).strip()
    return fallback


def excerpt_of(text: str) -> str:
    lines = []
    in_math = False
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("$$"):
            in_math = not in_math
            continue
        if in_math or not line or line.startswith("#") or line.startswith("[^"):
            continue
        if line.startswith(("~~~", "|")):
            continue
        lines.append(line)
        if len(" ".join(lines)) >= 220:
            break
    plain = " ".join(lines)
    plain = re.sub(r"\$[^$]+\$", "", plain)
    plain = re.sub(r"\[\^[^\]]+\]", "", plain)
    plain = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", plain)
    plain = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", plain)
    plain = re.sub(r"[*_>~]", "", plain)
    plain = re.sub(r"\s+", " ", plain).strip()
    return plain if len(plain) <= 180 else plain[:177].rstrip() + "…"


def main() -> None:
    BLOGS.mkdir(parents=True, exist_ok=True)
    items = []
    for path in BLOGS.rglob("*.md"):
        if not path.is_file():
            continue
        rel = path.relative_to(BLOGS).as_posix()
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            continue
        mtime = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
        items.append({
            "path": rel,
            "title": title_of(text, path.stem),
            "excerpt": excerpt_of(text),
            "modified": mtime.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        })
    items.sort(key=lambda x: (x["modified"], x["title"]), reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"blogs": items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(items)} posts)")


if __name__ == "__main__":
    main()
