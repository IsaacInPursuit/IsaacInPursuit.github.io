export const TAU = Math.PI * 2;
export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_ANGLE_DEG = 137.50776405003785;
export const GOLDEN_ANGLE_RAD = GOLDEN_ANGLE_DEG * (Math.PI / 180);

/**
 * Create a deterministic pseudo random number generator based on Mulberry32.
 * The generator returns values in [0, 1).
 * @param {number|string} seed
 * @returns {() => number}
 */
export function createSeededRng(seed) {
  let value = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  if (!value) value = 0x12345678;
  return function rng() {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randomRange(rng, min, max) {
  return rng() * (max - min) + min;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, t);
}

export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function mod(n, m) {
  return ((n % m) + m) % m;
}

export function wrap(value, min, max) {
  const range = max - min;
  if (!range) return min;
  let result = value - min;
  result = mod(result, range);
  return result + min;
}

export function wrapAngle(rad) {
  return wrap(rad, -Math.PI, Math.PI);
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function generateSeed() {
  const timeSeed = Math.floor(Date.now() % 0xffffffff);
  return timeSeed ^ Math.floor(Math.random() * 0xffffffff);
}

export function setCanvasSize(canvas, width, height, { maxDpr = 2, allowImageSmoothing = true } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = allowImageSmoothing;
  }
  return { width, height, dpr };
}

export function downloadCanvasPNG(canvas, name = 'math-demo.png') {
  const link = document.createElement('a');
  link.download = name;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function throttle(fn, wait) {
  let lastCall = 0;
  let timeout = null;
  let lastArgs;
  const invoke = () => {
    lastCall = Date.now();
    timeout = null;
    fn.apply(null, lastArgs);
  };
  return (...args) => {
    const now = Date.now();
    lastArgs = args;
    if (!lastCall || now - lastCall >= wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke();
    } else if (!timeout) {
      const remaining = wait - (now - lastCall);
      timeout = setTimeout(invoke, remaining);
    }
  };
}

export function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(null, args), wait);
  };
}

export function createFPSCounter(samples = 30) {
  const values = [];
  let last = performance.now();
  return {
    frame() {
      const now = performance.now();
      const delta = now - last;
      last = now;
      const fps = 1000 / (delta || 1);
      values.push(fps);
      if (values.length > samples) values.shift();
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return avg;
    },
    reset() {
      values.length = 0;
      last = performance.now();
    },
  };
}

export function prefersReducedMotion() {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  return media.matches;
}

export function listenPrefersReducedMotion(handler) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (event) => handler(event.matches);
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener);
  } else {
    media.addListener(listener);
  }
  return () => {
    if (typeof media.removeEventListener === 'function') {
      media.removeEventListener('change', listener);
    } else {
      media.removeListener(listener);
    }
  };
}

export function isCoarsePointer() {
  return window.matchMedia('(pointer: coarse)').matches;
}

export function ensureReadableHex(hex) {
  if (!hex) return '#ffffff';
  if (hex.startsWith('#')) return hex;
  return `#${hex}`;
}

export const paletteLibrary = {
  sunflower: ['#fed766', '#ffa400', '#fa7921', '#035aa6', '#231123'],
  aurora: ['#3a0ca3', '#4361ee', '#4cc9f0', '#f72585', '#b5179e'],
  ocean: ['#011627', '#2ec4b6', '#e71d36', '#ff9f1c', '#fdfffc'],
  twilight: ['#0b3954', '#087e8b', '#bfd7ea', '#ff5a5f', '#c81d25'],
  meadow: ['#233d4d', '#619b8a', '#a1c181', '#fcca46', '#fe7f2d'],
  monochrome: ['#f0f0f0', '#bdbdbd', '#636363', '#252525', '#000000'],
};

export function getPaletteNames() {
  return Object.keys(paletteLibrary);
}

export function pickPalette(name = 'sunflower') {
  return paletteLibrary[name] || paletteLibrary.sunflower;
}

export function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return `rgb(${r}, ${g}, ${bl})`;
}

