// The "building your decks" pop-up shown over the Build decks sheet while versions are compared.
// The status line (role=status) is updated live by the builder.
import { esc } from "./ui.js";
export const buildOverlay = (msg = "") => `<div class="build-overlay" aria-live="polite"><div class="build-pop">
  <div class="build-fan" aria-hidden="true"><i></i><i></i><i></i></div>
  <b>Building your decks</b>
  <p role="status">${esc(msg || "Getting started…")}</p>
  <small>Every budget is built, upgraded toward its limit and checked with Deck Power. This can take up to a minute.</small>
</div></div>`;
