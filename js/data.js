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

  fromRow(r) {
    return {
      id: r.lead_code, name: r.name, mobile: r.mobile || "", email: r.email || "", requirement: r.requirement || "",
      budget: r.budget || "", project: r.project || "", location: r.location || "", agent: r.agent || "",
      status: r.status, followUp: fmtDate(r.follow_up), source: r.source || "", propertyType: r.property_type || "",
      bhk: r.bhk || "", priority: r.priority || "", notes: r.notes || "", createdAt: r.created_at, uuid: r.id,
    };
  },
  async getLeads() {
    if (!this.client) return DEMO.leads;
    const { data, error } = await this.client.from("leads").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return data.map((r) => this.fromRow(r));
  },
  async getLead(id) {
    if (!this.client) return DEMO.leads.find((l) => l.id === id) || DEMO.leads[0];
    let q = this.client.from("leads").select("*");
    q = id ? q.eq("lead_code", id) : q.order("created_at", { ascending: false }).limit(1);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data ? this.fromRow(data) : null;
  },
  async getActivities(lead) {
    if (!this.client) return DEMO.profile.timeline;
    const { data, error } = await this.client.from("activities").select("*").eq("lead_id", lead.uuid).order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((a) => ({ type: a.type, title: a.title, description: a.description || "", at: fmtDate(a.created_at), by: a.created_by ? "by " + a.created_by : "" }));
  },
  async addLead(f) {
    if (!this.client) {
      const id = "L-" + (28652 + DEMO.leads.length);
      DEMO.leads.unshift({ id, followUp: "—", propertyType: "Residential", bhk: "", agent: "—", ...f });
      return;
    }
    const { error } = await this.client.from("leads").insert({
      name: f.name, mobile: f.mobile, email: f.email, requirement: f.requirement, budget: f.budget,
      project: f.project, location: f.location, source: f.source, status: f.status, agent: f.agent || null,
    });
    if (error) throw error;
  },
};
Data.init();
