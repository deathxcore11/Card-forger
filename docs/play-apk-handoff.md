# Play native handoff after the verified website release

Current branch work is a candidate, not a live release. The owner assigned APK
work to the other builder after the complete website patch is live. Build from
that exact verified release source; do not merge an old whole branch over it.

Retain all shared bracket/Power/wiki/badge/builder changes, plus play-player-mat.js,
play-card-surface.js and play-deck-context.js. The actual runtime entrypoints and
worker modules live under experiments/phase-engine/. Preserve the staged runtime
chunks, manifest, 6,137-record rules package and licenses byte-for-byte. Follow
the existing build receipt and hashes; do not rebuild or strip WASM casually.
The runtime uses same-origin URLs, dynamic module loading, workers, gzip
decompression and an immutable cache. Verify the WebView asset mapping/CSP and
actual performance, memory and cold offline operation on the target devices.

Compact phones have no Play entry. Play belongs on Home/Decks for admitted
landscape tablets or unfolded inner screens. Native window/posture events must
feed the existing play-surface-policy seam. Its callbacks are not a completed
pause implementation. Folding, rotation, background/resume and resizing need
explicit rules-authority timer/input/CPU behavior, an accessible logo overlay,
and recovery of the same match, turn, RNG, history and pending choices. Never
reroll, restart a match or invent a loss from a posture change.

Keep this app's card art, finish overlays, top-layer emblems, pinned inspector,
wiki terms and legal commands. Adapt mouse pickup/context menus to long hold,
finger dragging, cancellation and accessible tap/keyboard alternatives. Public
Play activation, supported pools, difficulty and pregame need the website's
actual completed acceptance gates first. A wide viewport alone does not prove
a foldable posture, and source-level geometry checks do not certify a device.

Preserve established Android package and signing identity. No signing keys,
passwords, APKs, manifests or native schema were changed in this Play slice.
