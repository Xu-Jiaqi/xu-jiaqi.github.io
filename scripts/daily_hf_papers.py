#!/usr/bin/env python3
"""
每日 Hugging Face 论文简报（纯文本）
来源： https://huggingface.co/papers/date/YYYY-MM-DD

功能：
1) 拉取指定日期页面并解析内嵌 data-props JSON
2) 按热度（upvotes + comments）筛选前 N 篇（默认 5）
3) 为每篇生成三句话：问题 / 方法 / 有趣发现
4) 输出纯文本，可直接发送到 QQ
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

TZ_SHANGHAI = timezone(timedelta(hours=8))


def now_date_shanghai() -> str:
    return datetime.now(TZ_SHANGHAI).strftime("%Y-%m-%d")


def fetch_text(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Norsky Daily Papers Bot)",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def extract_page_props(page_html: str) -> Dict[str, Any]:
    # Hugging Face 页面会把关键数据塞进 data-props 里（HTML 实体编码）
    candidates = re.findall(r'data-props="([^"]+)"', page_html)
    if not candidates:
        raise ValueError("页面中未找到 data-props")

    for raw in sorted(candidates, key=len, reverse=True):
        try:
            obj = json.loads(html.unescape(raw))
            if isinstance(obj, dict) and "dailyPapers" in obj:
                return obj
        except Exception:
            continue

    raise ValueError("未能从 data-props 解析出 dailyPapers")


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text


def split_sentences(text: str) -> List[str]:
    text = clean_text(text)
    if not text:
        return []

    parts = re.split(r"(?<=[.!?。！？])\s+", text)
    if len(parts) <= 1:
        parts = re.split(r"[;；]\s*", text)

    return [clean_text(p).strip("。.!? ") for p in parts if clean_text(p)]


def pick_sentence(parts: List[str], keywords: List[str], used: set) -> str:
    for s in parts:
        low = s.lower()
        if s in used:
            continue
        if any(k in low for k in keywords):
            used.add(s)
            return s

    for s in parts:
        if s not in used:
            used.add(s)
            return s

    return ""


def shorten(text: str, max_len: int = 120) -> str:
    text = clean_text(text)
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def to_three_lines(summary: str, title: str) -> Dict[str, str]:
    parts = split_sentences(summary)
    used = set()

    problem = pick_sentence(
        parts,
        ["problem", "challenge", "struggle", "difficulty", "limited", "bottleneck", "缺", "难", "问题"],
        used,
    )
    method = pick_sentence(
        parts,
        ["we propose", "we present", "we introduce", "framework", "method", "approach", "pipeline", "architecture", "模型", "方法"],
        used,
    )
    finding = pick_sentence(
        parts,
        ["improve", "outperform", "gain", "result", "benchmark", "achieve", "show", "demonstrate", "效果", "提升"],
        used,
    )

    if not problem:
        problem = f"该工作围绕“{title}”展开，重点解决相关任务中的关键瓶颈。"
    if not method:
        method = "作者提出了新的模型或训练策略来提升任务表现。"
    if not finding:
        finding = "实验结果显示方法具备较好的泛化能力或实用价值。"

    # 中文包装成三句话，内部可保留英文术语
    return {
        "problem": shorten(f"主要问题：{problem}"),
        "method": shorten(f"核心方法：{method}"),
        "finding": shorten(f"有趣发现：{finding}"),
    }


def parse_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def select_top_papers(page_props: Dict[str, Any], top_n: int = 5) -> List[Dict[str, Any]]:
    rows = page_props.get("dailyPapers") or []
    papers: List[Dict[str, Any]] = []

    for row in rows:
        paper = row.get("paper") or {}
        paper_id = paper.get("id")
        title = clean_text(row.get("title") or paper.get("title") or "(无标题)")
        summary = clean_text(row.get("summary") or paper.get("summary") or "")
        upvotes = parse_int(paper.get("upvotes"), 0)
        comments = parse_int(row.get("numComments"), 0)

        if not paper_id:
            continue

        score = upvotes * 100 + comments * 5
        papers.append(
            {
                "id": paper_id,
                "title": title,
                "summary": summary,
                "upvotes": upvotes,
                "comments": comments,
                "score": score,
                "url": f"https://huggingface.co/papers/{paper_id}",
            }
        )

    papers.sort(key=lambda x: (x["score"], x["upvotes"], x["comments"]), reverse=True)
    return papers[:top_n]


def build_report(date_str: str, selected: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    lines.append(f"Hugging Face 热点论文简报 {date_str}")
    lines.append(f"数据来源 https://huggingface.co/papers/date/{date_str}")

    if not selected:
        lines.append("今天没有抓到可用论文数据，可能页面尚未更新或网络波动。")
        lines.append("我会在下次定时任务继续尝试。")
        return "\n".join(lines)

    lines.append(f"已筛选 {len(selected)} 篇（按热度排序）")

    for i, item in enumerate(selected, start=1):
        triple = to_three_lines(item.get("summary", ""), item.get("title", ""))
        lines.append("")
        lines.append(f"第{i}篇 {item['title']}")
        lines.append(f"链接 {item['url']}")
        lines.append(triple["problem"])
        lines.append(triple["method"])
        lines.append(triple["finding"])

    return "\n".join(lines)


def save_local_copy(date_str: str, content: str) -> str:
    out_dir = os.path.expanduser("~/.openclaw/workspace/schedules")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"hf_daily_{date_str}.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate daily HF papers report")
    parser.add_argument("--date", help="Date in YYYY-MM-DD, default Asia/Shanghai today")
    parser.add_argument("--top", type=int, default=5, help="How many papers to keep")
    parser.add_argument("--json", action="store_true", help="Print selected papers in JSON")
    parser.add_argument("--no-save", action="store_true", help="Do not save local copy")
    args = parser.parse_args()

    date_str = args.date or now_date_shanghai()
    page_url = f"https://huggingface.co/papers/date/{date_str}"

    try:
        page_html = fetch_text(page_url)
        props = extract_page_props(page_html)
        selected = select_top_papers(props, top_n=max(1, args.top))
    except Exception as e:
        # 降级报告：不能直接崩溃
        fallback = (
            f"Hugging Face 热点论文简报 {date_str}\n"
            f"数据来源 {page_url}\n"
            f"抓取失败：{e}\n"
            "可能是网络抖动或页面结构变化，我会在下一次任务继续尝试。"
        )
        print(fallback)
        if not args.no_save:
            save_local_copy(date_str, fallback)
        return 0

    if args.json:
        print(json.dumps({"date": date_str, "papers": selected}, ensure_ascii=False, indent=2))
        return 0

    report = build_report(date_str, selected)
    print(report)

    if not args.no_save:
        save_local_copy(date_str, report)

    return 0


if __name__ == "__main__":
    sys.exit(main())
