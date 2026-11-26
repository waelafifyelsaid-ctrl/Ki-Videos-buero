// EINHEIT FALKE – Einsatz 03: Die Berghütte (3D, nur POV, Schneesturm).
// Alles nach dem Hook läuft auf EINER Einsatz-Uhr E (Sekunden ab Anflug-Beginn): Absprung → Wand → Hütte → innen → Twist.
// Damit gibt es keine Sprünge zwischen den Szenen – jede Figur ist zu jedem E an genau einer Stelle.
import {
  THREE, W, H, mat, box, cyl, sph, at, clamp, lerp, easeOut, easeIn, easeInOut, easeBack, smooth, weltPos, rng, radialTex, rauchTex, textTex, setzeToon,
} from '/tools/einsatz3d/kern.js';
import { Figur, gehPose, rennPose, hockPose, stehPose, handschellenModell } from '/tools/einsatz3d/figur.js';
import { renderer, Post, UEBERGANG, Explosion, Schwaden } from '/tools/einsatz3d/welt.js';
import { Pov } from '/tools/einsatz3d/pov.js';
import { heliModell, heliUpdate, Abwind, HELI_BODEN } from '/tools/einsatz3d/heli.js';
import { bergWelt, bergUpdate, WZ, SY, DY, RAIL_Z, RAIL_Y, ROPE_Z, LANES, TUER, FENSTER, STUHL } from '/tools/einsatz3d/berg.js';

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
  const k = kamera(s, 74); const pov = new Pov(k, { aermel: 0x2e3440 });
  const heli = heliModell(); s.add(heli.g);
  const wind = new Abwind(s, 80, { farbe: 0xf4f7fa, seed: 9 });
  const t = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  const sitzer = {}; for (const nr of [1, 2, 4, 7]) { sitzer[nr] = teamOps(s, nr); s.remove(sitzer[nr].root); heli.g.add(sitzer[nr].root); }
  // Täter (3) + Geisel
  const wache = new Figur({ art: 'zivil', jacke: 0x4a5a3a, hose: 0x2b2d42, schuh: 0x1d1f22, kappe: 0x22252a, haut: 0xd9a77a, groesse: 1.8, handschuhe: true }); s.add(wache.root);
  const tA = new Figur({ art: 'zivil', jacke: 0x6c4a3a, hose: 0x343a40, schuh: 0x1d1f22, haare: true, haarfarbe: 0x2b1d14, bart: 0x2b1d14, haut: 0xe0ac69, groesse: 1.84 }); s.add(tA.root);
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
  const schnellA = [handschellenModell(), handschellenModell(), handschellenModell()]; schnellA.forEach(h => s.add(h));
  const messer = new THREE.Group(); messer.add(at(box(.02, .1, .03, mat(0x1d1f22)), 0, -.04, 0)); messer.add(at(box(.006, .11, .025, mat(0xced4da, { m: .9, r: .2 })), 0, .06, 0)); s.add(messer);
  const fessel = new THREE.Mesh(new THREE.TorusGeometry(.055, .014, 6, 14), mat(0xc9a66b, { r: .9 })); s.add(fessel);
  const fesselStueck = [0, 1].map(() => { const m = cyl(.012, .012, .14, mat(0xc9a66b), 6, false); s.add(m); return m; });
  const handy = new THREE.Group(); handy.add(at(box(.075, .15, .01, mat(0x111214)), 0, 0, 0)); handy.schirm = mat(0xbfe3ff, { e: 0x8ecae6, ei: 1.6, noCache: true }); handy.add(at(box(.066, .135, .002, handy.schirm), 0, 0, .006)); s.add(handy);
  const handyW = handy.clone(); handyW.schirm = mat(0xffffff, { e: 0xffffff, ei: 1.2, noCache: true }); handyW.children[1].material = handyW.schirm; s.add(handyW);   // Handy der Wache
  const klumpen = new THREE.Group(); { const sm = mat(0xf2f6fa, { r: .9 }); for (const [x, y, z, r] of [[0, 0, 0, .14], [.1, .05, .03, .1], [-.08, .06, -.04, .09], [.03, -.08, .05, .08]]) klumpen.add(at(sph(r, sm, 10, 8), x, y, z)); } s.add(klumpen);
  const krumen = []; { const sm = mat(0xffffff); for (let i = 0; i < 18; i++) { const m = sph(.02 + (i % 3) * .01, sm, 6, 4, false); s.add(m); krumen.push(m); } }
  return { s, b, k, pov, heli, wind, t, sitzer, wache, tA, tB, geisel, polizisten, polHeli, polBlau, blauLicht, werfer, seile, explT, explF, rauchT, rauchInnen, blend, blendLicht, glas, schnellA, messer, fessel, fesselStueck, handy, handyW, klumpen, krumen };
})();
const { k: K, pov: POV, t: TM } = BW;

// ======================================================================= Zeitplan (Einsatz-Uhr E)
const HV = V3(0, SY + 1.1, 17);                 // Schwebepunkt über dem Absatz (Kufen 1,1 m über dem Schnee)
const T_SCHWEB = 9.6, T_WEG = 13.9;
const J = { 2: 10.6, 7: 11.1, 4: 11.6, 1: 12.1, 6: 12.8 };    // Absprung
const LAND = { 2: [1.1, 14.0], 7: [-1.0, 14.1], 4: [-.1, 14.3], 1: [1.0, 14.2], 6: [.1, 14.4] };
const BASIS = { 2: [1.5, 8.75], 4: [-1.5, 8.75], 1: [-1.6, 10.0], 7: [0, 10.6], 6: [1.55, 10.3] };
const SPRUNG = .55;
const FEUER = [16.6, 17.7], FLUG = .45;                     // Seilwerfer: Schuss auf Bahn A (links) und B (rechts)
const V_KL = 1.25;                                          // Klettertempo m/s
const KL = { 4: [0, 18.5], 2: [1, 18.5], 1: [0, 20.3], 6: [1, 20.6], 7: [0, 22.8] };   // [Bahn, Start]
const HIP_TOP = .3, UEBER = 1.2;                            // oben: Hüfte auf .3 → über das Geländer (1,2 s)
const DECK_LAND = { 4: [-1.5, 6.9], 2: [1.5, 6.9], 1: [-1.5, 6.9], 6: [1.5, 6.9], 7: [-1.5, 6.9] };
const hip0 = f => SY + .98 * f.root.scale.x;
const klDauer = f => (HIP_TOP - hip0(f)) / V_KL;
const KAMSKALA = 1.0;
const hip06 = SY + .98 * KAMSKALA;
const klTop = nr => KL[nr][1] + (nr === 6 ? (HIP_TOP - hip06) / V_KL : klDauer(TM[nr]));
// Hütte
const T_WACHE = 31.2, T_TACKLE = 31.6;
const ZAEHL = [35.2, 35.9, 36.6], BOOM = 37.2, T_BLEND = 37.5, BANG = 37.95;
const INNEN = 40.8;
const T_TACKLE_A = 41.05;
const T_SCHNITT = 46.0;