export function hexToRgb(hex) {
  const clean = ensureReadableHex(hex).replace('#', '');
  const value = clean.length === 3
    ? clean.split('').map((c) => parseInt(c + c, 16))
    : [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  return { r: value[0], g: value[1], b: value[2] };
}

export function toVector(polarAngle, radius = 1) {
  return {
    x: Math.cos(polarAngle) * radius,
    y: Math.sin(polarAngle) * radius,
  };
}

export function formatFPS(fps) {
  if (!Number.isFinite(fps)) return '--';
  if (fps < 1) return fps.toFixed(1);
  return fps.toFixed(0);
}

export function createPointerTracker(element, callbacks) {
  let active = false;
  let last = null;

  const onPointerDown = (event) => {
    active = true;
    last = { x: event.clientX, y: event.clientY };
    element.setPointerCapture(event.pointerId);
    callbacks.onDown?.(event, last);
  };

  const onPointerMove = (event) => {
    if (!active) return;
    const next = { x: event.clientX, y: event.clientY };
    const dx = next.x - last.x;
    const dy = next.y - last.y;
    callbacks.onDrag?.(event, { dx, dy, x: next.x, y: next.y });
    last = next;
  };

  const onPointerUp = (event) => {
    if (!active) return;
    active = false;
    callbacks.onUp?.(event);
    try {
      element.releasePointerCapture(event.pointerId);
    } catch (_) {
      // ignore
    }
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerUp);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerUp);
  };
}

export function createTimer() {
  let last = performance.now();
  return () => {
    const now = performance.now();
    const delta = (now - last) / 1000;
    last = now;
    return delta;
  };
}

export function withOffscreenCanvas(canvas) {
  if (!canvas || !canvas.transferControlToOffscreen) return null;
  try {
    return canvas.transferControlToOffscreen();
  } catch (error) {
    console.warn('Failed to create OffscreenCanvas', error);
    return null;
  }
}

export function storeState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Unable to persist state', error);
  }
}

export function loadState(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    return fallback;
  }
}

export function createScrollableParameter({ min = 0, max = 1, start = 0, step = 0.01 }) {
  let value = clamp(start, min, max);
  return {
    get value() {
      return value;
    },
    update(deltaY) {
      const direction = deltaY > 0 ? 1 : -1;
      value = clamp(value + direction * step, min, max);
      return value;
    },
    set(next) {
      value = clamp(next, min, max);
    },
  };
}

export function seededShuffle(rng, array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((acc, val) => acc + val, 0) / arr.length;
}

export function pointDistance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const { x: x1, y: y1 } = points[i];
    const { x: x2, y: y2 } = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

export function polygonCentroid(points) {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const { x: x1, y: y1 } = points[i];
    const { x: x2, y: y2 } = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
    area += cross;
  }
  area *= 0.5;
  if (!area) return { x: 0, y: 0 };
  cx /= 6 * area;
  cy /= 6 * area;
  return { x: cx, y: cy };
}

export function computePrimeColor(k, palette) {
  return palette[k % palette.length];
}

export function composeTransforms(transforms) {
  return transforms.reduce(
    (acc, matrix) => {
      const [a1, b1, c1, d1, e1, f1] = acc;
      const [a2, b2, c2, d2, e2, f2] = matrix;
      return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
      ];
    },
    [1, 0, 0, 1, 0, 0]
  );
}

export function applyMatrix(ctx, matrix) {
  ctx.setTransform(...matrix);
}

export function formatRatio(a, b) {
  return `${a}:${b}`;
}

export function makeEventBus() {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event).delete(handler);
    },
    emit(event, payload) {
      const group = listeners.get(event);
      if (!group) return;
      group.forEach((handler) => handler(payload));
    },
    clear() {
      listeners.clear();
    },
  };
}

export function seededNoise1D(seed, frequency = 1) {
  const rng = createSeededRng(seed);
  const gradients = new Map();
  const getGradient = (x) => {
    const key = Math.floor(x);
    if (!gradients.has(key)) {
      gradients.set(key, rng() * 2 - 1);
    }
    return gradients.get(key);
  };
  return (x) => {
    const scaled = x * frequency;
    const x0 = Math.floor(scaled);
    const x1 = x0 + 1;
    const t = scaled - x0;
    const fade = t * t * t * (t * (t * 6 - 15) + 10);
    const g0 = getGradient(x0);
    const g1 = getGradient(x1);
    const v0 = g0 * (scaled - x0);
    const v1 = g1 * (scaled - x1);
    return lerp(v0, v1, fade);
  };
}

