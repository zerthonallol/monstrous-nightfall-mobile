import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Ending, EndStats, Game, Hud, Note, TokenColor } from "@/game/Game";
import type { MenuScene } from "@/game/MenuScene";
import { GFX, GFX_KEY, defaultGraphics, type Graphics } from "@/game/settings";
import { TouchControls } from "@/components/game/TouchControls";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Забытый Парк — 3D хоррор" },
      { name: "description", content: "Хоррор от первого лица в заброшенном парке аттракционов под ночным дождём." },
      { property: "og:title", content: "Забытый Парк — 3D хоррор" },
      { property: "og:description", content: "Почините щитки и сбегите от аниматроника. Четыре концовки." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const ENDINGS: Record<Ending, { title: string; tag: string; text: string; tone: string }> = {
  caught: {
    title: "ВАС ПОЙМАЛИ",
    tag: "Концовка 1 из 4 · Новый костюм",
    tone: "text-primary",
    text: "Зазывала Барни нежно поправил на вас соломенную шляпу. Утром охранник заметит у карусели второго аниматроника — новенького, с очень живыми глазами.",
  },
  dark: {
    title: "ТЬМА",
    tag: "Концовка 2 из 4 · Без света",
    tone: "text-muted-foreground",
    text: "Фонарик погас. Вы слышали только дождь и скрип сервоприводов — всё ближе. Последнее, что вы увидели, — один оранжевый глаз в темноте.",
  },
  escape: {
    title: "ВЫ СБЕЖАЛИ",
    tag: "Концовка 3 из 4 · Побег",
    tone: "text-accent",
    text: "Ворота с лязгом закрылись за спиной. Музыка карусели стихла под дождём. Но вы так и не узнали, что случилось в парке в 1987-м… Найдите все записи.",
  },
  truth: {
    title: "ПРАВДА",
    tag: "Концовка 4 из 4 · Истинная",
    tone: "text-truth",
    text: "Вы вынесли кассету и записки. Через неделю газеты пишут о закрытом деле 1987 года, а парк обесточивают навсегда. Последний щиток гаснет — и где-то внутри Барни наконец перестаёт улыбаться.",
  },
};
const SEEN_KEY = "park-endings";
const TOKEN_CLS: Record<TokenColor, string> = { red: "bg-primary", blue: "bg-truth", yellow: "bg-accent" };

function Page() {
  const box = useRef<HTMLDivElement>(null);
  const menuBox = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const menu = useRef<MenuScene | null>(null);
  const [screen, setScreen] = useState<"menu" | "play" | "end">("menu");
  const [panel, setPanel] = useState<"main" | "controls" | "endings" | "graphics">("main");
  const [gfx, setGfx] = useState<Graphics>("medium");
  const [isTouch, setIsTouch] = useState(false);
  const [ending, setEnding] = useState<{ e: Ending; s: EndStats } | null>(null);
  const [seen, setSeen] = useState<Ending[]>([]);
  const [hud, setHud] = useState<Hud | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [arcade, setArcade] = useState<{ open: boolean; left: TokenColor[]; msg: string }>({ open: false, left: [], msg: "" });

  useEffect(() => {
    try { setSeen(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { /* ignore */ }
    const saved = localStorage.getItem(GFX_KEY) as Graphics | null;
    setGfx(saved && saved in GFX ? saved : defaultGraphics());
    setIsTouch(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
  }, []);

  useEffect(() => {
    if (screen === "play" || !menuBox.current) return;
    let alive = true;
    import("@/game/MenuScene").then(({ MenuScene }) => {
      if (alive && menuBox.current) menu.current = new MenuScene(menuBox.current);
    });
    return () => { alive = false; menu.current?.dispose(); menu.current = null; };
  }, [screen]);

  const start = async () => {
    const { Game } = await import("@/game/Game");
    game.current?.dispose();
    setHud(null);
    setScreen("play");
    game.current = new Game(box.current!, {
      onHud: setHud,
      onNote: setNote,
      onArcade: () => setArcade({ open: true, left: [...(game.current?.tokens ?? [])], msg: "Вставьте жетоны в правильном порядке" }),
      onInventory: () => {},
      onEnd: (e, s) => {
        setEnding({ e, s });
        setSeen((prev) => {
          const next = prev.includes(e) ? prev : [...prev, e];
          localStorage.setItem(SEEN_KEY, JSON.stringify(next));
          return next;
        });
        setTimeout(() => { game.current?.dispose(); game.current = null; setScreen("end"); }, 50);
      },
    }, gfx);
    game.current.lock();
  };
  useEffect(() => () => game.current?.dispose(), []);

  const insert = (c: TokenColor) => {
    const g = game.current;
    if (!g) return;
    const r = g.insertToken(c);
    if (r === "wrong") setArcade({ open: true, left: [...g.tokens], msg: "СИРЕНА! Неверный порядок — попробуйте ещё" });
    else if (r === "solved") { setArcade({ open: false, left: [], msg: "" }); g.closeModal(); }
    else setArcade((a) => ({ ...a, left: a.left.filter((x, i) => i !== a.left.indexOf(c)), msg: "Щёлк…" }));
  };

  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 overflow-hidden bg-background font-sans text-foreground">
      <div ref={box} className="absolute inset-0" />

      {screen === "play" && hud && (
        <div className="pointer-events-none absolute inset-0 p-3 text-xs tracking-wide md:p-5 md:text-sm">
          <div className="panel-glass inline-flex flex-col gap-2 rounded px-4 py-3">
            <Bar label="Фонарик" v={hud.battery} cls="bg-accent" />
            <Bar label="Выносливость" v={hud.stamina} cls="bg-truth" />
            <div className="text-muted-foreground">Щитки <span className="text-foreground">{hud.gens}/3</span> · Записи <span className="text-foreground">{hud.notes.length}/3</span></div>
            {hud.slots.length > 0 && <div className="text-muted-foreground">{hud.slots.map((s) => `${s.label}×${s.count}`).join(" · ")}</div>}
          </div>
          {hud.chase && <div className="absolute inset-0 animate-pulse shadow-[inset_0_0_160px_var(--glow)]" />}
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/60" />
          {hud.prompt && <div className={`absolute left-0 w-full text-center text-lg ${isTouch ? "bottom-40" : "bottom-24"}`}><span className="panel-glass rounded px-3 py-1">{isTouch ? "✋" : "[E]"} {hud.prompt}</span></div>}
          {hud.message && <div className="absolute top-28 left-0 w-full px-6 text-center text-sm md:top-16 md:text-lg">{hud.message}</div>}
          {hud.paused && !isTouch && <div className="absolute inset-0 grid place-items-center bg-background/60 font-display text-2xl">Кликните, чтобы продолжить</div>}
        </div>
      )}

      {screen === "play" && hud && isTouch && !note && !arcade.open && (
        <TouchControls game={game} prompt={hud.prompt} flashlight={hud.flashlight} />
      )}

      {note && (
        <div className="absolute inset-0 grid place-items-center bg-background/80 p-4">
          <div className="panel-glass fade-up max-w-md rounded p-6 whitespace-pre-line">
            <h2 className="mb-3 font-display text-xl">{note.title}</h2>
            {note.text}
            <button className="mt-5 block text-accent underline" onClick={() => { setNote(null); game.current?.closeModal(); }}>Закрыть</button>
          </div>
        </div>
      )}

      {arcade.open && (
        <div className="absolute inset-0 grid place-items-center bg-background/80 p-4">
          <div className="panel-glass fade-up w-full max-w-sm rounded p-6 text-center">
            <h2 className="font-display text-2xl">TOKEN TRIAL</h2>
            <p className="mt-2 text-muted-foreground">{arcade.msg}</p>
            <div className="mt-5 flex justify-center gap-4">
              {arcade.left.map((c, i) => (
                <button key={i} aria-label={`Жетон ${c}`} onClick={() => insert(c)} className={`h-14 w-14 rounded-full border-4 border-foreground/30 transition-transform hover:scale-110 ${TOKEN_CLS[c]}`} />
              ))}
            </div>
            <button className="mt-6 text-accent underline" onClick={() => { setArcade({ open: false, left: [], msg: "" }); game.current?.closeModal(); }}>Отойти</button>
          </div>
        </div>
      )}

      {screen !== "play" && (
        <div className="absolute inset-0">
          <div ref={menuBox} className="absolute inset-0" />
          <div className="vignette pointer-events-none absolute inset-0" />
          <div className="menu-stage absolute inset-0 flex items-center px-6 md:px-16">
            <div className="menu-panel fade-up w-full max-w-md">
              {screen === "end" && ending ? (
                <>
                  <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{ENDINGS[ending.e].tag}</p>
                  <h1 className={`title-3d mt-2 text-5xl md:text-6xl ${ENDINGS[ending.e].tone}`}>{ENDINGS[ending.e].title}</h1>
                  <p className="mt-5 text-lg leading-relaxed text-foreground/85">{ENDINGS[ending.e].text}</p>
                  <p className="mt-4 text-sm text-muted-foreground">Время {fmt(ending.s.time)} · Щитки {ending.s.gens}/3 · Записи {ending.s.notes}/{ending.s.notesTotal} · Открыто концовок {seen.length}/4</p>
                  <nav className="mt-8">
                    <MenuItem onClick={start} onHover={(v) => menu.current?.setFocus(v)}>Ещё раз</MenuItem>
                    <MenuItem onClick={() => { setScreen("menu"); setPanel("main"); }}>В меню</MenuItem>
                  </nav>
                </>
              ) : (
                <>
                  <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Парк «Весёлые Горки» · 1987</p>
                  <h1 className="title-3d mt-3 text-6xl md:text-7xl">ЗАБЫТЫЙ<br />ПАРК</h1>
                  {panel === "main" && (
                    <nav className="mt-10">
                      <MenuItem onClick={start} onHover={(v) => menu.current?.setFocus(v)}>Играть</MenuItem>
                      <MenuItem onClick={() => setPanel("controls")}>Управление</MenuItem>
                      <MenuItem onClick={() => setPanel("graphics")}>Графика: {GFX[gfx].label}</MenuItem>
                      <MenuItem onClick={() => setPanel("endings")}>Концовки {seen.length}/4</MenuItem>
                    </nav>
                  )}
                  {panel === "controls" && (
                    <div className="mt-8 space-y-1 text-lg text-foreground/85">
                      {isTouch ? (<>
                        <p>Левая часть экрана — джойстик</p>
                        <p>Правая часть — свайп, чтобы осмотреться</p>
                        <p>✋ действие · 🏃 бег · 🔦 фонарик</p>
                      </>) : (<>
                        <p>WASD — идти, Shift — бежать</p>
                        <p>Мышь — осмотреться, E / клик — действие</p>
                        <p>F — фонарик</p>
                      </>)}
                      <p className="pt-2 text-muted-foreground">Почините 3 щитка и выберитесь через ворота. Свет и шум привлекают Зазывалу.</p>
                      <MenuItem onClick={() => setPanel("main")}>Назад</MenuItem>
                    </div>
                  )}
                  {panel === "graphics" && (
                    <div className="mt-8 space-y-3">
                      {(Object.keys(GFX) as Graphics[]).map((k) => (
                        <button
                          key={k}
                          onClick={() => { setGfx(k); localStorage.setItem(GFX_KEY, k); }}
                          className={`panel-glass block w-full rounded px-4 py-3 text-left transition-colors ${gfx === k ? "border border-accent text-accent" : "text-foreground/85"}`}
                        >
                          <div className="font-display text-lg">{GFX[k].label}</div>
                          <div className="text-sm text-muted-foreground">
                            {k === "low" && "Для слабых телефонов: без теней и тумана, меньше дождя"}
                            {k === "medium" && "Баланс: туман, искры, чёткая картинка"}
                            {k === "high" && "Тени, сглаживание, плотный дождь, отражения"}
                          </div>
                        </button>
                      ))}
                      <MenuItem onClick={() => setPanel("main")}>Назад</MenuItem>
                    </div>
                  )}
                  {panel === "endings" && (
                    <div className="mt-8 space-y-3">
                      {(Object.keys(ENDINGS) as Ending[]).map((k) => (
                        <div key={k} className="panel-glass rounded px-4 py-2">
                          <div className={`font-display ${seen.includes(k) ? ENDINGS[k].tone : "text-muted-foreground"}`}>{seen.includes(k) ? ENDINGS[k].title : "???"}</div>
                          <div className="text-sm text-muted-foreground">{ENDINGS[k].tag}</div>
                        </div>
                      ))}
                      <MenuItem onClick={() => setPanel("main")}>Назад</MenuItem>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, onHover }: { children: React.ReactNode; onClick: () => void; onHover?: (v: number) => void }) {
  return (
    <button className="menu-item" onClick={onClick} onMouseEnter={() => onHover?.(1)} onMouseLeave={() => onHover?.(0)} onFocus={() => onHover?.(1)} onBlur={() => onHover?.(0)}>
      {children}
    </button>
  );
}

function Bar({ label, v, cls }: { label: string; v: number; cls: string }) {
  return (
    <div className="w-44">
      <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{v}%</span></div>
      <div className="mt-1 h-1.5 rounded bg-muted"><div className={`h-full rounded ${cls}`} style={{ width: `${v}%` }} /></div>
    </div>
  );
}
