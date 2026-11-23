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

## 🔐 安全 / 备份现状（2026-11-13 复验）

**安全（RLS）✅ 实测通过**：用公开 anon key 直拉 `students / passcodes / sessions` 三张 PII 表，均回 **0 笔** → anon 拖不走资料，RLS 生效中。⚠️ 验收看返回行数，不是状态码（enable RLS 无策略时空数组 `[]` 仍回 HTTP 200）。登录走 `verify_pin` RPC + 12h session token；anon key 印在公开 HTML 是设计，防线就是 RLS。旧 `backups/*.json` git 历史外泄已于 2026-07-05 force-push 抹除、线上 404。TM Supabase=`xzplzckugyvutsqocrtw`。

**备份 ✅ 每天自动在跑**：
- **数据库**：launchd `com.cicba.backup.plist` → `~/CICBA-backups/backup_all.sh` → `tm_backup.mjs`，**每天 16:00** 自动跑；落地**本机 `~/Documents/网站备份/TM智能排课/` + Google Drive** 双份，留存 30 天 + 更早每月一份。最新 2026-11-12（students 36 等全表）。**不走公开仓库 = 无外泄风险**。
- **代码**：git（`sp020879/CICBATM_courseplan`）+ 本机 `_backups/`（改动前快照，`.gitignore` 不进 git）。

> 背景：2026-06 原 GitHub Action `backup.yml` 每日 dump 明文 PII 外泄 → 已删除停用 + RLS 锁死；现改用上面的本机定时备份。详见 memory `tm-backup-exposure-remediation`。

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

## 🟣 SG/IS 修课方式（2026-11-18 · ✅ 已部署 `a39c7df`，线上 hash 与本机一致）

- 学期弹窗（`cell-modal`）在学期格下方多一排「修课方式」：正常上课 / SG / IS（对应 BA 的 SG-222 / IS-222）。普通课与外系选修 slot 都能用。
- **存法**：`students.status_detail.sgis = {课程码或slot: 'SG@2569/1'}`，**不动 `courses` 的学期格式**（全站几十处 `/^25\d\d\/\d$/` 不受影响）。标记带学期 → 格子被批次删除/改学期后旧标记自动失效。读一律走 `sgisOf(s,code)`。
- 存档走 `apiSaveStudent`（整行 upsert）+ audit `update_course_mode`；学生资料表单保存时保留 `sgis`。
- 矩阵格右上角紫色小角标（`.dc.sgis::after`，色用 `--plum`）；🔗 对账 BA 时 SG/IS 人次不计入班级人数（脚注显示排除几人次）。
- **逐笔对账（2026-11-18 · ✅ 已部署 `37d8949`）**：🔗 对账 BA 弹窗下方多一段「👤 SG/IS 逐笔对账」。`_sgisReconHTML(sem,short)` 读 BA `special`（anon 可读；栏位 student_id / course_code / class_code=IS-222|SG-222 / sem=`2569-1`），以「学号+课程码(过 `_bridge`)」比 TM 的 `sgis` 标记。四种状态：🔴 BA 没有这笔 / 🟠 TM 未标 / 🟣 TM 没这笔 / 🟡 方式不同，另 ⚪ TM 无此学生。不受隐藏毕业/休学筛选影响。纯只读。备份 `_backups/index_before_sgisrecon_20261118.html`。
- 已用 BA 真实 special 记录 + 假 TM 学生测过四种状态；**登入后真数据未验证**。
- **工作台角标（2026-11-18 · ✅ 已部署 `37d8949`）**：`loadSchedHalves` 顺带读 BA `special` 存 `_BA_SGIS`（学号|过桥码|学期 → SG/IS）；`_sgisMark(s,key,realCode,sem)` 在工作台格子（普通课 + 外系 slot）学期后面出小标（`.wb-sgis`）：紫底 `SG`/`IS`=TM 已标；后面跟红 `BA无`=BA 没登记、橘 `BA:IS`=方式不同；紫虚线 `IS?`=BA 有登记但 TM 没标。有 SG/IS 小标的格子不再显示上下半与 schedule 的「BA无/缺」。备份 `_backups/index_before_sgiswb_20261118.html`。
- 改动前快照：`_backups/index_before_sgis_20261118.html`、`style_before_sgis_20261118.css`。

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

