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
class V{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 clone(){return new V(this.x,this.y,this.z)}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
 addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this}
 normalize(){const n=Math.hypot(this.x,this.y,this.z)||1;this.x/=n;this.y/=n;this.z/=n;return this}
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const THREE={Vector3:V,MathUtils:{lerp:(a,b,t)=>a+(b-a)*t,clamp}};
const makeShot=distance=>runInNewContext('('+fn('officialBroadcastCameraShot')+')',{
 THREE,activePlan:{distance},FINISH_DISTANCE:525.9,
 officialBroadcastStage:stages,
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
test('virtual cameras have finite nonidentical positions and target the running pack',()=>{
 for(const distance of [1400,2400,3400]){
  const shot=makeShot(distance),ids=new Set();
  for(const progress of [5,distance-1420,distance-1200,distance-900,
   distance-670,distance-400,distance-170,distance-20]){
   if(progress<0||progress>distance)continue;
   const c=shot(context(distance,progress));
   assert.ok([c.eye.x,c.eye.y,c.eye.z,c.target.x,c.target.y,c.target.z,c.fov]
    .every(Number.isFinite));
   assert.ok(c.fov>=25&&c.fov<=47);
   assert.ok(Math.hypot(c.eye.x-c.target.x,c.eye.y-c.target.y,c.eye.z-c.target.z)>10);
   ids.add(c.broadcastShotId);
  }
  assert.ok(ids.size>=5,'Need multiple distinct source cameras for '+distance);
 }
});
test('camera uses hard cuts between stations and gentle pan inside each shot',()=>{
 assert.match(html,/const cut=onBroadcast&&shot\.broadcastShotId!==lastBroadcastShotId/);
 assert.match(html,/if\(cut\|\|camera18CutPending\)\{\s*camera\.position\.copy\(shot\.eye\)/);
 assert.match(html,/camera\.position\.lerp\(shot\.eye,alpha\)/);
 assert.match(html,/broadcastCameraLabel\.textContent='📺 中継：'\+shot\.broadcastLabel/);
 assert.match(html,/camera\.fov=shot\.fov/);
 assert.match(html,/camera\.updateProjectionMatrix\(\)/);
 assert.match(fn('officialEighteenCameraShot'),/which==='broadcast'/);
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
 const first=at(90),third=at(300),wide=at(520);
 assert.match(first.broadcastShotId,/-lead$/);
 assert.match(third.broadcastShotId,/-third$/);
 assert.match(wide.broadcastShotId,/-wide$/);
 assert.match(first.broadcastLabel,/先頭3頭を拡大/);
 assert.match(third.broadcastLabel,/3番手付近を拡大/);
 assert.match(wide.broadcastLabel,/馬群全景/);
 for(const shot of [first,third,wide]){
  assert.match(shot.broadcastLabel,/先頭 1番 ／ 3番手 3番/);
  assert.ok(shot.fov>=25&&shot.fov<=47);
 }
 const dist=shot=>Math.hypot(shot.eye.x-shot.target.x,shot.eye.y-shot.target.y,shot.eye.z-shot.target.z);
 assert.ok(dist(first)<dist(wide)*.75,'Leading pack should be much closer than overview');
 assert.ok(dist(third)<dist(wide)*.75,'Third-place pack should be much closer than overview');
});
test('18-runner sharpness improvements preserve non-race modes and fixed framebuffer',()=>{
 assert.match(html,/isOfficialEighteenTest\?\{sharp:2\.0,standard:1\.65,light:1\.15\}/);
 assert.match(html,/renderQuality\.value==='auto'\?2\.0/);
 assert.match(html,/let auto18Dpr=2\.0,auto18ObservedFps=0/);
 assert.match(html,/isOfficialEighteenTest\?512:256/g);
 assert.match(html,/isOfficialEighteenTest\?8:4/);
 const auto=fn('autoTune18HorseResolution');
 assert.ok(!auto.includes('renderer.setPixelRatio('));
 assert.ok(!auto.includes('renderer.setSize('));
});
