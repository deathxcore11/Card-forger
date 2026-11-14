---
name: perf-check
description: Take a performance reading of a CardStashy screen on a real device and compare it with studio/standards.md. Use before calling anything smooth or slow, and after any change to animation, images or start-up.
---

# Performance check

Needs a device over adb. No device: stop and report "Not assessed", with these steps.

1. Record build, device and refresh rate (`adb shell dumpsys display | grep -i refresh`).
2. Reset frame stats: `adb shell dumpsys gfxinfo <package> reset`.
3. Do the thing for 30 seconds: one CPU turn on the table, a scroll of Home, opening and
   closing a dialog five times.
4. Read `adb shell dumpsys gfxinfo <package>`: total frames, janky frames, the 50th, 90th,
   95th and 99th percentile frame times.
5. Start time: `adb shell am force-stop <package>` then `adb shell am start -W <package>/<activity>`, three runs.
6. Memory at the table: `adb shell dumpsys meminfo <package>`.
7. Any stall: `adb logcat -d` and the app's freeze report.

Report a table per screen with those numbers, then the findings from the
`performance-analyst` role. Save the raw output as the proof file.
