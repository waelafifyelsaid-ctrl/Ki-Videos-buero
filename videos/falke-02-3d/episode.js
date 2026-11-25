// EINHEIT FALKE – Einsatz 02: Das Flugzeug (3D, nur POV, Morgennebel).
import {
  THREE, W, H, mat, box, cyl, sph, caps, at, bodenPlatte, clamp, lerp, easeOut, easeInOut, easeBack, smooth,
  betonTex, holzTex, liveTex, weltPos, rng, radialTex,
} from '/tools/einsatz3d/kern.js';
import { Figur, gehPose, rennPose, hockPose, stehPose, schildModell, handschellenModell } from '/tools/einsatz3d/figur.js';
import { renderer, Post, UEBERGANG, Explosion, Schwaden, schild, hauptquartier } from '/tools/einsatz3d/welt.js';
import { Pov } from '/tools/einsatz3d/pov.js';

const TL = await (await fetch('./timeline_fertig.json')).json();
const R = renderer();
const POST = new Post(R);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SZ = n => TL.szenen.find(s => s.n === n);
const L = (n, anfang) => TL.dialog.find(z => z.szene === n && z.text.startsWith(anfang));
function zeile(n, lt) { let a = null; for (const z of TL.dialog) if (z.szene === n && lt >= z.start && lt < z.ende) a = z; return a; }
const redet = (n, lt, wer) => { const z = zeile(n, lt); return z && (z.wer === wer || z.wer === wer + 'v') ? 0.35 + 0.5 * Math.abs(Math.sin(lt * 17)) : 0; };

function kamera(szene, fov = 74) { const k = new THREE.PerspectiveCamera(fov, W / H, 0.03, 600); k.rotation.order = 'YXZ'; szene.add(k); return k; }
function schau(k, pos, ziel, roll = 0) {
  k.position.copy(pos); const d = ziel.clone().sub(pos);
  k.rotation.set(Math.atan2(d.y, Math.hypot(d.x, d.z)), Math.atan2(-d.x, -d.z), roll); k.updateMatrixWorld(true);
}
function pfad(keys, t) {
  let dist = 0;
  if (t <= keys[0][0]) return { x: keys[0][1], z: keys[0][2], vx: 0, vz: 0, s: 0, dist: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0, z0] = keys[i], [t1, x1, z1] = keys[i + 1]; const seg = Math.hypot(x1 - x0, z1 - z0);
    if (t <= t1) { const k = (t - t0) / (t1 - t0); return { x: lerp(x0, x1, k), z: lerp(z0, z1, k), vx: (x1 - x0) / (t1 - t0), vz: (z1 - z0) / (t1 - t0), s: seg / (t1 - t0), dist: dist + seg * k }; }
    dist += seg;
  }
  const l = keys[keys.length - 1]; return { x: l[1], z: l[2], vx: 0, vz: 0, s: 0, dist };
}
const richtung = (vx, vz, sonst) => (Math.hypot(vx, vz) > 0.05 ? Math.atan2(vx, vz) : sonst);
const wackel = (t, st) => { const r = rng(Math.floor(t * 30)); return V3((r() - .5) * st, (r() - .5) * st, 0); };

const OPS = { 1: { headset: true, groesse: 1.86 }, 2: { groesse: 1.98, visier: true }, 4: { groesse: 1.72, visier: true }, 7: { groesse: 1.76, headset: true } };
const teamOps = (s, nr) => { const f = new Figur({ art: 'team', nummer: nr, maske: true, helm: true, ...OPS[nr] }); s.add(f.root); return f; };
const ZIVIL = {
  1: { haut: 0xe0ac69, haare: true, haarfarbe: 0x9a9a9a, bart: 0xa5a5a5, groesse: 1.86 }, 2: { haut: 0x7a4a2a, groesse: 1.98 },
  4: { haut: 0xf1c27d, haare: true, haarfarbe: 0x6f1d1b, dutt: true, groesse: 1.72 }, 7: { haut: 0xffdbac, haare: true, haarfarbe: 0x5b3a29, brille: true, groesse: 1.76 },
};
const teamHq = (s, nr) => { const f = new Figur({ art: 'zivil', jacke: 0x2e3440, hose: 0x262a31, schuh: 0x16181b, rueckenNr: true, nummer: nr, ...ZIVIL[nr] }); s.add(f.root); return f; };
function sitz(f, x, z, yaw, hoehe, extra = {}) {
  f.pose({ beinL: [1.5, 1.55], beinR: [1.42, 1.5], rumpf: [.08, 0, 0], ...extra });
  f.platziere(x, z, yaw, { hoehe: hoehe - .98 * f.root.scale.x + .04 });
}

// ======================================================================= WELT 1: Hauptquartier (früh am Morgen)
const HQ = (() => {
  const s = new THREE.Scene(); const hq = hauptquartier(s);
  const k = kamera(s, 72); const pov = new Pov(k, { aermel: 0x2e3440, handschuhe: false });
  const t = { 1: teamHq(s, 1), 2: teamHq(s, 2), 4: teamHq(s, 4), 7: teamHq(s, 7) };
  const chefin = new Figur({ art: 'chefin', jacke: 0x5c636e, hose: 0x3a3f47, schuh: 0x111111, haare: true, haarfarbe: 0xe9ecef, dutt: true, brille: true, haut: 0xf1c9a5, groesse: 1.7 });
  s.add(chefin.root);
  const croissant = new THREE.Mesh(new THREE.TorusGeometry(.06, .035, 8, 14, Math.PI * 1.2), mat(0xd4a35a, { r: .8 })); s.add(croissant);
  return { s, hq, k, pov, t, chefin, croissant };
})();
function zeichneHqSchirm(lt, t) {
  const g = HQ.hq.schirm.ctx, w = 1600, h = 900;
  g.fillStyle = '#0d1b2a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#415a77'; g.fillRect(100, 520, 1400, 90); g.fillRect(250, 300, 70, 300); g.fillRect(250, 300, 900, 60);
  g.fillStyle = '#e0e1dd'; for (let x = 130; x < 1480; x += 80) g.fillRect(x, 560, 40, 8);
  const jx = 320 + ((lt * 30) % 700);
  g.save(); g.translate(jx, 330); g.fillStyle = '#ff9f1c'; g.beginPath(); g.moveTo(40, 0); g.lineTo(-30, -14); g.lineTo(-30, 14); g.closePath(); g.fill(); g.fillRect(-10, -40, 14, 80); g.restore();
  const p = (lt * 1.1) % 1; g.strokeStyle = `rgba(255,159,28,${1 - p})`; g.lineWidth = 8; g.beginPath(); g.arc(jx, 330, 50 + 60 * p, 0, 7); g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 66px DejaVu Sans'; g.textAlign = 'left'; g.fillText('FLUG FX-77 · VORFELD OST', 60, 110);
  g.fillStyle = '#ff4d6d'; g.font = 'bold 54px DejaVu Sans'; g.fillText(`START IN ${String(19 - Math.floor(lt / 3)).padStart(2, '0')}:${String(59 - Math.floor(lt * 7) % 60).padStart(2, '0')}`, 60, 190);
  HQ.hq.schirm.tex.needsUpdate = true;
}
function zeichneNebelFenster(fx, t) {
  const g = fx.ctx, gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#6d7f99'); gr.addColorStop(.6, '#e8b89a'); gr.addColorStop(1, '#b7c1cc'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,255,255,0.25)'; for (let k = 0; k < 6; k++) g.fillRect(0, 300 + k * 30 + 10 * Math.sin(t + k), 512, 18);
  fx.tex.needsUpdate = true;
}
function s_hq(lt, t) {
  const { k, pov, t: tm, chefin, hq } = HQ;
  zeichneHqSchirm(lt, t); zeichneNebelFenster(hq.fenster, t);
  hq.alarm.intensity = 0; hq.alarmLampe.material.emissiveIntensity = 0; hq.helm6.visible = true;
  schau(k, V3(.25 + .02 * Math.sin(t * .6), 1.68, .55), V3(-.15, 1.45, -5.9));
  chefin.pose({ ...stehPose(t), kopf: [0, .3, 0], mund: redet('hq', lt, 'Z'), armL: [lt < 6.8 ? 1.3 + .15 * Math.sin(lt * 2) : .1, .5], ellL: .3 });
  chefin.platziere(-1.45, -5.2, .3);
  const z2 = L('hq', 'Gibt'), z4 = L('hq', 'Nein');
  const stell = (nr, x, z, yaw, extra = {}) => { tm[nr].pose({ ...stehPose(t + nr), mund: redet('hq', lt, String(nr)), ...extra }); tm[nr].platziere(x, z, yaw); };
  stell(1, 1.05, -3.35, -2.6, { kopf: [0, lt > L('hq', 'Dann').start ? .5 : 0, 0], armR: [.9, .1], ellR: 1.7 });
  const beiss = lt < z2.start && (lt * .9) % 1 < .3;
  stell(2, -.55, -2.75, 2.7, { kopf: [beiss ? .2 : 0, lt > z2.start && lt < z4.ende ? -.6 : 0, 0], mund: redet('hq', lt, '2') || (beiss ? .5 : 0), armR: [beiss ? 1.9 : 1.0, .1], ellR: beiss ? 2.3 : 1.6 });
  HQ.croissant.position.copy(weltPos(tm[2].j.haR)).add(V3(0, -.03, .05));
  stell(4, .25, -3.95, 3.0, { kopf: [0, lt > z4.start ? -.7 : 0, 0], armL: [.9, -.2, .4], ellL: 1.9, armR: [.9, -.2, .4], ellR: 1.9 });
  stell(7, -1.35, -3.45, 2.4, { kopf: [.3, 0, 0], armL: [.8, .1], ellL: 1.6, armR: [.8, .1], ellR: 1.6 });
  pov.setze({ modus: 'tasse', t, zielL: k.localToWorld(V3(-.3, -.5, -.35)) });
  return { welt: HQ, uhr: '05:12' };
}

