import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {raceTacticalContext,tacticalRaceTarget,tacticalEnergyCost,distanceFit,resolveRacePace} from '../race-tactics-balance-v6.mjs';
const tactics=[raceTacticalContext,tacticalRaceTarget,tacticalEnergyCost];
const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
// Synthetic flat-course fixture, adapted from official-design01-eighteen.test.mjs.
// The approved open-corridor movement allows up to .36 lateral/forward.
// This test does not certify 3D course geometry or mobile rendering.
function fn(name){
 const p=html.indexOf('function '+name+'('),e=html.indexOf('\n}\n',p);
 assert.ok(p>=0&&e>p,'Missing actual function '+name);
 return html.slice(p,e+2);
}
function sim(distance,variant='actual',overrides={},pace='middle'){
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
  ...['baseForRegisteredHorse','defaultHorseAbility','effectiveEighteenProfile'].map(fn),
  // Flat synthetic track profile: this fixture tests lane/pace mechanics, not real 3D course geometry.
  "const eighteenCornerProfile=[],EIGHTEEN_CORNER_STEP=5,DISPLAY_RELIEF=1;const balanceWeights={distance:1,going:1,hill:1,start:1,traffic:1,composure:1,course:1,speed:1,stamina:1,acceleration:1};const horseIdentityBySlot=Array.from({length:18},(_,i)=>i),horseAbilities=[];const GOING_SEVERITY={good:0},raceGoingAtStart='good',raceFlowAtStart={mode:'standard',pace};function captureRaceAnalysis(){}",
  "const LAP=2083.1,FINISH_DISTANCE=525.9,startStation=((FINISH_DISTANCE-distance)%LAP+LAP)%LAP;",
  "const activePlan={distance};",
  "const fieldCenterAt=(_p,d)=>({p:{y:0},width:variant==='actual'?widthAt(startStation+d):variant==='pocket24'?(d<250?24:d<310?24+12*(d-250)/60:36):(d<250?28:d<310?28+8*(d-250)/60:36)});",
  "let raceElapsed=0,raceFinished=[];const firstWidth=fieldCenterAt(activePlan,0).width;",
  "const raceHorses=Array.from({length:18},(_,i)=>({idx:i,number:i+1,distance:0,postDistance:0,speed:0,finished:false,slot:i,lane:eighteenStartLane(firstWidth,i),energy:1,startDelay:overrides[i]?.startDelay??0,passGoal:null,passUntil:0,passCooldown:0,passAttempts:0,insidePassAttempts:0,outsidePassAttempts:0,passOpponentIdx:null,outsideHoldUntil:0,outsideHoldMax:0,blockedFor:0,last600StartTime:null,raceProfile:effectiveEighteenProfile(i,{...defaultHorseAbility(i),...overrides[i]})}));",
  "let rail=Infinity,outer=Infinity,minSep=Infinity,stops=0,postStops=0,sideOnly=0,stacked=0,maxSteeringError=0;",
  "const marks={},release=Array(18).fill(null),initialLanes=raceHorses.map(h=>h.lane);let delayedDrift=0;",
  "for(let tick=0;tick<32000&&raceFinished.length<18;tick++){",
  "const before=raceHorses.map(h=>({d:h.distance,l:h.lane,p:h.postDistance||0,f:h.finished,steering:h.smoothedSideSpeed??0}));",
  "stepOfficialPair(1/60);",
  "for(const h of raceHorses){if(h.distance>0&&release[h.idx]===null)release[h.idx]=raceElapsed-1/60;if(raceElapsed<=h.startDelay+1e-9)delayedDrift=Math.max(delayedDrift,Math.abs(h.lane-initialLanes[h.idx]),h.distance);}",
  "const lead=Math.max(...raceHorses.map(h=>h.distance));",
  "for(const m of [45,100,200,300])if(!marks[m]&&lead>=m){",
  "const inside=fourHorseInnerLane(fieldCenterAt(activePlan,lead).width);",
  "marks[m]={spread:lead-Math.min(...raceHorses.map(h=>h.distance)),near:raceHorses.filter(h=>inside-h.lane<=6.7).length};",
  "}",
  "const live=raceHorses.filter(h=>!h.finished);",
  "for(const h of raceHorses){const b=before[h.idx];",
  "if(b.f&&raceFinished.length<18&&h.postDistance-b.p<.01)postStops++;",
  "if(h.finished)continue;",
  "const w=fieldCenterAt(activePlan,h.distance).width;rail=Math.min(rail,w/2-h.lane);outer=Math.min(outer,w/2+h.lane);",
  "const lateral=h.lane-b.l-(fieldCenterAt(activePlan,h.distance).width-fieldCenterAt(activePlan,b.d).width)*.5;const dx=h.distance-b.d,side=Math.max(0,lateral);",
  "const expectedSteering=b.steering+(lateral*60-b.steering)*.1;maxSteeringError=Math.max(maxSteeringError,Math.abs(h.sideSpeed-expectedSteering));",
  "if(h.distance>30&&(h.speed<8||dx<.03))stops++;",
  "if(side>dx*.36001+.000001)sideOnly++;",
  "}",
  "for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){",
  "const a=live[i],b=live[j],dx=Math.abs(a.distance-b.distance),dy=Math.abs(a.lane-b.lane);",
  "minSep=Math.min(minSep,Math.hypot(dx,dy));",
  "if(dy<2.35&&dx>4.8&&dx<20)stacked++;",
  "}",
  "}",
  "return {release,delayedDrift,done:raceFinished.length,firstWidth,rail,outer,minSep,stops,postStops,sideOnly,stacked,marks,maxSteeringError,results:raceHorses.map(h=>({time:h.finishTime,energy:h.energy}))};"
 ].join('\n');
 return new Function('distance','variant','overrides','pace','raceTacticalContext','tacticalRaceTarget','tacticalEnergyCost',source)(distance,variant,overrides,pace,...tactics);
}

