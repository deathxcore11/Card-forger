/* Duel Summoner, test build 1: orbit camera, starter summon combat, defeat and restart.
   Self-contained. Original placeholder shapes only. */
(function () {
  'use strict';
  var T = window.THREE;

  // ---------- tuning (one place) ----------
  var CFG = {
    arenaR: 42,
    player: { hp: 100, speed: 9, jump: 11, gravity: 28, dashSpeed: 26, dashTime: 0.16, dashCd: 1.1, radius: 0.6 },
    cam: { dist: 10, height: 1.6, sens: 0.0025, pitchMin: -0.15, pitchMax: 1.2 },
    wyvern: { range: 20, cooldown: 0.65, damage: 2, shotSpeed: 34, shotLife: 1.2 },
    enemy: { hp: 4, speed: 4.2, radius: 0.7, damage: 8, attackCd: 0.9, reach: 1.5, max: 60 },
    spawn: { every: 1.1, ring: 26 },
    xp: { magnet: 5, pick: 1.2, perLevel: 8 }
  };

  // ---------- renderer and scene ----------
  var canvas = document.getElementById('view');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false });
  var LOW = 2; // render at half size for a chunky late-90s image
  var scene = new T.Scene();
  scene.background = new T.Color(0x2a1a2e);
  scene.fog = new T.Fog(0x2a1a2e, 30, 80);
  var camera = new T.PerspectiveCamera(62, 1, 0.1, 200);

  scene.add(new T.HemisphereLight(0xffe2b0, 0x3a2440, 0.75));
  var sun = new T.DirectionalLight(0xffc98a, 0.6);
  sun.position.set(20, 30, 10);
  scene.add(sun);

  function mat(color, extra) {
    var o = { color: color, flatShading: true };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new T.MeshLambertMaterial(o);
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(1);
    renderer.setSize(Math.ceil(w / LOW), Math.ceil(h / LOW), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- arena ----------
  var obstacles = []; // {x, z, r}
  (function buildArena() {
    var floor = new T.Mesh(new T.CircleGeometry(CFG.arenaR, 28), mat(0xa9824f));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    // floor tiles: darker ring bands so movement reads
    for (var i = 1; i <= 4; i++) {
      var ring = new T.Mesh(new T.RingGeometry(i * 9 - 0.25, i * 9 + 0.25, 28), mat(0x8a6539));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
      scene.add(ring);
    }
    var wall = new T.Mesh(new T.CylinderGeometry(CFG.arenaR + 1, CFG.arenaR + 1, 5, 28, 1, true),
      mat(0x9a6f44, { side: T.BackSide }));
    wall.position.y = 2.5;
    scene.add(wall);
    // broken pillars, fixed layout so every run is the same arena
    var spots = [[12, 6, 5.5], [-14, 9, 2.2], [-8, -15, 6], [16, -12, 3], [3, 22, 4.2], [-24, -4, 6.2],
                 [25, 8, 1.6], [-5, 28, 5], [8, -27, 2.6], [-22, 20, 3.4], [28, -20, 5.8], [-28, -22, 2]];
    spots.forEach(function (s, n) {
      var r = 1.3;
      var p = new T.Mesh(new T.CylinderGeometry(r * 0.85, r, s[2], 7), mat(n % 2 ? 0xd9b27a : 0xb98c56));
      p.position.set(s[0], s[2] / 2, s[1]);
      scene.add(p);
      var base = new T.Mesh(new T.BoxGeometry(3.2, 0.6, 3.2), mat(0x8f6a40));
      base.position.set(s[0], 0.3, s[1]);
      scene.add(base);
      obstacles.push({ x: s[0], z: s[1], r: r + 0.3 });
    });
  })();

  // ---------- actors ----------
  function makePlayerMesh() {
    var g = new T.Group();
    var robe = new T.Mesh(new T.CylinderGeometry(0.35, 0.65, 1.3, 6), mat(0x3c2a66));
    robe.position.y = 0.65;
    var head = new T.Mesh(new T.BoxGeometry(0.45, 0.45, 0.45), mat(0xe8c39a));
    head.position.y = 1.55;
    var disk = new T.Mesh(new T.BoxGeometry(0.9, 0.08, 0.35), mat(0xd8b24a));
    disk.position.set(-0.55, 1.0, 0.1);
    g.add(robe, head, disk);
    return g;
  }
  function makeWyvernMesh() {
    var g = new T.Group();
    var body = new T.Mesh(new T.ConeGeometry(0.4, 1.4, 5), mat(0xd9502a));
    body.rotation.x = Math.PI / 2;
    var wingG = new T.BufferGeometry();
    wingG.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0.3, 1.5, 0.3, -0.3, 0, 0, -0.5,
      0, 0, 0.3, 0, 0, -0.5, -1.5, 0.3, -0.3], 3));
    wingG.computeVertexNormals();
    var wings = new T.Mesh(wingG, mat(0xf0913a, { side: T.DoubleSide }));
    g.add(body, wings);
    g.userData.wings = wings;
    return g;
  }
  function makeEnemyMesh() {
    var g = new T.Group();
    var m = mat(0x5a6b4a);
    var body = new T.Mesh(new T.OctahedronGeometry(0.75, 0), m);
    body.position.y = 0.85; body.scale.y = 1.25;
    var eye = new T.Mesh(new T.BoxGeometry(0.5, 0.12, 0.1), new T.MeshBasicMaterial({ color: 0xffe14a }));
    eye.position.set(0, 1.05, 0.62);
    g.add(body, eye);
    g.userData.mat = m;
    return g;
  }

  var playerMesh = makePlayerMesh(); scene.add(playerMesh);
  var wyvernMesh = makeWyvernMesh(); scene.add(wyvernMesh);

  // pools: built once, reused across runs
  function Pool(make, n) {
    this.items = [];
    for (var i = 0; i < n; i++) { var o = make(); o.mesh.visible = false; o.alive = false; scene.add(o.mesh); this.items.push(o); }
  }
  Pool.prototype.get = function () {
    for (var i = 0; i < this.items.length; i++) if (!this.items[i].alive) { var o = this.items[i]; o.alive = true; o.mesh.visible = true; return o; }
    return null;
  };
  Pool.prototype.kill = function (o) { o.alive = false; o.mesh.visible = false; };
  Pool.prototype.clear = function () { for (var i = 0; i < this.items.length; i++) this.kill(this.items[i]); };
  Pool.prototype.count = function () { var c = 0; for (var i = 0; i < this.items.length; i++) if (this.items[i].alive) c++; return c; };

  var enemies = new Pool(function () { return { mesh: makeEnemyMesh(), hp: 0, atk: 0, flash: 0 }; }, CFG.enemy.max);
  var shotGeo = new T.OctahedronGeometry(0.28, 0), shotMat = new T.MeshBasicMaterial({ color: 0xffb040 });
  var shots = new Pool(function () { return { mesh: new T.Mesh(shotGeo, shotMat), vx: 0, vz: 0, life: 0 }; }, 40);
  var gemGeo = new T.OctahedronGeometry(0.3, 0), gemMat = new T.MeshBasicMaterial({ color: 0x9f7bff });
  var gems = new Pool(function () { return { mesh: new T.Mesh(gemGeo, gemMat) }; }, 120);

  // ---------- state ----------
  var S;
  var MODE = 'start'; // start | play | pause | dead
  var best = 0;
  try { best = parseFloat(localStorage.getItem('duelsummoner.best') || '0') || 0; } catch (e) {}

  function newRun() {
    enemies.clear(); shots.clear(); gems.clear();
    S = {
      t: 0, kills: 0, xp: 0, level: 1,
      p: { x: 0, y: 0, z: 0, vy: 0, hp: CFG.player.hp, face: 0, dash: 0, dashCd: 0, dx: 0, dz: 1, onGround: true },
      yaw: 0, pitch: 0.45,
      spawnT: CFG.spawn.every, fireT: 0.3, flash: 0, wy: { x: 1.5, y: 2.2, z: 0 }
    };
    playerMesh.position.set(0, 0, 0);
    drawHud(true);
  }

  // ---------- input ----------
  var keys = {};
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Escape' && MODE === 'play' && !document.pointerLockElement) setMode('pause');
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  function look(dx, dy) {
    if (MODE !== 'play') return;
    S.yaw -= dx * CFG.cam.sens;
    S.pitch = Math.max(CFG.cam.pitchMin, Math.min(CFG.cam.pitchMax, S.pitch + dy * CFG.cam.sens));
  }
  document.addEventListener('mousemove', function (e) {
    if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
    else if (dragging) look(e.movementX, e.movementY); // fallback when the mouse cannot be captured
  });
  var dragging = false;
  canvas.addEventListener('mousedown', function () {
    dragging = true;
    if (MODE === 'play' && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
  });
  window.addEventListener('mouseup', function () { dragging = false; });
  document.addEventListener('pointerlockchange', function () {
    if (!document.pointerLockElement && MODE === 'play') setMode('pause'); // Esc releases the mouse and pauses
  });
  window.addEventListener('blur', function () { keys = {}; if (MODE === 'play') setMode('pause'); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && MODE === 'play') setMode('pause'); });

  var $ = function (id) { return document.getElementById(id); };
  function setMode(m) {
    MODE = m;
    $('startScreen').classList.toggle('on', m === 'start');
    $('pauseScreen').classList.toggle('on', m === 'pause');
    $('deadScreen').classList.toggle('on', m === 'dead');
    if (m !== 'play' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    $('hint').textContent = m === 'play' && !document.pointerLockElement ? 'Click the arena to look around' : '';
    last = 0;
  }
  function begin() {
    newRun(); setMode('play');
    if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
  }
  $('startBtn').addEventListener('click', begin);
  $('restartBtn').addEventListener('click', begin);
  $('resumeBtn').addEventListener('click', function () {
    setMode('play');
    if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
  });
  document.addEventListener('pointerlockchange', function () {
    if (MODE === 'play') $('hint').textContent = document.pointerLockElement ? '' : 'Click the arena to look around';
  });

  // ---------- simulation ----------
  function pushOut(o, radius) {
    for (var i = 0; i < obstacles.length; i++) {
      var ob = obstacles[i], dx = o.x - ob.x, dz = o.z - ob.z, d = Math.sqrt(dx * dx + dz * dz), min = ob.r + radius;
      if (d < min && d > 0.0001) { o.x = ob.x + dx / d * min; o.z = ob.z + dz / d * min; }
    }
    var r = Math.sqrt(o.x * o.x + o.z * o.z), lim = CFG.arenaR - radius;
    if (r > lim) { o.x *= lim / r; o.z *= lim / r; }
  }

  function step(dt) {
    var p = S.p, C = CFG.player;
    S.t += dt;

    // movement follows the camera on the ground plane only, so W never climbs or sinks
    var f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    var r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    var fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw); // camera forward on the ground
    var rx = -fz, rz = fx;                            // camera right
    var mx = fx * f + rx * r, mz = fz * f + rz * r, ml = Math.sqrt(mx * mx + mz * mz);
    if (ml > 0) { mx /= ml; mz /= ml; p.dx = mx; p.dz = mz; p.face = Math.atan2(mx, mz); }

    p.dashCd -= dt;
    if ((keys.ShiftLeft || keys.ShiftRight) && p.dashCd <= 0 && p.dash <= 0) { p.dash = C.dashTime; p.dashCd = C.dashCd; }
    if (p.dash > 0) { p.dash -= dt; p.x += p.dx * C.dashSpeed * dt; p.z += p.dz * C.dashSpeed * dt; }
    else if (ml > 0) { p.x += mx * C.speed * dt; p.z += mz * C.speed * dt; }

    if (keys.Space && p.onGround) { p.vy = C.jump; p.onGround = false; }
    p.vy -= C.gravity * dt; p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
    pushOut(p, C.radius);

    // spawning at a fixed rate
    S.spawnT -= dt;
    while (S.spawnT <= 0) {
      S.spawnT += CFG.spawn.every;
      var e = enemies.get();
      if (e) {
        var a = Math.random() * Math.PI * 2, o = { x: p.x + Math.cos(a) * CFG.spawn.ring, z: p.z + Math.sin(a) * CFG.spawn.ring };
        pushOut(o, CFG.enemy.radius);
        e.mesh.position.set(o.x, 0, o.z); e.hp = CFG.enemy.hp; e.atk = 0.4; e.flash = 0;
        e.mesh.userData.mat.color.setHex(0x5a6b4a); e.mesh.scale.set(1, 1, 1);
      }
    }

    // enemies chase, and hit on a cooldown that does not depend on frame rate
    var E = CFG.enemy, list = enemies.items, i, j;
    for (i = 0; i < list.length; i++) {
      var en = list[i]; if (!en.alive) continue;
      var ep = en.mesh.position, dx = p.x - ep.x, dz = p.z - ep.z, d = Math.sqrt(dx * dx + dz * dz) || 0.001;
      if (d > E.reach * 0.8) { ep.x += dx / d * E.speed * dt; ep.z += dz / d * E.speed * dt; }
      for (j = i + 1; j < list.length; j++) { // keep the pack from stacking into one spot
        var ot = list[j]; if (!ot.alive) continue;
        var op = ot.mesh.position, sx = ep.x - op.x, sz = ep.z - op.z, sd = sx * sx + sz * sz;
        if (sd < 1.7 && sd > 0.0001) { sd = Math.sqrt(sd); var push = (1.3 - sd) * 0.5; if (push > 0) { sx /= sd; sz /= sd; ep.x += sx * push; ep.z += sz * push; op.x -= sx * push; op.z -= sz * push; } }
      }
      pushOut(ep, E.radius);
      en.mesh.rotation.y = Math.atan2(dx, dz);
      en.mesh.position.y = Math.abs(Math.sin(S.t * 7 + i)) * 0.15;
      en.atk -= dt;
      if (d < E.reach && p.y < 1.6 && en.atk <= 0) { en.atk = E.attackCd; hurtPlayer(E.damage); if (MODE !== 'play') return; }
      if (en.flash > 0) { en.flash -= dt; if (en.flash <= 0) { en.mesh.userData.mat.color.setHex(0x5a6b4a); en.mesh.scale.set(1, 1, 1); } }
    }

    // Ember Wyvern: follows the duelist and fires at the nearest living enemy in range
    var W = CFG.wyvern, wy = S.wy;
    var tx = p.x + Math.cos(S.t * 1.4) * 1.8, tz = p.z + Math.sin(S.t * 1.4) * 1.8, ty = p.y + 2.3 + Math.sin(S.t * 3) * 0.2;
    var k = Math.min(1, dt * 6);
    wy.x += (tx - wy.x) * k; wy.y += (ty - wy.y) * k; wy.z += (tz - wy.z) * k;
    S.fireT -= dt;
    var near = null, nd = W.range * W.range;
    for (i = 0; i < list.length; i++) {
      if (!list[i].alive) continue;
      var q = list[i].mesh.position, qd = (q.x - wy.x) * (q.x - wy.x) + (q.z - wy.z) * (q.z - wy.z);
      if (qd < nd) { nd = qd; near = list[i]; }
    }
    if (near) {
      var nx = near.mesh.position.x - wy.x, nz = near.mesh.position.z - wy.z, nl = Math.sqrt(nx * nx + nz * nz) || 1;
      wyvernMesh.rotation.y = Math.atan2(nx, nz);
      if (S.fireT <= 0) {
        var s = shots.get();
        if (s) { S.fireT = W.cooldown; s.mesh.position.set(wy.x, 1.0, wy.z); s.vx = nx / nl * W.shotSpeed; s.vz = nz / nl * W.shotSpeed; s.life = W.shotLife; }
      }
    }

    // shots
    for (i = 0; i < shots.items.length; i++) {
      var sh = shots.items[i]; if (!sh.alive) continue;
      sh.life -= dt; sh.mesh.position.x += sh.vx * dt; sh.mesh.position.z += sh.vz * dt; sh.mesh.rotation.y += dt * 12;
      if (sh.life <= 0) { shots.kill(sh); continue; }
      for (j = 0; j < list.length; j++) {
        var t = list[j]; if (!t.alive) continue;
        var hx = t.mesh.position.x - sh.mesh.position.x, hz = t.mesh.position.z - sh.mesh.position.z;
        if (hx * hx + hz * hz < 1.0) { hitEnemy(t, W.damage, sh.vx, sh.vz); shots.kill(sh); break; }
      }
    }

    // XP crystals drift to the duelist when close
    for (i = 0; i < gems.items.length; i++) {
      var g = gems.items[i]; if (!g.alive) continue;
      var gp = g.mesh.position, gx = p.x - gp.x, gz = p.z - gp.z, gd = Math.sqrt(gx * gx + gz * gz) || 0.001;
      g.mesh.rotation.y += dt * 3;
      if (gd < CFG.xp.magnet) { gp.x += gx / gd * 14 * dt; gp.z += gz / gd * 14 * dt; }
      if (gd < CFG.xp.pick) { gems.kill(g); S.xp++; if (S.xp % CFG.xp.perLevel === 0) S.level++; }
    }

    if (S.flash > 0) S.flash -= dt;
  }

  function hitEnemy(e, dmg, vx, vz) {
    if (!e.alive) return;
    e.hp -= dmg;
    var l = Math.sqrt(vx * vx + vz * vz) || 1;
    e.mesh.position.x += vx / l * 0.6; e.mesh.position.z += vz / l * 0.6; // hit reaction: knock back, flash, squash
    e.flash = 0.12; e.mesh.userData.mat.color.setHex(0xffffff); e.mesh.scale.set(1.25, 0.8, 1.25);
    if (e.hp <= 0) {
      var pos = e.mesh.position;
      enemies.kill(e);            // removed from combat at once, so it can no longer deal damage
      S.kills++;                  // counted once: a dead enemy is skipped by every loop
      var g = gems.get();
      if (g) g.mesh.position.set(pos.x, 0.5, pos.z);
    }
  }

  function hurtPlayer(n) {
    S.p.hp = Math.max(0, S.p.hp - n);
    S.flash = 0.25;
    if (S.p.hp <= 0) {
      if (S.t > best) { best = S.t; try { localStorage.setItem('duelsummoner.best', String(best)); } catch (e) {} }
      $('dTime').textContent = clock(S.t); $('dKills').textContent = S.kills; $('dBest').textContent = clock(best);
      drawHud(true);
      setMode('dead'); // combat, the clock and spawning all stop because the simulation only steps in play
    }
  }

  // ---------- drawing ----------
  function clock(t) { var s = Math.floor(t); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var hudKey = '';
  function drawHud(force) {
    var key = Math.ceil(S.p.hp) + '|' + S.xp + '|' + Math.floor(S.t) + '|' + S.kills;
    if (!force && key === hudKey) return;
    hudKey = key;
    $('hpnum').textContent = Math.ceil(S.p.hp);
    $('hpbar').firstElementChild.style.width = (S.p.hp / CFG.player.hp * 100) + '%';
    $('xpnum').textContent = S.xp + '  LV ' + S.level;
    $('xpbar').firstElementChild.style.width = ((S.xp % CFG.xp.perLevel) / CFG.xp.perLevel * 100) + '%';
    $('clock').textContent = clock(S.t);
    $('kills').textContent = S.kills;
  }

  function render() {
    var p = S.p, C = CFG.cam;
    playerMesh.position.set(p.x, p.y, p.z);
    playerMesh.rotation.y = p.face;
    wyvernMesh.position.set(S.wy.x, S.wy.y, S.wy.z);
    wyvernMesh.userData.wings.rotation.z = Math.sin(S.t * 10) * 0.25;
    // orbit: yaw is free, pitch is clamped; the camera never drops under the floor
    var cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    var cx = p.x + Math.sin(S.yaw) * cp * C.dist, cz = p.z + Math.cos(S.yaw) * cp * C.dist, cy = p.y + C.height + sp * C.dist;
    camera.position.set(cx, Math.max(0.5, cy), cz);
    camera.lookAt(p.x, p.y + C.height, p.z);
    $('flash').style.opacity = S.flash > 0 ? Math.min(1, S.flash / 0.25) : 0;
    renderer.render(scene, camera);
  }

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (MODE === 'play') {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (dt > 0) step(dt);
      drawHud(false);
    }
    render();
  }

  newRun();
  requestAnimationFrame(frame);

  // test hooks: let an automated check read and drive the run without touching game rules
  window.__ds = {
    cfg: CFG,
    state: function () { return S; },
    mode: function () { return MODE; },
    counts: function () { return { enemies: enemies.count(), shots: shots.count(), gems: gems.count() }; },
    enemyPos: function () { return enemies.items.filter(function (e) { return e.alive; }).map(function (e) { return { x: e.mesh.position.x, z: e.mesh.position.z, hp: e.hp }; }); },
    gemPos: function () { return gems.items.filter(function (e) { return e.alive; }).map(function (e) { return { x: e.mesh.position.x, z: e.mesh.position.z }; }); },
    look: function (dx, dy) { look(dx, dy); },
    step: function (seconds) { for (var t = 0; t < seconds && MODE === 'play'; t += 1 / 60) step(1 / 60); drawHud(true); }
  };
})();
