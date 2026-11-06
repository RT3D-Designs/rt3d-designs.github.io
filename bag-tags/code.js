// Bottle Bumperz design codes (2026-11-03): what the customer designer gives a buyer to paste into the eBay order, and
// what Bumper Studio's "Import customer code" reads back. Shared by both, so they always agree.
//
// A code is "BBZ1-" + the design as compact JSON, squeezed (deflate) and written in URL-safe letters, so a typical
// design is 60-150 characters. "BBZ1" is the format version: a future BBZ2 can be told apart and still read BBZ1.
// The JSON: { n: order name (the buyer's name or eBay username, optional, added 2026-11-03), b: [ bumper… ] }, each bumper { p: boot id ("owala-32oz"), c: colour name ("Pink"), s: "e" engraved | "r" raised,
//   t: [ line… ] }, each line { x: text (with emotes), f: font key ("owala"), z: size mm, a: degrees round (0 = front),
//   u: mm up/down, r: repeat 1-4, g: letter spacing mm }.
"use strict";

const DesignCode = (() => {
  const PREFIX = "BBZ1-";
  // Fonts buyers can pick: a free web font that looks like it in the designer (from Google Fonts, free to use on a
  // website), and the real font Bumper Studio prints with. The key is what goes in the code.
  const FONTS = {
    block:   { label: "Bold block",   web: "Archivo Black", weight: 400, app: "Arial Black" },
    owala:   { label: "Owala style",  web: "Outfit",        weight: 700, app: "Gilroy-Bold" },
    stanley: { label: "Stanley style", web: "Oswald",       weight: 600, app: "Trade Gothic LT Std Cn" },
    rounded: { label: "Rounded",      web: "Nunito",        weight: 900, app: "Arial Rounded MT Bold" },
    script:  { label: "Script",       web: "Great Vibes",   weight: 400, app: "CommercialScript BT" },
  };
  // each brand's usual look (matches the app's per-brand fonts)
  const BRAND_FONT = { Owala: "owala", Stanley: "stanley", Yeti: "block" };

  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  async function pipe(bytes, stream) {
    const w = stream.writable.getWriter(); w.write(bytes); w.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  }
  const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

  async function encode(design) {
    const slim = {};
    const name = String(design.n || "").trim().slice(0, 40);
    if (name) slim.n = name;
    slim.b = design.b.map(b => ({ p: b.p, c: b.c, s: b.s === "r" ? "r" : "e",
      t: b.t.filter(l => l.x && l.x.trim()).map(l => {
        const o = { x: l.x.trim(), f: l.f };
        if (round(l.z) !== 16) o.z = round(l.z);
        if (Math.round(l.a)) o.a = Math.round(l.a);
        if (round(l.u, 2)) o.u = round(l.u, 2);
        if ((l.r | 0) > 1) o.r = l.r | 0;
        if (round(l.g) !== 0.4) o.g = round(l.g);
        return o;
      }) }));
    const bytes = new TextEncoder().encode(JSON.stringify(slim));
    return PREFIX + b64(await pipe(bytes, new CompressionStream("deflate-raw")));
  }

  // finds a code anywhere in pasted text (an eBay message, a link…) and reads it; throws a plain-English error
  async function decode(text) {
    const m = String(text || "").match(/BBZ(\d+)-([A-Za-z0-9_-]+)/);
    if (!m) throw new Error("there's no Bottle Bumperz code in that (it starts with BBZ1-)");
    if (m[1] !== "1") throw new Error(`that's a newer kind of code (BBZ${m[1]}); update Bumper Studio`);
    let json;
    try { json = JSON.parse(new TextDecoder().decode(await pipe(unb64(m[2]), new DecompressionStream("deflate-raw")))); }
    catch { throw new Error("the code is incomplete or mistyped (copy the whole thing)"); }
    if (!json || !Array.isArray(json.b) || !json.b.length) throw new Error("the code has no bumpers in it");
    return { code: PREFIX + m[2], n: String(json.n || "").slice(0, 40), b: json.b.map(b => ({ p: String(b.p || ""), c: String(b.c || ""), s: b.s === "r" ? "r" : "e",
      t: (b.t || []).map(l => ({ x: String(l.x || ""), f: FONTS[l.f] ? l.f : "block", z: +l.z || 16, a: +l.a || 0, u: +l.u || 0, r: Math.min(4, Math.max(1, l.r | 0 || 1)), g: l.g === undefined ? 0.4 : +l.g })) })) };
  }

  // ---- bag tag codes (2026-11-03): "RTT1-" + the same squeeze; read by Tag Studio ----
  // JSON: { n: order name, t: [ tag… ] }, each tag { s: shape (name | luggage | rect | round | shield | heart),
  //   z: size S | M | L, c: backing colour, k: letters colour, a: attachment (key | clip | tie | slot | loop),
  //   l: [ line… ] (1 for name-shaped, up to 2 for the others), each line { x: text (with emotes), f: font key } }
  const TAG_PREFIX = "RTT1-";
  const TAG_SHAPES = ["name", "luggage", "rect", "round", "shield", "heart"], TAG_ATTACH = ["key", "clip", "tie", "slot", "loop"];
  async function encodeTags(design) {
    const slim = {};
    const name = String(design.n || "").trim().slice(0, 40);
    if (name) slim.n = name;
    slim.t = design.t.map(t => ({ s: t.s, z: t.z, c: t.c, k: t.k, a: t.a,
      l: t.l.filter(l => l.x && l.x.trim()).map(l => ({ x: l.x.trim(), f: l.f })) }));
    return TAG_PREFIX + b64(await pipe(new TextEncoder().encode(JSON.stringify(slim)), new CompressionStream("deflate-raw")));
  }
  async function decodeTags(text) {
    const m = String(text || "").match(/RTT(\d+)-([A-Za-z0-9_-]+)/);
    if (!m) throw new Error("there's no bag tag code in that (it starts with RTT1-)");
    if (m[1] !== "1") throw new Error(`that's a newer kind of code (RTT${m[1]}); update Tag Studio`);
    let json;
    try { json = JSON.parse(new TextDecoder().decode(await pipe(unb64(m[2]), new DecompressionStream("deflate-raw")))); }
    catch { throw new Error("the code is incomplete or mistyped (copy the whole thing)"); }
    if (!json || !Array.isArray(json.t) || !json.t.length) throw new Error("the code has no tags in it");
    return { code: TAG_PREFIX + m[2], n: String(json.n || "").slice(0, 40), t: json.t.map(t => ({
      s: TAG_SHAPES.includes(t.s) ? t.s : "name", z: ["S", "M", "L"].includes(t.z) ? t.z : "M",
      c: String(t.c || ""), k: String(t.k || ""), a: TAG_ATTACH.includes(t.a) ? t.a : "key",
      l: (t.l || []).slice(0, 2).map(l => ({ x: String(l.x || ""), f: FONTS[l.f] ? l.f : "block" })) })) };
  }

  // Wall letter codes (Letter Studio, 2026-11-06): RTL1- + the same packing.
  // { n: order name, w: [ { x: the letters (A–Z), f: font key, z: size S | M | L, e: finish matte | fuzzy, c: [ a colour per letter, or just one ] } ] }
  const LETTER_PREFIX = "RTL1-", LETTER_FONTS = { sniglet: "Round and bubbly", titan: "Bold and blocky" }, LETTER_FINISHES = { matte: "Matt", fuzzy: "Fuzzy" };
  const cleanWord = s => String(s || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 16);
  async function encodeLetters(design) {
    const slim = {};
    const name = String(design.n || "").trim().slice(0, 40);
    if (name) slim.n = name;
    slim.w = design.w.map(w => { const cs = w.c.slice(0, cleanWord(w.x).length); return { x: cleanWord(w.x), f: w.f, z: w.z, e: w.e === "fuzzy" ? "fuzzy" : "matte", c: new Set(cs).size === 1 ? [cs[0]] : cs }; });
    return LETTER_PREFIX + b64(await pipe(new TextEncoder().encode(JSON.stringify(slim)), new CompressionStream("deflate-raw")));
  }
  async function decodeLetters(text) {
    const m = String(text || "").match(/RTL(\d+)-([A-Za-z0-9_-]+)/);
    if (!m) throw new Error("there's no wall letter code in that (it starts with RTL1-)");
    if (m[1] !== "1") throw new Error(`that's a newer kind of code (RTL${m[1]}); update Letter Studio`);
    const json = JSON.parse(new TextDecoder().decode(await pipe(unb64(m[2]), new DecompressionStream("deflate-raw"))));
    if (!Array.isArray(json.w)) throw new Error("that code has no letters in it");
    return { code: LETTER_PREFIX + m[2], n: String(json.n || "").slice(0, 40), w: json.w.map(w => { const x = cleanWord(w.x), cs = (w.c || []).map(String);
      return { x, f: LETTER_FONTS[w.f] ? w.f : "sniglet", z: ["S", "M", "L"].includes(w.z) ? w.z : "M", e: w.e === "fuzzy" ? "fuzzy" : "matte", c: [...x].map((_, i) => cs.length > 1 ? (cs[i] || cs[0]) : (cs[0] || "")) }; }) };
  }

  return { PREFIX, FONTS, BRAND_FONT, encode, decode, TAG_PREFIX, TAG_SHAPES, TAG_ATTACH, encodeTags, decodeTags, LETTER_PREFIX, LETTER_FONTS, LETTER_FINISHES, cleanWord, encodeLetters, decodeLetters };
})();
