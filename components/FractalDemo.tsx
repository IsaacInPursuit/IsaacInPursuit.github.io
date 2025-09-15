"use client";
import { useEffect, useRef, useState } from "react";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed: number) {
  const rand = mulberry32(seed);
  const g: { x: number; y: number }[] = [];
  for (let i = 0; i < 256; i++) g.push({ x: rand() * 2 - 1, y: rand() * 2 - 1 });
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = i & 255;
  for (let i = 0; i < 256; i++) {
    const j = (rand() * 256) | 0;
    [perm[i], perm[j]] = [perm[j], perm[i]];
    perm[i + 256] = perm[i];
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);

  function grad(ix: number, iy: number, x: number, y: number) {
    const v = g[perm[(ix + perm[iy & 255]) & 255]];
    return v.x * (x - ix) + v.y * (y - iy);
  }
  function noise2d(x: number, y: number) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const u = fade(x - x0), v = fade(y - y0);
    const n00 = grad(x0, y0, x, y);
    const n10 = grad(x0 + 1, y0, x, y);
    const n01 = grad(x0, y0 + 1, x, y);
    const n11 = grad(x0 + 1, y0 + 1, x, y);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }
  return (x: number, y: number) => {
    let f = 0, amp = 0.5, freq = 0.008;
    for (let o = 0; o < 5; o++) {
      f += amp * noise2d(x * freq, y * freq);
      amp *= 0.5;
      freq *= 2.0;
    }
    return f;
  };
}

export default function FractalDemo() {
  const [enabled, setEnabled] = useState(false);
  const [seed, setSeed] = useState<number>(() => crypto.getRandomValues(new Uint32Array(1))[0] || Date.now());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const noise = makeNoise(seed);

    function resize() {
      const w = window.innerWidth;
      const h = Math.max(360, Math.min(520, window.innerHeight * 0.55));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    }
    const onScroll = () => {
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translateY(${window.scrollY * 0.12}px)`;
      }
    };
    function render() {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const bg = getComputedStyle(document.documentElement).getPropertyValue("--fract-bg").trim() || "#0A2239";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const step = 4 * (dpr | 0);
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const n = noise(x + seed * 0.0003, y + seed * 0.0007);
          const t = (n + 1) / 2;
          const a = 0.08 + 0.6 * t;
          ctx.fillStyle = `rgba(242,242,242,${a})`;
          ctx.fillRect(x, y, step, step);
        }
      }
      const grad = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height) / 1.2);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.16)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      if (wrapRef.current) wrapRef.current.style.transform = "";
    };
  }, [enabled, seed]);

  return (
    <>
      {/* Left controls */}
      <div className="fixed top-3 left-3 z-[60] flex gap-2">
        <button
          onClick={() => setEnabled((s) => !s)}
          className="rounded-md border px-3 py-1 text-sm bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-neutral-300 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800"
        >
          Fractal Demo
        </button>
        <button
          onClick={() => {
            setSeed(crypto.getRandomValues(new Uint32Array(1))[0] || Math.floor(Math.random() * 1e9));
            setEnabled(true);
          }}
          className="rounded-md border px-3 py-1 text-sm bg-white/60 dark:bg-neutral-900/60 backdrop-blur border-neutral-300 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800"
          title="New fractal"
          aria-label="New fractal"
        >
          Shuffle
        </button>
      </div>

      {/* Canvas layer */}
      <div
        ref={wrapRef}
        className={`pointer-events-none select-none fixed left-0 right-0 top-[64px] z-[20] transition-opacity duration-150 ${enabled ? "opacity-100" : "opacity-0"}`}
        style={{ willChange: "transform, opacity" }}
      >
        <canvas ref={canvasRef} />
      </div>
    </>
  );
}
