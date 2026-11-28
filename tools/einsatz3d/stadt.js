// Kulissen für Alltags-/Krisenserien (z. B. BLACKOUT): Wohnung im 4. Stock mit Stadtblick + Treppenhaus,
// Straße mit Wohnblocks + Supermarkt (innen). Licht kann ausfallen (Stromausfall), Stadt geht Block für Block aus.
// Koordinaten (Meter): Boden der jeweiligen Welt y = 0.
import { THREE, mat, box, cyl, sph, at, canvasTex, textTex, radialTex, rng, clamp, lerp } from './kern.js';

const sm = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const bx = (x0, x1, y0, y1, z0, z1, m, s = true) => at(box(x1 - x0, y1 - y0, z1 - z0, m, s), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

// Fassade mit Fenstern (Licht an/aus über emissive-Stärke des Materials)
const fassadeTex = (key, hell, farbe) => canvasTex('stf' + key, 256, 512, (g, w, h) => {
  const r = rng(key.length * 11 + 7); g.fillStyle = farbe; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = r() < hell ? `rgb(${240 + r() * 15},${200 + r() * 40},${120 + r() * 50})` : '#1c2533';
    g.fillRect(x * 64 + 14, y * 42 + 8, 36, 26);
  }
});
const fensterMaske = key => canvasTex('stm' + key, 256, 512, (g, w, h) => {
  const r = rng(key.length * 11 + 7); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 4; x++) { const an = r() < .55; g.fillStyle = an ? '#ffd9a0' : '#000'; g.fillRect(x * 64 + 14, y * 42 + 8, 36, 26); }
});
const tapete = canvasTex('tapete', 256, 256, (g, w, h) => { g.fillStyle = '#d8cbb5'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(160,140,110,.25)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, h); }, [3, 1]);
const parkett = canvasTex('parkett', 256, 256, (g, w, h) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#9c6b3f' : '#8a5c35'; g.fillRect(x * 128 + (y % 2) * 64, y * 32, 128, 32); g.fillStyle = '#5c3a20'; g.fillRect(x * 128 + (y % 2) * 64, y * 32, 2, 32); g.fillRect(0, y * 32, w, 2); }
}, [3, 3]);
const fliese = canvasTex('fliese', 128, 128, (g, w, h) => { g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, w, h); g.fillStyle = '#a8a296'; g.fillRect(0, 62, w, 4); g.fillRect(62, 0, 4, h); }, [8, 8]);

// Stadt-Silhouette (Blocks mit Fenstern), in Gruppen nach Abstand → Stromausfall als Welle
function skyline(s, mitte, { n = 150, rMin = 40, rMax = 420, boden = -14, seed = 3 } = {}) {
  const r = rng(seed), gruppen = Array.from({ length: 8 }, (_, k) => ({ mats: [], k }));
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rad = rMin + r() * (rMax - rMin); const x = mitte.x + Math.cos(a) * rad, z = mitte.z + Math.sin(a) * rad;
    if (z > mitte.z + 22) continue;   // nur vor dem Haus (nichts steht im eigenen Wohnblock)
    const h = 12 + r() * (rad > 200 ? 70 : 35), w = 10 + r() * 16, key = 'b' + (i % 7);
    const farbe = ['#4a5361', '#5d6673', '#6b5d55', '#55606e'][i % 4];
    const map = fassadeTex(key, .5, farbe); map.repeat.set(w / 14, h / 26);
    const em = fensterMaske(key); em.repeat.copy(map.repeat);
    const m = new THREE.MeshLambertMaterial({ map, emissive: 0xffd9a0, emissiveMap: em, emissiveIntensity: 1 });
    const g = gruppen[Math.min(7, Math.floor((rad - rMin) / (rMax - rMin) * 8))]; g.mats.push(m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * (.6 + r() * .6)), m); b.position.set(x, boden + h / 2, z); s.add(b);
    if (r() < .25) { const rot = new THREE.Mesh(new THREE.SphereGeometry(.4, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2030 })); rot.position.set(x, boden + h + .5, z); s.add(rot); g.mats.push(rot.material); }
  }
  return gruppen;
}
// Stadt geht aus: k = 0 (alles an) … 1 (alles aus), Welle von innen nach außen, kurzes Flackern
function stadtLicht(gruppen, k, t) {
  gruppen.forEach((g, i) => { const aus = sm(i / 8, i / 8 + .15, k), flacker = aus > 0 && aus < 1 ? (Math.sin(t * 60 + i) > 0 ? 1 : .2) : 1;
    for (const m of g.mats) { if (m.isMeshBasicMaterial) { m.color.setScalar(1 - aus); m.color.r = 1 - aus * .9; } else m.emissiveIntensity = (1 - aus) * flacker; } });
}

