// Alpen im Schneesturm: Felsnadel mit Berghütte „Adlerhorst“ (2.340 m), Kletterwand, Absatz für den Absprung,
// weites Tal mit Bergketten, Wald, Passstraße mit Polizeisperre. Hütte innen komplett eingerichtet.
// Feste Maße (Welt-Meter) – alle Laufwege der Episode richten sich danach:
//   Plateau oben y = 0 · Holzterrasse (Deck) y = DY · Felswand bei z = WZ von y = SY bis 0 · Absatz unten y = SY
import { THREE, mat, box, cyl, sph, at, canvasTex, textTex, radialTex, rauchTex, rng, clamp, lerp } from './kern.js';

export const WZ = 7.8, SY = -10, DY = 0.25, RAIL_Z = 7.75, RAIL_Y = DY + 1.0, ROPE_Z = 7.97;
export const LANES = [-1.5, 1.5];
export const TUER = { x: 2.3, z: 0, b: 1.0, h: 2.1 };           // Haustür (Mitte), öffnet nach innen (−z)
export const FENSTER = { x: -2.3, z: 0, b: 1.2, y0: 1.15, y1: 2.05 };
export const STUHL = { x: 0.4, z: -3.9 };                       // Stuhl der Geisel (Blick zur Tür)

// ---------------------------------------------------------------- Rauschen (deterministisch)
const h2 = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(i, j), h2(i + 1, j), u), lerp(h2(i, j + 1), h2(i + 1, j + 1), u), v);
}
function fbm(x, z, o = 5) { let s = 0, a = 1, f = 1, n = 0; for (let k = 0; k < o; k++) { s += a * vnoise(x * f + k * 17.3, z * f - k * 9.1); n += a; a *= .5; f *= 2.03; } return s / n; }
const sm = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
// Gelände außerhalb der Felsnadel: Talboden −280, ringsum Bergketten bis gut +400
export function talHoehe(x, z) {
  const r = Math.hypot(x * .75, z), m = sm(230, 720, r);
  const rid = 1 - Math.abs(2 * fbm(x / 420 + 3, z / 420 - 2, 4) - 1);
  return -280 + m * (380 * (.45 + .7 * fbm(x / 800, z / 800, 3)) + 300 * Math.pow(rid, 2.4)) + 14 * fbm(x / 70, z / 70, 3) * m;
}

