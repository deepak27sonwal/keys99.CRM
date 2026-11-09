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
function openEditLead(lead, done) {
  openModal("Edit " + lead.name, html`<div class="form">
    ${selectField("Status", "status", STATUSES, lead.status)}${field("Next follow-up", "follow_up", toLocalInput(lead.followUpTs), "datetime-local")}
    ${field("Assigned agent", "agent", lead.agent)}${selectField("Priority", "priority", ["", "A (High Priority)", "B (Medium)", "C (Low)"], lead.priority)}
    ${field("Budget", "budget", lead.budget)}${field("Location", "location", lead.location)}
    ${field("Property type", "property_type", lead.propertyType)}${field("BHK", "bhk", lead.bhk)}
    <label class="full">Notes<textarea name="notes" rows="3">${lead.notes}</textarea></label></div>`,
    async (f) => {
      await Data.updateLead(lead.dbId, { status: f.status, followUp: fromLocalInput(f.follow_up), agent: f.agent, priority: f.priority,
        budget: f.budget, location: f.location, propertyType: f.property_type, bhk: f.bhk, notes: f.notes });
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
