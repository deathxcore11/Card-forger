// Prompt text from the sim never names a key: it carries {use} where the action's button goes, and the view says which button (menus-spec 3.3, step 6).
export const USE_WORD = { touch: 'Tap', pad: 'X', keys: 'E' };
export function keyWords(s, mode) { return String(s).split('{use}').join(USE_WORD[mode] || USE_WORD.keys); }
