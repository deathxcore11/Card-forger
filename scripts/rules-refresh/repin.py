#!/usr/bin/env python3
"""Move every pin of the Forge rules-data bundle to a newly refreshed bundle.

A rules refresh (deploy/forge-host/scripts/refresh-rules-data.py) changes the bundle's
files, version, dates and hashes. The host, its tests and the proof harness pin those
values, and other files pin the sha256 of the pinning files. This tool:
  1. copies the new bundle over every copy of the old one in the tree,
  2. replaces each old bundle value (version, source, hashes, as-of and expiry dates and
     the day before the as-of date, which the tests use as clocks) with the new one,
  3. repeats: every file whose bytes changed has its old sha256 replaced by its new
     sha256 wherever it is written, until nothing changes.
Usage: repin.py <repo> <new-bundle-dir> [scope-dir ...]
"""
import datetime, hashlib, json, pathlib, re, shutil, sys

FILES = ('manifest.json', 'cards.json', 'official-format-facts.json')
KEYS = ('version', 'sourceUpdatedAt', 'sourceRetrievedAt', 'sourceUrl', 'sourceSha256', 'indexSha256', 'officialFactsSha256')
SCOPES = ('deploy/forge-host', 'experiments/forge-proof/combined-browser-proof')
SKIP = {'.git', 'node_modules', '__pycache__', 'evidence'}  # evidence: records of past runs, never re-pinned

def sha(b): return hashlib.sha256(b).hexdigest()
def day(s, d): return (datetime.date.fromisoformat(s) + datetime.timedelta(days=d)).isoformat()

def files(repo, scopes):
    for s in scopes:
        for p in sorted((repo / s).rglob('*')):
            if p.is_file() and not SKIP.intersection(p.relative_to(repo).parts): yield p

def main():
    repo, new = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve()
    scopes = sys.argv[3:] or SCOPES
    nm_bytes = (new / 'manifest.json').read_bytes(); nm = json.loads(nm_bytes)
    copies = [p.parent for p in files(repo, scopes) if p.name == 'manifest.json' and p.parent.name == 'current' and p.parent.parent.name == 'rules-data']
    if not copies: sys.exit('REPIN_FAILED no rules-data/current in scope')
    om_bytes = (copies[0] / 'manifest.json').read_bytes(); om = json.loads(om_bytes)
    for c in copies:
        if (c / 'manifest.json').read_bytes() != om_bytes: sys.exit(f'REPIN_FAILED copies differ: {c}')
    if om['version'] == nm['version']: print('REPIN nothing to do'); return
    if om['engineRevision'] != nm['engineRevision']: sys.exit('REPIN_FAILED engine revision changed')
    tokens = {om[k]: nm[k] for k in KEYS if om[k] != nm[k]}
    tokens[sha(om_bytes)] = sha(nm_bytes)
    # Dates as the tests use them for clocks: the as-of day, the expiry day, and the last
    # second before the as-of day.
    for k in ('asOfDate', 'validUntilExclusive'):
        if om[k] != nm[k]: tokens.setdefault(om[k], nm[k])
    tokens.setdefault(day(om['asOfDate'], -1) + 'T23:59:59', day(nm['asOfDate'], -1) + 'T23:59:59')
    # Bundle bytes first, so their hashes enter the cascade below.
    before = {p: p.read_bytes() for p in files(repo, scopes)}
    for c in copies:
        for f in FILES: shutil.copyfile(new / f, c / f)
    rx = re.compile('|'.join(re.escape(t) for t in sorted(tokens, key=len, reverse=True)))
    for p, b in before.items():
        if p.parent in copies and p.name in FILES: continue
        try: text = b.decode('utf-8')
        except UnicodeDecodeError: continue
        out = rx.sub(lambda m: tokens[m.group(0)], text)
        if out != text: p.write_bytes(out.encode('utf-8'))
    # The hash each file is pinned under so far: its original one, then each one written since.
    pinned = {p: sha(b) for p, b in before.items()}
    for _ in range(30):
        hashes = {}
        for p in before:
            now = sha(p.read_bytes())
            if now != pinned[p]: hashes[pinned[p]] = now; pinned[p] = now
        if not hashes: break
        hx = re.compile('|'.join(hashes))
        for p in before:
            b = p.read_bytes()
            try: text = b.decode('utf-8')
            except UnicodeDecodeError: continue
            out = hx.sub(lambda m: hashes[m.group(0)], text)
            if out != text: p.write_bytes(out.encode('utf-8'))
    else: sys.exit('REPIN_FAILED hashes did not settle')
    n = sum(1 for p, b in before.items() if p.read_bytes() != b)
    print(f'REPIN {om["version"]} -> {nm["version"]}: {n} files changed')

main()
