// Tracks active time: a minute counts only while this tab is visible AND the person did something (mouse, keys, scroll, touch) in the last 2 minutes.
// Once a minute it tells the database to add one minute to today (the database ignores calls closer than 50 s apart, so extra tabs cannot inflate it).
// Nothing but a count is stored. Failures are ignored and never get in the way of the page.
window.Activity = (function () {
  const IDLE_MS = 120000, TICK_MS = 60000;
  let lastInput = Date.now(), timer = null, sent = 0;
  const bump = () => { lastInput = Date.now(); };
  ["pointerdown", "mousemove", "keydown", "wheel", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, bump, { passive: true, capture: true }));
  const isActive = () => !document.hidden && Date.now() - lastInput < IDLE_MS;
  async function tick() { if (!isActive()) return false; try { await Data.recordActive(); sent++; return true; } catch { return false; } }
  function init() { if (timer) return; timer = setInterval(tick, TICK_MS); }
  return { init, tick, isActive, _test: { bump, sent: () => sent } };
})();
