#!/usr/bin/env python3
"""Read-only release evidence for the two public CardStashy static hosts.

No browser, API/provider requests, credentials, or redirects. A successful build
is not release evidence: every checked URL must serve the checkout's exact bytes.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

HOSTS = ("https://cardstashy.com/", "https://cardforge2.deathxcore11.workers.dev/")
KEY_ASSETS = ("index.html", "config.js", "sw.js")
MODULES = (
    "grid-settings.js", "price-origin.js", "collection-display.css",
    "aura.js", "aura.css",
    "brand-motion.css",
    "game-tabs.css", "game-tab-mtg.jpg", "game-tab-ygo.png", "game-tab-ptcg.jpg",
    "power.js", "deckpower.js", "insights.js", "builder.js", "planner.js", "deck-optimizer.js", "engine-map.js", "pairing.js", "scouting.js", "formats.js", "goldfish.js", "tier-card.js", "ai-review.js",
    "ai-build-contract.js", "ai-deck-goal.js", "coach-evidence.js", "commander-criteria.js", "commander-strategy.js", "mtg-effects.js",
    "ai-ask-loop.js", "ai-deck-builder.js", "meta-curation.js", "community-curation.css", "set-browser.js", "set-release-metadata.js",
    "magic-owned-detail.js",
    "pokemon-variant-options.js", "pokemon-promo-evidence.js",
    "magic-card-color.js", "magic-matchups-ui.js", "magic-matchups-controller.js", "magic-matchups.css", "ai-matchup-core.js", "settings-theme.js", "settings-theme.css", "theme-init.js", "recovery-store.js", "sync-merge.js", "value-page.js", "value-page.css", "value-history.js", "storage.js", "account-workspaces.js", "account-scope.js", "ygo-identity.js", "vendor/supabase-js-2.110.0.js",
    "finish-effects.js", "pokemon-anniversary-masks.js", "ygo-name-foil.js", "ygo-rarity-foil.js", "ygo-foil-analysis.js", "ygo-foil-recipes.js", "ygo-foil-worker.js", "foil-gl.js", "mtg-foil.js", "mtg-foil-analysis.js", "mtg-foil-recipes.js", "mtg-foil-worker.js", "finish-effects.css", "finish-preview.js", "finish-materials.js", "feel.js",
    "assets/finishes/cosmos.svg", "assets/finishes/metal-grain.svg", "assets/finishes/abyss-title.svg",
    "scryfall-client.js", "community-profile.js", "shared-deck-view.js", "binders.js", "suggest.js", "deck-box.js", "brand.js", "card-detail-extras.js",
    "condition-feed.js", "condition-refresh-scheduler.js", "condition-value.js",
    "profile-art.js", "pokemon-identity.js", "pokemon-corrections.js", "collection-stack.js", "ygo-set-prices.js", "cloud.js",
    "printing-picker.js", "printing-picker.css", "catalog-tools.js", "scanner-printing.js",
    "ygo.js", "set-list-ui.js", "sets-ui.css", "emblems.js", "ai-tools.js", "sheet-history.js",
    "app.js", "core.js", "scancam.js", "scan-batch.js", "scan-signals.js", "scan.js", "scan-catalog.js",
    "scan-vision.js", "scansession.js", "tcg.js", "ptcg.js", "ui.js",
    "views.js", "confidence.js", "mtg-tcgprice.js", "style.css",
    "home-search.js", "app-info.js", "tabletop.js", "settings-dialog.js", "tour.js",
    "home-ui.js", "home-deck-activity.js", "home-swipe.js", "game-navigation.js", "tour-scenes.js", "community-feed.js", "community-art.js", "community-sources.js",
    "ai-rules.js", "ai-rules-panel.js",
    "pricing-presentation.js", "workbench-ui.js", "artwork.js", "zoom.js", "pokemon-art.js", "meta.js",
    "historical-archive.js", "recent-history.js", "shared-history.js", "ygo-history-identity.js",
    "rules.js", "rule-learning.js", "rule-lessons.js", "rule-dex.js", "rule-reference.js", "rule-corpus.js",
    # Keep the full first-party entry-page dependency inventory covered. The
    # offline regression checks modulepreloads, scripts and stylesheets against
    # this fixed allowlist; it never follows arbitrary URLs from page content.
    "adapt.js", "ai-ask.js", "ai-ui.js", "auth-form.js", "auto-browse.js", "build-overlay.js", "buy.js", "card-actions.js",
    "collection-locations.js", "collection-sort.js", "daily-clock.js", "deck-flow.js", "deck-safety.js", "deckaudit.js",
    "dialog.js", "extras.js", "facts.js", "feedback-layer.js", "format-upgrades.js", "games.js", "glass-select.js", "guide.js",
    "icons.js", "importance.js", "install.js", "matchup.js", "matchups-ui.js", "mtg-cheap.js", "mtg-route-coverage.js", "mtg-tags.js",
    "password-auth.js", "pokemon-catalogue-supplement.js", "pokemon-prices.js", "pokemon-role.js", "pokemon-set-art.js",
    "price-reference.js", "pricehist.js", "printing-carousel.js", "ptcg-glc-rules.js", "ptcg-product.js", "quick-quantity.js",
    "rule-hover.js", "scanart.js", "scanner-lookup.js", "scanner-review.js", "share.js", "sharedprices.js", "store.js",
    "strategy-risk.js", "strategy.js", "tabletop-themes.js", "tcgbuild.js", "tcgcompare.js", "tier.js", "tiles.js", "trade.js",
    "ygo-price-selection.js", "ygo-prices.js",
)
MAX_BYTES = 8 * 1024 * 1024
REQUEST_TIMEOUT = 15
CONCURRENCY = 6


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def html_structure(data):
    """Diagnostic only: never turn a changed HTML response into a hash pass."""
    class Structure(HTMLParser):
        def __init__(self):
            super().__init__()
            self.scripts, self.stylesheets = [], []
            self.inline_scripts = 0

        def handle_starttag(self, tag, attributes):
            attrs = dict(attributes)
            if tag == "script":
                source = attrs.get("src")
                if source:
                    # Paths identify edge injections; query values are unnecessary.
                    parsed = urlsplit(source)
                    self.scripts.append((parsed.scheme + "://" + parsed.netloc if parsed.netloc else "") + parsed.path)
                else:
                    self.inline_scripts += 1
            if tag == "link" and attrs.get("rel") == "stylesheet" and attrs.get("href"):
                parsed = urlsplit(attrs["href"])
                self.stylesheets.append((parsed.scheme + "://" + parsed.netloc if parsed.netloc else "") + parsed.path)
    parser = Structure()
    parser.feed(data.decode("utf-8", errors="replace"))
    return {"scripts": parser.scripts, "stylesheets": parser.stylesheets, "inline_script_count": parser.inline_scripts}


def markers(asset, data):
    patterns = {
        "config.js": ("app_version", rb'\bAPP_VERSION\s*=\s*[\'\"]([^\'\"]+)[\'\"]'),
        "sw.js": ("service_worker_cache", rb'\bCACHE\s*=\s*[\'\"]([^\'\"]+)[\'\"]'),
    }
    if asset not in patterns:
        return {}
    key, pattern = patterns[asset]
    match = re.search(pattern, data)
    return {key: match.group(1).decode("utf-8", errors="replace") if match else None}


def load_expected(repo):
    expected = {}
    for asset in KEY_ASSETS + MODULES:
        data = (repo / asset).read_bytes()
        expected[asset] = {"sha256": sha256(data), "bytes": len(data), **markers(asset, data)}
        if asset == "index.html":
            expected[asset]["html_structure"] = html_structure(data)
    if not expected["config.js"]["app_version"] or not expected["sw.js"]["service_worker_cache"]:
        raise ValueError("The checkout's app/SW version markers could not be parsed")
    return expected


def allowed_url(url):
    parsed = urlsplit(url)
    return (
        parsed.scheme == "https"
        and parsed.netloc in {urlsplit(host).netloc for host in HOSTS}
        and parsed.path in {"/", *("/" + name for name in KEY_ASSETS + MODULES)}
        and not parsed.fragment
        and (not parsed.query or re.fullmatch(r"_releasecheck=[a-zA-Z0-9-]+", parsed.query) is not None)
    )


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise HTTPError(request.full_url, code, "Redirect not followed", headers, fp)


def classify(url, asset, expected, status, data, headers=None, error=None):
    headers = headers or {}
    result = {
        "url": url, "asset": asset, "checked_at": utc_now(), "http_status": status,
        "sha256": None, "expected_sha256": expected["sha256"], "match": False,
        "state": "UNVERIFIED",
    }
    # Save only selected diagnostics. Never record response HTML, cookies, or keys.
    result["cache"] = {key: headers[key] for key in ("CF-Cache-Status", "Age", "ETag", "Content-Encoding") if key in headers}
    if error:
        result["error"] = error
    elif status != 200:
        result["error"] = "HTTP response does not verify this asset"
    elif len(data) > MAX_BYTES:
        result["error"] = "Response exceeds the static-asset size limit"
    else:
        result.update(sha256=sha256(data), bytes=len(data), **markers(asset, data))
        result["match"] = result["sha256"] == expected["sha256"]
        result["state"] = "VERIFIED" if result["match"] else "MISMATCH"
        if asset == "index.html":
            result["html_structure"] = html_structure(data)
    return result


def fetch(job):
    url, asset, expected = job
    if not allowed_url(url):
        raise ValueError("Refusing a URL outside the fixed public static-asset allowlist")
    request = Request(url, headers={
        "User-Agent": "CardStashy-ReleaseVerifier/1.0 (public static assets only)",
        "Accept-Encoding": "identity",
    })
    try:
        with build_opener(NoRedirects()).open(request, timeout=REQUEST_TIMEOUT) as response:
            return classify(url, asset, expected, response.status, response.read(MAX_BYTES + 1), response.headers)
    except HTTPError as error:
        # In particular, 403 is UNVERIFIED, never an excuse to bypass protection.
        result = classify(url, asset, expected, error.code, b"", error.headers,
                          "HTTP %s; no redirect, authentication, or challenge attempted" % error.code)
        error.close()
        return result
    except (URLError, TimeoutError, OSError) as error:
        return classify(url, asset, expected, None, b"", error=type(error).__name__)


def jobs_for(host, assets, expected, nonce=None):
    # Cloudflare's default HTML handling serves index.html at the canonical /
    # and redirects /index.html. Verify the actual entry URL without redirects.
    paths = [("" if asset == "index.html" else asset, asset) for asset in assets]
    jobs = []
    for path, asset in paths:
        jobs.append((host + path, asset, expected[asset]))
        if nonce is not None:
            jobs.append((host + path + "?_releasecheck=" + nonce, asset, expected[asset]))
    return jobs


def check_many(jobs):
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        return list(pool.map(fetch, jobs))


def all_match(results):
    return bool(results) and all(result["match"] for result in results)


def save_report(path, report):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def summarize(stage, host, results):
    matched = sum(result["match"] for result in results)
    print(f"{utc_now()} {host} {stage}: {matched}/{len(results)} exact-byte matches", flush=True)
    for result in results:
        # One compact line per URL; the full hashes and versions also remain in JSON.
        print(json.dumps({key: result.get(key) for key in (
            "url", "http_status", "sha256", "app_version", "service_worker_cache", "state", "error"
        ) if key in result}, separators=(",", ":")), flush=True)


def verify(repo, output, wait_seconds=360, interval_seconds=20):
    started = time.monotonic()
    report = {
        "started_at": utc_now(), "git_sha": None, "state": "UNVERIFIED",
        "scope": "Public static HTTP bytes only; not browser behavior, provider/API health, or global CDN coverage",
        "request_timeout_seconds": REQUEST_TIMEOUT, "concurrency": CONCURRENCY,
        "propagation_window_seconds": wait_seconds, "poll_interval_seconds": interval_seconds,
        "attempts": [],
    }
    save_report(output, report)
    try:
        expected = load_expected(repo)
        report["expected"] = expected
        report["git_sha"] = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo, text=True, timeout=5
        ).strip()
        print(f"Checkout {report['git_sha']}; app {expected['config.js']['app_version']}; "
              f"SW {expected['sw.js']['service_worker_cache']}", flush=True)
        deadline = started + wait_seconds
        module_results = {}
        while True:
            number = len(report["attempts"]) + 1
            nonce = f"{report['git_sha'][:12]}-{time.time_ns()}-{number}"
            attempt = {"number": number, "started_at": utc_now(), "hosts": {}}
            report["attempts"].append(attempt)
            key_jobs = [job for host in HOSTS for job in jobs_for(host, KEY_ASSETS, expected, nonce)]
            keys = check_many(key_jobs)
            for host in HOSTS:
                rows = [row for row in keys if row["url"].startswith(host)]
                attempt["hosts"][host] = {"key_assets": rows, "state": "UNVERIFIED"}
                summarize("keys (regular + cache-busted)", host, rows)
            save_report(output, report)
            eligible = []
            for host in HOSTS:
                # An HTML transformation on one domain must not prevent collecting
                # module evidence on either host. The HTML mismatch still fails.
                version_rows = [row for row in keys if row["url"].startswith(host) and row["asset"] != "index.html"]
                if not all_match(version_rows):
                    module_results.pop(host, None)
                elif not all_match(module_results.get(host, [])):
                    eligible.append(host)
            if eligible:
                modules = check_many([job for host in eligible for job in jobs_for(host, MODULES, expected)])
                for host in eligible:
                    module_results[host] = [row for row in modules if row["url"].startswith(host)]
                    summarize("modules", host, module_results[host])
            for host, rows in module_results.items():
                attempt["hosts"][host]["modules"] = rows
            save_report(output, report)
            if all_match(keys):
                if all(all_match(module_results.get(host, [])) for host in HOSTS):
                    # Avoid declaring success if the deployment changed during the module pass.
                    final_keys = check_many([job for host in HOSTS for job in jobs_for(
                        host, KEY_ASSETS, expected, nonce + "-final")])
                    for host in HOSTS:
                        rows = [row for row in final_keys if row["url"].startswith(host)]
                        attempt["hosts"][host]["final_key_assets"] = rows
                        attempt["hosts"][host]["state"] = "VERIFIED" if all_match(rows) else "UNVERIFIED"
                        summarize("final coherence", host, rows)
                    if all_match(final_keys):
                        report["state"] = "VERIFIED"
                        break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            print(f"Release is not coherent yet; checking again in {min(interval_seconds, remaining):.0f}s", flush=True)
            time.sleep(min(interval_seconds, remaining))
    except Exception as error:
        # Preserve partial evidence if local expectations or an unexpected transport fail.
        report["error"] = f"{type(error).__name__}: {error}"
    finally:
        report["finished_at"] = utc_now()
        report["elapsed_seconds"] = round(time.monotonic() - started, 2)
        save_report(output, report)
    print(f"{report['state']}: evidence saved to {output}", flush=True)
    return report["state"] == "VERIFIED"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("test-results/deployed-assets.json"))
    args = parser.parse_args()
    return 0 if verify(Path(__file__).resolve().parent.parent, args.output) else 1


if __name__ == "__main__":
    raise SystemExit(main())
