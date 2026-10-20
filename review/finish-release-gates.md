# Finish coverage release gate — 2026-10-20

Status: **BLOCKED** for the owner's requirement that every physical printing across Pokémon, Magic, and Yu-Gi-Oh! has its correct foil/nonfoil presentation. Candidate test-branch publication is allowed. Production release remains separately reviewed and is not authorized by this document.

Run `node scripts/finish-coverage-audit.mjs <report.json>` to reproduce the offline evidence inventory. It processes every row of the checked-in recognition snapshots, not the entire current live market. Resolver support does not certify visual or physical accuracy. No card, price, lot or provider data is modified.

| Evidence | Coverage and limit |
| --- | --- |
| Aquapolis retained full records | 186 cards; 348 selections: 157 plain, 191 unsupported previews. The browser navigation/identity pass is **not** a foil-rendering pass. |
| Yu-Gi-Oh! recognition snapshot | 45,176 printing rows: 18,117 plain, 18,949 approximate, 7,601 unsupported, 509 without printing metadata. Unknowns include Quarter Century, Ultimate, Collector's and Ghost treatments, special frames, and malformed rarity labels. |
| Magic recognition snapshot | 100,457 printing IDs, with 87,328 nonfoil, 62,296 foil and 1,205 etched declarations. Rows omit the layout/face/treatment information needed to validate exact rendering. Overlapping finish counts are not separate cards. |
| Pokémon recognition snapshot | 21,388 indexed physical card IDs out of 22,055 rows; 667 Pocket rows are excluded. Recognition metadata omits physical variant inventory and foil geometry. |

Required before claiming comprehensive coverage:

- Reconcile physical printing/finish availability and exact product identities for each game. Missing source records and malformed labels remain unresolved.
- Map reviewed artwork frames and materials for each finish family, including alternate illustrations, stamps, textures and special layouts. Do not fill unknowns with an arbitrary rainbow.
- Verify each printing's selected geometry, plus rendered representatives of every layout/material combination in collection, detail and zoom. Nonfoil must stay nonfoil, and preview switching must preserve saved holdings and prices.
- Test phones, folded/unfolded screens, tablets and desktop, including gesture cancellation, nested modals, reduced motion and background scroll containment. Hosted touch emulation does not prove actual Samsung hardware behavior.
- Obtain separate release review and verify the real production deployment and served asset bytes.

The Sun & Moon witness uses unchanged public source artwork for Sewaddle 6, Sewaddle 7 and Leavanny 9. The current TCGdex Sewaddle 6 record lacks reverse availability; the test explicitly supplies a synthetic reverse choice to reproduce the user's displayed selection. This patch does not add a production variant or fabricate a price.
