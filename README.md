# Xu-Jiaqi Personal Site

静态个人主页，线上地址：https://nansea.xyz/profile/。

## 内容源

日常内容的主目录在 nansea-ms：

    ~/Documents/Share/Profile/
    ├── blogs/
    ├── notes/
    ├── works/
    └── thoughts/

同步规则：blogs/、notes/、thoughts/ 只同步 Markdown (*.md)；works/ 同步 Markdown (*.md) 和 PDF (*.pdf / *.PDF)。

- blogs/：完整博客、研究长文
- notes/：长笔记、摘记、保留片段
- works/：真正的项目与作品；可直接放 Markdown 或 PDF
- thoughts/：短想法和随手记录

网页仓库中的同名目录是同步镜像，不应作为日常编辑入口。

## 自动同步

nansea-ms 上运行 profile-content-sync.service。它递归监听 ~/Documents/Share/Profile。文件发生变化后：

1. 同步 Blogs / Notes / Thoughts 中的 *.md，以及 Works 中的 *.md / *.pdf / *.PDF
2. 镜像到 cloud:/home/ubuntu/profile/{blogs,notes,works,thoughts}/
3. 运行 python3 scripts/site.py build
4. 更新 data/blogs.json、data/notes.json、data/works.json、data/thoughts.json

删除本地对应内容文件也会同步删除网页镜像。

手动同步：

    ~/bin/sync-profile-content

查看状态：

    systemctl --user status profile-content-sync.service

## 日期

发布时间保存在 _dates/content_dates.json。

已有内容保留原日期。新文件第一次进入同步镜像时，以文件修改时间初始化日期；之后日期保持稳定。

## 构建与检查

    python3 scripts/site.py build
    python3 scripts/site.py check

数据链路：

    ~/Documents/Share/Profile/*
              ↓
        Markdown-only sync
              ↓
    blogs / notes / works / thoughts
              +
    _dates/content_dates.json
              ↓
     scripts/site.py build
              ↓
          data/*.json
              ↓
            Browser

## 页面

- profile.html — Profile
- thoughts.html — Thoughts
- blogs.html — Blogs
- notes.html — Notes
- works.html — Works

Chat 页面已移除。

## CI

.github/workflows/build-site.yml 会在四个 Markdown 内容目录、日期映射或构建脚本变化时重新生成并校验 data/*.json。
