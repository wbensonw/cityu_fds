import * as THREE from 'three';
import { heightAt } from './terrain.js';

const GROUNDS = [
  { x: -18, z: 1 },
  { x: -15, z: 20 },
  { x: 12.5, z: 22 },
];
const OFFSETS = [
  { x: -0.28, z: 0.16 },
  { x: 0.3, z: -0.14 },
  { x: 0.04, z: 0.32 },
];
const DWELL = 9;
const CLIMB = 3;
const CRUISE_TIME = 3;
const DESCEND = 3;
const FLIGHT = CLIMB + CRUISE_TIME + DESCEND;
const CRUISE = 18;
const SEGMENT = DWELL + FLIGHT;

const brown = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.78 });
const belly = new THREE.MeshStandardMaterial({ color: 0xd8c4a4, roughness: 0.84 });
const dark = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 });
const beakMat = new THREE.MeshStandardMaterial({ color: 0xc47a2a, roughness: 0.5 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35 });

function part(name, geometry, material, x, y, z, parent) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function createSparrow(index) {
  const bird = new THREE.Group();
  bird.name = `sparrow${index}`;
  bird.rotation.order = 'YXZ';
  bird.scale.setScalar(1.2);

  part('body', new THREE.SphereGeometry(0.11, 10, 8), brown, 0, 0.16, 0, bird).scale.set(1.25, 0.82, 1);
  part('breast', new THREE.SphereGeometry(0.07, 8, 6), belly, 0, 0.13, 0.05, bird);
  part('head', new THREE.SphereGeometry(0.065, 8, 6), brown, 0, 0.23, 0.12, bird);
  const crown = part('crown', new THREE.SphereGeometry(0.04, 8, 6), dark, 0, 0.27, 0.1, bird);
  crown.scale.set(1, 0.55, 1.1);
  const beakUpper = part('beakUpper', new THREE.ConeGeometry(0.014, 0.07, 6), beakMat, 0, 0.225, 0.19, bird);
  beakUpper.rotation.x = Math.PI / 2;
  const beakLower = part('beakLower', new THREE.ConeGeometry(0.01, 0.05, 6), beakMat, 0, 0.205, 0.175, bird);
  beakLower.rotation.x = Math.PI / 2;
  part('eyeL', new THREE.SphereGeometry(0.014, 6, 5), eyeMat, -0.03, 0.24, 0.165, bird);
  part('eyeR', new THREE.SphereGeometry(0.014, 6, 5), eyeMat, 0.03, 0.24, 0.165, bird);

  const wingL = new THREE.Group();
  wingL.name = 'wingL';
  wingL.position.set(-0.08, 0.17, 0);
  bird.add(wingL);
  part('wingBoneL', new THREE.BoxGeometry(0.16, 0.025, 0.09), brown, -0.08, 0, 0, wingL);
  part('featherL', new THREE.BoxGeometry(0.12, 0.015, 0.07), dark, -0.2, 0, -0.02, wingL);

  const wingR = new THREE.Group();
  wingR.name = 'wingR';
  wingR.position.set(0.08, 0.17, 0);
  bird.add(wingR);
  part('wingBoneR', new THREE.BoxGeometry(0.16, 0.025, 0.09), brown, 0.08, 0, 0, wingR);
  part('featherR', new THREE.BoxGeometry(0.12, 0.015, 0.07), dark, 0.2, 0, -0.02, wingR);

  part('tail', new THREE.BoxGeometry(0.04, 0.012, 0.12), brown, 0, 0.15, -0.14, bird);
  part('tailL', new THREE.BoxGeometry(0.03, 0.01, 0.1), dark, -0.035, 0.15, -0.15, bird);
  part('tailR', new THREE.BoxGeometry(0.03, 0.01, 0.1), dark, 0.035, 0.15, -0.15, bird);
  part('legL', new THREE.CylinderGeometry(0.008, 0.008, 0.08, 5), dark, -0.03, 0.05, 0.02, bird);
  part('legR', new THREE.CylinderGeometry(0.008, 0.008, 0.08, 5), dark, 0.03, 0.05, 0.02, bird);
  part('footL', new THREE.BoxGeometry(0.04, 0.008, 0.05), dark, -0.03, 0.012, 0.04, bird);
  part('footR', new THREE.BoxGeometry(0.04, 0.008, 0.05), dark, 0.03, 0.012, 0.04, bird);

  return { bird, wingL, wingR, crown };
}

function groundPoint(index, spot) {
  const offset = OFFSETS[index];
  const x = spot.x + offset.x;
  const z = spot.z + offset.z;
  return new THREE.Vector3(x, heightAt(x, z), z);
}

export function createBirds(root) {
  const flock = [0, 1, 2].map((index) => {
    const sparrow = createSparrow(index);
    root.add(sparrow.bird);
    return sparrow;
  });
  const spots = GROUNDS.map((ground) => new THREE.Vector3(ground.x, 0, ground.z));

  function update(time) {
    const cycle = ((time % (SEGMENT * 3)) + SEGMENT * 3) % (SEGMENT * 3);
    const leg = Math.floor(cycle / SEGMENT);
    const local = cycle - leg * SEGMENT;
    const flying = local >= DWELL;
    const flightTime = flying ? local - DWELL : 0;
    const fromSpot = spots[leg];
    const toSpot = spots[(leg + 1) % spots.length];

    flock.forEach((sparrow, index) => {
      const start = groundPoint(index, fromSpot);
      const end = groundPoint(index, toSpot);
      let along = 0;
      let lift = 0;
      if (flying) {
        if (flightTime < CLIMB) {
          const pace = flightTime / CLIMB;
          const eased = pace * pace * (3 - 2 * pace);
          along = 0.08 * eased;
          lift = eased;
        } else if (flightTime < CLIMB + CRUISE_TIME) {
          const pace = (flightTime - CLIMB) / CRUISE_TIME;
          const eased = pace * pace * (3 - 2 * pace);
          along = 0.08 + 0.84 * eased;
          lift = 1;
        } else {
          const pace = (flightTime - CLIMB - CRUISE_TIME) / DESCEND;
          const eased = pace * pace * (3 - 2 * pace);
          along = 0.92 + 0.08 * eased;
          lift = 1 - eased;
        }
      }
      const position = start.clone().lerp(end, along);
      if (flying) {
        const cruise = Math.max(start.y, end.y) + CRUISE;
        const ground = THREE.MathUtils.lerp(start.y, end.y, along);
        position.y = THREE.MathUtils.lerp(ground, cruise, lift);
      }
      const heading = end.clone().sub(start);
      const yaw = Math.atan2(heading.x, heading.z);
      const flap = Math.sin(time * 22 + index * 0.6);
      sparrow.bird.position.copy(position);
      sparrow.bird.rotation.y = yaw;
      sparrow.bird.rotation.x = flying ? (flightTime < CLIMB ? -0.4 : flightTime > CLIMB + CRUISE_TIME ? 0.32 : -0.06) : 0;
      sparrow.wingL.rotation.z = flying ? -0.35 - flap * 1.05 : -0.55;
      sparrow.wingR.rotation.z = flying ? 0.35 + flap * 1.05 : 0.55;
      sparrow.crown.rotation.x = flying ? 0 : Math.sin(time * 2.2 + index) * 0.18;
    });
  }

  update(0);
  return { update };
}
