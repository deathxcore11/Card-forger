# SPDX-License-Identifier: GPL-3.0-or-later
"""Real Linux process fixtures with explicit, bounded reap-race injection."""
from pathlib import Path
import subprocess
import sys
import unittest

HERE = Path(__file__).resolve().parents[1]
SUPERVISOR = r'''
import ctypes, importlib.util, os, signal, subprocess, sys, time
assert ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0
spec = importlib.util.spec_from_file_location("gateway", sys.argv[1])
gateway = importlib.util.module_from_spec(spec); spec.loader.exec_module(gateway)
real_killpg, real_waitpid, real_alive = os.killpg, os.waitpid, gateway.group_alive
descendant = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print('ready',flush=True); time.sleep(30)"
leader_code = "import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c'," + repr(descendant) + "],stdout=subprocess.PIPE,text=True); p.stdout.readline(); print(p.pid,flush=True); time.sleep(30)"
leader = subprocess.Popen([sys.executable, '-c', leader_code], stdout=subprocess.PIPE, text=True, start_new_session=True)
child = int(leader.stdout.readline())
def state(pid):
    try:
        with open('/proc/%s/stat' % pid) as f: return f.read().rpartition(')')[2].split()[0]
    except FileNotFoundError: return None
def wait_zombie():
    deadline = time.monotonic() + 1
    while state(child) != 'Z' and time.monotonic() < deadline: time.sleep(.001)
    assert state(child) == 'Z', 'expected actual stopped but unreaped descendant'
try:
    mode = sys.argv[2]
    if mode == 'race':
        killed = deferred = False
        def killpg(pgid, sig):
            global killed
            real_killpg(pgid, sig)
            if sig == signal.SIGKILL: killed = True
        def waitpid(pid, flags):
            global deferred
            if pid == -leader.pid and killed and not deferred:
                # Model WNOHANG observing the child just before its exit, even
                # if the scheduler has already made it waitable in this run.
                deferred = True
                return (0, 0)
            return real_waitpid(pid, flags)
        def alive(pgid):
            if killed and state(child) is not None: wait_zombie()
            return real_alive(pgid)
        gateway.os.killpg, gateway.os.waitpid, gateway.group_alive = killpg, waitpid, alive
        gateway.terminate(leader, grace=.02, kill_grace=.3)
        assert deferred, 'race injection must be exercised'
        assert state(child) is None, 'terminated descendant must also be reaped'
        assert not real_alive(leader.pid)
    elif mode == 'states':
        assert real_alive(leader.pid), 'live TERM-resistant child must count as live'
        real_killpg(leader.pid, signal.SIGKILL)
        leader.wait(timeout=1)
        wait_zombie()
        assert not real_alive(leader.pid), 'a zombie is stopped, not a live process'
        gateway.terminate(leader, grace=.02, kill_grace=.3)
        assert state(child) is None
    elif mode in ('live_bound', 'zombie_bound'):
        if mode == 'live_bound':
            gateway.os.killpg = lambda *_: None  # Simulate ineffective signals.
            assert real_alive(leader.pid)
        else:
            real_killpg(leader.pid, signal.SIGKILL)
            leader.wait(timeout=1)
            wait_zombie()
            assert not real_alive(leader.pid)
            gateway.os.waitpid = lambda pid, flags: (0, 0) if pid == -leader.pid else real_waitpid(pid, flags)
        started = time.monotonic()
        try: gateway.terminate(leader, grace=.02, kill_grace=.05)
        except RuntimeError as error: assert str(error) == 'native_process_group_cleanup_unconfirmed'
        else: raise AssertionError('cleanup must not claim success with outstanding live or unreaped children')
        assert time.monotonic() - started < .5, 'cleanup must have a total bounded wait'
        assert real_alive(leader.pid) if mode == 'live_bound' else state(child) == 'Z'
    else: raise AssertionError('unknown fixture mode')
    print(mode + ': pass')
finally:
    gateway.os.killpg, gateway.os.waitpid, gateway.group_alive = real_killpg, real_waitpid, real_alive
    try: real_killpg(leader.pid, signal.SIGKILL)
    except ProcessLookupError: pass
    leader.wait(timeout=1)
    leader.stdout.close()
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        try:
            if real_waitpid(-1, os.WNOHANG)[0] == 0: time.sleep(.001)
        except ChildProcessError: break
    else: raise AssertionError('fixture descendants not reaped')
'''


@unittest.skipUnless(sys.platform.startswith("linux"), "Container target is Linux")
class ReapingOrderTests(unittest.TestCase):
    def fixture(self, mode):
        result = subprocess.run([sys.executable, "-c", SUPERVISOR, str(HERE / "gateway.py"), mode],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(mode + ": pass", result.stdout)

    def test_exit_between_waitpid_and_group_observation_is_reaped(self):
        self.fixture("race")

    def test_stopped_zombie_is_not_a_live_descendant_but_is_reaped(self):
        self.fixture("states")

    def test_live_descendant_cannot_produce_success_or_unbounded_wait(self):
        self.fixture("live_bound")

    def test_unreapable_zombie_cannot_produce_success_or_unbounded_wait(self):
        self.fixture("zombie_bound")


if __name__ == "__main__":
    unittest.main()
