// Set the browser-local color mode before the first stylesheet is painted.
// Keep this small classic script in <head>; the full controls live in settings-theme.js.
(() => {
  let theme = 'dark';
  try { const saved = localStorage.getItem('cardstashy-theme'); if (['light','dark','aura'].includes(saved)) theme = saved; } catch {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f5f8' : '#0f1115');
})();
