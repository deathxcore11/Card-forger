"""Read-only live/provider checks. A denied live check never implies a failed deploy."""
import json,time,urllib.request,concurrent.futures
ROOT='https://cardforge2.deathxcore11.workers.dev/'
def get(url,raw=False):
    headers={'Accept':'application/json','User-Agent':'CardStashy live verification (github.com/deathxcore11/Card-forger)'}
    if url.startswith('https://noxfmbwuytnbvfgukpiv.supabase.co/'):headers['apikey']='sb_publishable_TpEfTlAdziX6ALSZLA7U_A_tBKKHcAz'
    req=urllib.request.Request(url,headers=headers)
    with urllib.request.urlopen(req,timeout=20) as response:
        return response.read().decode() if raw else json.load(response)
def check(label,url,kind):
    try:
        body=get(url,kind in ('version','layout'))
        if kind=='version':
            assert 'Version 3.39.1' in body,'Published version marker is older than 3.39.1'
            summary='3.39.1'
        elif kind=='layout':
            assert '.cs-banner > .cs-title { position:absolute;' in body
            assert '.cs-banner > .cs-hero.ptcg:not(.compact) .cs-art' in body
            assert 'transform:scale(1.35)' in body
            summary='Original art banner, faded title overlay and Pokemon artwork framing deployed'
        elif kind=='printing':
            summary=body
            rarities={p['rarity']:p for p in body.get('printings',[]) if p['code']=='MAMO-EN038'}
            assert 'Starlight Rare' in rarities and 'Secret Rare' in rarities,'Exact screenshot rarities did not resolve'
            assert rarities['Starlight Rare']['productId']!=rarities['Secret Rare']['productId'],'Rarities were merged'
        elif kind=='magic-history':
            series=[s for s in body.get('series',[]) if 'MTGJSON' in s.get('source','')]
            assert any(sum(p['date']>='2026-09-14' for p in s.get('points',[]))>=20 for s in series),'Magic screenshot printing has no recent month'
            summary=[{'source':s['source'],'count':len(s['points']),'last':s['points'][-1]} for s in series]
        elif kind=='printing-history':
            summary=body
            assert any(len(s.get('points',[]))>=20 for s in body.get('series',[])),'Recent month history did not resolve'
        elif kind=='history':
            summary={k:{'count':len(v),'first':v[0] if v else None,'last':v[-1] if v else None} for k,v in body.items() if isinstance(v,list)}
        else:summary=str(body)[:800]
        print(label,json.dumps(summary),flush=True);return True
    except Exception as exc:print(label,'UNVERIFIED:',str(exc),flush=True);return False
# Allow the independent Cloudflare build to finish before checking the new routes.
for attempt in range(12):
    try:
        if 'Version 3.39.1' in get(ROOT+'views.js',raw=True):break
    except Exception as exc:
        print('Deployment check:',str(exc),flush=True)
        if isinstance(exc,urllib.error.HTTPError) and exc.code in (401,403):break
    time.sleep(10)
# Read-only research, no API signup, key, charge, or raw-data redistribution.
jobs=[('Live version',ROOT+'views.js','version'),('Live artwork CSS',ROOT+'style.css','layout'),('Exact screenshot prices',ROOT+'api/prices/yugioh?id=4731783','printing'),('Live Pokemon recent history',ROOT+'api/prices/recent?game=ptcg&id=cel25-22&finish=reference','printing-history'),('Live YGO recent history',ROOT+'api/prices/recent?game=ygo&id=4731783&finish=reference&edition=MAMO-EN038&rarity=Starlight%20Rare','printing-history'),('Magic screenshot recent history','https://noxfmbwuytnbvfgukpiv.supabase.co/functions/v1/market-history?game=mtg&id=4b335496-05d2-40f5-a52c-10029f7fa008&finish=nonfoil','magic-history'),('MTGJSON metadata','https://mtgjson.com/api/v5/Meta.json','metadata'),('TCGCSV groups','https://tcgcsv.com/tcgplayer/2/groups','metadata')]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results=list(pool.map(lambda x:check(*x),jobs))
if not all(results[:6]):raise RuntimeError('Live HTTP verification blocked or failed; inspect the diagnostics above and Cloudflare deployment status separately.')
