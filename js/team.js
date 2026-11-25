// My Team: the people below a reporting manager, with their leads and performance for a chosen period.
// The database only returns what the signed-in manager may see (their own leads and those of everyone who reports to them), so every number here is scoped by it.
(async function () {
  const page = await mountShell("team");
  if (!page) return;
  const me = window.ME, team = (me.team || []).slice();
  const RANGES = { today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month", lastmonth: "Last month", "90d": "Last 3 months", custom: "Custom range…" };
  const state = { range: "month", cFrom: "", cTo: "", cErr: "", q: "", sort: "leads", dir: -1, sel: null, loaded: false, err: "" };
  let leads = [], visits = [], bookings = [], tasks = [], hours = [], chart = null;
  const k = (s) => String(s || "").trim().toLowerCase();
  const ymdOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const shortD = (s) => { const d = parseYmd(s); return d ? d.toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric" }) : ""; };
  const rangeName = () => (state.range === "custom" ? (state.cFrom && state.cTo && !state.cErr ? shortD(state.cFrom) + " – " + shortD(state.cTo) : "Custom range") : RANGES[state.range]);
  const bounds = () => { if (state.range === "custom") setCustomRange(state.cFrom, state.cTo); return rangeBounds(state.range); };
  const inR = (ts, b) => !b.from || (new Date(ts) >= b.from && new Date(ts) < b.to);
  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 1000) / 10) : 0);

  async function load() {
    try {
      const b = bounds(), from = ymdOf(b.from || new Date(Date.now() - 89 * 864e5)), to = ymdOf(b.to ? new Date(b.to.getTime() - 864e5) : new Date());
      [leads, visits, bookings, tasks] = await Promise.all([Data.getLeads(), Data.getSiteVisits().catch(() => []), Data.getBookings().catch(() => []), Data.getTasks().catch(() => [])]);
      hours = await Data.getActiveTime(from, to).catch(() => []);
      state.err = ""; state.loaded = true;
    } catch (e) { state.err = e.message || String(e); }
  }

  // one row of numbers per person in my team (the keys are the same as the Dashboard: bookings = leads moved to Booking Done / Post Sale in the period)
  function rows() {
    const b = bounds(), now = new Date(), bk = bookDatesOf(bookings), byOwner = new Map(), idByName = new Map(team.map((m) => [k(m.name), m.id])), idsByEmail = new Map(); team.forEach((m) => { if (m.email) (idsByEmail.get(k(m.email)) || idsByEmail.set(k(m.email), []).get(k(m.email))).push(m); });
    leads.forEach((l) => { /* the email identifies the person; when two people share it, the name decides */ const same = k(l.agentEmail) ? idsByEmail.get(k(l.agentEmail)) : null, mid = same ? ((same.find((m) => k(m.name) === k(l.agent)) || (same.length === 1 ? same[0] : null)) || {}).id : idByName.get(k(l.agent)); if (mid == null) return; (byOwner.get(mid) || byOwner.set(mid, []).get(mid)).push(l); });      // by name, or by email when the person was renamed after the lead was assigned
    const idByLead = new Map(leads.map((l) => [l.dbId, l]));
    return team.map((m) => {
      const mine = byOwner.get(m.id) || [], inP = mine.filter((l) => inR(l.createdAt, b)), ids = new Set(mine.map((l) => l.dbId));
      const vis = visits.filter((v) => ids.has(v.enquiry_id) && inR(v.visit_at, b)).length;
      const booked = mine.filter((l) => { const d = bookedAt(l, bk); return d && inR(d, b); });
      const value = bookings.filter((x) => ids.has(x.enquiry_id) && booked.some((l) => l.dbId === x.enquiry_id)).reduce((t, x) => t + Number(x.booking_value || 0), 0);
      const over = mine.filter((l) => l.followUpTs && !CLOSED.includes(l.status) && new Date(l.followUpTs) < now).length;
      const pendingTasks = tasks.filter((t) => t.assigned_to === m.id && !t.done_at).length;
      const hr = hours.filter((h) => h.memberId === m.id), minutes = hr.reduce((t, h) => t + h.minutes, 0), last = hr.map((h) => h.lastAt).filter(Boolean).sort().pop() || "";
      return { m, leads: inP.length, fresh: inP.filter((l) => l.status === "New Leads").length, interested: inP.filter((l) => l.status === "Interested").length, visits: vis, bookings: booked.length, value, conv: pct(booked.length, inP.length), over, pendingTasks, minutes, last, all: mine.length, target: Number(m.monthly_target) || 0 };
    });
  }
  const SORTS = { name: (r) => k(r.m.name), leads: (r) => r.leads, interested: (r) => r.interested, visits: (r) => r.visits, bookings: (r) => r.bookings, conv: (r) => r.conv, over: (r) => r.over, minutes: (r) => r.minutes, last: (r) => r.last };

  function drawChart(R) {
    if (chart) { chart.destroy(); chart = null; }
    const cv = page.querySelector("#tmChart"); if (!cv || !window.Chart) return;
    const top = [...R].sort((a, b) => b.leads - a.leads).slice(0, 12), grid = { color: Theme.grid() }, ticks = { font: { size: 11 } };
    chart = new Chart(cv, { type: "bar", data: { labels: top.map((r) => r.m.name.split(" ")[0] + (r.m.id === me.memberId ? " (you)" : "")), datasets: [
      { label: "Leads", data: top.map((r) => r.leads), backgroundColor: "#9adbc8", borderRadius: 4 }, { label: "Site visits", data: top.map((r) => r.visits), backgroundColor: "#3b82f6", borderRadius: 4 }, { label: "Bookings", data: top.map((r) => r.bookings), backgroundColor: "#0f7a6b", borderRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "top", labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false }, ticks }, y: { beginAtZero: true, grid, ticks: { ...ticks, precision: 0 } } } } });
  }

  function draw() {
    const R = rows(), tot = (f) => R.reduce((t, r) => t + f(r), 0), q = k(state.q);
    const list = R.filter((r) => !q || k([r.m.name, r.m.designation, r.m.team].join(" ")).includes(q)).sort((a, b) => { const f = SORTS[state.sort] || SORTS.leads, x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * state.dir || k(a.m.name).localeCompare(k(b.m.name)); });
    const kpis = [["People", team.length, "", "users", 1], ["Leads", tot((r) => r.leads).toLocaleString("en-IN"), "", "user-plus"], ["Site Visits", tot((r) => r.visits), "", "calendar-check"], ["Bookings", tot((r) => r.bookings), "", "handshake"],
      ["Conversion", pct(tot((r) => r.bookings), tot((r) => r.leads)) + "%", "", "trending-up"], ["Overdue follow-ups", tot((r) => r.over), "", "alarm-clock"], ["Active hours", Hours.fmt(tot((r) => r.minutes)), "", "clock"]];
    const th = (key, label, cls = "") => html`<th class="${cls}"><button type="button" class="th-sort ${state.sort === key ? "on" : ""}" data-sort="${key}" aria-label="Sort by ${label}">${label}${state.sort === key ? (state.dir < 0 ? " ↓" : " ↑") : ""}</button></th>`;
    const sel = state.sel ? R.find((r) => r.m.id === state.sel) : null;
    render(page, html`
      <div class="page-head"><div><h1>My Team</h1><p class="sub">${team.length > 1 ? "You and the " + (team.length - 1) + " " + (team.length === 2 ? "person" : "people") + " who report to you" : "Nobody reports to you yet"} · ${rangeName()}.</p></div>
        <div class="range-box"><select class="select" id="tmRange" aria-label="Period">${Object.entries(RANGES).map(([key, v]) => html`<option value="${key}" ${key === state.range ? raw("selected") : raw("")}>${v}</option>`)}</select>
          ${state.range === "custom" ? html`<div class="range-custom"><label>From<input type="date" id="cFrom" value="${state.cFrom}" max="${state.cTo || ""}"></label><label>To<input type="date" id="cTo" value="${state.cTo}" min="${state.cFrom || ""}"></label></div>` : raw("")}</div></div>
      ${state.err ? html`<div class="ban pend" role="alert"><i data-lucide="triangle-alert"></i><div><b>Could not load the team: ${state.err}</b></div></div>` : raw("")}
      ${state.range === "custom" && state.cErr ? html`<div class="ban pend range-err" role="alert"><i data-lucide="triangle-alert"></i><div><b>${state.cErr}</b><small>Showing all time until the dates are fixed.</small></div></div>` : raw("")}
      <div class="kpis k7">${kpis.map(kpiCard)}</div>
      <section class="card p"><div class="ch"><h3>Leads, visits and bookings by person</h3></div><div class="chart-box"><canvas id="tmChart"></canvas></div></section>
      <section class="card p tm-card"><div class="ch"><h3>Team performance</h3><label class="pp-search"><i data-lucide="search"></i><input id="tmQ" type="search" placeholder="Search team…" value="${state.q}" aria-label="Search team"></label></div>
        <div class="table-wrap"><table class="mini-t tm-t"><thead><tr>${th("name", "Member")}${th("leads", "Leads", "num")}${th("interested", "Interested", "num")}${th("visits", "Visits", "num")}${th("bookings", "Bookings", "num")}${th("conv", "Conv.", "num")}<th class="num">Booked value</th>${th("over", "Overdue", "num")}${th("minutes", "Hours", "num")}${th("last", "Last active")}</tr></thead>
          <tbody>${list.length ? list.map((r) => html`<tr class="${state.sel === r.m.id ? "sel" : ""}" data-m="${r.m.id}" tabindex="0"><td><div class="row" style="padding-left:${Math.min(r.m.depth || 0, 4) * 14}px">${avatar(r.m.name, 30)}<div><b>${r.m.name}</b>${r.m.id === me.memberId ? html` <span class="pill-g">You</span>` : raw("")}<small>${[r.m.designation, r.m.team].filter(Boolean).join(" · ") || "—"}</small></div></div></td>
            <td class="num">${r.leads}</td><td class="num">${r.interested}</td><td class="num">${r.visits}</td><td class="num">${r.bookings}</td><td class="num">${r.conv}%</td><td class="num">${r.value ? fmtMoney(r.value) : "—"}${state.range === "month" && r.target ? html`<small>${Math.min(999, Math.round((r.value / r.target) * 100))}% of target</small>` : raw("")}</td>
            <td class="num ${r.over ? "warn" : ""}">${r.over}</td><td class="num">${r.minutes ? Hours.fmt(r.minutes) : "—"}</td><td>${r.last ? relTime(r.last) : "—"}</td></tr>`) : html`<tr><td colspan="10" class="empty">No one matches.</td></tr>`}</tbody></table></div></section>
      ${sel ? detail(sel) : raw("")}`);
    bind(R); drawChart(R);
  }

  function detail(r) {
    const ls = leads.filter((l) => (k(l.agentEmail) ? !!k(r.m.email) && k(l.agentEmail) === k(r.m.email) && (k(l.agent) === k(r.m.name) || !team.some((o) => o.id !== r.m.id && k(o.email) === k(l.agentEmail))) : k(l.agent) === k(r.m.name))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
    return html`<section class="card p tm-det" id="tmDet"><div class="ch"><h3>${r.m.name}</h3><button type="button" class="btn sm" id="tmClose" aria-label="Close details"><i data-lucide="x"></i>Close</button></div>
      <p class="sub" style="margin:0 0 10px">${[r.m.designation, r.m.team].filter(Boolean).join(" · ") || "Team member"} · ${r.all} lead${r.all === 1 ? "" : "s"} in total, ${r.pendingTasks} open task${r.pendingTasks === 1 ? "" : "s"}</p>
      <div class="tm-nums"><div><b>${r.leads}</b>Leads</div><div><b>${r.visits}</b>Visits</div><div><b>${r.bookings}</b>Bookings</div><div><b>${r.conv}%</b>Conversion</div><div><b>${r.over}</b>Overdue</div></div>
      ${ls.length ? html`<ul class="list tm-leads">${ls.map((l) => html`<li><a href="customer.html?id=L-${l.dbId}"><b>${l.name}</b></a><small>${[l.project, l.status].filter(Boolean).join(" · ")}</small><span class="muted">${relTime(l.createdAt)}</span></li>`)}</ul>` : html`<div class="empty-sm">No leads yet.</div>`}
      <div class="btns" style="margin-top:12px"><button type="button" class="btn gold" id="tmOpen"><i data-lucide="user-search"></i>Open all their leads</button></div></section>`;
  }

  function bind() {
    page.querySelector("#tmRange").onchange = async (e) => {
      state.range = e.target.value;
      if (state.range === "custom" && !state.cFrom) { const t = new Date(); state.cTo = ymdOf(t); t.setDate(t.getDate() - 6); state.cFrom = ymdOf(t); state.cErr = ""; }
      await load(); draw();
    };
    const cf = page.querySelector("#cFrom"), ct = page.querySelector("#cTo");
    if (cf && ct) { const apply = async () => { const a = parseYmd(cf.value), z = parseYmd(ct.value); state.cFrom = cf.value; state.cTo = ct.value; state.cErr = !a || !z ? "Choose both a From and a To date." : a > z ? "The From date must be on or before the To date." : (z - a) / 864e5 > 800 ? "Please choose a period of 800 days or less." : ""; await load(); draw(); }; cf.onchange = apply; ct.onchange = apply; }
    const q = page.querySelector("#tmQ"); q.oninput = () => { state.q = q.value; const pos = q.selectionStart; draw(); const n = page.querySelector("#tmQ"); n.focus(); n.setSelectionRange(pos, pos); };
    page.querySelectorAll("[data-sort]").forEach((b) => (b.onclick = () => { const key = b.dataset.sort; state.dir = state.sort === key ? -state.dir : (key === "name" ? 1 : -1); state.sort = key; draw(); }));
    page.querySelectorAll("tr[data-m]").forEach((tr) => { const open = () => { state.sel = Number(tr.dataset.m); draw(); const d = page.querySelector("#tmDet"); if (d) d.scrollIntoView({ block: "nearest", behavior: "smooth" }); }; tr.onclick = open; tr.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }; });
    const c = page.querySelector("#tmClose"); if (c) c.onclick = () => { state.sel = null; draw(); };
    const o = page.querySelector("#tmOpen"); if (o) o.onclick = () => { Scope.set("m:" + state.sel); location.href = "leads.html"; };
  }

  await load(); draw();
})();
