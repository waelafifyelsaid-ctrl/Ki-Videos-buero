// Welt-Baukasten: Renderer, Nachbearbeitung (Bodycam + Übergänge), Regen, Explosion, Blendgranate,
// wiederkehrende Orte (Hauptquartier, Van) und Kleinkram.
import {
  THREE, W, H, mat, box, cyl, sph, caps, plane, at, bodenPlatte, rng, clamp, easeOut, lerp,
  ziegelTex, betonTex, rolltorTex, radialTex, rauchTex, textTex, liveTex, holzTex, canvasTex,
} from './kern.js';

// ---------------------------------------------------------------- Renderer + Nachbearbeitung
export function renderer() {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.35;
  r.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(r.domElement);
  return r;
}

export class Post {
  constructor(r) {
    this.r = r;
    const opt = { type: THREE.HalfFloatType, samples: 4 };
    this.a = new THREE.WebGLRenderTarget(W, H, opt);
    this.b = new THREE.WebGLRenderTarget(W, H, opt);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.u = {
      tA: { value: this.a.texture }, tB: { value: this.b.texture }, modus: { value: 0 }, p: { value: 0 },
      zeit: { value: 0 }, blitz: { value: 0 }, sat: { value: 1 }, korn: { value: 0.045 }, wolb: { value: 0.09 },
      vign: { value: 0.55 }, spulen: { value: 0 }, schwarz: { value: 0 }, rot: { value: 0 }, fokus: { value: new THREE.Vector2(0.5, 0.5) },
    };
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, depthTest: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tA, tB; uniform int modus; uniform float p, zeit, blitz, sat, korn, wolb, vign, spulen, schwarz, rot;
        uniform vec2 fokus;
        float h(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
        vec2 linse(vec2 uv){ vec2 c = uv - .5; c.x *= ${(W / H).toFixed(4)}; float r2 = dot(c,c); vec2 d = c * (1. + wolb * r2) / (1. + wolb * .35); d.x /= ${(W / H).toFixed(4)}; return d + .5; }
        vec3 hol(sampler2D t, vec2 uv){ return texture2D(t, clamp(uv, 0., 1.)).rgb; }
        vec3 lese(sampler2D t, vec2 uv){ vec2 o = (uv - .5) * .0025; return vec3(hol(t, uv + o).r, hol(t, uv).g, hol(t, uv - o).b); }
        void main(){
          vec2 uv = linse(vUv);
          if (spulen > 0.) { float zeile = floor(uv.y * 90.); uv.x += (h(vec2(zeile, floor(zeit * 30.))) - .5) * .04 * spulen; }
          vec3 c;
          if (modus == 0) c = lese(tA, uv);
          else if (modus == 1) { c = mix(lese(tA, uv), lese(tB, uv), p); }
          else if (modus == 2) { float k = p * p * (3. - 2. * p); vec2 ua = uv + vec2(k, 0.), ub = uv - vec2(1. - k, 0.);
            vec3 ca = vec3(0.), cb = vec3(0.); for (int i = 0; i < 6; i++) { float o = float(i) * .012 * sin(3.14159 * p);
              ca += lese(tA, ua + vec2(o, 0.)); cb += lese(tB, ub + vec2(o, 0.)); }
            c = (uv.x + k < 1.) ? ca / 6. : cb / 6.; }
          else if (modus == 3) { if (p < .5) { float z = 1. + 3. * p * p; c = lese(tA, (uv - fokus) / z + fokus) + vec3(p * 2.); }
            else { float z = 1.2 - .2 * (p - .5) * 2.; c = lese(tB, (uv - .5) / z + .5) + vec3((1. - p) * 2.); } }
          else if (modus == 4) { float zeile = floor(uv.y * 40.); float r = h(vec2(zeile, floor(zeit * 30.)));
            vec2 u2 = uv + vec2((r - .5) * .15 * sin(3.14159 * p), 0.); c = (r < p) ? lese(tB, u2) : lese(tA, u2);
            c.r = (r < p ? lese(tB, u2 + vec2(.01, 0.)) : lese(tA, u2 + vec2(.01, 0.))).r; }
          float g = dot(c, vec3(.299, .587, .114)); c = mix(vec3(g), c, sat);
          c += vec3(rot, 0., 0.) * .5;
          c = mix(c, vec3(1.), clamp(blitz, 0., 1.));
          vec2 v = vUv - .5; c *= 1. - vign * smoothstep(.25, .85, length(v * vec2(${(W / H).toFixed(4)} * 1.6, 1.)));
          c += (h(vUv * 973. + zeit) - .5) * korn;
          if (spulen > 0.) c += step(.985, h(vec2(floor(vUv.y * 300.), floor(zeit * 30.)))) * .4 * spulen;
          c *= 1. - schwarz;
          gl_FragColor = vec4(max(c, 0.), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
    this.szene = new THREE.Scene(); this.szene.add(this.quad);
  }
  rendere(szene, kamera, ziel) { this.r.setRenderTarget(ziel); this.r.render(szene, kamera); this.r.setRenderTarget(null); }
  fertig(einstellungen = {}) {
    const u = this.u;
    const def = { modus: 0, p: 0, blitz: 0, sat: 1, korn: 0.045, wolb: 0.09, vign: 0.55, spulen: 0, schwarz: 0, rot: 0 };
    for (const [k, v] of Object.entries({ ...def, ...einstellungen })) if (u[k] && k !== 'fokus') u[k].value = v;
    if (einstellungen.fokus) u.fokus.value.set(einstellungen.fokus[0], einstellungen.fokus[1]);
    this.r.setRenderTarget(null);
    this.r.render(this.szene, this.cam);
  }
}
export const UEBERGANG = { mix: 1, whip: 2, zoom: 3, glitch: 4 };

// ---------------------------------------------------------------- Licht + Atmosphäre
export function nachtLicht(szene, { himmel = 0x0b1020, nebel = [0x0e1526, 6, 55], mond = 0.9, hemi = 0.85 } = {}) {
  szene.background = new THREE.Color(himmel);
  szene.fog = new THREE.Fog(...nebel);
  szene.add(new THREE.HemisphereLight(0x8aa0d8, 0x1a1a22, hemi));
  const m = new THREE.DirectionalLight(0x9fb4ff, mond);
  m.position.set(-8, 14, 6); m.castShadow = true; m.shadow.mapSize.set(2048, 2048);
  Object.assign(m.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
  m.shadow.bias = -0.0005;
  szene.add(m); szene.add(m.target);
  return m;
}

// ---------------------------------------------------------------- Regen
export class Regen {
  constructor(szene, n = 1600) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.linien = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8e8, transparent: true, opacity: 0.45, fog: false }));
    this.linien.frustumCulled = false;
    szene.add(this.linien);
    const r = rng(77);
    this.d = Array.from({ length: n }, () => [r() * 24 - 12, r() * 14, r() * 26 - 22, 9 + r() * 4]);
  }
  update(t, kam, an = true, wind = 0.12) {
    this.linien.visible = an;
    if (!an) return;
    const p = this.pos, cx = kam.position.x, cz = kam.position.z, cy = kam.position.y;
    for (let i = 0; i < this.n; i++) {
      const [x0, y0, z0, v] = this.d[i];
      const y = cy - 3 + ((y0 - t * v) % 14 + 14) % 14;
      const x = cx + x0 + (y - cy) * wind, z = cz + z0;
      p.set([x, y, z, x - wind * 0.35, y + 0.35, z], i * 6);
    }
    this.linien.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Physik-Helfer
// Würfel/Brocken: Wurf mit Schwerkraft, Abprallen am Boden (y = boden), Reibung. Gibt Position + liegt? zurück.
export function wurf3(p0, v0, d, { boden = 0, radius = 0.05, rest = 0.35, reib = 0.7, g = 9.81 } = {}) {
  let [x, y, z] = p0, [vx, vy, vz] = v0, t = 0, liegt = false;
  const dt = 1 / 240;
  while (t < d) {
    if (!liegt) {
      vy -= g * dt; x += vx * dt; y += vy * dt; z += vz * dt;
      if (y < boden + radius) {
        y = boden + radius;
        if (Math.abs(vy) < 0.8) { vy = 0; liegt = true; } else { vy = -vy * rest; vx *= reib; vz *= reib; }
      }
    } else { vx *= 0.96; vz *= 0.96; x += vx * dt; z += vz * dt; }
    t += dt;
  }
  return { x, y, z, liegt };
}

// ---------------------------------------------------------------- Explosion
export class Explosion {
  constructor(szene, pos, { groesse = 1, richtung = new THREE.Vector3(0, 0, 1), seed = 4, truemmer = 36, farbe = 0x6c584c } = {}) {
    this.pos = pos.clone(); this.g = groesse; this.richt = richtung.clone().normalize();
    this.gruppe = new THREE.Group(); szene.add(this.gruppe);
    const feuerTex = radialTex('feuer', [[0, 'rgba(255,250,220,1)'], [0.25, 'rgba(255,200,80,0.95)'], [0.55, 'rgba(240,90,20,0.6)'], [1, 'rgba(120,20,0,0)']]);
    const rauch = rauchTex();
    const r = rng(seed);
    this.feuer = Array.from({ length: 16 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: feuerTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
      s.userData = { dir: new THREE.Vector3(r() - .5, r() * .8 - .1, r() - .5).add(this.richt.clone().multiplyScalar(.8)).normalize(), v: 1.5 + r() * 3, s: .8 + r() * 1.2 };
      this.gruppe.add(s); return s;
    });
    this.rauch = Array.from({ length: 26 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: rauch, color: 0x3a3a3e, transparent: true, depthWrite: false }));
      s.userData = { dir: new THREE.Vector3(r() - .5, r() * .6, r() - .5).add(this.richt.clone().multiplyScalar(.7)).normalize(), v: 1 + r() * 2.5, s: 1.2 + r() * 1.5, auf: .4 + r() * .7, f: .25 + r() * .2 };
      this.gruppe.add(s); return s;
    });
    const bm = mat(farbe, { r: .9 });
    this.brocken = Array.from({ length: truemmer }, () => {
      const m = box(.04 + r() * .09, .03 + r() * .05, .04 + r() * .08, r() < .5 ? bm : mat(0x4a4e55, { r: .7, m: .4 }));
      const dir = new THREE.Vector3(r() - .5, r() * .9 + .1, r() - .5).add(this.richt.clone().multiplyScalar(1.1)).normalize();
      m.userData = { v: dir.multiplyScalar(3 + r() * 7), rot: [r() * 20 - 10, r() * 20 - 10, r() * 20 - 10] };
      this.gruppe.add(m); return m;
    });
    const fg = new THREE.BufferGeometry(); this.funkenPos = new Float32Array(80 * 3);
    fg.setAttribute('position', new THREE.BufferAttribute(this.funkenPos, 3));
    this.funken = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffc860, size: .05, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.funken.frustumCulled = false;
    this.funkenDir = Array.from({ length: 80 }, () => new THREE.Vector3(r() - .5, r() * .9, r() - .5).add(this.richt.clone()).normalize().multiplyScalar(5 + r() * 9));
    this.gruppe.add(this.funken);
    this.licht = new THREE.PointLight(0xff9a40, 0, 25, 1.6); this.licht.position.copy(pos); this.gruppe.add(this.licht);
    this.update(-1);
  }
  update(d) {
    const sichtbar = d >= 0; this.gruppe.visible = sichtbar;
    if (!sichtbar) return;
    const g = this.g;
    this.licht.intensity = 400 * g * Math.max(0, Math.exp(-4 * d)) * (1 + .3 * Math.sin(d * 60));
    this.feuer.forEach((s, i) => {
      const u = s.userData, k = easeOut(d / .35);
      s.position.copy(this.pos).addScaledVector(u.dir, u.v * k * .45 * g).add(new THREE.Vector3(0, d * .6, 0));
      const sz = u.s * g * (0.25 + 0.95 * k);
      s.scale.set(sz, sz, 1);
      s.material.opacity = clamp(1 - (d - .25) / .55);
      s.material.color.setHSL(.09 - d * .06, 1, .55 - d * .2);
    });
    this.rauch.forEach(s => {
      const u = s.userData, k = easeOut(d / 1.6);
      s.position.copy(this.pos).addScaledVector(u.dir, u.v * k * g).add(new THREE.Vector3(0, u.auf * d * g, 0));
      const sz = u.s * g * (0.5 + 1.6 * easeOut(d / 3));
      s.scale.set(sz, sz, 1);
      s.material.opacity = clamp(d * 5) * clamp(1 - (d - 2) / 4) * .9;
    });
    this.brocken.forEach((m, i) => {
      const u = m.userData;
      const q = wurf3([this.pos.x, this.pos.y, this.pos.z], [u.v.x, u.v.y, u.v.z], d, { radius: .03 });
      m.position.set(q.x, q.y, q.z);
      if (!q.liegt) m.rotation.set(u.rot[0] * d, u.rot[1] * d, u.rot[2] * d);
      else m.rotation.set(0, u.rot[1], 0);
    });
    for (let i = 0; i < 80; i++) {
      const v = this.funkenDir[i];
      const dd = Math.min(d, .7);
      this.funkenPos.set([this.pos.x + v.x * dd, this.pos.y + v.y * dd - 4.9 * dd * dd, this.pos.z + v.z * dd], i * 3);
    }
    this.funken.geometry.attributes.position.needsUpdate = true;
    this.funken.material.opacity = clamp(1 - d / .7);
  }
}

