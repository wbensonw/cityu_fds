import * as THREE from 'three';
import { getRoadCurves } from './roads.js';
import { addInstanced } from './instancing.js';
import { standardMaterial } from './cache.js';

const UP = new THREE.Vector3(0, 1, 0);
const CAR_COLORS = [0x2f5d8a, 0x3f8f6a, 0xc9a227, 0x4a5568, 0x6f8796, 0x2c4a6e, 0x3a6b4a, 0x5a6a3a];
const STYLES = ['sedan', 'hatch', 'coupe'];
const BODY_KEYS = ['chassis', 'hood', 'cabin', 'trunk', 'roof', 'doorL', 'doorR', 'bumperF', 'bumperR'];
const GLASS_KEYS = ['windshield', 'rearWindow'];

let nightCrowd = false;

export function setNightCrowd(night) {
  nightCrowd = night;
}

function part(key, along, side, y, sx, sy, sz) {
  return { key, along, side, y, sx, sy, sz };
}

function styleParts(style) {
  if (style === 'hatch') {
    return [
      part('chassis', 0, 0, 0.2, 0.78, 0.2, 1.42),
      part('hood', 0.52, 0, 0.34, 0.7, 0.12, 0.32),
      part('cabin', -0.02, 0, 0.5, 0.74, 0.32, 0.78),
      part('trunk', -0.46, 0, 0.48, 0.7, 0.26, 0.26),
      part('roof', -0.08, 0, 0.68, 0.66, 0.06, 0.62),
      part('windshield', 0.32, 0, 0.52, 0.58, 0.2, 0.05),
      part('rearWindow', -0.38, 0, 0.56, 0.54, 0.22, 0.05),
      part('doorL', -0.02, -0.39, 0.4, 0.04, 0.26, 0.42),
      part('doorR', -0.02, 0.39, 0.4, 0.04, 0.26, 0.42),
      part('bumperF', 0.72, 0, 0.16, 0.78, 0.12, 0.08),
      part('bumperR', -0.68, 0, 0.16, 0.78, 0.12, 0.08),
      part('headL', 0.74, -0.24, 0.3, 0.1, 0.08, 0.04),
      part('headR', 0.74, 0.24, 0.3, 0.1, 0.08, 0.04),
      part('tailL', -0.7, -0.24, 0.36, 0.1, 0.08, 0.04),
      part('tailR', -0.7, 0.24, 0.36, 0.1, 0.08, 0.04),
    ];
  }
  if (style === 'coupe') {
    return [
      part('chassis', 0.04, 0, 0.18, 0.8, 0.18, 1.62),
      part('hood', 0.38, 0, 0.32, 0.74, 0.12, 0.68),
      part('cabin', -0.28, 0, 0.44, 0.72, 0.24, 0.46),
      part('trunk', -0.64, 0, 0.3, 0.72, 0.14, 0.28),
      part('roof', -0.28, 0, 0.6, 0.64, 0.06, 0.32),
      part('windshield', -0.04, 0, 0.48, 0.58, 0.18, 0.05),
      part('rearWindow', -0.48, 0, 0.46, 0.5, 0.14, 0.05),
      part('doorL', -0.26, -0.4, 0.36, 0.04, 0.22, 0.36),
      part('doorR', -0.26, 0.4, 0.36, 0.04, 0.22, 0.36),
      part('bumperF', 0.84, 0, 0.15, 0.82, 0.1, 0.08),
      part('bumperR', -0.8, 0, 0.15, 0.8, 0.1, 0.08),
      part('headL', 0.86, -0.26, 0.28, 0.1, 0.07, 0.04),
      part('headR', 0.86, 0.26, 0.28, 0.1, 0.07, 0.04),
      part('tailL', -0.82, -0.26, 0.28, 0.1, 0.06, 0.04),
      part('tailR', -0.82, 0.26, 0.28, 0.1, 0.06, 0.04),
    ];
  }
  return [
    part('chassis', 0, 0, 0.2, 0.78, 0.2, 1.5),
    part('hood', 0.48, 0, 0.36, 0.72, 0.14, 0.52),
    part('cabin', -0.02, 0, 0.48, 0.74, 0.28, 0.62),
    part('trunk', -0.58, 0, 0.34, 0.72, 0.16, 0.38),
    part('roof', -0.02, 0, 0.66, 0.66, 0.07, 0.48),
    part('windshield', 0.28, 0, 0.52, 0.6, 0.2, 0.05),
    part('rearWindow', -0.32, 0, 0.52, 0.56, 0.16, 0.05),
    part('doorL', -0.02, -0.39, 0.4, 0.04, 0.26, 0.4),
    part('doorR', -0.02, 0.39, 0.4, 0.04, 0.26, 0.4),
    part('bumperF', 0.78, 0, 0.16, 0.8, 0.12, 0.08),
    part('bumperR', -0.78, 0, 0.16, 0.8, 0.12, 0.08),
    part('headL', 0.8, -0.26, 0.3, 0.1, 0.08, 0.04),
    part('headR', 0.8, 0.26, 0.3, 0.1, 0.08, 0.04),
    part('tailL', -0.8, -0.26, 0.3, 0.1, 0.07, 0.04),
    part('tailR', -0.8, 0.26, 0.3, 0.1, 0.07, 0.04),
  ];
}

