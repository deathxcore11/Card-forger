# Cardforge — ideas for next updates

## Deck building
- **Combo & synergy finder** — look up the deck in Commander Spellbook's public API and flag combos that are complete, 1 card away, or 2 away (with price of the missing piece).
- **"What if" sandbox** — drag cards into a temporary maybeboard and see engine score + goldfish change live before committing.
- **Deck DNA radar** — speed, resilience, interaction, card flow, synergy on one chart; overlay two decks or two versions.
- **Upgrade roadmap** — plan $10/month: which swaps to buy first for the biggest engine gain per dollar.
- **Partner/Background support**.

## Collection
- **Price alerts** — notify when a wishlist card drops below your target (needs a small scheduled Cloudflare Worker + KV).
- **Binder pages view** — 3×3 pocket pages, sort by set/color, matching your physical binders.
- **Set completion tracker** — % of a set owned, missing rares list.
- **Cards that unlock decks** — "buy these 5 cards and 3 of your deck ideas become 90%+ owned".
- **Trade helper** — two-column trade calculator using trade binder + friend's list, fair-value meter.
- **Purchase log** — record what you actually paid; show profit/loss vs today's value.

## Playing
- **Pod notes** — track which friends/decks you play against, and win rate per matchup.

## Platform
- **Cloud sync** (Cloudflare D1 + sign-in) so phone and computer share one collection.
- **Android app** via Capacitor or Trusted Web Activity (wraps this same site).

## Done in 2.2
- Commander bracket estimate · mana base helper · life tracker with commander damage · proxy print sheet.

## Next for the new features
- Per-opponent commander damage (one counter per enemy commander), and partner support in the bracket check.
- Combo detection from Commander Spellbook to complete the bracket estimate.

## Accounts & community (needs a backend)
Plan: keep Cloudflare hosting, add Supabase (auth + Postgres with row-level security + avatar storage).
1. Accounts & sync — Google/email sign-in, guest mode stays, import local data with preview and
   duplicate handling, private by default, conflict detection between devices.
2. Public deck library — publish a chosen deck version (the 2.5 share-link format is the payload),
   browse without signing in, bookmarks, "Find decks I can almost build" across the public library.
3. Community — comments tied to a published version, separate signals (helpful, beginner-friendly,
   budget-friendly, self-reported games), reporting and moderation. Results don't carry over when a
   deck is substantially edited.
Needed from the owner: a Supabase project URL + public anon key, and Google OAuth enabled.
