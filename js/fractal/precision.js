(function (global) {
  const SPLITTER = 134217729; // 2^27 + 1

  function twoSum(a, b) {
    const s = a + b;
    const bb = s - a;
    const err = (a - (s - bb)) + (b - bb);
    return [s, err];
  }

  function fastTwoSum(a, b) {
    const s = a + b;
    const err = b - (s - a);
    return [s, err];
  }

  function split(a) {
    const c = SPLITTER * a;
    const hi = c - (c - a);
    const lo = a - hi;
    return [hi, lo];
  }

  function twoProd(a, b) {
    const p = a * b;
    const [aHi, aLo] = split(a);
    const [bHi, bLo] = split(b);
    const err = ((aHi * bHi - p) + aHi * bLo + aLo * bHi) + aLo * bLo;
    return [p, err];
  }

  function normalize(hi, lo) {
    const [s, e] = fastTwoSum(hi, lo);
    return { hi: s, lo: e };
  }

  function fromNumber(value) {
    if (value === 0) return { hi: 0, lo: 0 };
    if (!Number.isFinite(value)) return { hi: value, lo: 0 };
    return { hi: value, lo: 0 };
  }

  function clone(dd) {
    return { hi: dd.hi, lo: dd.lo };
  }

  function add(a, b) {
    const [s, e] = twoSum(a.hi, b.hi);
    const t = a.lo + b.lo + e;
    return normalize(s, t);
  }

  function sub(a, b) {
    const [s, e] = twoSum(a.hi, -b.hi);
    const t = a.lo - b.lo + e;
    return normalize(s, t);
  }

  function mul(a, b) {
    const [p, err] = twoProd(a.hi, b.hi);
    const t = a.hi * b.lo + a.lo * b.hi + err;
    return normalize(p, t);
  }

  function mulNumber(a, n) {
    const [p, err] = twoProd(a.hi, n);
    const t = a.lo * n + err;
    return normalize(p, t);
  }

  function addNumber(a, n) {
    const [s, e] = twoSum(a.hi, n);
    const t = a.lo + e;
    return normalize(s, t);
  }

  function subNumber(a, n) {
    const [s, e] = twoSum(a.hi, -n);
    const t = a.lo + e;
    return normalize(s, t);
  }

  function negate(a) {
    return { hi: -a.hi, lo: -a.lo };
  }

  function zero() {
    return { hi: 0, lo: 0 };
  }

  function toNumber(a) {
    return a.hi + a.lo;
  }

  const DoubleDouble = {
    fromNumber,
    clone,
    add,
    sub,
    mul,
    mulNumber,
    addNumber,
    subNumber,
    negate,
    zero,
    toNumber,
    normalize,
    SWITCH_PIXEL_THRESHOLD: 2e-14,
  };

  global.FractalPrecision = Object.assign({}, global.FractalPrecision, {
    DoubleDouble,
  });
})(typeof window !== 'undefined' ? window : this);
