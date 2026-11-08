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
    // Bold and strong
    block: { label: "Bold block", web: "Archivo Black", weight: 400, app: "Arial Black", group: "Bold and strong" },
    owala: { label: "Owala style", web: "Outfit", weight: 700, app: "Gilroy-Bold", group: "Bold and strong" },
    stanley: { label: "Stanley style", web: "Oswald", weight: 600, app: "Trade Gothic LT Std Cn", group: "Bold and strong" },
    poppins: { label: "Modern bold", web: "Poppins", weight: 800, app: "Poppins ExtraBold", group: "Bold and strong", file: "Poppins-ExtraBold.ttf" },
    anton: { label: "Tall poster", web: "Anton", weight: 400, app: "Anton", group: "Bold and strong", file: "Anton-Regular.ttf" },
    bebas: { label: "Tall and clean", web: "Bebas Neue", weight: 400, app: "Bebas Neue", group: "Bold and strong", file: "BebasNeue-Regular.ttf" },
    russo: { label: "Sporty", web: "Russo One", weight: 400, app: "Russo One", group: "Bold and strong", file: "RussoOne-Regular.ttf" },
    bungee: { label: "Sign writer", web: "Bungee", weight: 400, app: "Bungee", group: "Bold and strong", file: "Bungee-Regular.ttf" },
    alfa: { label: "Heavy slab", web: "Alfa Slab One", weight: 400, app: "Alfa Slab One", group: "Bold and strong", file: "AlfaSlabOne-Regular.ttf" },
    graduate: { label: "Varsity", web: "Graduate", weight: 400, app: "Graduate", group: "Bold and strong", file: "Graduate-Regular.ttf" },
    blackops: { label: "Army stencil", web: "Black Ops One", weight: 400, app: "Black Ops One", group: "Bold and strong", file: "BlackOpsOne-Regular.ttf" },
    // Round and fun
    rounded: { label: "Rounded", web: "Nunito", weight: 900, app: "Arial Rounded MT Bold", group: "Round and fun" },
    lilita: { label: "Friendly", web: "Lilita One", weight: 400, app: "Lilita One", group: "Round and fun", file: "LilitaOne-Regular.ttf" },
    paytone: { label: "Soft bold", web: "Paytone One", weight: 400, app: "Paytone One", group: "Round and fun", file: "PaytoneOne-Regular.ttf" },
    coiny: { label: "Bubbly", web: "Coiny", weight: 400, app: "Coiny", group: "Round and fun", file: "Coiny-Regular.ttf" },
    bubblegum: { label: "Bubblegum", web: "Bubblegum Sans", weight: 400, app: "Bubblegum Sans", group: "Round and fun", file: "BubblegumSans-Regular.ttf" },
    chewy: { label: "Chewy", web: "Chewy", weight: 400, app: "Chewy", group: "Round and fun", file: "Chewy-Regular.ttf" },
    luckiest: { label: "Cartoon", web: "Luckiest Guy", weight: 400, app: "Luckiest Guy", group: "Round and fun", file: "LuckiestGuy-Regular.ttf" },
    bangers: { label: "Comic book", web: "Bangers", weight: 400, app: "Bangers", group: "Round and fun", file: "Bangers-Regular.ttf" },
    // Script and handwritten
    script: { label: "Script", web: "Great Vibes", weight: 400, app: "CommercialScript BT", group: "Script and handwritten" },
    pacifico: { label: "Surf script", web: "Pacifico", weight: 400, app: "Pacifico", group: "Script and handwritten", file: "Pacifico-Regular.ttf" },
    lobster: { label: "Retro script", web: "Lobster", weight: 400, app: "Lobster", group: "Script and handwritten", file: "Lobster-Regular.ttf" },
    kaushan: { label: "Brush script", web: "Kaushan Script", weight: 400, app: "Kaushan Script", group: "Script and handwritten", file: "KaushanScript-Regular.ttf" },
    satisfy: { label: "Neat script", web: "Satisfy", weight: 400, app: "Satisfy", group: "Script and handwritten", file: "Satisfy-Regular.ttf" },
    yellowtail: { label: "Sign script", web: "Yellowtail", weight: 400, app: "Yellowtail", group: "Script and handwritten", file: "Yellowtail-Regular.ttf" },
    courgette: { label: "Soft script", web: "Courgette", weight: 400, app: "Courgette", group: "Script and handwritten", file: "Courgette-Regular.ttf" },
    marker: { label: "Marker pen", web: "Permanent Marker", weight: 400, app: "Permanent Marker", group: "Script and handwritten", file: "PermanentMarker-Regular.ttf" },
    // Classic and special
    ultra: { label: "Classic heavy", web: "Ultra", weight: 400, app: "Ultra", group: "Classic and special", file: "Ultra-Regular.ttf" },
    caprasimo: { label: "Soft retro", web: "Caprasimo", weight: 400, app: "Caprasimo", group: "Classic and special", file: "Caprasimo-Regular.ttf" },
    righteous: { label: "Seventies", web: "Righteous", weight: 400, app: "Righteous", group: "Classic and special", file: "Righteous-Regular.ttf" },
    rye: { label: "Western", web: "Rye", weight: 400, app: "Rye", group: "Classic and special", file: "Rye-Regular.ttf" },
    pirata: { label: "Old English", web: "Pirata One", weight: 400, app: "Pirata One", group: "Classic and special", file: "PirataOne-Regular.ttf" },
    creepster: { label: "Spooky", web: "Creepster", weight: 400, app: "Creepster", group: "Classic and special", file: "Creepster-Regular.ttf" },
    pixel: { label: "Pixel game", web: "Press Start 2P", weight: 400, app: "Press Start 2P", group: "Classic and special", file: "PressStart2P-Regular.ttf" },
    audiowide: { label: "Space age", web: "Audiowide", weight: 400, app: "Audiowide", group: "Classic and special", file: "Audiowide-Regular.ttf" },
  };
  // The fonts Bumper Studiowebonts holds (free Google fonts, kept on this PC, never published): the apps load them from there, so nothing needs installing.
  const fontFile = family => { const f = Object.values(FONTS).find(x => x.file && x.app === family); return f ? "fonts/" + f.file : null; };
  const bundledFonts = () => Object.values(FONTS).filter(f => f.file).map(f => f.app);
  // Google's stylesheet for a list of { web, weight } fonts (the designers load this; the browser only fetches a font once it's shown).
  const fontCss = list => "https://fonts.googleapis.com/css2?" + list.map(f => "family=" + f.web.replace(/ /g, "+") + (f.weight !== 400 ? ":wght@" + f.weight : "")).join("&") + "&display=swap";
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
  //   l: [ line… ] (1 for name-shaped, up to 2 for the others), each line { x: text (with emotes), f: font key },
  //   b: text size on the fixed shapes, 1 bigger or 2 biggest that fits (added 2026-11-08; missing = standard, so older codes still read) }
  const TAG_PREFIX = "RTT1-";
  const TAG_SHAPES = ["name", "luggage", "rect", "round", "shield", "heart"], TAG_ATTACH = ["key", "clip", "tie", "slot", "loop"];
  async function encodeTags(design) {
    const slim = {};
    const name = String(design.n || "").trim().slice(0, 40);
    if (name) slim.n = name;
    slim.t = design.t.map(t => ({ s: t.s, z: t.z, c: t.c, k: t.k, a: t.a, ...(t.s !== "name" && (t.b === 1 || t.b === 2) ? { b: t.b } : {}),
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
      c: String(t.c || ""), k: String(t.k || ""), a: TAG_ATTACH.includes(t.a) ? t.a : "key", b: t.b === 1 || t.b === 2 ? t.b : 0,
      l: (t.l || []).slice(0, 2).map(l => ({ x: String(l.x || ""), f: FONTS[l.f] ? l.f : "block" })) })) };
  }

  // Wall letter codes (Letter Studio, 2026-11-06): RTL1- + the same packing.
  // { n: order name, w: [ { x: the letters (A–Z), f: font key, z: size S | M | L, e: finish matte | fuzzy, c: [ a colour per letter, or just one ] } ] }
  const LETTER_PREFIX = "RTL1-", LETTER_FONTS = { sniglet: "Round and bubbly", titan: "Bold and blocky", coiny: "Soft and round", poppins: "Clean and modern", alfa: "Classic slab", rammetto: "Extra heavy" }, LETTER_FINISHES = { matte: "Matte", fuzzy: "Fuzzy" };
  // the font each letter style was inflated from, for showing it in the designers' menu and the apps
  const LETTER_WEB = { sniglet: { web: "Sniglet", weight: 800 }, titan: { web: "Titan One", weight: 400 }, coiny: { web: "Coiny", weight: 400 }, 
    poppins: { web: "Poppins", weight: 800 }, alfa: { web: "Alfa Slab One", weight: 400 }, rammetto: { web: "Rammetto One", weight: 400 } };
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

  return { PREFIX, FONTS, fontFile, bundledFonts, fontCss, BRAND_FONT, encode, decode, TAG_PREFIX, TAG_SHAPES, TAG_ATTACH, encodeTags, decodeTags, LETTER_PREFIX, LETTER_FONTS, LETTER_WEB, LETTER_FINISHES, cleanWord, encodeLetters, decodeLetters };
})();
