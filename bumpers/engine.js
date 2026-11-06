// Bumper Studio geometry: reads the boots, works out their wall shape, and turns names, symbols and pictures
// into print-ready parts that wrap around the wall (or sit flat under the floor).
//
// How the parts are made: everything is drawn white-on-black onto a flat "unrolled wall" picture (or a picture
// of the floor), then traced with marching triangles on a fine grid (0.1 mm). Each grid triangle that's inside the
// shape becomes a little bit of the part's skin, and the outline gets side walls, so the part is closed and
// watertight. The picture is then wrapped onto the boot: across = around the wall, up = height.
// (The grid was 0.1 mm at first; 0.15 mm halves the file size and still prints the same.)
// The parts are handed to Bambu Studio the same way they're set up by hand there: a cut ("negative part") for
// engraved names, a colour change ("modifier") for two-colour names, and a normal part for raised names.
"use strict";

const Engine = (() => {

  // ---- boots ----
  function parseStl(buf) {
    const dv = new DataView(buf);
    const n = dv.getUint32(80, true);
    const pos = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true);
    }
    return pos;
  }

  // shared vertices + triangle list (3MF wants an indexed mesh)
  function weld(pos) {
    const map = new Map(), verts = [], tris = new Uint32Array(pos.length / 3);
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const key = x.toFixed(4) + "," + y.toFixed(4) + "," + z.toFixed(4);
      let id = map.get(key);
      if (id === undefined) { id = verts.length / 3; map.set(key, id); verts.push(x, y, z); }
      tris[i] = id;
    }
    return { verts: new Float32Array(verts), tris };
  }

  // The boot's outside radius at each height (sliced every 0.2 mm), the straight part of the wall, and the
  // floor ring underneath (hole radius to outside radius at the very bottom).
  function profile(pos) {
    let H = 0;
    for (let i = 2; i < pos.length; i += 3) H = Math.max(H, pos[i]);
    const step = 0.2, n = Math.ceil(H / step) + 1;
    const outer = new Float32Array(n), inner = new Float32Array(n);
    const sliceAt = (z, cb) => {
      for (let t = 0; t < pos.length; t += 9) {
        for (let e = 0; e < 3; e++) {
          const a = t + e * 3, b = t + ((e + 1) % 3) * 3;
          const za = pos[a + 2], zb = pos[b + 2];
          if ((za - z) * (zb - z) > 0 || za === zb) continue;
          const f = (z - za) / (zb - za);
          const x = pos[a] + (pos[b] - pos[a]) * f, y = pos[a + 1] + (pos[b + 1] - pos[a + 1]) * f;
          cb(Math.hypot(x, y));
        }
      }
    };
    for (let k = 0; k < n; k++) {
      const z = Math.min(Math.max(k * step, 0.02), H - 0.02);
      let r = 0, ri = Infinity; sliceAt(z, v => { if (v > r) r = v; if (v < ri) ri = v; }); outer[k] = r; inner[k] = ri;
    }
    let fIn = Infinity, fOut = 0;
    sliceAt(0.1, v => { if (v < fIn) fIn = v; if (v > fOut) fOut = v; });
    return makeProfile({ H, step, outer: [...outer], inner: [...inner], floorIn: fIn, floorOut: fOut });
  }
  // The profile from its numbers (also how the customer designer gets it: the boot's shape as numbers only,
  // never the boot file itself, 2026-11-03).
  function makeProfile(d) {
    const { H, step, outer, inner } = d, n = outer.length, fIn = d.floorIn;
    const R = Math.max(...outer);
    // straight band: where the wall is within 0.1 mm of its widest
    let lo = -1, hi = -1;
    for (let k = 0; k < n; k++) if (outer[k] > R - 0.1) { if (lo < 0) lo = k; hi = k; }
    // the floor's thickness: up to where the hole's edge gives way to the inside of the wall
    let floorTop = H;
    for (let k = 0; k < n; k++) if (inner[k] > fIn + 1) { floorTop = k * step; break; }
    const outerAt = z => {
      const f = Math.min(Math.max(z / step, 0), n - 1), i = Math.floor(f), j = Math.min(i + 1, n - 1);
      return outer[i] + (outer[j] - outer[i]) * (f - i);
    };
    return { H, R, outerAt, bandLo: lo * step, bandHi: hi * step, floorIn: fIn, floorOut: d.floorOut, floorTop,
             data: { H, step, outer, inner, floorIn: fIn, floorOut: d.floorOut } };
  }
  // A boot made by spinning its profile round (outside and inside surfaces, top rim, floor ring underneath):
  // what the customer designer shows instead of the real boot. Returns a triangle list like parseStl's.
  function lathe(prof, segs = 120) {
    const { step, outer, inner } = prof.data, n = outer.length, out = [];
    const pt = (r, a, z) => [r * Math.cos(a), r * Math.sin(a), z];
    const quad = (a, b, c, d) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let s = 0; s < segs; s++) {
      const a0 = s / segs * Math.PI * 2, a1 = (s + 1) / segs * Math.PI * 2;
      for (let k = 0; k < n - 1; k++) {
        const z0 = k * step, z1 = Math.min((k + 1) * step, prof.H);
        quad(pt(outer[k], a0, z0), pt(outer[k], a1, z0), pt(outer[k + 1], a1, z1), pt(outer[k + 1], a0, z1));
        quad(pt(inner[k], a1, z0), pt(inner[k], a0, z0), pt(inner[k + 1], a0, z1), pt(inner[k + 1], a1, z1));
      }
      const zt = prof.H;
      quad(pt(inner[n - 1], a0, zt), pt(outer[n - 1], a0, zt), pt(outer[n - 1], a1, zt), pt(inner[n - 1], a1, zt));
      quad(pt(outer[0], a0, 0), pt(inner[0], a0, 0), pt(inner[0], a1, 0), pt(outer[0], a1, 0));
    }
    return new Float32Array(out);
  }

  // ---- drawing the decorations onto the unrolled wall ----
  const CELL = 0.15;                // mm per pixel / grid step for export (well under a 0.4 mm nozzle's line)
  const PREVIEW_CELL = 0.2;         // coarser for the live preview

  // A picture turned into a white-on-transparent shape (transparent PNGs use their alpha; others use darkness).
  function imageMask(img, threshold = 0.5, invert = false) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const s = Math.min(1, 1600 / Math.max(w, h));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    let hasAlpha = false;
    for (let i = 3; i < p.length; i += 4) if (p[i] < 250) { hasAlpha = true; break; }
    for (let i = 0; i < p.length; i += 4) {
      let on;
      if (hasAlpha) on = p[i + 3] / 255;
      else on = 1 - (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
      on = on > threshold ? 1 : 0;
      if (invert) on = 1 - on;
      p[i] = p[i + 1] = p[i + 2] = 255; p[i + 3] = on * 255;
    }
    g.putImageData(d, 0, 0);
    // crop to the shape
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (p[(y * c.width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }

  // Draws one text run centred on (cx, cy) in canvas pixels, letter by letter with extra spacing, and
  // returns its width. Font size is the em size in mm, like Bambu Studio's text tool. A font can carry a weight
  // ("800|Outfit"). Emotes (♥, 🐾, ⚽…; see emotes.js) are drawn from their own shapes, a bit taller than the capitals.
  function drawText(g, text, font, sizePx, gapPx, cx, cy, measureOnly) {
    const [weight, family] = String(font).includes("|") ? String(font).split("|") : ["", font];
    g.font = `${weight ? weight + " " : ""}${sizePx}px "${family}"`;
    g.textBaseline = "alphabetic";
    const m = g.measureText("H"), capH = m.actualBoundingBoxAscent || sizePx * 0.72;
    const emoSize = capH * 1.3, emoPad = capH * 0.08;
    const E = typeof Emotes !== "undefined" ? Emotes : null;
    const chars = E ? E.split(text) : [...text];
    const emo = chars.map(ch => (E ? E.find(ch) : null));
    const widths = chars.map((ch, i) => emo[i] ? emoSize + emoPad * 2 : g.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + gapPx * Math.max(0, chars.length - 1);
    if (measureOnly) return total;
    // vertical centre on the capital letters
    let x = cx - total / 2;
    chars.forEach((ch, i) => {
      if (emo[i]) E.draw(g, emo[i], x + emoPad, cy - emoSize / 2, emoSize);
      else g.fillText(ch, x, cy + capH / 2);
      x += widths[i] + gapPx;
    });
    return total;
  }

  // The wall picture for one bumper: width = once round the outside, height = the boot's height.
  // u = 0 (the middle) is the front. Returns { canvas, cell, W, H, R }.
  function wallMask(design, prof, cell) {
    const R = prof.R, W = 2 * Math.PI * R, H = prof.H;
    const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    const c = document.createElement("canvas"); c.width = cols; c.height = rows;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, cols, rows);
    g.fillStyle = "#fff";
    const pxmm = 1 / cell;
    for (const it of design.items) {
      if (it.hidden) continue;
      const rep = Math.max(1, it.repeat | 0);
      const zc = it.z;                               // mm up from the bed
      for (let k = 0; k < rep; k++) {
        const ang = (it.angle + k * 360 / rep) * Math.PI / 180;
        let u = ((ang * R) % W + W * 1.5) % W;       // 0..W, front in the middle
        const cx = u * pxmm, cy = (H - zc) * pxmm;
        for (const shift of [0, -cols, cols]) {      // draw across the seam at the back too
          if (it.type === "text") {
            drawText(g, it.text, it.font, it.size * pxmm, (it.gap || 0) * pxmm, cx + shift, cy);
          } else if (it.type === "image" && it.mask) {
            const hpx = it.size * pxmm, wpx = hpx * it.mask.width / it.mask.height;
            g.drawImage(it.mask, cx + shift - wpx / 2, cy - hpx / 2, wpx, hpx);
          }
        }
      }
    }
    return { canvas: c, cell, W, H, R };
  }

  // The floor picture, as seen from underneath (so it reads the right way round when the bumper is turned over):
  // the size label curved along the front of the floor ring, the BBz mark along the back.
  function floorMask(design, prof, cell) {
    const ro = prof.floorOut, ri = prof.floorIn, rm = (ro + ri) / 2, band = ro - ri;
    const D = 2 * ro + 2, n = Math.ceil(D / cell);
    const c = document.createElement("canvas"); c.width = n; c.height = n;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, n, n);
    g.fillStyle = "#fff";
    const pxmm = 1 / cell, ctr = n / 2;
    const size = Math.min(design.under.size || 7, band * 0.9);
    const labels = [];
    if (design.under.sizeLabel && design.under.sizeText) labels.push({ text: design.under.sizeText, at: Math.PI / 2, flip: true });
    if (design.under.mark) labels.push({ text: design.under.markText || "BBz", at: -Math.PI / 2, flip: false });
    for (const L of labels) {
      g.font = `${size * pxmm}px "${design.under.font || "Arial Black"}"`;
      const m = g.measureText("H"), capH = (m.actualBoundingBoxAscent || size * pxmm * 0.72);
      const chars = [...L.text], widths = chars.map(ch => g.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0);
      // walk along the arc; text at the bottom of the picture reads left-to-right when flipped
      let s = -total / 2;
      chars.forEach((ch, i) => {
        const mid = s + widths[i] / 2; s += widths[i];
        const a = L.at + (L.flip ? -1 : 1) * mid / (rm * pxmm);
        g.save();
        g.translate(ctr + Math.cos(a) * rm * pxmm, ctr + Math.sin(a) * rm * pxmm);
        g.rotate(a + (L.flip ? -Math.PI / 2 : Math.PI / 2));
        g.fillText(ch, -widths[i] / 2, capH / 2);
        g.restore();
      });
    }
    return { canvas: c, cell, D, n };
  }

  // ---- tracing a picture into a closed part ----
  // map(u, v, outer, dist) -> [x, y, z] places a point of the picture (u across, v up, in mm) on the outer or inner
  // skin. The (u, v, outer) directions must be a right-handed set, so the part's faces point outwards.
  // field ("up" / "down", optional) adds dist: the point's distance to the shape's edge above / below it.
  function traceToMesh(canvas, cell, map, field) {
    const cols = canvas.width, rows = canvas.height;
    const px = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, cols, rows).data;
    // node values, bottom row first (v up)
    // (outside the picture counts as empty, so shapes touching its edge, like a name across the seam at the back, still close)
    const val = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows) ? 0 : px[((rows - 1 - j) * cols + i) * 4] / 255;
    // bounding box of anything drawn
    let i0 = cols, i1 = -1, j0 = rows, j1 = -1;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (px[(y * cols + x) * 4] > 8) {
      if (x < i0) i0 = x; if (x > i1) i1 = x; const j = rows - 1 - y; if (j < j0) j0 = j; if (j > j1) j1 = j;
    }
    if (i1 < 0) return null;
    i0 -= 1; j0 -= 1; i1 += 1; j1 += 1;
    const w = i1 - i0 + 1, h = j1 - j0 + 1;
    const V = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) V[j * w + i] = val(i0 + i, j0 + j);
    const T = 0.5;
    // field "up" / "down": how far (mm) each point inside the shape is from the shape's edge straight above / below it,
    // handed to map() so a part can slope at its top or bottom edges (Infinity when there's no field)
    const D = new Float32Array(w * h).fill(field ? 0 : Infinity);
    if (field) {
      const step = field === "up" ? -1 : 1;
      for (let i = 0; i < w; i++) {
        let edge = null;                           // where the shape's edge crosses this column, in node rows
        for (let j = field === "up" ? h - 1 : 0; j >= 0 && j < h; j += step) {
          const a = V[j * w + i];
          if (a < T) { edge = null; continue; }
          if (edge === null) {
            const jo = j - step, b = (jo >= 0 && jo < h) ? V[jo * w + i] : 0;
            edge = j - step * Math.min(Math.max((a - T) / (a - b), 0), 1);
          }
          D[j * w + i] = Math.abs(edge - j) * cell;
        }
      }
    }
    // 2D points get two 3D vertices each (outer, inner); keyed by what they sit on
    const verts = [], tris = [];
    const idx = new Map();
    const point = (key, u, v, dist) => {
      let id = idx.get(key);
      if (id === undefined) {
        id = verts.length / 3;
        verts.push(...map(u, v, true, dist), ...map(u, v, false, dist));
        idx.set(key, id);
      }
      return id;          // id = outer, id + 1 = inner
    };
    const nodeKey = (i, j) => (j * w + i) * 4;
    const nodePt = (i, j) => point(nodeKey(i, j), (i0 + i + 0.5) * cell, (j0 + j + 0.5) * cell, D[j * w + i]);
    // edge kinds: 1 = right, 2 = up, 3 = diagonal up-right (from node (i, j))
    const edgePt = (ia, ja, ib, jb) => {
      // keep the key independent of direction
      if (jb < ja || (jb === ja && ib < ia)) { [ia, ja, ib, jb] = [ib, jb, ia, ja]; }
      const kind = jb === ja ? 1 : ib === ia ? 2 : 3;
      const a = V[ja * w + ia], b = V[jb * w + ib];
      const f = Math.min(Math.max((T - a) / (b - a), 0.001), 0.999);
      const u = (i0 + ia + 0.5 + (ib - ia) * f) * cell, v = (j0 + ja + 0.5 + (jb - ja) * f) * cell;
      // on the outline: the inside end's distance, less however far this point is from it towards the edge
      // (a point on a letter's side keeps its full distance; one on its top or bottom edge gets about 0)
      let dist = Infinity;
      if (field) {
        const [ii, ji] = a >= T ? [ia, ja] : [ib, jb];
        const dv = v - (j0 + ji + 0.5) * cell;
        dist = Math.max(0, D[ji * w + ii] + (field === "up" ? -dv : dv));
      }
      return point(nodeKey(ia, ja) + kind, u, v, dist);
    };
    const pushTri = (a, b, c) => { tris.push(a, b, c, c + 1, b + 1, a + 1); };      // outer skin + inner skin (flipped)
    const pushSide = (a, b) => { tris.push(a + 1, b + 1, b, a + 1, b, a); };        // A -> B with the shape on the left
    // one grid triangle (corners counter-clockwise)
    const doTri = (c) => {
      const inside = c.map(([i, j]) => V[j * w + i] >= T);
      const nIn = inside.filter(Boolean).length;
      if (nIn === 0) return;
      if (nIn === 3) { pushTri(nodePt(...c[0]), nodePt(...c[1]), nodePt(...c[2])); return; }
      const poly = []; let cutA = -1;
      for (let k = 0; k < 3; k++) {
        const p = c[k], q = c[(k + 1) % 3];
        if (inside[k]) poly.push(nodePt(...p));
        if (inside[k] !== inside[(k + 1) % 3]) {
          const e = edgePt(p[0], p[1], q[0], q[1]);
          if (inside[k]) cutA = poly.length;        // leaving the shape here
          poly.push(e);
        }
      }
      if (poly.length === 3) pushTri(poly[0], poly[1], poly[2]);
      else { pushTri(poly[0], poly[1], poly[2]); pushTri(poly[0], poly[2], poly[3]); }
      // the outline runs from the "leaving" crossing to the "entering" one (polygon order), shape on the left
      const leave = poly[cutA], enter = poly[(cutA + 1) % poly.length];
      pushSide(leave, enter);
    };
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
      doTri([[i, j], [i + 1, j], [i + 1, j + 1]]);
      doTri([[i, j], [i + 1, j + 1], [i, j + 1]]);
    }
    if (!tris.length) return null;
    return { verts: new Float32Array(verts), tris: new Uint32Array(tris) };
  }

  // ---- the parts for one bumper ----
  // design: { items: [...], style: "engrave" | "inlay" | "emboss", depth, angled, sink, under: {...} }
  // Returns { wall, floor } meshes in the boot's coordinates (centred, sitting on the bed).
  function buildParts(design, prof, cell = CELL) {
    const out = { wall: null, floor: null };
    const wm = wallMask(design, prof, cell);
    const d = design.depth;
    // how far in and out the wall part goes from the boot's skin
    // (raised names sink 0.4 mm into the wall so they join it; cuts and colour changes poke out a little past the skin)
    const [inD, outD] = design.style === "emboss" ? [0.4, d] : [d, design.style === "inlay" ? 0.3 : 0.6];
    const W = wm.W;
    // Angled overhangs (2026-11-02, the user's stringing fix): on a standing wall the top of an engraved letter and the
    // underside of a raised one are flat overhangs that string and sag. With this on, the cut gets shallower towards
    // each letter's top edge and the raised letter thinner towards its bottom edge, 1 mm per mm (45°), so every layer
    // sits on the one below. Two-colour names are flush and solid, so they don't need it.
    const angled = design.angled && design.style !== "inlay";
    const field = angled ? (design.style === "emboss" ? "down" : "up") : null;
    out.wall = traceToMesh(wm.canvas, cell, (u, v, outer, dist) => {
      const z = wm.H - (wm.canvas.height * cell - v);          // picture rows are rounded up
      let off = outer ? outD : -inD;
      if (angled && design.style === "engrave" && !outer) off = -Math.min(inD, dist);
      if (angled && design.style === "emboss" && outer) off = Math.min(outD, dist);
      const r = prof.outerAt(Math.max(0, z)) + off;
      const a = (u - W / 2) / prof.R;
      return [r * Math.sin(a), -r * Math.cos(a), z];
    }, field);
    if (design.under && (design.under.sizeLabel || design.under.mark)) {
      const fm = floorMask(design, prof, cell);
      const depth = design.under.depth || 0.8, half = fm.n * cell / 2, sink = design.sink || 0;
      // seen from below: across = -x, up = +y, "outer" = below the bed. When the boot is sunk into the bed, its printed
      // bottom is `sink` mm up, so the cut starts there.
      out.floor = traceToMesh(fm.canvas, cell, (u, v, outer) => [-(u - half), (v - half), sink + (outer ? -0.4 : depth)]);
    }
    return out;
  }

  return { parseStl, weld, profile, makeProfile, lathe, buildParts, traceToMesh, wallMask, floorMask, imageMask, drawText, CELL, PREVIEW_CELL };
})();
