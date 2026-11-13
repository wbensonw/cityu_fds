import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { heightAt } from './terrain.js';
import { boxGeometry, getGeometry, mat, signMaterial, standardMaterial } from './cache.js';
import { nextWindowGlow, registerNightOnly, windowGlowMaterial, windowHaloMaterial } from './lighting.js';
import logoUrl from './assets/logo.png';

function roundedGeometry(width, height, depth, radius) {
  const key = `round:${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}:${radius.toFixed(3)}`;
  return getGeometry(key, () => new RoundedBoxGeometry(width, height, depth, 2, radius));
}

function mesh(geometry, materialName, name) {
  const item = new THREE.Mesh(geometry, mat[materialName]());
  item.name = name;
  return item;
}

export function groundY(x, z, depth, rotY) {
  const frontX = x + Math.sin(rotY) * (depth / 2);
  const frontZ = z + Math.cos(rotY) * (depth / 2);
  return Math.min(heightAt(x, z), heightAt(frontX, frontZ));
}

function landmarkArc(spec) {
  const outer = spec.width * 0.46;
  const span = Math.PI * 0.78;
  const cz = spec.depth * 0.04;
  return { outer, inner: outer - 0.48, span, cz, frontZ: cz + outer };
}

function landmarkDeck(spec) {
  return {
    width: spec.width * 0.7,
    depth: spec.depth * 0.55,
    z: -spec.depth * 0.08,
    lip: 0.16,
  };
}

function arcWallGeometry(outer, inner, span, height) {
  const key = `arc:${outer.toFixed(2)}:${inner.toFixed(2)}:${span.toFixed(2)}:${height.toFixed(2)}`;
  return getGeometry(key, () => {
    const start = Math.PI / 2 - span / 2;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, start, start + span, false);
    shape.absarc(0, 0, inner, start + span, start, true);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 20 });
    geometry.translate(0, 0, -height / 2);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  });
}

function addCurvedFront(group, spec) {
  const arc = landmarkArc(spec);
  const wallH = spec.height - 2.15;
  const wall = mesh(arcWallGeometry(arc.outer, arc.inner, arc.span, wallH), 'wall', 'curvedWall');
  wall.position.set(0, 2.15 + wallH / 2, arc.cz);
  group.add(wall);
  const bandH = 3.4;
  const glass = mesh(
    arcWallGeometry(arc.outer + 0.08, arc.outer - 0.06, arc.span * 0.62, bandH),
    'glass',
    'curvedGlass',
  );
  glass.position.set(0, 3.15 + bandH / 2, arc.cz);
  group.add(glass);
  const mullion = boxGeometry(0.07, bandH, 0.1);
  const start = Math.PI / 2 - arc.span * 0.31;
  for (let i = 0; i < 8; i += 1) {
    const angle = start + arc.span * 0.62 * (i / 7);
    const radius = arc.outer + 0.05;
    const bar = mesh(mullion, 'frame', `mullion${i}`);
    bar.position.set(Math.cos(angle) * radius, 3.15 + bandH / 2, arc.cz + Math.sin(angle) * radius);
    bar.rotation.y = Math.PI / 2 - angle;
    group.add(bar);
  }
  const title = '澳門城市大學';
  const letterRadius = arc.outer + 0.08;
  placeArcLine(group, arc, title, {
    y: 4.9,
    width: 1.24,
    height: 0.96,
    depth: 0.02,
    spread: 0.7,
    radius: letterRadius,
    name: 'arcChar',
  });
  placeArcLine(group, arc, 'CITYU MACAO', {
    y: 3.85,
    width: 0.72,
    height: 0.84,
    depth: 0.02,
    spread: 0.85,
    radius: letterRadius,
    name: 'arcLatin',
  });
  return arc;
}

function placeArcLine(group, arc, text, spec) {
  const chars = text.split('');
  chars.forEach((char, index) => {
    if (char === ' ') return;
    const offset = index - (chars.length - 1) / 2;
    const angle = Math.PI / 2 - offset * (spec.spread / (chars.length - 1));
    const glyph = new THREE.Mesh(
      boxGeometry(spec.width, spec.height, spec.depth),
      arcCharMaterial(char),
    );
    glyph.name = `${spec.name}${index}`;
    glyph.position.set(
      Math.cos(angle) * spec.radius,
      spec.y,
      arc.cz + Math.sin(angle) * spec.radius,
    );
    glyph.rotation.y = Math.PI / 2 - angle;
    group.add(glyph);
  });
}

