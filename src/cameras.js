import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const AZIMUTH = THREE.MathUtils.degToRad(20);
const ELEVATION = THREE.MathUtils.degToRad(30);
const FALLBACK_TARGET = new THREE.Vector3(0, 12, 6);
const FALLBACK_DIST = 220;

function viewOffset(distance) {
  const horizontal = Math.cos(ELEVATION) * distance;
  return new THREE.Vector3(
    Math.sin(AZIMUTH) * horizontal,
    Math.sin(ELEVATION) * distance,
    Math.cos(AZIMUTH) * horizontal,
  );
}

function chromeMargins() {
  const header = document.querySelector('.brand')?.getBoundingClientRect().height ?? 96;
  const hintTop = document.getElementById('hint')?.getBoundingClientRect().top;
  const creditTop = document.getElementById('credit')?.getBoundingClientRect().top;
  const blockers = [hintTop, creditTop].filter((value) => Number.isFinite(value));
  const footer = blockers.length ? window.innerHeight - Math.min(...blockers) : 64;
  return {
    top: header + 36,
    bottom: footer + 12,
  };
}

export function createCameraRig(renderer, subject) {
  const camera = new THREE.PerspectiveCamera(22, 1, 0.5, 900);
  const controls = new OrbitControls(camera, renderer.domElement);
  const focusNames = ['buildingA', 'buildingN'];
  Object.assign(controls, {
    enableDamping: true,
    dampingFactor: 0.08,
    enablePan: true,
    screenSpacePanning: false,
    panSpeed: 0.8,
    minDistance: 36,
    maxDistance: 520,
    minPolarAngle: 0.2,
    maxPolarAngle: 1.22,
    rotateSpeed: 0.6,
  });
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function focusPieces() {
    const boxes = focusNames
      .map((name) => subject.getObjectByName(name))
      .filter(Boolean)
      .map((object) => new THREE.Box3().setFromObject(object));
    return boxes;
  }

  function cornersOf(boxes) {
    const corners = [];
    for (const box of boxes) {
      const { min, max } = box;
      for (const x of [min.x, max.x]) {
        for (const y of [min.y, max.y]) {
          for (const z of [min.z, max.z]) corners.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    return corners;
  }

  function usableNdc() {
    const margins = chromeMargins();
    const height = Math.max(1, window.innerHeight);
    return {
      top: 1 - (2 * margins.top) / height,
      bottom: -1 + (2 * margins.bottom) / height,
      left: -0.96,
      right: 0.96,
    };
  }

  function containsFocus(distance, target, corners, limits) {
    camera.position.copy(target).add(viewOffset(distance));
    camera.lookAt(target);
    camera.updateMatrixWorld();
    for (const corner of corners) {
      const projected = corner.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) return false;
      if (projected.x < limits.left || projected.x > limits.right) return false;
      if (projected.y < limits.bottom || projected.y > limits.top) return false;
    }
    return true;
  }

  function frameDistance() {
    resize();
    const boxes = focusPieces();
    if (!boxes.length) {
      return { target: FALLBACK_TARGET.clone(), distance: FALLBACK_DIST };
    }
    const target = new THREE.Vector3();
    for (const box of boxes) target.add(box.getCenter(new THREE.Vector3()));
    target.multiplyScalar(1 / boxes.length);
    const corners = cornersOf(boxes);
    const limits = usableNdc();
    let low = controls.minDistance;
    let high = controls.maxDistance;
    while (!containsFocus(high, target, corners, limits) && high < 1600) high *= 1.25;
    for (let step = 0; step < 18; step += 1) {
      const mid = (low + high) / 2;
      if (containsFocus(mid, target, corners, limits)) high = mid;
      else low = mid;
    }
    return { target, distance: high * 1.06 };
  }

  function resetView() {
    const { target, distance } = frameDistance();
    controls.maxDistance = Math.max(520, distance * 1.35);
    camera.position.copy(target).add(viewOffset(distance));
    controls.target.copy(target);
    controls._sphericalDelta.set(0, 0, 0);
    controls._panOffset.set(0, 0, 0);
    controls._scale = 1;
    controls.update();
  }

  function update() {
    controls.update();
  }

  resetView();

  window.addEventListener('keydown', (event) => {
    if (event.key === 'c' || event.key === 'C') resetView();
  });

  return { camera, controls, resize, update, resetView };
}