// ---------------------------------------------------------------- Texturen
const felsTex = (key, rep) => canvasTex('fels' + key, 512, 512, (g, w, h) => {
  const r = rng(31 + key.length); g.fillStyle = '#6a6f77'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 18 + r() * 30) { g.fillStyle = ['#636870', '#737880', '#5d6269', '#7b8088'][Math.floor(r() * 4)]; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + (r() - .5) * 10); g.lineTo(w, y + 40); g.lineTo(0, y + 40); g.fill(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = r() < .5 ? 'rgba(40,44,50,.35)' : 'rgba(150,156,164,.35)'; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) g.lineTo(x + (r() - .5) * 120, y + (r() - .5) * 90); g.fill(); }
  g.strokeStyle = 'rgba(35,38,44,.8)'; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) { g.lineWidth = 2 + r() * 3; let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (r() - .5) * 60; y += 30 + r() * 60; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = 'rgba(240,245,250,.85)'; for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h; g.fillRect(x, y, 30 + r() * 70, 4 + r() * 4); }   // Schnee auf kleinen Simsen
}, rep);
const schneeTex = rep => canvasTex('schnee', 256, 256, (g, w, h) => {
  g.fillStyle = '#eef3f8'; g.fillRect(0, 0, w, h);
  const r = rng(8); for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(200,214,230,.35)'; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 40, 6 + r() * 10, r() * 3, 0, 7); g.fill(); }
}, rep);
const holzTex = (key, rep, farbe = '#7a4e2d', fuge = '#4a2d18', n = 4) => canvasTex('blk' + key, 256, 256, (g, w, h) => {
  g.fillStyle = farbe; g.fillRect(0, 0, w, h);
  const r = rng(key.length * 13 + 5);
  for (let k = 0; k < n; k++) {
    const y = k * h / n; g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, y + 6, w, h / n * .35);
    g.fillStyle = fuge; g.fillRect(0, y, w, 7);
    g.strokeStyle = 'rgba(40,20,8,.35)'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const yy = y + 12 + r() * (h / n - 20); g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + 4, w * .6, yy - 4, w, yy + 2); g.stroke(); }
  }
}, rep);
const dielenTex = rep => canvasTex('dielen', 256, 256, (g, w, h) => {
  g.fillStyle = '#8a5a34'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#93623a' : '#82552f'; g.fillRect(k * 64 + 3, 0, 58, h); g.fillStyle = '#4a2d18'; g.fillRect(k * 64, 0, 4, h); }
}, rep);
const kachelTex = canvasTex('kacheln', 256, 256, (g, w, h) => {
  g.fillStyle = '#2f6f5b'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const gr = g.createRadialGradient(x * 64 + 32, y * 64 + 32, 4, x * 64 + 32, y * 64 + 32, 40); gr.addColorStop(0, '#4f9a80'); gr.addColorStop(1, '#2a604f'); g.fillStyle = gr; g.fillRect(x * 64 + 4, y * 64 + 4, 56, 56); }
}, [1, 2]);
const karoTex = canvasTex('karo', 128, 128, (g, w, h) => { g.fillStyle = '#f3ede4'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(190,40,40,.75)'; for (let k = 0; k < 8; k += 2) { g.fillRect(k * 16, 0, 16, h); g.fillRect(0, k * 16, w, 16); } }, [2, 2]);
const teppichTex = canvasTex('teppich', 256, 256, (g, w, h) => {
  g.fillStyle = '#8c2f2f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e9c46a'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = '#264653'; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(w / 2, 40 + k * 40); g.lineTo(w / 2 + 30, 60 + k * 40); g.lineTo(w / 2, 80 + k * 40); g.lineTo(w / 2 - 30, 60 + k * 40); g.fill(); }
});

// Box aus Weltgrenzen (x0..x1, y0..y1, z0..z1)
const bx = (x0, x1, y0, y1, z0, z1, m, s = true) => at(box(x1 - x0, y1 - y0, z1 - z0, m, s), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// Blockholz-Wandstück mit gleich großen Balken (Textur nach Weltmaß)
const wand = (x0, x1, y0, y1, z0, z1) => bx(x0, x1, y0, y1, z0, z1, mat(0xffffff, { r: .9, map: holzTex('wand', [Math.max(x1 - x0, z1 - z0) / 2, (y1 - y0) / 1.04]) }));

export function bergWelt(s) {
  const b = { s };
  // ----- Himmel + Licht (Sturm: grau, kühl)
  const himmel = canvasTex('sturmhimmel', 64, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6b7a8c'); gr.addColorStop(.45, '#a9b6c4'); gr.addColorStop(.52, '#cdd6df'); gr.addColorStop(1, '#8e9aa8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  b.kugel = new THREE.Mesh(new THREE.SphereGeometry(3800, 32, 16), new THREE.MeshBasicMaterial({ map: himmel, side: THREE.BackSide, fog: false })); s.add(b.kugel);
  s.fog = new THREE.Fog(0xb9c4d1, 120, 2400);
  s.add(new THREE.HemisphereLight(0xeef3f8, 0x7d8896, 1.55));
  const sonne = new THREE.DirectionalLight(0xf4f7ff, 1.5); sonne.position.set(-30, 50, 40); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048); sonne.shadow.bias = -.0006;
  Object.assign(sonne.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 160 }); s.add(sonne); s.add(sonne.target); b.sonne = sonne;
  const felsM = mat(0xd8dce2, { r: .95, map: felsTex('a', [6, 3]) }), felsM2 = mat(0xd8dce2, { r: .95, map: felsTex('a', [3, 1.2]) });
  const schneeM = mat(0xffffff, { r: .9, map: schneeTex([8, 8]) }), schneeGlatt = mat(0xf2f6fa, { r: .9 });
  // ----- Felsnadel: Plateau (oben), Absatz (unten), Kletterwand dazwischen, darunter ein zerklüfteter Sockel bis ins Tal
  s.add(bx(-28, 28, -60, -.3, -34, WZ, felsM));                    // Plateau-Block – seine Vorderseite ist die Kletterwand
  s.add(bx(-28, 28, -.3, 0, -34, WZ, schneeM, false));             // Schneedecke oben
  s.add(bx(-24, 24, -60, SY - .3, WZ, 26, felsM2));                 // Absatz-Block
  s.add(bx(-24, 24, SY - .3, SY, WZ, 26, schneeM, false));          // Schnee auf dem Absatz
  { // Kletterwand: eigene Felsplatte mit großen Rissen (gleiche Ebene wie der Block, minimal davor → keine Überlagerung)
    const wt = felsTex('wand', [4, 1.6]); const w = new THREE.Mesh(new THREE.PlaneGeometry(56, 10.0), mat(0xffffff, { r: .95, map: wt }));
    w.position.set(0, SY - .3 + 5.0, WZ + .004); w.receiveShadow = true; s.add(w); }
  { // Sockel (Kegelstumpf mit Felsrippen) + Schneekranz oben
    const g = new THREE.CylinderGeometry(50, 160, 250, 48, 10, true); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = (y + 125) / 250;
      const d = 1 + .22 * (fbm(a * 3 + 5, y / 40) - .5) * 2 * (1 - k * .6) + .08 * Math.sin(a * 9 + y / 30); p.setXYZ(i, x * d, y, z * d); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, mat(0xffffff, { r: .95, map: felsTex('a', [10, 4]) })); m.position.set(0, -55 - 125, -4); s.add(m);
    const kranz = new THREE.Mesh(new THREE.CircleGeometry(52, 48), schneeGlatt); kranz.rotation.x = -Math.PI / 2; kranz.position.set(0, -55, -4); s.add(kranz); }
  // Felsbrocken an Kanten (brechen die Kastenform; nie im Laufbereich)
  { const r = rng(77); const geo = new THREE.DodecahedronGeometry(1, 0);
    const setz = (x, y, z, sc) => { sc *= .7; const m = new THREE.Mesh(geo, mat(0x5f646b, { r: .95 })); m.position.set(x, y, z); m.scale.set(sc * (.8 + r() * .5), sc * (.7 + r() * .6), sc * (.8 + r() * .5)); m.scale.y *= 1.5; m.rotation.set(r() * .4, r() * 3, r() * .4); m.castShadow = m.receiveShadow = true; s.add(m);
      const hb = new THREE.Mesh(geo, schneeGlatt); hb.position.copy(m.position).add(new THREE.Vector3(0, m.scale.y * .55, 0)); hb.scale.set(m.scale.x * .85, m.scale.y * .3, m.scale.z * .85); hb.rotation.y = m.rotation.y; s.add(hb); };
    for (let i = 0; i < 40; i++) { const sx = r() < .5 ? -1 : 1; setz(sx * (24 + r() * 3), -18 - r() * 40, WZ + r() * 18, 3 + r() * 4); }       // Absatz-Seiten
    for (let i = 0; i < 34; i++) setz(-22 + r() * 44, -16 - r() * 40, 26 + r() * 2, 2.5 + r() * 4);                                          // Absatz-Front
    for (let i = 0; i < 44; i++) { const sx = r() < .5 ? -1 : 1; setz(sx * (28 + r() * 2), -4 - r() * 50, -34 + r() * 40, 3 + r() * 5); }     // Plateau-Seiten
    for (let i = 0; i < 18; i++) setz(-28 + r() * 56, -6 - r() * 50, -34 - r() * 2, 3 + r() * 5);                                             // Rückseite
    // Wandfuß links/rechts außerhalb der Kletterbahnen
    for (const [x, z, sc] of [[-9, 9.2, 1.1], [-12.5, 10.5, 1.6], [9.5, 9.0, 1.0], [13, 11, 1.8], [-16, 9.5, 2.2], [17, 9.8, 2.0]]) setz(x, SY + .2, z, sc);
    // Schneewehen auf dem Plateau (außerhalb des Decks)
    for (const [x, z, sx, sz] of [[-10, 2, 3, 2], [11, -2, 3.5, 2.2], [-13, -12, 4, 3], [12, -15, 4, 2.5], [0, -14, 5, 2]]) { const m = sph(1, schneeGlatt, 16, 8); m.scale.set(sx, .7, sz); m.position.set(x, -.25, z); s.add(m); }
    for (const [x, z, sx, sz] of [[-15, 15, 4, 3], [16, 17, 4, 3], [-11, 22, 3, 2], [12, 23, 3, 2]]) { const m = sph(1, schneeGlatt, 16, 8); m.scale.set(sx, .9, sz); m.position.set(x, SY - .35, z); s.add(m); } }
  // Schneewechte an der Kante (nur außerhalb des Decks)
  for (const sx of [-1, 1]) { const w = cyl(.45, .45, 20, schneeGlatt, 12); w.rotation.z = Math.PI / 2; w.scale.set(1, 1, .7); w.position.set(sx * 17.2, -.05, WZ - .2); s.add(w); }
  // Hoher Gipfel hinter der Hütte (mit Schneefeldern)
  { const g = new THREE.ConeGeometry(420, 950, 40, 16); const p = g.attributes.position; const col = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x), d = 1 + .25 * (fbm(a * 2.5, y / 60, 4) - .5) * 2; p.setXYZ(i, x * d, y, z * d); }
    g.computeVertexNormals(); const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { const sn = n.getY(i) > .5 || p.getY(i) > 120; col.push(...(sn ? [.9, .93, .98] : [.36, .38, .43])); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.position.set(-150, 120, -1250); s.add(m); }
  // ----- Tal + Bergketten (Höhenfeld, Schnee auf flachen/hohen Stellen, Fels an steilen Hängen)
  { const g = new THREE.PlaneGeometry(9000, 9000, 220, 220); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, talHoehe(p.getX(i), p.getZ(i)));
    g.computeVertexNormals(); const n = g.attributes.normal, col = [];
    for (let i = 0; i < p.count; i++) { const ny = n.getY(i), y = p.getY(i), k = sm(.62, .8, ny) * .85 + sm(150, 320, y) * .4 + (y < -250 ? .3 : 0);
      const f = clamp(k); col.push(lerp(.3, .9, f), lerp(.32, .93, f), lerp(.37, .98, f)); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    b.tal = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); b.tal.receiveShadow = false; s.add(b.tal); }
  // Wald: verschneite Tannen im Tal und an den unteren Hängen
  { const r = rng(91), N = 1600; const geo = new THREE.ConeGeometry(1, 1, 7); geo.translate(0, .5, 0);
    const tanne = new THREE.InstancedMesh(geo, mat(0x23422f, { r: 1 }), N), kappe = new THREE.InstancedMesh(geo, mat(0xeef3f8, { r: 1 }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < N * 4 && n < N; i++) { const x = (r() - .5) * 2600, z = (r() - .5) * 2600; if (Math.hypot(x, z) < 190) continue; const y = talHoehe(x, z); if (y > -60 || fbm(x / 160, z / 160, 2) < .42) continue;
      const hh = 9 + r() * 10, w = 2.6 + r() * 1.6; ps.set(x, y - 3, z); tanne.setMatrixAt(n, m4.compose(ps, q, sc.set(w, hh, w)));
      kappe.setMatrixAt(n, m4.compose(ps.clone().setY(y - 3 + hh * .55), q, sc.set(w * .52, hh * .47, w * .52))); n++; }
    tanne.count = kappe.count = n; s.add(tanne, kappe); }
  // Passstraße im Tal mit Polizeisperre (Blaulicht)
  b.blau = [];
  { const pts = []; for (let k = 0; k <= 80; k++) { const u = k / 80; const x = -900 + 1800 * u, z = 210 + 70 * Math.sin(u * 7.5) + 40 * Math.sin(u * 17); pts.push(new THREE.Vector3(x, talHoehe(x, z) + .6, z)); }
    const kurve = new THREE.CatmullRomCurve3(pts); const P = kurve.getSpacedPoints(400); const pos = [], idx = [];
    P.forEach((q, i) => { const t = kurve.getTangentAt(i / 400); const nx = -t.z, nz = t.x, l = Math.hypot(nx, nz) || 1;
      for (const sgn of [-1, 1]) { const x = q.x + sgn * 4 * nx / l, z = q.z + sgn * 4 * nz / l; pos.push(x, Math.max(q.y, talHoehe(x, z) + .5), z); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    s.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x3a3f47, side: THREE.DoubleSide })));
    // Sperre: 4 Streifenwagen quer + 1 Bus, große Blaulicht-Sprites (aus der Höhe sichtbar)
    const glut = radialTex('blauGlut', [[0, 'rgba(160,200,255,1)'], [.25, 'rgba(60,120,255,.8)'], [1, 'rgba(30,80,255,0)']]);
    const silber = mat(0xdfe3e8, { r: .35 }), blauL = mat(0x1d3f8f, { r: .4 });
    for (let i = 0; i < 5; i++) { const u = .47 + i * .012, q = kurve.getPointAt(u), t = kurve.getTangentAt(u); const a = new THREE.Group(); a.position.copy(q); a.rotation.y = Math.atan2(t.x, t.z) + (i % 2 ? .9 : -.9);
      const lang = i === 4 ? 9 : 4.5; a.add(at(box(1.9, i === 4 ? 2.4 : .7, lang, silber), 0, i === 4 ? 1.4 : .65, 0)); a.add(at(box(1.92, .25, lang * .8, blauL), 0, .75, 0)); if (i !== 4) a.add(at(box(1.7, .5, 2.2, mat(0x1a2533)), 0, 1.2, .1));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glut, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.position.set(0, i === 4 ? 2.9 : 1.7, 0); sp.scale.set(9, 9, 1); a.add(sp); b.blau.push(sp);
      s.add(a); } }
  // ----- Holzterrasse rund um die Hütte (Deck-Oberkante DY), Pfosten, Geländer
  const dielenM = mat(0xffffff, { r: .85, map: dielenTex([6, 7]) }), balkenM = mat(0x5a3a22, { r: .9 }), gelM = mat(0x6b4426, { r: .85 });
  s.add(bx(-6.5, 6.5, .1, DY, -7.3, 7.9, dielenM));
  s.add(bx(-6.5, 6.5, -.3, .1, 7.7, 7.9, balkenM));                       // Stirnbalken an der Kante
  for (const x of [-6.5, 6.5]) s.add(bx(x - .1, x + .1, -.3, .1, -7.3, 7.9, balkenM));
  s.add(bx(-6.5, 6.5, -.3, .1, -7.3, -7.1, balkenM));
  // Geländer vorne (Pfosten so verteilt, dass die Kletterbahnen bei x = ±1,5 frei sind)
  b.gelaender = [];
  const pfosten = (x, z) => s.add(bx(x - .05, x + .05, DY, RAIL_Y + .04, z - .05, z + .05, gelM));
  for (const x of [-6.4, -5.25, -3.75, -2.4, -.6, .6, 2.4, 3.75, 5.25, 6.4]) pfosten(x, RAIL_Z);
  s.add(bx(-6.45, 6.45, RAIL_Y - .04, RAIL_Y + .04, RAIL_Z - .06, RAIL_Z + .06, gelM));
  s.add(bx(-6.45, 6.45, DY + .5 - .03, DY + .5 + .03, RAIL_Z - .04, RAIL_Z + .04, gelM));
  for (const sx of [-1, 1]) { const x = sx * 6.4;   // Seitengeländer (links mit Treppe zum Plateau)
    for (const z of [-7.2, -5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.6, RAIL_Z]) if (!(sx < 0 && z > 2 && z < 4)) pfosten(x, z);
    const st = sx < 0 ? [[-7.25, 2.0], [4.0, RAIL_Z]] : [[-7.25, RAIL_Z]];
    for (const [z0, z1] of st) { s.add(bx(x - .06, x + .06, RAIL_Y - .04, RAIL_Y + .04, z0, z1, gelM)); s.add(bx(x - .04, x + .04, DY + .47, DY + .53, z0, z1, gelM)); } }
  s.add(bx(-6.45, 6.45, RAIL_Y - .04, RAIL_Y + .04, -7.26, -7.14, gelM));
  for (let k = 0; k < 3; k++) s.add(bx(-7.4 + k * .3, -7.1 + k * .3 + .3, 0, DY * (k + 1) / 4 + .02, 2.1, 3.9, gelM));   // Treppe links
  // Schnee auf dem Handlauf + Bank + Tisch auf der Terrasse (außerhalb der Laufwege)
  s.add(bx(-6.45, 6.45, RAIL_Y + .04, RAIL_Y + .1, RAIL_Z - .05, RAIL_Z + .05, schneeGlatt, false));
  { const bank = new THREE.Group(); bank.add(at(box(1.6, .06, .42, gelM), 0, .46, 0)); bank.add(at(box(1.6, .45, .06, gelM), 0, .72, -.22)); for (const x of [-.7, .7]) bank.add(at(box(.06, .46, .4, balkenM), x, .23, 0)); bank.position.set(-5.4, DY, 5.4); bank.rotation.y = Math.PI / 2; s.add(bank); bank.add(at(box(1.5, .08, .38, schneeGlatt), 0, .53, 0)); }
  // ----- Hütte: Blockbau x −5..5, z −7..0, Boden = Deck, Wände bis 2,85, Satteldach (First bei z −3,5)
  const Y0 = DY, Y1 = 2.85, F = FENSTER, T = TUER;
  // Vorderwand mit Tür- und Fensteröffnung
  s.add(wand(-5, F.x - F.b / 2, Y0, Y1, -.2, 0)); s.add(wand(F.x - F.b / 2, F.x + F.b / 2, Y0, F.y0, -.2, 0)); s.add(wand(F.x - F.b / 2, F.x + F.b / 2, F.y1, Y1, -.2, 0));
  s.add(wand(F.x + F.b / 2, T.x - T.b / 2, Y0, Y1, -.2, 0)); s.add(wand(T.x - T.b / 2, T.x + T.b / 2, Y0 + T.h, Y1, -.2, 0)); s.add(wand(T.x + T.b / 2, 5, Y0, Y1, -.2, 0));
  // Seitenwände mit je einem Fenster, Rückwand
  const SF = { z0: -4.4, z1: -3.2, y0: 1.15, y1: 2.0 };
  for (const x0 of [-5, 4.8]) { s.add(wand(x0, x0 + .2, Y0, Y1, -7, SF.z0)); s.add(wand(x0, x0 + .2, Y0, Y1, SF.z1, -.2)); s.add(wand(x0, x0 + .2, Y0, SF.y0, SF.z0, SF.z1)); s.add(wand(x0, x0 + .2, SF.y1, Y1, SF.z0, SF.z1)); }
  s.add(wand(-4.8, 4.8, Y0, Y1, -7, -6.8));
  // Giebeldreiecke
  { const sh = new THREE.Shape(); sh.moveTo(-3.5, 0); sh.lineTo(3.5, 0); sh.lineTo(0, 1.75); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .2, bevelEnabled: false });
    for (const x of [-5, 4.8]) { const m = new THREE.Mesh(geo, mat(0xffffff, { r: .9, map: holzTex('giebel', [.5, .5]) })); m.rotation.y = -Math.PI / 2; m.position.set(x + .2, Y1, -3.5); m.castShadow = m.receiveShadow = true; s.add(m); } }
  // Dach + dicke Schneeschicht + Eiszapfen (nur an den Ecken – nie über den Köpfen am Eingang)
  { const a = Math.atan2(1.75, 3.5), L = Math.hypot(4.3, 2.15), dachM = mat(0x3b2a1e, { r: .9 });
    for (const sgn of [1, -1]) {
      const zM = -3.5 + sgn * 2.15, yM = (4.6 + 2.45) / 2, nY = Math.cos(a), nZ = sgn * Math.sin(a);
      const p = at(box(11.6, .18, L, dachM), 0, yM + nY * .09, zM + nZ * .09, sgn * a); s.add(p);
      const sn = at(box(11.7, .24, L + .05, schneeGlatt), 0, yM + nY * .3, zM + nZ * .3, sgn * a); s.add(sn); }
    s.add(at(box(11.8, .3, .5, schneeGlatt), 0, 4.78, -3.5));
    const zapf = new THREE.ConeGeometry(.045, 1, 6); zapf.rotateX(Math.PI);
    const r = rng(5); for (const [x0, x1] of [[-5.6, -4.0], [4.4, 5.6]]) for (let x = x0; x < x1; x += .17) { const l = .15 + r() * .35; const m = new THREE.Mesh(zapf, mat(0xd8ecff, { r: .2, e: 0x203040, ei: .3 })); m.scale.set(1, l, 1); m.position.set(x, 2.45 + .08 - l / 2, .82); s.add(m); } }
  // Kamin mit Rauch
  s.add(bx(3.2, 3.8, 3.4, 5.2, -4.8, -4.2, mat(0x6c6f75, { r: .95, map: felsTex('a', [.5, 1]) })));
  s.add(bx(3.15, 3.85, 5.2, 5.35, -4.85, -4.15, schneeGlatt));
  b.kaminRauch = []; { const rt = rauchTex(); for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, color: 0x8a9099, transparent: true, depthWrite: false })); sp.userData.ph = i / 14; s.add(sp); b.kaminRauch.push(sp); } }
  // Fenster (Rahmen, Sprossen, Glas, Vorhänge innen)
  const rahmenM = mat(0x2f1d12, { r: .8 }), glasM = mat(0x9fc3dd, { r: .1, m: .2, transparent: true, opacity: .45 });
  const fensterBau = (x, z, b2, y0, y1, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    g.add(at(box(b2 + .12, .08, .26, rahmenM), 0, y0 - .02, 0)); g.add(at(box(b2 + .12, .08, .26, rahmenM), 0, y1 + .02, 0));
    for (const sx of [-1, 1]) g.add(at(box(.08, y1 - y0, .26, rahmenM), sx * (b2 / 2 + .02), (y0 + y1) / 2, 0));
    const scheibe = new THREE.Group(); scheibe.add(at(box(b2, y1 - y0, .02, glasM, false), 0, (y0 + y1) / 2, 0)); scheibe.add(at(box(.05, y1 - y0, .05, rahmenM), 0, (y0 + y1) / 2, 0)); scheibe.add(at(box(b2, .05, .05, rahmenM), 0, (y0 + y1) / 2, 0)); g.add(scheibe);
    for (const sx of [-1, 1]) g.add(at(box(.32, y1 - y0 + .1, .03, mat(0xffffff, { r: .9, map: karoTex })), sx * (b2 / 2 - .1), (y0 + y1) / 2, -.25));
    g.add(at(box(b2 + .3, .1, .1, mat(0xe9eef3)), 0, y0 - .08, .14));   // Schnee auf dem Fensterbrett außen
    s.add(g); return { g, scheibe }; };
  b.fenster = fensterBau(F.x, -.1, F.b, F.y0, F.y1, 0);
  fensterBau(-4.9, (SF.z0 + SF.z1) / 2, SF.z1 - SF.z0, SF.y0, SF.y1, -Math.PI / 2); fensterBau(4.9, (SF.z0 + SF.z1) / 2, SF.z1 - SF.z0, SF.y0, SF.y1, Math.PI / 2);
  // Türrahmen + Tür (fliegt bei der Sprengung nach innen)
  s.add(bx(T.x - T.b / 2 - .08, T.x - T.b / 2, Y0, Y0 + T.h, -.24, .04, rahmenM)); s.add(bx(T.x + T.b / 2, T.x + T.b / 2 + .08, Y0, Y0 + T.h, -.24, .04, rahmenM)); s.add(bx(T.x - T.b / 2 - .08, T.x + T.b / 2 + .08, Y0 + T.h, Y0 + T.h + .08, -.24, .04, rahmenM));
  b.tuer = new THREE.Group(); s.add(b.tuer);
  { const tm = mat(0x6b3f22, { r: .8, map: holzTex('tuer', [.5, 1], '#6b3f22', '#3e2414', 6) }); b.tuer.add(at(box(T.b - .04, T.h - .04, .06, tm), 0, 0, 0));
    for (const y of [-.6, .6]) b.tuer.add(at(box(T.b - .1, .1, .03, mat(0x3e2414)), 0, y, .045)); b.tuer.add(at(sph(.035, mat(0xb08d57, { m: .8, r: .3 })), -.38, -.05, .06)); b.tuer.add(at(box(.18, .26, .02, mat(0x3a3d42, { m: .6 })), -.38, -.05, .04)); }
  b.tuerZu = () => { b.tuer.position.set(T.x, Y0 + T.h / 2, -.1); b.tuer.rotation.set(0, 0, 0); };
  b.tuerZu();
  // Schild, Laterne, Holzstapel, Skier, Satellitenschüssel, Schneemobil, Wetterstation, Wegweiser, Materialseilbahn
  { const tx = textTex('adlerhorst', 'ADLERHORST · 2340 m', { w: 1024, h: 160, farbe: '#f6e7c8', grund: '#4a2d18', font: 'bold 92px DejaVu Sans' });
    s.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.4, .38, .04), [rahmenM, rahmenM, rahmenM, rahmenM, new THREE.MeshLambertMaterial({ map: tx }), rahmenM]), -.3, 2.52, .03)); }
  b.laterne = mat(0xffd27a, { e: 0xffb347, ei: 2.5, noCache: true });
  s.add(at(box(.16, .24, .16, mat(0x1d1f22)), 3.25, 2.05, .2)); s.add(at(box(.1, .16, .1, b.laterne), 3.25, 2.05, .2)); s.add(at(box(.04, .04, .2, mat(0x1d1f22)), 3.25, 2.2, .1));
  { const l = new THREE.PointLight(0xffc477, 3, 6, 1.6); l.position.set(3.25, 2.0, .45); s.add(l); }
  for (let y = 0; y < 6; y++) for (let k = 0; k < 14; k++) s.add(at(cyl(.11, .11, .9, mat(k % 3 ? 0x8b5a2b : 0x7a4e24, { r: .9 }), 8), -6.0, DY + .12 + y * .21, -6.6 + k * .24 + (y % 2) * .1, 0, 0, Math.PI / 2));
  for (let k = 0; k < 3; k++) { s.add(at(box(.08, 1.75, .02, mat([0xd62828, 0x1d3557, 0xf77f00][k], { r: .4 })), -4.55 + k * .16, DY + .9, .12, -.12)); }
  s.add(at(cyl(.4, .4, .06, mat(0xdee2e6, { m: .3 }), 20), 5.15, 2.6, -6.2, 0, 0, Math.PI / 2 - .5));
  { const sm2 = new THREE.Group(); sm2.position.set(8.2, 0, -3.5); sm2.rotation.y = .3; s.add(sm2);   // Schneemobil der Täter
    const rot = mat(0x9d0208, { r: .4 }); sm2.add(at(box(.9, .45, 2.2, rot), 0, .55, 0)); sm2.add(at(box(.7, .2, 1.0, mat(0x1d1f22)), 0, .85, .35)); sm2.add(at(box(.8, .4, .1, mat(0x9fc3dd, { transparent: true, opacity: .6 })), 0, 1.0, -.55, -.5));
    for (const sx of [-.45, .45]) sm2.add(at(box(.12, .06, 1.2, mat(0x343a40, { m: .6 })), sx, .06, -.8)); sm2.add(at(box(.55, .3, 1.6, mat(0x111111)), 0, .25, .55)); sm2.add(at(box(.6, .06, .1, mat(0x343a40)), 0, 1.0, -.25)); }
  { const ws = new THREE.Group(); ws.position.set(-9.5, 0, -9); s.add(ws); ws.add(at(cyl(.05, .07, 5, mat(0xadb5bd, { m: .5 }), 8), 0, 2.5, 0));
    b.anemo = new THREE.Group(); b.anemo.position.y = 5.1; ws.add(b.anemo); for (let k = 0; k < 3; k++) { const a = new THREE.Group(); a.rotation.y = k * Math.PI * 2 / 3; a.add(at(box(.4, .02, .02, mat(0xadb5bd)), .2, 0, 0)); a.add(at(sph(.07, mat(0xdee2e6), 8, 6), .4, 0, 0)); b.anemo.add(a); }
    ws.add(at(box(.5, .3, .02, mat(0x343a40)), 0, 3.0, .06)); ws.add(at(box(.5, .3, .02, mat(0x1e3a5f, { e: 0x1e3a5f, ei: .5 })), 0, 3.0, .08)); }
  { const wg = new THREE.Group(); wg.position.set(-8.5, 0, 5.5); s.add(wg); wg.add(at(cyl(.06, .06, 2.4, mat(0x6c757d), 8), 0, 1.2, 0));
    const pl = (t2, y, ry) => { const tx = textTex('weg' + t2, t2, { w: 512, h: 96, farbe: '#111111', grund: '#ffd60a', font: 'bold 52px DejaVu Sans' }); const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, .2, .03), [mat(0xffd60a), mat(0xffd60a), mat(0xffd60a), mat(0xffd60a), new THREE.MeshLambertMaterial({ map: tx }), new THREE.MeshLambertMaterial({ map: tx })]); m.position.set(.5 * Math.cos(ry), y, -.5 * Math.sin(ry)); m.rotation.y = ry; wg.add(m); };
    pl('TAL · 3 h', 2.1, .3); pl('GIPFEL · 1 h', 1.82, 2.6); }
  { const ms = new THREE.Group(); ms.position.set(-14, 0, 4); ms.rotation.y = -.6; s.add(ms);   // Materialseilbahn: Bergstation + Seil ins Tal + Kiste
    for (const sx of [-.8, .8]) ms.add(at(box(.15, 2.6, .15, balkenM), sx, 1.3, 0)); ms.add(at(box(1.9, .2, .3, balkenM), 0, 2.6, 0)); ms.add(at(cyl(.35, .35, .1, mat(0x343a40), 18), 0, 2.4, .2, Math.PI / 2));
    ms.add(at(box(1.4, .9, 1.2, mat(0x5a3a22)), 0, .45, -1.2));
    const z1 = 520, y1 = -250, L2 = Math.hypot(z1, y1 - 2.4); const seil = cyl(.02, .02, L2, mat(0x222222), 4, false); seil.position.set(0, 2.4 + (y1 - 2.4) / 2, z1 / 2); seil.rotation.x = Math.atan2(z1, y1 - 2.4); ms.add(seil);
    const ki = new THREE.Group(); ki.add(at(box(.9, .6, .7, mat(0x6c757d, { m: .4 })), 0, -.6, 0)); ki.add(at(box(.04, .6, .04, mat(0x222222)), 0, -.15, 0)); ki.position.set(0, 2.4 + (y1 - 2.4) * .03, z1 * .03); ms.add(ki); }
  // ----- Innenraum (Boden = Deck): Kachelofen, Stockbett, Tisch + Bänke, Küchenzeile, Stuhl der Geisel, Teppich, Lampe
  const holzInnen = mat(0x8c5a32, { r: .8 }), dunkelHolz = mat(0x5c3a20, { r: .85 });
  s.add(bx(-4.8, 4.8, Y1, Y1 + .1, -6.8, -.2, mat(0xffffff, { r: .9, map: holzTex('decke', [3, 4], '#9a6a40', '#5c3a20') })));    // Decke
  for (const z of [-5.6, -3.5, -1.4]) s.add(bx(-4.8, 4.8, Y1 - .18, Y1, z - .1, z + .1, dunkelHolz));                                  // Balken
  s.add(bx(3.7, 4.75, Y0, Y0 + 1.5, -6.75, -5.7, mat(0xffffff, { r: .5, map: kachelTex })));                                              // Kachelofen
  s.add(bx(3.65, 4.8, Y0 + 1.5, Y0 + 1.58, -6.8, -5.65, mat(0x2a604f))); s.add(at(cyl(.09, .09, Y1 - Y0 - 1.58, mat(0x2b2d31, { m: .6 }), 12), 4.3, (Y1 + Y0 + 1.58) / 2, -6.3));
  b.ofenGlut = mat(0xff7b00, { e: 0xff5400, ei: 2, noCache: true }); s.add(bx(4.0, 4.4, Y0 + .3, Y0 + .6, -5.69, -5.67, b.ofenGlut));
  { const l = new THREE.PointLight(0xff8a3d, 3, 5, 1.6); l.position.set(4.2, Y0 + .5, -5.3); s.add(l); }
  for (let k = 0; k < 8; k++) s.add(at(cyl(.06, .06, .5, mat(0x8b5a2b), 7), 3.2 + (k % 4) * .13, Y0 + .1 + Math.floor(k / 4) * .12, -6.45, Math.PI / 2));     // Brennholz
  { const bt = new THREE.Group(); bt.position.set(-4.3, Y0, -5.75); s.add(bt);   // Stockbett
    for (const [x, z] of [[-.42, -.98], [.42, -.98], [-.42, .98], [.42, .98]]) bt.add(at(box(.08, 2.0, .08, dunkelHolz), x, 1.0, z));
    for (const y of [.35, 1.35]) { bt.add(at(box(.9, .12, 2.0, dunkelHolz), 0, y, 0)); bt.add(at(box(.8, .14, 1.9, mat(0xe9ecef)), 0, y + .13, 0)); bt.add(at(box(.82, .08, 1.3, mat(y < 1 ? 0x9d0208 : 0x1d3557)), 0, y + .23, .3)); bt.add(at(box(.5, .1, .3, mat(0xffffff)), 0, y + .25, -.75)); } }
  { const tisch = new THREE.Group(); tisch.position.set(-2.4, Y0, -3.6); s.add(tisch);
    tisch.add(at(box(1.8, .06, .85, holzInnen), 0, .75, 0)); for (const [x, z] of [[-.8, -.35], [.8, -.35], [-.8, .35], [.8, .35]]) tisch.add(at(box(.07, .72, .07, dunkelHolz), x, .36, z));
    for (const z of [.85, -.85]) { tisch.add(at(box(1.8, .05, .3, holzInnen), 0, .45, z)); for (const x of [-.75, .75]) tisch.add(at(box(.06, .43, .26, dunkelHolz), x, .22, z)); }
    // Laptop mit Karte, Tassen, Karten, Funkgerät, Laterne
    const lap = new THREE.Group(); lap.position.set(.4, .78, -.1); lap.rotation.y = .2; tisch.add(lap); lap.add(at(box(.36, .015, .25, mat(0x2b2d31)), 0, 0, 0));
    const schirm = textTex('laptopKarte', '◉ ADLERHORST', { w: 256, h: 160, farbe: '#ff4d6d', grund: '#14303a', font: 'bold 28px DejaVu Sans' });
    lap.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.34, .22), new THREE.MeshBasicMaterial({ map: schirm })), 0, .12, -.12, -.25)); lap.add(at(box(.36, .24, .01, mat(0x2b2d31)), 0, .12, -.128, -.25));
    for (const [x, z] of [[-.5, .2], [-.1, .25], [.7, .2]]) { tisch.add(at(cyl(.04, .035, .1, mat(0xf1f3f5), 12), x, .83, z)); }
    for (let k = 0; k < 5; k++) tisch.add(at(box(.06, .004, .09, mat(k % 2 ? 0xffffff : 0xe63946)), -.3 + k * .07, .782, -.15, 0, k * .3));
    tisch.add(at(box(.07, .16, .04, mat(0x1d1f22)), -.75, .86, -.2)); tisch.add(at(cyl(.005, .005, .14, mat(0x111111), 5), -.73, 1.0, -.2));
    tisch.add(at(cyl(.07, .07, .2, mat(0xffd27a, { e: 0xffb347, ei: 1.2 }), 10), -.1, .88, -.25)); }
  s.add(bx(-1.6, 1.6, Y0, Y0 + .88, -6.8, -6.2, holzInnen)); s.add(bx(-1.65, 1.65, Y0 + .88, Y0 + .92, -6.82, -6.15, mat(0xadb5bd)));       // Küchenzeile
  s.add(bx(-1.6, 1.6, Y0 + 1.55, Y0 + 1.6, -6.8, -6.5, dunkelHolz));
  for (let k = 0; k < 6; k++) s.add(at(cyl(.07, .06, .14, mat([0xe63946, 0xf1f3f5, 0x457b9d][k % 3]), 12), -1.3 + k * .5, Y0 + 1.68, -6.65));
  for (let k = 0; k < 3; k++) s.add(at(cyl(.14, .12, .14, mat(0x6c757d, { m: .6 }), 14), -1.0 + k * .9, Y0 + .99, -6.45));
  { const tx = canvasTex('wandkarte', 256, 192, (g, w, h) => { g.fillStyle = '#f1e9d2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8d6e4a'; g.lineWidth = 2; for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(128, 96, 20 + k * 14, 12 + k * 9, .3, 0, 7); g.stroke(); } g.fillStyle = '#d62828'; g.beginPath(); g.arc(128, 96, 7, 0, 7); g.fill(); });
    s.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.0, .75), new THREE.MeshLambertMaterial({ map: tx })), -4.79, 1.75, -1.6, 0, Math.PI / 2)); }
  { const uhr = new THREE.Group(); uhr.position.set(4.78, 2.05, -2.2); uhr.rotation.y = -Math.PI / 2; s.add(uhr); uhr.add(at(box(.3, .45, .1, dunkelHolz), 0, 0, .05)); uhr.add(at(cyl(.1, .1, .02, mat(0xf1f3f5), 18), 0, .05, .11, Math.PI / 2)); uhr.add(at(box(.36, .1, .14, dunkelHolz), 0, .26, .05, 0, 0, 0)); }
  for (let k = 0; k < 3; k++) { s.add(at(box(.04, .04, .14, dunkelHolz), 4.72, 1.75, -.9 - k * .35)); s.add(at(box(.08, .7, .3, mat([0x2a9d8f, 0x6d597a, 0xbc4749][k])), 4.68, 1.4, -.9 - k * .35)); }     // Jacken an Haken
  s.add(bx(-.8, 1.6, Y0 + .004, Y0 + .014, -4.7, -1.7, mat(0xffffff, { r: 1, map: teppichTex }), false));
  { const st = new THREE.Group(); st.position.set(STUHL.x, Y0, STUHL.z); s.add(st);   // Stuhl der Geisel (Blick +z)
    st.add(at(box(.46, .05, .44, holzInnen), 0, .45, 0)); for (const [x, z] of [[-.2, -.19], [.2, -.19], [-.2, .19], [.2, .19]]) st.add(at(box(.045, .45, .045, dunkelHolz), x, .225, z));
    st.add(at(box(.3, .42, .04, holzInnen), 0, .77, -.2)); st.add(at(box(.05, .3, .04, dunkelHolz), 0, .5, -.2)); b.stuhl = st; }   // schmale Lehne: die gefesselten Arme gehen außen vorbei
  b.lampe = mat(0xfff1c9, { e: 0xffd88a, ei: 2.2, noCache: true });
  s.add(at(cyl(.01, .01, .3, mat(0x111111), 4), 0, Y1 - .15, -3.5)); s.add(at(cyl(.12, .2, .16, mat(0x2b2d31), 14, false), 0, Y1 - .36, -3.5)); s.add(at(sph(.07, b.lampe, 10, 8, false), 0, Y1 - .45, -3.5));
  b.innenLicht = new THREE.PointLight(0xffd9a0, 6, 10, 1.4); b.innenLicht.position.set(0, Y1 - .6, -3.5); s.add(b.innenLicht);
  // ----- Schneefall (Punkte rund um die Kamera, Wind von links)
  { const N = 2600, pos = new Float32Array(N * 3), r = rng(3); b.flocken = Array.from({ length: N }, () => [r(), r(), r(), .7 + r() * .6]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tx = radialTex('flocke', [[0, 'rgba(255,255,255,1)'], [.45, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']]);
    b.schnee = new THREE.Points(g, new THREE.PointsMaterial({ map: tx, color: 0xffffff, size: .035, transparent: true, opacity: .85, depthWrite: false, sizeAttenuation: true }));
    b.schnee.frustumCulled = false; s.add(b.schnee); }
  // Schneegestöber-Schwaden (Wind treibt Schnee über die Kante)
  b.boen = []; { const rt = rauchTex(), r = rng(19); for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, color: 0xf4f7fa, transparent: true, depthWrite: false })); sp.userData = { x: (r() - .5) * 50, z: 10 + r() * 16, y: SY + r() * 12, ph: r() }; s.add(sp); b.boen.push(sp); } }
  return b;
}

