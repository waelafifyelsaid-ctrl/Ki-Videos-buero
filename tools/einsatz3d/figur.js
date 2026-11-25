// 3D-Figuren mit Gelenken, Inverser Kinematik (Arme/Beine) und automatischem Bodenkontakt.
// Ruhepose: Figur schaut nach +Z, Knochen zeigen nach -Y. Links = +X.
import { THREE, mat, box, cyl, sph, caps, at, nummerTex, molleTex, textTex, clamp, weltPos } from './kern.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ABW = V(0, -1, 0);

export function setzeWeltRichtung(joint, dirW) {
  const pq = new THREE.Quaternion();
  joint.parent.getWorldQuaternion(pq);
  const qW = new THREE.Quaternion().setFromUnitVectors(ABW, dirW.clone().normalize());
  joint.quaternion.copy(pq.invert().multiply(qW));
  joint.updateMatrixWorld(true);
}

// Zwei-Knochen-IK: j1 (Schulter/Hüfte), j2 (Ellbogen/Knie), j3 (Hand/Knöchel). ziel/pol in Weltkoordinaten.
export function ik(j1, j2, j3, ziel, pol) {
  const S = weltPos(j1), E0 = weltPos(j2), T0 = weltPos(j3);
  const L1 = S.distanceTo(E0), L2 = E0.distanceTo(T0);
  const d = ziel.clone().sub(S);
  let dist = d.length();
  const maxd = (L1 + L2) * 0.999, mind = Math.abs(L1 - L2) * 1.01 + 1e-3;
  if (dist > maxd) { d.multiplyScalar(maxd / dist); dist = maxd; }
  if (dist < mind) { d.multiplyScalar(mind / Math.max(dist, 1e-4)); dist = mind; }
  const dir = d.clone().normalize();
  const A = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
  let n = V().crossVectors(dir, pol.clone().sub(S));
  if (n.lengthSq() < 1e-8) n.set(1, 0, 0);
  n.normalize();
  const oben = dir.clone().applyAxisAngle(n, A);
  setzeWeltRichtung(j1, oben);
  const E = S.clone().add(oben.multiplyScalar(L1));
  setzeWeltRichtung(j2, S.clone().add(d).sub(E));
}

// ---------------------------------------------------------------- Ausrüstung
export function gewehrModell() {
  const g = new THREE.Group();
  const schwarz = mat(0x1d1f22, { r: 0.45, m: 0.4 }), grau = mat(0x34373c, { r: 0.5, m: 0.3 });
  g.add(at(box(0.05, 0.075, 0.34, grau), 0, 0, 0.02));               // Gehäuse
  g.add(at(box(0.055, 0.06, 0.26, schwarz), 0, 0.005, 0.31));        // Handschutz
  g.add(at(cyl(0.011, 0.011, 0.16, schwarz, 10), 0, 0.01, 0.52, Math.PI / 2));   // Lauf
  g.add(at(cyl(0.017, 0.017, 0.05, schwarz, 10), 0, 0.01, 0.61, Math.PI / 2));   // Mündung
  g.add(at(box(0.04, 0.13, 0.06, schwarz), 0, -0.09, 0.07, -0.25));  // Magazin
  g.add(at(box(0.035, 0.09, 0.045, schwarz), 0, -0.07, -0.08, 0.3)); // Griff
  g.add(at(box(0.045, 0.07, 0.2, schwarz), 0, -0.02, -0.26));       // Schaft
  g.add(at(box(0.04, 0.05, 0.09, schwarz), 0, 0.07, 0.05));          // Visier
  const linse = at(cyl(0.016, 0.016, 0.01, mat(0x3a5a80, { r: 0.1, m: 0.6, e: 0x112244, ei: 0.6 }), 12), 0, 0.075, 0.1, Math.PI / 2);
  g.add(linse);
  g.add(at(cyl(0.016, 0.016, 0.09, schwarz, 10), -0.04, -0.005, 0.38, Math.PI / 2));   // Lampe
  g.griff = new THREE.Object3D(); g.griff.position.set(0, -0.08, -0.07); g.add(g.griff);
  g.vorne = new THREE.Object3D(); g.vorne.position.set(-0.01, -0.03, 0.33); g.add(g.vorne);
  g.lampe = new THREE.Object3D(); g.lampe.position.set(-0.04, -0.005, 0.44); g.add(g.lampe);
  return g;
}

