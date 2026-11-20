#!/bin/bash
# What is one relic worth alone? Each named relic is carried from duel one with Forge Gifts
# switched off, and the clear rate is compared with the same seeds and no relic.
#   tools/crucible/gift-alone.sh [runs] relic_id [relic_id ...]     extra sim flags: SIMFLAGS="--family shadow"
cd "$(dirname "$0")/../.." || exit 1
runs=${1:-1500}; shift
for g in none "$@"; do
  if [ "$g" = none ]; then cfg='{"giftXpScale":99}'; else cfg="{\"giftXpScale\":99,\"testRelics\":[\"$g\"]}"; fi
  CRUCIBLE_CFG="$cfg" node tools/crucible/sim.mjs --runs "$runs" --seed 1 --level 2 --brief $SIMFLAGS |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log('$g'.padEnd(18),'clear',d.clearPct,'beat boss 2',d.beatBoss2Pct,'duel wins',d.duelWinPct)})"
done
