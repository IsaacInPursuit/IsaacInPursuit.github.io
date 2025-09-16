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

const MODE_STORAGE_KEY = "fractaldemo:mode";
const FRACTAL_MODES = ["aurora", "kaleidoscope", "golden"] as const;
export type FractalMode = (typeof FRACTAL_MODES)[number];

const FRACTAL_MODE_LABELS: Record<FractalMode, string> = {
  aurora: "Aurora drift",
  kaleidoscope: "Kaleidoscope",
  golden: "Golden bloom",
};

const FRACTAL_MODE_DESCRIPTIONS: Record<FractalMode, string> = {
  aurora: "Layered aurora noise fields",
  kaleidoscope: "Mirrored sacred-geometry kaleidoscope",
  golden: "Golden-ratio phyllotaxis and branching tree",
};

function isFractalMode(value: string): value is FractalMode {
  return (FRACTAL_MODES as readonly string[]).includes(value);
}

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
  mode: FractalMode;
  setMode: (mode: FractalMode) => void;
  cycleMode: () => void;
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

export type FractalModeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
>;

export function FractalModeButton({
  className,
  onClick,
  title,
  ...rest
}: FractalModeButtonProps) {
  const { mode, cycleMode } = useFractalControlsContext();
  const label = `Mode: ${FRACTAL_MODE_LABELS[mode]}`;
  const buttonTitle = title ?? `Switch fractal style – ${FRACTAL_MODE_DESCRIPTIONS[mode]}`;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    cycleMode();
    onClick?.(event);
  };

  return (
    <button
      type="button"
      {...rest}
      onClick={handleClick}
      title={buttonTitle}
      className={cx(baseToggleClasses, toggleVariantClasses.subtle, className)}
      aria-label={label}
      data-mode={mode}
    >
      {label}
    </button>
  );
}

interface FractalDemoProps {
  children?: ReactNode;
}

