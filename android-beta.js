// The current Android beta download. Settings links to it and the Worker forwards links to any
// earlier APK here, so a page cached before an update never offers a file that is gone.
import {RELEASE} from './release-record.js';
export const ANDROID_BETA = RELEASE.android;
export const ANDROID_BETA_OLD_APK = /^\/downloads\/cardstashy-android-beta-\d+\.\d+\.\d+\.apk$/;
