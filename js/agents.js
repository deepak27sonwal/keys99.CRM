// Agents & Teams: the people who work your leads. Two kinds: sales Agents and Relationship Managers (RMs).
// A lead belongs to a person when the name in "Assigned agent" (enquiries.manager_name) matches the member's name.
(async function () {
  const page = await mountShell("agents");
  if (!page) return;
  const PAGE = 8, KIND = { agent: "Agent", rm: "Relationship Manager" };
  const state = { members: [], leads: [], visits: [], bookings: [], tab: "all", q: "", f: { team: "", status: "", location: "" }, page: 1, selId: null, auto: false };
  let charts = [], stats = new Map();
  const key = (n) => String(n || "").trim().toLowerCase();
  const empId = (m) => (m.kind === "rm" ? "RM-" : "AG-") + String(m.id).padStart(3, "0");
  const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
  const inMonth = (ts) => { const t = new Date(ts); return !isNaN(t) && t >= monthStart(); };
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  const fmtPct = (n) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, "") + "%";


  // ---- project routing (mirrors the database rule, only used to show who is covered; the database does the real assignment)
  const normP = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const projMatch = (leadProject, memberProject) => { const n = normP(leadProject), m = normP(memberProject); return n.length >= 3 && m.length >= 3 && (n.startsWith(m) || m.startsWith(n)); };
  const baseName = (p) => String(p || "").split(",")[0].trim();
  const coveredBy = (project) => state.members.filter((m) => m.status === "Active" && (m.projects || []).some((p) => projMatch(project, p)));
  const nextOf = (ms) => [...ms].sort((a, b) => (a.last_assigned_at ? new Date(a.last_assigned_at) : 0) - (b.last_assigned_at ? new Date(b.last_assigned_at) : 0) || a.id - b.id)[0];
  const projectNames = () => { const seen = new Map(); state.leads.forEach((l) => { const b = baseName(l.project); if (b && !seen.has(normP(b))) seen.set(normP(b), b); }); state.members.forEach((m) => (m.projects || []).forEach((p) => { if (!seen.has(normP(p))) seen.set(normP(p), p); })); return [...seen.values()].sort((a, b) => a.localeCompare(b)); };
  const pj = (arr, max = 2) => (arr || []).length ? html`${arr.slice(0, max).map((x) => html`<span class="pj">${x}</span>`)}${arr.length > max ? html`<span class="pj more">+${arr.length - max}</span>` : raw("")}` : raw("—");

  async function load() {
    try {
      const [m, l, v, b] = await Promise.all([Data.getTeam(), Data.getLeads(), Data.getSiteVisits(), Data.getBookings()]);
      Object.assign(state, { members: m, leads: l, visits: v, bookings: b }); state.auto = await Data.getAutoAssign().catch(() => false); compute(); return true;
    } catch (e) {
      render(page, html`<div class="card p" style="margin:24px"><h3>Could not load the team</h3><p class="sub">${e.message}</p></div>`); return false;
    }
  }

  // Everything below is derived from the leads, visits and bookings each person's leads have produced.
  function compute() {
    const byName = new Map(), leadOwner = new Map();
    state.members.forEach((m) => byName.set(key(m.name), m));
    state.leads.forEach((l) => { const m = byName.get(key(l.agent)); if (m) leadOwner.set(l.dbId, m.id); });
    stats = new Map(state.members.map((m) => [m.id, { leads: 0, booked: 0, bookedM: 0, visits: 0, bookings: 0, value: 0, commission: 0, leadsM: 0, visitsM: 0, bookingsM: 0, achieved: 0, commissionM: 0 }]));
    state.leads.forEach((l) => { const s = stats.get(leadOwner.get(l.dbId)); if (!s) return; s.leads++; if (inMonth(l.createdAt)) s.leadsM++; });
    state.visits.forEach((v) => { const s = stats.get(leadOwner.get(v.enquiry_id)); if (!s) return; s.visits++; if (inMonth(v.visit_at || v.created_at)) s.visitsM++; });
    const bookedSeen = new Set(), bookedSeenM = new Set();
    state.bookings.forEach((b) => {
      const s = stats.get(leadOwner.get(b.enquiry_id)); if (!s) return;
      if (!bookedSeen.has(b.enquiry_id)) { bookedSeen.add(b.enquiry_id); s.booked++; }       // a lead counts as converted once, however many bookings it has
      s.bookings++; s.value += Number(b.booking_value) || 0; s.commission += Number(b.commission_amount) || 0;
      if (inMonth(b.booking_date)) { s.bookingsM++; if (!bookedSeenM.has(b.enquiry_id)) { bookedSeenM.add(b.enquiry_id); s.bookedM++; } s.achieved += Number(b.booking_value) || 0; s.commissionM += Number(b.commission_amount) || 0; }
    });
    state.owner = leadOwner;
  }

  const uniq = (k) => [...new Set(state.members.map((m) => m[k]).filter(Boolean))].sort();
  function visible() {
    const q = state.q.trim().toLowerCase();
    return state.members.filter((m) => (state.tab === "all" || m.kind === state.tab) && (!state.f.team || m.team === state.f.team) && (!state.f.status || m.status === state.f.status) && (!state.f.location || m.location === state.f.location)
      && (!q || [m.name, m.phone, m.email, m.team, m.designation, m.location, empId(m)].join(" ").toLowerCase().includes(q)));
  }

  function draw() {
    charts.forEach((c) => c.destroy()); charts = [];
    const all = state.members, active = all.filter((m) => m.status === "Active"), list = visible();
    const pages = Math.max(1, Math.ceil(list.length / PAGE)); state.page = Math.min(state.page, pages);
    const rows = list.slice((state.page - 1) * PAGE, state.page * PAGE), sel = all.find((m) => m.id === state.selId) || null;
    const S = (m) => stats.get(m.id), sumOf = (arr, f) => arr.reduce((t, m) => t + f(S(m)), 0);
    const target = active.reduce((t, m) => t + Number(m.monthly_target || 0), 0), achieved = sumOf(all, (s) => s.achieved);
    const leadsAll = sumOf(all, (s) => s.leads), bookAll = sumOf(all, (s) => s.booked);
    const kpis = [["Members", all.length, "", "users-round", 1], ["Active", active.length, "", "check-circle-2", 0, 1], ["Inactive", all.length - active.length, "", "user-x"],
      ["Month Target", target ? fmtMoney(target) : "—", "", "target"], ["Achieved", fmtMoney(achieved), "", "bar-chart-3"],
      ["Conversion", leadsAll ? fmtPct(pct(bookAll, leadsAll)) : "0%", "", "trophy"], ["Commission", fmtMoney(sumOf(all, (s) => s.commissionM)), "", "coins"]];
    const tabs = [["all", "All Members", all.length], ["agent", "Agents", all.filter((m) => m.kind === "agent").length], ["rm", "Relationship Managers", all.filter((m) => m.kind === "rm").length], ["routing", "Lead Routing", null]];
    const sel2 = (k, label) => html`<select class="select" data-f="${k}"><option value="">${label}: All</option>${uniq(k).map((v) => html`<option ${state.f[k] === v ? raw("selected") : raw("")}>${v}</option>`)}</select>`;
    const top = [...all].map((m) => [m, S(m).value]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5), topMax = top.length ? top[0][1] : 1;
    const noTeamNote = state.leads.length && !state.owner.size && all.length ? html`<p class="sub" style="margin:0 0 12px">No lead is assigned to anyone in this list yet. A lead belongs to a person when its <b>Assigned agent</b> matches their name.</p>` : raw("");

    render(page, html`
      <div class="split"><div class="left">
        <div class="page-head"><div><h1>Agents &amp; Team Management</h1><p class="sub">Manage your sales agents, relationship managers, targets and performance.</p></div>
          <div class="btns"><button class="btn" id="export"><i data-lucide="download"></i>Export</button><button class="btn" id="addRm"><i data-lucide="user-plus"></i>Add Relationship Manager</button><button class="btn gold" id="addAgent"><i data-lucide="plus"></i>Add Agent</button></div></div>
        <div class="kpis k7">${kpis.map(kpiCard)}</div>
        ${autoCard(active)}
        <div class="tabs-pill">${tabs.map(([k, l, n]) => html`<button class="pill ${k === state.tab ? "active" : ""}" data-tab="${k}">${l}${n === null ? "" : " (" + n + ")"}</button>`)}</div>
        ${state.tab === "routing" ? routingView() : html`${noTeamNote}
        <div class="filters">${sel2("team", "Team")}<select class="select" data-f="status"><option value="">Status: All</option>${["Active", "Inactive"].map((v) => html`<option ${state.f.status === v ? raw("selected") : raw("")}>${v}</option>`)}</select>${sel2("location", "Location")}
          <input class="select team-q" id="q" type="search" placeholder="Search by name, mobile or email…" value="${state.q}" aria-label="Search team"></div>
        <div class="card table-wrap"><table class="team-t"><thead><tr>${["Member", "Team", "Projects", "Role", "Leads", "Site Visits", "Bookings", "Deal Value", "Commission", "Conversion", "Status", ""].map((h) => html`<th>${h}</th>`)}</tr></thead>
          <tbody>${rows.length ? rows.map((m) => { const s = S(m); return html`<tr class="tm-row ${m.id === state.selId ? "sel" : ""}" data-id="${m.id}" tabindex="0">
            <td data-label="Member"><div class="row">${avatar(m.name, 34)}<div><b>${m.name}</b><small>${m.phone || m.email || "—"}</small></div></div></td>
            <td data-label="Team">${m.team || "—"}</td><td data-label="Projects" class="pjs">${pj(m.projects)}</td><td data-label="Role">${m.designation || KIND[m.kind]}${m.designation && m.designation !== KIND[m.kind] ? html`<small>${KIND[m.kind]}</small>` : raw("")}</td>
            <td data-label="Leads">${s.leads}</td><td data-label="Site Visits">${s.visits}</td><td data-label="Bookings">${s.bookings}</td>
            <td data-label="Deal Value">${s.value ? fmtMoney(s.value) : "—"}</td><td data-label="Commission">${s.commission ? fmtMoney(s.commission) : "—"}</td><td data-label="Conversion">${s.leads ? fmtPct(pct(s.booked, s.leads)) : "—"}</td>
            <td data-label="Status"><span class="chip ${m.status === "Active" ? "c-ok" : "c-none"}">${m.status}</span></td>
            <td data-label="Actions"><button class="icon-btn" data-menu="${m.id}" aria-label="Actions for ${m.name}"><i data-lucide="more-horizontal"></i></button></td></tr>`; })
            : html`<tr><td colspan="12" class="empty">${all.length ? "No one matches these filters." : "No team members yet. Use Add Agent or Add Relationship Manager."}</td></tr>`}</tbody></table></div>
        <div class="foot"><span>Showing ${list.length ? (state.page - 1) * PAGE + 1 : 0} – ${(state.page - 1) * PAGE + rows.length} of ${list.length} members</span>
          <div class="pager"><button data-page="${state.page - 1}" ${state.page <= 1 ? raw("disabled") : raw("")} aria-label="Previous"><i data-lucide="chevron-left"></i></button><button class="active" disabled>${state.page}</button>
            <button data-page="${state.page + 1}" ${state.page >= pages ? raw("disabled") : raw("")} aria-label="Next"><i data-lucide="chevron-right"></i></button></div></div>`}
        <div class="grid g-team">
          <section class="card p"><div class="ch"><h3><i data-lucide="users-round"></i> Team Performance</h3></div>${target ? html`<div class="donut-wrap"><div class="donut"><canvas id="perf" aria-label="Target achieved"></canvas><div class="mid"><b>${fmtMoney(achieved)}</b><span>Achieved (${fmtPct(pct(achieved, target))})</span></div></div>
            <ul class="legend-l"><li><i style="background:#0f7a6b"></i>Achieved<b>${fmtMoney(achieved)}</b></li><li><i style="background:#e8a91f"></i>Remaining<b>${fmtMoney(Math.max(0, target - achieved))}</b></li></ul></div>` : html`<p class="empty">Set a monthly target on a team member to see progress here.</p>`}</section>
          <section class="card p"><div class="ch"><h3><i data-lucide="award"></i> Top 5 by Deal Value</h3></div>${top.length ? html`<ul class="topbars">${top.map(([m, v]) => html`<li><span>${m.name}</span><div class="bar"><i style="width:${Math.max(4, (v / topMax) * 100)}%"></i></div><b>${fmtMoney(v)}</b></li>`)}</ul>` : html`<p class="empty">Bookings will rank your team here.</p>`}</section>
          <section class="card p"><div class="ch"><h3><i data-lucide="trending-up"></i> Lead to Booking Conversion</h3></div><div class="chart-box"><canvas id="conv" aria-label="Bookings and conversion by month"></canvas></div></section>
          <section class="card p quick"><div class="ch"><h3><i data-lucide="zap"></i> Quick Actions</h3></div>
            <button class="btn" id="qaAgent"><i data-lucide="plus"></i>Add New Agent</button><button class="btn" id="qaRm"><i data-lucide="user-plus"></i>Add Relationship Manager</button><button class="btn" id="qaExport"><i data-lucide="download"></i>Export Team</button></section>
        </div>
      </div>${drawer(sel)}</div>`);
    bind(list); drawCharts(target, achieved);
  }

  function autoCard(active) {
    const covered = new Set(); active.forEach((m) => (m.projects || []).forEach((x) => normP(x).length >= 3 && covered.add(normP(x))));
    const noEmail = active.filter((m) => !m.email).length, noProj = active.filter((m) => !(m.projects || []).length && m.kind !== "rm").length;
    return html`<section class="card p aa-card"><div class="aa-t"><div><h3>Auto-assign new leads <span class="chip ${state.auto ? "c-ok" : "c-none"}">${state.auto ? "On" : "Off"}</span></h3>
      <p class="sub">New leads from your landing pages, Facebook and Google go to a team member who has that project, taking turns. If nobody has the project, they are shared across all active relationship managers. Leads already in the CRM are not changed.</p>
      <small class="muted">${covered.size} project${covered.size === 1 ? "" : "s"} covered${noEmail ? " · " + noEmail + " active member" + (noEmail === 1 ? "" : "s") + " without an email (their lead alerts go to the fallback address)" : ""}${noProj ? " · " + noProj + " agent" + (noProj === 1 ? "" : "s") + " with no projects" : ""}</small></div>
      <label class="switch"><input type="checkbox" id="aaSwitch" ${state.auto ? raw("checked") : raw("")} aria-label="Auto-assign new leads"><span></span></label></div></section>`;
  }

  function routingView() {
    const active = state.members.filter((m) => m.status === "Active"), byProj = new Map();
    state.members.forEach((m) => (m.projects || []).forEach((p) => { const k = normP(p); if (k.length < 3) return; if (!byProj.has(k)) byProj.set(k, { name: p, people: [] }); byProj.get(k).people.push(m); }));
    const rows = [...byProj.values()].sort((a, b) => a.name.localeCompare(b.name));
    const since = Date.now() - 90 * 86400000, miss = new Map();
    state.leads.forEach((l) => { const b = baseName(l.project); if (!b || new Date(l.createdAt) < since || coveredBy(l.project).length) return; const k = normP(b); miss.set(k, { name: b, n: ((miss.get(k) || {}).n || 0) + 1 }); });
    const unc = [...miss.values()].sort((a, b) => b.n - a.n), rms = active.filter((m) => m.kind === "rm");
    return html`<div class="card p" style="margin-bottom:14px"><h3>Who gets the next lead?</h3><p class="sub" style="margin:4px 0 10px">Pick a project to see who would receive it. Nothing is assigned by checking.</p>
      <div class="copyrow"><input id="pvIn" list="projList" placeholder="Type or pick a project" aria-label="Project"><button class="btn sm gold" id="pvGo"><i data-lucide="search"></i>Check</button></div><p class="sub" id="pvOut" style="margin-top:8px"></p>
      <datalist id="projList">${projectNames().map((n) => html`<option value="${n}"></option>`)}</datalist></div>
      <div class="card table-wrap"><table class="route-t"><thead><tr><th>Project</th><th>Team members</th><th>Next lead goes to</th><th>Leads</th></tr></thead><tbody>
        ${rows.length ? rows.map((r) => { const ok = r.people.filter((m) => m.status === "Active"), nx = ok.length ? nextOf(ok) : null; return html`<tr><td><b>${r.name}</b></td>
          <td>${r.people.map((m) => html`<span class="pj ${m.status === "Active" ? "" : "off"}" title="${m.status}">${m.name}</span>`)}</td><td>${nx ? html`<b>${nx.name}</b>` : html`<span class="muted">Nobody active</span>`}</td>
          <td>${state.leads.filter((l) => projMatch(l.project, r.name)).length}</td></tr>`; }) : html`<tr><td colspan="4" class="empty">No projects assigned yet. Add projects to a team member (Edit details).</td></tr>`}</tbody></table></div>
      <div class="card p" style="margin-top:14px"><h3>Projects nobody is assigned to</h3>
        ${unc.length ? html`<p class="sub" style="margin:4px 0 8px">Leads for these (last 90 days) are shared across ${rms.length} active relationship manager${rms.length === 1 ? "" : "s"}. Assign them to someone to route them properly.</p><div>${unc.map((u) => html`<span class="pj warn">${u.name} · ${u.n}</span>`)}</div>`
          : html`<p class="sub" style="margin:4px 0 0">Every project your recent leads asked about has someone assigned.</p>`}</div>`;
  }

  function drawer(m) {
    if (!m) return raw("");
    const s = stats.get(m.id), tgt = Number(m.monthly_target || 0);
    return html`<aside class="card drawer" aria-label="Team member details"><div class="drawer-h"><h2>${KIND[m.kind]} Details – ${m.name}</h2><button id="closeDrawer" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="drawer-b">
        <div class="tm-head">${avatar(m.name, 64)}<div><h3>${m.name}</h3><p>${m.designation || KIND[m.kind]}</p><span class="chip ${m.status === "Active" ? "c-ok" : "c-none"}">${m.status}</span></div></div>
        <ul class="tm-info">
          ${m.phone ? html`<li><i data-lucide="phone"></i><a href="${telHref(m.phone)}">${m.phone}</a></li>` : raw("")}${m.email ? html`<li><i data-lucide="mail"></i><a href="mailto:${m.email}">${m.email}</a></li>` : raw("")}
          <li><i data-lucide="user-check"></i><span class="k">Type</span>${KIND[m.kind]}</li><li><i data-lucide="users"></i><span class="k">Team</span>${m.team || "—"}</li><li><i data-lucide="map-pin"></i><span class="k">Location</span>${m.location || "—"}</li>
          <li class="pj-li"><i data-lucide="folder-kanban"></i><span class="k">Projects</span><span>${(m.projects || []).length ? pj(m.projects, 20) : "None yet"}</span></li><li><i data-lucide="shuffle"></i><span class="k">Last lead</span>${m.last_assigned_at ? relTime(m.last_assigned_at) : "—"}</li>
          <li><i data-lucide="calendar"></i><span class="k">Joined On</span>${m.joined_on ? new Date(m.joined_on + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</li><li><i data-lucide="id-card"></i><span class="k">Employee ID</span>${empId(m)}</li></ul>
        <div class="tm-target"><div><small>Monthly Target</small><b>${tgt ? fmtMoney(tgt) : "Not set"}</b></div><div><small>Achieved</small><b>${fmtMoney(s.achieved)}${tgt ? " (" + fmtPct(pct(s.achieved, tgt)) + ")" : ""}</b></div></div>
        <h4 class="tm-h">Performance (This Month)</h4>
        <div class="tiles4"><div><b>${s.leadsM}</b><small>Leads</small></div><div><b>${s.visitsM}</b><small>Site Visits</small></div><div><b>${s.bookingsM}</b><small>Bookings</small></div><div><b>${s.leadsM ? fmtPct(pct(s.bookedM, s.leadsM)) : "—"}</b><small>Conversion</small></div></div>
        <p class="sub" style="margin-top:10px">All time: ${s.leads} leads · ${s.bookings} bookings · ${s.value ? fmtMoney(s.value) : "no deal value"}. <a href="leads.html?q=${encodeURIComponent(m.name)}">View their leads</a></p>
      </div>
      <div class="drawer-f"><button class="btn outline" id="dEdit"><i data-lucide="pencil"></i>Update Details</button><button class="btn outline" id="dToggle"><i data-lucide="${m.status === "Active" ? "user-x" : "user-check"}"></i>${m.status === "Active" ? "Deactivate" : "Activate"}</button></div></aside>`;
  }

  function drawCharts(target, achieved) {
    const grid = { color: "#eef1f3" }, ticks = { font: { size: 11 } };
    const pc = document.getElementById("perf");
    if (pc && window.Chart) charts.push(new Chart(pc, { type: "doughnut", data: { labels: ["Achieved", "Remaining"], datasets: [{ data: [Math.min(achieved, target), Math.max(0, target - achieved)], backgroundColor: ["#0f7a6b", "#e8a91f"], borderWidth: 0 }] }, options: { cutout: "72%", plugins: { legend: { display: false } }, maintainAspectRatio: false } }));
    const cv = document.getElementById("conv"); if (!cv || !window.Chart) return;
    const now = new Date(), months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)), mk = (d) => d.getFullYear() * 12 + d.getMonth();
    const lm = new Map(), bm = new Map(), cm = new Map(), seenCm = new Set();
    state.leads.forEach((l) => { if (state.owner.has(l.dbId)) { const k = mk(new Date(l.createdAt)); lm.set(k, (lm.get(k) || 0) + 1); } });
    state.bookings.forEach((b) => { if (state.owner.has(b.enquiry_id)) { const k = mk(new Date(b.booking_date)); bm.set(k, (bm.get(k) || 0) + 1); if (!seenCm.has(b.enquiry_id + "|" + k)) { seenCm.add(b.enquiry_id + "|" + k); cm.set(k, (cm.get(k) || 0) + 1); } } });
    const bk = months.map((d) => bm.get(mk(d)) || 0), rate = months.map((d) => Math.round(pct(cm.get(mk(d)) || 0, lm.get(mk(d)) || 0) * 10) / 10);
    charts.push(new Chart(cv, { data: { labels: months.map((d) => d.toLocaleString("en-US", { month: "short" })), datasets: [
      { type: "bar", label: "Bookings", data: bk, backgroundColor: "#0f7a6b", borderRadius: 4, yAxisID: "y" }, { type: "line", label: "Conversion Rate (%)", data: rate, borderColor: "#e8a91f", backgroundColor: "#e8a91f", tension: 0.3, yAxisID: "y1" }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "top", labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false }, ticks }, y: { beginAtZero: true, grid, ticks: { ...ticks, precision: 0 } }, y1: { position: "right", beginAtZero: true, grid: { display: false }, ticks } } } }));
  }

  // ---------- add / edit ----------
  function openMember(m, kind, done) {
    const k = m ? m.kind : kind;
    openModal(m ? "Edit " + m.name : k === "rm" ? "Add Relationship Manager" : "Add Agent", html`<div class="form">
      ${selectField("Type", "kind_label", ["Agent", "Relationship Manager"], KIND[k])}${selectField("Status", "status", ["Active", "Inactive"], m ? m.status : "Active")}
      ${field("Name *", "name", m ? m.name : "", "text", "required maxlength=\"120\"")}${field("Mobile * (10 digits)", "phone", m ? m.phone || "" : "", "tel", 'required pattern="[0-9+ \\-]{10,15}"')}
      ${field("Email", "email", m ? m.email || "" : "", "email")}${field("Designation", "designation", m ? m.designation || "" : "", "text", 'placeholder="' + (k === "rm" ? "Relationship Manager" : "Sales Executive") + '"')}
      ${field("Team", "team", m ? m.team || "" : "", "text", 'placeholder="e.g. Pune Team"')}${field("Location", "location", m ? m.location || "" : "", "text", 'placeholder="e.g. Pune"')}
      ${field("Monthly target (₹)", "monthly_target", m ? m.monthly_target || "" : "", "number", 'min="0" step="1000" placeholder="e.g. 10000000"')}${field("Joined on", "joined_on", m ? m.joined_on || "" : new Date().toISOString().slice(0, 10), "date")}
      <div class="full proj-picker"><label>Projects (new leads for these go to this person)</label><div class="chips" data-chips></div>
        <div class="copyrow"><input list="projListM" placeholder="Type or pick a project, then press Enter" aria-label="Add a project" data-pin><button type="button" class="btn sm" data-padd><i data-lucide="plus"></i>Add</button></div>
        <datalist id="projListM">${projectNames().map((n) => html`<option value="${n}"></option>`)}</datalist><input type="hidden" name="projects" value="${JSON.stringify((m && m.projects) || [])}"></div>
      ${m ? html`<p class="sub full" style="margin:0">Leads are matched to a person by name. If you rename them, leads already assigned keep the old name until you change them.</p>` : raw("")}</div>`,
      async (f) => { f.kind = f.kind_label === "Relationship Manager" ? "rm" : "agent"; try { f.projects = JSON.parse(f.projects || "[]"); } catch { f.projects = []; } await Data.saveMember(m ? m.id : null, f); toast(m ? "Saved" : (f.kind === "rm" ? "Relationship manager added" : "Agent added")); done && (await done()); });
    setupPicker();
  }
  function setupPicker() {
    const box = document.querySelector(".overlay .proj-picker"); if (!box) return;
    const hid = box.querySelector("[name=projects]"), chips = box.querySelector("[data-chips]"), inp = box.querySelector("[data-pin]"); let list = []; try { list = JSON.parse(hid.value || "[]"); } catch { /* start empty */ }
    const paint = () => { hid.value = JSON.stringify(list); chips.innerHTML = list.map((x, i) => `<span class="pj">${esc(x)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("") || '<small class="muted">No projects yet</small>'; };
    const add = () => { const v = inp.value.trim(); if (v && !list.some((x) => normP(x) === normP(v))) list.push(v); inp.value = ""; paint(); };
    box.querySelector("[data-padd]").onclick = add; inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } };
    chips.onclick = (e) => { const b = e.target.closest("[data-rm]"); if (b) { list.splice(Number(b.dataset.rm), 1); paint(); } };
    box.closest("form").addEventListener("submit", () => { if (inp.value.trim()) add(); }, true); paint();
  }
  const refresh = async () => { if (await load()) draw(); };

  function exportCsv() {
    downloadCsv("keys99-team.csv", ["Employee ID", "Name", "Type", "Designation", "Mobile", "Email", "Team", "Location", "Status", "Joined", "Monthly target", "Leads", "Site visits", "Bookings", "Deal value", "Commission", "Conversion %"],
      visible().map((m) => { const s = stats.get(m.id); return [empId(m), m.name, KIND[m.kind], m.designation, m.phone, m.email, m.team, m.location, m.status, m.joined_on, m.monthly_target, s.leads, s.visits, s.bookings, s.value, s.commission, s.leads ? Math.round(pct(s.booked, s.leads) * 10) / 10 : ""]; }));
  }

  function bind(list) {
    page.querySelectorAll("[data-tab]").forEach((x) => (x.onclick = () => { state.tab = x.dataset.tab; state.page = 1; draw(); }));
    page.querySelectorAll("[data-f]").forEach((x) => (x.onchange = () => { state.f[x.dataset.f] = x.value; state.page = 1; draw(); }));
    const q = page.querySelector("#q"); if (q) q.oninput = () => { state.q = q.value; state.page = 1; const pos = q.selectionStart; draw(); const n = page.querySelector("#q"); n.focus(); n.setSelectionRange(pos, pos); };
    page.querySelectorAll("[data-page]").forEach((x) => (x.onclick = () => { state.page = Number(x.dataset.page); draw(); }));
    page.querySelectorAll("tr.tm-row").forEach((r) => { const open = () => { state.selId = Number(r.dataset.id); draw(); }; r.onclick = (e) => { if (!e.target.closest("button,a")) open(); }; r.onkeydown = (e) => { if (e.key === "Enter" && e.target === r) open(); }; });
    page.querySelectorAll("[data-menu]").forEach((b) => (b.onclick = (e) => {
      e.stopPropagation(); const m = state.members.find((x) => x.id === Number(b.dataset.menu));
      popMenu(b, [["Edit details", "pencil", () => openMember(m, m.kind, refresh)], [m.status === "Active" ? "Deactivate" : "Activate", m.status === "Active" ? "user-x" : "user-check", async () => { try { await Data.setMemberStatus(m.id, m.status === "Active" ? "Inactive" : "Active"); toast("Saved"); await refresh(); } catch (err) { alert(err.message); } }],
        ["Delete", "trash-2", async () => { if (!confirm("Delete " + m.name + "? Leads already assigned to this name keep it.")) return; try { await Data.deleteMember(m.id); if (state.selId === m.id) state.selId = null; toast("Deleted"); await refresh(); } catch (err) { alert(err.message); } }, true]]);
    }));
    const add = (kind) => () => openMember(null, kind, refresh);
    ["#addAgent", "#qaAgent"].forEach((s) => (page.querySelector(s).onclick = add("agent"))); ["#addRm", "#qaRm"].forEach((s) => (page.querySelector(s).onclick = add("rm")));
    ["#export", "#qaExport"].forEach((s) => (page.querySelector(s).onclick = exportCsv));
    const sw = page.querySelector("#aaSwitch"); if (sw) sw.onchange = async () => {
      const want = sw.checked, noEmail = state.members.filter((m) => m.status === "Active" && !m.email).length;
      if (want && !confirm("Turn on auto-assign? From now on, every new lead is assigned automatically." + (noEmail ? "\n\n" + noEmail + " active member(s) have no email, so alerts for their leads go to the fallback address." : ""))) { sw.checked = false; return; }
      try { await Data.setAutoAssign(want); state.auto = want; toast(want ? "Auto-assign is on" : "Auto-assign is off"); draw(); } catch (err) { sw.checked = !want; alert("Could not change it: " + err.message); }
    };
    const pg = page.querySelector("#pvGo"); if (pg) { const run = async () => { const out = page.querySelector("#pvOut"), v = page.querySelector("#pvIn").value.trim(); out.textContent = "Checking…";
      try { const r = await Data.whoGetsNext(v); out.innerHTML = r ? `<b>${esc(r.name)}</b> — ${r.matched ? "has this project" : "no one has this project, so it goes to the shared relationship manager rotation"}.${r.email ? "" : " They have no email, so the alert goes to the fallback address."}${state.auto ? "" : " <i>Auto-assign is off, so nothing is assigned yet.</i>"}` : "Nobody is available, so the lead would stay unassigned (alert goes to the fallback address)."; } catch (err) { out.textContent = "Could not check: " + err.message; } };
      pg.onclick = run; page.querySelector("#pvIn").onkeydown = (e) => { if (e.key === "Enter") run(); }; }
    const c = page.querySelector("#closeDrawer"); if (c) c.onclick = () => { state.selId = null; draw(); };
    const e = page.querySelector("#dEdit"); if (e) e.onclick = () => openMember(state.members.find((m) => m.id === state.selId), null, refresh);
    const t = page.querySelector("#dToggle"); if (t) t.onclick = async () => { const m = state.members.find((x) => x.id === state.selId); try { await Data.setMemberStatus(m.id, m.status === "Active" ? "Inactive" : "Active"); toast("Saved"); await refresh(); } catch (err) { alert(err.message); } };
    if (window.lucide) lucide.createIcons();
  }

  if (await load()) draw();
})();
