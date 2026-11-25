import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VISION_SPECS,visionDimensions,visionParts,createTurfVision} from '../turf-vision-model.mjs';
test('manufacturer screen sizes, aspect and pixel pitch retained without enlargement',()=>{
 for(const [key,w,h,px,py] of [['tokyo-west',66.4,11.2,5312,896],['tokyo-east',26.4,11.2,2112,896]]){
  const d=visionDimensions(key);
  assert.deepEqual([d.width,d.height,d.pixelsX,d.pixelsY],[w,h,px,py]);
  assert.ok(Math.abs(d.width/d.pixelsX-.0125)<1e-10);
  assert.ok(Math.abs(d.height/d.pixelsY-.0125)<1e-10);
  assert.equal(d.screenBottom,1.14);
  assert.ok(Math.abs(d.screenY-d.height/2-d.screenBottom)<1e-9);
  assert.ok(d.outerHeight<13);
  assert.ok(d.outerWidth>d.width);
 }
 assert.throws(()=>visionDimensions('unknown'));
});
test('all box dimensions are positive, front LED surface clear, and housing grounded',()=>{
 for(const key of Object.keys(VISION_SPECS)){
  const d=visionDimensions(key),parts=visionParts(key);
  assert.equal(new Set(parts.map(p=>p.id)).size,parts.length);
  assert.ok(parts.length<150);
  for(const p of parts){
   assert.ok(p.size.every(v=>Number.isFinite(v)&&v>0));
   assert.ok(p.center.every(Number.isFinite));
   assert.ok(p.center[1]-p.size[1]/2>=-1e-8);
   // No opaque part crosses inside the visible LED rectangle.
   const [x,y,z]=p.center,[w,h,depth]=p.size;
   const overlapX=Math.min(x+w/2,d.width/2)-Math.max(x-w/2,-d.width/2);
   const overlapY=Math.min(y+h/2,d.screenBottom+d.height)-Math.max(y-h/2,d.screenBottom);
   assert.ok(!(overlapX>1e-8&&overlapY>1e-8&&z+depth/2>=d.screenZ),p.id);
  }
 }
});
test('shared 3D model uses instancing, exact screen plane and caller-owned textures',()=>{
 class Vec{set(...v){this.v=v}}
 class Obj{constructor(){this.position=new Vec();this.scale=new Vec();this.rotation={};this.children=[]}add(...v){this.children.push(...v)}updateMatrix(){this.matrix={position:this.position.v,scale:this.scale.v}}}
 class Geometry{constructor(...size){this.size=size}dispose(){this.disposed=true}}
 class Material{constructor(params){Object.assign(this,params);this.color={setHex:v=>this.hex=v}}dispose(){this.disposed=true}}
 class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m}}
 class Instanced extends Mesh{constructor(g,m,n){super(g,m);this.count=n;this.instanceMatrix={};this.matrices=[]}setMatrixAt(i,m){this.matrices[i]=m}computeBoundingSphere(){}}
 const THREE={Group:Obj,Object3D:Obj,BoxGeometry:Geometry,PlaneGeometry:Geometry,MeshStandardMaterial:Material,MeshBasicMaterial:Material,InstancedMesh:Instanced,Mesh,FrontSide:0};
 const tex={id:1},rear={id:2},model=createTurfVision(THREE,{screenTexture:tex,rearTexture:rear});
 assert.deepEqual(model.screen.geometry.size,[66.4,11.2]);assert.equal(model.screen.material.map,tex);
 assert.equal(model.rear.rotation.y,Math.PI);assert.equal(model.rear.material.map,rear);
 assert.ok(model.root.children.length<=12);
 const instances=model.root.children.filter(x=>x instanceof Instanced);
 assert.equal(instances.reduce((v,x)=>v+x.count,0),model.parts.length);
 model.setScreenTexture(null);assert.equal(model.screen.material.map,null);
 model.setScreenTexture(tex);assert.equal(model.screen.material.map,tex);
 model.dispose();assert.equal(model.screen.geometry.disposed,true);
 assert.equal(tex.disposed,undefined);
});
test('preview contains four independent static fallback views and sample-only screen',()=>{
 const html=readFileSync(new URL('../turf-vision-preview.html',import.meta.url),'utf8');
 for(const id of ['front','angle','rear','side'])assert.match(html,new RegExp('id="'+id+'View"'));
 assert.match(html,/toggleAttribute\('hidden',view!==preview.view\)/);
 assert.match(html,/表示テスト・映像未接続/);
 const normal=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const mod=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>new Function(normal));
 assert.doesNotThrow(()=>new Function(mod.replace(/^import .*;$/gm,'')));
});
