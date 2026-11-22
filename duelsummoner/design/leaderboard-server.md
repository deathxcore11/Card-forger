# Duel Summoner leaderboards: server plan

Randall said go on 22 Nov 2026, 5:38 PM ET. This plan fits the boards onto what CardStashy already runs. Nothing here goes live without his release tap.

## 1. What we reuse

- **Sign-in:** CardStashy accounts are Supabase (`cloud.js`, `config.js`). Players use the login they already have. Anonymous users can play, but they cannot post a score.
- **Friends:** the community friends list and blocks that presence uses (`community_private`, migration `20261104013000_community_presence.sql`). The Friends board reads accepted friends from there, and blocked players never show.
- **Worker:** the Cloudflare Worker in `deploy/forge-host` already checks a Supabase bearer token (`auth.mjs`, `createSupabaseBearerVerifier`). The submit route reuses it.
- **Checker:** `duelsummoner/tools/verify.mjs` (`verifyReplay(record)`). It rebuilds the run from seed, difficulty, mode and Oaths, replays the input tape, and must match the score, state hash and tick count.
- **Migration style:** a private schema, RLS on, no direct table grants, and one `security definer` action function that checks `auth.uid()` and that the user is not anonymous. This is the same pattern as presence.

## 2. Flow

1. A run ends. The game already builds the replay record: v, seed, duelist, mode, difficulty, offers, oaths, world, meta, tape, ticks, endAt, ended, score, hash and version.
2. **Submit:** the app sends `POST /ds/runs` to the Worker with the Supabase token and the record. The Worker checks the token, checks the size and shape, and saves the row as **pending**. It answers at once: "Score sent, checking it".
3. **Check:** a checker picks up pending rows and runs `verifyReplay`.
   - Pass: the row becomes **verified** and enters the boards.
   - Fail: the row becomes **rejected**, with the reasons kept for us. It never shows on a board.
4. The app polls `GET /ds/runs/:id`, or reads it on the next menu open, and shows "Verified, you placed #12 this week".

Only verified rows reach any board, and a pending score is shown only to its owner.

## 3. Where the check runs (the one cost)

A check replays the whole run, which is seconds of CPU for a 26-minute run. That is over the free Worker CPU limit, so the check runs as a queue:

- **Start (free):** a scheduled checker, either a Node script on a small always-on machine or a GitHub Action every 10 minutes. It pulls pending rows with the service key, verifies them and writes the result. Players wait a few minutes for "verified".
- **Later, if needed:** a small paid compute plan or VPS, usually a few dollars a month. These prices are from memory and must be checked before choosing.

The checker must run the same build as the record (`version`). It keeps one checker per live build version. A record from an unknown build stays pending with the note "waiting for checker v…".

## 4. Tables (schema `ds_private`)

**runs**: one row per submitted run.

| Column | Type | Note |
|---|---|---|
| id | uuid pk | |
| user_id | uuid → auth.users | on delete cascade |
| status | text | pending, verified, rejected |
| map | text | stage or map id |
| difficulty | text | easy, medium, hard |
| mode | text | |
| duelist | text | |
| oaths | text[] | sorted |
| seal_code | text | the shareable seed code |
| seed | text | |
| build | text | the record version |
| score | integer | as claimed; only trusted once verified |
| ticks | integer | |
| run_ms | integer | ticks × tick length |
| hash | text | |
| record | jsonb | the full replay, about 22 KB (60 KB cap) |
| why | text[] | rejection reasons |
| created_at, checked_at | timestamptz | |
| week | date | Monday of the week (UTC) at submit, for weekly boards |

Indexes: (status, created_at); (map, difficulty, week, score desc) where verified; (map, difficulty, score desc) where verified; (user_id, created_at desc).

**best**: one row per player per board key, filled by the checker when a run verifies, so boards read fast.
- Key: (user_id, map, difficulty, duelist or '*', oath_set or '*', period), where period is 'all' or the week date.
- Holds: run_id, score and run_ms. Ties go to the shorter run time, then the earlier submit.

**profiles**: reuse the app's existing display name and avatar. If the app has no avatar column, add `ds_private.profile(user_id, name, avatar_url)` that the app fills from the account.

## 5. Action function `ds_private.board_action(action, payload)`

- `submit`: the Worker uses this with the user's token. It checks that the user is signed in and not anonymous, enforces the record size cap and 30 submits per user per hour, and inserts a pending row.
- `status`: returns your own run's status, score and placing.
- `board`: takes map, difficulty and period (week or all), plus an optional duelist, an optional oath set and a scope (global or friends). It returns the top 100 plus your own row and placing, each with name, avatar, duelist, score, time, Oaths and seal code.
- `replay`: returns one verified run's record, so anyone can watch or re-check it.
- `seal`: returns the top scores on one shared seed, for daily and friend challenges.

The checker writes only through a separate service-role function, `ds_private.check_result(id, ok, why, hash, score)`. That function also updates `best`.

## 6. Boards the menu shows

- For each map and difficulty: **This week** and **All time**, each as **Everyone** or **Friends**.
- Filters: one duelist, and an Oath set.
- **Daily seal:** one shared seal code a day, the same for everyone, with its own board.
- The weekly reset is Monday 00:00 UTC. The menu already has the countdown.

## 7. Cheating and safety

- Every score shown was re-run on our machine, and a claimed score is never trusted.
- The size cap and rate limit stop floods.
- Display text is cleaned the way presence does it: control characters and angle brackets are stripped and the length is capped. The app escapes it again when drawing.
- Blocked players are hidden from each other on Friends boards.
- An admin can hide a row (`status = 'hidden'`) without deleting it.
- Keys: the service key lives only in the checker's secret store. Nothing secret goes in the repo, which is public.

## 8. Build and test order

1. **Local reference service on Randall's PC:** Node, with a JSON or SQLite file standing in for the tables and the real `verifyReplay`. Test the full flow: finish a run, submit, see pending, see verified, see it on the menu board, and confirm a tampered record is rejected. This step is marked Pass only when seen in the game in a browser.
2. **Migration file** `supabase/migrations/<date>_ds_leaderboards.sql`, following the presence pattern.
3. **Worker routes** `/ds/runs` and `/ds/runs/:id` in the forge-host Worker.
4. **Checker job** with the service key held as a secret.
5. **Release:** through the Release thread with his tap, like any other change.

## 9. Size

A score row is about 1 KB, and a replay about 22 KB. 10,000 runs is about 220 MB, and 100,000 is about 2 GB. To save space later, keep the full replay only for runs that are on a board (top 100 of any board, or a personal best) and drop the tape from the rest after 30 days.