// ======================================================================= WELT 2: Hubschrauber (innen, Tür offen)
const HELI = (() => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0xb9c3d0); s.fog = new THREE.Fog(0xb9c3d0, 90, 700);
  s.add(new THREE.HemisphereLight(0xe8eefc, 0x40444c, 1.1));
  const sonne = new THREE.DirectionalLight(0xffd2a6, 2.0); sonne.position.set(-6, 3, 1); s.add(sonne); s.add(sonne.target);
  const innen = mat(0x3d4148, { r: .8 }), dunkel = mat(0x23262b, { r: .8 });
  s.add(at(box(2.3, .1, 3.6, mat(0x2a2d32, { r: .9 })), 0, -.05, -.1));
  s.add(at(box(.08, 1.7, 3.6, innen), 1.12, .85, -.1));
  s.add(at(box(.08, 1.7, 1.4, innen), -1.12, .85, -1.1)); s.add(at(box(.08, 1.7, .6, innen), -1.12, .85, 1.3));
  s.add(at(box(.08, .25, 1.4, innen), -1.12, 1.6, .3));
  s.add(at(box(2.3, .08, 3.6, dunkel), 0, 1.72, -.1)); s.add(at(box(2.3, 1.7, .08, innen), 0, .85, -1.88)); s.add(at(box(2.3, 1.7, .08, innen), 0, .85, 1.62));
  s.add(at(box(.9, .5, .02, mat(0x9fb2c8, { e: 0x7088a8, ei: .6 })), 0, 1.15, -1.83));
  s.add(at(cyl(.025, .025, 1.4, mat(0x9aa0a6, { m: .8, r: .3 }), 8), -.95, 1.55, .3, Math.PI / 2));   // Abseilstange
  for (const z of [-.9, .2, 1.1]) s.add(at(new THREE.Mesh(new THREE.TorusGeometry(.16, .035, 8, 16), mat(0x2b2d42)), -1.0, .35, z, Math.PI / 2));   // Seilrollen
  for (const [x, z0, z1] of [[.85, -1.8, 1.5], [-.85, -1.8, -.45]]) {
    s.add(at(box(.45, .08, z1 - z0, mat(0x5b5f3a, { r: .9 })), x, .46, (z0 + z1) / 2));
    s.add(at(box(.08, .55, z1 - z0, mat(0x4b4f2a, { r: .9 })), x + Math.sign(x) * .2, .78, (z0 + z1) / 2));
    for (let z = z0 + .3; z < z1; z += .55) s.add(at(box(.05, .5, .04, mat(0xc1121f)), x + Math.sign(x) * .16, .8, z));   // Gurte
  }
  for (const z of [-1.3, -.1]) s.add(at(cyl(.06, .06, .05, mat(0x400000, { e: 0xff2030, ei: 3 }), 12), 0, 1.68, z));
  const rot = new THREE.PointLight(0xff3040, 2.5, 4, 1.6); rot.position.set(0, 1.5, -.5); s.add(rot);
  // Draußen: Felder, Straßen, Lichter – ziehen unter uns vorbei
  const feld = liveTex(1024, 1024); { const g = feld.ctx, r = rng(3);
    for (let i = 0; i < 64; i++) { g.fillStyle = ['#7d8a6a', '#8f9c78', '#a09a7a', '#6e7c5e', '#9aa58a'][i % 5]; g.fillRect((i % 8) * 128, Math.floor(i / 8) * 128, 128, 128); }
    g.fillStyle = '#4a4f57'; g.fillRect(500, 0, 30, 1024); g.fillRect(0, 300, 1024, 20);
    g.fillStyle = '#ffd27a'; for (let i = 0; i < 60; i++) g.fillRect(r() * 1024, r() * 1024, 4, 4); feld.tex.needsUpdate = true; }
  feld.tex.wrapS = feld.tex.wrapT = THREE.RepeatWrapping; feld.tex.repeat.set(6, 6);
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ map: feld.tex, roughness: 1 }));
  boden.rotation.x = -Math.PI / 2; boden.position.y = -110; s.add(boden);
  const glut = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('sonne', [[0, 'rgba(255,240,200,1)'], [.3, 'rgba(255,190,120,.6)'], [1, 'rgba(255,170,100,0)']]), fog: false, depthWrite: false }));
  glut.position.set(-220, 10, 40); glut.scale.set(140, 140, 1); s.add(glut);
  const k = kamera(s, 76); const pov = new Pov(k);
  const t = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  return { s, k, pov, t, boden, feld, sonne, rot };
})();
function s_heli(lt, t) {
  const { k, pov, t: tm, feld, sonne } = HELI;
  const d = SZ('heli').d;
  feld.tex.offset.set(0, (t * .018) % 1);
  sonne.intensity = 1.6 + .5 * (Math.sin(t * 2 * Math.PI * 4.6) > .6 ? -1 : 0);   // Rotorblätter werfen Schatten
  const kurve = smooth(d - 2.2, d - .6, lt);
  const w = wackel(t, .012);
  schau(k, V3(.72, 1.08, .6).add(w), V3(-1.5, .05 - .5 * kurve, -1.0), .03 * Math.sin(t * 1.3) - .18 * kurve);
  const sitzen = (nr, x, z, yaw, extra = {}) => { sitz(tm[nr], x, z, yaw, .5, { mund: redet('heli', lt, String(nr)), ...extra }); };
  sitzen(1, -.85, -1.45, Math.PI / 2, { kopf: [0, lt > L('heli', 'Pilot').start - .2 ? -1.1 : .3, 0] }); tm[1].haltGewehr('hoch');
  sitzen(2, -.85, -.8, Math.PI / 2, { kopf: [lt < L('heli', 'Sieben').start ? .2 : 0, .25, 0] }); tm[2].haltGewehr('hoch');
  sitzen(4, .85, -1.45, -Math.PI / 2, { kopf: [.1, lt > L('heli', 'Jet').start - .2 ? .9 : -.2, 0] }); tm[4].haltGewehr('hoch');
  const r7 = redet('heli', lt, '7');
  sitzen(7, .85, -.55, -Math.PI / 2, { kopf: [r7 ? -.1 : .45, r7 ? -.6 : .5, 0], armL: [2.9, .1], ellL: .3 });
  tm[7].ohneGewehr();
  pov.setze({ modus: 'gewehr', t, senken: .4, zielen: -.25 });
  return { welt: HELI, uhr: '05:24' };
}

