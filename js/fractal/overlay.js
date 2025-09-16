(function (global) {
  function parseCssColor(value) {
    if (!value) return null;
    const color = value.trim();
    if (!color) return null;
    const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((char) => char + char)
          .join('');
      }
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return { r, g, b };
      }
    }
    const rgbMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (rgbMatch) {
      const clamp = (v) => Math.max(0, Math.min(255, v | 0));
      const r = clamp(parseInt(rgbMatch[1], 10));
      const g = clamp(parseInt(rgbMatch[2], 10));
      const b = clamp(parseInt(rgbMatch[3], 10));
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return { r, g, b };
      }
    }
    return null;
  }

  function createBackdropDrawer(root) {
    return function drawBackdrop(ctx, width, height, state) {
      const styles = root ? getComputedStyle(root) : null;
      const bg = styles?.getPropertyValue('--fract-bg').trim() || '#020617';
      const fgColor =
        parseCssColor(styles?.getPropertyValue('--fract-fg')) ||
        { r: 224, g: 242, b: 254 };

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(
        width * 0.48,
        height * 0.52,
        Math.max(width, height) * 0.05,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.65
      );
      const alpha = state.reduceMotion ? 0.08 : 0.18;
      glow.addColorStop(0, `rgba(${fgColor.r}, ${fgColor.g}, ${fgColor.b}, ${alpha})`);
      glow.addColorStop(0.6, 'rgba(15,23,42,0.18)');
      glow.addColorStop(1, 'rgba(2,6,23,0.92)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    };
  }

  function samplePalette(t, phase, boost) {
    const TAU = Math.PI * 2;
    const wave = phase + t * TAU;
    const wave2 = wave + 2.09439510239;
    const wave3 = wave + 4.18879020479;
    const base = Math.pow(t, 0.32);
    const accent = Math.pow(t, 0.65);
    const r = Math.round(255 * Math.min(1, 0.17 + boost * (0.55 * base + 0.45 * (0.5 + 0.5 * Math.sin(wave)))));
    const g = Math.round(255 * Math.min(1, 0.18 + boost * (0.58 * base + 0.42 * (0.5 + 0.5 * Math.sin(wave2)))));
    const b = Math.round(255 * Math.min(1, 0.22 + boost * (0.62 * accent + 0.38 * (0.5 + 0.5 * Math.sin(wave3)))));
    return [r, g, b];
  }

  function init() {
    const engineFactory = global.FractalEngine?.createFractalRenderer;
    if (typeof engineFactory !== 'function') return;

    const wrap = document.getElementById('fractalOverlay');
    const canvas = document.getElementById('fractalCanvas');
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const toggleButton = document.querySelector('[data-fractal-toggle]');
    const collapseButton = wrap.querySelector('[data-fractal-collapse]');
    const closeButton = wrap.querySelector('[data-fractal-close]');
    const expandButton = wrap.querySelector('[data-fractal-expand]');
    const themeButton = document.getElementById('themeToggle');

    const AUTO_COLLAPSE_BREAKPOINT = 640;
    const BASE_CENTER = { x: -0.745028, y: 0.18618 };
    const BASE_ZOOM = 1.2;
    const BASE_SPAN = 3.3;
    const MIN_ZOOM = 0.45;
    const AUTOPILOT_RATE = 0.085;
    const MANUAL_COOLDOWN = 2.2;

    let enabled = false;
    let collapsed = false;
    let collapsedPreference = null;
    let manualCooldown = 0;
    let reduceMotion = false;
    let frameObserver = null;

    const renderer = engineFactory(canvas, {
      baseCenter: BASE_CENTER,
      baseZoom: BASE_ZOOM,
      baseSpan: BASE_SPAN,
      minZoom: MIN_ZOOM,
      tileBase: 56,
      minTileSize: 48,
      smoothingRate: 5,
      drawBackdrop: createBackdropDrawer(document.documentElement),
      samplePalette,
    });

    if (!renderer) return;

    renderer.setStateListener(() => {
      // no-op for now but keeps reference so future hooks can be added easily.
    });

    renderer.setController((engine, deltaSeconds, now) => {
      const state = engine.getState(deltaSeconds, now);
      manualCooldown = Math.max(0, manualCooldown - deltaSeconds);
      if (manualCooldown <= 0) {
        const rate = state.reduceMotion ? 0.02 : AUTOPILOT_RATE;
        engine.nudgeTargetLogZoom(rate * deltaSeconds);
        const drift = now * 0.00005;
        const center = {
          x: BASE_CENTER.x + Math.sin(drift) * 0.00055,
          y: BASE_CENTER.y + Math.cos(drift * 0.8) * 0.00045,
        };
        engine.setTargetState({ center });
      }
    });

    function freezeAutopilot() {
      manualCooldown = MANUAL_COOLDOWN;
    }

    function updateToggleButton() {
      if (!toggleButton) return;
      toggleButton.setAttribute('data-state', enabled ? 'active' : 'inactive');
      toggleButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      toggleButton.setAttribute('aria-label', enabled ? 'Hide fractal zoom demo' : 'Launch fractal zoom demo');
      toggleButton.setAttribute(
        'title',
        enabled
          ? 'Hide the fractal zoom lab'
          : 'Launch the fractal zoom lab (scroll to zoom out, press space to shift colors)'
      );
      const labelEl = toggleButton.querySelector('[data-fractal-toggle-label]');
      if (labelEl) {
        labelEl.textContent = enabled ? 'Hide fractal zoom' : 'Launch fractal zoom';
      }
    }

    function applyCollapseState(next, { fromUser = false } = {}) {
      const value = Boolean(next);
      if (fromUser) {
        collapsedPreference = value;
      }
      if (collapseButton) {
        collapseButton.setAttribute('aria-expanded', (!value).toString());
      }
      if (expandButton) {
        expandButton.setAttribute('aria-expanded', (!value).toString());
      }
      if (value === collapsed) {
        return;
      }
      collapsed = value;
      wrap.dataset.collapsed = value ? 'true' : 'false';
      if (value) {
        canvas.setAttribute('aria-hidden', 'true');
        if (enabled) {
          renderer.stop();
        }
      } else {
        canvas.removeAttribute('aria-hidden');
        if (enabled) {
          renderer.invalidate();
          renderer.start();
        }
      }
    }

    function handleResize() {
      if (!enabled || collapsed) return;
      if (collapsedPreference === null) {
        const shouldCollapse = window.innerWidth < AUTO_COLLAPSE_BREAKPOINT;
        if (shouldCollapse !== collapsed) {
          applyCollapseState(shouldCollapse);
        }
      }

      const padding = window.innerWidth < 640 ? 28 : 48;
      const availableWidth = Math.max(320, window.innerWidth - padding);
      const width = Math.min(availableWidth, 1100);
      const height = Math.max(320, Math.min(640, width * 0.62, window.innerHeight * 0.65));
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize({ width, height, dpr });
    }

    function cyclePalette() {
      renderer.cyclePalette();
      renderer.invalidate();
    }

    function handleWheel(event) {
      if (!enabled || collapsed) return;
      event.preventDefault();
      freezeAutopilot();
      const delta = event.deltaY;
      const factor = Math.pow(1.18, -delta / 120);
      renderer.zoomAt(event.clientX, event.clientY, factor, { immediate: true });
    }

    function handleKeyDown(event) {
      if (!enabled) return;
      if (event.key === 'Escape') {
        disable();
      } else if (event.code === 'Space') {
        event.preventDefault();
        freezeAutopilot();
        cyclePalette();
      }
    }

    function enable() {
      if (enabled) return;
      enabled = true;
      wrap.dataset.enabled = 'true';
      wrap.setAttribute('aria-hidden', 'false');
      collapsedPreference = null;
      applyCollapseState(window.innerWidth < AUTO_COLLAPSE_BREAKPOINT);
      manualCooldown = 0;
      renderer.resetView();
      if (!collapsed) {
        renderer.start();
        handleResize();
      } else {
        renderer.stop();
      }
      window.addEventListener('resize', handleResize);
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('keydown', handleKeyDown);
      updateToggleButton();
    }

    function disable() {
      if (!enabled) return;
      enabled = false;
      wrap.dataset.enabled = 'false';
      wrap.setAttribute('aria-hidden', 'true');
      applyCollapseState(false);
      collapsedPreference = null;
      manualCooldown = 0;
      renderer.stop();
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      updateToggleButton();
    }

    function toggle() {
      if (enabled) {
        disable();
      } else {
        enable();
      }
    }

    toggleButton?.addEventListener('click', toggle);
    collapseButton?.addEventListener('click', () => {
      if (!enabled) return;
      applyCollapseState(true, { fromUser: true });
    });
    expandButton?.addEventListener('click', () => {
      if (!enabled) {
        enable();
        return;
      }
      applyCollapseState(false, { fromUser: true });
      handleResize();
      if (!frameObserver) {
        frameObserver = requestAnimationFrame(() => {
          frameObserver = null;
          renderer.invalidate();
        });
      }
    });
    closeButton?.addEventListener('click', disable);

    const reduceMotionMedia = global.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduceMotionMedia) {
      reduceMotion = reduceMotionMedia.matches;
      renderer.setReduceMotion(reduceMotion);
      const handleReduceChange = (event) => {
        reduceMotion = event.matches;
        renderer.setReduceMotion(reduceMotion);
      };
      if (typeof reduceMotionMedia.addEventListener === 'function') {
        reduceMotionMedia.addEventListener('change', handleReduceChange);
      } else if (typeof reduceMotionMedia.addListener === 'function') {
        reduceMotionMedia.addListener(handleReduceChange);
      }
    }

    const schemeMedia = global.matchMedia?.('(prefers-color-scheme: dark)');
    if (schemeMedia) {
      const handleSchemeChange = () => {
        if (enabled && !collapsed) {
          renderer.invalidate();
        }
      };
      if (typeof schemeMedia.addEventListener === 'function') {
        schemeMedia.addEventListener('change', handleSchemeChange);
      } else if (typeof schemeMedia.addListener === 'function') {
        schemeMedia.addListener(handleSchemeChange);
      }
    }

    if (themeButton) {
      themeButton.addEventListener('click', () => {
        if (enabled && !collapsed) {
          renderer.invalidate();
        }
      });
    }

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        if (enabled && !collapsed) {
          renderer.invalidate();
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      window.addEventListener(
        'beforeunload',
        () => {
          observer.disconnect();
        },
        { once: true }
      );
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && enabled && !collapsed) {
        manualCooldown = 0;
        renderer.invalidate();
      }
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted && enabled && !collapsed) {
        manualCooldown = 0;
        renderer.invalidate();
        handleResize();
      }
    });

    if (global.innerWidth >= AUTO_COLLAPSE_BREAKPOINT) {
      // Preload canvas sizing so the first enable feels instant.
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const padding = window.innerWidth < 640 ? 28 : 48;
      const availableWidth = Math.max(320, window.innerWidth - padding);
      const width = Math.min(availableWidth, 1100);
      const height = Math.max(320, Math.min(640, width * 0.62, window.innerHeight * 0.65));
      renderer.setSize({ width, height, dpr });
    }

    updateToggleButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
