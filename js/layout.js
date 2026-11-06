// Shared shell: sidebar + top bar + auth guard. Returns the <main> element.
const NAV = [
  ["Dashboard", "index.html", "layout-dashboard", "dashboard"],
  ["Leads Management", "leads.html", "user-search", "leads"],
  ["Customers", "customer.html", "users", "customer"],
  ["Developers", "#", "building-2"], ["Projects", "#", "landmark"], ["Site Visits", "#", "map-pin"],
  ["Sales Pipeline", "#", "filter"], ["Bookings & Deals", "#", "file-signature"], ["Commissions", "#", "wallet"],
  ["Agents & Teams", "#", "users-round"], ["Marketing & Campaigns", "#", "megaphone"], ["Tasks & Follow-ups", "#", "list-checks"],
  ["Documents", "#", "file-text"], ["Reports & Analytics", "#", "bar-chart-3"], ["Settings", "#", "settings"],
];

async function mountShell(active) {
  let email = "Deepak Mahto";
  if (Data.configured) {
    const s = await Data.session();
    if (!s) { location.href = "login.html"; return null; }
    email = s.user.email;
  }
  const root = document.getElementById("root");
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
            <button class="user" id="userBtn" title="${Data.configured ? "Click to log out" : "Demo mode"}">
              ${avatar(email, 40)}<span class="who"><b>${email}</b><span>Admin</span></span>
            </button>
          </div>
        </header>
        <main id="main">${Data.configured ? raw("") : html`<div class="banner">Demo mode: showing sample data. Add your Supabase URL and key in <code>js/config.js</code> to use real data.</div>`}<div id="page"></div></main>
      </div>
    </div>`);
  const sb = document.getElementById("sidebar"), bd = document.getElementById("backdrop");
  const toggle = (open) => { sb.classList.toggle("open", open); bd.classList.toggle("open", open); };
  document.getElementById("menuBtn").onclick = () => toggle(!sb.classList.contains("open"));
  bd.onclick = () => toggle(false);
  sb.querySelectorAll("a").forEach((a) => (a.onclick = () => toggle(false)));
  document.getElementById("userBtn").onclick = () => { if (Data.configured && confirm("Log out?")) Data.signOut(); };
  return document.getElementById("page");
}

function kpiCard([label, value, delta, icon, primary, green]) {
  return html`<div class="kpi ${primary ? "primary" : ""} ${green ? "greenic" : ""}"><i data-lucide="${icon}"></i>
    <div><div class="lbl">${label}</div><div class="val">${value}</div><div class="dl"><i data-lucide="arrow-up"></i>${delta}</div></div></div>`;
}
