# Google Play readiness checklist

Written 30 Oct 2026 for CardStashy Android (com.cardstashy.app). Today the app ships as a sideloaded APK. This is what stands between it and a Play Store listing. Requirements change; check each against the Play Console before submitting.

## Already done
- Target and compile SDK 36 (android-app/android/variables.gradle). Play raises the required target every August, so recheck before each submit.
- In-app and web account deletion (delete-account.html, `delete_my_account`), which Play requires for apps with accounts.
- Release signing key exists (kept out of the repo; the APK thread holds it).
- Permissions are few: camera (scanner), vibrate, internet.

## To do
1. **Ship an app bundle (.aab), not an APK.** Play only accepts bundles for new apps. Turn on Play App Signing and upload the current key as the upload key, so sideloaded users can update in place.
2. **Fit the size limit.** The base module may be at most 200 MB compressed. We are about 57 MB, so it fits, but moving the Forge engine into an on-demand asset pack would cut the first download (see the smaller-APK item).
3. **Closed test first.** A personal developer account created after Nov 2023 must run a closed test with at least 12 testers opted in for 14 days in a row before it can apply for production. Start this early; it's the slowest step.
4. **Data safety form.** Declare: email and user id (account), the synced collection and decks, Planeswalk saves and run logs (signed in), crash reports (anonymous: app version, screen, device size and user agent), camera images processed for the scanner. Say data is encrypted in transit and can be deleted.
5. **Privacy policy URL.** A public page that lists the same data as the Data safety form, plus the deletion link. Add a short section for crash reports and Planeswalk run logs (added 30 Oct).
6. **Content rating questionnaire** (IARC). No gambling with real money; pack openings are free, which matters for the "simulated gambling" question.
7. **Store listing.** 512x512 icon, 1024x500 feature graphic, at least 2 phone screenshots (plus 7- and 10-inch tablet ones for tablet visibility), short and full description.
8. **App access.** Give reviewers a test account or confirm all features work signed out.
9. **Pre-launch report.** Fix any crashes it finds on its test devices; the crash table (`app_errors`) will show the same ones.
10. **Updates for sideload users.** Once listed, point the in-app update banner at the Play listing instead of the APK download.
