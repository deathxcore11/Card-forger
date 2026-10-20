#!/usr/bin/env python3
"""Bounded deterministic regeneration from retained provider snapshots.
Reads literal source records without executing upstream code. Never rebuilds unrelated rows.
Usage: python scripts/rebuild-pilot-signals.py tests/fixtures/aquapolis-source-v1.tar.gz
"""
import gzip,hashlib,json,sys,tarfile,re
from pathlib import Path
from source_literals import parse,card_signals
root=Path(__file__).resolve().parents[1];src=Path(sys.argv[1]);out=root/'scanidx';source_pin='cbddf7e54033b1b58e44af1049c88832e55b94d0'
if src.is_dir():sources={p.name:p.read_bytes() for p in src.glob('ecard2-*.ts')}
else:
 with tarfile.open(src) as tar:sources={m.name:tar.extractfile(m).read() for m in tar.getmembers() if m.isfile() and re.fullmatch(r'ecard2-[A-Za-z0-9]+\.ts',m.name)}
if len(sources)!=186:raise ValueError('Expected all 186 retained Aquapolis source identities')
manifest=json.loads((out/'catalog-manifest.json').read_text());changes=[]
for kind in ['catalog','signals']:
 p=out/('ptcg-'+kind+'-v1.json.gz');pack=json.loads(gzip.decompress(p.read_bytes()))
 if kind=='catalog':
  for r in pack['rows']:
   if r[2] in ['ecard2','ecard3'] and re.fullmatch(r'H0*([1-9]|[12]\d|3[0-2])',r[3]):
    if r[4] not in [32,147,144]:raise ValueError('Unexpected printed fraction prior '+r[0])
    if len(r)<8:r.append(r[4])
    r[4]=32
 else:
  for name,data in sorted(sources.items()):
   card=parse(data.decode());values=card_signals(card)
   if name=='ecard2-109.ts':
    names=values.get('attackNames',[])
    if len(names)<2 or names[1] not in ['Doublslap','Doubleslap']:raise ValueError('Smeargle correction precondition changed')
    names[1]='Doubleslap'
   if values:pack['rows'][name[:-3]]=values
 raw=json.dumps(pack,ensure_ascii=False,separators=(',',':')).encode();data=gzip.compress(raw,mtime=0);p.write_bytes(data);entry=manifest['games']['ptcg'] if kind=='catalog' else manifest['games']['ptcg']['signals'];entry.update(bytes=len(data),sha256=hashlib.sha256(raw).hexdigest())
 if kind=='catalog':entry['unpackedBytes']=len(raw)
 changes.append({'file':str(p.relative_to(root)),'unpackedSha256':hashlib.sha256(raw).hexdigest()})
manifest['games']['ptcg']['pilotBuild']={'schema':1,'generator':'scripts/rebuild-pilot-signals.py','sourcePin':source_pin,'inputHashes':{name:hashlib.sha256(data).hexdigest() for name,data in sorted(sources.items())},'outputs':changes}
(out/'catalog-manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
print(json.dumps(changes))
