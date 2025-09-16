// js/demos/phyllotaxis.js
// Phyllotaxis sunflower visualization based on the golden angle arrangement.
import {
  GOLDEN_ANGLE_RAD,
  GOLDEN_ANGLE_DEG,
  createSeededRng,
  pickPalette,
  getPaletteNames,
  clamp,
  lerp,
  setCanvasBackground,
  generateSeed,
} from '../utils.js';

class PhyllotaxisSunflower {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.canvas = env.canvas;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 20240517;
    this.pointCount = saved.density ?? (this.calm ? 800 : 1600);
    this.bandModulo = saved.bandModulo ?? 12;
    this.speed = saved.speed ?? (this.calm ? 0.35 : 0.65);
    this.paletteName = saved.palette ?? 'sunflower';

    this.rng = createSeededRng(this.seed);
    this.palette = pickPalette(this.paletteName);

    this.points = [];
    this.visibleCount = 0;
    this.targetCount = this.pointCount;
    this.rotation = 0;

    this.computePoints();
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999999, value: this.seed, step: 1 },
      { id: 'density', label: 'Points', type: 'range', min: 200, max: 5000, step: 20, value: this.pointCount },
      { id: 'bandModulo', label: 'Color Bands', type: 'range', min: 2, max: 36, step: 1, value: this.bandModulo },
      { id: 'speed', label: 'Growth Speed', type: 'range', min: 0.1, max: 1.5, step: 0.05, value: this.speed },
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
    } else if (id === 'density') {
      this.pointCount = Math.round(value);
      this.targetCount = this.pointCount;
      this.computePoints();
    } else if (id === 'bandModulo') {
      this.bandModulo = Math.max(2, Math.round(value));
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
    this.computePoints();
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    const nextDensity = enabled ? Math.min(this.pointCount, 900) : Math.max(this.pointCount, 1600);
    this.pointCount = nextDensity;
    this.targetCount = this.pointCount;
    this.speed = enabled ? Math.min(this.speed, 0.45) : Math.max(this.speed, 0.6);
    this.computePoints();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
    this.computePoints();
  }

  computePoints() {
    // Phyllotaxis uses r = c * sqrt(k) and theta = k * golden angle.
    // The scale constant c determines the spacing between seeds.
    const maxDimension = Math.min(this.width, this.height);
    const scale = (maxDimension * 0.5) / Math.sqrt(this.pointCount + 1);
    this.points = new Array(this.pointCount).fill(0).map((_, k) => {
      const radius = scale * Math.sqrt(k);
      const angle = k * GOLDEN_ANGLE_RAD;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      return { x, y, k, radius };
    });
    this.visibleCount = Math.min(this.visibleCount, this.points.length);
  }

  handleScroll({ deltaY }) {
    const direction = Math.sign(deltaY);
    const next = clamp(this.pointCount + direction * -80, 200, 6000);
    if (next !== this.pointCount) {
      this.pointCount = next;
      this.targetCount = next;
      this.computePoints();
    }
    return true;
  }

  update(dt) {
    const growthRate = this.speed * (this.calm ? 0.6 : 1);
    const target = Math.min(this.pointCount, this.points.length);
    this.visibleCount = lerp(this.visibleCount, target, clamp(growthRate * dt, 0, 1));
    this.rotation += dt * 0.05 * (this.calm ? 0.3 : 1);
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#05060a');
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.rotate(this.rotation);
    const drawCount = Math.floor(this.visibleCount);
    const palette = this.palette;
    const modulo = Math.max(1, this.bandModulo);

    for (let i = 0; i < drawCount; i += 1) {
      const point = this.points[i];
      const colorIndex = point.k % modulo;
      const color = palette[colorIndex % palette.length];
      const size = Math.max(2.2 - point.radius / (this.width * 0.6), 0.6);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Overlay subtle radial gradient to suggest sunflower structure.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gradient = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      0,
      this.width / 2,
      this.height / 2,
      Math.min(this.width, this.height) * 0.6
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }
}

const explain = `Phyllotaxis arranges seeds by incrementing angle by the golden angle (${GOLDEN_ANGLE_DEG.toFixed(
  3
)}°).
This irrational increment minimizes overlap so the spirals balance between clockwise and counterclockwise arms.`;

export default {
  id: 'phyllotaxis',
  name: 'Phyllotaxis Sunflower',
  explain,
  create: (env, saved) => new PhyllotaxisSunflower(env, saved),
};
