// EINHEIT FALKE – Einsatz 01: Lagerhaus 7 (3D, nur POV).
import {
  THREE, W, H, mat, box, cyl, sph, at, bodenPlatte, clamp, lerp, easeOut, easeInOut, easeBack, smooth,
  ziegelTex, betonTex, rolltorTex, holzTex, liveTex, weltPos, rng, textTex,
} from '/tools/einsatz3d/kern.js';
import { Figur, gehPose, rennPose, hockPose, stehPose, schildModell, handschellenModell, ik } from '/tools/einsatz3d/figur.js';
import {
  renderer, Post, UEBERGANG, nachtLicht, Regen, Explosion, Schwaden, wurf3, lampe, container, palette, fass, kran,
  pfuetze, schild, hauptquartier, zeichneFensterRegen, vanInnen, zeichneStrasse,
} from '/tools/einsatz3d/welt.js';
import { Pov } from '/tools/einsatz3d/pov.js';

const TL = await (await fetch('./timeline_fertig.json')).json();
const R = renderer();
const POST = new Post(R);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- Hilfen
function kamera(szene, fov = 74) {
  const k = new THREE.PerspectiveCamera(fov, W / H, 0.03, 200);
  k.rotation.order = 'YXZ';
  szene.add(k);
  return k;
}
function schau(k, pos, ziel, roll = 0) {
  k.position.copy(pos);
  const d = ziel.clone().sub(pos);
  k.rotation.set(Math.atan2(d.y, Math.hypot(d.x, d.z)), Math.atan2(-d.x, -d.z), roll);
  k.updateMatrixWorld(true);
}
// Wegpunkte [[t, x, z], ...] -> Position, Richtung, zurückgelegte Strecke
function pfad(keys, t) {
  let dist = 0;
  if (t <= keys[0][0]) return { x: keys[0][1], z: keys[0][2], vx: 0, vz: 0, s: 0, dist: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0, z0] = keys[i], [t1, x1, z1] = keys[i + 1];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return { x: lerp(x0, x1, k), z: lerp(z0, z1, k), vx: (x1 - x0) / (t1 - t0), vz: (z1 - z0) / (t1 - t0), s: seg / (t1 - t0), dist: dist + seg * k };
    }
    dist += seg;
  }
  const l = keys[keys.length - 1];
  return { x: l[1], z: l[2], vx: 0, vz: 0, s: 0, dist };
}
const richtung = (vx, vz, sonst) => (Math.hypot(vx, vz) > 0.05 ? Math.atan2(vx, vz) : sonst);
function zeile(n, lt) {
  let a = null;
  for (const z of TL.dialog) if (z.szene === n && lt >= z.start && lt < z.ende) a = z;
  return a;
}
const redet = (n, lt, wer) => { const z = zeile(n, lt); return z && (z.wer === wer || z.wer === wer + 'v') ? 0.35 + 0.5 * Math.abs(Math.sin(lt * 17)) : 0; };

// ---------------------------------------------------------------- Figuren-Fabrik
const TEAM_OPS = { 1: { headset: true, groesse: 1.86 }, 2: { groesse: 1.98, visier: true }, 4: { groesse: 1.72, visier: true }, 7: { groesse: 1.76, headset: true } };
function teamOps(szene, nr) { const f = new Figur({ art: 'team', nummer: nr, maske: true, helm: true, ...TEAM_OPS[nr] }); szene.add(f.root); return f; }
const ZIVIL = {
  1: { haut: 0xe0ac69, haare: true, haarfarbe: 0x9a9a9a, bart: 0xa5a5a5, groesse: 1.86 },
  2: { haut: 0x7a4a2a, groesse: 1.98 },
  4: { haut: 0xf1c27d, haare: true, haarfarbe: 0x6f1d1b, dutt: true, groesse: 1.72 },
  7: { haut: 0xffdbac, haare: true, haarfarbe: 0x5b3a29, brille: true, groesse: 1.76 },
};
function teamHq(szene, nr) {
  const f = new Figur({ art: 'zivil', jacke: 0x2e3440, hose: 0x262a31, schuh: 0x16181b, rueckenNr: true, nummer: nr, ...ZIVIL[nr] });
  szene.add(f.root); return f;
}
function sitzen(f, x, z, yaw, extra = {}) {
  f.pose({ beinL: [1.5, 1.5], beinR: [1.45, 1.55], rumpf: [0.05, 0, 0], ...extra });
  f.platziere(x, z, yaw, { hoehe: 0.5 - 0.98 * f.root.scale.x + 0.04 });
}

// ======================================================================= WELT 1: Hauptquartier
const HQ = (() => {
  const s = new THREE.Scene();
  const hq = hauptquartier(s);
  const k = kamera(s, 74);
  const pov = new Pov(k, { aermel: 0x2e3440, handschuhe: false });
  const t = { 1: teamHq(s, 1), 2: teamHq(s, 2), 4: teamHq(s, 4), 7: teamHq(s, 7) };
  const chefin = new Figur({ art: 'chefin', jacke: 0x5c636e, hose: 0x3a3f47, schuh: 0x111111, haare: true, haarfarbe: 0xe9ecef, dutt: true, brille: true, haut: 0xf1c9a5, groesse: 1.7 });
  s.add(chefin.root);
  const sandwich = new THREE.Group();
  sandwich.add(at(box(.16, .03, .1, mat(0xe9c46a)), 0, 0, 0)); sandwich.add(at(box(.15, .015, .095, mat(0x52b788)), 0, .02, 0));
  sandwich.add(at(box(.16, .03, .1, mat(0xe9c46a)), 0, .04, 0)); s.add(sandwich);
  const tasse1 = at(cyl(.045, .04, .11, mat(0xf1f3f5)), 0, 0, 0); s.add(tasse1);
  const helmRand = at(box(.6, .06, .05, mat(0x15171a)), 0, .14, -.16); k.add(helmRand);
  return { s, hq, k, pov, t, chefin, sandwich, tasse1, helmRand };
})();

function zeichneSchirm(modus, lt, t) {
  const g = HQ.hq.schirm.ctx, w = 1600, h = 900;
  if (modus === 'alarm') {
    g.fillStyle = `rgb(${120 + 100 * Math.abs(Math.sin(t * 6))},10,20)`; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = 'bold 260px DejaVu Sans'; g.textAlign = 'center'; g.fillText('EINSATZ', w / 2, 470);
    g.font = 'bold 80px DejaVu Sans'; g.fillStyle = '#ffd166'; g.fillText('HAFEN NORD · SOFORT', w / 2, 640);
  } else if (modus === 'logo') {
    g.fillStyle = '#0b132b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#80ed99'; g.beginPath(); g.moveTo(800, 170); g.lineTo(1010, 420); g.lineTo(800, 330); g.lineTo(590, 420); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 150px DejaVu Sans'; g.textAlign = 'center'; g.fillText('FALKE', w / 2, 600);
    g.font = '40px DejaVu Sans'; g.fillStyle = '#8d99ae'; g.fillText('LAGEZENTRUM · BEREIT', w / 2, 700);
  } else {
    g.fillStyle = '#10213a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a4d7a'; g.fillRect(0, 560, w, 340);
    for (let i = 0; i < 5; i++) { g.fillStyle = i === 1 ? '#e63946' : '#a8dadc'; g.fillRect(90 + i * 260, 300, 210, 190);
      g.fillStyle = '#10213a'; g.font = 'bold 90px DejaVu Sans'; g.textAlign = 'center'; g.fillText(String(5 + i), 195 + i * 260, 430); }
    for (let x = 120; x < w; x += 170) { g.fillStyle = '#a8dadc'; g.fillRect(x, 560, 50, 160); }
    const p = (lt * 1.2) % 1; g.strokeStyle = `rgba(255,60,70,${1 - p})`; g.lineWidth = 12; g.beginPath(); g.arc(455, 395, 130 + 80 * p, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 64px DejaVu Sans'; g.textAlign = 'left'; g.fillText('HAFEN NORD · LAGERHAUS 7', 60, 110);
    if (lt > 3.4) {
      const k = clamp((lt - 3.4) / .4); g.globalAlpha = k;
      g.fillStyle = '#f1faee'; g.fillRect(1080, 150, 440, 560);
      g.fillStyle = '#343a40'; g.beginPath(); g.arc(1300, 330, 110, 0, Math.PI * 2); g.fill(); g.fillRect(1170, 440, 260, 180);
      g.fillStyle = '#ff9f1c'; g.font = 'bold 150px DejaVu Sans'; g.textAlign = 'center'; g.fillText('?', 1300, 385);
      g.fillStyle = '#e63946'; g.font = 'bold 56px DejaVu Sans'; g.fillText('„DER FUCHS“', 1300, 680); g.globalAlpha = 1;
    }
    if (lt > 8.3) { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 0, w, h); g.fillStyle = '#ef476f'; g.font = 'bold 120px DejaVu Sans'; g.textAlign = 'center';
      g.fillText('PLAN B:', w / 2, 360); g.font = 'bold 300px DejaVu Sans'; g.fillText('2', w / 2, 700); }
  }
  HQ.hq.schirm.tex.needsUpdate = true;
}
function zeichneLaptop(t) {
  const g = HQ.hq.laptopSchirm.ctx; g.fillStyle = '#0b132b'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#80ed99'; g.font = '18px DejaVu Sans Mono';
  for (let i = 0; i < 12; i++) g.fillText('> ' + Math.floor(Math.abs(Math.sin(i * 7 + Math.floor(t * 4))) * 1e8).toString(16), 12, 26 + i * 24);
  HQ.hq.laptopSchirm.tex.needsUpdate = true;
}
function hqGemeinsam(t, alarm) {
  zeichneFensterRegen(HQ.hq.fenster, t);
  zeichneLaptop(t);
  HQ.hq.alarm.intensity = alarm ? 60 : 0;
  HQ.hq.alarmLampe.material.emissiveIntensity = alarm ? 2 + Math.sin(t * 20) : 0;
  HQ.hq.alarm.target.position.set(Math.sin(t * 6) * 6, 0, -5 + Math.cos(t * 6) * 6);
  HQ.helmRand.visible = false;
  HQ.chefin.root.visible = false;
  for (const nr of [1, 2, 4, 7]) HQ.t[nr].root.visible = true;
  HQ.sandwich.visible = true; HQ.tasse1.visible = true; HQ.hq.helm6.visible = true;
  for (const sp of Object.values(HQ.hq.spinde)) sp.rotation.y = 0;
}