// ---------------------------------------------------------------- Rauchschwaden (langsam, z. B. nach der Sprengung)
export class Schwaden {
  constructor(szene, pos, n = 10, seed = 2) {
    const r = rng(seed); const t = rauchTex();
    this.pos = pos.clone();
    this.s = Array.from({ length: n }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0x5a5e66, transparent: true, depthWrite: false }));
      s.userData = { o: new THREE.Vector3(r() * 2 - 1, r(), r() * 2 - 1), v: .2 + r() * .4, ph: r() };
      szene.add(s); return s;
    });
  }
  update(d, staerke = 1, kam = null) {
    this.s.forEach(s => {
      const u = s.userData, k = ((d * u.v * .3 + u.ph) % 1);
      s.visible = staerke > 0 && d >= 0;
      s.position.copy(this.pos).addScaledVector(u.o, 1.2).add(new THREE.Vector3(0, k * 3, 0));
      const sz = 1.5 + k * 3; s.scale.set(sz, sz, 1);
      const nah = kam ? clamp((s.position.distanceTo(kam.position) - 1.2) / 2.5) : 1;
      s.material.opacity = .3 * staerke * Math.sin(Math.PI * k) * nah;
    });
  }
}

// ---------------------------------------------------------------- Kleinzeug
export function lampe(szene, x, y, z, { farbe = 0xffd9a0, staerke = 18, weite = 14, schatten = false } = {}) {
  const g = new THREE.Group();
  g.add(at(box(.5, .12, .25, mat(0x2b2d31)), 0, 0, 0));
  g.add(at(box(.4, .02, .18, mat(0xfff1d0, { e: farbe, ei: 3 })), 0, -.07, 0));
  g.position.set(x, y, z); szene.add(g);
  const l = new THREE.PointLight(farbe, staerke, weite, 1.8); l.position.set(x, y - .25, z); l.castShadow = schatten;
  if (schatten) { l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.002; }
  szene.add(l);
  return l;
}
export function container(szene, x, z, ry, farbe, { y = 0, lang = 6.1 } = {}) {
  const t = new THREE.Group();
  const m = mat(farbe, { r: .7, m: .3 });
  t.add(at(box(2.44, 2.59, lang, m), 0, 1.295, 0));
  const rippe = mat(new THREE.Color(farbe).multiplyScalar(.75), { r: .7, m: .3 });
  for (let k = -lang / 2 + .3; k < lang / 2; k += .35) { t.add(at(box(2.5, 2.4, .05, rippe, false), 0, 1.3, k)); }
  t.position.set(x, y, z); t.rotation.y = ry; szene.add(t); return t;
}
export function palette(szene, x, z, ry = 0) {
  const g = new THREE.Group(), m = mat(0x9c7a54, { r: .9 });
  for (const zz of [-.5, 0, .5]) g.add(at(box(1.2, .1, .1, m), 0, .05, zz));
  for (let k = -.5; k <= .5; k += .2) g.add(at(box(.12, .02, 1.2, m), k, .11, 0));
  g.position.set(x, 0, z); g.rotation.y = ry; szene.add(g); return g;
}
export function fass(szene, x, z, farbe = 0x1d4e89) {
  const f = cyl(.3, .3, .9, mat(farbe, { r: .5, m: .5 }), 18); f.position.set(x, .45, z); szene.add(f);
  for (const y of [.2, .7]) szene.add(at(new THREE.Mesh(new THREE.TorusGeometry(.3, .015, 6, 20), mat(0x222222)), x, y, z, Math.PI / 2));
  return f;
}
export function kran(szene, x, z, h = 30) {
  const m = mat(0xc1121f, { r: .6, m: .5 });
  szene.add(at(box(1, h, 1, m), x, h / 2, z));
  szene.add(at(box(26, 1.2, 1.2, m), x + 8, h, z));
  szene.add(at(box(4, 4, 4, mat(0x343a40)), x, h - 2, z));
}
export function pfuetze(szene, x, z, rx, rz) {
  const p = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mat(0x3a4a63, { r: 0.08, m: 0.1, envI: 1.4, transparent: true, opacity: .55 }));
  p.rotation.x = -Math.PI / 2; p.scale.set(rx, rz, 1); p.position.set(x, 0.006, z); p.receiveShadow = true; szene.add(p); return p;
}
export function schild(szene, text, x, y, z, ry = 0, { w = 1.2, h = .6, farbe = '#ffffff', grund = 'rgba(0,0,0,0)', font, leucht = 0 } = {}) {
  const t = textTex(text + farbe + grund, text, { w: 512, h: 256, farbe, grund, font });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: leucht ? 0xffffff : 0x000000, emissiveMap: leucht ? t : null, emissiveIntensity: leucht }));
  m.position.set(x, y, z); m.rotation.y = ry; szene.add(m); return m;
}

