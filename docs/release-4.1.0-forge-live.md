# CardStashy 4.1.0 website gameplay

This release connects the main CardStashy website to the authenticated Forge host. The existing account and selected deck snapshots are used for Standard, Modern and Commander. There is no starter-only deck boundary or replacement of a selected list. Forge checks both decks and owns rules and CPU actions.

The setup exposes one normal CPU opponent. Quick Play selects an opponent and uses the native random starting player. Practice offers first, second or random. A deck-art matchup introduction displays the account identity, CPU and deck names, followed by the committed native first-player result and the native opening-hand decision. Smart payment and automatic empty-response passing remain native; manual tapping and Full Control remain available.

## Sources and bounded verification

- Website base: `3849e24ccc73fd3c215ae42ac69a69d1c89fafe0`, descended from production `7a91d7757ff1ac7e1d83a904a294b48a44ed1f32`.
- Native starting-player host source: `8358a281f40677e6d824c0bb6dea7097f2c19e2e` on `codex/forge-github-host-prep-20261026`.
- Host image build/deployment workflow: `40391886971`; the provider receipt establishes its outcome separately from these source notes. Earlier run `40388458764` compiled but failed its startup probe and did not publish or deploy. The corrected source disables only Forge's optional AI advisory dialog and explicitly rejects unsupported pre-toss choices.
- Pinned upstream Forge: `e5a0f8156da70ffc7866f923bed371c0111707cd`.
- 88 focused website checks pass. Production Worker compilation with the private `FORGE_HOST` service binding passes.
- Native adapter compilation with JDK 21 and actual starting-player checks pass. The host suite passes 197 checks and the harness passes 162. The image workflow retains required source, process cleanup, image probe, publication and deployment gates.
- A local actual Forge startup with the exact Calling All Angels and Keen Engineering Commander fixture reaches `InputConfirmMulligan`, with registered and native rosters verified and an authoritative starting-player receipt. This is not a signed-in browser match.
- These checks do not certify every Magic card, all formats' full-match behavior or a signed-in owner match through the final public website.

## Known limits

The first live signed-in match is the next user acceptance step. Keep the page open: refreshing, leaving or losing the session does not support resume. Results and deck-version match history are not saved to the account yet. Host admission allows one active match per account and two globally, subject to its rolling daily resource allowance. Deck support and format legality are checked at startup and failures retain the exact selected lists. Companion sideboards and other unsupported native choices before the starting-player selection are rejected with an explanation, without removing or substituting cards.

The visual-contract audit is in `docs/play-visual-contract-audit.md`. Native phase-stop controls, token quantity selection, richer combat/attachment relationships and authoritative ending-reason text remain unfinished. Smart passing does not automatically end the human player's main phase. These limits must not be described as Arena parity.

Android is unchanged. Easy/Hard, multiplayer, persistent match history and reconnect are outside this website release.

## Publication and rollback

Promote the website only after the new native image passes its startup probe and the private host deployment succeeds. Preserve existing production variables, secrets, scheduled triggers and Durable Object bindings; add only the Forge service binding. The website cache is `cardforge-shell-v326-forge-live` and the displayed version is `4.1.0`.

Website rollback baseline is `7a91d7757ff1ac7e1d83a904a294b48a44ed1f32`, Worker version `8c1bc546-59c0-4abb-afaa-f57cc74d1729`. Roll back to its exact website tree if launch verification fails. The prior Forge host version is `737a8dd0-71c6-4f89-931e-928d5e330dcd`; it does not implement the new paired starting-player request, so never pair that old host with the new starting-player website.