function s_hq(lt, t) {
  const alarm = lt >= 6.9;
  zeichneSchirm(alarm ? 'alarm' : 'logo', lt, t);
  hqGemeinsam(t, alarm);
  const { k, pov, t: tm } = HQ;
  const hin = smooth(6.9, 7.5, lt);
  schau(k, V3(0.1 + .01 * Math.sin(t * .7), 1.22 + .005 * Math.sin(t * 1.6), 0.05), V3(lerp(0.05, 0, hin), lerp(1.05, 1.6, hin), -3.6));
  // 2 sitzt gegenüber und isst
  const biss = alarm ? 0 : Math.max(0, Math.sin(lt * 2.3));
  sitzen(tm[2], -0.5, -2.65, 0, { kopf: [alarm ? -.25 : .1, alarm ? -.2 : 0, 0], mund: redet('hq', lt, '2') || (biss > .7 ? .6 : .1), armL: [.6, .1], ellL: 1.4 });
  const mund2 = tm[2].lokal(0, 1.52, .2);
  const tisch2 = tm[2].lokal(.05, .82, .45);
  const sw = alarm ? tm[2].lokal(-.12, 1.25, .35) : tisch2.clone().lerp(mund2, biss);
  tm[2].greife('R', sw, tm[2].lokal(-.5, .5, -.3));
  tm[2].greife('L', tm[2].lokal(.18, .82, .42), tm[2].lokal(.6, .5, -.3));
  HQ.sandwich.position.copy(weltPos(tm[2].j.haR)).add(V3(0, -.06, .04));
  // 7 tippt am Laptop
  sitzen(tm[7], 0.6, -2.65, 0, { kopf: [alarm ? -.3 : .35, alarm ? .2 : 0, 0], mund: redet('hq', lt, '7') });
  for (const [n, dx] of [['L', .1], ['R', -.1]]) tm[7].greife(n, V3(0.6 + dx, .84 + (alarm ? .2 : .02 * Math.abs(Math.sin(t * 14 + dx * 30))), -1.95), tm[7].lokal(dx * 6, .4, -.4));
  // 4 sitzt links, Arme verschränkt
  tm[4].pose({ ...stehPose(t + 2), kopf: [0, alarm ? .5 : .3, 0], mund: redet('hq', lt, '4'), armL: [.9, -.2, .4], ellL: 1.9, armR: [.9, -.2, .4], ellR: 1.9, beinL: [.1, .05], beinR: [-.25, .3] });
  tm[4].platziere(-1.35, -3.7, .35);
  // 1 steht am Bildschirm mit Kaffee
  tm[1].pose({ ...stehPose(t), kopf: [0, alarm ? .6 : -.2, 0], mund: redet('hq', lt, '1'), armR: [.9, .1], ellR: 1.6 });
  tm[1].platziere(1.45, -4.3, -.4);
  HQ.tasse1.position.copy(weltPos(tm[1].j.haR)).add(V3(0, .02, .03));
  pov.setze({ modus: 'tasse', t, zielL: V3(-0.25, .82, -0.75) });
  // Namensschilder (Projektion der Köpfe)
  const tags = [];
  const nt = [[1, '1 · TEAMFÜHRER', 'Hatte nie Urlaub.'], [2, '2 · TÜRÖFFNER', 'Isst immer.'], [4, '4 · PRÄZISION & DROHNE', 'Sarkasmus inklusive.'], [7, '7 · TECHNIK', 'Angst vor Möwen.']];
  nt.forEach(([nr, a, b], i) => { const s0 = 0.3 + i * 0.9; if (lt >= s0 && lt < s0 + 0.9) tags.push({ p: projiziere(weltPos(tm[nr].j.head).add(V3(0, .3, 0)), k), a, b, f: TL.sprecher[String(nr)][1], k: lt - s0 }); });
  if (lt >= 3.9 && lt < 5.4) tags.push({ p: projiziere(weltPos(pov.tasse), k), a: '6 · DU', b: 'Der Neue. Große Klappe.', f: '#80ed99', k: lt - 3.9 });
  return { welt: HQ, tags, rot: alarm ? .25 + .25 * Math.sin(t * 9) : 0, uhr: '20:14' };
}

function s_briefing(lt, t) {
  zeichneSchirm('karte', lt, t);
  hqGemeinsam(t, false);
  const { k, pov, t: tm, chefin } = HQ;
  chefin.root.visible = true;
  schau(k, V3(0.05 + .02 * Math.sin(t * .5), 1.7, 0.4 - .04 * lt), V3(-0.2, 1.5, -5.9));
  chefin.pose({ ...stehPose(t), kopf: [0, .25, 0], mund: redet('briefing', lt, 'Z'), armL: [lt < 6 ? 1.2 + .2 * Math.sin(lt * 2) : .1, .5], ellL: .3 });
  chefin.platziere(-1.55, -5.25, .3);
  const plan = (nr, x, z) => {
    const blickZu2 = lt > 8.3 && lt < 9.6 && nr !== 2;
    const dreh2 = nr === 2 && lt > 9.7 && lt < 11.6;
    tm[nr].pose({ ...stehPose(t + nr), kopf: [0, dreh2 ? 2.3 : (blickZu2 ? (x < .4 ? -.7 : .7) : 0), 0], mund: redet('briefing', lt, String(nr)) || (dreh2 ? .3 : 0), blick: [0, 0] });
    tm[nr].platziere(x, z, Math.PI);
  };
  plan(1, -0.55, -3.3); plan(2, 0.45, -3.55); plan(4, 1.3, -3.15); plan(7, -1.25, -2.85);
  pov.setze({ modus: 'aus' });
  return { welt: HQ, uhr: '20:24' };
}

function s_spind(lt, t) {
  zeichneSchirm('logo', lt, t);
  hqGemeinsam(t, false);
  const { k, pov, t: tm, hq } = HQ;
  const z6 = -4.6 + 3 * .65;
  schau(k, V3(2.75, 1.68, z6 + .25), V3(4.5, 1.4 - .1 * smooth(0, 1, lt), z6 - 0.15));
  const tuer = hq.spinde[6];
  tuer.rotation.y = -1.8 * easeOut((lt - .3) / .5);
  // 4 setzt am Spind daneben den Helm auf
  tm[4].pose({ ...stehPose(t), armL: [2.6, .2], ellL: 1.6, armR: [2.6, .2], ellR: 1.6, kopf: [0, -.6, 0], mund: redet('spind', lt, '4') });
  tm[4].platziere(3.7, z6 - .95, Math.PI / 2 + .5);
  for (const nr of [1, 2, 7]) tm[nr].root.visible = false;
  // Helm greifen, hochheben, aufsetzen
  const helmStart = V3(4.62, 1.55, z6);
  const griff = smooth(.9, 1.4, lt), hoch = smooth(1.5, 2.2, lt);
  const kopfPunkt = k.localToWorld(V3(0, .25, .05));
  const handZiel = helmStart.clone().lerp(kopfPunkt, hoch).add(V3(-.05 * (1 - hoch), -.05, 0));
  hq.helm6.position.copy(griff > .99 ? handZiel.clone().add(V3(0, .05, 0)) : helmStart);
  hq.helm6.visible = lt < 2.15;
  HQ.helmRand.visible = lt >= 2.1;
  if (lt < 3.0) {
    const zielR = lt < .8 ? V3(4.33, 1.2, z6 - .3 + .5 * smooth(.3, .8, lt)) : k.localToWorld(V3(.35, -.45, -.3)).lerp(handZiel, griff);
    pov.setze({ modus: 'frei', t, zielR, zielL: lt > 1.4 ? handZiel.clone().add(V3(0, 0, .15)) : null });
  } else {
    const hochkommen = smooth(3.0, 3.6, lt);
    const ruck = lt > 4.0 && lt < 4.5 ? Math.sin((lt - 4.0) / .5 * Math.PI) : 0;
    pov.setze({ modus: 'gewehr', t, senken: 1 - hochkommen, zielen: 0, ruck });
  }
  return { welt: HQ, uhr: '01:48' };
}

// ======================================================================= WELT 2: Van
const VAN = (() => {
  const s = new THREE.Scene();
  const v = vanInnen(s);
  const k = kamera(s, 76);
  const pov = new Pov(k);
  const t = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  const fahrer = new Figur({ art: 'team', helm: false, kappe: 0x22252b, nummer: '' }); s.add(fahrer.root);
  const tablet = new THREE.Group(); const ts = liveTex(512, 340);
  tablet.add(at(box(.26, .18, .015, mat(0x111111)), 0, 0, 0));
  tablet.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.24, .16), new THREE.MeshBasicMaterial({ map: ts.tex })), 0, 0, .009));
  s.add(tablet);
  return { s, v, k, pov, t, fahrer, tablet, ts };
})();

