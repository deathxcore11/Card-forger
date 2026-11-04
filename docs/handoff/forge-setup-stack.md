# Forge match setup (scripted lessons)

Optional `setup` object on the match input. CPU matches only: refused with a friend match (`opponentKind`) or a Commander pod (`extraOpponents`), and it requires `startingPlayer` and `playStyle`.

```json
{ "...": "usual match input",
  "startingPlayer": "first", "playStyle": "quick",
  "setup": { "stack": { "hero": ["Plains", "Pacifism"], "villain": ["Mountain"] }, "noMulligan": true } }
```

- `setup.stack.hero` / `setup.stack.villain`: card names, top of library first (max 15 each, 120 chars). Each name takes the first matching card in that seat's shuffled library. A name not in the deck is skipped (the receipt counts what moved). Hero is the human seat, villain the CPU.
- `setup.noMulligan`: true keeps the opening seven for the human with no mulligan prompt.
- `startingPlayer: "first"` makes the human go first. It is allowed with `playStyle: "quick"` only when a `setup` is present; otherwise quick still requires `random`.
- Unknown keys anywhere in `setup` are refused (`invalid_match_setup`).
- Applied after Forge's library shuffle and before the opening draw (inside GameEventGameStarted), so the match is still dealt and played by native Forge. Receipt: `pregame.setup` = `{hero, villain, noMulligan}` (hero/villain = cards moved).
- Same input shape on the host bootstrap and in `LocalEngine.start`. Test: `android-app/forge-engine/test/SetupStackTest.java`. The APK port list in `port-bridge.py` needs `NativeMatchSetup.java` added next to `NativeStartingPlayer.java`.
