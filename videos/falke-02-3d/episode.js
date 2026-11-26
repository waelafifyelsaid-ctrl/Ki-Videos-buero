// EINHEIT FALKE – Einsatz 02: Das Flugzeug (3D, nur POV, Morgennebel).
import {
  THREE, W, H, mat, box, cyl, sph, caps, at, bodenPlatte, clamp, lerp, easeOut, easeIn, easeInOut, easeBack, smooth,
  betonTex, holzTex, liveTex, weltPos, rng, radialTex, rauchTex, canvasTex as canvasTexEp,
} from '/tools/einsatz3d/kern.js';
import { Figur, gehPose, rennPose, hockPose, stehPose, schildModell, handschellenModell } from '/tools/einsatz3d/figur.js';
import { renderer, Post, UEBERGANG, Explosion, Schwaden, schild, hauptquartier, hqDetails } from '/tools/einsatz3d/welt.js';
import { Pov } from '/tools/einsatz3d/pov.js';
import { heliModell, heliUpdate, setzeSeil, Abwind, HELI_BODEN } from '/tools/einsatz3d/heli.js';
import { flughafen, flughafenUpdate } from '/tools/einsatz3d/flughafen.js';
import { dachWelt, dachUpdate } from '/tools/einsatz3d/dach.js';

const TL = await (await fetch('./timeline_fertig.json')).json();
const R = renderer();
const POST = new Post(R);
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
const wackel = (t, st) => { const r = rng(Math.floor(t * 30)); return V3((r() - .5) * st, (r() - .5) * st, 0); };

const OPS = { 1: { headset: true, groesse: 1.86 }, 2: { groesse: 1.98, visier: true }, 4: { groesse: 1.72, visier: true }, 7: { groesse: 1.76, headset: true } };
const teamOps = (s, nr) => { const f = new Figur({ art: 'team', nummer: nr, maske: false, helm: true, ...OPS[nr] }); s.add(f.root); return f; };
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
const PLATZ = { 6: [-.72, 1.42, Math.PI], 1: [.24, 1.42, Math.PI], 4: [.72, 1.42, Math.PI], 2: [-.5, -.82, 0], 7: [.5, -.82, 0] };
function heliTeam(h, tm, n, lt, extra = {}) {
  for (const nr of [1, 2, 4, 7]) {
    const f = tm[nr]; if (!f.root.visible) continue;
    const [x, z, yaw] = PLATZ[nr];
    sitz(f, x, z, yaw, SITZ_H, { mund: redet(n, lt, String(nr)), kopf: [.1, Math.sin(lt * .7 + nr) * .15, 0], ...(extra[nr] ?? {}) });
    if (nr === 7) f.ohneGewehr(); else f.haltGewehr('hoch');
  }
}
// Sitzplatz der Kamera (6) im Hubschrauber: Augenhöhe sitzend
const AUGE6 = V3(-.74, SITZ_H + .8, 1.12);

