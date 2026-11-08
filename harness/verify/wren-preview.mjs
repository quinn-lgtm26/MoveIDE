// Exact public static-preview preflight. No account, user browser, or camera access.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const target=process.argv[2];
if(!target?.startsWith('https://'))throw Error('Pass the public HTTPS fixture-only preview origin.');
const out={testedAt:new Date().toISOString(),target,scope:'Real Heavy over public HTTPS, isolated Chrome, disconnected AI; no physical phone or anatomical accuracy claim.',checks:{},errors:[]};
const browser=await chromium.launch({channel:'chrome'});
try {
 const context=await browser.newContext({viewport:{width:1400,height:1000}}), page=await context.newPage();
 page.on('pageerror',e=>out.errors.push(e.message));
 const index=await context.request.get(target);assert.equal(index.status(),200);
 out.indexSha256=createHash('sha256').update(await index.body()).digest('hex');
 const connection=await context.request.get(`${target}/api/connection`);assert.equal((await connection.json()).state,'disconnected');
 for(const path of ['/api/interpret','/api/models','/api/auth/start','/rooms'])assert.equal((await context.request.get(target+path)).status(),404);
 out.checks.noPrivateProviderOrPairing=true;
 await page.goto(target);await page.getByRole('button',{name:'Try a sample squat',exact:true}).click();
 await Promise.race([page.getByText(/Ready · sample squat/).waitFor({timeout:180000}),page.getByRole('alert').first().waitFor({timeout:180000}).then(async()=>{throw Error(await page.getByRole('alert').first().innerText());})]);
 await page.getByText(/Connect ChatGPT to also get coach notes/).waitFor();
 await page.getByText('Saved on this device',{exact:true}).waitFor();out.checks.sampleAndHonestDisconnectedAI=true;
 await page.getByRole('button',{name:'Rep 1 bottom at 1.1 s',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.stage canvas')?.getContext('2d').getImageData(0,0,document.querySelector('.stage canvas').width,document.querySelector('.stage canvas').height).data.some((v,i)=>i%4===3&&v>0));
 out.checks.sourceOverlay=true;
 await page.getByRole('link',{name:'History',exact:true}).click();
 await page.getByRole('button',{name:'Rename',exact:true}).click();await page.getByRole('textbox',{name:'Session title'}).fill('QA squat review');
 await page.getByRole('button',{name:'Save title',exact:true}).click();await page.getByRole('button',{name:'Open QA squat review',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Open QA squat review',exact:true}).click();
 await page.getByText('Saved session · replay only',{exact:true}).waitFor();out.checks.renameReloadReplay=true;
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download analysis JSON',exact:true}).click()]);
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.ok(exported);out.checks.sessionDownload=true;
 await page.getByRole('button',{name:'Compare examples',exact:true}).click();
 await page.getByText('Two recordings ready · independent source clocks',{exact:true}).waitFor({timeout:180000});
 const cards=page.locator('.recording-card');assert.equal(await cards.count(),2);assert.notEqual(await cards.nth(0).getAttribute('data-source-sha256'),await cards.nth(1).getAttribute('data-source-sha256'));
 await page.getByRole('button',{name:'Compare bottoms',exact:true}).click();out.checks.distinctSourceComparison=true;
 for(const width of [1400,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}out.checks.comparisonResponsive=true;
 await page.goto(`${target}/harness/live/`);await page.getByRole('button',{name:'Start coached squat',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);out.checks.liveSetupVisible=true;
 await page.getByRole('link',{name:'History',exact:true}).click();await page.getByRole('heading',{name:'Saved sessions.',exact:true}).waitFor();out.checks.liveHistoryNavigation=true;
 assert.deepEqual(out.errors,[]);out.status='passed';
} catch(error) {out.status='failed';out.failure=error.message;throw error;}
finally {await writeFile(new URL('../../qa/wren-public-preflight.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));await browser.close();}
