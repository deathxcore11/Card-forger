// Account deletion (Google Play): in the app (Settings → Account → Delete account, typed DELETE)
// and on the web (delete-account.html), backed by a database function that deletes only the
// signed-in user and everything synced to them.
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL("./" + f, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261015120000_delete_my_account.sql");
assert.match(sql, /create or replace function public\.delete_my_account\(\)/);
assert.match(sql, /security definer/);
assert.match(sql, /auth\.uid\(\)/, "deletes only the signed-in user");
assert.match(sql, /delete from auth\.users where id = uid/);
assert.match(sql, /delete from public\.workspaces where user_id = uid/);
assert.match(sql, /revoke all on function public\.delete_my_account\(\) from public, anon/, "anonymous callers can't run it");
assert.match(sql, /grant execute on function public\.delete_my_account\(\) to authenticated/);
assert.match(read("cloud.js"), /client\.rpc\("delete_my_account"\)/);
const app = read("app.js");
assert.match(app, /A\.deleteAccount = /);
assert.match(app, /v\.trim\(\) !== "DELETE"/, "typed confirmation");
assert.match(read("views.js"), /data-act="deleteAccount"/, "Settings has the button");
const page = read("delete-account.html");
assert.match(page, /<title>Delete your CardStashy account<\/title>/);
assert.match(page, /What gets deleted/);
assert.match(page, /href="\.\/#settings"/, "links into the web app");
assert.ok(!/sb_secret_[A-Za-z0-9]/.test(page + read("config.js")), "no secret keys in public files");
assert.match(read("config.js"), /key: "(?:sb_publishable_[A-Za-z0-9_]+|)"/, "the app ships only the publishable key");
console.log("PASS: Account deletion in the app and on the web, limited to the signed-in user.");
