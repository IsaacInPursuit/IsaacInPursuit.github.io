// js/demos/lissajous.js
// Combined Lissajous figure and damped harmonograph curves.
import {
  TAU,
  createSeededRng,
  pickPalette,
  getPaletteNames,
  lerpColor,
  clamp,
  setCanvasBackground,
  generateSeed,
} from '../utils.js';

const ratioPresets = [
  '1:2',
  '2:3',
  '3:4',
  '3:5',
  '4:5',
  '5:7',
  '5:8',
];

class LissajousHarmonograph {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 77777;
    this.paletteName = saved.palette ?? 'twilight';
    this.ratio = saved.ratio ?? '3:4';
    this.phase = saved.phase ?? TAU / 4;
    this.damping = saved.damping ?? 0.015;
    this.speed = saved.speed ?? (this.calm ? 0.25 : 0.45);

    this.rng = createSeededRng(this.seed);
    this.palette = pickPalette(this.paletteName);

    this.time = 0;
    this.samples = this.calm ? 500 : 1000;
    this.secondPhase = this.rng() * TAU;
    this.harmonicPhase = this.rng() * TAU;
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999, value: this.seed },
      {
        id: 'ratio',
        label: 'Frequency Ratio',
        type: 'select',
        options: ratioPresets.map((r) => ({ value: r, label: r })),
        value: this.ratio,
      },
      { id: 'phase', label: 'Phase Offset', type: 'range', min: 0, max: TAU, step: 0.01, value: this.phase },
      { id: 'damping', label: 'Damping', type: 'range', min: 0.001, max: 0.05, step: 0.001, value: this.damping },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.05, max: 1, step: 0.01, value: this.speed },
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
      this.secondPhase = this.rng() * TAU;
      this.harmonicPhase = this.rng() * TAU;
    } else if (id === 'ratio') {
      this.ratio = value;
    } else if (id === 'phase') {
      this.phase = Number(value);
    } else if (id === 'damping') {
      this.damping = Number(value);
    } else if (id === 'speed') {
      this.speed = Number(value);
    } else if (id === 'palette') {
      this.paletteName = value;
      this.palette = pickPalette(value);
    }
  }

  reset() {
    this.seed = generateSeed();
    this.rng = createSeededRng(this.seed);
    this.secondPhase = this.rng() * TAU;
    this.harmonicPhase = this.rng() * TAU;
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.samples = enabled ? 420 : 1000;
    this.speed = enabled ? Math.min(this.speed, 0.3) : Math.max(this.speed, 0.45);
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  handleScroll({ deltaY }) {
    const direction = Math.sign(deltaY);
    this.phase = clamp(this.phase + direction * -0.08, 0, TAU);
    return true;
  }

  parseRatio() {
    const [aStr, bStr] = this.ratio.split(':');
    const a = parseInt(aStr, 10) || 1;
    const b = parseInt(bStr, 10) || 1;
    return { a, b };
  }

  samplePoint(t) {
    const { a, b } = this.parseRatio();
    const amplitude = Math.min(this.width, this.height) * 0.35;
    const damping = this.damping;
    const time = t * TAU;
    // Lissajous term: orthogonal sine oscillations with optional phase offset.
    const xPrimary = Math.sin(a * time + this.phase);
    const yPrimary = Math.sin(b * time);

    // Harmonograph term: secondary oscillation with exponential damping.
    const xHarm = Math.sin((a + 1) * time + this.secondPhase) * Math.exp(-damping * 1.2 * time);
    const yHarm = Math.sin((b + 2) * time + this.harmonicPhase) * Math.exp(-damping * 1.4 * time);

    const x = (xPrimary + 0.35 * xHarm) * amplitude * Math.exp(-damping * time);
    const y = (yPrimary + 0.4 * yHarm) * amplitude * Math.exp(-damping * 0.9 * time);
    return { x: this.width / 2 + x, y: this.height / 2 + y };
  }

  update(dt) {
    this.time += dt * this.speed;
    this.phase = (this.phase + dt * this.speed * 0.2) % TAU;
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#04040a');
    ctx.save();
    ctx.lineWidth = this.calm ? 0.8 : 1.2;
    ctx.lineCap = 'round';

    let previous = null;
    const steps = this.samples;
    const palette = this.palette;

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const point = this.samplePoint(t + this.time * 0.05);
      if (previous) {
        const colorIndex = (i / steps) * (palette.length - 1);
        const baseIndex = Math.floor(colorIndex);
        const nextIndex = Math.min(palette.length - 1, baseIndex + 1);
        const localT = colorIndex - baseIndex;
        const stroke = lerpColor(palette[baseIndex], palette[nextIndex], localT);
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      previous = point;
    }

    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 14px "Inter", system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`ratio ${this.ratio}`, this.width - 24, this.height - 28);
    ctx.restore();
  }
}

const explain = `Lissajous figures use orthogonal sinusoidal motions x = A sin(a t + δ) and y = B sin(b t). Adding damped harmonograph terms creates the layered ribbons that slowly settle as e^{-λ t}. Integer frequency ratios a:b close the curve into delicate knots.`;

export default {
  id: 'lissajous',
  name: 'Lissajous & Harmonograph',
  explain,
  create: (env, saved) => new LissajousHarmonograph(env, saved),
};
