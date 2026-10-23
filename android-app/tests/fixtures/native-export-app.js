// Minimal reviewed browser-source excerpts for native export transform tests.
function download(name, text, type = "text/plain") {
  const u = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}
async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    download("CardStashy_List.txt", text + "\n");
    toast("Clipboard blocked — downloaded as a text file instead.");
  }
}

A.exportMissing = () => {
  const d = currentDeck();
  download(`CardStashy_${fileSafe(d.name)}_missing.txt`, exportDeck(missingList(d)) + "\n");
};


A.exportRef = (t) => {
  const r = S.state.references.find((x) => x.id === t.dataset.id);
  download(`CardStashy_${fileSafe(r.name)}.txt`, exportDeckText(r) + "\n");
};

A.proxies = (t) => {
  const d = currentDeck() || deckById(S.ui.sheetCtx?.deckId);
  if (!d) return;
  const all = t.dataset.scope === "all",
    rows = all ? aggregateCards(d.cards) : V.rowsFor(d).filter((r) => r.missing).map((r) => ({ name: r.name, qty: r.missing })),
    cards = proxyList(rows, S.catalog);
  if (!cards.length) return toast(all ? "No non-basic cards to print." : "Nothing missing — no proxies needed.");
  const html = proxySheetHTML(`${d.name} — ${all ? "deck" : "missing cards"} proxies`, cards),
    w = window.open("", "_blank");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  } else {
    download(fileSafe(d.name) + "_proxies.html", html, "text/html");
    toast("Pop-up blocked — downloaded the proxy sheet instead. Open it and print.");
  }
};

A.exportBackup = () => {
  const status=document.getElementById('backupExportStatus');
  try {
    download("CardStashy_Backup_" + new Date().toISOString().slice(0, 10) + ".json", backupPayload(), "application/json");
    const message='Backup prepared. Check your downloads to confirm the file was saved.';
    if(status){status.textContent='✓ '+message;status.classList.add('success');}
    toast(message);
  } catch {
    const message='Backup could not be prepared. Your saved data is unchanged. Try again.';
    if(status){status.textContent=message;status.classList.remove('success');}
    toast(message);
  }
};


A.downloadRecovery=async t=>{
  const item=await recoverySnapshot(t.dataset.id);if(!item)return toast('That recovery copy is not available in this account.');
  download(`CardStashy_Recovery_${fileSafe(item.label)}.json`,JSON.stringify(backupEnvelope(item.state)),'application/json');
  toast('Backup prepared. Check your downloads to confirm the file was saved.');
};

async function migration(){if(result.migrationBackup&&!isEmptyWorkspace(result.migrationBackup))download('CardStashy_Device_Before_Account_Isolation.json',JSON.stringify(backupEnvelope(result.migrationBackup)),'application/json');}
async function conflictBackup(){if(file)download(`CardStashy_Backup_${fileSafe(label)}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(backupEnvelope(state)),"application/json");}