// EINHEIT FALKE – Einsatz 02: Das Flugzeug (3D, nur POV, Morgennebel).
import {
  THREE, W, H, mat, box, cyl, sph, caps, at, bodenPlatte, clamp, lerp, easeOut, easeIn, easeInOut, easeBack, smooth,
  betonTex, holzTex, liveTex, weltPos, rng, radialTex, rauchTex, textTex, canvasTex as canvasTexEp, setzeToon,
} from '/tools/einsatz3d/kern.js';
import { Figur, gehPose, rennPose, hockPose, stehPose, schildModell, handschellenModell } from '/tools/einsatz3d/figur.js';
import { renderer, Post, UEBERGANG, Explosion, Schwaden, schild, hauptquartier, hqDetails } from '/tools/einsatz3d/welt.js';
import { Pov } from '/tools/einsatz3d/pov.js';
import { heliModell, heliUpdate, setzeSeil, Abwind, HELI_BODEN } from '/tools/einsatz3d/heli.js';
import { flughafen, flughafenUpdate, verkehrsflugzeug } from '/tools/einsatz3d/flughafen.js';
import { dachWelt, dachUpdate } from '/tools/einsatz3d/dach.js';

const TL = await (await fetch('./timeline_fertig.json')).json();
// Stil: Mix aus Comic (Toon-Shading, Konturen, Fischauge, große Augen) und 3D
setzeToon(true); Figur.augen = 1.45;
const R = renderer({ logDepth: true }); R.toneMappingExposure = 1.12;
const POST = new Post(R, { cartoon: true });
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SZ = n => TL.szenen.find(s => s.n === n);
const L = (n, anfang) => TL.dialog.find(z => z.szene === n && z.text.startsWith(anfang));
function zeile(n, lt) { let a = null; for (const z of TL.dialog) if (z.szene === n && lt >= z.start && lt < z.ende) a = z; return a; }
const redet = (n, lt, wer) => { const z = zeile(n, lt); return z && (z.wer === wer || z.wer === wer + 'v') ? 0.35 + 0.5 * Math.abs(Math.sin(lt * 17)) : 0; };
// Gespräche lesbar machen: wer redet, schaut den Angesprochenen an und nickt/gestikuliert; die anderen schauen zum Sprecher
function schaueAn(f, ziel, mix = 1) {
  if (mix <= 0 || !f.root.visible) return;
  const n = f.j.neck; n.updateMatrixWorld(true);
  const l = n.worldToLocal(ziel.clone());
  const yaw = clamp(Math.atan2(l.x, l.z), -1.25, 1.25), nick = clamp(-Math.atan2(l.y - .12, Math.hypot(l.x, l.z)), -.55, .55);
  const h = f.j.head; h.rotation.set(lerp(h.rotation.x, nick, mix), lerp(h.rotation.y, yaw, mix), h.rotation.z); h.updateMatrixWorld(true);
}
const nicken = (f, n, lt, wer) => { if (redet(n, lt, wer)) { f.j.head.rotation.x += .07 * Math.sin(lt * 6.5); f.j.head.updateMatrixWorld(true); } };
const fenster = (z, lt, vor = .3, nach = .25) => z ? smooth(z.start - vor, z.start + .1, lt) * (1 - smooth(z.ende - .1, z.ende + nach, lt)) : 0;
const spricht6 = (n, lt) => { const z = zeile(n, lt); return z && z.wer === '6' ? fenster(z, lt, .1, 0) : 0; };
const kopfW = f => weltPos(f.j.head).add(V3(0, .12, 0));
function handAmOhr(f, n = 'L') { const ohr = f.j.head.localToWorld(V3(n === 'L' ? .15 : -.15, .1, .02)); f.greife(n, ohr, f.lokal(n === 'L' ? .5 : -.5, 1.2, -.3)); }

function kamera(szene, fov = 74) { const k = new THREE.PerspectiveCamera(fov, W / H, 0.03, 1500); k.rotation.order = 'YXZ'; szene.add(k); return k; }
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
const wackel = (t, st) => V3((Math.sin(t * 5.3) + .5 * Math.sin(t * 11.7 + 1.3)) * st * .4, (Math.sin(t * 6.1 + .7) + .5 * Math.sin(t * 13.3)) * st * .4, 0);   // weich, kein Bild-zu-Bild-Ruckeln

const OPS = { 1: { headset: true, groesse: 1.86 }, 2: { groesse: 1.98, visier: true }, 4: { groesse: 1.72, visier: true }, 7: { groesse: 1.76, headset: true } };
const teamOps = (s, nr, maskeHoch = 0) => { const f = new Figur({ art: 'team', nummer: nr, maske: false, sturmhaube: true, maskeHoch, helm: true, ...OPS[nr] }); s.add(f.root); return f; };
const ZIVIL = {
  1: { haut: 0xe0ac69, haare: true, haarfarbe: 0x9a9a9a, bart: 0xa5a5a5, groesse: 1.86 }, 2: { haut: 0x7a4a2a, groesse: 1.98 },
  4: { haut: 0xf1c27d, haare: true, haarfarbe: 0x6f1d1b, dutt: true, groesse: 1.72, lippen: 0xc0505a }, 7: { haut: 0xffdbac, haare: true, haarfarbe: 0x5b3a29, brille: true, groesse: 1.76 },
};
const teamHq = (s, nr) => { const f = new Figur({ art: 'zivil', jacke: 0x2e3440, hose: 0x262a31, schuh: 0x16181b, rueckenNr: true, nummer: nr, ...ZIVIL[nr] }); s.add(f.root); return f; };
function sitz(f, x, z, yaw, hoehe, extra = {}) {
  f.pose({ beinL: [1.5, 1.55], beinR: [1.42, 1.5], rumpf: [.08, 0, 0], ...extra });
  f.platziere(x, z, yaw, { hoehe: hoehe - .98 * f.root.scale.x + .04 });
}
const SITZ_H = HELI_BODEN + .48;
// Sitzplätze im Hubschrauber (lokal): 6 hinten links an der Tür, 1+4 hinten rechts, 2+7 gegenüber (Blick zu uns)
const PLATZ = { 6: [-.72, 1.42, Math.PI], 4: [.24, 1.42, Math.PI], 1: [.72, 1.42, Math.PI], 2: [-.5, -.82, 0], 7: [.5, -.82, 0] };   // 4 direkt neben mir
function heliTeam(h, tm, n, lt, extra = {}, nur = [1, 2, 4, 7]) {
  for (const nr of nur) {
    const f = tm[nr]; if (!f.root.visible) continue;
    const [x, z, yaw] = PLATZ[nr];
    sitz(f, x, z, yaw, SITZ_H, { mund: redet(n, lt, String(nr)), kopf: [.1, Math.sin(lt * .7 + nr) * .15, 0], ...(extra[nr] ?? {}) });
    if (nr === 7) f.ohneGewehr(); else f.haltGewehr('sitz');
  }
}
const KNIEPOSE = { beinL: [.15, 2.35], beinR: [1.55, 1.65], rumpf: [.3, 0, 0], kopf: [-.1, 0, 0] };
const SITZPOSE = { beinL: [1.5, 1.55], beinR: [1.42, 1.5], rumpf: [.08, 0, 0] };
function mischen(a, b, k) {   // zwei Posen weich ineinander überblenden
  const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key], y = b[key];
    if (Array.isArray(x) || Array.isArray(y)) { const xa = x ?? [0, 0, 0], ya = y ?? [0, 0, 0]; o[key] = xa.map((v, i) => lerp(v ?? 0, ya[i] ?? 0, k)); }
    else if (typeof x === 'number' || typeof y === 'number') o[key] = lerp(x ?? 0, y ?? 0, k);
  } return o;
}
// Teammitglied (Kind des Helis, Heli steht noch): läuft hin, steigt über die Kufe ein, geht geduckt zum Platz, dreht sich und setzt sich
function steigtEin(h, f, nr, lt, lauf, tAn, tSitz) {
  const [sx, sz, syaw] = PLATZ[nr], vz = sz + (syaw === 0 ? .5 : -.5), B = HELI_BODEN;
  const aussen = V3(-1.75, 0, -.05), innen = V3(-.9, 0, -.05);
  if (lt < tAn) {
    const p = pfad(lauf, lt), l = h.g.worldToLocal(V3(p.x, 0, p.z));
    f.pose(rennPose(p.dist / .95 * Math.PI, { neig: .45 })); f.platziere(l.x, l.z, richtung(p.vx, p.vz, Math.PI) - h.g.rotation.y, { boden: 0 }); f.haltGewehr('tief'); return;
  }
  if (lt < tAn + .5) {
    const k = easeInOut((lt - tAn) / .5), q = aussen.clone().lerp(innen, k);
    f.pose(mischen({ ...hockPose(.3), beinL: [1.3, 1.5], beinR: [.2, .4], rumpf: [.6, 0, 0] }, { ...hockPose(.8), rumpf: [.65, 0, 0] }, k)); f.platziere(q.x, q.z, Math.PI / 2, { boden: B * smooth(0, .6, k) }); f.haltGewehr('tief'); return;
  }
  if (lt < tSitz) {
    const p = pfad([[tAn + .5, innen.x, innen.z], [tSitz, sx, vz]], lt);
    f.pose({ ...gehPose(p.dist / .5 * Math.PI, { hocke: .85, arme: false }), rumpf: [.65, 0, 0], kopf: [-.3, 0, 0] });   // tief geduckt unter dem Kabinendach f.platziere(p.x, p.z, richtung(p.vx, p.vz, Math.PI / 2), { boden: B }); f.haltGewehr('tief'); return;
  }
  const k = easeInOut((lt - tSitz) / .75);
  const yaw0 = richtung(sx - innen.x, vz - innen.z, Math.PI / 2);
  let dy = syaw - yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  f.pose(mischen({ ...hockPose(.8), rumpf: [.65, 0, 0] }, SITZPOSE, k)); f.platziere(lerp(sx, sx, k), lerp(vz, sz, k), yaw0 + dy * smooth(0, .6, k), { boden: B });
  const ySitz = SITZ_H - .98 * f.root.scale.x + .04; f.root.position.y = lerp(f.root.position.y, ySitz, k); f.root.updateMatrixWorld(true);
  f.haltGewehr(k < .7 ? 'tief' : 'sitz');
}
// Sitzplatz der Kamera (6) im Hubschrauber: Augenhöhe sitzend
const AUGE6 = V3(-.74, SITZ_H + .7, 1.05);

