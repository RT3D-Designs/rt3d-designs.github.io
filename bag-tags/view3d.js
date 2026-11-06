// Bumper Studio 3D preview (plain WebGL, nothing to download). Shows one bumper: the real boot in its
// filament colour, with the names cut in, coloured in or raised, and the labels underneath.
// Engraved names are faked cheaply: the boot's outer skin is hidden wherever the wall picture is white, and the
// cut part is drawn only inside the skin, so you see the floor and sides of the cut.
"use strict";

const View3D = (() => {
  const VS = `
    attribute vec3 aPos; attribute vec3 aNor; attribute float aAux;
    uniform mat4 uMVP; uniform mat4 uModel;
    varying vec3 vPos; varying vec3 vNor; varying float vAux;
    void main(){ vPos = aPos; vNor = aNor; vAux = aAux; gl_Position = uMVP * vec4(aPos, 1.0); }`;
  const FS = `
    precision highp float;
    varying vec3 vPos; varying vec3 vNor; varying float vAux;
    uniform vec3 uColor; uniform vec3 uColor2; uniform int uKind; uniform int uMode;
    uniform sampler2D uWall; uniform sampler2D uFloor; uniform int uHasFloor;
    uniform float uR; uniform float uW; uniform float uPicH; uniform float uH;
    uniform float uFloorSpan; uniform vec3 uEye; uniform float uTrans; uniform float uSink;
    float wallAt(){
      float a = atan(vPos.x, -vPos.y);
      float u = (a * uR + uW * 0.5) / uW;
      float v = (uH - vPos.z) / uPicH;
      return texture2D(uWall, vec2(u, v)).r;
    }
    void main(){
      vec3 col = uColor;
      if (uKind == 0) {                       // the boot
        bool skin = vAux > 0.98;
        if (skin && uMode > 0) {
          float m = wallAt();
          if (uMode == 1 && m > 0.5) discard; // engraved: open the skin over the cut
          if (uMode == 2 && m > 0.5) col = uColor2;
        }
        if (uHasFloor == 1 && vPos.z < 0.05 && vNor.z < -0.5) {
          vec2 t = vec2((uFloorSpan * 0.5 - vPos.x) / uFloorSpan, 1.0 - (vPos.y + uFloorSpan * 0.5) / uFloorSpan);
          if (texture2D(uFloor, t).r > 0.5) col *= 0.55;
        }
      } else if (uKind == 1) {                // the cut: only the bit inside the skin
        if (length(vPos.xy) > vAux + 0.002) discard;
        col *= 0.82;
      }
      // the band sunk into the bed (trimmed off when sliced): darker with diagonal stripes (not on the flat underside,
      // where the labels show)
      if (vPos.z < uSink && vPos.z > 0.02) {
        float s = step(0.5, fract((vPos.x + vPos.y + vPos.z * 2.0) * 0.6));
        col *= mix(0.35, 0.55, s);
      }
      vec3 n = normalize(vNor);
      vec3 V = normalize(uEye - vPos);
      if (dot(n, V) < 0.0) n = -n;
      vec3 L1 = normalize(vec3(-0.45, -0.8, 0.9)), L2 = normalize(vec3(0.8, 0.5, 0.35));
      float d = max(dot(n, L1), 0.0) * 0.75 + max(dot(n, L2), 0.0) * 0.28;
      float hemi = 0.5 + 0.5 * n.z;
      vec3 H = normalize(L1 + V);
      float spec = pow(max(dot(n, H), 0.0), 48.0) * 0.22;
      vec3 c = col * (0.30 + 0.16 * hemi + d) + vec3(spec);
      // a little rim light so dark filaments keep their shape
      c += col * 0.18 * pow(1.0 - max(dot(n, V), 0.0), 2.5) + vec3(0.04) * pow(1.0 - max(dot(n, V), 0.0), 3.0);
      gl_FragColor = vec4(c, uTrans);
    }`;

  function mat4Persp(fov, asp, n, f) {
    const t = 1 / Math.tan(fov / 2);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0];
  }
  function mat4LookAt(e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s;
    }
    return o;
  }

  // flat-shaded triangle soup from an indexed mesh; aux per vertex from fn(x, y, z)
  function soupFromIndexed(m, auxFn) {
    const n = m.tris.length, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), aux = new Float32Array(n);
    for (let t = 0; t < n; t += 3) {
      const a = m.tris[t] * 3, b = m.tris[t + 1] * 3, c = m.tris[t + 2] * 3, V = m.verts;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
      const wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      [a, b, c].forEach((v, k) => {
        const o = (t + k) * 3; pos[o] = V[v]; pos[o + 1] = V[v + 1]; pos[o + 2] = V[v + 2];
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz; aux[t + k] = auxFn ? auxFn(V[v], V[v + 1], V[v + 2]) : 0;
      });
    }
    return { pos, nor, aux, count: n };
  }

  // smooth normals for the boot (keeps sharp edges sharper than 40 degrees)
  function smoothSoup(pos, auxFn) {
    const n = pos.length / 3, nor = new Float32Array(pos.length), aux = new Float32Array(n);
    const fn = new Float32Array(pos.length / 3);
    const faceN = [];
    for (let t = 0; t < n; t += 3) {
      const o = t * 3;
      const ux = pos[o + 3] - pos[o], uy = pos[o + 4] - pos[o + 1], uz = pos[o + 5] - pos[o + 2];
      const wx = pos[o + 6] - pos[o], wy = pos[o + 7] - pos[o + 1], wz = pos[o + 8] - pos[o + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1;
      faceN.push(nx / l, ny / l, nz / l);
    }
    const map = new Map();
    for (let i = 0; i < n; i++) {
      const k = pos[i * 3].toFixed(3) + "," + pos[i * 3 + 1].toFixed(3) + "," + pos[i * 3 + 2].toFixed(3);
      let a = map.get(k); if (!a) map.set(k, a = []); a.push(i);
    }
    const cosLim = Math.cos(40 * Math.PI / 180);
    for (const list of map.values()) {
      for (const i of list) {
        const f = Math.floor(i / 3) * 3; let sx = 0, sy = 0, sz = 0;
        for (const j of list) {
          const g = Math.floor(j / 3) * 3;
          const d = faceN[f] * faceN[g] + faceN[f + 1] * faceN[g + 1] + faceN[f + 2] * faceN[g + 2];
          if (d >= cosLim) { sx += faceN[g]; sy += faceN[g + 1]; sz += faceN[g + 2]; }
        }
        const l = Math.hypot(sx, sy, sz) || 1; nor[i * 3] = sx / l; nor[i * 3 + 1] = sy / l; nor[i * 3 + 2] = sz / l;
        aux[i] = auxFn ? auxFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) : 0;
      }
    }
    return { pos, nor, aux, count: n };
  }

  // opts.yaw / opts.pitch: the starting (and "3/4") view; Tag Studio looks down more on its flat tags (2026-11-03)
  function create(canvas, opts = {}) {
    const homeYaw = opts.yaw ?? 0.12, homePitch = opts.pitch ?? 0.42;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    gl.useProgram(prog);
    const A = { pos: gl.getAttribLocation(prog, "aPos"), nor: gl.getAttribLocation(prog, "aNor"), aux: gl.getAttribLocation(prog, "aAux") };
    const U = {}; ["uMVP", "uModel", "uColor", "uColor2", "uKind", "uMode", "uWall", "uFloor", "uHasFloor", "uR", "uW", "uPicH", "uH", "uFloorSpan", "uEye", "uTrans", "uSink"].forEach(k => U[k] = gl.getUniformLocation(prog, k));
    const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); return t; };
    const wallTex = tex(), floorTex = tex();
    const bufs = { base: null, part: null };
    const upload = (soup) => {
      if (!soup) return null;
      const mk = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; };
      return { pos: mk(soup.pos), nor: mk(soup.nor), aux: mk(soup.aux), count: soup.count };
    };
    const free = (b) => { if (b) { gl.deleteBuffer(b.pos); gl.deleteBuffer(b.nor); gl.deleteBuffer(b.aux); } };
    const st = { yaw: homeYaw, pitch: homePitch, dist: 0, target: [0, 0, 10], prof: null, scene: null, maxMaxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };

    function setBase(pos, prof) {
      free(bufs.base);
      st.prof = prof;
      bufs.base = upload(smoothSoup(pos, (x, y, z) => Math.hypot(x, y) >= prof.outerAt(z) - 0.06 ? 1 : 0));
      st.target = [0, 0, prof.H * 0.45];
      if (!st.dist) st.dist = prof.R * 3.4;
      st.fitR = prof.R;
    }
    function setTex(t, canvas) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      let src = canvas;
      if (canvas.width > st.maxMaxTex) {      // very wide walls: shrink to what the graphics card takes
        const c = document.createElement("canvas"); c.width = st.maxMaxTex; c.height = canvas.height;
        c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height); src = c;
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    }
    // scene: { color, color2, mode: 0 none / 1 engrave / 2 inlay, wall: {canvas, cell, W, H}, floor: {canvas, n, cell}|null,
    //          part: indexed mesh|null, partKind: 1 cut / 2 solid, partColor }
    function setScene(sc) {
      st.scene = sc;
      if (sc.wall) { setTex(wallTex, sc.wall.canvas); }
      if (sc.floor) { setTex(floorTex, sc.floor.canvas); }
      free(bufs.part);
      bufs.part = sc.part ? upload(soupFromIndexed(sc.part, sc.partKind === 1 ? (x, y, z) => st.prof.outerAt(z) : null)) : null;
      draw();
    }
    function draw() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!bufs.base || !st.scene) return;
      gl.enable(gl.DEPTH_TEST);
      const sc = st.scene, p = st.prof;
      const asp = w / h, fov = 0.62;
      // keep the whole bumper in view on narrow screens
      const dist = st.dist * Math.max(1, 1.15 / asp);
      const e = [st.target[0] + dist * Math.cos(st.pitch) * Math.sin(st.yaw), st.target[1] - dist * Math.cos(st.pitch) * Math.cos(st.yaw), st.target[2] + dist * Math.sin(st.pitch)];
      const mvp = mul(mat4Persp(fov, asp, 1, dist * 4), mat4LookAt(e, st.target, [0, 0, 1]));
      gl.uniformMatrix4fv(U.uMVP, false, new Float32Array(mvp));
      gl.uniform3fv(U.uEye, e);
      gl.uniform1f(U.uR, p.R); gl.uniform1f(U.uH, p.H);
      if (sc.wall) { gl.uniform1f(U.uW, sc.wall.W); gl.uniform1f(U.uPicH, sc.wall.canvas.height * sc.wall.cell); }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, wallTex); gl.uniform1i(U.uWall, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, floorTex); gl.uniform1i(U.uFloor, 1);
      gl.uniform1i(U.uHasFloor, sc.floor ? 1 : 0);
      if (sc.floor) gl.uniform1f(U.uFloorSpan, sc.floor.n * sc.floor.cell);
      gl.uniform1f(U.uTrans, 1);
      gl.uniform1f(U.uSink, sc.sink || 0);
      const bind = (b) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.enableVertexAttribArray(A.pos); gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.nor); gl.enableVertexAttribArray(A.nor); gl.vertexAttribPointer(A.nor, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.aux); gl.enableVertexAttribArray(A.aux); gl.vertexAttribPointer(A.aux, 1, gl.FLOAT, false, 0, 0);
      };
      gl.disable(gl.CULL_FACE);
      gl.uniform3fv(U.uColor, sc.color); gl.uniform3fv(U.uColor2, sc.color2 || sc.color);
      gl.uniform1i(U.uKind, 0); gl.uniform1i(U.uMode, sc.mode || 0);
      bind(bufs.base); gl.drawArrays(gl.TRIANGLES, 0, bufs.base.count);
      if (bufs.part) {
        gl.uniform1i(U.uKind, sc.partKind); gl.uniform3fv(U.uColor, sc.partColor || sc.color);
        bind(bufs.part); gl.drawArrays(gl.TRIANGLES, 0, bufs.part.count);
      }
    }
    // drag to spin, wheel to zoom
    let drag = null;
    canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => {
      if (!drag) return;
      st.yaw -= (e.clientX - drag.x) * 0.008; st.pitch = Math.min(1.45, Math.max(-1.3, st.pitch + (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY }; draw();
    });
    canvas.addEventListener("pointerup", () => drag = null);
    canvas.addEventListener("wheel", e => { e.preventDefault(); st.dist = Math.min(st.fitR * 8, Math.max(st.fitR * 1.6, st.dist * (1 + Math.sign(e.deltaY) * 0.1))); draw(); }, { passive: false });
    new ResizeObserver(() => draw()).observe(canvas);

    return {
      setBase, setScene, draw,
      view(name) {
        if (name === "front") { st.yaw = 0; st.pitch = 0.18; }
        else if (name === "top") { st.yaw = 0; st.pitch = 1.4; }
        else if (name === "under") { st.yaw = 0; st.pitch = -1.25; }
        else { st.yaw = homeYaw; st.pitch = homePitch; }
        if (st.fitR) st.dist = st.fitR * 3.4;
        draw();
      },
      snapshot(size = 512) {          // square picture for Bambu Studio's plate thumbnail
        draw();
        const c = document.createElement("canvas"); c.width = c.height = size;
        const s = Math.min(canvas.width, canvas.height);
        c.getContext("2d").drawImage(canvas, (canvas.width - s) / 2, (canvas.height - s) / 2, s, s, 0, 0, size, size);
        return c;
      },
    };
  }
  return { create };
})();
