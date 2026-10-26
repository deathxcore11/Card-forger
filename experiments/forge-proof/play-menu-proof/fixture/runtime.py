#!/usr/bin/env python3
"""LOCAL TEST provider shim: unchanged bootstrap and gateway, path/port mapping only.
No alternate native protocol, state generation, deck conversion, or account exists.
"""
import importlib.util, json, os, signal, socket, sys, threading, time
from pathlib import Path
from unittest.mock import patch

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def run(distribution,gateway_file,bootstrap_file,runtime):
    os.umask(0o077)
    gateway=module('fixture_gateway',gateway_file);bootstrap=module('fixture_bootstrap',bootstrap_file)
    token=os.environ['HOST_INTERNAL_TOKEN'];exact_file=runtime/'match-input.json';children=[]
    stopped=threading.Event()
    for sig in (signal.SIGTERM,signal.SIGINT):signal.signal(sig,lambda *_:stopped.set())
    server=bootstrap.BootstrapServer(('127.0.0.1',0),token,exact_file);port=server.server_port
    server.deadline=min(server.deadline,time.monotonic()+max(0,(int(os.environ['HOST_ABSOLUTE_DEADLINE_MS'])-time.time()*1000)/1000))
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));native_port=sock.getsockname()[1]
    print(json.dumps({'event':'bootstrap-listening','port':port}),flush=True)
    original_bridge,original_server,original_launch=gateway.Bridge,gateway.Server,gateway.launch
    def write_receipt(value):
        temporary=runtime/'lifecycle.tmp';temporary.write_text(json.dumps(value));temporary.replace(runtime/'lifecycle.json')
    def paths(value):
        value=str(value)
        if value=='/run/cardstashy':return runtime
        if value==gateway.EXACT_INPUT_PATH:return exact_file
        if value=='/opt/host001/checkpoint-files.json':return distribution/'local-test-checkpoint.json'
        if value.startswith('/opt/forge-proof'):return distribution/Path(value).relative_to('/opt/forge-proof')
        return Path(value)
    def launch(root):
        child=original_launch(root);children.append(child);write_receipt({'nativePgid':child.pid,'confirmed':False});return child
    failed=False
    try:
        while not server.accepted and not stopped.is_set() and time.monotonic()<server.deadline:server.handle_request()
        server.server_close()
        if not server.accepted or stopped.is_set():return
        with patch.object(gateway,'EXACT_INPUT_PATH',str(exact_file)),patch.object(gateway,'Path',paths),patch.object(gateway,'NATIVE_PORT',native_port),patch.object(gateway,'Bridge',lambda a,b:original_bridge(a,b,native_port)),patch.object(gateway,'Server',lambda address,bridge:original_server(('127.0.0.1',port),bridge)),patch.object(gateway,'launch',launch),patch.dict(os.environ,{'HOST_MATCH_INPUT_PATH':str(exact_file)}):
            gateway.main()
    except Exception:
        failed=True
    finally:
        server.server_close()
        confirmed=True
        for child in children:
            try:
                if child.poll() is None or gateway.group_alive(child.pid):gateway.terminate(child)
                confirmed=confirmed and child.poll() is not None and not gateway.group_alive(child.pid)
            except Exception:confirmed=False
        write_receipt({'confirmed':confirmed,'nativePgid':children[-1].pid if children else None,'nativeProcessesStarted':len(children),'interrupted':failed})
        print(json.dumps({'event':'runtime-stopped','confirmed':confirmed,'interrupted':failed}),flush=True)
        if not confirmed:raise SystemExit(2)
if __name__=='__main__':run(*[Path(p).resolve() for p in sys.argv[1:]])
