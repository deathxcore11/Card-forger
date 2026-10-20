// Set the browser-local color mode before the first stylesheet is painted.
// Keep this small classic script in <head>; the full controls live in settings-theme.js.
(() => {
  let theme = 'dark';
  try { const saved = localStorage.getItem('cardstashy-theme'); if (['light','dark','aura'].includes(saved)) theme = saved; } catch {}
  let grid='medium',pinch='off';
  try { const saved=localStorage.getItem('cardstashy-grid-size');if(['small','medium','large'].includes(saved))grid=saved;pinch=localStorage.getItem('cardstashy-grid-pinch')==='on'?'on':'off'; }catch{}
  document.documentElement.dataset.gridSize=grid;document.documentElement.dataset.gridPinch=pinch;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f5f8' : '#0f1115');
})();
