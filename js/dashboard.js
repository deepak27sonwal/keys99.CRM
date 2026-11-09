(async function () {
  const page = await mountShell("dashboard");
  if (!page) return;
  let leads, visits, bookings;
  try { [leads, visits, bookings] = await Promise.all([Data.getLeads(), Data.getSiteVisits(), Data.getBookings()]); }
  catch (e) { page.innerHTML = '<div class="card empty">Could not load data: ' + esc(e.message) + "</div>"; return; }
  const byId = new Map(leads.map((l) => [l.dbId, l]));
  const RANGES = { "30d": "Last 30 days", month: "This month", "90d": "Last 3 months", all: "All time" };
  const state = { range: "30d" };
  let charts = [];

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  function bounds(r) {
    const now = new Date();
    if (r === "all") return { cur: { start: null, end: null }, prev: null };
    if (r === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1), e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { cur: { start: s, end: e }, prev: { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: s } };
    }
    const days = r === "90d" ? 90 : 30, e = new Date(startOfDay(now).getTime() + 86400000), s = new Date(e - days * 86400000);
    return { cur: { start: s, end: e }, prev: { start: new Date(s - days * 86400000), end: s } };
  }
  const inR = (ts, b) => !b || !b.start || (new Date(ts) >= b.start && new Date(ts) < b.end);
  const bkDate = (b) => new Date(b.booking_date + "T00:00:00");
  const pct = (cur, prev) => (!prev ? "" : (cur - prev >= 0 ? "+" : "") + Math.round(((cur - prev) / prev) * 100) + "%");
  const sum = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
  const group = (arr, keyFn) => { const m = new Map(); arr.forEach((x) => { const k = keyFn(x); (m.get(k) || m.set(k, []).get(k)).push(x); }); return m; };

  function stats(b) {
    const L = leads.filter((l) => inR(l.createdAt, b)), V = visits.filter((v) => inR(v.visit_at, b)), B = bookings.filter((x) => inR(bkDate(x), b));
    return { L, V, B, total: L.length, fresh: L.filter((l) => l.status === "New").length, qualified: L.filter((l) => l.status === "Qualified").length,
      due: sum(B.filter((x) => x.commission_status === "Pending"), (x) => x.commission_amount), recv: sum(B.filter((x) => x.commission_status === "Received"), (x) => x.commission_amount) };
  }

  function trendBuckets(b, L, B) {
    const first = L.length ? new Date(Math.min(...L.map((l) => +new Date(l.createdAt)))) : new Date();
    const start = b.start || startOfDay(first), end = b.end || new Date(), span = (end - start) / 86400000;
    const unit = span <= 31 ? "day" : span <= 200 ? "week" : "month";
    const key = (d) => {
      d = new Date(d);
      if (unit === "month") return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (unit === "week") { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); }
      return startOfDay(d).toISOString().slice(0, 10);
    };
    const keys = [], seen = new Set();
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) { const k = key(d); if (!seen.has(k)) { seen.add(k); keys.push(k); } }
    const lab = (k) => (unit === "month" ? new Date(k + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" }) : new Date(k).toLocaleString("en-US", { month: "short", day: "numeric" }));
    const n = new Map(keys.map((k) => [k, 0])), c = new Map(keys.map((k) => [k, 0]));
    L.forEach((l) => { const k = key(l.createdAt); if (n.has(k)) n.set(k, n.get(k) + 1); });
    B.forEach((x) => { const k = key(bkDate(x)); if (c.has(k)) c.set(k, c.get(k) + 1); });
    return { labels: keys.map(lab), leads: keys.map((k) => n.get(k)), conv: keys.map((k) => c.get(k)) };
  }

  function draw() {
    charts.forEach((c) => c.destroy()); charts = [];
    const bd = bounds(state.range), cur = stats(bd.cur), prev = bd.prev ? stats(bd.prev) : null;
    const d = (a, b) => (prev ? pct(a, b) : "");
    const kpis = [
      ["Total Leads", cur.total.toLocaleString("en-IN"), d(cur.total, prev && prev.total), "users", 1],
      ["New Leads", cur.fresh.toLocaleString("en-IN"), d(cur.fresh, prev && prev.fresh), "user-plus"],
      ["Qualified Leads", cur.qualified.toLocaleString("en-IN"), d(cur.qualified, prev && prev.qualified), "clipboard-check"],
      ["Site Visits", cur.V.length, d(cur.V.length, prev && prev.V.length), "calendar-check"],
      ["Bookings", cur.B.length, d(cur.B.length, prev && prev.B.length), "handshake"],
      ["Brokerage (Due)", fmtMoney(cur.due), d(cur.due, prev && prev.due), "coins"],
      ["Brokerage (Received)", fmtMoney(cur.recv), d(cur.recv, prev && prev.recv), "coins", 0, 1],
    ];

    // sources
    const srcMap = group(cur.L, (l) => l.source || "Website");
    let srcs = [...srcMap].map(([n, a]) => [n, a.length]).sort((a, b) => b[1] - a[1]);
    if (srcs.length > 5) srcs = [...srcs.slice(0, 5), ["Others", srcs.slice(5).reduce((t, x) => t + x[1], 0)]];
    const COLORS = ["#0f7a6b", "#e8a91f", "#3b6fe0", "#9b6fe0", "#2e86de", "#c3c9cf"];

    // pipeline (current status of leads created in range)
    const stages = [["New Enquiry", "New"], ["Contacted", "Contacted"], ["Interested", "Interested"], ["Qualified", "Qualified"], ["Site Visit", "Site Visit"], ["Negotiation", "Negotiation"], ["Booked", "Booked"]]
      .map(([label, st]) => [label, cur.L.filter((l) => l.status === st).length]);
    const maxStage = Math.max(1, ...stages.map((s) => s[1]));
    const fcol = ["#0b6b5d", "#0f7a6b", "#0f7a6b", "#e8a91f", "#e8a91f", "#f3c04c", "#e8a91f"];

    // upcoming visits, follow-ups, agents, developers, recent
    const now = new Date();
    const upcoming = visits.filter((v) => ["Scheduled", "Confirmed"].includes(v.status) && new Date(v.visit_at) >= now).sort((a, b) => new Date(a.visit_at) - new Date(b.visit_at)).slice(0, 3);
    const todays = leads.filter((l) => l.followUpTs && sameDay(l.followUpTs, now) && !["Lost", "Booked"].includes(l.status)).sort((a, b) => new Date(a.followUpTs) - new Date(b.followUpTs));
    const agentMap = group(cur.B, (x) => (byId.get(x.enquiry_id) || {}).agent || "Unassigned");
    const agents = [...agentMap].map(([n, a]) => [n, a.length, sum(a, (x) => x.commission_amount)]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 3);
    const devMap = group(cur.B, (x) => x.developer || (byId.get(x.enquiry_id) || {}).developer || "Others");
    const devs = [...devMap].map(([n, a]) => [n, a.length, sum(a, (x) => x.commission_amount)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const recent = leads.slice(0, 3);
    const medal = ["#f3c04c", "#cbd5e1", "#fb923c"];
    const monthsBack = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
    const comm = monthsBack.map((m) => sum(bookings.filter((x) => x.commission_status === "Received" && (() => { const dt = new Date((x.received_on || x.booking_date) + "T00:00:00"); return dt.getFullYear() === m.getFullYear() && dt.getMonth() === m.getMonth(); })()), (x) => x.commission_amount) / 1e5);
    const tb = trendBuckets(bd.cur, cur.L, cur.B);
    const hour = now.getHours(), greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
    const more = (href = "leads.html") => html`<a class="more" href="${href}">View All<i data-lucide="arrow-right"></i></a>`;

    render(page, html`
      <div class="page-head"><div><h1>${greet}! 👋</h1><p class="sub">Here's your Keys99 business overview · ${RANGES[state.range]}.</p></div>
        <select class="select" id="range" aria-label="Date range">${Object.entries(RANGES).map(([k, v]) => html`<option value="${k}" ${k === state.range ? raw("selected") : raw("")}>${v}</option>`)}</select></div>
      <div class="kpis k7">${kpis.map(kpiCard)}</div>
      <div class="grid g-top">
        <section class="card p"><div class="ch"><h3>Lead Trend</h3><div class="legend"><span><i style="background:#0f7a6b"></i>New Leads</span><span><i style="background:#e8a91f"></i>Bookings</span></div></div><div class="chart-box"><canvas id="trend"></canvas></div></section>
        <section class="card p"><div class="ch"><h3>Lead Source</h3></div>${srcs.length ? html`<div class="donut-wrap"><div class="donut"><canvas id="src"></canvas><div class="mid"><b>${cur.total}</b><span>Total Leads</span></div></div>
          <ul class="dl-list">${srcs.map(([n, v], i) => html`<li><i style="background:${COLORS[i]}"></i><span>${n}</span><em>${Math.round((v / cur.total) * 100)}%</em></li>`)}</ul></div>` : html`<div class="empty-sm">No leads in this period.</div>`}</section>
        <section class="card p funnel"><div class="ch"><h3>Sales Pipeline</h3>${more()}</div>
          ${stages.map(([s, n], i) => html`<div class="f"><div class="track"><div class="bar" style="width:${Math.max(48, (n / maxStage) * 100)}%;background:${fcol[i]}">${s}</div></div><b>${n}</b></div>`)}</section>
      </div>
      <div class="grid g-3">
        <section class="card p"><div class="ch"><i data-lucide="calendar-check"></i><h3>Upcoming Site Visits</h3></div>
          ${upcoming.length ? html`<ul class="list">${upcoming.map((v) => { const l = byId.get(v.enquiry_id) || {}; const dt = new Date(v.visit_at); return html`<li><div class="datebox">${dt.toLocaleString("en-US", { month: "short" })}<b>${String(dt.getDate()).padStart(2, "0")}</b></div><span class="muted" style="width:64px;font-size:12px">${dt.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" })}</span><div class="grow"><b style="font-weight:500">${v.project || l.project || "—"}</b><small>${l.name || ""}</small></div>${l.mobile ? html`<a href="${telHref(l.mobile)}" aria-label="Call"><i data-lucide="phone" class="green-t"></i></a>` : raw("")}<span class="badge b-${v.status}">${v.status}</span></li>`; })}</ul>` : html`<div class="empty-sm">No upcoming site visits.</div>`}</section>
        <section class="card p"><div class="ch"><i data-lucide="circle-check"></i><h3>Today's Follow-ups (${todays.length})</h3></div>
          ${todays.length ? html`<ul class="list">${todays.slice(0, 4).map((l) => html`<li><span class="avatar" style="width:36px;height:36px;background:#e8f4f1;color:#085a4e;font-size:12px">${l.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span><div class="grow"><b>${l.name}</b><small>${l.notes || l.requirement || "Follow up"}</small></div><span class="muted" style="font-size:12px">${new Date(l.followUpTs).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" })}</span><a href="${telHref(l.mobile)}" aria-label="Call"><i data-lucide="phone" class="green-t"></i></a></li>`)}</ul>` : html`<div class="empty-sm">No follow-ups scheduled for today.</div>`}</section>
        <section class="card p"><div class="ch"><i data-lucide="users-round"></i><h3>Top Performing Agents <small class="muted" style="font-weight:400">(${RANGES[state.range]})</small></h3></div>
          ${agents.length ? html`<ul class="list">${agents.map(([n, b, a], i) => html`<li><span class="medal" style="background:${medal[i]}">${i + 1}</span>${avatar(n, 36)}<div class="grow"><b>${n}</b></div><span class="muted" style="font-size:12px">${b} Booking${b > 1 ? "s" : ""}</span><span class="pill-g">${fmtMoney(a)}</span></li>`)}</ul>` : html`<div class="empty-sm">No bookings in this period.</div>`}</section>
      </div>
      <div class="grid g-3">
        <section class="card p"><div class="ch"><i data-lucide="wallet"></i><h3>Bookings &amp; Commission</h3></div>
          <div class="bc"><div><div class="box">Total Bookings<b>${cur.B.length}</b></div><div class="box">Commission Due<b>${fmtMoney(cur.due)}</b></div><div class="box">Commission Received<b>${fmtMoney(cur.recv)}</b></div></div>
          <div><div style="font-size:12px;font-weight:600">Monthly Commission Received (₹ L)</div><div class="chart-box" style="height:170px"><canvas id="comm"></canvas></div></div></div></section>
        <section class="card p"><div class="ch"><i data-lucide="building-2"></i><h3>Developer-wise Bookings</h3></div>
          ${devs.length ? html`<table class="mini-t"><thead><tr><th>Developer</th><th>Bookings</th><th>Commission</th></tr></thead><tbody>${devs.map(([n, b, c]) => html`<tr><td><b style="font-weight:500">${n}</b></td><td>${b}</td><td><b>${fmtMoney(c)}</b></td></tr>`)}</tbody></table>` : html`<div class="empty-sm">No bookings in this period.</div>`}</section>
        <section class="card p"><div class="ch"><i data-lucide="user-plus"></i><h3>Recent Leads</h3>${more()}</div>
          ${recent.length ? html`<ul class="list">${recent.map((l) => html`<li>${avatar(l.name, 34)}<div class="grow"><a href="customer.html?id=${encodeURIComponent(l.id)}"><b>${l.name}</b></a><small>${l.requirement || l.project || l.source}</small></div><div style="text-align:right">${badge(l.status)}<div class="muted" style="font-size:11px;margin-top:2px">${relTime(l.createdAt)}</div></div></li>`)}</ul>` : html`<div class="empty-sm">No leads yet.</div>`}</section>
      </div>`);

    document.getElementById("range").onchange = (e) => { state.range = e.target.value; draw(); };
    const grid = { color: "#eef1f3" }, ticks = { font: { size: 11 } };
    charts.push(new Chart(document.getElementById("trend"), { type: "line", data: { labels: tb.labels, datasets: [
      { label: "New Leads", data: tb.leads, borderColor: "#0f7a6b", backgroundColor: "rgba(15,122,107,.15)", fill: true, tension: .35, pointBackgroundColor: "#fff", pointBorderWidth: 2, pointRadius: tb.labels.length > 40 ? 0 : 3 },
      { label: "Bookings", data: tb.conv, borderColor: "#e8a91f", backgroundColor: "rgba(232,169,31,.12)", fill: true, tension: .35, pointBackgroundColor: "#fff", pointBorderWidth: 2, pointRadius: tb.labels.length > 40 ? 0 : 3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { ...ticks, maxTicksLimit: 8 } }, y: { grid, ticks: { ...ticks, precision: 0 }, beginAtZero: true } } } }));
    if (srcs.length) charts.push(new Chart(document.getElementById("src"), { type: "doughnut", data: { labels: srcs.map((s) => s[0]), datasets: [{ data: srcs.map((s) => s[1]), backgroundColor: COLORS, borderWidth: 0 }] },
      options: { maintainAspectRatio: false, cutout: "68%", plugins: { legend: { display: false } } } }));
    charts.push(new Chart(document.getElementById("comm"), { type: "bar", data: { labels: monthsBack.map((m) => m.toLocaleString("en-US", { month: "short" })), datasets: [{ data: comm, borderRadius: 4, backgroundColor: comm.map((_, i) => (i === comm.length - 1 ? "#e8a91f" : "#0f7a6b")) }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks }, y: { grid, ticks, beginAtZero: true } } } }));
  }
  draw();
})();
