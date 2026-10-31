#!/bin/sh
# Builds ../planeswalk-motion.js: the painted effect sprites (fx/*.webp, inlined as window.PW_FX), the shared
# motion kit (Card-forger experiments/forge-proof/motion-kit.mjs, copied here, export line dropped) and the glue.
cd "$(dirname "$0")"
{ echo "/* Planeswalk motion: built by motion/build-motion.sh. Edit motion/pw-motion-glue.js, not this file. */"
  printf 'window.PW_FX={'; for f in fx/*.webp; do n=$(basename "$f" .webp); printf "%s:'data:image/webp;base64,%s'," "$n" "$(base64 -w0 "$f")"; done; echo '};'
  sed '$d' motion-kit.mjs | sed 's/^export //'; cat pw-motion-glue.js; } > ../planeswalk-motion.js
