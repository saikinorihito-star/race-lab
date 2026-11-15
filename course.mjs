// Tokyo Racecourse turf profile. Official dimensions from JRA:
// https://www.jra.go.jp/facilities/race/tokyo/course/
// A/B/C/D laps: 2083.1/2101.9/2120.8/2139.6m; home straight 525.9m;
// total vertical relief 2.7m. TRACK SHAPE BELOW IS A SCHEMATIC, not
// a survey of the actual bends or metre-perfect start-pocket geometry.
export const TOKYO_TURF=Object.freeze({
  A:Object.freeze({lap:2083.1,minWidth:31,maxWidth:41,railShift:0}),
  B:Object.freeze({lap:2101.9,minWidth:28,maxWidth:38,railShift:3}),
  C:Object.freeze({lap:2120.8,minWidth:25,maxWidth:35,railShift:6}),
  D:Object.freeze({lap:2139.6,minWidth:22,maxWidth:32,railShift:9})
});
export const TOKYO_TURF_DISTANCES=Object.freeze([1400,1600,1800,2000,2300,2400,2500,2600,3400]);
export const HOME_STRAIGHT_METRES=525.9;
export const TRACK_ELEVATION_RANGE_METRES=2.7;
export const TRACK_LAP_LENGTH=TOKYO_TURF.A.lap;
export const HALF_LAP_LENGTH=TRACK_LAP_LENGTH; // Legacy import alias.
export const FINAL_STRAIGHT_START=1-HOME_STRAIGHT_METRES/2400; // Legacy default only.
export const LANE_WIDTH=1.55;
export const INSIDE_MARGIN=2.0;
export const TRACK_OUTER_OFFSET=31.5;
export const SCENE_METRE_SCALE=.4;
const STRAIGHT_METRES=620; // Schematic straight; not an official measurement.
const wrap=(value,length)=>((value%length)+length)%length;
const resolveCourse=(name)=>TOKYO_TURF[name]||TOKYO_TURF.A;


