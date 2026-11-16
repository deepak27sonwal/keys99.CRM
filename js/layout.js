// Shared shell: sidebar + top bar + auth guard. Returns the <main> element.
// Sidebar: single links and collapsible groups. Item = [label, href, icon, key]; key is what each page passes to mountShell() to highlight itself.
const NAV = [
  ["Dashboard", "index.html", "layout-dashboard", "dashboard"],
  { group: "Sales", id: "sales", icon: "trending-up", items: [
    ["Leads Management", "leads.html", "user-search", "leads"], ["Customers", "customer.html", "users", "customer"], ["Sales Pipeline", "pipeline.html", "filter", "pipeline"],
    ["Site Visits", "site-visits.html", "map-pin", "visits"], ["Bookings & Deals", "#", "file-signature"], ["Tasks & Follow-ups", "tasks.html", "list-checks", "tasks"], ["Calendar", "calendar.html", "calendar-days", "calendar"], ["Commissions", "#", "wallet"]] },
  { group: "Property", id: "property", icon: "building-2", items: [["Developers", "developers.html", "building-2", "developers"], ["Projects", "projects.html", "landmark", "projects"]] },
  { group: "Manage", id: "manage", icon: "briefcase", items: [
    ["Agents & Teams", "agents.html", "users-round", "agents"], ["Marketing & Campaigns", "#", "megaphone"], ["Integrations", "integrations.html", "plug-zap", "integrations"],
    ["Documents", "#", "file-text"], ["Reports & Analytics", "#", "bar-chart-3"]] },
  ["Settings", "settings.html", "settings", "settings"],
];
const navLink = ([label, href, icon, key], active) => html`<a href="${href}" class="${key && key === active ? "active" : ""}" ${key && key === active ? raw('aria-current="page"') : raw("")}><i data-lucide="${icon}"></i>${label}</a>`;
const EMP_KEYS = ["dashboard", "leads", "customer", "pipeline", "visits", "tasks", "calendar"], ADMIN_KEYS = ["agents", "integrations", "projects", "developers", "settings"];
// employees only get the pages that work on their own leads; everything else is hidden (and blocked by the database anyway)
const navFor = (role) => role === "employee"
  ? NAV.map((n) => (Array.isArray(n) ? (EMP_KEYS.includes(n[3]) ? n : null) : { ...n, items: n.items.filter((it) => EMP_KEYS.includes(it[3])) })).filter((n) => n && (Array.isArray(n) || n.items.length))
  : NAV;
function navHtml(active, role) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("k99.nav") || "{}"); } catch { /* no saved choice */ }
  return navFor(role).map((n) => {
    if (Array.isArray(n)) return navLink(n, active);
    const has = n.items.some((it) => it[3] && it[3] === active), open = has || saved[n.id] === true;     // the group holding this page is always open
    return html`<div class="ng ${open ? "open" : ""}" data-g="${n.id}"><button type="button" class="ng-h ${has ? "has-active" : ""}" aria-expanded="${open}" aria-controls="ng-${n.id}"><i data-lucide="${n.icon}"></i><span>${n.group}</span><i class="ng-c" data-lucide="chevron-down"></i></button>
      <div class="ng-b" id="ng-${n.id}"><div class="ng-in">${n.items.map((it) => navLink(it, active))}</div></div></div>`;
  });
}

