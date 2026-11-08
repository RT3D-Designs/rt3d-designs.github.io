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

let data = null, view = null, steps = null, colourFor = "c";   // colourFor: which part the colours apply to, c backing or k letters
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
  const count = `${state.tags.length} tag${state.tags.length > 1 ? "s" : ""}`;
  $("#orderCount").textContent = count;
  $("#orderList").replaceChildren(...state.tags.map((x, i) => el("button", { type: "button", class: "order-row" + (i === state.cur ? " on" : ""), onclick: () => { state.cur = i; changed(); steps.open("stepText"); } },
    el("i", { style: `background:${colourOf(x.c)[1]}` }),
    el("span", {}, el("b", {}, `${i + 1}. ${label(x, i)}`), el("small", {}, describe(x))),
    el("span", { class: "edit" }, i === state.cur ? "Editing" : "Edit"))));
  $("#addTag2").hidden = state.tags.length >= MAX_TAGS;
  $("#shapes").replaceChildren(...Object.entries(Tags.LABELS.shapes).map(([k, v]) => {
    const b = el("button", { type: "button", class: t.s === k ? "on" : "", onclick: () => { t.s = k; changed(); } }, v);
    b.insertAdjacentHTML("afterbegin", SHAPE_ICONS[k] || "");
    return b;
  }));
  // long tags go by their length, round shapes by their width
  const long = ["name", "luggage", "rect"].includes(t.s);
  document.querySelectorAll("#size button").forEach(x => { x.classList.toggle("on", x.dataset.v === t.z); x.querySelector("small").textContent = `about ${Tags.SIZES[x.dataset.v][long ? "len" : "d"]} mm`; });
  // text size: only on the fixed shapes (a name-shaped tag is its text); the preview says whether there's room
  $("#textSizeBox").hidden = t.s === "name";
  document.querySelectorAll("#textSize button").forEach(x => x.classList.toggle("on", +x.dataset.v === (t.b || 0)));
  $("#attach").replaceChildren(...Object.entries(Tags.LABELS.attach).map(([k, v]) => {
    const soon = k === "loop" && !LOOP_READY;
    return el("button", { type: "button", class: "chip" + (t.a === k ? " on" : "") + (soon ? " soon" : ""), onclick: () => { if (soon) { toast("The built-in TPU loop is coming soon"); return; } t.a = k; changed(); } }, v, soon ? el("small", {}, "soon") : null);
  }));
  $("#attachHint").textContent = HINTS[t.a];
  $("#lines").replaceChildren(...t.l.slice(0, lineCount(t)).map((l, i) => lineCard(l, i)));
  // one set of colours, for whichever part is chosen
  $("#c1Name").textContent = t.c; $("#c2Name").textContent = t.k;
  $("#c1Dot").style.background = colourOf(t.c)[1]; $("#c2Dot").style.background = colourOf(t.k)[1];
  document.querySelectorAll("#colourFor button").forEach(x => x.classList.toggle("on", x.dataset.v === colourFor));
  $("#colours").replaceChildren(...data.colours.map(([n, hex, tr]) => el("button", { type: "button", class: (tr ? "trans " : "") + (n === t[colourFor] ? "on" : ""), title: n, "aria-label": n, style: `background-color:${hex}`, onclick: () => { t[colourFor] = n; changed(); } })));
  $("#nowShape").textContent = `${Tags.LABELS.shapes[t.s]}, ${{ S: "small", M: "medium", L: "large" }[t.z]}`;
  $("#nowAttach").textContent = Tags.LABELS.attach[t.a];
  $("#nowColour").textContent = `${t.c}, ${t.k}`;
  refreshLabels();
}
// little pictures of the shapes (40 x 28)
const SHAPE_ICONS = (() => {
  const svg = d => `<svg viewBox="0 0 40 28" aria-hidden="true"><path d="${d}"/></svg>`, hole = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  return {
    name: svg("M7 9c1-3 4-3 6-2 2-3 6-3 8-1 3-2 7-2 9 0 3 0 6 2 6 6s-1 9-5 9c-2 2-6 2-8 0-3 2-7 2-9 0-3 2-7 1-8-2-3-1-4-8 1-10z" + hole(9, 14, 2)),
    luggage: svg("M11 5h24a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H11l-8-6.5a3 3 0 0 1 0-5z" + hole(9, 14, 2)),
    rect: svg("M6 5h28a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" + hole(8, 14, 2)),
    round: svg("M20 1a13 13 0 1 1 0 26a13 13 0 1 1 0-26z" + hole(20, 6, 2)),
    shield: svg("M20 1l11 3v9c0 7-5 12-11 14C14 25 9 20 9 13V4z" + hole(20, 6, 2)),
    heart: svg("M20 26C12 20 6 16 6 9.500A6.800 6.800 0 0 1 20 6.500A6.800 6.800 0 0 1 34 9.500C34 16 28 20 20 26z" + hole(20, 10, 2)),
  };
})();
const onPhone = () => matchMedia("(pointer: coarse)").matches;

