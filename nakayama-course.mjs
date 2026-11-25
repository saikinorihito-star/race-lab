// Nakayama turf A, approximate plan geometry; distances calibrated in horizontal metres.
// Source: https://www.jra.go.jp/facilities/race/nakayama/course/
// No measured XY coordinates or individual width stations are published in the cited chart.
export const SPEC=Object.freeze({offset:0,innerLap:1667.1,outerLap:1839.7,straight:310,relief:5.3,steepStart:180,steepEnd:70,steepRise:2.2,maxGrade:2.24,innerWidth:[20,32],outerWidth:[24,32],turn:'right'});
export const DISTANCES=[1200,1600,1800,2000,2200,2500,2600,3200,3600,4000];
const lerp=(a,b,t)=>a+(b-a)*t;
// Fixed fine sampling makes horizontal arc length reproducible.
function cubic(a,b,c,d,n=600){return Array.from({length:n+1},(_,i)=>{const t=i/n,u=1-t;return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]})}
function straight(a,b,n=160){return Array.from({length:n+1},(_,i)=>[lerp(a[0],b[0],i/n),lerp(a[1],b[1],i/n)])}
function join(...paths){return paths.flatMap((p,i)=>i?p.slice(1):p)}
function arc(points){let length=0;const samples=points.map((p,i)=>{if(i)length+=Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1]);return {x:p[0],z:p[1],s:length}});return {samples,length}}
function calibrate(builder,target,lo,hi){
 if(arc(builder(lo)).length>target||arc(builder(hi)).length<target)throw Error('Geometry calibration range');
 for(let i=0;i<48;i++){const m=(lo+hi)/2;if(arc(builder(m)).length<target)lo=m;else hi=m}
 return builder((lo+hi)/2);
}
// Control points traced from the JRA schematic supplied by the user.
// Image-space x increases right; z increases down. Goal is the origin.
// Calibrate the common plan as a whole rather than stretching individual
// corners into long loops. The final straight is 310m by construction.
const G=[460,665],split=[215,380],merge=[967,359],home=[850,665];
// JRA-VAN: 1800m to turn 1 ~205m, hence 72.1m past the finish.
const firstTurnX=G[0]-72.1*(home[0]-G[0])/310;
const rawPre=join(straight(G,[firstTurnX,665]),
 cubic([firstTurnX,665],[275,665],[190,584],[190,478]),
 cubic([190,478],[190,450],[185,430],[191,420]),straight([191,420],split));
const rawInner=join(cubic(split,[255.8,312],[311,289],[390,289]),
 straight([390,289],[835,289]),cubic([835,289],[893,289],[934,328],merge));
const rawPost=join(cubic(merge,[1000,390],[1018,430],[1018,478]),
 cubic([1018,478],[1018,580],[965,665],home),straight(home,G));
const SX=310/(home[0]-G[0]);
function metric(points,sy){return points.map(p=>[(p[0]-G[0])*SX,(p[1]-G[1])*sy])}
const rawLoop=join(rawPre,rawInner,rawPost);
let low=.2,high=2;
for(let i=0;i<48;i++){const m=(low+high)/2;if(arc(metric(rawLoop,m)).length<SPEC.innerLap)low=m;else high=m}
const SY=(low+high)/2;
const pre=metric(rawPre,SY),innerBranch=metric(rawInner,SY),post=metric(rawPost,SY);
// Tangent-aligned approaches: the mile starts from a straight pocket and
// the 2500m start lies on the straight approach to the shared right turn.
const outerEntry=[278,275],outerExit=[780,359-(967-780)*31/33];
function outerTrace(depth){return metric(join(
 straight(split,outerEntry),
 cubic(outerEntry,[362,135],[380,80+depth],[470,80+depth]),
 cubic([470,80+depth],[620,80+depth],[710,outerExit[1]-70*31/33],outerExit),
 straight(outerExit,merge)),SY)}
const preLen=arc(pre).length,postLen=arc(post).length;
const innerLen=arc(innerBranch).length;
// Outer depth increases as its image-space y decreases.
const outerBranch=calibrate(k=>outerTrace(-k),SPEC.outerLap-preLen-postLen,-150,200);
export const LOOPS={inner:arc(join(pre,innerBranch,post)),outer:arc(join(pre,outerBranch,post))};
export const SECTIONS=Object.freeze({split:preLen,mergeInner:preLen+innerLen,
 mergeOuter:SPEC.outerLap-postLen,homeInner:SPEC.innerLap-SPEC.straight,
 homeOuter:SPEC.outerLap-SPEC.straight,sharedFinish:postLen,firstTurn:72.1,
 outerTurn2:preLen+arc(metric(straight(split,outerEntry),SY)).length,
 outerStraightToMerge:arc(metric(straight(outerExit,merge),SY)).length,
 innerTurn3:preLen+arc(metric(join(cubic(split,[255.8,312],[311,289],[390,289]),straight([390,289],[835,289])),SY)).length});