// 京都競馬場 / JRA turf data: https://www.jra.go.jp/facilities/race/kyoto/course/
// Both courses turn RIGHT; the inner and outer loops split at the third
// corner. Lengths/widths/straights and elevation ranges are official;
// curve shape and hill gradients are schematic for the simulator.
export const KYOTO_TURF=Object.freeze({
 inner:Object.freeze({
  A:Object.freeze({lap:1782.8,straight:328.4,minWidth:27,maxWidth:38,elevation:3.1}),
  B:Object.freeze({lap:1802.2,straight:323.4,minWidth:24,maxWidth:35,elevation:3.1}),
  C:Object.freeze({lap:1821.1,straight:323.4,minWidth:21,maxWidth:32,elevation:3.1}),
  D:Object.freeze({lap:1839.9,straight:323.4,minWidth:18,maxWidth:29,elevation:3.1})
 }),
 outer:Object.freeze({
  A:Object.freeze({lap:1894.3,straight:403.7,minWidth:24,maxWidth:38,elevation:4.3}),
  B:Object.freeze({lap:1913.6,straight:398.7,minWidth:21,maxWidth:35,elevation:4.3}),
  C:Object.freeze({lap:1932.4,straight:398.7,minWidth:18,maxWidth:32,elevation:4.3}),
  D:Object.freeze({lap:1951.3,straight:398.7,minWidth:15,maxWidth:29,elevation:4.3})
 })
});
export const KYOTO_TURF_DISTANCES=Object.freeze({
 inner:Object.freeze([1100,1200,1400,1600,2000]),
 outer:Object.freeze([1400,1600,1800,2000,2200,2400,3000,3200])
});
export function turfDistances(venue='tokyo',layout='outer'){
 return venue==='kyoto'?KYOTO_TURF_DISTANCES[layout==='inner'?'inner':'outer']:TOKYO_TURF_DISTANCES;
}
export function getTurfProfile(venue='tokyo',course='A',layout='outer'){
 const selection=['A','B','C','D'].includes(course)?course:'A';
 if(venue==='kyoto'){
  const side=layout==='inner'?'inner':'outer';
  return {...KYOTO_TURF[side][selection],venue:'kyoto',layout:side,course:selection,turn:'right'};
 }
 return {...TOKYO_TURF[selection],straight:HOME_STRAIGHT_METRES,elevation:TRACK_ELEVATION_RANGE_METRES,
  venue:'tokyo',layout:'outer',course:selection,turn:'left'};
}
function kyotoCoursePoint(distanceAfterFinish,offset,course,layout){
 const profile=getTurfProfile('kyoto',course,layout);
 const lap=profile.lap;
 // Straight lengths other than the home straight are visual approximations.
 const straight=layout==='inner'?520:540;
 const bend=(lap-2*straight)*.5;
 const radius=bend/Math.PI*SCENE_METRE_SCALE+offset;
 const half=straight*.5*SCENE_METRE_SCALE;
 const phase=wrap(Number(distanceAfterFinish)+profile.straight,lap);
 // Clockwise from above, starting east along the near straight.
 if(phase<straight)return {x:-half+phase*SCENE_METRE_SCALE,z:-radius,dx:1,dz:0,yaw:0};
 if(phase<straight+bend){
  const theta=Math.PI/2-(phase-straight)/bend*Math.PI;
  const dx=Math.sin(theta),dz=Math.cos(theta);
  return {x:half+Math.cos(theta)*radius,z:-Math.sin(theta)*radius,
   dx,dz,yaw:-Math.atan2(dz,dx)};
 }
 if(phase<2*straight+bend)
   return {x:half-(phase-straight-bend)*SCENE_METRE_SCALE,z:radius,dx:-1,dz:0,yaw:-Math.PI};
 const theta=-Math.PI/2-(phase-(2*straight+bend))/bend*Math.PI;
 const dx=Math.sin(theta),dz=Math.cos(theta);
 return {x:-half+Math.cos(theta)*radius,z:-Math.sin(theta)*radius,
  dx,dz,yaw:-Math.atan2(dz,dx)};
}

