# CardStashy UI system

The tokens below are defined in the first `:root` block of `style.css`, and the
base primitives there (`.btn`, fields, `.seg`, `.chip.pick`) use them. Screens grew
their own versions of shared components over time, so `ui-system.css` loads last
in `index.html` and holds the cross-screen corrections that must win. When you
add or change a screen, use these tokens instead of literal values.

## Tokens

| Role | Token | Value | Use for |
| --- | --- | --- | --- |
| Radius | `--r-xs` | 6px | tags, tiny badges |
| | `--r-sm` | 8px | items inside a container (segment, menu row) |
| | `--r-md` | 12px | buttons, inputs, selects, icon buttons, notes |
| | `--r-lg` | 16px | cards and panels (older panels use `--radius`, 14px) |
| | `--r-xl` | 20px | sheets, dialogs, hero cards |
| | `--r-pill` | 999px | chips and status pills only |
| Height | `--control-sm` | 36px | `.btn.small`, segment items, compact tools |
| | `--control-md` | 44px | `.btn`, inputs, selects, toolbar controls |
| | `--control-lg` | 48px | hero search, prominent actions |
| Type | `--fs-caption` | 11px | eyebrows, captions |
| | `--fs-small` | 13px | small buttons, segments, "see all" links |
| | `--fs-body` | 15px | body text |
| | `--fs-section` | 19px | section titles (18px on phones) |
| | `--fs-page` | 28px | page titles (26px on phones) |
| Frame | `--page-max` | 1240px | content width on every screen, Home included |

Colors stay on the existing theme variables (`--bg`, `--surface`, `--surface-2`,
`--line`, `--text`, `--muted`, `--gold`, `--good`, `--bad`, `--warn`). `--gold` is
the current game's accent; primary buttons, selected tabs and the bottom-nav
selection all follow it. `--brand-action` resolves to the same accent.

## Components

- **Buttons**: `.btn` (primary, accent fill), `.btn.ghost` (secondary),
  `.btn.small` (compact). One primary action per group.
- **Segmented controls**: `.seg` is the pattern for switching views within a
  page. Set families, Settings sections and Community sections use the same
  track, item and selected state. Selected = raised surface, never an outline.
- **Chips**: tappable chips are 32px pills. Shortcuts that open something
  (Search's Compare/Sets/Wiki/Random) are compact buttons, not chips.
- **Section headings**: `h2` at the section size with a 13px accent "see all"
  link on the right.
- **Over artwork**: surfaces that stay dark in Light mode get light ink for every
  status color, `--warn` included. Use `.chip.dark` for chips on art.

## Checks

- Fields on iPhone are at least 16px so Safari does not zoom on focus.
- Check new screens in Dark and Light at 390px and 1440px.
