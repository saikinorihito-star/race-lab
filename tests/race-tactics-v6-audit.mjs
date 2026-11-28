// Expanded deterministic race audit. Not a browser/WebGL or surveyed course test.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {raceTacticalContext,tacticalRaceTarget,tacticalEnergyCost} from '../race-tactics-balance-v6.mjs';
const tactics=[raceTacticalContext,tacticalRaceTarget,tacticalEnergyCost];
const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function fn(name){
 const p=html.indexOf('function '+name+'('),e=html.indexOf('\n}\n',p);
 assert.ok(p>=0&&e>p,'Missing actual function '+name);
 return html.slice(p,e+2);
}
// Extract the app's main-course shape, including its approximate altitude
// profile. Track mode is intentionally restricted to non-pocket distances.
function makeTrack(D){
 if([1800,2000].includes(D))throw Error('Pocket geometry is not included in this track fixture');
 const constants=html.slice(html.indexOf('const LAP=2083.1'),html.indexOf('const TRACK='));
 const elev=html.slice(html.indexOf('const profile=['),html.indexOf('function widthAt('));
 const geom=html.slice(html.indexOf('const LEFT_START_X='),html.indexOf('function offsetAt('));
 const g=Function(constants+'\nconst DISPLAY_RELIEF=1,ELEVATION_BASE=3.05;const THREE={Vector3:class {constructor(x,y,z){Object.assign(this,{x,y,z})}}};\n'+elev+'\n'+geom+'\nreturn {positionAt,MEASURE_OFFSET,FINISH_DISTANCE,LAP};')();
 const station=((g.FINISH_DISTANCE-D)%g.LAP+g.LAP)%g.LAP;
 const p=d=>g.positionAt(station+Math.max(0,Math.min(D+90,d)));
 const profile=Array.from({length:Math.ceil(D/5)+1},(_,i)=>{
  const d=Math.min(D,i*5),lo=Math.max(0,d-5),hi=Math.min(D,d+5),a=p(lo).t,b=p(hi).t,t=p(d).t;
  return {kappa:Math.max(-.013,Math.min(.013,((b.x-a.x)*t.z-(b.z-a.z)*t.x)/Math.max(1,hi-lo))),referenceLane:(36+5*Math.sin((station+d)/g.LAP*Math.PI*2+.5))/2-g.MEASURE_OFFSET};
 });
 const heights=Array.from({length:Math.ceil((D+90)*2)+1},(_,i)=>p(i/2).p.y);
 const height=d=>{const x=Math.max(0,Math.min(heights.length-1,d*2)),i=Math.floor(x);return heights[i]+((heights[i+1]??heights[i])-heights[i])*(x-i)};
 return {profile,height};
}
function sim(distance,variant='actual',overrides={},pace='middle',mode='real',seed=1,going='good',geometry='flat',lineup=null){
 const p4=html.match(/const FOUR_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 const p8=html.match(/const EIGHT_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 const p18=html.match(/const EIGHTEEN_PACE_PROFILES=Array\.from\([\s\S]*?\n\}\);/)?.[0];
 const width=html.match(/function widthAt\(s\)\{[^\n]*\}/)?.[0];
 assert.ok(p4&&p8&&p18&&width);
 const names=['pairRailLane','fourHorseInnerLane','eightStartLane','eighteenStartLane',
  'officialReviewLane','fourHorseSafeStep','eightHorseSafeStep','cornerDataAt','cornerPacePenalty','cornerPathFactor','eighteenHorseSafeStep','stepOfficialPair'];
 const source=[
  "const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const THREE={MathUtils:{clamp,lerp:(a,b,t)=>a+(b-a)*t,smoothstep:(v,a,b)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)}}};",
  "const PAIR_RAIL_CENTER_CLEARANCE=3.7,PAIR_LANE_SPACING=3.35,FOUR_RAIL_CENTER_CLEARANCE=2.8,FOUR_START_OUTSIDE_OFFSET=8,FOUR_INWARD_SETTLE_DISTANCE=160,FOUR_MIN_LONGITUDINAL=4.8,FOUR_LATERAL_SHARED=3.05,FOUR_INWARD_RATE=4.4,FOUR_MAX_LATERAL_PER_FORWARD=.30,EIGHT_MERGE_LONGITUDINAL_BUFFER=4.0,EIGHTEEN_MERGE_LONGITUDINAL_BUFFER=6.0,EIGHTEEN_SPACING_FROM=300,EIGHTEEN_MIN_ROLL_BASE=10.4,EIGHTEEN_MIN_ROLL_STAGGER=.01;",
  "const isOfficialEighteenTest=true,isOfficialEightTest=false,isOfficialFourTest=false,isOfficialMultiTest=true,OFFICIAL_TEST_COUNT=18;",
  width,p4,p8,p18,...names.map(fn),
  html.match(/const HORSE_ABILITY_KEYS=\[[\s\S]*?\];/)[0],
  ...['baseForRegisteredHorse','defaultHorseAbility','effectiveEighteenProfile','validFlowSeed','flowHash','startRiskProbability','sampleStartDelay','runnerFlow','makeRaceFlow'].map(fn),
  // Flat synthetic track profile: this fixture tests lane/pace mechanics, not real 3D course geometry.
  "const EIGHTEEN_CORNER_STEP=5,DISPLAY_RELIEF=1;const eighteenCornerProfile=geometry==='track'?trackProfile:geometry==='flat'?[]:Array.from({length:Math.ceil(distance/5)+1},(_,i)=>{const p=i*5/distance;return {kappa:p>.22&&p<.75?.0045:0,referenceLane:15}});const balanceWeights={distance:1,going:1,hill:1,start:1,traffic:1,composure:1,course:1,speed:1,stamina:1,acceleration:1};const horseIdentityBySlot=identityLineup??Array.from({length:18},(_,i)=>i),horseAbilities=[];const GOING_SEVERITY={good:0,slightlyHeavy:.3,heavy:.7,bad:1},raceGoingAtStart=going,raceFlowAtStart=makeRaceFlow(mode,seed,pace);function captureRaceAnalysis(){}",
  "const LAP=2083.1,FINISH_DISTANCE=525.9,startStation=((FINISH_DISTANCE-distance)%LAP+LAP)%LAP;",
  "const activePlan={distance};",
  "const fieldCenterAt=(_p,d)=>({p:{y:geometry==='track'?trackHeight(d):geometry==='flat'?0:2.5*Math.sin(d/180)},width:variant==='actual'?widthAt(startStation+d):variant==='pocket24'?(d<250?24:d<310?24+12*(d-250)/60:36):(d<250?28:d<310?28+8*(d-250)/60:36)});",
  "let raceElapsed=0,raceFinished=[];const firstWidth=fieldCenterAt(activePlan,0).width;",
  "const raceHorses=Array.from({length:18},(_,i)=>({idx:i,number:i+1,distance:0,postDistance:0,speed:0,finished:false,slot:i,lane:eighteenStartLane(firstWidth,i),energy:1,startDelay:overrides[i]?.startDelay??sampleStartDelay(overrides[i]?.startRisk??1,mode==='standard'?1:seed,horseIdentityBySlot[i],overrides[i]?.start??5,mode),raceFlow:mode==='standard'?null:runnerFlow(seed,horseIdentityBySlot[i],mode),passGoal:null,passUntil:0,passCooldown:0,passAttempts:0,insidePassAttempts:0,outsidePassAttempts:0,passOpponentIdx:null,outsideHoldUntil:0,outsideHoldMax:0,blockedFor:0,last600StartTime:null,raceProfile:effectiveEighteenProfile(i,{...defaultHorseAbility(i),...overrides[i]})}));",
  "let rail=Infinity,outer=Infinity,minSep=Infinity,stops=0,postStops=0,sideOnly=0,stacked=0,maxSteeringError=0;",
  "const marks={},release=Array(18).fill(null),initialLanes=raceHorses.map(h=>h.lane);let bodyTicks=0,delayedDrift=0,nonFinite=0,backwards=0,closeTicks=0,postGateMin=Infinity,leadChanges=0,previousLeader=null,exhausted=new Set(),totalPasses=0;",
  "for(let tick=0;tick<32000&&raceFinished.length<18;tick++){",
  "const before=raceHorses.map(h=>({d:h.distance,l:h.lane,p:h.postDistance||0,f:h.finished,steering:h.smoothedSideSpeed??0}));",
  "stepOfficialPair(1/60);",
  "for(const h of raceHorses){if(h.distance>0&&release[h.idx]===null)release[h.idx]=raceElapsed-1/60;if(raceElapsed<=h.startDelay+1e-9)delayedDrift=Math.max(delayedDrift,Math.abs(h.lane-initialLanes[h.idx]),h.distance);}",
  "const lead=Math.max(...raceHorses.map(h=>h.distance));",
  "for(const m of [45,100,200,300])if(!marks[m]&&lead>=m){",
  "const inside=fourHorseInnerLane(fieldCenterAt(activePlan,lead).width);",
  "marks[m]={spread:lead-Math.min(...raceHorses.map(h=>h.distance)),near:raceHorses.filter(h=>inside-h.lane<=6.7).length};",
  "}",
  "const live=raceHorses.filter(h=>!h.finished);if(tick%60===0&&lead>200&&live.length===18){const leader=live.reduce((a,b)=>a.distance>=b.distance?a:b).idx;if(previousLeader!==null&&leader!==previousLeader)leadChanges++;previousLeader=leader;}",
  "for(const h of raceHorses){const b=before[h.idx];",
  "if(b.f&&raceFinished.length<18&&h.postDistance-b.p<.01)postStops++;",
  "if(![h.distance,h.lane,h.speed,h.energy].every(Number.isFinite))nonFinite++;if(h.distance<b.d-1e-8)backwards++;if(h.energy<=.0200001)exhausted.add(h.idx);if(h.finished)continue;",
  "const w=fieldCenterAt(activePlan,h.distance).width;rail=Math.min(rail,w/2-h.lane);outer=Math.min(outer,w/2+h.lane);",
  "const lateral=h.lane-b.l-(fieldCenterAt(activePlan,h.distance).width-fieldCenterAt(activePlan,b.d).width)*.5;const dx=h.distance-b.d,side=Math.abs(lateral);",
  "const expectedSteering=b.steering+(lateral*60-b.steering)*.1;maxSteeringError=Math.max(maxSteeringError,Math.abs(h.sideSpeed-expectedSteering));",
  "if(h.distance>30&&(h.speed<8||dx<.03))stops++;",
  "if(side>dx*.36001+.000001)sideOnly++;",
  "}",
  "for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){",
  "const a=live[i],b=live[j],dx=Math.abs(a.distance-b.distance),dy=Math.abs(a.lane-b.lane);",
  "const sep=Math.hypot(dx,dy);minSep=Math.min(minSep,sep);if(a.distance>20&&b.distance>20){postGateMin=Math.min(postGateMin,sep);if(sep<1.10)closeTicks++;if(a.distance>=30&&b.distance>=30&&dx<3.6&&dy<2.3){const yawA=Math.atan(Math.max(-.3,Math.min(.3,(a.sideSpeed||0)/Math.max(.5,a.speed)))),yawB=Math.atan(Math.max(-.3,Math.min(.3,(b.sideSpeed||0)/Math.max(.5,b.speed))));const width=1.15+1.6*(Math.abs(Math.sin(yawA))+Math.abs(Math.sin(yawB)));if(Math.hypot(dx/3.2,dy/width)<1)bodyTicks++;}}",
  "if(dy<2.35&&dx>4.8&&dx<20)stacked++;",
  "}",
  "}",
  "return {bodyTicks,nonFinite,backwards,closeTicks,postGateMin,leadChanges,exhausted:exhausted.size,release,delayedDrift,done:raceFinished.length,firstWidth,rail,outer,minSep,stops,postStops,sideOnly,stacked,marks,maxSteeringError,results:raceHorses.map(h=>({idx:h.idx,time:h.finishTime,energy:h.energy,role:h.role??h.raceProfile.role,passAttempts:h.passAttempts}))};"
 ].join('\n');
 const {profile,height}=geometry==='track'?makeTrack(distance):{profile:[],height:()=>0};
 return new Function('trackProfile','trackHeight','identityLineup','distance','variant','overrides','pace','mode','seed','going','geometry','raceTacticalContext','tacticalRaceTarget','tacticalEnergyCost',source)(profile,height,lineup,distance,variant,overrides,pace,mode,seed,going,geometry,...tactics);
}

const distances=[1400,1600,1800,2000,2300,2400,2500,2600,3400];
const roles=['逃げ','先行','中団','差し','追込'];
const goings=['good','slightlyHeavy','heavy','bad'];
const paces=['slow','middle','high','auto'];
const variants=['actual','pocket24','pocket28'];
const keys=['speed','stamina','acceleration','course','distance','composure','traffic','going','hill','start'];
const base=(D,i)=>({...Object.fromEntries(keys.map(k=>[k,5])),preferredDistance:D,role:roles[i%5],startRisk:1});
function mixed(D,seed,extreme=false){
 return Array.from({length:18},(_,i)=>({...base(D,i),...Object.fromEntries(keys.map((k,j)=>[k,extreme?1+9*((i+j+seed)%2):1+((Math.imul(i+11,seed+17)+j*7)%10+10)%10])),preferredDistance:Math.max(1000,Math.min(4000,D+((i*7+seed)%9-4)*250)),startRisk:1+(i+seed)%10}));
}
export function auditBatch(batch){
 const cases=[];
 if(['matrix','matrix-first','matrix-second'].includes(batch)){
  for(let i=0;i<distances.length;i++)for(let j=batch==='matrix-second'?2:0;j<(batch==='matrix-first'?2:4);j++){
   const d=distances[i],seed=101+i*11+j;
   cases.push({label:'matrix',d,variant:variants[(i+j)%3],pace:paces[j],mode:j%2?'chaos':'real',seed,going:goings[(i+j)%4],geometry:(i+j)%2?'curve':'flat',overrides:mixed(d,seed,j===3)});
  }
 }else if(batch==='track-sweep'||batch==='track-sweep-reversed'){
  for(const [i,d] of [1400,1600,2300,2400,2500,2600,3400].entries()){
   cases.push({label:batch,d,variant:'actual',pace:'auto',mode:'real',seed:i+1,going:'good',geometry:'track',lineup:batch==='track-sweep-reversed'?Array.from({length:18},(_,j)=>17-j):null,overrides:Array.from({length:18},(_,j)=>({...base(d,j),role:'先行'}))});
  }
 }else if(batch==='track'||batch==='track-reversed'){
  for(let seed=1;seed<=6;seed++){
   const d=2400;
   cases.push({label:batch,d,variant:'actual',pace:'auto',mode:'real',seed,going:'good',geometry:'track',lineup:batch==='track-reversed'?Array.from({length:18},(_,i)=>17-i):null,overrides:Array.from({length:18},(_,i)=>({...base(d,i),role:'先行'}))});
  }
 }else if(batch==='real'||batch==='chaos'){
  for(let seed=1;seed<=24;seed++){
   const d=2400;
   cases.push({label:batch,d,variant:'actual',pace:'auto',mode:batch,seed,going:'good',geometry:'flat',overrides:Array.from({length:18},(_,i)=>({...base(d,i),role:'先行'}))});
  }
 }else if(batch.startsWith('single-')){
  const group=batch.slice(7),sets={core:['speed','stamina','acceleration'],context:['course','distance','going','hill'],tactics:['composure','traffic','start']};
  const list=sets[group]||[group];if(list.some(k=>!keys.includes(k)))throw Error('unknown ability');
  for(const key of list)for(const level of [2,5,9]){
   const d=key==='stamina'?3400:key==='start'?1400:2400,seed=47;
   const overrides=Array.from({length:18},(_,i)=>({...base(d,i),role:roles[i%5]}));
   overrides[8]={...overrides[8],[key]:level,preferredDistance:key==='distance'?1600:d};
   cases.push({label:key+'-'+level,d,variant:'actual',pace:key==='stamina'?'high':'middle',mode:'real',seed,going:key==='going'?'bad':'good',geometry:['course','hill'].includes(key)?'track':'flat',overrides});
  }
 }else if(batch==='ability'){
  for(let seed=1;seed<=12;seed++)for(const level of [2,9]){
   const d=2400,overrides=Array.from({length:18},(_,i)=>({...base(d,i),role:'先行'}));
   overrides[8]={...overrides[8],speed:level,stamina:level,acceleration:level};
   cases.push({label:'ability-'+level,d,variant:'actual',pace:'middle',mode:'real',seed,going:'good',geometry:'flat',overrides});
  }
 }else if(batch==='replay'){
  const d=2400,seed=831;for(let i=0;i<2;i++)cases.push({label:'replay',d,variant:'actual',pace:'auto',mode:'real',seed,going:'heavy',geometry:'curve',overrides:mixed(d,seed)});
 }else throw Error('unknown batch');
 return cases.map(c=>{
  const {label,d,variant,pace,mode,seed,going,geometry,overrides,lineup}=c;
  const r=sim(d,variant,overrides,pace,mode,seed,going,geometry,lineup);
  const sorted=r.results.slice().sort((a,b)=>a.time-b.time);
  return {label,d,variant,pace,mode,seed,going,geometry,done:r.done,stops:r.stops,postStops:r.postStops,sideOnly:r.sideOnly,rail:r.rail,outer:r.outer,minSep:r.minSep,postGateMin:r.postGateMin,closeTicks:r.closeTicks,bodyTicks:r.bodyTicks,nonFinite:r.nonFinite,backwards:r.backwards,delayedDrift:r.delayedDrift,leadChanges:r.leadChanges,exhausted:r.exhausted,near200:r.marks[200]?.near,spread200:r.marks[200]?.spread,winner:sorted[0]?.idx+1,winTime:sorted[0]?.time,rank9:sorted.findIndex(x=>x.idx===8)+1,time9:r.results[8]?.time,order:sorted.map(x=>x.idx+1),meanEnergy:r.results.reduce((v,x)=>v+x.energy,0)/18,passes:r.results.reduce((v,x)=>v+(x.passAttempts||0),0)};
 });
}
