// Bumper Studio emotes (2026-11-03): a curated set of simple filled shapes that can go in a name line, shared by the app
// and the customer designer so a heart looks (and prints) the same everywhere, whatever phone or font. Each emote is
// typed as its own character (♥, 🐾, ⚽…); when a name is drawn, those characters are drawn from these shapes instead of
// the font. Shapes live on a 24 × 24 grid and are made of layers that are filled together; a layer's holes use evenodd.
"use strict";

const Emotes = (() => {
  const TAU = Math.PI * 2, rad = d => d * Math.PI / 180;
  // building blocks (each adds a closed shape to a Path2D)
  const circle = (p, x, y, r) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); };
  const ellipse = (p, x, y, rx, ry, rot = 0) => { p.moveTo(x + rx * Math.cos(rad(rot)), y + rx * Math.sin(rad(rot))); p.ellipse(x, y, rx, ry, rad(rot), 0, TAU); };
  const poly = (p, pts) => { p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath(); };
  // a bar from (x1, y1) to (x2, y2), w wide
  const bar = (p, x1, y1, x2, y2, w) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
    poly(p, [x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny]);
  };
  // a curved band between two radii, from angle a0 to a1 (degrees, clockwise on screen)
  const band = (p, x, y, rOut, rIn, a0, a1) => {
    p.moveTo(x + rOut * Math.cos(rad(a0)), y + rOut * Math.sin(rad(a0)));
    p.arc(x, y, rOut, rad(a0), rad(a1)); p.arc(x, y, rIn, rad(a1), rad(a0), true); p.closePath();
  };
  const star = (p, x, y, R, r, n = 5, rot = -90) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = rad(rot + i * 180 / n), q = i % 2 ? r : R; pts.push(x + q * Math.cos(a), y + q * Math.sin(a)); }
    poly(p, pts);
  };
  const HEART = "M12 21.2C7.4 17.6 2.5 13.6 2.5 8.9 2.5 5.9 4.8 3.6 7.6 3.6c1.8 0 3.4.9 4.4 2.4 1-1.5 2.6-2.4 4.4-2.4 2.8 0 5.1 2.3 5.1 5.3 0 4.7-4.9 8.7-9.5 12.3z";
  const at = (d, m) => { const p = new Path2D(); p.addPath(new Path2D(d), m); return p; };
  const layer = (fn, rule = "nonzero") => { const p = new Path2D(); fn(p); return { p, rule }; };

  // name, the characters that mean it (the first is what gets typed), and its layers
  const LIST = [
    ["Heart", "♥ ❤ 💖 💗 💕 💓 💘 💝", () => [{ p: new Path2D(HEART), rule: "nonzero" }]],
    ["Heart outline", "♡ 🤍", () => { const p = new Path2D(HEART); p.addPath(new Path2D(HEART), new DOMMatrix().translate(12, 12.6).scale(0.58).translate(-12, -12.6)); return [{ p, rule: "evenodd" }]; }],
    ["Star", "★ ⭐ 🌟", () => [layer(p => star(p, 12, 13, 11, 4.5))]],
    ["Star outline", "☆", () => [layer(p => { star(p, 12, 13, 11, 4.5); star(p, 12, 13.4, 6.4, 2.6); }, "evenodd")]],
    ["Sparkle", "✦ ✨ ✧", () => [{ p: new Path2D("M12 1Q13.3 10.7 23 12Q13.3 13.3 12 23Q10.7 13.3 1 12Q10.7 10.7 12 1z"), rule: "nonzero" }]],
    ["Paw", "🐾 🐕 🐶", () => [layer(p => { ellipse(p, 12, 16.4, 5.6, 4.6); circle(p, 4.9, 10.8, 2.3); circle(p, 9, 6.4, 2.4); circle(p, 15, 6.4, 2.4); circle(p, 19.1, 10.8, 2.3); })]],
    ["Flower", "✿ 🌸 🌼 ❀ 🌺", () => [layer(p => { for (let i = 0; i < 5; i++) { const a = rad(-90 + i * 72); circle(p, 12 + 5.4 * Math.cos(a), 12 + 5.4 * Math.sin(a), 4.4); } circle(p, 12, 12, 3.4); })]],
    ["Sun", "☀ 🌞 ☼", () => [layer(p => { circle(p, 12, 12, 5.2); for (let i = 0; i < 8; i++) { const a = rad(i * 45); const c = Math.cos(a), s = Math.sin(a); poly(p, [12 + 7 * c - 1.5 * s, 12 + 7 * s + 1.5 * c, 12 + 11.5 * c, 12 + 11.5 * s, 12 + 7 * c + 1.5 * s, 12 + 7 * s - 1.5 * c]); } })]],
    ["Moon", "☾ 🌙 ☽", () => [{ p: new Path2D("M15 2.5A10 10 0 1 0 22 18.6 8 8 0 0 1 15 2.5z"), rule: "nonzero" }]],
    ["Cloud", "☁ ⛅", () => [layer(p => { circle(p, 7.4, 14.2, 4.6); circle(p, 12.8, 10.4, 5.8); circle(p, 17.6, 14.4, 4.2); poly(p, [7.4, 18.8, 7.4, 14, 17.6, 14, 17.6, 18.6]); })]],
    ["Snowflake", "❄ ❅ ❆", () => [layer(p => {
      for (let i = 0; i < 3; i++) { const a = rad(90 + i * 60); bar(p, 12 - 10.5 * Math.cos(a), 12 - 10.5 * Math.sin(a), 12 + 10.5 * Math.cos(a), 12 + 10.5 * Math.sin(a), 2); }
      for (let i = 0; i < 6; i++) { const a = rad(-90 + i * 60), mx = 12 + 6.6 * Math.cos(a), my = 12 + 6.6 * Math.sin(a);
        for (const s of [-1, 1]) { const b = a + s * rad(140); bar(p, mx, my, mx + 3.6 * Math.cos(b + Math.PI), my + 3.6 * Math.sin(b + Math.PI), 1.8); } }
    })]],
    ["Lightning", "⚡ ϟ", () => [layer(p => poly(p, [14, 1.5, 4.5, 13.5, 11, 13.5, 9.5, 22.5, 19.5, 9.5, 13, 9.5, 15.5, 1.5]))]],
    ["Music note", "♪ 🎵", () => [layer(p => { ellipse(p, 8.4, 18.2, 3.8, 2.8, -20); poly(p, [10.6, 18, 10.6, 3.5, 12.6, 3.5, 12.6, 18]); }), { p: new Path2D("M12.6 3.5c2.6 1.1 6.4 2.6 5.8 7.2-1.3-2.1-3.4-2.9-5.8-2.7z"), rule: "nonzero" }]],
    ["Music notes", "♫ 🎶 ♬", () => [layer(p => { ellipse(p, 6.4, 18.6, 3.2, 2.4, -20); ellipse(p, 16.4, 16.6, 3.2, 2.4, -20); poly(p, [8.3, 18.4, 8.3, 6.4, 10.1, 6.4, 10.1, 18.4]); poly(p, [18.3, 16.4, 18.3, 4.4, 20.1, 4.4, 20.1, 16.4]); poly(p, [8.3, 6.4, 20.1, 3.4, 20.1, 6.6, 8.3, 9.6]); })]],
    ["Crown", "♛ 👑 ♕", () => [layer(p => { poly(p, [3, 18, 1.8, 7.2, 7.6, 11.8, 12, 4.2, 16.4, 11.8, 22.2, 7.2, 21, 18]); poly(p, [3, 19.4, 21, 19.4, 21, 22, 3, 22]); circle(p, 1.8, 6.6, 1.5); circle(p, 12, 3.4, 1.6); circle(p, 22.2, 6.6, 1.5); })]],
    ["Anchor", "⚓", () => [layer(p => { circle(p, 12, 4.4, 2.6); circle(p, 12, 4.4, 1.2); }, "evenodd"), layer(p => {
      poly(p, [11, 6.6, 13, 6.6, 13, 21, 11, 21]); poly(p, [7, 9, 17, 9, 17, 11, 7, 11]); band(p, 12, 12.4, 9.4, 7.4, 15, 165);
      poly(p, [2.2, 12, 6.4, 14.6, 1.6, 16.4]); poly(p, [21.8, 12, 17.6, 14.6, 22.4, 16.4]);
    })]],
    ["Cross", "✝ ✞ †", () => [layer(p => { poly(p, [10.5, 1.5, 13.5, 1.5, 13.5, 22.5, 10.5, 22.5]); poly(p, [4.5, 6.5, 19.5, 6.5, 19.5, 9.5, 4.5, 9.5]); })]],
    ["Infinity", "∞ ♾", () => [layer(p => { ellipse(p, 7, 12, 5.6, 4.6); ellipse(p, 7, 12, 3, 2.1); }, "evenodd"), layer(p => { ellipse(p, 17, 12, 5.6, 4.6); ellipse(p, 17, 12, 3, 2.1); }, "evenodd")]],
    ["Peace", "☮", () => [layer(p => { circle(p, 12, 12, 10.5); circle(p, 12, 12, 8.4); }, "evenodd"), layer(p => { bar(p, 12, 3.6, 12, 20.4, 2); bar(p, 12, 12.4, 6.2, 18.2, 2); bar(p, 12, 12.4, 17.8, 18.2, 2); })]],
    ["Smiley", "☺ 😊 🙂 😀 😃 😄 ☻", () => [layer(p => { circle(p, 12, 12, 10.5); circle(p, 8.3, 9.4, 1.7); circle(p, 15.7, 9.4, 1.7); band(p, 12, 12.4, 6.6, 4.8, 25, 155); }, "evenodd")]],
    ["Football", "⚽", () => [layer(p => { circle(p, 12, 12, 10.5); circle(p, 12, 12, 8.8); }, "evenodd"), layer(p => {
      star(p, 12, 12.2, 3.8, 3.8 * Math.cos(rad(36)), 5);
      for (let i = 0; i < 5; i++) { const a = rad(-90 + i * 72); bar(p, 12 + 3.4 * Math.cos(a), 12.2 + 3.4 * Math.sin(a), 12 + 9.2 * Math.cos(a), 12.2 + 9.2 * Math.sin(a), 1.6); }
    })]],
    ["Basketball", "🏀", () => [layer(p => { circle(p, 12, 12, 10.5); circle(p, 12, 12, 8.8); }, "evenodd"), layer(p => {
      bar(p, 12, 2, 12, 22, 1.6); bar(p, 2, 12, 22, 12, 1.6); band(p, 1, 12, 8.6, 7.1, -60, 60); band(p, 23, 12, 8.6, 7.1, 120, 240);
    })]],
    ["Footy", "🏉 🏈", () => [layer(p => {
      ellipse(p, 12, 12, 11, 6.6, -35);
      const m = (x, y) => { const a = rad(-35), c = Math.cos(a), s = Math.sin(a); return [12 + x * c - y * s, 12 + x * s + y * c]; };
      const rect = (x0, y0, x1, y1) => poly(p, [...m(x0, y0), ...m(x1, y0), ...m(x1, y1), ...m(x0, y1)]);
      rect(-4.6, -0.6, 4.6, 0.6); for (const x of [-3, -1, 1, 3]) rect(x - 0.45, -2, x + 0.45, -0.6); for (const x of [-3, -1, 1, 3]) rect(x - 0.45, 0.6, x + 0.45, 2);
    }, "evenodd")]],
    ["Butterfly", "🦋", () => [layer(p => { ellipse(p, 7.2, 8.4, 5.2, 6, -30); ellipse(p, 16.8, 8.4, 5.2, 6, 30); ellipse(p, 7.8, 17, 3.8, 4.4, 30); ellipse(p, 16.2, 17, 3.8, 4.4, -30); ellipse(p, 12, 12.5, 1.3, 7.5); })]],
    ["Fish", "🐟 🐠", () => [layer(p => { ellipse(p, 10.4, 12, 8.4, 5.6); circle(p, 6.4, 10.8, 1.3); }, "evenodd"), layer(p => poly(p, [16.6, 12, 23, 5.8, 23, 18.2]))]],
    ["Cat", "🐱 🐈", () => [layer(p => { circle(p, 12, 13.6, 8.6); ellipse(p, 8.6, 12.6, 1.4, 2); ellipse(p, 15.4, 12.6, 1.4, 2); poly(p, [10.6, 16, 13.4, 16, 12, 17.6]); }, "evenodd"), layer(p => { poly(p, [4.6, 9.6, 4.4, 1.8, 10.4, 6.4]); poly(p, [19.4, 9.6, 19.6, 1.8, 13.6, 6.4]); })]],
    ["Bone", "🦴", () => [{ p: (() => { const p = new Path2D(); poly(p, [6, 10.2, 18, 10.2, 18, 13.8, 6, 13.8]); circle(p, 5.4, 9.6, 2.8); circle(p, 5.4, 14.4, 2.8); circle(p, 18.6, 9.6, 2.8); circle(p, 18.6, 14.4, 2.8); const q = new Path2D(); q.addPath(p, new DOMMatrix().translate(12, 12).rotate(-30).translate(-12, -12)); return q; })(), rule: "nonzero" }]],
    ["Clover", "☘ 🍀", () => { const p = new Path2D(); for (let i = 0; i < 4; i++) p.addPath(new Path2D(HEART), new DOMMatrix().translate(12, 11).rotate(45 + i * 90).translate(0, -5.4).scale(0.42).translate(-12, -21.2)); return [{ p, rule: "nonzero" }, layer(p2 => { bar(p2, 12, 11, 15.6, 22, 1.6); })]; }],
    ["Rainbow", "🌈", () => [layer(p => { band(p, 12, 18, 11, 9, 180, 360); band(p, 12, 18, 7.8, 5.8, 180, 360); band(p, 12, 18, 4.6, 2.6, 180, 360); })]],
    ["Plane", "✈ 🛩", () => [layer(p => poly(p, [12, 1.5, 13.4, 3.5, 13.4, 9, 22, 14, 22, 16, 13.4, 13.4, 13.4, 19, 16, 21, 16, 22.5, 12, 21.4, 8, 22.5, 8, 21, 10.6, 19, 10.6, 13.4, 2, 16, 2, 14, 10.6, 9, 10.6, 3.5]))]],
    ["Gem", "💎", () => [layer(p => { poly(p, [6, 3, 18, 3, 22.5, 9, 12, 21.5, 1.5, 9]); poly(p, [6.8, 4.6, 9.4, 8.6, 3.6, 8.6]); poly(p, [17.2, 4.6, 20.4, 8.6, 14.6, 8.6]); }, "evenodd")]],
    ["Flame", "🔥", () => [{ p: new Path2D("M12 22.5c-4.6 0-7.8-3.1-7.8-7.4 0-4.4 3.3-6.4 4.6-10.6 2.7 1.7 3.5 4.1 3.3 6.3 1.3-.8 2.1-2.3 2.2-3.9 2.8 2.3 4 5.4 4 8.3 0 4.3-1.7 7.3-6.3 7.3z"), rule: "nonzero" }]],
    ["Tick", "✔ ✓ ☑ ✅", () => [layer(p => poly(p, [2.5, 12.5, 5.4, 9.6, 9.6, 13.8, 18.6, 4.8, 21.5, 7.7, 9.6, 19.6]))]],
    ["Bow", "🎀", () => [layer(p => { poly(p, [12, 12, 2.4, 5.6, 1.8, 18.4]); poly(p, [12, 12, 21.6, 5.6, 22.2, 18.4]); circle(p, 12, 12, 2.8); poly(p, [10.6, 13.6, 7.6, 22, 10.2, 21, 12, 14.4]); poly(p, [13.4, 13.6, 16.4, 22, 13.8, 21, 12, 14.4]); })]],
    ["Turtle", "🐢", () => [layer(p => { ellipse(p, 10.6, 13, 7.4, 5.4); circle(p, 19.8, 11.8, 2.6); ellipse(p, 5.4, 17.8, 1.8, 1.4); ellipse(p, 15.8, 17.8, 1.8, 1.4); ellipse(p, 5.4, 8.6, 1.8, 1.4); ellipse(p, 15.8, 8.6, 1.8, 1.4); poly(p, [3.4, 13.4, 1, 14.6, 3.4, 12.2]); })]],
    ["Spade", "♠", () => [{ p: at(HEART, new DOMMatrix().translate(12, 12).rotate(180).translate(-12, -12).translate(0, -1.6)), rule: "nonzero" }, layer(p => poly(p, [12, 13, 15.2, 22, 8.8, 22]))]],
    ["Club", "♣", () => [layer(p => { circle(p, 12, 6.6, 4.4); circle(p, 6.8, 13.4, 4.4); circle(p, 17.2, 13.4, 4.4); circle(p, 12, 12.4, 2.6); poly(p, [12, 12, 15.2, 22, 8.8, 22]); })]],
    ["Diamond", "♦ ◆", () => [layer(p => poly(p, [12, 1.5, 20, 12, 12, 22.5, 4, 12]))]],
  ];

  const strip = s => s.replace(/[︎️]/g, "");
  const list = LIST.map(([name, chars, make]) => ({ name, ch: chars.split(" ")[0], chars: chars.split(" "), make, _layers: null }));
  const byChar = new Map();
  for (const e of list) for (const c of e.chars) byChar.set(strip(c), e);
  const layersOf = e => e._layers || (e._layers = e.make());

  const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;
  return {
    list,
    // the emote a character (or emoji) stands for, or null
    find: g => byChar.get(strip(g)) || null,
    // text split into characters, keeping emoji whole
    split: text => seg ? [...seg.segment(text)].map(s => s.segment) : [...text],
    // draws an emote filling a size × size square with its top-left at (x, y), in the current fill colour
    draw(g, e, x, y, size) {
      g.save(); g.translate(x, y); g.scale(size / 24, size / 24);
      for (const l of layersOf(e)) g.fill(l.p, l.rule);
      g.restore();
    },
    // a little picture of an emote, for buttons
    icon(e, px = 40, colour = "#fff") {
      const c = document.createElement("canvas"); c.width = c.height = px;
      const g = c.getContext("2d"); g.fillStyle = colour;
      this.draw(g, e, px * 0.08, px * 0.08, px * 0.84);
      return c.toDataURL();
    },
  };
})();
