import { SignInWithGoogle, signOut, useAuth, useMutation, useQuery } from "lakebed/client";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

/* ---------- theme (lifted from fitfurniture, Railway dark) ---------- */
const T = {
  bgDeep: "#0a0a0f", bg: "#0e0e13", card: "#141419", hover: "#1a1a20", elevated: "#1f1f26",
  border: "#2a2a32", borderLight: "#3a3a44", text: "#f5f5f7", textSec: "#a0a0a8", textMuted: "#606068",
  accent: "#4ecdc4", danger: "#ef4444",
};
const TYPE_COLOR: Record<string, string> = {
  bed: "#4A5568", seating: "#78716C", table: "#8B5A2B", storage: "#5C4033", rug: "#9b8f80", tv: "#16161a", plant: "#22543D",
};
const TYPE_Z: Record<string, number> = { rug: 0, seating: 1, table: 2, bed: 3, storage: 3, tv: 3, plant: 4 };
const PALETTE = ["#1C1917", "#44403C", "#78716C", "#A8A29E", "#E7E5E4", "#3D2314", "#5C4033", "#8B5A2B", "#A8896C", "#4A5568", "#1A365D", "#234E52", "#22543D", "#744210"];

/* color shaders (from theme.js) */
function darken(hex: string, p: number) { const n = parseInt(hex.replace("#", ""), 16), a = Math.round(2.55 * p); const R = Math.max(0, (n >> 16) - a), G = Math.max(0, ((n >> 8) & 255) - a), B = Math.max(0, (n & 255) - a); return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`; }
function lighten(hex: string, p: number) { const n = parseInt(hex.replace("#", ""), 16), a = Math.round(2.55 * p); const R = Math.min(255, (n >> 16) + a), G = Math.min(255, ((n >> 8) & 255) + a), B = Math.min(255, (n & 255) + a); return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`; }
const arr = (n: number) => Array.from({ length: Math.max(0, n) });

type Preset = { id: string; label: string; type: string; w: number; h: number; shape: string; subtype?: string; hasBack?: boolean; armrests?: number; mattress?: string; texture?: string };
type Item = { id: string; preset: string; type: string; w: number; h: number; shape: string; color: string; x: number; y: number; rotation: number; subtype?: string; hasBack?: boolean; armrests?: number; mattress?: string; texture?: string };
type Room = { id: string; name: string; slug: string; floorPlan: string; ppi: string; items: string };

const CATALOG: { g: string; items: Preset[] }[] = [
  { g: "Beds", items: [
    { id: "bed_queen", label: "Queen bed", type: "bed", w: 60, h: 80, shape: "rect", mattress: "queen" },
    { id: "bed_king", label: "King bed", type: "bed", w: 76, h: 80, shape: "rect", mattress: "king" },
    { id: "bed_full", label: "Full bed", type: "bed", w: 54, h: 75, shape: "rect", mattress: "full" },
  ] },
  { g: "Seating", items: [
    { id: "sofa3", label: "3-seat sofa", type: "seating", w: 84, h: 36, shape: "rect", subtype: "sofa3", hasBack: true, armrests: 2 },
    { id: "sofa2", label: "Loveseat", type: "seating", w: 60, h: 36, shape: "rect", subtype: "sofa2", hasBack: true, armrests: 2 },
    { id: "armchair", label: "Armchair", type: "seating", w: 36, h: 34, shape: "rect", subtype: "armchair", hasBack: true, armrests: 2 },
    { id: "chair", label: "Chair", type: "seating", w: 20, h: 22, shape: "rect", subtype: "chair", hasBack: true, armrests: 0 },
    { id: "ottoman", label: "Ottoman", type: "seating", w: 48, h: 24, shape: "rect", subtype: "ottoman", hasBack: false, armrests: 0 },
    { id: "stool", label: "Stool", type: "seating", w: 16, h: 16, shape: "round" },
  ] },
  { g: "Tables", items: [
    { id: "table_rect", label: "Dining table", type: "table", w: 60, h: 36, shape: "rect" },
    { id: "table_round", label: "Round table", type: "table", w: 48, h: 48, shape: "round" },
    { id: "coffee", label: "Coffee table", type: "table", w: 48, h: 24, shape: "rect" },
    { id: "desk", label: "Desk", type: "table", w: 48, h: 24, shape: "rect" },
  ] },
  { g: "Storage", items: [
    { id: "dresser", label: "Dresser", type: "storage", w: 36, h: 20, shape: "rect" },
    { id: "bookshelf", label: "Bookshelf", type: "storage", w: 36, h: 12, shape: "rect" },
    { id: "wardrobe", label: "Wardrobe", type: "storage", w: 48, h: 24, shape: "rect" },
  ] },
  { g: "Rugs", items: [
    { id: "rug_rect", label: "Rug 5×8", type: "rug", w: 60, h: 96, shape: "rect", texture: "bordered" },
    { id: "rug_round", label: "Round rug", type: "rug", w: 72, h: 72, shape: "round", texture: "bordered" },
    { id: "rug_stripe", label: "Runner", type: "rug", w: 30, h: 84, shape: "rect", texture: "striped" },
  ] },
  { g: "Decor", items: [
    { id: "tv", label: "TV stand", type: "tv", w: 60, h: 16, shape: "rect" },
    { id: "plant", label: "Plant", type: "plant", w: 18, h: 18, shape: "round" },
  ] },
];