// ======================================================================= WELT 1: Hauptquartier (früh am Morgen)
const HQ = (() => {
  const s = new THREE.Scene(); const hq = hauptquartier(s); hqDetails(s);
  const k = kamera(s, 72); const pov = new Pov(k, { aermel: 0x2e3440, handschuhe: false });
  const t = { 1: teamHq(s, 1), 2: teamHq(s, 2), 4: teamHq(s, 4), 7: teamHq(s, 7) };
  const chefin = new Figur({ art: 'chefin', jacke: 0x5c636e, hose: 0x3a3f47, schuh: 0x111111, haare: true, haarfarbe: 0xe9ecef, dutt: true, brille: true, haut: 0xf1c9a5, groesse: 1.7 });
  s.add(chefin.root);
  const croissant = new THREE.Mesh(new THREE.TorusGeometry(.06, .035, 8, 14, Math.PI * 1.2), mat(0xd4a35a, { r: .8 })); s.add(croissant);
  const kollegen = [new Figur({ art: 'zivil', jacke: 0x495057, hose: 0x343a40, schuh: 0x111111, haare: true, haarfarbe: 0x3d2b1f, haut: 0xe0ac69, headset: true, groesse: 1.78 }),
    new Figur({ art: 'zivil', jacke: 0x6c757d, hose: 0x343a40, schuh: 0x111111, haare: true, dutt: true, haarfarbe: 0x14110f, haut: 0xc68642, brille: true, groesse: 1.68 })];
  kollegen.forEach(f => s.add(f.root));
  return { s, hq, k, pov, t, chefin, croissant, kollegen };
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
  const d = SZ('hq').d;
  zeichneHqSchirm(lt, t); zeichneNebelFenster(hq.fenster, t);
  const alarm = lt > d - 1.6;
  hq.alarm.intensity = alarm && Math.floor(t * 4) % 2 ? 60 : 0; hq.alarmLampe.material.emissiveIntensity = alarm ? 4 : 0; hq.alarm.target.position.set(Math.sin(t * 8) * 4, 0, -3); hq.helm6.visible = true;
  // Kamera: kurzer Schwenk übers Büro (Arbeitsplätze) zum großen Schirm, am Ende Aufstehen zum Alarm
  const schwenk = 1 - smooth(0, 1.6, lt), auf = smooth(d - 1.2, d - .2, lt);
  chefin.pose({ ...stehPose(t), kopf: [0, .3, 0], mund: redet('hq', lt, 'Z'), armL: [lt < 6.8 ? 1.3 + .15 * Math.sin(lt * 2) : .1, .5], ellL: .3 });
  chefin.platziere(-1.45, -5.2, .3);
  const z1 = L('hq', 'Dann');
  const stell = (nr, x, z, yaw, extra = {}) => { tm[nr].pose({ ...stehPose(t + nr), mund: redet('hq', lt, String(nr)), ...extra }); tm[nr].platziere(x, z, yaw); };
  stell(1, 1.05, -3.35, -2.6, { kopf: [0, lt > z1.start ? .5 : 0, 0], armR: [.9, .1], ellR: 1.7 });
  const beiss = (lt * .9) % 1 < .3 && !alarm;
  stell(2, -.55, -2.75, 2.7, { kopf: [beiss ? .2 : 0, alarm ? -.8 : 0, 0], mund: redet('hq', lt, '2') || (beiss ? .5 : 0), armR: [beiss ? 1.9 : 1.0, .1], ellR: beiss ? 2.3 : 1.6 });
  HQ.croissant.position.copy(weltPos(tm[2].j.haR)).add(V3(0, -.03, .05));
  HQ.kollegen.forEach((f, i) => { const x = [-3.9, -2.75][i];   // Kollegen an den Arbeitsplätzen tippen
    f.pose({ beinL: [1.5, 1.55], beinR: [1.42, 1.5], rumpf: [.15, 0, 0], kopf: [-.1 + .05 * Math.sin(t * .7 + i), .15 * Math.sin(t * .4 + i * 2), 0] });
    f.platziere(x, -4.55, Math.PI, { hoehe: .5 - .98 * f.root.scale.x + .04 });
    for (const [n, dx] of [['L', .1], ['R', -.1]]) f.greife(n, V3(x + dx + .02 * Math.sin(t * 11 + dx * 30), .8 + .01 * Math.abs(Math.sin(t * 13 + dx * 50)), -5.0), f.lokal(n === 'L' ? .5 : -.5, .8, -.2)); });
  stell(4, .25, -3.95, 3.0, { kopf: [0, alarm ? -.7 : 0, 0], armL: [.9, -.2, .4], ellL: 1.9, armR: [.9, -.2, .4], ellR: 1.9 });
  stell(7, -1.35, -3.45, 2.4, { kopf: [.3, 0, 0], armL: [.8, .1], ellL: 1.6, armR: [.8, .1], ellR: 1.6 });
  const zZ = L('hq', 'Flug'), kZ = kopfW(chefin), k1 = kopfW(tm[1]);
  if (!alarm) {
    for (const nr of [2, 4, 7]) schaueAn(tm[nr], lt < z1.start - .3 ? kZ : k1, .85);
    schaueAn(tm[1], kZ, 1); nicken(tm[1], 'hq', lt, '1');
    schaueAn(chefin, lt < z1.start - .2 ? (Math.floor(lt / 2.2) % 2 ? k1 : V3(.25, 1.68, .55)) : k1, .9); nicken(chefin, 'hq', lt, 'Z');
  }
  const zu1 = fenster(z1, lt, .4, .3) * (alarm ? 0 : 1);
  schau(k, V3(.25 + .02 * Math.sin(t * .6) + .3 * auf, 1.68 + .12 * auf, .55 - .5 * auf), V3(-.15 - 3.4 * schwenk, 1.45 - .3 * schwenk, -5.9).lerp(k1.clone().add(V3(0, -.1, 0)), .6 * zu1));
  pov.setze({ modus: 'tasse', t, zielL: k.localToWorld(V3(-.3, -.5, -.35)) });
  return { welt: HQ, uhr: '05:12', rot: alarm ? .35 * (Math.floor(t * 4) % 2) : 0 };
}

// ======================================================================= WELT 2: Dach mit Landeplatz – Sprint, Einsteigen, Start
const DACH = (() => {
  const s = new THREE.Scene(); const d = dachWelt(s);
  const h = heliModell(); s.add(h.g); h.g.rotation.order = 'YXZ';
  const k = kamera(s, 76); const pov = new Pov(k);
  const laeufer = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  const sitzer = {}; for (const nr of [1, 2, 4, 7]) { sitzer[nr] = teamOps(s, nr); s.remove(sitzer[nr].root); h.g.add(sitzer[nr].root); }
  const wind = new Abwind(s, 80, { farbe: 0xc9c2b4 });
  const einweiser = new Figur({ art: 'zivil', jacke: 0x343a40, hose: 0x343a40, schuh: 0x111111, warnweste: true, kappe: 0x212529, headset: true, haut: 0xd9a77a, groesse: 1.8 }); s.add(einweiser.root);
  const kellen = []; for (const n of ['L', 'R']) { const k2 = cyl(.025, .025, .45, mat(0xff6b00, { e: 0xff4500, ei: 2 }), 8); einweiser.j['ha' + n].add(at(k2, 0, -.2, 0)); kellen.push(k2); }
  const crew = new Figur({ art: 'zivil', jacke: 0x4b5320, hose: 0x4b5320, schuh: 0x111111, helm: true, visier: true, headset: true, handschuhe: true, haut: 0xc68642, groesse: 1.82 }); s.add(crew.root);
  return { s, d, h, k, pov, laeufer, sitzer, wind, einweiser, crew };
})();
const HELI_DACH = V3(0, 0, -8);
function s_dach(lt, t) {
  const { d, h, k, pov, laeufer, sitzer, wind } = DACH;
  dachUpdate(d, t);
  // Abheben
  const TO = 6.9;   // Abheben erst, wenn alle sitzen
  const ab = smooth(TO, SZ('dach').d + .6, lt);
  const hoch = 22 * easeIn(clamp((lt - TO) / 4.6)) * 1.0 + .35 * smooth(TO - .2, TO + .4, lt);
  h.g.position.set(HELI_DACH.x - 14 * easeIn(clamp((lt - TO - 1.5) / 3.5)), HELI_DACH.y + hoch, HELI_DACH.z);
  h.g.rotation.set(-.16 * smooth(TO + .7, TO + 2.6, lt) + .015 * Math.sin(t * 3) * ab, Math.PI / 2 + .25 * smooth(TO + 1.6, TO + 4.6, lt), .05 * Math.sin(t * 1.3) * ab);
  h.g.updateMatrixWorld(true);
  heliUpdate(h, t, { rpm: .85 + .15 * smooth(4.5, 6, lt) });
  wind.update(t, clamp(1 - hoch / 14), HELI_DACH, 0, k);
  d.sonne.target.position.set(0, 0, -5);
  // Tür des Treppenhauses fliegt auf
  d.tuer.rotation.y = -1.9 * easeOut(clamp((lt - .15) / .35));
  // Team läuft zur Tür, steigt ein und setzt sich animiert (eine Figur pro Person, keine Sprünge)
  const tuer = h.g.localToWorld(V3(-1.45, 0, -.05));
  for (const nr of [1, 2, 4, 7]) laeufer[nr].root.visible = false;
  const lauf = { 2: [[0, -2.1, 6.2], [2.0, tuer.x - .1, tuer.z + .35]], 4: [[.15, -2.6, 6.9], [2.45, tuer.x + .45, tuer.z + .45]], 7: [[.35, -1.6, 7.4], [2.9, tuer.x + .85, tuer.z + .55]] };
  const tSitz = { 2: 3.2, 4: 3.65, 7: 4.1 };
  for (const nr of [2, 4, 7]) { sitzer[nr].root.visible = true; if (lt < tSitz[nr] + .8) steigtEin(h, sitzer[nr], nr, lt, lauf[nr], lauf[nr][1][0], tSitz[nr]); }
  // 1 steht an der Tür, winkt alle rein, steigt als Letzter ein
  { const f = sitzer[1]; f.root.visible = true;
    const da = h.g.worldToLocal(V3(tuer.x + 1.5, 0, tuer.z + .7));
    if (lt < 5.5) { const wink = lt > .8 && lt < 3.8;
      f.pose({ ...hockPose(.25), armL: wink ? [2.2 + .7 * Math.sin(t * 9), .4] : [.6, .2], ellL: wink ? .9 : 1.2, mund: redet('dach', lt, '1'), rumpf: [.25, 0, 0] });
      f.platziere(da.x, da.z, -h.g.rotation.y, { boden: 0 }); f.haltGewehr('tief'); }
    else if (lt < 6.8) steigtEin(h, f, 1, lt, [[5.0, tuer.x + 1.5, tuer.z + .7], [5.5, tuer.x + .1, tuer.z + .3]], 5.5, 6.25); }
  heliTeam(h, sitzer, 'dach', lt, {}, [1, 2, 4, 7].filter(nr => lt >= (nr === 1 ? 7.0 : tSitz[nr] + .8)));
  { const z2 = L('dach', 'Gibt'), z4 = L('dach', 'Nein'), auge = h.g.localToWorld(AUGE6.clone()), k2 = kopfW(sitzer[2]);
    schaueAn(sitzer[2], lt < z4.start ? auge : kopfW(sitzer[4]), fenster(z2, lt) + fenster(z4, lt)); nicken(sitzer[2], 'dach', lt, '2');
    schaueAn(sitzer[4], k2, Math.max(fenster(z2, lt, 0, 0) * .6, fenster(z4, lt))); nicken(sitzer[4], 'dach', lt, '4');
    for (const nr of [1, 7]) schaueAn(sitzer[nr], k2, fenster(z2, lt) * .8); }
  // Einweiser am Rand des Landeplatzes (Leuchtkellen), Crew-Chief an der Tür winkt rein
  { const e = DACH.einweiser, abh = lt > TO - .3;
    const sw = Math.sin(t * 5);
    e.pose(abh ? { armL: [3.0, .2 + .2 * sw], armR: [3.0, .2 - .2 * sw], ellL: .2, ellR: .2 } : { armL: [1.6, 1.2 + .3 * sw], armR: [1.6, 1.2 - .3 * sw], ellL: .4, ellR: .4 });
    e.platziere(6.5, -3.0, -2.2); schaueAn(e, h.g.localToWorld(V3(0, 1.5, 0)), 1); }   // bleibt stehen und schaut dem Heli nach
  { const c = DACH.crew; c.root.visible = true;   // Crew-Chief bleibt am Boden: winkt rein, tritt zurück, schaut dem Heli nach
    const weg = smooth(5.9, 6.8, lt), cp = V3(tuer.x - 1.3 - 1.6 * weg, 0, tuer.z + .55 + 2.0 * weg);
    c.pose(weg > 0 && weg < 1 ? gehPose(weg * 6, { hocke: .2 }) : { ...hockPose(.15), armR: lt < 6 ? [1.4 + .5 * Math.sin(t * 6), .3] : [2.9, .3], ellR: lt < 6 ? 1.0 : .3, armL: [.9, .2], ellL: 1.4 });
    c.platziere(cp.x, cp.z, .6 + 1.6 * weg); schaueAn(c, h.g.localToWorld(V3(0, 1.5, 0)), 1); }
  // Kamera: aus dem Treppenhaus sprinten, auf die Kufe, rein, hinsetzen
  let pos, ziel;
  const sitzW = h.g.localToWorld(AUGE6.clone());
  if (lt < 3.9) {
    const p = pfad([[0, -2.0, 8.2], [.45, -2.0, 7.3], [3.9, tuer.x + .3, tuer.z + 1.25]], lt);
    const lauf = clamp(p.s / 3);
    pos = V3(p.x, 1.62 + Math.abs(Math.sin(p.dist / .85 * Math.PI)) * .06 * lauf - .12 * lauf, p.z).add(wackel(t, .012 * lauf));
    ziel = V3(tuer.x + .3, 1.3, tuer.z - 3);
  } else if (lt < 5.6) {
    // Einsteigen Schritt für Schritt: Fuß auf die Trittstufe → geduckt rein → umdrehen → hinsetzen
    const A = h.g.worldToLocal(V3(tuer.x + .3, 1.5, tuer.z + 1.25)), S = V3(-1.45, 2.02, .2), I = V3(-.5, HELI_BODEN + 1.2, .55), Z = AUGE6.clone();
    const k1 = easeInOut((lt - 3.9) / .45), k2 = easeInOut((lt - 4.35) / .5), k3 = easeInOut((lt - 4.85) / .7);
    const lp = lt < 4.35 ? A.clone().lerp(S, k1) : lt < 4.85 ? S.clone().lerp(I, k2) : I.clone().lerp(Z, k3);
    lp.y += lt < 4.35 ? Math.sin(k1 * Math.PI) * .08 : 0;
    pos = h.g.localToWorld(lp);
    const zA = V3(-.3, 1.3, -.2), zB = V3(.4, 1.1, 1.45), zC = V3(0, 1.45, -2.6), zD = V3(-3, .6, -2.2);
    const zl = zA.clone().lerp(zB, smooth(4.25, 4.8, lt)).lerp(zC, smooth(4.85, 5.3, lt)).lerp(zD, smooth(5.25, 5.6, lt));
    ziel = h.g.localToWorld(zl);
  } else {
    // sitzend: Blick nach vorne-links aus der offenen Tür, zwischendurch zu 2 und 4 (weich)
    const z2 = L('dach', 'Gibt'), z4 = L('dach', 'Nein');
    const zu2 = smooth(z2.start - .3, z2.start + .2, lt) * (1 - smooth(z4.start - .7, z4.start - .2, lt));
    const zu4 = smooth(z4.start - .7, z4.start - .2, lt);   // rechtzeitig zu 4 drehen
    let zl = V3(-3, .6 - .35 * ab, -2.2);
    zl.lerp(h.g.worldToLocal(kopfW(sitzer[2])), zu2).lerp(h.g.worldToLocal(kopfW(sitzer[4])), zu4);   // Blick genau in die Gesichter (nicht auf den Boden)
    pos = sitzW.clone(); ziel = h.g.localToWorld(zl);   // sitzend: kein Wackeln (die Decke wackelte sonst im Bild)
  }
  schau(k, pos, ziel, lt > 5.6 ? h.g.rotation.z * .6 : 0);
  pov.setze({ modus: 'gewehr', t, lauf: lt < 3.9 ? 1 : lt < 5.6 ? .4 : .15, zielen: -.3, senken: lt > 3.9 ? .4 : 0 });
  return { welt: DACH, uhr: '05:16' };
}

// ======================================================================= WELT 3: Flug (Innenraum, Tür offen, Landschaft unten)
const FLUG = (() => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0xb9c3d0); s.fog = new THREE.Fog(0xb9c3d0, 220, 950);   // Kachel-Ränder verschwinden im Dunst
  s.add(new THREE.HemisphereLight(0xe8eefc, 0x40444c, 1.3));
  const sonne = new THREE.DirectionalLight(0xffd2a6, 2.0); sonne.position.set(-6, 3, 1); s.add(sonne); s.add(sonne.target);
  const h = heliModell(); s.add(h.g); h.g.rotation.order = 'YXZ';
  const feld = liveTex(1024, 1024); { const g = feld.ctx, r = rng(3);
    for (let i = 0; i < 64; i++) { g.fillStyle = ['#7d8a6a', '#8f9c78', '#a09a7a', '#6e7c5e', '#9aa58a', '#b0a882'][(i * 7) % 6]; g.fillRect((i % 8) * 128, Math.floor(i / 8) * 128, 128, 128); }
    g.fillStyle = '#4a4f57'; g.fillRect(500, 0, 30, 1024); g.fillRect(0, 300, 1024, 20); feld.tex.needsUpdate = true; }   // ruhige Felder ohne Kleinkram (flimmert sonst)
  feld.tex.wrapS = feld.tex.wrapT = THREE.RepeatWrapping; feld.tex.repeat.set(8, 8);
  // Landschaft unten in 3D (Kacheln à 400 m, Häuser, Bäume, Straßen) – zieht unter uns durch, verschwindet nie
  feld.tex.repeat.set(1, 1);
  const land = new THREE.Group(); land.position.y = -140; s.add(land);
  const hausGeo = new THREE.BoxGeometry(1, 1, 1), baumGeo = new THREE.ConeGeometry(1, 1, 7);
  const r3 = rng(31), KACHEL = 400;
  for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) {
    const k0 = new THREE.Group(); k0.position.set(ix * KACHEL, 0, iz * KACHEL); land.add(k0);
    k0.add(at(new THREE.Mesh(new THREE.PlaneGeometry(KACHEL, KACHEL), new THREE.MeshStandardMaterial({ map: feld.tex, roughness: 1 })), 0, 0, 0, -Math.PI / 2));
    const haeuser = new THREE.InstancedMesh(hausGeo, mat(0xd6cfc2, { r: .8 }), 60), daecher = new THREE.InstancedMesh(hausGeo, mat(0x8c3b2e, { r: .8 }), 60);
    const baeume = new THREE.InstancedMesh(baumGeo, mat(0x3d5a2e, { r: 1 }), 220);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const dorfX = (r3() - .5) * 250, dorfZ = (r3() - .5) * 250;
    for (let i = 0; i < 60; i++) { const w = 8 + r3() * 8, h = 6 + r3() * 5; ps.set(dorfX + (r3() - .5) * 90, h / 2, dorfZ + (r3() - .5) * 90); q.setFromAxisAngle(V3(0, 1, 0), Math.floor(r3() * 4) * Math.PI / 2 + .2);
      haeuser.setMatrixAt(i, m4.compose(ps, q, sc.set(w, h, w * .7))); daecher.setMatrixAt(i, m4.compose(ps.clone().setY(h + 1), q, sc.set(w * 1.05, 2, w * .75))); }
    for (let i = 0; i < 220; i++) { const h = 8 + r3() * 8; const wald = i < 150; ps.set(wald ? (r3() - .5) * 120 + 120 * Math.sign(ix + .5) : (r3() - .5) * KACHEL, h / 2, wald ? (r3() - .5) * 120 - 100 : (r3() - .5) * KACHEL); baeume.setMatrixAt(i, m4.compose(ps, q.identity(), sc.set(3 + r3() * 2, h, 3 + r3() * 2))); }
    k0.add(haeuser, daecher, baeume);
  }
  const boden = land;
  const glut = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('sonne', [[0, 'rgba(255,240,200,1)'], [.3, 'rgba(255,190,120,.6)'], [1, 'rgba(255,170,100,0)']]), fog: false, depthWrite: false }));
  glut.position.set(-420, 30, 60); glut.scale.set(200, 200, 1); s.add(glut);
  // Wolkenfetzen, die vorbeiziehen
  const wolken = []; const rt = rauchTex(); const r = rng(11);
  for (let i = 0; i < 14; i++) { const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, color: 0xf1f3f5, transparent: true, opacity: .55, depthWrite: false })); w.userData = { x: -40 - r() * 60, y: -30 + r() * 40, z: r() * 400, s: 30 + r() * 40 }; s.add(w); wolken.push(w); }
  const k = kamera(s, 76); const pov = new Pov(k);
  const t = {}; for (const nr of [1, 2, 4, 7]) { t[nr] = teamOps(s, nr); s.remove(t[nr].root); h.g.add(t[nr].root); }
  const voegel = new THREE.Group(); for (let i = 0; i < 14; i++) { const v = new THREE.Group(); for (const sx of [-1, 1]) v.add(at(box(.6, .03, .18, mat(0x2b2d31)), sx * .3, 0, 0, 0, 0, sx * .35)); v.userData = { dx: (i % 5) * 2.2 - 4, dz: Math.floor(i / 5) * 2.4, ph: i }; voegel.add(v); } s.add(voegel);
  return { s, h, k, pov, t, feld, sonne, wolken, land, KACHEL, voegel };
})();
function s_flug(lt, t) {
  const { h, k, pov, t: tm, sonne } = FLUG;
  FLUG.land.position.x = ((t * 48) % FLUG.KACHEL);   // wir fliegen nach −x (Nase), der Boden zieht nach +x
  FLUG.voegel.position.set(-30 + lt * 9, -6 + Math.sin(lt * .5) * 2, -26); FLUG.voegel.children.forEach(v => { const u = v.userData; v.position.set(u.dx + Math.abs(u.dx) * .3, Math.sin(lt * 3 + u.ph) * .3, u.dz + Math.abs(u.dx) * .5); v.children.forEach((f, j) => { f.rotation.z = (j ? 1 : -1) * (.35 + .5 * Math.sin(lt * 9 + u.ph)); }); });
  for (const w of FLUG.wolken) { const u = w.userData; w.position.set(u.x, u.y, ((u.z - t * 60) % 400 + 400) % 400 - 200); w.scale.set(u.s, u.s * .5, 1); }
  h.g.position.set(0, 0, 0); h.g.rotation.set(-.08 + .02 * Math.sin(t * 1.7), Math.PI / 2, -.03 * Math.sin(t * .9));
  h.g.updateMatrixWorld(true);
  heliUpdate(h, t);
  sonne.intensity = 1.8;
  const z6 = L('flug', 'Sieben'), z7b = L('flug', 'Dich');
  heliTeam(h, tm, 'flug', lt, { 7: { armL: [2.9, .1], ellL: .3, armR: [.4, .1], ellR: 1.2 } });
  const auge = h.g.localToWorld(AUGE6.clone()), k7 = kopfW(tm[7]);
  schaueAn(tm[7], lt < z6.start - .1 ? h.g.localToWorld(V3(-3, .6, -1)) : auge, 1); nicken(tm[7], 'flug', lt, '7');
  if (lt > z7b.start && lt < z7b.ende + .2) tm[7].greife('R', auge.clone().lerp(weltPos(tm[7].j.chest), .55), tm[7].lokal(-.6, .6, .4));   // zeigt auf mich
  schaueAn(tm[2], fenster(z6, lt) + fenster(z7b, lt) > 0 ? auge : k7, .8);
  schaueAn(tm[1], k7, .5); schaueAn(tm[4], k7, .6);
  // Kamera sitzt an der Tür und schaut 7 an (gegenüber) – ruhig, immer auf Augenhöhe
  schau(k, auge.clone(), k7.clone().add(V3(0, -.05, 0)), h.g.rotation.z * .7);
  pov.setze({ modus: 'gewehr', t, senken: .4, zielen: -.25 });
  return { welt: FLUG, uhr: '05:24', kontur: .6 };
}

