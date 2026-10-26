"""Offline tests: no production URLs are requested by this suite."""

import importlib.util
from html.parser import HTMLParser
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlsplit

REPO = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("deployed_assets", REPO / "scripts/verify-deployed-assets.py")
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)


class DeployedAssetsTests(unittest.TestCase):
    def test_all_first_party_entry_dependencies_are_verified(self):
        class EntryDependencies(HTMLParser):
            def __init__(self):
                super().__init__()
                self.urls = []
                self.modulepreloads = []

            def handle_starttag(self, tag, attributes):
                attrs = dict(attributes)
                if tag == "script" and attrs.get("src"):
                    self.urls.append(attrs["src"])
                if tag == "link" and attrs.get("rel") in ("modulepreload", "stylesheet") and attrs.get("href"):
                    self.urls.append(attrs["href"])
                    if attrs["rel"] == "modulepreload":
                        self.modulepreloads.append(attrs["href"])

        parser = EntryDependencies()
        parser.feed((REPO / "index.html").read_text())
        self.assertTrue(parser.modulepreloads, "The public runtime module inventory must not be empty")
        covered = set(verifier.KEY_ASSETS + verifier.MODULES)
        self.assertEqual(len(verifier.MODULES), len(set(verifier.MODULES)), "Duplicate verifier asset")
        for url in parser.urls:
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc:
                continue  # Remote fonts/providers are not static release assets.
            self.assertFalse(parsed.query or parsed.fragment, url)
            asset = parsed.path.removeprefix("./").removeprefix("/")
            self.assertIn(asset, covered, f"Public entry dependency lacks exact deployment verification: {asset}")
            self.assertTrue((REPO / asset).is_file(), asset)
            for host in verifier.HOSTS:
                self.assertTrue(verifier.allowed_url(host + asset), asset)

    def test_expected_hashes_are_exact_checkout_bytes(self):
        expected = verifier.load_expected(REPO)
        for asset, info in expected.items():
            self.assertEqual(info["sha256"], verifier.sha256((REPO / asset).read_bytes()))
        self.assertEqual(expected["config.js"]["app_version"], json.loads((REPO / "package.json").read_text())["version"])
        self.assertRegex(expected["sw.js"]["service_worker_cache"], r"^cardforge-shell-(?:[a-z0-9]+-)*v\d+$")

    def test_markers_are_parsed_not_hardcoded(self):
        self.assertEqual(verifier.markers("config.js", b'export const APP_VERSION = "9.1.7";'), {"app_version": "9.1.7"})
        self.assertEqual(verifier.markers("sw.js", b"const CACHE = 'cardforge-shell-v999';"), {"service_worker_cache": "cardforge-shell-v999"})
        self.assertEqual(verifier.markers("config.js", b"<html>challenge</html>"), {"app_version": None})

    def test_status_and_bytes_cannot_false_pass(self):
        body = b'export const APP_VERSION = "9.1.7";\n'
        expected = {"sha256": verifier.sha256(body)}
        url = verifier.HOSTS[0] + "config.js"
        self.assertEqual(verifier.classify(url, "config.js", expected, 200, body)["state"], "VERIFIED")
        self.assertEqual(verifier.classify(url, "config.js", expected, 200, body.rstrip())["state"], "MISMATCH")
        for status in (403, 404, 301, 500, None):
            result = verifier.classify(url, "config.js", expected, status, body)
            self.assertEqual(result["state"], "UNVERIFIED")
            self.assertFalse(result["match"])
            self.assertIsNone(result["sha256"])
        self.assertFalse(verifier.all_match([]))

    def test_only_static_allowlisted_urls(self):
        for host in verifier.HOSTS:
            for url, _, _ in verifier.jobs_for(host, verifier.KEY_ASSETS, verifier.load_expected(REPO), "abc-1"):
                self.assertTrue(verifier.allowed_url(url), url)
        for url in (
            "http://cardstashy.com/config.js", "https://other.example/config.js",
            "https://cardstashy.com/api/watch", "https://cardstashy.com/api/prices",
            "https://cardstashy.com/config.js?token=secret", "https://user:secret@cardstashy.com/config.js",
            "https://cardstashy.com/../api/watch", "https://cardstashy.com/config.js#secret",
        ):
            self.assertFalse(verifier.allowed_url(url), url)
        with self.assertRaises(ValueError):
            verifier.fetch(("https://cardstashy.com/api/watch", "config.js", {"sha256": "x"}))

    def test_redirects_never_followed(self):
        request = verifier.Request(verifier.HOSTS[0])
        with self.assertRaises(HTTPError):
            verifier.NoRedirects().redirect_request(request, None, 302, "redirect", {}, "https://other.example/")

    def test_html_diagnostics_do_not_normalize_or_hide_changes(self):
        original = b'<script src="app.js"></script><link rel="stylesheet" href="style.css">'
        changed = original + b'<script src="https://static.cloudflareinsights.com/beacon.min.js?token=omit"></script>'
        result = verifier.classify(verifier.HOSTS[0], "index.html", {"sha256": verifier.sha256(original)}, 200, changed)
        self.assertEqual(result["state"], "MISMATCH")
        self.assertFalse(result["match"])
        self.assertEqual(result["html_structure"]["scripts"], ["app.js", "https://static.cloudflareinsights.com/beacon.min.js"])
        self.assertNotIn("token", json.dumps(result))

    def test_canonical_entry_and_private_server_modules(self):
        jobs = verifier.jobs_for(verifier.HOSTS[0], verifier.KEY_ASSETS, verifier.load_expected(REPO), "abc-1")
        self.assertEqual(len(jobs), 6)
        self.assertEqual(jobs[0][0], verifier.HOSTS[0])
        self.assertFalse(any("/index.html" in row[0] for row in jobs))
        module_jobs = verifier.jobs_for(verifier.HOSTS[0], ("downloads/index.html",), {"downloads/index.html": {}})
        self.assertEqual(module_jobs[0][0], verifier.HOSTS[0] + "downloads/")
        self.assertTrue(verifier.allowed_url(module_jobs[0][0]))
        ignored = set((REPO / ".assetsignore").read_text().splitlines())
        self.assertFalse(set(verifier.MODULES) & ignored)
        self.assertNotIn("pricefeed.js", verifier.MODULES)
        self.assertNotIn("ai-ask-route.js", verifier.MODULES)
        self.assertNotIn("ai-review-route.js", verifier.MODULES)

    def test_full_coherence_report_and_failure_evidence(self):
        def exact(jobs):
            return [verifier.classify(url, asset, expected, 200, (REPO / asset).read_bytes()) for url, asset, expected in jobs]

        def denied(jobs):
            return [verifier.classify(url, asset, expected, 403, b"challenge") for url, asset, expected in jobs]

        with tempfile.TemporaryDirectory() as directory, patch("builtins.print"):
            output = Path(directory) / "report.json"
            with patch.object(verifier, "check_many", side_effect=exact) as checked:
                self.assertTrue(verifier.verify(REPO, output, wait_seconds=0))
                self.assertEqual(checked.call_count, 3)  # keys, modules, final keys
            report = json.loads(output.read_text())
            self.assertEqual(report["state"], "VERIFIED")
            self.assertEqual(len(report["attempts"][0]["hosts"]), 2)
            with patch.object(verifier, "check_many", side_effect=denied) as checked:
                self.assertFalse(verifier.verify(REPO, output, wait_seconds=0))
                self.assertEqual(checked.call_count, 1)  # No module requests before coherent keys.
            report = json.loads(output.read_text())
            self.assertEqual(report["state"], "UNVERIFIED")
            self.assertIn("finished_at", report)

    def test_html_mismatch_does_not_hide_other_asset_evidence(self):
        def transformed(jobs):
            results = []
            for url, asset, expected in jobs:
                body = (REPO / asset).read_bytes()
                if url.startswith(verifier.HOSTS[0]) and asset == "index.html":
                    body += b'<!-- edge transform -->'
                results.append(verifier.classify(url, asset, expected, 200, body))
            return results
        with tempfile.TemporaryDirectory() as directory, patch("builtins.print"):
            output = Path(directory) / "report.json"
            with patch.object(verifier, "check_many", side_effect=transformed) as checked:
                self.assertFalse(verifier.verify(REPO, output, wait_seconds=0))
                self.assertEqual(checked.call_count, 2)
            report = json.loads(output.read_text())
            for host in verifier.HOSTS:
                rows = report["attempts"][0]["hosts"][host]["modules"]
                self.assertTrue(verifier.all_match(rows))
                self.assertEqual(len(rows), len(verifier.MODULES))


if __name__ == "__main__":
    unittest.main()
