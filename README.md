# xu-jiaqi.github.io — Blog / Thoughts 管理与发布说明

## 概述
本仓库承载个人网站（xu-jiaqi.github.io）的内容与发布链路。本说明聚焦“Thoughts / Notes” 的写入、同步与发布流程，旨在保证在本地编辑后能稳健地生成前端需要的数据文件、推送到远端并验证 GitHub Pages 部署成功，避免常见错误（改错目录、推错分支、workflow 失败、页面缓存等）。

主要目标
- 提供一套可重复、可验证的“写作 → 数据更新 → 提交 → 推送 → 验证”流程
- 明确关键文件与数据链路，保证前端能正确读取最新内容
- 给出常见故障的排查与修复步骤

## 约定（重要）
- 本地仓库路径（约定）：
  `/home/nansea/User/SelfProfile`
- 远程仓库：
  `git@github.com:Xu-Jiaqi/xu-jiaqi.github.io.git`
- 发布分支：`main`
- 不要在 `~/.openclaw/workspace` 或其他非 SelfProfile 目录直接修改站点源码。所有发布类修改都应在 SelfProfile 仓库内完成。

## 项目结构与关键文件
- `_thoughts/`
  - 原始的 thoughts 文本文件，格式：`NNN.txt`（NNN 为序号或唯一 id）。
- `_works/Notes/`
  - Notes 的 Markdown 文件，按标题或时间分文件存放。
- `_dates/`
  - `thoughts_dates.json`：mapping（文件名 → UTC 时间），用于记录创建/发布时间。
  - `works_dates.json`：对应 works/notes 的时间索引。
- `data/`
  - `thoughts.json`：前端优先读取的聚合数据（经过脚本处理、排序、裁剪后的 JSON），必须在发布流程中被同步更新。
  - `works.json`：前端显示的 works/notes 数据入口。
- `scripts/`
  - `add_thought.py`：将新 thought 写入 `_thoughts`，更新 `_dates/thoughts_dates.json` 与 `data/thoughts.json`，commit → push（可选）。
  - `add_note.py`：创建 note Markdown，更新日期索引与 `data/works.json`，默认提交并推送；支持 `--local-only`（仅本地写入、不 push）。
  - `verify_publish.py`：发布后验证脚本，检查 GitHub Actions（Sync to Gist、pages-build-deployment）、检查 raw/main/data/thoughts.json 或线上 `https://<site>/data/thoughts.json` 是否包含期望条目。
- `references/site-architecture.md`：站点架构与说明，包含前端数据读取优先级说明。

## 常用脚本与示例命令（推荐流程）
1. 发布一个 Thought（推荐流程 — 自动 commit/push 并验证）：
   ```bash
   python3 /home/nansea/User/SelfProfile/scripts/add_thought.py "开始做是学习的第一步" --repo /home/nansea/User/SelfProfile --push
   ```
2. 添加一个 Note（本地或推送）：
   ```bash
   python3 scripts/add_note.py "内容" --local-only
   ```
3. 发布后验证（强烈建议）：
   ```bash
   python3 scripts/verify_publish.py --repo /home/nansea/User/SelfProfile --expect "开始做是学习的第一步"
   ```

## 数据链路详解
前端优先读取 `data/thoughts.json`，这是一个经过聚合与格式化的 JSON，便于客户端快速渲染。每次写入必须同时维护：
1. `_thoughts/`（原始）
2. `_dates/thoughts_dates.json`（时间索引）
3. `data/thoughts.json`（前端数据）

## CI / Actions 流程（典型故障点）
- 常见 Actions 名称：
  - `Sync to Gist`（把 data/* 同步到 Gist）
  - `pages-build-deployment`（Pages 构建与部署）
- 排查顺序（当 Pages 没更新时）：
  1. `gh run list --limit 10`
  2. `gh run view <run-id> --log-failed`
  3. 修 workflow 后 push 到 main
  4. 必要时手动触发：`gh workflow run "Sync to Gist" --ref main`

## 常见坑与防范
- 错把修改写到 `~/.openclaw/workspace` 的 skills 目录下 → 一定要在 SelfProfile 仓库操作
- 推到 `master` 分支（而站点使用 `main`） → 检查 git branch 与推送目标
- 只更新 `_thoughts`，未同步 `data/thoughts.json` → 前端不会显示
- Workflow 语法错误 → 查看 Action 日志并修复

## 调试范例（快速命令）
- 查看最近 10 次 Actions：
  ```bash
  gh run list --limit 10
  ```
- 获取失败 run 的日志：
  ```bash
  gh run view <run-id> --log-failed
  ```
- 检查线上 data 文件：
  ```bash
  curl -s https://xu-jiaqi.github.io/data/thoughts.json | jq '. | length, .[0]'
  ```

## 自动化与改进建议
- 将 `add_thought.py` 与 `verify_publish.py` 打包为一个复合命令：写入 → push → 等待 Actions → 验证
- 增加 pre-push 本地检查（validate data/thoughts.json 格式）
- 在仓库中加入 `CONTRIBUTING.md`，明确写作与发布流程
- 在 OpenClaw 中创建一个 skill，快速触发 `add_thought` 与 `verify_publish`

## 变更记录与维护
- 在 README 顶部或仓库 Releases 中记录重要变更（脚本重构、workflow 修改、数据格式变更等）

## 故障示例与修复指南（举例）
- 验证脚本报告线上 JSON 不包含新条目：检查本地 data、确认已 push、检查 Actions 是否成功、清理缓存或访问 raw GitHub URL

## 常用联系人 / 资源
- 站点前端/架构说明： `references/site-architecture.md`
- 发布脚本目录： `scripts/`
- Skill 说明（OpenClaw）： `~/.openclaw/workspace/skills/blog-thoughts/SKILL.md`

---
