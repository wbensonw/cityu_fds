import * as THREE from 'three';
import { roadY } from './terrain.js';
import { getRoadCurves } from './roads.js';
import { createRng, readSeed } from './rng.js';

const LIT_CHANCE = 0.58;
const GLOW_COLORS = [0xffd9a0, 0xffc27a];
const GLOW_STEPS = [0.88, 1.39, 2.02];

const SPOTS = [
  { name: 'forecourt', x: -2, z: 33.6, lift: 3.1, intensity: 22.1, distance: 16, pool: true },
  { name: 'entrance', x: -1.6, z: 33, lift: 2.8, intensity: 22.1, distance: 16, pool: true },
];

const ROAD_LAMP_SPACING = 5.6;
const ROAD_LAMP_INTENSITY = 4.8;
const UP = new THREE.Vector3(0, 1, 0);

function roadLampSpots(curve, prefix) {
  const length = curve.getLength();
  const count = Math.max(1, Math.floor(length / ROAD_LAMP_SPACING));
  const spots = [];
  for (let index = 0; index < count; index += 1) {
    const u = Math.min(0.98, ((index + 0.5) * ROAD_LAMP_SPACING) / length);
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    tangent.y = 0;
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, 1);
    tangent.normalize();
    const right = new THREE.Vector3().crossVectors(UP, tangent).normalize();
    const head = point.clone().addScaledVector(right, 1.7);
    spots.push({
      name: `${prefix}${index}`,
      x: head.x,
      y: point.y,
      z: head.z,
      lift: 2.16,
      intensity: ROAD_LAMP_INTENSITY,
      distance: 14,
      pool: false,
      onCurve: true,
    });
  }
  return spots;
}

function roadSpots() {
  const curves = getRoadCurves();
  return [
    ...roadLampSpots(curves.east, 'east'),
    ...roadLampSpots(curves.west, 'west'),
  ];
}

function expectedPointLights() {
  return SPOTS.length + roadSpots().length;
}

const emissiveSlots = [];
const nightOnly = [];
const pointLights = [];
const nightSpots = [];

let glowRng = null;
let glowMaterials = null;
let windowTotal = 0;
let windowLit = 0;

export function readTime() {
  const value = new URLSearchParams(location.search).get('time');
  return value === 'night' ? 'night' : 'day';
}

export function registerEmissive(material, dayIntensity, nightIntensity) {
  material.emissiveIntensity = dayIntensity;
  emissiveSlots.push({ material, day: dayIntensity, night: nightIntensity });
  return material;
}

export function registerNightLight(light, intensity) {
  light.intensity = 0;
  light.userData.nightIntensity = intensity;
  nightSpots.push(light);
  return light;
}

export function registerNightOnly(object) {
  object.visible = false;
  nightOnly.push(object);
  return object;
}

export function resetWindowBudget() {
  glowRng = createRng(readSeed());
  windowTotal = 0;
  windowLit = 0;
}

function ensureGlowMaterials() {
  if (glowMaterials) return glowMaterials;
  glowMaterials = [];
  GLOW_COLORS.forEach((color, colorIndex) => {
    GLOW_STEPS.forEach((step, stepIndex) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0,
        roughness: 0.55,
        metalness: 0,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      material.name = `windowGlow${colorIndex}${stepIndex}`;
      registerEmissive(material, 0, step);
      glowMaterials.push(material);
    });
  });
  return glowMaterials;
}

export function windowGlowMaterial(index) {
  return ensureGlowMaterials()[index];
}

let windowHalo = null;

export function windowHaloMaterial() {
  if (windowHalo) return windowHalo;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,217,160,0.28)');
  gradient.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  windowHalo = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  windowHalo.name = 'windowHalo';
  return windowHalo;
}

export function nextWindowGlow() {
  if (!glowRng) resetWindowBudget();
  windowTotal += 1;
  if (glowRng() >= LIT_CHANCE) return null;
  windowLit += 1;
  const colorSlot = glowRng() < 0.5 ? 0 : 1;
  const stepSlot = Math.floor(glowRng() * 3);
  return colorSlot * 3 + stepSlot;
}

export function assertWindowRatio() {
  if (windowTotal < 1) throw new Error('沒有窗格');
  const ratio = windowLit / windowTotal;
  if (ratio < 0.45 || ratio > 0.7) {
    throw new Error(`窗光比例 ${(ratio * 100).toFixed(1)}%（${windowLit}/${windowTotal}）超出 45–70%`);
  }
}

export function createKeyLights(parent) {
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffc27a,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const poolGeo = new THREE.PlaneGeometry(5.4, 5.4);
  const pools = new THREE.Group();
  pools.name = 'keyLightPools';
  parent.add(pools);
  registerNightOnly(pools);

  [...SPOTS, ...roadSpots()].forEach((spot) => {
    const ground = spot.onCurve ? spot.y : roadY(spot.x, spot.z);
    const light = new THREE.PointLight(0xffc27a, 0, spot.distance, 2);
    light.name = `point-${spot.name}`;
    light.castShadow = false;
    light.position.set(spot.x, ground + spot.lift, spot.z);
    light.userData.nightIntensity = spot.intensity;
    parent.add(light);
    pointLights.push(light);

    if (!spot.pool) return;

    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.name = `pool-${spot.name}`;
    pool.position.set(spot.x, ground + 0.08, spot.z);
    pool.rotation.x = -Math.PI / 2;
    pool.castShadow = false;
    pool.receiveShadow = false;
    pools.add(pool);
  });

  const expected = expectedPointLights();
  if (pointLights.length !== expected) {
    throw new Error(`PointLight ${pointLights.length} 盞，必須為 ${expected}`);
  }
}

export function assertPointLightCap(root) {
  let count = 0;
  root.traverse((obj) => {
    if (obj.isPointLight) count += 1;
  });
  const expected = expectedPointLights();
  if (count !== expected) throw new Error(`全場 PointLight ${count} 盞，必須為 ${expected}`);
}

export function applyTime(mode, ctx) {
  const night = mode === 'night';
  ctx.renderer.setClearColor(night ? 0x163844 : 0x2f6d82, 1);
  ctx.renderer.toneMappingExposure = night ? 0.92 : 1;
  ctx.scene.fog = null;
  ctx.hemi.color.set(night ? 0xffe6c8 : 0xffffff);
  ctx.hemi.groundColor.set(night ? 0x3a342e : 0xb4b4b4);
  ctx.hemi.intensity = night ? 0.16 : 0.65;
  ctx.sun.color.set(night ? 0xffe6c8 : 0xffffff);
  ctx.sun.intensity = night ? 0.2 : 1.05;
  emissiveSlots.forEach((slot) => {
    slot.material.emissiveIntensity = night ? slot.night : slot.day;
  });
  nightOnly.forEach((object) => {
    object.visible = night;
  });
  pointLights.forEach((light) => {
    light.intensity = night ? light.userData.nightIntensity : 0;
  });
  nightSpots.forEach((light) => {
    light.intensity = night ? light.userData.nightIntensity : 0;
  });
}