function arcCharMaterial(char) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 92px "Microsoft JhengHei", "PingFang TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return standardMaterial(0xffffff, {
    map: texture,
    transparent: true,
    depthWrite: false,
  });
}

function addMass(parent, spec) {
  const group = new THREE.Group();
  group.name = 'mass';
  if (spec.landmark) {
    const podiumH = 2.4;
    const podiumW = spec.width * 0.36;
    const podiumD = spec.depth * 0.58;
    const podiumZ = spec.depth * 0.02;
    [-1, 1].forEach((side, index) => {
      const podium = mesh(roundedGeometry(podiumW, podiumH, podiumD, 0.14), 'wall', `podium${index}`);
      podium.position.set(side * spec.width * 0.29, podiumH / 2, podiumZ);
      group.add(podium);
    });
    const back = mesh(roundedGeometry(spec.width * 0.94, podiumH, spec.depth * 0.36, 0.12), 'wall', 'podiumBack');
    back.position.set(0, podiumH / 2, -spec.depth * 0.28);
    group.add(back);
    const recess = new THREE.Mesh(boxGeometry(3.2, 1.7, 0.4), standardMaterial(0x4e585f));
    recess.name = 'entranceRecess';
    recess.position.set(0, 0.9, landmarkArc(spec).frontZ - 1.1);
    group.add(recess);
    const upperH = spec.height - podiumH + 0.2;
    const upper = mesh(roundedGeometry(spec.width * 0.7, upperH, spec.depth * 0.55, 0.16), 'wall', 'upperMass');
    upper.position.set(0, podiumH + upperH / 2 - 0.2, -spec.depth * 0.08);
    group.add(upper);
    addCurvedFront(group, spec);
    parent.add(group);
    return;
  }
  if (spec.courtyard) {
    addCourtyardMass(parent, spec);
    return;
  }
  const body = mesh(roundedGeometry(spec.width, spec.height, spec.depth, 0.16), 'wall', 'massBody');
  body.position.y = spec.height / 2;
  group.add(body);
  parent.add(group);
}

function addCourtyardMass(parent, spec) {
  const group = new THREE.Group();
  group.name = 'mass';
  const wing = 2.8;
  const y = spec.height / 2;
  const south = mesh(roundedGeometry(spec.width, spec.height, wing, 0.12), 'wall', 'southWing');
  south.position.set(0, y, spec.depth / 2 - wing / 2);
  const north = mesh(roundedGeometry(spec.width, spec.height, wing, 0.12), 'wall', 'northWing');
  north.position.set(0, y, -(spec.depth / 2 - wing / 2));
  const sideDepth = spec.depth - wing * 2;
  const east = mesh(roundedGeometry(wing, spec.height, sideDepth, 0.12), 'wall', 'eastWing');
  east.position.set(spec.width / 2 - wing / 2, y, 0);
  const west = mesh(roundedGeometry(wing, spec.height, sideDepth, 0.12), 'wall', 'westWing');
  west.position.set(-(spec.width / 2 - wing / 2), y, 0);
  const court = mesh(
    boxGeometry(spec.width - wing * 2, 0.08, sideDepth),
    'frame',
    'courtyardFloor',
  );
  court.position.set(0, 0.05, 0);
  group.add(south, north, east, west, court);
  parent.add(group);
}

function addEdgeBevel(parent, spec) {
  const group = new THREE.Group();
  group.name = 'edgeBevel';
  const radius = 0.2;
  const geometry = getGeometry(
    'bevelQuarter',
    () => new THREE.CylinderGeometry(radius, radius, 1, 8, 1, false, 0, Math.PI / 2),
  );
  const width = spec.landmark ? spec.width * 0.76 : spec.width;
  const depth = spec.landmark ? spec.depth * 0.7 : spec.depth;
  const height = spec.landmark ? spec.height - 2 : spec.height;
  const y = spec.landmark ? 2.2 + height / 2 : height / 2;
  const zShift = spec.landmark ? spec.depth * 0.2 : 0;
  const corners = [
    [width / 2, depth / 2, 0],
    [-width / 2, depth / 2, Math.PI / 2],
    [-width / 2, -depth / 2, Math.PI],
    [width / 2, -depth / 2, -Math.PI / 2],
  ];
  corners.forEach(([x, z, rotation], index) => {
    const trim = mesh(geometry, 'wall', `edgeBevel${index}`);
    trim.scale.y = height;
    trim.position.set(x, y, z + zShift);
    trim.rotation.y = rotation;
    group.add(trim);
  });
  parent.add(group);
}

