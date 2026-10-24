# Website updates and Android batches

The owner requested independent website releases and less frequent Android updates. Website releases may ship while the installed Android app retains an older bundled interface.

## Website release

- Update the website version, release ID/date, and website release notes.
- Retain the complete published `RELEASE.android` record, APK, checksum, artifact metadata, and native source baseline unless an Android release is explicitly included.
- Label website-only changes clearly. The native client also reads the public release notes.
- Keep Android update availability based on the published Android version/code. A newer website version alone must not imply that a newer APK exists.
- Do not publish unfinished APKs, even at an unadvertised URL. The website serves tracked download assets directly.
- Run the website regression and hosted checks, then verify the deployed website bytes and the retained APK download identity.

The existing installed app keeps its bundled interface. Shared online data and services can still change independently.

## Android batch release

1. Finish and test the planned website changes. Select the exact website source commit to bundle and record it in the Android source baseline and artifact metadata.
2. Build from that commit using the existing native wrapper, package identity, and signing key. Increase the Android version code above the latest published app.
3. Run the strict Android release verifier against that exact source. Shared modules, styles, artwork, and the reviewed native transforms must match; package, version, size, checksum, and signing certificate must pass. Do not relax this verifier to accept an older APK against a newer website.
4. Test Android-specific behavior: sign-in callbacks, camera permissions and scanning, Back navigation, file import/export, haptics, background/resume, and preservation of saved data during an in-place upgrade.
5. Publish the verified APK, metadata, checksum, and Android release record together. Verify the public download bytes.

Matching means the APK contains the shared interface and features from its recorded website commit, with the existing native adaptations. It does not mean every native behavior is identical to a browser. If the website changes after that commit, either rebuild the APK against the final intended website source or disclose its older bundled interface accurately.

After publication, website updates may continue independently until the next Android batch.
