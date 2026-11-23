// Device class for the menus (menus-spec 2.1, the part the DOM needs): ?device=phone|thor|portal|pc wins; else a coarse-pointer screen under 600 px on its short side is a phone; everything else is PC.
export function deviceClass(win) {
  const w = win || (typeof window !== 'undefined' ? window : null); if (!w) return 'pc';
  const q = w.__deviceClass || new URLSearchParams(w.location.search).get('device'); if (q === 'phone' || q === 'thor' || q === 'portal' || q === 'pc') return q;
  const coarse = ('ontouchstart' in w) || (w.navigator.maxTouchPoints || 0) > 0 || (typeof w.matchMedia === 'function' && w.matchMedia('(pointer:coarse)').matches);
  return coarse && Math.min(w.innerWidth, w.innerHeight) < 600 ? 'phone' : 'pc';
}
