// EINHEIT FALKE – Einsatz 03: Die Berghütte (3D, nur POV, Schneesturm).
// Alles nach dem Hook läuft auf EINER Einsatz-Uhr E (Sekunden ab Anflug-Beginn): Absprung → Wand → Hütte → innen → Twist.
// Damit gibt es keine Sprünge zwischen den Szenen – jede Figur ist zu jedem E an genau einer Stelle.
import {
  THREE, W, H, mat, box, cyl, sph, at, clamp, lerp, easeOut, easeIn, easeInOut, easeBack, smooth, weltPos, rng, radialTex, rauchTex, textTex, setzeToon,
} from '/tools/einsatz3d/kern.js';
import { Figur, gehPose, rennPose, hockPose, stehPose, handschellenModell } from '/tools/einsatz3d/figur.js';
import { renderer, Post, UEBERGANG, Explosion, Schwaden } from '/tools/einsatz3d/welt.js';
import { Pov } from '/tools/einsatz3d/pov.js';
import { heliModell, heliUpdate, setzeSeil, Abwind, HELI_BODEN } from '/tools/einsatz3d/heli.js';
import { bergWelt, bergUpdate, DY, TUER, FENSTER, STUHL, FLUGPFAD, LANES, RAIL_Y, RAIL_Z } from '/tools/einsatz3d/berg.js';

const TL = await (await fetch('./timeline_fertig.json')).json();
setzeToon(true); Figur.augen = 1.45;
const R = renderer({ logDepth: true }); R.toneMappingExposure = 1.05;
const POST = new Post(R, { cartoon: true });
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SZ = n => TL.szenen.find(s => s.n === n);
const L = (n, anfang) => TL.dialog.find(z => z.szene === n && z.text.startsWith(anfang));
function zeile(n, lt) { let a = null; for (const z of TL.dialog) if (z.szene === n && lt >= z.start && lt < z.ende) a = z; return a; }
const E_START = SZ('anflug').start;
// Einsatz-Uhr → Szene/Zeit (für Mund, Funk-Gesten, Sprecher-Markierung)
function zeileBeiE(E) { const t = E + E_START; for (const s of TL.szenen) if (t >= s.start && t < s.start + s.d) return zeile(s.n, t - s.start); return null; }
const redetE = (E, wer) => { const z = zeileBeiE(E); return z && (z.wer === wer || z.wer === wer + 'v' || z.wer === wer + 'f'); };

function schaueAn(f, ziel, mix = 1) {
  if (mix <= 0 || !f.root.visible) return;
  const n = f.j.neck; n.updateMatrixWorld(true);
  const l = n.worldToLocal(ziel.clone());
  const yaw = clamp(Math.atan2(l.x, l.z), -1.2, 1.2), nick = clamp(-Math.atan2(l.y - .12, Math.hypot(l.x, l.z)), -.55, .55);
  const h = f.j.head; h.rotation.set(lerp(h.rotation.x, nick, mix), lerp(h.rotation.y, yaw, mix), h.rotation.z); h.updateMatrixWorld(true);
}
const kopfW = f => weltPos(f.j.head).add(V3(0, .12, 0));
function handAmOhr(f, n = 'L') { const ohr = f.j.head.localToWorld(V3(n === 'L' ? .15 : -.15, .1, .02)); f.greife(n, ohr, f.lokal(n === 'L' ? .5 : -.5, 1.2, -.3)); }
function kamera(szene, fov = 74) { const k = new THREE.PerspectiveCamera(fov, W / H, 0.03, 9000); k.rotation.order = 'YXZ'; szene.add(k); return k; }
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
const wackel = (t, st) => V3((Math.sin(t * 5.3) + .5 * Math.sin(t * 11.7 + 1.3)) * st * .4, (Math.sin(t * 6.1 + .7) + .5 * Math.sin(t * 13.3)) * st * .4, 0);
const winkelLerp = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
function mischen(a, b, k) {
  const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key], y = b[key];
    if (Array.isArray(x) || Array.isArray(y)) { const xa = x ?? [0, 0, 0], ya = y ?? [0, 0, 0]; o[key] = xa.map((v, i) => lerp(v ?? 0, ya[i] ?? 0, k)); }
    else if (typeof x === 'number' || typeof y === 'number') o[key] = lerp(x ?? 0, y ?? 0, k);
  } return o;
}
const KNIEPOSE = { beinL: [.15, 2.35], beinR: [1.55, 1.65], rumpf: [.3, 0, 0], kopf: [-.1, 0, 0] };
const SITZPOSE = { beinL: [1.5, 1.55], beinR: [1.42, 1.5], rumpf: [.08, 0, 0] };
// Laufen auf einem Pfad: Pose nach Tempo (rennen / taktisch geduckt gehen / stehen)
function lauf(f, keys, E, { boden = 0, still = null, yawStill = null, hocke = .35, gewehr = 'tief' } = {}) {
  const p = pfad(keys, E);
  let P;
  if (p.s > 2.6) P = rennPose(p.dist / .95 * Math.PI, { neig: .35 });
  else if (p.s > .05) P = { ...gehPose(p.dist / .62 * Math.PI, { hocke, arme: false }), rumpf: [.15 + .3 * hocke, 0, 0] };
  else P = still ?? { ...hockPose(.45), rumpf: [.25, 0, 0] };
  f.pose(P); f.platziere(p.x, p.z, p.s > .05 ? richtung(p.vx, p.vz, 0) : (yawStill ?? richtung(p.vx, p.vz, 0)), { boden: typeof boden === 'function' ? boden(p.x, p.z) : boden });
  if (gewehr) f.haltGewehr(gewehr); else f.ohneGewehr();
  return p;
}
const deckBoden = (x, z) => (Math.abs(x) <= 6.5 && z <= 7.9 && z >= -7.3 ? DY : 0);

