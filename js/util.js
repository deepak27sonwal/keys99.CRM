// Safe HTML templating: every interpolated value is escaped unless wrapped by raw()/html``.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const raw = (s) => ({ __raw: String(s) });
function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => {
    const part = (x) => (x && x.__raw !== undefined ? x.__raw : esc(x));
    out += (Array.isArray(v) ? v.map(part).join("") : part(v)) + strings[i + 1];
  });
  return raw(out);
}
// Swaps a page's markup. Horizontally scrolling chip rows (.tabs-pill on phones) keep their scroll position, and the chosen chip is brought fully
// into view, so a click never makes the row jump back to the start with the chosen chip out of sight.
function render(el, tpl) {
  const keep = [...el.querySelectorAll(".tabs-pill")].map((r) => r.scrollLeft);
  el.innerHTML = tpl.__raw;
  el.querySelectorAll(".tabs-pill").forEach((row, i) => {
    if (row.scrollWidth <= row.clientWidth + 1) return;
    row.scrollLeft = keep[i] || 0;
    const a = row.querySelector(".pill.active"); if (!a) return;
    const r = a.getBoundingClientRect(), b = row.getBoundingClientRect(), pad = 12;
    if (r.left < b.left + pad) row.scrollLeft -= b.left + pad - r.left; else if (r.right > b.right - pad) row.scrollLeft += r.right - (b.right - pad);
  });
  if (window.Dropdown) Dropdown.upgrade(el);
  if (window.lucide) lucide.createIcons();
}
const slug = (s) => String(s).replace(/\s+/g, "-");
const AV_COLORS = ["#0f7a6b", "#e8a91f", "#3b6fe0", "#9b6fe0", "#d9534f", "#2e86de"];
// public URL of a profile photo stored in the "avatars" bucket (path = "<user id>/<file>")
function avatarUrl(path) { const c = window.KEYS99_CONFIG || {}; return path && c.SUPABASE_URL ? c.SUPABASE_URL + "/storage/v1/object/public/avatars/" + String(path).split("/").map(encodeURIComponent).join("/") : ""; }
function avatar(name, size = 32, photo = "") {
  if (photo) return html`<img class="avatar avatar-img" src="${photo}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;
  let h = 0;
  for (const c of String(name || "?")) h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length;
  const ini = String(name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return html`<span class="avatar" style="width:${size}px;height:${size}px;background:${AV_COLORS[h]};font-size:${Math.round(size * 0.38)}px">${ini}</span>`;
}
const badge = (status) => html`<span class="badge s-${slug(status)}">${status}</span>`;
// Date only, e.g. "Nov 08, 2026".
function fmtDay(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d)) return String(ts);
  return d.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function buildingSvg() {
  const bars = [[20, 70, 40], [70, 30, 50], [130, 55, 45], [180, 80, 40]];
  let s = '<svg viewBox="0 0 240 180" preserveAspectRatio="xMidYMax slice"><rect width="240" height="180" fill="#bcdde6" opacity=".6"/>';
  for (const [x, y, w] of bars) {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${180 - y}" fill="#e8eef0"/>`;
    for (let r = 0; r < Math.floor((180 - y) / 14); r++)
      for (let c = 0; c < 3; c++)
        s += `<rect x="${x + 6 + c * ((w - 12) / 3)}" y="${y + 6 + r * 14}" width="${(w - 12) / 3 - 4}" height="8" fill="#3d7f95" opacity=".75"/>`;
  }
  return raw(s + "</svg>");
}

