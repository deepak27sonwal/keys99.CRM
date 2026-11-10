(async function () {
  const page = await mountShell("visits");
  if (!page) return;
  const id = Number(new URLSearchParams(location.search).get("id"));
  const MIN = 60000, OPEN = ["Scheduled", "Confirmed"];
  const OUTCOMES = [["Interested", "Move to Negotiations"], ["Not Interested", "Mark as Spam"], ["Need More Time", "Follow-up Later"], ["No Response", "Re-attempt"]];
  const CHECKLIST = [["arrived", "Customer arrived on time"], ["presented", "Project presentation given"], ["flat", "Showed model flat / sample unit"], ["pricing", "Explained pricing & payment plan"],
    ["brochure", "Shared brochure & RERA details"], ["offers", "Discussed offers & next steps"], ["feedback", "Collected customer feedback"]];
  const RATINGS = [["overall", "Overall Experience"], ["location", "Project Location"], ["construction", "Construction Quality"], ["amenities", "Amenities & Facilities"], ["pricing", "Pricing & Value"]];
  const ACTIONS = ["Follow-up Call", "Send Brochure", "Share Price Quote", "Schedule Revisit", "Site Visit Reminder", "Collect Documents"];
  const state = { allTimeline: false, drafts: {}, filesError: "" };
  let v, lead, files = [], urls = {};

  async function load() {
    try {
      v = await Data.getSiteVisit(id);
      if (!v) { page.innerHTML = '<div class="card empty">Site visit not found. <a class="brand-t" href="site-visits.html">Back to site visits</a></div>'; return false; }
      lead = (await Data.getLead("L-" + v.enquiry_id)) || { dbId: v.enquiry_id, name: "Unknown", acts: [] };
      state.filesError = "";
      try { files = await Data.listVisitFiles(id); urls = await Data.signedUrls(files.map((f) => f.path)); } catch (e) { files = []; urls = {}; state.filesError = e.message; }
      return true;
    } catch (e) { page.innerHTML = '<div class="card empty">Could not load the site visit: ' + esc(e.message) + "</div>"; return false; }
  }
  const vid = () => `SV-${new Date(v.created_at).getFullYear()}-${String(v.id).padStart(4, "0")}`;
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { alert("Could not save: " + e.message); } };
  const refresh = async () => { state.drafts = {}; if (await load()) draw(); };
  const save = async (patch, log) => {
    const p = { ...patch, ...(log ? await Data.logVisit(v, log.text, log.kind) : {}) };
    await Data.updateSiteVisit(id, p); Object.assign(v, p);
  };
  const fmtWhen = (ts) => { const d = new Date(ts); return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}, ${fmtTime(d)}`; };
  const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const isImg = (f) => /^image\//.test(f.type);

  function window_() {
    const start = new Date(v.visit_at), end = v.end_at ? new Date(v.end_at) : new Date(+start + 90 * MIN);
    return { start, end, siteEnd: v.site_end_at ? new Date(v.site_end_at) : new Date(Math.min(+start + 60 * MIN, +end)), pickup: v.pickup_at ? new Date(v.pickup_at) : null };
  }

  // ---------- cards ----------
  const kv = (rows) => html`<dl class="kv2 vd-kv">${rows.map(([k, val]) => html`<dt>${k}</dt><dd>${val || "—"}</dd>`)}</dl>`;
  const card = (area, icon, title, body, extra) => html`<section class="card p vd-${area}"><div class="ch"><i data-lucide="${icon}"></i><h3>${title}</h3>${extra ? html`<div style="margin-left:auto">${extra}</div>` : raw("")}</div>${body}</section>`;

  function customerCard() {
    return card("cust", "user", "Customer Details", html`<div class="vd-person">${avatar(lead.name, 66)}<div class="vd-pi"><div class="row" style="flex-wrap:wrap"><a href="customer.html?id=${encodeURIComponent(lead.id || "")}"><b class="vd-name">${lead.name}</b></a><span class="idchip sm">Lead ID: ${lead.id || "—"}</span></div>
      <div class="vc-line"><i data-lucide="phone"></i><a href="${telHref(lead.mobile)}">${lead.mobile || "—"}</a>${lead.mobile ? html`<a href="${waHref(lead.mobile)}" target="_blank" rel="noopener" aria-label="WhatsApp"><i data-lucide="message-circle" class="wa-t"></i></a>` : raw("")}</div>
      ${lead.email ? html`<div class="vc-line"><i data-lucide="mail"></i>${lead.email}</div>` : raw("")}</div></div>
      ${kv([["Requirement", [lead.requirement, lead.propertyType].filter(Boolean).join(" – ")], ["Preferred Location", lead.location], ["Budget", lead.budget], ["Configuration", lead.bhk], ["Lead Status", lead.status ? badge(lead.status) : ""]])}`);
  }
  function infoCard() {
    const w = window_();
    return card("info", "calendar-days", "Site Visit Information", kv([["Project", html`<a class="brand-t" href="leads.html?q=${encodeURIComponent(v.project || "")}"><b>${v.project || "—"}</b></a>`], ["Developer", lead.developer],
      ["Visit Date", fmtLongDay(w.start)], ["Time", `${fmtTime(w.start)} – ${fmtTime(w.end)}`], ["Meeting Point", v.meeting_point ? html`<i data-lucide="map-pin" class="inl-ic"></i>${v.meeting_point}` : ""],
      ["Assigned Agent", lead.agent ? html`<span class="row">${avatar(lead.agent, 30)}<b>${lead.agent}</b></span>` : ""], ["Visit Status", html`<span class="badge big b-${v.status}">${v.status === "Completed" ? raw('<i data-lucide="circle-check"></i>') : raw("")}${v.status}</span>`]]));
  }
  function projectCard() {
    return card("projc", "building-2", "Project: " + (v.project || "—"), html`<div class="vd-proj"><div class="thumb big">${buildingSvg()}</div><ul class="vd-facts">
      ${lead.location ? html`<li><i data-lucide="map-pin"></i>${lead.location}</li>` : raw("")}${lead.bhk ? html`<li><i data-lucide="building-2"></i>${lead.bhk}</li>` : raw("")}${lead.budget ? html`<li><i data-lucide="indian-rupee"></i>${lead.budget}</li>` : raw("")}
      ${lead.developer ? html`<li><i data-lucide="briefcase"></i>${lead.developer}</li>` : raw("")}</ul></div>
      <a class="btn" style="width:100%;justify-content:center;margin-top:10px" href="leads.html?q=${encodeURIComponent(v.project || "")}">View leads for this project<i data-lucide="arrow-right"></i></a>`);
  }

  function workflowCard() {
    const cancelled = v.status === "Cancelled";
    const steps = [["Scheduled", v.created_at], ["Confirmed", v.confirmed_at], ["Visited", v.visited_at], ["Completed", v.completed_at]];
    const doneN = steps.filter((s) => s[1]).length, lastDone = doneN - 1;
    const hasFu = !!(v.next_due || (lead.followUpTs && new Date(lead.followUpTs) > new Date())), fuAt = v.next_due ? fmtLongDay(v.next_due + "T12:00:00") : lead.followUpTs ? fmtLongDay(lead.followUpTs) : "";
    const next = cancelled || v.status === "Completed" ? null : !v.confirmed_at ? ["confirm", "Mark confirmed"] : !v.visited_at ? ["visit", "Mark visited"] : ["complete", "Mark completed"];
    return html`<section class="card p vd-wf"><div class="vd-wfgrid"><div><div class="ch"><i data-lucide="workflow"></i><h3>Visit Workflow</h3>${cancelled ? html`<span class="badge b-Cancelled" style="margin-left:auto">Visit cancelled</span>` : raw("")}</div>
      <div class="stepper vd-stepper">${steps.map(([k, at], i) => html`<div class="s ${at ? (i === lastDone ? "cur" : "done") : ""}"><div class="c">${at ? raw('<i data-lucide="check"></i>') : ""}</div><b>${k}</b><span>${at ? fmtWhen(at) : "—"}</span></div>`)}
        <div class="s"><div class="c"></div><b>Follow-up</b><span>${hasFu ? "Pending · " + fuAt : "Not scheduled"}</span></div></div>
      ${next ? html`<button class="btn sm brand" id="advance" style="margin-top:10px" data-step="${next[0]}"><i data-lucide="arrow-right-circle"></i>${next[1]}</button>` : raw("")}</div>
      <div class="vd-outcome"><div class="ch"><i data-lucide="circle-check"></i><h3>Visit Outcome</h3></div><div class="outs" role="radiogroup" aria-label="Visit outcome">${OUTCOMES.map(([val, act]) => html`<label class="out ${v.outcome === val ? "on" : ""}"><input type="radio" name="outcome" value="${val}" ${v.outcome === val ? raw("checked") : raw("")} ${cancelled ? raw("disabled") : raw("")}><span><b>${val}</b> – ${act}</span></label>`)}</div>
        <button class="btn gold sm" id="saveOutcome" ${cancelled ? raw("disabled") : raw("")}><i data-lucide="check"></i>Save outcome</button></div></div></section>`;
  }

  function docsCard() {
    const docs = files.filter((f) => !isImg(f)), photos = files.filter(isImg);
    const upload = html`<label class="btn sm" for="fileIn" style="cursor:pointer"><i data-lucide="upload"></i>Upload</label><input id="fileIn" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" hidden>`;
    return card("docs", "folder", "Documents & Media", html`${state.filesError ? html`<div class="banner">Files are unavailable: ${state.filesError}</div>` : raw("")}
      ${docs.length ? html`<ul class="docs">${docs.map((f) => html`<li><i data-lucide="file-text" class="pdf"></i><a href="${urls[f.path] || "#"}" target="_blank" rel="noopener" class="grow">${f.name}</a><small>${fmtSize(f.size)}</small><a class="icon-btn" href="${urls[f.path] || "#"}" download="${f.name}" aria-label="Download ${f.name}"><i data-lucide="download"></i></a><button class="icon-btn" data-rm="${f.path}" aria-label="Delete ${f.name}"><i data-lucide="trash-2"></i></button></li>`)}</ul>` : raw("")}
      ${photos.length ? html`<div class="ph-h"><i data-lucide="image"></i><b>Site Visit Photos (${photos.length})</b></div><div class="photos">${photos.slice(0, 4).map((f, i) => html`<a href="${urls[f.path] || "#"}" target="_blank" rel="noopener" class="ph" title="${f.name}"><img src="${urls[f.path] || ""}" alt="${f.name}" loading="lazy">${i === 3 && photos.length > 4 ? html`<span class="more-ph">+${photos.length - 4}</span>` : raw("")}</a>`)}</div>
        ${photos.length > 4 ? html`<button class="auth-link" id="allPhotos" style="margin-top:8px">View all photos</button>` : raw("")}` : raw("")}
      ${!files.length && !state.filesError ? html`<div class="empty-sm">No documents yet. Upload brochures, quotes or visit photos (PDF, JPG, PNG, WebP up to 10 MB).</div>` : raw("")}`, upload);
  }

  function checklistCard() {
    const c = v.checklist || {}, n = CHECKLIST.filter(([k]) => c[k]).length;
    return card("chk", "clipboard-list", "Agent Visit Checklist", html`<ul class="chk">${CHECKLIST.map(([k, l]) => html`<li><label><input type="checkbox" data-chk="${k}" ${c[k] ? raw("checked") : raw("")}><span>${l}</span></label></li>`)}</ul><div class="chk-p"><div class="bar"><i style="width:${(n / CHECKLIST.length) * 100}%"></i></div><small>${n} of ${CHECKLIST.length} done</small></div>`);
  }
  function feedbackCard() {
    const f = v.feedback || {}, r = f.ratings || {}, notes = state.drafts.notes !== undefined ? state.drafts.notes : f.notes || "";
    return card("fb", "message-square-text", "Customer Feedback", html`<div class="fb-grid"><div class="rates">${RATINGS.map(([k, l]) => html`<div class="rate"><span>${l}</span><span class="stars" role="radiogroup" aria-label="${l}">${[1, 2, 3, 4, 5].map((n) => html`<button class="star ${(r[k] || 0) >= n ? "on" : ""}" data-rate="${k}" data-n="${n}" role="radio" aria-checked="${r[k] === n}" aria-label="${n} star${n > 1 ? "s" : ""}"><i data-lucide="star"></i></button>`)}</span></div>`)}</div>
      <div class="fb-notes"><div class="ch" style="margin-bottom:6px"><i data-lucide="notebook-pen"></i><h3 style="font-size:15px">Feedback Notes</h3></div><textarea id="fbNotes" rows="5" placeholder="What did the customer say about the project, price and next steps?">${notes}</textarea><button class="btn sm" id="saveFb" style="margin-top:8px"><i data-lucide="check"></i>Save feedback</button></div></div>`);
  }
  function remarksCard() {
    const rem = state.drafts.remarks !== undefined ? state.drafts.remarks : v.remarks || "";
    return card("rem", "notebook-pen", "Remarks & Next Action", html`<div class="rem-grid"><label class="rem">Visit Remarks (by Agent)<textarea id="remarks" rows="4" placeholder="Add visit remarks, customer feedback and next steps…">${rem}</textarea></label>
      <div class="na"><label class="rem">Next Action<select id="naAction">${ACTIONS.map((a) => html`<option ${a === (v.next_action || "Follow-up Call") ? raw("selected") : raw("")}>${a}</option>`)}</select></label>
        <label class="rem">Due Date<input type="date" id="naDue" value="${v.next_due || ""}" min="${dayKey(new Date())}"></label><button class="btn brand" id="addTask"><i data-lucide="plus"></i>Add Task</button></div></div>
      <button class="btn sm" id="saveRemarks" style="margin-top:8px"><i data-lucide="check"></i>Save remarks</button>`);
  }
  function timelineCard() {
    const ev = [{ t: v.created_at, text: "Site visit scheduled", kind: "task", by: v.created_by || "" }, ...(v.timeline || [])].sort((a, b) => new Date(b.t) - new Date(a.t));
    const shown = state.allTimeline ? ev : ev.slice(0, 4), ic = { done: "circle-check", note: "notebook-pen", task: "calendar-plus", cancel: "circle-x" };
    return card("tl", "history", "Activity Timeline", html`<ul class="tl2">${shown.map((e) => html`<li class="k-${e.kind || "note"}"><span class="dot"><i data-lucide="${ic[e.kind] || "circle"}"></i></span><div><b>${e.text}</b><small>${fmtWhen(e.t)}${e.by ? " · " + e.by : ""}</small></div></li>`)}</ul>`,
      ev.length > 4 ? html`<button class="more" id="allTl" style="background:none;border:0;cursor:pointer">${state.allTimeline ? "Show less" : "View All"}<i data-lucide="arrow-right"></i></button>` : null);
  }

  function draw() {
    const live = OPEN.includes(v.status);
    render(page, html`
      <div class="page-head"><div><div class="crumb"><a href="site-visits.html">Site Visits</a> <i data-lucide="chevron-right" style="width:14px;height:14px"></i><b>Visit Details</b></div>
        <h1>Site Visit Details <span class="idchip ok" title="Visit ID">Visit ID: ${vid()}</span></h1><p class="sub">Complete information, status, checklist, feedback and next actions for this site visit.</p></div>
        <div class="btns"><a class="btn brand" href="site-visits.html"><i data-lucide="arrow-left"></i>Back</a><button class="btn" id="editV"><i data-lucide="pencil"></i>Edit Visit</button>
          ${live ? html`<button class="btn" id="resched"><i data-lucide="calendar-clock"></i>Reschedule</button><button class="btn red" id="cancelV"><i data-lucide="x"></i>Cancel Visit</button>` : raw("")}<button class="btn" id="share"><i data-lucide="share-2"></i>Share</button></div></div>
      <div class="vd-grid">${customerCard()}${infoCard()}${projectCard()}${workflowCard()}${docsCard()}${checklistCard()}${feedbackCard()}${remarksCard()}${timelineCard()}</div>`);
    bind();
  }

  // ---------- actions ----------
  function bind() {
    const $ = (s) => page.querySelector(s), $$ = (s) => page.querySelectorAll(s);
    $("#editV").onclick = () => openEditVisit({ raw: v }, refresh);
    const rs = $("#resched"); if (rs) rs.onclick = () => openEditVisit({ raw: v }, refresh, true);
    const cv = $("#cancelV"); if (cv) cv.onclick = guard(async () => { if (!confirm("Cancel this site visit?")) return; await save(await Data.visitStatusPatch(v, "Cancelled")); toast("Visit cancelled"); draw(); });
    $("#share").onclick = () => { const w = window_(), text = `Site visit ${vid()}: ${lead.name} – ${v.project || ""}, ${fmtLongDay(w.start)} ${fmtTime(w.start)}`;
      if (navigator.share) navigator.share({ title: "Site visit " + vid(), text, url: location.href }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(() => toast("Link copied"), () => prompt("Copy this link", location.href)); else prompt("Copy this link", location.href); };
    const adv = $("#advance");
    if (adv) adv.onclick = guard(async () => {
      const t = new Date().toISOString(), s = adv.dataset.step;
      if (s === "confirm") await save(await Data.visitStatusPatch(v, "Confirmed"));
      else if (s === "visit") await save({ visited_at: t, confirmed_at: v.confirmed_at || t }, { text: "Customer visited the site", kind: "done" });
      else { await save(await Data.visitStatusPatch(v, "Completed")); if (["New Leads", "Contacted", "Interested", "Visit Scheduled"].includes(lead.status)) await Data.updateLead(lead.dbId, { status: "Visit Done" }); }
      await refresh();
    });
    $("#saveOutcome").onclick = guard(async () => { const c = page.querySelector("input[name=outcome]:checked"); await applyVisitOutcome(v, lead, c ? c.value : "", state.drafts.remarks !== undefined ? state.drafts.remarks : v.remarks, refresh); });
    $$("[data-chk]").forEach((c) => (c.onchange = guard(async () => { const prev = { ...(v.checklist || {}) }; try { await save({ checklist: { ...prev, [c.dataset.chk]: c.checked } }); draw(); } catch (e) { v.checklist = prev; draw(); throw e; } })));
    $$("[data-rate]").forEach((b) => (b.onclick = guard(async () => { const f = v.feedback || {}, cur = (f.ratings || {})[b.dataset.rate], n = Number(b.dataset.n); await save({ feedback: { ...f, ratings: { ...(f.ratings || {}), [b.dataset.rate]: cur === n ? 0 : n } } }); draw(); })));
    const fn = $("#fbNotes"); fn.oninput = () => (state.drafts.notes = fn.value);
    $("#saveFb").onclick = guard(async () => { await save({ feedback: { ...(v.feedback || {}), notes: fn.value.trim() } }, { text: "Customer feedback recorded", kind: "note" }); state.drafts.notes = undefined; toast("Feedback saved"); draw(); });
    const rm = $("#remarks"); rm.oninput = () => (state.drafts.remarks = rm.value);
    $("#saveRemarks").onclick = guard(async () => { await save({ remarks: rm.value.trim() || null }, { text: "Visit remarks added" + (await Data.userEmail() ? " by " + (await Data.userEmail()) : ""), kind: "note" }); state.drafts.remarks = undefined; toast("Remarks saved"); draw(); });
    $("#addTask").onclick = guard(async () => {
      const due = $("#naDue").value, action = $("#naAction").value; if (!due) throw new Error("Choose a due date for the task.");
      await Data.scheduleFollowUp(lead, localISO(due, "10:00"), `Next action: ${action} (visit ${vid()})`);
      await save({ next_action: action, next_due: due }, { text: `Follow-up scheduled for ${fmtLongDay(due + "T12:00:00")}: ${action}`, kind: "task" });
      toast("Task added: follow-up scheduled"); await refresh();
    });
    const fi = $("#fileIn");
    fi.onchange = guard(async () => {
      const list = [...fi.files]; if (!list.length) return; let n = 0, bad = [];
      for (const f of list) { try { await Data.uploadVisitFile(id, f); n++; } catch (e) { bad.push(e.message); } }
      if (n) await save({}, { text: `${n} file${n > 1 ? "s" : ""} uploaded`, kind: "note" });
      fi.value = ""; await refresh(); if (n) toast(n + " file" + (n > 1 ? "s" : "") + " uploaded"); if (bad.length) alert(bad.join("\n"));
    });
    $$("[data-rm]").forEach((b) => (b.onclick = guard(async () => { if (!confirm("Delete this file?")) return; await Data.removeVisitFile(b.dataset.rm); toast("File deleted"); await refresh(); })));
    const ap = $("#allPhotos"); if (ap) ap.onclick = () => files.filter(isImg).forEach((f, i) => i >= 4 && window.open(urls[f.path], "_blank", "noopener"));
    const at = $("#allTl"); if (at) at.onclick = () => { state.allTimeline = !state.allTimeline; draw(); };
  }

  if (!(await load())) return;
  draw();
})();