// ======================================================================= WELT 1: Hauptquartier (früh am Morgen)
const HQ = (() => {
  const s = new THREE.Scene(); const hq = hauptquartier(s); hqDetails(s);
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
  const TO = 5.7;   // Abheben erst, wenn alle sitzen
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
  // Läufer → Tür → einsteigen (dann sitzen sie drin)
  const tuer = h.g.localToWorld(V3(-1.45, 0, -.05));
  const plan = {
    2: [[0, -2.1, 6.2], [2.3, tuer.x - .2, tuer.z + .4]], 4: [[.15, -2.6, 6.9], [2.75, tuer.x + .5, tuer.z + .5]], 7: [[.35, -1.6, 7.4], [3.2, tuer.x + .9, tuer.z + .6]],
  };
  for (const nr of [2, 4, 7]) {
    const p = pfad(plan[nr], lt), an = plan[nr][1][0];
    const drin = lt > an + .35;
    laeufer[nr].root.visible = !drin; sitzer[nr].root.visible = drin;
    if (!drin) {
      const steig = smooth(an, an + .35, lt);
      laeufer[nr].pose(lt < an ? rennPose(p.dist / .95 * Math.PI, { neig: .45 }) : { ...hockPose(.5), beinL: [1.4, 1.6] });
      laeufer[nr].platziere(lerp(p.x, tuer.x - .2, steig), lerp(p.z, tuer.z - .9, steig), lt < an ? richtung(p.vx, p.vz, Math.PI) : Math.PI, { boden: steig * HELI_BODEN });
      laeufer[nr].haltGewehr('tief');
    }
  }
  // 1 steht an der Tür und winkt alle rein, steigt nach uns ein
  const eins = lt > 5.35;
  laeufer[1].root.visible = !eins; sitzer[1].root.visible = eins;
  if (!eins) {
    const wink = lt > .8 && lt < 3.6;
    laeufer[1].pose({ ...hockPose(.25), armL: wink ? [2.2 + .7 * Math.sin(t * 9), .4] : [.6, .2], ellL: wink ? .9 : 1.2, mund: redet('dach', lt, '1'), kopf: [0, 0, 0], rumpf: [.25, 0, 0] });
    laeufer[1].platziere(tuer.x + 1.5, tuer.z + .7, 0); laeufer[1].haltGewehr('tief');
    laeufer[1].j.hips.updateMatrixWorld(true);
  }
  heliTeam(h, sitzer, 'dach', lt);
  { const z2 = L('dach', 'Gibt'), z4 = L('dach', 'Nein'), auge = h.g.localToWorld(AUGE6.clone()), k2 = kopfW(sitzer[2]);
    schaueAn(sitzer[2], lt < z4.start ? auge : kopfW(sitzer[4]), fenster(z2, lt) + fenster(z4, lt)); nicken(sitzer[2], 'dach', lt, '2');
    schaueAn(sitzer[4], k2, Math.max(fenster(z2, lt, 0, 0) * .6, fenster(z4, lt))); nicken(sitzer[4], 'dach', lt, '4');
    for (const nr of [1, 7]) schaueAn(sitzer[nr], k2, fenster(z2, lt) * .8); }
  // Einweiser am Rand des Landeplatzes (Leuchtkellen), Crew-Chief an der Tür winkt rein
  { const e = DACH.einweiser, abh = lt > 4.9;
    const sw = Math.sin(t * 5);
    e.pose(abh ? { armL: [3.0, .2 + .2 * sw], armR: [3.0, .2 - .2 * sw], ellL: .2, ellR: .2, kopf: [-.2, 0, 0] } : { armL: [1.6, 1.2 + .3 * sw], armR: [1.6, 1.2 - .3 * sw], ellL: .4, ellR: .4 });
    e.platziere(6.5, -3.0, -2.2); }
  { const c = DACH.crew; const drin = lt > 5.45; c.root.visible = !drin;
    if (!drin) { c.pose({ ...hockPose(.15), armR: [1.4 + .5 * Math.sin(t * 6), .3], ellR: 1.0, armL: [.9, .2], ellL: 1.4, kopf: [0, -.3, 0] }); c.platziere(tuer.x - 1.3, tuer.z + .55, .6); } }
  // Kamera: aus dem Treppenhaus sprinten, auf die Kufe, rein, hinsetzen
  let pos, ziel;
  const sitzW = h.g.localToWorld(AUGE6.clone());
  if (lt < 3.6) {
    const p = pfad([[0, -2.0, 8.2], [.45, -2.0, 7.3], [3.6, tuer.x + .3, tuer.z + 1.25]], lt);
    const lauf = clamp(p.s / 3);
    pos = V3(p.x, 1.62 + Math.abs(Math.sin(p.dist / .85 * Math.PI)) * .06 * lauf - .12 * lauf, p.z).add(wackel(t, .012 * lauf));
    ziel = V3(tuer.x + .3, 1.3, tuer.z - 3);
  } else if (lt < 5.3) {
    // Einsteigen Schritt für Schritt: Fuß auf die Trittstufe → geduckt rein → umdrehen → hinsetzen
    const A = h.g.worldToLocal(V3(tuer.x + .3, 1.5, tuer.z + 1.25)), S = V3(-1.45, 2.02, .2), I = V3(-.5, HELI_BODEN + 1.2, .55), Z = AUGE6.clone();
    const k1 = easeInOut((lt - 3.6) / .45), k2 = easeInOut((lt - 4.05) / .5), k3 = easeInOut((lt - 4.55) / .7);
    const lp = lt < 4.05 ? A.clone().lerp(S, k1) : lt < 4.55 ? S.clone().lerp(I, k2) : I.clone().lerp(Z, k3);
    lp.y += lt < 4.05 ? Math.sin(k1 * Math.PI) * .08 : 0;
    pos = h.g.localToWorld(lp);
    const zA = V3(-.3, 1.3, -.2), zB = V3(.4, 1.1, 1.45), zC = V3(0, 1.45, -2.6), zD = V3(-3, .6, -2.2);
    const zl = zA.clone().lerp(zB, smooth(3.95, 4.5, lt)).lerp(zC, smooth(4.55, 5.0, lt)).lerp(zD, smooth(4.95, 5.3, lt));
    ziel = h.g.localToWorld(zl);
  } else {
    // sitzend: Blick nach vorne-links aus der offenen Tür, zwischendurch zu 2 und 4 (weich)
    const z2 = L('dach', 'Gibt'), z4 = L('dach', 'Nein');
    const zu2 = smooth(z2.start - .3, z2.start + .2, lt) * (1 - smooth(z4.start - .2, z4.start + .2, lt));
    const zu4 = smooth(z4.start - .2, z4.start + .2, lt);
    let zl = V3(-3, .6 - .35 * ab, -2.2);
    zl.lerp(V3(-.5, 1.5, -.82), zu2).lerp(V3(.72, 1.5, .9), zu4 * .8);
    pos = sitzW.clone().add(wackel(t, .006 + .01 * ab)); ziel = h.g.localToWorld(zl);
  }
  schau(k, pos, ziel, lt > 5.3 ? h.g.rotation.z * .6 : 0);
  pov.setze({ modus: 'gewehr', t, lauf: lt < 3.6 ? 1 : lt < 5.3 ? .4 : .15, zielen: -.3, senken: lt > 3.6 ? .4 : 0 });
  return { welt: DACH, uhr: '05:16' };
}

// ======================================================================= WELT 3: Flug (Innenraum, Tür offen, Landschaft unten)
const FLUG = (() => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0xb9c3d0); s.fog = new THREE.Fog(0xb9c3d0, 260, 1700);
  s.add(new THREE.HemisphereLight(0xe8eefc, 0x40444c, 1.3));
  const sonne = new THREE.DirectionalLight(0xffd2a6, 2.0); sonne.position.set(-6, 3, 1); s.add(sonne); s.add(sonne.target);
  const h = heliModell(); s.add(h.g); h.g.rotation.order = 'YXZ';
  const feld = liveTex(1024, 1024); { const g = feld.ctx, r = rng(3);
    for (let i = 0; i < 64; i++) { g.fillStyle = ['#7d8a6a', '#8f9c78', '#a09a7a', '#6e7c5e', '#9aa58a', '#b0a882'][(i * 7) % 6]; g.fillRect((i % 8) * 128, Math.floor(i / 8) * 128, 128, 128); }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(40,60,40,.5)'; g.beginPath(); g.arc(r() * 1024, r() * 1024, 10 + r() * 40, 0, 7); g.fill(); }
    g.fillStyle = '#4a4f57'; g.fillRect(500, 0, 30, 1024); g.fillRect(0, 300, 1024, 20); g.fillStyle = '#e9ecef'; for (let y = 0; y < 1024; y += 40) g.fillRect(514, y, 3, 20);
    for (let i = 0; i < 40; i++) { const x = r() * 900, y = r() * 900; g.fillStyle = '#8d8d8d'; g.fillRect(x, y, 22, 16); g.fillStyle = '#6b2d2d'; g.fillRect(x, y, 22, 6); }
    g.fillStyle = '#ffd27a'; for (let i = 0; i < 60; i++) g.fillRect(r() * 1024, r() * 1024, 4, 4); feld.tex.needsUpdate = true; }
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
  return { s, h, k, pov, t, feld, sonne, wolken, land, KACHEL };
})();
function s_flug(lt, t) {
  const { h, k, pov, t: tm, feld, sonne, wolken } = FLUG;
  const d = SZ('flug').d;
  FLUG.land.position.x = ((t * 48) % FLUG.KACHEL);   // wir fliegen nach −x (Nase), der Boden zieht nach +x
  for (const w of FLUG.wolken) { const u = w.userData; w.position.set(u.x, u.y, ((u.z - t * 60) % 400 + 400) % 400 - 200); w.scale.set(u.s, u.s * .5, 1); }
  const kurve = smooth(d - 3.2, d - .4, lt);
  h.g.position.set(0, 0, 0); h.g.rotation.set(-.08 + .02 * Math.sin(t * 1.7), Math.PI / 2, -.03 * Math.sin(t * .9) - .22 * kurve);
  h.g.updateMatrixWorld(true);
  heliUpdate(h, t, { kurve });
  sonne.intensity = 1.7 + .4 * (Math.sin(t * 2 * Math.PI * 4.6) > .6 ? -1 : 0);
  const z7a = L('flug', 'Ich hasse'), z6 = L('flug', 'Sieben'), z7b = L('flug', 'Dich'), z4 = L('flug', 'Jet'), z1 = L('flug', 'Kein');
  const r7 = redet('flug', lt, '7');
  heliTeam(h, tm, 'flug', lt, {
    7: { kopf: [r7 ? -.05 : .35, r7 ? .25 : -.5, 0], armL: [2.9, .1], ellL: .3, armR: lt > z7b.start ? [1.2, .2] : [.4, .1], ellR: 1.2 },
    4: { kopf: [.1, lt > z4.start - .2 ? .5 : .2, 0], armL: lt > z4.start && lt < z4.ende ? [1.9, .2, .3] : [0, .1], ellL: 1.5 },
    1: { kopf: [0, lt > z1.start - .2 ? .6 : 0, 0], armR: lt > z1.start ? [1.6 + .3 * Math.sin(t * 5), .4] : [.3, .1], ellR: .6 },
  });
  const auge = h.g.localToWorld(AUGE6.clone()), k7 = kopfW(tm[7]), k4 = kopfW(tm[4]), k1 = kopfW(tm[1]);
  schaueAn(tm[7], lt < z6.start - .1 ? h.g.localToWorld(V3(-3, .6, -1)) : auge, 1); nicken(tm[7], 'flug', lt, '7');
  if (lt > z7b.start && lt < z7b.ende + .2) tm[7].greife('R', auge.clone().lerp(weltPos(tm[7].j.chest), .55), tm[7].lokal(-.6, .6, .4));   // zeigt auf mich
  schaueAn(tm[2], fenster(z6, lt) + fenster(z7b, lt) > 0 ? auge : (fenster(z4, lt) > 0 ? k4 : (fenster(z1, lt) > 0 ? k1 : k7)), .8);
  if (fenster(z4, lt, 0, .2) > 0) handAmOhr(tm[4]);
  schaueAn(tm[4], fenster(z1, lt) > 0 ? k1 : h.g.localToWorld(V3(-3, -1, -1.5)), .7);
  if (fenster(z1, lt, 0, .2) > 0) { handAmOhr(tm[1]); }
  schaueAn(tm[1], fenster(z4, lt) > 0 ? k4 : h.g.localToWorld(V3(-3, -1, -1.5)), .8);
  schaueAn(tm[7], fenster(z4, lt) > 0 ? k4 : (fenster(z1, lt) > 0 ? k1 : k7), fenster(z4, lt) + fenster(z1, lt));
  // Kamera sitzt an der offenen Tür: Blick zu 7 (gegenüber), kurz zu 4 und 1 beim Funk, raus, nach unten in der Kurve
  const sitzW = h.g.localToWorld(AUGE6.clone());
  let zl = V3(.5, 1.6, -.82);
  const raus = smooth(z4.start - .3, z4.start + .4, lt);
  zl.lerp(V3(.72, 1.45, 1.0), .75 * smooth(z4.start - .2, z4.start + .1, lt) * (1 - smooth(z4.start + .7, z4.start + 1.0, lt)));
  // ruhige Blickführung: 7 → (Funk) kurz zu 4 → raus auf den Horizont → (Funk) zu 1 → raus. Alles weich, nie steil nach unten.
  const draussen = V3(-3.4, 1.15, -1.7);
  zl.lerp(draussen, smooth(z4.start + .9, z4.start + 1.5, lt) * (1 - smooth(z1.start - .3, z1.start + .2, lt)));
  zl.lerp(V3(.24, 1.55, .9), .65 * fenster(z1, lt, .3, .4));
  zl.lerp(draussen, smooth(z1.ende - .2, z1.ende + .5, lt));
  schau(k, sitzW.add(wackel(t, .01)), h.g.localToWorld(zl), h.g.rotation.z * .7);
  pov.setze({ modus: 'gewehr', t, senken: .4, zielen: -.25, geste: spricht6('flug', lt) });
  return { welt: FLUG, uhr: '05:24' };
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
  j.add(at(box(1.9, 1.6, .06, mat(0xd8cbb5, { r: .7 })), 0, 2.3, -11.3));
  j.add(at(box(.7, .42, .03, mat(0x0b0b0d, { e: 0x1d3557, ei: .6 })), 0, 2.55, -11.26));
  j.add(at(box(.75, 1.7, .08, holz), -.55, 2.35, -11.28)); j.add(at(box(.75, 1.7, .08, holz), .55, 2.35, -11.28));
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
    j.add(at(box(.03, .42, 9.2, creme), sx * .99, 1.78, -8.2));                                  // Lederpaneel unten
    for (let z = -4; z > -12.4; z -= .46) j.add(at(box(.032, .4, .006, mat(0xd9c9a8)), sx * .99, 1.78, z));   // Steppnähte
    j.add(at(box(.035, .015, 9.2, gold), sx * .985, 2.0, -8.2)); j.add(at(box(.035, .015, 9.2, gold), sx * .985, 2.11, -8.2));   // Goldleisten
    j.add(at(box(.02, .03, 9.2, mat(0xfff1d6, { e: 0xffd9a0, ei: 2.5 })), sx * .95, 1.56, -8.2));   // Bodenlicht
  }
  for (let z = -4; z > -11; z -= .9) j.add(at(box(1.3, .03, .8, mat(0xf6efe2, { r: .5 })), 0, 3.47, z - .45));   // Deckenkassetten
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
  bildschirm(pfd, -.55, 2.27, -.38); bildschirm(nd, -.28, 2.27, -.36); bildschirm(nd, .28, 2.27, -.36); bildschirm(pfd, .55, 2.27, -.38);
  j.add(at(box(1.5, .07, .16, mat(0x1b1d21)), 0, 2.48, -.42, .2)); for (let k = 0; k < 14; k++) j.add(at(box(.035, .02, .02, mat(0x000000, { e: [0x80ed99, 0xffd166][k % 2], ei: 2 })), -.6 + k * .093, 2.5, -.36));   // Autopilot-Panel
  const ov = canvasTexEp('jetOverhead', 256, 128, (g, w, h) => { g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h); for (let y = 10; y < h; y += 22) for (let x = 10; x < w; x += 20) { g.fillStyle = '#d0d0d0'; g.fillRect(x, y, 6, 10); if ((x + y) % 3 === 0) { g.fillStyle = '#ffd166'; g.fillRect(x + 8, y, 6, 4); } } });
  j.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.85, .45), new THREE.MeshStandardMaterial({ map: ov, emissive: 0xffffff, emissiveMap: ov, emissiveIntensity: .25 })), 0, 3.21, -.9, Math.PI / 2 + .3));
  j.add(at(box(.3, .12, .55, mat(0x1b1d21)), 0, 1.98, -1.05)); for (const x of [-.06, .06]) { j.add(at(cyl(.012, .012, .18, chrom, 6), x, 2.1, -1.05, -.4)); j.add(at(box(.05, .03, .03, mat(0x111111)), x, 2.18, -1.0)); }   // Schubhebel
  for (const x of [-.4, .4]) { j.add(at(box(.46, .1, .46, mat(0xf1ece2, { r: 1 })), x, 1.98, -1.45)); j.add(at(box(.46, .6, .06, mat(0xf1ece2, { r: 1 })), x, 2.3, -1.68));   // Lammfell
    j.add(at(new THREE.Mesh(new THREE.TorusGeometry(.08, .012, 6, 14, Math.PI), mat(0x111111)), x + (x > 0 ? .3 : -.3), 2.55, -1.3)); }   // Headsets am Haken
  j.add(at(box(.18, .24, .02, mat(0x1d3557)), .42, 2.0, -.75, -.5));   // Checklisten-Mappe

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
  j.add(at(box(.04, .16, 1.3, streifen), R0 + .005, Y - .25, -1.9)); j.add(at(box(.04, .16, 11.2, streifen), R0 + .005, Y - .25, -9.15));   // Zierstreifen rechts mit Lücke für die Tür j.add(at(box(.04, .16, 13.5, streifen), -R0 - .005, Y - .25, -8));
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
  j.add(at(box(1.95, .3, .06, mat(0xd8cbb5)), 0, 3.32, -2.45));
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
  for (const z of [-3.5, -6.5, -9.5]) { const l = new THREE.PointLight(0xffe2b8, 9, 9, 1.4); l.position.set(0, 3.2, z); j.add(l); }
  j.add(at(box(.3, .02, 10, mat(0xfff6e0, { e: 0xffe2b8, ei: 1.5 })), 0, 3.5, -7.5));
  // Cockpit: zwei Sitze, Instrumente
  for (const x of [-.4, .4]) { const g = new THREE.Group(); g.add(at(box(.5, .12, .5, mat(0x2b2d31)), 0, .45, 0)); g.add(at(box(.5, .7, .1, mat(0x2b2d31)), 0, .8, -.25)); g.position.set(x, 1.5, -1.45); j.add(g); }
  j.add(at(box(1.6, .35, .4, mat(0x1b1d21, { e: 0x2a6f97, ei: .5 })), 0, 2.2, -.55));
  for (const x of [-.45, -.15, .15, .45]) j.add(at(box(.25, .18, .02, mat(0x0d1b2a, { e: [0x4cc9f0, 0x80ed99, 0xffd166, 0x4cc9f0][Math.round((x + .45) / .3)], ei: .9 })), x, 2.25, -.34, -.3));
  for (const x of [-.4, .4]) { j.add(at(cyl(.015, .015, .3, mat(0x222222), 6), x, 1.95, -.85, -.6)); j.add(at(box(.18, .05, .04, mat(0x222222)), x, 2.05, -.95)); }
  j.add(at(box(.9, .06, .5, mat(0x1b1d21)), 0, 3.25, -.9));
  return { j, pivot, tuer, raeder, licht };
}