function addFloorBands(parent, spec) {
  const group = new THREE.Group();
  group.name = 'floorBands';
  const bandW = (spec.landmark ? spec.width * 0.76 : spec.width) + 0.14;
  const bandD = (spec.landmark ? spec.depth * 0.7 : spec.depth) + 0.14;
  const geometry = boxGeometry(bandW, 0.055, bandD);
  const y0 = spec.landmark ? 2.4 : 0;
  const zShift = spec.landmark ? spec.depth * 0.2 : 0;
  for (let row = 1; row < spec.rows; row += 1) {
    const y = y0 + row * spec.floorHeight;
    if (y >= spec.height - 0.2) continue;
    const band = mesh(geometry, 'frame', `floorBand${row}`);
    band.position.set(0, y, zShift);
    group.add(band);
  }
  parent.add(group);
}

function addWindowCell(parent, cell) {
  const winW = cell.bay * 0.58;
  const winH = cell.floorHeight * 0.5;
  const group = new THREE.Group();
  group.name = `window-${cell.face}-${cell.row}-${cell.col}`;
  const frame = mesh(boxGeometry(winW, winH, 0.05), 'frame', 'frame');
  const glass = mesh(boxGeometry(winW * 0.72, winH * 0.72, 0.02), 'glass', 'glass');
  glass.position.z = 0.03;
  const sill = mesh(boxGeometry(winW * 1.16, 0.045, 0.09), 'wall', 'sill');
  sill.position.set(0, -winH / 2 - 0.01, 0.045);
  group.add(frame, glass, sill);
  if ((cell.row * 13 + cell.col * 7) % 10 < 3) {
    const curtain = mesh(boxGeometry(winW * 0.62, winH * 0.62, 0.015), 'curtain', 'curtain');
    curtain.position.z = -0.02;
    group.add(curtain);
  }
  const glowIndex = nextWindowGlow();
  if (glowIndex !== null) {
    const glow = new THREE.Mesh(
      boxGeometry(winW * 0.5, winH * 0.5, 0.01),
      windowGlowMaterial(glowIndex),
    );
    glow.name = 'windowGlow';
    glow.position.z = 0.05;
    glow.castShadow = false;
    glow.receiveShadow = false;
    registerNightOnly(glow);
    group.add(glow);
    const halo = new THREE.Mesh(
      getGeometry('windowHalo', () => new THREE.PlaneGeometry(1, 1)),
      windowHaloMaterial(),
    );
    halo.name = 'windowHalo';
    halo.scale.set(winW * 2, winH * 2, 1);
    halo.position.z = 0.08;
    halo.castShadow = false;
    halo.receiveShadow = false;
    registerNightOnly(halo);
    group.add(halo);
  }
  group.position.set(cell.x, cell.y, cell.z);
  if (cell.face === '-z') group.rotation.y = Math.PI;
  if (cell.face === '+x') group.rotation.y = -Math.PI / 2;
  if (cell.face === '-x') group.rotation.y = Math.PI / 2;
  parent.add(group);
}

function windowHost(spec) {
  if (!spec.landmark) {
    return { width: spec.width, depth: spec.depth, cx: 0, cz: 0, y0: 0 };
  }
  return {
    width: spec.width * 0.76,
    depth: spec.depth * 0.7,
    cx: 0,
    cz: spec.depth * 0.2,
    y0: 2.35,
  };
}

