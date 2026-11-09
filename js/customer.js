(async function () {
  const page = await mountShell("customer");
  if (!page) return;
  const id = new URLSearchParams(location.search).get("id");
  const ORDER = ["New", "Contacted", "Interested", "Qualified", "Site Visit", "Negotiation", "Booking"];
  const IC = { call: ["#16a34a", "phone"], visit: ["#3b82f6", "calendar-check"], doc: ["#e8a91f", "file-text"], new: ["#94a3b8", "plus"], deal: ["#0f7a6b", "handshake"] };
  const kv = (rows) => html`<dl class="kv2">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v || "—"}</dd>`)}</dl>`;
  const title = (icon, text, extra) => html`<div class="ch"><i data-lucide="${icon}"></i><h3>${text}</h3>${extra ? html`<div style="margin-left:auto">${extra}</div>` : raw("")}</div>`;
  const state = { tab: "Overview" };
  let lead, cust;

  async function load() {
    try {
      lead = await Data.getLead(id);
      if (!lead) { page.innerHTML = '<div class="card empty">Customer not found. <a href="leads.html" class="brand-t">Back to leads</a></div>'; return false; }
      cust = await Data.getCustomer(lead);
      return true;
    } catch (e) { page.innerHTML = '<div class="card empty">Could not load customer: ' + esc(e.message) + "</div>"; return false; }
  }
  if (!(await load())) return;

  function timeline() {
    const t = [];
    cust.related.forEach((r, i) => {
      r.acts.forEach((a) => t.push({ type: a.type || "doc", title: a.title || "Activity", description: a.description || "", ts: a.at, by: a.by ? "by " + a.by : "" }));
      t.push({ type: "new", title: i === 0 ? "Lead Created" : "Enquired Again", description: "Enquiry from " + r.source + (r.project ? " for " + r.project : "") + ".", ts: r.createdAt, by: "" });
    });
    cust.visits.forEach((v) => t.push({ type: "visit", title: "Site Visit " + v.status, description: v.project || "", ts: v.visit_at, by: v.created_by ? "by " + v.created_by : "" }));
    cust.bookings.forEach((b) => t.push({ type: "deal", title: "Booking Recorded", description: (b.project || "") + " · " + fmtMoney(b.booking_value), ts: b.booking_date + "T00:00:00", by: b.created_by ? "by " + b.created_by : "" }));
    return t.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }
  function projects() {
    const m = new Map();
    cust.related.forEach((r) => { if (r.project && !m.has(r.project)) m.set(r.project, r.developer); });
    return [...m].map(([name, dev]) => {
      const booked = cust.bookings.some((b) => b.project === name), visited = cust.visits.some((v) => v.project === name && v.status === "Completed");
      return [name, dev, booked ? "Booked" : visited ? "Site Visited" : "Enquired"];
    });
  }

  function draw() {
    const tl = timeline(), projs = projects(), deal = cust.bookings[0], expected = cust.bookings.reduce((t, b) => t + Number(b.commission_amount), 0);
    const cur = ORDER.indexOf(lead.status === "Booked" ? "Booking" : lead.status), done = () => load().then((ok) => ok && draw());
    const stats = [[tl.length, "Total Interactions", "users"], [cust.visits.length, "Site Visits", "calendar-check"], [cust.bookings.length, "Deal / Booking", "handshake"], [fmtMoney(expected), "Expected Commission", "coins"]];
    const tabs = [["Overview", "Overview"], ["Interactions", "Interactions (" + tl.length + ")"], ["Site Visits", "Site Visits (" + cust.visits.length + ")"], ["Deals", "Deals & Bookings (" + cust.bookings.length + ")"], ["Documents", "Documents"], ["Notes", "Notes"]];

    const timelineList = (items) => items.length ? html`<ul class="tl">${items.map((x) => { const [bg, ic] = IC[x.type] || IC.new; return html`<li><span class="ic" style="background:${bg}"><i data-lucide="${ic}"></i></span><div class="bd"><div class="t"><b>${x.title}</b><small>${fmtDate(x.ts)}</small></div><div class="t"><small>${x.description}</small><small>${x.by}</small></div></div></li>`; })}</ul>` : html`<div class="empty-sm">Nothing here yet.</div>`;
    const dealCard = html`${title("handshake", "Deal / Booking Summary")}${deal ? kv([["Project", deal.project], ["Booking Date", fmtDate(deal.booking_date + "T00:00:00").split(",")[0] + ", " + deal.booking_date.slice(0, 4)], ["Booking Value", fmtMoney(deal.booking_value)],
      ["Agreement Rate", deal.agreement_rate + "%"], ["Commission", fmtMoney(deal.commission_amount)], ["Commission Status", raw(`<span class="badge b-${esc(deal.commission_status)}">${esc(deal.commission_status)}</span>`)]]) : html`<div class="empty-sm">No booking yet. Use “Convert to Deal” when this lead books.</div>`}`;

    const overview = html`<div class="cols">
      <div class="col">
        <section class="card p">${title("user", "Customer Details")}${kv([["Customer ID", lead.id], ["Name", lead.name], ["Mobile", lead.mobile], ["Email", lead.email], ["Location", lead.location],
          ["Assigned Agent", lead.agent], ["Created On", fmtDate(lead.createdAt)], ["Lead Source", lead.source], ["Enquiries", cust.related.length]])}</section>
        <section class="card p">${title("building-2", "Interested Projects (" + projs.length + ")")}
          ${projs.length ? projs.map(([n, dev, st]) => html`<div class="proj"><div class="thumb">${buildingSvg()}</div><div class="t"><b>${n}</b>${dev ? "By " + dev : ""}</div><span class="chip c-${slug(st)}">${st}</span></div>`) : html`<div class="empty-sm">No project recorded.</div>`}</section>
      </div>
      <div class="col">
        <section class="card p">${title("target", "Requirement & Preferences", html`<button class="icon-btn" id="editBtn2" aria-label="Edit"><i data-lucide="pencil" class="muted" style="width:15px"></i></button>`)}
          ${kv([["Requirement", lead.requirement], ["Property Type", lead.propertyType], ["Preferred Location", lead.location], ["Budget Range", lead.budget], ["Preferred BHK", lead.bhk], ["Project", lead.project], ["Developer", lead.developer]])}</section>
        <section class="card p">${title("zap", "Current Status & Next Action")}<dl class="kv2" style="grid-template-columns:110px 1fr;align-items:center">
          <dt>Lead Status</dt><dd><select class="select" id="statusSel" style="width:100%">${STATUSES.map((s) => html`<option ${s === lead.status ? raw("selected") : raw("")}>${s}</option>`)}</select></dd>
          <dt>Next Follow-up</dt><dd class="row"><i data-lucide="calendar" style="width:14px"></i>${lead.followUpTs ? lead.followUp : "Not scheduled"}<button class="icon-btn" id="followBtn" aria-label="Schedule follow-up" style="margin-left:auto"><i data-lucide="pencil" class="muted" style="width:13px"></i></button></dd>
          ${lead.status === "Lost" ? html`<dt>Lost reason</dt><dd>${lead.lostReason || "—"}</dd>` : raw("")}</dl></section>
        <section class="card p">${dealCard}</section>
      </div>
      <section class="card p">${title("bell", "Activity Timeline")}${timelineList(tl.slice(0, 8))}</section></div>`;

    const other = {
      Interactions: html`<section class="card p">${title("bell", "All Interactions")}${timelineList(tl)}</section>`,
      "Site Visits": html`<section class="card p">${title("calendar-check", "Site Visits", html`<button class="btn sm" id="visitBtn2"><i data-lucide="plus" style="width:13px"></i>Schedule</button>`)}${cust.visits.length ? html`<ul class="list">${cust.visits.map((v) => html`<li><div class="grow"><b>${v.project || "—"}</b><small>${fmtDate(v.visit_at)}</small></div><span class="badge b-${v.status}">${v.status}</span></li>`)}</ul>` : html`<div class="empty-sm">No site visits yet.</div>`}</section>`,
      Deals: html`<section class="card p">${title("handshake", "Deals & Bookings")}${cust.bookings.length ? html`<table class="mini-t"><thead><tr><th>Project</th><th>Date</th><th>Value</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead><tbody>${cust.bookings.map((b) => html`<tr><td>${b.project}</td><td>${b.booking_date}</td><td>${fmtMoney(b.booking_value)}</td><td>${b.agreement_rate}%</td><td>${fmtMoney(b.commission_amount)}</td><td>${b.commission_status}</td></tr>`)}</tbody></table>` : html`<div class="empty-sm">No bookings yet.</div>`}</section>`,
      Documents: html`<section class="card p">${title("file-text", "Documents")}<div class="empty-sm">Document uploads are not set up yet.</div></section>`,
      Notes: html`<section class="card p">${title("sticky-note", "Notes", html`<button class="btn sm" id="noteBtn2"><i data-lucide="plus" style="width:13px"></i>Add Note</button>`)}${lead.notes ? html`<p style="margin-bottom:12px">${lead.notes}</p>` : raw("")}${lead.acts.filter((a) => a.title === "Note").length ? html`<ul class="list">${[...lead.acts].filter((a) => a.title === "Note").reverse().map((a) => html`<li><div class="grow"><b style="font-weight:500">${a.description}</b><small>${fmtDate(a.at)}${a.by ? " • " + a.by : ""}</small></div></li>`)}</ul>` : html`<div class="empty-sm">No notes yet.</div>`}</section>`,
    };

    render(page, html`
      <div class="page-head"><div><div class="crumb">Customers <i data-lucide="chevron-right" style="width:14px;height:14px"></i><b>${lead.name}</b></div><h1>Customer Profile</h1>
        <p class="sub">Complete customer view with requirements, interactions, site visits and deal history.</p></div>
        <div class="btns"><a class="btn brand" href="leads.html"><i data-lucide="arrow-left"></i>Back</a><button class="btn" id="editBtn"><i data-lucide="pencil"></i>Edit Profile</button>
          <button class="btn gold" id="dealBtn"><i data-lucide="handshake"></i>Convert to Deal</button><button class="btn" id="visitBtn"><i data-lucide="calendar"></i>Schedule Visit</button></div></div>
      <div class="top-row">
        <section class="card p id-card">${avatar(lead.name, 110)}<div class="info"><div class="row" style="flex-wrap:wrap"><h2>${lead.name}</h2>${badge(lead.status)}</div>
          <div class="row"><i data-lucide="phone" class="brand-t" style="width:15px"></i><a href="${telHref(lead.mobile)}">${lead.mobile}</a><a href="${waHref(lead.mobile)}" target="_blank" rel="noopener" aria-label="WhatsApp"><i data-lucide="message-circle" class="wa-t"></i></a></div>
          ${lead.email ? html`<div class="row"><i data-lucide="mail" class="brand-t" style="width:15px"></i>${lead.email}</div>` : raw("")}
          ${lead.location ? html`<div class="row"><i data-lucide="map-pin" class="brand-t" style="width:15px"></i>${lead.location}</div>` : raw("")}
          ${lead.priority ? html`<span class="prio"><i data-lucide="star"></i>${lead.priority}</span>` : raw("")}</div></section>
        <section class="card p"><div class="stats">${stats.map(([v, l, ic]) => html`<div class="stat"><i data-lucide="${ic}"></i><div><b>${v}</b><span>${l}</span></div></div>`)}</div>
          <div class="stepper">${ORDER.map((s, i) => html`<div class="s ${i < cur ? "done" : i === cur ? "cur" : ""}"><div class="c">${i <= cur && lead.status !== "Lost" ? raw('<i data-lucide="check"></i>') : ""}</div><span>${s}</span></div>`)}</div></section>
      </div>
      <div class="card tabs-box">${tabs.map(([k, label]) => html`<button data-tab="${k}" class="${k === state.tab ? "active" : ""}">${label}</button>`)}</div>
      ${state.tab === "Overview" ? overview : other[state.tab]}
      <section class="card outcome"><i data-lucide="flag"></i><div><h3>Lead Outcome</h3><small class="muted">Update final status for this lead.</small></div>
        <button class="btn green" id="keep"><i data-lucide="check"></i>Keep Active</button><button class="btn amber" id="reopen"><i data-lucide="refresh-cw"></i>Reopen Lead</button>
        <button class="btn red" id="lost"><i data-lucide="x"></i>Mark as Lost</button><button class="btn" id="spam"><i data-lucide="ban"></i>Mark as Spam</button>
        ${lead.status === "Lost" ? html`<div class="lr"><label>Lost reason</label><b>${lead.lostReason || "—"}</b></div>` : raw("")}</section>`);

    const on = (sel, fn) => { const el = page.querySelector(sel); if (el) el.onclick = fn; };
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; draw(); }));
    on("#editBtn", () => openEditLead(lead, done)); on("#editBtn2", () => openEditLead(lead, done)); on("#followBtn", () => openFollowUp(lead, done));
    on("#dealBtn", () => openBooking(lead, done)); on("#visitBtn", () => openSiteVisit(lead, done)); on("#visitBtn2", () => openSiteVisit(lead, done)); on("#noteBtn2", () => openNote(lead, done));
    on("#keep", () => toast("Lead stays active")); on("#lost", () => openLost(lead, "Mark as Lost", done)); on("#spam", () => openLost(lead, "Mark as Spam", done));
    on("#reopen", async () => { if (lead.status !== "Lost") return toast("Lead is already active"); await Data.updateLead(lead.dbId, { status: "Contacted", lostReason: "" }); toast("Lead reopened"); done(); });
    const ss = page.querySelector("#statusSel");
    if (ss) ss.onchange = async () => { try { await Data.updateLead(lead.dbId, { status: ss.value }); toast("Status updated"); done(); } catch (e) { alert("Could not update: " + e.message); } };
  }
  draw();
})();
