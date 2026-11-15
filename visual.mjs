import {COLORS, SCENARIOS} from './engine.mjs';
const BASE_W=1000,BASE_H=560;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function label(ctx,text,x,y,opts={}){
 ctx.font=`${opts.bold?'800':'600'} ${opts.size||22}px -apple-system,BlinkMacSystemFont,sans-serif`;
 ctx.textAlign=opts.align||'left'; ctx.fillStyle=opts.color||'#fff';ctx.fillText(text,x,y);
}
function rounded(ctx,x,y,w,h,r=12){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawHorse(ctx,x,y,size,horse,color,phase=0){
 ctx.save();ctx.translate(x,y);ctx.scale(size,size);
 // Soft shadow: shape is an intentional stylized 2D sprite, not a 3D mesh.
 ctx.fillStyle='rgba(16,18,22,.23)';ctx.beginPath();ctx.ellipse(6,42,47,10,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#3e2b20';ctx.lineWidth=9;ctx.lineCap='round';
 for (const [lx,p] of [[-25,0],[2,1],[18,2],[33,3]]) {
  ctx.beginPath();ctx.moveTo(lx,13);ctx.lineTo(lx+Math.sin(phase*2+p)*8,38+Math.cos(phase*2+p)*4);ctx.stroke();
 }
 ctx.fillStyle='#74503a';ctx.beginPath();ctx.ellipse(0,7,49,24,-.02,0,2*Math.PI);ctx.fill();
 ctx.fillStyle='#60412e';ctx.beginPath();ctx.ellipse(-41,-1,18,13,-.24,0,2*Math.PI);ctx.fill();
 ctx.strokeStyle='#49372a';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(35,-6);ctx.lineTo(55,-27);ctx.stroke();
 ctx.fillStyle='#76543b';ctx.beginPath();ctx.ellipse(58,-29,17,11,-.30,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#251b1a';ctx.beginPath();ctx.arc(65,-32,2.3,0,2*Math.PI);ctx.fill();
 ctx.fillStyle=color;ctx.fillRect(-13,-24,25,26);
 ctx.fillStyle='#18222b';ctx.fillRect(-7,-2,16,8);
 ctx.fillStyle='#f0d6b4';ctx.beginPath();ctx.arc(1,-38,12,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,-45,17,9,0,0,2*Math.PI);ctx.fill();
 ctx.fillStyle='rgba(3,12,20,.7)';ctx.beginPath();ctx.ellipse(4,-38,8,4,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(-13,-24,25,23,4);ctx.fill();
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-10,-21,19,17,3);ctx.fill();
 ctx.font='800 17px Arial';ctx.textAlign='center';ctx.fillStyle=horse.id===1||horse.id===5?'#152234':'#fff';ctx.fillText(horse.id,0,-7);
 ctx.restore();
}
function backgroundChase(ctx,t){
 const sky=ctx.createLinearGradient(0,0,0,350);sky.addColorStop(0,'#64b6db');sky.addColorStop(1,'#e0f5ed');ctx.fillStyle=sky;ctx.fillRect(0,0,1000,560);
 ctx.fillStyle='#557f77';for(let i=0;i<24;i++){const x=(i*81-(t*4)%81);ctx.beginPath();ctx.ellipse(x,240,70,24,0,0,2*Math.PI);ctx.fill()}
 ctx.fillStyle='#315c72';ctx.beginPath();ctx.moveTo(695,120);ctx.lineTo(1000,37);ctx.lineTo(1000,290);ctx.lineTo(760,270);ctx.closePath();ctx.fill();
 ctx.fillStyle='#e8e7e1';for(let j=0;j<6;j++){ctx.beginPath();ctx.moveTo(730+j*12,145+j*10);ctx.lineTo(1000,75+j*24);ctx.lineTo(1000,87+j*24);ctx.lineTo(730+j*12,156+j*10);ctx.fill()}
 const grass=ctx.createLinearGradient(0,260,0,560);grass.addColorStop(0,'#8cc976');grass.addColorStop(1,'#42a16e');ctx.fillStyle=grass;ctx.fillRect(0,260,1000,300);
 ctx.fillStyle='#d6bd8d';ctx.beginPath();ctx.moveTo(0,309);ctx.lineTo(1000,264);ctx.lineTo(1000,285);ctx.lineTo(0,350);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,343);ctx.lineTo(1000,276);ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,528);ctx.lineTo(1000,380);ctx.stroke();
 // subtle motion stripes
 ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=2;
 for(let x=-80;x<1050;x+=160){const dx=(x-t*7)%1120;ctx.beginPath();ctx.moveTo(dx,400);ctx.lineTo(dx+65,400);ctx.stroke()}
}
function renderChase(ctx,frame,horses,distance){
 backgroundChase(ctx,frame.t);
 const lead=Math.max(...frame.horses.map(h=>h.x));
 const records=frame.horses.map(h=>({...h,meta:horses.find(x=>x.id===h.id)}));
 records.sort((a,b)=>a.x-b.x);
 for(const h of records){
  const diff=lead-h.x;const x=145+diff*13;
  if(x>1130)continue;
  const scale=clamp(1.18-diff*.012,.4,1.18);
  const y=418-(h.lane*31)-diff*.11;
  drawHorse(ctx,x,y,scale,h,COLORS[(h.id-1)%COLORS.length],frame.t*1.4+h.id);
 }
 ctx.fillStyle='rgba(7,27,36,.78)';rounded(ctx,22,22,325,57,13);ctx.fill();
 label(ctx,'RACE LAB  •  LIVE SIMULATION',38,57,{size:21,bold:true,color:'#d8fff1'});
 const remaining=Math.max(0,Math.ceil(distance-lead));
 label(ctx,`残り ${remaining.toLocaleString()}m`,970,54,{size:28,bold:true,align:'right'});
 ctx.fillStyle='rgba(7,27,36,.78)';rounded(ctx,730,19,252,49,12);ctx.fill();
 label(ctx,`残り ${remaining.toLocaleString()}m`,966,52,{size:25,bold:true,align:'right'});
 const front=[...frame.horses].sort((a,b)=>b.x-a.x).slice(0,3);
 front.forEach((h,i)=>{
  const yy=102+i*47;ctx.fillStyle='rgba(12,26,37,.78)';rounded(ctx,23,yy,225,39,10);ctx.fill();
  ctx.fillStyle=COLORS[(h.id-1)%18];rounded(ctx,31,yy+5,29,28,6);ctx.fill();
  label(ctx,String(h.id),46,yy+26,{size:19,bold:true,align:'center',color:h.id===1||h.id===5?'#203040':'#fff'});
  const meta=horses.find(x=>x.id===h.id);label(ctx,`${i+1}  ${meta.name.slice(0,9)}`,72,yy+27,{size:18});
 });
}
function renderTop(ctx,frame,horses,distance){
 ctx.fillStyle='#134332';ctx.fillRect(0,0,1000,560);
 for(let i=0;i<11;i++){ctx.fillStyle=i%2===0?'rgba(255,255,255,.015)':'rgba(0,0,0,.018)';ctx.fillRect(0,i*51,1000,51)}
 const lead=Math.max(...frame.horses.map(h=>h.x));
 ctx.fillStyle='#dbca9f';rounded(ctx,28,107,943,356,30);ctx.fill();
 ctx.fillStyle='#8fbe8a';rounded(ctx,28,113,943,343,27);ctx.fill();
 ctx.strokeStyle='rgba(252,255,252,.67)';ctx.lineWidth=3;
 for(let i=0;i<=7;i++){const y=134+i*42;ctx.beginPath();ctx.moveTo(45,y);ctx.lineTo(952,y);ctx.stroke()}
 label(ctx,'← 先頭',75,93,{size:19,bold:true,color:'#dafff3'});
 label(ctx,'後方 →',940,93,{size:19,bold:true,color:'#dafff3',align:'right'});
 for(const h of frame.horses){
  const diff=lead-h.x;const x=clamp(90+diff*10.6,75,940);const y=136+h.lane*42;
  ctx.fillStyle='rgba(1,35,20,.22)';ctx.beginPath();ctx.ellipse(x,y+7,20,7,0,0,2*Math.PI);ctx.fill();
  ctx.fillStyle=COLORS[(h.id-1)%18];ctx.strokeStyle=h.id===1?'#1b3447':'#fff';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.fill();ctx.stroke();
  label(ctx,String(h.id),x,y+7,{size:20,bold:true,align:'center',color:h.id===1||h.id===5?'#182636':'#fff'});
 }
 ctx.fillStyle='rgba(11,32,34,.87)';rounded(ctx,25,18,530,52,11);ctx.fill();
 label(ctx,`隊列図  •  残り ${Math.ceil(Math.max(0,distance-lead))}m`,43,52,{size:23,bold:true});
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
