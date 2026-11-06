// RT3D bag tag customer designer (2026-11-05). Buyers pick a shape, size, attachment, colours and text, see the tag in
// 3D, and get a design code (RTT1-, code.js) to paste into their order; Tag Studio imports the code and makes the 3MF.
// The tag shapes (tags.js) are the same ones Tag Studio prints; web fonts stand in for the real ones on screen.
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
const MAX_TAGS = 10, MAX_CHARS = 30;
const LOOP_READY = true;             // the built-in TPU loop, opened 2026-11-05 at the user's call (same switch as Tag Studio's)
const HINTS = { key: "5 mm hole with a thick rim, for a split keyring.", clip: "8 mm hole, for a carabiner or clip.", tie: "4 mm hole, for a cable tie.", slot: "A long slot a strap or luggage loop threads through.", loop: "A flexible TPU strap that loops round the handle." };

let data = null, view = null;
const state = { tags: [], cur: 0 };
const cur = () => state.tags[state.cur];
const colourOf = name => data.colours.find(c => c[0] === name) || data.colours[0];
const lineCount = t => t.s === "name" ? 1 : 2;

function newTag(from) {
  if (from) return JSON.parse(JSON.stringify(from));
  return { s: "name", z: "M", a: "key", c: "Blue", k: "Lumi White", l: [{ x: "", f: "block" }, { x: "", f: "block" }] };
}
// the engine's tag (web fonts stand in for the real ones here)
const engineTag = t => ({ ...t, l: t.l.slice(0, lineCount(t)).map(l => ({ x: l.x, font: `${F[l.f].weight}|${F[l.f].web}` })) });
const label = (t, i) => t.l.slice(0, lineCount(t)).map(l => l.x.trim()).filter(Boolean).join(" · ") || `Tag ${i + 1}`;
const attachName = a => Tags.LABELS.attach[a].toLowerCase().replace("tpu", "TPU");
const describe = t => `${Tags.LABELS.shapes[t.s]} ${t.z} · ${t.c} with ${t.k} letters · ${attachName(t.a)}`;

// ---- drawing the controls ----
function render() {
  const t = cur();
  const remove = i => { state.tags.splice(i, 1); state.cur = Math.min(state.cur, state.tags.length - 1); changed(); };
  $("#tabs").replaceChildren(...state.tags.map((x, i) => el("button", { type: "button", class: "tab" + (i === state.cur ? " on" : ""), onclick: () => { state.cur = i; changed(); } },
    el("i", { style: `background:${colourOf(x.c)[1]}` }), label(x, i),
    state.tags.length > 1 ? el("span", { class: "x", role: "button", tabindex: "0", "aria-label": "Remove this tag", onclick: e => { e.stopPropagation(); remove(i); } }, "×") : null)),
    state.tags.length < MAX_TAGS ? el("button", { type: "button", class: "tab add", onclick: addTag }, "+ Add tag") : null);
  $("#orderCount").textContent = `${state.tags.length} tag${state.tags.length > 1 ? "s" : ""}`;
  $("#orderList").replaceChildren(...state.tags.map((x, i) => el("button", { type: "button", class: "order-row" + (i === state.cur ? " on" : ""), onclick: () => { state.cur = i; changed(); scrollTo({ top: 0, behavior: "smooth" }); } },
    el("i", { style: `background:${colourOf(x.c)[1]}` }),
    el("span", {}, el("b", {}, `${i + 1}. ${label(x, i)}`), el("small", {}, describe(x))),
    el("span", { class: "edit" }, i === state.cur ? "Editing" : "Edit"))));
  $("#addTag2").hidden = $("#addTag").hidden = state.tags.length >= MAX_TAGS;
  $("#shapes").replaceChildren(...Object.entries(Tags.LABELS.shapes).map(([k, v]) => el("button", { type: "button", class: "chip" + (t.s === k ? " on" : ""), onclick: () => { t.s = k; changed(); } }, v)));
  // long tags go by their length, round shapes by their width
  const long = ["name", "luggage", "rect"].includes(t.s);
  document.querySelectorAll("#size button").forEach(x => { x.classList.toggle("on", x.dataset.v === t.z); x.querySelector("small").textContent = `about ${Tags.SIZES[x.dataset.v][long ? "len" : "d"]} mm`; });
  $("#attach").replaceChildren(...Object.entries(Tags.LABELS.attach).map(([k, v]) => {
    const soon = k === "loop" && !LOOP_READY;
    return el("button", { type: "button", class: "chip" + (t.a === k ? " on" : "") + (soon ? " soon" : ""), onclick: () => { if (soon) { toast("The built-in TPU loop is coming soon"); return; } t.a = k; changed(); } }, v, soon ? el("small", {}, "soon") : null);
  }));
  $("#attachHint").textContent = HINTS[t.a];
  $("#lines").replaceChildren(...t.l.slice(0, lineCount(t)).map((l, i) => lineCard(l, i)));
  $("#c1Name").textContent = t.c; $("#c2Name").textContent = t.k;
  swatches($("#c1"), t.c, v => { t.c = v; changed(); });
  swatches($("#c2"), t.k, v => { t.k = v; changed(); });
}
function swatches(box, current, onPick) {
  box.replaceChildren(...data.colours.map(([n, hex, tr]) => el("button", { type: "button", class: (tr ? "trans " : "") + (n === current ? "on" : ""), title: n, "aria-label": n, style: `background-color:${hex}`, onclick: () => onPick(n) })));
}