const mod=(x,m)=>(x%m+m)%m;
// Profile knots digitized approximately from provided JRA elevation diagrams.
// Shared segments use identical elevations. The 180–70m slope uses a piecewise
// gradient with exactly 2.2m gain and maximum 2.24%, not a visual exaggeration.
const riseRun=110,edge=(.0224*riseRun-2.2)/.0224;
function hill(rem){
 const u=180-rem,flat=.0224;
 if(u<=edge)return -2.45+flat*u*u/(2*edge);
 if(u>=riseRun-edge){const left=riseRun-u;return -.25-flat*left*left/(2*edge)}
 return -2.45+flat*(u-edge/2);
}
const commonEnd=[[0,0],[70,-.25],[180,-2.45],[240,-2.7],[310,-2.3],[400,-2.05],[600,-2.0]];
const innerProfile=[...commonEnd,[800,-2],[950,-1.6],[1150,.95],[1280,2.15],[1370,2.6],[1450,2.6],[1575,.85],[1667.1,0]];
function interp(points,r){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(r<=b[0])return lerp(a[1],b[1],(r-a[0])/(b[0]-a[0]))}return points.at(-1)[1]}
const splitInner=SPEC.innerLap-SECTIONS.split,splitOuter=SPEC.outerLap-SECTIONS.split;
const outerProfile=[[SECTIONS.sharedFinish,interp(innerProfile,SECTIONS.sharedFinish)],
 // JRA-VAN's ~4.4m descent for 1200m, interpreted to the exit of turn 4
 // (remaining 310m, -2.3m). Exact intermediate elevations are unavailable.
 [800,-1.8],[950,-1.1],[1200,2.1],[1300,2.14],[splitOuter,interp(innerProfile,splitInner)]];
