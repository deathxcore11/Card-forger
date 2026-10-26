# Play visual and interaction contract: pre-release audit

2026-10-26. This is a source review of the website release package based on candidate `3849e24` with current 4.1.0 edits and the pre-release host source available during review. Final website and host publication commits are pending integration's release record; the earlier host revision is not a certification of the forthcoming deployment. This document does not certify a live match, visual acceptance, or universal card support.

## Reference decisions

| Reference | Behavior to borrow and reason |
| --- | --- |
| [Moxgate gameplay FAQ](https://www.moxgate.com/faq/) | Pass genuinely empty response windows; retain Full Control, separate phase stops, mandatory choices, manual mana, and cancellable selection before confirmation. Closest browser/Forge model. Its default does not automatically end the player's turn; broader convenience needs authoritative assessment. |
| [Arena Smart Priority](https://magic.wizards.com/en/news/mtg-arena/announcements-october-27-2025) | Preserve deliberate response exceptions and visible stops. The documented policy is not proof that all legal actions have been assessed. |
| [Arena mobile FAQ](https://magic.wizards.com/en/news/mtg-arena/mtg-arena-mobile-faqs-2021-01-28) | Tap attackers; tap a blocker and then its attacker. Keep auto-tap and Full Control accessible without hover or drag. |
| [NeoForge architecture](https://github.com/AdrianLopez98/NeoForge) | Present Forge views and controller decisions rather than implementing a second rules engine. |
| [NeoForge token piles](https://dokkodolabs.itch.io/neo-forge/devlog/1723122/neo-forge-mtg-1031-pc-mac-linux-and-android-token-piles-that-stay-together-pick-how-many-in-one-click-and-30-more-commander-entrances) | Split selected, available and ineligible equivalent tokens; use bounded quantity selection while retaining individual native identities. |
| [NeoForge targets and results](https://dokkodolabs.itch.io/neo-forge/devlog/1719238/neo-forge-mtg-1029-pc-mac-linux-and-android-see-what-the-stack-targets-why-a-player-lost-and-jumpstart-packs-in-quest) | Show the focused stack object's true targets, including player/stack targets; report authoritative loss reasons. |
| [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Prefer comfortable touch targets; AA specifies 24 CSS pixels or qualifying exceptions, not a universal 44px rule. |
| [W3C motion](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | Respect reduced motion and retain static turn/selection meaning. This cited criterion is AAA. |

All eight texts were retrieved. Gameplay visuals were not visually verified: NeoForge gameplay/combat GIFs and a W3C SVG were rejected by the retrieval image decoder. The other retrieved pages exposed no useful inspectable gameplay sequence. No visual conclusions were inferred from captions.

## First-delivery source findings

| Area | Status and evidence |
| --- | --- |
| Opponent hidden information | PASS, source only: host `ForgeHttpBridge.card/refreshBoard` applies native visibility before serialization; `forge-session.mjs` validates grants and purges unauthorized cached identity. Actual client network capture NOT TESTED. |
| Opponent hand presentation | Count-only fan added in `match-table.mjs/css`. Seven cards produce seven decorative backs; large hands use a bounded fan and exact count. It uses the existing table back treatment and receives no card objects or IDs. Visual acceptance NOT TESTED. |
| Turn and priority | Native dock and portraits distinguish active turn from response. Busy copy now distinguishes native processing, waiting for a table update, and an update needing attention; generic network waits no longer claim CPU thinking. |
| Smart / Full Control | PASS, source only: visible native controls and canonical command. Actual behavior NOT TESTED in this audit. |
| Phase stops | FAIL: native session has no phase-stop command/receipt. Legacy controls require a missing `turnFlow` contract. No phantom controls added. |
| Own-main empty-window advancement | FAIL: host intentionally disables Smart auto-pass in own MAIN1/MAIN2. |
| Payment and mandatory choices | PASS for source structure: native IDs, revisions and selection bounds preserved; unsupported prompts stop visibly. Direct-spell automatic payment consumes its intent once. Mountain payment trace NOT TESTED. |
| Submission ordering | PASS for source structure: state-before-ack handled; duplicate taps gated; uncertain/stale actions are not automatically replayed. |
| Table/card treatments | PARTIAL: separate hand, art tile and inspector; current stats and tapped cue. Type bins remain Creature/Land/Other, without duplicating artifact creatures. |
| Combat, attachments and token piles | FAIL for requested presentation: native UI lacks pairing/attachment projection and token quantity selection. Native legality remains authoritative. No inferred relationships or piles added. |
| Result screen | PARTIAL: winner/draw, exact snapshots and return/rematch navigation exist. Actual ending reason remains unclassified; account saving is explicitly unavailable. |
| Wide touch | PARTIAL: native 600–900px composition and 44px primary controls exist. Zoom, resize, gesture and clipping acceptance NOT TESTED here. |

## Evidence still required

NOT TESTED by this audit: signed-in setup through complete live match; original list/commander fidelity in a running match; Mountain paying one-red creature exactly once; zero unnecessary Continue clicks through an empty CPU response sequence; a legal response pause; Full Control behavior; wire-level hidden-hand filtering; attack/block confirmation and cancellation; correct outcome and return to Play.

Explicit phase-stop acceptance is FAIL because the native feature is absent. Twenty-token quantity selection is FAIL because that UI is absent. Requested before/after screenshots for setup, main phase, CPU empty/response windows, payment, combat, token selection, results and wide touch remain NOT TESTED by this audit. A source check or mock DOM result must not be relabeled as live-match evidence.