function addWindows(parent, spec) {
  const group = new THREE.Group();
  group.name = 'windows';
  const host = windowHost(spec);
  let count = 0;
  for (const face of spec.faces) {
    const alongX = face === '+z' || face === '-z';
    const span = alongX ? host.width : host.depth;
    const margin = span * 0.08;
    const bay = (span - margin * 2) / spec.cols;
    const outward = face.startsWith('+') ? 1 : -1;
    for (let row = 0; row < spec.rows; row += 1) {
      for (let col = 0; col < spec.cols; col += 1) {
        const along = -span / 2 + margin + bay * (col + 0.5);
        const y = host.y0 + spec.floorHeight * row + spec.floorHeight * 0.62;
        if (y > spec.height - 0.35) continue;
        const x = alongX ? host.cx + along : host.cx + outward * (host.width / 2 + 0.05);
        const z = alongX ? host.cz + outward * (host.depth / 2 + 0.05) : host.cz + along;
        addWindowCell(group, { face, x, y, z, bay, floorHeight: spec.floorHeight, row, col });
        count += 1;
      }
    }
  }
  if (spec.landmark) {
    const bay = 0.72;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          const x = side * (spec.width * 0.3 + col * bay);
          const y = 0.85 + row * 0.72;
          const z = landmarkArc(spec).frontZ - 0.2;
          addWindowCell(group, { face: '+z', x, y, z, bay, floorHeight: 0.72, row, col });
          count += 1;
        }
      }
    }
  }
  group.userData.count = count;
  parent.add(group);
  return count;
}

function addBalconies(parent, spec) {
  const group = new THREE.Group();
  group.name = 'balconies';
  const post = getGeometry('railPost', () => new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6));
  const slabGeo = boxGeometry(1.15, 0.05, 0.42);
  const railGeo = boxGeometry(1.15, 0.04, 0.04);
  const rows = [2, 4].filter((row) => row < spec.rows);
  const xs = [-spec.width * 0.28, spec.width * 0.28];
  rows.forEach((row) => {
    xs.forEach((x, index) => {
      const balcony = new THREE.Group();
      balcony.name = `balcony${row}-${index}`;
      const slab = mesh(slabGeo, 'wall', 'balconySlab');
      const rail = mesh(railGeo, 'frame', 'balconyRail');
      rail.position.set(0, 0.28, 0.18);
      balcony.add(slab, rail);
      [-0.48, 0, 0.48].forEach((px, postIndex) => {
        const pole = mesh(post, 'frame', `railPost${postIndex}`);
        pole.position.set(px, 0.14, 0.18);
        balcony.add(pole);
      });
      balcony.position.set(x, row * spec.floorHeight, spec.depth / 2 + 0.22);
      group.add(balcony);
    });
  });
  parent.add(group);
}

function addLandmarkLid(parent, spec) {
  const deck = landmarkDeck(spec);
  const lid = mesh(
    boxGeometry(deck.width + deck.lip * 2, 0.1, deck.depth + deck.lip * 2),
    'wall',
    'roofLid',
  );
  lid.position.set(0, spec.height + 0.02, deck.z);
  parent.add(lid);
}

function addParapet(parent, spec) {
  const group = new THREE.Group();
  group.name = 'parapet';
  const deck = spec.landmark ? landmarkDeck(spec) : null;
  const y = spec.landmark ? spec.height + 0.28 : spec.height + 0.12;
  const thick = 0.08;
  const tall = spec.landmark ? 0.42 : 0.26;
  const width = deck ? deck.width + deck.lip * 2 : spec.width;
  const depth = deck ? deck.depth + deck.lip * 2 : spec.depth;
  const zShift = deck ? deck.z : 0;
  const sides = [
    [0, depth / 2, width, thick],
    [0, -depth / 2, width, thick],
    [width / 2, 0, thick, depth],
    [-width / 2, 0, thick, depth],
  ];
  sides.forEach(([x, z, w, d], index) => {
    const wall = mesh(boxGeometry(w, tall, d), 'wall', `parapet${index}`);
    wall.position.set(x, y, z + zShift);
    group.add(wall);
  });
  parent.add(group);
}

