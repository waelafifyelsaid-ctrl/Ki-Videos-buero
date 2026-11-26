// Ich-Sicht: Arme, Handschuhe, Gewehr, Tasse, Handschellen – alles an der Kamera befestigt, Hände per IK.
import { THREE, mat, box, cyl, sph, caps, at, clamp, weltPos, nummerTex } from './kern.js';
import { ik, gewehrModell, handschellenModell } from './figur.js';

export class Pov {
  constructor(kamera, { aermel = 0x2e3440, handschuhe = true, haut = 0xe0b48c } = {}) {
    this.kam = kamera; this.tief = 0;
    this.g = new THREE.Group(); kamera.add(this.g);
    const arm = mat(aermel, { r: .85 }), hand = handschuhe ? mat(0x17191c, { r: .6 }) : mat(haut, { r: .6 });
    this.arme = {};
    for (const [n, s] of [['L', 1], ['R', -1]]) {
      const sh = new THREE.Group(); sh.position.set(-s * 0.2, -0.3, 0.1); this.g.add(sh);
      sh.add(at(cyl(.046, .038, .3, arm, 14, false), 0, -.15, 0));
      const el = new THREE.Group(); el.position.set(0, -.3, 0); sh.add(el);
      el.add(at(cyl(.038, .031, .27, arm, 14, false), 0, -.14, 0));
      el.add(at(cyl(.034, .034, .04, mat(0x111214), 12, false), 0, -.27, 0));
      const ha = new THREE.Group(); ha.position.set(0, -.28, 0); el.add(ha);
      { const hf = sph(1, hand, 14, 10, false); hf.scale.set(.036, .05, .022); ha.add(at(hf, 0, -.05, 0)); }
      for (let k = 0; k < 4; k++) ha.add(at(caps(.0085, .04, hand, false), -.024 + k * .016, -.11, .006, .5));
      ha.add(at(caps(.011, .045, hand, false), s * .038, -.04, .02, 0, 0, s * .5));
      if (n === 'L') {   // Armpatch mit der 6
        const p = new THREE.Mesh(new THREE.PlaneGeometry(.07, .07), new THREE.MeshStandardMaterial({ map: nummerTex(6, '#80ed99'), roughness: .9 }));
        p.position.set(.057, -.1, 0); p.rotation.y = Math.PI / 2; sh.add(p);
      }
      this.arme[n] = { sh, el, ha };
    }
    this.gewehr = gewehrModell(); this.g.add(this.gewehr);
    this.lampe = new THREE.SpotLight(0xfff4dd, 0, 22, .42, .45, 1.3); this.lampe.castShadow = true;
    this.lampe.shadow.mapSize.set(1024, 1024); this.lampe.shadow.bias = -.002;
    this.gewehr.lampe.add(this.lampe); this.lampenZiel = new THREE.Object3D(); this.lampenZiel.position.set(0, 0, 8); this.gewehr.lampe.add(this.lampenZiel);
    this.lampe.target = this.lampenZiel;
    this.tasse = new THREE.Group();
    this.tasse.add(at(cyl(.045, .04, .11, mat(0xf1f3f5, { r: .35 }), 20), 0, 0, 0));
    this.tasse.add(at(new THREE.Mesh(new THREE.TorusGeometry(.03, .008, 8, 16), mat(0xf1f3f5)), .05, 0, 0, 0, 0, 0));
    this.tasse.add(at(cyl(.04, .04, .005, mat(0x3b2416, { r: .2 }), 20), 0, .045, 0));
    this.g.add(this.tasse);
    this.schellen = handschellenModell(); this.g.add(this.schellen);
    this.g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  }

  // modus: 'gewehr' | 'tasse' | 'frei' | 'aus'
  setze({ modus = 'gewehr', t = 0, lauf = 0, zielen = 0, senken = 0, lampe = 0, ruck = 0, zielL = null, zielR = null, schellen = false, geste = 0 }) {
    this.g.visible = modus !== 'aus';
    this.gewehr.visible = modus === 'gewehr';
    this.tasse.visible = modus === 'tasse';
    this.schellen.visible = schellen;
    this.lampe.intensity = modus === 'gewehr' ? lampe : 0;
    if (modus === 'aus') return;
    const bob = Math.sin(t * 9) * .018 * lauf, sway = Math.cos(t * 4.5) * .015 * lauf;
    this.g.position.set(sway, bob - senken * .35, 0);
    this.g.updateMatrixWorld(true);
    const pol = (x, y, z) => this.kam.localToWorld(new THREE.Vector3(x, y, z));
    if (modus === 'gewehr') {
      const z = zielen;
      this.gewehr.position.set(.2 - .17 * z, -.31 + .18 * z - this.tief * (1 - z), -.6 + .1 * z + ruck * .05);
      this.gewehr.rotation.set(.08 * (1 - z) + ruck * .2, Math.PI + .06 * (1 - z), .05);
      this.gewehr.updateMatrixWorld(true);
      ik(this.arme.R.sh, this.arme.R.el, this.arme.R.ha, weltPos(this.gewehr.griff), pol(.6, -.6, .2));
      // geste > 0: linke Hand löst sich vom Handschutz und gestikuliert beim Reden (man sieht: ICH rede)
      const zielHand = weltPos(this.gewehr.vorne);
      if (geste > 0) zielHand.lerp(this.kam.localToWorld(new THREE.Vector3(-.2 + .04 * Math.sin(t * 7), -.2 + .05 * Math.sin(t * 9.3), -.42)), geste);
      ik(this.arme.L.sh, this.arme.L.el, this.arme.L.ha, zielHand, pol(-.5, -.7, .1));
      this.fingerSpreiz = geste;
    } else if (modus === 'tasse') {
      this.tasse.position.set(.15, -.25 + .01 * Math.sin(t * 1.3), -.45);
      this.tasse.updateMatrixWorld(true);
      ik(this.arme.R.sh, this.arme.R.el, this.arme.R.ha, weltPos(this.tasse).add(new THREE.Vector3(0, -.02, 0)), pol(.6, -.6, .2));
      ik(this.arme.L.sh, this.arme.L.el, this.arme.L.ha, zielL ?? pol(-.18, -.38, -.5), pol(-.6, -.6, .2));
    } else {
      if (zielR) ik(this.arme.R.sh, this.arme.R.el, this.arme.R.ha, zielR, pol(.6, -.6, .3));
      if (zielL) ik(this.arme.L.sh, this.arme.L.el, this.arme.L.ha, zielL, pol(-.6, -.6, .3));
      this.arme.R.sh.visible = !!zielR; this.arme.L.sh.visible = !!zielL;
    }
    if (modus !== 'frei') { this.arme.R.sh.visible = true; this.arme.L.sh.visible = true; }
  }
  handWelt(n) { return weltPos(this.arme[n].ha).add(new THREE.Vector3(0, 0, 0)); }
}
