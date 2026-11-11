import * as THREE from "three";
import { buildBear } from "./models";
import { concreteTexture } from "./textures";
import { createNightSky, createRain, Lightning, AdaptiveQuality } from "./atmosphere";

// Live 3D backdrop for the main menu: the animatronic under a stormy night sky.
export class MenuScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private bear = buildBear();
  private sky = createNightSky(200);
  private rain = createRain(3000, 30, 12);
  private lightning = new Lightning();
  private hemi = new THREE.HemisphereLight("#3a5060", "#120c08", 0.35);
  private rim: THREE.SpotLight;
  private quality: AdaptiveQuality;
  private mouse = new THREE.Vector2();
  private focus = 0; // 0 = idle, 1 = hovered "play" (bear leans in)
  private bulbs: THREE.InstancedMesh;
  private wheel = new THREE.Group();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false });
    this.quality = new AdaptiveQuality(this.renderer, Math.min(window.devicePixelRatio, 1.25), 0.6);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 250);
    this.scene.fog = new THREE.FogExp2("#0a0f14", 0.045);
    this.scene.add(this.sky.mesh, this.rain.mesh, this.hemi);

    const floorTex = concreteTexture();
    floorTex.repeat.set(12, 12);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.25, metalness: 0.4, color: "#55606a" }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // bear on the right third, half-lit from below and behind
    this.bear.root.position.set(1.6, 0, 0);
    this.bear.root.rotation.y = -0.35;
    this.scene.add(this.bear.root);
    this.rim = new THREE.SpotLight("#ff3b2a", 80, 18, 0.6, 0.6, 1.5);
    this.rim.position.set(4, 5, -4);
    this.rim.target = this.bear.root;
    this.scene.add(this.rim);
    const key = new THREE.SpotLight("#9fc4ff", 50, 20, 0.5, 0.8, 1.5);
    key.position.set(-3, 6, 6);
    key.target = this.bear.root;
    this.scene.add(key);
    const moon = new THREE.DirectionalLight("#7f9fb5", 0.4);
    moon.position.copy(this.sky.moonDir).multiplyScalar(50);
    this.scene.add(moon);

    // silhouettes: ferris wheel + fence posts
    const wm = new THREE.MeshBasicMaterial({ color: "#07090c" });
    this.wheel.add(new THREE.Mesh(new THREE.TorusGeometry(14, 0.3, 6, 48), wm));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 28, 4), wm);
      sp.rotation.z = a;
      this.wheel.add(sp);
      const gon = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.5), wm);
      gon.position.set(Math.cos(a) * 14, Math.sin(a) * 14 - 1, 0);
      this.wheel.add(gon);
    }
    const wb = new THREE.Group();
    wb.position.set(-14, 16, -40);
    wb.add(this.wheel);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 20, 5), wm);
      leg.position.set(s * 5, -8, 0);
      leg.rotation.z = s * 0.25;
      wb.add(leg);
    }
    this.scene.add(wb);
    for (let i = 0; i < 16; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), wm);
      post.position.set(-14 + i * 2, 1.2, -9 + Math.sin(i) * 0.4);
      post.rotation.z = (Math.random() - 0.5) * 0.25;
      this.scene.add(post);
    }

    // garland of flickering bulbs
    const n = 28;
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      d.position.set(-6 + t * 14, 4.2 - Math.sin(t * Math.PI) * 1.2, -5);
      d.updateMatrix();
      this.bulbs.setMatrixAt(i, d.matrix);
      this.bulbs.setColorAt(i, new THREE.Color(["#ffcf6b", "#ff4a4a", "#5ad8ff"][i % 3]).multiplyScalar(2));
    }
    this.scene.add(this.bulbs);

    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("resize", this.onResize);
    this.loop();
  }

  setFocus(v: number) { this.focus = v; }

  private onMove = (e: PointerEvent) => {
    this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };
  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private camPos = new THREE.Vector3(0, 2.6, 8);
  private look = new THREE.Vector3(0.6, 2.4, 0);
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.quality.tick(dt);

    const narrow = this.camera.aspect < 1;
    const target = new THREE.Vector3(this.mouse.x * 0.8 + (narrow ? 1.6 : 0), 2.6 - this.mouse.y * 0.4, narrow ? 10.5 : 8 - this.focus * 1.6);
    this.camPos.lerp(target, 1 - Math.exp(-dt * 3));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.look.set(narrow ? 1.6 : 0.6, 2.4, 0));

    // bear: breathing, twitching head, follows the cursor with its eye
    const b = this.bear;
    b.head.rotation.y = THREE.MathUtils.lerp(b.head.rotation.y, this.mouse.x * 0.5 + 0.3, dt * 2);
    b.head.rotation.x = THREE.MathUtils.lerp(b.head.rotation.x, this.mouse.y * 0.25, dt * 2);
    b.head.rotation.z = Math.sin(t * 0.8) * 0.08 + (Math.random() < 0.01 ? (Math.random() - 0.5) * 0.6 : 0);
    b.jaw.rotation.x = 0.06 + this.focus * 0.35 + Math.sin(t * 25) * 0.03 * this.focus;
    b.armR.rotation.x = -0.2 - this.focus * 0.9 + Math.sin(t * 1.3) * 0.05;
    b.armL.rotation.x = Math.sin(t * 1.1) * 0.05;
    b.root.position.y = Math.sin(t * 1.4) * 0.02;
    b.root.rotation.x = this.focus * 0.08;
    b.eyeLight.intensity = (8 + this.focus * 10) * (Math.random() < 0.04 ? 0.2 : 1);

    this.wheel.rotation.z = t * 0.02;
    if (Math.random() < 0.15) {
      const i = Math.floor(Math.random() * 28);
      this.bulbs.setColorAt(i, Math.random() < 0.3 ? new THREE.Color("#100c08") : new THREE.Color(["#ffcf6b", "#ff4a4a", "#5ad8ff"][i % 3]).multiplyScalar(2));
      this.bulbs.instanceColor!.needsUpdate = true;
    }

    const fl = this.lightning.update(dt);
    this.sky.uniforms.uTime.value = t;
    this.sky.uniforms.uFlash.value = fl;
    this.sky.mesh.position.copy(this.camera.position);
    this.rain.uniforms.uTime.value = t;
    this.rain.uniforms.uFlash.value = fl * 0.4;
    this.rain.uniforms.uCenter.value.copy(this.camera.position);
    this.hemi.intensity = 0.35 + fl * 2.5;
    this.rim.intensity = 80 * (Math.random() < 0.02 ? 0.3 : 1);

    this.renderer.render(this.scene, this.camera);
    if (!this.container.dataset.sceneReady) this.container.dataset.sceneReady = "1";
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
}
