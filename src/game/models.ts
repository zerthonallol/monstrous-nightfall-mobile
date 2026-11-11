// @ts-nocheck -- grid/array indexing is bounds-checked at runtime
import * as THREE from "three";
import { plushTexture, rustTexture, lockerTexture, screenTexture, paperTexture } from "./textures";

// Every model here is built from primitives + procedural textures.

export interface Bear {
  root: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  eyeLight: THREE.PointLight;
  eye: THREE.Mesh;
}

export function buildBear(): Bear {
  const plush = new THREE.MeshStandardMaterial({ map: plushTexture(), roughness: 1 });
  const plushLight = new THREE.MeshStandardMaterial({ map: plushTexture(), color: "#c9a77a", roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ map: rustTexture(), metalness: 0.8, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: "#0a0705", roughness: 0.6 });
  const teethM = new THREE.MeshStandardMaterial({ color: "#c8b98a", roughness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: "#5c0c0c", roughness: 0.8 });
  const straw = new THREE.MeshStandardMaterial({ color: "#8a7444", roughness: 1 });

  const root = new THREE.Group();
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], s?: [number, number, number], rot?: [number, number, number]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    if (s) m.scale.set(...s);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // torso
  add(root, new THREE.SphereGeometry(0.75, 20, 16), plush, [0, 1.95, 0], [1, 1.25, 0.8]);
  add(root, new THREE.SphereGeometry(0.5, 16, 12), plushLight, [0, 1.85, 0.32], [1, 1.2, 0.5]);
  // torn chest hole revealing endoskeleton
  add(root, new THREE.CircleGeometry(0.22, 12), dark, [0.28, 2.25, 0.58], undefined, [0, 0.4, 0]);
  for (let i = 0; i < 3; i++) add(root, new THREE.TorusGeometry(0.15, 0.025, 6, 12, Math.PI), metal, [0.28, 2.15 + i * 0.09, 0.56], undefined, [0, 0.4, 0]);
  add(root, new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), metal, [0, 2.0, -0.2]); // spine
  // bow tie
  add(root, new THREE.ConeGeometry(0.13, 0.25, 4), red, [-0.12, 2.75, 0.5], undefined, [0, 0, Math.PI / 2]);
  add(root, new THREE.ConeGeometry(0.13, 0.25, 4), red, [0.12, 2.75, 0.5], undefined, [0, 0, -Math.PI / 2]);
  // neck piston
  add(root, new THREE.CylinderGeometry(0.1, 0.12, 0.35, 8), metal, [0, 2.95, 0]);

  // head
  const head = new THREE.Group();
  head.position.set(0, 3.25, 0.05);
  root.add(head);
  add(head, new THREE.SphereGeometry(0.55, 20, 16), plush, [0, 0, 0], [1, 0.95, 0.95]);
  add(head, new THREE.SphereGeometry(0.28, 14, 10), plushLight, [0, -0.12, 0.42], [1, 0.75, 0.9]);
  add(head, new THREE.SphereGeometry(0.08, 10, 8), dark, [0, -0.04, 0.66], [1.3, 1, 1]);
  // ears (right one torn to the frame)
  add(head, new THREE.SphereGeometry(0.17, 12, 10), plush, [-0.4, 0.42, -0.02], [1, 1, 0.5]);
  add(head, new THREE.TorusGeometry(0.13, 0.03, 6, 10), metal, [0.4, 0.42, -0.02]);
  // eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: "#ffb347", toneMapped: false });
  const eye = add(head, new THREE.SphereGeometry(0.075, 12, 10), eyeMat, [-0.2, 0.12, 0.47]);
  add(head, new THREE.TorusGeometry(0.1, 0.02, 6, 12), dark, [-0.2, 0.12, 0.46]);
  add(head, new THREE.SphereGeometry(0.1, 10, 8), dark, [0.2, 0.12, 0.44]);
  add(head, new THREE.SphereGeometry(0.06, 10, 8), metal, [0.2, 0.12, 0.47]);
  const eyeLight = new THREE.PointLight("#ff8a2a", 6, 9, 1.8);
  eyeLight.position.set(-0.2, 0.12, 0.7);
  head.add(eyeLight);
  // jaw with teeth
  const jaw = add(head, new THREE.BoxGeometry(0.42, 0.1, 0.3), plushLight, [0, -0.33, 0.33]);
  for (let i = 0; i < 6; i++) {
    add(jaw, new THREE.ConeGeometry(0.03, 0.09, 5), teethM, [-0.16 + i * 0.065, 0.08, 0.1]);
    add(head, new THREE.ConeGeometry(0.03, 0.09, 5), teethM, [-0.16 + i * 0.065, -0.24, 0.45], undefined, [Math.PI, 0, 0]);
  }
  // barker straw hat
  add(head, new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20), straw, [0.05, 0.5, 0], undefined, [0, 0, 0.15]);
  add(head, new THREE.CylinderGeometry(0.27, 0.27, 0.2, 20), straw, [0.06, 0.6, 0], undefined, [0, 0, 0.15]);
  add(head, new THREE.CylinderGeometry(0.275, 0.275, 0.06, 20), red, [0.055, 0.54, 0], undefined, [0, 0, 0.15]);

  // arms
  const mkArm = (side: number, exposed: boolean) => {
    const g = new THREE.Group();
    g.position.set(side * 0.82, 2.55, 0);
    root.add(g);
    add(g, new THREE.SphereGeometry(0.22, 12, 10), plush, [0, 0, 0]);
    add(g, new THREE.CapsuleGeometry(0.17, 0.55, 6, 10), plush, [0, -0.45, 0]);
    if (exposed) {
      add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), metal, [0, -1.15, 0]);
      add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), metal, [0.07, -1.0, 0]);
    } else {
      add(g, new THREE.CapsuleGeometry(0.15, 0.5, 6, 10), plush, [0, -1.1, 0]);
    }
    add(g, new THREE.SphereGeometry(0.16, 10, 8), exposed ? metal : plush, [0, -1.55, 0.04]);
    for (let i = -1; i <= 1; i++) add(g, new THREE.ConeGeometry(0.035, 0.22, 5), metal, [i * 0.08, -1.75, 0.1], undefined, [Math.PI + 0.3, 0, 0]);
    return g;
  };
  const armL = mkArm(-1, false);
  const armR = mkArm(1, true);

  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.35, 1.15, 0);
    root.add(g);
    add(g, new THREE.CapsuleGeometry(0.22, 0.35, 6, 10), plush, [0, -0.25, 0]);
    add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8), metal, [0, -0.7, 0]);
    add(g, new THREE.CylinderGeometry(0.11, 0.11, 0.25, 8), metal, [0, -0.6, 0.08]);
    add(g, new THREE.BoxGeometry(0.34, 0.18, 0.55), plush, [0, -1.05, 0.1]);
    return g;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  return { root, head, jaw, armL, armR, legL, legR, eyeLight, eye };
}