// Pro Bild: Schneefall um die Kamera, Rauch, Blaulicht, Windmesser, Böen
export function bergUpdate(b, t, kam, { sturm = 1 } = {}) {
  const p = b.schnee.geometry.attributes.position, c = kam.position, B = [34, 22, 34];
  const wx = 4.5 * sturm, wy = -2.4, wz = 1.2 * sturm;
  b.flocken.forEach(([fx, fy, fz, v], i) => {
    const x = ((fx * B[0] + (wx * v + Math.sin(t * 1.3 + i) * .4) * t - c.x) % B[0] + B[0]) % B[0] - B[0] / 2 + c.x;
    const y = ((fy * B[1] + wy * v * t - c.y) % B[1] + B[1]) % B[1] - B[1] / 2 + c.y;
    const z = ((fz * B[2] + wz * v * t - c.z) % B[2] + B[2]) % B[2] - B[2] / 2 + c.z;
    if (x > -5.1 && x < 5.1 && z > -7.1 && z < .1 && y < 5) { p.setXYZ(i, 0, -9999, 0); return; }   // nie in der Hütte
    const dx = x - c.x, dy = y - c.y, dz = z - c.z, d = Math.hypot(dx, dy, dz);
    if (d < 1.6) { const k = 1.6 / Math.max(d, .01); p.setXYZ(i, c.x + dx * k, c.y + dy * k, c.z + dz * k); } else p.setXYZ(i, x, y, z);
  });
  p.needsUpdate = true; b.schnee.material.opacity = .85 * clamp(sturm);
  b.kaminRauch.forEach(sp => { const k = (t * .25 + sp.userData.ph) % 1; sp.position.set(3.5 + k * 4 * sturm, 5.4 + k * 3, -4.5 + k * 1.2); const z = .8 + k * 3; sp.scale.set(z, z, 1); sp.material.opacity = .4 * Math.sin(Math.PI * k); });
  b.blau.forEach((sp, i) => { const an = Math.floor(t * 4 + i * .5) % 2 === 0; sp.material.opacity = an ? 1 : .15; });
  b.anemo.rotation.y = -t * 9;
  b.boen.forEach(sp => { const u = sp.userData, k = (t * .18 + u.ph) % 1; sp.position.set(u.x - 20 + k * 40, u.y + k * 1.2, u.z); const z = 3 + k * 5; sp.scale.set(z * 1.6, z * .6, 1);
    const nah = clamp((sp.position.distanceTo(c) - 2) / 6); sp.material.opacity = .35 * Math.sin(Math.PI * k) * nah * clamp(sturm); });
}
