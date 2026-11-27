# UI polish v1: the pro bar (Randall, 27 Nov 2026, 6:35 PM ET)

Randall: "make sure this all feels ultra polished and real, no odd off-putting UI or unprofessional." This is a standing bar. No preview reaches him with a screen that fails it.

## The standard

- **One visual language.** The menus already have it: serif gold titles, a clean sans body, dark glass panels with a thin gold edge, and gold buttons. Every in-run element uses the same language. No monospace, no boxed debug panels, no text checkboxes, no square brackets.
- **Quiet by default.** The HUD shows only what a player acts on. Everything else appears only when it changes, then fades.
- **No developer leftovers** on a player screen: version tags, full-screen buttons in a corner, raw numbers in brackets, or hints for controls that no longer exist.
- **Phone first for space.** The HUD covers at most 12% of a 412x915 screen during play, the play area stays clear of everything but the duelist, and no text truncates with an ellipsis.
- **Palette:** gold e0b765 for UI accents, XP cyan 46e0ff, violet b26bff only for summons, Fusions and seals, and danger red ff3b30 only for danger and health. No other accent colours (no green "NEW").
- **Motion:** every panel eases in and out over 120 to 200 ms. Nothing pops or jitters, and numbers count up instead of jumping.

## What fails today (cloud check, 790c569, 1920x1080 and 412x915)

### In the run
1. The top-left health and XP panel and the top-right stage panel use a monospace font in boxed dark panels. They read as a debug overlay.
2. The objectives show as "[ ] Survive the clock" and "[ ] Fell The Stone Arbiter". Use proper ticks or icons and sentence case ("Fell the Stone Arbiter").
3. Microtext reads like dev labels: "Boss in 10:50" in a tiny boxed tag, "STAKES 2%", and "(chest 30)". Fold the boss timer into the clock (the clock turns into a boss countdown in its last minute). Show Stakes only when it rises. Show the chest cost only near a chest.
4. The minimap is a raw square with a brown blob, and on a phone it covers a quarter of the top. Make it a small round map with a gold rim, terrain in soft tones, and only the markers that matter. On phone it is 96 px and collapsed by default, and a tap opens it.
5. The hint pill says "C while running: ride your card", which is obsolete now that the duelist is always on the card. Replace it with first-run hints in the new style, shown once each.
6. The hotbar has 8 brown slots with faint diamonds that dominate the bottom, and the name truncates ("Emb…") on phone. Show only filled slots with portraits and a level pip, and let empty slots fade to a thin outline. On phone use icons only, with the name on press.
7. "FULL SCREEN" and "v0.3.6" sit over the play area. Move them into the pause and settings screens.
8. On phone the HUD covers about a third of the top. Compact it into one top strip: health and XP bars, the clock and the minimap button.

### Level-up offer
9. The cards are mostly empty: a title and one line, then a blank gap. Each card gets its art or portrait, a rarity frame (common, rare, epic colours from the bible), and short text with the key number in gold.
10. The "NEW" tag is green. Make it a gold badge.
11. The type line wraps ("Level / 1 to 2"). Shorten it: "Dragon · Common · Lv 1→2".
12. "PASS (+6 coins)" mixes case. Write "PASS · +6 COINS" with a coin icon, and keep the three buttons on one row on phone.
13. On phone the subtitle wraps over two lines. Shorten it: "Pick one. Exile bans a card from offers."

### Main menu
14. The Weekly Leaderboard panel says "Online boards are off". Leaderboards were skipped (Randall, 27 Nov), so remove the panel.
15. Next Goals lists rank 2 and rank 3 for the same duelist. Show only the next goal per track, at most 3 rows, each with an icon.
16. The duelist stands on foot. Show them on the hovering card, with the idle sway from the rider pose.
17. QUICK DUEL is a smaller, different button. Match it to the others or move it into Play.
18. The sky behind the title shows dither and banding noise. Use a smooth gradient, or add the dither only at full resolution.

### World (do this in the world v3 pass)
19. Grass tufts are scattered everywhere, and tall green cacti stand out of palette. Cut clutter by about 70% as world v3 says, and tint plants to the warm and violet palette.

## How we check it

- Capture every screen the player can reach: menu, duelist pick, run HUD (calm, horde, boss, Overtime), level-up, chest, pause, settings, death and results, Bestiary and Deck Box. Do it at 1920x1080, 412x915 and 915x412.
- Lay them out on one contact sheet and review each against the standard above.
- Nothing ships to a preview with an open item from this list.
