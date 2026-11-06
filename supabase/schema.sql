-- Keys99 CRM schema. Run in the Supabase SQL editor of YOUR Keys99 project.
-- Only signed-in users (Authentication -> Users) can read or write data.

create sequence if not exists lead_code_seq start 28652;

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  lead_code     text unique not null default ('L-' || nextval('lead_code_seq')),
  name          text not null,
  mobile        text,
  email         text,
  requirement   text,
  budget        text,
  project       text,
  location      text,
  agent         text,
  status        text not null default 'New'
                check (status in ('New','Contacted','Interested','Qualified','Site Visit','Negotiation','Booked','Lost')),
  follow_up     timestamptz,
  source        text,
  property_type text,
  bhk           text,
  priority      text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  type        text not null default 'call' check (type in ('call','visit','doc','new')),
  title       text not null,
  description text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists activities_lead_id_idx on public.activities(lead_id);

alter table public.leads      enable row level security;
alter table public.activities enable row level security;

create policy "authenticated full access" on public.leads
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.activities
  for all to authenticated using (true) with check (true);