// ======================================================================= Welt
const OPS = { 1: { headset: true, groesse: 1.86 }, 2: { groesse: 1.98, visier: true }, 4: { groesse: 1.72, visier: true }, 7: { groesse: 1.76, headset: true } };
const teamOps = (s, nr) => { const f = new Figur({ art: 'team', nummer: nr, maske: false, sturmhaube: true, maskeHoch: 1, helm: true, ...OPS[nr] }); f.maskeHoch(1); s.add(f.root); return f; };
const BW = (() => {
  const s = new THREE.Scene(); const b = bergWelt(s);
  const k = kamera(s, 88); const pov = new Pov(k, { aermel: 0x2e3440 });   // weiter Blick (Richtung 0,5×-Kamera)
  const heli = heliModell(); s.add(heli.g);
  const wind = new Abwind(s, 80, { farbe: 0xf4f7fa, seed: 9 });
  const t = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  const sitzer = {}; for (const nr of [1, 2, 4, 7]) { sitzer[nr] = teamOps(s, nr); s.remove(sitzer[nr].root); heli.g.add(sitzer[nr].root); }
  // Täter (3) + Geisel
  const wache = new Figur({ art: 'zivil', jacke: 0x4a5a3a, hose: 0x2b2d42, schuh: 0x1d1f22, kappe: 0x22252a, haut: 0xd9a77a, groesse: 1.8, handschuhe: true }); s.add(wache.root);
  const tA = new Figur({ art: 'zivil', jacke: 0x6c4a3a, hose: 0x343a40, schuh: 0x1d1f22, haare: true, haarfarbe: 0x2b1d14, bart: 0x2b1d14, haut: 0xe0ac69, groesse: 1.84 }); s.add(tA.root);
  const tC = new Figur({ art: 'zivil', jacke: 0x6d597a, hose: 0x2b2d42, schuh: 0x1d1f22, haare: true, haarfarbe: 0xd4a373, haut: 0xf1c27d, groesse: 1.82 }); s.add(tC.root);
  const tB = new Figur({ art: 'zivil', jacke: 0x1d3557, hose: 0x22252a, schuh: 0x1d1f22, kappe: 0x9d0208, haut: 0xc68642, groesse: 1.78 }); s.add(tB.root);
  const geisel = new Figur({ art: 'zivil', jacke: 0x2d6a4f, hose: 0x343a40, schuh: 0x6b3f22, haare: true, haarfarbe: 0xc8551b, zopf: 0xc8551b, lippen: 0xb5444f, haut: 0xf1c9a5, groesse: 1.7 }); s.add(geisel.root);
  { const hm = mat(0xc8551b, { r: .95 }), hd = geisel.j.head;   // lange Haare + Wimpern → klar als Frau erkennbar
    const lang = sph(1, hm, 18, 12); lang.scale.set(.115, .17, .075); lang.position.set(0, .07, -.07); hd.add(lang);
    for (const sx of [1, -1]) { const st = sph(1, hm, 12, 10); st.scale.set(.028, .12, .05); st.position.set(sx * .1, .07, .0); hd.add(st); }
    const pony = sph(1, hm, 14, 8); pony.scale.set(.1, .035, .06); pony.position.set(.02, .215, .07); pony.rotation.z = -.25; hd.add(pony);
    for (const sx of [1, -1]) { const w = box(.04, .007, .006, mat(0x1a1a1a)); w.position.set(sx * .036, .168, .118); w.rotation.z = sx * -.25; hd.add(w); } }
  { const schal = new THREE.Mesh(new THREE.TorusGeometry(.085, .035, 8, 18), mat(0xf77f00, { r: .9 })); schal.rotation.x = Math.PI / 2; schal.position.set(0, .26, .0); geisel.j.chest.add(schal);
    const zip = new THREE.Mesh(new THREE.BoxGeometry(.05, .14, .03), mat(0xf77f00)); zip.position.set(.03, .17, .1); zip.rotation.z = .2; geisel.j.chest.add(zip); }
  const polizisten = [0, 1].map(i => { const pz = new Figur({ art: 'zivil', jacke: 0x1d3557, hose: 0x14213d, schuh: 0x111111, kappe: 0x14213d, haut: [0xe0ac69, 0xf1c27d][i], groesse: 1.8 + i * .03 });
    pz.j.chest.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.28, .08), new THREE.MeshStandardMaterial({ map: textTex('polR3', 'POLIZEI', { w: 256, h: 64, farbe: '#ffffff', grund: '#14213d', font: 'bold 44px DejaVu Sans' }) })), 0, .15, -.125, 0, Math.PI, 0));
    pz.j.chest.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.2, .06), new THREE.MeshStandardMaterial({ map: textTex('polV3', 'POLIZEI', { w: 256, h: 64, farbe: '#ffffff', grund: '#14213d', font: 'bold 44px DejaVu Sans' }) })), .07, .17, .125));
    s.add(pz.root); return pz; });
  // Polizeihubschrauber (weiß-blau) für das Ende
  const polHeli = heliModell({ farbe: 0xe9ecef, piloten: true }); s.add(polHeli.g);
  polHeli.g.add(at(box(.06, .5, 7.0, mat(0x1d3f8f)), -1.05, 1.5, .5)); polHeli.g.add(at(box(.06, .5, 7.0, mat(0x1d3f8f)), 1.05, 1.5, .5));
  const polBlau = [mat(0x001133, { e: 0x2a6fff, ei: 6, noCache: true }), mat(0x001133, { e: 0x2a6fff, ei: 6, noCache: true })];
  polHeli.g.add(at(sph(.14, polBlau[0], 8, 6), -.4, 2.6, -1.6)); polHeli.g.add(at(sph(.14, polBlau[1], 8, 6), .4, 2.6, -1.6));
  const blauLicht = new THREE.PointLight(0x3a7bff, 0, 30, 1.4); s.add(blauLicht);
  // Seilwerfer (7), zwei Enterhaken mit Seil
  const werfer = new THREE.Group(); { const m = mat(0x3d4148, { m: .5, r: .5 }); werfer.add(at(cyl(.06, .06, .62, m, 14), 0, 0, 0, Math.PI / 2)); werfer.add(at(cyl(.08, .08, .16, mat(0xff6b00), 14), 0, 0, -.2, Math.PI / 2));
    werfer.add(at(box(.04, .14, .05, mat(0x1d1f22)), 0, -.1, .08)); werfer.add(at(box(.04, .12, .05, mat(0x1d1f22)), 0, -.09, -.12)); werfer.griffH = new THREE.Object3D(); werfer.griffH.position.set(0, -.12, .08); werfer.add(werfer.griffH);
    werfer.griffV = new THREE.Object3D(); werfer.griffV.position.set(0, -.11, -.12); werfer.add(werfer.griffV); werfer.mund = new THREE.Object3D(); werfer.mund.position.set(0, 0, -.32); werfer.add(werfer.mund); }
  s.add(werfer);
  const seilM = mat(0xe85d04, { r: .8 });
  const seile = LANES.map(() => { const g = { segs: [0, 1, 2, 3].map(() => { const c = cyl(.014, .014, 1, seilM, 6, false); s.add(c); return c; }), haken: new THREE.Group() };
    const hm = mat(0x9aa1a9, { m: .8, r: .3 }); g.haken.add(at(cyl(.015, .015, .22, hm, 6), 0, .05, 0));
    for (let k = 0; k < 3; k++) { const a = new THREE.Group(); a.rotation.y = k * Math.PI * 2 / 3; const z = new THREE.Mesh(new THREE.TorusGeometry(.07, .013, 6, 10, Math.PI * .9), hm); z.position.set(.07, -.06, 0); z.rotation.set(0, 0, Math.PI * 1.05); a.add(z); g.haken.add(a); }
    s.add(g.haken); return g; });
  // Sprengung Tür + Fenster, Blendgranate, Rauch, Glas
  const explT = new Explosion(s, V3(TUER.x, DY + 1.15, .05), { groesse: .65, richtung: V3(-.5, .25, 1), seed: 5, truemmer: 30, farbe: 0x6b3f22, boden: DY });
  const explF = new Explosion(s, V3(FENSTER.x, 1.6, .05), { groesse: .55, richtung: V3(.45, .25, 1), seed: 8, truemmer: 22, farbe: 0x2f1d12, boden: DY });
  const rauchT = new Schwaden(s, V3(TUER.x, DY + .8, .8), 10, 3), rauchInnen = new Schwaden(s, V3(-.4, DY + .6, -2.8), 12, 6);
  const blend = new THREE.Group(); blend.add(at(cyl(.03, .03, .12, mat(0x2b2d31, { m: .5 }), 10), 0, 0, 0)); blend.add(at(box(.012, .06, .03, mat(0x6c757d)), .035, .02, 0)); s.add(blend);
  const blendLicht = new THREE.PointLight(0xffffff, 0, 14, 1.2); s.add(blendLicht);
  const glas = []; { const r = rng(44), gm = mat(0xcfe8ff, { r: .1, transparent: true, opacity: .7 });
    for (let i = 0; i < 24; i++) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(.05 + r() * .08, .02); sh.lineTo(.02, .05 + r() * .08); sh.closePath(); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), gm); m.material.side = THREE.DoubleSide;
      m.userData = { p: V3(FENSTER.x + (r() - .5) * 1.0, 1.25 + r() * .7, -.1), v: [(r() - .5) * 2.5, .5 + r() * 2, -2 - r() * 4], rot: [r() * 12, r() * 12, r() * 12] }; s.add(m); glas.push(m); } }
  const schaufel = new THREE.Group(); schaufel.add(at(cyl(.02, .02, 1.1, mat(0x8b5a2b), 6), 0, 0, 0, Math.PI / 2)); schaufel.add(at(box(.3, .02, .36, mat(0xd62828, { m: .3 })), 0, 0, .7)); s.add(schaufel);
  const stuhl2 = new THREE.Group(); { const hm = mat(0x8c5a32), dm = mat(0x5c3a20); stuhl2.add(at(box(.44, .05, .42, hm), 0, .45, 0)); for (const [x, z] of [[-.19, -.18], [.19, -.18], [-.19, .18], [.19, .18]]) stuhl2.add(at(box(.04, .45, .04, dm), x, .225, z)); stuhl2.add(at(box(.44, .45, .04, hm), 0, .72, -.2)); } s.add(stuhl2);
  const schnellA = [handschellenModell(), handschellenModell(), handschellenModell(), handschellenModell()]; schnellA.forEach(h => s.add(h));
  const messer = new THREE.Group(); messer.add(at(box(.02, .1, .03, mat(0x1d1f22)), 0, -.04, 0)); messer.add(at(box(.006, .11, .025, mat(0xced4da, { m: .9, r: .2 })), 0, .06, 0)); s.add(messer);
  const fessel = new THREE.Mesh(new THREE.TorusGeometry(.055, .014, 6, 14), mat(0xc9a66b, { r: .9 })); s.add(fessel);
  const fesselStueck = [0, 1].map(() => { const m = cyl(.012, .012, .14, mat(0xc9a66b), 6, false); s.add(m); return m; });
  const handy = new THREE.Group(); handy.add(at(box(.075, .15, .01, mat(0x111214)), 0, 0, 0)); handy.schirm = mat(0xbfe3ff, { e: 0x8ecae6, ei: 1.6, noCache: true }); handy.add(at(box(.066, .135, .002, handy.schirm), 0, 0, .006)); s.add(handy);
  const handyW = handy.clone(); handyW.schirm = mat(0xffffff, { e: 0xffffff, ei: 1.2, noCache: true }); handyW.children[1].material = handyW.schirm; s.add(handyW);   // Handy der Wache
  const klumpen = null; if (0) { const klumpen = new THREE.Group(); { const sm = mat(0xf2f6fa, { r: .9 }); for (const [x, y, z, r] of [[0, 0, 0, .14], [.1, .05, .03, .1], [-.08, .06, -.04, .09], [.03, -.08, .05, .08]]) klumpen.add(at(sph(r, sm, 10, 8), x, y, z)); } }
  return { s, b, k, pov, heli, wind, t, sitzer, wache, tA, tB, tC, schaufel, stuhl2, geisel, polizisten, polHeli, polBlau, blauLicht, werfer, seile, explT, explF, rauchT, rauchInnen, blend, blendLicht, glas, schnellA, messer, fessel, fesselStueck, handy, handyW };
})();
const { k: K, pov: POV, t: TM } = BW;

// ======================================================================= Zeitplan (Einsatz-Uhr E)
const HZ = 22.0;                                    // Heli steht im Schwebeflug über der Terrasse
const HV = V3(.25, 11.5, 6.2);                     // Schwebepunkt (Kufen) – Tür links zeigt zur Hütte (−z)
const RX = HV.x + .05, RZ = HV.z - 1.6;            // Fußpunkt des Seils auf der Terrasse
const T_WEG = HZ + 6.8;
const SL = { 2: HZ + .8, 4: HZ + 1.9, 1: HZ + 3.0, 6: HZ + 4.1, 7: HZ + 5.3 }, RUTSCH = 1.25;   // Abseilen
const LAND = nr => SL[nr] + RUTSCH;
// Terrasse: Wache W (Schaufel) gegen 2, Täter C stürmt raus gegen 4
const W_SCHAUFEL = HZ + 1.0, W_LOS = HZ + 1.4, W_SCHLAG = HZ + 2.45, W_FALL = HZ + 2.9;
const W_LIEG = { x: 3.0, z: 2.8, yaw: Math.atan2(-1.85, 2.3) };
const C_TUER = HZ + 3.9, C_FALL = HZ + 5.0, C_LIEG = { x: -.4, z: 1.7, yaw: Math.atan2(-.91, .4) };
// Zugriff
const ZAEHL = [HZ + 9.3, HZ + 10.0, HZ + 10.7], BOOM = HZ + 11.3, T_BLEND = HZ + 11.6, BANG = HZ + 12.05;
const INNEN = HZ + 14.9;
const A_SCHLAG = INNEN + .1, T_TACKLE_A = INNEN + .45;
const B_FENSTER = INNEN + .1, B_GRIFF = INNEN + 1.0;
const T_SCHNITT = INNEN + 5.2;
const I = x => INNEN + x;

