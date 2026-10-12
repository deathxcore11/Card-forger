import { guideQuality } from "./scan.js";

export function scanControls(s) {
  return `<div class="actions wrap"><button class="btn" data-act="scanCamera">📷 Live camera</button><label class="btn ghost">Take photo<input type="file" accept="image/*" capture="environment" data-change="scanFile" hidden></label><label class="btn ghost">Upload<input type="file" accept="image/*" data-change="scanFile" hidden></label>${s.url ? `<button class="btn ghost" data-act="scanClear" ${s.busy ? "disabled" : ""}>Clear</button><button class="btn ghost" data-act="scanRotate" ${s.busy ? "disabled" : ""}>Rotate 90°</button>` : ""}</div>
  <label class="scan-language">Card language <select data-change="scanLanguage"><option value="eng" ${s.language !== "jpn" ? "selected" : ""}>English</option><option value="jpn" ${s.language === "jpn" ? "selected" : ""}>Japanese (text only; English database)</option></select></label>
  ${s.url ? `<details class="scan-crop-tools"><summary>Crop out the background or holder label</summary><p class="muted small">Use the sliders to leave only the card. Then apply the crop and read again.</p><div class="scan-crop-stage"><img src="${s.url}" alt="Photo to crop"><div id="scanCropBox" style="inset:0"></div></div>${["left", "top", "right", "bottom"].map(k => `<label>${k}<input type="range" min="0" max="45" value="0" data-input="scanInset" data-side="${k}" aria-label="Crop ${k}"></label>`).join("")}<button class="btn ghost" data-act="scanApplyCrop" ${s.busy ? "disabled" : ""}>Apply crop</button></details>` : ""}
  <p class="muted small">Green means capture checks passed, not a verified match. Put one card flat on a contrasting surface; avoid sleeves, holder labels and glare.</p>`;
}

export async function transformPhoto(url, insets = {}, rotate = false) {
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(Error("Couldn’t open that photo.")); image.src = url; });
  const w = image.naturalWidth, h = image.naturalHeight;
  const l = (insets.left || 0) / 100, r = (insets.right || 0) / 100;
  const t = (insets.top || 0) / 100, b = (insets.bottom || 0) / 100;
  if (l + r >= 0.9 || t + b >= 0.9) throw Error("Keep more of the card inside the crop.");
  const cw = Math.round(w * (1 - l - r)), ch = Math.round(h * (1 - t - b));
  const canvas = document.createElement("canvas");
  canvas.width = rotate ? ch : cw; canvas.height = rotate ? cw : ch;
  const ctx = canvas.getContext("2d");
  if (rotate) { ctx.translate(ch, 0); ctx.rotate(Math.PI / 2); }
  ctx.drawImage(image, w * l, h * t, cw, ch, 0, 0, cw, ch);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.95));
  if (!blob) throw Error("Couldn’t prepare the photo.");
  return blob;
}

export async function openScanCamera(onCapture) {
  if (!navigator.mediaDevices?.getUserMedia) throw Error("Live camera isn’t available in this browser. Use Take photo or Upload.");
  const previous = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "scan-camera-dialog";
  dialog.setAttribute("aria-label", "Live card scanner");
  dialog.innerHTML = `<div class="row between"><h2>Line up one card</h2><button class="btn ghost small" id="cameraClose" aria-label="Close camera">✕</button></div><div class="camera-stage"><video autoplay muted playsinline></video><div class="camera-guide" data-quality="red"></div></div><p id="cameraHint" role="status">Starting camera…</p><p class="muted small">Align the actual card, not its sleeve. These checks do not identify the card or guarantee focus.</p><button class="btn block" id="cameraCapture" disabled>Capture and check</button>`;
  document.body.append(dialog);
  dialog.showModal();
  let stream, timer, stopped = false, stable = 0, previousSample;
  const video = dialog.querySelector("video"), guide = dialog.querySelector(".camera-guide"), hint = dialog.querySelector("#cameraHint"), capture = dialog.querySelector("#cameraCapture");
  const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 448;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const box = { x: 45, y: 63, w: 230, h: 322 };
  const stop = () => {
    stopped = true; clearInterval(timer); stream?.getTracks().forEach(track => track.stop());
    window.removeEventListener("hashchange", stop); document.removeEventListener("visibilitychange", visibility);
    dialog.remove(); previous?.focus?.();
  };
  const visibility = () => { if (document.hidden) stop(); };
  dialog.addEventListener("cancel", stop); dialog.querySelector("#cameraClose").onclick = stop;
  window.addEventListener("hashchange", stop); document.addEventListener("visibilitychange", visibility);
  const draw = target => {
    const scale = Math.max(target.canvas.width / video.videoWidth, target.canvas.height / video.videoHeight);
    const w = target.canvas.width / scale, h = target.canvas.height / scale;
    target.drawImage(video, (video.videoWidth - w) / 2, (video.videoHeight - h) / 2, w, h, 0, 0, target.canvas.width, target.canvas.height);
  };
  capture.onclick = async () => {
    if (!video.videoWidth || stopped) return;
    capture.disabled = true;
    const frame = document.createElement("canvas"); frame.width = 1400; frame.height = 1960;
    draw(frame.getContext("2d"));
    const crop = document.createElement("canvas"); crop.width = Math.round(box.w * frame.width / 320); crop.height = Math.round(box.h * frame.height / 448);
    crop.getContext("2d").drawImage(frame, box.x * frame.width / 320, box.y * frame.height / 448, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const blob = await new Promise(resolve => crop.toBlob(resolve, "image/jpeg", 0.95));
    stop();
    if (blob) onCapture(blob);
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = stream;
    await video.play();
    if (stopped) return;
    timer = setInterval(() => {
      if (!video.videoWidth || stopped) return;
      draw(ctx);
      const frame = ctx.getImageData(0, 0, 320, 448), q = guideQuality(frame, box);
      const sample = [];
      for (let y = 90; y < 370; y += 20) for (let x = 70; x < 260; x += 20) sample.push(frame.data[(y * 320 + x) * 4]);
      const movement = previousSample ? sample.reduce((sum, v, i) => sum + Math.abs(v - previousSample[i]), 0) / sample.length : Infinity;
      previousSample = sample;
      stable = q.state === "green" && movement < 10 ? stable + 1 : 0;
      guide.dataset.quality = q.state === "green" && stable < 3 ? "amber" : q.state;
      hint.textContent = q.state === "green" && stable < 3 ? "Hold steady…" : q.text;
      capture.disabled = false; // Manual capture stays available if edge checks struggle.
      capture.textContent = guide.dataset.quality === "green" ? "Ready · capture and check" : "Capture anyway · check the photo";
    }, 250);
  } catch (error) {
    stop();
    throw Error(error.name === "NotAllowedError" ? "Camera permission was denied. Allow it in your browser settings, or use Take photo." : "Couldn’t start the camera. Use Take photo or Upload.");
  }
}
