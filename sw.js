// Keys99 CRM service worker: shows lead notifications pushed by the server (works when the CRM is closed) and opens the lead when one is clicked.
const ICON = "icons/icon-192.png", BADGE = "icons/badge-72.png";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // The CRM is open and in front: that tab already shows the lead live (bell, toast and chime), so do not show it twice. A test is always shown.
    if (d.tag !== "k99-test" && wins.some((w) => w.visibilityState === "visible" && w.focused)) { wins.forEach((w) => w.postMessage({ type: "lead", id: d.id })); return; }
    await self.registration.showNotification(d.title || "Keys99 CRM", {
      body: d.body || "", icon: ICON, badge: BADGE, tag: d.tag || "k99", renotify: true, silent: false, vibrate: [200, 100, 200],
      data: { url: d.url || "leads.html" },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // only ever open an address inside the CRM, whatever the notification says
  let url = new URL((e.notification.data && e.notification.data.url) || "leads.html", self.registration.scope).href;
  if (!url.startsWith(self.registration.scope)) url = new URL("leads.html", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const mine = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (mine) { try { await mine.navigate(url); } catch { /* cross-origin or closed: fall through */ } return mine.focus(); }
    return self.clients.openWindow(url);
  })());
});
