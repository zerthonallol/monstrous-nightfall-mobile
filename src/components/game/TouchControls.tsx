import { useRef, useState } from "react";
import type { Game } from "@/game/Game";

type Props = { game: React.MutableRefObject<Game | null>; prompt: string; flashlight: boolean };

const R = 56; // joystick radius in px

export function TouchControls({ game, prompt, flashlight }: Props) {
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [sprint, setSprint] = useState(false);

  const onStart = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < window.innerWidth * 0.45 && stickId.current === null) {
        stickId.current = t.identifier;
        origin.current = { x: t.clientX, y: t.clientY };
        setKnob({ x: 0, y: 0, ox: t.clientX, oy: t.clientY });
      } else if (lookId.current === null) {
        lookId.current = t.identifier;
        last.current = { x: t.clientX, y: t.clientY };
      }
    }
  };
  const onMove = (e: React.TouchEvent) => {
    const g = game.current;
    if (!g) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickId.current) {
        let dx = t.clientX - origin.current.x, dy = t.clientY - origin.current.y;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        g.touch.mx = dx / R;
        g.touch.my = -dy / R;
        setKnob((k) => (k ? { ...k, x: dx, y: dy } : k));
      } else if (t.identifier === lookId.current) {
        g.touch.lookX += (t.clientX - last.current.x) * 1.4;
        g.touch.lookY += (t.clientY - last.current.y) * 1.4;
        last.current = { x: t.clientX, y: t.clientY };
      }
    }
  };
  const onEnd = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickId.current) {
        stickId.current = null;
        setKnob(null);
        if (game.current) { game.current.touch.mx = 0; game.current.touch.my = 0; }
      } else if (t.identifier === lookId.current) lookId.current = null;
    }
  };

  const tap = (fn: () => void) => (e: React.TouchEvent) => { e.stopPropagation(); e.preventDefault(); fn(); };
  const toggleSprint = () => {
    const v = !sprint;
    setSprint(v);
    if (game.current) game.current.touch.sprint = v;
  };

  return (
    <div className="touch-layer absolute inset-0 select-none" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
      {knob ? (
        <div className="touch-stick" style={{ left: knob.ox - R, top: knob.oy - R, width: R * 2, height: R * 2 }}>
          <div className="touch-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      ) : (
        <div className="touch-stick touch-stick-hint" style={{ left: 40, bottom: 40, width: R * 2, height: R * 2 }}>
          <div className="touch-knob" />
        </div>
      )}
      <div className="absolute bottom-8 right-6 flex flex-col items-end gap-3">
        <button className={`touch-btn ${flashlight ? "touch-btn-on" : ""}`} aria-label="Фонарик" onTouchStart={tap(() => game.current?.toggleFlash())}>🔦</button>
        <div className="flex items-end gap-3">
          <button className={`touch-btn ${sprint ? "touch-btn-on" : ""}`} aria-label="Бег" onTouchStart={tap(toggleSprint)}>🏃</button>
          <button className={`touch-btn touch-btn-lg ${prompt ? "touch-btn-on" : ""}`} aria-label="Действие" onTouchStart={tap(() => game.current?.interact())}>✋</button>
        </div>
      </div>
    </div>
  );
}
