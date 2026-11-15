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
// The right-handed Kyoto inner/outer loops share the home straight,
// turns 1-2 and back straight. They diverge through turns 3-4 and rejoin
// on the home straight, as in JRA's course diagram. The bend is a C1
// Bezier approximation, NOT a surveyed plan of the real course.
function kyotoCoursePoint(distanceAfterFinish,offset,course,layout){
 const profile=getTurfProfile('kyoto',course,layout);
 const lap=profile.lap;
 const phase=wrap(Number(distanceAfterFinish)||0,lap);
 const firstStraight=200,firstBend=370,backStraight=520;
 const lastBend=lap-firstStraight-firstBend-backStraight-profile.straight;
 const radius=47.1+offset;
 const turnEndX=104,goalX=24;
 const firstCornerStart=firstStraight;
 const firstCornerEnd=firstCornerStart+firstBend;
 const backEnd=firstCornerEnd+backStraight;
 const homeStart=lap-profile.straight;
 const homeExitX=goalX-profile.straight*SCENE_METRE_SCALE;
 if(phase<firstCornerStart){
   return {x:goalX+phase*SCENE_METRE_SCALE,z:-radius,dx:1,dz:0,yaw:0};
 }
 if(phase<firstCornerEnd){
   const theta=Math.PI/2-(phase-firstCornerStart)/firstBend*Math.PI;
   const dx=Math.sin(theta),dz=Math.cos(theta);
   return {x:turnEndX+Math.cos(theta)*radius,z:-Math.sin(theta)*radius,
      dx,dz,yaw:-Math.atan2(dz,dx)};
 }
 if(phase<backEnd){
   return {x:turnEndX-(phase-firstCornerEnd)*SCENE_METRE_SCALE,z:radius,
     dx:-1,dz:0,yaw:Math.PI};
 }
 if(phase<homeStart){
   const t=Math.max(0,Math.min(1,(phase-backEnd)/(lastBend||1)));
   const a=1-t,b=t;
   const x0=-104,x3=homeExitX;
   const x1=x0-radius*1.30,x2=x3-radius*1.30;
   const x=a*a*a*x0+3*a*a*b*x1+3*a*b*b*x2+b*b*b*x3;
   const z=radius*(a*a*a+3*a*a*b-3*a*b*b-b*b*b);
   const ddx=3*a*a*(x1-x0)+6*a*b*(x2-x1)+3*b*b*(x3-x2);
   const ddz=-12*radius*a*b;
   const norm=Math.hypot(ddx,ddz)||1;
   const dx=ddx/norm,dz=ddz/norm;
   return {x,z,dx,dz,yaw:-Math.atan2(dz,dx)};
 }
 return {x:homeExitX+(phase-homeStart)*SCENE_METRE_SCALE,z:-radius,
   dx:1,dz:0,yaw:0};
}

