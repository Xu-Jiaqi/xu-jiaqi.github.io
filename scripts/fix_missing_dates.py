#!/usr/bin/env python3
"""
fix_missing_dates.py

Scan the personal site repo for thought/work files that are missing entries in the
_dates/*.json maps or that have missing `time` fields in data/*.json, and fill
in the current UTC time for any missing timestamps.

Intended to be run as part of the site build (pre-generation) to ensure every
published item has a canonical timestamp. Usage:

  python3 scripts/fix_missing_dates.py [--repo PATH] [--commit] [--push] [--dry-run]

Examples:
  # dry-run only, report what would change
  python3 scripts/fix_missing_dates.py --dry-run

  # apply changes and commit but do not push
  python3 scripts/fix_missing_dates.py --commit

  # apply, commit and push to origin/main
  python3 scripts/fix_missing_dates.py --commit --push

This script is idempotent: running it repeatedly without new missing entries
makes no changes.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def normalize_text(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def find_dates_for_files(repo: Path, files_dir: Path, dates_path: Path, now_iso: str, verbose=False) -> tuple[dict, list]:
    """Ensure each file under files_dir has an entry in dates_path map.
    Returns (dates_map, added_filenames)
    """
    added = []
    dates = load_json(dates_path, default={}) if dates_path else {}
    if not isinstance(dates, dict):
        dates = {}
    if not files_dir.exists():
        if verbose:
            print(f"Info: files directory not found: {files_dir}")
        return dates, added

    for p in sorted(files_dir.iterdir()):
        if not p.is_file():
            continue
        name = p.name
        if name not in dates or not dates.get(name):
            dates[name] = now_iso
            added.append(name)
            if verbose:
                print(f"Will add date for: {name} -> {now_iso}")
    return dates, added


def update_data_times_for_files(repo: Path, files_dir: Path, dates_map: dict, data_path: Path, now_iso: str, verbose=False) -> tuple[dict, int]:
    """Load data JSON and set time fields for entries matching files in files_dir.
    Matching strategy: exact equality between normalized file content and item['content'].
    If we cannot find a content match for a file, do NOT create new data items; but
    if a data item exists without a time and we cannot match it to a file, set its
    time to now_iso (best-effort).

    Returns (updated_data_obj, number_of_changes)
    """
    data = load_json(data_path, default={})
    changed = 0

    # load file contents map: content_normalized -> filename (first occurrence)
    file_content_map: dict[str, str] = {}
    if files_dir.exists():
        for p in sorted(files_dir.iterdir()):
            if not p.is_file():
                continue
            try:
                text = normalize_text(p.read_text(encoding="utf-8"))
            except Exception:
                text = ""
            if text and text not in file_content_map:
                file_content_map[text] = p.name

    # Work with lists inside data: the top-level key may vary (thoughts vs works)
    # If data is a dict with a single list value, detect it.
    list_key = None
    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, list):
                list_key = k
                break
    if list_key is None:
        # unexpected shape; nothing to do
        if verbose:
            print(f"Warning: unexpected data JSON shape in {data_path}")
        return data, changed

    items = data.get(list_key, [])
    for item in items:
        # item should be a dict
        if not isinstance(item, dict):
            continue
        cur_time = item.get("time")
        if cur_time:
            continue
        content = normalize_text(item.get("content", ""))
        assigned = False
        if content and content in file_content_map:
            fname = file_content_map[content]
            ts = dates_map.get(fname) or now_iso
            item["time"] = ts
            changed += 1
            assigned = True
            if verbose:
                print(f"Set time for data item (matched file {fname}) -> {ts}")
        else:
            # best-effort: set to now_iso
            item["time"] = now_iso
            changed += 1
            if verbose:
                print(f"Set time for data item (no file match) -> {now_iso}")
    data[list_key] = items
    return data, changed


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--repo", default="/home/nansea/User/SelfProfile", help="Site repo path")
    p.add_argument("--commit", action="store_true", help="Create git commit with changes")
    p.add_argument("--push", action="store_true", help="Push commit to origin/main (implies --commit)")
    p.add_argument("--dry-run", action="store_true", help="Show changes but do not write files")
    p.add_argument("--verbose", action="store_true", help="Verbose output")
    args = p.parse_args(argv)

    repo = Path(args.repo).expanduser().resolve()
    if not repo.exists():
        print(f"Error: repo path not found: {repo}")
        return 2

    now_iso = utc_now_iso()
    total_added = 0
    total_changed = 0

    # THOUGHTS
    thoughts_dir = repo / "_thoughts"
    thoughts_dates_path = repo / "_dates" / "thoughts_dates.json"
    data_thoughts_path = repo / "data" / "thoughts.json"

    thoughts_dates, added_thoughts = find_dates_for_files(repo, thoughts_dir, thoughts_dates_path, now_iso, verbose=args.verbose)
    if added_thoughts:
        total_added += len(added_thoughts)

    # update data/thoughts.json times
    data_thoughts, changed_thoughts = update_data_times_for_files(repo, thoughts_dir, thoughts_dates, data_thoughts_path, now_iso, verbose=args.verbose)
    total_changed += changed_thoughts

    # WORKS (Notes)
    works_notes_dir = None
    # try common locations
    for candidate in [repo / "_works" / "Notes", repo / "_works" / "notes"]:
        if candidate.exists():
            works_notes_dir = candidate
            break
    if works_notes_dir is None:
        works_notes_dir = repo / "_works" / "Notes"  # default

    works_dates_path = repo / "_dates" / "works_dates.json"
    data_works_path = repo / "data" / "works.json"

    works_dates, added_works = find_dates_for_files(repo, works_notes_dir, works_dates_path, now_iso, verbose=args.verbose)
    if added_works:
        total_added += len(added_works)

    data_works, changed_works = update_data_times_for_files(repo, works_notes_dir, works_dates, data_works_path, now_iso, verbose=args.verbose)
    total_changed += changed_works

    if args.dry_run:
        print("Dry-run: would add dates for files:")
        if added_thoughts:
            print("  thoughts:")
            for n in added_thoughts:
                print(f"    - {n} -> {now_iso}")
        if added_works:
            print("  works:")
            for n in added_works:
                print(f"    - {n} -> {now_iso}")
        print(f"Dry-run: would update {total_changed} data items with time fields")
        return 0

    # write back changes
    if added_thoughts:
        save_json(thoughts_dates_path, thoughts_dates)
        if args.verbose:
            print(f"Wrote {thoughts_dates_path}")
    if added_works:
        save_json(works_dates_path, works_dates)
        if args.verbose:
            print(f"Wrote {works_dates_path}")

    if total_changed:
        save_json(data_thoughts_path, data_thoughts)
        save_json(data_works_path, data_works)
        if args.verbose:
            print(f"Wrote {data_thoughts_path} and {data_works_path}")

    print(f"Done. Added {total_added} missing date entries; updated {total_changed} data items with time fields.")

    # git commit/push if requested
    if args.push:
        args.commit = True
    if args.commit:
        import subprocess
        try:
            # stage changes
            subprocess.check_call(["git", "add", "-A"], cwd=str(repo))
            # check if there is anything to commit
            status = subprocess.check_output(["git", "status", "--porcelain"], cwd=str(repo)).decode().strip()
            if not status:
                print("No changes to commit.")
            else:
                msg = f"Fix missing dates: added {total_added} dates and set {total_changed} item times"
                subprocess.check_call(["git", "commit", "-m", msg], cwd=str(repo))
                print("Committed changes: ", msg)
                if args.push:
                    subprocess.check_call(["git", "push", "origin", "main"], cwd=str(repo))
                    print("Pushed to origin/main")
        except subprocess.CalledProcessError as e:
            print("Git operation failed:", e)
            return 3

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted")
        raise