// ======================================================================= Heli
function heliPos(E, t) {
  const h = BW.heli;
  if (E < HZ) {
    const P = [...FLUGPFAD.map(([x, y, z]) => V3(x, y, z)), V3(-25, 17, 22), HV.clone()];
    const kurve = new THREE.CatmullRomCurve3(P); const u = 1 - Math.pow(1 - clamp(E / HZ), 1.8);
    const p = kurve.getPointAt(clamp(u)), tg = kurve.getTangentAt(clamp(u * .98 + .001));
    const yaw = Math.atan2(-tg.x, -tg.z), flare = smooth(.85, 1, u), kurv = Math.sin(u * 9) * .12 * (1 - flare);
    h.g.position.copy(p).add(V3(0, .25 * Math.sin(t * 1.1) * flare, 0));
    h.g.rotation.set(-.16 * (1 - smooth(.7, .9, u)) + .14 * smooth(.82, .95, u) * (1 - smooth(.97, 1, u)), lerp(yaw, -Math.PI / 2, smooth(.88, 1, u)), kurv + .04 * Math.sin(t * .6), 'YXZ');
  } else {
    const weg = smooth(T_WEG, T_WEG + 5, E);
    const ziel = V3(90 + 15 * Math.sin(E * .12), 40, 120);
    h.g.position.set(HV.x + .15 * Math.sin(t * .8), HV.y + .12 * Math.sin(t * 1.1), HV.z + .1 * Math.cos(t * .7)).lerp(ziel, weg);
    h.g.rotation.set(.03 * Math.sin(t * .9) - .2 * weg * (1 - weg) * 2, -Math.PI / 2 + .9 * weg, .03 * Math.sin(t * .6) + .15 * weg * (1 - weg) * 2, 'YXZ');
  }
  h.g.updateMatrixWorld(true); heliUpdate(h, t);
  h.g.visible = E < T_WEG + 9;
  // Seil: fällt ab HZ+.2 aus der Tür bis aufs Deck, wird nach dem letzten Abseilen eingezogen
  const raus = easeOut(clamp((E - HZ - .2) / .6));
  if (E > HZ + .2 && E < T_WEG - .2) setzeSeil(h, lerp(HV.y + 2.4, DY, raus), 0); else h.seil.visible = false;
  const stark = smooth(HZ - 2, HZ, E) * (1 - smooth(T_WEG, T_WEG + 3, E));
  BW.wind.update(t, stark * .8, V3(RX, DY, RZ + 1), DY, K);
}

// ======================================================================= Team im Heli → zur Tür → Abseilen
const SITZ_H = HELI_BODEN + .48;
const PLATZ = { 4: [.24, 1.42, Math.PI], 1: [.72, 1.42, Math.PI], 2: [-.5, -.82, 0], 7: [.5, -.82, 0] };
const AUGE6 = V3(-.74, SITZ_H + .7, 1.05);
const TUER_L = V3(-1.15, 0, -.25);
function sitzend(f, x, z, yaw, hoehe, extra = {}) { f.pose({ ...SITZPOSE, ...extra }); f.platziere(x, z, yaw, { hoehe: hoehe - .98 * f.root.scale.x + .04 }); }
function imHeli(E, t) {
  const h = BW.heli;
  for (const nr of [1, 2, 4, 7]) {
    const f = BW.sitzer[nr], s0 = SL[nr];
    f.root.visible = E < s0;
    if (!f.root.visible) continue;
    if (E < s0 - .8) {
      const [x, z, yaw] = PLATZ[nr];
      sitzend(f, x, z, yaw, SITZ_H, { kopf: [.1, Math.sin(E * .7 + nr) * .15, 0] }); if (nr === 7) f.ohneGewehr(); else f.haltGewehr('sitz');
      if (nr === 1 && redetE(E, '1')) handAmOhr(f);
      if (nr === 7 && redetE(E, '7')) schaueAn(f, K.position, .9);
      else if (nr !== 1) schaueAn(f, h.g.localToWorld(V3(-3, -1.5, -.5)), .6);
    } else {   // rutscht geduckt zur Tür, kniet sprungbereit am Seil
      const [x, z, yaw] = PLATZ[nr], vorn = V3(x, 0, z + (yaw === 0 ? .45 : -.45));
      const k = easeInOut((E - (s0 - .8)) / .8), q = vorn.clone().lerp(TUER_L, k);
      f.pose(k < 1 ? { ...gehPose(k * 6, { hocke: .85, arme: false }), rumpf: [.6, 0, 0], kopf: [-.3, 0, 0] } : { ...KNIEPOSE, kopf: [.4, 0, 0] });
      f.platziere(q.x, q.z, winkelLerp(yaw, -Math.PI / 2, smooth(0, .5, k)), { boden: HELI_BODEN }); f.ohneGewehr();
    }
  }
}
// Figur rutscht am Seil (Hände greifen, Beine umklammern) und landet weich in der Hocke
function rutscht(f, E, s0) {
  const kk = clamp((E - s0) / RUTSCH), oben = HV.y + HELI_BODEN - .3;
  const y = lerp(oben, DY, kk * kk * (1.6 - .6 * kk));
  f.root.visible = true; f.ohneGewehr();
  f.pose({ beinL: [.9, 1.3], beinR: [.5, 1.0], armL: [3.0, .1], armR: [2.9, .1], ellL: .3, ellR: .4, rumpf: [.1, 0, 0], kopf: [-.5, 0, 0] });
  f.platziere(RX, RZ + .25, Math.PI, { hoehe: y });
  f.greife('L', V3(RX, y + 2.05, RZ), f.lokal(.5, 1.6, .3)); f.greife('R', V3(RX, y + 1.75, RZ), f.lokal(-.5, 1.4, .3));
}
function landeHocke(f, E, l) { f.pose({ ...hockPose(.7 - .4 * smooth(l, l + .3, E)) }); f.platziere(RX, RZ + .25, Math.PI, { boden: DY }); f.haltGewehr('tief'); }

