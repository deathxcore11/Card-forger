// A small 3D preview of a duelist idling, for the duelist select screen. Its own tiny renderer, scene and loop; stop() ends it.
const T = window.THREE;

export function startPreview(canvas, color) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: true });
  const W = 240, H = 280; renderer.setPixelRatio(1); renderer.setSize(W / 2, H / 2, false); renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(40, W / H, 0.1, 50); cam.position.set(0, 1.6, 5.2); cam.lookAt(0, 1.0, 0);
  scene.add(new T.HemisphereLight(0xfff3d6, 0x6a5a48, 1.0)); const sun = new T.DirectionalLight(0xffe2b0, 0.7); sun.position.set(3, 5, 4); scene.add(sun);
  const lam = c => new T.MeshLambertMaterial({ color: c, flatShading: true });
  const g = new T.Group(), body = new T.Group();
  const robe = new T.Mesh(new T.CylinderGeometry(0.35, 0.65, 1.3, 6), lam(color)); robe.position.y = 0.65;
  const head = new T.Mesh(new T.BoxGeometry(0.45, 0.45, 0.45), lam(0xe8c39a)); head.position.y = 1.55;
  const disk = new T.Mesh(new T.BoxGeometry(0.9, 0.08, 0.35), lam(0xd8b24a)); disk.position.set(-0.55, 1.0, 0.1);
  body.add(robe, head, disk); g.add(body); scene.add(g);
  const floor = new T.Mesh(new T.CylinderGeometry(1.1, 1.2, 0.1, 10), lam(0x4a3a5a)); floor.position.y = -0.05; scene.add(floor);
  let alive = true, t0 = performance.now();
  (function loop() {
    if (!alive || !canvas.isConnected) { alive = false; renderer.dispose(); return; }
    const t = (performance.now() - t0) / 1000;
    g.rotation.y = Math.sin(t * 0.6) * 0.7; body.position.y = Math.sin(t * 2) * 0.03; head.rotation.y = Math.sin(t * 1.3) * 0.2; disk.position.y = 1.0 + Math.sin(t * 2.4) * 0.05;
    renderer.render(scene, cam); requestAnimationFrame(loop);
  })();
  return { stop() { alive = false; }, setColor(c) { robe.material.color.setHex(c); } };
}
