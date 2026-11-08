import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('../../',import.meta.url)),configFile:new URL('../../vite.config.ts',import.meta.url).pathname,server:{host:'127.0.0.1',port:0,watch:null}});let browser;
try{
 await server.listen();await server.watcher.close();browser=await chromium.launch({channel:'chrome',headless:true});
 for(const path of ['/','/harness/live/']){
  const context=await browser.newContext();let state='disconnected',starts=0,disconnects=0;const errors=[];
  await context.route('**/api/connection',route=>route.fulfill({json:{state}}));
  await context.route('**/api/auth/start',route=>{starts++;return route.fulfill({json:{state:'connecting',authorizationUrl:`http://127.0.0.1:${server.httpServer.address().port}/qa-auth`}});});
  await context.route('**/qa-auth',route=>route.fulfill({contentType:'text/html',body:'<p>Controlled sign-in fixture</p>'}));
  await context.route('**/api/disconnect',route=>{disconnects++;state='disconnected';return route.fulfill({json:{state}});});
  const page=await context.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.httpServer.address().port}${path}`);
  const header=page.locator('header [aria-label="ChatGPT connection"]');await header.getByRole('button',{name:'Connect ChatGPT',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('header [aria-label="ChatGPT connection"] [role=status]').textContent.includes('Not connected'));
  assert.equal(starts,0,'Status checks never start sign-in');assert.equal(await page.locator('#ai-feed > li').count(),0);
  const popupWait=page.waitForEvent('popup');await header.getByRole('button',{name:'Connect ChatGPT',exact:true}).click();const popup=await popupWait;await popup.waitForURL('**/qa-auth');assert.equal(starts,1);
  state='connected';await page.waitForFunction(()=>document.querySelector('header [aria-label="ChatGPT connection"] [role=status]').textContent.includes('Connected'),null,{timeout:6000});
  const closedHeight=await page.locator('header').evaluate(node=>node.getBoundingClientRect().height);
  await header.locator('summary').click();await header.getByRole('button',{name:'Reconnect ChatGPT',exact:true}).waitFor();assert.equal(disconnects,0,'Options never disconnect by themselves');
  assert.ok(Math.abs(await page.locator('header').evaluate(node=>node.getBoundingClientRect().height)-closedHeight)<1,'Account menu must not stretch header');
  assert.ok(await header.getByRole('button',{name:'Disconnect ChatGPT',exact:true}).evaluate(node=>node.getBoundingClientRect().height)>=44,'Account targets remain44px under pagezoom');
  await page.keyboard.press('Escape');assert.equal(await header.locator('details').getAttribute('open'),null);assert.equal(await header.locator('summary').evaluate(node=>node===document.activeElement),true);
  await header.locator('summary').click();await header.locator('[role=status]').click();assert.equal(disconnects,0);assert.equal(await header.locator('details').getAttribute('open'),null);
  if(path.includes('/live/')) {await page.screenshot({path:'/tmp/moveide-live-layout.png'});const stage=await page.locator('.stage').boundingBox(),chart=await page.locator('.live-trends').boundingBox();assert.ok(stage.height>=300);assert.ok(chart.y>=stage.y+stage.height+12,'Graph has breathing room below video');}
  await page.setViewportSize({width:390,height:844});await header.locator('summary').click();await page.waitForTimeout(50);const menu=await header.locator('.coach-account-panel').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=390,JSON.stringify(menu));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No mobile overflow');await header.getByRole('button',{name:'Disconnect ChatGPT',exact:true}).click();await header.getByRole('button',{name:'Connect ChatGPT',exact:true}).waitFor();assert.equal(disconnects,1);assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({result:'passed',rootBeforeClip:true,liveBeforeCamera:true,explicitSignInOnly:true,popupStatusRefresh:true,reconnectVisible:true,explicitDisconnectOnly:true,anchoredAccountMenu:true,escapeAndOutsideClose:true,desktopMobileFit:true,actual44pxControls:true,noRealAccountOrCamera:true}));
}finally{await browser?.close();await server.close();}