// ======================================================================= Team auf der Terrasse / in der Hütte
const STILL = { ...hockPose(.45), rumpf: [.3, 0, 0] };
function stelleZwei(E, t) {
  const f = TM[2], l = LAND(2);
  if (E < SL[2]) { f.root.visible = false; return; }
  f.root.visible = true;
  if (E < l) { rutscht(f, E, SL[2]); return; }
  if (E < l + .3) { landeHocke(f, E, l); return; }
  if (E < W_FALL - .05) {   // stellt sich der Wache entgegen, weicht dem Schaufelschlag aus
    const p = lauf(f, [[l + .3, RX, RZ + .25], [W_SCHLAG - .2, 1.9, 4.4], [W_FALL - .05, 2.95, 3.95]], E, { boden: DY, gewehr: 'tief', still: { ...stehPose(t), rumpf: [.2, 0, 0] }, yawStill: 2.4 });
    if (E > W_SCHLAG) { f.pose({ ...stehPose(t), rumpf: [.25, 0, -.2], armL: [2.5, .6], ellL: .6, kopf: [.1, .3, 0] }); f.platziere(p.x, p.z, 2.4, { boden: DY }); f.ohneGewehr(); }
    return;
  }
  if (E < HZ + 5.0) {   // wirft die Wache zu Boden, kniet daneben, Handschellen
    const k = smooth(W_FALL - .05, W_FALL + .5, E);
    f.pose(mischen({ ...stehPose(t), rumpf: [.6, 0, 0] }, { ...KNIEPOSE, rumpf: [.6, 0, 0], kopf: [-.2, 0, 0] }, k)); f.ohneGewehr();
    f.platziere(lerp(2.95, 2.85, k), lerp(3.95, 3.75, k), lerp(2.4, -2.25, k), { boden: DY });
    const w = BW.wache; f.greife('L', weltPos(w.j.haL).add(V3(0, .05, 0)), f.lokal(.5, .6, .2)); f.greife('R', weltPos(w.j.haR).add(V3(0, .05, 0)), f.lokal(-.5, .6, .2));
    return;
  }
  if (E < BOOM + 1.0) {   // zur Tür (links davon), Ladung, wegdrehen bei der Sprengung
    const p = lauf(f, [[HZ + 5.0, 2.85, 3.75], [HZ + 5.6, 3.95, 3.1], [HZ + 6.2, 3.7, 1.1], [HZ + 6.8, 1.45, .55]], E, { boden: DY, still: { ...STILL, kopf: E > BOOM - .1 ? [.1, -.5, 0] : [0, 0, 0] }, yawStill: E > BOOM - .1 && E < BOOM + .9 ? -.3 : Math.PI / 2 });
    if (p.s < .05 && E > HZ + 6.9 && E < HZ + 8.2) { f.ohneGewehr(); f.greife('R', V3(TUER.x - .38, DY + 1.05, .06), f.lokal(-.5, .5, 0)); }
    return;
  }
  if (E < T_TACKLE_A) {   // als Erster rein, auf A zu, blockt den Stuhl
    const p = lauf(f, [[BOOM + 1.0, 1.45, .55], [HZ + 12.5, 2.3, .3], [HZ + 13.2, 2.2, -.6], [HZ + 14.2, 1.2, -1.2], [A_SCHLAG, .35, -1.5]], E, { boden: DY, gewehr: 'anschlag', hocke: .2 });
    if (E > A_SCHLAG - .15) { f.pose({ ...stehPose(t), rumpf: [.3, 0, 0], armL: [2.6, .5], ellL: .5, armR: [2.4, .2], ellR: .8, kopf: [.2, 0, 0] }); f.platziere(p.x, p.z, -1.9, { boden: DY }); f.ohneGewehr(); }
    return;
  }
  const k = smooth(T_TACKLE_A, T_TACKLE_A + .5, E);
  f.pose(mischen(rennPose(0, { neig: 1.0 }), { ...KNIEPOSE, rumpf: [.6, 0, 0], kopf: [-.2, 0, 0] }, k)); f.ohneGewehr();
  f.platziere(lerp(.35, -1.2, easeOut(k)), lerp(-1.5, -1.25, k), lerp(-1.6, Math.PI, k), { boden: DY });
  const a = BW.tA; f.greife('L', weltPos(a.j.haL).add(V3(0, .05, 0)), f.lokal(.5, .6, .2)); f.greife('R', weltPos(a.j.haR).add(V3(0, .05, 0)), f.lokal(-.5, .6, .2));
}
function stelleVier(E, t) {
  const f = TM[4], l = LAND(4);
  if (E < SL[4]) { f.root.visible = false; return; }
  f.root.visible = true;
  if (E < l) { rutscht(f, E, SL[4]); return; }
  if (E < l + .3) { landeHocke(f, E, l); return; }
  if (E < C_FALL - .1) { lauf(f, [[l + .3, RX, RZ + .25], [HZ + 3.7, -1.2, 3.6], [C_FALL - .3, -.95, 2.65]], E, { boden: DY, gewehr: 'anschlag', still: { ...stehPose(t), rumpf: [.15, 0, 0] }, yawStill: 2.2 }); return; }
  if (E < HZ + 6.6) {   // Beinfeger → C liegt → Handschellen
    const k = smooth(C_FALL - .1, C_FALL + .4, E);
    f.pose(mischen({ ...stehPose(t), beinR: [1.0, .3], rumpf: [.4, 0, 0] }, { ...KNIEPOSE, rumpf: [.6, 0, 0] }, k)); f.ohneGewehr();
    f.platziere(lerp(-.95, -1.1, k), lerp(2.65, 2.6, k), lerp(2.2, Math.PI * .95, k), { boden: DY });
    const c = BW.tC; f.greife('L', weltPos(c.j.haL).add(V3(0, .05, 0)), f.lokal(.5, .6, .2)); f.greife('R', weltPos(c.j.haR).add(V3(0, .05, 0)), f.lokal(-.5, .6, .2)); return;
  }
  if (E < BOOM - .2) { const p = lauf(f, [[HZ + 6.6, -1.1, 2.6], [HZ + 7.1, -1.6, 3.5], [HZ + 7.9, -3.6, 2.9], [HZ + 8.6, -3.15, .6]], E, { boden: DY, still: STILL, yawStill: Math.PI / 2 }); if (p.s < .05) { f.ohneGewehr(); f.greife('R', V3(FENSTER.x - FENSTER.b / 2 + .1, 1.55, .08), f.lokal(-.5, .5, 0)); } return; }
  if (E < T_BLEND + .5) {
    const k = smooth(T_BLEND - .25, T_BLEND + .1, E);
    f.pose({ ...mischen({ ...STILL, kopf: [.1, -.5, 0] }, { ...stehPose(t), rumpf: [.15, 0, 0] }, smooth(BOOM + .1, T_BLEND - .2, E)), armR: [lerp(.3, 2.2, k) - 1.6 * smooth(T_BLEND, T_BLEND + .3, E), .3], ellR: .3 });
    f.platziere(-3.15, .6, Math.PI / 2 + .3, { boden: DY }); f.ohneGewehr(); return;
  }
  lauf(f, [[T_BLEND + .5, -3.15, .6], [HZ + 13.0, -.6, 1.25], [HZ + 13.6, .3, 1.2], [I(-.2), .3, 1.2], [I(1.0), 2.3, .1], [I(1.5), 2.1, -.6]], E, { boden: DY, gewehr: 'anschlag', hocke: .25, yawStill: E > I(1.4) ? -2.6 : Math.PI / 2, still: { ...stehPose(t), rumpf: [.15, 0, 0] } });
}
function stelleEins(E, t) {
  const f = TM[1], l = LAND(1);
  if (E < SL[1]) { f.root.visible = false; return; }
  f.root.visible = true;
  if (E < l) { rutscht(f, E, SL[1]); return; }
  if (E < l + .3) { landeHocke(f, E, l); return; }
  if (E < HZ + 12.8) {
    const p = lauf(f, [[l + .3, RX, RZ + .25], [HZ + 4.9, -.2, 3.7], [HZ + 5.4, -.2, 3.7], [HZ + 6.2, 1.0, 1.5]], E, { boden: DY, gewehr: 'anschlag', still: { ...STILL, kopf: E > BOOM - .1 && E < BOOM + .8 ? [.1, -.5, 0] : [0, 0, 0] }, yawStill: E < HZ + 5.5 ? 2.6 : Math.PI / 2 });
    if (E > ZAEHL[0] - .5 && E < BOOM) { const n = E < ZAEHL[0] ? 0 : E < ZAEHL[1] ? 3 : E < ZAEHL[2] ? 2 : 1;
      f.pose({ ...STILL, armL: [2.7, .35], ellL: 1.2, fingerL: n }); f.platziere(p.x, p.z, Math.PI / 2, { boden: DY }); f.haltGewehr('tief'); f.greife('L', f.lokal(.3, 1.6, .2), f.lokal(.8, 1.0, -.4)); }
    return;
  }
  if (E < B_GRIFF) { lauf(f, [[HZ + 12.8, 1.0, 1.5], [HZ + 13.4, 2.3, .2], [HZ + 13.9, 2.4, -.7], [I(.4), 2.65, -2.9], [I(.75), 2.8, -4.2], [B_GRIFF, 3.55, -4.35]], E, { boden: DY, gewehr: 'anschlag', hocke: .2 }); return; }
  // packt B am Fenster und zieht ihn runter, kniet, Handschellen
  const k = smooth(B_GRIFF, B_GRIFF + .6, E);
  f.pose(mischen({ ...stehPose(t), rumpf: [.3, 0, 0], armL: [1.6, .2], armR: [1.6, .2] }, { ...KNIEPOSE, rumpf: [.6, 0, 0], kopf: [-.3, 0, 0] }, k)); f.ohneGewehr();
  f.platziere(lerp(3.55, 3.4, k), lerp(-4.35, -4.4, k), lerp(1.3, 0, k), { boden: DY });
  const b = BW.tB; f.greife('L', weltPos(b.j.haL).add(V3(0, .05, 0)), f.lokal(.5, .6, .2)); f.greife('R', weltPos(b.j.haR).add(V3(0, .05, 0)), f.lokal(-.5, .6, .2));
}
function stelleSieben(E, t) {
  const f = TM[7], l = LAND(7);
  if (E < SL[7]) { f.root.visible = false; return; }
  f.root.visible = true;
  if (E < l) { rutscht(f, E, SL[7]); return; }
  if (E < l + .3) { landeHocke(f, E, l); return; }
  const p = lauf(f, [[l + .3, RX, RZ + .25], [l + 1.1, 1.0, 3.6]], E, { boden: DY, gewehr: 'tief', still: { ...KNIEPOSE, kopf: [-.2, 0, 0] }, yawStill: .9 });
}

