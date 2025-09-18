(function (global) {
  function formatZoom(value) {
    if (value < 1) return `${value.toFixed(2)}×`;
    if (value < 1000) return `${value.toFixed(1)}×`;
    if (value < 1e6) return `${(value / 1000).toFixed(1)}k×`;
    return `${(value / 1e6).toFixed(2)}M×`;
  }

  const HIGHLIGHTS = [
    { label: 'Seahorse Valley', x: -0.743643887037151, y: 0.13182590420533, zoom: 1800 },
    { label: 'Electric Bloom', x: -0.745113, y: 0.112376, zoom: 5200 },
    { label: 'Elephant Twins', x: 0.27322626, y: 0.00798497, zoom: 520 },
    { label: 'Spiral Necklace', x: -0.10109636384562, y: 0.95628651080914, zoom: 1350 },
    { label: 'Celtic Spirals', x: -0.390541, y: -0.586788, zoom: 3400 },
    { label: 'Nebula Filaments', x: -1.25066, y: 0.02012, zoom: 640 },
  ];

  function chooseHighlight(exclude) {
    const options = HIGHLIGHTS.filter((h) => h !== exclude);
    if (!options.length) return exclude || HIGHLIGHTS[0];
    return options[Math.floor(Math.random() * options.length)];
  }

  function init() {
    const engineFactory = global.FractalEngine?.createFractalRenderer;
    if (typeof engineFactory !== 'function') return;

    const canvas = document.getElementById('fractal');
    const statusEl = document.getElementById('status');
    const autopilotBtn = document.getElementById('toggle-autopilot');
    const jumpBtn = document.getElementById('jump-highlight');
    const resetBtn = document.getElementById('reset-view');

    if (!canvas) return;

    const renderer = engineFactory(canvas, {
      baseCenter: { x: -0.745028, y: 0.18618 },
      baseZoom: 1.1,
      baseSpan: 3.3,
      minZoom: 0.45,
      tileBase: 64,
      minTileSize: 48,
      smoothingRate: 6,
    });

    if (!renderer) return;

    let autopilot = true;
    let activeHighlight = null;
    let autopilotPlan = null;
    let lastPinchDistance = null;
    const pointerSnapshots = new Map();

    const reduceMotionMedia = global.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduceMotionMedia?.matches) {
      autopilot = false;
    }

    const MIN_RENDERER_LOG_ZOOM = Math.log(0.45);
    const AUTOPILOT_LOG_DRIFT = 0.17;
    const AUTOPILOT_LINGER_AT_DEPTH = 1.8;
    const AUTOPILOT_RESET_PAUSE = 1.1;
    const AUTOPILOT_TILE_SETTLE_THRESHOLD = 8;
    const AUTOPILOT_APPROACH_DISTANCE_SCALE = 0.0012;
    const AUTOPILOT_APPROACH_ZOOM_EPS = 0.05;
    const AUTOPILOT_LINGER_ZOOM_EPS = 0.12;
    const AUTOPILOT_ASCEND_ZOOM_EPS = 0.1;
    const AUTOPILOT_OFFSET_FACTORS = {
      dive: 0.032,
      linger: 0.038,
      ascend: 0.026,
      reset: 0.014,
    };

    function updateAutopilotButton() {
      if (!autopilotBtn) return;
      autopilotBtn.dataset.state = autopilot ? 'on' : 'off';
      autopilotBtn.textContent = autopilot ? 'Pause autopilot' : 'Resume autopilot';
    }

    function updateStatus(state) {
      if (!statusEl) return;
      const zoomText = formatZoom(state.displayZoom);
      const modeText = autopilot ? 'Autopilot drifting' : 'Manual control';
      const highlightText = activeHighlight ? ` • ${activeHighlight.label}` : '';
      statusEl.textContent = `Zoom ${zoomText} • ${modeText}${highlightText}`;
      if (activeHighlight) {
        statusEl.setAttribute('data-highlight', activeHighlight.label);
      } else {
        statusEl.removeAttribute('data-highlight');
      }
    }

    function setAutopilot(value) {
      const next = Boolean(value);
      if (next === autopilot) return;
      autopilot = next;
      updateAutopilotButton();
      renderer.setSmoothingRate(autopilot ? 2.4 : 6);
      if (autopilot) {
        if (activeHighlight) {
          configureAutopilotDrift(activeHighlight);
        } else {
          jumpToHighlight(chooseHighlight(), { announce: false });
        }
      } else {
        renderer.snapToTarget();
      }
    }

    function beginManualInteraction() {
      if (autopilot) {
        setAutopilot(false);
      }
    }

    function configureAutopilotDrift(highlight, { immediate = false } = {}) {
      if (!highlight) {
        autopilotPlan = null;
        return;
      }
      const baseLogZoom = Math.log(Math.max(1e-6, highlight.zoom));
      const minLogZoom = Math.max(MIN_RENDERER_LOG_ZOOM, baseLogZoom - 0.55);
      const maxLogZoom = Math.max(minLogZoom + 0.9, baseLogZoom + 2.3);
      autopilotPlan = {
        highlight,
        baseLogZoom,
        minLogZoom,
        maxLogZoom,
        phase: immediate ? 'dive' : 'approach',
        holdTimer: 0,
        offsetSeed: Math.random() * Math.PI * 2,
      };
    }

    function jumpToHighlight(highlight, { announce = true } = {}) {
      if (!highlight) return;
      activeHighlight = highlight;
      configureAutopilotDrift(highlight);
      renderer.setTargetState({ center: { x: highlight.x, y: highlight.y }, zoom: highlight.zoom });
      renderer.invalidate();
      if (!autopilot) {
        renderer.snapToTarget();
      }
      if (announce && statusEl) {
        statusEl.setAttribute('data-highlight', highlight.label);
      }
    }

    function resetView() {
      activeHighlight = null;
      configureAutopilotDrift(null);
      renderer.resetView();
    }

    function handleWheel(event) {
      event.preventDefault();
      beginManualInteraction();
      const factor = Math.pow(1.18, -event.deltaY / 120);
      renderer.zoomAt(event.clientX, event.clientY, factor, { immediate: true });
    }

    function handlePointerDown(event) {
      beginManualInteraction();
      pointerSnapshots.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture?.(event.pointerId);
    }

    function handlePointerMove(event) {
      if (!pointerSnapshots.has(event.pointerId)) return;
      const snapshot = pointerSnapshots.get(event.pointerId);
      snapshot.x = event.clientX;
      snapshot.y = event.clientY;

      if (pointerSnapshots.size === 1) {
        const prev = snapshot.prev;
        if (prev) {
          const dx = event.clientX - prev.x;
          const dy = event.clientY - prev.y;
          if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
            renderer.panBy(dx, dy, { immediate: true });
          }
        }
        snapshot.prev = { x: event.clientX, y: event.clientY };
      } else if (pointerSnapshots.size === 2) {
        const pointers = Array.from(pointerSnapshots.values());
        const [first, second] = pointers;
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        const distance = Math.hypot(dx, dy);
        const midX = (first.x + second.x) / 2;
        const midY = (first.y + second.y) / 2;
        if (lastPinchDistance != null && distance > 0) {
          const scale = distance / lastPinchDistance;
          const factor = Math.pow(scale, 0.85);
          renderer.zoomAt(midX, midY, factor, { immediate: true });
        }
        lastPinchDistance = distance;
      }
    }

    function handlePointerUp(event) {
      pointerSnapshots.delete(event.pointerId);
      canvas.releasePointerCapture?.(event.pointerId);
      if (pointerSnapshots.size < 2) {
        lastPinchDistance = null;
      }
    }

    function handleKey(event) {
      if (event.code === 'Space') {
        event.preventDefault();
        setAutopilot(!autopilot);
      } else if (event.key === 'r' || event.key === 'R') {
        beginManualInteraction();
        resetView();
      } else if (event.key === 'j' || event.key === 'J') {
        beginManualInteraction();
        jumpToHighlight(chooseHighlight(activeHighlight));
      }
    }

    renderer.setController((engine, deltaSeconds = 0, now = 0) => {
      engine.setSmoothingRate(autopilot ? 2.4 : 6);

      if (!autopilot || !autopilotPlan?.highlight) return;

      if (autopilotPlan.highlight !== activeHighlight) {
        configureAutopilotDrift(activeHighlight || autopilotPlan.highlight);
      }

      const plan = autopilotPlan;
      if (!plan || !plan.highlight) return;

      const highlight = plan.highlight;
      const state = engine.getState();
      const baseSpan = state.baseSpan || 3.3;
      const targetZoom = Math.max(1e-6, state.targetZoom || 1);
      const spanX = baseSpan / targetZoom;
      const aspectRatio = state.cssWidth > 0 ? state.cssHeight / Math.max(1, state.cssWidth) : 1;
      const spanY = spanX * aspectRatio;
      const tilesRemaining = state.tilesRemaining ?? 0;
      const displayCenter = state.displayCenter || { x: highlight.x, y: highlight.y };
      const displayLogZoom = state.displayLogZoom ?? plan.baseLogZoom;
      const targetLogZoom = state.targetLogZoom ?? plan.baseLogZoom;
      const nowSeconds = now * 0.001;

      if (plan.phase === 'approach') {
        engine.setTargetState({ center: { x: highlight.x, y: highlight.y }, logZoom: plan.baseLogZoom });
        const distance = Math.hypot(displayCenter.x - highlight.x, displayCenter.y - highlight.y);
        const zoomDiff = Math.abs(displayLogZoom - plan.baseLogZoom);
        const spanTolerance = Math.max(spanX, spanY) * AUTOPILOT_APPROACH_DISTANCE_SCALE + 5e-8;
        if (
          distance < spanTolerance &&
          zoomDiff < AUTOPILOT_APPROACH_ZOOM_EPS &&
          tilesRemaining < AUTOPILOT_TILE_SETTLE_THRESHOLD
        ) {
          plan.phase = 'dive';
          plan.holdTimer = 0;
        }
        return;
      }

      const baseRadius = Number.isFinite(spanX) && Number.isFinite(spanY) ? Math.min(spanX, spanY) : 0;
      const factor = AUTOPILOT_OFFSET_FACTORS[plan.phase] ?? AUTOPILOT_OFFSET_FACTORS.ascend;
      const driftRadius = baseRadius * factor;
      const offsetX = Math.cos(nowSeconds * 0.17 + plan.offsetSeed) * driftRadius;
      const offsetY = Math.sin(nowSeconds * 0.21 + plan.offsetSeed * 0.65) * driftRadius;
      const centerTarget = { x: highlight.x + offsetX, y: highlight.y + offsetY };

      if (plan.phase === 'dive') {
        engine.setTargetState({ center: centerTarget });
        const remaining = plan.maxLogZoom - targetLogZoom;
        const step = Math.max(0, Math.min(remaining, AUTOPILOT_LOG_DRIFT * deltaSeconds));
        if (step > 0) {
          engine.nudgeTargetLogZoom(step);
        } else {
          engine.setTargetState({ logZoom: plan.maxLogZoom });
        }
        const nextTargetLog = targetLogZoom + step;
        const viewClose = Math.abs(displayLogZoom - plan.maxLogZoom) < AUTOPILOT_LINGER_ZOOM_EPS;
        if (nextTargetLog >= plan.maxLogZoom - 0.01 && viewClose && tilesRemaining < AUTOPILOT_TILE_SETTLE_THRESHOLD) {
          plan.phase = 'linger';
          plan.holdTimer = 0;
        }
        return;
      }

      if (plan.phase === 'linger') {
        engine.setTargetState({ center: centerTarget, logZoom: plan.maxLogZoom });
        plan.holdTimer += deltaSeconds;
        if (plan.holdTimer >= AUTOPILOT_LINGER_AT_DEPTH && tilesRemaining < AUTOPILOT_TILE_SETTLE_THRESHOLD) {
          plan.phase = 'ascend';
          plan.holdTimer = 0;
        }
        return;
      }

      if (plan.phase === 'ascend') {
        engine.setTargetState({ center: centerTarget });
        const remaining = targetLogZoom - plan.minLogZoom;
        const step = Math.max(0, Math.min(remaining, AUTOPILOT_LOG_DRIFT * deltaSeconds));
        if (step > 0) {
          engine.nudgeTargetLogZoom(-step);
        } else {
          engine.setTargetState({ logZoom: plan.minLogZoom });
        }
        const nextTargetLog = targetLogZoom - step;
        const viewClose = Math.abs(displayLogZoom - plan.minLogZoom) < AUTOPILOT_ASCEND_ZOOM_EPS;
        if (nextTargetLog <= plan.minLogZoom + 0.01 && viewClose && tilesRemaining < AUTOPILOT_TILE_SETTLE_THRESHOLD) {
          plan.phase = 'reset';
          plan.holdTimer = 0;
        }
        return;
      }

      if (plan.phase === 'reset') {
        engine.setTargetState({ center: centerTarget, logZoom: plan.minLogZoom });
        plan.holdTimer += deltaSeconds;
        if (plan.holdTimer >= AUTOPILOT_RESET_PAUSE && tilesRemaining < AUTOPILOT_TILE_SETTLE_THRESHOLD) {
          const nextHighlight = chooseHighlight(highlight);
          plan.holdTimer = 0;
          if (autopilot && nextHighlight && nextHighlight !== highlight) {
            jumpToHighlight(nextHighlight);
          }
        }
        return;
      }
    });

    renderer.setStateListener((state) => {
      updateStatus(state);
    });

    function resize() {
      const width = window.innerWidth || document.documentElement.clientWidth || 800;
      const height = window.innerHeight || document.documentElement.clientHeight || 600;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setSize({ width, height, dpr });
    }

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    document.addEventListener('keydown', handleKey);

    autopilotBtn?.addEventListener('click', () => {
      setAutopilot(!autopilot);
    });

    jumpBtn?.addEventListener('click', () => {
      beginManualInteraction();
      jumpToHighlight(chooseHighlight(activeHighlight));
    });

    resetBtn?.addEventListener('click', () => {
      beginManualInteraction();
      resetView();
    });

    if (reduceMotionMedia) {
      const handleReduceChange = (event) => {
        if (event.matches) {
          setAutopilot(false);
        }
      };
      if (typeof reduceMotionMedia.addEventListener === 'function') {
        reduceMotionMedia.addEventListener('change', handleReduceChange);
      } else if (typeof reduceMotionMedia.addListener === 'function') {
        reduceMotionMedia.addListener(handleReduceChange);
      }
    }

    updateAutopilotButton();
    if (autopilot) {
      jumpToHighlight(chooseHighlight(), { announce: false });
    } else {
      resetView();
    }

    renderer.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
