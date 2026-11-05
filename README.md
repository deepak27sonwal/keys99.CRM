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

## Connect Supabase
1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Authentication -> Users -> add a user (email + password).
3. Put the Project URL and anon/publishable key in `js/config.js`.

## Live demo
https://deepak27sonwal.github.io/keys99.CRM/ (deployed from `main` by GitHub Actions)
