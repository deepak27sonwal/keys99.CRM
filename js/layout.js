// Shared shell: sidebar + top bar + auth guard. Returns the <main> element.
const NAV = [
  ["Dashboard", "index.html", "layout-dashboard", "dashboard"],
  ["Leads Management", "leads.html", "user-search", "leads"],
  ["Customers", "customer.html", "users", "customer"],
  ["Developers", "#", "building-2"], ["Projects", "#", "landmark"], ["Site Visits", "site-visits.html", "map-pin", "visits"],
  ["Sales Pipeline", "#", "filter"], ["Bookings & Deals", "#", "file-signature"], ["Commissions", "#", "wallet"],
  ["Agents & Teams", "#", "users-round"], ["Marketing & Campaigns", "#", "megaphone"], ["Tasks & Follow-ups", "#", "list-checks"],
  ["Documents", "#", "file-text"], ["Reports & Analytics", "#", "bar-chart-3"], ["Integrations", "integrations.html", "plug-zap", "integrations"], ["Settings", "#", "settings"],
];

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
          ${NAV.map(([label, href, icon, key]) => html`<a href="${href}" class="${key === active ? "active" : ""}"><i data-lucide="${icon}"></i>${label}</a>`)}
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
