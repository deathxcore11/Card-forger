/** Native-bundle-only substitutions. The reviewed browser source is never written. */
export function transformNativeExports(source) {
  let code = source;
  const replace = (before, after) => {
    if (code.split(before).length !== 2) throw Error(`Native export transform expected exactly one anchor: ${before.slice(0, 100)}`);
    code = code.replace(before, after);
  };
  replace('function download(name, text, type = "text/plain") {', `function download(name, text, type = "text/plain") {
  if (globalThis.CARDSTASHY_NATIVE) return saveNativeDownload(name, text, type);`);
  replace('async function copyText(text, msg) {', `// Receipts, not picker launch, determine native success. Never fall back to a
// blob anchor after native cancellation/failure. Legacy fire-and-forget callers
// remain safe: this boundary consumes rejections and reports them to the user.
async function saveNativeDownload(name, text, mime) {
  try {
    const receipt = await globalThis.CARDSTASHY_DOCUMENTS.saveDocument({ name, text, mime });
    if (receipt?.status === 'cancelled') { toast('Save cancelled. Your saved data is unchanged.'); return receipt; }
    if (receipt?.status !== 'saved' || receipt.saved !== true) throw Error('Save was not confirmed.');
    toast('Document saved.');
    return receipt;
  } catch (error) {
    toast('Document was not confirmed saved. Your saved data is unchanged. Try again.');
    return { status: 'failed', saved: false };
  }
}
async function copyText(text, msg) {`);
  replace('    download("CardStashy_List.txt", text + "\\n");\n    toast("Clipboard blocked — downloaded as a text file instead.");', '    await download("CardStashy_List.txt", text + "\\n");\n    if (!globalThis.CARDSTASHY_NATIVE) toast("Clipboard blocked — downloaded as a text file instead.");');
  // Simple actions now return their pending save, without changing browser output.
  for (const line of [
    '  download(`CardStashy_${fileSafe(d.name)}_missing.txt`, exportDeck(missingList(d)) + "\\n");',
    '  download(`CardStashy_${fileSafe(r.name)}.txt`, exportDeckText(r) + "\\n");',
  ]) replace(line, line.replace('  download(', '  return download('));
  replace('A.proxies = (t) => {', 'A.proxies = async (t) => {');
  replace('    w = window.open("", "_blank");', '    w = globalThis.CARDSTASHY_NATIVE ? null : window.open("", "_blank");');
  replace('    download(fileSafe(d.name) + "_proxies.html", html, "text/html");\n    toast("Pop-up blocked — downloaded the proxy sheet instead. Open it and print.");', '    await download(fileSafe(d.name) + "_proxies.html", html, "text/html");\n    if (!globalThis.CARDSTASHY_NATIVE) toast("Pop-up blocked — downloaded the proxy sheet instead. Open it and print.");');
  replace('A.exportBackup = () => {', 'A.exportBackup = async () => {');
  replace('    download("CardStashy_Backup_" + new Date().toISOString().slice(0, 10) + ".json", backupPayload(), "application/json");', `    const receipt = await download("CardStashy_Backup_" + new Date().toISOString().slice(0, 10) + ".json", backupPayload(), "application/json");
    if (globalThis.CARDSTASHY_NATIVE) {
      const saved = receipt?.status === 'saved' && receipt.saved === true;
      const message = saved ? 'Backup saved.' : receipt?.status === 'cancelled' ? 'Save cancelled. Your saved data is unchanged.' : 'Backup was not confirmed saved. Your saved data is unchanged. Try again.';
      if (status) { status.textContent = (saved ? '✓ ' : '') + message; status.classList.toggle('success', saved); }
      return receipt;
    }`);
  replace("  download(`CardStashy_Recovery_${fileSafe(item.label)}.json`,JSON.stringify(backupEnvelope(item.state)),'application/json');\n  toast('Backup prepared. Check your downloads to confirm the file was saved.');", "  const receipt = await download(`CardStashy_Recovery_${fileSafe(item.label)}.json`,JSON.stringify(backupEnvelope(item.state)),'application/json');\n  if (!globalThis.CARDSTASHY_NATIVE) toast('Backup prepared. Check your downloads to confirm the file was saved.');\n  return receipt;");
  replace("if(result.migrationBackup&&!isEmptyWorkspace(result.migrationBackup))download(", "if(result.migrationBackup&&!isEmptyWorkspace(result.migrationBackup))await download(");
  replace('if(file)download(`CardStashy_Backup_', 'if(file)await download(`CardStashy_Backup_');
  return code;
}

/** These actions share app.js's receipt-aware download; return its promise. */
export function transformNativeTcgExports(source) {
  let code = source;
  for (const anchor of ['    download(`CardStashy_${GAMES[G].short', '    download(d.name.replace(/[^a-z0-9]+/gi']) {
    if (code.split(anchor).length !== 2) throw Error(`Native TCG export transform expected exactly one anchor: ${anchor}`);
    code = code.replace(anchor, anchor.replace('    download(', '    return download('));
  }
  return code;
}