export function seededNoise2D(seed, frequency = 1) {
  const rng = createSeededRng(seed);
  const gradients = new Map();
  const gradient = () => {
    const angle = rng() * TAU;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  };
  const keyFor = (x, y) => `${x}|${y}`;
  const getGradient = (x, y) => {
    const key = keyFor(x, y);
    if (!gradients.has(key)) gradients.set(key, gradient());
    return gradients.get(key);
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const nx = x * frequency;
    const ny = y * frequency;
    const x0 = Math.floor(nx);
    const y0 = Math.floor(ny);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const sx = nx - x0;
    const sy = ny - y0;

    const g00 = getGradient(x0, y0);
    const g10 = getGradient(x1, y0);
    const g01 = getGradient(x0, y1);
    const g11 = getGradient(x1, y1);

    const dot00 = g00.x * (nx - x0) + g00.y * (ny - y0);
    const dot10 = g10.x * (nx - x1) + g10.y * (ny - y0);
    const dot01 = g01.x * (nx - x0) + g01.y * (ny - y1);
    const dot11 = g11.x * (nx - x1) + g11.y * (ny - y1);

    const u = fade(sx);
    const v = fade(sy);

    const ix0 = lerp(dot00, dot10, u);
    const ix1 = lerp(dot01, dot11, u);
    return lerp(ix0, ix1, v);
  };
}

export function computeLSystemIterations(axiom, rules, iterations) {
  let result = axiom;
  for (let i = 0; i < iterations; i += 1) {
    let next = '';
    for (let char of result) {
      next += rules[char] || char;
    }
    result = next;
  }
  return result;
}

export function rotatePoint({ x, y }, angle, origin = { x: 0, y: 0 }) {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const translatedX = x - origin.x;
  const translatedY = y - origin.y;
  return {
    x: translatedX * c - translatedY * s + origin.x,
    y: translatedX * s + translatedY * c + origin.y,
  };
}

