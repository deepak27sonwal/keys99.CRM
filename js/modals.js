// Small modal helpers shared by the leads and customer pages.
// Lead stages, in display order. "Spam" sits second-to-contacted by design; it is not part of the sales funnel.
const STATUSES = ["New Leads", "Contacted", "Spam", "Interested", "Visit Scheduled", "Visit Done", "On Negotiations", "Token Done", "Booking Done", "Post Sale"];
const PIPELINE = STATUSES.filter((s) => s !== "Spam");               // funnel / progress order
const CLOSED = ["Spam", "Booking Done", "Post Sale"];               // no follow-up needed any more
const BOOKED = ["Booking Done", "Post Sale"];                       // counted as bookings / conversions

function openModal(title, body, onSubmit, submitLabel = "Save") {
  const ov = document.createElement("div");
  ov.className = "overlay open";
  ov.innerHTML = `<form class="modal"><h2>${esc(title)}</h2>${body.__raw}<div class="actions"><button type="button" class="btn" data-x>Cancel</button><button class="btn gold" type="submit">${esc(submitLabel)}</button></div></form>`;
  document.body.appendChild(ov);
  if (window.Dropdown) Dropdown.upgrade(ov);
  if (window.lucide) lucide.createIcons();
  const close = () => ov.remove();
  ov.querySelector("[data-x]").onclick = close;
  ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
  const form = ov.querySelector("form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]"); btn.disabled = true;
    try { await onSubmit(Object.fromEntries(new FormData(form))); close(); }
    catch (err) { btn.disabled = false; alert("Could not save: " + err.message); }
  };
  const first = form.querySelector("input:not([type=hidden]),textarea,.dd-btn,select:not([data-dd-ready])"); if (first) first.focus();
}
const field = (label, name, value = "", type = "text", attrs = "", cls = "") =>
  html`<label class="${cls}">${label}<input name="${name}" type="${type}" value="${value}" ${raw(attrs)}></label>`;
const selectField = (label, name, options, value = "", cls = "") =>
  html`<label class="${cls}">${label}<select name="${name}">${options.map((o) => html`<option ${o === value ? raw("selected") : raw("")}>${o}</option>`)}</select></label>`;

