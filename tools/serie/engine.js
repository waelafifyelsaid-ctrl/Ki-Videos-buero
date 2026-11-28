// Serienfabrik – spielt ein Folgen-Skript (skript_fertig.json) als 3D-POV-Video ab.
// Ein Skript beschreibt nur Szenen, Figuren-Wege, Posen, Blicke, Kamera, Handy-/Eilmeldungen, Effekte und Dialog.
// Alles Weitere (Kulisse, Licht, Gehen/Rennen, Sprecher-Markierung, Übergänge, Endkarte) macht diese Engine.
import { THREE, W, H, mat, box, cyl, sph, at, clamp, lerp, easeOut, easeInOut, easeBack, smooth, weltPos, rng, setzeToon, radialTex } from '/tools/einsatz3d/kern.js';
import { Figur, gehPose, rennPose, hockPose, stehPose } from '/tools/einsatz3d/figur.js';
import { renderer, Post, UEBERGANG, Explosion } from '/tools/einsatz3d/welt.js';
import { Pov } from '/tools/einsatz3d/pov.js';
import { wohnblock, wohnblockUpdate, strasse, strasseUpdate } from '/tools/einsatz3d/stadt.js';

const SK = await (await fetch('./skript_fertig.json')).json();
setzeToon(true); Figur.augen = 1.45;
const R = renderer({ logDepth: true }); R.toneMappingExposure = 1.1;
const POST = new Post(R, { cartoon: true });
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- Figuren-Looks (Presets, im Skript überschreibbar)
const LOOKS = {
  mama: { art: 'zivil', jacke: 0x6d597a, hose: 0x343a40, schuh: 0x2b2d42, haare: true, haarfarbe: 0x5b3a29, dutt: true, lippen: 0xb5444f, haut: 0xf1c9a5, groesse: 1.68 },
  papa: { art: 'zivil', jacke: 0x3d5a80, hose: 0x2b2d42, schuh: 0x1d1f22, haare: true, haarfarbe: 0x3d2b1f, bart: 0x3d2b1f, haut: 0xe0ac69, groesse: 1.84 },
  schwester: { art: 'zivil', jacke: 0xe76f51, hose: 0x264653, schuh: 0xf1f3f5, haare: true, haarfarbe: 0x2b1d14, zopf: 0x2b1d14, lippen: 0xc0505a, haut: 0xe0ac69, groesse: 1.42 },
  bruder: { art: 'zivil', jacke: 0x2a9d8f, hose: 0x343a40, schuh: 0xf1f3f5, haare: true, haarfarbe: 0x14110f, haut: 0xc68642, groesse: 1.5 },
  freund: { art: 'zivil', jacke: 0x9d0208, hose: 0x212529, schuh: 0xf1f3f5, haare: true, haarfarbe: 0x14110f, haut: 0x8d5524, groesse: 1.8, kapuze: true },
  freundin: { art: 'zivil', jacke: 0xf4a261, hose: 0x343a40, schuh: 0xf1f3f5, haare: true, haarfarbe: 0xc8551b, zopf: 0xc8551b, lippen: 0xb5444f, haut: 0xf1c9a5, groesse: 1.66 },
  nachbar: { art: 'zivil', jacke: 0x6c757d, hose: 0x495057, schuh: 0x1d1f22, haare: true, haarfarbe: 0xadb5bd, bart: 0xadb5bd, brille: true, haut: 0xffdbac, groesse: 1.76 },
  nachbarin: { art: 'zivil', jacke: 0xb5838d, hose: 0x495057, schuh: 0x1d1f22, haare: true, haarfarbe: 0xdee2e6, dutt: true, brille: true, haut: 0xffdbac, groesse: 1.62 },
  fremder: { art: 'zivil', jacke: 0x212529, hose: 0x212529, schuh: 0x111111, kapuze: true, haut: 0xd9a77a, groesse: 1.86 },
  polizist: { art: 'zivil', jacke: 0x1d3557, hose: 0x14213d, schuh: 0x111111, kappe: 0x14213d, haut: 0xe0ac69, groesse: 1.8 },
  verkaeufer: { art: 'zivil', jacke: 0x2a9d8f, hose: 0x343a40, schuh: 0x1d1f22, haare: true, haarfarbe: 0x6f1d1b, haut: 0xf1c27d, groesse: 1.74 },
  passant: { art: 'zivil', jacke: 0x8ab17d, hose: 0x495057, schuh: 0x1d1f22, haare: true, haarfarbe: 0x3d2b1f, haut: 0xe0ac69, groesse: 1.75 },
};
// ---------------------------------------------------------------- Welten (werden nur gebaut, wenn das Skript sie nutzt)
const WELTEN = {};
function welt(name) {
  if (WELTEN[name]) return WELTEN[name];
  const s = new THREE.Scene(); let k, u;
  if (name === 'wohnung') { k = wohnblock(s); u = (w, t, z) => wohnblockUpdate(w, t, z); }
  else if (name === 'strasse' || name === 'strasse_nacht' || name === 'markt' || name === 'markt_nacht') { k = strasse(s, { nacht: name.endsWith('nacht') }); u = (w, t, z) => strasseUpdate(w, t, { licht: z.licht, ampel: z.licht }); }
  else throw new Error('Unbekannte Welt: ' + name);
  const kam = new THREE.PerspectiveCamera(84, W / H, .03, 2000); kam.rotation.order = 'YXZ'; s.add(kam);
  const pov = new Pov(kam, { aermel: SK.ich?.aermel ? parseInt(SK.ich.aermel) : 0x2b2d42, handschuhe: false, haut: SK.ich?.haut ? parseInt(SK.ich.haut) : 0xe0b48c });
  // Handy + Taschenlampe für die Ich-Hand
  const handy = new THREE.Group(); handy.add(at(box(.075, .15, .01, mat(0x111214)), 0, 0, 0)); const schirmTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1d3557'); gr.addColorStop(1, '#6d597a'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256); g.fillStyle = '#fff'; g.font = 'bold 34px DejaVu Sans'; g.textAlign = 'center'; g.fillText((SK.szenen[0].uhr ?? '21:47').slice(0, 5), 64, 70); g.font = '13px DejaVu Sans'; g.fillText('Kein Netz', 64, 92); for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(10, 120 + k * 36, 108, 28); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const schirm = new THREE.MeshBasicMaterial({ map: schirmTex }); handy.add(at(box(.066, .135, .002, schirm), 0, 0, .006)); kam.add(handy);
  const lampe = new THREE.Group(); lampe.add(at(cyl(.022, .028, .16, mat(0x212529, { m: .5 }), 12), 0, 0, 0, Math.PI / 2)); const glas = mat(0xfff1c9, { e: 0xfff1c9, ei: 3, noCache: true }); lampe.add(at(cyl(.028, .028, .01, glas, 12), 0, 0, -.08, Math.PI / 2)); kam.add(lampe);
  const strahl = new THREE.SpotLight(0xfff4dd, 0, 18, .42, .5, 1.3); strahl.castShadow = true; strahl.shadow.mapSize.set(1024, 1024); kam.add(strahl); const sz = new THREE.Object3D(); sz.position.set(0, 0, -5); kam.add(sz); strahl.target = sz;
  const kegel = new THREE.Mesh((() => { const g = new THREE.ConeGeometry(.9, 6, 20, 1, true); g.translate(0, -3, 0); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  kam.add(kegel);
  const expl = new Explosion(s, V3(0, -100, 0), { groesse: .8 });
  WELTEN[name] = { name, s, k, u, kam, pov, handy, schirm, lampe, strahl, kegel, figs: {}, expl };
  return WELTEN[name];
}
function figurIn(wn, id) {
  const w = welt(wn); if (w.figs[id]) return w.figs[id];
  const r = SK.rollen[id] ?? {}; const look = { ...(LOOKS[r.look] ?? LOOKS.passant), ...(r.extra ?? {}) };
  for (const k of ['jacke', 'hose', 'schuh', 'haarfarbe', 'haut', 'bart', 'kappe', 'lippen', 'zopf']) if (typeof look[k] === 'string') look[k] = parseInt(look[k]);
  const f = new Figur(look); w.s.add(f.root); f.root.visible = false; w.figs[id] = f;
  if (look.zopf || r.langeHaare) { const hm = mat(look.haarfarbe ?? 0x2b1d14, { r: .95 }), hd = f.j.head;   // lange Haare + Pony + Wimpern
    const lang = sph(1, hm, 18, 12); lang.scale.set(.115, .17, .075); lang.position.set(0, .07, -.07); hd.add(lang);
    for (const sx of [1, -1]) { const st = sph(1, hm, 12, 10); st.scale.set(.028, .12, .05); st.position.set(sx * .1, .07, 0); hd.add(st); }
    const pony = sph(1, hm, 14, 8); pony.scale.set(.1, .035, .06); pony.position.set(.02, .215, .07); pony.rotation.z = -.25; hd.add(pony);
    for (const sx of [1, -1]) { const wi = box(.04, .007, .006, mat(0x1a1a1a)); wi.position.set(sx * .036, .168, .118); wi.rotation.z = sx * -.25; hd.add(wi); } }
  return f;
}
// Alle Welten/Figuren vorab bauen (kein Ruckeln beim ersten Bild einer Szene)
for (const sz of SK.szenen) { welt(sz.welt); for (const id of Object.keys(sz.figuren ?? {})) figurIn(sz.welt, id); }

// ---------------------------------------------------------------- Hilfen: Keyframes
const zahlen = (keys, t, def = 0) => {   // [[t, wert], …] linear
  if (!keys || !keys.length) return def; if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [a, va] = keys[i], [b, vb] = keys[i + 1]; if (t <= b) return lerp(va, vb, (t - a) / Math.max(1e-6, b - a)); }
  return keys[keys.length - 1][1];
};
const stufe = (keys, t, def) => { if (!keys || !keys.length) return def; let v = keys[0][1]; for (const [a, x] of keys) if (t >= a) v = x; return v; };
function pfad(keys, t) {   // [[t, x, z], …] mit weichem An-/Abbremsen pro Abschnitt, liefert Tempo + Wegstrecke
  let dist = 0;
  if (t <= keys[0][0]) return { x: keys[0][1], z: keys[0][2], vx: 0, vz: 0, s: 0, dist: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0, z0] = keys[i], [t1, x1, z1] = keys[i + 1]; const seg = Math.hypot(x1 - x0, z1 - z0);
    if (t <= t1) { const k = (t - t0) / (t1 - t0); return { x: lerp(x0, x1, k), z: lerp(z0, z1, k), vx: (x1 - x0) / (t1 - t0), vz: (z1 - z0) / (t1 - t0), s: seg / (t1 - t0), dist: dist + seg * k }; }
    dist += seg;
  }
  const l = keys[keys.length - 1]; return { x: l[1], z: l[2], vx: 0, vz: 0, s: 0, dist };
}
const richtung = (vx, vz, sonst) => (Math.hypot(vx, vz) > .05 ? Math.atan2(vx, vz) : sonst);
const kopfW = f => weltPos(f.j.head).add(V3(0, .12, 0));
function zeile(n, lt) { let a = null; for (const z of SK.dialog) if (z.szene === n && lt >= z.start && lt < z.ende) a = z; return a; }
function schaueAn(f, ziel, mix = 1) {
  const n = f.j.neck; n.updateMatrixWorld(true); const l = n.worldToLocal(ziel.clone());
  const yaw = clamp(Math.atan2(l.x, l.z), -1.2, 1.2), nick = clamp(-Math.atan2(l.y - .12, Math.hypot(l.x, l.z)), -.55, .55);
  const h = f.j.head; h.rotation.set(lerp(h.rotation.x, nick, mix), lerp(h.rotation.y, yaw, mix), h.rotation.z); h.updateMatrixWorld(true);
}
function ziel3(w, z, kam) {   // Blickziel: Rollen-ID → Kopf, "kamera" → Kamera, [x,y,z] → Punkt
  if (z === 'kamera') return kam.position.clone();
  if (typeof z === 'string') { const f = w.figs[z]; return f ? kopfW(f) : V3(0, 1.6, 0); }
  return V3(z[0], z[1], z[2]);
}

// ---------------------------------------------------------------- Posen
function pose(f, name, t, ph, redet) {
  const m = redet ? .35 + .5 * Math.abs(Math.sin(t * 17)) : 0, st = stehPose(t);
  switch (name) {
    case 'sitzen': return { beinL: [1.5, 1.55], beinR: [1.42, 1.5], rumpf: [.08, 0, 0], mund: m, armL: [.9, .1], armR: [.9, .1], ellL: .9, ellR: .9 };
    case 'reden': return { ...st, mund: m, armR: [.6 + .3 * Math.sin(t * 3), .2], ellR: 1.0 + .3 * Math.sin(t * 4.1), armL: [.3 + .15 * Math.sin(t * 2.3), .15], ellL: .6 };
    case 'zeigen': return { ...st, mund: m, armR: [1.45, .1], ellR: .1, fingerR: 1 };
    case 'arme_hoch': return { ...st, mund: m, armL: [2.9, .5], armR: [2.9, .5], ellL: .5, ellR: .5 };
    case 'panik': return { ...st, mund: m, rumpf: [.2, 0, .05 * Math.sin(t * 6)], armL: [2.6, .6], armR: [2.6, .6], ellL: 2.0, ellR: 2.0 };
    case 'telefon': return { ...st, mund: m, armR: [1.5, .6], ellR: 2.3 };
    case 'arme_verschraenkt': return { ...st, mund: m, armL: [.9, .3], armR: [.9, .3], ellL: 1.9, ellR: 1.9 };
    case 'knien': return { beinL: [.15, 2.35], beinR: [1.55, 1.65], rumpf: [.3, 0, 0], mund: m };
    case 'hocken': return { ...hockPose(.8), mund: m };
    case 'winken': return { ...st, mund: m, armR: [2.8, .4 + .3 * Math.sin(t * 9)], ellR: .5 };
    case 'tragen': return { ...st, mund: m, armL: [.9, .1], armR: [.9, .1], ellL: 1.3, ellR: 1.3 };
    default: return { ...st, mund: m };
  }
}
function stelleFigur(w, id, spec, lt, t, n) {
  const f = figurIn(w.name, id); f.root.visible = !(spec.sichtbar && !stufe(spec.sichtbar, lt, 1));
  if (!f.root.visible) return;
  const z = zeile(n, lt), redet = z && z.wer === id;
  const wege = spec.wege ?? [[0, 0, 0]], p = pfad(wege, lt);
  let P; const pn = stufe(spec.pose, lt, 'stehen');
  if (p.s > 2.4) P = { ...rennPose(p.dist / .95 * Math.PI, { neig: .3 }), mund: redet ? .5 : 0 };
  else if (p.s > .05) P = { ...gehPose(p.dist / .65 * Math.PI), mund: redet ? .5 : 0 };
  else P = pose(f, pn, t, 0, redet);
  f.pose(P);
  const yawFest = spec.yaw ? zahlen(spec.yaw, lt) * Math.PI / 180 : null;
  const yaw = p.s > .05 ? richtung(p.vx, p.vz, 0) : (yawFest ?? richtung(p.vx, p.vz, 0));
  if (pn === 'sitzen' && p.s <= .05) f.platziere(p.x, p.z, yaw, { hoehe: (spec.sitzhoehe ?? .47) - .98 * f.root.scale.x + .04 });
  else f.platziere(p.x, p.z, yaw, { boden: spec.boden ?? 0 });
  for (const rq of w.sz?.requisiten ?? []) if (stufe(rq.halter, lt, null) === id) { f.greife('L', f.lokal(.16, 1.0, .35), f.lokal(.5, .8, -.2)); f.greife('R', f.lokal(-.16, 1.0, .35), f.lokal(-.5, .8, -.2)); }
  if (pn === 'telefon' && p.s <= .05) f.greife('R', f.j.head.localToWorld(V3(-.12, .02, .03)), f.lokal(-.5, 1.2, -.2));
  const blick = stufe(spec.blick, lt, null) ?? (redet ? 'kamera' : null);
  if (blick) schaueAn(f, ziel3(w, blick, w.kam), .9);
}

// ---------------------------------------------------------------- Kamera (ICH)
function kamera(w, sz, lt, t) {
  const kk = sz.kamera ?? {}, pk = kk.pos ?? [[0, 0, 1.6, 0]];
  let pos;
  if (lt <= pk[0][0]) pos = V3(pk[0][1], pk[0][2], pk[0][3]);
  else { pos = V3(...pk[pk.length - 1].slice(1)); for (let i = 0; i < pk.length - 1; i++) { const a = pk[i], b = pk[i + 1]; if (lt <= b[0]) { const k = easeInOut((lt - a[0]) / Math.max(1e-6, b[0] - a[0])); pos = V3(lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)); break; } } }
  // Gehen: leichtes Wippen, wenn sich die Kamera bewegt
  const tem = (() => { for (let i = 0; i < pk.length - 1; i++) { const a = pk[i], b = pk[i + 1]; if (lt > a[0] && lt <= b[0]) return Math.hypot(b[1] - a[1], b[3] - a[3]) / (b[0] - a[0]); } return 0; })();
  pos.y += Math.abs(Math.sin(lt * 7.5)) * .035 * clamp(tem / 1.5);
  const bk = kk.blick ?? [[0, [0, 1.6, -5]]];
  let ziel = ziel3(w, bk[0][1], w.kam);
  for (let i = 1; i < bk.length; i++) { const k = easeInOut((lt - bk[i][0]) / Math.max(.05, bk[i][2] ?? .5)); if (k > 0) ziel.lerp(ziel3(w, bk[i][1], w.kam), k); }
  const wk = zahlen(kk.wackel, lt, 0);
  pos.add(V3((Math.sin(t * 5.3) + .5 * Math.sin(t * 11.7)) * .015 * wk, (Math.sin(t * 6.1) + .5 * Math.sin(t * 13.3)) * .015 * wk, 0));
  w.kam.position.copy(pos); const d = ziel.clone().sub(pos);
  w.kam.rotation.set(Math.atan2(d.y, Math.hypot(d.x, d.z)), Math.atan2(-d.x, -d.z), zahlen(kk.roll, lt, 0) * Math.PI / 180); w.kam.updateMatrixWorld(true);
  // Hände
  const hand = stufe(sz.hand, lt, 'leer'), lw = (x, y, z) => w.kam.localToWorld(V3(x, y, z));
  w.handy.visible = hand === 'handy'; w.lampe.visible = hand === 'lampe'; w.strahl.intensity = hand === 'lampe' ? 40 : 0; w.kegel.visible = hand === 'lampe';
  const wackelH = .01 * Math.sin(t * 2.3);
  if (hand === 'handy') { w.handy.position.set(.06, -.2 + wackelH, -.36); w.handy.rotation.set(.25, -.1, 0); w.pov.setze({ modus: 'frei', t, zielR: w.handy.localToWorld(V3(0, -.06, -.01)), zielL: lw(-.3, -.6, -.2) }); w.pov.arme.L.sh.visible = false; }
  else if (hand === 'lampe') { w.lampe.position.set(.14, -.2 + wackelH, -.4); w.lampe.rotation.set(0, 0, 0); w.strahl.position.set(.14, -.2, -.48); w.kegel.position.set(.14, -.2, -.48); w.pov.setze({ modus: 'frei', t, zielR: w.lampe.localToWorld(V3(0, -.02, .04)), zielL: lw(-.3, -.6, -.2) }); w.pov.arme.L.sh.visible = false; }
  else if (hand === 'tasse') w.pov.setze({ modus: 'tasse', t });
  else if (Array.isArray(hand)) { w.pov.setze({ modus: 'frei', t, zielR: V3(...hand[0]), zielL: hand[1] ? V3(...hand[1]) : null }); }   // Hand greift an einen Punkt (Tür, Klinke)
  else w.pov.setze({ modus: 'aus' });
}

