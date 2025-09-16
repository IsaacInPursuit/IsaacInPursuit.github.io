// js/demos/hilbert.js
// Hilbert space-filling curve traced progressively.
import {
  pickPalette,
  getPaletteNames,
  setCanvasBackground,
  clamp,
  lerpColor,
  createSeededRng,
  generateSeed,
} from '../utils.js';

function rotate(n, x, y, rx, ry) {
  if (ry === 0) {
    if (rx === 1) {
      x = n - 1 - x;
      y = n - 1 - y;
    }
    const temp = x;
    x = y;
    y = temp;
  }
  return { x, y };
}

function hilbertPoints(order) {
  const n = 1 << order;
  const total = n * n;
  const points = new Array(total);
  for (let index = 0; index < total; index += 1) {
    let x = 0;
    let y = 0;
    let t = index;
    for (let s = 1; s < n; s <<= 1) {
      const rx = 1 & (t >> 1);
      const ry = 1 & (t ^ rx);
      ({ x, y } = rotate(s, x, y, rx, ry));
      x += s * rx;
      y += s * ry;
      t >>= 2;
    }
    points[index] = { x, y };
  }
  return points;
}

class HilbertCurveDemo {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 24680;
    this.order = saved.order ?? (this.calm ? 4 : 6);
    this.speed = saved.speed ?? (this.calm ? 0.45 : 0.8);
    this.paletteName = saved.palette ?? 'sunflower';

    this.palette = pickPalette(this.paletteName);
    this.rng = createSeededRng(this.seed);

    this.progress = 0;
    this.points = [];
    this.computePoints();
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999, value: this.seed },
      { id: 'order', label: 'Order', type: 'range', min: 1, max: 8, step: 1, value: this.order },
      { id: 'speed', label: 'Trace Speed', type: 'range', min: 0.1, max: 2, step: 0.05, value: this.speed },
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
    } else if (id === 'order') {
      this.order = clamp(Math.round(value), 1, 9);
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
    this.progress = 0;
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.order = enabled ? Math.min(this.order, 5) : Math.max(this.order, 6);
    this.speed = enabled ? Math.min(this.speed, 0.6) : Math.max(this.speed, 0.8);
    this.computePoints();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  computePoints() {
    this.points = hilbertPoints(this.order);
    this.progress = 0;
  }

  handleScroll({ deltaY }) {
    const direction = Math.sign(deltaY);
    this.order = clamp(this.order + direction * -1, 1, 9);
    this.computePoints();
    return true;
  }

  update(dt) {
    const totalSegments = this.points.length - 1;
    if (totalSegments <= 0) return;
    this.progress = (this.progress + dt * this.speed) % totalSegments;
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#030712');
    if (this.points.length < 2) return;

    const padding = Math.min(this.width, this.height) * 0.1;
    const scale = (Math.min(this.width, this.height) - padding * 2) / ((1 << this.order) - 1);
    const offsetX = (this.width - scale * ((1 << this.order) - 1)) / 2;
    const offsetY = (this.height - scale * ((1 << this.order) - 1)) / 2;

    ctx.save();
    ctx.lineWidth = this.calm ? 1 : 1.6;
    ctx.lineCap = 'round';

    const total = this.points.length - 1;
    const palette = this.palette;

    for (let i = 0; i < total; i += 1) {
      const start = this.points[i];
      const end = this.points[i + 1];
      const sx = offsetX + start.x * scale;
      const sy = offsetY + start.y * scale;
      const ex = offsetX + end.x * scale;
      const ey = offsetY + end.y * scale;
      const t = i / total;
      const colorIndex = t * (palette.length - 1);
      const base = Math.floor(colorIndex);
      const next = Math.min(palette.length - 1, base + 1);
      const stroke = lerpColor(palette[base], palette[next], colorIndex - base);

      const opacity = i <= this.progress ? 0.9 : 0.15;
      ctx.strokeStyle = `${stroke.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '600 14px "Inter", system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`Order ${this.order}`, 24, this.height - 28);
    ctx.restore();
  }
}

const explain = 'Hilbert curves map a 1D line onto a 2D grid through recursive rotations. Each order doubles the resolution while keeping the path continuous, making Hilbert curves useful for locality-preserving spatial indexing.';

export default {
  id: 'hilbert',
  name: 'Hilbert Curve',
  explain,
  create: (env, saved) => new HilbertCurveDemo(env, saved),
};
