# Duel Summoner menus and controller support

Final spec v2, 23 Nov 2026. It covers every screen outside a run, plus Pause, Quick Look, Results and the hand-off back from a run. The PC web build and the Android app share the layouts, focus order, button map and Settings rows exactly. Every name, word and look in this spec is our own. The reference videos gave us structure and lessons, nothing else.

Base: the "feel" draft, which put prompts on their controls, made the main menu a living camp, put Oaths inline and gave the Thor top screen to looking and the bottom to doing. Grafted onto it:
- From "handheld": the input and glyph rules, the Settings set suited to an app, the Thor two-screen summary, "Next" quest tab and pages that keep items whole.
- From "app": the cloud-save check at first launch, the separate Account tab, Camera assist for touch players, and the rule that everything focusable sits on the Thor bottom screen.

Notation: `[A] [B] [X] [Y] [LB] [RB] [LT] [RT] [Start] [Select] [LS] [RS] [R3]` name pad buttons. In menus, [A] and [B] mean **confirm** and **back** (on a Nintendo-family pad under Match pad these are the printed A on the right and the printed B at the bottom, 2.3). Every other bracket names a **position**: [X] left, [Y] top, and in a run [A] is always the bottom button. `⧉` is the Select glyph and `≡` is Start. Pixel sizes are for a 1920x1080 canvas unless a line says otherwise. Sample numbers in quotes are illustrative only; live values come from data.

---

## 1. What we keep from the reference and what we change

**Keep (structure only):**
- Four main verbs: play, unlocks, quests, shop.
- A tracker of the nearest quests, a weekly board with a reset countdown, and the meta currency at top right.
- A character select with a live 3D model, a rank, a run count, a starting weapon and a passive.
- A map select whose world changes with the map and the tier, with the multiplier, bests and stage count.
- A shop with rank pips and a full refund.
- A pause screen showing the build, the boons, all the stats and the exits.

**Change:**

| Reference | Ours |
|---|---|
| Small floating windows over empty scenery | Full-screen glass layouts with fixed regions; whole items always fit |
| Mouse cursor, close X, hover tooltips | Gold focus ring, Back chip, inline condition lines, Inspect |
| Centre column of verbs, a board card in the corner | Verbs on the left in our own order. The duelist stands in a **living camp** that grows with your collection; the board is a **standing stone in the camp** carrying your rival line. |
| Challenges behind a button | **Oaths** inline next to the live payout. Each one shows a visible sign in the world. |
| 8 quest tabs, finished quests drawn brightest | 6 tabs led by **Next**; finished quests are dimmed and sink to the end |
| Tier 1/2/3 with tinted skies and ×1.0/1.1/1.2 | Easy / Medium / Hard with our own skies (clear morning, amber dusk, eclipse) and our own Star Chip factors ×1.0 / ×1.25 / ×1.5 |
| PC settings (monitor, VSync, grass, AA, input delay...) | A small set suited to an app, built around one Performance profile |
| Ranked by kills, you scroll to find your own row | Verified score, your own row always pinned, a rival line |
| Pause: title, plaque, centre exit column, inventory left, stat list right; teal wash; map in a second modal | Pause as a **duel mat** (the board laid out as zones) plus a **Ledger column** with tabs. Dim and blur, no wash. Quick Look map; live on the Thor bottom screen. |
| Reward moment never shown | A paced reward sequence after every run |

---

## 2. Devices and input

### 2.1 Device classes (detected at launch and again on every display or input change; never hard-coded)

