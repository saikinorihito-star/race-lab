import {SCENARIOS} from './engine.mjs';
import {getHorseAppearance} from './appearance.mjs';
import {coursePoint,lengthAtMetres,HALF_LAP_LENGTH,INSIDE_MARGIN,LANE_WIDTH,TRACK_OUTER_OFFSET,raceDisplayPositions} from './course.mjs';
const BASE_W=1000,BASE_H=560;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function label(ctx,text,x,y,opts={}){
 ctx.font=`${opts.bold?'800':'600'} ${opts.size||22}px -apple-system,BlinkMacSystemFont,sans-serif`;
 ctx.textAlign=opts.align||'left'; ctx.fillStyle=opts.color||'#fff';ctx.fillText(text,x,y);
}
function rounded(ctx,x,y,w,h,r=12){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function renderTop(ctx,frame,horses,distance,race){
 // Map of the same left-handed half-oval used in the Three.js scene.
 ctx.fillStyle='#1b5638';ctx.fillRect(0,0,1000,560);
 const toXY=p=>({x:145+(p.x+50)*4.45,y:280+p.z*2.15});
 function band(a,b,color){
   ctx.beginPath();
   for(let i=0;i<=140;i++){
     const p=toXY(coursePoint(i*HALF_LAP_LENGTH/140,a));
     if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
   }
   for(let i=140;i>=0;i--){
     const p=toXY(coursePoint(i*HALF_LAP_LENGTH/140,b));
     ctx.lineTo(p.x,p.y);
   }
   ctx.closePath();ctx.fillStyle=color;ctx.fill();
 }
 for(let i=0;i<16;i++)band(i*2,Math.min((i+1)*2,TRACK_OUTER_OFFSET),i%2?'#85c983':'#72b877');
 for(const off of [0,TRACK_OUTER_OFFSET]){
   ctx.strokeStyle='#fcfcf7';ctx.lineWidth=3.8;ctx.beginPath();
   for(let i=0;i<=140;i++){
     const p=toXY(coursePoint(i*HALF_LAP_LENGTH/140,off));
     if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
   }
   ctx.stroke();
 }
 // Start and finish edges are shown as white tick marks.
 for(const [s,title] of [[0,'START'],[HALF_LAP_LENGTH,'GOAL']]){
   const a=toXY(coursePoint(s,0)),b=toXY(coursePoint(s,TRACK_OUTER_OFFSET));
   ctx.strokeStyle='#f9f7ea';ctx.lineWidth=4;ctx.beginPath();
   ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   label(ctx,title,a.x-15,a.y-12,{size:13,bold:true,color:'#fefefe'});
 }
 label(ctx,'左回り  ↶',817,107,{size:24,bold:true,color:'#edffef'});
 label(ctx,'スタート後、空いた進路から内ラチへ',316,502,{size:19,bold:true,color:'#edffef'});
 const lead=Math.max(...frame.horses.map(h=>h.x));
 // Shared scene positions: the overhead view and the 3D model are identical.
 const positions=raceDisplayPositions(race,frame,distance);
 for(const h of [...frame.horses].sort((a,b)=>a.x-b.x)){
   const point=positions.get(h.id).point;
   const q=toXY(point),a=getHorseAppearance(h.id,horses.length);
   ctx.fillStyle='rgba(6,35,18,.3)';ctx.beginPath();
   ctx.ellipse(q.x+2,q.y+5,10,5,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=a.helmet;ctx.strokeStyle='#f9faf6';ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(q.x,q.y,9.7,0,Math.PI*2);ctx.fill();ctx.stroke();
   label(ctx,String(h.id),q.x,q.y+4,{size:12,bold:true,align:'center',color:a.helmetNumberColor});
 }
 ctx.fillStyle='rgba(7,27,29,.85)';rounded(ctx,20,18,553,49,11);ctx.fill();
 label(ctx,'左回り・芝半周コース',37,50,{size:23,bold:true,color:'#fff'});
 ctx.fillStyle='rgba(7,27,29,.85)';rounded(ctx,714,18,265,49,11);ctx.fill();
 label(ctx,'残り '+Math.ceil(Math.max(0,distance-lead))+'m',957,50,{size:23,bold:true,color:'#fff',align:'right'});
}
export function interpolateRaceFrame(frames, time) {
 if(frames.length===1 || time<=frames[0].t)return frames[0];
 const last=frames[frames.length-1];
 if(time>=last.t)return last;
 let lo=0, hi=frames.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(frames[mid].t<=time)lo=mid;else hi=mid;}
 const start=frames[lo], end=frames[hi];
 const ratio=clamp((time-start.t)/(end.t-start.t || 1),0,1);
 return {t:time,horses:start.horses.map((h,i)=>{
  const next=end.horses[i];
  return {id:h.id,x:h.x+(next.x-h.x)*ratio,
   lane:h.lane+(next.lane-h.lane)*ratio,
   speed:h.speed+(next.speed-h.speed)*ratio,
   finished:ratio<1?h.finished:next.finished};
 })};
}

export function renderFrame(canvas,race,horses,time=0,mode='top'){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 // Fixed internal size avoids high device memory requirements; CSS scales it responsively.
 if(canvas.width!==BASE_W||canvas.height!==BASE_H){canvas.width=BASE_W;canvas.height=BASE_H;}
 const frame=race?.frames?.length ? interpolateRaceFrame(race.frames,time) : {t:0,horses:horses.map(h=>({id:h.id,x:0,lane:h.id-1}))};
 ctx.clearRect(0,0,BASE_W,BASE_H);
 // The chase camera was removed; fallback rendering is always the overhead view.
 renderTop(ctx,frame,horses,race?.distance||2200,race);
 ctx.fillStyle='rgba(9,25,32,.81)';rounded(ctx,20,506,555,38,10);ctx.fill();
 label(ctx,`${race?SCENARIOS[race.scenario]:'ミドル'}ペース  |  ${race?.distance||2200}m  |  経過 ${frame.t.toFixed(0)}秒`,37,533,{size:19,bold:true});
 if(!race){ctx.fillStyle='rgba(10,26,34,.68)';rounded(ctx,320,201,364,98,15);ctx.fill();label(ctx,'シミュレーション待機中',500,261,{size:28,bold:true,align:'center'});}
}