function parseToInches(input: string): number | null {
  const s = String(input).trim().toLowerCase();
  let m = s.match(/(\d+\.?\d*)\s*['′]\s*-?\s*(\d+\.?\d*)\s*["″]?/); if (m) return +m[1] * 12 + +m[2];
  m = s.match(/(\d+\.?\d*)\s*['′]/); if (m) return +m[1] * 12;
  m = s.match(/(\d+\.?\d*)\s*(?:"|″|in)/); if (m) return +m[1];
  m = s.match(/(\d+\.?\d*)\s*m(?:eters?)?(?!\w)/); if (m) return +m[1] * 39.3701;
  m = s.match(/(\d+\.?\d*)\s*cm/); if (m) return +m[1] / 2.54;
  m = s.match(/^(\d+\.?\d*)$/); if (m) return +m[1] * 12; // bare number = feet
  return null;
}
const fmtFt = (inches: number) => { const t = Math.round(inches); const ft = Math.floor(t / 12); const r = t % 12; return r ? `${ft}'${r}"` : `${ft}'`; };

/* ---------- top-down furniture renderer (ported from FurnitureItem.jsx) ---------- */
function PieceArt({ it, w, h }: { it: Item; w: number; h: number }) {
  const c = it.color || "#78716C";
  const round = it.shape === "round";
  const radius: any = round ? "50%" : 5;
  const box = (extra: any, children?: any) => <div style={{ position: "relative", width: w, height: h, ...extra }}>{children}</div>;

  if (it.type === "bed") {
    const headH = Math.max(5, h * 0.15);
    const pillowH = Math.max(5, h * 0.15);
    const pad = Math.max(3, w * 0.08);
    const gap = Math.max(3, w * 0.05);
    const count = it.mattress === "twin" || it.mattress === "twinxl" ? 1 : 2;
    return box({ borderRadius: 4, overflow: "hidden", background: c },
      <>
        <div style={{ position: "absolute", top: headH + pillowH + 4, left: pad, right: pad, bottom: pad, borderRadius: 5, background: lighten(c, 3), border: `1px solid ${darken(c, 8)}` }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: headH, background: "#3a3a42", borderRadius: "4px 4px 0 0" }} />
        <div style={{ position: "absolute", top: headH + 3, left: pad, right: pad, height: pillowH, display: "flex", gap, justifyContent: "center" }}>
          {arr(count).map((_, i) => <div key={i} style={{ flex: 1, background: "#f3f1ea", borderRadius: 5, border: "1px solid #ddd9cf", boxShadow: "inset 0 2px 3px rgba(0,0,0,0.06)" }} />)}
        </div>
      </>);
  }

  if (it.type === "seating") {
    if (round) return box({ borderRadius: "50%", background: c, border: `2px solid ${darken(c, 15)}` },
      <div style={{ position: "absolute", inset: "18%", borderRadius: "50%", background: darken(c, 5), border: `1px solid ${darken(c, 12)}` }} />);
    const backH = it.hasBack !== false ? Math.max(4, h * 0.26) : 0;
    const armW = it.armrests ? Math.max(5, Math.min(w, h) * 0.16) : 0;
    const cushions = it.subtype === "sofa3" ? 3 : it.subtype === "sofa2" ? 2 : 1;
    return box({ borderRadius: 6, overflow: "hidden", background: darken(c, 4) },
      <>
        <div style={{ position: "absolute", top: backH, left: armW, right: armW, bottom: 0, background: c }} />
        {backH > 0 && <div style={{ position: "absolute", top: 0, left: armW, right: armW, height: backH, background: darken(c, 18), display: "flex", gap: 2, padding: 2 }}>
          {arr(cushions).map((_, i) => <div key={i} style={{ flex: 1, background: darken(c, 10), borderRadius: 4, boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.12)" }} />)}
        </div>}
        {armW > 0 && <div style={{ position: "absolute", top: 0, left: 0, width: armW, bottom: 0, background: darken(c, 14), borderRadius: "6px 0 0 6px" }} />}
        {armW > 0 && <div style={{ position: "absolute", top: 0, right: 0, width: armW, bottom: 0, background: darken(c, 14), borderRadius: "0 6px 6px 0" }} />}
        <div style={{ position: "absolute", top: backH + 2, left: armW + 2, right: armW + 2, bottom: 2, display: "flex", gap: 2 }}>
          {arr(cushions).map((_, i) => <div key={i} style={{ flex: 1, background: lighten(c, 3), borderRadius: 4, border: `1px solid ${darken(c, 8)}` }} />)}
        </div>
      </>);
  }

  if (it.type === "table") return box({ borderRadius: radius, background: c, border: `2px solid ${darken(c, 16)}`, boxShadow: "inset 0 0 14px rgba(0,0,0,0.22)" },
    <div style={{ position: "absolute", inset: "16%", borderRadius: round ? "50%" : 3, border: `1px solid ${lighten(c, 7)}`, opacity: 0.5 }} />);

  if (it.type === "storage") return box({ borderRadius: 3, background: c, border: `2px solid ${darken(c, 20)}` },
    <>{[0.28, 0.52, 0.76].map((t) => <div key={t} style={{ position: "absolute", top: `${t * 100}%`, left: "8%", right: "8%", height: 1, background: darken(c, 16) }} />)}</>);

  if (it.type === "rug") {
    const bw = Math.max(3, Math.min(w, h) * 0.06);
    const bg: any = it.texture === "striped"
      ? { background: `repeating-linear-gradient(90deg, ${c}, ${c} 9px, ${darken(c, 9)} 9px, ${darken(c, 9)} 18px)` }
      : { background: c };
    return box({ borderRadius: radius, opacity: 0.92, border: `${bw}px solid ${darken(c, 22)}`, ...bg },
      <div style={{ position: "absolute", inset: Math.max(3, Math.min(w, h) * 0.1), borderRadius: round ? "50%" : 2, border: `1px solid ${darken(c, 12)}` }} />);
  }

  if (it.type === "tv") {
    const screenD = Math.max(3, h * 0.34), standD = h * 0.6;
    return box({},
      <>
        <div style={{ position: "absolute", bottom: 0, left: "16%", right: "16%", height: standD, background: "#26262c", borderRadius: "3px 3px 7px 7px", border: "1px solid #3a3a42" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: screenD, background: c || "#15151a", borderRadius: 2, border: "1px solid #44444c", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "55%", background: "linear-gradient(to bottom, rgba(120,200,255,0.22), transparent)" }} />
        </div>
      </>);
  }

  if (it.type === "plant") return box({},
    <>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#6b4a32", border: "2px solid #4f3623" }} />
      <div style={{ position: "absolute", inset: "13%", borderRadius: "50%", background: "#2f5d3a" }} />
      {[0, 60, 120, 180, 240, 300].map((a, i) => (
        <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: "36%", height: "22%", background: i % 2 ? "#3f7d4f" : "#356b41", borderRadius: "50%", transform: `translate(-50%,-50%) rotate(${a}deg) translateY(-26%)`, boxShadow: "inset 0 0 4px rgba(0,0,0,0.25)" }} />
      ))}
      <div style={{ position: "absolute", inset: "38%", borderRadius: "50%", background: "#4a8a59" }} />
    </>);

  return box({ borderRadius: radius, background: c, border: `1px solid ${darken(c, 14)}` });
}

/* ---------- floor-plan paste: grayscale + downscale -> small base64 ---------- */
async function imageToPlan(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = 400;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { const g = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; }
    ctx.putImageData(d, 0, 0);
    return cv.toDataURL("image/jpeg", 0.4);
  } finally { URL.revokeObjectURL(url); }
}

function slugFromHash(): string {
  let s = window.location.hash.replace(/^#/, "").trim();
  if (!s) { s = "r" + Math.random().toString(36).slice(2, 8); window.location.hash = s; }
  return s;
}
function presetToItem(p: Preset, color: string, x: number, y: number): Item {
  return { id: "i" + Math.random().toString(36).slice(2, 9), preset: p.id, type: p.type, w: p.w, h: p.h, shape: p.shape, color, x, y, rotation: 0, subtype: p.subtype, hasBack: p.hasBack, armrests: p.armrests, mattress: p.mattress, texture: p.texture };
}

const CORNERS = [{ l: "0%", t: "0%" }, { l: "100%", t: "0%" }, { l: "0%", t: "100%" }, { l: "100%", t: "100%" }];

const CSS = `
*{box-sizing:border-box}
.fit-tile{transition:transform .12s ease,border-color .12s ease,background .12s ease}
.fit-tile:hover{transform:translateY(-1px);border-color:${T.accent};background:${T.elevated}}
.fit-tile:active{transform:translateY(0)}
.fit-btn{transition:background .12s,border-color .12s,opacity .12s}
.fit-btn:hover{background:${T.elevated};border-color:${T.borderLight}}
.fit-aside::-webkit-scrollbar{width:9px}
.fit-aside::-webkit-scrollbar-thumb{background:${T.border};border-radius:5px;border:2px solid ${T.card}}
.fit-aside::-webkit-scrollbar-thumb:hover{background:${T.borderLight}}
.fit-swatch{transition:transform .1s ease}
.fit-swatch:hover{transform:scale(1.15)}
.fit-name{transition:background .12s}
.fit-name:focus{background:${T.hover}!important}
input::placeholder{color:${T.textMuted}}
@keyframes fitpulse{0%,100%{opacity:.5}50%{opacity:.95}}
.fit-hint{animation:fitpulse 2.6s ease-in-out infinite}
`;

export function App() {
  const auth = useAuth();
  const rooms = useQuery<Room[]>("rooms");
  const ensureRoom = useMutation<[string], void>("ensureRoom");
  const setFloorPlan = useMutation<[string], void>("setFloorPlan");
  const setPpiM = useMutation<[string], void>("setPpi");
  const addItemM = useMutation<[string], void>("addItem");
  const moveItemM = useMutation<[string], void>("moveItem");
  const patchItemM = useMutation<[string], void>("patchItem");
  const removeItemM = useMutation<[string], void>("removeItem");
  const renameM = useMutation<[string], void>("rename");

  const [slug] = useState(slugFromHash);
  const room = useMemo(() => rooms.find((r) => r.slug === slug), [rooms, slug]);
  const serverItems: Item[] = useMemo(() => { try { return JSON.parse(room?.items || "[]"); } catch { return []; } }, [room?.items]);
  const ppi = Number(room?.ppi) > 0 ? Number(room!.ppi) : 1.6;

  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; sx: number; sy: number; x: number; y: number; active: boolean } | null>(null);
  const [rotating, setRotating] = useState<{ id: string; rotation: number; cx: number; cy: number; start: number; base: number } | null>(null);
  const [calib, setCalib] = useState<{ a?: { x: number; y: number }; b?: { x: number; y: number } } | null>(null);
  const [toast, setToast] = useState("");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 760);
  const [panelOpen, setPanelOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { ensureRoom(slug); }, [slug]);

  // responsive breakpoint
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // favicon + title (Lakebed owns the HTML shell; inject from the client)
  useEffect(() => {
    const href = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='#0e0e13'/><rect x='6' y='6' width='20' height='20' rx='5' fill='url(#g)'/><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='#4ecdc4'/><stop offset='1' stop-color='#2a6b66'/></linearGradient></defs></svg>`);
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.type = "image/svg+xml"; link.href = href;
    document.title = "Fit — furniture planner";
  }, []);

  // paste a screenshot anywhere -> floor plan
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const it = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
      if (!it) return;
      const blob = it.getAsFile(); if (!blob) return;
      setToast("Processing floor plan…");
      const plan = await imageToPlan(blob);
      await setFloorPlan(JSON.stringify({ slug, floorPlan: plan }));
      setToast(`Floor plan set (${Math.round(plan.length / 1024)} KB)`);
      setTimeout(() => setToast(""), 2500);
    };
    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [slug]);

  // global drag — only "real" drags (moved past a threshold) move the item, so a
  // tap just selects and toolbar clicks aren't swallowed (matters on touch/trackpad).
  useEffect(() => {
    if (!drag) return;
    const cv = canvasRef.current; if (!cv) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.buttons === 0) return; // ignore stray moves after release
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      setDrag((d) => d && ({ ...d, x, y, active: d.active || Math.hypot(x - d.sx, y - d.sy) > 4 }));
    };
    const onUp = () => { setDrag((d) => { if (d && d.active) moveItemM(JSON.stringify({ slug, id: d.id, x: Math.round(d.x), y: Math.round(d.y) })); return null; }); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [drag, slug]);

  // global rotate (drag a corner handle)
  useEffect(() => {
    if (!rotating) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.buttons === 0) return;
      const ang = Math.atan2(e.clientY - rotating.cy, e.clientX - rotating.cx);
      let deg = rotating.base + (ang - rotating.start) * 180 / Math.PI;
      deg = Math.round(deg / 3) * 3;
      setRotating((s) => s && ({ ...s, rotation: ((deg % 360) + 360) % 360 }));
    };
    const onUp = () => { setRotating((s) => { if (s) patchItemM(JSON.stringify({ slug, id: s.id, patch: { rotation: s.rotation } })); return null; }); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [rotating, slug]);

  const display = drag?.active ? serverItems.map((it) => (it.id === drag.id ? { ...it, x: drag.x, y: drag.y } : it)) : serverItems;
  const selItem = display.find((i) => i.id === sel) || null;

  function addPreset(p: Preset) {
    const cv = canvasRef.current; const cx = cv ? cv.clientWidth / 2 : 300; const cy = cv ? cv.clientHeight / 2 : 250;
    const item = presetToItem(p, TYPE_COLOR[p.type] || "#78716C", Math.round(cx), Math.round(cy));
    addItemM(JSON.stringify({ slug, item }));
    setSel(item.id);
  }
  function duplicate(it: Item) {
    const copy = { ...it, id: "i" + Math.random().toString(36).slice(2, 9), x: it.x + 28, y: it.y + 28 };
    addItemM(JSON.stringify({ slug, item: copy }));
    setSel(copy.id);
  }
  function onCanvasClick(e: any) {
    if (!calib) { if (e.target === canvasRef.current) setSel(null); return; }
    const r = canvasRef.current!.getBoundingClientRect(); const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!calib.a) setCalib({ a: p });
    else if (!calib.b) {
      const a = calib.a!; const px = Math.hypot(p.x - a.x, p.y - a.y);
      const ans = window.prompt("Real length of that line? (e.g. 10ft, 120in, 3m)", "10ft");
      const inches = ans ? parseToInches(ans) : null;
      if (inches && inches > 0) { setPpiM(JSON.stringify({ slug, ppi: (px / inches).toFixed(3) })); setToast(`Scale set · 1 ft = ${Math.round((px / inches) * 12)} px`); setTimeout(() => setToast(""), 2500); }
      setCalib(null);
    }
  }
  function startDrag(it: Item) { return (e: any) => { e.stopPropagation(); setSel(it.id); const r = canvasRef.current!.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; setDrag({ id: it.id, sx: x, sy: y, x, y, active: false }); }; }
  function startRotate(it: Item) { return (e: any) => { e.stopPropagation(); const r = canvasRef.current!.getBoundingClientRect(); const cx = r.left + it.x, cy = r.top + it.y; setRotating({ id: it.id, rotation: it.rotation, cx, cy, start: Math.atan2(e.clientY - cy, e.clientX - cx), base: it.rotation }); }; }
  function share() { navigator.clipboard?.writeText(window.location.href); setToast("Public link copied — anyone with it can open this room and edit together"); setTimeout(() => setToast(""), 3200); }

  const btn = (extra?: any) => ({ background: T.hover, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", ...extra });

  const asideBase: any = { background: T.card, overflowY: "auto", padding: 14, WebkitOverflowScrolling: "touch" };
  const asideStyle: any = isMobile
    ? { ...asideBase, position: "fixed", top: 52, right: 0, bottom: 0, width: "min(286px, 86vw)", zIndex: 60, transform: panelOpen ? "translateX(0)" : "translateX(102%)", transition: "transform .22s ease", borderLeft: `1px solid ${T.border}`, boxShadow: "-16px 0 44px -16px rgba(0,0,0,0.7)" }
    : { ...asideBase, width: 232, borderLeft: `1px solid ${T.border}`, flexShrink: 0 };

  return (
    <div style={{ minHeight: "100vh", height: "100vh", background: T.bg, color: T.text, fontFamily: "Inter, system-ui, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{CSS}</style>
      {/* header */}
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "9px 12px" : "10px 16px", borderBottom: `1px solid ${T.border}`, background: T.bgDeep, flexShrink: 0, zIndex: 70 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${T.accent}, #2a6b66)`, boxShadow: "0 2px 8px -2px rgba(78,205,196,0.6)" }} />
          {!isMobile && <strong style={{ fontSize: 16, letterSpacing: "-0.02em" }}>Fit</strong>}
        </div>
        <input
          value={room?.name ?? ""}
          placeholder="Untitled room"
          class="fit-name"
          onBlur={(e: any) => renameM(JSON.stringify({ slug, name: e.target.value }))}
          style={{ background: "transparent", border: "none", borderRadius: 6, color: T.textSec, fontSize: 14, outline: "none", padding: "5px 8px", width: isMobile ? 104 : 220, minWidth: 56 }}
        />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: isMobile ? 7 : 10 }}>
          {!isMobile && <span style={{ color: room?.ppi ? T.accent : T.textMuted, fontSize: 12, fontVariantNumeric: "tabular-nums", padding: "3px 9px", borderRadius: 20, background: T.hover, border: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>
            {room?.ppi ? `1 ft = ${Math.round(ppi * 12)} px` : "scale not set"}
          </span>}
          <button class="fit-btn" style={btn()} onClick={() => setCalib(calib ? null : {})}>{calib ? (isMobile ? "Cancel" : "Cancel scale") : (isMobile ? "Scale" : "Set scale")}</button>
          <button class="fit-btn" style={btn({ background: T.accent, color: "#04201e", border: "none", fontWeight: 600 })} onClick={share}>Share</button>
          {isMobile
            ? <button class="fit-btn" style={btn({ fontWeight: 600 })} onClick={() => setPanelOpen((v) => !v)}>Furniture</button>
            : <>
                <div style={{ width: 1, height: 22, background: T.border }} />
                {auth.isGuest ? <SignInWithGoogle /> : <button class="fit-btn" style={btn()} onClick={() => signOut()}>Sign out</button>}
              </>}
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        {/* canvas */}
        <main style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: T.bg, backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`, backgroundSize: "26px 26px" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 38%, transparent 40%, rgba(0,0,0,0.45))", pointerEvents: "none" }} />
          <div ref={canvasRef} onClick={onCanvasClick}
            style={{ position: "absolute", inset: 0, cursor: calib ? "crosshair" : "default" }}>
            {room?.floorPlan && <img src={room.floorPlan} alt="floor plan" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0.85, pointerEvents: "none", filter: "contrast(1.1)" }} />}
            {!room?.floorPlan && display.length === 0 &&
              <div class="fit-hint" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: T.textMuted, pointerEvents: "none" }}>
                <div style={{ fontSize: 34, opacity: 0.55 }}>⌘V</div>
                <div style={{ fontSize: 17, color: T.textSec }}>Paste a screenshot of your floor plan</div>
                <div style={{ fontSize: 13 }}>then “Set scale”, then add furniture from the panel</div>
              </div>}

            {display.map((it) => {
              const w = it.w * ppi, h = it.h * ppi; const isSel = it.id === sel;
              const rot = rotating?.id === it.id ? rotating.rotation : it.rotation;
              return (
                <div key={it.id}
                  onPointerDown={startDrag(it)}
                  style={{
                    position: "absolute", left: it.x, top: it.y, width: w, height: h,
                    transform: `translate(-50%,-50%) rotate(${rot}deg)`, transformOrigin: "center",
                    borderRadius: it.shape === "round" ? "50%" : 6,
                    boxShadow: isSel
                      ? `0 0 0 2px ${T.accent}, 0 0 18px rgba(78,205,196,0.3), 0 10px 24px -8px rgba(0,0,0,0.75)`
                      : "0 6px 16px -8px rgba(0,0,0,0.65)",
                    zIndex: (TYPE_Z[it.type] ?? 3) + (isSel ? 20 : 0),
                    cursor: "grab", touchAction: "none",
                  }}>
                  <PieceArt it={it} w={w} h={h} />
                  {w > 40 && h > 18 && (
                    <span style={{ position: "absolute", bottom: 3, left: "50%", transform: `translateX(-50%) rotate(${-rot}deg)`, fontSize: 9, color: it.type === "rug" ? T.textSec : "rgba(255,255,255,0.82)", textShadow: "0 1px 2px rgba(0,0,0,0.6)", pointerEvents: "none", whiteSpace: "nowrap" }}>
                      {fmtFt(it.w)}×{fmtFt(it.h)}
                    </span>
                  )}
                  {isSel && !calib && CORNERS.map((pos, i) => (
                    <div key={i} onPointerDown={startRotate(it)}
                      style={{ position: "absolute", left: pos.l, top: pos.t, transform: "translate(-50%,-50%)", width: 13, height: 13, borderRadius: "50%", background: T.accent, border: "2px solid #fff", cursor: "grab", boxShadow: "0 2px 4px rgba(0,0,0,0.45)", zIndex: 40, touchAction: "none" }} />
                  ))}
                </div>
              );
            })}

            {calib?.a && <div style={{ position: "absolute", left: calib.a.x - 5, top: calib.a.y - 5, width: 10, height: 10, borderRadius: "50%", background: T.accent, boxShadow: `0 0 0 4px rgba(78,205,196,0.25)` }} />}
          </div>

          {/* selected toolbar */}
          {selItem && !calib && (
            <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: "calc(100vw - 24px)", background: T.elevated, border: `1px solid ${T.borderLight}`, borderRadius: 14, padding: "8px 10px", boxShadow: "0 16px 40px -12px rgba(0,0,0,0.85)" }}>
              <span style={{ fontSize: 12, color: T.textSec, marginLeft: 2, marginRight: 2, whiteSpace: "nowrap" }}>{CATALOG.flatMap((g) => g.items).find((p) => p.id === selItem.preset)?.label ?? "Item"} · {fmtFt(selItem.w)}×{fmtFt(selItem.h)}</span>
              <button class="fit-btn" style={btn({ padding: "6px 9px" })} title="Rotate left" onClick={() => patchItemM(JSON.stringify({ slug, id: selItem.id, patch: { rotation: (selItem.rotation - 15 + 360) % 360 } }))}>⟲</button>
              <button class="fit-btn" style={btn({ padding: "6px 9px" })} title="Rotate right" onClick={() => patchItemM(JSON.stringify({ slug, id: selItem.id, patch: { rotation: (selItem.rotation + 15) % 360 } }))}>⟳</button>
              <div style={{ display: "flex", gap: 4, padding: "0 2px" }}>
                {PALETTE.slice(0, 9).map((c) => (
                  <button key={c} class="fit-swatch" onClick={() => patchItemM(JSON.stringify({ slug, id: selItem.id, patch: { color: c } }))}
                    style={{ width: 18, height: 18, borderRadius: 5, background: c, border: selItem.color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.18)", cursor: "pointer", padding: 0 }} />
                ))}
              </div>
              <button class="fit-btn" style={btn({ padding: "6px 9px" })} title="Duplicate" onClick={() => duplicate(selItem)}>⧉</button>
              <button class="fit-btn" style={btn({ padding: "6px 9px", color: T.danger })} onClick={() => { removeItemM(JSON.stringify({ slug, id: selItem.id })); setSel(null); }}>Delete</button>
            </div>
          )}

          {calib && <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: T.elevated, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, color: T.text, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.8)" }}>{calib.a ? "Click the other end of a known distance" : "Click one end of a known distance on the plan"}</div>}
          {toast && <div style={{ position: "absolute", top: 16, right: 16, maxWidth: "min(320px, calc(100vw - 32px))", background: T.elevated, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, color: T.text, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.8)" }}>{toast}</div>}
        </main>

        {/* catalog — right rail on desktop, slide-in drawer on mobile */}
        {isMobile && panelOpen && <div onClick={() => setPanelOpen(false)} style={{ position: "fixed", left: 0, right: 0, top: 52, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 55 }} />}
        <aside class="fit-aside" style={asideStyle}>
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <strong style={{ fontSize: 14 }}>Furniture</strong>
              <button class="fit-btn" style={btn({ padding: "4px 10px" })} onClick={() => setPanelOpen(false)}>✕</button>
            </div>
          )}
          <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 14px", lineHeight: 1.45 }}>Tap a piece to drop it in, then drag it onto your plan. Drag a corner to rotate.</p>
          {CATALOG.map((grp) => (
            <div key={grp.g} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em", color: T.textMuted, marginBottom: 8, fontWeight: 600 }}>{grp.g}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {grp.items.map((p) => {
                  const k = Math.min(82 / p.w, 42 / p.h);
                  const pw = Math.max(10, p.w * k), ph = Math.max(10, p.h * k);
                  const prev = presetToItem(p, TYPE_COLOR[p.type] || "#78716C", 0, 0);
                  return (
                    <button key={p.id} class="fit-tile" onClick={() => { addPreset(p); if (isMobile) setPanelOpen(false); }} title={`${fmtFt(p.w)} × ${fmtFt(p.h)}`}
                      style={{ background: T.hover, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 6px 7px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: pw, height: ph, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.4))" }}><PieceArt it={prev} w={pw} h={ph} /></div>
                      </div>
                      <div style={{ fontSize: 10.5, color: T.textSec, lineHeight: 1.1, textAlign: "center" }}>{p.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {isMobile && (
            <div style={{ marginTop: 6, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              {auth.isGuest ? <SignInWithGoogle /> : <button class="fit-btn" style={btn()} onClick={() => signOut()}>Sign out</button>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
