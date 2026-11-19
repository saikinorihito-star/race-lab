import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Tests the *actual* current single-page application functions, not copied formulas.
const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function extract(name){
 const from=html.indexOf('function '+name+'(');
 assert.ok(from>=0,'Missing function: '+name);
 const end=html.slice(from).search(/\n\}(?=\n)/);
 assert.ok(end>=0,'Missing closing brace: '+name);
 return html.slice(from,from+end+2);
}
const SAFE=3.7,SEP=3.35;
const lane=runInNewContext('('+extract('pairRailLane')+')',{
 PAIR_RAIL_CENTER_CLEARANCE:SAFE,PAIR_LANE_SPACING:SEP
});
function makeReviewLane(four){
 return runInNewContext('('+extract('officialReviewLane')+')',{
  pairRailLane:lane,isOfficialFourTest:four,
  FOUR_START_OUTSIDE_OFFSET:8.0,FOUR_INWARD_SETTLE_DISTANCE:160,
  THREE:{MathUtils:{clamp:(x,min,max)=>Math.max(min,Math.min(max,x))}}
 });
}

test('2 and 4 official horses stay clear of the inner and outer turf rails',()=>{
 for(const width of [24,28,31,33,36,39,41]){
  for(const i of [0,1,2,3]){
   const position=lane(width,i);
   const innerClearance=width/2-position;
   const outerClearance=width/2+position;
   assert.ok(innerClearance>=SAFE-1e-9,{width,i,innerClearance});
   assert.ok(outerClearance>1.5,{width,i,outerClearance});
  }
 }
});

test('approved 2-horse review still follows its original stable lanes',()=>{
 for(const count of [2])for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const widthAt=d=>36+5*Math.sin(d/2083.1*Math.PI*2+.5);
  const raceHorses=Array.from({length:count},(_,i)=>({
   number:i+1,distance:0,postDistance:0,lane:lane(widthAt(0),i),
   speed:0,finished:false,finishTime:null
  }));
  const ctx={activePlan:{distance},raceFinished:[],raceElapsed:0,raceHorses,
   OFFICIAL_TEST_COUNT:count,isOfficialFourTest:false,
   fieldCenterAt:(_plan,d)=>({width:widthAt(d)}),
   pairRailLane:lane,officialReviewLane:makeReviewLane(count===4)};
  const step=runInNewContext('('+extract('stepOfficialPair')+')',ctx);
  let minCloseSpacing=Infinity;
  for(let tick=0;tick<24000&&ctx.raceFinished.length<count;tick++){
   step(1/60);
   const [h0,h1]=raceHorses;
   for(const [i,h] of raceHorses.entries()){
    assert.ok(widthAt(h.distance)/2-h.lane>=SAFE-1e-8,
     'Inner rail clearance: '+distance+'m, horse '+(i+1));
   }
   if(Math.abs(h0.distance-h1.distance)<4)
    minCloseSpacing=Math.min(minCloseSpacing,Math.abs(h0.lane-h1.lane));
  }
  assert.equal(ctx.raceFinished.length,count,'All '+count+' test horses finish '+distance+'m');
  assert.ok(minCloseSpacing>=3.2,'Close-range horse-to-horse clearance '+distance+'m');
 }
});

class Vec3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 clone(){return new Vec3(this.x,this.y,this.z)}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
 normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this}
 addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
}
const fakeThree={Vector3:Vec3,MathUtils:{
 lerp:(a,b,t)=>a+(b-a)*t,
 smoothstep:(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)},
 clamp:(x,a,b)=>Math.max(a,Math.min(b,x))
}};

test('2 and 4 horse tracking angles frame whole pack if close, leader if far',()=>{
 for(const count of [2,4])for(const mode of ['field','side','front3q','chase']){
  for(const aspect of [.58,.85,1.7]){
   for(const gap of [0,8,14,20,27,50,95]){
    const ctx={THREE:fakeThree,stage:{clientWidth:800*aspect,clientHeight:800},
     activePlan:{distance:1400},
     OFFICIAL_TEST_COUNT:count,isOfficialFourTest:count===4,isOfficialPairTest:true,
     groupCameraOffset:{yaw:0,pitch:0,zoom:1},
     raceHorses:Array.from({length:count},(_,i)=>({
      distance:200-(gap*i/(count-1)),postDistance:0,lane:12.3-i*3.35
     })),
     raceAccumulator:0,RACE_TICK:1/60,playing:false,
     pairRailLane:lane,officialReviewLane:makeReviewLane(count===4),fieldCenterAt:(_p,d)=>({p:new Vec3(d,0,0),t:new Vec3(1,0,0),width:36}),
     fieldCameraShot:()=>{throw Error('Unexpected fallback camera')}};
    ctx.officialPairVisualState=runInNewContext('('+extract('officialPairVisualState')+')',ctx);
    const camera=runInNewContext('('+extract('officialPairCameraShot')+')',ctx);
    const shot=camera(mode);
    const focusDistance=shot.target.x-1.4;
    assert.ok([shot.eye.x,shot.eye.y,shot.eye.z,shot.target.x,shot.target.y,shot.target.z]
     .every(Number.isFinite),'Camera output finite');
    if(gap<=14)assert.ok(Math.abs(focusDistance-(200-gap/2))<1e-6);
    if(gap>=27)assert.ok(Math.abs(focusDistance-195)<1e-6);
   }
  }
 }
});

