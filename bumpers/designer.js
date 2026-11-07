// Bottle Bumperz customer designer (2026-11-03). Buyers pick their bottle, colour, name, font and emotes, see it on a
// 3D bumper, and get a design code (code.js) to paste into their eBay order; Bumper Studio imports the code and makes
// the 3MF. The boots are drawn from their shape numbers only (data.json, made by build-designer.mjs): the real boot
// files never leave the PC. Single colour (engraved or raised) for now.
"use strict";

const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v; else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
};
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const F = DesignCode.FONTS;
const MAX_LINES = 2, MAX_BUMPERS = 6, MAX_CHARS = 30;

let data = null, view = null;
const profiles = new Map();          // boot id -> { prof, pos }
const state = { bumpers: [], cur: 0 };
const cur = () => state.bumpers[state.cur];
const baseOf = id => data.bases.find(b => b.id === id);
const colourOf = name => data.colours.find(c => c[0] === name) || data.colours[0];

function newLine(brand, text = "") { return { x: text, f: DesignCode.BRAND_FONT[brand] || "block", z: 16, a: 0, u: 0, r: 1, g: 0.4 }; }
function newBumper(from) {
  if (from) return JSON.parse(JSON.stringify(from));
  const b = data.bases.find(x => x.id === "owala-32oz") || data.bases[0];
  const c = (data.colours.find(x => x[0] === "Blue") || data.colours[0])[0];
  return { p: b.id, c, s: "e", t: [newLine(b.brand, "")] };
}
function boot(id) {
  if (!profiles.has(id)) { const prof = Engine.makeProfile(baseOf(id).prof); profiles.set(id, { prof, pos: Engine.lathe(prof) }); }
  return profiles.get(id);
}
// the engine's design for one bumper (web fonts stand in for the brand fonts here)
function designFor(b, prof) {
  const mid = (prof.bandLo + prof.bandHi) / 2;
  return { style: b.s === "r" ? "emboss" : "engrave", depth: 0.8, angled: true, sink: 0, under: {},
    items: b.t.filter(l => l.x.trim()).map(l => ({ type: "text", text: l.x, font: `${F[l.f].weight}|${F[l.f].web}`, size: l.z, angle: l.a, z: mid + l.u, repeat: l.r, gap: l.g })) };
}

// ---- drawing the controls ----
function render() {
  const b = cur(), base = baseOf(b.p);
  // the bumpers in this order, always shown above the preview with an "+ Add bumper" button (2026-11-03: the user
  // wanted adding more bumpers to be obvious; they all go in the one code)
  const label = (x, i) => x.t.map(l => l.x).filter(Boolean).join(" ") || `Bumper ${i + 1}`;
  const remove = i => { state.bumpers.splice(i, 1); state.cur = Math.min(state.cur, state.bumpers.length - 1); changed(); };
  $("#tabs").replaceChildren(...state.bumpers.map((x, i) => el("button", { type: "button", class: "tab" + (i === state.cur ? " on" : ""), onclick: () => { state.cur = i; changed(); } },
    el("i", { style: `background:${colourOf(x.c)[1]}` }), label(x, i),
    state.bumpers.length > 1 ? el("span", { class: "x", role: "button", tabindex: "0", "aria-label": "Remove this bumper", onclick: e => { e.stopPropagation(); remove(i); } }, "×") : null)),
    state.bumpers.length < MAX_BUMPERS ? el("button", { type: "button", class: "tab add", onclick: addBumper }, "+ Add bumper") : null);
  // "Your order" card
  $("#orderCount").textContent = `${state.bumpers.length} bumper${state.bumpers.length > 1 ? "s" : ""}`;
  $("#orderList").replaceChildren(...state.bumpers.map((x, i) => { const bx = baseOf(x.p);
    return el("button", { type: "button", class: "order-row" + (i === state.cur ? " on" : ""), onclick: () => { state.cur = i; changed(); scrollTo({ top: 0, behavior: "smooth" }); } },
      el("i", { style: `background:${colourOf(x.c)[1]}` }),
      el("span", {}, el("b", {}, `${i + 1}. ${label(x, i)}`), el("small", {}, `${bx.brand} ${bx.size} · ${x.c} · ${x.s === "r" ? "raised" : "engraved"}`)),
      el("span", { class: "edit" }, i === state.cur ? "Editing" : "Edit")); }));
  $("#addBumper2").hidden = state.bumpers.length >= MAX_BUMPERS;
  // bottle
  const brands = [...new Set(data.bases.map(x => x.brand))];
  $("#brands").replaceChildren(...brands.map(br => el("button", { type: "button", class: "chip" + (base.brand === br ? " on" : ""), onclick: () => {
    if (base.brand === br) return;
    const first = data.bases.find(x => x.brand === br);
    // names still in the old bottle's usual font take the new one's
    b.t.forEach(l => { if (l.f === DesignCode.BRAND_FONT[base.brand]) l.f = DesignCode.BRAND_FONT[br] || l.f; });
    b.p = first.id; changed();
  } }, br)));
  $("#sizes").replaceChildren(...data.bases.filter(x => x.brand === base.brand).map(x => el("button", { type: "button", class: "chip" + (x.id === b.p ? " on" : ""), onclick: () => { b.p = x.id; changed(); } }, x.size)));
  // colour
  $("#colourName").textContent = b.c;
  $("#colours").replaceChildren(...data.colours.map(([n, hex, t]) => el("button", { type: "button", class: (t ? "trans " : "") + (n === b.c ? "on" : ""), title: n, "aria-label": n, style: `background-color:${hex}`, onclick: () => { b.c = n; changed(); } })));
  // text lines
  $("#lines").replaceChildren(...b.t.map((l, i) => lineCard(b, l, i)));
  $("#addLine").hidden = b.t.length >= MAX_LINES;
  // style
  document.querySelectorAll("#style button").forEach(x => x.classList.toggle("on", x.dataset.v === b.s));
  $("#addBumper").hidden = state.bumpers.length >= MAX_BUMPERS;
}

