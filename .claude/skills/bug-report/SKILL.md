---
name: bug-report
description: Write one CardStashy bug as a report a builder can fix without asking questions: what was seen, exact steps, the cause in code if found, and the test that will guard it.
---

# Bug report

```markdown
# BUG: <what the player sees, in one line>

Reported by: <owner | tester>, <date>   Build: <version>   Device: <model>
Evidence: <recording and time, picture, or log file>
Severity: Blocks play | Wrong result | Looks broken | Annoying
Department: Art | Game feel | Audio | UX | Performance | Rules

## Seen
<what is in the evidence, nothing more>

## Steps
1. ...

## Expected
<the rule in studio/standards.md or the owning spec>

## Cause
<file and line, marked Read; or "unknown", with what to log>

## Fix
<smallest change>

## Guard
<the test that fails on today's code, using the input that broke; then the device check>
```

Add the row to `qa/regression-log.md`. A report with no evidence says "Said, not seen".
