# 3.73.14: interactive rules and forgiving capture

The existing How to Play panels are preserved. Each game gains a six-step turn explorer, eight expandable lessons with practical examples, four answer-and-explanation scenarios, keyword/topic filtering, and an optional searchable reference download. Decks have a Rules pill; card mechanics retain their tap definitions and link to the expanded guide. PDF/source links remain alongside the downloaded text.

The rule packs are extracted from the eight official PDFs supplied by the owner. The current Magic reference is dated 2026-09-25; Pokémon rules 2026-09, tournament handbook 2026-09-01 and errata 2026-08-17 are separately identified. The M14 introduction and 2017 Yu-Gi-Oh guide are explicitly older references. Konami's later placement update is linked alongside version 10. Text extraction does not reproduce diagrams. The M14 file's repeated-glyph extraction is excluded from full-text search rather than presenting corrupted text as rules. The source link remains available.

Rule downloads verify SHA-256, persist in IndexedDB and load on demand. Initial app startup does not download the full books. Rule examples explain common situations, not arbitrary card-interaction adjudication or tournament judge decisions.

## Scanner

- Detect contrast/edge components within the visible camera area, fit a convex card quadrilateral, and normalize a chosen capture through a projective warp to 480 × 672. A fixed alignment box is no longer the capture requirement.
- Assess normalized text-band sharpness before live OCR. Keep the video stream playing during recognition and confirmation; debounce repeated captures of the same card.
- Read the title and collector-number regions first. The Pokémon header includes HP; when printing identity remains uncertain, read an additional game-specific detail band.
- Filter candidates by readable conflicting HP, collector number, ATK/DEF or power/toughness. Fuzzy names are provisional, and name-only matches cannot become verified printings. Printed ex/GX/V categories remain distinct.
- Recognition downloads include optional extra facts from Scryfall, YGOPRODeck and the MIT-licensed TCGdex card database. TCGdex's license is included in scanidx. Missing upstream facts remain missing. Existing users see Update recognition details. No paid pricing API is used by the recognition loop.
- With the local catalogue downloaded, text matching uses that catalogue rather than making a remote candidate search during each capture. Loading thumbnail art or synchronizing a saved collection can still require network access.

Contours need visible card edges and enough contrast, and OCR still needs readable pixels. Extreme perspective, glare, overlapping cards or severe blur can prevent a match; no universal recognition percentage or physical-phone latency is claimed. These are browser/PWA improvements, not a native ML Kit/OpenCV integration.

## Validation

Unit tests cover rotated/off-centre/skewed synthetic cards, homography corners, text-band sharpness, the Sandygast HP/number mismatch, all-game metadata integrity, dated reference integrity and rule-number search. Browser tests exercise the learning interactions at phone/fold widths, real card OCR and an off-centre rotated card in a synthetic camera stream. Physical device camera testing remains necessary for field calibration.