| Class | Detection (first match wins) | Layout |
|---|---|---|
| **Thor** (dual screen) | A **built-in pad** and a **built-in second panel**. Built-in pad = SOURCE_GAMEPAD with `isExternal()==false`, OR a (vendor, product, name) entry in `builtin-pads.json` (seeded on the owner's Odin 2 Portal and Thor), because USB-attached internal pads report external unless the vendor's `.idc` says `device.internal=1`. Built-in second panel = a second display present at launch whose physical diagonal is under 5.5 in (xdpi/ydpi from `createDisplayContext(d).resources.displayMetrics`) and which is not a cast or virtual display (`FLAG_PRIVATE`, or a MediaRouter route). An HDMI, DP-out or USB-C monitor, or a cast screen, fails this test: the device stays Portal or Phone class and the external display is ignored. Manufacturer "AYN" is only a hint. **Screen roles follow the panels' shape, not where the activity sits:** the 16:9 panel gets the look ("top") layout and the other panel the do ("bottom") layout. If the activity lands on the small panel after AYN's screen swap, it renders the do layout and the Presentation carries the look layout. A `DisplayListener` re-detects on every swap. | Two-screen layout while Display > Dual screen is On. **Retroid Pocket Duo** (bottom 1280x960): the same bottom layout scaled by H/1080; the two columns and the gutter stretch to fill the width (31:27 up to 4:3), with no pillarbox. |
| **Portal** (Odin 3 Portal, Odin 2 Portal, "Portal 3", any single-screen Android handheld) | A built-in pad and one built-in display | By aspect (3.8): 16:9 and wider = 1920x1080 canvas; 16:10 to 16:9 = 1920 wide with extra height to the body; narrower than 16:10 (31:27 Retroid Mini/Classic, 4:3) = stacked layout |
| **Phone** (foldables and tablets included) | All other Android devices. A foldable flag comes from Jetpack `WindowInfoTracker`. | Same aspect rules as Portal (3.8); foldable layouts in 3.8 |
| **PC** | The web build | Centred 16:9 frame, minimum 1280x720 |

- A Bluetooth pad never changes the class. It changes the glyph family and shows the Controller section in Settings.
- **Manifest (AdventureActivity only):**
  - `screenOrientation="sensorLandscape"`, `resizeableActivity="true"`.
  - `configChanges="screenSize|smallestScreenSize|screenLayout|orientation|density|keyboard|keyboardHidden|navigation|uiMode|fontScale|locale|layoutDirection"`, so a fold, a screen swap, or a pad or keyboard connecting never recreates the activity or loses the GL context.
  - System bars hidden with `WindowInsetsControllerCompat.hide(systemBars())` and `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` (the `SYSTEM_UI_FLAG_IMMERSIVE_STICKY` flags are deprecated).
  - Cutout mode `SHORT_EDGES`.
  - **Do not set `android:appCategory`.** It is an `<application>` attribute and would recategorise the whole card app as a game (Game Dashboard, battery treatment, Android 15's 60 Hz default for games). Revisit only if Adventures moves into its own package.
  - On displays 600 dp or wider, where Android 16+ may ignore the orientation lock, any window narrower than 1:1 uses the stacked layout (3.8).
  - The card app manifest needs the `VIBRATE` permission (2.4).

### 2.2 Glyph sets

All glyphs are drawn in our own style: a dark disc with a gold ring and a cream mark. No platform colours or logos. Every glyph slot is a fixed 44 px wide, so switching sets never moves the layout.

| Set (Settings name) | Face buttons | Shoulders / triggers | Start / Select | Used for |
|---|---|---|---|---|
| **Letters** | A B X Y in Xbox positions | LB RB LT RT | ≡ / ⧉ | Vendor 0x045E; 8BitDo in X-input mode; built-in pads whose `builtin-pads.json` entry says Xbox layout |
| **Shapes** | Cross, circle, square, triangle in our line style | L1 R1 L2 R2 | Our "options" and "create" marks | Vendor 0x054C |
| **Swapped letters** | Printed letters in their places: B bottom, A right, Y left, X top | L R ZL ZR | + / − | Vendor 0x057E; 8BitDo in Switch mode; built-in pads whose entry says Nintendo layout |
| **Plain** | A diamond of 4 dots with the active one filled | L1 R1 L2 R2 | ≡ / ⧉ | Unknown pads; 8BitDo (0x2DC8) in D-input mode |
| **Keys** | Our keycaps | | | PC, or Android with a physical keyboard, after a key press |
| **Touch icons** | No glyph. The control's own icon fills the slot: ‹ Back, ◂ ▸ tabs, page dots, ⋯ Options. | | | Touch-only phones that have never seen a pad this session |

- The **built-in glyph set** comes from `builtin-pads.json` (the printed layout per device), checked on the Odin 2 Portal and Thor. It is never assumed to be Xbox positions.
- **Web:** vendor and product are parsed from `Gamepad.id` (Chrome "Vendor: 057e Product: 2009", Firefox "057e-2009-").

**Which set:**
- The set follows the **last pad or keyboard that sent a press**.
- Touch and the mouse never change the set. A tap therefore never hides glyphs.
- **Keys** is chosen only on a non-gamepad keycode from a device with `getKeyboardType()==KEYBOARD_TYPE_ALPHABETIC`. Built-in and Bluetooth pads often also report SOURCE_KEYBOARD; volume, media and back keys never change the set.
- Built-in pads count as always connected, so Thor and Portal always show glyphs.
- When the last Bluetooth pad leaves a touch-only phone, the glyphs fade to touch icons over 400 ms.
- A newly connected pad switches the set on its **first press**, not on connect.

### 2.3 Nintendo swap and the Confirm setting

- Android usually maps Nintendo-family pads by position, so the printed A (on the right) arrives as BUTTON_B. Some hid-nintendo versions report by printed label instead, so this is checked, not assumed: on the first press of a 0x057E-family pad, quick setup (11.3) asks once, "Press the button labelled A", and stores the result per `getDescriptor()`.
- **Controls > Confirm button = Match pad / Choose…**
  - **Match pad** (the default) swaps **only the menu confirm and back roles** for that device. The printed A confirms, the printed B goes back.
  - **Choose…** shows "Press the button you want for Confirm" and stores that keycode per `getDescriptor()`; Back is the opposite face button. This also corrects AYN's system-level ABXY swap if the owner has it on.
- [X] (main action, left position) and [Y] (inspect, top position) stay positional and show the printed letters ("Y" and "X" on a Nintendo pad).
- **In-run actions stay positional:** Jump is always the bottom button, on every pad and every setting.
- All non-Nintendo sets confirm with the bottom button.
- Verify on a real Pro Controller and on an 8BitDo pad in Switch mode (build step 3).

### 2.4 Rumble

- Rumble goes to the **active pad only**. Strength is scaled by Controls > Vibration.
- **Which motor:**
  - The active pad's `getVibratorManager().vibratorIds` (API 31; `getVibrator()` below it), if any exist.
  - Otherwise, if the active pad is built in (Thor, Portal), or touch is the active input, the system vibrator: `VibratorManager.getDefaultVibrator()` (`Vibrator` below API 31).
  - The Vibration row greys out with "This controller can't vibrate" only when neither exists.
  - `hasVibrator()` can be true on Bluetooth pads whose driver drops force feedback, which cannot be detected, so the Vibration row's preview pulse doubles as the test.
  - Web: the Gamepad API vibration actuator.
- Patterns:

| Event | Pattern |
|---|---|
| Long-press opens a quick menu | 10 ms |
| Buy in the Deck Box | 25 ms, low motor |
| Swear an Oath | 45 ms |
| Library reveal | 3 x 15 ms, rising |

- Rising patterns use `VibrationEffect.createWaveform` with amplitudes only when `hasAmplitudeControl()`; otherwise durations only.
- Plain focus moves and presses never rumble. Touch haptics (Controls > Touch) add a tick on a tap-focus through `View.performHapticFeedback(CLOCK_TICK)`, never a raw short pulse (many LRA motors do not render under 10 ms).

### 2.5 Gyro

- Gyro is used only for camera look in runs. It never moves the menus.
- The Gyro look row shows only when the device (Thor, Portal, phone) or the active pad reports a gyroscope. Default Off.
- Device gyro = `SensorManager.getDefaultSensor(TYPE_GYROSCOPE)` on any class, Thor included. Pad gyro = `InputDevice.getSensorManager()` (API 31).
- Device axes are remapped with `SensorManager.remapCoordinateSystem` for the activity display's `getRotation()`. Never assume the natural orientation is landscape (the Odin 3 panel is portrait-native).

### 2.6 Disconnect, several pads, lifecycle

| Event | Behaviour |
|---|---|
| Pad connects | 2 s toast at top centre (on Thor, on the top screen): a drawing of the pad family plus "Controller connected". The ring stays where it is. The run never pauses. |
| Several pads | Any pad drives the game at any time. Glyphs and rumble follow the last pad that sent input. |
| Pad disconnects **in a run** while it was the last input device | The run pauses at once, always. This is not a setting. A card (720x320; on Thor on the bottom screen, top dimmed) sits over Pause: "Controller disconnected. Press any button on a controller to carry on." **Play by touch** shows only where On-screen controls is not hidden for this class (phones; Portal only if the player turned them on), and choosing it sets this session's On-screen controls to Always. A built-in pad remaining does not cancel the pause, because the player's hands were on the Bluetooth pad. |
| Closing the disconnect card | **Any press on any pad**, the built-in one included, or the same pad reconnecting (matched by `getDescriptor()`, because device ids change), closes the card. That pad becomes active. Pause stays open with Resume focused. The run never resumes by itself. |
| Disconnect during the load card or arrival | The card shows at hand-over, and sim tick 0 waits for it. |
| Pad disconnects in a menu | 2 s toast only. Glyphs fall back to the built-in pad, keycaps or touch icons. |
| Pad battery below 15% | One toast per session: "Controller battery low". On API 31+ poll `getBatteryState()` every 60 s; skip when `!isPresent()` or capacity is NaN. Hidden below API 31 and on the web. |
| Focus loss (notification shade), `onPause` | Run pauses and the input tape is saved |
| `onStop` | Tape saved, audio released. `surfaceDestroyed` releases only the EGLSurface; the EGLContext and its textures stay alive. The Thor Presentation is dismissed in `onStop` and recreated in `onStart`. |
| Return from focus loss or `onStop` | Pause is open with Resume focused, the 100 ms input grace applies, and the run never resumes by itself. The Presentation and GL surface are recreated before the first frame. |
| GPU reset | If `eglMakeCurrent` or `eglSwapBuffers` returns `EGL_CONTEXT_LOST`, rebuild every GPU resource from the asset manifest and redraw from the current JS display list. |
| Tape safety | The tape is appended to disk every 5 s, as well as on `onPause` and `onStop`, so a crash loses at most 5 s. Every 60 s of sim time, and at each stage start, a serialized sim snapshot plus its state hash is written next to the tape. |
| App killed mid-run | The main menu shows **RESUME RUN**. Resume loads the latest snapshot and replays the tape tail (60 s at most). The full tape is still what is submitted and verified, so the run stays valid for the boards. |
| RESUME RUN after an app update | The tape's build version is checked. If it differs, a card reads "This run was saved on an older version" with gold "[X] Collect earnings" (pays as End run) and ghost "[B] Not now". |
| Battery saver turns on | One card: "Battery saver is on. Switch to Battery profile?" Gold "[X] Switch", ghost "[B] Keep"; the ring opens on the gold button. Offered, never forced. If it turns on during a run, the card waits for the next Pause or Results and never covers live play. |
| Thermal and frame time | See the governor below. A 32 px heat icon shows in Quick Look and on the Pause mat header while throttled. No popups. |
| Android game mode | With no saved Performance override, `GameManager.getGameMode()` is read as a default hint only: BATTERY means the Battery profile, PERFORMANCE means Performance. It never overrides a saved choice. |

**Thermal and frame-time governor** (drives Render scale Auto):
- Poll `PowerManager.getThermalHeadroom(10)` at most every 10 s and ignore NaN. Also register `addThermalStatusListener`. Many vendor builds return `THERMAL_STATUS_NONE` always, so the frame-time governor below is always on.
- If p90 frame time stays over budget for 5 s, step render scale down 10% (floor 50%). If it stays under 70% of budget for 30 s, step up.
- At thermal SEVERE, or after 3 failed steps at 50%, drop the frame rate one step.
- Web: the frame-time governor only.

### 2.7 Touch at the same time

Touch always works alongside a pad. The two never fight. Touch hit-testing runs in JS against the layout rects on both platforms.

| Gesture | Effect |
|---|---|
| Tap | Moves the ring there and does the item's [A] action. On grids and lists, the first tap selects (and fills the details) and a second tap does [A]. Buttons, switches and tabs act on the first tap. **Exception:** Deck Box tiles: [A] and taps only select; buying is always [X] / the Buy button. |
| Long-press | **Menu screens only:** opens the [Select] quick menu, with a gold fill under the finger. Duration = `ViewConfiguration.getLongPressTimeout()` on Android, 450 ms on the web. **In a run and on Pause, long-press does nothing.** Quick Look on touch is a tap on the minimap (single screen) or on the bottom map (Thor). |
| Horizontal swipe on a grid or list | Page ([LT]/[RT]). Tabs do not swipe, so paging and tabs never clash. |
| Drag on a 3D model | Turns it. Pinch zooms in inspect views and the map. |
| System back gesture or Back key | [B] (see 3.2 for how Back arrives) |
| Sliders | Tap a point on the track to jump there, drag, or tap the ends to step |
| Segmented plates (2-4 choices) | Tap a segment |
| Value plates (5+ choices) | Tap the left or right half of the plate to step |

- **In runs**, `setSystemGestureExclusionRects` covers the move-stick zone on the left edge (capped at 200 dp of height), so edge swipes on the stick do not fire the system back gesture.

### 2.8 Keyboard and mouse (PC, or Android with a physical keyboard)

**Menus:**

| Key | Acts as |
|---|---|
| Arrows / WASD | Move the ring |
| Enter / Space | [A] |
| Esc / Backspace | [B] |
| F | [X] |
| R | [Y] |
| Q / E | [LB] / [RB] |
| Z / C, PgUp / PgDn, mouse wheel | [LT] / [RT] |
| F1 | [Start] |
| Tab | [Select] |
| Left click | Tap |
| Right click | [Select] (the same as a long-press) |

**In a run:** WASD / arrows move, Space Jump, C or Ctrl Slide, Shift Dash, E Use, Tab or M Quick Look, Esc Pause, mouse look.

**Offer screens in a run** (chests, level-ups, the Broker): F Redraw, R Exile, Esc Pass / Leave, Enter Take or Buy; 1-5 pick the matching card as a hidden accelerator (the Broker shows up to 5). There is no Settings row for it and the cards carry no numbers.

- Hover gives only a faint highlight. Nothing is ever shown only on hover, and hover never moves the ring.
- **Web main menu:** [B] / Esc does nothing (no sound, no prompt); there is no Adventures to leave to.
- **Full screen:** while in browser full screen, call `navigator.keyboard.lock(['Escape'])` where supported. Otherwise leaving full screen during a run opens Pause.
- **Pointer lock:** on Resume, request pointer lock. If the browser refuses (it will after a key-only resume), show a "Click to look" chip at bottom centre until the next click.

---

## 3. Global rules

### 3.1 Focus ring

- **Look:** 3 px gold `#E8C46E`, 4 px outside the item, following its radius plus 4, with a 12 px glow at 35%. It glides between items in 120 ms (ease-out).
- **The ring is the only "selected" mark, on every device, and the only gold outline anywhere.** It is drawn on touch-only phones too, because the details panels follow it, and on touch it rests on the last tapped item.
- "Cleared" or "done" is always a different mark: a 32 px gold wax check badge at the top right. Done items drop to 60% opacity.
- "Almost" (a goal at 90% or more) and "Fusion-ready" use a **24 px gold corner tab plus a text label**, never an edge or outline. (The approved Thor bottom preview's gold border on Fusion-ready cards becomes this corner tab.)
- **Opening a screen** always lands on a real item, so a details panel is never blank. The screen remembers the last focused item per tab for the session, and [B] back to a screen restores it.
- **Moving the ring:**
  - D-pad, HAT axes and left stick (threshold 0.5).
  - Per device, the first d-pad source seen (HAT axis or DPAD keys) wins and the other is ignored for that device, so a pad that sends both never moves twice. HAT_X/Y use edge detection at 0.5.
  - Holding repeats after 300 ms, every 90 ms, then every 60 ms after 1 s.
  - Inside a region the ring moves by geometry. Between regions it follows each screen's focus order below.
- **Edges:**
  - Lists and grids do not wrap. Down from the last row of a page turns to the next page and lands on its top row; up from the top row turns back.
  - Tabs wrap.
  - Values clamp.
- **Layers:** a sheet traps the ring. [B] closes the sheet and focus returns to whatever opened it. After any layer closes, a second press of the same button within 100 ms is ignored, so the [A] that resumes never also jumps.
- **Right stick [RS]:**
  - On screens with a 3D model, turns it. **[R3]** resets the view.
  - In inspect sheets, smooth scroll (no fling).
  - On grids and lists, flick = page (the same as [LT]/[RT]); a slow release snaps.
  - **No free cursor** in Duel Summoner, because every target is ring-reachable and pages replace scrolling. This is a deliberate difference from the card app, whose [RS] is a free cursor.
- **Thor:** the ring lives only on the bottom screen (3.9).

### 3.2 Button map for menus

| Button | Out-of-run menus | Pause | Rule |
|---|---|---|---|
| [A] | The focused item's own action (listed per screen); Inspect if it has none | Press. On a zone or item: open its card page. On a stat: expand its one-line explanation. | When [A] does the screen's main action, only the [X] glyph is printed |
| [B] | Back one step. On the main menu: leave to Adventures (web build: nothing). | Resume | See "Back" below |
| [X] | The screen's main action: the one gold button, working wherever the ring is | Resume (the only glyph drawn, on Resume) | At most one gold button per screen |
| [Y] | Inspect: the big view of the focused item, replacing every tooltip | Inspect the focused item (its card page) or stat (where the number comes from) | |
| [LB]/[RB] | Tabs, or the screen's paired switch (listed per screen) | Ledger tabs: Actions · Stats · Rites (Thor: jump between the action column and the board) | Tabs wrap |
| [LT]/[RT] | Page | Page the stats | |
| [Start] | Settings. Pressing [Start] again closes it. | Resume | In a run: Pause. In Settings opened from Pause, [Start] and [B] close Settings and return to Pause; they never resume the run directly. |
| [Select] | Quick menu for the focused item: a sheet of 2-4 actions. Items with no options show no chip, and [Select] does nothing. | Map | In a run and on Pause, [Select] means Map / Quick Look. It never opens an item quick menu there, and long-press never stands in for it. |
| [RS] / [R3] | 3.1 | Scroll a card page | |

**In play** (fixed here so the menus stay consistent; the controls spec in art-book/screens.mjs "Controls" is updated to match):

| Input | Action |
|---|---|
| [LS] | Move |
| [RS] | Look |
| [A] (bottom) | Jump |
| [B] (right) | Slide (Hold / Toggle per Controls > Slide) |
| [RB] | Dash |
| [X] | Use (hold [X] at a Gate) |
| [Start] | Pause |
| [Select] | Quick Look |
| [R3] | Recentre camera |
| [Y], [LB], [LT], [RT] | Unused in play |

- Code change: `host.js:25` moves Dash from B to RB and Slide from RB to B.
- **Offer screens** (chest, level-up, Broker): [A] Take or Buy the focused card, [X] Redraw, [Y] Exile, [B] Pass / Leave. Remove the R/P/L bindings (`offer.js:87-93`) and the "1. Name" numbering (`offer.js:70`).
- [Select] opens **Quick Look**:
  - Single screen: the full map, with [LB]/[RB] moving to the Build and Stats tabs. The sim freezes.
  - Thor: the bottom map grows to full size **without pausing**, as in the approved Thor bottom preview. Pressing [Select] again returns the board.

**Back:**
- Back from the navigation bar, the back gesture, the built-in pad's chin key, or any non-gamepad device = [B] in menus and Pause in a run.
- The back gesture is handled through an always-enabled `OnBackPressedCallback` (androidx) or `OnBackInvokedCallback` (API 33), because with predictive back (opt-in on Android 13-14, default when targeting SDK 35+) it never reaches `dispatchKeyEvent`. It routes to the same handler as KEYCODE_BACK; a duplicate arriving within 100 ms is dropped.
- KEYCODE_BACK from an **external** device whose sources include SOURCE_GAMEPAD/JOYSTICK:
  - If the device reports no BUTTON_B (`hasKeys`), it is treated as BUTTON_B (cheap pads that send BACK for their right face button). In a run that means Slide, not Pause.
  - Otherwise it is [Select] (AOSP `Vendor_045e_Product_02e0.kl` maps the older Xbox One S View button to KEY_BACK).
- KEYCODE_MENU from a gamepad source = [Start].
- Verify on the Xbox Series pad (0x0B13), and check which device the Thor and Portal chin Back key reports from, in step 26.

**Key and axis handling (native):**
- `dispatchKeyEvent` consumes keys where `KeyEvent.isGamepadButton(keyCode)` is true (except BUTTON_MODE), DPAD_* keys from gamepad or joystick sources, and gamepad-sourced BACK and MENU, so Android's B-to-BACK fallback never fires twice. It never consumes VOLUME_*, MUTE, MEDIA_*, POWER, CAMERA, HOME, APP_SWITCH or BUTTON_MODE.
- The HAT d-pad, triggers and sticks are read in `dispatchGenericMotionEvent`.
- Triggers: AXIS_LTRIGGER or AXIS_BRAKE, and AXIS_RTRIGGER or AXIS_GAS. Pressed at >0.5, released at <0.3; deduped against BUTTON_L2/R2.
- Right stick: AXIS_Z/AXIS_RZ, falling back to AXIS_RX/AXIS_RY when the device has no Z/RZ motion range. Dead zone = max(setting, `MotionRange.getFlat()`).
- Web: the Gamepad API standard mapping, buttons 6 and 7 for triggers.

### 3.3 Prompts: no footer bar

- There is **no prompt bar** anywhere. Every prompt sits on the thing it triggers:

| Button | Where its glyph is drawn |
|---|---|
| [B] | The Back chip (on Results, the Main menu button) |
| [LB]/[RB] | The two ends of the tab strip, or of the paired switch / block header |
| [LT]/[RT] | The two ends of the page dots (on Quick Look, the Zoom pill) |
| [X] | The gold button |
| [Y] | A small "Inspect" link in the details panel (labelled by what it opens where clearer, e.g. "Rank table") |
| [Select] | An "⋯ Options" chip, shown only when the item has options |
| [RS] | A small "Turn" chip under a 3D model, shown only while glyphs show |
| [A] | Never drawn, on any card or sheet. The ring already means "[A] presses this". |

- This keeps the no-redundant-prompts rule by construction. Every prompt is also a tappable control, so touch players get the same actions.
- **Thor:** the details panel sits on the top screen, which takes no touch. Its Inspect link and Options chip move to the **bottom foot row** next to the gold button. They are never on both screens.

### 3.4 Sounds

Each sound is its own short sample on the **Interface** volume, except the count-ups, which use **Rewards**.

| Action | Sound |
|---|---|
| Focus move | Paper flick (−6 dB; pitch +2% per step on long runs) |
| [A] | Card snap |
| [B] | Card slide |
| Tab | Page turn |
| Page | Riffle |
| Buy | Chip clink |
| Refund | Reverse clink |
| Swear Oath | Wax press |
| Reveal | Rising chime |
| Denied | Dull tap |

### 3.5 Motion budget

**Motion never blocks input.** Input is live from the first frame of every transition. A press during a transition snaps it to its end, then applies.

| Motion | ms |
|---|---|
| Ring glide | 120 |
| Press (scale 0.97) | 60 |
| Panel in (fade plus 24 px rise, staggered 40 ms) | 200 |
| Screen change (cross-fade; camera keeps moving behind) | 240 |
| Tab change (cross-fade plus 16 px slide) | 160 |
| Page turn (48 px slide) | 180 |
| Sheet in | 180 |
| Map or biome swap (through a dusk tint) | 280 |
| Difficulty sky swap | 250 |
| Duelist or outfit swap | 240 or less |
| Diorama camera move between screens | 600 |
| Count-ups (each skippable with [A] or a tap) | 1,200 or less |
| Denied shake (6 px) | 180 |
| Resume: game time ramps 0 to 1 | 300 |

- All motion is time-based, so it is identical at 60 and 120 Hz. Tweens are sent as {from, to, ms, ease} and run natively and on the web from one shared easing table (step 5).
- **Frame pacing:** `Choreographer.postFrameCallback` plus `EGLExt.eglPresentationTimeANDROID` (API 18), targeting the chosen rate. Swappy only if the renderer ever moves to the NDK (SwappyGL wraps `eglSwapBuffers` in native code and cannot serve a Kotlin `EGL14` renderer without a shim).
- **Reduce motion:** every slide becomes a 120 ms fade, camera moves become cuts, and shimmer, parallax, breathing glows and shakes are off.

### 3.6 Grid and text sizes per device

**Wide canvas, 1920x1080** (Portal, Thor top, PC frame, phones at 1080 tall):

| Part | Value |
|---|---|
| Margin | 48 |
| Grid | 12 columns of 130 px, gutter 24. A span of k columns is 154k − 24 px wide (span 4 = 592, 5 = 746, 7 = 1054, 8 = 1208). Columns 1, 5, 8 and 9 start at x 48, 664, 1126 and 1280. |
| Header | Drawn y 48-120: Back chip x48 (200x72), screen title (Cinzel 56) at x272, Star Chips x1632-1872 (240x72). Hit band y 24-144. |
| Tab strip | Drawn y 160-232; hit band y 144-264 |
| Body | y 264-1032 with tabs (6 rows × 120 + 48 page dots = 768); y 168-1032 without |

**Thor bottom, 1240x1080:**

| Part | Value |
|---|---|
| Margin | 48 |
| Columns | Left x48-596 and right x644-1192 (548 each, gutter 48). Full width x48-1192. |
| Top strip | y 0-120. Chips drawn 88 tall at y16-104, hit areas to the top edge. The Back chip shows only its glyph (or ‹), 88 wide. Tabs show a 48 px icon plus a short label at Row title size; done/total counts move to the top-screen plaque. |
| Body | y 120-928 (808): stacked rows and buttons are 128 visual on a 134 pitch, **6 per page** |
| Foot row | y 936-1072: buttons 548x128 visual with a 136 hit area; the Inspect / Options chips (176 wide); page dots with their [LT]/[RT] glyphs at the foot row's right end (180 wide) |

**Text sizes** (px):

| Use | Font | Wide (1080 tall) | Thor bottom (x1.15) |
|---|---|---|---|
| Logo lockup | Cinzel 700 | 120 | — |
| Hero name | Cinzel 700 | 64 | — |
| Screen title | Cinzel 700 | 56 | 56 |
| Section heading | Cinzel 600 | 40 | 44 |
| Row title | Inter 600 | 34 | 38 |
| Body | Inter 400/500 | 30 | 34 |
| Caption (the floor; numbers and labels only) | Inter 500 | 24 | 28 |

- Numbers use Inter tabular figures.
- Thor bottom is about 420 ppi against about 367 on the top, so x1.15 makes text read at the same physical size on both screens.
- **Base text multiplier** = max(1, 12 dp ÷ 24 px at the device's physical ppi), applied to Caption, Body and Row title before Text size. On a 6.7" 2400x1080 phone (~393 ppi) it is about 1.23, which keeps the caption at 12 dp. It is 1 on Thor, Portal and PC.
- **Text size** (Access) then multiplies Caption, Body and Row title by 1.00, 1.15 or 1.30. Pages re-paginate (fewer items per page) so items stay whole; nothing is ever cut off.
- Contrast on glass is at least 4.5:1: primary `#F3EEE3`, secondary `#B9B2A4`.

**Touch targets:**
- Every focusable control has a hit area at least 120 px tall on wide canvases (about 8 mm on a 6-7" 1080p screen). On Thor bottom: 134 for body rows and stacked buttons (the pitch), 136 for foot buttons and strip chips.
- Hit areas extend invisibly into adjacent gaps to reach the minimum. Where they cannot, the visual height is raised. Header chips and tabs stay 72 visually but get 120 hit areas (bands above). Chips at a screen edge extend their hit area to that edge.
- List rows are 112 visual on a 120 pitch, giving **6 rows per page** on every wide screen with tabs. Thor bottom rows are 128 on a 134 pitch, also 6 per page.
- The one exception is Pause stat rows (56 px). They are read rows, and a mis-tap only expands an explanation.

### 3.7 Safe areas

- **Phone:** side margin = max(72, cutout or gesture inset + 24). The 3D world bleeds under the cutout; focusable items never sit there. Display > Edge padding adds 0-64 px for curved edges.
- **Portal and Thor:** a flat 48 px margin.
- **PC:** a centred 16:9 safe frame with the world bleeding past it. Wider windows follow the phone rules. Windows narrower than 16:10 scale the frame down and letterbox it with the scene.

### 3.8 Reflow

| Case | Rule |
|---|---|
| Aspect 16:9 or wider (phone 2400x1080) | Canvas 1080 tall. Sizes carry over 1:1. The extra width (about 432 px on 20:9) goes to each screen's **flex region**, named per screen. |
| Aspect 16:10 up to 16:9 (16:10 tablets, 2560x1600) | Canvas 1920 wide. The extra height (up to 120 px) goes to the body: more rows per page where a whole row fits, otherwise panels are vertically centred with the scene behind. |
| Any single screen narrower than 16:10 (Retroid Mini/Classic 1240x1080, 4:3 handhelds and tablets, foldable inner screen about 6:5, any window narrower than 1:1 on a 600 dp+ display) | **Stacked layout.** The top 42% holds that screen's Thor-top content, scaled to fit. The bottom 58% holds its Thor-bottom content, scaled to full width. Everything is touchable. |
| Foldable outer screen | By its aspect, as above |
| Foldable tabletop (HALF_OPENED, horizontal hinge) | The same split, aligned to `FoldingFeature.bounds`. Controls stay on the lower half. |
| Fold or unfold | Relayout in place with a 200 ms fade. A run keeps going. |
| Retroid Pocket Duo bottom (4:3) | Columns stretch to the width, with no side bars (2.1) |

### 3.9 Thor rules

- **The top screen is for looking and the bottom is for doing.** Every focusable or tappable control is on the bottom, because touch on the top screen is unconfirmed. If top touch is confirmed later, top items become tappable with no layout change.
- Nothing appears on both screens.
- Heavy motion runs on the 120 Hz top. The bottom never renders 3D in menus and redraws only when something on it changes.
- **Rendering:** the bottom screen has its own render thread and its own EGLContext, created with the top context as `share_context`, so textures and atlases are shared. It swaps only when its display list is dirty. Its refresh comes from `Display.getRefreshRate()` and is never assumed to be 60 Hz (the Retroid Pocket Duo bottom is 120 Hz). The top never waits on the bottom's vsync.
- **Inspect views and read-only sheets:** every [Y] inspect view and every sheet of read-only content (duelist sheet, map / difficulty / Oath sheets, quest sheet, card pages, Stat sources, Button map and test, art zoom) opens full-screen on the **top**. The bottom keeps its layout with the ring parked (trapped), and the foot shows only "[B] Close". [RS], the d-pad, or a finger dragging on the bottom scroll the top view.
- **Choice sheets and cards** (Refund, Replace pin, Select quick menus, the disconnect card, battery-saver card, cloud-save card, Abandon-run / Restart / End-run confirms, Reset progress, Collect earnings) open on the **bottom**, centred in the body, and the top dims to 55%.
- **Toasts** show on the top at top centre.
- **Title card:** the camp on the top; the "Press any button or tap" mark plus the emblem on the bottom.
- **Credits** roll on the top, with a [B] chip on the bottom.
- [Select] never swaps screens; that stays with AYN's own panel.
- **Dual screen Off:** the top runs the Portal layout. The Presentation is dismissed and the bottom panel is left to the system. No mark (a static mark would burn in on AMOLED, and apps cannot reliably dim a Presentation display).
- **Hand-off with the card app:** the card app already owns the bottom display (DualScreen.kt Presentation). AdventureActivity dismisses the card app's Presentation on start and restores it on return. Display > Dual screen reads and writes the card app's existing `play/dual-screen` preference: one switch for both.
- If a display is swapped or removed, the layouts re-attach through `DisplayListener` within 500 ms, holding the last frame on screen meanwhile (Presentation and EGLSurface creation take several frames).

### 3.10 Visual tokens and components

**Tokens:**

| Token | Value |
|---|---|
| Background | `#0a0c11` |
| Glass | rgba(255,255,255,0.06) over a 55% black scrim, 24 px blur of the world, 1 px edge rgba(255,255,255,0.16), gold hairline `#E8C46E` at 40% along the top edge, radius 24, padding 24 |
| Gold | `#E8C46E` (highlight `#F6DC9A`). Used only for earned things and primary actions. |
| Danger | `#E06A5A`. Only for actions that lose something. |
| Gain | `#7FD69A` |
| Rarity | Plain `#9AA3AE`, Bright `#6FC3FF`, Gilded `#E8B95B`, Radiant `#C08BFF`, Mythic `#FF7A3A`. Each also has a corner gem shape (none, dot, diamond, star, crown), so colour is never the only tell. |
| Difficulty | Easy `#7FD39A`, Medium `#F0A050`, Hard `#E06A5A` |
| Fonts | Cinzel for headings, Inter for body (as in the template files) |

**Buttons, exactly four kinds:**
- **Gold:** filled, at most one per screen, carries the [X] glyph.
- **Ghost:** glass with a gold hairline.
- **Danger:** ghost with danger text.
- **Link:** text plus a glyph.

**Rows:**
- **Segmented plate** (choice rows with 2-4 choices): every choice is visible, the active one is pressed gold, and left/right moves between them.
- **Value plate** (5 or more choices): the value on a card-shaped plate with a thin segmented gold underline, one segment per choice; left/right steps.
- **Slider:** a 20-step track with its value as text at the right end of the track (Inter 30, tabular), no separate box.
- **Switch:** an On/Off pill with text, never colour alone.
- **Action row** with a chevron.

**Other components:**
- **Hold to confirm** (only for actions that end a run or wipe data): a gold arc fills around the button. Abandon, Restart, End run and Reset controls take 1.0 s; Reset progress takes 2.0 s. Releasing early cancels. Access > Hold to confirm = Press twice replaces holds with two presses within 1.5 s.
- **Denied:** pressing a disabled action plays the dull tap, does a 6 px shake and shows a one-line reason under it for 2 s ("Need 30 more Star Chips"). Never a silent failure.
- **Locked:** the card back with the entry's outline **etched in thin gold line** at 40% (no filled black shape), plus the unlock condition in plain words and a live bar. Locked things are never hidden. The one exception: an Oath with no sim hook yet is hidden, and quests tied to a hidden Oath are hidden with it.
- **Marks:** done = 32 px wax check; Almost / Fusion-ready = 24 px gold corner tab plus label; only the ring draws a gold outline.

**States:**

| State | Shows |
|---|---|
| Loading | A gold ring spinner on the panel itself |
| Empty | One line saying what fills it |
| Error | One line plus a "Try again" link |
| Offline | Boards read "Offline: local bests" |

**Menu world:**
- A live scene of about 40k triangles with no horde.
- In menus the 3D world renders into an offscreen texture at 30 Hz, and the UI layer composites every display frame (60 Hz in Balanced, the panel rate in Performance), so the ring glide stays smooth. The glass blur samples the world texture at 1/4 resolution (dual-Kawase), once per world frame.
- In the Battery profile, or at thermal SEVERE, the world texture is rendered once and frozen.

---

## 4. Main menu

**Purpose:** start a run in one press, and make the next goal, the next rival and the next purchase impossible to miss.

### 4.1 Wide layout (Portal, PC, phone)

| Region | Rect | Contents |
|---|---|---|
| Scene | Full bleed | **The Camp:** a plinth on a cliff over the Buried Kingdom. The last duelist idles in their outfit and Regalia at about x760-1000, with their starting monster circling. Around them: a statue for every Fusion found, a banner for every Oath kept, a lit brazier for every duelist at Mastery 10. The Camp is a **real-time 3D scene** (see 4.1a), not a picture. The camera drifts slowly (under 2 degrees). |
| Logo | x48-788, y48-268 | DUEL SUMMONER (Cinzel 120). Tagline in Inter 30: "Summon. Survive. Fuse." |
| Verbs | x48-640, y320-808 | **PLAY**: gold 592x128 with the [X] glyph and a sub-line, e.g. "Kael · Mastery 4 · 312 kills to Cinder Coat". Then **DECK BOX**, **CARD LIBRARY**, **QUESTS**: ghost 592x104, 16 px gaps (hit areas extend into the gaps to 120). Each has a right-hand badge: "2 affordable", "3 new", or "2 done" in gold. |
| Resume | Above PLAY when a suspended run exists | **RESUME RUN**: gold 592x128 with the sub-line "Surface Ruins · Stage 2 · 4:12". PLAY becomes ghost and the column starts at y296. |
| Board stone | In the scene, x1040-1240, y640-920 | A **standing stone** right of the duelist, focusable, carved with the last map's board for the last-played difficulty and a gold **rival line**: "4,120 to pass Hiro for #17", plus your rank and the countdown to **Monday 00:00 UTC** in one caption line. Signed out it reads "Sign in in the card app to post runs". [A] opens the Leaderboard (4.4). |
| Star Chips | x1632-1872, y48-120 | Count plus the player's 72 px avatar |
| Next goals | x1280-1872, y168-888 | Header "Next goals" (48), then 5 rows of 592x120 on a 124 pitch: icon 64, goal text, bar plus "9,140 / 12,000", and the reward chip (Star Chip icon plus amount, or the reward's icon). Pinned quests come first, then the closest to done. A goal at 90% or more gets the gold corner tab and the label "Almost". |
| Utility chips | x1280-1872, y960-1032 | "[B] Adventures" (224x72) and "[Start] Settings" (224x72). On touch they show the ‹ and gear icons. On the web dev build the Adventures chip is hidden. |

- **Phone flex:** the scene gap between the verbs and the Next goals panel, so the duelist and the stone get more room.

### 4.1a The live scene (owner decision, applies to the Camp, Duelist select and Map select)

Menu backgrounds are the live in-engine game world, not a painted picture. The same rules cover the Camp (4.1), the Duelist select plinth (5.1) and the Map select vista (5.2).

- **Built from the game's own pieces:** the generator kit parts, the scenery and landmark meshes, the sky dome and lighting of the chosen map and difficulty, the real duelist model on its idle clip, the starting monster circling, and braziers with the game's own fire effect. Map select shows the selected map's actual generated terrain (one fixed showcase seed per map) under that difficulty's sky.
- **View only:** no sim runs behind the menu, no enemies, no pathing.
- **Budget (measured and reported with ?dev=1):** at most 120 draw calls and 150,000 triangles for a menu scene, static geometry merged, at most 200 particles, 60 fps on the phone profile and 120 where the screen allows.
- **Covered or hidden:** when a full-screen panel covers the scene (Settings, Card Library, Quests) render it at a quarter rate or freeze it blurred. Stop rendering when the app is in the background.
- **Camera:** slow idle drift only (under 2 degrees), no cuts when changing screens. One camera glides between the Camp, the duelist plinth and the map vista.
- **Art:** until the owner's art lands, use the current stand-in models and kit pieces. Every Camp prop gets an entry in the asset tool (`design/art-book/asset-tool.html`) so the owner can make the real ones.

### 4.2 Thor

- **Top (look only):** the Camp full bleed with the duelist and the board stone carrying the rival line; logo at top left, Star Chips and avatar at top right. No board list (it lives on the Leaderboard screen) and no nudge plaque.
- **Bottom:**
  - Top strip: "[B] Adventures" on the left, "[Start] Settings" on the right.
  - Left column, 128 visual on a 134 pitch: (RESUME RUN), PLAY, DECK BOX, CARD LIBRARY, QUESTS, then **Leaderboard**. Six buttons with RESUME RUN fill 804 of the 808 body.
  - Right column: Next goals header (48), then 5 rows of 548x128 on a 134 pitch.

### 4.3 Focus, buttons, touch, motion

- **Opens on** RESUME RUN if one exists, otherwise PLAY.
- **Order:**
  - Down the verbs.
  - Right from PLAY, DECK BOX or CARD LIBRARY goes to the Next-goals row at the same height. Right from QUESTS (the lowest verb) lands on the stone; right from the stone goes to the goal row at the same height. Left from the goals goes to the stone, and left from the stone to the verbs.
  - Down from the last goal goes to the utility chips.
  - Thor: right from the verbs goes to the goals; down from the last verb goes to Leaderboard.

| Button | Action |
|---|---|
| [A] | Press. Goal row: open Quests on that quest. Stone (Thor: Leaderboard button): full Leaderboard (4.4). |
| [B] | Leave to Adventures at once. The save is continuous, so there is no confirm. Web build: nothing (2.8). |
| [X] | PLAY. With a suspended run, [X] = RESUME RUN. PLAY with a suspended run opens a sheet: "Abandon the saved run? It ends and pays what it earned." **Hold [X] Abandon** (1.0 s, or press twice per Access), ghost "[B] Cancel". |
| [Y] | Goal row: the quest sheet. Stone (Thor: Leaderboard button): the run card of the run you rank against (the rival); on Thor it opens on the top. |
| [Start] | Settings |
| [Select] | Goal row: "Unpin / Open in Quests". Stone: "Watch rival's replay / View rival's profile". |

- **Touch:** tap anything. Long-press a goal row or the stone for its quick menu.
- **Motion:**
  - First show of a session: the camera drops onto the plinth over 1.6 s (skippable with any input) while the logo fades in. The verbs rise in a 40 ms stagger, and PLAY breathes a gold glow (2.4 s loop, off with Reduce motion).
  - The duelist plays `select_fidget` every 8-12 s.
  - A statue or banner earned in the last run gets one slow camera push (1.2 s, interruptible) on the next visit.

### 4.4 Leaderboard (full screen)

- **Wide layout:**
  - Tabs: **Easy · Medium · Hard** ([LB]/[RB] at the ends), opening on the last-played difficulty.
  - The first focus row (120) is a segmented row: Weekly / All-time, map (once there are several), Full run / Quick duel. A Friends choice appears only once the server supports it; until then it is hidden, never inert.
  - List, span 8 (x48-1256): 5 rows of 112 on a 120 pitch (rank, avatar 72, name, duelist icon, Oath seals, score, time) and the page dots. The 5th row is reserved for your own row whenever it is off the page. 120 + 600 + 48 = 768.
  - Run card, span 4 (x1280-1872): duelist and outfit, difficulty, Oaths, the 4 Monster Zones and 4 Spell/Trap Zones, Fusions made, cause of end, and "Verified" or "Being checked".
- **Buttons:**

| Button | Action |
|---|---|
| [A] | Row: the run card full screen (same as [Y]; on Thor, on the top) |
| [X] | **Watch replay** of the focused run. Verified runs only; otherwise the reason "Being checked". |
| [Y] | Run card full screen |
| [LB]/[RB] | Easy / Medium / Hard, matching the stone on the main menu |
| [LT]/[RT] | Page |
| [Select] | "Jump to my rank / View profile" |
| [B] | Back |

- **Thor:** top = the run card of the focused row, large; [A] or [Y] on a row shows that run's card full-screen on the top with no ring move (bottom foot "[B] Close"). Bottom = the tabs, the segmented row (134), 5 list rows on a 134 pitch (804) and the "[X] Watch replay" foot.

---

## 5. Duelist select, Map select, Oaths, run start

### 5.1 Duelist select

**Purpose:** pick who to play, see how close the next mastery reward is, dress them, and go on.

**Wide layout:**

| Region | Rect | Contents |
|---|---|---|
| Header | — | [B] chip, "Choose a Duelist", Star Chips |
| Portrait grid | x48-640, y168-1032 | Header "Duelists 2/4". 5 columns of 112x168 tiles (portrait plus name), 3 rows, 15 per page, page dots. Mastery 10 = the tile's frame turns gilded with a crown gem in the top-left corner (the Mythic gem shape); there is no star mark. Corner marks also: a pin for favourites, a dot for new. Locked = etched outline and "???". |
| Stage (flex) | x664-1256 plus the scene | The **live duelist** at showcase scale, feet at about y900, with a "Turn" chip under the feet. Below the chip (y952-1032, centred): "Runs 23 · Kills 18,402 · Longest 14:32" in caption. No text over the model. |
| Details | x1280-1872, y168-1032 | In order: **Starting monster** card (136: art 120, name, one-line effect) · **Passive** (112) · name (Cinzel 64) and title (104) · **Mastery** (96): "Mastery 4", a bar, "1,200 to Mastery 5 · about 2 runs" (from this duelist's average per run) · **Look row** (136): Outfit tiles of 124x120 with [LB]/[RB] at the row's ends, a hairline, then the Regalia tile · condition line with the Inspect link and Options chip right-aligned (56) · gold **"[X] Choose Kael"** (592x112). 752 + 48 padding + 6 gaps of 10 = 860 ≤ 864. |

- The flavour line is not on the wide panel; it lives on the Thor-top plaque and in the [Y] duelist sheet.
- **Locked duelist:** the model shows as an etched gold-line ghost with a slow lock aura. The details show the condition with a live bar ("Clear any stage on Hard · best: Stage 1 boss"). The gold button becomes a disabled "Locked" plaque, and pressing it gives the reason.
- **Locked outfit:** focusing it fills the condition line ("Fell 12,000 foes as Kael · 9,140 / 12,000"). No tooltip.

**Thor:**
- **Top (look only):** the duelist large at x300-1100, alone, with no outfit chips. A plaque at x1280-1872 holds the name (64), title, mastery bar with "about N runs", runs, kills and longest run, the flavour line, the **next mastery reward** ("Mastery 5: Ashen Mantle") and the "Duelists 2/4" count.
- **Bottom:**
  - Left: the grid, 5x3 tiles of 100x160.
  - Right: Starting monster (548x128), Passive (548x128), Look row (4 tiles of 125x136: outfits, hairline, Regalia), condition line.
  - Foot: "[X] Choose Kael" (548x128), then "[Y] Inspect" and "⋯ Options".
  - Outfits live only on the bottom Look row.

**Focus:**
- Opens on the last-played duelist.
- Right from the grid lands on Starting monster. Down: Passive, Look row, gold button. Left from any of them returns to the grid row at the same height.
- Moving the ring on the grid **selects** that duelist, and the model swaps after a 150 ms dwell, so fast scrolling does not churn models.

| Button | Action |
|---|---|
| [A] | Portrait: Choose (same as [X]). Outfit: wear it (the model swaps live). Regalia: open the Regalia sheet. |
| [B] | Main menu |
| [X] | **Choose:** go to Map select |
| [Y] | Portrait: the duelist sheet (flavour line; mastery track 1-10 with every reward, earned ones in gold; records). Monster or Passive: its card page. Outfit: full-screen model view. On Thor all open on the top. |
| [LB]/[RB] | Previous / next owned outfit, from anywhere |
| [LT]/[RT] | Grid page |
| [RS] / [R3] | Turn the model / reset |
| [Select] | Portrait: "Favourite / Random duelist" |

- **Regalia sheet:** slides over the details panel (on Thor, over the bottom right column). It is a grid of pieces; locked pieces show their condition when focused. [A] wears a piece and the model updates live. [B] closes.
- **Touch:** tap a portrait to select it, tap again to choose. Drag the model to turn it. Tap an outfit to wear it.
- **Motion:** the old duelist fades to embers and the new one rises from a card sigil (240 ms), then plays `taunt` once. An outfit swap is a 200 ms gold shimmer. Mastery bars fill from 0 over 400 ms the first time in a session.

### 5.2 Map select, with the Oaths inline

**Purpose:** choose where, how long, how hard and which Oaths, see exactly what the run pays, and begin.

**Wide layout:**

| Region | Rect | Contents |
|---|---|---|
| Header | — | [B] chip, "Choose the Field", Star Chips |
| Map list | x48-640, y168-576 | Maps as **card faces** in a row of up to 3 (184x260 each, 20 px gaps: full-bleed art, name in Cinzel 34 on a gold bar at the foot). The focused map's blurb shows in the 2 lines below the row (64). Paged after 3. Locked maps show the etched outline, "???" and the condition. |
| **Oaths** | x48-640, y592-1032 | Header (48): "Oaths · 2 sworn · +30% score". Seal grid 4x2 of 136x124 tiles with an 8 gap: our wax sigil, name, "+20%". Unsworn = outline. **Sworn** = the seal turns solid gold with a raised rim, no check shape. **Kept before** = the standard 32 px wax check badge at the top right. Rule line (2 lines of 28): the focused Oath's rule and its reward ("Your LP is 1 and can't be raised. Keep it: 60 Star Chips."), with the **Inspect** link and **⋯ Options** chip right-aligned on it (Options only while the ring is on a seal). 48 + 48 + 256 + 56 + gaps = 432 ≤ 440. |
| Stage (flex) | x664-1256 | The world of the chosen map, with that difficulty's sky. The duelist stands in it at play scale (about 13% of screen height). |
| Run panel | x1280-1872 | Map name (Cinzel 56) · **Length** segmented plate: `Full run · 3 stages | Quick duel · 1 stage` (120) · **Difficulty** block with the header "[LB] Difficulty [RB]" (48), then 3 rows of 592x112 on a 120 pitch in their colours: line 1 name plus 24 px portraits of the duelists who cleared it (with the cleared seal), line 2 caption "Star Chips ×1.25 · Score ×1.0 · Best 48,210 · Fastest clear 22:41" · **Pays line** (80), live: "This run: Star Chips ×1.25 · Score ×1.3", with the sub-line "Medium ×1.0 + Oaths +30%" · gold **[X] Begin** (592x112) |

- Difficulty factors: Star Chips ×1.0 / ×1.25 / ×1.5 for Easy / Medium / Hard.

**The world previews every choice:**
- A map change swaps the biome through a dusk tint (280 ms).
- Difficulty sky (250 ms): **Easy** clear morning, **Medium** amber dusk with low fog, **Hard** eclipse (black sun, gold corona, drifting embers).
- Each sworn Oath adds a sign in the world, fading in over 300 ms:

| Oath | Sign |
|---|---|
| Glass | A cracked glass sheen on the duelist |
| Hasty | Wind streaks |
| Still | Chains at the feet |
| Blind | Fog rolls in |
| Pauper | Coins turn to dull lead |
| Swift | An hourglass sigil in the sky |
| Peace | The duelist's cards dim for a beat |

**Rules:**
- **Quick duel:** the seals grey out with the line "Oaths are sworn for full runs".
- An Oath with no sim hook yet (Small) is not shown until it works, and quests tied to it are hidden with it.

**Thor:**
- **Top (look only):** the world full bleed. A plaque at top centre (x480-1440, y48-360) holds the map name (64) and blurb, the difficulty name in its colour, Best score and Fastest clear for the focused difficulty, the **live Pays line** ("This run: Star Chips ×1.5 · Score ×1.8 · Hard ×1.8 + Oaths +30%"), and the focused Oath's rule line (it is look-only text). Sworn state shows only on the bottom seal grid.
- **Bottom:**
  - Left: map card faces (3 of 172x246), the Length plate (134), the Oaths header (48) and the seal grid (4x2 tiles of 125x136, 8 gap).
  - Right: the Difficulty block, header "[LB] Difficulty [RB]" (48), then 3 rows of 548x240 (name, multipliers, cleared portraits at 32 px).
  - Foot: "[X] Begin" (548x128), "[Y] Inspect", "⋯ Options" (seals only).

**Focus:**
- Opens on the last map if more than one is unlocked, otherwise on the last difficulty row.
- Wide: left/right moves along the map row; right from the last map goes to the run panel. Down from the map row goes to the seal grid. The run panel runs Length, then difficulty, then Begin. Left from a difficulty row or Begin jumps to the nearest item in the left column.
- **On the Length plate, left/right step the value.** The ring leaves it with up/down only.
- Thor: the left column runs maps, Length, seals; right from the left column goes to the nearest difficulty row; Begin is in the foot.

| Button | Action |
|---|---|
| [A] | Select a map or difficulty. On a seal: swear or release that Oath. |
| [B] | Duelist select. All choices are kept. |
| [X] | **Begin** |
| [Y] | Map: the map sheet (stages, bosses met, objects found %, times run, records). Difficulty: exact rules (enemy health curve, spawn rate, multipliers). Seal: the Oath sheet (rule, quest, times kept, best kept score). On Thor all open on the top. |
| [LB]/[RB] | Difficulty down / up, from anywhere, so the sky change is one press away |
| [LT]/[RT] | Map list page |
| [Select] | On the Oaths: "Release all Oaths" |

- **Touch:** tap everything; tap a segment of the Length plate (2.7).
- **Swearing:** the seal presses in 120 ms and settles in 80 ms, with the wax sound and a 45 ms rumble. The Pays line ticks up over 200 ms. Releasing plays the same in reverse, quieter.
- **Saved:** last map, Length, difficulty and sworn Oaths. Today these live only in memory (`menus.js:23-24`).

### 5.3 Run start

1. **[X] Begin.** The panels slide to their edges (200 ms). The camera pushes toward the duelist (600 ms) as they play `summon` over a flaring card sigil.
2. **Load card.** The screen closes to a dark card with a gold seal turning in the centre. It shows:
   - The map name (Cinzel 56) and "Stage 1 of 3".
   - The difficulty in its colour and the sworn seals.
   - "Seed 48213", one hint (if Hints is on), and a progress ring driven by stage generation.
   - Stage generation runs in a **second QuickJS runtime on a background thread** (a Web Worker on the web). It posts progress 0-1 to the UI runtime, which animates the ring.
   - It stays at least 600 ms, longer only if generation needs it. Input is ignored.
3. **Arrival, 2.0 s.**
   - A card **falls face-down** from the sky onto a burning sigil, flips face-up flat on the ground, and the duelist **rises out of it** in a column of gold motes, landing with `land_heavy`. No upright doorway shape at any point.
   - The camera sweeps from 6 m overhead to the play position. The HUD fades in over the last 400 ms.
   - No enemy spawns and **sim tick 0 does not start** until control is handed over, so the boards and replays never count the intro.
4. **Skip.**
   - Moving the stick from 1.2 s on hands over control at once.
   - From the second run on, any press skips straight to control.
   - The first run ever plays in full.
5. **Boss name card** in a run: [A], [B] or a tap skips it, with no prompt drawn (replaces "Enter or a click", `main.js:245`).
6. **Thor bottom:** during the load card the board draws in: 4 Monster Zones, 4 Spell/Trap Zones and the map outline inking in under fog. The starting monster's card flips into Zone 1 as the duelist lands on top.
7. **Restart from Pause** goes straight to the load card (new seed, same setup); its rewards are queued (10.6).

---

## 6. Card Library

**Purpose:** see everything owned and everything still locked, control the offer pool, and set the next unlock as a goal.

**Wide layout:**

| Region | Rect | Contents |
|---|---|---|
| Header | — | [B] chip, "Card Library 61/140", Star Chips |
| Tabs | y160-232 | **Duelists · Monsters · Spells/Traps · Items · Regalia**, each with done/total |
| Grid (flex) | x48-1102 (span 7), y264-1032 | 6 columns of 162x216 card tiles, 3 rows = **18 per page**, page dots. A gold dot marks new entries. Out of the offer pool = desaturated with a slash mark. Locked = card back with the etched outline. In Monsters the tiers run Monster, Fusion, God Fusion, Secret Fusion, each with a small tier label. Unfound Secret Fusions stay card backs reading "Waiting to be found". |
| Details | x1126-1872 (span 5), y264-1032 | **Art 200x280** at the left (monsters: a 3D turntable), with name (Cinzel 40), element and tier chips, and for monsters the 3 form thumbs (levels 1 / 5 / 10) stacked to its right; known Fusions ("Ember Wyvern + ??? → ???") under the forms. Below, full width: effect (3 lines, 120) · "Key numbers" chips (48) · "Seen in 14 runs · Best level 10" (32) · Inspect link and Options chip (48) · gold button (112). 48 + 280 + 120 + 48 + 32 + 48 + 112 + 5 gaps of 16 = 768. Locked: the condition and a live bar in place of the effect, and the gold button "[X] Track goal". |

**Gold button by state:**

| State | Label |
|---|---|
| Unlocked card or item | "In offers: On" / "In offers: Off" (switch) |
| Locked anything | "Track goal" (pins its quest to Next goals) |
| Unlocked Regalia | "Wear on <last duelist>" |
| Unlocked duelist | No gold button |

- **Pool rule:** at least 6 entries stay in offers per tab. Trying to go below shows "Keep at least 6 in offers" with the dull tap.
- **Phone flex:** the grid grows to 8 columns (24 per page).
- **Thor:**
  - **Top (look only):** the focused entry, large. Left half: the turntable (900x600) or the art. Right half: name (64), chips, forms, Fusions, effect, key numbers, condition and bar, run stats, and the tab's done/total count.
  - **Bottom:** Back chip and the 5 tabs (icon plus short label); grid of 6 columns of 177x240, 3 rows (18 per page); page dots in the foot. Foot: the gold button, "[Y] Inspect" and "⋯ Options".
  - **Entry page on Thor:** the top shows the turntable and lore. The bottom shows the 3 form tabs, the Fusion parents and children as a tappable list, and a [B] Close chip. The ring is trapped there.

**Focus:**
- Opens on the first new entry in the remembered tab, otherwise the first entry.
- Right from the grid's right column goes to the gold button. Left returns.

| Button | Action |
|---|---|
| [A] | Open the **entry page**: a full-screen viewer (Thor: as above). Turntable, [LB]/[RB] through the 3 forms, Fusion parents and children, full stats, lore. [RS] turns, pinch zooms, [B] closes. |
| [B] | Main menu |
| [X] | The gold button above |
| [Y] | Press to open the art or model zoom (on Thor, on the top screen). [Y], [B] or a tap closes it. No hold. |
| [LB]/[RB] | Tabs |
| [LT]/[RT] | Page |
| [Select] | "Track goal / Show related quests / Sort: Number, Element, Found first" |

- **Touch:** tap to select, tap again to open. Swipe to page. Long-press for Options.
- **Reveal:** the first time a new entry is focused, it flips from back to face (300 ms, rising chime) and the dot clears.

---

## 7. Quests

**Purpose:** show the next goals first, show what each one pays, and pin the ones being chased.

**Tabs: 6 instead of the reference's 8.** The last tab is at most 5 presses away, and tabs wrap.

| Tab | Covers |
|---|---|
| **Next** (default) | The 12 open quests closest to done, from every tab |
| **Duelists** | Duelist unlocks and Mastery |
| **Cards** | Monsters, Spells/Traps and Items |
| **Runs** | General goals |
| **Oaths** | |
| **Regalia** | |

Data change: `QUEST_TABS` drops to 6, and each quest's `tab` is re-tagged through a mapping table. Quests tied to a hidden Oath are hidden with it.

**Wide layout:**

| Region | Rect | Contents |
|---|---|---|
| Header | — | [B] chip, "Quests 18/44" (live done/total from data; the sample numbers are illustrative only), Star Chips |
| Tabs | y160-232 | 6 tabs with done/total |
| List (flex) | x48-1256 (span 8), y264-1032 | 6 rows of 1208x112, page dots. Row: rarity edge (8 px bar plus corner gem), icon 80, goal text, bar with "4,300 / 7,500", reward chip on the right (Star Chip icon plus amount, or the reward's icon), pin mark. Open quests sorted by % done. **Done quests are dimmed with the wax check and sink to the end**, with no toggle. Quests that cannot be earned yet read "Opens after: Clear Stage 2" in place of a bar. A quest finished since the last visit carries a gold "New" until focused. |
| Details | x1280-1872 (span 4) | The **reward, large** (card art, a chip pile with the amount, or the outfit on a mini model) · goal (Cinzel 40) and rarity · big bar · where to make progress (one line) · related Library entry · state ("Pinned · 3 of 4 pins") · gold **[X] Pin / Unpin** |

- **There is no claim button.** Rewards are granted and celebrated in the reward sequence (10.6).
- **Phone flex:** the list rows widen and the reward chips gain their names.
- **Thor:**
  - **Top (look only):** the reward large (the model turns with [RS]), goal, rarity, bar, related entry, and the "Quests 18/44" count.
  - **Bottom:** Back chip and the 6 tabs (icon plus short label); rows of 1144x128 on a 134 pitch, 6 per page. Foot: [X] Pin and "⋯ Options".

**Focus:** opens on the top row of Next, or on the quest you came for from a Next-goals row.

| Button | Action |
|---|---|
| [A] or [Y] | The quest sheet: reward large, hint, related entry (on Thor, on the top) |
| [X] | **Pin / Unpin.** At most 5 pins (the tracker holds 5). A 6th opens a small sheet: "Replace which pin?" (on Thor, on the bottom) |
| [LB]/[RB] | Tabs |
| [LT]/[RT] | Page |
| [Select] | "Pin / Open reward in the Card Library" |
| [B] | Main menu |

- **Touch:** tap a row to select it, tap again for the sheet, long-press for Options.
- **Motion:** a bar shimmers once when its quest is within 10% of done.

---

## 8. Deck Box (buy and refund)

**Purpose:** spend Star Chips on permanent upgrades with a clear before and after, and no fear, because every rank refunds in full.

**Wide layout:**

| Region | Rect | Contents |
|---|---|---|
| Header | — | [B] chip, "Deck Box". The Star Chips number is enlarged here (Cinzel 40). |
| Grid | x48-1102 (span 7), y168-1032 | 4x3 tiles of 248x240 for the **12 upgrades**. Each tile: icon 120, short name, rank pips (count = that upgrade's ranks, from data), and a cost badge (chip icon plus next price) that turns gold when affordable, or a "MAX" plaque. Upgrades gated by a quest show the etched outline with their quest. Data-driven: new upgrades add tiles, and pages begin after 12. |
| Details (flex) | x1126-1872 (span 5) | Icon 200, name (Cinzel 48), "Rank 2 of 5" with large pips · effect, one line ("+5 Max LP per rank") · **Now → Next**, large: "Max LP 110 → 115" in gain green · gold **"[X] Buy rank 3 · 70"** (698x112); when unaffordable it shows disabled with the reason "Need 22 more" · ghost **"⧉ Refund…"** (698x96 visual, 120 hit), hidden at rank 0 · foot line: "[Y] Rank table" link, then "Invested 1,240 · Refunds return the full price." |

**Refund sheet** ([Select]):
- "Refund one rank (+40)", "Refund this upgrade (+130)", "Refund everything (+1,240)".
- [A] confirms, [B] cancels. On Thor it opens on the bottom, centred, with the top dimmed.
- No holds and no Danger styling, because nothing is lost: any refund can be bought back.

**Thor:**
- **Top (look only):** the focused upgrade, large: icon 320, name, pips, Now → Next at 56, cost, the invested total, and the **rank table always shown** (every rank, its price, its total effect, and the in-run numbers it moves). [Y] is therefore not used on Thor and has no chip.
- **Bottom:** the 4x3 grid of 274x208 tiles. Foot: "[X] Buy" (gold, 548x128) and ghost "⧉ Refund…" (548x128).

**Focus:** opens on the cheapest affordable upgrade, otherwise the first tile.

| Button | Action |
|---|---|
| [A] | On a tile: select it and fill the details (no purchase) |
| [X] | **Buy** the next rank of the focused upgrade |
| [Y] | Rank table: every rank, its price, its total effect, and the in-run numbers it moves (wide only) |
| [Select] | Refund sheet |
| [B] | Main menu |
| [LB]/[RB], [LT]/[RT] | Not used (LT/RT page only after 12 upgrades) |

- **Touch:** tapping a tile selects it, and a second tap does nothing more; buying is always [X] / the gold button (the 2.7 exception).
- **Buy motion:** the chip count ticks down (300 ms) and a chip flies into the tile (250 ms). The pip stamps gold with the clink and a 25 ms rumble, and Now → Next rolls to the new values.
- **Refund motion:** the pips drain right to left (250 ms) while the chips count up, with the reverse clink.
- **Data:** the upgrade "Banishes" is renamed **"Exiles"** (step 14).

---

## 9. Settings

**Purpose:** a small set of options suited to an app. Every row works with the d-pad and with taps (no row needs a drag), and changes apply live.

**Wide layout:**
- Header: [B] chip, "Settings".
- Tabs: **Game · Display · Controls · Sound · Access · Account**.
- **Rows**, x48-1102 (span 7), y264-1032: 1054x112 on a 120 pitch, **6 slots per page**, page dots. The label is on the left and the control sits in a 440 px box on the right. Section headers take one slot. A section starts a new page when fewer than 2 of its rows would fit.
- **Help panel**, x1126-1872 (span 5): row name (Cinzel 40), up to 3 lines of explanation, "Default: Balanced", and a **live preview** box 698x392. Each kind of row previews differently:

| Row | Preview |
|---|---|
| FOV and camera rows | Move the world camera (from Pause, the frozen run is the preview) |
| Text size | A sample |
| Glyph rows | The pad drawing |
| Touch size | A ghost HUD |
| Vibration | Pulses once on change (also the motor test, 2.4) |
| Sound rows | A sample sound |

- **Thor:** top = the help panel and the large preview. Bottom = Back, the 6 tabs (icon plus short label), rows of 1144x128 on a 134 pitch, 6 per page.
- **Phone flex:** rows widen.

| Button | Action |
|---|---|
| Up / down | Rows |
| Left / right | Change the value. Sliders step; holding accelerates after 400 ms. |
| [A] | Flip a switch, move a choice row to its next choice, or run an action row |
| [LB]/[RB] | Tabs |
| [LT]/[RT] | Page |
| [Select] | "Reset this row / Reset this tab" |
| [B] / [Start] | Close (from Pause: back to Pause) |
| [X], [Y] | Nothing, and no prompt |

**Visibility and saving:**
- A row the device cannot use is **hidden**, never greyed.
- A row is greyed, with a reason, only when the feature exists but is blocked right now (for example "This controller can't vibrate").
- **Only overrides are saved.** Defaults come from the device class at read time.
- **Overrides in Display and Controls are stored per device class** (`settings.byClass[class]`), so Thor's frame rate or edge padding never follows the player to a phone through the cloud save. Game, Sound, Access and Account overrides are shared.
- **In a run** (Settings opened from Pause): "Run quick setup again" and "Reset Duel Summoner progress" are greyed with "End the run first". Monster aim is greyed with "Applies to your next run".
- **Determinism:** the sim never reads view settings (FOV, Camera distance, Camera assist, Screen shake, Detail, Damage numbers, Map rows). Monster aim is fixed per run and written into the replay header. Slide Hold/Toggle is resolved by the input layer into commands, so the sim never reads it. Any future setting the sim reads that can change mid-run is recorded in the tape as an event at the tick it takes effect.
- Every row is shared 1:1 between the web build and the app.

"—" in the tables means hidden on that device.

### 9.1 Game

| Row | Control | Choices | Default phone | Thor | Portal | PC | Notes |
|---|---|---|---|---|---|---|---|
| Field of view | slider | 80-115° horizontal, step 5 | 100 | 100 | 100 | 100 | Vertical is capped at 88° |
| Camera distance | segmented | Near / Standard / Far | Standard | Standard | Standard | Standard | |
| Camera assist | segmented | Off / Gentle / Strong | Gentle | Off | Off | Off | Turns the camera toward movement. Matters most on touch, where there is no right stick. |
| Damage numbers | segmented | Off / Big hits / All | Big hits | All | All | All | |
| Screen shake | slider | 0-100, step 10 | 80 | 80 | 80 | 80 | |
| Monster aim | segmented | Balanced / Nearest / Strongest | Balanced | Balanced | Balanced | Balanced | Written into the replay header; greyed in a run |
| Map overlay size | segmented | Small / Medium / Large | Medium | Medium (shown only while Dual screen is Off) | Medium | Medium | On Thor the map lives on the bottom while Dual screen is On |
| Map orientation | segmented | Turns with camera / North up | Turns with camera | North up | Turns with camera | Turns with camera | On Thor it applies to the bottom map |
| Hints | switch | On / Off | On | On | On | On | |
| Run quick setup again | action | Opens the first-launch card (11.3) | | | | | Greyed in a run |

### 9.2 Display

| Row | Control | Choices | Default phone | Thor | Portal | PC | Notes |
|---|---|---|---|---|---|---|---|
| Performance | segmented | Battery / Balanced / Performance (Custom appears when a row below differs) | Balanced (or the Android game mode hint, 2.6) | Performance | Performance | Performance | Sets the 3 rows below plus the work target. Quick setup writes the chosen profile as an override; the read-time phone default is always Balanced. |
| Frame rate | segmented | 30 / 60 / 90 / 120, filtered to `getSupportedModes()`. PC: 30 / 60 / Match screen. | 60 | 120 (the bottom runs at its own panel rate) | 120 | Match screen | Requested with `surface.setFrameRate(rate, FRAME_RATE_COMPATIBILITY_FIXED_SOURCE, CHANGE_FRAME_RATE_ALWAYS)` (API 31; the 2-argument form on API 30), only while the load card or a menu cross-fade is on screen, so a mode-switch blank is hidden. Android 15 defaults games to 60, so it is always requested. PC: browser caps skip `requestAnimationFrame` frames, and 120 or 144 cannot be paced evenly on a display that is not a multiple of them. |
| Render scale | value plate | Auto / 100 / 85 / 70 / 50% | Auto | Auto | Auto | 100% | Auto = thermal headroom plus the frame-time governor (2.6) |
| Detail | segmented | Low / Medium / High | Medium | High | High | High | World detail and effects together |
| HUD size | slider | 80-130%, step 5 | 100 | 100 | 100 | 100 | |
| Dual screen | switch | On / Off | — | On | — | — | Shown only when a built-in second panel exists. Shares the card app's `play/dual-screen` preference (3.9). |
| Edge padding | slider | 0-64 px, step 8 | 0 | — | — | — | Added to the system insets, for curved edges |
| Battery and heat | segmented | Off / In Quick Look / Always | In Quick Look | In Quick Look | In Quick Look | — | Android only. Battery % = `BatteryManager.getIntProperty(BATTERY_PROPERTY_CAPACITY)` plus charging state from the sticky `ACTION_BATTERY_CHANGED`. Heat = the thermal status icon (none / warm / hot); no degrees. |
| Full screen | switch | On / Off | — | — | — | Off | Browser full screen; web build only |

What each profile sets:

| Profile | Frame rate | Render scale | Detail | Menu world | Work target |
|---|---|---|---|---|---|
| Battery | 30 | 70% | Low | Frozen | 33.3 ms; on API 35+ also `setPreferPowerEfficiency(true)` |
| Balanced | 60 | Auto (85-100%) | Medium | Live | 16.7 ms |
| Performance | Highest supported | Auto (up to 100%) | High | Live | 1 / refresh |

- The work target is the target work duration of a `PerformanceHintManager` session (API 31), created with the render and sim thread ids; `reportActualWorkDuration` is reported every frame. Apps cannot set the game mode (`GameManager.setGameMode` needs a system permission); it is read only as a default hint (2.6).

### 9.3 Controls

| Row | Control | Choices | Default phone | Thor | Portal | PC | Notes |
|---|---|---|---|---|---|---|---|
| *All inputs* | header | | | | | | |
| Slide | segmented | Hold / Toggle | Hold | Hold | Hold | Hold | Applies to pad, touch and keys |
| *Controller* | header | | | | | | Shown when a pad has been seen this session; always on Thor and Portal |
| Button glyphs | value plate | Auto / Letters / Shapes / Swapped letters / Plain | Auto | Auto | Auto | Auto | Auto = the set of the last pad used |
| Confirm button | segmented | Match pad / Choose… | Match pad | Match pad | Match pad | Match pad | Match pad swaps menu confirm and back for Nintendo-family pads only; Choose… stores the pressed button per pad and also corrects AYN's ABXY swap (2.3) |
| Stick layout | segmented | Standard / Swapped | Standard | Standard | Standard | Standard | |
| Button map and test | action | Pad drawing with every action; pressed buttons light up instead of acting | | | | | View only. Leave by holding [B] for 1.0 s (arc shown) or with the Back chip. On Thor the drawing is on the top. No pad rebinding (the system remappers exist). |
| Look speed | slider | 1-10 | 5 | 5 | 5 | 5 | |
| Look easing | segmented | Off / Light / Smooth | Light | Light | Light | Light | |
| Invert look | segmented | None / Vertical / Horizontal / Both | None | None | None | None | |
| Stick dead zone | value plate | Auto / 4 / 8 / 12 / 16 / 20% | Auto | Auto | Auto | Auto | Auto = 8% on built-in Hall sticks, 12% on Bluetooth pads; never below the device's `getFlat()` |
| Vibration | slider | 0-100, step 10 | 70 | 70 | 70 | 70 | Greyed with a reason only when neither the pad nor the system has a motor (2.4) |
| Gyro look | switch | On / Off | Off | Off | Off | Off | Shown only when the device or active pad has a gyroscope |
| Gyro speed | slider | 1-10 | 5 | 5 | 5 | 5 | Shown only while Gyro look is On |
| *Touch* | header | | | | | | Touch screens |
| On-screen controls | segmented | Auto / Always / Off | Auto | — | Off | — | Auto hides them after 4 s of pad use and brings them back on touch. Thor plays by pad, and its bottom-screen touch is the board. |
| Move stick | segmented | Floating / Fixed | Floating | — | Floating | — | Hidden while On-screen controls is Off |
| Control size | slider | 70-140%, step 10 | 100 | — | 100 | — | Hidden while Off |
| Control opacity | slider | 20-100%, step 10 | 60 | — | 60 | — | Hidden while Off |
| Drag look speed | slider | 1-10 | 5 | — | 5 | — | Hidden while Off |
| Tap to use | switch | On / Off | On | On | On | — | On Thor: taps on the bottom map and board |
| Touch haptics | switch | On / Off | On | Off | Off | — | |
| *Keyboard and mouse* | header | | | | | | PC, or Android with a physical keyboard or mouse |
| Mouse look speed | slider | 1-10 | — | — | — | 5 | |
| Invert mouse vertical | switch | On / Off | — | — | — | Off | |
| Key bindings | action | Sheet: Move x4, Jump, Slide, Dash, Use, Quick Look, Pause. [A] then a key; [Select] resets one. | — | — | — | ✓ | |
| Reset controls | danger action | Hold 1.0 s | ✓ | ✓ | ✓ | ✓ | Always the last row |

### 9.4 Sound

The same on every device. All rows are sliders, 0-100 in steps of 5. Sound always mutes in the background and follows Android audio focus; that is not a setting.

| Row | Control | Choices | Default phone | Thor | Portal | PC | Notes |
|---|---|---|---|---|---|---|---|
| Master | slider | 0-100 | 80 | 80 | 80 | 80 | |
| Music | slider | 0-100 | 70 | 70 | 70 | 70 | |
| Battle | slider | 0-100 | 80 | 80 | 80 | 80 | Effects and summons |
| Rewards | slider | 0-100 | 50 | 50 | 50 | 50 | Duel Coins, XP and chest chimes; menu count-ups |
| Interface | slider | 0-100 | 60 | 60 | 60 | 60 | |
| World | slider | 0-100 | 60 | 60 | 60 | 60 | Ambience |

### 9.5 Access

| Row | Control | Choices | Default phone | Thor | Portal | PC | Notes |
|---|---|---|---|---|---|---|---|
| Text size | segmented | Standard / Large / Largest (x1.00 / 1.15 / 1.30) | Standard | Standard | Standard | Standard | Applied after the base text multiplier (3.6). Pages re-paginate; items stay whole. |
| Reduce motion | switch | On / Off | System "Remove animations" | Same | Same | `prefers-reduced-motion` | Android: On when `ValueAnimator.areAnimatorsEnabled()` is false (or `Settings.Global.ANIMATOR_DURATION_SCALE` == 0) |
| Reduce flashing | switch | On / Off | Off | Off | Off | Off | |
| Spell effects | segmented | Full / Soft | Full | Full | Full | Full | Soft draws your own summons' effects at 50% opacity |
| Colour assist | segmented | Off / Red-green / Blue-yellow / High contrast | Off | Off | Off | Off | Applies to LP bars (High contrast draws them white on black), element colours and enemy outlines |
| Ley thread | segmented | Subtle / Normal / Strong | Normal | Normal | Normal | Normal | The guide thread to the Gate |
| Hold to confirm | segmented | Hold / Press twice | Hold | Hold | Hold | Hold | |
| Mono audio | switch | On / Off | Off | Off | Off | Off | |

### 9.6 Account

| Row | Control | Choices | Default phone | Thor | Portal | PC | Notes |
|---|---|---|---|---|---|---|---|
| Profile | info / action | Avatar plus name from the card app; [A] opens the card app profile | | | | | Signed out: "Sign in in the card app to post runs" |
| Post runs to leaderboards | switch | On / Off | On | On | On | On | Signed in |
| Show on boards as | segmented | Name and avatar / Name only | Name and avatar | Same | Same | Same | Signed in |
| Share my top runs as replays | switch | On / Off | On | On | On | On | Verification still runs either way |
| Cloud save | action | "Synced 7:41 PM"; [A] = Sync now | | | | | Signed in. Uploads are debounced after each run and each Deck Box change. |
| Credits | action | Credits roll (Thor: on the top) | | | | | |
| Reset Duel Summoner progress | danger action | Hold 2.0 s, then a card: "Star Chips, unlocks, quests and Mastery are erased. Your board history stays." Hold 2.0 s again. | | | | | Greyed in a run ("End the run first") |
| Version | caption | | | | | | Foot of the tab |

### 9.7 Rows we deliberately do not have

| Row | Why |
|---|---|
| Target monitor, window mode, VSync, uncapped or 143 fps | Android always composes with vsync and has no monitors. Frame rate is filtered to the panel's real modes. PC keeps only Full screen. |
| Grass, shadow quality and resolution, anti-aliasing, soft particles | Too fine-grained for an app. One profile plus Render scale and Detail, with automatic thermal step-down. |
| A separate effects tab | Merged into Access (Spell effects, Reduce flashing) and Display (Detail) |
| Input delay | Native input has nothing to tune; frame pacing (Choreographer and presentation time) handles latency |
| Random targeting slider | A number nobody can reason about. Monster aim gives 3 plain choices. |
| Hold aim, separate hold crouch | We have no aim. One Slide row. |
| Arrow-key camera, visible number-key picks, "horizontal keys for chest buttons" | The ring handles every screen |
| Quick reset key | Restart in Pause (hold), because an instant reset bypasses the hold-to-confirm rule |
| Keyboard rebinding on handhelds and phones | Shown only when a keyboard exists |
| Pad rebinding list | The reference's was empty; AYN and Android have system remappers. We show a view-only map plus Stick layout and Confirm button. |
| Pause on controller disconnect | Always on |
| Language | Follows the card app. The row appears only when a second language ships. |
| Brightness, gamma, notifications | The system owns them; we send no push notifications |
| Exit, Discord, separate Credits buttons | Back and Home exist; Credits live in Account |
| Platform achievements recovery | Cloud save through our own account |
| FPS counter | A dev overlay behind `?debug` only |
| One-hand mode | Later, after the touch layout is tested on phones |
| Shop slot upgrades and a Skip purchase | None: zones are fixed at 4 by the game's rules. Pass is free in offers. |
| Map run count on the list | Shown in the map sheet ([Y]) |
| "Sort completed" checkbox | Done quests always sink |

### 9.8 Rows shown per device (summary)

| Device | Rows shown |
|---|---|
| Phone, touch only | Game 10 · Display 7 · Controls: Slide, Touch section, Reset · Sound 6 · Access 8 · Account |
| Phone with a pad | The phone set plus the Controller section |
| Thor | Game 9 while Dual screen is On (Map overlay size shown only while it is Off) · Display 7 (adds Dual screen; no Edge padding or Full screen) · Controls: Slide, Controller, Tap to use, Touch haptics, Reset · Sound 6 · Access 8 · Account |
| Portal | Like Thor, but without Dual screen and with Map overlay size and the Touch section (On-screen controls Off by default) |
| PC | No Edge padding, Battery and heat, or Touch section. Adds Full screen and the Keyboard and mouse section; Controller once a pad is seen. |

---

## 10. Pause menu

**Purpose:** stop safely, read the whole build at a glance, and act: Resume, Settings, Map, Restart or End run.

### 10.1 Wide layout (Portal, PC, phone)

| Region | Rect | Contents |
|---|---|---|
| Backdrop | Full | The run frozen, 55% black, 16 px blur. No colour wash. The sim stops at once, and the view eases time to zero over 150 ms. |
| **Duel mat** | x48-1256 (span 8), y48-1032 | The run's board laid out as a card mat. **Header** inside the mat's top-left frame: line 1 "Duel paused" (Cinzel 48) with the sworn seals (32 px) and the heat icon right-aligned; line 2 "Surface Ruins · Stage 2 of 3 · Hard · 11:42"; line 3 "Score ×1.8 · Star Chips ×1.5 · Coins 412 · Kills 1,284 · Level 23". **Monster Zones:** the 4 along the top row as tiles of 248x320 (art, level, form pips; Fusion-ready = gold corner tab plus "Fusion ready"). **Spell/Trap Zones:** the 4 along the second row as tiles of 248x200 with 1-5 pips. **Items** strip below (80 px tiles with count badges, one row, plus a "+N" tile that opens the full list) and **Exiled** greyed stamps at the strip's right. 24 + 136 + 16 + 320 + 16 + 200 + 16 + 128 + 24 = 880 ≤ 984. |
| **Ledger column** | x1280-1872, y48-1032 | Tabs **Actions · Stats · Rites** ([LB]/[RB] at the ends; hit band to y144). **Actions** (default): **Resume** (gold 592x112, [X] glyph) · **Settings** · **Map** (with the ⧉ glyph) · **Restart** (hold) · **End run** (hold, danger text); ghosts 592x112 on a 120 pitch. **Stats:** header "Changed" with a ring-focusable link "Show all" / "Show changed" (no glyph; [A] on it toggles), then rows of 56: icon, name, value, delta from base in gain green or danger red, grouped as below; 13 rows per page; changed-only by default; All stats (about 35 stats plus 5 group headers) is 4 pages ([LT]/[RT]). **Rites:** the Rite Ledger (boons taken at shrines and altars) as an icon plus one line each ("Shrine of Plenty: +12% Duel Coins"), paged. |

**Stat groups.** Names come from the Ledger stat sheet; any stat not listed here goes to its nearest group. **Order within each group follows the Ledger stat sheet, never the reference list.**

| Group | Stats |
|---|---|
| **Life** | Max LP, Armour, Ward, LP regen, Life drain, Evasion, Thorns, Overheal |
| **Damage** | Damage, Attack speed, Shots, Crit chance, Crit damage, Bounces, Knockback, Damage to elites |
| **Reach** | Area, Shot speed, Duration |
| **Movement** | Move speed, Jumps, Jump height, Dash cooldown |
| **Fortune** | Luck, Pickup range, XP gain, Coin gain, Star Chip gain, Redraws, Exiles, Elite rate, Difficulty |

**Actions:**
- **Restart:** "Restart this run? It ends now and pays what it earned." Hold 1.0 s (or press twice). It counts exactly like End run (Star Chips, quest progress, and the score so far), skips Results and goes to the load card with the same duelist, field, difficulty and Oaths and a new seed. Its reward sequence is queued (10.6).
- **End run:** "End run and keep the Star Chips earned so far?" Hold 1.0 s, then Results.
- **Map:** opens Quick Look on the Map tab.
- **Settings:** the Settings screen over the frozen run. Rows that cannot change mid-run are greyed with their reason (9). [B] or [Start] returns to Pause.
- On Thor, the confirms open on the bottom with the top dimmed.

**Reflow:**
- **Phone flex:** the gap between the mat and the Ledger column. The items strip grows to 8 per row.
- **Stacked (foldable inner, narrow screens):** the top band holds the mat; the lower area holds the Ledger column at full width.

### 10.2 Thor split

Nothing is duplicated, and the bottom keeps its job of holding the board, as in the approved preview.

- **Top (look only):**
  - The frozen run, dimmed.
  - The plaque across the top (y48-200): title, run line, counters, seals, heat icon. The counters strip moves up here from the bottom.
  - **All stats** in 4 columns x48-1872, y232-1032: Life | Damage | Reach and Movement | Fortune. Rows of 48 in Inter 28. Every stat fits with no paging; changed ones show their delta.
  - Inspect views ([Y]) and Stat sources replace the stats here while open.
- **Bottom:**
  - **Left column** (the map and stage clock slot in play) becomes the **action column**: Settings, Map, Restart, End run (128 visual on a 134 pitch, 536), then the **Rite Ledger** compact (header 32, the last 2 lines of 32, "+N more" 28 = 124), then a **Stat sources** action row (128), which opens the full list of every stat with its sources on the top. About 796 of 808.
  - **Right column:** the run board exactly as in play (Monster Zones, Spells and Traps, Items). **Exiled** stamps sit in the Spell/Trap Zones header line. Its cards are now focusable for [Y].
  - Foot: gold "[X] Resume" (548x128) and the "[Y] Inspect" chip, which acts on the focused item.
  - **Map:** grows the bottom map to full size. [B] returns.

### 10.3 Focus, buttons, touch, motion

- **Opens on** Resume in the Ledger column (Thor: the Resume button in the foot).
- **Order:** down the Actions tab. Left goes into the mat (Monster Zones first); right from the mat returns to the Ledger. On Thor, right from the action column goes to the board, and up from the foot returns to the column.

| Button | Action |
|---|---|
| [A] | Press. On a zone or item: open its card page (level, form, stats, Fusion partner). On a stat: expand its one-line explanation under it. On "Show all": toggle. |
| [B], [X] or [Start] | Resume. Only the [X] glyph is drawn, on Resume. |
| [Y] | Zone or item: its card page. Stat: where the number comes from (base, Deck Box, items, boons). |
| [Select] | Map |
| [LT]/[RT] | Page the stats (or the Rites) |
| [LB]/[RB] | Ledger tabs Actions · Stats · Rites (Thor: jump between the action column and the board) |

- **Touch:** tap anything. Tapping a zone or item opens its card page, and tapping a stat expands its line. Long-press is not used in Pause.
- **Motion:** opening desaturates and blurs the run in 160 ms and the panels rise in 200 ms. Resume drops the panels in 120 ms, then game time ramps from 0 to 1 over 300 ms (pacing ticks against wall time; the tick size stays fixed), with the 100 ms input grace. Web: Resume requests pointer lock (2.8).

### 10.4 Quick Look ([Select] in a run, or Map in Pause)

- **Single screen:** a full-screen layer and the sim freezes.
  - Header: "[B] Close" chip at x48, then the tab strip "[LB] Map · Build · Stats [RB]".
  - **Map tab:** 900x900 at x510-1410, fogged, framed as a card with a gold edge; one small gold compass sigil sits at the top-right corner with its north tick only. There are no letters around the rim. A "Zoom" pill on the map rim carries [LT] and [RT] at its ends. The legend at x1456-1856 uses our icons: Card Chest, Trophy Chest, Witness Stone, Gate, boss, Ley thread, light pillars.
  - Controls: [LT]/[RT] or pinch to zoom, [RS] or drag to pan, [R3] to recentre. Pan and recentre are not prompted, except an [RS] chip shown only while glyphs show.
  - [B], [Select] or a tap outside closes it. **[Start] closes Quick Look and opens Pause.**
  - Touch opens it with a tap on the minimap.
- **Thor:** [Select] in play (or a tap on the bottom map) grows the bottom map to full size without pausing; [Select] again, or "Close map", returns the board.

### 10.5 Results

**Wide layout:**

| Region | Rect | Contents |
|---|---|---|
| Score panel | x48-794 (span 5), y168-904 | The score counts up, then time, level, kills, Fusions, Overtime, Oaths kept, and what ended the run |
| Placement | x1126-1718 (span 4), y168-904 | Board placement (personal best, weekly rank, all-time rank), each reading "Being checked" until verified |
| Buttons | y920-1032 | Gold "[X] Try again" (592x112) at x48 (same setup, new seed); ghost "[B] Main menu" at x664 and "Watch replay" at x1088 (400x104 visual, 120 hit) |

- **Count-ups:** each step can be skipped with [A] or a tap. The buttons stay **inactive until the last count-up ends plus 300 ms**; [A] during counting only skips, so mashing [A] can never start a new run. The ring then opens on **Main menu**.
- **Pad:** [A] skips a step or presses. [B] goes to the main menu (the Main menu button carries the [B] glyph). [Y] inspects a line.
- **Try again** goes straight to the load card; its reward sequence is queued (10.6).
- **Phone flex:** the gap between the two panels.
- **Thor:** the top shows the score, counts and reveals. The bottom shows the placement and the buttons (gold Try again in the foot).

### 10.6 Reward sequence (from Results back to the menus)

Each step can be skipped with [A] or a tap, at the same pace on touch and pad:
1. Quest bars that moved count up, with a tick per step.
2. Finished quests flip to the wax check with their reward.
3. New Card Library entries flip from the etched outline to face, one by one, with the rising chime.
4. The Star Chip total counts up in the corner, then shows "Deck Box: 2 affordable" if true.
5. A "So close" line names the single nearest goal: "88 kills to Cinder Coat".

Then the main menu, with Next goals showing the new nearest quests. On Thor, steps 1-3 play on the bottom and the totals on the top.

- **Queued rewards:** rewards granted by a run that skips the sequence (Try again, Restart) are queued, and their reward sequence plays the next time the main menu opens. Nothing is granted twice.

---

## 11. First launch and controller connect/disconnect

### 11.1 Silent detection

The game reads, with no UI: device class, display count and modes, battery saver, the Android game mode hint, the built-in pad and gyro, foldable posture, and a keyboard if present. It applies the default column for that class.

**First launch = no v2 save.** A migrated v1 save shows quick setup once, with [X] Continue going to the main menu, not a first run.

### 11.2 Title card (2.5 s)

- The camp camera move plays, with "Press any button or tap" breathing at the bottom centre. On Thor: the camp on the top, the mark plus the emblem on the bottom.
- The **first input** picks the glyph set, or touch icons.
- If the card app account is signed in and a cloud save is newer than the local one (server `updated_at`), a card appears: "Progress found from 21 Nov on another device", with both summaries (Star Chips, Mastery total, quests done). Gold "[X] Use it", ghost "[B] Keep this one"; the ring opens on the gold button. It never overwrites without the player choosing Use it.

### 11.3 Quick setup

- One glass card, 1104x640, centred. On Thor the card is on the bottom, and the top shows the emblem plus a live sample.
- 3 rows at most, each pre-filled with the detected value, so [X] alone continues:

| Row | Phone, touch only | Phone with pad / Portal | Thor | PC |
|---|---|---|---|---|
| 1 | Control size, with a live ghost of the stick and buttons | Buttons: pad drawing, glyphs Auto | Buttons: built-in pad drawing, "A confirms" | Buttons if a pad was used, otherwise Mouse look speed |
| 2 | Performance: Balanced (Battery offered if battery saver is on), with a one-line consequence ("60 fps, cooler, longer battery") | Performance: Performance ("120 fps, runs warmer") | Performance: Performance | Performance |
| 3 | Text size | Text size | Dual screen: On, with a two-screen drawing | Text size |

- The Performance choice is written as an override (9.2).
- A 0x057E-family pad adds the one-time check "Press the button labelled A" to row 1, then shows "Confirm: A (right)".
- If a pad connects while the card is open, row 1 becomes the Buttons row.
- **[X] Continue** goes straight into the **first run**: Kael, Surface Ruins, Easy, Quick duel. Arrival plays in full and hints are on. (Migrated v1 saves: to the main menu.)
- **[B] Skip** keeps every value as shown and goes to the main menu with no first run.
- The card can be reopened from Game > Run quick setup again.

### 11.4 After the first run

Results, then the reward sequence, then the **main menu reveal**: the camera lands on the plinth, the verbs rise, the Next-goals rows fill one by one (80 ms each), and PLAY pulses once.

### 11.5 Later launches

- The main menu opens with a 1.6 s intro, skippable with any input.
- If a run was suspended, RESUME RUN is focused (queued rewards play first).
- There is no account step; the card app handles sign-in.

### 11.6 Connect and disconnect

See 2.6. In short:
- A connect toast; the ring stays put. Glyphs switch on the first press.
- A disconnect in a run always pauses, with the reconnect card (and Play by touch where on-screen controls exist).
- Any press on any pad, or the same pad reconnecting, returns to Pause with Resume focused.
- A disconnect in a menu shows a toast only.
- Any pad drives; the last active pad owns glyphs and rumble.

---

## 12. Build order for the PC builder

Each step is small and ends green before the next starts. Run the shots at **1920x1080, 2400x1080, 1240x1080 single, 2560x1600, foldable inner 2208x1840, and Thor (1920x1080 + 1240x1080)**, using the web URL flags `?device=phone|portal|thor|pc&pad=letters|shapes|swapped|plain|none`. In the web build, Thor draws its bottom screen as a second canvas beside the top.

| # | Step | Proof (tests and shots) |
|---|---|---|
| 1 | **Save v2 with a migrator.** `save.js:20` must stop replacing a save whose version differs. Settings are stored as overrides only, Display and Controls per device class. | Unit: a v1 fixture loads into v2 keeping Star Chips, unlocks, quests and `reduceMotion`, `shake`→`camShake`, `difficulty`. v1 values equal to v1 defaults (e.g. `shake:100`, `reduceMotion:false`) are dropped, not stored as overrides. An unknown future version is kept read-only, never wiped. |
| 2 | **Settings schema.** Rows, choices, defaults per device class, visibility rules and the in-run greying, all as data in `src/ui/settings-schema.js`. | Unit: for each class the visible row list matches 9.8. Defaults resolve at read time. |
| 3 | **Device and input layer.** Class detection (built-in pad incl. `builtin-pads.json`, built-in second panel test, roles by panel shape); glyph set by vendor id (and `Gamepad.id` on the web); the last-used rule and the Keys rule; Match pad / Choose…; Back routing (3.2); key consumption rules; trigger, stick and HAT handling with d-pad dedupe. Native: `dispatchKeyEvent` and `dispatchGenericMotionEvent` route into the same JS input queue. Change `host.js:25` (B = Slide, RB = Dash). | Unit: vendor id → set; a tap does not change the set; volume keys do not change the set; Nintendo swap affects confirm/back only; gamepad BACK without BUTTON_B → [B]; an external monitor does not make Thor. Shot: a glyph sheet of all 6 sets. Device check: Pro Controller and 8BitDo in Switch mode. |
| 4 | **Focus engine** `src/ui/focus.js`: regions, neighbour lists, geometry moves, paging at edges, repeat timings, focus memory, layer trap, 100 ms grace. | The same test file passes in Node and in QuickJS with identical results. Unit cases: geometry move, paging at edges, tab wrap, repeat 300/90/60 ms, focus memory per tab, layer trap, 100 ms grace. |
| 5 | **Shared UI as a retained display list.** Screens are described once in JS (`src/ui/screens/*.js`). Layout emits a retained node tree with stable ids; JS sends only changed nodes, packed into one ArrayBuffer per frame. Tweens are sent as {from, to, ms, ease} and run natively and on the web from one shared easing table, so JS works on change, not every frame. The web renderer is **WebGL2** with the same GLSL ES 3.00 shaders as the Kotlin GLES renderer. Text comes from **MSDF atlases** of Cinzel and Inter, with tabular-figure glyphs and kerning baked into one metrics file; JS does all line breaking. Touch hit-testing runs in JS against the layout rects. Tokens from 3.10 replace the Courier and purple placeholder look. | Shot: the component sheet (header, tabs, pager, the 4 button kinds, the 4 row kinds, sheet, ring, denied, hold arc) at all sizes. A pixel diff of web against app at 1920x1080 under 1%. |
| 6 | **Prompts split from keys in the sim.** The sim emits `{action:'use', target:'Sealed Chest'}` and the view adds the glyph or "Tap". Fix `game.js:212,223`, `world.js:186-189`, `stages.js:90,170`, `hud.js:102,121`, `index.html:183,193`, `main.js:115` ("Click the map to look around"), `offer.js:70` (the "1. Name" numbering) and `main.js:245` (the boss plate's "Enter or a click"). Boss name card: [A], [B] or a tap skips it, with no prompt drawn. Offer keys per 3.2 (remove R/P/L, `offer.js:87-93`). | Unit: a grep test finds no key names ("E:", "WASD", "Tab to", "Esc", "Enter", "click") in sim output. |
| 7 | **Boards keyed by map, difficulty and length** (`menus.js:45`, `board-core.mjs:25`), the full Leaderboard screen, and the name fixes "Longest survival" (`main.js:175`) and "Fastest clear" (`meta.js:103`). | Unit: submissions land on the right board. Shot: Leaderboard with the own row pinned. |
| 8 | **Main menu**: the real-time 3D Camp first (4.1a: kit parts, scenery, sky and lighting, the duelist's idle clip, the circling starting monster, braziers with the game's fire effect; view only; one gliding camera that the Duelist select and Map select reuse), then the verbs, badges, Next goals, the board stone with UTC countdown (`menus.js:36`) and rival line, utility chips, the Abandon hold sheet. Uses a stubbed `host.account()` until step 22. | Shots: wide, phone and Thor pair, signed in and signed out, with and without RESUME RUN. Unit: countdown to Monday 00:00 UTC from an ET clock. Budget with ?dev=1, reported Pass, Fail or Not assessed: at most 120 draw calls, 150,000 triangles and 200 particles; 60 fps on the phone profile and 120 where the screen allows; rendering quarter-rate or frozen under a full-screen panel and stopped in the background; every Camp prop listed in the asset tool. |
| 9 | **Duelist select**: grid, live model with dwell swap, details, Look row, Regalia sheet, locked states. Change the outfit kill unlock in `progress.js:6-8` from 15,000 to 12,000, and re-tag the matching quest. | Shots: unlocked, locked duelist, locked outfit focused, Regalia sheet, Thor pair. Unit: ring move = selection; [LB]/[RB] cycles owned outfits only. |
| 10 | **Map select with inline Oaths**: Length, difficulty rows, Pays line, skies, Oath signs; choices saved (`menus.js:23-24`); Small Oath and its quests hidden; Quick duel greys the Oaths. Set the chip factors in `progress.js:27` (and `main.js:166`) to 1.0 / 1.25 / 1.5. | Shots: each difficulty sky, 0 and 3 Oaths sworn, Quick duel, Thor pair. Unit: Pays line maths with the new factors; choices survive a reload. |
| 11 | **Run start**: load card with seed, stage generation in a second QuickJS runtime / Web Worker, arrival, skip rules, sim tick 0 at control. | Unit: the replay hash is identical with the intro played or skipped. Shot: load card. |
| 12 | **Card Library**: 5 tabs, grid, details, entry page (Thor split), art zoom, pool rule, reveal. Rename the "Useful stats" label in `menus.js` to "Key numbers". | Shots: each tab, locked entry, entry page, Thor pair. Unit: refuses below 6 in offers per tab. |
| 13 | **Quests**: 6 tabs with the mapping table, sorting, done sinking, the 5-pin limit with the replace sheet, hidden-Oath quests hidden. | Unit: every quest maps to exactly one tab, and Next holds the 12 nearest. Shots: Next tab and the Thor pair. |
| 14 | **Deck Box**: select vs buy, the 3 refund choices, data-driven pips, denied reason. Merge it into the shared screen system (it uses its own DOM tree today, `index.html:190`). Rename the upgrade "Banishes" to "Exiles" (`data/meta.js`) and the offer button BANISH to EXILE (`offer.js`); the save key `banishes` stays and migrates unchanged. | Unit: buy then full refund returns the exact balance; [A] never buys. Shots: affordable, unaffordable, max, Thor pair. |
| 15 | **Settings screen**: all 6 tabs, segmented / value plates, live previews, reset row and tab, apply live, in-run greying. | Shots: every tab for each device class. Unit: changing a row writes only an override, in the right scope (per class or shared). |
| 16 | **Pause, Quick Look, Results and reward sequence**: duel mat, Ledger tabs, grouped stats, items, Rites, Exiled, holds, Restart rule, Results timing gate, queued rewards. | Shots: Pause wide, phone, foldable stacked, Thor pair; Quick Look tabs; Results wide, phone, Thor pair. Unit: Restart pays the same as End run; [A] mashed through Results never starts a run; queued rewards play once. Determinism: one tape under two different view-setting sets gives the same hash. |
| 17 | **Thor native**: per-screen bottom layouts through the existing `Presentation` (NOT_FOCUSABLE) path, the bottom render thread with a shared EGLContext, bottom redraw only on change, `DisplayListener` swap with 500 ms re-attach, roles by panel shape, hand-off of the card app's Presentation and `play/dual-screen` preference. | Instrumented: a simulated second display (`overlay_display_devices 1240x1080/420`) attaches the bottom layout, survives a display remove and re-add with no GL rebuild, and `onStop`/`onStart` restores the Presentation. On device: swap the screens in AYN's panel mid-menu (no GL rebuild); check whether top-screen touch registers. |
| 18 | **Connect, disconnect and lifecycle**: toasts, the pause card and its close rules, descriptor match, battery toast, focus-loss pause, 5 s tape append, snapshots every 60 s and at stage start, RESUME RUN from snapshot plus tail, the older-version card, EGL context loss recovery. | Unit: snapshot + tail hash equals the full-replay hash; a replayed tape reaches the same state hash. On device: pull the Bluetooth pad mid-run on phone, Portal and Thor. |
| 19 | **First launch**: detection, title card, cloud-save card, quick setup rows per class (incl. the 0x057E check), the first run, the menu reveal, migrated-v1 path. | Shots: the quick setup card for each class. A scripted run from a fresh save to the main menu, and from a v1 save to the main menu with no first run. |
| 20 | **Feel layer**: rumble table and motor fallback, gyro look with axis remap, sound table, Reduce motion. | Unit: each event maps to its pattern and sound. Reduce motion replaces slides with 120 ms fades. |
| 21 | **Manifest and back**: AdventureActivity attributes (2.1), insets controller, predictive back callback, gesture exclusion rects, performance hint session, `setFrameRate` call, thermal governor. | Unit/instrumented: pad and keyboard connect does not recreate the activity. Predictive back → [B], with the 100 ms duplicate drop. |
| 22 | **Account and cloud**: `host.account()` → {signedIn, name, avatarUrl, accessToken} from the card app's Supabase session; `host.image(url)` → texture id (`BitmapFactory` natively, `Image` on the web); Supabase table `ds_saves` (user_id pk, save_version, updated_at set by the server, blob ≤ 64 KB); debounced upload after each run and each Deck Box change; the newer-save card. | Unit: newer-save detection by server `updated_at`; the card never overwrites without Use it. |
| 23 | **Replay viewer and rival route**: Watch replay from the Leaderboard, Results and the stone; the rival-line route on the board server. | Unit: a verified tape replays to its hash in the viewer. |
| 24 | **Meta tracking fields**: per-card seen and best level, map objects found, Fusions known, pins. | Unit: one run updates seen, best level, objects and Fusions. |
| 25 | **Cleanup**: remove `metaui.showLibrary` and the unused `QUESTS` import (`main.js:22`). | Full test suite green; no dead exports. |
| 26 | **Real-device sign-off**: Thor (top touch, ABXY swap, 120 Hz top, chin Back key device, built-in rumble and gyro), Odin 3 Portal (Start/Select keycodes, `setFrameRate(120)` under Android 15, gyro, rumble, printed face labels for `builtin-pads.json`), Xbox Series pad 0x0B13 (View as BACK, rumble), DualSense, Pro Controller and 8BitDo A/B. | A checklist page with a photo or short clip per item |

---

## 13. Open questions for the owner

1. **First launch goes straight into a short first run** (Kael, Surface Ruins, Easy, one stage), and the main menu appears after its rewards. Is that what you want, or should the main menu come first?
2. **Oaths count only on Full runs** (they grey out on Quick duel), so a sworn Oath always means clearing every stage. Keep that rule?
3. **Does the Thor top screen take touch?** Tap it once and tell us. If it does, the top-screen panels become tappable too, with no layout change.

---

## Review notes

Rejected, merged or adapted fixes (everything else was applied as written):

1. **Long-press in Pause acts as [Select] and opens the Map** (§10.3, second critique): rejected. The card-app convention makes long-press an item quick menu. A long-press on a card that opens the map would surprise players. Applied the other fix instead: long-press is not used in Pause or in runs. Its "[Start] in Settings from Pause returns to Pause" part was applied.
2. **Card Library [Y] = the entry page, the same as [A]:** rejected. It duplicates [A] and drops the convention that Y shows the card big. Applied press-to-zoom with no hold (on Thor, on the top).
3. **"Useful stats" → "Numbers it moves":** rejected. Two fixes gave two labels; kept "Key numbers".
4. **"Quests 31/44":** rejected in favour of "Quests 18/44" (the other fix). "Duelists 2/4" applied.
5. **Phones under 6.5" default to Text size Large:** rejected. The base text multiplier (12 dp floor) already covers this, and both together would scale twice.
6. **Thor bottom lists of 5 rows on a 136 pitch plus page dots:** rejected in favour of 6 rows on a 134 pitch, with the dots in the foot row (the other Thor-bottom fix). Every "6 per page" stays.
7. **Dual screen Off leaves the bottom black with pixels off:** rejected. The app cannot hold the panel without a Presentation, and holding a black one takes the bottom away from the system. Applied "dismiss the Presentation and leave the panel to the system".
8. **Reflow: stacked only below 4:3:** rejected in favour of stacked for anything narrower than 16:10. From the same fix, kept "1920 wide, extra height to the body" for 16:10 up to 16:9. The other fix's "scaled to height" wording was dropped, because it pushes the right panels off screen.
9. **Monster aim recorded as a tape event when it changes:** adapted. Monster aim is greyed in a run, per the other fix, so it never changes mid-run. The general rule stays for any future sim-read setting, and the view-settings hash test is kept.
10. **Thor map select: multipliers only in the bottom Pays line:** rejected in favour of moving the Pays line to the top plaque. It is look-only text, and the move frees the bottom. The other fix's Oath rule line on the top plaque was applied.
11. **Board-card fixes:** superseded, because the originality fix moves the board out of the main menu and into the Camp as a stone. This covers the wide board overflow (both versions), Goals shrinking to 3 rows, [Y] on board rows, the Thor top board's untappable tabs and paired switch, the Thor top board row counts and the nudge plaque. The "[Y] = rival's run card" rule moved to the stone. With no board on the main menu, [LB]/[RB] has no job there.
12. **Stone position x1320-1560, y600-900:** adapted to x1040-1240, y640-920. The given rect sat behind the Next goals panel (x1280-1872, y168-888).
13. **Next goals as 5 rows of 592x128 in y168-888:** adapted to rows of 120 on a 124 pitch. 128 rows plus header and padding overflow 720.
14. **Thor Deck Box "[Y] Rank table" chip:** rejected in favour of the rank table always on the Thor top, with no chip. On wide, the [Y] link reads "Rank table".
15. **Leaderboard on Thor at 4 rows per page:** adapted to 5. The new Thor body (808) fits the segmented row plus 5 rows on a 134 pitch.
16. **Pause [LB]/[RB] jumps between Build, Actions and Stats:** adapted to Ledger tabs (Actions · Stats · Rites) after the Pause redesign. On Thor it jumps between the action column and the board.
17. **Pause fixes made moot by the redesign:** the Build-column overflow and its "last 2 or 3 Rite lines" are moot, since wide Rites are a paged tab. The plaque width fix was applied as a 3-line mat header, with the seals and heat icon right-aligned on line 1. The stats paging is 13 rows per page in the Ledger column, still 4 pages.
18. **Results opens on Try again:** rejected. It conflicts with the anti-mash fix, so the ring opens on Main menu.
19. **Thor detection excludes FLAG_PRESENTATION displays:** rejected. The card app finds the built-in bottom panel through the presentation category, so that flag does not mean external. Kept the diagonal, cast and virtual tests. The diagonal limit is 5.5", not 5" (one fix said each); both Thor and Duo bottom panels are about 3.9".
20. **Two KEYCODE_BACK fixes** ("gamepad BACK with no BUTTON_B = BUTTON_B" and "external gamepad BACK = [Select]"): merged into one rule, keyed on whether the device reports BUTTON_B.
21. **Thor buttons raised to 136:** adapted to 128 visual on a 134 pitch, the hit area for stacked body controls. Six main-menu buttons at 136 would overflow the 808 body. Foot buttons and chips keep 136.
22. **Sound renames:** count-ups use Rewards rather than Battle, since they are reward chimes.
23. **Pins:** the tracker now holds 5 Next goals, so the pin limit rises from 4 to 5. It follows the main-menu fix and is not a separate critique.
24. **Duelist details:** the order comes from the originality fix. Following it, the flavour line leaves the wide panel (Thor plaque and [Y] sheet). From the overflow fix, "Runs · Kills · Longest" moved under the model's feet. Part heights were set to that fix's 860 total.
25. **Map select overflow, "3 rows of 112":** superseded by the card-face row. Its run-panel trims and Oath sizes were applied.
26. **Step numbering:** "Step 18a" (account) became step 22, merged with "Account and cloud". Old step 19 now runs as step 7. The added steps sit before cleanup, and real-device sign-off moved to the end (26) so it covers them. Step references in the fixes were renumbered to match.
27. **"Never overwrites without [A]"** became "without the player choosing Use it", to keep the no-[A]-glyph rule.
28. **Gold edge → corner tab:** the approved Thor bottom preview draws Fusion-ready cards with a gold border. Under the new rule that border becomes the corner tab, so the preview needs this change before PC build.
29. **Draft scores** section deleted as asked.


## Decided 23 Nov: in-run windows

In-run windows (the shop, the level-up offer, the chest reveal) use the menus' dark glass with a gold line, the same look as the approved menus in this spec. Decided by the owner. Built with the menus step, which still waits for the go-ahead; nothing is built for it yet.
