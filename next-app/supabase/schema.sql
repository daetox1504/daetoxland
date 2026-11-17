create extension if not exists pgcrypto;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market_type text not null check (market_type in ('rent','sale')),
  public_number text,
  name text not null,
  category text not null default '기타',
  address text not null default '',
  status text not null default '준비',
  favorite boolean not null default false,
  manager text not null default '',
  data jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_number text,
  name text not null,
  market_type text not null check (market_type in ('rent','sale')),
  category text not null default '기타',
  phone text not null default '',
  budget text not null default '',
  status text not null default '상담중',
  memo text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  log_type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.properties enable row level security;
alter table public.customers enable row level security;
alter table public.activity_logs enable row level security;

create policy "Users manage their properties" on public.properties for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their customers" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their activity logs" on public.activity_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
