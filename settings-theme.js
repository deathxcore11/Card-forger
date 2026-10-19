// Appearance belongs to this browser, not the signed-in collection workspace.
// Never save a theme through the account store or trigger an inventory sync.
export const THEME_KEY = 'cardstashy-theme';
export const SETTINGS_TABS = Object.freeze([
  ['account', 'Account'], ['recovery', 'Recovery'],
  ['info', 'App Help & Info'], ['app', 'App Settings']
]);
const storageDefault = () => { try { return globalThis.localStorage; } catch { return null; } };
export const normalizeTheme = value => ['light','dark','aura'].includes(value) ? value : 'dark';
export function readTheme(storage = storageDefault()) {
  try { return normalizeTheme(storage?.getItem(THEME_KEY)); } catch { return 'dark'; }
}
export function applyTheme(value, {document = globalThis.document, storage = storageDefault(), persist = true} = {}) {
  const theme = normalizeTheme(value);
  let saved = !persist;
  if (persist) try { if (storage) { storage.setItem(THEME_KEY, theme); saved = true; } } catch {}
  const root = document?.documentElement;
  if (root) { root.dataset.theme = theme; root.style.colorScheme = theme === 'light' ? 'light' : 'dark'; }
  document?.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f5f8' : '#0f1115');
  for (const control of document?.querySelectorAll('[data-change="setTheme"]') || []) control.checked = control.value === theme;
  return {theme, saved};
}
export function initTheme({document = globalThis.document, storage = storageDefault(), window = globalThis.window} = {}) {
  applyTheme(readTheme(storage), {document, storage, persist:false});
  const onStorage = event => {
    if ((event.key === THEME_KEY || event.key === null) && (!event.storageArea || event.storageArea === storage)) {
      applyTheme(readTheme(storage), {document, storage, persist:false});
    }
  };
  window?.addEventListener('storage', onStorage);
  return () => window?.removeEventListener('storage', onStorage);
}
export function themeSettings({document = globalThis.document, storage = storageDefault()} = {}) {
  const theme = normalizeTheme(document?.documentElement?.dataset.theme || readTheme(storage));
  return `<section class="panel settings-card settings-appearance"><div class="settings-card-heading"><div><p class="eyebrow">APPEARANCE</p><h2>Make it feel like you</h2></div></div><fieldset class="settings-theme"><legend>Color mode</legend><div class="settings-theme-options">${[['light','Light','Bright, soft surfaces'],['dark','Dark','The familiar night view'],['aura','Aura','Soft color from the art you explore']].map(([id,label,description]) => `<label class="settings-theme-choice"><input id="settingsTheme-${id}" name="settingsTheme" type="radio" value="${id}" data-change="setTheme" ${theme === id ? 'checked' : ''}><span class="settings-theme-swatch settings-theme-swatch-${id}" aria-hidden="true"><i></i><i></i><i></i></span><span><b>${label}</b><small>${description}</small></span></label>`).join('')}</div></fieldset><p class="foot">Applies to all three games on this device. Your cards, artwork and account sync stay unchanged.</p></section>`;
}
export const normalizeSettingsTab = tab => tab === 'backup' ? 'recovery' : SETTINGS_TABS.some(([id]) => id === tab) ? tab : 'account';
export function settingsTabs(tab) {
  tab = normalizeSettingsTab(tab);
  return `<nav class="settings-tabs" role="tablist" aria-label="Settings sections" aria-orientation="horizontal">${SETTINGS_TABS.map(([id,label]) => `<button type="button" id="settingsTab-${id}" role="tab" aria-controls="settings-${id}" aria-selected="${id === tab}" tabindex="${id === tab ? 0 : -1}" data-act="settingsTab" data-id="${id}">${label}</button>`).join('')}</nav>`;
}
export function activateSettingsTab(root, id) {
  const tab = normalizeSettingsTab(id);
  for (const pane of root.querySelectorAll('.settings-pane')) pane.hidden = pane.id !== 'settings-' + tab;
  for (const button of root.querySelectorAll('[data-act="settingsTab"][role="tab"]')) {
    const selected = button.dataset.id === tab;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    // Scroll only the horizontal rail, never the underlying game or dialog page.
    if (selected) {
      const rail = button.parentElement;
      if (rail && rail.scrollWidth > rail.clientWidth) {
        const left = button.offsetLeft, right = left + button.offsetWidth;
        if (left < rail.scrollLeft) rail.scrollLeft = left;
        else if (right > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = right - rail.clientWidth;
      }
    }
  }
  return tab;
}
