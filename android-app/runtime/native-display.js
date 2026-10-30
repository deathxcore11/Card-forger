// A Forge match takes the whole screen: no system bars, screen kept awake, phone turned sideways (Play
// setup still follows the phone; the table turns it the moment Start is pressed and the match loads).
// Everything else gives the bars and the phone's own rotation back. The app marks an open match with
// body.practice-table-open.
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
