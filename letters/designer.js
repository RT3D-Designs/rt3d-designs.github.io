// RT3D wall letter customer designer (2026-11-06). Buyers type a name, pick a letter style, size and colours, see the
// letters in 3D, and get a design code (RTL1-, code.js) to paste into their order; Letter Studio imports it and makes the 3MF.
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
const TALL = { S: 80, M: 120, L: 160 }, STYLE = { sniglet: "Round and bubbly", titan: "Bold and blocky" }, MAX_NAMES = 6;
let data = null, sizes = {}, view = null, timer = 0, drawId = 0;
const state = { w: [], cur: 0, pick: -1 };
const cur = () => state.w[state.cur];
const colourOf = n => data.colours.find(c => c[0] === n) || data.colours[0];
const clean = DesignCode.cleanWord;
const fill = w => { const x = clean(w.x), last = w.c[w.c.length - 1] || "Pastel Rose"; w.c = [...x].map((_, i) => w.c[i] || last); if (!w.c.length) w.c = [last]; return w; };
const newWord = from => from ? fill({ x: "", f: from.f, z: from.z, e: from.e, c: [from.c[0]] }) : fill({ x: "", f: "sniglet", z: "M", e: "matte", c: ["Pastel Rose"] });
const label = (w, i) => clean(w.x) || `Name ${i + 1}`;
const FINISH_HINT = { matte: "A smooth, soft matt surface.", fuzzy: "A textured, felt-like fuzzy surface." };
const describe = w => `${STYLE[w.f]} · ${TALL[w.z]} mm tall · ${DesignCode.LETTER_FINISHES[w.e || "matte"]} · ${[...new Set(w.c)].join(", ")}`;

