# Friend matches (milestone 1)

Two accounts play one hosted Forge game. Nothing here is live until the host patch is
deployed and the release thread ships the web change.

## Pieces

- **Host patch** `friend-matches-host-on-9109941.patch`: apply with `git am` onto the host
  deploy branch head `9109941a` (codex/forge-github-host-prep-20261026). Pushing that
  branch deploys the host through GitHub Actions, so only do it on Randall's yes.
  - Engine: input `opponentKind: "human"` seats a second person. Each seat is its own
    bridge over the same game, served at `/state`, `/action` (host) and `/seat2/state`,
    `/seat2/action` (guest). Each player only ever receives their own projection.
  - Host API: `POST /api/play/rooms {format, deck}` returns `{roomId, invite, ...}`;
    `POST /api/play/rooms/join {invite}` shows the room; `{invite, deck}` takes the seat and
    starts the match; `GET|DELETE /api/play/rooms/<roomId>`. The match itself is the usual
    `/api/play/matches/<id>`; the server maps each account to its seat.
  - Invites last 30 minutes, are stored only as digests, and are spent when the match starts.
- **Web** `play-forge-host-client.js`: `createFriendRooms()` (open, peek, join, read, cancel),
  `friendInviteLink()`, `friendInviteFromHash()`, and `client.attach(matchId)` so both players
  open the same match. `deploy/forge-host/src/app-route.mjs` forwards the room routes.

## Proof so far

- Local engine (`android-app/forge-engine/test/FriendMatchTest.java`, compiled against the
  bridge port and the engine jar from `forge-engine-android-e5a0f81-pods.tgz`): both seats
  mulligan, play lands, cast with auto-pay, either seat concedes and both see the same
  winner; 634 hidden-zone checks with 0 leaks; seat 2 playing a card from seat 1's hand is
  refused (`card_not_visible`).
- Host: 234/234 node tests (3 new), 51 container + 32 host python tests, harness
  `verify-inputs.py` and `run-static-checks.sh` pass.

## Not yet

- Lobby UI (Play with friends, invite friend, share link, ready seats), accepted-friends
  check (needs a Supabase function), disconnect/forfeit timeout, rematch.
- Live two-account test on the deployed host.
