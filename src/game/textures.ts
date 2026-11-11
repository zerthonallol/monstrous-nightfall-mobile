import * as THREE from "three";

// All textures are painted procedurally on canvas — no external images.
const r = (a: number, b: number) => a + Math.random() * (b - a);

function mk(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

function toTex(c: HTMLCanvasElement, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function speckle(g: CanvasRenderingContext2D, s: number, n: number, alpha: number, light = false) {
  for (let i = 0; i < n; i++) {
    const v = light ? r(150, 255) : r(0, 60);
    g.fillStyle = `rgba(${v},${v},${v},${r(0, alpha)})`;
    g.fillRect(r(0, s), r(0, s), r(1, 3), r(1, 3));
  }
}

function blotches(g: CanvasRenderingContext2D, s: number, n: number, color: string, maxR: number) {
  for (let i = 0; i < n; i++) {
    const x = r(0, s), y = r(0, s), rad = r(maxR * 0.2, maxR);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, color);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

function streaks(g: CanvasRenderingContext2D, s: number, n: number, color: string) {
  g.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    const x = r(0, s);
    g.lineWidth = r(1, 5);
    g.beginPath();
    g.moveTo(x, r(0, s * 0.3));
    g.lineTo(x + r(-6, 6), r(s * 0.4, s));
    g.stroke();
  }
}

export function brickTexture() {
  const s = 512;
  const [c, g] = mk(s);
  g.fillStyle = "#2a2622";
  g.fillRect(0, 0, s, s);
  const bh = 32, bw = 85;
  for (let y = 0; y < s / bh; y++) {
    const off = y % 2 ? bw / 2 : 0;
    for (let x = -1; x < s / bw + 1; x++) {
      const v = r(0.7, 1.15);
      g.fillStyle = `rgb(${92 * v | 0},${44 * v | 0},${34 * v | 0})`;
      g.fillRect(x * bw + off + 3, y * bh + 3, bw - 6, bh - 6);
    }
  }
  speckle(g, s, 9000, 0.5);
  blotches(g, s, 30, "rgba(10,14,8,0.55)", 90);
  streaks(g, s, 40, "rgba(15,12,8,0.35)");
  // grime at bottom
  const gr = g.createLinearGradient(0, s * 0.6, 0, s);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(12,16,8,0.8)");
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return toTex(c);
}

export function stripeTexture() {
  const s = 512;
  const [c, g] = mk(s);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? "#7a1c1a" : "#b8a882";
    g.fillRect((i * s) / 8, 0, s / 8, s);
  }
  speckle(g, s, 12000, 0.6);
  blotches(g, s, 40, "rgba(40,25,10,0.6)", 80);
  streaks(g, s, 60, "rgba(60,30,10,0.4)");
  // peeled patches
  for (let i = 0; i < 25; i++) {
    g.fillStyle = `rgba(70,62,55,${r(0.6, 0.95)})`;
    g.beginPath();
    const x = r(0, s), y = r(0, s);
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) g.lineTo(x + r(-40, 40), y + r(-30, 30));
    g.fill();
  }
  const gr = g.createLinearGradient(0, s * 0.55, 0, s);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(10,10,5,0.85)");
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return toTex(c);
}

export function concreteTexture() {
  const s = 1024;
  const [c, g] = mk(s);
  g.fillStyle = "#4a4b48";
  g.fillRect(0, 0, s, s);
  blotches(g, s, 120, "rgba(20,22,20,0.35)", 160);
  blotches(g, s, 60, "rgba(120,120,110,0.12)", 120);
  speckle(g, s, 40000, 0.5);
  speckle(g, s, 8000, 0.25, true);
  // cracks
  g.strokeStyle = "rgba(10,10,10,0.7)";
  for (let i = 0; i < 26; i++) {
    let x = r(0, s), y = r(0, s);
    g.lineWidth = r(0.8, 2.2);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      x += r(-25, 25);
      y += r(-25, 25);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // slab seams
  g.strokeStyle = "rgba(15,15,15,0.6)";
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo((i * s) / 4, 0); g.lineTo((i * s) / 4, s); g.stroke();
    g.beginPath(); g.moveTo(0, (i * s) / 4); g.lineTo(s, (i * s) / 4); g.stroke();
  }
  // puddles (dark, will be glossy-ish)
  blotches(g, s, 10, "rgba(5,8,10,0.7)", 110);
  return toTex(c, 8, 8);
}

