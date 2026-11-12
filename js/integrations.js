(async function () {
  const page = await mountShell("integrations");
  if (!page) return;
  const DAY = 86400000;
  const state = { sel: "meta", tab: "overview", integrations: [], events: [], saved: {} };

  // ---------- platform catalogue ----------
  const sampleWA = { object: "whatsapp_business_account", entry: [{ id: "W1", changes: [{ field: "messages", value: { contacts: [{ profile: { name: "Test Lead" }, wa_id: "919876543210" }], messages: [{ from: "919876543210", id: "wamid.TEST", type: "text", text: { body: "Hi, I want to know about 2 BHK options" } }] } }] }] };
  const PLATS = [
    { key: "meta", name: "Facebook & Instagram", desc: "Meta Lead Ads and Lead Forms", long: "Capture leads from Facebook and Instagram Lead Ads directly into Keys99 CRM.", account: "Meta Business account", page: "Facebook page",
      needs: ["A Meta Business page with Lead Ads", "Either an automation tool (Zapier, Make, Pabbly) or a Meta developer app with a Page access token"],
      sample: { full_name: "Test Lead", phone_number: "+91 98765 43210", email: "test@example.com", "What is your budget?": "70L - 1Cr", form_name: "Home Buying Enquiry", platform: "fb" } },
    { key: "google", name: "Google Ads", desc: "Lead Form Ads", long: "Receive leads from Google Ads lead form assets through Google's webhook delivery.", account: "Google Ads account", page: "Customer ID",
      needs: ["A Google Ads lead form asset", "Access to its “Lead delivery option” settings"],
      sample: { lead_id: "test-1", form_id: "123", user_column_data: [{ column_id: "FULL_NAME", string_value: "Test Lead" }, { column_id: "PHONE_NUMBER", string_value: "+91 98765 43210" }, { column_id: "EMAIL", string_value: "test@example.com" }] } },
    { key: "linkedin", name: "LinkedIn", desc: "LinkedIn Lead Gen Forms", long: "Bring LinkedIn Lead Gen Form submissions into Keys99 CRM.", account: "LinkedIn page", page: "Ad account",
      needs: ["A LinkedIn page with Lead Gen Forms", "An automation tool (Zapier or Make) to forward submissions"],
      sample: { firstName: "Test", lastName: "Lead", phoneNumber: "+91 98765 43210", emailAddress: "test@example.com", formName: "Lead Gen Form" } },
    { key: "whatsapp", name: "WhatsApp Business", desc: "Capture enquiries & conversations", long: "Create a lead from the first message a new customer sends to your WhatsApp Business number.", account: "WhatsApp business account", page: "Phone number",
      needs: ["A WhatsApp Business Platform (Cloud API) account", "Access to the webhook settings of your Meta app"], sample: sampleWA },
    { key: "youtube", name: "YouTube", desc: "Track leads from campaigns", long: "Tag leads that come from your YouTube campaigns.", account: "YouTube channel", page: "Campaign",
      needs: ["A landing page or form tool that can send a webhook"], sample: { name: "Test Lead", mobile: "+91 98765 43210", email: "test@example.com", utm_campaign: "youtube-launch" } },
    { key: "website", name: "Website / Webhook", desc: "Capture leads from forms or external apps", long: "Receive leads from your website forms, landing pages or any app that can send a webhook.", account: "Website", page: "Site address",
      needs: ["A form handler or server that can send an HTTPS POST"], sample: { name: "Test Lead", mobile: "+91 98765 43210", email: "test@example.com", message: "2 BHK in Pune", form: "Contact page", page_url: "https://keys99.com/contact" } },
  ];
  const P = (k) => PLATS.find((p) => p.key === k);
  const FIELDS = [["name", "Name"], ["phone", "Phone"], ["email", "Email"], ["interest", "Requirement / message"], ["project", "Project"], ["budget", "Budget"], ["location", "Location"], ["developer", "Developer"]];
  const BUILTIN = { name: "full_name, name, first_name + last_name", phone: "phone_number, phone, mobile, contact…", email: "email, email_address", interest: "message, requirement, comments, bhk…", project: "project, project_name, property", budget: "budget, “… budget …”", location: "location, city, area", developer: "developer, builder" };

  // ---------- icons ----------
  function icon(key, s = 44) {
    const box = (inner) => raw(`<svg class="pi" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`);
    if (key === "meta") return raw(`<span class="pi pi-meta" style="width:${s}px;height:${s}px"><i data-lucide="infinity"></i></span>`);
    if (key === "website") return raw(`<span class="pi pi-web" style="width:${s}px;height:${s}px"><i data-lucide="link"></i></span>`);
    if (key === "google") return box('<path d="M7 35 21 9a5 5 0 0 1 9 5L16 40a5 5 0 0 1-9-5z" fill="#fbbc04"/><path d="M30 14l12 21a5 5 0 0 1-9 5L21 19z" fill="#4285f4"/><circle cx="11.5" cy="36.5" r="5" fill="#34a853"/>');
    if (key === "linkedin") return box('<rect width="48" height="48" rx="9" fill="#0a66c2"/><text x="24" y="35" font-size="27" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">in</text>');
    if (key === "whatsapp") return box('<circle cx="24" cy="24" r="22" fill="#25d366"/><path d="M16.5 14.5c-1 1-1.6 2.6-1.1 4.2 1.9 5.2 6 9.2 11.2 11.1 1.6.6 3.2 0 4.2-1l-3.3-3.2-2.1 1.1c-2-1-3.9-2.9-4.9-4.9l1.1-2.1-3.1-3.2z" fill="#fff"/>');
    if (key === "youtube") return box('<rect x="3" y="11" width="42" height="27" rx="8" fill="#f00"/><path d="M20 18l11 6.5L20 31z" fill="#fff"/>');
    return raw("");
  }
  const mini = (label) => label === "Instagram"
    ? raw('<svg class="mi" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".4" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect width="24" height="24" rx="7" fill="url(#ig)"/><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="#fff" stroke-width="1.8"/></svg>')
    : label === "Facebook" ? raw('<svg class="mi" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877f2"/><text x="12.8" y="19" font-size="19" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">f</text></svg>')
    : icon(PLATS.find((p) => p.name === label || p.long === label)?.key || "website", 22);

  // ---------- data ----------
  async function load() {
    try {
      state.integrations = await Data.getIntegrations();
      state.events = await Data.getIntegrationEvents(new Date(Date.now() - 90 * DAY).toISOString());
    } catch (e) { page.innerHTML = '<div class="card empty">Could not load integrations: ' + esc(e.message) + "</div>"; return false; }
    return true;
  }
  const integ = (k) => state.integrations.find((i) => i.platform === k);
  const evOf = (i) => state.events.filter((e) => e.integration_id === i.id);
  const real = (L) => L.filter((e) => e.status === "ok");
  function statsFor(i) {
    const L = real(evOf(i)), m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
    const recentErr = evOf(i).filter((e) => e.status === "error").sort((a, b) => new Date(b.received_at) - new Date(a.received_at))[0];
    const lastOk = L.sort((a, b) => new Date(b.received_at) - new Date(a.received_at))[0];
    const erroring = recentErr && (!lastOk || new Date(recentErr.received_at) > new Date(lastOk.received_at)) && Date.now() - new Date(recentErr.received_at) < DAY;
    return { total: L.length, month: L.filter((e) => new Date(e.received_at) >= m0).length, last: i.last_event_at || (lastOk && lastOk.received_at) || null, erroring };
  }
  function status(i) { return !i ? ["Not Connected", "none"] : i.status === "pending" ? ["Setup pending", "pend"] : i.auto_capture ? ["Connected", "ok"] : ["Paused", "pause"]; }
  function forms(i) {
    const m = new Map();
    real(evOf(i)).forEach((e) => { const k = (e.form_platform || "") + "|" + (e.form_name || "—"), r = m.get(k) || { name: e.form_name || "—", platform: e.form_platform || P(i.platform).name, n: 0, first: e.received_at, last: e.received_at }; r.n++; if (e.received_at < r.first) r.first = e.received_at; if (e.received_at > r.last) r.last = e.received_at; m.set(k, r); });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }

  // ---------- views ----------
  function kpis() {
    const L = state.events.filter((e) => e.status === "ok"), now = Date.now();
    const cur = L.filter((e) => now - new Date(e.received_at) < 30 * DAY).length, prev = L.filter((e) => { const a = now - new Date(e.received_at); return a >= 30 * DAY && a < 60 * DAY; }).length;
    const growth = prev ? Math.round(((cur - prev) / prev) * 100) : null, errs = state.events.filter((e) => e.status === "error" && now - new Date(e.received_at) < 7 * DAY).length;
    const active = state.integrations.filter((i) => i.status === "connected" && i.auto_capture).length;
    const cards = [["users", L.length.toLocaleString("en-IN"), "Leads Captured", "Last 90 days, via integrations", ""], ["refresh-cw", active, "Active Integrations", "Receiving leads", "green"],
      ["trending-up", growth === null ? (cur ? "New" : "—") : (growth >= 0 ? "+" : "") + growth + "%", "Lead Growth", "vs. previous 30 days", "green"], ["zap", errs, "Sync Errors", "Last 7 days", errs ? "red" : "gold"]];
    return html`<div class="ikpis">${cards.map(([ic, v, l, s, c]) => html`<div class="ikpi"><span class="ikpi-i ${c}"><i data-lucide="${ic}"></i></span><div><b>${v}</b><div class="l">${l}</div><small>${s}</small></div></div>`)}</div>`;
  }
  function list() {
    return html`<section class="card p int-list"><h3 class="int-h">Connect a Platform</h3>${PLATS.map((p) => { const i = integ(p.key), [txt, k] = status(i); return html`<button class="plat ${state.sel === p.key ? "sel" : ""}" data-sel="${p.key}" aria-pressed="${state.sel === p.key}">${icon(p.key)}<span class="pt"><b>${p.name}</b><small>${p.desc}</small></span><span class="chip c-${k}">${k === "ok" ? raw('<i data-lucide="check"></i>') : raw("")}${txt}</span></button>`; })}</section>`;
  }
  function detail() {
    const p = P(state.sel), i = integ(p.key);
    if (!i) return html`<section class="card p int-detail"><div class="d-head">${icon(p.key, 54)}<div class="grow"><h2>${p.name}</h2><p>${p.long}</p></div><span class="chip c-none">Not Connected</span></div>
      <div class="empty-big"><h3>Connect ${p.name}</h3><p>We create a private webhook address and secret for this platform. Leads sent to it are added to your CRM with the source, campaign and form details.</p>
        <b>You'll need</b><ul>${p.needs.map((n) => html`<li>${n}</li>`)}</ul><button class="btn gold" id="connect"><i data-lucide="plug-zap"></i>Connect ${p.name}</button></div></section>`;
    const st = status(i), [txt, k] = st, s = statsFor(i);
    const tabs = [["overview", "Overview"], ["forms", "Lead Forms"], ["mapping", "Field Mapping"], ["settings", "Sync Settings"]];
    return html`<section class="card p int-detail"><div class="d-head">${icon(p.key, 54)}<div class="grow"><h2>${p.name}</h2><p>${p.long}</p></div><span class="chip c-${k}">${k === "ok" ? raw('<i data-lucide="check"></i>') : raw("")}${txt}</span>
      <button class="icon-btn kebab" id="more" aria-label="More actions"><i data-lucide="more-vertical"></i></button></div>
      <div class="tabs-line" role="tablist">${tabs.map(([t, l]) => html`<button role="tab" aria-selected="${state.tab === t}" data-tab="${t}" class="${state.tab === t ? "active" : ""}">${l}</button>`)}</div>
      ${state.tab === "overview" ? overview(p, i, s, k) : state.tab === "forms" ? formsTab(p, i) : state.tab === "mapping" ? mappingTab(p, i) : settingsTab(p, i)}</section>`;
  }

  function formsTable(i, limit) {
    const F = forms(i).slice(0, limit || 99), now = Date.now();
    return F.length ? html`<div class="table-wrap"><table class="mini-t"><thead><tr><th>Lead Form</th><th>Platform</th><th>Status</th><th>Leads</th><th>First lead</th></tr></thead><tbody>${F.map((f) => html`<tr><td><b>${f.name}</b></td><td><span class="row">${mini(f.platform)}${f.platform}</span></td>
      <td><span class="chip ${now - new Date(f.last) < 30 * DAY ? "c-ok" : "c-none"}">${now - new Date(f.last) < 30 * DAY ? "Active" : "Idle"}</span></td><td>${f.n}</td><td>${fmtDay(f.first)}</td></tr>`)}</tbody></table></div>`
      : html`<div class="empty-sm">No leads have arrived yet. Forms appear here automatically with their lead counts.</div>`;
  }
  function overview(p, i, s, k) {
    const banner = i.status === "pending"
      ? html`<div class="ban pend"><i data-lucide="hourglass"></i><div><b>Waiting for the first lead</b><small>Finish setup in <a href="#" data-go="settings">Sync Settings</a>, then send a test lead from ${p.name}.</small></div><button class="btn" id="testConn"><i data-lucide="refresh-cw"></i>Test Connection</button></div>`
      : html`<div class="ban ok"><i data-lucide="circle-check"></i><div><b>${k === "pause" ? "Connected, capture is paused" : "Connected to " + p.name}</b><small>${[(i.config || {}).account && p.account + ": " + i.config.account, (i.config || {}).page && p.page + ": " + i.config.page, s.last && "Last lead " + relTime(s.last)].filter(Boolean).join("  |  ") || "Webhook is active"}</small></div><button class="btn" id="testConn"><i data-lucide="refresh-cw"></i>Test Connection</button></div>`;
    const sync = s.erroring ? ["Error", "Check Lead Forms → Recent deliveries", "err"] : !i.auto_capture ? ["Paused", "Auto capture is off", "pause"] : i.status === "pending" ? ["Waiting", "No leads yet", "pend"] : ["Running Automatically", "", "ok"];
    return html`${banner}<div class="tiles4">${[["users", s.total, "Leads Captured"], ["calendar", s.month, "This Month"], ["refresh-cw", s.last ? relTime(s.last) : "—", "Last Sync"], ["circle-check", sync[0], "Sync Status"]].map(([ic, v, l], n) => html`<div class="t4"><i data-lucide="${ic}"></i><div><b class="${n === 3 ? "s-" + sync[2] : ""}">${v}</b><span>${l}</span></div></div>`)}</div>
      <h3 class="sec">Selected Lead Forms (${forms(i).length})</h3>${formsTable(i, 6)}
      <div class="ban auto"><i data-lucide="info"></i><div><b>Auto Lead Capture</b><small>Leads from this integration are created automatically in Keys99 CRM with source, campaign and form details.</small></div>
        <label class="switch"><input type="checkbox" id="auto" ${i.auto_capture ? raw("checked") : raw("")} aria-label="Auto Lead Capture"><span></span></label></div>`;
  }
  function formsTab(p, i) {
    const ev = evOf(i).filter((e) => e.status !== "test").sort((a, b) => new Date(b.received_at) - new Date(a.received_at)).slice(0, 25);
    const chip = { ok: "c-ok", duplicate: "c-pause", skipped: "c-none", error: "c-err" };
    return html`<h3 class="sec">Lead forms (${forms(i).length})</h3>${formsTable(i)}<h3 class="sec">Recent deliveries</h3>
      ${ev.length ? html`<div class="table-wrap"><table class="mini-t"><thead><tr><th>Time</th><th>Result</th><th>Form</th><th>Details</th></tr></thead><tbody>${ev.map((e) => html`<tr><td class="nw">${fmtDate(e.received_at)}</td><td><span class="chip ${chip[e.status] || "c-none"}">${e.status}</span></td><td>${e.form_name || "—"}</td><td>${e.message || ""}</td></tr>`)}</tbody></table></div>` : html`<div class="empty-sm">Nothing received yet.</div>`}`;
  }
  function mappingTab(p, i) {
    const m = (i.config || {}).mapping || {};
    return html`<p class="sub" style="margin-bottom:10px">Tell us which field names this platform sends. Your names are tried first, then the built-in ones. Leave blank to use the defaults.</p>
      <div class="table-wrap"><table class="mini-t map-t"><thead><tr><th>CRM field</th><th>Field name(s) from ${p.name}</th><th>Built-in names</th></tr></thead><tbody>${FIELDS.map(([f, l]) => html`<tr><td><b>${l}</b></td><td><input class="map-in" data-map="${f}" value="${m[f] || ""}" placeholder="e.g. mobile_no, contact" aria-label="${l} source field"></td><td class="muted"><small>${BUILTIN[f]}</small></td></tr>`)}</tbody></table></div>
      <button class="btn gold" id="saveMap" style="margin-top:10px"><i data-lucide="check"></i>Save mapping</button>
      <h3 class="sec">Try a sample lead</h3><p class="sub" style="margin-bottom:8px">Paste what ${p.name} sends (JSON). Nothing is saved: we only show how it would be mapped.</p>
      <textarea id="sample" rows="8" spellcheck="false" class="code-ta">${JSON.stringify(p.sample, null, 2)}</textarea><button class="btn" id="runSample" style="margin-top:8px"><i data-lucide="play"></i>Test mapping</button><div id="sampleOut" aria-live="polite"></div>`;
  }
  function settingsTab(p, i) {
    const c = i.config || {}, url = Data.captureUrl(i.id);
    return html`<div class="set-grid">
      <label class="rem">${p.account}<input id="cfgAccount" value="${c.account || ""}" placeholder="Shown on the Overview tab"></label><label class="rem">${p.page}<input id="cfgPage" value="${c.page || ""}" placeholder="Optional"></label>
      <label class="rem full">Default project (used when a lead doesn't name one)<input id="cfgProject" value="${c.default_project || ""}" placeholder="e.g. Shriram Nayra"></label></div>
      <button class="btn gold" id="saveCfg" style="margin-top:10px"><i data-lucide="check"></i>Save settings</button>
      <h3 class="sec">Webhook</h3><div class="copyrow"><input id="whUrl" readonly value="${url}" aria-label="Webhook URL"><button class="btn sm" data-copy-id="whUrl"><i data-lucide="copy"></i>Copy URL</button></div>
      <p class="sub" style="margin:8px 0">The secret was shown once when you connected, and only a hash is stored. Lost it? <button class="auth-link" id="rotate">Generate a new secret</button> (the old one stops working).</p>
      ${p.key === "meta" ? html`<h3 class="sec">Facebook Pages</h3><p class="sub" style="margin-bottom:8px">Needed only for Meta's direct webhook (Meta sends just a lead id; a Page token lets us read the lead). Paste a <b>user</b> access token to add <b>all</b> the Pages you granted at once, or a <b>Page</b> token to add one Page. Tokens are stored privately and never shown again.</p>
        ${(c.pages || []).length ? html`<div class="pages">${(c.pages || []).map((g) => html`<div class="pg"><i data-lucide="check-circle-2"></i><span><b>${g.name}</b><small class="muted"> ID ${g.id}</small></span><button class="btn sm red" data-rmpage="${g.id}">Remove</button></div>`)}</div>` : raw("")}
        ${state.saved.page_access_token ? html`<div class="pg"><i data-lucide="key-round"></i><span><b>Older single token</b><small class="muted"> used for any Page without its own token</small></span><button class="btn sm red" id="clearTok">Remove</button></div>` : raw("")}
        <div class="copyrow" style="margin-top:8px"><input id="pageTok" type="password" autocomplete="off" placeholder="Paste a user or Page access token" aria-label="Access token"><button class="btn sm" id="saveTok"><i data-lucide="plus"></i>Add Pages</button></div>
        <small class="muted">${(c.pages || []).length ? (c.pages || []).length + " Page" + ((c.pages || []).length === 1 ? "" : "s") + " connected." : "No Pages connected yet."}</small>` : raw("")}
      <h3 class="sec">Danger zone</h3><button class="btn red" id="del"><i data-lucide="trash-2"></i>Delete this integration</button>`;
  }

  // ---------- connect flow ----------
  function steps(p, id, secret) {
    const url = Data.captureUrl(id), field = (label, val, idn) => html`<label class="rem">${label}<span class="copyrow"><input id="${idn}" readonly value="${val}"><button type="button" class="btn sm" data-copy="#${idn}"><i data-lucide="copy"></i>Copy</button></span></label>`;
    const warn = html`<div class="ban pend" style="margin:0 0 12px"><i data-lucide="shield-alert"></i><div><b>Copy the secret now</b><small>It is shown only once. We store only a hash, so it can't be shown again.</small></div></div>`;
    const curl = `curl -X POST '${url}' \\\n  -H 'x-webhook-secret: ${secret}' -H 'content-type: application/json' \\\n  -d '{"name":"Test Lead","mobile":"9876543210","message":"2 BHK"}'`;
    const body = {
      meta: html`<ol class="how"><li><b>Easiest: Zapier / Make / Pabbly.</b> Trigger “New Lead (Facebook Lead Ads)”, action “Webhook → POST”. Use the webhook URL below and add the header <code>x-webhook-secret</code> with the secret. Send the lead's fields as JSON.</li>
        <li><b>Direct from Meta (developer app):</b> in your Meta app → Webhooks → Page → <i>leadgen</i>, set the Callback URL to <code>${url}&amp;s=SECRET</code> and the Verify token to the secret. Then add your Page access token in <b>Sync Settings</b>.</li></ol>${field("Webhook URL", url, "dlgUrl")}${field("Secret / verify token", secret, "dlgSec")}`,
      google: html`<ol class="how"><li>In Google Ads open your lead form asset → <b>Lead delivery option</b> → <b>Webhook integration</b>.</li><li>Paste the <b>Webhook URL</b> and the <b>Key</b> below, then press <b>Send test data</b>.</li></ol>${field("Webhook URL", url, "dlgUrl")}${field("Key", secret, "dlgSec")}`,
      linkedin: html`<ol class="how"><li>LinkedIn can't call a webhook directly. In Zapier or Make use the trigger “New Lead Gen Form Response”.</li><li>Add a “Webhook → POST (JSON)” action with the URL below and the header <code>x-webhook-secret</code> set to the secret.</li></ol>${field("Webhook URL", url, "dlgUrl")}${field("Secret", secret, "dlgSec")}`,
      whatsapp: html`<ol class="how"><li>Meta app → <b>WhatsApp → Configuration → Webhook</b>.</li><li>Callback URL = the webhook URL below. Verify token = the secret. Subscribe to <b>messages</b>.</li><li>The first message from a new number becomes a lead (the same number is not added again for 7 days).</li></ol>${field("Callback URL", url, "dlgUrl")}${field("Verify token", secret, "dlgSec")}`,
      youtube: html`<ol class="how"><li>YouTube has no lead API. Send leads from your landing page or form tool to the webhook below; they are tagged <b>YouTube</b>.</li><li>Use the header <code>x-webhook-secret</code> with the secret.</li></ol>${field("Webhook URL", url, "dlgUrl")}${field("Secret", secret, "dlgSec")}`,
      website: html`<ol class="how"><li>Send an HTTPS POST (JSON or form data) from your server or form handler with the header <code>x-webhook-secret</code>.</li><li>Don't put the secret in public browser code: anyone could read it and send fake leads. Use a server, a form service, or Zapier/Make.</li></ol>${field("Webhook URL", url, "dlgUrl")}${field("Secret", secret, "dlgSec")}<label class="rem">Example<textarea class="code-ta" rows="4" readonly>${curl}</textarea></label>`,
    }[p.key];
    return html`${warn}${body}`;
  }
  function revealSecret(p, id, secret, title) { showDialog(title, steps(p, id, secret), [["I've copied it", null, "gold"]], true); }

  function guide() {
    showDialog("Integration Guide", html`<p class="sub" style="margin-bottom:10px">Every platform sends leads to a private webhook address. We check its secret, understand each platform's format, skip duplicates, and add the lead to your CRM with its source and form.</p>
      ${PLATS.map((p) => html`<details class="gd"><summary>${icon(p.key, 22)}<b>${p.name}</b></summary><p>${p.long}</p><b>You'll need</b><ul>${p.needs.map((n) => html`<li>${n}</li>`)}</ul></details>`)}
      <details class="gd"><summary><i data-lucide="shield-check"></i><b>Security & duplicates</b></summary><ul><li>Each integration has its own secret. Only a hash is stored, and it is shown once.</li><li>Leads with the same platform lead id, or the same phone number from the same source within 10 minutes (7 days for WhatsApp), are ignored.</li><li>Invalid phone numbers are rejected and listed under Recent deliveries.</li></ul></details>`, [["Close", null]], true);
  }

  // ---------- page ----------
  function draw() {
    render(page, html`<div class="page-head"><div><div class="crumb">Settings <i data-lucide="chevron-right" style="width:14px;height:14px"></i><b>Integrations</b></div><h1>Social Media Integrations</h1>
      <p class="sub">Connect your marketing channels to automatically capture leads into Keys99 CRM.</p></div><button class="btn" id="guide"><i data-lucide="book-open"></i>Integration Guide</button></div>
      ${kpis()}<div class="int-grid">${list()}${detail()}</div>`);
    bind();
  }
  const refresh = async () => { if (await load()) { await loadSecretStatus(); draw(); } };
  async function loadSecretStatus() {
    state.saved = {}; const i = integ(state.sel);
    if (i && state.sel === "meta") { const r = await Data.captureCall(i.id, { action: "secret_status" }); if (r.ok) (r.saved || []).forEach((n) => (state.saved[n] = true)); }
  }
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { alert(e.message); } };

  function testResult(p, r) {
    if (!r.ok && !(r.results || []).length) return showDialog("Test failed", html`<div class="ban pend"><i data-lucide="circle-alert"></i><div><b>${r.error || "Something went wrong"}</b></div></div>`);
    const res = (r.results || [])[0] || {}, pv = res.preview;
    showDialog(res.status === "error" ? "Test: needs attention" : "Test connection", html`<div class="ban ${res.status === "error" ? "pend" : "ok"}"><i data-lucide="${res.status === "error" ? "circle-alert" : "circle-check"}"></i><div><b>${res.message || (r.ok ? "OK" : "Failed")}</b><small>No lead was created. This only checks the connection and field mapping.</small></div></div>
      ${pv ? html`<dl class="kv2" style="margin-top:12px">${Object.entries(pv).filter(([, v]) => v).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>` : raw("")}`);
  }

  function bind() {
    const $ = (s) => page.querySelector(s), $$ = (s) => page.querySelectorAll(s), p = P(state.sel), i = integ(state.sel);
    $("#guide").onclick = guide;
    $$("[data-sel]").forEach((b) => (b.onclick = async () => { state.sel = b.dataset.sel; state.tab = "overview"; await loadSecretStatus(); draw(); if (matchMedia("(max-width:1000px)").matches) page.querySelector(".int-detail").scrollIntoView({ behavior: "smooth", block: "start" }); }));
    const cn = $("#connect");
    if (cn) cn.onclick = () => showDialog("Connect " + p.name, html`<p>We'll create a private webhook address and secret for ${p.name}. You'll copy them into ${p.name} (or your automation tool) in the next step.</p>`,
      [["Cancel", null], ["Create webhook", async (close) => { const { row, secret } = await Data.createIntegration(p.key); close(); await refresh(); revealSecret(p, row.id, secret, "Connect " + p.name); }, "gold"]]);
    if (!i) return;
    $$("[data-tab]").forEach((b) => (b.onclick = async () => { state.tab = b.dataset.tab; draw(); }));
    $$("[data-go]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); state.tab = a.dataset.go; draw(); }));
    const tc = $("#testConn"); if (tc) tc.onclick = guard(async () => { tc.disabled = true; testResult(p, await Data.captureCall(i.id, { test: true, body: p.sample })); tc.disabled = false; await refresh(); });
    const au = $("#auto"); if (au) au.onchange = guard(async () => { await Data.updateIntegration(i.id, { auto_capture: au.checked }); toast(au.checked ? "Auto Lead Capture on" : "Auto Lead Capture off"); await refresh(); });
    $("#more").onclick = (e) => popMenu(e.currentTarget, [
      [i.auto_capture ? "Pause lead capture" : "Resume lead capture", i.auto_capture ? "pause" : "play", guard(async () => { await Data.updateIntegration(i.id, { auto_capture: !i.auto_capture }); await refresh(); })],
      ["Generate new secret", "key-round", () => rotate(p, i)], ["Delete integration", "trash-2", () => remove(p, i), true]]);
    const sm = $("#saveMap"); if (sm) sm.onclick = guard(async () => {
      const mapping = {}; $$("[data-map]").forEach((x) => { if (x.value.trim()) mapping[x.dataset.map] = x.value.trim().slice(0, 200); });
      await Data.updateIntegration(i.id, { config: { ...(i.config || {}), mapping } }); toast("Mapping saved"); await refresh();
    });
    const rs = $("#runSample"); if (rs) rs.onclick = guard(async () => {
      const out = $("#sampleOut"); let body; try { body = JSON.parse($("#sample").value); } catch { out.innerHTML = '<div class="ban pend"><b>That is not valid JSON.</b></div>'; return; }
      const mapping = {}; $$("[data-map]").forEach((x) => { if (x.value.trim()) mapping[x.dataset.map] = x.value.trim(); });
      await Data.updateIntegration(i.id, { config: { ...(i.config || {}), mapping } }); Object.assign(i, { config: { ...(i.config || {}), mapping } });
      const r = await Data.captureCall(i.id, { test: true, body }), res = (r.results || [])[0] || {};
      render(out, html`<div class="ban ${res.status === "test" || res.status === "skipped" ? "ok" : "pend"}" style="margin-top:10px"><i data-lucide="${res.status === "test" ? "circle-check" : "circle-alert"}"></i><div><b>${res.message || r.error || "No result"}</b></div></div>${res.preview ? html`<dl class="kv2" style="margin-top:10px">${Object.entries(res.preview).filter(([, v]) => v).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>` : raw("")}`);
    });
    const sc = $("#saveCfg"); if (sc) sc.onclick = guard(async () => { await Data.updateIntegration(i.id, { config: { ...(i.config || {}), account: $("#cfgAccount").value.trim(), page: $("#cfgPage").value.trim(), default_project: $("#cfgProject").value.trim() } }); toast("Settings saved"); await refresh(); });
    $$("[data-copy-id]").forEach((b) => (b.onclick = () => copyText($("#" + b.dataset.copyId).value, "Webhook URL copied")));
    const ro = $("#rotate"); if (ro) ro.onclick = () => rotate(p, i);
    const st = $("#saveTok"); if (st) st.onclick = guard(async () => { const v = $("#pageTok").value.trim(); st.disabled = true; try { const r = await Data.captureCall(i.id, { action: "set_secret", body: { value: v } }); if (!r.ok) throw new Error(r.error || "Could not save the token"); $("#pageTok").value = ""; toast((r.pages || []).length === 1 ? "Connected: " + r.pages[0].name : (r.pages || []).length + " Pages connected"); await refresh(); } finally { st.disabled = false; } });
    document.querySelectorAll("[data-rmpage]").forEach((b) => (b.onclick = guard(async () => { if (!confirm("Remove this Page? Its leads will stop being captured.")) return; await Data.captureCall(i.id, { action: "clear_secret", body: { page_id: b.dataset.rmpage } }); toast("Page removed"); await refresh(); })));
    const ct = $("#clearTok"); if (ct) ct.onclick = guard(async () => { if (!confirm("Remove the saved page access token?")) return; await Data.captureCall(i.id, { action: "clear_secret" }); toast("Token removed"); await refresh(); });
    const dl = $("#del"); if (dl) dl.onclick = () => remove(p, i);
  }
  function rotate(p, i) { showDialog("Generate a new secret?", html`<p>The current secret stops working immediately. You'll need to paste the new one into ${p.name} (or your automation tool).</p>`, [["Cancel", null], ["Generate new secret", async (close) => { const s = await Data.rotateSecret(i.id); close(); revealSecret(p, i.id, s, "New secret for " + p.name); }, "gold"]]); }
  function remove(p, i) { showDialog("Delete " + p.name + "?", html`<p>The webhook stops accepting leads and its delivery history is deleted. Leads already captured stay in the CRM.</p>`, [["Cancel", null], ["Delete integration", async (close) => { await Data.deleteIntegration(i.id); close(); toast("Integration deleted"); state.tab = "overview"; await refresh(); }, "red"]]); }

  document.getElementById("globalSearch").onkeydown = (e) => { if (e.key === "Enter" && e.target.value.trim()) location.href = "leads.html?q=" + encodeURIComponent(e.target.value.trim()); };
  if (!(await load())) return;
  await loadSecretStatus(); draw();
})();
