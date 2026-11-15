import {SCENARIOS} from './engine.mjs';
import {getHorseAppearance} from './appearance.mjs';
import {coursePoint,lengthAtMetres,HALF_LAP_LENGTH,INSIDE_MARGIN,LANE_WIDTH,TRACK_OUTER_OFFSET} from './course.mjs';
const BASE_W=1000,BASE_H=560;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function label(ctx,text,x,y,opts={}){
 ctx.font=`${opts.bold?'800':'600'} ${opts.size||22}px -apple-system,BlinkMacSystemFont,sans-serif`;
 ctx.textAlign=opts.align||'left'; ctx.fillStyle=opts.color||'#fff';ctx.fillText(text,x,y);
}
function rounded(ctx,x,y,w,h,r=12){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
// Cartoon chase-view counterpart of the shared 3D horse design.
// Broadcast chase perspective: all horse silhouettes face LEFT, with the leader at the left edge.
function drawHorse(ctx,x,y,size,horse,appearance,phase=0){
 ctx.save();ctx.translate(x,y);ctx.scale(-size,size);
 const edge=appearance.outline,coat=appearance.coat;
 const shape=(cx,cy,rx,ry,fill,rotation=0,stroke=edge,weight=3.5)=>{
   ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,rotation,0,Math.PI*2);
   ctx.fillStyle=fill;ctx.fill();
   if(weight){ctx.lineWidth=weight;ctx.strokeStyle=stroke;ctx.stroke();}
 };
 // Ground shadow; no fast bobbing.
 shape(0,55,65,10,'rgba(18,24,17,.18)',0,'transparent',0);
 const leg=(hipX,offset,isNear)=>{
   ctx.save();
   ctx.translate(hipX,12);
   ctx.rotate(Math.sin(phase+offset)*.16);
   shape(0,13,12,24,coat,.12,edge,3.8);
   ctx.translate(3,30);
   ctx.rotate((Math.max(0,Math.cos(phase+offset))*.10)-.03);
   shape(0,8,10,16,coat,0,edge,3.2);
   ctx.fillStyle='#342822';ctx.strokeStyle=edge;ctx.lineWidth=3;
   ctx.beginPath();ctx.roundRect(-11,17,26,12,5);ctx.fill();ctx.stroke();
   ctx.restore();
 };
 // Back-side limbs appear behind the belly.
 leg(-39,Math.PI,false);leg(35,0,false);
 shape(-10,3,57,32,coat,0,edge,4.5);
 shape(-45,0,26,28,coat,-.2,edge,3.6);
 shape(35,-3,29,32,coat,-.20,edge,3.5);
 // Fluffy tail, short to match the 3D character.
 shape(-67,-4,23,10,'#342a23',-.30,edge,3);
 shape(-81,-12,15,11,'#342a23',-.4,edge,2.8);
 // Near-side hooves and legs.
 leg(-33,0,true);leg(37,Math.PI,true);
 // Short thick neck, oversized head and rounded muzzle.
 shape(48,-24,24,33,coat,-.28,edge,4.2);
 shape(74,-33,33,29,coat,-.1,edge,4.4);
 shape(93,-19,26,20,coat,.08,edge,4);
 shape(105,-17,13,10,'rgba(255,221,194,.18)',.05,edge,2);
 shape(106,-19,3.6,4.1,edge,0,edge,0);
 // Ears and forehead mane.
 for(const z of [-1,1]){
   const px=56+z*17;
   ctx.beginPath();ctx.moveTo(px,-52);ctx.lineTo(px+6,-72);ctx.lineTo(px+18,-49);
   ctx.closePath();ctx.fillStyle=coat;ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=3.5;ctx.stroke();
 }
 for(let i=0;i<4;i++)shape(54+i*11,-59+i*3,9,10,'#3d2a22',.45,edge,1.6);
 // Leather noseband and headstall, with a metallic bit.
 ctx.strokeStyle=appearance.leather;ctx.lineWidth=4.2;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(91,-30);ctx.quadraticCurveTo(102,-32,109,-27);ctx.stroke();
 ctx.beginPath();ctx.moveTo(76,-53);ctx.quadraticCurveTo(74,-37,94,-29);ctx.stroke();
 ctx.beginPath();ctx.moveTo(62,-56);ctx.quadraticCurveTo(81,-55,88,-49);ctx.stroke();
 shape(105,-19,4.5,4.5,'#d9dddd',0,edge,2);
 // Reins lead back from the bit to the jockey's hands.
 ctx.strokeStyle=appearance.leather;ctx.lineWidth=2.8;
 ctx.beginPath();ctx.moveTo(104,-19);ctx.bezierCurveTo(81,-9,52,-27,32,-30);ctx.stroke();
 // Large expressive visible eye.
 shape(85,-41,12,14,'#faf9f0',-.1,edge,3);
 shape(90,-42,6.5,9,'#1d2530',0,edge,1);
 shape(92,-46,2.8,3.4,'#ffffff',0,'#ffffff',0);
 // Saddle, girth and stirrup with clear hardware, matching 3D tack.
 ctx.strokeStyle=appearance.leather;ctx.lineWidth=6;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-13,-20);ctx.quadraticCurveTo(-9,10,-6,32);ctx.stroke();
 shape(-8,-32,29,10,'#49372c',-.08,edge,3);
 ctx.strokeStyle=appearance.leather;ctx.lineWidth=2.8;
 ctx.beginPath();ctx.moveTo(-29,-31);ctx.lineTo(-37,11);ctx.stroke();
 ctx.strokeStyle='#d7dbe0';ctx.lineWidth=3.4;
 ctx.beginPath();ctx.moveTo(-42,4);ctx.lineTo(-43,17);ctx.lineTo(-26,17);ctx.lineTo(-26,4);ctx.stroke();
 shape(-8,-27,32,11,'#f5f0e8',-.07,edge,2.8);
 ctx.fillStyle=appearance.saddleBase;ctx.strokeStyle=appearance.saddleBorder;
 ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-28,-25,39,31,6);ctx.fill();ctx.stroke();
 ctx.fillStyle=appearance.numberColor;ctx.font='900 22px Arial';ctx.textAlign='center';
 ctx.fillText(String(horse.id),-8,-2);
 // Jockey in a crouch: illustrative silks, cap colored by the frame.
 shape(-2,-41,20,22,appearance.silk,-.38,edge,3.5);
 shape(0,-44,17,5,appearance.silkAccent,-.38,edge,1.1);
 // Jockey truly straddles the horse. Folded thighs and calves end in the stirrups.
 shape(-14,-29,17,11,'#f5f5f1',.28,edge,2.4);
 ctx.strokeStyle='#f5f5f1';ctx.lineWidth=12;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-17,-29);ctx.lineTo(-35,-16);ctx.stroke();
 ctx.strokeStyle=edge;ctx.lineWidth=2.5;ctx.stroke();
 shape(-35,-16,7,8,'#f7f7f4',.25,edge,1.8);
 ctx.strokeStyle='#303238';ctx.lineWidth=10;
 ctx.beginPath();ctx.moveTo(-35,-16);ctx.lineTo(-37,12);ctx.stroke();
 shape(-36,13,12,5,'#242830',0,edge,2.2);
 // Face and bright helmet.
 shape(10,-77,15,17,'#f0c5a6',0,edge,3);
 shape(8,-89,21,12,appearance.helmet,-.06,edge,3.5);
 shape(16,-83,18,5,appearance.helmet,-.08,edge,2.7);
 ctx.strokeStyle='#eeeeeb';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(-6,-86);ctx.quadraticCurveTo(6,-82,21,-84);ctx.stroke();
 // Goggle band and lenses.
 shape(18,-76,12,4,'#1c2b37',0,edge,1);
 shape(20,-77,4,2.5,'#9dcde5',0,'#9dcde5',0);
 // Two sleeves holding the reins.
 shape(19,-43,9,18,appearance.silk,-.7,edge,2.4);
 shape(31,-30,9,8,'#f0c5a6',-.3,edge,2.5);
 ctx.strokeStyle='#252421';ctx.lineWidth=2.4;
 ctx.beginPath();ctx.moveTo(32,-29);ctx.quadraticCurveTo(66,-26,90,-15);ctx.stroke();
 ctx.restore();
}
function backgroundChase(ctx,t){
 const sky=ctx.createLinearGradient(0,0,0,350);sky.addColorStop(0,'#64b6db');sky.addColorStop(1,'#e0f5ed');ctx.fillStyle=sky;ctx.fillRect(0,0,1000,560);
 ctx.fillStyle='#557f77';for(let i=0;i<24;i++){const x=(i*81+(t*4)%81);ctx.beginPath();ctx.ellipse(x,240,70,24,0,0,2*Math.PI);ctx.fill()}
 ctx.fillStyle='#315c72';ctx.beginPath();ctx.moveTo(695,120);ctx.lineTo(1000,37);ctx.lineTo(1000,290);ctx.lineTo(760,270);ctx.closePath();ctx.fill();
 ctx.fillStyle='#e8e7e1';for(let j=0;j<6;j++){ctx.beginPath();ctx.moveTo(730+j*12,145+j*10);ctx.lineTo(1000,75+j*24);ctx.lineTo(1000,87+j*24);ctx.lineTo(730+j*12,156+j*10);ctx.fill()}
 const grass=ctx.createLinearGradient(0,260,0,560);grass.addColorStop(0,'#8cc976');grass.addColorStop(1,'#42a16e');ctx.fillStyle=grass;ctx.fillRect(0,260,1000,300);
 // Turf mowing bands and two white rails; no dirt lane.
 for(let i=0;i<7;i++){
  const y=290+i*41;
  ctx.fillStyle=i%2?'rgba(21,86,45,.10)':'rgba(178,227,149,.12)';
  ctx.fillRect(0,y,1000,41);
 }
 ctx.strokeStyle='rgba(252,255,251,.96)';ctx.lineWidth=6;ctx.lineCap='round';
 for(const y of [302,515]){
  ctx.beginPath();ctx.moveTo(0,y+8);ctx.lineTo(1000,y-15);ctx.stroke();
  ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(0,y+24);ctx.lineTo(1000,y+1);ctx.stroke();
  for(let x=0;x<1020;x+=86){
    ctx.lineWidth=3;ctx.beginPath();
    ctx.moveTo(x,y+8-x*.023);ctx.lineTo(x,y+32-x*.023);ctx.stroke();
  }
 }
 // subtle motion stripes
 ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=2;
 for(let x=-80;x<1050;x+=160){const dx=(x+t*7)%1120;ctx.beginPath();ctx.moveTo(dx,400);ctx.lineTo(dx+65,400);ctx.stroke()}
}
function renderChase(ctx,frame,horses,distance){
 backgroundChase(ctx,frame.t);
 const lead=Math.max(...frame.horses.map(h=>h.x));
 const records=frame.horses.map(h=>({...h,meta:horses.find(x=>x.id===h.id)}));
 // Screen travel points LEFT: leaders are on the left, followers are farther right.
 records.sort((a,b)=>a.x-b.x);
 for(const h of records){
  const diff=lead-h.x;const x=160+diff*12;
  if(x>1145)continue;
  const scale=clamp(1.04+h.lane*.014-diff*.008,.52,1.14);
  // Lane 0 is the inside rail, farther from this side-on camera.
 const y=336+h.lane*21+diff*.018;
  drawHorse(ctx,x,y,scale,h,getHorseAppearance(h.id),frame.t*4.2+h.id*.34);
 }
 ctx.fillStyle='rgba(7,27,36,.78)';rounded(ctx,22,22,325,57,13);ctx.fill();
 label(ctx,'RACE LAB  •  LIVE SIMULATION',38,57,{size:21,bold:true,color:'#d8fff1'});
 label(ctx,'← 進行方向',382,57,{size:21,bold:true,color:'#ffffff'});
 const remaining=Math.max(0,Math.ceil(distance-lead));
 label(ctx,`残り ${remaining.toLocaleString()}m`,970,54,{size:28,bold:true,align:'right'});
 ctx.fillStyle='rgba(7,27,36,.78)';rounded(ctx,730,19,252,49,12);ctx.fill();
 label(ctx,`残り ${remaining.toLocaleString()}m`,966,52,{size:25,bold:true,align:'right'});
 const front=[...frame.horses].sort((a,b)=>b.x-a.x).slice(0,3);
 front.forEach((h,i)=>{
  const yy=102+i*47;ctx.fillStyle='rgba(12,26,37,.78)';rounded(ctx,23,yy,225,39,10);ctx.fill();
  ctx.fillStyle=getHorseAppearance(h.id).helmet;rounded(ctx,31,yy+5,29,28,6);ctx.fill();
  label(ctx,String(h.id),46,yy+26,{size:19,bold:true,align:'center',color:getHorseAppearance(h.id).helmetNumberColor});
  const meta=horses.find(x=>x.id===h.id);label(ctx,`${i+1}  ${meta.name.slice(0,7)} (${getHorseAppearance(h.id).frame}枠)`,72,yy+27,{size:16});
 });
}
function renderTop(ctx,frame,horses,distance){
 // Map of the same left-handed half-oval used in the Three.js scene.
 ctx.fillStyle='#1b5638';ctx.fillRect(0,0,1000,560);
 const toXY=p=>({x:145+(p.x+50)*5.2,y:280-p.z*4.4});
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
 for(let i=0;i<7;i++)band(i*2,Math.min((i+1)*2,TRACK_OUTER_OFFSET),i%2?'#85c983':'#72b877');
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
 const leadS=lengthAtMetres(lead,distance);
 const positions=[...frame.horses].sort((a,b)=>a.x-b.x);
 for(const h of positions){
   const diff=Math.max(0,lead-h.x);
   // Stretch the local group visually so number markers remain legible.
   const point=coursePoint(leadS-diff*.55,INSIDE_MARGIN+h.lane*LANE_WIDTH);
   const q=toXY(point),a=getHorseAppearance(h.id);
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

export function renderFrame(canvas,race,horses,time=0,mode='chase'){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 // Fixed internal size avoids high device memory requirements; CSS scales it responsively.
 if(canvas.width!==BASE_W||canvas.height!==BASE_H){canvas.width=BASE_W;canvas.height=BASE_H;}
 const frame=race?.frames?.length ? interpolateRaceFrame(race.frames,time) : {t:0,horses:horses.map(h=>({id:h.id,x:0,lane:(h.id-1)%6}))};
 ctx.clearRect(0,0,BASE_W,BASE_H);
 if(mode==='top')renderTop(ctx,frame,horses,race?.distance||2200);
 else renderChase(ctx,frame,horses,race?.distance||2200);
 ctx.fillStyle='rgba(9,25,32,.81)';rounded(ctx,20,506,555,38,10);ctx.fill();
 label(ctx,`${race?SCENARIOS[race.scenario]:'標準'}ペース  |  ${race?.distance||2200}m  |  経過 ${frame.t.toFixed(0)}秒`,37,533,{size:19,bold:true});
 if(!race){ctx.fillStyle='rgba(10,26,34,.68)';rounded(ctx,320,201,364,98,15);ctx.fill();label(ctx,'シミュレーション待機中',500,261,{size:28,bold:true,align:'center'});}
}