// ======================================================================= Heli
function heliPos(E, t) {
  const h = BW.heli;
  if (E < T_SCHWEB) {   // Anflug durchs Tal: hoch über dem Absatz → Sinkflug → Abfangen
    const P = [V3(-430, 70, 230), V3(-250, 45, 150), V3(-110, 18, 70), V3(-30, SY + 4, 26), HV.clone()];
    const kurve = new THREE.CatmullRomCurve3(P); const u = 1 - Math.pow(1 - clamp(E / T_SCHWEB), 2.2);
    const p = kurve.getPointAt(clamp(u)), tg = kurve.getTangentAt(clamp(u * .98 + .001));
    const yaw = Math.atan2(-tg.x, -tg.z), flare = smooth(.82, 1, u);
    h.g.position.copy(p).add(V3(0, .25 * Math.sin(t * 1.1) * flare, 0));
    h.g.rotation.set(-.18 * (1 - smooth(.6, .85, u)) + .16 * smooth(.75, .92, u) * (1 - smooth(.95, 1, u)), lerp(yaw, -Math.PI / 2, smooth(.85, 1, u)), -.12 * (1 - u) + .04 * Math.sin(t * .6), 'YXZ');
  } else {
    const weg = smooth(T_WEG, T_WEG + 4.5, E);
    const ziel = V3(70 + 12 * Math.sin(E * .15), 14, 80 + 10 * Math.cos(E * .15));
    h.g.position.set(HV.x + .2 * Math.sin(t * .8), HV.y + .15 * Math.sin(t * 1.1), HV.z + .12 * Math.cos(t * .7)).lerp(ziel, weg);
    h.g.rotation.set(.03 * Math.sin(t * .9) - .2 * weg * (1 - smooth(T_WEG + 3, T_WEG + 6, E)), -Math.PI / 2 + .9 * weg, .04 * Math.sin(t * .6) + .15 * weg * (1 - weg) * 2, 'YXZ');
  }
  h.g.updateMatrixWorld(true); heliUpdate(h, t);
  h.g.visible = E < 30;
  h.seil.visible = false;
  // Abwind: Schnee wirbelt weg, solange er tief schwebt
  const stark = smooth(T_SCHWEB - 1.5, T_SCHWEB, E) * (1 - smooth(T_WEG + .3, T_WEG + 2.5, E));
  BW.wind.update(t, stark, V3(h.g.position.x, SY, h.g.position.z), SY, K);
}

// ======================================================================= Team im Heli + Absprung
const SITZ_H = HELI_BODEN + .48;
const PLATZ = { 4: [.24, 1.42, Math.PI], 1: [.72, 1.42, Math.PI], 2: [-.5, -.82, 0], 7: [.5, -.82, 0] };
const AUGE6 = V3(-.74, SITZ_H + .7, 1.05);
const TUER_L = V3(-1.25, 0, -.05);          // Hockplatz an der offenen Tür (lokal)
function sitzend(f, x, z, yaw, hoehe, extra = {}) { f.pose({ ...SITZPOSE, ...extra }); f.platziere(x, z, yaw, { hoehe: hoehe - .98 * f.root.scale.x + .04 }); }
function sitzerUndSprung(E, t) {
  const h = BW.heli;
  for (const nr of [1, 2, 4, 7]) {
    const f = BW.sitzer[nr], w = TM[nr], j = J[nr];
    f.root.visible = E < j; w.root.visible = E >= j;
    if (E < j - .8) {   // sitzt
      const [x, z, yaw] = PLATZ[nr];
      const extra = { kopf: [.1, Math.sin(E * .7 + nr) * .15, 0] };
      sitzend(f, x, z, yaw, SITZ_H, extra); if (nr === 7) f.ohneGewehr(); else f.haltGewehr('sitz');
      if (nr === 1 && redetE(E, '1')) handAmOhr(f);
      if (nr !== 1) schaueAn(f, h.g.localToWorld(V3(-3, -.5, -.5)), .6);
    } else if (E < j) {  // steht auf, geht geduckt zur Tür
      const [x, z, yaw] = PLATZ[nr], vorn = V3(x, 0, z + (yaw === 0 ? .45 : -.45));
      const k = easeInOut((E - (j - .8)) / .8), q = vorn.clone().lerp(TUER_L, k);
      f.pose({ ...gehPose(k * 6, { hocke: .85, arme: false }), rumpf: [.6, 0, 0], kopf: [-.3, 0, 0] });
      f.platziere(q.x, q.z, winkelLerp(yaw, -Math.PI / 2, smooth(0, .4, k)), { boden: HELI_BODEN }); f.haltGewehr('tief');
    }
    if (E >= j && E < KL[nr][1] - .5 && !(nr === 7 && E >= 21.6)) springUndLauf(w, nr, E, t);
  }
}
function springUndLauf(f, nr, E, t) {
  const h = BW.heli, j = J[nr];
  if (E < j + SPRUNG) {
    const u = (E - j) / SPRUNG, start = h.g.localToWorld(V3(-1.45, HELI_BODEN, -.05)), [lx, lz] = LAND[nr];
    const y = lerp(start.y, SY, u * u) + .35 * Math.sin(Math.PI * u);
    f.pose({ ...hockPose(.55 + .3 * Math.sin(Math.PI * u)), armL: [.9, .5], armR: [.9, .5], kopf: [-.3, 0, 0] });
    f.platziere(lerp(start.x, lx, u), lerp(start.z, lz, u), Math.PI, { boden: y }); f.haltGewehr('tief'); return;
  }
  const [lx, lz] = LAND[nr], [bx, bz] = BASIS[nr];
  if (E < j + SPRUNG + .2) { f.pose(hockPose(.9 - (E - j - SPRUNG) * 1.5)); f.platziere(lx, lz, Math.PI, { boden: SY }); f.haltGewehr('tief'); return; }
  const t0 = j + SPRUNG + .2, d = Math.hypot(bx - lx, bz - lz) / 4.2;
  if (nr === 7 && E > t0 + d) { werferKniet(E, t); return; }
  lauf(f, [[t0, lx, lz], [t0 + d, bx, bz]], E, { boden: SY, still: { ...stehPose(t), rumpf: [.1, 0, 0], kopf: [-.15, 0, 0] }, yawStill: Math.PI });
}
// 7 kniet am Wandfuß und schießt die Enterhaken aufs Geländer
function hakenZiel(i) { return V3(LANES[i], RAIL_Y + .02, RAIL_Z - .1); }
function werferKniet(E, t) {
  const f = TM[7], [bx, bz] = BASIS[7];
  const ziel = E < FEUER[0] + .8 ? hakenZiel(0) : hakenZiel(1);
  const rueck = Math.max(...FEUER.map(F => E > F ? Math.exp(-14 * (E - F)) : 0));
  f.pose({ ...KNIEPOSE, rumpf: [.05 - .25 * rueck, 0, 0], kopf: [-.55, 0, 0] }); f.platziere(bx, bz, Math.PI, { boden: SY }); f.ohneGewehr();
  const sch = f.lokal(-.12, 1.15, .25);
  const W = BW.werfer; W.visible = true; W.position.copy(sch); W.lookAt(ziel); W.rotateY(Math.PI); W.translateZ(.05 * rueck); W.updateMatrixWorld(true);
  f.greife('R', weltPos(W.griffH), f.lokal(-.5, .9, -.2)); f.greife('L', weltPos(W.griffV), f.lokal(.5, .9, .2));
}
// ======================================================================= Seile
function linie(c, a, b) { const d = b.clone().sub(a), l = d.length(); c.visible = l > .01; c.position.copy(a).addScaledVector(d, .5); c.scale.set(1, Math.max(l, .001), 1); c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); }
function stelleSeile(E) {
  const Wf = BW.werfer;
  BW.seile.forEach((g, i) => {
    const F = FEUER[i], x = LANES[i], ziel = hakenZiel(i);
    if (E < F) { g.segs.forEach(c => { c.visible = false; }); g.haken.visible = false; return; }
    g.haken.visible = true;
    const mund = weltPos(Wf.mund);
    if (E < F + FLUG) {   // fliegt: Haken auf leichtem Bogen, Seil hinterher
      const u = (E - F) / FLUG, p = mund.clone().lerp(ziel, u).add(V3(0, Math.sin(Math.PI * u) * .8, 0));
      g.haken.position.copy(p); g.haken.lookAt(ziel); linie(g.segs[0], mund, p); for (let k = 1; k < 4; k++) g.segs[k].visible = false; return;
    }
    // hängt: Haken innen am Handlauf → über den Handlauf → Deckkante → senkrecht die Wand runter → Rest liegt im Schnee
    const wob = Math.exp(-3 * (E - F - FLUG)) * Math.sin((E - F) * 18) * .15;
    g.haken.position.copy(ziel); g.haken.rotation.set(0, 0, 0);
    const a = V3(x, RAIL_Y + .06, RAIL_Z + .07), kante = V3(x, DY + .02, 7.95), unten = V3(x + wob, SY + .02, ROPE_Z), rest = V3(x + .35, SY + .02, ROPE_Z + .9);
    linie(g.segs[0], ziel.clone().add(V3(0, .05, 0)), a); linie(g.segs[1], a, kante); linie(g.segs[2], kante, unten); linie(g.segs[3], unten, rest);
  });
  // Werfer: nach dem 2. Schuss legt 7 ihn in den Schnee
  if (E > FEUER[1] + 1.0) { Wf.position.set(.45, SY + .06, 10.9); Wf.rotation.set(0, .5, 0); Wf.updateMatrixWorld(true); }
  Wf.visible = E > J[7] + SPRUNG + .2 + Math.hypot(BASIS[7][0] - LAND[7][0], BASIS[7][1] - LAND[7][1]) / 4.2;
}

