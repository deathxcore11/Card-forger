// Accounts and cloud saving (Supabase). Device storage stays the source the app
// works from; the account holds a private copy that follows you to other devices.
// Writes are revision-checked, so two devices never silently overwrite each other.
import { SUPABASE } from "./config.js";

const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/+esm";
const META = "cardforge-cloud-v1";
const PUSH_DELAY = 2500;

export const cloudConfigured = () => !!(SUPABASE.url && SUPABASE.key);

/* ---------- pure helpers (tested) ---------- */

// Fingerprint of a workspace, ignoring the save timestamp.
export function workspaceSig(state) {
  const { lastSavedAt, ...rest } = state || {};
  void lastSavedAt;
  const text = JSON.stringify(rest);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36) + ":" + text.length;
}

// Example data or nothing at all: safe to replace without asking.
export const isEmptyWorkspace = (s) => !s || s.example === true || (!s.collection?.length && !s.decks?.length && !s.wishlist?.length && !s.references?.length);

export function summarize(s) {
  const copies = (s?.collection || []).reduce((a, e) => a + (Number(e.qty) || 0), 0);
  return { copies, names: s?.collection?.length || 0, decks: s?.decks?.length || 0, wishlist: s?.wishlist?.length || 0, saved: s?.lastSavedAt || null };
}

// What to do after reading the account copy.
//   upload      – no account copy yet; this device has nothing worth previewing
//   offer       – no account copy yet; preview this device's data before uploading
//   adopt       – take the account copy (this device has nothing new)
//   link        – both copies are identical; just remember the link
//   push        – this device has newer changes than the account
//   none        – already in sync
//   choose      – first time on this device and both sides have different data
//   conflict    – both changed since the last sync
export function decideSync({ cloud, meta, userId, local }) {
  const localSig = workspaceSig(local),
    empty = isEmptyWorkspace(local);
  if (!cloud) return empty ? "upload" : "offer";
  const cloudSig = workspaceSig(cloud.data);
  if (!meta || meta.userId !== userId) {
    if (cloudSig === localSig) return "link";
    return empty ? "adopt" : "choose";
  }
  const localChanged = localSig !== meta.sig;
  if (cloud.revision === meta.revision) return localChanged ? "push" : "none";
  if (cloud.revision > meta.revision) {
    if (cloudSig === localSig) return "link";
    return localChanged ? "conflict" : "adopt";
  }
  return "choose"; // the account copy is older than what we last saw (reset or restored elsewhere)
}

/* ---------- runtime ---------- */

let client = null,
  user = null,
  profile = null,
  hooks = null,
  pushTimer = null,
  pushing = false,
  pending = null; // { kind: "offer" | "choose" | "conflict", cloud }
const status = { state: "local", msg: "", at: null };

const readMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(META) || "null");
  } catch {
    return null;
  }
};
const writeMeta = (m) => {
  try {
    if (m) localStorage.setItem(META, JSON.stringify(m));
    else localStorage.removeItem(META);
  } catch {}
};
const device = () => {
  const ua = navigator.userAgent || "";
  const kind = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone/iPad" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : "Browser";
  return (kind + " · " + new Date().toLocaleDateString()).slice(0, 120);
};

function setStatus(state, msg = "") {
  status.state = state;
  status.msg = msg;
  if (state === "synced") status.at = new Date().toISOString();
  hooks?.status(statusLabel());
  hooks?.changed();
}
export function statusLabel() {
  if (!user) return ["Saved on this device", "ok"];
  return (
    {
      syncing: ["Syncing…", ""],
      synced: ["Synced to your account", "ok"],
      error: ["Saved on this device · sync paused", "bad"],
      decide: ["Sync needs your decision", "bad"],
      offline: ["Saved on this device · offline", ""],
    }[status.state] || ["Synced to your account", "ok"]
  );
}

export const cloudInfo = () => ({ configured: cloudConfigured(), ready: !!client, user, profile, status: { ...status }, pending, meta: readMeta() });

export async function initCloud(h) {
  hooks = h;
  if (!cloudConfigured()) return;
  try {
    const { createClient } = await import(/* @vite-ignore */ LIB);
    client = createClient(SUPABASE.url, SUPABASE.key, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
  } catch {
    status.state = "error";
    status.msg = "Couldn’t load the account service. Your cards are still saved on this device.";
    hooks.changed();
    return;
  }
  client.auth.onAuthStateChange((event, session) => {
    const next = session?.user || null;
    if (next?.id === user?.id) return;
    user = next;
    profile = null;
    if (user) setTimeout(() => startSync(), 0);
    else setStatus("local");
  });
  const { data } = await client.auth.getSession();
  // Remove the one-time sign-in code from the address bar.
  if (/[?&]code=/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
  if (data?.session?.user && !user) {
    user = data.session.user;
    startSync();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && user && !pending) checkRemote();
  });
  window.addEventListener("online", () => user && !pending && startSync());
}

