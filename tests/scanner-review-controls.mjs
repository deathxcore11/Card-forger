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