function s_van(lt, t) {
  const { k, pov, t: tm, v, fahrer } = VAN;
  const d = TL.szenen.find(x => x.n === 'van').d;
  const bremse = smooth(d - 2.2, d - 1.9, lt) * (1 - smooth(d - 1.6, d - 1.2, lt));
  const steht = lt > d - 2.0;
  const r = rng(Math.floor(t * 12));
  const ruett = steht ? 0 : 1;
  const wackel = V3((r() - .5) * .012 * ruett, (r() - .5) * .015 * ruett, 0);
  const dreh = smooth(d - 1.6, d - .7, lt);
  const kp = V3(0.62, 1.12, 1.15).add(wackel);
  if (dreh < .01) schau(k, kp, V3(-0.15, 1.1 - bremse * .25, -2.8));
  else { schau(k, kp, V3(-0.15, 1.1, -2.8)); k.rotation.y += Math.PI * .92 * easeInOut(dreh); k.updateMatrixWorld(true); }
  zeichneStrasse(v.strasse, steht ? 2.2 : t, { blau: Math.floor(t * 8) % 2 === 0 });
  v.wischer.rotation.z = .9 * Math.abs(Math.sin(t * 2.2)); v.wischer2.rotation.z = .9 * Math.abs(Math.sin(t * 2.2 + .3));
  v.blau.intensity = Math.floor(t * 8) % 2 === 0 ? 4 : 0;
  const ph = (t * .55) % 1; v.vorbei.position.set(-1.2, 1.3, lerp(-3, 3, ph)); v.vorbei.intensity = steht ? 0 : 6 * Math.sin(Math.PI * ph);
  const auf = easeOut((lt - (d - 1.3)) / .9);
  v.tueren.forEach((tg, i) => { tg.rotation.y = (i === 0 ? 1 : -1) * 1.9 * auf; });
  v.draussenLicht.intensity = 30 * auf;
  // Team sitzt auf den Bänken
  const sitz = (nr, x, z, yaw, extra = {}) => {
    const lehn = bremse * .5;
    tm[nr].pose({ beinL: [1.5, 1.55], beinR: [1.4, 1.5], rumpf: [.08 + lehn * Math.cos(yaw) * 0, 0, lehn * (yaw > 0 ? -1 : 1)], mund: redet('van', lt, String(nr)), ...extra });
    tm[nr].platziere(x, z, yaw, { hoehe: .5 - .98 * tm[nr].root.scale.x + .04 });
    tm[nr].haltGewehr('hoch');
  };
  sitz(1, -.8, -1.5, Math.PI / 2, { kopf: [lt > 8.2 ? -.1 : .2, lt > 8.2 ? .5 : 0, 0] });
  sitz(2, -.8, -.25, Math.PI / 2, { kopf: [0, redet('van', lt, '2') ? .9 : .3, 0] });
  sitz(4, .8, -1.6, -Math.PI / 2, { kopf: [.1, -.3, 0] });
  // 7 neben mir mit Tablet
  tm[7].pose({ beinL: [1.5, 1.55], beinR: [1.4, 1.5], rumpf: [.25, 0, 0], kopf: [.5 - (redet('van', lt, '7') ? .4 : 0), redet('van', lt, '7') ? -.4 : 0, 0], mund: redet('van', lt, '7') });
  tm[7].platziere(.8, -.35, -Math.PI / 2, { hoehe: .5 - .98 * tm[7].root.scale.x + .04 });
  tm[7].ohneGewehr();
  const tp = tm[7].lokal(0, 1.05, .38);
  VAN.tablet.position.copy(tp); VAN.tablet.rotation.set(-.9, -Math.PI / 2, 0, 'YXZ');
  tm[7].greife('L', tm[7].lokal(.12, 1.05, .36), tm[7].lokal(.6, .5, -.2));
  tm[7].greife('R', tm[7].lokal(-.12, 1.05, .36), tm[7].lokal(-.6, .5, -.2));
  const g = VAN.ts.ctx; g.fillStyle = '#10213a'; g.fillRect(0, 0, 512, 340); g.fillStyle = '#2a4d7a'; g.fillRect(0, 220, 512, 120);
  g.fillStyle = '#e63946'; g.fillRect(150, 120, 80, 70); g.fillStyle = '#80ed99'; g.beginPath(); g.arc(80 + (t * 30) % 300, 260, 10, 0, 7); g.fill(); VAN.ts.tex.needsUpdate = true;
  fahrer.pose({ beinL: [1.5, 1.5], beinR: [1.5, 1.5], armL: [1.2, .1], ellL: .5, armR: [1.2, .1], ellR: .5, kopf: [0, .05 * Math.sin(t), 0] });
  fahrer.platziere(-.45, -3.05, Math.PI, { hoehe: .55 - .98 * fahrer.root.scale.x });
  pov.setze({ modus: 'gewehr', t, senken: .45, zielen: -.2 });
  return { welt: VAN, uhr: '02:14' };
}

