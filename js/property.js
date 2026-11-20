// Projects and Developers: the same page for both, built from what your leads, site visits and bookings already say.
// Every project / developer is a card with its funnel and results; click one to open its details panel; search, filter and sort live.
async function mountPropertyPage(kind) {
  const isProj = kind === "project", KEY = isProj ? "projects" : "developers", NOUN = isProj ? "Project" : "Developer";
  const page = await mountShell(KEY);
  if (!page) return;
  const RANGES = { all: "All time", today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month" };
  const SORTS = { leads: "Most leads", conv: "Best conversion", book: "Most bookings", comm: "Most commission", recent: "Latest lead", name: "Name A–Z" };
  const state = { leads: [], visits: [], bookings: [], regProj: [], regDev: [], regErr: "", sources: [], pmembers: [], team: [], metaForms: [], auto: null, distErr: "", panelFocused: false, q: new URLSearchParams(location.search).get("q") || "", range: "all", sort: "leads", view: "cards", f: { developer: "", location: "" }, open: null };

  async function load() {
    try { [state.leads, state.visits, state.bookings] = await Promise.all([Data.getLeads(), Data.getSiteVisits(), Data.getBookings()]); }
    catch (e) { page.innerHTML = '<div class="card empty">Could not load ' + KEY + ": " + esc(e.message) + "</div>"; return false; }
    try { [state.regProj, state.regDev] = await Promise.all([Data.getProjects(), Data.getDevelopers()]); state.regErr = ""; }   // registered ones; a failure must not hide the leads-based view
    catch (e) { state.regProj = []; state.regDev = []; state.regErr = e.message || "unknown error"; }
    if (!isProj) { try { state.sources = await Data.getProjectSources(); } catch { state.sources = []; } }   // the Developers page also needs them to place leads of a connected form
    if (isProj) {   // distribution data: failures are shown in the panel, never hide the rest of the page
      try { [state.sources, state.pmembers, state.team, state.metaForms] = await Promise.all([Data.getProjectSources(), Data.getProjectMembers(), Data.getTeam(), Data.getMetaForms().catch(() => [])]); state.auto = await Data.getAutoAssign().catch(() => null); state.distErr = ""; }
      catch (e) { state.sources = []; state.pmembers = []; state.team = []; state.distErr = e.message || "unknown error"; }
    }
    return true;
  }
  if (!(await load())) return;

  const regs = () => (isProj ? state.regProj : state.regDev);
  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  const inRange = (l) => inRangeTs(l.createdAt, state.range);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const top = (arr) => { const m = new Map(); arr.filter(Boolean).forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]); };

  // Names are matched the way the database does it: letters and digits only, and a registered name also matches a longer lead text that starts with it
  // ("Tanish Urbania" owns "Tanish Urbania, Charholi, Pune"); the longest registered name wins.
  const alnum = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const matchReg = (name, list) => {
    const a = alnum(name); if (a.length < 3) return null; let best = null, len = -1;
    list.forEach((r) => { const b = alnum(r.name); if (b.length < 3) return; if (a === b) { best = r; len = 1e9; } else if (len < 1e9 && (a.startsWith(b) || b.startsWith(a)) && b.length > len) { best = r; len = b.length; } });
    return best;
  };
  // One entry per project (or developer), built from the leads in the chosen period.
  function aggregate() {
    const groups = new Map(), byLead = new Map(), regList = regs();
    // a lead's developer: its own text, else the developer of the registered project it belongs to, else the one most leads of that project name carry
    const canon = (name) => alnum((matchReg(name, state.regProj) || {}).name || name);   // leads of one registered project share a key however their text is worded
    const common = new Map(); state.leads.forEach((l) => { const a = canon(l.project), d = String(l.developer || "").trim(); if (a && d) { const m = common.get(a) || new Map(); m.set(d, (m.get(d) || 0) + 1); common.set(a, m); } });
    const projDev = (name) => { const r = matchReg(name, state.regProj); if (r && r.developer) return r.developer; const m = common.get(canon(name)); return m ? [...m].sort((x, y) => y[1] - x[1])[0][0] : ""; };
    // A lead that came through a form / campaign connected to a registered project belongs to that project, whatever its own project text says (connected form wins).
    const bySrc = new Map(); (state.sources || []).forEach((s) => { const r = state.regProj.find((x) => x.id === s.project_id); if (r) bySrc.set(s.kind + "|" + s.ref_id, r); });
    const srcReg = (l) => (l.src && ((l.src.formId && bySrc.get("meta_form|" + l.src.formId)) || (l.src.campaignId && bySrc.get("meta_campaign|" + l.src.campaignId)))) || null;
    const devOf = (l) => String(l.developer || "").trim() || ((srcReg(l) || {}).developer) || projDev((srcReg(l) || {}).name || l.project);
    const keyOf = (name) => { const r = matchReg(name, regList); return { r, k: r ? norm(r.name) : norm(name) }; };
    state.leads.filter(inRange).forEach((l) => {
      const sr = isProj ? srcReg(l) : null, name = isProj ? (sr ? sr.name : l.project) : devOf(l); if (!norm(name)) return;
      const { r, k } = keyOf(name); if (!groups.has(k)) groups.set(k, { key: k, names: [], leads: [] });
      const g = groups.get(k); g.names.push(r ? r.name : String(name).trim()); g.leads.push(l); byLead.set(l.dbId, g);
    });
    regs().forEach((r) => { const k = norm(r.name); if (k && !groups.has(k)) groups.set(k, { key: k, names: [], leads: [] }); if (k) groups.get(k).reg = r; });
    // A visit or booking belongs to the project / developer it NAMES; only when it names none does it follow its lead.
    const devOfProject = { get: (name) => projDev(name) };
    const vOf = new Map(), bOf = new Map(), inRangeIds = new Set(state.leads.filter(inRange).map((l) => l.dbId));
    const groupFor = (named, lead) => { if (norm(named)) { const { r, k } = keyOf(named); if (!groups.has(k)) groups.set(k, { key: k, names: [r ? r.name : named], leads: [] }); return groups.get(k); } return byLead.get(lead); };
    state.visits.forEach((v) => { if (!inRangeIds.has(v.enquiry_id)) return; const g = groupFor(isProj ? v.project : devOfProject.get(norm(v.project)), v.enquiry_id); if (g) (vOf.get(g) || vOf.set(g, []).get(g)).push(v); });
    state.bookings.forEach((b) => { if (!inRangeIds.has(b.enquiry_id)) return; const g = groupFor(isProj ? b.project : b.developer || devOfProject.get(norm(b.project)), b.enquiry_id); if (g) (bOf.get(g) || bOf.set(g, []).get(g)).push(b); });
    return [...groups.values()].map((g) => {
      const visits = vOf.get(g) || [], bookings = bOf.get(g) || [], stage = {}; g.leads.forEach((l) => (stage[l.status] = (stage[l.status] || 0) + 1));
      const bookedIds = new Set(bookings.map((b) => b.enquiry_id)), booked = g.leads.filter((l) => BOOKED.includes(l.status) || bookedIds.has(l.dbId)).length;
      const reg = g.reg || null, extra = reg ? [isProj ? reg.developer : "", reg.city, reg.location].filter(Boolean) : [];
      return { ...g, reg, name: reg ? reg.name : top(g.names)[0][0], stage, visits, bookings, booked, conv: pct(booked, g.leads.length), active: g.leads.filter((l) => !CLOSED.includes(l.status)).length,
        value: bookings.reduce((t, b) => t + Number(b.booking_value || 0), 0), comm: bookings.reduce((t, b) => t + Number(b.commission_amount || 0), 0),
        last: g.leads.reduce((t, l) => Math.max(t, new Date(l.createdAt).getTime()), 0),
        devs: [...new Set([...(reg && isProj && reg.developer ? [reg.developer] : []), ...top(g.leads.map((l) => l.developer)).map((x) => x[0])])],
        projs: [...new Set([...state.regProj.filter((r) => !isProj && r.developer && keyOf(r.developer).k === g.key).map((r) => r.name), ...top(g.leads.map((l) => (matchReg(l.project, state.regProj) || {}).name || l.project)).map((x) => x[0])])],
        locs: [...new Set([...(reg ? [reg.location, reg.city].filter(Boolean) : []), ...top(g.leads.map((l) => l.location)).map((x) => x[0])])],
        srcs: top(g.leads.map((l) => l.source || "Website")) };
    });
  }
  function visible(all) {
    const q = norm(state.q), by = { leads: (a, b) => b.leads.length - a.leads.length, conv: (a, b) => b.conv - a.conv || b.leads.length - a.leads.length, book: (a, b) => b.booked - a.booked, comm: (a, b) => b.comm - a.comm, recent: (a, b) => b.last - a.last, name: (a, b) => a.name.localeCompare(b.name) };
    return all.filter((e) => (!q || norm([e.name, ...e.devs, ...e.projs, ...e.locs, ...(e.reg ? Object.values(e.reg).map(String) : [])].join(" ")).includes(q)) && (!state.f.developer || e.devs.map(norm).includes(norm(state.f.developer))) && (!state.f.location || e.locs.map(norm).includes(norm(state.f.location)))).sort(by[state.sort]);
  }
  const bar = (e) => { const t = e.leads.length || 1; return html`<div class="pp-bar" aria-hidden="true">${PIPELINE.concat("Spam").filter((s) => e.stage[s]).map((s) => html`<i class="s-${slug(s)}" style="width:${(e.stage[s] / t) * 100}%" title="${s}: ${e.stage[s]}"></i>`)}</div>`; };

  function card(e) {
    const sub = isProj ? [e.devs[0], e.locs[0]].filter(Boolean).join(" · ") : e.projs.length + (e.projs.length === 1 ? " project" : " projects") + (e.locs[0] ? " · " + e.locs[0] : "");
    return html`<button class="pp-card" data-open="${e.key}" aria-label="${e.name}: ${e.leads.length} leads, ${e.conv}% converted">
      <div class="pp-h"><span class="pp-ic"><i data-lucide="${isProj ? "landmark" : "building-2"}"></i></span><div class="pp-t"><b>${e.name}</b><small>${sub || "—"}</small></div><span class="pp-conv ${e.conv >= 10 ? "good" : ""}">${e.conv}%</span></div>
      ${bar(e)}
      <div class="pp-st"><div><b>${e.leads.length}</b><span>Leads</span></div><div><b>${e.visits.length}</b><span>Visits</span></div><div><b>${e.booked}</b><span>Booked</span></div><div><b>${e.comm ? fmtMoney(e.comm) : "—"}</b><span>Commission</span></div></div>
      <div class="pp-f"><span>${e.reg ? html`<span class="kb-chip">${isProj ? e.reg.status : e.reg.city || "Registered"}</span>` : e.active + " active"}</span><span>${e.last ? "Latest " + relTime(new Date(e.last)) : "No leads yet"}</span></div></button>`;
  }
  function row(e) {
    return html`<tr class="pp-row" data-open="${e.key}" tabindex="0"><td data-label="${NOUN}"><b>${e.name}</b><small>${isProj ? e.devs[0] || "" : e.projs.length + " projects"}</small></td><td data-label="Location">${e.locs[0] || "—"}</td><td data-label="Leads">${e.leads.length}</td><td data-label="Active">${e.active}</td>
      <td data-label="Visits">${e.visits.length}</td><td data-label="Booked">${e.booked}</td><td data-label="Conversion">${e.conv}%</td><td data-label="Commission">${e.comm ? fmtMoney(e.comm) : "—"}</td><td data-label="Funnel">${bar(e)}</td></tr>`;
  }

  function panel(e) {
    if (!e) return raw("");
    const recent = [...e.leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6), visits = [...e.visits].sort((a, b) => new Date(b.visit_at) - new Date(a.visit_at)).slice(0, 4);
    const stages = PIPELINE.concat("Spam").filter((s) => e.stage[s]);
    return html`<div class="pp-ov" data-close></div><aside class="pp-panel" role="dialog" aria-modal="true" aria-label="${e.name}"><div class="pp-ph"><div><h2>${e.name}</h2><p class="muted">${isProj ? [e.devs[0], e.locs.slice(0, 2).join(", ")].filter(Boolean).join(" · ") : e.projs.length + " projects · " + (e.locs.slice(0, 2).join(", ") || "—")}</p></div><button class="pp-x" data-close aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="pp-pb">
        <div class="pp-kpis"><div><b>${e.leads.length}</b><span>Leads</span></div><div><b>${e.active}</b><span>Active</span></div><div><b>${e.visits.length}</b><span>Site visits</span></div><div><b>${e.booked}</b><span>Booked</span></div><div><b>${e.conv}%</b><span>Conversion</span></div><div><b>${e.comm ? fmtMoney(e.comm) : "—"}</b><span>Commission</span></div></div>
        ${infoBlock(e)}
        ${distBlock(e)}
        ${e.value ? html`<p class="pp-val">Booking value <b>${fmtMoney(e.value)}</b> across ${e.bookings.length} ${e.bookings.length === 1 ? "booking" : "bookings"}</p>` : raw("")}
        ${e.leads.length ? html`<h4>Leads by stage</h4>` : raw("")}<ul class="pp-stages">${stages.map((s) => html`<li class="s-${slug(s)}"><i></i><span>${s}</span><div class="bar"><u style="width:${(e.stage[s] / e.leads.length) * 100}%"></u></div><b>${e.stage[s]}</b></li>`)}</ul>
        <h4>Where the leads come from</h4><div class="pp-chips">${e.srcs.slice(0, 6).map(([s, n]) => html`<span class="kb-chip">${s} · ${n}</span>`)}</div>
        ${isProj ? (e.devs.length ? html`<h4>Developer</h4><div class="pp-chips">${e.devs.map((d) => html`<a class="kb-chip lnk" href="developers.html?q=${encodeURIComponent(d)}">${d}</a>`)}</div>` : raw(""))
          : html`<h4>Projects</h4><ul class="pp-list">${e.projs.map((p) => [p, e.leads.filter((l) => ((matchReg(l.project, state.regProj) || {}).name || l.project) === p).length]).map(([p, n]) => html`<li><a href="projects.html?q=${encodeURIComponent(p)}"><b>${p}</b><span>${n} ${n === 1 ? "lead" : "leads"}</span><i data-lucide="chevron-right"></i></a></li>`)}</ul>`}
        ${recent.length ? html`<h4>Latest leads</h4>` : raw("")}<ul class="pp-list">${recent.map((l) => html`<li><a href="customer.html?id=${encodeURIComponent(l.id)}">${avatar(l.name, 26)}<b>${l.name}</b><span>${badge(l.status)}</span><small>${relTime(l.createdAt)}</small></a></li>`)}</ul>
        ${visits.length ? html`<h4>Site visits</h4><ul class="pp-list">${visits.map((v) => html`<li><a href="site-visit.html?id=${v.id}"><b>${fmtDate(v.visit_at)}</b><span>${v.status}</span><i data-lucide="chevron-right"></i></a></li>`)}</ul>` : raw("")}
      </div>
      <div class="pp-pf"><a class="btn gold" href="leads.html?q=${encodeURIComponent(e.name)}"><i data-lucide="users"></i>View ${e.leads.length} leads</a><button class="btn outline" id="ppAdd"><i data-lucide="plus"></i>Add lead</button><button class="btn outline" id="ppEdit"><i data-lucide="${e.reg ? "pencil" : "file-plus"}"></i>${e.reg ? "Edit details" : "Add details"}</button>${e.reg ? html`<button class="btn outline danger" id="ppDel"><i data-lucide="trash-2"></i>Delete</button>` : raw("")}<a class="btn outline" href="${isProj ? "developers" : "projects"}.html"><i data-lucide="${isProj ? "building-2" : "landmark"}"></i>${isProj ? "Developers" : "Projects"}</a></div></aside>`;
  }

  const INFO = isProj ? [["Developer", "developer"], ["Location", "location"], ["City", "city"], ["Type", "property_type"], ["Configurations", "configurations"], ["Price range", "price_range"], ["Possession", "possession"], ["RERA no.", "rera_no"], ["Status", "status"], ["Notes", "notes"]]
    : [["Contact person", "contact_person"], ["Phone", "phone"], ["Email", "email"], ["Website", "website"], ["City", "city"], ["Notes", "notes"]];
  // ---- Lead sources (connected forms) and team & distribution for a registered project
  const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  function distBlock(e) {
    if (!isProj) return raw("");
    if (!e.reg) return html`<p class="pp-note">To connect Facebook forms and assign a team to this project, press <b>Add details</b> first (it takes a name only).</p>`;
    if (state.distErr) return html`<div class="ban pend"><i data-lucide="alert-triangle"></i><div><b>Could not load forms and team</b>${state.distErr}</div></div>`;
    const pid = e.reg.id, srcs = state.sources.filter((s) => s.project_id === pid), day = startOfDay().getTime(), wk = Date.now() - 7 * 864e5;
    const mem = state.pmembers.filter((m) => m.project_id === pid).map((m) => ({ m, t: state.team.find((x) => x.id === m.member_id) })).filter((x) => x.t);
    const legacy = state.team.filter((t) => (t.status || "Active") === "Active" && !mem.some((x) => x.t.id === t.id) && (t.projects || []).some((p) => { const a = norm(p).replace(/[^a-z0-9]/g, ""), b = norm(e.name).replace(/[^a-z0-9]/g, ""); return a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)); }));
    const cnt = (t, since) => state.leads.filter((l) => l.agent === t.name && new Date(l.createdAt).getTime() >= since).length;
    const unrouted = state.leads.filter((l) => !String(l.project || "").trim() && l.src && srcs.some((s) => (s.kind === "meta_form" && s.ref_id === l.src.formId) || (s.kind === "meta_campaign" && s.ref_id === l.src.campaignId))).length;
    const warns = [];
    if (!srcs.length) warns.push("No forms are connected: Facebook leads reach this project only when they name it themselves.");
    if (!mem.length && !legacy.length) warns.push("No team is assigned: new leads go to " + (e.reg.fallback === "unassigned" ? "nobody (left unassigned)" : "the shared relationship managers") + ".");
    if (state.auto === false) warns.push("Automatic assignment is switched off, so nothing is distributed yet.");
    const row = ({ m, t }) => html`<li class="${m.paused ? "paused" : ""}">${avatar(t.name, 30)}<div class="pt-n"><b>${t.name}</b><small>${t.kind === "rm" ? "Relationship Manager" : "Agent"}${t.daily_cap ? " · cap " + t.daily_cap + "/day" : ""}</small><small>${cnt(t, day)} today · ${cnt(t, wk)} this week</small></div>
      <div class="pt-w" role="group" aria-label="Weight for ${t.name}"><button type="button" data-wdn="${t.id}" aria-label="Lower weight" ${m.weight <= 1 ? raw("disabled") : raw("")}>−</button><span title="Weight: a higher weight gets more leads (used in weighted sharing)"><b>${m.weight}</b><small>weight</small></span><button type="button" data-wup="${t.id}" aria-label="Raise weight" ${m.weight >= 5 ? raw("disabled") : raw("")}>+</button></div>
      <button type="button" class="pt-b" data-pause="${t.id}" aria-pressed="${m.paused}" title="${m.paused ? "Resume" : "Pause"} leads for this project"><i data-lucide="${m.paused ? "play" : "pause"}"></i></button>
      <button type="button" class="pt-b" data-rmteam="${t.id}" aria-label="Remove ${t.name}" title="Remove from this project"><i data-lucide="x"></i></button></li>`;
    return html`<h4>Lead sources</h4>
      <div class="pp-chips">${srcs.length ? srcs.map((s) => html`<span class="kb-chip src-chip"><i data-lucide="${s.kind === "meta_form" ? "file-text" : "megaphone"}"></i>${s.label || s.ref_id}<button type="button" data-unsrc="${s.id}" aria-label="Disconnect ${s.label || s.ref_id}">×</button></span>`) : html`<small class="muted">No forms or campaigns connected yet</small>`}</div>
      <button type="button" class="btn sm outline" id="ppConnect"><i data-lucide="link"></i>${srcs.length ? "Manage connected forms" : "Connect forms"}</button>
      ${unrouted ? html`<p class="pp-note">${unrouted} earlier lead${unrouted === 1 ? "" : "s"} from the connected forms ${unrouted === 1 ? "has" : "have"} no project saved. They are counted here already; press the button to save <b>${e.name}</b> on ${unrouted === 1 ? "it" : "them"} so the Leads page and filters show it too.</p><button type="button" class="btn sm gold" id="ppApply"><i data-lucide="check"></i>Set project on ${unrouted} lead${unrouted === 1 ? "" : "s"}</button>` : raw("")}
      <h4>Team &amp; distribution</h4>
      ${mem.length || legacy.length ? html`<ul class="pp-team">${mem.map(row)}${legacy.map((t) => html`<li class="legacy">${avatar(t.name, 30)}<div class="pt-n"><b>${t.name}</b><small>Set in Agents &amp; Teams (weight 1)</small><small>${cnt(t, day)} today · ${cnt(t, wk)} this week</small></div></li>`)}</ul>` : html`<p class="pp-note">Nobody is assigned yet.</p>`}
      <button type="button" class="btn sm outline" id="ppTeam"><i data-lucide="users"></i>${mem.length ? "Add or remove team members" : "Add team members"}</button>
      <div class="pp-dist"><label>Share leads<select id="ppMode"><option value="round_robin" ${e.reg.distribution === "round_robin" ? raw("selected") : raw("")}>Equally, in turn (round-robin)</option><option value="weighted" ${e.reg.distribution === "weighted" ? raw("selected") : raw("")}>By weight (higher weight gets more)</option><option value="manual" ${e.reg.distribution === "manual" ? raw("selected") : raw("")}>Manually (no automatic assignment)</option></select></label>
        <label>If nobody is available<select id="ppFb"><option value="rm_pool" ${e.reg.fallback === "rm_pool" ? raw("selected") : raw("")}>Give it to the shared relationship managers</option><option value="unassigned" ${e.reg.fallback === "unassigned" ? raw("selected") : raw("")}>Leave it unassigned</option></select></label></div>
      <div class="pp-next" id="ppNext" aria-live="polite"><i data-lucide="shuffle"></i><span>Checking who gets the next lead…</span></div>
      ${warns.length ? html`<ul class="pp-warn">${warns.map((w) => html`<li><i data-lucide="alert-triangle"></i>${w}</li>`)}</ul>${state.auto === false ? html`<button type="button" class="btn sm gold" id="ppAuto"><i data-lucide="zap"></i>Turn on automatic assignment</button>` : raw("")}` : raw("")}`;
  }
  function infoBlock(e) {
    if (!e.reg) return html`<p class="pp-note">Built from your leads. Press <b>Add details</b> to save its ${isProj ? "RERA number, price, possession date" : "contact person, phone, website"} and more.</p>`;
    const rows = INFO.filter(([, k]) => e.reg[k]);
    return html`<h4>Details</h4><dl class="pp-info">${rows.map(([l, k]) => html`<div><dt>${l}</dt><dd>${k === "phone" ? html`<a href="${telHref(e.reg[k])}">${e.reg[k]}</a>` : k === "email" ? html`<a href="mailto:${e.reg[k]}">${e.reg[k]}</a>` : k === "website" ? html`<a href="${/^https?:/i.test(e.reg[k]) ? e.reg[k] : "https://" + e.reg[k]}" target="_blank" rel="noopener">${e.reg[k]}</a>` : e.reg[k]}</dd></div>`)}</dl>`;
  }
  // Add / edit a project or developer. Editing a name does not rename the leads that already use it.
  async function openForm(e) {
    const ms = await Data.mastersCached().catch(() => ({ teams: [], departments: [], cities: [], localities: [], designations: [] }));
    const r = (e && e.reg) || {}, seed = !e ? {} : e.reg ? {} : { name: e.name };
    const v = (k) => r[k] || seed[k] || "";
    const devNames = [...new Set([...state.regDev.map((d) => d.name), ...state.regProj.map((x) => x.developer), ...state.leads.map((l) => String(l.developer || "").trim())].filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const body = isProj
      ? html`<div class="form">${field("Project name *", "name", v("name"), "text", "required", "full")}${field("Developer", "developer", v("developer") || (e && e.devs[0]) || "", "text", 'placeholder="Start typing a developer name" autocomplete="off"')}
          ${selectField("Status", "status", ["Upcoming", "New Launch", "Under Construction", "Ready to Move"], r.status || "New Launch")}${locPicker(ms, { city: v("city"), locality: v("location") || (e && e.locs[0]) || "", cityName: "city", locName: "location", locLabel: "Location / area", fallback: html`${field("Location / area", "location", v("location") || (e && e.locs[0]) || "")}${field("City", "city", v("city"))}` })}
          ${configPicker({ type: r.property_type || "", value: v("configurations"), name: "configurations", typeLabel: "Type", label: "Configurations" })}
          ${field("Price range", "price_range", v("price_range"), "text", 'placeholder="₹ 70L – 1.2Cr"')}${field("Possession", "possession", v("possession"), "text", 'placeholder="Dec 2027"')}${field("RERA no.", "rera_no", v("rera_no"), "text", "", "full")}
          <label class="full">Notes<textarea name="notes" rows="2">${v("notes")}</textarea></label></div>`
      : html`<div class="form">${field("Developer name *", "name", v("name"), "text", "required", "full")}${field("Contact person", "contact_person", v("contact_person"))}${field("Phone", "phone", v("phone"), "tel")}${field("Email", "email", v("email"), "email")}${field("Website", "website", v("website"))}${masterSelect("City", "city", ms.cities.map((x) => x.name), v("city"))}
          <label class="full">Notes<textarea name="notes" rows="2">${v("notes")}</textarea></label></div>`;
    openModal((e && e.reg ? "Edit " : "Add ") + NOUN.toLowerCase(), body, async (f) => {
      const row = { ...f }; delete row.id;
      // leads link to a project / developer by name, so two registered ones may not share a name
      if (regs().some((x) => norm(x.name) === norm(f.name) && (!e || !e.reg || x.id !== e.reg.id))) throw new Error("A " + NOUN.toLowerCase() + " with this name already exists");
      await Data.saveProperty(isProj ? "projects" : "developers", e && e.reg ? e.reg.id : null, row);
      // renaming a developer keeps its registered projects attached to it (leads that already carry the old name are not changed)
      if (!isProj && e && e.reg && norm(e.reg.name) !== norm(f.name)) {
        const ids = state.regProj.filter((x) => norm(x.developer) === norm(e.reg.name)).map((x) => x.id);
        if (ids.length) await Data.retargetProjects(ids, String(f.name).trim());
      }
      toast(NOUN + (e && e.reg ? " updated" : " saved")); state.open = norm(f.name); await refresh();
    }, e && e.reg ? "Save" : "Add " + NOUN);
    const modal = document.querySelector(".overlay.open .modal") || document;
    wireLocations(modal, ms, "city", "location"); if (isProj) { wireConfigs(modal); const dev = modal.querySelector('[name="developer"]'); if (dev) attachSuggest(dev, () => devNames); }   // developer names suggest as you type
  }

  function draw() {
    const keepPb = (page.querySelector(".pp-pb") || {}).scrollTop || 0;
    const all = aggregate(), list = visible(all), opts = (k) => [...new Set(all.flatMap((e) => (k === "developer" ? e.devs : e.locs)))].sort();
    const L = all.flatMap((e) => e.leads), booked = all.reduce((t, e) => t + e.booked, 0), comm = all.reduce((t, e) => t + e.comm, 0), visits = all.reduce((t, e) => t + e.visits.length, 0);
    const kpis = [[isProj ? "Projects" : "Developers", all.length.toLocaleString("en-IN"), "", isProj ? "landmark" : "building-2", 1], ["Total Leads", L.length.toLocaleString("en-IN"), "", "users"], ["Site Visits", visits, "", "calendar-check"], ["Bookings", booked, "", "handshake"], ["Commission", fmtMoney(comm), "", "coins", 0, 1], ["Conversion", pct(booked, L.length) + "%", "", "trending-up"]];
    const sel = (key, label, vals) => html`<select class="select" data-f="${key}"><option value="">${label}: All</option>${vals.map((v) => html`<option ${state.f[key] === v ? raw("selected") : raw("")}>${v}</option>`)}</select>`;
    render(page, html`
      <div class="page-head"><div><h1>${isProj ? "Projects" : "Developers"}</h1><p class="sub">${isProj ? "How every project is performing: leads, site visits, bookings and commission." : "Your developers at a glance: their projects, leads, bookings and commission."}</p></div>
        <div class="btns"><button class="btn gold" id="ppReg"><i data-lucide="plus"></i>Add ${NOUN}</button><button class="btn outline" id="ppNew"><i data-lucide="user-plus"></i>Add Lead</button></div></div>
      ${state.regErr ? html`<div class="ban pend"><i data-lucide="alert-triangle"></i><div><b>Could not load the saved ${KEY}</b>${state.regErr}</div></div>` : raw("")}
      <div class="kpis k6">${kpis.map(kpiCard)}</div>
      <div class="filters pp-tools"><label class="pp-search"><i data-lucide="search"></i><input id="ppq" type="search" placeholder="Search ${KEY}, ${isProj ? "developers" : "projects"}, locations…" value="${state.q}" aria-label="Search"></label>
        ${isProj ? sel("developer", "Developer", opts("developer")) : raw("")}${sel("location", "Location", opts("location"))}
        <select class="select" id="ppr" aria-label="Period">${Object.entries(RANGES).map(([k, v]) => html`<option value="${k}" ${k === state.range ? raw("selected") : raw("")}>${v}</option>`)}</select>
        <select class="select" id="pps" aria-label="Sort">${Object.entries(SORTS).map(([k, v]) => html`<option value="${k}" ${k === state.sort ? raw("selected") : raw("")}>${v}</option>`)}</select>
        <div class="seg-toggle" role="group" aria-label="View"><button data-view="cards" class="${state.view === "cards" ? "on" : ""}" aria-pressed="${state.view === "cards"}"><i data-lucide="layout-grid"></i>Cards</button><button data-view="table" class="${state.view === "table" ? "on" : ""}" aria-pressed="${state.view === "table"}"><i data-lucide="list"></i>Table</button></div></div>
      <p class="pp-count" aria-live="polite">Showing ${list.length} of ${all.length} ${KEY}</p>
      ${!list.length ? html`<div class="card empty">${all.length ? "Nothing matches your search or filters." : "No " + KEY + " yet. Use “Add " + NOUN + "” above, or add a lead with a " + NOUN.toLowerCase() + " name and it will appear here."}</div>`
        : state.view === "cards" ? html`<div class="pp-grid">${list.map(card)}</div>`
        : html`<div class="card table-wrap"><table class="leads-t pp-t"><thead><tr>${[NOUN, "Location", "Leads", "Active", "Visits", "Booked", "Conversion", "Commission", "Funnel"].map((h) => html`<th>${h}</th>`)}</tr></thead><tbody>${list.map(row)}</tbody></table></div>`}
      ${panel(all.find((e) => e.key === state.open))}`);
    bind(all);
    const pn = page.querySelector(".pp-panel"); if (pn) { if (!state.panelFocused) { pn.querySelector(".pp-x").focus(); state.panelFocused = true; } const pb = pn.querySelector(".pp-pb"); if (pb) pb.scrollTop = keepPb; } else state.panelFocused = false;
    const cur = all.find((x) => x.key === state.open);
    if (cur && cur.reg && isProj && !state.distErr) Data.previewAssignee(cur.name).then((r) => { const el = page.querySelector("#ppNext span"); if (el) el.innerHTML = r && r.id ? "Next lead goes to <b>" + esc(r.name) + "</b> <small>" + esc(r.reason || "") + "</small>" : "Next lead stays <b>unassigned</b>" + (r && r.reason ? " <small>" + esc(r.reason) + "</small>" : ""); }).catch(() => { const el = page.querySelector("#ppNext span"); if (el) el.textContent = "Could not work out who is next."; });
  }
  const refresh = async () => { if (await load()) draw(); };
  function bind(all) {
    const open = (k) => { state.open = k; state.panelFocused = false; draw(); };
    const cur = () => all.find((x) => x.key === state.open), guard = (fn) => async (...a) => { try { await fn(...a); } catch (er) { toast("Could not save: " + (er.message || er)); } };
    const dc = page.querySelector("#ppConnect"); if (dc) dc.onclick = () => openConnectForms({ project: cur().reg, sources: state.sources, projects: state.regProj, metaForms: state.metaForms, leads: state.leads }, refresh);
    const ap = page.querySelector("#ppApply"); if (ap) ap.onclick = guard(async () => { ap.disabled = true; const n = await Data.applyToPastLeads(cur().reg.id); toast(n + " lead" + (n === 1 ? "" : "s") + " updated"); await refresh(); });
    const dt = page.querySelector("#ppTeam"); if (dt) dt.onclick = () => openAddTeam({ project: cur().reg, team: state.team, members: state.pmembers, leads: state.leads }, refresh);
    page.querySelectorAll("[data-unsrc]").forEach((b) => (b.onclick = guard(async () => { await Data.disconnectSource(Number(b.dataset.unsrc)); toast("Disconnected"); await refresh(); })));
    const step = (attr, d) => page.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = guard(async () => { const id = Number(b.getAttribute(attr)), m = state.pmembers.find((x) => x.project_id === cur().reg.id && x.member_id === id); await Data.setProjectMembers(cur().reg.id, [id], { weight: Math.min(5, Math.max(1, ((m && m.weight) || 1) + d)) }); await refresh(); })));
    step("data-wup", 1); step("data-wdn", -1);
    page.querySelectorAll("[data-pause]").forEach((b) => (b.onclick = guard(async () => { const id = Number(b.dataset.pause), m = state.pmembers.find((x) => x.project_id === cur().reg.id && x.member_id === id); await Data.setProjectMembers(cur().reg.id, [id], { paused: !(m && m.paused) }); await refresh(); })));
    page.querySelectorAll("[data-rmteam]").forEach((b) => (b.onclick = guard(async () => { await Data.removeProjectMember(cur().reg.id, Number(b.dataset.rmteam)); await refresh(); })));
    const setting = (sel, key) => { const s = page.querySelector(sel); if (s) s.onchange = guard(async () => { await Data.saveProperty("projects", cur().reg.id, { name: cur().reg.name, [key]: s.value }); toast("Saved"); await refresh(); }); };
    setting("#ppMode", "distribution"); setting("#ppFb", "fallback");
    const au = page.querySelector("#ppAuto"); if (au) au.onclick = guard(async () => { await Data.setAutoAssign(true); toast("Automatic assignment is on"); await refresh(); });
    page.querySelectorAll("[data-open]").forEach((x) => { x.onclick = () => open(x.dataset.open); x.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(x.dataset.open); } }; });
    page.querySelectorAll("[data-close]").forEach((x) => (x.onclick = () => { const k = state.open; state.open = null; state.panelFocused = false; draw(); const back = page.querySelector(`[data-open="${k}"]`); if (back) back.focus(); }));
    const esc2 = (e) => { if (e.key === "Escape" && state.open && !document.querySelector(".overlay")) { state.open = null; state.panelFocused = false; draw(); } }; document.removeEventListener("keydown", window.__ppEsc || (() => {})); window.__ppEsc = esc2; document.addEventListener("keydown", esc2);
    const q = page.querySelector("#ppq"); q.oninput = () => { state.q = q.value; const pos = q.selectionStart; draw(); const n = page.querySelector("#ppq"); n.focus(); n.setSelectionRange(pos, pos); };
    page.querySelector("#ppr").onchange = (e) => { state.range = e.target.value; draw(); }; page.querySelector("#pps").onchange = (e) => { state.sort = e.target.value; draw(); };
    page.querySelectorAll("[data-f]").forEach((x) => (x.onchange = () => { state.f[x.dataset.f] = x.value; draw(); }));
    page.querySelectorAll("[data-view]").forEach((x) => (x.onclick = () => { state.view = x.dataset.view; draw(); }));
    page.querySelector("#ppNew").onclick = () => openAddLead(refresh);
    page.querySelector("#ppReg").onclick = () => openForm(null);
    const ed = page.querySelector("#ppEdit"); if (ed) ed.onclick = () => openForm(all.find((x) => x.key === state.open));
    const dl = page.querySelector("#ppDel"); if (dl) dl.onclick = () => { const e = all.find((x) => x.key === state.open); showDialog("Delete " + NOUN.toLowerCase() + "?", html`<p>${e.name} will be removed from your ${KEY} list.${e.leads.length ? " Its " + e.leads.length + " leads stay as they are and it will still appear here, built from those leads." : ""}</p>`, [["Cancel", null], ["Delete", async () => { try { await Data.deleteProperty(isProj ? "projects" : "developers", e.reg.id); toast(NOUN + " deleted"); state.open = null; await refresh(); } catch (er) { toast("Could not delete: " + (er.message || er)); } }]]); };
    const add = page.querySelector("#ppAdd"); if (add) add.onclick = () => { const e = all.find((x) => x.key === state.open); openAddLead(refresh, isProj ? { project: e.name, developer: e.devs[0] || "" } : { developer: e.name }); };
  }
  draw();
}
