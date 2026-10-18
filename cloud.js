import { timedFetch } from "./auth-form.js";
// Accounts and cloud saving (Supabase). Device storage stays the source the app
// works from; the account holds a private copy that follows you to other devices.
// Writes are revision-checked, so two devices never silently overwrite each other.
import { SUPABASE } from "./config.js";
import { createPasswordAuth, authError } from "./password-auth.js";
let recoveringPassword = false, authNotice = "";

const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/+esm";
const META = "cardforge-cloud-v1";
const PUSH_DELAY = 2500;

export const cloudConfigured = () => !!(SUPABASE.url && SUPABASE.key);
// The browser sends its session token; the Worker independently verifies it.
export async function cloudAccessToken(){
 if(!client)return '';
 try{const {data,error}=await client.auth.getSession();return error?'':data?.session?.access_token||'';}catch{return '';}
}

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
export const isEmptyWorkspace = (s) => !s || s.example === true || ![s, ...Object.values(s.tcg || {})].some(g => g.collection?.length || g.decks?.length || g.wishlist?.length || g.notes?.length || g.references?.length) && !s.settings?.binders?.length && !s.settings?.cardAvatar && !s.settings?.profileHeader;

export function summarize(s) {
  const games = [s || {}, ...Object.values(s?.tcg || {})];
  return { copies: games.reduce((n,g) => n + (g.collection || []).reduce((a,e) => a + (Number(e.qty) || 0),0),0), names: games.reduce((n,g)=>n+(g.collection?.length||0),0), decks: games.reduce((n,g)=>n+(g.decks?.length||0),0), wishlist: games.reduce((n,g)=>n+(g.wishlist?.length||0),0), saved:s?.lastSavedAt || null };
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
  // A cleared device must never silently replace a populated account.
  if (empty && !isEmptyWorkspace(cloud.data)) return meta?.userId === userId && meta.sig !== localSig ? "choose" : "adopt";
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

let syncEpoch = 0, syncRead = 0, accountReady = false, accountInitialized = false, accountSwitch = Promise.resolve();
let providers = { email: true }, // sign-in methods enabled on the project
  client = null,
  user = null,
  profile = null,
  accountArt = null,
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
// Forget only this device's sync baseline; never issue a cloud delete or empty upload.
export function detachDeviceSync() {
  syncEpoch++; clearTimeout(pushTimer); pushTimer = null; pending = null; writeMeta(null);
}

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
    }[status.state] || ["Saved on this device · account sync not confirmed", ""]
  );
}

export const cloudInfo = () => ({ configured: cloudConfigured(), ready: !!client, user, profile, art: accountArt, providers, status: { ...status }, pending, switching: !accountReady, recoveringPassword, authNotice, meta: readMeta() });

// Turn backend errors into something a player can act on.
function friendly(e) {
  const m = String(e?.message || e || "");
  if (e?.code === "PGRST205" || /schema cache|relation .* does not exist/i.test(m)) return "Your account storage isn’t set up yet (the database tables are missing).";
  if (/JWT|token|session/i.test(m)) return "Your sign-in expired. Sign in again to resume syncing.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Couldn’t reach the account service. Check your connection.";
  return m || "Something went wrong while syncing.";
}

export async function initCloud(h, { createClient: factory } = {}) {
  hooks = h;
  const callbackQuery = new URLSearchParams(location.search), callbackHash = new URLSearchParams((location.hash || "").slice(1));
  const callbackCode = callbackQuery.has("code"), callbackError = callbackQuery.get("error_description") || callbackHash.get("error_description");
  if (!cloudConfigured()) return;
  try {
    const createClient = factory || (await import(/* @vite-ignore */ LIB)).createClient;
    client = createClient(SUPABASE.url, SUPABASE.key, { global: { fetch: timedFetch }, auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
  } catch {
    status.state = "error";
    status.msg = "Couldn’t load the account service. Your cards are still saved on this device.";
    hooks.changed();
    return;
  }
  // Which sign-in buttons to show (public endpoint; failures just keep the email option).
  fetch(SUPABASE.url + "/auth/v1/settings", { headers: { apikey: SUPABASE.key } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d?.external) {
        providers = { email: d.external.email !== false, google: !!d.external.google, confirmationRequired: d.mailer_autoconfirm !== true, signup: d.disable_signup !== true };
        hooks.changed();
      }
    })
    .catch(() => {});
  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session?.user) {
      recoveringPassword = true;
      setTimeout(() => { hooks.passwordRecovery?.(); hooks.changed(); }, 0);
    }
    const next = session?.user || null;
    if (!next || (next.id !== user?.id && event !== "PASSWORD_RECOVERY")) recoveringPassword = false;
    // Never await a Supabase call inside its auth callback (it holds the auth lock).
    changeAccount(next).catch(() => {});
  });
  const { data, error } = await client.auth.getSession();
  // Capture callback parameters before the SDK consumes them, then remove only
  // authentication parameters. Keep normal page routing and unrelated query data.
  const hadCallbackError = !!(error || callbackError);
  if (hadCallbackError) authNotice = authError(error || callbackError);
  if (callbackCode || callbackError) {
    for (const key of ['code','error','error_code','error_description']) callbackQuery.delete(key);
    const hash = callbackHash.has('error_description') ? '' : location.hash;
    history.replaceState(null, "", location.pathname + (callbackQuery.size ? '?' + callbackQuery : '') + (hash || ''));
  }
  await changeAccount(data?.session?.user || null);
  if (user && !hadCallbackError && callbackCode && !recoveringPassword) authNotice = 'You’re signed in. Your account is ready.';
  if (hadCallbackError || authNotice) { hooks.passwordRecovery?.(); hooks.changed(); }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && user && !pending) checkRemote();
  });
  window.addEventListener("online", () => user && !pending && startSync());
}

