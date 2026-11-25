import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stallCenter,stallNumber,extensionSlabs,repeatFixedGeometry,createRaceGate,gateDepthFit,measureGateHorseRear,GATE_HINGE_Z,TAIL_CLEARANCE} from '../jss50-race-gate.mjs';
const raw=Buffer.from(readFileSync(new URL('../assets/jss50-approved.glb.b64',import.meta.url),'utf8'),'base64');
const jsonLength=raw.readUInt32LE(12),data=JSON.parse(raw.subarray(20,20+jsonLength)),bin=20+jsonLength+8;
class Attr{
 constructor(values,size){this.array=Float32Array.from(values);this.itemSize=size;this.count=values.length/size}
 getX(i){return this.array[i*this.itemSize]}getY(i){return this.array[i*this.itemSize+1]}getZ(i){return this.array[i*this.itemSize+2]}setX(i,v){this.array[i*this.itemSize]=v}
}
class Geo{
 constructor(){this.attrs={};this.index=null}
 setAttribute(k,v){this.attrs[k]=v;return this}getAttribute(k){return this.attrs[k]}
 computeVertexNormals(){}computeBoundingSphere(){}dispose(){}
 clone(){const g=new Geo();for(const [k,v] of Object.entries(this.attrs))g.setAttribute(k,new Attr(v.array,v.itemSize));g.index=this.index;return g}
}
class Group{
 constructor(){this.name='';this.children=[];this.position={x:0,y:0,z:0};this.scale={x:1,y:1,z:1};this.rotation={y:0}}
 add(o){this.children.push(o)}traverse(fn){fn(this);for(const o of this.children)o.traverse(fn)}
 clone(recursive=true){const g=new Group();Object.assign(g,{name:this.name,position:{...this.position},isMesh:this.isMesh,geometry:this.geometry,material:this.material});if(recursive)g.children=this.children.map(c=>c.clone(true));return g}
}
function accessor(i){
 const a=data.accessors[i],bv=data.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3}[a.type],bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],values=[];
 for(let j=0;j<a.count;j++)for(let k=0;k<size;k++){
  const offset=bin+(bv.byteOffset||0)+(a.byteOffset||0)+j*(bv.byteStride||size*bytes)+k*bytes;
  values.push(a.componentType===5126?raw.readFloatLE(offset):bytes===4?raw.readUInt32LE(offset):bytes===2?raw.readUInt16LE(offset):raw.readUInt8(offset));
 }
 return new Attr(values,size);
}
const originalMap={flipY:false,colorSpace:'srgb',anisotropy:1};
function material(){return {map:originalMap,clone(){return {...this}},dispose(){}}}
function original(i){
 const n=data.nodes[i],g=new Group();g.name=n.name;if(n.matrix)g.position.x=n.matrix[12];
 if(n.mesh!==undefined){
  const p=data.meshes[n.mesh].primitives[0],geo=new Geo();for(const [name,k] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])if(p.attributes[name]!==undefined)geo.setAttribute(k,accessor(p.attributes[name]));
  if(p.indices!==undefined)geo.index=accessor(p.indices);g.isMesh=true;g.geometry=geo;g.material=material();
 }
 for(const ch of n.children||[])g.add(original(ch));return g;
}
const THREE={Group,BufferGeometry:Geo,Float32BufferAttribute:Attr,CanvasTexture:class{dispose(){}}};
test('18-stall structural extension preserves width and repeats only ten internal cells',()=>{
 const slabs=extensionSlabs(18);assert.equal(slabs.length,12);assert.equal(slabs[0].shift,-4.9);assert.equal(slabs.at(-1).shift,4.9);
 for(let i=1;i<slabs.length;i++)assert.ok(Math.abs(slabs[i-1].hi+slabs[i-1].shift-slabs[i].lo-slabs[i].shift)<1e-8);
 const root=original(0);let min=Infinity,max=-Infinity;
 root.traverse(o=>{if(!o.name.startsWith('fixed_')||!o.isMesh)return;const g=repeatFixedGeometry(THREE,o.geometry,18),p=g.getAttribute('position');assert.ok(p.count>0&&p.count%3===0);
  for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));min=Math.min(min,p.getX(i));max=Math.max(max,p.getX(i))}
 });
 assert.ok(Math.abs(max-min-18.32)<.001);
});
test('real GLB node data produces 18 stalls, 72 independently hinged leaves and 36 correct plates',()=>{
 const source=original(0),calls=[];globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(s){calls.push(s)}})})};
 try{
  for(const count of [8,18]){
   const pitch=count===18?1.4:.98,gate=createRaceGate(THREE,source,{count,pitch,venue:'tokyo',insideRight:true});
   assert.equal(gate.doors.length,count*4);assert.equal(gate.root.children.filter(o=>/^number_/.test(o.name)).length,count*2);
   assert.ok(Math.abs(gate.root.scale.x-pitch/.98)<1e-9);
   const before=gate.doors.map(d=>d.position.x);gate.setDoors(1,0);
   for(const [i,d] of gate.doors.entries()){
    assert.equal(d.position.x,before[i]);
    if(d.name.startsWith('front'))assert.ok(Math.abs(d.rotation.y-Math.PI*.48*(d.name.endsWith('_L')?-1:1))<1e-9);
    else assert.equal(Math.abs(d.rotation.y),0);
   }
   gate.setVenue('京都');assert.equal(calls.at(-1),'KYOTO RACECOURSE');
   for(let i=0;i<count;i++){
    const center=stallCenter(count,i,pitch),number=stallNumber(count,i,true);
    const doors=gate.doors.filter(d=>d.name.startsWith('front_'+String(i+1).padStart(2,'0')));
    assert.ok(Math.abs((doors[0].position.x+doors[1].position.x)/2*gate.root.scale.x-center)<1e-8);
    assert.ok(gate.root.children.some(o=>o.name==='number_front_'+String(number).padStart(2,'0')));
   }
   gate.dispose();
  }
 }finally{delete globalThis.document}
});
test('race pages use course-specific gate and synchronize release with existing race clock',()=>{
 const tokyo=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8'),nakayama=readFileSync(new URL('../nakayama-course-preview.html',import.meta.url),'utf8');
 assert.match(tokyo,/count:18,pitch:approvedGatePitch,venue:'tokyo',insideRight:true/);
 assert.match(tokyo,/approvedRaceGate.setDoors\(gateOpening,0\)/);
 assert.match(tokyo,/approvedGatePitch=w/);
 assert.match(nakayama,/count:8,venue:'nakayama',insideRight:false/);
 assert.match(nakayama,/approvedGateRoot.translateX\(-stallCenter\(8,index\)\)/);
 assert.match(nakayama,/approvedRaceGate\?\.setDoors\(Math.min\(1,elapsed\/\.18\),0\)/);
});