export function coursePoint(distanceAfterFinish,offset=0,course='A',venue='tokyo',layout='outer') {
 if(venue==='kyoto')return kyotoCoursePoint(distanceAfterFinish,offset,course,layout);
 const lap=resolveCourse(course).lap;
 const halfStraight=STRAIGHT_METRES*.5*SCENE_METRE_SCALE;
 const bendMetres=(lap-2*STRAIGHT_METRES)*.5;
 const radius=bendMetres/Math.PI*SCENE_METRE_SCALE+offset;
 // Zero: actual finish line, 525.9m after the 4th bend (home straight).
 // Travel is counter-clockwise: home straight east, turn north at right,
 // back straight west, then turn south at left.
 const phase=wrap(Number(distanceAfterFinish)+HOME_STRAIGHT_METRES,lap);
 if(phase<STRAIGHT_METRES){
   return {x:-halfStraight+phase*SCENE_METRE_SCALE,z:radius,dx:1,dz:0,yaw:0};
 }
 const firstEnd=STRAIGHT_METRES+bendMetres;
 if(phase<firstEnd){
   const theta=Math.PI/2-(phase-STRAIGHT_METRES)/bendMetres*Math.PI;
   const dx=Math.sin(theta),dz=-Math.cos(theta);
   return {x:halfStraight+Math.cos(theta)*radius,z:Math.sin(theta)*radius,
      dx,dz,yaw:-Math.atan2(dz,dx)};
 }
 const backEnd=firstEnd+STRAIGHT_METRES;
 if(phase<backEnd){
   return {x:halfStraight-(phase-firstEnd)*SCENE_METRE_SCALE,z:-radius,dx:-1,dz:0,yaw:Math.PI};
 }
 const theta=-Math.PI/2-(phase-backEnd)/bendMetres*Math.PI;
 const dx=Math.sin(theta),dz=-Math.cos(theta);
 return {x:-halfStraight+Math.cos(theta)*radius,z:Math.sin(theta)*radius,
    dx,dz,yaw:-Math.atan2(dz,dx)};
}
export function lengthAtMetres(progress,raceDistance){
 // Offset from the FINISH, in actual metres. At the start: -raceDistance.
 return Number(progress)-Number(raceDistance||2400);
}
// JRA furlong markers: 2, 4 and 6 signify 200m, 400m and 600m to go.
// Mount the posts on the infield side of the inner rail, clear of racing lanes.
export const FURLONG_MARKERS=Object.freeze([600,400,200]);
export function furlongMarkerPositions(course='A',venue='tokyo',layout='outer'){
 return FURLONG_MARKERS.map(remaining=>({
   remaining,number:String(remaining/100),
   point:coursePoint(-remaining,-3.2,course,venue,layout)
 }));
}
export function horseCoursePoint(progress,distance,lane,course='A',venue='tokyo',layout='outer'){
 return coursePoint(lengthAtMetres(progress,distance),INSIDE_MARGIN+
    Math.max(0,Math.min(17,Number(lane)||0))*LANE_WIDTH,course,venue,layout);
}
// Known from JRA: slope in home straight from 460m to 300m before finish.
// Height is a schematic ease, not an exact surveyed elevation profile.
export function courseHeightMetres(remaining,venue='tokyo',layout='outer',course='A') {
 if(venue==='kyoto'){
  const {lap,straight,elevation}=getTurfProfile(venue,course,layout);
  const r=wrap(Number(remaining)||0,lap);
  // Gradual climb into the third corner (approx. 1200-800m to go),
  // then descent toward the fourth corner, then level home straight.
  const high=800,climbStart=Math.min(lap-50,1200);
  if(r>=climbStart)return 0;
  if(r>=high){const u=(climbStart-r)/(climbStart-high);return elevation*(u*u*(3-2*u));}
  if(r>straight){const u=(high-r)/(high-straight);return elevation*(1-u*u*(3-2*u));}
  return 0;
 }
 // Tokyo: a visible uphill over the final 460-300m and a gentler
 // schematic descent elsewhere. Ensure identical height on both sides
 // of the finish / lap boundary, including for races over one lap.
 const lap=getTurfProfile('tokyo',course).lap;
 const r=wrap(Number(remaining)||0,lap);
 const height=TRACK_ELEVATION_RANGE_METRES;
 if(r<=300)return height;
 if(r<460){
   const u=(460-r)/160;
   return height*u*u*(3-2*u);
 }
 const downhillStart=lap-320;
 if(r<downhillStart)return 0;
 const u=(r-downhillStart)/(lap-downhillStart);
 return height*u*u*(3-2*u);
}
export function courseSlope(remaining,venue='tokyo',layout='outer',course='A'){
 if(venue==='kyoto'){
  const {lap,straight,elevation}=getTurfProfile(venue,course,layout);
  const r=wrap(Number(remaining)||0,lap),high=800,start=Math.min(lap-50,1200);
  if(r>=start||r<=straight)return 0;
  if(r>=high){const u=(start-r)/(start-high);return elevation*6*u*(1-u)/(start-high);}
  const u=(high-r)/(high-straight);
  return -elevation*6*u*(1-u)/(high-straight);
 }
 const lap=getTurfProfile('tokyo',course).lap;
 const r=wrap(Number(remaining)||0,lap);
 if(r>300&&r<460){
   const u=(460-r)/160;
   return TRACK_ELEVATION_RANGE_METRES*6*u*(1-u)/160;
 }
 if(r>lap-320&&r<lap){
   const u=(r-(lap-320))/320;
   return -TRACK_ELEVATION_RANGE_METRES*6*u*(1-u)/320;
 }
 return 0;
}
export function safeRacePositions(horses,lead,raceDistance,course='A',venue='tokyo',layout='outer') {
 const leadS=lengthAtMetres(lead,raceDistance);
 const placed=[],byId=new Map();
 const order=[...horses].sort((a,b)=>b.x-a.x||a.id-b.id);
 for(const horse of order){
   const offset=INSIDE_MARGIN+Math.max(0,Math.min(17,horse.lane))*LANE_WIDTH;
   let s=leadS-Math.max(0,lead-horse.x)*.82;
   let point=coursePoint(s,offset,course,venue,layout);
   for(let attempt=0;attempt<36;attempt++){
     let interfering=null;
     for(const ahead of placed){
       const dx=point.x-ahead.point.x,dz=point.z-ahead.point.z;
       const tx=(point.dx+ahead.point.dx)*.5,tz=(point.dz+ahead.point.dz)*.5;
       const along=Math.abs(dx*tx+dz*tz);
       const across=Math.abs(dx*tz-dz*tx);
       if(along<3.19&&across<1.20){interfering=ahead;break;}
     }
     if(!interfering)break;
     // The longitudinal safety gap is in display units; path s is now metres.
     s=Math.min(s,interfering.s-3.72/SCENE_METRE_SCALE);
     point=coursePoint(s,offset,course,venue,layout);
   }
   placed.push({id:horse.id,s,point});
   byId.set(horse.id,{s,point});
 }
 return byId;
}
const displayCache=new WeakMap();
function buildDisplay(race){
 const snapshots=[],lastS=new Map();
 let lastTime=null;
 for(const frame of race.frames){
   const lead=Math.max(...frame.horses.map(h=>h.x));
   const safe=safeRacePositions(frame.horses,lead,race.distance,race.course||'A',race.venue||'tokyo',race.layout||'outer');
   const byId=new Map();
   for(const h of frame.horses){
     const value=safe.get(h.id).s;
     const prev=lastS.get(h.id);
     // Retain forward-only movement but never jump faster than a plausible
     // visual racing pace. This limit applies to visual spacing only.
     const maxAdvance=22*Math.max(0,frame.t-(lastTime??frame.t));
     const s=prev===undefined?value:Math.min(Math.max(prev,value),prev+maxAdvance);
     lastS.set(h.id,s);byId.set(h.id,s);
   }
   snapshots.push({t:frame.t,byId});
   lastTime=frame.t;
 }
 return snapshots;
}
export function raceDisplayPositions(race,frame,distance=2400,course='A',venue='tokyo',layout='outer'){
 if(!race?.frames?.length){
   const lead=Math.max(...frame.horses.map(h=>h.x));
   return safeRacePositions(frame.horses,lead,distance,course,venue,layout);
 }
 let samples=displayCache.get(race);
 if(!samples){samples=buildDisplay(race);displayCache.set(race,samples);}
 const time=Math.max(samples[0].t,Math.min(samples[samples.length-1].t,Number(frame.t)||0));
 let lo=0,hi=samples.length-1;
 while(hi-lo>1){
   const mid=(lo+hi)>>1;
   if(samples[mid].t<=time)lo=mid;else hi=mid;
 }
 const a=samples[lo],b=samples[hi];
 const alpha=samples.length===1?0:Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t||1)));
 const result=new Map();
 for(const h of frame.horses){
   const start=a.byId.get(h.id),end=b.byId.get(h.id);
   if(start===undefined||end===undefined)continue;
   const s=start+(end-start)*alpha;
   const offset=INSIDE_MARGIN+Math.max(0,Math.min(17,h.lane))*LANE_WIDTH;
   result.set(h.id,{s,point:coursePoint(s,offset,race.course||course,race.venue||venue,race.layout||layout)});
 }
 return result;
}
