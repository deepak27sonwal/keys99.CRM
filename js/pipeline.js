// Sales Pipeline: every lead on a board by stage (drag a card to change its stage), plus summary, performance and bulk actions.
(async function () {
  const page = await mountShell("pipeline");
  if (!page) return;
  const COLS = [...PIPELINE, "Spam"];
  const RANGES = { all: "All time", today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month" };
  const state = { leads: [], bookings: [], team: [], view: "kanban", type: "", range: "month", select: false, sel: new Set() };
  let chart = null;

  async function load() {
    try {
      [state.leads, state.bookings] = await Promise.all([Data.getLeads(), Data.getBookings()]);
      try { state.team = await Data.getTeamCached(); } catch { state.team = []; }
    } catch (e) { page.innerHTML = '<div class="card empty">Could not load the pipeline: ' + esc(e.message) + "</div>"; return false; }
    state.sel = new Set([...state.sel].filter((id) => state.leads.some((l) => l.dbId === id)));
    return true;
  }
  if (!(await load())) return;

  const inRange = (l) => {
    if (state.range === "all") return true;
    const d = new Date(l.createdAt), now = new Date(), sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (state.range === "today") return d >= sod;
    if (state.range === "month") return d >= new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= new Date(sod - (state.range === "7d" ? 6 : 29) * 86400000);
  };
  const pool = () => state.leads.filter((l) => !state.type || l.propertyType === state.type);
  const scoped = () => pool().filter(inRange);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  function fuChip(l) {
    if (l.followUpTs && !CLOSED.includes(l.status)) {
      const t = new Date(l.followUpTs), now = new Date();
      if (sameDay(t, now)) return html`<span class="kb-chip fu-today">Today ${fmtTime(t)}</span>`;
      if (t < now) return html`<span class="kb-chip fu-over">Overdue ${fmtDay(t).slice(0, 6)}</span>`;
      return html`<span class="kb-chip">${fmtDay(t).slice(0, 6)}</span>`;
    }
    return html`<span class="kb-chip muted">${relTime(l.createdAt)}</span>`;
  }
  function card(l) {
    const chk = state.select ? html`<input type="checkbox" class="kb-chk" data-chk="${l.dbId}" ${state.sel.has(l.dbId) ? raw("checked") : raw("")} aria-label="Select ${l.name}">` : raw("");
    return html`<div class="kb-card s-${slug(l.status)}" draggable="${!state.select}" data-id="${l.dbId}" tabindex="0" aria-label="${l.name}, ${l.status}">
      <div class="kb-top">${chk}${avatar(l.name, 32)}<div class="kb-nm"><b>${l.name}</b>${l.project ? html`<small><i data-lucide="map-pin"></i>${l.project}</small>` : raw("")}</div>
        <button class="kb-k" data-menu="${l.dbId}" aria-label="Actions for ${l.name}"><i data-lucide="more-vertical"></i></button></div>
      ${l.budget ? html`<div class="kb-bud">₹ ${l.budget.replace(/^₹\s*/, "")}</div>` : raw("")}
      ${l.status === "Spam" && l.lostReason ? html`<div class="kb-why">Reason: ${l.lostReason}</div>` : raw("")}
      <div class="kb-bot">${fuChip(l)}${priorityChip(l)}<span class="kb-acts"><a href="${telHref(l.mobile)}" aria-label="Call ${l.name}"><i data-lucide="phone"></i></a><a href="${waHref(l.mobile)}" target="_blank" rel="noopener" aria-label="WhatsApp ${l.name}"><i data-lucide="message-circle"></i></a></span></div></div>`;
  }
  function board(L) {
    return html`<div class="kb" role="list">${COLS.map((st) => { const items = L.filter((l) => l.status === st);
      return html`<section class="kb-col s-${slug(st)}" data-col="${st}" role="listitem" aria-label="${st}, ${items.length} leads"><header class="kb-h"><b>${st}</b><span>${items.length} Leads</span></header>
        <div class="kb-body" data-drop="${st}">${items.length ? items.map(card) : html`<div class="kb-empty">No leads here</div>`}</div>
        <button class="kb-add" data-add="${st}"><i data-lucide="plus"></i>Add Lead</button></section>`; })}</div>`;
  }
  function list(L) {
    const rank = (s) => COLS.indexOf(s), rows = [...L].sort((a, b) => rank(a.status) - rank(b.status));
    return html`<div class="card table-wrap"><table class="leads-t pl-t"><thead><tr><th>Customer</th><th>Project</th><th>Stage</th><th>Priority</th><th>Follow-up</th><th>Agent</th><th>Actions</th></tr></thead><tbody>
      ${rows.length ? rows.map((l) => html`<tr class="lead-row s-${slug(l.status)}" data-id="${l.dbId}"><td data-label="Customer"><div class="row">${avatar(l.name, 28)}<b>${l.name}</b></div></td><td data-label="Project">${l.project || "—"}</td>
        <td data-label="Stage">${badge(l.status)}</td><td data-label="Priority">${prioLevel(l) ? priorityChip(l) : "—"}</td><td data-label="Follow-up">${fuChip(l)}</td><td data-label="Agent">${l.agent || "—"}</td>
        <td data-label="Actions"><div class="acts"><a class="act act-call" href="${telHref(l.mobile)}" aria-label="Call ${l.name}"><i data-lucide="phone"></i></a><a class="act act-wa" href="${waHref(l.mobile)}" target="_blank" rel="noopener" aria-label="WhatsApp ${l.name}"><i data-lucide="message-circle"></i></a><button class="act" data-menu="${l.dbId}" aria-label="More for ${l.name}"><i data-lucide="more-vertical"></i></button></div></td></tr>`) : html`<tr><td colspan="7" class="empty">No leads found.</td></tr>`}</tbody></table></div>`;
  }
  function funnel(counts, total) {
    const W = 300, H = 26, GAP = 3, n = PIPELINE.length;
    const seg = (st, i) => { const w = W * (0.45 + 0.55 * ((counts[st] || 0) / Math.max(1, total))), y = i * (H + GAP), x = (W - w) / 2;
      return html`<g class="f-seg s-${slug(st)}"><title>${st}: ${counts[st] || 0}</title><polygon points="${x},${y} ${x + w},${y} ${x + w * 0.94},${y + H} ${x + w * 0.06},${y + H}"></polygon><text x="${W / 2}" y="${y + H / 2 + 4}" text-anchor="middle">${counts[st] || 0}</text></g>`; };
    return html`<svg class="f-svg" viewBox="0 0 ${W} ${n * (H + GAP) - GAP}" role="img" aria-label="Pipeline funnel">${PIPELINE.map(seg)}</svg>`;
  }
  const memberNames = () => state.team.filter((m) => (m.status || "Active") === "Active").map((m) => m.name);

  function draw() {
    if (chart) { chart.destroy(); chart = null; }
    const L = scoped(), counts = {}; L.forEach((l) => (counts[l.status] = (counts[l.status] || 0) + 1));
    const ids = new Set(L.map((l) => l.dbId)), active = L.filter((l) => !CLOSED.includes(l.status)).length;
    const booked = BOOKED.reduce((t, k) => t + (counts[k] || 0), 0), comm = state.bookings.filter((b) => ids.has(b.enquiry_id)).reduce((t, b) => t + Number(b.commission_amount || 0), 0);
    const kpis = [["Total Leads", L.length.toLocaleString("en-IN"), "", "users", 1], ["Active in Pipeline", active, "", "filter"], ["In Negotiation", counts["On Negotiations"] || 0, "", "handshake"],
      ["Booking Done", booked, "", "calendar-check"], ["Estimated Commission", fmtMoney(comm), "", "check-circle-2", 0, 1], ["Conversion Rate", pct(booked, L.length) + "%", "", "trophy"]];
    const types = [...new Set(state.leads.map((l) => l.propertyType).filter(Boolean))].sort();
    const projMap = new Map(); L.forEach((l) => { if (!l.project) return; const p = projMap.get(l.project) || { t: 0, b: 0 }; p.t++; if (BOOKED.includes(l.status)) p.b++; projMap.set(l.project, p); });
    const tops = [...projMap].map(([n, p]) => [n, pct(p.b, p.t), p.t]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 5), topMax = Math.max(1, ...tops.map((t) => t[1]));
    const nSel = state.sel.size, dis = nSel ? raw("") : raw("disabled");
    render(page, html`
      <div class="page-head"><div><h1>Sales Pipeline</h1><p class="sub">Track your leads across the entire sales journey, drag and drop to update stages.</p></div>
        <div class="btns pl-tools"><label class="pl-for">Pipeline for:<select class="select" id="ptype"><option value="">All types</option>${types.map((t) => html`<option ${t === state.type ? raw("selected") : raw("")}>${t}</option>`)}</select></label>
          <select class="select" id="prange" aria-label="Period">${Object.entries(RANGES).map(([k, v]) => html`<option value="${k}" ${k === state.range ? raw("selected") : raw("")}>${v}</option>`)}</select>
          <div class="seg-toggle" role="group" aria-label="View"><button data-view="kanban" class="${state.view === "kanban" ? "on" : ""}" aria-pressed="${state.view === "kanban"}"><i data-lucide="layout-dashboard"></i>Kanban</button><button data-view="list" class="${state.view === "list" ? "on" : ""}" aria-pressed="${state.view === "list"}"><i data-lucide="list"></i>List</button></div>
          <button class="btn gold" id="padd"><i data-lucide="plus"></i>Add Lead</button></div></div>
      <div class="kpis k6">${kpis.map(kpiCard)}</div>
      ${state.view === "kanban" ? board(L) : list(L)}
      <div class="pl-bottom">
        <section class="card p"><h3 class="sec">Pipeline Summary</h3><div class="pl-sum">${funnel(counts, L.length)}<ul class="pl-leg">${PIPELINE.map((st) => html`<li class="s-${slug(st)}"><i></i><span>${st}</span><b>${counts[st] || 0}</b><small>(${pct(counts[st] || 0, L.length)}%)</small></li>`)}<li class="s-Spam"><i></i><span>Spam</span><b>${counts.Spam || 0}</b><small>(${pct(counts.Spam || 0, L.length)}%)</small></li></ul></div></section>
        <section class="card p"><h3 class="sec">Conversion &amp; Performance</h3><div class="chart-box"><canvas id="pchart" aria-label="Leads, bookings and conversion rate for the last six months"></canvas></div></section>
        <section class="card p"><h3 class="sec">Lead Actions</h3><div class="pl-act">
          <button class="btn ${state.select ? "gold" : "outline"}" id="pselect"><i data-lucide="check-square"></i>${state.select ? "Selecting: " + nSel + " chosen" : "Select leads"}</button>
          <button class="btn outline" id="bStage" ${dis}><i data-lucide="repeat"></i>Bulk Update Stage</button><button class="btn outline" id="bAgent" ${dis}><i data-lucide="user-plus"></i>Assign to Agent</button>
          <button class="btn outline" id="bFollow" ${dis}><i data-lucide="calendar-plus"></i>Schedule Follow-up</button><button class="btn outline danger" id="bLost" ${dis}><i data-lucide="x"></i>Mark as Lost</button><button class="btn outline danger" id="bSpam" ${dis}><i data-lucide="ban"></i>Mark as Spam</button></div></section>
        <section class="card p"><h3 class="sec">Top Projects by Conversion</h3>${tops.length ? html`<ul class="pl-top">${tops.map(([n, p]) => html`<li><span>${n}</span><div class="bar"><i style="width:${Math.max(3, (p / topMax) * 100)}%"></i></div><b>${p}%</b></li>`)}</ul>` : html`<div class="empty-sm">No projects in this period.</div>`}</section>
      </div>`);
    bind(L); drawChart();
  }

  function drawChart() {
    const cv = page.querySelector("#pchart"); if (!cv || !window.Chart) return;
    const now = new Date(), months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)), mk = (d) => d.getFullYear() + "-" + d.getMonth();
    // One cohort per month: the leads CREATED that month, and how many of those have booked (so the rate can never pass 100%).
    const lm = new Map(), bm = new Map(), P = pool(), withBooking = new Set(state.bookings.map((x) => x.enquiry_id));
    P.forEach((l) => { const k = mk(new Date(l.createdAt)); lm.set(k, (lm.get(k) || 0) + 1); if (BOOKED.includes(l.status) || withBooking.has(l.dbId)) bm.set(k, (bm.get(k) || 0) + 1); });
    const ls = months.map((d) => lm.get(mk(d)) || 0), bs = months.map((d) => bm.get(mk(d)) || 0), grid = { color: "#eef2f4" }, ticks = { font: { size: 11 } };
    chart = new Chart(cv, { data: { labels: months.map((d) => d.toLocaleString("en-US", { month: "short" })), datasets: [
      { type: "bar", label: "Leads created", data: ls, backgroundColor: "#9adbc8", borderRadius: 4, yAxisID: "y" }, { type: "bar", label: "Booked (of that month's leads)", data: bs, backgroundColor: "#0f7a6b", borderRadius: 4, yAxisID: "y" },
      { type: "line", label: "Conversion Rate (%)", data: months.map((d, i) => pct(bs[i], ls[i])), borderColor: "#e8a91f", backgroundColor: "#e8a91f", tension: 0.3, yAxisID: "y1" }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "top", labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false }, ticks }, y: { beginAtZero: true, grid, ticks: { ...ticks, precision: 0 } }, y1: { position: "right", beginAtZero: true, grid: { display: false }, ticks } } } });
  }

  const byId = (id) => state.leads.find((l) => l.dbId === Number(id));
  const refresh = async () => { if (await load()) draw(); };
  // Move one lead to another stage: the card moves at once; if the database refuses, it goes back and says why.
  async function moveTo(l, status) {
    if (!l || l.status === status) return;
    if (status === "Spam") return openSpam(l, refresh);
    const old = l.status; l.status = status; draw();
    try { await Data.updateLead(l.dbId, { status }); toast(l.name + " → " + status); }
    catch (e) { l.status = old; draw(); toast("Could not move the lead: " + (e.message || e)); }
  }
  function leadMenu(btn, l) {
    popMenu(btn, [["Open profile", "user", () => (location.href = "customer.html?id=" + encodeURIComponent(l.id))], ["Activity history", "history", () => openHistory(l)], ["Edit lead", "pencil", () => openEditLead(l, refresh)],
      ["Add note", "sticky-note", () => openNote(l, refresh)], ["Schedule follow-up", "calendar-plus", () => openFollowUp(l, refresh)],
      ["Move to…", "repeat", () => openModal("Move " + l.name, html`<div class="form">${selectField("Stage", "status", COLS, l.status, "full")}</div>`, async (f) => { await moveTo(l, f.status); }, "Move")],
      ["Mark as spam", "ban", () => openSpam(l, refresh), true]]);
  }
  const chosen = () => [...state.sel].map(byId).filter(Boolean);
  async function each(list, fn, msg) {
    let bad = 0; for (const l of list) { try { await fn(l); } catch { bad++; } }
    toast(bad ? `${list.length - bad} updated, ${bad} failed` : msg); state.sel.clear(); await refresh();
  }

  function bind(L) {
    page.querySelector("#ptype").onchange = (e) => { state.type = e.target.value; draw(); };
    page.querySelector("#prange").onchange = (e) => { state.range = e.target.value; draw(); };
    page.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { state.view = b.dataset.view; draw(); }));
    page.querySelector("#padd").onclick = () => openAddLead(refresh);
    page.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => openAddLead(refresh, { status: b.dataset.add })));
    page.querySelectorAll("[data-menu]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); leadMenu(b, byId(b.dataset.menu)); }));
    page.querySelectorAll("[data-chk]").forEach((c) => (c.onchange = () => { const id = Number(c.dataset.chk); c.checked ? state.sel.add(id) : state.sel.delete(id); draw(); }));
    page.querySelectorAll(".kb-card").forEach((c) => {
      c.onclick = (e) => { if (e.target.closest("a,button,input")) return; if (state.select) { const id = Number(c.dataset.id); state.sel.has(id) ? state.sel.delete(id) : state.sel.add(id); draw(); } else location.href = "customer.html?id=L-" + c.dataset.id; };
      c.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); c.click(); } };
      c.ondragstart = (e) => { e.dataTransfer.setData("text/plain", c.dataset.id); e.dataTransfer.effectAllowed = "move"; c.classList.add("drag"); };
      c.ondragend = () => { c.classList.remove("drag"); page.querySelectorAll(".kb-body.over").forEach((x) => x.classList.remove("over")); };
    });
    page.querySelectorAll("[data-drop]").forEach((z) => {
      z.ondragover = (e) => { e.preventDefault(); z.classList.add("over"); };
      z.ondragleave = (e) => { if (!z.contains(e.relatedTarget)) z.classList.remove("over"); };
      z.ondrop = (e) => { e.preventDefault(); z.classList.remove("over"); moveTo(byId(e.dataTransfer.getData("text/plain")), z.dataset.drop); };
    });
    page.querySelectorAll("tr.lead-row").forEach((r) => (r.onclick = (e) => { if (!e.target.closest("a,button")) location.href = "customer.html?id=L-" + r.dataset.id; }));
    page.querySelector("#pselect").onclick = () => { state.select = !state.select; if (!state.select) state.sel.clear(); if (state.view !== "kanban") state.view = "kanban"; draw(); };
    page.querySelector("#bStage").onclick = () => openModal("Update stage for " + chosen().length + " leads", html`<div class="form">${selectField("New stage", "status", PIPELINE, "", "full")}</div>`, async (f) => each(chosen(), (l) => Data.updateLead(l.dbId, { status: f.status }), "Stage updated"), "Update");
    page.querySelector("#bAgent").onclick = () => { const names = memberNames(); if (!names.length) return toast("Add a team member first (Agents & Teams)"); openModal("Assign " + chosen().length + " leads", html`<div class="form">${selectField("Agent", "agent", names, "", "full")}</div>`, async (f) => each(chosen(), (l) => Data.updateLead(l.dbId, { agent: f.agent }), "Leads assigned"), "Assign"); };
    page.querySelector("#bFollow").onclick = () => openModal("Schedule follow-up for " + chosen().length + " leads", html`<div class="form">${field("Date & time *", "follow_up", "", "datetime-local", "required", "full")}<label class="full">Note (optional)<textarea name="note" rows="2"></textarea></label></div>`, async (f) => each(chosen(), (l) => Data.scheduleFollowUp(l, fromLocalInput(f.follow_up), (f.note || "").trim()), "Follow-ups scheduled"), "Schedule");
    const lose = (title, reasons) => () => openModal(title, html`<div class="form">${selectField("Reason", "reason", reasons, "", "full")}</div>`, async (f) => each(chosen(), (l) => Data.updateLead(l.dbId, { status: "Spam", lostReason: f.reason }), "Updated"), "Confirm");
    page.querySelector("#bLost").onclick = lose("Mark " + chosen().length + " leads as lost", ["Budget mismatch", "Purchased elsewhere", "Not interested", "Not responding", "Other"]);
    page.querySelector("#bSpam").onclick = lose("Mark " + chosen().length + " leads as spam", ["Spam / fake enquiry", "Wrong number", "Duplicate", "Other"]);
  }
  draw();
})();
