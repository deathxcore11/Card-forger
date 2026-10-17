// Default suite checks the migration contract. Optional integration runs the actual
// SQL in a disposable in-memory PostgreSQL (PGlite), never a connected project:
// CARDSTASHY_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node test-server-safety-history-sql.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const migrationName = readdirSync('supabase/migrations').find(name => name.endsWith('_bound_history_registration.sql'));
assert.ok(migrationName);
const migration = readFileSync('supabase/migrations/' + migrationName, 'utf8');
for (const table of ['market_watch', 'price_watch']) assert.match(migration, new RegExp(`lock table public\\.${table} in share row exclusive mode`, 'i'));
for (const signature of ['register_market_watch(text,text,text,text,text)', 'register_price_watch(text,text[])']) {
  assert.ok(migration.includes(`revoke all on function public.${signature} from public, anon, authenticated`));
  assert.ok(migration.includes(`grant execute on function public.${signature} to service_role`));
}
assert.equal((migration.match(/security invoker/gi) || []).length, 3, 'comment + both RPCs preserve invoker permissions');
assert.doesNotMatch(migration, /security definer/i);
assert.match(migration, /history_registration_limits enable row level security/i);
assert.match(migration, /used >= 60/); assert.match(migration, /used \+ needed > 300/);
assert.match(migration, /count\(\*\) from public\.market_watch\) >= 3000/);
assert.match(migration, /w\.game = g\) \+ needed > 10000/);
assert.match(migration, /interval '120 days'/); assert.match(migration, /current_date - 120/);
console.log('PASS: history registration SQL has transaction locks, finite per-game/global caps, bounded rates, expiration and service-only invoker RPCs.');
if (process.env.CARDSTASHY_PGLITE_MODULE) {
  const { PGlite } = await import(pathToFileURL(process.env.CARDSTASHY_PGLITE_MODULE).href);
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(readFileSync('supabase/migrations/20261013000000_price_history.sql', 'utf8'));
    await db.exec(readFileSync('supabase/market-history.sql', 'utf8'));
    // Supabase's service role already has these table rights; the fixture is a bare Postgres.
    await db.exec('grant all on public.price_watch to service_role;');
    await db.exec(migration);
    const query = async (sql, args = []) => (await db.query(sql, args)).rows;
    const market = async id => (await query("select public.register_market_watch('ptcg',$1,'normal','Card','base1') as result", [id]))[0].result;
    const legacy = async (game, ids) => (await query('select public.register_price_watch($1,$2) as result', [game, ids]))[0].result;
    const count = async table => Number((await query('select count(*) as n from public.' + table))[0].n);
    const clear = async () => { await db.exec('reset role; truncate public.market_watch, public.price_watch, public.history_registration_limits; set role service_role;'); };
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await query(`select has_function_privilege('${role}', 'public.register_market_watch(text,text,text,text,text)', 'execute') as allowed`))[0].allowed, false);
      assert.equal((await query(`select has_function_privilege('${role}', 'public.register_price_watch(text,text[])', 'execute') as allowed`))[0].allowed, false);
      await db.exec('set role ' + role);
      await assert.rejects(market('denied'), /permission denied/);
      await assert.rejects(query('select * from public.history_registration_limits'), /permission denied/);
      await db.exec('reset role');
    }
    await clear();
    const minuteResults = await Promise.all(Array.from({ length: 61 }, (_, i) => market('rate-' + i)));
    assert.equal(minuteResults.filter(x => x === 'registered').length, 60);
    assert.equal(minuteResults.filter(x => x === 'rate_limited').length, 1);
    assert.equal(await count('market_watch'), 60);
    assert.equal(await market('rate-0'), 'registered', 'existing watches refresh without consuming new-registration rate');
    await clear();
    await db.exec("insert into public.market_watch(game,card_id,finish,name) select 'ptcg','seed-'||n,'normal','Card' from generate_series(1,2999) n;");
    const lastSlot = await Promise.all([market('last-a'), market('last-b')]);
    assert.deepEqual(lastSlot.sort(), ['capacity', 'registered']); assert.equal(await count('market_watch'), 3000);
    await db.exec("update public.market_watch set touched_at=now()-interval '121 days' where card_id='seed-1';");
    assert.equal(await market('reclaim'), 'registered'); assert.equal(await count('market_watch'), 3000);
    await assert.rejects(query("select public.register_market_watch('mtg','fake','foil','Card','set')"), /invalid watch/);
    await clear();
    const ids = Array.from({ length: 300 }, (_, i) => String(i + 1));
    assert.equal(await legacy('ygo', ids), 'registered');
    assert.equal(await legacy('ygo', ['301']), 'rate_limited');
    assert.equal(await legacy('ygo', ['1', '1']), 'registered'); assert.equal(await count('price_watch'), 300);
    assert.equal((await query("select registrations from public.history_registration_limits where bucket='legacy:ygo'"))[0].registrations, 300);
    await assert.rejects(legacy('ptcg', ['base1-1']), /invalid watch/);
    await assert.rejects(legacy('mtg', ['not-a-uuid']), /invalid watch/);
    await assert.rejects(legacy('ygo', []), /invalid watch/);
    await assert.rejects(legacy('ygo', [null]), /invalid watch/);
    await clear();
    await db.exec("insert into public.price_watch(game,card_id) select 'ygo',n::text from generate_series(1,9999) n;");
    const finalLegacy = await Promise.all([legacy('ygo', ['10000']), legacy('ygo', ['10001'])]);
    assert.deepEqual(finalLegacy.sort(), ['capacity', 'registered']); assert.equal(await count('price_watch'), 10000);
    const mtg = '00000000-0000-4000-8000-000000000001';
    assert.equal(await legacy('mtg', [mtg]), 'registered', 'one full game does not consume another game capacity/rate');
    await db.exec("update public.price_watch set last_seen=current_date-121 where game='ygo' and card_id='1';");
    assert.equal(await legacy('ygo', ['10002']), 'registered', 'expired watch capacity is reclaimed');
    console.log('PASS: actual SQL in disposable PostgreSQL: service-role writes, anonymous denials, concurrent final-slot caps, rate boundaries, duplicates and stale-watch reclamation.');
  } finally { await db.close(); }
} else console.log('INFO: optional disposable PostgreSQL integration not run; set CARDSTASHY_PGLITE_MODULE to a local PGlite module.');
