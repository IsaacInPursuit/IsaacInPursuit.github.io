// workers/voronoi.js
// Computes Voronoi cells and Lloyd relaxation steps off the main thread.
const PHI = (1 + Math.sqrt(5)) / 2;

self.onmessage = (event) => {
  const { data } = event;
  if (!data || data.type !== 'compute') return;
  const points = new Float32Array(data.points);
  const iterations = Math.max(0, data.iterations | 0);

  let sites = [];
  for (let i = 0; i < points.length; i += 2) {
    sites.push({ x: points[i], y: points[i + 1] });
  }

  for (let iter = 0; iter < iterations; iter += 1) {
    const { polygons } = computeVoronoi(sites);
    const nextSites = [];
    for (let i = 0; i < polygons.length; i += 1) {
      const polygon = polygons[i];
      if (!polygon || polygon.length === 0) {
        nextSites.push(sites[i]);
        continue;
      }
      const centroid = polygonCentroid(polygon);
      nextSites.push({ x: centroid.x, y: centroid.y });
    }
    sites = nextSites;
  }

  const { polygons, neighbors } = computeVoronoi(sites);
  const flattened = [];
  const offsets = new Uint32Array(polygons.length);
  const counts = new Uint16Array(polygons.length);
  let offset = 0;
  for (let i = 0; i < polygons.length; i += 1) {
    const polygon = polygons[i] || [];
    offsets[i] = offset;
    counts[i] = polygon.length;
    for (let j = 0; j < polygon.length; j += 1) {
      const p = polygon[j];
      flattened.push(p.x, p.y);
    }
    offset += polygon.length;
  }
  const polygonData = new Float32Array(flattened);

  const sitesArray = new Float32Array(sites.length * 2);
  for (let i = 0; i < sites.length; i += 1) {
    sitesArray[i * 2] = sites[i].x;
    sitesArray[i * 2 + 1] = sites[i].y;
  }

  const edgeList = [];
  const edgeSet = new Set();
  neighbors.forEach((set, index) => {
    set.forEach((neighbor) => {
      if (neighbor <= index) return;
      const key = `${index}|${neighbor}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      const a = sites[index];
      const b = sites[neighbor];
      edgeList.push(a.x, a.y, b.x, b.y);
    });
  });
  const edgesArray = new Float32Array(edgeList);

  postMessage(
    {
      type: 'result',
      sites: sitesArray.buffer,
      polygons: polygonData.buffer,
      offsets: offsets.buffer,
      counts: counts.buffer,
      edges: edgesArray.buffer,
    },
    [sitesArray.buffer, polygonData.buffer, offsets.buffer, counts.buffer, edgesArray.buffer]
  );
};

function computeVoronoi(sites) {
  const polygons = new Array(sites.length);
  const neighbors = new Map();
  for (let i = 0; i < sites.length; i += 1) {
    let polygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const site = sites[i];
    for (let j = 0; j < sites.length; j += 1) {
      if (i === j) continue;
      const other = sites[j];
      const clipped = clipPolygon(polygon, site, other);
      polygon = clipped.polygon;
      if (clipped.shared) {
        if (!neighbors.has(i)) neighbors.set(i, new Set());
        neighbors.get(i).add(j);
      }
      if (!polygon.length) break;
    }
    polygons[i] = polygon;
  }
  return { polygons, neighbors };
}

function clipPolygon(polygon, site, other) {
  if (!polygon.length) return { polygon: [], shared: false };
  const result = [];
  const d = { x: other.x - site.x, y: other.y - site.y };
  const mid = { x: (site.x + other.x) / 2, y: (site.y + other.y) / 2 };
  let shared = false;
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const currentDot = dot(current, d, mid);
    const nextDot = dot(next, d, mid);
    const currentInside = currentDot <= 0;
    const nextInside = nextDot <= 0;

    if (currentInside && nextInside) {
      result.push(next);
    } else if (currentInside && !nextInside) {
      shared = true;
      result.push(intersection(current, next, currentDot, nextDot));
    } else if (!currentInside && nextInside) {
      shared = true;
      result.push(intersection(current, next, currentDot, nextDot));
      result.push(next);
    }
  }
  return { polygon: result, shared };
}

function dot(point, direction, mid) {
  return (point.x - mid.x) * direction.x + (point.y - mid.y) * direction.y;
}

function intersection(a, b, aDot, bDot) {
  const t = aDot / (aDot - bDot);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function polygonCentroid(points) {
  if (!points.length) return { x: 0.5, y: 0.5 };
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const cross = p1.x * p2.y - p2.x * p1.y;
    area += cross;
    x += (p1.x + p2.x) * cross;
    y += (p1.y + p2.y) * cross;
  }
  area *= 0.5;
  if (!area) return points[0];
  return { x: x / (6 * area), y: y / (6 * area) };
}
