# Sanar cleanup combo: proposed Play acceptance case

Status: rules and card-text reference verified on 2026-10-25. These are authored acceptance cases, **not executed CardStashy engine results**. No claim of current card support, multiplayer support, or a playable build follows from this document.

## Setup versus the repeating mechanism

**Sanar, Innovative First-Year triggers at the beginning of its controller's first main phase, not when cast or when it enters.** Casting it during an ordinary first main phase normally means waiting until the next turn's first main phase. With unchanged Sanar on the battlefield, it supplies blue and red regardless of which hybrid costs were paid. Its ability can reveal the two combo nonlands if both remain in the library, select Curiosity for blue and Magmakin Artillerist for red, exile them, then shuffle. Casting permission lasts that turn, requires paying costs, and follows normal timing. A piece already drawn is not also found in the library.

Once Curiosity enchants the Artillerist, Sanar is unnecessary to the repeating mechanism. Baseline: its controller begins their own cleanup with eight cards, maximum hand size seven, an adequate library, and three opponents who can take damage and lose the game. No attack is required.

Discarding one card produces an Artillerist trigger; resolving it damages each opponent. Curiosity triggers separately for each opponent actually damaged. Each optional draw is decided when its own trigger resolves. Choose one draw and decline the others to return to eight cards. After the stack empties and all players pass, another cleanup begins.

Forty such one-card damage cycles defeat three opponents starting at 40 in this unchanged baseline. Only **39 replenishing draws** are needed: the final damage eliminates all opponents and ends the game before further draws. This is a finite, resource-consuming sequence, not an unconditional infinite win.

## Unexecuted real-engine acceptance matrix

| Case | Required observation |
| --- | --- |
| Sanar timing and casting | No reveal trigger on casting/entry; correct first-main trigger, revealed-card selection, shuffle, paid spells, and expired casting permission. |
| One-card cleanup | Eight becomes seven; one damage trigger enters the stack; all opponents receive ordinary response opportunities. |
| Multiplayer draws | Three damaged opponents produce three independent Curiosity triggers, each allowing draw or decline. Preventing damage to one opponent reduces that count. |
| Repeated cleanup | One chosen draw restores eight; empty stack plus unanimous passes starts another cleanup. Declining all draws leaves seven and allows the turn to finish. |
| Multiple discarded cards | Discarding two together produces one Artillerist trigger dealing two to each opponent, rather than two separate one-damage triggers. Curiosity still triggers once per damaged opponent. |
| Removal and existing triggers | Remove either permanent at a legal response point. Existing stack abilities remain; future loop steps reflect the changed battlefield. Removing Artillerist does not erase damage already on the stack. |
| Library shortage | Declining optional draws is legal. Choosing to draw from an empty library causes the applicable loss; an action budget must not replace this with a game draw. |
| No maximum hand size | With an actual no-maximum-hand-size effect, eight cards cause no cleanup discard and this loop does not start automatically. |
| Player elimination | Mixed life totals eliminate players individually; subsequent damage and priority exclude departed players. Final lethal ends the game without another optional draw. |
| Shortcut and timer | A bounded repeat proposal states the choices and stopping point; opponents can interrupt at a legal priority point. Timer expiry uses the declared legal timeout policy and records its action; it never invents consent to optional draws. |
| Save and resume | Restore at a pending discard, stacked damage, optional draw, or response window; preserve cleanup iteration, chosen cards, hand/library counts, priority, and timer state without duplicate triggers. |

A 97-land list still needs legal blue/red Commander lands, singleton compliance outside basic lands, and a way to reach eight cards. A land that removes the hand-size limit conflicts with this particular cleanup setup. No deck-strength or opening-hand reliability result has been measured.

## Primary references

- [Lorwyn Eclipsed release notes: Sanar](https://magic.wizards.com/en/news/feature/lorwyn-eclipsed-release-notes): trigger timing, color count, costs and casting timing.
- [Official Aetherdrift gallery](https://magic.wizards.com/en/products/aetherdrift/card-image-gallery), public card entry `7cFsvzsWGnOERSX2s97WmR`; [official Magmakin Artillerist render](https://media.wizards.com/2024/dft/jX9KWo03DWpL/en_2998516151.png). Its gallery data confirms the grouped discard trigger. [Gatherer card](https://gatherer.wizards.com/DFT/en-us/137/magmakin-artillerist) exists but returned HTTP 403 during this review.
- [Wilds of Eldraine release notes: Curiosity](https://magic.wizards.com/en/news/feature/wilds-of-eldraine-release-notes): noncombat damage qualifies; one card per opponent damaged, independent of damage amount.
- [Current official Comprehensive Rules](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt), effective September 25, 2026, linked from the [rules page](https://magic.wizards.com/en/rules): CR 514.1–3a (cleanup), 603.2c/603.5 (triggers and optional resolution choices), 113.7a (independent stack abilities), 704.5a–b (losses), 104.2a (last opponent leaves), 732.2a–c (interruptible shortcuts), and 903.5 (Commander construction). The user's August rules PDF is superseded by this edition.
