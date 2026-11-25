// Detaillierter Flughafen: Vorfeld-Markierungen, Rollweg, Startbahn, Terminal mit Fluggastbrücken, Tower,
// Hangars, Vorfeld-Fahrzeuge, Flutlichtmasten, Windsack, Schilder, geparkte Verkehrsflugzeuge im Nebel.
import { THREE, mat, box, cyl, sph, at, canvasTex, textTex, rng } from './kern.js';

const fensterTex = (key, { reihen = 6, spalten = 24, hell = .5 } = {}) => canvasTex('fenster' + key, 1024, 512, (g, w, h) => {
  const r = rng(7);
  g.fillStyle = '#1c2430'; g.fillRect(0, 0, w, h);
  const cw = w / spalten, rh = h / reihen;
  for (let y = 0; y < reihen; y++) for (let x = 0; x < spalten; x++) {
    const an = r() < hell;
    g.fillStyle = an ? `rgb(${230 + r() * 25},${200 + r() * 40},${150 + r() * 50})` : `rgb(${40 + r() * 30},${55 + r() * 30},${75 + r() * 30})`;
    g.fillRect(x * cw + 3, y * rh + 4, cw - 6, rh - 8);
  }
  g.fillStyle = '#9aa3ad'; for (let x = 0; x <= spalten; x++) g.fillRect(x * cw - 2, 0, 4, h);
});

function schildTafel(s, text, x, z, ry, gelb = true) {
  const t = textTex('tw' + text, text, { w: 512, h: 160, farbe: gelb ? '#111111' : '#ffd60a', grund: gelb ? '#ffd60a' : '#111111', font: 'bold 110px DejaVu Sans' });
  const g = new THREE.Group();
  g.add(at(box(1.6, .55, .12, mat(0x222222)), 0, .45, 0));
  for (const sz of [1, -1]) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, .47), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35 })), 0, .45, sz * .065, 0, sz > 0 ? 0 : Math.PI));
  for (const sx of [-.6, .6]) g.add(at(cyl(.03, .03, .2, mat(0x777777), 6), sx, .1, 0));
  g.position.set(x, 0, z); g.rotation.y = ry; s.add(g);
}

export function verkehrsflugzeug(s, x, z, ry, { farbe = 0xf1f3f5, akzent = 0x0b5394, skala = 1 } = {}) {
  const g = new THREE.Group(); const lack = mat(farbe, { r: .35, m: .1 }), ak = mat(akzent, { r: .4 }), dunkel = mat(0x1b1d21);
  const R = 2.0;
  { const r = cyl(R, R, 30, lack, 28); r.rotation.x = Math.PI / 2; r.position.set(0, 3.6, 0); g.add(r); }
  { const n = sph(R, lack, 24, 16); n.scale.set(1, 1, 1.6); n.position.set(0, 3.6, -15); g.add(n); }
  { const h = cyl(R, .35, 8, lack, 24); h.rotation.x = -Math.PI / 2; h.position.set(0, 3.9, 19); g.add(h); }
  g.add(at(box(.3, 6, 4, ak), 0, 8, 21.5, -.4));
  g.add(at(box(11, .2, 3, lack), 0, 5, 21.5));
  for (const sx of [1, -1]) {
    const f = box(15, .35, 5, lack); f.position.set(sx * 8.5, 2.5, 1); f.rotation.y = sx * .45; g.add(f);
    const tw = cyl(1.1, 1.0, 4, lack, 20); tw.rotation.x = Math.PI / 2; tw.position.set(sx * 6, 1.6, -1); g.add(tw);
    g.add(at(cyl(.95, .95, .05, dunkel, 20), sx * 6, 1.6, -3.05, Math.PI / 2));
  }
  g.add(at(box(.05, .6, 26, ak), R + .01, 3.4, 0)); g.add(at(box(.05, .6, 26, ak), -R - .01, 3.4, 0));
  for (const sx of [1, -1]) for (let k = 0; k < 24; k++) g.add(at(box(.02, .3, .22, dunkel), sx * (R + .02), 4.2, -12 + k * 1.1));
  for (const [gx, gz] of [[0, -12], [2.2, 2], [-2.2, 2]]) { g.add(at(cyl(.12, .12, 1.4, mat(0x8d99ae, { m: .7 }), 8), gx, .9, gz)); g.add(at(cyl(.5, .5, .5, dunkel, 14), gx, .5, gz, 0, 0, Math.PI / 2)); }
  g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(skala); s.add(g); return g;
}

