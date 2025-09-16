// js/demos/mod-mult-circle.js
// Modular multiplication circle revealing cardioid and epicycloid patterns.
import {
  TAU,
  createSeededRng,
  pickPalette,
  getPaletteNames,
  clamp,
  lerp,
  mapRange,
  setCanvasBackground,
  generateSeed,
} from '../utils.js';

class ModularMultiplicationCircle {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 314159;
    this.pointCount = saved.points ?? (this.calm ? 160 : 260);
    this.speed = saved.speed ?? (this.calm ? 0.15 : 0.35);
    this.paletteName = saved.palette ?? 'aurora';

    this.multiplier = saved.multiplier ?? 2.2;
    this.scrollTarget = this.multiplier;

    this.rng = createSeededRng(this.seed);
    this.palette = pickPalette(this.paletteName);

    this.points = [];
    this.computePoints();
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999, value: this.seed },
      { id: 'points', label: 'Points on Circle', type: 'range', min: 60, max: 600, step: 10, value: this.pointCount },
      { id: 'speed', label: 'Multiplier Speed', type: 'range', min: 0.02, max: 1, step: 0.01, value: this.speed },
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
      this.computePoints();
    } else if (id === 'points') {
      this.pointCount = Math.round(value);
      this.computePoints();
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
    this.multiplier = 2;
    this.scrollTarget = this.multiplier;
    this.computePoints();
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.pointCount = enabled ? Math.min(this.pointCount, 180) : Math.max(this.pointCount, 220);
    this.speed = enabled ? Math.min(this.speed, 0.22) : Math.max(this.speed, 0.35);
    this.computePoints();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
    this.computePoints();
  }

  computePoints() {
    const radius = Math.min(this.width, this.height) * 0.42;
    this.points = new Array(this.pointCount).fill(0).map((_, i) => {
      const angle = (i / this.pointCount) * TAU;
      return {
        x: this.width / 2 + radius * Math.cos(angle),
        y: this.height / 2 + radius * Math.sin(angle),
        angle,
      };
    });
  }

  handleScroll({ deltaY }) {
    const direction = Math.sign(deltaY);
    const next = clamp(this.scrollTarget + direction * -0.35, 0.2, 25);
    this.scrollTarget = next;
    return true;
  }

  update(dt) {
    const drift = this.speed * (this.calm ? 0.6 : 1);
    this.scrollTarget += dt * drift;
    this.multiplier = lerp(this.multiplier, this.scrollTarget, clamp(0.5 * dt, 0, 1));
  }

  interpolatePoint(index) {
    const points = this.points;
    const count = points.length;
    const base = Math.floor(index);
    const frac = index - base;
    const a = points[base % count];
    const b = points[(base + 1) % count];
    return {
      x: lerp(a.x, b.x, frac),
      y: lerp(a.y, b.y, frac),
    };
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#02030a');
    ctx.save();
    ctx.lineWidth = this.calm ? 0.6 : 0.9;
    ctx.globalAlpha = this.calm ? 0.8 : 0.92;
    const palette = this.palette;
    const count = this.points.length;

    for (let i = 0; i < count; i += 1) {
      const start = this.points[i];
      const mappedIndex = (i * this.multiplier) % count;
      const end = this.interpolatePoint(mappedIndex);
      const t = mapRange(i, 0, count - 1, 0, 1);
      const color = palette[Math.floor(t * (palette.length - 1))];
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = 'white';
    ctx.font = '600 14px/1.2 "Inter", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`multiplier m = ${this.multiplier.toFixed(2)}`, this.width / 2, this.height * 0.08);
    ctx.restore();
  }
}

const explain = `Multiplying each index i by m and mapping back into the circle modulo N traces chords whose envelope forms cardioids when m is close to N. Changing m animates families of epicycloids and lissajous-like tangles.`;

export default {
  id: 'mod-mult-circle',
  name: 'Modular Multiplication Circle',
  explain,
  create: (env, saved) => new ModularMultiplicationCircle(env, saved),
};
