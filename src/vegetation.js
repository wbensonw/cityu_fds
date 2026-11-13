import * as THREE from 'three';
import { HALF_X, HALF_Z, heightAt, inside } from './terrain.js';
import { consumeRoofCrowns } from './parts.js';
import { getRoadCurves } from './roads.js';
import { addInstanced } from './instancing.js';
import { standardMaterial } from './cache.js';

const GREENS = [0x2f8a3c, 0x3f8f6a, 0xa3c45a];
const SCALES = [0.75, 1, 1.25];
const BLOCKS = [
  { x: -2, z: 22, w: 26, d: 16 },
  { x: -10, z: 7, w: 13, d: 12 },
  { x: -1, z: -5, w: 17, d: 13 },
  { x: 8, z: 7, w: 15, d: 11 },
  { x: -21.8, z: -15, w: 12, d: 16 },
  { x: -12.8, z: -14.2, w: 9, d: 18 },
  { x: 0.2, z: -20.2, w: 18.4, d: 8.6 },
  { x: 13.2, z: -16.4, w: 9, d: 13 },
  { x: 14, z: -4.2, w: 10, d: 14 },
  { x: -2, z: 38.2, w: 10, d: 10 },
  { x: -1, z: 9, w: 4.2, d: 16 },
  { x: 8, z: 13.7, w: 3, d: 2.4 },
  { x: 0.2, z: -11.8, w: 3, d: 2.6 },
  { x: 8.2, z: -5, w: 4.6, d: 2.4 },
  { x: -21, z: -2.7, w: 2.6, d: 8.5 },
  { x: 16.4, z: 8.2, w: 2.4, d: 4.4 },
  { x: -22, z: -28, w: 8, d: 6 },
];

const crowns = [];
const trunks = [];
const rings = [];
const shrubs = [];
const palmTrunks = [];
const palmLeaves = [];
const palmPits = [];

function inCourt(x, z) {
  return x > -7 && x < 7.4 && z > -15.8 && z < -11.2;
}

function blocked(x, z) {
  return inCourt(x, z) || BLOCKS.some((block) => Math.abs(x - block.x) < block.w / 2 && Math.abs(z - block.z) < block.d / 2);
}

function nearRoad(x, z, samples) {
  return samples.some((point) => {
    const dx = point.x - x;
    const dz = point.z - z;
    return dx * dx + dz * dz < 2.4;
  });
}

export function createTree(rng, options) {
  const layers = options.layers ?? 2 + Math.floor(rng() * 3);
  const green = options.green ?? Math.floor(rng() * 3);
  const scale = SCALES[options.scaleIndex ?? Math.floor(rng() * 3)];
  const yaw = options.yaw ?? rng() * Math.PI * 2;
  for (let layer = 0; layer < layers; layer += 1) {
    crowns.push({
      x: options.x + Math.cos(yaw + layer) * 0.18 * scale,
      y: options.y + 1.05 * scale + layer * 0.32 * scale,
      z: options.z + Math.sin(yaw + layer) * 0.18 * scale,
      sx: 0.62 * scale * (1.08 - layer * 0.12),
      sy: 0.5 * scale * (1.08 - layer * 0.12),
      sz: 0.62 * scale * (1.08 - layer * 0.12),
      color: GREENS[green],
    });
  }
  trunks.push({
    x: options.x,
    y: options.y + 0.48 * scale,
    z: options.z,
    sx: scale,
    sy: scale,
    sz: scale,
    color: 0x8a6244,
  });
  if (options.ground === false) return;
  rings.push({
    x: options.x,
    y: options.y + 0.03,
    z: options.z,
    sx: 0.85 * scale,
    sy: 1,
    sz: 0.85 * scale,
    color: 0x8fcb6a,
  });
  shrubs.push({
    x: options.x + Math.cos(yaw) * 0.55 * scale,
    y: options.y + 0.16 * scale,
    z: options.z + Math.sin(yaw) * 0.55 * scale,
    sx: 0.28 * scale,
    sy: 0.2 * scale,
    sz: 0.28 * scale,
    color: GREENS[(green + 1) % 3],
  });
}