// ======================================================================= WELT 3: Vorfeld mit Privatjet (Landung, Tür, Kabine, Twist, Hook)
function bauJet(s) {
  const j = new THREE.Group(); s.add(j);
  const lack = mat(0xf1f3f5, { r: .35, m: .1 }), streifen = mat(0x1d3557, { r: .4 }), dunkel = mat(0x15171c, { r: .3, m: .4 });
  const innenWand = mat(0xe8dcc8, { r: .8, side: THREE.BackSide });
  const Y = 2.45, R0 = 1.15;
  const rumpf = (z0, z1, offen = false) => {
    const len = z0 - z1;
    const geo = offen ? new THREE.CylinderGeometry(R0, R0, len, 40, 1, true, 2.28, 2 * Math.PI - 1.69) : new THREE.CylinderGeometry(R0, R0, len, 40, 1, true);
    const m = new THREE.Mesh(geo, lack); m.rotation.x = Math.PI / 2; m.position.set(0, Y, (z0 + z1) / 2); m.castShadow = true; j.add(m);
    const geoI = offen ? new THREE.CylinderGeometry(R0 - .05, R0 - .05, len, 40, 1, true, 2.28, 2 * Math.PI - 1.69) : new THREE.CylinderGeometry(R0 - .05, R0 - .05, len, 40, 1, true);
    const mi = new THREE.Mesh(geoI, innenWand); mi.rotation.x = Math.PI / 2; mi.position.copy(m.position); j.add(mi);
  };
  rumpf(-2.0, -2.6); rumpf(-2.6, -3.5, true); rumpf(-3.5, -13);
  const nase = sph(R0, lack, 32, 20); nase.scale.set(1, 1, 1.75); nase.position.set(0, Y, -2.0); j.add(nase);
  const nasenInnen = new THREE.Mesh(new THREE.SphereGeometry(R0 - .05, 28, 16), mat(0x3a3d42, { side: THREE.BackSide })); nasenInnen.scale.set(1, 1, 1.75); nasenInnen.position.copy(nase.position); j.add(nasenInnen);
  const heck = new THREE.Mesh(new THREE.CylinderGeometry(R0, .25, 4.2, 32), lack); heck.rotation.x = -Math.PI / 2; heck.position.set(0, Y + .2, -15.1); heck.castShadow = true; j.add(heck);
  j.add(at(box(.04, .16, 13.5, streifen), R0 + .005, Y - .25, -8)); j.add(at(box(.04, .16, 13.5, streifen), -R0 - .005, Y - .25, -8));
  for (const sx of [1, -1]) {   // Fenster außen
    for (let z = -4.3; z > -11.5; z -= .95) { const f = new THREE.Mesh(new THREE.CircleGeometry(.17, 18), dunkel); f.scale.set(.8, 1.15, 1); f.position.set(sx * (R0 + .01), Y + .25, z); f.rotation.y = sx * Math.PI / 2; j.add(f); }
    const fw = new THREE.Mesh(new THREE.CircleGeometry(.17, 18), mat(0xfff1d6, { e: 0xffe2b0, ei: 1.2, side: THREE.BackSide }));
    for (let z = -4.3; z > -11.5; z -= .95) { const f = fw.clone(); f.scale.set(.8, 1.15, 1); f.position.set(sx * (R0 - .07), Y + .25, z); f.rotation.y = sx * Math.PI / 2; j.add(f); }
  }
  j.add(at(box(1.3, .3, .05, dunkel), 0, Y + .55, -.95, -.9));       // Cockpitscheibe
  for (const sx of [1, -1]) {   // Flügel, Winglets, Triebwerke
    const fl = box(6.2, .16, 2.3, lack); fl.position.set(sx * 3.9, 1.7, -8.6); fl.rotation.y = sx * .32; j.add(fl);
    j.add(at(box(.12, 1.0, .9, lack), sx * 6.9, 2.15, -9.9, 0, 0, sx * -.2));
    const tw = cyl(.55, .5, 2.6, lack, 24); tw.rotation.x = Math.PI / 2; tw.position.set(sx * 1.85, 3.0, -13.3); j.add(tw);
    const ein = cyl(.46, .46, .05, mat(0x2b2d31, { m: .6 }), 24); ein.rotation.x = Math.PI / 2; ein.position.set(sx * 1.85, 3.0, -12.0); j.add(ein);
    j.add(at(box(.6, .15, .8, lack), sx * 1.4, 2.9, -13.3));
  }
  j.add(at(box(.14, 3.0, 2.0, lack), 0, 4.6, -16.0, -.35)); j.add(at(box(4.4, .12, 1.2, lack), 0, 6.0, -16.9));
  const kennung = schild(s, 'FX-77', 0, 0, 0, 0, { w: 1.6, h: .5, farbe: '#1d3557', font: 'bold 160px DejaVu Sans, Arial' }); s.remove(kennung);
  kennung.position.set(R0 + .02, Y + .1, -12.0); kennung.rotation.y = Math.PI / 2; j.add(kennung);
  // Fahrwerk
  const raeder = [];
  for (const [x, z] of [[0, -2.6], [1.3, -9.0], [-1.3, -9.0]]) {
    j.add(at(cyl(.07, .07, 1.2, mat(0x8d99ae, { m: .7 }), 8), x, .9, z));
    for (const dx of [-.16, .16]) { const r = cyl(.32, .32, .2, mat(0x111111), 18); r.rotation.z = Math.PI / 2; r.position.set(x + dx, .32, z); j.add(r); raeder.push(r); }
  }
  // Landescheinwerfer
  const licht = [];
  for (const sx of [-.35, .35]) { const sp = new THREE.SpotLight(0xfff6e0, 0, 70, .22, .6, 1.4); sp.position.set(sx, 1.4, -2.3); sp.target.position.set(sx * 3, .5, 40); j.add(sp); j.add(sp.target); licht.push(sp);
    j.add(at(sph(.08, mat(0xffffff, { e: 0xfff6e0, ei: 0 })), sx, 1.4, -2.2)); }
  // Tür: Airstair, Scharnier unten, klappt nach außen zur Treppe
  const pivot = new THREE.Group(); pivot.position.set(R0 + .01, 1.5, -3.05); j.add(pivot);
  const tuer = new THREE.Group(); pivot.add(tuer);
  tuer.add(at(box(.07, 1.7, .9, lack), .035, .85, 0));
  tuer.add(at(box(.02, .12, .5, streifen), .075, .55, 0));
  for (let k2 = 0; k2 < 5; k2++) tuer.add(at(box(.22, .04, .82, mat(0x5c636b, { m: .5 })), -.11, .2 + k2 * .32, 0));   // Stufen (innen)
  tuer.add(at(box(.06, .05, .12, mat(0xced4da, { m: .9 })), .085, 1.0, .32));   // Griff
  // Kabine innen
  j.add(at(box(1.95, .08, 11.0, mat(0x6b5b4e, { r: .9 })), 0, 1.46, -7.4));
  for (const [x, w] of [[-.68, .55], [.68, .55]]) j.add(at(box(w, 1.6, .06, mat(0xd8cbb5)), x, 2.3, -2.45));   // Cockpit-Trennwand
  j.add(at(box(1.95, .45, .06, mat(0xd8cbb5)), 0, 3.15, -2.45));
  const sitzM = mat(0xc9b28a, { r: .55 }), holz = mat(0x6f4e37, { r: .4, map: holzTex([1, 1]) });
  const sitze = {};
  const sessel = (x, z, blick) => {
    const g = new THREE.Group(); g.add(at(box(.6, .14, .6, sitzM), 0, .42, 0)); g.add(at(box(.6, .7, .14, sitzM), 0, .75, -blick * .26));
    for (const sx of [-.27, .27]) g.add(at(box(.08, .2, .55, sitzM), sx, .58, 0));
    g.position.set(x, 1.5, z); j.add(g); return g;
  };
  for (const [z, blick] of [[-4.3, 1], [-5.7, -1], [-7.4, 1], [-8.8, -1], [-10.4, 1]]) for (const x of [-.55, .55]) sitze[`${x}_${z}`] = sessel(x, z, blick);
  for (const z of [-5.0, -8.1]) for (const x of [-.55, .55]) j.add(at(box(.55, .05, .55, holz), x, 2.22, z));
  for (const z of [-3.5, -6.5, -9.5]) { const l = new THREE.PointLight(0xffe2b8, 9, 9, 1.4); l.position.set(0, 3.2, z); j.add(l); }
  j.add(at(box(.3, .02, 10, mat(0xfff6e0, { e: 0xffe2b8, ei: 1.5 })), 0, 3.5, -7.5));
  // Cockpit: zwei Sitze, Instrumente
  for (const x of [-.4, .4]) { const g = new THREE.Group(); g.add(at(box(.5, .12, .5, mat(0x2b2d31)), 0, .45, 0)); g.add(at(box(.5, .7, .1, mat(0x2b2d31)), 0, .8, -.25)); g.position.set(x, 1.5, -1.45); j.add(g); }
  j.add(at(box(1.6, .35, .4, mat(0x1b1d21, { e: 0x2a6f97, ei: .5 })), 0, 2.2, -.55));
  return { j, pivot, tuer, raeder, licht };
}