const emoteIcons = new Map();
const emoteIcon = e => { if (!emoteIcons.has(e)) emoteIcons.set(e, Emotes.icon(e, 44, "#eceae6")); return emoteIcons.get(e); };

function lineCard(l, i) {
  const input = el("input", { type: "text", value: l.x, maxlength: MAX_CHARS, placeholder: i ? "Second line (optional), e.g. a phone number or ♥" : "Type a name", autocomplete: "off", autocapitalize: "characters",
    oninput: e => { l.x = e.target.value; changed(true); samples(); } });
  // the font buttons show the buyer's own text
  const samples = () => card.querySelectorAll(".fonts span").forEach(s => s.textContent = (l.x.trim() || "Name").slice(0, 10));
  const insert = ch => {
    const p = input.selectionStart ?? input.value.length;
    if ((input.value + ch).length > MAX_CHARS + 4) return;
    l.x = input.value.slice(0, p) + ch + input.value.slice(input.selectionEnd ?? p); input.value = l.x;
    changed(true); samples(); input.focus(); input.setSelectionRange(p + ch.length, p + ch.length);
  };
  const sample = (l.x.trim() || "Name").slice(0, 10);
  const card = el("div", { class: "line" },
    el("div", { class: "line-head" }, i ? "Second line" : "Main line"),
    input,
    el("div", { class: "label" }, "Add an emote"),
    el("div", { class: "emotes" }, ...Emotes.list.map(e => el("button", { type: "button", title: e.name, "aria-label": "Add " + e.name, onclick: () => insert(e.ch) }, el("img", { src: emoteIcon(e), alt: "" })))),
    el("div", { class: "label" }, "Font"),
    el("div", { class: "fonts" }, ...Object.entries(F).map(([k, f]) => el("button", { type: "button", class: k === l.f ? "on" : "", onclick: () => { l.f = k; changed(); } },
      el("span", { style: `font-family:"${f.web}";font-weight:${f.weight}` }, sample), el("small", {}, f.label)))));
  return card;
}

// ---- preview ----
let timer = 0;
function changed(quiet) {
  save();
  if (!quiet) render(); else refreshLabels();
  clearTimeout(timer); timer = setTimeout(draw, quiet ? 120 : 0);
}
// typing only updates the names in the tabs and the order list, so the text box keeps the keyboard
function refreshLabels() {
  const i = state.cur, name = label(cur(), i), tab = $("#tabs").children[i], row = $("#orderList").children[i];
  if (tab) { const n = [...tab.childNodes].find(c => c.nodeType === 3); if (n) n.textContent = name; }
  if (row) row.querySelector("b").textContent = `${i + 1}. ${name}`;
}
let drawing = false, drawAgain = false;
async function draw() {
  if (drawing) { drawAgain = true; return; }
  drawing = true;
  try {
    const t = cur(), lines = t.l.slice(0, lineCount(t));
    await Promise.all(lines.map(l => document.fonts.load(`${F[l.f].weight} 40px "${F[l.f].web}"`).catch(() => {})));
    const p = Tags.parts(engineTag(t), 0.25);
    $("#meta").textContent = `About ${Math.round(p.w)} × ${Math.round(p.h)} mm · ${attachName(t.a)}`;
    $("#warn").hidden = !p.warn.length; $("#warn").textContent = p.warn[0] || "";
    if (view) {
      view.setBase(Tags.soup(p.back, p.stud), { H: p.height, R: Math.max(p.w, p.h) / 2, outerAt: () => 1e9, bandLo: 0, bandHi: 0 });
      view.setScene({ color: hexRgb(colourOf(t.c)[1]), color2: hexRgb(colourOf(t.c)[1]), mode: 0, wall: null, floor: null, part: p.front, partKind: 2, partColor: hexRgb(colourOf(t.k)[1]), sink: 0 });
    }
  } catch (e) { console.error(e); }
  finally { drawing = false; if (drawAgain) { drawAgain = false; draw(); } }
}

