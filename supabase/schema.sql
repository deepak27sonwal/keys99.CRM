-- Keys99 CRM schema (applied to the "Housing mantra enquiries" Supabase project).
-- Run in the Supabase SQL editor of the project that will host the CRM.
-- Only signed-in users (Authentication -> Users) can read or write data.

create sequence if not exists public.lead_code_seq start 1001;

create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  lead_code        text unique not null default ('L-' || nextval('public.lead_code_seq')),
  name             text not null,
  mobile           text,
  mobile_norm      text generated always as (right(regexp_replace(coalesce(mobile,''), '\D', '', 'g'), 10)) stored,
  email            text,
  requirement      text,
  budget           text,
  project          text,
  developer        text,
  location         text,
  agent            text,
  status           text not null default 'New'
                   check (status in ('New','Contacted','Interested','Qualified','Site Visit','Negotiation','Booked','Lost')),
  follow_up        timestamptz,
  source           text,
  landing_page_url text,
  campaign         text,
  property_type    text,
  bhk              text,
  priority         text,
  notes            text,
  source_project   text,   -- where the lead came from, e.g. 'housing-mantra-enquiries'
  external_id      text,   -- id in that source; (source_project, external_id) is unique
  raw_payload      jsonb,  -- full original submission
  enquiry_count    integer not null default 1,
  last_enquiry_at  timestamptz,
  created_at       timestamptz not null default now(),
  unique (source_project, external_id)
);
create index if not exists leads_mobile_norm_idx on public.leads (mobile_norm);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  type        text not null default 'call' check (type in ('call','visit','doc','new')),
  title       text not null,
  description text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists activities_lead_id_idx on public.activities (lead_id);

alter table public.leads      enable row level security;
alter table public.activities enable row level security;

create policy "authenticated full access" on public.leads
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.activities
  for all to authenticated using (true) with check (true);
