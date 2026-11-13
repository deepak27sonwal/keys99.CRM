// Pure helpers for the send-push Edge Function (unit-tested in Node).
const clean = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
// manager_name is jsonb: a string, or an array of strings
export const assignedTo = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : "");

// What the lock screen shows for a new lead. The phone number is deliberately left out.
export function buildPayload(row) {
  const id = Number(row.id), name = clean(row.name, 60) || "New enquiry", project = clean(row.project, 60), by = clean(assignedTo(row.manager_name), 40);
  const source = clean(row.source, 30) || "Website";
  return {
    title: `New lead · ${source}`,
    body: clean([name, project, by ? "assigned to " + by : ""].filter(Boolean).join(" · "), 140),
    url: `leads.html?q=${encodeURIComponent("L-" + id)}`, tag: `lead-${id}`, id,
  };
}
export const testPayload = () => ({ title: "Keys99 CRM", body: "Notifications are working on this device.", url: "leads.html", tag: "k99-test", id: 0 });

// Push services answer 404 / 410 when a device has unsubscribed or the subscription expired: drop those rows.
export const isGone = (err) => !!err && (err.statusCode === 404 || err.statusCode === 410);
