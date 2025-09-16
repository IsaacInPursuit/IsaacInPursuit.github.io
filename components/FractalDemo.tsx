"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

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

function randomSeed() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    "getRandomValues" in globalThis.crypto
  ) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }
  return (Math.random() * 0xffffffff) >>> 0;
}

type RgbColor = { r: number; g: number; b: number };

function parseCssColor(value: string): RgbColor | null {
  const color = value.trim();
  if (!color) return null;

  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return { r, g, b };
    }
  }

  const rgbMatch = color.match(
    /^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (rgbMatch) {
    const clamp = (v: number) => Math.max(0, Math.min(255, v | 0));
    const r = clamp(parseInt(rgbMatch[1], 10));
    const g = clamp(parseInt(rgbMatch[2], 10));
    const b = clamp(parseInt(rgbMatch[3], 10));
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return { r, g, b };
    }
  }

  return null;
}

type FractalControls = {
  enabled: boolean;
  toggle: () => void;
  show: () => void;
  shuffle: () => void;
};

const FractalContext = createContext<FractalControls | null>(null);

function useFractalControlsContext() {
  const ctx = useContext(FractalContext);
  if (!ctx) {
    throw new Error("Fractal controls accessed outside of provider");
  }
  return ctx;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type FractalToggleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  labelWhenOff?: string;
  labelWhenOn?: string;
  variant?: "solid" | "subtle";
};

const baseToggleClasses =
  "rounded-md border px-3 py-1 text-sm backdrop-blur border-neutral-300 dark:border-neutral-700 transition";
const toggleVariantClasses = {
  solid: "bg-white/80 dark:bg-neutral-900/80 hover:bg-white dark:hover:bg-neutral-800",
  subtle: "bg-white/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800",
} as const;

export function FractalToggleButton({
  className,
  labelWhenOff = "Fractal Demo",
  labelWhenOn = "Hide fractal",
  onClick,
  variant = "solid",
  ...rest
}: FractalToggleButtonProps) {
  const { enabled, toggle, show } = useFractalControlsContext();
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (enabled) {
      toggle();
    } else {
      show();
    }
    onClick?.(event);
  };

  return (
    <button
      type="button"
      aria-pressed={enabled}
      {...rest}
      onClick={handleClick}
      className={cx(baseToggleClasses, toggleVariantClasses[variant], className)}
    >
      {enabled ? labelWhenOn : labelWhenOff}
    </button>
  );
}

interface FractalDemoProps {
  children?: ReactNode;
}

export default function FractalDemo({ children }: FractalDemoProps) {
  const [enabled, setEnabled] = useState(false);
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const toggle = useCallback(() => setEnabled((s) => !s), []);
  const show = useCallback(() => setEnabled(true), []);
  const shuffle = useCallback(() => {
    setSeed(randomSeed());
    setEnabled(true);
  }, []);

  const contextValue = useMemo(
    () => ({ enabled, toggle, show, shuffle }),
    [enabled, toggle, show, shuffle],
  );

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
      const width = canvas.width;
      const height = canvas.height;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const styles = getComputedStyle(document.documentElement);
      const bg = styles.getPropertyValue("--fract-bg").trim() || "#0A2239";
      const fgRaw = styles.getPropertyValue("--fract-fg").trim() || "#F2F2F2";
      const fgColor = parseCssColor(fgRaw) ?? { r: 242, g: 242, b: 242 };

      ctx.globalAlpha = 1;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const step = 4 * Math.max(1, Math.round(dpr));
      ctx.fillStyle = `rgb(${fgColor.r}, ${fgColor.g}, ${fgColor.b})`;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const n = noise(x + seed * 0.0003, y + seed * 0.0007);
          const t = (n + 1) / 2;
          ctx.globalAlpha = 0.08 + 0.6 * t;
          ctx.fillRect(x, y, step, step);
        }
      }
      ctx.globalAlpha = 1;

      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        Math.max(width, height) / 1.2,
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.16)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const docEl = document.documentElement;
    let observer: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => render());
      observer.observe(docEl, { attributes: true, attributeFilter: ["class"] });
    }

    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleSchemeChange = () => render();
    if (scheme) {
      if (typeof scheme.addEventListener === "function") {
        scheme.addEventListener("change", handleSchemeChange);
      } else if (typeof scheme.addListener === "function") {
        scheme.addListener(handleSchemeChange);
      }
    }
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      if (wrapRef.current) wrapRef.current.style.transform = "";
      observer?.disconnect();
      if (scheme) {
        if (typeof scheme.removeEventListener === "function") {
          scheme.removeEventListener("change", handleSchemeChange);
        } else if (typeof scheme.removeListener === "function") {
          scheme.removeListener(handleSchemeChange);
        }
      }
    };
  }, [enabled, seed]);

  return (
    <FractalContext.Provider value={contextValue}>
      <>
        {/* Left controls */}
        <div className="fixed top-3 left-3 z-[60] flex gap-2">
          <FractalToggleButton />
          <button
            onClick={shuffle}
            className="rounded-md border px-3 py-1 text-sm bg-white/60 dark:bg-neutral-900/60 backdrop-blur border-neutral-300 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800"
            title="New fractal"
            aria-label="New fractal"
          >
            Shuffle
          </button>
        </div>

        {children}

        {/* Canvas layer */}
        <div
          ref={wrapRef}
          className={`pointer-events-none select-none fixed left-0 right-0 top-[64px] z-[20] transition-opacity duration-150 ${enabled ? "opacity-100" : "opacity-0"}`}
          style={{ willChange: "transform, opacity" }}
        >
          <canvas ref={canvasRef} />
        </div>
      </>
    </FractalContext.Provider>
  );
}
