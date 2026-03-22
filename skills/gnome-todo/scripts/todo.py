#!/usr/bin/env python3
"""Todo manager with robust Chinese time parsing and safe legacy-data handling."""

import argparse
import json
import re
import subprocess
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple

import dateparser

TODO_FILE = Path.home() / ".openclaw/workspace/skills/gnome-todo/todos.json"
NAPCAT_API = "http://127.0.0.1:15150/send_private_msg"
QQ_USER_ID = 3228996679
LOCAL_TZ = "Asia/Shanghai"


def now_local() -> datetime:
    return datetime.now()


def load_todos() -> list:
    if not TODO_FILE.exists():
        return []
    try:
        with TODO_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def save_todos(todos: list) -> None:
    TODO_FILE.parent.mkdir(parents=True, exist_ok=True)
    with TODO_FILE.open("w", encoding="utf-8") as f:
        json.dump(todos, f, ensure_ascii=False, indent=2)


def is_time_tbd(text: str) -> bool:
    if not text:
        return True
    s = text.strip()
    return s in {"时间未定", "待定", "再说", "以后", "未定"}


def parse_iso_like(due_time: str) -> Optional[datetime]:
    if not due_time or is_time_tbd(due_time):
        return None
    s = due_time.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def normalize_cn_time_expr(expr: str) -> str:
    s = expr.strip()

    # 先处理“X点半”
    s = re.sub(r"(\d{1,2})\s*点\s*半", r"\1:30", s)

    # 处理“X点Y分”
    s = re.sub(r"(\d{1,2})\s*点\s*(\d{1,2})\s*分", r"\1:\2", s)

    # 处理“X点”
    s = re.sub(r"(\d{1,2})\s*点", r"\1:00", s)

    # 常见中文词汇替换，帮助 dateparser
    replacements = {
        "明天": "tomorrow",
        "今天": "today",
        "后天": "day after tomorrow",
        "早上": "morning",
        "上午": "morning",
        "中午": "noon",
        "下午": "afternoon",
        "傍晚": "evening",
        "晚上": "evening",
        "今晚": "this evening",
        "明晚": "tomorrow evening",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)

    return s


def extract_explicit_hm(text: str) -> Optional[Tuple[int, int]]:
    m = re.search(r"(\d{1,2})[:：](\d{1,2})", text)
    if not m:
        return None
    h = int(m.group(1))
    minute = int(m.group(2))
    if 0 <= h <= 23 and 0 <= minute <= 59:
        return h, minute
    return None


def apply_period_hint(hour: int, original_text: str) -> int:
    txt = original_text
    if any(k in txt for k in ["下午", "晚上", "傍晚", "今晚", "明晚"]):
        if 1 <= hour <= 11:
            return hour + 12
    if any(k in txt for k in ["凌晨"]):
        if hour == 12:
            return 0
    return hour