async function mountShell(active) {
  const root = document.getElementById("root");
  if (!Data.configured) { root.innerHTML = '<div style="padding:40px;font-family:sans-serif">Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in <code>js/config.js</code>.</div>'; return null; }
  const sess = await Data.session();
  if (!sess) { location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search)); return null; }
  const email = sess.user.email;
  let me = null;
  try { me = await Data.getMe(sess); } catch (e) { root.innerHTML = '<div style="padding:40px;font-family:sans-serif">Could not check your access: ' + esc(e.message || e) + '. <a href="">Try again</a></div>'; return null; }
  if (me) me.uid = sess.user.id;
  window.ME = me;
  if (!me || !me.active) { accessScreen(root, me ? "Your login has been switched off. Please ask an admin." : "Your login has no access yet. Please ask an admin to set you up."); return null; }
  if (me.mustChange) { changePasswordScreen(root, email); return null; }
  if (me.role !== "admin" && ADMIN_KEYS.includes(active)) { location.replace("index.html"); return null; }
  const role = me.role === "admin" ? "Admin" : "Employee";
  render(root, html`
    <div class="app">
      <div class="sidebar-backdrop" id="backdrop"></div>
      <aside class="sidebar" id="sidebar">
        <button type="button" class="sb-close" id="sbClose" aria-label="Close menu"><i data-lucide="x"></i></button>
        <div class="logo"><b>Keys<span>99</span></b><em>CRM</em><small>Channel Partner CRM</small></div>
        <nav class="nav">
          ${navHtml(active, me.role)}
        </nav>
        <div class="sidebar-art">${buildingSvg()}</div>
      </aside>
      <div class="main-col">
        <header class="topbar">
          <button class="menu-btn" id="menuBtn" aria-label="Menu"><i data-lucide="menu"></i></button>
          <div class="search"><i data-lucide="search"></i><input id="globalSearch" placeholder="Search leads, customers, projects, developers..."></div>
          <div class="top-actions">
            <div class="bell-wrap"><button type="button" class="bell" id="bellBtn" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false"><i data-lucide="bell"></i><span class="bell-n" id="bellN" hidden></span></button></div>
            <i data-lucide="message-circle" class="wa"></i>
            <a href="calendar.html" class="cal-link" aria-label="Open the calendar" title="Calendar"><i data-lucide="calendar-days" class="cal"></i></a>
            <button class="user" id="userBtn" title="Your profile" aria-haspopup="dialog" aria-expanded="false">
              ${avatar(email, 40)}<span class="who"><b>${email}</b><span>${role}</span></span>
            </button>
          </div>
        </header>
        <main id="main"><div id="page"><div class="empty">Loading…</div></div></main>
      </div>
    </div>`);
  const sb = document.getElementById("sidebar"), bd = document.getElementById("backdrop");
  const toggle = (open) => { sb.classList.toggle("open", open); bd.classList.toggle("open", open); };
  document.getElementById("menuBtn").onclick = () => toggle(!sb.classList.contains("open"));
  bd.onclick = () => { toggle(false); document.getElementById("menuBtn").focus(); };      // same as Escape and the X: focus goes back to the opener
  document.getElementById("sbClose").onclick = () => { toggle(false); document.getElementById("menuBtn").focus(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sb.classList.contains("open")) { toggle(false); document.getElementById("menuBtn").focus(); } });
  sb.querySelectorAll("a").forEach((a) => (a.onclick = () => toggle(false)));
  sb.querySelectorAll(".ng-h").forEach((h) => (h.onclick = () => {
    if (h.classList.contains("has-active")) return;                                  // the group holding the current page stays open
    const g = h.closest(".ng"), open = !g.classList.contains("open"); g.classList.toggle("open", open); h.setAttribute("aria-expanded", String(open));
    try { const st = JSON.parse(localStorage.getItem("k99.nav") || "{}"); st[g.dataset.g] = open; localStorage.setItem("k99.nav", JSON.stringify(st)); } catch { /* remembering is optional */ }
  }));
  document.getElementById("userBtn").onclick = (e) => { e.stopPropagation(); openProfile(e.currentTarget, sess, me); };
  const gs = document.getElementById("globalSearch");
  if (active !== "leads") gs.onkeydown = (e) => { if (e.key === "Enter" && gs.value.trim()) location.href = "leads.html?q=" + encodeURIComponent(gs.value.trim()); };
  // the bell: loaded after the page shell so it never delays the page
  const ns = document.createElement("script"); ns.src = "js/notify.js"; ns.onload = () => window.Notify && Notify.init(sess); document.head.appendChild(ns);
  const ws = document.createElement("script"); ws.src = "js/workflow.js"; ws.onload = () => window.Workflow && Workflow.init(); document.head.appendChild(ws);
  return document.getElementById("page");
}

