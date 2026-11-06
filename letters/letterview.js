// The 3D view of a row of wall letters, shared by Letter Studio, the customer designer and the front page: each letter has its
// own colour, lit as a soft matte surface or roughened for the fuzzy finish. Drag to turn it. Meshes come from loadPreview (the small letters\<font>\preview\X.bin).
"use strict";

const LetterView = (() => {
  // X.bin: u32 verts, u32 tris, f32 max x, y, z, then u16 x y z per vertex (0–65535 across each max), then u16 indices
  async function loadPreview(url) {
    const r = await fetch(url); if (!r.ok) throw new Error("no letter file " + url);
    const b = await r.arrayBuffer(), h = new DataView(b), nv = h.getUint32(0, true), nt = h.getUint32(4, true);
    const mx = [h.getFloat32(8, true), h.getFloat32(12, true), h.getFloat32(16, true)];
    const q = new Uint16Array(b, 20, nv * 3), idx = new Uint16Array(b, 20 + nv * 6, nt * 3), pos = new Float32Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) pos[i] = q[i] / 65535 * mx[i % 3];
    return { pos, idx, norm: normals(pos, idx), w: mx[0], h: mx[1], t: mx[2] };
  }
  function normals(pos, idx) {
    const n = new Float32Array(pos.length);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      for (const k of [a, b, c]) { n[k] += x; n[k + 1] += y; n[k + 2] += z; }
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    return n;
  }
  const VS = `attribute vec3 p;attribute vec3 n;uniform mat4 m;uniform mat4 vp;varying vec3 N;varying vec3 P;
    void main(){vec4 w=m*vec4(p,1.);P=w.xyz;N=mat3(m[0].xyz,m[1].xyz,m[2].xyz)*n;gl_Position=vp*w;}`;
  const FS = `precision mediump float;varying vec3 N;varying vec3 P;uniform vec3 col;uniform vec3 eye;uniform float fuzz;uniform float shine;
    float rnd(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
    void main(){vec3 n=normalize(N);if(fuzz>0.){vec3 q=floor(P*2.6);n=normalize(n+fuzz*(vec3(rnd(q),rnd(q+3.1),rnd(q+7.7))-.5));}
      vec3 v=normalize(eye-P),l=normalize(vec3(-.45,.65,.75)),l2=normalize(vec3(.7,-.15,.5));
      float d=max(dot(n,l),0.)*.68+max(dot(n,l2),0.)*.2+.3;
      float s=shine*(pow(max(dot(n,normalize(l+v)),0.),28.)*.42+pow(max(dot(n,normalize(l2+v)),0.),16.)*.1);
      float f=shine*pow(1.-max(dot(n,v),0.),4.)*.18;
      gl_FragColor=vec4(col*d+vec3(s+f),1.);}`;
  const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };

  function create(canvas) {
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, preserveDrawingBuffer: true }); if (!gl) return null;
    if (!gl.getExtension("OES_element_index_uint")) { /* 16-bit indices are all we use */ }
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const U = n => gl.getUniformLocation(pr, n), aP = gl.getAttribLocation(pr, "p"), aN = gl.getAttribLocation(pr, "n");
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 0);
    const buffers = new Map();
    const bufs = mesh => {
      if (buffers.has(mesh)) return buffers.get(mesh);
      const make = (type, data) => { const b = gl.createBuffer(); gl.bindBuffer(type, b); gl.bufferData(type, data, gl.STATIC_DRAW); return b; };
      const o = { p: make(gl.ARRAY_BUFFER, mesh.pos), n: make(gl.ARRAY_BUFFER, mesh.norm), i: make(gl.ELEMENT_ARRAY_BUFFER, mesh.idx), count: mesh.idx.length };
      buffers.set(mesh, o); return o;
    };
    let items = [], yaw = -0.16, pitch = 0.12, W = 100, H = 120;
    function draw() {
      const dpr = Math.min(devicePixelRatio || 1, 2), cw = Math.max(2, canvas.clientWidth * dpr | 0), ch = Math.max(2, canvas.clientHeight * dpr | 0);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      gl.viewport(0, 0, cw, ch); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const asp = cw / ch, f = 1 / Math.tan(0.28), span = Math.max(H * 1.28, W * 1.2 / asp), dist = span * f / 2 + 40;
      const P = new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, -1.001, -1, 0, 0, -2 * dist * 0.01, 0]);
      const eyeDir = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], eye = eyeDir.map(v => v * dist);
      // camera looks at the row's middle, world Y up
      const z = eyeDir, xl = Math.hypot(z[2], z[0]) || 1, x = [z[2] / xl, 0, -z[0] / xl], y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      const V = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1]);
      gl.uniformMatrix4fv(U("vp"), false, mul(P, V)); gl.uniform3fv(U("eye"), eye);
      for (const it of items) {
        const b = bufs(it.mesh), s = it.scale || 1;
        gl.uniformMatrix4fv(U("m"), false, new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, it.x, it.y, -12 * s, 1]));
        gl.uniform3fv(U("col"), it.colour); gl.uniform1f(U("fuzz"), it.finish === "fuzzy" ? 1.1 : 0); gl.uniform1f(U("shine"), it.finish === "fuzzy" ? 0.25 : 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
      }
    }
    let drag = null;
    canvas.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, yaw, pitch]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (!drag) return; yaw = Math.max(-1.1, Math.min(1.1, drag[2] + (e.clientX - drag[0]) * 0.008)); pitch = Math.max(-0.8, Math.min(0.8, drag[3] + (e.clientY - drag[1]) * 0.008)); draw(); });
    canvas.addEventListener("pointerup", () => { drag = null; });
    if (window.ResizeObserver) new ResizeObserver(draw).observe(canvas);
    return {
      // items: [{ mesh, colour: [r, g, b], finish, scale }]: laid out side by side, centred
      set(list, gap = 7) {
        let total = list.reduce((a, it) => a + it.mesh.w * (it.scale || 1), 0) + gap * Math.max(0, list.length - 1), x = -total / 2;
        const tall = Math.max(120, ...list.map(it => it.mesh.h * (it.scale || 1)));
        items = list.map(it => { const s = it.scale || 1, o = { ...it, x, y: -it.mesh.h * s / 2 }; x += it.mesh.w * s + gap; return o; });
        W = total; H = tall; draw();
      },
      draw,
      // a slow, gentle sway for the front page (off when someone has asked for reduced motion, or is dragging)
      sway(amount = 0.34) {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const t0 = performance.now();
        const tick = t => { if (!drag && document.visibilityState === "visible") { const s = (t - t0) / 1000; yaw = Math.sin(s * 0.45) * amount; pitch = 0.12 + Math.sin(s * 0.31) * 0.07; draw(); } requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      },
      recolour(colours) { items.forEach((it, i) => { if (colours[i]) it.colour = colours[i]; }); draw(); },
      snapshot(size) { draw(); const c = document.createElement("canvas"); c.width = size; c.height = Math.round(size * canvas.height / canvas.width); c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height); return c; },
    };
  }
  return { loadPreview, create };
})();
