// Kulissen für Alltags-/Krisenserien (BLACKOUT u. a.) – detailreich:
//  wohnblock(): Wohnung im 4. Stock (Küche, Wohnzimmer, Balkon, Stadtblick, Kreuzung unten) + Treppenhaus mit echten Treppenläufen
//  keller():    Kellergang mit Ziegeln, Kellerabteilen, Rohren, Waschküche, Sicherungsraum, Hintertür
//  strasse():   Straße mit Wohnblocks, Läden, Markisen, Balkonen, Autos, Fahrrädern … + Supermarkt FRISCHMARKT innen
// Koordinaten: Meter, Boden der jeweiligen Welt y = 0.
import { THREE, mat, box, cyl, sph, at, canvasTex, textTex, rng, clamp } from './kern.js';

const sm = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const bx = (x0, x1, y0, y1, z0, z1, m, s = true) => at(box(x1 - x0, y1 - y0, z1 - z0, m, s), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// Viele gleiche Teile als ein InstancedMesh – liste: [[x,y,z, sx,sy,sz, farbe, ry]]
function viele(s, geo, liste, { r = .7, schatten = true } = {}) {
  if (!liste.length) return null;
  const m = new THREE.InstancedMesh(geo, mat(0xffffff, { r, noCache: true }), liste.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  liste.forEach(([x, y, z, sx, sy, sz, f, ry = 0], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry); m.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz))); m.setColorAt(i, c.set(f)); });
  m.castShadow = schatten; m.receiveShadow = true; s.add(m); return m;
}
const BOX = new THREE.BoxGeometry(1, 1, 1), ZYL = new THREE.CylinderGeometry(.5, .5, 1, 10), KUGEL = new THREE.SphereGeometry(.5, 10, 8);

