(async function () {
  const page = await mountShell("leads");
  if (!page) return;
  const STEPS = ["New", "Contacted", "Interested", "Qualified", "Site Visit", "Booking"];
  const TABS = ["All Leads", "New", "Contacted", "Qualified", "Site Visit", "Negotiation", "Booked", "Lost"];
  const state = { leads: [], tab: "All Leads", selected: null, q: "", checked: new Set() };

  try { state.leads = await Data.getLeads(); } catch (e) { page.innerHTML = '<div class="card empty">Could not load leads: ' + esc(e.message) + "</div>"; return; }
  state.selected = state.leads[0] || null;

  const counts = () => {
    if (!Data.configured) return DEMO.tabCounts;
    const c = { "All Leads": state.leads.length };
    state.leads.forEach((l) => (c[l.status] = (c[l.status] || 0) + 1));
    return c;
  };
  const kpis = () => {
    if (!Data.configured) return DEMO.leadKpis;
    const c = counts(), n = state.leads.length, booked = c.Booked || 0;
    return [["Total Leads", n, "", "users", 1], ["New Leads", c.New || 0, "", "user-plus"], ["Qualified Leads", c.Qualified || 0, "", "clipboard-check"],
      ["Site Visits", c["Site Visit"] || 0, "", "calendar-check"], ["Bookings", booked, "", "handshake"], ["Conversion Rate", n ? ((booked / n) * 100).toFixed(2) + "%" : "0%", "", "trending-up"]];
  };
  const visible = () => state.leads.filter((l) => (state.tab === "All Leads" || l.status === state.tab) &&
    (!state.q || [l.name, l.mobile, l.project, l.source, l.id, l.location].join(" ").toLowerCase().includes(state.q)));

  function stepper(status) {
    const idx = STEPS.indexOf(status === "Booked" ? "Booking" : status);
    return html`<div class="stepper">${STEPS.map((s, i) => html`<div class="s ${i < idx ? "done" : i === idx ? "cur" : ""}"><div class="c">${i <= idx ? raw('<i data-lucide="check"></i>') : ""}</div><span>${s}</span></div>`)}</div>`;
  }
  function drawer(l) {
    if (!l) return raw("");
    const rows = [["hash", "Lead ID", l.id], ["share-2", "Source", l.source], ["target", "Requirement", l.requirement.split(" • ")[0]], ["home", "Preferred", l.propertyType],
      ["indian-rupee", "Budget", l.budget], ["layers", "BHK", l.bhk], ["building-2", "Project", l.project], ["map-pin", "Location", l.location], ["user", "Assigned Agent", l.agent], ["calendar", "Next Follow-up", l.followUp]];
    return html`<aside class="card drawer"><div class="drawer-h"><h2>Lead Details</h2><button id="closeDrawer" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="drawer-b"><div class="prof">${avatar(l.name, 64)}<div style="flex:1;min-width:0"><div class="row"><h3>${l.name}</h3>${badge(l.status)}</div>
        <div class="row" style="margin-top:4px"><i data-lucide="phone" class="brand-t" style="width:14px;height:14px"></i>${l.mobile}<i data-lucide="message-circle" class="wa-t"></i></div>
        <div class="row" style="margin-top:2px"><i data-lucide="mail" class="brand-t" style="width:14px;height:14px"></i>${l.email}</div></div></div>
        <div class="tabs-line"><button class="active">Overview</button><button>Activities</button><button>Site Visits</button><button>Documents</button></div>
        <dl class="kv">${rows.map(([ic, k, v]) => html`<div class="r"><i data-lucide="${ic}"></i><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
        <div class="box-b"><h4>Lead Progress</h4>${stepper(l.status)}</div>
        <div class="box-b"><h4>Notes</h4><div class="note"><i data-lucide="sticky-note" class="gold-t"></i><div>${Data.configured ? l.notes || "No notes yet." : DEMO.note.text}${Data.configured ? raw("") : html`<div class="muted" style="font-size:12px;margin-top:4px">${DEMO.note.meta}</div>`}</div></div></div>
        <a class="btn brand" style="width:100%;justify-content:center" href="customer.html?id=${encodeURIComponent(l.id)}"><i data-lucide="user"></i>View Full Profile</a></div>
      <div class="drawer-f"><button class="btn outline"><i data-lucide="list-checks"></i>Add Note</button><button class="btn gold"><i data-lucide="calendar-plus"></i>Schedule</button></div></aside>`;
  }

  function draw() {
    const rows = visible(), c = counts();
    render(page, html`
      <div class="split"><div class="left">
        <div class="page-head"><div><h1>Leads Management</h1><p class="sub">Capture, track and convert your property enquiries.</p></div>
          <div class="btns"><button class="btn"><i data-lucide="upload"></i>Import Leads</button><button class="btn"><i data-lucide="download"></i>Export</button><button class="btn gold" id="addLead"><i data-lucide="plus"></i>Add Lead</button></div></div>
        <div class="kpis k6">${kpis().map(kpiCard)}</div>
        <div class="tabs-pill">${TABS.map((t) => html`<button class="pill ${t === state.tab ? "active" : ""}" data-tab="${t}">${t} (${c[t] || 0})</button>`)}</div>
        <div class="filters">${["Project", "Developer", "Source", "Agent", "Status"].map((f) => html`<select class="select"><option>${f}: All</option></select>`)}
          <button class="select row"><i data-lucide="calendar"></i>Nov 01, 2026 – Nov 30, 2026</button></div>
        <div class="card table-wrap"><table class="leads-t"><thead><tr><th><input type="checkbox" id="checkAll" aria-label="Select all"></th>
          ${["Lead ID", "Customer", "Mobile", "Requirement", "Project / Location", "Agent", "Status", "Next Follow-up", "Actions"].map((h) => html`<th>${h}</th>`)}</tr></thead>
          <tbody>${rows.length ? rows.map((l) => html`<tr class="lead-row ${state.selected && state.selected.id === l.id ? "sel" : ""}" data-id="${l.id}">
            <td><input type="checkbox" data-check="${l.id}" ${state.checked.has(l.id) ? raw("checked") : raw("")}></td><td>${l.id}</td>
            <td><div class="row">${avatar(l.name, 32)}<b>${l.name}</b></div></td><td>${l.mobile}</td>
            <td class="tight">${l.requirement}<small>${l.budget}</small></td><td class="tight"><b>${l.project}</b><small>${l.location}</small></td>
            <td><div class="row">${avatar(l.agent, 24)}${l.agent}</div></td><td>${badge(l.status)}</td>
            <td style="font-size:12px"><i data-lucide="calendar" style="width:12px;height:12px"></i> ${l.followUp}</td>
            <td><div class="row" style="gap:12px"><i data-lucide="phone" class="green-t"></i><i data-lucide="message-circle" class="wa-t"></i><i data-lucide="pencil"></i></div></td></tr>`) : html`<tr><td colspan="10" class="empty">No leads found.</td></tr>`}</tbody></table></div>
        <div class="foot"><span>Showing 1 – ${rows.length} of ${Data.configured ? state.leads.length : "3,248"} leads</span>
          <div class="pager"><button aria-label="Previous"><i data-lucide="chevron-left"></i></button>${["1", "2", "3", "4", "5", "…", "406"].map((p) => html`<button class="${p === "1" ? "active" : ""}">${p}</button>`)}<button aria-label="Next"><i data-lucide="chevron-right"></i></button></div></div>
      </div>${drawer(state.selected)}</div>`);
    bind();
  }

  function bind() {
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; draw(); }));
    page.querySelectorAll("tr.lead-row").forEach((r) => (r.onclick = (e) => {
      if (e.target.closest("input")) return;
      state.selected = state.leads.find((l) => l.id === r.dataset.id); draw();
    }));
    page.querySelectorAll("[data-check]").forEach((c) => (c.onchange = () => { c.checked ? state.checked.add(c.dataset.check) : state.checked.delete(c.dataset.check); }));
    const all = page.querySelector("#checkAll");
    if (all) all.onchange = () => { state.checked = new Set(all.checked ? visible().map((l) => l.id) : []); draw(); };
    const close = page.querySelector("#closeDrawer");
    if (close) close.onclick = () => { state.selected = null; draw(); };
    page.querySelector("#addLead").onclick = () => document.getElementById("leadModal").classList.add("open");
  }

  // Add-lead modal
  const modal = document.createElement("div");
  modal.className = "overlay"; modal.id = "leadModal";
  modal.innerHTML = `<form class="modal" id="leadForm"><h2>Add Lead</h2><div class="form">
    <label>Name *<input name="name" required></label><label>Mobile<input name="mobile" type="tel"></label>
    <label>Email<input name="email" type="email"></label><label>Requirement<input name="requirement" placeholder="Buy • 2 BHK"></label>
    <label>Budget<input name="budget" placeholder="₹ 70L – 1.2Cr"></label><label>Project<input name="project"></label>
    <label>Location<input name="location"></label><label>Source<select name="source"><option>Meta Ads</option><option>Website</option><option>Referral</option><option>WhatsApp</option><option>Google Ads</option><option>Others</option></select></label>
    <label class="full">Status<select name="status">${TABS.slice(1).map((s) => `<option>${s}</option>`).join("")}</select></label></div>
    <div class="actions"><button type="button" class="btn" id="cancelLead">Cancel</button><button class="btn gold" type="submit">Save Lead</button></div></form>`;
  document.body.appendChild(modal);
  modal.querySelector("#cancelLead").onclick = () => modal.classList.remove("open");
  modal.querySelector("#leadForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await Data.addLead(f); state.leads = await Data.getLeads(); state.selected = state.leads[0]; modal.classList.remove("open"); e.target.reset(); draw(); }
    catch (err) { alert("Could not save lead: " + err.message); }
  };

  document.getElementById("globalSearch").oninput = (e) => { state.q = e.target.value.trim().toLowerCase(); draw(); };
  draw();
})();