const VF = (() => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0xc9cdd3); s.fog = new THREE.Fog(0xc9cdd3, 18, 340);
  s.add(new THREE.HemisphereLight(0xe9eef7, 0x6a6660, 1.7));
  const fuell = new THREE.DirectionalLight(0xdfe6f2, .9); fuell.position.set(30, 10, 40); s.add(fuell);
  const sonne = new THREE.DirectionalLight(0xffd4ab, 1.6); sonne.position.set(-25, 18, 20); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048);
  Object.assign(sonne.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 }); s.add(sonne); s.add(sonne.target);
  s.add(bodenPlatte(700, 700, mat(0x8e9298, { r: .6, map: betonTex('#8e9298', [80, 80], 'vorfeld') }), 0, -60));
  for (let z = 20; z > -180; z -= 6) s.add(at(box(.18, .01, 3.6, mat(0xf2c14e, { e: 0x4a3a10, ei: .3 })), 0, .006, z));   // Mittellinie
  const fa = flughafen(s);
  const jet = jetDetails(bauJet(s));
  const expl = new Explosion(s, V3(0, 0, 0), { groesse: .85, richtung: V3(1, .3, 0), seed: 9, truemmer: 28, farbe: 0xdee2e6 });
  const rauch = new Schwaden(s, V3(0, 0, 0), 8, 4);
  const k = kamera(s, 74); const pov = new Pov(k); pov.tief = .07;
  const t = { 1: teamOps(s, 1), 2: teamOps(s, 2), 4: teamOps(s, 4), 7: teamOps(s, 7) };
  const schild2 = schildModell(); t[2].j.elL.add(schild2); schild2.position.set(.02, -.2, .12); schild2.rotation.set(-1.4, 0, 0);
  const schildAb = schildModell(); s.add(schildAb); schildAb.visible = false;
  const pilot = new Figur({ art: 'zivil', jacke: 0xf8f9fa, hose: 0x212529, kappe: 0x1d3557, haut: 0xe8b98a, groesse: 1.78, hemd: true, krawatte: 0x1d3557, schulterklappen: true }); s.add(pilot.root);
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
  return { s, k, pov, jet, expl, rauch, t, kegel, such, schild2, schildAb, pilot, gorilla, schellen, tablet, ts, heli, wind, qualm, sonne, fa, crew, seilHaufen, feuerwehr, blau };
})();