function addRoofEquip(parent, spec) {
  const group = new THREE.Group();
  group.name = 'roofEquip';
  const boxA = mesh(boxGeometry(0.9, 0.46, 0.62), 'frame', 'roofBoxA');
  const lift = spec.landmark ? 0.07 : 0;
  boxA.position.set(spec.courtyard ? -2.2 : -spec.width * 0.22, spec.height + 0.28 + lift, spec.courtyard ? spec.depth / 2 - 1.4 : -spec.depth * 0.12);
  const boxB = mesh(boxGeometry(0.55, 0.32, 0.4), 'frame', 'roofBoxB');
  boxB.position.set(spec.courtyard ? 2.4 : spec.width * 0.16, spec.height + 0.2 + lift, spec.courtyard ? spec.depth / 2 - 1.4 : spec.depth * 0.08);
  group.add(boxA, boxB);
  parent.add(group);
}

function addVents(parent, spec) {
  const group = new THREE.Group();
  group.name = 'vents';
  const geometry = getGeometry('vent', () => new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8));
  [-0.8, 0.7].forEach((x, index) => {
    const vent = mesh(geometry, 'frame', `vent${index}`);
    const ventZ = spec.courtyard
      ? spec.depth / 2 - 1.4
      : (spec.landmark ? landmarkDeck(spec).z - landmarkDeck(spec).depth / 2 + 0.55 : spec.depth * 0.2);
    vent.position.set(x, spec.landmark ? spec.height + 0.16 : spec.height + 0.12, ventZ);
    group.add(vent);
  });
  parent.add(group);
}

function addRoofGarden(parent, spec) {
  const group = new THREE.Group();
  group.name = 'roofGarden';
  const deck = spec.landmark ? landmarkDeck(spec) : null;
  const pondW = spec.courtyard ? 5.2 : (deck ? deck.width - 1.4 : Math.min(spec.width * 0.42, 6));
  const pondD = spec.courtyard ? 1.6 : (deck ? deck.depth - 1.2 : Math.min(spec.depth * 0.42, 4));
  const pond = mesh(boxGeometry(pondW, 0.1, pondD), 'roof', 'roofPond');
  const wingZ = spec.courtyard ? spec.depth / 2 - 1.4 : 0;
  const originX = deck ? 0 : (spec.courtyard ? 0 : spec.width * 0.12);
  const originZ = deck ? deck.z : wingZ;
  pond.position.set(originX, spec.height + 0.08, originZ);
  group.add(pond);
  const base = groundY(spec.x, spec.z, spec.depth, spec.rotY || 0);
  const yaw = spec.rotY || 0;
  const crowns = deck
    ? [[-2.2, 0.7], [2.1, 0.55], [-0.6, -0.75], [1.4, -0.6]]
    : [[0.4, 0.15], [1.2, -0.2], [-0.5, 0.2], [0.9, 0.35]];
  crowns.forEach(([x, z]) => {
    const local = new THREE.Vector3(
      originX + (deck ? x : x - 0.5),
      spec.height + 0.12,
      originZ + z,
    );
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    roofCrowns.push({
      x: spec.x + local.x,
      y: base + local.y,
      z: spec.z + local.z,
    });
  });
  parent.add(group);
}

const roofCrowns = [];

export function consumeRoofCrowns() {
  const list = roofCrowns.slice();
  roofCrowns.length = 0;
  return list;
}

function addEntrance(parent, spec) {
  const canopy = new THREE.Group();
  canopy.name = 'entranceCanopy';
  const doorZ = spec.landmark ? landmarkArc(spec).frontZ - 0.85 : spec.depth / 2 + 0.36;
  const canopyY = spec.landmark ? 1.58 : 1.72;
  const slabW = spec.landmark ? 2.6 : 1.9;
  const slab = mesh(boxGeometry(slabW, 0.1, 0.7), 'canopy', 'entranceCanopySlab');
  slab.position.set(0, canopyY, doorZ);
  canopy.add(slab);
  parent.add(canopy);

  const columns = new THREE.Group();
  columns.name = 'columns';
  const shaft = getGeometry('entryColumn', () => new THREE.CylinderGeometry(0.09, 0.09, 1, 8));
  if (spec.landmark) {
    const arc = landmarkArc(spec);
    const start = Math.PI / 2 - arc.span / 2;
    let placed = 0;
    for (let i = 0; i < 8; i += 1) {
      const angle = start + arc.span * ((i + 0.5) / 8);
      if (Math.abs(angle - Math.PI / 2) < 0.22) continue;
      const radius = arc.outer - 0.85;
      const column = mesh(shaft, 'column', `entryColumn${placed}`);
      column.scale.y = 2.15;
      column.position.set(Math.cos(angle) * radius, 1.08, arc.cz + Math.sin(angle) * radius);
      columns.add(column);
      placed += 1;
    }
  } else {
    [-0.7, 0.7].forEach((x, index) => {
      const column = mesh(shaft, 'column', `entryColumn${index}`);
      column.scale.y = 1.48;
      column.position.set(x, 0.74, doorZ + 0.05);
      columns.add(column);
    });
  }
  parent.add(columns);

  const stairs = new THREE.Group();
  stairs.name = 'stairs';
  const stepCount = spec.landmark ? 6 : 4;
  for (let step = 0; step < stepCount; step += 1) {
    const tread = mesh(boxGeometry(spec.landmark ? 2.2 : 1.7, 0.1, 0.28), 'wall', `step${step}`);
    const z = spec.landmark ? doorZ + 1.7 - step * 0.28 : doorZ - 0.15 + step * 0.28;
    tread.position.set(0, 0.05 + step * 0.1, z);
    stairs.add(tread);
  }
  parent.add(stairs);
}

