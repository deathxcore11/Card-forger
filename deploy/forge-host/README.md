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

`npm ci --ignore-scripts && node scripts/deploy-private-host.mjs` is the private
Cloudflare build entrypoint. It verifies the frozen proof sources, reruns source
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
Do not deploy the source template or merge the proof branch's root configuration
over the website configuration. The generated host can be disabled through its
admission flag; existing leases still need normal cleanup. Record the actual
Worker version and image digest before attaching the website service binding.
