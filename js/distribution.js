// Shared pieces for lead distribution: a searchable checklist dialog, "connect forms / campaigns to a project" and "add team members to a project".
// Used by the Projects page and by the Facebook forms tab on Integrations.

// A dialog with optional tabs and a searchable checklist. tabs: [{ key, label, items: [{ id, label, sub, badge, checked, disabled }] }].
// onSave(selected) gets { [tabKey]: [ids ticked] } and may throw to show an error in the dialog.
function pickDialog({ title, intro, tabs, saveLabel = "Save", footer, onSave, onChange }) {
  const ov = document.createElement("div"); ov.className = "overlay open";
  ov.innerHTML = `<form class="modal pick-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${intro ? `<p class="sub pick-intro">${intro}</p>` : ""}
    ${tabs.length > 1 ? `<div class="tabs-pill pick-tabs">${tabs.map((t, i) => `<button type="button" class="pill ${i ? "" : "active"}" data-tab="${esc(t.key)}">${esc(t.label)} <span class="pick-n"></span></button>`).join("")}</div>` : ""}
    <label class="pick-search"><i data-lucide="search"></i><input type="search" placeholder="Search…" aria-label="Search"></label>
    <div class="pick-list" role="group"></div><div class="pick-foot">${footer || ""}</div><div class="form-err" role="alert" hidden></div>
    <div class="actions"><button type="button" class="btn" data-x>Cancel</button><button class="btn gold" type="submit">${esc(saveLabel)}</button></div></form>`;
  document.body.appendChild(ov); if (window.lucide) lucide.createIcons();
  const form = ov.querySelector("form"), list = form.querySelector(".pick-list"), q = form.querySelector("input[type=search]"), err = form.querySelector(".form-err");
  const picked = {}; tabs.forEach((t) => (picked[t.key] = new Set(t.items.filter((i) => i.checked).map((i) => String(i.id)))));
  let cur = tabs[0].key; const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); }, onKey = (e) => { if (e.key === "Escape" && !document.querySelector(".sg-pop:not([hidden])")) close(); };
  document.addEventListener("keydown", onKey);
  const counts = () => form.querySelectorAll(".pick-tabs .pick-n").forEach((n, i) => { const c = picked[tabs[i].key].size; n.textContent = c ? "(" + c + ")" : ""; });
  const paint = () => {
    const t = tabs.find((x) => x.key === cur), term = q.value.trim().toLowerCase();
    const rows = t.items.filter((i) => !term || (i.label + " " + (i.sub || "")).toLowerCase().includes(term));
    list.innerHTML = rows.length ? rows.map((i) => `<label class="pick-o ${i.disabled ? "off" : ""}"><input type="checkbox" value="${esc(i.id)}" ${picked[cur].has(String(i.id)) ? "checked" : ""} ${i.disabled ? "disabled" : ""}><span class="pick-t"><b>${esc(i.label)}</b>${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span>${i.badge ? `<em class="pick-b">${esc(i.badge)}</em>` : ""}</label>`).join("") : `<p class="pick-none">${t.items.length ? "Nothing matches your search." : esc(t.empty || "Nothing to show yet.")}</p>`;
    counts();
  };
  list.addEventListener("change", (e) => { const c = e.target; if (c.type !== "checkbox") return; c.checked ? picked[cur].add(c.value) : picked[cur].delete(c.value); counts(); if (onChange) onChange(picked, form); });
  q.addEventListener("input", paint);
  form.querySelectorAll(".pick-tabs [data-tab]").forEach((b) => (b.onclick = () => { cur = b.dataset.tab; form.querySelectorAll(".pick-tabs .pill").forEach((x) => x.classList.toggle("active", x === b)); paint(); }));
  form.querySelector("[data-x]").onclick = close; ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
  form.onsubmit = async (e) => {
    e.preventDefault(); err.hidden = true; const btn = form.querySelector("[type=submit]"); btn.disabled = true;
    try { await onSave(Object.fromEntries(Object.entries(picked).map(([k, v]) => [k, [...v]])), form); close(); } catch (x) { btn.disabled = false; err.textContent = "Could not save: " + (x.message || x); err.hidden = false; }
  };
  paint(); q.focus(); if (onChange) onChange(picked, form);
  return { close };
}

