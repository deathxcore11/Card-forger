// The sim's only input: one small quantised record per 1/60 s tick, so a run can be recorded to a tape and replayed bit for bit.
//   mx: right  -127..127   mz: forward -127..127   (int8)
//   yaw: camera yaw in 1024 steps of 0.35 degrees (0..1023 = 0..2pi; coarse on purpose so replays stay small)
//   buttons: bit 1 jump, bit 2 dash, bit 4 slide, bit 8 use
//   menu: 0 none, 1..4 take card, 10 redraw, 11 pass, 12 leave, 21..24 banish card (level-up, chest, altar, shop, pause choices)

export const BTN_JUMP = 1, BTN_DASH = 2, BTN_SLIDE = 4, BTN_USE = 8, BTN_HOLD = 16, BTN_REVERT = 32, BTN_FLIP = 64, BTN_GRAB = 128, BTN_GRIND = 256, BTN_SPIN_L = 512, BTN_SPIN_R = 1024, BTN_KB = 2048;       // (the feel pass added the trick buttons; older tapes have them all clear)
// Menu codes: 1..4 take card 1..4 (old tapes), 30..49 take card 0..19 (Altar offers can hold 11 cards), 10 redraw, 11 pass, 12 leave, 21..24 banish card 1..4.
export const takeCode = i => (i < 4 ? 1 + i : 30 + i);
export const MENU_TAKE = 1, MENU_REDRAW = 10, MENU_PASS = 11, MENU_LEAVE = 12, MENU_BANISH = 20;
const TWO_PI = 6.283185307179586;

export function emptyRecord() { return { mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 }; }

const q8 = v => { const i = Math.round(v * 127); return i > 127 ? 127 : i < -127 ? -127 : i; };

// From the browser/bot style command { f, r, yaw, jump, dash, slide, use, menu } to a record.
export function quantise(c, out) {
  out = out || emptyRecord();
  if (c.mx !== undefined) { out.mx = c.mx; out.mz = c.mz; out.yaw = c.yaw; out.buttons = c.buttons; out.menu = c.menu | 0; return out; }   // already a record
  out.mx = q8(c.r || 0); out.mz = q8(c.f || 0);
  let y = (c.yaw || 0) / TWO_PI; y -= Math.floor(y);
  out.yaw = Math.floor(y * 1024) & 1023;
  out.buttons = (c.jump ? BTN_JUMP : 0) | (c.dash ? BTN_DASH : 0) | (c.slide ? BTN_SLIDE : 0) | (c.use ? BTN_USE : 0) | (c.hold ? BTN_HOLD : 0) | (c.revert ? BTN_REVERT : 0) | (c.flip ? BTN_FLIP : 0) | (c.grab ? BTN_GRAB : 0) | (c.grind ? BTN_GRIND : 0) | ((c.spin || 0) < 0 ? BTN_SPIN_L : 0) | ((c.spin || 0) > 0 ? BTN_SPIN_R : 0) | (c.kb ? BTN_KB : 0);
  out.menu = c.menu | 0;
  return out;
}

// Record to the movement command the player code reads.
export function decode(rec, out) {
  out = out || {};
  out.r = rec.mx / 127; out.f = rec.mz / 127; out.yaw = rec.yaw * (TWO_PI / 1024);
  out.jump = (rec.buttons & BTN_JUMP) !== 0; out.dash = (rec.buttons & BTN_DASH) !== 0; out.slide = (rec.buttons & BTN_SLIDE) !== 0; out.use = (rec.buttons & BTN_USE) !== 0; out.hold = (rec.buttons & BTN_HOLD) !== 0;
  const b = rec.buttons; out.revert = (b & BTN_REVERT) !== 0; out.flip = (b & BTN_FLIP) !== 0; out.grab = (b & BTN_GRAB) !== 0; out.grind = (b & BTN_GRIND) !== 0; out.spin = (b & BTN_SPIN_R ? 1 : 0) - (b & BTN_SPIN_L ? 1 : 0); out.kb = (b & BTN_KB) !== 0;
  return out;
}