const VF = (() => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0xbfc8d3); s.fog = new THREE.Fog(0xbfc8d3, 6, 95);
  s.add(new THREE.HemisphereLight(0xe9eef7, 0x6a6660, 1.7));
  const fuell = new THREE.DirectionalLight(0xdfe6f2, .9); fuell.position.set(30, 10, 40); s.add(fuell);
  const sonne = new THREE.DirectionalLight(0xffd4ab, 1.6); sonne.position.set(-25, 18, 20); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048);
  Object.assign(sonne.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 }); s.add(sonne); s.add(sonne.target);
  s.add(bodenPlatte(500, 500, mat(0x8e9298, { r: .6, map: betonTex('#8e9298', [60, 60], 'vorfeld') }), 0, -40));
  for (let z = 20; z > -180; z -= 6) s.add(at(box(.18, .01, 3.6, mat(0xf2c14e, { e: 0x4a3a10, ei: .3 })), 0, .006, z));   // Mittellinie
  for (const x of [-12, 12]) for (let z = 20; z > -180; z -= 14) s.add(at(sph(.12, mat(0x3a7bff, { e: 0x3a7bff, ei: 4 }), 8, 6), x, .15, z));
  s.add(at(box(46, 16, 30, mat(0x9aa3ad, { r: .7 })), 45, 8, -70)); s.add(at(box(30, 12, .3, mat(0x6c757d)), 45, 6, -54.9));
  s.add(at(cyl(2.5, 3, 28, mat(0xadb5bd)), -55, 14, -110)); s.add(at(cyl(5, 5, 3, mat(0x495057, { e: 0x88bbff, ei: .3 })), -55, 29, -110));
  const jet = bauJet(s);
  const expl = new Explosion(s, V3(0, 0, 0), { groesse: .6, richtung: V3(1, .3, 0), seed: 9, truemmer: 16, farbe: 0xdee2e6 });
  const rauch = new Schwaden(s, V3(0, 0, 0), 8, 4);
  const k = kamera(s, 74); const pov = new Pov(k);
  const rahmen = new THREE.Group();   // Hubschraubertür-Rahmen vor der Kamera (Landung)
  const rm = mat(0x2a2d33, { r: .8 });
  rahmen.add(at(box(.08, 1.6, .05, rm), -.42, 0, -.55)); rahmen.add(at(box(.08, 1.6, .05, rm), .42, 0, -.55));
  rahmen.add(at(box(1.0, .1, .05, rm), 0, .55, -.55)); rahmen.add(at(box(1.0, .14, .3, rm), 0, -.5, -.55));
  rahmen.add(at(cyl(.025, .025, 1, mat(0x9aa0a6, { m: .8 }), 8), 0, .45, -.5, 0, 0, Math.PI / 2));
  k.add(rahmen);
  const t = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  const schild2 = schildModell(); t[2].j.elL.add(schild2); schild2.position.set(.02, -.2, .12); schild2.rotation.set(-1.4, 0, 0);
  const pilot = new Figur({ art: 'zivil', jacke: 0xf8f9fa, hose: 0x212529, kappe: 0x1d3557, haut: 0xe8b98a, groesse: 1.78 }); s.add(pilot.root);
  const gorilla = new Figur({ art: 'zivil', jacke: 0x1b1b1e, hose: 0x1b1b1e, schuh: 0x111111, haut: 0xc68642, sonnenbrille: true, groesse: 1.96 }); s.add(gorilla.root);
  const schellen = handschellenModell(); s.add(schellen);
  const tablet = new THREE.Group(); const ts = liveTex(768, 512);
  tablet.add(at(box(.26, .18, .012, mat(0x111111, { r: .3 })), 0, 0, 0));
  tablet.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.24, .16), new THREE.MeshBasicMaterial({ map: ts.tex })), 0, 0, .007));
  s.add(tablet);
  const heli = new THREE.Group();   // geparkter Hubschrauber vor dem Jet
  heli.add(at(caps(1.1, 2.4, mat(0x2b2d42, { r: .5, m: .3 })), 0, 1.4, 0, Math.PI / 2)); heli.add(at(box(.3, .4, 5, mat(0x2b2d42)), 0, 1.6, 3.6));
  heli.add(at(box(.5, 1.2, .2, mat(0x2b2d42)), 0, 2.2, 6.0)); for (const x of [-.9, .9]) heli.add(at(box(.1, .1, 3.2, mat(0x111111)), x, .05, 0));
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, .02, 40), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: .25 }));
  rotor.position.set(0, 2.75, 0); heli.add(rotor); heli.position.set(-1.5, 0, 4.5); heli.rotation.y = .4; s.add(heli);
  return { s, k, pov, jet, expl, rauch, rahmen, t, schild2, pilot, gorilla, schellen, tablet, ts, heli, rotor, sonne };
})();