// Connect Facebook / Instagram forms and campaigns to a registered project.
// ctx: { project (registered row), sources (all project_sources), projects (all registered), metaForms, leads, integrations? }
async function openConnectForms(ctx, done) {
  const { project, sources, projects, metaForms, leads } = ctx, byName = new Map(projects.map((p) => [p.id, p.name]));
  const mine = (kind) => new Set(sources.filter((s) => s.project_id === project.id && s.kind === kind).map((s) => String(s.ref_id)));
  const where = (kind, id) => { const s = sources.find((x) => x.kind === kind && String(x.ref_id) === String(id)); return s && s.project_id !== project.id ? "on " + (byName.get(s.project_id) || "another project") : ""; };
  const m = mine("meta_form"), c = mine("meta_campaign");
  const forms = metaForms.map((f) => ({ id: f.form_id, label: f.name || f.form_id, sub: [f.status, f.leads_count != null ? f.leads_count + " leads" : "", f.page_id ? "Page " + f.page_id : ""].filter(Boolean).join(" · "), badge: where("meta_form", f.form_id), checked: m.has(String(f.form_id)) }));
  metaForms.forEach((f) => m.delete(String(f.form_id))); m.forEach((id) => forms.push({ id, label: (sources.find((s) => s.kind === "meta_form" && String(s.ref_id) === id) || {}).label || id, sub: "connected form", checked: true }));
  const camp = new Map(); leads.forEach((l) => { const id = l.src && l.src.campaignId; if (!id) return; const x = camp.get(id) || { id, label: l.src.campaign || id, n: 0 }; x.n++; camp.set(id, x); });
  const campaigns = [...camp.values()].sort((a, b) => b.n - a.n).map((x) => ({ id: x.id, label: x.label, sub: x.n + (x.n === 1 ? " lead so far" : " leads so far"), badge: where("meta_campaign", x.id), checked: c.has(String(x.id)) }));
  c.forEach((id) => { if (!camp.has(id)) campaigns.push({ id, label: (sources.find((s) => s.kind === "meta_campaign" && String(s.ref_id) === id) || {}).label || id, sub: "connected campaign", checked: true }); });
  const label = (kind, id) => ((kind === "meta_form" ? forms : campaigns).find((x) => String(x.id) === String(id)) || {}).label || id;
  const foot = '<label class="pick-apply"><input type="checkbox" id="pickApply"> <span id="pickApplyT">Also set the project on past leads of these forms that have none</span></label>';
  pickDialog({
    title: "Connect forms to " + project.name,
    intro: "Every new lead from a ticked form or campaign gets <b>" + esc(project.name) + "</b> as its project, so it goes to the team assigned here. A form can belong to one project only: ticking one that is on another project moves it.",
    tabs: [{ key: "meta_form", label: "Facebook & Instagram forms", items: forms, empty: "No forms yet. Open Integrations → Facebook & Instagram and press Sync forms." }, { key: "meta_campaign", label: "Campaigns", items: campaigns, empty: "Campaigns appear here after their first lead arrives." }],
    saveLabel: "Save connections", footer: foot,
    onChange: async (picked, form) => {
      const t = form.querySelector("#pickApplyT"); if (!t) return;
      try { const n = await Data.countUnrouted([...picked.meta_form], [...picked.meta_campaign]); t.textContent = "Also set the project on " + n + " past lead" + (n === 1 ? "" : "s") + " of these forms that have none"; form.querySelector("#pickApply").disabled = !n; } catch { /* the count is a nicety */ }
    },
    onSave: async (sel, form) => {
      const add = [], del = [];
      [["meta_form", mine("meta_form")], ["meta_campaign", mine("meta_campaign")]].forEach(([kind, had]) => {
        const now = new Set(sel[kind]); now.forEach((id) => { if (!had.has(id)) add.push({ kind, ref_id: id, label: label(kind, id) }); });
        had.forEach((id) => { if (!now.has(id)) { const s = sources.find((x) => x.kind === kind && String(x.ref_id) === id && x.project_id === project.id); if (s) del.push(s.id); } });
      });
      for (const id of del) await Data.disconnectSource(id);
      await Data.connectSources(project.id, add);
      let applied = 0; if (add.length && form.querySelector("#pickApply").checked) applied = await Data.applyToPastLeads(project.id);
      toast((add.length ? add.length + " connected" : "") + (add.length && del.length ? ", " : "") + (del.length ? del.length + " disconnected" : "") + (applied ? " · " + applied + " past leads updated" : "") || "No changes");
      if (done) await done();
    },
  });
}

// Add several team members to a project at once.
function openAddTeam(ctx, done) {
  const { project, team, members, leads } = ctx, have = new Set(members.filter((m) => m.project_id === project.id).map((m) => m.member_id));
  const items = team.filter((t) => (t.status || "Active") === "Active").map((t) => ({ id: t.id, label: t.name, sub: [t.kind === "rm" ? "Relationship Manager" : "Agent", t.team, t.location].filter(Boolean).join(" · "), checked: have.has(t.id) }));
  pickDialog({
    title: "Team for " + project.name, intro: "Tick everyone who should receive this project's leads. Un-ticking removes them from the project. You can set weights, pause someone, and choose how leads are shared afterwards.",
    tabs: [{ key: "team", label: "Team members", items, empty: "No active team members yet. Add some in Agents & Teams." }], saveLabel: "Save team",
    onSave: async (sel) => {
      const now = new Set(sel.team.map(Number)), add = [...now].filter((id) => !have.has(id));
      for (const id of [...have].filter((x) => !now.has(x))) await Data.removeProjectMember(project.id, id);
      await Data.setProjectMembers(project.id, add);
      toast(add.length ? add.length + " added to " + project.name : "Team updated"); if (done) await done();
    },
  });
}
