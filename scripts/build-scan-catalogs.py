#!/usr/bin/env python3
"""Build compact identification packs from authoritative catalogue snapshots.
Usage: python scripts/build-scan-catalogs.py SNAPSHOT_DIR
Expected inputs: scan-mtg-default.jsonl.gz (Scryfall default_cards bulk),
scan-ptcg-cards.json + scan-ptcg-sets.json (TCGdex), scan-ygo-cards.json (YGOPRODeck).
Descriptions, prices and card images are deliberately excluded.
"""
import gzip,hashlib,json,sys
from pathlib import Path
from datetime import datetime,timezone
src=Path(sys.argv[1]);out=Path(__file__).resolve().parents[1]/'scanidx';now=datetime.now(timezone.utc).isoformat();manifest={'schema':1,'updated':now,'games':{}}
def save(game,rows):
 obj={'schema':1,'game':game,'updated':now,'rows':rows};raw=json.dumps(obj,separators=(',',':'),ensure_ascii=False).encode();compressed=gzip.compress(raw,compresslevel=9,mtime=0);filename=game+'-catalog-v1.json.gz';(out/filename).write_bytes(compressed)
 manifest['games'][game]={'file':'scanidx/'+filename,'count':len(rows),'bytes':len(compressed),'unpackedBytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()};print(game,len(rows),len(compressed),'bytes',flush=True)
rows=[]
with gzip.open(src/'scan-mtg-default.jsonl.gz','rt') as f:
 for line in f:
  c=json.loads(line)
  if 'paper' not in c.get('games',[]) or c.get('layout') in ('art_series','token','double_faced_token','emblem') or c.get('set_type') in ('memorabilia','token'):continue
  rows.append([c['id'],c['name'],c['set'],c['collector_number'],c.get('set_name',''),c.get('finishes',['nonfoil']),c.get('oracle_id',''),c.get('lang','en')])
save('mtg',rows)
sets={c['id']:c for c in json.loads((src/'scan-ptcg-sets.json').read_text())};paths={}
for line in (out/'ptcg-ids.txt').read_text().splitlines():
 parts=line.split('\t');
 if len(parts)>1:paths[parts[0]]=parts[1]
rows=[]
for c in json.loads((src/'scan-ptcg-cards.json').read_text()):
 sid=c['id'].rsplit('-',1)[0]
 if sid.startswith(('A','P-A')):continue
 st=sets.get(sid,{})
 rows.append([c['id'],c['name'],sid,c.get('localId',c['id'].rsplit('-',1)[-1]),st.get('cardCount',{}).get('official'),st.get('name',sid),paths.get(c['id'],'')])
save('ptcg',rows)
rows=[]
for c in json.loads((src/'scan-ygo-cards.json').read_text())['data']:
 sets=c.get('card_sets') or [{}]
 for st in sets:rows.append([str(c['id']),c['name'],st.get('set_code',''),st.get('set_rarity',''),st.get('set_name',''),c.get('type','')])
save('ygo',rows)
(out/'catalog-manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
