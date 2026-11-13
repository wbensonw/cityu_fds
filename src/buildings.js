import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { createDetailedBuilding, createSkybridge } from './parts.js';
import { createBuildingA } from './buildingA.js';
import { createBuildingW } from './buildingW.js';
import { createBuildingL, createCourtCanopy } from './buildingL.js';
import { registerEmissive, registerNightLight } from './lighting.js';

const HILL_BUILDINGS = [
  {
    name: 'buildingC',
    title: '文化中心',
    x: -10,
    z: 7,
    width: 11,
    depth: 10,
    height: 6.8,
    rows: 5,
    cols: 8,
    floorHeight: 1.15,
    faces: ['+z', '-z'],
    glassLobby: true,
    sign: ['文化中心', 'Cultural Centre'],
  },
  {
    name: 'buildingT',
    title: '大豐樓',
    x: -1,
    z: -5,
    width: 15,
    depth: 11,
    height: 7.4,
    rows: 6,
    cols: 8,
    floorHeight: 1.05,
    faces: ['+z', '-z'],
    courtyard: true,
    emblemBay: true,
    frontWall: true,
    emblemSize: 'large',
    sign: ['大豐樓', 'Tai Fung Building'],
  },
  {
    name: 'buildingH',
    title: '何賢會議中心',
    x: 8,
    z: 7,
    width: 13,
    depth: 9,
    height: 6.6,
    rows: 6,
    cols: 10,
    floorHeight: 1.05,
    faces: ['+z', '-z'],
    libraryGlass: true,
    sign: ['何賢會議中心', 'Ho Yin Convention Centre'],
  },
  {
    name: 'buildingS',
    title: '何鴻燊樓',
    x: 0.2,
    z: -20.2,
    width: 17.6,
    depth: 8,
    height: 7.4,
    rows: 6,
    cols: 8,
    floorHeight: 1.12,
    faces: ['+z', '-z'],
    sign: ['何鴻燊樓', 'Stanley Ho Building'],
  },
  {
    name: 'buildingN',
    title: '蔡繼有樓',
    x: 13.2,
    z: -16.4,
    width: 7,
    depth: 11,
    height: 13,
    rows: 8,
    cols: 7,
    floorHeight: 1.5,
    faces: ['+z', '-z'],
    sign: ['蔡繼有樓', 'Choi Kai Yau Building'],
  },
  {
    name: 'buildingB1',
    title: '第一座',
    x: 14,
    z: -4.2,
    width: 8,
    depth: 12,
    height: 14.5,
    rows: 10,
    cols: 5,
    floorHeight: 1.35,
    faces: ['+z', '-z'],
    sign: ['第一座', 'Block 1'],
  },
];

function groundY(x, z, depth, rotY = 0) {
  const frontX = x + Math.sin(rotY) * (depth / 2);
  const frontZ = z + Math.cos(rotY) * (depth / 2);
  return Math.min(heightAt(x, z), heightAt(frontX, frontZ));
}

function addBox(parent, material, spec) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), material);
  mesh.name = spec.name;
  const rotY = spec.rotY ?? 0;
  const base = groundY(spec.x, spec.z, spec.d, rotY);
  mesh.position.set(spec.x, base + spec.h / 2, spec.z);
  mesh.rotation.y = rotY;
  parent.add(mesh);
}

export function createBuildings(buildingsRoot, material) {
  const detailed = [
    createBuildingA(),
    createBuildingW(),
    createBuildingL(),
    ...HILL_BUILDINGS.map((spec) => createDetailedBuilding({
      rotY: 0,
      emblemSize: 'small',
      curtain: 'small',
      ...spec,
    })),
  ];
  for (const building of detailed) {
    const count = building.userData.windowCount;
    const limit = building.name === 'buildingA' ? 220 : 200;
    if (count < 60 || count > limit) {
      throw new Error(`${building.name} 窗格數 ${count} 超出 60–200`);
    }
    buildingsRoot.add(building);
  }
  const { canopy, colonnade } = createCourtCanopy();
  buildingsRoot.add(canopy, colonnade);
  buildingsRoot.add(createSkybridge());
  const faculty = buildingsRoot.getObjectByName('buildingN');
  if (faculty) faculty.add(createFacultyFlag());
}

function facultyFlagMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 448;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1E8F9B';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 82px "Microsoft JhengHei", "PingFang TC", sans-serif';
  ctx.fillText('數據科學學院', 384, 180);
  ctx.font = '44px "Segoe UI", "Microsoft JhengHei", sans-serif';
  ctx.fillText('Faculty of Data Science', 384, 278);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

function createFacultyFlag() {
  const group = new THREE.Group();
  group.name = 'facultyFlag';
  const roofY = 13.08;
  const poleX = -2.55;
  const poleZ = 4.2;
  const poleH = 5.75;
  const clothW = 5.83;
  const clothH = 3.4;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x102033, roughness: 0.55 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, poleH, 8), poleMat);
  pole.name = 'facultyPole';
  pole.position.set(poleX, roofY + poleH / 2, poleZ);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), poleMat);
  finial.position.set(poleX, roofY + poleH + 0.04, poleZ);
  const clothGeo = new THREE.PlaneGeometry(clothW, clothH, 10, 2);
  const positions = clothGeo.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const along = (x + clothW / 2) / clothW;
    const belly = Math.sin(along * Math.PI) * 0.4;
    const sag = (1 - y / (clothH / 2)) * 0.07 * along;
    positions.setZ(index, belly + sag);
  }
  clothGeo.computeVertexNormals();
  const cloth = new THREE.Mesh(clothGeo, facultyFlagMaterial());
  cloth.name = 'facultyCloth';
  const clothX = poleX + clothW / 2;
  const clothY = roofY + poleH - clothH / 2 - 0.08;
  cloth.position.set(clothX, clothY, poleZ);
  group.add(pole, finial, cloth);
  [-1.4, 1.5].forEach((side, index) => {
    const spot = new THREE.SpotLight(0xfff6e8, 0, 18, 0.85, 0.7, 1);
    spot.name = `facultySpot${index}`;
    spot.castShadow = false;
    spot.position.set(clothX + side, roofY + 0.55, poleZ + 1.05);
    spot.target.position.set(clothX + side * 0.35, clothY, poleZ);
    group.add(spot, spot.target);
    registerNightLight(spot, 13.8);
    const housing = new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.45, metalness: 0.4 });
    const stand = new THREE.Group();
    stand.name = `facultyFixture${index}`;
    stand.position.set(spot.position.x, roofY, spot.position.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.85, 8), housing);
    base.name = 'spotBase';
    base.position.y = 0.42;
    const yoke = new THREE.Group();
    yoke.position.y = 0.9;
    stand.add(base, yoke);
    group.add(stand);
    yoke.lookAt(clothX + side * 0.35, clothY, poleZ);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.42, 12), housing);
    head.name = 'spotHead';
    head.rotation.x = Math.PI / 2;
    head.position.z = -0.16;
    const lensMat = registerEmissive(new THREE.MeshStandardMaterial({
      color: 0xfff6e8,
      emissive: 0xfff6e8,
      emissiveIntensity: 0,
      roughness: 0.35,
    }), 0.08, 2.2);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.18, 14), lensMat);
    lens.name = 'spotLens';
    lens.position.z = -0.38;
    lens.rotation.y = Math.PI;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16), lensMat);
    rim.name = 'spotRim';
    rim.position.z = -0.34;
    yoke.add(head, lens, rim);
  });
  return group;
}
