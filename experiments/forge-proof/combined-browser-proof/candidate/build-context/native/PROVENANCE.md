# Local visibility descendant, 2026-10-26

This is the explicitly manifested descendant of frozen 0414 CPU, not the old source identity. See BASE-CANDIDATE.json and LAWFUL-VISIBILITY.md. Only ForgeHttpBridge.java changes executable native source. Existing evidence documents below are retained historical parent receipts, not acceptance of this descendant. No image, browser, deployment, or complete precon acceptance is claimed.

---

> Retained parent capability/proof history. EXPERIMENTAL-CPU.md supersedes policy/stock-AI statements in this descendant; exact deck/rules/concession contracts remain.

# Forge local executable proof — provenance and limits

## Engine and inputs
- Official source: https://github.com/Card-Forge/forge
- Exact revision: `e5a0f8156da70ffc7866f923bed371c0111707cd` (2.0.16-SNAPSHOT).
- Upstream source remained unmodified (`git status --short` empty).
- README and CONTRIBUTING read; no AGENTS.md found. GPL-3.0 repository LICENSE, with GPL-3.0-or-later source headers. Adapter source supplied for local proof under the same GPL-3.0-or-later terms. No distribution/deployment legal conclusion is implied.
- Native published precons copied byte-for-byte from `forge-gui/res/quest/commanderprecons/Keen Engineering [FDC] [2026].dck` and `Reign of Dragons [FDC] [2026].dck`; both exactly 100 copies incl. Commander. They are official precon defaults, not asserted to be the user's account-specific edits.
- Calling All Angels (Giada) SHA256: `ecb827272a5a4bcf9a7603bd2796f72235164762c796cbc28f4a39c932295662`; exactly 100 copies incl. one commander.
- Keen SHA256: `d2e9e9a49684f3472c401dfec0d8c9fc04690829e695c21e208337b4d7aa60f7`.
- Reign SHA256: `a16268be45e39f98b44cec06a7fa252803395319ae26c6d230dc12d1719ad7da`.

## Toolchain and build
- Apache Maven 3.9.11 from official Maven Central distribution, SHA512 checked against official sidecar.
- Eclipse Adoptium Temurin JDK 21.0.13+9 from official API/GitHub release; downloaded archive SHA256 `d7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c` matched official API package metadata. The system had Java21 runtime but no javac/ct.sym; no system packages modified.
- All downloads/tools/caches remained in this proof directory. Maven uses existing workspace HTTP proxy and existing read-only system Java truststore; no TLS validation bypass or CA truststore edits.
- `./build-classpath.sh` compiles desktop dependency reactor and writes the Maven-resolved runtime classpath. Standard installed `mvn`/`JAVA_HOME` are supported; `FORGE_MVN`/`FORGE_JAVA_HOME` optionally override. No download/setup required when CI supplies them. Local bundled tool paths are fallback only.
- Upstream broad unit suite was **not run** (`-DskipTests`). Build and focused real-engine/transport tests are not a universal rules verification.
- Initial recoverable attempts: direct Maven DNS lacked workspace proxy; supplied JDK initially lacked workspace trusted CA until process was pointed at unchanged system truststore; first naive runtime classpath mixed Maven-plugin Guava14 and failed, replaced by proper Maven-resolved classpath; native CLI requires `-D <deck-dir>` plus deck basenames, not absolute `-d` paths. Failed-run logs retained separately.

## Executed proof
1. `./run-native-smoke.sh 20261025 1`: genuine native SimulateMatch Commander, Reign won turn9 by lethal combat; 4,921ms game time.
2. `./run-native-smoke.sh 20261026 3`: three further complete native games; Keen/Reign/Reign wins (3,971/2,223/5,868ms).
3. HTTP native human controller test: play/draw→keep→main→land menu→land battlefield→Sol Ring ability menus→mana payment→stack→resolution. Privacy: opposing hand/library count-only; own hand visible. Invalid token, stale revision, invalid/fractional/string choices rejected.
4. Full HTTP human-seat match: deterministic test driver played land and Sol Ring, then native pass/required-discard/Alpha Strike choices. AI Chaos Warp produced Graaz, and Forge enforced mandatory attack. AI eventually won turn16 combat; terminal winnerPlayerId=1. This is HTTP engine/transport evidence, **not browser UI acceptance**.
5. Focused transport contracts: exact engine-offered objects preserved; scalar coercion rejected; native reveal-only sentinel acknowledgment; native display function retained; native source+destination ordering, optional subset ordering, and opaque choices fail closed.

6. Required matchup native runs, seed20261025: Calling All Angels beat Keen Engineering turn12 (8,345ms); Reign of Dragons beat Calling All Angels turn11 (4,949ms). Both human-side HTTP startup configurations validated Giada command-zone ID100 vs Sai/Lathliss ID201; each player exactly100 cards,40 life, count-only libraries.

## Entry points
- `./run-native-smoke.sh <seed> <games> [deck1-alias] [deck2-alias]` uses unmodified `SimulateMatch` via bootstrap that does not initialize Sentry; `USE_SENTRY=false` also set.
- `./run-bridge.sh [port=8765] [seed=20261025] [human=calling-all-angels] [ai=keen-engineering]` creates one native selected-precon match and loopback-only HTTP server. Fresh random token is written to local `adapter/connection.json` (do not commit/upload this file).
- For the original Keen-v-Reign regression fixture, explicitly start the bridge with those two aliases, then run `python adapter/test-http.py` or `test-http-finish.py` in the same shell, terminating the server afterward. This tool runtime showed foreground services isolated from later exec calls; cross-exec connection refused while original session remained alive.
- `adapter/CONTRACT.md` describes precise transport.

## Deliberate boundaries
No CardStashy production changes, Phase Rust changes, external hosting, credentials/accounts, paid jobs or uploads were performed by this proof worker. No fake rules/LLM simulation. Unknown native prompts and complex damage allocation are not invented; native ordering uses exact offered source/destination/remaining semantics. A complete human-facing Commander UI remains a separate acceptance task; even multiple complete games do not establish every mechanic branch, hidden-zone permutation or multiplayer behavior. Misleading Signpost and Leyline Tyrant native scripts exist but their rare branches were not separately scenario-proven.

`./prepare-engine.sh` obtains/verifies the exact public Forge revision without changing an existing mismatched checkout. CI may provide standard Maven/JDK and call `./build-classpath.sh`; no credential or security-bypass setup is required.

Frozen candidate 20261026-0018-full excludes experimental Smart policy. Explicit Default/full/cheatshuffle-off Keen-v-Reign seed20261025 retained the verified Island65/SolRing7 opening and passed full HTTP cast/payment/stack regression again (`logs/default-full-http-test.log` in producer workspace). FullControl is a plumbing proof, not desired final UX. Smart/automatic mana UX and required user-deck browser acceptance remain open.

0018 focused regressions executed against this exact Java: ability cancel→same live priority→reclick→land→cast/payment/resolution PASS; standard native GUI-player fixture actual Sol Ring tap→floating colorless2→deferred native confirmation false→same live priority→retry→true→next phase PASS. Duplicate command rejected during deferred prompt transition; string boolean rejected. These tests use actual native controllers and cards; the fixture only uses the standard native GUI lobby identity needed to activate Forge’s GUI-player-only floating-mana warning. No test-only HTTP operation or game-state mutation is exposed.
