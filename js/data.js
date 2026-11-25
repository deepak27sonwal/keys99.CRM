// Data layer. All CRM data lives in Supabase: leads are rows of `enquiries`,
// plus `site_visits` and `bookings`. Lead id shown in the CRM is "L-" + enquiries.id.
const CFG = window.KEYS99_CONFIG || {};
// only the columns the alert panels show (not whole rows) so the periodic refresh stays light
const ALERT_LEAD_COLS = "id,name,phone,project,status,follow_up,created_at,activities";
const Data = {
  configured: !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY),
  client: null,
  init() {
    if (this.configured && window.supabase) this.client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { global: { fetch: (u, o) => this._watchedFetch(u, o) } });
    this._listenOtherTabs();
    return this;
  },
  // ---- "something changed" signals: every successful write to leads, visits, bookings or tasks (from any button or dialog) tells the rest of the page
  // (alert icons, due counts) and every other open tab of the CRM, so a follow-up or site visit added in one place shows up everywhere without a reload.
  _watchedFetch(u, o) {
    return window.fetch(u, o).then((r) => {
      try {
        const m = String((o && o.method) || (u && u.method) || "GET").toUpperCase();
        if (r.ok && m !== "GET" && m !== "HEAD") {
          const url = String((u && u.url) || u), t = /\/rest\/v1\/(enquiries|site_visits|bookings|tasks|meetings)\b/.exec(url), rpc = /\/rest\/v1\/rpc\/(append_activity|transfer_leads)\b/.exec(url);
          if (t || rpc) this.noteChange(t && t[1] === "tasks" ? "task" : "lead");
        }
      } catch { /* never break a request because of the signal */ }
      return r;
    });
  },
  _tab: Math.random().toString(36).slice(2), _pend: new Set(), _chan: null,
  noteChange(kind) {
    this._pend.add(kind); clearTimeout(this._ct);
    this._ct = setTimeout(() => {
      const ks = [...this._pend]; this._pend.clear();
      ks.forEach((k) => window.dispatchEvent(new CustomEvent(k === "task" ? "k99:task-changed" : "k99:lead-changed")));
      try { if (this._chan) this._chan.postMessage({ from: this._tab, kinds: ks }); else localStorage.setItem("k99.change", JSON.stringify({ from: this._tab, kinds: ks, at: Date.now() })); } catch { /* signal only */ }
    }, 120);
  },
  _listenOtherTabs() {
    if (this._listening) return; this._listening = true;
    const got = (ks) => { (ks || []).forEach((k) => window.dispatchEvent(new CustomEvent(k === "task" ? "k99:task-changed" : "k99:lead-changed"))); window.dispatchEvent(new CustomEvent("k99:remote-changed")); };
    try { if ("BroadcastChannel" in window) { this._chan = new BroadcastChannel("k99-data"); this._chan.onmessage = (e) => { if (e.data && e.data.from !== this._tab) got(e.data.kinds); }; } } catch { this._chan = null; }
    window.addEventListener("storage", (e) => { if (e.key !== "k99.change" || !e.newValue) return; try { const v = JSON.parse(e.newValue); if (v.from !== this._tab) got(v.kinds); } catch { /* ignore */ } });
  },
  // A page registers how to reload itself; it runs when another tab (or a shell widget) changed data, never under an open dialog or in a hidden tab (it waits for you to come back).
  onRemote(fn) {
    let pending = false, running = false;
    const go = async () => {
      if (running) { pending = true; return; }
      if (document.hidden || document.querySelector(".overlay.open")) { pending = true; return; }
      running = true; pending = false; try { await fn(); } catch { /* keep what is shown */ }
      running = false; if (pending) setTimeout(go, 400);
    };
    window.addEventListener("k99:remote-changed", go);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && pending) go(); });
    setInterval(() => { if (pending && !document.hidden) go(); }, 3000);
  },
  async session() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    return data.session;
  },
  async signOut() {
    let failed = false;
    try { if (this.client) { const { error } = await this.client.auth.signOut(); failed = !!error; } } catch { failed = true; }
    if (failed) { try { Object.keys(localStorage).filter((k) => /^sb-.*-auth-token/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch { /* storage unavailable */ } }   // even if the server cannot be reached or refuses, leave this device signed out
    location.replace("login.html");
  },

  // PostgREST returns at most 1000 rows per request, so page through.
  async fetchAll(table, build, cols = "*") {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      let q = this.client.from(table).select(cols);
      if (build) q = build(q);
      const { data, error } = await q.order("id", { ascending: false }).range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  },

  fromRow(r) {
    const mgr = r.manager_name;
    const agent = typeof mgr === "string" ? mgr : Array.isArray(mgr) ? mgr.join(", ") : "";
    return {
      id: "L-" + r.id, dbId: r.id, name: r.name || "Unknown", mobile: r.phone || "", email: r.email || "",
      requirement: r.interest || "", budget: r.budget || "", project: r.project || "", developer: r.developer || "",
      location: r.location || "", agent, status: r.status || "New Leads", followUpTs: r.follow_up, followUp: fmtDate(r.follow_up),
      source: r.source || "Website", propertyType: r.property_type || "", bhk: r.bhk || "", priority: r.priority || "",
      notes: r.notes || "", lostReason: r.lost_reason || "", createdAt: r.created_at, acts: Array.isArray(r.activities) ? r.activities : [],
      touched: (r.status && r.status !== "New Leads") || !!r.follow_up || (Array.isArray(r.activities) && r.activities.some((a) => a && /@/.test(a.by || ""))),   // someone has worked on it (status moved, follow-up set, or a person logged something)
      src: { platform: r.meta_platform || "", page: r.meta_page_name || "", form: r.meta_form_name || "", formId: r.meta_form_id || "", campaignId: r.meta_campaign_id || "", campaign: r.meta_campaign_name || "", adset: r.meta_adset_name || "", ad: r.meta_ad_name || "",
        answers: r.meta_raw_data && Array.isArray(r.meta_raw_data.answers) ? r.meta_raw_data.answers.filter((x) => x && x.q && x.a) : [] },
    };
  },
  async getLeads() { return (await this.fetchAll("enquiries")).map((r) => this.fromRow(r)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); },
  async getLead(id) {
    const n = Number(String(id || "").replace(/^L-/, ""));
    let q = this.client.from("enquiries").select("*");
    q = Number.isInteger(n) && n > 0 ? q.eq("id", n) : q.order("created_at", { ascending: false }).limit(1);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data ? this.fromRow(data) : null;
  },
  // Every enquiry from the same phone number (repeat enquiries) plus their visits and bookings.
  async getCustomer(lead) {
    const { data, error } = await this.client.from("enquiries").select("*").eq("phone", lead.mobile).order("created_at", { ascending: true });
    if (error) throw error;
    const related = data.map((r) => this.fromRow(r));
    if (!related.some((r) => r.dbId === lead.dbId)) related.push(lead);
    const ids = related.map((r) => r.dbId);
    const [v, b] = await Promise.all([
      this.client.from("site_visits").select("*").in("enquiry_id", ids).order("visit_at", { ascending: false }),
      this.client.from("bookings").select("*").in("enquiry_id", ids).order("booking_date", { ascending: false }),
    ]);
    if (v.error) throw v.error;
    if (b.error) throw b.error;
    return { related, visits: v.data, bookings: b.data };
  },
  async getSiteVisits() { return this.fetchAll("site_visits"); },
  async getBookings() { return this.fetchAll("bookings"); },

  async updateLead(dbId, p) {
    const m = { status: "status", followUp: "follow_up", budget: "budget", location: "location", propertyType: "property_type",
      bhk: "bhk", priority: "priority", notes: "notes", lostReason: "lost_reason", agent: "manager_name" };
    const row = {};
    for (const [k, col] of Object.entries(m)) if (k in p) row[col] = p[k] === "" ? null : p[k];
    if ("agentEmail" in p) row.manager_email = p.agentEmail || null;          // keep the lead's email alert address in step with the person
    const { error } = await this.client.from("enquiries").update(row).eq("id", dbId);
    if (error) throw error;
  },
  // Schedule (or clear) the next follow-up; an optional note is saved as an activity so it shows on the card.
  async scheduleFollowUp(lead, followUp, note) {
    const { error } = await this.client.from("enquiries").update({ follow_up: followUp }).eq("id", lead.dbId);
    if (error) throw error;
    if (note) { const s = await this.session(); await this.appendActivity(lead.dbId, { type: "call", title: "Follow-up scheduled", description: note, at: new Date().toISOString(), by: s ? s.user.email : "", due: followUp }); }
  },
  // Adds ONE entry to a lead's timeline inside the database, so a newer note from someone else is never overwritten by this page's older copy.
  async appendActivity(dbId, act) { const { error } = await this.client.rpc("append_activity", { p_id: dbId, p_act: act }); if (error) throw error; },
  // Most recent thing that happened on a lead: a note, a follow-up note or, failing that, the enquiry itself.
  lastActivity(l) {
    const acts = l.acts.filter((a) => a && a.at && a.description).sort((a, b) => new Date(b.at) - new Date(a.at));
    const a = acts[0];
    if (a) return { label: a.title === "Follow-up scheduled" ? "Follow-up note" : a.title === "Note" ? "Last note" : "Last activity", text: a.description, at: a.at, by: a.by || "", icon: a.title === "Follow-up scheduled" ? "phone-call" : "message-square-text" };
    if (l.notes) return { label: "Note", text: l.notes, at: l.createdAt, by: "", icon: "message-square-text" };
    return { label: "Enquiry received", text: "From " + l.source + (l.project ? " for " + l.project : ""), at: l.createdAt, by: "", icon: "inbox" };
  },
  async addActivity(lead, title, description) {
    const s = await this.session();
    await this.appendActivity(lead.dbId, { type: "doc", title, description, at: new Date().toISOString(), by: s ? s.user.email : "" });
  },
  async addNote(lead, text) {
    const s = await this.session();
    await this.appendActivity(lead.dbId, { type: "doc", title: "Note", description: text, at: new Date().toISOString(), by: s ? s.user.email : "" });
  },
  async addLead(f) {
    const { error } = await this.client.from("enquiries").insert({
      name: f.name, phone: f.mobile, email: f.email || null, interest: f.requirement || null, budget: f.budget || null,
      project: f.project || null, developer: f.developer || null, location: f.location || null, property_type: f.property_type || null, bhk: f.bhk || null, source: f.source || null, status: f.status || "New Leads",
      ...(window.ME && window.ME.role === "employee" && window.ME.member ? { manager_name: window.ME.member.name, manager_email: window.ME.member.email || null } : {}),   // an employee's new lead is always theirs
    });
    if (error) throw error;
  },
  async addSiteVisit(v) {
    const s = await this.session();
    const { error } = await this.client.from("site_visits").insert({ ...v, created_by: s ? s.user.email : null });
    if (error) throw error;
  },
  async userEmail() { const s = await this.session(); return s ? s.user.email : ""; },
  async getSiteVisit(id) {
    const { data, error } = await this.client.from("site_visits").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  // Changing a visit's status also stamps the workflow step and adds an entry to the visit's activity log.
  async visitStatusPatch(v, status) {
    const t = new Date().toISOString(), by = await this.userEmail(), p = { status };
    if (status === "Confirmed") p.confirmed_at = v.confirmed_at || t;
    if (status === "Completed") { p.completed_at = t; p.visited_at = v.visited_at || t; p.confirmed_at = v.confirmed_at || t; }
    const text = { Confirmed: "Visit confirmed", Completed: "Site visit completed", Cancelled: "Site visit cancelled" }[status];
    if (text) p.timeline = [...(v.timeline || []), { t, text, kind: status === "Cancelled" ? "cancel" : "done", by }];
    return p;
  },
  async logVisit(v, text, kind = "note") {
    return { timeline: [...(v.timeline || []), { t: new Date().toISOString(), text, kind, by: await this.userEmail() }] };
  },

  // ---- visit documents & photos (private storage bucket "visit-files") ----
  FILE_TYPES: ["application/pdf", "image/jpeg", "image/png", "image/webp"], FILE_MAX: 10 * 1024 * 1024,
  async listVisitFiles(id) {
    const { data, error } = await this.client.storage.from("visit-files").list(`visits/${id}`, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    return (data || []).filter((f) => f.name && f.id !== null).map((f) => ({ path: `visits/${id}/${f.name}`, name: f.name.replace(/^\d+-/, ""), size: (f.metadata && f.metadata.size) || 0, type: (f.metadata && f.metadata.mimetype) || "", at: f.created_at }));
  },
  async uploadVisitFile(id, file) {
    if (!this.FILE_TYPES.includes(file.type)) throw new Error(`"${file.name}" is not allowed. Use PDF, JPG, PNG or WebP.`);
    if (file.size > this.FILE_MAX) throw new Error(`"${file.name}" is larger than 10 MB.`);
    const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80), path = `visits/${id}/${Date.now()}-${safe}`;
    const { error } = await this.client.storage.from("visit-files").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  },
  async removeVisitFile(path) { const { error } = await this.client.storage.from("visit-files").remove([path]); if (error) throw error; },
  async signedUrls(paths) {
    if (!paths.length) return {};
    const { data, error } = await this.client.storage.from("visit-files").createSignedUrls(paths, 3600);
    if (error) throw error;
    return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  },
  // ---- social media integrations (leads arrive via the capture-lead Edge Function) ----
  // ---- who is signed in, logins and tasks ----
  // null = signed in but no access row yet. role is "admin" or "employee"; employees carry their team-member row.
  // Me plus everyone who reports to me, directly or further down (rows from the my_team() function); empty for people with nobody under them.
  async getMyTeam() { const { data, error } = await this.client.rpc("my_team"); if (error) throw error; return data || []; },
  async getMe(sess) {
    const { data: au, error } = await this.client.from("app_users").select("role,member_id,active").eq("user_id", sess.user.id).maybeSingle();
    if (error) throw error;
    if (!au) return null;
    let member = null;
    if (au.member_id) { const { data } = await this.client.from("team_members").select("*").eq("id", au.member_id).maybeSingle(); member = data || null; }
    return { role: au.role, active: au.active !== false, memberId: au.member_id, member, avatarPath: (sess.user.user_metadata || {}).avatar_path || (member && member.avatar_path) || "", mustChange: !!(sess.user.user_metadata && sess.user.user_metadata.must_change_password) };
  },
  async changePassword(pw) { const { error } = await this.client.auth.updateUser({ password: pw, data: { must_change_password: false } }); if (error) throw error; },
  // ---- my profile: photo, mobile number and the emailed one-time code for a new password ----
  // Resizes the picked picture to a 400px square JPEG in the browser, so uploads stay small whatever the phone camera produced.
  async squarePhoto(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPG, PNG or WebP picture.");
    if (file.size > 12 * 1024 * 1024) throw new Error("That picture is too large (12 MB max).");
    const bmp = await createImageBitmap(file), side = Math.min(bmp.width, bmp.height), c = document.createElement("canvas"); c.width = c.height = 400;
    c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 400, 400);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86)); if (!blob) throw new Error("Could not read that picture.");
    return blob;
  },
  async saveMyProfile({ phone, photo, removePhoto }) {
    const s = await this.session(); if (!s) throw new Error("Sign in first");
    const meta = s.user.user_metadata || {}, old = meta.avatar_path || "";
    let path = removePhoto ? null : old || null;
    if (photo) { path = `${s.user.id}/avatar-${Date.now()}.jpg`; const { error } = await this.client.storage.from("avatars").upload(path, photo, { contentType: "image/jpeg", upsert: false }); if (error) throw error; }
    if (window.ME && window.ME.memberId) { const { error } = await this.client.rpc("update_my_profile", { p_phone: phone, p_avatar: photo ? path : null, p_keep_avatar: !removePhoto }); if (error) throw error; }
    if (photo || removePhoto) { const { error } = await this.client.auth.updateUser({ data: { avatar_path: path } }); if (error) throw error; if (old && old !== path) this.client.storage.from("avatars").remove([old]).catch(() => {}); }
    return path;
  },
  // emails a 6-digit code (and the usual link); the "Reset password" email template carries both
  async sendResetCode(email) { const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: new URL("reset.html", location.href).href }); if (error) throw error; },
  async verifyResetCode(email, token) { const { error } = await this.client.auth.verifyOtp({ email, token: String(token).replace(/\s+/g, ""), type: "recovery" }); if (error) throw error; },
  // ---- active hours (the tracker adds one minute at a time; reports are limited by the database to my own rows, or everyone's for admins) ----
  async recordActive() { const { error } = await this.client.rpc("record_active_minute"); if (error) throw error; },
  async getActiveTime(from, to, userId = null) {
    // the server answers at most 1000 rows at a time, so page until everything has arrived (the report is ordered, so pages never overlap)
    const out = [];
    for (let at = 0; at < 100000; at += 1000) {
      const { data, error } = await this.client.rpc("active_time_report", { p_from: from, p_to: to, p_user: userId }).range(at, at + 999); if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out.map((r) => ({ userId: r.user_id, memberId: r.member_id, name: r.name || "—", team: r.team || "", role: r.role, day: String(r.day).slice(0, 10), minutes: Number(r.minutes) || 0, lastAt: r.last_at }));
  },
  async getLogins() { const { data, error } = await this.client.from("app_users").select("user_id,role,member_id,active").limit(2000); if (error) throw error; return data || []; },
  // Create / reset / disable / enable / remove a team member's login (runs on the server and only for admins).
  async loginAdmin(body) {
    const s = await this.session(); if (!s) throw new Error("Sign in first");
    const r = await fetch(`${CFG.SUPABASE_URL}/functions/v1/employee-admin`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + s.access_token, apikey: CFG.SUPABASE_ANON_KEY }, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch { /* not json */ }
    if (!r.ok || !j.ok) throw new Error(j.error || "Request failed (" + r.status + ")");
    return j;
  },
  async getTasks() { return this.fetchAll("tasks"); },
  async addTask(t) {
    const { error } = await this.client.from("tasks").insert({ title: t.title, notes: t.notes || null, due_at: t.due_at || null, assigned_to: t.assigned_to, enquiry_id: t.enquiry_id || null, type: t.type || "Other", priority: t.priority || "Medium" });
    if (error) throw error;
  },
  async updateTask(id, patch) { const { error } = await this.client.from("tasks").update(patch).eq("id", id); if (error) throw error; },
  async deleteTask(id) { const { error } = await this.client.from("tasks").delete().eq("id", id); if (error) throw error; },
  // ---- daily workflow: waiting time, repeat enquiries, call logging, WhatsApp templates ----
  // minutes a brand-new lead has gone untouched (null when someone already worked on it)
  waiting(l) { return l.status === "New Leads" && !l.touched ? Math.max(0, (Date.now() - new Date(l.createdAt)) / 60000) : null; },
  // Finds the lead behind a number whatever its stored format ("+91 98765 43210", "98765-43210"); the wildcard pattern lets any separators sit between the digits.
  async findLeadByPhone(phone) {
    const d = digits(phone).slice(-10); if (d.length < 10) return null;
    const { data, error } = await this.client.from("enquiries").select("*").ilike("phone", "%" + d.split("").join("%") + "%").order("created_at", { ascending: false }).limit(50);
    if (error || !data || !data.length) return null;
    const hit = data.find((r) => digits(r.phone).slice(-10) === d); return hit ? this.fromRow(hit) : null;
  },
  async phoneMatches(phone, project, email) {
    const em = String(email || "").trim(), pj = String(project || "").trim();
    // phone and/or email, and optionally the project; the database counts a repeat by the same phone OR the same email
    const args = em || pj ? { p_phone: phone || "", p_project: pj, p_email: em } : { p_phone: phone };
    const { data, error } = await this.client.rpc("phone_matches", args); if (error) throw error; return (data && data[0]) || null;
  },

  async getTemplates() { const { data, error } = await this.client.from("message_templates").select("*").order("id").limit(200); if (error) return []; return data || []; },
  async saveTemplate(id, t) {
    const row = { title: String(t.title || "").trim(), body: String(t.body || "").trim() }; if (!row.title || !row.body) throw new Error("Title and message are required");
    const { error } = await (id ? this.client.from("message_templates").update(row).eq("id", id) : this.client.from("message_templates").insert(row)); if (error) throw error; this._tpl = null;
  },
  async deleteTemplate(id) { const { error } = await this.client.from("message_templates").delete().eq("id", id); if (error) throw error; this._tpl = null; },
  async templatesCached() { if (!this._tpl) this._tpl = await this.getTemplates(); return this._tpl; },
  // follow-ups and tasks that are due (for reminders and the sidebar badge)
  async getDue(untilIso) {
    const f = await this.client.from("enquiries").select("id,name,follow_up,status").not("follow_up", "is", null).lte("follow_up", untilIso).not("status", "in", "(Spam,Booking Done,Booking Cancelled,Post Sale)").order("follow_up").limit(100);
    const t = await this.client.from("tasks").select("id,title,due_at").is("done_at", null).not("due_at", "is", null).lte("due_at", untilIso).order("due_at").limit(100);
    return { followUps: f.error ? [] : f.data || [], tasks: t.error ? [] : t.data || [] };
  },
  async getIntegrations() {
    const { data, error } = await this.client.from("integrations").select("*").order("created_at");
    if (error) throw error;
    return data;
  },
  // ---- notifications (bell): recent leads, per-person read state, browser push subscriptions
  async getRecentLeads(n = 30) { const { data, error } = await this.client.from("enquiries").select("id,name,project,source,manager_name,meta_platform,created_at").order("created_at", { ascending: false }).limit(n); if (error) throw error; return data || []; },
  // untouched new leads past the alert time (shown in the bell); follow-ups and tasks have their own alert icons
  async getAttention() {
    const cut = new Date(Date.now() - WAIT_ALERT_MIN * 60000).toISOString();
    // every matching row (paged 1000 at a time), so the count is the true backlog; a failed query throws, so the caller keeps what it last showed
    const a = await this.fetchAll("enquiries", (q) => q.eq("status", "New Leads").lte("created_at", cut), ALERT_LEAD_COLS);
    return { waiting: a.map((r) => this.fromRow(r)).filter((l) => this.waiting(l) !== null).sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt)) };
  },
  // follow-ups and manual tasks due by the end of today (overdue ones included), for the two alert icons
  async getFollowUpAlerts() {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const r = await this.fetchAll("enquiries", (q) => q.not("follow_up", "is", null).lte("follow_up", end.toISOString()).not("status", "in", "(Spam,Booking Done,Booking Cancelled,Post Sale)"), ALERT_LEAD_COLS);
    return r.map((x) => this.fromRow(x)).sort((x, y) => new Date(x.followUpTs) - new Date(y.followUpTs));
  },
  async getTaskAlerts() {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const r = await this.fetchAll("tasks", (q) => q.is("done_at", null).not("due_at", "is", null).lte("due_at", end.toISOString()), "id,title,type,due_at,enquiry_id");
    return r.sort((x, y) => new Date(x.due_at) - new Date(y.due_at));
  },
  // What needs a reporting manager's attention in their team (one call; the database answers only for the signed-in manager and returns { manager: false } for everyone else).
  async getManagerAlerts() { const { data, error } = await this.client.rpc("manager_alerts"); if (error) throw error; return data || { manager: false }; },
  async getPrefs() { const { data, error } = await this.client.from("user_prefs").select("*").limit(1).maybeSingle(); if (error) throw error; return data; },
  async savePrefs(p) { const s = await this.session(); if (!s) return; const { error } = await this.client.from("user_prefs").upsert({ ...p, user_id: s.user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" }); if (error) throw error; },
  async savePushSub(sub) { const s = await this.session(); const { error } = await this.client.from("push_subscriptions").upsert({ ...sub, user_id: s.user.id }, { onConflict: "endpoint" }); if (error) throw error; },
  async deletePushSub(endpoint) { const { error } = await this.client.from("push_subscriptions").delete().eq("endpoint", endpoint); if (error) throw error; },
  async getMetaForms() { const { data, error } = await this.client.from("meta_forms").select("*").order("form_id").limit(1000); if (error) throw error; return data || []; },   // no "id" column here, so not fetchAll
  async getIntegrationEvents(sinceIso) { return this.fetchAll("integration_events", (q) => q.gte("received_at", sinceIso)); },
  captureUrl(id) { return `${CFG.SUPABASE_URL}/functions/v1/capture-lead?i=${id}`; },
  // Creates the integration and returns the secret ONCE; only its hash is stored.
  async createIntegration(platform) {
    const secret = randomSecret(), by = await this.userEmail();
    const { data, error } = await this.client.from("integrations").insert({ platform, secret_hash: await sha256Hex(secret), created_by: by }).select().single();
    if (error) throw error;
    return { row: data, secret };
  },
  async rotateSecret(id) {
    const secret = randomSecret();
    const { error } = await this.client.from("integrations").update({ secret_hash: await sha256Hex(secret) }).eq("id", id);
    if (error) throw error;
    return secret;
  },
  async updateIntegration(id, patch) { const { error } = await this.client.from("integrations").update(patch).eq("id", id); if (error) throw error; },
  async deleteIntegration(id) { const { error } = await this.client.from("integrations").delete().eq("id", id); if (error) throw error; },
  // Calls the Edge Function as the signed-in user: dry-run tests and private token management only.
  async captureCall(id, { test = false, action = "", body = {} } = {}) {
    const s = await this.session(), u = new URL(this.captureUrl(id));
    if (test) u.searchParams.set("test", "1");
    if (action) u.searchParams.set("action", action);
    try {
      const res = await fetch(u, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + s.access_token }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => null);
      return j || { ok: false, error: `Unexpected response (${res.status})` };
    } catch { return { ok: false, error: "Could not reach the capture service. Check your connection." }; }
  },
  // ---- team: agents and relationship managers (leads are matched to them by the name in enquiries.manager_name)
  // ---- calendar: holidays and meetings ----
  async getHolidays() { try { return (await this.fetchAll("holidays")).sort((a, b) => a.starts_on.localeCompare(b.starts_on)); } catch { return []; } },     // paged: PostgREST returns at most 1000 rows per request
  async holidaysCached() { if (!this._hol) this._hol = await this.getHolidays(); return this._hol; },
  async saveHoliday(id, h) {
    const row = { name: String(h.name || "").trim(), starts_on: h.starts_on, ends_on: h.ends_on || h.starts_on, kind: h.kind || "Public", notes: String(h.notes || "").trim() || null };
    if (!row.name || !row.starts_on) throw new Error("Name and date are required"); if (row.ends_on < row.starts_on) throw new Error("The last day cannot be before the first day");
    const { error } = await (id ? this.client.from("holidays").update(row).eq("id", id) : this.client.from("holidays").insert(row));
    if (error) throw new Error(error.code === "23505" ? "A holiday with this name already starts on that date" : error.message); this._hol = null;
  },
  async addHolidays(rows) { let added = 0; for (const r of rows) { try { await this.saveHoliday(null, r); added++; } catch { /* already there */ } } this._hol = null; return added; },
  async deleteHoliday(id) { const { error } = await this.client.from("holidays").delete().eq("id", id); if (error) throw error; this._hol = null; },
  async getMeetings() { try { return (await this.fetchAll("meetings")).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)); } catch { return []; } },
  async saveMeeting(id, m) { const { error } = await (id ? this.client.from("meetings").update(m).eq("id", id) : this.client.from("meetings").insert(m)); if (error) throw new Error(error.message); },
  async deleteMeeting(id) { const { error } = await this.client.from("meetings").delete().eq("id", id); if (error) throw error; },
  // ---- transferring leads to another team member (the rules are enforced in the database) ----
  async getTransferTargets() { const { data, error } = await this.client.rpc("transfer_targets"); if (error) throw new Error(error.message); return data || []; },
  async transferLeads(ids, memberId, note) { const { data, error } = await this.client.rpc("transfer_leads", { p_ids: ids, p_member_id: memberId, p_note: note || null }); if (error) throw new Error(error.message); return Number(data) || 0; },
  // ---- master lists (Settings): teams, departments, cities, localities ----
  async getMasters() {
    const get = async (t) => { const { data, error } = await this.client.from(t).select("*").order("name").limit(5000); return error ? [] : data || []; };   // a missing table or no access just means "no list yet"
    const [teams, departments, cities, localities, designations] = await Promise.all(["teams", "departments", "cities", "localities", "designations"].map(get));
    return (this._masters = { teams, departments, cities, localities, designations });
  },
  async mastersCached() { return this._masters || this.getMasters(); },
  // rows: [{ name, city_id? }]; the database refuses duplicates (ignoring case), those are reported back instead of failing the batch
  async addMasters(table, rows) {
    let added = 0, dup = 0;
    for (const r of rows) { const { error } = await this.client.from(table).insert(r); if (!error) added++; else if (error.code === "23505") dup++; else throw error; }
    this._masters = null; return { added, dup };
  },
  async renameMaster(table, id, name) {
    const { error } = await this.client.from(table).update({ name }).eq("id", id);
    if (error) throw new Error(error.code === "23505" ? "That name already exists" : error.message);
    this._masters = null;
  },
  async deleteMaster(table, id) { const { error } = await this.client.from(table).delete().eq("id", id); if (error) throw error; this._masters = null; },
  // after a rename, team members / projects that hold the old exact text follow the new name
  // spec entries: [table, column, optionalFilterColumn, optionalFilterValue]
  async cascadeRename(spec, from, to) {
    for (const [table, col, wc, wv] of spec) { let q = this.client.from(table).update({ [col]: to }).eq(col, from); if (wc) q = q.eq(wc, wv); const { error } = await q; if (error) throw error; }
    this._team = null;
  },
  async getTeam() { return this.fetchAll("team_members"); },
  async getTeamCached() { if (!this._team) this._team = await this.getTeam(); return this._team; },
  teamRow(f) {
    return { kind: f.kind === "rm" ? "rm" : "agent", name: String(f.name || "").trim(), phone: digits(f.phone) ? String(f.phone).trim() : null, email: String(f.email || "").trim().toLowerCase() || null,
      designation: String(f.designation || "").trim() || null, team: String(f.team || "").trim() || null, department: String(f.department || "").trim() || null, location: String(f.location || "").trim() || null, locality: String(f.locality || "").trim() || null,
      monthly_target: Math.max(0, Number(f.monthly_target) || 0), daily_cap: Number(f.daily_cap) > 0 ? Math.floor(Number(f.daily_cap)) : null, joined_on: f.joined_on || null,
      projects: [...new Set((Array.isArray(f.projects) ? f.projects : []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 40), status: f.status === "Inactive" ? "Inactive" : "Active",
      ...("reports_to" in f ? { reports_to: Number(f.reports_to) > 0 ? Number(f.reports_to) : null } : {}) };      // only touched when the form sends it
  },
  async saveMember(id, f) {
    const row = this.teamRow(f), s = await this.session();
    const q = id ? this.client.from("team_members").update(row).eq("id", id) : this.client.from("team_members").insert({ ...row, created_by: s ? s.user.id : null });
    this._team = null;
    const { error } = await q;
    if (error) throw new Error(error.code === "23505" ? "A team member with this name already exists" : error.message);
  },
  // ---- automatic lead assignment (switch lives in app_settings; the rule runs in the database when a lead is saved)
  async getAutoAssign() { const { data, error } = await this.client.from("app_settings").select("value").eq("key", "auto_assign").maybeSingle(); if (error) throw error; return !!(data && data.value === true); },
  async setAutoAssign(on) { const { error } = await this.client.from("app_settings").update({ value: !!on, updated_at: new Date().toISOString() }).eq("key", "auto_assign"); if (error) throw error; },
  async whoGetsNext(project) { const { data, error } = await this.client.rpc("assignee_for", { p_project: project || "" }); if (error) throw error; return (data && data[0]) || null; },
  async setMemberStatus(id, status) { this._team = null; const { error } = await this.client.from("team_members").update({ status }).eq("id", id); if (error) throw error; },
  // ---- registered developers and projects (the Property pages); leads still point to them by name
  async getDevelopers() { return this.fetchAll("developers"); },
  async getProjects() { return this.fetchAll("projects"); },
  // Registered project and developer names for pick lists (cached for 5 minutes; a failed read just gives empty lists so the fields stay free text).
  async getPropertyNames() {
    if (this._props && Date.now() - this._props.at < 300000) return this._props;
    let projects = [], developers = [];
    try { const [p, dv] = await Promise.all([this.getProjects(), this.getDevelopers()]); projects = p.filter((x) => x.name).map((x) => ({ name: x.name, developer: x.developer || "" })); developers = dv.map((x) => x.name).filter(Boolean); }
    catch { /* free-text fallback */ }
    const uniq = (a) => [...new Set(a)].sort((x, y) => x.localeCompare(y));
    this._props = { at: Date.now(), projects: projects.sort((a, b) => a.name.localeCompare(b.name)), developers: uniq([...developers, ...projects.map((p) => p.developer).filter(Boolean)]) };
    return this._props;
  },
  async saveProperty(table, id, row) {
    const clean = {}; Object.entries(row).forEach(([k, v]) => (clean[k] = typeof v === "string" ? (v.trim() || null) : v));
    if (!clean.name) throw new Error("Name is required");
    const s = await this.session();
    const q = id ? this.client.from(table).update(clean).eq("id", id) : this.client.from(table).insert({ ...clean, created_by: s ? s.user.email : null });
    const { error } = await q;
    if (error) throw new Error(error.code === "23505" ? "That " + (table === "projects" ? "project" : "developer") + " already exists" : error.message);
  },
  // ---- project lead distribution: connected forms / campaigns, team members per project, who-gets-next preview
  async getProjectSources() { return this.fetchAll("project_sources"); },
  async getProjectMembers() { const { data, error } = await this.client.from("project_members").select("*").limit(5000); if (error) throw error; return data; },
  async connectSources(projectId, items) {
    if (!items.length) return;
    const s = await this.session(), rows = items.map((x) => ({ project_id: projectId, kind: x.kind, ref_id: String(x.ref_id), label: x.label || null, created_by: s ? s.user.email : null }));
    const { error } = await this.client.from("project_sources").upsert(rows, { onConflict: "kind,ref_id" });   // a form can belong to one project only: connecting it here moves it
    if (error) throw error;
  },
  async disconnectSource(id) { const { error } = await this.client.from("project_sources").delete().eq("id", id); if (error) throw error; },
  async setProjectMembers(projectId, memberIds, patch = {}) {
    if (!memberIds.length) return;
    const { error } = await this.client.from("project_members").upsert(memberIds.map((m) => ({ project_id: projectId, member_id: m, ...patch })), { onConflict: "project_id,member_id" });
    if (error) throw error;
  },
  async removeProjectMember(projectId, memberId) { const { error } = await this.client.from("project_members").delete().eq("project_id", projectId).eq("member_id", memberId); if (error) throw error; },
  async countUnrouted(forms, campaigns) { const { data, error } = await this.client.rpc("count_unrouted", { p_forms: forms, p_campaigns: campaigns }); if (error) throw error; return Number(data) || 0; },
  async applyToPastLeads(projectId) { const { data, error } = await this.client.rpc("connect_apply_existing", { p_project_id: projectId }); if (error) throw error; return Number(data) || 0; },
  async previewAssignee(project) { const { data, error } = await this.client.rpc("assignee_detail", { p_project: project || "" }); if (error) throw error; return (data && data[0]) || null; },
  async retargetProjects(ids, developer) { const { error } = await this.client.from("projects").update({ developer }).in("id", ids); if (error) throw error; },
  async deleteProperty(table, id) { const { error } = await this.client.from(table).delete().eq("id", id); if (error) throw error; },
  async deleteMember(id) { this._team = null; const { error } = await this.client.from("team_members").delete().eq("id", id); if (error) throw error; },
  async updateSiteVisit(id, patch) {
    const { error } = await this.client.from("site_visits").update(patch).eq("id", id);
    if (error) throw error;
  },
  async addBooking(b) {
    const s = await this.session();
    const { error } = await this.client.from("bookings").insert({ ...b, created_by: s ? s.user.email : null });
    if (error) throw error;
  },
};
Data.init();
