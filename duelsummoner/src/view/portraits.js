// The duelist select screen's pictures of the real models (view only). Once at load, each rig is moved for a moment into a tiny scene of its own, drawn with the game's renderer into a render target and read back:
//  - tile: a head-and-shoulders snapshot as a data URL, for the duelist tiles;
//  - frames: a slow turn of the idle_cards pose, head to boots, in one atlas canvas, for the preview box (the preview just draws frames from it, so it needs no renderer, no scene and no loop of its own).
// The rig goes back to its own parent afterwards with its mixer cleared, so the game uses it exactly as if nothing had happened.
const T = window.THREE;

const FW = 120, FH = 140, COLS = 6, N = 24;

function shoot(renderer, rt, S, cam, buf, ctx, dx, dy, w, h) {
  renderer.setRenderTarget(rt); renderer.render(S, cam); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf); renderer.setRenderTarget(null);
  const img = ctx.createImageData(w, h);       // the target reads bottom row first: flip it
  for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  ctx.putImageData(img, dx, dy);
}

export function bakeDuelist(renderer, rig) {
  try {
    const S = new T.Scene(); S.add(new T.HemisphereLight(0xfff3d6, 0x7a6048, 1.05)); const sun = new T.DirectionalLight(0xffe2b0, 0.85); sun.position.set(2.5, 4, 4); S.add(sun);
    const parent = rig.group.parent, pos = rig.group.position.clone(), rot = rig.group.rotation.clone(), scl = rig.group.scale.clone(), vis = rig.group.visible;
    const extras = rig.see ? rig.see.extras : [], evis = extras.map(e => e.visible); for (const e of extras) e.visible = false; const mv = rig.marker ? rig.marker.visible : false; if (rig.marker) rig.marker.visible = false;
    if (parent) parent.remove(rig.group); S.add(rig.group); rig.group.visible = true; rig.group.position.set(0, 0, 0); rig.group.scale.set(1, 1, 1);
    rig.group.rotation.set(0, 0, 0); rig.group.updateMatrixWorld(true); const f = rig.forward(), face = Math.atan2(f.x, f.z);       // turn the model's front toward the camera (+z)
    const a = rig._play('idle_cards', { loop: true, fade: 0 }); if (a) { a.setEffectiveWeight(1); a.time = 0.4; }
    const rt = new T.WebGLRenderTarget(FW, FH, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true }), buf = new Uint8Array(FW * FH * 4);
    const cam = new T.PerspectiveCamera(28, FW / FH, 0.1, 30); cam.position.set(0, 1.0, 4.2); cam.lookAt(0, 0.92, 0);
    const atlas = document.createElement('canvas'); atlas.width = FW * COLS; atlas.height = FH * Math.ceil(N / COLS); const actx = atlas.getContext('2d');
    for (let k = 0; k < N; k++) {
      rig.mixer.update(1 / 12); rig.group.rotation.y = -face + Math.sin(k / N * Math.PI * 2) * 0.55; rig.group.updateMatrixWorld(true);
      shoot(renderer, rt, S, cam, buf, actx, (k % COLS) * FW, Math.floor(k / COLS) * FH, FW, FH);
    }
    // the tile: head and shoulders, straight on
    rig.group.rotation.y = -face + 0.12; rig.group.updateMatrixWorld(true); cam.fov = 24; cam.aspect = 1; cam.updateProjectionMatrix(); cam.position.set(0, 1.5, 3.4); cam.lookAt(0, 1.46, 0);
    const TS = 96, rt2 = new T.WebGLRenderTarget(TS, TS, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true }), buf2 = new Uint8Array(TS * TS * 4), tc = document.createElement('canvas'); tc.width = tc.height = TS;
    shoot(renderer, rt2, S, cam, buf2, tc.getContext('2d'), 0, 0, TS, TS);
    // give the rig back
    rig.mixer.stopAllAction(); rig.L = null; rig.cur = null; rig.curAct = null; rig.upperAct = null; rig.upperT = 0; rig.holdUntil = 0; if (rig.actions) rig.actions.clear();
    S.remove(rig.group); if (parent) parent.add(rig.group); rig.group.position.copy(pos); rig.group.rotation.copy(rot); rig.group.scale.copy(scl); rig.group.visible = vis;
    extras.forEach((e, i) => { e.visible = evis[i]; }); if (rig.marker) rig.marker.visible = mv; rt.dispose(); rt2.dispose();
    return { atlas, fw: FW, fh: FH, cols: COLS, n: N, tile: tc.toDataURL('image/png') };
  } catch (e) { console.error('portrait bake failed', e); return null; }
}

// the preview box: draws the baked frames at about 12 a second; stop() ends it
export function startBakedPreview(canvas, bake) {
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; canvas.width = bake.fw; canvas.height = bake.fh; let alive = true; const t0 = performance.now();
  (function loop() {
    if (!alive || !canvas.isConnected) return;
    const k = Math.floor((performance.now() - t0) / 1000 * 12) % bake.n; ctx.clearRect(0, 0, bake.fw, bake.fh);
    ctx.drawImage(bake.atlas, (k % bake.cols) * bake.fw, Math.floor(k / bake.cols) * bake.fh, bake.fw, bake.fh, 0, 0, bake.fw, bake.fh); requestAnimationFrame(loop);
  })();
  return { stop() { alive = false; }, setColor() {} };
}