const rustMat = () => new THREE.MeshStandardMaterial({ map: rustTexture(), metalness: 0.7, roughness: 0.6 });

export function buildLocker() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ map: lockerTexture(), metalness: 0.5, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 1.1), m);
  body.position.y = 1.15;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.2), rustMat());
  sign.position.y = 2.4;
  g.add(sign);
  return g;
}

export function buildTable() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: rustTexture(), color: "#6b5a44", roughness: 0.9 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.3), wood);
  top.position.y = 0.95;
  top.castShadow = true;
  g.add(top);
  for (const [x, z] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), wood);
    l.position.set(x, 0.47, z);
    g.add(l);
  }
  // cloth to hide under
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.85, 1.35), new THREE.MeshStandardMaterial({ color: "#3a1414", roughness: 1, transparent: true, opacity: 0.92 }));
  cloth.position.y = 0.5;
  g.add(cloth);
  return g;
}

export function buildArcade() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ map: rustTexture(), color: "#7a2a2a", metalness: 0.4, roughness: 0.7 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 1.0), body);
  cab.position.y = 1.1;
  cab.castShadow = true;
  g.add(cab);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false }));
  scr.position.set(0, 1.6, 0.51);
  g.add(scr);
  const colors = ["#e03030", "#3070e0", "#e0c030"];
  colors.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), new THREE.MeshBasicMaterial({ color: c }));
    b.rotation.x = Math.PI / 2;
    b.position.set(-0.3 + i * 0.3, 1.05, 0.52);
    g.add(b);
  });
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), new THREE.MeshStandardMaterial({ color: "#c9a040", metalness: 1, roughness: 0.3 }));
  slot.position.set(0, 0.7, 0.52);
  g.add(slot);
  return { group: g, screen: scr };
}