const redirectTo = () => location.origin + location.pathname;
export async function signInGoogle() {
  if (!client) throw Error("Accounts aren’t available right now.");
  const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  if (error) throw error;
}
export async function signInEmail(email) {
  if (!client) throw Error("Accounts aren’t available right now.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error("Enter a valid email address.");
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}
export async function signOut() {
  if (!client) return;
  await flushPush().catch(() => {});
  await client.auth.signOut();
  user = null;
  profile = null;
  pending = null;
  setStatus("local");
}

async function loadProfile() {
  const { data } = await client.from("profiles").select("username, display_name, avatar_url, bio, favorite_formats").eq("id", user.id).maybeSingle();
  profile = data || { display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "", avatar_url: user.user_metadata?.avatar_url || "" };
  hooks.changed();
}
export async function saveProfile(fields) {
  if (!client || !user) throw Error("Sign in first.");
  const clean = {
    display_name: String(fields.display_name || "").trim().slice(0, 60) || null,
    username: String(fields.username || "").trim() || null,
    bio: String(fields.bio || "").trim().slice(0, 500) || null,
  };
  if (clean.username && !/^[A-Za-z0-9_]{3,30}$/.test(clean.username)) throw Error("Usernames are 3–30 letters, numbers or underscores.");
  const { data, error } = await client.from("profiles").upsert({ id: user.id, ...clean }).select("username, display_name, avatar_url, bio, favorite_formats").single();
  if (error) throw Error(/duplicate|unique/i.test(error.message) ? "That username is taken." : error.message);
  profile = data;
  hooks.changed();
}

async function fetchCloud() {
  const { data, error } = await client.from("workspaces").select("data, revision, device, updated_at").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function startSync() {
  if (!client || !user) return;
  if (!navigator.onLine) return setStatus("offline");
  setStatus("syncing");
  try {
    loadProfile().catch(() => {});
    const cloud = await fetchCloud(),
      meta = readMeta(),
      local = hooks.getState(),
      action = decideSync({ cloud, meta, userId: user.id, local });
    await act(action, cloud, local);
  } catch (e) {
    setStatus("error", e.message || String(e));
  }
}

async function act(action, cloud, local) {
  pending = null;
  if (action === "upload") return pushNow(true);
  if (action === "push") return pushNow();
  if (action === "none") return setStatus("synced");
  if (action === "link") {
    writeMeta({ userId: user.id, revision: cloud.revision, sig: workspaceSig(local) });
    return setStatus("synced");
  }
  if (action === "adopt") return adopt(cloud, local);
  pending = { kind: action, cloud };
  setStatus("decide");
  hooks.decide(pending);
}

// `download` also saves a backup file; automatic syncs keep only the on-device recovery copy.
async function adopt(cloud, local, download = false) {
  if (!isEmptyWorkspace(local)) await hooks.backup(local, "Before loading your account copy", download);
  await hooks.apply(cloud.data);
  writeMeta({ userId: user.id, revision: cloud.revision, sig: workspaceSig(hooks.getState()) });
  pending = null;
  setStatus("synced");
}

// The user's answer to an "offer", "choose" or "conflict" prompt.
export async function resolvePending(choice) {
  const p = pending;
  if (!p || !user) return;
  const local = hooks.getState();
  if (choice === "later") {
    pending = null;
    return setStatus("error", "Sync paused until you choose which copy to keep.");
  }
  if (choice === "account") return adopt(p.cloud, local, true);
  if (choice === "device") {
    if (p.cloud) await hooks.backup(p.cloud.data, "Account copy before replacing it", true);
    pending = null;
    if (!p.cloud) return pushNow(true);
    // Overwrite the account copy, still revision-checked against what we just read.
    writeMeta({ userId: user.id, revision: p.cloud.revision, sig: "" });
    return pushNow();
  }
}

export function scheduleSync() {
  if (!user || pending) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(), PUSH_DELAY);
}
async function flushPush() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    await pushNow();
  }
}

async function pushNow(first = false) {
  pushTimer = null;
  if (!client || !user || pending) return;
  if (pushing) return scheduleSync();
  if (!navigator.onLine) return setStatus("offline");
  pushing = true;
  setStatus("syncing");
  try {
    const data = hooks.getState(),
      meta = readMeta(),
      sig = workspaceSig(data);
    if (meta?.userId === user.id && meta.sig === sig && !first) return setStatus("synced");
    let row;
    if (first || !meta || meta.userId !== user.id) {
      const r = await client.from("workspaces").insert({ user_id: user.id, data, revision: 1, device: device() }).select("revision").single();
      if (r.error) {
        // Someone (another device) created the account copy first.
        if (/duplicate|unique|conflict/i.test(r.error.message) || r.error.code === "23505") return conflictFromServer();
        throw r.error;
      }
      row = r.data;
    } else {
      const r = await client.from("workspaces").update({ data, revision: meta.revision + 1, device: device() }).eq("user_id", user.id).eq("revision", meta.revision).select("revision");
      if (r.error) throw r.error;
      if (!r.data?.length) return conflictFromServer();
      row = r.data[0];
    }
    writeMeta({ userId: user.id, revision: row.revision, sig });
    setStatus("synced");
  } catch (e) {
    setStatus("error", e.message || String(e));
  } finally {
    pushing = false;
  }
}

async function conflictFromServer() {
  const cloud = await fetchCloud(),
    action = decideSync({ cloud, meta: readMeta(), userId: user.id, local: hooks.getState() });
  pushing = false;
  await act(action === "push" ? "conflict" : action, cloud, hooks.getState());
}

// Cheap check for changes made on another device.
async function checkRemote() {
  if (!client || !user || pushing) return;
  try {
    const { data } = await client.from("workspaces").select("revision").eq("user_id", user.id).maybeSingle();
    if (data && data.revision !== readMeta()?.revision) startSync();
  } catch {}
}
export const syncNow = () => startSync();