function addCurtainWall(parent, spec) {
  const group = new THREE.Group();
  if (spec.landmark) {
    group.name = 'curtainWall';
    parent.add(group);
    return;
  }
  if (spec.curtain === 'blue') {
    group.name = 'blueGlassBox';
    group.userData.pickable = true;
    group.userData.label = '藍色玻璃盒';
    const body = mesh(roundedGeometry(4.6, 8.4, 5.4, 0.16), 'blueGlass', 'blueGlassBody');
    body.position.set(-(spec.width / 2 + 1.5), 4.2, 0.4);
    group.add(body);
  } else if (spec.libraryGlass) {
    group.name = 'libraryGlass';
    const body = mesh(
      roundedGeometry(2.4, spec.height * 0.28, 0.22, 0.05),
      'glass',
      'libraryGlassBody',
    );
    body.position.set(0, spec.height * 0.16, spec.depth / 2 + 0.14);
    group.add(body);
  } else if (spec.glassLobby) {
    group.name = 'glassLobby';
    const body = mesh(
      roundedGeometry(spec.width * 0.46, spec.height * 0.42, 0.4, 0.06),
      'glass',
      'glassLobbyBody',
    );
    body.position.set(0, spec.height * 0.24, spec.depth / 2 + 0.18);
    group.add(body);
  } else {
    group.name = 'curtainWall';
    const body = mesh(roundedGeometry(0.4, spec.height * 0.52, 2.4, 0.08), 'glass', 'curtainWallBody');
    body.position.set(spec.width / 2 + 0.16, spec.height * 0.48, 0);
    group.add(body);
  }
  parent.add(group);
}

function addEmblem(parent, spec) {
  const group = new THREE.Group();
  group.name = 'emblem';
  group.userData.pickable = true;
  group.userData.label = `${spec.title} 校徽`;
  const large = spec.emblemSize === 'large';
  const outer = spec.landmark ? 1.25 : (large ? 0.92 : 0.28);
  const inner = outer * 0.68;
  const ring = mesh(
    getGeometry(`emblemRing${outer}`, () => new THREE.RingGeometry(inner, outer, 28)),
    'emblemGreen',
    'emblemRing',
  );
  const face = mesh(
    getGeometry(`emblemFace${inner}`, () => new THREE.CircleGeometry(inner, 28)),
    'emblemFace',
    'emblemFace',
  );
  face.position.z = 0.01;
  group.add(ring, face);
  if (spec.landmark) {
    const texture = new THREE.TextureLoader().load(logoUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const logo = new THREE.Mesh(
      getGeometry('adminLogo', () => new THREE.CircleGeometry(outer * 1.08, 48)),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: true }),
    );
    logo.name = 'adminLogo';
    logo.position.z = 0.05;
    group.add(logo);
  }
  const y = spec.emblemBay
    ? spec.height * 0.86
    : (spec.landmark ? spec.height * 0.8 : (large ? spec.height * 0.66 : 1.7));
  const x = spec.landmark || large || spec.emblemBay ? 0 : -spec.width * 0.18;
  const z = spec.emblemBay
    ? spec.depth / 2 + 0.55
    : (spec.landmark ? landmarkArc(spec).frontZ + 0.18 : spec.depth / 2 + (large ? 0.18 : 0.1));
  group.position.set(x, y, z);
  parent.add(group);
}

