import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VISION_PLACEMENTS,monitorLayout,monitorRank,monitorTime,monitorInterval,createRaceVisionSystem} from '../turf-vision-race.mjs';
import {visionDimensions} from '../turf-vision-model.mjs';
import {DIRT_SPEC,dirtAt} from '../nakayama-course.mjs';
test('Tokyo east and west, Nakayama main and sub use their exact preset sizes and face the stands',()=>{
 assert.deepEqual(VISION_PLACEMENTS.tokyo.map(p=>[p.key,visionDimensions(p.key).width,visionDimensions(p.key).height]),[['tokyo-west',66.4,11.2],['tokyo-east',26.4,11.2]]);
 assert.deepEqual(VISION_PLACEMENTS.nakayama.map(p=>[p.key,visionDimensions(p.key).width,visionDimensions(p.key).height]),[['nakayama-main',40.8,9.6],['nakayama-sub',14.4,8]]);
 for(const p of [...VISION_PLACEMENTS.tokyo,...VISION_PLACEMENTS.nakayama])assert.equal(p.yaw,0);
 for(const p of VISION_PLACEMENTS.nakayama){
  const d=visionDimensions(p.key),hw=d.outerWidth/2+15,hd=d.depth/2+15.5;
  for(let s=0;s<DIRT_SPEC.lap;s+=2){const q=dirtAt(s);assert.ok(Math.abs(q.x-p.x)>hw+20||Math.abs(q.z-p.z)>hd+20,'infield support clearance')}
 }
});
test('video stays 16:9 and inside screen, with separate information panel',()=>{
 for(const [w,h] of [[66.4,11.2],[26.4,11.2],[40.8,9.6],[14.4,8],[5,20],[100,5]]){
  const l=monitorLayout(w,h),v=l.video;
  assert.ok(Math.abs(v.w/v.h-16/9)<1e-10);
  assert.ok(v.x>=0&&v.x+v.w<l.dataX&&l.dataX<w);
  assert.ok(v.y>=l.footer-1e-10&&v.y+v.h<=h-l.header+1e-10);
 }
});
test('rank is derived from distance and official simulated finish time, not sample values',()=>{
 const hs=[{number:1,distance:100},{number:2,distance:101},{number:3,distance:102,finished:true,finishTime:10.2},{number:4,distance:102,finished:true,finishTime:10.1}];
 assert.deepEqual(monitorRank(hs).map(h=>h.number),[4,3,2,1]);
 assert.deepEqual(hs.map(h=>h.number),[1,2,3,4]);
 assert.equal(monitorTime(0),'0:00.0');assert.equal(monitorTime(123.456),'2:03.4');
 assert.equal(monitorInterval(60,false),166);assert.equal(monitorInterval(60,true),250);assert.equal(monitorInterval(20,true),500);
});
test('two displays share one offscreen render and restore state, skip hidden screens, throttle and refresh seeks',()=>{
 class Vec{constructor(){this.set(0,0,0)}set(x,y,z){Object.assign(this,{x,y,z});return this}copy(o){return this.set(o.x,o.y,o.z)}}
 class Obj{constructor(){this.position=new Vec();this.scale=new Vec();this.rotation={y:0};this.children=[];this.visible=true}add(...v){this.children.push(...v)}updateMatrix(){this.matrix={position:this.position,scale:this.scale}}}
 class Geometry{constructor(...size){this.size=size}dispose(){}}
 class Material{constructor(params){Object.assign(this,params);this.color={setHex(){}}}dispose(){}}
 class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m}}
 class Instance extends Mesh{constructor(g,m,n){super(g,m);this.count=n;this.instanceMatrix={}}setMatrixAt(){}computeBoundingSphere(){}}
 class Target{constructor(w,h){this.w=w;this.h=h;this.texture={}}}
 class Camera extends Obj{updateMatrixWorld(){}}
 const THREE={Group:Obj,Object3D:Obj,BoxGeometry:Geometry,PlaneGeometry:Geometry,MeshStandardMaterial:Material,MeshBasicMaterial:Material,InstancedMesh:Instance,Mesh,FrontSide:0,WebGLRenderTarget:Target,PerspectiveCamera:Camera,CanvasTexture:class{constructor(c){this.canvas=c}},Frustum:class{setFromProjectionMatrix(){}intersectsSphere(){return true}},Matrix4:class{multiplyMatrices(){return this}},Vector3:Vec,Sphere:class{constructor(){this.center=new Vec()}}};
 const labels=[],ctx={scale(){},fillRect(){},fillText(t){labels.push(t)},beginPath(){},moveTo(){},bezierCurveTo(){},quadraticCurveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},createLinearGradient(){return {addColorStop(){}}}};
 globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{
  const scene=new Obj(),old={},renderer={target:old,renders:0,getRenderTarget(){return this.target},setRenderTarget(t){this.target=t},clear(){},render(){this.renders++;assert.ok(sys.groups.every(g=>!g.visible));if(this.fail)throw Error('simulated GPU failure')}};
  const sys=createRaceVisionSystem(THREE,{scene,renderer,venue:'tokyo',mobile:true}),camera=new Camera();camera.position.z=100;
  const state={ready:true,phase:'race',playing:true,elapsed:1,distance:2400,remaining:2380,horses:[{number:7,distance:20,name:'試験馬7'}],fps:60};
  assert.equal(sys.boards.length,2);assert.equal(sys.boards[0].mesh.material.map,sys.boards[1].mesh.material.map);
  assert.equal(sys.update(1000,camera,state,()=>{}),true);assert.equal(renderer.renders,1);assert.equal(renderer.target,old);assert.ok(sys.groups.every(g=>g.visible));assert.ok(labels.includes('試験馬7'));assert.ok(labels.includes('0:01.0'));
  assert.equal(sys.update(1050,camera,{...state,elapsed:1.05},()=>{}),false);
  assert.equal(sys.update(1100,camera,{...state,playing:false,elapsed:15},()=>{}),true);
  camera.position.z=-100;assert.equal(sys.update(2000,camera,state,()=>{}),false);assert.equal(renderer.renders,2);
  camera.position.z=100;renderer.fail=true;assert.equal(sys.update(2100,camera,state,()=>{}),true);assert.equal(renderer.target,old);assert.ok(sys.groups.every(g=>g.visible));assert.ok(sys.boards.every(b=>!b.mesh.visible));
  renderer.fail=false;sys.invalidate();assert.equal(sys.update(2200,camera,state,()=>{}),true);assert.ok(sys.boards.every(b=>b.mesh.visible));
 }finally{delete globalThis.document}
});
test('both courses integrate the same approved monitor system, using real simulation data',()=>{
 const tokyo=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8'),nakayama=readFileSync(new URL('../nakayama-course-preview.html',import.meta.url),'utf8');
 assert.match(tokyo,/createRaceVisionSystem\(THREE,\{scene,renderer,venue:'tokyo'/);
 assert.match(tokyo,/name:officialRunnerNames\[h.idx\]/);
 assert.match(tokyo,/raceVision.update\(time,camera,\{ready,phase/);
 assert.doesNotMatch(tokyo,/new THREE.PlaneGeometry\(66.4,11.2\)/);
 assert.match(nakayama,/createRaceVisionSystem\(THREE,\{scene,renderer,venue:'nakayama'/);
 assert.match(nakayama,/raceVision.update\(t,camera,\{ready:modelReady,single:true/);
 assert.match(nakayama,/remaining:route.distance-p.d/);
});
