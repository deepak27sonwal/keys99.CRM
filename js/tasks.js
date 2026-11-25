// Tasks & Follow-ups: lead follow-ups, manual tasks and site visits in one list, with KPIs, filters, a details panel, a month calendar,
// today's follow-ups, a status donut and quick actions. Employees only ever receive their own leads, tasks and visits from the database.
(async function () {
  const page = await mountShell("tasks");
  if (!page) return;
  const me = window.ME, admin = me.role === "admin" || !!me.isManager, meName = me.member ? me.member.name : "", PER = 8;
  const TYPES = ["Call", "WhatsApp", "Meeting", "Site Visit", "Document", "Other"], PRIOS = ["High", "Medium", "Low"], STATUSES = ["Pending", "Completed", "Overdue", "Scheduled"];
  const TYPE_ICON = { "Follow-up": "phone-call", Call: "phone", WhatsApp: "message-circle", Meeting: "users", "Site Visit": "map-pin", Document: "file-text", Other: "list-checks" };
  const TABS = [["all", "All Tasks"], ["Follow-up", "Follow-ups"], ["Call", "Calls"], ["Meeting", "Meetings"], ["Site Visit", "Site Visits"], ["Document", "Documents"], ["other", "Others"]];
  // quick picks in the Create task form: the usual task messages per type, so nobody types them again (a pick also sets the priority)
  const QUICK = {
    Call: [["Call to introduce the project", "Medium"], ["Call to confirm the site visit", "High"], ["Follow-up call after site visit", "High"], ["Call to discuss price and offers", "High"], ["Call to collect pending documents", "Medium"], ["Payment reminder call", "High"], ["No answer, call again", "Medium"]],
    WhatsApp: [["Send project brochure", "Medium"], ["Send location and directions", "Medium"], ["Share payment plan", "Medium"], ["Send price sheet", "Medium"], ["Send floor plans", "Medium"], ["Site visit reminder message", "High"]],
    Meeting: [["Price negotiation meeting", "High"], ["Client meeting at the office", "Medium"], ["Discuss booking with the family", "High"], ["Meeting with the developer", "Medium"]],
    "Site Visit": [["Schedule a site visit", "High"], ["Confirm site visit pickup", "High"], ["Take feedback after the site visit", "Medium"]],
    Document: [["Collect KYC documents", "Medium"], ["Share the booking form", "High"], ["Collect token cheque", "High"], ["Send the agreement draft", "Medium"]],
    Other: [["Update the lead status in CRM", "Low"], ["Check unit availability", "Medium"], ["Share lead feedback with the manager", "Low"], ["Send a thank-you message", "Low"]],
  };
  const DUE_PICKS = [["In 1 hour", () => { const d = new Date(Date.now() + 3600000); d.setSeconds(0, 0); return d; }], ["Today 6 PM", () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d > new Date() ? d : null; }], ["Tomorrow 11 AM", () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(11, 0, 0, 0); return d; }],
    ["In 2 days", () => { const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(11, 0, 0, 0); return d; }], ["Next Monday", () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(11, 0, 0, 0); return d; }]];
  const TEMPLATES = [["Send project brochure", "WhatsApp", "Medium"], ["Collect KYC documents", "Document", "Medium"], ["Follow up on booking confirmation", "Call", "High"], ["Schedule a site visit", "Site Visit", "High"], ["Price negotiation meeting", "Meeting", "High"], ["Share payment plan", "WhatsApp", "Medium"]];
  const state = { warn: "", tab: "all", who: admin ? "" : "me", status: "", prio: "", type: "", due: "", q: "", day: null, month: startOfDay(new Date()), pg: 1, sel: null, leads: [], tasks: [], visits: [], team: [], err: "" };
  const k = (s) => String(s || "").trim().toLowerCase(), slug2 = (s) => String(s).toLowerCase().replace(/[^a-z]+/g, "");
  const prioOf = (l) => (/^A/.test(l.priority) ? "High" : /^C/.test(l.priority) ? "Low" : "Medium");

  async function load() {
    try {
      let warn = "";     // a failed site-visit load must not look like "no visits scheduled"
      const [leads, tasks, visits, team] = await Promise.all([Data.getLeads(), Data.getTasks(), Data.getSiteVisits().catch((e) => { warn = "Site visits could not be loaded (" + (e.message || e) + "), so they are missing from this list."; return []; }), me.role === "admin" ? Data.getTeamCached() : me.isManager ? Promise.resolve(me.team) : Promise.resolve(me.member ? [me.member] : [])]);
      const sl = Scope.leads(leads); Object.assign(state, { leads: sl, tasks: Scope.tasks(tasks), visits: Scope.rows(visits, sl), team, err: "", warn });
    } catch (e) { state.err = e.message || String(e); }
  }

  // ---- one list out of three sources ----
  function items() {
    const byId = new Map(state.team.map((m) => [m.id, m])), leadById = new Map(state.leads.map((l) => [l.dbId, l])), out = [], now = new Date(), today = startOfDay(now);
    const status = (i) => i.done ? "Completed" : i.kind === "v" && i.due >= now ? "Scheduled" : i.due && i.due < today ? "Overdue" : "Pending";
    state.leads.forEach((l) => {
      if (l.followUpTs && !CLOSED.includes(l.status)) out.push({ kind: "f", key: "f" + l.dbId, title: "Follow-up: " + l.name, sub: [l.project, l.requirement].filter(Boolean).join(" · "), type: "Follow-up", prio: prioOf(l), due: new Date(l.followUpTs), lead: l, owner: l.agent || "Unassigned" });
      l.acts.filter((a) => a && a.title === "Follow-up done" && a.at).forEach((a, n) => out.push({ kind: "f", key: "fd" + l.dbId + "-" + n, title: "Follow-up: " + l.name, sub: a.description || "", type: "Follow-up", prio: prioOf(l), due: new Date(a.at), done: true, lead: l, owner: l.agent || "Unassigned" }));
    });
    state.tasks.forEach((t) => { const m = byId.get(t.assigned_to), l = t.enquiry_id ? leadById.get(t.enquiry_id) : null;
      out.push({ kind: "t", key: "t" + t.id, title: t.title, sub: t.notes || "", type: t.type || "Other", prio: t.priority || "Medium", due: t.due_at ? new Date(t.due_at) : null, done: !!t.done_at, task: t, lead: l, owner: m ? m.name : "Unassigned" }); });
    state.visits.forEach((v) => { const l = leadById.get(v.enquiry_id); if (!l || !v.visit_at || /cancel|no.?show/i.test(v.status)) return;
      out.push({ kind: "v", key: "v" + v.id, title: "Site Visit: " + (v.project || l.project || "Visit"), sub: v.meeting_point || l.location || "", type: "Site Visit", prio: prioOf(l), due: new Date(v.visit_at), done: v.status === "Completed", visit: v, lead: l, owner: l.agent || "Unassigned" }); });
    out.forEach((i) => (i.status = status(i)));
    return out;
  }
  const scoped = (all) => all.filter((i) => !state.who ? true : state.who === "me" ? k(i.owner) === k(meName) : k(i.owner) === k(state.who));
  const inTab = (i) => state.tab === "all" || (state.tab === "other" ? ["WhatsApp", "Other"].includes(i.type) : i.type === state.tab);
  function dueMatch(i) {
    if (state.day) return i.due && dayKey(i.due) === state.day;
    if (!state.due) return true; if (state.due === "overdue") return i.status === "Overdue"; if (!i.due) return false;
    const now = new Date(), d = startOfDay(i.due), t0 = startOfDay(now);
    if (state.due === "today") return sameDay(i.due, now);
    if (state.due === "yesterday") { const y = new Date(t0); y.setDate(y.getDate() - 1); return sameDay(i.due, y); }
    if (state.due === "week") { const e = new Date(t0); e.setDate(e.getDate() + 7); return d >= t0 && d < e; }
    return i.due.getMonth() === now.getMonth() && i.due.getFullYear() === now.getFullYear();
  }
  function visible(all) {
    const q = k(state.q);
    return scoped(all).filter((i) => inTab(i) && (!state.status || i.status === state.status) && (!state.prio || i.prio === state.prio) && (!state.type || i.type === state.type) && dueMatch(i)
      && (!q || [i.title, i.sub, i.lead && i.lead.name, i.lead && i.lead.id, i.lead && i.lead.mobile, i.owner].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => (!!a.done - !!b.done) || ((a.due ? a.due.getTime() : 9e15) - (b.due ? b.due.getTime() : 9e15)));
  }
  const dueText = (i) => { if (!i.due) return "No date"; const n = new Date(), tm = new Date(startOfDay(n)); tm.setDate(tm.getDate() + 1); return (sameDay(i.due, n) ? "Today" : sameDay(i.due, tm) ? "Tomorrow" : fmtDay(i.due).slice(0, 6)) + ", " + fmtTime(i.due); };
  const chip = (cls, t) => html`<span class="tk-chip ${cls}">${t}</span>`;

  function draw() {
    if (state.err) { page.innerHTML = '<div class="card empty">Could not load tasks: ' + esc(state.err) + "</div>"; return; }
    const all = items(), sc = scoped(all), list = visible(all), pages = Math.max(1, Math.ceil(list.length / PER)); if (state.pg > pages) state.pg = pages;
    const shown = list.slice((state.pg - 1) * PER, state.pg * PER), sel = all.find((i) => i.key === state.sel) || shown[0] || null; state.sel = sel ? sel.key : null;
    const n = (st) => sc.filter((i) => i.status === st).length, total = sc.length, done = n("Completed"), todayF = sc.filter((i) => i.type === "Follow-up" && !i.done && i.due && sameDay(i.due, new Date())).length;
    const cnt = (t) => sc.filter((i) => (t === "all" ? true : t === "other" ? ["WhatsApp", "Other"].includes(i.type) : i.type === t)).length;
    const people = [...new Set([...state.team.map((m) => m.name), ...state.leads.map((l) => l.agent).filter(Boolean)])].sort();
    const kp = [["Total Tasks", total, "calendar-check", 1], ["Completed", done, "circle-check", 0, 1], ["Pending", n("Pending") + n("Scheduled"), "clock"], ["Overdue", n("Overdue"), "alert-triangle"], ["Follow-ups Today", todayF, "calendar-days"], ["My Tasks", sc.filter((i) => meName && k(i.owner) === k(meName)).length, "users"], ["Task Completion", (total ? Math.round(done * 1000 / total) / 10 : 0) + "%", "bar-chart-3"]];
    const todays = sc.filter((i) => i.due && sameDay(i.due, new Date())).sort((a, b) => a.due - b.due).slice(0, 8);
    render(page, html`
      <div class="page-head"><div><h1>Tasks &amp; Follow-ups</h1><p class="sub">Manage your daily tasks, follow-ups, reminders and site visits so you never miss a lead or opportunity.</p></div>
        <div class="btns">${meName ? html`<button type="button" class="btn ${state.who === "me" ? "on" : ""}" id="tkMine"><i data-lucide="user"></i>My Tasks</button>` : raw("")}${admin ? html`<button type="button" class="btn ${state.who === "" ? "on" : ""}" id="tkTeam"><i data-lucide="users"></i>Team Tasks</button>` : raw("")}
          <button type="button" class="btn ${state.status === "Overdue" ? "on" : ""}" id="tkOver"><i data-lucide="alert-triangle"></i>Overdue</button><button type="button" class="btn" id="tkCal"><i data-lucide="calendar"></i>Calendar</button>
          <button type="button" class="btn gold" id="tkAdd"><i data-lucide="plus"></i>Create Task</button></div></div>
      ${state.warn ? html`<div class="tk-warn" role="alert"><i data-lucide="alert-triangle"></i><span>${state.warn}</span><button type="button" class="btn sm" id="tkRetry">Try again</button></div>` : raw("")}
      <div class="kpis k7 tk-kpis">${kp.map(([l, v, ic, p, g]) => kpiCard([l, v, "", ic, p, g]))}</div>
      <div class="tk-grid"><section class="card tk-left">
        <div class="tabs-pill tk-tabs" role="tablist">${TABS.map(([key, l]) => html`<button type="button" role="tab" class="pill ${key === state.tab ? "active" : ""}" aria-selected="${key === state.tab}" data-tab="${key}">${l} (${cnt(key)})</button>`)}</div>
        <div class="tk-filters">
          ${admin ? html`<label>Assigned To<select class="select" id="fWho" aria-label="Assigned to"><option value="">Everyone</option>${meName ? html`<option value="me" ${state.who === "me" ? raw("selected") : raw("")}>Me</option>` : raw("")}${people.map((p) => html`<option ${p === state.who ? raw("selected") : raw("")}>${p}</option>`)}</select></label>` : raw("")}
          <label>Status<select class="select" id="fStatus" aria-label="Status"><option value="">All</option>${STATUSES.map((s) => html`<option ${s === state.status ? raw("selected") : raw("")}>${s}</option>`)}</select></label>
          <label>Priority<select class="select" id="fPrio" aria-label="Priority"><option value="">All</option>${PRIOS.map((s) => html`<option ${s === state.prio ? raw("selected") : raw("")}>${s}</option>`)}</select></label>
          <label>Type<select class="select" id="fType" aria-label="Type"><option value="">All</option>${["Follow-up", ...TYPES].map((s) => html`<option ${s === state.type ? raw("selected") : raw("")}>${s}</option>`)}</select></label>
          <label>Due Date<select class="select" id="fDue" aria-label="Due date"><option value="">Any</option>${[["today", "Today"], ["yesterday", "Yesterday"], ["week", "Next 7 days"], ["month", "This month"], ["overdue", "Overdue"]].map(([v, l]) => html`<option value="${v}" ${v === state.due ? raw("selected") : raw("")}>${l}</option>`)}</select></label>
          <input class="select tk-q" id="fQ" type="search" placeholder="Search task, customer, lead ID…" value="${state.q}" aria-label="Search tasks">
          ${state.day ? html`<button type="button" class="pill active" id="tkDayX" aria-label="Clear the selected day">${fmtLongDay(new Date(state.day + "T00:00:00"))} ✕</button>` : raw("")}</div>
        ${shown.length ? html`<div class="table-wrap"><table class="tk-t"><thead><tr><th>Task / Follow-up</th><th>Customer / Lead</th><th>Assigned to</th><th>Type</th><th>Priority</th><th>Due Date &amp; Time</th><th>Status</th><th></th></tr></thead><tbody>
          ${shown.map((i) => html`<tr class="tk-row ${i.key === state.sel ? "sel" : ""}" data-key="${i.key}" tabindex="0"><td data-label="Task"><span class="tk-ti"><i data-lucide="${TYPE_ICON[i.type]}"></i><b>${i.title}</b></span></td>
            <td data-label="Customer">${i.lead ? html`<b>${i.lead.name}</b><small>${i.lead.id}</small>` : raw("—")}</td><td data-label="Assigned to" class="tk-as">${i.owner && i.owner !== "Unassigned" ? html`${avatar(i.owner, 22)}<span>${i.owner}</span>` : html`<span class="muted">Unassigned</span>`}</td><td data-label="Type">${chip("ty-" + slug2(i.type), i.type)}</td><td data-label="Priority">${chip("pr-" + i.prio, i.prio)}</td>
            <td data-label="Due" class="${i.status === "Overdue" ? "late" : ""}">${dueText(i)}</td><td data-label="Status">${chip("st-" + i.status, i.status)}</td><td data-label="Actions"><button type="button" class="icon-btn" data-menu="${i.key}" aria-label="Actions for ${i.title}"><i data-lucide="more-horizontal"></i></button></td></tr>`)}</tbody></table></div>
          <div class="tk-pager"><span>Showing ${(state.pg - 1) * PER + 1} – ${(state.pg - 1) * PER + shown.length} of ${list.length} task${list.length === 1 ? "" : "s"}</span><div class="tk-pg"><button type="button" data-pg="${state.pg - 1}" ${state.pg <= 1 ? raw("disabled") : raw("")} aria-label="Previous page"><i data-lucide="chevron-left"></i></button>
            ${Array.from({ length: pages }, (_, x) => x + 1).filter((x) => x === 1 || x === pages || Math.abs(x - state.pg) <= 1).map((x, idx, arr) => html`${idx && x - arr[idx - 1] > 1 ? raw("<span>…</span>") : raw("")}<button type="button" class="${x === state.pg ? "on" : ""}" data-pg="${x}">${x}</button>`)}
            <button type="button" data-pg="${state.pg + 1}" ${state.pg >= pages ? raw("disabled") : raw("")} aria-label="Next page"><i data-lucide="chevron-right"></i></button></div></div>`
          : html`<div class="empty-sm">${state.q || state.status || state.prio || state.type || state.due || state.day ? "No tasks match these filters." : "Nothing here yet. Create a task or schedule a follow-up."}</div>`}
      </section>${isPhone() ? raw("") : details(sel)}</div>
      <div class="tk-bot">${calendar(sc)}
        <section class="card p"><div class="ch"><i data-lucide="clock"></i><h3>Today's Follow-ups (${todays.length})</h3></div>${todays.length ? html`<ul class="tk-today">${todays.map((i) => html`<li class="${i.done ? "done" : ""}"><span class="tt">${fmtTime(i.due)}</span><i data-lucide="${TYPE_ICON[i.type]}"></i><div><b>${i.title}</b><small>${[i.lead ? i.lead.name : i.sub, i.owner && i.owner !== "Unassigned" ? "Assigned to " + i.owner : "Unassigned"].filter(Boolean).join(" · ")}</small></div>${i.done ? raw("") : html`<input type="checkbox" data-tick="${i.key}" aria-label="Mark ${i.title} done">`}</li>`)}</ul>` : html`<div class="empty-sm">Nothing scheduled for today.</div>`}</section>
        <section class="card p"><div class="ch"><i data-lucide="bar-chart-3"></i><h3>Task by Status</h3></div>${donut(sc)}</section>
        <section class="card p"><div class="ch"><i data-lucide="zap"></i><h3>Quick Actions</h3></div><div class="tk-qa">
          <button type="button" class="btn" data-qa="new"><i data-lucide="plus"></i>Create New Task</button><button type="button" class="btn" data-qa="reminder"><i data-lucide="bell"></i>Add Follow-up Reminder</button>
          <button type="button" class="btn" data-qa="visit"><i data-lucide="calendar-check"></i>Schedule Site Visit</button>${admin ? html`<button type="button" class="btn" data-qa="assign"><i data-lucide="users"></i>Assign to Team Member</button>` : raw("")}
          <button type="button" class="btn" data-qa="template"><i data-lucide="file-text"></i>Use Task Template</button></div></section></div>`);
    wire(all, sel);
  }

  // ---- details panel ----
  function details(i) {
    if (!i) return html`<aside class="card tk-det"><div class="empty-sm">Select a task to see its details.</div></aside>`;
    const l = i.lead, v = i.visit;
    return html`<aside class="card tk-det" aria-label="Task details"><div class="tk-dh"><b>Task Details</b></div><div class="tk-db">
      <div class="tk-dt"><i data-lucide="${TYPE_ICON[i.type]}"></i><h3>${i.title}</h3>${chip("st-" + i.status, i.status)}</div>
      <div class="tk-dg"><dl class="kv2">${[["Customer", l ? l.name : "—"], ["Lead ID", l ? l.id : "—"], ["Project", (l && l.project) || (v && v.project) || "—"], ["Date & Time", i.due ? dueText(i) : "—"], ["Location", (l && l.location) || i.sub || "—"], ["Assigned To", i.owner], ["Priority", raw(chip("pr-" + i.prio, i.prio).__raw)]].map(([a, b]) => html`<dt>${a}</dt><dd>${b}</dd>`)}</dl>
        ${i.type === "Site Visit" ? html`<div class="tk-thumb">${buildingSvg()}</div>` : raw("")}</div>
      <div class="tk-notes"><b>Notes</b><p>${(i.task && i.task.notes) || (i.kind === "f" && i.sub) || (l && l.notes) || "No notes yet."}</p></div>
      ${l ? html`<div class="tk-contact"><a class="btn sm" href="${telHref(l.mobile)}" data-lead="${l.dbId}"><i data-lucide="phone"></i>Call</a><a class="btn sm" href="${waHref(l.mobile)}" data-lead="${l.dbId}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>WhatsApp</a><a class="btn sm" href="leads.html?q=${encodeURIComponent(l.id)}"><i data-lucide="external-link"></i>Open lead</a></div>` : raw("")}
      <div class="tk-dact"><button type="button" class="btn brand" id="dDone" ${i.done ? raw("disabled") : raw("")}><i data-lucide="check"></i>Mark Complete</button><button type="button" class="btn" id="dEdit" ${i.kind === "t" ? raw("") : raw("disabled")}><i data-lucide="pencil"></i>Edit</button>
        <button type="button" class="btn" id="dResched" ${i.done ? raw("disabled") : raw("")}><i data-lucide="calendar-clock"></i>Reschedule</button><button type="button" class="btn" id="dNote" ${i.kind === "t" || l ? raw("") : raw("disabled")}><i data-lucide="sticky-note"></i>Add Note</button></div></div></aside>`;
  }

  // ---- calendar + donut ----
  function calendar(sc) {
    const m = state.month, y = m.getFullYear(), mo = m.getMonth(), first = new Date(y, mo, 1), days = new Date(y, mo + 1, 0).getDate(), lead = first.getDay(), marks = new Set(sc.filter((i) => i.due && i.due.getFullYear() === y && i.due.getMonth() === mo).map((i) => i.due.getDate()));
    const cells = [...Array(lead).fill(0), ...Array.from({ length: days }, (_, x) => x + 1)], tk = dayKey(new Date());
    return html`<section class="card p tk-cal"><div class="ch"><i data-lucide="calendar"></i><h3>Task Calendar</h3><div class="tk-cm"><button type="button" class="icon-btn" id="calPrev" aria-label="Previous month"><i data-lucide="chevron-left"></i></button><b>${MO[mo]} ${y}</b><button type="button" class="icon-btn" id="calNext" aria-label="Next month"><i data-lucide="chevron-right"></i></button></div></div>
      <div class="tk-cg">${WD.map((d) => html`<span class="wd">${d}</span>`)}${cells.map((d) => { if (!d) return raw("<span></span>"); const key = dayKey(new Date(y, mo, d)); return html`<button type="button" class="d ${key === tk ? "today" : ""} ${key === state.day ? "pick" : ""}" data-day="${key}" aria-label="${fmtLongDay(new Date(y, mo, d))}${marks.has(d) ? ", has tasks" : ""}">${d}${marks.has(d) ? raw('<i class="dot"></i>') : raw("")}</button>`; })}</div></section>`;
  }
  function donut(sc) {
    const cols = { Completed: "#16a34a", Pending: "#f5a623", Overdue: "#dc2626", Scheduled: "#8b5cf6" }, tot = sc.length, R = 52, C = 2 * Math.PI * R; let off = 0;
    const rows = STATUSES.map((s) => [s, sc.filter((i) => i.status === s).length]);
    const arcs = tot ? rows.filter(([, c]) => c).map(([s, c]) => { const len = C * c / tot, el = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${cols[s]}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += len; return el; }).join("") : `<circle r="${R}" cx="70" cy="70" fill="none" stroke="#e5e7eb" stroke-width="18"/>`;
    return html`<div class="tk-do"><svg viewBox="0 0 140 140" role="img" aria-label="Tasks by status">${raw(arcs)}<text x="70" y="68" text-anchor="middle" class="n">${tot}</text><text x="70" y="86" text-anchor="middle" class="l">Tasks</text></svg>
      <ul>${rows.map(([s, c]) => html`<li><i style="background:${cols[s]}"></i>${s} – ${c}${tot ? " (" + Math.round(c * 1000 / tot) / 10 + "%)" : ""}</li>`)}</ul></div>`;
  }

  // ---- wiring ----
  const refresh = async () => { await load(); draw(); };
  Data.onRemote(refresh);
  const find = (all, key) => all.find((i) => i.key === key);
  // On a phone the details panel would sit far below the list, so a tapped card opens them in a bottom sheet instead.
  const isPhone = () => matchMedia("(max-width:900px)").matches;
  function openSheet(i, opener) {
    if (!i) return;
    document.querySelectorAll(".tk-ov").forEach((o) => o.remove());
    const ov = document.createElement("div"); ov.className = "overlay open tk-ov";
    ov.innerHTML = `<div class="modal tk-sheet" role="dialog" aria-modal="true" aria-label="${esc(i.title)}"><div class="tk-sh"><span class="tk-grab" aria-hidden="true"></span><button type="button" class="icon-btn" id="tkShX" aria-label="Close details"><i data-lucide="x"></i></button></div>${details(i).__raw}</div>`;
    document.body.appendChild(ov); if (window.lucide) lucide.createIcons();
    const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); if (opener && opener.isConnected) opener.focus({ preventScroll: true }); }, onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey); ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    const act = (id, fn) => { const b = ov.querySelector(id); if (b) b.onclick = () => { close(); fn(); }; };
    ov.querySelector("#tkShX").onclick = close; act("#dDone", () => complete(i)); act("#dEdit", () => i.task && openTask(i.task)); act("#dResched", () => resched(i)); act("#dNote", () => note(i));
    ov.querySelector("#tkShX").focus({ preventScroll: true });
  }
  { const mq = matchMedia("(max-width:900px)"); const sw = () => { document.querySelectorAll(".tk-ov").forEach((o) => o.remove()); draw(); }; mq.addEventListener ? mq.addEventListener("change", sw) : mq.addListener(sw); }
  function wire(all, sel) {
    const $ = (s) => page.querySelector(s), on = (s, fn) => { const e = $(s); if (e) e.onclick = fn; };
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; state.pg = 1; draw(); }));
    const sf = (id, key) => { const e = $(id); if (e) e.onchange = () => { state[key] = e.value; state.pg = 1; if (key === "due") state.day = null; draw(); }; };
    sf("#fWho", "who"); sf("#fStatus", "status"); sf("#fPrio", "prio"); sf("#fType", "type"); sf("#fDue", "due");
    const q = $("#fQ"); q.oninput = () => { state.q = q.value; state.pg = 1; const pos = q.selectionStart; draw(); const nq = $("#fQ"); nq.focus(); nq.setSelectionRange(pos, pos); };
    on("#tkMine", () => { state.who = "me"; state.pg = 1; draw(); }); on("#tkTeam", () => { state.who = ""; state.pg = 1; draw(); });
    on("#tkOver", () => { state.status = state.status === "Overdue" ? "" : "Overdue"; state.pg = 1; draw(); }); on("#tkCal", () => $(".tk-cal").scrollIntoView({ behavior: "smooth", block: "center" }));
    on("#tkRetry", () => refresh()); on("#tkAdd", () => openTask(null)); on("#tkDayX", () => { state.day = null; draw(); });
    page.querySelectorAll("[data-pg]").forEach((b) => (b.onclick = () => { state.pg = Number(b.dataset.pg); draw(); }));
    page.querySelectorAll("tr.tk-row").forEach((r) => { const pick = (e) => { if (e && e.target.closest("button,a,input")) return; state.sel = r.dataset.key; if (isPhone()) return openSheet(find(all, r.dataset.key), r); draw(); }; r.onclick = pick; r.onkeydown = (e) => { if (e.key === "Enter" && e.target === r) pick(); }; });
    page.querySelectorAll("[data-menu]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const i = find(all, b.dataset.menu); if (!i) return; popMenu(b, [["View details", "eye", () => { state.sel = i.key; if (isPhone()) openSheet(i, b); else draw(); }], ...(i.done ? [] : [["Mark complete", "check", () => complete(i)], ["Reschedule", "calendar-clock", () => resched(i)]]), ...(i.kind === "t" ? [["Edit", "pencil", () => openTask(i.task)]] : []), ...(i.kind === "t" && (admin || i.task.created_by === me.uid) ? [["Delete", "trash-2", () => del(i), true]] : [])]); }));
    page.querySelectorAll("[data-tick]").forEach((c) => (c.onchange = () => { const i = find(all, c.dataset.tick); c.checked = false; if (i) complete(i); }));
    page.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { state.day = state.day === b.dataset.day ? null : b.dataset.day; state.due = ""; state.pg = 1; draw(); }));
    on("#calPrev", () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); draw(); }); on("#calNext", () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); draw(); });
    on("#dDone", () => sel && complete(sel)); on("#dEdit", () => sel && sel.task && openTask(sel.task)); on("#dResched", () => sel && resched(sel)); on("#dNote", () => sel && note(sel));
    page.querySelectorAll("[data-qa]").forEach((b) => (b.onclick = () => ({ new: () => openTask(null), assign: () => openTask(null), reminder: openReminder, visit: openVisit, template: openTemplates })[b.dataset.qa]()));
  }

  function complete(i) {
    if (i.kind === "t") return Data.updateTask(i.task.id, { done_at: new Date().toISOString() }).then(() => { toast("Task completed"); return refresh(); }).catch((e) => toast("Could not save: " + e.message));
    if (i.kind === "v") { location.href = "site-visit.html?id=" + i.visit.id; return; }
    openModal("Follow-up done · " + i.lead.name, html`<div class="form"><label class="full">What happened? (optional)<textarea name="note" rows="3" placeholder="e.g. Spoke to the client, site visit fixed for Saturday"></textarea></label></div>`,
      async (f) => { await Data.addActivity(i.lead, "Follow-up done", f.note || "Follow-up completed"); await Data.updateLead(i.lead.dbId, { followUp: null }); toast("Follow-up marked done"); await refresh(); }, "Mark done");
  }
  function resched(i) {
    if (i.kind === "f") return openFollowUp(i.lead, refresh);
    if (i.kind === "v") { location.href = "site-visit.html?id=" + i.visit.id; return; }
    openModal("Reschedule task", html`<div class="form">${field("Date & time *", "due", toLocalInput(i.task.due_at), "datetime-local", "required", "full")}</div>`, async (f) => { await Data.updateTask(i.task.id, { due_at: fromLocalInput(f.due) }); toast("Task rescheduled"); await refresh(); });
  }
  function note(i) {
    if (i.kind === "t") return openModal("Add note · " + i.title, html`<div class="form"><label class="full">Note *<textarea name="note" rows="3" required></textarea></label></div>`, async (f) => { const old = i.task.notes ? i.task.notes + "\n" : ""; await Data.updateTask(i.task.id, { notes: old + f.note }); toast("Note added"); await refresh(); });
    openNote(i.lead, refresh);
  }
  async function del(i) { if (!confirm("Delete this task?")) return; try { await Data.deleteTask(i.task.id); toast("Task deleted"); await refresh(); } catch (e) { toast("Could not delete: " + e.message); } }

  // ---- forms ----
  function leadOptions(sel) { return html`<option value="">— None —</option>${state.leads.map((l) => html`<option value="${l.dbId}" ${String(l.dbId) === String(sel) ? raw("selected") : raw("")}>${l.name} · ${l.mobile}</option>`)}`; }
  function openTask(t, preset = {}) {
    const team = state.team.filter((m) => (m.status || "Active") === "Active"), v = (key, d = "") => (t ? t[key] : preset[key]) ?? d;
    const who = admin ? html`<label>Assign to *<select name="assigned_to" required><option value="">— Choose —</option>${team.map((m) => html`<option value="${m.id}" ${m.id === v("assigned_to") ? raw("selected") : raw("")}>${m.name}</option>`)}</select></label>` : html`<input type="hidden" name="assigned_to" value="${me.memberId}">`;
    openModal(t ? "Edit task" : "Create task", html`<div class="form">${field("Task *", "title", v("title"), "text", 'required maxlength="140" placeholder="e.g. Send brochure to Mr. Shah"', "full")}${t ? raw("") : html`<div class="full tk-sug" id="tkSug" aria-label="Quick picks"></div>`}
      ${selectField("Type", "type", TYPES, v("type", "Call"))}${selectField("Priority", "priority", PRIOS, v("priority", "Medium"))}
      ${field("Due date & time", "due", toLocalInput(v("due_at")), "datetime-local")}${who}${t ? raw("") : html`<div class="full tk-sug tk-due" id="tkDueSug" aria-label="Quick due times"></div>`}
      <label class="full">Related lead (optional)<select name="enquiry_id">${leadOptions(v("enquiry_id"))}</select></label><label class="full">Notes (optional)<textarea name="notes" rows="2">${v("notes")}</textarea></label></div>`,
      async (f) => {
        const assigned = Number(f.assigned_to); if (!assigned) throw new Error("Choose who the task is for");
        const row = { title: f.title, type: f.type, priority: f.priority, notes: f.notes, due_at: fromLocalInput(f.due), assigned_to: assigned, enquiry_id: f.enquiry_id ? Number(f.enquiry_id) : null };
        if (t) await Data.updateTask(t.id, { ...row, notes: row.notes || null }); else await Data.addTask(row);
        toast(t ? "Task updated" : "Task created"); await refresh();
      }, t ? "Save" : "Create task");
  wireHolidayNote(document.querySelector(".overlay.open .modal"), "due");
    if (!t) wireQuick(document.querySelector(".overlay.open form"));
  }
  // the quick pick chips: fill the title (and priority / due) with one tap; the list follows the chosen type and starts with the person's own recent titles
  function wireQuick(form) {
    if (!form) return; const box = form.querySelector("#tkSug"), dueBox = form.querySelector("#tkDueSug"); if (!box) return;
    const title = form.querySelector('[name="title"]'), type = form.querySelector('[name="type"]'), prio = form.querySelector('[name="priority"]'), due = form.querySelector('[name="due"]');
    const fire = (el) => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const setSel = (el, val) => { if (!el) return; el.value = val; if (el._dd && el._dd.refresh) el._dd.refresh(); fire(el); };
    const known = new Set(Object.values(QUICK).flat().map((x) => x[0].toLowerCase()));
    const recent = [...new Set(state.tasks.filter((x) => x.created_by === me.uid).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).map((x) => String(x.title || "").trim()).filter((x) => x && x.length <= 80 && !known.has(x.toLowerCase())))].slice(0, 3);
    const chip = (label, attrs) => `<button type="button" class="pill tk-sg" ${attrs}>${esc(label)}</button>`;
    const drawTitles = () => { const list = QUICK[type.value] || QUICK.Other; box.innerHTML = `<span class="tk-sl">Quick picks</span>${recent.map((r, n) => chip(r, `data-r="${n}" title="Your recent task"`)).join("")}${list.map(([m], n) => chip(m, `data-q="${n}"`)).join("")}`; };
    drawTitles();
    // pressing a chip must not blur the (still empty) title, or its "required" message would shift the chips under the finger before the tap lands
    form.querySelectorAll("#tkSug, #tkDueSug").forEach((c) => c.addEventListener("mousedown", (e) => { if (e.target.closest(".tk-sg")) e.preventDefault(); }));
    box.addEventListener("click", (e) => {
      const b = e.target.closest(".tk-sg"); if (!b) return; const list = QUICK[type.value] || QUICK.Other;
      if (b.dataset.r !== undefined) title.value = recent[Number(b.dataset.r)]; else { const [m, pr] = list[Number(b.dataset.q)]; title.value = m; setSel(prio, pr); }
      fire(title); title.focus(); title.setSelectionRange(title.value.length, title.value.length);
    });
    type.addEventListener("change", drawTitles);
    if (dueBox) { dueBox.innerHTML = `<span class="tk-sl">Due</span>${DUE_PICKS.map(([l, f], n) => (f() ? chip(l, `data-d="${n}"`) : "")).join("")}`;
      dueBox.addEventListener("click", (e) => { const b = e.target.closest(".tk-sg"); if (!b) return; const d = DUE_PICKS[Number(b.dataset.d)][1](); if (d) { due.value = toLocalInput(d.toISOString()); fire(due); } }); }
  }
  function pickLead(title, cta, next) {
    openModal(title, html`<div class="form"><label class="full">Lead *<select name="lead" required>${leadOptions("")}</select></label>${cta.date ? field("Date & time *", "when", toLocalInput(new Date(Date.now() + 86400000).toISOString()), "datetime-local", "required", "full") : raw("")}${cta.note ? html`<label class="full">Note (optional)<textarea name="note" rows="2"></textarea></label>` : raw("")}</div>`,
      async (f) => { const lead = state.leads.find((l) => String(l.dbId) === f.lead); if (!lead) throw new Error("Choose a lead"); await next(lead, f); }, cta.label);
  }
  const openReminder = () => pickLead("Add follow-up reminder", { date: 1, note: 1, label: "Add reminder" }, async (lead, f) => { await Data.scheduleFollowUp(lead, fromLocalInput(f.when), (f.note || "").trim()); toast("Follow-up scheduled"); await refresh(); });
  const openVisit = () => pickLead("Schedule site visit", { label: "Continue" }, async (lead) => { setTimeout(() => openSiteVisit(lead, refresh), 50); });
  function openTemplates() {
    const ov = document.createElement("div"); ov.className = "overlay open";
    ov.innerHTML = `<div class="modal wa-modal" role="dialog" aria-modal="true" aria-label="Task templates"><h2>Use a task template</h2><div class="wa-list">${TEMPLATES.map((t, n) => `<button type="button" class="wa-o" data-n="${n}"><b>${esc(t[0])}</b><small>${esc(t[1])} · ${esc(t[2])} priority</small></button>`).join("")}</div><div class="actions"><button type="button" class="btn" data-x>Cancel</button></div></div>`;
    document.body.appendChild(ov); const close = () => ov.remove(); ov.querySelector("[data-x]").onclick = close; ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    ov.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => { const t = TEMPLATES[Number(b.dataset.n)]; close(); const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(11, 0, 0, 0); openTask(null, { title: t[0], type: t[1], priority: t[2], due_at: d.toISOString() }); }));
  }

  await load(); draw();
})();