test('official 2-horse visual position interpolates smoothly between 60Hz race ticks',()=>{
 const h={distance:50.27,prevDistance:50,postDistance:0,prevPostDistance:0,lane:0,speed:16};
 const step=1/60;
 const readings=[];
 for(const alpha of [0,.125,.25,.375,.50,.625,.75,.875,1]){
  const ctx={THREE:fakeThree,raceHorses:[h],activePlan:{distance:1400},
   playing:true,isOfficialFourTest:false,raceAccumulator:alpha*step,RACE_TICK:step,
   fieldCenterAt:(_p,d)=>({width:36}),pairRailLane:lane,
   officialReviewLane:makeReviewLane(false)};
  const state=runInNewContext('('+extract('officialPairVisualState')+')',ctx)(0);
  readings.push(state.distance);
  assert.ok(Math.abs(state.distance-(50+alpha*.27))<1e-7);
  assert.ok(Math.abs(state.lane-lane(36,0))<1e-7);
 }
 for(let i=1;i<readings.length;i++){
  assert.ok(readings[i]>readings[i-1],'No duplicate frozen draw poses inside a tick');
  assert.ok(readings[i]-readings[i-1]<.04,'No abrupt large step inside a tick');
 }
});

test('4-horse review approaches rail from 8m farther out and never turns away after settling',()=>{
 const four=makeReviewLane(true),two=makeReviewLane(false);
 for(const width of [31,36,41]){
  for(let horse=0;horse<4;horse++){
   const target=lane(width,horse);
   assert.ok(Math.abs(four(width,horse,0)-(target-8))<1e-9);
   assert.ok(Math.abs(four(width,horse,160)-target)<1e-9);
   assert.ok(Math.abs(four(width,horse,500)-target)<1e-9);
   let previous=-Infinity;
   for(let d=0;d<=220;d+=2){
    const pos=four(width,horse,d);
    assert.ok(pos>=previous-1e-8,'Inward lane must not reverse');
    assert.ok(width/2-pos>=SAFE-1e-8,'Rail clearance always >=3.7m');
    assert.ok(width/2+pos>1.5,'Outer rail remains clear');
    previous=pos;
   }
   assert.ok(Math.abs(two(width,horse,0)-target)<1e-9,'Approved 2-horse lanes unchanged');
  }
 }
});

test('render-time 4-horse inward movement is smoothly interpolated',()=>{
 const reviewLane=makeReviewLane(true);
 const h={distance:50.27,prevDistance:50,postDistance:0,prevPostDistance:0,speed:16,
  prevLane:reviewLane(36,0,50),lane:reviewLane(36,0,50.27)};
 let previous=-Infinity;
 for(const alpha of [0,.125,.25,.375,.5,.625,.75,.875,1]){
  const ctx={THREE:fakeThree,raceHorses:[h],activePlan:{distance:1400},
   isOfficialFourTest:true,playing:true,raceAccumulator:alpha/60,RACE_TICK:1/60,
   fieldCenterAt:(_p,d)=>({width:36}),officialReviewLane:reviewLane};
  const state=runInNewContext('('+extract('officialPairVisualState')+')',ctx)(0);
  assert.ok(Math.abs(state.lane-(h.prevLane+(h.lane-h.prevLane)*alpha))<1e-9);
  assert.ok(state.lane>previous,'Inward lateral motion is continuous between simulation ticks');
  previous=state.lane;
 }
});

