# SPDX-License-Identifier: GPL-3.0-or-later
"""Fail closed on mismatched procfs; never replace the real reaping fixtures."""
from pathlib import Path
import importlib.util
import os
import signal
import subprocess
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('gateway_proc_guard', Path(__file__).resolve().parents[1] / 'gateway.py')
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)


class ProcfsGuardTests(unittest.TestCase):
    def observe(self, ids='123', pid=123, group=45, error=None):
        def read(path):
            if error:
                raise error
            if str(path) == '/proc/self/status':
                return 'Name:\tfixture\nNSpid:\t' + ids + '\n'
            return f'{pid} (fixture name) S 1 {group} 0 0\n'
        with patch.object(gateway.Path, 'read_text', read), patch.object(gateway.os, 'getpid', return_value=123), patch.object(gateway.os, 'getpgrp', return_value=45):
            return gateway.procfs_matches_pid_namespace()

    def test_matching_single_namespace(self):
        self.assertTrue(self.observe())

    def test_ancestor_procfs_even_if_numeric_ids_coincide(self):
        self.assertFalse(self.observe(ids='123 123'))

    def test_wrong_pid_or_process_group(self):
        self.assertFalse(self.observe(pid=456))
        self.assertFalse(self.observe(group=99))

    def test_unreadable_procfs_is_uncertain(self):
        self.assertFalse(self.observe(error=PermissionError()))

    def test_existing_group_cannot_be_declared_stopped_without_coherent_procfs(self):
        with patch.object(gateway.os, 'killpg'), patch.object(gateway, 'procfs_matches_pid_namespace', return_value=False):
            self.assertTrue(gateway.group_alive(123))

    def test_kernel_absence_remains_authoritative(self):
        with patch.object(gateway.os, 'killpg', side_effect=ProcessLookupError()):
            self.assertFalse(gateway.group_alive(123))

    def test_real_child_cannot_disappear_when_procfs_is_uncertain(self):
        child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'], start_new_session=True)
        try:
            with patch.object(gateway, 'procfs_matches_pid_namespace', return_value=False):
                self.assertTrue(gateway.group_alive(child.pid))
                gateway.terminate(child, grace=.05, kill_grace=.3)
            self.assertIsNotNone(child.poll())
            with self.assertRaises(ProcessLookupError):
                os.killpg(child.pid, 0)
        finally:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=1)


if __name__ == '__main__':
    unittest.main()