for(const distance of [1400,2400,3400])test('pace classes, energy and safety '+distance,()=>{
 const runs=['slow','middle','high'].map(p=>sim(distance,'actual',{},p));
 for(const r of runs){
  assert.equal(r.done,18);assert.equal(r.stops,0);assert.equal(r.sideOnly,0);
  assert.ok(r.minSep>=1.48);assert.ok(r.rail>=2.8-1e-7);assert.ok(r.outer>=1.48-1e-7);
 }
 const times=runs.map(r=>Math.min(...r.results.map(h=>h.time)));
 const energy=runs.map(r=>r.results.reduce((v,h)=>v+h.energy,0)/18);
 assert.ok(times[0]>times[1]&&times[1]>times[2]);
 assert.ok(energy[0]>energy[1]&&energy[1]>energy[2]);
});
test('distance fit is relative and equal distances have full fit',()=>{
 for(const d of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  assert.equal(distanceFit(d,d),1);
  assert.ok(distanceFit(d,d*1.2)>distanceFit(d,d*1.6));
 }
 assert.equal(resolveRacePace({pace:'high'},0).kind,'high');
 assert.equal(resolveRacePace({pace:'slow'},18).kind,'slow');
});
test('gate reactions and flow mode are deterministic and bounded',()=>{
 const source=['flowHash','startRiskProbability','sampleStartDelay','runnerFlow'].map(fn).join('\n');
 const {sampleStartDelay,runnerFlow}=new Function('const THREE={MathUtils:{clamp:(x,a,b)=>Math.max(a,Math.min(b,x))}};'+source+';return {sampleStartDelay,runnerFlow}')();
 for(let seed=1;seed<=100;seed++){
  assert.ok(sampleStartDelay(1,seed,0,10,'real')<=sampleStartDelay(1,seed,0,1,'real'));
  assert.equal(sampleStartDelay(1,seed,0,5,'standard'),0);
  const real=runnerFlow(seed,1,'real'),chaos=runnerFlow(seed,1,'chaos');
  assert.deepEqual(real,runnerFlow(seed,1,'real'));
  assert.ok(Math.abs(chaos.form)>=Math.abs(real.form));
 }
});
