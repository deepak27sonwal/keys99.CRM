// Calendar: meetings (created by admins, seen by the people invited), holidays (managed by admins, seen by everyone) and, as layers you can switch on or off,
// site visits, lead follow-ups and tasks. Month, week, day and agenda views, conflict warnings, calendar export (.ics) and "add to Google Calendar".
(async function () {
  const page = await mountShell("calendar");
  if (!page) return;
  const me = window.ME, admin = me.role === "admin", phone = () => innerWidth <= 700, HOUR = 48, H0 = 7, H1 = 22;
  const KINDS = ["Internal", "Client", "Site", "Online"], REMIND = [["", "No reminder"], ["0", "At the start"], ["5", "5 minutes before"], ["15", "15 minutes before"], ["30", "30 minutes before"], ["60", "1 hour before"], ["1440", "1 day before"]];
  const LAYERS = [["meeting", "Meetings", "users"], ["holiday", "Holidays", "party-popper"], ["visit", "Site visits", "map-pin"], ["followup", "Follow-ups", "phone-call"], ["task", "Tasks", "list-checks"]];
  const SUGGEST_NAMES = ["Diwali", "Holi", "Eid", "Ganesh Chaturthi", "Dussehra", "Raksha Bandhan", "Good Friday", "Guru Nanak Jayanti", "Makar Sankranti", "Gudi Padwa", "Mahavir Jayanti", "Buddha Purnima", "Muharram", "Janmashtami", "Founder's Day", "Office closed"];
  const state = { view: phone() ? "agenda" : "month", cur: startOfDay(new Date()), sel: dayKey(new Date()), layers: { meeting: 1, holiday: 1, visit: 1, followup: 1, task: 1 }, who: "", holidays: [], meetings: [], visits: [], leads: [], tasks: [], team: [], err: "" };
  const k = (s) => String(s || "").trim().toLowerCase(), pad = (n) => String(n).padStart(2, "0"), addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1), weekStart = (d) => addDays(startOfDay(d), -d.getDay());
  const hm = (d) => pad(d.getHours()) + ":" + pad(d.getMinutes()), keyToDate = (key) => new Date(key + "T00:00:00");

  async function load() {
    try {
      const [holidays, meetings, visits, leads, tasks, team] = await Promise.all([Data.getHolidays(), Data.getMeetings(), Data.getSiteVisits().catch(() => []), Data.getLeads().catch(() => []), Data.getTasks().catch(() => []), admin ? Data.getTeamCached() : Promise.resolve(me.member ? [me.member] : [])]);
      Object.assign(state, { holidays, meetings, visits, leads, tasks, team, err: "" }); Data._hol = holidays;
    } catch (e) { state.err = e.message || String(e); }
  }

  // ---- every kind of event as one list ----
  function events(from, to) {
    const byId = new Map(state.leads.map((l) => [l.dbId, l])), mem = new Map(state.team.map((m) => [m.id, m.name])), out = [], who = k(state.who);
    if (state.layers.meeting) state.meetings.forEach((m) => { if (who && !m.attendee_names.some((n) => k(n) === who)) return;
      expandMeeting(m, from, to).forEach((o) => out.push({ kind: "meeting", key: "m" + m.id + "@" + o.start.getTime(), title: m.title, start: o.start, end: o.end, meeting: m, cancelled: m.status === "Cancelled", done: m.status === "Completed" })); });
    if (state.layers.visit) state.visits.forEach((v) => { const l = byId.get(v.enquiry_id); if (!l || !v.visit_at || /cancel|no.?show/i.test(v.status) || (who && k(l.agent) !== who)) return; const s = new Date(v.visit_at), e = v.end_at ? new Date(v.end_at) : new Date(s.getTime() + 3600000);
      if (e > from && s < to) out.push({ kind: "visit", key: "v" + v.id, title: "Site visit: " + (v.project || l.project || l.name), sub: l.name, start: s, end: e > s ? e : new Date(s.getTime() + 3600000), visit: v, lead: l, done: v.status === "Completed" }); });
    if (state.layers.followup) state.leads.forEach((l) => { if (!l.followUpTs || CLOSED.includes(l.status) || (who && k(l.agent) !== who)) return; const s = new Date(l.followUpTs);
      if (s >= from && s < to) out.push({ kind: "followup", key: "f" + l.dbId, title: "Follow-up: " + l.name, start: s, end: new Date(s.getTime() + 900000), lead: l }); });
    if (state.layers.task) state.tasks.forEach((t) => { if (t.done_at || !t.due_at || (who && k(mem.get(t.assigned_to)) !== who)) return; const s = new Date(t.due_at);
      if (s >= from && s < to) out.push({ kind: "task", key: "t" + t.id, title: t.title, start: s, end: new Date(s.getTime() + 900000), task: t }); });
    return out.sort((a, b) => a.start - b.start);
  }
  const holsOn = (day) => (state.layers.holiday ? state.holidays.filter((h) => h.starts_on <= day && day <= h.ends_on) : []);
  const dayEvents = (key) => events(keyToDate(key), addDays(keyToDate(key), 1)).filter((e) => dayKey(e.start) === key || (e.end > keyToDate(key) && e.start < addDays(keyToDate(key), 1) && e.kind !== "followup" && e.kind !== "task"));
  const isOff = (d) => d.getDay() === 0;
  const rangeOf = () => { const c = state.cur; if (state.view === "month") { const a = weekStart(monthStart(c)); return [a, addDays(a, 42)]; } if (state.view === "week") { const a = weekStart(c); return [a, addDays(a, 7)]; } if (state.view === "day") return [c, addDays(c, 1)]; return [c, addDays(c, 30)]; };
  const title = () => { const c = state.cur; if (state.view === "month") return MO[c.getMonth()] + " " + c.getFullYear(); if (state.view === "week") { const a = weekStart(c), b = addDays(a, 6); return a.getDate() + " " + MO[a.getMonth()] + " – " + b.getDate() + " " + MO[b.getMonth()] + " " + b.getFullYear(); } if (state.view === "day") return fmtLongDay(c); return "Next 30 days from " + c.getDate() + " " + MO[c.getMonth()]; };
  const step = (dir) => { const c = state.cur; state.cur = state.view === "month" ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * (state.view === "week" ? 7 : state.view === "day" ? 1 : 30)); if (state.view === "month") state.sel = dayKey(state.cur.getMonth() === new Date().getMonth() && state.cur.getFullYear() === new Date().getFullYear() ? new Date() : state.cur); else state.sel = dayKey(state.cur); };

  // ---- small renderers ----
  const evCls = (e) => "cal-ev ev-" + e.kind + (e.cancelled ? " cancelled" : "") + (e.done ? " done" : "");
  const pill = (e) => `<button type="button" class="${evCls(e)}" data-ev="${esc(e.key)}" title="${esc(e.title)} · ${fmtTime(e.start)}"><i></i><span>${e.kind === "meeting" || e.kind === "visit" ? fmtTime(e.start).replace(/ ?(AM|PM)/, (m) => m.trim().toLowerCase()) + " " : ""}${esc(e.title)}</span></button>`;
  const holTag = (h) => `<span class="cal-hol" title="${esc(h.name)} (${esc(h.kind)})">${esc(h.name)}</span>`;

  function monthGrid() {
    const [a] = rangeOf(), evs = events(...rangeOf()), tk = dayKey(new Date()), mo = state.cur.getMonth(), cells = [];
    for (let i = 0; i < 42; i++) { const d = addDays(a, i), key = dayKey(d), hs = holsOn(key), list = evs.filter((e) => dayKey(e.start) === key || (e.kind === "meeting" && e.start < addDays(d, 1) && e.end > d && dayKey(e.start) !== key)), more = list.length - 3;
      cells.push(`<div class="cal-d ${d.getMonth() !== mo ? "out" : ""} ${isOff(d) ? "off" : ""} ${hs.length ? "hol" : ""} ${key === tk ? "today" : ""} ${key === state.sel ? "pick" : ""}" role="gridcell" data-day="${key}" tabindex="0" aria-label="${esc(fmtLongDay(d))}${hs.length ? ", holiday " + esc(hs[0].name) : ""}, ${list.length} event${list.length === 1 ? "" : "s"}">
        <div class="cal-dn"><b>${d.getDate()}</b>${admin ? `<button type="button" class="cal-add" data-addday="${key}" aria-label="Add a meeting on ${esc(fmtLongDay(d))}">+</button>` : ""}</div>${hs.slice(0, 1).map(holTag).join("")}
        <div class="cal-pills">${list.slice(0, 3).map(pill).join("")}${more > 0 ? `<button type="button" class="cal-more" data-day="${key}">+${more} more</button>` : ""}</div>
        <div class="cal-dots">${[...new Set(list.map((e) => e.kind))].map((kd) => `<i class="dot ev-${kd}"></i>`).join("")}</div></div>`); }
    return `<div class="cal-month" role="grid" aria-label="${esc(title())}"><div class="cal-wd">${WD.map((w) => `<span>${w}</span>`).join("")}</div><div class="cal-g">${cells.join("")}</div></div>`;
  }
  function timeGrid(days) {
    const evs = events(days[0], addDays(days[days.length - 1], 1)), tk = dayKey(new Date()), hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
    const cols = days.map((d) => { const key = dayKey(d), hs = holsOn(key), list = evs.filter((e) => dayKey(e.start) === key).map((e) => ({ ...e })); list.sort((x, y) => x.start - y.start);
      const lanes = []; list.forEach((e) => { let i = lanes.findIndex((end) => end <= e.start); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = e.end; e.lane = i; }); const n = Math.max(1, lanes.length);
      const blocks = list.map((e) => { const top = Math.max(0, ((e.start.getHours() + e.start.getMinutes() / 60) - H0) * HOUR), h = Math.max(22, ((e.end - e.start) / 3600000) * HOUR); return `<button type="button" class="${evCls(e)} blk" data-ev="${esc(e.key)}" style="top:${top}px;height:${h}px;left:${e.lane * 100 / n}%;width:${100 / n}%"><i></i><span><b>${fmtTime(e.start)}</b> ${esc(e.title)}</span></button>`; }).join("");
      return { key, d, hs, html: `<div class="cal-col ${isOff(d) ? "off" : ""} ${hs.length ? "hol" : ""} ${key === tk ? "today" : ""}" data-day="${key}" style="height:${(H1 - H0) * HOUR}px">${blocks}</div>` }; });
    return `<div class="cal-tg"><div class="cal-tgh" style="grid-template-columns:48px repeat(${days.length},1fr)"><span></span>${cols.map((c) => `<button type="button" class="cal-th ${c.key === dayKey(new Date()) ? "today" : ""}" data-day="${c.key}"><small>${WD[c.d.getDay()]}</small><b>${c.d.getDate()}</b>${c.hs.slice(0, 1).map(holTag).join("")}</button>`).join("")}</div>
      <div class="cal-tgb" style="grid-template-columns:48px repeat(${days.length},1fr)"><div class="cal-hrs">${hours.map((h) => `<span style="height:${HOUR}px">${h % 12 || 12} ${h < 12 ? "AM" : "PM"}</span>`).join("")}</div>${cols.map((c) => c.html).join("")}</div></div>`;
  }
  function agenda() {
    const [a, b] = rangeOf(), evs = events(a, b), out = [];
    for (let d = new Date(a); d < b; d = addDays(d, 1)) { const key = dayKey(d), hs = holsOn(key), list = evs.filter((e) => dayKey(e.start) === key); if (!hs.length && !list.length) continue;
      out.push(`<section class="cal-ag"><h4>${esc(fmtLongDay(d))}${dayKey(new Date()) === key ? " <em>Today</em>" : ""}</h4>${hs.map((h) => `<div class="cal-agh"><i data-lucide="party-popper"></i>${esc(h.name)} <small>${esc(h.kind)} holiday</small></div>`).join("")}${list.map((e) => `<button type="button" class="${evCls(e)} ag" data-ev="${esc(e.key)}"><i></i><span class="t">${fmtTime(e.start)}</span><span>${esc(e.title)}</span></button>`).join("")}</section>`); }
    return out.length ? `<div class="cal-agenda">${out.join("")}</div>` : `<div class="empty-sm">Nothing scheduled in this period.</div>`;
  }

  // ---- numbers that help planning ----
  function stats() {
    const now = new Date(), ms = monthStart(state.cur), me2 = new Date(ms.getFullYear(), ms.getMonth() + 1, 0), mEvs = state.meetings.flatMap((m) => expandMeeting(m, startOfDay(now), addDays(startOfDay(now), 8)).map((o) => ({ ...o, m }))).filter((o) => o.m.status !== "Cancelled");
    const today = mEvs.filter((o) => sameDay(o.start, now)).length, week = mEvs.filter((o) => o.start < addDays(startOfDay(now), 7)).length;
    let work = 0, hol = new Set(); for (let d = new Date(ms); d <= me2; d = addDays(d, 1)) { const h = holidayOn(state.holidays, d); if (h) hol.add(h.id); if (!isOff(d) && !h) work++; }
    const next = state.holidays.filter((h) => h.ends_on >= dayKey(now)).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0], days = next ? Math.max(0, Math.round((keyToDate(next.starts_on) - startOfDay(now)) / 86400000)) : null;
    return [["Meetings today", today, "users", 1], ["Meetings next 7 days", week, "calendar-clock"], ["Holidays in " + MO[ms.getMonth()], hol.size, "party-popper"], ["Working days in " + MO[ms.getMonth()], work, "briefcase", 0, 1], ["Next holiday", next ? (days === 0 ? "Today" : days === 1 ? "Tomorrow" : "in " + days + " d") : "—", "calendar-heart", 0, 0, next ? next.name : "none set"]];
  }

  function draw() {
    if (state.err) { page.innerHTML = '<div class="card empty">Could not load the calendar: ' + esc(state.err) + "</div>"; return; }
    const people = [...new Set(state.team.map((m) => m.name))].sort(), upcoming = state.meetings.flatMap((m) => expandMeeting(m, new Date(), addDays(new Date(), 60)).map((o) => ({ ...o, m }))).filter((o) => o.m.status === "Scheduled" && (!state.who || o.m.attendee_names.some((n) => k(n) === k(state.who)))).sort((a, b) => a.start - b.start).slice(0, 5);
    const yHol = state.holidays.filter((h) => h.ends_on >= dayKey(new Date())).slice(0, 8), main = state.view === "month" ? monthGrid() : state.view === "week" ? timeGrid(Array.from({ length: 7 }, (_, i) => addDays(weekStart(state.cur), i))) : state.view === "day" ? timeGrid([state.cur]) : agenda();
    const selDate = keyToDate(state.sel), sHols = holsOn(state.sel), sEvs = dayEvents(state.sel);
    page.innerHTML = `
      <div class="page-head"><div><h1>Calendar</h1><p class="sub">Meetings, holidays, site visits, follow-ups and tasks in one place.</p></div>
        <div class="btns">${admin ? `<button type="button" class="btn gold" id="cMeet"><i data-lucide="plus"></i>Add meeting</button><button type="button" class="btn" id="cHol"><i data-lucide="party-popper"></i>Add holiday</button>` : ""}<button type="button" class="btn" id="cIcs"><i data-lucide="download"></i>Export (.ics)</button></div></div>
      <div class="kpis k6 cal-kpis">${stats().map(([l, v, ic, p, g, sub]) => `<div class="kpi ${p ? "primary" : ""} ${g ? "greenic" : ""}"><i data-lucide="${ic}"></i><div><div class="lbl">${esc(l)}</div><div class="val">${esc(v)}</div><div class="dl">${sub ? esc(sub) : "&nbsp;"}</div></div></div>`).join("")}</div>
      <div class="cal-bar card"><div class="cal-nav"><button type="button" class="btn" id="cToday">Today</button><button type="button" class="icon-btn" id="cPrev" aria-label="Previous"><i data-lucide="chevron-left"></i></button><button type="button" class="icon-btn" id="cNext" aria-label="Next"><i data-lucide="chevron-right"></i></button><h2>${esc(title())}</h2></div>
        <div class="seg-toggle" role="group" aria-label="View">${[["month", "Month"], ["week", "Week"], ["day", "Day"], ["agenda", "Agenda"]].map(([v, l]) => `<button type="button" data-view="${v}" class="${state.view === v ? "on" : ""} ${v === "week" ? "no-phone" : ""}" aria-pressed="${state.view === v}">${l}</button>`).join("")}</div></div>
      <div class="cal-layers" role="group" aria-label="Show on the calendar">${LAYERS.map(([key, l, ic]) => `<label class="cal-lay ev-${key}"><input type="checkbox" data-layer="${key}" ${state.layers[key] ? "checked" : ""}><i></i>${l}</label>`).join("")}
        ${admin ? `<label class="cal-who">Person<select class="select" id="cWho" aria-label="Show one person's calendar"><option value="">Everyone</option>${people.map((p) => `<option ${p === state.who ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label>` : ""}</div>
      <div class="cal-layout"><section class="card cal-main">${main}</section>
        <aside class="cal-side"><section class="card p"><div class="ch"><i data-lucide="calendar-check"></i><h3>${esc(fmtLongDay(selDate))}</h3>${admin ? `<button type="button" class="btn sm" data-addday="${state.sel}"><i data-lucide="plus"></i>Meeting</button>` : ""}</div>
          ${sHols.map((h) => `<div class="cal-agh"><i data-lucide="party-popper"></i><b>${esc(h.name)}</b> <small>${esc(h.kind)} holiday${h.ends_on !== h.starts_on ? " · until " + esc(fmtDay(keyToDate(h.ends_on))) : ""}</small></div>`).join("")}${!sHols.length && isOff(selDate) ? `<div class="cal-agh off"><i data-lucide="moon"></i>Weekly off (Sunday)</div>` : ""}
          ${sEvs.length ? `<div class="cal-dl">${sEvs.map((e) => `<button type="button" class="${evCls(e)} ag" data-ev="${esc(e.key)}"><i></i><span class="t">${fmtTime(e.start)}</span><span>${esc(e.title)}</span></button>`).join("")}</div>` : `<div class="empty-sm">${sHols.length ? "No events on this holiday." : "Nothing scheduled this day."}</div>`}</section>
          <section class="card p"><div class="ch"><i data-lucide="clock"></i><h3>Upcoming meetings</h3></div>${upcoming.length ? `<ul class="cal-up">${upcoming.map((o) => `<li><button type="button" data-ev="m${o.m.id}@${o.start.getTime()}"><b>${esc(o.m.title)}</b><small>${esc(fmtLongDay(o.start))} · ${fmtTime(o.start)}${o.m.location ? " · " + esc(o.m.location) : ""}</small></button></li>`).join("")}</ul>` : `<div class="empty-sm">No upcoming meetings.</div>`}</section>
          <section class="card p"><div class="ch"><i data-lucide="party-popper"></i><h3>Holidays</h3>${admin ? `<button type="button" class="btn sm" id="cSug"><i data-lucide="sparkles"></i>Suggested</button>` : ""}</div>${yHol.length ? `<ul class="cal-hl">${yHol.map((h) => `<li><div><b>${esc(h.name)}</b><small>${esc(fmtDay(keyToDate(h.starts_on)))}${h.ends_on !== h.starts_on ? " – " + esc(fmtDay(keyToDate(h.ends_on))) : ""} · ${esc(h.kind)}</small></div>${admin ? `<button type="button" class="icon-btn" data-hedit="${h.id}" aria-label="Edit ${esc(h.name)}"><i data-lucide="pencil"></i></button><button type="button" class="icon-btn" data-hdel="${h.id}" aria-label="Delete ${esc(h.name)}"><i data-lucide="trash-2"></i></button>` : ""}</li>`).join("")}</ul>` : `<div class="empty-sm">No upcoming holidays${admin ? ". Add them or use the suggested ones." : "."}</div>`}</section></aside></div>`;
    if (window.lucide) lucide.createIcons(); wire();
  }

  // ---- details of one event ----
  const gcal = (e) => { const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), m = e.meeting; return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.title) + "&dates=" + f(e.start) + "/" + f(e.end) + "&details=" + encodeURIComponent([m && m.agenda, m && m.link].filter(Boolean).join("\n")) + "&location=" + encodeURIComponent((m && m.location) || ""); };
  function showEvent(key) {
    const [a, b] = [addDays(startOfDay(new Date()), -400), addDays(startOfDay(new Date()), 800)], e = events(a, b).find((x) => x.key === key) || events(...rangeOf()).find((x) => x.key === key); if (!e) return;
    const m = e.meeting, l = e.lead, rows = [["Time", fmtLongDay(e.start) + " · " + fmtTime(e.start) + " – " + fmtTime(e.end)]];
    if (m) { rows.push(["Type", m.kind + " meeting" + (m.repeat !== "none" ? " · repeats " + m.repeat + (m.repeat_until ? " until " + fmtDay(keyToDate(m.repeat_until)) : "") : "")], ["Status", m.status]); if (m.location) rows.push(["Where", m.location]); if (m.reminder_min !== null && m.reminder_min !== undefined) rows.push(["Reminder", (REMIND.find((r) => r[0] === String(m.reminder_min)) || [0, m.reminder_min + " min before"])[1]]); }
    if (l && !m) rows.push(["Customer", l.name + " · " + l.id]); if (e.task) rows.push(["Task", e.task.type + " · " + e.task.priority + " priority"]);
    const hs = holsOn(dayKey(e.start)); const att = m && m.attendee_names.length ? m.attendee_names.join(", ") : m ? "No one invited yet" : "";
    const links = m && m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener" class="btn sm"><i data-lucide="video"></i>Join online</a>` : "";
    const open = e.kind === "visit" ? `site-visit.html?id=${e.visit.id}` : e.kind === "followup" ? `leads.html?q=${encodeURIComponent(l.id)}` : e.kind === "task" ? "tasks.html" : "";
    const ov = document.createElement("div"); ov.className = "overlay open";
    ov.innerHTML = `<div class="modal cal-modal" role="dialog" aria-modal="true" aria-label="${esc(e.title)}"><h2>${esc(e.title)}</h2>
      <dl class="kv2">${rows.map(([x, y]) => `<dt>${esc(x)}</dt><dd>${esc(y)}</dd>`).join("")}${att ? `<dt>Invited</dt><dd>${esc(att)}</dd>` : ""}${m && m.agenda ? `<dt>Agenda</dt><dd class="pre">${esc(m.agenda)}</dd>` : ""}</dl>
      ${hs.length ? `<p class="hol-note">⚠ This day is a holiday: ${esc(hs[0].name)}.</p>` : ""}
      <div class="cal-act">${links}<a class="btn sm" href="${esc(gcal(e))}" target="_blank" rel="noopener"><i data-lucide="calendar-plus"></i>Add to Google Calendar</a><button type="button" class="btn sm" data-ics><i data-lucide="download"></i>Download .ics</button>${open ? `<a class="btn sm" href="${esc(open)}"><i data-lucide="external-link"></i>Open</a>` : ""}</div>
      ${m && admin ? `<div class="cal-act adm"><button type="button" class="btn sm" data-edit><i data-lucide="pencil"></i>Edit</button>${m.status === "Scheduled" ? `<button type="button" class="btn sm" data-st="Completed"><i data-lucide="check"></i>Mark completed</button><button type="button" class="btn sm" data-st="Cancelled"><i data-lucide="ban"></i>Cancel meeting</button>` : `<button type="button" class="btn sm" data-st="Scheduled"><i data-lucide="rotate-ccw"></i>Reopen</button>`}<button type="button" class="btn sm red" data-del><i data-lucide="trash-2"></i>Delete</button></div>` : ""}
      <div class="actions"><button type="button" class="btn" data-x>Close</button></div></div>`;
    document.body.appendChild(ov); if (window.lucide) lucide.createIcons(); const close = () => { ov.remove(); document.removeEventListener("keydown", onk); }, onk = (x) => { if (x.key === "Escape") close(); };
    document.addEventListener("keydown", onk); ov.querySelector("[data-x]").onclick = close; ov.addEventListener("mousedown", (x) => { if (x.target === ov) close(); });
    ov.querySelector("[data-ics]").onclick = () => downloadIcs([e], (e.title || "event").replace(/[^\w]+/g, "-") + ".ics");
    if (m && admin) {
      ov.querySelector("[data-edit]").onclick = () => { close(); openMeeting(m); };
      ov.querySelectorAll("[data-st]").forEach((b) => (b.onclick = async () => { try { await Data.saveMeeting(m.id, { status: b.dataset.st }); toast("Meeting " + b.dataset.st.toLowerCase()); close(); await refresh(); } catch (x) { toast("Could not save: " + x.message); } }));
      ov.querySelector("[data-del]").onclick = async () => { if (!confirm('Delete the meeting "' + m.title + '"' + (m.repeat !== "none" ? " and all its repeats" : "") + "?")) return; try { await Data.deleteMeeting(m.id); toast("Meeting deleted"); close(); await refresh(); } catch (x) { toast("Could not delete: " + x.message); } };
    }
  }

  // ---- .ics export ----
  const icsEsc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;"), icsDt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), icsDay = (key) => key.replace(/-/g, "");
  function downloadIcs(evs, name, hols = []) {
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Keys99 CRM//Calendar//EN", "CALSCALE:GREGORIAN"];
    evs.forEach((e) => L.push("BEGIN:VEVENT", "UID:" + e.key + "@keys99-crm", "DTSTAMP:" + icsDt(new Date()), "DTSTART:" + icsDt(e.start), "DTEND:" + icsDt(e.end), "SUMMARY:" + icsEsc(e.title), ...(e.meeting && e.meeting.location ? ["LOCATION:" + icsEsc(e.meeting.location)] : []), ...(e.meeting && (e.meeting.agenda || e.meeting.link) ? ["DESCRIPTION:" + icsEsc([e.meeting.agenda, e.meeting.link].filter(Boolean).join("\n"))] : []), "END:VEVENT"));
    hols.forEach((h) => L.push("BEGIN:VEVENT", "UID:h" + h.id + "@keys99-crm", "DTSTAMP:" + icsDt(new Date()), "DTSTART;VALUE=DATE:" + icsDay(h.starts_on), "DTEND;VALUE=DATE:" + icsDay(dayKey(addDays(keyToDate(h.ends_on), 1))), "SUMMARY:" + icsEsc("Holiday: " + h.name), "TRANSP:TRANSPARENT", "END:VEVENT"));
    L.push("END:VCALENDAR"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([L.join("\r\n")], { type: "text/calendar" })); a.download = name || "keys99-calendar.ics"; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---- forms (admins) ----
  function conflicts(f, id, attendees) {
    const out = [], day = f.date, s = f.date && f.start ? new Date(f.date + "T" + f.start) : null, e = f.date && f.end ? new Date(f.date + "T" + f.end) : null; if (!s || !e || isNaN(s) || isNaN(e)) return out;
    const h = holidayOn(state.holidays, s); if (h) out.push("That day is a holiday: " + h.name + "."); else if (isOff(s)) out.push("That day is a Sunday (weekly off).");
    if (e <= s) return [...out, "The end time must be after the start time."];
    const names = attendees.map((i) => (state.team.find((m) => m.id === i) || {}).name).filter(Boolean);
    state.meetings.filter((m) => m.id !== id && m.status !== "Cancelled").forEach((m) => expandMeeting(m, startOfDay(s), addDays(startOfDay(s), 1)).forEach((o) => { if (o.start < e && o.end > s) { const who = m.attendee_names.filter((n) => names.some((x) => k(x) === k(n))); if (who.length) out.push(who.join(", ") + " already has “" + m.title + "” at " + fmtTime(o.start) + "–" + fmtTime(o.end) + "."); } }));
    state.visits.forEach((v) => { const l = state.leads.find((x) => x.dbId === v.enquiry_id), vs = v.visit_at && new Date(v.visit_at); if (!l || !vs || /cancel|no.?show/i.test(v.status)) return; const ve = v.end_at ? new Date(v.end_at) : new Date(vs.getTime() + 3600000); if (vs < e && ve > s && names.some((x) => k(x) === k(l.agent))) out.push(l.agent + " has a site visit (" + (v.project || l.name) + ") at " + fmtTime(vs) + "."); });
    return out;
  }
  function openMeeting(m, preset = {}) {
    const team = state.team.filter((x) => (x.status || "Active") === "Active"), s = m ? new Date(m.starts_at) : null, e = m ? new Date(m.ends_at) : null, sel = new Set(m ? m.attendees : preset.attendees || []);
    const date = m ? dayKey(s) : preset.date || state.sel, start = m ? hm(s) : preset.start || "10:00", end = m ? hm(e) : preset.end || "11:00", v = (key, d = "") => (m ? m[key] : preset[key]) ?? d, remVal = m ? (m.reminder_min === null ? "" : String(m.reminder_min)) : "15";
    const leadOpts = state.leads.map((l) => `<option value="${l.dbId}" ${String(l.dbId) === String(v("enquiry_id")) ? "selected" : ""}>${esc(l.name)} · ${esc(l.mobile)}</option>`).join("");
    openModal(m ? "Edit meeting" : "Add meeting", html`<div class="form">${field("Title *", "title", v("title"), "text", 'required maxlength="140" placeholder="e.g. Weekly sales review"', "full")}
      ${selectField("Type", "kind", KINDS, v("kind", "Internal"))}${field("Date *", "date", date, "date", "required")}${field("Starts *", "start", start, "time", "required")}${field("Ends *", "end", end, "time", "required")}
      ${field("Where", "location", v("location"), "text", 'maxlength="160" placeholder="Office, site address, client office…"')}${field("Meeting link", "link", v("link"), "url", 'placeholder="https://meet.google.com/…"')}
      <label>Repeat<select name="repeat">${raw([["none", "Does not repeat"], ["daily", "Every day"], ["weekly", "Every week"], ["monthly", "Every month"]].map(([a, b]) => `<option value="${a}" ${a === v("repeat", "none") ? "selected" : ""}>${b}</option>`).join(""))}</select></label>${field("Repeat until", "repeat_until", v("repeat_until"), "date")}
      <label>Reminder<select name="reminder_min">${raw(REMIND.map(([a, b]) => `<option value="${a}" ${remVal === a ? "selected" : ""}>${b}</option>`).join(""))}</select></label>
      <label>Related lead (optional)<select name="enquiry_id"><option value="">— None —</option>${raw(leadOpts)}</select></label>
      <div class="full att"><span class="ms-l">Invite (they will see this meeting)</span><div class="att-list">${raw(team.map((x) => `<label class="att-o"><input type="checkbox" value="${x.id}" ${sel.has(x.id) ? "checked" : ""}><span>${esc(x.name)}</span></label>`).join("") || '<p class="ms-none">Add team members first.</p>')}</div><button type="button" class="auth-link" data-allatt>Select everyone</button><input type="hidden" name="attendees" value="${[...sel].join(",")}"></div>
      <label class="full">Agenda / notes<textarea name="agenda" rows="3" maxlength="1000" placeholder="What will be discussed?">${v("agenda")}</textarea></label>
      <div class="conf-note full" role="status" hidden></div></div>`,
      async (f) => {
        const ids = String(f.attendees || "").split(",").filter(Boolean).map(Number), s2 = new Date(f.date + "T" + f.start), e2 = new Date(f.date + "T" + f.end);
        if (isNaN(s2) || isNaN(e2) || e2 <= s2) throw new Error("The end time must be after the start time");
        if (f.link && !/^https?:\/\//i.test(f.link)) throw new Error("The meeting link must start with http:// or https://");
        if (f.repeat !== "none" && f.repeat_until && f.repeat_until < f.date) throw new Error("“Repeat until” cannot be before the meeting date");
        const row = { title: f.title, kind: f.kind, starts_at: s2.toISOString(), ends_at: e2.toISOString(), location: f.location || null, link: f.link || null, agenda: f.agenda || null, attendees: ids, attendee_names: ids.map((i) => (team.find((x) => x.id === i) || {}).name).filter(Boolean), enquiry_id: f.enquiry_id ? Number(f.enquiry_id) : null, repeat: f.repeat, repeat_until: f.repeat !== "none" && f.repeat_until ? f.repeat_until : null, reminder_min: f.reminder_min === "" ? null : Number(f.reminder_min) };
        await Data.saveMeeting(m ? m.id : null, row); toast(m ? "Meeting updated" : "Meeting added"); state.sel = f.date; await refresh();
      }, m ? "Save" : "Add meeting");
    const mod = document.querySelector(".overlay.open .modal"), form = mod.querySelector("form") || mod, hid = mod.querySelector('[name="attendees"]'), note = mod.querySelector(".conf-note");
    const ids = () => [...mod.querySelectorAll(".att-list input:checked")].map((x) => Number(x.value));
    const refreshNote = () => { hid.value = ids().join(","); const f = Object.fromEntries(["date", "start", "end"].map((n) => [n, mod.querySelector(`[name="${n}"]`).value])), c = conflicts(f, m ? m.id : 0, ids()); const none = !ids().length ? ["No one is invited yet: only admins will see this meeting."] : []; const all = [...c, ...none]; note.hidden = !all.length; note.innerHTML = all.map((x) => "⚠ " + esc(x)).join("<br>") + (c.length ? "<br><small>You can still save it.</small>" : ""); };
    mod.addEventListener("change", refreshNote); mod.addEventListener("input", (x) => { if (["date", "start", "end"].includes(x.target.name)) refreshNote(); });
    mod.querySelector("[data-allatt]").onclick = () => { mod.querySelectorAll(".att-list input").forEach((x) => (x.checked = true)); refreshNote(); }; refreshNote();
  }
  function openHoliday(h, preset = {}) {
    openModal(h ? "Edit holiday" : "Add holiday", html`<div class="form"><label class="full">Name *<input name="name" list="holNames" required maxlength="80" value="${h ? h.name : ""}" placeholder="e.g. Diwali" autocomplete="off"><datalist id="holNames">${SUGGEST_NAMES.map((n) => html`<option value="${n}"></option>`)}</datalist></label>
      ${field("First day *", "starts_on", h ? h.starts_on : preset.date || state.sel, "date", "required")}${field("Last day (if more than one day)", "ends_on", h ? (h.ends_on !== h.starts_on ? h.ends_on : "") : "", "date")}
      ${selectField("Type", "kind", ["Public", "Company", "Optional"], h ? h.kind : "Public")}<label class="full">Notes (optional)<textarea name="notes" rows="2" maxlength="300">${h ? h.notes || "" : ""}</textarea></label></div>`,
      async (f) => { await Data.saveHoliday(h ? h.id : null, { name: f.name, starts_on: f.starts_on, ends_on: f.ends_on || f.starts_on, kind: f.kind, notes: f.notes }); toast(h ? "Holiday updated" : "Holiday added"); state.sel = f.starts_on; await refresh(); }, h ? "Save" : "Add holiday");
  }
  function openSuggested() {
    const y = state.cur.getFullYear(), have = new Set(state.holidays.map((h) => h.starts_on)), list = [["Republic Day", y + "-01-26"], ["Maharashtra Day / Labour Day", y + "-05-01"], ["Independence Day", y + "-08-15"], ["Gandhi Jayanti", y + "-10-02"], ["Christmas", y + "-12-25"]];
    pickDialog({ title: "Suggested holidays for " + y, intro: "National holidays that fall on the same date every year. Festival dates change every year (Diwali, Holi, Eid, Ganesh Chaturthi…), so add those yourself with <b>Add holiday</b>.",
      tabs: [{ key: "h", label: "Holidays", items: list.map(([n, d]) => ({ id: d + "|" + n, label: n, sub: fmtLongDay(keyToDate(d)), checked: !have.has(d), disabled: have.has(d), badge: have.has(d) ? "already added" : "" })), empty: "Nothing to add." }], saveLabel: "Add selected",
      onSave: async (sel) => { if (!sel.h.length) throw new Error("Tick at least one"); const n = await Data.addHolidays(sel.h.map((x) => { const [d, ...nm] = x.split("|"); return { name: nm.join("|"), starts_on: d, ends_on: d, kind: "Public" }; })); toast(n + " holiday" + (n === 1 ? "" : "s") + " added"); await refresh(); } });
  }

  // ---- wiring ----
  const refresh = async () => { await load(); draw(); };
  function wire() {
    const $ = (s) => page.querySelector(s), on = (s, fn) => { const x = $(s); if (x) x.onclick = fn; };
    on("#cToday", () => { state.cur = state.view === "month" ? monthStart(new Date()) : startOfDay(new Date()); state.sel = dayKey(new Date()); draw(); }); on("#cPrev", () => { step(-1); draw(); }); on("#cNext", () => { step(1); draw(); });
    page.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { state.view = b.dataset.view; if (state.view !== "month") state.cur = keyToDate(state.sel); else state.cur = monthStart(keyToDate(state.sel)); draw(); }));
    page.querySelectorAll("[data-layer]").forEach((c) => (c.onchange = () => { state.layers[c.dataset.layer] = c.checked ? 1 : 0; draw(); }));
    const w = $("#cWho"); if (w) w.onchange = () => { state.who = w.value; draw(); };
    page.querySelectorAll("[data-day]").forEach((d) => (d.onclick = (e) => { if (e.target.closest("[data-ev],[data-addday]")) return; state.sel = d.dataset.day; if (state.view === "week" || state.view === "day") state.cur = keyToDate(state.sel); draw(); }));
    page.querySelectorAll(".cal-d").forEach((d) => (d.onkeydown = (e) => { if (e.key === "Enter" && e.target === d) { state.sel = d.dataset.day; draw(); } }));
    page.querySelectorAll("[data-ev]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); showEvent(b.dataset.ev); }));
    page.querySelectorAll("[data-addday]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openMeeting(null, { date: b.dataset.addday }); }));
    on("#cMeet", () => openMeeting(null)); on("#cHol", () => openHoliday(null)); on("#cSug", openSuggested);
    page.querySelectorAll("[data-hedit]").forEach((b) => (b.onclick = () => openHoliday(state.holidays.find((h) => h.id === Number(b.dataset.hedit)))));
    page.querySelectorAll("[data-hdel]").forEach((b) => (b.onclick = async () => { const h = state.holidays.find((x) => x.id === Number(b.dataset.hdel)); if (!h || !confirm('Delete the holiday "' + h.name + '"?')) return; try { await Data.deleteHoliday(h.id); toast("Holiday deleted"); await refresh(); } catch (e) { toast("Could not delete: " + e.message); } }));
    on("#cIcs", () => { const [a, b] = rangeOf(); downloadIcs(events(a, b), "keys99-calendar.ics", state.holidays.filter((h) => h.starts_on < dayKey(b) && h.ends_on >= dayKey(a))); });
  }
  addEventListener("resize", () => { if (phone() && state.view === "week") { state.view = "agenda"; draw(); } });

  await load(); draw();
})();