function lineCard(l, i) {
  const input = el("input", { type: "text", value: l.x, maxlength: MAX_CHARS, placeholder: i ? "Second line, e.g. a phone number" : "Type a name", autocomplete: "off", autocapitalize: "characters", "aria-label": i ? "Second line" : "Main line",
    oninput: e => { l.x = e.target.value; changed(true); fonts.refresh(); } });
  // an icon goes where the cursor was, or at the end if they haven't been in the box
  let caret = null;
  for (const ev of ["keyup", "click", "input"]) input.addEventListener(ev, () => { caret = input.selectionStart; });
  const insert = ch => {
    const p = caret ?? input.value.length;
    if ((input.value + ch).length > MAX_CHARS + 4) return;
    l.x = input.value.slice(0, p) + ch + input.value.slice(p); input.value = l.x; caret = p + ch.length;
    changed(true); fonts.refresh();
    if (!onPhone()) { input.focus(); input.setSelectionRange(p + ch.length, p + ch.length); }
    toast("Icon added");
  };
  // the dropdown shows the buyer's own text in each font
  const fonts = Picker.fonts({ groups: Picker.groupsOf(F), value: l.f, sample: () => (l.x.trim() || "Name").slice(0, 14), onPick: k => { l.f = k; changed(); } });
  const icons = Picker.icons({ onPick: e => insert(e.ch) });
  return el("div", { class: "line" },
    i ? el("div", { class: "line-head" }, "Second line") : null,
    input,
    el("div", { class: "pick-pair" }, fonts.root, icons.root));
}

// ---- preview ----
let timer = 0;
function changed(quiet) {
  save();
  if (!quiet) render(); else refreshLabels();
  clearTimeout(timer); timer = setTimeout(draw, quiet ? 120 : 0);
}
// typing only updates the names and summaries, so the text box keeps the keyboard
function refreshLabels() {
  const i = state.cur, t = cur(), name = label(t, i), tab = $("#tabs").children[i], row = $("#orderList").children[i];
  if (tab) { const n = [...tab.childNodes].find(c => c.nodeType === 3); if (n) n.textContent = name; }
  if (row) row.querySelector("b").textContent = `${i + 1}. ${name}`;
  const typed = t.l.slice(0, lineCount(t)).some(l => l.x.trim());
  $("#nowText").textContent = typed ? name : "";
  $("#barSum").replaceChildren(el("b", {}, typed ? name : "Your tag"), `${state.tags.length} tag${state.tags.length > 1 ? "s" : ""} in this order`);
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
    showRoom(p.fit);
    if (view) {
      view.setBase(Tags.soup(p.back, p.stud), { H: p.height, R: Math.max(p.w, p.h) / 2, outerAt: () => 1e9, bandLo: 0, bandHi: 0 });
      view.setScene({ color: hexRgb(colourOf(t.c)[1]), color2: hexRgb(colourOf(t.c)[1]), mode: 0, wall: null, floor: null, part: p.front, partKind: 2, partColor: hexRgb(colourOf(t.k)[1]), sink: 0 });
    }
  } catch (e) { console.error(e); }
  finally { drawing = false; if (drawAgain) { drawAgain = false; draw(); } }
}

// Bigger and Biggest only when the text can grow by at least a tenth (fit = how far it could grow, from Tags.layout)
function showRoom(fit) {
  const room = !(fit < 1.12);
  document.querySelectorAll('#textSize button:not([data-v="0"])').forEach(x => x.disabled = !room);
  $("#textSizeHint").hidden = room || cur().s === "name";
}

// a new tag for the same order: same style and colours as the one on screen, text left for them to type
function addTag() {
  if (state.tags.length >= MAX_TAGS) return;
  const t = newTag(cur()); t.l.forEach(l => l.x = "");
  state.tags.push(t); state.cur = state.tags.length - 1; changed();
  steps.open("stepText");
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
    state.cur = empty; changed(); steps.open("stepText");
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
  $("#ebayNote").hidden = true;
  const code = await DesignCode.encodeTags(designNow());
  $("#codeText").textContent = code;
  $("#codeSummary").textContent = `Order for ${state.orderName}: ${summary()}`;
  history.replaceState(null, "", "#" + code);
  $("#codeDlg").showModal();
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
  await Picker.loadFonts(Object.values(F));
  steps = Picker.steps();
  document.querySelectorAll("#colourFor button").forEach(x => x.onclick = () => { colourFor = x.dataset.v; render(); });
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
  document.querySelectorAll("#textSize button").forEach(x => x.onclick = () => { cur().b = +x.dataset.v; changed(); });
  $("#addTag2").onclick = addTag;
  $("#getCode").onclick = askName;
  $("#nameOk").onclick = nameDone;
  $("#nameBack").onclick = () => $("#nameDlg").close();
  $("#orderName").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); nameDone(); } });
  $("#copyCode").onclick = () => copy($("#codeText").textContent, "Code copied");
  // "Order on eBay" (link set in the site's ebay.js; hidden while it's empty): copies the code and opens the listing
  const ebay = window.RT3D_EBAY && window.RT3D_EBAY.bagTags;
  if (ebay) { const buy = $("#buyEbay"); buy.href = ebay; buy.hidden = false; $("#copyCode").classList.remove("primary");
    buy.onclick = ebayCopy; }
  $("#copyLink").onclick = () => copy(location.href.split("#")[0] + "#" + $("#codeText").textContent, "Link copied");
  $("#closeCode").onclick = () => $("#codeDlg").close();
  $("#openCode").onclick = () => { $("#loadText").value = ""; $("#loadErr").textContent = ""; $("#loadDlg").showModal(); $("#loadText").focus(); };
  $("#loadCancel").onclick = () => $("#loadDlg").close();
  $("#loadOk").onclick = async () => { try { await openCode($("#loadText").value); $("#loadDlg").close(); toast("Design opened"); } catch (e) { $("#loadErr").textContent = "Can't open that: " + e.message; } };
  changed();
}
init();
