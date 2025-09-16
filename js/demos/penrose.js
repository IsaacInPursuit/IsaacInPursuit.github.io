// js/demos/penrose.js
// Penrose tiling via triangle inflation executed in a worker.
import {
  setCanvasBackground,
  pickPalette,
  getPaletteNames,
} from '../utils.js';

const workerUrl = new URL('../../workers/penrose.js', import.meta.url);

class PenroseDemo {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.iterations = saved.iterations ?? (this.calm ? 2 : 3);
    this.paletteName = saved.palette ?? 'sunflower';
    this.rotation = saved.rotation ?? 0;
    this.autoRotate = saved.autoRotate ?? true;

    this.palette = pickPalette(this.paletteName);
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'result') {
        this.triangleBuffer = new Float32Array(data.triangles);
        this.typeBuffer = new Uint8Array(data.kinds);
        this.bounds = data.bounds;
        this.pending = false;
      }
    };

    this.compute();
  }

  getSettings() {
    return [
      { id: 'iterations', label: 'Inflation steps', type: 'range', min: 1, max: 5, step: 1, value: this.iterations },
      { id: 'rotation', label: 'Manual rotation', type: 'range', min: -Math.PI, max: Math.PI, step: 0.01, value: this.rotation },
      { id: 'autoRotate', label: 'Auto rotate', type: 'checkbox', value: this.autoRotate },
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
    if (id === 'iterations') {
      this.iterations = Math.round(value);
      this.compute();
    } else if (id === 'rotation') {
      this.rotation = Number(value);
    } else if (id === 'autoRotate') {
      this.autoRotate = Boolean(value);
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
    this.iterations = enabled ? Math.min(this.iterations, 2) : Math.max(this.iterations, 3);
    this.compute();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  handleScroll({ deltaY }) {
    this.rotation += Math.sign(deltaY) * 0.05;
    return true;
  }

  compute() {
    if (!this.worker) return;
    this.pending = true;
    this.worker.postMessage({ type: 'inflate', iterations: this.iterations });
  }

  update(dt) {
    if (this.autoRotate) {
      this.rotation += dt * 0.1;
    }
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#050407');
    if (!this.triangleBuffer || !this.typeBuffer || !this.bounds) {
      if (this.pending) {
        ctx.save();
        ctx.fillStyle = '#ffffffaa';
        ctx.font = '600 14px "Inter", system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Inflating tiles…', this.width / 2, this.height / 2);
        ctx.restore();
      }
      return;
    }

    const triangles = this.triangleBuffer;
    const types = this.typeBuffer;
    const palette = this.palette;
    const rangeX = this.bounds.maxX - this.bounds.minX || 1;
    const rangeY = this.bounds.maxY - this.bounds.minY || 1;
    const scale = 0.9 * Math.min(this.width / rangeX, this.height / rangeY);
    const offsetX = this.width / 2;
    const offsetY = this.height / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.rotate(this.rotation);
    ctx.translate(-rangeX / 2 * scale, -rangeY / 2 * scale);

    for (let i = 0; i < types.length; i += 1) {
      const idx = i * 6;
      const ax = (triangles[idx] - this.bounds.minX) * scale;
      const ay = (triangles[idx + 1] - this.bounds.minY) * scale;
      const bx = (triangles[idx + 2] - this.bounds.minX) * scale;
      const by = (triangles[idx + 3] - this.bounds.minY) * scale;
      const cx = (triangles[idx + 4] - this.bounds.minX) * scale;
      const cy = (triangles[idx + 5] - this.bounds.minY) * scale;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.closePath();

      const kind = types[i];
      const fill = kind ? palette[0] : palette[2] || '#ffffff';
      ctx.fillStyle = fill.replace('rgb', 'rgba').replace(')', kind ? ', 0.5)' : ', 0.35)');
      ctx.strokeStyle = kind ? palette[palette.length - 1] : palette[1] || '#ffffff';
      ctx.lineWidth = this.calm ? 0.5 : 0.8;
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

const explain = 'Penrose tilings force aperiodic order through matching rules on kite and dart shapes. Inflation replaces each tile with a scaled arrangement of kites/darts, converging to a non-repeating quasiperiodic pattern related to the golden ratio.';

export default {
  id: 'penrose',
  name: 'Penrose Kites & Darts',
  explain,
  create: (env, saved) => new PenroseDemo(env, saved),
};
