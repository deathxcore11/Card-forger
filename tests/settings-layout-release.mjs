import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,makeSearchFixtures,noOverflow,capture} from './search-fixtures.mjs';
import {workspaceSig} from '../cloud.js';
const modes=['light','dark','aura'],widths=[320,390,768,1440];
if(process.argv.includes('--validate-fixtures')){assert.equal(modes.length*widths.length*4*6,288);console.log('PASS: three games, guest/account modes, four widths, three themes and four Settings sections.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Settings release browser verification runs in hosted CI only.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch({headless:true}),checks=[];
let failure;
try{
 for(const game of ['mtg','ptcg','ygo'])for(const signedIn of [false,true]){
  const state=structuredClone(makeSearchFixtures(game).state),art={game:'ptcg',cardId:'Gengar-settings',name:'Pikachu ex — A collector’s favorite artwork from the Celebrations anniversary collection',image:'https://search-fixtures.invalid/Gengar-settings.svg',zoom:1,x:.5,y:.5,ratio:1};
  state.settings.cardAvatar=art;
  const fixture={user:signedIn?{id:'A',email:'collector@example.invalid'}:null,profiles:{A:{username:'collector_a',display_name:'Collector A'}},art:{A:{avatar:art}},rows:{A:{data:state,revision:1}},people:{},items:{},writes:[],storage:{'cardforge-v2':state,...(signedIn?{'cardforge-cloud-v1':{userId:'A',revision:1,sig:workspaceSig(state)}}:{})}};
  const app=await openSearchApp(browser,server.base,{game,width:390,height:1000,accountFixture:fixture,evidenceLabel:'settings-layout'}),{page}=app;
  try{
   await page.waitForFunction(async signedIn=>{const c=(await import('/cloud.js')).cloudInfo();return !c.switching&&!!c.user===signedIn;},signedIn);
   const before=await page.evaluate(()=>JSON.stringify(window.__uiTestState.state));
   await page.locator('[data-act="menu"]').click();
   assert.equal(await page.locator('.settings-dialog-head .stashy-logo').count(),1,'reuse the actual CardStashy logo');
   assert.equal(await page.locator('.settings-aside').count(),0,'no detached status sidebar');
   if(!signedIn){assert.equal(await page.locator('.auth-card .profile-photo-row').count(),1,'guest profile belongs inside the account card');assert.equal(await page.locator('.settings-account-layout > .panel').count(),1,'one cohesive account card');}
   const profileDetails=page.locator('.account > details').first();
   if(signedIn)await profileDetails.locator('summary').click();
   else await page.getByText('Choose profile artwork',{exact:true}).click();
   for(const selector of ['.profile-photo-source','.profile-photo-control']){
    await page.locator('#settings-account '+selector).click();await page.locator('.profile-art-dialog[open]').waitFor();
    assert.equal(await page.locator('.zoom-overlay').count(),0,'profile task opens the editor, not artwork zoom');
    await page.locator('[data-avatar-close]').click();await page.locator('.profile-art-dialog').waitFor({state:'detached'});
   }
   if(signedIn)await profileDetails.locator('summary').click();
   else await page.getByText('Choose profile artwork',{exact:true}).click();
   for(const theme of modes){
    await page.locator('#settingsTab-app').click();await page.locator('#settingsTheme-'+theme).check();
    for(const width of widths){
     await page.setViewportSize({width,height:1000});
     for(const tab of ['account','recovery','info','app']){
      await page.locator('#settingsTab-'+tab).click();
      assert(await page.locator('[data-settings-save-status]').evaluate(n=>n.scrollWidth<=n.clientWidth+1), 'Save status remains fully readable, never shortened by the header ellipsis rule');
      await noOverflow(page,'#settingsDialog',`${game}/${signedIn?'account':'guest'}/${theme}/${width}/${tab}`);
      const pane=await page.locator('#settings-'+tab).boundingBox();const content=await page.locator('.settings-dialog .settings-page').boundingBox();assert(pane.width>=content.width-48,'section uses the available content width');
      checks.push({game,signedIn,theme,width,tab});
     }
    }
   }
   await page.setViewportSize({width:390,height:1000});await page.locator('#settingsTab-app').click();
   await page.locator('.grid-size-control label:has([value="large"])').click();await page.locator('#toast.show').waitFor();
   for(const width of widths){await page.setViewportSize({width,height:1000});await noOverflow(page,'#settingsDialog',`visible preference feedback ${game}/${width}`);}
   await page.setViewportSize({width:390,height:1000});await page.locator('#settingsTab-recovery').click();
   const downloaded=page.waitForEvent('download');await page.locator('[data-act="exportBackup"]').click();await downloaded;assert.match(await page.locator('#backupExportStatus').innerText(),/Check your downloads/);
   await noOverflow(page,'#settingsDialog',`backup receipt ${game}`);
   await page.locator('#settingsTab-account').click();
   if(game==='mtg')for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});await page.locator('#settingsTab-app').click();await page.locator('#settingsTheme-dark').check();await page.locator('#settingsTab-account').click();await capture(page,`synthetic-search-settings-release-${signedIn?'account':'guest'}-${width}`);}
   if(game==='mtg')for(const width of [320,1440]){await page.setViewportSize({width,height:1000});await page.locator('#settingsTab-app').click();await capture(page,`synthetic-search-settings-release-appearance-${signedIn?'account':'guest'}-${width}`);}
   assert.equal(await page.evaluate(()=>JSON.stringify(window.__uiTestState.state)),before,'display/exports never mutate the collection or account');
   app.health();
  }catch(error){error.diagnostics=app.diagnostics();await capture(page,`synthetic-search-settings-release-failure-${game}-${signedIn?'account':'guest'}`,{settle:false}).catch(()=>{});throw error;}finally{await app.context.close();}
 }
}catch(error){failure=error;throw error;}finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/settings-release-layout.json',JSON.stringify({status:failure?'failed':'passed',checks,error:failure?.stack,diagnostics:failure?.diagnostics,evidence:'Hosted Chromium with synthetic account/provider data. Real app source and CSS; no production account writes.'},null,2));await browser.close();await server.close();}
console.log('PASS: 288 all-game/theme/viewport/account layout checks, branded account/profile composition, preference feedback, actual backup download and unchanged workspace.');
