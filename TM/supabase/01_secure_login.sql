-- ============================================================
-- TM 排课 · 安全加固 Phase 1：登录改 RPC + 锁住 passcodes 表
-- 目标：让公开 anon key 再也无法直接读出所有 PIN
-- 性能：verify_pin 是一次带索引的查找，和现在 GET passcodes 一样快（更小负载）
-- ============================================================

-- ── 1. 索引（保证 verify_pin 查找走索引，微秒级）──
create index if not exists idx_passcodes_pin on public.passcodes (pin);

-- ── 2. 登录 RPC：security definer，绕过 RLS 只回必要字段，并顺手更新 last_used ──
--    anon 只能"问一个 PIN 对不对"，无法把整张表拖出来。
create or replace function public.verify_pin(p_pin text)
returns table (name text, is_admin boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.passcodes
     set last_used = now()
   where pin = p_pin and enabled = true;

  return query
    select p.name, p.is_admin
      from public.passcodes p
     where p.pin = p_pin and p.enabled = true
     limit 1;
end;
$$;

-- 只允许 anon 执行这个函数，不允许直接碰表
revoke all on function public.verify_pin(text) from public;
grant execute on function public.verify_pin(text) to anon, authenticated;

-- ============================================================
-- ⚠️ 下面第 3 段「锁表」要等前端已经改用 verify_pin 并部署后再执行，
--    否则旧前端还在直读 passcodes 会立刻登录失败。
-- ============================================================

-- ── 3.（前端部署后再跑）开 RLS、不给 anon 任何直连策略 ──
--    RPC 是 definer 身份，照常能读；anon 的 REST 直连会被拒。
-- alter table public.passcodes enable row level security;
-- 不建任何 anon policy = anon 不能 select/insert/update/delete 这张表。
-- （管理员的"用户管理"UI 目前也走 anon 直连，会一起失效；
--   那部分要挪到带身份校验的 RPC —— 见 Phase 2，别急着锁。）

-- 验证：锁表后，下面这条应回 401/403（而不是 200）
--   curl -H "apikey: <ANON>" \
--     "https://xzplzckugyvutsqocrtw.supabase.co/rest/v1/passcodes?select=pin&limit=1"
