// Two alert icons in the top bar, separate from the lead bell: Follow-ups (due and overdue lead follow-ups) and Tasks (due and overdue manual tasks).
// Each shows a red count of what is due now and opens a small panel; the lists refresh every minute and whenever a lead or task changes.
// A refresh that fails keeps the last good numbers, so a hiccup never looks like "nothing is due".
window.Alerts = (function () {
  const SHOW = 6, panels = [];
  const duePast = (ts) => new Date(ts) <= new Date();
  const when = (ts) => { const d = new Date(ts); return duePast(ts) ? "Overdue " + relTime(ts) : "Today " + fmtTime(d); };

  function make(cfg) {
    const btn = document.getElementById(cfg.btn), wrap = btn && btn.parentNode; if (!btn || btn.dataset.ready) return; btn.dataset.ready = "1";
    const panel = document.createElement("div"); panel.className = "al-panel"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", cfg.label); wrap.appendChild(panel);
    const badge = btn.querySelector(".bell-n"), P = { open: false, items: null, busy: "" };
    const due = () => (P.items || []).filter((x) => duePast(cfg.when(x))).length;
    function paint() {
      const n = due(); badge.hidden = n === 0; badge.textContent = n > 99 ? "99+" : String(n);
      btn.setAttribute("aria-label", n ? `${cfg.label}, ${n} due` : cfg.label); btn.classList.toggle("has-due", n > 0);
      if (!P.open) return;
      const list = P.items || [], over = list.filter((x) => duePast(cfg.when(x))), later = list.filter((x) => !duePast(cfg.when(x)));
      const block = (title, arr, cls) => arr.length ? html`<h5 class="${cls}">${title} (${arr.length})</h5><ul class="nf-al">${arr.slice(0, SHOW).map((x) => cfg.row(x, P))}</ul>${arr.length > SHOW ? html`<a class="nf-more" href="tasks.html">View all ${arr.length}</a>` : raw("")}` : raw("");
      panel.innerHTML = html`<div class="nf-h"><b><i data-lucide="${cfg.icon}"></i> ${cfg.label}</b><span class="nf-sp"></span><a class="btn sm" href="tasks.html">Open all</a></div>
        <section class="nf-attn ${list.length ? "" : "ok"}" aria-label="${cfg.label}">
          ${P.items === null ? html`<small class="muted">Loading…</small>` : list.length ? html`${block("Overdue", over, "al-over")}${block("Due later today", later, "")}` : html`<b><i data-lucide="circle-check"></i> ${cfg.empty}</b>`}</section>
        <div class="nf-f"><a href="tasks.html">Open Tasks &amp; Follow-ups</a></div>`.__raw;
      if (window.lucide) lucide.createIcons(); cfg.wire && cfg.wire(panel, P, load);
    }
    async function load() { try { P.items = await cfg.load(); } catch { return; } paint(); }
    function toggle(open) {
      P.open = open === undefined ? !P.open : open; panel.hidden = !P.open; btn.setAttribute("aria-expanded", String(P.open));
      if (P.open) { document.dispatchEvent(new CustomEvent("k99:panel-open", { detail: cfg.btn })); paint(); load(); }
    }
    btn.onclick = (e) => { e.stopPropagation(); toggle(); };
    document.addEventListener("mousedown", (e) => { if (P.open && !panel.contains(e.target) && !btn.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && P.open) { toggle(false); btn.focus(); } });
    document.addEventListener("k99:panel-open", (e) => { if (P.open && e.detail !== cfg.btn) toggle(false); });
    window.addEventListener("k99:lead-changed", load); window.addEventListener("k99:task-changed", load);
    setInterval(() => { if (!document.hidden) load(); }, 60000); document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); }); panels.push({ load }); load();
  }

  const row = (l, note) => html`<li><a class="nf-ar" href="customer.html?id=${encodeURIComponent("L-" + l.dbId)}" aria-label="Open ${l.name}">${avatar(l.name, 32)}<span class="nf-t"><b>${l.name}</b><span>${note}${l.project ? " · " + l.project : ""}</span></span></a><a class="icon-btn" href="${telHref(l.mobile)}" data-lead="${l.dbId}" aria-label="Call ${l.name}"><i data-lucide="phone"></i></a><a class="icon-btn" href="${waHref(l.mobile)}" data-lead="${l.dbId}" target="_blank" rel="noopener" aria-label="WhatsApp ${l.name}"><i data-lucide="message-circle"></i></a></li>`;

  function init() {
    make({ btn: "fuBtn", label: "Follow-ups", icon: "phone-call", empty: "No follow-ups due today.", load: () => Data.getFollowUpAlerts(), when: (l) => l.followUpTs, row: (l) => row(l, when(l.followUpTs)) });
    make({ btn: "tkBtn", label: "Tasks", icon: "list-checks", empty: "No tasks due today.", load: () => Data.getTaskAlerts(), when: (t) => t.due_at,
      row: (t, P) => html`<li><button type="button" class="icon-btn al-done" data-done="${t.id}" aria-label="Mark ${t.title} done" title="Mark done" ${P.busy ? raw("disabled") : raw("")}><i data-lucide="circle"></i></button><a class="nf-ar" href="tasks.html" aria-label="Open ${t.title}"><span class="nf-t"><b>${t.title}</b><span>${t.type || "Task"} · ${when(t.due_at)}</span></span></a></li>`,
      wire: (panel, P, reload) => panel.querySelectorAll("[data-done]").forEach((b) => (b.onclick = async (e) => {
        e.stopPropagation(); P.busy = "1"; b.disabled = true;
        try { await Data.updateTask(Number(b.dataset.done), { done_at: new Date().toISOString() }); toast("Task marked done"); window.dispatchEvent(new CustomEvent("k99:task-changed")); }
        catch (x) { toast("Could not update the task: " + (x.message || x)); }
        P.busy = ""; reload();
      })) });
  }
  return { init, refresh: () => panels.forEach((p) => p.load()) };
})();
