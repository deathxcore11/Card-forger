// Cardforge accounts (Supabase). Both values are public by design: the
// publishable/anon key only allows what the database's row-level security
// policies allow (each user can reach only their own rows).
// Never put a "service_role" or "secret" key here.
// Leave `key` empty to run Cardforge without accounts (device storage only).
export const SUPABASE = {
  url: "https://noxfmbwuytnbvfgukpiv.supabase.co",
  key: "sb_publishable_TpEfTlAdziX6ALSZLA7U_A_tBKKHcAz",
};
