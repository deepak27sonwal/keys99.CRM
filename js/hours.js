// Active-hours helpers shared by My Profile and Agents & Teams: formatting, period choices, grouping and the bar chart.
window.Hours = (function () {
  const PRESETS = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["month", "This month"], ["lastmonth", "Last month"], ["custom", "Custom range"]];
  // Days are Indian-time calendar days (the database stores them that way), whatever timezone this browser is in.
  const IST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
  const key = (d) => IST.format(d instanceof Date ? d : new Date(d));                       // an instant -> its India date "YYYY-MM-DD"
  const utc = (k) => new Date(k + "T00:00:00Z");                                            // a date key as UTC midnight, so day maths never depends on the browser timezone
  const shift = (k, n) => { const d = utc(k); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const today = (off = 0) => shift(key(new Date()), off);
  const weekStart = (k) => shift(k, -((utc(k).getUTCDay() + 6) % 7));                       // Monday
  const fmt = (m) => { m = Math.round(m || 0); if (m <= 0) return "0m"; const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
  const dec = (m) => (Math.round(((m || 0) / 60) * 10) / 10).toFixed(1);
  // from/to as "YYYY-MM-DD" (inclusive) for a preset, or the custom dates
  function span(preset, cFrom, cTo, now = new Date()) {
    const t = shift(key(now), 0);
    if (preset === "custom") { const a = cFrom || t, b = cTo || a; return a <= b ? [a, b] : [b, a]; }
    const y = Number(t.slice(0, 4)), m0 = Number(t.slice(5, 7)) - 1, first = (yy, mm) => new Date(Date.UTC(yy, mm, 1)).toISOString().slice(0, 10), last = (yy, mm) => new Date(Date.UTC(yy, mm + 1, 0)).toISOString().slice(0, 10);
    switch (preset) {
      case "yesterday": return [shift(t, -1), shift(t, -1)];
      case "7d": return [shift(t, -6), t];
      case "30d": return [shift(t, -29), t];
      case "month": return [first(y, m0), t];
      case "lastmonth": return [first(y, m0 - 1), last(y, m0 - 1)];
      default: return [t, t];
    }
  }
  const days = (from, to) => { const out = []; for (let k = from; k <= to && out.length < 900; k = shift(k, 1)) out.push(k); return out; };
  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // rows -> buckets [{label, minutes}] by day / week / month, covering every day of the period (zero days included)
  function group(rows, from, to, by) {
    const per = new Map(); rows.forEach((r) => per.set(r.day, (per.get(r.day) || 0) + r.minutes));
    const out = new Map();
    days(from, to).forEach((k) => { const d = utc(k); let bk, label;
      if (by === "week") { bk = weekStart(k); const m = utc(bk); label = `${m.getUTCDate()} ${MO[m.getUTCMonth()]}`; } else if (by === "month") { bk = k.slice(0, 7); label = `${MO[d.getUTCMonth()]} ${d.getUTCFullYear()}`; } else { bk = k; label = `${d.getUTCDate()} ${MO[d.getUTCMonth()]}`; }
      const b = out.get(bk) || { label, minutes: 0, from: k }; b.minutes += per.get(k) || 0; out.set(bk, b); });
    return [...out.values()];
  }
  function summary(rows, from, to) {
    const per = new Map(); rows.forEach((r) => per.set(r.day, (per.get(r.day) || 0) + r.minutes));
    const act = [...per.entries()].filter(([, m]) => m > 0), total = act.reduce((t, [, m]) => t + m, 0);
    const longest = act.reduce((a, b) => (b[1] > a[1] ? b : a), ["", 0]);
    const ks = act.map(([k]) => k).sort(); const lastAt = rows.reduce((a, r) => (r.lastAt && r.lastAt > a ? r.lastAt : a), "");
    return { total, daysActive: act.length, avg: act.length ? total / act.length : 0, longest: longest[1], longestDay: longest[0], first: ks[0] || "", last: ks[ks.length - 1] || "", lastAt };
  }
  const sumDay = (rows, day) => rows.filter((r) => r.day === day).reduce((t, r) => t + r.minutes, 0);
  // Chart.js bar chart in the theme colours (re-styled by theme.js when the theme changes)
  function chart(canvas, buckets, label = "Active hours") {
    if (!canvas || !window.Chart) return null;
    return new Chart(canvas, { type: "bar", data: { labels: buckets.map((b) => b.label), datasets: [{ label, data: buckets.map((b) => Math.round((b.minutes / 60) * 100) / 100), backgroundColor: "#0f7a6b", borderRadius: 4, maxBarThickness: 34 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + fmt(Math.round(c.parsed.y * 60)) } } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 14, color: Theme.text() } }, y: { beginAtZero: true, grid: { color: Theme.grid() }, ticks: { font: { size: 11 }, color: Theme.text(), callback: (v) => v + "h" } } } } });
  }
  // the period controls (preset select + custom dates + group by) as markup; wire() attaches the handlers and calls back with the new state
  const controls = (st, extra = "") => html`<div class="hr-filters"><label>Period<select class="select" data-hr="preset" aria-label="Period">${raw(PRESETS.map(([v, l]) => `<option value="${v}" ${st.preset === v ? "selected" : ""}>${esc(l)}</option>`).join(""))}</select></label>
      ${st.preset === "custom" ? html`<label>From<input class="select" type="date" data-hr="from" value="${st.from}" max="${st.to || ""}"></label><label>To<input class="select" type="date" data-hr="to" value="${st.to}" min="${st.from || ""}"></label>` : raw("")}
      <label>Group by<select class="select" data-hr="by" aria-label="Group by">${raw([["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([v, l]) => `<option value="${v}" ${st.by === v ? "selected" : ""}>${l}</option>`).join(""))}</select></label>${extra}</div>`;
  function wire(root, st, changed) {
    root.querySelectorAll("[data-hr]").forEach((el) => (el.onchange = () => { st[el.dataset.hr] = el.value; if (el.dataset.hr === "preset" && el.value === "custom" && !st.from) { st.from = st.to = today(); } changed(el.dataset.hr); }));
  }
  return { PRESETS, key, shift, today, weekStart, fmt, dec, span, days, group, summary, sumDay, chart, controls, wire };
})();