const around = a => Math.abs(a) < 8 ? "Front" : Math.abs(a) > 172 ? "Back" : (a > 0 ? "Right " : "Left ") + Math.abs(Math.round(a)) + "°";

function rangeRow(min, max, step, value, fmt, onInput) {
  const out = el("output", {}, fmt(value));
  return el("div", { class: "range" }, el("input", { type: "range", min, max, step, value, oninput: e => { out.textContent = fmt(+e.target.value); onInput(+e.target.value); } }), out);
}

function lineCard(b, l, i) {
  const input = el("input", { type: "text", value: l.x, maxlength: MAX_CHARS, placeholder: i ? "e.g. a second name or ♥" : "Type a name", autocomplete: "off", autocapitalize: "characters",
    oninput: e => { l.x = e.target.value; changed(true); fonts.refresh(); } });
  // an icon goes where the cursor was, or at the end if they haven't been in the box
  let caret = null;
  for (const ev of ["keyup", "click", "input"]) input.addEventListener(ev, () => { caret = input.selectionStart; });
  const insert = ch => {
    const p = caret ?? input.value.length;
    if ((input.value + ch).length > MAX_CHARS + 4) return;
    l.x = input.value.slice(0, p) + ch + input.value.slice(p); input.value = l.x; caret = p + ch.length;
    changed(true); fonts.refresh();
    if (!matchMedia("(pointer: coarse)").matches) { input.focus(); input.setSelectionRange(p + ch.length, p + ch.length); }
  };
  // the dropdown shows the buyer's own text in each font
  const fonts = Picker.fonts({ groups: Picker.groupsOf(F), value: l.f, sample: () => (l.x.trim() || "Name").slice(0, 14), onPick: k => { l.f = k; changed(); } });
  const icons = Picker.icons({ onPick: e => insert(e.ch) });
  const card = el("div", { class: "line" },
    el("div", { class: "line-head" }, i ? "Second line" : "Main line", i ? el("button", { type: "button", class: "x", onclick: () => { b.t.splice(i, 1); changed(); } }, "Remove") : null),
    input,
    el("div", { class: "pick-pair" }, fonts.root, icons.root),
    el("div", { class: "label" }, "Letter size"),
    rangeRow(10, 22, 0.5, l.z, v => v + " mm", v => { l.z = v; changed(true); }),
    el("div", { class: "label" }, "How many times round"),
    el("div", { class: "seg" }, ...[[1, "Once"], [2, "Twice"], [3, "3×"], [4, "4×"]].map(([n, t]) => el("button", { type: "button", class: l.r === n ? "on" : "", onclick: () => { l.r = n; changed(); } }, t))),
    el("div", { class: "label" }, "Position round the bumper"),
    rangeRow(-180, 180, 1, l.a, around, v => { l.a = v; changed(true); }),
    el("div", { class: "label" }, "Up or down"),
    rangeRow(-6, 6, 0.25, l.u, v => (v > 0 ? "+" : "") + v.toFixed(1) + " mm", v => { l.u = v; changed(true); }));
  return card;
}