// Personenauto (einfach, aber mit Lichtern)
export function auto(s, x, z, ry, farbe = 0x9d0208, { licht = false } = {}) {
  const a = new THREE.Group(); a.position.set(x, 0, z); a.rotation.y = ry;
  const lack = mat(farbe, { r: .35, m: .3 }), glas = mat(0x1a2533, { r: .1, m: .5 });
  a.add(at(box(1.8, .62, 4.3, lack), 0, .6, 0)); a.add(at(box(1.62, .5, 2.2, glas), 0, 1.15, .1)); a.add(at(box(1.56, .06, 2.0, lack), 0, 1.42, .1));
  for (const sx of [-.82, .82]) for (const zz of [-1.35, 1.35]) a.add(at(cyl(.33, .33, .22, mat(0x111111), 14), sx, .33, zz, 0, 0, Math.PI / 2));
  a.vorne = []; for (const sx of [-.55, .55]) { const m = mat(0xfff6e0, { e: 0xfff1d6, ei: licht ? 3 : 0, noCache: true }); a.add(at(box(.3, .12, .05, m), sx, .68, -2.16)); a.vorne.push(m); }
  for (const sx of [-.6, .6]) a.add(at(box(.3, .1, .05, mat(0x9d0208, { e: 0x9d0208, ei: .6 })), sx, .7, 2.16));
  a.add(at(box(.5, .14, .02, mat(0xf1f3f5)), 0, .45, -2.16));
  s.add(a); return a;
}

