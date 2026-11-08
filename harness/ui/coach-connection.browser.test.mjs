import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const server=await createServer({configFile:new URL('../../vite.config.ts',import.meta.url).pathname,server:{host:'127.0.0.1',port:0,watch:null}});let browser;
try{
 await server.listen();await server.watcher.close();browser=await chromium.launch({channel:'chrome',headless:true});
 for(const path of ['/','/harness/live/']){
  const context=await browser.newContext();let state='disconnected',starts=0,disconnects=0;const errors=[];
  await context.route('**/api/connection',route=>route.fulfill({json:{state}}));
  await context.route('**/api/auth/start',route=>{starts++;return route.fulfill({json:{state:'connecting',authorizationUrl:`http://127.0.0.1:${server.httpServer.address().port}/qa-auth`}});});
  await context.route('**/qa-auth',route=>route.fulfill({contentType:'text/html',body:'<p>Controlled sign-in fixture</p>'}));
  await context.route('**/api/disconnect',route=>{disconnects++;state='disconnected';return route.fulfill({json:{state}});});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.httpServer.address().port}${path}`);
  const header=page.locator('header [aria-label="ChatGPT connection"]');await header.getByRole('button',{name:'Connect ChatGPT',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('header [aria-label="ChatGPT connection"] [role=status]').textContent.includes('Not connected'));
  assert.equal(starts,0,'Status checks never start sign-in');assert.equal(await page.locator('#ai-feed > li').count(),0);
  const popupWait=page.waitForEvent('popup');await header.getByRole('button',{name:'Connect ChatGPT',exact:true}).click();const popup=await popupWait;await popup.waitForURL('**/qa-auth');assert.equal(starts,1);
  state='connected';await page.waitForFunction(()=>document.querySelector('header [aria-label="ChatGPT connection"] [role=status]').textContent.includes('Connected'),null,{timeout:6000});
  await header.locator('summary').click();await header.getByRole('button',{name:'Reconnect ChatGPT',exact:true}).waitFor();assert.equal(disconnects,0,'Options never disconnect by themselves');await header.getByRole('button',{name:'Disconnect ChatGPT',exact:true}).click();await header.getByRole('button',{name:'Connect ChatGPT',exact:true}).waitFor();assert.equal(disconnects,1);assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({result:'passed',rootBeforeClip:true,liveBeforeCamera:true,explicitSignInOnly:true,popupStatusRefresh:true,reconnectVisible:true,explicitDisconnectOnly:true,noRealAccountOrCamera:true}));
}finally{await browser?.close();await server.close();}
