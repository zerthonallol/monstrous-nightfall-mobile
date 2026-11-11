import * as THREE from "three";

// Shared night sky + rain + lightning. Each is a single draw call; all motion runs on the GPU.

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFrag = /* glsl */ `
uniform float uTime;
uniform float uFlash;
uniform vec3 uMoonDir;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);
  vec3 col = mix(vec3(0.035,0.045,0.07), vec3(0.006,0.008,0.02), smoothstep(0.0, 0.6, h));
  col = mix(vec3(0.05,0.045,0.05), col, smoothstep(-0.05, 0.12, h)); // horizon haze
  // stars
  vec3 sp = d * 260.0;
  vec3 cell = floor(sp);
  float s = hash(cell);
  float star = step(0.985, s) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5));
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 4.0) + s * 50.0);
  col += vec3(0.8,0.85,1.0) * star * tw * smoothstep(0.02, 0.25, h) * 1.4;
  // milky band
  float band = exp(-pow(dot(d, normalize(vec3(0.4,0.5,-0.7))) * 4.0, 2.0));
  col += vec3(0.05,0.06,0.09) * band * fbm(d.xz * 6.0) * smoothstep(0.0,0.3,h);
  // moon
  float md = dot(d, uMoonDir);
  float disc = smoothstep(0.9993, 0.9996, md);
  float crater = fbm(d.xy * 400.0) * 0.35;
  col = mix(col, vec3(0.92,0.9,0.82) - crater, disc);
  col += vec3(0.35,0.42,0.5) * pow(max(md, 0.0), 300.0) * 0.6;
  col += vec3(0.12,0.15,0.2) * pow(max(md, 0.0), 12.0) * 0.25;
  // clouds
  vec2 uv = d.xz / (h + 0.25) * 1.4 + vec2(uTime * 0.012, uTime * 0.004);
  float c = smoothstep(0.45, 0.85, fbm(uv));
  vec3 cloudCol = vec3(0.04,0.045,0.06) + vec3(0.25,0.3,0.4) * pow(max(md,0.0), 20.0) * 0.4;
  cloudCol += vec3(0.55,0.6,0.8) * uFlash;
  col = mix(col, cloudCol, c * smoothstep(-0.02, 0.15, h) * 0.85);
  col += vec3(0.25,0.28,0.4) * uFlash * 0.35;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createNightSky(radius = 230) {
  const uniforms = {
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(-0.42, 0.42, -0.8).normalize() },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms, moonDir: uniforms.uMoonDir.value };
}

const rainVert = /* glsl */ `
uniform float uTime;
uniform vec3 uCenter;
uniform float uSize;
uniform float uHeight;
attribute float aEnd;
attribute float aSpeed;
varying float vA;
void main(){
  vec3 p = position;
  float y = mod(p.y - uTime * aSpeed, uHeight);
  vec3 w;
  w.x = uCenter.x + mod(p.x - uCenter.x + uSize * 0.5, uSize) - uSize * 0.5;
  w.z = uCenter.z + mod(p.z - uCenter.z + uSize * 0.5, uSize) - uSize * 0.5;
  w.y = y + aEnd * 0.45 + uCenter.y - 2.0;
  w.x += aEnd * 0.06; // wind slant
  vA = mix(0.0, 1.0, aEnd);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const rainFrag = /* glsl */ `
uniform float uFlash;
varying float vA;
void main(){
  gl_FragColor = vec4(vec3(0.6,0.68,0.8) + uFlash, 0.08 + vA * 0.22);
}`;

export function createRain(count = 5000, size = 40, height = 14) {
  const pos = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  const speed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size, y = Math.random() * height, z = Math.random() * size;
    const s = 14 + Math.random() * 6;
    pos.set([x, y, z, x, y, z], i * 6);
    end[i * 2] = 0;
    end[i * 2 + 1] = 1;
    speed[i * 2] = speed[i * 2 + 1] = s;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
  g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  const uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSize: { value: size }, uHeight: { value: height }, uFlash: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: rainVert, fragmentShader: rainFrag, transparent: true, depthWrite: false });
  const mesh = new THREE.LineSegments(g, mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/** Random lightning: returns flash 0..1 each tick. */
export class Lightning {
  private t = 6 + Math.random() * 8;
  private seq: number[] = [];
  flash = 0;
  thunder: ((delay: number, vol: number) => void) | null = null;
  update(dt: number) {
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 9 + Math.random() * 14;
      this.seq = [0.08, 0.06, 0.12, 0.05, 0.25].slice(0, 2 + Math.floor(Math.random() * 3));
      const dist = Math.random();
      this.thunder?.(0.4 + dist * 2.5, 1 - dist * 0.6);
    }
    if (this.seq.length) {
      this.seq[0] -= dt;
      this.flash = this.seq.length % 2 ? 1 : 0.15;
      if (this.seq[0] <= 0) this.seq.shift();
    } else this.flash *= Math.exp(-dt * 10);
    return this.flash;
  }
}

/** Keeps frame time in budget by scaling render resolution (and shadows as a last resort). */
export class AdaptiveQuality {
  private acc = 0;
  private frames = 0;
  ratio: number;
  constructor(private renderer: THREE.WebGLRenderer, private max: number, private min = 0.55) {
    this.ratio = max;
    renderer.setPixelRatio(max);
  }
  tick(dt: number) {
    this.acc += dt;
    this.frames++;
    if (this.acc < 1.5) return;
    const avg = this.acc / this.frames;
    this.acc = 0;
    this.frames = 0;
    let r = this.ratio;
    if (avg > 1 / 45) r = Math.max(this.min, r - 0.15);
    else if (avg < 1 / 58) r = Math.min(this.max, r + 0.05);
    if (r !== this.ratio) {
      this.ratio = r;
      this.renderer.setPixelRatio(r);
    }
  }
}