export function altitude(kind,remaining){
 const lap=kind==='inner'?SPEC.innerLap:SPEC.outerLap;
 const r=mod(remaining,lap);
 if(r>=70&&r<=180)return hill(r);
 if(kind==='inner'||r<=SECTIONS.sharedFinish)return interp(innerProfile,r);
 if(r>=splitOuter)return interp(innerProfile,r-(SPEC.outerLap-SPEC.innerLap));
 return interp(outerProfile,r);
}
export function at(kind,station,rail='A'){
 if(rail!=='A')return railAt(kind,station,rail);
 const loop=LOOPS[kind],lap=kind==='inner'?SPEC.innerLap:SPEC.outerLap;
 const s=mod(station,lap),target=s/lap*loop.length,arr=loop.samples;
 let lo=0,hi=arr.length-1;while(hi-lo>1){const m=(hi+lo)>>1;if(arr[m].s<target)lo=m;else hi=m}
 const a=arr[lo],b=arr[hi],u=(target-a.s)/Math.max(1e-9,b.s-a.s),dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz)||1;
 return {x:lerp(a.x,b.x,u),z:lerp(a.z,b.z,u),y:altitude(kind,lap-s),tx:dx/n,tz:dz/n,kind,station:s};
}
export function widthAt(kind,station,rail='A'){
 if(rail!=='A')return railAt(kind,station,rail).width;
 const lap=kind==='inner'?SPEC.innerLap:SPEC.outerLap,s=mod(station,lap),rem=lap-s;
 if(rem<=SECTIONS.sharedFinish||s<=SECTIONS.split)return 24+8*Math.max(0,1-Math.min(rem,s)/420);
 const end=kind==='inner'?SECTIONS.mergeInner:SECTIONS.mergeOuter;
 const u=(s-SECTIONS.split)/(end-SECTIONS.split);
 const startWidth=24+8*Math.max(0,1-SECTIONS.split/420),base=lerp(startWidth,24,u);
 const peak=Math.sin(Math.PI*u)**2;
 return lerp(base,kind==='inner'?20:32,peak);
}
export const ROUTE_LABELS={1200:'外回り',1600:'外回り・ポケット',1800:'内回り',2000:'内回り',2200:'外回り',2500:'外回り発走→内回り',2600:'外回り',3200:'外回り発走→内回り',3600:'内回り・2周',4000:'外回り・2周'};
export function makeRoute(distance,rail='A'){
 const spec=railSpec(rail),sections=railSections(rail);
 if(!DISTANCES.includes(distance))throw Error('unsupported distance');
 const finalKind=[1800,2000,2500,3200,3600].includes(distance)?'inner':'outer';
 const lap=finalKind==='inner'?spec.innerLap:spec.outerLap;
 const n=Math.floor(distance/lap),partial=distance-n*lap;
 const initialKind=[2500,3200].includes(distance)?'outer':finalKind;
 const initialLap=initialKind==='inner'?spec.innerLap:spec.outerLap;
 // Both starts use the same left-side pocket and tangent join; 3200m
 // runs the outer partial lap and then one complete inner lap.
 const legs=[];
 const pocketJoin=railStation('outer',349.7,rail);
 if(distance===1600||distance===3200){
  const length=partial-(initialLap-pocketJoin);
  legs.push({kind:'pocket',length,joinKind:initialKind,joinStation:pocketJoin});
  legs.push({kind:initialKind,start:pocketJoin,length:initialLap-pocketJoin});
 }else if(partial>SPEC.straight&&[2000,2200,4000].includes(distance)){
  // Starts beyond the exit of turn 4 are on the straight extension.
  const length=partial-SPEC.straight;
  legs.push({kind:'chute',length,joinKind:initialKind,joinStation:initialLap-SPEC.straight});
  legs.push({kind:initialKind,start:initialLap-SPEC.straight,length:SPEC.straight});
 }else if(partial>0)legs.push({kind:initialKind,start:initialLap-partial,length:partial});
 for(let i=0;i<n;i++)legs.push({kind:finalKind,start:0,length:lap});
 return {distance,legs,label:ROUTE_LABELS[distance],finalKind,rail};
}
export function routeAt(route,distance){
 let d=Math.max(0,Math.min(route.distance,distance));
 for(let i=0;i<route.legs.length;i++){
  const leg=route.legs[i];
  if(d<=leg.length||i===route.legs.length-1){
   if(leg.kind==='pocket'||leg.kind==='chute'){
    const p=at(leg.joinKind,leg.joinStation,route.rail),remain=leg.length-d;
    // Use a shared physical extension for each pocket and continuous heights.
    // Pocket high point ~2.6m is inferred from the official section diagram.
    const spec=railSpec(route.rail),slope=leg.kind==='pocket'?(2.6-p.y)/Math.max(1,1600-(spec.outerLap-leg.joinStation)):-(at(leg.joinKind,leg.joinStation+1,route.rail).y-p.y);
    const y=p.y+remain*slope;
    const w=widthAt(leg.joinKind,leg.joinStation,route.rail),width=leg.kind==='pocket'?lerp(w,32-spec.offset,Math.min(1,remain/Math.max(1,1600-(spec.outerLap-leg.joinStation)))):w;
    // The chute is straight, not the preceding curve's sampled tangent.
    const tx=leg.kind==='chute'?-1:p.tx,tz=leg.kind==='chute'?0:p.tz;
    return {...p,x:p.x-tx*remain,z:p.z-tz*remain,y,tx,tz,kind:leg.kind,width};
   }
   const p=at(leg.kind,leg.start+d,route.rail);return {...p,width:widthAt(leg.kind,p.station,route.rail)};
  }
  d-=leg.length;
 }
 throw Error('empty route');
}
export function gradeAt(route,distance){
 const a=Math.max(0,distance-1),b=Math.min(route.distance,distance+1);
 return (routeAt(route,b).y-routeAt(route,a).y)/Math.max(.001,b-a)*100;
}

