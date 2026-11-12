// Pure logic for the capture-lead Edge Function (no Deno / network APIs except fetch + WebCrypto), so it can be unit-tested in Node.

export const PLATFORMS = {
  meta:     { label: "Facebook & Instagram", source: "Meta Ads" },
  google:   { label: "Google Ads", source: "Google Ads" },
  linkedin: { label: "LinkedIn", source: "LinkedIn" },
  whatsapp: { label: "WhatsApp Business", source: "WhatsApp" },
  youtube:  { label: "YouTube", source: "YouTube" },
  website:  { label: "Website / Webhook", source: "Website" },
};

// Field names we recognise for each CRM field (first match wins). Users can add their own per integration (Field Mapping tab).
export const ALIASES = {
  name: ["full_name", "name", "fullname", "your_name", "customer_name", "lead_name", "contact_name", "user_name"],
  phone: ["phone_number", "phone", "mobile", "mobile_number", "contact_number", "contact", "whatsapp", "whats_app", "whatsapp_number", "tel", "telephone", "cell", "primary_phone"],
  email: ["email", "email_address", "work_email", "e_mail"],
  interest: ["interest", "requirement", "message", "comments", "comment", "enquiry", "inquiry", "looking_for", "configuration", "bhk", "what_are_you_looking_for", "your_requirement", "notes"],
  project: ["project", "project_name", "property", "property_name", "interested_project"],
  developer: ["developer", "builder"],
  budget: ["budget", "budget_range", "your_budget"],
  location: ["location", "preferred_location", "city", "area", "locality"],
};

export const normKey = (k) => String(k ?? "").trim().replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clean = (v, n = 2000) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim().slice(0, n));

export function normalizePhone(v) {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.slice(-10);                       // +91 98765 43210, 098765 43210, 9876543210 -> 9876543210
}

// Flatten nested JSON into { normalized_key: "value" }. Nested keys are stored as parent_child and as the bare child key.
export function flatten(obj, out = {}, prefix = "", depth = 0) {
  if (obj === null || obj === undefined || depth > 4 || Object.keys(out).length > 300) return out;
  if (Array.isArray(obj)) {
    if (obj.every((x) => x === null || typeof x !== "object")) { const v = clean(obj.join(", ")); if (v && prefix && !(prefix in out)) out[prefix] = v; return out; }
    obj.forEach((x, i) => {
      if (x && typeof x === "object" && "name" in x && ("value" in x || "values" in x)) { const k = normKey(x.name), v = clean(Array.isArray(x.values) ? x.values.join(", ") : (x.value ?? x.values)); if (k && v && !(k in out)) out[k] = v; }
      else flatten(x, out, prefix + (prefix ? "_" : "") + i, depth + 1);
    });
    return out;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (Object.keys(out).length > 300) break;
      const nk = normKey(k); if (!nk) continue;
      if (v !== null && typeof v === "object") { flatten(v, out, prefix ? `${prefix}_${nk}` : nk, depth + 1); continue; }
      const val = clean(v); if (!val) continue;
      const full = prefix ? `${prefix}_${nk}` : nk;
      if (!(full in out)) out[full] = val;
      if (prefix && !(nk in out)) out[nk] = val;
    }
    return out;
  }
  const v = clean(obj); if (v && prefix && !(prefix in out)) out[prefix] = v;
  return out;
}

// Words that identify a CRM field inside a free-text question name, e.g. "what_is_your_budget" -> budget.
const FUZZY = { phone: ["phone", "mobile"], email: ["email"], budget: ["budget"], location: ["location", "city"], project: ["project"], interest: ["requirement", "looking_for", "bhk"] };
const SKIP_PREFIX = /^(campaign|adset|ad|form|page|utm|lead|platform|created|is)_/;
function pick(flat, aliases, field) {
  for (const a of aliases) { const v = flat[normKey(a)]; if (v) return v; }
  for (const w of FUZZY[field] || []) for (const [k, v] of Object.entries(flat)) if (v && !SKIP_PREFIX.test(k) && k.includes(w)) return v;
  return "";
}

