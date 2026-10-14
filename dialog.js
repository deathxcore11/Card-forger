// In-app confirm and text prompts, in the app's own style, instead of the browser's pop-ups.
// ask(message) → Promise<boolean>; askText(message, value) → Promise<string|null>.
// Destructive questions (Delete, Remove, Replace, Clear…) get a red button named for the action.
import { esc } from "./ui.js";
import { haptic } from "./feel.js";

const DANGER = /^(Delete|Remove|Replace|Clear|Sign out|Start empty|Switch|End|Restore)\b/i;

function open(message, { input = null, ok, cancel = "Cancel", danger } = {}) {
  return new Promise((resolve) => {
    const verb = String(message).match(DANGER)?.[1];
    danger ??= !!verb && !/^(Restore|Switch)$/i.test(verb);
    ok ??= input != null ? "Save" : verb ? verb.replace(/^./, (x) => x.toUpperCase()) : "OK";
    const d = document.createElement("dialog");
    d.className = "cf-dialog" + (danger ? " danger" : "");
    d.innerHTML = `<form method="dialog" class="cf-dialog-card">
      <p class="cf-dialog-msg">${esc(message)}</p>
      ${input != null ? `<input class="cf-dialog-input" value="${esc(input)}" maxlength="80" aria-label="${esc(message)}">` : ""}
      <div class="cf-dialog-actions"><button type="button" class="btn ghost" value="cancel">${esc(cancel)}</button><button class="btn ${danger ? "danger" : ""}" value="ok">${esc(ok)}</button></div>
    </form>`;
    document.body.append(d);
    const field = d.querySelector("input");
    let done = false;
    const finish = (yes) => {
      if (done) return;
      done = true;
      d.classList.add("closing");
      setTimeout(() => { d.close?.(); d.remove(); }, 160);
      resolve(input != null ? (yes ? field.value.trim() : null) : yes);
    };
    d.querySelector('[value="cancel"]').addEventListener("click", () => finish(false));
    d.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); if (danger) haptic("warn"); finish(true); });
    d.addEventListener("cancel", (e) => { e.preventDefault(); finish(false); });
    d.addEventListener("click", (e) => { if (e.target === d) finish(false); });
    d.showModal ? d.showModal() : d.setAttribute("open", "");
    haptic("tap");
    // A destructive question starts on Cancel, so Enter can't delete by accident.
    (field || d.querySelector(danger ? '[value="cancel"]' : '[value="ok"]')).focus();
    field?.select();
  });
}
export const ask = (message, opts) => open(message, opts);
export const askText = (message, value = "", opts = {}) => open(message, { ...opts, input: String(value ?? "") });
