// Detaillierter Einsatz-Hubschrauber (außen + innen), Rotor-Abwind, Abseilseil.
// Lokale Achsen: vorne = -Z, links = -X (Tür links ist die Abseiltür), Kufen-Unterkante y = 0.
import { THREE, mat, box, cyl, sph, caps, at, liveTex, textTex, rauchTex, rng, clamp, lerp } from './kern.js';
import { Figur } from './figur.js';

export const HELI_BODEN = 0.62;          // Kabinenboden (lokal)

function zeichnePanel(p, t) {
  const g = p.ctx, w = 1024, h = 256;
  g.fillStyle = '#0b0d10'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    const x = 20 + i * 250;
    g.fillStyle = '#0d1b2a'; g.fillRect(x, 20, 230, 216);
    if (i === 0 || i === 3) {   // künstlicher Horizont
      g.save(); g.beginPath(); g.rect(x, 20, 230, 216); g.clip();
      g.translate(x + 115, 128); g.rotate(Math.sin(t * .7) * .08);
      g.fillStyle = '#2f6fb0'; g.fillRect(-200, -200, 400, 200 + Math.sin(t * .5) * 8);
      g.fillStyle = '#7a5230'; g.fillRect(-200, Math.sin(t * .5) * 8, 400, 200);
      g.strokeStyle = '#fff'; g.lineWidth = 3; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(-30, k * 25 + Math.sin(t * .5) * 8); g.lineTo(30, k * 25 + Math.sin(t * .5) * 8); g.stroke(); }
      g.restore(); g.strokeStyle = '#ffd166'; g.lineWidth = 5; g.beginPath(); g.moveTo(x + 70, 128); g.lineTo(x + 105, 128); g.moveTo(x + 125, 128); g.lineTo(x + 160, 128); g.stroke();
    } else if (i === 1) {        // Karte
      g.fillStyle = '#16302b'; g.fillRect(x, 20, 230, 216);
      g.strokeStyle = '#4cc9f0'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 20, 220); g.lineTo(x + 120, 120); g.lineTo(x + 200, 60); g.stroke();
      g.fillStyle = '#ff9f1c'; g.beginPath(); g.arc(x + 200, 60, 8, 0, 7); g.fill();
      g.fillStyle = '#80ed99'; g.font = 'bold 22px DejaVu Sans'; g.fillText('VORFELD OST', x + 30, 48);
    } else {                     // Triebwerkswerte
      g.fillStyle = '#80ed99'; g.font = 'bold 22px DejaVu Sans';
      ['TQ 87%', 'NR 101%', 'T4 712°', 'FUEL 62%'].forEach((s, k) => { g.fillText(s, x + 14, 60 + k * 48); g.fillStyle = '#1b4332'; g.fillRect(x + 140, 44 + k * 48, 76, 18); g.fillStyle = '#80ed99'; g.fillRect(x + 140, 44 + k * 48, 76 * (.5 + .4 * Math.abs(Math.sin(t * .3 + k))), 18); });
    }
  }
  p.tex.needsUpdate = true;
}