// Profile card under the avatar: who is signed in, their team details (matched by email on Agents & Teams), password reset and log out.
function openProfile(btn, sess, me) {
  const old = document.querySelector(".profile-pop");
  if (old) { old.remove(); btn.setAttribute("aria-expanded", "false"); return; }
  const u = sess.user || {}, email = u.email || "", nice = (e) => String(e).split("@")[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || "You";
  const when = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); };
  const pop = document.createElement("div"); pop.className = "profile-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Your profile");
  const draw = (m) => {
    const rows = [["Role", me && me.role === "employee" ? "Employee" : "Admin"], ...(m ? [["Designation", m.designation || (m.kind === "rm" ? "Relationship Manager" : "Agent")], ["Team", m.team], ["Mobile", m.phone], ["Location", m.location]] : []),
      ["Last sign-in", when(u.last_sign_in_at)], ["Account created", when(u.created_at)]].filter(([, v]) => v);
    pop.innerHTML = `<div class="pp-top">${avatar(m ? m.name : email, 56).__raw}<div><b>${esc(m ? m.name : nice(email))}</b><span>${esc(email)}</span></div></div>
      <dl class="pp-d">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <div class="pp-a"><button type="button" class="btn sm" id="ppReset"><i data-lucide="key-round"></i>Send password reset email</button><button type="button" class="btn sm red" id="ppOut"><i data-lucide="log-out"></i>Log out</button></div>`;
    if (window.lucide) lucide.createIcons();
    pop.querySelector("#ppOut").onclick = () => Data.signOut();
    pop.querySelector("#ppReset").onclick = async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try { const { error } = await Data.client.auth.resetPasswordForEmail(email, { redirectTo: new URL("reset.html", location.href).href }); if (error) throw error; toast("Password reset email sent to " + email); }
      catch (err) { toast("Could not send the email: " + err.message); }
      b.disabled = false;
    };
  };
  draw(null); document.body.appendChild(pop); btn.setAttribute("aria-expanded", "true");
  Data.getTeamCached().then((t) => { const m = (t || []).find((x) => x.email && x.email.toLowerCase() === email.toLowerCase()); if (m && pop.isConnected) draw(m); }).catch(() => {});
  const close = () => { pop.remove(); btn.setAttribute("aria-expanded", "false"); document.removeEventListener("mousedown", away, true); document.removeEventListener("keydown", onKey); };
  const away = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) close(); }, onKey = (e) => { if (e.key === "Escape") { close(); btn.focus(); } };
  document.addEventListener("mousedown", away, true); document.addEventListener("keydown", onKey);
  new MutationObserver((_, o) => { if (!pop.isConnected) { o.disconnect(); close(); } }).observe(document.body, { childList: true });
}

function kpiCard([label, value, delta, icon, primary, green]) {
  const neg = String(delta).startsWith("-");
  return html`<div class="kpi ${primary ? "primary" : ""} ${green ? "greenic" : ""}"><i data-lucide="${icon}"></i>
    <div><div class="lbl">${label}</div><div class="val">${value}</div>${delta ? html`<div class="dl ${neg ? "neg" : ""}"><i data-lucide="${neg ? "arrow-down" : "arrow-up"}"></i>${delta}</div>` : raw('<div class="dl">&nbsp;</div>')}</div></div>`;
}

// A signed-in person with no (or a switched-off) access row sees nothing but this notice.
function accessScreen(root, msg) {
  root.innerHTML = `<div class="auth"><main class="auth-main" style="grid-column:1/-1"><div class="auth-card"><div class="m-logo" style="display:block"><b>Keys<span>99</span> CRM</b></div><h1>No access</h1><p class="sub">${esc(msg)}</p><p class="auth-foot"><button type="button" class="auth-link" id="noAccOut">Log out</button></p></div></main></div>`;
  document.getElementById("noAccOut").onclick = () => Data.signOut();
}
// First sign-in with a temporary password: choose a new one before anything else is shown.
function pwProblem(p, old) {
  if (p.length < 10) return "Use at least 10 characters.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Use letters and numbers.";
  if (old && p === old) return "Choose a password different from the temporary one.";
  return "";
}
function changePasswordScreen(root, email) {
  root.innerHTML = `<div class="auth"><main class="auth-main" style="grid-column:1/-1"><div class="auth-card"><div class="m-logo" style="display:block"><b>Keys<span>99</span> CRM</b></div>
    <h1>Choose your password</h1><p class="sub">You signed in with a temporary password. Set your own to continue.</p>
    <form id="cpForm" novalidate><label>New password<input id="cpA" type="password" autocomplete="new-password" required></label>
    <label>Confirm password<input id="cpB" type="password" autocomplete="new-password" required></label>
    <div class="auth-msg" id="cpMsg" role="alert" aria-live="polite"></div><button class="btn gold auth-submit" id="cpBtn" type="submit">Save password</button></form>
    <p class="auth-foot">${esc(email)} · <button type="button" class="auth-link" id="cpOut">Log out</button></p></div></main></div>`;
  const msg = document.getElementById("cpMsg"), say = (t) => { msg.textContent = t; msg.className = "auth-msg" + (t ? " err" : ""); };
  document.getElementById("cpOut").onclick = () => Data.signOut();
  document.getElementById("cpForm").onsubmit = async (e) => {
    e.preventDefault(); const a = document.getElementById("cpA").value, b = document.getElementById("cpB").value;
    const pr = pwProblem(a); if (pr) return say(pr); if (a !== b) return say("The two passwords do not match.");
    const btn = document.getElementById("cpBtn"); btn.disabled = true; say("");
    try { await Data.changePassword(a); location.reload(); } catch (x) { btn.disabled = false; say(/different|same/i.test(x.message) ? "Choose a password different from the temporary one." : "Could not save: " + x.message); }
  };
}
