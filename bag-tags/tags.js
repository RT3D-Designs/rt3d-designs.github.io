// Bag tag shapes (2026-11-03), shared by Tag Studio and the customer bag-tag designer.
// A tag is two flat layers: the backing (filament 1) and the raised letters and emotes on top (filament 2).
// Both are drawn as pictures (white on black, in mm through a scaled canvas), then traced into closed parts by the
// shared engine (Engine.traceToMesh), exactly like the bumper names, just flat instead of wrapped.
//  - name-shaped: the backing is the name grown outwards by a margin (the letters' picture stamped round in rings),
//    plus a tab at the left for the ring hole or strap slot (like the user's LAILA tag)
//  - fixed shapes: luggage tag, rectangle, round, shield, heart, with up to two lines and a raised rim
// Attachments: key (5 mm hole for a split keyring), clip (8 mm, carabiner), tie (4 mm, cable tie), slot (strap slot),
// loop (built-in TPU strap with a mushroom stud that pops through a hole near its root). The loop is Frank's coupon design
// (Fusion doc Bag_Tag_TPU_Loop): buyers can't pick it until the print is proven (LOOP_READY in app.js and designer.js).
"use strict";

const Tags = (() => {
  const SIZES = { S: { len: 70, cap: 11, h: 38, d: 50 }, M: { len: 100, cap: 15, h: 52, d: 64 }, L: { len: 130, cap: 19, h: 66, d: 80 } };
  const HOLES = { key: 5, clip: 8, tie: 4 };
  const T_BACK = 2.4, T_FRONT = 1.2;               // backing thickness, raised letters (mm)
  // the built-in loop, from Frank's coupon (hole_d is the middle size until the test print picks one)
  const LOOP = { len: 110, w: 12, rootR: 3, holeInset: 10, holeD: 5, studInset: 6, neckD: 5, neckH: 2.6, headD: 8, headRim: 0.8, tipD: 5 };
  const LABELS = {
    shapes: { name: "Name-shaped", luggage: "Luggage tag", rect: "Rectangle", round: "Round", shield: "Shield", heart: "Heart" },
    attach: { key: "Keyring hole", clip: "Clip hole", tie: "Cable-tie hole", slot: "Strap slot", loop: "Built-in TPU loop" },
  };
  const HEART = "M12 21.2C7.4 17.6 2.5 13.6 2.5 8.9 2.5 5.9 4.8 3.6 7.6 3.6c1.8 0 3.4.9 4.4 2.4 1-1.5 2.6-2.4 4.4-2.4 2.8 0 5.1 2.3 5.1 5.3 0 4.7-4.9 8.7-9.5 12.3z";

  const canvasMm = (wmm, hmm, cell) => {
    const c = document.createElement("canvas"); c.width = Math.ceil(wmm / cell); c.height = Math.ceil(hmm / cell);
    const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#fff";
    g.scale(1 / cell, 1 / cell);                                   // draw in mm from here on
    return { c, g };
  };
  const measure = (text, font, em, gap) => Engine.drawText(document.createElement("canvas").getContext("2d"), text, font, em, gap, 0, 0, true);
  // the slot / hole shapes, as Path2D in mm
  const circlePath = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; };
  const roundRect = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); return p; };
  // what the attachment needs: a tab size and the cut-out (centred on (0, 0); vertical = slot runs up/down)
  function attachment(a, cap, vertical = true) {
    if (a === "loop") return { w: 0, h: LOOP.w + 2 * LOOP.rootR, loop: true };
    if (HOLES[a]) { const d = HOLES[a], r = d / 2 + 3.4; return { w: r * 2, h: r * 2, tab: (x, y) => circlePath(x, y, r), cut: (x, y) => circlePath(x, y, d / 2), loop: false }; }
    const len = Math.min(26, Math.max(14, cap * 1.6)), sw = 4.6;
    const [w, h] = vertical ? [sw + 7.5, len + 7.5] : [len + 7.5, sw + 7.5];
    return { w, h, tab: (x, y) => roundRect(x - w / 2, y - h / 2, w, h, 5), cut: (x, y) => vertical ? roundRect(x - sw / 2, y - len / 2, sw, len, sw / 2) : roundRect(x - len / 2, y - sw / 2, len, sw, sw / 2), loop: a === "loop" };
  }
  // the strap on the backing, running left (or up) from its root at (x, y), flared into the tag so the root doesn't tear.
  // Returns where the stud goes.
  function drawStrap(g, x, y, up, inset) {
    const { len, w, rootR: r, holeInset, holeD, studInset } = LOOP, hw = w / 2, p = new Path2D();
    p.moveTo(inset, -hw - r); p.lineTo(0, -hw - r); p.quadraticCurveTo(0, -hw, -r, -hw); p.lineTo(-len + hw, -hw);
    p.arc(-len + hw, 0, hw, -Math.PI / 2, Math.PI / 2, true);
    p.lineTo(-r, hw); p.quadraticCurveTo(0, hw, 0, hw + r); p.lineTo(inset, hw + r); p.closePath();
    g.save(); g.translate(x, y); if (up) g.rotate(Math.PI / 2);
    g.fill(p);
    g.globalCompositeOperation = "destination-out"; g.fill(circlePath(-holeInset, 0, holeD / 2));
    g.restore();
    return up ? { x, y: y - len + studInset } : { x: x - len + studInset, y };
  }
  // the stud, standing on the strap (it starts a little inside the strap so the two fuse), as a closed mesh
  function studMesh(x, y) {
    const { neckD, neckH, headD, headRim, tipD } = LOOP, under = (headD - neckD) / 2, lead = (headD - tipD) / 2, n = 48;
    const z0 = T_BACK + neckH, ring = [[neckD / 2, T_BACK - 0.4], [neckD / 2, z0], [headD / 2, z0 + under], [headD / 2, z0 + under + headRim], [tipD / 2, z0 + under + headRim + lead]];
    const verts = [x, y, ring[0][1], x, y, ring[ring.length - 1][1]], tris = [], at = (i, j) => 2 + i * n + ((j + n) % n);
    for (const [r, z] of ring) for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; verts.push(x + r * Math.cos(a), y + r * Math.sin(a), z); }
    for (let j = 0; j < n; j++) {
      tris.push(0, at(0, j + 1), at(0, j), 1, at(ring.length - 1, j), at(ring.length - 1, j + 1));
      for (let i = 0; i < ring.length - 1; i++) tris.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i + 1, j));
    }
    return { verts, tris, top: ring[ring.length - 1][1] };
  }
  // grow a white picture outwards by r mm (stamping it round in rings): the name-shaped tag's outline
  function grow(src, dst, rPx) {
    const g = dst.getContext("2d"); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "lighten";
    for (let rr = rPx; rr > 0; rr -= Math.max(1.5, rPx / 5)) {
      const n = Math.max(12, Math.ceil(Math.PI * 2 * rr / 1.5));
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.drawImage(src, Math.cos(a) * rr, Math.sin(a) * rr); }
    }
    g.drawImage(src, 0, 0); g.restore();
  }
  function shapePath(shape, w, h) {
    if (shape === "round") return circlePath(w / 2, h / 2, w / 2);
    if (shape === "rect") return roundRect(0, 0, w, h, Math.min(w, h) * 0.14);
    if (shape === "luggage") {
      const p = new Path2D(), c = h * 0.28, r = Math.min(w, h) * 0.12;
      p.moveTo(c, 0); p.lineTo(w - r, 0); p.quadraticCurveTo(w, 0, w, r); p.lineTo(w, h - r); p.quadraticCurveTo(w, h, w - r, h);
      p.lineTo(c, h); p.lineTo(0, h - c); p.lineTo(0, c); p.closePath(); return p;
    }
    if (shape === "shield") {
      const p = new Path2D();
      p.moveTo(w * 0.5, 0); p.quadraticCurveTo(w * 0.78, h * 0.08, w, h * 0.08); p.lineTo(w, h * 0.45);
      p.quadraticCurveTo(w * 0.95, h * 0.82, w * 0.5, h); p.quadraticCurveTo(w * 0.05, h * 0.82, 0, h * 0.45); p.lineTo(0, h * 0.08);
      p.quadraticCurveTo(w * 0.22, h * 0.08, w * 0.5, 0); p.closePath(); return p;
    }
    const p = new Path2D(); p.addPath(new Path2D(HEART), new DOMMatrix().scale(w / 19.2, h / 17.6).translate(-2.4, -3.6)); return p;   // heart
  }
  // where the text goes on a fixed shape (x, y, w, h in mm)
  function textBox(shape, w, h, att) {
    if (shape === "luggage" || shape === "rect") { const x0 = att.w + 6; return { x: x0, y: h * 0.12, w: w - x0 - 5, h: h * 0.76 }; }
    if (shape === "round") return { x: w * 0.16, y: h * 0.25, w: w * 0.68, h: h * 0.5 };
    if (shape === "shield") return { x: w * 0.16, y: h * 0.18, w: w * 0.68, h: h * 0.46 };
    return { x: w * 0.2, y: h * 0.2, w: w * 0.6, h: h * 0.36 };     // heart
  }

  // tag: { s, z, c, k, a, l: [{ x, font }] } (font = engine font string, e.g. "Arial Black" or "700|Outfit")
  // returns { back, front, cell, w, h (mm), warn: [...], loop }
  function layout(tag, cell) {
    const S = SIZES[tag.z] || SIZES.M, warn = [], gap = 0.3;
    const lines = tag.l.filter(l => l.x && l.x.trim());
    if (tag.s === "name") {
      const line = lines[0] || { x: "NAME", font: "Arial Black" };
      const att = attachment(tag.a, S.cap, true);
      let em = S.cap / 0.72, tw = measure(line.x, line.font, em, gap);
      const margin = Math.max(2.6, S.cap * 0.24), avail = S.len - 2 * margin - att.w * 0.7;
      if (tw > avail) { em *= avail / tw; tw = avail; }
      const cap = em * 0.72;
      if (cap < 6) warn.push(`"${line.x}" is long for size ${tag.z}: the letters come out ${cap.toFixed(1)} mm tall. Try a bigger size.`);
      const pad = 1.5, H = Math.max(cap * 1.45 + 2 * margin, att.h) + 2 * pad;
      const strap = att.loop ? LOOP.len : 0, tabX = pad + strap + att.w / 2, textX = pad + strap + att.w * 0.7 + margin + tw / 2, W = textX + tw / 2 + margin + pad, cy = H / 2;
      const front = canvasMm(W, H, cell);
      Engine.drawText(front.g, line.x, line.font, em, gap, textX, cy);
      const back = canvasMm(W, H, cell);
      grow(front.c, back.c, margin / cell);
      // a spine along the middle of the name, so spaces and emotes never leave a separate piece (it hides behind
      // the letters and shows only as a bridge across gaps)
      back.g.fillRect(textX - tw / 2, cy - cap * 0.22, tw, cap * 0.44);
      if (att.loop) {
        const stud = drawStrap(back.g, pad + strap, cy, false, margin + 2);
        return { back: back.c, front: front.c, cell, w: W, h: H, warn, loop: true, stud };
      }
      back.g.fill(att.tab(tabX, cy));
      back.g.fillRect(tabX, cy - cap * 0.35, textX - tw / 2 - tabX + 1, cap * 0.7);       // joins the tab to the name
      back.g.globalCompositeOperation = "destination-out"; back.g.fill(att.cut(tabX, cy)); back.g.globalCompositeOperation = "source-over";
      return { back: back.c, front: front.c, cell, w: W, h: H, warn, loop: false };
    }
    // fixed shapes
    const round = ["round", "shield", "heart"].includes(tag.s);
    const w = tag.s === "luggage" || tag.s === "rect" ? S.len : tag.s === "shield" ? S.d * 0.86 : tag.s === "heart" ? S.d * 1.08 : S.d;
    const h = tag.s === "luggage" || tag.s === "rect" ? S.h : S.d;
    const att = attachment(tag.a, S.cap, !round);
    // a strap's root starts just inside the outline, so its flare lands on the tag: past the heart's dip, under the
    // shield's point, or where the circle has curved away by the flare's width
    const flare = LOOP.w / 2 + LOOP.rootR;
    const rootDepth = !att.loop || !round ? 0 : tag.s === "heart" ? h * 0.136 + 1 : tag.s === "shield" ? 3 : h / 2 - Math.sqrt(h * h / 4 - flare * flare);
    const pad = 1.5, strap = att.loop ? LOOP.len : 0;
    const top = round ? (att.loop ? strap - rootDepth : att.h * 0.62) : 0;   // round shapes get the tab or strap on top
    const W = w + 2 * pad + (round ? 0 : strap), H = h + top + 2 * pad, ox = pad + (round ? 0 : strap), oy = pad + top;
    const back = canvasMm(W, H, cell), front = canvasMm(W, H, cell);
    const path = shapePath(tag.s, w, h);
    back.g.save(); back.g.translate(ox, oy); back.g.fill(path); back.g.restore();
    const ax = round ? ox + w / 2 : ox + att.w / 2 + 3.5, ay = round ? pad + att.h / 2 : oy + h / 2;
    if (round && !att.loop) { back.g.fill(att.tab(ax, ay)); back.g.fillRect(ax - att.w * 0.3, ay, att.w * 0.6, top + h * 0.08); }
    // raised rim, 1.4 mm wide, 2 mm in from the edge (the shape scaled about its middle)
    const inset = 2.6, sx = (w - 2 * inset) / w, sy = (h - 2 * inset) / h;
    front.g.save(); front.g.translate(ox + w / 2, oy + h / 2); front.g.scale(sx, sy); front.g.translate(-w / 2, -h / 2);
    front.g.strokeStyle = "#fff"; front.g.lineWidth = 1.4 / Math.min(sx, sy); front.g.lineJoin = "round"; front.g.stroke(path); front.g.restore();
    // the text
    const box = textBox(tag.s, w, h, round ? { w: 0 } : att);
    const caps = lines.length > 1 ? [box.h * 0.42, box.h * 0.28] : [box.h * 0.5];
    const heights = lines.slice(0, 2).map((l, i) => {
      let em = caps[i] / 0.72; const tw = measure(l.x, l.font, em, gap);
      if (tw > box.w) em *= box.w / tw;
      if (em * 0.72 < 5) warn.push(`"${l.x}" is long for this tag: try a bigger size or shorter text.`);
      return em;
    });
    const total = heights.reduce((s, em) => s + em * 0.72, 0) + (heights.length > 1 ? box.h * 0.12 : 0);
    let y = oy + box.y + (box.h - total) / 2;
    lines.slice(0, 2).forEach((l, i) => { const capH = heights[i] * 0.72; Engine.drawText(front.g, l.x, l.font, heights[i], gap, ox + box.x + box.w / 2, y + capH / 2); y += capH + box.h * 0.12; });
    if (att.loop) {
      const stud = round ? drawStrap(back.g, ox + w / 2, oy + rootDepth, true, 2) : drawStrap(back.g, ox, oy + h / 2, false, 2);
      return { back: back.c, front: front.c, cell, w: W, h: H, warn, loop: true, stud };
    }
    // holes go through both layers
    for (const g of [back.g, front.g]) { g.globalCompositeOperation = "destination-out"; g.fill(att.cut(ax, ay)); g.globalCompositeOperation = "source-over"; }
    // the rim must stay clear of the hole area too: blank the front around the attachment
    front.g.globalCompositeOperation = "destination-out"; front.g.fill(att.tab(ax, ay)); front.g.globalCompositeOperation = "source-over";
    return { back: back.c, front: front.c, cell, w: W, h: H, warn, loop: false };
  }

  // ---- flat parts ----
  // Engine.traceToMesh makes a triangle per pixel, right for curved bumpers but millions of triangles on a flat tag.
  // Flat parts only need their outline: follow the picture's edges into loops (solid on the left, so outers run
  // anticlockwise and holes clockwise), thin the loops, fill top and bottom with earcut and join them with a wall.
  function contours(canvas, cell) {
    const cols = canvas.width, rows = canvas.height;
    const px = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, cols, rows).data;
    const w = cols + 2, h = rows + 2, V = new Float32Array(w * h), T = 0.5;   // one empty node all round, bottom row first
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) V[(j + 1) * w + i + 1] = px[((rows - 1 - j) * cols + i) * 4] / 255;
    const hEdge = (i, j) => (j * w + i) * 2, vEdge = (i, j) => (j * w + i) * 2 + 1;
    const next = new Map();
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
      const a = V[j * w + i], b = V[j * w + i + 1], c = V[(j + 1) * w + i + 1], d = V[(j + 1) * w + i];
      const m = (a >= T ? 1 : 0) | (b >= T ? 2 : 0) | (c >= T ? 4 : 0) | (d >= T ? 8 : 0);
      if (m === 0 || m === 15) continue;
      const B = hEdge(i, j), R = vEdge(i + 1, j), U = hEdge(i, j + 1), L = vEdge(i, j), mid = (a + b + c + d) / 4 >= T;
      const seg = { 1: [[B, L]], 2: [[R, B]], 3: [[R, L]], 4: [[U, R]], 6: [[U, B]], 7: [[U, L]], 8: [[L, U]], 9: [[B, U]], 11: [[R, U]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]],
        5: mid ? [[B, R], [U, L]] : [[B, L], [U, R]], 10: mid ? [[L, B], [R, U]] : [[R, B], [L, U]] }[m];
      for (const [from, to] of seg) next.set(from, to);
    }
    const point = e => {                                     // where the edge crosses the threshold, in mm
      const n = e >> 1, i = n % w, j = (n - i) / w, a = V[n], b = e & 1 ? V[n + w] : V[n + 1], t = Math.min(Math.max((T - a) / (b - a), 0), 1);
      return e & 1 ? [(i - 0.5) * cell, (j - 0.5 + t) * cell] : [(i - 0.5 + t) * cell, (j - 0.5) * cell];
    };
    const loops = [];
    for (const start of next.keys()) {
      if (!next.has(start)) continue;
      const loop = []; let e = start;
      while (next.has(e)) { const to = next.get(e); next.delete(e); loop.push(point(e)); e = to; }
      loops.push(loop);
    }
    return loops;
  }
  const area2 = p => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return s; };   // twice the signed area
  const inside = (pt, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > pt[1]) !== (p[j][1] > pt[1]) && pt[0] < (p[j][0] - p[i][0]) * (pt[1] - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
  // Douglas-Peucker on a closed loop, split at the point furthest from the first
  function thin(loop, tol) {
    let far = 0, best = -1;
    loop.forEach((q, i) => { const d = (q[0] - loop[0][0]) ** 2 + (q[1] - loop[0][1]) ** 2; if (d > best) { best = d; far = i; } });
    const keep = new Uint8Array(loop.length); keep[0] = keep[far] = 1;
    const stack = [[0, far], [far, loop.length]];
    while (stack.length) {
      const [s, e] = stack.pop(); if (e - s < 2) continue;
      const A = loop[s], Z = loop[e % loop.length], dx = Z[0] - A[0], dy = Z[1] - A[1], len = Math.hypot(dx, dy) || 1e-9;
      let at = -1, top = tol;
      for (let i = s + 1; i < e; i++) { const d = Math.abs(dx * (loop[i][1] - A[1]) - dy * (loop[i][0] - A[0])) / len; if (d > top) { top = d; at = i; } }
      if (at >= 0) { keep[at] = 1; stack.push([s, at], [at, e]); }
    }
    return loop.filter((_, i) => keep[i]);
  }
  // every edge must be matched by its opposite, or the part isn't closed
  function isClosed(tris) {
    const seen = new Map(), N = 1 << 26;
    const add = (a, b) => { const k = a * N + b, r = b * N + a, o = seen.get(r) || 0; if (o) { if (o === 1) seen.delete(r); else seen.set(r, o - 1); } else seen.set(k, (seen.get(k) || 0) + 1); };
    for (let t = 0; t < tris.length; t += 3) { add(tris[t], tris[t + 1]); add(tris[t + 1], tris[t + 2]); add(tris[t + 2], tris[t]); }
    return seen.size === 0;
  }
  function flatMesh(canvas, cell, toXY, z0, z1) {
    const raw = contours(canvas, cell);
    for (const tol of [cell * 0.25, cell * 0.12, cell * 0.05]) {
      const loops = raw.map(l => thin(l, tol)).filter(l => l.length >= 3 && Math.abs(area2(l)) > 0.04);
      if (!loops.length) return null;
      const outers = loops.filter(l => area2(l) > 0).map(l => ({ l, a: area2(l), holes: [] })).sort((p, q) => p.a - q.a);
      for (const hole of loops.filter(l => area2(l) < 0)) { const o = outers.find(o => inside(hole[0], o.l)); if (o) o.holes.push(hole); }
      const verts = [], tris = [];
      for (const o of outers) {
        const all = [o.l, ...o.holes], base = verts.length / 3, flat = [], holeAt = [];
        for (const l of all) { if (l !== o.l) holeAt.push(flat.length / 2); for (const p of l) flat.push(p[0], p[1]); }
        // two vertices per point: odd = top
        for (let i = 0; i < flat.length; i += 2) { const [x, y] = toXY(flat[i], flat[i + 1]); verts.push(x, y, z0, x, y, z1); }
        const cap = earcut(flat, holeAt);
        let sum = 0;
        for (let t = 0; t < cap.length; t += 3) { const [a, b, c] = [cap[t], cap[t + 1], cap[t + 2]]; sum += (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[c * 2] - flat[a * 2]) * (flat[b * 2 + 1] - flat[a * 2 + 1]); }
        for (let t = 0; t < cap.length; t += 3) {
          const [a, b, c] = sum > 0 ? [cap[t], cap[t + 1], cap[t + 2]] : [cap[t], cap[t + 2], cap[t + 1]];
          tris.push(base + a * 2 + 1, base + b * 2 + 1, base + c * 2 + 1, base + a * 2, base + c * 2, base + b * 2);
        }
        let start = 0;
        for (const l of all) {
          for (let i = 0; i < l.length; i++) {
            const p = base + (start + i) * 2, q = base + (start + (i + 1) % l.length) * 2;
            tris.push(p, q, q + 1, p, q + 1, p + 1);
          }
          start += l.length;
        }
      }
      if (isClosed(tris)) return { verts, tris };
    }
    // earcut left a gap (very rare): the per-pixel trace is heavy but always closed
    const zs = (u, v, outer) => { const [x, y] = toXY(u, v); return [x, y, outer ? z1 : z0]; };
    return Engine.traceToMesh(canvas, cell, zs);
  }

  // the two parts as closed meshes, centred on (0, 0), sitting on the bed: backing 0–2.4 mm, letters 2.4–3.6 mm
  function parts(tag, cell = 0.1) {
    const L = layout(tag, cell);
    const toXY = c => (u, v) => [u - L.w / 2, v - (c.height * cell - L.h) - L.h / 2];
    const back = flatMesh(L.back, cell, toXY(L.back), 0, T_BACK);
    const front = flatMesh(L.front, cell, toXY(L.front), T_BACK, T_BACK + T_FRONT);
    const stud = L.stud ? studMesh(L.stud.x - L.w / 2, L.h / 2 - L.stud.y) : null;
    return { back, front, stud, w: L.w, h: L.h, height: stud ? stud.top : T_BACK + T_FRONT, warn: L.warn, loop: L.loop };
  }
  // indexed meshes as one plain triangle list (for the 3D view); missing ones are skipped
  const soup = (...meshes) => {
    const list = meshes.filter(Boolean), out = new Float32Array(list.reduce((n, m) => n + m.tris.length * 3, 0)); let at = 0;
    for (const m of list) for (const v of m.tris) { out[at++] = m.verts[v * 3]; out[at++] = m.verts[v * 3 + 1]; out[at++] = m.verts[v * 3 + 2]; }
    return out;
  };

  return { SIZES, HOLES, LOOP, LABELS, T_BACK, T_FRONT, layout, parts, soup, isClosed };
})();
