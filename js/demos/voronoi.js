// js/demos/voronoi.js
// Voronoi diagram with Lloyd relaxation performed in a worker.
import {
  pickPalette,
  getPaletteNames,
  setCanvasBackground,
  createSeededRng,
  clamp,
  generateSeed,
} from '../utils.js';

const workerUrl = new URL('../../workers/voronoi.js', import.meta.url);

class VoronoiDemo {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 424242;
    this.siteCount = saved.count ?? (this.calm ? 40 : 70);
    this.iterations = saved.iterations ?? (this.calm ? 1 : 2);
    this.paletteName = saved.palette ?? 'meadow';
    this.showEdges = saved.showEdges ?? true;

    this.palette = pickPalette(this.paletteName);
    this.rng = createSeededRng(this.seed);

    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'result') {
        this.sites = new Float32Array(data.sites);
        this.polygons = new Float32Array(data.polygons);
        this.offsets = new Uint32Array(data.offsets);
        this.counts = new Uint16Array(data.counts);
        this.edges = new Float32Array(data.edges);
        this.pending = false;
      }
    };

    this.sites = new Float32Array();
    this.polygons = new Float32Array();
    this.offsets = new Uint32Array();
    this.counts = new Uint16Array();
    this.edges = new Float32Array();
    this.pending = false;

    this.generateSites();
    this.computeDiagram();
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999, value: this.seed },
      { id: 'count', label: 'Sites', type: 'range', min: 10, max: 120, step: 5, value: this.siteCount },
      { id: 'iterations', label: 'Lloyd Iterations', type: 'range', min: 0, max: 3, step: 1, value: this.iterations },
      { id: 'showEdges', label: 'Show Delaunay edges', type: 'checkbox', value: this.showEdges },
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
      this.generateSites();
      this.computeDiagram();
    } else if (id === 'count') {
      this.siteCount = Math.round(value);
      this.generateSites();
      this.computeDiagram();
    } else if (id === 'iterations') {
      this.iterations = Math.round(value);
      this.computeDiagram();
    } else if (id === 'palette') {
      this.paletteName = value;
      this.palette = pickPalette(value);
    } else if (id === 'showEdges') {
      this.showEdges = Boolean(value);
    }
  }

  reset() {
    this.seed = generateSeed();
    this.rng = createSeededRng(this.seed);
    this.generateSites();
    this.computeDiagram();
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.siteCount = enabled ? Math.min(this.siteCount, 45) : Math.max(this.siteCount, 65);
    this.iterations = enabled ? Math.min(this.iterations, 1) : Math.max(this.iterations, 2);
    this.generateSites();
    this.computeDiagram();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
    this.computeDiagram();
  }

  dispose() {
    this.worker?.terminate();
  }

  generateSites() {
    const sites = new Float32Array(this.siteCount * 2);
    for (let i = 0; i < this.siteCount; i += 1) {
      sites[i * 2] = this.rng();
      sites[i * 2 + 1] = this.rng();
    }
    this.baseSites = sites;
  }

  computeDiagram() {
    if (!this.worker) return;
    this.pending = true;
    const points = this.baseSites.slice();
    this.worker.postMessage(
      {
        type: 'compute',
        points,
        iterations: this.iterations,
      },
      [points.buffer]
    );
  }

  handleScroll({ deltaY }) {
    const direction = Math.sign(deltaY);
    this.iterations = clamp(this.iterations + direction * -1, 0, 3);
    this.computeDiagram();
    return true;
  }

  update(dt) {
    this.time = (this.time || 0) + dt;
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, '#04060f');
    if (!this.counts.length) {
      if (this.pending) {
        ctx.save();
        ctx.fillStyle = '#ffffffaa';
        ctx.font = '600 14px "Inter", system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Computing Voronoi…', this.width / 2, this.height / 2);
        ctx.restore();
      }
      return;
    }

    const palette = this.palette;
    ctx.save();
    ctx.lineJoin = 'round';

    for (let i = 0; i < this.counts.length; i += 1) {
      const count = this.counts[i];
      const offset = this.offsets[i];
      ctx.beginPath();
      for (let j = 0; j < count; j += 1) {
        const x = this.polygons[(offset + j) * 2] * this.width;
        const y = this.polygons[(offset + j) * 2 + 1] * this.height;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const color = palette[i % palette.length];
      const pulse = 0.08 * Math.sin(this.time * 0.5 + i * 0.3);
      ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', `, ${0.28 + pulse})`);
      ctx.fill();
      ctx.strokeStyle = color.replace('rgb', 'rgba').replace(')', ', 0.5)');
      ctx.lineWidth = this.calm ? 0.7 : 1;
      ctx.stroke();
    }

    if (this.showEdges && this.edges.length) {
      ctx.lineWidth = this.calm ? 0.6 : 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      for (let i = 0; i < this.edges.length; i += 4) {
        const x1 = this.edges[i] * this.width;
        const y1 = this.edges[i + 1] * this.height;
        const x2 = this.edges[i + 2] * this.width;
        const y2 = this.edges[i + 3] * this.height;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

const explain = 'Voronoi regions contain points closer to their generator than any other. Lloyd relaxation repeatedly replaces each site with the centroid of its cell, converging to centroidal Voronoi tessellations used in blue-noise sampling and mesh generation.';

export default {
  id: 'voronoi',
  name: 'Voronoi + Delaunay',
  explain,
  create: (env, saved) => new VoronoiDemo(env, saved),
};