// ======================================================================= WELT 3: Hafen (Gasse + Lagerhaus 7 innen)
const HAFEN = (() => {
  const s = new THREE.Scene();
  const mond = nachtLicht(s, { nebel: [0x0e1526, 8, 70] });
  const k = kamera(s, 74);
  const pov = new Pov(k);
  const asphalt = mat(0x3a3f47, { r: .42, map: betonTex('#3a3f47', [14, 18], 'asphalt'), envI: 1 });
  s.add(bodenPlatte(70, 90, asphalt, 0, 15));
  const innenBoden = mat(0x6c6f75, { r: .6, map: betonTex('#6c6f75', [8, 10], 'hallenboden') });
  s.add(bodenPlatte(19.6, 23.6, innenBoden, 0, -12.15, .002));
  for (const [x, z, a, b] of [[-1.2, 6, 1.1, .7], [1.8, 11, 1.4, .9], [-2.5, 17, .9, .6], [.6, 24, 1.6, 1], [2.2, 2.6, .8, .5], [-1.8, 1.6, .7, .5]]) pfuetze(s, x, z, a, b);
  // Gassen-Gebäude
  const ziegelL = mat(0x8b4a2b, { r: .9, map: ziegelTex('#7a3f24', '#4a2414', [10, 4]) });
  const ziegelR = mat(0x7f4f24, { r: .9, map: ziegelTex('#6e4a2e', '#3e2a18', [10, 5]) });
  s.add(at(box(8, 10, 44, ziegelL), -8.5, 5, 24)); s.add(at(box(8, 12, 44, ziegelR), 8.5, 6, 24));
  for (const [x, ry, n] of [[-4.49, Math.PI / 2, 1], [4.49, -Math.PI / 2, 2]]) {
    for (let z = 4; z < 44; z += 3.2) {
      for (let y = 3.8; y < 10; y += 3) {
        const hell = Math.sin(z * 7 + y * 3 + n) > .55;
        s.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), mat(hell ? 0xffd27a : 0x1c2536, { e: hell ? 0xffb84d : 0, ei: hell ? 1.2 : 0, r: .2 })), x, y, z, 0, ry));
      }
      if (Math.floor(z) % 2 === 0) s.add(at(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mat(0x9aa0a6, { map: rolltorTex([1, 1]), r: .6, m: .3 })), x, 1.3, z, 0, ry));
    }
  }
  // Container, Paletten, Fässer, Mülltonne
  container(s, 3.2, 16, 0, 0x9d0208); container(s, 3.2, 23, 0, 0x264653); container(s, 3.2, 23, 0, 0xbc6c25, { y: 2.6 });
  palette(s, -3.6, 14, .3); palette(s, -3.7, 14, .2).position.y = .12; fass(s, 3.4, 9.5); fass(s, 3.9, 10.2, 0x2a9d8f);
  const tonne = new THREE.Group(); tonne.add(at(box(.9, 1.1, .7, mat(0x2d6a4f, { r: .6, m: .3 })), 0, .6, 0)); tonne.add(at(box(.95, .06, .75, mat(0x1b4332)), 0, 1.18, 0));
  for (const x of [-.35, .35]) tonne.add(at(cyl(.07, .07, .05, mat(0x111111)), x, .07, .3, 0, 0, Math.PI / 2));
  s.add(tonne);
  kran(s, -24, -45, 32); kran(s, 22, -60, 28);
  // Laternen
  const laternen = [[3.9, 7], [-3.9, 19], [3.9, 31]].map(([x, z]) => {
    s.add(at(cyl(.07, .09, 5.5, mat(0x22252b, { m: .5 })), x, 2.75, z));
    s.add(at(box(.6, .18, .3, mat(0x2b2d31)), x - Math.sign(x) * .25, 5.5, z));
    s.add(at(box(.45, .03, .2, mat(0xfff1d0, { e: 0xffd9a0, ei: 4 })), x - Math.sign(x) * .25, 5.4, z));
    const l = new THREE.PointLight(0xffd29a, 45, 20, 1.5); l.position.set(x - Math.sign(x) * .25, 5.2, z); s.add(l); return l;
  });
  // ---- Lagerhaus 7: Front bei z = 0 mit Türöffnung, Halle bis z = -24
  const wand7 = mat(0x8b4a2b, { r: .9, map: ziegelTex('#86492c', '#4e2818', [6, 3]) });
  const innenWand = mat(0x6b6158, { r: .95, map: ziegelTex('#5e544b', '#3b332c', [6, 3]) });
  s.add(at(box(9.45, 8, .3, wand7), -5.275, 4, -.15)); s.add(at(box(9.45, 8, .3, wand7), 5.275, 4, -.15));
  s.add(at(box(1.1, 5.85, .3, wand7), 0, 5.075, -.15));
  for (const [x, w] of [[-.6, .1], [.6, .1]]) s.add(at(box(w, 2.2, .36, mat(0x4a4e55, { m: .6, r: .4 })), x, 1.1, -.15));
  s.add(at(box(1.3, .1, .36, mat(0x4a4e55, { m: .6, r: .4 })), 0, 2.2, -.15));
  s.add(at(box(.3, 8, 24, innenWand), -10, 4, -12)); s.add(at(box(.3, 8, 24, innenWand), 10, 4, -12));
  s.add(at(box(20, .3, 24.3, mat(0x2b2b2f, { r: 1 })), 0, 7, -12.1));
  s.add(at(box(4.5, 8, .3, innenWand), 2.25 + 2.5, 4, -24)); s.add(at(box(14.5, 8, .3, innenWand), -2.75, 4, -24));
  s.add(at(box(1.0, 5.8, .3, innenWand), 5.0, 5.1, -24)); s.add(at(box(5.5, 8, .3, innenWand), 7.75 + .5, 4, -24));
  for (let z = -2; z > -24; z -= 4) s.add(at(box(20, .35, .25, mat(0x343a40, { m: .5 })), 0, 6.6, z));
  schild(s, '7', -2.7, 4.6, .02, 0, { w: 1.6, h: 1.6, farbe: '#f1faee', font: 'bold 220px DejaVu Sans, Arial' });
  schild(s, 'LAGER 7 · PRIVAT', 2.4, 2.6, .02, 0, { w: 1.6, h: .4, farbe: '#ffd166', grund: '#1b1d21', font: 'bold 70px DejaVu Sans, Arial' });
  s.add(at(new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.4), mat(0x9aa0a6, { map: rolltorTex([1, 3]), r: .6, m: .3 })), 6.2, 1.7, .02));
  s.add(at(cyl(.06, .06, 8, mat(0x6c757d, { m: .7 })), -1.4, 4, .1)); s.add(at(box(.5, .6, .2, mat(0x6c757d, { m: .5 })), 1.5, 1.4, .1));
  s.add(at(box(.18, .12, .25, mat(0x111111)), -1.0, 3.3, .15));                    // Kamera
  const tuerLampe = lampe(s, 0, 2.75, .35, { farbe: 0xffc98a, staerke: 30, weite: 12 });
  // Halle innen: Regale, Tisch, Päckchen, Gabelstapler, Hinterausgang
  const regal = mat(0x1d3557, { m: .5, r: .5 }), kart = mat(0xa98467, { r: .9 });
  for (const x of [-7.5, 7.5]) for (let z = -4; z > -21; z -= 5) {
    for (const y of [0.1, 1.4, 2.7]) s.add(at(box(1.2, .08, 4, regal), x, y, z));
    for (const dx of [-.55, .55]) for (const dz of [-1.9, 1.9]) s.add(at(box(.08, 3.4, .08, regal), x + dx, 1.7, z + dz));
    for (let i = 0; i < 6; i++) s.add(at(box(.9, .6, .8, kart), x, .5 + (i % 3) * 1.3, z - 1.4 + Math.floor(i / 3) * 2.2));
  }
  s.add(at(box(2.6, .08, 1.4, mat(0x6f4518, { map: holzTex([2, 1]) })), -.6, .8, -9));
  for (const [x, z] of [[-1.8, -9.6], [.6, -9.6], [-1.8, -8.4], [.6, -8.4]]) s.add(at(cyl(.04, .04, .8, mat(0x222222), 8), x, .4, z));
  const pr = rng(3);
  for (let i = 0; i < 9; i++) s.add(at(box(.28, .1, .2, mat(0xf1f3f5, { r: .8 })), -1.6 + (i % 3) * .5 + pr() * .1, .89 + Math.floor(i / 3) * .1, -9.3 + pr() * .5, 0, pr()));
  s.add(at(box(.3, .08, .25, mat(0x2a9d8f)), .3, .88, -8.7));
  const tisch2 = at(box(1.4, .08, .7, mat(0x495057)), 3.6, .78, -14.6); s.add(tisch2);
  s.add(at(box(.34, .02, .24, mat(0x9aa0a6, { m: .6 })), 3.6, .83, -14.6));
  const stapler = new THREE.Group(); stapler.add(at(box(1.1, 1.0, 1.8, mat(0xffb703, { r: .5 })), 0, .8, 0)); stapler.add(at(box(.08, 2.4, .08, mat(0x222222)), -.4, 1.2, 1.0));
  stapler.add(at(box(.08, 2.4, .08, mat(0x222222)), .4, 1.2, 1.0)); for (const [x, z] of [[-.55, -.6], [.55, -.6], [-.55, .6], [.55, .6]]) stapler.add(at(cyl(.25, .25, .2, mat(0x111111)), x, .25, z, 0, 0, Math.PI / 2));
  stapler.position.set(-5.2, 0, -16); stapler.rotation.y = .5; s.add(stapler);
  fass(s, 6.2, -20.5); fass(s, 6.8, -21.2, 0x9d0208); palette(s, -4.5, -21, .2);
  schild(s, 'NOTAUSGANG', 5.0, 2.55, -23.8, 0, { w: 1.0, h: .3, farbe: '#ffffff', grund: '#1b7f3b', font: 'bold 70px DejaVu Sans, Arial', leucht: 1.5 });
  const exitLicht = new THREE.PointLight(0x2bd46a, 4, 6, 1.5); exitLicht.position.set(5, 2.4, -23.4); s.add(exitLicht);
  const hinterTuer = new THREE.Group(); hinterTuer.position.set(4.5, 0, -24.05);
  hinterTuer.add(at(box(1.0, 2.15, .05, mat(0x5c636b, { m: .5, r: .45 })), .5, 1.075, 0)); s.add(hinterTuer);
  s.add(at(new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0x0b1020 })), 5, 1.5, -24.6));
  const hallenLichter = [[-1, -6], [2.5, -12], [-2, -18]].map(([x, z]) => {
    s.add(at(cyl(.01, .01, 1.5, mat(0x111111)), x, 6.1, z));
    s.add(at(cyl(.05, .35, .25, mat(0x2b2d31, { m: .5 })), x, 5.3, z));
    const l = new THREE.PointLight(0xffe2b0, 24, 16, 1.5); l.position.set(x, 5.05, z); s.add(l); return l;
  });
  // Tür (wird gesprengt) + Ladung
  const tuer = at(box(1.1, 2.15, .06, mat(0x5c636b, { m: .55, r: .45 })), 0, 1.075, -.15); s.add(tuer);
  const klinke = at(box(.12, .03, .05, mat(0xced4da, { m: .9, r: .3 })), .4, 1.05, -.11); s.add(klinke);
  const ladung = new THREE.Group(); ladung.add(at(box(.2, .14, .06, mat(0x2b2d31)), 0, 0, 0));
  const led = at(sph(.012, mat(0xff2020, { e: 0xff2020, ei: 4 })), .07, .04, .03); ladung.add(led); s.add(ladung);
  const expl = new Explosion(s, V3(0.05, 1.05, .1), { groesse: 1.3, richtung: V3(0, .25, 1), seed: 4 });
  const schwaden = new Schwaden(s, V3(0, 1.4, .6), 12);
  const innenSchwaden = new Schwaden(s, V3(0, 1.5, -7), 8, 7);
  const regen = new Regen(s, 1500);
  const blendg = at(cyl(.03, .03, .12, mat(0x3a3f47, { m: .6 })), 0, 0, 0); s.add(blendg);
  const blendLicht = new THREE.PointLight(0xffffff, 0, 30, 1.2); s.add(blendLicht);
  const t = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  const schild2 = schildModell(); t[2].j.elL.add(schild2); schild2.position.set(.02, -.2, .12); schild2.rotation.set(-1.4, 0, 0);
  const g1 = new Figur({ art: 'zivil', kapuze: true, jacke: 0x6c757d, haare: true, haarfarbe: 0x1b1b1b, haut: 0xc68642 }); s.add(g1.root);
  const g2 = new Figur({ art: 'zivil', kapuze: true, jacke: 0x354f52, kappe: 0x111111, haut: 0xe8b98a, groesse: 1.84 }); s.add(g2.root);
  const fuchs = new Figur({ art: 'zivil', jacke: 0xf77f00, hose: 0x343a40, kappe: 0x111111, haut: 0xe8b98a, groesse: 1.8 }); s.add(fuchs.root);
  return { s, k, pov, t, g1, g2, fuchs, tuer, klinke, ladung, led, expl, schwaden, innenSchwaden, regen, blendg, blendLicht, hinterTuer, tonne, laternen, hallenLichter, tuerLampe, mond, schild2 };
})();

const TUER_ZEIT = 5.1;   // Sprengung in Szene 'zugriff'

function tuerPhysik(d) {
  // Tür fliegt nach innen, kippt nach hinten und landet flach auf dem Hallenboden.
  let y = 1.075, z = -.15, vy = 1.4, vz = -6.2, w = 0, om = -3.6, liegt = false;
  const dt = 1 / 240;
  for (let tt = 0; tt < d && !liegt; tt += dt) {
    vy -= 9.81 * dt; y += vy * dt; z += vz * dt; w += om * dt;
    const unten = y - 1.075 * Math.abs(Math.cos(w)) - .03 * Math.abs(Math.sin(w));
    if (unten <= 0 && vy < 0) {
      if (Math.abs(Math.cos(w)) < .3) liegt = true;
      else { vy = -vy * .25; vz *= .45; om *= .7; y -= unten; }
    }
  }
  return liegt ? { y: .03, z, w: -Math.PI / 2 } : { y, z, w };
}

function hafenStandard(t, innen) {
  const H_ = HAFEN;
  H_.regen.update(t, H_.k, !innen);
  for (const l of H_.laternen) l.visible = !innen || true;
  H_.mond.position.set(-8 + H_.k.position.x, 14, 6 + H_.k.position.z); H_.mond.target.position.set(H_.k.position.x, 0, H_.k.position.z - 4);
  H_.hallenLichter.forEach((l, i) => { l.intensity = 24 + 3 * Math.sin(t * 3 + i); });
  for (const f of [H_.g1, H_.g2, H_.fuchs]) f.root.visible = true;
}

// Team-Choreografie Gasse -> Tür (Szene 'anschleichen')
const WEG_A = {
  1: [[0, -3.3, 9.0], [5.5, -3.3, 2.6], [7.4, -.95, .8]],
  2: [[0, -3.3, 10.2], [5.5, -3.3, 3.9], [7.8, .95, .9]],
  4: [[0, -3.3, 11.4], [5.5, -3.3, 5.1], [8.2, -2.25, 1.6]],
  7: [[0, -3.3, 12.6], [5.5, -3.3, 6.3], [8.5, 1.8, 1.6]],
  6: [[0, -2.8, 14.8], [5.5, -2.8, 8.4], [8.6, -1.55, 2.4]],
};
const TONNE = { x: .15, z: 2.15 };

