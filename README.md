# Keys99 CRM

Channel Partner CRM for real estate: leads, customers, bookings and commissions.

**Stack:** plain HTML, CSS and JavaScript + Supabase. No build step, no Node.js.

## Pages
- `index.html` Dashboard: KPIs, lead trend, sources, pipeline, visits, follow-ups, agents, commission (date-range filter)
- `leads.html` Leads: tabs, filters, search, paging, CSV export, Add/Edit lead, notes, follow-ups
- `customer.html?id=L-5` Customer profile: details, repeat enquiries, timeline, site visits, bookings, lead outcome
- `site-visits.html` Site Visit Management: calendar (month/week/day), day list, visit details + plan + outcome, list and team views, insights, CSV and calendar (.ics) export
- `site-visit.html?id=7` Site Visit Details: customer, project, workflow (confirm / visited / completed), outcome, documents and photos (private storage), agent checklist, ratings and feedback, remarks + next action (creates a follow-up), activity timeline
- `login.html` Sign-in (show/hide password, forgot password, returns you to the page you were on); `reset.html` sets a new password from the emailed link

## Reusable dropdown (`js/dropdown.js`)
Every `<select>` rendered through `render()` or a modal is upgraded to a styled dropdown automatically; the native
`<select>` stays in the DOM (hidden), so `.value`, `FormData`, `onchange` and `required` keep working.
```html
<select name="status">...</select>             <!-- upgraded automatically -->
<select data-native>...</select>               <!-- opt out -->
<select data-search>...</select>               <!-- always show the search box (shown by default above 8 options) -->
<select data-placeholder="Pick one">...</select>
```
Or build one from code:
```js
const dd = Dropdown.create({ options: ["A", { value: "b", label: "B" }], value: "b", placeholder: "Choose…",
                             searchable: true, name: "field", onChange: (value, label) => {} });
container.appendChild(dd.el);   // dd.value, dd.setValue("a"), dd.setOptions([...]), dd.setDisabled(true)
```
Keyboard: ↑ ↓ Home End Enter Esc Tab and type-to-jump. The list always opens right under the field (above it if there is no room), on phones too.

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
- Password reset emails: Authentication -> URL Configuration -> add your site URL (and `.../reset.html`) to Redirect URLs.
- Keep **Allow new users to sign up** turned off (Authentication -> Sign In / Providers), so only invited users can sign in.

## Live demo
https://deepak27sonwal.github.io/keys99.CRM/ (deployed from `main` by GitHub Actions)
