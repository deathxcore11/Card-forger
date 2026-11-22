// Leaderboard client. The service address is never built in: it comes from ?board=<url> or the saved setting boardUrl, so with neither
// the game plays offline exactly as before. The stand-in player id (x-ds-user) is replaced by the Supabase token in the live build.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* optional */ } }
};
export function boardUrl(settings) {
  let q = null; try { q = new URLSearchParams(location.search).get('board'); } catch (e) { /* no page */ }
  const u = q || (settings && settings.boardUrl) || null; return u ? String(u).replace(/\/+$/, '') : null;
}
export function playerId() { let id = store.get('duelsummoner.boardId'); if (!id) { id = 'p' + Math.random().toString(36).slice(2, 12); store.set('duelsummoner.boardId', id); } return id; }
export function playerName() {
  let q = null; try { q = new URLSearchParams(location.search).get('name'); } catch (e) { /* no page */ }
  if (q) store.set('duelsummoner.boardName', q.slice(0, 24)); return store.get('duelsummoner.boardName') || 'Duelist';
}
const hdr = () => ({ 'content-type': 'application/json', 'x-ds-user': playerId() });
export async function submitRun(base, record) { const r = await fetch(base + '/ds/runs', { method: 'POST', headers: hdr(), body: JSON.stringify({ record, name: playerName() }) }); return r.json(); }
export async function runStatus(base, id) { return (await fetch(base + '/ds/runs/' + id, { headers: hdr() })).json(); }
export async function fetchBoard(base, map, difficulty, period) { return (await fetch(base + '/ds/board?map=' + map + '&difficulty=' + difficulty + '&period=' + period, { headers: hdr() })).json(); }
// submit, then follow the status until it settles; onText gets each plain-words line ("Score sent, checking it", then "Verified, #3 on the board")
export async function sendAndFollow(base, record, onText, wait = ms => new Promise(r => setTimeout(r, ms))) {
  try {
    const s = await submitRun(base, record); if (s.error) return onText('Score not sent: ' + s.error);
    onText(s.message || 'Score sent, checking it');
    for (let i = 0; i < 40; i++) {
      await wait(i < 5 ? 1500 : 6000); const st = await runStatus(base, s.id);
      if (st.status === 'verified') return onText('Verified. You placed #' + st.placing + ' of all time' + (st.weekPlacing ? ' and #' + st.weekPlacing + ' this week' : '') + '.');
      if (st.status === 'rejected') return onText('Score rejected: ' + ((st.why || [])[0] || 'the check failed') + '.');
    }
    onText('Still checking. It will show on the board when it is done.');
  } catch (e) { onText('Could not reach the leaderboard. Your score is saved on this device.'); }
}
