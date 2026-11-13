import * as THREE from 'three';
import { createTerrain, roadY } from './terrain.js';
import { createRoads } from './roads.js';
import { createBuildings } from './buildings.js';
import { createStairs } from './stairs.js';
import { createCameraRig } from './cameras.js';
import { mat, standardMaterial } from './cache.js';
import { readSeed, createRng } from './rng.js';
import {
  applyTime,
  assertPointLightCap,
  assertWindowRatio,
  createKeyLights,
  readTime,
  resetWindowBudget,
} from './lighting.js';
import { createVegetation } from './vegetation.js';
import { createFurniture } from './furniture.js';
import { createPeople, setNightCrowd as setPeopleNight } from './people.js';
import { createVehicles, setNightCrowd as setVehiclesNight } from './vehicles.js';
import { createBirds } from './birds.js';

const ROOT_NAMES = [
  'terrainRoot',
  'roadsRoot',
  'buildingsRoot',
  'vegetationRoot',
  'propsRoot',
  'peopleRoot',
  'vehiclesRoot',
  'lightsRoot',
  'uiAnchorsRoot',
];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x2f6d82, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const campusRoot = new THREE.Group();
campusRoot.name = 'campusRoot';
scene.add(campusRoot);

const roots = {};
for (const name of ROOT_NAMES) {
  const group = new THREE.Group();
  group.name = name;
  campusRoot.add(group);
  roots[name] = group;
}

const material = standardMaterial(0xffffff);

const outside = new THREE.Mesh(
  new THREE.CircleGeometry(520, 72),
  standardMaterial(0x2f6d82, { roughness: 1 }),
);
outside.name = 'outsideGround';
outside.rotation.x = -Math.PI / 2;
outside.position.y = roadY(-2, 38.2) - 0.38;
outside.receiveShadow = true;
scene.add(outside);

const hemi = new THREE.HemisphereLight(0xffffff, 0xb4b4b4, 0.65);
hemi.name = 'hemi';
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.name = 'sun';
sun.position.set(36, 54, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 8;
sun.shadow.camera.far = 180;
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.05;
sun.shadow.camera.updateProjectionMatrix();
roots.lightsRoot.add(hemi, sun);

resetWindowBudget();
createTerrain(roots.terrainRoot, material);
createRoads(roots.roadsRoot, material);
createBuildings(roots.buildingsRoot, material);
createStairs(roots.buildingsRoot);
assertWindowRatio();
const rng = createRng(readSeed());
createVegetation(roots.vegetationRoot, rng);
createFurniture(roots.propsRoot);
const people = createPeople(roots.peopleRoot, rng);
const vehicles = createVehicles(roots.vehiclesRoot);
const birdsRoot = new THREE.Group();
birdsRoot.name = 'birdsRoot';
campusRoot.add(birdsRoot);
const birds = createBirds(birdsRoot);
createKeyLights(roots.lightsRoot);
assertPointLightCap(scene);

campusRoot.traverse((obj) => {
  if (!obj.isMesh) return;
  const surface = obj.material;
  const skip = surface?.transparent || surface?.depthWrite === false;
  obj.castShadow = !skip;
  obj.receiveShadow = !skip;
});

const timeMode = readTime();
setPeopleNight(timeMode === 'night');
setVehiclesNight(timeMode === 'night');
applyTime(timeMode, { renderer, scene, hemi, sun });

const rig = createCameraRig(renderer, roots.buildingsRoot);

const bar = document.getElementById('views');
const pickLabel = document.getElementById('pick');

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let highlighted = [];

function clearHighlight() {
  for (const item of highlighted) item.material = item.userData.baseMaterial;
  highlighted = [];
  pickLabel.textContent = '';
}

function highlightGroup(group) {
  clearHighlight();
  const highlight = mat.highlight();
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.userData.baseMaterial = obj.material;
    obj.material = highlight;
    highlighted.push(obj);
  });
  pickLabel.textContent = group.userData.label || group.name;
}

let pointerDown = null;

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerDown || pointerDown.id !== event.pointerId) return;
  const dx = event.clientX - pointerDown.x;
  const dy = event.clientY - pointerDown.y;
  pointerDown = null;
  if (dx * dx + dy * dy > 36) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, rig.camera);
  const hits = raycaster.intersectObjects(roots.buildingsRoot.children, true);
  let target = hits[0]?.object ?? null;
  while (target && !target.userData.pickable) target = target.parent;
  if (!target || target === scene) {
    clearHighlight();
    return;
  }
  highlightGroup(target);
});

function markTime(mode) {
  for (const button of bar.children) {
    if (!button.dataset.time) continue;
    button.classList.toggle('active', button.dataset.time === mode);
  }
}

for (const mode of ['day', 'night']) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.time = mode;
  button.textContent = mode === 'day' ? '日間' : '夜景';
  button.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('time', mode);
    history.replaceState(null, '', url);
    applyTime(mode, { renderer, scene, hemi, sun });
    const night = mode === 'night';
    setPeopleNight(night);
    setVehiclesNight(night);
    markTime(mode);
  });
  bar.appendChild(button);
}
markTime(timeMode);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize();
});

let campusRevealed = false;

function revealCampus() {
  if (campusRevealed) return;
  campusRevealed = true;
  requestAnimationFrame(() => {
    const loader = document.getElementById('loader');
    if (!loader) return;
    loader.classList.add('done');
    const removeLoader = () => loader.remove();
    loader.addEventListener('transitionend', removeLoader, { once: true });
    window.setTimeout(removeLoader, 700);
  });
}

function tick(now) {
  const time = now * 0.001;
  people.update(time);
  vehicles.update(time);
  birds.update(time);
  rig.update();
  renderer.render(scene, rig.camera);
  revealCampus();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
