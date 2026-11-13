import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { getRoadCurves } from './roads.js';
import { addInstanced } from './instancing.js';
import { standardMaterial } from './cache.js';

const UP = new THREE.Vector3(0, 1, 0);
const SCALE = 1.45;
const PALETTES = [
  { shirt: 0x2f5d8a, pants: 0x2c3340, hair: 0x2a2118, shoe: 0x222222 },
  { shirt: 0xf4f1ea, pants: 0x3a4554, hair: 0x4a3428, shoe: 0x1a1a1a },
  { shirt: 0xc4524a, pants: 0x243044, hair: 0x1c1c1c, shoe: 0x333333 },
  { shirt: 0x3f8f6a, pants: 0x2a2a2a, hair: 0x6b4a32, shoe: 0x222222 },
  { shirt: 0xf0c84a, pants: 0x2f3d56, hair: 0x3a2a22, shoe: 0x111111 },
  { shirt: 0x6f8796, pants: 0x3a3a3a, hair: 0x111111, shoe: 0x2a2a2a },
  { shirt: 0xd7c4a3, pants: 0x1f3a5f, hair: 0x8a6244, shoe: 0x222222 },
  { shirt: 0x8f4f6a, pants: 0x2c2c2c, hair: 0x2a2118, shoe: 0x1a1a1a },
];
const POSE = [
  { armL: 0, armR: 0, legL: 0, legR: 0 },
  { armL: -0.7, armR: 0.2, legL: 0.4, legR: -0.3 },
  { armL: 0.2, armR: -0.7, legL: -0.3, legR: 0.4 },
  { armL: -0.3, armR: -0.3, legL: 0.18, legR: 0.18 },
];
const SKIN = 0xf0c9a0;

let nightCrowd = false;

export function setNightCrowd(night) {
  nightCrowd = night;
}

function loopAt(x, z, radius) {
  const points = [];
  for (let step = 0; step < 4; step += 1) {
    const angle = (step / 4) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const pz = z + Math.sin(angle) * radius;
    points.push(new THREE.Vector3(px, heightAt(px, pz), pz));
  }
  points.push(points[0].clone());
  return points;
}

function stairPath(x) {
  const points = [];
  for (let step = 0; step < 4; step += 1) {
    const z = 13.2 - step * 3.2;
    points.push(new THREE.Vector3(x, heightAt(x, z) + 0.2, z));
  }
  points.push(points[0].clone());
  return points;
}

function sidewalkPoint(curve, u) {
  const point = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u);
  tangent.y = 0;
  tangent.normalize();
  const right = new THREE.Vector3().crossVectors(UP, tangent).normalize();
  point.addScaledVector(right, -1.96);
  point.y += 0.08;
  return point;
}

function eastSidewalk(forward) {
  const curve = getRoadCurves().east;
  const steps = 8;
  const samples = [
    new THREE.Vector3(-2, heightAt(-2, 33) + 0.02, 33),
    new THREE.Vector3(0.4, heightAt(0.4, 36.4) + 0.02, 36.4),
  ];
  for (let step = 0; step <= steps; step += 1) {
    const u = 0.03 + (step / steps) * 0.92;
    samples.push(sidewalkPoint(curve, u));
  }
  const points = forward ? samples : samples.slice().reverse();
  const outbound = points.slice();
  for (let index = outbound.length - 2; index >= 0; index -= 1) points.push(outbound[index].clone());
  return points;
}

function entrancePath(door, slot) {
  return loopAt(door.x + (slot % 3) * 0.6, door.z + (slot % 2) * 0.5, 0.7);
}

function pathFor(index) {
  if (index < 45) return eastSidewalk(index % 2 === 0);
  if (index < 67) return stairPath(-2.4 + (index - 45) * 0.12);
  const doors = [
    { x: -2, z: 34 },
    { x: -10, z: 13.4 },
    { x: -3, z: -12.2 },
  ];
  return entrancePath(doors[index % doors.length], index);
}