## 📌 进度 / 待办（2026-11-22）

**2026-11-23 · 📥 导入 SLCM 成绩（✅ 已部署 `c072ffe`，2026-11-23；线上 index.html／style.css 与本机 sha256 一致（3b546ebb／ea459bd6），一次就中；**登入后用真数据（线上）待用户点一次**）**
- 做什么：学生进度页工具列多「📥 导入 SLCM 成绩」。选本机 `slcm_bundle.json` → 有资料的学生卡片 GPA 区出现紫色「SLCM」小标 → 弹窗显示 SLCM 累计 GPA／与 TM 是否一致／累计学分／**未修的课**（按课纲分组：必修缺几门、选修还差几门、实习、外系选修）／在修／已修（含成绩）／各学期 GPA／与 TM 登记对不上的清单。
- **资料只放页面内存**（`_SLCM`），不上传、不存库、关页面就没了；公开仓库里没有任何学生资料。唯一会写库的是弹窗里「用 SLCM 更新 TM 的 GPA」按钮（走既有 `applyGPA`，先 confirm，来源记 `slcm`，GPA 历史出紫色「SLCM」标）。
- 资料怎么来：用户登入 SLCM（`slcm.dpu.ac.th`）→「Check Student Grade」(isqy41) 列出导生（studentCode＝TM 的 `students.id`）→ 逐位点 Detail 触发 `getMaster`（加密 studentId 由网页自己产生）→ 存成 `_backups/slcm_<日期>/master_<学号>.json`（`_backups/` 不进 git）→ `python3 TM/tools/build_slcm_bundle.py <该资料夹>` 合成 `slcm_bundle.json`（无姓名）。2026-11-23 抓了导生 66 位中与 TM 重叠的 22 位。
- 规则（✅ 用户 2026-11-23 确认）：A B+ B C+ C D+ D S P 算通过；F W U 与无成绩不算；重修取最近一次通过；TM 标 Transferred 算已修；本学期还没出成绩算「在修」、不算缺。SLCM 的学期列无序，读取时按年/学期排序；没有任何已出成绩学期的学生 SLCM 会给 GPA 0.00，程序当作「没有」。
- 验证：22 位 SLCM 累计 GPA 与名单页 GPAX 一致 21/21（另 1 位无成绩）；TM 手填 GPA 与 SLCM 无一位不同（1 位 TM 空白）；与 TM 自己 `calcProgress` 的「还差几门」13/22 完全相同，其余差 1–2 门（TM 登记已修但 SLCM 无纪录：LA132 等 6 位；TM 外系选修 KH160 在 SLCM 是 F：1 位；另 2 位没查出原因）；375px 下 22 位弹窗溢出 0、页面溢出 0；密码框检查通过。**登入后用真数据（线上）未验证。**
- 改动：`TM/single-file/index.html`（`_SLCM` 变量、工具列按钮、`#slcm-modal`、`cardHTML` 的 SLCM 小标、GPA 历史 `slcm` 来源色、`slcmAnalyze/openSlcm/importSlcmFile/slcmApplyGpa`）、`style.css`（`.sl-*`）、新增 `TM/tools/build_slcm_bundle.py`。备份 `_backups/index_before_slcm_20261123.html`、`style_before_slcm_20261123.css`。
- **更新提醒（2026-11-23 设）**：用户给的成绩公布日 2027-01-11 / 05-30 / 08-30，公布后一周 09:00（+07:00）各一次性提醒（排程 `slcm-grade-reminder-2027-01/-06/-09`，只提醒、不自动抓、不登入）。每个只响一次，之后日期要重新问用户再设。提醒响了 → 用户登入 SLCM → 说「抓 SLCM 成绩」→ 照上面流程重抓。
- 没做：SLCM 名单里不在 TM 的 44 位、TM 有但不在导生名单的 14 位（多半休学／别的导师）；定期自动抓取（SLCM token 只有 30 分钟，要用户登入，不自动化）。

