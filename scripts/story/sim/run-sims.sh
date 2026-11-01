#!/usr/bin/env bash
# Forge self-play for one act: node check-story-deck.mjs <act> --sim-dir /tmp/story/sim-<act> first.
# Usage: run-sims.sh <act> <games> [battle ids...]   (4 JVMs in parallel; results in /tmp/story/sim-<act>/results.jsonl)
set -u
ACT=$1; GAMES=$2; shift 2
D=/tmp/story/sim-$ACT; CP=/tmp/fe/simc:$(ls /tmp/fe/android/libs/*.jar | tr '\n' ':')
IDS=${*:-$(ls $D/*-hero.txt | xargs -n1 basename | sed 's/-hero.txt//')}
i=0; declare -a GROUP=("" "" "" "")
for id in $IDS; do GROUP[$((i%4))]+="$D/$id-hero.txt $D/$id-villain.txt "; i=$((i+1)); done
for g in 0 1 2 3; do [ -n "${GROUP[$g]}" ] && (java -Xmx2g -cp "$CP" StorySim /tmp/fe/root $GAMES ${GROUP[$g]} 2>/dev/null | grep '^RESULT ' | sed 's/^RESULT //' >> $D/results.jsonl) & done
wait
