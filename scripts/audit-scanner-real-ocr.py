#!/usr/bin/env python3
"""Characterize real public card pixels with native Tesseract and app parsers.

Run: python scripts/audit-scanner-real-ocr.py --cache /tmp/card-ocr --download \
       --output /tmp/card-ocr-report.json
Replays cached exact bytes when --download is omitted. Does NOT run a browser,
the camera controller, Tesseract.js/WASM, or private user photos. No paid APIs.
"""
import argparse
import base64
import concurrent.futures
import hashlib
import io
import json
import pathlib
import subprocess
import tempfile
import urllib.request
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[1]
REFS = [
    ('mtg', 'https://api.scryfall.com/cards/7673784e-db4b-43a1-8d55-1bb9fc1e284f'),
    ('ptcg', 'https://api.tcgdex.net/v2/en/cards/cel25-3'),
    ('ygo', 'https://db.ygoprodeck.com/api/v7/cardinfo.php?id=9753964'),
]
IMAGES = {
    'mtg': 'https://cards.scryfall.io/normal/front/7/6/7673784e-db4b-43a1-8d55-1bb9fc1e284f.jpg?1783903008',
    'ptcg': 'https://assets.tcgdex.net/en/swsh/cel25/3/high.webp',
    'ygo': 'https://www.cardempire.com/cdn/shop/products/image_69145d8a-89d2-4817-a517-0a2ca3f15c03_1200x1200.jpg?v=1644061652',
}
IMAGE_SHA256 = {
    'mtg': 'ac5db5d4b9719e6ac1c386745db35b248dc5154a26fc1aa1f4289f41c961bc35',
    'ptcg': '33d22aba9bbde966da2790d84d18434085d3547986c7067d10fa6df5c9b57dd3',
    'ygo': '52d78269b653db4f80ff895976feaf88a27686cfdaf2731997b91a2c721d3831',
}


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'CardStashy-scanner-audit/1.0', 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.read()


def download(cache, game, url):
    raw_bytes = fetch(url)
    raw = json.loads(raw_bytes)
    card = raw['data'][0] if game == 'ygo' else raw
    image = IMAGES[game]
    image_bytes = fetch(image)
    if hashlib.sha256(image_bytes).hexdigest() != IMAGE_SHA256[game]:
        raise ValueError(game + ': reference image bytes changed; inspect the reference before updating its hash')
    (cache / (game + '.json')).write_bytes(raw_bytes)
    (cache / (game + '.image')).write_bytes(image_bytes)
    return {'game': game, 'metadataURL': url, 'imageURL': image}


def normalize(image):
    ratio = min(192/image.width, 256/image.height)
    small = image.resize((round(image.width*ratio), round(image.height*ratio)), Image.Resampling.BILINEAR).convert('RGBA')
    payload = {'width': image.width, 'height': image.height, 'smallWidth': small.width, 'smallHeight': small.height,
               'small': base64.b64encode(small.tobytes()).decode(), 'rgba': base64.b64encode(image.convert('RGBA').tobytes()).decode()}
    result = subprocess.run(['node', 'scripts/audit-scanner-ocr-evidence.mjs', '--normalize'], input=json.dumps(payload), text=True, capture_output=True, check=True, cwd=ROOT)
    geometry = json.loads(result.stdout)
    pixels = geometry.pop('rgba', None)
    return (Image.frombytes('RGBA', (geometry['width'], geometry['height']), base64.b64decode(pixels)).convert('RGB') if pixels else image), geometry


def expected_card(game, raw):
    if game == 'mtg':
        return {k: raw.get(k) for k in ('id', 'name', 'set', 'collector_number', 'mana_cost', 'power', 'toughness')}
    if game == 'ptcg':
        return {'id': raw['id'], 'name': raw['name'], 'hp': raw.get('hp'), 'stage': raw.get('stage'),
                'set': {'id': raw['set']['id'], 'number': raw['localId'], 'total': raw['set']['cardCount']['official']}}
    c = raw['data'][0]
    return {**{k: c.get(k) for k in ('id', 'name', 'atk', 'def', 'level')}, 'printingCode': 'HSRD-EN041'}


def crop_band(image, roi, scale=2.5, invert=False):
    # Production ROI and enlargement policy; Pillow rasterization is deliberately
    # identified as an approximation, not the browser's exact canvas pipeline.
    w, h = image.size
    x, y, bw, bh = roi
    k = min(6, max(scale, 1100 / max(1, w * bw)))
    result = image.crop((round(w*x), round(h*y), round(w*(x+bw)), round(h*(y+bh))))
    result = result.resize((max(1, round(w*bw*k)), max(1, round(h*bh*k))), Image.Resampling.BICUBIC).convert('L')
    return result.point(lambda p: max(0, min(255, round((p-127.5)*1.6+127.5) if not invert else 255-round((p-127.5)*1.6+127.5))))


