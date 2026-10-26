# Deliberately simple native test strategy, not user gameplay or browser acceptance.
# Only human-private/public projection is read. No hidden hand/library/card DB/rules oracle.
import sys,os
source=open(__file__.replace('test-angels-finish.py','test-http.py')).read().split("record(s,'coin')")[0]
source=source.replace("if n.get('failure'):", "if n.get('status')=='finished':return n\n  if n.get('failure'):")
source=source.replace("if s.get('revision') and s.get('buttons'):","if s.get('revision') and (s.get('buttons') or s.get('prompt')):")
exec(compile(source,'http-helpers','exec'))
assert s['match']['humanDeck']=='calling-all-angels'
opponent=s['match']['aiDeck'];attempted=set();phase_key=None;reveals=0
for step in range(1600):
 s=get()
 if s['status']=='failed':raise RuntimeError(s['failure'])
 if s['status']=='finished':
  record(s,'angels-finished-'+opponent)
  print('PASS native human-seat Angels vs',opponent,'terminal turn',s['turn'],'winner',s['winnerPlayerId'],'steps',step,flush=True)
  break
 if s['busy']:time.sleep(.05);continue
 visible_private=[c for p in s['players'] for z in ('Library','Hand') if z=='Library' or not p['isViewer'] for c in p['zones'][z]['cards']]
 if visible_private:
  # Actual Adaptive Omnitool reveal intentionally grants public visibility before moving the chosen card.
  prompt=s['prompt'];assert prompt and prompt.get('acknowledgeOnly'), 'Unexpected native reveal needs review'
  offered={x['value'].get('id') for x in prompt['options']}
  assert all(c['id'] in offered for c in visible_private), 'Projection contains more than native reveal'
  reveals+=1;record(s,'angels-public-reveal-'+opponent)
 if phase_key!=(s['turn'],s['phase']):
  phase_key=(s['turn'],s['phase']);attempted.clear()
  print('native-window',step,s['turn'],s['phase'],s['inputType'],'life',[(p['id'],p['life']) for p in s['players']],flush=True)
 p=s['prompt'];operation=None
 if p:
  if p['method']=='order' and any(isinstance(o['value'],dict) and o['value'].get('kind')=='replacementEffect' for o in p['options']):record(s,'angels-replacement-order-'+opponent)
  if not p['supported']:raise RuntimeError('UNSUPPORTED native prompt '+json.dumps(p))
  if p['method'] in ('confirm','showConfirmDialog'):operation=('reply',dict(promptId=p['id'],value=True))
  elif p['method']=='showInputDialog':raise RuntimeError('Manual numeric/text choice needed '+json.dumps(p))
  else:operation=('reply',dict(promptId=p['id'],indexes=[x['index'] for x in p['options'][:max(p['min'],1 if p['method']=='getAbilityToPlay' else 0)]]))
 elif s['inputType']=='InputPassPriority' and s['activePlayer']==s['viewer'] and s['phase'] in ('MAIN1','MAIN2'):
  own=next(x for x in s['players'] if x['isViewer'])
  # A test strategy may click visible cards; Forge alone accepts/rejects playability.
  # Native actionable highlights are deliberately NOT treated as complete legality.
  candidates=[c for z in ('Hand','Command') for c in own['zones'][z]['cards'] if c['id'] not in attempted]
  candidates.sort(key=lambda c: 'Land' not in c['type'])
  if os.getenv('PROOF_PASSIVE')=='1':candidates=[]
  if candidates:
   card=candidates[0];attempted.add(card['id']);operation=('card',dict(id=card['id']))
   print('visible-test-intention',card['id'],card['name'],flush=True)
  else:operation=('ok',{})
 elif s['inputType']=='InputPayManaOfCostPayment' and not s['buttons'].get('okEnabled') and s['buttons'].get('cancelEnabled'):operation=('cancel',{})
 elif s['buttons'].get('okEnabled'):operation=('ok',{})
 elif s['selection']['cards']:
  chosen={x['id'] for x in s['selection']['chosen']}
  offered=[x for x in s['selection']['cards'] if x['kind']=='card' and x['id'] not in chosen]
  if offered:operation=('card',dict(id=offered[0]['id']))
 if not operation:raise RuntimeError('Native prompt needs manual test strategy '+json.dumps(s))
 r=action(s,operation[0],**operation[1])
 if r[0]==409:continue
 assert r[0]==202,r
 s=wait(s)
else:raise RuntimeError('Bounded strategy did not reach terminal')