// Zusätzliche Jet-Details außen + innen
function jetDetails(jet) {
  const j = jet.j, Y = 2.45, R0 = 1.15;
  const holz = mat(0x6f4e37, { r: .4, map: holzTex([1, 1]) }), leder = mat(0xd9c7a5, { r: .55 }), chrom = mat(0xced4da, { m: .9, r: .2 });
  // außen: Antikollisionslichter, Navigationslichter, Antennen, Türkontur, APU
  jet.beacon = [mat(0xff2030, { e: 0xff2030, ei: 3, noCache: true }), mat(0xff2030, { e: 0xff2030, ei: 3, noCache: true })];
  j.add(at(sph(.08, jet.beacon[0], 8, 6), 0, Y + R0 + .03, -7)); j.add(at(sph(.08, jet.beacon[1], 8, 6), 0, Y - R0 - .03, -7));
  j.add(at(sph(.07, mat(0xff2030, { e: 0xff2030, ei: 4 }), 6, 4), -7.0, 1.75, -10.6)); j.add(at(sph(.07, mat(0x30ff60, { e: 0x30ff60, ei: 4 }), 6, 4), 7.0, 1.75, -10.6));
  for (const z of [-5, -9]) j.add(at(box(.04, .35, .25, mat(0xdee2e6)), 0, Y + R0 + .15, z, -.4));
  j.add(at(cyl(.012, .012, .3, chrom, 6), .45, Y - .2, -1.5, Math.PI / 2));
  j.add(at(cyl(.18, .14, .3, mat(0x343a40), 12), 0, Y + .2, -17.3, Math.PI / 2));
  for (const sx of [1, -1]) for (let k = 0; k < 4; k++) j.add(at(box(.6, .05, .5, mat(0xdee2e6, { r: .4 })), sx * (2 + k * 1.1), 1.62, -9.4 - k * .38));     // Klappen
  j.add(at(box(.02, 1.75, .02, mat(0x8d99ae)), R0 + .012, 2.35, -2.6)); j.add(at(box(.02, 1.75, .02, mat(0x8d99ae)), R0 + .012, 2.35, -3.5));
  // Cockpit-Seitenfenster
  for (const sx of [1, -1]) j.add(at(box(.03, .28, .5, mat(0x15171c, { r: .1, m: .5 })), sx * (R0 - .05), Y + .45, -1.4, 0, 0, sx * -.4));
  // innen: Teppich-Läufer, Holzleisten, Wandlampen, Galley, Sofa, Bar, Fensterblenden
  j.add(at(box(.6, .012, 9.5, mat(0x3c2f5c, { r: 1 })), 0, 1.51, -8.2));
  for (const sx of [1, -1]) {
    j.add(at(box(.12, .06, 9, holz), sx * .98, 2.05, -8.2));
    for (let z = -4.3; z > -11.5; z -= .95) { j.add(at(box(.03, .1, .26, mat(0xe9dcc3)), sx * (R0 - .09), Y + .44, z)); j.add(at(sph(.04, mat(0xfff1d6, { e: 0xffe2b0, ei: 2 }), 8, 6), sx * (R0 - .14), Y + .7, z - .45)); }
  }
  j.add(at(box(.5, 1.0, .7, holz), .7, 2.0, -3.85)); j.add(at(box(.5, .04, .7, mat(0x212529, { r: .2 })), .7, 2.52, -3.85));
  for (let k = 0; k < 4; k++) j.add(at(cyl(.03, .03, .22, mat([0x2d6a4f, 0x9d0208, 0xf1faee, 0x6a4c93][k], { r: .1, transparent: true, opacity: .8 }), 8), .55 + k * .1, 2.65, -3.75));
  j.add(at(box(1.5, .4, .6, leder), 0, 1.75, -12.0)); j.add(at(box(1.5, .6, .15, leder), 0, 2.15, -12.3));
  for (const sx of [-.55, .55]) j.add(at(box(.36, .2, .3, mat(0x9c8662)), sx, 2.05, -11.95));
  for (const [x, z] of [[.55, -6.55], [-.55, -9.6], [.55, -9.6]]) { j.add(at(cyl(.03, .05, .7, chrom, 8), x, 1.85, z)); j.add(at(cyl(.06, .08, .12, mat(0xfff1d6, { e: 0xffe2b0, ei: 1 }), 10), x + (x > 0 ? .15 : -.15), 2.32, z)); }
  j.add(at(box(.04, .9, 1.4, mat(0xd8cbb5)), -.95, 2.2, -12.9));
  // Decke: indirekte Lichtbänder, Leselampen, Luftdüsen
  for (const sx of [1, -1]) j.add(at(box(.05, .02, 9.4, mat(0xfff1d6, { e: 0xffe2b0, ei: 2.2 })), sx * .55, 3.42, -8.2));
  for (let z = -4.3; z > -11.5; z -= 1.45) for (const sx of [-.5, .5]) { j.add(at(cyl(.035, .035, .02, mat(0xfff6e0, { e: 0xfff1d6, ei: 1.5 }), 10), sx, 3.38, z)); j.add(at(cyl(.02, .025, .03, chrom, 8), sx * .8, 3.33, z + .2)); }
  // Fensterrahmen
  for (const sx of [1, -1]) for (let z = -4.3; z > -11.5; z -= .95) { const r = new THREE.Mesh(new THREE.TorusGeometry(.17, .025, 6, 18), mat(0xcbbd9f, { r: .6 })); r.scale.set(.8, 1.15, 1); r.position.set(sx * (R0 - .08), Y + .25, z); r.rotation.y = Math.PI / 2; j.add(r); }
  // Trennwand hinten mit Bildschirm
  { const sh = new THREE.Shape(); sh.absarc(0, 0, 1.08, 0, Math.PI * 2); const w = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), mat(0xd8cbb5, { r: .7, side: THREE.DoubleSide })); w.position.set(0, Y, -11.3); j.add(w); }   // runde Trennwand = passt genau in den Rumpf
  j.add(at(box(.7, .42, .03, mat(0x0b0b0d, { e: 0x1d3557, ei: .6 })), 0, 2.55, -11.26));
  j.add(at(box(.5, 1.2, .04, holz), -.5, 2.35, -11.27)); j.add(at(box(.5, 1.2, .04, holz), .5, 2.35, -11.27));
  // Tische: Gläser, Magazin, Laptop
  for (const [x, z] of [[.55, -6.55], [.55, -9.6]]) { for (const dx of [-.1, .1]) { j.add(at(cyl(.025, .02, .1, mat(0xe9f5ff, { r: .05, transparent: true, opacity: .45 }), 10), x + dx, 2.3, z)); j.add(at(cyl(.022, .022, .04, mat(0xf2c14e, { transparent: true, opacity: .7 }), 10), x + dx, 2.27, z)); } }
  j.add(at(box(.22, .01, .3, mat(0xc1121f)), .45, 2.255, -6.45, 0, .3, 0));
  { const lp = new THREE.Group(); lp.add(at(box(.32, .015, .22, mat(0x9aa0a6, { m: .6 })), 0, 0, 0)); lp.add(at(box(.32, .2, .01, mat(0x111111, { e: 0x2a6f97, ei: .4 })), 0, .1, -.11, -.2)); lp.position.set(-.55, 2.26, -9.6); j.add(lp); }
  // Stufe + Haltegriff am Einstieg
  j.add(at(cyl(.015, .015, .6, chrom, 8), R0 - .1, 2.4, -2.62)); j.add(at(cyl(.015, .015, .6, chrom, 8), R0 - .1, 2.4, -3.48));
  // ---- Luxus-Ausstattung: Lederpaneele, Goldleisten, Teppich mit Muster, Vorhang zum Cockpit, Blumen, Kaffeemaschine, Kassettendecke
  const gold = mat(0xc9a227, { m: .9, r: .25 }), creme = mat(0xefe4cf, { r: .6 });
  const teppich = canvasTexEp('jetTeppich', 256, 256, (g, w, h) => { g.fillStyle = '#3a2f4f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8c7a4b'; g.lineWidth = 3;
    for (let x = -w; x < w * 2; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); g.beginPath(); g.moveTo(x + h, 0); g.lineTo(x, h); g.stroke(); } }, [3, 30]);
  j.add(at(box(.62, .006, 9.5, mat(0xffffff, { map: teppich, r: 1 })), 0, 1.517, -8.2));
  for (const sx of [1, -1]) {
    j.add(at(box(.03, .42, 9.2, creme), sx * .88, 1.8, -8.2));                                  // Lederpaneel unten
    for (let z = -4; z > -12.4; z -= .46) j.add(at(box(.032, .4, .006, mat(0xd9c9a8)), sx * .99, 1.78, z));   // Steppnähte
    j.add(at(box(.035, .015, 9.2, gold), sx * .985, 2.0, -8.2)); j.add(at(box(.035, .015, 9.2, gold), sx * .985, 2.11, -8.2));   // Goldleisten
    j.add(at(box(.02, .03, 9.2, mat(0xfff1d6, { e: 0xffd9a0, ei: 2.5 })), sx * .58, 1.53, -8.2));   // Bodenlicht
  }
  for (let z = -4; z > -11; z -= .9) j.add(at(box(.9, .03, .8, mat(0xf6efe2, { r: .5 })), 0, 3.47, z - .45));   // Deckenkassetten
  for (const sx of [-.45, .45]) { const v = box(.12, 1.5, .06, mat(0x6b2737, { r: .9 })); v.position.set(sx + (sx > 0 ? .1 : -.1), 2.3, -2.5); j.add(v); j.add(at(box(.14, .03, .08, gold), sx + (sx > 0 ? .1 : -.1), 2.4, -2.5)); }   // Vorhang (gerafft)
  j.add(at(cyl(.05, .04, .16, mat(0xe9f5ff, { transparent: true, opacity: .5, r: .05 }), 12), .55, 2.62, -3.6));
  for (let k = 0; k < 5; k++) j.add(at(sph(.035, mat([0xffffff, 0xf4a3b5, 0xffffff, 0xe85d75, 0xfff1d6][k], { r: .8 }), 8, 6), .55 + Math.cos(k * 1.3) * .04, 2.74 + (k % 2) * .03, -3.6 + Math.sin(k * 1.3) * .04));   // Blumen
  j.add(at(box(.18, .26, .2, mat(0x1d1f22, { m: .6, r: .3 })), .85, 2.66, -4.05)); j.add(at(box(.04, .03, .05, mat(0xff4d4d, { e: 0xff4d4d, ei: 2 })), .78, 2.74, -3.95));   // Kaffeemaschine
  j.add(at(box(.5, .6, .02, mat(0x9fb2c8, { m: .9, r: .05 })), .95, 2.75, -4.4, 0, -Math.PI / 2, 0));   // Spiegel
  // ---- Cockpit: Glas-Cockpit mit 4 Displays, Autopilot-Panel, Overhead-Schalter, Schubhebel, Lammfellsitze, Headsets
  const pfd = canvasTexEp('jetPFD', 256, 256, (g, w, h) => { g.fillStyle = '#2f6fb0'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#7a5230'; g.fillRect(0, h / 2, w, h / 2); g.strokeStyle = '#fff'; g.lineWidth = 3;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(w / 2 - 30, h / 2 + k * 22); g.lineTo(w / 2 + 30, h / 2 + k * 22); g.stroke(); } g.fillStyle = '#111'; g.fillRect(0, 0, 40, h); g.fillRect(w - 40, 0, 40, h);
    g.fillStyle = '#80ed99'; g.font = 'bold 18px DejaVu Sans'; g.fillText('140', 4, h / 2); g.fillText('0', w - 30, h / 2); g.strokeStyle = '#ffd166'; g.beginPath(); g.moveTo(w / 2 - 50, h / 2); g.lineTo(w / 2 + 50, h / 2); g.stroke(); });
  const nd = canvasTexEp('jetND', 256, 256, (g, w, h) => { g.fillStyle = '#05080c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#80ed99'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h * .85, 110, Math.PI, 2 * Math.PI); g.stroke();
    g.strokeStyle = '#ff4dff'; g.beginPath(); g.moveTo(w / 2, h * .85); g.lineTo(w / 2 + 30, 40); g.stroke(); g.fillStyle = '#4cc9f0'; g.font = 'bold 16px DejaVu Sans'; g.fillText('RWY 27', 140, 60); });
  const bildschirm = (tex, x, y, z, ry = 0) => { j.add(at(box(.24, .2, .02, mat(0x0b0b0d)), x, y, z - .01, -.35, ry)); j.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.21, .17), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .9 })), x, y, z + .002, -.35, ry)); };
  bildschirm(pfd, -.45, 2.27, -.78); bildschirm(nd, -.18, 2.27, -.78); bildschirm(nd, .18, 2.27, -.78); bildschirm(pfd, .45, 2.27, -.78);
  j.add(at(box(1.1, .07, .16, mat(0x1b1d21)), 0, 2.48, -.85, .2)); for (let k = 0; k < 12; k++) j.add(at(box(.035, .02, .02, mat(0x000000, { e: [0x80ed99, 0xffd166][k % 2], ei: 2 })), -.5 + k * .09, 2.5, -.79));   // Autopilot-Panel
  const ov = canvasTexEp('jetOverhead', 256, 128, (g, w, h) => { g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h); for (let y = 10; y < h; y += 22) for (let x = 10; x < w; x += 20) { g.fillStyle = '#d0d0d0'; g.fillRect(x, y, 6, 10); if ((x + y) % 3 === 0) { g.fillStyle = '#ffd166'; g.fillRect(x + 8, y, 6, 4); } } });
  j.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.85, .45), new THREE.MeshStandardMaterial({ map: ov, emissive: 0xffffff, emissiveMap: ov, emissiveIntensity: .25 })), 0, 3.21, -.9, Math.PI / 2 + .3));
  j.add(at(box(.3, .12, .55, mat(0x1b1d21)), 0, 1.98, -1.05)); for (const x of [-.06, .06]) { j.add(at(cyl(.012, .012, .18, chrom, 6), x, 2.1, -1.05, -.4)); j.add(at(box(.05, .03, .03, mat(0x111111)), x, 2.18, -1.0)); }   // Schubhebel
  for (const x of [-.4, .4]) { j.add(at(box(.46, .1, .46, mat(0xf1ece2, { r: 1 })), x, 1.98, -1.45)); j.add(at(box(.46, .6, .06, mat(0xf1ece2, { r: 1 })), x, 2.3, -1.68));   // Lammfell
    j.add(at(new THREE.Mesh(new THREE.TorusGeometry(.08, .012, 6, 14, Math.PI), mat(0x111111)), x + (x > 0 ? .3 : -.3), 2.55, -1.3)); }   // Headsets am Haken
  j.add(at(box(.18, .24, .02, mat(0x1d3557)), .42, 2.0, -.75, -.5));   // Checklisten-Mappe

  // Notausgang-Schild, Toilettentür hinten, Moving-Map-Bildschirm, Getränkehalter, Steckdosen
  j.add(at(box(.3, .1, .02, mat(0x0b3d1f, { e: 0x2bd96b, ei: 1.5 })), 0, 3.2, -11.25));
  { const karte = canvasTexEp('movingMap', 256, 160, (g, w, h) => { g.fillStyle = '#0d2238'; g.fillRect(0, 0, w, h); g.fillStyle = '#2c5a3a'; g.beginPath(); g.ellipse(120, 90, 90, 50, .3, 0, 7); g.fill(); g.strokeStyle = '#ffd166'; g.setLineDash([6, 4]); g.lineWidth = 3; g.beginPath(); g.moveTo(40, 120); g.quadraticCurveTo(130, 30, 220, 60); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#fff'; g.font = 'bold 14px DejaVu Sans'; g.fillText('FX-77 · 0 km/h', 10, 20); });
    j.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.42, .26), new THREE.MeshStandardMaterial({ map: karte, emissive: 0xffffff, emissiveMap: karte, emissiveIntensity: .8 })), 0, 2.55, -11.235)); }
  for (const sx of [1, -1]) for (let z = -4.3; z > -11; z -= 1.45) { j.add(at(cyl(.035, .03, .03, chrom, 10), sx * .72, 2.04, z + .3)); j.add(at(box(.04, .025, .012, mat(0x111111)), sx * .97, 1.95, z - .3)); }
  { const lg = new THREE.Mesh(new THREE.CircleGeometry(.45, 24), mat(0xff9f1c, { r: .4 })); for (const sx of [1, -1]) { const m = lg.clone(); m.position.set(sx * .075, 4.9, -16.2); m.rotation.y = sx * Math.PI / 2; j.add(m); } }
  return jet;
}

