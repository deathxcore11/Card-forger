"""Read-only live/provider checks. A denied live check never implies a failed deploy."""
import json,urllib.request,concurrent.futures
ROOT='https://cardforge2.deathxcore11.workers.dev/'
def get(url,raw=False):
    req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'CardStashy live verification (github.com/deathxcore11/Card-forger)'})
    with urllib.request.urlopen(req,timeout=20) as response:
        return response.read().decode() if raw else json.load(response)
def check(label,url,kind):
    try:
        body=get(url,kind=='version')
        if kind=='version':
            assert 'Version 3.37.0' in body,'Published version marker is older than 3.37.0'
            summary='3.37.0'
        elif kind=='printing':
            summary=body
            rarities={p['rarity']:p for p in body.get('printings',[]) if p['code']=='MAMO-EN038'}
            assert 'Starlight Rare' in rarities and 'Secret Rare' in rarities,'Exact screenshot rarities did not resolve'
            assert rarities['Starlight Rare']['productId']!=rarities['Secret Rare']['productId'],'Rarities were merged'
        elif kind=='history':
            summary={k:{'count':len(v),'first':v[0] if v else None,'last':v[-1] if v else None} for k,v in body.items() if isinstance(v,list)}
        else:summary=str(body)[:800]
        print(label,json.dumps(summary),flush=True);return True
    except Exception as exc:print(label,'UNVERIFIED:',str(exc),flush=True);return False
# Read-only research, no API signup, key, charge, or raw-data redistribution.
jobs=[('Live version',ROOT+'views.js','version'),('Exact screenshot prices',ROOT+'api/prices/yugioh?id=4731783','printing'),('Pokemon recent history','https://api.tickermint.cards/products/250317/prices','history'),('YGO recent history','https://api.tickermint.cards/products/25824/prices','history'),('MTGJSON metadata','https://mtgjson.com/api/v5/Meta.json','metadata'),('TCGCSV groups','https://tcgcsv.com/tcgplayer/2/groups','metadata')]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results=list(pool.map(lambda x:check(*x),jobs))
if not all(results[:2]):raise RuntimeError('Live HTTP verification blocked or failed; inspect the diagnostics above and Cloudflare deployment status separately.')
