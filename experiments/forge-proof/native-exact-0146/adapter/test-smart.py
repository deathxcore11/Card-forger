import json,urllib.request,urllib.error,time,pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
for _ in range(100):
 try:
  c=json.load(open(ROOT/'adapter/connection.json'));base=c['baseUrl'];headers={'Authorization':'Bearer '+c['token'],'Content-Type':'application/json'}
  def get():return json.load(urllib.request.urlopen(urllib.request.Request(base+'/state',headers=headers),timeout=2))
  s=get()
  if s.get('buttons') or s.get('prompt'):break
 except Exception:pass
 time.sleep(.2)
else:raise RuntimeError('No initial state')
def do(op,**kw):
 global s
 old=s['revision']
 with urllib.request.urlopen(urllib.request.Request(base+'/action',data=json.dumps({'revision':old,'op':op,**kw}).encode(),headers=headers),timeout=3) as r:assert r.status==202
 for _ in range(300):
  n=get()
  if n['revision']!=old and not n['busy']:
   time.sleep(.08);n=get()
   if not n['busy']:s=n;return
  time.sleep(.03)
 raise RuntimeError('No next prompt '+json.dumps(n))
def snap(name):
 (ROOT/'logs'/('smart-'+name+'.json')).write_text(json.dumps(s,indent=2));print(name,s['revision'],s['turn'],s['phase'],s['inputType'],s['controlMode'],s['autoPassNoActions'],flush=True)
snap('coin')
while s['prompt']:
 print('INITIAL_PROMPT',json.dumps(s['prompt']),flush=True)
 do('reply',promptId=s['prompt']['id'],indexes=[] if s['prompt'].get('acknowledgeOnly') else [0])
do('ok')
snap('mulligan')
print('VISIBLE_HUMAN_HAND',[(x['id'],x['name'],x['manaCost']) for p in s['players'] if p['isViewer'] for x in p['zones']['Hand']['cards']],flush=True)
do('ok');snap('first-main')
assert s['phase']=='MAIN1' and s['activePlayer']==s['viewer'] and not s['autoPassNoActions']
assert not next(p for p in s['players'] if p['isViewer'])['hasAvailableActions'] or s['selection']
do('ok');snap('second-main')
assert s['phase']=='MAIN2' and s['activePlayer']==s['viewer']
do('ok');snap('opponent-skipped')
assert s['phase']=='MAIN1' and s['activePlayer']==s['viewer'] and s['turn']>=3
assert next(p for p in s['players'] if not p['isViewer'])['zones']['Battlefield']['count']>=1
print('PASS Smart: own main phases open; zero Continue prompts in empty opponent windows',flush=True)
do('controlMode',value='full');snap('full-mode')
assert s['controlMode']=='full' and not s['autoPassNoActions']
do('ok');snap('full-window')
assert s['phase']!='MAIN2' and s['inputType']=='InputPassPriority'
print('PASS FullControl: native no-action window held explicitly',flush=True)
