import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function fn(name){
 const start=html.indexOf('function '+name+'('),end=html.indexOf('\n}\n',start);
 assert.ok(start>=0&&end>start,'Missing function '+name);
 return html.slice(start,end+2);
}
const stages=runInNewContext('('+fn('officialBroadcastStage')+')',{});
const forming=runInNewContext('('+fn('officialOpeningFormationWide')+')',{});
class V{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 clone(){return new V(this.x,this.y,this.z)}
 copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
 length(){return Math.hypot(this.x,this.y,this.z)}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z}
 distanceTo(v){return this.clone().sub(v).length()}
 lerp(v,t){this.x+=(v.x-this.x)*t;this.y+=(v.y-this.y)*t;this.z+=(v.z-this.z)*t;return this}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
 addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this}
 normalize(){const n=Math.hypot(this.x,this.y,this.z)||1;this.x/=n;this.y/=n;this.z/=n;return this}
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const THREE={Vector3:V,MathUtils:{lerp:(a,b,t)=>a+(b-a)*t,clamp}};
const makeShot=distance=>runInNewContext('('+fn('officialBroadcastCameraShot')+')',{
 THREE,activePlan:{distance},FINISH_DISTANCE:525.9,
 officialBroadcastStage:stages,officialOpeningFormationWide:forming,
 fieldCenterAt:(_p,d)=>({p:new V(d*.31,2,d*.1),t:new V(1,0,0)}),
 positionAt:s=>({p:new V(s*.31,2,s*.1),t:new V(1,0,0),inward:new V(0,0,-1)}),
 fitBroadcastToRunners:()=>{}
});
const context=(distance,progress)=>({
 leadDistance:progress,tailDistance:Math.max(0,progress-32),
 lead:{lane:7},meanLane:0,gap:32
});
test('broadcast follows real editorial order for Tokyo turf 1400m',()=>{
 const cases=[[0,'gate'],[40,'back'],[370,'third'],[660,'fourth'],
  [930,'stretch'],[1190,'closing'],[1370,'finish']];
 for(const [progress,id] of cases)
  assert.equal(stages(1400-progress,progress).id,id);
});
test('broadcast includes early wide view on 2400m and 3400m starts',()=>{
 for(const distance of [2400,3400]){
  assert.equal(stages(distance,0).id,'gate');
  assert.equal(stages(distance-75,75).id,'early');
  assert.equal(stages(1450,distance-1450).id,'back');
  assert.equal(stages(920,distance-920).id,'third');
  assert.equal(stages(600,distance-600).id,'fourth');
  assert.equal(stages(300,distance-300).id,'stretch');
  assert.equal(stages(125,distance-125).id,'closing');
  assert.equal(stages(20,distance-20).id,'finish');
 }
});
test('all nine Tokyo racing distances have start, corner, straight and finish shots',()=>{
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const phases=new Set();
  for(let i=0;i<=distance;i+=12)
   phases.add(stages(distance-i,i).id);
  phases.add(stages(0,distance).id);
  for(const expected of ['gate','third','fourth','stretch','closing','finish'])
   assert.ok(phases.has(expected),distance+'m missing '+expected);
 }
});
test('start uses a wider full-field camera until lateral formation settles',()=>{
 const forming=runInNewContext('('+fn('officialOpeningFormationWide')+')',{});
 const horses=span=>Array.from({length:18},(_,i)=>({lane:i%2?span:0}));
 assert.equal(forming(0,horses(20)),true);
 assert.equal(forming(53,horses(7)),true,'Preserve a brief gate overview');
 assert.equal(forming(55,horses(7)),false,'Switch to closeups around one second sooner');
 assert.equal(forming(95,horses(15)),true,'Stay wide briefly while the field remains spread out');
 assert.equal(forming(95,horses(7)),false,'Switch closer once runners have merged');
 assert.equal(forming(129,horses(19)),false,'The new distance hard cutoff is earlier');
 assert.equal(forming(50,horses(19).map(h=>({...h,speed:18}))),true);
 assert.equal(forming(53,horses(7).map(h=>({...h,speed:18}))),false,
  'The early switch tracks the current speed rather than a fixed new time');
 const camera=makeShot(1400);
 const pack=Array.from({length:18},(_,i)=>({
  number:i+1,distance:50-i*1.2,lane:i*1.2,postDistance:0
 }));
 const opening=camera({horses:pack,lead:pack[0],leadDistance:50,
  tailDistance:28,meanLane:10,gap:22});
 assert.equal(opening.broadcastShotId,'opening-wide');
 assert.equal(opening.fov,55);
 assert.match(opening.broadcastLabel,/全18頭/);
 assert.ok(Math.hypot(opening.eye.x-opening.target.x,
  opening.eye.y-opening.target.y,opening.eye.z-opening.target.z)<=88.001,
  'Opening view must have a closer maximum camera distance');
});
test('broadcast stops using the opening-wide shot after 145m and keeps returning to closeups',()=>{
 const camera=makeShot(1400);
 const horses=Array.from({length:18},(_,i)=>({
  number:i+1,distance:220-i*2,lane:i*1.25,postDistance:0
 }));
 const shots=[];
 for(const progress of [10,50,85,130,145,180,220,310,390,480,620,680,790,940,1040,1120,1170]){
  const current=horses.map(h=>({...h,distance:h.distance+(progress-220)}));
  shots.push({progress,shot:camera({horses:current,lead:current[0],
   leadDistance:progress,tailDistance:progress-36,meanLane:9,gap:36})});
 }
 assert.ok(shots.filter(x=>x.progress<70).every(x=>x.shot.broadcastShotId==='opening-wide'));
 assert.ok(shots.filter(x=>x.progress>=145).every(x=>x.shot.broadcastShotId!=='opening-wide'));
 const names=shots.filter(x=>x.progress>=145).map(x=>x.shot.broadcastShotId.split('-').at(-1));
 for(const type of ['lead','midPack','tailPack','third','frontPack','side','sidePack','horseEye','wide'])
  assert.ok(names.includes(type),'Expected recurring '+type+' shot after startup');
 const centerDist=shot=>Math.hypot(shot.eye.x-shot.target.x,
  shot.eye.y-shot.target.y,shot.eye.z-shot.target.z);
 const close=shots.find(x=>x.progress===180).shot;
 const opening=shots.find(x=>x.progress===50).shot;
 assert.ok(centerDist(close)<centerDist(opening)*.70,'Closeup should clearly exceed wide opening in scale');
 assert.match(fn('officialBroadcastCameraShot'),/if\(forming\|\|focusType==='wide'\|\|focusType==='gate'\)/);
 assert.match(fn('officialBroadcastCameraShot'),/focusType==='horseEye'\?27/);
});
test('virtual cameras have finite nonidentical positions and target the running pack',()=>{
 for(const distance of [1400,2400,3400]){
  const shot=makeShot(distance),ids=new Set();
  for(const progress of [5,distance-1420,distance-1200,distance-900,
   distance-670,distance-400,distance-170,distance-20]){
   if(progress<0||progress>distance)continue;
   const c=shot(context(distance,progress));
   assert.ok([c.eye.x,c.eye.y,c.eye.z,c.target.x,c.target.y,c.target.z,c.fov]
    .every(Number.isFinite));
   assert.ok(c.fov>=25&&c.fov<=55);
   assert.ok(Math.hypot(c.eye.x-c.target.x,c.eye.y-c.target.y,c.eye.z-c.target.z)>10);
   ids.add(c.broadcastShotId);
  }
  assert.ok(ids.size>=5,'Need multiple distinct source cameras for '+distance);
 }
});
test('near camera moves are eased and distant views dissolve without flying across the field',()=>{
 const mode=runInNewContext('('+fn('broadcastTransitionMode')+')',{});
 const eye=new V(0,6,0),target=new V(0,2,20);
 assert.equal(mode(eye,target,{eye:new V(5,6,0),target:new V(5,2,20)}),'pan');
 assert.equal(mode(eye,target,{eye:new V(60,6,0),target:new V(60,2,20)}),'dissolve');
 assert.equal(mode(eye,target,{eye:new V(0,6,25),target:new V(0,2,5)}),'dissolve');
 assert.match(html,/const BROADCAST_PAN_MS=420,BROADCAST_DISSOLVE_MS=200/);
 assert.match(html,/applyBroadcastCameraShot\(shot,time,dt,camera18CutPending\)/);
 assert.match(html,/renderer\.render\(scene,camera\);\s*if\(isOfficialEighteenTest\)captureBroadcastTransitionFrame\(\)/);
 assert.match(fn('officialEighteenCameraShot'),/which==='broadcast'/);
});
function transitionHarness(){
 const canvas={hidden:true,style:{},width:0,height:0,setAttribute(){},
  getContext(){return {clearRect(){},drawImage(){},getImageData(){return {data:[30,70,90,255]}}}}};
 const ctx={camera:{position:new V(0,6,0),fov:40,updateProjectionMatrix(){}},
  controls:{target:new V(0,2,20)},lastBroadcastShotId:'lead',lastBroadcastFocusNumbers:[1],
  broadcastLabelCutAt:0,broadcastCameraLabel:{textContent:''},
  broadcastTransition:null,broadcastTransitionCanvas:null,
  BROADCAST_PAN_MS:420,BROADCAST_DISSOLVE_MS:200,
  document:{createElement:()=>canvas},stage:{appendChild(){}},
  renderer:{domElement:{width:800,height:600}}};
 for(const name of ['broadcastTransitionMode','resetBroadcastTransition',
  'captureBroadcastTransitionFrame','updateBroadcastDissolve','applyBroadcastCameraShot'])
  ctx[name]=runInNewContext('('+fn(name)+')',ctx);
 return {ctx,canvas,apply:ctx.applyBroadcastCameraShot};
}
test('near cut interpolates position, target and FOV and finishes exactly',()=>{
 const h=transitionHarness(),shot={eye:new V(6,6,0),target:new V(6,2,20),fov:50,broadcastShotId:'mid',focusNumbers:[5],broadcastLabel:'中団'};
 h.apply(shot,1000,.016,false);
 assert.equal(h.ctx.camera.position.x,0);
 assert.equal(h.ctx.camera.fov,40);
 h.apply(shot,1210,.016,false);
 assert.equal(h.ctx.camera.position.x,3);
 assert.equal(h.ctx.camera.fov,45);
 h.apply(shot,1420,.016,false);
 assert.equal(h.ctx.camera.position.x,6);
 assert.equal(h.ctx.camera.fov,50);
 assert.equal(h.ctx.broadcastTransition,null);
});
test('distant cut captures once, jumps safely, fades out and resets on manual seek',()=>{
 const h=transitionHarness(),shot={eye:new V(60,6,0),target:new V(60,2,20),fov:45,broadcastShotId:'tail',focusNumbers:[18],broadcastLabel:'後方'};
 h.apply(shot,1000,.016,false);
 assert.equal(h.ctx.broadcastTransition.mode,'capture');
 assert.equal(h.ctx.camera.position.x,0);
 h.ctx.captureBroadcastTransitionFrame();
 assert.equal(h.ctx.broadcastTransition.mode,'ready');
 h.apply(shot,1016,.016,false);
 assert.equal(h.ctx.camera.position.x,60);
 assert.equal(h.canvas.hidden,false);
 h.apply(shot,1116,.016,false);
 assert.equal(h.canvas.style.opacity,'0.5');
 h.apply(shot,1216,.016,false);
 assert.equal(h.canvas.hidden,true);
 assert.equal(h.ctx.broadcastTransition,null);
 h.apply({...shot,eye:new V(120,6,0),target:new V(120,2,20),broadcastShotId:'wide'},1300,.016,true);
 assert.equal(h.ctx.camera.position.x,120);
 assert.equal(h.ctx.broadcastTransition,null);
});
test('failed canvas capture uses a direct cut instead of a black overlay',()=>{
 const h=transitionHarness(),shot={eye:new V(60,6,0),target:new V(60,2,20),fov:45,broadcastShotId:'tail',focusNumbers:[18],broadcastLabel:'後方'};
 h.canvas.getContext=()=>({clearRect(){},drawImage(){},getImageData(){return {data:[0,0,0,255]}}});
 h.apply(shot,1000,.016,false);h.ctx.captureBroadcastTransitionFrame();
 h.apply(shot,1016,.016,false);
 assert.equal(h.ctx.camera.position.x,60);
 assert.equal(h.canvas.hidden,true);
 assert.equal(h.ctx.broadcastTransition,null);
});
test('auto broadcast is the default and manual camera override remains available',()=>{
 assert.match(html,/data-view="broadcast"/);
 assert.match(html,/const racingCameraViews=new Set\(\['broadcast','side','front3q','chase','field'\]\)/);
 assert.match(html,/isOfficialEighteenTest\?'broadcast':isOfficialPairTest\?'field'/);
 assert.match(fn('pairTrackingView'),/broadcast/);
 assert.match(fn('leaveBroadcastForManualCamera'),/setView\('field'\)/);
 assert.match(html,/if\(Math\.abs\(current\.x-previous\.x\)\+Math\.abs\(current\.y-previous\.y\)>0\)/);
 assert.match(html,/stageCanvas\.addEventListener\('wheel'/);
});
test('real source skinned mesh gets a shared compact helmet and saddlecloth region attribute',()=>{
 const p=[[0,.62,.17],[.22,-.05,-.20],[0,.34,.22],[0,-.22,-.33],[0,.2,.75]];
 const data={...p};
 const geo={
  attrs:{position:{count:p.length,getX:i=>p[i][0],getY:i=>p[i][1],getZ:i=>p[i][2]}},
  getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v}
 };
 const node={isSkinnedMesh:true,geometry:geo};
 class Attr{constructor(data,size,normalized){this.array=data;this.itemSize=size;this.normalized=normalized}}
 const count=runInNewContext('('+fn('prepareOriginalFrameZones')+')',{
  THREE:{Uint8BufferAttribute:Attr}
 })({traverse:callback=>callback(node)});
 assert.equal(count,2);
 assert.deepEqual([...geo.attrs.raceTintZone.array],[255,128,0,0,0]);
 assert.equal(geo.attrs.raceTintZone.normalized,true);
});
test('shader tints actual original helmet and cloth texels but never replaces bones or horse material in shared GLB',()=>{
 const palette=[{hex:'#ffffff'}, {hex:'#151b20'},{hex:'#d63338'},
  {hex:'#2777ca'},{hex:'#f3d631'},{hex:'#29834a'},
  {hex:'#ed8833'},{hex:'#eb9bb8'}];
 const geometry={getAttribute:key=>key==='raceTintZone'?{count:5}:null};
 const node={isSkinnedMesh:true,geometry,material:{clone:()=>({})}};
 const apply=runInNewContext('('+fn('tintOriginalHelmetAndCloth')+')',{
  THREE:{Color:class{constructor(c){this.value=c}}},
  RACE_FRAME_COLORS:palette,officialFrameIndex:n=>Math.floor((n-1)/2)
 });
 const numberTexture={name:'horse5-unique-number'};
 apply({traverse:cb=>cb(node)},5,numberTexture);
 const material=node.material;
 assert.equal(material.customProgramCacheKey(),'race-skinned-number-v3');
 const shader={
  uniforms:{},
  vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <map_fragment>\n#include <color_fragment>'
 };
 material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.raceFrameTint.value.value,'#d63338');
 assert.equal(shader.uniforms.raceNumberMap.value,numberTexture);
 assert.match(shader.vertexShader,/attribute float raceTintZone;\nvarying float vRaceTintZone/);
 assert.match(shader.fragmentShader,/uniform vec3 raceFrameTint;\nuniform sampler2D raceNumberMap;\nvarying float vRaceTintZone/);
 assert.match(shader.vertexShader,/varying vec3 vRaceBindPos/);
 assert.match(shader.vertexShader,/vRaceBindPos=position/);
 assert.match(shader.fragmentShader,/if\(onSide\*inHeight\*inLength>\.5\)/)
 assert.match(shader.fragmentShader,/diffuseColor\.rgb=mix\(diffuseColor\.rgb,shaded,mask\)/);
 assert.match(shader.fragmentShader,/originalBlue=diffuseColor\.b-max\(diffuseColor\.r,diffuseColor\.g\)/);
 assert.ok(!shader.vertexShader.includes('\\\\nattribute'),'GLSL should contain real newlines');
 assert.match(fn('initializeOfficialPair'),/const model=cloneSkeleton\(source\)/);
 assert.match(html,/official-meshy-blue-ribbon-original-geometry-gallop-v2-20261119/);
});