**2026-11-22 · 旧拆分版 `TM/split/` 停用 → 换成转址页（✅ 已上线 `be86267`，2026-11-22；线上 split/ 是转址页、`js/app.js`／`css/style.css` 都 404、打开 split 落在现役 TM 登录页、线上原始码无旧密码）**
- 起因：做 supabase-lock-table skill 时 `find_usages` 发现 `TM/split/js/app.js` 还在 anon 直读直写 audit_log，且线上 `…/TM/split/` 仍 HTTP 200。
- 查证没人在用：TM／BA／测验／建祯都没有连结到它；`TM/学生标签多选_改动说明_2026-11-12.md` 写明「上线的是 single-file，split 未同步」；它直读 `students`，7 月锁表后只会看到 0 位学生；编辑记录的 action 名 split 都是 single-file 的子集，分不出来源。
- 遗留风险：split 的登录是前端比对写死在 `js/app.js` 的旧密码（公开可见；single-file 注释说「不再使用」）。**待用户到「用户管理」确认没有任何 PIN 等于那组旧密码**（我用它试登录被系统挡下，不该由我试）。旧密码仍在 git 历史里（公开 repo），清不掉，重点是它不能是有效 PIN。
- 改：`git rm` `TM/split/js/app.js`、`TM/split/css/style.css`；`TM/split/index.html` 换成转址页（meta refresh＋`location.replace('../single-file/'+search+hash)`＋手动连结，`noindex`）。`README_总览.md` 改成只有 single-file 是现役、split 标「🚫 停用」。本机测过打开 split 会跳到 single-file。

**2026-11-22 · 🔴 编辑记录 audit_log 外露 → 锁表（✅ 已完成：前端 `5a6f0a3` 已上线、04【A】【B】用户已跑、匿名读写都 401）**
- **问题（体检发现）**：`audit_log` 用网页公开的 anon key 就读得到（2,533 笔；抽样含学号与 GPA 改前/改后；**没有存 PIN**）。前端也是 anon 直写 → 外人大概也能写假纪录（没实测，实测会真的写进正式库）。`02_phase2_auth.sql`【D】早就列了「audit_log 之后再锁」，一直没做。`programs` 匿名读得到 = 课纲，非机密，不动。
- **SQL**：`TM/supabase/04_lock_audit_log_2026-11-22.sql`。【A】新增 `write_audit(p_token, p_row jsonb)`（who 用前端「操作者」，空就用登录者）、`list_audit(p_token, p_limit, p_offset)`（新到旧、最多 5000）；【B】清掉 audit_log 所有 policy → 开 RLS → revoke anon/authenticated 直连（默认注释掉，要跑时删 `/* */`）。
- **前端**（`TM/single-file/index.html`，diff 16 行）：`apiAudit` 改走 `rpc/write_audit`、新 `apiAuditList(limit)` 走 `rpc/list_audit`；总览「最近 8 笔」与编辑记录弹窗改用它。**RPC 不存在时退回旧的直读直写**，所以前端先上线也不会断。语法检查通过；用模拟回应测过 4 种情况（RPC 已建／未建／已锁+令牌过期／全断）都照预期。**登录后的真实画面未验证**（需 PIN）。备份 `_backups/index_before_auditlock_20261122.html`。
- **备份脚本**（repo 外 `~/Documents/网站备份/_脚本/tm_backup.mjs`）：audit_log 改用令牌走 `list_audit` 分页读（RPC 404 时退回匿名直读），不然锁表后备份里的编辑记录会悄悄变 0 笔。`node --check` 通过；**还没实跑**。备份 `tm_backup.mjs.bak_auditlock_20261122`。
- **实际经过（2026-11-22）**：04【A】第一版用了 `public._session()`，**线上没有这个函数**（02 模板有、线上没建；线上 list_students 是直接查 sessions）→ 呼叫报 42883；改成新 `_audit_who(p_token)`（直接查 sessions、只依赖 token 栏，`to_jsonb` 读 expires_at/name，anon 不能直接叫）重跑才对。前端上线后线上 hash 一致（`bc4a0f15`）；用户登录确认读写正常（库里多一笔 11-22 登录纪录，2,533→2,534）；跑【B】后验收：anon 读 audit_log 401、anon 直写 401、RPC 假令牌回 28000、students/passcodes/sessions 仍 0 笔。**待确认**：下一次每日备份的 audit_log 笔数正常（备份脚本已改走 list_audit）。
- **上线顺序（原计划）**：① 用户在 Supabase SQL Editor 跑 04【A】 → ② 用户说「部署」→ 推 main → ③ 线上登录看编辑记录读得到、做一个动作看有新纪录；等一次每日备份（或手动跑）看 audit_log 笔数正常 → ④ 用户跑 04【B】 → ⑤ `check_anon_read.sh … audit_log` 要 0 笔。**回退**：`alter table public.audit_log disable row level security;`
- 顺带（BA，不是 TM）：BA 的 `staging.html`、`index_supa_test.html` 载入/登出时还会 `setTimeout(...pin-input.focus())`（Secure Input 问题，主页 index.html 已修）。

