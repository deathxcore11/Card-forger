// The current Android beta download. Settings links to it and the Worker forwards links to any
// earlier APK here, so a page cached before an update never offers a file that is gone.
import {RELEASE} from './release-record.js';
export const ANDROID_BETA = RELEASE.android;
export const ANDROID_BETA_OLD_APK = /^\/downloads\/cardstashy-android-beta-\d+\.\d+\.\d+\.apk$/;

// Cloudflare serves a static file only up to 25 MiB, so a larger APK is committed in parts next to its
// download path (href + '.part1', '.part2', ...) and the Worker streams them back as the one file.
// Reached only when no single file sits at that path. The parts are byte ranges of the signed APK, so
// the download is exactly the file the release record sizes and hashes.
export async function androidBetaDownload(request, env) {
  if (!['GET', 'HEAD'].includes(request.method) || !env?.ASSETS) return null;
  const part = n => env.ASSETS.fetch(new Request(new URL(`${ANDROID_BETA.href}.part${n}`, request.url)));
  const first = await part(1);
  if (!first.ok) { await first.body?.cancel(); return null; }
  const headers = { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': String(ANDROID_BETA.bytes),
    'Content-Disposition': `attachment; filename="${ANDROID_BETA.href.split('/').pop()}"`, 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' };
  if (request.method === 'HEAD') { await first.body?.cancel(); return new Response(null, { headers }); }
  const { readable, writable } = typeof FixedLengthStream === 'function' ? new FixedLengthStream(ANDROID_BETA.bytes) : new TransformStream();
  (async () => {
    try {
      let n = 1, response = first;
      while (response.ok) { await response.body.pipeTo(writable, { preventClose: true }); response = await part(++n); }
      await response.body?.cancel();
      await writable.close();
    } catch (error) { await writable.abort(error).catch(() => {}); }
  })();
  return new Response(readable, { headers });
}
