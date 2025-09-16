// js/demos/epicycles.js
// Fourier epicycle decomposition of preloaded SVG paths.
import {
  TAU,
  createSeededRng,
  pickPalette,
  getPaletteNames,
  lerpColor,
  clamp,
  setCanvasBackground,
  generateSeed,
  createSvgPathParser,
  createSvgPathSampler,
  normalizePathPoints,
} from '../utils.js';

const rawPaths = [
  {
    id: 'phi-curve',
    name: 'Phi Curve',
    path: 'M 0 -60 L -30 -60 L -30 60 L 0 60 L 0 15 C 15 20 35 10 45 -10 C 55 -30 50 -55 30 -70 C 15 -82 -10 -80 0 -100 L 0 -125 L 45 -125',
  },
  {
    id: 'infinity',
    name: 'Infinity Loop',
    path: 'M -60 0 C -60 -40 -20 -40 -10 0 C 0 40 40 40 40 0 C 40 -40 80 -40 80 0 C 80 40 40 40 30 0 C 20 -40 -20 -40 -20 0 C -20 40 -60 40 -60 0 Z',
  },
];

function computeDFT(points) {
  const N = points.length;
  const coefficients = [];
  for (let k = 0; k < N; k += 1) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n += 1) {
      const angle = (TAU * k * n) / N;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const { x, y } = points[n];
      re += x * cos + y * sin;
      im += -x * sin + y * cos;
    }
    re /= N;
    im /= N;
    const amplitude = Math.hypot(re, im);
    const phase = Math.atan2(im, re);
    const freq = k <= N / 2 ? k : k - N;
    coefficients.push({ re, im, amplitude, phase, freq });
  }
  coefficients.sort((a, b) => b.amplitude - a.amplitude);
  return coefficients;
}

function preparePathData(raw) {
  const segments = createSvgPathParser(raw.path);
  const points = createSvgPathSampler(segments, { samples: 180 });
  const filtered = points.filter((p, index) => index === 0 || points[index - 1].x !== p.x || points[index - 1].y !== p.y);
  const normalized = normalizePathPoints(filtered);
  const coefficients = computeDFT(normalized);
  return {
    id: raw.id,
    name: raw.name,
    points: normalized,
    coefficients,
  };
}

const preparedPaths = rawPaths.map(preparePathData);

class FourierEpicycles {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 91011;
    this.paletteName = saved.palette ?? 'ocean';
    this.pathId = saved.path ?? preparedPaths[0].id;
    this.terms = saved.terms ?? (this.calm ? 45 : 90);
    this.speed = saved.speed ?? (this.calm ? 0.25 : 0.5);
    this.traceLength = saved.trace ?? 400;

    this.palette = pickPalette(this.paletteName);
    this.rng = createSeededRng(this.seed);

    this.time = 0;
    this.trace = [];
    this.setPath(this.pathId);
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999, value: this.seed },
      {
        id: 'path',
        label: 'Path',
        type: 'select',
        options: preparedPaths.map((p) => ({ value: p.id, label: p.name })),
        value: this.pathId,
      },
      { id: 'terms', label: 'Fourier Terms', type: 'range', min: 10, max: 180, step: 1, value: this.terms },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.05, max: 1, step: 0.01, value: this.speed },
      { id: 'trace', label: 'Trace Length', type: 'range', min: 60, max: 800, step: 10, value: this.traceLength },
      {
        id: 'palette',
        label: 'Palette',
        type: 'select',
        options: getPaletteNames().map((name) => ({ value: name, label: name })),
        value: this.paletteName,
      },
    ];
  }

  updateSetting(id, value) {
    if (id === 'seed') {
      this.seed = Math.max(1, Number(value));
      this.rng = createSeededRng(this.seed);
    } else if (id === 'path') {
      this.setPath(value);
    } else if (id === 'terms') {
      this.terms = Math.round(value);
    } else if (id === 'speed') {
      this.speed = Number(value);
    } else if (id === 'trace') {
      this.traceLength = Math.round(value);
    } else if (id === 'palette') {
      this.paletteName = value;
      this.palette = pickPalette(value);
    }
  }

  reset() {
    this.seed = generateSeed();
    this.rng = createSeededRng(this.seed);
    this.trace = [];
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.terms = enabled ? Math.min(this.terms, 60) : Math.max(this.terms, 90);
    this.speed = enabled ? Math.min(this.speed, 0.35) : Math.max(this.speed, 0.5);
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  setPath(id) {
    const data = preparedPaths.find((path) => path.id === id) || preparedPaths[0];
    this.pathId = data.id;
    this.pathData = data;
    this.trace = [];
  }

  handleScroll({ deltaY }) {
    const direction = Math.sign(deltaY);
    this.terms = clamp(this.terms + direction * -3, 10, 240);
    return true;
  }

  update(dt) {
    const timeScale = this.speed * (this.calm ? 0.6 : 1);
    this.time = (this.time + dt * timeScale) % 1;
    const t = this.time;
    const center = { x: 0, y: 0 };
    const contributions = [];
    const maxTerms = Math.min(this.terms, this.pathData.coefficients.length);
    let x = center.x;
    let y = center.y;

    for (let i = 0; i < maxTerms; i += 1) {
      const coeff = this.pathData.coefficients[i];
      const angle = TAU * coeff.freq * t + coeff.phase;
      const dx = coeff.amplitude * Math.cos(angle);
      const dy = coeff.amplitude * Math.sin(angle);
      contributions.push({ x, y, radius: coeff.amplitude, dx, dy });
      x += dx;
      y += dy;
    }

    this.current = { x, y, contributions };
    this.trace.push({ x, y });
    if (this.trace.length > this.traceLength) {
      this.trace.shift();
    }
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#05050b');
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    const scale = Math.min(this.width, this.height) * 0.38;

    if (this.current) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      this.current.contributions.forEach((circle, index) => {
        if (circle.radius === 0) return;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.arc(circle.x * scale, circle.y * scale, Math.abs(circle.radius) * scale, 0, TAU);
        ctx.stroke();

        const endX = (circle.x + circle.dx) * scale;
        const endY = (circle.y + circle.dy) * scale;
        ctx.beginPath();
        const color = this.palette[index % this.palette.length];
        ctx.strokeStyle = color;
        ctx.moveTo(circle.x * scale, circle.y * scale);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      });
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.current.x * scale, this.current.y * scale, this.calm ? 1.8 : 2.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (this.trace.length > 1) {
      ctx.save();
      ctx.lineWidth = this.calm ? 1.2 : 1.6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trace.length; i += 1) {
        const prev = this.trace[i - 1];
        const curr = this.trace[i];
        const t = i / (this.trace.length - 1);
        const colorIndex = t * (this.palette.length - 1);
        const base = Math.floor(colorIndex);
        const next = Math.min(this.palette.length - 1, base + 1);
        const c = lerpColor(this.palette[base], this.palette[next], colorIndex - base);
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.moveTo(prev.x * scale, prev.y * scale);
        ctx.lineTo(curr.x * scale, curr.y * scale);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '600 13px "Inter", system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.pathData.name} – ${this.terms} terms`, 24, this.height - 32);
    ctx.restore();
  }
}

const explain = `The SVG path is sampled into complex points z_n. We compute the discrete Fourier transform X_k = (1/N) Σ z_n e^{-i2πkn/N} and draw epicycles for each harmonic sorted by amplitude. The vector sum traces the original curve as t sweeps around [0, 1).`;

export default {
  id: 'epicycles',
  name: 'Fourier Epicycles',
  explain,
  create: (env, saved) => new FourierEpicycles(env, saved),
};