function tankwagen(s, x, z, ry) {
  const g = new THREE.Group();
  g.add(at(box(2.4, 2.0, 2.0, mat(0xf1f3f5, { r: .5 })), 0, 1.5, -3.2));
  g.add(at(box(2.2, .8, .05, mat(0x223344, { r: .1, m: .5 })), 0, 2.0, -4.22));
  { const t = cyl(1.15, 1.15, 6, mat(0xd9d9d9, { r: .35, m: .5 }), 24); t.rotation.x = Math.PI / 2; t.position.set(0, 1.8, 1.2); g.add(t); }
  g.add(at(box(2.32, .3, 6, mat(0xe63946)), 0, 1.0, 1.2));
  for (const zz of [-3.2, -.2, 2.8]) for (const sx of [-1.05, 1.05]) g.add(at(cyl(.48, .48, .35, mat(0x111111), 16), sx, .48, zz, 0, 0, Math.PI / 2));
  g.add(at(box(.4, .2, .2, mat(0xffa500, { e: 0xffa500, ei: 2 })), 0, 2.6, -3.2));
  g.position.set(x, 0, z); g.rotation.y = ry; s.add(g); return g;
}
function gepaeckzug(s, x, z, ry) {
  const g = new THREE.Group();
  g.add(at(box(1.3, .9, 1.8, mat(0xffc300, { r: .5 })), 0, .75, 0)); g.add(at(box(1.1, .6, .6, mat(0x1b1d21)), 0, 1.4, .3));
  for (const sx of [-.6, .6]) for (const zz of [-.6, .6]) g.add(at(cyl(.28, .28, .2, mat(0x111111), 12), sx, .28, zz, 0, 0, Math.PI / 2));
  const r = rng(3);
  for (let k = 0; k < 3; k++) {
    const zz = 2.4 + k * 2.6;
    g.add(at(box(1.5, .1, 2.2, mat(0x6c757d, { m: .5 })), 0, .55, zz));
    for (const sx of [-.7, .7]) g.add(at(box(.04, 1.4, 2.2, mat(0x495057)), sx, 1.2, zz));
    g.add(at(box(1.5, .05, 2.2, mat(0x495057)), 0, 1.92, zz));
    for (let b = 0; b < 4; b++) g.add(at(box(.5 + r() * .2, .35, .7, mat([0x264653, 0x9d0208, 0x343a40, 0x6a4c93][b])), -.3 + (b % 2) * .6, .8, zz - .5 + Math.floor(b / 2) * .9));
    for (const sx of [-.65, .65]) g.add(at(cyl(.2, .2, .15, mat(0x111111), 10), sx, .2, zz, 0, 0, Math.PI / 2));
  }
  g.position.set(x, 0, z); g.rotation.y = ry; s.add(g); return g;
}
function treppenwagen(s, x, z, ry) {
  const g = new THREE.Group();
  g.add(at(box(2.0, 1.2, 4.5, mat(0xf1f3f5)), 0, .9, 0));
  g.add(at(box(1.8, .9, 1.2, mat(0x223344, { r: .1, m: .5 })), 0, 1.9, -1.8));
  const tr = new THREE.Group(); tr.position.set(0, 1.5, 2.2); tr.rotation.x = .55; g.add(tr);
  for (let k = 0; k < 12; k++) tr.add(at(box(1.2, .06, .3, mat(0x8d99ae, { m: .6 })), 0, k * .22, -k * .3 * 0 + k * .02));
  for (const sx of [-.65, .65]) tr.add(at(box(.06, 3.0, .06, mat(0xffc300)), sx, 1.6, .1));
  for (const sx of [-.9, .9]) for (const zz of [-1.6, 1.6]) g.add(at(cyl(.38, .38, .25, mat(0x111111), 12), sx, .38, zz, 0, 0, Math.PI / 2));
  g.position.set(x, 0, z); g.rotation.y = ry; s.add(g); return g;
}
function huetchen(s, x, z) { s.add(at(cyl(.02, .14, .45, mat(0xff6b00, { r: .6 }), 12), x, .23, z)); s.add(at(cyl(.07, .1, .08, mat(0xffffff), 12), x, .28, z)); }