// Measured along the modeled inner-rail-plus-one-metre reference. A horse's
// lateral offset is positive outward; actual horizontal and 3D travel differ
// from advertised distance and can be used by a future race engine.
export function laneAt(route,distance,outward=0){
 const p=routeAt(route,distance),offset=Math.max(0,Math.min(p.width-2,outward==='center'?p.width/2-1:Number(outward)||0));
 return {...p,x:p.x+p.tz*offset,z:p.z-p.tx*offset,offset};
}
export function measureRoute(route,outward=0,step=.5){
 if(!Number.isFinite(step)||step<=0)throw Error('invalid sample interval');
 const n=Math.ceil(route.distance/step);
 let previous=laneAt(route,0,outward),horizontal=0,surface=0,ascent=0,descent=0;
 for(let i=1;i<=n;i++){
  const p=laneAt(route,route.distance*i/n,outward),ds=Math.hypot(p.x-previous.x,p.z-previous.z),dy=p.y-previous.y;
  horizontal+=ds;surface+=Math.hypot(ds,dy);ascent+=Math.max(0,dy);descent+=Math.max(0,-dy);previous=p;
 }
 return {horizontal,surface,ascent,descent,extra:horizontal-route.distance};
}
// Model curvature, not a claim about surveyed JRA turn radii.
export function curvatureAt(route,distance,span=4){
 const a=routeAt(route,Math.max(0,distance-span)),b=routeAt(route,Math.min(route.distance,distance+span));
 const ds=Math.min(route.distance,distance+span)-Math.max(0,distance-span);
 if(!ds)return 0;
 return Math.atan2(a.tx*b.tz-a.tz*b.tx,a.tx*b.tx+a.tz*b.tz)/ds;
}
export function courseLandmarks(distance,rail='A'){
 const route=makeRoute(distance,rail),spec=railSpec(rail),s=railSections(rail);
 const kinds=route.legs,marks=[];let traveled=0;
 // Model boundaries: explicit geometry-derived stations where available.
 // JRA does not publish surveyed corner-boundary coordinates.
 for(const leg of kinds){
  if(leg.kind==='pocket'||leg.kind==='chute'){traveled+=leg.length;continue}
  const lap=spec[leg.kind+'Lap'];
  const points=leg.kind==='inner'?
   [[s.firstTurn,'1コーナー入口'],[s.split,'2コーナー・分岐目安'],[s.innerTurn3,'3コーナー入口目安'],[s.mergeInner,'3〜4コーナー共通区間']]:
   [[s.firstTurn,'1コーナー入口'],[s.outerTurn2,'2コーナー入口'],[railStation('outer',894.7,rail),'3コーナー入口目安'],[s.mergeOuter,'内外合流・4コーナー方面']];
  for(const [station,name] of points){
   if(station>=leg.start&&station<leg.start+leg.length)
    marks.push({name,distance:traveled+station-leg.start,source:'モデル境界（近似）'});
  }
  traveled+=leg.length;
 }
 return marks;
}
// Visual-only dirt course: separately calibrated reference loop and section
// based on JRA's 1493m / 308m / 4.5m / 20–25m specifications.
// Absolute elevation relative to turf and surveyed offsets are not known.
export const DIRT_SPEC=Object.freeze({lap:1493,straight:308,relief:4.5,widthMin:20,widthMax:25});
function dirtPlan(offset){
 const n=Math.ceil(SPEC.innerLap/.5);
 return Array.from({length:n+1},(_,i)=>{
  const p=at('inner',SPEC.innerLap*i/n);
  return [(p.x-p.tz*offset)*DIRT_SPEC.straight/SPEC.straight,p.z+p.tx*offset];
 });
}
const dirtLoop=arc(calibrate(k=>dirtPlan(-k),DIRT_SPEC.lap,-35,-20));
const dirtProfile=[[0,0],[70,-.2],[180,-2.4],[260,-2.5],[400,-2.5],[550,-2.1],[900,-1.4],[1080,1.4],[1300,2],[1493,0]];
export function dirtAt(station){
 const s=mod(station,DIRT_SPEC.lap),arr=dirtLoop.samples,target=s/ DIRT_SPEC.lap*dirtLoop.length;
 let lo=0,hi=arr.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(arr[m].s<target)lo=m;else hi=m}
 const a=arr[lo],b=arr[hi],u=(target-a.s)/Math.max(1e-9,b.s-a.s),dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz)||1;
 return {x:lerp(a.x,b.x,u),z:lerp(a.z,b.z,u),y:interp(dirtProfile,DIRT_SPEC.lap-s),tx:dx/n,tz:dz/n,
  width:20+5*Math.max(0,1-Math.min(s,DIRT_SPEC.lap-s)/420),kind:'dirt',station:s};
}
export const DIRT_MODEL_LENGTH=dirtLoop.length;

