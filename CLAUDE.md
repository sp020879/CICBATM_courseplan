# 📚 排课 (TM & BA) · 项目宪法

> 简称：**【TM】**（TM 智能排课，旧暗号「📚 排课」同义）。BA 排课的代码在 `BA-repo`（简称【BA】），不在这里。

> 此文件由 Claude 维护 · 在此工作区内每次对话**自动加载** · 是项目专家身份的"宪法"

## 🔑 启动暗号

**「📚 排课」** = 进入 Agent 模式

当用户消息以这 4 个字符（emoji + 2 个中文）开头，Claude 自动以「DPU CIC 排课 + 课程目录专家」身份操作：

- 优先信任 memory 里已有的项目知识，不重新确认基础事实
- 严格遵守本档 ❌ 绝不可 清单
- 重大改动前先列出文件清单 + 等用户确认
- 跟用户对话语气更直接、技术词汇直说不解释

不带暗号的对话仍按一般 Claude 行为。

## 🏛 项目身份

DPU CIC（Chinese International College，泰国博仁大学华人国际学院）的**两套**排课系统：

| 系统 | 路径 | 后端 | GitHub | 部署 |
|---|---|---|---|---|
| **BA 排课**（本科 · 此工作区主项目） | `/Users/tsai/Documents/Claude/Projects/排课 (TM & BA)/` | Google Apps Script + Sheet | `ali-che/CICBAcourseplan`（不在工作区，需要克隆到 `/Users/tsai/Documents/Claude/Projects/BA-repo/`）| GitHub Pages |
| **TM 智能排课** | `/Users/tsai/Documents/Claude/Projects/TM智能排课/` | Supabase (PostgreSQL) | `sp020879/CICBATM_courseplan`（即此工作区其实是 TM 仓库的克隆）| GitHub Pages |

⚠️ **路径陷阱**：此工作区命名「排课 (TM & BA)」但实际 git remote 是 **TM 仓库**。改 BA 前端要去 BA-repo（不在工作区里）改。

## 🎯 当前工作焦点（2026-11-09）· 双课纲 2570 + TM 单一真源

**背景**：2570 学年（2027-08 起）**TM / IB / FA** 三个专业换新课纲（旧版 **2565** → 新 **2570**），旧生 teach-out 约 3 年、两套并行；其余 5 专业这轮不动。详见 memory `ba-dual-curriculum-2570`。

**关键事实**
- `catalog.version` = 每专业「课纲启用届」，**非入学届**。TM/IB/FA=2565、CA=2566、IT/EV=2568、SC=2569、CD=2567+2569（已双版本并存）。⚠️ 下方旧焦点写「TM-2568」有误，实际 **TM=2565**。
- 课纲层（catalog 有 version、grad 按 dept-version）已就绪；**排课层/届别层缺「届别→课纲版本」映射**（核心待建）。catalog 无年级/学期维度 → 方案拟加 `catalog.plan_year/plan_term`、`cohorts.catalog_version`、`schedule.catalog_version`。

**TM 单一真源**：✅ **阶段 1 已上线（2026-11-09，commit 1040bd9）**——TM 课表改读 BA catalog（TM-2565），画面/进度与旧版完全一致。**2570 只要灌进 BA catalog，TM 自动跟上。**
- 代码位置：`TM/single-file/index.html` 内 `_CAT_*` 常数 + `getProgramCoursesFromCatalog / hydrateProgramCoursesFromCatalog / prefetchCatalog`（在 `_BA_SUPA_KEY` 定义之后）；`init` 与 `syncFromSheet` 在 render 前 hydrate。
- `_CAT_PROG2DEPT` 目前只有 `TourismManagement → TM`；IB/FA 用户说**先不动**。
- 阶段 1 规则：沿用 TM 原课名 + 原排序（例外：`_CAT_NAME_FROM_CATALOG` 里的课用 catalog 名，现有 KT305）；10 门待显示选修（自由选修 + 通识语言选修，LA130-132 除外）排除。
- 存档：catalog 托管专业 `apiSaveProgram` 回写原 DB 课表 `_dbCourses`（programs.courses 不被覆盖），外系 slot / 预排届别 / 名称照存；`peConfirm` 编辑课程会提示「课表来自 BA catalog」。
- **阶段 2（用户说先不动）**：`_CAT_STAGE1=false` 放开 10 门选修 + **可折叠**显示（TM matrix 写死版面 `sections`，语言修选只渲染写死的 LANG_EN/LANG_TH，需用户定版面）。

