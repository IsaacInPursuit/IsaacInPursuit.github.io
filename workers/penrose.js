// workers/penrose.js
// Triangle-based Penrose inflation producing kite (thick) and dart (thin) halves.
const PHI = (1 + Math.sqrt(5)) / 2;

self.onmessage = (event) => {
  const { data } = event;
  if (!data || data.type !== 'inflate') return;
  const iterations = Math.max(0, data.iterations | 0);

  let triangles = createInitialStar();
  for (let iter = 0; iter < iterations; iter += 1) {
    const next = [];
    for (const tri of triangles) {
      const children = subdivide(tri);
      next.push(...children);
    }
    triangles = next;
  }

  const flattened = new Float32Array(triangles.length * 6);
  const types = new Uint8Array(triangles.length);
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

  triangles.forEach((tri, index) => {
    flattened[index * 6 + 0] = tri.a.x;
    flattened[index * 6 + 1] = tri.a.y;
    flattened[index * 6 + 2] = tri.b.x;
    flattened[index * 6 + 3] = tri.b.y;
    flattened[index * 6 + 4] = tri.c.x;
    flattened[index * 6 + 5] = tri.c.y;
    types[index] = tri.type === 'thick' ? 1 : 0;

    bounds.minX = Math.min(bounds.minX, tri.a.x, tri.b.x, tri.c.x);
    bounds.maxX = Math.max(bounds.maxX, tri.a.x, tri.b.x, tri.c.x);
    bounds.minY = Math.min(bounds.minY, tri.a.y, tri.b.y, tri.c.y);
    bounds.maxY = Math.max(bounds.maxY, tri.a.y, tri.b.y, tri.c.y);
  });

  postMessage(
    {
      type: 'result',
      triangles: flattened.buffer,
      kinds: types.buffer,
      bounds,
    },
    [flattened.buffer, types.buffer]
  );
};

function createInitialStar() {
  const triangles = [];
  const radiusOuter = 0.8;
  const radiusInner = radiusOuter / PHI;
  for (let i = 0; i < 10; i += 1) {
    const angle = (i * Math.PI) / 5;
    const nextAngle = angle + Math.PI / 5;
    const a = { x: 0, y: 0 };
    const b = {
      x: Math.cos(angle) * (i % 2 === 0 ? radiusOuter : radiusInner),
      y: Math.sin(angle) * (i % 2 === 0 ? radiusOuter : radiusInner),
    };
    const c = {
      x: Math.cos(nextAngle) * (i % 2 === 0 ? radiusOuter : radiusInner),
      y: Math.sin(nextAngle) * (i % 2 === 0 ? radiusOuter : radiusInner),
    };
    triangles.push({ a, b, c, type: i % 2 === 0 ? 'thin' : 'thick' });
  }
  return triangles;
}

function subdivide(triangle) {
  const { a, b, c, type } = triangle;
  if (type === 'thin') {
    const q = lerp(a, b, 1 / PHI);
    const r = lerp(a, c, 1 / PHI);
    return [
      { a: r, b: c, c: b, type: 'thin' },
      { a: q, b: r, c: b, type: 'thick' },
    ];
  }
  const q = lerp(c, a, 1 / PHI);
  const r = lerp(c, b, 1 / PHI);
  return [
    { a: q, b: a, c: b, type: 'thick' },
    { a: r, b: q, c: b, type: 'thin' },
  ];
}

function lerp(p1, p2, t) {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}
