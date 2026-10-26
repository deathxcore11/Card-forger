# Real native game; test driver reads only the private human snapshot and public fields.
exec(compile(open(__file__.replace('test-smart-payment.py','test-http.py')).read().split("record(s,'coin')")[0], 'http-helpers', 'exec'))
def send(op,**kwargs):
 global s
 assert action(s,op,**kwargs)[0]==202
 s=wait(s)
record(s,'smart-payment-coin')
send('ok');send('ok')
assert s['controlMode']=='smart' and s['phase']=='MAIN1' and not s['autoPassNoActions']
own=next(p for p in s['players'] if p['isViewer'])
land=next(c for c in own['zones']['Hand']['cards'] if c['name']=='Island')
ring=next(c for c in own['zones']['Hand']['cards'] if c['name']=='Sol Ring')
send('card',id=land['id'])
assert s['prompt'] is None and s['inputType']=='InputPassPriority'
# A deliberate Full override must keep real ability and payment decisions available.
send('controlMode',value='full');send('card',id=ring['id'])
while s['prompt']:
 p=s['prompt'];assert p['method']=='getAbilityToPlay'
 send('reply',promptId=p['id'],indexes=[0])
record(s,'full-manual-payment')
assert s['inputType']=='InputPayManaOfCostPayment' and s['nativeAutoPayments']==0
assert s['buttons']['okEnabled'] and s['buttons']['cancelEnabled']
send('cancel');record(s,'full-payment-cancelled')
own=next(p for p in s['players'] if p['isViewer'])
assert any(c['id']==ring['id'] for c in own['zones']['Hand']['cards'])
assert not next(c for c in own['zones']['Battlefield']['cards'] if c['id']==land['id'])['tapped']
assert s['inputType']=='InputPassPriority' and not s['busy']
# Same visible user intention now uses only Forge's own enabled native Auto button.
send('controlMode',value='smart');send('card',id=ring['id']);record(s,'smart-native-auto-paid')
assert s['prompt'] is None and s['inputType']=='InputPassPriority'
assert s['nativeAutoPayments']==1 and any(x['source']['id']==ring['id'] for x in s['stack'])
own=next(p for p in s['players'] if p['isViewer'])
assert next(c for c in own['zones']['Battlefield']['cards'] if c['id']==land['id'])['tapped']
send('ok')
assert any(c['id']==ring['id'] for p in s['players'] if p['isViewer'] for c in p['zones']['Battlefield']['cards'])
assert s['nativeAutoPayments']==1
print('PASS Smart explicit cast→native Auto→stack; Full override preserves payment/cancel; exactly one automatic native payment',flush=True)