test('4-horse render defaults to sharp antialiasing with adjustable fallback',()=>{
 assert.match(html,/new THREE\.WebGLRenderer\(\{antialias:true,/);
 assert.match(html,/const renderDprLevels=\{sharp:1\.35,standard:1\.05,light:\.90\}/);
 assert.match(html,/renderQuality\.addEventListener\('change',applyRenderQuality\)/);
 assert.match(html,/cloneSkeleton\(source\)/);
 assert.match(html,/h\.mixer\.setTime\(shownTime\*Math\.min\(2,Number\(rate\.value\)\)\+i\*\.07\)/);
});

test('4-horse clone count and safe independent animation loop use test count',()=>{
 assert.match(extract('initializeOfficialPair'),/for\(let i=0;i<OFFICIAL_TEST_COUNT;i\+\+\)/);
 assert.match(extract('updateOfficialPair'),/for\(let i=0;i<OFFICIAL_TEST_COUNT;i\+\+\)/);
 assert.match(extract('stepOfficialPair'),/raceFinished\.length>=OFFICIAL_TEST_COUNT/);
 assert.match(html,/const OFFICIAL_TEST_COUNT=isOfficialFourTest\?4:2;/);
 assert.match(html,/official-meshy-blue-ribbon-original-geometry-gallop-v2-20261119/);
});

test('manual camera direction and zoom change the tracking eye but preserve its target',()=>{
 const ctx={THREE:fakeThree,stage:{clientWidth:430,clientHeight:800},
  OFFICIAL_TEST_COUNT:4,isOfficialFourTest:true,isOfficialPairTest:true,
  raceHorses:Array.from({length:4},(_,i)=>({distance:200-i*2,postDistance:0,lane:12.3-i*3.35})),
  raceAccumulator:0,RACE_TICK:1/60,playing:false,activePlan:{distance:1400},
  groupCameraOffset:{yaw:0,pitch:0,zoom:1},pairRailLane:lane,
  officialReviewLane:makeReviewLane(true),
  fieldCenterAt:(_p,d)=>({p:new Vec3(d,0,0),t:new Vec3(1,0,0),width:36}),
  fieldCameraShot:()=>{throw Error('Unexpected fallback')}};
 ctx.officialPairVisualState=runInNewContext('('+extract('officialPairVisualState')+')',ctx);
 const camera=runInNewContext('('+extract('officialPairCameraShot')+')',ctx);
 const adjust=runInNewContext('('+extract('adjustGroupCamera')+')',ctx);
 const start=camera('field');
 adjust('right');adjust('up');adjust('near');
 const changed=camera('field');
 const delta= Math.hypot(changed.eye.x-start.eye.x,changed.eye.y-start.eye.y,changed.eye.z-start.eye.z);
 assert.ok(delta>1,'User adjustments must not be overwritten by auto tracking');
 assert.ok(Math.abs(changed.target.x-start.target.x)<1e-8,'Tracking focus remains stable');
 adjust('reset');
 const reset=camera('field');
 assert.ok(Math.hypot(reset.eye.x-start.eye.x,reset.eye.y-start.eye.y,reset.eye.z-start.eye.z)<1e-7);
});

test('persistent in-video run control reflects play, pause, resume and completion',()=>{
 const button={textContent:'',disabled:false,attributes:{},
  setAttribute(k,v){this.attributes[k]=v}};
 const ctx={isOfficialPairTest:true,OFFICIAL_TEST_COUNT:4,raceFinished:[],
  raceElapsed:0,playing:false,installedDesign01:false,stageStartBtn:button};
 const sync=()=>runInNewContext('('+extract('syncStageStartButton')+')',ctx)();
 sync();assert.equal(button.textContent,'▶ スタート');assert.equal(button.disabled,true);
 ctx.installedDesign01=true;ctx.playing=true;sync();
 assert.equal(button.textContent,'⏸ 一時停止');assert.equal(button.disabled,false);
 ctx.playing=false;ctx.raceElapsed=1;sync();assert.equal(button.textContent,'▶ 再開');
 ctx.raceFinished=[1,2,3,4];sync();assert.equal(button.textContent,'↻ もう一度');
 assert.match(html,/stageStartBtn\.addEventListener\('click'/);
 assert.match(html,/if\(isOfficialPairTest\?raceFinished\.length>=OFFICIAL_TEST_COUNT:/);
});

test('4-horse inward heading follows the actual lateral speed without allowing extreme yaw',()=>{
 const slope=runInNewContext('('+extract('fourHorseInwardSlope')+')',{
  isOfficialFourTest:true,FOUR_START_OUTSIDE_OFFSET:8,
  FOUR_INWARD_SETTLE_DISTANCE:160
 });
 const oldSlope=runInNewContext('('+extract('fourHorseInwardSlope')+')',{
  isOfficialFourTest:false,FOUR_START_OUTSIDE_OFFSET:8,
  FOUR_INWARD_SETTLE_DISTANCE:160
 });
 assert.ok(Math.abs(slope(0))<1e-10);
 assert.ok(Math.abs(slope(160))<1e-10);
 assert.ok(Math.abs(slope(500))<1e-10);
 assert.ok(Math.abs(slope(80)-.075)<1e-10);
 for(let d=0;d<=160;d+=5){
  assert.ok(slope(d)>=0,'Do not turn outward');
  assert.ok(slope(d)<=.07500001,'Natural inward heading angle');
  assert.equal(oldSlope(d),0,'Preserve accepted two-horse heading');
 }
 assert.match(extract('updateOfficialPair'),/state\.sideSpeed\/Math\.max\(4,state\.speed\)/);
 assert.match(extract('updateOfficialPair'),/isOfficialFourTest\?/);
});

function runActualFourHorseSimulation(distance){
 const profiles=html.match(/const FOUR_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 assert.ok(profiles,'Four-horse profiles missing');
 const code=['pairRailLane','officialReviewLane','fourHorseDesiredSlot',
  'fourHorseSafeStep','stepOfficialPair'].map(extract).join('\n');
 const source=`(()=>{
 const THREE={MathUtils:{clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v))}};
 const PAIR_RAIL_CENTER_CLEARANCE=3.7,PAIR_LANE_SPACING=3.35,
 FOUR_START_OUTSIDE_OFFSET=8,FOUR_INWARD_SETTLE_DISTANCE=160,
 FOUR_MIN_LONGITUDINAL=4.8,FOUR_LATERAL_SHARED=3.05,
 FOUR_INWARD_RATE=4.4,
 isOfficialFourTest=true,OFFICIAL_TEST_COUNT=4;
 ${profiles}
 ${code}
 const activePlan={distance:trackDistance};
 const fieldCenterAt=(_p,d)=>({width:36+5*Math.sin(d/2083.1*Math.PI*2+.5)});
 let raceElapsed=0,raceFinished=[];
 const raceHorses=Array.from({length:4},(_,i)=>({
  idx:i,number:i+1,distance:0,postDistance:0,speed:0,finished:false,
  finishTime:null,slot:i,nextLaneReviewTime:0,
  lane:officialReviewLane(fieldCenterAt(activePlan,0).width,i,0)
 }));
 const snapshots={},mark=[100,200,400,800];
 let minActiveCenterDistance=Infinity,minRailClearance=Infinity,
  maxLateralSpeed=0,stackedFrames=0,outwardSlotChanges=0,maxFrontGap=0;
 const lastSlots=[0,1,2,3];
 for(let t=0;t<24000&&raceFinished.length<4;t++){
  stepOfficialPair(1/60);
  const leader=Math.max(...raceHorses.map(h=>h.distance));
  for(const m of mark)if(!snapshots[m]&&leader>=m)
   snapshots[m]=raceHorses.map(h=>({d:h.distance,lane:h.lane,slot:h.slot}));
  for(const h of raceHorses){
   minRailClearance=Math.min(minRailClearance,
    fieldCenterAt(activePlan,h.distance).width/2-h.lane);
   maxLateralSpeed=Math.max(maxLateralSpeed,Math.abs(h.sideSpeed||0));
   if(h.slot>lastSlots[h.idx])outwardSlotChanges++;
   lastSlots[h.idx]=h.slot;
  }
  const active=raceHorses.filter(h=>!h.finished);
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j],long=Math.abs(a.distance-b.distance);
   const lateral=Math.abs(a.lane-b.lane);
   minActiveCenterDistance=Math.min(minActiveCenterDistance,Math.hypot(long,lateral));
   if(lateral<3.05&&long>=4.8&&long<20)stackedFrames++;
  }
 }
 return {finished:raceFinished.length,minActiveCenterDistance,
  minRailClearance,maxLateralSpeed,stackedFrames,outwardSlotChanges,
  snapshots,finishTimes:raceHorses.map(h=>h.finishTime)};
 })()`;
 return runInNewContext(source,{trackDistance:distance});
}

test('actual four-horse formation creates nose-to-tail stacking, safe overtakes and no weaving',()=>{
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const r=runActualFourHorseSimulation(distance);
  assert.equal(r.finished,4,'All four must reach the finish at '+distance+'m');
  assert.ok(r.minRailClearance>=3.7-1e-8,'No horse meets the inside rail');
  assert.ok(r.minActiveCenterDistance>=3.0,'No active horse overlap');
  assert.ok(r.maxLateralSpeed<=4.401,'Sideways speed capped at 4.4m/s');
  assert.equal(r.outwardSlotChanges,0,'No rapid outward-inward lane oscillation');
  assert.ok(r.stackedFrames>100,'Must visibly queue nose-to-tail at some stage');
  const start=r.snapshots[100].map(h=>h.d);
  assert.ok(Math.max(...start)-Math.min(...start)<25,
   'All horses should stay in the lead camera's visible formation at 100m');
  const widthAtStart=36+5*Math.sin(.5);
  const outsideStart=makeReviewLane(true)(widthAtStart,3,0);
  assert.ok(r.snapshots[100][3].lane-outsideStart>12,
   'The outermost horse must rush inward by more than 3 traditional lanes by 100m');
  assert.equal(r.snapshots[200][1].slot,0,
   'Stalker should reach the inner lane behind the leader by 200m');
  assert.equal(r.snapshots[200][3].slot,0,
   'Outermost horse can reach the inner lane when a safe gap appears');
 }
});

test('four-horse role order displays independently of the approved source saddlecloth',()=>{
 assert.match(html,/現在の隊列：/);
 assert.match(html,/ゼッケン4は正式デザインのままです。/);
 assert.match(html,/h\.role=\['逃げ','先行','差し','追込'\]\[i\]/);
 assert.match(html,/const FOUR_PACE_PROFILES=\[/);
 assert.match(html,/FOUR_MIN_LONGITUDINAL=4\.8,FOUR_LATERAL_SHARED=3\.05/);
 assert.match(html,/const FOUR_INWARD_RATE=4\.4/);
});

test('unobstructed outermost horse reaches real innermost lane promptly',()=>{
 const width=38.4;
 const ctx={THREE:fakeThree,activePlan:{distance:1400},
  FOUR_INWARD_RATE:4.4,FOUR_MIN_LONGITUDINAL:4.8,FOUR_LATERAL_SHARED:3.05,
  PAIR_RAIL_CENTER_CLEARANCE:3.7,PAIR_LANE_SPACING:3.35,
  FOUR_PACE_PROFILES:[{accel:3.42},{accel:3.15},{accel:3.32},{accel:3.1}],
  fieldCenterAt:(_p,d)=>({width}),pairRailLane:lane};
 ctx.fourHorseDesiredSlot=runInNewContext('('+extract('fourHorseDesiredSlot')+')',ctx);
 const advance=runInNewContext('('+extract('fourHorseSafeStep')+')',ctx);
 const start=makeReviewLane(true)(width,3,0);
 const h={idx:3,distance:0,lane:start,speed:0};
 for(let tick=0;tick<900&&h.distance<95;tick++){
  const next=advance(h,[],1/60,15.95);
  Object.assign(h,next);
 }
 const target=lane(width,0);
 assert.ok(h.distance>=95,'The unblocked outermost horse should make forward progress');
 assert.ok(Math.abs(h.lane-target)<.11,'In an empty corridor the outside horse must reach the innermost safety lane by 95m');
 assert.ok(h.lane-start>17.8,'Inward rush covers the full original outside-to-inside range');
});

test('horse alongside must not cut across a nearby occupied lane',()=>{
 const width=38.4;
 const ctx={THREE:fakeThree,activePlan:{distance:1400},
  FOUR_INWARD_RATE:4.4,FOUR_MIN_LONGITUDINAL:4.8,FOUR_LATERAL_SHARED:3.05,
  FOUR_PACE_PROFILES:[{accel:3.42},{accel:3.15},{accel:3.32},{accel:3.1}],
  fieldCenterAt:(_p,d)=>({width}),pairRailLane:lane};
 ctx.fourHorseDesiredSlot=runInNewContext('('+extract('fourHorseDesiredSlot')+')',ctx);
 const step=runInNewContext('('+extract('fourHorseSafeStep')+')',ctx);
 const horse={idx:3,distance:45,speed:12,lane:.28};
 const inside={idx:1,distance:47,speed:12,lane:3.35,finished:false};
 const blocked=step(horse,[inside],1/60,15.95);
 assert.ok(blocked.lane<=inside.lane-3.05+1e-7,
  'Do not enter a lane occupied by a horse within 2m longitudinally');
 const free=step(horse,[{...inside,distance:60}],1/60,15.95);
 assert.ok(free.lane>blocked.lane+.01,'Move directly inward once the gap is clear');
});