// ---------------------------------------------------------------- Hauptquartier (in jeder Folge gleich)
export function hauptquartier(szene) {
  szene.background = new THREE.Color(0x1b1f27);
  const hq = {};
  const boden = mat(0x5a6170, { r: .55, map: betonTex('#5a6170', [4, 4], 'hqboden') });
  szene.add(bodenPlatte(10, 12, boden, 0, -1));
  const wand = mat(0x8e98a8, { r: .9 }), dunkel = mat(0x3d4452, { r: .85 });
  szene.add(at(box(10, 3.4, .2, wand), 0, 1.7, -6.1));               // Rückwand
  szene.add(at(box(.2, 3.4, 12, wand), -5, 1.7, -1));
  szene.add(at(box(.2, 3.4, 12, wand), 5, 1.7, -1));
  szene.add(at(box(10, .2, 12, mat(0xd6dae0)), 0, 3.45, -1));          // Decke
  for (let x = -4.5; x <= 4.5; x += 1) szene.add(at(box(.8, 1.4, .05, dunkel), x, 1.6, -5.98));   // Akustikpaneele
  // Großer Bildschirm
  hq.schirm = liveTex(1600, 900);
  const sm = new THREE.MeshStandardMaterial({ map: hq.schirm.tex, emissive: 0xffffff, emissiveMap: hq.schirm.tex, emissiveIntensity: 1.1 });
  szene.add(at(box(3.6, 2.1, .08, mat(0x111111)), 0, 1.75, -5.92));
  szene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), sm), 0, 1.75, -5.87));
  schild(szene, 'EINHEIT FALKE', -3.2, 2.85, -5.95, 0, { w: 2.2, h: .5, farbe: '#e9ecef', font: 'bold 80px DejaVu Sans, Arial' });
  // Fenster links mit Regen
  hq.fenster = liveTex(512, 512);
  const fm = new THREE.MeshStandardMaterial({ map: hq.fenster.tex, emissive: 0x334466, emissiveIntensity: .6 });
  for (const z of [-4.2, -1.6, 1.0]) {
    szene.add(at(box(.1, 1.7, 2.1, mat(0xe9ecef)), -4.92, 1.75, z));
    szene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5), fm), -4.86, 1.75, z, 0, Math.PI / 2));
  }
  // Spinde rechts (Nummern)
  hq.spinde = {};
  const nrs = [1, 2, 4, 6, 7];
  nrs.forEach((nr, k) => {
    const z = -4.6 + k * .65;
    szene.add(at(box(.55, 2.0, .6, mat(0x495057, { r: .5, m: .4 })), 4.62, 1.0, z));
    const tuer = new THREE.Group(); tuer.position.set(4.33, 0, z - .3);
    tuer.add(at(box(.03, 1.94, .6, mat(0x5c636b, { r: .45, m: .5 })), 0, 1.0, .3));
    for (let s = 0; s < 4; s++) tuer.add(at(box(.035, .03, .35, mat(0x343a40)), 0, 1.7 - s * .06, .3));
    const nt = schild(szene, String(nr), 0, 0, 0, 0, { w: .2, h: .14, farbe: '#ffffff', grund: '#212529', font: 'bold 160px DejaVu Sans, Arial' });
    szene.remove(nt); nt.position.set(-.02, 1.35, .3); nt.rotation.y = -Math.PI / 2; tuer.add(nt);
    szene.add(tuer);
    hq.spinde[nr] = tuer;
  });
  // Helm + Weste im Spind 6
  hq.helm6 = new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 12, 0, Math.PI * 2, 0, Math.PI * .52), mat(0x2c3036, { r: .6 }));
  hq.helm6.position.set(4.62, 1.55, -4.6 + 3 * .65); szene.add(hq.helm6);
  szene.add(at(box(.36, .4, .2, mat(0x3b3f35)), 4.65, 1.0, -4.6 + 3 * .65));
  // Tisch, Stühle, Laptop, Kaffeemaschine, Pflanze, Whiteboard
  szene.add(at(box(2.6, .06, 1.6, mat(0x6b4f3a, { r: .5, map: holzTex([2, 1]) })), 0, .76, -1.4));
  for (const [x, z] of [[-1.2, -2.1], [1.2, -2.1], [-1.2, -.7], [1.2, -.7]]) szene.add(at(cyl(.04, .04, .74, mat(0x222222), 8), x, .37, z));
  for (const [x, z, ry] of [[-.5, -2.65, 0], [.6, -2.65, 0], [-1.8, -1.4, Math.PI / 2]]) {
    const st = new THREE.Group(); st.add(at(box(.48, .08, .45, mat(0x2b2d42)), 0, .46, 0)); st.add(at(box(.48, .5, .06, mat(0x2b2d42)), 0, .75, .22));
    st.add(at(cyl(.03, .03, .44, mat(0x222222), 8), 0, .22, 0)); st.position.set(x, 0, z); st.rotation.y = ry; szene.add(st);
  }
  hq.laptop = new THREE.Group();
  hq.laptopSchirm = liveTex(512, 320);
  hq.laptop.add(at(box(.36, .02, .25, mat(0x9aa0a6, { m: .6, r: .3 })), 0, 0, 0));
  hq.laptop.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.34, .22), new THREE.MeshStandardMaterial({ map: hq.laptopSchirm.tex, emissive: 0xffffff, emissiveMap: hq.laptopSchirm.tex, emissiveIntensity: .9, side: THREE.DoubleSide })), 0, .11, -.12, -.25, Math.PI));
  hq.laptop.position.set(.6, .8, -1.85); szene.add(hq.laptop);
  szene.add(at(box(.35, .45, .35, mat(0x212529, { m: .5, r: .4 })), -4.6, 1.08, -5.4));
  szene.add(at(box(1.2, .86, .6, mat(0x6c757d)), -4.4, .43, -5.4));
  szene.add(at(cyl(.22, .18, .4, mat(0x8d6e63)), 4.4, .2, 1.8)); szene.add(at(sph(.4, mat(0x2d6a4f, { r: .9 }), 10, 8), 4.4, .7, 1.8));
  // Whiteboard mit Skizze
  const wb = liveTex(512, 320); { const g = wb.ctx; g.fillStyle = '#f8f9fa'; g.fillRect(0, 0, 512, 320); g.strokeStyle = '#1d3557'; g.lineWidth = 6;
    g.strokeRect(60, 60, 160, 110); g.beginPath(); g.moveTo(220, 115); g.lineTo(330, 115); g.stroke(); g.fillStyle = '#e63946'; g.font = 'bold 40px DejaVu Sans'; g.fillText('X', 350, 130);
    g.fillStyle = '#1d3557'; g.font = 'bold 28px DejaVu Sans'; g.fillText('Plan A: Tür', 60, 230); g.fillText('Plan B: Zwei', 60, 275); wb.tex.needsUpdate = true; }
  szene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ map: wb.tex })), 3.2, 1.6, -5.99));
  // Licht
  szene.add(new THREE.HemisphereLight(0xe8eef8, 0x3a3a40, .9));
  for (const [x, z] of [[-1.8, -3], [1.8, -3], [0, .5]]) {
    szene.add(at(box(1.2, .04, .5, mat(0xffffff, { e: 0xfff6e8, ei: 2.5 })), x, 3.33, z));
    const l = new THREE.PointLight(0xfff1dc, 9, 12, 1.6); l.position.set(x, 3.1, z); szene.add(l);
  }
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 3.2, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); szene.add(key);
  // Alarm-Rundumleuchte
  hq.alarmLampe = at(cyl(.1, .12, .15, mat(0x5a0000, { e: 0xff0000, ei: 0 })), 0, 3.28, -5.0); szene.add(hq.alarmLampe);
  hq.alarm = new THREE.SpotLight(0xff1020, 0, 20, .6, .5, 1.2); hq.alarm.position.set(0, 3.2, -5.0); szene.add(hq.alarm); szene.add(hq.alarm.target);
  return hq;
}

