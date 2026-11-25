// Team alerts for reporting managers: one top-bar icon with a badge and a panel of what needs attention in the team
// (leads nobody has acted on, overdue follow-ups and tasks, site visits, milestones). The database does the counting (manager_alerts());
// this file only shows it. A refresh that fails keeps the last good numbers, and each alert type can be switched off in the panel.
window.TeamAlerts = (function () {
  const SHOW = 5;
  const TYPES = [["waiting", "Leads waiting", "Team leads nobody has acted on for 15 minutes"], ["followups", "Overdue follow-ups", "Follow-ups past their time"], ["tasks", "Overdue tasks", "Tasks past their due time"],
    ["visits", "Site visits", "Missed visits and visits today"], ["milestones", "Milestones", "Token Done, Booking Done / Cancelled, Spam in the last 24 hours"], ["summary", "Team today", "The one-line summary at the top"]];
  const state = { open: false, data: null, prefs: {}, settings: false, saving: false };
  const on = (k) => state.prefs[k] !== false;
  const lead = (id) => "customer.html?id=" + encodeURIComponent("L-" + id);
  const ago = (ts) => relTime(ts);

  function counts() { const c = (state.data && state.data.counts) || {}; return { waiting: on("waiting") ? c.waiting || 0 : 0, followups: on("followups") ? c.followups || 0 : 0, tasks: on("tasks") ? c.tasks || 0 : 0, missed: on("visits") ? c.visits_missed || 0 : 0 }; }
  const badgeN = () => { const c = counts(); return c.waiting + c.followups + c.tasks + c.missed; };

  function row(a, note) { return html`<li><a class="nf-ar" href="${a.href}" ${a.scope ? raw('data-scope="team"') : raw("")}>${avatar(a.name, 32)}<span class="nf-t"><b>${a.name}</b><span>${a.owner ? html`<i class="ta-own">${a.owner}</i> · ` : raw("")}${note}</span></span></a></li>`; }
  function block(title, arr, total, mk, more) {
    if (!arr.length) return raw("");
    return html`<h5>${title} (${total})</h5><ul class="nf-al">${arr.slice(0, SHOW).map(mk)}</ul>${total > SHOW ? html`<a class="nf-more" href="${more}" data-scope="team">View all ${total}</a>` : raw("")}`;
  }

  function body() {
    const d = state.data;
    if (!d) return html`<section class="nf-attn"><small class="muted">Loading…</small></section>`;
    const c = d.counts || {}, any = badgeN() + (on("visits") ? c.visits_today || 0 : 0) + (on("milestones") ? c.milestones || 0 : 0);
    const summary = on("summary") ? html`<div class="ta-sum" aria-label="Team today"><span><b>${c.new_today || 0}</b> new today</span><span><b>${c.visits_today || 0}</b> visits today</span><span class="${(c.followups || 0) ? "warn" : ""}"><b>${c.followups || 0}</b> overdue follow-ups</span><span class="${(c.inactive || 0) ? "warn" : ""}"><b>${c.inactive || 0}</b> not active yet</span></div>` : raw("");
    const parts = [
      on("waiting") ? block("Leads waiting", (d.waiting || []).map((x) => ({ name: x.name, owner: x.owner, href: lead(x.lead_id), note: "waiting " + ago(x.at).replace(/ ago$/, "") + (x.project ? " · " + x.project : "") })), c.waiting || 0, (x) => row(x, x.note), "leads.html") : raw(""),
      on("followups") ? block("Overdue follow-ups", (d.followups || []).map((x) => ({ name: x.name, owner: x.owner, href: lead(x.lead_id), note: "overdue " + ago(x.at).replace(/ ago$/, "") })), c.followups || 0, (x) => row(x, x.note), "tasks.html") : raw(""),
      on("tasks") ? block("Overdue tasks", (d.tasks || []).map((x) => ({ name: x.title, owner: x.owner, href: x.lead_id ? lead(x.lead_id) : "tasks.html", note: "due " + ago(x.at).replace(/ ago$/, "") + " ago" })), c.tasks || 0, (x) => row(x, x.note), "tasks.html") : raw(""),
      on("visits") ? block("Site visits missed", (d.visits_missed || []).map((x) => ({ name: x.name, owner: x.owner, href: lead(x.lead_id), note: "was " + fmtTime(new Date(x.at)) + ", " + ago(x.at) + (x.project ? " · " + x.project : "") })), c.visits_missed || 0, (x) => row(x, x.note), "site-visits.html") : raw(""),
      on("visits") ? block("Site visits today", (d.visits_today || []).map((x) => ({ name: x.name, owner: x.owner, href: lead(x.lead_id), note: fmtTime(new Date(x.at)) + (x.status === "Completed" ? " · done" : "") + (x.project ? " · " + x.project : "") })), c.visits_today || 0, (x) => row(x, x.note), "site-visits.html") : raw(""),
      on("milestones") ? block("Milestones (24 h)", (d.milestones || []).map((x) => ({ name: x.name, owner: x.owner, href: lead(x.lead_id), note: x.to + (x.reason ? " · " + x.reason : "") + " · " + ago(x.at) })), c.milestones || 0, (x) => row(x, x.note), "leads.html") : raw(""),
      on("summary") && (d.inactive || []).length ? html`<h5>Not active yet today (${(d.inactive || []).length})</h5><p class="ta-in">${d.inactive.map((p) => html`<span class="chip c-none">${p.name}</span>`)}</p>` : raw("")];
    return html`${summary}<section class="nf-attn ${any ? "" : "ok"}" aria-label="Team alerts">${any || (d.inactive || []).length ? html`${parts}` : html`<b><i data-lucide="circle-check"></i> Nothing needs attention in your team right now.</b>`}</section>`;
  }
  function settings() {
    return html`<div class="ta-set" role="group" aria-label="Alert settings"><p class="sub" style="margin:0 0 8px">Choose what Team alerts shows (saved on your account).</p>
      ${TYPES.map(([k, l, s]) => html`<label class="ta-sw"><input type="checkbox" data-pref="${k}" ${on(k) ? raw("checked") : raw("")}><span><b>${l}</b><small>${s}</small></span></label>`)}
      <div class="btns" style="margin-top:8px"><button type="button" class="btn sm" id="taBack">Back to alerts</button></div></div>`;
  }

  function paint(btn, panel) {
    const n = badgeN(), badge = btn.querySelector(".bell-n");
    badge.hidden = n === 0; badge.textContent = n > 99 ? "99+" : String(n); btn.setAttribute("aria-label", n ? `Team alerts, ${n} need attention` : "Team alerts"); btn.classList.toggle("has-due", n > 0);
    if (!state.open) return;
    panel.innerHTML = html`<div class="nf-h"><b><i data-lucide="users-round"></i> Team alerts</b><span class="nf-sp"></span><button type="button" class="icon-btn" id="taGear" aria-label="Alert settings" title="Alert settings"><i data-lucide="settings"></i></button></div>
      ${state.settings ? settings() : body()}
      <div class="nf-f"><a href="team.html">Open My Team</a></div>`.__raw;
    if (window.lucide) lucide.createIcons();
    panel.querySelectorAll("[data-scope]").forEach((a) => a.addEventListener("click", () => Scope.set("team")));
    const g = panel.querySelector("#taGear"); if (g) g.onclick = (e) => { e.stopPropagation(); state.settings = !state.settings; paint(btn, panel); };
    const bk = panel.querySelector("#taBack"); if (bk) bk.onclick = () => { state.settings = false; paint(btn, panel); };
    panel.querySelectorAll("[data-pref]").forEach((c) => (c.onchange = async () => {
      state.prefs = { ...state.prefs, [c.dataset.pref]: c.checked }; paint(btn, panel);
      try { await Data.savePrefs({ mgr_alerts: state.prefs }); } catch (e) { toast("Could not save the setting: " + (e.message || e)); }
    }));
  }

  function init() {
    const btn = document.getElementById("tmaBtn"), wrap = btn && btn.parentNode; if (!btn || btn.dataset.ready) return; btn.dataset.ready = "1";
    const panel = document.createElement("div"); panel.className = "al-panel ta-panel"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Team alerts"); wrap.appendChild(panel);
    async function load() { try { const d = await Data.getManagerAlerts(); if (d && d.manager) state.data = d; } catch { return; } paint(btn, panel); }
    function toggle(open) {
      state.open = open === undefined ? !state.open : open; panel.hidden = !state.open; btn.setAttribute("aria-expanded", String(state.open));
      if (state.open) { state.settings = false; document.dispatchEvent(new CustomEvent("k99:panel-open", { detail: "tmaBtn" })); paint(btn, panel); load(); }
    }
    btn.onclick = (e) => { e.stopPropagation(); toggle(); };
    document.addEventListener("mousedown", (e) => { if (state.open && !panel.contains(e.target) && !btn.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.open) { toggle(false); btn.focus(); } });
    document.addEventListener("k99:panel-open", (e) => { if (state.open && e.detail !== "tmaBtn") toggle(false); });
    window.addEventListener("k99:lead-changed", load); window.addEventListener("k99:task-changed", load);
    setInterval(() => { if (!document.hidden) load(); }, 60000); document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
    Data.getPrefs().then((p) => { state.prefs = (p && p.mgr_alerts) || {}; paint(btn, panel); }).catch(() => {});
    load();
  }
  return { init };
})();