function addNameplate(parent, spec) {
  if (spec.landmark) return;
  const group = new THREE.Group();
  group.name = 'nameplate';
  group.userData.pickable = true;
  group.userData.label = `${spec.title} 招牌`;
  const large = spec.emblemSize === 'large';
  const width = large ? 3.5 : 2.3;
  const height = large ? 1.05 : 0.72;
  const board = mesh(boxGeometry(width, height, 0.06), 'wall', 'signBoard');
  const text = new THREE.Mesh(boxGeometry(width * 0.92, height * 0.84, 0.02), signMaterial(spec.sign));
  text.name = 'signText';
  text.position.z = 0.045;
  group.add(board, text);
  const y = spec.landmark ? spec.height * 0.52 : (large ? spec.height * 0.4 : 1.15);
  const x = spec.landmark || large ? 0 : spec.width * 0.16;
  const z = spec.landmark ? landmarkArc(spec).frontZ + 0.16 : spec.depth / 2 + 0.14;
  group.position.set(x, y, z);
  parent.add(group);
}

function addAccentPier(parent, spec) {
  const pier = mesh(boxGeometry(0.55, spec.height * 0.92, 0.38), 'canopy', 'accentPier');
  pier.position.set(-spec.width * 0.28, spec.height * 0.46, spec.depth / 2 + 0.1);
  parent.add(pier);
}

function addFins(parent, spec) {
  const group = new THREE.Group();
  group.name = 'fins';
  [-0.32, 0, 0.32].forEach((t, index) => {
    const fin = mesh(boxGeometry(0.16, spec.height * 0.96, 0.42), 'frame', `fin${index}`);
    fin.position.set(spec.width * t, spec.height * 0.48, spec.depth / 2 + 0.06);
    group.add(fin);
  });
  parent.add(group);
}

function addLinkAnnex(parent, spec) {
  const group = new THREE.Group();
  group.name = 'linkAnnex';
  const annex = mesh(boxGeometry(4.2, 4.6, 5.4), 'wall', 'annex');
  annex.position.set(-(spec.width / 2 + 2.8), 2.3, 3.2);
  const bridge = mesh(boxGeometry(3.4, 0.32, 1.05), 'frame', 'skybridge');
  bridge.position.set(-(spec.width / 2 + 1.2), 6.4, 1.6);
  group.add(annex, bridge);
  parent.add(group);
}

export function createSkybridge() {
  const group = new THREE.Group();
  group.name = 'skybridge';
  group.userData.pickable = true;
  group.userData.label = '連橋';
  const x0 = 6.35;
  const x1 = 10.15;
  const z = -5;
  const deckY = Math.max(groundY(-1, -5, 11, 0), groundY(14, -4.2, 12, 0)) + 5.6;
  const span = x1 - x0;
  const deck = mesh(boxGeometry(span, 0.42, 1.7), 'frame', 'skybridgeDeck');
  deck.position.set((x0 + x1) / 2, deckY, z);
  [-1, 1].forEach((side, index) => {
    const rail = mesh(boxGeometry(span, 0.1, 0.08), 'frame', `skybridgeRail${index}`);
    rail.position.set((x0 + x1) / 2, deckY + 0.72, z + side * 0.72);
    group.add(rail);
    [x0, x1].forEach((end, endIndex) => {
      const post = mesh(boxGeometry(0.1, 0.9, 0.1), 'frame', `skybridgePost${index}${endIndex}`);
      post.position.set(end, deckY + 0.28, z + side * 0.72);
      group.add(post);
    });
  });
  group.add(deck);
  return group;
}

function addEmblemBay(parent, spec) {
  const bay = mesh(boxGeometry(3.4, spec.height * 0.36, 0.7), 'wall', 'emblemBay');
  bay.position.set(0, spec.height * 0.82, spec.depth / 2 + 0.28);
  parent.add(bay);
}

