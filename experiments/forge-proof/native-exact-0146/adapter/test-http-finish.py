exec(compile(open(__file__.replace('test-http-finish.py','test-http.py')).read(),'test-http.py','exec'))
# Deliberately passive human-seat test driver; every transition is still native Forge.
for step in range(800):
 s=get()
 (ROOT/'logs/http-passive-latest.json').write_text(json.dumps(s,indent=2))
 if step%20==0:print('passive',step,s['turn'],s['phase'],s['inputType'],s['message'].replace('\n',' | '),s['buttons'],flush=True)
 if s['status']=='finished':
  record(s,'finished');print('PASS HTTP native match terminal',s['winner'],s.get('winnerPlayerId'),s['turn'],flush=True);break
 if s['failure']:raise RuntimeError(s['failure'])
 if s['busy']:time.sleep(.05);continue
 p=s['prompt']
 if p:
  if not p['supported']:raise RuntimeError('Unadapted native prompt: '+json.dumps(p))
  if p['method'] in ['confirm','showConfirmDialog']:r=action(s,'reply',promptId=p['id'],value=True)
  elif p['method']=='showInputDialog':r=action(s,'reply',promptId=p['id'],value=p.get('initialValue') or '0')
  else:r=action(s,'reply',promptId=p['id'],indexes=[x['index'] for x in p['options'][:p['min']]])
 elif s['inputType']=='InputAttack' and s['buttons'].get('cancel')=='Alpha Strike':r=action(s,'cancel')
 elif s['buttons'].get('okEnabled'):r=action(s,'ok')
 elif s['selection']['cards']:
  chosen={x['id'] for x in s['selection']['chosen']};c=next(x for x in s['selection']['cards'] if x['id'] not in chosen);r=action(s,'card',id=c['id'])
 else:raise RuntimeError('No passive driver action: '+json.dumps(s))
 if r[0]==409:continue
 assert r[0]==202
 # Fast poll with real engine quiescence, no direct state mutation.
 old=s['revision']
 for _ in range(300):
  n=get()
  if n['status']=='finished' or (n['revision']!=old and not n['busy']):break
  time.sleep(.03)
 else:raise RuntimeError('Native match did not advance')
 time.sleep(.02)
else:raise RuntimeError('Driver step observation bound reached')
