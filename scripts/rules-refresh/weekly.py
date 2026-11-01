#!/usr/bin/env python3
"""Weekly Forge rules-data refresh, end to end, without a person.

  weekly.py <host-checkout> <website-checkout> <work-dir>

Run daily; it rebuilds only once the bundle is RULES_MIN_AGE_DAYS (default 3) old.

1. Reads today's Scryfall Oracle bulk (oracle-cards, JSON Lines).
2. Rebuilds the rules bundle with the host's own refresh-rules-data.py. The official
   format facts carry over with today's checkedAt; the tool cross-checks every ban and
   restriction in them against Scryfall and stops if they disagree (a new banned list
   needs a person to update the facts).
3. Moves every host pin to the new bundle (repin.py).
4. Copies the bundle to the website's forge-rules/current/, which the Android app fetches.
Prints REFRESHED <version>, SYNCED <version> (only the website copy moved) or UNCHANGED; any failure exits non-zero and changes nothing
that is committed.
"""
import datetime, hashlib, json, os, pathlib, re, shutil, subprocess, sys, urllib.request

CANONICAL = 'experiments/forge-proof/combined-browser-proof/candidate/build-context/native/rules-data/current'
TOOL = 'deploy/forge-host/scripts/refresh-rules-data.py'
UA = {'User-Agent': 'CardStashy-rules-refresh/1.0', 'Accept': 'application/json'}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r: return r.read()

def copy(src, dest):
    dest.mkdir(parents=True, exist_ok=True)
    for f in ('manifest.json', 'cards.json', 'official-format-facts.json'): shutil.copyfile(src / f, dest / f)

def main():
    host, web, work = (pathlib.Path(p).resolve() for p in sys.argv[1:4])
    here = pathlib.Path(__file__).resolve().parent
    work.mkdir(parents=True, exist_ok=True)
    current = host / CANONICAL
    old = json.loads((current / 'manifest.json').read_text())
    now = datetime.datetime.now(datetime.timezone.utc)
    today = now.date().isoformat()
    dest = web / 'forge-rules' / 'current'
    # Refreshed every few days, so a failed day leaves several days to retry before the
    # 7-day bundle lapses; a younger bundle is kept.
    age = (now.date() - datetime.date.fromisoformat(old['asOfDate'])).days
    if age < int(os.environ.get('RULES_MIN_AGE_DAYS', '3')):
        # The host is current already (a person refreshed it); the app's copy still follows it.
        if not (dest / 'manifest.json').is_file() or (dest / 'manifest.json').read_bytes() != (current / 'manifest.json').read_bytes():
            copy(current, dest); print('SYNCED ' + old['version'])
        else: print('UNCHANGED ' + old['version'])
        return
    meta = json.loads(get('https://api.scryfall.com/bulk-data/oracle-cards'))
    url, updated = meta['jsonl_download_uri'], meta['updated_at']
    if not re.fullmatch(r'https://data\.scryfall\.io/oracle-cards/oracle-cards-\d{14}\.jsonl\.gz', url): sys.exit('REFRESH_FAILED unexpected bulk url ' + url)
    source = work / url.rsplit('/', 1)[1]
    source.write_bytes(get(url))
    facts = work / 'official-format-facts.json'
    text = (current / 'official-format-facts.json').read_text()
    text, n = re.subn(r'("checkedAt"\s*:\s*")\d{4}-\d{2}-\d{2}(")', r'\g<1>' + today + r'\g<2>', text)
    if n != 1: sys.exit('REFRESH_FAILED facts checkedAt not found')
    facts.write_text(text)
    out = work / 'bundle'
    shutil.rmtree(out, ignore_errors=True)
    subprocess.run([sys.executable, str(host / TOOL), '--bundle=' + str(current), '--source=' + str(source),
                    '--source-url=' + url, '--source-updated-at=' + updated,
                    '--retrieved-at=' + now.strftime('%Y-%m-%dT%H:%M:%S.000Z'), '--as-of=' + today,
                    '--facts=' + str(facts), '--out=' + str(out)], check=True)
    subprocess.run([sys.executable, str(here / 'repin.py'), str(host), str(out)], check=True)
    copy(out, dest)
    print('REFRESHED ' + json.loads((out / 'manifest.json').read_text())['version'])

main()
