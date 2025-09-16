// js/demos/golden-grid.js
// Golden ratio grid with logarithmic spiral overlay.
import {
  PHI,
  setCanvasBackground,
  goldenSpiralPoint,
  pickPalette,
  getPaletteNames,
} from '../utils.js';

class GoldenGridDemo {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.scale = saved.scale ?? 0.8;
    this.rotation = saved.rotation ?? 0;
    this.sections = saved.sections ?? 6;
    this.paletteName = saved.palette ?? 'sunflower';
    this.showLabels = saved.labels ?? true;

    this.palette = pickPalette(this.paletteName);
  }

  getSettings() {
    return [
      { id: 'scale', label: 'Grid scale', type: 'range', min: 0.4, max: 1, step: 0.02, value: this.scale },
      { id: 'rotation', label: 'Rotation', type: 'range', min: -Math.PI, max: Math.PI, step: 0.01, value: this.rotation },
      { id: 'sections', label: 'Spiral turns', type: 'range', min: 3, max: 10, step: 1, value: this.sections },
      { id: 'labels', label: 'Show guide labels', type: 'checkbox', value: this.showLabels },
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
    if (id === 'scale') {
      this.scale = Number(value);
    } else if (id === 'rotation') {
      this.rotation = Number(value);
    } else if (id === 'sections') {
      this.sections = Math.round(value);
    } else if (id === 'labels') {
      this.showLabels = Boolean(value);
    } else if (id === 'palette') {
      this.paletteName = value;
      this.palette = pickPalette(value);
    }
  }

  reset() {
    this.rotation = 0;
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.sections = enabled ? Math.min(this.sections, 5) : Math.max(this.sections, 7);
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  handleScroll({ deltaY }) {
    this.rotation += Math.sign(deltaY) * 0.05;
    return true;
  }

  update() {}

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#030508');
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);

    const palette = this.palette;
    const rectColor = palette[0];
    const lineColor = palette[2] || '#ffffff';

    // Draw golden rectangles recursively.
    const size = Math.min(this.width, this.height) * 0.5;
    this.drawGoldenRectangles(ctx, -size / 2, -size / 2, size, 0, 6, rectColor, lineColor);

    // Draw logarithmic spiral: r = a e^{bθ} with b = ln φ / (π/2)
    const b = Math.log(PHI) / (Math.PI / 2);
    const a = size * 0.18;
    const turns = this.sections;

    ctx.strokeStyle = palette[palette.length - 1];
    ctx.lineWidth = this.calm ? 1 : 1.6;
    ctx.beginPath();
    for (let i = 0; i <= turns * 90; i += 1) {
      const theta = (i / 90) * (Math.PI / 2);
      const point = goldenSpiralPoint(a, b, theta);
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    ctx.restore();

    if (this.showLabels) {
      ctx.save();
      ctx.fillStyle = '#ffffffaa';
      ctx.font = '600 14px "Inter", system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`φ ≈ ${PHI.toFixed(5)}`, 24, this.height - 56);
      ctx.fillText('Log spiral r = a e^{bθ}', 24, this.height - 36);
      ctx.restore();
    }
  }

  drawGoldenRectangles(ctx, x, y, size, rotation, depth, fillColor, lineColor) {
    if (depth === 0) return;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(rotation);
    ctx.translate(-size / 2, -size / 2);
    ctx.fillStyle = fillColor.replace('rgb', 'rgba').replace(')', ', 0.08)');
    ctx.fillRect(0, 0, size, size / PHI);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(0, 0, size, size / PHI);
    ctx.restore();

    const nextSize = size / PHI;
    const nextX = x + size - nextSize;
    const nextY = y;
    this.drawGoldenRectangles(ctx, nextX, nextY, nextSize, rotation - Math.PI / 2, depth - 1, fillColor, lineColor);
  }
}

const explain = 'The golden ratio φ splits a segment so that whole-to-large equals large-to-small. Repeated subdivision of a square produces the classical golden rectangle grid. Connecting the quarter-circle arcs yields a logarithmic spiral with constant angle to the radial lines.';

export default {
  id: 'golden-grid',
  name: 'Golden Ratio Grid',
  explain,
  create: (env, saved) => new GoldenGridDemo(env, saved),
};
