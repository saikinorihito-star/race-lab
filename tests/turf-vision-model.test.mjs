import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VISION_SPECS,visionKeysForVenue,visionDimensions,visionParts,createTurfVision} from '../turf-vision-model.mjs';
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

test('all ten JRA venues have presets with distinct Tokyo and Nakayama screens and source status',()=>{
 const venues=['sapporo','hakodate','fukushima','niigata','tokyo','nakayama','chukyo','kyoto','hanshin','kokura'];
 assert.deepEqual([...new Set(Object.values(VISION_SPECS).map(s=>s.venueId))],venues);
 assert.equal(Object.keys(VISION_SPECS).length,12);
 assert.deepEqual(visionKeysForVenue('tokyo'),['tokyo-west','tokyo-east']);
 assert.deepEqual(visionKeysForVenue('nakayama'),['nakayama-main','nakayama-sub']);
 assert.deepEqual(visionKeysForVenue('unknown'),[]);
 assert.deepEqual(Object.entries(VISION_SPECS).filter(([,s])=>s.status==='provisional').map(([k])=>k),['sapporo-main','fukushima-main','niigata-main']);
 for(const [k,s] of Object.entries(VISION_SPECS)){
  assert.equal(Boolean(s.source),s.status!=='provisional',k);
  const d=visionDimensions(k);assert.equal(d.custom,false);
  assert.equal(d.width,s.width);assert.equal(d.height,s.height);
 }
});
test('custom size changes physical screen, cabinet, and part count but not frame or ground clearance',()=>{
 const base=visionDimensions('tokyo-west');
 for(const [width,height] of [[5,5],[5,20],[100,5],[100,20],[40.8,9.6],[33.3,12.4]]){
  const d=visionDimensions('tokyo-west',{width,height}),parts=visionParts('tokyo-west',{width,height});
  assert.equal(d.width,width);assert.equal(d.height,height);assert.equal(d.custom,true);
  assert.ok(Math.abs(d.outerWidth-width-1.04)<1e-9);
  assert.ok(Math.abs(d.outerHeight-height-1.57)<1e-9);
  assert.equal(d.screenBottom,base.screenBottom);assert.equal(d.depth,base.depth);
  for(const p of parts){
   assert.ok(p.size.every(v=>Number.isFinite(v)&&v>0));
   assert.ok(p.center[1]-p.size[1]/2>=-1e-8);
   const [x,y,z]=p.center,[w,h,depth]=p.size;
   const ox=Math.min(x+w/2,width/2)-Math.max(x-w/2,-width/2);
   const oy=Math.min(y+h/2,d.screenBottom+height)-Math.max(y-h/2,d.screenBottom);
   assert.ok(!(ox>1e-8&&oy>1e-8&&z+depth/2>=d.screenZ),p.id);
  }
 }
 for(const override of [{width:4.9},{height:20.1},{width:NaN},{width:Infinity},{height:0},{width:'66.4'}])assert.throws(()=>visionDimensions('tokyo-west',override));
 assert.equal(visionDimensions('tokyo-west').width,66.4);
});
test('preview preset selector, source labels, manual apply/reset and URL selection stay consistent with shared model',()=>{
 const html=readFileSync(new URL('../turf-vision-preview.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const presetJSON=script.match(/const presets=(\{.*\});/)[1];
 assert.deepEqual(JSON.parse(presetJSON),VISION_SPECS);
 for(const key of Object.keys(VISION_SPECS))assert.ok(html.includes('value="'+key+'"'));
 const nodes=new Map(),events=[];
 function node(id){if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},value:'',valueAsNumber:NaN,handlers:{},setAttribute(){},toggleAttribute(){},append(){},addEventListener(e,fn){this.handlers[e]=fn}});return nodes.get(id)}
 const doc={getElementById:node,querySelectorAll:()=>[],createElement:()=>node('link'),dispatchEvent:e=>events.push(e.type)};
 const run=new Function('document','location','URLSearchParams','Event',script+';return preview');
 for(const key of Object.keys(VISION_SPECS)){
  const p=run(doc,{search:'?vision='+key},URLSearchParams,Event);
  assert.equal(p.key,key);assert.equal(p.width,VISION_SPECS[key].width);
  assert.equal(p.height,VISION_SPECS[key].height);
  node('visionWidth').valueAsNumber=32;node('visionHeight').valueAsNumber=9;
  node('applySize').handlers.click();assert.equal(p.width,32);assert.equal(p.height,9);
  assert.match(node('specStatus').textContent,/手動調整値/);
  node('visionWidth').valueAsNumber=101;node('applySize').handlers.click();assert.equal(p.width,32);
  node('resetSize').handlers.click();assert.equal(p.width,VISION_SPECS[key].width);
 }
 assert.equal(run(doc,{search:'?venue=nakayama'},URLSearchParams,Event).key,'nakayama-main');
 assert.equal(run(doc,{search:'?venue=unknown'},URLSearchParams,Event).key,'tokyo-west');
 assert.ok(events.length>0);
});
