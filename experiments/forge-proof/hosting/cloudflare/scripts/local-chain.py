#!/usr/bin/env python3
"""Bounded full local chain. No originals changed; no Docker/network downloads.

Usage: python local-chain.py FORGE_PROOF_ROOT EXACT_CANDIDATE_ROOT GATEWAY_PY INPUT_JSON
Uses actual bootstrap HTTP handler, exact-gated gateway.main/launch_command,
real compiled Java, host nativeAdapter and GatewayDriver. Only immutable image
paths/ephemeral ports are substituted in this LOCAL test. Its manifest is test
metadata, not permission to deploy the candidate.
"""
from pathlib import Path
from unittest.mock import patch
import hashlib, importlib.util, json, os, shutil, signal, socket, subprocess, sys, tempfile, threading, time
HERE = Path(__file__).resolve().parents[1]
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path); result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result

def run(proof, candidate, gateway_path, input_path):
    bootstrap = module('chain_bootstrap', HERE / 'container/bootstrap.py')
    gateway = module('chain_gateway', gateway_path)
    token = 'synthetic-local-chain-capability-not-a-persistent-secret'
    with tempfile.TemporaryDirectory(prefix='forge-exact-chain-') as directory:
        root = Path(directory); runtime = root / 'runtime'; distribution = root / 'distribution'
        runtime.mkdir(); classes = distribution / 'adapter/classes'; classes.mkdir(parents=True)
        source_dir = distribution / 'adapter/src/cardstashy/forge'; source_dir.mkdir(parents=True)
        sources = list((candidate / 'adapter/src/cardstashy/forge').glob('*.java'))
        for source in sources: shutil.copy2(source, source_dir / source.name)
        (distribution / 'forge').symlink_to(proof / 'forge'); (distribution / 'decks').symlink_to(candidate / 'decks')
        cp = ':'.join([str(classes)] + [str(proof / 'forge' / name / 'target/classes') for name in ['forge-core','forge-game','forge-ai','forge-gui','forge-gui-desktop']] + [(proof / 'forge/forge-gui-desktop/target/runtime-classpath.txt').read_text()])
        (distribution / 'runtime-classpath.txt').write_text(cp)
        subprocess.run([str(proof / 'tools/jdk21/bin/javac'), '-cp', cp, '-d', str(classes), *map(str, source_dir.glob('*.java'))], check=True, timeout=90, stdout=subprocess.DEVNULL)
        manifest = root / 'local-test-checkpoint.json'
        source_hash = hashlib.sha256((source_dir / 'ForgeHttpBridge.java').read_bytes()).hexdigest()
        manifest.write_text(json.dumps({'localTestOnly': True, 'adapterCapabilities': ['cardstashy.match-input.v1'], 'sha256': {gateway.ADAPTER_MANIFEST_PATH: source_hash}}))
        exact_file = runtime / 'match-input.json'
        server = bootstrap.BootstrapServer(('127.0.0.1', 0), token, exact_file); port = server.server_port
        with socket.socket() as sock: sock.bind(('127.0.0.1', 0)); native_port = sock.getsockname()[1]
        client = subprocess.Popen(['node', str(HERE / 'scripts/local-chain-client.mjs'), f'http://127.0.0.1:{port}', str(input_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        started = time.monotonic(); children = []; done = threading.Event(); active = threading.Event(); outputs = []
        def watch_client():
            try:
                outputs.append(client.communicate(timeout=150))
            except subprocess.TimeoutExpired:
                client.kill(); outputs.append(client.communicate())
            finally:
                done.set()
                # gateway.main installs its own handler; do not signal until then.
                if children and active.is_set(): os.kill(os.getpid(), signal.SIGTERM)
        observer = threading.Thread(target=watch_client, daemon=True); observer.start()
        while not server.accepted and time.monotonic() - started < 125 and not done.is_set(): server.handle_request()
        server.server_close()
        if not server.accepted:
            client.kill(); observer.join(timeout=2); raise RuntimeError('bootstrap failed')
        assert exact_file.read_bytes() == json.dumps(json.loads(input_path.read_text()), separators=(',', ':'), ensure_ascii=False).encode(), 'Bootstrap changed exact JSON bytes'
        original_bridge, original_server, original_launch = gateway.Bridge, gateway.Server, gateway.launch
        def paths(value):
            value = str(value)
            if value == '/run/cardstashy': return runtime
            if value == gateway.EXACT_INPUT_PATH: return exact_file
            if value == '/opt/host001/checkpoint-files.json': return manifest
            if value.startswith('/opt/forge-proof'): return distribution / Path(value).relative_to('/opt/forge-proof')
            return Path(value)
        def launch(actual_root):
            child = original_launch(actual_root); children.append(child); return child
        old_term, old_int = signal.getsignal(signal.SIGTERM), signal.getsignal(signal.SIGINT)
        try:
            with patch.object(gateway, 'EXACT_INPUT_PATH', str(exact_file)), patch.object(gateway, 'Path', paths), patch.object(gateway, 'NATIVE_PORT', native_port), patch.object(gateway, 'Bridge', lambda a,b: original_bridge(a,b,native_port)), patch.object(gateway, 'Server', lambda address, bridge: original_server(('127.0.0.1', port),bridge)), patch.object(gateway, 'launch', launch), patch.dict(os.environ, {'HOST_INTERNAL_TOKEN':token, 'HOST_MATCH_INPUT_PATH':str(exact_file), 'HOST_ABSOLUTE_DEADLINE_MS':str(int(time.time()*1000)+180000), 'HOST_SEED':'20261025', 'PATH':str(proof/'tools/jdk21/bin')+':'+os.environ['PATH']}):
                active.set()
                gateway.main()
        finally:
            active.clear()
            signal.signal(signal.SIGTERM, old_term); signal.signal(signal.SIGINT, old_int)
            if client.poll() is None: client.kill()
            observer.join(timeout=5)
            for child in children:
                if child.poll() is None: gateway.terminate(child)
        stdout, stderr = outputs[0] if outputs else ('','client output missing')
        if client.returncode != 0: raise RuntimeError('client failed: ' + stderr[-3000:])
        result = json.loads(stdout.strip().splitlines()[-1]); result.update({'seconds':round(time.monotonic()-started,3), 'jvmStopConfirmed':all(c.poll() is not None for c in children), 'nativeSourceSha256':source_hash, 'exactInputRemovedWithPrivateRuntime':True})
        print(json.dumps(result))
if __name__ == '__main__': run(*map(lambda p: Path(p).resolve(), sys.argv[1:]))
