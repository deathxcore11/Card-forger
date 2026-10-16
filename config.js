// CardStashy accounts (Supabase). Both values are public by design: the
// publishable/anon key only allows what the database's row-level security
// policies allow (each user can reach only their own rows).
// Never put a "service_role" or "secret" key here.
// Leave `key` empty to run CardStashy without accounts (device storage only).
export const SUPABASE = {
  url: "https://noxfmbwuytnbvfgukpiv.supabase.co",
  key: "sb_publishable_TpEfTlAdziX6ALSZLA7U_A_tBKKHcAz",
};

// The app version shown in Settings. Kept equal to package.json by test-version.mjs.
export const APP_VERSION = "3.73.10";
