# Cleanup prerequisites for the single isolated image proof

The original four tests in candidate/host/container/tests/test_reaping_order.py
are unchanged (SHA256 b966de3b251e2b6537a7ebc90ebd303840affce9a2b31552152db5e156d1875b).
An unchanged-baseline failure is diagnostic evidence, not acceptance.

## The three original failures

| Test | Exact failed observation | Cause demonstrated locally |
| --- | --- | --- |
| test_live_descendant_cannot_produce_success_or_unbounded_wait | The initial group_alive(leader.pid) assertion failed, before the bounded-cleanup assertion. | killpg observed the real group, but /proc group IDs belonged to the ancestor PID namespace. The scan found no matching group and returned false. |
| test_stopped_zombie_is_not_a_live_descendant_but_is_reaped | The initial live TERM-resistant child was classified as not live. | Same namespace-mismatched scan. After the defensive correction, this proceeds to the zombie observation but cannot find the child's namespace-local PID under this proc mount. |
| test_unreapable_zombie_cannot_produce_success_or_unbounded_wait | wait_zombie never observed the stopped child's Z state. | The test reads /proc/<namespace-local-child-PID>/stat, but the mounted procfs indexes the ancestor namespace. It never reaches the intended unreapable-zombie timeout assertion. |

One diagnostic invocation reported getpid=5 and getpgrp=1, while /proc/self/stat
reported PID=11422 and process group=11407; NSpid listed both 11422 and 5. This
directly demonstrates the mismatch. It does not prove cleanup safe. The fourth
race fixture's local pass is also insufficient because its /proc observations
run under the same mismatch.

## Genuine defensive defect corrected

group_alive previously treated an empty scan as proof of a stopped group even
after killpg(pgid, 0) confirmed the group's existence. It now checks NSpid, PID
and process-group consistency before trusting procfs. An unreadable/mismatched
view preserves the conservative live/unknown result. Reaping followed by the
kernel's ProcessLookupError can still establish termination. Real gateway startup
rejects an incoherent procfs before launching a match.

Seven additional checks cover matching IDs, ancestor namespaces even when numeric
IDs coincide, wrong PID/group, unreadable procfs, conservative group detection,
kernel-confirmed absence and a real child's termination with an uncertain scan.
They pass locally. The original live-descendant bounded-time case now passes.
The two zombie-observation cases remain environment-blocked locally and are NOT
accepted as passes. One unrelated HTTP trickle-header test timed out during the
concurrent suite; its isolated unchanged rerun passed. The full suite remains a
required real-run gate, not a claimed all-green local suite.

## Why the proof environment differs, and how that is checked

Linux procfs exposes the PID namespace of its mount; the PID namespace manual
describes the mismatch that results when a child inherits an ancestor proc mount.
The selected ubuntu-24.04 GitHub-hosted runner is a VM, and the runtime Docker
command uses a new default PID namespace with no --pid=host, shared PID namespace,
or bind-mounted /proc. These are reasons to expect coherent views, not evidence
that this particular unexecuted image already passes.

run-combined.sh now runs run-cleanup-preflight.sh before installing a browser or
building the image. It measures namespace consistency, then runs all four
original reaping fixtures plus seven new guard checks. Missing results, errors,
skips or failures fail the gate. An incoherent environment runs no image/browser
case. The actual container gateway independently checks coherence at startup.
The complete container test suite still runs unchanged in the source-contract
stage. Every real allocation still requires graceful exit 0, no forced stop/OOM,
exact image identity and confirmed removal/private-input cleanup.

cleanup-preflight.json contains only an allowlisted aggregate. The artifact
collector requires a passing 11-test receipt and includes sanitized counters in
the combined summary. Raw process traces and private logs are not uploaded.

Sources:
- https://man7.org/linux/man-pages/man7/pid_namespaces.7.html
- https://docs.kernel.org/filesystems/proc.html
- https://docs.docker.com/reference/cli/docker/container/run/#pid-settings---pid
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners

## Additional startup defect caught during this review

The new native human-attestation verifier reads from the per-match runtime root.
The gateway formerly linked forge/decks/cpu/rules-data there but omitted human.
The reviewed correction adds that link. A local smoke invokes the actual native
class-attestation verifier through the gateway-created root and confirms the
synthetic lifecycle child exits and its connection file is removed. This is a
native-attestation/root-wiring check, not actual-container or gameplay evidence.
