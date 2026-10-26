exec(compile(open(__file__.replace('test-deferred-cancel.py','test-http.py')).read(),'test-http.py','exec'))
# Actual native mana ability creates floating mana; no fixture state mutation.
assert action(s,'card',id=ring['id'])[0]==202
s=wait(s);record(s,'floating-mana-menu')
while s['prompt']:
 assert s['prompt']['method']=='getAbilityToPlay'
 assert action(s,'reply',promptId=s['prompt']['id'],indexes=[0])[0]==202
 s=wait(s)
record(s,'floating-mana')
own=next(p for p in s['players'] if p['isViewer']);assert own['mana']['C']==2
old=s
assert action(s,'ok')[0]==202
# The async native confirmation has not necessarily appeared yet: a duplicate must still be rejected.
assert action(old,'ok')[0]==409
s=wait(s);record(s,'floating-confirm')
assert s['prompt']['method']=='showConfirmDialog'
assert action(s,'reply',promptId=s['prompt']['id'],value='false')[0]==400
assert action(s,'reply',promptId=s['prompt']['id'],value=False)[0]==202
s=wait(s);record(s,'floating-confirm-cancelled')
assert not s['busy'] and s['inputType']=='InputPassPriority' and s['prompt'] is None
assert next(p for p in s['players'] if p['isViewer'])['mana']['C']==2
assert action(s,'ok')[0]==202
s=wait(s);record(s,'floating-confirm-retry')
assert s['prompt']['method']=='showConfirmDialog'
assert action(s,'reply',promptId=s['prompt']['id'],value=True)[0]==202
s=wait(s);record(s,'floating-confirm-proceed')
print('PASS native deferred floating-mana cancel→same priority→retry→proceed; duplicate gap command rejected; strict boolean rejected',flush=True)
