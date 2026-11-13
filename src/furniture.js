import * as THREE from 'three';
import { heightAt, roadY } from './terrain.js';
import { getRoadCurves } from './roads.js';
import { addInstanced } from './instancing.js';
import { standardMaterial } from './cache.js';
import { registerEmissive, registerNightOnly } from './lighting.js';

const UP = new THREE.Vector3(0, 1, 0);

function sampleCurve(curve, spacing) {
  const length = curve.getLength();
  const count = Math.max(1, Math.floor(length / spacing));
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const u = Math.min(0.98, ((i + 0.5) * spacing) / length);
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    tangent.y = 0;
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, 1);
    tangent.normalize();
    const right = new THREE.Vector3().crossVectors(UP, tangent).normalize();
    points.push({ point, tangent, right });
  }
  return points;
}

function evenSamples(curve, count) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const u = (i + 0.5) / count;
    const point = curve.getPointAt(Math.min(0.98, u));
    const tangent = curve.getTangentAt(Math.min(0.98, u));
    tangent.y = 0;
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, 1);
    tangent.normalize();
    const right = new THREE.Vector3().crossVectors(UP, tangent).normalize();
    points.push({ point, tangent, right, yaw: Math.atan2(tangent.x, tangent.z) });
  }
  return points;
}

function haloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,217,160,0.55)');
  gradient.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function haloMaterial() {
  return new THREE.MeshBasicMaterial({
    map: haloTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function haloSpriteMaterial() {
  return new THREE.SpriteMaterial({
    map: haloTexture(),
    transparent: true,
    depthWrite: false,
  });
}

function iconMaterial(glyph, ink) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = ink;
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return standardMaterial(0xffffff, { map: texture });
}

function plateMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f4ee';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#1a3d2b';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CITYU', 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return standardMaterial(0xffffff, { map: texture });
}

export { plateMaterial };

export function createFurniture(root) {
  const curves = getRoadCurves();
  const lamps = [
    ...sampleCurve(curves.west, 5.6),
    ...sampleCurve(curves.east, 5.6),
  ];
  const poles = [];
  const arms = [];
  const shades = [];
  const faces = [];
  const halos = [];
  lamps.forEach(({ point, right, yaw }) => {
    const base = point.clone().addScaledVector(right, 1.15);
    const ry = Math.atan2(right.x, right.z);
    poles.push({ x: base.x, y: base.y + 1.15, z: base.z, ry, color: 0xc9c4ba });
    arms.push({
      x: base.x + right.x * 0.28,
      y: base.y + 2.2,
      z: base.z + right.z * 0.28,
      ry,
      color: 0xc9c4ba,
    });
    shades.push({
      x: base.x + right.x * 0.55,
      y: base.y + 2.28,
      z: base.z + right.z * 0.55,
      ry,
      color: 0xf4f1ea,
    });
    faces.push({
      x: base.x + right.x * 0.55,
      y: base.y + 2.16,
      z: base.z + right.z * 0.55,
      ry,
      color: 0xfff0c8,
    });
    halos.push({
      x: base.x + right.x * 0.55,
      y: base.y + 2.16,
      z: base.z + right.z * 0.55,
      ry,
    });
    void yaw;
  });

  const white = standardMaterial(0xffffff);
  const lampShade = registerEmissive(standardMaterial(0xffd9a0, {
    emissive: 0xffd9a0,
    emissiveIntensity: 0,
  }), 0, 1.19);
  const lampFace = registerEmissive(standardMaterial(0xffd9a0, {
    emissive: 0xffd9a0,
    emissiveIntensity: 0,
  }), 0, 2.24);
  addInstanced(root, 'lampPoles', new THREE.CylinderGeometry(0.06, 0.07, 2.3, 6), white, poles);
  addInstanced(root, 'lampArms', new THREE.BoxGeometry(0.55, 0.05, 0.05), white, arms);
  addInstanced(root, 'lampShades', new THREE.CylinderGeometry(0.16, 0.22, 0.12, 8), lampShade, shades);
  addInstanced(root, 'lampFaces', new THREE.BoxGeometry(0.16, 0.04, 0.16), lampFace, faces);
  registerNightOnly(addInstanced(root, 'lampHalos', new THREE.PlaneGeometry(2.4, 2.4), haloMaterial(), halos));

  const fence = sampleCurve(curves.east, 2.2);
  const posts = [];
  const rails = [];
  fence.forEach(({ point, tangent, right }) => {
    const zPos = point.z + right.z;
    const zNeg = point.z - right.z;
    const sign = zPos < zNeg ? 1 : -1;
    const position = point.clone().addScaledVector(right, sign * 1.35);
    const ry = Math.atan2(tangent.x, tangent.z);
    posts.push({ x: position.x, y: position.y + 0.48, z: position.z, ry, color: 0xf4f1ea });
    rails.push({
      x: position.x,
      y: position.y + 0.78,
      z: position.z,
      ry,
      color: 0xf4f1ea,
    });
  });
  addInstanced(root, 'fencePosts', new THREE.CylinderGeometry(0.07, 0.07, 0.9, 5), white, posts);
  addInstanced(root, 'fenceRails', new THREE.BoxGeometry(1.35, 0.08, 0.06), white, rails);

  const lampCount = faces.length;
  if (lampCount < 30 || lampCount > 120) {
    throw new Error(`路燈數 ${lampCount} 超出 60–120`);
  }

  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const pools = [
    ...faces.map((face) => ({
      x: face.x,
      y: face.y - 2.1,
      z: face.z,
      rx: -Math.PI / 2,
      sx: 1.6,
      sz: 1.6,
    })),
  ];
  const poolMesh = addInstanced(root, 'lampGroundPools', new THREE.PlaneGeometry(1, 1), poolMat, pools);
  poolMesh.castShadow = false;
  poolMesh.receiveShadow = false;
  registerNightOnly(poolMesh);

  const seats = [];
  const backs = [];
  const benchLegs = [];
  [[-6, 32], [4, 33], [-8, 27], [6, 28], [0, 18], [-16, 8]].forEach(([x, z], index) => {
    const y = heightAt(x, z);
    seats.push({ x, y: y + 0.32, z, ry: index * 0.2, color: 0xc9c4ba });
    backs.push({ x, y: y + 0.52, z: z - 0.16, ry: index * 0.2, color: 0xc9c4ba });
    benchLegs.push({ x: x - 0.28, y: y + 0.16, z, color: 0x8a6244 });
    benchLegs.push({ x: x + 0.28, y: y + 0.16, z, color: 0x8a6244 });
  });
  addInstanced(root, 'benchSeats', new THREE.BoxGeometry(0.9, 0.08, 0.32), white, seats);
  addInstanced(root, 'benchBacks', new THREE.BoxGeometry(0.9, 0.28, 0.06), white, backs);
  addInstanced(root, 'benchLegs', new THREE.BoxGeometry(0.06, 0.28, 0.06), white, benchLegs);

  const bins = [[-4, 31], [3, 30], [8, 18], [-10, 6], [2, -6], [16, 12]].map(([x, z]) => ({
    x,
    y: heightAt(x, z) + 0.28,
    z,
    color: 0x6f8796,
  }));
  const lids = bins.map((bin) => ({ ...bin, y: bin.y + 0.28, color: 0xc9c4ba }));
  addInstanced(root, 'bins', new THREE.CylinderGeometry(0.16, 0.16, 0.48, 8), white, bins);
  addInstanced(root, 'binLids', new THREE.CylinderGeometry(0.18, 0.18, 0.06, 8), white, lids);

  const crossing = sampleCurve(curves.west, 4).reduce((best, item) => (
    Math.abs(item.point.z - 36) < Math.abs(best.point.z - 36) ? item : best
  ));
  const stripes = [];
  for (let i = -3; i <= 2; i += 1) {
    const position = crossing.point.clone().addScaledVector(crossing.right, i * 0.38);
    stripes.push({
      x: position.x,
      y: position.y + 0.04,
      z: position.z,
      ry: Math.atan2(crossing.tangent.x, crossing.tangent.z),
      color: 0xf7f4ee,
    });
  }
  addInstanced(root, 'zebra', new THREE.BoxGeometry(0.22, 0.02, 2.1), white, stripes);

  const dashes = [...sampleCurve(curves.west, 2.4), ...sampleCurve(curves.east, 2.4)].map(({ point, tangent }) => ({
    x: point.x,
    y: point.y + 0.03,
    z: point.z,
    ry: Math.atan2(tangent.x, tangent.z),
    color: 0xf7f4ee,
  }));
  addInstanced(root, 'laneMarks', new THREE.BoxGeometry(0.08, 0.02, 0.55), white, dashes);

  const guides = [[-16, 30], [11, 18], [-2, 35.2], [-24, 12]];
  const guidePosts = [];
  const guideBoards = [];
  guides.forEach(([x, z]) => {
    const y = roadY(x, z);
    guidePosts.push({ x, y: y + 0.7, z, color: 0xc9c4ba });
    guideBoards.push({ x, y: y + 1.25, z, color: 0x1f6b45 });
  });
  addInstanced(root, 'guidePosts', new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), white, guidePosts);
  addInstanced(root, 'guideBoards', new THREE.BoxGeometry(0.46, 0.32, 0.04), white, guideBoards);

  const facilities = [
    { glyph: '$', ink: '#1a3d2b', x: 6, z: 34.6 },
    { glyph: '餐', ink: '#e25a4a', x: -14.8, z: 15.4 },
    { glyph: '店', ink: '#3f8f6a', x: 12.5, z: 13.2 },
    { glyph: '禮', ink: '#a97850', x: -8.2, z: 1.2 },
    { glyph: '禮', ink: '#a97850', x: 6, z: -9.2 },
  ];
  facilities.forEach((item, index) => {
    const y = heightAt(item.x, item.z);
    const post = [{ x: item.x, y: y + 0.55, z: item.z, color: 0xc9c4ba }];
    const board = [{ x: item.x, y: y + 1.05, z: item.z }];
    addInstanced(root, `facilityPost${index}`, new THREE.CylinderGeometry(0.035, 0.035, 1.1, 5), white, post);
    addInstanced(
      root,
      `facilityBoard${index}`,
      new THREE.PlaneGeometry(0.42, 0.42),
      iconMaterial(item.glyph, item.ink),
      board,
    );
  });

  const islandX = -2;
  const islandZ = 38.2;
  const islandY = roadY(islandX, islandZ);
  addInstanced(root, 'roundaboutHedge', new THREE.TorusGeometry(2.15, 0.2, 8, 28), white, [
    { x: islandX, y: islandY + 0.28, z: islandZ, rx: Math.PI / 2, color: 0xc9c4ba },
  ]);
  addInstanced(root, 'roundaboutLawn', new THREE.CylinderGeometry(1.85, 1.85, 0.16, 24), white, [
    { x: islandX, y: islandY + 0.12, z: islandZ, color: 0x8fcb6a },
  ]);
  addInstanced(root, 'roundaboutShrubs', new THREE.SphereGeometry(0.28, 8, 6), white, [
    { x: islandX, y: islandY + 0.42, z: islandZ, color: 0x2f8a3c },
    { x: islandX - 0.7, y: islandY + 0.34, z: islandZ + 0.35, sx: 0.8, sy: 0.8, sz: 0.8, color: 0x3f8f6a },
    { x: islandX + 0.65, y: islandY + 0.32, z: islandZ - 0.4, sx: 0.7, sy: 0.7, sz: 0.7, color: 0xa3c45a },
  ]);
  const sideStripes = [];
  [-4.8, 2.8].forEach((x) => {
    for (let i = -2; i <= 2; i += 1) {
      sideStripes.push({
        x,
        y: roadY(x, islandZ + i * 0.45) + 0.04,
        z: islandZ + i * 0.45,
        ry: Math.PI / 2,
        color: 0xf7f4ee,
      });
    }
  });
  addInstanced(root, 'forecourtZebra', new THREE.BoxGeometry(0.22, 0.02, 1.4), white, sideStripes);
}