function s_anschleichen(lt, t) {
  hafenStandard(t, false);
  const { k, pov, t: tm } = HAFEN;
  for (const f of [HAFEN.g1, HAFEN.g2, HAFEN.fuchs]) f.root.visible = false;
  HAFEN.expl.update(-1); HAFEN.schwaden.update(-1, 0); HAFEN.innenSchwaden.update(-1, 0);
  HAFEN.tuer.visible = true; HAFEN.tuer.position.set(0, 1.075, -.15); HAFEN.tuer.rotation.set(0, 0, 0); HAFEN.klinke.visible = true;
  HAFEN.ladung.visible = false; HAFEN.blendg.visible = false; HAFEN.blendLicht.intensity = 0;
  HAFEN.hinterTuer.rotation.y = 0;
  for (const nr of [1, 2, 4, 7]) {
    const p = pfad(WEG_A[nr], lt);
    const geht = p.s > .05;
    const yaw = richtung(p.vx, p.vz, nr === 2 || nr === 7 ? Math.PI + .3 : Math.PI - .3);
    tm[nr].pose({ ...(geht ? gehPose(p.dist / .62 * Math.PI, { hocke: .35, schritt: .36, arme: false }) : hockPose(.45)), kopf: [0, nr === 1 && lt > 3.4 && lt < 5.4 ? .9 : 0, 0], rumpf: [.25, 0, 0] });
    tm[nr].platziere(p.x, p.z, yaw);
    if (nr === 1 && lt > 6.9) { tm[1].pose({ ...hockPose(.45), armL: [2.8, .3], ellL: 1.4, fingerL: 0 }); tm[1].platziere(p.x, p.z, yaw); tm[1].haltGewehr('tief'); tm[1].greife('R', weltPos(tm[1].anbau.gewehr.griff), tm[1].lokal(-.6, .6, -.4)); }
    else tm[nr].haltGewehr('tief');
  }
  // 2 stößt mit dem Schild gegen die Tonne
  const stoss = 7.05;
  const dt = lt - stoss;
  const rutsch = dt > 0 ? .28 * easeOut(dt / .4) : 0;
  HAFEN.tonne.position.set(TONNE.x + rutsch, 0, TONNE.z - rutsch * .3);
  HAFEN.tonne.rotation.set(0, .2, dt > 0 ? .12 * Math.exp(-4 * dt) * Math.sin(dt * 18) : 0);
  const p6 = pfad(WEG_A[6], lt);
  const geht6 = p6.s > .05;
  const bob = geht6 ? Math.sin(p6.dist / .62 * Math.PI) * .03 : 0;
  const pos = V3(p6.x, 1.5 + bob, p6.z);
  const blick = lt < 5.5 ? V3(p6.x - .2, 1.35, p6.z - 6) : V3(0, 1.2, 0);
  schau(k, pos, pos.clone().lerp(blick, 1), .01 * Math.sin(t * 2));
  pov.setze({ modus: 'gewehr', t, lauf: geht6 ? .6 : .1, zielen: -.15 });
  return { welt: HAFEN, uhr: '02:31', karte: lt < 4 ? { o: '02:31 · ZUGRIFFSORT', u: 'Hafen Nord · Lagerhaus 7', k: lt } : null, schepper: dt > 0 && dt < .15 };
}

// Zugriff: Ladung, Countdown, Sprengung (Tür nach INNEN), Eindringen
const WEG_Z = {
  2: [[0, .95, .9], [.8, .5, .45], [1.9, .5, .45], [2.6, 1.05, .95], [5.6, 1.05, .95], [6.1, .25, .3], [6.6, 0, -1.2], [8.0, .8, -4.2]],
  1: [[0, -.95, .8], [5.6, -.95, .8], [6.2, -.2, .3], [6.75, 0, -1.2], [8.0, -1.6, -4.6]],
  4: [[0, -2.25, 1.6], [5.6, -2.25, 1.6], [6.6, -.1, .4], [7.1, 0, -1.2], [8.0, 1.2, -3.6]],
  7: [[0, 1.8, 1.6]],
  6: [[0, -1.55, 2.4], [5.9, -1.55, 2.4], [6.9, -.2, .6], [7.4, 0, -.8], [8.0, -.3, -2.6]],
};

function s_zugriff(lt, t) {
  hafenStandard(t, false);
  const H_ = HAFEN, { k, pov, t: tm } = H_;
  const d = lt - TUER_ZEIT;
  for (const f of [H_.g1, H_.g2, H_.fuchs]) f.root.visible = false;
  H_.blendg.visible = false; H_.blendLicht.intensity = 0; H_.hinterTuer.rotation.y = 0;
  H_.tonne.position.set(TONNE.x + .28, 0, TONNE.z - .08); H_.tonne.rotation.set(0, .2, 0);
  // Ladung anbringen
  const ladungDran = lt > 1.15;
  H_.ladung.visible = ladungDran && d < 0;
  H_.ladung.position.set(.22, 1.05, -.1);
  H_.led.material.emissiveIntensity = Math.floor(t * 4) % 2 ? 6 : .5;
  // Tür
  if (d < 0) { H_.tuer.position.set(0, 1.075, -.15); H_.tuer.rotation.set(0, 0, 0); H_.klinke.visible = true; }
  else { const p = tuerPhysik(d); H_.tuer.position.set(.05, p.y, p.z); H_.tuer.rotation.set(p.w, .1 * Math.min(1, d), 0); H_.klinke.visible = false; }
  H_.expl.update(d);
  H_.schwaden.update(d, d > 0 ? clamp(d / 1.5) : 0, k);
  H_.innenSchwaden.update(d, d > 0 ? .6 : 0, k);
  H_.tuerLampe.intensity = d > 0 && d < .4 ? 0 : 30;
  const duck = d > -.1 && d < 1.4 ? Math.sin(clamp((d + .1) / 1.5) * Math.PI) : 0;
  for (const nr of [1, 2, 4, 7]) {
    const p = pfad(WEG_Z[nr], lt);
    const geht = p.s > .05;
    let yaw = richtung(p.vx, p.vz, Math.PI);
    if (!geht && lt < 5.6) yaw = nr === 7 ? Math.PI - .5 : (nr === 4 ? Math.PI + .25 : Math.PI);
    let P = geht ? gehPose(p.dist / .7 * Math.PI, { hocke: .25, arme: false }) : { ...hockPose(.5) };
    P.rumpf = [.3 + .5 * duck, 0, 0];
    P.kopf = [.4 * duck, 0, 0];
    if (nr === 2 && lt > .5 && lt < 2.0) P = { ...hockPose(.9), rumpf: [.2, 0, 0], kopf: [-.1, 0, 0] };
    if (nr === 1 && lt > 2.8 && lt < TUER_ZEIT) {
      const n = lt < 3.5 ? 3 : lt < 4.2 ? 2 : lt < 4.9 ? 1 : 0;
      P = { ...hockPose(.45), armL: [2.7, .35], ellL: 1.2, fingerL: n === 3 ? 3 : n === 2 ? 2 : n === 1 ? 1 : 0, rumpf: [.25, 0, 0] };
    }
    tm[nr].pose(P);
    tm[nr].platziere(p.x, p.z, yaw);
    if (nr === 2 && lt > .5 && lt < 2.0) {
      tm[2].ohneGewehr();
      tm[2].greife('R', V3(.22 + .05 * (1 - smooth(.6, 1.15, lt)), 1.05, -.08 + .2 * (1 - smooth(.6, 1.15, lt))), tm[2].lokal(-.6, .4, -.2));
    } else if (nr === 1 && lt > 2.8 && lt < TUER_ZEIT) {
      tm[1].haltGewehr('tief'); tm[1].greife('L', tm[1].lokal(.32, 1.62, .25), tm[1].lokal(.8, 1.0, -.4));
    } else tm[nr].haltGewehr(geht && lt > 5.6 ? 'anschlag' : 'tief');
  }
  // Ich (Kamera)
  const p6 = pfad(WEG_Z[6], lt);
  const geht6 = p6.s > .05;
  let pos = V3(p6.x, geht6 ? 1.6 : 1.38, p6.z);
  if (geht6) pos.y += Math.sin(p6.dist / .65 * Math.PI) * .035;
  const sh = d > 0 ? .06 * Math.exp(-3 * d) : 0;
  const r = rng(Math.floor(t * 30));
  pos.add(V3((r() - .5) * sh, (r() - .5) * sh, 0));
  let ziel = lt < 1.9 ? V3(.3, 1.0, 0) : (lt < TUER_ZEIT - .2 ? V3(-.6, 1.5, .6) : V3(0, 1.1, -3));
  if (lt > 2.8 && lt < TUER_ZEIT - .45) ziel = V3(-.75, 1.55, .5);
  if (lt >= TUER_ZEIT - .45 && lt < TUER_ZEIT + 1.0) ziel = V3(.05, 1.15, 0);
  const wegdrehen = duck;
  schau(k, pos, ziel);
  k.rotation.y += .12 * wegdrehen; k.rotation.x -= .06 * wegdrehen; k.updateMatrixWorld(true);
  pov.setze({ modus: 'gewehr', t, lauf: geht6 ? .9 : .1, zielen: lt > 5.6 ? .55 : -.1, lampe: lt > 6.3 ? 25 : 0 });
  return { welt: HAFEN, uhr: '02:32', blitz: d >= 0 && d < .25 ? (1 - d / .25) * .9 : 0, wackel: sh };
}

// Halle innen
const WEG_I = {
  2: [[0, .8, -4.2], [3.9, .8, -4.2], [5.55, 3.85, -8.0]],
  1: [[0, -1.6, -4.6], [1.8, -1.9, -6.2]],
  4: [[0, 1.2, -3.6], [1.0, 2.2, -5.6]],
  6: [[0, -.3, -2.6], [.9, -.45, -4.7], [10.8, -.45, -4.7], [12.6, 2.4, -10.5]],
  fuchs: [[0, 3.6, -13.9], [1.85, 3.6, -13.9], [3.6, 5.0, -22.7], [4.1, 5.0, -25.5]],
  g2: [[0, 1.7, -8.0], [3.9, 1.7, -8.0], [5.5, 4.0, -8.4]],
};
const BLEND_WURF = 0.7, BLEND_KNALL = 1.55, TACKLE = 5.5;