**2026-11-10 · BA⇄TM 交叉比对（✅ 已部署 `983ffa9`，GitHub Pages 确认生效）**
- `loadSchedHalves` 多存 `_SCHED_PRES`（课|学期 → BA 名单届别 Set，含原码大写 + 正规化码，不管有没有填上下半，含等价码镜像）与 `_SCHED_SEM_CNT`（每学期开班数）。
- `_baPresence(code,sem,cohort)` → ok / lack / none / null；**BA 该学期开班 < `_BA_SEM_MIN_ROWS`(10) 不比对**（2568 以前、2570 以后、2570/3 只有 1 笔）。
- `_halfMark` 有届别时（工作台格子）加角标：红「BA无」= BA 该学期没排这门课；橘「缺」= BA 有开但名单没有该届别。班级课表（cohort=null）不加。
- `_normCohort` 也吃 `TM67.1`。🔗 对账 BA 弹窗（`_tmSemAgg` / `_ctReconcileBA`）两边届别都过 `_normCohort` 再比，TM67-2/TM68-2.1 不再误报「缺届别」，人数合并比。
- 线上数据实测：KB222 2569/2 TM67→缺、TM69→ok；KB216 2569/2→BA无；2568/1、2570/1→不比对。**有数据画面未在浏览器验证**。

**2026-11-10 · 上下半标记修正（✅ 已部署 `ae88487`，GitHub Pages 确认生效）**
- 原因：学生届别码（TM67/TM68ZSB）不在 BA schedule 该班 cohorts 名单 → 退回「整门课」合并 → 假「上下」（例 KB222 2569/2：上半全 IB、下半才有 TM69）。
- 新 `_normCohort`（TM67-2/TM68-2.1→TM67/TM68，TM68-2ZSB→TM68ZSB）+ `_resolveHalf(code,sem,cohort)` 逐级查：届别 → 正规化届别 → 名单有同专业（TM*）的开班 → 整门课；`loadSchedHalves` 多存 `_SCHED_ROWS`（每开班 mark/teacher/cohorts，含等价码镜像）与 `_SCHED_HALF_CON`，fetch 加 `teacher`。
- 显示 `_halfMark`：实查=实底；推测（prog/all）=虚线淡色；分不出=灰虚线「?」，title 写两班老师。cohort=null（班级课表、工作台总数）改看 TM 学生所在开班。`_studHalf` 与工作台「BA排课」统计改用 resolver（「?」不计）。
- 线上数据实测（TM 6 届 × 全部课学期）：旧「上下」48 → 「?」11（KG156/SC106/KG151/KH160 2569/1 真的上下两班都有 TM 学生）。**有数据画面未在浏览器验证**（需登入）。备份 `_backups/index.html.bak_halfmark_20261110`。
- 下一步候选：剩下的「?」做手动指定（方案 ③）。

