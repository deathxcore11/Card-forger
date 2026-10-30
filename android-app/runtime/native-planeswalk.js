// Planeswalk inside the app: full screen, awake and sideways (landscape, like the card battlers on
// phones) for the whole run, with the phone's own
// haptics and a Back that returns to Play (the run saves itself). Planeswalk is its own page, so this
// loads Capacitor's core next to it; the page itself is the website's, unchanged.
(() => {
  const core = document.createElement('script');
  core.src = '__CAPACITOR_CORE__';
  core.onload = () => {
    const cap = globalThis.Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const display = cap.registerPlugin('CardStashyDisplay'), haptics = cap.registerPlugin('CardStashyHaptics');
    let orientation = 'landscape';
    const play = () => { display.setMode({ mode: 'play' }).catch(() => {}); display.setOrientation({ orientation }).catch(() => {}); };
    // The page can turn the lock off and on itself ('landscape' or 'default'); leaving for the app
    // hands rotation back, since the app's own display sync sets 'default' outside a match.
    globalThis.PWNative = Object.freeze({ native: true, setOrientation(next) {
      if (next !== 'landscape' && next !== 'default') return Promise.reject(new Error('Unknown orientation'));
      orientation = next; return display.setOrientation({ orientation }).then(() => true);
    } });
    globalThis.dispatchEvent(new Event('pwnative-ready'));
    play();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });
    // Planeswalk's hits call navigator.vibrate; the phone plays its own effect instead.
    const effect = pattern => { const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + (+b || 0), 0) : +pattern || 0; return ms >= 60 ? 'warn' : ms >= 25 ? 'success' : 'tap'; };
    try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pattern => { if (pattern) haptics.perform({ effect: effect(pattern) }).catch(() => {}); return true; } }); } catch {}
    globalThis.cardstashyBack = () => { location.href = '/#play'; return true; };
  };
  document.head.append(core);
})();