const NASE_STOP = -10;          // Nasenspitze des Jets (Welt-z), wenn er steht
const TUER_Z = NASE_STOP - 3.05, TUER_X = 1.16;
const RAMPE_X = TUER_X + .9;    // Ende der Treppe auf dem Boden
const rampeH = x => clamp((RAMPE_X - x) / (RAMPE_X - TUER_X)) * 1.5;
const JB = { tb: 5.0, v0: 11, ab: 5.5 };
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
  // Flughafenfeuerwehr rückt mit Blaulicht an (fährt auf dem Parallelweg rechts)
  { const z = 60 - ((t * 9) % 260); VF.feuerwehr.position.set(28, 0, z); VF.feuerwehr.rotation.y = Math.PI; VF.blau.forEach((m, i) => { m.emissiveIntensity = Math.floor(t * 6 + i) % 2 ? 6 : .3; }); }
  VF.jet.beacon.forEach((m, i) => { m.emissiveIntensity = ((t + i * .5) * 1.2) % 1 < .12 ? 7 : .3; });
  // Hubschrauber kreist weiter oben (Sicherung aus der Luft)
  const h = VF.heli; h.g.position.set(-14 + 4 * Math.sin(t * .3), 17, -6 + 3 * Math.cos(t * .3)); h.g.rotation.set(-.05, -Math.PI / 2 + .3 * Math.sin(t * .3), .04);
  heliUpdate(h, t);
}
function stelleJet(nz, nick = 0) {
  const j = VF.jet; j.j.position.set(0, 0, nz); j.j.rotation.set(-nick, 0, 0);
}
function pilotSitzt(lt, haendeHoch, blickZurueck, szene = 'kabine') {
  VF.pilot.pose({ beinL: [1.5, 1.55], beinR: [1.45, 1.5], armL: haendeHoch ? [2.9, .35] : [1.1, .1], ellL: haendeHoch ? .5 : .6, armR: haendeHoch ? [2.9, .35] : [1.1, .1], ellR: haendeHoch ? .5 : .6,
    kopf: [0, blickZurueck ? 2.2 : 0, 0], mund: redet(szene, lt, 'P') });
  const p = VF.jet.j.localToWorld(V3(.4, 0, -1.45));
  VF.pilot.platziere(p.x, p.z, 0, { hoehe: 1.5 + .5 - .98 * VF.pilot.root.scale.x + .04 });
}

