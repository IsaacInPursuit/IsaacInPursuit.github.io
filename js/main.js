import {
  TAU,
  setCanvasSize,
  createSeededRng,
  createFPSCounter,
  formatFPS,
  throttle,
  downloadCanvasPNG,
  prefersReducedMotion,
  listenPrefersReducedMotion,
  storeState,
  loadState,
  detectMobile,
  autoDropCalmMode,
} from './utils.js';

import phyllotaxisDemo from './demos/phyllotaxis.js';
import modularCircleDemo from './demos/mod-mult-circle.js';
import lissajousDemo from './demos/lissajous.js';
import epicycleDemo from './demos/epicycles.js';
import ulamDemo from './demos/ulam.js';
import hilbertDemo from './demos/hilbert.js';
import kochDemo from './demos/koch.js';
import voronoiDemo from './demos/voronoi.js';
import penroseDemo from './demos/penrose.js';
import moireDemo from './demos/moire.js';
import flowFieldDemo from './demos/flowfield.js';
import goldenGridDemo from './demos/golden-grid.js';

const demos = [
  phyllotaxisDemo,
  modularCircleDemo,
  lissajousDemo,
  epicycleDemo,
  ulamDemo,
  hilbertDemo,
  kochDemo,
  voronoiDemo,
  penroseDemo,
  moireDemo,
  flowFieldDemo,
  goldenGridDemo,
];

const canvas = document.getElementById('demo-canvas');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const demoSelect = document.getElementById('demo-select');
const playPauseBtn = document.getElementById('play-pause');
const calmToggle = document.getElementById('calm-toggle');
const fpsMeter = document.getElementById('fps-meter');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-demo');
const settingsForm = document.getElementById('settings-form');
const settingsTitle = document.getElementById('settings-title');
const explainCheckbox = document.getElementById('explain-checkbox');
const explainPanel = document.getElementById('explain-panel');
const explainTitle = document.getElementById('explain-title');
const explainContent = document.getElementById('explain-content');

const storageKeys = {
  demo: 'math-gallery:demo',
  calm: 'math-gallery:calm-mode',
  settings: 'math-gallery:settings',
  explain: 'math-gallery:explain',
};

const state = {
  current: null,
  demoIndex: 0,
  isPlaying: true,
  calmMode: false,
  shouldExplain: false,
  fpsCounter: createFPSCounter(),
  lastFrame: performance.now(),
  autoDrop: null,
  mobile: detectMobile(),
  size: { width: window.innerWidth, height: window.innerHeight, dpr: 1 },
  storedSettings: loadState(storageKeys.settings, {}),
  autoPaused: false,
  fpsTimer: 0,
};

let pointerDown = false;
let pointerId = null;
let rafHandle = null;

