// SPDX-License-Identifier: GPL-3.0-or-later
// Local-only workerd fixture. Imports production service unchanged; never starts
// a provider/container and never performs real account verification.
import { DurableObject } from 'cloudflare:workers';
import { AdmissionService, ORIGIN } from '../host/src/service-core.mjs';

const OWNER = '00000000-0000-4000-8000-000000000001';
function equal(actual, expected, message) {
  if (actual !== expected) throw Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function delegate(target, overrides = {}) {
  return new Proxy(target, { get(object, key) {
    if (Object.hasOwn(overrides, key)) return overrides[key];
    const value = Reflect.get(object, key, object);
    return typeof value === 'function' ? value.bind(object) : value;
  } });
}

export class SQLiteAlarmCase extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.storage = ctx.storage;
    // Keep test alarms in the future without sleeping or overriding real storage.
    this.clock = Date.now() + 600_000;
    this.beginCalls = 0;
    this.caseId = ctx.id.toString();
    this.service = this.makeService(this.storage);
    this.race = null;
  }
  makeService(storage) {
    return new AdmissionService({
      ctx: { storage }, now: () => this.clock,
      verifyBearer: async () => ({ id: OWNER, is_anonymous: false }),
      native: { ready: true },
      env: {
        FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: OWNER,
        FORGE_TRIAL_EXPIRES_AT: new Date(this.clock + 86_400_000).toISOString(),
        FORGE_MATCHES: { getByName: () => ({
          begin: async () => { this.beginCalls++; throw Error('local fixture: no provider exists'); },
          reconcile: async () => {},
          destructionProof: async generation => ({ generation, confirmed: false }),
        }) },
      },
    });
  }
  create(service = this.service, valid = true) {
    const deck = { format: 'Standard', cards: [{ name: 'Transport fixture only', qty: 60 }], side: [] };
    return service.fetch(new Request(ORIGIN + '/api/play/matches', {
      method: 'POST', headers: { Origin: ORIGIN, Authorization: 'Bearer synthetic-local',
        'Content-Type': 'application/json', 'Idempotency-Key': 'sqlite_alarm_fixture_0001' },
      body: JSON.stringify(valid ? { format: 'Standard', humanDeck: deck, opponentDeck: deck,
        difficultyPolicyVersion: 'fixture-no-engine' } : {}),
    }));
  }
  alarm() { return this.service.alarm(); }
  async checkCase(name) {
    // Fails if this class was accidentally configured with legacy KV storage.
    equal(this.storage.sql.exec('SELECT 1 AS sqlite_probe').one().sqlite_probe, 1, 'SQLite backend');
    if (name === 'invalid-preserves-earlier') {
      await this.storage.setAlarm(this.clock + 10_000);
      equal((await this.create(this.service, false)).status, 400, 'invalid create');
      equal(await this.storage.getAlarm(), this.clock + 10_000, 'earlier alarm preserved');
      equal(await this.storage.get('leases'), undefined, 'no allocation from invalid input');
      equal(this.beginCalls, 0, 'no provider start');
    } else if (name === 'new-wakeup' || name === 'advance-maintenance' || name === 'valid-preserves-equal') {
      if (name === 'advance-maintenance') await this.storage.setAlarm(this.clock + 3_600_000);
      if (name === 'valid-preserves-equal') await this.storage.setAlarm(this.clock + 60_000);
      equal((await this.create()).status, 202, 'valid synthetic admission');
      equal(await this.storage.getAlarm(), this.clock + 60_000, 'one minute admission wakeup');
      equal((await this.storage.get('leases')).length, 1, 'one provisional lease');
      equal(this.beginCalls, 1, 'only synthetic begin');
    } else if (name === 'transaction-rollback') {
      const prior = this.clock + 3_600_000;
      await this.storage.setAlarm(prior);
      const storage = delegate(this.storage, {
        transaction: fn => this.storage.transaction(txn => fn(delegate(txn, {
          setAlarm: async at => {
            await txn.put('rollback-marker', true);
            await txn.setAlarm(at);
            throw Error('injected-after-real-transactional-alarm-write');
          },
        }))),
      });
      let failure;
      try { await this.create(this.makeService(storage)); } catch (error) { failure = error; }
      equal(failure?.message, 'injected-after-real-transactional-alarm-write', 'failure propagated');
      equal(await this.storage.getAlarm(), prior, 'SQLite rolled back alarm');
      equal(await this.storage.get('rollback-marker'), undefined, 'SQLite rolled back sibling write');
      equal(await this.storage.get('leases'), undefined, 'no reservation after failed scheduling');
      equal(await this.storage.get('trial-budget'), undefined, 'no budget reservation');
      equal(this.beginCalls, 0, 'no begin after failed scheduling');
    } else throw Error('unknown case');
    return { case: name, pass: true, backend: 'workerd SQLite', providerCalls: 0, accountCalls: 0 };
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/race/start') {
      equal(this.race, null, 'race only starts once');
      let resolveGate;
      const gate = new Promise(resolve => { resolveGate = resolve; });
      this.race = { phase: 'starting', resolveGate, result: null };
      let receiptLists = 0;
      const storage = delegate(this.storage, {
        list: async options => {
          if (options?.prefix === 'create:' && ++receiptLists === 2) {
            // Pause after the service observed no leases/rates but before its
            // final receipt read. A separate real DO fetch event admits a lease.
            this.race.phase = 'paused-before-housekeeping';
            await gate;
          }
          return this.storage.list(options);
        },
      });
      this.race.done = this.makeService(storage).alarm().then(async () => {
        equal((await this.storage.get('leases')).length, 1, 'concurrent admission survived');
        equal(await this.storage.getAlarm(), this.clock + 60_000, 'hourly housekeeping preserved earlier wakeup');
        equal(this.beginCalls, 1, 'no repeated begin');
        this.race.phase = 'finished';
        this.race.result = { case: 'concurrent-maintenance-admission', pass: true,
          backend: 'workerd SQLite', distinctFetchEvents: true, providerCalls: 0, accountCalls: 0 };
      });
      this.ctx.waitUntil(this.race.done);
      return Response.json({ phase: this.race.phase });
    }
    if (url.pathname === '/race/status') return Response.json({ phase: this.race?.phase });
    if (url.pathname === '/race/create') {
      equal(this.race?.phase, 'paused-before-housekeeping', 'maintenance paused');
      equal((await this.create()).status, 202, 'concurrent synthetic admission');
      equal(await this.storage.getAlarm(), this.clock + 60_000, 'admission scheduled early wakeup');
      return Response.json({ pass: true });
    }
    if (url.pathname === '/race/resume') {
      this.race.resolveGate(); await this.race.done;
      return Response.json(this.race.result);
    }
    return Response.json(await this.checkCase(url.searchParams.get('case')));
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const name = url.pathname.startsWith('/race/') ? 'race' : url.searchParams.get('case');
    return env.CASES.getByName(name).fetch(request);
  },
};
