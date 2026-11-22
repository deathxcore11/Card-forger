// The sim's only input: one small quantised record per 1/60 s tick, so a run can be recorded to a tape and replayed bit for bit.
//   mx: right  -127..127   mz: forward -127..127   (int8)
//   yaw: camera yaw as uint16 turns (0..65535 = 0..2pi)
//   buttons: bit 1 jump, bit 2 dash, bit 4 slide, bit 8 use
//   menu: 0 none, 1..4 take card, 10 redraw, 11 pass, 12 leave, 21..24 banish card (level-up, chest, altar, shop, pause choices)

export const BTN_JUMP = 1, BTN_DASH = 2, BTN_SLIDE = 4, BTN_USE = 8;
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
  out.yaw = Math.floor(y * 65536) & 65535;
  out.buttons = (c.jump ? BTN_JUMP : 0) | (c.dash ? BTN_DASH : 0) | (c.slide ? BTN_SLIDE : 0) | (c.use ? BTN_USE : 0);
  out.menu = c.menu | 0;
  return out;
}

// Record to the movement command the player code reads.
export function decode(rec, out) {
  out = out || {};
  out.r = rec.mx / 127; out.f = rec.mz / 127; out.yaw = rec.yaw * (TWO_PI / 65536);
  out.jump = (rec.buttons & BTN_JUMP) !== 0; out.dash = (rec.buttons & BTN_DASH) !== 0; out.slide = (rec.buttons & BTN_SLIDE) !== 0; out.use = (rec.buttons & BTN_USE) !== 0;
  return out;
}