export function heliModell({ farbe = 0x2c3e50, piloten = true } = {}) {
  const g = new THREE.Group();
  const lack = mat(farbe, { r: .4, m: .25 }), lack2 = mat(0x1d2731, { r: .5, m: .3 }), dunkel = mat(0x121417, { r: .7 });
  const innen = mat(0x4a5058, { r: .85, side: THREE.DoubleSide }), innenDunkel = mat(0x3d434b, { r: .9, side: THREE.DoubleSide });
  const glas = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: .05, metalness: .6, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false });
  const metall = mat(0x9aa0a6, { r: .3, m: .85 }), gelb = mat(0xffc300, { r: .5 });
  const B = HELI_BODEN;
  // Boden + Unterbau
  g.add(at(box(2.1, .1, 4.4, mat(0x2a2d32, { r: .95 })), 0, B - .05, -.45));
  { const bauch = cyl(1.05, 1.05, 4.4, lack, 28); bauch.rotation.x = Math.PI / 2; bauch.scale.set(1, 1, .22); bauch.position.set(0, B - .3, -.45); g.add(bauch); }
  // Rückwand + hintere Seitenwände (hinter den Türen)
  g.add(at(box(2.1, 1.6, .08, innen), 0, B + .8, 1.72));
  for (const s of [1, -1]) {
    g.add(at(box(.07, 1.6, .5, innen), s * 1.05, B + .8, 1.47));
    g.add(at(box(.09, 1.6, .55, lack), s * 1.1, B + .8, 1.47));
    g.add(at(box(.1, 1.6, .12, lack2), s * 1.08, B + .8, -1.05));                 // Säule Cockpit/Kabine
    g.add(at(box(.1, .14, 2.25, lack2), s * 1.08, B + .05, .1));                 // Türschwelle
    g.add(at(box(.1, .1, 2.25, metall), s * 1.12, B + 1.62, .1));                // Schiebetür-Schiene
    // Schiebetür (offen, nach hinten geschoben)
    const tuer = new THREE.Group(); tuer.position.set(s * 1.17, B + .8, 2.25); g.add(tuer);
    tuer.add(at(box(.06, 1.55, 1.9, lack), 0, 0, 0));
    tuer.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.7, .55), glas), s * .035, .3, -.2, 0, s * Math.PI / 2));
    tuer.add(at(box(.04, .05, .2, metall), s * .05, 0, -.85));
  }
  // Dach, Triebwerksverkleidung, Lufteinlässe
  g.add(at(box(2.2, .1, 4.6, lack), 0, B + 1.65, -.5));
  g.add(at(box(2.06, .04, 4.4, innenDunkel), 0, B + 1.59, -.5));
  { const v = cyl(.65, .7, 3.0, lack, 20); v.rotation.x = Math.PI / 2; v.scale.set(1, 1, .55); v.position.set(0, B + 1.95, .6); g.add(v); }
  for (const s of [1, -1]) { g.add(at(box(.05, .28, .5, dunkel), s * .62, B + 1.95, -.2)); g.add(at(cyl(.16, .2, .4, dunkel, 14), s * .35, B + 2.05, 1.95, Math.PI / 2)); }
  // Cockpit: Nase, Glas, Rahmen
  { const nase = sph(1.08, lack, 28, 18); nase.scale.set(1, .5, 1.1); nase.position.set(0, B + .05, -2.6); g.add(nase); }
  { const kanzel = new THREE.Mesh(new THREE.SphereGeometry(1.06, 28, 16, 0, Math.PI * 2, 0, Math.PI * .5), glas); kanzel.scale.set(1, 1.45, 1.25); kanzel.position.set(0, B + .1, -2.45); g.add(kanzel); }
  for (const x of [-.02, .02]) g.add(at(box(.05, .05, 1.5, lack2), x, B + 1.2, -2.6, -.75));
  for (const s of [1, -1]) g.add(at(box(.06, 1.5, .06, lack2), s * .92, B + .85, -2.1, -.25, 0, s * .1));
  g.add(at(box(2.0, .06, .06, lack2), 0, B + .1, -2.4));
  // Instrumentenbrett + Konsole
  const panel = liveTex(1024, 256);
  g.add(at(box(1.8, .42, .35, dunkel), 0, B + .78, -2.55, -.25));
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.7, .4), new THREE.MeshStandardMaterial({ map: panel.tex, emissive: 0xffffff, emissiveMap: panel.tex, emissiveIntensity: .9 })), 0, B + .8, -2.37, -.25));
  g.add(at(box(.3, .5, .9, dunkel), 0, B + .25, -2.15));
  for (let k = 0; k < 6; k++) g.add(at(box(.04, .03, .03, mat(0x000000, { e: [0x80ed99, 0xff4d4d, 0xffd166][k % 3], ei: 2 })), -.1 + k * .04, B + .51, -2.0));
  g.add(at(box(1.0, .08, .6, dunkel), 0, B + 1.52, -1.8));   // Overhead-Panel
  // Pilotensitze + Steuerknüppel
  const sitzM = mat(0x2b2f36, { r: .9 });
  for (const x of [-.5, .5]) {
    g.add(at(box(.5, .12, .5, sitzM), x, B + .4, -1.75)); g.add(at(box(.46, .55, .1, sitzM), x, B + .72, -1.5, .1));
    g.add(at(cyl(.02, .025, .55, dunkel, 8), x, B + .3, -2.05, -.25)); g.add(at(sph(.04, dunkel), x, B + .56, -2.12));
  }
  // Kabine: Sitzbank hinten (Blick nach vorn) + 2 Sitze rückwärts hinter den Piloten
  const netz = mat(0x3d4a3a, { r: .95 }), rahmen = mat(0x5c636b, { r: .4, m: .6 }), gurt = mat(0x8b1e1e, { r: .8 });
  const kabinenSitz = (x, z, blick) => {
    const s = new THREE.Group();
    s.add(at(box(.46, .06, .45, netz), 0, .45, 0)); s.add(at(box(.46, blick < 0 ? .4 : .6, .05, netz), 0, blick < 0 ? .7 : .8, blick * .22));
    s.add(at(cyl(.015, .015, .45, rahmen, 6), -.23, .22, 0)); s.add(at(cyl(.015, .015, .45, rahmen, 6), .23, .22, 0));
    for (const sx of [-.12, .12]) s.add(at(box(.05, .55, .02, gurt), sx, .78, blick * .19));
    s.position.set(x, B, z); g.add(s);
  };
  for (const x of [-.72, -.24, .24, .72]) kabinenSitz(x, 1.42, 1);
  for (const x of [-.5, .5]) kabinenSitz(x, -.82, -1);
  // Haltegriffe, Headsets, Licht
  for (const x of [-.55, 0, .55]) for (const z of [-.3, .6]) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(.06, .012, 6, 12, Math.PI), mat(0xd8d8d8)), x, B + 1.53, z, Math.PI, 0, 0));
  for (const x of [-.72, -.24, .24, .72]) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(.07, .015, 6, 12, Math.PI), dunkel), x, B + 1.38, 1.66, 0, 0, 0));
  const tag = new THREE.PointLight(0xdfe6f2, 5, 6, 1.2); tag.position.set(0, B + 1.3, .2); g.add(tag);
  const kabLicht = new THREE.PointLight(0xff4050, 1.2, 4.5, 1.5); kabLicht.position.set(0, B + 1.45, .3); g.add(kabLicht);
  for (const z of [-.2, .9]) g.add(at(cyl(.05, .05, .03, mat(0x400000, { e: 0xff2030, ei: 3 }), 12), 0, B + 1.56, z));
  // Abseilbalken über der linken Tür
  const balken = new THREE.Group(); g.add(balken);
  balken.add(at(box(.08, .08, 1.8, metall), -1.6, B + 1.55, -.05));
  for (const z of [-.8, .7]) balken.add(at(box(.6, .06, .06, metall), -1.3, B + 1.55, z));
  balken.add(at(box(.12, .12, .12, gelb), -1.6, B + 1.48, -.05));
  // Seilsäcke am Boden
  g.add(at(cyl(.13, .15, .26, mat(0x3a3f2e, { r: .95 }), 12), .05, B + .13, .55));
  // Abseilseil (wird in der Szene gesetzt)
  const seilM = mat(0x2a2116, { r: 1 });
  const seil = cyl(.022, .022, 1, seilM, 8); seil.position.set(-1.6, B + 1.5, -.05); g.add(seil); seil.visible = false;
  // Heckausleger, Leitwerk, Heckrotor
  { const hb = cyl(.42, .16, 6.2, lack, 18); hb.rotation.x = -Math.PI / 2; hb.position.set(0, B + 1.25, 4.8); g.add(hb); }
  g.add(at(box(.1, 1.3, .9, lack), 0, B + 1.85, 7.9, -.35));
  g.add(at(box(1.7, .07, .45, lack), 0, B + 1.15, 6.9));
  const heckRotor = new THREE.Group(); heckRotor.position.set(.18, B + 2.1, 8.0); g.add(heckRotor);
  for (let k = 0; k < 4; k++) { const b = box(.02, .75, .1, dunkel); b.position.y = .37; const a = new THREE.Group(); a.rotation.x = k * Math.PI / 2; a.add(b); heckRotor.add(a); }
  heckRotor.add(at(cyl(.06, .06, .08, metall, 10), 0, 0, 0, 0, 0, Math.PI / 2));
  // Schriftzug + Warnstreifen
  const schrift = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .38), new THREE.MeshStandardMaterial({ map: textTex('heliFalke', 'FALKE', { w: 512, h: 128, farbe: '#e9ecef', font: 'bold 110px DejaVu Sans' }), transparent: true, roughness: .6 }));
  for (const s of [1, -1]) { const m = schrift.clone(); m.position.set(s * .37, B + 1.3, 4.0); m.rotation.y = s * Math.PI / 2 * 1.0; m.rotation.x = 0; g.add(m); }
  for (const s of [1, -1]) g.add(at(box(.02, .12, 3.2, gelb), s * 1.11, B + .02, -.45));
  // Kufen
  for (const s of [1, -1]) {
    g.add(at(cyl(.05, .05, 3.6, metall, 10), s * .95, .05, -.4, Math.PI / 2));
    g.add(at(cyl(.05, .05, .35, metall, 10), s * .95, .16, -2.25, -1.0));
    for (const z of [-1.3, .7]) g.add(at(cyl(.045, .045, .7, metall, 8), s * .85, .33, z, 0, 0, s * .35));
    g.add(at(box(.25, .03, .5, mat(0x3d4148)), s * 1.12, .5, -.05));             // Trittstufe
  }
  // Positions- und Blitzlichter
  const blitz = [];
  for (const [x, y, z, f] of [[-1.12, B + .3, -1.6, 0xff2030], [1.12, B + .3, -1.6, 0x30ff60], [0, B + 2.2, 8.4, 0xffffff], [0, B - .5, .4, 0xff2030]]) {
    const m = mat(f, { e: f, ei: 2, noCache: true }); const l = sph(.05, m, 8, 6); l.position.set(x, y, z); g.add(l); blitz.push(m);
  }
  const strobe = new THREE.PointLight(0xff3030, 0, 8, 2); strobe.position.set(0, B - .6, .4); g.add(strobe);
  // Suchscheinwerfer unter der Nase
  g.add(at(cyl(.12, .14, .2, dunkel, 12), .4, B - .35, -2.4, Math.PI / 2));
  // Hauptrotor
  g.add(at(cyl(.09, .12, .55, metall, 12), 0, B + 2.4, .2));
  const rotor = new THREE.Group(); rotor.position.set(0, B + 2.68, .2); g.add(rotor);
  rotor.add(at(cyl(.22, .22, .12, metall, 14), 0, 0, 0));
  for (let k = 0; k < 4; k++) { const a = new THREE.Group(); a.rotation.y = k * Math.PI / 2; const b = box(.34, .04, 5.4, dunkel); b.position.z = 2.85; b.rotation.z = .08; a.add(b); a.add(at(box(.36, .045, .3, gelb), 0, 0, 5.4)); rotor.add(a); }
  const scheibe = new THREE.Mesh(new THREE.CircleGeometry(5.6, 48), new THREE.MeshBasicMaterial({ color: 0x15171a, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
  scheibe.rotation.x = -Math.PI / 2; scheibe.position.set(0, B + 2.68, .2); g.add(scheibe);
  // Piloten
  const pil = [];
  if (piloten) for (const x of [-.5, .5]) {
    const f = new Figur({ art: 'zivil', jacke: 0x4b5320, hose: 0x4b5320, schuh: 0x111111, haut: x < 0 ? 0xe0ac69 : 0xc68642, helm: true, visier: true, headset: true, handschuhe: true, groesse: 1.8 });
    g.add(f.root); pil.push({ f, x });
  }
  g.traverse(m => { if (m.isMesh && m.material !== glas) { m.castShadow = true; m.receiveShadow = true; } });
  scheibe.castShadow = false;
  return { g, rotor, heckRotor, scheibe, panel, seil, blitz, strobe, pil, kabLicht, balken };
}

// Pro Frame: Rotoren, Lichter, Piloten, Panel
export function heliUpdate(h, t, { rpm = 1, kurve = 0 } = {}) {
  h.rotor.rotation.y = -t * 7.3 * rpm;            // aliasing-freundlich (wirkt schnell, flackert nicht)
  h.heckRotor.rotation.x = t * 23 * rpm;
  h.scheibe.material.opacity = .1 * rpm;
  const an = Math.floor(t * 1.4) % 2 === 0 && (t * 1.4) % 1 < .12;
  h.blitz[3].emissiveIntensity = an ? 8 : .3; h.strobe.intensity = an ? 6 : 0;
  h.blitz[2].emissiveIntensity = (t * 1.1) % 1 < .08 ? 8 : .5;
  for (const { f, x } of h.pil) {
    f.pose({ beinL: [1.3, 1.2], beinR: [1.3, 1.2], rumpf: [.12, 0, 0], kopf: [.1, Math.sin(t * .4 + x) * .25, 0] });
    f.platziere(x, -1.78, Math.PI, { hoehe: HELI_BODEN + .46 - .98 * f.root.scale.x + .04 });
    const stick = h.g.localToWorld(new THREE.Vector3(x, HELI_BODEN + .58, -2.12 + .02 * Math.sin(t * 2 + kurve)));
    f.greife(x < 0 ? 'R' : 'L', stick, f.lokal(x < 0 ? -.6 : .6, .5, .2));
    f.greife(x < 0 ? 'L' : 'R', h.g.localToWorld(new THREE.Vector3(x + (x < 0 ? .25 : -.25), HELI_BODEN + .55, -1.95)), f.lokal(x < 0 ? .6 : -.6, .5, .2));
  }
  zeichnePanel(h.panel, t);
}

// Seil vom Abseilbalken bis zum Boden (Welt-y bodenY)
export function setzeSeil(h, bodenY, schwing = 0) {
  const oben = h.g.localToWorld(new THREE.Vector3(-1.6, HELI_BODEN + 1.5, -.05));
  const len = Math.max(.1, oben.y - bodenY);
  h.seil.visible = true; h.seil.scale.y = len / h.g.scale.y;
  h.seil.position.set(-1.6, HELI_BODEN + 1.5 - len / 2, -.05);
  h.seil.rotation.z = schwing;
  return { oben, len };
}

// Abwind: Staub, Gischt, Blätter fliegen radial weg (deterministisch aus t)
export class Abwind {
  constructor(szene, n = 70, { farbe = 0xb8b1a3, seed = 5 } = {}) {
    const r = rng(seed), tx = rauchTex();
    this.mitte = new THREE.Vector3(); this.p = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, color: farbe, transparent: true, depthWrite: false }));
      s.userData = { w: r() * Math.PI * 2, ph: r(), v: 4 + r() * 6, gr: .8 + r() * 1.6, auf: .3 + r() * 1.2 };
      szene.add(s); this.p.push(s);
    }
    const fg = new THREE.BufferGeometry(); this.kp = new Float32Array(160 * 3); fg.setAttribute('position', new THREE.BufferAttribute(this.kp, 3));
    this.krumen = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0x5c5346, size: .04, transparent: true, depthWrite: false })); this.krumen.frustumCulled = false; szene.add(this.krumen);
    this.kd = Array.from({ length: 160 }, () => [r() * Math.PI * 2, r(), 5 + r() * 9]);
  }
  update(t, staerke, mitte, boden = 0, kam = null) {
    this.mitte.copy(mitte);
    for (const s of this.p) {
      const u = s.userData; const k = (t * .55 + u.ph) % 1;
      const rad = 1.2 + k * u.v * 1.6;
      s.position.set(mitte.x + Math.cos(u.w + k * .4) * rad, boden + .2 + k * u.auf, mitte.z + Math.sin(u.w + k * .4) * rad);
      const sz = u.gr * (.6 + k * 1.8); s.scale.set(sz, sz * .7, 1);
      const nah = kam ? clamp((s.position.distanceTo(kam.position) - 1.5) / 3.5) : 1;
      s.material.opacity = .3 * staerke * Math.sin(Math.PI * k) * nah; s.visible = staerke > .01;
    }
    this.kd.forEach(([w, ph, v], i) => {
      const k = (t * .9 + ph) % 1; const rad = 1 + k * v;
      this.kp.set([mitte.x + Math.cos(w) * rad, boden + .05 + Math.sin(k * Math.PI) * .8, mitte.z + Math.sin(w) * rad], i * 3);
    });
    this.krumen.geometry.attributes.position.needsUpdate = true; this.krumen.material.opacity = staerke; this.krumen.visible = staerke > .01;
  }
}