function createPalm(rng, x, z, scale = 1) {
  const y = heightAt(x, z);
  const yaw = rng() * Math.PI * 2;
  const leaves = 6 + Math.floor(rng() * 3);
  palmPits.push({ x, y: y + 0.05 * scale, z, sx: scale, sy: 1, sz: scale, color: 0xc9c4ba });
  for (let segment = 0; segment < 5; segment += 1) {
    palmTrunks.push({
      x,
      y: y + (0.18 + segment * 0.32) * scale,
      z,
      sx: (1 - segment * 0.08) * scale,
      sy: scale,
      sz: (1 - segment * 0.08) * scale,
      color: 0xa97850,
    });
  }
  for (let leaf = 0; leaf < leaves; leaf += 1) {
    palmLeaves.push({
      x,
      y: y + 1.85 * scale,
      z,
      ry: yaw + (leaf / leaves) * Math.PI * 2,
      rz: 0.95,
      sx: scale,
      sy: scale,
      sz: scale,
      color: GREENS[leaf % 3],
    });
  }
}

function roadSamples() {
  const curves = getRoadCurves();
  const points = [];
  for (const curve of [curves.west, curves.east]) {
    const count = 24;
    for (let i = 0; i <= count; i += 1) points.push(curve.getPointAt(i / count));
  }
  return points;
}

function scatter(rng, samples) {
  let placed = 0;
  let guard = 0;
  while (placed < 200 && guard < 12000) {
    guard += 1;
    const x = (rng() * 2 - 1) * HALF_X * 0.9;
    const z = (rng() * 2 - 1) * HALF_Z * 0.9;
    if (!inside(x, z, 0.84) || blocked(x, z) || nearRoad(x, z, samples)) continue;
    createTree(rng, { x, y: heightAt(x, z), z });
    placed += 1;
  }
  if (placed !== 200) throw new Error(`球樹只放到 ${placed} 株`);
}

function placePalms(rng) {
  createPalm(rng, -13.6, 34.2, 1.55);
  createPalm(rng, 9.4, 34.2, 1.55);
  [[-4.8, -14.6], [-2.2, -12.4], [2.4, -14.8], [5.2, -12.6]].forEach(([x, z]) => {
    createTree(rng, { x, y: heightAt(x, z), z, layers: 2, green: 0, scaleIndex: 1 });
  });
}

export function createVegetation(root, rng) {
  consumeRoofCrowns().forEach((crown) => {
    createTree(rng, {
      x: crown.x,
      y: crown.y,
      z: crown.z,
      ground: false,
      layers: 2,
      green: 0,
      scaleIndex: 1,
      yaw: 0,
    });
  });
  const samples = roadSamples();
  scatter(rng, samples);
  placePalms(rng);

  const white = standardMaterial(0xffffff);
  addInstanced(root, 'treeCrowns', new THREE.SphereGeometry(1, 10, 8), white, crowns);
  addInstanced(root, 'treeTrunks', new THREE.CylinderGeometry(0.08, 0.12, 0.95, 6), white, trunks);
  addInstanced(root, 'grassRings', new THREE.CylinderGeometry(0.55, 0.55, 0.04, 10), white, rings);
  addInstanced(root, 'shrubs', new THREE.SphereGeometry(1, 8, 6), white, shrubs);
  addInstanced(root, 'palmTrunks', new THREE.CylinderGeometry(0.09, 0.12, 0.3, 6), white, palmTrunks);
  addInstanced(root, 'palmLeaves', new THREE.BoxGeometry(0.18, 0.04, 0.85), white, palmLeaves);
  addInstanced(root, 'palmPits', new THREE.CylinderGeometry(0.42, 0.48, 0.12, 8), white, palmPits);
}
