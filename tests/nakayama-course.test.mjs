import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SPEC,DISTANCES,LOOPS,SECTIONS,at,altitude,widthAt,makeRoute,routeAt,gradeAt} from '../nakayama-course.mjs';
const near=(a,b,t=.001)=>assert.ok(Math.abs(a-b)<=t,a+' != '+b);
test('published A course lengths, straight, right turn and common segments',()=>{
 near(LOOPS.inner.length,SPEC.innerLap);near(LOOPS.outer.length,SPEC.outerLap);
 for(const kind of ['inner','outer']){
  const lap=SPEC[kind+'Lap'],g=at(kind,0),home=at(kind,lap-310);
  near(Math.hypot(g.x-home.x,g.z-home.z),310);
  assert.ok(g.tx<-.99);
  let signed=0;const samples=LOOPS[kind].samples;
  for(let i=1;i<samples.length;i++)signed+=samples[i-1].x*samples[i].z-samples[i].x*samples[i-1].z;
  assert.ok(signed>0,'right turn in plan coordinates');
  near(Math.max(...samples.map(p=>altitude(kind,lap-p.s)))-Math.min(...samples.map(p=>altitude(kind,lap-p.s))),5.3,.025);
 }
 for(const s of [0,100,300,SECTIONS.split]){
  const a=at('inner',s),b=at('outer',s);near(a.x,b.x);near(a.z,b.z);near(a.y,b.y);near(widthAt('inner',s),widthAt('outer',s));
 }
 for(const r of [0,70,180,310,600,SECTIONS.sharedFinish]){
  const a=at('inner',SPEC.innerLap-r),b=at('outer',SPEC.outerLap-r);near(a.x,b.x);near(a.z,b.z);near(a.y,b.y);near(widthAt('inner',a.station),widthAt('outer',b.station));
 }
});
test('final hill rise, max grade and all ten distances finish continuously',()=>{
 for(const d of DISTANCES){
  const route=makeRoute(d);near(route.legs.reduce((s,l)=>s+l.length,0),d);
  let last=routeAt(route,0),length=0;
  for(let i=1;i<=d;i++){const p=routeAt(route,i),step=Math.hypot(p.x-last.x,p.z-last.z);assert.ok(step<=1.005);length+=step;assert.ok(Number.isFinite(p.y));last=p}
  near(length,d,.05);near(last.x,0);near(last.z,0);near(last.y,0);
  near(routeAt(route,d-70).y-routeAt(route,d-180).y,2.2);
  let max=0;for(let i=d-180;i<=d-70;i++)max=Math.max(max,gradeAt(route,i));near(max,2.24,.001);
 }
 assert.deepEqual(makeRoute(2500).legs.map(l=>l.kind),['outer','inner']);
 assert.deepEqual(makeRoute(3200).legs.map(l=>l.kind),['pocket','outer','inner']);
 assert.deepEqual(makeRoute(3600).legs.map(l=>l.kind),['inner','inner','inner']);
 assert.deepEqual(makeRoute(4000).legs.map(l=>l.kind),['outer','outer','outer']);
});
test('width stays in published ranges and preview does not alter Tokyo physics',()=>{
 for(const kind of ['inner','outer'])for(let i=0;i<SPEC[kind+'Lap'];i+=2){const w=widthAt(kind,i);assert.ok(w>=SPEC[kind+'Width'][0]-.001&&w<=32.001)}
 const html=readFileSync(new URL('../nakayama-course-preview.html',import.meta.url),'utf8');
 const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'');
 assert.doesNotThrow(()=>new Function(code));
 const tokyo=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
 assert.match(tokyo,/raceCourseVenue/);assert.match(tokyo,/nakayama-course-preview\.html/);assert.match(tokyo,/const LAP=2083\.1/);
});

test('traced plan retains broad oval and asymmetrical outer branch without pinched turns',()=>{
 const bounds=kind=>{
  const p=LOOPS[kind].samples,x=p.map(q=>q.x),z=p.map(q=>q.z);
  return {w:Math.max(...x)-Math.min(...x),h:Math.max(...z)-Math.min(...z),top:Math.min(...z)};
 };
 const i=bounds('inner'),o=bounds('outer');
 assert.ok(i.w/i.h>2&&i.w/i.h<2.4);
 assert.ok(o.w/o.h>1.3&&o.w/o.h<1.6);
 assert.ok(i.top-o.top>120);
 assert.ok(Math.abs(i.w-o.w)<1);
 const start=routeAt(makeRoute(2500),0);
 assert.equal(start.kind,'outer');assert.ok(start.x>0&&start.z<i.top);
 const split=SECTIONS.split;
 for(const s of [split-.01,split,split+.01]){
  assert.ok(Math.abs(widthAt('inner',s)-widthAt('outer',s))<.01);
 }
});
