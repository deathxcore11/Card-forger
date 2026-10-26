"""SYNTHETIC HTTP mocks only: no sockets, Docker, image or native process."""
import base64, importlib.util, io, json, pathlib, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('local_test_relay',pathlib.Path(__file__).with_name('relay-http.py'))
relay=importlib.util.module_from_spec(spec);spec.loader.exec_module(relay)
class Input:
    def __init__(self,data):self.buffer=io.BytesIO(data)
class Socket:
    def settimeout(self,value):assert value>0
class Response:
    status=200
    def __init__(self,data=b'{"synthetic":true}',headers=None):self.data=io.BytesIO(data);self.headers=headers or [('Content-Type','application/json'),('X-Host-Epoch','SYNTHETIC_EPOCH'),('X-Host-Native-Source-SHA256','1'*64),('X-Host-Native-Manifest-SHA256','2'*64)]
    def getheaders(self):return self.headers
    def read1(self,size):return self.data.read(size)
class Connection:
    def __init__(self,response):self.response=response;self.sock=Socket();self.calls=[];self.closed=False
    def request(self,*args,**kwargs):self.calls.append((args,kwargs))
    def getresponse(self):return self.response
    def close(self):self.closed=True
class Relay(unittest.TestCase):
    def call(self,request,response=None):
        conn=Connection(response or Response());out=io.StringIO()
        def connect(host,port,timeout):self.assertEqual((host,port),('127.0.0.1',8080));self.assertLessEqual(timeout,4.5);return conn
        with patch.object(relay.http.client,'HTTPConnection',connect),patch.object(relay.sys,'stdin',Input(json.dumps(request).encode())),patch.object(relay.sys,'stdout',out):relay.main()
        return json.loads(out.getvalue()),conn
    def test_exact_loopback_and_identity_headers_preserved(self):
        result,conn=self.call({'method':'POST','path':'/action','headers':{'authorization':'Bearer SYNTHETIC_CAPABILITY','x-expected-host-epoch':'SYNTHETIC_EPOCH','content-type':'application/json'},'bodyBase64':base64.b64encode(b'{"synthetic":true}').decode()})
        self.assertEqual(result['headers']['x-host-epoch'],'SYNTHETIC_EPOCH');self.assertEqual(base64.b64decode(result['bodyBase64']),b'{"synthetic":true}');self.assertTrue(conn.closed)
        self.assertEqual(conn.calls[0][1]['body'],b'{"synthetic":true}');self.assertNotIn('SYNTHETIC_CAPABILITY',json.dumps(result))
    def test_forbidden_route_header_method_and_length(self):
        request={'method':'GET','path':'/state','headers':{},'bodyBase64':''}
        for changes in [{'path':'/state?viewer=1'},{'path':'http://outside.invalid/state'},{'method':'DELETE'},{'headers':{'cookie':'bad'}},{'headers':{'authorization':'Bearer x\r\nInjected: y'}},{'headers':{'content-length':'99'}}]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):self.call({**request,**changes})
    def test_duplicate_identity_header_and_oversized_response_fail(self):
        request={'method':'GET','path':'/state','headers':{},'bodyBase64':''}
        with self.assertRaises(ValueError):self.call(request,Response(headers=[('X-Host-Epoch','one'),('X-Host-Epoch','two')]))
        with self.assertRaises(ValueError):self.call(request,Response(data=b'x'*(relay.MAX_BODY+1)))
    def test_http_failure_is_not_rewritten_to_success(self):
        response=Response(b'{"error":"SYNTHETIC_FAILURE"}');response.status=503
        result,_=self.call({'method':'GET','path':'/ready','headers':{},'bodyBase64':''},response);self.assertEqual(result['status'],503)
if __name__=='__main__':unittest.main()
