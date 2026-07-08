# TM ↔ BA 排课同步 · 详细方案 (2026-07-03)

两套系统 = 供需两端。**主流程:TM 先排 → 导入 BA;闭环:BA 排完的 `half`/老师回流 TM。**

- TM 追踪:`xzplzckugyvutsqocrtw`,`students.courses = {课程码: "2569/1"}`
- BA 排课:`ahygebtmavcmzqdwwhbs`,`schedule` 表(anon 可读;写走 security-definer RPC 先验 PIN)

## 1. 数据流闭环
```
① 你在 TM 排每个学生的 课×学期
        ↓ 聚合(按 课程+学期 归届别、算人数)
② TM →「同步到 BA」→ 写 BA schedule(只写 TM 拥有的字段)
        ↓ BA 排课台
③ BA 填 上下半 half / 老师 teacher / 班级 class_code / 类型 type
        ↓ (已完成)
④ TM 读 BA schedule.half → 排课工作台/班级课表显示 上/下/全
        ↓
⑤ 对账:TM 排的 ⇄ BA 实际,抓矛盾
```

## 2. 字段所有权(防覆盖的核心铁律)
| schedule 字段 | 拥有方 | 同步规则 |
|---|---|---|
| course_code, sem | 共同键 | 匹配用,不改 |
| course_en | TM(或目录) | TM 写 |
| **cohorts, total** | **TM** | **TM 写/更新** |
| **half, teacher, class_code, type** | **BA** | **TM 绝不碰**(否则冲掉 BA 填的上下半) |
| note, btec | BA | TM 不碰 |
| id, updated_at, editor | 系统 | RPC 自管 |

→ **TM→BA 的 update 只能 SET cohorts/total/course_en,其余字段原样保留。**

## 3. TM→BA 同步:匹配键 & upsert 规则
- **匹配键 = (course_code, sem)**。
- 对该学期 TM 排到的每门课:
  - BA 无此 (course,sem) 行 → **新增**(填 course_code/course_en/sem/cohorts/total;half/teacher/class 留空给 BA)。
  - BA 已有 → **只更新 cohorts/total**(保留 BA 的 half/teacher/class)。
- 聚合逻辑**复用现成的 `_ctExportCSV()`**——它已经把 TM 学生按 BA 的届别命名(TM67/TM68-2/…)归好组、算好人数了。
- **写前必出 preview + 确认**(写的是 BA 生产库,不能静默批量写)。

## 4. 三个棘手点(要你拍板)
1. **多班次**:BA 可能把一门课 (KB217,2569-1) 拆成 601/602 两班(两行)。TM 只排到"课+学期"粒度,不管分班。
   → 建议:TM 同步只认"课+学期";BA 若已分班,**只更新人数总量到主行 / 或标记为多班次让你手动**,绝不自动拆合。
2. **删除**:某课 TM 不排了但 BA 还有 → **不自动删**,只在对账里报"BA 多出",你手动决定。
3. **写入通道**:方法2(直连 RPC)需要 BA PIN + 确认 RPC 签名(`add_record/update_record` 参数)。
   在拿到前,方法1(CSV 导出→BA 导入,已能用)先顶着。

## 5. 分阶段实施(每阶段可独立上线、都不写坏东西)
- **D0 · 对账预览(只读,先做)**:TM 拉 BA schedule,和 TM 排的比,列出「新增/人数差异/BA 多出」。**零写入零风险**,本身就是 C,也是同步前的 preview。
- **D1 · 一键同步**:在 D0 预览上加「确认写入 BA」→ 调 RPC,按 §2/§3 规则 upsert。需 BA PIN + RPC 签名。
- **A · 老师/班级回流**:BA teacher/class_code 显示进 TM(和上下半同机制,很快)。
- **B · 课程库真源迁 Supabase**:TM 改读 BA `courses`,退役 Google Sheet。

## 6. 已完成
- ④ 回流:BA `schedule.half` → TM 上下半标记(工作台格子 + 班级课表列),读 BA Supabase,已上线。

## 待确认(实现 D1 前)
- BA 写 RPC 的确切名字/参数(看 BA-repo 前端 or 实测)。
- TM 端存 BA PIN 的方式(配置项 / 每次输)。
- 多班次、删除两个策略你选哪种。