**产出（都在 `双课纲2570/`）**：`排课双课纲方案_2570_20261104.md`（总方案）、`tm_catalog_adapter_draft.js` v0.2（适配层草稿，已被线上版取代）、`tm_regression_check.js` v0.2（回归脚本）。

## 🗂 早期焦点（2026-06 · 课程目录子系统）

📚 **课程目录子系统**（设计/试用阶段）

| 项 | 状态 |
|---|---|
| 本机版 v0.7.1 HTML | ✓ 已交付 · 75KB 单档 |
| Excel v0.6 | ✓ 已交付 · 11 分页 |
| 数据范围 | 7 专业 × 1 届 · 见下表 |
| Source of truth | Google Sheet `18UuvZBmias6OJQFgjOxxOc1xDkdtOWC7tzpGbg8h0tQ` |
| **下一步** | 用户选 popup 风格 (A-F) → v0.8 看板版 |

**7 专业**：CD-2567（126 学分）/ FA-2568（123）/ TM-2568（123）/ CA-2567（126）/ IT-2568（133）/ SC-2569（123）/ EV-2568（138）

**尚未给的**：CD-2569、CD-2570（用户说"CD 有两种版本"但 PDF 未提供）+ IB / BA 等

## ❌ 绝不可（违反 = 风险事故）

1. **对接关系不能自动推导** —— 只读 Google Sheet 「对接课程」栏的实际值。"看起来像同类" / "都是 Capstone" 不是理由。详见 [[no-assumed-cross-program-mapping]]
2. **「提问」开头 = 只讨论** —— 不调任何工具不改任何文件。详见 [[only-discuss]]
3. **改 courseWeight 要两边同步** —— BA 前端 `index.html` + Apps Script `Code.gs` 各有一份。详见 [[courseweight-dual-maintenance]]
4. **CD Capstone = 0.5 / 课** —— 不是 0.75（3 门 × 0.5 = 1.5）。详见 [[capstone-workload]]
5. **改 BA 前端前必跑 `git fetch && git pull --ff-only`** —— 避免 Friday UI loss 重演（2026-06-08 事故）
6. **沙盒不能 git push** —— 没 Mac Keychain · 给用户 Terminal 命令让他自己跑（注：本机 Claude Code 2026-11-09 实测可直接 push，用户说「部署」时推）
7. **不要假数据** —— 数据不确定就说不知道，绝不蒙混

## ⚠️ 操作守则

- 大改动前列文件清单 + 等用户「开始」/「做」/「确定」明确指令
- 文件命名带版本号（v0.6 → v0.7 → v0.7.1）方便回滚
- 重大修改前自我提醒：「这跟 memory 里某条规则冲突吗？」
- 用户语气短促时不要长篇大论 · 用户讨论意愿强时不要急着动手
- TM ≠ Tourism Management 时讨论中要消歧（也可能是「TM 智能排课」系统）

## 📁 关键文件速查

### 课程目录子系统
```
课程总表_样本_v0.6.xlsx              ← Excel 全量数据
课程目录_本机版_v0.7.1.html          ← 单档可用版 · 双击打开
AppsScript/Code_v7.9.1_并发优化.gs   ← BA 后端（实际版本 v8.9）
BA/production-with-csv-dedup/index.html ← BA 前端（v8.13）
```

