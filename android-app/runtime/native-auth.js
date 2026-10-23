// The SDK owns PKCE verifier generation/storage. This module never logs URLs/codes/tokens.
export const AUTH_CALLBACK = 'https://cardstashy.com/auth/android/callback';
export const AUTH_STORAGE_KEY = 'cardstashy-native-supabase-v1';
const PENDING = 'cardstashy-native-auth-pending-v1';
const TTL = 30 * 60 * 1000;
export function parseAuthCallback(raw) {
  if (typeof raw !== 'string' || raw.length > 8192 || /[\\\s\u0000-\u001f\u007f]/.test(raw)) return null;
  let u; try { u = new URL(raw); } catch { return null; }
  if (u.origin !== 'https://cardstashy.com' || u.pathname !== '/auth/android/callback' || u.username || u.password || u.hash || u.port) return null;
  if (!raw.startsWith(AUTH_CALLBACK + '?')) return null;
  const keys = [...u.searchParams.keys()];
  if (keys.some(k => !['code','error','error_code','error_description'].includes(k)) || new Set(keys).size !== keys.length) return null;
  if (u.searchParams.has('error')) return u.searchParams.has('code') ? null : { error: true };
  const code = u.searchParams.get('code');
  return code && /^[A-Za-z0-9._~-]{1,2048}$/.test(code) ? { code } : null;
}
export function createNativeAuth({ plugin, storage, enabled = false, now = Date.now, report = () => {} }) {
  let client, accountId = () => null, accountVersion = () => null, exchangeFactory, onRecovery = () => {}, busy = false, exchanging = false, attached = false, queuedCallback = null, admission = null;
  // The supported SDK storage adapter is the final synchronous mutation fence.
  // A pre-setSession check alone misses its internal lock and /user awaits.
  const sessionStorage = Object.freeze({
    getItem: key => storage.getItem(key),
    setItem: (key, value) => {
      if (key === AUTH_STORAGE_KEY && admission && !admission()) throw Error('Account changed before session commit.');
      storage.setItem(key, value);
    },
    removeItem: key => storage.removeItem(key),
  });
  const pending = () => { try { const p = JSON.parse(storage.getItem(PENDING)); return p && p.v === 1 && ['oauth','email','signup','recovery'].includes(p.kind) && Number.isFinite(p.at) && now() >= p.at && now() - p.at < TTL ? p : null; } catch { return null; } };
  const clear = () => { storage.removeItem(PENDING); storage.removeItem(AUTH_STORAGE_KEY + '-code-verifier'); };
  const assertIdle = () => { if (busy) throw Error('An account operation is finishing. Please wait.'); };
  const release = () => { busy = false; const raw = queuedCallback; queuedCallback = null; if (raw) queueMicrotask(() => { void receive(raw); }); };
  const cancel = () => { assertIdle(); queuedCallback = null; clear(); };
  const begin = kind => {
    if (!enabled) throw Error('Online accounts are awaiting native release verification.');
    assertIdle();
    if (!['oauth','email','signup','recovery'].includes(kind)) throw Error('Unknown authentication flow.');
    if (pending()) throw Error('A sign-in link is already pending. Finish it or cancel before starting another.');
    clear(); storage.setItem(PENDING, JSON.stringify({ v: 1, kind, at: now(), owner: accountId() }));
    return AUTH_CALLBACK;
  };
  async function run(kind, action) {
    begin(kind); busy = true;
    try { const result = await action(); if (result?.session) clear(); return result; }
    catch (error) { clear(); throw error; }
    finally { release(); }
  }
  // Every primary-client auth mutation uses this guard, not just OAuth initiation.
  async function transition(action) {
    if (!enabled) throw Error('Online accounts are awaiting native release verification.');
    assertIdle(); busy = true; queuedCallback = null; clear();
    try { return await action(); } finally { clear(); release(); }
  }
  async function receive(raw) {
    const callback = parseAuthCallback(raw);
    if (!enabled || !callback || !client) return false;
    if (busy) { if (!exchanging && pending()) queuedCallback = raw; return false; }
    const flow = pending();
    if (!flow || flow.owner !== accountId()) { clear(); report('This sign-in link is no longer pending. Request a new link.'); return false; }
    storage.removeItem(PENDING);
    if (callback.error) { clear(); report('Sign-in was not completed. Please try again.'); return false; }
    busy = true; exchanging = true;
    const owner = accountId(), version = accountVersion();
    const unchanged = () => owner === accountId() && version === accountVersion();
    let isolated, memory;
    try {
      if (!exchangeFactory) throw Error('Isolated exchange unavailable');
      // Exchange MUST NOT run on the primary client: the SDK saves a session and
      // emits SIGNED_IN before its promise resolves. A posthoc owner check is too late.
      const key = 'cardstashy-native-exchange-' + crypto.randomUUID();
      memory = new Map();
      const verifier = storage.getItem(AUTH_STORAGE_KEY + '-code-verifier');
      if (!verifier) throw Error('Missing verifier');
      memory.set(key + '-code-verifier', verifier);
      const ephemeralStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) };
      isolated = exchangeFactory({ storage: ephemeralStorage, storageKey: key });
      const { data, error } = await isolated.auth.exchangeCodeForSession(callback.code);
      if (error || !data?.session || !unchanged()) throw Error('Stale or failed exchange');
      // No local owner-changing transition can start while busy. This is the only
      // point a verified result may be adopted by the primary SDK/shared cloud.
      admission = unchanged;
      const adopted = await client.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      if (adopted.error) throw Error('Session adoption failed');
      if (flow.kind === 'recovery') onRecovery();
      report(flow.kind === 'recovery' ? 'Reset link accepted. Choose your new password.' : 'Sign-in completed.');
      return true;
    } catch { report('This sign-in link could not be completed. Request a new link.'); return false; }
    finally { admission = null; try { await isolated?.auth.dispose(); } catch {} memory?.clear(); clear(); exchanging = false; release(); }
  }
  return Object.freeze({
    callback: AUTH_CALLBACK, storageKey: AUTH_STORAGE_KEY, sessionStorage, begin, run, cancel, receive, transition, assertIdle,
    async attach(authClient, getAccountId, options = {}) {
      if (attached) throw Error('Native auth is already attached');
      attached = true; client = authClient; accountId = getAccountId;
      accountVersion = options.accountVersion || (() => null); exchangeFactory = options.exchangeFactory; onRecovery = options.onRecovery || (() => {});
      await plugin.addListener('authCallback', event => { void receive(event?.url); });
      const launch = await plugin.takeLaunchCallback();
      if (launch?.url) await receive(launch.url);
    },
    async google() {
      return run('oauth', async () => {
        const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true } });
        if (error || !data?.url) throw Error('Could not start browser sign-in.');
        const u = new URL(data.url);
        if (u.origin !== 'https://noxfmbwuytnbvfgukpiv.supabase.co' || u.pathname !== '/auth/v1/authorize' || u.username || u.password || u.hash || u.searchParams.get('redirect_to') !== AUTH_CALLBACK || u.searchParams.get('code_challenge_method') !== 's256' || !u.searchParams.get('code_challenge')) throw Error('Unexpected sign-in destination.');
        await plugin.openAuth({ url: u.href });
      });
    },
    async resend(action) {
      assertIdle(); const flow = pending(), version = accountVersion();
      if (!enabled || !flow || flow.kind !== 'signup' || flow.owner !== accountId() || !storage.getItem(AUTH_STORAGE_KEY + '-code-verifier')) throw Error('Start account signup on this device before resending confirmation.');
      busy = true;
      try { const result = await action(); if (flow.owner !== accountId() || version !== accountVersion()) throw Error('Account changed during resend.'); return result; }
      catch (error) { clear(); throw error; }
      finally { release(); }
    },
  });
}