// ---- formatting & helpers ----
function fmtMoney(n) {
  n = Number(n) || 0;
  if (n >= 1e7) return "₹ " + (n / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr";
  if (n >= 1e5) return "₹ " + (n / 1e5).toFixed(1).replace(/\.0$/, "") + " L";
  return "₹ " + n.toLocaleString("en-IN");
}
function relTime(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hr ago";
  if (s < 86400 * 30) return Math.floor(s / 86400) + " d ago";
  return fmtDate(ts);
}
const digits = (s) => String(s || "").replace(/\D/g, "");
function telHref(mobile) { const d = digits(mobile); return d ? "tel:" + (d.length === 10 ? "+91" + d : "+" + d) : "#"; }
function waHref(mobile) { const d = digits(mobile); return d ? "https://wa.me/" + (d.length === 10 ? "91" + d : d) : "#"; }
function toLocalInput(ts) {
  if (!ts) return "";
  const d = new Date(ts); if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // block spreadsheet formula injection
  return '"' + s.replace(/"/g, '""') + '"';
}
function downloadCsv(name, header, rows) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ---- dates & times (local time) ----
const pad2 = (n) => String(n).padStart(2, "0");
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const startOfDay = (d) => { d = new Date(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const fmtTime = (ts) => { const d = new Date(ts); return isNaN(d) ? "—" : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/\u202f/g, " "); };
const fmtLongDay = (d) => { d = new Date(d); return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`; };
// "2026-11-18" + "10:30" (local) -> ISO string
const localISO = (date, time) => new Date(`${date}T${time}`).toISOString();

// ---- secrets & clipboard ----
async function sha256Hex(str) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(str)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// "k99_" + 24 random bytes, base64url. Only its SHA-256 hash is ever stored.
function randomSecret() {
  const a = crypto.getRandomValues(new Uint8Array(24));
  return "k99_" + btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function copyText(text, okMsg = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { prompt("Copy this value:", text); }
}

// "Waiting 25 min" / "2 h" / "3 d" for a lead nobody has touched yet
function fmtWait(min) { return min < 60 ? Math.floor(min) + " min" : min < 1440 ? Math.floor(min / 60) + " h" : Math.floor(min / 1440) + " d"; }
// ---- shared date ranges for the filters on every page (local midnight to midnight; "to" is exclusive) ----
const RANGE_LABELS = { all: "All time", today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 3 months", month: "This month", lastmonth: "Last month" };
// A user-chosen "From - To" period (both dates included). Pages set it with setCustomRange() and then use the key "custom".
let CUSTOM_RANGE = null;
const setCustomRange = (from, to) => { CUSTOM_RANGE = { from, to }; };
const parseYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 ? d : null; };
function rangeBounds(key, now = new Date()) {
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()), day = (n) => new Date(sod.getFullYear(), sod.getMonth(), sod.getDate() + n);
  switch (key) {
    case "today": return { from: sod, to: day(1) };
    case "yesterday": return { from: day(-1), to: sod };
    case "7d": return { from: day(-6), to: day(1) };
    case "30d": return { from: day(-29), to: day(1) };
    case "90d": return { from: day(-89), to: day(1) };
    case "month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    case "lastmonth": return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "custom": { const a = CUSTOM_RANGE && parseYmd(CUSTOM_RANGE.from), z = CUSTOM_RANGE && parseYmd(CUSTOM_RANGE.to); if (!a || !z || a > z) return { from: null, to: null }; return { from: a, to: new Date(z.getFullYear(), z.getMonth(), z.getDate() + 1) }; }
    default: return { from: null, to: null };                                   // "all" (or an unknown value): no limit
  }
}
// the period of the same length right before it, for "compared with" figures (null for all time)
function rangePrev(key, now = new Date()) {
  const b = rangeBounds(key, now); if (!b.from) return null;
  if (key === "month" || key === "lastmonth") { const m = key === "month" ? now.getMonth() - 1 : now.getMonth() - 2; return { from: new Date(now.getFullYear(), m, 1), to: new Date(now.getFullYear(), m + 1, 1) }; }
  const len = b.to - b.from; return { from: new Date(b.from.getTime() - len), to: b.from };
}
// When a lead entered Booking Done / Post Sale (null when it is not in one of them now). Uses the stage history ("Stage changed" entries);
// a lead moved there before that history existed falls back to its booking record date, then to its created date.
// `bookDates` = Map(enquiry_id -> earliest booking_date "YYYY-MM-DD") from the bookings table (optional).
function bookedAt(lead, bookDates) {
  if (!lead || !BOOKED.includes(lead.status)) return null;
  let since = null;
  (lead.acts || []).filter((a) => a && a.type === "stage" && a.at).sort((a, b) => new Date(a.at) - new Date(b.at)).forEach((a) => {
    if (BOOKED.includes(a.to)) { if (!BOOKED.includes(a.from)) since = a.at; } else since = null;
  });
  if (since) return new Date(since);
  const rec = bookDates && bookDates.get(lead.dbId);
  return rec ? new Date(rec + "T00:00:00") : new Date(lead.createdAt);
}
const bookDatesOf = (bookings) => { const m = new Map(); (bookings || []).forEach((b) => { if (!b.booking_date) return; const cur = m.get(b.enquiry_id); if (!cur || b.booking_date < cur) m.set(b.enquiry_id, b.booking_date); }); return m; };
const inRangeTs = (ts, key, now = new Date()) => { const b = rangeBounds(key, now); if (!b.from) return true; const d = new Date(ts); return d >= b.from && d < b.to; };
// the same project? (mirrors the database rule): a missing project can't be "another project"; otherwise equal names or one name starting with the other
const normProj = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const sameProject = (a, b) => { const x = normProj(a), y = normProj(b); return x.length < 3 || y.length < 3 || x === y || x.startsWith(y) || y.startsWith(x); };
const WAIT_ALERT_MIN = 15;

// ---- calendar helpers ----
// the holiday (if any) that covers a day; holiday dates are "yyyy-mm-dd" strings
const holidayOn = (list, d) => { const k = dayKey(d); return (list || []).find((h) => h.starts_on <= k && k <= h.ends_on) || null; };
// occurrences of a (possibly repeating) meeting that overlap [from, to)
function expandMeeting(m, from, to) {
  const s = new Date(m.starts_at), e = new Date(m.ends_at), dur = e - s, out = [];
  if (!m.repeat || m.repeat === "none") { if (e > from && s < to) out.push({ start: s, end: e }); return out; }
  const until = m.repeat_until ? new Date(m.repeat_until + "T23:59:59") : new Date(to.getTime());
  let cur = new Date(s), n = 0;
  while (cur <= until && cur < to && n++ < 1500) {
    const en = new Date(cur.getTime() + dur); if (en > from) out.push({ start: new Date(cur), end: en });
    if (m.repeat === "daily") cur.setDate(cur.getDate() + 1);
    else if (m.repeat === "weekly") cur.setDate(cur.getDate() + 7);
    else { const day = s.getDate(); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, s.getHours(), s.getMinutes()); cur.setDate(Math.min(day, new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate())); }
  }
  return out;
}

// ---- Reporting managers: which part of their team a manager is looking at ("team" = everyone below them, "mine" = only their own, "m:<id>" = one person) ----
// The database already returns only what a manager may see; this narrows it. Saved on the device; people with nobody reporting to them are never affected.
const Scope = {
  isMgr: () => !!(window.ME && window.ME.isManager),
  get() { try { return localStorage.getItem("k99.scope") || "team"; } catch { return "team"; } },
  set(v) { try { localStorage.setItem("k99.scope", v); } catch { /* not saved */ } },
  people() { return ((window.ME && window.ME.team) || []).filter((m) => m.id !== window.ME.memberId); },
  label() { const s = this.get(); if (s === "mine") return "My leads"; if (s.startsWith("m:")) { const p = this.people().find((m) => String(m.id) === s.slice(2)); return p ? p.name : "My team"; } return "My team"; },
  // a lead belongs to a person by name, or by email when the name was changed after the lead was assigned (the database resolves owners the same way)
  ownerOk(agent, email) {
    if (!this.isMgr()) return true;
    const s = this.get(), k = (x) => String(x || "").trim().toLowerCase(), sharedEmail = (e) => ((window.ME.team || []).filter((m) => k(m.email) === k(e)).length > 1), is = (name, mail) => (k(email) ? !!k(mail) && k(email) === k(mail) && (k(agent) === k(name) || !sharedEmail(email)): k(agent) === k(name));   // a stored email identifies the owner; the name is only the fallback
    if (s === "mine") return is(window.ME.name, window.ME.member && window.ME.member.email);
    if (s.startsWith("m:")) { const p = this.people().find((m) => String(m.id) === s.slice(2)); return p ? is(p.name, p.email) : true; }
    return true;
  },
  leads(list) { return this.isMgr() ? list.filter((l) => this.ownerOk(l.agent, l.agentEmail)) : list; },
  // keep only the rows (visits, bookings, ...) that belong to the leads that stay in view
  rows(rows, leads, key = "enquiry_id") { if (!this.isMgr() || this.get() === "team") return rows; const ids = new Set(leads.map((l) => l.dbId)); return rows.filter((r) => ids.has(r[key])); },
  tasks(list) { if (!this.isMgr() || this.get() === "team") return list; const s = this.get(), id = s === "mine" ? window.ME.memberId : Number(s.slice(2)); return list.filter((t) => t.assigned_to === id); },
  apply(o) { if (!this.isMgr()) return o; const leads = this.leads(o.leads || []); const out = { ...o, leads }; Object.keys(o).forEach((k) => { if (k !== "leads" && Array.isArray(o[k]) && k !== "tasks") out[k] = this.rows(o[k], leads); }); return out; },
  bar() {
    const s = this.get(), opts = [["team", "My team"], ["mine", "My leads"], ...this.people().map((m) => ["m:" + m.id, m.name])];
    return html`<div class="scope-bar" role="group" aria-label="Whose leads to show"><span><i data-lucide="users-round"></i>Viewing</span><select class="select" id="scopeSel" data-search aria-label="Viewing">${opts.map(([v, l]) => html`<option value="${v}" ${v === s ? raw("selected") : raw("")}>${l}</option>`)}</select></div>`;
  },
  wire(root) { const el = root.querySelector("#scopeSel"); if (el) el.onchange = () => { this.set(el.value); location.reload(); }; },
};
