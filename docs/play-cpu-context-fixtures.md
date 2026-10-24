# Contextual CPU fixtures requested during Play development

October 24, 2026. Requirements and reviewed examples; the current smoke policy
is ungraded and does not implement these strategic evaluations.

## Chief of the Wilds versus Voja

The owner supplied both card images ([supplemental reference index](play-mechanics-reference-index.json)) as a test of understanding which card helps
and why. Comparing mana value or printed power alone is inadequate.

- Voja is a stronger engine in a position with enough Elves, Wolves and a safe
  attack: its attack trigger grows the entire creature board and replenishes
  cards. Its vigilance, trample and ward affect attack/removal evaluation.
- Chief is cheaper and rewards additional Wolves entering with counters on
  itself. Its amplification depends on actual triggered abilities of other
  Wolves/battles, not merely another card having the Wolf subtype.
- Chief does not amplify its own Wolf-entry trigger. Its last ability causes
  another trigger instance; it does not duplicate static abilities or every effect on a Wolf card. Activated mana
  abilities are not triggered abilities.
- A fixed illustrative position with three Elves and two Wolves (including
  Voja), an accepted attack trigger and unchanged counts at resolution should
  put three +1/+1 counters on each controlled creature and draw two cards.
  This is an expected fixture, not an executed engine result in this checkout.
- If both cards are legitimately controlled in a compatible game, Chief can
  add a second instance of Voja's attack trigger. Evaluate each instance and
  actual state separately; intervening responses can change the result.
- Deck construction comes first: Chief is black/green and Voja is red/green/
  white. Chief cannot be included in a normal Voja-led Commander list. That
  restriction does not prohibit every in-game control/copy interaction.

The pinned 6,137-record integration fixture contains neither exact card. Do not
invent compiled definitions or mark their engine support from the images. Obtain
versioned executable definitions and verify current exact text before adding
runtime assertions.

Sources: [Chief official release notes](https://magic.wizards.com/en/news/feature/the-hobbit-release-notes),
[Commander color identity](https://magic.wizards.com/en/formats/commander).
Voja's rules and costs were legible in the owner's supplied image.

## Aragorn combo review

The supplied combo text is useful as a set of proposals. Several lines need
correction before the CPU may call them sustainable or winning.

| Proposed line | Required correction / finite resource check |
| --- | --- |
| Aragorn's colors | Red, green, white and blue; no black. Match triggers to the colors of the spell actually cast. |
| Lion + Aragorn + Phyrexian Altar | One white cast produces one Aragorn token. Lion costs two mana, one sacrificed token produces one: a one-mana deficit per cycle. Additional token production/cost reduction is required. Lion's return does not target. White casts alone are not red damage triggers. |
| Curio + two cheap creatures | The recurring casting costs still need funding. Curio requires a nonartifact entering permanent. A claimed zero-cost nonartifact red-creature loop needs exact card identities and executable definition checks. |
| Sabertooth + Dockside | Return activation costs two, Dockside recast costs two. Four Treasures sustain a cycle; five yield one extra. The return is not targeted. Dockside is banned in normal Commander on the checked current official list; it is not a legal default fixture for this mode. |
| Food Chain + Squee | Squee is mono-red and costs three mana. Exiling its mana value-three body yields four mana of one color, then recasting costs three: one net mana restricted to creature spells, plus the applicable red cast trigger. Actual priority and opposing interaction remain relevant. |
| Food Chain + Misthollow Griffin | Blue recasts give Aragorn's blue scry trigger, not red damage. A distinct winning outlet is required. |
| Scepter + Dramatic Reversal | The spell copy is cast and is blue. Two nonland mana sustain repeated activation; three produce one net mana per cycle. The loop does not intrinsically require a red mana source. It does not return ordinary hand spells for repeated casting. |

A finite ledger and exact game state must establish startup resources, recurring
costs, output restrictions, repeatable access, resulting triggers, legal targets
and a real closing route. A legal mana engine alone does not establish a win.
Optional repeated actions need a chosen finite count and preserved response
opportunities; a frame timer or diagnostic ceiling never supplies an outcome.
Aragorn's red trigger damages an opponent; it does not generically clear creatures.

Primary sources checked:

- [Aragorn and matching color triggers](https://magic.wizards.com/en/news/feature/the-lord-of-the-rings-tales-of-middle-earth-release-notes).
- [Current format banlists](https://magic.wizards.com/en/banned-restricted-list).
- [Food Chain restrictions](https://magic.wizards.com/en/news/feature/double-masters-2022-release-notes-2022-06-24).
- [Squee permissions](https://magic.wizards.com/en/news/feature/dominaria-release-notes).
- [Sabertooth](https://magic.wizards.com/en/news/feature/fate-reforged-release-notes-2015-01-14).
- [Scepter casts its copy](https://magic.wizards.com/en/news/feature/eternal-masters-release-notes-2016-06-02).
- [Whitemane Lion official release PDF](https://media.wizards.com/2021/downloads/TSR_Release_Notes/EN_MTGTSR_FAQ_20210118.pdf), page 89.

Direct Gatherer card pages were unavailable during this review. This is not a
complete current Oracle/ruling audit for every named card, a tested Aragorn
package, a CPU implementation or a win-rate claim.
