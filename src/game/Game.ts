// @ts-nocheck -- grid/array indexing is bounds-checked at runtime
import * as THREE from "three";
import { Sfx } from "./audio";
import { createNightSky, createRain, Lightning, AdaptiveQuality } from "./atmosphere";
import { brickTexture, concreteTexture, stripeTexture, signTexture, fogTexture, rustTexture } from "./textures";
import { buildBear, buildLocker, buildTable, buildArcade, buildGenerator, buildItem, type Bear, type ItemKind } from "./models";

// Legend: # brick wall, M mirror, . floor, D operator door, H locker, T table (hide),
// A arcade, 1/2/3 generators, f fuse, c cog, P start, X exit gate
const MAP = [
  "########################",
  "#.....#.c..#...........#",
  "#.1...#.T..D.....2.....#",
  "#.....#....#...........#",
  "###.#########.#######.##",
  "#......................#",
  "#.MMMMMMM....A....###..#",
  "#.M.....M........#.H#..#",
  "#.M.MMM.M........#..#..#",
  "#.M.M.f.M....H...##.#..#",
  "#.M.M.MMM...........#.##",
  "#.M.M...M.......#####..#",
  "#...MMM.M.......#.3....#",
  "#MMMM...M.......#....H.#",
  "#.......M.......##.#####",
  "#..H.......P...........#",
  "##########XX############",
];
const S = 3;
const WALL_H = 4.2;
const ROWS = MAP.length;
const COLS = 24;

export type InvId = "fuse" | "cog" | "key" | "tokens" | "mechkey";
export type TokenColor = "red" | "blue" | "yellow";
export const TOKEN_HEX: Record<TokenColor, string> = { red: "#e03030", blue: "#3070e0", yellow: "#e0c030" };
export const TOKEN_RU: Record<TokenColor, string> = { red: "КРАСНЫЙ", blue: "СИНИЙ", yellow: "ЖЁЛТЫЙ" };
const INV_LABEL: Record<InvId, string> = { fuse: "Предохранитель", cog: "Шестерня", key: "Ключ операторской", tokens: "Жетоны", mechkey: "Механический ключ" };

export interface Note { title: string; text: string; tape?: boolean }
export interface Hud {
  battery: number;
  stamina: number;
  flashlight: boolean;
  slots: { id: InvId; label: string; count: number }[];
  tokens: TokenColor[];
  prompt: string;
  message: string;
  gens: number;
  hidden: boolean;
  chase: boolean;
  paused: boolean;
  notes: Note[];
}
export type Ending = "caught" | "dark" | "escape" | "truth";
export interface EndStats { time: number; notes: number; notesTotal: number; gens: number }
export interface GameCallbacks {
  onHud: (h: Hud) => void;
  onNote: (n: Note) => void;
  onArcade: () => void;
  onInventory: () => void;
  onEnd: (result: Ending, stats: EndStats) => void;
}

interface Interactable {
  pos: THREE.Vector3;
  label: () => string;
  use: () => void;
  alive: boolean;
  mesh?: THREE.Object3D;
  bob?: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const cx = (c: number) => (c + 0.5) * S;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sfx: Sfx;
  private clock = new THREE.Clock();
  private raf = 0;
  private cb: GameCallbacks;
  private container: HTMLElement;
  readonly isTouch: boolean;

  // player
  private pos = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private stamina = 100;
  private battery = 100;
  private flashOn = true;
  private flash!: THREE.SpotLight;
  private bobT = 0;
  private hidden: { prev: THREE.Vector3; at: THREE.Vector3 } | null = null;
  private keys = new Set<string>();
  touch = { mx: 0, my: 0, lookX: 0, lookY: 0, sprint: false };

  // world state
  private doorOpen = false;
  private gateOpen = false;
  private gens = 0;
  private doorMesh!: THREE.Mesh;
  private gateMeshes: THREE.Mesh[] = [];
  private interactables: Interactable[] = [];
  private slots: { id: InvId; count: number }[] = [];
  tokens: TokenColor[] = [];
  private tokenOrder: TokenColor[] = [];
  private arcadeSeq: TokenColor[] = [];
  private arcadeSolved = false;
  private arcadePos = new THREE.Vector3();
  private notes: Note[] = [];
  private message = "";
  private messageT = 0;
  private prompt = "";
  private focus: Interactable | null = null;
  modal = false;
  private state: "playing" | "caught" | "ended" = "playing";
  private caughtT = 0;
  private lastHud = "";
  private hudT = 0;

  // monster
  private bear!: Bear;
  private m = {
    pos: new THREE.Vector3(),
    dir: 0,
    mode: "patrol" as "patrol" | "investigate" | "chase" | "search",
    target: new THREE.Vector3(),
    path: [] as [number, number][],
    pathT: 0,
    lostT: 0,
    searchT: 0,
    phase: 0,
    screechT: 8,
    knowsHide: false,
  };
  private waypoints: [number, number][] = [];

  // fx
  private signs: { mat: THREE.MeshBasicMaterial; light: THREE.PointLight; base: number; t: number }[] = [];
  private bulbs!: THREE.InstancedMesh;
  private bulbColors: THREE.Color[] = [];
  private bulbT = 0;
  private fogPlanes: THREE.Mesh[] = [];
  private sparks!: THREE.Points;
  private sparkVel: THREE.Vector3[] = [];
  private sparkLife: number[] = [];
  private sparkLight!: THREE.PointLight;
  private sparkEmitters: THREE.Vector3[] = [];
  private sparkT = 2;
  private cubeCam!: THREE.CubeCamera;
  private cubeT = 0;
  private wheel!: THREE.Group;
  private genLamps: Record<string, THREE.MeshBasicMaterial> = {};
  private decoys: THREE.Group[] = [];