// a new tag for the same order: same style and colours as the one on screen, text left for them to type
function addTag() {
  if (state.tags.length >= MAX_TAGS) return;
  const t = newTag(cur()); t.l.forEach(l => l.x = "");
  state.tags.push(t); state.cur = state.tags.length - 1; changed();
  scrollTo({ top: 0, behavior: "smooth" });
  toast(`Tag ${state.tags.length} added: design it now`);
  setTimeout(() => { const inp = document.querySelector(".line input"); if (inp) inp.focus({ preventScroll: true }); }, 400);
}

// ---- codes ----
const designNow = () => ({ n: state.orderName || "", t: state.tags.map(t => ({ ...t, l: t.l.slice(0, lineCount(t)) })) });
const summary = () => state.tags.map((t, i) => `${state.tags.length > 1 ? i + 1 + ". " : ""}${label(t, i)}: ${describe(t)}`).join(" | ");
// "Get my design code" first asks who the order is for (it goes in the code, and names the job when it's imported)
function askName() {
  const empty = state.tags.findIndex(t => !t.l.slice(0, lineCount(t)).some(l => l.x.trim()));
  if (empty >= 0) {
    state.cur = empty; changed(); scrollTo({ top: 0, behavior: "smooth" });
    toast(`Tag ${empty + 1} needs a name`);
    setTimeout(() => { const inp = document.querySelector(".line input"); if (inp) inp.focus({ preventScroll: true }); }, 400);
    return;
  }
  $("#orderName").value = state.orderName || ""; $("#nameErr").textContent = "";
  $("#nameSummary").textContent = `Your order: ${state.tags.length} tag${state.tags.length > 1 ? "s" : ""}. ${summary()}`;
  $("#nameDlg").showModal(); $("#orderName").focus();
}
function nameDone() {
  const v = $("#orderName").value.trim();
  if (!v) { $("#nameErr").textContent = "Please add your name or eBay username."; $("#orderName").focus(); return; }
  state.orderName = v; save(); $("#nameDlg").close(); showCode();
}
async function showCode() {
  const code = await DesignCode.encodeTags(designNow());
  $("#codeText").textContent = code;
  $("#codeSummary").textContent = `Order for ${state.orderName}: ${summary()}`;
  history.replaceState(null, "", "#" + code);
  $("#codeDlg").showModal();
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { const r = document.createRange(); r.selectNodeContents($("#codeText")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selected: press copy on your keyboard"); }
}
async function openCode(text) {
  const d = await DesignCode.decodeTags(text);
  if (!d.t.length) throw new Error("there are no tags in it");
  state.tags = d.t.slice(0, MAX_TAGS).map(t => {
    const known = n => data.colours.some(c => c[0] === n);
    const l = t.l.slice(0, 2); while (l.length < 2) l.push({ x: "", f: l[0] ? l[0].f : "block" });
    return { ...t, a: t.a === "loop" && !LOOP_READY ? "slot" : t.a, c: known(t.c) ? t.c : "Blue", k: known(t.k) ? t.k : "Lumi White", l };
  });
  state.cur = 0;
  if (d.n) state.orderName = d.n;
  changed();
}

let toastTimer = 0;
function toast(t) { const x = $("#toast"); x.textContent = t; x.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => x.hidden = true, 2600); }
function save() { try { localStorage.setItem("rt3d-tag-designer", JSON.stringify(state)); } catch { } }

async function init() {
  data = await (await fetch("data.json", { cache: "no-cache" })).json();
  view = View3D.create($("#view"), { yaw: 0.25, pitch: 0.95 });
  if (!view) { $("#warn").hidden = false; $("#warn").textContent = "Your browser can't show 3D, but you can still make your code."; }
  // a code in the link (#RTT1-…) wins; otherwise carry on from last time
  let loaded = false;
  if (location.hash.includes("RTT")) { try { await openCode(decodeURIComponent(location.hash)); loaded = true; } catch { } }
  if (!loaded) {
    try { const s = JSON.parse(localStorage.getItem("rt3d-tag-designer") || "null"); if (s && Array.isArray(s.tags)) Object.assign(state, s); } catch { }
    if (!state.tags.length) state.tags = [newTag()];
    state.cur = Math.min(state.cur, state.tags.length - 1);
  }
  document.querySelectorAll("#size button").forEach(x => x.onclick = () => { cur().z = x.dataset.v; changed(); });
  $("#addTag").onclick = addTag;
  $("#addTag2").onclick = addTag;
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
