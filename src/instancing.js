import * as THREE from 'three';

const dummy = new THREE.Object3D();
const color = new THREE.Color();

export function addInstanced(parent, name, geometry, material, items) {
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  mesh.name = name;
  items.forEach((item, index) => {
    dummy.position.set(item.x, item.y, item.z);
    dummy.rotation.set(item.rx || 0, item.ry || 0, item.rz || 0);
    dummy.scale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (item.color !== undefined) {
      color.set(item.color);
      mesh.setColorAt(index, color);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

export function makeBasisMatrix(position, yaw) {
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
  return matrix;
}