function s_innen(lt, t) {
  hafenStandard(t, true);
  const H_ = HAFEN, { k, pov, t: tm, g1, g2, fuchs } = H_;
  H_.expl.update(TUER_ZEIT + 8 + lt - TUER_ZEIT); H_.ladung.visible = false;
  const pt = tuerPhysik(9); H_.tuer.position.set(.05, pt.y, pt.z); H_.tuer.rotation.set(pt.w, .1, 0); H_.klinke.visible = false;
  H_.schwaden.update(3 + lt, clamp(1 - lt / 8), k); H_.innenSchwaden.update(3 + lt, .5, k);
  tm[7].root.visible = false;
  const knall = lt - BLEND_KNALL;
  const geblendet = knall > 0 && knall < 2.6;
  // Blendgranate: Wurf von 4, Abprall, Rollen
  if (lt >= BLEND_WURF && lt < BLEND_KNALL + .05) {
    const q = wurf3([2.1, 1.5, -5.7], [-1.0, 2.6, -2.2], lt - BLEND_WURF, { radius: .03, rest: .3, reib: .6 });
    H_.blendg.visible = true; H_.blendg.position.set(q.x, q.y, q.z); H_.blendg.rotation.set(lt * 9, 0, q.liegt ? Math.PI / 2 : lt * 7);
  } else H_.blendg.visible = false;
  H_.blendLicht.position.copy(H_.blendg.position); H_.blendLicht.intensity = knall > 0 && knall < .5 ? 900 * (1 - knall / .5) : 0;
  // Team
  for (const nr of [1, 4]) {
    const p = pfad(WEG_I[nr], lt); const geht = p.s > .05;
    let P = geht ? gehPose(p.dist / .7 * Math.PI, { hocke: .25, arme: false }) : { beinL: [.25, .3], beinR: [-.15, .25], rumpf: [.15, 0, 0] };
    if (nr === 4 && lt > BLEND_WURF - .35 && lt < BLEND_WURF + .15) P = { ...P, armR: [2.4 - 2 * smooth(BLEND_WURF - .35, BLEND_WURF, lt), .2], ellR: .3 };
    P.kopf = [0, 0, 0];
    tm[nr].pose(P); tm[nr].platziere(p.x, p.z, richtung(p.vx, p.vz, nr === 4 ? Math.PI - .3 : Math.PI + .2));
    if (nr === 4 && lt > BLEND_WURF - .35 && lt < BLEND_WURF + .15) { tm[4].haltGewehr('tief'); tm[4].pose(P); tm[4].platziere(p.x, p.z, Math.PI - .3); tm[4].greife('L', weltPos(tm[4].anbau.gewehr.vorne), tm[4].lokal(.6, .6, -.2)); }
    else tm[nr].haltGewehr('anschlag');
  }
  // 2 rennt los und tackelt g2
  {
    const p = pfad(WEG_I[2], lt);
    const nach = lt - TACKLE;
    if (nach < 0) {
      const geht = p.s > .05;
      tm[2].pose(geht ? rennPose(p.dist / .9 * Math.PI, { neig: .45 }) : { beinL: [.25, .3], beinR: [-.15, .25], rumpf: [.15, 0, 0] });
      tm[2].platziere(p.x, p.z, richtung(p.vx, p.vz, Math.PI));
      tm[2].haltGewehr(geht ? 'hoch' : 'anschlag');
    } else {
      const k2 = smooth(0, .45, nach);
      tm[2].pose({ beinL: [1.4 * k2, 2.0 * k2], beinR: [.2 + .6 * k2, 1.8 * k2], rumpf: [.45 + .4 * k2, 0, 0], kopf: [.2, 0, 0], armL: [1.3, .2], ellL: .4, armR: [1.3, .2], ellR: .4, mund: redet('innen', lt, '2') });
      tm[2].platziere(3.85 + .35 * k2, -8.05 - .35 * k2, Math.PI * .72);
      tm[2].ohneGewehr();
      const ruecken = weltPos(g2.j.chest).add(V3(0, .25, 0));
      if (nach > .4) { tm[2].greife('L', ruecken.clone().add(V3(.15, 0, 0)), tm[2].lokal(.6, 1.4, -.2)); tm[2].greife('R', ruecken.clone().add(V3(-.15, 0, .1)), tm[2].lokal(-.6, 1.4, -.2)); }
    }
  }
  // g1 am Tisch: geblendet -> Hände hoch -> kniet
  {
    let P = { ...stehPose(t), kopf: [.1, 0, 0] };
    if (geblendet) P = { ...P, armL: [2.2, -.3], ellL: 2.2, armR: [2.2, -.3], ellR: 2.2, rumpf: [.3, .2 * Math.sin(t * 5), 0], kopf: [.4, 0, 0] };
    if (lt > 3.4) P = { ...P, armL: [3.0, .35], ellL: .4, armR: [3.0, .35], ellR: .4, mund: .5, kopf: [0, 0, 0], rumpf: [0, 0, 0] };
    if (lt > 4.6) { const kk = smooth(4.6, 5.3, lt); P.beinL = [1.5 * kk, 1.6 * kk]; P.beinR = [-.2 * kk, 1.75 * kk]; }
    g1.pose(P); g1.platziere(-1.0, -9.95, 0);
  }
  // g2: geblendet -> flieht -> wird getackelt und liegt bäuchlings
  {
    const p = pfad(WEG_I.g2, lt);
    const nach = lt - TACKLE;
    if (nach < 0) {
      const geht = p.s > .05;
      let P = geht ? rennPose(p.dist / .9 * Math.PI) : { ...stehPose(t) };
      if (geblendet && !geht) P = { ...P, armL: [2.2, -.3], ellL: 2.2, armR: [2.2, -.3], ellR: 2.2, rumpf: [.3, 0, 0], kopf: [.4, 0, 0] };
      g2.pose(P); g2.platziere(p.x, p.z, richtung(p.vx, p.vz, 0));
    } else {
      const kk = smooth(0, .45, nach);
      g2.pose({ armL: [2.6 * kk, .4], armR: [2.6 * kk, .4], ellL: .3, ellR: .3, beinL: [0, .2], beinR: [0, .3], kopf: [-.5 * kk, .8 * kk, 0] });
      g2.platziere(4.0 + .4 * kk, -8.4 - .25 * kk, Math.PI / 2 + .3, { kipp: [kk * Math.PI / 2, 0] });
    }
  }
  // Fake-Fuchs: wird nicht geblendet, rennt sichtbar zum Hinterausgang raus
  {
    const p = pfad(WEG_I.fuchs, lt);
    const geht = p.s > .05;
    fuchs.root.visible = lt < 4.15;
    fuchs.pose(geht ? rennPose(p.dist / 1.0 * Math.PI, { neig: .35 }) : { ...stehPose(t), kopf: [lt > 1.6 ? 0 : .3, lt > 1.6 ? 1.0 : 0, 0], armR: [.8, .1], ellR: 1.2 });
    fuchs.platziere(p.x, p.z, geht ? richtung(p.vx, p.vz, 0) : (lt > 1.6 ? .8 : 0));
    const auf = smooth(3.35, 3.6, lt) * (1 - smooth(4.4, 5.0, lt));
    H_.hinterTuer.rotation.y = -1.7 * auf;
  }
  // Ich
  const p6 = pfad(WEG_I[6], lt); const geht6 = p6.s > .05;
  const rennt = lt > 10.8;
  const pos = V3(p6.x, 1.6 + (geht6 ? Math.sin(p6.dist / .7 * Math.PI) * (rennt ? .05 : .03) : 0), p6.z);
  const wackel = knall > 0 && knall < .7 ? .03 * (1 - knall / .7) : 0;
  const r = rng(Math.floor(t * 30)); pos.add(V3((r() - .5) * wackel, (r() - .5) * wackel, 0));
  let ziel = V3(.3, 1.2, -10);
  if (lt > 1.8 && lt < 4.2) ziel = V3(3.0, 1.2, -14).lerp(V3(5.0, 1.3, -22), smooth(1.9, 3.8, lt));
  if (lt > 4.2 && lt < 7) ziel = V3(2.5, .9, -8.5);
  if (lt > 7 && lt < 10.2) ziel = V3(-.5, 1.0, -9.5);
  if (lt >= 10.2) ziel = V3(5.0, 1.4, -23);
  if (knall > 0 && knall < .6) ziel.add(V3(-3, -2, 0).multiplyScalar(.5));
  schau(k, pos, ziel);
  pov.setze({ modus: 'gewehr', t, lauf: rennt ? 1 : (geht6 ? .5 : .1), zielen: rennt ? .1 : .6, lampe: 30 });
  return { welt: HAFEN, uhr: '02:33', blitz: knall > 0 ? (knall < .35 ? 1 : clamp(1 - (knall - .35) / 1.6) * .85) : 0 };
}

