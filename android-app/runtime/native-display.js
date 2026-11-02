import { installFoldPrompt } from './native-fold-prompt.js';

// A match (any mode: Quick Play, Practice, Story, friends) takes the whole screen like a handheld game:
// no system bars, screen kept awake, always landscape (the table turns it the moment Start is pressed
// and the match loads). Everything else gives the bars back and the app's own orientation: portrait on a
// phone-sized screen, landscape unfolded, on tablets and on handhelds (the native side decides). A folded
// foldable is asked to open when a match starts. The app marks an open match with body.practice-table-open.
export function installNativeDisplay({ plugin, root = document.body } = {}) {
  let current = null;
  const fold = installFoldPrompt({ plugin, playing: () => current === 'play' });
  const sync = () => {
    const mode = root.classList.contains('practice-table-open') ? 'play' : 'app';
    if (mode === current) return;
    current = mode;
    fold.check();
    plugin.setMode({ mode }).catch(() => { current = null; });
    plugin.setOrientation?.({ orientation: mode === 'play' ? 'landscape' : 'default' }).catch(() => { current = null; });
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  sync();
  return () => observer.disconnect();
}
