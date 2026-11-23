// The gate seal: a tall dark-violet column with a pale edge and five turning sigil rings, standing over the gate so the goal can be seen from anywhere on the map.
// It is unlit and unfogged on purpose (a beacon), drawn with normal alpha, and it widens with distance so it never drops under about 3 render pixels.
const T = window.THREE;
export function buildGateSeal(map) {
  const g = new T.Group(), H = 90, W = 4.5;
  const core = new T.Mesh(new T.BoxGeometry(W, H, W), new T.MeshBasicMaterial({ color: 0x2e1a52, transparent: true, opacity: 0.85, fog: false, depthWrite: false })); core.position.y = H / 2; g.add(core);
  const edgeMat = new T.MeshBasicMaterial({ color: 0xf4ecff, fog: false });
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const e = new T.Mesh(new T.BoxGeometry(0.4, H, 0.4), edgeMat); e.position.set(x * W / 2, H / 2, z * W / 2); g.add(e); }
  const rings = []; const ringGeo = new T.TorusGeometry(4, 0.25, 5, 20), ringMat = new T.MeshBasicMaterial({ color: 0xf4ecff, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
  for (let i = 0; i < 5; i++) { const r = new T.Mesh(ringGeo, ringMat); r.rotation.x = Math.PI / 2; r.position.y = 14 + i * 12; g.add(r); rings.push(r); }
  g.position.set(map.gate.x, 0, map.gate.z); g.frustumCulled = false; g.traverse(o => { o.frustumCulled = false; });
  g.userData.update = (cam, t) => {
    const dx = cam.x - map.gate.x, dz = cam.z - map.gate.z, d = Math.sqrt(dx * dx + dz * dz), k = Math.max(1, d * 0.0175 / W);
    g.scale.set(k, 1, k); rings.forEach((r, i) => { r.rotation.z = t * (0.35 + i * 0.1) * (i % 2 ? -1 : 1); });
  };
  return g;
}