function render() {
  const w = cur(), chars = [...clean(w.x)];
  const remove = i => { state.w.splice(i, 1); state.cur = Math.min(state.cur, state.w.length - 1); state.pick = -1; changed(); };
  $("#tabs").replaceChildren(...state.w.map((x, i) => el("button", { type: "button", class: "tab" + (i === state.cur ? " on" : ""), onclick: () => { state.cur = i; state.pick = -1; changed(); } },
    el("i", { style: `background:${colourOf(x.c[0])[1]}` }), label(x, i),
    state.w.length > 1 ? el("span", { class: "x", role: "button", tabindex: "0", "aria-label": "Remove this name", onclick: e => { e.stopPropagation(); remove(i); } }, "×") : null)),
    state.w.length < MAX_NAMES ? el("button", { type: "button", class: "tab add", onclick: addName }, "+ Add name") : null);
  const inp = $("#word"); if (document.activeElement !== inp) inp.value = w.x;
  $("#styles").replaceChildren(...Object.entries(STYLE).map(([k, v]) => el("button", { type: "button", class: "chip" + (w.f === k ? " on" : ""), onclick: () => { w.f = k; changed(); } }, v)));
  document.querySelectorAll("#size button").forEach(b => b.classList.toggle("on", b.dataset.v === w.z));
  document.querySelectorAll("#finish button").forEach(b => b.classList.toggle("on", b.dataset.v === (w.e || "matte")));
  $("#finishHint").textContent = FINISH_HINT[w.e || "matte"];
  $("#letterPick").replaceChildren(el("button", { type: "button", class: "chip" + (state.pick < 0 ? " on" : ""), onclick: () => { state.pick = -1; render(); } }, "All letters"),
    ...chars.map((ch, i) => el("button", { type: "button", class: "chip" + (state.pick === i ? " on" : ""), onclick: () => { state.pick = i; render(); } }, el("i", { style: `display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;background:${colourOf(w.c[i])[1]}` }), ch)));
  const now = state.pick >= 0 ? w.c[state.pick] : (new Set(w.c).size === 1 ? w.c[0] : "");
  $("#colourName").textContent = now || "Mixed";
  $("#colours").replaceChildren(...data.colours.map(([n, hex]) => el("button", { type: "button", class: n === now ? "on" : "", title: n, "aria-label": n, style: `background-color:${hex}`, onclick: () => { if (state.pick >= 0) w.c[state.pick] = n; else w.c = w.c.map(() => n); changed(); } })));
  $("#orderCount").textContent = `${state.w.length} name${state.w.length > 1 ? "s" : ""}`;
  $("#orderList").replaceChildren(...state.w.map((x, i) => el("button", { type: "button", class: "order-row" + (i === state.cur ? " on" : ""), onclick: () => { state.cur = i; state.pick = -1; changed(); scrollTo({ top: 0, behavior: "smooth" }); } },
    el("i", { style: `background:${colourOf(x.c[0])[1]}` }), el("span", {}, el("b", {}, `${i + 1}. ${label(x, i)}`), el("small", {}, describe(x))), el("span", { class: "edit" }, i === state.cur ? "Editing" : "Edit"))));
  $("#addName2").hidden = $("#addName").hidden = state.w.length >= MAX_NAMES;
}
const previews = new Map();
const preview = (f, ch) => { const k = f + ch; if (!previews.has(k)) previews.set(k, LetterView.loadPreview(`letters/${f}/preview/${ch}.bin`)); return previews.get(k); };
async function draw() {
  const id = ++drawId, w = cur(), chars = [...clean(w.x)];
  try {
    const meshes = await Promise.all(chars.map(ch => preview(w.f, ch))); if (id !== drawId) return;
    const s = TALL[w.z] / 120;
    if (view) view.set(meshes.map((mesh, i) => ({ mesh, colour: hexRgb(colourOf(w.c[i])[1]), scale: s, finish: w.e || "matte" })));
    const wide = chars.reduce((a, ch) => a + ((sizes[w.f] || {})[ch] || { w: 100 }).w * s, 0) + 12 * Math.max(0, chars.length - 1);
    $("#meta").textContent = chars.length ? `${chars.length} letter${chars.length > 1 ? "s" : ""} · about ${Math.round(wide)} mm across your wall with small gaps` : "Type a name to see it here";
  } catch (e) { console.error(e); }
}
function changed(quiet) {
  save(); if (!quiet) render();
  clearTimeout(timer); timer = setTimeout(draw, quiet ? 120 : 0);
}
function addName() {
  if (state.w.length >= MAX_NAMES) return;
  state.w.push(newWord(cur())); state.cur = state.w.length - 1; state.pick = -1; changed();
  scrollTo({ top: 0, behavior: "smooth" }); toast(`Name ${state.w.length} added: type it now`);
  setTimeout(() => $("#word").focus({ preventScroll: true }), 400);
}
const designNow = () => ({ n: state.orderName || "", w: state.w });
const summary = () => state.w.map((w, i) => `${state.w.length > 1 ? i + 1 + ". " : ""}${label(w, i)}: ${describe(w)}`).join(" | ");
function askName() {
  const empty = state.w.findIndex(w => !clean(w.x));
  if (empty >= 0) { state.cur = empty; changed(); scrollTo({ top: 0, behavior: "smooth" }); toast("Type a name first"); setTimeout(() => $("#word").focus({ preventScroll: true }), 400); return; }
  $("#orderName").value = state.orderName || ""; $("#nameErr").textContent = "";
  $("#nameSummary").textContent = `Your order: ${summary()}`;
  $("#nameDlg").showModal(); $("#orderName").focus();
}
function nameDone() {
  const v = $("#orderName").value.trim();
  if (!v) { $("#nameErr").textContent = "Please add your name or eBay username."; $("#orderName").focus(); return; }
  state.orderName = v; save(); $("#nameDlg").close(); showCode();
}
async function showCode() {
  const code = await DesignCode.encodeLetters(designNow());
  $("#codeText").textContent = code; $("#codeSummary").textContent = `Order for ${state.orderName}: ${summary()}`;
  history.replaceState(null, "", "#" + code); $("#codeDlg").showModal();
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { const r = document.createRange(); r.selectNodeContents($("#codeText")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selected: press copy on your keyboard"); }
}
async function openCode(text) {
  const d = await DesignCode.decodeLetters(text), list = d.w.filter(w => w.x);
  if (!list.length) throw new Error("there are no letters in it");
  state.w = list.slice(0, MAX_NAMES).map(w => fill({ ...w, c: w.c.map(c => data.colours.some(x => x[0] === c) ? c : "Pastel Rose") })); state.cur = 0; state.pick = -1;
  if (d.n) state.orderName = d.n;
  changed();
}
let toastTimer = 0;
function toast(t) { const x = $("#toast"); x.textContent = t; x.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => x.hidden = true, 2600); }
function save() { try { localStorage.setItem("rt3d-letter-designer", JSON.stringify(state)); } catch { } }

async function init() {
  data = await (await fetch("data.json", { cache: "no-cache" })).json();
  sizes = await (await fetch("letters/letters.json", { cache: "no-cache" })).json();
  view = LetterView.create($("#view"));
  if (!view) { $("#warn").hidden = false; $("#warn").textContent = "Your browser can't show 3D, but you can still make your code."; }
  let loaded = false;
  if (location.hash.includes("RTL")) { try { await openCode(decodeURIComponent(location.hash)); loaded = true; } catch { } }
  if (!loaded) {
    try { const s = JSON.parse(localStorage.getItem("rt3d-letter-designer") || "null"); if (s && Array.isArray(s.w)) Object.assign(state, s); } catch { }
    if (!state.w.length) state.w = [newWord()];
    state.cur = Math.min(state.cur, state.w.length - 1); state.w.forEach(fill);
  }
  $("#word").addEventListener("input", e => { const w = cur(); w.x = clean(e.target.value); e.target.value = w.x; fill(w); state.pick = -1; save(); render(); clearTimeout(timer); timer = setTimeout(draw, 120); });
  document.querySelectorAll("#size button").forEach(b => b.onclick = () => { cur().z = b.dataset.v; changed(); });
  document.querySelectorAll("#finish button").forEach(b => b.onclick = () => { cur().e = b.dataset.v; changed(); });
  $("#addName").onclick = addName; $("#addName2").onclick = addName; $("#getCode").onclick = askName;
  $("#nameOk").onclick = nameDone; $("#nameBack").onclick = () => $("#nameDlg").close();
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
