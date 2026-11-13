import * as THREE from 'three';
import Delaunator from 'delaunator';

export const HALF_X = 31;
export const HALF_Z = 44;
export const PLINTH_TOP = 1.8;
export const GRASS_T = 0.45;

const POWER = 2.5;
const SOIL = [
  ['shallow', 1.6],
  ['deep', 2.2],
  ['rock', 2.4],
];

const WEST_PAD = 8;

export function westPad(z, scale = 1) {
  return WEST_PAD * scale;
}

export function halfWidthAt(z, scale = 1) {
  const span = HALF_Z * scale;
  const u = THREE.MathUtils.clamp((span - z) / (span * 2), 0, 1);
  const frontW = 15 * scale;
  const backW = 34 * scale;
  const s = u * u * (3 - 2 * u);
  let width = frontW + (backW - frontW) * s;
  const nz = z / span;
  if (nz > 0.72) {
    const k = (nz - 0.72) / 0.28;
    width *= Math.cos(Math.min(1, k) * Math.PI * 0.5);
  } else if (nz < -0.9) {
    const k = (-nz - 0.9) / 0.1;
    width *= Math.cos(Math.min(1, k) * Math.PI * 0.5);
  }
  return Math.max(width, 0.5);
}

export function inside(x, z, scale = 1) {
  if (Math.abs(z) > HALF_Z * scale + 0.2) return false;
  const half = halfWidthAt(z, scale);
  if (x < 0) return -x <= half + westPad(z, scale);
  return x <= half;
}

export function heightAt(x, z) {
  const u = THREE.MathUtils.clamp((HALF_Z - z) / (HALF_Z * 2), 0, 1);
  const low = 8;
  const high = 26;
  const u0 = 0.22;
  const u1 = 0.58;
  if (u <= u0) return low;
  if (u >= u1) return high;
  const t = (u - u0) / (u1 - u0);
  const s = t * t * (3 - 2 * t);
  return low + (high - low) * s;
}

export function roadY(x, z) {
  const hill = heightAt(x, z) + 0.1;
  if (inside(x, z, 1)) return hill;
  const edge = halfWidthAt(z) + (x < 0 ? westPad(z) : 0);
  const dist = Math.abs(x) - edge;
  if (dist < 10) return Math.max(0.2, hill - dist * 0.18);
  return 0.12;
}

const CAMPUS_FLOOR = 8;

export function strataAt(x, z) {
  const grassTop = heightAt(x, z);
  const grassBot = Math.max(grassTop - 0.2, CAMPUS_FLOOR);
  const bands = {
    grass: { top: grassTop, bottom: Math.max(grassTop - 0.2, CAMPUS_FLOOR - 0.2) },
    shallow: { top: grassBot, bottom: grassBot },
    deep: { top: grassBot, bottom: grassBot },
    rock: { top: grassBot, bottom: grassBot },
  };
  if (grassBot <= CAMPUS_FLOOR + 0.05) return bands;
  const space = grassBot - CAMPUS_FLOOR;
  const sum = SOIL.reduce((total, part) => total + part[1], 0);
  const k = space / sum;
  let y = grassBot;
  for (const [name, thickness] of SOIL) {
    const top = y;
    const bottom = name === 'rock' ? CAMPUS_FLOOR : Math.max(CAMPUS_FLOOR, y - thickness * k);
    bands[name] = { top, bottom };
    y = bottom;
  }
  return bands;
}

function makeOutline(scale, count) {
  const pts = [];
  const edge = Math.floor(count / 2);
  const zFront = HALF_Z * scale;
  const zBack = -HALF_Z * scale;
  for (let i = 0; i < edge; i += 1) {
    const z = THREE.MathUtils.lerp(zFront, zBack, i / (edge - 1));
    pts.push(new THREE.Vector3(halfWidthAt(z, scale), 0, z));
  }
  for (let i = 0; i < edge; i += 1) {
    const z = THREE.MathUtils.lerp(zBack, zFront, i / (edge - 1));
    pts.push(new THREE.Vector3(-(halfWidthAt(z, scale) + westPad(z, scale)), 0, z));
  }
  return pts;
}