test('tail clearance extends only as needed, fixing front hinge and keeping rear behind actual horse',()=>{
 for(const minZ of [null,undefined,NaN,-.8,-1.1,-1.24,-1.42,-1.8,-2.6]){
  const fit=gateDepthFit(minZ);
  assert.ok(fit.scaleZ>=1);
  assert.ok(Math.abs(GATE_HINGE_Z*fit.scaleZ+fit.offsetZ-GATE_HINGE_Z)<1e-12);
  assert.ok(Math.abs(-GATE_HINGE_Z*fit.scaleZ+fit.offsetZ-fit.rear)<1e-12);
  if(Number.isFinite(minZ))assert.ok(fit.rear<=minZ-TAIL_CLEARANCE+1e-12);
 }
 assert.equal(gateDepthFit(-1.1).scaleZ,1);
 assert.equal(gateDepthFit(null).offsetZ,0);
});
test('measure release-pose tail once, taking the more conservative rest and posed bounds',()=>{
 const events=[];
 const model={updateMatrixWorld(v){assert.equal(v,true);events.push('world')},traverse(fn){fn({isSkinnedMesh:true,skeleton:{update(){events.push('skin')}}})}};
 const mixer={setTime(v){assert.equal(v,0);events.push('pose')}};
 const THREE={Box3:class{setFromObject(obj,precise){assert.equal(obj,model);assert.equal(precise,true);events.push('bounds');return {min:{z:-1.9}}}}};
 assert.equal(measureGateHorseRear(THREE,model,mixer,-1.6),-1.9);
 assert.deepEqual(events,['pose','world','skin','bounds']);
 assert.equal(measureGateHorseRear(THREE,model,mixer,-2.2),-2.2);
});
test('race pages measure the detached horse and apply gate fit without offsetting the horse',()=>{
 for(const file of ['tokyo-turf-a-elevation-rebuild.html','nakayama-course-preview.html']){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(html,/measureGateHorseRear\(THREE,(?:horse|model),(?:runnerMixer|mixer),restMinZ\)/);
  assert.match(html,/approvedRaceGate(?:\?\.|\.)fitHorseRear\(approvedHorseRear\)/);
  const load=html.slice(html.indexOf('async function loadApprovedHorse('));
  assert.ok(load.indexOf('measureGateHorseRear(')<load.indexOf(file.startsWith('tokyo')?'runner.add(horse)':'horseRoot.add(model)'));
 }
});
