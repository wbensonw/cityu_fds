import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { HALF_Z, halfWidthAt, roadY, westPad } from './terrain.js';
import { standardMaterial } from './cache.js';

const DRY = 0xf0ddb0;
const DUNE = 0xd7a45a;
const WET = 0x8d6844;
const FOAM = 0xf4efe4;
const DAY_WATER = 0x1a6f96;
const NIGHT_WATER = 0x0c3348;
const SEA_SIZE = 480;

const SEA_STOPS = [
  [0, [150, 220, 210]],
  [46, [70, 196, 198]],
  [78, [24, 130, 168]],
  [115, [10, 64, 120]],
  [165, [5, 28, 68]],
  [230, [2, 12, 32]],
];

const REEFS = [
  { x: 86, z: 28, r: 18 },
  { x: -96, z: 12, r: 22 },
  { x: 48, z: -92, r: 16 },
  { x: -38, z: 112, r: 20 },
  { x: 128, z: -18, r: 24 },
  { x: -140, z: -64, r: 18 },
];

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixRgb(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

const END_PAD = 16;

function edgeAt(z, pad) {
  const south = HALF_Z - 0.5;
  const north = -south;
  const clamped = THREE.MathUtils.clamp(z, north, south);
  let east = halfWidthAt(clamped) + pad;
  let west = -(halfWidthAt(clamped) + westPad(clamped) + pad);
  let pinch = 1;
  if (z > south) pinch = Math.cos(Math.min(1, (z - south) / END_PAD) * Math.PI * 0.5);
  else if (z < north) pinch = Math.cos(Math.min(1, (north - z) / END_PAD) * Math.PI * 0.5);
  pinch = Math.max(pinch, 0.05);
  const mid = (east + west) / 2;
  return {
    east: mid + (east - mid) * pinch,
    west: mid + (west - mid) * pinch,
  };
}

function ringShape(innerPad, outerPad, fullHole = false) {
  const steps = 56;
  const zOuter0 = -HALF_Z - END_PAD + 0.5;
  const zOuter1 = HALF_Z + END_PAD - 0.5;
  const zHole0 = fullHole ? zOuter0 : -HALF_Z;
  const zHole1 = fullHole ? zOuter1 : HALF_Z;
  const shape = new THREE.Shape();
  const outerEast = [];
  const outerWest = [];
  for (let i = 0; i <= steps; i += 1) {
    const z = THREE.MathUtils.lerp(zOuter0, zOuter1, i / steps);
    const edge = edgeAt(z, outerPad);
    outerEast.push([edge.east, z]);
    outerWest.push([edge.west, z]);
  }
  shape.moveTo(outerEast[0][0], outerEast[0][1]);
  outerEast.slice(1).forEach(([x, z]) => shape.lineTo(x, z));
  for (let i = outerWest.length - 1; i >= 0; i -= 1) shape.lineTo(outerWest[i][0], outerWest[i][1]);
  shape.closePath();

  const hole = new THREE.Path();
  const innerEast = [];
  const innerWest = [];
  for (let i = 0; i <= steps; i += 1) {
    const z = THREE.MathUtils.lerp(zHole0, zHole1, i / steps);
    const edge = edgeAt(z, innerPad);
    innerEast.push([edge.east, z]);
    innerWest.push([edge.west, z]);
  }
  hole.moveTo(innerEast[innerEast.length - 1][0], innerEast[innerEast.length - 1][1]);
  for (let i = innerEast.length - 2; i >= 0; i -= 1) hole.lineTo(innerEast[i][0], innerEast[i][1]);
  innerWest.forEach(([x, z]) => hole.lineTo(x, z));
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function sandMap(hex) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(hex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  const image = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const blot = Math.sin(x * 0.07) * Math.cos(y * 0.06) * 26
        + Math.sin(x * 0.19 + y * 0.16) * 16;
      const raw = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = raw - Math.floor(raw);
      const speck = (x * 17 + y * 13) % 47 < 2 ? -34 : 0;
      const delta = blot + (grain - 0.5) * 36 + speck;
      image.data[i] = clampByte(image.data[i] + delta);
      image.data[i + 1] = clampByte(image.data[i + 1] + delta * 0.92);
      image.data[i + 2] = clampByte(image.data[i + 2] + delta * 0.72);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 10);
  return texture;
}

function foamMap() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const color = new THREE.Color(FOAM);
  const red = Math.round(color.r * 255);
  const green = Math.round(color.g * 255);
  const blue = Math.round(color.b * 255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const n = Math.sin(x * 0.31) * Math.cos(y * 0.22) + Math.sin((x + y) * 0.15);
      const broken = n > -0.15;
      image.data[i] = red;
      image.data[i + 1] = green;
      image.data[i + 2] = blue;
      image.data[i + 3] = broken ? 170 : 36;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 16);
  return texture;
}

