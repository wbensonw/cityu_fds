import { createDetailedBuilding } from './parts.js';

export function createBuildingW(options = {}) {
  return createDetailedBuilding({
    name: 'buildingW',
    title: '王寬誠樓',
    x: -19.9,
    z: -15,
    rotY: 0,
    width: 6,
    depth: 14,
    height: 9,
    rows: 8,
    cols: 8,
    floorHeight: 1.05,
    faces: ['+x', '-x'],
    emblemSize: 'small',
    sign: ['王寬誠樓', 'K.C.Wong Building'],
    curtain: 'blue',
    ...options,
  });
}
