(function (global) {
  const ESCAPE_RADIUS = 4;
  const LOG2 = Math.log(2);
  const TAU = Math.PI * 2;
  const precision = global.FractalPrecision || {};
  const DoubleDouble = precision.DoubleDouble || null;
  const HIGH_PRECISION_PIXEL_THRESHOLD = DoubleDouble?.SWITCH_PIXEL_THRESHOLD || 2e-14;

  function defaultDrawBackdrop(ctx, width, height) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(
      width * 0.52,
      height * 0.48,
      Math.max(width, height) * 0.1,
      width * 0.5,
      height * 0.52,
      Math.max(width, height) * 0.75
    );
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
    glow.addColorStop(0.55, 'rgba(15, 23, 42, 0.18)');
    glow.addColorStop(1, 'rgba(2, 6, 23, 0.92)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function defaultSamplePalette(t, phase, boost) {
    const wave = phase + t * TAU;
    const wave2 = wave + 2.09439510239;
    const wave3 = wave + 4.18879020479;
    const base = Math.pow(t, 0.3);
    const accent = Math.pow(t, 0.65);
    const r = Math.round(255 * Math.min(1, 0.2 + boost * (0.55 * base + 0.45 * (0.5 + 0.5 * Math.sin(wave)))));
    const g = Math.round(255 * Math.min(1, 0.18 + boost * (0.58 * base + 0.42 * (0.5 + 0.5 * Math.sin(wave2)))));
    const b = Math.round(255 * Math.min(1, 0.22 + boost * (0.62 * accent + 0.38 * (0.5 + 0.5 * Math.sin(wave3)))));
    return [r, g, b];
  }

  function defaultInteriorShade(cx, cy, center, spanX, spanY) {
    const radial = Math.hypot(cx - center.x, cy - center.y) / Math.max(spanX, spanY);
    return Math.max(8, Math.min(120, 6 + Math.floor(42 * Math.pow(1 - Math.min(1, radial * 2), 1.5))));
  }

  function defaultMaxIterations(zoom, state = {}) {
    const safeZoom = Math.max(1, Number.isFinite(zoom) ? zoom : 1);
    const logZoom = Math.log10(safeZoom);
    const baseline = 120 + logZoom * 45;
    const superLinear = Math.pow(Math.max(0, logZoom - 0.7), 3.1) * 75;

    let densityBoost = 0;
    const spanHint = state?.minPixelSpan;
    let minPixelSpan = spanHint;
    if (!Number.isFinite(minPixelSpan) || minPixelSpan == null || minPixelSpan <= 0) {
      const px = Math.abs(state?.pixelSpanX ?? 0);
      const py = Math.abs(state?.pixelSpanY ?? 0);
      const fallback = Math.min(px || Infinity, py || Infinity);
      if (Number.isFinite(fallback) && fallback > 0) {
        minPixelSpan = fallback;
      }
    }
    if (Number.isFinite(minPixelSpan) && minPixelSpan > 0) {
      const density = Math.log10(1 / minPixelSpan);
      if (density > 6) {
        densityBoost = Math.pow(density - 6, 2.2) * 20;
      }
    }

    const total = baseline + superLinear + densityBoost;
    return Math.max(120, Math.min(60000, Math.floor(total)));
  }

  function defaultTileBatch(width, height) {
    return Math.max(3, Math.floor((width * height) / 200000));
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function createFractalRenderer(canvas, options = {}) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    const buffer = document.createElement('canvas');
    const bufferCtx = buffer.getContext('2d', { alpha: false });
    if (!bufferCtx) return null;

    const baseCenter = options.baseCenter || { x: -0.745028, y: 0.18618 };
    const baseSpan = options.baseSpan || 3.3;
    const baseZoom = options.baseZoom || 1;
    const minZoom = options.minZoom || 0.45;
    const maxZoom = options.maxZoom && Number.isFinite(options.maxZoom) ? options.maxZoom : null;
    const minLogZoom = Math.log(Math.max(1e-6, minZoom));
    const maxLogZoom = maxZoom ? Math.log(Math.max(maxZoom, minZoom)) : Math.log(1e306);
    const tileBase = options.tileBase || 64;
    const minTileSize = options.minTileSize || 48;
    const smoothingRateDefault = options.smoothingRate || 5;
    const tileBatchFn = typeof options.tileBatch === 'function' ? options.tileBatch : defaultTileBatch;
    const drawBackdrop = typeof options.drawBackdrop === 'function' ? options.drawBackdrop : defaultDrawBackdrop;
    const samplePalette = typeof options.samplePalette === 'function' ? options.samplePalette : defaultSamplePalette;
    const interiorShade = typeof options.interiorShade === 'function' ? options.interiorShade : defaultInteriorShade;
    const maxIterations = typeof options.maxIterations === 'function' ? options.maxIterations : defaultMaxIterations;

    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let tileSize = tileBase;
    let tiles = [];
    let needsTileRebuild = true;
    let needsBackdrop = true;
    let running = false;
    let frameHandle = null;
    let lastFrame = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    let paletteSeed = options.paletteSeed ?? Math.random() * TAU;
    let palettePhase = 0;
    let reduceMotion = Boolean(options.reduceMotion);
    let smoothingRate = smoothingRateDefault;
    let skipSmoothing = 0;
    let controller = null;
    let stateListener = null;
    let presentDirty = false;
    let hasRenderedTiles = false;
    let tilesDrawnLastFrame = 0;

    const targetCenter = { x: baseCenter.x, y: baseCenter.y };
    let targetLogZoom = Math.log(Math.max(minZoom, baseZoom));
    let targetZoom = Math.exp(targetLogZoom);
    const displayCenter = { x: baseCenter.x, y: baseCenter.y };
    let displayLogZoom = targetLogZoom;
    let displayZoom = targetZoom;
    const queuedCenter = { x: baseCenter.x, y: baseCenter.y };
    let queuedLogZoom = targetLogZoom;
    let queuedZoom = targetZoom;

    function clampLogZoom(value) {
      if (!Number.isFinite(value)) {
        return value > 0 ? maxLogZoom : minLogZoom;
      }
      return clamp(value, minLogZoom, maxLogZoom);
    }

    function updateTargetLogZoom(value) {
      targetLogZoom = clampLogZoom(value);
      targetZoom = Math.exp(targetLogZoom);
    }

    function updateDisplayLogZoom(value) {
      displayLogZoom = value;
      displayZoom = Math.exp(displayLogZoom);
    }

    function updateQueuedLogZoom(value) {
      queuedLogZoom = value;
      queuedZoom = Math.exp(queuedLogZoom);
    }

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    function rebuildTiles() {
      tiles = [];
      if (canvasWidth <= 0 || canvasHeight <= 0) {
        needsTileRebuild = false;
        return;
      }
      const columns = Math.ceil(canvasWidth / tileSize);
      const rows = Math.ceil(canvasHeight / tileSize);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          tiles.push({ x: x * tileSize, y: y * tileSize });
        }
      }
      shuffle(tiles);
      needsTileRebuild = false;
      hasRenderedTiles = false;
      presentDirty = false;
      tilesDrawnLastFrame = 0;
    }

    function drawBackdropInternal() {
      bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      drawBackdrop(bufferCtx, canvasWidth, canvasHeight, getState());
      needsBackdrop = false;
      hasRenderedTiles = false;
      presentDirty = false;
    }

    function renderTiles(batchCount) {
      if (!tiles.length || canvasWidth === 0 || canvasHeight === 0) {
        tilesDrawnLastFrame = 0;
        return;
      }
      const spanX = baseSpan / displayZoom;
      const spanY = spanX * (canvasHeight / Math.max(1, canvasWidth));
      const startX = displayCenter.x - spanX / 2;
      const startY = displayCenter.y - spanY / 2;
      const pixelSpanX = spanX / Math.max(1, canvasWidth);
      const pixelSpanY = spanY / Math.max(1, canvasHeight);
      const minPixelSpan = Math.min(Math.abs(pixelSpanX), Math.abs(pixelSpanY));
      const useHighPrecision = Boolean(
        DoubleDouble &&
        Number.isFinite(minPixelSpan) &&
        minPixelSpan > 0 &&
        minPixelSpan < HIGH_PRECISION_PIXEL_THRESHOLD
      );
      const state = getState();
      state.spanX = spanX;
      state.spanY = spanY;
      state.pixelSpanX = pixelSpanX;
      state.pixelSpanY = pixelSpanY;
      state.minPixelSpan = minPixelSpan;
      state.highPrecision = useHighPrecision;
      const iterationLimit = maxIterations(displayZoom, state);
      const drift = palettePhase + paletteSeed;
      const brightnessBoost = Math.min(1.6, 1 + Math.log(displayZoom + 1) * 0.08);
      let rendered = 0;

      if (useHighPrecision) {
        const startXDD = DoubleDouble.fromNumber(startX);
        const startYDD = DoubleDouble.fromNumber(startY);
        const stepXDD = DoubleDouble.fromNumber(pixelSpanX);
        const stepYDD = DoubleDouble.fromNumber(pixelSpanY);

        for (let batch = 0; batch < batchCount && tiles.length; batch++) {
          const tile = tiles.pop();
          const tileWidth = Math.min(tileSize, canvasWidth - tile.x);
          const tileHeight = Math.min(tileSize, canvasHeight - tile.y);
          const imageData = bufferCtx.createImageData(tileWidth, tileHeight);
          const data = imageData.data;
          let offset = 0;

          const tileXOffsetDD = DoubleDouble.fromNumber(tile.x);
          const tileYOffsetDD = DoubleDouble.fromNumber(tile.y);
          const tileStartXDD = DoubleDouble.add(startXDD, DoubleDouble.mul(stepXDD, tileXOffsetDD));
          let rowStartYDD = DoubleDouble.add(startYDD, DoubleDouble.mul(stepYDD, tileYOffsetDD));

          for (let ty = 0; ty < tileHeight; ty++) {
            const cyDD = ty === 0 ? rowStartYDD : (rowStartYDD = DoubleDouble.add(rowStartYDD, stepYDD));
            const cyValue = DoubleDouble.toNumber(cyDD);
            let cxRowDD = tileStartXDD;

            for (let tx = 0; tx < tileWidth; tx++) {
              const cxDD = tx === 0 ? cxRowDD : (cxRowDD = DoubleDouble.add(cxRowDD, stepXDD));
              const cxValue = DoubleDouble.toNumber(cxDD);

              let zx = DoubleDouble.zero();
              let zy = DoubleDouble.zero();
              let zx2 = DoubleDouble.zero();
              let zy2 = DoubleDouble.zero();
              let iter = 0;

              while (iter < iterationLimit) {
                const magCheck = DoubleDouble.toNumber(DoubleDouble.add(zx2, zy2));
                if (magCheck > ESCAPE_RADIUS) {
                  break;
                }
                const zxzy = DoubleDouble.mul(zx, zy);
                const nextZy = DoubleDouble.add(DoubleDouble.mulNumber(zxzy, 2), cyDD);
                const nextZx = DoubleDouble.add(DoubleDouble.sub(zx2, zy2), cxDD);
                zx = nextZx;
                zy = nextZy;
                zx2 = DoubleDouble.mul(zx, zx);
                zy2 = DoubleDouble.mul(zy, zy);
                iter++;
              }

              const mag = DoubleDouble.toNumber(DoubleDouble.add(zx2, zy2));

              let r, g, b;
              if (iter >= iterationLimit) {
                const shade = interiorShade(cxValue, cyValue, displayCenter, spanX, spanY);
                r = g = b = shade;
              } else {
                let smooth = iter;
                if (mag > 1) {
                  smooth = iter + 1 - Math.log(Math.log(mag)) / LOG2;
                }
                const t = Math.max(0, Math.min(1, smooth / iterationLimit));
                [r, g, b] = samplePalette(t, drift, brightnessBoost, state);
              }

              data[offset++] = r;
              data[offset++] = g;
              data[offset++] = b;
              data[offset++] = 255;
            }
          }

          bufferCtx.putImageData(imageData, tile.x, tile.y);
          rendered++;
        }
      } else {
        for (let batch = 0; batch < batchCount && tiles.length; batch++) {
          const tile = tiles.pop();
          const tileWidth = Math.min(tileSize, canvasWidth - tile.x);
          const tileHeight = Math.min(tileSize, canvasHeight - tile.y);
          const imageData = bufferCtx.createImageData(tileWidth, tileHeight);
          const data = imageData.data;
          let offset = 0;

          for (let ty = 0; ty < tileHeight; ty++) {
            const pixelY = tile.y + ty;
            const cy = startY + (pixelY / canvasHeight) * spanY;
            for (let tx = 0; tx < tileWidth; tx++) {
              const pixelX = tile.x + tx;
              const cx = startX + (pixelX / canvasWidth) * spanX;

              let zx = 0;
              let zy = 0;
              let iter = 0;
              let zx2 = 0;
              let zy2 = 0;

              while (zx2 + zy2 <= ESCAPE_RADIUS && iter < iterationLimit) {
                zy = 2 * zx * zy + cy;
                zx = zx2 - zy2 + cx;
                zx2 = zx * zx;
                zy2 = zy * zy;
                iter++;
              }

              let r, g, b;
              if (iter >= iterationLimit) {
                const shade = interiorShade(cx, cy, displayCenter, spanX, spanY);
                r = g = b = shade;
              } else {
                const mag = zx2 + zy2;
                let smooth = iter;
                if (mag > 1) {
                  smooth = iter + 1 - Math.log(Math.log(mag)) / LOG2;
                }
                const t = Math.max(0, Math.min(1, smooth / iterationLimit));
                [r, g, b] = samplePalette(t, drift, brightnessBoost, state);
              }

              data[offset++] = r;
              data[offset++] = g;
              data[offset++] = b;
              data[offset++] = 255;
            }
          }

          bufferCtx.putImageData(imageData, tile.x, tile.y);
          rendered++;
        }
      }

      tilesDrawnLastFrame = rendered;
      if (rendered > 0) {
        hasRenderedTiles = true;
        presentDirty = true;
      }
    }

    function presentIfNeeded() {
      if (!presentDirty || !hasRenderedTiles) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(buffer, 0, 0);
      presentDirty = false;
    }

    function frame(now) {
      if (!running) return;
      const current = now || (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
      const deltaSeconds = clamp((current - lastFrame) / 1000, 0.001, 0.1);
      lastFrame = current;

      controller?.(api, deltaSeconds, current);

      if (skipSmoothing > 0) {
        displayCenter.x = targetCenter.x;
        displayCenter.y = targetCenter.y;
        updateDisplayLogZoom(targetLogZoom);
        skipSmoothing--;
      } else {
        const smoothing = 1 - Math.pow(2, -deltaSeconds * smoothingRate);
        displayCenter.x += (targetCenter.x - displayCenter.x) * smoothing;
        displayCenter.y += (targetCenter.y - displayCenter.y) * smoothing;
        const nextLogZoom = displayLogZoom + (targetLogZoom - displayLogZoom) * smoothing;
        updateDisplayLogZoom(nextLogZoom);
      }

      const centerDelta = Math.max(
        Math.abs(displayCenter.x - queuedCenter.x),
        Math.abs(displayCenter.y - queuedCenter.y)
      );
      const zoomDelta = Math.abs(displayLogZoom - queuedLogZoom);

      if (centerDelta > 1e-6 || zoomDelta > 0.002 || needsTileRebuild) {
        queuedCenter.x = displayCenter.x;
        queuedCenter.y = displayCenter.y;
        updateQueuedLogZoom(displayLogZoom);
        rebuildTiles();
        needsBackdrop = true;
      }

      if (needsBackdrop) {
        drawBackdropInternal();
      }

      if (tiles.length) {
        const batch = tileBatchFn(canvasWidth, canvasHeight, getState());
        renderTiles(batch);
      } else {
        tilesDrawnLastFrame = 0;
      }

      presentIfNeeded();

      const driftSpeed = reduceMotion ? 0.12 : 0.6;
      const zoomInfluence = reduceMotion ? 0.00002 : 0.00004;
      palettePhase = (palettePhase + deltaSeconds * (driftSpeed + 0.4 * Math.sin(current * 0.00018 + displayZoom * zoomInfluence))) % TAU;

      stateListener?.(getState(deltaSeconds, current));

      frameHandle = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      lastFrame = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      frameHandle = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (frameHandle != null) {
        cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }
    }

    function setSize({ width, height, dpr: nextDpr }) {
      cssWidth = Math.max(1, width || 0);
      cssHeight = Math.max(1, height || 0);
      dpr = Math.max(1, nextDpr || 1);
      canvasWidth = Math.floor(cssWidth * dpr);
      canvasHeight = Math.floor(cssHeight * dpr);
      tileSize = Math.max(minTileSize, Math.floor(tileBase * dpr));
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      ctx.imageSmoothingEnabled = false;
      buffer.width = canvasWidth;
      buffer.height = canvasHeight;
      bufferCtx.imageSmoothingEnabled = false;
      invalidate();
    }

    function getSpan() {
      const spanX = baseSpan / targetZoom;
      const spanY = spanX * (cssHeight / Math.max(1, cssWidth));
      return { spanX, spanY };
    }

    function zoomAt(clientX, clientY, factor, { immediate = false } = {}) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const normX = cssWidth ? clamp(x / cssWidth, 0, 1) : 0.5;
      const normY = cssHeight ? clamp(y / cssHeight, 0, 1) : 0.5;
      const spanBeforeX = baseSpan / targetZoom;
      const spanBeforeY = spanBeforeX * (cssHeight / Math.max(1, cssWidth));
      const focusX = targetCenter.x + (normX - 0.5) * spanBeforeX;
      const focusY = targetCenter.y + (normY - 0.5) * spanBeforeY;

      const deltaLog = Math.log(Math.max(1e-6, factor));
      updateTargetLogZoom(targetLogZoom + deltaLog);

      const spanAfterX = baseSpan / targetZoom;
      const spanAfterY = spanAfterX * (cssHeight / Math.max(1, cssWidth));
      targetCenter.x = focusX - (normX - 0.5) * spanAfterX;
      targetCenter.y = focusY - (normY - 0.5) * spanAfterY;

      if (immediate) {
        snapToTarget();
      }
    }

    function panBy(dx, dy, { immediate = false } = {}) {
      const { spanX, spanY } = getSpan();
      targetCenter.x -= (dx / Math.max(1, cssWidth)) * spanX;
      targetCenter.y += (dy / Math.max(1, cssHeight)) * spanY;
      if (immediate) {
        snapToTarget();
      }
    }

    function setTargetState({ center, zoom, logZoom } = {}) {
      if (center) {
        targetCenter.x = center.x;
        targetCenter.y = center.y;
      }
      if (logZoom != null) {
        updateTargetLogZoom(logZoom);
      } else if (zoom != null) {
        updateTargetLogZoom(Math.log(Math.max(1e-6, zoom)));
      }
    }

    function setTargetCenter(center) {
      setTargetState({ center });
    }

    function setTargetZoom(zoom) {
      setTargetState({ zoom });
    }

    function setTargetLogZoom(logZoom) {
      setTargetState({ logZoom });
    }

    function nudgeTargetZoom(factor) {
      updateTargetLogZoom(targetLogZoom + Math.log(Math.max(1e-6, factor)));
    }

    function nudgeTargetLogZoom(delta) {
      updateTargetLogZoom(targetLogZoom + delta);
    }

    function snapToTarget() {
      displayCenter.x = targetCenter.x;
      displayCenter.y = targetCenter.y;
      updateDisplayLogZoom(targetLogZoom);
      queuedCenter.x = targetCenter.x;
      queuedCenter.y = targetCenter.y;
      updateQueuedLogZoom(targetLogZoom);
      needsTileRebuild = true;
      needsBackdrop = true;
      tiles = [];
      hasRenderedTiles = false;
      presentDirty = false;
      skipSmoothing = 1;
    }

    function resetView() {
      targetCenter.x = baseCenter.x;
      targetCenter.y = baseCenter.y;
      updateTargetLogZoom(Math.log(Math.max(minZoom, baseZoom)));
      snapToTarget();
    }

    function cyclePalette() {
      paletteSeed = Math.random() * TAU;
      palettePhase = 0;
      invalidate();
    }

    function setPaletteSeed(seed) {
      if (Number.isFinite(seed)) {
        paletteSeed = seed;
      }
      palettePhase = 0;
      invalidate();
    }

    function invalidate() {
      needsTileRebuild = true;
      needsBackdrop = true;
    }

    function setReduceMotion(value) {
      reduceMotion = Boolean(value);
    }

    function setController(fn) {
      controller = typeof fn === 'function' ? fn : null;
    }

    function setStateListener(fn) {
      stateListener = typeof fn === 'function' ? fn : null;
    }

    function setSmoothingRate(rate) {
      if (!Number.isFinite(rate) || rate <= 0) return;
      smoothingRate = rate;
    }

    function getState(deltaSeconds = 0, now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) {
      return {
        baseCenter: { ...baseCenter },
        baseSpan,
        cssWidth,
        cssHeight,
        canvasWidth,
        canvasHeight,
        dpr,
        reduceMotion,
        targetCenter: { x: targetCenter.x, y: targetCenter.y },
        targetZoom,
        targetLogZoom,
        displayCenter: { x: displayCenter.x, y: displayCenter.y },
        displayZoom,
        displayLogZoom,
        queuedCenter: { x: queuedCenter.x, y: queuedCenter.y },
        queuedZoom,
        queuedLogZoom,
        tileSize,
        tilesRemaining: tiles.length,
        tilesDrawnLastFrame,
        paletteSeed,
        palettePhase,
        running,
        deltaSeconds,
        now,
      };
    }

    const api = {
      start,
      stop,
      setSize,
      getState,
      setController,
      setStateListener,
      setSmoothingRate,
      setReduceMotion,
      setTargetState,
      setTargetCenter,
      setTargetZoom,
      setTargetLogZoom,
      nudgeTargetZoom,
      nudgeTargetLogZoom,
      snapToTarget,
      resetView,
      zoomAt,
      panBy,
      cyclePalette,
      setPaletteSeed,
      invalidate,
    };

    return api;
  }

  global.FractalEngine = { createFractalRenderer };
})(typeof window !== 'undefined' ? window : this);
