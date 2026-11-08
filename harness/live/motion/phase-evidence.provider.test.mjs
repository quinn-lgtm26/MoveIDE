import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLiveCoachBundle, selectPhaseEvidence } from './phase-evidence.mjs';
import { interpretWithChatGPT } from '../../provider/responses.mjs';
const report=JSON.parse(await readFile(new URL('../../results/clear-squat.analysis-report.v1.json',import.meta.url)));
// Transport validation fixture only: same JPEG bytes reused, no actual inference/visual-grounding claim.
const jpeg=await readFile(new URL('../../results/clear-squat-evidence/frame-1067ms.jpg',import.meta.url));
const blob=new Blob([jpeg],{type:'image/jpeg'}), cache=new Map(report.frames.map(frame=>[frame.timestampMs,blob]));
const {packet}=buildLiveCoachBundle(report,report.reps[0].id,selectPhaseEvidence(report,report.reps[0],cache));
const images=packet.evidence.map(ref=>({...ref,dataUrl:`data:image/jpeg;base64,${jpeg.toString('base64')}`}));
test('actual provider request builder sends seven labeled JPEGs and bounded trace inside the existing request limit',async()=>{
  let calls=0;
  const result={observations:[{text:'Observed sampled descent and return.',evidenceIds:[images[0].id,images.at(-1).id]}],nextFocus:{text:'Keep the camera view clear.',evidenceIds:[images[3].id]},uncertainty:'Sampled frames only.'};
  const fetcher=async(url,options)=>{
    if(url.endsWith('/models'))return Response.json({models:[{slug:'gpt-6.1-sol',visibility:'list'}]});
    calls++;const request=JSON.parse(options.body),content=request.input[0].content;
    assert.equal(content.filter(part=>part.type==='input_image').length,7);
    assert.deepEqual(JSON.parse(content[0].text).motionContext,packet.motionContext);
    assert.deepEqual(content.filter(part=>part.type==='input_text').slice(1).map(part=>part.text),images.map(image=>`Source frame ${image.id} at ${image.timestampMs} ms.`));
    assert.equal(request.store,false);assert.equal(request.text.format.strict,true);
    assert.ok(Buffer.byteLength(JSON.stringify({model:'gpt-6.1-sol',packet,images}))<12_200_000);
    const event={type:'response.completed',response:{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(result)}]}]}};
    return new Response(`data: ${JSON.stringify(event)}\n\n`,{headers:{'Content-Type':'text/event-stream'}});
  };
  assert.deepEqual(await interpretWithChatGPT('test-only',{model:'gpt-6.1-sol',packet,images},{fetcher}),result);assert.equal(calls,1);
  await assert.rejects(()=>interpretWithChatGPT('test-only',{model:'gpt-6.1-sol',packet,images:images.slice(1)},{fetcher}),{code:'invalid_evidence'});
  const oversized=structuredClone(packet);oversized.motionContext.samples.push(...Array(32).fill(oversized.motionContext.samples[0]));
  await assert.rejects(()=>interpretWithChatGPT('test-only',{model:'gpt-6.1-sol',packet:oversized,images},{fetcher}),{code:'invalid_evidence'});
  assert.equal(calls,1,'Invalid payload never reaches provider');
});
