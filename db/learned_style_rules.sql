-- 校正学習機能 用スキーマ
-- Supabase SQL Editor で実行してください（このリポジトリには migration 機構がないため手動適用）。

-- 1) 学習した「修正ルール」を蓄積するテーブル（テナント全体スコープ）
create table if not exists public.learned_style_rules (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references auth.users (id) on delete cascade,
  rule_text       text not null,                 -- 再利用可能な執筆ルール（命令形・記事内容非依存）
  category        text,                           -- 将来のフィルタ用（現状はテナント全体運用）
  before_example  text,                           -- 抽出元の差分例（説明用・生成には渡さない）
  after_example   text,
  source_job_id   uuid,                           -- どの記事編集から学習したか
  status          text not null default 'active', -- 'active' | 'disabled'
  created_at      timestamptz not null default now()
);

create index if not exists learned_style_rules_tenant_idx
  on public.learned_style_rules (tenant_id, status);

alter table public.learned_style_rules enable row level security;

-- テナント分離: 自分の行のみ参照・操作可。INSERT は with check 必須（テナント分離保護）。
drop policy if exists learned_style_rules_select on public.learned_style_rules;
create policy learned_style_rules_select on public.learned_style_rules
  for select using (auth.uid() = tenant_id);

drop policy if exists learned_style_rules_insert on public.learned_style_rules;
create policy learned_style_rules_insert on public.learned_style_rules
  for insert with check (auth.uid() = tenant_id);

drop policy if exists learned_style_rules_update on public.learned_style_rules;
create policy learned_style_rules_update on public.learned_style_rules
  for update using (auth.uid() = tenant_id) with check (auth.uid() = tenant_id);

drop policy if exists learned_style_rules_delete on public.learned_style_rules;
create policy learned_style_rules_delete on public.learned_style_rules
  for delete using (auth.uid() = tenant_id);

-- 2) 学習機能のオンオフ（テナント単位）
alter table public.user_profiles
  add column if not exists learning_enabled boolean not null default true;
