# The CardStashy studio

How CardStashy is run as a game production. The roles and passes here are adapted from
the MIT-licensed Claude Code Game Studios template (github.com/Donchitos/Claude-Code-Game-Studios,
copyright 2026 Donchitos), cut down to what an existing, shipped game needs.

## Departments

Each is a role file in `.claude/agents/`. A role reviews and writes briefs. It does not
edit app code; one thread edits native code at a time.

| Department | Role file | Owns | Says no when |
|---|---|---|---|
| Production | `producer` | The ranked backlog, one brief per job, who builds what | Two jobs touch the same native file, or a brief is bigger than one screen |
| Art | `art-director` | One look: glass and gold, whole cards, art ready before a card lands | A card pops in without art, an attachment is a text tab, a screen breaks the look |
| Game feel | `game-feel-director` | Timing, weight and pace of every move on the table | The CPU moves faster than a player can read, a move has no start or landing |
| Audio | `audio-director` | What every sound means and how often it may play | A sound repeats without the player causing it, or means nothing |
| UX | `ux-designer` | Every screen readable and reachable on every device | Text wraps mid-word, a control is off screen, a question does not name its asker |
| Performance | `performance-analyst` | Frame time, start time, memory, battery | A screen was never measured on a device |
| QA | `qa-lead`, `qa-tester` | Proof with real inputs, playtests, the bug log | A Pass has no proof file |
| Release | `release-manager` | Whether a release card may be posted | Any blocker in `qa/smoke-check.md` |

## The loop for every job

1. **Brief** (producer): one screen at most. Goal, files, what done looks like, the device check.
2. **Preview** for any new look, and the owner's yes. Bug fixes skip this.
3. **Build** with a test that fails on the old code.
4. **Polish pass** (`.claude/skills/polish-pass`): art, feel, audio, UX and performance each
   check the change against `studio/standards.md`.
5. **Playtest** (`.claude/skills/playtest-report`): a real match or a real session on a device.
6. **Release record** (`qa/release-proof.md`), then the Release thread's card.

## Files

- `studio/standards.md`: the bar each department holds. This is what "like butter" means in numbers and rules.
- `studio/backlog.md`: the ranked list of small briefs.
- `qa/`: smoke check, release proof, regression log.

## What was left out of the template, and why

New-game scaffolding (prototype, brainstorm, concept and design-document pipeline), the
engine specialists for Godot, Unity and Unreal, sprint and milestone paperwork, narrative,
level, economy, live-ops, localization and community roles, and its hook scripts (they
need Python and ask before every file write). CardStashy already has a game, its own
specs under the project's shared `specs/` folder, and a release flow.
