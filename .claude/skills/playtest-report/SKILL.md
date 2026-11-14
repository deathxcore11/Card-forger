---
name: playtest-report
description: Write up a real play session of CardStashy, from a device walk or from a recording the owner sent, into a structured report with faults ranked by what the player felt.
---

# Playtest report

Save the report beside its proof files in the project's shared files.

```markdown
# Playtest: <build> on <device>, <date>

Tester: <who>   Length: <minutes>   Mode: <Quick Play, Commander, Story...>   Deck: <name>
Source: <played live | recording file and length>

## What was tried
<one or two lines>

## Flow
| Moment | Time | What happened | Felt | Verdict |
|---|---|---|---|---|
| Match start | 0:00 | ... | smooth / slow / confusing / broken | Pass / Fail |

## Faults (worst first)
| # | Time | What the player saw | Department | Cause (Read / unknown) | Bug id |

## Did the table explain itself
- Every question named its asker: yes / no, where not
- Every result named its cause: yes / no, where not
- Anything that happened with no sign: list

## Sound
Cues heard more than a few times: <cue, rough count>

## Pace
CPU turn lengths seen: <seconds>, against the standard in studio/standards.md F2

## Top three for the next patch
```

Rules: times come from the recording or a stopwatch. "Felt" is the tester's word; the
verdict is Pass or Fail against a rule in `studio/standards.md`. Nothing is added that
was not seen.
