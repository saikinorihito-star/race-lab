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

test('official horses stay clear of the inner and outer turf rails across widths',()=>{
 for(const width of [24,28,31,33,36,39,41]){
  for(const i of [0,1]){
   const position=lane(width,i);
   const innerClearance=width/2-position;
   const outerClearance=width/2+position;
   assert.ok(innerClearance>=SAFE-1e-9,{width,i,innerClearance});
   assert.ok(outerClearance>1.5,{width,i,outerClearance});
  }
 }
});

test('pair review moves on stable parallel lanes, without invoking 18-horse avoidance logic',()=>{
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const widthAt=d=>36+5*Math.sin(d/2083.1*Math.PI*2+.5);
  const raceHorses=Array.from({length:2},(_,i)=>({
   number:i+1,distance:0,postDistance:0,lane:lane(widthAt(0),i),
   speed:0,finished:false,finishTime:null
  }));
  const ctx={activePlan:{distance},raceFinished:[],raceElapsed:0,raceHorses,
   fieldCenterAt:(_plan,d)=>({width:widthAt(d)}),pairRailLane:lane};
  const step=runInNewContext('('+extract('stepOfficialPair')+')',ctx);
  let minCloseSpacing=Infinity;
  for(let tick=0;tick<24000&&ctx.raceFinished.length<2;tick++){
   step(1/60);
   const [h0,h1]=raceHorses;
   for(const [i,h] of raceHorses.entries()){
    assert.ok(widthAt(h.distance)/2-h.lane>=SAFE-1e-8,
     'Inner rail clearance: '+distance+'m, horse '+(i+1));
   }
   if(Math.abs(h0.distance-h1.distance)<4)
    minCloseSpacing=Math.min(minCloseSpacing,Math.abs(h0.lane-h1.lane));
  }
  assert.equal(ctx.raceFinished.length,2,'Both test horses finish '+distance+'m');
  assert.ok(minCloseSpacing>=3.2,'Close-range horse-to-horse clearance '+distance+'m');
 }
});

class Vec3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 clone(){return new Vec3(this.x,this.y,this.z)}
 normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this}
 addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
}
const fakeThree={Vector3:Vec3,MathUtils:{
 lerp:(a,b,t)=>a+(b-a)*t,
 smoothstep:(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
}};

test('all pair tracking angles frame both if close, leader plus trailing course if far',()=>{
 for(const mode of ['field','side','front3q','chase']){
  for(const aspect of [.58,.85,1.7]){
   for(const gap of [0,8,14,20,27,50,95]){
    const ctx={THREE:fakeThree,stage:{clientWidth:800*aspect,clientHeight:800},
     activePlan:{distance:1400},raceHorses:[
      {distance:200,postDistance:0,lane:12.3},
      {distance:200-gap,postDistance:0,lane:8.95}
     ],fieldCenterAt:(_p,d)=>({p:new Vec3(d,0,0),t:new Vec3(1,0,0)}),
     fieldCameraShot:()=>{throw Error('Unexpected fallback camera')}};
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