function makeInterior(scale, segmentsX, segmentsZ, outline) {
  const pts = [];
  for (let iz = 0; iz <= segmentsZ; iz += 1) {
    for (let ix = 0; ix <= segmentsX; ix += 1) {
      const x = THREE.MathUtils.lerp(-(HALF_X + WEST_PAD) * scale, HALF_X * scale, ix / segmentsX);
      const z = THREE.MathUtils.lerp(-HALF_Z * scale, HALF_Z * scale, iz / segmentsZ);
      if (!inside(x, z, scale * 0.94)) continue;
      let close = false;
      for (const p of outline) {
        const dx = p.x - x;
        const dz = p.z - z;
        if (dx * dx + dz * dz < 1.1) {
          close = true;
          break;
        }
      }
      if (!close) pts.push(new THREE.Vector3(x, 0, z));
    }
  }
  return pts;
}

function triangulate(outline, interior, scale) {
  const points = outline.concat(interior);
  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i += 1) {
    coords[i * 2] = points[i].x;
    coords[i * 2 + 1] = points[i].z;
  }
  const delaunay = new Delaunator(coords);
  const tris = [];
  for (let t = 0; t < delaunay.triangles.length; t += 3) {
    const a = delaunay.triangles[t];
    const b = delaunay.triangles[t + 1];
    const c = delaunay.triangles[t + 2];
    const ax = points[a].x;
    const az = points[a].z;
    const abx = points[b].x - ax;
    const abz = points[b].z - az;
    const acx = points[c].x - ax;
    const acz = points[c].z - az;
    const area = abx * acz - acx * abz;
    if (Math.abs(area) < 1e-4) continue;
    const cx = (points[a].x + points[b].x + points[c].x) / 3;
    const cz = (points[a].z + points[b].z + points[c].z) / 3;
    if (!inside(cx, cz, scale * 1.01)) continue;
    if (area > 0) tris.push(a, b, c);
    else tris.push(a, c, b);
  }
  return { points, tris, outlineCount: outline.length };
}