// ---- preview ----
let timer = 0;
function changed(quiet) {
  save();
  if (!quiet) render();
  clearTimeout(timer); timer = setTimeout(draw, quiet ? 120 : 0);
}
async function draw() {
  const b = cur(), { prof, pos } = boot(b.p);
  await Promise.all(b.t.map(l => document.fonts.load(`${F[l.f].weight} 40px "${F[l.f].web}"`).catch(() => {})));
  const design = designFor(b, prof);
  view.setBase(pos, prof);
  const wall = Engine.wallMask(design, prof, Engine.PREVIEW_CELL);
  let part = null;
  if (design.items.length) part = Engine.buildParts({ ...design, under: {} }, prof, 0.2).wall;
  const c = hexRgb(colourOf(b.c)[1]);
  view.setScene({ color: c, color2: c, mode: b.s === "e" ? 1 : 0, wall, floor: null, part, partKind: b.s === "e" ? 1 : 2, partColor: c, sink: 0 });
  checkFit(b, prof, design);
}
function checkFit(b, prof, design) {
  const probs = [], g = document.createElement("canvas").getContext("2d");
  design.items.forEach(it => {
    const w = Engine.drawText(g, it.text, it.font, it.size, it.gap, 0, 0, true);
    if (w * it.repeat > 2 * Math.PI * prof.R * 0.92) probs.push(`"${it.text}" is too long to fit ${it.repeat > 1 ? it.repeat + " times " : ""}round this bumper: try smaller letters.`);
    const cap = it.size * 0.72;
    if (it.z + cap / 2 > prof.bandHi + 0.3 || it.z - cap / 2 < prof.bandLo - 0.3) probs.push(`"${it.text}" runs off the flat part of the wall: try smaller letters or move it up/down.`);
  });
  $("#warn").hidden = !probs.length; $("#warn").textContent = probs[0] || "";
  return probs;
}

// a new bumper for the same order: same bottle, colour and style as the one on screen, text left for them to type
function addBumper() {
  if (state.bumpers.length >= MAX_BUMPERS) return;
  const b = newBumper(cur()); b.t.forEach(l => l.x = ""); b.t = b.t.slice(0, 1);
  state.bumpers.push(b); state.cur = state.bumpers.length - 1; changed();
  scrollTo({ top: 0, behavior: "smooth" });
  toast(`Bumper ${state.bumpers.length} added: design it now`);
  setTimeout(() => { const inp = document.querySelector(".line input"); if (inp) inp.focus({ preventScroll: true }); }, 400);
}

// ---- codes ----
const designNow = () => ({ n: state.orderName || "", b: state.bumpers.map(b => ({ p: b.p, c: b.c, s: b.s, t: b.t })) });
const summary = () => state.bumpers.map((b, i) => { const x = baseOf(b.p);
  return `${state.bumpers.length > 1 ? i + 1 + ". " : ""}${x.brand} ${x.size}, ${b.c}, ${b.s === "r" ? "raised" : "engraved"}: ${b.t.map(l => l.x).filter(Boolean).join(" / ") || "plain"}`; }).join(" · ");
