create extension if not exists pgcrypto;

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  service_title text not null,
  city text not null,
  trust_score numeric(4,2) not null default 4.50,
  distance_km numeric(6,2) not null default 1.00,
  available_minutes integer not null default 60,
  verified_badge boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists demand_requests (
  id uuid primary key default gen_random_uuid(),
  raw_query text not null,
  category text not null,
  urgency text not null,
  country text,
  city text,
  neighborhood text,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  query_text text not null,
  city text,
  demand_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into suppliers (business_name, service_title, city, trust_score, distance_km, available_minutes, verified_badge)
select *
from (
  values
    ('Kingston PipeCare Pro', 'Plumbing and leak repair', 'Kingston', 4.90, 2.10, 35, true),
    ('RapidFix Mechanics', 'Auto diagnostics and roadside support', 'Montego Bay', 4.80, 3.70, 25, true),
    ('Prime Build Electrical', 'Residential electrical and panel upgrades', 'Kingston', 4.70, 4.30, 55, true),
    ('CleanWave Teams', 'Deep cleaning and move-out services', 'Miami', 4.85, 2.80, 45, true),
    ('Metro Creative Studio', 'Graphic design and brand assets', 'Miami', 4.75, 5.20, 120, false)
) as seed(business_name, service_title, city, trust_score, distance_km, available_minutes, verified_badge)
where not exists (select 1 from suppliers limit 1);
