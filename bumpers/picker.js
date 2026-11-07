// RT3D designers (2026-11-07): the font and icon dropdowns and the numbered steps, shared by the customer pages. A plain <select> can't
// show a buyer's own name in each font, or pictures of the icons, so these are small custom menus that still work by keyboard.
"use strict";

const Picker = (() => {
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  let open = null;
  function close() {
    if (!open) return;
    open.panel.hidden = true; open.btn.setAttribute("aria-expanded", "false"); open.root.classList.remove("open");
    open = null;
  }
  document.addEventListener("pointerdown", e => { if (open && !open.root.contains(e.target)) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && open) { const b = open.btn; close(); b.focus(); } });

  // keeps an open menu in view, clear of the bar at the bottom and (on phones) the preview stuck at the top
  function reveal(root, panel) {
    const bar = document.querySelector(".bar"), pv = document.querySelector(".preview-card");
    const low = (bar ? bar.getBoundingClientRect().top : innerHeight) - 8, high = (pv && innerWidth < 900 ? pv.getBoundingClientRect().bottom : 70) + 8;
    const top = root.getBoundingClientRect().top, bottom = panel.getBoundingClientRect().bottom;
    const by = top < high ? top - high : Math.min(Math.max(bottom - low, 0), top - high);
    if (by) scrollBy({ top: by, behavior: "smooth" });
  }

  // the button and the panel under it; fill() builds the panel the first time it opens, so fonts only load when they're shown
  function shell(cls, label, fill) {
    const root = make("div", "pick " + cls), btn = make("button", "pick-btn"), panel = make("div", "pick-panel");
    btn.type = "button"; btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", label);
    panel.hidden = true; root.append(btn, panel);
    let built = false;
    btn.addEventListener("click", () => {
      if (open && open.root === root) { close(); return; }
      close();
      if (!built) { fill(panel); built = true; }
      panel.hidden = false; btn.setAttribute("aria-expanded", "true"); root.classList.add("open");
      open = { root, btn, panel };
      const search = panel.querySelector(".pick-search");   // ready to type on a computer; on a phone it would pop up the keyboard over the menu
      if (search && matchMedia("(pointer: fine)").matches) search.focus({ preventScroll: true });
      requestAnimationFrame(() => reveal(root, panel));
    });
    return { root, btn, panel };
  }

  // A font dropdown. groups: [ [group name, [ { key, label, web, weight } … ]] … ]; sample(): the text to show (the buyer's name).
  function fonts({ groups, value, sample, onPick, label = "Font" }) {
    let now = value;
    const all = groups.flatMap(g => g[1]);
    const face = (e, f) => { e.style.fontFamily = `"${f.web}", system-ui, sans-serif`; e.style.fontWeight = f.weight; };
    const parts = shell("pick-fonts", label, panel => {
      for (const [name, list] of groups) {
        if (groups.length > 1) panel.append(make("div", "pick-group", name));
        for (const f of list) {
          const row = make("button", "pick-row"), s = make("span", "pick-sample", sample());
          row.type = "button"; row.dataset.key = f.key; face(s, f);
          row.append(s, make("small", "", f.label));
          row.addEventListener("click", () => { now = f.key; show(); close(); parts.btn.focus({ preventScroll: true }); onPick(f.key); });
          row.addEventListener("keydown", e => {
            const rows = [...panel.querySelectorAll(".pick-row")], i = rows.indexOf(row), to = e.key === "ArrowDown" ? rows[i + 1] : e.key === "ArrowUp" ? rows[i - 1] : null;
            if (to) { e.preventDefault(); to.focus(); }
          });
          panel.append(row);
        }
      }
      show();
      const on = panel.querySelector(".pick-row.on"); if (on) on.scrollIntoView({ block: "center" });
    });
    const nowText = make("span", "pick-sample"), nowName = make("small"), head = make("span", "pick-head");
    head.append(make("em", "", label), nowName);
    parts.btn.append(head, nowText, make("i", "pick-arrow"));
    function show() {
      const f = all.find(x => x.key === now) || all[0];
      face(nowText, f); nowText.textContent = sample(); nowName.textContent = f.label;
      parts.panel.querySelectorAll(".pick-row").forEach(r => { r.classList.toggle("on", r.dataset.key === f.key); r.setAttribute("aria-current", r.dataset.key === f.key ? "true" : "false"); });
    }
    show();
    return { root: parts.root, set: k => { now = k; show(); }, refresh: () => { const t = sample(); nowText.textContent = t; parts.panel.querySelectorAll(".pick-row .pick-sample").forEach(s => s.textContent = t); } };
  }

  // An icon dropdown, with a search box. onPick(emote) adds it to the text.
  function icons({ onPick }) {
    const shown = new Map(), icon = e => { if (!shown.has(e)) shown.set(e, Emotes.icon(e, 48, "#f3f6fa")); return shown.get(e); };
    const parts = shell("pick-icons", "Add an icon", panel => {
      const search = make("input", "pick-search"); search.type = "search"; search.placeholder = `Search ${Emotes.list.length} icons, e.g. dog`; search.setAttribute("aria-label", "Search the icons");
      const body = make("div", "pick-body"), none = make("p", "hint", "No icon by that name. Try a simpler word.");
      none.hidden = true;
      const blocks = Emotes.groups.map(([name, list]) => {
        const grid = make("div", "pick-grid"), title = make("div", "pick-group", name), wrap = make("div");
        const items = list.map(e => {
          const b = make("button"), img = make("img"), n = make("span", "pick-name", e.name);
          b.type = "button"; b.title = e.name; b.setAttribute("aria-label", "Add " + e.name); img.src = icon(e); img.alt = "";
          b.append(img, n);
          b.addEventListener("click", () => { close(); onPick(e); });
          grid.append(b);
          return { b, words: e.name.toLowerCase() + " " + name.toLowerCase() };
        });
        wrap.append(title, grid); body.append(wrap);
        return { wrap, items };
      });
      body.append(none);
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase(); let any = false;
        for (const { wrap, items } of blocks) { let some = false; for (const it of items) { const hit = !q || it.words.includes(q); it.b.hidden = !hit; some = some || hit; } wrap.hidden = !some; any = any || some; }
        none.hidden = any;
      });
      panel.append(search, body);
    });
    const head = make("span", "pick-head"), row = make("span", "pick-now");
    head.append(make("em", "", "Icons"));
    row.textContent = "Add an icon";
    parts.btn.append(head, row, make("i", "pick-arrow"));
    return { root: parts.root };
  }

  // loads Google's stylesheet for the fonts on this page, and answers once it's in, so the preview's first draw uses the right font
  const loadFonts = list => new Promise(done => {
    const link = make("link"); link.rel = "stylesheet"; link.href = DesignCode.fontCss(list);
    link.onload = link.onerror = done; setTimeout(done, 4000); document.head.append(link);
  });
  // the fonts in code.js, as groups for fonts()
  const groupsOf = table => { const g = new Map(); for (const [key, f] of Object.entries(table)) { const k = f.group || ""; if (!g.has(k)) g.set(k, []); g.get(k).push({ key, ...f }); } return [...g]; };

  // The numbered steps: only one is open at a time, each "Next" button opens the one it names, and an opening step scrolls into view.
  function steps(root = document) {
    const all = [...root.querySelectorAll("details.dstep")];
    const settle = d => {
      const pv = document.querySelector(".preview-card"), top = (pv && innerWidth < 900 ? pv.getBoundingClientRect().bottom : 66) + 10;
      requestAnimationFrame(() => { const y = d.getBoundingClientRect().top - top; if (y < 0 || d.getBoundingClientRect().top > innerHeight * 0.55) scrollBy({ top: y, behavior: "smooth" }); });
    };
    for (const d of all) d.addEventListener("toggle", () => {
      if (!d.open) return;
      close();
      for (const o of all) if (o !== d) o.open = false;    // for browsers that don't know <details name>
      settle(d);
    });
    root.querySelectorAll("[data-next]").forEach(b => b.addEventListener("click", () => { const d = document.getElementById(b.dataset.next); if (d) d.open = true; }));
    return { open: id => { const d = document.getElementById(id); if (d) d.open = true; } };
  }

  return { fonts, icons, loadFonts, groupsOf, steps, close };
})();