def parse_weekday_expr(expr: str, now: datetime) -> Optional[datetime]:
    weekday_map = {
        "周一": 0,
        "星期一": 0,
        "周二": 1,
        "星期二": 1,
        "周三": 2,
        "星期三": 2,
        "周四": 3,
        "星期四": 3,
        "周五": 4,
        "星期五": 4,
        "周六": 5,
        "星期六": 5,
        "周日": 6,
        "周天": 6,
        "星期日": 6,
        "星期天": 6,
    }

    day_key = None
    target_weekday = None
    for k, v in weekday_map.items():
        if k in expr:
            day_key = k
            target_weekday = v
            break

    if target_weekday is None:
        return None

    days_ahead = (target_weekday - now.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7

    target = now + timedelta(days=days_ahead)

    hm = extract_explicit_hm(normalize_cn_time_expr(expr))
    if hm:
        h, minute = hm
        h = apply_period_hint(h, expr)
    else:
        if any(k in expr for k in ["早上", "上午"]):
            h, minute = 8, 0
        elif "中午" in expr:
            h, minute = 12, 0
        elif "下午" in expr:
            h, minute = 14, 0
        elif any(k in expr for k in ["晚上", "傍晚", "今晚", "明晚"]):
            h, minute = 20, 0
        else:
            h, minute = 20, 0

    return target.replace(hour=h, minute=minute, second=0, microsecond=0)


def parse_time(time_str: str) -> Tuple[Optional[datetime], int]:
    now = now_local()
    text = (time_str or "").strip()

    if is_time_tbd(text):
        return None, 60

    # 半小时后
    if re.search(r"半\s*小时后", text):
        return now + timedelta(minutes=30), 60

    # X分钟后
    m = re.search(r"(\d+)\s*分钟后", text)
    if m:
        return now + timedelta(minutes=int(m.group(1))), 60

    # X小时后
    m = re.search(r"(\d+)\s*小时后", text)
    if m:
        return now + timedelta(hours=int(m.group(1))), 60

    # X天后
    m = re.search(r"(\d+)\s*天后", text)
    if m:
        d = now + timedelta(days=int(m.group(1)))
        if hm := extract_explicit_hm(normalize_cn_time_expr(text)):
            h, minute = hm
            h = apply_period_hint(h, text)
            return d.replace(hour=h, minute=minute, second=0, microsecond=0), 60
        return d.replace(hour=20, minute=0, second=0, microsecond=0), 60

    # 星期几优先独立解析
    weekday_dt = parse_weekday_expr(text, now)
    if weekday_dt is not None:
        return weekday_dt, 60

    # 通用 dateparser
    normalized = normalize_cn_time_expr(text)
    parsed = dateparser.parse(
        normalized,
        languages=["zh", "en"],
        settings={
            "TIMEZONE": LOCAL_TZ,
            "RETURN_AS_TIMEZONE_AWARE": False,
            "PREFER_DATES_FROM": "future",
            "DATE_ORDER": "YMD",
        },
    )

    if parsed is not None:
        # 如果用户写了明确时分，应用时段提示
        hm = extract_explicit_hm(normalized)
        if hm:
            h, minute = hm
            h = apply_period_hint(h, text)
            parsed = parsed.replace(hour=h, minute=minute)

        # 只有日期无时间时，按语义补默认时分
        if hm is None:
            if any(k in text for k in ["早上", "上午"]):
                parsed = parsed.replace(hour=8, minute=0)
            elif "中午" in text:
                parsed = parsed.replace(hour=12, minute=0)
            elif "下午" in text:
                parsed = parsed.replace(hour=14, minute=0)
            elif any(k in text for k in ["晚上", "傍晚", "今晚", "明晚"]):
                parsed = parsed.replace(hour=20, minute=0)

        parsed = parsed.replace(second=0, microsecond=0)

        # 避免落在过去
        if parsed < now:
            parsed = parsed + timedelta(days=1)

        return parsed, 60

    # 兜底：1小时后
    return now + timedelta(hours=1), 60


def format_due_time(todo: dict) -> str:
    due_raw = todo.get("due_time", "")
    due = parse_iso_like(due_raw)
    if due is None:
        return "时间未定"
    return due.strftime("%m.%d %H:%M")


def todo_sort_key(todo: dict):
    due = parse_iso_like(todo.get("due_time", ""))
    if due is None:
        return (1, datetime.max)
    return (0, due)


def add_todo(title: str, time_str: str, duration_minutes: int = 60) -> Tuple[Optional[datetime], str]:
    todos = load_todos()
    due_time, _ = parse_time(time_str)

    todo = {
        "id": str(int(time.time())),
        "title": title.strip(),
        "due_time": due_time.isoformat() if due_time else "时间未定",
        "duration": max(1, int(duration_minutes)),
        "created_at": now_local().isoformat(),
        "notified": False,
        "time_tbd": due_time is None,
    }

    todos.append(todo)
    save_todos(todos)
    return due_time, todo["id"]


def list_todos() -> str:
    todos = load_todos()
    pending = [t for t in todos if not t.get("notified", False)]
    done = [t for t in todos if t.get("notified", False)]

    pending.sort(key=todo_sort_key)
    done.sort(key=lambda t: t.get("created_at", ""), reverse=True)

    lines = []
    if pending:
        lines.append("待办事项")
        now = now_local()
        for i, todo in enumerate(pending, 1):
            title = todo.get("title", "未命名任务")
            due = parse_iso_like(todo.get("due_time", ""))
            if due is None:
                due_text = "时间未定"
            else:
                overdue = "（已过期）" if due < now else ""
                due_text = f"{due.strftime('%m.%d %H:%M')}{overdue}"
            lines.append(f"{i}. {title}")
            lines.append(f"   {due_text}  id={todo.get('id', '')}")
    else:
        lines.append("没有未完成待办")

    if done:
        lines.append("")
        lines.append("已提醒")
        for todo in done[:20]:
            title = todo.get("title", "未命名任务")
            lines.append(f"✓ {title}")

    return "\n".join(lines)


def remove_todo(identifier: str) -> Tuple[bool, Optional[str]]:
    todos = load_todos()

    # 先按 id 删除
    for i, todo in enumerate(todos):
        if str(todo.get("id")) == str(identifier):
            title = todo.get("title", "")
            del todos[i]
            save_todos(todos)
            return True, title

    # 再按未完成列表序号删除
    if str(identifier).isdigit():
        idx = int(identifier)
        pending = [t for t in todos if not t.get("notified", False)]
        pending.sort(key=todo_sort_key)
        if 1 <= idx <= len(pending):
            target = pending[idx - 1]
            target_id = target.get("id")
            title = target.get("title", "")
            todos = [t for t in todos if str(t.get("id")) != str(target_id)]
            save_todos(todos)
            return True, title

    return False, None


def send_qq_message(message: str) -> bool:
    try:
        data = json.dumps({
            "user_id": QQ_USER_ID,
            "message": message,
            "auto_escape": False,
        }).encode("utf-8")
        req = urllib.request.Request(
            NAPCAT_API,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception:
        return False


def send_desktop_notification(title: str, body: str) -> bool:
    try:
        subprocess.run(["notify-send", title, body], check=False)
        return True
    except Exception:
        return False


def check_due() -> list:
    todos = load_todos()
    now = now_local()
    notified_titles = []
    changed = False

    for todo in todos:
        if todo.get("notified", False):
            continue

        due = parse_iso_like(todo.get("due_time", ""))
        if due is None:
            continue

        diff_min = (due - now).total_seconds() / 60.0

        # 提前5分钟到延后1分钟都触发一次，提升鲁棒性
        if -1 <= diff_min <= 5:
            title = todo.get("title", "未命名任务")
            msg = f"提醒：{title}，时间 {due.strftime('%H:%M')}"

            qq_ok = send_qq_message(msg)
            desktop_ok = send_desktop_notification("待办提醒", msg)

            # 任一渠道成功就标记，避免重复刷屏
            if qq_ok or desktop_ok:
                todo["notified"] = True
                changed = True
                notified_titles.append(title)

    if changed:
        save_todos(todos)

    return notified_titles


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("list")
    subparsers.add_parser("check")

    add_parser = subparsers.add_parser("add")
    add_parser.add_argument("title")
    add_parser.add_argument("time")
    add_parser.add_argument("--duration", "-d", type=int, default=60)

    rm_parser = subparsers.add_parser("rm")
    rm_parser.add_argument("id", help="任务ID或未完成列表序号")

    args = parser.parse_args()

    if args.command == "add":
        due_time, todo_id = add_todo(args.title, args.time, args.duration)
        if due_time is None:
            print(f"已添加: {args.title} @ 时间未定 (id={todo_id})")
        else:
            print(f"已添加: {args.title} @ {due_time.strftime('%Y年%m月%d日 %H:%M')} (id={todo_id})")

    elif args.command == "list":
        print(list_todos())

    elif args.command == "rm":
        ok, title = remove_todo(args.id)
        if ok:
            print(f"已删除: {title}")
        else:
            print("未找到要删除的任务")

    elif args.command == "check":
        notified = check_due()
        if notified:
            print("已提醒: " + ", ".join(notified))
        else:
            print("暂无需要提醒的任务")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
