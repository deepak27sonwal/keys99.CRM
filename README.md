# Keys99 CRM

Channel Partner CRM for real estate: leads, customers, bookings and commissions.

**Stack:** plain HTML, CSS and JavaScript + Supabase. No build step, no Node.js.

## Pages
- `index.html` Dashboard (sample data for now)
- `leads.html` Leads Management with Lead Details drawer, tab filters, search and Add Lead
- `customer.html?id=L-28651` Customer Profile
- `login.html` Supabase email/password login

## Run locally
Open `index.html` in a browser, or serve the folder:
```bash
python3 -m http.server 8000
```
It runs in **demo mode** (sample data) until Supabase is configured.

## Supabase
The CRM runs on the **Housing mantra enquiries** project (URL and publishable key are in `js/config.js`).
- Leads are the rows of the existing `enquiries` table. No extra tables.
- `supabase/schema.sql` adds the CRM columns (status, follow_up, budget, ...) and policies for signed-in users.
- To log in, add a user: Supabase dashboard -> Authentication -> Users -> Add user (email + password).

## Live demo
https://deepak27sonwal.github.io/keys99.CRM/ (deployed from `main` by GitHub Actions)