// ---------------------------------------------------------------- Abseilen (Hubschrauber schwebt vor dem rollenden Jet)
const HH = 11.5;                 // Schwebehöhe
const HELI_AB = V3(0, HH, 3.6);
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
function s_abseilen(lt, t) {
  vfStandard(t);
  const { k, pov, t: tm, jet, heli: h, wind } = VF;
  const d = SZ('abseilen').d;
  // Hubschrauber: schwebt, Tür links zeigt zum Jet (−z); am Ende steigt er weg
  const weg = smooth(7.3, d + 1.2, lt);
  h.g.position.set(HELI_AB.x + .25 * Math.sin(t * .8) + 6 * weg, HELI_AB.y + .2 * Math.sin(t * 1.1) + 7 * weg, HELI_AB.z + .15 * Math.cos(t * .7));
  h.g.rotation.set(.03 * Math.sin(t * .9), -Math.PI / 2, .04 * Math.sin(t * .6) - .1 * weg);
  h.g.updateMatrixWorld(true);
  heliUpdate(h, t);
  const fuss = h.g.localToWorld(V3(-1.6, 0, -.05)); fuss.y = 0;
  wind.update(t, 1 - weg * .7, V3(fuss.x, 0, fuss.z + 1.5), 0, k);
  // Seil fällt
  const raus = easeOut(clamp((lt - .25) / .6));
  const seil = setzeSeil(h, lerp(HH + 1.5, 0, raus), .02 * Math.sin(t * 2));
  VF.seilHaufen.visible = raus > .98; VF.seilHaufen.position.set(seil.oben.x, 0, seil.oben.z);
  // Crew-Chief kniet an der Tür, sichert das Seil und gibt Zeichen
  { const c = VF.crew; c.root.visible = true; c.pose({ ...hockPose(.7), armL: [1.3, .1], ellL: .7, armR: lt < 1.2 ? [2.6, .3] : [1.5, .2], ellR: .4, kopf: [.5, -.4, 0] });
    c.platziere(-.95, -.8, -Math.PI / 2, { boden: h.g.localToWorld(V3(-.95, HELI_BODEN, -.8)).y });
    c.greife('L', h.g.localToWorld(V3(-1.55, HELI_BODEN + 1.2, -.05)), c.lokal(.5, 1.2, .3)); }
  // Jet rollt heran, bremst, Reifenqualm
  const nz = jetZ(lt), brems = lt > JB.tb && lt < JB.tb + 2.2 ? Math.sin((lt - JB.tb) / 2.2 * Math.PI) * .035 : 0;
  stelleJet(nz, brems); jet.licht.forEach(l => { l.intensity = 160; }); jet.pivot.rotation.z = 0;
  jet.raeder.forEach(r => { r.rotation.x = -t * 9 * (lt < JB.tb + 2 ? 1 : 0); });
  VF.qualm.forEach(q => {
    const u = q.userData, dt = lt - JB.tb - u.ph * 1.8; q.visible = dt > 0 && lt < JB.tb + 4;
    if (!q.visible) return;
    const quelle = jet.j.localToWorld(V3(u.seite * 1.3, .2, -9));
    q.position.set(quelle.x + u.seite * dt * .6, .3 + dt * .7, quelle.z - dt * 1.5);
    const sz = .8 + dt * 2.2; q.scale.set(sz, sz, 1); q.material.opacity = .55 * clamp(1 - dt / 2.2);
  });
  pilotSitzt(lt, false, false, 'abseilen'); VF.gorilla.root.visible = false;
  // 2 rutscht zuerst ab, landet, sichert
  const r2a = 1.4, r2b = 2.7;
  const seilX = seil.oben.x, seilZ = seil.oben.z;
  for (const nr of [1, 4, 7]) tm[nr].root.visible = false;
  // 1 kniet im Heli hinter der Tür und gibt das Seil frei (ruft, zeigt runter)
  if (lt < 3.2) { const f = tm[1]; f.root.visible = true; const w = h.g.localToWorld(V3(-.3, 0, .05));
    f.pose({ ...hockPose(.55), mund: redet('abseilen', lt, '1'), armR: lt < 1.9 ? [2.4 + .3 * Math.sin(t * 8), .3] : [1.2, .2], ellR: .4 });
    f.platziere(w.x, w.z, Math.PI * .75, { boden: h.g.localToWorld(V3(-.3, HELI_BODEN, .05)).y }); f.haltGewehr('tief');
    schaueAn(f, k.position, 1); nicken(f, 'abseilen', lt, '1'); }
  {
    const f = tm[2];
    VF.schild2.visible = lt > r2b;
    if (lt < r2a) { f.root.visible = false; }
    else if (lt < r2b + .3) rutschen(f, r2a, r2b, seilX, seilZ, lt);
    else {
      const p = pfad([[r2b + .3, seilX, seilZ + .25], [r2b + .9, seilX + 1.6, seilZ - 1.0], [5.7, seilX + 1.6, seilZ - 1.0], [d, 1.6, -9.9]], lt);
      f.pose(p.s > .05 ? rennPose(p.dist / .9 * Math.PI, { neig: .3 }) : hockPose(.45)); f.platziere(p.x, p.z, p.s > .05 ? richtung(p.vx, p.vz, Math.PI) : Math.PI); f.haltGewehr(p.s > .05 ? 'tief' : 'anschlag');
    }
  }
  // 4 + 7 + 1 kommen nach uns runter und überholen uns im Sprint
  // Laufwege mit Abstand (geprüft: nie näher als 1,4 m aneinander oder an der Kamera)
  const nach = { 4: [[6.95, seilX - .7, seilZ + .2], [d, .9, -8.7]], 7: [[7.25, seilX - 1.3, seilZ + .6], [d, 2.3, -7.6]], 1: [[7.55, seilX - .4, seilZ + .9], [d, .2, -6.4]] };
  if (lt > 5.8 && lt < 6.95) rutschen(tm[4], 5.8, 6.65, seilX, seilZ, lt);   // 4 kommt direkt nach uns am Seil runter
  for (const nr of [4, 7, 1]) {
    if (lt < nach[nr][0][0]) continue;
    const p = pfad(nach[nr], lt); tm[nr].root.visible = true;
    tm[nr].pose(rennPose(p.dist / .9 * Math.PI, { neig: .35 })); tm[nr].platziere(p.x, p.z, richtung(p.vx, p.vz, Math.PI));
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
    const p = pfad([[unten + .35, seilX + .06, seilZ + .36], [d, 3.4, -5.8]], lt);
    const lauf = clamp(p.s / 3);
    pos = V3(p.x, 1.62 - Math.max(0, stoss) - .1 * lauf + Math.abs(Math.sin(p.dist / .85 * Math.PI)) * .05 * lauf, p.z);
    ziel = V3(1.2, 1.9, TUER_Z).lerp(nase, 1 - smooth(unten + .5, unten + 1.6, lt));
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
  } else pov.setze({ modus: 'gewehr', t, lauf: lt > unten + .4 ? 1 : .1, zielen: lt > unten ? -.1 : -.35, senken: lt < g0 ? .3 : 0 });
  return { welt: VF, uhr: '05:31' };
}

