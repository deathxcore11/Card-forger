#!/usr/bin/env python3
"""Runs INSIDE one --network none proof container; stdout is redacted evidence."""
import http.client, json, re, sys, time
def prove_native_action(call, state, epoch):
    """Require one canonical offered move; every negative guard precedes dispatch."""
    prompt = state.get('prompt')
    if not (prompt and prompt.get('supported') is True
            and prompt.get('method') in ('getChoices', 'showOptionDialog')):
        raise RuntimeError('native_action_proof_unavailable')
    minimum = prompt.get('min')
    options = prompt.get('options')
    if (type(minimum) is not int or minimum < 0 or not isinstance(options, list)
            or minimum > len(options)):
        raise RuntimeError('native_action_offer_invalid')
    indexes = [option['index'] for option in options[:minimum]]
    if any(type(index) is not int for index in indexes):
        raise RuntimeError('native_action_offer_invalid')
    action = {'revision': state['revision'], 'op': 'reply',
              'promptId': prompt['id'], 'indexes': indexes}
    for bearer in (None, 'invalid-proof-capability'):
        status, value, _ = call('GET', '/state', bearer=bearer)
        assert status == 401 and value == {'error': 'internal_authorization_required'}, 'capability_guard_failed'
    for rejected_epoch in (None, epoch + '-wrong'):
        status, value, _ = call('POST', '/action', action, rejected_epoch)
        assert status == 409 and value == {'error': 'native_generation_mismatch'}, 'epoch_guard_failed'
    assert call('POST', '/action', {'revision': -1, 'op': 'controlMode', 'value': 'full'}, epoch)[0] == 409
    assert call('POST', '/action', {'revision': state['revision'], 'op': 'controlMode', 'value': 'arbitrary'}, epoch)[0] == 400
    mode_guards = ['stale409', 'invalid400']
    if state.get('prompt') or state.get('busy'):
        assert call('POST', '/action', {'revision': state['revision'], 'op': 'controlMode', 'value': 'full'}, epoch)[0] == 409
        mode_guards.append('busy409')
    assert call('POST', '/action', action, epoch)[0] == 202, 'native_action_not_accepted'
    assert call('POST', '/action', action, epoch)[0] == 409, 'native_duplicate_not_rejected'
    return {'nativeAction': 'native_startup_reply202_duplicate409',
            'authGuards': 'missing401_wrong401', 'epochGuards': 'missing409_wrong409',
            'modeGuards': '_'.join(mode_guards)}


def main(payload):
    token=payload['internalToken']; started=time.monotonic()
    def call(method,path,body=None,epoch=None,bearer=token):
        conn=http.client.HTTPConnection('127.0.0.1',8080,timeout=5)
        headers={'Content-Type':'application/json'}
        if bearer is not None:headers['Authorization']='Bearer '+bearer
        if epoch:headers['X-Expected-Host-Epoch']=epoch
        encoded=None if body is None else json.dumps(body,separators=(',',':'),ensure_ascii=False).encode()
        try:
            conn.request(method,path,body=encoded,headers=headers);response=conn.getresponse();data=response.read(4*1024*1024+1)
            if len(data)>4*1024*1024:raise RuntimeError('response_size_limit')
            return response.status,json.loads(data) if data else None,response.getheader('X-Host-Epoch')
        finally:conn.close()
    for attempt in range(100):
        try:
            status,value,_=call('GET','/bootstrap-ready')
            if status==200 and value.get('protocol')=='cardstashy.match-input.v1':break
        except (OSError,ValueError,http.client.HTTPException):pass
        time.sleep(.1)
    else:raise RuntimeError('bootstrap_unready')
    assert call('POST','/initialize',{'input':payload['input']})[0]==204
    state=None;epoch=None
    while time.monotonic()-started<120:
        try:
            status,_,epoch=call('GET','/ready')
            if epoch:
                _,current,_=call('GET','/state')
                if current.get('status')=='failed':raise RuntimeError('native_exact_initialization_failed')
                if status==200:state=current;break
        except (OSError,ValueError,http.client.HTTPException):pass
        time.sleep(.2)
    assert state is not None,'native_startup_deadline'
    r=state['initialization']; expected=payload['expected']
    assert r['schema']=='cardstashy.forge-exact-initialization.v1'
    assert r['engineRevision']=='e5a0f8156da70ffc7866f923bed371c0111707cd'
    assert r['policyVersion']==payload['input']['difficultyPolicyVersion'] and r['aiProfile']=='Default'
    assert all(r[k] is True for k in ['supported','legal','registeredRosterVerified','nativeRosterVerified'])
    assert all(r[k]==expected[k] for k in ['requestDigest','humanDigest','opponentDigest'])
    assert all(re.fullmatch('[a-f0-9]{64}',r[k]) for k in ['humanRosterDigest','opponentRosterDigest'])
    assert r['viewerId']==state['viewer'] and r['errors']==[]
    for player in state['players']:
        assert player['deckCount']==100
        if not player['isViewer']:
            for zone in ['Hand','Library']:assert not player['zones'][zone]['cards']
    guards=prove_native_action(call,state,epoch)
    print(json.dumps({'result':'PASS','runtimeInternet':'disabled_network_none','coldStartSeconds':round(time.monotonic()-started,3),'sourceDigestsMatch':True,'registeredRosterVerified':True,'nativeRosterVerified':True,**guards,'noOpponentHiddenCards':True}))


if __name__ == '__main__':
    main(json.load(sys.stdin))
