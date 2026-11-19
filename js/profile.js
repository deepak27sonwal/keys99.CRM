// My profile: photo, mobile number, read-only job details, and a password change confirmed with a 6-digit code emailed to the person.
(async function () {
  const page = await mountShell("profile");
  if (!page) return;
  const me = window.ME, email = (await Data.session()).user.email, name = me.name, m = me.member, canEdit = !!me.memberId;
  const st = { photo: avatarUrl(me.avatarPath), busy: "", step: "idle", msg: "", err: "", wait: 0, phone: m ? m.phone || "" : "" };
  let tick = null;
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
          <section class="card p" aria-label="Change password"><div class="ch"><i data-lucide="key-round"></i><h3>Change password</h3></div>${security()}</section>
        </div>
      </div>`);
    wire();
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
  draw();
})();