// ======================================================================= Gegner
function liegtBauch(f, x, z, yaw, k, hand) {
  f.pose({ beinL: [.1 * (1 - k), .2], beinR: [-.05, .25], armL: [lerp(1.6, -.5, hand), lerp(.5, .25, hand)], armR: [lerp(1.6, -.5, hand), lerp(.5, .25, hand)], ellL: lerp(.4, 1.8, hand), ellR: lerp(.4, 1.8, hand), kopf: [lerp(0, -.9, k), lerp(0, .6, k), 0] });
  f.platziere(x, z, yaw, { boden: DY, kipp: [k * Math.PI / 2, 0] });
}
function schelle(i, f, an) { const r = BW.schnellA[i]; r.visible = an; if (an) { r.position.copy(weltPos(f.j.haL).add(weltPos(f.j.haR)).multiplyScalar(.5)); r.rotation.set(0, f.root.rotation.y + Math.PI / 2, 0); } }
function stelleWache(E, t) {
  const f = BW.wache, sch = BW.schaufel; f.root.visible = true;
  const halt = () => { const a = weltPos(f.j.haL), b = weltPos(f.j.haR); sch.position.copy(a).lerp(b, .5); sch.lookAt(b); };
  if (E < W_SCHAUFEL) {   // raucht am Geländer, schaut hoch zum Heli
    f.pose({ ...stehPose(t), armR: [1.4, .1], ellR: 1.9, kopf: [E > HZ - 3 ? -.7 : .1, E > HZ - 3 ? -.4 : 0, 0] }); f.platziere(5.3, 1.6, E > HZ - 2 ? -2.4 : .2, { boden: DY });
    sch.position.set(4.85, DY + .62, .16); sch.rotation.set(-.2, 0, .1); return;
  }
  if (E < W_LOS) { const p = lauf(f, [[W_SCHAUFEL, 5.3, 1.6], [W_LOS, 4.85, .55]], E, { boden: DY, gewehr: null, hocke: 0 }); f.greife('R', V3(4.85, DY + 1.1, .2), f.lokal(-.5, .5, 0)); sch.position.set(4.85, DY + .62, .16); return; }
  if (E < W_FALL) {   // stürmt mit erhobener Schaufel los, holt aus, schlägt ins Leere
    const p = pfad([[W_LOS, 4.85, .55], [W_SCHLAG, W_LIEG.x, W_LIEG.z]], E), aus = smooth(W_SCHLAG - .3, W_SCHLAG, E) - 1.6 * smooth(W_SCHLAG, W_SCHLAG + .3, E);
    f.pose({ ...(p.s > .05 ? rennPose(p.dist / .9 * Math.PI, { neig: .3 }) : stehPose(t)), armL: [2.4 + .5 * aus, .2], armR: [2.6 + .5 * aus, .1], ellL: .5, ellR: .4 });
    f.platziere(p.x, p.z, W_LIEG.yaw, { boden: DY }); f.ohneGewehr(); halt(); return;
  }
  // fällt nach vorn, Schaufel fliegt weg
  const k = smooth(W_FALL, W_FALL + .45, E), hand = smooth(W_FALL + 1.0, W_FALL + 1.6, E);
  liegtBauch(f, W_LIEG.x, W_LIEG.z, W_LIEG.yaw, k, hand); schelle(0, f, hand > .9);
  const d = E - W_FALL; sch.position.set(W_LIEG.x - .6 - 1.2 * Math.min(d, .5), Math.max(DY + .03, 1.6 + 2 * d - 4.9 * d * d), W_LIEG.z + 1.6 + .8 * Math.min(d, .5)); sch.rotation.set(Math.PI / 2, d < .55 ? d * 9 : .4, 0);
}
function stelleC(E, t) {
  const f = BW.tC; f.root.visible = true;
  if (E < C_TUER) { f.pose({ ...stehPose(t), kopf: [.1, Math.sin(t * .5) * .3, 0] }); f.platziere(1.6, -2.2, Math.PI * .8, { boden: DY }); return; }
  if (E < C_FALL) { const p = pfad([[C_TUER, 1.6, -2.2], [C_TUER + .4, 2.3, -.5], [C_TUER + .65, 2.3, .4], [C_FALL, C_LIEG.x, C_LIEG.z]], E);
    f.pose({ ...rennPose(p.dist / .9 * Math.PI, { neig: .3 }), armL: [1.2, .3], armR: [1.4, .3], ellL: 1.6, ellR: 1.6 }); f.platziere(p.x, p.z, richtung(p.vx, p.vz, 0), { boden: DY }); return; }
  const k = smooth(C_FALL, C_FALL + .45, E), hand = smooth(C_FALL + .6, C_FALL + 1.2, E);
  liegtBauch(f, C_LIEG.x, C_LIEG.z, C_LIEG.yaw, k, hand); schelle(3, f, hand > .9);
}
function stelleTaeterA(E, t) {
  const f = BW.tA, st = BW.stuhl2; f.root.visible = true;
  const seat = { x: -2.2, z: -2.75 }, Y = DY + .475;
  const stuhlFrei = () => { st.position.set(-.95, DY, -3.0); st.rotation.set(0, -1.2, 0); };
  if (E < BANG + .05) { sitzend(f, seat.x, seat.z, Math.PI, Y, { kopf: [.15, Math.sin(t * .5) * .2, 0], armL: [1.2, .1], armR: [1.2, .1], ellL: .9, ellR: .9 }); stuhlFrei(); return; }
  if (E < I(-1.0)) { const k = smooth(BANG + .05, BANG + .7, E); f.pose(mischen(SITZPOSE, { ...stehPose(t), rumpf: [.3, 0, 0] }, k)); f.platziere(seat.x, lerp(seat.z, -2.3, k), Math.PI - k * .5, { boden: DY }); haendeAugen(f); stuhlFrei(); return; }
  if (E < I(-.3)) { lauf(f, [[I(-1.0), -2.2, -2.3], [I(-.3), -1.35, -2.45]], E, { boden: DY, gewehr: null, hocke: 0 }); stuhlFrei(); return; }
  if (E < T_TACKLE_A) {   // packt den Stuhl, hebt ihn über den Kopf, schlägt nach 2
    const p = pfad([[I(-.3), -1.35, -2.45], [A_SCHLAG, -.6, -1.85]], E), hoch = smooth(I(-.3), I(-.05), E), schlag = smooth(A_SCHLAG - .1, A_SCHLAG + .15, E);
    f.pose({ ...gehPose(p.dist / .6 * Math.PI, { arme: false }), armL: [lerp(.8, 2.9, hoch) - 1.4 * schlag, .4], armR: [lerp(.8, 2.9, hoch) - 1.4 * schlag, .4], ellL: .4, ellR: .4, rumpf: [.2 + .3 * schlag, 0, 0] });
    f.platziere(p.x, p.z, 1.0, { boden: DY });
    if (E < A_SCHLAG + .2) { const m = weltPos(f.j.haL).lerp(weltPos(f.j.haR), .5); st.position.copy(m).add(V3(0, -.35, 0)); st.rotation.set(Math.PI + .3, 1.0, 0); }
    else { const d = E - A_SCHLAG - .2; st.position.set(-.5 - 1.5 * d, Math.max(DY + .23, 1.6 - 4.9 * d * d), -1.4 + 1.0 * d); st.rotation.set(Math.PI / 2, 1.0 + d * 4, 0); }
    return;
  }
  { const d = Math.min(E - A_SCHLAG - .2, .45); st.position.set(-.5 - 1.5 * d, Math.max(DY + .23, 1.6 - 4.9 * d * d), -1.4 + 1.0 * d); st.rotation.set(Math.PI / 2, 1.0 + d * 4, 0); }
  const k = smooth(T_TACKLE_A, T_TACKLE_A + .45, E), hand = smooth(T_TACKLE_A + 1.0, T_TACKLE_A + 1.6, E);
  liegtBauch(f, lerp(-.6, -.4, k), -1.85, winkelLerp(1.0, -Math.PI / 2, smooth(0, .4, k)), k, hand); schelle(1, f, hand > .9);
}
function haendeAugen(f) { f.greife('L', f.j.head.localToWorld(V3(.04, .02, .14)), f.lokal(.5, 1.2, .5)); f.greife('R', f.j.head.localToWorld(V3(-.04, .02, .14)), f.lokal(-.5, 1.2, .5)); }
function stelleTaeterB(E, t) {
  const f = BW.tB; f.root.visible = true;
  if (E < I(-.6)) { f.pose({ ...stehPose(t), kopf: [.1, .2 * Math.sin(t * .7), 0], rumpf: [E > BANG ? .3 : .02, 0, 0] }); f.platziere(3.0, -4.7, 0, { boden: DY }); if (E > BANG) haendeAugen(f); return; }
  if (E < B_GRIFF) {   // rennt zum Seitenfenster und will raus
    const p = lauf(f, [[I(-.6), 3.0, -4.7], [B_FENSTER, 4.35, -3.8]], E, { boden: DY, gewehr: null, hocke: 0, still: { ...stehPose(t), rumpf: [.15, 0, 0] }, yawStill: Math.PI / 2 });
    if (p.s < .05) { const r = .03 * Math.sin(E * 25); f.greife('L', V3(4.82, 1.5 + r, -3.5), f.lokal(.6, .6, 0)); f.greife('R', V3(4.82, 1.5 - r, -4.1), f.lokal(-.6, .6, 0)); }
    return;
  }
  const k = smooth(B_GRIFF, B_GRIFF + .6, E), hand = smooth(B_GRIFF + .9, B_GRIFF + 1.5, E);
  liegtBauch(f, lerp(4.35, 4.35, k), -3.8, winkelLerp(Math.PI / 2, -Math.PI / 2, smooth(0, .5, k)), k, hand); schelle(2, f, hand > .9);
}
const GEISEL_Y = DY + .475;
function stelleGeisel(E, t) {
  const f = BW.geisel; f.root.visible = true; const { x, z } = STUHL;
  const hinten = V3(x, DY + .62, z - .34);
  if (E < T_SCHNITT + .2) {
    sitzend(f, x, z, 0, GEISEL_Y, { rumpf: [.05, 0, 0], kopf: [E > I(2.6) ? .1 : .3, E > I(2.6) ? -.6 * smooth(I(2.6), I(3.4), E) : .2 * Math.sin(t * .6), 0], blick: E > I(2.6) ? [-1, 0] : [0, -1], mund: 0 });
    f.greife('L', hinten.clone().add(V3(.04, 0, 0)), f.lokal(.5, .6, -.5)); f.greife('R', hinten.clone().add(V3(-.04, 0, 0)), f.lokal(-.5, .6, -.5));
    BW.fessel.visible = true; BW.fessel.position.copy(hinten); BW.fessel.rotation.set(0, Math.PI / 2, 0); BW.fesselStueck.forEach(m => { m.visible = false; }); return;
  }
  BW.fessel.visible = false;
  BW.fesselStueck.forEach((m, i) => { const d = E - T_SCHNITT - .2; m.visible = true; m.position.set(hinten.x + (i ? .08 : -.08), Math.max(DY + .015, hinten.y - 4.9 * d * d), hinten.z - .05); m.rotation.set(m.position.y > DY + .02 ? d * 8 : Math.PI / 2, i, 0); });
  const reib = smooth(T_SCHNITT + .2, T_SCHNITT + .8, E), steh = smooth(I(6.1), I(6.7), E), dreh = smooth(I(6.7), I(7.4), E);
  const P = mischen({ ...SITZPOSE, rumpf: [.15, 0, 0] }, { ...stehPose(t), rumpf: [.04, 0, 0] }, steh);
  const lacht = redetE(E, 'G') ? .3 + .4 * Math.abs(Math.sin(E * 15)) : 0;
  f.pose({ ...P, kopf: [lerp(.2, -.05, steh), 0, 0], mund: lacht });
  if (steh <= 0) f.platziere(x, z, 0, { hoehe: GEISEL_Y - .98 * f.root.scale.x + .04 });
  else f.platziere(x, lerp(z, -3.45, steh), lerp(0, Math.PI, dreh), { boden: DY });
  if (reib > 0 && reib < 1 && steh < .5) { f.greife('L', f.lokal(.03, .95, .3), f.lokal(.5, .5, .2)); f.greife('R', f.lokal(-.03, .97, .32), f.lokal(-.5, .5, .2)); }
}
function stelleBlend(E) {
  const g = BW.blend; const a = V3(-2.65, 1.6, .5), b = V3(-.6, DY + .03, -2.4);
  g.visible = E > T_BLEND;
  if (!g.visible) { BW.blendLicht.intensity = 0; return; }
  const u = clamp((E - T_BLEND) / (BANG - T_BLEND - .05));
  g.position.copy(a.clone().lerp(b, u)).add(V3(0, Math.sin(Math.PI * u) * .35, 0)); g.rotation.set(u * 12, u * 5, 0);
  const d = E - BANG; BW.blendLicht.position.set(-.6, 1.0, -2.4); BW.blendLicht.intensity = d > 0 ? 900 * Math.exp(-9 * d) : 0;
  BW.rauchInnen.update(d, d > 0 ? clamp(1 - (d - 4) / 4) : 0, K);
}
function stelleTuerFenster(E) {
  const d = E - BOOM, T = BW.b.tuer;
  BW.explT.update(d); BW.explF.update(d); BW.explT.licht.intensity *= .2; BW.explF.licht.intensity *= .2; BW.rauchT.update(d, d > 0 ? clamp(1 - (d - 3) / 3) : 0, K);
  if (d < 0) {   // C reißt die Tür auf, A schlägt sie wieder zu
    const auf = smooth(C_TUER + .2, C_TUER + .45, E) * (1 - smooth(HZ + 5.6, HZ + 5.9, E)), a = -1.45 * auf;
    T.position.set(TUER.x + .5 - .5 * Math.cos(a), DY + TUER.h / 2, -.1 + .5 * Math.sin(a)); T.rotation.set(0, a, 0);
    BW.b.fenster.scheibe.visible = true; BW.glas.forEach(m => { m.visible = false; }); return;
  }
  const tt = Math.min(d, .62), p0 = V3(TUER.x, DY + 1.05, -.1), v = V3(2.0, 1.4, -3.4);
  const pos = p0.clone().addScaledVector(v, tt).add(V3(0, -4.9 * tt * tt, 0)); if (d >= .62) pos.set(3.54, DY + .03, -2.2);
  T.position.copy(pos); T.rotation.set(-Math.PI / 2 * smooth(0, .62, d), .35 * smooth(0, .62, d), 0);
  BW.b.fenster.scheibe.visible = false;
  BW.glas.forEach(m => { const u = m.userData; const q = { x: u.p.x + u.v[0] * Math.min(d, .5), y: Math.max(DY + .005, u.p.y + u.v[1] * d - 4.9 * d * d), z: u.p.z + u.v[2] * Math.min(d, .5) };
    m.visible = true; m.position.set(q.x, q.y, q.z); if (q.y > DY + .01) m.rotation.set(u.rot[0] * d, u.rot[1] * d, u.rot[2] * d); else m.rotation.set(-Math.PI / 2, u.rot[1], 0); });
}