// ======================================================================= WELT 4: Kai (Verfolgung + Twist)
const KAI = (() => {
  const s = new THREE.Scene();
  const mond = nachtLicht(s, { nebel: [0x0e1526, 10, 80] });
  const k = kamera(s, 74);
  const pov = new Pov(k);
  const beton = mat(0x55595f, { r: .45, map: betonTex('#55595f', [10, 60], 'kai'), envI: 1 });
  s.add(bodenPlatte(20, 140, beton, 5, -50));
  s.add(at(box(.4, .25, 140, mat(0x8d8f94)), -3.1, .12, -50));
  s.add(at(box(.12, .01, 140, mat(0xffc300, { e: 0x5a4500, ei: .5 })), -2.6, .006, -50));
  // Wasser mit Wellen
  const wg = new THREE.PlaneGeometry(60, 140, 40, 90); wg.rotateX(-Math.PI / 2);
  const wasser = new THREE.Mesh(wg, mat(0x0b1a2e, { r: .15, m: .3, envI: 1.2 })); wasser.position.set(-33.3, -1.2, -50); s.add(wasser);
  s.add(at(box(.6, 1.3, 140, mat(0x3f4246)), -3.3, -.6, -50));
  const schiff = new THREE.Group(); schiff.add(at(box(14, 8, 70, mat(0x1d3557, { r: .7 })), 0, 2, 0)); schiff.add(at(box(10, 6, 14, mat(0xe9ecef)), 0, 9, 20));
  for (let i = 0; i < 8; i++) schiff.add(at(box(.6, .5, .1, mat(0xffd27a, { e: 0xffb84d, ei: 2 })), -7.05, 10, 16 + i * 1.2, 0, Math.PI / 2));
  schiff.position.set(-16, -2, -60); s.add(schiff);
  const farben = [0x9d0208, 0x264653, 0x6d597a, 0x3a5a40, 0xbc6c25, 0x1d3557];
  for (let i = 0; i < 16; i++) { container(s, 7.5, -4 - i * 6.6, 0, farben[i % 6]); if (i % 3 !== 1) container(s, 7.5, -4 - i * 6.6, 0, farben[(i + 2) % 6], { y: 2.6 }); }
  for (let z = -2; z > -110; z -= 8) s.add(at(cyl(.18, .22, .5, mat(0x22252b, { m: .4 })), -2.3, .25, z));
  for (let z = 0; z > -110; z -= 21) palette(s, 4.2, z - 9, .4);
  kran(s, -10, -120, 34); kran(s, 18, -130, 30);
  const lampenZ = []; for (let z = -6; z > -110; z -= 14) { lampenZ.push(z);
    s.add(at(cyl(.07, .09, 6, mat(0x22252b, { m: .5 })), -2.2, 3, z)); s.add(at(box(.7, .18, .3, mat(0x2b2d31)), -1.9, 6, z));
    s.add(at(box(.5, .03, .2, mat(0xfff1d0, { e: 0xffd9a0, ei: 4 })), -1.9, 5.9, z)); }
  const lichter = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffd29a, 50, 22, 1.5); s.add(l); return l; });
  const PF_Z = -41.5;
  pfuetze(s, .7, PF_Z, 1.3, .9); pfuetze(s, 1.6, -18, .8, .5); pfuetze(s, -.8, -60, 1.1, .7);
  const regen = new Regen(s, 1500);
  const fuchs = new Figur({ art: 'zivil', jacke: 0xf77f00, hose: 0x343a40, kappe: 0x111111, haut: 0xe8b98a, groesse: 1.8 }); s.add(fuchs.root);
  const schellen = handschellenModell(); s.add(schellen);
  const t = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  const tablet = new THREE.Group(); tablet.add(at(box(.26, .18, .015, mat(0x111111)), 0, 0, 0));
  tablet.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.24, .16), new THREE.MeshBasicMaterial({ color: 0x4cc9f0 })), 0, 0, .009)); s.add(tablet);
  const van = new THREE.Group(); van.add(at(box(2.1, 2.3, 5.4, mat(0x15171c, { r: .4, m: .5 })), 0, 1.35, 0));
  van.add(at(box(1.5, .12, .3, mat(0x0a2463, { e: 0x3a7bff, ei: 0 })), 0, 2.56, 1.8)); for (const z of [-1.8, 1.8]) for (const x of [-1.05, 1.05]) van.add(at(cyl(.38, .38, .3, mat(0x111111)), x, .38, z, 0, 0, Math.PI / 2));
  van.position.set(2.2, 0, -50.5); van.rotation.y = .5; s.add(van);
  const blau = new THREE.PointLight(0x3a7bff, 0, 22, 1.4); blau.position.set(2.2, 3, -49); s.add(blau);
  return { s, k, pov, mond, wasser, wg, lichter, lampenZ, PF_Z, regen, fuchs, schellen, t, tablet, van, blau };
})();
const wellenBasis = KAI.wg.attributes.position.array.slice();

function kaiStandard(t) {
  const K = KAI;
  K.regen.update(t, K.k, true, .08);
  const p = K.wg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = wellenBasis[i * 3], z = wellenBasis[i * 3 + 2]; p.array[i * 3 + 1] = .12 * Math.sin(x * .6 + t * 1.5) + .08 * Math.sin(z * .45 + t * 1.1); }
  p.needsUpdate = true; K.wg.computeVertexNormals();
  const cz = K.k.position.z;
  const naechste = [...K.lampenZ].sort((a, b) => Math.abs(a - cz + 6) - Math.abs(b - cz + 6)).slice(0, 3);
  K.lichter.forEach((l, i) => l.position.set(-1.9, 5.6, naechste[i]));
  K.mond.position.set(-8, 14, cz + 6); K.mond.target.position.set(0, 0, cz - 6);
}

const F_START = -9, F_V = 5.7, SLIP_T = (F_START - KAI.PF_Z) / F_V;   // ≈ 5.7 s
function fuchsKai(lt) {
  if (lt < SLIP_T) return { z: F_START - F_V * lt, fall: 0, liegt: false };
  const d = lt - SLIP_T;
  const rutsch = F_V * (1 - Math.exp(-2.6 * d)) / 2.6;
  return { z: KAI.PF_Z - rutsch, fall: smooth(0, .5, d), liegt: d > .5, d };
}
const KAM_V = 6.2;

function s_verfolgung(lt, t) {
  kaiStandard(t);
  const { k, pov, fuchs, schellen, t: tm } = KAI;
  for (const nr of [1, 2, 4, 7]) tm[nr].root.visible = false;
  KAI.tablet.visible = false; KAI.van.visible = false; KAI.blau.intensity = 0;
  const f = fuchsKai(lt);
  const fz_end = fuchsKai(60).z;
  const stopZ = fz_end - 0.85;
  const kz = Math.max(stopZ, 1.0 - KAM_V * lt);
  const seit = easeInOut((fz_end + 3.2 - kz) / 3.0);
  const rennt = kz > stopZ + .01;
  const angekommen = !rennt;
  const tAn = (1.0 - stopZ) / KAM_V;
  const knien = smooth(tAn, tAn + .7, lt);
  // Fuchs
  const fx = .7;
  if (f.fall === 0) {
    const zurueck = lt > 3.0 && lt < 4.6;
    fuchs.pose({ ...rennPose(lt * 11.5, { neig: .3 }), kopf: [0, zurueck ? 2.4 : 0, 0], mund: redet('verfolgung', lt, 'F') });
    fuchs.platziere(fx, f.z, Math.PI);
  } else {
    // stolpert in der Pfütze nach vorne und landet bäuchlings – Arme fangen den Sturz ab, später auf den Rücken
    const hinten = smooth(tAn + 1.0, tAn + 1.8, lt);
    fuchs.pose({ armL: [2.4 * (1 - hinten), .3], armR: [2.4 * (1 - hinten), .3], ellL: .4, ellR: .4, beinL: [0, .05], beinR: [.05, .05], kopf: [-.6 * f.fall, lt > 10.9 ? 1.2 : .4, 0], mund: redet('verfolgung', lt, 'F') });
    fuchs.platziere(fx, f.z, Math.PI, { kipp: [f.fall * Math.PI / 2, 0] });
    if (hinten > 0) {
      const hl = fuchs.j.hips.localToWorld(V3(.06, .02, -.17)), hr = fuchs.j.hips.localToWorld(V3(-.06, .02, -.17));
      const pol = fuchs.j.chest.localToWorld(V3(0, .1, -.8));
      fuchs.greife('L', weltPos(fuchs.j.haL).lerp(hl, hinten), pol);
      fuchs.greife('R', weltPos(fuchs.j.haR).lerp(hr, hinten), pol);
    }
  }
  // Handschellen: schließen nacheinander um die Handgelenke
  const zu1 = tAn + 2.35, zu2 = tAn + 2.75;
  schellen.visible = lt > zu1 - .5;
  const wl = weltPos(fuchs.j.haL).add(V3(0, 0, 0)), wr = weltPos(fuchs.j.haR);
  const handR = pov.handWelt('R');
  schellen.ringL.position.copy(lt > zu1 ? wl : handR.clone().add(V3(-.04, 0, 0)));
  schellen.ringR.position.copy(lt > zu2 ? wr : handR.clone().add(V3(.04, 0, 0)));
  for (const ring of [schellen.ringL, schellen.ringR]) { ring.lookAt(k.position); ring.rotateY(Math.PI / 2); }
  const mitte = schellen.ringL.position.clone().add(schellen.ringR.position).multiplyScalar(.5);
  schellen.kette.position.copy(mitte);
  schellen.kette.scale.y = Math.max(.02, schellen.ringL.position.distanceTo(schellen.ringR.position) - .07);
  schellen.kette.quaternion.setFromUnitVectors(V3(0, 1, 0), schellen.ringR.position.clone().sub(schellen.ringL.position).normalize());
  // Kamera
  const bob = rennt ? Math.sin(lt * 12.5) * .06 : 0;
  const pos = V3(lerp(.4 + .12 * Math.sin(lt * 6.2) * (rennt ? 1 : 0), 1.95, seit), lerp(1.62 + bob, 1.3, knien), kz);
  const fuchsMitte = weltPos(fuchs.j.hips);
  const ziel = angekommen ? V3(lerp(.4, fx, knien), lerp(1.2, .1, knien), lerp(kz - 6, fuchsMitte.z, knien)) : V3(.5 - .4 * seit, 1.25 - .6 * seit, kz - 8);
  schau(k, pos, ziel, rennt ? .02 * Math.sin(lt * 6) : 0);
  // Hände
  if (knien < .3) pov.setze({ modus: 'gewehr', t, lauf: rennt ? 1 : .2, zielen: -.4 });
  else {
    const rueckenPunkt = fuchs.j.chest.localToWorld(V3(0, .12, -.17));
    const greift = smooth(tAn + 1.4, tAn + 2.3, lt);
    const zielR = k.localToWorld(V3(.3, -.35, -.35)).lerp(wl.clone().lerp(wr, .5).add(V3(0, .06, 0)), greift);
    pov.setze({ modus: 'frei', t, zielL: rueckenPunkt, zielR: lt < zu2 + .5 ? zielR : k.localToWorld(V3(.3, -.4, -.4)) });
  }
  return { welt: KAI, uhr: '02:34', klick: (lt > zu1 && lt < zu1 + .05) || (lt > zu2 && lt < zu2 + .05) };
}

