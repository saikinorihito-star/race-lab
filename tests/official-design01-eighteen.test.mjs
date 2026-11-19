import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function fn(name){
 const p=html.indexOf('function '+name+'('),e=html.indexOf('\n}\n',p);
 assert.ok(p>=0&&e>p,'Missing actual function '+name);
 return html.slice(p,e+2);
}
function sim(distance,variant='actual'){
 const p4=html.match(/const FOUR_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 const p8=html.match(/const EIGHT_PACE_PROFILES=\[[\s\S]*?\];/)?.[0];
 const p18=html.match(/const EIGHTEEN_PACE_PROFILES=Array\.from\([\s\S]*?\n\}\);/)?.[0];
 const width=html.match(/function widthAt\(s\)\{[^\n]*\}/)?.[0];
 assert.ok(p4&&p8&&p18&&width);
 const names=['pairRailLane','fourHorseInnerLane','eightStartLane','eighteenStartLane',
  'officialReviewLane','fourHorseSafeStep','eightHorseSafeStep','eighteenHorseSafeStep','stepOfficialPair'];
 const source=[
  "const THREE={MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};",
  "const PAIR_RAIL_CENTER_CLEARANCE=3.7,PAIR_LANE_SPACING=3.35,FOUR_RAIL_CENTER_CLEARANCE=2.8,FOUR_START_OUTSIDE_OFFSET=8,FOUR_INWARD_SETTLE_DISTANCE=160,FOUR_MIN_LONGITUDINAL=4.8,FOUR_LATERAL_SHARED=3.05,FOUR_INWARD_RATE=4.4,FOUR_MAX_LATERAL_PER_FORWARD=.30,EIGHT_MERGE_LONGITUDINAL_BUFFER=4.0,EIGHTEEN_MERGE_LONGITUDINAL_BUFFER=6.0,EIGHTEEN_SPACING_FROM=300,EIGHTEEN_MIN_ROLL_BASE=10.4,EIGHTEEN_MIN_ROLL_STAGGER=.01;",
  "const isOfficialEighteenTest=true,isOfficialEightTest=false,isOfficialFourTest=false,isOfficialMultiTest=true,OFFICIAL_TEST_COUNT=18;",
  width,p4,p8,p18,...names.map(fn),
  "const LAP=2083.1,FINISH_DISTANCE=525.9,startStation=((FINISH_DISTANCE-distance)%LAP+LAP)%LAP;",
  "const activePlan={distance};",
  "const fieldCenterAt=(_p,d)=>({width:variant==='actual'?widthAt(startStation+d):variant==='pocket24'?(d<250?24:d<310?24+12*(d-250)/60:36):(d<250?28:d<310?28+8*(d-250)/60:36)});",
  "let raceElapsed=0,raceFinished=[];const firstWidth=fieldCenterAt(activePlan,0).width;",
  "const raceHorses=Array.from({length:18},(_,i)=>({idx:i,number:i+1,distance:0,postDistance:0,speed:0,finished:false,slot:i,lane:eighteenStartLane(firstWidth,i)}));",
  "let rail=Infinity,outer=Infinity,minSep=Infinity,stops=0,postStops=0,sideOnly=0,stacked=0;",
  "const marks={};",
  "for(let tick=0;tick<32000&&raceFinished.length<18;tick++){",
  "const before=raceHorses.map(h=>({d:h.distance,l:h.lane,p:h.postDistance||0,f:h.finished}));",
  "stepOfficialPair(1/60);",
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
  "const dx=h.distance-b.d,side=Math.max(0,h.lane-b.l);",
  "if(h.distance>30&&(h.speed<8||dx<.03))stops++;",
  "if(side>dx*.30001+.000001)sideOnly++;",
  "}",
  "for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){",
  "const a=live[i],b=live[j],dx=Math.abs(a.distance-b.distance),dy=Math.abs(a.lane-b.lane);",
  "minSep=Math.min(minSep,Math.hypot(dx,dy));",
  "if(dy<2.35&&dx>4.8&&dx<20)stacked++;",
  "}",
  "}",
  "return {done:raceFinished.length,firstWidth,rail,outer,minSep,stops,postStops,sideOnly,stacked,marks};"
 ].join('\n');
 return new Function('distance','variant',source)(distance,variant);
}

