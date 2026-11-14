#!/usr/bin/env python3
"""Refresh the Android app engine's own Forge rules bundle (website forge-rules/app/), every few days.

  app.py <host-checkout> <website-checkout> <work-dir>

The app runs a newer Forge than the host (android-app/forge-engine/build-engine-upgrade.sh), so its bundle carries that
engine's revision and card identities and cannot be the host's copy (forge-rules/current/, still read by older apps).
Like weekly.py, it rebuilds only once the bundle is RULES_MIN_AGE_DAYS (default 3) old, from today's Scryfall Oracle bulk,
with the host's own refresh-rules-data.py: identities stay exactly as they are, only the dated verdicts move. The official
format facts carry over with today's checkedAt and are cross-checked against the source by that tool.
Prints APP_REFRESHED <version> or APP_UNCHANGED <version>; any failure exits non-zero and changes nothing.
"""
import datetime, json, os, pathlib, re, shutil, subprocess, sys, urllib.request

TOOL = 'deploy/forge-host/scripts/refresh-rules-data.py'
UA = {'User-Agent': 'CardStashy-rules-refresh/1.0', 'Accept': 'application/json'}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r: return r.read()

def main():
    host, web, work = (pathlib.Path(p).resolve() for p in sys.argv[1:4])
    work.mkdir(parents=True, exist_ok=True)
    dest = web / 'forge-rules' / 'app'
    old = json.loads((dest / 'manifest.json').read_text())
    now = datetime.datetime.now(datetime.timezone.utc); today = now.date().isoformat()
    if (now.date() - datetime.date.fromisoformat(old['asOfDate'])).days < int(os.environ.get('RULES_MIN_AGE_DAYS', '3')):
        print('APP_UNCHANGED ' + old['version']); return
    meta = json.loads(get('https://api.scryfall.com/bulk-data/oracle-cards'))
    url, updated = meta['jsonl_download_uri'], meta['updated_at']
    if not re.fullmatch(r'https://data\.scryfall\.io/oracle-cards/oracle-cards-\d{14}\.jsonl\.gz', url): sys.exit('APP_REFRESH_FAILED unexpected bulk url ' + url)
    source = work / url.rsplit('/', 1)[1]
    if not source.is_file(): source.write_bytes(get(url))
    facts = work / 'app-official-format-facts.json'
    text, n = re.subn(r'("checkedAt"\s*:\s*")\d{4}-\d{2}-\d{2}(")', r'\g<1>' + today + r'\g<2>', (dest / 'official-format-facts.json').read_text())
    if n != 1: sys.exit('APP_REFRESH_FAILED facts checkedAt not found')
    facts.write_text(text)
    out = work / 'app-bundle'; shutil.rmtree(out, ignore_errors=True)
    subprocess.run([sys.executable, str(host / TOOL), '--bundle=' + str(dest), '--source=' + str(source), '--source-url=' + url,
                    '--source-updated-at=' + updated, '--retrieved-at=' + now.strftime('%Y-%m-%dT%H:%M:%S.000Z'), '--as-of=' + today,
                    '--facts=' + str(facts), '--out=' + str(out)], check=True)
    for f in ('manifest.json', 'cards.json', 'official-format-facts.json'): shutil.copyfile(out / f, dest / f)
    print('APP_REFRESHED ' + json.loads((out / 'manifest.json').read_text())['version'])

main()