export function schildModell() {
  const g = new THREE.Group();
  const s = box(0.55, 0.9, 0.035, mat(0x1b1d21, { r: 0.5, m: 0.3 }));
  g.add(s);
  g.add(at(box(0.32, 0.09, 0.04, mat(0x6d8399, { r: 0.05, m: 0.5, transparent: true, opacity: 0.7 })), 0, 0.3, 0.005));
  const t = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1), new THREE.MeshStandardMaterial({ map: textTex('polizei', 'POLIZEI', { w: 512, h: 128, font: 'bold 90px DejaVu Sans, Arial' }), transparent: true }));
  t.position.set(0, 0.05, 0.02); g.add(t);
  g.griff = new THREE.Object3D(); g.griff.position.set(0.05, 0.0, -0.06); g.add(g.griff);
  return g;
}

export function handschellenModell() {
  const g = new THREE.Group();
  const m = mat(0xc9ced6, { r: 0.25, m: 0.9 });
  g.ringL = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 8, 20), m);
  g.ringR = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 8, 20), m);
  g.kette = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6), m);
  g.add(g.ringL, g.ringR, g.kette);
  return g;
}

// ---------------------------------------------------------------- Figur
export class Figur {
  constructor(o = {}) {
    this.o = o;
    const haut = mat(o.haut ?? 0xd9a77a, { r: 0.6 });
    const team = o.art === 'team';
    const oben = mat(o.jacke ?? (team ? 0x2e3440 : 0x6c757d), { r: 0.85 });
    const unten = mat(o.hose ?? (team ? 0x262a31 : 0x343a40), { r: 0.85 });
    const schuh = mat(o.schuh ?? (team ? 0x16181b : 0xf1f3f5), { r: 0.6 });
    const hand = team || o.handschuhe ? mat(0x17191c, { r: 0.6 }) : haut;
    const j = this.j = {};
    const root = this.root = new THREE.Group();
    const add = (p, name, x, y, z) => { const n = new THREE.Group(); n.name = name; n.position.set(x, y, z); p.add(n); j[name] = n; return n; };
    const hips = add(root, 'hips', 0, 0.98, 0);
    { const b = sph(1, unten, 22, 14); b.scale.set(0.165, 0.11, 0.115); hips.add(at(b, 0, -0.01, 0)); }
    const spine = add(hips, 'spine', 0, 0.06, 0);
    { const bauch = cyl(0.14, 0.15, 0.24, oben, 22); bauch.scale.z = 0.66; spine.add(at(bauch, 0, 0.08, 0)); }
    const chest = add(spine, 'chest', 0, 0.2, 0);
    { const brust = cyl(0.185, 0.145, 0.26, oben, 24); brust.scale.z = 0.64; chest.add(at(brust, 0, 0.07, 0));
      const pec = sph(1, oben, 20, 12); pec.scale.set(0.17, 0.09, 0.115); chest.add(at(pec, 0, 0.13, 0.005));
      const schulter = caps(0.07, 0.3, oben); schulter.rotation.z = Math.PI / 2; schulter.scale.z = 0.95; chest.add(at(schulter, 0, 0.2, -0.01)); }
    if (o.rueckenNr) { const rn = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshStandardMaterial({ map: nummerTex(o.nummer ?? '?', '#e9ecef', '#2e3440'), roughness: 0.9 })); rn.position.set(0, 0.12, -0.122); rn.rotation.y = Math.PI; chest.add(rn); }
    if (team) {
      const weste = mat(o.weste ?? 0x3b3f35, { r: 0.9, map: molleTex('#3b3f35') });
      chest.add(at(box(0.31, 0.32, 0.05, weste), 0, 0.08, 0.115));                 // Frontplatte
      chest.add(at(box(0.31, 0.34, 0.05, weste), 0, 0.09, -0.115));                // Rückenplatte
      { const k = cyl(0.205, 0.205, 0.13, weste, 24, true); k.scale.z = 0.66; chest.add(at(k, 0, -0.02, 0)); }   // Kummerbund
      for (const x of [-0.11, 0.11]) chest.add(at(box(0.05, 0.05, 0.25, weste), x, 0.27, 0));   // Schultergurte
      const tasche = mat(0x34382f, { r: 0.9 });
      for (const x of [-0.1, 0, 0.1]) { chest.add(at(box(0.085, 0.13, 0.05, tasche), x, -0.01, 0.16)); chest.add(at(box(0.085, 0.025, 0.055, mat(0x2b2e26)), x, 0.06, 0.162)); }
      chest.add(at(box(0.07, 0.12, 0.05, tasche), 0.15, 0.13, 0.15));       // Funk
      chest.add(at(box(0.1, 0.09, 0.06, mat(0x6b2b2b, { r: .9 })), -0.17, -0.02, 0.1));   // Sanitätstasche
      chest.add(at(cyl(0.012, 0.012, 0.25, mat(0x111111), 8), -0.05, 0.25, 0.14, 0.4));   // Kabel zum Headset
      chest.add(at(cyl(0.006, 0.006, 0.18, mat(0x111111), 6), 0.17, 0.27, 0.12));  // Antenne
      const nr = new THREE.MeshStandardMaterial({ map: nummerTex(o.nummer ?? '?'), roughness: 0.8 });
      const vorn = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), nr); vorn.position.set(-0.1, 0.16, 0.141); chest.add(vorn);
      const hinten = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), nr); hinten.position.set(0, 0.1, -0.141); hinten.rotation.y = Math.PI; chest.add(hinten);
      hips.add(at(box(0.34, 0.06, 0.24, mat(0x1d1f22)), 0, 0.07, 0));      // Gürtel
    } else if (o.kapuze) {
      chest.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.05, 8, 16, Math.PI), oben), 0, 0.28, -0.07, -0.4, 0, 0));
    }
    if (o.art === 'chefin') chest.add(at(box(0.08, 0.26, 0.012, mat(0xe9ecef)), 0, 0.12, 0.106));
    const neck = add(chest, 'neck', 0, 0.245, 0);
    neck.add(at(cyl(0.05, 0.055, 0.09, team && o.maske ? mat(0x1b1c1f) : haut, 12), 0, 0.03, 0));
    const head = add(neck, 'head', 0, 0.07, 0);
    this.baueKopf(head, haut, o);
    for (const [s, name] of [[1, 'L'], [-1, 'R']]) {
      const sh = add(chest, 'sh' + name, s * 0.2, 0.21, 0);
      sh.add(at(cyl(0.058, 0.046, 0.28, oben, 16), 0, -0.15, 0));
      sh.add(sph(0.066, oben, 16, 12));
      if (team) sh.add(at(box(0.11, 0.07, 0.12, mat(0x3b3f35)), s * 0.01, -0.02, 0));
      const el = add(sh, 'el' + name, 0, -0.3, 0);
      el.add(at(cyl(0.047, 0.036, 0.25, oben, 14), 0, -0.13, 0));
      el.add(sph(0.049, oben, 14, 10));
      el.add(at(cyl(0.039, 0.039, 0.045, team ? mat(0x1b1c1f) : (o.jacke ? oben : hand), 14), 0, -0.25, 0));   // Ärmelbund
      const ha = add(el, 'ha' + name, 0, -0.27, 0);
      { const hf = sph(1, hand, 14, 10); hf.scale.set(0.04, 0.055, 0.021); ha.add(at(hf, 0, -0.05, 0.005)); }
      ha.add(at(box(0.03, 0.06, 0.03, hand), s * 0.04, -0.03, 0.025, 0, 0, s * 0.4));
      // Finger (für Handzeichen)
      this['finger' + name] = [];
      for (let k = 0; k < 4; k++) {
        const f = new THREE.Group(); f.position.set(-0.027 + k * 0.018, -0.088, 0.005);
        f.add(at(caps(0.008, 0.045, hand, false), 0, -0.03, 0)); ha.add(f); this['finger' + name].push(f);
      }
      const hip = add(hips, 'hip' + name, s * 0.1, -0.04, 0);
      hip.add(at(cyl(0.088, 0.062, 0.42, unten, 18), 0, -0.22, 0));
      hip.add(sph(0.09, unten, 16, 12));
      hip.add(at(box(0.06, 0.13, 0.1, mat(new THREE.Color(o.hose ?? (team ? 0x262a31 : 0x343a40)).multiplyScalar(0.85), { r: .9 })), s * 0.075, -0.2, 0.0));   // Beintasche
      if (team && s < 0) hip.add(at(box(0.07, 0.17, 0.1, mat(0x1d1f22)), -0.075, -0.18, 0.02));  // Holster
      const kn = add(hip, 'kn' + name, 0, -0.44, 0);
      kn.add(at(cyl(0.06, 0.043, 0.4, unten, 16), 0, -0.21, 0));
      kn.add(sph(0.064, unten, 14, 10));
      { const wade = sph(1, unten, 12, 10); wade.scale.set(0.05, 0.11, 0.05); kn.add(at(wade, 0, -0.13, -0.018)); }
      if (team) kn.add(at(box(0.1, 0.1, 0.05, mat(0x1d1f22)), 0, -0.03, 0.06));   // Knieschoner
      const an = add(kn, 'an' + name, 0, -0.42, 0);
      an.add(at(box(0.1, 0.11, 0.2, schuh), 0, -0.045, 0.01));
      { const kappe = sph(1, schuh, 14, 10); kappe.scale.set(0.05, 0.05, 0.075); an.add(at(kappe, 0, -0.06, 0.11)); }
      an.add(at(box(0.11, 0.025, 0.28, mat(0x0d0d0f, { r: .9 })), 0, -0.095, 0.05));        // Sohle
      if (team) an.add(at(cyl(0.05, 0.048, 0.08, schuh, 14), 0, 0.03, 0));                  // Stiefelschaft
    }
    // Marker für Bodenkontakt
    const mk = (p, x, y, z, hand = false) => { const m = new THREE.Object3D(); m.position.set(x, y, z); m.istHand = hand; p.add(m); return m; };
    this.marker = [];
    for (const n of ['L', 'R']) {
      this.marker.push(mk(j['an' + n], 0, -0.1, 0.19), mk(j['an' + n], 0, -0.1, -0.09), mk(j['kn' + n], 0, 0, 0.09), mk(j['kn' + n], 0, 0, -0.07));
      this.marker.push(mk(j['ha' + n], 0, -0.1, 0, true), mk(j['el' + n], 0, 0, 0.05, true), mk(j['el' + n], 0, 0, -0.05, true));
    }
    this.marker.push(mk(hips, 0, -0.08, 0.11), mk(hips, 0, -0.08, -0.11), mk(chest, 0, 0.1, 0.15), mk(chest, 0, 0.1, -0.15),
      mk(chest, 0.2, 0.1, 0), mk(chest, -0.2, 0.1, 0), mk(head, 0, 0.27, 0), mk(head, 0, 0.12, 0.14), mk(head, 0, 0.12, -0.14));
    root.scale.setScalar((o.groesse ?? 1.82) / 1.85);
    root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.anbau = {};
  }

  baueKopf(head, haut, o) {
    const team = o.art === 'team';
    const maske = team && o.maske;
    const kopfMat = maske ? mat(0x1b1c1f, { r: 0.95 }) : haut;
    const k = sph(0.108, kopfMat, 28, 20); k.scale.set(0.93, 1.12, 1.02); k.position.y = 0.125; head.add(k);
    { const kiefer = sph(0.08, kopfMat, 20, 14); kiefer.scale.set(1.0, 0.8, 0.95); kiefer.position.set(0, 0.06, 0.025); head.add(kiefer); }
    if (!maske) { for (const s of [1, -1]) head.add(at(sph(0.025, haut, 10, 8), s * 0.112, 0.12, 0)); }
    const gesicht = new THREE.Group(); gesicht.position.set(0, 0.12, 0); head.add(gesicht);
    if (maske) gesicht.add(at(box(0.16, 0.052, 0.03, haut), 0, 0.022, 0.1));
    const weiss = mat(0xf1ede6, { r: 0.25 }), iris = mat(o.augenfarbe ?? 0x3d2b1f, { r: 0.2 });
    this.augen = [];
    for (const s of [1, -1]) {
      const a = sph(0.0145, weiss, 14, 10); a.position.set(s * 0.036, 0.022, 0.093); a.scale.z = 0.7; gesicht.add(a);
      const p = sph(0.0075, iris, 12, 8); p.position.set(s * 0.036, 0.022, 0.103); gesicht.add(p); this.augen.push(p);
      if (!maske) { const lid = sph(0.0155, haut, 12, 8, false); lid.scale.set(1.05, 0.55, 0.75); lid.position.set(s * 0.036, 0.031, 0.094); gesicht.add(lid); }
      const b = box(0.042, 0.009, 0.012, maske ? kopfMat : mat(o.haarfarbe ?? 0x2b2118)); b.position.set(s * 0.04, 0.05, 0.103); b.rotation.z = s * -0.08; gesicht.add(b);
      this['braue' + (s > 0 ? 'L' : 'R')] = b;
    }
    if (!maske) {
      { const nase = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.05, 10), haut); nase.rotation.x = Math.PI / 2 - 0.35; nase.position.set(0, -0.005, 0.118); gesicht.add(nase);
        gesicht.add(at(sph(0.012, haut, 10, 8), 0, -0.02, 0.122)); }
      { const lippe = mat(o.lippen ?? 0xb5686b, { r: .5 }); const ol = sph(1, lippe, 12, 8); ol.scale.set(0.026, 0.006, 0.01); gesicht.add(at(ol, 0, -0.04, 0.106));
        const ul = sph(1, lippe, 12, 8); ul.scale.set(0.022, 0.007, 0.01); gesicht.add(at(ul, 0, -0.06, 0.104)); }
      this.mundMesh = sph(0.02, mat(0x2a0f10, { r: 0.5 }), 12, 8); this.mundMesh.scale.set(1.1, 0.25, 0.5);
      this.mundMesh.position.set(0, -0.05, 0.102); gesicht.add(this.mundMesh);
      if (o.bart) { const bt = sph(0.1, mat(o.bart, { r: 0.95 }), 16, 10, true); bt.scale.set(0.95, 0.6, 0.85); bt.position.set(0, -0.06, 0.03); gesicht.add(bt); }
      if (o.brille) for (const s of [1, -1]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 16), mat(0x111111)); r.position.set(s * 0.04, 0.022, 0.118); gesicht.add(r);
      }
      if (o.sonnenbrille) gesicht.add(at(box(0.14, 0.035, 0.02, mat(0x0b0b0d, { r: 0.1, m: 0.6 })), 0, 0.022, 0.118));
    }
    if (o.helm) {
      const hm = mat(0x2c3036, { r: 0.6, m: 0.1 });
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.138, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), hm);
      helm.position.y = 0.135; helm.castShadow = true; head.add(helm);
      head.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.133, 0.012, 8, 28), hm), 0, 0.133, 0, Math.PI / 2));
      for (const s of [1, -1]) head.add(at(box(0.012, 0.035, 0.12, mat(0x1d1f22)), s * 0.137, 0.17, 0));
      head.add(at(box(0.06, 0.04, 0.03, mat(0x1d1f22)), 0, 0.235, 0.115, -0.5));
      if (o.headset) for (const s of [1, -1]) head.add(at(cyl(0.045, 0.045, 0.04, mat(0x1d1f22), 14), s * 0.12, 0.11, 0, 0, 0, Math.PI / 2));
      if (o.visier) head.add(at(box(0.2, 0.06, 0.04, mat(0x22272e, { r: 0.1, m: 0.5 })), 0, 0.215, 0.1, -0.3));
    } else if (o.kappe) {
      const km = mat(o.kappe, { r: 0.85 });
      head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), km), 0, 0.14, 0));
      head.add(at(box(0.15, 0.012, 0.11, km), 0, 0.15, 0.12, -0.1));
    } else if (o.haare) {
      const hm = mat(o.haarfarbe ?? 0x2b2118, { r: 0.95 });
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.121, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hm);
      h.position.y = 0.135; h.rotation.x = -0.25; head.add(h);
      if (o.dutt) head.add(at(sph(0.05, hm, 12, 10), 0, 0.2, -0.09));
    }
    if (o.zopf) head.add(at(caps(0.03, 0.12, mat(o.zopf)), 0, 0.06, -0.13, 0.3));
  }

  // Pose setzen (Winkel in Radiant). Fehlendes = 0.
  pose(p = {}) {
    const j = this.j;
    for (const n of ['L', 'R']) {
      const s = n === 'L' ? 1 : -1;
      const [sw, kn, ab = 0] = p['bein' + n] ?? [0, 0, 0];
      j['hip' + n].rotation.set(-sw, 0, s * ab);
      j['kn' + n].rotation.set(kn, 0, 0);
      j['an' + n].rotation.set(p['fuss' + n] ?? (sw - kn), 0, 0);
      const [vor, seit = 0, dreh = 0] = p['arm' + n] ?? [0.05, 0.08, 0];
      j['sh' + n].rotation.set(-vor, s * dreh, s * seit);
      j['el' + n].rotation.set(-(p['ell' + n] ?? 0.15), 0, 0);
      j['ha' + n].rotation.set(0, 0, 0);
      this.finger(n, p['finger' + n] ?? 4);
    }
    const [rv, rd = 0, rs = 0] = p.rumpf ?? [0, 0, 0];
    j.spine.rotation.set(rv * 0.5, rd * 0.5, rs * 0.5);
    j.chest.rotation.set(rv * 0.5, rd * 0.5, rs * 0.5);
    const [kn, kd = 0, ks = 0] = p.kopf ?? [0, 0, 0];
    j.head.rotation.set(kn, kd, ks);
    j.hips.position.y = 0.98;
    this.mund(p.mund ?? 0);
    if (p.blick) for (const a of this.augen) { a.position.x = Math.sign(a.position.x) * 0.04 + p.blick[0] * 0.008; a.position.y = 0.022 + p.blick[1] * 0.006; }
  }

  finger(n, anzahl) {
    const fs = this['finger' + n];
    fs.forEach((f, k) => { f.rotation.x = k < anzahl ? 0 : -1.9; f.visible = true; });
  }

  mund(k) {
    if (!this.mundMesh) return;
    this.mundMesh.scale.y = 0.15 + 0.8 * clamp(k);
  }

  // Root setzen, dann so verschieben, dass der tiefste Körperpunkt genau auf boden liegt.
  platziere(x, z, drehung = 0, { boden = 0, ohneHaende = true, kipp = null, hoehe = null } = {}) {
    const r = this.root;
    r.position.set(x, 0, z);
    r.rotation.set(0, drehung, 0);
    if (kipp) { r.rotation.order = 'YXZ'; r.rotation.x = kipp[0]; r.rotation.z = kipp[1] ?? 0; }
    r.updateMatrixWorld(true);
    if (hoehe !== null) { r.position.y = hoehe; r.updateMatrixWorld(true); return; }
    let min = Infinity;
    const v = new THREE.Vector3();
    for (const m of this.marker) {
      if (ohneHaende && m.istHand) continue;
      min = Math.min(min, weltPos(m, v).y);
    }
    r.position.y = boden - min;
    r.updateMatrixWorld(true);
  }

  // Hände per IK an Weltpunkte
  greife(n, ziel, pol) {
    const j = this.j;
    ik(j['sh' + n], j['el' + n], j['ha' + n], ziel, pol);
  }
  bein(n, ziel, pol) {
    const j = this.j;
    ik(j['hip' + n], j['kn' + n], j['an' + n], ziel, pol);
  }
  lokal(x, y, z) { return this.root.localToWorld(new THREE.Vector3(x, y, z)); }

  // Gewehr am Körper (in Brusthöhe), Hände greifen per IK
  haltGewehr(modus = 'tief') {
    if (!this.anbau.gewehr) { this.anbau.gewehr = gewehrModell(); this.j.chest.add(this.anbau.gewehr); }
    const g = this.anbau.gewehr;
    g.visible = true;
    if (modus === 'tief') { g.position.set(-0.06, -0.06, 0.24); g.rotation.set(0.55, 0.15, 0.1); }
    else if (modus === 'anschlag') { g.position.set(-0.08, 0.17, 0.3); g.rotation.set(0.02, 0.02, 0); }
    else if (modus === 'hoch') { g.position.set(-0.05, 0.05, 0.26); g.rotation.set(-0.9, 0.1, 0.1); }
    g.updateMatrixWorld(true);
    const pol = (x, y, z) => this.lokal(x, y, z);
    this.greife('R', weltPos(g.griff), pol(-0.6, 0.6, -0.4));
    this.greife('L', weltPos(g.vorne), pol(0.6, 0.6, -0.2));
  }
  ohneGewehr() { if (this.anbau.gewehr) this.anbau.gewehr.visible = false; }
}

