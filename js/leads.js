(async function () {
  const page = await mountShell("leads");
  if (!page) return;
  const TABS = ["All Leads", ...STATUSES];
  const PAGE = 25;
  const RANGES = { all: "All time", today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month" };
  const state = { leads: [], tab: "All Leads", selected: null, q: new URLSearchParams(location.search).get("q") || "", f: { project: "", developer: "", source: "", agent: "" }, range: "all", page: 1, sig: "", checked: new Set() };

  async function load() {
    try { state.leads = await Data.getLeads(); }
    catch (e) { page.innerHTML = '<div class="card empty">Could not load leads: ' + esc(e.message) + "</div>"; return false; }
    if (state.selected) state.selected = state.leads.find((l) => l.dbId === state.selected.dbId) || null;
    return true;
  }
  if (!(await load())) return;
  if (window.innerWidth > 1200 && state.leads.length) state.selected = state.leads[0];

  const inRange = (l) => {
    if (state.range === "all") return true;
    const d = new Date(l.createdAt), now = new Date(), sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (state.range === "today") return d >= sod;
    if (state.range === "month") return d >= new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= new Date(sod - (state.range === "7d" ? 6 : 29) * 86400000);
  };
  const base = () => state.leads.filter((l) => inRange(l) &&
    (!state.q || [l.name, l.mobile, l.email, l.project, l.developer, l.source, l.id, l.location, l.agent].join(" ").toLowerCase().includes(state.q.toLowerCase())) &&
    (!state.f.project || l.project === state.f.project) && (!state.f.developer || l.developer === state.f.developer) &&
    (!state.f.source || l.source === state.f.source) && (!state.f.agent || l.agent === state.f.agent));
  const uniq = (k) => [...new Set(state.leads.map((l) => l[k]).filter(Boolean))].sort();

  function stepper(status) {
    const i2 = PIPELINE.indexOf(status);                       // Spam -> -1 (nothing highlighted)
    return html`<div class="stepper">${PIPELINE.map((s, i) => html`<div class="s ${i < i2 ? "done" : i === i2 ? "cur" : ""}"><div class="c">${i <= i2 ? raw('<i data-lucide="check"></i>') : ""}</div><span>${s}</span></div>`)}</div>`;
  }
  function drawer(l) {
    if (!l) return raw("");
    const rows = [["hash", "Lead ID", l.id], ["share-2", "Source", l.source], ["target", "Requirement", l.requirement], ["home", "Property type", l.propertyType],
      ["indian-rupee", "Budget", l.budget], ["layers", "BHK", l.bhk], ["building-2", "Project", l.project], ["briefcase", "Developer", l.developer],
      ["map-pin", "Location", l.location], ["user", "Assigned Agent", l.agent], ["calendar", "Next Follow-up", l.followUpTs ? l.followUp : ""]];
    const lastNote = [...l.acts].filter((a) => ["Note", "Follow-up scheduled"].includes(a.title)).sort((a, b) => new Date(a.at) - new Date(b.at)).pop();
    return html`<aside class="card drawer"><div class="drawer-h"><h2>Lead Details</h2><button id="closeDrawer" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="drawer-b"><div class="prof">${avatar(l.name, 64)}<div style="flex:1;min-width:0"><div class="row" style="flex-wrap:wrap"><h3>${l.name}</h3>${badge(l.status)}</div>
        <div class="row" style="margin-top:4px"><i data-lucide="phone" class="brand-t" style="width:14px;height:14px"></i>${l.mobile}<a href="${waHref(l.mobile)}" target="_blank" rel="noopener" aria-label="WhatsApp"><i data-lucide="message-circle" class="wa-t"></i></a></div>
        ${l.email ? html`<div class="row" style="margin-top:2px"><i data-lucide="mail" class="brand-t" style="width:14px;height:14px"></i>${l.email}</div>` : raw("")}</div></div>
        <dl class="kv">${rows.map(([ic, k, v]) => html`<div class="r"><i data-lucide="${ic}"></i><dt>${k}</dt><dd>${v || "—"}</dd></div>`)}</dl>
        <div class="box-b"><h4>Lead Progress</h4>${stepper(l.status)}</div>
        <div class="box-b"><h4>Notes</h4><div class="note"><i data-lucide="sticky-note" class="gold-t"></i><div>${lastNote ? lastNote.description : l.notes || "No notes yet."}${lastNote ? html`<div class="muted" style="font-size:12px;margin-top:4px">${fmtDate(lastNote.at)}${lastNote.by ? " • " + lastNote.by : ""}</div>` : raw("")}</div></div></div>
        <a class="btn brand" style="width:100%;justify-content:center" href="customer.html?id=${encodeURIComponent(l.id)}"><i data-lucide="user"></i>View Full Profile</a></div>
      <div class="drawer-f"><button class="btn outline" id="dNote"><i data-lucide="list-checks"></i>Add Note</button><button class="btn gold" id="dFollow"><i data-lucide="calendar-plus"></i>Schedule</button></div></aside>`;
  }

  // Follow-up chip: flags overdue / due-today follow-ups on open leads.
  function followUp(l) {
    if (!l.followUpTs) return { cls: "fu-none", out: raw("—") };
    const t = new Date(l.followUpTs), now = new Date(), live = !CLOSED.includes(l.status);
    if (live && t < now && !sameDay(t, now)) return { cls: "fu-over", out: html`<i data-lucide="alarm-clock"></i><span class="fu-w">Overdue · </span>${l.followUp}` };
    if (live && sameDay(t, now)) return { cls: "fu-today", out: html`<i data-lucide="bell-ring"></i><span class="fu-w">Today · </span>${t.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" })}` };
    return { cls: "", out: html`<i data-lucide="calendar"></i>${l.followUp}` };
  }
  function pageButtons(cur, total) {
    const set = new Set([1, total, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= total)), out = [];
    [...set].sort((a, b) => a - b).forEach((n, i, a) => { if (i && n - a[i - 1] > 1) out.push("…"); out.push(n); });
    return out;
  }

  function draw() {
    const sig = JSON.stringify([state.tab, state.f, state.range, state.page, state.q]); const anim = sig !== state.sig; state.sig = sig;
    const b = base(), counts = { "All Leads": b.length };
    b.forEach((l) => (counts[l.status] = (counts[l.status] || 0) + 1));
    const filtered = state.tab === "All Leads" ? b : b.filter((l) => l.status === state.tab);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE)); state.page = Math.min(state.page, pages);
    const rows = filtered.slice((state.page - 1) * PAGE, state.page * PAGE);
    const booked = BOOKED.reduce((t, k) => t + (counts[k] || 0), 0), visits = (counts["Visit Scheduled"] || 0) + (counts["Visit Done"] || 0);
    const kpis = [["Total Leads", b.length.toLocaleString("en-IN"), "", "users", 1], ["New Leads", counts["New Leads"] || 0, "", "user-plus"], ["Interested", counts.Interested || 0, "", "clipboard-check"],
      ["Visits", visits, "", "calendar-check"], ["Bookings", booked, "", "handshake"], ["Conversion Rate", b.length ? ((booked / b.length) * 100).toFixed(2) + "%" : "0%", "", "trending-up"]];
    const sel = (key, label) => html`<select class="select" data-f="${key}"><option value="">${label}: All</option>${uniq(key).map((v) => html`<option ${state.f[key] === v ? raw("selected") : raw("")}>${v}</option>`)}</select>`;

    render(page, html`
      <div class="split"><div class="left">
        <div class="page-head"><div><h1>Leads Management</h1><p class="sub">Capture, track and convert your property enquiries.</p></div>
          <div class="btns"><button class="btn" id="export"><i data-lucide="download"></i>Export</button><button class="btn gold" id="addLead"><i data-lucide="plus"></i>Add Lead</button></div></div>
        <div class="kpis k6">${kpis.map(kpiCard)}</div>
        <div class="tabs-pill">${TABS.map((t) => html`<button class="pill ${t === state.tab ? "active" : ""}" data-tab="${t}">${t} (${(counts[t] || 0).toLocaleString("en-IN")})</button>`)}</div>
        <div class="filters">${sel("project", "Project")}${sel("developer", "Developer")}${sel("source", "Source")}${sel("agent", "Agent")}
          <select class="select" id="range">${Object.entries(RANGES).map(([k, v]) => html`<option value="${k}" ${k === state.range ? raw("selected") : raw("")}>${v}</option>`)}</select></div>
        <div class="card table-wrap"><table class="leads-t"><thead><tr><th><input type="checkbox" id="checkAll" aria-label="Select all"></th>
          ${["Lead ID", "Customer", "Mobile", "Requirement", "Project / Location", "Agent", "Status", "Next Follow-up", "Actions"].map((h) => html`<th>${h}</th>`)}</tr></thead>
          <tbody>${rows.length ? rows.map((l, i) => { const fu = followUp(l), la = Data.lastActivity(l); return html`<tr class="lead-row st-${slug(l.status)} ${state.selected && state.selected.dbId === l.dbId ? "sel" : ""} ${anim ? "enter" : ""}" style="--i:${Math.min(i, 12)}" data-id="${l.dbId}">
            <td data-label="Select"><input type="checkbox" data-check="${l.dbId}" ${state.checked.has(l.dbId) ? raw("checked") : raw("")}></td><td data-label="Lead ID">${l.id}</td>
            <td data-label="Customer"><div class="row">${avatar(l.name, 32)}<b>${l.name}</b></div></td><td data-label="Mobile">${l.mobile}</td>
            <td class="tight" data-label="Requirement">${l.requirement || "—"}<small>${l.budget}</small></td><td class="tight" data-label="Project / Location"><b>${l.project || "—"}</b><small>${l.location || l.developer}</small></td>
            <td data-label="Agent">${l.agent ? html`<div class="row">${avatar(l.agent, 24)}${l.agent}</div>` : "—"}</td><td data-label="Status">${badge(l.status)}</td>
            <td data-label="Next Follow-up" class="fu ${fu.cls}">${fu.out}</td>
            <td data-label="Last activity" class="last-act"><i data-lucide="${la.icon}"></i><div><span class="la-label">${la.label}</span><p>${la.text}</p><small>${relTime(la.at)}${la.by ? " · " + la.by : ""}</small></div></td>
            <td data-label="Actions"><div class="acts"><a class="act act-call" href="${telHref(l.mobile)}" aria-label="Call ${l.name}" title="Call"><i data-lucide="phone"></i><span class="act-t">Call</span></a><a class="act act-wa" href="${waHref(l.mobile)}" target="_blank" rel="noopener" aria-label="WhatsApp ${l.name}" title="WhatsApp"><i data-lucide="message-circle"></i><span class="act-t">WhatsApp</span></a><button class="act act-edit" data-edit="${l.dbId}" aria-label="Edit ${l.name}" title="Edit"><i data-lucide="pencil"></i><span class="act-t">Edit</span></button></div></td></tr>`; })
            : html`<tr><td colspan="10" class="empty">No leads found.</td></tr>`}</tbody></table></div>
        <div class="foot"><span>Showing ${filtered.length ? (state.page - 1) * PAGE + 1 : 0} – ${(state.page - 1) * PAGE + rows.length} of ${filtered.length.toLocaleString("en-IN")} leads</span>
          <div class="pager"><button data-page="${state.page - 1}" ${state.page <= 1 ? raw("disabled") : raw("")} aria-label="Previous"><i data-lucide="chevron-left"></i></button>
            ${pageButtons(state.page, pages).map((p) => (p === "…" ? html`<button disabled>…</button>` : html`<button data-page="${p}" class="${p === state.page ? "active" : ""}">${p}</button>`))}
            <button data-page="${state.page + 1}" ${state.page >= pages ? raw("disabled") : raw("")} aria-label="Next"><i data-lucide="chevron-right"></i></button></div></div>
      </div>${drawer(state.selected)}</div>`);
    bind(filtered);
    // centre the current stage inside the (horizontally scrollable) progress bar without scrolling the page
    const cur = page.querySelector(".drawer .stepper .s.cur");
    if (cur) { const bar = cur.parentElement; bar.scrollLeft += cur.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - cur.clientWidth) / 2; }
  }

  const refresh = async () => { if (await load()) draw(); };
  function bind(filtered) {
    page.querySelectorAll("[data-tab]").forEach((x) => (x.onclick = () => { state.tab = x.dataset.tab; state.page = 1; draw(); }));
    page.querySelectorAll("[data-f]").forEach((x) => (x.onchange = () => { state.f[x.dataset.f] = x.value; state.page = 1; draw(); }));
    page.querySelector("#range").onchange = (e) => { state.range = e.target.value; state.page = 1; draw(); };
    page.querySelectorAll("[data-page]").forEach((x) => (x.onclick = () => { state.page = Number(x.dataset.page); draw(); }));
    page.querySelectorAll("tr.lead-row").forEach((r) => (r.onclick = (e) => {
      if (e.target.closest("input,a,button")) return;
      state.selected = state.leads.find((l) => l.dbId === Number(r.dataset.id)); draw();
    }));
    page.querySelectorAll("[data-check]").forEach((c) => (c.onchange = () => { const id = Number(c.dataset.check); c.checked ? state.checked.add(id) : state.checked.delete(id); }));
    page.querySelectorAll("[data-edit]").forEach((x) => (x.onclick = () => openEditLead(state.leads.find((l) => l.dbId === Number(x.dataset.edit)), refresh)));
    const all = page.querySelector("#checkAll");
    all.onchange = () => { state.checked = new Set(all.checked ? filtered.map((l) => l.dbId) : []); draw(); };
    const close = page.querySelector("#closeDrawer"); if (close) close.onclick = () => { state.selected = null; draw(); };
    const dn = page.querySelector("#dNote"); if (dn) dn.onclick = () => openNote(state.selected, refresh);
    const df = page.querySelector("#dFollow"); if (df) df.onclick = () => openFollowUp(state.selected, refresh);
    page.querySelector("#addLead").onclick = () => openAddLead(refresh);
    page.querySelector("#export").onclick = () => {
      const pick = state.checked.size ? filtered.filter((l) => state.checked.has(l.dbId)) : filtered;
      downloadCsv("keys99-leads.csv", ["Lead ID", "Name", "Mobile", "Email", "Requirement", "Budget", "Project", "Developer", "Location", "Agent", "Status", "Source", "Next follow-up", "Created"],
        pick.map((l) => [l.id, l.name, l.mobile, l.email, l.requirement, l.budget, l.project, l.developer, l.location, l.agent, l.status, l.source, l.followUpTs || "", l.createdAt]));
    };
  }

  const gs = document.getElementById("globalSearch");
  gs.value = state.q;
  gs.oninput = (e) => { state.q = e.target.value.trim(); state.page = 1; draw(); };
  draw();
})();