function s_twist(lt, t) {
  kaiStandard(t);
  const { k, pov, fuchs, schellen, t: tm } = KAI;
  KAI.van.visible = true;
  const blauAn = Math.floor(t * 6) % 2 === 0;
  KAI.blau.intensity = blauAn ? 60 : 8; KAI.van.children[1].material.emissiveIntensity = blauAn ? 4 : .3;
  const fz = fuchsKai(60).z;
  // Fahrer kniet gefesselt, Blick zu uns
  fuchs.pose({ beinL: [1.5, 2.3], beinR: [1.5, 2.3], rumpf: [-.05, 0, 0], kopf: [0, 0, 0], mund: redet('twist', lt, 'F'), armL: [-.5, .1], armR: [-.5, .1], ellL: .9, ellR: .9 });
  fuchs.platziere(.6, fz + 1.2, 0);
  const hl = fuchs.j.hips.localToWorld(V3(.05, .02, -.16)), hr = fuchs.j.hips.localToWorld(V3(-.05, .02, -.16));
  fuchs.greife('L', hl, fuchs.j.chest.localToWorld(V3(.5, 0, -.6))); fuchs.greife('R', hr, fuchs.j.chest.localToWorld(V3(-.5, 0, -.6)));
  schellen.visible = true;
  schellen.ringL.position.copy(weltPos(fuchs.j.haL)); schellen.ringR.position.copy(weltPos(fuchs.j.haR));
  const mitte = schellen.ringL.position.clone().add(schellen.ringR.position).multiplyScalar(.5);
  schellen.kette.position.copy(mitte); schellen.kette.scale.y = Math.max(.02, schellen.ringL.position.distanceTo(schellen.ringR.position) - .07);
  schellen.kette.quaternion.setFromUnitVectors(V3(0, 1, 0), schellen.ringR.position.clone().sub(schellen.ringL.position).normalize());
  const stell = (nr, x, dz, yaw, extra = {}) => { tm[nr].root.visible = true; tm[nr].pose({ ...stehPose(t + nr), mund: redet('twist', lt, String(nr)), ...extra }); tm[nr].platziere(x, fz + dz, yaw); };
  stell(1, -.45, .55, .4, { kopf: [0, lt > 6.2 ? -.5 : 0, 0] }); tm[1].haltGewehr('tief');
  stell(2, 1.65, .35, -.5, { kopf: [0, lt > 10.3 ? -.6 : 0, 0] }); tm[2].haltGewehr('tief');
  stell(4, -.85, 2.0, .9); tm[4].haltGewehr('tief');
  stell(7, 1.45, 2.3, -1.0, { kopf: [.35, 0, 0] }); tm[7].ohneGewehr();
  const tp = tm[7].lokal(0, 1.12, .36); KAI.tablet.visible = true; KAI.tablet.position.copy(tp); KAI.tablet.rotation.set(-.6, tm[7].root.rotation.y, 0, 'YXZ');
  tm[7].greife('L', tm[7].lokal(.12, 1.1, .34), tm[7].lokal(.6, .5, -.2)); tm[7].greife('R', tm[7].lokal(-.12, 1.1, .34), tm[7].lokal(-.6, .5, -.2));
  const pos = V3(.5 + .02 * Math.sin(t * .8), 1.66 + .01 * Math.sin(t * 1.3), fz + 4.6);
  schau(k, pos, V3(.6, 1.0, fz + 1.0));
  pov.setze({ modus: 'gewehr', t, senken: .55, zielen: -.3 });
  const d = TL.szenen.find(x => x.n === 'twist').d;
  return { welt: KAI, uhr: '02:38', info: lt > .6 && lt < 6.2 ? lt - .6 : null, ende: lt > d - 1.9 ? lt - (d - 1.9) : null };
}

// ======================================================================= Hook (Rückblende)
function s_hook(lt, t) {
  const freeze = 2.35;
  const sp = lt > 3.2 ? (lt - 3.2) / .8 : 0;
  const zl = lt < freeze ? TUER_ZEIT - .25 + lt : (sp > 0 ? TUER_ZEIT - .25 + freeze - sp * 2.2 : TUER_ZEIT - .25 + freeze);
  const tZ = TL.szenen.find(x => x.n === 'zugriff').start + zl;
  const r = s_zugriff(zl, tZ);
  return { ...r, sat: lt > freeze ? .15 : 1, mitte: lt > freeze + .15 ? { text: 'Wie wir hier gelandet sind?', k: lt - freeze - .15 } : null, spulen: sp > 0 ? 1 : 0, titel: lt < 2.0 };
}

// ======================================================================= UI (HTML-Overlay)
const ui = {
  sub: document.getElementById('sub'), wer: document.getElementById('wer'), txt: document.getElementById('txt'),
  rec: document.getElementById('rec'), uhr: document.getElementById('uhr'), karte: document.getElementById('karte'),
  mitte: document.getElementById('mitte'), tags: document.getElementById('tags'), info: document.getElementById('info'),
  ende: document.getElementById('ende'), zeit: document.getElementById('zeitsprung'), titel: document.getElementById('titel'),
};
function projiziere(v, k) { const p = v.clone().project(k); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z < 1]; }

function zeigeUI(n, lt, r, t) {
  const z = zeile(n, lt);
  if (z) {
    const [name, farbe] = TL.sprecher[z.wer];
    ui.sub.style.opacity = clamp((lt - z.start) / .12) * clamp((z.ende - lt) / .12);
    ui.wer.textContent = name; ui.wer.style.color = farbe; ui.txt.textContent = z.text;
  } else ui.sub.style.opacity = 0;
  const sek = Math.floor(lt) % 60;
  ui.uhr.textContent = `${r.uhr ?? '02:30'}:${String(sek).padStart(2, '0')}`;
  ui.rec.style.opacity = Math.floor(t * 2) % 2 ? 1 : .25;
  if (r.karte) { ui.karte.style.opacity = clamp(r.karte.k * 4) * clamp((3.6 - r.karte.k) * 3); ui.karte.querySelector('b').textContent = r.karte.o; ui.karte.querySelector('span').textContent = r.karte.u; ui.karte.style.transform = `translateX(${(1 - easeOut(r.karte.k / .4)) * -600}px)`; }
  else ui.karte.style.opacity = 0;
  if (r.mitte) { ui.mitte.style.opacity = clamp(r.mitte.k * 5); ui.mitte.textContent = r.mitte.text; ui.mitte.style.transform = `scale(${.8 + .2 * easeBack(r.mitte.k / .3)})`; }
  else ui.mitte.style.opacity = 0;
  ui.titel.style.opacity = r.titel ? 1 : 0;
  ui.tags.innerHTML = (r.tags ?? []).map(g => {
    const x = clamp(g.p[0], 260, W - 260), y = clamp(g.p[1] - 120, 330, 1200), s = .7 + .3 * easeBack(g.k / .25);
    return `<div class="tag" style="left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(${s});border-color:${g.f}"><b style="color:${g.f}">${g.a}</b><span>${g.b}</span></div>`;
  }).join('');
  if (r.info !== null && r.info !== undefined) { ui.info.style.opacity = clamp(r.info * 4) ; ui.info.style.transform = `scale(${.85 + .15 * easeBack(r.info / .3)})`; }
  else ui.info.style.opacity = 0;
  if (r.ende !== null && r.ende !== undefined) { ui.ende.style.opacity = clamp(r.ende * 3); ui.ende.querySelector('.flieger').style.transform = `translate(${-300 + r.ende * 420}px, ${-r.ende * 120}px) rotate(-14deg)`; }
  else ui.ende.style.opacity = 0;
}

// ======================================================================= Hauptschleife
const SZENEN = { hook: s_hook, hq: s_hq, briefing: s_briefing, spind: s_spind, van: s_van, anschleichen: s_anschleichen, zugriff: s_zugriff, innen: s_innen, verfolgung: s_verfolgung, twist: s_twist };

function szeneRendern(i, lt, ziel) {
  const s = TL.szenen[i];
  const r = SZENEN[s.n](lt, s.start + lt);
  POST.rendere(r.welt.s, r.welt.k, ziel);
  return r;
}

window.renderFrame = async (t) => {
  let i = 0; TL.szenen.forEach((s, k) => { if (t >= s.start) i = k; });
  const s = TL.szenen[i], lt = t - s.start;
  const tr = s.tr, trd = s.trd ?? .5;
  let r, post = {};
  if (i > 0 && tr && lt < trd) {
    const vorher = TL.szenen[i - 1];
    szeneRendern(i - 1, vorher.d + lt, POST.a);
    r = szeneRendern(i, lt, POST.b);
    const p = lt / trd;
    if (tr === 'schwarz' || tr === 'uhr') post = { modus: 1, p: p < .5 ? 0 : 1, schwarz: 1 - Math.abs(p - .5) * 2 };
    else post = { modus: UEBERGANG[tr], p };
    ui.zeit.style.opacity = tr === 'uhr' ? Math.sin(Math.PI * p) : 0;
    if (tr === 'uhr') { ui.zeit.querySelector('.zeiger').style.transform = `rotate(${p * 1080}deg)`; ui.zeit.querySelector('.std').style.transform = `rotate(${p * 160}deg)`; ui.zeit.querySelector('b').textContent = s.karte; }
  } else {
    r = szeneRendern(i, lt, POST.a);
    ui.zeit.style.opacity = 0;
  }
  POST.fertig({ ...post, zeit: t, blitz: r.blitz ?? 0, sat: r.sat ?? 1, spulen: r.spulen ?? 0, rot: r.rot ?? 0 });
  zeigeUI(s.n, lt, r, t);
  await new Promise(res => requestAnimationFrame(() => res()));
};
window.dauer = TL.dauer;
window.bereit = true;
