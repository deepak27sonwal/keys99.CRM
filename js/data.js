// Data layer. All CRM data lives in Supabase: leads are rows of `enquiries`,
// plus `site_visits` and `bookings`. Lead id shown in the CRM is "L-" + enquiries.id.
const CFG = window.KEYS99_CONFIG || {};
const Data = {
  configured: !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY),
  client: null,
  init() {
    if (this.configured && window.supabase) this.client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    return this;
  },
  async session() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    return data.session;
  },
  async signOut() { if (this.client) await this.client.auth.signOut(); location.replace("login.html"); },

  // PostgREST returns at most 1000 rows per request, so page through.
  async fetchAll(table, build) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      let q = this.client.from(table).select("*");
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
    const { error } = await this.client.from("enquiries").update(row).eq("id", dbId);
    if (error) throw error;
  },
  // Schedule (or clear) the next follow-up; an optional note is saved as an activity so it shows on the card.
  async scheduleFollowUp(lead, followUp, note) {
    const row = { follow_up: followUp };
    if (note) {
      const s = await this.session();
      row.activities = [...lead.acts, { type: "call", title: "Follow-up scheduled", description: note, at: new Date().toISOString(), by: s ? s.user.email : "", due: followUp }];
    }
    const { error } = await this.client.from("enquiries").update(row).eq("id", lead.dbId);
    if (error) throw error;
  },
  // Most recent thing that happened on a lead: a note, a follow-up note or, failing that, the enquiry itself.
  lastActivity(l) {
    const acts = l.acts.filter((a) => a && a.at && a.description).sort((a, b) => new Date(b.at) - new Date(a.at));
    const a = acts[0];
    if (a) return { label: a.title === "Follow-up scheduled" ? "Follow-up note" : a.title === "Note" ? "Last note" : "Last activity", text: a.description, at: a.at, by: a.by || "", icon: a.title === "Follow-up scheduled" ? "phone-call" : "message-square-text" };
    if (l.notes) return { label: "Note", text: l.notes, at: l.createdAt, by: "", icon: "message-square-text" };
    return { label: "Enquiry received", text: "From " + l.source + (l.project ? " for " + l.project : ""), at: l.createdAt, by: "", icon: "inbox" };
  },
  async addNote(lead, text) {
    const s = await this.session();
    const acts = [...lead.acts, { type: "doc", title: "Note", description: text, at: new Date().toISOString(), by: s ? s.user.email : "" }];
    const { error } = await this.client.from("enquiries").update({ activities: acts }).eq("id", lead.dbId);
    if (error) throw error;
  },
  async addLead(f) {
    const { error } = await this.client.from("enquiries").insert({
      name: f.name, phone: f.mobile, email: f.email || null, interest: f.requirement || null, budget: f.budget || null,
      project: f.project || null, developer: f.developer || null, location: f.location || null, source: f.source || null, status: f.status || "New Leads",
    });
    if (error) throw error;
  },
  async addSiteVisit(v) {
    const s = await this.session();
    const { error } = await this.client.from("site_visits").insert({ ...v, created_by: s ? s.user.email : null });
    if (error) throw error;
  },
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
