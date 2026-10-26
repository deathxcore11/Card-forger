# Read-only Neo Forge controller/UI reference

Inspected commit: `80a83c4ac188b6f09bebde7b3570d331059eef82`.
Source review only; no Neo Forge installation was run and no code copied.

Instruction for the next coder: use Neo Forge as a read-only controller and UI
reference. Start with How it's built and inspect PlayerControllerHuman, IGuiGame,
IGameController and GameView/CardView/GameEvent integration. Compare prompt,
targeting, payment and priority handling with our adapter. Identify specific
patterns and review licensing before copying code. Finish the human-affordability
correction without suppressing legal responses, then prove unchanged decks through
CardStashy's browser. Preserve the collection/deck builder and one rules authority.
Screenshots and README features do not establish correctness.

Observed patterns to evaluate, not automatically adopt:

1. NeoMatchUI routes gestures to controller selectCard/selectPlayer. The active
   native input determines whether a click casts, targets, pays or declares combat.
   Preserve that boundary and CardStashy's revision-bound offered IDs.
2. updateButtons associates early button updates with the pending input. Compare
   CardStashy's generation/revision/prompt checks so delayed UI events cannot
   answer a different decision.
3. respondLater serializes decisions through a dispatcher/executor; GameEvent and
   GameView/CardView drive presentation. Retain viewer-bound privacy checks:
   merely using a view type does not certify hidden-information handling.
4. NeoMatchUI documents that showManaPool/hideManaPool do not cover the complete
   payment lifecycle. Compare active native input and authoritative prompt/button
   state. Do not infer payment from a decorative panel or blindly copy text parsing.
5. Priority preferences use per-match YieldController state. That UX pattern does
   not itself fix the human-versus-AI affordability error in Forge's action scan.

Sources at the inspected revision:

- [README / How it's built](https://github.com/AdrianLopez98/NeoForge/blob/80a83c4ac188b6f09bebde7b3570d331059eef82/README.md)
- [NeoMatchUI](https://github.com/AdrianLopez98/NeoForge/blob/80a83c4ac188b6f09bebde7b3570d331059eef82/forge-gui-neo/src/main/java/forge/neo/match/NeoMatchUI.java)
- [PromptBanner](https://github.com/AdrianLopez98/NeoForge/blob/80a83c4ac188b6f09bebde7b3570d331059eef82/forge-gui-neo/src/main/java/forge/neo/ui/PromptBanner.java)
- [NeoPaymentPeek](https://github.com/AdrianLopez98/NeoForge/blob/80a83c4ac188b6f09bebde7b3570d331059eef82/forge-gui-neo/src/main/java/forge/gamemodes/match/input/NeoPaymentPeek.java)
- [GPLv3 license](https://github.com/AdrianLopez98/NeoForge/blob/80a83c4ac188b6f09bebde7b3570d331059eef82/LICENSE)

The README/license identify GPLv3. Before copying implementation, review license
compatibility, notices and corresponding-source obligations for the exact
distributed package. That distribution review is not completed here. JavaFX is
not a drop-in browser component. Phase, Open Gathering and Python-MTGA are not
being introduced as additional rules authorities or engine replacements.
