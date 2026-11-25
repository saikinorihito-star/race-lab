import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DISTANCES,makeRoute,laneAt} from '../nakayama-course.mjs';
import {buildPath,buildRun,runAt,timeAtDistance,startDelay,TICK} from '../nakayama-single-run.mjs';
test('one horse reaches the finish of all 30 Nakayama turf routes, staying on the chosen lane',()=>{
 for(const rail of ['A','B','C'])for(const d of DISTANCES){
  const route=makeRoute(d,rail),path=buildPath(route,2),run=buildRun(path);
  assert.equal(runAt(run,0).d,0);assert.equal(runAt(run,0).speed,0);
  assert.ok(Math.abs(runAt(run,run.duration).d-d)<1e-7);
  let prev=0;
  for(let t=0;t<run.duration;t+=.5){
   const p=runAt(run,t),ref=laneAt(route,p.d,2);
   assert.ok(p.d>=prev&&p.speed>=0&&p.speed<=17.2+1e-9);
   assert.ok(Number.isFinite(p.x+p.y+p.z+p.pitch));
   assert.ok(Math.hypot(p.x-ref.x,p.z-ref.z)<.1);
   assert.ok(Math.abs(p.y-ref.y)<.015);
   assert.ok(Math.abs(Math.hypot(p.tx,p.tz)-1)<1e-8);prev=p.d;
  }
  assert.ok(path.length>d);
 }
});
test('delay is deterministic and identical to Tokyo probability rule; horse stays in stall',()=>{
 const route=makeRoute(2500),path=buildPath(route,2),a=buildRun(path),b=buildRun(path,{risk:10,seed:1});
 assert.ok(b.delay>=.25&&b.delay<=1.5);assert.equal(b.delay,startDelay(10,1));
 for(let t=0;t<=b.delay;t+=TICK)assert.equal(runAt(b,t).length,0);
 assert.ok(Math.abs(b.duration-a.duration-b.delay)<1e-7);
 assert.ok(Math.abs(runAt(b,b.delay+.5).length-runAt(a,.5).length)<1e-7);
 assert.equal(startDelay(1,1),0);
 const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
 const f=n=>html.slice(html.indexOf('function '+n+'('),html.indexOf('\n}\n',html.indexOf('function '+n+'('))+2);
 const tokyo=new Function([f('flowHash'),f('startRiskProbability'),f('sampleStartDelay'),'return sampleStartDelay'].join('\n'))();
 for(let level=1;level<=10;level++)for(let seed=1;seed<=100;seed++)assert.equal(startDelay(level,seed),tokyo(level,seed,0));
});
test('seek is reversible, physical lane length affects finish time, hill remains unexaggerated',()=>{
 const route=makeRoute(2500),a=buildRun(buildPath(route,0)),b=buildRun(buildPath(route,5));
 assert.ok(b.duration>a.duration);
 for(const d of [1,100,1000,2320,2430,2500]){
  const time=timeAtDistance(b,d),p=runAt(b,time);
  assert.ok(Math.abs(p.d-d)<1e-6);
  assert.deepEqual(runAt(b,time),p);
 }
 assert.ok(runAt(b,timeAtDistance(b,2395)).grade>2);
});
test('preview uses only the approved cached original model and distance driven animation',()=>{
 const html=readFileSync(new URL('../nakayama-course-preview.html',import.meta.url),'utf8');
 assert.match(html,/race-lab-3d-model-local-cache/);
 assert.match(html,/official-meshy-blue-ribbon-original-geometry-gallop-v2-20261119/);
 assert.match(html,/484459/);assert.match(html,/2733876/);
 assert.match(html,/Design01_RightLead_TransverseGallop_v2/);
 assert.match(html,/mixer\.setTime\(p\.length\*1\.42065\/16\)/);
 assert.match(html,/if\(!modelReady\|\|!run\)return/);
 assert.match(html,/side\*Math\.min\(1,elapsed\/\.18\)/);
 assert.match(html,/new THREE\.Vector3\(p\.tz,0,-p\.tx\)/);
 assert.doesNotThrow(()=>new Function(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'')));
});