// ======================================================================= WELT 4: Flughafen-Vorfeld mit Privatjet (Abseilen, Tür, Kabine, Twist, Hook)
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
  const nase = new THREE.Mesh(new THREE.SphereGeometry(R0, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), lack); nase.rotation.x = Math.PI / 2; nase.scale.set(1, 1.75, 1); nase.position.set(0, Y, -2.0); nase.castShadow = true; j.add(nase);
  const nasenInnen = new THREE.Mesh(new THREE.SphereGeometry(R0 - .05, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3a3d42, { side: THREE.BackSide })); nasenInnen.rotation.x = Math.PI / 2; nasenInnen.scale.set(1, 1.75, 1); nasenInnen.position.copy(nase.position); j.add(nasenInnen);
  const heck = new THREE.Mesh(new THREE.CylinderGeometry(R0, .25, 4.2, 32), lack); heck.rotation.x = -Math.PI / 2; heck.position.set(0, Y + .2, -15.1); heck.castShadow = true; j.add(heck);
  j.add(at(box(.04, .16, 1.3, streifen), R0 + .005, Y - .25, -1.9)); j.add(at(box(.04, .16, 11.2, streifen), R0 + .005, Y - .25, -9.15));
  j.add(at(box(.04, .16, 13.5, streifen), -R0 - .005, Y - .25, -8));   // Zierstreifen (rechts mit Lücke für die Tür)
  for (const sx of [1, -1]) {   // Fenster außen
    for (let z = -4.3; z > -11.5; z -= .95) { const f = new THREE.Mesh(new THREE.CircleGeometry(.17, 18), dunkel); f.scale.set(.8, 1.15, 1); f.position.set(sx * (R0 + .01), Y + .25, z); f.rotation.y = sx * Math.PI / 2; j.add(f); }
    const himmelF = canvasTexEp('fensterHimmel', 64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fb4cc'); gr.addColorStop(.6, '#e9d6c2'); gr.addColorStop(1, '#8e9298'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#efe6d6'; g.fillRect(0, 0, w, h * .32); g.fillStyle = '#d8ccb6'; g.fillRect(0, h * .3, w, 4); });
    const fw = new THREE.Mesh(new THREE.CircleGeometry(.19, 24), new THREE.MeshBasicMaterial({ map: himmelF, side: THREE.BackSide, toneMapped: false }));
    for (let z = -4.3; z > -11.5; z -= .95) { const f = fw.clone(); f.scale.set(.85, 1.2, 1); f.position.set(sx * (R0 - .085), Y + .25, z); f.rotation.y = sx * Math.PI / 2; j.add(f);
      const blende = box(.02, .05, .3, mat(0xd8ccb6)); blende.position.set(sx * (R0 - .095), Y + .37, z); j.add(blende); }
  }
  { // Cockpitscheiben als gebogene Flächen, die genau auf der Nase liegen (nichts steht ab, von außen nur dunkles Glas)
    const glasA = mat(0x0f1620, { r: .05, m: .7 });
    const himmelC = canvasTexEp('cockpitHimmel', 64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#a9bed6'); gr.addColorStop(.7, '#f0d9c2'); gr.addColorStop(1, '#9aa1a8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const innenM = new THREE.MeshBasicMaterial({ map: himmelC, side: THREE.BackSide, toneMapped: false });
    const O = Math.PI * 1.5;
    for (const [p0, pl, t0, tl] of [[O - .78, .72, .62, .38], [O + .06, .72, .62, .38], [O - 1.4, .5, 1.05, .3], [O + .9, .5, 1.05, .3]]) {
      for (const [r, m] of [[R0 + .006, glasA], [R0 - .056, innenM]]) {
        const sc = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 6, p0, pl, t0, tl), m);
        sc.rotation.x = Math.PI / 2; sc.scale.set(1, 1.75, 1); sc.position.set(0, Y, -2.0); j.add(sc);
      }
    } }
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
  j.add(at(box(1.2, .03, 11.0, mat(0x6b5b4e, { r: .9 })), 0, 1.485, -7.4));   // Boden nur so breit wie der Rumpf dort ist
  { const sh = new THREE.Shape(); sh.absarc(0, 0, 1.1, 0, Math.PI * 2);   // runde Cockpit-Trennwand mit Türöffnung: kein Schlitz, nichts ragt raus
    const loch = new THREE.Path(); loch.moveTo(-.4, -.95); loch.lineTo(.4, -.95); loch.lineTo(.4, .71); loch.lineTo(-.4, .71); loch.lineTo(-.4, -.95); sh.holes.push(loch);
    const w = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), mat(0xd8cbb5, { side: THREE.DoubleSide })); w.position.set(0, Y, -2.45); j.add(w); }
  const cockpitTuer = new THREE.Group(); cockpitTuer.position.set(-.4, 1.5, -2.45); j.add(cockpitTuer);
  cockpitTuer.add(at(box(.8, 1.66, .045, mat(0xcbbd9f, { r: .5 })), .4, .83, 0));
  cockpitTuer.add(at(box(.7, .02, .05, mat(0xc9a227, { m: .9, r: .25 })), .4, 1.5, 0)); cockpitTuer.add(at(box(.7, .02, .05, mat(0xc9a227, { m: .9, r: .25 })), .4, .15, 0));
  cockpitTuer.add(at(cyl(.012, .012, .14, mat(0xc9a227, { m: .9, r: .25 }), 8), .72, .95, .04, 0, 0, Math.PI / 2));
  const sitzM = mat(0xc9b28a, { r: .55 }), holz = mat(0x6f4e37, { r: .4, map: holzTex([1, 1]) });
  const sitze = {};
  const sessel = (x, z, blick) => {
    const g = new THREE.Group(); g.add(at(box(.56, .14, .58, sitzM), 0, .42, 0)); g.add(at(box(.56, .62, .14, sitzM), 0, .74, -blick * .26, blick * -.08));
    g.add(at(box(.5, .02, .52, mat(0xb59a6e, { r: .6 })), 0, .5, 0));                                   // Polsternaht
    g.add(at(box(.36, .16, .12, mat(0xe9dcc3, { r: .6 })), 0, 1.12, -blick * .25));                     // Kopfkissen
    for (const sx of [-.29, .29]) { g.add(at(box(.08, .18, .55, sitzM), sx, .58, 0)); g.add(at(box(.09, .03, .5, holz), sx, .68, 0)); }
    g.add(at(cyl(.2, .22, .3, mat(0x8a7a5a, { m: .5, r: .3 }), 12), 0, .2, 0));                          // Sockel
    for (const sx of [-.12, .12]) g.add(at(box(.05, .015, .3, mat(0x4a4a4a)), sx, .5, blick * .05));       // Gurt
    g.position.set(x, 1.5, z); j.add(g); return g;
  };
  for (const [z, blick] of [[-4.3, 1], [-5.7, -1], [-7.4, 1], [-8.8, -1], [-10.4, 1]]) for (const x of [-.55, .55]) sitze[`${x}_${z}`] = sessel(x, z, blick);
  for (const [x, z] of [[.55, -6.55], [-.55, -9.6], [.55, -9.6]]) j.add(at(box(.55, .05, .7, holz), x, 2.22, z));   // Tische zwischen den Club-Sitzen
  const kabinenLichter = []; for (const z of [-3.5, -6.5, -9.5]) { const l = new THREE.PointLight(0xffe2b8, 9, 9, 1.4); l.position.set(0, 3.2, z); j.add(l); kabinenLichter.push(l); }
  j.add(at(box(.3, .02, 10, mat(0xfff6e0, { e: 0xffe2b8, ei: 1.5 })), 0, 3.5, -7.5));
  // Cockpit: zwei Sitze, Instrumente
  for (const x of [-.4, .4]) { const g = new THREE.Group(); g.add(at(box(.5, .12, .5, mat(0x2b2d31)), 0, .45, 0)); g.add(at(box(.5, .7, .1, mat(0x2b2d31)), 0, .8, -.25)); g.position.set(x, 1.5, -1.45); j.add(g); }
  j.add(at(box(1.25, .35, .3, mat(0x1b1d21, { e: 0x2a6f97, ei: .5 })), 0, 2.2, -.95));   // Instrumentenbrett weiter hinten → steht nicht aus der Nase
  for (const x of [-.45, -.15, .15, .45]) j.add(at(box(.25, .18, .02, mat(0x0d1b2a, { e: [0x4cc9f0, 0x80ed99, 0xffd166, 0x4cc9f0][Math.round((x + .45) / .3)], ei: .9 })), x * .8, 2.25, -.78, -.3));
  for (const x of [-.4, .4]) { j.add(at(cyl(.015, .015, .3, mat(0x222222), 6), x, 1.95, -.85, -.6)); j.add(at(box(.18, .05, .04, mat(0x222222)), x, 2.05, -.95)); }
  j.add(at(box(.9, .06, .5, mat(0x1b1d21)), 0, 3.25, -.9));
  return { j, pivot, tuer, raeder, licht, cockpitTuer, kabinenLichter };
}


const VF = (() => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0xc9cdd3); s.fog = new THREE.Fog(0xc9cdd3, 18, 340);
  s.add(new THREE.HemisphereLight(0xe9eef7, 0x6a6660, 1.7));
  const fuell = new THREE.DirectionalLight(0xdfe6f2, .9); fuell.position.set(30, 10, 40); s.add(fuell);
  const sonne = new THREE.DirectionalLight(0xffd4ab, 1.6); sonne.position.set(-25, 18, 20); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048);
  Object.assign(sonne.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 }); s.add(sonne); s.add(sonne.target);
  // Vorfeld: einfarbig grau; für die Sicht von oben eine Variante mit aufgemalten Linien (Textur mit Mipmaps → flimmert nicht)
  const vorfeldLinien = canvasTexEp('vorfeldLinien', 2048, 2048, (g, w, h) => {
    const m = x => (x + 350) / 700 * w, n = z => (z + 410) / 700 * h;   // Welt → Pixel
    g.fillStyle = '#6c7178'; g.fillRect(0, 0, w, h); g.lineCap = 'butt';
    g.strokeStyle = '#e8b730'; g.lineWidth = 3;
    const linie = (x0, z0, x1, z1, strich = null) => { g.setLineDash(strich ?? []); g.beginPath(); g.moveTo(m(x0), n(z0)); g.lineTo(m(x1), n(z1)); g.stroke(); };
    linie(0, 30, 0, -180); linie(-6, 30, -6, -170); linie(6, 30, 6, -170); linie(-6.4, 30, -6.4, -170, [6, 6]);
    for (let k = 0; k < 5; k++) { const z = 12 - k * 30; linie(7, z, 21, z); linie(21, z, 21, z - 8); }
    for (let k = 0; k < 4; k++) linie(-6, -160 - k * .5, 6, -160 - k * .5);
    g.strokeStyle = '#f1f3f5'; g.lineWidth = 2; for (let z = 25; z > -170; z -= 18) linie(-.6, z, .6, z);
    for (const zb of [-200, -330]) {   // Startbahnen (dunkel, Mittellinie gestrichelt, Ränder, Schwellen)
      g.fillStyle = '#3d4047'; g.fillRect(0, n(zb - 22.5), w, n(zb + 22.5) - n(zb - 22.5));
      g.strokeStyle = '#f1f3f5'; g.lineWidth = 3; linie(-350, zb, 350, zb, [18, 14]); linie(-350, zb - 21, 350, zb - 21); linie(-350, zb + 21, 350, zb + 21);
      for (let k = 0; k < 8; k++) { linie(-300, zb - 18 + k * 5, -270, zb - 18 + k * 5); linie(270, zb - 18 + k * 5, 300, zb - 18 + k * 5); } }
    g.setLineDash([]); }, [1, 1]);
  const vorfeldGrau = mat(0x6c7178, { r: .8 }), vorfeldMitLinien = new THREE.MeshLambertMaterial({ map: vorfeldLinien });
  vorfeldLinien.anisotropy = 16;
  const bp = bodenPlatte(700, 700, vorfeldGrau, 0, -60); bp.receiveShadow = false; s.add(bp);
  for (let z = 20; z > -180; z -= 6) s.add(at(box(.18, .01, 3.6, mat(0xf2c14e, { e: 0x4a3a10, ei: .3 })), 0, .006, z));   // Mittellinie
  s.add(at(new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mat(0x6f8f45, { r: 1 })), 0, -.6, 0, -Math.PI / 2));   // Land bis zum Horizont (keine Kante von oben)
  const fa = flughafen(s);
  const jet = jetDetails(bauJet(s));
  const expl = new Explosion(s, V3(0, 0, 0), { groesse: .85, richtung: V3(1, .3, 0), seed: 9, truemmer: 28, farbe: 0xdee2e6 });
  const rauch = new Schwaden(s, V3(0, 0, 0), 8, 4);
  const k = kamera(s, 74); const pov = new Pov(k); pov.tief = .07;
  const t = { 1: teamOps(s, 1, 1), 2: teamOps(s, 2, 1), 4: teamOps(s, 4, 1), 7: teamOps(s, 7, 1) };
  const schild2 = schildModell(); t[2].j.chest.add(schild2); schild2.position.set(.06, -.04, .34); schild2.rotation.set(0, 0, 0);   // Schild senkrecht vor dem Körper, links geführt
  const schildAb = schildModell(); s.add(schildAb); schildAb.visible = false;
  const pilot = new Figur({ art: 'zivil', jacke: 0xf8f9fa, hose: 0x212529, kappe: 0x1d3557, haut: 0xe8b98a, groesse: 1.78, hemd: true, krawatte: 0x1d3557, schulterklappen: true }); s.add(pilot.root);
  const kopilot = new Figur({ art: 'zivil', jacke: 0xf8f9fa, hose: 0x212529, kappe: 0x1d3557, haut: 0xc68642, groesse: 1.7, hemd: true, krawatte: 0x1d3557, schulterklappen: true, haare: true, dutt: true, haarfarbe: 0x1a1a1a }); s.add(kopilot.root);
  const gorilla = new Figur({ art: 'zivil', jacke: 0x1b1b1e, hose: 0x1b1b1e, schuh: 0x111111, haut: 0xc68642, sonnenbrille: true, groesse: 1.96, hemd: true, krawatte: 0x111111, ohrstoepsel: true, haare: true, haarfarbe: 0x1a1a1a }); s.add(gorilla.root);
  const schellen = handschellenModell(); s.add(schellen);
  const tablet = new THREE.Group(); const ts = liveTex(768, 512);
  tablet.add(at(box(.26, .18, .012, mat(0x111111, { r: .3 })), 0, 0, 0));
  tablet.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.24, .16), new THREE.MeshBasicMaterial({ map: ts.tex })), 0, 0, .007));
  s.add(tablet);
  const heli = heliModell(); s.add(heli.g); heli.g.rotation.order = 'YXZ';
  const wind = new Abwind(s, 90, { farbe: 0xb8b1a3 });
  const crew = new Figur({ art: 'zivil', jacke: 0x4b5320, hose: 0x4b5320, schuh: 0x111111, helm: true, visier: true, headset: true, handschuhe: true, haut: 0xc68642, groesse: 1.82 }); heli.g.add(crew.root);
  const seilHaufen = new THREE.Group(); for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.22 + (k % 3) * .06, .022, 6, 20), mat(0x2a2116, { r: 1 })); r.rotation.set(Math.PI / 2 + (k % 2 ? .15 : -.1), 0, k); r.position.set((k % 3 - 1) * .05, .03 + k * .028, (k % 2) * .05); seilHaufen.add(r); } s.add(seilHaufen);
  const feuerwehr = new THREE.Group(); { const rot = mat(0xc1121f, { r: .45, m: .2 });
    feuerwehr.add(at(box(2.6, 2.4, 8.5, rot), 0, 1.7, 0)); feuerwehr.add(at(box(2.4, 1.0, 1.8, mat(0x223344, { r: .1, m: .5 })), 0, 2.2, -3.6));
    feuerwehr.add(at(box(2.62, .2, 8.5, mat(0xf1f3f5)), 0, 1.2, 0)); feuerwehr.add(at(cyl(.15, .15, 1.6, mat(0xdee2e6, { m: .7 }), 8), 0, 3.2, -2.2, -1.2));
    for (const zz of [-2.8, .2, 2.8]) for (const sx of [-1.2, 1.2]) feuerwehr.add(at(cyl(.6, .6, .45, mat(0x111111), 16), sx, .6, zz, 0, 0, Math.PI / 2)); }
  const blau = [mat(0x002255, { e: 0x2a6fff, ei: 4, noCache: true }), mat(0x002255, { e: 0x2a6fff, ei: 4, noCache: true })];
  for (const [sx, i] of [[-.8, 0], [.8, 1]]) feuerwehr.add(at(box(.5, .18, .3, blau[i]), sx, 3.0, -3.9));
  s.add(feuerwehr);
  // Team im Hubschrauber (Kinder des Helis) für den durchgehenden Anflug
  const lander = verkehrsflugzeug(s, 0, -200, Math.PI / 2, { akzent: 0x9d0208, skala: .9 });
  const bus = new THREE.Group(); bus.add(at(box(2.5, 2.6, 12, mat(0xf1f3f5)), 0, 1.6, 0)); bus.add(at(box(2.52, .9, 11, mat(0x223344, { r: .1, m: .5 })), 0, 2.1, 0)); bus.add(at(box(2.54, .3, 12, mat(0x1d3557)), 0, .7, 0));
  for (const sx of [-1.2, 1.2]) for (const zz of [-4, 4]) bus.add(at(cyl(.5, .5, .3, mat(0x111111), 14), sx, .5, zz, 0, 0, Math.PI / 2)); s.add(bus);
  const sitzer = {}; for (const nr of [1, 2, 4, 7]) { sitzer[nr] = teamOps(s, nr, 0); s.remove(sitzer[nr].root); heli.g.add(sitzer[nr].root); }
  // Polizei sperrt das Vorfeld ab: 3 Streifenwagen + 4 Polizisten
  const autos = []; const silber = mat(0xdfe3e8, { r: .35, m: .3 }), blauLack = mat(0x1d3f8f, { r: .4, m: .2 }), glasA = mat(0x1a2533, { r: .1, m: .5 });
  const autoBlau = [];
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Group();
    a.add(at(box(1.82, .62, 4.5, silber), 0, .62, 0)); a.add(at(box(1.66, .52, 2.3, glasA), 0, 1.18, .15)); a.add(at(box(1.6, .06, 2.1, silber), 0, 1.46, .15));
    a.add(at(box(1.84, .22, 3.6, blauLack), 0, .7, 0));
    a.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, .22), new THREE.MeshStandardMaterial({ map: textTex('pol' + i, 'POLIZEI', { w: 512, h: 96, farbe: '#ffffff', grund: '#1d3f8f', font: 'bold 70px DejaVu Sans' }) })), .925, .72, -.3, 0, Math.PI / 2, 0));
    a.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, .22), new THREE.MeshStandardMaterial({ map: textTex('pol' + i, 'POLIZEI', { w: 512, h: 96, farbe: '#ffffff', grund: '#1d3f8f', font: 'bold 70px DejaVu Sans' }) })), -.925, .72, -.3, 0, -Math.PI / 2, 0));
    for (const [sx, k2] of [[-.35, 0], [.35, 1]]) { const m2 = mat(0x001133, { e: 0x2a6fff, ei: 4, noCache: true }); a.add(at(box(.55, .12, .25, m2), sx, 1.55, .3)); autoBlau.push(m2); }
    for (const sx of [-.85, .85]) for (const zz of [-1.45, 1.45]) a.add(at(cyl(.34, .34, .24, mat(0x111111), 16), sx, .34, zz, 0, 0, Math.PI / 2));
    for (const sx of [-.55, .55]) a.add(at(box(.3, .12, .05, mat(0xfff6e0, { e: 0xfff1d6, ei: 3 })), sx, .7, -2.26));
    const tuerA = new THREE.Group(); tuerA.position.set(-.92, 0, -.6); a.add(tuerA); tuerA.add(at(box(.06, .9, 1.1, silber), 0, .85, .55));
    a.tuer = tuerA; s.add(a); autos.push(a);
  }
  const polizei = [];
  for (let i = 0; i < 4; i++) { const pz = new Figur({ art: 'zivil', jacke: 0x1d3557, hose: 0x14213d, schuh: 0x111111, kappe: 0x14213d, haut: [0xe0ac69, 0xf1c27d, 0xc68642, 0xffdbac][i], groesse: 1.78 + i * .03, handschuhe: false });
    pz.j.chest.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.28, .08), new THREE.MeshStandardMaterial({ map: textTex('polR', 'POLIZEI', { w: 256, h: 64, farbe: '#ffffff', grund: '#14213d', font: 'bold 44px DejaVu Sans' }) })), 0, .15, -.125, 0, Math.PI, 0));
    const pist = new THREE.Group(); pist.add(at(box(.035, .03, .17, mat(0x15171a)), 0, 0, 0)); pist.add(at(box(.03, .1, .04, mat(0x15171a)), 0, -.05, -.05, .25)); s.add(pist); pz.pistole = pist;
    s.add(pz.root); polizei.push(pz); }
  // Dörfer und Felder rund um den Flughafen (sieht man beim Anflug)
  { const r = rng(57), haus = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0xd9d2c5, { r: .8 }), 260), dach = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0x8c3b2e, { r: .8 }), 260);
    const baum = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mat(0x3d5a2e, { r: 1 }), 500), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const doerfer = [[-260, 140], [-330, -60], [-200, 260], [160, 220], [300, 40], [-120, 330]];
    for (let i = 0; i < 260; i++) { const [dx, dz] = doerfer[i % doerfer.length]; const w = 7 + r() * 7, hh = 5 + r() * 5; ps.set(dx + (r() - .5) * 90, hh / 2, dz + (r() - .5) * 90); q.setFromAxisAngle(V3(0, 1, 0), Math.floor(r() * 4) * Math.PI / 2 + .3);
      haus.setMatrixAt(i, m4.compose(ps, q, sc.set(w, hh, w * .7))); dach.setMatrixAt(i, m4.compose(ps.clone().setY(hh + .9), q, sc.set(w * 1.06, 1.8, w * .76))); }
    for (let i = 0; i < 500; i++) { const hh = 7 + r() * 7; const w = r() * Math.PI * 2, rad = 140 + r() * 260; ps.set(Math.cos(w) * rad, hh / 2, Math.sin(w) * rad + 30); if (Math.abs(ps.x) < 70 && ps.z > -260) ps.x += 140 * Math.sign(ps.x || 1); baum.setMatrixAt(i, m4.compose(ps, q.identity(), sc.set(3 + r() * 2, hh, 3 + r() * 2))); }
    s.add(haus, dach, baum); }
  // Suchscheinwerfer-Kegel vom Hubschrauber + Morgensonne am Horizont
  const kegelGeo = new THREE.ConeGeometry(2.6, 22, 28, 1, true); kegelGeo.translate(0, -11, 0);
  const kegel = new THREE.Mesh(kegelGeo, new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  kegel.visible = false; s.add(kegel);
  const such = new THREE.SpotLight(0xfff4dd, 0, 60, .14, .5, 1.2); s.add(such); s.add(such.target);
  const sonnenGlut = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('sonneVF', [[0, 'rgba(255,236,200,1)'], [.2, 'rgba(255,190,120,.75)'], [.55, 'rgba(255,150,90,.25)'], [1, 'rgba(255,140,80,0)']]), fog: false, depthWrite: false, transparent: true }));
  sonnenGlut.position.set(-320, 30, -420); sonnenGlut.scale.set(240, 240, 1); s.add(sonnenGlut);
  // Reifenqualm beim Bremsen
  const qualm = []; const rt = rauchTex();
  for (let i = 0; i < 18; i++) { const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, color: 0xdee2e6, transparent: true, depthWrite: false })); q.userData = { ph: i / 18, seite: i % 2 ? 1 : -1 }; s.add(q); qualm.push(q); }
  return { s, k, pov, jet, expl, rauch, t, lander, bus, bp, vorfeldGrau, vorfeldMitLinien, kopilot, sitzer, autos, autoBlau, polizei, kegel, such, schild2, schildAb, pilot, gorilla, schellen, tablet, ts, heli, wind, qualm, sonne, fa, crew, seilHaufen, feuerwehr, blau };
})();

