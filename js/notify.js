// Notifications: the bell (every new lead, from every source), live alerts with a chime, and real browser notifications that also arrive when the CRM is closed.
// Live updates come from Supabase realtime (new rows in `enquiries`). Browser push comes from the send-push function. Read state is kept per person in `user_prefs`.
const Notify = (() => {
  const LIMIT = 30, st = { leads: [], readBefore: null, readIds: new Set(), sound: true, open: false, pushOn: false, perm: "default", busy: "", msg: "", ready: false };
  let btn, panel, ctx = null, saveT = 0, channel = null, wasDown = false, baseTitle = document.title, sess = null;
  const supported = () => "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const FN = () => `${CFG.SUPABASE_URL}/functions/v1/send-push`;

  // ---------- lead model ----------
  const norm = (r) => ({ id: r.id, name: r.name || "New enquiry", project: r.project || "", source: r.source || "Website", platform: r.meta_platform || "", agent: typeof r.manager_name === "string" ? r.manager_name : Array.isArray(r.manager_name) ? r.manager_name.join(", ") : "", at: r.created_at });
  const isUnread = (l) => !st.readIds.has(l.id) && (!st.readBefore || new Date(l.at) > new Date(st.readBefore));
  const unread = () => st.leads.filter(isUnread).length;
  const srcLabel = (l) => ({ fb: "Facebook", ig: "Instagram" }[l.platform] || l.source);

  // ---------- sound (a short two-note chime made in the browser; a click anywhere unlocks audio) ----------
  const audio = () => { try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch { return null; } };
  function chime() {
    const c = audio(); if (!c || c.state !== "running") return false;
    const t = c.currentTime;
    [[880, 0], [1318.5, 0.16]].forEach(([f, d]) => { const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.28, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.55); o.connect(g); g.connect(c.destination); o.start(t + d); o.stop(t + d + 0.6); });
    return true;
  }

  // ---------- read state (per person, saved in the database) ----------
  function persist() { clearTimeout(saveT); saveT = setTimeout(async () => { try { await Data.savePrefs({ notif_read_before: st.readBefore, notif_read_ids: [...st.readIds].slice(-200), sound_on: st.sound }); } catch { /* the next change will try again */ } }, 400); }
  const markRead = (id) => { st.readIds.add(id); persist(); render(); };
  const markAll = () => { st.readBefore = new Date().toISOString(); st.readIds = new Set(); persist(); render(); };

  // ---------- a new lead arrives ----------
  function onLead(row, live) {
    const l = norm(row); if (st.leads.some((x) => x.id === l.id)) return;
    st.leads.unshift(l); st.leads.sort((a, b) => new Date(b.at) - new Date(a.at)); st.leads = st.leads.slice(0, LIMIT);
    if (live) {
      if (st.sound) chime();
      toast(`New lead · ${srcLabel(l)} · ${l.name}${l.project ? " · " + l.project : ""}`);
      // a hidden tab with permission but no push subscription still gets a notification from the page itself
      if (document.hidden && st.perm === "granted" && !st.pushOn) { try { new Notification(`New lead · ${srcLabel(l)}`, { body: `${l.name}${l.project ? " · " + l.project : ""}`, tag: "lead-" + l.id, icon: "icons/icon-192.png" }); } catch { /* not allowed here */ } }
    }
    render();
  }
  async function refetch() { try { (await Data.getRecentLeads(LIMIT)).forEach((r) => onLead(r, false)); render(); } catch { /* offline: try again on the next event */ } }

  function connect() {
    try {
      channel = Data.client.channel("k99-leads").on("postgres_changes", { event: "INSERT", schema: "public", table: "enquiries" }, (p) => onLead(p.new, true)).subscribe((s) => {
        if (s === "SUBSCRIBED") { if (wasDown) refetch(); wasDown = false; } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") wasDown = true;
      });
    } catch { /* live updates unavailable; the bell still loads on every page */ }
  }

  // ---------- browser push ----------
  const urlB64 = (b) => { const p = "=".repeat((4 - (b.length % 4)) % 4), r = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
  const swUrl = () => new URL("sw.js", location.href).href, scope = () => new URL("./", location.href).href;
  async function checkPush() {
    st.perm = "Notification" in window ? Notification.permission : "unsupported";
    if (!supported()) return;
    try { const reg = await navigator.serviceWorker.getRegistration(scope()); const sub = reg && (await reg.pushManager.getSubscription()); st.pushOn = !!sub && st.perm === "granted"; } catch { st.pushOn = false; }
  }
  async function enablePush() {
    st.busy = "on"; st.msg = ""; render();
    try {
      audio();                                                                  // this click also unlocks the chime
      const perm = await Notification.requestPermission(); st.perm = perm;
      if (perm !== "granted") { st.msg = perm === "denied" ? "Notifications are blocked for this site. Use the lock icon next to the address, allow Notifications, then try again." : "Notifications were not allowed."; return; }
      const reg = await navigator.serviceWorker.register(swUrl(), { scope: scope() }); await navigator.serviceWorker.ready;
      const k = await (await fetch(FN())).json(); if (!k.publicKey) throw new Error("The server could not provide the push key");
      let sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(k.publicKey) });
      const j = sub.toJSON(); await Data.savePushSub({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) });
      st.pushOn = true; st.msg = "Done. This device will now get lead notifications, even when the CRM is closed.";
    } catch (e) { st.msg = "Could not turn on notifications: " + (e && e.message ? e.message : e); }
    finally { st.busy = ""; render(); }
  }
  async function disablePush() {
    st.busy = "off"; render();
    try { const reg = await navigator.serviceWorker.getRegistration(scope()); const sub = reg && (await reg.pushManager.getSubscription()); if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); await Data.deletePushSub(ep); } st.pushOn = false; st.msg = "Notifications are off on this device."; }
    catch (e) { st.msg = "Could not turn them off: " + (e && e.message ? e.message : e); }
    finally { st.busy = ""; render(); }
  }
  async function sendTest() {
    st.busy = "test"; st.msg = ""; render();
    try {
      const s = await Data.session(); const r = await fetch(FN(), { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + s.access_token }, body: JSON.stringify({ test: true }) });
      const j = await r.json().catch(() => ({})); chime();
      st.msg = !r.ok || j.ok === false ? "The test could not be sent: " + (j.error || r.status) : j.sent ? "Test sent. A notification should appear in a moment." : "No device has notifications turned on yet.";
    } catch (e) { st.msg = "The test could not be sent: " + (e && e.message ? e.message : e); }
    finally { st.busy = ""; render(); }
  }

  // ---------- the bell and its panel ----------
  function card() {
    if (!supported()) return ios() && !standalone() ? html`<div class="nf-card"><b>Notifications on iPhone</b><p>Open this page in Safari, tap Share, choose <b>Add to Home Screen</b>, then open the CRM from the new icon and turn notifications on there.</p></div>` : html`<div class="nf-card"><b>Browser notifications</b><p>This browser cannot show background notifications. You will still see new leads here and hear the chime while the CRM is open.</p></div>`;
    if (st.perm === "denied") return html`<div class="nf-card warn"><b>Notifications are blocked</b><p>Click the lock icon next to the address, set Notifications to Allow, then come back and press the button.</p><button class="btn sm" id="nfOn">Try again</button></div>`;
    return st.pushOn ? html`<div class="nf-card ok"><b><i data-lucide="check-circle-2"></i> Notifications are on for this device</b><p>New leads appear here and as a browser notification, even if the CRM is closed.${st.msg ? html` <span class="nf-msg">${st.msg}</span>` : raw("")}</p>
        <div class="nf-btns"><button class="btn sm" id="nfTest" ${st.busy ? raw("disabled") : raw("")}>${st.busy === "test" ? "Sending…" : "Send test notification"}</button><button class="btn sm" id="nfOff" ${st.busy ? raw("disabled") : raw("")}>Turn off</button></div></div>`
      : html`<div class="nf-card"><b>Get notified, even when the CRM is closed</b><p>Turn on browser notifications on this device. You allow it once.${st.msg ? html` <span class="nf-msg">${st.msg}</span>` : raw("")}</p><button class="btn sm gold" id="nfOn" ${st.busy ? raw("disabled") : raw("")}>${st.busy === "on" ? "Turning on…" : "Turn on notifications"}</button></div>`;
  }
  function render() {
    if (!btn) return;
    const n = unread(), nEl = btn.querySelector(".bell-n");
    nEl.hidden = n === 0; nEl.textContent = n > 99 ? "99+" : String(n);
    btn.setAttribute("aria-label", n ? `Notifications, ${n} unread` : "Notifications");
    document.title = (n ? `(${n > 99 ? "99+" : n}) ` : "") + baseTitle;
    if (!st.open) return;
    panel.innerHTML = html`<div class="nf-h"><b>Notifications</b><span class="nf-sp"></span><button class="icon-btn" id="nfSound" aria-label="${st.sound ? "Turn the sound off" : "Turn the sound on"}" aria-pressed="${st.sound}" title="${st.sound ? "Sound on" : "Sound off"}"><i data-lucide="${st.sound ? "volume-2" : "volume-x"}"></i></button><button class="btn sm" id="nfAll" ${n ? raw("") : raw("disabled")}>Mark all as read</button></div>
      ${card()}
      <ul class="nf-l" role="list">${st.leads.length ? st.leads.map((l) => html`<li><a href="leads.html?q=${encodeURIComponent("L-" + l.id)}" data-nf="${l.id}" class="${isUnread(l) ? "unread" : ""}">${avatar(l.name, 36)}<span class="nf-t"><b>${l.name}</b><span>New lead from ${srcLabel(l)}${l.project ? " · " + l.project : ""}</span>${l.agent ? html`<small>Assigned to ${l.agent}</small>` : raw("")}</span><time datetime="${l.at}">${relTime(l.at)}</time>${isUnread(l) ? html`<i class="nf-dot" aria-label="Unread"></i>` : raw("")}</a></li>`) : html`<li class="nf-empty">No leads yet. New ones appear here the moment they arrive.</li>`}</ul>
      <div class="nf-f"><a href="leads.html">View all leads</a></div>`.__raw;
    if (window.lucide) lucide.createIcons();
    panel.querySelector("#nfSound").onclick = () => { st.sound = !st.sound; if (st.sound) { audio(); chime(); } persist(); render(); };
    panel.querySelector("#nfAll").onclick = markAll;
    // opening a lead leaves this page, so save "read" first (never longer than a second) and then go
    panel.querySelectorAll("[data-nf]").forEach((a) => (a.onclick = async (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) { st.readIds.add(Number(a.dataset.nf)); persist(); return; }      // opened in a new tab: this page stays
      e.preventDefault(); st.readIds.add(Number(a.dataset.nf)); clearTimeout(saveT);
      try { await Promise.race([Data.savePrefs({ notif_read_before: st.readBefore, notif_read_ids: [...st.readIds].slice(-200), sound_on: st.sound }), new Promise((r) => setTimeout(r, 1000))]); } catch { /* go anyway */ }
      location.href = a.href;
    }));
    const on = panel.querySelector("#nfOn"); if (on) on.onclick = enablePush; const off = panel.querySelector("#nfOff"); if (off) off.onclick = disablePush; const t = panel.querySelector("#nfTest"); if (t) t.onclick = sendTest;
  }
  function toggle(open) {
    st.open = open === undefined ? !st.open : open; panel.hidden = !st.open; btn.setAttribute("aria-expanded", String(st.open));
    if (st.open) { render(); checkPush().then(render); }
  }

  async function init(session) {
    sess = session; btn = document.getElementById("bellBtn"); if (!btn || btn.dataset.ready) return; btn.dataset.ready = "1";
    panel = document.createElement("div"); panel.className = "nf-panel"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Notifications"); btn.parentNode.appendChild(panel);
    btn.onclick = (e) => { e.stopPropagation(); toggle(); };
    document.addEventListener("mousedown", (e) => { if (st.open && !panel.contains(e.target) && !btn.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && st.open) { toggle(false); btn.focus(); } });
    ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, () => audio(), { once: true, passive: true }));
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.type === "lead") refetch(); });
    try {
      const prefs = await Data.getPrefs();
      if (prefs) { st.readBefore = prefs.notif_read_before; st.readIds = new Set(prefs.notif_read_ids || []); st.sound = prefs.sound_on !== false; }
      else { st.readBefore = new Date().toISOString(); await Data.savePrefs({ notif_read_before: st.readBefore, notif_read_ids: [], sound_on: true }); }   // first time: existing leads are not "new"
      if (prefs && !prefs.notif_read_before) st.readBefore = new Date().toISOString();
    } catch { st.readBefore = st.readBefore || new Date().toISOString(); }
    await refetch(); connect(); checkPush().then(render); render(); st.ready = true;
  }
  return { init, _test: { onLead: (r) => onLead(r, true), state: st, unread, markAll, toggle } };
})();
window.Notify = Notify;
