(async function () {
  const page = await mountShell("customer");
  if (!page) return;
  const id = new URLSearchParams(location.search).get("id");
  let lead, timeline;
  try { lead = await Data.getLead(id); if (lead) timeline = await Data.getActivities(lead); }
  catch (e) { page.innerHTML = '<div class="card empty">Could not load customer: ' + esc(e.message) + "</div>"; return; }
  if (!lead) { page.innerHTML = '<div class="card empty">Customer not found. <a href="leads.html" class="brand-t">Back to leads</a></div>'; return; }

  const demo = !Data.configured, P = DEMO.profile;
  const ORDER = ["New", "Contacted", "Interested", "Qualified", "Site Visit", "Negotiation", "Booking"];
  const cur = ORDER.indexOf(lead.status === "Booked" ? "Booking" : lead.status);
  const IC = { call: ["#16a34a", "phone"], visit: ["#3b82f6", "calendar-check"], doc: ["#e8a91f", "file-text"], new: ["#94a3b8", "plus"] };
  const kv = (rows) => html`<dl class="kv2">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`;
  const prefs = demo ? P.preferences : [["Requirement", lead.requirement], ["Property Type", lead.propertyType || "—"], ["Preferred Location", lead.location || "—"], ["Budget Range", lead.budget || "—"], ["Preferred BHK", lead.bhk || "—"]];
  const stats = demo ? P.stats : [[String(timeline.length), "Total Interactions", "users"], ["—", "Site Visits", "calendar-check"], ["—", "Deal / Booking", "handshake"], ["—", "Expected Commission", "coins"]];
  const projects = demo ? P.projects : (lead.project ? [[lead.project, "—", lead.location, "Interested"]] : []);
  const title = (icon, text, extra) => html`<div class="ch"><i data-lucide="${icon}"></i><h3>${text}</h3>${extra || raw("")}</div>`;

  render(page, html`
    <div class="page-head"><div><div class="crumb">Customers <i data-lucide="chevron-right" style="width:14px;height:14px"></i><b>${lead.name}</b></div><h1>Customer Profile</h1>
      <p class="sub">Complete customer view with requirements, interactions, site visits and deal history.</p></div>
      <div class="btns"><a class="btn brand" href="leads.html"><i data-lucide="arrow-left"></i>Back</a><button class="btn"><i data-lucide="pencil"></i>Edit Profile</button>
        <button class="btn gold"><i data-lucide="handshake"></i>Convert to Deal</button><button class="btn"><i data-lucide="calendar"></i>Add Task</button><button class="btn">More<i data-lucide="chevron-down"></i></button></div></div>
    <div class="top-row">
      <section class="card p id-card">${avatar(lead.name, 110)}<div class="info"><div class="row"><h2>${lead.name}</h2>${badge(lead.status)}<i data-lucide="pencil" class="muted" style="margin-left:auto;width:15px"></i></div>
        <div class="row"><i data-lucide="phone" class="brand-t" style="width:15px"></i>${lead.mobile}<i data-lucide="message-circle" class="wa-t"></i></div>
        <div class="row"><i data-lucide="mail" class="brand-t" style="width:15px"></i>${lead.email}</div>
        <div class="row"><i data-lucide="map-pin" class="brand-t" style="width:15px"></i>${lead.location}</div>
        <span class="prio"><i data-lucide="star"></i>${demo ? P.priority : lead.priority || "Normal"}</span></div></section>
      <section class="card p"><div class="stats">${stats.map(([v, l, ic]) => html`<div class="stat"><i data-lucide="${ic}"></i><div><b>${v}</b><span>${l}</span></div></div>`)}</div>
        <div class="stepper">${ORDER.map((s, i) => html`<div class="s ${i < cur ? "done" : i === cur ? "cur" : ""}"><div class="c">${i <= cur ? raw('<i data-lucide="check"></i>') : ""}</div><span>${s}</span></div>`)}</div></section>
    </div>
    <div class="card tabs-box">${["Overview", "Interactions (" + (demo ? 10 : timeline.length) + ")", "Site Visits (2)", "Deals & Bookings (1)", "Documents (4)", "Notes"].map((t, i) => html`<button class="${i === 0 ? "active" : ""}">${t}</button>`)}</div>
    <div class="cols">
      <div class="col">
        <section class="card p">${title("user", "Customer Details")}${kv([["Customer ID", lead.id], ["Name", lead.name], ["Mobile", lead.mobile], ["Email", lead.email], ["Location", lead.location],
          ["Age", demo ? P.age : "—"], ["Occupation", demo ? P.occupation : "—"], ["Family", demo ? P.family : "—"], ["Assigned Agent", lead.agent || "—"], ["Created On", demo ? P.createdOn : fmtDate(lead.createdAt)], ["Lead Source", lead.source]])}</section>
        <section class="card p">${title("building-2", "Interested Projects (" + projects.length + ")", html`<button class="btn sm" style="margin-left:auto"><i data-lucide="plus" style="width:13px"></i>Add Project</button>`)}
          ${projects.length ? projects.map(([n, dev, loc, st]) => html`<div class="proj"><div class="thumb">${buildingSvg()}</div><div class="t"><b>${n}</b>By ${dev}<br>${loc}</div><span class="chip c-${slug(st)}">${st}</span><i data-lucide="external-link" class="brand-t" style="width:15px"></i></div>`) : html`<p class="muted">No projects yet.</p>`}</section>
      </div>
      <div class="col">
        <section class="card p">${title("target", "Requirement & Preferences", html`<i data-lucide="pencil" class="muted" style="margin-left:auto;width:15px"></i>`)}${kv(prefs)}</section>
        <section class="card p">${title("zap", "Current Status & Next Action")}<dl class="kv2" style="grid-template-columns:110px 1fr;align-items:center">
          <dt>Lead Status</dt><dd><div class="status-sel">${lead.status}<i data-lucide="chevron-down" style="width:14px"></i></div></dd>
          <dt>Next Follow-up</dt><dd class="row"><i data-lucide="calendar" style="width:14px"></i>${lead.followUp}</dd>
          <dt>Action</dt><dd class="row"><i data-lucide="list-checks" style="width:14px"></i>${demo ? "Share pricing & schedule site visit" : "—"}</dd></dl></section>
        <section class="card p">${title("handshake", "Deal / Booking Summary", html`<button class="btn sm" style="margin-left:auto">View Deal<i data-lucide="arrow-right" style="width:12px"></i></button>`)}
          ${demo ? html`<div class="deal">${kv([...P.deal, ["Commission Status", raw('<span class="badge b-Pending">Pending</span>')]])}<div class="thumb">${buildingSvg()}</div></div>` : html`<p class="muted">No deal yet.</p>`}</section>
      </div>
      <section class="card p">${title("bell", "Activity Timeline")}
        <ul class="tl">${timeline.length ? timeline.map((t) => { const [bg, ic] = IC[t.type] || IC.new; return html`<li><span class="ic" style="background:${bg}"><i data-lucide="${ic}"></i></span><div class="bd"><div class="t"><b>${t.title}</b><small>${t.at}</small></div><div class="t"><small>${t.description}</small><small>${t.by}</small></div></div></li>`; }) : html`<li class="muted">No activity yet.</li>`}</ul></section>
    </div>
    <section class="card outcome"><i data-lucide="flag"></i><div><h3>Lead Outcome</h3><small class="muted">Update final status for this lead.</small></div>
      <button class="btn green"><i data-lucide="check"></i>Keep Active</button><button class="btn amber"><i data-lucide="refresh-cw"></i>Reopen Lead</button>
      <button class="btn red"><i data-lucide="x"></i>Mark as Lost</button><button class="btn"><i data-lucide="ban"></i>Mark as Spam</button>
      <div class="lr"><label for="lost">Lost Reason (If Lost)</label><select id="lost" class="select"><option>Select reason...</option><option>Budget mismatch</option><option>Bought elsewhere</option><option>Not responding</option><option>Location not suitable</option></select></div></section>`);
})();