function wheelSpots(style) {
  const along = style === 'coupe' ? 0.55 : 0.48;
  const side = 0.42;
  return [[along, side], [along, -side], [-along, side], [-along, -side]];
}

function pose(vehicle, time) {
  const u = (vehicle.u + time * vehicle.speed) % 1;
  const point = vehicle.curve.getPointAt(u);
  const forward = vehicle.curve.getTangentAt(u);
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1);
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(UP, forward);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  return { point, forward, right, up };
}

export function createVehicles(root) {
  const curves = getRoadCurves();
  const cars = [];
  const buses = [];
  for (let index = 0; index < 9; index += 1) {
    if (index === 8) {
      buses.push({ curve: curves.west, u: index / 9, speed: 0.03 });
    } else {
      cars.push({
        curve: curves.west,
        u: index / 9,
        speed: 0.03,
        style: STYLES[index % 3],
        color: CAR_COLORS[index % CAR_COLORS.length],
      });
    }
  }
  for (let index = 0; index < 8; index += 1) {
    cars.push({
      curve: curves.east,
      u: index / 8,
      speed: 0.035,
      style: STYLES[index % 3],
      color: CAR_COLORS[(index + 3) % CAR_COLORS.length],
    });
  }

  const blank = (count, color) => Array.from({ length: count }, () => ({ color }));
  const white = standardMaterial(0xffffff);
  const glass = standardMaterial(0x6f8796, { transparent: true, opacity: 0.72, roughness: 0.2 });
  const headLamp = standardMaterial(0xfff0c8, { emissive: 0xfff0c8, emissiveIntensity: 1.1 });
  const tailLamp = standardMaterial(0xe25a4a, { emissive: 0xe25a4a, emissiveIntensity: 1 });
  const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.1, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const carMeshes = {};
  BODY_KEYS.forEach((key) => {
    carMeshes[key] = addInstanced(root, `car${key}`, box, white, blank(cars.length, 0xffffff));
  });
  GLASS_KEYS.forEach((key) => {
    carMeshes[key] = addInstanced(root, `car${key}`, box, glass, blank(cars.length, 0x6f8796));
  });
  carMeshes.headL = addInstanced(root, 'carHeadL', box, headLamp, blank(cars.length, 0xfff0c8));
  carMeshes.headR = addInstanced(root, 'carHeadR', box, headLamp, blank(cars.length, 0xfff0c8));
  carMeshes.tailL = addInstanced(root, 'carTailL', box, tailLamp, blank(cars.length, 0xe25a4a));
  carMeshes.tailR = addInstanced(root, 'carTailR', box, tailLamp, blank(cars.length, 0xe25a4a));
  carMeshes.wheels = addInstanced(root, 'carWheels', wheelGeo, white, blank(cars.length * 4, 0x2a2a2a));
  BODY_KEYS.forEach((key) => {
    const mesh = carMeshes[key];
    cars.forEach((car, index) => {
      mesh.setColorAt(index, new THREE.Color(key === 'roof' ? 0xe7e2d8 : car.color));
    });
    mesh.instanceColor.needsUpdate = true;
  });

  const busWhite = standardMaterial(0xf4f1ea);
  const busOrange = standardMaterial(0xe85a1a);
  const busBelt = standardMaterial(0x4a2a24);
  const busBlack = standardMaterial(0x1a1a1a);
  const busSign = standardMaterial(0xffb020, { emissive: 0xff9a1a, emissiveIntensity: 1.4 });
  const busPart = (name, material, color) => addInstanced(root, name, box, material, [{ color }]);
  const busParts = {
    shell: busPart('busShell', busWhite, 0xf4f1ea),
    skirt: busPart('busSkirt', busOrange, 0xe85a1a),
    belt: busPart('busBelt', busBelt, 0x4a2a24),
    roof: busPart('busRoof', busWhite, 0xe7e2d8),
    windshield: busPart('busWindshield', glass, 0x8aa4b4),
    sign: busPart('busSign', busSign, 0xffb020),
    bumperF: busPart('busBumperF', busOrange, 0xe85a1a),
    headL: busPart('busHeadL', headLamp, 0xfff0c8),
    headR: busPart('busHeadR', headLamp, 0xfff0c8),
    nose: busPart('busNose', busBlack, 0x1a1a1a),
    mirrorL: busPart('busMirrorL', busBlack, 0x222222),
    mirrorR: busPart('busMirrorR', busBlack, 0x222222),
    glassL: busPart('busGlassL', glass, 0x8aa4b4),
    glassR: busPart('busGlassR', glass, 0x8aa4b4),
    door: busPart('busDoor', busWhite, 0xf7f4ee),
    doorGlass: busPart('busDoorGlass', glass, 0x8aa4b4),
    tail: busPart('busTail', busWhite, 0xf4f1ea),
    tailL: busPart('busTailL', tailLamp, 0xe25a4a),
    tailR: busPart('busTailR', tailLamp, 0xe25a4a),
    bumperR: busPart('busBumperR', busOrange, 0xe85a1a),
    wheels: addInstanced(root, 'busWheels', wheelGeo, white, blank(4, 0x2a2a2a)),
  };

  const meshes = [...Object.values(carMeshes), ...Object.values(busParts)];
  meshes.forEach((mesh) => {
    if (mesh) mesh.frustumCulled = false;
  });

  const redMat = new THREE.MeshBasicMaterial({ color: 0xff4a3a });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8 });
  const redItems = [];
  const whiteItems = [];
  for (let i = 0; i < 10; i += 1) {
    redItems.push({ phase: i / 10 });
    whiteItems.push({ phase: (i + 0.5) / 10 });
  }
  const reds = addInstanced(root, 'trafficRed', new THREE.SphereGeometry(0.18, 6, 5), redMat, redItems.map(() => ({ x: 52, y: 1.4, z: 0 })));
  const whites = addInstanced(root, 'trafficWhite', new THREE.SphereGeometry(0.18, 6, 5), whiteMat, whiteItems.map(() => ({ x: 52, y: 1.4, z: 0 })));
  const redPhases = redItems.map((item) => item.phase);
  const whitePhases = whiteItems.map((item) => item.phase);
  const dummy = new THREE.Object3D();

  function setBasis(mesh, index, position, right, up, forward, sx, sy, sz) {
    dummy.position.copy(position);
    dummy.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward));
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }

  function placePart(mesh, index, point, forward, right, up, spec, scale) {
    const position = point.clone()
      .addScaledVector(forward, spec.along)
      .addScaledVector(right, spec.side)
      .addScaledVector(up, spec.y);
    setBasis(mesh, index, position, right, up, forward, spec.sx * scale, spec.sy * scale, spec.sz * scale);
  }

  function layout(time) {
    cars.forEach((car, index) => {
      const scale = nightCrowd && index % 2 === 1 ? 0 : 1;
      const { point, forward, right, up } = pose(car, time);
      styleParts(car.style).forEach((spec) => {
        placePart(carMeshes[spec.key], index, point, forward, right, up, spec, scale);
      });
      wheelSpots(car.style).forEach(([along, side], wheel) => {
        const position = point.clone()
          .addScaledVector(forward, along)
          .addScaledVector(right, side)
          .addScaledVector(up, 0.14);
        setBasis(carMeshes.wheels, index * 4 + wheel, position, right, up, forward, scale, scale, scale);
      });
    });
    const busScale = nightCrowd ? 0 : 1;
    buses.forEach((bus) => {
      const { point, forward, right, up } = pose(bus, time);
      const length = 4.2;
      const width = 1.15;
      const piece = (key, along, side, y, sx, sy, sz) => {
        const position = point.clone()
          .addScaledVector(forward, along)
          .addScaledVector(right, side)
          .addScaledVector(up, y);
        setBasis(busParts[key], 0, position, right, up, forward, sx * busScale, sy * busScale, sz * busScale);
      };
      piece('shell', -0.05, 0, 0.86, width * 0.96, 0.62, length * 0.78);
      piece('skirt', 0, 0, 0.32, width, 0.36, length * 0.9);
      piece('belt', 0, 0, 0.52, width * 1.02, 0.08, length * 0.88);
      piece('roof', -0.08, 0, 1.2, width * 0.9, 0.1, length * 0.74);
      piece('windshield', length * 0.4, 0, 0.88, width * 0.78, 0.46, 0.06);
      piece('sign', length * 0.42, 0, 1.16, width * 0.62, 0.14, 0.05);
      piece('bumperF', length * 0.46, 0, 0.18, width * 0.96, 0.2, 0.1);
      piece('headL', length * 0.47, width * 0.3, 0.3, 0.16, 0.1, 0.05);
      piece('headR', length * 0.47, -width * 0.3, 0.3, 0.16, 0.1, 0.05);
      piece('nose', length * 0.45, 0, 0.42, width * 0.46, 0.2, 0.04);
      piece('mirrorL', length * 0.36, width * 0.58, 0.98, 0.08, 0.16, 0.1);
      piece('mirrorR', length * 0.36, -width * 0.58, 0.98, 0.08, 0.16, 0.1);
      piece('glassL', -0.1, width * 0.5, 0.86, 0.04, 0.32, length * 0.42);
      piece('glassR', -0.1, -width * 0.5, 0.86, 0.04, 0.32, length * 0.42);
      piece('door', 0.55, width * 0.51, 0.58, 0.04, 0.78, 0.55);
      piece('doorGlass', 0.55, width * 0.53, 0.72, 0.03, 0.36, 0.38);
      piece('tail', -length * 0.45, 0, 0.72, width * 0.9, 0.7, 0.08);
      piece('tailL', -length * 0.47, width * 0.34, 0.42, 0.16, 0.1, 0.05);
      piece('tailR', -length * 0.47, -width * 0.34, 0.42, 0.16, 0.1, 0.05);
      piece('bumperR', -length * 0.48, 0, 0.18, width * 0.94, 0.18, 0.08);
      [[length * 0.28, width * 0.5], [length * 0.28, -width * 0.5], [-length * 0.3, width * 0.5], [-length * 0.3, -width * 0.5]]
        .forEach(([along, side], wheel) => {
          const position = point.clone()
            .addScaledVector(forward, along)
            .addScaledVector(right, side)
            .addScaledVector(up, 0.16);
          setBasis(busParts.wheels, wheel, position, right, up, forward, 1.15 * busScale, 1.15 * busScale, 1.15 * busScale);
        });
    });
    meshes.forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
  }

  function moveDots(mesh, phases, time) {
    phases.forEach((phase, index) => {
      const angle = (phase + time * 0.12) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 52, 1.5, Math.sin(angle) * 58);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  function update(time) {
    layout(time);
    moveDots(reds, redPhases, time);
    moveDots(whites, whitePhases, time + 0.4);
  }

  update(0);
  return { update };
}
