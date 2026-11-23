// The Settings rows as data (menus-spec section 9). Each row: id, tab, label, kind, choices, def (per device class; null = the row is not shown on that class), optional section and show(ctx).
// ctx = { cls: 'phone'|'thor'|'portal'|'pc', pad, dual, gyro, keyboard, signedIn, inRun, values }. Defaults are resolved at read time (defaultFor), so a default that changes later reaches everyone who never touched the row.
export const CLASSES = ['phone', 'thor', 'portal', 'pc'];
export const TABS = ['game', 'display', 'controls', 'sound', 'access', 'account'];
const all = v => ({ phone: v, thor: v, portal: v, pc: v });
const R = (id, tab, label, kind, choices, def, extra) => Object.assign({ id, tab, label, kind, choices, def, section: null, show: null, greyInRun: false }, extra || {});
const seg = (id, tab, label, choices, def, extra) => R(id, tab, label, 'segmented', choices, def, extra);
const sld = (id, tab, label, lo, hi, step, def, extra) => R(id, tab, label, 'slider', { lo, hi, step }, def, extra);
const sw = (id, tab, label, def, extra) => R(id, tab, label, 'switch', [true, false], def, extra);

export const ROWS = [
  // ---- Game ----
  sld('fov', 'game', 'Field of view', 80, 115, 5, all(100)),
  seg('camDistance', 'game', 'Camera distance', ['near', 'standard', 'far'], all('standard')),
  seg('camAssist', 'game', 'Camera assist', ['off', 'gentle', 'strong'], { phone: 'gentle', thor: 'off', portal: 'off', pc: 'off' }),
  seg('damageNumbers', 'game', 'Damage numbers', ['off', 'big', 'all'], { phone: 'big', thor: 'all', portal: 'all', pc: 'all' }),
  sld('camShake', 'game', 'Screen shake', 0, 100, 10, all(80)),
  seg('monsterAim', 'game', 'Monster aim', ['balanced', 'nearest', 'strongest'], all('balanced'), { greyInRun: true }),
  seg('mapSize', 'game', 'Map overlay size', ['small', 'medium', 'large'], all('medium'), { show: c => !(c.cls === 'thor' && c.dual) }),
  seg('mapOrientation', 'game', 'Map orientation', ['turns', 'north'], { phone: 'turns', thor: 'north', portal: 'turns', pc: 'turns' }),
  sw('hints', 'game', 'Hints', all(true)),
  R('quickSetup', 'game', 'Run quick setup again', 'action', null, all(null), { greyInRun: true }),
  // ---- Display ----
  seg('performance', 'display', 'Performance', ['battery', 'balanced', 'performance'], { phone: 'balanced', thor: 'performance', portal: 'performance', pc: 'performance' }),
  seg('frameRate', 'display', 'Frame rate', [30, 60, 90, 120, 'match'], { phone: 60, thor: 120, portal: 120, pc: 'match' }),
  R('renderScale', 'display', 'Render scale', 'plate', ['auto', 100, 85, 70, 50], { phone: 'auto', thor: 'auto', portal: 'auto', pc: 100 }),
  seg('detail', 'display', 'Detail', ['low', 'medium', 'high'], { phone: 'medium', thor: 'high', portal: 'high', pc: 'high' }),
  sld('hudSize', 'display', 'HUD size', 80, 130, 5, all(100)),
  sw('dualScreen', 'display', 'Dual screen', { phone: null, thor: true, portal: null, pc: null }),
  sld('edgePadding', 'display', 'Edge padding', 0, 64, 8, { phone: 0, thor: null, portal: null, pc: null }),
  seg('batteryHeat', 'display', 'Battery and heat', ['off', 'quicklook', 'always'], { phone: 'quicklook', thor: 'quicklook', portal: 'quicklook', pc: null }),
  sw('fullScreen', 'display', 'Full screen', { phone: null, thor: null, portal: null, pc: false }),
  // ---- Controls ----
  seg('slideMode', 'controls', 'Slide', ['hold', 'toggle'], all('hold'), { section: 'all' }),
  R('glyphs', 'controls', 'Button glyphs', 'plate', ['auto', 'letters', 'shapes', 'swapped', 'plain'], all('auto'), { section: 'controller' }),
  seg('confirmButton', 'controls', 'Confirm button', ['match', 'choose'], all('match'), { section: 'controller' }),
  seg('stickLayout', 'controls', 'Stick layout', ['standard', 'swapped'], all('standard'), { section: 'controller' }),
  R('buttonMap', 'controls', 'Button map and test', 'action', null, all(null), { section: 'controller' }),
  sld('lookSpeed', 'controls', 'Look speed', 1, 10, 1, all(5), { section: 'controller' }),
  seg('lookEasing', 'controls', 'Look easing', ['off', 'light', 'smooth'], all('light'), { section: 'controller' }),
  seg('invertLook', 'controls', 'Invert look', ['none', 'vertical', 'horizontal', 'both'], all('none'), { section: 'controller' }),
  R('deadZone', 'controls', 'Stick dead zone', 'plate', ['auto', 4, 8, 12, 16, 20], all('auto'), { section: 'controller' }),
  sld('vibration', 'controls', 'Vibration', 0, 100, 10, all(70), { section: 'controller' }),
  sw('gyroLook', 'controls', 'Gyro look', all(false), { section: 'controller', show: c => !!c.gyro }),
  sld('gyroSpeed', 'controls', 'Gyro speed', 1, 10, 1, all(5), { section: 'controller', show: c => !!c.gyro && !!c.values && c.values.gyroLook === true }),
  seg('onScreenControls', 'controls', 'On-screen controls', ['auto', 'always', 'off'], { phone: 'auto', thor: null, portal: 'off', pc: null }, { section: 'touch' }),
  seg('moveStick', 'controls', 'Move stick', ['floating', 'fixed'], { phone: 'floating', thor: null, portal: 'floating', pc: null }, { section: 'touch', show: c => !(c.values && c.values.onScreenControls === 'off') }),
  sld('controlSize', 'controls', 'Control size', 70, 140, 10, { phone: 100, thor: null, portal: 100, pc: null }, { section: 'touch', show: c => !(c.values && c.values.onScreenControls === 'off') }),
  sld('controlOpacity', 'controls', 'Control opacity', 20, 100, 10, { phone: 60, thor: null, portal: 60, pc: null }, { section: 'touch', show: c => !(c.values && c.values.onScreenControls === 'off') }),
  sld('dragLook', 'controls', 'Drag look speed', 1, 10, 1, { phone: 5, thor: null, portal: 5, pc: null }, { section: 'touch', show: c => !(c.values && c.values.onScreenControls === 'off') }),
  sw('tapToUse', 'controls', 'Tap to use', { phone: true, thor: true, portal: true, pc: null }, { section: 'touch' }),
  sw('touchHaptics', 'controls', 'Touch haptics', { phone: true, thor: false, portal: false, pc: null }, { section: 'touch' }),
  sld('mouseLook', 'controls', 'Mouse look speed', 1, 10, 1, { phone: null, thor: null, portal: null, pc: 5 }, { section: 'kbm' }),
  sw('invertMouse', 'controls', 'Invert mouse vertical', { phone: null, thor: null, portal: null, pc: false }, { section: 'kbm' }),
  R('keyBindings', 'controls', 'Key bindings', 'action', null, { phone: null, thor: null, portal: null, pc: null }, { section: 'kbm', show: c => c.cls === 'pc' || !!c.keyboard }),
  R('resetControls', 'controls', 'Reset controls', 'danger', null, all(null), { section: 'reset' }),
  // ---- Sound ----
  sld('volMaster', 'sound', 'Master', 0, 100, 5, all(80)), sld('volMusic', 'sound', 'Music', 0, 100, 5, all(70)), sld('volBattle', 'sound', 'Battle', 0, 100, 5, all(80)),
  sld('volRewards', 'sound', 'Rewards', 0, 100, 5, all(50)), sld('volInterface', 'sound', 'Interface', 0, 100, 5, all(60)), sld('volWorld', 'sound', 'World', 0, 100, 5, all(60)),
  // ---- Access ----
  seg('textSize', 'access', 'Text size', ['standard', 'large', 'largest'], all('standard')),
  sw('reduceMotion', 'access', 'Reduce motion', all(false)),
  sw('reduceFlashing', 'access', 'Reduce flashing', all(false)),
  seg('spellEffects', 'access', 'Spell effects', ['full', 'soft'], all('full')),
  seg('colourAssist', 'access', 'Colour assist', ['off', 'redgreen', 'blueyellow', 'contrast'], all('off')),
  seg('leyThread', 'access', 'Ley thread', ['subtle', 'normal', 'strong'], all('normal')),
  seg('holdConfirm', 'access', 'Hold to confirm', ['hold', 'twice'], all('hold')),
  sw('monoAudio', 'access', 'Mono audio', all(false)),
  seg('bigMoments', 'access', 'Big moments', ['full', 'gentle'], all('full')),       // Full is the default; Gentle skips the impact frames, the Tablebreak shift and the boss-fall flash, and halves hit-stop. Reduce motion forces Gentle.
  sw('duelistMarker', 'access', 'Duelist marker', all(true)),       // a small marker over the duelist when the effects are heavy
  // ---- Account ----
  R('profile', 'account', 'Profile', 'action', null, all(null)),
  sw('postRuns', 'account', 'Post runs to leaderboards', all(true), { show: c => !!c.signedIn }),
  seg('showAs', 'account', 'Show on boards as', ['nameAvatar', 'name'], all('nameAvatar'), { show: c => !!c.signedIn }),
  sw('shareReplays', 'account', 'Share my top runs as replays', all(true), { show: c => !!c.signedIn }),
  R('cloudSave', 'account', 'Cloud save', 'action', null, all(null), { show: c => !!c.signedIn }),
  R('credits', 'account', 'Credits', 'action', null, all(null)),
  R('resetProgress', 'account', 'Reset Duel Summoner progress', 'danger', null, all(null), { greyInRun: true }),
  R('version', 'account', 'Version', 'caption', null, all(null))
];
export const ROW_BY_ID = Object.fromEntries(ROWS.map(r => [r.id, r]));
// the default at read time: undefined (not shown) is null in the table; action rows and captions have no value
export function defaultFor(id, cls) { const r = ROW_BY_ID[id]; return r ? r.def[cls] : undefined; }
export function valueOf(id, cls, overrides) { const o = overrides || {}; return id in o ? o[id] : defaultFor(id, cls); }
const rowsKind = new Set(['action', 'danger', 'caption']);
// the rows to draw on a tab, in order. A row with a null default on this class is not shown, except action, danger and caption rows, which show wherever their own rule says.
export function visibleRows(tab, ctx) {
  const c = Object.assign({ cls: 'phone', pad: false, dual: true, gyro: false, keyboard: false, signedIn: false, inRun: false, values: {} }, ctx || {});
  return ROWS.filter(r => {
    if (r.tab !== tab) return false;
    if (r.kind !== 'action' && r.kind !== 'danger' && r.kind !== 'caption' && r.def[c.cls] === null) return false;
    if (r.id === 'quickSetup' || r.id === 'buttonMap' || r.id === 'profile' || r.id === 'credits') { /* always shown where their section is */ }
    if (r.id === 'keyBindings' && !(c.cls === 'pc' || c.keyboard)) return false;
    if (r.section === 'controller' && !(c.pad || c.cls === 'thor' || c.cls === 'portal')) return false;
    if (r.section === 'kbm' && !(c.cls === 'pc' || c.keyboard)) return false;
    if (r.section === 'touch' && c.cls === 'pc') return false;
    if (r.section === 'touch' && r.def[c.cls] === null) return false;
    if (r.show && !r.show(c)) return false;
    return true;
  });
}
export { rowsKind };