// ---------------------------------------------------------------- Szene rendern
const SZ = SK.szenen;
function szene(i, lt, ziel) {
  const sz = SZ[i], w = welt(sz.welt), t = sz.start + lt;
  Figur.zeit = t;
  w.sz = sz; for (const f of Object.values(w.figs)) f.root.visible = false;
  for (const [id, spec] of Object.entries(sz.figuren ?? {})) stelleFigur(w, id, spec, lt, t, sz.n);
  w.u(w.k, t, { licht: zahlen(sz.licht, lt, 1), stadt: zahlen(sz.stadt, lt, 0), kerzen: zahlen(sz.kerzen, lt, 0), treppe: sz.treppe ? zahlen(sz.treppe, lt, 1) : null, tv: sz.tv ? zahlen(sz.tv, lt, 1) : null });
  // Effekte: Explosion in der Ferne, Blitz, Wackeln
  let blitz = 0, wack = 0;
  w.expl.update(-1);
  for (const e of sz.effekte ?? []) { const d = lt - e[0];
    if (e[1] === 'explosion' && d > -.01) { w.expl.pos.set(...e[2]); w.expl.licht.position.set(...e[2]); w.expl.update(d); w.expl.licht.intensity *= .3; wack = Math.max(wack, .5 * Math.exp(-3 * d)); }
    if (e[1] === 'blitz' && d >= 0 && d < .25) blitz = Math.max(blitz, 1 - d / .25);
    if (e[1] === 'schlag' && d >= 0 && d < .6) wack = Math.max(wack, Math.exp(-6 * d)); }
  // Türen: Wohnungstür / Nachbartür (Winkel in Grad, öffnen nach innen)
  if (w.k.tuer) w.k.tuer.rotation.y = zahlen(sz.tueren?.wohnung, lt, 0) * Math.PI / 180;
  if (w.k.nachbarTuer) w.k.nachbarTuer.rotation.y = -zahlen(sz.tueren?.nachbar, lt, 0) * Math.PI / 180;
  kamera(w, sz, lt, t);
  // Requisiten (z. B. Wasserkiste, Tüte): liegen an Keyframe-Positionen oder werden von einer Rolle / mir gehalten
  w.req ??= {}; for (const r of Object.values(w.req)) r.visible = false;
  (sz.requisiten ?? []).forEach((rq, k) => { const key = rq.typ + k; let m = w.req[key];
    if (!m) { m = new THREE.Group(); const f = rq.typ === 'wasser' ? 0x8ecae6 : rq.typ === 'tuete' ? 0xf1f3f5 : 0x8b5a2b;
      if (rq.typ === 'wasser') { for (let i = 0; i < 6; i++) m.add(at(cyl(.045, .045, .3, mat(0x8ecae6, { transparent: true, opacity: .8 }), 10), -.1 + (i % 3) * .1, 0, -.05 + Math.floor(i / 3) * .1)); m.add(at(box(.32, .08, .22, mat(0x1d3557)), 0, .02, 0)); }
      else m.add(at(box(.35, .3, .25, mat(f)), 0, 0, 0));
      w.s.add(m); w.req[key] = m; }
    m.visible = true; const halter = stufe(rq.halter, lt, null);
    if (halter === 'ich') { m.position.copy(w.kam.localToWorld(V3(0, -.42, -.55))); m.quaternion.copy(w.kam.quaternion); }
    else if (halter && w.figs[halter]?.root.visible) { const f = w.figs[halter]; m.position.copy(weltPos(f.j.haL).lerp(weltPos(f.j.haR), .5)); m.rotation.set(0, f.root.rotation.y, 0); }
    else { const p = rq.pos ?? [[0, 0, 0, 0]]; m.position.set(zahlen(p.map(q => [q[0], q[1]]), lt), zahlen(p.map(q => [q[0], q[2]]), lt), zahlen(p.map(q => [q[0], q[3]]), lt)); m.rotation.set(0, 0, 0); } });
  for (const e of sz.effekte ?? []) if (e[1] === 'lampe_aus' && lt >= e[0] && lt < e[0] + (e[2] ?? .3)) { w.strahl.intensity = 0; w.kegel.visible = false; }
  if (wack > 0) { w.kam.position.add(V3((Math.random() - .5) * .04 * wack, (Math.random() - .5) * .04 * wack, 0)); w.kam.updateMatrixWorld(true); }
  POST.rendere(w.s, w.kam, ziel);
  const z = zeile(sz.n, lt); const wer = z && w.figs[z.wer] && w.figs[z.wer].root.visible ? w.figs[z.wer] : null;
  return { w, sz, blitz, wer, sat: stufe(sz.sat, lt, 1) };
}

