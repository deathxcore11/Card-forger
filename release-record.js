// Website 4.3.8 is a web-only update; Android 0.8.1 beta still bundles website 4.3.6.
export const RELEASE = Object.freeze({
 id:'web-4.3.8-play-audit-fixes-android-0.8.1',date:'2026-10-28',webVersion:'4.3.8',
 changes:["Play fixes from the bug audit: seat buttons pick the right player, the settings lock holds, and dragging a card onto the dock plays it.","Back and forward no longer leave a dead table, and sideboard imports with blank lines work.","Copy deck keeps the commander, mirror Quick Play works, the tracker and Zones menu show the right cards, and your name no longer runs into your life total."],

 android:Object.freeze({version:'0.8.1 beta',versionName:'0.8.1-beta',versionCode:16,interfaceVersion:'4.3.6',package:'com.cardstashy.app',href:'/downloads/cardstashy-android-beta-0.8.1.apk',bytes:25675807,sha256:'c11518090f06f6ec973cea361fe220925955a155ec30cd35a8e50994eef1b4ae'})
});