def ocr(image, psm, path):
    image.save(path)
    result = subprocess.run(['tesseract', str(path), 'stdout', '-l', 'eng', '--psm', str(psm), 'tsv'], check=True, capture_output=True, text=True, timeout=30)
    lines, confidences = {}, []
    for row in result.stdout.splitlines()[1:]:
        fields = row.split('\t', 11)
        if len(fields) != 12 or fields[0] != '5' or not fields[11].strip():
            continue
        key = tuple(fields[1:5])
        lines.setdefault(key, []).append(fields[11])
        confidences.append(float(fields[10]))
    return {'text': '\n'.join(' '.join(words) for words in lines.values()), 'confidence': sum(confidences)/len(confidences) if confidences else 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    sources = [{'game': game, 'metadataURL': url, 'imageURL': IMAGES[game]} for game, url in REFS]
    if args.download:
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            sources = list(pool.map(lambda item: download(args.cache, *item), REFS))
    layouts = json.loads(subprocess.check_output(['node', 'scripts/audit-scanner-ocr-evidence.mjs', '--layout'], cwd=ROOT))
    cases = []
    with tempfile.TemporaryDirectory(prefix='scanner-native-ocr-') as temp:
        for game, _ in REFS:
            source_image = Image.open(args.cache / (game+'.image')).convert('RGB')
            if hashlib.sha256((args.cache/(game+'.image')).read_bytes()).hexdigest() != IMAGE_SHA256[game]:
                raise ValueError(game + ': cached reference differs from pinned image hash')
            original, geometry = normalize(source_image)
            raw = json.loads((args.cache / (game+'.json')).read_text())
            card = expected_card(game, raw)
            sized = original.resize((480, round(original.height*480/original.width)), Image.Resampling.LANCZOS)
            compressed = io.BytesIO()
            sized.save(compressed, 'JPEG', quality=40)
            variants = [('original', original), ('width480', sized), ('blur1.2', sized.filter(ImageFilter.GaussianBlur(1.2))), ('jpeg40', Image.open(io.BytesIO(compressed.getvalue())).convert('RGB'))]
            if game == 'ygo':
                # Explicit hand-annotated control: proves readable pixels exist,
                # not that the automatic detector or user experience succeeds.
                variants.append(('manual-crop-control', source_image.crop((204, 120, 799, 989))))
            for variant, image in variants:
                readings = {}
                for band, roi in layouts[game].items():
                    readings[band] = ocr(crop_band(image, roi, 2.5 if band == 'name' else 3), 6, pathlib.Path(temp)/(game+'-'+variant+'-'+band+'.png'))
                full = ocr(crop_band(image, [0, 0, 1, 1], 1), 11, pathlib.Path(temp)/(game+'-'+variant+'-full.png'))
                read = {'name': readings['name']['text'], 'code': '\n'.join(readings[x]['text'] for x in ('code', 'pass') if x in readings), 'full': '', 'stats': '',
                        'titles': [{'text': readings['name']['text'], 'source': 'title', 'confidence': readings['name']['confidence']}]}
                case_geometry = {'manualControlCrop': [204, 120, 799, 989]} if variant == 'manual-crop-control' else geometry
                cases.append({'game': game, 'variant': variant, 'imageSize': image.size, 'geometry': case_geometry, 'expected': card, 'read': read, 'fullOCR': full, 'bands': readings})
    bridge = subprocess.run(['node', 'scripts/audit-scanner-ocr-evidence.mjs'], input=json.dumps(cases), text=True, capture_output=True, check=True, cwd=ROOT)
    results = json.loads(bridge.stdout)
    report = {'kind': 'native-tesseract-public-card-characterization', 'engine': subprocess.check_output(['tesseract', '--version'], text=True).splitlines()[0],
              'limitations': ['Two public catalogue scans and one public retailer photograph; not the owner\'s physical phone camera.', 'Native Tesseract and Pillow approximate preprocessing; not browser Tesseract.js/WASM or end-to-end app testing.', 'Four deterministic image variants per game plus a manually cropped YGO control; not a representative accuracy estimate.', 'Production geometry/parser/evidence are exercised; candidate catalogue completeness, provider lookup, auto capture and collection saving are outside this runner.', 'These are fixed-band experiments, not a replay of the app fallback sequence. For rejected geometry the app starts with original-image recovery; direct band results here are diagnostic only.', 'Full-card OCR is recorded separately; no failed band is selectively replaced when calculating band evidence.'],
              'sources': [{**source, 'imageSHA256': hashlib.sha256((args.cache/(source['game']+'.image')).read_bytes()).hexdigest(), 'metadataSHA256': hashlib.sha256((args.cache/(source['game']+'.json')).read_bytes()).hexdigest()} for source in sources], 'results': results}
    report['summary'] = {'cases': len(results), 'titleExact': sum(r['title']['exactMatch'] for r in results), 'identifierPresent': sum(bool(r['identifiers']['observations']) for r in results), 'identifierMatchesExpected': sum(r['identifierMatchesExpected'] for r in results), 'nameAndIdentifierMatchExpected': sum(r['title']['exactMatch'] and r['identifierMatchesExpected'] for r in results), 'conflictingEvidence': sum(bool(r['evidence']['conflicts'] or r['evidence']['identifierConflict'] or r['evidence']['nameConflict']) for r in results)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report['summary']))
    for r in results:
        print(json.dumps({k: r[k] for k in ('game', 'variant', 'names', 'title', 'identifiers')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
