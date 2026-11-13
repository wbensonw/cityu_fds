import * as THREE from 'three';
import { heightAt, inside } from './terrain.js';
import { boxGeometry, getMaterial, mat, standardMaterial } from './cache.js';

function ground(x, z) {
  return inside(x, z) ? heightAt(x, z) : 0.04;
}

function addFlight(parent, spec) {
  const group = new THREE.Group();
  group.name = spec.name;
  const dir = new THREE.Vector3(spec.toX - spec.fromX, 0, spec.toZ - spec.fromZ);
  const length = dir.length();
  dir.multiplyScalar(1 / length);
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const yStart = ground(spec.fromX, spec.fromZ);
  const yEnd = ground(spec.toX, spec.toZ) + (spec.lift || 0);
  const rise = yEnd - yStart;
  const steps = spec.steps || Math.max(4, Math.round(Math.abs(rise) / 0.22));
  const run = length / steps;

  for (let index = 0; index < steps; index += 1) {
    const t0 = index / steps;
    const t1 = (index + 1) / steps;
    const x0 = spec.fromX + dir.x * length * t0;
    const z0 = spec.fromZ + dir.z * length * t0;
    const x1 = spec.fromX + dir.x * length * t1;
    const z1 = spec.fromZ + dir.z * length * t1;
    const low = yStart + rise * t0;
    const high = yStart + rise * t1;
    const top = Math.max(low, high, ground((x0 + x1) / 2, (z0 + z1) / 2));
    const bot = Math.min(low, high) - 0.05;
    const height = Math.max(0.1, top - bot);
    const tread = new THREE.Mesh(boxGeometry(spec.width, height, run + 0.03), mat.wall());
    tread.name = `${spec.name}Step${index}`;
    tread.position.set((x0 + x1) / 2, bot + height / 2, (z0 + z1) / 2);
    tread.rotation.y = Math.atan2(dir.x, dir.z);
    group.add(tread);
  }

  [-1, 1].forEach((hand) => {
    const y0 = yStart + 0.46;
    const y1 = yEnd + 0.46;
    const start = new THREE.Vector3(spec.fromX, y0, spec.fromZ).addScaledVector(side, (spec.width / 2) * hand);
    const end = new THREE.Vector3(spec.toX, y1, spec.toZ).addScaledVector(side, (spec.width / 2) * hand);
    const rail = new THREE.Mesh(boxGeometry(0.06, 0.06, start.distanceTo(end)), mat.frame());
    rail.name = `${spec.name}Rail${hand}`;
    rail.position.copy(start).add(end).multiplyScalar(0.5);
    rail.lookAt(end);
    group.add(rail);
    [start, end].forEach((point, index) => {
      const post = new THREE.Mesh(boxGeometry(0.07, 0.52, 0.07), mat.frame());
      post.name = `${spec.name}Post${hand}${index}`;
      post.position.set(point.x, point.y - 0.22, point.z);
      group.add(post);
    });
  });

  parent.add(group);
}

function addParking(parent) {
  const x = -22;
  const z = -28;
  const y = heightAt(x, z);
  const pad = new THREE.Mesh(
    boxGeometry(6.6, 0.08, 4.4),
    getMaterial('parking', () => standardMaterial(0xb7bec6, { roughness: 0.94 })),
  );
  pad.name = 'parkingPad';
  pad.position.set(x, y + 0.05, z);
  parent.add(pad);
  const lineMat = getMaterial('parkingLine', () => standardMaterial(0xf7f4ee, { roughness: 0.8 }));
  for (let index = 0; index < 3; index += 1) {
    const line = new THREE.Mesh(boxGeometry(0.06, 0.02, 3.6), lineMat);
    line.name = `parkingLine${index}`;
    line.position.set(x - 2.2 + index * 2.2, y + 0.1, z);
    parent.add(line);
  }
}

export function createStairs(parent) {
  const root = new THREE.Group();
  root.name = 'stairsRoot';
  const flights = [
    { name: '主階梯', fromX: -1, fromZ: 16.5, toX: -1, toZ: 1.75, width: 3.4 },
    { name: '何賢前階', fromX: 8, fromZ: 14.6, toX: 8, toZ: 12.8, width: 2.4, steps: 6 },
    { name: '大豐樓至中庭', fromX: 0.2, fromZ: -10.8, toX: 0.2, toZ: -12.8, width: 2.4, lift: 0.5, steps: 8 },
  ];
  flights.forEach((flight) => addFlight(root, flight));
  addParking(root);
  parent.add(root);
  return root;
}
