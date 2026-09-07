# Xu-Jiaqi Personal Site

静态个人主页。当前同时部署在 GitHub Pages 和 `https://nansea.xyz/profile/`；cloud 上的工作目录为 `/home/ubuntu/profile`。

## 目录结构

| 路径 | 作用 |
|---|---|
| `_thoughts/*.txt` | Thought 源文件 |
| `_works/Notes/*.md` | Note 源文件 |
| `_works/Papers/*.md` | Paper 源文件 |
| `_dates/thoughts_dates.json` | Thought 发布时间 |
| `_dates/works_dates.json` | Work 发布时间，键格式为 `Notes/xxx.md` / `Papers/xxx.md` |
| `data/*.json` | **自动生成**，前端读取；不要手改 |
| `scripts/site.py` | 内容添加、构建和校验的统一入口 |
| `scripts/git_commit_push.sh` | 构建 + 校验 + commit + push |
| `css/style.css` | 全站样式 |
| `js/store.js` | 本地 JSON 数据读取与缓存 |
| `js/thoughts.js` | Thoughts 页面逻辑 |
| `js/works.js` | Works 页面逻辑 |

## 日常更新

### 添加 Thought

```bash
cd /home/ubuntu/profile
python3 scripts/site.py add-thought "内容"
./scripts/git_commit_push.sh -m "content: add thought"
```

### 添加 Note / Paper

先准备 Markdown 文件，然后：

```bash
python3 scripts/site.py add-note "标题" /path/to/note.md
python3 scripts/site.py add-paper "标题" /path/to/paper.md
./scripts/git_commit_push.sh -m "content: add work"
```

添加命令会自动写入日期并重新生成 `data/*.json`。

如需指定时间：

```bash
python3 scripts/site.py add-thought "内容" --time "2026-09-07T03:30:00Z"
```

## 修改已有内容

直接修改 `_thoughts/` 或 `_works/` 中的源文件，然后：

```bash
python3 scripts/site.py build
python3 scripts/site.py check
./scripts/git_commit_push.sh -m "content: update ..."
```

不要直接编辑 `data/thoughts.json` 或 `data/works.json`。

## 常用维护命令

```bash
# 从源文件重新生成前端数据
python3 scripts/site.py build

# 检查数据同步、日期、重复 ID 和本地资源引用
python3 scripts/site.py check

# 将旧版 work 日期键转换为 Notes/... / Papers/... 形式
python3 scripts/site.py migrate-dates
```

## 数据链路

```text
_thoughts / _works
       +
     _dates
       |
       v
scripts/site.py build
       |
       v
 data/*.json
       |
       v
   浏览器页面
```

`data/*.json` 中的 ID 使用稳定哈希生成，同一内容文件在不同机器、不同构建中保持一致。

## CI

`.github/workflows/build-site.yml` 在源内容、日期或构建脚本变化时：

1. 运行 `scripts/site.py build`
2. 运行 `scripts/site.py check`
3. 如果生成的数据变化，则由 GitHub Actions 自动提交 `data/*.json`

前端不再依赖 Gist；站点内容完全来自仓库内的静态 JSON。

## cloud 部署

Caddy 将 `/home/ubuntu/profile` 只读挂载到站点容器，因此 cloud 工作区中文件修改后会立即反映到 `https://nansea.xyz/profile/`。

正式发布前仍应执行 `scripts/site.py check` 并 push 到 GitHub，保证 cloud 与仓库一致。