// ======================================================================= Kamera (ICH, Nr. 6)
function kameraBei(E, t) {
  const h = BW.heli;
  let pos, ziel, hand = null, roll = 0, modus = 'gewehr', pz = { lauf: 0, zielen: -.25, senken: .3 };
  const s6 = SL[6], l6 = LAND(6);
  const TUERBLICK = V3(-1.0, HELI_BODEN + 1.0, .8);
  if (E > HZ - .6 && E < s6 - .8) {     // rückt an die offene Tür vor und schaut runter auf die Terrasse
    const k = easeInOut((E - (HZ - .6)) / .8);
    pos = h.g.localToWorld(AUGE6.clone().lerp(TUERBLICK, k)); ziel = V3(RX + 1.8, DY, RZ - 1.8);
    ziel.lerp(kopfW(BW.wache), smooth(W_SCHAUFEL - .4, W_SCHAUFEL, E) * (1 - smooth(W_FALL + .6, W_FALL + 1.2, E)));
    ziel.lerp(V3(-.4, DY, 2.0), smooth(C_TUER - .2, C_TUER + .3, E));
    pz = { lauf: 0, zielen: -.3, senken: .4 };
  } else if (E < s6 - .8) {              // sitzt im Heli an der offenen Tür
    let zl = h.g.worldToLocal(V3(-150, -150, -300)).sub(AUGE6);                       // raus auf die Berge
    if (zl.z < 0) zl.z = Math.max(zl.z, -.9 * Math.abs(zl.x)); if (zl.x > -.3) zl.x = -.3 - Math.abs(zl.z) * .2; zl.normalize().multiplyScalar(10).add(AUGE6);
    if (E > 12) zl.lerp(h.g.worldToLocal(V3(0, 0, -3)), smooth(12, 14, E) * (1 - smooth(17.5, 18.5, E)));   // die Hütte taucht auf
    const z1 = L('anflug', 'Kein'); if (z1) zl.lerp(h.g.worldToLocal(kopfW(BW.sitzer[1])), smooth(z1.start - .8, z1.start - .2, E) * (1 - smooth(z1.ende - .2, z1.ende + .5, E)));
    zl.lerp(h.g.worldToLocal(kopfW(BW.sitzer[7])), smooth(19.4, 19.9, E) * (1 - smooth(22.6, 23.0, E)));   // 7: „Ich hasse Höhe.“
    zl.lerp(h.g.worldToLocal(V3(RX + 1.5, DY, RZ - 1.5)), smooth(23.0, 23.5, E));                          // runter auf die Terrasse
    pos = h.g.localToWorld(AUGE6.clone()); ziel = h.g.localToWorld(zl); roll = h.g.rotation.z * .6; pz = { lauf: 0, zielen: -.3, senken: .4 };
  } else if (E < s6) {                   // an die Tür, Blick runter
    const k = easeInOut((E - (s6 - .8)) / .8), tuer = V3(-1.22, HELI_BODEN + .95, .35);
    pos = h.g.localToWorld(TUERBLICK.clone().lerp(tuer, k)); ziel = V3(-.4, DY, 2.0).lerp(V3(RX, DY, RZ - 1.0), k);
    modus = 'frei'; hand = { L: V3(RX, HV.y + HELI_BODEN + 1.3, RZ), R: V3(RX, HV.y + HELI_BODEN + 1.0, RZ) }; if (k < .6) { modus = 'gewehr'; hand = null; }
  } else if (E < l6) {                   // Abseilen: Hände am Seil, Blick runter auf das Chaos
    const kk = clamp((E - s6) / RUTSCH), y = lerp(HV.y + HELI_BODEN + 1.25, DY + 1.75, kk < .8 ? .9 * (kk / .8) ** 2 : .9 + .1 * easeOut((kk - .8) / .2));
    pos = V3(RX + .06 + .02 * Math.sin(t * 7), y, RZ + .36); ziel = V3(RX - .5, DY, RZ - 2.2).lerp(V3(1.5, DY + 1.2, 1.0), smooth(.6, 1, kk));
    modus = 'frei'; const r = .015 * Math.sin(t * 40); hand = { L: V3(RX, y - .16 + r, RZ), R: V3(RX, y - .42 - r, RZ) };
  } else if (E < HZ + 13.1) {             // gelandet → Stack links der Tür, Tackles, Countdown, Sprengung
    const stoss = Math.exp(-6 * (E - l6)) * Math.sin((E - l6) * 14) * .25;
    const p = pfad([[l6 + .35, RX + .06, RZ + .36], [HZ + 6.6, .2, 2.7]], E);
    pos = V3(p.x, lerp(1.62 + DY - Math.max(0, stoss), DY + 1.05, smooth(l6 + .3, l6 + .9, E)), p.z);
    ziel = V3(-.6, 1.0, 2.0).lerp(V3(.4, 1.1, 1.6), smooth(l6, HZ + 6.0, E));               // 4 + 1 mit C
    ziel.lerp(V3(TUER.x, 1.3, 0), smooth(HZ + 6.0, HZ + 6.7, E));
    ziel.lerp(weltPos(TM[1].j.haL).add(V3(0, .05, 0)), smooth(ZAEHL[0] - .5, ZAEHL[0] - .1, E) * (1 - smooth(BOOM - .4, BOOM - .1, E)));
    ziel.lerp(V3(-1.6, 1.4, .3), smooth(BOOM + .1, BOOM + .4, E) * (1 - smooth(HZ + 12.3, HZ + 12.7, E)));     // Fenster: Blendgranate
    const sh = E > BOOM ? .12 * Math.exp(-3 * (E - BOOM)) : 0; pos.add(wackel(t, sh));
    if (E > BOOM - .05 && E < BOOM + .8) roll = .1 * Math.sin((E - BOOM + .05) / .85 * Math.PI);
    pz = { lauf: clamp(p.s / 2), zielen: E > HZ + 12.1 ? .1 : -.2, senken: 0 };
  } else if (E < I(3.9)) {               // rein: Tür → A greift an → B am Fenster → Geisel
    const p = pfad([[HZ + 13.1, .2, 2.7], [HZ + 13.9, 1.7, 1.2], [HZ + 14.5, 2.3, .4], [INNEN, 2.3, 0], [I(1.3), 1.2, -1.1], [I(2.6), 1.25, -3.2], [I(3.4), 1.1, -4.55], [I(3.9), .45, -4.75]], E);
    pos = V3(p.x, lerp(DY + 1.05, DY + 1.5, smooth(HZ + 13.1, HZ + 13.6, E)) + Math.abs(Math.sin(p.dist / .65 * Math.PI)) * .03, p.z);
    ziel = V3(TUER.x, 1.3, -1.5);
    ziel.lerp(V3(-.4, 1.4, -1.8), smooth(I(-.5), I(-.1), E) * (1 - smooth(I(.9), I(1.2), E)));             // A mit Stuhl, Tackle
    ziel.lerp(kopfW(BW.tB), smooth(I(1.0), I(1.3), E) * (1 - smooth(I(2.0), I(2.3), E)));                 // B am Fenster
    ziel.lerp(kopfW(BW.geisel), smooth(I(2.1), I(2.5), E));
    if (E > I(3.4)) ziel.lerp(V3(.4, DY + .7, -4.0), smooth(I(3.4), I(3.9), E));
    const duck = E > A_SCHLAG + .1 && E < A_SCHLAG + .6 ? Math.sin((E - A_SCHLAG - .1) / .5 * Math.PI) : 0;    // Stuhl fliegt vorbei
    pos.y -= .15 * duck; roll = .08 * duck;
    pz = { lauf: clamp(p.s / 2), zielen: .1, senken: 0 };
  } else if (E < I(6.5)) {               // knien, Fessel durchschneiden
    const kn = smooth(I(3.9), I(4.3), E) * (1 - smooth(I(6.0), I(6.5), E));
    pos = V3(.45, lerp(DY + 1.5, DY + 1.0, kn), -4.75); ziel = V3(.4, lerp(DY + .9, DY + .55, kn), -4.0);
    ziel.lerp(kopfW(BW.geisel), smooth(I(5.7), I(6.3), E));
    if (kn > .6 && E < T_SCHNITT + .4) { modus = 'frei'; const w = V3(STUHL.x, DY + .62, STUHL.z - .34); const saeg = .03 * Math.sin(E * 22) * smooth(I(4.5), I(4.7), E); hand = { L: w.clone().add(V3(-.07, .03, -.05)), R: w.clone().add(V3(.05 + saeg, -.01, -.07)), messer: true }; }
    else pz = { lauf: 0, zielen: -.3, senken: .5 };
  } else {                               // Twist
    pos = V3(.45, DY + 1.5, -4.75).add(wackel(t, .004));
    ziel = kopfW(BW.geisel).add(V3(0, -.05, 0));
    const hb = smooth(I(10.1), I(10.5), E) * (1 - smooth(I(11.8), I(12.2), E)); ziel.lerp(weltPos(BW.handy), hb * .6);
    const push = smooth(I(12.7), I(14.7), E); pos.lerp(ziel, .18 * push);
    pz = { lauf: 0, zielen: -.4, senken: .6 };
    if (E > I(12.2) && E < I(13.6)) roll = .03 * Math.sin((E - I(12.2)) * 3);
  }
  schau(K, pos, ziel, roll);
  if (modus === 'frei' && hand) { POV.setze({ modus: 'frei', t, zielL: hand.L, zielR: hand.R }); BW.messer.visible = !!hand.messer;
    if (hand.messer) { const r = POV.handWelt('R'); BW.messer.position.copy(r); BW.messer.lookAt(hand.L); BW.messer.rotateX(Math.PI / 2); } }
  else { POV.setze({ modus: 'gewehr', t, ...pz }); BW.messer.visible = false; }
}