export function coursePoint(distanceAfterFinish,offset=0,course='A',venue='tokyo',layout='outer') {
 // The rail width changes with A-D selection. This is a *visual*
 // proportional adjustment; detailed sectional width positions are unknown.
 const profile=getTurfProfile(venue,course,layout);
 const visualOffset=offset*profile.maxWidth/41;
 if(venue==='kyoto')return kyotoCoursePoint(distanceAfterFinish,visualOffset,course,layout);
 const lap=resolveCourse(course).lap;
 offset=visualOffset;
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
// Documented start pockets / straight extensions.
// The exact joining coordinates are not available; pocket length and
// placement are deliberately schematic, but path position AND tangent are
// continuous at the join. All other distances use the ordinary oval.
export function startPocket(venue='tokyo',layout='outer',distance=2400){
 if(venue==='tokyo'&&Number(distance)===1800)
   return {joinRemaining:1550,kind:'Tokyo 1800m start pocket (schematic)'};
 if(venue==='kyoto'&&Number(distance)===1600&&layout==='inner')
   return {joinRemaining:1200,kind:'Kyoto 1600m inner extension (schematic)'};
 if(venue==='kyoto'&&layout==='outer'&&[1600,1800].includes(Number(distance)))
   return {joinRemaining:1320,kind:'Kyoto 1600/1800m outer extension (schematic)'};
 return null;
}
export function raceCoursePoint(s,offset=0,raceDistance=2400,course='A',venue='tokyo',layout='outer'){
 const pocket=startPocket(venue,layout,raceDistance);
 if(pocket&&s<-pocket.joinRemaining){
   const join=coursePoint(-pocket.joinRemaining,offset,course,venue,layout);
   const delta=(s+pocket.joinRemaining)*SCENE_METRE_SCALE;
   return {x:join.x+join.dx*delta,z:join.z+join.dz*delta,
      dx:join.dx,dz:join.dz,yaw:join.yaw};
 }
 return coursePoint(s,offset,course,venue,layout);
}
export function raceCourseHeightMetres(remaining,raceDistance=2400,venue='tokyo',layout='outer',course='A'){
 const pocket=startPocket(venue,layout,raceDistance);
 return courseHeightMetres(pocket&&remaining>pocket.joinRemaining?pocket.joinRemaining:remaining,venue,layout,course);
}
export function raceCourseSlope(remaining,raceDistance=2400,venue='tokyo',layout='outer',course='A'){
 const pocket=startPocket(venue,layout,raceDistance);
 if(pocket&&remaining>pocket.joinRemaining)return 0;
 return courseSlope(remaining,venue,layout,course);
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
 return raceCoursePoint(lengthAtMetres(progress,distance),INSIDE_MARGIN+
    Math.max(0,Math.min(17,Number(lane)||0))*LANE_WIDTH,distance,course,venue,layout);
}
// JRA-verified slope facts:
// Tokyo: 1.9m descent (first corner -> back straight), 1.5m rise before
// turn three, 2.0m rise over the last 460-300m; full vertical range 2.7m.
// Kyoto: inner full range 3.1m, outer 4.3m. JRA's 2026 Kyoto 1600m
// description places an OUTER course climb of ~3.9m, crest ~800m to go.
// Exact longitudinal survey stations and local gradients are not published
// in the source material. The intermediate knots below are explicitly
// illustrative and MUST NOT be treated as measured elevation samples.
const elevationKnotsCache=new Map();
function elevationKnots(venue='tokyo',layout='outer',course='A'){
 const key=[venue,layout,course].join(':');
 let knots=elevationKnotsCache.get(key);
 if(knots)return knots;
 const profile=getTurfProfile(venue,course,layout);
 const lap=profile.lap;
 if(venue==='kyoto'){
   const foot=layout==='outer'?.4:0;
   const crest=profile.elevation;
   const lowerBound=profile.straight+65;
   knots=[
    [0,0],[lowerBound,0],
    [800,crest],
    [1200,foot],
    [1350,0],
    [lap,0]
   ];
 }else{
   // Height is relative to the low point; values 0..2.7m. Peaks are
   // placed to honor the verified relative climbs, not to assert GPS points.
   knots=[
     [0,2.0],[300,2.0],[460,0],
     [620,0],[760,.25],[980,2.3],[1120,2.3],
     [1300,.8],[1420,.8],[1750,2.7],
     [lap-170,2.7],[lap,2.0]
   ];
 }
 elevationKnotsCache.set(key,knots);
 return knots;
}
function elevationAt(remaining,venue='tokyo',layout='outer',course='A'){
 const lap=getTurfProfile(venue,course,layout).lap;
 const r=wrap(Number(remaining)||0,lap);
 const knots=elevationKnots(venue,layout,course);
 let low=0,high=knots.length-1;
 while(high-low>1){
   const mid=(low+high)>>1;
   if(r>=knots[mid][0])low=mid;else high=mid;
 }
 const a=knots[low],b=knots[high],range=b[0]-a[0];
 const u=Math.max(0,Math.min(1,(r-a[0])/(range||1)));
 const ease=u*u*(3-2*u);
 const h=a[1]+(b[1]-a[1])*ease;
 // Positive uphill gradient when moving toward the goal (remaining falls).
 const slope=-(b[1]-a[1])*6*u*(1-u)/(range||1);
 return {h,slope};
}
export function courseHeightMetres(remaining,venue='tokyo',layout='outer',course='A'){
 return elevationAt(remaining,venue,layout,course).h;
}
export function courseSlope(remaining,venue='tokyo',layout='outer',course='A'){
 return elevationAt(remaining,venue,layout,course).slope;
}
export function safeRacePositions(horses,lead,raceDistance,course='A',venue='tokyo',layout='outer') {
 const leadS=lengthAtMetres(lead,raceDistance);
 const placed=[],byId=new Map();
 const order=[...horses].sort((a,b)=>b.x-a.x||a.id-b.id);
 for(const horse of order){
   const offset=INSIDE_MARGIN+Math.max(0,Math.min(17,horse.lane))*LANE_WIDTH;
   let s=leadS-Math.max(0,lead-horse.x)*.82;
   let point=raceCoursePoint(s,offset,raceDistance,course,venue,layout);
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
     point=raceCoursePoint(s,offset,raceDistance,course,venue,layout);
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
   result.set(h.id,{s,point:raceCoursePoint(s,offset,race.distance||distance,race.course||course,race.venue||venue,race.layout||layout)});
 }
 return result;
}