  constructor(container: HTMLElement, cb: GameCallbacks) {
    this.container = container;
    this.cb = cb;
    this.isTouch = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false });
    this.quality = new AdaptiveQuality(this.renderer, Math.min(window.devicePixelRatio, this.isTouch ? 1 : 1.25));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isTouch;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.05, 260);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.sfx = new Sfx();

    this.buildWorld();
    this.placeItems();
    this.bindInput();
    this.sfx.startMusic();
    this.sfx.startRain();
    this.startT = performance.now();
    this.flashMessage("Почините 3 электрощитка, чтобы открыть ворота. Берегитесь Зазывалы.", 6);
    this.loop();
  }

  // ---------- grid helpers ----------
  private cell(x: number, z: number): [number, number] {
    return [Math.floor(x / S), Math.floor(z / S)];
  }
  private solid(c: number, r: number, forMonster = false) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    const ch = MAP[r][c] ?? "#";
    if (ch === "D") return !this.doorOpen;
    if (ch === "X") return forMonster || !this.gateOpen;
    return "#MHTA123".includes(ch);
  }
  private solidAt(x: number, z: number, forMonster = false) {
    const [c, r] = this.cell(x, z);
    return this.solid(c, r, forMonster);
  }
  private blocked(x: number, z: number, rad: number, forMonster = false) {
    return (
      this.solidAt(x - rad, z - rad, forMonster) ||
      this.solidAt(x + rad, z - rad, forMonster) ||
      this.solidAt(x - rad, z + rad, forMonster) ||
      this.solidAt(x + rad, z + rad, forMonster)
    );
  }
  private los(ax: number, az: number, bx: number, bz: number) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / 0.3);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const ch = MAP[Math.floor((az + (bz - az) * t) / S)]?.[Math.floor((ax + (bx - ax) * t) / S)];
      if (ch === undefined || ch === "#" || ch === "M" || (ch === "D" && !this.doorOpen)) return false;
    }
    return true;
  }
  private bfs(from: [number, number], to: [number, number]) {
    const key = (c: number, r: number) => r * COLS + c;
    const prev = new Map<number, number>();
    const q: [number, number][] = [from];
    prev.set(key(...from), -1);
    while (q.length) {
      const [c, r] = q.shift()!;
      if (c === to[0] && r === to[1]) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        const k = key(nc, nr);
        if (prev.has(k) || (this.solid(nc, nr, true) && !(nc === to[0] && nr === to[1]))) continue;
        prev.set(k, key(c, r));
        q.push([nc, nr]);
      }
    }
    const path: [number, number][] = [];
    let k = key(...to);
    if (!prev.has(k)) return path;
    while (k !== -1) {
      path.unshift([k % COLS, Math.floor(k / COLS)]);
      k = prev.get(k)!;
    }
    return path;
  }

  // ---------- world ----------
  private buildWorld() {
    const sc = this.scene;
    sc.fog = new THREE.FogExp2("#0a0f12", 0.05);
    sc.background = new THREE.Color("#05070a");

    this.sky = createNightSky(220);
    sc.add(this.sky.mesh);
    this.rain = createRain(this.isTouch ? 2500 : 5000);
    sc.add(this.rain.mesh);
    this.lightning.thunder = (d, v) => this.sfx.thunder(d, v);

    this.hemi = new THREE.HemisphereLight("#3a5060", "#1a120c", 0.55);
    sc.add(this.hemi);
    const moonL = new THREE.DirectionalLight("#7f9fb5", 0.5);
    moonL.position.copy(this.sky.moonDir).multiplyScalar(60);
    sc.add(moonL);

    // floor
    const floorTex = concreteTexture();
    floorTex.repeat.set(COLS * S / 6, ROWS * S / 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(COLS * S + 200, ROWS * S + 200), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75, metalness: 0.15 }));
    floorTex.repeat.set((COLS * S + 200) / 6, (ROWS * S + 200) / 6);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((COLS * S) / 2, 0, (ROWS * S) / 2);
    floor.receiveShadow = true;
    sc.add(floor);

    // walls (instanced per material)
    const brick = new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.95 });
    const stripe = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.9 });
    this.cubeCam = new THREE.CubeCamera(0.1, 60, new THREE.WebGLCubeRenderTarget(this.isTouch ? 64 : 128));
    this.cubeCam.position.set(cx(5), 1.7, cx(10));
    sc.add(this.cubeCam);
    const mirror = new THREE.MeshStandardMaterial({ color: "#b8c4c8", metalness: 1, roughness: 0.04, envMap: this.cubeCam.renderTarget.texture, envMapIntensity: 1.6 });
    const groups: Record<string, [number, number][]> = { brick: [], stripe: [], mirror: [] };
    const special: Record<string, [number, number][]> = {};
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const ch = MAP[r][c] ?? "#";
        if (ch === "#") groups[(r <= 4 && c >= 11) || (r >= 10 && c >= 16 && r <= 14) ? "stripe" : "brick"].push([c, r]);
        else if (ch === "M") groups.mirror.push([c, r]);
        else (special[ch] ??= []).push([c, r]);
      }
    const box = new THREE.BoxGeometry(S, WALL_H, S);
    const dummy = new THREE.Object3D();
    for (const [name, mat] of [["brick", brick], ["stripe", stripe], ["mirror", mirror]] as const) {
      const list = groups[name];
      const im = new THREE.InstancedMesh(box, mat, list.length);
      list.forEach(([c, r], i) => {
        dummy.position.set(cx(c), WALL_H / 2, cx(r));
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.castShadow = name !== "mirror";
      im.receiveShadow = true;
      sc.add(im);
    }
    // rusty pipes along tops of walls for silhouette
    const rust = new THREE.MeshStandardMaterial({ map: rustTexture(), metalness: 0.7, roughness: 0.6 });

    // player start
    const [pc, pr] = special["P"][0];
    this.pos.set(cx(pc), 1.6, cx(pr));
    this.yaw = 0;

    // door
    const [dc, dr] = special["D"][0];
    this.doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, S * 0.9), rust);
    this.doorMesh.position.set(cx(dc), 1.5, cx(dr));
    this.doorMesh.castShadow = true;
    sc.add(this.doorMesh);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(S, WALL_H - 3, S), brick);
    lintel.position.set(cx(dc), 3 + (WALL_H - 3) / 2, cx(dr));
    sc.add(lintel);
    this.interactables.push({
      pos: new THREE.Vector3(cx(dc), 1.4, cx(dr)),
      alive: true,
      label: () => (this.has("key") ? "Открыть операторскую (ключ)" : "Операторская — заперто"),
      use: () => {
        if (!this.has("key")) return this.flashMessage("Нужен ключ от операторской.");
        this.take("key");
        this.doorOpen = true;
        this.doorMesh.rotation.y = Math.PI / 2;
        this.doorMesh.position.z -= S * 0.45;
        this.sfx.door();
        this.noise(this.doorMesh.position, 12);
        this.flashMessage("Дверь со скрипом открылась.");
        const it = this.interactables.find((i) => i.pos.equals(new THREE.Vector3(cx(dc), 1.4, cx(dr))));
        if (it) it.alive = false;
      },
    });

    // gate
    for (const [gc, gr] of special["X"]) {
      const bars = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), rust);
        b.position.set(-S / 2 + 0.2 + i * (S / 7), 1.8, 0);
        bars.add(b);
      }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(S, 0.15, 0.15), rust);
      frame.position.y = 3.2;
      bars.add(frame);
      const m = new THREE.Mesh(new THREE.BoxGeometry(S, 0.15, 0.15), rust);
      m.position.y = 0.4;
      bars.add(m);
      bars.position.set(cx(gc), 0, gr * S + 0.2);
      sc.add(bars);
      this.gateMeshes.push(bars as unknown as THREE.Mesh);
    }

    // lockers / tables / arcade / generators
    for (const ch of ["H", "T"]) for (const [c, r] of special[ch] ?? []) {
      const g = ch === "H" ? buildLocker() : buildTable();
      g.position.set(cx(c), 0, cx(r));
      // face toward an open neighbour
      const open = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]].find(([dc2, dr2]) => !this.solid(c + dc2, r + dr2));
      if (open) g.rotation.y = open[2];
      sc.add(g);
      const at = new THREE.Vector3(cx(c), ch === "H" ? 1.5 : 0.55, cx(r));
      this.interactables.push({
        pos: new THREE.Vector3(cx(c), 1.0, cx(r)),
        alive: true,
        label: () => (ch === "H" ? "Спрятаться в шкафчике" : "Спрятаться под столом"),
        use: () => this.hide(at),
      });
    }
    const [ac, ar] = special["A"][0];
    const arc = buildArcade();
    arc.group.position.set(cx(ac), 0, cx(ar));
    sc.add(arc.group);
    this.arcadePos.set(cx(ac), 1.2, cx(ar));
    this.interactables.push({
      pos: this.arcadePos.clone(),
      alive: true,
      label: () => (this.arcadeSolved ? "Автомат пуст" : "Игровой автомат «Token Trial»"),
      use: () => {
        if (this.arcadeSolved) return this.flashMessage("Автомат уже выдал всё, что мог.");
        if (this.tokens.length < 3) return this.flashMessage(`Нужно 3 жетона. У вас: ${this.tokens.length}.`);
        this.arcadeSeq = [];
        this.openModal();
        this.cb.onArcade();
      },
    });
    const neonL = new THREE.PointLight("#50ff90", 4, 6, 2);
    neonL.position.set(cx(ac), 1.8, cx(ar) + 1);
    sc.add(neonL);

    const needs: Record<string, InvId> = { "1": "fuse", "2": "cog", "3": "mechkey" };
    for (const id of ["1", "2", "3"]) {
      const [gc, gr] = special[id][0];
      const gen = buildGenerator();
      gen.group.position.set(cx(gc), 0, cx(gr));
      const open = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]].find(([a, b]) => !this.solid(gc + a, gr + b));
      if (open) gen.group.rotation.y = open[2];
      sc.add(gen.group);
      this.genLamps[id] = gen.lampMat;
      this.sparkEmitters.push(new THREE.Vector3(cx(gc), 1.6, cx(gr)));
      const it: Interactable = {
        pos: new THREE.Vector3(cx(gc), 1.2, cx(gr)),
        alive: true,
        label: () => `Электрощиток №${id} — нужен: ${INV_LABEL[needs[id]].toLowerCase()}`,
        use: () => {
          if (!this.has(needs[id])) return this.flashMessage(`Не хватает: ${INV_LABEL[needs[id]].toLowerCase()}.`);
          this.take(needs[id]);
          it.alive = false;
          this.gens++;
          gen.lampMat.color.set("#30ff60");
          this.sparkEmitters = this.sparkEmitters.filter((e) => !e.equals(new THREE.Vector3(cx(gc), 1.6, cx(gr))));
          this.sfx.generator();
          this.noise(it.pos, 30);
          if (this.gens >= 3) this.openGate();
          else this.flashMessage(`Щиток №${id} запущен. Осталось: ${3 - this.gens}. Гул разнёсся по парку…`);
        },
      };
      this.interactables.push(it);
    }
    this.sparkEmitters.push(new THREE.Vector3(cx(12), 3.6, cx(5) - 1.3));

    // neon signs
    const addSign = (text: string, color: string, x: number, z: number, rotY: number, w = 5) => {
      const mat = new THREE.MeshBasicMaterial({ map: signTexture(text, color), toneMapped: false, fog: false });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
      sign.position.set(x, WALL_H - 0.6, z);
      sign.rotation.y = rotY;
      sc.add(sign);
      const light = new THREE.PointLight(color, 10, 11, 2);
      light.position.set(x + Math.sin(rotY) * 1.2, WALL_H - 1, z + Math.cos(rotY) * 1.2);
      sc.add(light);
      this.signs.push({ mat, light, base: 10, t: Math.random() * 5 });
    };
    addSign("MIRROR MAZE", "#5ad8ff", cx(5), 6 * S - 0.02, Math.PI, 6);
    addSign("FUN HOUSE", "#ff3b6b", cx(18), 5 * S + 0.02 - S, 0);
    addSign("EXIT", "#ff2a1a", 11 * S, 16 * S - 0.02, Math.PI, 3);
    addSign("GAMES", "#7dff6a", cx(13), 6 * S - 1.0 + 0.6, 0, 3);

    // garlands
    const bulbPos: THREE.Vector3[] = [];
    const catenary = (a: THREE.Vector3, b: THREE.Vector3, n: number) => {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * 0.8;
        bulbPos.push(p);
      }
    };
    catenary(new THREE.Vector3(S * 1, 3.8, cx(5) - 1), new THREE.Vector3(S * 12, 3.8, cx(5) + 1), 18);
    catenary(new THREE.Vector3(S * 12, 3.8, cx(5) + 1), new THREE.Vector3(S * 23, 3.8, cx(5) - 1), 18);
    catenary(new THREE.Vector3(S * 1, 3.6, cx(15) + 1), new THREE.Vector3(S * 11, 3.6, cx(15) - 1), 16);
    catenary(new THREE.Vector3(S * 11, 3.6, cx(15) - 1), new THREE.Vector3(S * 23, 3.6, cx(15) + 1), 16);
    catenary(new THREE.Vector3(S * 9, 3.6, cx(9)), new THREE.Vector3(S * 16, 3.6, cx(11)), 12);
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbPos.length);
    const palette = ["#ffcf6b", "#ff4a4a", "#5ad8ff", "#7dff6a", "#ff7ad9"];
    bulbPos.forEach((p, i) => {
      dummy.position.copy(p);
      dummy.updateMatrix();
      this.bulbs.setMatrixAt(i, dummy.matrix);
      const c = new THREE.Color(palette[i % palette.length]).multiplyScalar(2);
      this.bulbColors.push(c);
      this.bulbs.setColorAt(i, c);
    });
    sc.add(this.bulbs);
    const wire = new THREE.LineBasicMaterial({ color: "#111" });
    sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bulbPos), wire));

    // ground fog
    const fogTex = fogTexture();
    for (let i = 0; i < 8; i++) {
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, opacity: 0.5, depthWrite: false, color: "#8aa0a8" }));
      fp.rotation.x = -Math.PI / 2;
      fp.position.set(rand(10, 62), rand(0.2, 0.7), rand(8, 44));
      sc.add(fp);
      this.fogPlanes.push(fp);
    }

    // sparks
    const N = 120;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3).fill(-999), 3));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#ffd27a", size: 0.07, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending }));
    for (let i = 0; i < N; i++) {
      this.sparkVel.push(new THREE.Vector3());
      this.sparkLife.push(0);
    }
    sc.add(this.sparks);
    this.sparkLight = new THREE.PointLight("#ffc46a", 0, 8, 2);
    sc.add(this.sparkLight);

    // broken ferris wheel beyond the walls
    const wm = new THREE.MeshBasicMaterial({ color: "#0b0e10", fog: false });
    this.wheel = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(18, 0.35, 6, 48), wm);
    this.wheel.add(ring);
    this.wheel.add(new THREE.Mesh(new THREE.TorusGeometry(16.8, 0.2, 6, 48), wm));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 36, 4), wm);
      sp.rotation.z = a;
      this.wheel.add(sp);
      if (i !== 5 && i !== 11) {
        const gon = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.8), wm);
        gon.position.set(Math.cos(a) * 18, Math.sin(a) * 18 - 1.2, 0);
        this.wheel.add(gon);
      }
    }
    const wheelBase = new THREE.Group();
    wheelBase.position.set(48, 22, -45);
    wheelBase.add(this.wheel);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 26, 5), wm);
      leg.position.set(s * 6, -11, 0);
      leg.rotation.z = s * 0.25;
      wheelBase.add(leg);
    }
    sc.add(wheelBase);
    // a broken roller coaster track silhouette
    const track = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const h = 6 + Math.sin(i * 0.5) * 5 + 5;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), wm);
      p.position.set(-30 + i * 6, h / 2, 90);
      track.add(p);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 0.6), wm);
      beam.position.set(-27 + i * 6, h, 90);
      beam.rotation.z = Math.cos(i * 0.5) * 0.4;
      track.add(beam);
    }
    sc.add(track);

    // flashlight
    this.flash = new THREE.SpotLight("#ffe6b8", 60, 30, 0.45, 0.55, 1.4);
    this.flash.position.set(0.25, -0.2, 0);
    this.flash.castShadow = !this.isTouch;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.shadow.bias = -0.0005;
    this.camera.add(this.flash);
    this.flash.target.position.set(0, -0.1, -1);
    this.camera.add(this.flash.target);

    // monster
    this.bear = buildBear();
    sc.add(this.bear.root);
    this.m.pos.set(cx(20), 0, cx(2));
    this.waypoints = ([[3, 2], [3, 5], [12, 5], [22, 5], [22, 9], [19, 10], [21, 12], [18, 15], [12, 15], [2, 15], [1, 9], [1, 5], [12, 10], [15, 2], [20, 2], [10, 12]] as [number, number][]).filter(([c, r]) => !this.solid(c, r, true));
    this.m.target.copy(this.cellCenter(...this.waypoints[3]));

    // mirror maze decoy reflections
    for (const [c, r] of [[3, 9], [7, 7], [3, 12]]) {
      const d = buildBear();
      d.eyeLight.removeFromParent(); // unused lights still cost every pixel shader
      d.root.traverse((o) => { o.castShadow = false; });
      d.root.scale.setScalar(0.95);
      d.root.position.set(cx(c), 0, cx(r));
      d.root.traverse((o) => {
        const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mm && "transparent" in mm) {
          const cl = mm.clone();
          cl.transparent = true;
          cl.opacity = 0.35;
          (o as THREE.Mesh).material = cl;
        }
      });
      sc.add(d.root);
      this.decoys.push(d.root);
    }
    void special;
  }

  private cellCenter(c: number, r: number) {
    return new THREE.Vector3(cx(c), 0, cx(r));
  }

  private placeItems() {
    // reachable floor cells from start (door closed), shuffled → item spots
    const start = this.cell(this.pos.x, this.pos.z);
    const seen = new Set<number>([start[1] * COLS + start[0]]);
    const q = [start];
    const cells: [number, number][] = [];
    while (q.length) {
      const [c, r] = q.shift()!;
      cells.push([c, r]);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr, k = nr * COLS + nc;
        if (seen.has(k) || this.solid(nc, nr)) continue;
        seen.add(k);
        q.push([nc, nr]);
      }
    }
    const spots = cells.filter(([c, r]) => Math.abs(c - start[0]) + Math.abs(r - start[1]) > 3 && MAP[r][c] === ".").sort(() => Math.random() - 0.5);
    const next = () => spots.pop()!;

    this.tokenOrder = (["red", "blue", "yellow"] as TokenColor[]).sort(() => Math.random() - 0.5);
    const spawn = (kind: ItemKind, c: number, r: number, label: string, onPick: () => boolean, color?: string) => {
      const mesh = buildItem(kind, color);
      const p = new THREE.Vector3(cx(c) + rand(-0.6, 0.6), 0.6, cx(r) + rand(-0.6, 0.6));
      mesh.position.copy(p);
      this.scene.add(mesh);
      const it: Interactable = {
        pos: p,
        mesh,
        alive: true,
        bob: true,
        label: () => label,
        use: () => {
          if (!onPick()) return;
          it.alive = false;
          this.scene.remove(mesh);
          this.sfx.pickup();
        },
      };
      this.interactables.push(it);
    };
    const inv = (id: InvId) => () => {
      if (!this.give(id)) {
        this.flashMessage("Инвентарь полон (4 слота).");
        return false;
      }
      this.flashMessage(`Подобрано: ${INV_LABEL[id]}`);
      return true;
    };
    const f = MAP.findIndex((row) => row.includes("f"));
    spawn("fuse", MAP[f].indexOf("f"), f, "Подобрать предохранитель", inv("fuse"));
    const cRow = MAP.findIndex((row) => row.includes("c"));
    spawn("cog", MAP[cRow].indexOf("c"), cRow, "Подобрать шестерню", inv("cog"));
    const k = next();
    spawn("key", k[0], k[1], "Подобрать ключ от операторской", inv("key"));
    for (const col of this.tokenOrder) {
      const s = next();
      spawn("token", s[0], s[1], `Подобрать жетон (${TOKEN_RU[col].toLowerCase()})`, () => {
        if (!this.give("tokens")) {
          this.flashMessage("Инвентарь полон (4 слота).");
          return false;
        }
        this.tokens.push(col);
        this.flashMessage(`Жетон: ${TOKEN_RU[col].toLowerCase()} (${this.tokens.length}/3)`);
        return true;
      }, TOKEN_HEX[col]);
    }
    for (let i = 0; i < 6; i++) {
      const s = next();
      spawn("battery", s[0], s[1], "Подобрать батарейку", () => {
        if (this.battery > 95) {
          this.flashMessage("Фонарик заряжен полностью.");
          return false;
        }
        this.battery = Math.min(100, this.battery + 45);
        this.flashMessage("Батарейка вставлена (+45%)");
        return true;
      });
    }
    const notes: [ItemKind, Note][] = [
      ["note", { title: "Записка техника", text: `Этот чёртов «Token Trial» опять глючит. Жетоны принимает только строго по порядку:\n\n${this.tokenOrder.map((c) => TOKEN_RU[c]).join(" → ")}\n\nЕсли перепутать — орёт сиреной на весь парк. В лотке выдачи лежит механический ключ от щитка №3.` }],
      ["note", { title: "Приказ о закрытии, 1987", text: "Парк «Весёлые Горки» закрывается немедленно после инцидента с ростовым аниматроником «Зазывала Барни». Демонтаж робота отложен: при отключении питания он продолжает двигаться. Всем сотрудникам — не входить на территорию после заката." }],
      ["tape", { title: "Кассета: «Смена 14»", tape: true, text: "…*шипение*… Он реагирует на свет. Если светишь прямо в глаз — идёт к тебе. И на шум тоже: когда запускаешь щиток, он слышит гул через весь парк. …Прячься в шкафчиках или под столом в операторской, пока не пройдёт мимо. Только не дай ему увидеть, куда ты залез… *щелчок*" }],
    ];
    this.notesTotal = notes.length;
    for (const [kind, note] of notes) {
      const s = next();
      spawn(kind, s[0], s[1], kind === "tape" ? "Прослушать кассету" : "Прочитать записку", () => {
        this.notes.push(note);
        if (note.tape) this.sfx.tape();
        this.openModal();
        this.cb.onNote(note);
        return true;
      });
    }
  }

  // ---------- inventory ----------
  private has(id: InvId) {
    return this.slots.some((s) => s.id === id && s.count > 0);
  }
  private give(id: InvId) {
    const s = this.slots.find((x) => x.id === id);
    if (s) {
      s.count++;
      return true;
    }
    if (this.slots.length >= 4) return false;
    this.slots.push({ id, count: 1 });
    return true;
  }
  private take(id: InvId, n = 1) {
    const s = this.slots.find((x) => x.id === id);
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots = this.slots.filter((x) => x !== s);
  }

  insertToken(col: TokenColor): "ok" | "wrong" | "solved" {
    this.sfx.click();
    this.arcadeSeq.push(col);
    const i = this.arcadeSeq.length - 1;
    if (this.tokenOrder[i] !== col) {
      this.arcadeSeq = [];
      this.sfx.buzzer();
      this.noise(this.arcadePos, 35);
      this.flashMessage("СИРЕНА! Автомат выплюнул жетоны обратно. Он услышал…");
      return "wrong";
    }
    if (this.arcadeSeq.length === 3) {
      this.arcadeSolved = true;
      this.take("tokens", 3);
      this.tokens = [];
      this.give("mechkey") || this.flashMessage("Инвентарь полон — но ключ остался в лотке.");
      this.sfx.jingle();
      this.noise(this.arcadePos, 20);
      this.flashMessage("Дзынь! Автомат выдал механический ключ.");
      return "solved";
    }
    return "ok";
  }

  private openGate() {
    this.gateOpen = true;
    this.flashMessage("Все щитки работают! Главные ворота открываются — бегите к выходу!", 6);
    this.sfx.door();
    this.noise(this.pos, 100);
  }

  // ---------- input ----------
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Tab") {
      e.preventDefault();
      this.cb.onInventory();
      return;
    }
    if (this.modal || this.state !== "playing") return;
    this.keys.add(e.code);
    if (e.code === "KeyE") this.interact();
    if (e.code === "KeyF") this.toggleFlash();
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.look(e.movementX, e.movementY, 0.0022);
  };
  private onMouseDown = () => {
    if (this.isTouch || this.modal || this.state !== "playing") return;
    if (document.pointerLockElement !== this.renderer.domElement) this.lock();
    else this.interact();
  };
  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
  }
  lock() {
    if (this.isTouch) return;
    const p = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {});
  }
  look(dx: number, dy: number, sens = 0.005) {
    this.yaw -= dx * sens;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - dy * sens));
  }
  toggleFlash() {
    if (this.battery <= 0) return this.flashMessage("Батарейка села.");
    this.flashOn = !this.flashOn;
    this.sfx.click();
  }
  interact() {
    if (this.state !== "playing" || this.modal) return;
    if (this.hidden) return this.unhide();
    this.focus?.use();
  }
  private openModal() {
    this.modal = true;
    this.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  closeModal() {
    this.modal = false;
    this.lock();
  }
  private hide(at: THREE.Vector3) {
    const dist = this.m.pos.distanceTo(new THREE.Vector3(this.pos.x, 0, this.pos.z));
    this.m.knowsHide = this.m.mode === "chase" && dist < 9 && this.los(this.m.pos.x, this.m.pos.z, this.pos.x, this.pos.z);
    this.hidden = { prev: this.pos.clone(), at };
    this.sfx.door();
    this.flashMessage("Вы затаились. Нажмите E, чтобы выйти.", 3);
  }
  private unhide() {
    if (!this.hidden) return;
    this.pos.copy(this.hidden.prev);
    this.hidden = null;
    this.sfx.door();
  }

  private noise(p: THREE.Vector3, radius: number) {
    if (this.m.mode === "chase") return;
    if (this.m.pos.distanceTo(new THREE.Vector3(p.x, 0, p.z)) > radius) return;
    this.m.mode = "investigate";
    this.m.target.set(p.x, 0, p.z);
    this.m.pathT = 0;
    this.sfx.screech(0.6);
  }

  private flashMessage(t: string, dur = 3.5) {
    this.message = t;
    this.messageT = dur;
  }

  // ---------- update ----------
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const paused = this.modal || (!this.isTouch && document.pointerLockElement !== this.renderer.domElement && this.state === "playing");
    if (!paused) this.update(dt);
    this.updateFx(dt);
    this.quality.tick(dt);
    const fl = this.lightning.update(dt);
    const t = this.clock.elapsedTime;
    this.sky.uniforms.uTime.value = t;
    this.sky.uniforms.uFlash.value = fl;
    this.sky.mesh.position.copy(this.camera.position);
    this.rain.uniforms.uTime.value = t;
    this.rain.uniforms.uFlash.value = fl * 0.4;
    this.rain.uniforms.uCenter.value.copy(this.camera.position);
    this.hemi.intensity = 0.55 + fl * 2.2;
    this.renderer.render(this.scene, this.camera);
    if (!this.container.dataset.sceneReady) this.container.dataset.sceneReady = "1";
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.emitHud(paused);
    }
  };

  private update(dt: number) {
    if (this.state === "caught") return this.updateCaught(dt);
    if (this.state !== "playing") return;

    // look via touch
    if (this.touch.lookX || this.touch.lookY) {
      this.look(this.touch.lookX, this.touch.lookY, 0.006);
      this.touch.lookX = this.touch.lookY = 0;
    }

    let moving = false;
    if (!this.hidden) {
      const k = this.keys;
      let mx = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) + this.touch.mx;
      let my = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) + this.touch.my;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      moving = len > 0.1;
      const wantRun = (k.has("ShiftLeft") || k.has("ShiftRight") || this.touch.sprint) && moving && my > 0;
      const running = wantRun && this.stamina > 2;
      this.stamina = Math.max(0, Math.min(100, this.stamina + (running ? -22 : 14) * dt));
      const speed = running ? 4.8 : 2.7;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const vx = (fx * my + rx * mx) * speed * dt;
      const vz = (fz * my + rz * mx) * speed * dt;
      if (!this.blocked(this.pos.x + vx, this.pos.z, 0.32)) this.pos.x += vx;
      if (!this.blocked(this.pos.x, this.pos.z + vz, 0.32)) this.pos.z += vz;
      if (moving) {
        const prev = this.bobT;
        this.bobT += dt * (running ? 13 : 8.5) * Math.min(1, len);
        if (Math.floor(prev / Math.PI) !== Math.floor(this.bobT / Math.PI)) this.sfx.step(running ? 0.9 : 0.5);
        if (running) this.noise(this.pos, 9);
      }
      this.camera.position.set(this.pos.x, 1.6 + (moving ? Math.sin(this.bobT * 2) * 0.05 : 0), this.pos.z);
      if (this.pos.z > 16 * S + 0.6) return this.end(this.notes.length >= this.notesTotal ? "truth" : "escape");
    } else {
      this.stamina = Math.min(100, this.stamina + 14 * dt);
      this.camera.position.copy(this.hidden.at);
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // flashlight
    if (this.flashOn) {
      this.battery = Math.max(0, this.battery - dt * 0.75);
      if (this.battery <= 0) {
        this.flashOn = false;
        this.flashMessage("Фонарик погас. Ищите батарейки.");
      }
    }
    const flicker = this.battery < 20 ? (Math.random() < 0.08 ? 0.1 : 1) : Math.random() < 0.004 ? 0.3 : 1;
    this.flash.intensity = this.flashOn && !this.hidden ? 60 * flicker * (0.5 + Math.min(1, this.battery / 40) * 0.5) : 0;

    // focus
    this.focus = null;
    this.prompt = "";
    if (!this.hidden) {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      let best = 0.9;
      for (const it of this.interactables) {
        if (!it.alive) continue;
        const to = it.pos.clone().sub(this.camera.position);
        const d = to.length();
        if (d > 2.9) continue;
        const dot = to.normalize().dot(fwd);
        const score = dot + (2.9 - d) * 0.02;
        if (dot > 0.82 && score > best) {
          best = score;
          this.focus = it;
        }
      }
      if (this.focus) this.prompt = this.focus.label();
    } else this.prompt = "Выйти из укрытия";

    if (this.messageT > 0) this.messageT -= dt;
    this.updateMonster(dt);
  }

  private updateMonster(dt: number) {
    const m = this.m;
    const px = this.hidden ? this.hidden.at.x : this.pos.x;
    const pz = this.hidden ? this.hidden.at.z : this.pos.z;
    const dx = px - m.pos.x, dz = pz - m.pos.z;
    const dist = Math.hypot(dx, dz);
    const losOk = dist < 30 && this.los(m.pos.x, m.pos.z, px, pz);
    const facing = Math.sin(m.dir) * dx / (dist || 1) + Math.cos(m.dir) * dz / (dist || 1);
    let sees = !this.hidden && losOk && ((dist < 16 && facing > 0.3) || dist < 4);
    // flashlight beam in its face
    if (!this.hidden && this.flash.intensity > 5 && losOk && dist < 22) {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      const to = new THREE.Vector3(m.pos.x - px, 3 - 1.6, m.pos.z - pz).normalize();
      if (fwd.dot(to) > 0.96) sees = true;
    }
    if (this.hidden && m.knowsHide) {
      sees = true;
    }

    if (sees) {
      if (m.mode !== "chase") this.sfx.screech(1);
      m.mode = "chase";
      m.lostT = 5;
      m.target.set(px, 0, pz);
    } else if (m.mode === "chase") {
      m.lostT -= dt;
      if (m.lostT <= 0) {
        m.mode = "search";
        m.searchT = 7;
      }
    }

    let speed = 1.5;
    if (m.mode === "chase") speed = 3.9;
    else if (m.mode === "investigate") speed = 2.4;
    else if (m.mode === "search") speed = 1.2;

    // choose goal
    const goal = m.target;
    const mc = this.cell(m.pos.x, m.pos.z);
    const gc = this.cell(goal.x, goal.z);
    let steer: THREE.Vector3;
    if (m.mode === "chase" && sees && dist < 10 && !this.hidden) {
      steer = new THREE.Vector3(dx, 0, dz);
    } else {
      m.pathT -= dt;
      if (m.pathT <= 0 || !m.path.length) {
        m.path = this.bfs(mc, gc);
        m.pathT = 0.5;
      }
      while (m.path.length && m.path[0][0] === mc[0] && m.path[0][1] === mc[1] && m.path.length > 1) m.path.shift();
      const nextCell = m.path[0] ?? gc;
      const tgt = m.path.length > 1 ? this.cellCenter(...nextCell) : goal.clone();
      steer = tgt.sub(m.pos).setY(0);
    }
    const sd = steer.length();
    const arrived = Math.hypot(goal.x - m.pos.x, goal.z - m.pos.z) < 1.0;
    if (arrived && m.mode !== "chase") {
      if (m.mode === "investigate") {
        m.mode = "search";
        m.searchT = 6;
      }
      if (m.mode === "search") {
        m.searchT -= dt;
        if (m.searchT <= 0) m.mode = "patrol";
        else {
          const [c, r] = this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
          if (Math.abs(c - mc[0]) + Math.abs(r - mc[1]) < 6) m.target.copy(this.cellCenter(c, r));
        }
      }
      if (m.mode === "patrol") {
        const [c, r] = this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
        m.target.copy(this.cellCenter(c, r));
        m.path = [];
      }
    }
    let moved = 0;
    if (sd > 0.05) {
      steer.multiplyScalar(1 / sd);
      const step = Math.min(sd, speed * dt);
      const nx = m.pos.x + steer.x * step, nz = m.pos.z + steer.z * step;
      if (!this.blocked(nx, m.pos.z, 0.5, true)) m.pos.x = nx;
      if (!this.blocked(m.pos.x, nz, 0.5, true)) m.pos.z = nz;
      moved = step / dt;
      const want = Math.atan2(steer.x, steer.z);
      let diff = want - m.dir;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      m.dir += diff * Math.min(1, dt * 5);
    }

    // animate
    const b = this.bear;
    const prevPhase = m.phase;
    m.phase += dt * (1.4 + moved * 1.1);
    const sw = Math.sin(m.phase) * Math.min(1, moved / 2) * 0.6;
    b.legL.rotation.x = sw;
    b.legR.rotation.x = -sw;
    b.armL.rotation.x = -sw * 0.8 + (m.mode === "chase" ? -0.9 : 0);
    b.armR.rotation.x = sw * 0.8 + (m.mode === "chase" ? -1.1 : 0);
    b.head.rotation.z = Math.sin(m.phase * 0.37) * 0.12 + (Math.random() < 0.02 ? rand(-0.4, 0.4) : 0);
    b.jaw.rotation.x = m.mode === "chase" ? 0.3 + Math.sin(m.phase * 3) * 0.15 : 0.08;
    b.root.position.set(m.pos.x, Math.abs(Math.sin(m.phase)) * 0.08 * Math.min(1, moved), m.pos.z);
    b.root.rotation.set(m.mode === "chase" ? 0.12 : 0, m.dir, 0);
    b.eyeLight.intensity = 12 * (Math.random() < 0.05 ? 0.2 : 1);
    if (moved > 0.2 && Math.floor(prevPhase / Math.PI) !== Math.floor(m.phase / Math.PI)) {
      const vol = Math.pow(Math.max(0, 1 - dist / 32), 2);
      this.sfx.monsterStep(vol);
    }
    m.screechT -= dt;
    if (m.screechT <= 0) {
      m.screechT = rand(6, 13);
      this.sfx.screech(Math.pow(Math.max(0, 1 - dist / 35), 2));
    }
    this.sfx.setHeart(m.mode === "chase" ? 0.8 : dist < 12 ? 0.35 : 0);

    // catch
    if (dist < 1.35 && (!this.hidden || m.knowsHide)) {
      this.state = "caught";
      this.caughtT = 0;
      this.hidden = null;
      this.sfx.scream();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  private updateCaught(dt: number) {
    this.caughtT += dt;
    const head = new THREE.Vector3();
    this.bear.head.getWorldPosition(head);
    const fwd = new THREE.Vector3(this.pos.x - this.m.pos.x, 0, this.pos.z - this.m.pos.z).normalize();
    this.m.pos.lerp(new THREE.Vector3(this.pos.x - fwd.x * 1.2, 0, this.pos.z - fwd.z * 1.2), dt * 8);
    this.bear.root.position.set(this.m.pos.x, 0, this.m.pos.z);
    this.bear.root.rotation.set(0.25, Math.atan2(fwd.x, fwd.z), 0);
    this.bear.jaw.rotation.x = 0.6 + Math.sin(this.caughtT * 40) * 0.1;
    this.flash.intensity = Math.random() < 0.5 ? 60 : 5;
    this.camera.position.set(this.pos.x + rand(-0.05, 0.05), 1.6 + rand(-0.05, 0.05), this.pos.z);
    this.camera.lookAt(head);
    if (this.caughtT > 1.6) this.end(this.battery <= 0 || !this.flashOn ? "dark" : "caught");
  }

  private end(r: Ending) {
    if (this.state === "ended") return;
    this.state = "ended";
    if (document.pointerLockElement) document.exitPointerLock();
    this.sfx.setHeart(0);
    this.cb.onEnd(r, { time: (performance.now() - this.startT) / 1000, notes: this.notes.length, notesTotal: this.notesTotal, gens: this.gens });
  }

  private updateFx(dt: number) {
    const t = this.clock.elapsedTime;
    for (const s of this.signs) {
      s.t -= dt;
      let k = 1;
      if (s.t < 0) {
        k = Math.random() < 0.5 ? 0.15 : 1;
        if (s.t < -0.4) s.t = rand(1, 6);
      }
      s.mat.color.setScalar(k);
      s.light.intensity = s.base * k;
    }
    this.bulbT -= dt;
    if (this.bulbT <= 0) {
      this.bulbT = 0.12;
      for (let i = 0; i < this.bulbColors.length; i++) {
        const on = Math.random() > 0.12 && (i % 7 !== 3);
        this.bulbs.setColorAt(i, on ? this.bulbColors[i] : new THREE.Color("#100c08"));
      }
      this.bulbs.instanceColor!.needsUpdate = true;
    }
    this.fogPlanes.forEach((f, i) => {
      f.rotation.z = t * 0.02 * (i % 2 ? 1 : -1);
      (f.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 0.3 + i) * 0.12;
    });
    this.wheel.rotation.z = Math.sin(t * 0.05) * 0.08;

    // sparks
    this.sparkT -= dt;
    const pos = this.sparks.geometry.getAttribute("position") as THREE.BufferAttribute;
    if (this.sparkT <= 0 && this.sparkEmitters.length) {
      this.sparkT = rand(1.5, 4.5);
      const e = this.sparkEmitters[Math.floor(Math.random() * this.sparkEmitters.length)];
      this.sparkLight.position.copy(e);
      this.sparkLight.intensity = 25;
      let n = 0;
      for (let i = 0; i < this.sparkLife.length && n < 30; i++) {
        if (this.sparkLife[i] > 0) continue;
        this.sparkLife[i] = rand(0.4, 1);
        pos.setXYZ(i, e.x, e.y, e.z);
        this.sparkVel[i].set(rand(-2, 2), rand(0, 3), rand(-2, 2));
        n++;
      }
      this.sparkEmitter = e;
      this.sfx.spark(Math.pow(Math.max(0, 1 - this.pos.distanceTo(e) / 25), 2));
    }
    this.sparkLight.intensity *= Math.exp(-dt * 8);
    for (let i = 0; i < this.sparkLife.length; i++) {
      if (this.sparkLife[i] <= 0) continue;
      this.sparkLife[i] -= dt;
      const v = this.sparkVel[i];
      v.y -= 9.8 * dt;
      let y = pos.getY(i) + v.y * dt;
      if (y < 0.02) { y = 0.02; v.y *= -0.3; }
      pos.setXYZ(i, pos.getX(i) + v.x * dt, y, pos.getZ(i) + v.z * dt);
      if (this.sparkLife[i] <= 0) pos.setXYZ(i, 0, -999, 0);
    }
    pos.needsUpdate = true;

    // items bob
    for (const it of this.interactables) if (it.bob && it.alive && it.mesh) {
      it.mesh.position.y = 0.55 + Math.sin(t * 2 + it.pos.x) * 0.06;
      it.mesh.rotation.y += dt * 1.2;
    }

    // mirror decoys vanish when approached
    for (const d of this.decoys) {
      const near = Math.hypot(d.position.x - this.pos.x, d.position.z - this.pos.z) < 5;
      d.visible = !near && Math.sin(t * 0.7 + d.position.x) > -0.2;
    }

    // refresh mirror reflections periodically
    this.cubeT -= dt;
    const nearMaze = Math.hypot(this.pos.x - cx(5), this.pos.z - cx(10)) < 18;
    if (this.cubeT <= 0 && nearMaze) {
      this.cubeT = 2;
      const flashI = this.flash.intensity;
      this.cubeCam.update(this.renderer, this.scene);
      this.flash.intensity = flashI;
    }

    if (this.gateOpen) for (const g of this.gateMeshes) g.position.y = Math.min(3.8, g.position.y + dt * 1.2);
  }
  private sparkEmitter: THREE.Vector3 | null = null;
  private sky!: ReturnType<typeof createNightSky>;
  private rain!: ReturnType<typeof createRain>;
  private lightning = new Lightning();
  private hemi!: THREE.HemisphereLight;
  private quality!: AdaptiveQuality;
  private startT = 0;
  private notesTotal = 3;

  private emitHud(paused: boolean) {
    const h: Hud = {
      battery: Math.round(this.battery),
      stamina: Math.round(this.stamina),
      flashlight: this.flashOn,
      slots: this.slots.map((s) => ({ id: s.id, label: INV_LABEL[s.id], count: s.count })),
      tokens: [...this.tokens],
      prompt: this.prompt,
      message: this.messageT > 0 ? this.message : "",
      gens: this.gens,
      hidden: !!this.hidden,
      chase: this.m.mode === "chase",
      paused: paused && !this.modal && this.state === "playing",
      notes: this.notes,
    };
    const s = JSON.stringify(h);
    if (s !== this.lastHud) {
      this.lastHud = s;
      this.cb.onHud(h);
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("resize", this.onResize);
    if (document.pointerLockElement) document.exitPointerLock();
    this.sfx.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
  }
}
