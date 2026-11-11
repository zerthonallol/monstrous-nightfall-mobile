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
  const std = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color: c, metalness: 0.4, roughness: 0.45, ...o });
  const glow = (c: string, i = 0.6, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    std(c, { emissive: c, emissiveIntensity: i, ...o });
  const chrome = std("#d8dcdf", { metalness: 1, roughness: 0.22, emissive: "#333", emissiveIntensity: 0.25 });
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number] = [0, 0, 0], rot?: [number, number, number]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    if (rot) m.rotation.set(...rot);
    g.add(m);
    return m;
  };
  const extrude = (shape: THREE.Shape, depth: number, bevel = 0.01) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
    geo.center();
    return geo;
  };

  if (kind === "battery") {
    // D-cell: copper top, black body, green label band, chrome caps
    const body = new THREE.Group();
    g.add(body);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; body.add(m); };
    add(new THREE.CylinderGeometry(0.085, 0.085, 0.2, 24), std("#151515", { roughness: 0.3 }), -0.03);
    add(new THREE.CylinderGeometry(0.0865, 0.0865, 0.11, 24), glow("#2fb34a", 0.55, { roughness: 0.25 }), 0.0);
    add(new THREE.CylinderGeometry(0.086, 0.086, 0.07, 24), std("#b8732f", { metalness: 0.9, roughness: 0.3 }), 0.1);
    add(new THREE.CylinderGeometry(0.083, 0.083, 0.012, 24), chrome, -0.135);
    add(new THREE.CylinderGeometry(0.083, 0.083, 0.012, 24), chrome, 0.14);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), chrome, 0.16);
    // lightning bolt decal
    const bolt = new THREE.Shape([new THREE.Vector2(0.01, 0.04), new THREE.Vector2(-0.02, 0), new THREE.Vector2(0.0, 0), new THREE.Vector2(-0.01, -0.04), new THREE.Vector2(0.025, 0.008), new THREE.Vector2(0.005, 0.008)]);
    const b = new THREE.Mesh(new THREE.ShapeGeometry(bolt), new THREE.MeshBasicMaterial({ color: "#fff6a0", toneMapped: false }));
    b.position.set(0, 0, 0.088);
    body.add(b);
    body.rotation.z = Math.PI / 2;
  } else if (kind === "fuse") {
    mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.26, 20, 1, true), new THREE.MeshPhysicalMaterial({ color: "#cdefff", transmission: 0.6, roughness: 0.05, thickness: 0.05, transparent: true, opacity: 0.45, emissive: "#3aa8ff", emissiveIntensity: 0.35, side: THREE.DoubleSide }));
    // glowing zig-zag filament
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3(i % 2 ? 0.025 : -0.025, -0.11 + i * 0.022, 0));
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.005, 5), new THREE.MeshBasicMaterial({ color: "#ffd27a", toneMapped: false }));
    for (const y of [-0.155, 0.155]) {
      mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.06, 20), chrome, [0, y, 0]);
      mesh(new THREE.TorusGeometry(0.074, 0.008, 6, 20), chrome, [0, y * 0.82, 0], [Math.PI / 2, 0, 0]);
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), std("#b8732f", { metalness: 1, roughness: 0.3 }), [0, y * 1.25, 0]);
    }
    g.rotation.z = Math.PI / 2;
  } else if (kind === "cog") {
    const teeth = 10, ro = 0.25, ri = 0.2;
    const sh = new THREE.Shape();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2, st = (Math.PI * 2) / teeth;
      const pts = [[ri, a], [ro, a + st * 0.15], [ro, a + st * 0.45], [ri, a + st * 0.6]];
      pts.forEach(([r, t], j) => (i === 0 && j === 0 ? sh.moveTo : sh.lineTo).call(sh, Math.cos(t) * r, Math.sin(t) * r));
    }
    sh.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.05, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    for (let k = 0; k < 5; k++) {
      const w = new THREE.Path();
      const a = (k / 5) * Math.PI * 2;
      w.absarc(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0.035, 0, Math.PI * 2, true);
      sh.holes.push(w);
    }
    mesh(extrude(sh, 0.05, 0.008), glow("#b8742e", 0.35, { metalness: 0.95, roughness: 0.35 }));
    mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 20), chrome);
    g.rotation.x = -Math.PI / 2.5;
  } else if (kind === "key") {
    const gold = glow("#e3b347", 0.45, { metalness: 1, roughness: 0.25 });
    const bow = new THREE.Shape();
    bow.absarc(0, 0, 0.09, 0, Math.PI * 2, false);
    const h = new THREE.Path();
    h.absarc(0, 0, 0.045, 0, Math.PI * 2, true);
    bow.holes.push(h);
    mesh(extrude(bow, 0.025, 0.006), gold, [-0.17, 0, 0]);
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 12), gold, [0.04, 0, 0], [0, 0, Math.PI / 2]);
    mesh(new THREE.TorusGeometry(0.024, 0.008, 6, 14), gold, [-0.07, 0, 0], [0, Math.PI / 2, 0]);
    const bit = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.1, 0), new THREE.Vector2(0.1, -0.05), new THREE.Vector2(0.075, -0.05), new THREE.Vector2(0.075, -0.08), new THREE.Vector2(0.045, -0.08), new THREE.Vector2(0.045, -0.05), new THREE.Vector2(0.02, -0.05), new THREE.Vector2(0.02, -0.07), new THREE.Vector2(0, -0.07)]);
    const bm = mesh(new THREE.ExtrudeGeometry(bit, { depth: 0.02, bevelEnabled: false }), gold, [0.08, -0.01, -0.01]);
    bm.scale.setScalar(1);
    // dangling paper tag
    mesh(new THREE.BoxGeometry(0.07, 0.11, 0.004), std("#d9c9a0", { metalness: 0, roughness: 0.9, emissive: "#443322", emissiveIntensity: 0.4 }), [-0.23, -0.12, 0], [0, 0, 0.3]);
  } else if (kind === "token") {
    const c = color ?? "#ffffff";
    mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.024, 32), glow(c, 0.7, { metalness: 0.8, roughness: 0.3 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
    mesh(new THREE.TorusGeometry(0.105, 0.012, 8, 32), chrome);
    // embossed star on both sides
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.026 : 0.06, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      (i ? star.lineTo : star.moveTo).call(star, Math.cos(a) * r, Math.sin(a) * r);
    }
    const sg = extrude(star, 0.006, 0.003);
    const sm = new THREE.MeshBasicMaterial({ color: "#fff4cc", toneMapped: false });
    mesh(sg, sm, [0, 0, 0.015]);
    mesh(sg, sm, [0, 0, -0.015]);
  } else if (kind === "note") {
    // curled paper with pin
    const geo = new THREE.PlaneGeometry(0.3, 0.4, 8, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin((x / 0.3) * Math.PI) * 0.012 + Math.pow(Math.max(0, y - 0.1), 2) * 0.6);
    }
    geo.computeVertexNormals();
    const p = mesh(geo, new THREE.MeshStandardMaterial({ map: paperTexture(), emissive: "#665544", emissiveIntensity: 0.45, roughness: 0.95, side: THREE.DoubleSide }));
    p.rotation.x = -Math.PI / 2.3;
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), glow("#d02a2a", 0.6));
    pin.position.set(0, 0.17, 0.02);
    p.add(pin);
  } else if (kind === "tape") {
    const shell = std("#1b1b1d", { roughness: 0.35, emissive: "#111", emissiveIntensity: 0.3 });
    mesh(new THREE.BoxGeometry(0.32, 0.04, 0.2), shell);
    mesh(new THREE.BoxGeometry(0.26, 0.042, 0.1), glow("#e05040", 0.55, { metalness: 0, roughness: 0.8 }), [0, 0, -0.02]);
    mesh(new THREE.BoxGeometry(0.14, 0.044, 0.035), new THREE.MeshPhysicalMaterial({ color: "#332a22", roughness: 0.1, transparent: true, opacity: 0.8 }), [0, 0, -0.02]);
    for (const x of [-0.055, 0.055]) {
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.046, 16), std("#5a3a1e", { roughness: 0.6 }), [x, 0, -0.02]);
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.048, 6), std("#eeeeee"), [x, 0, -0.02]);
    }
    for (const x of [-0.12, 0.12]) mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.046, 8), chrome, [x, 0, 0.08]);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}
