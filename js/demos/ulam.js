// js/demos/ulam.js
// Ulam spiral with primes computed in a Web Worker.
import {
  clamp,
  pickPalette,
  getPaletteNames,
  setCanvasBackground,
  lerp,
  createSeededRng,
  generateSeed,
} from '../utils.js';

const sieveWorkerUrl = new URL('../../workers/sieve.js', import.meta.url);

function spiralCoordinate(n) {
  if (n === 1) return { x: 0, y: 0 };
  const k = Math.ceil((Math.sqrt(n) - 1) / 2);
  const t = 2 * k + 1;
  let m = t * t;
  const tMinus = t - 1;
  if (n >= m - tMinus) {
    return { x: k - (m - n), y: -k };
  }
  m -= tMinus;
  if (n >= m - tMinus) {
    return { x: -k, y: -k + (m - n) };
  }
  m -= tMinus;
  if (n >= m - tMinus) {
    return { x: -k + (m - n), y: k };
  }
  return { x: k, y: k - (m - n - tMinus) };
}

class UlamSpiral {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 123456;
    this.maxNumber = saved.max ?? (this.calm ? 16000 : 36000);
    this.scale = saved.scale ?? 12;
    this.paletteName = saved.palette ?? 'meadow';
    this.showDiagonals = saved.diagonals ?? true;

    this.palette = pickPalette(this.paletteName);
    this.rng = createSeededRng(this.seed);

    this.pan = { x: 0, y: 0 };
    this.targetScale = this.scale;
    this.positions = [];
    this.trace = [];
    this.primes = null;
    this.isLoading = false;

    this.worker = new Worker(sieveWorkerUrl, { type: 'module' });
    this.worker.onmessage = (event) => {
      if (event.data?.type === 'sieve-result') {
        this.primes = new Uint8Array(event.data.buffer);
        this.isLoading = false;
      }
    };

    this.computePositions();
    this.requestPrimes();
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999, value: this.seed },
      { id: 'max', label: 'Max Number', type: 'range', min: 1000, max: 90000, step: 1000, value: this.maxNumber },
      { id: 'scale', label: 'Cell Size', type: 'range', min: 6, max: 32, step: 1, value: this.scale },
      {
        id: 'palette',
        label: 'Palette',
        type: 'select',
        options: getPaletteNames().map((name) => ({ value: name, label: name })),
        value: this.paletteName,
      },
      { id: 'diagonals', label: 'Highlight diagonals', type: 'checkbox', value: this.showDiagonals },
    ];
  }

  updateSetting(id, value) {
    if (id === 'seed') {
      this.seed = Math.max(1, Number(value));
      this.rng = createSeededRng(this.seed);
    } else if (id === 'max') {
      this.maxNumber = Math.round(value);
      this.computePositions();
      this.requestPrimes();
    } else if (id === 'scale') {
      this.scale = Number(value);
      this.targetScale = this.scale;
    } else if (id === 'palette') {
      this.paletteName = value;
      this.palette = pickPalette(value);
    } else if (id === 'diagonals') {
      this.showDiagonals = Boolean(value);
    }
  }

  reset() {
    this.seed = generateSeed();
    this.rng = createSeededRng(this.seed);
    this.pan = { x: 0, y: 0 };
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.maxNumber = enabled ? Math.min(this.maxNumber, 20000) : Math.max(this.maxNumber, 32000);
    this.scale = enabled ? Math.max(8, this.scale * 0.85) : Math.min(16, this.scale * 1.1);
    this.targetScale = this.scale;
    this.computePositions();
    this.requestPrimes();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  dispose() {
    this.worker?.terminate();
  }

  computePositions() {
    this.positions = new Array(this.maxNumber + 1);
    for (let n = 1; n <= this.maxNumber; n += 1) {
      this.positions[n] = spiralCoordinate(n);
    }
  }

  requestPrimes() {
    this.isLoading = true;
    this.worker.postMessage({ type: 'sieve', max: this.maxNumber });
  }

  handleScroll({ deltaY, ctrlKey }) {
    if (ctrlKey) {
      const factor = Math.exp(-deltaY * 0.0025);
      this.targetScale = clamp(this.targetScale * factor, 4, 48);
    } else {
      const direction = Math.sign(deltaY);
      this.maxNumber = clamp(this.maxNumber + direction * -2000, 2000, 120000);
      this.computePositions();
      this.requestPrimes();
    }
    return true;
  }

  pointerDown(event) {
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.panStart = { ...this.pan };
  }

  pointerDrag(event) {
    if (!this.dragStart) return;
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    const cell = this.scale;
    this.pan.x = this.panStart.x + dx / cell;
    this.pan.y = this.panStart.y + dy / cell;
  }

  pointerUp() {
    this.dragStart = null;
  }

  update(dt) {
    this.scale = lerp(this.scale, this.targetScale, clamp(dt * 6, 0, 1));
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#03040f');
    if (!this.positions.length) return;

    ctx.save();
    ctx.translate(this.width / 2 + this.pan.x * this.scale, this.height / 2 + this.pan.y * this.scale);

    const halfWidth = this.width / (2 * this.scale) + 2;
    const halfHeight = this.height / (2 * this.scale) + 2;
    const palette = this.palette;
    const cell = this.scale;
    const primeData = this.primes;

    for (let n = 1; n <= this.maxNumber; n += 1) {
      const point = this.positions[n];
      if (!point) continue;
      if (Math.abs(point.x + this.pan.x) > halfWidth || Math.abs(point.y + this.pan.y) > halfHeight) {
        continue;
      }

      const screenX = point.x * cell;
      const screenY = point.y * cell;
      const isPrime = primeData ? primeData[n] === 1 : false;
      const isDiagonal = this.showDiagonals && (point.x === point.y || point.x === -point.y || point.x === 0 || point.y === 0);

      if (!isPrime && !isDiagonal) continue;

      const size = Math.max(1, cell * (isPrime ? 0.82 : 0.5));
      const color = isPrime ? palette[n % palette.length] : 'rgba(255,255,255,0.08)';
      ctx.fillStyle = color;
      ctx.fillRect(screenX - size / 2, screenY - size / 2, size, size);
    }

    ctx.restore();

    if (this.isLoading) {
      ctx.save();
      ctx.fillStyle = '#ffffffaa';
      ctx.font = '600 14px "Inter", system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('Computing primes…', this.width - 24, this.height - 24);
      ctx.restore();
    }
  }
}

const explain = 'The Ulam spiral enumerates integers along a square spiral. Primes cluster along quadratic polynomials, producing diagonal streaks. We use a Web Worker to run the Sieve of Eratosthenes and highlight primes without blocking rendering.';

export default {
  id: 'ulam',
  name: 'Ulam Prime Spiral',
  explain,
  create: (env, saved) => new UlamSpiral(env, saved),
};
