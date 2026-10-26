import json,urllib.request,urllib.error,time,pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
conn=None
for _ in range(100):
 try:
  conn=json.loads((ROOT/'adapter/connection.json').read_text())
  req=urllib.request.Request(conn['baseUrl']+'/state',headers={'Authorization':'Bearer '+conn['token']})
  s=json.load(urllib.request.urlopen(req,timeout=1))
  if s.get('revision') and s.get('buttons'):break
 except Exception:pass
 time.sleep(.2)
else:raise RuntimeError('Bridge never ready')
transcript=[]
def get():
 return json.load(urllib.request.urlopen(urllib.request.Request(conn['baseUrl']+'/state',headers={'Authorization':'Bearer '+conn['token']}),timeout=2))
def record(s,label):
 (ROOT/'logs'/('http-'+label+'.json')).write_text(json.dumps(s,indent=2))
 print(label,s['revision'],s['turn'],s['phase'],s['inputType'],s['message'].replace('\n',' | ')[:180],flush=True)
 transcript.append({'label':label,'revision':s['revision'],'turn':s['turn'],'phase':s['phase'],'inputType':s['inputType'],'prompt':s['prompt']})
def action(s,op,**kwargs):
 req=urllib.request.Request(conn['baseUrl']+'/action',data=json.dumps({'revision':s['revision'],'op':op,**kwargs}).encode(),headers={'Authorization':'Bearer '+conn['token'],'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=3) as r: result=(r.status,json.load(r))
 except urllib.error.HTTPError as e:result=(e.code,json.load(e))
 print('action',op,kwargs,result,flush=True)
 return result

def wait(s):
 old=s['revision'];last=None;stable=0
 for _ in range(100):
  n=get()
  if n.get('failure'):raise RuntimeError(n['failure'])
  if n['revision']!=old and not n['busy']:
   if n['revision']==last:stable+=1
   else: stable=0;last=n['revision']
   if stable>=2:return n
  time.sleep(.1)
 raise RuntimeError('No next prompt: '+json.dumps(n))
record(s,'coin')
assert s['players'][0]['life']==40 and s['players'][1]['life']==40
assert all(not p['zones']['Library']['cards'] for p in s['players'])
# auth fails closed
try: urllib.request.urlopen(conn['baseUrl']+'/state');raise AssertionError('unauthorized state accepted')
except urllib.error.HTTPError as e:assert e.code==401
old=s
assert action(s,'ok')[0]==202
s=wait(s);record(s,'mulligan')
assert action(old,'ok')[0]==409
opp=next(p for p in s['players'] if not p['isViewer']); own=next(p for p in s['players'] if p['isViewer'])
assert opp['zones']['Hand']['count']==7 and opp['zones']['Hand']['cards']==[]
assert own['zones']['Hand']['count']==7 and len(own['zones']['Hand']['cards'])==7
assert action(s,'ok')[0]==202
s=wait(s);record(s,'kept')
for i in range(30):
 if s['phase']=='MAIN1' and s['activePlayer']==s['viewer'] and s['inputType']=='InputPassPriority':break
 if s['prompt']:
  p=s['prompt'];assert p['supported']
  assert action(s,'reply',promptId=p['id'],indexes=[x['index'] for x in p['options'][:p['min']]])[0]==202
 else:assert action(s,'ok')[0]==202
 s=wait(s);record(s,'advance-'+str(i))
else:raise AssertionError('Never reached main1')
own=next(p for p in s['players'] if p['isViewer']);land=next(c for c in own['zones']['Hand']['cards'] if 'Land' in c['type'])
assert action(s,'card',id=land['id'])[0]==202
s=wait(s);record(s,'land-click')
if s['prompt']:
 p=s['prompt'];assert p['method']=='getAbilityToPlay'
 assert action(s,'reply',promptId=p['id'],indexes=[])[0]==202
 s=wait(s);record(s,'land-ability-cancelled')
 assert s['inputType']=='InputPassPriority' and not s['busy'] and s['prompt'] is None
 assert action(s,'card',id=land['id'])[0]==202
 s=wait(s);record(s,'land-reclicked')
 p=s['prompt'];assert p['method']=='getAbilityToPlay'
 assert action(s,'reply',promptId=p['id'],indexes=[0])[0]==202
 s=wait(s);record(s,'land-reply')
own=next(p for p in s['players'] if p['isViewer'])
assert any(c['id']==land['id'] for c in own['zones']['Battlefield']['cards']),'Land did not move to battlefield'
assert all(not p['zones']['Library']['cards'] for p in s['players'])
assert next(p for p in s['players'] if not p['isViewer'])['zones']['Hand']['cards']==[]
# Cast a real spell using Forge's own ability/menu and payment prompts.
ring=next(c for c in own['zones']['Hand']['cards'] if c['name']=='Sol Ring')
assert action(s,'card',id=ring['id'])[0]==202
s=wait(s);record(s,'sol-ring-click')
if s['prompt']:
 p=s['prompt'];assert p['method']=='getAbilityToPlay'
 assert action(s,'reply',promptId=p['id'],indexes=[9999])[0]==400
 assert action(s,'reply',promptId=p['id'],indexes=[0.9])[0]==400
 assert action(s,'reply',promptId=str(p['id']),indexes=[0])[0]==400
 assert action(s,'reply',promptId=p['id'],indexes=[0])[0]==202
 s=wait(s);record(s,'sol-ring-ability')
for i in range(10):
 own=next(p for p in s['players'] if p['isViewer'])
 if any(c['id']==ring['id'] for c in own['zones']['Battlefield']['cards']):break
 if s['prompt']:
  p=s['prompt'];assert p['supported']
  assert action(s,'reply',promptId=p['id'],indexes=[x['index'] for x in p['options'][:max(1,p['min'])]])[0]==202
 else:assert action(s,'ok')[0]==202
 s=wait(s);record(s,'sol-ring-progress-'+str(i))
else:raise AssertionError('Sol Ring did not resolve')
assert any(c['tapped'] for c in own['zones']['Battlefield']['cards'] if 'Land' in c['type'])
print('PASS native HTTP Play, Keep, land, cast, payment, stack resolution, private zones, unauthorized/stale/invalid-option rejection',flush=True)
(ROOT/'logs/http-test-transcript.json').write_text(json.dumps(transcript,indent=2))
