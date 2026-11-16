// Settings (admin only): the master lists that drive dropdowns across the CRM: Teams, Departments, Cities and Localities (inside a city).
(async function () {
  const page = await mountShell("settings");
  if (!page) return;
  const TABS = [["teams", "Teams", "Team", "users"], ["departments", "Departments", "Department", "briefcase"], ["cities", "Cities", "City", "building"], ["localities", "Localities", "Locality", "map-pin"]];
  const state = { tab: "teams", q: "", city: null, m: { teams: [], departments: [], cities: [], localities: [] }, members: [], projects: [], developers: [], leads: [], err: "" };
  const k = (x) => String(x || "").trim().toLowerCase(), cnt = (arr, fn) => arr.filter(fn).length;
  const lastPart = (loc) => String(loc || "").split(",").map((x) => x.trim()).filter(Boolean).pop() || "";
  const headParts = (loc) => String(loc || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, -1).join(", ");

  async function load() {
    try {
      const [m, members, projects, developers, leads] = await Promise.all([Data.getMasters(), Data.getTeam(), Data.getProjects().catch(() => []), Data.getDevelopers().catch(() => []), Data.getLeads().catch(() => [])]);
      Object.assign(state, { m, members, projects, developers, leads, err: "" });
      if (!state.city || !m.cities.some((c) => c.id === state.city)) state.city = m.cities.length ? m.cities[0].id : null;
    } catch (e) { state.err = e.message || String(e); }
  }
  const cityName = () => (state.m.cities.find((c) => c.id === state.city) || {}).name || "";

  // how many records use each value (shown so deleting is an informed choice)
  function usage(tab, row) {
    const M = state.members, P = state.projects, D = state.developers, L = state.leads, n = row.name, c = cityName(), parts = [];
    const add = (v, one, many) => { if (v) parts.push(v + " " + (v === 1 ? one : many)); };
    if (tab === "teams") add(cnt(M, (x) => k(x.team) === k(n)), "member", "members");
    if (tab === "departments") add(cnt(M, (x) => k(x.department) === k(n)), "member", "members");
    if (tab === "cities") { add(cnt(M, (x) => k(x.location) === k(n)), "member", "members"); add(cnt(P, (x) => k(x.city) === k(n)) + cnt(D, (x) => k(x.city) === k(n)), "project/developer", "projects/developers"); add(cnt(L, (x) => k(lastPart(x.location)) === k(n)), "lead", "leads"); add(state.m.localities.filter((l) => l.city_id === row.id).length, "locality", "localities"); }
    if (tab === "localities") { add(cnt(M, (x) => k(x.locality) === k(n) && k(x.location) === k(c)), "member", "members"); add(cnt(P, (x) => k(x.location) === k(n) && k(x.city) === k(c)), "project", "projects"); add(cnt(L, (x) => k(headParts(x.location)) === k(n) && k(lastPart(x.location)) === k(c)), "lead", "leads"); }
    return parts.join(" · ");
  }
  const cascadeSpec = (tab, row) => tab === "teams" ? [["team_members", "team"]] : tab === "departments" ? [["team_members", "department"]]
    : tab === "cities" ? [["team_members", "location"], ["projects", "city"], ["developers", "city"]] : [["team_members", "locality", "location", cityName()], ["projects", "location", "city", cityName()]];

  function rows() {
    const q = k(state.q), t = state.tab, list = t === "localities" ? state.m.localities.filter((l) => l.city_id === state.city) : state.m[t];
    return list.filter((r) => !q || k(r.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }

  function draw() {
    if (state.err) { page.innerHTML = '<div class="card empty">Could not load settings: ' + esc(state.err) + "</div>"; return; }
    const [, label, noun, icon] = TABS.find((t) => t[0] === state.tab), list = rows(), loc = state.tab === "localities", noCity = loc && !state.m.cities.length;
    render(page, html`
      <div class="page-head"><div><h1>Settings</h1><p class="sub">The lists below fill the dropdowns across the CRM (team members, leads, projects), so names stay the same everywhere.</p></div></div>
      <div class="tabs-pill" role="tablist">${TABS.map(([key, l, , ic]) => html`<button type="button" role="tab" class="pill ${key === state.tab ? "active" : ""}" aria-selected="${key === state.tab}" data-tab="${key}">${l} (${state.m[key].length})</button>`)}</div>
      <section class="card p st-card">
        <div class="st-bar">
          ${loc && state.m.cities.length ? html`<label class="st-city">City<select class="select" id="stCity" aria-label="City">${state.m.cities.map((c) => html`<option value="${c.id}" ${c.id === state.city ? raw("selected") : raw("")}>${c.name}</option>`)}</select></label>` : raw("")}
          <input class="select st-q" id="stQ" type="search" placeholder="Search ${label.toLowerCase()}…" value="${state.q}" aria-label="Search ${label}">
          <button type="button" class="btn" id="stImport" ${noCity ? raw("disabled") : raw("")}><i data-lucide="download"></i>Import from existing data</button>
          <button type="button" class="btn gold" id="stAdd" ${noCity ? raw("disabled") : raw("")}><i data-lucide="plus"></i>Add ${noun.toLowerCase()}</button></div>
        ${noCity ? html`<div class="empty-sm">Add a city first, then add its localities.</div>`
          : list.length ? html`<ul class="st-list">${list.map((r) => html`<li data-id="${r.id}"><i data-lucide="${icon}" class="st-ic"></i><div class="st-main"><b>${r.name}</b><small>${usage(state.tab, r) || "Not used yet"}</small></div>
            <button type="button" class="icon-btn" data-edit="${r.id}" aria-label="Rename ${r.name}"><i data-lucide="pencil"></i></button><button type="button" class="icon-btn" data-del="${r.id}" aria-label="Delete ${r.name}"><i data-lucide="trash-2"></i></button></li>`)}</ul>`
          : html`<div class="empty-sm">${state.q ? "Nothing matches your search." : "No " + label.toLowerCase() + " yet. Add them here, or import the ones already typed in the CRM."}</div>`}
      </section>`);
    wire();
  }
  const refresh = async () => { await load(); draw(); };
  const table = () => state.tab;                // table name equals the tab key

  function wire() {
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; state.q = ""; draw(); }));
    const q = page.querySelector("#stQ"); q.oninput = () => { state.q = q.value; const pos = q.selectionStart; draw(); const n = page.querySelector("#stQ"); n.focus(); n.setSelectionRange(pos, pos); };
    const cs = page.querySelector("#stCity"); if (cs) cs.onchange = () => { state.city = Number(cs.value); draw(); };
    page.querySelector("#stAdd").onclick = openAdd; page.querySelector("#stImport").onclick = openImport;
    page.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openRename(rows().find((r) => r.id === Number(b.dataset.edit)))));
    page.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => del(rows().find((r) => r.id === Number(b.dataset.del)))));
  }

  const noun = () => TABS.find((t) => t[0] === state.tab)[2];
  function openAdd() {
    const t = state.tab, loc = t === "localities";
    openModal("Add " + noun().toLowerCase() + (loc ? " to " + cityName() : ""), html`<div class="form"><label class="full">${noun()} names * <small class="muted">(one per line to add several)</small><textarea name="names" rows="5" required maxlength="4000" placeholder="${t === "teams" ? "Pune Team\\nMumbai Team" : t === "departments" ? "Sales\\nMarketing\\nOperations" : t === "cities" ? "Pune\\nMumbai" : "Wakad\\nHinjewadi"}"></textarea></label></div>`,
      async (f) => {
        const have = new Set((loc ? state.m.localities.filter((l) => l.city_id === state.city) : state.m[t]).map((r) => k(r.name))), seen = new Set(), rowsNew = [];
        String(f.names).split(/\r?\n/).map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean).forEach((n) => { if (n.length > 80) throw new Error('"' + n.slice(0, 20) + '…" is too long (80 characters at most)'); if (seen.has(k(n))) return; seen.add(k(n)); if (!have.has(k(n))) rowsNew.push(loc ? { name: n, city_id: state.city } : { name: n }); });
        const skipped = seen.size - rowsNew.length;
        if (!rowsNew.length) throw new Error(skipped ? "These already exist" : "Enter at least one name");
        const r = await Data.addMasters(t, rowsNew); toast(r.added + " added" + (skipped + r.dup ? ", " + (skipped + r.dup) + " already existed" : "")); await refresh();
      }, "Add");
  }
  function openRename(row) {
    if (!row) return;
    openModal("Rename " + noun().toLowerCase(), html`<div class="form">${field(noun() + " name *", "name", row.name, "text", 'required maxlength="80"', "full")}
      <p class="sub full">${state.tab === "cities" ? "Team members, projects and developers using the old name follow the new one. Leads keep the text they already have." : state.tab === "localities" ? "Team members and projects using the old name follow the new one. Leads keep the text they already have." : "Team members using the old name follow the new one."}</p></div>`,
      async (f) => {
        const name = f.name.replace(/\s+/g, " ");
        if (k(name) === k(row.name) && name === row.name) return;
        await Data.renameMaster(table(), row.id, name);
        if (name !== row.name) await Data.cascadeRename(cascadeSpec(state.tab, row), row.name, name);
        toast("Renamed"); await refresh();
      }, "Save");
  }
  async function del(row) {
    if (!row) return;
    const u = usage(state.tab, row), extra = state.tab === "cities" ? " Its localities are removed too." : "";
    if (!confirm('Delete "' + row.name + '"?' + (u ? " It is used by " + u + "." : "") + " Existing records keep the text they already have." + extra)) return;
    try { await Data.deleteMaster(table(), row.id); toast("Deleted"); await refresh(); } catch (e) { alert("Could not delete: " + e.message); }
  }

  // values already typed into members / projects / leads that are not in the list yet
  function suggestions() {
    const t = state.tab, M = state.members, P = state.projects, D = state.developers, L = state.leads, c = cityName(), have = new Set((t === "localities" ? state.m.localities.filter((l) => l.city_id === state.city) : state.m[t]).map((r) => k(r.name))), tally = new Map();
    const add = (v) => { v = String(v || "").trim().replace(/\s+/g, " "); if (!v || v.length > 80 || have.has(k(v))) return; const e = tally.get(k(v)) || { name: v, n: 0 }; e.n++; tally.set(k(v), e); };
    if (t === "teams") M.forEach((x) => add(x.team));
    if (t === "departments") M.forEach((x) => add(x.department));
    if (t === "cities") { M.forEach((x) => add(x.location)); P.forEach((x) => add(x.city)); D.forEach((x) => add(x.city)); L.forEach((x) => add(lastPart(x.location))); }
    if (t === "localities") { M.forEach((x) => k(x.location) === k(c) && add(x.locality)); P.forEach((x) => k(x.city) === k(c) && add(x.location)); L.forEach((x) => k(lastPart(x.location)) === k(c) && add(headParts(x.location))); }
    return [...tally.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }
  function openImport() {
    const t = state.tab, items = suggestions().map((s) => ({ id: s.name, label: s.name, sub: "found " + s.n + (s.n === 1 ? " time" : " times") + " in the CRM" }));
    pickDialog({ title: "Import " + TABS.find((x) => x[0] === t)[1].toLowerCase() + (t === "localities" ? " for " + cityName() : ""), intro: "These values are already typed in team members, projects, developers or leads. Tick the ones to add to the list.",
      tabs: [{ key: "x", label: "Suggestions", items, empty: "Nothing new to import." }], saveLabel: "Add selected",
      onSave: async (sel) => {
        if (!sel.x.length) throw new Error("Tick at least one");
        const r = await Data.addMasters(t, sel.x.map((n) => (t === "localities" ? { name: n, city_id: state.city } : { name: n })));
        toast(r.added + " added"); await refresh();
      } });
  }

  await load(); draw();
})();