test('approved 18-horse auto-camera survives model reload and race restart',()=>{
 const loader=fn('loadApprovedHorse');
 const reset=fn('resetDemo');
 const change=fn('setView');
 assert.match(loader,/setView\(isOfficialEighteenTest\?'broadcast':'field'\)/);
 assert.match(reset,/isOfficialEighteenTest\?'broadcast':pairTrackingView\(view\)\?view:'field'/);
 assert.match(html,/if\(isOfficialPairTest\)setView\(isOfficialEighteenTest\?'broadcast':'field'\)/);
 assert.match(change,/which==='broadcast'&&isOfficialEighteenTest&&activePlan/);
});
test('helmet has expanded frame-colour region and shades the entire cap, not only blue stripes',()=>{
 const region=fn('prepareOriginalFrameZones'),shader=fn('tintOriginalHelmetAndCloth');
 assert.match(region,/const hat=y>\.42&&y<\.91&&z>-\.20&&z<\.48&&Math\.abs\(x\)<\.26/);
 assert.match(shader,/float capMask=capRegion\*\(1\.0-skinGuard\)/);
 assert.match(shader,/float clothMask=/);
 assert.match(shader,/float skinGuard=/);
});

test('TV editor alternates first-three close-up, third-place pack and wider field',()=>{
 const camera=makeShot(1400);
 const horses=Array.from({length:18},(_,i)=>({
  number:i+1,distance:550-i*3,lane:4+(i%4)*2,postDistance:0
 }));
 const at=progress=>{
  const delta=progress-550;
  const current=horses.map(h=>({...h,distance:h.distance+delta}));
  const leadDistance=progress,tailDistance=progress-51;
  return camera({horses:current,lead:current[0],leadDistance,tailDistance,
   meanLane:7,gap:51});
 };
 const first=at(145),mid=at(220),tail=at(320),
  third=at(520),frontPack=at(620),side=at(720),
  sidePack=at(820),horseEye=at(920),wide=at(420);
 assert.match(first.broadcastShotId,/-lead$/);
 assert.match(mid.broadcastShotId,/-midPack$/);
 assert.match(tail.broadcastShotId,/-tailPack$/);
 assert.match(third.broadcastShotId,/-third$/);
 assert.match(frontPack.broadcastShotId,/-frontPack$/);
 assert.match(side.broadcastShotId,/-side$/);
 assert.match(sidePack.broadcastShotId,/-sidePack$/);
 assert.match(horseEye.broadcastShotId,/-horseEye$/);
 assert.match(wide.broadcastShotId,/-wide$/);
 assert.match(first.broadcastLabel,/先頭集団・低い斜め前/);
 assert.match(mid.broadcastLabel,/中団馬群・5〜9番手/);
 assert.match(tail.broadcastLabel,/後方馬群・最後尾/);
 assert.match(third.broadcastLabel,/3番手付近・斜め前/);
 assert.match(frontPack.broadcastLabel,/斜め前から隊列/);
 assert.match(sidePack.broadcastLabel,/低い真横/);
 assert.match(wide.broadcastLabel,/馬群全景/);
 for(const shot of [first,mid,tail,third,frontPack,side,sidePack,horseEye,wide]){
  assert.match(shot.broadcastLabel,/先頭 1番 ／ 3番手 3番/);
  assert.ok(shot.fov>=25&&shot.fov<=55);
 }
 const dist=shot=>Math.hypot(shot.eye.x-shot.target.x,shot.eye.y-shot.target.y,shot.eye.z-shot.target.z);
 assert.ok(dist(first)<dist(wide)*.75,'Leader closeup must be clearly closer than wide shot');
 assert.ok(dist(third)<dist(wide)*.75,'Third-place pack should be much closer than overview');
});
test('normal broadcast distributes twelve slots across front, middle and rear ranks',()=>{
 const camera=makeShot(2400);
 const groups=[];
 for(let i=0;i<12;i++){
  const progress=145+i*100;
  const horses=Array.from({length:18},(_,j)=>({
   number:j+1,distance:progress-j*2,lane:3+(j%4)*2,postDistance:0,speed:16
  }));
  const shot=camera({horses,lead:horses[0],leadDistance:progress,tailDistance:progress-34,gap:34,meanLane:6});
  groups.push(shot.focusNumbers);
 }
 assert.deepEqual(groups.map(a=>a.join(',')),[
  '1,2,3','5,6,7,8,9','13,14,15,16,17,18',
  '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18',
  '2,3,4,5','6,7,8,9,10','10,11,12,13,14',
  '12,13,14,15,16,17,18','7,8,9',
  '5,6,7,8,9','6,7,8,9,10','13,14,15,16,17,18'
 ]);
});
test('reference front-pack and side-pack cameras use distinct low perspectives with real pack anchoring',()=>{
 const front=makeShot(1400),pack=Array.from({length:18},(_,i)=>({
  number:i+1,lane:2+(i%4)*2,distance:390-i*3,postDistance:0,speed:16
 }));
 const shotAt=progress=>{
  const horses=pack.map(h=>({...h,distance:h.distance+progress-390}));
  return front({horses,lead:horses[0],leadDistance:progress,
   tailDistance:progress-51,gap:51,meanLane:8});
 };
 const diagonal=shotAt(620),lateral=shotAt(820);
 assert.match(diagonal.broadcastShotId,/-frontPack$/);
 assert.match(lateral.broadcastShotId,/-sidePack$/);
 assert.equal(diagonal.fov,41);
 assert.equal(lateral.fov,43);
 assert.ok(diagonal.eye.y>diagonal.target.y&&lateral.eye.y>lateral.target.y,
  'Both references retain low but above-ground camera positions');
 assert.notDeepEqual([diagonal.eye.x,diagonal.eye.y,diagonal.eye.z],
  [lateral.eye.x,lateral.eye.y,lateral.eye.z]);
 const source=fn('officialBroadcastCameraShot');
 assert.match(source,/focusType==='frontPack'\?ranked\.slice\(Math\.min\(5,ranked\.length-1\),Math\.min\(10,ranked\.length\)\)/);
 assert.match(source,/focusType==='sidePack'\?ranked\.slice\(Math\.max\(0,ranked\.length-7\)\)/);
 assert.match(source,/outside=9\.5;height=3\.25;ahead=17\.5;fov=41/);
 assert.match(source,/outside=23\.5;height=4\.2;ahead=0;fov=43/);
 assert.match(html,/shot\.endsWith\('-sidePack'\)/);
 assert.match(html,/shot\.endsWith\('-midPack'\)/);
 assert.match(html,/shot\.endsWith\('-tailPack'\)/);
});
test('opening sees all 18 and rear group cuts track actual last-place horses',()=>{
 const shot=makeShot(1400),pack=Array.from({length:18},(_,i)=>({
  number:i+1,distance:520-i*4,lane:2+(i%6)*3,
  postDistance:0,speed:16
 }));
 const at=progress=>{
  const horses=pack.map(h=>({...h,distance:h.distance+(progress-520)}));
  return shot({horses,lead:horses[0],leadDistance:progress,
   tailDistance:progress-68,gap:68,meanLane:8});
 };
 const opening=at(35),mid=at(220),rear=at(320),leader=at(145);
 assert.match(opening.broadcastShotId,/opening-wide$/);
 assert.match(mid.broadcastShotId,/-midPack$/);
 assert.match(rear.broadcastShotId,/-tailPack$/);
 assert.match(leader.broadcastShotId,/-lead$/);
 assert.ok(Math.hypot(opening.eye.x-opening.target.x,
  opening.eye.y-opening.target.y,opening.eye.z-opening.target.z)<=88.001);
 assert.equal(opening.fov,55);
 const script=fn('officialBroadcastCameraShot');
 assert.match(script,/const selected=forming\|\|focusType==='wide'\?ranked/);
 assert.match(script,/focusType==='midPack'\?ranked\.slice\(Math\.min\(4,ranked\.length-1\),Math\.min\(9,ranked\.length\)\)/);
 assert.match(script,/focusType==='tailPack'\?ranked\.slice\(Math\.max\(0,ranked\.length-6\)\)/);
 assert.match(script,/outside=43;height=11\.5;ahead=20;fov=55/);
 assert.match(script,/maxDistance=forming\?88/);
 assert.match(script,/outside=10;height=3\.4;ahead=18\.5;fov=42/);
 const seen=[];
 const fit=runInNewContext('('+fn('officialBroadcastCameraShot')+')',{
  ...{
   THREE,activePlan:{distance:1400},FINISH_DISTANCE:525.9,
   officialBroadcastStage:stages,officialOpeningFormationWide:forming,
   fieldCenterAt:(_p,d)=>({p:new V(d*.31,2,d*.1),t:new V(1,0,0)}),
   fitBroadcastToRunners:(_eye,_target,runners)=>seen.push(runners.map(h=>h.number))
  }
 });
 const all=pack.map(h=>({...h,distance:h.distance-485}));
 fit({horses:all,lead:all[0],leadDistance:35,tailDistance:-33,gap:68,meanLane:8});
 assert.deepEqual(seen[0],Array.from({length:18},(_,i)=>i+1),
  'Opening fit must include the true last-place runner');
});
test('all TV shot types frame lower to reduce empty sky without losing horses',()=>{
 const shot=makeShot(1400);
 const opening=shot(context(1400,35));
 const leader=shot(context(1400,145));
 const overview=shot(context(1400,420));
 assert.match(opening.broadcastShotId,/opening-wide$/);
 assert.match(leader.broadcastShotId,/-lead$/);
 assert.match(overview.broadcastShotId,/-wide$/);
 // Synthetic track surface is at y=2. The three targets are ground-relative.
 assert.ok(Math.abs(opening.target.y-(2+2.35))<1e-8);
 assert.ok(Math.abs(leader.target.y-(2+1.55))<1e-8);
 assert.ok(Math.abs(overview.target.y-(2+2.15))<1e-8);
 for(const cameraShot of [opening,leader,overview]){
  assert.ok(cameraShot.eye.y>cameraShot.target.y,'The camera still looks down toward the turf');
  assert.ok([cameraShot.eye.x,cameraShot.eye.y,cameraShot.eye.z,
   cameraShot.target.x,cameraShot.target.y,cameraShot.target.z].every(Number.isFinite));
 }
 assert.match(fn('officialBroadcastCameraShot'),
  /forming\?2\.35:focusType==='wide'\?2\.15:1\.55/);
});
test('startup uses 2400m while other selectable course distances remain intact',()=>{
 assert.match(html,/<option value="2400" selected>芝2400m<\/option>/);
 assert.match(html,/<option value="1400">芝1400m<\/option>/);
 assert.doesNotMatch(html,/<option value="1400" selected>/);
 assert.match(html,/let activePlan=null,activeDistance=2400;/);
 assert.match(html,/<strong id="watchCourse">東京 芝A 2400m<\/strong>/);
 assert.match(html,/<span id="watchRemain">残り2400m<\/span>/);
 assert.match(html,/activeDistance=Number\(raceSelector\.value\)/);
 assert.match(html,/const rest=Math\.max\(0,Math\.round\(\(activePlan\?\.distance\|\|2400\)-travel\)\)/);
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400])
  assert.ok(html.includes('<option value="'+distance+'"'),'Distance retained '+distance);
});
test('18-horse approved GLB legs animate a little quicker without racing faster',()=>{
 // For distance 100m, index 0 advances 100/16*1.42065 in animation-time.
 // This comparison is independent of simulation physics or FPS.
 const local={THREE:{Vector3:V,MathUtils:{clamp}},
  isOfficialPairTest:true,installedDesign01:true,
  activePlan:{distance:1400},OFFICIAL_TEST_COUNT:18,isOfficialMultiTest:true,
  isOfficialEighteenTest:true,playing:true,raceElapsed:9,RACE_TICK:1/60,
  officialPair:Array.from({length:18},()=>({
   group:{position:{copy(){}},rotation:{}},
   mixer:{time:null,setTime(v){this.time=v}}
  })),
  officialPairVisualState:()=>({distance:100,postDistance:0,speed:16,sideSpeed:0,alpha:1}),
  raceHorsePosition:()=>({p:new V(0,0,0),t:new V(0,0,1)}),
  fourHorseInwardSlope:()=>0,rate:{value:'1'}};
 const apply=runInNewContext('('+fn('updateOfficialPair')+')',local);
 apply(1/60);
 const boosted=local.officialPair[0].mixer.time;
 assert.ok(Math.abs(boosted-100*1.42065/16)<1e-8);
 assert.ok(Math.abs(boosted/(100*1.2915/16)-1.10)<1e-10,
  'Leg turnover must be 10% faster than the previous 1.2915 rate');
 assert.ok(boosted>100*1.15/16,'Slightly quicker than former 15% turnover');
 assert.ok(local.officialPair[1].mixer.time>boosted,'Separate phase offset remains');
 local.isOfficialEighteenTest=false;local.OFFICIAL_TEST_COUNT=2;
 apply(1/60);
 assert.ok(Math.abs(local.officialPair[0].mixer.time-100/16)<1e-8,
  'Other approved horse modes retain original visual gait cadence');
 const source=fn('updateOfficialPair');
 assert.doesNotMatch(source,/stepRace\(|raceHorses\[[^\]]+\]\.distance\s*=/,
  'Only mixer animation phase is updated, not the physics');
});
test('approved horse materials keep 2K maps shared with anisotropic filtering',()=>{
 const configure=runInNewContext('('+fn('improveApprovedHorseTextureSampling')+')',{
  renderer:{capabilities:{getMaxAnisotropy:()=>16}}
 });
 const makeTexture=id=>({isTexture:true,anisotropy:1,
  image:{id,width:2048,height:2048},needsUpdate:false});
 const diffuse=makeTexture('diffuse'),normal=makeTexture('normal'),
  metallic=makeTexture('metallic');
 const source={traverse:cb=>{
  cb({isMesh:true,material:{map:diffuse,normalMap:normal,
   metalnessMap:metallic,roughnessMap:metallic}});
  cb({isMesh:true,material:[{map:diffuse},{normalMap:normal}]});
 }};
 const images=[diffuse.image,normal.image,metallic.image];
 assert.equal(configure(source),3);
 for(const [i,t] of [diffuse,normal,metallic].entries()){
  assert.equal(t.anisotropy,8);assert.equal(t.needsUpdate,true);
  assert.equal(t.image,images[i],'Source texture data should remain shared and intact');
 }
 assert.match(fn('loadApprovedHorse'),/if\(isOfficialPairTest\)improveApprovedHorseTextureSampling\(horse\)/);
 const limited=runInNewContext('('+fn('improveApprovedHorseTextureSampling')+')',{
  renderer:{capabilities:{getMaxAnisotropy:()=>4}}
 });
 const low=makeTexture('limited');
 assert.equal(limited({traverse:cb=>cb({isMesh:true,material:{map:low}})}),1);
 assert.equal(low.anisotropy,4);
});
test('focused race views enlarge horse models but preserve overview and starting shots',()=>{
 const src=fn('officialBroadcastCameraShot');
 assert.match(src,/outside=8\.5;height=3\.15;ahead=15\.5;fov=40/);
 assert.match(src,/outside=14\.5;height=4\.1;ahead=1;fov=36/);
 assert.match(src,/outside=10\.6;height=2\.8;ahead=10;fov=37/);
 assert.match(src,/outside=9;height=3\.25;ahead=17;fov=41/);
 assert.match(src,/focusType==='third'\?32:30/);
 assert.match(src,/if\(forming\|\|focusType==='wide'\|\|focusType==='gate'\)/);
});
test('18-runner sharpness improvements preserve non-race modes and fixed framebuffer',()=>{
 assert.match(html,/isOfficialEighteenTest\?\{sharp:2\.6,standard:1\.85,light:1\.15\}/);
 assert.match(html,/renderQuality\.value==='auto'\?2\.25/);
 assert.match(html,/let auto18Dpr=2\.25,auto18ObservedFps=0/);
 assert.match(html,/isOfficialEighteenTest\?512:256/g);
 assert.match(html,/isOfficialEighteenTest\?16:4/);
 const auto=fn('autoTune18HorseResolution');
 assert.ok(!auto.includes('renderer.setPixelRatio('));
 assert.ok(!auto.includes('renderer.setSize('));
});

