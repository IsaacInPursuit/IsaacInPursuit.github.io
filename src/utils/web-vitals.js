import '/src/utils/vendor/web-vitals.attribution.umd.js';

const globalScope = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : undefined;

const METRIC_UNITS = {
  CLS: '',
  INP: 'ms',
  LCP: 'ms',
};

const METRIC_PRECISION = {
  CLS: 4,
  INP: 0,
  LCP: 0,
};

const RATING_STYLES = {
  good: 'color: #047857; font-weight: 600;',
  'needs-improvement': 'color: #b45309; font-weight: 600;',
  poor: 'color: #b91c1c; font-weight: 600;',
};

const DEFAULT_STYLE = 'color: #1f2937; font-weight: 600;';
const LAST_VALUES = new Map();

function formatNumber(value, precision) {
  if (!Number.isFinite(value)) return value;
  const digits = precision ?? (Math.abs(value) < 1 ? 2 : 0);
  return Number(value.toFixed(digits));
}

function formatMetricValue(name, value) {
  return formatNumber(value, METRIC_PRECISION[name] ?? 0);
}

function formatAttribution(metric) {
  const attribution = metric?.attribution;
  if (!attribution || typeof attribution !== 'object') return undefined;

  const result = {};
  for (const [key, rawValue] of Object.entries(attribution)) {
    if (rawValue == null) continue;
    if (typeof rawValue === 'number') {
      result[key] = formatNumber(rawValue, Math.abs(rawValue) < 1 ? 3 : 0);
    } else if (typeof rawValue === 'string') {
      result[key] = rawValue;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function formatNavigation(metric) {
  if (typeof metric.navigationType === 'string') return metric.navigationType;
  const navEntry = metric.navigationEntry;
  if (navEntry && typeof navEntry.type === 'string') return navEntry.type;
  return undefined;
}

function shouldLog(metric) {
  const previous = LAST_VALUES.get(metric.id);
  if (previous == null) {
    LAST_VALUES.set(metric.id, metric.value);
    return true;
  }

  const epsilon = metric.name === 'CLS' ? 0.0001 : 0.5;
  if (Math.abs(metric.value - previous) >= epsilon) {
    LAST_VALUES.set(metric.id, metric.value);
    return true;
  }

  return false;
}

function logMetric(metric) {
  if (!shouldLog(metric)) return;

  const summary = {
    id: metric.id,
    rating: metric.rating,
    value: formatMetricValue(metric.name, metric.value),
    delta: formatMetricValue(metric.name, metric.delta),
  };

  const unit = METRIC_UNITS[metric.name];
  if (unit) {
    summary.unit = unit;
  }

  const navType = formatNavigation(metric);
  if (navType) {
    summary.navigationType = navType;
  }

  const attribution = formatAttribution(metric);
  if (attribution) {
    summary.attribution = attribution;
  }

  if (metric.entries && metric.entries.length) {
    summary.samples = metric.entries.length;
  }

  const label = `[Web Vitals] ${metric.name}`;
  const style = RATING_STYLES[metric.rating] ?? DEFAULT_STYLE;

  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(`%c${label}`, style);
    console.log(summary);
    console.groupEnd();
  } else if (typeof console.info === 'function') {
    console.info(label, summary);
  } else {
    console.log(label, summary);
  }
}

function subscribe(subscribeFn, options) {
  if (typeof subscribeFn !== 'function') return;
  try {
    subscribeFn((metric) => {
      if (metric) {
        logMetric(metric);
      }
    }, options);
  } catch (error) {
    console.warn('[Web Vitals] Failed to subscribe to metrics:', error);
  }
}

export function initWebVitalsLogging() {
  if (!globalScope || globalScope.__webVitalsLoggingInitialized) {
    return;
  }

  const vitals = globalScope.webVitals;
  if (!vitals) {
    console.warn('[Web Vitals] Library failed to load.');
    return;
  }

  globalScope.__webVitalsLoggingInitialized = true;

  const options = { reportAllChanges: true }; // Attribution build already enables attribution details.
  subscribe(vitals.onCLS, options);
  subscribe(vitals.onINP, options);
  subscribe(vitals.onLCP, options);
}

if (typeof document !== 'undefined') {
  initWebVitalsLogging();
}