// ======================================================================= Klettern
// Figur hängt am Seil: Hüfte bei (bahnX, hipY), Körper leicht nach hinten gelehnt, Füße gegen die Wand,
// Hände greifen abwechselnd höher (Griffzyklus 0,8 m pro Hand), Knie zeigen nach außen (nie in die Wand)
const ZYK = .6;
function griffRel(h, off) { const u = (h + off) / ZYK, fr = u - Math.floor(u); const rel = .9 - fr * .6; return fr > .78 ? lerp(rel, .9, smooth(.78, 1, fr)) : rel; }
function trittRel(h, off) { const u = (h + off) / ZYK, fr = u - Math.floor(u); const rel = -.3 - fr * .4; return fr > .75 ? lerp(rel, -.3, smooth(.75, 1, fr)) : rel; }
const KIPP = -.25;
function haengt(f, x, hipY, h, { blick = -.55, mund = 0 } = {}) {
  const s = f.root.scale.x, hz = ROPE_Z + .32;
  f.pose({ rumpf: [0, 0, 0], kopf: [blick, 0, 0], mund, beinL: [.8, 1.2], beinR: [.8, 1.2], armL: [2.6, .2], armR: [2.6, .2] });
  const hh = .98 * s; f.platziere(x, hz - Math.sin(-KIPP) * hh, Math.PI, { hoehe: hipY - Math.cos(KIPP) * hh, kipp: [KIPP, 0] });
  f.ohneGewehr();
  f.greife('L', V3(x - .02, hipY + griffRel(h, 0) * s, ROPE_Z), f.lokal(.6, .9, -.2));
  f.greife('R', V3(x + .02, hipY + griffRel(h, ZYK / 2) * s, ROPE_Z), f.lokal(-.6, .9, -.2));
  f.bein('L', V3(x - .17, hipY + trittRel(h, .2) * s, WZ + .08), f.lokal(.35, 1.1, -.1));
  f.bein('R', V3(x + .17, hipY + trittRel(h, .6) * s, WZ + .08), f.lokal(-.35, 1.1, -.1));
}
// Über das Geländer: hochziehen → Beine angezogen drüber (tiefster Punkt immer über dem Handlauf) → Landung in der Hocke
function ueber(f, x, u, zLand = 6.9) {
  const s = f.root.scale.x;
  if (u < .3) { const k = u / .3, hip = lerp(HIP_TOP, .95, easeInOut(k)); haengt(f, x, hip, 0, { blick: -.2 });
    f.greife('L', V3(x - .22, RAIL_Y + .03, RAIL_Z + .04), f.lokal(.6, .9, -.2)); f.greife('R', V3(x + .22, RAIL_Y + .03, RAIL_Z + .04), f.lokal(-.6, .9, -.2)); return; }
  const k = (u - .3) / .7, P = mischen({ beinL: [.8, 1.2], beinR: [.8, 1.2], rumpf: [0, 0, 0] }, { ...hockPose(1.0), rumpf: [.55, 0, 0] }, smooth(0, .3, k));
  const z = lerp(ROPE_Z + .32, zLand, easeInOut(k));
  const boden = k < .62 ? lerp(.45, RAIL_Y + .07, smooth(0, .25, k)) : lerp(RAIL_Y + .07, DY, smooth(.62, 1, k));
  f.pose({ ...P, kopf: [-.1, 0, 0] });
  f.platziere(x, z, Math.PI, { boden });
  if (k < .55) { f.greife('L', V3(x - .22, RAIL_Y + .03, RAIL_Z), f.lokal(.6, .9, -.2)); f.greife('R', V3(x + .22, RAIL_Y + .03, RAIL_Z), f.lokal(-.6, .9, -.2)); }
  f.ohneGewehr();
}
// eine Team-Figur von der Basis bis aufs Deck
function wandFigur(nr, E, t) {
  const f = TM[nr], [bahn, t0] = KL[nr], x = LANES[bahn], top = klTop(nr), [bx, bz] = nr === 7 ? [-1.2, 9.6] : BASIS[nr];
  if (E < t0 - .5) return false;
  if (E < t0) { lauf(f, [[t0 - .5, bx, bz], [t0 - .05, x, ROPE_Z + .75]], E, { boden: SY, yawStill: Math.PI }); f.ohneGewehr(); if (E > t0 - .2) { f.greife('L', V3(x, SY + 1.9, ROPE_Z), f.lokal(.5, 1, 0)); f.greife('R', V3(x, SY + 1.6, ROPE_Z), f.lokal(-.5, 1, 0)); } return true; }
  if (E < top) { const h = (E - t0) * V_KL; haengt(f, x, hip0(f) + h, h, { blick: -.6 + .2 * Math.sin(E * 1.3 + nr) }); return true; }
  if (E < top + UEBER) { ueber(f, x, (E - top) / UEBER, DECK_LAND[nr][1]); return true; }
  return false;
}

