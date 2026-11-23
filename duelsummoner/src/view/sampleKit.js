// The hand-built pieces of the Sunken Court sample: obelisk, boss ring, gateway frames, shut doors, statues, braziers and the gate. Flat faceted colour from the stage's own palette plus one gold; no textures.
// Every piece stands on cells the sim already blocks (see src/gen/sample.js), so what is drawn is what stops the duelist.
export function addSampleProps(B, map, look, H) {
  const { addBox, addCyl, addRing, mixc } = H, light = look.landmark[0], dark = look.landmark[1], stone = look.rim[1], mid = mixc(light, stone, 0.5), gold = 0xd9b24c, flameO = 0xff8a24, flameY = 0xffd24a;
  const box = (cx, cz, sx, sz, y0, y1, c) => addBox(B, { x0: cx - sx / 2, x1: cx + sx / 2, z0: cz - sz / 2, z1: cz + sz / 2, y0, h: y1, c });
  for (const p of map.props || []) {
    const x = p.x, z = p.z, y = p.y;
    if (p.t === 'obelisk') {
      box(x, z, 10, 10, y, y + 0.5, stone); box(x, z, 8, 8, y + 0.5, y + 1, mid); box(x, z, 6, 6, y + 1, y + 1.5, light);
      const S = [[4.0, 1.5, 3.6, light], [4.4, 3.6, 4.2, dark], [3.7, 4.2, 7.2, light], [4.1, 7.2, 7.8, dark], [3.4, 7.8, 10.8, light], [3.8, 10.8, 11.4, dark], [3.0, 11.4, 12.8, light], [2.2, 12.8, 13.3, gold], [1.5, 13.3, 13.65, gold], [0.9, 13.65, 13.9, gold], [0.4, 13.9, 14, gold]];
      for (const s of S) box(x, z, s[0], s[0], y + s[1], y + s[2], s[3]);
    } else if (p.t === 'ring') {
      addRing(B, { cx: x, cz: z, r0: p.r0, r1: p.r1, a0: 0, a1: 360, y0: y, h: y + 0.08, c: gold });
    } else if (p.t === 'frame') {                                   // two posts and a lintel standing on the wall over an opening
      const ax = p.along === 'x', o = p.w / 2 + p.pw / 2, sz = (a, b) => (ax ? [a, b] : [b, a]);
      for (const s of [-1, 1]) { const cx = ax ? x + s * o : x, cz = ax ? z : z + s * o, q = sz(p.pw, p.pd), q2 = sz(p.pw + 0.7, p.pd + 0.7);
        box(cx, cz, q[0], q[1], y, y + p.ph - 0.5, stone); box(cx, cz, q2[0], q2[1], y + p.ph - 0.5, y + p.ph, mid); }
      const L = sz(p.w + 2 * p.pw + 0.8, p.pd + 0.4), G = sz(p.w + 2 * p.pw + 0.8, p.pd + 0.7);
      box(x, z, L[0], L[1], y + p.ph, y + p.ph + 1.4, light); box(x, z, G[0], G[1], y + p.ph, y + p.ph + 0.3, gold);
    } else if (p.t === 'shutframe') {                               // two posts standing on the floor against the wall, a lintel, a gold trim: the frame of a door that does not open yet
      const ax = p.along === 'x', ox = ax ? 0 : p.nx * 0.5, oz = ax ? p.nz * 0.5 : 0, h = 9;
      for (const s of [-1, 1]) { const o = s * 8, cx = x + (ax ? o : 0) + ox, cz = z + (ax ? 0 : o) + oz, q = ax ? [2, 1] : [1, 2], q2 = ax ? [2.7, 1.7] : [1.7, 2.7];
        box(cx, cz, q[0], q[1], y, y + h - 0.6, stone); box(cx, cz, q2[0], q2[1], y + h - 0.6, y + h, mid); }
      const lx = x + ox, lz = z + oz, L = ax ? [18, 1.2] : [1.2, 18], G = ax ? [18, 1.5] : [1.5, 18];
      box(lx, lz, L[0], L[1], y + h, y + h + 1.2, light); box(lx, lz, G[0], G[1], y + h, y + h + 0.3, gold);
    } else if (p.t === 'door') {                                    // the shut door: a dark panel between the posts, a gold seam down its middle, a pale arch over it
      const ax = p.along === 'x', ox = ax ? 0 : p.nx * 0.3, oz = ax ? p.nz * 0.3 : 0, sx = ax ? p.w : 0.5, sz = ax ? 0.5 : p.w;
      box(x + ox, z + oz, sx, sz, y, y + 7.4, dark); box(x + ox, z + oz, sx, sz, y + 7.4, y + 8.0, mid);
      box(x + ox * 2.1, z + oz * 2.1, ax ? 0.4 : 0.2, ax ? 0.2 : 0.4, y, y + 7.4, gold);
    } else if (p.t === 'statue') {                                  // a carved blocky guardian, 10 m tall, spear in the right hand; faces +z when face = 1
      const f = p.face || 1, X = (dx) => x + dx, Zf = (d) => z + d * f;
      box(x, z, 4.0, 4.0, y, y + 1.6, stone); box(x, z, 3.4, 3.4, y + 1.6, y + 2.0, mid);
      for (const s of [-1, 1]) box(X(s * 0.9), z, 1.3, 1.4, y + 2.0, y + 4.6, light);
      box(x, z, 3.1, 1.8, y + 4.6, y + 5.4, dark); box(x, z, 2.8, 1.8, y + 5.4, y + 8.0, light); box(x, Zf(0.95), 1.4, 0.2, y + 6.0, y + 7.2, gold);
      box(x, z, 4.2, 1.9, y + 7.6, y + 8.6, stone);
      for (const s of [-1, 1]) box(X(s * 2.55), z, 0.9, 0.9, y + 4.8, y + 7.8, light);
      box(x, z, 1.5, 1.5, y + 8.6, y + 10.0, light); box(x, Zf(0.8), 1.1, 0.2, y + 9.2, y + 9.5, dark); box(x, z, 0.5, 1.7, y + 10.0, y + 10.5, dark);
      box(X(2.55), Zf(0.55), 0.4, 0.4, y + 2.0, y + 11.0, mid); box(X(2.55), Zf(0.55), 0.8, 0.8, y + 11.0, y + 11.8, gold);
    } else if (p.t === 'brazier') {
      box(x, z, 1.0, 1.0, y, y + 0.9, stone); box(x, z, 1.5, 1.5, y + 0.9, y + 1.3, dark);
      addCyl(B, { x, z, r: 0.55, y0: y + 1.3, h: y + 2.4, c: flameO }); addCyl(B, { x, z, r: 0.3, y0: y + 1.3, h: y + 3.0, c: flameY });
    } else if (p.t === 'gate') {                                    // two pylons 12 m tall, a lintel, and the sealed door with a gold card plate
      for (const s of [-1, 1]) { box(x + s * 8, z, 4, 4, y, y + 12, stone); box(x + s * 8, z, 4.8, 4.8, y + 12, y + 12.8, mid); box(x + s * 8, z, 4.2, 4.2, y, y + 1.2, dark); }
      box(x, z, 24, 4.4, y + 12.8, y + 14.2, light); box(x, z, 24, 4.7, y + 12.8, y + 13.1, gold);
      box(x, z - 3.5, 12, 1, y, y + 8, dark); box(x, z - 3.5, 12, 1, y + 8, y + 8.6, mid); box(x, z - 3.0, 0.5, 0.2, y, y + 8, gold); box(x, z - 3.0, 2.6, 0.2, y + 3, y + 6, gold);
    }
  }
}
