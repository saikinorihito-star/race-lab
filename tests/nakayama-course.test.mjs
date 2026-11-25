import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SPEC,DISTANCES,LOOPS,SECTIONS,at,altitude,widthAt,makeRoute,routeAt,gradeAt,laneAt,measureRoute,curvatureAt,courseLandmarks,DIRT_SPEC,DIRT_MODEL_LENGTH,dirtAt,railSpec,railSections,railStation} from '../nakayama-course.mjs';
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
 assert.deepEqual(makeRoute(4000).legs.map(l=>l.kind),['chute','outer','outer','outer']);
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

test('first turn and extended straight starts conform to published approximate approach distances',()=>{
 near(SECTIONS.firstTurn,72.1);
 for(const [d,expected] of [[1800,205],[2000,405],[2200,432]]){
  const route=makeRoute(d),entry=courseLandmarks(d)[0].distance;
  near(entry,expected,.5);
  const q=routeAt(route,entry);near(q.station,SECTIONS.firstTurn);
  near(q.z,0,.01);
  for(let s=0;s<entry;s+=2){const p=routeAt(route,s);near(p.z,0,.001);near(p.tx,-1,.001);}
 }
 for(const d of [2000,2200,4000])assert.equal(makeRoute(d).legs[0].kind,'chute');
});
test('shared pocket geometry, descending grade and outer 1200m descent',()=>{
 const a=makeRoute(1600),b=makeRoute(3200),length=a.legs[0].length;
 assert.equal(a.legs[0].joinStation,b.legs[0].joinStation);
 const offset=length-b.legs[0].length;
 for(let i=0;i<b.legs[0].length;i+=1){
  const p=routeAt(a,i+offset),q=routeAt(b,i);near(p.x,q.x);near(p.z,q.z);near(p.y,q.y);near(p.width,q.width);
 }
 assert.ok(gradeAt(a,10)<0);
 near(routeAt(a,length-.001).y,routeAt(a,length+.001).y,.001);
 const r=makeRoute(1200);near(routeAt(r,0).y-routeAt(r,890).y,4.4);
 const arima=makeRoute(2500),merge=courseLandmarks(2500)[0].distance;
 near(merge,192,5);assert.ok(routeAt(arima,0).y>routeAt(arima,merge).y);
});
test('all routes preserve reference distance, physical grades, finite curvature and lateral travel',()=>{
 for(const d of DISTANCES){
  const r=makeRoute(d),ref=measureRoute(r),outer=measureRoute(r,5),center=measureRoute(r,'center');
  near(ref.horizontal,d,.01);assert.ok(ref.surface>=ref.horizontal);
  assert.ok(outer.horizontal>ref.horizontal&&center.horizontal>ref.horizontal);
  for(let s=0;s<=d;s+=2){
   const p=laneAt(r,s,5);assert.ok(p.offset>=0&&p.offset<=p.width-2);
   assert.ok(Math.abs(gradeAt(r,s))<=2.241);
   assert.ok(Number.isFinite(curvatureAt(r,s)));
  }
 }
 const r=makeRoute(2500);assert.ok(measureRoute(r,5).extra>40&&measureRoute(r,5).extra<50);
});
test('independent dirt scenery respects published lap, straight, relief and width',()=>{
 near(DIRT_MODEL_LENGTH,1493);let lo=Infinity,hi=-Infinity,prev=dirtAt(0),len=0;
 for(let i=1;i<=DIRT_SPEC.lap;i++){
  const p=dirtAt(i);len+=Math.hypot(p.x-prev.x,p.z-prev.z);
  lo=Math.min(lo,p.y);hi=Math.max(hi,p.y);
  assert.ok(p.width>=20&&p.width<=25);prev=p;
 }
 near(len,1493,.01);near(hi-lo,4.5,.001);
 const a=dirtAt(0),b=dirtAt(1493-308);near(Math.hypot(a.x-b.x,a.z-b.z),308,.01);
});

