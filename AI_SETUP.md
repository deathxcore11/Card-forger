# Connect AI deck review

The app's Power tab now offers an optional AI second opinion for Magic, Pokémon and Yu-Gi-Oh. The existing deterministic scores remain unchanged. This is an analysis assistant, not a full rules judge or match simulator.

## Owner setup

1. In your OpenAI API project, enable API billing and create a project API key that can call the Responses API. Use a separate project for this app so its usage is easy to monitor. ChatGPT access does not itself configure an API key for this Worker.
2. In Cloudflare, open **Workers & Pages → cardforge2 → Settings → Variables and Secrets → Add**. Choose **Secret**, name it **OPENAI_API_KEY**, and paste the key there. Save/deploy. Never paste it into chat, `config.js`, GitHub, or a browser setting.
3. Deploy this branch through the existing Cloudflare build. `wrangler.jsonc` provisions the **AI_REVIEW_LIMITS** Durable Object and SQLite migration. If the build reports a Durable Object provisioning error, resolve that in Cloudflare; with app limits enabled, the endpoint deliberately will not make paid calls without this binding.
4. Open `/api/ai/deck-review` on the app's own domain. A connected installation returns `available:true`; this only checks configuration presence, not key validity. Open a deck → Power → **Review with AI** to verify a real request. An invalid key, unavailable model, insufficient API credit or provider outage produces a graceful unavailable message. Inspect the OpenAI project usage/error dashboard for provider details; the app never exposes raw provider errors or secrets.

## Current testing mode

The deployed Wrangler configuration explicitly sets `AI_LIMITS_ENABLED` to `false` at the owner's request. Both app quotas are bypassed, including counters exhausted before this update. OpenAI's rate limits and billing still apply. Anyone with the live app URL can request reviews using the server key; this mode is not an access restriction.

Before public launch, set `AI_LIMITS_ENABLED` to `true` in `wrangler.jsonc` and redeploy, or configure authenticated subscription allowances first. Removing the flag also restores limits by default. Existing persistent quota counts are preserved.

Optional Cloudflare **plaintext variables**:

| Name | Default | Purpose |
| --- | --- | --- |
| AI_LIMITS_ENABLED | true in code; false in current testing deployment | Only the exact string `false` bypasses hourly and daily app quotas. |
| OPENAI_MODEL | gpt-4.1-mini | Responses model with strict JSON Schema support. Changing this requires checking that model's API access and costs. |
| AI_DAILY_LIMIT | 20 | Maximum attempts for the whole app per UTC day, clamped to 0–200. Set 0 to pause requests. |

When limits are enabled, each IP also has three attempts per UTC hour (shared networks share that allowance). Failed upstream requests count toward both limits. There is no automatic retry. Browser memory reuses successful results for the unchanged deck during that page session. These quotas limit this endpoint, not unrelated API-key usage. Monitor the project budget and usage in OpenAI as well.

CLI alternative from the repo: `npx wrangler secret put OPENAI_API_KEY`, followed by the normal deploy if needed. Enter the key only at Wrangler's private prompt.

## What is sent and retained

After the user taps **Coach this deck**, the app sends the selected deck's game/format, quantities/zones, card rules/details, the app's computed facts (Power breakdown, hand odds, goldfish results, rules-text links, tournament comparison), a sample opening hand dealt by the app, the names and rules text of up to 25 owned cards that could be swapped in (only cards that pass the format's legality check), and the top five tournament archetypes from the app's public meta data with their most-played cards. It does not send the rest of the collection, quantities owned, account identifiers, prices, private notes or deck title. The Worker does not log/store deck payloads or reviews. OpenAI is called with `store:false`; that is not a promise of zero provider retention. See OpenAI's API data controls for provider policies.

The quota object stores counters and a daily-salted hash of Cloudflare's client IP header. A single state record is replaced each day/hour; provider storage backup retention may differ. No raw IP, deck or review is stored in that record.

## Quality contract

- AI does not change scores, legal status, saved decks or collections.
- Each displayed stress test, Power challenge and swap must have exact text evidence from a known supplied card; every step of a winning line must be a card in the deck, quoting that card's text.
- The app checks AI lines in code (copies, once-per-turn reuse, Magic mana by turn, Pokémon Supporter/attachment/evolution limits, Yu-Gi-Oh! Normal Summon and Extra Deck rules) and re-scores every swap with Deck Power, including the legality check, before showing it. Swaps may only add owned cards that were supplied. Matching a quote does **not** prove the interpretation or combo is valid.
- Reports distinguish ideas from strengths/risks and expose remaining costs, timing and rules checks.
- No live tournament, pricing or external rules lookup is provided to the model.
- Tests mock the API. After activation, compare winning lists against deliberately damaged lists in all three games before treating AI advice as dependable.
