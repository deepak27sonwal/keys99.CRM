// Small modal helpers shared by the leads and customer pages.
// Lead stages, in display order. "Spam" sits second-to-contacted by design; it is not part of the sales funnel.
const STATUSES = ["New Leads", "Contacted", "Spam", "Interested", "Visit Scheduled", "Visit Done", "On Negotiations", "Token Done", "Booking Done", "Post Sale"];
const PIPELINE = STATUSES.filter((s) => s !== "Spam");               // funnel / progress order
const CLOSED = ["Spam", "Booking Done", "Post Sale"];               // no follow-up needed any more
const BOOKED = ["Booking Done", "Post Sale"];                       // counted as bookings / conversions

// Suggestions while typing: a list under a text box that narrows as you type (matches anywhere in the name, starts-with first),
// moves with the arrow keys, picks with Enter / Tab-free click, and closes with Escape. `getItems()` is read on every keystroke.
// onPick(value) decides what a pick does (default: put it in the box). Typing something new and pressing Enter is never blocked.
function attachSuggest(input, getItems, onPick, opts = {}) {
  const host = input.closest(".overlay") || document.body, pop = document.createElement("ul"), id = "sg" + Math.random().toString(36).slice(2, 8);
  pop.className = "sg-pop"; pop.id = id; pop.setAttribute("role", "listbox"); pop.hidden = true; host.appendChild(pop);
  input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", id); input.autocomplete = "off";
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  let shown = [], active = -1;
  const hide = () => { pop.hidden = true; active = -1; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
  const mark = () => { [...pop.children].forEach((li, i) => { li.classList.toggle("on", i === active); li.setAttribute("aria-selected", i === active ? "true" : "false"); if (i === active) { input.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); } }); };
  const place = () => { const r = input.getBoundingClientRect(), below = innerHeight - r.bottom, h = Math.min(pop.scrollHeight, 240), up = below < h + 12 && r.top > below; pop.style.left = r.left + "px"; pop.style.width = r.width + "px"; pop.style.maxHeight = Math.max(100, Math.min(240, (up ? r.top : below) - 12)) + "px"; pop.style.top = up ? Math.max(8, r.top - Math.min(h, r.top - 12) - 4) + "px" : r.bottom + 4 + "px"; };
  const esc2 = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const render = () => {
    if (!input.isConnected) return pop.remove();
    const q = norm(input.value), all = (getItems() || []).filter(Boolean);
    shown = all.filter((x) => !q || norm(x).includes(q)).sort((a, b) => (norm(b).startsWith(q) - norm(a).startsWith(q)) || String(a).localeCompare(String(b))).slice(0, opts.max || 8);
    if (!shown.length) return hide();
    const hi = (t) => { const i = q ? norm(t).indexOf(q) : -1; return i < 0 ? esc2(t) : esc2(t.slice(0, i)) + "<b>" + esc2(t.slice(i, i + q.length)) + "</b>" + esc2(t.slice(i + q.length)); };
    pop.innerHTML = shown.map((t, i) => `<li role="option" id="${id}-${i}" data-i="${i}">${hi(String(t))}</li>`).join("");
    pop.hidden = false; input.setAttribute("aria-expanded", "true"); active = -1; place();
  };
  const pick = (i) => { const v = shown[i]; hide(); if (onPick) onPick(v); else { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); } };
  input.addEventListener("input", render); input.addEventListener("focus", render);
  input.addEventListener("blur", () => setTimeout(hide, 120));
  input.addEventListener("keydown", (e) => {
    if (pop.hidden) { if (e.key === "ArrowDown") render(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % shown.length; mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + shown.length) % shown.length; mark(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); e.stopImmediatePropagation(); pick(active); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); hide(); }
    else if (e.key === "Tab") hide();
  }, true);
  pop.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pick(Number(li.dataset.i)); } });
  window.addEventListener("resize", () => { if (!pop.hidden) place(); });
  return { refresh: render, hide };
}
// ---------- form validation (every entry form goes through openModal) ----------
const V = {
  phone: (s) => { const d = String(s).replace(/[\s\-().]/g, ""); return /^(\+?91|0)?[6-9]\d{9}$/.test(d) || /^\+\d{8,15}$/.test(d); },
  email: (s) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(s),
  url: (s) => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(s),
  hasLetter: (s) => /\p{L}/u.test(s),                       // any script: Latin, Devanagari, Tamil, Bengali, Telugu, Arabic...
};
const nowLocal = () => { const d = new Date(Date.now() - 5 * 60000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const todayStr = () => nowLocal().slice(0, 10);
const labelOf = (el) => { const l = el.closest("label"); const t = l ? [...l.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ") : ""; return t.replace(/\*|\(.*?\)/g, "").replace(/\s+/g, " ").trim() || el.name; };
// Returns an error message for one control, or "" when it is fine. A date that has not been changed is never complained about (an overdue follow-up must not block saving other edits).
function fieldError(el, form) {
  const val = String(el.value || "").trim(), name = el.name, label = labelOf(el), changed = el.dataset.init !== el.value;
  if (!val) return el.dataset.req === "1" ? (el.tagName === "SELECT" ? "Choose " : "Enter ") + label.toLowerCase() : "";
  if (["name", "contact_person", "designation", "team", "developer", "project", "location", "city", "agent"].includes(name)) {
    if (val.length < 2) return label + " needs at least 2 characters";
    if (!V.hasLetter(val)) return label + " must contain letters";
  }
  if (name === "mobile" || name === "phone") { if (!V.phone(val)) return "Enter a valid mobile number, e.g. 98765 43210"; }
  if (name === "email" && !V.email(val)) return "Enter a valid email address, e.g. name@example.com";
  if (name === "website" && !V.url(val)) return "Enter a valid website, e.g. example.com";
  if ((name === "budget" || name === "price_range") && !/\d/.test(val)) return "Include an amount, e.g. ₹ 70L – 1.2Cr";
  if (name === "rera_no" && !/^[A-Za-z0-9][A-Za-z0-9/\-. ]{4,29}$/.test(val)) return "Enter a valid RERA number (5–30 letters, digits, - or /)";
  if (name === "text" && val.length < 3) return "Write at least 3 characters";
  let stepMsg = "";
  if (changed && el.type === "number" && el.step && el.step !== "any" && Number(el.step) > 0 && Number.isFinite(Number(val))) {   // only when edited: an older saved value that is off-step must not block other changes   // native validation is off, so honour the field's own step
    const st = Number(el.step), base = el.min !== "" && Number.isFinite(Number(el.min)) ? Number(el.min) : 0, k = (Number(val) - base) / st;
    if (Math.abs(k - Math.round(k)) > 1e-6) stepMsg = st === 1 ? "Enter a whole number" : st < 1 ? "Use at most " + (String(st).split(".")[1] || "").length + " decimal places" : "Use a multiple of " + st;   // reported only when no clearer rule below fires first
  }
  if (name === "booking_value" && !(Number(val) > 0)) return "Booking value must be more than 0";
  if (name === "agreement_rate" && !(Number(val) >= 0 && Number(val) <= 100)) return "Agreement rate must be between 0 and 100";
  if (name === "monthly_target" && Number(val) < 0) return "Target can't be negative";
  if ((name === "follow_up" || name === "visit_at") && changed && val < nowLocal()) return "Pick a date and time in the future";
  if (name === "date" && changed && val < todayStr()) return "Pick today or a later date";
  if ((name === "booking_date" || name === "joined_on") && changed && val > todayStr()) return label + " can't be in the future";
  const q = (n) => form.querySelector(`[name="${n}"]`);
  if (name === "end" && q("start") && q("start").value && val <= q("start").value) return "End time must be after the start time";
  if (name === "pickup" && q("start") && q("start").value && val > q("start").value) return "Pickup time must be before the visit starts";
  return stepMsg;
}
function setupValidation(form) {
  form.noValidate = true;
  const controls = [...form.querySelectorAll("input:not([type=hidden]):not([type=checkbox]),textarea,select")].filter((c) => c.name);
  controls.forEach((c) => {
    const lab = c.closest("label"); c.dataset.init = c.value;
    const own = lab ? [...lab.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ") : "";
    if (c.required || /\*/.test(own)) c.dataset.req = "1";
    if (c.tagName === "INPUT" && ["text", "tel", "email", "search"].includes(c.type) && c.maxLength < 0) c.maxLength = 120;
    if (c.tagName === "TEXTAREA" && c.maxLength < 0) c.maxLength = 2000;
    if (lab && !lab.querySelector(".f-err")) { const m = document.createElement("small"); m.className = "f-err"; m.setAttribute("role", "alert"); lab.appendChild(m); }
  });
  const show = (c, msg) => { const lab = c.closest("label"); if (!lab) return; lab.classList.toggle("has-err", !!msg); c.setAttribute("aria-invalid", msg ? "true" : "false"); const m = lab.querySelector(".f-err"); if (m) m.textContent = msg; };
  const check = (c) => { const msg = fieldError(c, form); show(c, msg); return msg; };
  controls.forEach((c) => { c.addEventListener("blur", () => { c.dataset.touched = "1"; check(c); }); const again = () => { if (c.getAttribute("aria-invalid") === "true") check(c); }; c.addEventListener("input", again); c.addEventListener("change", () => { check(c); controls.filter((x) => x !== c && x.getAttribute("aria-invalid") === "true").forEach(check); }); });
  return { validate() { const bad = controls.filter((c) => check(c)); if (bad.length) { const f = bad[0]; (f.closest("label").querySelector(".dd-btn") && f.tagName === "SELECT" ? f.closest("label").querySelector(".dd-btn") : f).focus(); } return bad.length; }, controls };
}
function openModal(title, body, onSubmit, submitLabel = "Save") {
  const ov = document.createElement("div");
  ov.className = "overlay open";
  ov.innerHTML = `<form class="modal"><h2>${esc(title)}</h2>${body.__raw}<div class="form-err" role="alert" aria-live="assertive" hidden></div><div class="actions"><button type="button" class="btn" data-x>Cancel</button><button class="btn gold" type="submit">${esc(submitLabel)}</button></div></form>`;
  document.body.appendChild(ov);
  if (window.Dropdown) Dropdown.upgrade(ov);
  if (window.lucide) lucide.createIcons();
  const close = () => ov.remove();
  ov.querySelector("[data-x]").onclick = close;
  ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
  const form = ov.querySelector("form"), banner = form.querySelector(".form-err"), vd = setupValidation(form);
  const say = (m) => { banner.textContent = m || ""; banner.hidden = !m; };
  form.onsubmit = async (e) => {
    e.preventDefault(); say("");
    const n = vd.validate(); if (n) return say(n === 1 ? "Please fix the highlighted field." : "Please fix the " + n + " highlighted fields.");
    const btn = form.querySelector("[type=submit]"); btn.disabled = true;
    try { await onSubmit(Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]))); close(); }
    catch (err) { btn.disabled = false; say("Could not save: " + (err.message || err)); }
  };
  const first = form.querySelector("input:not([type=hidden]),textarea,.dd-btn,select:not([data-dd-ready])"); if (first) first.focus();
}
const field = (label, name, value = "", type = "text", attrs = "", cls = "") =>
  html`<label class="${cls}">${label}<input name="${name}" type="${type}" value="${value}" ${raw(attrs)}></label>`;
const selectField = (label, name, options, value = "", cls = "") =>
  html`<label class="${cls}">${label}<select name="${name}">${options.map((o) => html`<option ${o === value ? raw("selected") : raw("")}>${o}</option>`)}</select></label>`;

// ---------- property type + configuration (BHK) dropdown, shared by the lead forms and the project form ----------
// What can be built / sold under each type. The configuration dropdown follows the chosen type.
const CONFIGS = {
  Residential: ["1 BHK", "1.5 BHK", "2 BHK", "2.5 BHK", "3 BHK", "3.5 BHK", "4 BHK", "4.5 BHK", "5 BHK", "5.5 BHK", "6 BHK"],
  Commercial: ["Office Space", "Shop / Retail", "Showroom", "Co-working Space", "Warehouse / Godown", "Industrial Unit", "Commercial Plot", "Food Court / Mall Unit"],
  Villa: ["3 BHK Villa", "4 BHK Villa", "5 BHK Villa", "Row House", "Bungalow"],
  "Plot / Land": ["Residential Plot", "Commercial Plot", "NA Plot", "Farm Land", "Agricultural Land"],
  Other: ["Studio", "Serviced Apartment", "Penthouse", "Co-living", "Other"],
};
// Markup: the Type select + the Configuration dropdown. A type that is not in the list (older data) is kept as an option. `name` is the saved field.
const configPicker = ({ type = "", value = "", name = "bhk", typeLabel = "Property type", label = "Configuration (BHK)" } = {}) => html`${selectField(typeLabel, "property_type", ["", ...Object.keys(CONFIGS), ...(type && !CONFIGS[type] ? [type] : [])], type || "")}
  <div class="full ms-wrap"><span class="ms-l">${label}</span><details class="ms" id="msBox"><summary id="msSum">Choose a type first</summary><div class="ms-list" id="msList"></div></details><input type="hidden" name="${name}" id="msVal" value="${value || ""}"></div>`;
// Wires the Type select to the checklist inside an open form (several can be chosen; saved as "2 BHK, 3 BHK").
function wireConfigs(root) {
  const type = root.querySelector('[name="property_type"]'), list = root.querySelector("#msList"), sum = root.querySelector("#msSum"), val = root.querySelector("#msVal"), box = root.querySelector("#msBox");
  if (!type || !list) return;
  let chosen = String(val.value || "").split(",").map((x) => x.trim()).filter(Boolean);
  const sync = () => { val.value = chosen.join(", "); sum.textContent = chosen.length ? chosen.join(", ") : type.value ? "Select configurations" : "Choose a type first"; sum.classList.toggle("empty", !chosen.length); };
  const build = () => {
    const opts = CONFIGS[type.value] || [];
    const known = Object.values(CONFIGS).flat();   // a pick that belongs to some type is dropped when it does not fit the current one (or no type is chosen); custom text from older entries is kept
    chosen = chosen.filter((c) => (type.value && opts.includes(c)) || !known.includes(c));
    const extra = chosen.filter((c) => !opts.includes(c));
    list.innerHTML = !type.value ? '<p class="ms-none">Pick a type first.</p>' : [...opts, ...extra].map((o) => `<label class="ms-o"><input type="checkbox" value="${esc(o)}" ${chosen.includes(o) ? "checked" : ""}><span>${esc(o)}</span></label>`).join("") || '<p class="ms-none">No presets for this type.</p>';
    list.querySelectorAll("input").forEach((c) => (c.onchange = () => { chosen = [...list.querySelectorAll("input:checked")].map((x) => x.value); sync(); }));
    box.classList.toggle("off", !type.value); if (!type.value) box.open = false; sync();
  };
  type.addEventListener("change", build); build();
}
function openAddLead(done, preset = {}) {
  openModal("Add Lead", html`<div class="form">
    ${field("Name *", "name", "", "text", "required")}${field("Mobile * (10 digits)", "mobile", "", "tel", 'required pattern="[0-9+ \\-]{10,15}"')}
    ${field("Email", "email", "", "email")}${field("Requirement", "requirement", "", "text", 'placeholder="Buy • 2 BHK"')}
    ${field("Budget", "budget", "", "text", 'placeholder="₹ 70L – 1.2Cr"')}${configPicker()}
    ${field("Project", "project", preset.project || "")}
    ${field("Developer", "developer", preset.developer || "")}${field("Location", "location")}
    ${selectField("Source", "source", ["Website", "Meta Ads", "Google Ads", "Referral", "WhatsApp", "Walk-in", "Others"])}
    ${selectField("Status", "status", STATUSES, preset.status || "")}</div>`,
    async (f) => { if (!f.requirement && (f.property_type || f.bhk)) f.requirement = [f.property_type, f.bhk].filter(Boolean).join(" · "); await Data.addLead(f); toast("Lead added"); done && done(); });
  wireConfigs(document.querySelector(".overlay.open .modal") || document);
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
    ${configPicker({ type: lead.propertyType, value: lead.bhk })}
    <label class="full">Notes<textarea name="notes" rows="3">${lead.notes}</textarea></label></div>`,
    async (f) => {
      const changed = k(f.agent) !== k(cur), who = team.find((m) => k(m.name) === k(f.agent));
      const patch = { status: f.status, followUp: fromLocalInput(f.follow_up), agent: f.agent, priority: f.priority, budget: f.budget, location: f.location, propertyType: f.property_type, bhk: f.bhk, notes: f.notes };
      if (changed && team.length) patch.agentEmail = who ? who.email : null;     // a team member brings their own email; unassigning clears it
      await Data.updateLead(lead.dbId, patch);
      if (changed) { try { await Data.addActivity(lead, "Assigned", f.agent ? "Assigned to " + f.agent + (cur ? " (was " + cur + ")" : "") : "Unassigned (was " + cur + ")"); } catch { /* the assignment itself is saved */ } }
      toast("Saved"); done && done();
    });
  wireConfigs(document.querySelector(".overlay.open .modal") || document);
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

// Where a lead came from and what it answered on the form (Facebook / Google / website forms). Empty for leads without such details.
function sourceRows(l) {
  const s = l.src || {}, plat = { fb: "Facebook", ig: "Instagram", google: "Google Ads", whatsapp: "WhatsApp" }[s.platform] || s.platform;
  return [["Platform", plat], ["Page", s.page], ["Form", s.form], ["Campaign", s.campaign], ["Ad set", s.adset], ["Ad", s.ad]].filter((r) => r[1]);
}
function enquiryDetails(l, cls = "box-b") {
  const rows = sourceRows(l), ans = (l.src && l.src.answers) || [];
  if (!rows.length && !ans.length) return raw("");
  return html`<div class="${cls} ed"><h4>Enquiry details</h4>${rows.length ? html`<dl class="ed-r">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>` : raw("")}
    ${ans.length ? html`<h5>Form answers</h5><ul class="ed-q">${ans.map((x) => html`<li><span>${x.q}</span><b>${x.a}</b></li>`)}</ul>` : raw("")}</div>`;
}

// Where a lead came from, as a small coloured chip (Facebook, Instagram, Google Ads, Website...). The raw source stays in the tooltip.
function sourceInfo(l) {
  const raw = String(l.source || "").trim(), plat = (l.src && l.src.platform) || "";
  if (plat === "ig" || /instagram/i.test(raw)) return ["ig", "Instagram"];
  if (plat === "fb" || /facebook|meta/i.test(raw)) return ["fb", plat === "fb" || /facebook/i.test(raw) ? "Facebook" : "Meta Ads"];
  if (/google\s*ads|adwords/i.test(raw)) return ["gads", "Google Ads"];
  if (/google/i.test(raw)) return ["google", "Google"];
  if (/whatsapp/i.test(raw)) return ["wa", "WhatsApp"];
  if (/linkedin/i.test(raw)) return ["li", "LinkedIn"];
  if (/youtube/i.test(raw)) return ["yt", "YouTube"];
  if (/direct/i.test(raw)) return ["direct", "Direct"];
  if (!raw || /website/i.test(raw) || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw.replace(/^[a-z]+:\/\//i, "").replace(/[\/?#].*$/, ""))) return ["web", "Website"];
  return ["other", raw.length > 18 ? raw.slice(0, 17) + "…" : raw];
}
// Priority as stars: A = 3 stars (high), B = 2 (medium), C = 1 (low). Nothing when the lead has no priority.
function prioLevel(l) { const p = String((l && l.priority) || "").trim(); if (!p) return 0; if (/^a\b|high/i.test(p)) return 3; if (/^b\b|medium/i.test(p)) return 2; if (/^c\b|low/i.test(p)) return 1; return 0; }
function priorityChip(l) {
  const n = prioLevel(l); if (!n) return raw("");
  const name = ["", "Low", "Medium", "High"][n], star = (on) => `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" class="${on ? "on" : "off"}"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>`;
  return html`<span class="prio-c p${n}" title="${l.priority}" aria-label="${name} priority, ${n} of 3 stars"><span class="stars">${raw(star(true) + star(n > 1) + star(n > 2))}</span>${name}</span>`;
}
function sourceChip(l) { const [k, label] = sourceInfo(l); return html`<span class="src src-${k}" title="${l.source || "Website"}"><i></i>${label}</span>`; }