const NASE_STOP = -10;          // Nasenspitze des Jets (Welt-z), wenn er steht
const TUER_Z = NASE_STOP - 3.05, TUER_X = 1.16;
const RAMPE_X = TUER_X + .9;    // Ende der Treppe auf dem Boden
const rampeH = x => clamp((RAMPE_X - x) / (RAMPE_X - TUER_X)) * 1.5;
function jetZ(lt) {             // Szene 'landung': Jet rollt aus dem Nebel und bremst
  const tb = 3.7, v0 = 9, ab = 5.6;
  if (lt < tb) return NASE_STOP - (v0 * (tb - lt) + v0 * v0 / (2 * ab));
  const d = lt - tb, tStop = v0 / ab;
  return d >= tStop ? NASE_STOP : NASE_STOP - v0 * v0 / (2 * ab) + v0 * d - .5 * ab * d * d;
}
function tuerWinkel(d) {        // Tür klappt nach der Sprengung nach außen und landet als Treppe auf dem Boden
  if (d <= 0) return 0;
  let th = 0, om = 1.6; const dt = 1 / 240, tmax = 2.59;
  for (let t = 0; t < d; t += dt) { om += 9.81 / (1.7 * .67) * Math.sin(th) * dt; th += om * dt; if (th >= tmax) { th = tmax; om = -om * .18; if (Math.abs(om) < .15) om = 0; } }
  return th;
}
function vfStandard(t) {
  VF.rotor.rotation.y = t * 30; VF.rahmen.visible = false; VF.tablet.visible = false; VF.schellen.visible = false;
  VF.expl.update(-1); VF.rauch.update(-1, 0);
  for (const nr of [1, 2, 4, 7]) VF.t[nr].root.visible = true;
  VF.pilot.root.visible = true; VF.gorilla.root.visible = true;
  VF.sonne.target.position.set(VF.k.position.x, 0, VF.k.position.z - 6); VF.sonne.position.set(VF.k.position.x - 25, 18, VF.k.position.z + 20);
}
function stelleJet(nz, nick = 0) {
  const j = VF.jet; j.j.position.set(0, 0, nz); j.j.rotation.set(-nick, 0, 0);
}
function pilotSitzt(lt, haendeHoch, blickZurueck) {
  VF.pilot.pose({ beinL: [1.5, 1.55], beinR: [1.45, 1.5], armL: haendeHoch ? [2.9, .35] : [1.1, .1], ellL: haendeHoch ? .5 : .6, armR: haendeHoch ? [2.9, .35] : [1.1, .1], ellR: haendeHoch ? .5 : .6,
    kopf: [0, blickZurueck ? 2.2 : 0, 0], mund: redet('kabine', lt, 'P') });
  const p = VF.jet.j.localToWorld(V3(.4, 0, -1.45));
  VF.pilot.platziere(p.x, p.z, 0, { hoehe: 1.5 + .5 - .98 * VF.pilot.root.scale.x + .04 });
}

// ---------------------------------------------------------------- Landung (aus der Hubschraubertür)
const WEG_L = {
  1: [[0, -.5, 3.4], [4.9, -.5, 3.4], [7.2, 2.25, -11.6]],
  2: [[0, -.2, 3.8], [5.0, -.2, 3.8], [7.2, 1.62, -13.1]],
  4: [[0, -.8, 4.2], [5.2, -.8, 4.2], [7.2, 2.45, -14.4]],
  7: [[0, -.4, 4.6], [5.4, -.4, 4.6], [7.2, 3.15, -15.1]],
};
function s_landung(lt, t) {
  vfStandard(t);
  const { k, pov, t: tm } = VF;
  const tb = 3.6;
  const raus = smooth(4.85, 5.25, lt);
  const nz = jetZ(lt); const brems = lt > 3.7 && lt < 5.3 ? Math.sin((lt - 3.7) / 1.6 * Math.PI) * .03 : 0;
  stelleJet(nz, brems);
  VF.jet.licht.forEach(l => { l.intensity = 160; });
  VF.jet.raeder.forEach(r => { r.rotation.x = -t * 9 * (lt < 5.3 ? 1 : 0); });
  VF.jet.pivot.rotation.z = 0;
  VF.heli.visible = false; VF.pilot.root.visible = true; pilotSitzt(lt, false, false); VF.gorilla.root.visible = false;
  // Kamera: sinkt mit dem Hubschrauber, Aufsetzen, Sprung raus, Rennen zum Jet
  let pos, ziel;
  const nasePos = V3(0, 2.4, nz);
  if (lt < tb) {
    const h = 1.9 + 20 * Math.pow(1 - easeOut(lt / tb), 1.6);
    pos = V3(.2 * Math.sin(t * .9), h, 2.0).add(wackel(t, .02));
    ziel = nasePos.clone().add(V3(0, -.5, 0));
  } else if (lt < 4.85) {
    const stoss = Math.exp(-7 * (lt - tb)) * Math.sin((lt - tb) * 30) * .06;
    pos = V3(0, 1.9 + stoss, 2.0).add(wackel(t, .012)); ziel = nasePos;
  } else {
    const p = pfad([[4.85, 0, 2.0], [5.3, .3, 1.2], [7.2, 3.0, -9.5]], lt);
    pos = V3(p.x, 1.6 + Math.sin(p.dist / .7 * Math.PI) * .05 - .3 * Math.exp(-8 * (lt - 4.85)) * (lt < 5.3 ? 1 : 0), p.z);
    ziel = V3(1.2, 1.8, TUER_Z);
  }
  schau(k, pos, ziel, lt < tb ? .04 * Math.sin(t * 1.4) : 0);
  VF.rahmen.visible = raus < .5;
  for (const nr of [1, 2, 4, 7]) {
    const p = pfad(WEG_L[nr], lt); const geht = p.s > .05;
    tm[nr].root.visible = lt > 4.9;
    tm[nr].pose(geht ? rennPose(p.dist / .9 * Math.PI, { neig: .3 }) : hockPose(.4));
    tm[nr].platziere(p.x, p.z, richtung(p.vx, p.vz, Math.PI));
    tm[nr].haltGewehr('tief');
  }
  pov.setze({ modus: 'gewehr', t, lauf: lt > 5.2 ? 1 : .1, zielen: lt > 5.2 ? -.2 : -.4 });
  return { welt: VF, uhr: '05:31', blitz: 0 };
}