test('reference front oblique views occupy eight of twelve slots and show the group from ahead and outside',()=>{
 const camera=makeShot(2400),types=new Set(['lead','third','midPack','frontPack','tailPack']);
 let frontCount=0;
 for(let i=0;i<12;i++){
  const progress=145+i*100;
  const horses=Array.from({length:18},(_,j)=>({number:j+1,distance:progress-j*2,lane:3+(j%4)*2,postDistance:0,speed:16}));
  const shot=camera({horses,lead:horses[0],leadDistance:progress,gap:34});
  if(!types.has(shot.broadcastShotId.split('-').at(-1)))continue;
  frontCount++;
  assert.ok(shot.eye.x-shot.target.x>=15&&shot.eye.x-shot.target.x<=19,'closer camera ahead of pack');
  assert.ok(shot.eye.z-shot.target.z>=8&&shot.eye.z-shot.target.z<=10.01,'closer camera on outside of pack');
  assert.ok(Math.hypot(shot.eye.x-shot.target.x,shot.eye.y-shot.target.y,shot.eye.z-shot.target.z)<=21.2,'close tracking radius');
  assert.ok(shot.eye.y-2<=3.5,'low ground-relative height');
  assert.ok(shot.fov>=40&&shot.fov<=42,'slightly tighter lens');
 }
 assert.equal(frontCount,8);
});