const NASE_STOP = -10;          // Nasenspitze des Jets (Welt-z), wenn er steht
const TUER_Z = NASE_STOP - 3.05, TUER_X = 1.16;
const RAMPE_X = TUER_X + .9;    // Ende der Treppe auf dem Boden
const rampeH = x => clamp((RAMPE_X - x) / (RAMPE_X - TUER_X)) * 1.5;
const JB = { tb: 5.0, v0: 11, ab: 5.5 };
// Durchgehender Anflug: Flug (0–13 s) → Schweben → Abseilen (ab AB0). Jet rollt los und wird von der Polizei gestoppt.
const AB0 = 11.0;
const JA = { los: .3, z0: -80, a: 4, v: 8, tb: 9.55, ab: 4 };
function jetAnflug(T) {
  if (T < JA.los) return JA.z0;
  const ta = JA.v / JA.a;                               // Beschleunigen auf 8 m/s
  if (T < JA.los + ta) return JA.z0 + .5 * JA.a * (T - JA.los) ** 2;
  const z1 = JA.z0 + .5 * JA.a * ta * ta;
  if (T < JA.tb) return z1 + JA.v * (T - JA.los - ta);
  const zb = z1 + JA.v * (JA.tb - JA.los - ta), d = T - JA.tb, tS = JA.v / JA.ab;
  return d >= tS ? zb + JA.v * JA.v / (2 * JA.ab) : zb + JA.v * d - .5 * JA.ab * d * d;
}
// Streifenwagen fahren rein, Polizisten steigen aus und umstellen den Jet von vorne (T = Anflug-Zeit; Infinity = Endstand)
const AUTOS = [
  { von: V3(170, 0, -5.5), nach: V3(0, 0, -5.5), r: Math.PI / 2 + .08, t0: 1.0, t1: 7.0 },     // kommen von weit her (sichtbar), bremsen vor dem Jet
  { von: V3(-5.6, 0, 170), nach: V3(-5.6, 0, -4.2), r: -Math.PI / 2 + .5, t0: 1.4, t1: 7.3 },
  { von: V3(170, 0, -3.2), nach: V3(6.9, 0, -3.2), r: Math.PI / 2 - .45, t0: 1.8, t1: 7.7 },
];
const POLIZISTEN = [[0, V3(-1.0, 0, -3.5)], [0, V3(1.6, 0, -3.6)], [1, V3(-4.4, 0, -6.7)], [2, V3(6.3, 0, -5.7)]];
function stellePolizei(T, t) {
  const ziel = V3(0, 2.2, -11);
  AUTOS.forEach((a, i) => {
    const k = easeOut(clamp((T - a.t0) / (a.t1 - a.t0)));
    const car = VF.autos[i]; car.visible = true;
    const dir = a.nach.clone().sub(a.von), fahrt = Math.atan2(-dir.x, -dir.z);
    let dr = a.r - fahrt; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    car.position.copy(a.von).lerp(a.nach, k); car.rotation.set(0, fahrt + dr * smooth(.85, 1, k), 0);
    car.tuer.rotation.y = -1.1 * smooth(a.t1 + .2, a.t1 + .6, T);
  });
  VF.autoBlau.forEach((m, i) => { m.emissiveIntensity = Math.floor(t * 7 + i * .5) % 2 ? 7 : .3; });
  POLIZISTEN.forEach(([ai, pos], i) => {
    const f = VF.polizei[i], a = AUTOS[ai], car = VF.autos[ai];
    const raus = a.t1 + .5 + (i % 2) * .3; f.root.visible = T > raus;
    if (!f.root.visible) { f.pistole.visible = false; return; }
    const start = car.localToWorld(V3(i % 2 ? .9 : -1.4, 0, -.4)); start.y = 0;
    const k = smooth(raus, raus + 1.1, T), p = start.clone().lerp(pos, k);
    const yaw = Math.atan2(ziel.x - p.x, ziel.z - p.z);
    f.pose(k < 1 ? { ...gehPose((T - raus) * 7, { hocke: .25 }), kopf: [0, 0, 0] } : { ...stehPose(t + i), beinL: [.3, .35], beinR: [-.15, .3], rumpf: [.15, 0, 0] });
    f.platziere(p.x, p.z, yaw);
    const auf = smooth(raus + .6, raus + 1.3, T);
    const pist = f.lokal(0, 1.42, .42 + .1 * auf); f.pistole.visible = true; f.pistole.position.copy(pist); f.pistole.lookAt(ziel);
    f.greife('R', pist.clone().add(V3(0, -.05, 0)).lerp(f.lokal(-.18, .95, .15), 1 - auf), f.lokal(-.6, .8, -.3));
    f.greife('L', pist.clone().add(V3(0, -.07, 0)).lerp(f.lokal(.18, .95, .15), 1 - auf), f.lokal(.6, .8, -.3));
    schaueAn(f, ziel, 1);
  });
}
function jetZ(lt) {             // Szene 'abseilen': Jet rollt aus dem Nebel, bremst vor dem Hubschrauber
  const { tb, v0, ab } = JB;
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
  VF.lander.visible = false; VF.bus.visible = false;
  VF.bp.material = VF.vorfeldGrau;
  VF.fa.fein.forEach(o => { o.visible = true; });
  VF.jet.kabinenLichter.forEach(l => { l.visible = false; });   // außen: Kabinenlicht aus (würde den Rumpf von innen durchleuchten)
  VF.s.fog.far = 340;
  VF.jet.cockpitTuer.rotation.y = 0;
  VF.schildAb.visible = false;
  VF.schild2.visible = true;
  VF.heli.g.visible = true;
  VF.tablet.visible = false; VF.schellen.visible = false;
  VF.expl.update(-1); VF.rauch.update(-1, 0); VF.wind.update(t, 0, V3(0, 0, 0)); VF.qualm.forEach(q => { q.visible = false; });
  VF.heli.seil.visible = false;
  for (const nr of [1, 2, 4, 7]) VF.t[nr].root.visible = true;
  VF.pilot.root.visible = true; VF.gorilla.root.visible = true;
  VF.sonne.target.position.set(VF.k.position.x, 0, VF.k.position.z - 6); VF.sonne.position.set(VF.k.position.x - 25, 18, VF.k.position.z + 20);
  flughafenUpdate(VF.fa, t);
  VF.crew.root.visible = false; VF.seilHaufen.visible = false; VF.kegel.visible = false; VF.such.intensity = 0;
  for (const nr of [1, 2, 4, 7]) VF.sitzer[nr].root.visible = false;
  stellePolizei(1e9, t);
  // Flughafenfeuerwehr rückt mit Blaulicht an (fährt auf dem Parallelweg rechts)
  { const z = 60 - ((t * 9) % 260); VF.feuerwehr.position.set(28, 0, z); VF.feuerwehr.rotation.y = Math.PI; VF.blau.forEach((m, i) => { m.emissiveIntensity = Math.floor(t * 6 + i) % 2 ? 6 : .3; }); }
  VF.jet.beacon.forEach((m, i) => { m.emissiveIntensity = ((t + i * .5) * 1.2) % 1 < .12 ? 7 : .3; });
  // Hubschrauber kreist weiter oben (Sicherung aus der Luft)
  const h = VF.heli; h.g.position.set(-14 + 4 * Math.sin(t * .3), 17, -6 + 3 * Math.cos(t * .3)); h.g.rotation.set(-.05, -Math.PI / 2 + .3 * Math.sin(t * .3), .04);
  heliUpdate(h, t);
}
function schildHand(f) { if (VF.schild2.visible) { VF.schild2.updateMatrixWorld(true); f.greife('L', weltPos(VF.schild2.griff), f.lokal(.7, .9, -.3)); } }
function heliUeberJet(t) { return { pos: V3(-14 + .6 * Math.sin(t * .4), 8.5 + .3 * Math.sin(t * .7), -32), rot: new THREE.Euler(-.08, -.6, .03 * Math.sin(t * .5), 'YXZ') }; }
function suchscheinwerfer(t, k) {
  const h = VF.heli, quelle = h.g.localToWorld(V3(.4, HELI_BODEN - .4, -2.4)), zielL = V3(1.2, 1.6, TUER_Z - .3 + Math.sin(t * .6) * .8);
  VF.kegel.visible = k > .02; VF.kegel.material.opacity = .1 * k; VF.kegel.position.copy(quelle); VF.kegel.quaternion.setFromUnitVectors(V3(0, -1, 0), zielL.clone().sub(quelle).normalize());
  VF.such.position.copy(quelle); VF.such.target.position.copy(zielL); VF.such.intensity = 300 * k;
}
function stelleJet(nz, nick = 0) {
  const j = VF.jet; j.j.position.set(0, 0, nz); j.j.rotation.set(-nick, 0, 0);
}
function pilotSitzt(lt, haendeHoch, blickZurueck, szene = 'kabine') {
  VF.pilot.pose({ beinL: [1.5, 1.55], beinR: [1.45, 1.5], armL: haendeHoch ? [2.9, .35] : [1.1, .1], ellL: haendeHoch ? .5 : .6, armR: haendeHoch ? [2.9, .35] : [1.1, .1], ellR: haendeHoch ? .5 : .6,
    kopf: [0, blickZurueck ? 2.2 : 0, 0], mund: redet(szene, lt, 'P') });
  const p = VF.jet.j.localToWorld(V3(.4, 0, -1.45));
  VF.pilot.platziere(p.x, p.z, 0, { hoehe: 1.5 + .5 - .98 * VF.pilot.root.scale.x + .04 });
  const kp = VF.kopilot; kp.pose({ beinL: [1.5, 1.55], beinR: [1.45, 1.5], armL: haendeHoch ? [2.8, .4] : [1.0, .1], ellL: haendeHoch ? .6 : .7, armR: haendeHoch ? [2.8, .4] : [1.0, .1], ellR: haendeHoch ? .6 : .7, kopf: [0, blickZurueck ? -1.9 : 0, 0] });
  const q = VF.jet.j.localToWorld(V3(-.4, 0, -1.45)); kp.platziere(q.x, q.z, 0, { hoehe: 1.5 + .5 - .98 * kp.root.scale.x + .04 });
}

