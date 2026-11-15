// Shared lightweight left-handed half-oval, used by 2D and 3D renderers.
// The course is schematic; race distances in meters are normalized to this track.
export const HALF_STRAIGHT=48;
export const TURN_RADIUS=28;
export const LANE_WIDTH=1.55;
export const INSIDE_MARGIN=2.0;
// Wide enough for 18 separate starting stalls, then tactical movement to the inner rail.
export const TRACK_OUTER_OFFSET=31.5;
export const HALF_LAP_LENGTH=HALF_STRAIGHT*2+Math.PI*TURN_RADIUS;
export const FINAL_STRAIGHT_START=(HALF_STRAIGHT+Math.PI*TURN_RADIUS)/HALF_LAP_LENGTH;

// Three.js uses +Y up, so a genuine LEFT TURN from +X bends toward -Z.
// Both map projections must use screenY=originY+worldZ*scale, avoiding a
// mirrored map that appears left-handed while 3D runs to the right.
export function coursePoint(s,offset=0) {
 const first=HALF_STRAIGHT;
 const curveEnd=HALF_STRAIGHT+Math.PI*TURN_RADIUS;
 if(s<first) {
  return {x:-HALF_STRAIGHT+s,z:TURN_RADIUS+offset,dx:1,dz:0,yaw:0};
 }
 if(s<curveEnd) {
  const theta=Math.PI/2-(s-first)/TURN_RADIUS;
  const radius=TURN_RADIUS+offset;
  const dx=Math.sin(theta),dz=-Math.cos(theta);
  // The bend is centered at x=0 and touches BOTH straights at x=0.
  // Previously +HALF_STRAIGHT added an unintended 48m jump at corner entry.
  return {x:Math.cos(theta)*radius,z:Math.sin(theta)*radius,
   dx,dz,yaw:-Math.atan2(dz,dx)};
 }
 const x=-(s-curveEnd);
 return {x,z:-TURN_RADIUS-offset,dx:-1,dz:0,yaw:Math.PI};
}
export function horseCoursePoint(raceMetres,raceDistance,lane) {
 const d=Math.max(1,Number(raceDistance)||2200);
 const s=Number(raceMetres)*HALF_LAP_LENGTH/d;
 return coursePoint(s,INSIDE_MARGIN+Math.max(0,Math.min(17,Number(lane)||0))*LANE_WIDTH);
}
export function lengthAtMetres(metres,raceDistance) {
 return Number(metres)*HALF_LAP_LENGTH/Math.max(1,Number(raceDistance)||2200);
}

// Render-only collision spacing for low-poly horse meshes.
// The race engine remains authoritative for ranks/speeds/lanes. This visual
// adjustment keeps the long cartoon silhouettes from intersecting on curves.
export function safeRacePositions(horses,lead,raceDistance) {
 const leadS=lengthAtMetres(lead,raceDistance);
 const placed=[],byId=new Map();
 const order=[...horses].sort((a,b)=>b.x-a.x||a.id-b.id);
 for(const horse of order){
   const offset=INSIDE_MARGIN+Math.max(0,Math.min(17,horse.lane))*LANE_WIDTH;
   let s=leadS-Math.max(0,lead-horse.x)*.82;
   let point=coursePoint(s,offset);
   for(let attempt=0;attempt<36;attempt++){
     let interfering=null;
     for(const ahead of placed){
       const dx=point.x-ahead.point.x,dz=point.z-ahead.point.z;
       const tx=(point.dx+ahead.point.dx)*.5,tz=(point.dz+ahead.point.dz)*.5;
       const along=Math.abs(dx*tx+dz*tz);
       const across=Math.abs(dx*tz-dz*tx);
       if(along<3.19 && across<1.20){interfering=ahead;break;}
     }
     if(!interfering)break;
     s=Math.min(s,interfering.s-3.72);
     point=coursePoint(s,offset);
   }
   placed.push({id:horse.id,s,point});
   byId.set(horse.id,{s,point});
 }
 return byId;
}


// All views share one time-continuous path for each simulated horse.
// The earlier frame-by-frame crowd solver could move a horse backwards when
// the ordering changed. Resolve the solver only at recorded keyframes, remove
// backward steps and interpolate the safe positions for all rendering modes.
const raceDisplayCache=new WeakMap();
function buildRaceDisplay(race){
 const samples=[];
 const lastS=new Map();
 for(const frame of race.frames){
   const lead=Math.max(...frame.horses.map(h=>h.x));
   const resolved=safeRacePositions(frame.horses,lead,race.distance);
   const byId=new Map();
   for(const horse of frame.horses){
     const raw=resolved.get(horse.id).s;
     const previous=lastS.get(horse.id);
     const smooth=previous===undefined?raw:Math.max(previous,raw);
     lastS.set(horse.id,smooth);
     byId.set(horse.id,smooth);
   }
   samples.push({t:frame.t,byId});
 }
 return samples;
}
export function raceDisplayPositions(race,frame,distance=2200){
 if(!race?.frames?.length){
   const lead=Math.max(...frame.horses.map(h=>h.x));
   return safeRacePositions(frame.horses,lead,distance);
 }
 let snapshots=raceDisplayCache.get(race);
 if(!snapshots){snapshots=buildRaceDisplay(race);raceDisplayCache.set(race,snapshots);}
 const time=Math.max(snapshots[0].t,Math.min(snapshots[snapshots.length-1].t,Number(frame.t)||0));
 let lo=0,hi=snapshots.length-1;
 while(hi-lo>1){
   const mid=(lo+hi)>>1;
   if(snapshots[mid].t<=time)lo=mid;else hi=mid;
 }
 const a=snapshots[lo],b=snapshots[hi];
 const fraction=snapshots.length===1?0:Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t||1)));
 const result=new Map();
 for(const horse of frame.horses){
   const start=a.byId.get(horse.id);
   const end=b.byId.get(horse.id);
   if(start===undefined||end===undefined)continue;
   const s=start+(end-start)*fraction;
   const offset=INSIDE_MARGIN+Math.max(0,Math.min(17,horse.lane))*LANE_WIDTH;
   result.set(horse.id,{s,point:coursePoint(s,offset)});
 }
 return result;
}