function init() {
  demos.forEach((demo, index) => {
    const option = document.createElement('option');
    option.value = demo.id;
    option.textContent = demo.name;
    option.dataset.index = index;
    demoSelect.append(option);
  });

  const storedDemo = loadState(storageKeys.demo, demos[0].id);
  const storedCalm = loadState(storageKeys.calm, null);
  const storedExplain = loadState(storageKeys.explain, false);
  state.calmMode = storedCalm !== null ? storedCalm : prefersReducedMotion() || state.mobile;
  calmToggle.checked = state.calmMode;
  state.shouldExplain = storedExplain;
  explainCheckbox.checked = state.shouldExplain;

  const defaultIndex = Math.max(0, demos.findIndex((demo) => demo.id === storedDemo));
  state.demoIndex = defaultIndex === -1 ? 0 : defaultIndex;
  demoSelect.value = demos[state.demoIndex].id;

  handleResize();
  swapDemo(state.demoIndex);

  playPauseBtn.addEventListener('click', togglePlay);
  calmToggle.addEventListener('change', (event) => {
    setCalmMode(event.target.checked, { userInitiated: true });
  });
  downloadBtn.addEventListener('click', () => {
    const descriptor = state.current?.descriptor;
    const name = descriptor ? `${descriptor.id}.png` : 'math-demo.png';
    downloadCanvasPNG(canvas, name);
  });
  resetBtn.addEventListener('click', () => {
    state.current?.instance?.reset?.();
    rebuildSettings();
  });
  explainCheckbox.addEventListener('change', (event) => {
    state.shouldExplain = event.target.checked;
    storeState(storageKeys.explain, state.shouldExplain);
    updateExplainPanel();
  });
  demoSelect.addEventListener('change', (event) => {
    const index = demos.findIndex((demo) => demo.id === event.target.value);
    if (index !== -1) {
      swapDemo(index);
    }
  });

  window.addEventListener('resize', throttle(handleResize, 150));

  canvas.addEventListener('wheel', (event) => {
    if (state.current?.instance?.handleScroll) {
      event.preventDefault();
      const handled = state.current.instance.handleScroll({
        deltaY: event.deltaY,
        deltaX: event.deltaX,
        ctrlKey: event.ctrlKey || event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        originalEvent: event,
      });
      if (handled) return;
    }
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    state.current?.instance?.pointerDown?.(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!pointerDown || pointerId !== event.pointerId) {
      state.current?.instance?.pointerMove?.(event);
      return;
    }
    state.current?.instance?.pointerDrag?.(event);
  });

  const endPointer = (event) => {
    if (pointerId !== event.pointerId) return;
    pointerDown = false;
    state.current?.instance?.pointerUp?.(event);
    try {
      canvas.releasePointerCapture(pointerId);
    } catch (error) {
      // ignore
    }
  };

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.isPlaying) {
        state.autoPaused = true;
        togglePlay(false);
      }
    } else if (state.autoPaused) {
      state.autoPaused = false;
      togglePlay(true);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      togglePlay(!state.isPlaying);
    } else if (event.code === 'ArrowRight') {
      const next = (state.demoIndex + 1) % demos.length;
      swapDemo(next);
    } else if (event.code === 'ArrowLeft') {
      const next = (state.demoIndex - 1 + demos.length) % demos.length;
      swapDemo(next);
    } else if (event.code === 'KeyS') {
      event.preventDefault();
      downloadBtn.click();
    }
  });

  listenPrefersReducedMotion((matches) => {
    if (matches && !state.calmMode) {
      setCalmMode(true, { system: true });
    }
  });

  setupAutoCalmWatcher();
  requestAnimationFrame(loop);
}

function setupAutoCalmWatcher() {
  state.autoDrop = autoDropCalmMode({
    fps: () => state.fpsCounter,
    calmMode: () => state.calmMode,
    onDrop: () => setCalmMode(true, { auto: true }),
  });
}

function handleResize() {
  state.size = setCanvasSize(canvas, window.innerWidth, window.innerHeight, { maxDpr: 2 });
  state.current?.instance?.resize?.({ ...state.size });
}

function swapDemo(index) {
  const descriptor = demos[index];
  if (!descriptor) return;
  state.current?.instance?.dispose?.();
  state.demoIndex = index;
  state.current = {
    descriptor,
    instance: null,
  };
  settingsTitle.textContent = descriptor.name;
  demoSelect.value = descriptor.id;
  storeState(storageKeys.demo, descriptor.id);

  const context = {
    canvas,
    ctx,
    width: state.size.width,
    height: state.size.height,
    dpr: state.size.dpr,
    calm: state.calmMode,
    createSeededRng,
    utils: {
      TAU,
      setCanvasSize,
    },
    mobile: state.mobile,
  };

  const saved = state.storedSettings[descriptor.id] || {};
  const instance = descriptor.create(context, saved);
  state.current.instance = instance;
  state.current.descriptor = descriptor;
  instance?.resize?.({ ...state.size });
  instance?.setCalmMode?.(state.calmMode);
  rebuildSettings();
  updateExplainPanel();
}

