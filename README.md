# Keys99 CRM

Channel Partner CRM for real estate: leads, customers, bookings and commissions.

**Stack:** plain HTML, CSS and JavaScript + Supabase. No build step, no Node.js.

## Pages
- `index.html` Dashboard: KPIs, lead trend, sources, pipeline, visits, follow-ups, agents, commission (date-range filter)
- `leads.html` Leads: tabs, filters, search, paging, CSV export, Add/Edit lead, notes, follow-ups
- `customer.html?id=L-5` Customer profile: details, repeat enquiries, timeline, site visits, bookings, lead outcome
- `login.html` Supabase email/password login

## Run locally
Serve the folder and sign in with a Supabase user (there is no demo mode; all data is real):
```bash
python3 -m http.server 8000
```

## Supabase
The CRM runs on the **Housing mantra enquiries** project (URL and publishable key are in `js/config.js`).
- Leads are the rows of the existing `enquiries` table (the landing-page form keeps writing there).
- `site_visits` and `bookings` hold visits, deals and brokerage commission.
- `supabase/schema.sql` has every change (CRM columns, the two tables, Row Level Security: signed-in users only).
- To log in, add a user: Supabase dashboard -> Authentication -> Users -> Add user (email + password).

## Live demo
https://deepak27sonwal.github.io/keys99.CRM/ (deployed from `main` by GitHub Actions)
