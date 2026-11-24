import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sealToasts } from '../src/view/sealtoast.js';

const fake = () => { const q = []; let id = 0; return { q, set: (f, ms) => { q.push({ id: ++id, f, ms }); return id; }, clear: i => { const k = q.findIndex(x => x.id === i); if (k >= 0) q.splice(k, 1); }, fire: i => { const k = q.findIndex(x => x.id === i); const [t] = q.splice(k, 1); t.f(); } }; };

test('seal toasts: the first waits 1.2 s, each further one 2.6 s behind; the delay restarts once the queue has emptied (no growth over a session)', () => {
  const t = fake(), shown = [], s = sealToasts(m => shown.push(m), t);
  s.crack(); s.crack(); assert.deepEqual(t.q.map(x => x.ms), [1200, 3800]);
  t.fire(t.q[0].id); t.fire(t.q[0].id); assert.deepEqual(shown, ['A seal cracks...', 'Another seal cracks...']); assert.equal(s.waiting(), 0);
  for (let i = 0; i < 6; i++) { s.crack(); assert.equal(t.q[0].ms, 1200, 'crack number ' + (i + 3) + ' of the session still waits 1.2 s'); t.fire(t.q[0].id); }
});

test('seal toasts: clear() drops every waiting banner, so none fires on the results screen or in a menu', () => {
  const t = fake(), shown = [], s = sealToasts(m => shown.push(m), t); s.crack(); s.crack(); s.clear(); assert.equal(t.q.length, 0); assert.equal(s.waiting(), 0); assert.deepEqual(shown, []);
  s.crack(); assert.equal(t.q[0].ms, 1200, 'a new crack after a clear starts fresh');
});
