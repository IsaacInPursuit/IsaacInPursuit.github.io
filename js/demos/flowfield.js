// js/demos/flowfield.js
// Particle advection through a Perlin noise flow field.
import {
  setCanvasBackground,
  clamp,
  seededNoise2D,
  createSeededRng,
  pickPalette,
  getPaletteNames,
  generateSeed,
} from '../utils.js';

class FlowFieldDemo {
  constructor(env, saved = {}) {
    this.ctx = env.ctx;
    this.width = env.width;
    this.height = env.height;
    this.calm = Boolean(env.calm);

    this.seed = saved.seed ?? 13579;
    this.noiseScale = saved.noiseScale ?? 0.0016;
    this.speed = saved.speed ?? (this.calm ? 30 : 45);
    this.particleCount = saved.count ?? (this.calm ? 600 : 1200);
    this.paletteName = saved.palette ?? 'aurora';

    this.palette = pickPalette(this.paletteName);
    this.rng = createSeededRng(this.seed);
    this.noise = seededNoise2D(this.seed, 1);

    this.particles = [];
    this.pointer = { x: this.width / 2, y: this.height / 2, active: false };
    this.offset = { x: 0, y: 0 };

    this.initParticles();
  }

  getSettings() {
    return [
      { id: 'seed', label: 'Seed', type: 'integer', min: 1, max: 999999, value: this.seed },
      { id: 'noiseScale', label: 'Noise Scale', type: 'range', min: 0.0005, max: 0.004, step: 0.0001, value: this.noiseScale },
      { id: 'speed', label: 'Particle Speed', type: 'range', min: 10, max: 90, step: 1, value: this.speed },
      { id: 'count', label: 'Particles', type: 'range', min: 200, max: 2000, step: 50, value: this.particleCount },
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
      this.noise = seededNoise2D(this.seed, 1);
      this.initParticles();
    } else if (id === 'noiseScale') {
      this.noiseScale = Number(value);
    } else if (id === 'speed') {
      this.speed = Number(value);
    } else if (id === 'count') {
      this.particleCount = Math.round(value);
      this.initParticles();
    } else if (id === 'palette') {
      this.paletteName = value;
      this.palette = pickPalette(value);
    }
  }

  reset() {
    this.seed = generateSeed();
    this.rng = createSeededRng(this.seed);
    this.noise = seededNoise2D(this.seed, 1);
    this.initParticles();
  }

  setCalmMode(enabled) {
    this.calm = enabled;
    this.particleCount = enabled ? Math.min(this.particleCount, 800) : Math.max(this.particleCount, 1200);
    this.speed = enabled ? Math.min(this.speed, 35) : Math.max(this.speed, 45);
    this.initParticles();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i += 1) {
      this.particles.push({
        x: this.rng() * this.width,
        y: this.rng() * this.height,
        life: this.rng() * 200,
        color: this.palette[i % this.palette.length],
      });
    }
  }

  handleScroll({ deltaY, ctrlKey }) {
    if (ctrlKey) {
      const factor = Math.exp(-deltaY * 0.0012);
      this.noiseScale = clamp(this.noiseScale * factor, 0.0004, 0.006);
    } else {
      this.speed = clamp(this.speed + Math.sign(deltaY) * -3, 10, 100);
    }
    return true;
  }

  pointerDown(event) {
    this.pointer = { x: event.clientX, y: event.clientY, active: true };
  }

  pointerDrag(event) {
    this.pointer = { x: event.clientX, y: event.clientY, active: true };
  }

  pointerUp() {
    this.pointer.active = false;
  }

  update(dt) {
    const velocity = this.speed * dt;
    const influenceRadius = this.calm ? 120 : 200;

    for (const particle of this.particles) {
      const nx = (particle.x + this.offset.x) * this.noiseScale;
      const ny = (particle.y + this.offset.y) * this.noiseScale;
      const angle = this.noise(nx, ny) * Math.PI * 2;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;
      particle.x += vx;
      particle.y += vy;
      particle.life -= dt * 60;

      if (this.pointer.active) {
        const dx = this.pointer.x - particle.x;
        const dy = this.pointer.y - particle.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < influenceRadius * influenceRadius) {
          particle.x -= dx * 0.002;
          particle.y -= dy * 0.002;
        }
      }

      if (particle.x < -20 || particle.x > this.width + 20 || particle.y < -20 || particle.y > this.height + 20 || particle.life <= 0) {
        particle.x = this.rng() * this.width;
        particle.y = this.rng() * this.height;
        particle.life = 200 + this.rng() * 200;
      }
    }
  }

  render(ctx) {
    setCanvasBackground(ctx, this.width, this.height, 'rgba(2,3,6,0.16)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.2;

    for (const particle of this.particles) {
      ctx.strokeStyle = particle.color;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - 2, particle.y - 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

const explain = 'The flow field samples Perlin noise to build a continuously varying vector field. Particles advect along the curl-like streaks, a common technique for visualizing divergence-free fields and fluid motion. Calm mode reduces particle count and drift speed.';

export default {
  id: 'flowfield',
  name: 'Perlin Flow Field',
  explain,
  create: (env, saved) => new FlowFieldDemo(env, saved),
};
