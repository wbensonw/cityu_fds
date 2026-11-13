import { createCourtCanopy, createDetailedBuilding } from './parts.js';

export function createBuildingL(options = {}) {
  return createDetailedBuilding({
    name: 'buildingL',
    title: '中葡樓',
    x: -12.8,
    z: -14.2,
    rotY: 0,
    width: 7,
    depth: 16,
    height: 7.6,
    rows: 7,
    cols: 16,
    floorHeight: 1.02,
    faces: ['+x'],
    emblemSize: 'small',
    sign: ['中葡樓', 'Luso-Chinese Building'],
    curtain: 'small',
    ...options,
  });
}

export { createCourtCanopy };