// ---------------------------------------------------------------- Tür (Ladung, Countdown, Sprengung, Treppe)
const TS = SZ('tuer'); const VERZUG = TS.verzug ?? 0;
const MARKEN = TS.marken ?? [2.6 + VERZUG, 3.3 + VERZUG, 4.0 + VERZUG];
const SPRENG = 4.9 + VERZUG;
function s_tuer(lt, t) {
  vfStandard(t);
  const { k, pov, t: tm, jet } = VF;
  stelleJet(NASE_STOP); jet.licht.forEach(l => { l.intensity = 90; }); VF.heli.g.visible = true;
  { const h = VF.heli; h.g.position.set(-14 + .6 * Math.sin(t * .4), 8.5 + .3 * Math.sin(t * .7), -32); h.g.rotation.set(-.08, -.6, .03 * Math.sin(t * .5)); h.g.updateMatrixWorld(true); heliUpdate(h, t);
    const quelle = h.g.localToWorld(V3(.4, HELI_BODEN - .4, -2.4)), zielL = V3(1.2, 1.6, TUER_Z - .3 + Math.sin(t * .6) * .8);
    VF.kegel.visible = true; VF.kegel.position.copy(quelle); VF.kegel.quaternion.setFromUnitVectors(V3(0, -1, 0), zielL.clone().sub(quelle).normalize());
    VF.such.position.copy(quelle); VF.such.target.position.copy(zielL); VF.such.intensity = 300; }
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
    2: lt < 1.9 ? [[0, 1.62, -13.1]] : [[1.9, 1.62, -13.1], [2.6, 2.4, -14.0], [zugriff, 2.4, -14.0], [zugriff + .3, 2.2, -13.05], [zugriff + .9, 1.2, -13.05], [zugriff + 1.35, .1, -13.45], [zugriff + 2.4, -.15, -15.2]],
    1: [[0, 2.7, -11.0], [zugriff + .6, 2.7, -11.0], [zugriff + 1.0, 2.25, -13.05], [zugriff + 1.7, 1.2, -13.05], [zugriff + 2.2, .15, -12.7]],
    4: [[0, 2.95, -15.0], [zugriff + 1.3, 2.95, -15.0], [zugriff + 1.7, 2.25, -13.05], [zugriff + 2.4, 1.2, -13.05], [zugriff + 2.9, -.35, -13.0]],
    7: [[0, 3.6, -15.6]],
  };
  for (const nr of [1, 2, 4, 7]) {
    const p = pfad(plan[nr], lt); const geht = p.s > .05;
    let yaw = geht ? richtung(p.vx, p.vz, -Math.PI / 2) : (nr === 2 ? (lt < 2.6 ? -Math.PI / 2 : -.95) : nr === 1 ? -2.1 : nr === 4 ? -.75 : -.75);
    const duck = d > -.1 && d < 1.3 ? Math.sin(clamp((d + .1) / 1.4) * Math.PI) : 0;
    let P = geht ? gehPose(p.dist / .65 * Math.PI, { hocke: .2, arme: false }) : hockPose(.45);
    P.rumpf = [.25 + .5 * duck, 0, 0]; P.kopf = [.4 * duck, 0, 0];
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
    else tm[nr].haltGewehr(lt > zugriff ? 'anschlag' : 'tief');
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
  k.rotation.x -= .08 * duckIch; k.updateMatrixWorld(true);
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
    tm[2].platziere(-.2, -15.3, Math.PI, { boden: 1.5 }); tm[2].haltGewehr('anschlag');
  } else {
    const kk = smooth(0, .45, nach);
    tm[2].pose({ beinL: [1.4 * kk, 2.0 * kk], beinR: [.2 + .6 * kk, 1.8 * kk], rumpf: [.45 + .4 * kk, 0, 0], kopf: [.2, 0, 0], armL: [1.3, .2], ellL: .4, armR: [1.3, .2], ellR: .4, mund: redet('kabine', lt, '2') });
    tm[2].platziere(lerp(-.2, -.44, kk), lerp(-15.3, -16.5, kk), lerp(Math.PI, Math.PI / 2, kk), { boden: 1.5 }); tm[2].ohneGewehr();
    if (nach > .45) {
      const r = gorilla.j.chest.localToWorld(V3(0, .15, -.15));
      tm[2].greife('L', r.clone().add(V3(.15, .05, 0)), tm[2].lokal(.6, 1.4, -.2));
      tm[2].greife('R', nach > 1.6 ? weltPos(gorilla.j.haL).add(V3(-.04, .04, 0)) : r.clone().add(V3(-.15, .05, 0)), tm[2].lokal(-.6, 1.4, -.2));
    }
  }
  tm[1].pose({ beinL: [.35, .5], beinR: [-.05, .45], rumpf: [.3, 0, 0], kopf: [-.15, 0, 0] }); tm[1].platziere(-.22, -12.7, .15, { boden: 1.5 }); tm[1].haltGewehr('anschlag');
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
  else pov.setze({ modus: 'gewehr', t, lauf: lt < 1.7 ? .7 : .1, zielen: .1 + .1 * smooth(0, .6, lt), senken: .35 * smooth(0, .5, lt) * (1 - smooth(1.7, 2.2, lt)) + .5 * smooth(tackle, tackle + .5, lt), lampe: 12 * smooth(0, .6, lt), geste: spricht6('kabine', lt) });
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
  if (lt < schnitt) { const r = s_abseilen(4.25 + lt, SZ('abseilen').start + 4.25 + lt); return { ...r, titel: true, blitz: lt > schnitt - .12 ? (lt - (schnitt - .12)) / .12 : 0 }; }
  const a = SPRENG - .15, zl = lt < freeze ? a + (lt - schnitt) : (sp > 0 ? a + (freeze - schnitt) - sp * 2.2 : a + (freeze - schnitt));
  const r = s_tuer(zl, SZ('tuer').start + zl);
  return { ...r, blitz: Math.max(r.blitz ?? 0, lt < schnitt + .1 ? 1 - (lt - schnitt) / .1 : 0), sat: lt > freeze ? .15 : 1, mitte: lt > freeze + .15 ? { text: 'Wie es dazu kam?', k: lt - freeze - .15 } : null, spulen: sp > 0 ? 1 : 0, titel: lt < 2.6 };
}

