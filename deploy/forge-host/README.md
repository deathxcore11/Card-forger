# Forge account host

This release package connects verified, non-anonymous CardStashy accounts to the
existing Forge service. It preserves exact submitted decks, native legality and
implementation checks, private viewer projection, lease ownership and cleanup.
It does not maintain a product deck allowlist or compile card behavior at launch.

The source comes from the successful browser proof `ea5b2272348e9deb219f4f0360f202e0d6fdf49f`.
The account policy adds an explicit `authenticated` mode; older trial settings
remain supported for existing tests. A one-hour allocation, two simultaneous
containers, one active match per account and a rolling eight-hour global runtime
reservation budget bound the first hosting release. Failed/closed reservations
are not refunded. This is a resource limit, not a card or deck restriction.

`.github/workflows/forge-host-deploy.yml` runs the private deployment on the same
Ubuntu 24.04 GitHub runner used by the passing Docker/browser proof. Publish the
prepared changes on `codex/forge-account-host-20261026` with `[skip ci]` in the
commit message. Once its secret is configured, an intentional follow-up commit
without the skip marker starts one job from the reviewed sources.
No schedule, automatic retry, or pull-request deployment is enabled. A rerun
attempt is refused. The account ID is fixed in the workflow; the repository
Actions secret `CLOUDFLARE_API_TOKEN` is required. It must be scoped to the intended
Cloudflare account and allow private Worker deployment and Containers image
publication. Never commit the token or send it through chat.

The workflow stops before dependency installation or native compilation if the
secret is absent, the account is wrong, or authenticated Worker/Containers reads
fail. Those reads do not prove write permission: the actual push/deploy is still
checked. GitHub's ephemeral runner runs one bounded build with a 32-minute job
limit and the existing 25-minute driver deadline.

`npm ci --ignore-scripts && node scripts/deploy-private-host.mjs` is the private
deployment entrypoint. It verifies the frozen proof sources, reruns source
and host checks, builds one image and probes that exact image. Publication binds
the registry digest to that probed Docker config and validates the native
compiler, class and rules receipts. Cleanup is required before deployment.
The deployment has no public Worker URL, preview URL or custom domain. It does
not alter `cardforge2`, the existing website, or Supabase authentication.

Browser proof 40360492632 passed desktop completion/rematch and touch-emulated
casting/payment against the same native source. This private deployment must
still pass Cloudflare runtime, website integration and real-account acceptance.
Easy/Hard gameplay and physical-device acceptance are not established by it.

The source `wrangler.jsonc` deliberately contains an invalid image placeholder.
The build generates a temporary exact-digest configuration only after its probe.
The existing Cloudflare Builds trigger is diagnostic-only and must not be used
to rebuild this image. The preparation commit uses `[skip ci]` so neither build
system starts. Before activating GitHub deployment, retire only the private host's
automatic diagnostic through a supported Builds control; preserve website and
other branch build settings. An attempted branch exclusion returned HTTP 400 and
did not change the trigger. The account-host website preview remains disabled.
Do not deploy the source template or merge the proof branch's root configuration
over the website configuration. The generated host can be disabled through its
admission flag; existing leases still need normal cleanup. Record the actual
Worker version and image digest before attaching the website service binding.