test('1600m straight and 2500m entry are straight in the geometry, not merely numeric labels',()=>{
 function straightCheck(r,d){
  const a=routeAt(r,0);
  for(let i=0;i<d;i+=.5){
   const b=routeAt(r,i);
   near((b.x-a.x)*a.tz-(b.z-a.z)*a.tx,0,.005);
   near(Math.hypot(b.x-a.x,b.z-a.z),i,.005);
  }
 }
 const mile=makeRoute(1600),first=courseLandmarks(1600)[0].distance;
 near(first,240,.5);straightCheck(mile,240);
 const arima=makeRoute(2500);straightCheck(arima,190);
 near(courseLandmarks(2500)[0].distance,192,5);
 for(const k of ['inner','outer'])for(const s of [SECTIONS.split,SECTIONS[k==='inner'?'mergeInner':'mergeOuter']]){
  const a=at(k,s-.01),b=at(k,s+.01);
  const angle=Math.abs(Math.atan2(a.tx*b.tz-a.tz*b.tx,a.tx*b.tx+a.tz*b.tz)*180/Math.PI);
  assert.ok(angle<.1,'junction tangent angle '+angle);
  near(a.y,b.y,.001);
 }
});
test('A/B/C rail shift, official widths, lap lengths and all 30 routes',()=>{
 const expected={A:[0,1667.1,1839.7,20,24,32],B:[3,1686,1858.5,17,21,29],C:[6,1704.8,1877.3,14,18,26]};
 for(const [rail,[offset,inner,outer,minI,minO,maxW]] of Object.entries(expected)){
  const spec=railSpec(rail),sec=railSections(rail);
  near(spec.offset,offset);near(spec.innerLap,inner);near(spec.outerLap,outer);
  for(const [k,lap,min] of [['inner',inner,minI],['outer',outer,minO]]){
   const g=at(k,0,rail),h=at(k,lap-310,rail);
   near(g.z,offset,.001);near(Math.hypot(g.x-h.x,g.z-h.z),310,.01);
   let lo=Infinity,hi=-Infinity,minW=Infinity,maxWidth=0,last=g,total=0;
   for(let s=1;s<=Math.ceil(lap);s++){
    const p=at(k,Math.min(s,lap),rail),w=widthAt(k,Math.min(s,lap),rail);
    total+=Math.hypot(p.x-last.x,p.z-last.z);last=p;
    lo=Math.min(lo,p.y);hi=Math.max(hi,p.y);minW=Math.min(minW,w);maxWidth=Math.max(maxWidth,w);
    assert.ok(w>=min-.001&&w<=maxW+.001);
   }
   near(total,lap,.13);near(hi-lo,5.3,.025);near(minW,min,.025);near(maxWidth,maxW,.025);
   const base=at(k,SECTIONS.split, 'A'),moved=at(k,railStation(k,SECTIONS.split,rail),rail);
   near(Math.hypot(moved.x-base.x,moved.z-base.z),offset,.01);
  }
  for(const d of DISTANCES){
   const r=makeRoute(d,rail),ref=measureRoute(r);
   near(r.legs.reduce((sum,l)=>sum+l.length,0),d,.001);
   near(ref.horizontal,d,.25);
   near(routeAt(r,d).x,0,.001);near(routeAt(r,d).z,offset,.001);
   near(routeAt(r,d-70).y-routeAt(r,d-180).y,2.2,.005);
   let last=routeAt(r,0),peak=0;
   for(let s=1;s<=d;s++){
    const p=routeAt(r,s);assert.ok(Math.hypot(p.x-last.x,p.z-last.z)<=1.015);
    peak=Math.max(peak,gradeAt(r,s));last=p;
   }
   near(peak,2.24,.003);
   assert.ok(measureRoute(r,5).horizontal>ref.horizontal);
  }
  const a=at('inner',sec.split,rail),b=at('outer',sec.split,rail);
  near(a.x,b.x,.01);near(a.z,b.z,.01);near(a.y,b.y,.01);
 }
});