test('front-oblique cameras are on the outer-rail side for any track heading',()=>{
 assert.match(fn('positionAt'),/const inward=new THREE\.Vector3\(dz,0,-dx\)/);
 const source=fn('officialBroadcastCameraShot');
 for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1],[Math.SQRT1_2,Math.SQRT1_2]]){
  const tangent=new V(dx,0,dz),inward=new V(dz,0,-dx);
  const camera=runInNewContext('('+source+')',{
   THREE,activePlan:{distance:2400},officialBroadcastStage:stages,officialOpeningFormationWide:forming,
   fieldCenterAt:(_p,d)=>({p:tangent.clone().addScaledVector(tangent,d).add(new V(0,2,0)),t:tangent.clone()}),fitBroadcastToRunners:()=>{}
  });
  for(const lane of [-12,0,12])for(const progress of [145,245,345,545,645,1045,1145,1245,2370]){
   const horses=Array.from({length:18},(_,j)=>({number:j+1,distance:progress-j*2,lane:lane+(j%3),postDistance:0,speed:16}));
   const shot=camera({horses,lead:horses[0],leadDistance:progress,gap:34});
   const relative=shot.eye.clone().sub(shot.target);
   assert.ok(relative.dot(inward)<=-8&&relative.dot(inward)>=-10.01,'negative inward coordinate is the outer side');
   assert.ok(relative.dot(tangent)>=15&&relative.dot(tangent)<=19,'retain front angle');
   assert.ok(relative.length()<=21.2,'retain close camera distance');
  }
 }
});

