// Only literal first-party AI paths may receive the profile session token.
const AI_PATHS = new Set(['/api/ai/ask', '/api/ai/deck-review', '/api/ai/matchup', '/api/ai/identify-card']);
let readToken = async () => '';
let accountRequests = new AbortController();
// Called synchronously at the account boundary, not on same-account token refresh.
export function invalidateAiAuth() {
  accountRequests.abort();
  accountRequests = new AbortController();
}
export function configureAiAuth(getToken) { readToken = getToken; }
// Whether a signed-in profile can use AI at all. The server stays the authority;
// this only lets the scanner skip a request that would be refused anyway.
export async function hasAiSession() { try { const token = await readToken(); return typeof token === 'string' && token.length > 0; } catch { return false; } }
export const AI_SIGN_IN_MESSAGE = 'Sign in to your CardStashy profile to use AI, then try again. Your cards and drafts are still here.';
function sessionOrAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}
export async function aiFetch(path, options, fetcher = fetch) {
  if (!AI_PATHS.has(path) || options?.method !== 'POST') throw Error('Unsupported AI request.');
  const signal = AbortSignal.any([accountRequests.signal, ...(options.signal ? [options.signal] : [])]);
  signal.throwIfAborted();
  let token = '';
  try { token = await sessionOrAbort(readToken(), signal); } catch { /* The server remains the authority. */ }
  signal.throwIfAborted();
  const headers = new Headers(options.headers);
  headers.delete('Authorization');
  if (typeof token === 'string' && token) headers.set('Authorization', 'Bearer ' + token);
  // Redirects must never carry profile credentials to another endpoint/origin.
  const response = await fetcher(path, { ...options, headers, signal, redirect: 'error' });
  signal.throwIfAborted();
  const result = response.status === 401 ? Response.json({ code: 'sign_in_required', message: AI_SIGN_IN_MESSAGE }, { status: 401 }) : response;
  // Also fence delayed body parsing (including mocks that ignore fetch abort).
  const json = result.json.bind(result);
  result.json = async () => { signal.throwIfAborted(); const data = await json(); signal.throwIfAborted(); return data; };
  return result;
}