test('18 horses keep the approved original Design01 GLB, rig and animation',()=>{
 assert.match(html,/const isOfficialEighteenTest=isDesign01Review&&qs\.get\('group'\)==='18'/);
 assert.match(html,/const OFFICIAL_TEST_COUNT=isOfficialEighteenTest\?18:isOfficialEightTest\?8:isOfficialFourTest\?4:2/);
 assert.match(fn('initializeOfficialPair'),/cloneSkeleton\(source\)/);
 assert.match(fn('initializeOfficialPair'),/requestAnimationFrame\(resolve\)/);
 assert.match(html,/await initializeOfficialPair\(horse,/);
 assert.match(fn('updateOfficialPair'),/h\.mixer\.setTime\(gaitTime\)/);
 assert.match(html,/official-meshy-blue-ribbon-original-geometry-gallop-v2-20261119/);
});

test('18 starting stalls fit the modeled 24 to 41m track widths',()=>{
 const start=new Function('PAIR_LANE_SPACING','FOUR_RAIL_CENTER_CLEARANCE','fourHorseInnerLane',
  'return ('+fn('eighteenStartLane')+')')(3.35,2.8,w=>w/2-2.8);
 for(const w of [24,28,31,36,41]){
  const lanes=Array.from({length:18},(_,i)=>start(w,i));
  assert.ok(w/2-lanes[0]>=2.8-1e-7);
  assert.ok(w/2+lanes[17]>=1.48);
  for(let i=1;i<18;i++)assert.ok(lanes[i-1]-lanes[i]>=1.1);
 }
});

test('all 18 finish every actual Tokyo turf course without stopped or overlapping horses',()=>{
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const r=sim(distance);
  assert.equal(r.done,18,'All horses finish '+distance);
  assert.equal(r.stops,0,'No race stoppage '+distance);
  assert.equal(r.postStops,0,'No early finisher freeze '+distance);
  assert.equal(r.sideOnly,0,'No stationary sideways movement '+distance);
  assert.ok(r.rail>=2.8-1e-7,'Inner rail clearance '+distance);
  assert.ok(r.outer>=1.48-1e-7,'Outer rail clearance '+distance);
  assert.ok(r.minSep>=1.48,'No overlapping horse centers '+distance);
  assert.ok(r.stacked>100,'Longitudinal grouping '+distance);
 }
});

test('18 runners form a compact 2 to 4 lane field at the 200m point',()=>{
 const r=sim(1400);
 assert.ok(r.marks[200].near>=10,'At least ten approach the inside');
 assert.ok(r.marks[200].near<18,'Leave outside lanes for other runners');
 assert.ok(r.marks[200].spread<45,'Avoid unrealistically long early queue');
 assert.equal(r.stops,0);
});

test('18 runners finish narrow 24m and 28m pocket course variants',()=>{
 for(const variant of ['pocket24','pocket28'])for(const d of [1400,1800,2400]){
  const r=sim(d,variant);
  assert.equal(r.done,18);
  assert.equal(r.stops,0);
  assert.equal(r.postStops,0);
  assert.equal(r.sideOnly,0);
  assert.ok(r.rail>=2.8-1e-7);
  assert.ok(r.outer>=1.48-1e-7);
  assert.ok(r.minSep>=1.08,'Narrow gate separates models');
 }
});

test('18-runners camera and automatic resolution retain the source model',()=>{
 assert.match(fn('officialPairCameraShot'),/isOfficialEighteenTest\?\(1-blend\)\*47/);
 assert.match(html,/renderQuality\.value='auto'/);
 assert.match(html,/autoTune18HorseResolution\(fps\)/);
 assert.match(html,/auto18SlowWindows>=2/);
 assert.match(html,/const EIGHTEEN_MERGE_LONGITUDINAL_BUFFER=6\.0/);
 assert.match(html,/const EIGHTEEN_SPACING_FROM=300/);
});