// ---------------------------------------------------------------- Texturen
const fassadeTex = (key, hell, farbe, { balkon = false } = {}) => canvasTex('stf' + key + farbe + balkon, 256, 512, (g, w, h) => {
  const r = rng(key.length * 11 + 7); g.fillStyle = farbe; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.08)'; for (let y = 0; y < h; y += 42) g.fillRect(0, y + 38, w, 4);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 4; x++) {
    const fx = x * 64 + 12, fy = y * 42 + 8;
    g.fillStyle = '#e9ecef'; g.fillRect(fx - 3, fy - 3, 46, 32);
    g.fillStyle = r() < hell ? `rgb(${240 + r() * 15},${200 + r() * 40},${120 + r() * 50})` : ['#1c2533', '#26334a', '#1a2230'][Math.floor(r() * 3)];
    g.fillRect(fx, fy, 40, 26); g.fillStyle = '#e9ecef'; g.fillRect(fx + 19, fy, 2, 26);
    if (r() < .3) { g.fillStyle = ['#9d0208', '#2a9d8f', '#e9c46a', '#f1faee'][Math.floor(r() * 4)]; g.fillRect(fx, fy, 12, 26); }
    if (balkon && x % 2 === 0) { g.fillStyle = 'rgba(60,60,70,.55)'; g.fillRect(fx - 6, fy + 18, 52, 12); }
  }
});
const fensterMaske = key => canvasTex('stm' + key, 256, 512, (g, w, h) => {
  const r = rng(key.length * 11 + 7); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 4; x++) { g.fillStyle = r() < .55 ? '#ffd9a0' : '#000'; g.fillRect(x * 64 + 12, y * 42 + 8, 40, 26); }
});
const tapete = canvasTex('tapete2', 256, 256, (g, w, h) => { g.fillStyle = '#ddd2bf'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(160,140,110,.18)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 12, h); g.fillStyle = 'rgba(255,255,255,.25)'; for (let y = 0; y < h; y += 32) for (let x = 16; x < w; x += 32) g.fillRect(x, y + 14, 4, 4); }, [3, 1]);
const parkett = canvasTex('parkett2', 256, 256, (g, w, h) => {
  const r = rng(3); for (let y = 0; y < 8; y++) for (let x = 0; x < 2; x++) { g.fillStyle = ['#9c6b3f', '#8a5c35', '#a0703f', '#94653a'][Math.floor(r() * 4)]; g.fillRect(x * 128 + (y % 2) * 64, y * 32, 128, 32);
    g.fillStyle = '#5c3a20'; g.fillRect(x * 128 + (y % 2) * 64, y * 32, 2, 32); g.fillRect(0, y * 32, w, 2); }
}, [3, 3]);
const fliese = (key, a, b, rep) => canvasTex('fl' + key, 128, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, 62, w, 4); g.fillRect(62, 0, 4, h); }, rep);
const ziegel = canvasTex('ziegelK', 256, 256, (g, w, h) => {
  g.fillStyle = '#5a3d32'; g.fillRect(0, 0, w, h); const r = rng(9);
  for (let y = 0; y < 16; y++) for (let x = -1; x < 5; x++) { g.fillStyle = `rgb(${130 + r() * 40},${70 + r() * 25},${55 + r() * 20})`; g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 16 + 2, 60, 12); }
}, [4, 2]);
const beton = (key, f, rep) => canvasTex('bt' + key, 256, 256, (g, w, h) => { g.fillStyle = f; g.fillRect(0, 0, w, h); const r = rng(key.length + 4); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${r() * .08})`; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); } }, rep);
function schildBrett(s, text, x, y, z, ry, b, hh, grund, farbe = '#ffffff', { leucht = 0 } = {}) {
  const ph = Math.round(1024 * hh / b), t = textTex('sch' + text + grund + farbe, text, { w: 1024, h: ph, grund, farbe, font: `bold ${Math.round(ph * .55)}px DejaVu Sans` });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(b, hh), new THREE.MeshLambertMaterial({ map: t, transparent: grund.includes('rgba'), emissive: leucht ? 0xffffff : 0, emissiveMap: leucht ? t : null, emissiveIntensity: leucht }));
  m.position.set(x, y, z); m.rotation.y = ry; s.add(m); return m;
}

// ---------------------------------------------------------------- Stadt-Silhouette (Licht geht wellenförmig aus)
function skyline(s, mitte, { n = 170, rMin = 45, rMax = 450, boden = -14, seed = 3 } = {}) {
  const r = rng(seed), gruppen = Array.from({ length: 8 }, () => ({ mats: [] }));
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rad = rMin + r() * (rMax - rMin); const x = mitte.x + Math.cos(a) * rad, z = mitte.z + Math.sin(a) * rad;
    if (z > mitte.z + 22) continue;
    const h = 12 + r() * (rad > 200 ? 75 : 38), w = 10 + r() * 16, key = 'b' + (i % 7);
    const farbe = ['#4a5361', '#5d6673', '#6b5d55', '#55606e', '#6e6a62'][i % 5];
    const map = fassadeTex(key, .55, farbe); map.repeat.set(w / 14, h / 26); const em = fensterMaske(key); em.repeat.copy(map.repeat);
    const m = new THREE.MeshLambertMaterial({ map, emissive: 0xffd9a0, emissiveMap: em, emissiveIntensity: 1 });
    const g = gruppen[Math.min(7, Math.floor((rad - rMin) / (rMax - rMin) * 8))]; g.mats.push(m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * (.6 + r() * .6)), m); b.position.set(x, boden + h / 2, z); s.add(b);
    if (r() < .5) { const d = new THREE.Mesh(new THREE.BoxGeometry(w * .3, 2 + r() * 3, w * .3), mat(0x495057)); d.position.set(x + (r() - .5) * w * .4, boden + h + 1.5, z); s.add(d); }
    if (r() < .3) { const rot = new THREE.Mesh(new THREE.SphereGeometry(.4, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2030 })); rot.position.set(x, boden + h + .5, z); s.add(rot); g.mats.push(rot.material); }
  }
  return gruppen;
}
function stadtLicht(gruppen, k, t) {
  gruppen.forEach((g, i) => { const aus = sm(i / 8, i / 8 + .15, k), flacker = aus > 0 && aus < 1 ? (Math.sin(t * 60 + i) > 0 ? 1 : .2) : 1;
    for (const m of g.mats) { if (m.isMeshBasicMaterial) m.color.setRGB(1 - aus * .9, (1 - aus) * .13, (1 - aus) * .19); else m.emissiveIntensity = (1 - aus) * flacker; } });
}

// ---------------------------------------------------------------- Fahrzeuge, Fahrrad, Baum
export function auto(s, x, z, ry, farbe = 0x9d0208, { licht = false, typ = 'pkw', y = 0 } = {}) {
  const a = new THREE.Group(); a.position.set(x, y, z); a.rotation.y = ry;
  const lack = mat(farbe, { r: .3, m: .3 }), glas = mat(0x1a2533, { r: .1, m: .5 }), schwarz = mat(0x15171a), chrom = mat(0xced4da, { m: .9, r: .2 });
  const L = typ === 'transporter' ? 5.0 : 4.3, Hh = typ === 'transporter' ? 1.3 : .62;
  a.add(at(box(1.8, Hh, L, lack), 0, .35 + Hh / 2, 0));
  if (typ === 'transporter') { a.add(at(box(1.78, .55, 1.2, glas), 0, 1.35, -1.7)); a.add(at(box(1.82, .45, L * .98, lack), 0, 1.9, 0)); }
  else { a.add(at(box(1.62, .5, 2.2, glas), 0, 1.15, .1)); a.add(at(box(1.56, .07, 2.0, lack), 0, 1.43, .1)); for (const sx of [-.8, .8]) a.add(at(box(.06, .5, .06, lack), sx, 1.15, -.98)); }
  for (const sx of [-.82, .82]) for (const zz of [-L * .32, L * .32]) { a.add(at(cyl(.33, .33, .22, schwarz, 16), sx, .33, zz, 0, 0, Math.PI / 2)); a.add(at(cyl(.18, .18, .23, chrom, 10), sx, .33, zz, 0, 0, Math.PI / 2)); }
  for (const sx of [-.95, .95]) a.add(at(box(.14, .08, .16, lack), sx, 1.0, -L * .2));
  a.vorne = []; for (const sx of [-.58, .58]) { const m = mat(0xfff6e0, { e: 0xfff1d6, ei: licht ? 3 : 0, noCache: true }); a.add(at(box(.34, .13, .05, m), sx, .7, -L / 2 - .01)); a.vorne.push(m); }
  a.hinten = []; for (const sx of [-.62, .62]) { const m = mat(0x9d0208, { e: 0xff2020, ei: licht ? 1.5 : .3, noCache: true }); a.add(at(box(.32, .12, .05, m), sx, .72, L / 2 + .01)); a.hinten.push(m); }
  a.add(at(box(.5, .13, .02, mat(0xf1f3f5)), 0, .45, -L / 2 - .02)); a.add(at(box(.5, .13, .02, mat(0xf1f3f5)), 0, .5, L / 2 + .02));
  a.add(at(box(1.82, .12, .2, schwarz), 0, .42, -L / 2 + .05)); a.add(at(box(1.82, .12, .2, schwarz), 0, .42, L / 2 - .05)); a.add(at(box(.6, .08, .02, schwarz), 0, .62, -L / 2 - .02));
  s.add(a); return a;
}
function fahrrad(s, x, z, ry, farbe, y = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; s.add(g); const rm = mat(farbe, { m: .4, r: .4 }), sw = mat(0x111111);
  for (const zz of [-.5, .5]) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(.33, .025, 6, 18), sw), 0, .35, zz, 0, Math.PI / 2, 0));
  g.add(at(box(.04, .04, .9, rm), 0, .55, 0, .35)); g.add(at(box(.04, .45, .04, rm), 0, .55, .15, -.3)); g.add(at(box(.04, .5, .04, rm), 0, .6, -.42, .25));
  g.add(at(box(.1, .04, .22, sw), 0, .86, .2)); g.add(at(box(.5, .03, .03, sw), 0, .9, -.5));
}
function baum(s, x, z, h = 5, y = 0) {
  s.add(at(cyl(.13, .2, h * .55, mat(0x5c3a20), 8), x, y + h * .27, z));
  s.add(at(sph(h * .26, mat(0x52734d, { r: 1 }), 10, 8), x, y + h * .62, z)); s.add(at(sph(h * .2, mat(0x6a994e, { r: 1 }), 10, 8), x + h * .12, y + h * .75, z + .2)); s.add(at(sph(h * .17, mat(0x3f6634, { r: 1 }), 10, 8), x - h * .12, y + h * .72, z - .15));
  s.add(bx(x - .6, x + .6, y, y + .02, z - .6, z + .6, mat(0x5c4a3a)));
}

// ======================================================================= Wohnblock: Wohnung (4. Stock) + Treppenhaus
// Wohnung: x −3..3, z −3..2.5, Höhe 2.6. Balkontür z = −3 (x −2.2..0.8, Pfosten bei −0.7), Balkon bis z −4.4.
// Wohnungstür x −1.4..−0.4 in z 2.5. Treppenhaus z 2.7..7.6: Podest x −3.2..0.8 (+ Streifen x 0.8..3.2, z 2.7..3.4),
// Treppenauge x 0.8..3.2, z 3.4..7.6: Lauf A x 2.1..3.15 von z 3.4 (y 0) nach z 6.2 (y −1.44), Zwischenpodest z 6.2..7.6 (y −1.44),
// Lauf B x 0.85..1.95 von z 6.2 (y −1.44) zurück nach z 3.4 (y −2.88). Nachbartür in Wand x = −3.2 bei z 5..6. Straße unten: y −14.
export const WOHNUNG = { tisch: [-1.0, -.4], tuer: [-.9, 2.5], fenster: [-1.45, -3], sofa: [1.15, .55], nachbartuer: [-3.2, 5.5], kuehlschrank: [-2.62, 1.75], treppeOben: [2.6, 3.4], zwischenpodest: [2.0, 6.9] };
export function wohnblock(s) {
  const w = { s };
  s.background = new THREE.Color(0x0b1020);
  s.fog = new THREE.Fog(0x141b2b, 60, 800);
  w.hemi = new THREE.HemisphereLight(0x8aa0d8, 0x1a1a22, .55); s.add(w.hemi);
  w.mond = new THREE.DirectionalLight(0x9fb4ff, .5); w.mond.position.set(-20, 30, -40); s.add(w.mond);
  const wandM = mat(0xffffff, { r: .9, map: tapete }), weiss = mat(0xeae6df, { r: .9 }), holz = mat(0x8c5a32, { r: .7 }), dunkelHolz = mat(0x5c3a20, { r: .8 }), metall = mat(0xadb5bd, { m: .6, r: .3 });
  const leiste = mat(0xf1f3f5), rahmen = mat(0xf1f3f5, { r: .5 });
  // Boden, Decke, Wände, Fußleisten, Schalter/Steckdosen, Heizkörper
  s.add(bx(-3, 3, -.1, 0, -3, 2.5, mat(0xffffff, { r: .7, map: parkett })));
  s.add(bx(-3, 3, 2.6, 2.7, -3, 2.5, weiss));
  s.add(bx(-3.2, -3, 0, 2.6, -3, 2.5, wandM)); s.add(bx(3, 3.2, 0, 2.6, -3, 2.5, wandM));
  s.add(bx(-3, -2.97, 0, .08, -3, 2.5, leiste)); s.add(bx(2.97, 3, 0, .08, -3, 2.5, leiste)); s.add(bx(-3, 3, 0, .08, 2.47, 2.5, leiste));
  for (const [x, z, ry] of [[-.1, 2.48, 0], [2.98, -1.4, Math.PI / 2], [-2.98, -.6, Math.PI / 2]]) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; s.add(g); g.add(at(box(.09, .09, .02, leiste), 0, 1.05, 0)); g.add(at(box(.08, .08, .02, leiste), .3, .3, 0)); }
  { const hk = new THREE.Group(); hk.position.set(1.8, 0, -2.92); s.add(hk); for (let k = 0; k < 10; k++) hk.add(at(box(.07, .55, .06, mat(0xf1f3f5, { r: .4 })), -.4 + k * .09, .45, 0)); hk.add(at(cyl(.02, .02, .2, mat(0xced4da), 6), .5, .3, 0)); }
  // Fensterwand mit Balkontür
  s.add(bx(-3.2, -2.2, 0, 2.6, -3.2, -3, wandM)); s.add(bx(.8, 3.2, 0, 2.6, -3.2, -3, wandM)); s.add(bx(-2.2, .8, 2.3, 2.6, -3.2, -3, wandM));
  for (const x of [-2.2, -.7, .8]) s.add(bx(x - .04, x + .04, 0, 2.3, -3.15, -3.05, rahmen)); s.add(bx(-2.2, .8, 2.26, 2.3, -3.15, -3.05, rahmen));
  for (const x of [-.8, -.6]) s.add(bx(x - .015, x + .015, 1.1, 1.25, -3.02, -2.98, metall));
  w.glas = mat(0x9fc3dd, { r: .1, transparent: true, opacity: .16 }); s.add(bx(-2.2, .8, 0, 2.26, -3.11, -3.09, w.glas, false));
  for (const sx of [-2.0, .6]) s.add(bx(sx - .28, sx + .28, .1, 2.35, -2.95, -2.9, mat(0x6d597a, { r: .9 }))); s.add(at(cyl(.015, .015, 3.4, metall, 6), -.7, 2.42, -2.92, 0, 0, Math.PI / 2));
  // Rückwand + Wohnungstür, Garderobe mit Jacken, Schuhregal, Spiegel
  s.add(bx(-3.2, -1.4, 0, 2.6, 2.5, 2.7, wandM)); s.add(bx(-.4, 3.2, 0, 2.6, 2.5, 2.7, wandM)); s.add(bx(-1.4, -.4, 2.1, 2.6, 2.5, 2.7, wandM));
  w.tuer = new THREE.Group(); w.tuer.position.set(-1.4, 0, 2.6); s.add(w.tuer);
  w.tuer.add(at(box(.98, 2.08, .06, mat(0xe9ecef, { r: .5 })), .5, 1.04, 0)); w.tuer.add(at(box(.12, .03, .05, metall), .82, 1.0, -.06)); w.tuer.add(at(box(.12, .03, .05, metall), .82, 1.0, .06));
  w.tuer.add(at(cyl(.012, .012, .08, mat(0x111111), 8), .5, 1.55, 0, Math.PI / 2)); w.tuer.add(at(box(.4, .6, .02, mat(0xdee2e6)), .5, 1.4, -.04));
  s.add(bx(-1.46, -1.4, 0, 2.12, 2.48, 2.72, rahmen)); s.add(bx(-.4, -.34, 0, 2.12, 2.48, 2.72, rahmen)); s.add(bx(-1.46, -.34, 2.08, 2.14, 2.48, 2.72, rahmen));
  s.add(bx(-2.9, -1.7, 1.6, 1.64, 2.38, 2.48, holz)); for (let k = 0; k < 4; k++) { s.add(at(cyl(.015, .015, .1, metall, 6), -2.8 + k * .3, 1.55, 2.42, Math.PI / 2)); s.add(at(box(.3, .75, .12, mat([0x9d0208, 0x264653, 0xe9c46a, 0x6d597a][k], { r: .9 })), -2.8 + k * .3, 1.15, 2.36)); }
  s.add(bx(-2.9, -1.8, 0, .45, 2.15, 2.47, dunkelHolz)); { const L = []; for (let k = 0; k < 5; k++) for (const y of [.09, .31]) L.push([-2.8 + k * .22, y, 2.3, .1, .09, .26, [0xf1f3f5, 0x212529, 0xe63946, 0x457b9d, 0xf4a261][(k * 2 + (y > .2 ? 1 : 0)) % 5]]); viele(s, BOX, L); }
  s.add(bx(.1, .7, 1.1, 2.0, 2.46, 2.49, mat(0xcfe8ff, { r: .05, m: .8 }))); s.add(bx(.06, .74, 1.06, 2.04, 2.47, 2.5, holz));
  // Küche
  s.add(bx(-3, -2.4, 0, .9, -2.6, 1.1, mat(0x495057, { r: .5 }))); s.add(bx(-3, -2.35, .9, .94, -2.65, 1.15, mat(0xced4da, { r: .3 })));
  for (let z = -2.55; z < 1.05; z += .6) { s.add(bx(-2.41, -2.39, .1, .82, z + .02, z + .56, mat(0x5c636b))); s.add(bx(-2.39, -2.37, .7, .73, z + .2, z + .38, metall)); }
  s.add(bx(-3, -2.98, .94, 1.5, -2.6, 1.1, mat(0xffffff, { map: fliese('kueche', '#e9ecef', '#adb5bd', [6, 1]) })));
  s.add(bx(-3, -2.65, 1.5, 2.2, -2.6, 1.1, mat(0xf1f3f5, { r: .5 })));
  for (let z = -2.55; z < 1.05; z += .6) { s.add(bx(-2.66, -2.64, 1.55, 2.15, z + .02, z + .56, mat(0xe9ecef))); s.add(bx(-2.64, -2.62, 1.58, 1.61, z + .2, z + .38, metall)); }
  s.add(bx(-2.45, -2.38, .2, .78, -2.1, -1.4, mat(0x111111, { r: .2 }))); s.add(bx(-2.44, -2.37, .3, .65, -2.0, -1.5, mat(0x343a40, { r: .1 })));
  for (const [x, z] of [[-2.8, -2.0], [-2.8, -1.55], [-2.55, -2.0], [-2.55, -1.55]]) s.add(at(cyl(.09, .09, .012, mat(0x111111), 14), x, .95, z));
  s.add(at(cyl(.12, .1, .14, mat(0x6c757d, { m: .6 }), 14), -2.8, 1.02, -2.0));   // Topf
  s.add(bx(-2.95, -2.5, .935, .945, -.6, .1, mat(0x868e96, { m: .7 }))); s.add(at(cyl(.015, .015, .3, metall, 6), -2.9, 1.08, -.25)); s.add(at(cyl(.012, .012, .15, metall, 6), -2.83, 1.22, -.25, 0, 0, Math.PI / 2));
  s.add(bx(-2.98, -2.6, .94, 1.22, .3, .8, mat(0x212529))); s.add(bx(-2.6, -2.59, .98, 1.18, .35, .65, mat(0x111111, { r: .1 })));
  s.add(at(cyl(.07, .08, .2, mat(0xced4da, { m: .6 }), 12), -2.75, 1.04, -1.0)); s.add(bx(-2.85, -2.65, .94, 1.1, -2.5, -2.25, mat(0x9d0208)));
  s.add(at(cyl(.16, .1, .08, mat(0xf1f3f5), 16), -2.7, .98, 1.0)); for (const [dx, dz, f] of [[0, 0, 0xe63946], [.06, .05, 0xf4a261], [-.05, .04, 0x8ab17d]]) s.add(at(sph(.045, mat(f), 8, 6), -2.7 + dx, 1.04, 1.0 + dz));
  w.kuehl = new THREE.Group(); s.add(w.kuehl); w.kuehl.add(bx(-3, -2.25, 0, 1.85, 1.35, 2.15, mat(0xdee2e6, { r: .3, m: .2 }))); w.kuehl.add(bx(-2.27, -2.24, .9, 1.3, 1.45, 1.5, metall)); w.kuehl.add(bx(-2.25, -2.24, 1.2, 1.22, 1.36, 2.14, mat(0xadb5bd)));
  viele(s, BOX, [[-2.245, 1.5, 1.7, .01, .06, .06, 0xe63946], [-2.245, 1.62, 1.9, .01, .05, .07, 0x2a9d8f], [-2.245, 1.4, 1.95, .01, .2, .14, 0xf1faee], [-2.245, 1.7, 1.6, .01, .05, .05, 0xffd166]]);
  // Esstisch + Stühle (mit Polster) + gedeckter Tisch + Kerzen
  const [tx, tz] = WOHNUNG.tisch;
  s.add(bx(tx - .7, tx + .7, .72, .76, tz - .45, tz + .45, holz)); for (const [x, z] of [[-.62, -.38], [.62, -.38], [-.62, .38], [.62, .38]]) s.add(at(box(.05, .72, .05, dunkelHolz), tx + x, .36, tz + z));
  s.add(bx(tx - .5, tx + .5, .76, .762, tz - .15, tz + .15, mat(0x9d0208, { r: 1 }), false));
  w.stuehle = [];
  for (const [x, z, ry] of [[tx, tz - .75, 0], [tx, tz + .75, Math.PI], [tx + 1.0, tz, -Math.PI / 2]]) { const st = new THREE.Group(); st.position.set(x, 0, z); st.rotation.y = ry; s.add(st);
    st.add(at(box(.42, .04, .42, holz), 0, .45, 0)); for (const [a, b2] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) st.add(at(box(.035, .45, .035, dunkelHolz), a, .225, b2)); st.add(at(box(.42, .42, .03, holz), 0, .7, -.2)); w.stuehle.push(st); }
  for (const [x, z] of [[0, -.25], [0, .25], [.45, 0]]) { s.add(at(cyl(.12, .12, .01, mat(0xf8f9fa), 18), tx + x, .77, tz + z)); s.add(at(cyl(.08, .08, .012, mat(0xd68c45), 14), tx + x, .78, tz + z)); s.add(at(box(.02, .005, .18, metall), tx + x + .15, .772, tz + z)); s.add(at(cyl(.035, .03, .1, mat(0xcfe8ff, { transparent: true, opacity: .6 }), 10), tx + x - .12, .82, tz + z - .12)); }
  s.add(at(cyl(.1, .08, .12, mat(0xf1f3f5), 14), tx - .3, .82, tz)); s.add(at(cyl(.035, .035, .22, mat(0x2d6a4f, { r: .2 }), 8), tx + .3, .88, tz + .05));
  w.kerzen = []; for (const x of [-.12, .12]) { s.add(at(cyl(.02, .02, .16, mat(0xfefae0), 8), tx + x, .84, tz)); const f = new THREE.Mesh(new THREE.SphereGeometry(.015, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffb347 })); f.position.set(tx + x, .94, tz); f.visible = false; s.add(f); w.kerzen.push(f); }
  w.kerzenLicht = new THREE.PointLight(0xffa64d, 0, 6, 1.6); w.kerzenLicht.position.set(tx, 1.0, tz); s.add(w.kerzenLicht);
  // Wohnbereich: Sofa (Kissen, Decke), Couchtisch, Lowboard + Konsole + TV, Stehlampe, Regal, Bilder, Uhr, Pflanzen, Teppich, Teddy, Schulranzen
  const [sx0, sz0] = WOHNUNG.sofa, stoff = mat(0x3d5a80, { r: .95 });
  s.add(bx(sx0 - .45, sx0 + .45, .1, .45, sz0 - 1.0, sz0 + 1.0, stoff)); s.add(bx(sx0 - .45, sx0 - .2, .45, .9, sz0 - 1.0, sz0 + 1.0, stoff)); for (const zz of [-1.0, 1.0]) s.add(bx(sx0 - .45, sx0 + .45, .45, .62, sz0 + zz - .12, sz0 + zz + .12, stoff));
  for (const zz of [-.45, .45]) s.add(bx(sx0 - .2, sx0 + .4, .45, .55, sz0 + zz - .42, sz0 + zz + .42, mat(0x4a6fa5, { r: .95 })));
  s.add(bx(sx0 - .15, sx0 + .1, .52, .82, sz0 - .7, sz0 - .4, mat(0xe9c46a))); s.add(bx(sx0 - .1, sx0 + .4, .55, .62, sz0 + .2, sz0 + .9, mat(0xb56576)));
  for (const [x, z] of [[-.4, -.9], [.4, -.9], [-.4, .9], [.4, .9]]) s.add(at(box(.05, .1, .05, dunkelHolz), sx0 + x * .9, .05, sz0 + z));
  s.add(bx(1.9, 2.5, .36, .4, sz0 - .4, sz0 + .4, holz)); for (const [x, z] of [[1.95, -.35], [2.45, -.35], [1.95, .35], [2.45, .35]]) s.add(at(box(.04, .36, .04, dunkelHolz), x, .18, sz0 + z));
  s.add(bx(2.0, 2.2, .4, .42, sz0 - .1, sz0 + .05, mat(0x212529))); s.add(at(cyl(.04, .035, .09, mat(0xe63946), 10), 2.3, .45, sz0 + .2)); s.add(bx(2.05, 2.35, .4, .41, sz0 - .35, sz0 - .15, mat(0x457b9d)));
  s.add(bx(2.55, 3.0, 0, .45, -.7, 1.0, dunkelHolz)); s.add(bx(2.7, 2.9, .45, .5, -.1, .3, mat(0x111111))); s.add(bx(2.6, 2.8, .1, .3, .3, .6, mat(0x212529)));
  s.add(bx(2.9, 3.0, .5, 2.0, -.6, .9, mat(0x5c3a20))); s.add(bx(2.75, 2.97, .9, 1.65, -.45, .75, mat(0x111111)));
  w.tvTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 144; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, g: c.getContext('2d'), t }; })();
  w.tv = new THREE.MeshBasicMaterial({ map: w.tvTex.t }); { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .6), w.tv); m.position.set(2.744, 1.275, .15); m.rotation.y = -Math.PI / 2; s.add(m); }
  w.tvLicht = new THREE.PointLight(0x5a8ac8, 2.5, 5, 1.6); w.tvLicht.position.set(2.4, 1.3, .2); s.add(w.tvLicht);
  s.add(at(cyl(.02, .02, 1.6, mat(0x343a40), 8), 2.6, .8, 2.1)); s.add(at(cyl(.18, .12, .25, mat(0xf1e3c8, { e: 0xffd9a0, ei: .8 }), 14), 2.6, 1.65, 2.1)); s.add(at(cyl(.2, .2, .03, mat(0x343a40), 14), 2.6, .015, 2.1));
  s.add(bx(1.4, 2.4, 0, 2.0, 2.2, 2.47, dunkelHolz)); for (const y of [.5, 1.0, 1.5]) s.add(bx(1.42, 2.38, y, y + .03, 2.22, 2.45, holz));
  { const r2 = rng(5), L2 = []; for (const y of [.53, 1.03]) for (let k = 0; k < 9; k++) L2.push([1.5 + k * .1, y + .14, 2.34, .08, .26 + r2() * .06, .2, [0x9d0208, 0x1d3557, 0x2a9d8f, 0xe9c46a, 0x6d597a][k % 5]]); viele(s, BOX, L2);
    s.add(at(box(.2, .25, .03, mat(0xdee2e6)), 1.7, 1.66, 2.3)); s.add(at(sph(.12, mat(0x2d6a4f, { r: 1 }), 8, 6), 2.15, 1.65, 2.33)); s.add(at(cyl(.07, .06, .1, mat(0xbc6c25), 10), 2.15, 1.55, 2.33)); }
  for (const [x, f] of [[-2.0, '#7a9e9f'], [.2, '#b5838d']]) { const tx2 = canvasTex('wbild' + f, 64, 64, (g, ww, hh) => { g.fillStyle = f; g.fillRect(0, 0, ww, hh); g.fillStyle = '#f1f3f5'; g.beginPath(); g.moveTo(0, hh); g.lineTo(ww * .45, hh * .3); g.lineTo(ww, hh); g.fill(); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(48, 16, 7, 0, 7); g.fill(); });
    s.add(at(new THREE.Mesh(new THREE.BoxGeometry(.6, .45, .03), [rahmen, rahmen, rahmen, rahmen, rahmen, new THREE.MeshLambertMaterial({ map: tx2 })]), x, 1.75, 2.48)); }
  { const uhr = new THREE.Group(); uhr.position.set(2.97, 2.0, -1.8); uhr.rotation.y = -Math.PI / 2; s.add(uhr); uhr.add(at(cyl(.18, .18, .03, mat(0xf8f9fa), 20), 0, 0, 0, Math.PI / 2)); uhr.add(at(box(.012, .12, .01, mat(0x111111)), 0, .05, .02)); uhr.add(at(box(.08, .012, .01, mat(0x111111)), .03, 0, .02)); }
  s.add(at(cyl(.18, .14, .35, mat(0xbc6c25), 12), -2.6, .18, -2.6)); s.add(at(sph(.35, mat(0x2d6a4f, { r: 1 }), 10, 8), -2.6, .7, -2.6)); s.add(at(sph(.25, mat(0x3f6634, { r: 1 }), 10, 8), -2.5, .95, -2.5));
  s.add(bx(-2.0, .2, .005, .015, -2.2, -.9, mat(0xb56576, { r: 1 }), false)); s.add(bx(-1.9, .1, .016, .018, -2.1, -1.0, mat(0xe9c46a, { r: 1 }), false));
  { const td = new THREE.Group(); td.position.set(2.2, 0, 1.75); td.rotation.y = -.6; s.add(td); const fm = mat(0xbc6c25, { r: 1 }); td.add(at(sph(.12, fm, 10, 8), 0, .12, 0)); td.add(at(sph(.09, fm, 10, 8), 0, .3, .02)); for (const sx of [-.06, .06]) { td.add(at(sph(.035, fm, 6, 4), sx, .38, .02)); td.add(at(sph(.045, fm, 6, 4), sx * 1.8, .14, .08)); } }
  s.add(bx(1.6, 1.95, 0, .4, 1.2, 1.4, mat(0xe63946))); s.add(bx(1.62, 1.93, .1, .3, 1.4, 1.45, mat(0xffd166)));
  // Licht
  w.lampen = [new THREE.PointLight(0xffe2b8, 9, 9, 1.5), new THREE.PointLight(0xffd9a0, 4, 6, 1.5), new THREE.PointLight(0xffe8c4, 3, 5, 1.5)];
  w.lampen[0].position.set(tx, 2.2, tz); w.lampen[1].position.set(2.6, 1.7, 2.0); w.lampen[2].position.set(-2.4, 1.45, -.6); w.lampen.forEach(l => s.add(l));
  w.lampenMat = mat(0xfff1c9, { e: 0xffd88a, ei: 2.2, noCache: true }); s.add(at(cyl(.25, .3, .2, mat(0x343a40), 16, false), tx, 2.45, tz)); s.add(at(sph(.1, w.lampenMat, 10, 8, false), tx, 2.33, tz)); s.add(at(cyl(.005, .005, .2, mat(0x111111), 4), tx, 2.6, tz));
  s.add(bx(-2.64, -2.62, 1.47, 1.5, -2.5, 1.0, w.lampenMat, false));
  // Balkon
  s.add(bx(-2.4, 1.0, -.15, 0, -4.4, -3.2, mat(0x868e96))); s.add(bx(-2.4, 1.0, -.35, -.15, -4.45, -3.2, mat(0xadb5bd)));
  s.add(bx(-2.4, 1.0, .95, 1.02, -4.42, -4.35, mat(0x495057))); for (let x = -2.35; x <= 1.0; x += .12) s.add(bx(x, x + .02, 0, .95, -4.4, -4.37, mat(0x495057)));
  for (const x of [-2.4, .98]) s.add(bx(x, x + .03, 0, 1.0, -4.4, -3.2, mat(0x495057)));
  s.add(at(box(.6, .3, .2, mat(0x6b4426)), -1.9, .95, -4.3)); for (let k = 0; k < 4; k++) s.add(at(sph(.08, mat(k % 2 ? 0xd62828 : 0x2d6a4f), 6, 4), -2.1 + k * .14, 1.15, -4.3));
  { const st = new THREE.Group(); st.position.set(.6, 0, -3.8); st.rotation.y = 2.4; s.add(st); const pm = mat(0x343a40, { m: .4 }); st.add(at(box(.45, .03, .45, pm), 0, .45, 0)); st.add(at(box(.45, .4, .03, pm), 0, .67, -.21)); for (const [a, b2] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) st.add(at(box(.025, .45, .025, pm), a, .22, b2)); }
  // Haus außen + Nachbarbalkone, Kreuzung unten (y −14) mit Ampeln, Laternen, Zebrastreifen, parkenden + fahrenden Autos, Bäumen
  const fasT = fassadeTex('haus', .5, '#8d8a83', { balkon: true }); fasT.repeat.set(2, 1.2); const fas = new THREE.MeshLambertMaterial({ map: fasT });
  s.add(bx(-14, -2.5, -14, 9, -3.6, 12, fas)); s.add(bx(1.2, 14, -14, 9, -3.6, 12, fas)); s.add(bx(-2.5, 1.2, -14, -.4, -3.6, 12, fas)); s.add(bx(-2.5, 1.2, 2.7, 9, -3.6, 12, fas));
  for (const y of [-11.2, -8.4, -5.6, -2.8, 2.8, 5.6]) for (const x of [-9, 5.5]) { s.add(bx(x - 1.7, x + 1.7, y - .15, y, -4.8, -3.6, mat(0x868e96))); s.add(bx(x - 1.7, x + 1.7, y, y + .95, -4.82, -4.76, mat(0x495057, { transparent: true, opacity: .8 }))); }
  const Y = -14;
  s.add(bx(-70, 70, Y - .2, Y, -70, 20, mat(0xffffff, { r: .95, map: beton('asphaltW', '#3d4249', [20, 20]) })));
  s.add(bx(-70, 70, Y - .2, Y + .12, -8.5, -4.6, mat(0x9a9a93))); s.add(bx(-70, 70, Y - .2, Y + .12, -43.4, -39.5, mat(0x9a9a93)));
  for (let x = -68; x < 70; x += 6) s.add(bx(x, x + 3, Y, Y + .01, -24.1, -23.9, mat(0xf1f3f5), false));
  for (let z = -38.5; z <= -9.5; z += .8) s.add(bx(-4, -1, Y, Y + .01, z - .25, z + .25, mat(0xf1f3f5), false));
  w.ampeln = []; for (const [x, z] of [[-5, -9], [1, -39]]) { s.add(at(cyl(.07, .07, 3.4, mat(0x343a40), 8), x, Y + 1.7, z)); s.add(at(box(.32, .85, .28, mat(0x212529)), x, Y + 3.4, z)); w.ampeln.push([0xff2020, 0xffd60a, 0x30ff60].map((c, k) => { const m = mat(c, { e: c, ei: 3, noCache: true }); s.add(at(sph(.09, m, 8, 6), x, Y + 3.65 - k * .25, z + (z > -20 ? -.15 : .15))); return m; })); }
  w.strassenLampen = []; for (const x of [-24, -8, 8, 24]) for (const z of [-8, -40]) { s.add(at(cyl(.08, .1, 6, mat(0x343a40), 8), x, Y + 3, z)); const m = mat(0xfff1c9, { e: 0xffd88a, ei: 3, noCache: true }); s.add(at(box(.5, .14, .3, m), x, Y + 5.8, z + (z > -20 ? -1 : 1))); w.strassenLampen.push(m); }
  w.strassenLicht = new THREE.PointLight(0xffd9a0, 30, 40, 1.4); w.strassenLicht.position.set(0, Y + 5, -20); s.add(w.strassenLicht);
  for (const [x, z, ry, c] of [[-20, -10, Math.PI / 2, 0x6a994e], [-14, -10, Math.PI / 2, 0xf1f3f5], [14, -10, Math.PI / 2, 0x2b2d42], [20, -10, Math.PI / 2, 0xe76f51], [-18, -38, -Math.PI / 2, 0x457b9d], [16, -38, -Math.PI / 2, 0xadb5bd]]) auto(s, x, z, ry, c, { y: Y });
  w.fahrer = [auto(s, -40, -21, Math.PI / 2, 0x457b9d, { licht: true, y: Y }), auto(s, 40, -27, -Math.PI / 2, 0xe9c46a, { licht: true, y: Y })];
  for (const x of [-28, -12, 12, 28]) baum(s, x, -6.5, 6, Y + .12);
  w.gruppen = skyline(s, new THREE.Vector3(0, 0, -60), { boden: Y });
  // ---- Treppenhaus
  const tw = mat(0xd6cfc0, { r: .9 }), stein = mat(0xffffff, { r: .6, map: fliese('treppe', '#b8b2a6', '#958f83', [3, 3]) }), handlauf = mat(0x6b4426, { r: .6 }), stab = mat(0x495057, { m: .5 });
  s.add(bx(-3.2, .8, -.1, 0, 2.7, 7.6, stein)); s.add(bx(.8, 3.2, -.1, 0, 2.7, 3.4, stein));
  s.add(bx(-3.2, 3.2, 2.6, 2.7, 2.7, 7.6, mat(0xe9ecef)));
  s.add(bx(-3.4, -3.2, -3.5, 2.6, 2.7, 7.6, tw)); s.add(bx(3.2, 3.4, -3.5, 2.6, 2.7, 7.6, tw)); s.add(bx(-3.4, 3.4, -3.5, 2.6, 7.6, 7.8, tw));
  s.add(bx(.8, 3.2, -3.5, -.1, 2.5, 2.7, tw));
  for (let k = 0; k < 8; k++) { const z0 = 3.4 + k * .35, y = -(k + 1) * .18; s.add(bx(2.1, 3.15, y - .06, y, z0, z0 + .35, stein)); s.add(bx(2.1, 3.15, y - .45, y - .06, z0 + .2, z0 + .35, tw)); }
  s.add(bx(.8, 3.2, -1.5, -1.44, 6.2, 7.6, stein)); s.add(bx(.8, 3.2, -1.8, -1.5, 6.2, 7.6, tw));
  for (let k = 0; k < 8; k++) { const z1 = 6.2 - k * .35, y = -1.44 - (k + 1) * .18; s.add(bx(.85, 1.95, y - .06, y, z1 - .35, z1, stein)); s.add(bx(.85, 1.95, y - .45, y - .06, z1 - .35, z1 - .2, tw)); }
  s.add(bx(.8, 3.2, -2.94, -2.88, 2.7, 3.4, stein));
  for (let z = 3.45; z <= 7.55; z += .14) s.add(bx(.79, .81, 0, .95, z - .01, z + .01, stab)); s.add(bx(.76, .84, .95, 1.0, 3.4, 7.6, handlauf));
  for (let x = .85; x <= 2.05; x += .14) s.add(bx(x - .01, x + .01, 0, .95, 3.39, 3.41, stab)); s.add(bx(.8, 2.08, .95, 1.0, 3.37, 3.43, handlauf));
  for (let k = 0; k <= 8; k++) { const z = 3.45 + k * .35; s.add(bx(2.02, 2.04, -k * .18, -k * .18 + .9, z - .01, z + .01, stab)); }
  { const hl = box(.06, .05, Math.hypot(2.8, 1.44), handlauf); hl.position.set(2.03, -.72 + .92, 4.8); hl.rotation.x = Math.atan2(1.44, 2.8); s.add(hl); }
  for (let k = 0; k <= 8; k++) { const z = 6.2 - k * .35; s.add(bx(1.97, 1.99, -1.44 - k * .18, -1.44 - k * .18 + .9, z - .01, z + .01, stab)); }
  { const hl = box(.06, .05, Math.hypot(2.8, 1.44), handlauf); hl.position.set(1.98, -2.16 + .92, 4.8); hl.rotation.x = -Math.atan2(1.44, 2.8); s.add(hl); }
  w.nachbarTuer = new THREE.Group(); w.nachbarTuer.position.set(-3.15, 0, 5.0); s.add(w.nachbarTuer);
  w.nachbarTuer.add(at(box(.06, 2.08, 1.0, mat(0x7a4e2d, { r: .6 })), 0, 1.04, .5)); w.nachbarTuer.add(at(box(.05, .03, .12, metall), .06, 1.0, .85)); w.nachbarTuer.add(at(box(.02, .1, .3, mat(0xf1f3f5)), .04, 1.6, .5));
  s.add(bx(-3.2, -3.14, 0, 2.14, 4.94, 5.0, rahmen)); s.add(bx(-3.2, -3.14, 0, 2.14, 6.0, 6.06, rahmen)); s.add(bx(-3.2, -3.14, 2.08, 2.14, 4.94, 6.06, rahmen));
  s.add(bx(-1.35, -.45, .002, .012, 2.75, 3.3, mat(0x6b4426, { r: 1 }), false)); s.add(bx(-3.1, -2.6, .002, .012, 5.0, 6.0, mat(0x264653, { r: 1 }), false));
  viele(s, BOX, [[-2.85, .05, 6.3, .1, .1, .27, 0x212529], [-2.7, .05, 6.35, .1, .1, .27, 0x212529], [-2.45, .05, 6.4, .1, .1, .27, 0xe63946], [-2.3, .05, 6.38, .1, .1, .27, 0xe63946]]);
  { const L = []; for (let k = 0; k < 8; k++) { L.push([-1.6 + (k % 4) * .32, 1.1 + Math.floor(k / 4) * .25, 7.55, .3, .22, .1, 0x868e96]); L.push([-1.6 + (k % 4) * .32, 1.15 + Math.floor(k / 4) * .25, 7.495, .2, .02, .01, 0x111111]); } viele(s, BOX, L); }
  schildBrett(s, '4. OG', -.2, 2.2, 7.59, Math.PI, .5, .25, '#1d3557');
  s.add(bx(1.2, 2.8, -.4, 1.2, 7.58, 7.62, mat(0x9fc3dd, { transparent: true, opacity: .25 }))); s.add(bx(1.15, 2.85, -.45, -.4, 7.56, 7.64, rahmen)); s.add(bx(1.15, 2.85, 1.2, 1.25, 7.56, 7.64, rahmen));
  fahrrad(s, -.3, 7.25, Math.PI / 2, 0x2a9d8f);
  w.treppenLicht = [new THREE.PointLight(0xfff1dc, 5, 8, 1.5), new THREE.PointLight(0xfff1dc, 3, 6, 1.5)]; w.treppenLicht[0].position.set(-1, 2.3, 5); w.treppenLicht[1].position.set(2, .6, 6.9); w.treppenLicht.forEach(l => s.add(l));
  w.treppenLampe = mat(0xfff1c9, { e: 0xffd88a, ei: 2, noCache: true }); s.add(at(sph(.15, w.treppenLampe, 10, 8, false), -1, 2.5, 5)); s.add(at(sph(.12, w.treppenLampe, 10, 8, false), 3.1, .9, 6.9));
  w.notLicht = mat(0x2d6a4f, { e: 0x2dff6a, ei: 1.5, noCache: true }); s.add(bx(-3.18, -3.16, 2.25, 2.45, 3.0, 3.5, w.notLicht, false));
  s.add(bx(-3.18, -3.16, 1.2, 1.3, 3.2, 3.28, mat(0xf1f3f5)));
  return w;
}
function zeichneTV(w, t, an) {
  const g = w.tvTex.g; if (!an) { g.fillStyle = '#05070a'; g.fillRect(0, 0, 256, 144); w.tvTex.t.needsUpdate = true; return; }
  g.fillStyle = '#123a6b'; g.fillRect(0, 0, 256, 144); g.fillStyle = '#d62828'; g.fillRect(0, 112, 256, 32); g.fillStyle = '#fff'; g.font = 'bold 16px DejaVu Sans';
  g.fillText('NEUSTADT LIVE · STROMNETZ ÜBERLASTET +++', 260 - ((t * 60) % 600), 133); g.fillStyle = '#e9ecef'; g.fillRect(20, 20, 90, 80); g.fillStyle = '#1d3557'; g.fillRect(40, 40, 50, 60);
  g.fillStyle = '#ffd166'; g.font = 'bold 20px DejaVu Sans'; g.fillText('EILMELDUNG', 125, 50); g.fillStyle = '#fff'; g.font = '14px DejaVu Sans'; g.fillText('Umspannwerk Nord', 125, 75); w.tvTex.t.needsUpdate = true;
}
export function wohnblockUpdate(w, t, { licht = 1, stadt = 0, kerzen = 0, treppe = null, tv = null } = {}) {
  const flacker = licht > 0 && licht < 1 ? (Math.sin(t * 47) > 0 ? 1 : .15) : 1, l = licht * flacker;
  w.lampen[0].intensity = 9 * l; w.lampen[1].intensity = 4 * l; w.lampen[2].intensity = 3 * l; w.lampenMat.emissiveIntensity = 2.2 * l;
  const tvk = tv ?? l; zeichneTV(w, t, tvk > .5); w.tvLicht.intensity = 2.5 * (tvk > .5 ? 1 : 0) * (.8 + .2 * Math.sin(t * 9));
  const tl = treppe ?? l; w.treppenLicht[0].intensity = 5 * tl; w.treppenLicht[1].intensity = 3 * tl; w.treppenLampe.emissiveIntensity = 2 * tl;
  const st = 1 - stadt; w.strassenLampen.forEach(m => { m.emissiveIntensity = 3 * st; }); w.strassenLicht.intensity = 30 * st;
  w.ampeln.forEach(fs => fs.forEach((m, k) => { m.emissiveIntensity = st > .5 ? ((k === 0 && (t * .2) % 1 < .5) || (k === 2 && (t * .2) % 1 >= .5) ? 3 : 0) : 0; }));
  w.fahrer.forEach((a, i) => { if (a.gesteuert) return; const v = [7, -6][i]; a.position.x = ((t * v + i * 25) % 90 + 90) % 90 - 45; });
  stadtLicht(w.gruppen, stadt, t);
  w.kerzen.forEach(f => { f.visible = kerzen > 0; f.scale.setScalar(1 + .2 * Math.sin(t * 13)); });
  w.kerzenLicht.intensity = 3.5 * kerzen * (.85 + .15 * Math.sin(t * 11));
  w.hemi.intensity = .2 + .35 * l + .08 * kerzen;
}

// ======================================================================= Keller
// Gang x −1..1, z 1.5..−17 (Treppe kommt bei z 1.5 herunter), Kellerabteile links/rechts mit Lattenwänden, Rohre unter der Decke (2.3),
// Waschküche rechts (z −10..−12), Sicherungsraum am Ende: Zählerschrank an der Wand z = −17 (x −1.6..0.2), Hintertür rechts (x = 3.4, z −14.8..−16.2).
export const KELLER = { sicherung: [-.7, -16.8], hintertuer: [3.4, -15.5] };
export function keller(s) {
  const w = { s };
  s.background = new THREE.Color(0x050608); s.fog = new THREE.Fog(0x050608, 6, 26);
  w.hemi = new THREE.HemisphereLight(0x8090a8, 0x1a1a22, .12); s.add(w.hemi);
  const zm = mat(0xffffff, { r: .95, map: ziegel }), bo = mat(0xffffff, { r: .9, map: beton('kboden', '#6c6a64', [4, 8]) }), dm = mat(0x8d8a83, { r: .9 });
  s.add(bx(-3.4, 3.4, -.1, 0, -17.2, 1.5, bo)); s.add(bx(-3.4, 3.4, 2.3, 2.4, -17.2, 1.5, dm));
  s.add(bx(-3.6, -3.4, 0, 2.4, -17.2, 1.5, zm)); s.add(bx(3.4, 3.6, 0, 2.4, -17.2, -16.2, zm)); s.add(bx(3.4, 3.6, 0, 2.4, -14.8, 1.5, zm)); s.add(bx(3.4, 3.6, 2.1, 2.4, -16.2, -14.8, zm));
  s.add(bx(-3.4, 3.4, 0, 2.4, -17.4, -17.2, zm)); s.add(bx(-3.4, 3.4, 0, 2.4, 1.5, 1.7, zm));
  for (let k = 0; k < 4; k++) s.add(bx(-1, 1, 0, (k + 1) * .18, 1.5 - (4 - k) * .3, 1.5 - (3 - k) * .3, mat(0x868e96)));
  const latte = mat(0x8b6a43, { r: .9 }), r = rng(31), kisten = [], latten = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z0 = -1 - i * 3.0, z1 = z0 - 2.8, x0 = side * 1.0, x1 = side * 3.4;
    if (side > 0 && i === 3) continue;
    for (let z = z1; z <= z0; z += .12) latten.push([x0, 1.05, z + .035, .04, 2.1, .07, 0x8b6a43]);
    for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += .12) latten.push([x + .035, 1.05, z0, .07, 2.1, .04, 0x7d5f3b]);
    latten.push([(x0 + x1) / 2, 2.07, (z0 + z1) / 2, 2.4, .05, 2.8, 0x8b6a43]);
    schildBrett(s, String(i * 2 + (side > 0 ? 2 : 1)), x0 - side * .03, 1.8, (z0 + z1) / 2, side > 0 ? -Math.PI / 2 : Math.PI / 2, .2, .2, '#f1f3f5', '#111111');
    for (let k = 0; k < 6; k++) kisten.push([side * (1.6 + r() * 1.4), .2 + Math.floor(k / 3) * .4, z1 + .4 + (k % 3) * .8, .5 + r() * .3, .4, .45, [0x8b5a2b, 0xa47148, 0x6c757d, 0x264653][k % 4], r()]);
    if (i % 2 === 0) fahrrad(s, side * 2.2, (z0 + z1) / 2 + .4, 0, [0x9d0208, 0x457b9d][i % 2]);
  }
  viele(s, BOX, latten); viele(s, BOX, kisten);
  for (let k = 0; k < 3; k++) { const z = -10.4 - k * .75; s.add(bx(2.6, 3.3, 0, .85, z - .32, z + .32, mat(0xf1f3f5, { r: .4 }))); s.add(at(cyl(.22, .22, .02, mat(0x343a40, { m: .4 }), 18), 2.59, .48, z, 0, 0, Math.PI / 2)); s.add(at(cyl(.17, .17, .025, mat(0x9fc3dd, { transparent: true, opacity: .6 }), 18), 2.58, .48, z, 0, 0, Math.PI / 2)); }
  s.add(at(cyl(.006, .006, 3, mat(0xdee2e6), 4), 1.9, 1.9, -11.2, Math.PI / 2)); for (let k = 0; k < 5; k++) s.add(at(box(.3, .45, .01, mat([0xe63946, 0xf1f3f5, 0x457b9d][k % 3], { r: 1 })), 1.9, 1.65, -10.2 - k * .5, 0, Math.PI / 2));
  for (const [x, rr, f] of [[-.6, .07, 0x868e96], [-.3, .05, 0xadb5bd], [.5, .09, 0x6c757d]]) s.add(at(cyl(rr, rr, 18.5, mat(f, { m: .5 }), 10), x, 2.15, -8, Math.PI / 2));
  s.add(bx(.8, 1.0, 2.2, 2.24, -17, 1.4, mat(0x495057))); for (let z = 1; z > -17; z -= 1.5) s.add(bx(.78, 1.02, 2.15, 2.25, z, z + .04, mat(0x343a40)));
  w.lampen = []; w.lampenMat = mat(0xfff1c9, { e: 0xffd88a, ei: 2, noCache: true });
  for (const z of [-2, -8, -14]) { s.add(at(cyl(.1, .1, .15, w.lampenMat, 10, false), 0, 2.2, z)); const l = new THREE.PointLight(0xffe2b8, 4, 8, 1.5); l.position.set(0, 2.0, z); s.add(l); w.lampen.push(l); }
  const grau = mat(0x868e96, { m: .5, r: .4 });
  s.add(bx(-1.6, .2, .6, 2.1, -17.2, -16.85, grau)); s.add(bx(-1.55, .15, .65, 2.05, -16.86, -16.84, mat(0x495057)));
  { const L = []; for (let k = 0; k < 12; k++) { L.push([-1.36 + (k % 6) * .27, 1.33 + Math.floor(k / 6) * .4, -16.82, .18, .25, .04, 0xf1f3f5]); L.push([-1.36 + (k % 6) * .27, 1.33 + Math.floor(k / 6) * .4, -16.79, .04, .08, .02, k % 3 ? 0x111111 : 0xd62828]); } viele(s, BOX, L); }
  w.schrankTuer = new THREE.Group(); w.schrankTuer.position.set(.2, 1.35, -16.84); s.add(w.schrankTuer); w.schrankTuer.add(at(box(1.8, 1.5, .03, grau), -.9, 0, 0)); w.schrankTuer.rotation.y = -1.9;
  for (let k = 0; k < 6; k++) s.add(at(cyl(.025, .025, 2.0, mat([0x111111, 0x343a40, 0xe9c46a][k % 3]), 6), -1.4 + k * .3, 2.2, -17.05));
  s.add(bx(.6, 1.6, .2, 2.1, -17.2, -16.9, mat(0x495057))); schildBrett(s, 'HAUSANSCHLUSS', 1.1, 1.9, -16.88, 0, .9, .15, '#ffd60a', '#111111');
  w.botschaft = schildBrett(s, 'TAG 1 VON 7', -.7, .35, -16.83, 0, 1.6, .35, 'rgba(0,0,0,0)', '#ff2a3d');
  s.add(at(box(.5, .06, .18, mat(0xd62828)), .4, .03, -16.4, 0, .6)); s.add(at(box(.25, .2, .2, mat(0x343a40)), -.4, .1, -16.3, 0, .3));
  w.hinterTuer = new THREE.Group(); w.hinterTuer.position.set(3.35, 0, -14.8); s.add(w.hinterTuer); w.hinterTuer.add(at(box(.06, 2.05, 1.4, mat(0x5c636b, { m: .5 })), 0, 1.03, -.7)); w.hinterTuer.add(at(box(.08, .04, .5, mat(0xadb5bd, { m: .8 })), -.06, 1.0, -1.1));
  w.notLicht = mat(0x2d6a4f, { e: 0x2dff6a, ei: 1.5, noCache: true }); s.add(bx(3.36, 3.38, 2.15, 2.3, -15.9, -15.2, w.notLicht, false));
  w.draussen = new THREE.PointLight(0x9fb4ff, 0, 8, 1.5); w.draussen.position.set(4.5, 1.5, -15.5); s.add(w.draussen);
  return w;
}
export function kellerUpdate(w, t, { licht = 0, tuer = 0 } = {}) {
  const f = licht > 0 && licht < 1 ? (Math.sin(t * 47) > 0 ? 1 : .15) : 1;
  w.lampen.forEach(l => { l.intensity = 4 * licht * f; }); w.lampenMat.emissiveIntensity = 2 * licht * f;
  w.hinterTuer.rotation.y = -tuer * Math.PI / 180; w.draussen.intensity = tuer > 5 ? 8 : 0;
  w.notLicht.emissiveIntensity = Math.floor(t * 1.5) % 2 ? 1.5 : .4;
}

// ======================================================================= Straße + Supermarkt
// Straße entlang x (z −4..4), Gehwege z 4..8.5 und −8.5..−4 (Höhe 0.12). Supermarkt „FRISCHMARKT“ an der Nordseite:
// Glasfront z = −8, Eingang x −1.2..1.2; innen x −10..10, z −28..−8: Regale x = −7, −3.5, 0, 3.5, 7 (z −24..−13), Gänge x −5.25, −1.75, 1.75, 5.25,
// Kassen x −8.5..−3.4 bei z −10.4, Obststand x 3..6.6 bei z −11, Einkaufswagen x 7..8 bei z −9..−12, Kühlregale hinten (z −27).
export const MARKT = { eingang: [0, -8], kassenZ: -10.4, gaenge: [-5.25, -1.75, 1.75, 5.25], regalX: [-7, -3.5, 0, 3.5, 7], hintenZ: -26 };
export function strasse(s, { nacht = false } = {}) {
  const w = { s };
  s.background = new THREE.Color(nacht ? 0x0b1020 : 0x9fb3c8);
  s.fog = new THREE.Fog(nacht ? 0x141b2b : 0xc4ced9, 40, 320);
  w.hemi = new THREE.HemisphereLight(nacht ? 0x8aa0d8 : 0xe6edf5, 0x3a3f47, nacht ? .5 : 1.3); s.add(w.hemi);
  w.sonne = new THREE.DirectionalLight(nacht ? 0x9fb4ff : 0xfff1dc, nacht ? .4 : 1.6); w.sonne.position.set(-20, 30, 15); w.sonne.castShadow = true; w.sonne.shadow.mapSize.set(2048, 2048);
  Object.assign(w.sonne.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); s.add(w.sonne); s.add(w.sonne.target);
  const asph = mat(0xffffff, { r: .95, map: beton('asphalt', '#3d4249', [30, 2]) }), geh = mat(0xffffff, { r: .9, map: fliese('geh', '#a5a59e', '#8f8f88', [60, 3]) }), weiss = mat(0xf1f3f5), kante = mat(0xadb5bd);
  s.add(bx(-140, 140, -.1, 0, -4, 4, asph)); s.add(bx(-140, 140, -.1, .12, 4, 8.5, geh)); s.add(bx(-140, 140, -.1, .12, -8.5, -4, geh));
  s.add(bx(-140, 140, 0, .14, 3.9, 4.05, kante)); s.add(bx(-140, 140, 0, .14, -4.05, -3.9, kante));
  for (let x = -138; x < 140; x += 6) s.add(bx(x, x + 3, 0, .005, -.08, .08, weiss, false));
  for (let z = -3.6; z <= 3.6; z += .6) s.add(bx(10, 13, 0, .005, z - .2, z + .2, weiss, false));
  for (const x of [-30, -5, 22, 45]) s.add(at(cyl(.3, .3, .02, mat(0x343a40, { m: .5 }), 14), x, .005, 1.8));
  // Wohnblocks mit Läden im Erdgeschoss
  const r = rng(12), laeden = [['BÄCKEREI', '#e9c46a', 0xe9c46a], ['APOTHEKE', '#2a9d8f', 0x2a9d8f], ['KIOSK 24/7', '#e63946', 0xe63946], ['FRISEUR', '#6d597a', 0x6d597a], ['IMBISS', '#f4a261', 0xf4a261], ['HANDY-SHOP', '#457b9d', 0x457b9d]];
  for (let i = 0; i < 14; i++) { const x0 = -130 + i * 20; for (const [z0, z1, seite] of [[8.5, 22, 1], [-40, -8.5, -1]]) { if (seite < 0 && x0 > -16 && x0 < 14) continue;
    const h = 13 + r() * 10, key = 'h' + (i % 5), map = fassadeTex(key, nacht ? .5 : .05, ['#c9b79c', '#a7b5c2', '#d4a373', '#b5a898', '#c2c5aa'][i % 5], { balkon: true }); map.repeat.set(18 / 14, (h - 4) / 26);
    const zf = seite > 0 ? z0 : z1;
    s.add(bx(x0 + 1, x0 + 19, 4, h, z0, z1, new THREE.MeshLambertMaterial({ map })));
    s.add(bx(x0 + 1, x0 + 19, 0, 4, seite > 0 ? z0 + .3 : z0, seite > 0 ? z1 : z1 - .3, mat(0x6c757d)));
    s.add(bx(x0 + .8, x0 + 19.2, h, h + .3, z0 - .1, z1 + .1, mat(0x495057)));
    const [nm, css, col] = laeden[(i + (seite > 0 ? 0 : 3)) % laeden.length];
    const zg = zf + seite * .3;   // Glasfront der Läden (etwas zurückgesetzt)
    s.add(bx(x0 + 3, x0 + 17, .5, 3.0, zg - .02, zg + .02, mat(0x9fc3dd, { transparent: true, opacity: .5 }), false));
    schildBrett(s, nm, x0 + 10, 3.5, zf - seite * .01, seite > 0 ? Math.PI : 0, 6, .7, css, '#ffffff', { leucht: nacht ? .6 : .2 });
    const mk = new THREE.Mesh(new THREE.BoxGeometry(14, .08, 1.6), mat(col, { r: .8 })); mk.position.set(x0 + 10, 3.0, zf - seite * .75); mk.rotation.x = seite * .3; s.add(mk);
    for (let k = 0; k < 7; k++) s.add(bx(x0 + 3.2 + k * 2, x0 + 4.2 + k * 2, 2.55, 2.85, zf - seite * 1.5 - .02, zf - seite * 1.5 + .02, mat(k % 2 ? 0xf1f3f5 : col)));
    for (let y = 7; y < h - 2; y += 3) for (const bxx of [x0 + 4, x0 + 12]) { s.add(bx(bxx, bxx + 3.4, y, y + .15, Math.min(zf, zf - seite * 1.1), Math.max(zf, zf - seite * 1.1), mat(0xadb5bd))); s.add(bx(bxx, bxx + 3.4, y + .15, y + 1.0, zf - seite * 1.08 - .02, zf - seite * 1.08 + .02, mat(0x495057, { transparent: true, opacity: .85 }))); }
  } }
  // Straßenmöbel
  w.lampen = [];
  for (let x = -75; x <= 75; x += 15) for (const z of [4.6, -4.6]) { s.add(at(cyl(.07, .09, 5.5, mat(0x343a40), 8), x, 2.75, z)); s.add(at(box(.08, .08, .9, mat(0x343a40)), x, 5.45, z * .9)); const m = mat(0xfff1c9, { e: 0xffd88a, ei: nacht ? 3 : 0, noCache: true }); s.add(at(box(.5, .14, .28, m), x, 5.4, z * .82)); w.lampen.push(m); }
  w.ampel = [];
  for (const [x, z] of [[9.5, 4.4], [13.5, -4.4]]) { s.add(at(cyl(.06, .06, 3, mat(0x343a40), 8), x, 1.5, z)); s.add(at(box(.3, .8, .25, mat(0x212529)), x, 3.2, z)); s.add(at(box(.2, .3, .15, mat(0xffd60a)), x, 1.1, z + (z > 0 ? -.1 : .1))); w.ampel.push([0xff2020, 0xffd60a, 0x30ff60].map((c, k) => { const m = mat(c, { e: c, ei: 0, noCache: true }); s.add(at(sph(.09, m, 8, 6), x, 3.45 - k * .25, z + (z > 0 ? -.14 : .14))); return m; })); }
  { const hs = new THREE.Group(); hs.position.set(-14, .12, 6.6); s.add(hs); hs.add(at(box(3.2, .08, 1.3, mat(0x495057)), 0, 2.4, 0)); hs.add(at(box(3.0, 2.2, .04, mat(0x9fc3dd, { transparent: true, opacity: .35 })), 0, 1.2, .6)); hs.add(at(box(2.4, .06, .4, mat(0x6c757d)), 0, .45, .3));
    hs.add(at(cyl(.04, .04, 2.6, mat(0x343a40), 8), 1.9, 1.3, -.4)); hs.add(at(cyl(.3, .3, .04, mat(0xffd60a), 18), 1.9, 2.6, -.4, Math.PI / 2)); hs.add(at(box(1.2, 1.8, .05, mat(0xf1f3f5)), -1.0, 1.2, .62)); }
  for (const x of [-35, -22, 30, 52]) for (const z of [7.6, -7.6]) { const g = new THREE.Group(); g.position.set(x, .12, z); g.rotation.y = z > 0 ? Math.PI : 0; s.add(g); g.add(at(box(1.6, .06, .4, mat(0x8b5a2b)), 0, .45, 0)); g.add(at(box(1.6, .35, .05, mat(0x8b5a2b)), 0, .7, .2)); for (const sx of [-.7, .7]) g.add(at(box(.06, .45, .4, mat(0x343a40)), sx, .22, 0)); }
  for (let x = -65; x <= 65; x += 11) if (Math.abs(x + 5) > 14) for (const z of [6.9, -6.9]) baum(s, x + 5, z, 5.5, .12);
  for (const [x, z] of [[-26, 5.2], [-25, 5.2], [-24, 5.2], [36, -5.2], [37, -5.2]]) fahrrad(s, x, z, Math.PI / 2, [0x9d0208, 0x457b9d, 0x2a9d8f, 0xe9c46a, 0x212529][Math.abs(x) % 5], .12);
  for (let x = -12; x <= 12; x += 1.5) if (Math.abs(x) > 1.6) s.add(at(cyl(.08, .08, .8, mat(0x343a40), 8), x, .52, -4.4));
  s.add(at(cyl(.7, .7, 3, mat(0xf1f3f5), 16), 40, 1.6, 6.5)); s.add(at(cyl(.75, .75, .15, mat(0x2a9d8f), 16), 40, 3.15, 6.5));
  for (const [x, z] of [[-18, 4.7], [18, -4.7], [-40, -4.7], [26, 4.7]]) { s.add(at(cyl(.22, .2, .8, mat(0x495057), 10), x, .52, z)); s.add(at(cyl(.23, .23, .05, mat(0xe9c46a), 10), x, .95, z)); }
  s.add(at(box(.9, 1.3, .4, mat(0x6c757d)), -9, .77, 7.9));
  for (const [x, z, t2] of [[16, 4.6, '50'], [-50, -4.6, 'P']]) { s.add(at(cyl(.04, .04, 2.6, mat(0xadb5bd), 6), x, 1.4, z)); const sc = new THREE.Mesh(new THREE.CircleGeometry(.3, 20), new THREE.MeshLambertMaterial({ map: textTex('vz' + t2, t2, { w: 128, h: 128, farbe: t2 === 'P' ? '#fff' : '#111', grund: t2 === 'P' ? '#1d3557' : '#fff', font: 'bold 70px DejaVu Sans' }) })); sc.position.set(x, 2.5, z + (z > 0 ? -.05 : .05)); sc.rotation.y = z > 0 ? Math.PI : 0; s.add(sc); }
  w.autos = [];
  for (const [x, z, ry, c, typ] of [[-30, 3, 0, 0x457b9d], [-24, 3, 0, 0xf1f3f5, 'transporter'], [-17, 3, 0, 0x6a994e], [22, -3, Math.PI, 0x2b2d42], [29, -3, Math.PI, 0x9d0208], [36, -3, Math.PI, 0xe9c46a], [-40, -3, Math.PI, 0x6a994e], [-47, -3, Math.PI, 0xadb5bd, 'transporter']]) w.autos.push(auto(s, x, z, ry + Math.PI / 2, c, { typ }));
  for (const x of [31, 32.8]) s.add(at(box(.7, 1.1, .7, mat(0x2d6a4f)), x, .67, -7.6));
  // ---- Supermarkt außen
  const fas = mat(0xe9ecef, { r: .8 });
  s.add(bx(-10.4, 10.4, 0, 5.5, -28.4, -28, fas)); s.add(bx(-10.4, -10, 0, 5.5, -28.4, -8, fas)); s.add(bx(10, 10.4, 0, 5.5, -28.4, -26.6, fas)); s.add(bx(10, 10.4, 0, 5.5, -25.4, -8, fas)); s.add(bx(10, 10.4, 2.2, 5.5, -26.6, -25.4, fas)); s.add(bx(-10.4, 10.4, 5.2, 5.5, -28.4, -8, fas));
  w.notTuer = new THREE.Group(); w.notTuer.position.set(10.2, 0, -25.4); s.add(w.notTuer); w.notTuer.add(at(box(.06, 2.15, 1.2, mat(0x5c636b, { m: .5 })), 0, 1.08, -.6)); w.notTuer.add(at(box(.08, .06, .9, mat(0xd62828)), -.07, 1.0, -.6));
  w.draussen = new THREE.PointLight(0xfff1dc, 0, 10, 1.4); w.draussen.position.set(11.5, 1.6, -26); s.add(w.draussen);
  s.add(bx(-10.4, 10.4, 3.2, 5.2, -8.2, -8, fas)); s.add(bx(-10.6, 10.6, 3.1, 3.25, -8.6, -7.9, mat(0x2a9d8f)));
  schildBrett(s, 'FRISCHMARKT', 0, 4.2, -7.98, 0, 8, 1.2, '#2a9d8f', '#ffffff', { leucht: .3 });
  for (const [x, t2, c] of [[-6, 'ANGEBOT -30%', '#e63946'], [6, 'FRISCH & REGIONAL', '#e9c46a']]) schildBrett(s, t2, x, 2.7, -7.96, 0, 3, .6, c, '#ffffff');
  w.glas = mat(0x9fc3dd, { r: .1, transparent: true, opacity: .25 });
  s.add(bx(-10, -1.2, 0, 3.2, -8.15, -8.05, w.glas, false)); s.add(bx(1.2, 10, 0, 3.2, -8.15, -8.05, w.glas, false));
  for (const x of [-10, -6, -1.2, 1.2, 6, 10]) s.add(bx(x - .06, x + .06, 0, 3.2, -8.2, -8.0, mat(0x495057)));
  w.schiebetuer = [bx(-1.2, 0, 0, 3.15, -8.12, -8.08, w.glas, false), bx(0, 1.2, 0, 3.15, -8.12, -8.08, w.glas, false)]; w.schiebetuer.forEach(m => s.add(m));
  // ---- Supermarkt innen
  s.add(bx(-10, 10, -.1, .01, -28, -8, mat(0xffffff, { r: .4, map: fliese('markt', '#e9ecef', '#ced4da', [20, 20]) })));
  s.add(bx(-10, 10, 5.0, 5.2, -28, -8, mat(0x6c757d)));
  w.deckenLicht = mat(0xffffff, { e: 0xffffff, ei: 1.5, noCache: true });
  for (const x of [-8.6, -5.25, -1.75, 1.75, 5.25, 8.6]) for (let z = -26.5; z < -9; z += 3) s.add(bx(x - .2, x + .2, 4.95, 5.0, z, z + 1.8, w.deckenLicht, false));
  w.innenLicht = [-6, 0, 6].map(x => { const l = new THREE.PointLight(0xf8f9fa, 18, 22, 1.2); l.position.set(x, 4.6, -18); s.add(l); return l; });
  const ware = [0xe63946, 0xf1faee, 0x457b9d, 0xe9c46a, 0x2a9d8f, 0xf4a261, 0x6d597a, 0x8ab17d, 0xffd166, 0x9d0208];
  const pakete = [], flaschen = [], dosen = [], preis = [], regale = [];
  const gangNamen = ['NUDELN & REIS', 'KONSERVEN', 'GETRÄNKE', 'SNACKS', 'HYGIENE'];
  MARKT.regalX.forEach((rx, ri) => { const lang = [-24, -13];
    regale.push([rx, 1.05, (lang[0] + lang[1]) / 2, .24, 2.1, lang[1] - lang[0], 0xadb5bd]);
    for (const y of [.12, .55, 1.0, 1.45, 1.9]) { regale.push([rx, y - .015, (lang[0] + lang[1]) / 2, .96, .03, lang[1] - lang[0], 0xdee2e6]); for (const sx of [-1, 1]) regale.push([rx + sx * .48, y - .04, (lang[0] + lang[1]) / 2, .02, .08, lang[1] - lang[0], 0xf1f3f5]); }
    for (const y of [.12, .55, 1.0, 1.45]) for (let z = lang[0] + .15; z < lang[1] - .1; z += .22) for (const sx of [-1, 1]) {
      if (Math.abs(Math.sin(z * 3.1 + y * 5 + rx * 1.7)) < .2) continue;
      const f = ware[Math.floor(Math.abs(Math.sin(z * 7.3 + y * 3 + rx)) * 10)], art = (ri + Math.floor(y * 2)) % 3;
      if (art === 0) pakete.push([rx + sx * .3, y + .15, z, .18, .3, .16, f]);
      else if (art === 1) { for (const dz of [-.05, .05]) flaschen.push([rx + sx * .3, y + .17, z + dz, .08, .34, .08, f]); }
      else { for (const dz of [-.05, .05]) for (const dy of [0, .13]) dosen.push([rx + sx * .3, y + .065 + dy, z + dz, .09, .12, .09, f]); }
      if (Math.abs((z * 10) % 9) < 1.2) preis.push([rx + sx * .49, y - .05, z, .01, .05, .1, 0xffd60a]);
    }
    schildBrett(s, gangNamen[ri], rx, 3.4, lang[1] + .4, 0, 2.2, .4, '#2a9d8f', '#ffffff'); s.add(at(cyl(.005, .005, 1.5, mat(0x343a40), 4), rx - .9, 4.25, lang[1] + .4)); s.add(at(cyl(.005, .005, 1.5, mat(0x343a40), 4), rx + .9, 4.25, lang[1] + .4));
  });
  viele(s, BOX, regale); viele(s, BOX, pakete); viele(s, ZYL, flaschen, { r: .2 }); viele(s, ZYL, dosen, { r: .3 }); viele(s, BOX, preis, { schatten: false });
  s.add(bx(-9.9, 9.9, 0, 2.2, -27.9, -27, mat(0xdee2e6))); s.add(bx(-9.8, 9.8, .3, 2.0, -27.05, -27.0, mat(0xcfe8ff, { e: 0x5a8ac8, ei: .3, transparent: true, opacity: .65 }), false));
  for (let x = -9.8; x < 9.8; x += 1.2) s.add(bx(x - .02, x + .02, .3, 2.0, -27.0, -26.95, mat(0x868e96)));
  { const kuehl = []; for (let x = -9.6; x < 9.6; x += .2) for (const y of [.5, 1.0, 1.5]) if (Math.abs(Math.sin(x * 4 + y)) > .25) kuehl.push([x, y + .1, -27.4, .14, .22, .14, ware[Math.floor(Math.abs(Math.sin(x * 9 + y)) * 10)]]); viele(s, BOX, kuehl); }
  { const kasten = []; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) kasten.push([8.6, .17 + k * .33, -24 + i * .5, .4, .3, .3, [0x2a9d8f, 0xe63946][i % 2]]); viele(s, BOX, kasten); }
  for (const [x, z] of [[-8.8, -18], [8.8, -15]]) { s.add(bx(x - .6, x + .6, 0, .15, z - .5, z + .5, mat(0x8b5a2b))); const L3 = []; for (let k = 0; k < 9; k++) L3.push([x - .4 + (k % 3) * .4, .35 + Math.floor(k / 3) * .38, z, .36, .36, .9, 0xa47148]); viele(s, BOX, L3); }
  { const obst = [], kisten = []; for (let i = 0; i < 8; i++) { const x = 3.3 + (i % 4) * .85, z = -11.4 + Math.floor(i / 4) * .7, f = [0xe63946, 0xf4a261, 0xffd166, 0x8ab17d, 0x6a994e, 0x9d0208, 0xe9c46a, 0x52734d][i];
      kisten.push([x, .55, z, .8, .2, .6, 0x8b5a2b]); for (let k = 0; k < 12; k++) obst.push([x - .3 + (k % 4) * .2, .72, z - .2 + Math.floor(k / 4) * .2, .17, .17, .17, f]); }
    viele(s, BOX, kisten); viele(s, KUGEL, obst); s.add(bx(3.0, 6.6, 0, .45, -11.8, -10.1, mat(0x6b4426))); schildBrett(s, 'OBST & GEMÜSE', 4.8, 1.6, -10.05, Math.PI, 2.4, .35, '#6a994e'); }
  for (const x of [-8.5, -6.8, -5.1, -3.4]) { s.add(bx(x - .3, x + .3, 0, .95, -11.2, -9.6, mat(0x495057))); s.add(bx(x - .32, x + .32, .95, 1.0, -11.25, -9.55, mat(0x212529))); s.add(bx(x - .15, x + .15, 1.0, 1.25, -10.2, -10.0, mat(0x111111)));
    s.add(bx(x - .12, x + .12, 1.25, 1.42, -10.15, -10.05, mat(0x343a40))); s.add(bx(x + .35, x + .9, 0, .7, -11.0, -10.0, mat(0x6c757d)));
    const kg = []; for (let k = 0; k < 8; k++) kg.push([x + .62, .78 + (k % 4) * .12, -10.9 + Math.floor(k / 4) * .4, .45, .08, .3, ware[(k + 3) % 10]]); viele(s, BOX, kg);
    s.add(at(cyl(.02, .02, 1.2, mat(0x343a40), 6), x - .25, 1.6, -9.65)); schildBrett(s, String(Math.round((x + 10) / 1.7)), x - .25, 2.3, -9.64, 0, .3, .3, '#2a9d8f'); }
  w.wagen = [];
  for (let k = 0; k < 6; k++) { const ew = new THREE.Group(); ew.position.set(7.4 + (k % 2) * .75, 0, -9.3 - Math.floor(k / 2) * 1.1); s.add(ew); w.wagen.push(ew);
    const dm = mat(0x868e96, { m: .6, r: .3 }); for (const sx of [-.27, .27]) ew.add(at(box(.02, .45, .8, dm), sx, .7, 0)); ew.add(at(box(.56, .02, .8, dm), 0, .47, 0)); ew.add(at(box(.56, .45, .02, dm), 0, .7, -.4)); ew.add(at(box(.5, .4, .02, dm), 0, .7, .38));
    ew.add(at(cyl(.02, .02, .6, mat(0xe63946), 6), 0, .98, .5, 0, 0, Math.PI / 2)); for (const [a, b2] of [[-.22, -.35], [.22, -.35], [-.22, .35], [.22, .35]]) ew.add(at(cyl(.05, .05, .04, mat(0x111111), 8), a, .05, b2, 0, 0, Math.PI / 2)); }
  for (let k = 0; k < 5; k++) s.add(at(box(.45, .22, .32, mat(0xe63946)), -9.4, .11 + k * .07, -8.8));
  for (const x of [-1.5, 1.5]) s.add(bx(x - .05, x + .05, 0, 1.5, -9.0, -8.6, mat(0xced4da)));
  schildBrett(s, 'NOTAUSGANG', 9.95, 2.5, -26, -Math.PI / 2, 1.2, .3, '#2d6a4f', '#ffffff', { leucht: 1 });
  w.nacht = nacht; return w;
}
export function strasseUpdate(w, t, { licht = 1, ampel = 1, notTuer = 0 } = {}) {
  w.notTuer.rotation.y = notTuer * Math.PI / 180; w.draussen.intensity = notTuer > 5 ? 10 : 0;
  w.hemi.intensity = (w.nacht ? .5 : 1.3) * (.45 + .55 * licht);
  w.lampen.forEach(m => { m.emissiveIntensity = w.nacht ? 3 * licht : 0; });
  w.innenLicht.forEach(l => { l.intensity = 18 * licht; }); w.deckenLicht.emissiveIntensity = 1.5 * licht;
  const phase = (t * .2) % 1; w.ampel.forEach(fs => fs.forEach((m, k) => { m.emissiveIntensity = ampel ? ((k === 0 && phase < .45) || (k === 1 && phase >= .45 && phase < .55) || (k === 2 && phase >= .55) ? 4 : 0) : (k === 1 && Math.floor(t * 2) % 2 ? 4 : 0); }));
}
