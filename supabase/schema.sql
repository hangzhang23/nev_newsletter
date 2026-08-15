-- 电车周志 · 新车发布数据库 —— 建表 DDL
-- 在 Supabase SQL Editor 执行（一期纯静态可暂缓，接入时执行）

-- 车型表
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  brand text not null,
  brand_color text,
  is_primary_brand boolean default false,
  release_date date,
  price_range text,
  price_min numeric,
  price_max numeric,
  positioning text,
  dimensions text,
  wheelbase integer,
  powertrain text,
  power text,
  acceleration text,
  battery_capacity text,
  range_cltc text,
  adas_chip text,
  lidar text,
  computing_power text,
  cabin_chip text,
  screen text,
  highlights text,
  competitors text,
  source text,
  week text,
  created_at timestamptz default now()
);

-- 品牌表
create table if not exists public.brands (
  name text primary key,
  color text,
  is_primary boolean default false,
  frequency integer default 0
);

-- 周元数据表（ingest 写入，prerender 用于走势图周范围）
create table if not exists public.weeks (
  week text primary key,
  start_date date not null,
  end_date date not null
);

-- 索引
create index if not exists idx_vehicles_brand on public.vehicles(brand);
create index if not exists idx_vehicles_release_date on public.vehicles(release_date);
create index if not exists idx_vehicles_week on public.vehicles(week);

-- 行级安全（写入走 service_role 绕过，前端不直连，读由脚本完成）
alter table public.vehicles enable row level security;
alter table public.brands enable row level security;
alter table public.weeks enable row level security;
