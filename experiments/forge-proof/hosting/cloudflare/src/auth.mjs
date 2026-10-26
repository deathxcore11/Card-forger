import { createSupabaseBearerVerifier } from './vendor/app/native-backend-contract.js';
import { SUPABASE } from './vendor/app/config.js';
export function accountVerifier(env, fetcher = fetch) {
  return createSupabaseBearerVerifier({
    url: env.SUPABASE_URL || SUPABASE.url,
    key: env.SUPABASE_ANON_KEY || SUPABASE.key,
    fetcher,
  });
}
