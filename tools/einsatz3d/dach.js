// Hochhausdach mit Hubschrauber-Landeplatz, Treppenhaus, Technik, Skyline (Morgen).
import { THREE, mat, box, cyl, sph, at, canvasTex, betonTex, rng, radialTex } from './kern.js';

const fassade = (key, hell) => canvasTex('fass' + key, 512, 1024, (g, w, h) => {
  const r = rng(key.length * 7 + 3);
  g.fillStyle = ['#59636e', '#6b7682', '#4a525c', '#7d7369'][key.length % 4]; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = r() < hell ? `rgb(${235 + r() * 20},${200 + r() * 40},${140 + r() * 50})` : `rgb(${30 + r() * 30},${44 + r() * 30},${62 + r() * 30})`;
    g.fillRect(x * 64 + 10, y * 42 + 8, 44, 28);
  }
});

export function dachWelt(s) {
  const d = {};
  // Himmel (Morgenrot) als Kugel
  const himmel = canvasTex('morgenhimmel', 64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2b3f63'); gr.addColorStop(.38, '#6d7fa3'); gr.addColorStop(.5, '#e8a77f'); gr.addColorStop(.56, '#f4c99b'); gr.addColorStop(1, '#4a5363');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.MeshBasicMaterial({ map: himmel, side: THREE.BackSide, fog: false }));
  s.add(kugel);
  s.fog = new THREE.Fog(0xd6b49a, 60, 700);
  s.add(new THREE.HemisphereLight(0xf2e4d8, 0x4a4f5a, 1.4));
  const sonne = new THREE.DirectionalLight(0xffc89a, 2.4); sonne.position.set(-40, 25, -60); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048);
  Object.assign(sonne.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 160 }); s.add(sonne); s.add(sonne.target);
  const glut = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('sonne2', [[0, 'rgba(255,240,210,1)'], [.25, 'rgba(255,200,140,.7)'], [1, 'rgba(255,170,110,0)']]), fog: false, depthWrite: false }));
  glut.position.set(-300, 120, -560); glut.scale.set(260, 260, 1); s.add(glut);
  // Dachfläche
  s.add(at(box(40, .4, 40, mat(0x7a7f87, { r: .85, map: betonTex('#7a7f87', [8, 8], 'dach') })), 0, -.2, -4));
  s.add(at(box(42, 60, 42, mat(0x59636e, { r: .8, map: fassade('haupt', .4) })), 0, -30.4, -4));
  for (const [x, z, w, dd] of [[0, 15.8, 40.4, .4], [0, -23.8, 40.4, .4], [20, -4, .4, 40], [-20, -4, .4, 40]]) {
    s.add(at(box(w, 1.0, dd, mat(0x8d939b, { r: .8 })), x, .5, z));
  }
  for (const [x, z, w, dd] of [[0, 15.8, 40, .05], [0, -23.8, 40, .05], [20, -4, .05, 40], [-20, -4, .05, 40]]) {
    s.add(at(box(w || .05, .05, dd || .05, mat(0xc9ced4, { m: .7, r: .3 })), x, 1.6, z));
    const n = Math.round(Math.max(w, dd) / 2);
    for (let k = 0; k <= n; k++) s.add(at(cyl(.025, .025, .6, mat(0xc9ced4, { m: .7 }), 6), x + (w > 1 ? -w / 2 + k * w / n : 0), 1.3, z + (dd > 1 ? -dd / 2 + k * dd / n : 0)));
  }
  // Landeplatz: Kreis + H + Leuchten
  const pad = canvasTex('helipad', 1024, 1024, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h);
    g.fillStyle = '#3d4b40'; g.beginPath(); g.arc(512, 512, 500, 0, 7); g.fill();
    g.strokeStyle = '#f1f3f5'; g.lineWidth = 34; g.beginPath(); g.arc(512, 512, 430, 0, 7); g.stroke();
    g.strokeStyle = '#ffd60a'; g.lineWidth = 14; g.setLineDash([60, 40]); g.beginPath(); g.arc(512, 512, 485, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#f1f3f5'; g.fillRect(330, 290, 80, 440); g.fillRect(614, 290, 80, 440); g.fillRect(410, 470, 204, 80);
    g.font = 'bold 60px DejaVu Sans'; g.textAlign = 'center'; g.fillText('5.5 t', 512, 820);
  });
  d.padMitte = new THREE.Vector3(0, 0, -8);
  const pm = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ map: pad, transparent: true, roughness: .8 }));
  pm.rotation.x = -Math.PI / 2; pm.position.set(0, .012, -8); pm.receiveShadow = true; s.add(pm);
  d.lichter = [];
  for (let k = 0; k < 16; k++) { const w = k / 16 * Math.PI * 2; const m = mat(0x30ff60, { e: 0x30ff60, ei: 3, noCache: true }); s.add(at(cyl(.08, .1, .1, m, 10), Math.cos(w) * 8.3, .05, -8 + Math.sin(w) * 8.3)); d.lichter.push(m); }
  // Treppenhaus mit Tür (Kamera startet drin)
  const th = new THREE.Group(); th.position.set(-2, 0, 9); s.add(th);
  const wand = mat(0x9aa0a6, { r: .85, side: THREE.DoubleSide });
  th.add(at(box(4, 3.2, .2, wand), 0, 1.6, 1.9)); th.add(at(box(.2, 3.2, 4, wand), -2, 1.6, 0)); th.add(at(box(.2, 3.2, 4, wand), 2, 1.6, 0));
  th.add(at(box(1.4, 3.2, .2, wand), -1.3, 1.6, -1.9)); th.add(at(box(1.4, 3.2, .2, wand), 1.3, 1.6, -1.9)); th.add(at(box(1.2, .9, .2, wand), 0, 2.75, -1.9));
  th.add(at(box(4.4, .25, 4.4, mat(0x5c636b)), 0, 3.3, 0));
  th.add(at(box(.1, 2.3, .12, mat(0x343a40)), -.6, 1.15, -1.95)); th.add(at(box(.1, 2.3, .12, mat(0x343a40)), .6, 1.15, -1.95)); th.add(at(box(1.3, .1, .12, mat(0x343a40)), 0, 2.3, -1.95));
  d.tuer = new THREE.Group(); d.tuer.position.set(.58, 0, -1.92); th.add(d.tuer);
  d.tuer.add(at(box(1.16, 2.25, .06, mat(0x6c757d, { m: .4, r: .5 })), -.58, 1.12, 0));
  d.tuer.add(at(box(.9, .05, .02, mat(0xced4da, { m: .9 })), -.58, 1.0, -.04));
  th.add(at(box(.5, .25, .05, mat(0x2d6a4f, { e: 0x2d6a4f, ei: 1.5 })), 0, 2.55, -2.02));            // Notausgang-Schild
  { const l = new THREE.PointLight(0xfff1dc, 4, 6, 1.5); l.position.set(0, 2.8, 0); th.add(l); }
  for (let k = 0; k < 4; k++) th.add(at(box(1.0, .18, .3, mat(0x6c757d)), .8, .1 + k * .2, 1.6 - k * .3));      // Treppenstufen
  // Technik: Klimageräte, Lüfter, Antennenmast, Wassertank, Windsack
  for (const [x, z] of [[12, 8], [15, 8], [12, 4], [-14, -18]]) {
    s.add(at(box(2.4, 1.4, 1.8, mat(0xb7bec7, { r: .5, m: .3 })), x, .7, z));
    for (const sx of [-.55, .55]) s.add(at(cyl(.45, .45, .06, mat(0x343a40), 16), x + sx, 1.43, z));
  }
  s.add(at(cyl(1.4, 1.4, 3, mat(0x8d99ae, { m: .4 }), 20), -15, 1.5, 10));
  s.add(at(cyl(.12, .2, 12, mat(0xadb5bd), 8), 16, 6, -20));
  for (const y of [5, 8, 11]) s.add(at(box(1.6, .05, .05, mat(0xadb5bd)), 16, y, -20));
  d.mastLicht = mat(0xff2030, { e: 0xff2030, ei: 3, noCache: true }); s.add(at(sph(.18, d.mastLicht, 8, 6), 16, 12.1, -20));
  { const ws = new THREE.Group(); ws.position.set(-17, 0, -20); s.add(ws); ws.add(at(cyl(.05, .06, 4, mat(0xdee2e6), 8), 0, 2, 0));
    d.windsack = new THREE.Group(); d.windsack.position.y = 3.9; ws.add(d.windsack);
    for (let k = 0; k < 5; k++) { const c = cyl(.3 - k * .04, .3 - (k + 1) * .04, .5, mat(k % 2 ? 0xffffff : 0xff6b00, { r: .8, side: THREE.DoubleSide }), 12); c.rotation.z = Math.PI / 2; c.position.x = .25 + k * .5; d.windsack.add(c); } }
  // Kabelkanal am Boden
  s.add(at(box(.3, .12, 18, mat(0x495057)), 17, .06, -2));
  // Skyline
  const r = rng(21);
  for (let i = 0; i < 70; i++) {
    const w = 25 + i * 37 % 360 / 360 * Math.PI * 2, rad = 70 + r() * 360;
    const x = Math.cos(w + r()) * rad, z = -4 + Math.sin(w + r()) * rad;
    const hh = 30 + r() * 110, bw = 12 + r() * 22;
    const key = 'b' + (i % 6);
    const tex = fassade(key, .35); tex.repeat.set(bw / 16, hh / 30);
    s.add(at(box(bw, hh, bw * (.7 + r() * .6), mat(0x6b7682, { r: .7, map: tex })), x, -60 + hh / 2, z));
    if (r() < .3) s.add(at(sph(.4, mat(0xff2030, { e: 0xff2030, ei: 3 }), 6, 4), x, -60 + hh + .5, z));
  }
  s.add(at(box(3000, .2, 3000, mat(0x3a3f47, { r: 1 })), 0, -60, 0));
  d.sonne = sonne;
  return d;
}

export function dachUpdate(d, t) {
  d.lichter.forEach((m, k) => { m.emissiveIntensity = 1.5 + 2 * (Math.floor(t * 4 - k * .25) % 4 === 0 ? 1 : 0); });
  d.mastLicht.emissiveIntensity = (t * .9) % 1 < .2 ? 6 : .4;
  d.windsack.rotation.y = 2.4 + Math.sin(t * .8) * .15; d.windsack.rotation.z = -.1 + Math.sin(t * 3) * .06;
}
