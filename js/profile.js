// My profile: photo, mobile number, read-only job details, and a password change confirmed with a 6-digit code emailed to the person.
(async function () {
  const page = await mountShell("profile");
  if (!page) return;
  const me = window.ME, email = (await Data.session()).user.email, name = me.name, m = me.member, canEdit = !!me.memberId;
  const st = { photo: avatarUrl(me.avatarPath), busy: "", step: "idle", msg: "", err: "", wait: 0, phone: m ? m.phone || "" : "" };
  let tick = null, hrChart = null;
  // active hours: everything from the last 800 days is loaded once and the period filters are applied here
  const hr = { preset: "30d", from: "", to: "", by: "day", rows: [], loading: true, err: "" };
  const today = () => Hours.key(new Date());
  async function loadHours() {
    const d = new Date(); d.setDate(d.getDate() - 799);
    try { hr.rows = await Data.getActiveTime(Hours.key(d), today()); hr.err = ""; } catch (e) { hr.err = e.message || String(e); }
    hr.loading = false; draw();
  }
  function hoursCard() {
    const t = today(), y = Hours.key(new Date(Date.now() - 86400000)), [f, to] = Hours.span(hr.preset, hr.from, hr.to), rows = hr.rows.filter((r) => r.day >= f && r.day <= to), sm = Hours.summary(rows, f, to);
    const wk = Hours.key((() => { const x = new Date(); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; })()), mo = t.slice(0, 7) + "-01";
    const sum = (a, b) => hr.rows.filter((r) => r.day >= a && r.day <= b).reduce((n, r) => n + r.minutes, 0);
    const kp = [["Today", Hours.sumDay(hr.rows, t)], ["Yesterday", Hours.sumDay(hr.rows, y)], ["This week", sum(wk, t)], ["This month", sum(mo, t)], ["Total", hr.rows.reduce((n, r) => n + r.minutes, 0)]];
    const nice = (k) => (k ? new Date(k + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "");
    return html`<section class="card p" id="hrCard" aria-label="Active hours"><div class="ch"><i data-lucide="timer"></i><h3>Active hours</h3></div>
      ${hr.err ? html`<div class="pf-note err" role="alert">Could not load your active hours: ${hr.err}</div>` : raw("")}
      <div class="hr-kpis">${kp.map(([l, m]) => html`<div class="hr-k"><small>${l}</small><b>${hr.loading ? "…" : Hours.fmt(m)}</b></div>`)}</div>
      ${Hours.controls(hr)}
      ${hr.loading ? html`<p class="muted pf-h">Loading…</p>` : rows.length ? html`<p class="hr-sum"><b>${Hours.fmt(sm.total)}</b> in this period · ${sm.daysActive} active day${sm.daysActive === 1 ? "" : "s"} · average <b>${Hours.fmt(sm.avg)}</b> per active day · longest <b>${Hours.fmt(sm.longest)}</b> (${nice(sm.longestDay)})</p>
        <div class="hr-chart"><canvas id="hrChart" role="img" aria-label="Active hours over time"></canvas></div>` : html`<div class="hr-empty"><i data-lucide="timer-off"></i><p>No active time recorded in this period yet.</p></div>`}
      <p class="muted hr-note">A minute counts only while this tab is open and you are using it (mouse, keys, scroll or touch). Idle time is not counted.</p></section>`;
  }
  function drawHoursChart() {
    if (hrChart) { hrChart.destroy(); hrChart = null; }
    const cv = document.getElementById("hrChart"); if (!cv) return;
    const [f, to] = Hours.span(hr.preset, hr.from, hr.to), rows = hr.rows.filter((r) => r.day >= f && r.day <= to);
    hrChart = Hours.chart(cv, Hours.group(rows, f, to, hr.by));
  }
  const row = ([k, v]) => html`<div class="pf-r"><dt>${k}</dt><dd>${v || "—"}</dd></div>`;
  const details = [["Name", name], ["Email", email], ["Role", me.role === "admin" ? "Admin" : "Employee"], ["Designation", m && m.designation], ["Department", m && m.department], ["Team", m && m.team], ["Location", m && m.location]];

  function draw() {
    render(page, html`
      <div class="page-head"><div><h1>My Profile</h1><p class="sub">Your photo and contact details, and your password.</p></div></div>
      <div class="pf-grid">
        <section class="card p pf-photo" aria-label="Profile photo">
          <div class="pf-av">${avatar(name, 120, st.photo)}</div>
          <b class="pf-name">${name}</b><span class="muted">${me.role === "admin" ? "Admin" : "Employee"}</span>
          <div class="pf-btns"><button type="button" class="btn brand sm" id="pfPick" ${st.busy ? raw("disabled") : raw("")}><i data-lucide="camera"></i>${st.photo ? "Change photo" : "Upload photo"}</button>
            ${st.photo ? html`<button type="button" class="btn sm" id="pfDrop" ${st.busy ? raw("disabled") : raw("")}><i data-lucide="trash-2"></i>Remove</button>` : raw("")}</div>
          <input type="file" id="pfFile" accept="image/jpeg,image/png,image/webp" hidden>
          <small class="muted">JPG, PNG or WebP. It is cropped to a square automatically.</small>
          <div class="pf-note" id="pfPhotoMsg" role="status" aria-live="polite"></div>
        </section>
        <div class="pf-col">
          <section class="card p" aria-label="Profile details"><div class="ch"><i data-lucide="user"></i><h3>Details</h3></div>
            <form id="pfForm" novalidate>
              <dl class="pf-dl">${details.map(row)}</dl>
              ${canEdit ? html`<label class="pf-f">Mobile number<input id="pfPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" value="${st.phone}" placeholder="+91 98765 43210"></label>
                <p class="muted pf-h">Name, designation, department and team are set by an admin.</p>
                <div class="pf-note" id="pfMsg" role="alert" aria-live="polite"></div>
                <button class="btn brand" id="pfSave" type="submit" ${st.busy ? raw("disabled") : raw("")}>Save changes</button>`
              : html`<p class="muted pf-h">This login is not linked to a team member, so there is no mobile number to edit. You can still change your photo and password.</p>`}
            </form></section>
          ${hoursCard()}
          <section class="card p" aria-label="Appearance"><div class="ch"><i data-lucide="palette"></i><h3>Appearance</h3></div>
            <p class="muted pf-h">Choose how the CRM looks on this device. System follows your device setting.</p>
            <div class="th-opts" role="radiogroup" aria-label="Theme">${[["light", "Light", "sun"], ["dark", "Dark", "moon"], ["system", "System", "monitor"]].map(([v, l, ic]) => html`<button type="button" role="radio" class="th-opt" data-theme-set="${v}" aria-checked="false"><span class="th-prev th-${v}" aria-hidden="true"><i></i><i></i><i></i></span><span class="th-l"><i data-lucide="${ic}"></i>${l}</span></button>`)}</div></section>
          <section class="card p" aria-label="Change password"><div class="ch"><i data-lucide="key-round"></i><h3>Change password</h3></div>${security()}</section>
        </div>
      </div>`);
    wire(); if (window.Theme) Theme.paint(); drawHoursChart(); Hours.wire(page.querySelector("#hrCard"), hr, () => draw());
  }
  function security() {
    const note = html`<div class="pf-note ${st.err ? "err" : st.msg ? "ok" : ""}" id="pfSec" role="alert" aria-live="polite">${st.err || st.msg}</div>`;
    if (st.step === "code") return html`<p class="muted pf-h">We emailed a 6-digit code to <b>${email}</b>. It expires in about an hour. Check your spam folder if you do not see it.</p>
      <form id="pfCode" novalidate><label class="pf-f">6-digit code<input id="pfOtp" class="pf-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456" required></label>${note}
      <div class="pf-btns"><button class="btn brand" type="submit" id="pfVerify" ${st.busy ? raw("disabled") : raw("")}>Verify code</button><button type="button" class="btn" id="pfResend" ${st.wait || st.busy ? raw("disabled") : raw("")}>${st.wait ? "Resend in " + st.wait + "s" : "Send a new code"}</button><button type="button" class="btn" id="pfCancel">Cancel</button></div></form>`;
    if (st.step === "pw") return html`<p class="muted pf-h">Code accepted. Choose your new password (10+ characters, letters and numbers).</p>
      <form id="pfPw" novalidate><label class="pf-f">New password<input id="pfA" type="password" autocomplete="new-password" required></label><label class="pf-f">Confirm password<input id="pfB" type="password" autocomplete="new-password" required></label>${note}
      <div class="pf-btns"><button class="btn brand" type="submit" id="pfSet" ${st.busy ? raw("disabled") : raw("")}>Save new password</button><button type="button" class="btn" id="pfCancel">Cancel</button></div></form>`;
    return html`<p class="muted pf-h">To change your password we first email a 6-digit code to <b>${email}</b> to confirm it is you.</p>${note}<button type="button" class="btn brand" id="pfSend" ${st.busy ? raw("disabled") : raw("")}><i data-lucide="mail"></i>${st.busy === "send" ? "Sending…" : "Email me a code"}</button>`;
  }
  const say = (t, ok) => { st.err = ok ? "" : t; st.msg = ok ? t : ""; };
  const $ = (id) => document.getElementById(id);
  function cooldown() { st.wait = 60; clearInterval(tick); tick = setInterval(() => { st.wait--; if (st.wait <= 0) { st.wait = 0; clearInterval(tick); } const b = $("pfResend"); if (b) { b.disabled = !!st.wait || !!st.busy; b.textContent = st.wait ? "Resend in " + st.wait + "s" : "Send a new code"; } }, 1000); }
  async function sendCode() {
    st.busy = "send"; say(""); draw();
    try { await Data.sendResetCode(email); st.step = "code"; say("Code sent. Check your email.", true); cooldown(); }
    catch (e) { say(/rate|seconds|too many/i.test(e.message) ? "A code was just sent. Please wait a minute before asking for another." : "Could not send the code: " + e.message); }
    st.busy = ""; draw(); const o = $("pfOtp"); if (o) o.focus();
  }
  function wire() {
    const msg = (id, t, ok) => { const e = $(id); if (e) { e.textContent = t; e.className = "pf-note" + (t ? (ok ? " ok" : " err") : ""); } };
    $("pfPick").onclick = () => $("pfFile").click();
    $("pfFile").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return; st.busy = "photo"; msg("pfPhotoMsg", "Uploading…", true);
      try { const blob = await Data.squarePhoto(f), path = await Data.saveMyProfile({ phone: st.phone, photo: blob }); me.avatarPath = path; st.photo = avatarUrl(path); st.busy = ""; draw(); toast("Photo updated"); refreshChrome(); }
      catch (x) { st.busy = ""; draw(); msg("pfPhotoMsg", "Could not update the photo: " + (x.message || x), false); }
    };
    const drop = $("pfDrop"); if (drop) drop.onclick = async () => {
      st.busy = "photo"; draw();
      try { await Data.saveMyProfile({ phone: st.phone, removePhoto: true }); me.avatarPath = ""; st.photo = ""; st.busy = ""; draw(); toast("Photo removed"); refreshChrome(); }
      catch (x) { st.busy = ""; draw(); msg("pfPhotoMsg", "Could not remove the photo: " + (x.message || x), false); }
    };
    $("pfForm").onsubmit = async (e) => {
      e.preventDefault(); if (!canEdit) return; const v = $("pfPhone").value.trim();
      if (v && !/^[0-9+()\- ]{7,20}$/.test(v)) return msg("pfMsg", "Enter a valid mobile number, e.g. +91 98765 43210.", false);
      st.busy = "save"; $("pfSave").disabled = true;
      try { await Data.saveMyProfile({ phone: v }); st.phone = v; if (m) m.phone = v; st.busy = ""; draw(); toast("Profile saved"); }
      catch (x) { st.busy = ""; draw(); msg("pfMsg", "Could not save: " + (x.message || x), false); }
    };
    const send = $("pfSend"); if (send) send.onclick = sendCode;
    const rs = $("pfResend"); if (rs) rs.onclick = sendCode;
    const cn = $("pfCancel"); if (cn) cn.onclick = () => { st.step = "idle"; say(""); draw(); };
    const cf = $("pfCode"); if (cf) cf.onsubmit = async (e) => {
      e.preventDefault(); const t = $("pfOtp").value.replace(/\s+/g, "");
      if (!/^\d{6,8}$/.test(t)) { say("Enter the 6-digit code from the email."); return draw(), $("pfOtp").focus(); }
      st.busy = "verify"; draw();
      try { await Data.verifyResetCode(email, t); st.step = "pw"; say(""); }
      catch (x) { say(/expired|invalid|token/i.test(x.message) ? "That code is wrong or has expired. Check it, or ask for a new one." : "Could not check the code: " + x.message); }
      st.busy = ""; draw(); const o = $("pfOtp") || $("pfA"); if (o) o.focus();
    };
    const pf = $("pfPw"); if (pf) pf.onsubmit = async (e) => {
      e.preventDefault(); const a = $("pfA").value, b = $("pfB").value, pr = pwProblem(a);
      if (pr) { say(pr); return draw(), $("pfA").focus(); } if (a !== b) { say("The two passwords do not match."); return draw(), $("pfB").focus(); }
      st.busy = "set"; draw();
      try { await Data.changePassword(a); st.step = "idle"; st.busy = ""; say("Your password has been changed.", true); draw(); toast("Password changed"); }
      catch (x) { st.busy = ""; say(/different|same/i.test(x.message) ? "Choose a password different from your current one." : "Could not save: " + x.message); draw(); }
    };
  }
  // the sidebar card and the top-right button show the new photo straight away
  function refreshChrome() { document.querySelectorAll(".sb-profile > .avatar, #userBtn > .avatar").forEach((a) => { a.outerHTML = avatar(name, a.closest("#userBtn") ? 40 : 40, st.photo).__raw; }); }
  draw(); loadHours();
})();