function openAddLead(done) {
  openModal("Add Lead", html`<div class="form">
    ${field("Name *", "name", "", "text", "required")}${field("Mobile * (10 digits)", "mobile", "", "tel", 'required pattern="[0-9+ \\-]{10,15}"')}
    ${field("Email", "email", "", "email")}${field("Requirement", "requirement", "", "text", 'placeholder="Buy • 2 BHK"')}
    ${field("Budget", "budget", "", "text", 'placeholder="₹ 70L – 1.2Cr"')}${field("Project", "project")}
    ${field("Developer", "developer")}${field("Location", "location")}
    ${selectField("Source", "source", ["Website", "Meta Ads", "Google Ads", "Referral", "WhatsApp", "Walk-in", "Others"])}
    ${selectField("Status", "status", STATUSES)}</div>`,
    async (f) => { await Data.addLead(f); toast("Lead added"); done && done(); });
}
async function openEditLead(lead, done) {
  // "Assigned agent" is a pick from the team (Agents & Teams) so the name always matches and the lead's email address follows the person.
  let team = []; try { team = await Data.getTeamCached(); } catch { team = []; }
  const k = (n) => String(n || "").trim().toLowerCase(), cur = lead.agent || "", match = team.find((m) => k(m.name) === k(cur));
  const KINDS = { agent: "Agent", rm: "Relationship Manager" };
  const agentField = team.length
    ? html`<label>Assigned agent<select name="agent" data-placeholder="— Unassigned —"><option value="">— Unassigned —</option>
        ${team.filter((m) => m.status === "Active").map((m) => html`<option value="${m.name}" ${match && match.id === m.id ? raw("selected") : raw("")}>${m.name} · ${KINDS[m.kind] || "Agent"}</option>`)}
        ${cur && (!match || match.status !== "Active") ? html`<option value="${cur}" selected>${cur} (${match ? "inactive" : "not on team"})</option>` : raw("")}</select></label>`
    : field("Assigned agent", "agent", cur);
  openModal("Edit " + lead.name, html`<div class="form">
    ${selectField("Status", "status", STATUSES, lead.status)}${field("Next follow-up", "follow_up", toLocalInput(lead.followUpTs), "datetime-local")}
    ${agentField}${selectField("Priority", "priority", ["", "A (High Priority)", "B (Medium)", "C (Low)"], lead.priority)}
    ${field("Budget", "budget", lead.budget)}${field("Location", "location", lead.location)}
    ${field("Property type", "property_type", lead.propertyType)}${field("BHK", "bhk", lead.bhk)}
    <label class="full">Notes<textarea name="notes" rows="3">${lead.notes}</textarea></label></div>`,
    async (f) => {
      const changed = k(f.agent) !== k(cur), who = team.find((m) => k(m.name) === k(f.agent));
      const patch = { status: f.status, followUp: fromLocalInput(f.follow_up), agent: f.agent, priority: f.priority, budget: f.budget, location: f.location, propertyType: f.property_type, bhk: f.bhk, notes: f.notes };
      if (changed && team.length) patch.agentEmail = who ? who.email : null;     // a team member brings their own email; unassigning clears it
      await Data.updateLead(lead.dbId, patch);
      if (changed) { try { await Data.addActivity(lead, "Assigned", f.agent ? "Assigned to " + f.agent + (cur ? " (was " + cur + ")" : "") : "Unassigned (was " + cur + ")"); } catch { /* the assignment itself is saved */ } }
      toast("Saved"); done && done();
    });
}
function openNote(lead, done) {
  openModal("Add Note", html`<div class="form"><label class="full">Note *<textarea name="text" rows="4" required></textarea></label></div>`,
    async (f) => { await Data.addNote(lead, f.text.trim()); toast("Note added"); done && done(); });
}
function openFollowUp(lead, done) {
  openModal("Schedule Follow-up", html`<div class="form">${field("Date & time *", "follow_up", toLocalInput(lead.followUpTs), "datetime-local", "required", "full")}
    <label class="full">Follow-up note (optional)<textarea name="note" rows="3" placeholder="e.g. Share pricing and book a site visit"></textarea></label></div>`,
    async (f) => { await Data.scheduleFollowUp(lead, fromLocalInput(f.follow_up), (f.note || "").trim()); toast("Follow-up scheduled"); done && done(); });
}
function openSiteVisit(lead, done) {
  openModal("Schedule Site Visit", html`<div class="form">
    ${field("Project", "project", lead.project)}${field("Date & time *", "visit_at", "", "datetime-local", "required")}
    ${selectField("Status", "status", ["Scheduled", "Confirmed", "Completed", "Cancelled"])}</div>`,
    async (f) => {
      await Data.addSiteVisit({ enquiry_id: lead.dbId, project: f.project || null, visit_at: fromLocalInput(f.visit_at), status: f.status });
      if (["New Leads", "Contacted", "Interested"].includes(lead.status)) await Data.updateLead(lead.dbId, { status: "Visit Scheduled" });
      toast("Site visit scheduled"); done && done();
    });
}
function openBooking(lead, done) {
  openModal("Convert to Deal", html`<div class="form">
    ${field("Project *", "project", lead.project, "text", "required")}${field("Developer", "developer", lead.developer)}
    ${field("Booking date *", "booking_date", new Date().toISOString().slice(0, 10), "date", "required")}${field("Booking value (₹) *", "booking_value", "", "number", 'required min="0" step="1"')}
    ${field("Agreement rate (%) *", "agreement_rate", "", "number", 'required min="0" max="100" step="0.01"')}${selectField("Commission status", "commission_status", ["Pending", "Received"])}
    <p class="full muted" style="font-size:12px">Commission = booking value × agreement rate.</p></div>`,
    async (f) => {
      const value = Number(f.booking_value), rate = Number(f.agreement_rate);
      await Data.addBooking({ enquiry_id: lead.dbId, project: f.project, developer: f.developer || null, booking_date: f.booking_date,
        booking_value: value, agreement_rate: rate, commission_amount: Math.round(value * rate) / 100, commission_status: f.commission_status,
        received_on: f.commission_status === "Received" ? f.booking_date : null });
      await Data.updateLead(lead.dbId, { status: "Booking Done" });
      toast("Deal recorded"); done && done();
    });
}
function openSpam(lead, done) {
  openModal("Mark as Spam", html`<div class="form">${selectField("Reason", "reason", ["Spam / fake enquiry", "Wrong number", "Duplicate", "Not interested", "Budget mismatch", "Not responding", "Other"], "", "full")}</div>`,
    async (f) => { await Data.updateLead(lead.dbId, { status: "Spam", lostReason: f.reason }); toast("Marked as spam"); done && done(); }, "Confirm");
}