export function zeichneFensterRegen(fx, t) {
  const g = fx.ctx;
  const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#1d2b45'); grd.addColorStop(1, '#3d4f6e');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,220,150,0.55)';
  for (let k = 0; k < 14; k++) g.fillRect((k * 83) % 512, 300 + (k * 37) % 120, 14, 22);
  const r = rng(4);
  g.strokeStyle = 'rgba(200,220,255,0.55)'; g.lineWidth = 2;
  for (let k = 0; k < 60; k++) { const x = r() * 512, v = .3 + r(); const y = ((r() * 512 + t * 220 * v) % 560) - 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y + 18 + 20 * v); g.stroke(); }
  fx.tex.needsUpdate = true;
}

// ---------------------------------------------------------------- Einsatz-Van (innen)
export function vanInnen(szene) {
  szene.background = new THREE.Color(0x05070b);
  const v = {};
  const wand = mat(0x2a2d33, { r: .7 }), boden = mat(0x1d1f23, { r: .9, map: betonTex('#2a2c31', [2, 4], 'vanboden') });
  szene.add(bodenPlatte(2.1, 4.4, boden, 0, -.3));
  szene.add(at(box(.08, 1.8, 4.4, wand), -1.06, .9, -.3)); szene.add(at(box(.08, 1.8, 4.4, wand), 1.06, .9, -.3));
  szene.add(at(box(2.2, .08, 4.4, mat(0x1f2228)), 0, 1.82, -.3));
  // Trennwand mit Fenster zum Fahrerhaus
  szene.add(at(box(2.2, .75, .06, wand), 0, .37, -2.5)); szene.add(at(box(2.2, .45, .06, wand), 0, 1.6, -2.5));
  szene.add(at(box(.45, .5, .06, wand), -.88, 1.13, -2.5)); szene.add(at(box(.45, .5, .06, wand), .88, 1.13, -2.5));
  // Blick nach vorne: Fahrer + Frontscheibe (animierte Straße)
  v.strasse = liveTex(1024, 512);
  szene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshBasicMaterial({ map: v.strasse.tex })), 0, 1.25, -3.6));
  szene.add(at(box(2.1, .5, .8, mat(0x22252b)), 0, .8, -3.2));   // Armaturen
  v.wischer = new THREE.Group(); v.wischer.position.set(-.3, .78, -3.5);
  v.wischer.add(at(box(.9, .015, .015, mat(0x111111)), .45, 0, 0)); szene.add(v.wischer);
  v.wischer2 = v.wischer.clone(); v.wischer2.position.x = .5; szene.add(v.wischer2);
  // Bänke
  for (const s of [-1, 1]) {
    szene.add(at(box(.5, .08, 3.6, mat(0x3a3f47)), s * .8, .46, -.3));
    szene.add(at(box(.5, .46, .1, mat(0x2b2f35)), s * .8, .23, -2.0));
    szene.add(at(box(.08, .6, 3.6, mat(0x343840)), s * 1.0, .85, -.3));
    szene.add(at(cyl(.02, .02, 3.6, mat(0x9aa0a6, { m: .8, r: .3 }), 8), s * .75, 1.7, -.3, Math.PI / 2));   // Haltestange
    for (let z = -1.8; z < 1.3; z += .6) szene.add(at(box(.04, .28, .04, mat(0x222222)), s * .75, 1.55, z));   // Schlaufen
  }
  // Ausrüstung
  szene.add(at(box(.55, .9, .04, mat(0x1b1d21)), -1.0, 1.15, .9, 0, Math.PI / 2));   // Schild an der Wand
  szene.add(at(cyl(.07, .07, .7, mat(0xa4161a, { r: .4, m: .4 }), 12), .1, .08, .6, 0, 0, Math.PI / 2));   // Ramme
  szene.add(at(box(.5, .3, .35, mat(0x3b3f35)), -.15, .15, -1.6));                 // Tasche
  szene.add(at(box(.45, .2, .32, mat(0x111111)), .2, .1, -.9));                    // Drohnenkoffer
  szene.add(at(box(.18, .4, .18, mat(0xc1121f, { r: .4 })), 1.0, .3, 1.2));          // Feuerlöscher
  szene.add(at(box(.25, .15, .1, mat(0x111111)), -.6, 1.45, -2.45));                // Funkgerät
  // Rotes Innenlicht
  for (const z of [-1.6, -.2, 1.0]) {
    szene.add(at(box(.5, .03, .06, mat(0x400000, { e: 0xff2030, ei: 3 })), 0, 1.78, z));
    const l = new THREE.PointLight(0xff3040, 3.2, 4.5, 1.5); l.position.set(0, 1.6, z); szene.add(l);
  }
  szene.add(new THREE.HemisphereLight(0x6070a0, 0x101010, .35));
  v.blau = new THREE.PointLight(0x3a7bff, 0, 6, 1.5); v.blau.position.set(0, 1.4, -2.9); szene.add(v.blau);
  v.vorbei = new THREE.PointLight(0xffd8a0, 0, 5, 1.5); szene.add(v.vorbei);
  // Hecktüren (öffnen sich am Ende)
  v.tueren = [];
  for (const s of [-1, 1]) {
    const tg = new THREE.Group(); tg.position.set(s * 1.05, 0, 1.9);
    tg.add(at(box(1.05, 1.8, .06, wand), -s * .525, .9, 0));
    tg.add(at(box(.6, .4, .065, mat(0x223044, { r: .1, m: .3, e: 0x0a1020, ei: 1 })), -s * .525, 1.3, 0));
    szene.add(tg); v.tueren.push(tg);
  }
  v.draussen = new THREE.Group();
  v.draussen.add(at(plane(14, 8, mat(0x0e1526, { r: 1 })), 0, 3, 9, 0, Math.PI));
  v.draussen.add(bodenPlatte(14, 10, mat(0x2b3038, { r: .35 }), 0, 7));
  szene.add(v.draussen);
  v.draussenLicht = new THREE.PointLight(0xffd59a, 0, 14, 1.4); v.draussenLicht.position.set(1.5, 3.5, 6); szene.add(v.draussenLicht);
  return v;
}

