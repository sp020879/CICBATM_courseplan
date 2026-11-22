-- ============================================================
-- TM 排课 · 锁住编辑记录 audit_log（2026-11-22）
--
-- 为什么：web-design-rules 体检发现 audit_log 用网页上公开的 anon key 就读得到
--         （2,533 笔，含学号与 GPA 改前改后），前端也是直接用 anon key 写入。
--         02_phase2_auth.sql【D】早就列了「audit_log 之后再锁」，一直没做。
-- 做法：照 students 的模式 —— 写入、读取都改走要 session token 的 RPC，再开 RLS 锁 anon 直连。
--
-- ⚠️ 上线顺序（照做，不然编辑记录会断）：
--   1) 跑【A】（纯新增两个函数，对线上零影响）
--   2) 部署前端（apiAudit / 总览最近 8 笔 / 编辑记录弹窗 改走 RPC）＋ 备份脚本改走 RPC
--   3) 线上确认编辑记录读得到、新动作写得进去之后，再跑【B】锁表
-- 在 Supabase → SQL Editor 贴上执行；【A】【B】分两次跑。
-- ============================================================


-- ============================================================
-- 【A】两个 RPC（先跑这段）
-- ============================================================

-- ⚠️ 2026-11-22 修正：线上没有 public._session()（02 模板里有、线上没建），
--    改成直接查 sessions 表。只依赖 token 栏位；有 expires_at 就检查过期，有 name 就当登录者名字。
--    错误讯息与线上 list_students 一致（28000「登录已过期,请重新登入」）。

-- 内部：token → 登录者名字；无效/过期回 null
create or replace function public._audit_who(p_token text)
returns text
language plpgsql security definer set search_path = public as $$
declare j jsonb;
begin
  if p_token is null or p_token = '' then return null; end if;
  select to_jsonb(x) into j from public.sessions x where x.token = p_token limit 1;
  if j is null then return null; end if;
  if (j ? 'expires_at') and (j->>'expires_at') is not null and (j->>'expires_at')::timestamptz <= now() then return null; end if;
  return coalesce(nullif(j->>'name', ''), '(已登录)');
end; $$;
revoke all on function public._audit_who(text) from public, anon;

-- 写入：有效 session 才能写。who 用前端传来的「操作者」，没传就用登录的人。
create or replace function public.write_audit(p_token text, p_row jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_who text; r public.audit_log;
begin
  v_who := public._audit_who(p_token);
  if v_who is null then raise exception '登录已过期,请重新登入' using errcode = '28000'; end if;
  r := jsonb_populate_record(null::public.audit_log, p_row);   -- 型态交给表定义去转
  insert into public.audit_log(who, action, target_type, target_id, note, before, after)
  values (coalesce(nullif(r.who, ''), v_who), r.action, r.target_type, r.target_id, r.note, r.before, r.after);
end; $$;
revoke all on function public.write_audit(text, jsonb) from public;
grant execute on function public.write_audit(text, jsonb) to anon;

-- 读取：有效 session 才能读；新到旧，分页（p_limit 最多 5000）。
create or replace function public.list_audit(p_token text, p_limit int default 500, p_offset int default 0)
returns setof public.audit_log
language plpgsql security definer set search_path = public as $$
begin
  if public._audit_who(p_token) is null then
    raise exception '登录已过期,请重新登入' using errcode = '28000';
  end if;
  return query
    select * from public.audit_log
     order by ts desc, id desc
     limit least(greatest(coalesce(p_limit, 500), 1), 5000)
    offset greatest(coalesce(p_offset, 0), 0);
end; $$;
revoke all on function public.list_audit(text, int, int) from public;
grant execute on function public.list_audit(text, int, int) to anon;


-- ============================================================
-- 【B】锁表（前端与备份都改好、部署、线上确认后才跑）
-- ============================================================
-- 拿掉 audit_log 上所有既有 policy（如果有放行 anon 的就一起清掉），再开 RLS、收回直连权限。
-- RPC 是 security definer，照常读写；anon / authenticated 的 REST 直连从此读不到、写不进。
/*
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'audit_log' loop
    execute format('drop policy %I on public.audit_log', p.policyname);
  end loop;
end $$;
alter table public.audit_log enable row level security;
revoke select, insert, update, delete on public.audit_log from anon, authenticated;
*/
-- ↑ 要跑【B】时，把上面 /* 和 */ 两行删掉再执行。

-- ============================================================
-- 验收（跑完【B】后）：
--   bash ~/.claude/skills/web-design-rules/scripts/check_anon_read.sh \
--     --supabase xzplzckugyvutsqocrtw --key-from TM/single-file/index.html audit_log
--   → 要看到「audit_log：0 筆」或 401
-- 回退（万一锁完前端坏掉）：alter table public.audit_log disable row level security;
-- ============================================================