function bandMesh(shape, map, y, name, opts = {}) {
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, standardMaterial(0xffffff, {
    map,
    roughness: opts.roughness ?? 0.96,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    depthWrite: opts.depthWrite ?? true,
  }));
  mesh.name = name;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function seaColor(distance) {
  let index = 0;
  while (index < SEA_STOPS.length - 1 && distance > SEA_STOPS[index + 1][0]) index += 1;
  const start = SEA_STOPS[index];
  const end = SEA_STOPS[Math.min(index + 1, SEA_STOPS.length - 1)];
  const span = end[0] - start[0];
  const t = span === 0 ? 0 : THREE.MathUtils.clamp((distance - start[0]) / span, 0, 1);
  const smooth = t * t * (3 - 2 * t);
  return mixRgb(start[1], end[1], smooth);
}

function seabedMap() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const centerX = -4;
  const centerZ = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wx = (x / (size - 1) - 0.5) * SEA_SIZE;
      const wz = (y / (size - 1) - 0.5) * SEA_SIZE;
      const distance = Math.hypot(wx - centerX, wz - centerZ);
      let rgb = seaColor(distance);
      const grain = Math.sin(wx * 0.41) * Math.cos(wz * 0.33) + Math.sin((wx + wz) * 0.17);
      rgb = rgb.map((channel) => channel + grain * 10);
      REEFS.forEach((reef) => {
        const reefDistance = Math.hypot(wx - reef.x, wz - reef.z);
        if (reefDistance >= reef.r) return;
        const k = 1 - reefDistance / reef.r;
        rgb = mixRgb(rgb, [10, 58, 64], k * k * 0.85);
      });
      const i = (y * size + x) * 4;
      image.data[i] = clampByte(rgb[0]);
      image.data[i + 1] = clampByte(rgb[1]);
      image.data[i + 2] = clampByte(rgb[2]);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function waterNormals() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const wave = Math.sin(x * 0.45) * Math.cos(y * 0.38) + Math.sin((x + y) * 0.21) * 0.6;
      image.data[i] = 128 + wave * 36;
      image.data[i + 1] = 128 + Math.cos(x * 0.33 + y * 0.27) * 36;
      image.data[i + 2] = 230;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

function gradeShore(water) {
  const next = water.material.fragmentShader
    .replace(
      'uniform vec3 waterColor;',
      'uniform vec3 waterColor;\nuniform float uDay;',
    )
    .replace(
      /vec3 scatter = max\( 0\.0, dot\( surfaceNormal, eyeDirection \) \) \* waterColor;[\s\S]*?vec3 albedo = mix\([\s\S]*?reflectance\);/,
      `float shore = clamp(length(worldPosition.xz - vec2(-4.0, 4.0)) / 190.0, 0.0, 1.0);
       vec3 shallow = mix(vec3(0.03, 0.11, 0.15), vec3(0.62, 0.98, 0.92), uDay);
       vec3 deep = mix(vec3(0.004, 0.02, 0.04), vec3(0.01, 0.07, 0.16), uDay);
       vec3 graded = mix(shallow, deep, smoothstep(0.04, 0.4, shore));
       vec3 scatter = max(0.0, dot(surfaceNormal, eyeDirection)) * graded;
       vec3 albedo = mix(graded, vec3(0.05) + reflectionSample * 0.8, reflectance * 0.22);`,
    );
  if (!next.includes('uDay')) throw new Error('海面漸層著色失敗');
  water.material.fragmentShader = next;
  water.material.uniforms.uDay = { value: 1 };
  water.material.needsUpdate = true;
}

export function createIsland(root, sun) {
  const sandY = roadY(-2, 38.2);
  const dry = bandMesh(ringShape(1, 6), sandMap(DRY), sandY - 0.1, 'drySand');
  const dune = bandMesh(ringShape(6, 12, true), sandMap(DUNE), sandY - 0.07, 'duneSand');
  const wet = bandMesh(ringShape(12, 17, true), sandMap(WET), sandY - 0.04, 'wetSand');
  const foam = bandMesh(ringShape(16.2, 17.8, true), foamMap(), sandY + 0.02, 'foam', {
    roughness: 0.62,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  foam.castShadow = false;
  foam.receiveShadow = false;

  const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE),
    standardMaterial(0xffffff, { map: seabedMap(), roughness: 1 }),
  );
  bed.name = 'seabed';
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = sandY - 0.8;
  bed.receiveShadow = true;
  bed.castShadow = false;

  const sunDirection = sun.position.clone().normalize();
  const water = new Water(new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: waterNormals(),
    sunDirection,
    sunColor: 0xffffff,
    waterColor: DAY_WATER,
    distortionScale: 3.7,
    alpha: 0.58,
    fog: false,
  });
  water.name = 'ocean';
  water.rotation.x = -Math.PI / 2;
  water.position.y = sandY - 0.35;
  water.castShadow = false;
  water.receiveShadow = false;
  water.material.transparent = true;
  water.material.depthWrite = false;
  water.renderOrder = 1;
  water.material.uniforms.alpha.value = 0.58;
  gradeShore(water);

  root.add(bed, dry, dune, wet, foam, water);

  return {
    water,
    update(time) {
      water.material.uniforms.time.value = time;
    },
  };
}

export function applyIslandTime(water, night) {
  if (!water) return;
  water.material.uniforms.waterColor.value.set(night ? NIGHT_WATER : DAY_WATER);
  water.material.uniforms.sunColor.value.set(night ? 0xffe6c8 : 0xffffff);
  if (water.material.uniforms.uDay) water.material.uniforms.uDay.value = night ? 0 : 1;
}
