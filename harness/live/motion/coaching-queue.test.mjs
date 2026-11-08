import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoachingQueue } from './coaching-queue.mjs';
const flush = async () => { for (let i=0;i<16;i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
function clock() { let time=0,id=0; const timers=new Map(); return {now:()=>time,schedule:(fn,delay)=>{timers.set(++id,{fn,at:time+delay});return id;},cancelTimer:key=>timers.delete(key),advance(value){time=value; for(const [key,timer] of [...timers]) if(timer.at<=time){timers.delete(key);timer.fn();}}}; }
test('FIFO keeps one in flight; dispatch spacing does not add delay after a slow response', async()=>{
 const c=clock(), waits=[deferred(),deferred(),deferred()], starts=[], results=[], states=[];
 let active=0,maxActive=0;
 const queue=createCoachingQueue({...c,review:async item=>{starts.push({key:item.key,time:c.now()});maxActive=Math.max(maxActive,++active); const result=await waits[Number(item.key)].promise;active--;return result;},onResult:(item,result)=>results.push([item.key,result]),onState:(item,state)=>states.push([item.key,state])});
 for(let i=0;i<3;i++)queue.enqueue({key:String(i)}); await flush();
 assert.deepEqual(starts,[{key:'0',time:0}]);c.advance(10000);await flush();assert.equal(starts.length,1);
 waits[0].resolve('first');await flush();assert.deepEqual(starts[1],{key:'1',time:10000});
 waits[1].resolve('second');await flush();c.advance(17999);await flush();assert.equal(starts.length,2);c.advance(18000);await flush();assert.deepEqual(starts[2],{key:'2',time:18000});
 waits[2].resolve('third');await flush();assert.equal(maxActive,1);assert.deepEqual(results,[['0','first'],['1','second'],['2','third']]);assert.equal(states.filter(([,state])=>state==='ready').length,3);
});
test('six-review budget, duplicate suppression and cancellation prevent late source results',async()=>{
 const abort=new AbortController(), wait=deferred(), states=[], results=[];
 const q=createCoachingQueue({signal:abort.signal,review:()=>wait.promise,onState:(item,state)=>states.push([item.key,state]),onResult:value=>results.push(value)});
 for(let i=0;i<6;i++)assert.equal(q.enqueue({key:String(i)}),true);
 assert.equal(q.enqueue({key:'0'}),false);assert.equal(q.enqueue({key:'6'}),false);await flush();
 assert.deepEqual(q.snapshot(),{accepted:6,queued:5,running:1,cancelled:false});abort.abort();wait.resolve('late');await flush();
 assert.equal(results.length,0);assert.equal(states.filter(([,state])=>state==='cancelled').length,6);assert.ok(states.some(([key,state])=>key==='6'&&state==='not-queued'));assert.equal(q.enqueue({key:'7'}),false);
});
test('prepare failure is actionable and never exposes upstream text',async()=>{
 const states=[];let requests=0;
 const q=createCoachingQueue({prepare:async()=>{throw Object.assign(new Error('secret-url-token'),{code:'provider_disconnected'});},review:()=>requests++,onState:(_item,state,message)=>states.push({state,message})});
 q.enqueue({key:'a'});await flush();assert.equal(requests,0);assert.match(states.at(-1).message,/Connect ChatGPT/);assert.ok(!JSON.stringify(states).includes('secret'));assert.equal(states.at(-1).state,'failed');
});

test('every one of three queued reps reaches a terminal status even when the middle response fails', async () => {
  const dispatched = [], results = [], terminal = new Map();
  const queue = createCoachingQueue({ intervalMs: 0,
    review: async item => { dispatched.push(item.key); if (item.key === 'second') throw Object.assign(new Error('private upstream details'), { code: 'invalid_response' }); return item.key; },
    onResult: (item, result) => results.push([item.key, result]),
    onState: (item, state, message) => { if (['ready', 'failed'].includes(state)) terminal.set(item.key, { state, message }); },
  });
  for (const key of ['first', 'second', 'third']) queue.enqueue({ key });
  await flush(); await flush();
  assert.deepEqual(dispatched, ['first', 'second', 'third']);
  assert.deepEqual(results, [['first', 'first'], ['third', 'third']]);
  assert.deepEqual([...terminal.values()].map(value => value.state), ['ready', 'failed', 'ready']);
  assert.match(terminal.get('second').message, /could not be linked/);
  assert.doesNotMatch(JSON.stringify([...terminal.values()]), /private upstream/);
  assert.deepEqual(queue.snapshot(), { accepted: 3, queued: 0, running: 0, cancelled: false });
});

test('quota and expired authorization are explicit; unknown upstream codes cannot inject a message', async () => {
  for (const [code, expected] of [['usage_limit', /plan usage/], ['reauthorize', /Reconnect ChatGPT/], ['constructor', /rep review failed/]]) {
    let terminal;
    const queue = createCoachingQueue({ review: async () => { throw Object.assign(new Error('secret response'), { code }); }, onState: (_item, state, message) => { if (state === 'failed') terminal = message; } });
    queue.enqueue({ key: code }); await flush();
    assert.match(terminal, expected); assert.doesNotMatch(terminal, /secret response/);
  }
});
