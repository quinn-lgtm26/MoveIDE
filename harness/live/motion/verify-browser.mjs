import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server=await createServer({configFile:new URL('../../vite.config.mjs',import.meta.url).pathname,server:{host:'127.0.0.1',port:0,strictPort:false}});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage();
  const browserErrors=[]; page.on('pageerror',error=>browserErrors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/harness/live/motion/runner.html`);
  await page.waitForFunction(()=>window.verifyLive);
  const result=await page.evaluate(()=>Promise.race([window.verifyLive(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Live browser verification exceeded 90 seconds.')),90000))]));
  result.synthetic=await page.evaluate(()=>window.verifySynthetic());
  result.browserErrors=browserErrors; result.runAt=new Date().toISOString();
  await writeFile(new URL('./browser-verification.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({...result,updates:`${result.updates.length} samples (saved in browser-verification.json)`},null,2));
  if(result.errors.length||browserErrors.length||result.afterStop||result.finalStats.retainedEvidenceImages!==0||result.stats.processedFrames<10||result.reportRepCount<1||result.events.length<1||result.synthetic.errors.length||result.synthetic.afterStop||result.synthetic.nonUnknown||result.synthetic.beforeStop.retainedFrames>10||!result.synthetic.beforeStop.inFlight) process.exitCode=1;
} finally { await browser?.close(); await server.close(); }