// ======================================================================= UI + Hauptschleife
const ui = {
  sub: document.getElementById('sub'), wer: document.getElementById('wer'), txt: document.getElementById('txt'),
  rec: document.getElementById('rec'), mic: document.getElementById('mic'), uhr: document.getElementById('uhr'), karte: document.getElementById('karte'),
  mitte: document.getElementById('mitte'), ende: document.getElementById('ende'), zeit: document.getElementById('zeitsprung'), titel: document.getElementById('titel'),
};
function zeigeUI(n, lt, r, t) {
  const z = zeile(n, lt);
  if (z) { const [name, farbe] = TL.sprecher[z.wer]; ui.sub.style.opacity = clamp((lt - z.start) / .12) * clamp((z.ende - lt) / .12); ui.wer.textContent = name; ui.wer.style.color = farbe; ui.txt.textContent = z.text; }
  else ui.sub.style.opacity = 0;
  ui.uhr.textContent = `${r.uhr ?? '05:30'}:${String(Math.floor(lt) % 60).padStart(2, '0')}`;
  ui.rec.style.opacity = Math.floor(t * 2) % 2 ? 1 : .25;
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
const SZENEN = { hook: s_hook, hq: s_hq, dach: s_dach, flug: s_flug, abseilen: s_abseilen, tuer: s_tuer, kabine: s_kabine, twist: s_twist };
const KARTE = { abseilen: ['05:31 · ZUGRIFFSORT', 'Flughafen · Vorfeld Ost'], dach: ['05:16 · ABFLUG', 'Hauptquartier · Dach'] };
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
  POST.fertig({ ...post, zeit: t, blitz: Math.max(r.blitz ?? 0, weiss), sat: r.sat ?? 1, spulen: r.spulen ?? 0, rot: r.rot ?? 0 });
  zeigeUI(s.n, lt, r, t);
  await new Promise(res => requestAnimationFrame(() => res()));
};
window.dauer = TL.dauer; window.__VF = VF; window.__THREE = THREE;
window.bereit = true;
