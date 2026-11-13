import * as THREE from 'three';
import { roadY } from './terrain.js';
import { standardMaterial } from './cache.js';

const ROAD_W = 2.2;
const UP = new THREE.Vector3(0, 1, 0);

const WEST = [
  [-37.5, -36],
  [-34, -18],
  [-28.5, 0],
  [-24, 16],
  [-20, 28],
  [-12, 34],
  [-6.3, 38.2],
  [-4.2, 39.8],
  [-2, 41.6],
  [-2, 44.5],
  [-2, 47.2],
  [-2, 50],
];

const EAST = [
  [1.75, 38.2],
  [5.2, 37.4],
  [8, 36],
  [16, 30],
  [20.5, 22],
  [23, 12],
  [25.2, 4],
  [27.5, -4],
  [29, -12],
  [31, -18],
  [30, -28],
  [28, -34],
];

const ROUND_Z = 38.2;
const ROUND_Y = roadY(-2, ROUND_Z);

function snapCurve(xz, lockExit) {
  const flatPoints = xz.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const flat = new THREE.CatmullRomCurve3(flatPoints, false, 'catmullrom', 0.35);
  flat.arcLengthDivisions = 200;
  const lifted = flat.getSpacedPoints(96).map((point) => {
    const y = lockExit && point.z >= ROUND_Z ? ROUND_Y : roadY(point.x, point.z);
    return new THREE.Vector3(point.x, y, point.z);
  });
  const curve = new THREE.CatmullRomCurve3(lifted, false, 'catmullrom', 0);
  curve.arcLengthDivisions = 240;
  return curve;
}

function makeFrames(curve, lockExit) {
  const divisions = Math.max(16, Math.round(curve.getLength() / 0.8));
  const pts = curve.getSpacedPoints(divisions);
  if (lockExit) {
    pts.forEach((point) => {
      if (point.z >= ROUND_Z) point.y = ROUND_Y;
    });
  }
  return pts.map((point, index) => {
    const prev = pts[Math.max(0, index - 1)];
    const next = pts[Math.min(pts.length - 1, index + 1)];
    const tangent = new THREE.Vector3().subVectors(next, prev);
    tangent.y = 0;
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, 1);
    tangent.normalize();
    const right = new THREE.Vector3().crossVectors(UP, tangent).normalize();
    return { point, tangent, right };
  });
}

function buildSlab(frames, width, yLift, thickness, lateral) {
  const n = frames.length;
  const hw = width / 2;
  const positions = [];
  for (const lift of [yLift, yLift - thickness]) {
    for (const frame of frames) {
      const center = frame.point.clone().addScaledVector(frame.right, lateral);
      const y = center.y + lift;
      const left = center.clone().addScaledVector(frame.right, -hw);
      const right = center.clone().addScaledVector(frame.right, hw);
      positions.push(left.x, y, left.z, right.x, y, right.z);
    }
  }
  const topCount = n * 2;
  const indices = [];
  for (let i = 0; i < n - 1; i += 1) {
    const l0 = i * 2;
    const r0 = l0 + 1;
    const l1 = (i + 1) * 2;
    const r1 = l1 + 1;
    indices.push(l0, l1, r0, l1, r1, r0);
    indices.push(l0 + topCount, r0 + topCount, l1 + topCount, l1 + topCount, r0 + topCount, r1 + topCount);
    indices.push(l0, l0 + topCount, l1, l1, l0 + topCount, l1 + topCount);
    indices.push(r0, r1, r0 + topCount, r1, r1 + topCount, r0 + topCount);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addSlab(parent, name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
}

function addRoad(parent, material, name, xz, parapet, lockExit) {
  const group = new THREE.Group();
  group.name = name;
  const curve = snapCurve(xz, lockExit);
  const frames = makeFrames(curve, lockExit);
  addSlab(group, `${name}Surface`, buildSlab(frames, ROAD_W, 0, 0.08, 0), material);
  addSlab(group, `${name}CurbL`, buildSlab(frames, 0.2, 0.12, 0.16, ROAD_W / 2 + 0.12), material);
  addSlab(group, `${name}CurbR`, buildSlab(frames, 0.2, 0.12, 0.16, -(ROAD_W / 2 + 0.12)), material);
  if (parapet) {
    addSlab(group, `${name}Parapet`, buildSlab(frames, 0.28, 0.9, 0.82, 1.55), material);
  }
  parent.add(group);
}

function addSidewalk(parent, xz) {
  const group = new THREE.Group();
  group.name = 'eastSidewalk';
  const frames = makeFrames(snapCurve(xz));
  const lateral = -(ROAD_W / 2 + 0.86);
  const surface = standardMaterial(0xd4cec3);
  addSlab(group, 'eastSidewalkSurface', buildSlab(frames, 1.2, 0.05, 0.06, lateral), surface);
  parent.add(group);
}

export function getRoadCurves() {
  return {
    west: snapCurve(WEST, true),
    east: snapCurve(EAST),
  };
}

function addRoundabout(parent, material) {
  const x = -2;
  const z = 38.2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.85, 4.15, 40), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, roadY(x, z) + 0.07, z);
  ring.name = 'roundaboutRoad';
  parent.add(ring);
}

export function createRoads(roadsRoot, material) {
  addRoad(roadsRoot, material, 'westRoad', WEST, false, true);
  addRoad(roadsRoot, material, 'eastRoad', EAST, true);
  addSidewalk(roadsRoot, EAST);
  addRoundabout(roadsRoot, material);
}
