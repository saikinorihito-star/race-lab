import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function extract(name){
 const p=html.indexOf('function '+name+'('),q=html.indexOf('\n}\n',p);
 assert.ok(p>=0&&q>p,'Missing function: '+name);
 return html.slice(p,q+2);
}
class Vec3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 clone(){return new Vec3(this.x,this.y,this.z)}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this}
 multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this}
 normalize(){const r=Math.hypot(this.x,this.y,this.z)||1;return this.multiplyScalar(1/r)}
}
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const THREE={Vector3:Vec3,MathUtils:{clamp,lerp:(a,b,t)=>a+(b-a)*t}};
const horses=Array.from({length:18},(_,i)=>({
 distance:400-2*i,postDistance:0,lane:10-i*1.5
}));
const race={
 horses,lead:horses[0],leadDistance:400,tailDistance:366,
 meanLane:horses.reduce((s,h)=>s+h.lane,0)/18,gap:34,blend:1
};
function rig(angle=0){
 const state={yaw:0,pitch:0,zoom:1,pan:0,lift:0};
 const focus={value:'auto'};
 const tangent=new Vec3(Math.cos(angle),0,Math.sin(angle));
 const shot=runInNewContext('('+extract('officialEighteenCameraShot')+')',{
  THREE,camera18:state,camera18Follow:focus,
  camera18FixedAnchor:null,camera18LatestAnchor:null,
  activePlan:{distance:1400},
  fieldCenterAt:(_p,d)=>({p:new Vec3(d*tangent.x,3,d*tangent.z),t:tangent})
 });
 return {state,focus,shot,tangent};
}
function offset(v){return new Vec3(v.eye.x-v.target.x,v.eye.y-v.target.y,v.eye.z-v.target.z)}
function dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z}
function magnitude(v){return Math.hypot(v.x,v.y,v.z)}
const small=(actual,expected=0,tol=1e-7)=>
 assert.ok(Math.abs(actual-expected)<tol,'Expected '+actual+'≈'+expected);

test('true side preset is perfectly horizontal and perpendicular across the Tokyo course',()=>{
 for(const angle of [0,Math.PI/6,Math.PI/3,Math.PI/2,Math.PI,4*Math.PI/3,5*Math.PI/3]){
  const r=rig(angle),cam=r.shot('side',race),v=offset(cam);
  small(v.y);
  small(dot(v,r.tangent));
  assert.ok(magnitude(v)>=25,'Side view is not a far overhead view');
  const opposite=offset(r.shot('insideSide',race));
  small(opposite.y);
  small(dot(opposite,r.tangent));
  small(dot(v,opposite),-magnitude(v)*magnitude(opposite));
 }
});

test('tracking-relative 360-degree yaw and pitch allow both sides and below/above eye level',()=>{
 const r=rig(Math.PI/4);
 const original=offset(r.shot('side',race));
 r.state.yaw=Math.PI;
 const opposite=offset(r.shot('side',race));
 small(dot(original,opposite),-magnitude(original)*magnitude(opposite));
 r.state.yaw=2*Math.PI;
 const full=offset(r.shot('side',race));
 small(dot(original,full),magnitude(original)*magnitude(full));
 r.state.yaw=0;r.state.pitch=20*Math.PI/180;
 assert.ok(offset(r.shot('side',race)).y>0);
 r.state.pitch=-18*Math.PI/180;
 assert.ok(offset(r.shot('side',race)).y<0);
});

test('front, behind and general field presets face the correct horse direction',()=>{
 const r=rig(Math.PI/7);
 assert.ok(dot(offset(r.shot('front3q',race)),r.tangent)>0);
 assert.ok(dot(offset(r.shot('chase',race)),r.tangent)<0);
 assert.ok(offset(r.shot('field',race)).y>0);
});

test('zoom ranges from close-up to wide framing without affecting follow state',()=>{
 const r=rig();
 r.state.zoom=.30;
 const close=offset(r.shot('side',race));
 r.state.zoom=4;
 const wide=offset(r.shot('side',race));
 small(magnitude(close),16); // production minimum radius
 small(magnitude(wide),116);
 assert.equal(r.focus.value,'auto');
});

test('stationary camera keeps its world focus while horses pass, then normal tracking resumes',()=>{
 const r=rig();
 r.focus.value='fixed';
 const first=r.shot('side',race);
 const later={...race,
  horses:race.horses.map(h=>({...h,distance:h.distance+170})),
  lead:{...race.lead,distance:570},
  leadDistance:570,tailDistance:536,gap:34,blend:1};
 const second=r.shot('side',later);
 small(first.target.x,second.target.x);
 small(first.target.z,second.target.z);
 r.focus.value='auto';
 const resumed=r.shot('side',later);
 assert.ok(resumed.target.x>first.target.x+150,'Auto follow resumes moving with horses');
 assert.match(html,/value="fixed">現在位置に固定/);
 assert.match(html,/camera18FixedAnchor=camera18Follow\.value==='fixed'/);
 assert.match(extract('officialEighteenCameraShot'),/camera18FixedAnchor=\{distance,lane\}/);
});

test('target panning and individual-horse focus work independently of view rotation',()=>{
 const r=rig();
 const expectations=[['auto',395],['pack',383],['leader',400],['tail',366],['7',388],['18',366]];
 for(const [focus,x] of expectations){
  r.focus.value=focus;
  small(r.shot('side',race).target.x,x);
 }
 r.focus.value='leader';r.state.pan=24;r.state.lift=3;
 const shot=r.shot('side',race);
 small(shot.target.x,424);
 small(shot.target.y,8);
 small(offset(shot).y);
});

test('iPhone controls expose real side/opposite presets, 360 sliders and multitouch panning',()=>{
 for(const id of ['cam18Extras','cam18Follow','cam18Yaw','cam18Pitch',
  'cam18Zoom','cam18Pan','cam18Lift','cam18Reset'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/min="-180" max="180"/);
 assert.match(html,/data-cam18-view="side"/);
 assert.match(html,/data-cam18-view="insideSide"/);
 assert.match(html,/canvas\.addEventListener\('pointermove'/);
 assert.match(html,/camera18\.yaw=wrapCameraAngle\(/);
 assert.match(html,/camera18\.zoom=THREE\.MathUtils\.clamp\(/);
 assert.match(html,/camera18\.pan=THREE\.MathUtils\.clamp\(/);
 assert.match(html,/camera18\.lift=THREE\.MathUtils\.clamp\(/);
 assert.match(html,/const camera18=\{yaw:0,pitch:0,zoom:1,pan:0,lift:0\}/);
 assert.match(extract('pairTrackingView'),/insideSide/);
 assert.match(extract('setView'),/syncCamera18Controls/);
 assert.match(html,/if\(isOfficialEighteenTest&&pairTrackingView\(button\.dataset\.view\)\)resetCamera18\(\)/);
});

test('old 2/4/8 viewing math remains untouched and 18 mode uses a separate camera helper',()=>{
 const old=extract('officialPairCameraShot');
 assert.match(old,/if\(isOfficialEighteenTest\)/);
 assert.match(old,/return officialEighteenCameraShot/);
 assert.match(old,/groupCameraOffset\.zoom/);
 assert.match(old,/const extra=isOfficialEighteenTest\?/);
 assert.match(html,/const OFFICIAL_TEST_COUNT=isOfficialEighteenTest\?18:isOfficialEightTest\?8:isOfficialFourTest\?4:2/);
});