// ======================================================================= Hütte: Laufwege auf dem Deck
const tL = nr => klTop(nr) + UEBER;   // gelandet auf dem Deck
function deckWege() {
  return {
    4: [[tL(4), -1.5, 6.9], [tL(4) + .4, -1.9, 5.6], [tL(4) + 1.7, -3.15, .6]],
    2: [[tL(2), 1.5, 6.9], [tL(2) + .4, 1.9, 5.6], [tL(2) + 1.7, 3.1, .55], [T_WACHE + .1, 3.1, .55], [T_TACKLE, 4.95, .75]],
    1: [[tL(1), -1.5, 6.9], [tL(1) + .3, -1.2, 5.9], [tL(1) + 1.3, 1.9, 4.3], [tL(1) + 2.2, 3.45, 1.65]],
    6: [[tL(6), 1.5, 6.9], [tL(6) + .4, 2.1, 5.6], [tL(6) + 1.8, 3.9, 2.7]],
    7: [[tL(7), -1.5, 6.9], [tL(7) + .6, .6, 5.8], [tL(7) + 1.4, 4.4, 4.6], [tL(7) + 2.2, 4.75, 2.95]],
  };
}
const WEG = deckWege();
// Wache: kommt auf dem Seitensteg um die Ecke, sieht uns, will fliehen → 2 tackelt sie von hinten
function stelleWache(E, t) {
  const f = BW.wache, hw = BW.handyW;
  f.root.visible = E > 27 && E < 60;
  if (!f.root.visible) { hw.visible = false; return; }
  if (E < T_WACHE) {
    const p = lauf(f, [[28.6, 5.75, -4.4], [30.6, 5.75, -.4], [T_WACHE, 5.35, .55]], E, { boden: DY, hocke: 0, gewehr: null, still: { ...stehPose(t), kopf: [.45, 0, 0] } });
    if (p.s < 2.6) { const P = { ...gehPose(p.dist / .65 * Math.PI, { arme: false }), kopf: [.45, 0, 0], armR: [1.0, .1], ellR: 1.5 }; f.pose(P); f.platziere(p.x, p.z, richtung(p.vx, p.vz, -.6), { boden: DY }); }
    f.greife('R', f.lokal(-.05, 1.12, .32), f.lokal(-.6, .6, -.2));
    hw.visible = true; hw.position.copy(weltPos(f.j.haR)).add(V3(0, .05, 0)); hw.quaternion.copy(f.root.quaternion); hw.rotateX(-.9); hw.updateMatrixWorld(true);
    return;
  }
  // Handy fällt
  { const d = E - T_WACHE, start = V3(5.4, DY + 1.1, .85); hw.visible = true; const y = Math.max(DY + .006, start.y - 4.9 * d * d); hw.position.set(start.x + .3 * Math.min(d, .4), y, start.z + .4 * Math.min(d, .4)); hw.rotation.set(y > DY + .01 ? d * 9 : -Math.PI / 2, .4, 0); }
  if (E < T_TACKLE) {   // erschrickt, dreht sich zur Flucht
    const k = smooth(T_WACHE, T_TACKLE, E);
    f.pose({ ...gehPose(k * 3, { arme: false }), armL: [.9, .4], armR: [.9, .4], ellL: 1.0, ellR: 1.0, kopf: [-.1, 0, 0] });
    f.platziere(lerp(5.35, 5.4, k), lerp(.55, .95, k), winkelLerp(-1.2, 0, easeOut(k)), { boden: DY }); return;
  }
  // fällt nach vorn auf den Bauch (Kopf Richtung +z), Arme werden auf den Rücken gelegt
  const k = smooth(T_TACKLE, T_TACKLE + .45, E), hand = smooth(T_TACKLE + 1.0, T_TACKLE + 1.6, E);
  f.pose({ beinL: [.1 * (1 - k), .2], beinR: [-.05, .25], armL: [lerp(1.6, -.5, hand), lerp(.5, .25, hand)], armR: [lerp(1.6, -.5, hand), lerp(.5, .25, hand)], ellL: lerp(.4, 1.8, hand), ellR: lerp(.4, 1.8, hand), kopf: [lerp(0, -.9, k), lerp(0, .6, k), 0] });
  f.platziere(5.4, lerp(.95, .9, k), 0, { boden: DY, kipp: [k * Math.PI / 2, 0] });
  if (hand > .9) { const r = BW.schnellA[0]; r.visible = true; const m = weltPos(f.j.haL).add(weltPos(f.j.haR)).multiplyScalar(.5); r.position.copy(m); r.rotation.set(0, Math.PI / 2, 0); } else BW.schnellA[0].visible = E > 60;
}
// 2: Tür-Ladung → Tackle → Handschellen → zurück an die Tür → als Erster rein → Tackle auf Täter A
function stelleZwei(E, t) {
  const f = TM[2];
  if (E < T_WACHE + .1) { const p = lauf(f, WEG[2], E, { boden: DY, still: { ...hockPose(.45), rumpf: [.3, 0, 0] }, yawStill: -Math.PI / 2 }); if (p.s < .05 && E > tL(2) + 1.7) { f.ohneGewehr(); f.greife('R', V3(TUER.x + .38, DY + 1.05, .06), f.lokal(-.5, .5, 0)); } return; }
  if (E < T_TACKLE + .1) { const p = pfad(WEG[2], E); f.pose(rennPose(p.dist / .9 * Math.PI, { neig: .5 })); f.platziere(p.x, p.z, richtung(p.vx, p.vz, 0), { boden: DY }); f.haltGewehr('tief'); return; }
  if (E < 33.8) {   // liegt halb auf der Wache, dann kniend, Handschellen
    const k = smooth(T_TACKLE + .1, T_TACKLE + .6, E);
    f.pose(mischen({ ...rennPose(0, { neig: 1.0 }) }, { ...KNIEPOSE, rumpf: [.6, 0, 0], kopf: [-.2, 0, 0] }, k));
    f.platziere(lerp(4.95, 4.65, k), lerp(.95, 1.75, k), lerp(.3, Math.PI / 2, k), { boden: DY }); f.ohneGewehr();
    const wache = BW.wache; f.greife('L', weltPos(wache.j.haL).add(V3(-.02, .05, 0)), f.lokal(.5, .6, .2)); f.greife('R', weltPos(wache.j.haR).add(V3(-.02, .05, 0)), f.lokal(-.5, .6, .2));
    return;
  }
  if (E < BOOM + 1.0) { lauf(f, [[33.8, 4.65, 1.75], [34.8, 3.1, .55]], E, { boden: DY, still: { ...hockPose(.45), rumpf: [.3, 0, 0], kopf: E > BOOM - .1 ? [.1, .5, 0] : [0, 0, 0] }, yawStill: E > BOOM - .1 && E < BOOM + .9 ? -.2 : -Math.PI / 2 }); return; }
  if (E < T_TACKLE_A) { lauf(f, [[38.2, 3.1, .55], [38.8, 2.3, .2], [39.3, 2.2, -.6], [40.2, 1.2, -1.2], [T_TACKLE_A, .1, -1.6]], E, { boden: DY, gewehr: 'anschlag', hocke: .2 }); return; }
  // Tackle auf A, dann kniet 2 neben ihm und legt Handschellen an
  const k = smooth(T_TACKLE_A, T_TACKLE_A + .5, E);
  f.pose(mischen(rennPose(0, { neig: 1.0 }), { ...KNIEPOSE, rumpf: [.6, 0, 0], kopf: [-.2, 0, 0] }, k)); f.ohneGewehr();
  f.platziere(lerp(.1, -1.2, easeOut(k)), lerp(-1.6, -1.25, k), lerp(-1.4, Math.PI, k), { boden: DY });
  const a = BW.tA; f.greife('L', weltPos(a.j.haL).add(V3(0, .05, 0)), f.lokal(.5, .6, .2)); f.greife('R', weltPos(a.j.haR).add(V3(0, .05, 0)), f.lokal(-.5, .6, .2));
}
function stelleVier(E, t) {
  const f = TM[4];
  if (E < BOOM - .2) { const p = lauf(f, WEG[4], E, { boden: DY, still: { ...hockPose(.45), rumpf: [.3, 0, 0] }, yawStill: Math.PI / 2 }); if (p.s < .05) { f.ohneGewehr(); f.greife('R', V3(FENSTER.x - FENSTER.b / 2 + .1, 1.55, .08), f.lokal(-.5, .5, 0)); } return; }
  if (E < T_BLEND + .5) {   // wegdrehen → aufstehen → Blendgranate durchs Fenster
    const k = smooth(T_BLEND - .25, T_BLEND + .1, E);
    f.pose({ ...mischen({ ...hockPose(.45), rumpf: [.3, 0, 0], kopf: [.1, -.5, 0] }, { ...stehPose(t), rumpf: [.15, 0, 0] }, smooth(BOOM + .1, T_BLEND - .2, E)), armR: [lerp(.3, 2.2, k) - 1.6 * smooth(T_BLEND, T_BLEND + .3, E), .3], ellR: .3 });
    f.platziere(-3.15, .6, Math.PI / 2 + .3, { boden: DY }); f.ohneGewehr(); return;
  }
  // geht zur Tür und wartet hinter mir, dann rein (bleibt als Sicherung im Eingang)
  lauf(f, [[T_BLEND + .5, -3.15, .6], [39.2, -.4, 1.1], [40.2, 1.3, 1.0], [41.4, 1.3, 1.0], [41.9, 2.3, .1], [42.4, 2.1, -.6]], E, { boden: DY, gewehr: 'anschlag', hocke: .25, yawStill: E > 42 ? -2.6 : -Math.PI / 2, still: { ...stehPose(t), rumpf: [.15, 0, 0] } });
}
function stelleEins(E, t) {
  const f = TM[1];
  if (E < 38.7) {
    const p = lauf(f, WEG[1], E, { boden: DY, still: { ...hockPose(.45), rumpf: [.3, 0, 0], kopf: E > BOOM - .1 && E < BOOM + .8 ? [.1, .5, 0] : [0, 0, 0] }, yawStill: -Math.PI / 2 });
    if (E > ZAEHL[0] - .5 && E < BOOM) { const n = E < ZAEHL[0] ? 0 : E < ZAEHL[1] ? 3 : E < ZAEHL[2] ? 2 : 1;
      f.pose({ ...hockPose(.45), rumpf: [.3, 0, 0], armL: [2.7, .35], ellL: 1.2, fingerL: n }); f.platziere(p.x, p.z, -Math.PI / 2, { boden: DY }); f.haltGewehr('tief'); f.greife('L', f.lokal(.3, 1.6, .2), f.lokal(.8, 1.0, -.4)); }
    return;
  }
  if (E < 42.4) { lauf(f, [[38.7, 3.45, 1.65], [39.3, 2.6, .8], [39.9, 2.3, -.4], [40.6, 2.45, -2.2]], E, { boden: DY, gewehr: 'anschlag', hocke: .2, still: { ...stehPose(t), rumpf: [.15, 0, 0] }, yawStill: 2.95 }); return; }
  if (E < 43.4) { lauf(f, [[42.4, 2.45, -2.2], [43.4, 2.35, -4.3]], E, { boden: DY, gewehr: 'anschlag', hocke: .2 }); return; }
  // kniet neben B und legt Handschellen an
  f.pose({ ...KNIEPOSE, rumpf: [.6, 0, 0], kopf: [-.3, 0, 0] }); f.platziere(2.35, -4.3, Math.PI / 2, { boden: DY }); f.ohneGewehr();
  const b = BW.tB; f.greife('L', weltPos(b.j.haL).add(V3(0, .05, 0)), f.lokal(.5, .6, .2)); f.greife('R', weltPos(b.j.haR).add(V3(0, .05, 0)), f.lokal(-.5, .6, .2));
}
function stelleSieben(E, t) {
  const f = TM[7];
  if (E < tL(7)) return;
  if (E < tL(7) + 2.2) { lauf(f, WEG[7], E, { boden: DY, gewehr: 'tief' }); return; }
  f.pose({ ...KNIEPOSE, kopf: [-.3, 0, 0] }); f.platziere(4.75, 2.95, Math.PI / 2, { boden: DY }); f.haltGewehr('tief');
}

