# Re-deflates every compressed APK entry with Zopfli (same bytes inside, ~5% smaller file) so the
# APK stays under Cloudflare's 25 MiB per-asset limit. Usage: python3 zopfli-repack.py in.apk out.apk,
# then zipalign -f -p 4 and apksigner sign (v2 only, --min-sdk-version 24). Needs: pip install zopfli.
import sys, zipfile, zlib
from zopfli.zopfli import compress as zc
src, dst = sys.argv[1], sys.argv[2]
class Z:
    def __init__(self): self.buf = []
    def compress(self, d): self.buf.append(d); return b''
    def flush(self):
        d = b"".join(self.buf); raw = zc(d, numiterations=8)[2:-4]
        assert zlib.decompress(raw, -15) == d
        return raw
orig = zipfile._get_compressor
zipfile._get_compressor = lambda t, l=None: Z() if t == zipfile.ZIP_DEFLATED else orig(t, l)
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w') as zout:
    for i in zin.infolist():
        if i.filename.startswith('META-INF/') and i.filename.split('/')[-1].split('.')[-1] in ('SF','RSA','EC','MF'): continue
        n = zipfile.ZipInfo(i.filename, date_time=i.date_time); n.compress_type = i.compress_type; n.external_attr = i.external_attr
        zout.writestr(n, zin.read(i))