**2026-11-10 已完成**
- ✅ 修 macOS Secure Input（Chrome App 打开后 OpenVanilla 变灰）：登入 PIN 框 `pw-input` 不再在载入/过期/登出时自动 focus；登入成功与切走视窗时先 `blur()`（`_releasePwInput`）。全页只有这一个 password 框；用户管理 PIN 用 `window.prompt`，不涉及。验收：`ioreg -l -w 0 | grep -i SecureInput` 不再出现 `kCGSSessionSecureInputPID`。

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

**2026-11-10 · 统一版面（✅ 已部署 `e1d8037`，GitHub Pages 确认生效）**
- `style.css` 新增共用 class：`.page-bar`（各 tab 顶部工具列，吸顶、满版、margin -16/-24 抵消 `.main` padding）、`.pb-title / .pb-stat / .pb-sep / .pb-sp / .pb-sel / .pb-input / .pb-btn(.green/.blue/.amber) / .pb-wrap / .pb-search-ic`；下拉选单 `.dd-menu(.left/.right) / .dd-item / .dd-sep`；header 小按钮 `.bar-chip(.solid)`。
- 6 个 tab（总览/学生进度/班级课表/辅导员/毕业生 + 隐藏的排课总览）工具列改用 `.page-bar`；总览的 18px 大标题改成同款工具列；拿掉总览双重 padding + 1280 max-width（内容区改 max-width 1400、两栏 auto-fit）、毕业生多的 18px 外距；工作台 `.wb-toolbar` 对齐页面边缘（左右 24px）并吸顶。
- 管理 / 导出 / 名单 三个下拉、右上角 学期/操作者/用户管理/登出 按钮改用共用 class；JS 仍靠 `style.display` 开关，未改逻辑。
- 新增 CSS 新写法：新工具列一律用 `.page-bar` + `.pb-*`，不要再写行内 style。
- 本机预览（无数据）6 个 tab 已看过；**有数据时的卡片/矩阵/吸顶滚动未验证**。备份 `_backups/index.html.bak_layout_20261110`、`_backups/style.css.bak_layout_20261110`。

**部署方式（TM）**：在本机 Claude Code 里用户说「部署」→ Claude 合并到 `main` 并 `git push origin main`（2026-11-09 实测可推），GitHub Pages 约 40-60 秒生效，curl 线上 index.html 确认新代码。⚠️ 不要用 `tmpush`（`git add -A` 会把 `tmpush-setup.sh`、`课程目录_本机版_v0.7.2.html`、`.claude/` 一起推上去）。本机预览：`.claude/launch.json` 的 `tm-preview`（从 scratchpad 拷贝 index.html + style.css 服务，Documents 目录 python 读不了）。

## 📌 英文标准：入学 TEP 与学分认定（2026-11-17 记）

- **入学 TEP 达标线：39 分**（学生资料栏位 `s.tep.entry`）。
- **毕业 TEP 达标线：39 分**（学生资料栏位 `s.tep.exit`）。
- 两条线都是 39，代码共用常数 `TEP_PASS`=39（用户 2026-11-17 确认）。

**可认定课程（按成绩档次划分）**

| 可认定课程 | 托福 TOEFL iBT | 雅思 IELTS | 托业 TOEIC | VERSANT |
|---|---|---|---|---|
| LA160 | 30 | 3.0 | 300 | 30 |
| LA160 和 LA161 | 35 | 3.5 | 350 | 35 |
| LA160、LA161 和 LA162 | 40 | 4.0 | 400 | 40 |

