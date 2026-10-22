// The current Android beta download. Settings links to it and the Worker forwards links to any
// earlier APK here, so a page cached before an update never offers a file that is gone.
export const ANDROID_BETA = Object.freeze({ version: "0.3.3 beta", href: "/downloads/cardstashy-android-beta-0.3.3.apk", bytes: 24315694, sha256: "26d5eab440ea101e05a06f1248a1cbb9ac25dd926c16eadc27f20c1f8b597e7e" });
export const ANDROID_BETA_OLD_APK = /^\/downloads\/cardstashy-android-beta-\d+\.\d+\.\d+\.apk$/;
