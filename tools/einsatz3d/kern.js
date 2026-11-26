// Kern: Mathe-Helfer, Materialien, prozedurale Texturen, Grundkörper.
import * as THREE from 'three';
export { THREE };

export const W = 1080, H = 1920, FPS = 30;

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeIn = x => Math.pow(clamp(x), 3);
export const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeBack = x => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// deterministischer Zufall
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---------------------------------------------------------------- Materialien
const matCache = new Map();
// Cartoon-Modus (Mix aus Comic-Stil und 3D): Toon-Shading mit 3 Helligkeitsstufen statt realistischem PBR
let TOON = false, toonVerlauf = null;
export function setzeToon(an = true) { TOON = an; }
function verlauf() {
  if (toonVerlauf) return toonVerlauf;
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  toonVerlauf = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); toonVerlauf.minFilter = toonVerlauf.magFilter = THREE.NearestFilter; toonVerlauf.needsUpdate = true;
  return toonVerlauf;
}
export function mat(color, o = {}) {
  const key = JSON.stringify([TOON, o.weich, color, o.r, o.m, o.e, o.ei, o.map?.uuid, o.transparent, o.opacity, o.side, o.flat, o.envI]);
  if (!o.noCache && matCache.has(key)) return matCache.get(key);
  if (TOON && o.weich) {   // Haut: weich schattiert (keine harten Toon-Stufen → keine Streifen im Gesicht)
    const m = new THREE.MeshLambertMaterial({ color, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map ?? null, side: o.side ?? THREE.FrontSide });
    if (!o.noCache) matCache.set(key, m); return m;
  }
  if (TOON) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: verlauf(), emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map ?? null,
      transparent: o.transparent ?? false, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
    if ((o.m ?? 0) > .5 && !o.map) m.color.multiplyScalar(.85);
    if (!o.noCache) matCache.set(key, m);
    return m;
  }
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.75, metalness: o.m ?? 0.0,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map ?? null,
    transparent: o.transparent ?? false, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
    flatShading: o.flat ?? false, envMapIntensity: o.envI ?? 0.6,
  });
  if (!o.noCache) matCache.set(key, m);
  return m;
}
export function grundmat(color) { return new THREE.MeshBasicMaterial({ color }); }

// ---------------------------------------------------------------- Texturen (Canvas)
const texCache = new Map();
export function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  if (texCache.has(key)) {
    const t = texCache.get(key).clone(); t.needsUpdate = true; t.repeat.set(...repeat); return t;
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(...repeat);
  texCache.set(key, t);
  return t;
}
export function liveTex(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, ctx: c.getContext('2d'), tex: t };
}

export function ziegelTex(farbe = '#8b4a2b', fuge = '#5e2f1b', repeat = [4, 4]) {
  return canvasTex('ziegel' + farbe, 512, 512, (g, w, h) => {
    g.fillStyle = fuge; g.fillRect(0, 0, w, h);
    const r = rng(5), bh = 32, bw = 96;
    for (let y = 0; y < h; y += bh) for (let x = -bw; x < w + bw; x += bw) {
      const off = (y / bh) % 2 ? bw / 2 : 0, v = 0.82 + r() * 0.3;
      const c = parseInt(farbe.slice(1), 16);
      g.fillStyle = `rgb(${((c >> 16) & 255) * v | 0},${((c >> 8) & 255) * v | 0},${(c & 255) * v | 0})`;
      g.fillRect(x + off + 3, y + 3, bw - 6, bh - 6);
    }
  }, repeat);
}
export function betonTex(farbe = '#55595f', repeat = [6, 6], key = 'beton') {
  return canvasTex(key + farbe, 512, 512, (g, w, h) => {
    g.fillStyle = farbe; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 2600; i++) {
      const v = r() * 40 - 20; g.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},0.08)`;
      g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6);
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += r() * 40 - 20; y += r() * 40 - 20; g.lineTo(x, y); } g.stroke(); }
  }, repeat);
}
export function holzTex(repeat = [1, 8]) {
  return canvasTex('holz', 256, 512, (g, w, h) => {
    g.fillStyle = '#6f4e37'; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let y = 0; y < h; y += 64) {
      g.fillStyle = `rgb(${100 + r() * 30},${70 + r() * 20},${48 + r() * 15})`; g.fillRect(0, y + 2, w, 60);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, y + 8 + r() * 50); g.bezierCurveTo(80, y + r() * 60, 160, y + r() * 60, w, y + 8 + r() * 50); g.stroke(); }
    }
  }, repeat);
}
export function rolltorTex(repeat = [1, 1]) {
  return canvasTex('rolltor', 256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 16) { g.fillStyle = '#9aa0a6'; g.fillRect(0, y, w, 12); g.fillStyle = '#6c7177'; g.fillRect(0, y + 12, w, 4); }
  }, repeat);
}
export function molleTex(farbe = '#3b3f35') {
  return canvasTex('molle' + farbe, 128, 128, (g, w, h) => {
    g.fillStyle = farbe; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = 10; y < h; y += 22) g.fillRect(0, y, w, 5);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 14; y < h; y += 22) g.fillRect(0, y, w, 2);
  }, [2, 2]);
}
export function nummerTex(n, farbe = '#e9ecef', grund = '#22252a') {
  return canvasTex('nr' + n + farbe + grund, 256, 256, (g, w, h) => {
    g.fillStyle = grund; g.fillRect(0, 0, w, h);
    g.strokeStyle = farbe; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = farbe; g.font = 'bold 180px DejaVu Sans, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), w / 2, h / 2 + 10);
  });
}
export function textTex(key, text, { w = 512, h = 256, farbe = '#ffffff', grund = 'rgba(0,0,0,0)', font = 'bold 150px DejaVu Sans, Arial' } = {}) {
  return canvasTex('txt' + key, w, h, (g) => {
    g.fillStyle = grund; g.fillRect(0, 0, w, h);
    g.fillStyle = farbe; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2);
  });
}
export function radialTex(key, stops) {
  return canvasTex(key, 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [p, c] of stops) gr.addColorStop(p, c);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
export function rauchTex() {
  return canvasTex('rauch', 256, 256, (g, w, h) => {
    const r = rng(12);
    for (let i = 0; i < 40; i++) {
      const x = w / 2 + (r() - .5) * w * .5, y = h / 2 + (r() - .5) * h * .5, rad = 30 + r() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
}

// ---------------------------------------------------------------- Grundkörper
function fertig(m, schatten = true) { m.castShadow = schatten; m.receiveShadow = true; return m; }
export const box = (w, h, d, m, s = true) => fertig(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), s);
export const cyl = (rt, rb, h, m, seg = 16, s = true) => fertig(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m), s);
export const sph = (r, m, ws = 18, hs = 14, s = true) => fertig(new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m), s);
export const caps = (r, len, m, s = true) => fertig(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m), s);
export function plane(w, h, m, s = false) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.receiveShadow = true; p.castShadow = s; return p; }
export function at(obj, x, y, z, rx = 0, ry = 0, rz = 0) { obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz); return obj; }
export function gruppe(...kinder) { const g = new THREE.Group(); for (const k of kinder) g.add(k); return g; }

// Boden + Wand-Helfer
export function bodenPlatte(w, d, material, x = 0, z = 0, y = 0) {
  const p = plane(w, d, material); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); return p;
}

// Weltposition eines Objekts
const _v = new THREE.Vector3();
export function weltPos(obj, ziel = new THREE.Vector3()) { obj.updateWorldMatrix(true, false); return ziel.setFromMatrixPosition(obj.matrixWorld); }
export { _v };