// ---------------------------------------------------------------- Tür (Ladung, Countdown, Sprengung, Treppe)
const TS = SZ('tuer'); const VERZUG = TS.verzug ?? 0;
const MARKEN = TS.marken ?? [2.6 + VERZUG, 3.3 + VERZUG, 4.0 + VERZUG];
const SPRENG = 4.9 + VERZUG;
function s_tuer(lt, t) {
  vfStandard(t);
  const { k, pov, t: tm, jet } = VF;
  stelleJet(NASE_STOP); jet.licht.forEach(l => { l.intensity = 90; }); VF.heli.visible = true;
  pilotSitzt(lt, false, false); VF.gorilla.root.visible = false;
  const d = lt - SPRENG;
  jet.pivot.rotation.z = -tuerWinkel(d);
  const latch = jet.j.localToWorld(V3(TUER_X + .04, 2.0, -2.75));
  VF.expl.pos.copy(latch); VF.expl.licht.position.copy(latch); VF.expl.update(d);
  VF.rauch.pos.copy(latch).add(V3(.5, 0, 0)); VF.rauch.update(d, d > 0 ? clamp(d / 1.2) : 0, k);
  // Ladung
  const zugriff = L('tuer', 'ZUGRIFF').start;
  const tuerOffen = L('tuer', 'Tür ist').start;
  const plan = {
    2: lt < 1.9 ? [[0, 1.62, -13.1]] : [[1.9, 1.62, -13.1], [2.6, 2.3, -12.2], [zugriff, 2.3, -12.2], [zugriff + .5, 2.2, -13.05], [zugriff + 1.4, 1.2, -13.05], [zugriff + 2.0, 0, -13.6], [zugriff + 2.6, 0, -14.6]],
    1: [[0, 2.7, -11.0], [zugriff + .5, 2.7, -11.0], [zugriff + 1.0, 2.25, -13.05], [zugriff + 1.9, 1.2, -13.05], [zugriff + 2.5, -.2, -12.9]],
    4: [[0, 2.45, -14.4], [zugriff + .9, 2.45, -14.4], [zugriff + 1.5, 2.3, -13.05]],
    7: [[0, 3.15, -15.1]],
  };
  for (const nr of [1, 2, 4, 7]) {
    const p = pfad(plan[nr], lt); const geht = p.s > .05;
    let yaw = geht ? richtung(p.vx, p.vz, -Math.PI / 2) : (nr === 2 ? -Math.PI / 2 : nr === 1 ? -2.1 : nr === 4 ? -.9 : -.7);
    const duck = d > -.1 && d < 1.3 ? Math.sin(clamp((d + .1) / 1.4) * Math.PI) : 0;
    let P = geht ? gehPose(p.dist / .65 * Math.PI, { hocke: .2, arme: false }) : hockPose(.45);
    P.rumpf = [.25 + .5 * duck, 0, 0]; P.kopf = [.4 * duck, 0, 0];
    if (nr === 2 && lt < 1.9) P = { ...stehPose(t), kopf: [-.2, 0, 0], rumpf: [.05, 0, 0] };
    if (nr === 1 && lt > MARKEN[0] - .5 && lt < SPRENG) {
      const n = lt < MARKEN[0] ? 0 : lt < MARKEN[1] ? 3 : lt < MARKEN[2] ? 2 : 1;
      P = { ...hockPose(.45), armL: [2.7, .35], ellL: 1.2, fingerL: n, rumpf: [.25, 0, 0] };
    }
    P.mund = redet('tuer', lt, String(nr));
    tm[nr].pose(P);
    const boden = p.x < RAMPE_X && p.x > TUER_X - .1 && Math.abs(p.z - TUER_Z) < .5 && d > 1 ? rampeH(p.x) : (p.x <= TUER_X && d > 1 ? 1.5 : 0);
    tm[nr].platziere(p.x, p.z, yaw, { boden });
    if (nr === 2 && lt < 1.9) { tm[2].ohneGewehr(); tm[2].greife('R', latch.clone().add(V3(.06, 0, .04 + .15 * (1 - smooth(.5, 1.0, lt)))), tm[2].lokal(-.6, .4, -.2)); }
    else if (nr === 1 && lt > MARKEN[0] - .5 && lt < SPRENG) { tm[1].haltGewehr('tief'); tm[1].greife('L', tm[1].lokal(.32, 1.62, .25), tm[1].lokal(.8, 1.0, -.4)); }
    else if (nr === 7) { tm[7].ohneGewehr(); }
    else tm[nr].haltGewehr(lt > zugriff ? 'anschlag' : 'tief');
  }
  // Ladung (kleines Paket mit blinkender LED) am Türgriff
  if (!VF.ladung) { const g = new THREE.Group(); g.add(at(box(.06, .14, .2, mat(0x2b2d31)), 0, 0, 0)); VF.ledM = mat(0xff2020, { e: 0xff2020, ei: 4 }); g.add(at(sph(.012, VF.ledM), .035, .04, 0)); VF.s.add(g); VF.ladung = g; }
  VF.ladung.visible = lt > 1.0 && d < 0; VF.ladung.position.copy(latch).add(V3(.04, 0, 0)); VF.ledM.emissiveIntensity = Math.floor(t * 4) % 2 ? 6 : .5;
  // Kamera
  let pos = V3(3.6, 1.5, -11.9), ziel = V3(1.2, 1.9, TUER_Z);
  if (lt > MARKEN[0] - .7 && lt < SPRENG - .3) ziel = weltPos(tm[1].j.haL).add(V3(0, .1, 0));
  const sh = d > 0 ? .07 * Math.exp(-3 * d) : 0;
  if (lt > zugriff + 1.8) { const p = pfad([[zugriff + 1.8, 3.6, -11.9], [zugriff + 2.6, 2.6, -13.05]], lt); pos = V3(p.x, 1.55 + rampeH(p.x) * 0, p.z); ziel = V3(1.0, 2.6, TUER_Z); }
  pos.add(wackel(t, sh));
  schau(k, pos, ziel);
  const duckIch = d > -.1 && d < 1.2 ? Math.sin(clamp((d + .1) / 1.3) * Math.PI) : 0;
  k.rotation.x -= .08 * duckIch; k.updateMatrixWorld(true);
  pov.setze({ modus: 'gewehr', t, lauf: lt > zugriff + 1.8 ? .8 : .1, zielen: lt > zugriff ? .5 : -.1 });
  return { welt: VF, uhr: '05:32', blitz: d >= 0 && d < .2 ? (1 - d / .2) * .7 : 0 };
}