export default function FractalDemo({ children }: FractalDemoProps) {
  const [enabled, setEnabled] = useState(false);
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [mode, setModeState] = useState<FractalMode>("aurora");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const toggle = useCallback(() => setEnabled((s) => !s), []);
  const show = useCallback(() => setEnabled(true), []);
  const shuffle = useCallback(() => {
    setSeed(randomSeed());
    setEnabled(true);
  }, []);

  const persistMode = useCallback((value: FractalMode) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, value);
    } catch {
      // ignore write failures (e.g., private mode)
    }
  }, []);

  const setMode = useCallback(
    (value: FractalMode) => {
      setModeState(value);
      setEnabled(true);
      persistMode(value);
    },
    [persistMode],
  );

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const index = FRACTAL_MODES.indexOf(current);
      const next = FRACTAL_MODES[(index + 1) % FRACTAL_MODES.length];
      persistMode(next);
      return next;
    });
    setEnabled(true);
  }, [persistMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored && isFractalMode(stored)) {
        setModeState(stored);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const contextValue = useMemo(
    () => ({ enabled, toggle, show, shuffle, mode, setMode, cycleMode }),
    [enabled, toggle, show, shuffle, mode, setMode, cycleMode],
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
    function renderAurora(viewWidth: number, viewHeight: number, fgColor: RgbColor) {
      const step = (4 * Math.max(1, Math.round(dpr))) / dpr;
      ctx.save();
      ctx.fillStyle = `rgb(${fgColor.r}, ${fgColor.g}, ${fgColor.b})`;
      for (let y = 0; y < viewHeight; y += step) {
        for (let x = 0; x < viewWidth; x += step) {
          const sampleX = x * dpr;
          const sampleY = y * dpr;
          const n = noise(sampleX + seed * 0.0003, sampleY + seed * 0.0007);
          const t = (n + 1) / 2;
          ctx.globalAlpha = 0.08 + 0.6 * t;
          ctx.fillRect(x, y, step, step);
        }
      }
      ctx.restore();
    }

    function renderKaleidoscope(
      viewWidth: number,
      viewHeight: number,
      fgColor: RgbColor,
    ) {
      const step = Math.max(2.5, (3.5 * Math.max(1, Math.round(dpr))) / dpr);
      const centerX = viewWidth / 2;
      const centerY = viewHeight / 2;
      const segmentAngle = (Math.PI * 2) / 6;
      const paletteShift = ((seed % 720) / 720) * 360;

      ctx.save();

      for (let y = 0; y < viewHeight; y += step) {
        for (let x = 0; x < viewWidth; x += step) {
          const dx = x - centerX;
          const dy = y - centerY;
          const radius = Math.hypot(dx, dy);
          let angle = Math.atan2(dy, dx);
          if (Number.isNaN(angle)) angle = 0;
          angle = angle % segmentAngle;
          if (angle < 0) angle += segmentAngle;
          if (angle > segmentAngle / 2) angle = segmentAngle - angle;

          const mirrorX = Math.cos(angle) * radius;
          const mirrorY = Math.sin(angle) * radius;

          const swirl = noise(
            mirrorX * 0.045 + seed * 0.0002,
            mirrorY * 0.045 + seed * 0.0002,
          );
          const t = (swirl + 1) / 2;
          const hue =
            (paletteShift + (angle / segmentAngle) * 360 + radius * 0.18) % 360;
          const lightness = 38 + 30 * Math.sin(radius * 0.04 + t * Math.PI);
          const alpha = 0.2 + 0.4 * Math.pow(t, 1.2);
          const clampedLightness = Math.max(24, Math.min(72, lightness));
          ctx.fillStyle = `hsla(${(hue + 360) % 360}, 68%, ${clampedLightness}%, ${alpha})`;
          ctx.fillRect(x, y, step, step);
        }
      }

      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = `rgba(${fgColor.r}, ${fgColor.g}, ${fgColor.b}, 0.7)`;
      ctx.lineWidth = Math.max(1, viewWidth * 0.0012);
      ctx.beginPath();
      const reach = Math.max(viewWidth, viewHeight);
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2;
        const rayX = centerX + Math.cos(theta) * reach;
        const rayY = centerY + Math.sin(theta) * reach;
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(rayX, rayY);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    function renderGolden(viewWidth: number, viewHeight: number, fgColor: RgbColor) {
      ctx.save();

      const centerX = viewWidth / 2;
      const centerY = viewHeight / 2;
      const phi = (1 + Math.sqrt(5)) / 2;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const rotation = ((seed % 360) * Math.PI) / 180;
      const offset = ((seed >>> 5) % 97) / 97;

      const glow = ctx.createRadialGradient(
        centerX,
        centerY,
        Math.min(viewWidth, viewHeight) * 0.1,
        centerX,
        centerY,
        Math.max(viewWidth, viewHeight),
      );
      glow.addColorStop(0, `rgba(${fgColor.r}, ${fgColor.g}, ${fgColor.b}, 0.22)`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const maxRadius = Math.min(viewWidth, viewHeight) * 0.46;
      const pointCount = 440;
      for (let i = 0; i < pointCount; i++) {
        const angle = rotation + i * goldenAngle;
        const radius = Math.sqrt((i + offset) / pointCount) * maxRadius;
        const px = centerX + Math.cos(angle) * radius;
        const py = centerY + Math.sin(angle) * radius;
        const falloff = 1 - radius / maxRadius;
        const alpha = 0.12 + 0.55 * Math.max(0, falloff);
        const size = 0.8 + falloff * 3.4;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${fgColor.r}, ${fgColor.g}, ${fgColor.b}, ${alpha})`;
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      const trunkWidth = Math.max(1.2, viewWidth * 0.0024);
      const sway = 0.32 + 0.12 * Math.sin(seed * 0.0002);
      const depthLimit = 9;

      ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(${fgColor.r}, ${fgColor.g}, ${fgColor.b}, 0.55)`;
      ctx.lineWidth = trunkWidth;

      const baseLength = Math.min(viewWidth, viewHeight) / 3.4;

      function branch(
        x: number,
        y: number,
        length: number,
        angle: number,
        depth: number,
      ) {
        if (depth > depthLimit || length < 4) return;
        const tipX = x + length * Math.cos(angle);
        const tipY = y - length * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        const nextLength = length / phi;
        branch(tipX, tipY, nextLength, angle + sway, depth + 1);
        branch(tipX, tipY, nextLength, angle - sway, depth + 1);

        if (depth % 2 === 0) {
          branch(tipX, tipY, nextLength / phi, angle, depth + 2);
        }
      }

      branch(centerX, viewHeight * 0.92, baseLength, Math.PI / 2, 0);

      ctx.strokeStyle = `rgba(${fgColor.r}, ${fgColor.g}, ${fgColor.b}, 0.3)`;
      ctx.lineWidth = trunkWidth * 0.65;
      branch(centerX, viewHeight * 0.9, baseLength * 0.72, Math.PI / 2, 1);

      ctx.restore();
    }

    function render() {
      const width = canvas.width;
      const height = canvas.height;
      const viewWidth = width / dpr;
      const viewHeight = height / dpr;

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
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      switch (mode) {
        case "kaleidoscope":
          renderKaleidoscope(viewWidth, viewHeight, fgColor);
          break;
        case "golden":
          renderGolden(viewWidth, viewHeight, fgColor);
          break;
        default:
          renderAurora(viewWidth, viewHeight, fgColor);
          break;
      }

      ctx.globalAlpha = 1;
      const grad = ctx.createRadialGradient(
        viewWidth / 2,
        viewHeight / 2,
        10,
        viewWidth / 2,
        viewHeight / 2,
        Math.max(viewWidth, viewHeight) / 1.2,
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.16)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
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
  }, [enabled, seed, mode]);

  return (
    <FractalContext.Provider value={contextValue}>
      <>
        {/* Left controls */}
        <div className="fixed top-3 left-3 z-[60] flex flex-wrap gap-2">
          <FractalToggleButton />
          <FractalModeButton />
          <button
            type="button"
            onClick={shuffle}
            className="rounded-md border px-3 py-1 text-sm bg-white/60 dark:bg-neutral-900/60 backdrop-blur border-neutral-300 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 transition"
            title="New fractal seed"
            aria-label="Shuffle fractal seed"
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
