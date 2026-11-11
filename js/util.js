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
function render(el, tpl) {
  el.innerHTML = tpl.__raw;
  if (window.Dropdown) Dropdown.upgrade(el);
  if (window.lucide) lucide.createIcons();
}
const slug = (s) => String(s).replace(/\s+/g, "-");
const AV_COLORS = ["#0f7a6b", "#e8a91f", "#3b6fe0", "#9b6fe0", "#d9534f", "#2e86de"];
function avatar(name, size = 32) {
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