export function flughafen(s) {
  const fa = {};
  // Markierungen Vorfeld
  const gelb = mat(0xf2c14e, { e: 0x4a3a10, ei: .3 }), weiss = mat(0xf1f3f5, { e: 0x333333, ei: .2 });
  for (const x of [-6, 6]) s.add(at(box(.15, .01, 230, gelb), x, .006, -60));                       // Rollweg-Randlinien
  for (let z = 30; z > -170; z -= 4) s.add(at(box(.12, .01, 2.2, gelb), -6.4, .006, z));          // doppelte Randlinie gestrichelt
  for (let z = 25; z > -170; z -= 18) s.add(at(box(1.2, .01, .12, weiss), 0, .006, z));          // Querstriche
  // Abstellpositionen rechts (Lead-in-Linien + Nummern)
  for (let k = 0; k < 5; k++) {
    const z = 12 - k * 30;
    s.add(at(box(14, .01, .15, gelb), 14, .006, z)); s.add(at(box(.15, .01, 8, gelb), 21, .006, z - 4));
    const nr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: textTex('pos' + k, 'E' + (k + 1), { w: 256, h: 128, farbe: '#f2c14e', font: 'bold 100px DejaVu Sans' }), transparent: true, roughness: .8 }));
    nr.rotation.x = -Math.PI / 2; nr.position.set(18, .008, z + 2.5); s.add(nr);
  }
  // Startbahn quer im Hintergrund
  s.add(at(box(600, .02, 45, mat(0x3d4047, { r: .8 })), 0, .003, -200));
  for (let x = -280; x < 280; x += 30) s.add(at(box(18, .01, .9, weiss), x, .015, -200));
  for (let k = 0; k < 12; k++) s.add(at(box(1.8, .01, 30, weiss), -260 + (k % 6) * 3 * (k < 6 ? 1 : -1) + (k < 6 ? 0 : 520), .015, -200));
  for (const z of [-222.5, -177.5]) for (let x = -280; x < 280; x += 20) s.add(at(sph(.18, mat(0xffffff, { e: 0xffffff, ei: 3 }), 6, 4), x, .2, z));
  for (const x of [-6.6, 6.6]) for (let z = 30; z > -170; z -= 12) { s.add(at(cyl(.06, .06, .35, mat(0x555555), 6), x, .17, z)); s.add(at(sph(.1, mat(0x3a7bff, { e: 0x3a7bff, ei: 5 }), 8, 6), x, .4, z)); }
  for (let z = 20; z > -170; z -= 5) s.add(at(sph(.07, mat(0x30ff60, { e: 0x30ff60, ei: 4 }), 6, 4), 0, .03, z));          // grüne Mittellinienfeuer
  // Rollhalt-Markierung + Schilder
  for (let k = 0; k < 4; k++) s.add(at(box(12, .01, .15, gelb), 0, .006, -160 - k * .5));
  schildTafel(s, 'A3 →', -8.5, -20, 0); schildTafel(s, '← B  A', 8.5, -45, 0, false); schildTafel(s, '27 - 09', -8.5, -150, 0, false);
  // Terminal links: Glasfassade, Dach, Fluggastbrücken
  const term = new THREE.Group(); s.add(term);
  term.add(at(box(14, 12, 160, mat(0x9aa3ad, { r: .6 })), -52, 6, -50));
  const ft = fensterTex('term', { reihen: 3, spalten: 40, hell: .55 }); ft.repeat.set(1, 1);
  term.add(at(new THREE.Mesh(new THREE.PlaneGeometry(160, 9), new THREE.MeshStandardMaterial({ map: ft, emissive: 0xffe2b0, emissiveMap: ft, emissiveIntensity: .45, roughness: .15, metalness: .3 })), -44.9, 6.5, -50, 0, Math.PI / 2));
  term.add(at(box(16, .8, 162, mat(0xced4da)), -52, 12.4, -50));
  for (let k = 0; k < 4; k++) {
    const z = 10 - k * 40;
    const br = new THREE.Group(); br.position.set(-45, 0, z); term.add(br);
    br.add(at(box(14, 2.6, 2.4, mat(0xb0b8c1, { r: .5, m: .3 })), 7, 4.6, 0));
    br.add(at(box(3, 3, 3, mat(0x8d99ae)), 14.5, 4.6, 0));
    br.add(at(cyl(.3, .3, 3.4, mat(0x6c757d), 10), 12, 1.7, 0));
    for (const sz of [-.8, .8]) br.add(at(cyl(.35, .35, .3, mat(0x111111), 10), 12, .35, sz, 0, 0, Math.PI / 2));
    if (k > 0) verkehrsflugzeug(s, -18, z - 4, Math.PI / 2 + .02 * k, { akzent: [0x0b5394, 0x9d0208, 0x2d6a4f][k - 1] });
  }
  // Tower
  const tow = new THREE.Group(); tow.position.set(-75, 0, -115); s.add(tow);
  tow.add(at(cyl(3, 4, 34, mat(0xadb5bd, { r: .6 }), 20), 0, 17, 0));
  for (let y = 4; y < 33; y += 3) tow.add(at(cyl(3.05 + (34 - y) / 34 * .95, 3.05 + (34 - y) / 34 * .95, .2, mat(0x8d99ae), 20), 0, y, 0));
  tow.add(at(cyl(6, 4.5, 2, mat(0x6c757d), 20), 0, 35, 0));
  tow.add(at(cyl(6.3, 5.6, 3.4, new THREE.MeshStandardMaterial({ color: 0x2c4a6b, emissive: 0x88bbff, emissiveIntensity: .35, roughness: .1, metalness: .5 }), 20), 0, 37.7, 0));
  tow.add(at(cyl(6.6, 6.6, .5, mat(0x495057), 20), 0, 39.6, 0));
  for (const [ax, ah] of [[1.5, 5], [-2, 3.5], [0, 7]]) tow.add(at(cyl(.08, .1, ah, mat(0xdee2e6), 6), ax, 39.8 + ah / 2, 0));
  fa.towerBlitz = mat(0xff2030, { e: 0xff2030, ei: 3, noCache: true }); tow.add(at(sph(.25, fa.towerBlitz, 8, 6), 0, 46.9, 0));
  { const radar = new THREE.Group(); radar.position.set(-25, 0, -140); s.add(radar);
    radar.add(at(cyl(.4, .6, 12, mat(0x8d99ae), 8), 0, 6, 0)); fa.radar = new THREE.Group(); fa.radar.position.y = 12.5; radar.add(fa.radar);
    fa.radar.add(at(box(7, 1.4, .3, mat(0xdee2e6)), 0, 0, 0, -.25)); }
  // Hangars rechts
  for (const [hx, hz] of [[48, -40], [48, -95]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); s.add(h);
    const dach = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 40, 32, 1, true, 0, Math.PI), mat(0x8a939c, { r: .55, m: .4, side: THREE.DoubleSide }));
    dach.rotation.z = Math.PI / 2; dach.scale.set(.6, 1, 1); h.add(dach);
    h.add(at(box(.5, 13, 44, mat(0x6c757d)), 20, 6.5, 0));
    for (const sz of [-1, 1]) h.add(at(box(.5, 8, 4, mat(0x6c757d)), -20, 4, sz * 20));
    h.add(at(box(.6, 3, 44, mat(0x495057)), -20, 11.5, 0));
    for (const l of [-10, 0, 10]) h.add(at(box(1, .2, 3, mat(0xffffff, { e: 0xfff1dc, ei: 2 })), l, 12.6, 0));
    const tx = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshStandardMaterial({ map: textTex('hangar' + hz, 'HANGAR ' + (hz < -50 ? 4 : 3), { w: 1024, h: 180, farbe: '#ffffff', grund: '#1d3557', font: 'bold 130px DejaVu Sans' }) }));
    tx.position.set(-20.35, 11.5, 0); tx.rotation.y = -Math.PI / 2; h.add(tx);
  }
  verkehrsflugzeug(s, 52, -40, -Math.PI / 2, { akzent: 0x6a4c93, skala: .8 });
  // Fahrzeuge
  fa.tank = tankwagen(s, 15, 6, -.4); gepaeckzug(s, 22, -18, .1); treppenwagen(s, -14, -24, Math.PI / 2 + .2);
  { const fm = new THREE.Group(); fm.add(at(box(1.8, 1.0, 4.2, mat(0xffc300)), 0, .8, 0)); fm.add(at(box(1.6, .6, 2.2, mat(0x223344, { r: .1, m: .5 })), 0, 1.55, .2));
    fm.add(at(box(1.2, .25, .4, mat(0x111111)), 0, 1.95, .2)); fa.followMe = mat(0xffa500, { e: 0xffa500, ei: 3, noCache: true }); fm.add(at(box(.3, .15, .3, fa.followMe), 0, 2.1, .2));
    for (const sx of [-.85, .85]) for (const zz of [-1.3, 1.3]) fm.add(at(cyl(.33, .33, .22, mat(0x111111), 12), sx, .33, zz, 0, 0, Math.PI / 2));
    fm.position.set(-9.5, 0, -8); fm.rotation.y = .3; s.add(fm); }
  for (const [x, z] of [[9, -2], [10, -4], [11, -6], [-7.5, 3], [-8, -2]]) huetchen(s, x, z);
  // Flutlichtmasten
  fa.fluter = [];
  for (const [x, z] of [[-26, 0], [-26, -60], [30, 15], [30, -60]]) {
    s.add(at(cyl(.3, .45, 26, mat(0x8d99ae, { m: .5 }), 10), x, 13, z));
    s.add(at(box(4, 1.2, .8, mat(0x343a40)), x, 26.5, z));
    for (let k = 0; k < 4; k++) s.add(at(box(.8, .8, .1, mat(0xffffff, { e: 0xfff4dd, ei: 3 })), x - 1.5 + k, 26.5, z + (x < 0 ? .45 : .45)));
  }
  // Windsack
  { const ws = new THREE.Group(); ws.position.set(-11, 0, -30); s.add(ws);
    ws.add(at(cyl(.06, .08, 6, mat(0xdee2e6), 8), 0, 3, 0));
    fa.windsack = new THREE.Group(); fa.windsack.position.y = 5.8; ws.add(fa.windsack);
    for (let k = 0; k < 5; k++) { const c = cyl(.45 - k * .06, .45 - (k + 1) * .06, .7, mat(k % 2 ? 0xffffff : 0xff6b00, { r: .8, side: THREE.DoubleSide }), 14); c.rotation.z = Math.PI / 2; c.position.x = .35 + k * .7; fa.windsack.add(c); } }
  // Zaun + Stadt-Silhouette weit hinten
  for (let x = -120; x < 120; x += 4) s.add(at(cyl(.05, .05, 3, mat(0x6c757d), 6), x, 1.5, -240));
  s.add(at(box(240, 2.6, .05, mat(0x6c757d, { transparent: true, opacity: .4 })), 0, 1.6, -240));
  return fa;
}

export function flughafenUpdate(fa, t) {
  fa.radar.rotation.y = t * 1.6;
  fa.towerBlitz.emissiveIntensity = (t * .8) % 1 < .15 ? 6 : .4;
  fa.followMe.emissiveIntensity = Math.floor(t * 3) % 2 ? 5 : .4;
  fa.windsack.rotation.y = .6 + Math.sin(t * .7) * .12; fa.windsack.rotation.z = -.15 + Math.sin(t * 2.3) * .05;
}
