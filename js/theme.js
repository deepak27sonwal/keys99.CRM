// Light / dark / system theme. Loaded in <head> of every page so the right theme is set before the first paint (no white flash).
(function () {
  var KEY = "k99.theme", root = document.documentElement, mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function saved() { try { var v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch (e) { return "system"; } }
  function eff(m) { return m === "dark" || (m === "system" && mq && mq.matches) ? "dark" : "light"; }
  function apply(m) {
    var e = eff(m); root.setAttribute("data-theme", e); root.setAttribute("data-theme-mode", m);
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", e === "dark" ? "#0b1218" : "#085a4e");
    document.dispatchEvent(new CustomEvent("k99:theme", { detail: { mode: m, theme: e } }));
    paint();
  }
  var LABEL = { light: "Light", dark: "Dark", system: "System" }, ICON = { light: "sun", dark: "moon", system: "monitor" };
  // every [data-theme-toggle] button shows the current mode and cycles Light -> Dark -> System on click
  function paint() {
    var m = saved(), meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", eff(m) === "dark" ? "#0b1218" : "#085a4e");
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-label", "Theme: " + LABEL[m] + ". Click to change."); b.setAttribute("title", "Theme: " + LABEL[m]);
      if (b.dataset.icon !== ICON[m]) { b.innerHTML = '<i data-lucide="' + ICON[m] + '"></i>'; b.dataset.icon = ICON[m]; if (window.lucide) lucide.createIcons(); }
    });
    document.querySelectorAll("[data-theme-set]").forEach(function (b) { var on = b.getAttribute("data-theme-set") === m; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
  }
  function set(m) { try { if (m === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, m); } catch (e) { /* not saved, still applied */ } apply(m); }
  function cycle() { var m = saved(); set(m === "light" ? "dark" : m === "dark" ? "system" : "light"); }
  apply(saved());
  if (mq) (mq.addEventListener ? mq.addEventListener("change", function () { if (saved() === "system") apply("system"); }) : mq.addListener(function () { if (saved() === "system") apply("system"); }));
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-theme-toggle]"); if (t) { cycle(); return; }
    var s = e.target.closest && e.target.closest("[data-theme-set]"); if (s) set(s.getAttribute("data-theme-set"));
  });
  function charts() { if (window.Chart) { Chart.defaults.color = text(); Chart.defaults.borderColor = grid(); } }
  document.addEventListener("DOMContentLoaded", function () { paint(); charts(); });
  document.addEventListener("k99:theme", function () { charts(); if (window.Chart && Chart.instances) Object.keys(Chart.instances).forEach(function (k) { restyle(Chart.instances[k]); }); });
  // Chart.js colours that follow the theme: grid lines, tick labels and legend text
  function css(v, d) { var x = getComputedStyle(root).getPropertyValue(v).trim(); return x || d; }
  function grid() { return eff(saved()) === "dark" ? "rgba(255,255,255,.08)" : "#eef1f3"; }
  function text() { return eff(saved()) === "dark" ? "#9fb0bf" : "#64748b"; }
  function restyle(c) {
    try {
      if (window.Chart) { Chart.defaults.color = text(); Chart.defaults.borderColor = grid(); }
      var sc = (c.options && c.options.scales) || {};
      Object.keys(sc).forEach(function (k) { sc[k].grid = Object.assign({}, sc[k].grid, { color: grid() }); sc[k].ticks = Object.assign({}, sc[k].ticks, { color: text() }); });
      var lg = c.options && c.options.plugins && c.options.plugins.legend; if (lg && lg.labels) lg.labels.color = text();
      c.update("none");
    } catch (e) { /* a chart that cannot restyle keeps its colours */ }
  }
  window.Theme = { grid: grid, text: text, restyle: restyle, get: saved, set: set, cycle: cycle, effective: function () { return eff(saved()); }, paint: paint };
})();