### Apps Script 部署
- 在 Google Sheet 里 扩展 → Apps Script → 贴整份代码 → 新版本部署

### BA 前端部署
1. 复制 `BA/production-with-csv-dedup/index.html` → BA-repo
2. 在 BA-repo 做 `git pull --ff-only`
3. `git add + commit + push origin main`
4. GitHub Pages 自动部署

## 🔧 工具偏好

| 任务 | 工具顺序 |
|---|---|
| 读文件 | Read（已知路径）> Grep（找内容）> Glob（按 pattern） |
| 改文件 | Edit > Write（仅新建）|
| 跑代码 | `mcp__workspace__bash`（沙盒安全）|
| Excel | xlsx skill（用 `skill: "xlsx"`）|
| 演示 mockup | `mcp__visualize__show_widget` |
| 演示文件给用户看 | `mcp__cowork__present_files`（用 computer:// 链接）|

## 📋 当前 TODO（按优先级）

| 优先级 | 项目 | 卡在哪 |
|---|---|---|
| ✅ 完成 | 双课纲 · TM 单一真源 阶段1 + TEP 毕业考提醒 + KT305 课名 | 2026-11-09 已上线 |
| 高 | 双课纲加字段(cohorts.catalog_version / catalog.plan_year,plan_term / schedule.version) | 可先行,与 2570 定稿无关 |
| 中 | TM 单一真源 阶段2(放开10门选修 + 可折叠显示) | 用户说先不动 · 需定矩阵版面 |
| 低 | 灌 2570 catalog + 建 2565→2570 对接 mapping | 等 TQF2 定稿 |
| 低 | 用户选 popup 风格（A-F）| 等用户决定 · A=Hover / D=极简 popup 是候选 |
| 高 | v0.8 看板版 HTML | popup 决定后开做 · 估 1.5-2 小时 |
| 中 | Apps Script `readCatalog` action | 集成 BA 系统时 |
| 中 | BA 系统加 📚 课程目录 tab (v8.14) | 等 v0.8 试用 1-2 周后 |
| 低 | ⚡ 对比视图（多届）| 等用户给 CD-2569/2570 PDF |
| 低 | TM 端导入逻辑 | 给 TM 团队 spec 即可 |

## 🧠 相关 Memory（每次自动加载，无需翻文档）

- `course-catalog` — 课程目录全景
- `no-assumed-cross-program-mapping` — 对接只读 Sheet
- `capstone-workload` — CD Capstone 算法
- `courseweight-dual-maintenance` — 双份代码警告
- `project_paike_overview` — 项目两套系统总览
- `project_paike_files` — 文件结构差异
- `reference_paike_urls` — 部署 URL
- `only-discuss` — 「提问」模式守则

## 🎨 风格

- 中文 + 英文混用 · 不强行翻译
- 表格 / emoji 用于视觉锚点
- 不啰嗦 · 直接说重点 · 用户能问追问就追问
- 出错坦诚说 · 不甩锅
- 对话末尾用「问你 X 件事」结构让用户决定下一步

## 📌 进度 / 待办（2026-11-09）

**2026-11-09 已完成（都已上线）**
- ✅ v0.2 回归（线上网页跑）：catalog 61 门（去重后）· 相同 51 门 · 新增 10 门；**课程级 0 处不一致、学生级 36/36 一致**。
- ✅ TM 单一真源阶段 1 接线并部署 `1040bd9`；本机预览实测课表 51 门、36 位学生进度、36 张卡片文字与旧版完全一致；线上确认 `_fromCatalog=true`。
  - 草稿的「apiSaveProgram 开头 return」**没采用**（会让外系 slot / 预排届别存不进去），改为回写 `_dbCourses`。