function addFrontWall(parent, spec) {
  const group = new THREE.Group();
  group.name = 'frontWall';
  const wall = mesh(boxGeometry(spec.width * 0.72, 1.05, 0.24), 'wall', 'reliefWall');
  wall.position.set(0, 0.62, spec.depth / 2 + 0.7);
  const panel = mesh(boxGeometry(spec.width * 0.36, 0.62, 0.06), 'frame', 'reliefPanel');
  panel.position.set(-spec.width * 0.08, 0.68, spec.depth / 2 + 0.84);
  group.add(wall, panel);
  parent.add(group);
}

function addFrontEaves(parent, spec) {
  const group = new THREE.Group();
  group.name = 'frontEaves';
  for (let row = 1; row < spec.rows; row += 1) {
    const y = row * spec.floorHeight;
    if (y >= spec.height - 0.3) continue;
    const eave = mesh(boxGeometry(spec.width * 0.96, 0.08, 0.72), 'frame', `eave${row}`);
    eave.position.set(0, y, spec.depth / 2 + 0.28);
    const planter = mesh(boxGeometry(spec.width * 0.9, 0.16, 0.22), 'roof', `planter${row}`);
    planter.position.set(0, y + 0.14, spec.depth / 2 + 0.46);
    group.add(eave, planter);
  }
  parent.add(group);
}

function addDrainage(parent, spec) {
  const group = new THREE.Group();
  group.name = 'drainage';
  const pipeGeo = boxGeometry(0.08, spec.height, 0.08);
  [-1, 1].forEach((side, index) => {
    const pipe = mesh(pipeGeo, 'frame', `downspout${index}`);
    pipe.position.set(side * (spec.width / 2 + 0.06), spec.height / 2, spec.depth / 2 + 0.02);
    group.add(pipe);
  });
  parent.add(group);
}

export function createDetailedBuilding(spec) {
  const building = new THREE.Group();
  building.name = spec.name;
  building.position.set(spec.x, groundY(spec.x, spec.z, spec.depth, spec.rotY), spec.z);
  building.rotation.y = spec.rotY || 0;

  addMass(building, spec);
  addEdgeBevel(building, spec);
  if (!spec.courtyard) addFloorBands(building, spec);
  if (spec.planters) addFrontEaves(building, spec);
  if (spec.accentPier) addAccentPier(building, spec);
  if (spec.fins) addFins(building, spec);
  if (spec.linkAnnex) addLinkAnnex(building, spec);
  if (spec.emblemBay) addEmblemBay(building, spec);
  if (spec.frontWall) addFrontWall(building, spec);
  const windowCount = addWindows(building, spec);
  addBalconies(building, spec);
  if (spec.landmark) addLandmarkLid(building, spec);
  addParapet(building, spec);
  addRoofEquip(building, spec);
  addVents(building, spec);
  addRoofGarden(building, spec);
  addEntrance(building, spec);
  addCurtainWall(building, spec);
  addEmblem(building, spec);
  addNameplate(building, spec);
  addDrainage(building, spec);

  building.userData.windowCount = windowCount;
  return building;
}

export function createCourtCanopy() {
  const frontZ = -13.5;
  const courtX = 0.2;
  const ground = heightAt(courtX, frontZ);
  const lift = 4.2;
  const canopy = new THREE.Group();
  canopy.name = 'redCanopy';
  canopy.userData.pickable = true;
  canopy.userData.label = '紅色雨遮';
  canopy.position.set(courtX, 0, frontZ);
  const slab = mesh(roundedGeometry(6.4, 1.2, 2.4, 0.12), 'canopy', 'redCanopySlab');
  slab.position.y = ground + lift + 0.6;
  const court = mesh(roundedGeometry(14, 0.1, 4.2, 0.16), 'roof', 'gardenLawn');
  court.position.set(0, ground + 0.06, 0);
  canopy.add(slab, court);

  const colonnade = new THREE.Group();
  colonnade.name = 'colonnade';
  colonnade.position.set(courtX, 0, frontZ);
  const shaft = getGeometry('courtColumn', () => new THREE.CylinderGeometry(0.22, 0.22, 1, 8));
  for (let i = 0; i < 6; i += 1) {
    const column = mesh(shaft, 'column', `column${i}`);
    column.scale.y = lift;
    column.position.set(-2.2 + i * (4.4 / 5), ground + lift / 2, 0.7);
    colonnade.add(column);
  }
  return { canopy, colonnade };
}
