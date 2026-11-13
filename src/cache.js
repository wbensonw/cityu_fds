import * as THREE from 'three';

const geometries = new Map();
const materials = new Map();

export function getGeometry(key, create) {
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = create();
    geometry.name = key;
    geometries.set(key, geometry);
  }
  return geometry;
}

export function getMaterial(key, create) {
  let material = materials.get(key);
  if (!material) {
    material = create();
    material.name = key;
    materials.set(key, material);
  }
  return material;
}

export function standardMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    ...extra,
  });
}

export const mat = {
  wall: () => getMaterial('wall', () => standardMaterial(0xf4f1ea)),
  frame: () => getMaterial('frame', () => standardMaterial(0xc9c4ba)),
  glass: () => getMaterial('glass', () => standardMaterial(0x6f8796, {
    transparent: true,
    opacity: 0.62,
    roughness: 0.22,
    depthWrite: false,
  })),
  blueGlass: () => getMaterial('blueGlass', () => standardMaterial(0x49a0dc, {
    transparent: true,
    opacity: 0.82,
    roughness: 0.16,
    depthWrite: false,
  })),
  canopy: () => getMaterial('canopy', () => standardMaterial(0xe25a4a)),
  column: () => getMaterial('column', () => standardMaterial(0x3f8f6a)),
  roof: () => getMaterial('roof', () => standardMaterial(0x8fcb6a)),
  tree: () => getMaterial('tree', () => standardMaterial(0x2f8a3c)),
  curtain: () => getMaterial('curtain', () => standardMaterial(0xd5dde4)),
  emblemGreen: () => getMaterial('emblemGreen', () => standardMaterial(0x1f6b45)),
  emblemFace: () => getMaterial('emblemFace', () => standardMaterial(0xf7f4ee)),
  highlight: () => getMaterial('highlight', () => standardMaterial(0xffd56a)),
};

export function boxGeometry(width, height, depth) {
  const key = `box:${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}`;
  return getGeometry(key, () => new THREE.BoxGeometry(width, height, depth));
}

export function cityuMaterial() {
  return getMaterial('cityu', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f4f1ea';
    ctx.font = 'bold 78px "Segoe UI", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CITYU', 256, 68);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return standardMaterial(0xffffff, {
      map: texture,
      transparent: true,
      depthWrite: false,
    });
  });
}

export function signMaterial(lines) {
  const key = `sign:${lines.join('|')}`;
  return getMaterial(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a3d2b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (lines.length === 1) {
      ctx.font = 'bold 54px "Microsoft JhengHei", "PingFang TC", sans-serif';
      ctx.fillText(lines[0], 256, 128);
    } else {
      ctx.font = 'bold 52px "Microsoft JhengHei", "PingFang TC", sans-serif';
      ctx.fillText(lines[0], 256, 96);
      ctx.font = '34px "Microsoft JhengHei", "PingFang TC", sans-serif';
      ctx.fillText(lines[1], 256, 168);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return standardMaterial(0xffffff, { map: texture });
  });
}
