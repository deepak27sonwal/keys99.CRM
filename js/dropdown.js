/*
 * Reusable custom dropdown.
 *
 * 1) Progressive upgrade (automatic): every <select> rendered through render()/openModal()
 *    is replaced by a styled dropdown. The native <select> stays in the DOM (visually hidden),
 *    so .value, FormData, `onchange` and `required` keep working unchanged.
 *      <select name="status"><option>New</option>...</select>        -> just works
 *      <select data-native>...</select>                              -> opt out
 *      <select data-search>...</select>                              -> always show search box
 *      <select data-placeholder="Pick one">...</select>             -> text for an empty option
 *
 * 2) From code:
 *      const dd = Dropdown.create({ options: ["A", {value:"b", label:"B"}], value: "b",
 *                                   placeholder: "Choose…", searchable: true, name: "x",
 *                                   onChange: (value, label) => {} });
 *      container.appendChild(dd.el);   dd.value / dd.setValue("a") / dd.setOptions([...])
 *
 * Features: keyboard (↑ ↓ Home End Enter Esc Tab, type-to-jump), search for long lists,
 * ARIA combobox/listbox, flips above when there is no room (always anchored to the field, also on phones),
 * works inside scrolling modals (popup is positioned with fixed coordinates).
 */
const Dropdown = (() => {
  const SEARCH_AT = 8; // show the search box when there are more options than this
  let open = null;     // currently open instance
  let uid = 0;

  const isTouch = () => window.matchMedia("(pointer: coarse)").matches;   // phones/tablets: do not auto-open the keyboard
  const ICON_CHEVRON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function closeOpen(refocus) { if (open) open.close(refocus); }
  document.addEventListener("mousedown", (e) => { if (open && !open.pop.contains(e.target) && !open.wrap.contains(e.target)) closeOpen(); });
  // The on-screen keyboard also fires "resize": keep the list open (and re-anchored) while typing in its search box.
  window.addEventListener("resize", () => { if (!open) return; if (open.pop.contains(document.activeElement)) open.position(); else closeOpen(); });
  window.addEventListener("scroll", (e) => { if (open && !open.pop.contains(e.target)) closeOpen(); }, true);

  function build(sel) {
    if (sel.dataset.ddReady) return sel._dd;
    sel.dataset.ddReady = "1";
    const id = "dd" + ++uid;
    const wrap = document.createElement("div");
    wrap.className = "dd" + (sel.style.width === "100%" ? " dd-block" : "");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "dd-btn";
    btn.setAttribute("role", "combobox"); btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", id + "-list");
    const aria = sel.getAttribute("aria-label"); if (aria) btn.setAttribute("aria-label", aria);
    btn.disabled = sel.disabled;
    // Button first so a wrapping <label> activates it; native select second (hidden, kept in sync).
    sel.parentNode.insertBefore(wrap, sel); wrap.append(btn, sel);
    sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");

    const inst = { sel, wrap, btn, pop: null, items: [], active: -1, buffer: "", bufferTimer: null, id };
    sel._dd = inst;

    const optionsOf = () => [...sel.options].map((o, i) => ({ i, value: o.value, label: o.textContent.trim(), disabled: o.disabled, group: o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : "" }));
    const labelFor = (o) => o.label || sel.dataset.placeholder || "Select…";
    const refresh = () => {
      const o = sel.options[sel.selectedIndex];
      const empty = !o || (o.value === "" && !o.textContent.trim());
      btn.innerHTML = `<span class="dd-label${o && o.value === "" ? " dd-ph" : ""}">${escapeHtml(empty ? sel.dataset.placeholder || "Select…" : o.textContent.trim())}</span>${ICON_CHEVRON}`;
      btn.disabled = sel.disabled;
    };
    inst.refresh = refresh; refresh();
    sel.addEventListener("change", refresh);

    function position() {
      const r = btn.getBoundingClientRect(), pop = inst.pop;
      // Always anchored under the field (above it when there is no room below), on phones too.
      pop.style.minWidth = Math.min(Math.max(r.width, 180), innerWidth - 16) + "px"; pop.style.maxWidth = innerWidth - 16 + "px";
      pop.style.left = "0px"; pop.style.top = "0px"; pop.style.maxHeight = "";
      const ph = pop.offsetHeight, pw = pop.offsetWidth, below = innerHeight - r.bottom - 12, above = r.top - 12;
      const flip = ph > below && above > below;
      const maxH = Math.max(96, Math.min(320, flip ? above : below));
      pop.style.maxHeight = maxH + "px";
      const h = Math.min(ph, maxH);
      pop.style.top = Math.max(8, Math.min(flip ? r.top - h - 4 : r.bottom + 4, innerHeight - h - 8)) + "px";
      pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pw - 8)) + "px";
    }

    function renderList(filter = "") {
      const q = filter.trim().toLowerCase(), list = inst.pop.querySelector(".dd-list");
      let html = "", lastGroup = null; inst.items = [];
      optionsOf().forEach((o) => {
        if (q && !o.label.toLowerCase().includes(q)) return;
        if (o.group !== lastGroup && o.group) html += `<li class="dd-group" role="presentation">${escapeHtml(o.group)}</li>`;
        lastGroup = o.group;
        const selected = o.i === sel.selectedIndex;
        html += `<li role="option" id="${id}-o${o.i}" data-i="${o.i}" class="dd-opt${selected ? " sel" : ""}${o.disabled ? " dis" : ""}" aria-selected="${selected}"${o.disabled ? ' aria-disabled="true"' : ""}><span>${escapeHtml(labelFor(o))}</span>${selected ? ICON_CHECK : ""}</li>`;
        inst.items.push(o);
      });
      list.innerHTML = html || '<li class="dd-none" role="presentation">No matches</li>';
      const first = inst.items.findIndex((o) => o.i === sel.selectedIndex && !o.disabled);
      setActive(first >= 0 ? first : inst.items.findIndex((o) => !o.disabled), false);
    }
    function setActive(n, scroll = true) {
      inst.active = n;
      const els = inst.pop.querySelectorAll(".dd-opt");
      els.forEach((el) => el.classList.remove("dd-act"));
      const o = inst.items[n], el = o && inst.pop.querySelector(`#${id}-o${o.i}`);
      if (el) { el.classList.add("dd-act"); if (scroll) el.scrollIntoView({ block: "nearest" }); (inst.pop.querySelector(".dd-search input") || btn).setAttribute("aria-activedescendant", el.id); }
    }
    function move(d) {
      if (!inst.items.length) return;
      let n = inst.active;
      for (let k = 0; k < inst.items.length; k++) { n = (n + d + inst.items.length) % inst.items.length; if (!inst.items[n].disabled) break; }
      setActive(n);
    }
    function choose(n) {
      const o = inst.items[n]; if (!o || o.disabled) return;
      const changed = sel.selectedIndex !== o.i;
      sel.selectedIndex = o.i; close(true); refresh();
      if (changed) { sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); }
      if (inst.onChange) inst.onChange(sel.value, o.label);
    }
    function onKey(e) {
      const k = e.key;
      if (k === "ArrowDown") { e.preventDefault(); move(1); }
      else if (k === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (k === "Home") { e.preventDefault(); setActive(inst.items.findIndex((o) => !o.disabled)); }
      else if (k === "End") { e.preventDefault(); let n = inst.items.length - 1; while (n > 0 && inst.items[n].disabled) n--; setActive(n); }
      else if (k === "Enter") { e.preventDefault(); choose(inst.active); }
      else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (k === "Tab") close(true);                  // focus returns to the field first, then the browser moves on from there
      else if (k.length === 1 && !inst.pop.querySelector(".dd-search")) { // type-to-jump on short lists
        clearTimeout(inst.bufferTimer); inst.buffer += k.toLowerCase(); inst.bufferTimer = setTimeout(() => (inst.buffer = ""), 600);
        const n = inst.items.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(inst.buffer)); if (n >= 0) setActive(n);
      }
    }
    function show() {
      if (btn.disabled) return;
      closeOpen();
      const pop = document.createElement("div");
      pop.className = "dd-pop"; pop.setAttribute("role", "presentation");
      const searchable = sel.hasAttribute("data-search") || sel.options.length > SEARCH_AT;
      pop.innerHTML = (searchable ? '<div class="dd-search"><input type="text" placeholder="Search…" aria-label="Search options" autocomplete="off"></div>' : "") +
        `<ul class="dd-list" role="listbox" id="${id}-list" tabindex="-1"></ul>`;
      document.body.appendChild(pop);
      inst.pop = pop; open = inst;
      btn.setAttribute("aria-expanded", "true"); wrap.classList.add("open");
      renderList(); position();
      pop.addEventListener("keydown", onKey);
      pop.addEventListener("mousemove", (e) => { const li = e.target.closest(".dd-opt"); if (li) { const n = inst.items.findIndex((o) => o.i === Number(li.dataset.i)); if (n !== inst.active) setActive(n, false); } });
      pop.addEventListener("click", (e) => { const li = e.target.closest(".dd-opt"); if (li) choose(inst.items.findIndex((o) => o.i === Number(li.dataset.i))); });
      const s = pop.querySelector(".dd-search input");
      if (s) { s.addEventListener("input", () => renderList(s.value)); if (!isTouch()) s.focus(); else pop.querySelector(".dd-list").focus({ preventScroll: true }); } else pop.querySelector(".dd-list").focus({ preventScroll: true });
      const act = pop.querySelector(".dd-opt.dd-act"); if (act) act.scrollIntoView({ block: "nearest" });
    }
    function close(refocus) {
      if (!inst.pop) return;
      inst.pop.remove();
      inst.pop = null; if (open === inst) open = null;
      btn.setAttribute("aria-expanded", "false"); btn.removeAttribute("aria-activedescendant"); wrap.classList.remove("open");
      if (refocus) btn.focus({ preventScroll: true });
    }
    inst.close = close; inst.position = position;
    btn.addEventListener("click", () => (inst.pop ? close(true) : show()));
    btn.addEventListener("keydown", (e) => { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); inst.pop ? close(true) : show(); } });
    return inst;
  }

  function upgrade(root = document) {
    (root.matches && root.matches("select") ? [root] : root.querySelectorAll("select:not([data-native]):not([data-dd-ready])")).forEach((s) => build(s));
  }

  // Create a dropdown from data (no markup needed).
  function create({ options = [], value = "", placeholder = "", searchable = false, name = "", onChange = null, disabled = false, ariaLabel = "" } = {}) {
    const sel = document.createElement("select");
    if (name) sel.name = name; if (ariaLabel) sel.setAttribute("aria-label", ariaLabel);
    if (placeholder) sel.dataset.placeholder = placeholder;
    if (searchable) sel.setAttribute("data-search", "");
    sel.disabled = disabled;
    const fill = (opts) => { sel.innerHTML = ""; opts.forEach((o) => { const op = document.createElement("option"); const v = typeof o === "object" ? o.value : o, l = typeof o === "object" ? o.label ?? o.value : o; op.value = v; op.textContent = l; sel.appendChild(op); }); };
    fill(options); sel.value = value;
    const holder = document.createElement("div"); holder.appendChild(sel);
    const inst = build(sel); inst.onChange = onChange;
    const el = holder.firstChild;
    return { el, select: sel, get value() { return sel.value; },
      setValue(v) { sel.value = v; inst.refresh(); },
      setOptions(opts, v = sel.value) { fill(opts); sel.value = v; inst.refresh(); },
      setDisabled(d) { sel.disabled = d; inst.refresh(); } };
  }

  return { upgrade, create, closeAll: () => closeOpen() };
})();

window.Dropdown = Dropdown;