// ======================================================================= Innen: Täter A, B, Geisel, Blendgranate
function stelleTaeterA(E, t) {
  const f = BW.tA; f.root.visible = true;
  const seat = { x: -2.2, z: -2.75 }, Y = DY + .475;
  if (E < BANG + .05) { sitzend(f, seat.x, seat.z, Math.PI, Y, { kopf: [.15, Math.sin(t * .5) * .2, 0], armL: [1.2, .1], armR: [1.2, .1], ellL: .9, ellR: .9 }); return; }
  if (E < BANG + .7) {   // springt geblendet auf, Hände vor den Augen
    const k = smooth(BANG + .05, BANG + .7, E); f.pose(mischen(SITZPOSE, { ...stehPose(t), rumpf: [.3, 0, 0] }, k));
    f.platziere(seat.x, lerp(seat.z, -2.3, k), Math.PI - k * .3, { boden: DY }); haendeAugen(f); return;
  }
  if (E < T_TACKLE_A) {   // taumelt Richtung Tür
    const p = pfad([[BANG + .7, -2.2, -2.3], [40.2, -1.5, -2.0], [T_TACKLE_A, -.75, -1.8]], E);
    f.pose({ ...gehPose(p.dist / .5 * Math.PI, { arme: false }), rumpf: [.35 + .1 * Math.sin(E * 4), 0, .1 * Math.sin(E * 3)] });
    f.platziere(p.x, p.z, richtung(p.vx, p.vz, 1.6) + .25 * Math.sin(E * 3), { boden: DY }); haendeAugen(f); return;
  }
  // wird von 2 getackelt: fällt auf den Bauch (Kopf Richtung −x)
  const k = smooth(T_TACKLE_A, T_TACKLE_A + .45, E), hand = smooth(T_TACKLE_A + 1.0, T_TACKLE_A + 1.6, E);
  f.pose({ beinL: [.1, .2], beinR: [-.05, .25], armL: [lerp(1.6, -.5, hand), lerp(.5, .25, hand)], armR: [lerp(1.6, -.5, hand), lerp(.5, .25, hand)], ellL: lerp(.4, 1.8, hand), ellR: lerp(.4, 1.8, hand), kopf: [lerp(0, -.9, k), lerp(0, .6, k), 0] });
  f.platziere(lerp(-.75, -.4, k), -1.8, winkelLerp(1.4, -Math.PI / 2, smooth(0, .4, k)), { boden: DY, kipp: [k * Math.PI / 2, 0] });
  const r = BW.schnellA[1]; r.visible = hand > .9; if (r.visible) { r.position.copy(weltPos(f.j.haL).add(weltPos(f.j.haR)).multiplyScalar(.5)); r.rotation.set(0, 0, 0); }
}
function haendeAugen(f) { f.greife('L', f.j.head.localToWorld(V3(.04, .02, .14)), f.lokal(.5, 1.2, .5)); f.greife('R', f.j.head.localToWorld(V3(-.04, .02, .14)), f.lokal(-.5, 1.2, .5)); }
function stelleTaeterB(E, t) {
  const f = BW.tB; f.root.visible = true;
  const x = 3.0, z0 = -4.7;
  if (E < 41.6) { f.pose({ ...stehPose(t), kopf: [.1, .2 * Math.sin(t * .7), 0], rumpf: [E > BANG ? .3 : .02, 0, 0] }); f.platziere(x, z0, 0, { boden: DY }); if (E > BANG) haendeAugen(f); return; }
  if (E < 42.2) { f.pose({ ...stehPose(t), armL: [2.9, .5], armR: [2.9, .5], ellL: .5, ellR: .5 }); f.platziere(x, z0, 0, { boden: DY }); return; }
  if (E < 42.6) { const k = smooth(42.2, 42.6, E); f.pose(mischen({ ...stehPose(t), armL: [2.9, .5], armR: [2.9, .5] }, { ...KNIEPOSE, beinL: [.15, 2.35], beinR: [.15, 2.35], armL: [2.9, .5], armR: [2.9, .5] }, k)); f.platziere(x, z0, 0, { boden: DY }); return; }
  // legt sich auf den Bauch (Füße am Ofen, Kopf Richtung Tür), Hände auf den Rücken
  const k = smooth(42.6, 43.2, E), hand = smooth(43.7, 44.3, E);
  f.pose({ beinL: [.1, .2], beinR: [-.05, .25], armL: [lerp(2.9, -.5, hand), lerp(.5, .25, hand)], armR: [lerp(2.9, -.5, hand), lerp(.5, .25, hand)], ellL: lerp(.5, 1.8, hand), ellR: lerp(.5, 1.8, hand), kopf: [-.9 * k, -.5 * k, 0] });
  f.platziere(x, lerp(z0, -5.25, k), 0, { boden: DY, kipp: [k * Math.PI / 2, 0] });
  const r = BW.schnellA[2]; r.visible = hand > .9; if (r.visible) { r.position.copy(weltPos(f.j.haL).add(weltPos(f.j.haR)).multiplyScalar(.5)); r.rotation.set(0, Math.PI / 2, 0); }
}
// Geisel: gefesselt auf dem Stuhl (Hände hinter der Lehne) → Fessel durchgeschnitten → steht auf, dreht sich zu uns
const GEISEL_Y = DY + .475;
function stelleGeisel(E, t) {
  const f = BW.geisel; f.root.visible = true; const { x, z } = STUHL;
  const hinten = V3(x, DY + .62, z - .34);
  if (E < T_SCHNITT + .2) {
    sitzend(f, x, z, 0, GEISEL_Y, { rumpf: [.05, 0, 0], kopf: [E > 43.5 ? .1 : .3, E > 43.5 ? -.6 * smooth(43.5, 44.3, E) : .2 * Math.sin(t * .6), 0], blick: E > 43.5 ? [-1, 0] : [0, -1], mund: 0 });
    f.greife('L', hinten.clone().add(V3(.04, 0, 0)), f.lokal(.5, .6, -.5)); f.greife('R', hinten.clone().add(V3(-.04, 0, 0)), f.lokal(-.5, .6, -.5));
    BW.fessel.visible = true; BW.fessel.position.copy(hinten); BW.fessel.rotation.set(0, Math.PI / 2, 0);
    BW.fesselStueck.forEach(m => { m.visible = false; });
    return;
  }
  BW.fessel.visible = false;
  // Fessel-Stücke fallen
  BW.fesselStueck.forEach((m, i) => { const d = E - T_SCHNITT - .2; m.visible = E < 70; m.position.set(hinten.x + (i ? .08 : -.08), Math.max(DY + .015, hinten.y - 4.9 * d * d), hinten.z - .05); m.rotation.set(m.position.y > DY + .02 ? d * 8 : Math.PI / 2, i, 0); });
  const reib = smooth(T_SCHNITT + .2, T_SCHNITT + .8, E), steh = smooth(46.9, 47.5, E), dreh = smooth(47.5, 48.2, E);
  const P = mischen({ ...SITZPOSE, rumpf: [.15, 0, 0] }, { ...stehPose(t), rumpf: [.04, 0, 0] }, steh);
  const lacht = redetE(E, 'G') ? .3 + .4 * Math.abs(Math.sin(E * 15)) : 0;
  f.pose({ ...P, kopf: [lerp(.2, -.05, steh), 0, 0], mund: lacht });
  if (steh <= 0) f.platziere(x, z, 0, { hoehe: GEISEL_Y - .98 * f.root.scale.x + .04 });
  else f.platziere(x, lerp(z, -3.45, steh), lerp(0, Math.PI, dreh), { boden: DY });
  if (reib > 0 && reib < 1 && steh < .5) { f.greife('L', f.lokal(.03, .95, .3), f.lokal(.5, .5, .2)); f.greife('R', f.lokal(-.03, .97, .32), f.lokal(-.5, .5, .2)); }
}
// Blendgranate: fliegt durchs gesprengte Fenster, landet, knallt
function stelleBlend(E) {
  const g = BW.blend; const a = V3(-2.65, 1.6, .5), b = V3(-.6, DY + .03, -2.4);
  g.visible = E > T_BLEND && E < 60;
  if (!g.visible) { BW.blendLicht.intensity = 0; return; }
  const u = clamp((E - T_BLEND) / (BANG - T_BLEND - .05));
  g.position.copy(a.clone().lerp(b, u)).add(V3(0, Math.sin(Math.PI * u) * .35, 0)); g.rotation.set(u * 12, u * 5, 0);
  const d = E - BANG; BW.blendLicht.position.set(-.6, 1.0, -2.4); BW.blendLicht.intensity = d > 0 ? 900 * Math.exp(-9 * d) : 0;
  BW.rauchInnen.update(d, d > 0 ? clamp(1 - (d - 4) / 4) : 0, K);
}
// Tür + Fenster: Sprengung
function stelleTuerFenster(E) {
  const d = E - BOOM, T = BW.b.tuer;
  BW.explT.update(d); BW.explF.update(d); BW.explT.licht.intensity *= .2; BW.explF.licht.intensity *= .2; BW.rauchT.update(d, d > 0 ? clamp(1 - (d - 3) / 3) : 0, K);
  if (d < 0) { BW.b.tuerZu(); BW.b.fenster.scheibe.visible = true; BW.glas.forEach(m => { m.visible = false; }); return; }
  // Tür fliegt nach innen und landet flach rechts neben dem Eingang
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
  // --- im Heli
  if (E < J[6]) {
    const auge = AUGE6.clone();
    let zl = h.g.worldToLocal(V3(0, 0, -3)).sub(AUGE6);                                     // raus auf Hütte/Felsnadel – nur so weit nach vorn, wie die Tür es zulässt
    if (zl.z < 0) zl.z = Math.max(zl.z, -.9 * Math.abs(zl.x)); if (zl.x > -.3) zl.x = -.3 - Math.abs(zl.z) * .2; zl.add(AUGE6);
    const z1 = L('anflug', 'Zu viel');
    if (z1) { const k1 = smooth(z1.start - .9, z1.start - .2, E) * (1 - smooth(z1.ende - .2, z1.ende + .5, E)); zl.lerp(h.g.worldToLocal(kopfW(BW.sitzer[1])), k1); }
    if (E > T_SCHWEB - .3) { const kk = smooth(T_SCHWEB - .3, T_SCHWEB + .4, E); zl.lerp(h.g.worldToLocal(V3(0, SY, 13.5)), kk); }   // runter zum Absatz: Team springt
    if (E > J[6] - .8) { const k = easeInOut((E - (J[6] - .8)) / .8); auge.lerp(V3(-1.3, HELI_BODEN + .95, -.05), k); zl.lerp(h.g.worldToLocal(V3(.5, SY, 12.5)), k); }
    pos = h.g.localToWorld(auge); ziel = h.g.localToWorld(zl); roll = h.g.rotation.z * .6;
    pz = { lauf: 0, zielen: -.3, senken: .4 };
  } else if (E < J[6] + SPRUNG + .3) {   // Sprung
    const u = clamp((E - J[6]) / SPRUNG), a = h.g.localToWorld(V3(-1.45, HELI_BODEN + .9, -.05)), [lx, lz] = LAND[6];
    const yE = SY + 1.0; pos = V3(lerp(a.x, lx, u), lerp(a.y, yE, u * u) + .3 * Math.sin(Math.PI * u), lerp(a.z, lz, u));
    const stoss = E > J[6] + SPRUNG ? Math.exp(-10 * (E - J[6] - SPRUNG)) * .12 : 0; pos.y -= stoss;
    ziel = V3(.8, SY + .5, 9.5).lerp(V3(.8, SY + 2.5, 8), smooth(J[6] + SPRUNG, J[6] + SPRUNG + .3, E));
    pz = { lauf: .4, zielen: -.4, senken: .2 };
  } else if (E < KL[6][1] - .4) {        // läuft zur Basis, schaut zu 7 / Haken / Wand hoch
    const t0 = J[6] + SPRUNG + .3, [lx, lz] = LAND[6], [bx, bz] = BASIS[6];
    const p = pfad([[t0, lx, lz], [t0 + 1.6, bx, bz]], E);
    pos = V3(p.x, SY + lerp(1.0, 1.62, smooth(t0, t0 + .4, E)) + Math.abs(Math.sin(p.dist / .8 * Math.PI)) * .04 * clamp(p.s), p.z);
    ziel = V3(.6, SY + 1.5, 8.6);
    const f7 = TM[7];
    if (E > 15.6) ziel.lerp(kopfW(f7), smooth(15.6, 16.2, E));
    for (const [i, F] of FEUER.entries()) if (E > F - .1) { const hk = BW.seile[i].haken.position; ziel.lerp(hk.clone(), smooth(F - .05, F + .2, E) * (1 - smooth(F + .9, F + 1.25, E))); }
    if (E > 18.4) ziel.lerp(V3(0, SY + 3.5, WZ), smooth(18.4, 19.0, E));     // 4 + 2 klettern los
    pz = { lauf: clamp(p.s / 3), zielen: -.25, senken: .1 };
  } else if (E < KL[6][1]) {             // tritt ans Seil
    const k = easeInOut((E - (KL[6][1] - .4)) / .4); pos = V3(lerp(1.55, 1.5, k), lerp(SY + 1.62, hip06 + .72, k), lerp(10.3, ROPE_Z + .55, k));
    ziel = V3(1.5, SY + 3.5, WZ); modus = 'frei';
    hand = { L: V3(1.48, lerp(SY + 1.3, hip06 + 1.0, k), ROPE_Z), R: V3(1.52, lerp(SY + 1.1, hip06 + .65, k), ROPE_Z) };
  } else if (E < klTop(6)) {             // KLETTERN (POV): Hände greifen abwechselnd, Blick hoch zum Geländer, zweimal runter zu 7
    const h6 = (E - KL[6][1]) * V_KL, hip = hip06 + h6;
    pos = V3(1.5 + .02 * Math.sin(E * 3), hip + .72, ROPE_Z + .55); modus = 'frei';
    ziel = V3(1.45, hip + .72 + .4, WZ);
    const hoch = smooth(20.9, 21.3, E) * (1 - smooth(21.5, 21.8, E)) + smooth(25.1, 25.4, E) * (1 - smooth(26.6, 27.0, E));
    ziel.lerp(V3(1.45, Math.min(hip + 5, RAIL_Y + 1.5), WZ - .8), hoch);
    const runter = smooth(21.9, 22.3, E) * (1 - smooth(23.0, 23.5, E)) + smooth(24.0, 24.4, E) * (1 - smooth(25.1, 25.5, E));
    ziel.lerp(kopfW(TM[7]).add(V3(0, -.5, .3)), runter);
    const duck = E > 25.75 && E < 26.45 ? Math.sin((E - 25.75) / .7 * Math.PI) : 0;   // Schneebrocken fällt vorbei
    pos.add(V3(-.12 * duck, -.05 * duck, .06 * duck)); roll = -.15 * duck;
    hand = { L: V3(1.48, hip + griffRel(h6, 0), ROPE_Z), R: V3(1.52, hip + griffRel(h6, ZYK / 2), ROPE_Z) };
  } else if (E < klTop(6) + UEBER) {     // übers Geländer
    const u = (E - klTop(6)) / UEBER;
    const a = V3(1.5, HIP_TOP + .72, ROPE_Z + .55), b = V3(1.5, RAIL_Y + .85, RAIL_Z + .5), c = V3(1.5, RAIL_Y + .95, RAIL_Z - .3), d = V3(1.5, DY + 1.05, 6.9);
    pos = u < .3 ? a.lerp(b, easeInOut(u / .3)) : u < .65 ? b.lerp(c, easeInOut((u - .3) / .35)) : c.lerp(d, easeInOut((u - .65) / .35));
    ziel = V3(1.5, 1.4, 2).lerp(V3(2.6, 1.0, .5), smooth(.5, 1, u));
    if (u < .6) { modus = 'frei'; hand = { L: V3(1.28, RAIL_Y + .03, RAIL_Z), R: V3(1.72, RAIL_Y + .03, RAIL_Z) }; }
    else pz = { lauf: .3, zielen: -.2, senken: .2 };
  } else if (E < 39.0) {                 // auf dem Deck: in den Stack, Tackle, Countdown, Sprengung
    const p = pfad(WEG[6], E);
    pos = V3(p.x, DY + 1.05 + Math.abs(Math.sin(p.dist / .6 * Math.PI)) * .03 * clamp(p.s), p.z);
    ziel = V3(-1.5, 1.2, .2);                                                          // Hütte: Fenster (4) + Tür (2)
    ziel.lerp(V3(TUER.x, 1.2, 0), smooth(29.8, 30.6, E));
    ziel.lerp(V3(5.3, 1.1, .6), smooth(T_WACHE - .4, T_WACHE, E) * (1 - smooth(33.6, 34.3, E)));     // Wache kommt um die Ecke → Tackle
    ziel.lerp(weltPos(TM[1].j.haL).add(V3(0, .05, 0)), smooth(ZAEHL[0] - .5, ZAEHL[0] - .1, E) * (1 - smooth(BOOM - .4, BOOM - .1, E)));   // Handzeichen 3-2-1
    ziel.lerp(V3(-1.0, 1.3, .3), smooth(BOOM + .1, BOOM + .5, E) * (1 - smooth(38.3, 38.8, E)));     // Fenster: Blendgranate
    const sh = E > BOOM ? .12 * Math.exp(-3 * (E - BOOM)) : 0; pos.add(wackel(t, sh));
    if (E > BOOM - .05 && E < BOOM + .8) roll = .1 * Math.sin((E - BOOM + .05) / .85 * Math.PI);
    if (E > 38.8) { const k = smooth(38.8, 39.0, E); ziel.lerp(V3(TUER.x, 1.3, -1), k); pos.y = lerp(pos.y, DY + 1.5, k); }
    pz = { lauf: clamp(p.s / 2), zielen: E > 38.0 ? .1 : -.2, senken: 0 };
  } else if (E < 44.7) {                 // rein: Tür → an A und 2 vorbei → hinter den Stuhl
    const p = pfad([[39.0, 3.9, 2.7], [39.8, 2.9, 1.3], [40.4, 2.35, .5], [INNEN, 2.3, 0], [42.1, 1.2, -1.1], [43.4, 1.25, -3.2], [44.2, 1.1, -4.55], [44.7, .45, -4.75]], E);
    pos = V3(p.x, DY + 1.5 + Math.abs(Math.sin(p.dist / .65 * Math.PI)) * .03, p.z);
    ziel = V3(1.0, 1.2, -3.0);
    ziel.lerp(V3(-.8, .8, -1.8), smooth(40.3, 40.8, E) * (1 - smooth(41.6, 42.0, E)));     // Tackle A
    ziel.lerp(kopfW(BW.tB), smooth(41.7, 42.1, E) * (1 - smooth(42.6, 43.0, E)));         // B ergibt sich
    ziel.lerp(kopfW(BW.geisel), smooth(42.9, 43.3, E));
    if (E > 44.2) ziel.lerp(V3(.4, DY + .7, -4.0), smooth(44.2, 44.7, E));
    pz = { lauf: clamp(p.s / 2), zielen: .1, senken: 0 };
  } else if (E < 47.3) {                 // knien, Fessel durchschneiden
    const kn = smooth(44.7, 45.1, E) * (1 - smooth(46.8, 47.3, E));
    pos = V3(.45, lerp(DY + 1.5, DY + 1.0, kn), -4.75); ziel = V3(.4, lerp(DY + .9, DY + .55, kn), -4.0);
    ziel.lerp(kopfW(BW.geisel), smooth(46.5, 47.1, E));
    if (kn > .6 && E < T_SCHNITT + .4) { modus = 'frei'; const w = V3(STUHL.x, DY + .62, STUHL.z - .34); const saeg = .03 * Math.sin(E * 22) * smooth(45.3, 45.5, E); hand = { L: w.clone().add(V3(-.07, .03, -.05)), R: w.clone().add(V3(.05 + saeg, -.01, -.07)), messer: true }; }
    else pz = { lauf: 0, zielen: -.3, senken: .5 };
  } else {                               // stehen, sie dreht sich um – Twist
    pos = V3(.45, DY + 1.5, -4.75).add(wackel(t, .004));
    ziel = kopfW(BW.geisel).add(V3(0, -.05, 0));
    const handyBlick = smooth(50.9, 51.3, E) * (1 - smooth(52.6, 53.0, E)); ziel.lerp(weltPos(BW.handy), handyBlick * .6);
    const push = smooth(53.5, 55.5, E); pos.lerp(ziel, .18 * push);
    pz = { lauf: 0, zielen: -.4, senken: .6 };
    if (E > 53.0 && E < 54.4) roll = .03 * Math.sin((E - 53) * 3);
  }
  schau(K, pos, ziel, roll);
  if (modus === 'frei' && hand) { POV.setze({ modus: 'frei', t, zielL: hand.L, zielR: hand.R }); BW.messer.visible = !!hand.messer;
    if (hand.messer) { const r = POV.handWelt('R'); BW.messer.position.copy(r); BW.messer.lookAt(hand.L); BW.messer.rotateX(Math.PI / 2); } }
  else { POV.setze({ modus: 'gewehr', t, ...pz }); BW.messer.visible = false; }
}

