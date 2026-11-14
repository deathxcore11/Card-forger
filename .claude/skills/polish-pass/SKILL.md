---
name: polish-pass
description: Run the studio's polish pass on a finished change or a screen: art, game feel, audio, UX and performance each check it against studio/standards.md. Use before a change goes to the release record, or to audit an existing screen.
---

# Polish pass

Input: a change (commit or branch) or a screen name, plus any device pictures or recordings.

1. Say what is being checked and what evidence exists: recording, device picture, test
   picture, or code only.
2. Run each department's review in turn, using its role file in `.claude/agents/`:
   `art-director`, `game-feel-director`, `audio-director`, `ux-designer`,
   `performance-analyst`. Skip a department only when the change cannot touch it, and say so.
3. Collect findings in one table: department, rule (for example S2), where, what a
   player would notice, smallest fix, evidence (Seen, Read).
4. Sort by what a player notices first. Mark each as a fix (no preview) or a new look
   (preview and the owner's yes first).
5. Verdict per department: Approve, Concerns, Reject, or Not assessed on a device.
6. Hand the fixes to the producer as backlog rows. Do not edit app code in this pass.

A pass done from code alone ends with "Not assessed on a device" and the exact device
check that would settle it.
