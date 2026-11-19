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
const SAFE=3.7,FOUR_SAFE=2.8,SEP=3.35;
const lane=runInNewContext('('+extract('pairRailLane')+')',{
 PAIR_RAIL_CENTER_CLEARANCE:SAFE,PAIR_LANE_SPACING:SEP
});
const fourInnerLane=runInNewContext('('+extract('fourHorseInnerLane')+')',{
 FOUR_RAIL_CENTER_CLEARANCE:FOUR_SAFE
});
function makeReviewLane(four){
 return runInNewContext('('+extract('officialReviewLane')+')',{
  pairRailLane:lane,fourHorseInnerLane:fourInnerLane,PAIR_LANE_SPACING:SEP,isOfficialFourTest:four,
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
   OFFICIAL_TEST_COUNT:count,isOfficialFourTest:false,isOfficialEighteenTest:false,isOfficialMultiTest:false,isOfficialEightTest:false,isOfficialEighteenTest:false,
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
     OFFICIAL_TEST_COUNT:count,isOfficialFourTest:count===4,isOfficialMultiTest:count===4,isOfficialEightTest:false,isOfficialEighteenTest:false,isOfficialPairTest:true,
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
   playing:true,isOfficialFourTest:false,isOfficialEighteenTest:false,isOfficialMultiTest:false,raceAccumulator:alpha*step,RACE_TICK:step,
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
   const target=fourInnerLane(width)-horse*SEP;
   assert.ok(Math.abs(four(width,horse,0)-(target-8))<1e-9);
   assert.ok(Math.abs(four(width,horse,160)-target)<1e-9);
   assert.ok(Math.abs(four(width,horse,500)-target)<1e-9);
   let previous=-Infinity;
   for(let d=0;d<=220;d+=2){
    const pos=four(width,horse,d);
    assert.ok(pos>=previous-1e-8,'Inward lane must not reverse');
    assert.ok(width/2-pos>=FOUR_SAFE-1e-8,'4-horse clearance >=2.8m');
    assert.ok(width/2+pos>1.5,'Outer rail remains clear');
    previous=pos;
   }
   assert.ok(Math.abs(two(width,horse,0)-lane(width,horse))<1e-9,'Approved 2-horse lanes unchanged');
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
   isOfficialFourTest:true,isOfficialEighteenTest:false,isOfficialMultiTest:true,playing:true,raceAccumulator:alpha/60,RACE_TICK:1/60,
   fieldCenterAt:(_p,d)=>({width:36}),officialReviewLane:reviewLane};
  const state=runInNewContext('('+extract('officialPairVisualState')+')',ctx)(0);
  assert.ok(Math.abs(state.lane-(h.prevLane+(h.lane-h.prevLane)*alpha))<1e-9);
  assert.ok(state.lane>previous,'Inward lateral motion is continuous between simulation ticks');
  previous=state.lane;
 }
});