export function buildGenerator() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.9), rustMat());
  box.position.y = 0.95;
  box.castShadow = true;
  g.add(box);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.05), new THREE.MeshStandardMaterial({ color: "#2b2b28", metalness: 0.8, roughness: 0.5 }));
  panel.position.set(0, 1.1, 0.47);
  g.add(panel);
  // warning stripes
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: i % 2 ? "#111" : "#c9a020" }));
    s.position.set(-0.45 + i * 0.22, 0.25, 0.47);
    g.add(s);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: "#ff2010", toneMapped: false });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), lampMat);
  lamp.position.set(0, 2.0, 0.3);
  g.add(lamp);
  // dangling wires
  const wire = new THREE.MeshStandardMaterial({ color: "#151515" });
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), wire);
    w.position.set(-0.3 + i * 0.3, 0.3, 0.55);
    w.rotation.z = (i - 1) * 0.3;
    g.add(w);
  }
  return { group: g, lampMat };
}

export type ItemKind = "battery" | "fuse" | "cog" | "key" | "token" | "note" | "tape";

export function buildItem(kind: ItemKind, color?: string) {
  const g = new THREE.Group();
  const glow = (c: string, i = 0.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, metalness: 0.5, roughness: 0.4 });
  if (kind === "battery") {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 12), glow("#2a8a3a", 0.5));
    b.rotation.z = Math.PI / 2;
    g.add(b);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), glow("#dddddd", 0.3));
    t.rotation.z = Math.PI / 2;
    t.position.x = 0.17;
    g.add(t);
  } else if (kind === "fuse") {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), new THREE.MeshStandardMaterial({ color: "#aee8ff", emissive: "#4ab8ff", emissiveIntensity: 0.8, transparent: true, opacity: 0.7 }));
    g.add(glass);
    for (const y of [-0.17, 0.17]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), glow("#c0c0c0", 0.2));
      cap.position.y = y;
      g.add(cap);
    }
    g.rotation.z = Math.PI / 2;
  } else if (kind === "cog") {
    const m = glow("#b06a2a", 0.4);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 16), m));
    for (let i = 0; i < 8; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.1), m);
      const a = (i / 8) * Math.PI * 2;
      t.position.set(Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0);
      t.rotation.z = a;
      g.add(t);
    }
    g.rotation.x = -Math.PI / 2.5;
  } else if (kind === "key") {
    const m = glow("#e0b040", 0.6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 14), m);
    ring.position.x = -0.15;
    g.add(ring);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.035), m);
    shaft.position.x = 0.07;
    g.add(shaft);
    const bit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.035), m);
    bit.position.set(0.18, -0.05, 0);
    g.add(bit);
  } else if (kind === "token") {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), glow(color ?? "#fff", 0.9));
    c.rotation.x = Math.PI / 2;
    g.add(c);
  } else if (kind === "note") {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ map: paperTexture(), emissive: "#554433", emissiveIntensity: 0.4, side: THREE.DoubleSide }));
    p.rotation.x = -Math.PI / 2.3;
    g.add(p);
  } else if (kind === "tape") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), glow("#222", 0.2));
    g.add(b);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.052, 0.08), glow("#e05040", 0.6));
    g.add(l);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}