test('final 400m locks broadcast on current leader and follows overtakes without stage cuts',()=>{
 for(const distance of [1400,1600,1800,2000,2300,2400,2500,2600,3400]){
  const camera=makeShot(distance);
  const shotAt=(remaining,leaderIndex=0)=>{
   const progress=distance-remaining;
   const horses=Array.from({length:18},(_,i)=>({number:i+1,distance:progress-(i===leaderIndex?0:2+i),lane:4+i%4,postDistance:0,speed:16}));
   return {shot:camera({horses,lead:horses[leaderIndex],leadDistance:progress,gap:19}),leader:horses[leaderIndex]};
  };
  assert.notEqual(shotAt(401).shot.broadcastShotId,'final-lead');
  for(const remaining of [400,399,300,150,55,1,0]){
   const {shot,leader}=shotAt(remaining,remaining<=150?5:0);
   assert.equal(shot.broadcastShotId,'final-lead');
   assert.equal(shot.focusedOnLead,true);
   assert.equal(shot.focusNumbers.join(','),String(leader.number));
   assert.ok(Math.abs(shot.target.x-leader.distance*.31)<1e-8);
   assert.ok(Math.abs(shot.target.z-(leader.distance*.1-leader.lane))<1e-8);
   assert.ok(Math.abs(shot.eye.z-shot.target.z-8.5)<1e-8,'outer-rail side retained');
   assert.equal(shot.fov,40);
  }
 }
});
