// Shared by the leads list (history button) and the customer profile: one lead's activity, newest first.
const IC = { call: ["#16a34a", "phone"], visit: ["#3b82f6", "calendar-check"], doc: ["#e8a91f", "file-text"], new: ["#94a3b8", "plus"], deal: ["#0f7a6b", "handshake"] };
function buildTimeline(cust) {
  const t = [];
  cust.related.forEach((r, i) => {
    r.acts.forEach((a) => t.push({ type: a.type || "doc", title: a.title || "Activity", description: a.description || "", ts: a.at, by: a.by ? "by " + a.by : "" }));
    const more = [...sourceRows(r).filter(([k]) => ["Page", "Form", "Campaign", "Ad"].includes(k)).map(([k, v]) => k + ": " + v), ...((r.src && r.src.answers) || []).map((x) => x.q + ": " + x.a)];
    t.push({ type: "new", title: i === 0 ? "Lead Created" : "Enquired Again", description: "Enquiry from " + r.source + (r.project ? " for " + r.project : "") + "." + (more.length ? "\n" + more.join("\n") : ""), ts: r.createdAt, by: "", multi: more.length > 0 });
  });
  cust.visits.forEach((v) => t.push({ type: "visit", title: "Site Visit " + v.status, description: v.project || "", ts: v.visit_at, by: v.created_by ? "by " + v.created_by : "" }));
  cust.bookings.forEach((b) => t.push({ type: "deal", title: "Booking Recorded", description: (b.project || "") + " · " + fmtMoney(b.booking_value), ts: b.booking_date + "T00:00:00", by: b.created_by ? "by " + b.created_by : "" }));
  return t.sort((a, b) => new Date(b.ts) - new Date(a.ts));
}
function timelineList(items) { return items.length ? html`<ul class="tl">${items.map((x) => { const [bg, ic] = IC[x.type] || IC.new; return html`<li><span class="ic" style="background:${bg}"><i data-lucide="${ic}"></i></span><div class="bd"><div class="t"><b>${x.title}</b><small>${fmtDate(x.ts)}</small></div><div class="t"><small class="${x.multi ? "ml" : ""}">${x.description}</small><small>${x.by}</small></div></div></li>`; })}</ul>` : html`<div class="empty-sm">Nothing here yet.</div>`; }
// Activity history of one lead (notes, follow-ups, enquiries, site visits, bookings), newest first, in a dialog.
async function openHistory(l) {
  if (!l) return;
  const ov = document.createElement("div"); ov.className = "overlay open";
  ov.innerHTML = `<div class="modal hist-modal" role="dialog" aria-modal="true" aria-label="Activity history"><h2>Activity history · ${esc(l.name)}</h2><div class="hist-body"><div class="empty-sm">Loading…</div></div><div class="actions"><a class="btn" href="customer.html?id=${encodeURIComponent(l.id)}">Open full profile</a><button type="button" class="btn gold" data-x>Close</button></div></div>`;
  document.body.appendChild(ov); if (window.lucide) lucide.createIcons();
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  ov.querySelector("[data-x]").onclick = close; ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); }); ov.querySelector("[data-x]").focus();
  const body = ov.querySelector(".hist-body");
  try {
    const items = buildTimeline(await Data.getCustomer(l));
    body.innerHTML = (items.length ? timelineList(items) : html`<div class="empty-sm">No activity yet.</div>`).__raw;
  } catch (e) { body.innerHTML = `<div class="empty-sm">Could not load the history: ${esc(e.message || e)}</div>`; }
  if (window.lucide) lucide.createIcons();
}
