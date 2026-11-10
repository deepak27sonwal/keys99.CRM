(async function () {
  const page = await mountShell("visits");
  if (!page) return;
  const MIN = 60000, OPEN = ["Scheduled", "Confirmed"], EARLY = ["New Leads", "Contacted", "Interested", "Visit Scheduled"];
  const OUTCOMES = [["Interested", "Interested", "Move to Negotiations"], ["Not Interested", "Not Interested", "Mark as Spam"], ["Need More Time", "Need More Time", "Follow-up Later"], ["No Response", "No Response", "Re-attempt"]];
  const state = { view: "calendar", mode: "month", day: startOfDay(new Date()), selId: null, range: "month", q: "", status: "" };
  let leads = [], visits = [], bookings = [], byId = new Map(), booked = new Set(), V = [];

  // ---------- data ----------
  async function load() {
    try { [leads, visits, bookings] = await Promise.all([Data.getLeads(), Data.getSiteVisits(), Data.getBookings()]); }
    catch (e) { page.innerHTML = '<div class="card empty">Could not load site visits: ' + esc(e.message) + "</div>"; return false; }
    byId = new Map(leads.map((l) => [l.dbId, l])); booked = new Set(bookings.map((b) => b.enquiry_id));
    V = visits.map(vm).sort((a, b) => a.start - b.start);
    return true;
  }
  function vm(v) {
    const l = byId.get(v.enquiry_id) || {}, start = new Date(v.visit_at);
    const end = v.end_at ? new Date(v.end_at) : new Date(+start + 90 * MIN);
    const siteEnd = v.site_end_at ? new Date(v.site_end_at) : new Date(Math.min(+start + 60 * MIN, +end));
    return { raw: v, id: v.id, lead: l, name: l.name || "Unknown", mobile: l.mobile || "", project: v.project || l.project || "—", place: l.location || l.developer || "",
      start, end, siteEnd, pickup: v.pickup_at ? new Date(v.pickup_at) : null, status: v.status, agent: l.agent || "Unassigned", converted: booked.has(v.enquiry_id), outcome: v.outcome || "", remarks: v.remarks || "" };
  }
  const now = () => new Date();
  const on = (d) => V.filter((v) => dayKey(v.start) === dayKey(d));
  const range = (v, r) => r === "all" || (r === "month" ? v.start.getMonth() === now().getMonth() && v.start.getFullYear() === now().getFullYear() : v.start >= new Date(+now() - 30 * 86400000) && v.start <= now());
  const sel = () => V.find((v) => v.id === state.selId) || null;
  const chooseDefault = () => { const d = on(state.day); if (!d.some((v) => v.id === state.selId)) state.selId = d.length ? d[0].id : null; };

  // ---------- small renderers ----------
  const stat = (label, value, icon, cls = "", primary = false) => html`<div class="kpi ${primary ? "primary" : ""} ${cls}"><i data-lucide="${icon}"></i><div><div class="lbl">${label}</div><div class="val">${value}</div></div></div>`;
  const range2 = (v) => `${fmtTime(v.start)} – ${fmtTime(v.end)}`;
  const place = (v) => [v.project, v.place].filter((x) => x && x !== "—").join(", ") || "—";
  const kebab = (id) => html`<button class="icon-btn kebab" data-menu="${id}" aria-label="More actions"><i data-lucide="more-vertical"></i></button>`;

  function visitCard(v) {
    return html`<div class="vcard vs-${v.status} ${state.selId === v.id ? "sel" : ""}" data-vid="${v.id}" tabindex="0" role="button" aria-label="${v.name}, ${range2(v)}">
      <div class="vc-main"><div class="vc-time">${range2(v)}</div><div class="vc-name">${avatar(v.name, 30)}<b>${v.name}</b></div>
        <div class="vc-line"><i data-lucide="phone"></i>${v.mobile || "—"}</div><div class="vc-line"><i data-lucide="building-2"></i>${place(v)}</div></div>
      <div class="vc-side"><span class="badge b-${v.status}">${v.status}</span>${kebab(v.id)}</div></div>`;
  }

  function calendar() {
    const d0 = state.day, y = d0.getFullYear(), m = d0.getMonth(), nowD = now();
    const toolbar = html`<div class="cal-bar"><div class="row"><button class="icon-btn sq" data-nav="-1" aria-label="Previous"><i data-lucide="chevron-left"></i></button>
      <h3>${state.mode === "month" ? MO_FULL[m] + " " + y : state.mode === "week" ? "Week of " + fmtLongDay(weekStart(d0)) : fmtLongDay(d0)}</h3>
      <button class="icon-btn sq" data-nav="1" aria-label="Next"><i data-lucide="chevron-right"></i></button></div>
      <div class="row"><button class="btn sm" data-nav="0">Today</button><div class="seg">${["day", "week", "month"].map((k) => html`<button data-mode="${k}" class="${state.mode === k ? "on" : ""}">${k[0].toUpperCase() + k.slice(1)}</button>`)}</div></div></div>`;
    if (state.mode === "month") {
      const first = new Date(y, m, 1), cells = Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - first.getDay() + i));
      const by = new Map(); V.filter((v) => v.status !== "Cancelled").forEach((v) => { const k = dayKey(v.start); by.set(k, (by.get(k) || 0) + 1); });
      return html`${toolbar}<div class="cal-grid" role="grid"><div class="cal-wd">${WD.map((w) => html`<span>${w}</span>`)}</div>
        <div class="cal-cells">${cells.map((d) => { const k = dayKey(d), n = by.get(k) || 0; return html`<button class="cal-cell ${d.getMonth() !== m ? "dim" : ""} ${k === dayKey(state.day) ? "sel" : ""} ${k === dayKey(nowD) ? "today" : ""}" data-day="${k}" aria-label="${fmtLongDay(d)}${n ? ", " + n + " visits" : ""}">
          <span class="cal-d">${d.getDate()}</span>${n ? html`<span class="cal-chip c${Math.min(n, 3)}"><b>${n}</b><i> Visit${n > 1 ? "s" : ""}</i></span>` : raw("")}</button>`; })}</div></div>`;
    }
    if (state.mode === "week") {
      const ws = weekStart(d0);
      return html`${toolbar}<div class="wk-grid">${Array.from({ length: 7 }, (_, i) => { const d = new Date(+ws + i * 86400000 + 3600000), list = on(d); return html`<div class="wk-col ${dayKey(d) === dayKey(d0) ? "sel" : ""}"><button class="wk-h" data-day="${dayKey(d)}"><span>${WD[d.getDay()]}</span><b>${d.getDate()}</b></button>
        ${list.map((v) => html`<button class="wk-pill vs-${v.status}" data-vid="${v.id}" title="${v.name} · ${range2(v)}"><b>${fmtTime(v.start)}</b> ${v.name}</button>`)}</div>`; })}</div>`;
    }
    const list = on(d0);
    return html`${toolbar}<div class="day-grid">${Array.from({ length: 13 }, (_, i) => i + 8).map((h) => { const hv = list.filter((v) => v.start.getHours() === h); return html`<div class="day-row"><span class="day-h">${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}</span><div class="day-c">${hv.map((v) => html`<button class="wk-pill vs-${v.status}" data-vid="${v.id}"><b>${range2(v)}</b> ${v.name} · ${place(v)}</button>`)}</div></div>`; })}
      ${list.some((v) => v.start.getHours() < 8 || v.start.getHours() > 20) ? html`<div class="day-row"><span class="day-h">Other</span><div class="day-c">${list.filter((v) => v.start.getHours() < 8 || v.start.getHours() > 20).map((v) => html`<button class="wk-pill vs-${v.status}" data-vid="${v.id}"><b>${range2(v)}</b> ${v.name}</button>`)}</div></div>` : raw("")}</div>`;
  }

  function listView() {
    const q = state.q.toLowerCase(), rows = [...V].reverse().filter((v) => (!state.status || v.status === state.status) && (!q || [v.name, v.mobile, v.project, v.place, v.agent].join(" ").toLowerCase().includes(q)));
    return html`<div class="cal-bar"><h3>All site visits (${rows.length})</h3><div class="row"><div class="search sm"><i data-lucide="search"></i><input id="listQ" placeholder="Search visits…" value="${state.q}"></div>
      <select class="select" id="listStatus"><option value="">Status: All</option>${VISIT_STATUSES.map((s) => html`<option ${s === state.status ? raw("selected") : raw("")}>${s}</option>`)}</select></div></div>
      <div class="table-wrap"><table class="mini-t sv-t"><thead><tr><th>Date &amp; time</th><th>Customer</th><th>Project</th><th>Agent</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.slice(0, 200).map((v) => html`<tr class="${state.selId === v.id ? "sel" : ""}" data-vid="${v.id}" tabindex="0"><td><b>${fmtLongDay(v.start)}</b><small>${range2(v)}</small></td><td>${v.name}<small>${v.mobile}</small></td><td>${place(v)}</td><td>${v.agent}</td>
        <td><span class="badge b-${v.status}">${v.status}</span></td><td>${kebab(v.id)}</td></tr>`) : html`<tr><td colspan="6" class="empty">No site visits found.</td></tr>`}</tbody></table></div>`;
  }

  function teamView() {
    const by = new Map(); V.forEach((v) => (by.get(v.agent) || by.set(v.agent, []).get(v.agent)).push(v));
    const rows = [...by].map(([a, L]) => ({ a, t: L.length, up: L.filter((v) => v.start > now() && OPEN.includes(v.status)).length, c: L.filter((v) => v.status === "Completed").length, x: L.filter((v) => v.status === "Cancelled").length, cv: L.filter((v) => v.converted).length })).sort((p, q) => q.t - p.t);
    return html`<div class="cal-bar"><h3>Team view</h3></div><div class="table-wrap"><table class="mini-t sv-t"><thead><tr><th>Agent</th><th>Total</th><th>Upcoming</th><th>Completed</th><th>Cancelled</th><th>Converted</th></tr></thead><tbody>
      ${rows.length ? rows.map((r) => html`<tr><td><div class="row">${avatar(r.a, 28)}<b>${r.a}</b></div></td><td>${r.t}</td><td>${r.up}</td><td>${r.c}</td><td>${r.x}</td><td>${r.cv}${r.t ? html` <small class="inl">(${((r.cv / r.t) * 100).toFixed(0)}%)</small>` : raw("")}</td></tr>`) : html`<tr><td colspan="6" class="empty">No site visits yet.</td></tr>`}</tbody></table></div>`;
  }

  function details() {
    const v = sel();
    if (!v) return html`<section class="card p sv-det"><div class="ch"><i data-lucide="map-pin"></i><h3>Site Visit Details</h3></div><div class="empty-sm">Select a visit to see its details.</div></section>`;
    const l = v.lead, plan = [["Pickup (Optional)", v.pickup ? fmtTime(v.pickup) : "—", "car"], ["Site Visit", `${fmtTime(v.start)} – ${fmtTime(v.siteEnd)}`, "map-pin"], ["Project Discussion", `${fmtTime(v.siteEnd)} – ${fmtTime(v.end)}`, "users"]];
    const locked = v.status === "Cancelled";
    return html`<section class="card p sv-det">
      <div class="ch"><i data-lucide="map-pin"></i><h3>Site Visit Details</h3><div class="row" style="margin-left:auto"><a class="btn sm" href="site-visit.html?id=${v.id}"><i data-lucide="expand"></i>Full page</a><button class="btn sm" id="editVisit"><i data-lucide="pencil"></i>Edit</button>${kebab(v.id)}</div></div>
      <div class="det-top"><div class="thumb big">${buildingSvg()}</div><div><h4>${v.project}</h4><div class="vc-line"><i data-lucide="map-pin"></i>${v.place || "—"}</div><div class="vc-line"><i data-lucide="calendar"></i>${fmtLongDay(v.start)}</div><div class="vc-line"><i data-lucide="clock"></i>${range2(v)}</div><span class="badge b-${v.status}">${v.status}</span></div></div>
      <div class="sub-card"><div class="ch"><i data-lucide="user"></i><h3>Customer Information</h3></div><div class="cust">${avatar(v.name, 52)}<div class="cust-i"><a href="customer.html?id=${encodeURIComponent(l.id || "")}"><b>${v.name}</b></a>
        <div class="vc-line"><i data-lucide="phone"></i><a href="${telHref(v.mobile)}">${v.mobile || "—"}</a>${v.mobile ? html`<a href="${waHref(v.mobile)}" target="_blank" rel="noopener" aria-label="WhatsApp"><i data-lucide="message-circle" class="wa-t"></i></a>` : raw("")}</div>
        ${l.email ? html`<div class="vc-line"><i data-lucide="mail"></i>${l.email}</div>` : raw("")}</div><div class="cust-s"><span class="idchip"><small>Lead ID</small>${l.id || "—"}</span>${l.status ? badge(l.status) : raw("")}</div></div></div>
      <div class="sub-card"><div class="ch"><i data-lucide="route"></i><h3>Visit Plan</h3></div><ul class="plan">${plan.map(([k, t, ic]) => html`<li><i data-lucide="${ic}"></i><span>${k}</span><b>${t}</b></li>`)}</ul></div>
      <div class="sub-card"><div class="ch"><i data-lucide="bar-chart-3"></i><h3>Outcome (After Visit)</h3></div>
        <div class="outs" role="radiogroup">${OUTCOMES.map(([val, a, b]) => html`<label class="out ${v.outcome === val ? "on" : ""}"><input type="radio" name="outcome" value="${val}" ${v.outcome === val ? raw("checked") : raw("")} ${locked ? raw("disabled") : raw("")}><span><b>${a}</b> – ${b}</span></label>`)}</div>
        <label class="rem">Remarks<textarea id="remarks" rows="3" placeholder="Add visit remarks, customer feedback and next steps…" ${locked ? raw("disabled") : raw("")}>${v.remarks}</textarea></label>
        <button class="btn gold" id="saveOutcome" style="margin-top:10px" ${locked ? raw("disabled") : raw("")}><i data-lucide="check"></i>Save outcome${v.status !== "Completed" ? raw(" &amp; complete visit") : raw("")}</button></div></section>`;
  }

  function insights() {
    const L = V.filter((v) => range(v, state.range)), t = L.length, c = L.filter((v) => v.status === "Completed").length, x = L.filter((v) => v.status === "Cancelled").length;
    const prog = L.filter((v) => OPEN.includes(v.status) && v.start <= now() && now() <= v.end).length, cv = L.filter((v) => v.converted).length;
    const tile = (n, l, ic, cls) => html`<div class="tile ${cls || ""}"><i data-lucide="${ic}"></i><b>${n}</b><span>${l}</span></div>`;
    return html`<section class="card p sv-ins"><div class="ch"><i data-lucide="bar-chart-3"></i><h3>Site Visit Insights</h3><select class="select" id="insRange" style="margin-left:auto"><option value="month" ${state.range === "month" ? raw("selected") : raw("")}>This Month</option><option value="30d" ${state.range === "30d" ? raw("selected") : raw("")}>Last 30 days</option><option value="all" ${state.range === "all" ? raw("selected") : raw("")}>All time</option></select></div>
      <div class="tiles">${tile(t, "Total Visits", "calendar-check")}${tile(c, "Completed", "circle-check", "g")}${tile(prog, "In Progress", "car")}${tile(x, "Cancelled", "circle-x", "r")}${tile(`${cv}`, `Converted${t ? " (" + ((cv / t) * 100).toFixed(1) + "%)" : ""}`, "filter", "o")}</div></section>`;
  }

  function upcomingCard() {
    const up = V.filter((v) => v.start > now() && OPEN.includes(v.status)).slice(0, 4);
    return html`<section class="card p sv-up"><div class="ch"><i data-lucide="calendar-clock"></i><h3>Upcoming Site Visits</h3><button class="more" id="viewAll" style="background:none;border:0;cursor:pointer">View All<i data-lucide="arrow-right"></i></button></div>
      ${up.length ? html`<ul class="up-list">${up.map((v) => html`<li class="vs-${v.status}" data-vid="${v.id}" tabindex="0"><i data-lucide="clock"></i><div class="grow"><b>${fmtLongDay(v.start)} · ${fmtTime(v.start)}</b><small>${v.name} | ${place(v)}</small></div><span class="badge b-${v.status}">${v.status}</span></li>`)}</ul>` : html`<div class="empty-sm">No upcoming site visits.</div>`}</section>`;
  }

  // ---------- page ----------
  function draw() {
    chooseDefault();
    const t = V.length, today = V.filter((v) => dayKey(v.start) === dayKey(now())).length, up = V.filter((v) => v.start > now() && OPEN.includes(v.status)).length,
      c = V.filter((v) => v.status === "Completed").length, x = V.filter((v) => v.status === "Cancelled").length, cv = V.filter((v) => v.converted).length;
    const dl = on(state.day);
    const keep = document.activeElement && document.activeElement.id === "listQ" ? document.activeElement.selectionStart : null;
    render(page, html`
      <div class="page-head"><div><h1>Site Visit Management</h1><p class="sub">Plan, track and manage customer site visits, with team, project and conversion tracking.</p></div>
        <div class="btns"><button class="btn" id="exportCsv"><i data-lucide="download"></i>Export</button><button class="btn" id="syncCal"><i data-lucide="calendar-sync"></i>Sync Calendar</button><button class="btn gold" id="schedule"><i data-lucide="plus"></i>Schedule Site Visit</button></div></div>
      <div class="kpis k6">${stat("Total Site Visits", t, "calendar-check", "", true)}${stat("Today", today, "calendar-days")}${stat("Upcoming", up, "hourglass")}${stat("Completed", c, "circle-check", "ic-green")}${stat("Cancelled", x, "circle-x", "ic-red")}${stat(`Converted to Booking${t ? " (" + ((cv / t) * 100).toFixed(1) + "%)" : ""}`, cv, "handshake")}</div>
      <div class="sv-grid">
        <section class="card p sv-cal"><div class="seg wide">${[["calendar", "calendar-days", "Calendar View"], ["list", "list", "List View"], ["team", "users", "Team View"]].map(([k, ic, l]) => html`<button data-view="${k}" class="${state.view === k ? "on" : ""}"><i data-lucide="${ic}"></i>${l}</button>`)}</div>
          ${state.view === "calendar" ? calendar() : state.view === "list" ? listView() : teamView()}</section>
        <section class="card p sv-day"><div class="ch"><i data-lucide="map-pin"></i><h3>Site Visits – ${fmtLongDay(state.day)} (${dl.length})</h3></div>
          ${dl.length ? html`<div class="vlist">${dl.map(visitCard)}</div>` : html`<div class="empty-sm">No site visits on this day. <button class="auth-link" id="scheduleDay">Schedule one</button></div>`}</section>
        ${details()}${insights()}${upcomingCard()}</div>`);
    if (keep !== null) { const i = document.getElementById("listQ"); if (i) { i.focus(); i.setSelectionRange(keep, keep); } }
    bind();
  }

  // ---------- actions ----------
  const refresh = async () => { if (await load()) draw(); };
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { alert("Could not save: " + e.message); } };
  const setStatus = guard(async (v, status) => {
    await Data.updateSiteVisit(v.id, await Data.visitStatusPatch(v.raw, status));
    if (status === "Completed" && EARLY.includes(v.lead.status)) await Data.updateLead(v.lead.dbId, { status: "Visit Done" });
    toast("Visit " + status.toLowerCase()); await refresh();
  });
  const saveOutcome = guard(async (v, outcome, remarks) => applyVisitOutcome(v.raw, byId.get(v.lead.dbId) || v.lead, outcome, remarks, refresh));

  function menu(btn, v) {
    document.querySelectorAll(".menu-pop").forEach((m) => m.remove());
    const items = [];
    if (v.status === "Scheduled") items.push(["Confirm visit", "circle-check", () => setStatus(v, "Confirmed")]);
    if (OPEN.includes(v.status)) { items.push(["Mark completed", "check", () => setStatus(v, "Completed")], ["Reschedule", "calendar-clock", () => openEditVisit(v, refresh, true)], ["Cancel visit", "circle-x", () => confirm("Cancel this site visit?") && setStatus(v, "Cancelled")]); }
    items.push(["Open visit details", "file-text", () => (location.href = "site-visit.html?id=" + v.id)], ["Open customer", "user", () => (location.href = "customer.html?id=" + encodeURIComponent(v.lead.id || ""))]);
    const pop = document.createElement("div"); pop.className = "menu-pop"; pop.setAttribute("role", "menu");
    pop.innerHTML = items.map(([l, ic], i) => `<button role="menuitem" data-i="${i}"><i data-lucide="${ic}"></i>${esc(l)}</button>`).join("");
    document.body.appendChild(pop); lucide.createIcons();
    const r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(r.right - pw, innerWidth - pw - 8)) + "px"; pop.style.top = (r.bottom + ph + 8 > innerHeight ? r.top - ph - 4 : r.bottom + 4) + "px";
    const r0 = btn.getBoundingClientRect();
    const close = () => { pop.remove(); document.removeEventListener("mousedown", away, true); window.removeEventListener("scroll", onScroll, true); document.removeEventListener("keydown", esc2); };
    // close only if the page really moved the button (a stray scroll event right after opening must not close the menu)
    const onScroll = () => { if (!btn.isConnected) return close(); const r = btn.getBoundingClientRect(); if (Math.abs(r.top - r0.top) > 2 || Math.abs(r.left - r0.left) > 2) close(); };
    const away = (e) => { if (!pop.contains(e.target)) close(); }, esc2 = (e) => { if (e.key === "Escape") close(); };
    pop.onclick = (e) => { const b = e.target.closest("button"); if (b) { close(); items[Number(b.dataset.i)][2](); } };
    document.addEventListener("mousedown", away, true); window.addEventListener("scroll", onScroll, true); document.addEventListener("keydown", esc2);
    pop.querySelector("button").focus();
  }

  function ics() {
    const e = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const z = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ev = V.filter((v) => v.status !== "Cancelled").map((v) => ["BEGIN:VEVENT", `UID:site-visit-${v.id}@keys99.crm`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(v.start)}`, `DTEND:${z(v.end)}`,
      `SUMMARY:${e("Site visit: " + v.name + " – " + v.project)}`, `LOCATION:${e(place(v))}`, `DESCRIPTION:${e("Customer: " + v.name + " " + v.mobile + "\\nStatus: " + v.status)}`, `STATUS:${v.status === "Confirmed" || v.status === "Completed" ? "CONFIRMED" : "TENTATIVE"}`, "END:VEVENT"].join("\r\n"));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Keys99 CRM//Site Visits//EN\r\nCALSCALE:GREGORIAN\r\n" + ev.join("\r\n") + "\r\nEND:VCALENDAR\r\n"], { type: "text/calendar" }));
    a.download = "keys99-site-visits.ics"; document.body.appendChild(a); a.click(); a.remove(); toast(ev.length + " visits exported to calendar file");
  }

  function bind() {
    const $ = (s) => page.querySelector(s), $$ = (s) => page.querySelectorAll(s);
    $$("[data-view]").forEach((b) => (b.onclick = () => { state.view = b.dataset.view; draw(); }));
    $$("[data-mode]").forEach((b) => (b.onclick = () => { state.mode = b.dataset.mode; draw(); }));
    $$("[data-nav]").forEach((b) => (b.onclick = () => {
      const n = Number(b.dataset.nav), d = new Date(state.day);
      if (n === 0) state.day = startOfDay(new Date()); else if (state.mode === "month") state.day = new Date(d.getFullYear(), d.getMonth() + n, 1); else state.day = new Date(+startOfDay(d) + (state.mode === "week" ? 7 : 1) * n * 86400000 + 3600000 * 0);
      state.day = startOfDay(state.day); draw();
    }));
    $$("[data-day]").forEach((b) => (b.onclick = () => { const [y, m, d] = b.dataset.day.split("-").map(Number); state.day = new Date(y, m - 1, d); state.selId = null; draw(); }));
    $$("[data-vid]").forEach((el) => { const go = (e) => { if (e.target.closest("[data-menu]")) return; const v = V.find((x) => x.id === Number(el.dataset.vid)); if (!v) return; state.selId = v.id; state.day = startOfDay(v.start); draw(); }; el.onclick = go; el.onkeydown = (e) => { if (e.key === "Enter") go(e); }; });
    $$("[data-menu]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); menu(b, V.find((x) => x.id === Number(b.dataset.menu))); }));
    const lq = $("#listQ"); if (lq) lq.oninput = () => { state.q = lq.value; draw(); };
    const ls = $("#listStatus"); if (ls) ls.onchange = () => { state.status = ls.value; draw(); };
    $("#insRange").onchange = (e) => { state.range = e.target.value; draw(); };
    $("#viewAll").onclick = () => { state.view = "list"; state.status = ""; draw(); };
    $("#schedule").onclick = () => openScheduleVisit(leads, { date: dayKey(state.day) }, refresh);
    const sd = $("#scheduleDay"); if (sd) sd.onclick = () => openScheduleVisit(leads, { date: dayKey(state.day) }, refresh);
    $("#syncCal").onclick = ics;
    $("#exportCsv").onclick = () => downloadCsv("keys99-site-visits.csv", ["Date", "Start", "End", "Customer", "Mobile", "Project", "Location", "Agent", "Status", "Outcome", "Converted to booking", "Remarks"],
      V.map((v) => [dayKey(v.start), fmtTime(v.start), fmtTime(v.end), v.name, v.mobile, v.project, v.place, v.agent, v.status, v.outcome, v.converted ? "Yes" : "No", v.remarks]));
    const ev = $("#editVisit"); if (ev) ev.onclick = () => openEditVisit(sel(), refresh);
    const so = $("#saveOutcome"); if (so) so.onclick = () => { const c = page.querySelector("input[name=outcome]:checked"); saveOutcome(sel(), c ? c.value : "", $("#remarks").value); };
  }

  const MO_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekStart = (d) => startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
  document.getElementById("globalSearch").onkeydown = (e) => { if (e.key === "Enter" && e.target.value.trim()) { state.view = "list"; state.q = e.target.value.trim(); draw(); } };
  if (!(await load())) return;
  draw();
})();