// ======================================================================= Einsatz: alles zu einem Zeitpunkt
function einsatz(E, t) {
  heliPos(E, t); imHeli(E, t);
  stelleZwei(E, t); stelleVier(E, t); stelleEins(E, t); stelleSieben(E, t);
  stelleWache(E, t); stelleC(E, t); stelleTaeterA(E, t); stelleTaeterB(E, t); stelleGeisel(E, t);
  stelleBlend(E); stelleTuerFenster(E);
  // Polizei kommt (Ende): Hubschrauber vor der Terrasse, zwei Beamte über den Seitensteg
  { const ph = BW.polHeli, an = E > I(7); ph.g.visible = an;
    if (an) { const k = easeOut(smooth(I(7), I(11), E)); ph.g.position.set(lerp(40, 11, k) + .3 * Math.sin(t), 3 + .3 * Math.sin(t * 1.2), lerp(60, 26, k)); ph.g.rotation.set(.05 * (1 - k), -Math.PI / 2 - .5, .03 * Math.sin(t * .7), 'YXZ'); ph.g.updateMatrixWorld(true); heliUpdate(ph, t); ph.seil.visible = false;
      const blink = Math.floor(t * 5) % 2; BW.polBlau[0].emissiveIntensity = blink ? 8 : .3; BW.polBlau[1].emissiveIntensity = blink ? .3 : 8;
      BW.blauLicht.position.set(2.3, 2.2, 2.2); BW.blauLicht.intensity = k * (blink ? 60 : 10); } else BW.blauLicht.intensity = 0;
    BW.polizisten.forEach((p, i) => { p.root.visible = E > I(9); if (!p.root.visible) return;
      const w = i ? [[I(9.3), 5.75, -6.8], [I(10.9), 5.75, -1.2]] : [[I(9), 5.75, -6.0], [I(10.4), 5.75, -.4], [I(11.4), 2.9, 1.0]];
      lauf(p, w, E, { boden: DY, gewehr: null, hocke: 0, still: stehPose(t), yawStill: i ? Math.PI : -1.2 }); p.greife('R', p.lokal(-.2, 1.0, .1), p.lokal(-.5, .5, 0)); }); }
  // Handy der Geisel (Twist)
  { const g = BW.geisel, hy = BW.handy; hy.visible = E > I(9.8);
    if (hy.visible) { const k = smooth(I(9.8), I(10.3), E); const p = g.lokal(.0, 1.25, .32); hy.position.copy(p); hy.quaternion.copy(g.root.quaternion); hy.rotateX(-.5); hy.updateMatrixWorld(true);
      g.greife('R', p.clone().add(V3(0, -.07, 0)), g.lokal(-.5, .5, .1)); g.greife('L', p.clone().add(V3(.01, -.06, 0)), g.lokal(.5, .5, .1));
      hy.schirm.emissiveIntensity = 1.6 + (Math.floor(E * 6) % 2) * .6 * (1 - smooth(I(10.7), I(11.2), E));
      g.j.head.rotation.x = lerp(g.j.head.rotation.x, .45, k * (1 - smooth(I(12.0), I(12.5), E))); g.j.head.updateMatrixWorld(true);
      if (E > I(12.8) && E < I(13.3)) g.lider[1].scale.y = 1.5;
      g.mund(.15 * smooth(I(12.1), I(12.6), E)); } }
  bergUpdate(BW.b, t, K, { sturm: lerp(1, .6, smooth(INNEN - .5, INNEN + .5, E)) });
  if (BW.b.wimpel) BW.b.wimpel.rotation.y = .3 * Math.sin(t * 3) - .4;
  BW.b.sonne.position.copy(K.position).add(V3(-30, 50, 40)); BW.b.sonne.target.position.copy(K.position); BW.b.sonne.target.updateMatrixWorld();
  kameraBei(E, t);
  BW.b.innenLicht.intensity = 11;
  BW.s.fog.near = E < HZ - 2 ? 700 : 150; BW.s.fog.far = E < HZ - 2 ? 5200 : 2600;
}
const uhrBei = E => `06:${String(Math.min(59, 12 + Math.floor(E / 6))).padStart(2, '0')}`;
function redner(E) {   // wer gerade spricht → Figur für die Markierung
  const z = zeileBeiE(E); if (!z) return null;
  if (z.wer === '1' || z.wer === '1f') return E < SL[1] ? BW.sitzer[1] : TM[1];
  if (z.wer === '7v') return E < SL[7] ? BW.sitzer[7] : TM[7];
  if (z.wer === 'G') return BW.geisel;
  return null;
}

// ======================================================================= Szenen
function s_einsatz(lt, t) {
  const E = t - E_START; einsatz(E, t);
  return { welt: BW, uhr: uhrBei(E), blitz: E > BANG && E < BANG + .25 ? .35 * (1 - (E - BANG) / .25) : (E > BOOM && E < BOOM + .15 ? .5 * (1 - (E - BOOM) / .15) : 0), wer: redner(E) };
}
function s_hook(lt, t) {
  // 0–2,1 s: Abseilen vom Heli auf die Terrasse (unten Kampf) → Schnitt → Doppelsprengung → Freeze → Zurückspulen
  const schnitt = 2.1, freeze = 3.3, sp = lt > 4.0 ? (lt - 4.0) / .6 : 0;
  if (lt < schnitt) { const E = HZ + 3.5 + lt * .9; einsatz(E, E + E_START); return { welt: BW, uhr: uhrBei(E), titel: true, blitz: lt > schnitt - .12 ? (lt - (schnitt - .12)) / .12 : 0 }; }
  const a = BOOM - .5, E = lt < freeze ? a + (lt - schnitt) : (sp > 0 ? a + (freeze - schnitt) - sp * 1.8 : a + (freeze - schnitt));
  einsatz(E, E + E_START);
  return { welt: BW, uhr: uhrBei(E), blitz: Math.max(lt < schnitt + .1 ? 1 - (lt - schnitt) / .1 : 0, E > BOOM && E < BOOM + .15 ? .6 : 0), sat: lt > freeze ? .15 : 1,
    mitte: lt > freeze + .15 ? { text: 'Wie es dazu kam?', k: lt - freeze - .15 } : null, spulen: sp > 0 ? 1 : 0, titel: lt < 2.0 };
}
function s_twist(lt, t) { const r = s_einsatz(lt, t); const d = SZ('twist').d; return { ...r, ende: lt > d - 3.0 ? lt - (d - 3.0) : null }; }

