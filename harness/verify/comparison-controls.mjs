import {chromium} from 'playwright';
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const server=await createServer({root,configFile:`${root}/vite.config.ts`,server:{host:'127.0.0.1',port:0,strictPort:false}});
await server.listen();await server.watcher.close();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const proof={verifiedAtUtc:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),surface:'isolated development source; actual public good/bad clips + Heavy; disconnected provider',checks:{},errors:[],phaseChecks:[]};let aiCalls=0;
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>proof.errors.push(e.message));await page.routeWebSocket('**',socket=>socket.close());
 await page.route('**/api/**',route=>{if(route.request().url().endsWith('/interpret'))aiCalls++;return route.fulfill({json:{state:'disconnected'}});});
 await page.route('**/src/analyze.ts*',route=>route.fulfill({contentType:'text/javascript',body:`import {analyzeSquat} from '/harness/motion/analyze.mjs';export async function analyze(source,options){const report=await analyzeSquat(source,{...options,onProgress:({progress})=>options.onProgress(progress)});(window.qaReports??=[]).push({reps:report.reps,clip:report.clip,model:report.poseModel.id});return report;}`}));
 await page.goto(origin);const skip=page.getByRole('button',{name:'Not now',exact:true});if(await skip.isVisible())await skip.click();
 const id=await page.evaluate(async()=>{const h=await import('/harness/history/index.mjs');const report=await(await fetch('/harness/results/clear-squat.analysis-report.v1.json')).json();const video=await(await fetch('/fixtures/squat/clear-squat.mp4')).blob();return(await h.saveSession({id:h.createSessionId(),kind:'recorded',title:'Public fixture controls',video,report})).id;});
 await page.goto(`${origin}/?session=${id}`);const reference=page.getByRole('region',{name:'Personal rep reference'});await reference.waitFor();
 const compare=reference.getByRole('group',{name:'Compare reference with rep'}),baseline=reference.getByRole('group',{name:'Reference rep',exact:true});
 for(const name of ['Rep 2','Rep 1','Rep 2']){await compare.getByRole('button',{name,exact:true}).click();assert.equal(await compare.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');assert.match(await reference.locator('thead').innerText(),new RegExp(`${name} comparison`));}
 await baseline.getByRole('button',{name:'Rep 2',exact:true}).focus();await page.keyboard.press('Space');assert.equal(await baseline.getByRole('button',{name:'Rep 2',exact:true}).getAttribute('aria-pressed'),'true');
 await compare.getByRole('button',{name:'Playing rep',exact:true}).click();assert.equal(await compare.getByRole('button',{name:'Playing rep',exact:true}).getAttribute('aria-pressed'),'true');proof.checks.directReferenceButtonsMouseKeyboardAndPlayingMode=true;
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);proof.checks.referenceMobileFits=true;
 await page.goto(origin);await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Compare examples',exact:true}).click();await page.getByText('Two recordings ready',{exact:true}).waitFor({timeout:120000});
 const reports=await page.evaluate(()=>qaReports);assert.equal(reports.length,2);assert(reports.every(report=>report.model==='mediapipe-pose-landmarker-heavy'));proof.sourceReports=reports;
 const selected=[0,0];
 const checkPhase=async(phase,name)=>{await page.getByRole('button',{name,exact:true}).click();const expected=reports.map((report,i)=>report.reps[selected[i]][phase]);await page.waitForFunction(times=>[...document.querySelectorAll('.recording-card video')].every((video,i)=>video.paused&&!video.seeking&&Math.abs(video.currentTime*1000-times[i])<2),expected);await page.waitForTimeout(100);const actual=await page.locator('.recording-card video').evaluateAll(videos=>videos.map(v=>Math.round(v.currentTime*1000)));assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');const label=await page.getByRole('status',{name:'Selected video alignment'}).innerText();assert.match(label,/selected/);for(const time of expected)assert(label.includes(`${(time/1000).toFixed(2)} s`));proof.phaseChecks.push({phase,expected,actual,label});};
 for(const phase of ['bottomMs','startMs','endMs','startMs','startMs'])await checkPhase(phase,{startMs:'Compare starts',bottomMs:'Compare bottoms',endMs:'Compare returns'}[phase]);
 proof.checks.bottomToStartAndStandToStartActuallySeekBothVideos=true;proof.checks.repeatedStartHasVisibleSelectedFeedback=true;
 if(reports.every(report=>report.reps.length>1)){for(const[slot,index]of[['A',0],['B',1]]){await page.getByRole('group',{name:`Recording ${slot} rep`,exact:true}).getByRole('button',{name:'Rep 2',exact:true}).click();selected[index]=1;}await checkPhase('endMs','Compare returns');await checkPhase('startMs','Compare starts');proof.checks.startUsesIndependentlySelectedSecondReps=true;}
 await page.screenshot({path:`${root}/qa/comparison-controls-desktop.png`,fullPage:true});await page.setViewportSize({width:390,height:844});await checkPhase('bottomMs','Compare bottoms');await checkPhase('startMs','Compare starts');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${root}/qa/comparison-controls-mobile.png`,fullPage:true});proof.checks.mobilePhaseControlsFitAndSeek=true;
 assert.equal(aiCalls,0);assert.deepEqual(proof.errors,[]);proof.checks.noProviderRequestsOrPageErrors=true;proof.status='passed';
}catch(error){proof.status='failed';proof.failure=error.stack;throw error;}finally{await writeFile(`${root}/qa/comparison-controls.json`,JSON.stringify(proof,null,2)+'\n');await browser.close();await server.close();console.log(JSON.stringify(proof));}