// ======================================================================= Wohnblock: Wohnung (4. Stock) + Treppenhaus
// Wohnung: x −3..3, z −3..2.5, Höhe 2.6. Balkontür/Fenster in der Wand z = −3, Wohnungstür in z = 2.5 bei x −0.9.
// Treppenhaus dahinter: z 2.7..6.5. Nachbartür in der Wand z = 6.5 bei x 1.2, Treppe nach unten bei x −2.6..−1.4.
export const WOHNUNG = { tisch: [-1.0, -.4], tuer: [-.9, 2.5], fenster: [-.7, -3], sofa: [1.15, .55], nachbartuer: [1.2, 6.5], kuehlschrank: [-2.62, 1.75] };
export function wohnblock(s) {
  const w = { s };
  s.background = new THREE.Color(0x0b1020);
  s.fog = new THREE.Fog(0x141b2b, 40, 700);
  w.hemi = new THREE.HemisphereLight(0x8aa0d8, 0x1a1a22, .55); s.add(w.hemi);
  w.mond = new THREE.DirectionalLight(0x9fb4ff, .5); w.mond.position.set(-20, 30, -40); s.add(w.mond);
  const wandM = mat(0xffffff, { r: .9, map: tapete }), weiss = mat(0xeae6df, { r: .9 }), holz = mat(0x8c5a32, { r: .7 }), dunkelHolz = mat(0x5c3a20, { r: .8 });
  // Boden, Decke, Wände
  s.add(bx(-3, 3, -.1, 0, -3, 2.5, mat(0xffffff, { r: .7, map: parkett })));
  s.add(bx(-3, 3, 2.6, 2.7, -3, 2.5, weiss));
  s.add(bx(-3.2, -3, 0, 2.6, -3, 2.5, wandM)); s.add(bx(3, 3.2, 0, 2.6, -3, 2.5, wandM));
  // Fensterwand mit großer Balkontür (x −2.2..0.8) – Öffnung unten bis 0
  s.add(bx(-3.2, -2.2, 0, 2.6, -3.2, -3, wandM)); s.add(bx(.8, 3.2, 0, 2.6, -3.2, -3, wandM)); s.add(bx(-2.2, .8, 2.3, 2.6, -3.2, -3, wandM));
  const rahmen = mat(0xf1f3f5, { r: .5 });
  for (const x of [-2.2, -.7, .8]) s.add(bx(x - .04, x + .04, 0, 2.3, -3.15, -3.05, rahmen)); s.add(bx(-2.2, .8, 2.26, 2.3, -3.15, -3.05, rahmen));
  w.glas = mat(0x9fc3dd, { r: .1, transparent: true, opacity: .18 }); s.add(bx(-2.2, .8, 0, 2.26, -3.11, -3.09, w.glas, false));
  for (const sx of [-2.0, .6]) s.add(bx(sx - .25, sx + .25, .1, 2.3, -2.95, -2.9, mat(0x6d597a, { r: .9 })));   // Vorhänge
  // Rückwand mit Wohnungstür (x −1.4..−0.4)
  s.add(bx(-3.2, -1.4, 0, 2.6, 2.5, 2.7, wandM)); s.add(bx(-.4, 3.2, 0, 2.6, 2.5, 2.7, wandM)); s.add(bx(-1.4, -.4, 2.1, 2.6, 2.5, 2.7, wandM));
  w.tuer = new THREE.Group(); w.tuer.position.set(-1.4, 0, 2.6); s.add(w.tuer);   // Scharnier links
  w.tuer.add(at(box(.98, 2.08, .06, mat(0xe9ecef, { r: .5 })), .5, 1.04, 0)); w.tuer.add(at(sph(.03, mat(0xadb5bd, { m: .8 })), .88, 1.0, -.05)); w.tuer.add(at(cyl(.012, .012, .04, mat(0x111111), 8), .5, 1.55, -.04, Math.PI / 2));
  s.add(bx(-1.46, -1.4, 0, 2.12, 2.48, 2.72, rahmen)); s.add(bx(-.4, -.34, 0, 2.12, 2.48, 2.72, rahmen)); s.add(bx(-1.46, -.34, 2.08, 2.14, 2.48, 2.72, rahmen));
  // Küche (links): Zeile, Herd, Spüle, Hängeschränke, Kühlschrank
  s.add(bx(-3, -2.4, 0, .9, -2.6, 1.1, mat(0x343a40, { r: .5 }))); s.add(bx(-3, -2.35, .9, .94, -2.65, 1.15, mat(0xadb5bd, { r: .3 })));
  for (let z = -2.4; z < 1.0; z += .6) s.add(bx(-2.41, -2.39, .1, .8, z + .02, z + .56, mat(0x495057)));
  for (const [x, z] of [[-2.7, -1.6], [-2.7, -1.2]]) s.add(at(cyl(.1, .1, .01, mat(0x111111), 14), x, .95, z));
  s.add(bx(-3, -2.65, 1.5, 2.2, -2.6, 1.1, mat(0xf1f3f5, { r: .5 })));
  w.kuehl = new THREE.Group(); s.add(w.kuehl); w.kuehl.add(bx(-3, -2.25, 0, 1.85, 1.35, 2.15, mat(0xdee2e6, { r: .3, m: .2 }))); w.kuehl.add(bx(-2.27, -2.24, .9, 1.3, 1.45, 1.5, mat(0x868e96)));
  for (let k = 0; k < 4; k++) s.add(at(cyl(.06, .05, .16, mat([0xe63946, 0x457b9d, 0xf1faee, 0xe9c46a][k]), 10), -2.75, 1.0, -.4 + k * .3));
  // Esstisch + Stühle, Teller, Kerzen (für später)
  const [tx, tz] = WOHNUNG.tisch;
  s.add(bx(tx - .7, tx + .7, .72, .76, tz - .45, tz + .45, holz)); for (const [x, z] of [[-.62, -.38], [.62, -.38], [-.62, .38], [.62, .38]]) s.add(at(box(.05, .72, .05, dunkelHolz), tx + x, .36, tz + z));
  w.stuehle = [];
  for (const [x, z, ry] of [[tx, tz - .75, 0], [tx, tz + .75, Math.PI], [tx + 1.0, tz, -Math.PI / 2]]) { const st = new THREE.Group(); st.position.set(x, 0, z); st.rotation.y = ry; s.add(st);
    st.add(at(box(.42, .04, .42, holz), 0, .45, 0)); for (const [a, b2] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) st.add(at(box(.035, .45, .035, dunkelHolz), a, .225, b2)); st.add(at(box(.42, .42, .03, holz), 0, .7, -.2)); w.stuehle.push(st); }
  for (const [x, z] of [[0, -.25], [0, .25], [.45, 0]]) { s.add(at(cyl(.12, .12, .01, mat(0xf8f9fa), 18), tx + x, .77, tz + z)); s.add(at(cyl(.08, .08, .012, mat(0xd68c45), 14), tx + x, .78, tz + z)); }
  w.kerzen = []; for (const x of [-.25, .2]) { s.add(at(cyl(.02, .02, .16, mat(0xfefae0), 8), tx + x, .84, tz)); const f = new THREE.Mesh(new THREE.SphereGeometry(.015, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffb347 })); f.position.set(tx + x, .94, tz); f.visible = false; s.add(f); w.kerzen.push(f); }
  w.kerzenLicht = new THREE.PointLight(0xffa64d, 0, 5, 1.6); w.kerzenLicht.position.set(tx, 1.0, tz); s.add(w.kerzenLicht);
  // Sofa + Couchtisch + Fernseher + Stehlampe + Regal + Pflanze
  const [sx0, sz0] = WOHNUNG.sofa, stoff = mat(0x3d5a80, { r: .95 });
  s.add(bx(sx0 - .45, sx0 + .45, 0, .45, sz0 - 1.0, sz0 + 1.0, stoff)); s.add(bx(sx0 - .45, sx0 - .2, .45, .9, sz0 - 1.0, sz0 + 1.0, stoff));
  for (const zz of [-1.0, 1.0]) s.add(bx(sx0 - .45, sx0 + .45, .45, .62, sz0 + zz - .12, sz0 + zz + .12, stoff));
  s.add(bx(1.9, 2.5, 0, .4, sz0 - .4, sz0 + .4, holz));
  s.add(bx(2.9, 3.0, .5, 2.0, -.6, .9, mat(0x5c3a20))); s.add(bx(2.75, 2.97, .9, 1.65, -.45, .75, mat(0x111111)));
  w.tv = mat(0x223355, { e: 0x5a8ac8, ei: 1.4, noCache: true }); s.add(bx(2.74, 2.745, .95, 1.6, -.4, .7, w.tv, false));
  s.add(at(cyl(.02, .02, 1.6, mat(0x343a40), 8), 2.6, .8, 2.1)); s.add(at(cyl(.18, .12, .25, mat(0xf1e3c8, { e: 0xffd9a0, ei: .8 }), 14), 2.6, 1.65, 2.1));
  s.add(bx(1.4, 2.6, 0, 2.0, 2.2, 2.5, dunkelHolz)); for (const y of [.5, 1.0, 1.5]) s.add(bx(1.42, 2.58, y, y + .03, 2.22, 2.48, holz));
  { const r2 = rng(5); for (const y of [.53, 1.03]) for (let k = 0; k < 10; k++) s.add(at(box(.08, .3, .2, mat([0x9d0208, 0x1d3557, 0x2a9d8f, 0xe9c46a][k % 4])), 1.5 + k * .1, y + .15, 2.35)); }
  s.add(at(cyl(.18, .14, .35, mat(0xbc6c25), 12), -2.6, .18, -2.6)); s.add(at(sph(.35, mat(0x2d6a4f, { r: 1 }), 10, 8), -2.6, .7, -2.6));
  s.add(bx(-2.0, .2, .005, .015, -2.2, -.9, mat(0xb56576, { r: 1 }), false));   // Teppich
  // Raumlicht (fällt beim Blackout aus)
  w.lampen = [new THREE.PointLight(0xffe2b8, 9, 9, 1.5), new THREE.PointLight(0xffd9a0, 4, 6, 1.5)];
  w.lampen[0].position.set(tx, 2.2, tz); w.lampen[1].position.set(2.6, 1.7, 2.0); w.lampen.forEach(l => s.add(l));
  w.lampenMat = mat(0xfff1c9, { e: 0xffd88a, ei: 2.2, noCache: true }); s.add(at(cyl(.25, .3, .2, mat(0x343a40), 16, false), tx, 2.45, tz)); s.add(at(sph(.1, w.lampenMat, 10, 8, false), tx, 2.33, tz));
  w.tvLicht = new THREE.PointLight(0x5a8ac8, 2.5, 5, 1.6); w.tvLicht.position.set(2.4, 1.3, .2); s.add(w.tvLicht);
  // Balkon + Geländer
  s.add(bx(-2.4, 1.0, -.15, 0, -4.4, -3.2, mat(0x868e96)));
  s.add(bx(-2.4, 1.0, .95, 1.02, -4.42, -4.35, mat(0x495057))); for (let x = -2.35; x <= 1.0; x += .15) s.add(bx(x, x + .02, 0, .95, -4.4, -4.37, mat(0x495057)));
  for (const x of [-2.4, .98]) s.add(bx(x, x + .03, 0, 1.0, -4.4, -3.2, mat(0x495057)));
  // Haus von außen (Fassade unter/über der Wohnung) + Straße unten mit Autos und Laternen
  s.add(bx(-14, 14, -14, -.1, -3.6, 12, mat(0x6c757d)));   s.add(bx(-14, 14, 2.7, 9, -3.6, 12, mat(0x6c757d)));
  s.add(bx(-16, 16, -14.2, -14, -40, 20, mat(0x343a40)));   // Straße
  w.autos = [auto(s, -6, -16, Math.PI / 2, 0x457b9d, { licht: true }), auto(s, 8, -19, -Math.PI / 2, 0xe9c46a, { licht: true })]; w.autos.forEach(a => { a.position.y = -14; });
  w.strassenLampen = [];
  for (const x of [-12, 0, 12]) { s.add(at(cyl(.08, .1, 6, mat(0x343a40), 8), x, -11, -12)); const m = mat(0xfff1c9, { e: 0xffd88a, ei: 3, noCache: true }); s.add(at(box(.6, .15, .3, m), x, -8, -12.4)); w.strassenLampen.push(m); }
  w.gruppen = skyline(s, new THREE.Vector3(0, 0, -40), { boden: -14 });
  // Treppenhaus (z 2.7..6.5): Podest, Nachbartür, Treppe runter, Fenster, Licht-Schalter, Briefkästen
  const treppenWand = mat(0xc9c2b3, { r: .9 }), stein = mat(0xffffff, { r: .7, map: fliese });
  s.add(bx(-1.6, 3.2, -.1, 0, 2.7, 6.5, stein)); s.add(bx(-3.2, -1.6, -.1, 0, 2.7, 3.4, stein)); s.add(bx(-3.2, 3.2, 2.6, 2.7, 2.7, 6.5, mat(0xe9ecef)));
  s.add(bx(-3.2, 0, 0, 2.6, 6.5, 6.7, treppenWand)); s.add(bx(2.2, 3.2, 0, 2.6, 6.5, 6.7, treppenWand)); s.add(bx(0, 2.2, 2.1, 2.6, 6.5, 6.7, treppenWand));
  w.nachbarTuer = new THREE.Group(); w.nachbarTuer.position.set(2.2, 0, 6.55); s.add(w.nachbarTuer);
  w.nachbarTuer.add(at(box(2.18, 2.08, .06, mat(0x7a4e2d, { r: .6 })), -1.1, 1.04, 0)); w.nachbarTuer.add(at(sph(.03, mat(0xadb5bd, { m: .8 })), -1.9, 1.0, -.05));
  s.add(bx(3, 3.2, 0, 2.6, 2.7, 6.5, treppenWand));
  // Treppe runter (links)
  for (let k = 0; k < 11; k++) s.add(bx(-3.0, -1.6, -(k + 2) * .18, -(k + 1) * .18, 3.4 + k * .28, 3.4 + (k + 1) * .28, stein));   // Treppe nach unten
  { const gm = mat(0x495057, { m: .5 }); for (let k = 0; k <= 10; k++) { const z = 3.45 + k * .28, y0 = -(k + 1) * .18; s.add(bx(-1.63, -1.6, y0, y0 + .95, z - .015, z + .015, gm)); }   // Geländer: Stäbe + schräger Handlauf
    const hl = box(.05, .05, Math.hypot(2.8, 1.8), mat(0x6b4426)); hl.position.set(-1.615, -.95 + .95, 4.85); hl.rotation.x = Math.atan2(1.8, 2.8); s.add(hl); }
  s.add(bx(-3.2, -3.0, 0, 2.6, 2.7, 6.5, treppenWand));
  w.treppenLicht = new THREE.PointLight(0xfff1dc, 5, 8, 1.5); w.treppenLicht.position.set(0, 2.3, 4.6); s.add(w.treppenLicht);
  w.treppenLampe = mat(0xfff1c9, { e: 0xffd88a, ei: 2, noCache: true }); s.add(at(sph(.15, w.treppenLampe, 10, 8, false), 0, 2.5, 4.6));
  w.notLicht = mat(0x2d6a4f, { e: 0x2dff6a, ei: 1.5, noCache: true }); s.add(bx(-.3, .3, 2.3, 2.45, 6.48, 6.5, w.notLicht, false));
  for (let k = 0; k < 6; k++) s.add(bx(1.0 + (k % 3) * .35, 1.32 + (k % 3) * .35, 1.2 + Math.floor(k / 3) * .3, 1.46 + Math.floor(k / 3) * .3, 2.72, 2.78, mat(0x868e96, { m: .5 })));
  s.add(bx(2.3, 2.38, 1.2, 1.32, 2.72, 2.76, mat(0xf1f3f5)));
  // Fußmatte
  s.add(bx(-1.35, -.45, .002, .012, 2.75, 3.3, mat(0x6b4426, { r: 1 }), false));
  w.lichtAn = 1; return w;
}
// Licht in der Wohnung/im Treppenhaus/Straße (1 = an, 0 = aus), Stadt (0 = an … 1 = aus)
export function wohnblockUpdate(w, t, { licht = 1, stadt = 0, kerzen = 0, treppe = null, tv = null } = {}) {
  const flacker = licht > 0 && licht < 1 ? (Math.sin(t * 47) > 0 ? 1 : .15) : 1, l = licht * flacker;
  w.lampen[0].intensity = 9 * l; w.lampen[1].intensity = 4 * l; w.lampenMat.emissiveIntensity = 2.2 * l;
  const tvk = tv ?? l; w.tv.emissiveIntensity = 1.4 * tvk; w.tvLicht.intensity = 2.5 * tvk * (.8 + .2 * Math.sin(t * 9));
  const tl = treppe ?? l; w.treppenLicht.intensity = 5 * tl; w.treppenLampe.emissiveIntensity = 2 * tl;
  w.notLicht.emissiveIntensity = 1.5;
  w.strassenLampen.forEach(m => { m.emissiveIntensity = 3 * (1 - stadt); });
  w.autos.forEach((a, i) => { a.position.x = (i ? 30 : -30) + ((t * (i ? -6 : 7) % 60) + 60) % 60 * (i ? -1 : 1); a.vorne.forEach(m => { m.emissiveIntensity = 3; }); });
  stadtLicht(w.gruppen, stadt, t);
  w.kerzen.forEach(f => { f.visible = kerzen > 0; f.scale.setScalar(1 + .2 * Math.sin(t * 13)); });
  w.kerzenLicht.intensity = 3.5 * kerzen * (.85 + .15 * Math.sin(t * 11));
  w.hemi.intensity = .25 + .3 * l + .1 * kerzen;
}

