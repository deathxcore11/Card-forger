#!/usr/bin/env python3
"""Refresh the dated Forge rules-data bundle from a newer public Scryfall Oracle bulk file.

The pinned engine's card identities stay exactly as they are (same native names, same
Oracle IDs, same unmapped/ambiguous exclusions, same aliases); only each identity's
source facts are re-read from the new bulk: its name, release date and its legality in
every format the host admits (Scryfall's standardbrawl is paper Brawl). Official format facts are re-checked by a person and
passed in with --facts; this tool never invents or extends them.

Prove the tool against the bundle it replaces first:
  refresh-rules-data.py --bundle=<rules-data/current> --source=<old bulk> --verify
must rebuild the existing cards.json byte for byte. Then:
  refresh-rules-data.py --bundle=<rules-data/current> --source=<new bulk> \
    --source-url=<its url> --source-updated-at=<bulk updated_at> --retrieved-at=<iso> \
    --as-of=<YYYY-MM-DD> --facts=<re-checked official-format-facts.json> --out=<dir>
"""
import argparse, datetime, gzip, hashlib, json, os, pathlib, sys

FORMATS = {'Brawl': 'standardbrawl', 'Commander': 'commander', 'Legacy': 'legacy', 'Modern': 'modern',
           'Pauper': 'pauper', 'Pioneer': 'pioneer', 'Standard': 'standard', 'Vintage': 'vintage'}
VERDICTS = {'legal', 'not_legal', 'banned', 'restricted'}
MAX_DAYS = 7
SOURCE_LIMIT = 64 * 1024 * 1024


def fail(code):
    raise SystemExit('RULES_REFRESH_FAILED ' + code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_source(path):
    raw = pathlib.Path(path).read_bytes()
    if len(raw) > SOURCE_LIMIT:
        fail('source_too_large')
    text = gzip.decompress(raw).decode('utf-8')
    rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    by_oracle = {}
    for row in rows:
        oracle = row.get('oracle_id')
        if not oracle:
            continue
        if oracle in by_oracle:
            fail('duplicate_oracle_id ' + oracle)
        by_oracle[oracle] = row
    return raw, by_oracle


def index_bytes(cards):
    return (json.dumps(cards, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')


def rebuild(cards, by_oracle):
    out = {}
    for name, row in cards.items():
        source = by_oracle.get(row['oracleId'])
        if source is None:
            fail('identity_missing_from_source ' + json.dumps(name, ensure_ascii=False))
        verdicts = {}
        for fmt, key in FORMATS.items():
            value = (source.get('legalities') or {}).get(key)
            if value not in VERDICTS:
                fail('unknown_verdict %s %s %r' % (json.dumps(name, ensure_ascii=False), fmt, value))
            verdicts[fmt] = value
        released = source.get('released_at')
        if not isinstance(released, str) or len(released) != 10:
            fail('release_date_missing ' + json.dumps(name, ensure_ascii=False))
        out[name] = {'oracleId': row['oracleId'], 'releasedAt': released, 'sourceName': source['name'], 'verdicts': verdicts}
    return out


def check_facts(cards, facts):
    """Every officially banned card that the engine knows must carry the banned verdict."""
    by_source_name = {}
    for row in cards.values():
        by_source_name.setdefault(row['sourceName'], row)
    problems = []
    for fmt, key in (('Standard', 'standardBanned'), ('Modern', 'modernBanned')):
        for listed in facts.get(key, []):
            name = listed.split(' (')[0]
            row = by_source_name.get(name)
            # A ban that applies only to one digital mode is not a paper ban.
            if row is None or '(only in' in listed:
                continue
            if row['verdicts'][fmt] != 'banned':
                problems.append('%s %s is %s' % (fmt, name, row['verdicts'][fmt]))
    if problems:
        fail('official_facts_disagree_with_source: ' + '; '.join(problems[:10]))


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--bundle', required=True)
    p.add_argument('--source', required=True)
    p.add_argument('--verify', action='store_true')
    p.add_argument('--source-url')
    p.add_argument('--source-updated-at')
    p.add_argument('--retrieved-at')
    p.add_argument('--as-of')
    p.add_argument('--facts')
    p.add_argument('--out')
    a = p.parse_args()
    bundle = pathlib.Path(a.bundle)
    manifest = json.loads((bundle / 'manifest.json').read_text('utf-8'))
    old_index = (bundle / 'cards.json').read_bytes()
    if sha(old_index) != manifest['indexSha256']:
        fail('existing_index_integrity')
    cards = json.loads(old_index)
    raw, by_oracle = read_source(a.source)
    rebuilt = rebuild(cards, by_oracle)
    data = index_bytes(rebuilt)
    if a.verify:
        if sha(raw) != manifest['sourceSha256']:
            fail('verify_source_is_not_the_bundle_source')
        if data != old_index:
            fail('verify_rebuild_differs_from_existing_index')
        print(json.dumps({'verified': True, 'rows': len(rebuilt), 'indexSha256': sha(data)}))
        return
    for need in ('source_url', 'source_updated_at', 'retrieved_at', 'as_of', 'facts', 'out'):
        if not getattr(a, need):
            fail('missing --' + need.replace('_', '-'))
    as_of = datetime.date.fromisoformat(a.as_of)
    updated = datetime.datetime.fromisoformat(a.source_updated_at)
    source_day = updated.date()
    if source_day > as_of or source_day < as_of - datetime.timedelta(days=2):
        fail('source_not_current_as_of')
    facts_bytes = pathlib.Path(a.facts).read_bytes()
    facts = json.loads(facts_bytes)
    if facts.get('checkedAt') != a.as_of:
        fail('official_facts_not_checked_on_as_of_date')
    check_facts(rebuilt, facts)
    expiry = as_of + datetime.timedelta(days=MAX_DAYS)
    version = 'rules-%s-scryfall%s-native-%s' % (as_of.strftime('%Y%m%d'), source_day.strftime('%Y%m%d'), manifest['engineRevision'][:8])
    changed = sum(1 for k in cards if cards[k] != rebuilt[k])
    new_manifest = dict(manifest)
    new_manifest.update({
        'version': version, 'asOfDate': as_of.isoformat(), 'validUntilExclusive': expiry.isoformat(),
        'sourceUpdatedAt': a.source_updated_at, 'sourceRetrievedAt': a.retrieved_at, 'sourceUrl': a.source_url,
        'sourceSha256': sha(raw), 'indexSha256': sha(data), 'indexRows': len(rebuilt),
        'officialFactsSha256': sha(facts_bytes),
    })
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'cards.json').write_bytes(data)
    (out / 'official-format-facts.json').write_bytes(facts_bytes)
    manifest_bytes = (json.dumps(new_manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    (out / 'manifest.json').write_bytes(manifest_bytes)
    print(json.dumps({'version': version, 'asOfDate': as_of.isoformat(), 'validUntilExclusive': expiry.isoformat(),
                      'rows': len(rebuilt), 'changedRows': changed, 'manifestSha256': sha(manifest_bytes),
                      'indexSha256': sha(data), 'sourceSha256': sha(raw)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
