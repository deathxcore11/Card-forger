import { DurableObject } from 'cloudflare:workers';
import { accountVerifier } from './auth.mjs';
import { nativeAdapter } from './native-adapter-next.mjs';
import { AdmissionService, MatchService, routeHostRequest } from './service-core.mjs';

export class ForgeAdmission extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.service = new AdmissionService({ ctx, env, verifyBearer: accountVerifier(env), native: nativeAdapter(env) });
  }
  fetch(request) { return this.service.fetch(request); }
  alarm() { return this.service.alarm(); }
  pendingStatus(matchId, ownerId) { return this.service.pendingStatus(matchId, ownerId); }
  verifyLease(allocation) { return this.service.verifyLease(allocation); }
  release(matchId, generation) { return this.service.release(matchId, generation); }
}

// One DO ID, one container, one JVM, one human viewer vs CPU. No process reuse.
export class ForgeMatchContainer extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.service = new MatchService({ ctx, env, verifyBearer: accountVerifier(env), native: nativeAdapter(env) });
    ctx.blockConcurrencyWhile(async () => {
      const allocation = await ctx.storage.get('allocation');
      // Restore only the inactivity setting; NEVER start after DO eviction/deploy.
      if (allocation?.status === 'running' && ctx.container?.running) {
        await ctx.container.setInactivityTimeout(600_000);
      }
    });
  }
  fetch(request) { return this.service.fetch(request); }
  alarm() { return this.service.alarm(); }
  // Namespace-only methods. Only ForgeAdmission receives this binding; the app
  // receives the default HTTP service, never the DO namespace or container port.
  begin(allocation, input, admission) { return this.service.begin(allocation, input, admission); }
  reconcile(allocation) { return this.service.reconcile(allocation); }
  destructionProof(generation) { return this.service.destructionProof(generation); }
  // The same account's next start ends this match on its own destruction proof.
  endForNewStart(allocation) { return this.service.endForNewStart(allocation); }
}
export default {
  fetch(request, env) { return routeHostRequest(request, env, accountVerifier(env)); },
};
