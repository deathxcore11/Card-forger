// The "working on it" pop-up shown over any long build (deck versions, deck ideas, upgrades,
// tournament adaptations) so a slow load never looks frozen. The status line (role=status) is
// updated live by the task; pass its id when the task updates it by id.
import {brandMark} from "./brand.js";
import { esc } from "./ui.js";
export const buildOverlay = (msg = "", { title = "Building your decks", note = "Finding complete decks that fit your cards and budget, then checking their strength. This can take up to a minute.", id = "" } = {}) => `<div class="build-overlay" aria-live="polite"><div class="build-pop">
  <div class="build-brand" aria-hidden="true">${brandMark("brand-loading")}</div>
  <b>${esc(title)}</b>
  <p role="status"${id ? ` id="${esc(id)}"` : ""}>${esc(msg || "Getting started…")}</p>
  <small>${esc(note)}</small>
</div></div>`;
