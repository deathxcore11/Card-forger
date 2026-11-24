// The "A seal cracks..." banners: one per crack, the first 1.2 s after the crack and each further one waiting 2.6 s behind the one before it (so they never replace each other).
// The queue empties as the banners show, and clear() drops everything still waiting (the run ended or a menu opened).
export function sealToasts(show, timers = { set: (f, ms) => setTimeout(f, ms), clear: id => clearTimeout(id) }) {
  let pending = [];
  return {
    crack() { const n = pending.length; const id = timers.set(() => { pending = pending.filter(x => x !== id); show(n % 2 ? 'Another seal cracks...' : 'A seal cracks...'); }, 1200 + n * 2600); pending.push(id); return id; },
    clear() { for (const id of pending) timers.clear(id); pending = []; },
    waiting() { return pending.length; }
  };
}
