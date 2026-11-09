// Data layer: Supabase when configured, in-memory demo data otherwise.
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
  async signOut() { if (this.client) await this.client.auth.signOut(); location.href = "login.html"; },

  // Leads live in the existing `enquiries` table (the landing-page form writes there too).
  // Lead id shown in the CRM is "L-" + enquiries.id.
  fromRow(r) {
    const mgr = r.manager_name;
    const agent = typeof mgr === "string" ? mgr : mgr ? JSON.stringify(mgr).replace(/[\[\]"]/g, "") : "";
    return {
      id: "L-" + r.id, dbId: r.id, name: r.name || "Unknown", mobile: r.phone || "", email: r.email || "",
      requirement: r.interest || "", budget: r.budget || "", project: r.project || "", developer: r.developer || "",
      location: r.location || "", agent, status: r.status || "New", followUp: fmtDate(r.follow_up),
      source: r.source || "Website", propertyType: r.property_type || "", bhk: r.bhk || "", priority: r.priority || "",
      notes: r.notes || "", createdAt: r.created_at, acts: Array.isArray(r.activities) ? r.activities : [],
    };
  },
  async getLeads() {
    if (!this.client) return DEMO.leads;
    const { data, error } = await this.client.from("enquiries").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return data.map((r) => this.fromRow(r));
  },
  async getLead(id) {
    if (!this.client) return DEMO.leads.find((l) => l.id === id) || DEMO.leads[0];
    let q = this.client.from("enquiries").select("*");
    if (id) {
      const n = Number(String(id).replace(/^L-/, ""));
      if (!Number.isInteger(n)) return null;
      q = q.eq("id", n);
    } else q = q.order("created_at", { ascending: false }).limit(1);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data ? this.fromRow(data) : null;
  },
  // Timeline = notes logged in enquiries.activities + the original enquiry.
  async getActivities(lead) {
    if (!this.client) return DEMO.profile.timeline;
    const logged = lead.acts.map((a) => ({ type: a.type || "call", title: a.title || "Activity", description: a.description || "", at: fmtDate(a.at), by: a.by ? "by " + a.by : "", ts: a.at }));
    const created = { type: "new", title: "Lead Created", description: "Enquiry received from " + lead.source + (lead.project ? " for " + lead.project : "") + ".", at: fmtDate(lead.createdAt), by: "", ts: lead.createdAt };
    return [...logged, created].sort((x, y) => new Date(y.ts) - new Date(x.ts));
  },
  async addLead(f) {
    if (!this.client) {
      const id = "L-" + (28652 + DEMO.leads.length);
      DEMO.leads.unshift({ id, followUp: "—", propertyType: "Residential", bhk: "", agent: "—", ...f });
      return;
    }
    const { error } = await this.client.from("enquiries").insert({
      name: f.name, phone: f.mobile, email: f.email || null, interest: f.requirement || null, budget: f.budget || null,
      project: f.project || null, location: f.location || null, source: f.source || null, status: f.status || "New",
    });
    if (error) throw error;
  },
};
Data.init();
