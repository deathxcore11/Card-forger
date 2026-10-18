# Finish milestone 01 — review gate

Scope: 14 named comparisons. New material CSS is isolated to `/review/index.html`; the application does not import it. Base: `0896479cbb5b0d103a46907e057354fe9bebf57a` (3.84.3). The before panel reuses that commit’s finish model and CSS in a comparison layout, not a screenshot of the entire old app.

## Fixed checklist

| Case | Exact printing | Finish | Visual approval | Physical phone |
|---|---|---|---|---|
| Charizard | Base Set · 4/102 · Unlimited | Holofoil | Pending | Pending |
| Zapdos | Base Set 2 · 20/130 · English | Holofoil | Pending | Pending |
| Mantine | Sword & Shield · 052/202 · English | Normal | Pending | Pending |
| Mantine | Sword & Shield · 052/202 · English | Reverse Holofoil | Pending | Pending |
| Zekrom | Celebrations · 010/025 · English | Holofoil | Pending | Pending |
| Charizard VMAX | Shining Fates · SV107/SV122 · English | Textured Holofoil | Pending | Pending |
| Hot Red Dragon Archfiend Abyss | HSRD-EN041 · English | Ultra Rare | Pending | Pending |
| PSY-Framegear Gamma | EXFO-ENSE3 · English | Super Rare | Pending | Pending |
| PSY-Framelord Omega | HSRD-EN035 · English | Secret Rare | Pending | Pending |
| PSY-Framegear Gamma | TOCH-EN036 · English | Rare | Pending | Pending |
| Dracotail Lukias | JUSH-EN001 · English | Starlight Rare | Pending | Pending |
| Miara, Thorn of the Glade | Commander Legends · 133 · English | Nonfoil | Pending | Pending |
| Miara, Thorn of the Glade | Commander Legends · 133 · English | Traditional foil | Pending | Pending |
| Miara, Thorn of the Glade | Commander Legends · 566 · English | Etched foil | Pending | Pending |

Provider identities are checked by `scripts/build-finish-review.mjs`. Pokémon Mantine availability was refreshed from TCGdex `/cards/swsh1-52`; it is no longer based on the geometry fixture’s synthetic flags. Yu-Gi-Oh set code and rarity are exact, but edition remains unselected and the provider master image is not a scan of each edition. Miara etched is printing 566; nonfoil and traditional foil are printing 133. All shaders remain approximate simulations. Title masks are tied to source image hashes in `assets/mask-provenance.json`. Do not reuse them for another image revision.

## Acceptance gate

- Inspect Pokémon holo and reverse at rest and while moving light. Reverse must exclude the artwork.
- Inspect Yu-Gi-Oh art and individually masked gold/silver/rainbow title letters. Check readability.
- Compare Magic traditional foil and etched without substituting printing or image.
- Run all cases at 390, 768 and 1440 CSS pixels; check bounds, plain controls, reduced motion, errors and image loading.
- On an actual phone, test vertical scrolling, tilt permission accept/deny, recalibration, orientation change, visibility resume, and reduced motion. Automated viewport checks are not hardware testing.
- Opening a deck must immediately reveal its cards. The box animation remains a separate optional action.
- User visual direction approval is required before app-wide material integration and production release.

## Pricing diagnosis and fixes

The deployed public condition route returned `provider_shared_limit` / `EXCESSIVE_FREE_TIER_USAGE` with an active stored cooldown. This establishes a configured route and a retained provider rejection. It does not identify the deployed secret, prove the dashboard plan/key matches, or prove the provider remains blocked after cooldown expiry.

The patch preserves a single absolute retry deadline across server, editor, scanner and refresh scheduler. Calendar budget rollover no longer clears provider cooldown. New provider failures retain a safe observation timestamp and whether Retry-After was provider-supplied or a fallback. No raw headers, secret or provider body are exposed. Saved quotes remain usable during cooldown; unavailable condition quotes do not become reference valuations.

Still required: after the actual stored cooldown expires, one controlled lookup through the deployed connection, and verification that the configured account/plan is the intended one in Cloudflare/JustTCG dashboards. Do not clear cooldown, rotate identities to evade restrictions, or describe price checking as restored until a real response succeeds. No dashboard changes were performed.

## Saved data and deployment

No schema, collection, ownership, edition, price selection, or storage migration is included. The review page has no account connection. The small application patch and new material review are on the review branch until the gate is approved.

Run `npm test` for Node regressions. Hosted workflow `finish-milestone.yml` renders the before/after evidence; the browser script intentionally requires actual GitHub Actions. Its results explicitly record physical-phone testing as not performed. Existing app browser gates also run on branch pushes.