test('4-horse render defaults to sharp antialiasing with adjustable fallback',()=>{
 assert.match(html,/new THREE\.WebGLRenderer\(\{antialias:!\(isOfficialEightTest\|\|isOfficialEighteenTest\),/);
 assert.match(html,/const renderDprLevels=isOfficialEighteenTest\?\{sharp:1\.80,standard:1\.35,light:1\.05\}:\{sharp:1\.35,standard:1\.05,light:\.90\}/);
 assert.match(html,/renderQuality\.addEventListener\('change',\(\)=>\{/);
 assert.match(html,/cloneSkeleton\(source\)/);
 assert.match(html,/h\.mixer\.setTime\(gaitTime\)/);
 assert.match(html,/const gaitTime=isOfficialMultiTest\?/);
});

test('4-horse clone count and safe independent animation loop use test count',()=>{
 assert.match(extract('initializeOfficialPair'),/for\(let i=0;i<OFFICIAL_TEST_COUNT;i\+\+\)/);
 assert.match(extract('updateOfficialPair'),/for\(let i=0;i<OFFICIAL_TEST_COUNT;i\+\+\)/);
 assert.match(extract('stepOfficialPair'),/raceFinished\.length>=OFFICIAL_TEST_COUNT/);
 assert.match(html,/const OFFICIAL_TEST_COUNT=isOfficialEighteenTest\?18:isOfficialEightTest\?8:isOfficialFourTest\?4:2;/);
 assert.match(html,/official-meshy-blue-ribbon-original-geometry-gallop-v2-20261119/);
});

test('manual camera direction and zoom change the tracking eye but preserve its target',()=>{
 const ctx={THREE:fakeThree,stage:{clientWidth:430,clientHeight:800},
  OFFICIAL_TEST_COUNT:4,isOfficialFourTest:true,isOfficialMultiTest:true,isOfficialEightTest:false,isOfficialEighteenTest:false,isOfficialPairTest:true,
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
 const ctx={isOfficialPairTest:true,isOfficialEighteenTest:false,
  OFFICIAL_TEST_COUNT:4,raceFinished:[],officialPair:[],
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
 assert.match(extract('updateOfficialPair'),/state\.sideSpeed\/Math\.max\(\.5,state\.speed\)/);
 assert.match(extract('updateOfficialPair'),/,-\.30,\.30/);
 assert.match(extract('updateOfficialPair'),/isOfficialMultiTest\?/);
});

function runActualFourHorseSimulation(distance,widthMode='standard'){
 const profiles=html.match(/const FOUR_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 assert.ok(profiles,'Four-horse profiles missing');
 const code=['pairRailLane','fourHorseInnerLane','officialReviewLane','fourHorseDesiredSlot',
  'fourHorseSafeStep','stepOfficialPair'].map(extract).join('\n');
 const source=`(()=>{
 const THREE={MathUtils:{clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v))}};
 const PAIR_RAIL_CENTER_CLEARANCE=3.7,PAIR_LANE_SPACING=3.35,
  FOUR_RAIL_CENTER_CLEARANCE=2.8,
 FOUR_START_OUTSIDE_OFFSET=8,FOUR_INWARD_SETTLE_DISTANCE=160,
 FOUR_MIN_LONGITUDINAL=4.8,FOUR_LATERAL_SHARED=3.05,
 FOUR_INWARD_RATE=4.4,FOUR_MAX_LATERAL_PER_FORWARD=.30,
 isOfficialFourTest=true,isOfficialMultiTest=true,isOfficialEightTest=false,isOfficialEighteenTest=false,OFFICIAL_TEST_COUNT=4;
 ${profiles}
 ${code}
 const activePlan={distance:trackDistance};
 const fieldCenterAt=(_p,d)=>({
  width:widthMode==='pocket24'?
   (d<240?24:d<300?24+12*(d-240)/60:36):
   widthMode==='pocket28'?
    (d<240?28:d<300?28+8*(d-240)/60:36):
    36+5*Math.sin(d/2083.1*Math.PI*2+.5)
 });
 let raceElapsed=0,raceFinished=[];
 const raceHorses=Array.from({length:4},(_,i)=>({
  idx:i,number:i+1,distance:0,postDistance:0,speed:0,finished:false,
  finishTime:null,slot:i,nextLaneReviewTime:0,
  lane:officialReviewLane(fieldCenterAt(activePlan,0).width,i,0)
 }));
 const snapshots={},mark=[100,200,400,800];
 let minActiveCenterDistance=Infinity,minRailClearance=Infinity,
  maxLateralSpeed=0,stackedFrames=0,outwardSlotChanges=0,maxFrontGap=0,
  maxInwardToForwardRatio=0,sidewaysWhileStopped=0,
  frozenEarlyFinishers=0,lowInRaceSpeedFrames=0,minimumInRaceSpeed=Infinity,
  longestPostFinishDistance=0,postFinishForwardFrames=0;
 const lastSlots=[0,1,2,3];
 for(let t=0;t<24000&&raceFinished.length<4;t++){
  const before=raceHorses.map(h=>({distance:h.distance,lane:h.lane,
   postDistance:h.postDistance||0,finished:h.finished}));
  stepOfficialPair(1/60);
  const leader=Math.max(...raceHorses.map(h=>h.distance));
  for(const [i,h] of raceHorses.entries()){
   if(before[i].finished&&raceFinished.length<4){
    const coast=h.postDistance-before[i].postDistance;
    if(coast<.01)frozenEarlyFinishers++;
    else postFinishForwardFrames++;
   }
   longestPostFinishDistance=Math.max(longestPostFinishDistance,h.postDistance||0);
   if(!h.finished&&h.distance>20){
    minimumInRaceSpeed=Math.min(minimumInRaceSpeed,h.speed);
    if(h.speed<8)lowInRaceSpeedFrames++;
   }
   if(before[i].finished||h.finished)continue;
   const forward=h.distance-before[i].distance;
   const inward=Math.max(0,h.lane-before[i].lane);
   if(inward>1e-7){
    maxInwardToForwardRatio=Math.max(maxInwardToForwardRatio,
     inward/Math.max(1e-7,forward));
    if(forward<1e-7)sidewaysWhileStopped++;
   }
  }
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
  maxInwardToForwardRatio,sidewaysWhileStopped,
  frozenEarlyFinishers,lowInRaceSpeedFrames,minimumInRaceSpeed,
  longestPostFinishDistance,postFinishForwardFrames,
  snapshots,finishTimes:raceHorses.map(h=>h.finishTime)};
 })()`;
 return runInNewContext(source,{trackDistance:distance,widthMode});
}

test('actual four-horse formation creates nose-to-tail stacking, safe overtakes and no weaving',()=>{
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const r=runActualFourHorseSimulation(distance);
  assert.equal(r.finished,4,'All four must reach the finish at '+distance+'m');
  assert.ok(r.minRailClearance>=FOUR_SAFE-1e-8,'Four-horse clearance');
  assert.ok(r.minActiveCenterDistance>=3.0,'No active horse overlap');
  assert.ok(r.maxLateralSpeed<=4.401,'Sideways speed capped at 4.4m/s');
  assert.ok(r.maxInwardToForwardRatio<=.300001,'Diagonal path cannot exceed a 0.30 inward/forward slope');
  assert.equal(r.sidewaysWhileStopped,0,'No stationary sideways sliding');
  assert.equal(r.frozenEarlyFinishers,0,
   'No finished horse may freeze while any of the four is still racing');
  assert.equal(r.lowInRaceSpeedFrames,0,
   'Horses must not suddenly stop or crawl before the goal after 20m');
  assert.ok(r.minimumInRaceSpeed>10,
   'Maintain smooth forward progression before the finish');
  assert.ok(r.postFinishForwardFrames>0,
   'At least one early finisher must keep moving while other horses race');
  assert.ok(r.longestPostFinishDistance>24,
   'Four-horse race must not have the former 24m post-finish stop');
  assert.equal(r.outwardSlotChanges,0,'No rapid outward-inward lane oscillation');
  assert.ok(r.stackedFrames>100,'Must visibly queue nose-to-tail at some stage');
  const start=r.snapshots[100].map(h=>h.d);
  assert.ok(Math.max(...start)-Math.min(...start)<25,
   'All horses should stay visible near the lead at 100m');
  const widthAtStart=36+5*Math.sin(.5);
  const outsideStart=makeReviewLane(true)(widthAtStart,3,0);
  assert.ok(r.snapshots[100][3].lane-outsideStart>12,
   'The outermost horse must rush inward by more than 3 traditional lanes by 100m');
  assert.equal(r.snapshots[200][1].slot,0,
   'Stalker should reach the inner lane behind the leader by 200m');
  const outsideAt200=r.snapshots[200][3];
  const localWidthAt200=36+5*Math.sin(outsideAt200.d/2083.1*Math.PI*2+.5);
  const remainingToInner=fourInnerLane(localWidthAt200)-outsideAt200.lane;
  assert.ok(remainingToInner<7.5,
   'The outside horse moves across several lanes promptly, but does not cut through traffic');
 }
});

test('four-horse role order displays independently of the approved source saddlecloth',()=>{
 assert.match(html,/現在の隊列：/);
 assert.match(html,/ゼッケン4は正式デザインのままです。/);
 assert.match(html,/h\.role=isOfficialEighteenTest\?EIGHTEEN_PACE_PROFILES\[i\]\.role:/);
 assert.match(html,/const FOUR_PACE_PROFILES=\[/);
 assert.match(html,/FOUR_MIN_LONGITUDINAL=4\.8,FOUR_LATERAL_SHARED=3\.05/);
 assert.match(html,/const FOUR_INWARD_RATE=4\.4/);
});

test('unobstructed outermost horse reaches real innermost lane promptly',()=>{
 const width=38.4;
 const ctx={THREE:fakeThree,activePlan:{distance:1400},
  FOUR_INWARD_RATE:4.4,FOUR_MIN_LONGITUDINAL:4.8,FOUR_LATERAL_SHARED:3.05,
  FOUR_MAX_LATERAL_PER_FORWARD:.30,
  PAIR_RAIL_CENTER_CLEARANCE:3.7,PAIR_LANE_SPACING:3.35,
  FOUR_PACE_PROFILES:[{accel:3.42},{accel:3.15},{accel:3.32},{accel:3.1}],
  fieldCenterAt:(_p,d)=>({width}),pairRailLane:lane,fourHorseInnerLane:fourInnerLane};
 ctx.fourHorseDesiredSlot=runInNewContext('('+extract('fourHorseDesiredSlot')+')',ctx);
 const advance=runInNewContext('('+extract('fourHorseSafeStep')+')',ctx);
 const start=makeReviewLane(true)(width,3,0);
 const h={idx:3,distance:0,lane:start,speed:0};
 for(let tick=0;tick<900&&h.distance<95;tick++){
  const next=advance(h,[],1/60,15.95);
  Object.assign(h,next);
 }
 const target=fourInnerLane(width);
 assert.ok(h.distance>=95,'The unblocked outermost horse should make forward progress');
 assert.ok(Math.abs(h.lane-target)<.11,'In an empty corridor the outside horse must reach the innermost safety lane by 95m');
 assert.ok(h.lane-start>17.8,'Inward rush covers the full original outside-to-inside range');
});

test('horse alongside must not cut across a nearby occupied lane',()=>{
 const width=38.4;
 const ctx={THREE:fakeThree,activePlan:{distance:1400},
  FOUR_INWARD_RATE:4.4,FOUR_MIN_LONGITUDINAL:4.8,FOUR_LATERAL_SHARED:3.05,
  FOUR_MAX_LATERAL_PER_FORWARD:.30,
  FOUR_PACE_PROFILES:[{accel:3.42},{accel:3.15},{accel:3.32},{accel:3.1}],
  fieldCenterAt:(_p,d)=>({width}),pairRailLane:lane,fourHorseInnerLane:fourInnerLane};
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

test('four-horse gait phase advances with actual forward metres, not elapsed stationary time',()=>{
 const update=extract('updateOfficialPair');
 assert.match(update,/const gaitTime=isOfficialMultiTest\?/);
 assert.match(update,/\(state\.distance\+\(state\.postDistance\|\|0\)\)\/16\.0\+i\*\.07/);
 assert.match(update,/h\.mixer\.setTime\(gaitTime\)/);
 assert.match(update,/shownTime\*Math\.min\(2,Number\(rate\.value\)\)\+i\*\.07/);
});

test('traffic stop also stops lateral movement on the same tick',()=>{
 const width=38.4;
 const ctx={THREE:fakeThree,activePlan:{distance:1400},
  FOUR_INWARD_RATE:4.4,FOUR_MAX_LATERAL_PER_FORWARD:.30,
  FOUR_MIN_LONGITUDINAL:4.8,FOUR_LATERAL_SHARED:3.05,
  FOUR_PACE_PROFILES:[{accel:3.42},{accel:3.15},{accel:3.32},{accel:3.1}],
  fieldCenterAt:(_p,d)=>({width}),pairRailLane:lane,fourHorseInnerLane:fourInnerLane};
 ctx.fourHorseDesiredSlot=runInNewContext('('+extract('fourHorseDesiredSlot')+')',ctx);
 const step=runInNewContext('('+extract('fourHorseSafeStep')+')',ctx);
 const h={idx:3,distance:45,lane:.28,speed:11};
 const ahead={idx:1,distance:47,speed:0,lane:.28,finished:false};
 const moved=step(h,[ahead],1/60,15.95);
 assert.ok(moved.distance>=h.distance,'Never reverse');
 assert.ok(moved.lane-h.lane<=.30*(moved.distance-h.distance)+1e-9,
  'Blocked forward motion may not produce independent sideways motion');
});

test('four-horse finish runout stays smooth on narrow pocket courses as well as normal widths',()=>{
 for(const widthMode of ['standard','pocket24','pocket28']){
  for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
   const r=runActualFourHorseSimulation(distance,widthMode);
   assert.equal(r.finished,4,'All horses finish '+distance+'m, '+widthMode);
   assert.equal(r.frozenEarlyFinishers,0,'No early finisher stops while competitors race, '+widthMode);
   assert.equal(r.lowInRaceSpeedFrames,0,'No horse stalls before finish, '+widthMode);
   assert.ok(r.minimumInRaceSpeed>10,'Minimum in-race speed above 10m/s, '+widthMode);
   assert.ok(r.longestPostFinishDistance>24,'No legacy 24m stop, '+widthMode);
   assert.ok(r.longestPostFinishDistance<85,'Do not exceed drawn 90m finish runout, '+widthMode);
   assert.ok(r.minRailClearance>=FOUR_SAFE-1e-8,'Four-horse clearance, '+widthMode);
   assert.ok(r.minActiveCenterDistance>=3.0,'Horses must not overlap, '+widthMode);
  }
 }
});

test('approved 2-horse mode still uses its original independent finish-out behavior',()=>{
 const step=extract('stepOfficialPair');
 assert.match(step,/if\(isOfficialMultiTest\)\{/);
 assert.match(step,/h\.postDistance\+=h\.postSpeed\*tick/);
 assert.match(step,/h\.postDistance=Math\.min\(24,h\.postDistance\+12\*tick\)/);
 assert.match(step,/h\.postSpeed=Math\.max\(10\.5,/);
});

function runActualTokyoWidthFourHorseSimulation(distance){
 const profiles=html.match(/const FOUR_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 // widthAt is a one-line declaration; extract() targets multi-line functions.
 const widthSource=html.match(/function widthAt\(s\)\{[^\n]*\}/)?.[0];
 assert.ok(widthSource,'Actual racecourse widthAt function missing');
 const code=[widthSource,...['pairRailLane','fourHorseInnerLane','officialReviewLane','fourHorseDesiredSlot',
  'fourHorseSafeStep','stepOfficialPair'].map(extract)].join('\n');
 assert.ok(profiles,'Tactical pace profiles must exist');
 const source=`(()=>{
 const THREE={MathUtils:{clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v))}};
 const LAP=2083.1,FINISH_DISTANCE=525.9,PAIR_RAIL_CENTER_CLEARANCE=3.7,
 PAIR_LANE_SPACING=3.35,FOUR_RAIL_CENTER_CLEARANCE=2.8,FOUR_START_OUTSIDE_OFFSET=8,
 FOUR_INWARD_SETTLE_DISTANCE=160,FOUR_MIN_LONGITUDINAL=4.8,
 FOUR_LATERAL_SHARED=3.05,FOUR_INWARD_RATE=4.4,
 FOUR_MAX_LATERAL_PER_FORWARD=.30,isOfficialFourTest=true,isOfficialMultiTest=true,isOfficialEightTest=false,isOfficialEighteenTest=false,OFFICIAL_TEST_COUNT=4;
 ${profiles}
 ${code}
 const startStation=((FINISH_DISTANCE-trackDistance)%LAP+LAP)%LAP;
 const fieldCenterAt=(_p,d)=>({width:widthAt(startStation+d)});
 const activePlan={distance:trackDistance};
 let raceElapsed=0,raceFinished=[];
 const raceHorses=Array.from({length:4},(_,i)=>({
  idx:i,number:i+1,distance:0,postDistance:0,speed:0,
  finished:false,finishTime:null,slot:i,nextLaneReviewTime:0,
  lane:officialReviewLane(fieldCenterAt(activePlan,0).width,i,0)
 }));
 const frozenFrames=[0,0,0,0],minimumSpeed=[Infinity,Infinity,Infinity,Infinity];
 const stoppedEvents=[],snapshots={},mileposts=[30,45,60,100,200,500,1000];
 let minRail=Infinity,minCenterDistance=Infinity,sidewaysWithoutForward=0,
     maximumForwardYawRatio=0,postFinishFrozen=0;
 for(let t=0;t<30000&&raceFinished.length<4;t++){
  const before=raceHorses.map(h=>({d:h.distance,lane:h.lane,
   postDistance:h.postDistance||0,finished:h.finished}));
  stepOfficialPair(1/60);
  const lead=Math.max(...raceHorses.map(h=>h.distance));
  for(const m of mileposts){
   if(!snapshots[m]&&lead>=m)
    snapshots[m]=raceHorses.map(h=>({distance:h.distance,
     lane:h.lane,speed:h.speed}));
  }
  const active=raceHorses.filter(h=>!h.finished);
  for(let i=0;i<4;i++){
   const h=raceHorses[i];
   const forward=h.distance-before[i].d;
   const sideways=Math.max(0,h.lane-before[i].lane);
   if(!h.finished&&h.distance>30){
    minimumSpeed[i]=Math.min(minimumSpeed[i],h.speed);
    if(h.speed<9 || forward<.035){
     frozenFrames[i]++;
     if(stoppedEvents.length<10)stoppedEvents.push({
      horse:i+1,time:raceElapsed,distance:h.distance,speed:h.speed});
    }
   }
   if(before[i].finished&&!h.finished)throw Error('Cannot revert finished state');
   if(before[i].finished&&raceFinished.length<4&&
     h.postDistance-before[i].postDistance<.01)postFinishFrozen++;
   if(sideways>1e-8&&!h.finished){
    if(forward<1e-8)sidewaysWithoutForward++;
    maximumForwardYawRatio=Math.max(maximumForwardYawRatio,
     sideways/Math.max(forward,1e-7));
   }
  }
  for(let i=0;i<active.length;i++){
   const a=active[i];
   minRail=Math.min(minRail,fieldCenterAt(activePlan,a.distance).width/2-a.lane);
   for(let j=i+1;j<active.length;j++){
    const b=active[j];
    minCenterDistance=Math.min(minCenterDistance,
     Math.hypot(a.distance-b.distance,a.lane-b.lane));
   }
  }
 }
 return {distance:trackDistance,startStation,finished:raceFinished.length,
  minimumSpeed,frozenFrames,stoppedEvents,snapshots,minRail,
  minCenterDistance,sidewaysWithoutForward,
  maximumForwardYawRatio,postFinishFrozen};
 })()`;
 return runInNewContext(source,{trackDistance:distance});
}

test('real Tokyo turf width and race start stations prevent all four pre-finish freezes',()=>{
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const r=runActualTokyoWidthFourHorseSimulation(distance);
  assert.equal(r.finished,4,'All four horses must finish '+distance+'m');
  assert.ok(Math.abs(r.startStation-((525.9-distance)%2083.1+2083.1)%2083.1)<1e-7,
   'True Tokyo starting station');
  assert.equal(r.frozenFrames.reduce((a,b)=>a+b,0),0,
   'No race horse may stall before finish on the actual Tokyo width profile: '+distance+
    'm; '+JSON.stringify(r.stoppedEvents));
  assert.ok(r.minimumSpeed.every(v=>v>10),
   'Each horse maintains galloping forward speed after 30m: '+distance);
  assert.ok(r.minCenterDistance>=3.05,
   'Horses remain separated on the actual changing width: '+distance);
  assert.ok(r.minRail>=FOUR_SAFE-1e-8,
   'No horse enters the inner rail on the actual changing width: '+distance);
  assert.equal(r.sidewaysWithoutForward,0,'Never travel sideways without forward progression');
  assert.ok(r.maximumForwardYawRatio<=.300001,'Natural diagonal merge angle cap');
  assert.equal(r.postFinishFrozen,0,'Finished runners keep moving until the race ends');
 }
});

test('Tokyo 1400m regression explicitly covers the previous 45m stoppage',()=>{
 const r=runActualTokyoWidthFourHorseSimulation(1400);
 assert.ok(r.snapshots[45],'Must simulate the previously defective 45m region');
 assert.ok(r.snapshots[45].every(h=>h.speed>9),
  'All four keep moving past the former deadlock at 45m');
 assert.ok(r.snapshots[60].every(h=>h.speed>9),
  'The same horses keep running beyond 60m');
 assert.equal(r.frozenFrames.reduce((x,y)=>x+y,0),0);
});

test('only four-horse mode uses 2.8m rail clearance; two-horse remains 3.7m',()=>{
 assert.match(html,/const FOUR_RAIL_CENTER_CLEARANCE=2\.8/);
 const two=makeReviewLane(false),four=makeReviewLane(true);
 for(const width of [24,28,31,36,41]){
  assert.ok(Math.abs(width/2-lane(width,0)-3.7)<1e-8,'Two-horse safety unchanged');
  assert.ok(Math.abs(width/2-fourInnerLane(width)-2.8)<1e-8,'Four-horse center clearance 2.8m');
  for(let i=0;i<4;i++){
   assert.ok(Math.abs(four(width,i,160)-two(width,i,160)-.9)<1e-7,
    'The four-horse target is exactly 0.9m closer to the rail');
  }
 }
 assert.match(extract('fourHorseSafeStep'),/const inner=fourHorseInnerLane\(width\)/);
});
