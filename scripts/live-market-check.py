"""Read-only live checks: deployment identity, exact rarity pricing, upstream reachability."""
import json,time,urllib.request,urllib.error
ROOT='https://cardforge2.deathxcore11.workers.dev/'
def get(url):
    req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'CardStashy live verification (github.com/deathxcore11/Card-forger)'})
    with urllib.request.urlopen(req,timeout=40) as response:return json.load(response)
for attempt in range(18):
    try:
        with urllib.request.urlopen(ROOT+'views.js',timeout=20) as response:published=response.read().decode()
        if 'Version 3.37.0' in published:
            version='3.37.0'
            break
    except Exception as exc:print('Waiting for live deployment:',type(exc).__name__,flush=True)
    time.sleep(10)
else:raise RuntimeError('Version 3.37.0 did not become live')
print('Live version:',version,flush=True)
data=get(ROOT+'api/prices/yugioh?id=4731783')
print('Exact printing quotes:',json.dumps(data),flush=True)
rarities={p['rarity']:p for p in data.get('printings',[]) if p['code']=='MAMO-EN038'}
# Read-only research, no API signup, key, charge, or raw-data redistribution.
for label,url in [('Pokemon recent history','https://api.tickermint.cards/products/250317/prices'),('YGO recent history','https://api.tickermint.cards/products/25824/prices'),('MTGJSON current metadata','https://mtgjson.com/api/v5/Meta.json')]:
    try:
        body=get(url)
        if 'tickermint' in url:
            summary={k:{'count':len(v),'first':v[0] if v else None,'last':v[-1] if v else None} for k,v in body.items() if isinstance(v,list)}
            print(label,json.dumps(summary),flush=True)
        else:print(label,json.dumps(body)[:800],flush=True)
    except Exception as exc:print(label,'unavailable:',str(exc),flush=True)

assert 'Starlight Rare' in rarities and 'Secret Rare' in rarities,'Exact screenshot rarities did not resolve'
assert rarities['Starlight Rare']['productId']!=rarities['Secret Rare']['productId'],'Rarities were merged'
