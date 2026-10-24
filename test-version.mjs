// The version in Settings must match the release version, so it can't fall behind again.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_VERSION } from "./config.js";
import { RELEASE } from "./release-record.js";
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
assert.equal(APP_VERSION, pkg.version, `config.js APP_VERSION ${APP_VERSION} ≠ package.json ${pkg.version}`);
assert.equal(RELEASE.webVersion, pkg.version, "the public release endpoint advertises the current website version");
const androidMeta = JSON.parse(readFileSync(new URL("." + RELEASE.android.href.replace(/\.apk$/, ".json"), import.meta.url)));
assert.equal(RELEASE.android.interfaceVersion, androidMeta.appSource.match(/CardStashy (\d+\.\d+\.\d+)/)?.[1], "the APK interface version describes its actual bundled source even when the website advances");
assert.ok(!/Version \d+\.\d+\.\d+/.test(readFileSync(new URL("./views.js", import.meta.url), "utf8")), "no hard-coded version in views.js");
console.log(`PASS: Settings shows the release version (${APP_VERSION}).`);
