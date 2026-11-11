-- Metfone Express Agent Contract Filler — Supabase schema
-- Tables: branches, agents, contracts, settings + private storage bucket "contracts".
--
-- Security model: the app talks to Supabase ONLY from the Next.js server
-- (Route Handlers / Server Components) using the secret (service-role) key.
-- RLS is enabled on every table with NO policies, and anon/authenticated
-- roles have no grants, so the public Data API cannot read or write anything.

-- ---------------------------------------------------------------- branches
create table if not exists public.branches (
  code              text primary key check (code = upper(code) and length(code) between 2 and 12),
  province_kh       text not null,
  director_kh       text not null default '',
  director_latin    text not null,
  body_name_format  text not null default 'khmer' check (body_name_format in ('khmer', 'latin')),
  next_seq          integer not null default 1 check (next_seq >= 1),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------- agents
create table if not exists public.agents (
  id                 bigint generated always as identity primary key,
  agent_code         text not null default '',
  branch_code        text not null default '',
  name_kh            text not null,
  name_latin         text not null default '',
  id_number          text not null default '',
  id_number_norm     text not null default '',
  phone              text not null default '',
  phone_norm         text not null default '',
  email              text not null default '',
  house_no           text not null default '',
  street             text not null default '',
  village            text not null default '',
  commune            text not null default '',
  district           text not null default '',
  province           text not null default '',
  address_full       text not null default '',
  bank_name          text not null default 'eMoney',
  bank_account_name  text not null default '',
  bank_account_no    text not null default '',
  company_name       text not null default '',
  company_law        text not null default '',
  company_reg_no     text not null default '',
  company_reg_date   text not null default '',
  company_tax_no     text not null default '',
  company_address    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists agents_agent_code_uniq
  on public.agents (upper(agent_code)) where agent_code <> '';
create index if not exists agents_id_number_norm_idx on public.agents (id_number_norm);
create index if not exists agents_phone_norm_idx on public.agents (phone_norm);
create index if not exists agents_branch_code_idx on public.agents (branch_code);

-- ---------------------------------------------------------------- contracts
create table if not exists public.contracts (
  id                bigint generated always as identity primary key,
  contract_no       text not null,
  contract_date     text not null,
  branch_code       text not null,
  agent_id          bigint references public.agents (id) on delete set null,
  agent_name_kh     text not null,
  agent_name_latin  text not null default '',
  agent_phone       text not null default '',
  agent_id_number   text not null default '',
  template_type     text not null check (template_type in ('NEW', 'OLD')),
  eq_printer        boolean not null default false,
  eq_scale          boolean not null default false,
  eq_basket         boolean not null default false,
  eq_deposit_total  integer not null default 0,
  fixed_deposit     integer not null default 50,
  docx_path         text not null default '',   -- object path inside storage bucket "contracts"
  pdf_path          text not null default '',
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists contracts_branch_code_idx on public.contracts (branch_code);
create index if not exists contracts_agent_id_idx on public.contracts (agent_id);
create index if not exists contracts_created_at_idx on public.contracts (created_at desc);

-- ---------------------------------------------------------------- settings
create table if not exists public.settings (
  key    text primary key,
  value  text not null
);

-- ---------------------------------------------------------------- lock down
alter table public.branches  enable row level security;
alter table public.agents    enable row level security;
alter table public.contracts enable row level security;
alter table public.settings  enable row level security;

revoke all on public.branches, public.agents, public.contracts, public.settings from anon, authenticated;

-- Atomically advance a branch's running number (never moves backwards).
create or replace function public.bump_branch_seq(p_code text, p_next integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.branches
     set next_seq = greatest(next_seq, p_next),
         updated_at = now()
   where code = upper(p_code);
$$;

revoke execute on function public.bump_branch_seq(text, integer) from public, anon, authenticated;
grant execute on function public.bump_branch_seq(text, integer) to service_role;

-- ---------------------------------------------------------------- seed data
insert into public.settings (key, value) values
  ('new_digit_style', 'khmer'),
  ('old_digit_style', 'latin')
on conflict (key) do nothing;

insert into public.branches (code, province_kh, director_kh, director_latin, body_name_format, next_seq) values
  ('MONA', 'មណ្ឌលគិរី', 'លាង រដ្ឋា', 'Leang Ratha', 'khmer', 11),
  ('PNPA', 'ភ្នំពេញ', '', 'NGUYEN TRONG TUAN ANH', 'latin', 10)
on conflict (code) do nothing;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts', 'contracts', false, 52428800,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf']
)
on conflict (id) do nothing;
