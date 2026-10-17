#!/usr/bin/env python3
"""Build extra recognition facts from canonical snapshots; never execute upstream TS."""
import gzip,json,re,sys,tarfile,hashlib
from pathlib import Path
src=Path(sys.argv[1]);archive=Path(sys.argv[2]);out=Path(__file__).resolve().parents[1]/'scanidx'
manifest=json.loads((out/'catalog-manifest.json').read_text())
def save(g,rows,kind):
 raw=json.dumps({'schema':1,'game':g,'keyKind':kind,'rows':rows},ensure_ascii=False,separators=(',',':')).encode();data=gzip.compress(raw,mtime=0);name=g+'-signals-v1.json.gz';(out/name).write_bytes(data);manifest['games'][g]['signals']={'file':'scanidx/'+name,'bytes':len(data),'sha256':hashlib.sha256(raw).hexdigest()};print(g,len(rows),len(data),'bytes')
rows={}
with gzip.open(src/'scan-mtg-default.jsonl.gz','rt') as f:
 for line in f:
  c=json.loads(line)
  if c.get('lang','en')!='en':continue
  rows[c['name']]={k:c[k] for k in ['mana_cost','type_line','power','toughness'] if k in c}
save('mtg',rows,'name')
with tarfile.open(archive) as tar:
 files={m.name:tar.extractfile(m).read().decode() for m in tar.getmembers() if m.isfile() and m.name.startswith('cards-database-master/data/') and m.name.endswith('.ts')}
 sets={}
 for name,text in files.items():
  hit=re.search(r'\bid:\s*[\'\"]([A-Za-z0-9.!?_-]+)[\'\"]',text)
  if ': Set' in text and hit:sets[name[:-3]]=hit[1]
 rows={};existing={r[0] for r in json.load(gzip.open(out/'ptcg-catalog-v1.json.gz','rt'))['rows']}
 for name,text in files.items():
  if ': Card' not in text:continue
  parent=str(Path(name).parent);sid=sets.get(parent);local=Path(name).stem
  if not sid or sid+'-'+local not in existing:continue
  hp=re.search(r'\bhp:\s*(\d+)',text);stage=re.search(r'\bstage:\s*[\'\"]([^\'\"]+)',text)
  attacks=text.split('attacks:',1)[-1] if 'attacks:' in text else ''
  names=re.findall(r'name:\s*\{\s*en:\s*"([^"\n]+)"',attacks)
  values={}
  if hp:values['hp']=int(hp[1])
  if stage:values['stage']=stage[1]
  if names:values['attackNames']=names[:4]
  if values:rows[sid+'-'+local]=values
 save('ptcg',rows,'id')
 (out/'TCGDEX-LICENSE.txt').write_bytes(tar.extractfile('cards-database-master/LICENSE').read())
rows={}
for c in json.loads((src/'scan-ygo-cards.json').read_text())['data']:
 rows[str(c['id'])]={k:c[k] for k in ['atk','def','level','race','attribute','type'] if k in c}
save('ygo',rows,'id')
(out/'catalog-manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
