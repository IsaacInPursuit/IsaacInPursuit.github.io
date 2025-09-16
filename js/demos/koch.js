// js/demos/koch.js
// Koch snowflake with adjustable iteration level.
import {
  pickPalette,
  getPaletteNames,
  setCanvasBackground,
  clamp,
  lerpColor,
  createSeededRng,
  generateSeed,
} from '../utils.js';

function subdivideSegment(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const oneThird = { x: a.x + dx / 3, y: a.y + dy / 3 };
  const twoThird = { x: a.x + (2 * dx) / 3, y: a.y + (2 * dy) / 3 };
  const length = Math.sqrt(dx * dx + dy * dy) / 3;
  const angle = Math.atan2(dy, dx) - Math.PI / 3;
  const peak = { x: oneThird.x + Math.cos(angle) * length, y: oneThird.y + Math.sin(angle) * length };
  return [a, oneThird, peak, twoThird];
}

function generateSnowflake(level) {
  const initial = [
    { x: 0, y: -1 },
    { x: Math.sin(Math.PI / 3), y: 0.5 },
    { x: -Math.sin(Math.PI / 3), y: 0.5 },
  ];
  let points = [...initial, initial[0]];
  for (let iteration = 0; iteration < level; iteration += 1) {
    const next = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const segment = subdivideSegment(points[i], points[i + 1]);
      next.push(...segment);
    }
    next.push(points[points.length - 1]);
    points = next;
  }
  return points;
}

class KochSnowflake {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 98765;
    this.level = saved.level ?? (this.calm ? 3 : 4);
    this.speed = saved.speed ?? (this.calm ? 0.4 : 0.7);
    this.filled = saved.filled ?? false;
    this.paletteName = saved.palette ?? 'aurora';

    this.palette = pickPalette(this.paletteName);
    this.rng = createSeededRng(this.seed);

    this.points = [];
    this.progress = 0;
    this.computePoints();
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999, value: this.seed },
      { id: 'level', label: 'Iteration Level', type: 'range', min: 0, max: 6, step: 1, value: this.level },
      { id: 'speed', label: 'Trace Speed', type: 'range', min: 0.1, max: 2, step: 0.05, value: this.speed },
      { id: 'filled', label: 'Filled interior', type: 'checkbox', value: this.filled },
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
    } else if (id === 'level') {
      this.level = clamp(Math.round(value), 0, 7);
      this.computePoints();
    } else if (id === 'speed') {
      this.speed = Number(value);
    } else if (id === 'filled') {
      this.filled = Boolean(value);
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
    this.level = enabled ? Math.min(this.level, 3) : Math.max(this.level, 4);
    this.speed = enabled ? Math.min(this.speed, 0.55) : Math.max(this.speed, 0.7);
    this.computePoints();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  computePoints() {
    this.points = generateSnowflake(this.level);
    this.progress = 0;
  }

  handleScroll({ deltaY }) {
    const direction = Math.sign(deltaY);
    this.level = clamp(this.level + direction * -1, 0, 7);
    this.computePoints();
    return true;
  }

  update(dt) {
    const total = this.points.length - 1;
    if (total <= 0) return;
    this.progress = (this.progress + dt * this.speed) % total;
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#060914');
    if (this.points.length < 2) return;

    const scale = Math.min(this.width, this.height) * 0.42;
    const centerX = this.width / 2;
    const centerY = this.height / 2 + scale * 0.1;

    ctx.save();
    ctx.lineWidth = this.calm ? 1 : 1.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const path = new Path2D();
    this.points.forEach((point, index) => {
      const x = centerX + point.x * scale;
      const y = centerY + point.y * scale;
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });

    if (this.filled) {
      ctx.globalAlpha = 0.25;
      const fillColor = this.palette[0];
      ctx.fillStyle = fillColor;
      ctx.fill(path);
      ctx.globalAlpha = 1;
    }

    const total = this.points.length - 1;
    for (let i = 0; i < total; i += 1) {
      const start = this.points[i];
      const end = this.points[i + 1];
      const x1 = centerX + start.x * scale;
      const y1 = centerY + start.y * scale;
      const x2 = centerX + end.x * scale;
      const y2 = centerY + end.y * scale;
      const t = i / total;
      const colorIndex = t * (this.palette.length - 1);
      const base = Math.floor(colorIndex);
      const next = Math.min(this.palette.length - 1, base + 1);
      const stroke = lerpColor(this.palette[base], this.palette[next], colorIndex - base);
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = i <= this.progress ? 0.95 : 0.18;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '600 14px "Inter", system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`Level ${this.level}`, this.width - 24, this.height - 30);
    ctx.restore();
  }
}

const explain = 'Each iteration of the Koch construction replaces a segment with four edges that form an equilateral bump. The number of edges grows by a factor of four per level while the snowflake perimeter diverges; its area converges to 8/5 of the starting triangle.';

export default {
  id: 'koch',
  name: 'Koch Snowflake',
  explain,
  create: (env, saved) => new KochSnowflake(env, saved),
};