// ---- site visits (used by the Site Visits page) ----
const VISIT_STATUSES = ["Scheduled", "Confirmed", "Completed", "Cancelled"];
const visitTimes = (f) => {
  if (f.end && f.end <= f.start) throw new Error("End time must be after the start time.");
  if (f.pickup && f.pickup > f.start) throw new Error("Pickup time must be before the visit starts.");
  return { visit_at: localISO(f.date, f.start), end_at: f.end ? localISO(f.date, f.end) : null, pickup_at: f.pickup ? localISO(f.date, f.pickup) : null };
};
const timeFields = (v) => html`${field("Date *", "date", v.date, "date", "required")}${field("Start time *", "start", v.start, "time", "required")}
  ${field("End time", "end", v.end, "time")}${field("Pickup time (optional)", "pickup", v.pickup, "time")}`;

function openScheduleVisit(leads, defaults, done) {
  const today = dayKey(new Date());
  const opts = leads.map((l) => html`<option value="${l.dbId}">${l.name} · ${l.mobile} · ${l.id}</option>`);
  openModal("Schedule Site Visit", html`<div class="form">
    <label class="full">Lead *<select name="lead" data-search data-placeholder="Search by name, phone or ID…" required><option value=""></option>${opts}</select></label>
    ${field("Project", "project", "", "text", 'placeholder="Defaults to the lead\'s project"', "full")}
    ${timeFields({ date: (defaults && defaults.date) || today, start: "10:00", end: "11:30", pickup: "" })}
    ${selectField("Status", "status", VISIT_STATUSES.slice(0, 2), "Scheduled", "full")}</div>`,
    async (f) => {
      const lead = leads.find((l) => String(l.dbId) === f.lead); if (!lead) throw new Error("Choose a lead.");
      await Data.addSiteVisit({ enquiry_id: lead.dbId, project: f.project || lead.project || null, status: f.status, ...visitTimes(f) });
      if (["New Leads", "Contacted", "Interested"].includes(lead.status)) await Data.updateLead(lead.dbId, { status: "Visit Scheduled" });
      toast("Site visit scheduled"); done && done();
    });
}
function openEditVisit(vm, done, onlyTimes) {
  const v = vm.raw, dt = toLocalInput(v.visit_at), pick = (ts) => (ts ? toLocalInput(ts).slice(11, 16) : "");
  openModal(onlyTimes ? "Reschedule Visit" : "Edit Site Visit", html`<div class="form">
    ${onlyTimes ? raw("") : html`${field("Project", "project", v.project || "", "text", "", "full")}${field("Meeting point", "meeting_point", v.meeting_point || "", "text", 'placeholder="e.g. Project site, Undri, Pune"', "full")}`}
    ${timeFields({ date: dt.slice(0, 10), start: dt.slice(11, 16), end: pick(v.end_at), pickup: pick(v.pickup_at) })}
    ${onlyTimes ? raw("") : selectField("Status", "status", VISIT_STATUSES, v.status, "full")}</div>`,
    async (f) => {
      const patch = visitTimes(f);
      if (v.site_end_at && patch.end_at) patch.site_end_at = null;           // plan times are re-derived from the new window
      if (!onlyTimes) { patch.project = f.project || null; patch.meeting_point = f.meeting_point || null; if (f.status !== v.status) Object.assign(patch, await Data.visitStatusPatch(v, f.status)); }
      await Data.updateSiteVisit(v.id, patch); toast(onlyTimes ? "Visit rescheduled" : "Visit updated"); done && done();
    });
}

