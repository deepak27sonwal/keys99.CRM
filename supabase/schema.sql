-- Keys99 CRM uses the existing public.enquiries table as its leads table (no extra tables).
-- Applied to the "Housing mantra enquiries" Supabase project. Safe to run once.

-- CRM fields (nullable or defaulted, so the landing-page insert keeps working).
alter table public.enquiries
  add column if not exists status        text  not null default 'New',
  add column if not exists follow_up     timestamptz,
  add column if not exists budget        text,
  add column if not exists location      text,
  add column if not exists property_type text,
  add column if not exists bhk           text,
  add column if not exists priority      text,
  add column if not exists notes         text,
  add column if not exists activities    jsonb not null default '[]'::jsonb;

alter table public.enquiries
  add constraint enquiries_status_check
  check (status in ('New','Contacted','Interested','Qualified','Site Visit','Negotiation','Booked','Lost'));

create index if not exists enquiries_status_idx     on public.enquiries (status);
create index if not exists enquiries_created_at_idx on public.enquiries (created_at desc);

-- Signed-in CRM users can read, add and update enquiries (no delete).
-- The existing "Allow anonymous enquiry insert" policy for the landing page is untouched.
create policy "CRM users can read enquiries"   on public.enquiries for select to authenticated using (true);
create policy "CRM users can update enquiries" on public.enquiries for update to authenticated using (true) with check (true);
create policy "CRM users can insert enquiries" on public.enquiries for insert to authenticated with check (true);
