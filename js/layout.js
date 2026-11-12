// Shared shell: sidebar + top bar + auth guard. Returns the <main> element.
// Sidebar: single links and collapsible groups. Item = [label, href, icon, key]; key is what each page passes to mountShell() to highlight itself.
const NAV = [
  ["Dashboard", "index.html", "layout-dashboard", "dashboard"],
  { group: "Sales", id: "sales", icon: "trending-up", items: [
    ["Leads Management", "leads.html", "user-search", "leads"], ["Customers", "customer.html", "users", "customer"], ["Sales Pipeline", "#", "filter"],
    ["Site Visits", "site-visits.html", "map-pin", "visits"], ["Bookings & Deals", "#", "file-signature"], ["Tasks & Follow-ups", "#", "list-checks"], ["Commissions", "#", "wallet"]] },
  { group: "Property", id: "property", icon: "building-2", items: [["Developers", "#", "building-2"], ["Projects", "#", "landmark"]] },
  { group: "Manage", id: "manage", icon: "briefcase", items: [
    ["Agents & Teams", "agents.html", "users-round", "agents"], ["Marketing & Campaigns", "#", "megaphone"], ["Integrations", "integrations.html", "plug-zap", "integrations"],
    ["Documents", "#", "file-text"], ["Reports & Analytics", "#", "bar-chart-3"]] },
  ["Settings", "#", "settings"],
];
const navLink = ([label, href, icon, key], active) => html`<a href="${href}" class="${key && key === active ? "active" : ""}" ${key && key === active ? raw('aria-current="page"') : raw("")}><i data-lucide="${icon}"></i>${label}</a>`;
function navHtml(active) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("k99.nav") || "{}"); } catch { /* no saved choice */ }
  return NAV.map((n) => {
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
  render(root, html`
    <div class="app">
      <div class="sidebar-backdrop" id="backdrop"></div>
      <aside class="sidebar" id="sidebar">
        <div class="logo"><b>Keys<span>99</span></b><em>CRM</em><small>Channel Partner CRM</small></div>
        <nav class="nav">
          ${navHtml(active)}
        </nav>
        <div class="sidebar-art">${buildingSvg()}</div>
      </aside>
      <div class="main-col">
        <header class="topbar">
          <button class="menu-btn" id="menuBtn" aria-label="Menu"><i data-lucide="menu"></i></button>
          <div class="search"><i data-lucide="search"></i><input id="globalSearch" placeholder="Search leads, customers, projects, developers..."></div>
          <div class="top-actions">
            <span class="bell"><i data-lucide="bell"></i></span>
            <i data-lucide="message-circle" class="wa"></i>
            <i data-lucide="calendar-days" class="cal"></i>
            <button class="user" id="userBtn" title="Click to log out">
              ${avatar(email, 40)}<span class="who"><b>${email}</b><span>Admin</span></span>
            </button>
          </div>
        </header>
        <main id="main"><div id="page"><div class="empty">Loading…</div></div></main>
      </div>
    </div>`);
  const sb = document.getElementById("sidebar"), bd = document.getElementById("backdrop");
  const toggle = (open) => { sb.classList.toggle("open", open); bd.classList.toggle("open", open); };
  document.getElementById("menuBtn").onclick = () => toggle(!sb.classList.contains("open"));
  bd.onclick = () => toggle(false);
  sb.querySelectorAll("a").forEach((a) => (a.onclick = () => toggle(false)));
  sb.querySelectorAll(".ng-h").forEach((h) => (h.onclick = () => {
    const g = h.closest(".ng"), open = !g.classList.contains("open"); g.classList.toggle("open", open); h.setAttribute("aria-expanded", String(open));
    try { const st = JSON.parse(localStorage.getItem("k99.nav") || "{}"); st[g.dataset.g] = open; localStorage.setItem("k99.nav", JSON.stringify(st)); } catch { /* remembering is optional */ }
  }));
  document.getElementById("userBtn").onclick = () => { if (confirm("Log out?")) Data.signOut(); };
  const gs = document.getElementById("globalSearch");
  if (active !== "leads") gs.onkeydown = (e) => { if (e.key === "Enter" && gs.value.trim()) location.href = "leads.html?q=" + encodeURIComponent(gs.value.trim()); };
  return document.getElementById("page");
}

function kpiCard([label, value, delta, icon, primary, green]) {
  const neg = String(delta).startsWith("-");
  return html`<div class="kpi ${primary ? "primary" : ""} ${green ? "greenic" : ""}"><i data-lucide="${icon}"></i>
    <div><div class="lbl">${label}</div><div class="val">${value}</div>${delta ? html`<div class="dl ${neg ? "neg" : ""}"><i data-lucide="${neg ? "arrow-down" : "arrow-up"}"></i>${delta}</div>` : raw('<div class="dl">&nbsp;</div>')}</div></div>`;
}
