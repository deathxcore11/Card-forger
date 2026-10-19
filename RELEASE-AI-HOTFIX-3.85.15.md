# CardStashy 3.85.15

Baseline: 3.85.14 / shell231.

## Changes

- Homepage deck requests use the existing in-app assistant and deck builders.
- User-authored constraints retain provenance; model defaults cannot add an unrequested infinite-combo restriction or invent a spending cap.
- Genuine unverified restrictions offer explicit review, revision and cancellation actions. Drafts remain unsaved until the normal save action is chosen.
- Budget and format choices retain the rest of the request. Pokémon and Yu-Gi-Oh! use their own supported formats in buttons, guidance and typed follow-ups. Pokémon Unlimited does not remove a dollar budget.
- TCG build-around handoffs check format compatibility before offering the builder action. Exact requested names remain required.
- Failed revisions preserve an earlier reviewable draft with a clear explanation. Theme-matching resolved candidates can supplement a failed search while retaining legality, color, exclusion and price checks.
- AI result cards use existing artwork, game colors and the canonical animated logo. Commander and tournament previews use compact portrait rows with readable names and reference-printing pills.
- Saved Yu-Gi-Oh! badges, thin rarity rims and supported finish effects refer to the same resolved printing. Unresolved identity does not borrow a different printing. Price frames remain separate.

## Validation and limits

Automated coverage includes request recovery, game-specific formats, budget preservation, draft handoffs, explicit saves, saved-printing presentation and responsive layouts. Passing mocked tests alone does not establish live model interpretation or catalogue availability. A release requires applicable checks and inspection of the actual preview.

Missing quotes are unknown, never zero. A generated list is a draft for human review, not a tournament-tested deck. Unverified restrictions and incomplete totals remain visible.

## Deployment and rollback

No database migration or collection rewrite is included. Preserve existing saved cards and decks.

For rollback, restore the baseline application files in a new commit and use a newer service-worker cache key. Verify served assets and reopen smoke checks; do not reset repository history or erase saved data.
