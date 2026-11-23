// The gate seal: a tall dark-violet column with a pale edge and five turning sigil rings, standing over the gate so the goal can be seen from anywhere on the map.
// It is unlit and unfogged on purpose (a beacon), drawn with normal alpha, and it widens with distance so it never drops under about 3 render pixels.
// Two draws in all: the column with its four edge strips (one merged mesh), and the five rings (one merged mesh that turns).
const T = window.THREE;
function merge(parts) {                                                    // parts: [geometry, matrix, [r, g, b]] -> one non-indexed geometry with vertex colours
  const pos = [], col = [];
  for (const [geo, m, c] of parts) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(c[0], c[1], c[2]); } }
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return out;
}
export function buildGateSeal(map) {
  const g = new T.Group(), H = 90, W = 4.5, M = new T.Matrix4(), VIO = [0.18, 0.10, 0.32], PALE = [0.96, 0.93, 1];
  const col = [[new T.BoxGeometry(W, H, W), M.clone().makeTranslation(0, H / 2, 0), VIO]];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) col.push([new T.BoxGeometry(0.4, H, 0.4), M.clone().makeTranslation(x * W / 2, H / 2, z * W / 2), PALE]);
  const ringParts = []; for (let i = 0; i < 5; i++) ringParts.push([new T.TorusGeometry(4, 0.25, 5, 20), M.clone().makeRotationX(Math.PI / 2).setPosition(0, 14 + i * 12, 0), PALE]);
  const mat = () => new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
  const column = new T.Mesh(merge(col), mat()), rings = new T.Mesh(merge(ringParts), mat()); g.add(column, rings);
  g.position.set(map.gate.x, 0, map.gate.z); g.traverse(o => { o.frustumCulled = false; });
  g.userData.update = (cam, t) => {
    const dx = cam.x - map.gate.x, dz = cam.z - map.gate.z, d = Math.sqrt(dx * dx + dz * dz), k = Math.max(1, d * 0.0175 / W);
    g.scale.set(k, 1, k); rings.rotation.y = t * 0.4;
  };
  return g;
}
