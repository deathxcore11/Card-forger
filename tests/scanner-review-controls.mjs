// Exercise the user's pile -> review -> chosen capture flow without invoking
// handlers or changing scanner state directly. Photo mode keeps its filmstrip.
export async function openCapturedCard(page,id){
 const pile=page.locator('.scan-pile');
 if(await pile.count()&&!await page.locator('.scan-confirm').count()){
  await pile.click();await page.locator('.scan-confirm').waitFor();
 }
 const thumb=page.locator(`.scan-batch-thumb[data-id="${id}"]`);
 if(await thumb.getAttribute('aria-current')!=='true')await thumb.click();
 await page.locator('.scan-confirm').waitFor();
}

// Select through the actual inline controls, leaving capture/OCR data untouched.
export async function chooseInlinePrinting(page,cardId,finish=''){
 await page.locator('.scan-inline-printings .printing-carousel[aria-busy="false"]').waitFor();
 const rows=await page.evaluate(()=>window.__uiTestState?.ui.scan.confirm.inline.rows.map(r=>({key:r.key,cardId:r.cardId,releaseId:r.releaseId,number:r.number,total:r.total,rarity:r.rarity,finish:r.finish,variant:r.variantKey,edition:r.edition,selectable:r.selectable})));
 const row=rows.find(r=>r.cardId===cardId&&r.selectable&&(!finish||r.finish===finish||r.variant===finish||r.edition===finish));
 if(!row)throw Error('No selectable inline printing for '+cardId+' '+finish);
 for(const [field,value] of [['set',row.releaseId],['number',row.number+(row.total?'/'+row.total:'')],['rarity',row.rarity]]){
  if(value)await page.locator(`[data-change="scanBrowseFilter"][data-field="${field}"]`).selectOption(value);
 }
 const variant=page.locator('.scan-inline-printings .printing-slide.is-current [data-change="scanBrowseVariant"]');
 if(await variant.count())await variant.selectOption(row.key);
 await page.locator(`.scan-inline-printings [data-act="scanBrowseChoose"][data-key=${JSON.stringify(row.key)}]`).click();
 return row;
}
