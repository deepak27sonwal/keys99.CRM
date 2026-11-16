// Daily workflow helpers loaded on every signed-in page:
//  - after pressing Call on a lead's number: a quick "How did the call go?" sheet (logs the outcome, sets the next follow-up)
//  - WhatsApp: pick a ready message (templates from Settings) with the lead's name / project filled in, and log it
//  - reminders: a toast (and a browser notice if allowed) when a follow-up or task becomes due, plus a count on "Tasks & Follow-ups"
window.Workflow = (() => {
  const OUTCOMES = [["Connected · interested", 2], ["Connected · call later", 1], ["No answer", 0.25], ["Busy", 0.25], ["Switched off / unreachable", 0.5], ["Wrong number", null], ["Not interested", null]];
  const at = (days, h = 11) => { const d = new Date(); if (days >= 1) { d.setDate(d.getDate() + Math.floor(days)); d.setHours(h, 0, 0, 0); } else d.setTime(d.getTime() + days * 86400000); d.setSeconds(0, 0); return toLocalInput(d.toISOString()); };
  const me = () => (window.ME && window.ME.member && window.ME.member.name) || "";

  // ---------- call outcome ----------
  // leadId = the lead whose Call button was pressed (several leads can share one number); without it the newest lead on that number is used
  const pickLead = (phone, leadId) => (Number(leadId) > 0 ? Data.getLead(Number(leadId)).catch(() => null) : Data.findLeadByPhone(phone).catch(() => null));
  async function callOutcome(phone, leadId) {
    const lead = await pickLead(phone, leadId); if (!lead) return;
    if (document.querySelector(".call-modal")) return;
    const pre = (v) => (v === null ? "" : at(v));
    openModal("How did the call go? · " + lead.name, html`<div class="form call-modal">
      <label class="full">Outcome *<select name="outcome" required>${OUTCOMES.map(([o]) => html`<option>${o}</option>`)}</select></label>
      ${field("Next follow-up", "follow_up", pre(OUTCOMES[0][1]), "datetime-local", "", "full")}
      <label class="full">Note (optional)<textarea name="note" rows="2" placeholder="e.g. Wants 3 BHK, budget 1.2 Cr, will visit Saturday"></textarea></label></div>`,
      async (f) => {
        await Data.appendActivity(lead.dbId, { type: "call", title: "Call · " + f.outcome, description: f.note || f.outcome, at: new Date().toISOString(), by: await Data.userEmail(), due: f.follow_up ? fromLocalInput(f.follow_up) : undefined });
        const patch = {}; if (f.follow_up) patch.followUp = fromLocalInput(f.follow_up);
        if (lead.status === "New Leads" && f.outcome.startsWith("Connected")) patch.status = "Contacted";
        if (Object.keys(patch).length) await Data.updateLead(lead.dbId, patch);
        toast("Call logged"); window.dispatchEvent(new CustomEvent("k99:lead-changed", { detail: lead.dbId })); poll();
      }, "Save");
    const m = document.querySelector(".overlay.open .modal"), sel = m && m.querySelector('[name="outcome"]'), fu = m && m.querySelector('[name="follow_up"]');
    if (sel && fu) sel.addEventListener("change", () => { const o = OUTCOMES.find((x) => x[0] === sel.value); fu.value = o && o[1] !== null ? at(o[1]) : ""; });
  }

  // ---------- WhatsApp templates ----------
  const fill = (body, lead) => body.replace(/\{name\}/g, lead.name.split(" ")[0] || lead.name).replace(/\{project\}/g, lead.project || "our project").replace(/\{agent\}/g, me() || lead.agent || "Keys99 team").replace(/\{phone\}/g, lead.mobile || "");
  async function waChooser(href, phone, leadId) {
    const [tpl, lead] = await Promise.all([Data.templatesCached().catch(() => []), pickLead(phone, leadId)]);
    if (!tpl.length || !lead) { window.open(href, "_blank", "noopener"); return; }
    const ov = document.createElement("div"); ov.className = "overlay open";
    ov.innerHTML = `<div class="modal wa-modal" role="dialog" aria-modal="true" aria-label="WhatsApp message"><h2>WhatsApp · ${esc(lead.name)}</h2><p class="sub">Pick a ready message (you can edit it in WhatsApp before sending).</p>
      <div class="wa-list">${tpl.map((t) => `<button type="button" class="wa-o" data-t="${t.id}"><b>${esc(t.title)}</b><small>${esc(fill(t.body, lead))}</small></button>`).join("")}<button type="button" class="wa-o plain" data-t="0"><b>Open chat without a message</b></button></div>
      <div class="actions"><button type="button" class="btn" data-x>Cancel</button></div></div>`;
    document.body.appendChild(ov); const close = () => ov.remove();
    ov.querySelector("[data-x]").onclick = close; ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    const esc2 = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc2); } }; document.addEventListener("keydown", esc2);
    ov.querySelectorAll("[data-t]").forEach((b) => (b.onclick = async () => {
      const t = tpl.find((x) => String(x.id) === b.dataset.t), url = t ? href.split("?")[0] + "?text=" + encodeURIComponent(fill(t.body, lead)) : href;
      window.open(url, "_blank", "noopener"); close();
      if (t) { try { await Data.appendActivity(lead.dbId, { type: "doc", title: "WhatsApp · " + t.title, description: "Message sent from template", at: new Date().toISOString(), by: await Data.userEmail() }); } catch { /* the chat itself opened */ } }
    }));
  }

  // ---------- reminders ----------
  const seenKey = () => "k99.rem." + dayKey(new Date());
  const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || "[]")); } catch { return new Set(); } };
  const remember = (s) => { try { localStorage.setItem(seenKey(), JSON.stringify([...s].slice(-300))); } catch { /* optional */ } };
  async function poll() {
    let due; try { const end = new Date(); end.setHours(23, 59, 59, 999); const all = await Data.getDue(end.toISOString()); due = all; } catch { return; }
    const now = Date.now(), s = seen(), fresh = [];
    due.followUps.filter((f) => new Date(f.follow_up) <= now).forEach((f) => { const k = "f" + f.id + "@" + f.follow_up; if (!s.has(k)) { s.add(k); fresh.push("Follow-up due: " + f.name); } });
    due.tasks.filter((t) => new Date(t.due_at) <= now).forEach((t) => { const k = "t" + t.id + "@" + t.due_at; if (!s.has(k)) { s.add(k); fresh.push("Task due: " + t.title); } });
    if (fresh.length) {
      remember(s); const msg = fresh.length === 1 ? fresh[0] : fresh.length + " follow-ups / tasks are due. Open Tasks & Follow-ups.";
      toast(msg);
      try { if (document.hidden && window.Notification && Notification.permission === "granted") new Notification("Keys99 CRM", { body: msg, tag: "k99-due" }); } catch { /* notices are optional */ }
    }
    try { await meetingReminders(s); remember(s); } catch { /* reminders are optional */ }
    const n = due.followUps.filter((f) => new Date(f.follow_up) <= now).length + due.tasks.filter((t) => new Date(t.due_at) <= now).length, link = document.querySelector('.nav a[href="tasks.html"]');
    if (link) { let b = link.querySelector(".nav-n"); if (n && !b) { b = document.createElement("span"); b.className = "nav-n"; link.appendChild(b); } if (b) { b.textContent = n > 99 ? "99+" : String(n); b.hidden = !n; b.setAttribute("aria-label", n + " due"); } }
  }

  // a toast shortly before a meeting starts (admins hear about the meetings they created; invitees about theirs)
  async function meetingReminders(seenSet) {
    const now = new Date(), ms = await Data.getMeetings(); if (!ms.length) return;
    ms.filter((m) => m.status === "Scheduled" && m.reminder_min !== null && m.reminder_min !== undefined && !(window.ME && window.ME.role === "admin" && m.created_by !== window.ME.uid)).forEach((m) => {
      expandMeeting(m, now, new Date(now.getTime() + 86400000)).forEach((o) => {
        const mins = (o.start - now) / 60000;
        if (mins < -2 || mins > m.reminder_min) return;      // a short grace after the start, because the check runs once a minute
        const key = "m" + m.id + "@" + o.start.getTime(); if (seenSet.has(key)) return; seenSet.add(key);
        const msg = "Meeting " + (mins < 1 ? "starting now" : "in " + Math.round(mins) + " min") + ": " + m.title + (m.location ? " · " + m.location : ""); toast(msg);
        try { if (document.hidden && window.Notification && Notification.permission === "granted") new Notification("Keys99 CRM", { body: msg, tag: key }); } catch { /* optional */ }
      });
    });
  }

  function init() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]"); if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey) return;
      const h = a.getAttribute("href") || "";
      if (h.startsWith("tel:")) { setTimeout(() => callOutcome(h.slice(4), a.dataset.lead), 600); }
      else if (/^https:\/\/wa\.me\/\d+/.test(h)) { e.preventDefault(); waChooser(h, h.replace(/^https:\/\/wa\.me\//, ""), a.dataset.lead); }
    }, true);
    poll(); setInterval(poll, 60000);
    window.addEventListener("k99:lead-changed", poll);
  }
  return { init, callOutcome, waChooser, poll };
})();