function buildSolidGeometry(tri, topFn, botFn, parts) {
  const { points, tris, outlineCount } = tri;
  const n = points.length;
  const positions = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i += 1) {
    const p = points[i];
    const yTop = topFn(p.x, p.z);
    const yBot = botFn(p.x, p.z);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = yTop;
    positions[i * 3 + 2] = p.z;
    const b = (i + n) * 3;
    positions[b] = p.x;
    positions[b + 1] = yBot;
    positions[b + 2] = p.z;
  }

  const indices = [];
  if (parts.top) {
    for (let t = 0; t < tris.length; t += 3) indices.push(tris[t], tris[t + 1], tris[t + 2]);
  }
  if (parts.bottom) {
    for (let t = 0; t < tris.length; t += 3) {
      indices.push(tris[t] + n, tris[t + 2] + n, tris[t + 1] + n);
    }
  }
  if (parts.skirt) {
    for (let i = 0; i < outlineCount; i += 1) {
      const j = (i + 1) % outlineCount;
      const ox = points[i].x + points[j].x;
      const oz = points[i].z + points[j].z;
      pushSkirt(indices, positions, i, i + n, j, j + n, ox, oz);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function pushSkirt(indices, positions, iTop, iBot, jTop, jBot, outwardX, outwardZ) {
  const ax = positions[iTop * 3];
  const ay = positions[iTop * 3 + 1];
  const az = positions[iTop * 3 + 2];
  const bx = positions[iBot * 3];
  const by = positions[iBot * 3 + 1];
  const bz = positions[iBot * 3 + 2];
  const cx = positions[jTop * 3];
  const cy = positions[jTop * 3 + 1];
  const cz = positions[jTop * 3 + 2];
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const nx = aby * acz - abz * acy;
  const nz = abx * acy - aby * acx;
  const outward = nx * outwardX + nz * outwardZ >= 0;
  if (outward) {
    indices.push(iTop, iBot, jTop, jTop, iBot, jBot);
  } else {
    indices.push(iTop, jTop, iBot, jTop, jBot, iBot);
  }
}

function addMesh(parent, name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addLayer(parent, material, name, tri, topFn, botFn, parts) {
  const group = new THREE.Group();
  group.name = name;
  addMesh(group, `${name}Mesh`, buildSolidGeometry(tri, topFn, botFn, parts), material);
  parent.add(group);
}

function buildFillet(outline, yFn, radius) {
  const segments = 4;
  const rows = segments + 1;
  const count = outline.length;
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const p = outline[i];
    const len = Math.hypot(p.x, p.z) || 1;
    const nx = p.x / len;
    const nz = p.z / len;
    const y = yFn(p.x, p.z);
    for (let s = 0; s < rows; s += 1) {
      const a = (s / segments) * Math.PI * 0.5;
      positions.push(
        p.x + nx * Math.sin(a) * radius,
        y + (Math.cos(a) - 1) * radius,
        p.z + nz * Math.sin(a) * radius,
      );
    }
  }
  const indices = [];
  const pattern = filletPattern(positions, rows, outline[0]);
  for (let i = 0; i < count; i += 1) {
    const i2 = (i + 1) % count;
    for (let s = 0; s < segments; s += 1) {
      const a = i * rows + s;
      const b = i2 * rows + s;
      const c = a + 1;
      const d = b + 1;
      if (pattern) indices.push(a, c, b, c, d, b);
      else indices.push(a, b, c, c, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function filletPattern(positions, rows, origin) {
  const ax = positions[0];
  const ay = positions[1];
  const az = positions[2];
  const bx = positions[rows * 3];
  const by = positions[rows * 3 + 1];
  const bz = positions[rows * 3 + 2];
  const cx = positions[3];
  const cy = positions[4];
  const cz = positions[5];
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const dot = nx * origin.x + ny * 0 + nz * origin.z;
  return dot < 0;
}

function addRetainingWall(parent, material, outline) {
  const group = new THREE.Group();
  group.name = 'retainingWall';
  const count = outline.length;
  for (let i = 0; i < count; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % count];
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const len = Math.hypot(mx, mz) || 1;
    const nx = mx / len;
    const nz = mz / len;
    const onFront = mz > 6 && nz > 0.38;
    const onWest = mx < -10 && nx < -0.42 && mz > -4 && mz < 26;
    const onSteep = onFront || onWest;
    if (!onSteep) continue;
    const y0 = PLINTH_TOP + 0.08;
    const y1 = (heightAt(a.x, a.z) + heightAt(b.x, b.z)) * 0.5 - GRASS_T - 0.2;
    if (y1 - y0 < 1) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const edge = Math.hypot(dx, dz);
    const box = new THREE.Mesh(new THREE.BoxGeometry(edge, y1 - y0, 0.28), material);
    box.name = `retainingWall${i}`;
    box.position.set(mx + nx * 1.05, (y0 + y1) / 2, mz + nz * 1.05);
    box.quaternion.setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(dx / edge, 0, dz / edge),
    );
    group.add(box);
  }
  parent.add(group);
}

export function createTerrain(terrainRoot, material) {
  const outline = makeOutline(1, 72);
  const interior = makeInterior(1, 32, 48, outline);
  const main = triangulate(outline, interior, 1);

  const grassTop = (x, z) => strataAt(x, z).grass.top;
  const grassBot = (x, z) => strataAt(x, z).grass.bottom;
  addLayer(terrainRoot, material, 'grassSurface', main, grassTop, grassBot, {
    top: true,
    bottom: true,
    skirt: false,
  });
  addLayer(terrainRoot, material, 'grassCutEdge', main, grassTop, grassBot, {
    top: false,
    bottom: false,
    skirt: true,
  });
  addLayer(
    terrainRoot,
    material,
    'shallowSoil',
    main,
    (x, z) => strataAt(x, z).shallow.top,
    (x, z) => strataAt(x, z).shallow.bottom,
    { top: true, bottom: true, skirt: true },
  );
  addLayer(
    terrainRoot,
    material,
    'deepSoil',
    main,
    (x, z) => strataAt(x, z).deep.top,
    (x, z) => strataAt(x, z).deep.bottom,
    { top: true, bottom: true, skirt: true },
  );
  addLayer(
    terrainRoot,
    material,
    'rockLayer',
    main,
    (x, z) => strataAt(x, z).rock.top,
    (x, z) => strataAt(x, z).rock.bottom,
    { top: true, bottom: true, skirt: true },
  );

  const fillet = new THREE.Group();
  fillet.name = 'edgeFillet';
  addMesh(fillet, 'grassLip', buildFillet(outline, heightAt, 0.42), material);
  terrainRoot.add(fillet);
}
