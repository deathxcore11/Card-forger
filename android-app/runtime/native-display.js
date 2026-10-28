// A Forge match takes the whole screen: no system bars, screen kept awake. Everything else gives the
// bars back. The app marks an open match with body.practice-table-open.
export function installNativeDisplay({ plugin, root = document.body } = {}) {
  let current = null;
  const sync = () => {
    const mode = root.classList.contains('practice-table-open') ? 'play' : 'app';
    if (mode === current) return;
    current = mode;
    plugin.setMode({ mode }).catch(() => { current = null; });
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  sync();
  return () => observer.disconnect();
}
