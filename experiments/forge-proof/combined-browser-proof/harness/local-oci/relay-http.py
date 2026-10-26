"""LOCAL_TEST_NOT_DEPLOYABLE. Fixed offline loopback relay; typed JSON on stdin.
Never print request headers/body, native errors, tracebacks or arbitrary URLs.
"""
import base64, http.client, json, sys, time
MAX_INPUT=400000
MAX_BODY=4*1024*1024
ROUTES={('GET','/bootstrap-ready'),('POST','/initialize'),('GET','/ready'),('GET','/state'),('POST','/action')}
HEADERS={'authorization','content-type','content-length','x-expected-host-epoch'}
OUT_HEADERS={'content-type','cache-control','content-length','x-content-type-options','x-host-epoch','x-host-native-source-sha256','x-host-native-manifest-sha256'}
def main():
    raw=sys.stdin.buffer.read(MAX_INPUT+1)
    if len(raw)>MAX_INPUT: raise ValueError('bounded_request_required')
    request=json.loads(raw)
    if set(request)!={'method','path','headers','bodyBase64'} or (request['method'],request['path']) not in ROUTES: raise ValueError('route_not_allowed')
    incoming=request['headers']
    if not isinstance(incoming,dict) or any(k not in HEADERS or not isinstance(v,str) or len(v)>8192 or '\r' in v or '\n' in v for k,v in incoming.items()): raise ValueError('headers_not_allowed')
    body=base64.b64decode(request['bodyBase64'],validate=True)
    if len(body)>262144 or request['method']=='GET' and body: raise ValueError('bounded_request_required')
    if 'content-length' in incoming and incoming['content-length']!=str(len(body)): raise ValueError('length_mismatch')
    if request['method']=='POST': incoming={**incoming,'content-length':str(len(body))}
    deadline=time.monotonic()+4.5
    conn=http.client.HTTPConnection('127.0.0.1',8080,timeout=4.5)
    try:
        conn.request(request['method'],request['path'],body=body if request['method']=='POST' else None,headers=incoming)
        response=conn.getresponse();headers={}
        for name,value in response.getheaders():
            name=name.lower()
            if name in OUT_HEADERS:
                if name in headers or len(value)>8192 or '\r' in value or '\n' in value: raise ValueError('invalid_response_headers')
                headers[name]=value
        data=bytearray()
        while True:
            remaining=deadline-time.monotonic()
            if remaining<=0: raise TimeoutError('relay_deadline')
            sock=conn.sock or getattr(getattr(response.fp,'raw',None),'_sock',None)
            if sock is not None:sock.settimeout(remaining)
            chunk=response.read1(min(65536,MAX_BODY+1-len(data)))
            if not chunk:break
            data.extend(chunk)
            if len(data)>MAX_BODY:raise ValueError('response_size_limit')
        print(json.dumps({'scope':'LOCAL_TEST_NOT_DEPLOYABLE','status':response.status,'headers':headers,'bodyBase64':base64.b64encode(data).decode()},separators=(',',':')))
    finally:conn.close()
if __name__=='__main__':
    try:main()
    except BaseException:
        # The caller treats this as transport uncertainty; never replay a POST.
        sys.stderr.write('LOCAL_TEST_RELAY_FAILED\n');sys.exit(1)