// ---------------------------------------------------------------- Abseilen (Hubschrauber schwebt vor dem rollenden Jet)
const HH = 11.5;                 // Schwebehöhe
const HELI_AB = V3(0, HH, 3.6);
const SEIL_X = .05, SEIL_Z = 2.0;   // Fußpunkt des Seils beim Schweben – feste Laufwege (der Heli fliegt später weg, die Wege dürfen nicht mitwandern)
// Eine Figur rutscht am Seil (Hände greifen, Beine umklammern), landet weich in der Hocke
function rutschen(f, t0, t1, sx, sz, lt) {
  const kk = clamp((lt - t0) / (t1 - t0)); const y = lerp(HH + HELI_BODEN - .3, 0, kk * kk * (1.6 - .6 * kk));
  const lande = smooth(t1, t1 + .3, lt);
  f.root.visible = true; f.ohneGewehr();
  f.pose(lande > 0 ? { ...hockPose(.6 * (1 - lande) + .3) } : { beinL: [.9, 1.3], beinR: [.5, 1.0], armL: [3.0, .1], armR: [2.9, .1], ellL: .3, ellR: .4, rumpf: [.1, 0, 0], kopf: [-.5, 0, 0] });
  if (lande > 0) { f.platziere(sx, sz + .25, Math.PI); return; }
  f.platziere(sx, sz + .25, Math.PI, { hoehe: y });
  f.greife('L', V3(sx, y + 2.05, sz), f.lokal(.5, 1.6, .3)); f.greife('R', V3(sx, y + 1.75, sz), f.lokal(-.5, 1.4, .3));
}
function s_abseilen(lt, t, ausAnflug = false) {
  if (!ausAnflug) vfStandard(t);
  const { k, pov, t: tm, jet, heli: h, wind } = VF;
  const d = 10.0;
  // Hubschrauber: schwebt, Tür links zeigt zum Jet (−z); am Ende steigt er weg
  const weg = smooth(7.3, d, lt), hz = heliUeberJet(t);   // fliegt rüber hinter den Jet (genau dorthin, wo er in der Tür-Szene schwebt)
  h.g.position.set(HELI_AB.x + .25 * Math.sin(t * .8), HELI_AB.y + .2 * Math.sin(t * 1.1), HELI_AB.z + .15 * Math.cos(t * .7)).lerp(hz.pos, weg);
  h.g.rotation.set(lerp(.03 * Math.sin(t * .9), hz.rot.x, weg), lerp(-Math.PI / 2, hz.rot.y, weg), lerp(.04 * Math.sin(t * .6), hz.rot.z, weg));
  h.g.updateMatrixWorld(true);
  heliUpdate(h, t); suchscheinwerfer(t, smooth(d - 1.5, d, lt));
  const fuss = h.g.localToWorld(V3(-1.6, 0, -.05)); fuss.y = 0;
  wind.update(t, 1 - weg * .7, V3(fuss.x, 0, fuss.z + 1.5), 0, k);
  // Seil fällt
  const raus = easeOut(clamp((lt - .25) / .6));
  const seil = setzeSeil(h, lerp(HH + 1.5, 0, raus), 0);
  VF.seilHaufen.visible = raus > .98; VF.seilHaufen.position.set(seil.oben.x, 0, seil.oben.z);
  // Crew-Chief kniet an der Tür, sichert das Seil und gibt Zeichen
  { const c = VF.crew; c.root.visible = true; c.pose({ ...KNIEPOSE, armL: [1.3, .1], ellL: .7, armR: lt < 1.2 ? [2.6, .3] : [1.5, .2], ellR: .4, kopf: [.5, -.4, 0] });
    c.platziere(-.95, -.8, -Math.PI / 2, { boden: h.g.localToWorld(V3(-.95, HELI_BODEN, -.8)).y });
    c.greife('L', h.g.localToWorld(V3(-1.55, HELI_BODEN + 1.2, -.05)), c.lokal(.5, 1.2, .3)); }
  // Jet rollt heran, bremst, Reifenqualm
  const TA = AB0 + lt, TBr = JA.tb - AB0;   // Anflug-Zeit
  const nz = jetAnflug(TA), brems = TA > JA.tb && TA < JA.tb + 2 ? Math.sin((TA - JA.tb) / 2 * Math.PI) * .035 : 0;
  stelleJet(nz, brems); jet.licht.forEach(l => { l.intensity = 160; }); jet.pivot.rotation.z = 0;
  jet.raeder.forEach(r => { r.rotation.x = -t * 9 * (TA < JA.tb + 2 ? 1 : 0); });
  VF.qualm.forEach(q => {
    const u = q.userData, dt = lt - TBr - u.ph * 1.8; q.visible = dt > 0 && lt < TBr + 4;
    if (!q.visible) return;
    const quelle = jet.j.localToWorld(V3(u.seite * 1.3, .2, -9));
    q.position.set(quelle.x + u.seite * dt * .6, .3 + dt * .7, quelle.z - dt * 1.5);
    const sz = .8 + dt * 2.2; q.scale.set(sz, sz, 1); q.material.opacity = .55 * clamp(1 - dt / 2.2);
  });
  pilotSitzt(lt, false, false, 'anflug'); VF.gorilla.root.visible = false;
  // 2 rutscht zuerst ab, landet, sichert
  const r2a = 1.4, r2b = 2.7;
  const seilX = seil.oben.x, seilZ = seil.oben.z;
  for (const nr of [1, 4, 7]) tm[nr].root.visible = false;
  // 1 kniet im Heli hinter der Tür und gibt das Seil frei (ruft, zeigt runter)
  if (lt < 3.2) { const f = tm[1]; f.root.visible = true; const w = h.g.localToWorld(V3(-.3, 0, .05));
    f.pose({ ...KNIEPOSE, mund: redet('anflug', AB0 + lt, '1'), armR: lt < 1.9 ? [2.4 + .3 * Math.sin(t * 8), .3] : [1.2, .2], ellR: .4 });
    f.platziere(w.x, w.z, Math.PI * .75, { boden: h.g.localToWorld(V3(-.3, HELI_BODEN, .05)).y }); f.haltGewehr('tief');
    schaueAn(f, k.position, 1); nicken(f, 'anflug', AB0 + lt, '1'); }
  {
    const f = tm[2];
    VF.schild2.visible = lt > r2b;
    if (lt < r2a) { f.root.visible = false; }
    else if (lt < r2b + .3) rutschen(f, r2a, r2b, seilX, seilZ, lt);
    else {
      const p = pfad([[r2b + .3, SEIL_X, SEIL_Z + .25], [r2b + .9, SEIL_X + 1.6, SEIL_Z - 1.0], [5.6, SEIL_X + 1.6, SEIL_Z - 1.0], [6.9, 3.4, -4.3], [7.7, 3.3, -7.0], [9.3, 1.62, -13.1]], lt);   // 2 läuft direkt an die Tür
      const da = lt > 9.3; f.pose(p.s > .05 ? rennPose(p.dist / .9 * Math.PI, { neig: .3 }) : da ? { ...stehPose(t), kopf: [-.2, 0, 0], rumpf: [.05, 0, 0] } : hockPose(.45)); f.platziere(p.x, p.z, p.s > .05 ? richtung(p.vx, p.vz, Math.PI) : da ? -Math.PI / 2 : Math.PI); f.haltGewehr(p.s > .05 ? 'tief' : 'anschlag'); schildHand(f);
    }
  }
  // 4 + 7 + 1 kommen nach uns runter und überholen uns im Sprint
  // Laufwege mit Abstand (geprüft: nie näher als 1,4 m aneinander oder an der Kamera)
  const nach = { 1: [[7.0, SEIL_X - .4, SEIL_Z + .9], [8.0, 3.4, -2.6], [8.7, 3.3, -6.9], [9.2, 2.2, -10.0]], 4: [[7.1, SEIL_X - .7, SEIL_Z + .2], [8.3, 3.4, -3.4], [9.0, 3.3, -6.9], [9.6, 2.5, -9.4]], 7: [[7.4, SEIL_X - 1.3, SEIL_Z + .6], [8.7, 3.4, -3.8], [9.3, 3.3, -6.9], [9.8, 2.8, -8.8]] };   // bis in den Stack an der Jet-Nase   // um die Streifenwagen herum, geprüft ≥ 0,9 m Abstand
  if (lt > 5.8 && lt < 6.95) rutschen(tm[4], 5.8, 6.65, seilX, seilZ, lt);   // 4 kommt direkt nach uns am Seil runter
  for (const nr of [4, 7, 1]) {
    if (lt < nach[nr][0][0]) continue;
    const p = pfad(nach[nr], lt); tm[nr].root.visible = true;
    const steht = p.s < .05; const P = steht ? hockPose(.45) : rennPose(p.dist / .9 * Math.PI, { neig: .35 }); if (steht) { P.rumpf = [.25, 0, 0]; P.kopf = [0, 0, 0]; }
    tm[nr].pose(P); tm[nr].platziere(p.x, p.z, steht ? -2.75 : richtung(p.vx, p.vz, Math.PI));
    if (nr === 7) tm[7].ohneGewehr(); else tm[nr].haltGewehr('tief');
  }
  // Kamera: sitzt in der Tür → greift das Seil → rutscht runter → Landung → Sprint zum Jet
  const tuerSitz = h.g.localToWorld(V3(-1.22, HELI_BODEN + .95, .35));
  const g0 = 3.0, g1 = 3.5, unten = 5.55;
  let pos, ziel, hande = null;
  const nase = V3(0, 2.2, nz);
  if (lt < g0) {
    pos = tuerSitz.clone().add(wackel(t, .008));
    // erst zu 1 (ruft „Seil frei!“), dann raus, dann 2 beim Rutschen folgen – alles weich
    ziel = kopfW(tm[1]).lerp(h.g.localToWorld(V3(-9, -2.5, -1.6)), smooth(1.0, 1.45, lt));
    if (tm[2].root.visible) ziel.lerp(weltPos(tm[2].j.hips), smooth(1.45, 1.9, lt));
  } else if (lt < g1) {
    const kk = easeInOut((lt - g0) / (g1 - g0));
    pos = tuerSitz.clone().lerp(V3(seilX + .06, HH + HELI_BODEN + 1.25, seilZ + .36), kk);
    ziel = weltPos(tm[2].j.hips).lerp(V3(seilX, 0, seilZ).lerp(nase, .15), kk);
  } else if (lt < unten) {
    const kk = clamp((lt - g1) / (unten - g1)); const f = kk < .75 ? kk * kk / .75 * 1.33 * .75 : 1 - (1 - kk) * (1 - kk) * 4 * .25 / 1;
    const y = lerp(HH + HELI_BODEN + 1.25, 1.75, clamp(kk < .8 ? .9 * (kk / .8) * (kk / .8) : .9 + .1 * easeOut((kk - .8) / .2)));
    pos = V3(seilX + .06 + .02 * Math.sin(t * 7), y, seilZ + .36);
    ziel = V3(seilX, 0, seilZ).lerp(nase, .15).lerp(V3(seilX, y - 1.5, seilZ - 1.9), smooth(0, .15, kk)).lerp(nase, smooth(.55, .95, kk));
  } else {
    const stoss = Math.exp(-6 * (lt - unten)) * Math.sin((lt - unten) * 14) * .3;
    const p = pfad([[unten + .35, SEIL_X + .06, SEIL_Z + .36], [6.6, -1.6, .9], [8.0, -.6, -.4], [8.9, 3.4, -2.9], [9.5, 3.4, -5.8], [d, 6.6, -7.6]], lt);   // mittig durch die Lücke zwischen den Streifenwagen (Abstand geprüft)   // Team vorlassen, zwischen den Streifenwagen durch, hinten an den Stack
    const lauf = clamp(p.s / 3);
    pos = V3(p.x, lerp(1.62 - Math.max(0, stoss) - .1 * lauf + Math.abs(Math.sin(p.dist / .85 * Math.PI)) * .05 * lauf, 1.05, smooth(d - .7, d, lt)), p.z);   // am Ende in die Hocke wie in der Tür-Szene
    ziel = V3(1.2, 1.9, TUER_Z).lerp(nase, 1 - smooth(unten + .5, unten + 1.6, lt)).lerp(V3(.6, 2.6, TUER_Z - 1.6), smooth(d - 1.3, d, lt));
    const hoch = smooth(unten + .1, unten + .4, lt) * (1 - smooth(unten + .85, unten + 1.2, lt));   // kurzer Blick nach oben: 4 kommt am Seil runter, Heli darüber
    ziel.lerp(V3(seilX, 9, seilZ + 1.2), hoch);
  }
  schau(k, pos, ziel);
  if (lt > g0 - .2 && lt < unten + .15) {
    k.updateMatrixWorld(true);
    const schulterR = k.localToWorld(V3(.2, -.3, .1)), schulterL = k.localToWorld(V3(-.2, -.3, .1));
    const greif = (sch, dy) => V3(seilX, sch.y + dy, seilZ);
    const rutsch = lt > g1 && lt < unten ? .015 * Math.sin(t * 40) : 0;    // Hände gleiten am Seil
    pov.setze({ modus: 'frei', t, zielR: greif(schulterR, -.12 + rutsch), zielL: greif(schulterL, .14 - rutsch) });
  } else pov.setze({ modus: 'gewehr', t, lauf: lt > unten + .4 ? 1 - .9 * smooth(d - .7, d, lt) : .1, zielen: lt > unten ? lerp(-.1, -.25, smooth(d - .7, d, lt)) : -.35, senken: lt < g0 ? .3 : 0 });
  return { welt: VF, uhr: '05:31' };
}