// Save the after-visit outcome, complete the visit (unless "No Response") and move the lead accordingly.
async function applyVisitOutcome(visit, lead, outcome, remarks, done) {
  if (!outcome) throw new Error("Choose an outcome first.");
  const EARLY = ["New Leads", "Contacted", "Interested", "Visit Scheduled"];
  const patch = { outcome, remarks: (remarks || "").trim() || null, ...(await Data.logVisit(visit, "Outcome saved: " + outcome, "note")) };
  if (outcome !== "No Response") Object.assign(patch, await Data.visitStatusPatch({ ...visit, timeline: patch.timeline }, "Completed"));
  await Data.updateSiteVisit(visit.id, patch);
  if (outcome === "Interested") await Data.updateLead(lead.dbId, { status: "On Negotiations" });
  else if (outcome === "Not Interested") await Data.updateLead(lead.dbId, { status: "Spam", lostReason: "Not interested" });
  else if (outcome !== "No Response" && EARLY.includes(lead.status)) await Data.updateLead(lead.dbId, { status: "Visit Done" });
  toast("Outcome saved");
  done && (await done());
  if (outcome === "Need More Time" || outcome === "No Response") openFollowUp(lead, done);
}

// Small action menu anchored to a button. items = [[label, lucideIcon, handler, danger?]]
function popMenu(btn, items) {
  document.querySelectorAll(".menu-pop").forEach((m) => m.remove());
  const pop = document.createElement("div"); pop.className = "menu-pop"; pop.setAttribute("role", "menu");
  pop.innerHTML = items.map(([l, ic, , danger], i) => `<button role="menuitem" data-i="${i}" class="${danger ? "danger" : ""}"><i data-lucide="${ic}"></i>${esc(l)}</button>`).join("");
  document.body.appendChild(pop); if (window.lucide) lucide.createIcons();
  const r = btn.getBoundingClientRect(), r0 = r, pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(r.right - pw, innerWidth - pw - 8)) + "px"; pop.style.top = (r.bottom + ph + 8 > innerHeight ? r.top - ph - 4 : r.bottom + 4) + "px";
  const close = () => { pop.remove(); document.removeEventListener("mousedown", away, true); window.removeEventListener("scroll", onScroll, true); document.removeEventListener("keydown", onKey); };
  const away = (e) => { if (!pop.contains(e.target)) close(); }, onKey = (e) => { if (e.key === "Escape") close(); };
  const onScroll = () => { if (!btn.isConnected) return close(); const q = btn.getBoundingClientRect(); if (Math.abs(q.top - r0.top) > 2 || Math.abs(q.left - r0.left) > 2) close(); };
  pop.onclick = (e) => { const b = e.target.closest("button"); if (b) { close(); items[Number(b.dataset.i)][2](); } };
  document.addEventListener("mousedown", away, true); window.addEventListener("scroll", onScroll, true); document.addEventListener("keydown", onKey);
  pop.querySelector("button").focus();
}
// Plain information / confirmation dialog with custom HTML body.
function showDialog(title, body, buttons = [["Close", null]], wide = false) {
  const ov = document.createElement("div"); ov.className = "overlay open";
  ov.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${body.__raw}<div class="actions">${buttons.map(([l, , cls], i) => `<button class="btn ${cls || ""}" data-i="${i}">${esc(l)}</button>`).join("")}</div></div>`;
  document.body.appendChild(ov); if (window.lucide) lucide.createIcons();
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); }, onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
  ov.querySelectorAll("[data-i]").forEach((b) => (b.onclick = async () => { const h = buttons[Number(b.dataset.i)][1]; if (h) { try { await h(close); } catch (e) { alert(e.message); return; } } else close(); }));
  ov.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copyText(ov.querySelector(b.dataset.copy).value, "Copied")));
  return { el: ov, close };
}
