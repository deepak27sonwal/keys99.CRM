// Projects and Developers: the same page for both, built from what your leads, site visits and bookings already say.
// Every project / developer is a card with its funnel and results; click one to open its details panel; search, filter and sort live.
async function mountPropertyPage(kind) {
  const isProj = kind === "project", KEY = isProj ? "projects" : "developers", NOUN = isProj ? "Project" : "Developer";
  const page = await mountShell(KEY);
  if (!page) return;
  const RANGES = { all: "All time", today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month" };
  const SORTS = { leads: "Most leads", conv: "Best conversion", book: "Most bookings", comm: "Most commission", recent: "Latest lead", name: "Name A–Z" };
  const state = { leads: [], visits: [], bookings: [], q: new URLSearchParams(location.search).get("q") || "", range: "all", sort: "leads", view: "cards", f: { developer: "", location: "" }, open: null };

  async function load() {
    try { [state.leads, state.visits, state.bookings] = await Promise.all([Data.getLeads(), Data.getSiteVisits(), Data.getBookings()]); }
    catch (e) { page.innerHTML = '<div class="card empty">Could not load ' + KEY + ": " + esc(e.message) + "</div>"; return false; }
    return true;
  }
  if (!(await load())) return;

  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  const inRange = (l) => {
    if (state.range === "all") return true;
    const d = new Date(l.createdAt), now = new Date(), sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (state.range === "today") return d >= sod;
    if (state.range === "month") return d >= new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= new Date(sod - (state.range === "7d" ? 6 : 29) * 86400000);
  };
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const top = (arr) => { const m = new Map(); arr.filter(Boolean).forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]); };

  // One entry per project (or developer), built from the leads in the chosen period.
  function aggregate() {
    const groups = new Map(), byLead = new Map();
    state.leads.filter(inRange).forEach((l) => {
      const name = isProj ? l.project : l.developer; if (!norm(name)) return;
      const k = norm(name); if (!groups.has(k)) groups.set(k, { key: k, names: [], leads: [] });
      const g = groups.get(k); g.names.push(String(name).trim()); g.leads.push(l); byLead.set(l.dbId, g);
    });
    const vOf = new Map(), bOf = new Map();
    state.visits.forEach((v) => { const g = byLead.get(v.enquiry_id); if (g) (vOf.get(g) || vOf.set(g, []).get(g)).push(v); });
    state.bookings.forEach((b) => { const g = byLead.get(b.enquiry_id); if (g) (bOf.get(g) || bOf.set(g, []).get(g)).push(b); });
    return [...groups.values()].map((g) => {
      const visits = vOf.get(g) || [], bookings = bOf.get(g) || [], stage = {}; g.leads.forEach((l) => (stage[l.status] = (stage[l.status] || 0) + 1));
      const bookedIds = new Set(bookings.map((b) => b.enquiry_id)), booked = g.leads.filter((l) => BOOKED.includes(l.status) || bookedIds.has(l.dbId)).length;
      return { ...g, name: top(g.names)[0][0], stage, visits, bookings, booked, conv: pct(booked, g.leads.length), active: g.leads.filter((l) => !CLOSED.includes(l.status)).length,
        value: bookings.reduce((t, b) => t + Number(b.booking_value || 0), 0), comm: bookings.reduce((t, b) => t + Number(b.commission_amount || 0), 0),
        last: g.leads.reduce((t, l) => Math.max(t, new Date(l.createdAt).getTime()), 0),
        devs: top(g.leads.map((l) => l.developer)).map((x) => x[0]), projs: top(g.leads.map((l) => l.project)).map((x) => x[0]), locs: top(g.leads.map((l) => l.location)).map((x) => x[0]),
        srcs: top(g.leads.map((l) => l.source || "Website")) };
    });
  }
  function visible(all) {
    const q = norm(state.q), by = { leads: (a, b) => b.leads.length - a.leads.length, conv: (a, b) => b.conv - a.conv || b.leads.length - a.leads.length, book: (a, b) => b.booked - a.booked, comm: (a, b) => b.comm - a.comm, recent: (a, b) => b.last - a.last, name: (a, b) => a.name.localeCompare(b.name) };
    return all.filter((e) => (!q || norm([e.name, ...e.devs, ...e.projs, ...e.locs].join(" ")).includes(q)) && (!state.f.developer || e.devs.map(norm).includes(norm(state.f.developer))) && (!state.f.location || e.locs.map(norm).includes(norm(state.f.location)))).sort(by[state.sort]);
  }
  const bar = (e) => { const t = e.leads.length || 1; return html`<div class="pp-bar" aria-hidden="true">${PIPELINE.concat("Spam").filter((s) => e.stage[s]).map((s) => html`<i class="s-${slug(s)}" style="width:${(e.stage[s] / t) * 100}%" title="${s}: ${e.stage[s]}"></i>`)}</div>`; };

  function card(e) {
    const sub = isProj ? [e.devs[0], e.locs[0]].filter(Boolean).join(" · ") : e.projs.length + (e.projs.length === 1 ? " project" : " projects") + (e.locs[0] ? " · " + e.locs[0] : "");
    return html`<button class="pp-card" data-open="${e.key}" aria-label="${e.name}: ${e.leads.length} leads, ${e.conv}% converted">
      <div class="pp-h"><span class="pp-ic"><i data-lucide="${isProj ? "landmark" : "building-2"}"></i></span><div class="pp-t"><b>${e.name}</b><small>${sub || "—"}</small></div><span class="pp-conv ${e.conv >= 10 ? "good" : ""}">${e.conv}%</span></div>
      ${bar(e)}
      <div class="pp-st"><div><b>${e.leads.length}</b><span>Leads</span></div><div><b>${e.visits.length}</b><span>Visits</span></div><div><b>${e.booked}</b><span>Booked</span></div><div><b>${e.comm ? fmtMoney(e.comm) : "—"}</b><span>Commission</span></div></div>
      <div class="pp-f"><span>${e.active} active</span><span>${e.last ? "Latest " + relTime(new Date(e.last)) : ""}</span></div></button>`;
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
        ${e.value ? html`<p class="pp-val">Booking value <b>${fmtMoney(e.value)}</b> across ${e.bookings.length} ${e.bookings.length === 1 ? "booking" : "bookings"}</p>` : raw("")}
        <h4>Leads by stage</h4><ul class="pp-stages">${stages.map((s) => html`<li class="s-${slug(s)}"><i></i><span>${s}</span><div class="bar"><u style="width:${(e.stage[s] / e.leads.length) * 100}%"></u></div><b>${e.stage[s]}</b></li>`)}</ul>
        <h4>Where the leads come from</h4><div class="pp-chips">${e.srcs.slice(0, 6).map(([s, n]) => html`<span class="kb-chip">${s} · ${n}</span>`)}</div>
        ${isProj ? (e.devs.length ? html`<h4>Developer</h4><div class="pp-chips">${e.devs.map((d) => html`<a class="kb-chip lnk" href="developers.html?q=${encodeURIComponent(d)}">${d}</a>`)}</div>` : raw(""))
          : html`<h4>Projects</h4><ul class="pp-list">${top(e.leads.map((l) => l.project)).map(([p, n]) => html`<li><a href="projects.html?q=${encodeURIComponent(p)}"><b>${p}</b><span>${n} ${n === 1 ? "lead" : "leads"}</span><i data-lucide="chevron-right"></i></a></li>`)}</ul>`}
        <h4>Latest leads</h4><ul class="pp-list">${recent.map((l) => html`<li><a href="customer.html?id=${encodeURIComponent(l.id)}">${avatar(l.name, 26)}<b>${l.name}</b><span>${badge(l.status)}</span><small>${relTime(l.createdAt)}</small></a></li>`)}</ul>
        ${visits.length ? html`<h4>Site visits</h4><ul class="pp-list">${visits.map((v) => html`<li><a href="site-visit.html?id=${v.id}"><b>${fmtDate(v.visit_at)}</b><span>${v.status}</span><i data-lucide="chevron-right"></i></a></li>`)}</ul>` : raw("")}
      </div>
      <div class="pp-pf"><a class="btn gold" href="leads.html?q=${encodeURIComponent(e.name)}"><i data-lucide="users"></i>View ${e.leads.length} leads</a><button class="btn outline" id="ppAdd"><i data-lucide="plus"></i>Add lead</button><a class="btn outline" href="${isProj ? "developers" : "projects"}.html"><i data-lucide="${isProj ? "building-2" : "landmark"}"></i>${isProj ? "Developers" : "Projects"}</a></div></aside>`;
  }

  function draw() {
    const all = aggregate(), list = visible(all), opts = (k) => [...new Set(all.flatMap((e) => (k === "developer" ? e.devs : e.locs)))].sort();
    const L = all.flatMap((e) => e.leads), booked = all.reduce((t, e) => t + e.booked, 0), comm = all.reduce((t, e) => t + e.comm, 0), visits = all.reduce((t, e) => t + e.visits.length, 0);
    const kpis = [[isProj ? "Projects" : "Developers", all.length.toLocaleString("en-IN"), "", isProj ? "landmark" : "building-2", 1], ["Total Leads", L.length.toLocaleString("en-IN"), "", "users"], ["Site Visits", visits, "", "calendar-check"], ["Bookings", booked, "", "handshake"], ["Commission", fmtMoney(comm), "", "coins", 0, 1], ["Conversion", pct(booked, L.length) + "%", "", "trending-up"]];
    const sel = (key, label, vals) => html`<select class="select" data-f="${key}"><option value="">${label}: All</option>${vals.map((v) => html`<option ${state.f[key] === v ? raw("selected") : raw("")}>${v}</option>`)}</select>`;
    render(page, html`
      <div class="page-head"><div><h1>${isProj ? "Projects" : "Developers"}</h1><p class="sub">${isProj ? "How every project is performing: leads, site visits, bookings and commission." : "Your developers at a glance: their projects, leads, bookings and commission."}</p></div>
        <div class="btns"><button class="btn gold" id="ppNew"><i data-lucide="plus"></i>Add Lead</button></div></div>
      <div class="kpis k6">${kpis.map(kpiCard)}</div>
      <div class="filters pp-tools"><label class="pp-search"><i data-lucide="search"></i><input id="ppq" type="search" placeholder="Search ${KEY}, ${isProj ? "developers" : "projects"}, locations…" value="${state.q}" aria-label="Search"></label>
        ${isProj ? sel("developer", "Developer", opts("developer")) : raw("")}${sel("location", "Location", opts("location"))}
        <select class="select" id="ppr" aria-label="Period">${Object.entries(RANGES).map(([k, v]) => html`<option value="${k}" ${k === state.range ? raw("selected") : raw("")}>${v}</option>`)}</select>
        <select class="select" id="pps" aria-label="Sort">${Object.entries(SORTS).map(([k, v]) => html`<option value="${k}" ${k === state.sort ? raw("selected") : raw("")}>${v}</option>`)}</select>
        <div class="seg-toggle" role="group" aria-label="View"><button data-view="cards" class="${state.view === "cards" ? "on" : ""}" aria-pressed="${state.view === "cards"}"><i data-lucide="layout-grid"></i>Cards</button><button data-view="table" class="${state.view === "table" ? "on" : ""}" aria-pressed="${state.view === "table"}"><i data-lucide="list"></i>Table</button></div></div>
      <p class="pp-count" aria-live="polite">Showing ${list.length} of ${all.length} ${KEY}</p>
      ${!list.length ? html`<div class="card empty">${all.length ? "Nothing matches your search or filters." : "No " + KEY + " yet. Add a lead with a " + NOUN.toLowerCase() + " name and it will appear here."}</div>`
        : state.view === "cards" ? html`<div class="pp-grid">${list.map(card)}</div>`
        : html`<div class="card table-wrap"><table class="leads-t pp-t"><thead><tr>${[NOUN, "Location", "Leads", "Active", "Visits", "Booked", "Conversion", "Commission", "Funnel"].map((h) => html`<th>${h}</th>`)}</tr></thead><tbody>${list.map(row)}</tbody></table></div>`}
      ${panel(all.find((e) => e.key === state.open))}`);
    bind(all);
    const pn = page.querySelector(".pp-panel"); if (pn) pn.querySelector(".pp-x").focus();
  }
  const refresh = async () => { if (await load()) draw(); };
  function bind(all) {
    const open = (k) => { state.open = k; draw(); };
    page.querySelectorAll("[data-open]").forEach((x) => { x.onclick = () => open(x.dataset.open); x.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(x.dataset.open); } }; });
    page.querySelectorAll("[data-close]").forEach((x) => (x.onclick = () => { const k = state.open; state.open = null; draw(); const back = page.querySelector(`[data-open="${k}"]`); if (back) back.focus(); }));
    const esc2 = (e) => { if (e.key === "Escape" && state.open) { state.open = null; draw(); } }; document.removeEventListener("keydown", window.__ppEsc || (() => {})); window.__ppEsc = esc2; document.addEventListener("keydown", esc2);
    const q = page.querySelector("#ppq"); q.oninput = () => { state.q = q.value; const pos = q.selectionStart; draw(); const n = page.querySelector("#ppq"); n.focus(); n.setSelectionRange(pos, pos); };
    page.querySelector("#ppr").onchange = (e) => { state.range = e.target.value; draw(); }; page.querySelector("#pps").onchange = (e) => { state.sort = e.target.value; draw(); };
    page.querySelectorAll("[data-f]").forEach((x) => (x.onchange = () => { state.f[x.dataset.f] = x.value; draw(); }));
    page.querySelectorAll("[data-view]").forEach((x) => (x.onclick = () => { state.view = x.dataset.view; draw(); }));
    page.querySelector("#ppNew").onclick = () => openAddLead(refresh);
    const add = page.querySelector("#ppAdd"); if (add) add.onclick = () => { const e = all.find((x) => x.key === state.open); openAddLead(refresh, isProj ? { project: e.name, developer: e.devs[0] || "" } : { developer: e.name }); };
  }
  draw();
}