// ---------------------------------------------------------------- Anflug (ohne Schnitt): über Felder + Dörfer → Flughafen → Polizei stoppt den Jet → Schweben → Abseilen
function zweiAnDerTuer(h, f, kk) {   // 2 rutscht vom Sitz zur Tür und hockt sprungbereit am Seil
  const q = V3(-.5, 0, -.32).lerp(V3(-1.15, 0, -.25), kk);
  f.pose(mischen(SITZPOSE, KNIEPOSE, kk)); f.platziere(q.x, q.z, lerp(0, -Math.PI / 2, kk), { boden: h.g.localToWorld(V3(q.x, HELI_BODEN, q.z)).y }); f.ohneGewehr(); f.maskeHoch(1);
}
function heliAnflug(T, t) {                 // Position/Lage des Helis bis AB0 (danach übernimmt s_abseilen)
  const u = clamp(T / AB0), r = (1 - u) * (1 - u), ruhig = smooth(.8, 1, u);
  const h = VF.heli;
  h.g.position.set(HELI_AB.x - 170 * r + .25 * Math.sin(t * .8) * ruhig, HELI_AB.y + 135 * r + .2 * Math.sin(t * 1.1) * ruhig, HELI_AB.z + 70 * r + .15 * Math.cos(t * .7) * ruhig);   // hoch über dem Platz → Sinkflug
  const nick = -.2 * (1 - smooth(.55, .8, u)) + .14 * smooth(.62, .85, u) * (1 - smooth(.9, 1, u));   // Nase unten im Reiseflug, Abfangen vor dem Schweben
  h.g.rotation.set(nick + .03 * Math.sin(t * .9) * ruhig, -Math.PI / 2 - .12 * r, .04 * Math.sin(t * .6) * ruhig - .06 * (1 - u));
  h.g.updateMatrixWorld(true); heliUpdate(h, t);
}
function s_anflug(lt, t) {
  vfStandard(t);
  const { k, pov, sitzer: st, heli: h } = VF;
  stellePolizei(lt, t);
  { const x = 420 - 75 * lt; VF.lander.visible = x > -420; VF.lander.position.set(x, Math.max(0, (x - 60) * .09), -200); VF.lander.rotation.set(0, Math.PI / 2, 0); }   // Verkehrsflugzeug landet auf der Bahn
  VF.bus.visible = true; VF.bus.position.set(-40 + 4.5 * lt, 0, 24); VF.bus.rotation.y = Math.PI / 2;   // Vorfeldbus fährt am Rand
  for (const nr of [1, 2, 4, 7]) st[nr].root.visible = true;
  if (lt >= AB0) {
    const r = s_abseilen(lt - AB0, t, true);
    for (const nr of [4, 7]) { st[nr].root.visible = lt < AB0 + 3.0; st[nr].maskeHoch(1); }
    if (lt < AB0 + 3.0) heliTeam(h, st, 'anflug', lt, {}, [4, 7]);
    st[1].root.visible = false;
    st[2].root.visible = lt < AB0 + 1.4; if (st[2].root.visible) zweiAnDerTuer(h, st[2], 1);
    return r;
  }
  heliAnflug(lt, t);
  VF.s.fog.far = 340 + 5 * Math.max(0, h.g.position.y - 12);   // von oben sieht man weiter
  const ruhig = smooth(24, 16, h.g.position.y);   // hoch oben: feine Markierungen aus, keine Konturen → ruhiger Boden ohne Flimmern
  VF.fa.fein.forEach(o => { o.visible = h.g.position.y < 22; });
  VF.bp.material = h.g.position.y < 22 ? VF.vorfeldGrau : VF.vorfeldMitLinien;   // von oben: Linien als glatte Textur (Rollbahnen sichtbar, kein Flimmern)
  // Jet rollt los (Landelichter), wird von den Streifenwagen gestoppt
  const nz = jetAnflug(lt), brems = lt > JA.tb ? Math.sin(clamp((lt - JA.tb) / 2) * Math.PI) * .035 : 0;
  stelleJet(nz, brems); VF.jet.licht.forEach(l => { l.intensity = lt > JA.los - 1 ? 160 : 40; }); VF.jet.pivot.rotation.z = 0;
  VF.jet.raeder.forEach(r => { r.rotation.x = -t * 9 * (lt > JA.los ? 1 : 0); });
  pilotSitzt(lt, false, false, 'anflug'); VF.gorilla.root.visible = false;
  for (const nr of [1, 2, 4, 7]) VF.t[nr].root.visible = false;
  h.seil.visible = false;
  VF.crew.root.visible = true;
  { const c = VF.crew; c.pose({ ...KNIEPOSE, armL: [1.3, .1], ellL: .7, armR: [1.0, .2], ellR: .8 }); c.platziere(-.95, -.8, -Math.PI / 2, { boden: h.g.localToWorld(V3(-.95, HELI_BODEN, -.8)).y }); schaueAn(c, h.g.localToWorld(V3(-6, -3, -1)), 1); }
  // Team sitzt; nach „Wir seilen ab!“ ziehen alle die Sturmhaube hoch (Augen frei), 1 geht zur Tür, 2 macht sich bereit
  const z4 = L('anflug', 'Jet'), z1 = L('anflug', 'Kein');
  const maskeT = { 7: z1.ende - .1, 2: z1.ende + .15, 4: z1.ende + .35, 1: z1.ende + .55 };
    heliTeam(h, st, 'anflug', lt, {
    7: { armL: [2.9, .1], ellL: .3, armR: [.4, .1], ellR: 1.2 },
    4: {}, 2: {}, 1: {},
  }, [2, 4, 7, ...(lt < AB0 - 1.1 ? [1] : [])]);
  const auge = h.g.localToWorld(AUGE6.clone()), k7 = kopfW(st[7]), k4 = kopfW(st[4]), k1 = kopfW(st[1]), k2 = kopfW(st[2]);
  // 1 steht auf und geht geduckt zur Tür (kniet dort wie beim Abseilen)
  if (lt >= AB0 - 1.1) { const f = st[1], kk = easeInOut(clamp((lt - (AB0 - 1.1)) / 1.0)), a = V3(.72, 0, .92), b = V3(-.3, 0, .05), q = a.clone().lerp(b, kk);
    f.pose(kk < 1 ? { ...gehPose(kk * 5, { hocke: .8, arme: false }), rumpf: [.6, 0, 0] } : { ...KNIEPOSE, armR: [1.2, .2], ellR: .4 }); f.platziere(q.x, q.z, lerp(Math.PI, Math.PI * 1.25, kk), { boden: h.g.localToWorld(V3(q.x, HELI_BODEN, q.z)).y }); f.haltGewehr('tief'); f.maskeHoch(1); }
  // 2 rutscht zur Tür vor (gleich als Erster am Seil)
  if (lt > AB0 - .6) zweiAnDerTuer(h, st[2], easeInOut(clamp((lt - (AB0 - .6)) / .6)));
  for (const nr of [1, 2, 4, 7]) { const f = st[nr], m = smooth(maskeT[nr], maskeT[nr] + .6, lt); f.maskeHoch(m);
    if (m > 0 && m < 1 && !(nr === 1 && lt >= AB0 - 1.1)) f.greife('L', f.j.head.localToWorld(V3(0, .02 + .1 * m, .12)), f.lokal(.4, 1.2, .5)); }   // Hand zieht die Maske hoch
  // Blicke + Funk-Gesten
  schaueAn(st[7], fenster(z4, lt) > 0 ? k4 : (fenster(z1, lt) > 0 ? k1 : h.g.localToWorld(V3(-3, -1, -1))), .9);
  schaueAn(st[2], fenster(z4, lt) > 0 ? k4 : (fenster(z1, lt) > 0 ? k1 : h.g.localToWorld(V3(-3, -1.5, -1))), .8);
  if (fenster(z4, lt, 0, .2) > 0) handAmOhr(st[4]);
  schaueAn(st[4], fenster(z1, lt) > 0 ? k1 : h.g.localToWorld(V3(-3, -1, -1.5)), .7);
  if (fenster(z1, lt, 0, .2) > 0 && lt < AB0 - 1.1) handAmOhr(st[1]);
  // Kamera: sitzt an der Tür – 7 → (Funk) 4 → raus: Flughafen, Jet rollt, Polizei → (Funk) 1 → Masken → zur Tür
  const draussen = h.g.worldToLocal(V3(0, 1.5, jetAnflug(lt) + 6));
  let zl = draussen.clone();   // von hoch oben: Blick raus und runter auf Flughafen + Jet
  zl.lerp(h.g.worldToLocal(k1.clone()), .6 * fenster(z1, lt, .3, .3));
  zl.lerp(h.g.worldToLocal(k2.clone()), .7 * smooth(z1.ende - .1, z1.ende + .4, lt) * (1 - smooth(AB0 - 1.4, AB0 - .9, lt)));   // 2 zieht die Maske hoch
  zl.lerp(h.g.worldToLocal(kopfW(st[1])), smooth(AB0 - 1.0, AB0 - .1, lt));                                                   // zu 1 an der Tür
  const pl = AUGE6.clone().lerp(V3(-1.22, HELI_BODEN + .95, .35), easeInOut(clamp((lt - (AB0 - 1.0)) / .95)));
  schau(k, h.g.localToWorld(pl), h.g.localToWorld(zl), h.g.rotation.z * .6);
  // eigene Maske: linke Hand kurz zum Gesicht
  const ich = smooth(z1.ende + .7, z1.ende + 1.0, lt) * (1 - smooth(z1.ende + 1.3, z1.ende + 1.6, lt));
  if (ich > 0) pov.setze({ modus: 'frei', t, zielR: k.localToWorld(V3(.22, -.42, -.3)), zielL: k.localToWorld(V3(-.06, -.16 + .08 * ich, -.2)).lerp(k.localToWorld(V3(-.25, -.45, -.3)), 1 - ich) });
  else pov.setze({ modus: 'gewehr', t, senken: .4, zielen: -.25 });
  return { welt: VF, uhr: lt < 8 ? '05:27' : '05:31', kontur: ruhig };
}

// ---------------------------------------------------------------- Tür (Ladung, Countdown, Sprengung, Treppe)
const TS = SZ('tuer'); const VERZUG = TS.verzug ?? 0;
const MARKEN = TS.marken ?? [2.6 + VERZUG, 3.3 + VERZUG, 4.0 + VERZUG];
const SPRENG = 4.9 + VERZUG;
function s_tuer(lt, t) {
  vfStandard(t);
  const { k, pov, t: tm, jet } = VF;
  stelleJet(NASE_STOP); jet.licht.forEach(l => { l.intensity = 90; }); VF.heli.g.visible = true;
  { const h = VF.heli; const hp = heliUeberJet(t); h.g.position.copy(hp.pos); h.g.rotation.copy(hp.rot); h.g.updateMatrixWorld(true); heliUpdate(h, t); suchscheinwerfer(t, 1); }
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
    2: lt < 1.9 ? [[0, 1.62, -13.1]] : [[1.9, 1.62, -13.1], [2.8, 1.9, -10.6], [zugriff, 1.9, -10.6], [zugriff + .45, 2.3, -13.05], [zugriff + .9, 1.2, -13.05], [zugriff + 1.35, .1, -13.45], [zugriff + 2.4, -.15, -15.2]],
    1: [[0, 2.2, -10.0], [zugriff + .55, 2.2, -10.0], [zugriff + 1.0, 2.3, -13.05], [zugriff + 1.7, 1.2, -13.05], [zugriff + 2.2, .15, -12.7]],
    4: [[0, 2.5, -9.4], [zugriff + 1.15, 2.5, -9.4], [zugriff + 1.7, 2.3, -13.05], [zugriff + 2.4, 1.2, -13.05], [zugriff + 2.9, -.35, -13.0]],
    7: [[0, 2.8, -8.8]],
  };
  for (const nr of [1, 2, 4, 7]) {
    const p = pfad(plan[nr], lt); const geht = p.s > .05;
    let yaw = geht ? richtung(p.vx, p.vz, -Math.PI / 2) : (nr === 2 && lt < 2.6 ? -Math.PI / 2 : -2.75);   // Stack: alle schauen zur Tür
    const duck = d > -.1 && d < 1.3 ? Math.sin(clamp((d + .1) / 1.4) * Math.PI) : 0;
    let P = geht ? gehPose(p.dist / .65 * Math.PI, { hocke: .2, arme: false }) : hockPose(.45);
    P.rumpf = [.25 + .12 * duck, 0, 0]; P.kopf = [.1 * duck, .35 * duck, 0];   // Profis: kurz wegdrehen, nicht zusammensacken
    if (d > 1 && p.x < TUER_X + .55 && Math.abs(p.z - TUER_Z) < .9) { P.rumpf = [.75, 0, 0]; P.kopf = [-.2, 0, 0]; P.beinL = [(P.beinL?.[0] ?? 0) + .3, (P.beinL?.[1] ?? 0) + .5]; P.beinR = [(P.beinR?.[0] ?? 0) + .3, (P.beinR?.[1] ?? 0) + .5]; }   // Ducken durch die niedrige Jet-Tür
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
    else { tm[nr].haltGewehr(lt > zugriff ? 'anschlag' : 'tief'); if (nr === 2) schildHand(tm[2]); }
  }
  // Ladung (kleines Paket mit blinkender LED) am Türgriff
  if (!VF.ladung) { const g = new THREE.Group(); g.add(at(box(.06, .14, .2, mat(0x2b2d31)), 0, 0, 0)); VF.ledM = mat(0xff2020, { e: 0xff2020, ei: 4 }); g.add(at(sph(.012, VF.ledM), .035, .04, 0)); VF.s.add(g); VF.ladung = g; }
  VF.ladung.visible = lt > 1.0 && d < 0; VF.ladung.position.copy(latch).add(V3(.04, 0, 0)); VF.ledM.emissiveIntensity = Math.floor(t * 4) % 2 ? 6 : .5;
  // Kamera
  // Kamera: geduckt vorne an der Nase – Tür, Rumpf bis zum Leitwerk, Heli mit Suchscheinwerfer dahinter; beim Countdown langsamer Push-in
  const push = smooth(MARKEN[0] - 1.2, SPRENG, lt);
  let pos = V3(lerp(6.6, 5.1, push), lerp(1.05, 1.2, push), lerp(-7.6, -9.4, push)), ziel = V3(.6, 2.6, TUER_Z - 1.6);
  if (lt > MARKEN[0] - .7 && lt < SPRENG - .3) ziel.lerp(weltPos(tm[1].j.haL).add(V3(0, .1, 0)), .45 * smooth(MARKEN[0] - .7, MARKEN[0] - .2, lt));
  const sh = d > 0 ? .1 * Math.exp(-3 * d) : 0;
  // Kamera-Lauf endet genau dort, wo die Kabinen-Szene beginnt
  if (lt > zugriff + 1.8) { const p = pfad([[zugriff + 1.8, 5.1, -9.4], [Math.max(zugriff + 2.6, SZ('tuer').d), 2.6, -13.05]], lt); pos = V3(p.x, 1.55 + rampeH(p.x) * 0, p.z); ziel = V3(1.0, 2.6, TUER_Z); }
  pos.add(wackel(t, sh));
  schau(k, pos, ziel);
  const duckIch = d > -.1 && d < 1.2 ? Math.sin(clamp((d + .1) / 1.3) * Math.PI) : 0;
  k.rotation.y += .1 * duckIch; k.updateMatrixWorld(true);
  pov.setze({ modus: 'gewehr', t, lauf: lt > zugriff + 2.0 ? .8 : .1, zielen: lt > zugriff ? .1 : -.25 });
  return { welt: VF, uhr: '05:32', blitz: d >= 0 && d < .2 ? (1 - d / .2) * .7 : 0 };
}

