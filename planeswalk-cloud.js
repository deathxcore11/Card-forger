// Planeswalk cloud: backs up the run, profile and settings to the signed-in account, and logs
// each finished run (picks, deck, result) for balance. Needs no changes in the game for the
// backup: it copies every planeswalk.* and pw-* localStorage key. The game calls:
//   pwCloud.logOffer(kind, offered, picked)  each reward/shop/emblem choice (picked = null for Skip)
//   pwCloud.logRun(summary)                  once when a run ends, won or lost
//   pwCloud.history(limit)                   this account's recent runs from any device
// Signed out, the backup is off and runs are still logged without an account.
import { SUPABASE, APP_VERSION } from "./config.js";

const LIB = "./vendor/supabase-js-2.110.0.js";
const SYNC = "cs-pw-cloud-sync", DEVICE = "cs-pw-cloud-device", OFFERS = "cs-pw-offers", RELOADED = "cs-pw-cloud-restored";
const OWN = /^(planeswalk\.|pw-)/;
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: k => { try { localStorage.removeItem(k); } catch {} },
  json: k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
};
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };

function snapshot() {
  const out = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (OWN.test(k)) out[k] = localStorage.getItem(k); } } catch {}
  return Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
}
const hashOf = data => fnv(JSON.stringify(data));
const hasProgress = data => Object.keys(data).some(k => k.startsWith("planeswalk."));
// The game starts a fresh run on first open, so only the profile shows real history.
const hasProfile = data => typeof data["planeswalk.profile.v1"] === "string";
const device = () => { let d = ls.get(DEVICE); if (!d) { d = Math.random().toString(36).slice(2, 10); ls.set(DEVICE, d); } return d; };

let client = null, user = null, timer = 0, pushing = false;
const configured = () => !!(SUPABASE.url && SUPABASE.key);

async function push() {
  if (!client || !user || pushing) return;
  const data = snapshot(), hash = hashOf(data), last = ls.json(SYNC);
  if (last?.hash === hash || !hasProgress(data)) return;
  pushing = true;
  try {
    const { data: row, error } = await client.from("planeswalk_saves")
      .upsert({ user_id: user.id, data, device: device(), updated_at: new Date().toISOString() })
      .select("updated_at").single();
    if (!error) ls.set(SYNC, JSON.stringify({ hash, at: row.updated_at }));
  } catch {} finally { pushing = false; }
}

function restore(data, at) {
  // Only while no fight is on screen, and only once per tab, so the page never reloads under the player.
  if (document.querySelector("#app section.battle") || sessionStorage.getItem(RELOADED)) return false;
  for (const k of Object.keys(snapshot())) if (!(k in data)) ls.del(k);
  for (const [k, v] of Object.entries(data)) if (OWN.test(k) && typeof v === "string") ls.set(k, v);
  ls.set(SYNC, JSON.stringify({ hash: hashOf(snapshot()), at }));
  try { sessionStorage.setItem(RELOADED, "1"); } catch {}
  location.reload();
  return true;
}

async function reconcile() {
  const { data: row, error } = await client.from("planeswalk_saves").select("data,device,updated_at").eq("user_id", user.id).maybeSingle();
  if (error) return;
  const local = snapshot(), lh = hashOf(local), last = ls.json(SYNC);
  if (row?.data && typeof row.data === "object") {
    const ch = hashOf(row.data);
    if (ch === lh) { ls.set(SYNC, JSON.stringify({ hash: lh, at: row.updated_at })); return; }
    const untouchedHere = last?.hash === lh, newerThere = !last || row.updated_at > last.at;
    const freshHere = hasProfile(row.data) && !hasProfile(local);
    if (hasProgress(row.data) && (freshHere || (untouchedHere && newerThere && row.device !== device()))) {
      if (restore(row.data, row.updated_at)) return;
    }
    if (freshHere) return; // never overwrite a real profile with a brand-new device's empty one
  }
  await push();
}

async function start() {
  if (!configured()) return;
  try {
    const { createClient } = await import(/* @vite-ignore */ LIB);
    client = createClient(SUPABASE.url, SUPABASE.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const { data } = await client.auth.getSession();
    user = data?.session?.user || null;
    client.auth.onAuthStateChange((_e, session) => { const next = session?.user || null; if (next?.id !== user?.id) { user = next; if (user) setTimeout(() => reconcile().catch(() => {}), 0); } });
  } catch { client = null; return; }
  if (!user) return;
  await reconcile().catch(() => {});
  clearInterval(timer);
  timer = setInterval(() => { if (document.visibilityState === "visible") push(); }, 20000);
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") push(); });
  addEventListener("pagehide", () => push());
}

function logOffer(kind, offered, picked = null) {
  const list = ls.json(OFFERS) || [];
  const name = c => String(c?.name ?? c?.id ?? c ?? "").slice(0, 40);
  list.push({ k: String(kind).slice(0, 16), o: (offered || []).slice(0, 6).map(name), p: picked == null ? null : name(picked) });
  ls.set(OFFERS, JSON.stringify(list.slice(-150)));
}

async function logRun(s = {}) {
  const names = a => (Array.isArray(a) ? a : []).slice(0, 80).map(c => String(c?.name ?? c?.id ?? c).slice(0, 40));
  const p = {
    version: APP_VERSION, hero: s.hero, seed: s.seed == null ? "" : String(s.seed), act: s.act, floor: s.floor,
    won: !!s.won, killedBy: s.killedBy || "", bestTurn: s.bestTurn || 0, turns: s.turns || 0,
    deck: names(s.deck), emblems: names(s.emblems), offers: ls.json(OFFERS) || [],
  };
  ls.del(OFFERS);
  if (!configured()) return;
  try {
    if (client && user) await client.rpc("log_planeswalk_run", { p });
    else await fetch(SUPABASE.url + "/rest/v1/rpc/log_planeswalk_run", { method: "POST", keepalive: true, headers: { apikey: SUPABASE.key, Authorization: "Bearer " + SUPABASE.key, "Content-Type": "application/json" }, body: JSON.stringify({ p }) });
  } catch {}
  push();
}

async function history(limit = 20) {
  if (!client || !user) return [];
  const { data, error } = await client.from("planeswalk_runs")
    .select("created_at,hero,seed,act,floor,won,killed_by,best_turn,turns,deck,emblems")
    .order("created_at", { ascending: false }).limit(Math.min(50, limit));
  return error ? [] : data;
}

window.pwCloud = { logOffer, logRun, history, syncNow: push, status: () => ({ configured: configured(), signedIn: !!user, last: ls.json(SYNC) }) };
start();
