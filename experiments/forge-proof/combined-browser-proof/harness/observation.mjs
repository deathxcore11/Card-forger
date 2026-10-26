// LOCAL FIXTURE ONLY: passive copies of bytes already forwarded by the fixture.
// No dependency on service-core, native transport, storage, timers or game rules.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MATCH = new RegExp('^/api/play/matches/(' + UUID + ')$');
const OBSERVE = new RegExp('^/__fixture/observe/(' + UUID + ')$');
const UUID_RE = new RegExp('^' + UUID + '$');
const NO_CAPTURE = Object.freeze({ chunk() {}, complete() {} });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const headers = value => value instanceof Headers ? value : new Headers(value);
const reply = (status, body) => ({ status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body });
export class FixtureObservationCache {
  #records = new Map();
  #sequence = 0;
  constructor({ bearer, maximumRecords = 4, maximumBytes = 4 * 1024 * 1024 }) {
    if (typeof bearer !== 'string' || !bearer || !Number.isInteger(maximumRecords) || maximumRecords < 1 || maximumRecords > 4
      || !Number.isInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 4 * 1024 * 1024) throw TypeError('bounded fixture observation required');
    this.authorization = 'Bearer ' + bearer; this.maximumRecords = maximumRecords; this.maximumBytes = maximumBytes;
  }
  capture({ method, url, headers: requestHeaders, httpStatus, response }) {
    const target = new URL(url), route = MATCH.exec(target.pathname);
    if (method !== 'GET' || !route || target.search || target.hash || headers(requestHeaders).get('Authorization') !== this.authorization) return NO_CAPTURE;
    const matchId = route[1]; let chunks = [], length = 0, finished = false, complete = false, invalid = false, pending;
    const commit = () => {
      if (!finished || !complete || invalid || !pending) return;
      const previous = this.#records.get(matchId);
      // A late initial/pending/error response cannot erase the real retained
      // outcome. DELETE is never captured; terminal survives its cleanup.
      if (previous?.generation === pending.generation && previous.body.status === 'finished' && pending.body.status !== 'finished') { pending = null; return; }
      this.#records.delete(matchId);
      this.#records.set(matchId, { fixtureOnly: true, matchId, generation: pending.generation,
        sequence: ++this.#sequence, httpStatus, body: pending.body });
      pending = null;
      while (this.#records.size > this.maximumRecords) this.#records.delete(this.#records.keys().next().value);
    };
    response.once('finish', () => { finished = true; commit(); });
    response.once('close', () => { if (!finished) { invalid = true; chunks = []; pending = null; } });
    response.once('error', () => { if (!finished) { invalid = true; chunks = []; pending = null; } });
    return {
      chunk: bytes => {
        if (invalid || complete) return;
        length += bytes.byteLength;
        if (length > this.maximumBytes) { invalid = true; chunks = []; return; }
        chunks.push(Buffer.from(bytes));
      },
      complete: () => {
        if (invalid || complete) return; complete = true;
        try {
          const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, length)));
          chunks = [];
          if (!plain(body) || body.matchId !== undefined && body.matchId !== matchId) return;
          // For delivered transport errors without identity, reuse ONLY a
          // generation previously established by this exact delivered route.
          const generation = body.generation ?? this.#records.get(matchId)?.generation;
          if (typeof generation !== 'string' || !UUID_RE.test(generation)) return;
          pending = { generation, body }; commit();
        } catch { invalid = true; chunks = []; }
      },
    };
  }
  observe({ method, url, headers: requestHeaders }) {
    const incoming = headers(requestHeaders);
    if (incoming.get('Authorization') !== this.authorization) return reply(401, { error: 'fixture_authorization_required' });
    if (method !== 'GET') return reply(405, { error: 'fixture_observation_get_only' });
    const target = new URL(url), route = OBSERVE.exec(target.pathname);
    if (target.search || target.hash || [...incoming.keys()].some(key => /seat|viewer|player/i.test(key))) return reply(400, { error: 'fixture_view_selector_forbidden' });
    if (!route) return reply(404, { error: 'fixture_observation_not_found' });
    const matchId = route[1], expected = incoming.get('X-Fixture-Generation'), record = this.#records.get(matchId);
    if (expected !== null && (!UUID_RE.test(expected) || !record || expected !== record.generation)) return reply(404, { error: 'fixture_generation_mismatch' });
    if (!record) return reply(202, { fixtureOnly: true, matchId, status: 'waiting' });
    return reply(200, structuredClone(record));
  }
}
