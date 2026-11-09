-- One-time copy of public.enquiries into the CRM (already run on 2026-11-09: 167 leads, 217 activities).
-- One lead per phone number; repeat enquiries become "Enquired Again" activities.
-- Rows with source 'Claude test' are skipped. public.enquiries is only read, never changed.
-- Safe to re-run: leads are keyed on (source_project, external_id).

with ranked as (
  select e.*,
         right(regexp_replace(e.phone, '\D', '', 'g'), 10) as pn,
         row_number() over (partition by right(regexp_replace(e.phone, '\D', '', 'g'), 10) order by e.created_at, e.id) as rn,
         count(*)     over (partition by right(regexp_replace(e.phone, '\D', '', 'g'), 10)) as cnt,
         max(e.created_at) over (partition by right(regexp_replace(e.phone, '\D', '', 'g'), 10)) as last_at
  from public.enquiries e
  where coalesce(e.source, '') <> 'Claude test'
    and e.phone is not null and btrim(e.phone) <> ''
)
insert into public.leads
  (name, mobile, email, requirement, project, developer, source, landing_page_url, agent,
   status, source_project, external_id, raw_payload, created_at, enquiry_count, last_enquiry_at)
select coalesce(nullif(btrim(r.name), ''), 'Unknown'), r.phone, r.email, r.interest, r.project, r.developer,
       coalesce(nullif(btrim(r.source), ''), 'Website'), r.source_link,
       nullif(btrim(r.manager_name #>> '{}'), ''),
       'New', 'housing-mantra-enquiries', r.id::text, to_jsonb(r) - 'meta_raw_data',
       r.created_at, r.cnt::int, r.last_at
from ranked r
where r.rn = 1
on conflict (source_project, external_id) do nothing;

insert into public.activities (lead_id, type, title, description, created_at)
select l.id, 'new',
       case when r.rn = 1 then 'Lead Created' else 'Enquired Again' end,
       case when r.rn = 1 then 'Enquiry received from ' || coalesce(nullif(btrim(r.source), ''), 'Website')
            else 'Repeat enquiry' || coalesce(' for ' || nullif(btrim(r.project), ''), '') end,
       r.created_at
from (
  select e.*, right(regexp_replace(e.phone, '\D', '', 'g'), 10) as pn,
         row_number() over (partition by right(regexp_replace(e.phone, '\D', '', 'g'), 10) order by e.created_at, e.id) as rn
  from public.enquiries e
  where coalesce(e.source, '') <> 'Claude test' and e.phone is not null and btrim(e.phone) <> ''
) r
join public.leads l on l.mobile_norm = r.pn and l.source_project = 'housing-mantra-enquiries'
where not exists (select 1 from public.activities a where a.lead_id = l.id and a.created_at = r.created_at and a.type = 'new');