// ======================================================================= Einsatz: alles zu einem Zeitpunkt
function einsatz(E, t) {
  heliPos(E, t);
  sitzerUndSprung(E, t);
  stelleSeile(E);
  // Wand
  for (const nr of [4, 2, 1, 7]) {
    if (E < J[nr] + SPRUNG) continue;
    const anDerWand = wandFigur(nr, E, t);
    if (anDerWand) continue;
    if (E < KL[nr][1] - .5) continue;   // läuft noch zur Basis / wartet (sitzerUndSprung)
  }
  // auf dem Deck
  if (E > tL(4)) stelleVier(E, t);
  if (E > tL(2)) stelleZwei(E, t);
  if (E > tL(1)) stelleEins(E, t);
  if (E > tL(7)) stelleSieben(E, t);
  // 7 steht nach dem Schießen auf und geht zur Bahn A
  if (E >= 21.6 && E < KL[7][1] - .5) {
    { const f = TM[7]; lauf(f, [[21.6, 0, 10.6], [22.3, -1.2, 9.6]], E, { boden: SY, gewehr: null, hocke: 0, still: { ...stehPose(t), kopf: [-.5, 0, 0] }, yawStill: Math.PI });
      if (redetE(E, '7')) schaueAn(f, K.position, .8); }
  }
  stelleWache(E, t); stelleTaeterA(E, t); stelleTaeterB(E, t); stelleGeisel(E, t);
  stelleBlend(E); stelleTuerFenster(E);
  // Schneebrocken (2 tritt oben Schnee los) fällt neben mir vorbei
  { const d = E - 25.35, kl = BW.klumpen; kl.visible = d > 0 && d < 1.6; if (kl.visible) { kl.position.set(1.95, DY + .1 - 4.9 * d * d, 8.15); kl.rotation.set(d * 5, d * 3, 0); }
    BW.krumen.forEach((m, i) => { m.visible = kl.visible; if (m.visible) m.position.set(1.95 + Math.sin(i * 2.1) * .15 * d, DY + .1 - 4.4 * d * d - (i % 5) * .06, 8.15 + Math.cos(i * 1.7) * .15 * d); }); }
  // Polizei kommt (Ende): Hubschrauber vor der Terrasse, zwei Beamte an der Tür
  { const ph = BW.polHeli, an = E > 48; ph.g.visible = an;
    if (an) { const k = easeOut(smooth(48, 52, E)); ph.g.position.set(lerp(40, 11, k) + .3 * Math.sin(t), 3 + .3 * Math.sin(t * 1.2), lerp(60, 26, k)); ph.g.rotation.set(.05 * (1 - k), -Math.PI / 2 - .5, .03 * Math.sin(t * .7), 'YXZ'); ph.g.updateMatrixWorld(true); heliUpdate(ph, t); ph.seil.visible = false;
      const blink = Math.floor(t * 5) % 2; BW.polBlau[0].emissiveIntensity = blink ? 8 : .3; BW.polBlau[1].emissiveIntensity = blink ? .3 : 8;
      BW.blauLicht.position.set(2.3, 2.2, 2.2); BW.blauLicht.intensity = k * (blink ? 60 : 10); } else BW.blauLicht.intensity = 0;
    BW.polizisten.forEach((p, i) => { p.root.visible = E > 50.2; if (!p.root.visible) return;
      const w = i ? [[50.4, -7.3, 3.5], [51.0, -5.6, 3.5], [52.4, .2, 2.6], [53.2, 1.4, 1.5]] : [[49.6, -7.3, 3.0], [50.2, -5.6, 3.0], [51.6, 1.0, 2.0], [52.4, 2.3, .6]];
      lauf(p, w, E, { boden: (x) => x < -6.5 ? clamp((x + 7.4) / .9) * DY : DY, gewehr: null, hocke: 0, still: stehPose(t), yawStill: Math.PI }); p.greife('R', p.lokal(-.2, 1.0, .1), p.lokal(-.5, .5, 0)); }); }
  // Handy der Geisel (Twist)
  { const g = BW.geisel, hy = BW.handy; hy.visible = E > 50.6;
    if (hy.visible) { const k = smooth(50.6, 51.1, E); const p = g.lokal(.0, 1.25, .32); hy.position.copy(p); hy.quaternion.copy(g.root.quaternion); hy.rotateX(-.5); hy.updateMatrixWorld(true);
      g.greife('R', p.clone().add(V3(0, -.07, 0)), g.lokal(-.5, .5, .1)); g.greife('L', p.clone().add(V3(.01, -.06, 0)), g.lokal(.5, .5, .1));
      hy.schirm.emissiveIntensity = 1.6 + (Math.floor(E * 6) % 2) * .6 * (1 - smooth(51.5, 52, E));
      g.j.head.rotation.x = lerp(g.j.head.rotation.x, .45, k * (1 - smooth(52.8, 53.3, E))); g.j.head.updateMatrixWorld(true);
      if (E > 53.6 && E < 54.1) g.lider[1].scale.y = 1.5;   // zwinkert
      const grins = smooth(52.9, 53.4, E); g.mund(.15 * grins); }
  }
  bergUpdate(BW.b, t, K, { sturm: lerp(1, .6, smooth(40, 41, E)) });
  // Schatten folgen der Kamera
  BW.b.sonne.position.copy(K.position).add(V3(-30, 50, 40)); BW.b.sonne.target.position.copy(K.position); BW.b.sonne.target.updateMatrixWorld();
  kameraBei(E, t);
  BW.b.innenLicht.intensity = 11;
  BW.s.fog.near = E < 14 ? 150 : 60; BW.s.fog.far = E < 14 ? 2400 : 900;
}
const uhrBei = E => `06:${String(Math.min(59, 12 + Math.floor(E / 6))).padStart(2, '0')}`;
function redner(E) {   // wer gerade spricht → Figur für die Markierung
  const z = zeileBeiE(E); if (!z) return null;
  if (z.wer === '1' || z.wer === '1f') return E < J[1] ? BW.sitzer[1] : TM[1];
  if (z.wer === '7v') return TM[7];
  if (z.wer === 'G') return BW.geisel;
  return null;
}