// B/C are parallel outward reference lines, not stretched A routes.
// Published lap rounding is assigned only to the divergent branch, preserving
// the common physical segment stations and the 310m home straight.
export const RAILS=Object.freeze({
 A:SPEC,
 B:Object.freeze({...SPEC,offset:3,innerLap:1686,outerLap:1858.5,innerWidth:[17,29],outerWidth:[21,29]}),
 C:Object.freeze({...SPEC,offset:6,innerLap:1704.8,outerLap:1877.3,innerWidth:[14,26],outerWidth:[18,26]})
});
export function railSpec(rail='A'){if(!Object.hasOwn(RAILS,rail))throw Error('unsupported rail');return RAILS[rail]}
const railModels={};
function buildRail(rail,kind){
 const spec=railSpec(rail),lap=SPEC[kind+'Lap'],merge=SECTIONS[kind==='inner'?'mergeInner':'mergeOuter'];
 const knots=[0,SECTIONS.firstTurn,SECTIONS.split,merge,lap-310,lap];
 const segments=knots.slice(0,-1).map((start,j)=>{
  const end=knots[j+1],n=Math.ceil((end-start)/.35),points=[];
  for(let i=0;i<=n;i++){
   const s=lerp(start,end,i/n),p=at(kind,s),prev=at(kind,s-.15),next=at(kind,s+.15);
   const dx=next.x-prev.x,dz=next.z-prev.z,norm=Math.hypot(dx,dz)||1;
   points.push({a:s,x:p.x+dz/norm*spec.offset,z:p.z-dx/norm*spec.offset,y:p.y});
  }
  let len=0;points.forEach((p,i)=>{if(i)len+=Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z);p.s=len});
  return {start,end,points,len,target:len};
 });
 // Preserve exact straight boundaries. The small correction from published
 // rounding is applied to the nonshared section only.
 segments[0].target=SECTIONS.firstTurn;segments[4].target=310;
 segments[2].target=spec[kind+'Lap']-segments.filter((_,i)=>i!==2).reduce((a,p)=>a+p.target,0);
 let station=0;for(const seg of segments){seg.station=station;station+=seg.target;}
 return {kind,segments,lap:spec[kind+'Lap']};
}
function models(rail){
 railSpec(rail);
 if(!railModels[rail])railModels[rail]={inner:buildRail(rail,'inner'),outer:buildRail(rail,'outer')};
 return railModels[rail];
}
function findSample(arr,x,key){
 let lo=0,hi=arr.length-1;while(hi-lo>1){const mid=(hi+lo)>>1;if(arr[mid][key]<x)lo=mid;else hi=mid}return [arr[lo],arr[hi]];
}
export function railStation(kind,a,rail='A'){
 if(rail==='A')return a;
 const m=models(rail)[kind],seg=m.segments.find(s=>a<=s.end+1e-8)||m.segments.at(-1);
 const [p,q]=findSample(seg.points,a,'a'),u=(a-p.a)/Math.max(1e-9,q.a-p.a);
 return seg.station+lerp(p.s,q.s,u)*seg.target/seg.len;
}
export function railSections(rail='A'){
 if(rail==='A')return SECTIONS;
 const s=(kind,v)=>railStation(kind,v,rail),spec=railSpec(rail);
 return {split:s('inner',SECTIONS.split),mergeInner:s('inner',SECTIONS.mergeInner),mergeOuter:s('outer',SECTIONS.mergeOuter),
 firstTurn:s('inner',SECTIONS.firstTurn),homeInner:spec.innerLap-310,homeOuter:spec.outerLap-310,
 sharedFinish:spec.innerLap-s('inner',SECTIONS.mergeInner),outerTurn2:s('outer',SECTIONS.outerTurn2),
 outerStraightToMerge:s('outer',SECTIONS.mergeOuter)-s('outer',SECTIONS.mergeOuter-SECTIONS.outerStraightToMerge),
 innerTurn3:s('inner',SECTIONS.innerTurn3)};
}
function railAt(kind,station,rail){
 const m=models(rail)[kind],s=mod(station,m.lap),seg=m.segments.find(v=>s<=v.station+v.target+1e-8)||m.segments.at(-1);
 const target=(s-seg.station)*seg.len/seg.target,[p,q]=findSample(seg.points,target,'s'),u=Math.max(0,Math.min(1,(target-p.s)/Math.max(1e-9,q.s-p.s)));
 const a=lerp(p.a,q.a,u),base=at(kind,a);
 return {x:lerp(p.x,q.x,u),z:lerp(p.z,q.z,u),y:base.y,tx:base.tx,tz:base.tz,station:s,kind,width:widthAt(kind,a)-railSpec(rail).offset};
}
