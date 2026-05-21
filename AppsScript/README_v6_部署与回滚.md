# BA 排课系统 · v6 安全版 部署 + 回滚指南

> 修复目标：解决"Google Sheet 信息常常不见"的问题。

## 根因（重要：先理解再修）

旧版（v5）有一个**致命组合**：

1. 前端启动时调 `loadDataFromSheets()` 从 Apps Script 拉数据
2. 当 Apps Script 返回错误（**配额耗尽 / 网络瞬断 / 超时**），前端 `schD = []` 保持初始空数组
3. 但**没有任何 UI 提示加载失败**
4. 用户做任何操作 → `syncNow()` → POST `{payload: []}` 给后端
5. 后端 `writeSchedule([])` 先 `clearData(sheet)` 清空全表，然后 `if(!data.length) return` 直接退出 → **Sheet 整张被清空**

你之前 sync_sources 里报的 `Quota exceeded for quota metric 'Read requests'` 就是触发器之一。

---

## v6 的三层防护

| 层 | 作用 | 实现位置 |
|----|------|----------|
| **A · 后端拒空** | Apps Script 收到空数组 write 直接返回 error，不再 clearData | `Code_v6_safe.gs` → `doWrite` |
| **B · 写前备份** | 每次写入前先把现有数据快照到 `_备份_xxx` sheet（保留最近 20 次） | `Code_v6_safe.gs` → `backupGeneric` |
| **C · 前端硬拦** | 加载失败时显示红色横幅 + 锁死所有写入按钮 | `BA/split/app.js` → `canSync` / `safe-banner` |

任何一层独立工作都能止血，三层叠加 = 数据基本不可能再丢。

---

## 部署步骤（按顺序，每步约 1–3 分钟）

### 1️⃣ 部署 Apps Script v6

1. 打开你的 Google Sheet `CIC-2569 排课 Plan`
2. **扩展功能 → Apps Script** 进入编辑器
3. 把现有 `Code.gs` 整个内容**替换**为 `Code_v6_safe.gs` 的内容
4. 顶部菜单 → **运行** → 函数选 `setupSheets` → 第一次运行需授权，按提示授权
5. 跑完后 Sheet 里应该自动出现 3 张新表：`_备份_排课` / `_备份_特别` / `_备份_BTEC`
6. **部署 → 管理部署 → 编辑现有部署（铅笔图标）→ 新版本 → 说明填 "v6 安全版" → 部署**
7. **复制新的 Web App URL**（如果没换 URL，跳过下一步）
8. 如果 URL 变了：打开 `BA/split/app.js` 第 54 行 `SHEETS_URL = '...'` 改成新 URL

### 2️⃣ 上传新版 BA 到 GitHub

把这些文件推到 BA 的 GitHub 仓库（`ali-che/CICBAcourseplan`）：

- `BA/single-file/index.html`（如果你的仓库是单文件结构）
- 或 `BA/split/index.html` + `style.css` + `app.js`（如果是分文件结构）

提交后 GitHub Pages 一般 30 秒到 2 分钟生效。

### 3️⃣ 验证

打开 BA 系统（强制刷新 Ctrl+Shift+R / Cmd+Shift+R）：

- ✅ 正常情况：顶栏显示 "✅ 数据已载入 hh:mm:ss"，可正常添加/删除/同步
- ❌ Apps Script 配额没恢复时：顶部出现红色横幅"Sheet 数据载入失败…写入已锁定" → 所有同步操作被拒，等配额恢复或手动刷新

测试空数组保护：
- 打开浏览器 DevTools → Console
- 输入 `fetchWrite('schedule', [])` → 应该返回 false，弹出红色横幅"检测到本地数据为空，已拒绝同步"

---

## 数据回滚方法（按容易程度排序）

### 方法 1 · Google Sheet 版本历史（最简单，零代码）

1. 打开 Sheet → **文件 → 版本历史 → 查看版本历史**
2. 找到数据没丢的那个版本 → 三点菜单 → **还原此版本**

⚠ 注意：版本历史只能往回看，不能选择性恢复某张表。

### 方法 2 · 用 v6 自带的 `_备份_xxx` sheet（推荐）

每次写入前 v6 都会快照一次现有数据到 `_备份_排课` / `_备份_特别` / `_备份_BTEC`，最多保留 20 次。

恢复方式（任选其一）：

**A. 手动复制粘贴**：
1. 打开 `_备份_排课`
2. 找到要恢复的那个时间戳（第一列）的所有行
3. 复制（不含表头）→ 粘贴到 `排课记录` 表（先清空原数据）

**B. 一键恢复最新备份**（Apps Script 编辑器里跑）：
- 函数 `manualRestoreSchedule()` → 恢复排课记录
- 函数 `manualRestoreSpecial()` → 恢复特别排课
- 函数 `manualRestoreBtec()` → 恢复 BTEC

**C. 通过 URL 调用**（前端可加按钮）：
```
{SHEETS_URL}?action=restore&type=schedule
{SHEETS_URL}?action=restore&type=special
{SHEETS_URL}?action=restore&type=btec
```

**D. 列出所有快照时间戳**：
```
{SHEETS_URL}?action=listBackups&type=schedule
```

### 方法 3 · 显式清空（替代旧的"空数组清空"行为）

如果你真的想清空某张表（不是被误清空），用这个 URL：

```
{SHEETS_URL}?action=clear&type=schedule&confirm=YES
```

`confirm=YES` 是强制参数，少了就会拒绝。**清空前也会自动备份**，所以即使误操作也能从 `_备份_*` 恢复。

---

## 紧急用户解锁

如果 C 层误判（譬如你确认本地数据是对的、Apps Script 只是暂时网络抽风），红色横幅上有「我确认强制解锁」按钮：

- 点击后会弹出二次确认
- 解锁后下次同步会按当前本地状态写入 Sheet（**仍然受 A 层"空数组拒写"保护**）

---

## 长期建议

1. **每周手动跑一次 `_备份_*` 的 Sheet 副本**（文件 → 制作副本），异地保存
2. **Apps Script 配额优化**：考虑把 `loadDataFromSheets` 改成"按需加载"而不是启动时全量拉，可以省掉很多 Read 请求
3. **考虑迁移到 Supabase**：TM 那套已经是 Supabase，并发安全、配额高一个量级、原生支持事务。BA 迁移工作量 = 重写同步逻辑（约 100 行）+ 建表 + 数据导入（一次性）

如果想做长期建议里的任何一项，告诉我从哪个开始。