// ---------------------------------------------------------------- Kabine
function s_kabine(lt, t) {
  vfStandard(t);
  const { k, pov, t: tm, jet, gorilla, schellen } = VF;
  stelleJet(NASE_STOP); jet.licht.forEach(l => { l.intensity = 0; }); VF.heli.visible = false;
  jet.pivot.rotation.z = -2.59;
  tm[7].root.visible = false; tm[4].root.visible = false;
  const zP = L('kabine', 'Nicht'), tackle = zP.ende + .1;
  pilotSitzt(lt, lt > .9, lt > .9 && lt < zP.ende + .3);
  // 2 steht im Gang mit Schild, Leibwächter stürmt an, Tackle, Handschellen
  const g0 = V3(-.55, 0, -18.4 + 0);   // Platz des Leibwächters (Welt)
  const nach = lt - tackle;
  if (nach < -.75) { gorilla.pose({ beinL: [1.5, 1.55], beinR: [1.45, 1.5], kopf: [0, 0, 0] }); gorilla.platziere(-.55, -17.4, 0, { hoehe: 1.5 + .5 - .98 * gorilla.root.scale.x + .04 }); }
  else if (nach < 0) {
    const k2 = (nach + .75) / .75; const z = lerp(-17.2, -16.1, k2);
    gorilla.pose(rennPose(k2 * 5, { neig: .35 })); gorilla.platziere(lerp(-.4, 0, k2), z, 0, { boden: 1.5 });
  } else {
    const kk = smooth(0, .45, nach);
    const hinten = smooth(1.2, 1.9, nach);
    gorilla.pose({ armL: [2.4 * kk * (1 - hinten), .3], armR: [2.4 * kk * (1 - hinten), .3], ellL: .3, ellR: .3, beinL: [0, .05], beinR: [.05, .05], kopf: [-.4 * kk, .9 * kk, 0] });
    gorilla.platziere(0, -16.15 - .35 * kk, Math.PI, { kipp: [kk * Math.PI / 2, 0], boden: 1.5 });
    if (hinten > 0) {
      const hl = gorilla.j.hips.localToWorld(V3(.06, .02, -.17)), hr = gorilla.j.hips.localToWorld(V3(-.06, .02, -.17));
      const pol = gorilla.j.chest.localToWorld(V3(0, .1, -.8));
      gorilla.greife('L', weltPos(gorilla.j.haL).lerp(hl, hinten), pol); gorilla.greife('R', weltPos(gorilla.j.haR).lerp(hr, hinten), pol);
    }
    const zu = 2.2;
    schellen.visible = nach > zu - .3;
    const wl = weltPos(gorilla.j.haL), wr = weltPos(gorilla.j.haR);
    schellen.ringL.position.copy(nach > zu ? wl : weltPos(tm[2].j.haR)); schellen.ringR.position.copy(nach > zu + .3 ? wr : weltPos(tm[2].j.haR).add(V3(.05, 0, 0)));
    for (const ring of [schellen.ringL, schellen.ringR]) { ring.lookAt(k.position); }
    const m = schellen.ringL.position.clone().add(schellen.ringR.position).multiplyScalar(.5);
    schellen.kette.position.copy(m); schellen.kette.scale.y = Math.max(.02, schellen.ringL.position.distanceTo(schellen.ringR.position) - .07);
    schellen.kette.quaternion.setFromUnitVectors(V3(0, 1, 0), schellen.ringR.position.clone().sub(schellen.ringL.position).normalize());
  }
  // Team 2 und 1
  if (nach < 0) {
    tm[2].pose({ beinL: [.25, .3], beinR: [-.2, .3], rumpf: [.2, 0, 0], mund: redet('kabine', lt, '2') });
    tm[2].platziere(-.1, -15.3, Math.PI, { boden: 1.5 }); tm[2].haltGewehr('anschlag');
  } else {
    const kk = smooth(0, .45, nach);
    tm[2].pose({ beinL: [1.4 * kk, 2.0 * kk], beinR: [.2 + .6 * kk, 1.8 * kk], rumpf: [.45 + .4 * kk, 0, 0], kopf: [.2, 0, 0], armL: [1.3, .2], ellL: .4, armR: [1.3, .2], ellR: .4, mund: redet('kabine', lt, '2') });
    tm[2].platziere(0, -15.55 - .3 * kk, Math.PI, { boden: 1.5 }); tm[2].ohneGewehr();
    if (nach > .45) {
      const r = gorilla.j.chest.localToWorld(V3(0, .15, -.15));
      tm[2].greife('L', r.clone().add(V3(.15, .05, 0)), tm[2].lokal(.6, 1.4, -.2));
      tm[2].greife('R', nach > 1.6 ? weltPos(gorilla.j.haL).add(V3(-.04, .04, 0)) : r.clone().add(V3(-.15, .05, 0)), tm[2].lokal(-.6, 1.4, -.2));
    }
  }
  tm[1].pose({ beinL: [.2, .3], beinR: [-.2, .3], rumpf: [.15, 0, 0], kopf: [0, 0, 0] }); tm[1].platziere(-.25, -12.85, .3, { boden: 1.5 }); tm[1].haltGewehr('anschlag');
  tm[1].root.visible = lt > 1.2;
  // Tablet auf Sitz 1A
  const sitz1A = V3(-.55, 1.5 + .52, -14.3);
  const zT = L('kabine', 'Sitz 1A');
  const greift = smooth(zT.start + 1.4, zT.start + 2.4, lt), hebt = smooth(zT.start + 2.4, zT.ende + .3, lt);
  VF.tablet.visible = true;
  const tabletHand = k.localToWorld(V3(0, -.1, -.42));
  VF.tablet.position.copy(sitz1A.clone().lerp(tabletHand, hebt));
  if (hebt < .01) VF.tablet.rotation.set(-Math.PI / 2, 0, 0); else { VF.tablet.quaternion.copy(k.quaternion); VF.tablet.rotateX(-.15 * (1 - hebt) - .3 * (1 - hebt)); }
  zeichneTablet(lt < zT.start ? -1 : 0, t);
  // Kamera: Treppe hoch, rein, Blick nach hinten, kurz zum Cockpit, dann zum Tackle, dann zum Tablet
  const zT0 = L('kabine', 'Sitz 1A').start;
  const steig = pfad([[0, 2.25, -13.05], [.9, 1.0, -13.05], [1.4, .1, -13.35], [tackle + .1, .1, -13.35], [tackle + .9, 0, -14.55], [zT0 - .9, 0, -14.55], [zT0 + .1, .05, -13.6]], lt);
  const boden = steig.x > TUER_X ? rampeH(steig.x) : 1.5;
  const pos = V3(steig.x, boden + 1.55 + Math.sin(steig.dist / .6 * Math.PI) * .03, steig.z);
  let ziel = V3(0, 2.9, -20);
  if (lt < .9) ziel = V3(-1, 2.6, -13.05);
  if (lt > zP.start - .2 && lt < zP.ende - .2) ziel = V3(.35, 2.3, -11.4);
  if (lt > tackle + .8 && lt < L('kabine', 'Wo ist').start) ziel = weltPos(gorilla.j.hips).add(V3(0, .1, 0));
  if (lt > zT.start - .3) ziel = sitz1A.clone().lerp(V3(0, 2.9, -16), hebt);
  schau(k, pos.add(wackel(t, nach > 0 && nach < .5 ? .03 : 0)), ziel);
  if (greift > 0 && hebt < 1) pov.setze({ modus: 'frei', t, zielR: k.localToWorld(V3(.25, -.4, -.35)).lerp(VF.tablet.position.clone().add(V3(.1, 0, .05)), greift), zielL: hebt > .3 ? VF.tablet.position.clone().add(V3(-.12, 0, 0)) : null });
  else pov.setze({ modus: 'gewehr', t, lauf: lt < 1.4 ? .7 : .1, zielen: .55, lampe: 12 });
  return { welt: VF, uhr: '05:33' };
}