// ---------------------------------------------------------------- Bewegungszyklen
export function gehPose(ph, { hocke = 0, schritt = 0.42, arme = true } = {}) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    beinL: [schritt * s + 0.35 * hocke, 0.15 + 0.6 * Math.max(0, -c) * 0.8 + 0.8 * hocke],
    beinR: [-schritt * s + 0.35 * hocke, 0.15 + 0.6 * Math.max(0, c) * 0.8 + 0.8 * hocke],
    armL: arme ? [-0.35 * s, 0.1] : undefined, armR: arme ? [0.35 * s, 0.1] : undefined,
    ellL: 0.3, ellR: 0.3, rumpf: [0.08 + 0.3 * hocke, 0.06 * s, 0],
  };
}
export function rennPose(ph, { neig = 0.25 } = {}) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    beinL: [0.75 * s, 0.25 + 1.2 * Math.max(0, -c)], beinR: [-0.75 * s, 0.25 + 1.2 * Math.max(0, c)],
    armL: [-0.8 * s, 0.15], armR: [0.8 * s, 0.15], ellL: 1.3, ellR: 1.3, rumpf: [neig, 0.12 * s, 0],
  };
}
export const hockPose = (k = 1) => ({ beinL: [0.9 * k, 1.5 * k], beinR: [0.6 * k, 1.3 * k], rumpf: [0.35 * k, 0, 0] });
export const stehPose = (t = 0) => ({ beinL: [0.02, 0.04], beinR: [-0.02, 0.04], rumpf: [0.02 * Math.sin(t * 1.7), 0, 0], armL: [0.05, 0.1], armR: [0.05, 0.1] });
