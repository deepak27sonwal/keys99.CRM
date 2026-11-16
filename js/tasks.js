// Tasks & Follow-ups: every lead follow-up (from the lead's "next follow-up") plus manual tasks, in Overdue / Today / Upcoming / Done.
// Employees only ever receive their own leads and tasks from the database; admins see everyone and can filter by person.
(async function () {
  const page = await mountShell("tasks");
  if (!page) return;
  const me = window.ME, admin = me.role === "admin", TABS = ["Overdue", "Today", "Upcoming", "Done"];
  const state = { tab: "Today", person: "", leads: [], tasks: [], team: [], err: "" };
  const k = (s) => String(s || "").trim().toLowerCase();

  async function load() {
    try {
      const [leads, tasks, team] = await Promise.all([Data.getLeads(), Data.getTasks(), admin ? Data.getTeamCached() : Promise.resolve(me.member ? [me.member] : [])]);
      state.leads = leads; state.tasks = tasks; state.team = team; state.err = "";
    } catch (e) { state.err = e.message || String(e); }
  }

  function items() {
    const byId = new Map(state.team.map((m) => [m.id, m])), leadById = new Map(state.leads.map((l) => [l.dbId, l])), out = [];
    state.leads.forEach((l) => {
      if (l.followUpTs && l.status !== "Spam") out.push({ kind: "f", key: "f" + l.dbId, title: "Follow up with " + l.name, sub: [l.project, l.requirement].filter(Boolean).join(" · "), due: new Date(l.followUpTs), lead: l, owner: l.agent || "Unassigned" });
      l.acts.filter((a) => a && a.title === "Follow-up done" && a.at).forEach((a, i) => out.push({ kind: "f", key: "fd" + l.dbId + "-" + i, title: "Followed up with " + l.name, sub: a.description || "", due: null, done: true, doneAt: new Date(a.at), lead: l, owner: l.agent || "Unassigned" }));
    });
    state.tasks.forEach((t) => {
      const m = byId.get(t.assigned_to), l = t.enquiry_id ? leadById.get(t.enquiry_id) : null;
      out.push({ kind: "t", key: "t" + t.id, title: t.title, sub: [l && l.name, t.notes].filter(Boolean).join(" · "), due: t.due_at ? new Date(t.due_at) : null, task: t, lead: l, owner: m ? m.name : "Unassigned", done: !!t.done_at, doneAt: t.done_at ? new Date(t.done_at) : null });
    });
    return out.filter((i) => !state.person || k(i.owner) === k(state.person));
  }
  function bucket(i, now) {
    if (i.done) return "Done";
    if (!i.due) return "Upcoming";
    const today = startOfDay(now);
    return i.due < today ? "Overdue" : sameDay(i.due, now) ? "Today" : "Upcoming";
  }
  const dueText = (i, b) => {
    if (i.done) return "Done " + fmtDay(i.doneAt) + " · " + fmtTime(i.doneAt);
    if (!i.due) return "No date";
    return b === "Today" ? "Today · " + fmtTime(i.due) : fmtDay(i.due) + " · " + fmtTime(i.due);
  };

  function row(i, b) {
    const l = i.lead, f = i.kind === "f";
    return html`<li class="tk ${b === "Overdue" ? "late" : ""} ${i.done ? "done" : ""}" data-key="${i.key}">
      ${i.done ? raw('<span class="tk-ic ok"><i data-lucide="check-circle-2"></i></span>') : f ? raw('<span class="tk-ic"><i data-lucide="phone-call"></i></span>') : html`<button type="button" class="tk-chk" data-done="${i.key}" aria-label="Mark ${i.title} done"></button>`}
      <div class="tk-main"><b>${i.title}</b>${i.sub ? html`<small>${i.sub}</small>` : raw("")}
        <span class="tk-meta"><span class="chip ${b === "Overdue" ? "c-late" : ""}"><i data-lucide="${i.done ? "check" : "calendar"}"></i>${dueText(i, b)}</span>${admin ? html`<span class="tk-own">${avatar(i.owner, 20)}${i.owner}</span>` : raw("")}</span></div>
      <div class="tk-acts">
        ${l ? html`<a class="icon-btn" href="${telHref(l.mobile)}" aria-label="Call ${l.name}"><i data-lucide="phone"></i></a><a class="icon-btn" href="${waHref(l.mobile)}" target="_blank" rel="noopener" aria-label="WhatsApp ${l.name}"><i data-lucide="message-circle"></i></a><a class="icon-btn" href="leads.html?q=${encodeURIComponent(l.id)}" aria-label="Open ${l.name}"><i data-lucide="external-link"></i></a>` : raw("")}
        ${!i.done && f ? html`<button type="button" class="btn sm" data-fdone="${i.key}"><i data-lucide="check"></i>Done</button><button type="button" class="btn sm" data-resched="${i.key}"><i data-lucide="calendar-clock"></i>Reschedule</button>` : raw("")}
        ${!i.done && !f ? html`<button type="button" class="btn sm" data-tresched="${i.key}"><i data-lucide="calendar-clock"></i>Reschedule</button>` : raw("")}
        ${!f && (admin || (i.task && i.task.created_by === me.uid)) ? html`<button type="button" class="icon-btn" data-tdel="${i.key}" aria-label="Delete task ${i.title}"><i data-lucide="trash-2"></i></button>` : raw("")}
      </div></li>`;
  }

  function draw() {
    if (state.err) { page.innerHTML = '<div class="card empty">Could not load tasks: ' + esc(state.err) + "</div>"; return; }
    const now = new Date(), all = items().map((i) => [i, bucket(i, now)]), cnt = Object.fromEntries(TABS.map((t) => [t, all.filter(([, b]) => b === t).length]));
    let list = all.filter(([, b]) => b === state.tab);
    list = state.tab === "Done" ? list.sort((a, b) => b[0].doneAt - a[0].doneAt).slice(0, 100) : list.sort((a, b) => (a[0].due ? a[0].due.getTime() : 9e15) - (b[0].due ? b[0].due.getTime() : 9e15));
    const people = [...new Set([...state.team.map((m) => m.name), ...state.leads.map((l) => l.agent).filter(Boolean)])].sort();
    render(page, html`
      <div class="page-head"><div><h1>Tasks &amp; Follow-ups</h1><p class="sub">${admin ? "Everyone's follow-ups and tasks in one place." : "Your follow-ups and tasks. Only your own leads are shown."}</p></div>
        <div class="btns">${admin ? html`<label class="pl-for">Person:<select class="select" id="tkPerson" aria-label="Person"><option value="">Everyone</option>${people.map((p) => html`<option ${p === state.person ? raw("selected") : raw("")}>${p}</option>`)}</select></label>` : raw("")}
          <button class="btn gold" id="tkAdd"><i data-lucide="plus"></i>Add Task</button></div></div>
      <div class="kpis k6 tk-kpis">${kpiCard(["Overdue", cnt.Overdue, "", "alert-triangle"])}${kpiCard(["Today", cnt.Today, "", "calendar-check", 1])}${kpiCard(["Upcoming", cnt.Upcoming, "", "calendar-days"])}${kpiCard(["Done", cnt.Done, "", "check-circle-2", 0, 1])}</div>
      <div class="tabs-pill" role="tablist">${TABS.map((t) => html`<button type="button" role="tab" class="pill ${t === state.tab ? "active" : ""}" aria-selected="${t === state.tab}" data-tab="${t}">${t} (${cnt[t]})</button>`)}</div>
      <section class="card p">${list.length ? html`<ul class="tk-list">${list.map(([i, b]) => row(i, b))}</ul>` : html`<div class="empty-sm">${state.tab === "Done" ? "Nothing completed yet." : "Nothing here. " + (state.tab === "Today" ? "You are all caught up." : "")}</div>`}</section>`);
    wire();
  }

  const find = (key) => items().find((i) => i.key === key);
  const refresh = async () => { await load(); draw(); };
  function wire() {
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; draw(); }));
    const ps = page.querySelector("#tkPerson"); if (ps) ps.onchange = () => { state.person = ps.value; draw(); };
    page.querySelector("#tkAdd").onclick = openAddTask;
    page.querySelectorAll("[data-done]").forEach((b) => (b.onclick = async () => { const i = find(b.dataset.done); if (!i) return; b.disabled = true; try { await Data.updateTask(i.task.id, { done_at: new Date().toISOString() }); toast("Task done"); await refresh(); } catch (e) { b.disabled = false; toast("Could not save: " + e.message); } }));
    page.querySelectorAll("[data-fdone]").forEach((b) => (b.onclick = () => { const i = find(b.dataset.fdone); if (i) openFollowDone(i.lead); }));
    page.querySelectorAll("[data-resched]").forEach((b) => (b.onclick = () => { const i = find(b.dataset.resched); if (i) openFollowUp(i.lead, refresh); }));
    page.querySelectorAll("[data-tresched]").forEach((b) => (b.onclick = () => { const i = find(b.dataset.tresched); if (i) openTaskDate(i.task); }));
    page.querySelectorAll("[data-tdel]").forEach((b) => (b.onclick = async () => { const i = find(b.dataset.tdel); if (!i || !confirm("Delete this task?")) return; try { await Data.deleteTask(i.task.id); toast("Task deleted"); await refresh(); } catch (e) { toast("Could not delete: " + e.message); } }));
  }

  function openFollowDone(lead) {
    openModal("Follow-up done · " + lead.name, html`<div class="form"><label class="full">What happened? (optional)<textarea name="note" rows="3" placeholder="e.g. Spoke to the client, site visit fixed for Saturday"></textarea></label></div>`,
      async (f) => { await Data.addActivity(lead, "Follow-up done", f.note || "Follow-up completed"); await Data.updateLead(lead.dbId, { followUp: null }); toast("Follow-up marked done"); await refresh(); }, "Mark done");
  }
  function openTaskDate(t) {
    openModal("Reschedule task", html`<div class="form">${field("Date & time *", "due", toLocalInput(t.due_at), "datetime-local", "required", "full")}</div>`,
      async (f) => { await Data.updateTask(t.id, { due_at: fromLocalInput(f.due) }); toast("Task rescheduled"); await refresh(); });
  }
  function openAddTask() {
    const team = state.team.filter((m) => (m.status || "Active") === "Active"), mine = me.memberId;
    const who = admin ? html`<label class="full">Assign to *<select name="assigned_to" required><option value="">— Choose —</option>${team.map((m) => html`<option value="${m.id}">${m.name}</option>`)}</select></label>` : html`<input type="hidden" name="assigned_to" value="${mine}">`;
    const ls = state.leads.slice(0, 400);
    openModal("Add task", html`<div class="form">${field("Task *", "title", "", "text", 'required maxlength="140" placeholder="e.g. Send brochure to Mr. Shah"', "full")}
      ${field("Due date & time", "due", "", "datetime-local")}${who}
      <label class="full">Related lead (optional)<select name="enquiry_id"><option value="">— None —</option>${ls.map((l) => html`<option value="${l.dbId}">${l.name} · ${l.mobile}</option>`)}</select></label>
      <label class="full">Notes (optional)<textarea name="notes" rows="2"></textarea></label></div>`,
      async (f) => {
        const assigned = Number(f.assigned_to); if (!assigned) throw new Error("Choose who the task is for");
        await Data.addTask({ title: f.title, notes: f.notes, due_at: fromLocalInput(f.due), assigned_to: assigned, enquiry_id: f.enquiry_id ? Number(f.enquiry_id) : null });
        toast("Task added"); await refresh();
      }, "Add task");
  }

  await load(); draw();
})();