// ======================================================================= Straße + Supermarkt
// Straße entlang x (z −4..4), Gehweg z 4..8 und −8..−4, Wohnblocks dahinter. Supermarkt „FRISCHMARKT“ an der Nordseite:
// Glasfront bei z = −8, Eingang x −1..1; innen x −10..10, z −28..−8: Regalgänge (x = −7, −3.5, 0, 3.5, 7), Kassen bei z −10.
export const MARKT = { eingang: [0, -8], kassenZ: -10.5, gaenge: [-5.25, -1.75, 1.75, 5.25], regalX: [-7, -3.5, 0, 3.5, 7], hintenZ: -26 };
export function strasse(s, { nacht = false } = {}) {
  const w = { s };
  s.background = new THREE.Color(nacht ? 0x0b1020 : 0x9fb3c8);
  s.fog = new THREE.Fog(nacht ? 0x141b2b : 0xb8c4d0, 30, 260);
  w.hemi = new THREE.HemisphereLight(nacht ? 0x8aa0d8 : 0xe6edf5, 0x3a3f47, nacht ? .5 : 1.3); s.add(w.hemi);
  w.sonne = new THREE.DirectionalLight(nacht ? 0x9fb4ff : 0xfff1dc, nacht ? .4 : 1.6); w.sonne.position.set(-20, 30, 15); w.sonne.castShadow = true; w.sonne.shadow.mapSize.set(2048, 2048);
  Object.assign(w.sonne.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); s.add(w.sonne); s.add(w.sonne.target);
  const asph = mat(0x3a3f47, { r: .95 }), geh = mat(0x9a9a93, { r: .9 }), weiss = mat(0xf1f3f5);
  s.add(bx(-120, 120, -.1, 0, -4, 4, asph)); s.add(bx(-120, 120, -.1, .12, 4, 8, geh)); s.add(bx(-120, 120, -.1, .12, -8, -4, geh));
  for (let x = -118; x < 120; x += 6) s.add(bx(x, x + 3, 0, .005, -.08, .08, weiss, false));
  for (let z = -3.6; z <= 3.6; z += .6) s.add(bx(10, 13, 0, .005, z - .2, z + .2, weiss, false));   // Zebrastreifen
  // Wohnblocks Südseite + Nordseite (außer Supermarkt)
  const r = rng(12);
  for (let i = 0; i < 12; i++) { const x0 = -110 + i * 20; for (const [z0, z1] of [[8.5, 22], [-40, -8.5]]) { if (z0 < 0 && x0 > -16 && x0 < 14) continue;
    const h = 12 + r() * 10, key = 'h' + (i % 5), map = fassadeTex(key, nacht ? .5 : .05, ['#c9b79c', '#a7b5c2', '#d4a373', '#b5a898'][i % 4]); map.repeat.set(18 / 14, h / 26);
    s.add(bx(x0 + 1, x0 + 19, 0, h, z0, z1, new THREE.MeshLambertMaterial({ map }))); } }
  // Laternen, Ampel, Bushaltestelle, Bäume, geparkte Autos, Mülltonnen
  w.lampen = [];
  for (let x = -60; x <= 60; x += 15) for (const z of [4.6, -4.6]) { s.add(at(cyl(.07, .09, 5.5, mat(0x343a40), 8), x, 2.75, z)); const m = mat(0xfff1c9, { e: 0xffd88a, ei: nacht ? 3 : 0, noCache: true }); s.add(at(box(.5, .14, .28, m), x, 5.5, z * .9)); w.lampen.push(m); }
  w.ampel = [];
  for (const [x, z] of [[9.5, 4.4], [13.5, -4.4]]) { s.add(at(cyl(.06, .06, 3, mat(0x343a40), 8), x, 1.5, z)); s.add(at(box(.3, .8, .25, mat(0x212529)), x, 3.2, z)); const fs = [0xff2020, 0xffd60a, 0x30ff60].map((c, k) => { const m = mat(c, { e: c, ei: 0, noCache: true }); s.add(at(sph(.09, m, 8, 6), x, 3.45 - k * .25, z + (z > 0 ? -.14 : .14))); return m; }); w.ampel.push(fs); }
  { const hs = new THREE.Group(); hs.position.set(-14, .12, 6.6); s.add(hs); hs.add(at(box(3.2, .08, 1.3, mat(0x495057)), 0, 2.4, 0)); hs.add(at(box(3.0, 2.2, .04, mat(0x9fc3dd, { transparent: true, opacity: .35 })), 0, 1.2, .6)); hs.add(at(box(2.4, .06, .4, mat(0x6c757d)), 0, .45, .3));
    hs.add(at(cyl(.04, .04, 2.6, mat(0x343a40), 8), 1.9, 1.3, -.4)); hs.add(at(cyl(.3, .3, .04, mat(0xffd60a), 18), 1.9, 2.6, -.4, Math.PI / 2)); }
  for (let x = -55; x <= 55; x += 11) if (Math.abs(x) > 12) for (const z of [6.8, -6.8]) { s.add(at(cyl(.12, .18, 2.4, mat(0x5c3a20), 8), x + 5, 1.3, z)); s.add(at(sph(1.3, mat(0x52734d, { r: 1 }), 10, 8), x + 5, 3.2, z)); }
  w.autos = [];
  for (const [x, z, ry, c] of [[-30, 3, 0, 0x457b9d], [-22, 3, 0, 0xf1f3f5], [24, -3, Math.PI, 0x2b2d42], [33, -3, Math.PI, 0x9d0208], [-40, -3, Math.PI, 0x6a994e]]) w.autos.push(auto(s, x, z, ry + Math.PI / 2, c));
  for (const x of [31, 32.8]) { s.add(at(box(.7, 1.1, .7, mat(0x2d6a4f)), x, .67, -7.4)); }
  // Supermarkt: Fassade, Schild, Glasfront, Eingang
  const fas = mat(0xe9ecef, { r: .8 });
  s.add(bx(-10.4, 10.4, 0, 5.5, -28.4, -28, fas)); s.add(bx(-10.4, -10, 0, 5.5, -28.4, -8, fas)); s.add(bx(10, 10.4, 0, 5.5, -28.4, -8, fas)); s.add(bx(-10.4, 10.4, 5.2, 5.5, -28.4, -8, fas));
  s.add(bx(-10.4, 10.4, 3.2, 5.2, -8.2, -8, fas));
  s.add(at(new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, .1), [fas, fas, fas, fas, new THREE.MeshLambertMaterial({ map: textTex('frischmarkt', 'FRISCHMARKT', { w: 1024, h: 160, farbe: '#ffffff', grund: '#2a9d8f', font: 'bold 120px DejaVu Sans' }), emissive: 0xffffff, emissiveIntensity: .25 }), fas]), 0, 4.2, -7.92));
  w.glas = mat(0x9fc3dd, { r: .1, transparent: true, opacity: .25 });
  s.add(bx(-10, -1.2, 0, 3.2, -8.15, -8.05, w.glas, false)); s.add(bx(1.2, 10, 0, 3.2, -8.15, -8.05, w.glas, false));
  for (const x of [-10, -6, -1.2, 1.2, 6, 10]) s.add(bx(x - .06, x + .06, 0, 3.2, -8.2, -8.0, mat(0x495057)));
  w.schiebetuer = [bx(-1.2, 0, 0, 3.15, -8.12, -8.08, w.glas, false), bx(0, 1.2, 0, 3.15, -8.12, -8.08, w.glas, false)]; w.schiebetuer.forEach(m => s.add(m));
  // Innen: Boden, Decke mit Lichtbändern, Regale mit Ware, Kühlregal hinten, Kassen
  s.add(bx(-10, 10, -.1, .01, -28, -8, mat(0xffffff, { r: .4, map: fliese })));
  w.deckenLicht = mat(0xffffff, { e: 0xffffff, ei: 1.5, noCache: true });
  for (const x of [-5.25, -1.75, 1.75, 5.25]) s.add(bx(x - .15, x + .15, 5.1, 5.15, -27, -9, w.deckenLicht, false));
  w.innenLicht = [-6, 0, 6].map(x => { const l = new THREE.PointLight(0xf8f9fa, 18, 22, 1.2); l.position.set(x, 4.6, -18); s.add(l); return l; });
  const ware = [0xe63946, 0xf1faee, 0x457b9d, 0xe9c46a, 0x2a9d8f, 0xf4a261, 0x6d597a, 0x8ab17d];
  w.ware = [];
  for (const rx of MARKT.regalX) { const lang = rx === -7 || rx === 7 ? [-24, -13] : [-24, -13];
    s.add(bx(rx - .12, rx + .12, 0, 2.0, lang[0], lang[1], mat(0xadb5bd, { r: .6 })));                      // Rückwand des Regals
    for (const y of [.05, .5, .95, 1.4, 1.85]) s.add(bx(rx - .45, rx + .45, y - .03, y, lang[0], lang[1], mat(0xdee2e6, { r: .5 })));   // Böden
    for (const y of [.05, .5, .95, 1.4]) for (let z = lang[0] + .2; z < lang[1] - .1; z += .3) for (const sx of [-1, 1]) {
      if (Math.abs(Math.sin(z * 3.1 + y * 5 + rx * 1.7)) < .22) continue;                                                 // leere Lücken (Hamsterkäufe)
      const m = new THREE.Mesh(new THREE.BoxGeometry(.2, .3, .24), mat(ware[Math.floor(Math.abs(Math.sin(z * 7.3 + y * 3 + rx)) * 8)], { r: .6 })); m.position.set(rx + sx * .29, y + .15, z); s.add(m); w.ware.push(m); }
    for (const sx of [-1, 1]) s.add(bx(rx - .46, rx + .46, 1.95, 2.25, lang[1] - .05, lang[1], mat(0x2a9d8f)));   // Gangschild
  }
  s.add(bx(-9.9, 9.9, 0, 2.2, -27.9, -27, mat(0xdee2e6))); s.add(bx(-9.8, 9.8, .3, 2.0, -27.05, -27.0, mat(0xcfe8ff, { e: 0x5a8ac8, ei: .4, transparent: true, opacity: .7 }), false));
  for (const x of [-8.5, -6.8, -5.1, -3.4]) { s.add(bx(x - .3, x + .3, 0, .95, -11.2, -9.6, mat(0x495057))); s.add(bx(x - .32, x + .32, .95, 1.0, -11.25, -9.55, mat(0x212529))); s.add(bx(x - .1, x + .1, 1.0, 1.3, -11.0, -10.9, mat(0x111111)));
    s.add(bx(x + .35, x + .9, 0, .7, -11.0, -10.0, mat(0x6c757d))); }
  for (let k = 0; k < 6; k++) { const ew = new THREE.Group(); ew.position.set(7.2 + (k % 2) * .7, 0, -9.3 - Math.floor(k / 2) * 1.1); s.add(ew);
    ew.add(at(box(.55, .5, .8, mat(0x868e96, { m: .5, r: .4 })), 0, .7, 0)); for (const [a, b2] of [[-.22, -.35], [.22, -.35], [-.22, .35], [.22, .35]]) ew.add(at(cyl(.05, .05, .04, mat(0x111111), 8), a, .05, b2, 0, 0, Math.PI / 2)); }
  w.nacht = nacht; return w;
}
export function strasseUpdate(w, t, { licht = 1, ampel = 1 } = {}) {
  w.hemi.intensity = (w.nacht ? .5 : 1.3) * (.45 + .55 * licht);
  w.lampen.forEach(m => { m.emissiveIntensity = w.nacht ? 3 * licht : 0; });
  w.innenLicht.forEach(l => { l.intensity = 18 * licht; }); w.deckenLicht.emissiveIntensity = 1.5 * licht;
  const phase = (t * .2) % 1; w.ampel.forEach(fs => fs.forEach((m, k) => { m.emissiveIntensity = ampel ? ((k === 0 && phase < .45) || (k === 1 && phase >= .45 && phase < .55) || (k === 2 && phase >= .55) ? 4 : 0) : (k === 1 && Math.floor(t * 2) % 2 ? 4 : 0); }));
}