// ---------------------------------------------------------------- Kabine
// Handschelle wirklich ums Handgelenk: Ring senkrecht zum Unterarm, knapp über der Hand
function ringAnsGelenk(ring, f, n) {
  const e = weltPos(f.j['el' + n]), h = weltPos(f.j['ha' + n]); const dir = h.clone().sub(e).normalize();
  ring.position.copy(h).addScaledVector(dir, .015);
  ring.quaternion.setFromUnitVectors(V3(0, 0, 1), dir);
}
function s_kabine(lt, t) {
  vfStandard(t);
  VF.jet.kabinenLichter.forEach(l => { l.visible = true; });
  const { k, pov, t: tm, jet, gorilla, schellen } = VF;
  stelleJet(NASE_STOP); jet.licht.forEach(l => { l.intensity = 0; }); VF.heli.g.visible = false;
  jet.pivot.rotation.z = -2.59;
  tm[7].root.visible = false;
  const zP = L('kabine', 'Nicht'), zPol = L('kabine', 'POLIZEI'), tackle = zPol.ende + .95;   // Leibwächter springt sofort nach dem Zuruf auf uns zu
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
    schellen.ringL.position.copy(weltPos(tm[2].j.haR)); schellen.ringR.position.copy(weltPos(tm[2].j.haR).add(V3(.05, 0, 0)));
    for (const ring of [schellen.ringL, schellen.ringR]) { ring.lookAt(k.position); }
    if (nach > zu) ringAnsGelenk(schellen.ringL, gorilla, 'L');
    if (nach > zu + .3) ringAnsGelenk(schellen.ringR, gorilla, 'R');
    const m = schellen.ringL.position.clone().add(schellen.ringR.position).multiplyScalar(.5);
    schellen.kette.position.copy(m); schellen.kette.scale.y = Math.max(.02, schellen.ringL.position.distanceTo(schellen.ringR.position) - .07);
    schellen.kette.quaternion.setFromUnitVectors(V3(0, 1, 0), schellen.ringR.position.clone().sub(schellen.ringL.position).normalize());
  }
  // Team 2 und 1
  VF.schild2.visible = nach < .2;   // Schild fällt beim Tackle zur Seite (lehnt dann am Sitz)
  VF.schildAb.visible = nach >= .2; VF.schildAb.position.set(-.38, 1.5, -15.05); VF.schildAb.rotation.set(-.25, Math.PI / 2, 0);
  if (nach < 0) {
    tm[2].pose({ beinL: [.25, .3], beinR: [-.2, .3], rumpf: [.2, 0, 0], mund: redet('kabine', lt, '2') });
    tm[2].platziere(-.2, -15.3, Math.PI, { boden: 1.5 }); tm[2].haltGewehr('anschlag'); schildHand(tm[2]);
  } else {
    const kk = smooth(0, .45, nach);
    tm[2].pose({ beinL: [1.4 * kk, 2.0 * kk], beinR: [.2 + .6 * kk, 1.8 * kk], rumpf: [.45 + .4 * kk, 0, 0], kopf: [.2, 0, 0], armL: [1.3, .2], ellL: .4, armR: [1.3, .2], ellR: .4, mund: redet('kabine', lt, '2') });
    tm[2].platziere(lerp(-.2, -.44, kk), lerp(-15.3, -16.5, kk), lerp(Math.PI, Math.PI / 2, kk), { boden: 1.5 }); tm[2].ohneGewehr();
    if (nach > .45) {
      const druck = .015 * Math.sin(nach * 9) * (nach < 1.6 ? 1 : .3);
      const schulter = gorilla.j.chest.localToWorld(V3(.1, .16, -.16 - druck)), ruecken = gorilla.j.chest.localToWorld(V3(-.08, .02, -.15 - druck));
      tm[2].greife('L', schulter, tm[2].lokal(.6, 1.4, -.2));
      tm[2].greife('R', nach > 1.6 ? weltPos(gorilla.j.haL).add(gorilla.j.hips.localToWorld(V3(0, 0, -.06)).sub(weltPos(gorilla.j.hips))) : ruecken, tm[2].lokal(-.6, 1.4, -.2));
    }
  }
  { const tritt = smooth(.15, .4, lt) * (1 - smooth(.5, .8, lt)), auf = clamp((lt - .4) / .25);
    jet.cockpitTuer.rotation.y = -1.05 * (auf < 1 ? easeOut(auf) : 1 + .06 * Math.exp(-6 * (lt - .65)) * Math.sin((lt - .65) * 25));   // Tür fliegt auf, federt am Sitz zurück
    tm[1].pose({ beinL: [.35, .5], beinR: [-.05 + 1.3 * tritt, .45 - .35 * tritt], rumpf: [.3 - .2 * tritt, 0, 0], kopf: [-.15, 0, 0] }); tm[1].platziere(-.12, -12.85, .1, { boden: 1.5 }); tm[1].haltGewehr('anschlag'); }
  tm[4].pose({ beinL: [.35, .5], beinR: [-.05, .45], rumpf: [.3, 0, 0], kopf: [0, 0, 0], mund: redet('kabine', lt, '4') }); tm[4].platziere(-.4, -13.3, .35, { boden: 1.5 }); tm[4].haltGewehr('anschlag');
  // Tablet auf Sitz 1A
  const sitz1A = V3(-.55, 1.5 + .52, -14.3);
  const zT = L('kabine', 'Sitz 1A');
  const greift = smooth(zT.start + 1.0, zT.start + 1.9, lt), hebt = smooth(zT.start + 1.9, zT.ende + .15, lt);
  VF.tablet.visible = true;
  zeichneTablet(lt < zT.start ? -1 : 0, t);
  // Kamera ohne Sprünge: Treppe hoch, geduckt durch die Tür, Blick ins Cockpit → (Leibwächter springt auf) weicher Schwenk nach hinten → Festnahme → Tablet
  const zT0 = zT.start;
  const steig = pfad([[0, 2.6, -13.05], [.75, 1.3, -13.05], [1.25, .45, -13.35], [1.7, .2, -13.75], [tackle + .1, .14, -13.9], [tackle + 1.1, .1, -15.55], [zT0 - .9, .1, -15.55], [zT0 + .2, .05, -13.7]], lt);
  const boden = steig.x > TUER_X ? rampeH(steig.x) : 1.5;
  const duck = steig.x > .5 && steig.x < 1.45 ? .22 * Math.sin((steig.x - .5) / .95 * Math.PI) : 0;   // unter dem Türrahmen ducken
  const pos = V3(steig.x, boden + 1.55 - duck + Math.sin(steig.dist / .6 * Math.PI) * .03 * clamp(steig.s), steig.z);
  const zA = L('kabine', 'Bitte'), zW = L('kabine', 'Wo ist'), zF = L('kabine', 'Ihr Flug');
  let ziel = V3(1.0, 2.6, TUER_Z).lerp(V3(.2, 2.55, -11.6), smooth(.3, 1.3, lt));                     // von der Tür (Ende Tür-Szene) weich ins Cockpit: 4 brüllt den Piloten an
  ziel.lerp(weltPos(gorilla.j.chest), smooth(zPol.ende - .25, zPol.ende + .45, lt));                  // er springt auf – wir schwenken mit
  ziel.lerp(weltPos(gorilla.j.hips).add(V3(0, .1, 0)), smooth(tackle + .3, tackle + 1.0, lt));        // Festnahme am Boden
  ziel.lerp(kopfW(tm[2]), .7 * Math.max(fenster(zA, lt, .35, .3), fenster(zW, lt, .35, .3)));
  ziel.lerp(sitz1A, smooth(zT.start - .5, zT.start + .4, lt));                                        // Sitz 1A: das Tablet
  ziel.lerp(V3(0, 2.6, -16.5), hebt);                                                                 // Tablet hoch vors Gesicht (= Start der Twist-Szene)
  schaueAn(tm[2], k.position, Math.max(fenster(zA, lt, .1, .2), fenster(zW, lt, .1, .3))); nicken(tm[2], 'kabine', lt, '2');
  schaueAn(tm[2], weltPos(gorilla.j.head), fenster(zF, lt) * .9);
  schaueAn(tm[4], weltPos(VF.pilot.j.head), 1); nicken(tm[4], 'kabine', lt, '4'); schaueAn(VF.pilot, kopfW(tm[4]), fenster(zPol, lt, .1, .4));
  schau(k, pos.add(wackel(t, nach > 0 && nach < .5 ? .03 : 0)), ziel);
  // Tablet: liegt flach → wird gegriffen → gleitet (Position + Drehung weich) in die Halteposition der Twist-Szene
  const flach = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const halten = k.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.12, 0, 0)));
  VF.tablet.position.copy(sitz1A.clone().lerp(k.localToWorld(V3(0, -.06, -.4)), easeInOut(hebt)));
  VF.tablet.quaternion.copy(flach).slerp(halten, easeInOut(hebt)); VF.tablet.updateMatrixWorld(true);
  const griffR = VF.tablet.localToWorld(V3(.14, -.02, 0)), griffL = VF.tablet.localToWorld(V3(-.14, -.02, 0));
  if (greift > 0) pov.setze({ modus: 'frei', t, zielR: k.localToWorld(V3(.25, -.4, -.35)).lerp(griffR, greift), zielL: hebt > .05 ? k.localToWorld(V3(-.25, -.45, -.3)).lerp(griffL, smooth(.05, .5, hebt)) : null });
  else pov.setze({ modus: 'gewehr', t, lauf: lt < 1.7 ? .7 : .1, zielen: .1 + .1 * smooth(0, .6, lt), senken: .35 * smooth(0, .5, lt) * (1 - smooth(1.7, 2.2, lt)) + .5 * smooth(tackle, tackle + .5, lt), lampe: 12 * smooth(0, .6, lt), geste: 0 });
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
  VF.jet.kabinenLichter.forEach(l => { l.visible = true; });
  VF.jet.cockpitTuer.rotation.y = -1.05;
  VF.schild2.visible = false; VF.schildAb.visible = true; VF.schildAb.position.set(-.38, 1.5, -15.05); VF.schildAb.rotation.set(-.25, Math.PI / 2, 0);
  const { k, pov, t: tm, jet, gorilla, schellen } = VF;
  stelleJet(NASE_STOP); jet.pivot.rotation.z = -2.59; VF.heli.g.visible = false;
  tm[7].root.visible = false; tm[4].root.visible = false; tm[1].root.visible = false;
  pilotSitzt(lt, true, false);
  gorilla.pose({ armL: [0, .3], armR: [0, .3], beinL: [0, .05], beinR: [.05, .05], kopf: [-.4, .9, 0] });
  gorilla.platziere(0, -16.5, Math.PI, { kipp: [Math.PI / 2, 0], boden: 1.5 });
  const hl = gorilla.j.hips.localToWorld(V3(.06, .02, -.17)), hr = gorilla.j.hips.localToWorld(V3(-.06, .02, -.17)), pol = gorilla.j.chest.localToWorld(V3(0, .1, -.8));
  gorilla.greife('L', hl, pol); gorilla.greife('R', hr, pol);
  schellen.visible = true; ringAnsGelenk(schellen.ringL, gorilla, 'L'); ringAnsGelenk(schellen.ringR, gorilla, 'R');
  const m = schellen.ringL.position.clone().add(schellen.ringR.position).multiplyScalar(.5);
  schellen.kette.position.copy(m); schellen.kette.scale.y = Math.max(.02, schellen.ringL.position.distanceTo(schellen.ringR.position) - .07);
  schellen.kette.quaternion.setFromUnitVectors(V3(0, 1, 0), schellen.ringR.position.clone().sub(schellen.ringL.position).normalize());
  const z2 = L('twist', 'Gibt');
  const hungrig = lt > z2.start - .2;
  tm[2].pose({ beinL: [1.4, 2.0], beinR: [.8, 1.8], rumpf: [.4, 0, 0], kopf: [hungrig ? -.5 : .3, 0, 0], mund: redet('twist', lt, '2'), armL: [1.3, .2], ellL: .4, armR: [1.3, .2], ellR: .4 });
  tm[2].platziere(-.44, -16.5, Math.PI / 2, { boden: 1.5 }); tm[2].ohneGewehr();
  const senk = smooth(z2.start - .5, z2.start + .2, lt);
  schau(k, V3(.05, 3.05, -13.7), V3(0, 2.6 - .6 * senk, -16.5));
  const vor = k.localToWorld(V3(0, -.06 - .32 * senk, -.4 + .05 * senk));
  VF.tablet.visible = true; VF.tablet.position.copy(vor); VF.tablet.quaternion.copy(k.quaternion); VF.tablet.rotateX(-.12 - .7 * senk);
  const xEnde = L('twist', 'Wir sehen').ende;
  zeichneTablet(lt < .7 ? 0 : lt < L('twist', 'Wir sehen').start + .4 ? 1 : 2, t, lt);
  pov.setze({ modus: 'frei', t, zielL: VF.tablet.localToWorld(V3(-.14, -.02, 0)), zielR: VF.tablet.localToWorld(V3(.14, -.02, 0)) });
  const d = SZ('twist').d;
  return { welt: VF, uhr: '05:34', ende: lt > d - 3.0 ? lt - (d - 3.0) : null };
}

// ---------------------------------------------------------------- Hook
function s_hook(lt, t) {
  // 0–1,3 s: Abseilen im Sturzflug auf den rollenden Jet zu → Schnitt mit Blitz → Sprengung → Freeze → Zurückspulen
  const schnitt = 1.3, freeze = 2.9, sp = lt > 3.7 ? (lt - 3.7) / .9 : 0;
  if (lt < schnitt) { const r = s_anflug(AB0 + 4.25 + lt, SZ('anflug').start + AB0 + 4.25 + lt); return { ...r, titel: true, blitz: lt > schnitt - .12 ? (lt - (schnitt - .12)) / .12 : 0 }; }
  const a = SPRENG - .15, zl = lt < freeze ? a + (lt - schnitt) : (sp > 0 ? a + (freeze - schnitt) - sp * 2.2 : a + (freeze - schnitt));
  const r = s_tuer(zl, SZ('tuer').start + zl);
  return { ...r, blitz: Math.max(r.blitz ?? 0, lt < schnitt + .1 ? 1 - (lt - schnitt) / .1 : 0), sat: lt > freeze ? .15 : 1, mitte: lt > freeze + .15 ? { text: 'Wie es dazu kam?', k: lt - freeze - .15 } : null, spulen: sp > 0 ? 1 : 0, titel: lt < 2.6 };
}

// ======================================================================= UI + Hauptschleife
const ui = {
  sub: document.getElementById('sub'), wer: document.getElementById('wer'), txt: document.getElementById('txt'),
  rec: document.getElementById('rec'), mic: document.getElementById('mic'), nachricht: document.getElementById('nachricht'), uhr: document.getElementById('uhr'), karte: document.getElementById('karte'),
  mitte: document.getElementById('mitte'), ende: document.getElementById('ende'), zeit: document.getElementById('zeitsprung'), titel: document.getElementById('titel'),
};
function zeigeUI(n, lt, r, t) {
  const z = zeile(n, lt);
  if (z) { const [name, farbe] = TL.sprecher[z.wer]; ui.sub.style.opacity = clamp((lt - z.start) / .12) * clamp((z.ende - lt) / .12); ui.wer.textContent = name; ui.wer.style.color = farbe; ui.txt.textContent = z.text; ui.txt.style.color = z.wer === '6' ? '#80ed99' : (z.funk ? '#ffd166' : '#ffffff'); }
  else ui.sub.style.opacity = 0;
  ui.uhr.textContent = `${r.uhr ?? '05:30'}:${String(Math.floor(lt) % 60).padStart(2, '0')}`;
  ui.rec.style.opacity = Math.floor(t * 2) % 2 ? 1 : .25;
  { const N = NACHRICHT[n]; const k = N ? clamp((lt - N[0]) / .3) * clamp((N[1] - lt) / .3) : 0;   // Handy-/Eilmeldungs-Karte oben (wie im Referenz-Stil)
    ui.nachricht.style.opacity = k; if (N) { ui.nachricht.querySelector('em').textContent = N[2]; ui.nachricht.querySelector('span').textContent = N[3]; ui.nachricht.style.transform = `translateY(${(1 - easeOut(clamp((lt - N[0]) / .4))) * -140}px)`; } }
  // Bodycam-Mikro: Pegel springt, wenn geredet wird – bei MIR (6) voll, bei anderen schwächer; Funk-Lampe bei Funksprüchen
  { const ich = z && z.wer === '6', pegel = z ? (ich ? 1 : z.funk ? .75 : .5) * (0.35 + .65 * Math.abs(Math.sin(lt * 13 + 1.3 * Math.sin(lt * 5)))) : .08 + .05 * Math.abs(Math.sin(t * 3));
    ui.mic.querySelectorAll('i').forEach((b, i) => { const an = pegel * 6 > i; b.style.height = (6 + i * 5) + 'px'; b.style.opacity = an ? 1 : .25; b.style.background = i > 4 ? '#ff4d6d' : i > 3 ? '#ffd166' : '#80ed99'; });
    ui.mic.querySelector('b').classList.toggle('an', !!(z && z.funk)); }
  if (r.karte) { ui.karte.style.opacity = clamp(r.karte.k * 4) * clamp((3.6 - r.karte.k) * 3); ui.karte.querySelector('b').textContent = r.karte.o; ui.karte.querySelector('span').textContent = r.karte.u; ui.karte.style.transform = `translateX(${(1 - easeOut(r.karte.k / .4)) * -600}px)`; }
  else ui.karte.style.opacity = 0;
  if (r.mitte) { ui.mitte.style.opacity = clamp(r.mitte.k * 5); ui.mitte.textContent = r.mitte.text; ui.mitte.style.transform = `scale(${.8 + .2 * easeBack(r.mitte.k / .3)})`; } else ui.mitte.style.opacity = 0;
  ui.titel.style.opacity = r.titel ? 1 : 0;
  if (r.ende !== null && r.ende !== undefined) { ui.ende.style.opacity = clamp(r.ende * 3); ui.ende.querySelector('.berg').style.transform = `translateY(${(1 - easeOut(r.ende / .6)) * 80}px)`;
    const tip = (el, t0) => { const k = r.ende - t0; el.style.opacity = clamp(k * 4); el.style.transform = `scale(${k < 0 ? .5 : .8 + .2 * easeBack(k / .35) + .06 * Math.sin(r.ende * 9) * (k > .4 ? 1 : 0)})`; };
    tip(ui.ende.querySelector('.like'), .7); tip(ui.ende.querySelector('.folgen'), 1.1);
    ui.ende.querySelector('.like').classList.toggle('an', r.ende > 1.0); ui.ende.querySelector('.folgen').classList.toggle('an', r.ende > 1.5); }
  else ui.ende.style.opacity = 0;
}
const SZENEN = { hook: s_hook, hq: s_hq, dach: s_dach, flug: s_flug, anflug: s_anflug, tuer: s_tuer, kabine: s_kabine, twist: s_twist };
const KARTE = {};
const NACHRICHT = { dach: [.3, 3.6, 'ZENTRALE → FALKE · 05:16', 'Sofort aufs Dach. Der Heli wartet.'], anflug: [.5, 4.4, 'EILMELDUNG · Flughafen Ost', 'Privatjet rollt ohne Startfreigabe – Polizei ist unterwegs!'] };
function szeneRendern(i, lt, ziel) {
  const s = TL.szenen[i]; const r = SZENEN[s.n](lt, s.start + lt);
  if (KARTE[s.n] && lt < 4) r.karte = { o: KARTE[s.n][0], u: KARTE[s.n][1], k: lt };
  POST.rendere(r.welt.s, r.welt.k, ziel); return r;
}
window.renderFrame = async (t) => {
  Figur.zeit = t;
  let i = 0; TL.szenen.forEach((s, k) => { if (t >= s.start) i = k; });
  const s = TL.szenen[i], lt = t - s.start, tr = s.tr, trd = s.trd ?? .5;
  let r, post = {}, weiss = 0;
  if (i > 0 && tr && lt < trd) {
    szeneRendern(i - 1, TL.szenen[i - 1].d + lt, POST.a); r = szeneRendern(i, lt, POST.b);
    const p = lt / trd;
    if (tr === 'schwarz' || tr === 'uhr') post = { modus: 1, p: p < .5 ? 0 : 1, schwarz: 1 - Math.abs(p - .5) * 2 };
    else if (tr === 'weiss') { post = { modus: 1, p: p < .5 ? 0 : 1 }; weiss = 1 - Math.abs(p - .5) * 2; }   // Weißblende (durch die Wolke)
    else post = { modus: UEBERGANG[tr], p, fokus: [.5, .55] };
    ui.zeit.style.opacity = tr === 'uhr' ? Math.sin(Math.PI * p) : 0;
    if (tr === 'uhr') { ui.zeit.querySelector('.zeiger').style.transform = `rotate(${p * 1080}deg)`; ui.zeit.querySelector('.std').style.transform = `rotate(${p * 160}deg)`; ui.zeit.querySelector('b').textContent = s.karte; }
  } else { r = szeneRendern(i, lt, POST.a); ui.zeit.style.opacity = 0; }
  POST.fertig({ ...post, kontur: r.kontur ?? 1, zeit: t, blitz: Math.max(r.blitz ?? 0, weiss), sat: r.sat ?? 1, spulen: r.spulen ?? 0, rot: r.rot ?? 0 });
  zeigeUI(s.n, lt, r, t);
  await new Promise(res => requestAnimationFrame(() => res()));
};
window.dauer = TL.dauer; window.__VF = VF; window.__THREE = THREE; window.__DACH = DACH;
window.bereit = true;