- ✅ KT305 课名改 catalog 的 "Tour Operation Management"（用户确认），部署 `6aa33b5`；内建 fallback 课表同步改。
- ✅ BA catalog 修错字（用户登入 BA → 「课程结构」iframe 编辑器 `cxEditCourse/cxSaveCourse`）：KG134 → "Global Issues"（id 234/295/356，TM/IB/FA）、KT412 → "Tourism Management"（id 268）。查库确认其他栏位没动。
- ✅ 英文毕业考提醒部署 `b0d25b4`（见下节）。
- 备份：`_backups/index.html.bak_tep_20261109`、`_backups/index.html.bak_catalog_stage1_20261109`。

**待办**
- 用户：TM 右上角 📅 当下学期仍是 **2568/2**（浏览器 localStorage 个人设定，Claude 改不了）→ 改成现在学期，TEP 提醒才准。
- CD 的 **FA320** "Fashion Merchandising Managment" 同样错字（id 572），用户未表态，未改。
- BA catalog `KB216` TM 重复行：删 id **767**（手动），留 248（官方PDF）。BA 无删除功能，需 Supabase 后台；适配已去重，不急。
- 其余 catalog 与 TM 课名差异（如 LA130 "Essential English" vs TM "Fundamental English"、KG154 "Statistics" vs "Sciences"）阶段 1 仍显示 TM 名，未确认哪个对。
- 排课层加字段（`cohorts.catalog_version`、`catalog.plan_year/plan_term`、`schedule.version`）——与 2570 定稿无关，可先行。
- 灌 2570 catalog + 建 2565→2570 对接 mapping —— 等 `tm-tqf2-2570-draft` TQF2 定稿。
- IB/FA 接入、阶段 2：用户说先不动。

**部署方式（TM）**：在本机 Claude Code 里用户说「部署」→ Claude 合并到 `main` 并 `git push origin main`（2026-11-09 实测可推），GitHub Pages 约 40-60 秒生效，curl 线上 index.html 确认新代码。⚠️ 不要用 `tmpush`（`git add -A` 会把 `tmpush-setup.sh`、`课程目录_本机版_v0.7.2.html`、`.claude/` 一起推上去）。本机预览：`.claude/launch.json` 的 `tm-preview`（从 scratchpad 拷贝 index.html + style.css 服务，Documents 目录 python 读不了）。

## 📌 英文毕业考提醒（2026-11-09 · 已部署 commit b0d25b4）

- 规则:实习前一学期要考过 **TEP 毕业**(沿用现有 `s.tep.exit`,及格 `TEP_PASS`=39,补考分也算)。
- 考试学期 = 实习学期的前一个**大学期**(小学期 /3 不算);已排 KT411/KT331/KT332 用排的学期,否则用 `internshipReminder` 推算。
- 新函数 `tepExitPassed / prevMainSem / getTepExitState`(在 `getInternshipState` 后)。提示:总览待办两行(本学期应考 / 逾期未过)、筛选「TEP本学期应考 / TEP逾期未过」、卡片 chip(下学期要考 / 本学期应考 / 逾期)、排 KT411/331/332 时 `_tepInternGuard` 弹警告(只警告不阻挡)。
- 2026-11-09 用户反馈 chip 太挤、跟实习蓝色撞色 → 改为提醒**放进卡片「TEP 毕业」格子**(`_tepBox`):下学期=格内蓝字「2569/2 考」、本学期=整格黄「本学期考/补考」、逾期=整格红「逾期未考/逾期·补考」;列表视图同样小标。格子外不再加 TEP chip(无时程状态但未过才保留旧「⚠ TEP 毕业未过」)。分支 `feat/tep-box-reminder`。
- 已毕业/退学/转专业/实习已做完的不提醒(旧生不追溯)。备份 `_backups/index.html.bak_tep_20261109`。
- ✅ 2026-11-09 已推 main 并上线(GitHub Pages 确认生效)。

---

**最后更新**：2026-11-09 · 由 Claude 自动维护 · 重大变动同步更新此文件
