# xu-jiaqi.github.io

个人网站内容管理与发布。

## 仓库

- 本地：`/home/nansea/User/SelfProfile`
- 远程：`git@github.com:Xu-Jiaqi/xu-jiaqi.github.io.git`（分支：`main`）

## 关键文件

| 路径 | 用途 |
|------|------|
| `_thoughts/NNN.txt` | Thought 原文 |
| `_works/Notes/*.md` | Note 原文 |
| `_dates/thoughts_dates.json` | 文件名 → UTC 时间 |
| `_dates/works_dates.json` | 同上（Notes） |
| `data/thoughts.json` | **前端读取入口** |
| `data/works.json` | Notes 前端入口 |
| `scripts/add_thought.py` | 发布 Thought（自动更新三处 + commit/push） |
| `scripts/add_note.py` | 发布 Note（同上，支持 --local-only） |
| `scripts/verify_publish.py` | 发布后检查 Actions + 线上数据 |

## 常用命令

```bash
# 发 Thought
python3 scripts/add_thought.py "内容" --push

# 发 Note
python3 scripts/add_note.py "内容"

# 验证
python3 scripts/verify_publish.py --expect "内容"
```

## 数据链路

每次发布必须同步更新三处：`_thoughts/` → `_dates/` → `data/`。前端优先读 `data/thoughts.json`。

## CI

- `Sync to Gist`：push 后自动同步 data 到 Gist
- `pages-build-deployment`：自动构建部署
- 排查：`gh run list --limit 10` → `gh run view <id> --log-failed`

## 常见坑

1. 在错误目录操作（必须在 SelfProfile）
2. 只更新 `_thoughts` 忘了 `data/thoughts.json`
3. workflow 回退用 `os.path.getmtime()` 产生 Unix 时间戳 → 前端 `new Date()` 解析错误
