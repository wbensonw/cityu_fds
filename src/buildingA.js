import { createDetailedBuilding } from './parts.js';

export function createBuildingA(options = {}) {
  return createDetailedBuilding({
    name: 'buildingA',
    title: '行政樓',
    x: -2,
    z: 21,
    rotY: 0,
    width: 24,
    depth: 12,
    height: 8.4,
    rows: 7,
    cols: 9,
    floorHeight: 0.78,
    faces: ['+x', '-x', '-z'],
    emblemSize: 'large',
    sign: ['澳門城市大學', 'City University of Macau'],
    curtain: 'small',
    landmark: true,
    ...options,
  });
}