export function zeichneStrasse(st, t, { blau = false } = {}) {
  const g = st.ctx, w = 1024, h = 512;
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#05070d'); grd.addColorStop(.55, '#141b2b'); grd.addColorStop(.56, '#20242c'); grd.addColorStop(1, '#2b2f36');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e9ecef';
  for (let k = 0; k < 8; k++) { const p = ((k / 8 + t * .9) % 1); const y = 290 + p * p * 240; const ww = 6 + p * 30; g.fillRect(w / 2 - ww / 2, y, ww, 6 + p * 30); }
  for (let k = 0; k < 6; k++) { const p = ((k / 6 + t * .7) % 1); const sx = w / 2 + (k % 2 ? 1 : -1) * (40 + p * p * 700); const sy = 280 - p * 200;
    const r = 6 + p * 40; const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r * 3); gr.addColorStop(0, 'rgba(255,215,150,0.95)'); gr.addColorStop(1, 'rgba(255,215,150,0)'); g.fillStyle = gr; g.fillRect(sx - r * 3, sy - r * 3, r * 6, r * 6); }
  const r = rng(9); g.fillStyle = 'rgba(200,220,255,0.35)';
  for (let k = 0; k < 120; k++) { const x = r() * w, y = (r() * h + t * 400 * (r() + .5)) % h; g.fillRect(x, y, 3, 3); }
  if (blau) { g.fillStyle = 'rgba(60,120,255,0.18)'; g.fillRect(0, 0, w, h); }
  st.tex.needsUpdate = true;
}

