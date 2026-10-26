#!/usr/bin/env python3
"""Real process checks; emit only fixed-schema aggregate evidence."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest

host = Path(os.environ['FORGE_COMBINED_CANDIDATE_ROOT']) / 'host'
work = Path(os.environ['FORGE_COMBINED_WORK'])
report = {'schema': 'cardstashy.cleanup-preflight.v1', 'result': 'failed',
          'procfsMatchesNamespace': False, 'testsRun': 0, 'failures': 0,
          'errors': 0, 'skipped': 0, 'requiredTests': 11}
try:
    spec = importlib.util.spec_from_file_location('gateway_cleanup_preflight', host / 'container/gateway.py')
    gateway = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gateway)
    report['procfsMatchesNamespace'] = gateway.procfs_matches_pid_namespace()
    if report['procfsMatchesNamespace']:
        suite = unittest.TestSuite()
        for pattern in ['test_reaping_order.py', 'test_procfs_guard.py']:
            suite.addTests(unittest.defaultTestLoader.discover(str(host / 'container/tests'), pattern=pattern))
        result = unittest.TextTestRunner(stream=sys.stderr, verbosity=2).run(suite)
        report.update(testsRun=result.testsRun, failures=len(result.failures),
                      errors=len(result.errors), skipped=len(result.skipped))
        if result.wasSuccessful() and not result.skipped and result.testsRun == report['requiredTests']:
            report['result'] = 'passed'
finally:
    temporary = work / 'cleanup-preflight.json.new'
    temporary.write_text(json.dumps(report, indent=2) + '\n')
    temporary.replace(work / 'cleanup-preflight.json')
print(json.dumps(report))
raise SystemExit(0 if report['result'] == 'passed' else 1)
