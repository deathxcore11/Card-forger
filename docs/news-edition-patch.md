# Weekly news pods

This patch replaces source-directory cards in Home's news area with dated, source-backed stories. News and event directories remain compact links below the stories. Three reviewed stories bootstrap the edition for October 19–25, 2026; they expire on October 26 and never acquire a new publication/check date on visits. The normal publisher collector supplies subsequent editions.

Reviewed primary sources (checked October 23, 2026):

- Wizards, October 19: https://magic.wizards.com/en/news/announcements/reality-fracture-secret-lair-bundle-delayed — production/shipping delay, potentially after October 23; regional timing varies.
- Pokémon, October 22: https://www.pokemon.com/us/play-pokemon/about/mega-evolution/mega-evolution-delta-reign-rule-changes-announcement — announcement date October 22, effective date November 20. No unsupported claims about particular cards or bans are added.
- Konami, October 19: https://www.yugioh-card.com/en/limited/list_2026-10-19/ — Advanced Format update; Perfectron Hydradrive Dragon's exception begins November 11.

## Source recovery and cost

The existing daily 06:17 UTC cron now retries news sources daily, including after failures. Meta remains weekly. A durable per-day claim prevents duplicate source requests; a same-week retry cannot make another paid AI call, including after an ambiguous failure. The existing 14-request / $0.10 estimated text-curation ceiling is unchanged. Public GETs remain read-only. Fresh verified news survives an AI outage. Source failures preserve the previous snapshot. The bounded curator runs before unrelated Magic cache warming.

## Artwork

Created with the image-generation skill/tool; immutable article URL + source + game selects each asset. No remote/cache-supplied art URL can select an arbitrary image. The visible label is “AI illustration · not official artwork.” Original generated PNGs were encoded to WebP without changing composition. Total shipped art is about 400 KB. Assets and the edition module are included in the offline shell and deployment verifier, hence the Android shared-asset check.

Prompt subjects, each rendered as a wide 3:2 painterly illustration with a quiet dark lower half for app copy, no words/logos/fake card faces:

- Magic delay: unbranded charcoal collector parcel and hourglass suspended in a fractured magical portal, amber/violet light.
- Pokémon rules: teal tournament playmat, blank sleeved cards, luminous green crystal, brass calendar mechanism and red/white tokens.
- Yu-Gi-Oh rules: obsidian tournament desk, bronze-backed cards under a crimson seal, golden balance scales and violet geometric light.

These are reviewed assets for this edition. Future unmatched stories use verified publisher imagery or the existing labelled fallback; this patch does not add unattended paid image generation. New generated artwork must be bound to a reviewed story in the edition manifest.

## Validation / release hold

`test-news-edition.mjs` covers fixed dates, expiry, all three game/source contracts, exact-story art, bounded payloads, no Pokémon scan wrapper, source outage recovery, duplicate cron claims and paid-call suppression. Existing curation tests now require valid fresh news to survive malformed or unavailable AI responses. Hosted `tests/news-edition-browser.mjs` captures actual Home news at 320/768/1440 widths for all games with an empty upstream feed, and checks decoded artwork, source links, overflow and inventory preservation.

PR #38 remains a draft until hosted checks pass and a matching Android build exists. The current release's 0.5.0-beta APK must not be reused: the next APK needs versionCode 10 or higher, package com.cardstashy.app, the established signing identity, and `scripts/verify-android-release.py` passing against the final source. The current native wrapper source is still missing from this workspace; older integration archives do not provide equivalent Back/haptics behavior.