// ======================================================================= Szenen
function s_einsatz(lt, t) {
  const E = t - E_START; einsatz(E, t);
  return { welt: BW, uhr: uhrBei(E), blitz: E > BANG && E < BANG + .25 ? .35 * (1 - (E - BANG) / .25) : (E > BOOM && E < BOOM + .15 ? .5 * (1 - (E - BOOM) / .15) : 0), wer: redner(E) };
}
function s_hook(lt, t) {
  // 0–2,1 s: Klettern am Seil im Sturm (Blick hoch zur Hütte) → Schnitt → Doppelsprengung → Freeze → Zurückspulen
  const schnitt = 2.1, freeze = 3.3, sp = lt > 4.0 ? (lt - 4.0) / .6 : 0;
  if (lt < schnitt) { const E = 24.6 + lt; einsatz(E, E + E_START); return { welt: BW, uhr: uhrBei(E), titel: true, blitz: lt > schnitt - .12 ? (lt - (schnitt - .12)) / .12 : 0 }; }
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
const SZENEN = { hook: s_hook, anflug: s_einsatz, wand: s_einsatz, huette: s_einsatz, innen: s_einsatz, twist: s_twist };
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
  const figs = { 1: TM[1], 2: TM[2], 4: TM[4], 7: TM[7], W: BW.wache, A: BW.tA, B: BW.tB, G: BW.geisel, P0: BW.polizisten[0], P1: BW.polizisten[1] };
  const erg = {};
  for (let E = 10; E < 61; E += .05) {
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
