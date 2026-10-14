// The "working on it" pop-up shown over any long build (deck versions, deck ideas, upgrades,
// tournament adaptations) so a slow load never looks frozen. The status line (role=status) is
// updated live by the task; pass its id when the task updates it by id.
import { esc } from "./ui.js";
export const buildOverlay = (msg = "", { title = "Building your decks", note = "Every budget is built, upgraded toward its limit and checked with Deck Power. This can take up to a minute.", id = "" } = {}) => `<div class="build-overlay" aria-live="polite"><div class="build-pop">
  <div class="build-fan" aria-hidden="true"><i></i><i></i><i></i></div>
  <b>${esc(title)}</b>
  <p role="status"${id ? ` id="${esc(id)}"` : ""}>${esc(msg || "Getting started…")}</p>
  <small>${esc(note)}</small>
</div></div>`;