- 备注：LA130、LA131 和 LA132 课程的学分认定，适用相同的分数档次。
- 认定表只展示信息，不做自动认定（用户 2026-11-17 说明）。
- **网页显示位置（2026-11-17 已部署）**：TEP 弹窗（`openTep`）。入学/毕业分数框下各一行「达标线 39 分」（`.tep-hint`）；弹窗底部可展开的「学分认定标准」表（`TEP_CREDIT_REF` / `TEP_REF_HTML`，在 `TEP_PASS` 下方；样式 `.tep-ref*` 在 style.css `.tep-val` 之后）。备份 `_backups/index.html.bak_tepref_20261117`、`_backups/style.css.bak_tepref_20261117`。本机预览量过：桌机与 375px 弹窗内无横向溢出；**登录后真实数据下未验证（待用户在线上点一次）**。

## 📌 英文毕业考提醒（2026-11-09 · 已部署 commit b0d25b4）

- 规则:实习前一学期要考过 **TEP 毕业**(沿用现有 `s.tep.exit`,及格 `TEP_PASS`=39,补考分也算)。
- 考试学期 = 实习学期的前一个**大学期**(小学期 /3 不算);已排 KT411/KT331/KT332 用排的学期,否则用 `internshipReminder` 推算。
- 新函数 `tepExitPassed / prevMainSem / getTepExitState`(在 `getInternshipState` 后)。提示:总览待办两行(本学期应考 / 逾期未过)、筛选「TEP本学期应考 / TEP逾期未过」、卡片 chip(下学期要考 / 本学期应考 / 逾期)、排 KT411/331/332 时 `_tepInternGuard` 弹警告(只警告不阻挡)。
- 2026-11-09 用户反馈 chip 太挤、跟实习蓝色撞色 → 改为提醒**放进卡片「TEP 毕业」格子**(`_tepBox`):下学期=格内蓝字「2569/2 考」、本学期=整格黄「本学期考/补考」、逾期=整格红「逾期未考/逾期·补考」;列表视图同样小标。格子外不再加 TEP chip(无时程状态但未过才保留旧「⚠ TEP 毕业未过」)。已部署 `67ded6b`。
- 已毕业/退学/转专业/实习已做完的不提醒(旧生不追溯)。备份 `_backups/index.html.bak_tep_20261109`。
- ✅ 2026-11-09 已推 main 并上线(GitHub Pages 确认生效)。

---

**最后更新**：2026-11-23 · 由 Claude 自动维护 · 重大变动同步更新此文件

## web-design-rules 体检设定

> 给 skill `web-design-rules` 的「体检模式」用（2026-11-13 加）。说「体检」就照这里的参数跑 8 项，只读不改。

- 网站根资料夹：TM/single-file
- 线上网址：https://sp020879.github.io/CICBATM_courseplan/TM/single-file（GitHub Pages，keep-ext）
- 测试指令：无自动测试（`双课纲2570/tm_regression_check.js` 是在线上网页里跑的回归脚本）
- 备份：~/Documents/网站备份/TM智能排课｜'TM-数据-*.json'｜2 天
- 匿名读取：--supabase xzplzckugyvutsqocrtw --key-from TM/single-file/index.html students passcodes sessions audit_log
- 反向验证纪录：无（没有自动测试可反向验证）
- 已知：GitHub Pages 不能自订安全标头；登录后的画面要在浏览器里量；`programs`（课纲）匿名可读是正常的
- 密码框：PIN 框 `pw-input` 是跨两行写的 `<input>`（2026-11-22 起 skill 的检查读得到跨行标签）

### 体检纪录
- **2026-11-22**：网站面都过；维护面 1 个严重问题（处理中）。
  - 网站面：375px over=0（量到的是登录画面）；PIN 框无自动聚焦、登录成功/切走/登出都 blur；线上与本机 `index.html`、`style.css` 一致、与 origin 同步；安全标头缺（GitHub Pages 限制，已知）。
  - 维护面：备份 11-22 09:48 本机＋云端各 26 份、排程 exit 0；students/passcodes/sessions 匿名 0 笔；❌→✅ **audit_log 匿名读得到 2,533 笔（含学号、GPA）→ 当天已锁**（见「进度 / 待办」2026-11-22）。