// Zusätzliche Büro-Details (Arbeitsplätze, Monitore, Lagekarte, Funkgeräte, Kabeltrassen, Uhr, Waffenschrank)
export function hqDetails(szene) {
  const d = {};
  const schwarz = mat(0x15171a, { r: .5 }), grau = mat(0x495057, { r: .6, m: .3 });
  const monTex = (key, draw) => canvasTex('mon' + key, 512, 320, draw);
  const kamera = monTex('kam', (g, w, h) => { g.fillStyle = '#10161d'; g.fillRect(0, 0, w, h); for (let k = 0; k < 4; k++) { const x = (k % 2) * 256, y = Math.floor(k / 2) * 160;
    g.fillStyle = ['#3a4450', '#2f3b33', '#463c33', '#30384a'][k]; g.fillRect(x + 4, y + 4, 248, 152); g.fillStyle = '#e9ecef'; g.font = 'bold 18px DejaVu Sans'; g.fillText('CAM ' + (k + 1), x + 12, y + 26);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 40, y + 70, 160, 50); g.fillStyle = '#ff2a3d'; g.beginPath(); g.arc(x + 236, y + 20, 6, 0, 7); g.fill(); } });
  const graph = monTex('graph', (g, w, h) => { g.fillStyle = '#0d1b2a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4cc9f0'; g.lineWidth = 4; g.beginPath();
    for (let x = 0; x < w; x += 8) g.lineTo(x, 200 - 60 * Math.sin(x / 40) - 30 * Math.sin(x / 13)); g.stroke(); g.fillStyle = '#80ed99'; g.font = 'bold 26px DejaVu Sans'; g.fillText('FUNKVERKEHR', 20, 40);
    for (let k = 0; k < 6; k++) { g.fillStyle = '#1b263b'; g.fillRect(20, 240 + k * 0, 0, 0); } });
  const karte = monTex('karte', (g, w, h) => { g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#adb5bd'; g.lineWidth = 10; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, k * 60 + 20); g.lineTo(w, k * 50 + 40); g.stroke(); g.beginPath(); g.moveTo(k * 90 + 30, 0); g.lineTo(k * 80 + 60, h); g.stroke(); }
    g.fillStyle = '#9cc5a1'; g.fillRect(300, 40, 140, 90); g.fillStyle = '#a9c6e8'; g.fillRect(40, 200, 200, 70); g.fillStyle = '#e63946'; g.beginPath(); g.arc(380, 230, 12, 0, 7); g.fill(); g.strokeStyle = '#e63946'; g.lineWidth = 4; g.beginPath(); g.arc(380, 230, 30, 0, 7); g.stroke(); });
  const monitor = (x, y, z, ry, tex, w = .55, h = .34) => {
    const m = new THREE.Group(); m.add(at(box(w + .03, h + .03, .03, schwarz), 0, 0, 0));
    m.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .8 })), 0, 0, .017));
    m.add(at(box(.04, .2, .04, schwarz), 0, -h / 2 - .08, -.03)); m.add(at(box(.2, .015, .14, schwarz), 0, -h / 2 - .18, -.03));
    m.position.set(x, y, z); m.rotation.y = ry; szene.add(m); return m;
  };
  // Arbeitsplätze links hinten (Blick zur Kamera)
  for (const x of [-3.9, -2.75]) {
    szene.add(at(box(1.1, .05, .7, mat(0xced4da, { r: .5 })), x, .74, -5.2));
    for (const sx of [-.5, .5]) szene.add(at(box(.04, .72, .64, grau), x + sx, .37, -5.2));
    monitor(x - .28, 1.06, -5.4, 0, kamera); monitor(x + .28, 1.06, -5.4, 0, x < -3 ? graph : karte);
    szene.add(at(box(.4, .02, .14, schwarz), x, .775, -5.0));
    const st = new THREE.Group(); st.add(at(box(.5, .08, .48, mat(0x22252a)), 0, .5, 0)); st.add(at(box(.5, .6, .07, mat(0x22252a)), 0, .85, .25));
    st.add(at(cyl(.03, .03, .45, mat(0x111111), 8), 0, .25, 0)); for (let k = 0; k < 5; k++) st.add(at(box(.3, .03, .04, mat(0x111111), 0), Math.cos(k * 1.26) * .15, .04, Math.sin(k * 1.26) * .15, 0, -k * 1.26, 0));
    st.position.set(x, 0, -4.55); szene.add(st);
  }
  // Rechts: Statusmonitore + Funkstation an der Rückwand
  monitor(2.35, 2.55, -5.95, 0, graph, .8, .48); monitor(-2.35, 2.55, -5.95, 0, kamera, .8, .48);
  // Uhr
  const uhrT = textTex('hquhr', '05:12', { w: 512, h: 160, farbe: '#ff2a3d', grund: '#0b0b0d', font: 'bold 120px DejaVu Sans Mono, DejaVu Sans' });
  szene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.9, .28), new THREE.MeshStandardMaterial({ map: uhrT, emissive: 0xffffff, emissiveMap: uhrT, emissiveIntensity: .9 })), 0, 3.05, -5.97));
  // Tisch: Lagekarte, Funkgeräte, Tablet, Becher, Akten, Helm
  szene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.1, .7), new THREE.MeshStandardMaterial({ map: karte, roughness: .9 })), -.4, .792, -1.35, -Math.PI / 2, 0, .1));
  for (const [x, z, ry] of [[.9, -1.0, .3], [1.05, -1.1, .1]]) { const f = new THREE.Group(); f.add(at(box(.07, .2, .04, schwarz), 0, .1, 0)); f.add(at(cyl(.008, .008, .14, schwarz, 6), .02, .27, 0)); f.add(at(box(.05, .03, .005, mat(0x80ed99, { e: 0x80ed99, ei: 1 })), 0, .16, .022)); f.position.set(x, .79, z); f.rotation.y = ry; szene.add(f); }
  for (const [x, z] of [[-1.1, -.9], [.3, -2.0], [1.15, -1.7]]) { szene.add(at(cyl(.04, .035, .1, mat(0xf1f3f5, { r: .4 }), 14), x, .84, z)); szene.add(at(cyl(.036, .036, .005, mat(0x3b2416), 14), x, .888, z)); }
  for (let k = 0; k < 4; k++) szene.add(at(box(.24, .012, .32, mat([0xf8f9fa, 0xffd166, 0xf8f9fa, 0xa9c6e8][k])), -1.0 + k * .03, .795 + k * .012, -1.85 + k * .02, 0, k * .15, 0));
  { const h = new THREE.Mesh(new THREE.SphereGeometry(.14, 18, 10, 0, Math.PI * 2, 0, Math.PI * .52), mat(0x2c3036, { r: .6 })); h.position.set(.95, .79, -2.0); szene.add(h); }
  // Waffenschrank/Ausrüstungsregal rechts vorne
  szene.add(at(box(.5, 2.1, 1.6, mat(0x343a40, { r: .5, m: .4 })), 4.65, 1.05, -.6));
  for (let k = 0; k < 4; k++) { szene.add(at(box(.07, .7, .05, schwarz), 4.38, 1.4, -1.2 + k * .38)); szene.add(at(box(.05, .1, .2, schwarz), 4.38, 1.15, -1.2 + k * .38 + .06)); }
  for (let k = 0; k < 3; k++) szene.add(at(new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 8, 0, Math.PI * 2, 0, Math.PI * .52), mat(0x2c3036)), 4.5, 1.92, -1.1 + k * .5));
  // Decke: Kabeltrasse, Lüftungsrohr, Rauchmelder
  szene.add(at(box(.4, .08, 11, mat(0x868e96, { m: .6, r: .4 })), -2.6, 3.15, -1));
  for (let z = -6; z < 4; z += .6) szene.add(at(box(.42, .1, .03, mat(0x6c757d)), -2.6, 3.15, z));
  { const rohr = cyl(.22, .22, 11, mat(0xadb5bd, { m: .7, r: .35 }), 16); rohr.rotation.x = Math.PI / 2; rohr.position.set(2.8, 3.05, -1); szene.add(rohr); }
  for (const z of [-4, -1, 2]) szene.add(at(cyl(.06, .06, .03, mat(0xf8f9fa), 12), 1.2, 3.33, z));
  // Teppich-Laufzone + Bodenkabelkanal
  szene.add(at(box(3.4, .01, 2.6, mat(0x3a4150, { r: 1 })), 0, .005, -1.4));
  return d;
}
