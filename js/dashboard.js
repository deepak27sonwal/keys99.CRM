(async function () {
  const page = await mountShell("dashboard");
  if (!page) return;
  const D = DEMO; // Dashboard analytics use sample data until reporting queries are added.
  const funnelColors = ["#0b6b5d", "#0f7a6b", "#e8a91f", "#f3c04c", "#e8a91f"];
  const medal = ["#f3c04c", "#cbd5e1", "#fb923c"];
  const max = D.pipeline[0][1];
  render(page, html`
    <div class="page-head"><div><h1>Good Evening, Deepak! 👋</h1><p class="sub">Here's your Keys99 business overview for Nov 2026.</p></div>
      <button class="btn"><i data-lucide="calendar"></i>Nov 01, 2026 – Nov 30, 2026<i data-lucide="chevron-down"></i></button></div>
    <div class="kpis k7">${D.dashKpis.map(kpiCard)}</div>
    <div class="grid g-top">
      <section class="card p"><div class="ch"><h3>Lead Trend</h3><div class="legend"><span><i style="background:#0f7a6b"></i>New Leads</span><span><i style="background:#e8a91f"></i>Conversions</span></div></div><div class="chart-box"><canvas id="trend"></canvas></div></section>
      <section class="card p"><div class="ch"><h3>Lead Source</h3></div><div class="donut-wrap"><div class="donut"><canvas id="src"></canvas><div class="mid"><b>3,248</b><span>Total Leads</span></div></div>
        <ul class="dl-list">${D.sources.map(([n, v, c]) => html`<li><i style="background:${c}"></i><span>${n}</span><em>${v}%</em></li>`)}</ul></div></section>
      <section class="card p funnel"><div class="ch"><h3>Sales Pipeline</h3><a class="more" href="#">View All<i data-lucide="arrow-right"></i></a></div>
        ${D.pipeline.map(([s, n], i) => html`<div class="f"><div class="track"><div class="bar" style="width:${Math.max(55, (n / max) * 100 - i * 4)}%;background:${funnelColors[i]}">${s}</div></div><b>${n}</b></div>`)}</section>
    </div>
    <div class="grid g-3">
      <section class="card p"><div class="ch"><i data-lucide="calendar-check"></i><h3>Upcoming Site Visits</h3><a class="more" href="#">View All<i data-lucide="arrow-right"></i></a></div>
        <ul class="list">${D.visits.map(([m, d, t, p, c, s]) => html`<li><div class="datebox">${m}<b>${d}</b></div><span class="muted" style="width:64px;font-size:12px">${t}</span><div class="grow"><b style="font-weight:500">${p}</b><small>${c}</small></div><i data-lucide="phone" class="green-t"></i><span class="badge b-${s}">${s}</span></li>`)}</ul></section>
      <section class="card p"><div class="ch"><i data-lucide="circle-check"></i><h3>Today's Follow-ups (8)</h3><a class="more" href="#">View All<i data-lucide="arrow-right"></i></a></div>
        <ul class="list">${D.followUps.map(([i, n, note, t]) => html`<li><span class="avatar" style="width:36px;height:36px;background:#e8f4f1;color:#085a4e;font-size:12px">${i}</span><div class="grow"><b>${n}</b><small>${note}</small></div><span class="muted" style="font-size:12px">${t}</span><i data-lucide="phone" class="green-t"></i></li>`)}</ul></section>
      <section class="card p"><div class="ch"><i data-lucide="users-round"></i><h3>Top Performing Agents <small class="muted" style="font-weight:400">(This Month)</small></h3><a class="more" href="#">View All<i data-lucide="arrow-right"></i></a></div>
        <ul class="list">${D.agents.map(([n, b, a], i) => html`<li><span class="medal" style="background:${medal[i]}">${i + 1}</span>${avatar(n, 36)}<div class="grow"><b>${n}</b></div><span class="muted" style="font-size:12px">${b} Bookings</span><span class="pill-g">${a}</span></li>`)}</ul></section>
    </div>
    <div class="grid g-3">
      <section class="card p"><div class="ch"><i data-lucide="wallet"></i><h3>Bookings &amp; Commission</h3></div>
        <div class="bc"><div><div class="box">Total Bookings<b>136 <small class="green-t">↑ +28%</small></b></div><div class="box">Commission Due<b>₹ 24.8 L</b></div><div class="box">Commission Received<b>₹ 18.6 L <small class="green-t">+32%</small></b></div></div>
        <div><div style="font-size:12px;font-weight:600">Monthly Commission (Received)</div><div class="chart-box" style="height:170px"><canvas id="comm"></canvas></div></div></div></section>
      <section class="card p"><div class="ch"><i data-lucide="building-2"></i><h3>Developer-wise Bookings</h3><a class="more" href="#">View All<i data-lucide="arrow-right"></i></a></div>
        <table class="mini-t"><thead><tr><th>Developer</th><th>Bookings</th><th>Commission (₹)</th></tr></thead><tbody>${D.developers.map(([n, b, c]) => html`<tr><td><b style="font-weight:500">${n}</b></td><td>${b}</td><td><b>${c}</b></td></tr>`)}</tbody></table></section>
      <section class="card p"><div class="ch"><i data-lucide="user-plus"></i><h3>Recent Leads</h3><a class="more" href="leads.html">View All<i data-lucide="arrow-right"></i></a></div>
        <ul class="list">${D.recent.map(([n, r, s, a]) => html`<li>${avatar(n, 34)}<div class="grow"><b>${n}</b><small>${r}</small></div><div style="text-align:right">${badge(s)}<div class="muted" style="font-size:11px;margin-top:2px">${a}</div></div></li>`)}</ul></section>
    </div>`);

  const grid = { color: "#eef1f3" }, ticks = { font: { size: 11 } };
  new Chart(document.getElementById("trend"), { type: "line", data: { labels: D.trend.labels, datasets: [
    { label: "New Leads", data: D.trend.leads, borderColor: "#0f7a6b", backgroundColor: "rgba(15,122,107,.15)", fill: true, tension: .4, pointBackgroundColor: "#fff", pointBorderWidth: 2, pointRadius: 4 },
    { label: "Conversions", data: D.trend.conv, borderColor: "#e8a91f", backgroundColor: "rgba(232,169,31,.12)", fill: true, tension: .4, pointBackgroundColor: "#fff", pointBorderWidth: 2, pointRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks }, y: { grid, ticks, beginAtZero: true } } } });
  new Chart(document.getElementById("src"), { type: "doughnut", data: { labels: D.sources.map((s) => s[0]), datasets: [{ data: D.sources.map((s) => s[1]), backgroundColor: D.sources.map((s) => s[2]), borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: "68%", plugins: { legend: { display: false } } } });
  new Chart(document.getElementById("comm"), { type: "bar", data: { labels: D.commission.labels, datasets: [{ data: D.commission.values, borderRadius: 4, backgroundColor: D.commission.values.map((_, i, a) => (i === a.length - 1 ? "#e8a91f" : "#0f7a6b")) }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks }, y: { grid, ticks: { ...ticks, callback: (v) => v + "L" } } } } });
})();
