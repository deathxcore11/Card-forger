#!/usr/bin/env python3
"""The app engine's rules-data bundle, for a Forge revision newer than the host's (build-engine-upgrade.sh).

The host's bundle maps every card identity of its pinned Forge (e5a0f815) to a Scryfall Oracle ID. A newer Forge knows
more cards (new sets). This keeps every identity of the host's bundle that the new engine still has, exactly as it is,
and adds the new engine's other identities where exactly one Scryfall Oracle card has that name (or that card's faces
joined with " // ", Scryfall's name for split and double-faced cards) and is a real card, not a token, emblem or art
card. Anything else stays out and fails closed, as on the host. The manifest is then moved to the new engine
(engineRevision, nativeExportSha256, formatDefinitionDigests) and its index hash updated, and the dated legality
verdicts are made by the host's own deploy/forge-host/scripts/refresh-rules-data.py on top, as the weekly refresh does.

  app-rules-bundle.py --base=<host rules-data/current> --export=<AppRulesExport json> --source=<oracle-cards jsonl.gz>
                      --out=<dir>
Prints the identities added and the ones still left out.
"""
import argparse, gzip, hashlib, json, pathlib, sys

SKIP_LAYOUTS = {'token', 'double_faced_token', 'emblem', 'art_series', 'planar', 'scheme', 'vanguard'}
sha = lambda b: hashlib.sha256(b).hexdigest()


def main():
    p = argparse.ArgumentParser()
    for k in ('base', 'export', 'source', 'out'): p.add_argument('--' + k, required=True)
    a = p.parse_args()
    base = pathlib.Path(a.base)
    manifest = json.loads((base / 'manifest.json').read_text('utf-8'))
    old_index = (base / 'cards.json').read_bytes()
    if sha(old_index) != manifest['indexSha256']: sys.exit('base bundle index integrity')
    old = json.loads(old_index)
    export_bytes = pathlib.Path(a.export).read_bytes()
    export = json.loads(export_bytes)
    native = export['cards']
    by_name = {}
    for line in gzip.decompress(pathlib.Path(a.source).read_bytes()).decode('utf-8').splitlines():
        if not line.strip(): continue
        row = json.loads(line)
        if not row.get('oracle_id') or row.get('layout') in SKIP_LAYOUTS: continue
        by_name.setdefault(row['name'], []).append(row)
    cards, added, left_out = {}, [], []
    for name, info in sorted(native.items()):
        if name in old:
            cards[name] = old[name]; continue
        if info.get('custom') or info.get('unsupported'):
            left_out.append((name, 'custom or unsupported in Forge')); continue
        faces = info.get('faces') or [name]
        hits = by_name.get(name, []) + ([] if len(faces) < 2 else by_name.get(' // '.join(faces), []))
        # Forge spells an ellipsis ". . .", Scryfall "..." (All Good Things...): the one punctuation difference allowed.
        if not hits and ' . . .' in name: hits = by_name.get(name.replace(' . . .', '...'), [])
        hits = list({h['oracle_id']: h for h in hits}.values())
        if len(hits) != 1:
            left_out.append((name, 'no Scryfall card' if not hits else 'ambiguous')); continue
        h = hits[0]
        # The verdicts and dates are filled by refresh-rules-data.py from the same source.
        cards[name] = {'oracleId': h['oracle_id'], 'releasedAt': h.get('released_at', ''), 'sourceName': h['name'],
                       'verdicts': {f: 'not_legal' for f in ('Brawl', 'Commander', 'Legacy', 'Modern', 'Pauper', 'Pioneer', 'Standard', 'Vintage')}}
        added.append(name)
    gone = [n for n in old if n not in native]
    index = (json.dumps(cards, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')
    m = dict(manifest)
    m.update({'engineRevision': export['engineRevision'], 'nativeExportSha256': sha(export_bytes), 'indexSha256': sha(index),
              'indexRows': len(cards), 'unmappedNativeCount': sum(1 for _, why in left_out if why != 'ambiguous'),
              'ambiguousNativeCount': sum(1 for _, why in left_out if why == 'ambiguous'),
              'formatDefinitionDigests': {k: v['digest'] for k, v in sorted(export['formats'].items())}})
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    (out / 'cards.json').write_bytes(index)
    (out / 'official-format-facts.json').write_bytes((base / 'official-format-facts.json').read_bytes())
    (out / 'manifest.json').write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    changed = [k for k in manifest['formatDefinitionDigests'] if manifest['formatDefinitionDigests'][k] != m['formatDefinitionDigests'].get(k)]
    print(json.dumps({'rows': len(cards), 'kept': len(cards) - len(added), 'added': len(added), 'leftOut': len(left_out), 'goneFromForge': len(gone),
                      'formatDigestsChanged': changed, 'engineRevision': m['engineRevision']}))
    print('ADDED', json.dumps(added, ensure_ascii=False))
    print('LEFT_OUT', json.dumps([n for n, _ in left_out if not n.startswith('A-')], ensure_ascii=False))


if __name__ == '__main__':
    main()