// mapping = { phone: "mobile_no, contact", ... } custom names are tried before the built-in ones
export function mapLead(flat, mapping = {}) {
  const custom = (f) => String(mapping?.[f] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const out = {};
  for (const f of Object.keys(ALIASES)) out[f] = pick(flat, [...custom(f), ...ALIASES[f]], f);
  if (!out.name) out.name = [flat.first_name, flat.last_name].filter(Boolean).join(" ").trim();
  return out;
}

export function validateLead(m) {
  const phone = normalizePhone(m.phone);
  if (!phone) return { error: m.phone ? `Invalid phone number "${clean(m.phone, 30)}"` : "Missing phone number" };
  const emailName = m.email ? String(m.email).split("@")[0] : "";
  return { phone, name: clean(m.name, 120) || emailName || "Unknown" };
}

// ---------------- platform parsers: each returns an array of items ----------------
// item = { flat, extra } for a lead,  { ref } for a Meta lead notification that still needs fetching,  { skip } to ignore.

const asArray = (b) => (Array.isArray(b) ? b.slice(0, 20) : [b]);

export function parseMeta(body) {
  const items = [];
  for (const b of asArray(body)) {
    if (b && b.object === "page" && Array.isArray(b.entry)) {                         // Meta Webhooks "leadgen" notification: only ids
      for (const e of b.entry) for (const c of e.changes || []) {
        if (c.field === "leadgen" && c.value && c.value.leadgen_id) items.push({ ref: { leadgen_id: String(c.value.leadgen_id), page_id: c.value.page_id || e.id, form_id: c.value.form_id, ad_id: c.value.ad_id } });
        else items.push({ skip: "Ignored a non-lead Meta notification" });
      }
    } else if (b && typeof b === "object") {                                           // Full lead (Graph "field_data" or a flat Zapier/Make payload)
      const flat = flatten(b);
      items.push({ flat, extra: metaExtra(b, flat) });
    }
  }
  return items;
}
function metaExtra(b, flat) {
  return { lead_id: clean(b.id || b.leadgen_id || flat.lead_id || flat.leadgen_id), page_id: clean(b.page_id || flat.page_id), page_name: clean(flat.page_name), form_id: clean(b.form_id || flat.form_id), form_name: clean(b.form_name || flat.form_name),
    campaign_id: clean(b.campaign_id || flat.campaign_id), campaign_name: clean(b.campaign_name || flat.campaign_name), adset_id: clean(b.adset_id || flat.adset_id), adset_name: clean(b.adset_name || flat.adset_name),
    ad_id: clean(b.ad_id || flat.ad_id), ad_name: clean(b.ad_name || flat.ad_name), platform: clean(b.platform || flat.platform) };
}

export function parseGoogle(body) {
  return asArray(body).map((b) => {
    const flat = {};
    for (const c of b.user_column_data || []) { const v = clean(c.string_value ?? c.value); if (!v) continue; for (const k of [normKey(c.column_id), normKey(c.column_name)]) if (k && !(k in flat)) flat[k] = v; }
    for (const [k, v] of Object.entries(b)) if (typeof v !== "object" && v !== null && normKey(k) !== "google_key" && !(normKey(k) in flat)) flat[normKey(k)] = clean(v);
    return { flat, extra: { lead_id: clean(b.lead_id), form_id: clean(b.form_id), campaign_id: clean(b.campaign_id), ad_id: clean(b.creative_id || b.adgroup_id), form_name: clean(b.form_name), platform: "google", is_test: b.is_test === true } };
  });
}

export function parseWhatsApp(body) {
  const items = [];
  for (const b of asArray(body)) for (const e of (b && b.entry) || []) for (const c of e.changes || []) {
    const v = c.value || {};
    if (!Array.isArray(v.messages) || !v.messages.length) { items.push({ skip: "Ignored a WhatsApp status update (no inbound message)" }); continue; }
    for (const m of v.messages) {
      const profile = ((v.contacts || []).find((x) => x.wa_id === m.from) || (v.contacts || [])[0] || {}).profile || {};
      const text = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || (m.type ? `[${m.type} message]` : "");
      items.push({ flat: { name: clean(profile.name), phone: clean(m.from), message: clean(text) }, extra: { lead_id: clean(m.id), platform: "whatsapp", form_name: "WhatsApp chat" } });
    }
  }
  return items;
}

export function parseGeneric(body) {
  return asArray(body).filter((b) => b && typeof b === "object").map((b) => {
    const flat = flatten(b);
    return { flat, extra: { lead_id: "", form_name: clean(flat.form_name || flat.form || flat.form_id), campaign_name: clean(flat.utm_campaign || flat.campaign_name || flat.campaign), source_link: clean(flat.page_url || flat.landing_page || flat.url || flat.page || flat.referrer), platform: "" } };
  });
}

export function parsePayload(platform, body) {
  if (platform === "meta") return parseMeta(body);
  if (platform === "google") return parseGoogle(body);
  if (platform === "whatsapp") return parseWhatsApp(body);
  return parseGeneric(body);
}

// Meta only sends ids. Fetch the real lead from the Graph API with the page access token (never logged or returned).
export async function fetchMetaLead(ref, token, fetchFn = fetch) {
  const get = async (id, fields) => {
    let res;                                                    // token goes in a header (never in the URL), and network errors are sanitised
    try { res = await fetchFn(`https://graph.facebook.com/${encodeURIComponent(id)}?fields=${fields}`, { headers: { Authorization: `Bearer ${token}` } }); }
    catch { throw new Error("Meta Graph API: could not reach Meta"); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error("Meta Graph API: " + ((j.error && j.error.message) || res.status));
    return j;
  };
  const lead = await get(ref.leadgen_id, "created_time,id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data,platform,is_organic");
  let form = null; try { if (lead.form_id) form = await get(lead.form_id, "name"); } catch { /* form name is optional */ }
  const flat = flatten(lead.field_data || []);
  return { flat, answers: answersFromFieldData(lead.field_data), extra: { ...metaExtra(lead, flat), page_id: ref.page_id || "", form_name: form && form.name ? clean(form.name) : "" } };
}

// ---------------- helpers for the server ----------------
export const dedupeWindowMinutes = (platform) => (platform === "whatsapp" ? 7 * 24 * 60 : 10);
export const dedupeKey = (platform, extra) => (extra.lead_id ? (platform === "meta" ? extra.lead_id : `${platform}:${extra.lead_id}`) : null);
export const formInfo = (platform, extra) => ({ form_name: extra.form_name || (extra.form_id ? `Form ${extra.form_id}` : null), form_platform: platform === "meta" ? (extra.platform === "ig" ? "Instagram" : "Facebook") : PLATFORMS[platform].label });

export function buildEnquiryRow({ platform, mapped, phone, name, extra, defaults = {}, raw }) {
  return {
    name, phone, email: mapped.email || null, interest: mapped.interest || null, project: mapped.project || defaults.default_project || null, developer: mapped.developer || null,
    budget: mapped.budget || null, location: mapped.location || null, source: PLATFORMS[platform].source, source_link: extra.source_link || null,
    meta_lead_id: dedupeKey(platform, extra), meta_page_id: extra.page_id || null, meta_page_name: extra.page_name || defaults.page || null, meta_form_id: extra.form_id || null, meta_form_name: extra.form_name || null,
    meta_campaign_id: extra.campaign_id || null, meta_campaign_name: extra.campaign_name || null, meta_adset_id: extra.adset_id || null, meta_adset_name: extra.adset_name || null,
    meta_ad_id: extra.ad_id || null, meta_ad_name: extra.ad_name || null, meta_platform: extra.platform || null, meta_raw_data: raw ?? null,
  };
}

export async function sha256Hex(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function ctEqual(a, b) {                      // constant-time string compare
  a = String(a); b = String(b); let r = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
export const trimPayload = (o, n = 3500) => { try { const s = JSON.stringify(o); return s.length <= n ? o : { truncated: true, preview: s.slice(0, n) }; } catch { return null; } };

// Remove anything that looks like a token from text that may be shown to users.
export const scrub = (m) => String(m ?? "").replace(/(access_token=|Bearer\s+)[^&\s)"']+/gi, "$1***").slice(0, 300);

// Never log or store credentials that arrive inside a payload (e.g. Google Ads sends the shared key as "google_key").
const SENSITIVE = /^(google_key|secret|webhook_secret|x_webhook_secret|access_token|token|password|api_key)$/;
export function redact(b) {
  if (Array.isArray(b)) return b.slice(0, 20).map(redact);
  if (b && typeof b === "object") { const o = {}; for (const [k, v] of Object.entries(b)) o[k] = SENSITIVE.test(normKey(k)) ? "[redacted]" : v; return o; }
  return b;
}

// Meta's Lead Ads Testing Tool fills every field with "<test lead: dummy data for ...>". When an integration has
// config.accept_test_leads on (off by default), such leads are saved with a clearly marked placeholder phone so the flow can be seen end to end.
export const isMetaTestLead = (flat) => Object.values(flat || {}).some((v) => /<test lead: dummy data/i.test(String(v)));
export function applyTestLead(mapped) {
  mapped.phone = "0000000000"; mapped.name = "Test Lead (Meta)"; mapped.email = ""; mapped.project = ""; mapped.developer = ""; mapped.budget = ""; mapped.location = "";
  mapped.interest = "[Meta test lead - safe to delete]";
  return mapped;
}

// Find which Facebook Page(s) a pasted token belongs to. A (long-lived) USER token imports every Page the user granted, each with its own
// Page token; a PAGE token registers just that one Page. Tokens are sent in a header and never returned or logged.
export async function discoverPages(token, fetchFn = fetch) {
  const get = async (path) => {
    let res;
    try { res = await fetchFn(`https://graph.facebook.com/${path}`, { headers: { Authorization: `Bearer ${token}` } }); }
    catch { throw new Error("Meta Graph API: could not reach Meta"); }
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok && !j.error, j };
  };
  const acc = await get("me/accounts?fields=id,name,access_token&limit=25");
  if (acc.ok && Array.isArray(acc.j.data)) {                                       // a user token
    let rows = [...acc.j.data], cur = acc.j.paging && acc.j.paging.cursors && acc.j.paging.cursors.after, more = acc.j.paging && acc.j.paging.next;
    for (let n = 0; more && cur && n < 20; n++) {                                  // Meta returns Pages in batches: keep asking until there are no more
      const nx = await get(`me/accounts?fields=id,name,access_token&limit=25&after=${encodeURIComponent(cur)}`);
      if (!nx.ok || !Array.isArray(nx.j.data)) break;
      rows = rows.concat(nx.j.data); cur = nx.j.paging && nx.j.paging.cursors && nx.j.paging.cursors.after; more = nx.j.paging && nx.j.paging.next;
    }
    const seen = new Set(), pages = [];
    for (const p of rows) if (p && /^\d+$/.test(String(p.id)) && p.access_token && !seen.has(String(p.id))) { seen.add(String(p.id)); pages.push({ id: String(p.id), name: clean(p.name, 120) || "Page " + p.id, token: p.access_token }); }
    if (!pages.length) throw new Error("This token has no Pages. Grant pages_show_list and tick your Pages when Meta asks which to allow.");
    return pages.slice(0, 200);
  }
  const me = await get("me?fields=id,name");                                       // a Page token (/me/accounts is not available on a Page)
  if (me.ok && /^\d+$/.test(String(me.j.id || ""))) return [{ id: String(me.j.id), name: clean(me.j.name, 120) || "Page " + me.j.id, token }];
  throw new Error("Meta Graph API: " + ((me.j.error && me.j.error.message) || (acc.j.error && acc.j.error.message) || "the token was not accepted"));
}

// ---- Facebook Page subscriptions (a Page must be subscribed to the app's "leadgen" field before Meta sends its leads) ----
async function graphCall(path, token, method = "GET", fetchFn = fetch) {
  let res;
  try { res = await fetchFn(`https://graph.facebook.com/${path}`, { method, headers: { Authorization: `Bearer ${token}` } }); }
  catch { return { ok: false, j: { error: { message: "could not reach Meta" } } }; }
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok && !j.error, j };
}
const gErr = (r) => scrub("Meta: " + ((r.j.error && r.j.error.message) || "request failed")).slice(0, 160);

export async function subscribePage(pageId, token, fetchFn = fetch) {
  const r = await graphCall(`${encodeURIComponent(pageId)}/subscribed_apps?subscribed_fields=leadgen`, token, "POST", fetchFn);
  const ok = r.ok && r.j.success === true;
  return { id: String(pageId), ok, error: ok ? null : gErr(r) };
}
export async function getAppId(token, fetchFn = fetch) {                      // a Page token knows which app it belongs to
  const r = await graphCall("app?fields=id", token, "GET", fetchFn);
  return r.ok && /^\d+$/.test(String(r.j.id || "")) ? String(r.j.id) : null;
}
export async function pageStatus(pageId, token, appId, fetchFn = fetch) {
  const r = await graphCall(`${encodeURIComponent(pageId)}/subscribed_apps`, token, "GET", fetchFn);
  if (!r.ok) return { id: String(pageId), subscribed: false, error: gErr(r) };
  const apps = Array.isArray(r.j.data) ? r.j.data : [];
  const mine = apps.find((a) => (appId ? String(a.id) === String(appId) : true) && (a.subscribed_fields || []).includes("leadgen"));
  return { id: String(pageId), subscribed: !!mine, error: null };
}
export async function mapLimit(items, n, fn) {                                 // run fn over items, at most n at a time, keeping order
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

// ---- full form details: every question and answer a lead sent, kept in readable form for the lead page ----
const STD_KEYS = new Set([...ALIASES.name, ...ALIASES.phone, ...ALIASES.email, "first_name", "last_name"].map(normKey));
const SYSTEM_KEY = /(^|_)ids?$|^(campaign|adset|ad|form|page|platform|utm|created|is|lead|google)_|^(created_time|_test)$/;
export const prettyLabel = (k) => { const t = String(k ?? "").replace(/[_\s]+/g, " ").replace(/\?+\s*$/, "").trim(); return t ? t[0].toUpperCase() + t.slice(1) : ""; };
const prettyAnswer = (v) => clean(String(v ?? "").replace(/_/g, " "), 300);
// Meta Graph "field_data": [{ name: "plots_size_required?", values: ["1750_sq.ft"] }, ...]
export function answersFromFieldData(fd) {
  const out = [];
  for (const f of Array.isArray(fd) ? fd : []) {
    if (!f || STD_KEYS.has(normKey(f.name))) continue;
    const q = prettyLabel(f.name), a = prettyAnswer(Array.isArray(f.values) ? f.values.join(", ") : f.value);
    if (q && a) out.push({ q, a });
    if (out.length >= 40) break;
  }
  return out;
}
// Any other payload (Zapier / Make / website / Google): every field that is not a name, phone, email or a technical id.
export function answersFromFlat(flat) {
  const out = [];
  for (const [k, v] of Object.entries(flat || {})) {
    if (STD_KEYS.has(k) || SYSTEM_KEY.test(k) || /^\d+(_|$)/.test(k)) continue;
    const a = prettyAnswer(v), q = prettyLabel(k);
    if (q && a) out.push({ q, a });
    if (out.length >= 40) break;
  }
  return out;
}
