// js/demos/moire.js
// Moiré interference patterns from layered grids.
import {
  setCanvasBackground,
  getPaletteNames,
  pickPalette,
} from '../utils.js';

class MoireDemo {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.mode = saved.mode ?? 'lines';
    this.phase = saved.phase ?? 0;
    this.frequency = saved.frequency ?? 14;
    this.speed = saved.speed ?? (this.calm ? 0.08 : 0.18);
    this.snap = saved.snap ?? false;
    this.paletteName = saved.palette ?? 'twilight';

    this.palette = pickPalette(this.paletteName);
  }

  getSettings() {
    return [
      {
        id: 'mode',
        label: 'Pattern',
        type: 'select',
        options: [
          { value: 'lines', label: 'Linear grids' },
          { value: 'circles', label: 'Circular ripples' },
          { value: 'ellipses', label: 'Elliptical' },
        ],
        value: this.mode,
      },
      { id: 'frequency', label: 'Base Frequency', type: 'range', min: 4, max: 40, step: 1, value: this.frequency },
      { id: 'speed', label: 'Drift speed', type: 'range', min: 0.02, max: 0.4, step: 0.01, value: this.speed },
      { id: 'snap', label: 'Snap to simple ratios', type: 'checkbox', value: this.snap },
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
    if (id === 'mode') {
      this.mode = value;
    } else if (id === 'frequency') {
      this.frequency = Number(value);
    } else if (id === 'speed') {
      this.speed = Number(value);
    } else if (id === 'snap') {
      this.snap = Boolean(value);
    } else if (id === 'palette') {
      this.paletteName = value;
      this.palette = pickPalette(value);
    }
  }

  reset() {
    this.phase = 0;
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.speed = enabled ? Math.min(this.speed, 0.1) : Math.max(this.speed, 0.18);
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  handleScroll({ deltaY }) {
    const direction = Math.sign(deltaY);
    this.phase += direction * -0.2;
    return true;
  }

  update(dt) {
    this.phase += dt * this.speed;
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#020206');
    ctx.save();
    ctx.globalAlpha = this.calm ? 0.85 : 1;

    if (this.mode === 'lines') {
      this.drawLineGrids(ctx);
    } else if (this.mode === 'circles') {
      this.drawCircleGrids(ctx);
    } else {
      this.drawEllipseGrids(ctx);
    }

    ctx.restore();
  }

  drawLineGrids(ctx) {
    const spacing = Math.max(6, 180 / this.frequency);
    const offset = (this.phase % 1) * spacing;
    const palette = this.palette;

    ctx.lineWidth = 1;
    for (let i = -this.width; i < this.width * 2; i += spacing) {
      const color = palette[Math.floor((i / spacing) % palette.length + palette.length) % palette.length];
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(i + offset, 0);
      ctx.lineTo(i + offset, this.height);
      ctx.stroke();
    }

    const ratio = this.snap ? this.getSnapRatio() : 1.08;
    const spacing2 = spacing * ratio;
    const offset2 = ((this.phase * 1.6) % 1) * spacing2;
    ctx.globalCompositeOperation = 'screen';
    for (let i = -this.width; i < this.width * 2; i += spacing2) {
      const color = palette[(Math.floor(i / spacing2) + 2) % palette.length];
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, i + offset2);
      ctx.lineTo(this.width, i + offset2);
      ctx.stroke();
    }
  }

  drawCircleGrids(ctx) {
    const spacing = Math.max(12, 250 / this.frequency);
    const ratio = this.snap ? this.getSnapRatio() : 1.04;
    const maxRadius = Math.hypot(this.width, this.height);
    const offset = (this.phase % 1) * spacing;
    ctx.lineWidth = 0.8;
    const palette = this.palette;

    for (let r = offset; r < maxRadius; r += spacing) {
      ctx.strokeStyle = palette[Math.floor(r / spacing) % palette.length];
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'screen';
    const offset2 = ((this.phase * 1.3) % 1) * spacing * ratio;
    for (let r = offset2; r < maxRadius; r += spacing * ratio) {
      const color = palette[(Math.floor(r / (spacing * ratio)) + 2) % palette.length];
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(this.width / 2 + spacing * 0.35, this.height / 2 + spacing * 0.1, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawEllipseGrids(ctx) {
    const spacing = Math.max(10, 220 / this.frequency);
    const ratio = this.snap ? this.getSnapRatio() : 1.05;
    const palette = this.palette;
    const offset = (this.phase % 1) * spacing;
    ctx.lineWidth = 1;

    for (let r = offset; r < Math.max(this.width, this.height) * 1.2; r += spacing) {
      const color = palette[Math.floor(r / spacing) % palette.length];
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.ellipse(this.width / 2, this.height / 2, r * 1.1, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'screen';
    const offset2 = ((this.phase * 1.5) % 1) * spacing * ratio;
    for (let r = offset2; r < Math.max(this.width, this.height) * 1.2; r += spacing * ratio) {
      const color = palette[(Math.floor(r / (spacing * ratio)) + 1) % palette.length];
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.ellipse(this.width / 2 + spacing * 0.4, this.height / 2, r * 0.7, r * 1.1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  getSnapRatio() {
    const ratios = [3 / 2, 5 / 4, 4 / 3, 8 / 5];
    const index = Math.floor(Math.abs(this.phase * 3)) % ratios.length;
    return ratios[index];
  }
}

const explain = 'Moiré patterns emerge when regular grids interfere. Here two lattices with slightly different frequencies overlay to create sweeping beats. Snapping the frequency ratio to musical intervals like 3:2 or 5:4 generates stable lobes.';

export default {
  id: 'moire',
  name: 'Moiré Interference',
  explain,
  create: (env, saved) => new MoireDemo(env, saved),
};