export function pointToString(point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

export function panZoomMatrix({ scale = 1, offsetX = 0, offsetY = 0 }) {
  return [scale, 0, 0, scale, offsetX, offsetY];
}

export function getAspectRatio(width, height) {
  return width / height;
}

export function createSvgPathSampler(pathSegments, { samples = 1024 }) {
  const points = [];
  for (let i = 0; i < pathSegments.length; i += 1) {
    const seg = pathSegments[i];
    if (seg.type === 'M') {
      points.push({ x: seg.x, y: seg.y });
    } else if (seg.type === 'L') {
      const prev = points[points.length - 1];
      for (let t = 1; t <= samples; t += 1) {
        points.push({
          x: lerp(prev.x, seg.x, t / samples),
          y: lerp(prev.y, seg.y, t / samples),
        });
      }
    } else if (seg.type === 'C') {
      const prev = points[points.length - 1];
      for (let t = 0; t <= samples; t += 1) {
        const u = t / samples;
        const v = 1 - u;
        const x =
          v * v * v * prev.x +
          3 * v * v * u * seg.cx1 +
          3 * v * u * u * seg.cx2 +
          u * u * u * seg.x;
        const y =
          v * v * v * prev.y +
          3 * v * v * u * seg.cy1 +
          3 * v * u * u * seg.cy2 +
          u * u * u * seg.y;
        points.push({ x, y });
      }
    }
  }
  return points;
}

export function normalizePathPoints(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  return points.map((p) => ({
    x: (p.x - minX) / width - 0.5,
    y: (p.y - minY) / height - 0.5,
  }));
}

export function lowPass(current, target, smoothing, delta) {
  const alpha = 1 - Math.exp(-smoothing * delta);
  return lerp(current, target, alpha);
}

export function createColorCycle(palette) {
  let index = 0;
  return () => {
    const color = palette[index % palette.length];
    index += 1;
    return color;
  };
}

export function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export function detectMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function safeCall(fn, ...args) {
  if (typeof fn === 'function') {
    return fn(...args);
  }
  return undefined;
}

export function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

export function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

export function createRollingAverage(size = 20) {
  const samples = new Array(size).fill(0);
  let index = 0;
  let filled = 0;
  return {
    push(value) {
      samples[index] = value;
      index = (index + 1) % size;
      filled = Math.min(filled + 1, size);
    },
    value() {
      if (!filled) return 0;
      const sum = samples.slice(0, filled).reduce((acc, v) => acc + v, 0);
      return sum / filled;
    },
    reset() {
      samples.fill(0);
      index = 0;
      filled = 0;
    },
  };
}

export function createDeterministicColor(index, palette) {
  return palette[index % palette.length];
}

export function autoDropCalmMode({ fps, calmMode, onDrop, threshold = 28, duration = 3000 }) {
  let below = 0;
  return (deltaTime) => {
    if (calmMode()) {
      below = 0;
      return;
    }
    const frameFPS = 1 / deltaTime;
    if (frameFPS < threshold) {
      below += deltaTime * 1000;
      if (below > duration) {
        onDrop();
        below = 0;
      }
    } else {
      below = Math.max(0, below - deltaTime * 1000);
    }
  };
}

export function seededAngles(count, rng) {
  const angles = [];
  const angleStep = TAU / count;
  for (let i = 0; i < count; i += 1) {
    angles.push(angleStep * i + rng() * angleStep * 0.25);
  }
  return angles;
}

export function createSvgPathParser(path) {
  const commands = path.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
  const segments = [];
  let current = { x: 0, y: 0 };
  for (const command of commands) {
    const type = command[0];
    const args = command
      .slice(1)
      .trim()
      .split(/[ ,]+/)
      .filter(Boolean)
      .map(Number);
    if (type === 'M' || type === 'm') {
      const isRelative = type === 'm';
      for (let i = 0; i < args.length; i += 2) {
        const x = isRelative ? current.x + args[i] : args[i];
        const y = isRelative ? current.y + args[i + 1] : args[i + 1];
        current = { x, y };
        segments.push({ type: 'M', x, y });
      }
    } else if (type === 'L' || type === 'l') {
      const isRelative = type === 'l';
      for (let i = 0; i < args.length; i += 2) {
        const x = isRelative ? current.x + args[i] : args[i];
        const y = isRelative ? current.y + args[i + 1] : args[i + 1];
        segments.push({ type: 'L', x, y });
        current = { x, y };
      }
    } else if (type === 'C' || type === 'c') {
      const isRelative = type === 'c';
      for (let i = 0; i < args.length; i += 6) {
        const cx1 = isRelative ? current.x + args[i] : args[i];
        const cy1 = isRelative ? current.y + args[i + 1] : args[i + 1];
        const cx2 = isRelative ? current.x + args[i + 2] : args[i + 2];
        const cy2 = isRelative ? current.y + args[i + 3] : args[i + 3];
        const x = isRelative ? current.x + args[i + 4] : args[i + 4];
        const y = isRelative ? current.y + args[i + 5] : args[i + 5];
        segments.push({ type: 'C', cx1, cy1, cx2, cy2, x, y });
        current = { x, y };
      }
    } else if (type === 'Z' || type === 'z') {
      segments.push({ type: 'Z' });
    }
  }
  return segments;
}

export function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function radialGradient(ctx, cx, cy, r, inner, outer) {
  const gradient = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  return gradient;
}

export function setCanvasBackground(ctx, width, height, color = '#05060a') {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function createGradientPalette(base, rng) {
  const palette = [];
  const variation = rng() * 0.2 + 0.1;
  for (let i = 0; i < base.length - 1; i += 1) {
    const start = base[i];
    const end = base[i + 1];
    const steps = 4;
    for (let j = 0; j < steps; j += 1) {
      palette.push(lerpColor(start, end, (j + rng() * variation) / steps));
    }
  }
  palette.push(base[base.length - 1]);
  return palette;
}

export function mix(a, b, t) {
  return a * (1 - t) + b * t;
}

export function bezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return (
    u * u * u * p0 +
    3 * u * u * t * p1 +
    3 * u * t * t * p2 +
    t * t * t * p3
  );
}

export function bezierDerivative(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return (
    3 * u * u * (p1 - p0) +
    6 * u * t * (p2 - p1) +
    3 * t * t * (p3 - p2)
  );
}

export function chooseNearestPoint(points, target) {
  let best = null;
  let bestDist = Infinity;
  for (const point of points) {
    const dx = point.x - target.x;
    const dy = point.y - target.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = point;
    }
  }
  return best;
}

export function createEaseOut(tail = 3) {
  return (t) => 1 - Math.exp(-t * tail);
}

export function hyp(x, y) {
  return Math.sqrt(x * x + y * y);
}

export function createCircularArray(length) {
  return {
    length,
    get(index) {
      return mod(index, length);
    },
  };
}

export function goldenSpiralPoint(a, b, theta) {
  const r = a * Math.exp(b * theta);
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}
