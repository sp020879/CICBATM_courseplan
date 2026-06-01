# 排课系统文件总览 · 2026-05-29

> 这个文件夹存放 TM 和 BA 两套排课系统的全部源码 + Apps Script 后端 + 部署文档。可直接整个拖到 Google Drive 作云端备份。

## 文件夹结构

```
排课 (TM & BA)/
│
├── 📄 README_总览.md                    ← 你正在看的这份
│
├── 📂 AppsScript/                       ← BA 后端（Google Apps Script）
│   ├── Code_v7.9_当前生产版.gs           ⭐ 现在线上跑的版本
│   ├── v7.9_待加补丁.md                  ⭐ 当前待办（SCRIPT_SECRET + cohort 修复）
│   ├── Code_v6_safe.gs                  📦 历史 v6（已被 v7.9 覆盖，保留作参考）
│   ├── Code_v5_原始版.gs                 📦 历史 v5（同上，保留）
│   └── README_v6_部署与回滚.md           📦 v6 时代文档（部分内容仍适用）
│
├── 📂 BA/                               ← BA 前端（HTML + Apps Script 后端）
│   ├── single-file/index.html           ⚠ 含 C 层保护，但基于较旧版（无在线用户/错误日志）
│   └── split/                           （同上，拆分成三文件版）
│       ├── index.html
│       ├── style.css
│       └── app.js
│
└── 📂 TM/                               ← TM 前端（HTML + Supabase 后端）
    ├── single-file/index.html           ⭐ TM 生产版（内嵌 CSS/JS）
    └── split/                           ⭐ TM 生产版（拆分版，跟 GitHub 上结构一致）
        ├── index.html
        ├── css/style.css
        └── js/app.js
```

⭐ = 现役版本，需要时直接用  
📦 = 历史版本，只作版本对照  
⚠ = 注意事项见下

---

## 两套系统区别

| 维度 | TM 🎯 | BA 🔥 |
|---|---|---|
| 用途 | 旅游管理学业进度追踪 | 本科排课管理 |
| GitHub | `sp020879/CICBATM_courseplan` | `ali-che/CICBAcourseplan` |
| 线上 URL | https://sp020879.github.io/CICBATM_courseplan/ | https://ali-che.github.io/CICBAcourseplan/ |
| 后端 | Supabase（PostgreSQL） | Google Apps Script + Sheets |
| 后端文件 | `js/app.js` 顶部 `SUPABASE_URL` + 在 Supabase 后台建表 | `AppsScript/Code_v7.9_当前生产版.gs` |
| 当前版本 | 不明确，按 GitHub Pages 为准 | v7.9（含批量删除、错误日志、在线用户等） |

---

## ⚠ 重要提醒：BA 前端的版本差异

我手上保存的 **BA index.html（在 `BA/` 文件夹里）** 是 **基于较旧版 + 加了 C 层数据安全 patch** 的版本。**不含**线上生产版的这些功能：

- 在线用户 / 心跳 / 在线 N 显示
- 错误日志面板
- 主任 PIN 多人验证
- 学期列表分页
- 操作人追踪栏
- 批量删除 UI
- 课程库专业字段
- 乐观锁冲突检测

**如果你想要桌面这份文件夹包含 BA 完整生产版**，建议：

1. 打开 https://ali-che.github.io/CICBAcourseplan/
2. 右键 → 查看源代码 → 全选复制
3. 在 `BA/single-file/` 里新建 `index_v7.9_生产版.html`，贴进去保存
4. （可选）下次再请我帮忙的时候上传这份，我可以基于最新版做后续修改

---

## 当前待办（按紧急度）

### 🔴 立刻做
- **改 `Code_v7.9_当前生产版.gs` 顶部的 `SCRIPT_SECRET`**（详见 `AppsScript/v7.9_待加补丁.md`）。现在 `'CHANGE_ME'` 等于任何人有 URL 就能读写你的 Sheet。

### 🟡 近期做
- **修 cohort 名带 `(N)` 后缀的脏数据**（DevTools Console 脚本在 `AppsScript/v7.9_待加补丁.md` 里），不修的话班级总表过滤一直不准。

### 🟢 选做
- 在线用户 bug（gasHeartbeat 没传 editor）。这个 feature 可砍可修，看你需要。

---

## 部署 / 回滚速查

### 部署 Apps Script 新版本
1. 打开 Sheet → 扩展功能 → Apps Script
2. 整段替换为 `Code_v7.9_当前生产版.gs` 内容
3. 💾 保存
4. 部署 → 管理部署 → 编辑（铅笔图标）→ 版本"新版本"→ 部署
5. URL 不变，前端不用动

### 数据丢失三道救援
按优先顺序试：
1. **Sheet 文件 → 版本历史 → 还原** 某个时间点
2. **Sheet 里 `_备份_排课` / `_备份_特别` / `_备份_BTEC`** 表手动复制粘贴恢复
3. **Apps Script 编辑器跑 `manualRestoreSchedule()`** 一键恢复最新快照

### 紧急清空（合法的清空）
URL 后追加：`?action=clear&type=schedule&confirm=YES`
（少了 `confirm=YES` 就会拒绝，防止误操作）

---

## 异地备份建议

每周一次：
1. **Sheet → 文件 → 制作副本** → 命名 `备份_2026-05-29`
2. 把这整个文件夹拖一份到 Google Drive 不同位置

每天自动：
- 已部署 `setupDailyBackup()` 凌晨 3 点全量备份到 `_备份_*` 表（无需手动）

---

## 联系点

下次再请我帮忙时，建议把**当前生产版的 index.html + Code.gs** 都先上传一份，我基于最新版改不会回退老 bug。
