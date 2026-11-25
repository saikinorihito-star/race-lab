// Single-horse course inspection, not the final competitive race engine.
// Keep distance-based animation and a deterministic 60 Hz physical timeline.
import {laneAt,gradeAt,curvatureAt} from './nakayama-course.mjs?v=4';
export const TICK=1/60;
export const START_RISK=[0,0,.02,.04,.06,.10,.15,.22,.32,.45,.60];
function hash(seed,id,salt){
 let x=(seed^Math.imul(id+37,2654435761)^Math.imul(salt+1,2246822519))>>>0;
 x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;
 return (x>>>0)/4294967296;
}
export function startDelay(level=1,seed=1,id=0){
 const n=Number.isFinite(level)?Math.max(1,Math.min(10,Math.round(level))):1;
 return hash(seed,id,31)<START_RISK[n]?Math.ceil((.25+1.25*hash(seed,id,32))*60-1e-9)/60:0;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
export function buildPath(route,lane=2){
 const n=Math.ceil(route.distance/.5),points=[];let length=0;
 for(let i=0;i<=n;i++){
  const d=route.distance*i/n,p=laneAt(route,d,lane);
  if(i){const q=points.at(-1);length+=Math.hypot(p.x-q.x,p.z-q.z,p.y-q.y);}
  points.push({...p,d,length,grade:gradeAt(route,d),curvature:curvatureAt(route,d)});
 }
 return {route,lane,points,length};
}
function indexAt(points,key,value){
 let lo=0,hi=points.length-1;
 while(hi-lo>1){const m=(hi+lo)>>1;if(points[m][key]<value)lo=m;else hi=m}
 return [lo,hi];
}
export function pathAt(path,length){
 const s=clamp(length,0,path.length),a=path.points,[i,j]=indexAt(a,'length',s),p=a[i],q=a[j],u=clamp((s-p.length)/Math.max(1e-9,q.length-p.length),0,1);
 const prev=a[Math.max(0,i-3)],next=a[Math.min(a.length-1,j+3)],dx=next.x-prev.x,dz=next.z-prev.z,dy=next.y-prev.y,n=Math.hypot(dx,dz)||1;
 return {d:lerp(p.d,q.d,u),length:s,x:lerp(p.x,q.x,u),y:lerp(p.y,q.y,u),z:lerp(p.z,q.z,u),
  tx:dx/n,tz:dz/n,pitch:Math.atan2(dy,n),grade:lerp(p.grade,q.grade,u),curvature:lerp(p.curvature,q.curvature,u)};
}
export function distanceToLength(path,d){
 const v=clamp(d,0,path.route.distance),[i,j]=indexAt(path.points,'d',v),a=path.points[i],b=path.points[j];
 return lerp(a.length,b.length,(v-a.d)/Math.max(1e-9,b.d-a.d));
}
export function buildRun(path,{risk=1,seed=1}={}){
 const delay=startDelay(risk,seed),frames=[{time:0,length:0,speed:0}];let length=0,speed=0;
 // Conservative inspection pace: uphill/curvature lower the target, not
 // the distance coordinate. These coefficients are provisional.
 for(let i=0;i<60000&&length<path.length;i++){
  const t=i*TICK,p=pathAt(path,length);
  if(t+1e-9>=delay){
   const target=clamp(16.5-p.grade*.22-Math.min(1.1,Math.abs(p.curvature)*55),13.8,17.2);
   speed=clamp(target,speed-4.4*TICK,speed+3.32*TICK);
   const step=speed*TICK;
   if(length+step>=path.length){
    frames.push({time:t+(path.length-length)/Math.max(1e-9,speed),length:path.length,speed});
    length=path.length;break;
   }
   length+=step;
  }
  frames.push({time:(i+1)*TICK,length,speed});
 }
 if(length<path.length)throw Error('走行タイムラインが完了しません');
 return {path,frames,delay,duration:frames.at(-1).time};
}
export function runAt(run,time){
 const t=clamp(time,0,run.duration),[i,j]=indexAt(run.frames,'time',t),a=run.frames[i],b=run.frames[j],
  u=clamp((t-a.time)/Math.max(1e-9,b.time-a.time),0,1);
 return {...pathAt(run.path,lerp(a.length,b.length,u)),time:t,speed:lerp(a.speed,b.speed,u),finished:t>=run.duration};
}
export function timeAtDistance(run,d){
 const length=distanceToLength(run.path,d);
 if(length<=0)return 0;
 const [i,j]=indexAt(run.frames,'length',length),a=run.frames[i],b=run.frames[j];
 return lerp(a.time,b.time,clamp((length-a.length)/Math.max(1e-9,b.length-a.length),0,1));
}
