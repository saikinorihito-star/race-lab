// Nakayama turf A, approximate plan geometry; distances calibrated in horizontal metres.
// Source: https://www.jra.go.jp/facilities/race/nakayama/course/
// No measured XY coordinates or individual width stations are published in the cited chart.
export const SPEC=Object.freeze({innerLap:1667.1,outerLap:1839.7,straight:310,relief:5.3,steepStart:180,steepEnd:70,steepRise:2.2,maxGrade:2.24,innerWidth:[20,32],outerWidth:[24,32],turn:'right'});
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
const G=[0,0],split=[-200,-180],merge=[260,-120],home=[310,0],firstTurn=[-72.1,0];
const pre=calibrate(k=>join(straight(G,firstTurn),cubic(firstTurn,[-72.1-k,0],[-200-k,-180],split)),517.1,50,500);
const post=calibrate(k=>join(cubic(merge,[260+k,-120+k*.5],[310+k,0],home),straight(home,G)),600,50,500);
const branch=(z)=>join(cubic(split,[-100,-180],[-90,z],[30,z]),cubic([30,z],[150,z],[140,-180],merge));
const innerBranch=calibrate(k=>branch(-180-k),550,0,450);
const outerBranch=calibrate(k=>branch(-180-k),722.6,0,600);
export const LOOPS={inner:arc(join(pre,innerBranch,post)),outer:arc(join(pre,outerBranch,post))};
export const SECTIONS={split:517.1,mergeInner:1067.1,mergeOuter:1239.7,homeInner:1357.1,homeOuter:1529.7};
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
const profiles={
 inner:[...commonEnd,[750,-2],[950,-1.6],[1150,.95],[1280,2.05],[1370,2.6],[1450,2.6],[1575,.85],[1667.1,0]],
 outer:[...commonEnd,[750,-2],[970,-1.2],[1200,1.45],[1270,2.05],[1440,2.05],[1542.6,2.6],[1622.6,2.6],[1747.6,.85],[1839.7,0]]
};
 // At split, both branches must have identical elevation. At merge, both are -2.
profiles.inner=profiles.inner.filter(p=>p[0]!==1150);profiles.inner.push([1150,1.45]);profiles.inner.sort((a,b)=>a[0]-b[0]);
profiles.outer.push([1322.6,1.45]);profiles.outer.sort((a,b)=>a[0]-b[0]);
// Keep common pre-split height values identical by mapping remaining distance.
function interp(points,r){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(r<=b[0])return lerp(a[1],b[1],(r-a[0])/(b[0]-a[0]))}return points.at(-1)[1]}
export function altitude(kind,remaining){
 const lap=kind==='inner'?SPEC.innerLap:SPEC.outerLap;
 const r=mod(remaining,lap);
 if(r>=70&&r<=180)return hill(r);
 if(kind==='outer'&&r>=1322.6)return interp(profiles.inner,r-172.6);
 return interp(profiles[kind],r);
}
export function at(kind,station){
 const loop=LOOPS[kind],lap=kind==='inner'?SPEC.innerLap:SPEC.outerLap;
 const s=mod(station,lap),target=s/lap*loop.length,arr=loop.samples;
 let lo=0,hi=arr.length-1;while(hi-lo>1){const m=(hi+lo)>>1;if(arr[m].s<target)lo=m;else hi=m}
 const a=arr[lo],b=arr[hi],u=(target-a.s)/Math.max(1e-9,b.s-a.s),dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz)||1;
 return {x:lerp(a.x,b.x,u),z:lerp(a.z,b.z,u),y:altitude(kind,lap-s),tx:dx/n,tz:dz/n,kind,station:s};
}
export function widthAt(kind,s){
 const lap=kind==='inner'?SPEC.innerLap:SPEC.outerLap;
 const rem=mod(lap-s,lap);
 // Approximate width distribution, constrained to published A-course ranges.
 // On the shared sections both routes use exactly the same width, so a
 // runner or a route-centre marker never jumps sideways at the finish.
 if(rem<=600||s<=517.1)return 24+8*Math.max(0,1-Math.min(rem,lap-rem)/420);
 const span=kind==='inner'?550:722.6;
 const u=(s-517.1)/span;
 return kind==='inner'?24-4*Math.sin(Math.PI*u)**2:24+4*Math.sin(Math.PI*u)**2;
}
export const ROUTE_LABELS={1200:'外回り',1600:'外回り・ポケット',1800:'内回り',2000:'内回り',2200:'外回り',2500:'外回り発走→内回り',2600:'外回り',3200:'外回り発走→内回り',3600:'内回り・2周',4000:'外回り・2周'};
export function makeRoute(distance){
 if(!DISTANCES.includes(distance))throw Error('unsupported distance');
 const finalKind=[1800,2000,2500,3200,3600].includes(distance)?'inner':'outer';
 const lap=finalKind==='inner'?SPEC.innerLap:SPEC.outerLap;
 const n=Math.floor(distance/lap),partial=distance-n*lap;
 const initialKind=[2500,3200].includes(distance)?'outer':finalKind;
 const initialLap=initialKind==='inner'?SPEC.innerLap:SPEC.outerLap;
 // 1600/3200 pocket position is a schematic tangent extension, not a survey.
 const pocketLength=distance===1600?110:distance===3200?105:0;
 const legs=[];
 if(pocketLength)legs.push({kind:'pocket',length:pocketLength,joinKind:initialKind,joinStation:initialLap-(partial-pocketLength)});
 if(partial>pocketLength)legs.push({kind:initialKind,start:initialLap-(partial-pocketLength),length:partial-pocketLength});
 for(let i=0;i<n;i++)legs.push({kind:finalKind,start:0,length:lap});
 return {distance,legs,label:ROUTE_LABELS[distance],finalKind};
}
export function routeAt(route,distance){
 let d=Math.max(0,Math.min(route.distance,distance));
 for(let i=0;i<route.legs.length;i++){
  const leg=route.legs[i];
  if(d<=leg.length||i===route.legs.length-1){
   if(leg.kind==='pocket'){
    const p=at(leg.joinKind,leg.joinStation),remain=leg.length-d;
    return {...p,x:p.x-p.tx*remain,z:p.z-p.tz*remain,y:p.y,kind:'pocket',width:lerp(32,widthAt(leg.joinKind,leg.joinStation),d/leg.length)};
   }
   const p=at(leg.kind,leg.start+d);return {...p,width:widthAt(leg.kind,p.station)};
  }
  d-=leg.length;
 }
 throw Error('empty route');
}
export function gradeAt(route,distance){
 const a=Math.max(0,distance-1),b=Math.min(route.distance,distance+1);
 return (routeAt(route,b).y-routeAt(route,a).y)/Math.max(.001,b-a)*100;
}