function changeAccount(next) {
  if(accountInitialized && next?.id===user?.id)return accountSwitch;
  accountInitialized=true;
  const previous=user,baseline=readMeta(),epoch=++syncEpoch;
  clearTimeout(pushTimer);pushTimer=null;pending=null;pushing=false;accountReady=false;
  user=next;profile=null;accountArt=null;status.at=null;
  hooks?.accountChanged?.(next,previous);
  accountSwitch=accountSwitch.catch(()=>{}).then(async()=>{
    // The hook serializes with local edits and atomically saves the old owner.
    const result=await hooks?.switchWorkspace?.(next?.id||null,baseline);
    if(epoch!==syncEpoch)return;
    if(result)writeMeta(result.meta);
    accountReady=true;
    setStatus(next?'syncing':'local');
    hooks?.accountOpened?.();
    if(next)setTimeout(()=>startSync(),0);
  }).catch(e=>{
    if(epoch===syncEpoch)setStatus('error','Couldn’t open this account’s saved workspace. '+friendly(e));
    throw e;
  });
  return accountSwitch;
}
const redirectTo = () => location.origin + location.pathname;
export async function signInGoogle() {
  if (!client) throw Error("Accounts aren’t available right now.");
  const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  if (error) throw Error(authError(error));
}
export async function signInEmail(email) {
  if (!client) throw Error("Accounts aren’t available right now.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error("Enter a valid email address.");
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw Error(authError(error));
}
function passwordAuth() {
  if (!client) throw Error("Accounts aren’t available right now.");
  authNotice = "";
  return createPasswordAuth(client.auth, redirectTo);
}
export const signInPassword = async (email,password) => {const data=await passwordAuth().login(email,password);await accountSwitch;return data;};
export const createAccount = (email,password,confirm) => passwordAuth().signup(email,password,confirm);
export const requestPasswordReset = email => passwordAuth().reset(email);
export const resendConfirmation = email => passwordAuth().resend(email);
export async function finishPasswordReset(password,confirm) {
  if (!recoveringPassword || !user) throw Error("Open the password-reset email first. Request a fresh link if it has expired.");
  await passwordAuth().update(password,confirm);
  recoveringPassword = false;
  hooks.changed();
}
export async function signOut() {
  if (!client) return;
  await flushPush().catch(() => {});
  const synced = status.state === "synced" && readMeta()?.sig === workspaceSig(hooks.getState());
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw Error(authError(error));
  await changeAccount(null);
  detachDeviceSync();
  user = null;
  profile = null;
  pending = null;
  recoveringPassword = false;
  authNotice = "";
  setStatus("local");
  return { synced };
}

// Deletes the signed-in account and everything synced to it (profile, collection, decks), via the
// delete_my_account database function. Data on this device is left for the caller to clear.
export async function deleteAccount() {
  if (!client || !user) throw Error("Sign in first to delete your account.");
  await flushPush().catch(() => {});
  const { error } = await client.rpc("delete_my_account");
  if (error) throw Error(/function .*does not exist|PGRST202/i.test(error.message + error.code) ? "Account deletion isn't set up on the server yet. Please try again later." : authError(error));
  await client.auth.signOut().catch(() => {});
  await changeAccount(null);
  user = null;
  profile = null;
  pending = null;
  authNotice = "";
  setStatus("local");
}

async function loadProfile() {
  const owner = user?.id, epoch = syncEpoch;
  if (!owner) return;
  const { data } = await client.from("profiles").select("username, display_name, avatar_url, bio, favorite_formats").eq("id", owner).maybeSingle();
  if (user?.id !== owner || syncEpoch !== epoch) return;
  profile = data || { display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "", avatar_url: user.user_metadata?.avatar_url || "" };
  hooks.changed();
  if(client.rpc)try{
    const {data:overview,error}=await client.rpc('community_action',{action:'overview',payload:{}});
    if(!error && user?.id===owner && syncEpoch===epoch){accountArt=overview?.art||null;hooks.changed();}
  }catch{}
}
export async function saveProfile(fields) {
  if (!client || !user) throw Error("Sign in first.");
  const owner=user.id,epoch=syncEpoch;
  const clean = {
    display_name: String(fields.display_name || "").trim().slice(0, 60) || null,
    username: String(fields.username || "").trim() || null,
    bio: String(fields.bio || "").trim().slice(0, 500) || null,
  };
  if (clean.username && !/^[A-Za-z0-9_]{3,30}$/.test(clean.username)) throw Error("Usernames are 3–30 letters, numbers or underscores.");
  const { data, error } = await client.from("profiles").upsert({ id: owner, ...clean }).select("username, display_name, avatar_url, bio, favorite_formats").single();
  if (error) throw Error(/duplicate|unique/i.test(error.message) ? "That username is taken." : error.message);
  if(user?.id!==owner||syncEpoch!==epoch)throw Error('Your account changed. Please try again.');
  profile = data;
  hooks.changed();
}

// Social requests are tied to the current account, including late responses.
export async function communityRequest(action,payload={}) {
 if(!client||!user||!accountReady)throw Error('Sign in to use friends.');
 const owner=user.id,epoch=syncEpoch;
 const {data,error}=await client.rpc('community_action',{action,payload});
 if(user?.id!==owner||syncEpoch!==epoch)throw Error('Your account changed. Please try again.');
 if(error)throw Error(/PGRST202|does not exist/.test(error.code+' '+error.message)?'Community is updating. Please try again shortly.':error.message);
 if(data?.error)throw Error(data.error);
 if(action==='save_art'){accountArt={avatar:payload.avatar||null,header:payload.header||null};hooks.changed();}
 return data;
}

async function fetchCloud() {
  const { data, error } = await client.from("workspaces").select("data, revision, device, updated_at").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function startSync() {
  if (!client || !user || !accountReady) return;
  if(pending){setStatus('decide');hooks.decide(pending);return;}
  if(pushing)return;
  if (!navigator.onLine) return setStatus("offline");
  const owner = user.id, epoch = syncEpoch, read = ++syncRead;
  const current=()=>user?.id===owner&&syncEpoch===epoch&&read===syncRead&&accountReady&&!pending;
  setStatus("syncing");
  try {
    loadProfile().catch(() => {});
    const cloud = await fetchCloud();
    if (!current()) return;
    const meta = readMeta(),
      local = hooks.getState(),
      action = decideSync({ cloud, meta, userId: user.id, local });
    await act(action, cloud, local, current);
  } catch (e) {
    if (current()) setStatus("error", friendly(e));
  }
}

async function act(action, cloud, local, current) {
  if(!current())return;
  if (action === "upload") return pushNow(true);
  if (action === "push") return pushNow();
  if (action === "none") return setStatus("synced");
  if (action === "link") {
    writeMeta({ userId: user.id, revision: cloud.revision, sig: workspaceSig(local) });
    return setStatus("synced");
  }
  if (action === "adopt") return adopt(cloud, local, false, current);
  pending = { kind: action, cloud, owner: user.id, epoch: syncEpoch };
  setStatus("decide");
  hooks.decide(pending);
}

// `download` also saves a backup file; automatic syncs keep only the on-device recovery copy.
async function adopt(cloud, local, download = false, decisionCurrent=()=>true) {
  const owner=user?.id,epoch=syncEpoch,current=()=>user?.id===owner&&syncEpoch===epoch&&accountReady&&decisionCurrent();
  if(!owner||!current())return;
  const sig=workspaceSig(local),unchanged=()=>current()&&workspaceSig(hooks.getState())===sig;
  const edited=()=>{if(!current())return;pending={kind:'conflict',cloud,owner,epoch};setStatus('decide');hooks.decide(pending);};
  if (!isEmptyWorkspace(local)) await hooks.backup(local, "Before loading your account copy", download);
  if(!current())return;
  if(!unchanged())return edited();
  const applied=await hooks.apply(cloud.data,{owner,current:unchanged});
  if(!current())return;
  if(applied===false){if(!unchanged())edited();return;}
  writeMeta({ userId: owner, revision: cloud.revision, sig: workspaceSig(hooks.getState()) });
  pending = null;
  setStatus("synced");
}

// The user's answer to an "offer", "choose" or "conflict" prompt.
export async function resolvePending(choice, expected = pending) {
  const p = pending;
  if (!p || p !== expected || !user || !accountReady || p.owner !== user.id || p.epoch !== syncEpoch) return false;
  const owner=user.id,epoch=syncEpoch,read=++syncRead;
  const current=()=>user?.id===owner&&syncEpoch===epoch&&accountReady&&pending===p&&syncRead===read;
  const local = hooks.getState();
  if (choice === "later") {
    return setStatus("error", "Sync paused until you choose which copy to keep.");
  }
  if (choice === "account") return adopt(p.cloud, local, true, current);
  if (choice === "device") {
    if (p.cloud) await hooks.backup(p.cloud.data, "Account copy before replacing it", true);
    if(!current())return;
    pending = null;
    if (!p.cloud) return pushNow(true);
    // Overwrite the account copy, still revision-checked against what we just read.
    writeMeta({ userId: user.id, revision: p.cloud.revision, sig: "" });
    return pushNow();
  }
}

export function scheduleSync() {
  if (!user || pending || !accountReady) return;
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
  if (!client || !user || pending || !accountReady) return;
  if (pushing) return scheduleSync();
  if (!navigator.onLine) return setStatus("offline");
  const owner = user.id, epoch = syncEpoch;
  ++syncRead; // A write supersedes any older reconciliation read.
  const operation = {owner,epoch};
  pushing = operation;
  setStatus("syncing");
  try {
    const data = hooks.getState(),
      meta = readMeta(),
      sig = workspaceSig(data);
    if (meta?.userId === owner && meta.sig === sig && !first) return setStatus("synced");
    let row;
    // A missing/foreign baseline must be reconciled before any upload. In
    // particular, choosing “later” must never turn into an automatic insert.
    if(!first && meta?.userId!==owner){pushing=false;return startSync();}
    if (first) {
      const r = await client.from("workspaces").insert({ user_id: owner, data, revision: 1, device: device() }).select("revision").single();
      if (user?.id !== owner || syncEpoch !== epoch) return;
      if (r.error) {
        // Someone (another device) created the account copy first.
        if (/duplicate|unique|conflict/i.test(r.error.message) || r.error.code === "23505") return conflictFromServer();
        throw r.error;
      }
      row = r.data;
    } else {
      const r = await client.from("workspaces").update({ data, revision: meta.revision + 1, device: device() }).eq("user_id", owner).eq("revision", meta.revision).select("revision");
      if (user?.id !== owner || syncEpoch !== epoch) return;
      if (r.error) throw r.error;
      if (!r.data?.length) return conflictFromServer();
      row = r.data[0];
    }
    if (user?.id !== owner || syncEpoch !== epoch) return;
    writeMeta({ userId: owner, revision: row.revision, sig });
    setStatus("synced");
  } catch (e) {
    if (user?.id === owner && syncEpoch === epoch) setStatus("error", friendly(e));
  } finally {
    if(pushing===operation)pushing = false;
  }
}

async function conflictFromServer() {
  const owner=user?.id,epoch=syncEpoch,read=++syncRead;
  const current=()=>user?.id===owner&&syncEpoch===epoch&&accountReady&&read===syncRead&&!pending;
  if(!owner||!accountReady||pending)return;
  const cloud = await fetchCloud();
  if(!current())return;
  const action = decideSync({ cloud, meta: readMeta(), userId: owner, local: hooks.getState() });
  pushing = false;
  await act(action === "push" ? "conflict" : action, cloud, hooks.getState(), current);
}

// Cheap check for changes made on another device.
async function checkRemote() {
  if (!client || !user || pushing || !accountReady || pending) return;
  const owner=user.id,epoch=syncEpoch;
  loadProfile().catch(()=>{});
  try {
    const { data } = await client.from("workspaces").select("revision").eq("user_id", owner).maybeSingle();
    if (user?.id===owner && syncEpoch===epoch && data && data.revision !== readMeta()?.revision) startSync();
  } catch {}
}
export const syncNow = () => startSync();
