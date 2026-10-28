// Planeswalk inside the app: sideways, full screen and awake for the whole run, with the phone's own
// haptics and a Back that returns to Play (the run saves itself). Planeswalk is its own page, so this
// loads Capacitor's core next to it; the page itself is the website's, unchanged.
(() => {
  const core = document.createElement('script');
  core.src = '__CAPACITOR_CORE__';
  core.onload = () => {
    const cap = globalThis.Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const display = cap.registerPlugin('CardStashyDisplay'), haptics = cap.registerPlugin('CardStashyHaptics');
    const play = () => { display.setMode({ mode: 'play' }).catch(() => {}); };
    play();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });
    // Planeswalk's hits call navigator.vibrate; the phone plays its own effect instead.
    const effect = pattern => { const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + (+b || 0), 0) : +pattern || 0; return ms >= 60 ? 'warn' : ms >= 25 ? 'success' : 'tap'; };
    try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pattern => { if (pattern) haptics.perform({ effect: effect(pattern) }).catch(() => {}); return true; } }); } catch {}
    globalThis.cardstashyBack = () => { location.href = '/#play'; return true; };
  };
  document.head.append(core);
})();
