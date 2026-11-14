# CardStashy: rules every session follows

CardStashy is a card game app: a web app (this folder is the live site) and a native
Android app (`android-app/`) on the Forge rules engine. This repository is PUBLIC.
Never commit a secret, a signing key or a password.

## The one rule

Nothing is "fixed" until it was SEEN working with a real input: a real match, a real
device, a real photo, a real question. A test that passes on a made-up or desktop-only
input proves the code runs. It does not prove the feature works.

Every claim uses one of three words:

- **Pass**: seen working, and the proof file is on disk.
- **Fail**: seen not working.
- **Not assessed**: not checked on the real thing. Say why.

Never write "fixed", "works" or "done" for something that is Not assessed.

## Before any release

1. Run `qa/smoke-check.md`. All of it, on the build that will ship.
2. Fill a release record from `qa/release-proof.md`.
3. Run `node scripts/check-release-proof.mjs <record> <proof folder>`. It must exit 0.
4. Only then does the Release thread post its card. The card repeats the record's
   Pass / Fail / Not assessed rows as they are. The owner's tap on the card releases;
   a typed yes releases nothing.

## When a bug reaches the owner

Add a row to `qa/regression-log.md` and a test that uses the exact input that broke.
The bug is not closed until that test exists and fails on the old code.

## Working rules

- One thread edits native code at a time. Say which native files you touch.
- Check the code before calling anything missing. Do not rebuild what exists.
- New screens get a preview and the owner's yes first. Bug fixes do not.
- Do not invent features or card data.
- Pushing to `claude/edit-publish-github-bpm8zu` deploys the live site. Only the
  Release thread pushes there.
- The studio: `studio/README.md` (departments and the loop), `studio/standards.md` (the bar),
  `studio/backlog.md` (ranked briefs). Roles are in `.claude/agents/`, passes in `.claude/skills/`.
- Before a change goes to the release record it gets a polish pass (`.claude/skills/polish-pass`).
