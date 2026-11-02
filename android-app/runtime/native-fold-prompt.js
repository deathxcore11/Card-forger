// Games run sideways like a handheld. On a folded foldable that means the small outer screen, so when a
// game starts there the app asks once to open it; unfolding clears the card by itself and the game
// carries on full size. "Play folded" keeps going on the outer screen. A plain phone never sees this.
const STYLE = `
.cs-fold{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(6,8,12,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-family:inherit;color:#f3ead6;animation:cs-fold-in .22s ease-out}
.cs-fold[hidden]{display:none}
.cs-fold-card{display:grid;justify-items:center;gap:14px;max-width:min(360px,100%);padding:22px 26px;border-radius:18px;background:linear-gradient(180deg,rgba(32,34,42,.92),rgba(16,17,22,.94));box-shadow:inset 0 0 0 1px rgba(226,190,112,.38),0 18px 48px rgba(0,0,0,.55)}
.cs-fold-icon{width:72px;height:56px;color:#e2be70}
.cs-fold-icon .cs-fold-flap{transform-origin:36px 28px;animation:cs-fold-open 1.6s ease-in-out infinite alternate}
.cs-fold h2{margin:0;font-size:20px;font-weight:700;letter-spacing:.01em;text-align:center}
.cs-fold button{min-width:44px;min-height:44px;padding:0 22px;border:0;border-radius:999px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(226,190,112,.45);color:#f3ead6;font:inherit;font-size:15px;font-weight:600}
@keyframes cs-fold-in{from{opacity:0}}
@keyframes cs-fold-open{from{transform:scaleX(.18)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.cs-fold,.cs-fold-icon .cs-fold-flap{animation:none}}`;

export function installFoldPrompt({ plugin, playing = () => false, doc } = {}) {
  if (typeof plugin?.getScreen !== 'function') return { check() {} };
  doc ||= globalThis.document;
  let screen = { folded: false }, dismissed = false, card = null, wasPlaying = false;
  const build = () => {
    const style = doc.createElement('style'); style.textContent = STYLE; doc.head.append(style);
    card = doc.createElement('div');
    card.className = 'cs-fold'; card.hidden = true;
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'cs-fold-title');
    card.innerHTML = '<div class="cs-fold-card"><svg class="cs-fold-icon" viewBox="0 0 72 56" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><rect x="10" y="6" width="26" height="44" rx="4"/><rect class="cs-fold-flap" x="36" y="6" width="26" height="44" rx="4"/></svg><h2 id="cs-fold-title">Open your foldable</h2><button type="button">Play folded</button></div>';
    card.querySelector('button').addEventListener('click', () => { dismissed = true; check(); });
    doc.body.append(card);
  };
  const check = () => {
    const now = !!playing();
    if (now && !wasPlaying) dismissed = false; // each new game asks again
    wasPlaying = now;
    const show = now && screen.folded && !dismissed;
    if (show && !card) build();
    if (card) card.hidden = !show;
  };
  const read = next => { if (next && typeof next === 'object') screen = next; check(); };
  plugin.getScreen().then(read).catch(() => {});
  plugin.addListener?.('screen', read)?.catch?.(() => {});
  return { check };
}