function rebuildSettings() {
  const descriptor = state.current?.descriptor;
  const instance = state.current?.instance;
  settingsForm.innerHTML = '';
  if (!descriptor || !instance) return;
  const settings = instance.getSettings?.() || [];
  const stored = state.storedSettings[descriptor.id] || {};
  const convertValue = (setting, input) => {
    if (setting.type === 'checkbox') return Boolean(input);
    if (setting.type === 'select') return input;
    if (setting.type === 'range' || setting.type === 'number') return Number(input);
    if (setting.type === 'integer') return Math.round(Number(input));
    return input;
  };

  settings.forEach((setting) => {
    const value = stored[setting.id] ?? setting.value;
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.textContent = setting.label;
    label.htmlFor = `setting-${setting.id}`;
    field.append(label);

    let input;
    if (setting.type === 'select') {
      input = document.createElement('select');
      setting.options.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        input.append(opt);
      });
      input.value = value;
    } else if (setting.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(value);
    } else {
      input = document.createElement('input');
      if (setting.type === 'range') {
        input.type = 'range';
      } else if (setting.type === 'integer') {
        input.type = 'number';
        input.step = '1';
      } else {
        input.type = setting.inputType || setting.type || 'number';
      }
      if (setting.min !== undefined) input.min = setting.min;
      if (setting.max !== undefined) input.max = setting.max;
      if (setting.step !== undefined) input.step = setting.step;
      input.value = value;
    }

    input.id = `setting-${setting.id}`;
    input.addEventListener('change', (event) => {
      const raw = setting.type === 'checkbox' ? event.target.checked : event.target.value;
      const newValue = convertValue(setting, raw);
      instance.updateSetting?.(setting.id, newValue);
      const storedSettings = state.storedSettings[descriptor.id] || {};
      storedSettings[setting.id] = newValue;
      state.storedSettings[descriptor.id] = storedSettings;
      storeState(storageKeys.settings, state.storedSettings);
    });

    if (setting.hint) {
      const hint = document.createElement('small');
      hint.textContent = setting.hint;
      field.append(hint);
    }

    field.append(input);
    settingsForm.append(field);

    const applied = convertValue(setting, setting.type === 'checkbox' ? input.checked : input.value);
    instance.updateSetting?.(setting.id, applied, { initial: true });
  });
}

function togglePlay(next = !state.isPlaying) {
  state.isPlaying = next;
  playPauseBtn.textContent = state.isPlaying ? 'Pause' : 'Play';
  playPauseBtn.setAttribute('aria-pressed', String(!state.isPlaying));
  if (state.isPlaying) {
    state.lastFrame = performance.now();
    state.fpsCounter.reset();
    requestAnimationFrame(loop);
  }
}

function setCalmMode(enabled, reason = {}) {
  state.calmMode = enabled;
  calmToggle.checked = enabled;
  storeState(storageKeys.calm, enabled);
  state.current?.instance?.setCalmMode?.(enabled, reason);
}

function updateExplainPanel() {
  const descriptor = state.current?.descriptor;
  if (!descriptor) return;
  if (!state.shouldExplain) {
    explainPanel.hidden = true;
    return;
  }
  explainPanel.hidden = false;
  explainTitle.textContent = descriptor.name;
  const explanation = descriptor.explain ?? '';
  if (typeof explanation === 'string') {
    explainContent.textContent = explanation;
  } else if (Array.isArray(explanation)) {
    explainContent.innerHTML = explanation.map((paragraph) => `<p>${paragraph}</p>`).join('');
  } else if (typeof explanation === 'function') {
    explainContent.innerHTML = explanation();
  }
}

function loop(now) {
  if (!state.isPlaying) {
    rafHandle = requestAnimationFrame(loop);
    return;
  }
  const delta = Math.min((now - state.lastFrame) / 1000, 0.1);
  state.lastFrame = now;

  const fps = state.fpsCounter.frame();
  state.fpsTimer += delta;
  if (state.fpsTimer > 0.25) {
    fpsMeter.textContent = `${formatFPS(fps)} FPS`;
    state.fpsTimer = 0;
  }

  state.current?.instance?.update?.(delta, now / 1000);
  state.current?.instance?.render?.(ctx, state.size);

  state.autoDrop?.(delta);

  rafHandle = requestAnimationFrame(loop);
}

init();
