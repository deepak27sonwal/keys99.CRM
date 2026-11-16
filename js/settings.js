// Settings (admin only): the master lists that drive dropdowns across the CRM: Teams, Departments, Cities and Localities (inside a city).
(async function () {
  const page = await mountShell("settings");
  if (!page) return;
  const TABS = [["teams", "Teams", "Team", "users"], ["departments", "Departments", "Department", "briefcase"], ["designations", "Designations", "Designation", "badge-check"], ["cities", "Cities", "City", "building"], ["localities", "Localities", "Locality", "map-pin"], ["templates", "WhatsApp templates", "Template", "message-circle"]];
  const state = { tpl: [], tab: "teams", q: "", city: null, dept: null, m: { teams: [], departments: [], cities: [], localities: [], designations: [] }, members: [], projects: [], developers: [], leads: [], err: "" };
  const k = (x) => String(x || "").trim().toLowerCase(), cnt = (arr, fn) => arr.filter(fn).length;
  const lastPart = (loc) => String(loc || "").split(",").map((x) => x.trim()).filter(Boolean).pop() || "";
  const headParts = (loc) => String(loc || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, -1).join(", ");

  async function load() {
    try {
      const [m, members, projects, developers, leads] = await Promise.all([Data.getMasters(), Data.getTeam(), Data.getProjects().catch(() => []), Data.getDevelopers().catch(() => []), Data.getLeads().catch(() => [])]);
      Object.assign(state, { m, members, projects, developers, leads, err: "" }); state.tpl = await Data.getTemplates();
      if (!state.city || !m.cities.some((c) => c.id === state.city)) state.city = m.cities.length ? m.cities[0].id : null;
      if (!state.dept || !m.departments.some((d) => d.id === state.dept)) state.dept = m.departments.length ? m.departments[0].id : null;
    } catch (e) { state.err = e.message || String(e); }
  }
  // Localities live inside a city and Designations inside a department: those tabs work on one "parent" at a time
  const isChild = (t) => t === "localities" || t === "designations";
  const parent = (t) => (t === "localities" ? { list: state.m.cities, id: state.city, key: "city_id", label: "City", set: (v) => (state.city = v) } : { list: state.m.departments, id: state.dept, key: "department_id", label: "Department", set: (v) => (state.dept = v) });
  const parentName = (t) => (parent(t).list.find((x) => x.id === parent(t).id) || {}).name || "";
  const childRows = (t) => state.m[t].filter((r) => r[parent(t).key] === parent(t).id);
  // sensible real-estate defaults, matched to a department by its name
  const DEPT_SUGGEST = ["Sales", "Pre-Sales / Telecalling", "Marketing", "Operations / CRM", "Accounts & Finance", "HR & Admin", "Legal & Documentation", "Management"];
  const DESIG_SUGGEST = [[/sales/i, ["Sales Executive", "Senior Sales Executive", "Relationship Manager", "Senior Relationship Manager", "Team Leader", "Sales Manager", "Senior Sales Manager", "Business Head"]],
    [/pre.?sales|tele/i, ["Telecaller", "Pre-Sales Executive", "Lead Qualifier", "Pre-Sales Team Leader"]], [/market/i, ["Digital Marketing Executive", "Performance Marketer", "Content Creator", "Marketing Manager"]],
    [/oper|crm/i, ["CRM Executive", "Documentation Executive", "Site Visit Coordinator", "Operations Manager"]], [/account|financ/i, ["Accounts Executive", "Accountant", "Finance Manager"]],
    [/hr|admin|human/i, ["HR Executive", "Admin Executive", "Office Manager"]], [/legal|document/i, ["Legal Advisor", "Documentation Executive"]], [/manage|direct|leader/i, ["Director", "General Manager"]]];
  const desigDefaults = (dept) => (DESIG_SUGGEST.find(([re]) => re.test(dept)) || [, []])[1];
  const cityName = () => (state.m.cities.find((c) => c.id === state.city) || {}).name || "";

  // how many records use each value (shown so deleting is an informed choice)
  function usage(tab, row) {
    const M = state.members, P = state.projects, D = state.developers, L = state.leads, n = row.name, c = cityName(), dn = parentName("designations"), parts = [];
    const add = (v, one, many) => { if (v) parts.push(v + " " + (v === 1 ? one : many)); };
    if (tab === "teams") add(cnt(M, (x) => k(x.team) === k(n)), "member", "members");
    if (tab === "departments") { add(cnt(M, (x) => k(x.department) === k(n)), "member", "members"); add(state.m.designations.filter((d) => d.department_id === row.id).length, "designation", "designations"); }
    if (tab === "designations") add(cnt(M, (x) => k(x.designation) === k(n) && k(x.department) === k(dn)), "member", "members");
    if (tab === "cities") { add(cnt(M, (x) => k(x.location) === k(n)), "member", "members"); add(cnt(P, (x) => k(x.city) === k(n)) + cnt(D, (x) => k(x.city) === k(n)), "project/developer", "projects/developers"); add(cnt(L, (x) => k(lastPart(x.location)) === k(n)), "lead", "leads"); add(state.m.localities.filter((l) => l.city_id === row.id).length, "locality", "localities"); }
    if (tab === "localities") { add(cnt(M, (x) => k(x.locality) === k(n) && k(x.location) === k(c)), "member", "members"); add(cnt(P, (x) => k(x.location) === k(n) && k(x.city) === k(c)), "project", "projects"); add(cnt(L, (x) => k(headParts(x.location)) === k(n) && k(lastPart(x.location)) === k(c)), "lead", "leads"); }
    return parts.join(" · ");
  }
  const cascadeSpec = (tab, row) => tab === "teams" ? [["team_members", "team"]] : tab === "departments" ? [["team_members", "department"]] : tab === "designations" ? [["team_members", "designation", "department", parentName("designations")]]
    : tab === "cities" ? [["team_members", "location"], ["projects", "city"], ["developers", "city"]] : [["team_members", "locality", "location", cityName()], ["projects", "location", "city", cityName()]];

  function rows() {
    const q = k(state.q), t = state.tab, list = isChild(t) ? childRows(t) : state.m[t];
    return list.filter((r) => !q || k(r.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }

  function draw() {
    if (state.err) { page.innerHTML = '<div class="card empty">Could not load settings: ' + esc(state.err) + "</div>"; return; }
    if (state.tab === "templates") return drawTemplates();
    const [, label, noun, icon] = TABS.find((t) => t[0] === state.tab), list = rows(), loc = isChild(state.tab), par = parent(state.tab), noCity = loc && !par.list.length;
    render(page, html`
      <div class="page-head"><div><h1>Settings</h1><p class="sub">The lists below fill the dropdowns across the CRM (team members, leads, projects), so names stay the same everywhere.</p></div></div>
      <div class="tabs-pill" role="tablist">${TABS.map(([key, l, , ic]) => html`<button type="button" role="tab" class="pill ${key === state.tab ? "active" : ""}" aria-selected="${key === state.tab}" data-tab="${key}">${l} (${key === "templates" ? state.tpl.length : state.m[key].length})</button>`)}</div>
      <section class="card p st-card">
        <div class="st-bar">
          ${loc && par.list.length ? html`<label class="st-city">${par.label}<select class="select" id="stCity" aria-label="${par.label}">${par.list.map((c) => html`<option value="${c.id}" ${c.id === par.id ? raw("selected") : raw("")}>${c.name}</option>`)}</select></label>` : raw("")}
          <input class="select st-q" id="stQ" type="search" placeholder="Search ${label.toLowerCase()}…" value="${state.q}" aria-label="Search ${label}">
          <button type="button" class="btn" id="stImport" ${noCity ? raw("disabled") : raw("")}><i data-lucide="download"></i>Import from existing data</button>
          <button type="button" class="btn gold" id="stAdd" ${noCity ? raw("disabled") : raw("")}><i data-lucide="plus"></i>Add ${noun.toLowerCase()}</button></div>
        ${noCity ? html`<div class="empty-sm">Add a ${par.label.toLowerCase()} first, then add its ${label.toLowerCase()}.${state.tab === "designations" ? " (Departments tab → Import → Suggested departments gives you a starting set.)" : ""}</div>`
          : list.length ? html`<ul class="st-list">${list.map((r) => html`<li data-id="${r.id}"><i data-lucide="${icon}" class="st-ic"></i><div class="st-main"><b>${r.name}</b><small>${usage(state.tab, r) || "Not used yet"}</small></div>
            <button type="button" class="icon-btn" data-edit="${r.id}" aria-label="Rename ${r.name}"><i data-lucide="pencil"></i></button><button type="button" class="icon-btn" data-del="${r.id}" aria-label="Delete ${r.name}"><i data-lucide="trash-2"></i></button></li>`)}</ul>`
          : html`<div class="empty-sm">${state.q ? "Nothing matches your search." : "No " + label.toLowerCase() + " yet. Add them here, or import the ones already typed in the CRM" + (state.tab === "designations" || state.tab === "departments" ? " or use the suggested ones." : ".")}</div>`}
      </section>`);
    wire();
  }
  // ---- WhatsApp message templates: ready messages employees pick when they press WhatsApp on a lead ----
  function drawTemplates() {
    render(page, html`
      <div class="page-head"><div><h1>Settings</h1><p class="sub">The lists below fill the dropdowns across the CRM (team members, leads, projects), so names stay the same everywhere.</p></div></div>
      <div class="tabs-pill" role="tablist">${TABS.map(([key, l]) => html`<button type="button" role="tab" class="pill ${key === state.tab ? "active" : ""}" aria-selected="${key === state.tab}" data-tab="${key}">${l} (${key === "templates" ? state.tpl.length : state.m[key].length})</button>`)}</div>
      <section class="card p st-card"><div class="st-bar"><p class="sub" style="flex:1;margin:0">Ready messages for WhatsApp. Use <code>{name}</code>, <code>{project}</code>, <code>{agent}</code> and <code>{phone}</code>; they are filled in for each lead.</p><button type="button" class="btn gold" id="tpAdd"><i data-lucide="plus"></i>Add template</button></div>
        ${state.tpl.length ? html`<ul class="st-list">${state.tpl.map((t) => html`<li><i data-lucide="message-circle" class="st-ic"></i><div class="st-main"><b>${t.title}</b><small class="tp-body">${t.body}</small></div>
          <button type="button" class="icon-btn" data-tedit="${t.id}" aria-label="Edit ${t.title}"><i data-lucide="pencil"></i></button><button type="button" class="icon-btn" data-tdel="${t.id}" aria-label="Delete ${t.title}"><i data-lucide="trash-2"></i></button></li>`)}</ul>`
          : html`<div class="empty-sm">No templates yet. Employees will open WhatsApp directly.</div>`}</section>`);
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; state.q = ""; draw(); }));
    page.querySelector("#tpAdd").onclick = () => openTemplate(null);
    page.querySelectorAll("[data-tedit]").forEach((b) => (b.onclick = () => openTemplate(state.tpl.find((t) => t.id === Number(b.dataset.tedit)))));
    page.querySelectorAll("[data-tdel]").forEach((b) => (b.onclick = async () => { const t = state.tpl.find((x) => x.id === Number(b.dataset.tdel)); if (!t || !confirm('Delete the template "' + t.title + '"?')) return; try { await Data.deleteTemplate(t.id); toast("Deleted"); await refresh(); } catch (e) { alert("Could not delete: " + e.message); } }));
  }
  function openTemplate(t) {
    openModal(t ? "Edit template" : "Add template", html`<div class="form">${field("Title *", "title", t ? t.title : "", "text", 'required maxlength="60" placeholder="e.g. Site visit invite"', "full")}
      <label class="full">Message * <small class="muted">({name} {project} {agent} {phone})</small><textarea name="body" rows="5" required maxlength="900" placeholder="Hi {name}, thank you for your interest in {project}…">${t ? t.body : ""}</textarea></label></div>`,
      async (f) => { await Data.saveTemplate(t ? t.id : null, f); toast("Saved"); await refresh(); }, "Save");
  }

  const refresh = async () => { await load(); draw(); };
  const table = () => state.tab;                // table name equals the tab key

  function wire() {
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; state.q = ""; draw(); }));
    const q = page.querySelector("#stQ"); q.oninput = () => { state.q = q.value; const pos = q.selectionStart; draw(); const n = page.querySelector("#stQ"); n.focus(); n.setSelectionRange(pos, pos); };
    const cs = page.querySelector("#stCity"); if (cs) cs.onchange = () => { parent(state.tab).set(Number(cs.value)); draw(); };
    page.querySelector("#stAdd").onclick = openAdd; page.querySelector("#stImport").onclick = openImport;
    page.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openRename(rows().find((r) => r.id === Number(b.dataset.edit)))));
    page.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => del(rows().find((r) => r.id === Number(b.dataset.del)))));
  }

  const noun = () => TABS.find((t) => t[0] === state.tab)[2];
  function openAdd() {
    const t = state.tab, loc = isChild(t), pk = parent(t).key, pid = parent(t).id;
    openModal("Add " + noun().toLowerCase() + (loc ? " to " + parentName(t) : ""), html`<div class="form"><label class="full">${noun()} names * <small class="muted">(one per line to add several)</small><textarea name="names" rows="5" required maxlength="4000" placeholder="${t === "teams" ? "Pune Team\\nMumbai Team" : t === "departments" ? "Sales\\nMarketing\\nOperations" : t === "cities" ? "Pune\\nMumbai" : t === "designations" ? "Sales Executive\\nTeam Leader" : "Wakad\\nHinjewadi"}"></textarea></label></div>`,
      async (f) => {
        const have = new Set((loc ? childRows(t) : state.m[t]).map((r) => k(r.name))), seen = new Set(), rowsNew = [];
        String(f.names).split(/\r?\n/).map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean).forEach((n) => { if (n.length > 80) throw new Error('"' + n.slice(0, 20) + '…" is too long (80 characters at most)'); if (seen.has(k(n))) return; seen.add(k(n)); if (!have.has(k(n))) rowsNew.push(loc ? { name: n, [pk]: pid } : { name: n }); });
        const skipped = seen.size - rowsNew.length;
        if (!rowsNew.length) throw new Error(skipped ? "These already exist" : "Enter at least one name");
        const r = await Data.addMasters(t, rowsNew); toast(r.added + " added" + (skipped + r.dup ? ", " + (skipped + r.dup) + " already existed" : "")); await refresh();
      }, "Add");
  }
  function openRename(row) {
    if (!row) return;
    openModal("Rename " + noun().toLowerCase(), html`<div class="form">${field(noun() + " name *", "name", row.name, "text", 'required maxlength="80"', "full")}
      <p class="sub full">${state.tab === "cities" ? "Team members, projects and developers using the old name follow the new one. Leads keep the text they already have." : state.tab === "localities" ? "Team members and projects using the old name follow the new one. Leads keep the text they already have." : state.tab === "designations" ? "Team members of this department using the old name follow the new one." : "Team members using the old name follow the new one."}</p></div>`,
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
    const u = usage(state.tab, row), extra = state.tab === "cities" ? " Its localities are removed too." : state.tab === "departments" ? " Its designations are removed too." : "";
    if (!confirm('Delete "' + row.name + '"?' + (u ? " It is used by " + u + "." : "") + " Existing records keep the text they already have." + extra)) return;
    try { await Data.deleteMaster(table(), row.id); toast("Deleted"); await refresh(); } catch (e) { alert("Could not delete: " + e.message); }
  }

  // values already typed into members / projects / leads that are not in the list yet
  function suggestions() {
    const t = state.tab, M = state.members, P = state.projects, D = state.developers, L = state.leads, c = cityName(), have = new Set((isChild(t) ? childRows(t) : state.m[t]).map((r) => k(r.name))), tally = new Map(), dn = parentName("designations");
    const add = (v) => { v = String(v || "").trim().replace(/\s+/g, " "); if (!v || v.length > 80 || have.has(k(v))) return; const e = tally.get(k(v)) || { name: v, n: 0 }; e.n++; tally.set(k(v), e); };
    if (t === "teams") M.forEach((x) => add(x.team));
    if (t === "departments") M.forEach((x) => add(x.department));
    if (t === "cities") { M.forEach((x) => add(x.location)); P.forEach((x) => add(x.city)); D.forEach((x) => add(x.city)); L.forEach((x) => add(lastPart(x.location))); }
    if (t === "localities") { M.forEach((x) => k(x.location) === k(c) && add(x.locality)); P.forEach((x) => k(x.city) === k(c) && add(x.location)); L.forEach((x) => k(lastPart(x.location)) === k(c) && add(headParts(x.location))); }
    if (t === "designations") M.forEach((x) => k(x.department) === k(dn) && add(x.designation));
    const out = [...tally.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    return out;
  }
  // ready-made starting values (real-estate channel partner) that are not in the list yet
  function defaults() {
    const t = state.tab, have = new Set((isChild(t) ? childRows(t) : state.m[t]).map((r) => k(r.name)));
    const list = t === "departments" ? DEPT_SUGGEST : t === "designations" ? desigDefaults(parentName("designations")) : [];
    return list.filter((n) => !have.has(k(n)));
  }
  function openImport() {
    const t = state.tab, found = suggestions().map((s) => ({ id: s.name, label: s.name, sub: "found " + s.n + (s.n === 1 ? " time" : " times") + " in the CRM" })), sug = defaults().filter((n) => !found.some((f) => k(f.label) === k(n))).map((n) => ({ id: n, label: n, sub: "suggested", checked: true })), items = [...found, ...sug];
    pickDialog({ title: "Import " + TABS.find((x) => x[0] === t)[1].toLowerCase() + (isChild(t) ? " for " + parentName(t) : ""), intro: "Values already typed in team members, projects, developers or leads" + (t === "departments" || t === "designations" ? ", plus suggested ones for a real-estate team" : "") + ". Tick the ones to add to the list.",
      tabs: [{ key: "x", label: "Suggestions", items, empty: "Nothing new to import." }], saveLabel: "Add selected",
      onSave: async (sel) => {
        if (!sel.x.length) throw new Error("Tick at least one");
        const r = await Data.addMasters(t, sel.x.map((n) => (isChild(t) ? { name: n, [parent(t).key]: parent(t).id } : { name: n })));
        toast(r.added + " added"); await refresh();
      } });
  }

  await load(); draw();
})();