// "Get my design code" first asks who the order is for (it goes in the code, and names the job when it's imported)
function askName() {
  const empty = state.bumpers.findIndex(b => !b.t.some(l => l.x.trim()));
  if (empty >= 0 && !confirm(`Bumper ${empty + 1} has no text. Carry on anyway (it'll be a plain bumper)?`)) return;
  $("#orderName").value = state.orderName || ""; $("#nameErr").textContent = "";
  $("#nameSummary").textContent = `Your order: ${state.bumpers.length} bumper${state.bumpers.length > 1 ? "s" : ""}. ${summary()}`;
  $("#nameDlg").showModal(); $("#orderName").focus();
}
function nameDone() {
  const v = $("#orderName").value.trim();
  if (!v) { $("#nameErr").textContent = "Please add your name or eBay username."; $("#orderName").focus(); return; }
  state.orderName = v; save(); $("#nameDlg").close(); showCode();
}
async function showCode() {
  const code = await DesignCode.encode(designNow());
  $("#codeText").textContent = code;
  $("#codeSummary").textContent = `Order for ${state.orderName}: ${summary()}`;
  ebayButtons();
  history.replaceState(null, "", "#" + code);
  $("#codeDlg").showModal();
}
// "Order on eBay": each bottle brand has its own listing (set in the site's ebay.js). One button per brand in the order;
// a brand with no link gets no button. Clicking copies the code and opens the listing in a new tab (a plain link, so
// popup blockers leave it alone).
function ebayButtons() {
  const links = (window.RT3D_EBAY && window.RT3D_EBAY.bumpers) || {};
  const brands = [...new Set(state.bumpers.map(b => baseOf(b.p).brand))].filter(br => links[br]);
  $("#buyEbay").replaceChildren(...brands.map(br => el("a", { class: "btn primary", href: links[br], target: "_blank", rel: "noopener",
    onclick: ebayCopy },
    brands.length > 1 ? `Order ${br} on eBay` : "Order on eBay")));
  $("#copyCode").classList.toggle("primary", !brands.length);
  $("#ebayMulti").hidden = brands.length < 2;
  $("#ebayNote").hidden = true;
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); return true; }
  catch { const r = document.createRange(); r.selectNodeContents($("#codeText")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selected: press copy on your keyboard"); return false; }
}
// after "Order on eBay": say whether the code made it to the clipboard (if not, it's left highlighted to copy by hand)
async function ebayCopy() {
  const ok = await copy($("#codeText").textContent, "Code copied, paste it in the Note to Seller at checkout");
  const n = $("#ebayNote");
  n.replaceChildren(ok ? "Code copied, paste it in the " : "Copy the highlighted code, then paste it in the ", el("b", {}, "Note to Seller"), " at checkout");
  n.hidden = false;
}
async function openCode(text) {
  const d = await DesignCode.decode(text);
  const list = d.b.filter(b => baseOf(b.p));
  if (!list.length) throw new Error("its bottle isn't one we make any more");
  list.forEach(b => { if (!data.colours.some(c => c[0] === b.c)) b.c = data.colours[0][0]; if (!b.t.length) b.t = [newLine(baseOf(b.p).brand)]; });
  state.bumpers = list.slice(0, MAX_BUMPERS); state.cur = 0;
  if (d.n) state.orderName = d.n;
  changed();
}

let toastTimer = 0;
function toast(t) { const x = $("#toast"); x.textContent = t; x.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => x.hidden = true, 2600); }
function save() { try { localStorage.setItem("bbz-designer", JSON.stringify(state)); } catch { } }

async function init() {
  data = await (await fetch("data.json", { cache: "no-cache" })).json();
  await Picker.loadFonts(Object.values(F));
  view = View3D.create($("#view"));
  if (!view) { $("#warn").hidden = false; $("#warn").textContent = "Your browser can't show 3D, but you can still make your code."; }
  // a code in the link (#BBZ1-…) wins; otherwise carry on from last time
  let loaded = false;
  if (location.hash.includes("BBZ")) { try { await openCode(decodeURIComponent(location.hash)); loaded = true; } catch { } }
  if (!loaded) {
    try { const s = JSON.parse(localStorage.getItem("bbz-designer") || "null"); if (s && s.bumpers && s.bumpers.every(b => baseOf(b.p))) Object.assign(state, s); } catch { }
    if (!state.bumpers.length) state.bumpers = [newBumper()];
    state.cur = Math.min(state.cur, state.bumpers.length - 1);
  }
  $("#addLine").onclick = () => { const b = cur(); if (b.t.length < MAX_LINES) { const l = newLine(baseOf(b.p).brand); l.a = 180; b.t.push(l); changed(); } };
  document.querySelectorAll("#style button").forEach(x => x.onclick = () => { cur().s = x.dataset.v; changed(); });
  $("#addBumper").onclick = addBumper;
  $("#addBumper2").onclick = addBumper;
  $("#getCode").onclick = askName;
  $("#nameOk").onclick = nameDone;
  $("#nameBack").onclick = () => $("#nameDlg").close();
  $("#orderName").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); nameDone(); } });
  $("#copyCode").onclick = () => copy($("#codeText").textContent, "Code copied");
  $("#copyLink").onclick = () => copy(location.href.split("#")[0] + "#" + $("#codeText").textContent, "Link copied");
  $("#closeCode").onclick = () => $("#codeDlg").close();
  $("#openCode").onclick = () => { $("#loadText").value = ""; $("#loadErr").textContent = ""; $("#loadDlg").showModal(); $("#loadText").focus(); };
  $("#loadCancel").onclick = () => $("#loadDlg").close();
  $("#loadOk").onclick = async () => { try { await openCode($("#loadText").value); $("#loadDlg").close(); toast("Design opened"); } catch (e) { $("#loadErr").textContent = "Can't open that: " + e.message; } };
  changed();
}
init();
