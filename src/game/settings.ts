export type Graphics = "low" | "medium" | "high";

export interface GfxPreset {
  label: string;
  dpr: number; // max pixel ratio
  minDpr: number;
  aa: boolean;
  shadows: boolean;
  shadowMap: number;
  rain: number;
  cube: number; // mirror reflection resolution
  cubeEvery: number; // seconds between mirror refreshes
  fogPlanes: boolean;
  sparks: boolean;
  drawDist: number;
}

export const GFX: Record<Graphics, GfxPreset> = {
  low: { label: "Низкая", dpr: 0.75, minDpr: 0.45, aa: false, shadows: false, shadowMap: 256, rain: 1200, cube: 32, cubeEvery: 6, fogPlanes: false, sparks: false, drawDist: 70 },
  medium: { label: "Средняя", dpr: 1, minDpr: 0.55, aa: false, shadows: false, shadowMap: 512, rain: 2800, cube: 64, cubeEvery: 3, fogPlanes: true, sparks: true, drawDist: 140 },
  high: { label: "Высокая", dpr: 1.5, minDpr: 0.7, aa: true, shadows: true, shadowMap: 1024, rain: 5500, cube: 128, cubeEvery: 1.5, fogPlanes: true, sparks: true, drawDist: 260 },
};

export const GFX_KEY = "park-graphics";

export function defaultGraphics(): Graphics {
  if (typeof window === "undefined") return "medium";
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (touch) return cores >= 8 ? "medium" : "low";
  return cores >= 6 ? "high" : "medium";
}