// ---------------------------------------------------------------- UI
const ui = Object.fromEntries(['sub', 'wer', 'txt', 'nachricht', 'mitte', 'ende', 'redner', 'titel', 'teil', 'uhr', 'rec'].map(k => [k, document.getElementById(k)]));
const WOLB = .3, AS = W / H;
function linse(u, v) { let cx = (u - .5) * AS, cy = v - .5; const r2 = cx * cx + cy * cy, f = (1 + WOLB * r2) / (1 + WOLB * .35); return [cx * f / AS + .5, cy * f + .5]; }
function aufSchirm(p, kam) { const v = p.clone().project(kam); if (v.z > 1) return null; const z = [v.x * .5 + .5, v.y * .5 + .5]; let u = z[0], w = z[1]; for (let i = 0; i < 6; i++) { const [a, b] = linse(u, w); u += z[0] - a; w += z[1] - b; } return [u * W, (1 - w) * H]; }
function zeigeUI(i, lt, r, t) {
  const sz = SZ[i], z = zeile(sz.n, lt);
  if (z) { const ro = SK.rollen[z.wer] ?? {}; ui.sub.style.opacity = clamp((lt - z.start) / .12) * clamp((z.ende - lt) / .12); ui.wer.textContent = ro.name ?? z.wer; ui.wer.style.color = ro.farbe ?? '#fff'; ui.txt.textContent = z.text; ui.txt.style.color = z.wer === 'ich' ? '#80ed99' : (ro.telefon ? '#ffd166' : '#ffffff'); }
  else ui.sub.style.opacity = 0;
  { let zeig = 0; if (z && r.wer) { const p = aufSchirm(kopfW(r.wer).add(V3(0, .32, 0)), r.w.kam); if (p && p[0] > 60 && p[0] < W - 60 && p[1] > 200 && p[1] < H - 320) { const ro = SK.rollen[z.wer] ?? {}; zeig = clamp((lt - z.start) / .15) * clamp((z.ende - lt) / .15);
        ui.redner.querySelector('b').textContent = ro.name ?? z.wer; ui.redner.style.borderColor = ro.farbe ?? '#fff'; ui.redner.querySelector('b').style.color = ro.farbe ?? '#fff'; ui.redner.querySelector('i').style.borderTopColor = ro.farbe ?? '#fff';
        ui.redner.style.left = (p[0] - ui.redner.offsetWidth / 2) + 'px'; ui.redner.style.top = (p[1] - 118) + 'px'; } } ui.redner.style.opacity = zeig; }
  { let k = 0; for (const [a, b, kopf, text, art] of sz.karten ?? []) if (lt >= a - .05 && lt < b + .3) { k = clamp((lt - a) / .3) * clamp((b - lt) / .3);
      ui.nachricht.className = 'ov ' + (art ?? 'info'); ui.nachricht.querySelector('em').textContent = kopf; ui.nachricht.querySelector('span').textContent = text; ui.nachricht.style.transform = `translateY(${(1 - easeOut(clamp((lt - a) / .4))) * -160}px)`; }
    ui.nachricht.style.opacity = k; }
  { let k = 0; for (const [a, b, text] of sz.mitte ?? []) if (lt >= a && lt < b + .2) { k = clamp((lt - a) * 5) * clamp((b - lt) * 5); ui.mitte.textContent = text; ui.mitte.style.transform = `scale(${.8 + .2 * easeBack((lt - a) / .3)})`; } ui.mitte.style.opacity = k; }
  ui.titel.style.opacity = i === 0 && lt < (SK.titelDauer ?? 2.4) ? 1 : 0;
  ui.uhr.textContent = sz.uhr ? sz.uhr.replace('%s', String(Math.floor(lt) % 60).padStart(2, '0')) : '';
  // Endkarte
  const end = SK.ende ?? {}, ed = 3.0, letzte = i === SZ.length - 1;
  if (letzte && lt > sz.d - ed) { const e = lt - (sz.d - ed); ui.ende.style.opacity = clamp(e * 3);
    const tip = (el, t0) => { const k = e - t0; el.style.opacity = clamp(k * 4); el.style.transform = `scale(${k < 0 ? .5 : .8 + .2 * easeBack(k / .35) + .06 * Math.sin(e * 9) * (k > .4 ? 1 : 0)})`; };
    tip(ui.ende.querySelector('.like'), .7); tip(ui.ende.querySelector('.folgen'), 1.1); ui.ende.querySelector('.like').classList.toggle('an', e > 1.0); ui.ende.querySelector('.folgen').classList.toggle('an', e > 1.5); }
  else ui.ende.style.opacity = 0;
}
ui.titel.textContent = SK.titelKarte ?? SK.titel; ui.ende.querySelector('h1').textContent = SK.ende?.oben ?? 'TEIL 2'; ui.ende.querySelector('h2').textContent = SK.ende?.mitte ?? ''; ui.ende.querySelector('p').textContent = SK.ende?.unten ?? 'Folgen, um es nicht zu verpassen!';
ui.teil.textContent = SK.teilLabel ?? '';

window.renderFrame = async (t) => {
  let i = 0; SZ.forEach((s, k) => { if (t >= s.start) i = k; });
  const sz = SZ[i], lt = t - sz.start, tr = sz.tr, trd = sz.trd ?? .45;
  let r, post = {};
  if (i > 0 && tr && lt < trd) {
    szene(i - 1, SZ[i - 1].d + lt, POST.a); r = szene(i, lt, POST.b);
    const p = lt / trd;
    post = tr === 'schwarz' ? { modus: 1, p: p < .5 ? 0 : 1, schwarz: 1 - Math.abs(p - .5) * 2 } : { modus: UEBERGANG[tr] ?? 1, p, fokus: [.5, .55] };
  } else r = szene(i, lt, POST.a);
  POST.fertig({ ...post, zeit: t, blitz: r.blitz, sat: r.sat });
  zeigeUI(i, lt, r, t);
  await new Promise(res => requestAnimationFrame(() => res()));
};
window.dauer = SK.dauer; window.bereit = true;
