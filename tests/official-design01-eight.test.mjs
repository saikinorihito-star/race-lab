import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function extract(name){
 const i=html.indexOf('function '+name+'(');
 assert.ok(i>=0,'Missing actual app function '+name);
 const end=html.slice(i).search(/\n\}(?=\n)/);
 assert.ok(end>=0,'Unclosed '+name);
 return html.slice(i,i+end+2);
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const params={
 PAIR_LANE_SPACING:3.35, FOUR_RAIL_CENTER_CLEARANCE:2.8,
 fourHorseInnerLane:width=>width/2-2.8
};
const startLane=runInNewContext('('+extract('eightStartLane')+')',params);

test('8 starting horses fit both the narrow 24m turf pocket and the standard turf course',()=>{
 for(const width of [24,28,31,36,41]){
  const lanes=Array.from({length:8},(_,i)=>startLane(width,i));
  assert.ok(width/2-lanes[0]>=2.8-1e-8,'Inside rail margin');
  assert.ok(width/2+lanes[7]>=1.5,'Outside rail margin');
  for(let i=1;i<8;i++){
   const lateral=lanes[i-1]-lanes[i];
   assert.ok(lateral>=2.74&&lateral<=3.36,'Starting stall separation');
  }
 }
});

test('official eight uses original full-detail GLB with independent bones, its own camera and GPU settings',()=>{
 assert.match(html,/const isOfficialEightTest=isDesign01Review&&qs\.get\('group'\)==='8'/);
 assert.match(html,/const OFFICIAL_TEST_COUNT=isOfficialEighteenTest\?18:isOfficialEightTest\?8:isOfficialFourTest\?4:2/);
 assert.match(html,/renderQuality\.value='auto'/);
 assert.match(html,/renderQuality\.value=isOfficialEightTest\?'standard'/);
 assert.match(html,/new THREE\.WebGLRenderer\(\{antialias:!\(isOfficialEightTest\|\|isOfficialEighteenTest\),/);
 assert.match(extract('initializeOfficialPair'),/cloneSkeleton\(source\)/);
 assert.match(extract('initializeOfficialPair'),/for\(let i=0;i<OFFICIAL_TEST_COUNT;i\+\+\)/);
 assert.match(extract('updateOfficialPair'),/h\.mixer\.setTime\(gaitTime\)/);
 assert.match(extract('stepOfficialPair'),/eightHorseSafeStep\(h,previous,tick,targetSpeed\)/);
 assert.match(html,/official-meshy-blue-ribbon-original-geometry-gallop-v2-20261119/);
});

function simulateEight(distance,variant='tokyo'){
 const profiles4=html.match(/const FOUR_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 const profiles8=html.match(/const EIGHT_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 const widthSource=html.match(/function widthAt\(s\)\{[^\n]*\}/)?.[0];
 assert.ok(profiles4&&profiles8&&widthSource);
 const functions=['pairRailLane','fourHorseInnerLane','eightStartLane','officialReviewLane',
  'fourHorseSafeStep','eightHorseSafeStep','stepOfficialPair'].map(extract).join('\n');
 const program=`(()=>{
 const THREE={MathUtils:{clamp:(x,a,b)=>Math.max(a,Math.min(b,x))}};
 const PAIR_RAIL_CENTER_CLEARANCE=3.7,PAIR_LANE_SPACING=3.35,
 FOUR_RAIL_CENTER_CLEARANCE=2.8,FOUR_START_OUTSIDE_OFFSET=8,
 FOUR_INWARD_SETTLE_DISTANCE=160,FOUR_MIN_LONGITUDINAL=4.8,
 FOUR_LATERAL_SHARED=3.05,FOUR_INWARD_RATE=4.4,
 FOUR_MAX_LATERAL_PER_FORWARD=.30,
 EIGHT_MERGE_LONGITUDINAL_BUFFER=4.0,
 isOfficialEightTest=true,isOfficialEighteenTest=false,isOfficialFourTest=false,isOfficialMultiTest=true,OFFICIAL_TEST_COUNT=8;
 ${profiles4}
 ${profiles8}
 ${widthSource}
 ${functions}
 const LAP=2083.1,FINISH_DISTANCE=525.9;
 const startStation=((FINISH_DISTANCE-trackDistance)%LAP+LAP)%LAP;
 const activePlan={distance:trackDistance};
 const fieldCenterAt=(_p,d)=>({width:
  trackVariant==='tokyo'?widthAt(startStation+d):
  trackVariant==='pocket24'?(d<250?24:d<310?24+12*(d-250)/60:36):
  (d<250?28:d<310?28+8*(d-250)/60:36)
 });
 let raceElapsed=0,raceFinished=[];
 const width=fieldCenterAt(activePlan,0).width;
 const raceHorses=Array.from({length:8},(_,i)=>({
  idx:i,number:i+1,distance:0,postDistance:0,speed:0,
  finished:false,finishTime:null,lane:eightStartLane(width,i),slot:i
 }));
 const lowestSpeed=Array(8).fill(Infinity),stops=Array(8).fill(0);
 let minRail=Infinity,minOuter=Infinity,minSeparation=Infinity,maxSideToForward=0,
  crossovers=0,finishStalls=0,closedPackFrames=0;
 const snapshots={},innerFormation={};
 for(let t=0;t<30000&&raceFinished.length<8;t++){
  const before=raceHorses.map(h=>({d:h.distance,l:h.lane,p:h.postDistance||0,finished:h.finished}));
  stepOfficialPair(1/60);
  const lead=Math.max(...raceHorses.map(h=>h.distance));
  for(const marker of [30,45,100,200,300,400]){
   if(!snapshots[marker]&&lead>=marker){
    snapshots[marker]=raceHorses.map(h=>({distance:h.distance,lane:h.lane,speed:h.speed}));
    // Report the number of test horses within two standard lane widths of
    // the innermost safe turf line, to detect renewed outer-lane lockup.
    const inside=fourHorseInnerLane(fieldCenterAt(activePlan,lead).width);
    innerFormation[marker]=raceHorses.filter(h=>inside-h.lane<=6.7).length;
   }
  }
  const active=raceHorses.filter(h=>!h.finished);
  for(const h of raceHorses){
   const pre=before[h.idx];
   if(pre.finished&&raceFinished.length<8 && h.postDistance-pre.p<.01)finishStalls++;
   if(h.finished)continue;
   const w=fieldCenterAt(activePlan,h.distance).width;
   minRail=Math.min(minRail,w/2-h.lane);
   minOuter=Math.min(minOuter,w/2+h.lane);
   const forward=h.distance-pre.d,inward=Math.max(0,h.lane-pre.l);
   if(inward>.000001){
    if(forward<.000001)crossovers++;
    maxSideToForward=Math.max(maxSideToForward,inward/Math.max(.000001,forward));
   }
   if(h.distance>30){
    lowestSpeed[h.idx]=Math.min(lowestSpeed[h.idx],h.speed);
    if(h.speed<9||forward<.035)stops[h.idx]++;
   }
  }
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j];
   const sep=Math.hypot(a.distance-b.distance,a.lane-b.lane);
   minSeparation=Math.min(minSeparation,sep);
   if(Math.abs(a.lane-b.lane)<3.15&&Math.abs(a.distance-b.distance)>4.8
    &&Math.abs(a.distance-b.distance)<20)closedPackFrames++;
  }
 }
 return {distance:trackDistance,variant:trackVariant,finished:raceFinished.length,
  minRail,minOuter,minSeparation,lowestSpeed,stops,crossovers,maxSideToForward,
  finishStalls,closedPackFrames,snapshots,innerFormation,
  finishTimes:raceHorses.map(h=>h.finishTime)};
 })()`;
 return runInNewContext(program,{trackDistance:distance,trackVariant:variant});
}

test('8 full-detail horse positions run without freezes across nine Tokyo turf distances',()=>{
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const r=simulateEight(distance,'tokyo');
  assert.equal(r.finished,8,'All eight must complete '+distance+'m');
  assert.equal(r.stops.reduce((a,b)=>a+b,0),0,'No traffic deadlock in '+distance+'m');
  assert.ok(r.lowestSpeed.every(x=>x>10),'All keep galloping after 30m');
  assert.ok(r.minRail>=2.8-1e-7,'2.8m inside-rail center clearance '+distance);
  assert.ok(r.minOuter>=1.5-1e-7,'Outside rail clear '+distance);
  assert.ok(r.minSeparation>=2.7,'No center overlap '+distance);
  assert.equal(r.crossovers,0,'No stationary sideways horse movement');
  assert.ok(r.maxSideToForward<=.300001,'Diagonal movement limited by forward motion');
  assert.equal(r.finishStalls,0,'No early finisher freezes');
  assert.ok(r.closedPackFrames>100,'Some horses form a nose-to-tail pack');
 }
});

test('8 narrow-pocket variants pass all contact/rail/stop checks',()=>{
 for(const variant of ['pocket24','pocket28']){
  for(const distance of [1400,1800,2400]){
   const r=simulateEight(distance,variant);
   assert.equal(r.finished,8);
   assert.equal(r.stops.reduce((a,b)=>a+b,0),0,'No stopped horse '+variant);
   assert.ok(r.minRail>=2.8-1e-7);
   assert.ok(r.minOuter>=1.5-1e-7);
   assert.ok(r.minSeparation>=2.7);
   assert.equal(r.crossovers,0);
   assert.ok(r.maxSideToForward<=.300001);
  }
 }
});

class Vec3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 clone(){return new Vec3(this.x,this.y,this.z)}
 normalize(){const n=Math.hypot(this.x,this.y,this.z)||1;this.x/=n;this.y/=n;this.z/=n;return this}
 addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
}
const fakeThree={Vector3:Vec3,MathUtils:{
 clamp,lerp:(a,b,t)=>a+(b-a)*t,
 smoothstep:(v,a,b)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)}
}};
test('8-horse camera tracks the pack and prioritizes the leader after the field spreads',()=>{
 for(const aspect of [.58,.85,1.7])for(const mode of ['field','side','front3q','chase'])
 for(const gap of [0,7,14,20,27,40,75]){
  const ctx={THREE:fakeThree,OFFICIAL_TEST_COUNT:8,
   isOfficialPairTest:true,isOfficialFourTest:false,isOfficialEightTest:true,isOfficialEighteenTest:false,isOfficialMultiTest:true,
   activePlan:{distance:1400},playing:false,RACE_TICK:1/60,raceAccumulator:0,
   groupCameraOffset:{yaw:0,pitch:0,zoom:1},
   stage:{clientWidth:800*aspect,clientHeight:800},
   raceHorses:Array.from({length:8},(_,i)=>({
    distance:200-gap*i/7,postDistance:0,lane:13-i*3.1,speed:15
   })),
   fieldCenterAt:(_p,d)=>({p:new Vec3(d,0,0),t:new Vec3(1,0,0),width:36}),
   fieldCameraShot:()=>{throw Error('Unexpected fallback')}
  };
  ctx.officialPairVisualState=runInNewContext('('+extract('officialPairVisualState')+')',ctx);
  const cam=runInNewContext('('+extract('officialPairCameraShot')+')',ctx)(mode);
  assert.ok([cam.eye.x,cam.eye.y,cam.eye.z,cam.target.x,cam.target.y,cam.target.z]
   .every(Number.isFinite),'Finite camera coordinates');
  const d=cam.target.x-1.4;
  if(gap<=14)assert.ok(Math.abs(d-(200-gap/2))<1e-7);
  if(gap>=27)assert.ok(Math.abs(d-195)<1e-7,'Leader-framing at long separation');
 }
});

test('eight outer-drawn horses use open front/back gaps to join the inner pack by 200m',()=>{
 assert.match(html,/const EIGHT_MERGE_LONGITUDINAL_BUFFER=4\.0/);
 assert.match(extract('eightHorseSafeStep'),
  /Math\.abs\(gap\)<EIGHT_MERGE_LONGITUDINAL_BUFFER/);
 const r=simulateEight(1400,'tokyo');
 assert.ok(r.innerFormation[100]>=5,
  'At least five of eight have moved to within two inner lanes by 100m');
 assert.ok(r.innerFormation[200]>=7,
  'At least seven of eight have merged into the inside two lanes by 200m');
 assert.equal(r.innerFormation[300],8,
  'All eight should join the inner two-lane pack by 300m on Tokyo 1400m');
 assert.ok(r.minSeparation>=3.1,'Maintain center clearance during rapid convergence');
 assert.equal(r.stops.reduce((a,b)=>a+b,0),0,'Do not revive the 45m stoppage');
});
