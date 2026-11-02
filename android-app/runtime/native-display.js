// A match (any mode: Quick Play, Practice, Story, friends) takes the whole screen like a handheld game:
// no system bars, screen kept awake, always landscape (the table turns it the moment Start is pressed
// and the match loads). Everything else gives the bars back and the app's own orientation: portrait on a
// phone-sized screen, landscape on tablets and on handhelds (the native side decides). A foldable is never
// turned: folded or open, it follows however it is held (Randall, 2 Nov), and the layout adapts.
// The app marks an open match with body.practice-table-open.
export function installNativeDisplay({ plugin, root = document.body } = {}) {
  let current = null;
  const sync = () => {
    const mode = root.classList.contains('practice-table-open') ? 'play' : 'app';
    if (mode === current) return;
    current = mode;
    plugin.setMode({ mode }).catch(() => { current = null; });
    plugin.setOrientation?.({ orientation: mode === 'play' ? 'landscape' : 'default' }).catch(() => { current = null; });
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  sync();
  return () => observer.disconnect();
}
