import {createTurfVision,visionDimensions} from './turf-vision-model.mjs?v=2';
// One live 16:9 feed per race, shared by all boards; no GPU readback.
export const VISION_PLACEMENTS=Object.freeze({
 tokyo:Object.freeze([{key:'tokyo-west',x:-225,z:9,y:0,yaw:0},{key:'tokyo-east',x:210,z:22,y:0,yaw:0}].map(Object.freeze)),
 nakayama:Object.freeze([{key:'nakayama-main',x:0,z:-85,y:-2,yaw:0},{key:'nakayama-sub',x:235,z:-85,y:-2,yaw:0}].map(Object.freeze))
});
export function monitorLayout(w,h){
 // Screen coordinates are metres relative to bottom-left. Video is never stretched.
 const header=h*.15,footer=h*.16,body=h-header-footer;
 const videoH=Math.min(body,w*.70*9/16),videoW=videoH*16/9;
 return {video:{x:w*.025,y:footer+(body-videoH)/2,w:videoW,h:videoH},
  dataX:w*.025+videoW+w*.025,header,footer};
}
export function monitorRank(horses){
 return [...horses].sort((a,b)=>a.finished&&b.finished?
  (a.finishTime-b.finishTime||a.number-b.number):a.finished?-1:b.finished?1:
  b.distance-a.distance||a.number-b.number);
}
export function monitorTime(seconds){
 const tenths=Math.floor(Math.max(0,Number(seconds)||0)*10+1e-7);
 return Math.floor(tenths/600)+':'+String(Math.floor(tenths/10)%60).padStart(2,'0')+'.'+tenths%10;
}
export function monitorInterval(fps,mobile){
 return fps>0&&fps<24?500:mobile?250:166;
}
function canvasTexture(THREE,c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function newCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function rearArt(THREE,venue,ratio){
 const c=newCanvas(1024,Math.max(1,Math.round(1024/ratio))),x=c.getContext('2d');
 x.scale(c.width/1024,c.height/188);const g=x.createLinearGradient(0,0,0,188);g.addColorStop(0,'#b7d6e2');g.addColorStop(1,'#e2e5c9');x.fillStyle=g;x.fillRect(0,0,1024,188);
 x.fillStyle='#8caf80';x.beginPath();x.moveTo(0,135);x.bezierCurveTo(220,77,330,161,500,112);x.bezierCurveTo(685,65,875,145,1024,103);x.lineTo(1024,188);x.lineTo(0,188);x.fill();
 for(const [i,color] of ['#d6a38b','#e7c48f','#e7df9a','#a8caab','#9ac2d1'].entries()){x.strokeStyle=color;x.lineWidth=6;x.beginPath();x.moveTo(155,172);x.quadraticCurveTo(512,-112+i*12.5,869,172);x.stroke()}
 x.fillStyle='#386269';x.textAlign='center';x.font='bold 31px sans-serif';x.fillText(venue.toUpperCase()+' RACECOURSE',512,105,950);return canvasTexture(THREE,c);
}
const COLORS=['#eeeeee','#20242a','#bb3539','#2868b6','#dcc43e','#258356','#e3832e','#db81a5'];
function frameIndex(n){return n<=12?Math.floor((n-1)/2):n<=15?6:7}
export function createRaceVisionSystem(THREE,{scene,renderer,venue,mobile=false,live=true}){
 const boards=[],groups=[],placements=VISION_PLACEMENTS[venue]||[];
 const target=live?new THREE.WebGLRenderTarget(mobile?640:960,mobile?360:540,{depthBuffer:true,stencilBuffer:false}):null;
 if(target)target.texture.colorSpace=THREE.SRGBColorSpace;
 const feedCamera=new THREE.PerspectiveCamera(37,16/9,.3,2600);
 for(const p of placements){
  const d=visionDimensions(p.key),layout=monitorLayout(d.width,d.height),ratio=d.width/d.height;
  const c=newCanvas(Math.min(2048,Math.round(512*ratio)),Math.min(1024,Math.round(Math.min(2048,512*ratio)/ratio)));
  const background=canvasTexture(THREE,c),art=rearArt(THREE,venue,d.outerWidth/d.rearH);
  const model=createTurfVision(THREE,{key:p.key,screenTexture:background,rearTexture:art});
  const group=model.root;group.position.set(p.x,p.y,p.z);group.rotation.y=p.yaw;scene.add(group);groups.push(group);
  const v=layout.video,mesh=new THREE.Mesh(new THREE.PlaneGeometry(v.w,v.h),new THREE.MeshBasicMaterial({map:target?.texture||null,color:0xffffff,toneMapped:false,side:THREE.FrontSide}));
  mesh.position.set(-d.width/2+v.x+v.w/2,d.screenBottom+v.y+v.h/2,d.screenZ+.016);mesh.visible=false;group.add(mesh);
  boards.push({p,d,layout,c,background,art,model,mesh});
 }
 let lastPaint=-Infinity,lastKey='',lastVisible=false,feedFailed=false;
 const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),center=new THREE.Vector3(),sphere=new THREE.Sphere();
 function visible(camera){
  camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  return boards.some(b=>{if(!b.model.root.visible)return false;
   const g=b.model.root,dx=camera.position.x-g.position.x,dz=camera.position.z-g.position.z;
   if(dx*Math.sin(g.rotation.y)+dz*Math.cos(g.rotation.y)<=b.d.screenZ)return false;
   center.copy(g.position);center.y+=b.d.screenY;
   sphere.center.copy(center);sphere.radius=Math.hypot(b.d.outerWidth/2,b.d.outerHeight/2,b.d.depth/2);return frustum.intersectsSphere(sphere)});
 }
 function paint(b,state,rank,hasFeed){
  const {c,d,layout}=b,x=c.getContext('2d'),W=c.width,H=c.height,S=W/d.width,T=H/d.height;
  x.fillStyle='#101c25';x.fillRect(0,0,W,H);
  const hh=layout.header*T,fh=layout.footer*T,v=layout.video,vx=v.x*S,vy=H-(v.y+v.h)*T,vw=v.w*S,vh=v.h*T;
  x.fillStyle='#254957';x.fillRect(0,0,W,hh);x.fillStyle='#eaf2ee';x.textAlign='left';x.textBaseline='middle';
  x.font='bold '+Math.max(10,Math.min(hh*.58,W*.046))+'px sans-serif';x.fillText(d.venue+'競馬場  芝 '+(state.distance||'—')+'m',W*.025,hh*.52,W*.95);
  x.fillStyle='#213c36';x.fillRect(vx,vy,vw,vh);
  if(!hasFeed){x.fillStyle='#c7dcd4';x.textAlign='center';x.font='bold '+Math.min(vh*.17,vw*.12)+'px sans-serif';x.fillText(state.ready?(state.phase==='before'?'発走待機':'映像停止'):'モデル読込待ち',vx+vw/2,vy+vh/2,vw*.92);x.textAlign='left'}
  const dataX=layout.dataX*S,dataW=W-dataX-W*.02,bodyH=H-hh-fh,rows=Math.min(5,rank.length),rowH=bodyH/(rows+1);
  x.fillStyle='#14232d';x.fillRect(dataX,hh,dataW,bodyH);x.fillStyle='#ebd58c';
  x.font='bold '+Math.min(rowH*.64,dataW*.22)+'px sans-serif';x.fillText(state.phase==='finish'?'着順':state.phase==='before'?'出走馬':'順位',dataX+dataW*.05,hh+rowH*.5,dataW*.9);
  for(let i=0;i<rows;i++){
   const h=rank[i],y=hh+rowH*(i+1.5),n=h.number,box=Math.min(rowH*.76,dataW*.25),col=state.single?'#eeeeee':COLORS[frameIndex(n)]||'#eeeeee';
   x.fillStyle='#dfe9e4';x.textAlign='left';x.font='bold '+Math.min(rowH*.6,dataW*.20)+'px sans-serif';x.fillText(state.phase==='before'?'—':String(i+1),dataX+dataW*.04,y,dataW*.18);
   x.fillStyle=col;x.fillRect(dataX+dataW*.24,y-box/2,box,box);x.fillStyle=[0,4,7].includes(frameIndex(n))||state.single?'#182228':'#fff';x.textAlign='center';x.fillText(String(n),dataX+dataW*.24+box/2,y,box*.9);
   x.fillStyle='#dce9e4';x.textAlign='left';const name=String(h.name||'');if(dataW*.7-box>30)x.fillText(name,dataX+dataW*.28+box,y,Math.max(1,dataW*.68-box));
  }
  x.fillStyle='#080f17';x.fillRect(0,H-fh,W,fh);x.fillStyle='#f1d785';x.font='bold '+Math.min(fh*.62,W*.065)+'px sans-serif';x.textAlign='left';
  x.fillText(state.phase==='finish'?'FINISH':state.phase==='before'?'START':'残り '+Math.max(0,Math.round(state.remaining||0))+'m',W*.025,H-fh*.5,W*.49);
  x.textAlign='right';x.fillText(monitorTime(state.elapsed),W*.975,H-fh*.5,W*.46);b.background.needsUpdate=true;
 }
 function update(time,camera,state,aim){
  const inView=visible(camera);
  if(!inView){lastVisible=false;return false}
  const rank=monitorRank(state.horses||[]),key=[state.distance,state.phase,monitorTime(state.elapsed),state.ready,rank.map(h=>h.number+':'+(h.name||'')).join(',')].join('|');
  const changed=key!==lastKey;
  if(lastVisible&&(!changed&&!state.playing||time-lastPaint<monitorInterval(state.fps,mobile)&&state.playing))return false;
  const canFeed=!!target&&!feedFailed&&state.ready&&typeof aim==='function';
  let hasFeed=false;
  if(canFeed){
   const oldTarget=renderer.getRenderTarget(),oldVisible=groups.map(g=>g.visible);
   try{aim(feedCamera);groups.forEach(g=>g.visible=false);renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,feedCamera);hasFeed=true}
   catch(e){feedFailed=true;console.warn('ターフビジョン映像の描画失敗：順位・時刻表示へ切替',e)}
   finally{renderer.setRenderTarget(oldTarget);groups.forEach((g,i)=>g.visible=oldVisible[i])}
  }
  for(const b of boards){b.mesh.visible=hasFeed;paint(b,state,rank,hasFeed)}
  lastPaint=time;lastKey=key;lastVisible=true;return true;
 }
 // Initialize boards without a stale/black render target.
 for(const b of boards)paint(b,{phase:'before',elapsed:0,ready:false},[],false);
 function invalidate(){lastPaint=-Infinity;lastKey='';lastVisible=false;feedFailed=false}
 renderer.domElement?.addEventListener('webglcontextrestored',invalidate);
 return {boards,groups,update,invalidate};
}
