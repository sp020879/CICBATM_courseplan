-- ============================================================
-- TM 排课 · 安全加固 Phase 2：session token + 数据走 RPC，锁死 anon 直连
-- 设计：登录发 token → 客户端每次带 token 调 RPC → 服务端校验身份/管理员
-- 性能：token 校验是 sessions 主键查找（微秒）；每个数据操作仍是 1 次往返，不变慢。
--
-- 上线顺序（务必照做，否则线上会断）：
--   1) 先跑【A】【B】【C】（建表/函数，纯新增，零影响）
--   2) 改前端：登录用 verify_pin 拿 token；各表读写改调对应 RPC
--   3) 全部前端迁完并部署、验证 OK 后，再对每张表跑【D】开 RLS 锁 anon
--   （可以一张表一张表来：某表的 RPC+前端就绪了，才锁那张表）
-- ============================================================

-- ── 【A】会话表：只有 definer 函数能碰它 ──
create table if not exists public.sessions (
  token      text primary key,
  name       text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);
alter table public.sessions enable row level security;   -- 不建 anon policy = anon 完全碰不到

-- ── 【B】登录：校验 PIN → 发 token（取代 Phase 1 的 verify_pin）──
create or replace function public.verify_pin(p_pin text)
returns table (token text, name text, is_admin boolean)
language plpgsql security definer set search_path = public as $$
declare v_name text; v_admin boolean; v_token text;
begin
  select p.name, p.is_admin into v_name, v_admin
    from public.passcodes p
   where p.pin = p_pin and p.enabled = true
   limit 1;
  if v_name is null then return; end if;          -- PIN 错 → 回空

  update public.passcodes set last_used = now() where pin = p_pin;
  v_token := encode(gen_random_bytes(32), 'hex'); -- 256-bit 随机 token
  insert into public.sessions(token, name, is_admin) values (v_token, v_name, v_admin);
  return query select v_token, v_name, v_admin;
end; $$;
revoke all on function public.verify_pin(text) from public;
grant execute on function public.verify_pin(text) to anon;

-- ── 内部小工具：token → 身份（过期即失效）──
create or replace function public._session(p_token text)
returns public.sessions language sql security definer set search_path = public as $$
  select * from public.sessions where token = p_token and expires_at > now() limit 1;
$$;

-- ── 登出（可选）──
create or replace function public.logout(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.sessions where token = p_token;
$$;
grant execute on function public.logout(text) to anon;

-- ============================================================
-- 【C】数据 RPC —— 以 students 为完整范例，其它表(programs/course_master/audit_log)照抄这个模式
-- ============================================================

-- 读：任何有效 session 都能读
create or replace function public.list_students(p_token text)
returns setof public.students
language plpgsql security definer set search_path = public as $$
begin
  if (select 1 from public._session(p_token)) is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return query select * from public.students;
end; $$;
grant execute on function public.list_students(text) to anon;

-- 写：示范用整行 jsonb upsert（按 students 主键冲突即更新）。
-- ⚠️ 这里用 jsonb 通用写法，省去逐列枚举；正式用时建议改成显式列，更安全。
create or replace function public.save_student(p_token text, p_row jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  s := public._session(p_token);
  if s.token is null then raise exception 'unauthorized' using errcode='28000'; end if;
  -- 若只允许管理员写，取消下一行注释：
  -- if not s.is_admin then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.students
  select * from jsonb_populate_record(null::public.students, p_row)
  on conflict (id) do update
    set name = excluded.name;  -- ← 按实际需要补齐要更新的列
end; $$;
grant execute on function public.save_student(text, jsonb) to anon;

-- 删：仅管理员
create or replace function public.delete_student(p_token text, p_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  s := public._session(p_token);
  if s.token is null or not s.is_admin then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.students where id = p_id;
end; $$;
grant execute on function public.delete_student(text, text) to anon;

-- ============================================================
-- 【D】（前端某表迁完并部署后才执行）开 RLS、锁死 anon 直连那张表
--     RPC 是 definer 身份照常能读写；anon 的 REST 直连一律 401/403。
-- ============================================================
-- alter table public.students     enable row level security;  -- 之后再跑
-- alter table public.passcodes    enable row level security;  -- Phase 1 第3段（登录已走 RPC 后）
-- alter table public.audit_log    enable row level security;
-- alter table public.programs     enable row level security;
-- alter table public.course_master enable row level security;
