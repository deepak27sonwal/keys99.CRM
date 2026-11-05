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
const badge = (status) => html`<span class="badge b-${slug(status)}">${status}</span>`;
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