export function rustTexture() {
  const s = 512;
  const [c, g] = mk(s);
  g.fillStyle = "#3b3a38";
  g.fillRect(0, 0, s, s);
  blotches(g, s, 80, "rgba(120,52,18,0.7)", 90);
  blotches(g, s, 50, "rgba(160,80,30,0.5)", 50);
  blotches(g, s, 30, "rgba(30,20,15,0.6)", 70);
  speckle(g, s, 20000, 0.6);
  streaks(g, s, 50, "rgba(110,45,15,0.45)");
  return toTex(c);
}

export function plushTexture() {
  const s = 512;
  const [c, g] = mk(s);
  g.fillStyle = "#4a3320";
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 26000; i++) {
    const x = r(0, s), y = r(0, s), a = r(-0.4, 0.4) + Math.PI / 2, l = r(3, 9);
    const v = r(0.6, 1.3);
    g.strokeStyle = `rgba(${105 * v | 0},${72 * v | 0},${44 * v | 0},0.5)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  blotches(g, s, 30, "rgba(20,25,10,0.6)", 60); // mold
  blotches(g, s, 14, "rgba(60,10,8,0.5)", 30); // stains
  // stitched tears
  g.strokeStyle = "rgba(20,12,8,0.9)";
  for (let i = 0; i < 8; i++) {
    const x = r(0, s), y = r(0, s), l = r(30, 80);
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + r(-10, 10)); g.stroke();
    g.lineWidth = 1.5;
    for (let k = 0; k < l; k += 8) {
      g.beginPath(); g.moveTo(x + k, y - 5); g.lineTo(x + k + 3, y + 5); g.stroke();
    }
  }
  return toTex(c);
}

export function lockerTexture() {
  const s = 512;
  const [c, g] = mk(s);
  g.fillStyle = "#2f4a45";
  g.fillRect(0, 0, s, s);
  blotches(g, s, 60, "rgba(120,52,18,0.6)", 60);
  speckle(g, s, 15000, 0.5);
  g.fillStyle = "rgba(5,5,5,0.9)";
  for (let i = 0; i < 6; i++) g.fillRect(s * 0.2, 40 + i * 22, s * 0.6, 8);
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 6;
  g.strokeRect(10, 10, s - 20, s - 20);
  streaks(g, s, 30, "rgba(100,40,15,0.5)");
  return toTex(c);
}

export function signTexture(text: string, color: string) {
  const [c, g] = [document.createElement("canvas"), null as unknown as CanvasRenderingContext2D];
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  void g;
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, 1024, 256);
  ctx.font = "bold 130px Impact, 'Arial Black', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  for (const b of [40, 20, 8]) {
    ctx.shadowBlur = b;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeText(text, 512, 132);
  }
  ctx.fillStyle = "#fff8ee";
  ctx.shadowBlur = 10;
  ctx.fillText(text, 512, 132);
  // broken letters: dark smudges
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "rgba(5,5,5,0.85)";
    ctx.fillRect(r(100, 900), r(40, 200), r(20, 60), r(20, 60));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function screenTexture() {
  const [c, g] = mk(256);
  g.fillStyle = "#06120a";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#6cff9a";
  g.font = "bold 28px monospace";
  g.textAlign = "center";
  g.fillText("TOKEN", 128, 80);
  g.fillText("TRIAL", 128, 115);
  g.font = "18px monospace";
  g.fillText("INSERT 3 COINS", 128, 170);
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(0, y, 256, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function fogTexture() {
  const [c, g] = mk(512);
  g.clearRect(0, 0, 512, 512);
  blotches(g, 512, 70, "rgba(170,185,190,0.18)", 140);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 512;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#020306");
  gr.addColorStop(0.45, "#0a1218");
  gr.addColorStop(0.52, "#16201f");
  gr.addColorStop(1, "#050505");
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function paperTexture() {
  const [c, g] = mk(128);
  g.fillStyle = "#cfc6a8";
  g.fillRect(0, 0, 128, 128);
  blotches(g, 128, 8, "rgba(100,70,30,0.4)", 30);
  g.fillStyle = "rgba(30,30,40,0.7)";
  for (let y = 20; y < 110; y += 10) g.fillRect(14, y, r(60, 100), 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