// ======================================================================= UI + Hauptschleife
const ui = {
  sub: document.getElementById('sub'), wer: document.getElementById('wer'), txt: document.getElementById('txt'),
  rec: document.getElementById('rec'), mic: document.getElementById('mic'), nachricht: document.getElementById('nachricht'), uhr: document.getElementById('uhr'), karte: document.getElementById('karte'),
  mitte: document.getElementById('mitte'), ende: document.getElementById('ende'), zeit: document.getElementById('zeitsprung'), titel: document.getElementById('titel'), redner: document.getElementById('redner'),
};
// Bildschirmposition eines Weltpunkts (inkl. Fischaugen-Linse des Post-Shaders)
const WOLB = .3, AS = W / H;
function linse(u, v) { let cx = (u - .5) * AS, cy = v - .5; const r2 = cx * cx + cy * cy, f = (1 + WOLB * r2) / (1 + WOLB * .35); return [cx * f / AS + .5, cy * f + .5]; }
function aufSchirm(p, kam) {
  const v = p.clone().project(kam); if (v.z > 1) return null;
  const ziel = [v.x * .5 + .5, v.y * .5 + .5]; let u = ziel[0], w = ziel[1];
  for (let i = 0; i < 6; i++) { const [a, b] = linse(u, w); u += ziel[0] - a; w += ziel[1] - b; }
  return [u * W, (1 - w) * H];
}
function zeigeUI(n, lt, r, t) {
  const z = zeile(n, lt);
  if (z) { const [name, farbe] = TL.sprecher[z.wer]; ui.sub.style.opacity = clamp((lt - z.start) / .12) * clamp((z.ende - lt) / .12); ui.wer.textContent = name; ui.wer.style.color = farbe; ui.txt.textContent = z.text; ui.txt.style.color = z.wer === '6' ? '#80ed99' : (z.funk ? '#ffd166' : '#ffffff'); }
  else ui.sub.style.opacity = 0;
  // Sprecher-Markierung: farbige Nummer über dem Kopf dessen, der gerade redet
  { let zeig = 0; if (z && r.wer && r.wer.root.visible) { const p = aufSchirm(kopfW(r.wer).add(V3(0, .32, 0)), r.welt.k);
      if (p && p[0] > 60 && p[0] < W - 60 && p[1] > 200 && p[1] < H - 300) { zeig = clamp((lt - z.start) / .15) * clamp((z.ende - lt) / .15); const [name, farbe] = TL.sprecher[z.wer];
        ui.redner.style.left = (p[0] - ui.redner.offsetWidth / 2) + 'px'; ui.redner.style.top = (p[1] - 118) + 'px'; ui.redner.style.borderColor = farbe; ui.redner.querySelector('b').textContent = name.split(' ')[0]; ui.redner.querySelector('b').style.color = farbe; ui.redner.querySelector('i').style.borderTopColor = farbe;
        ui.redner.style.transform = `scale(${.9 + .1 * Math.abs(Math.sin(lt * 9))})`; } }
    ui.redner.style.opacity = zeig; }
  ui.uhr.textContent = `${r.uhr ?? '06:12'}:${String(Math.floor(lt * 3 + t) % 60).padStart(2, '0')}`;
  ui.rec.style.opacity = Math.floor(t * 2) % 2 ? 1 : .25;
  { const N = NACHRICHT[n]; const k = N ? clamp((lt - N[0]) / .3) * clamp((N[1] - lt) / .3) : 0;
    ui.nachricht.style.opacity = k; if (N) { ui.nachricht.querySelector('em').textContent = N[2]; ui.nachricht.querySelector('span').textContent = N[3]; ui.nachricht.style.transform = `translateY(${(1 - easeOut(clamp((lt - N[0]) / .4))) * -140}px)`; } }
  { const ich = z && z.wer === '6', pegel = z ? (ich ? 1 : z.funk ? .75 : .5) * (0.35 + .65 * Math.abs(Math.sin(lt * 13 + 1.3 * Math.sin(lt * 5)))) : .08 + .05 * Math.abs(Math.sin(t * 3));
    ui.mic.querySelectorAll('i').forEach((b, i) => { const an = pegel * 6 > i; b.style.height = (6 + i * 5) + 'px'; b.style.opacity = an ? 1 : .25; b.style.background = i > 4 ? '#ff4d6d' : i > 3 ? '#ffd166' : '#80ed99'; });
    ui.mic.querySelector('b').classList.toggle('an', !!(z && z.funk)); }
  if (r.karte) { ui.karte.style.opacity = clamp(r.karte.k * 4) * clamp((3.6 - r.karte.k) * 3); ui.karte.querySelector('b').textContent = r.karte.o; ui.karte.querySelector('span').textContent = r.karte.u; ui.karte.style.transform = `translateX(${(1 - easeOut(r.karte.k / .4)) * -600}px)`; }
  else ui.karte.style.opacity = 0;
  if (r.mitte) { ui.mitte.style.opacity = clamp(r.mitte.k * 5); ui.mitte.textContent = r.mitte.text; ui.mitte.style.transform = `scale(${.8 + .2 * easeBack(r.mitte.k / .3)})`; } else ui.mitte.style.opacity = 0;
  ui.titel.style.opacity = r.titel ? 1 : 0;
  if (r.ende !== null && r.ende !== undefined) { ui.ende.style.opacity = clamp(r.ende * 3); ui.ende.querySelector('.auto').style.transform = `translateX(${(1 - easeOut(r.ende / .6)) * -500}px)`;
    const tip = (el, t0) => { const k = r.ende - t0; el.style.opacity = clamp(k * 4); el.style.transform = `scale(${k < 0 ? .5 : .8 + .2 * easeBack(k / .35) + .06 * Math.sin(r.ende * 9) * (k > .4 ? 1 : 0)})`; };
    tip(ui.ende.querySelector('.like'), .7); tip(ui.ende.querySelector('.folgen'), 1.1);
    ui.ende.querySelector('.like').classList.toggle('an', r.ende > 1.0); ui.ende.querySelector('.folgen').classList.toggle('an', r.ende > 1.5); }
  else ui.ende.style.opacity = 0;
}
const SZENEN = { hook: s_hook, anflug: s_einsatz, abseilen: s_einsatz, huette: s_einsatz, innen: s_einsatz, twist: s_twist };
const NACHRICHT = {
  anflug: [.6, 4.6, 'EILMELDUNG · Berghütte Adlerhorst · 2.340 m', 'Geiselnahme! Passstraße gesperrt – Sturm, kein Landeplatz.'],
  twist: [.7, 4.6, 'F. · jetzt', 'Perfekt, Schatz. Jetzt bringen sie dich direkt ins Hauptquartier. ♥'],
};
function szeneRendern(i, lt, ziel) {
  const s = TL.szenen[i]; const r = SZENEN[s.n](lt, s.start + lt);
  POST.rendere(r.welt.s, r.welt.k, ziel); return r;
}
window.renderFrame = async (t) => {
  Figur.zeit = t;
  let i = 0; TL.szenen.forEach((s, k) => { if (t >= s.start) i = k; });
  const s = TL.szenen[i], lt = t - s.start, tr = s.tr, trd = s.trd ?? .5;
  let r, post = {};
  if (i > 0 && tr && lt < trd) {
    // Übergang: alte Szene ins Ziel A, neue ins Ziel B – bei derselben Welt nacheinander rendern (Zustand wird pro Aufruf komplett gesetzt)
    szeneRendern(i - 1, TL.szenen[i - 1].d + lt, POST.a); r = szeneRendern(i, lt, POST.b);
    const p = lt / trd;
    if (tr === 'schwarz' || tr === 'uhr') post = { modus: 1, p: p < .5 ? 0 : 1, schwarz: 1 - Math.abs(p - .5) * 2 };
    else post = { modus: UEBERGANG[tr], p, fokus: [.5, .55] };
    ui.zeit.style.opacity = tr === 'uhr' ? Math.sin(Math.PI * p) : 0;
    if (tr === 'uhr') { ui.zeit.querySelector('.zeiger').style.transform = `rotate(${-p * 1080}deg)`; ui.zeit.querySelector('.std').style.transform = `rotate(${-p * 160}deg)`; ui.zeit.querySelector('b').textContent = s.karte; }
  } else { r = szeneRendern(i, lt, POST.a); ui.zeit.style.opacity = 0; }
  POST.fertig({ ...post, kontur: r.kontur ?? 1, zeit: t, blitz: r.blitz ?? 0, sat: r.sat ?? 1, spulen: r.spulen ?? 0, rot: r.rot ?? 0 });
  zeigeUI(s.n, lt, r, t);
  await new Promise(res => requestAnimationFrame(() => res()));
};
window.dauer = TL.dauer; window.__BW = BW; window.__THREE = THREE; window.__E = einsatz; window.__K = K;
window.bereit = true;
window.__blick = async (p, z, E = 30) => { einsatz(E, E + E_START); POV.setze({ modus: 'aus' }); schau(K, V3(...p), V3(...z)); POST.rendere(BW.s, K, POST.a); POST.fertig({}); for (const el of document.querySelectorAll('.ov')) el.style.opacity = 0; await new Promise(r => requestAnimationFrame(r)); };
// Prüfung: Abstände zwischen allen Figuren (Hüfte) und zur Kamera über den ganzen Einsatz
window.__pruefe = () => {
  const figs = { 1: TM[1], 2: TM[2], 4: TM[4], 7: TM[7], W: BW.wache, C: BW.tC, A: BW.tA, B: BW.tB, G: BW.geisel, P0: BW.polizisten[0], P1: BW.polizisten[1] };
  const erg = {};
  for (let E = HZ - 1; E < INNEN + 22; E += .05) {
    einsatz(E, E + E_START);
    const pts = Object.entries(figs).filter(([, f]) => f.root.visible).map(([n, f]) => [n, weltPos(f.j.hips), weltPos(f.j.head)]);
    pts.push(['KAM', K.position.clone().add(V3(0, -.7, 0)), K.position.clone()]);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const [a, ha, ka] = pts[i], [b, hb, kb] = pts[j];
      const d = Math.min(Math.hypot(ha.x - hb.x, ha.z - hb.z), Math.hypot(ka.x - kb.x, ka.z - kb.z));
      if (Math.abs(ha.y - hb.y) > 1.3) continue;
      const key = a + '-' + b; if (d < .6 && (!erg[key] || erg[key][1] > d)) erg[key] = [E.toFixed(2), d.toFixed(2)];
    }
  }
  return erg;
};