export function createPeople(root, rng) {
  const people = [];
  const counts = { briefcase: 0, book: 0, glasses: 0, backpack: 0, phone: 0, bottle: 0 };
  for (let index = 0; index < 112; index += 1) {
    const role = index % 7 === 0 ? 'professor' : 'student';
    const accessory = role === 'professor'
      ? ['briefcase', 'book', 'glasses'][Math.floor(rng() * 3)]
      : ['backpack', 'phone', 'bottle'][Math.floor(rng() * 3)];
    counts[accessory] += 1;
    people.push({
      role,
      accessory,
      accSlot: counts[accessory] - 1,
      pose: Math.floor(rng() * 4),
      palette: PALETTES[Math.floor(rng() * PALETTES.length)],
      phase: rng(),
      speed: index < 45 ? 0.006 + rng() * 0.004 : 0.05 + rng() * 0.06,
      points: pathFor(index),
    });
  }

  const white = standardMaterial(0xffffff);
  const skin = standardMaterial(SKIN);
  const heads = people.map((person) => ({ color: SKIN, palette: person.palette }));
  const torsos = people.map((person) => ({ color: person.palette.shirt }));
  const arms = people.map((person) => ({ color: person.palette.shirt }));
  const legs = people.map((person) => ({ color: person.palette.pants }));
  const shoes = [];
  people.forEach((person) => {
    shoes.push({ color: person.palette.shoe }, { color: person.palette.shoe });
  });
  const hairItems = people.filter((person) => person.role === 'student').map((person) => ({ color: person.palette.hair }));
  const hatItems = people.filter((person) => person.role === 'professor').map((person) => ({ color: person.palette.hair }));
  let studentSlot = 0;
  let professorSlot = 0;
  people.forEach((person) => {
    if (person.role === 'student') {
      person.hairSlot = studentSlot;
      studentSlot += 1;
    } else {
      person.hatSlot = professorSlot;
      professorSlot += 1;
    }
  });

  const meshes = {
    head: addInstanced(root, 'heads', new THREE.SphereGeometry(0.11, 8, 6), skin, heads),
    torso: addInstanced(root, 'torsos', new THREE.BoxGeometry(0.28, 0.36, 0.14), white, torsos),
    armL: addInstanced(root, 'armL', new THREE.BoxGeometry(0.07, 0.3, 0.07), white, arms),
    armR: addInstanced(root, 'armR', new THREE.BoxGeometry(0.07, 0.3, 0.07), white, arms),
    legL: addInstanced(root, 'legL', new THREE.BoxGeometry(0.09, 0.32, 0.09), white, legs),
    legR: addInstanced(root, 'legR', new THREE.BoxGeometry(0.09, 0.32, 0.09), white, legs),
    shoes: addInstanced(root, 'shoes', new THREE.BoxGeometry(0.11, 0.05, 0.16), white, shoes),
    hair: addInstanced(root, 'hair', new THREE.SphereGeometry(0.12, 8, 6), white, hairItems),
    hat: addInstanced(root, 'hats', new THREE.CylinderGeometry(0.13, 0.13, 0.08, 8), white, hatItems),
    briefcase: addInstanced(root, 'briefcases', new THREE.BoxGeometry(0.12, 0.1, 0.05), white, people.filter((p) => p.accessory === 'briefcase').map(() => ({ color: 0x6b4a32 }))),
    book: addInstanced(root, 'books', new THREE.BoxGeometry(0.1, 0.03, 0.14), white, people.filter((p) => p.accessory === 'book').map(() => ({ color: 0x2f5d8a }))),
    glasses: addInstanced(root, 'glasses', new THREE.BoxGeometry(0.12, 0.03, 0.02), white, people.filter((p) => p.accessory === 'glasses').map(() => ({ color: 0x222222 }))),
    backpack: addInstanced(root, 'backpacks', new THREE.BoxGeometry(0.16, 0.2, 0.08), white, people.filter((p) => p.accessory === 'backpack').map((p) => ({ color: p.palette.shirt }))),
    phone: addInstanced(root, 'phones', new THREE.BoxGeometry(0.04, 0.07, 0.015), white, people.filter((p) => p.accessory === 'phone').map(() => ({ color: 0x222222 }))),
    bottle: addInstanced(root, 'bottles', new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), white, people.filter((p) => p.accessory === 'bottle').map(() => ({ color: 0x6f8796 }))),
  };

  const position = new THREE.Vector3();
  const next = new THREE.Vector3();
  const yawQuat = new THREE.Quaternion();
  const poseQuat = new THREE.Quaternion();
  const world = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const offset = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);

  function writePart(mesh, index, personPos, yaw, partOffset, rotX, visible) {
    if (!mesh || index < 0) return;
    const scale = visible ? one : zero;
    offset.copy(partOffset).multiplyScalar(SCALE);
    poseQuat.setFromEuler(new THREE.Euler(rotX, 0, 0));
    local.compose(offset, poseQuat, scale);
    yawQuat.setFromAxisAngle(UP, yaw);
    world.compose(personPos, yawQuat, scale).multiply(local);
    mesh.setMatrixAt(index, world);
  }

  function update(time) {
    people.forEach((person, index) => {
      const visible = !(nightCrowd && index % 2 === 1);
      const span = person.points.length - 1;
      const scaled = ((time * person.speed + person.phase) % 1) * span;
      const seg = Math.min(span - 1, Math.floor(scaled));
      const localT = scaled - seg;
      const smooth = localT * localT * (3 - 2 * localT);
      position.lerpVectors(person.points[seg], person.points[seg + 1], smooth);
      next.copy(person.points[Math.min(span, seg + 1)]).sub(person.points[seg]);
      const yaw = Math.atan2(next.x, next.z);
      const pose = POSE[person.pose];
      writePart(meshes.head, index, position, yaw, new THREE.Vector3(0, 0.82, 0), 0, visible);
      writePart(meshes.torso, index, position, yaw, new THREE.Vector3(0, 0.52, 0), 0, visible);
      writePart(meshes.armL, index, position, yaw, new THREE.Vector3(-0.2, 0.58, 0), pose.armL, visible);
      writePart(meshes.armR, index, position, yaw, new THREE.Vector3(0.2, 0.58, 0), pose.armR, visible);
      writePart(meshes.legL, index, position, yaw, new THREE.Vector3(-0.07, 0.24, 0), pose.legL, visible);
      writePart(meshes.legR, index, position, yaw, new THREE.Vector3(0.07, 0.24, 0), pose.legR, visible);
      writePart(meshes.shoes, index * 2, position, yaw, new THREE.Vector3(-0.07, 0.04, 0.02), 0, visible);
      writePart(meshes.shoes, index * 2 + 1, position, yaw, new THREE.Vector3(0.07, 0.04, 0.02), 0, visible);
      if (person.role === 'student') {
        writePart(meshes.hair, person.hairSlot, position, yaw, new THREE.Vector3(0, 0.93, 0), 0, visible);
      } else {
        writePart(meshes.hat, person.hatSlot, position, yaw, new THREE.Vector3(0, 0.98, 0), 0, visible);
      }
      const accOffset = {
        briefcase: new THREE.Vector3(0.22, 0.36, 0.08),
        book: new THREE.Vector3(0.16, 0.5, 0.12),
        glasses: new THREE.Vector3(0, 0.82, 0.11),
        backpack: new THREE.Vector3(0, 0.55, -0.12),
        phone: new THREE.Vector3(0.18, 0.46, 0.1),
        bottle: new THREE.Vector3(-0.18, 0.4, 0.06),
      }[person.accessory];
      writePart(meshes[person.accessory], person.accSlot, position, yaw, accOffset, 0, visible);
    });
    Object.values(meshes).forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
  }

  update(0);
  return { update };
}