// ---------------------------------------------------------------- Twist: Videobotschaft auf dem Tablet
function zeichneTablet(phase, t, lt = 0) {
  const g = VF.ts.ctx, w = 768, h = 512;
  if (phase < 0) { g.fillStyle = '#0b132b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff9f1c'; g.font = 'bold 40px DejaVu Sans'; g.textAlign = 'center'; g.fillText('1 NEUE NACHRICHT', w / 2, h / 2); }
  else if (phase === 0) {
    g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ff9f1c'; g.lineWidth = 10;
    g.beginPath(); g.arc(w / 2, h / 2, 50, t * 6, t * 6 + 4.5); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 34px DejaVu Sans'; g.textAlign = 'center'; g.fillText('EINGEHENDES VIDEO …', w / 2, h / 2 + 110);
  } else if (phase === 1) {
    const gr = g.createRadialGradient(w / 2, h * .4, 20, w / 2, h * .4, 420); gr.addColorStop(0, '#7a2a12'); gr.addColorStop(1, '#120606');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const nick = Math.sin(lt * 7) * 3 * (zeile('twist', lt)?.wer === 'X' ? 1 : 0);
    g.fillStyle = '#050505'; g.beginPath(); g.ellipse(w / 2, 220 + nick, 85, 105, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(w / 2 - 230, h); g.quadraticCurveTo(w / 2 - 200, 330, w / 2, 320); g.quadraticCurveTo(w / 2 + 200, 330, w / 2 + 230, h); g.fill();
    g.fillStyle = 'rgba(255,159,28,.9)'; g.fillRect(w / 2 - 40, 330, 80, 30);
    for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(0,0,0,${.15 + .1 * Math.sin(y + t * 40)})`; g.fillRect(0, y, w, 2); }
    g.fillStyle = '#ff2a3d'; g.font = 'bold 28px DejaVu Sans'; g.textAlign = 'left'; g.fillText('● LIVE', 24, 44);
  } else {
    g.fillStyle = '#d8e2ee'; g.fillRect(0, 0, w, h);
    const r = rng(8); g.fillStyle = '#7d8fa6';
    for (let i = 0; i < 9; i++) { const x = i * 100 - 40, hh = 160 + r() * 160; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 90, h - hh); g.lineTo(x + 180, h); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + 62, h - hh + 50); g.lineTo(x + 90, h - hh); g.lineTo(x + 118, h - hh + 50); g.fill(); g.fillStyle = '#7d8fa6'; }
    const p = (t * 1.2) % 1; g.strokeStyle = `rgba(230,57,70,${1 - p})`; g.lineWidth = 8; g.beginPath(); g.arc(470, 230, 26 + 40 * p, 0, 7); g.stroke();
    g.fillStyle = '#e63946'; g.beginPath(); g.arc(470, 230, 16, 0, 7); g.fill();
    g.fillStyle = '#0b132b'; g.font = 'bold 40px DejaVu Sans'; g.textAlign = 'center'; g.fillText('BERGHÜTTE · 2.340 m', w / 2, 70);
  }
  VF.ts.tex.needsUpdate = true;
}
function s_twist(lt, t) {
  vfStandard(t);
  const { k, pov, t: tm, jet, gorilla, schellen } = VF;
  stelleJet(NASE_STOP); jet.pivot.rotation.z = -2.59; VF.heli.visible = false;
  tm[7].root.visible = false; tm[4].root.visible = false; tm[1].root.visible = false;
  pilotSitzt(lt, true, false);
  gorilla.pose({ armL: [0, .3], armR: [0, .3], beinL: [0, .05], beinR: [.05, .05], kopf: [-.4, .9, 0] });
  gorilla.platziere(0, -16.5, Math.PI, { kipp: [Math.PI / 2, 0], boden: 1.5 });
  const hl = gorilla.j.hips.localToWorld(V3(.06, .02, -.17)), hr = gorilla.j.hips.localToWorld(V3(-.06, .02, -.17)), pol = gorilla.j.chest.localToWorld(V3(0, .1, -.8));
  gorilla.greife('L', hl, pol); gorilla.greife('R', hr, pol);
  schellen.visible = true; schellen.ringL.position.copy(weltPos(gorilla.j.haL)); schellen.ringR.position.copy(weltPos(gorilla.j.haR));
  const m = schellen.ringL.position.clone().add(schellen.ringR.position).multiplyScalar(.5);
  schellen.kette.position.copy(m); schellen.kette.scale.y = Math.max(.02, schellen.ringL.position.distanceTo(schellen.ringR.position) - .07);
  schellen.kette.quaternion.setFromUnitVectors(V3(0, 1, 0), schellen.ringR.position.clone().sub(schellen.ringL.position).normalize());
  const z2 = L('twist', 'Gibt');
  const hungrig = lt > z2.start - .2;
  tm[2].pose({ beinL: [1.4, 2.0], beinR: [.8, 1.8], rumpf: [.4, 0, 0], kopf: [hungrig ? -.5 : .3, 0, 0], mund: redet('twist', lt, '2'), armL: [1.3, .2], ellL: .4, armR: [1.3, .2], ellR: .4 });
  tm[2].platziere(0, -15.85, Math.PI, { boden: 1.5 }); tm[2].ohneGewehr();
  const senk = smooth(z2.start - .5, z2.start + .2, lt);
  schau(k, V3(.05, 3.05, -13.7), V3(0, 2.6 - .6 * senk, -16.5));
  const vor = k.localToWorld(V3(0, -.06 - .32 * senk, -.4 + .05 * senk));
  VF.tablet.visible = true; VF.tablet.position.copy(vor); VF.tablet.quaternion.copy(k.quaternion); VF.tablet.rotateX(-.12 - .7 * senk);
  const xEnde = L('twist', 'Wir sehen').ende;
  zeichneTablet(lt < .7 ? 0 : lt < L('twist', 'Wir sehen').start + .4 ? 1 : 2, t, lt);
  pov.setze({ modus: 'frei', t, zielL: VF.tablet.localToWorld(V3(-.14, -.02, 0)), zielR: VF.tablet.localToWorld(V3(.14, -.02, 0)) });
  const d = SZ('twist').d;
  return { welt: VF, uhr: '05:34', ende: lt > d - 1.9 ? lt - (d - 1.9) : null };
}

// ---------------------------------------------------------------- Hook
function s_hook(lt, t) {
  const freeze = 2.4, sp = lt > 3.2 ? (lt - 3.2) / .8 : 0;
  const zl = lt < freeze ? SPRENG - .3 + lt : (sp > 0 ? SPRENG - .3 + freeze - sp * 2 : SPRENG - .3 + freeze);
  const r = s_tuer(zl, SZ('tuer').start + zl);
  return { ...r, sat: lt > freeze ? .15 : 1, mitte: lt > freeze + .15 ? { text: 'Wie es dazu kam?', k: lt - freeze - .15 } : null, spulen: sp > 0 ? 1 : 0, titel: lt < 2.2 };
}

// ======================================================================= UI + Hauptschleife
const ui = {
  sub: document.getElementById('sub'), wer: document.getElementById('wer'), txt: document.getElementById('txt'),
  rec: document.getElementById('rec'), uhr: document.getElementById('uhr'), karte: document.getElementById('karte'),
  mitte: document.getElementById('mitte'), ende: document.getElementById('ende'), zeit: document.getElementById('zeitsprung'), titel: document.getElementById('titel'),
};
function zeigeUI(n, lt, r, t) {
  const z = zeile(n, lt);
  if (z) { const [name, farbe] = TL.sprecher[z.wer]; ui.sub.style.opacity = clamp((lt - z.start) / .12) * clamp((z.ende - lt) / .12); ui.wer.textContent = name; ui.wer.style.color = farbe; ui.txt.textContent = z.text; }
  else ui.sub.style.opacity = 0;
  ui.uhr.textContent = `${r.uhr ?? '05:30'}:${String(Math.floor(lt) % 60).padStart(2, '0')}`;
  ui.rec.style.opacity = Math.floor(t * 2) % 2 ? 1 : .25;
  if (r.karte) { ui.karte.style.opacity = clamp(r.karte.k * 4) * clamp((3.6 - r.karte.k) * 3); ui.karte.querySelector('b').textContent = r.karte.o; ui.karte.querySelector('span').textContent = r.karte.u; ui.karte.style.transform = `translateX(${(1 - easeOut(r.karte.k / .4)) * -600}px)`; }
  else ui.karte.style.opacity = 0;
  if (r.mitte) { ui.mitte.style.opacity = clamp(r.mitte.k * 5); ui.mitte.textContent = r.mitte.text; ui.mitte.style.transform = `scale(${.8 + .2 * easeBack(r.mitte.k / .3)})`; } else ui.mitte.style.opacity = 0;
  ui.titel.style.opacity = r.titel ? 1 : 0;
  if (r.ende !== null && r.ende !== undefined) { ui.ende.style.opacity = clamp(r.ende * 3); ui.ende.querySelector('.berg').style.transform = `translateY(${(1 - easeOut(r.ende / .6)) * 80}px)`; }
  else ui.ende.style.opacity = 0;
}
const SZENEN = { hook: s_hook, hq: s_hq, heli: s_heli, landung: s_landung, tuer: s_tuer, kabine: s_kabine, twist: s_twist };
const KARTE = { landung: ['05:31 · ZUGRIFFSORT', 'Flughafen · Vorfeld Ost'] };
function szeneRendern(i, lt, ziel) {
  const s = TL.szenen[i]; const r = SZENEN[s.n](lt, s.start + lt);
  if (KARTE[s.n] && lt < 4) r.karte = { o: KARTE[s.n][0], u: KARTE[s.n][1], k: lt };
  POST.rendere(r.welt.s, r.welt.k, ziel); return r;
}
window.renderFrame = async (t) => {
  let i = 0; TL.szenen.forEach((s, k) => { if (t >= s.start) i = k; });
  const s = TL.szenen[i], lt = t - s.start, tr = s.tr, trd = s.trd ?? .5;
  let r, post = {};
  if (i > 0 && tr && lt < trd) {
    szeneRendern(i - 1, TL.szenen[i - 1].d + lt, POST.a); r = szeneRendern(i, lt, POST.b);
    const p = lt / trd;
    if (tr === 'schwarz' || tr === 'uhr') post = { modus: 1, p: p < .5 ? 0 : 1, schwarz: 1 - Math.abs(p - .5) * 2 };
    else post = { modus: UEBERGANG[tr], p, fokus: [.5, .55] };
    ui.zeit.style.opacity = tr === 'uhr' ? Math.sin(Math.PI * p) : 0;
    if (tr === 'uhr') { ui.zeit.querySelector('.zeiger').style.transform = `rotate(${p * 1080}deg)`; ui.zeit.querySelector('.std').style.transform = `rotate(${p * 160}deg)`; ui.zeit.querySelector('b').textContent = s.karte; }
  } else { r = szeneRendern(i, lt, POST.a); ui.zeit.style.opacity = 0; }
  POST.fertig({ ...post, zeit: t, blitz: r.blitz ?? 0, sat: r.sat ?? 1, spulen: r.spulen ?? 0, rot: 0 });
  zeigeUI(s.n, lt, r, t);
  await new Promise(res => requestAnimationFrame(() => res()));
};
window.dauer = TL.dauer;
window.bereit = true;
