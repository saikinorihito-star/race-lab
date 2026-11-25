import {createGateVenueController} from './jss50-gate.mjs?v=3';
export const APPROVED_PITCH=.98;
export function stallCenter(count,index,pitch=APPROVED_PITCH){return (index-(count-1)/2)*pitch}
export function stallNumber(count,index,insideRight){return insideRight?count-index:index+1}
export function extensionSlabs(count){
 if(count===8)return [{lo:-Infinity,hi:Infinity,shift:0}];
 if(count!==18)throw Error('対応枠数は8または18');
 const extra=(count-8)/2*APPROVED_PITCH,segments=[{lo:-Infinity,hi:0,shift:-extra}];
 for(let i=0;i<count-8;i++)segments.push({lo:-APPROVED_PITCH,hi:0,shift:-extra+(i+1)*APPROVED_PITCH});
 segments.push({lo:0,hi:Infinity,shift:extra});return segments;
}
// Clip triangles at cell boundaries, interpolating normals and UVs. Retain
// original end mechanisms; repeat only the internal 0.98m structural cell.
function clip(poly,x,keepGreater){
 if(!Number.isFinite(x))return poly;
 const out=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],inside=v=>keepGreater?v[0]>=x-1e-8:v[0]<=x+1e-8;
  const ia=inside(a),ib=inside(b);if(ia)out.push(a);
  if(ia!==ib){const t=(x-a[0])/(b[0]-a[0]);out.push(a.map((v,j)=>j===0?x:v+(b[j]-v)*t))}
 }
 return out;
}
export function repeatFixedGeometry(THREE,geometry,count){
 const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),idx=geometry.index;
 const p=[],n=[],u=[],slabs=extensionSlabs(count);
 const vertex=i=>[pos.getX(i),pos.getY(i),pos.getZ(i),normal?.getX(i)||0,normal?.getY(i)||0,normal?.getZ(i)||0,uv?.getX(i)||0,uv?.getY(i)||0];
 for(let i=0;i<(idx?idx.count:pos.count);i+=3){
  const tri=[0,1,2].map(j=>vertex(idx?idx.getX(i+j):i+j));
  const lo=Math.min(...tri.map(v=>v[0])),hi=Math.max(...tri.map(v=>v[0]));
  for(const slab of slabs){
   if(hi<slab.lo||lo>slab.hi)continue;
   if(Math.abs(hi-lo)<1e-8&&Math.abs(lo-slab.hi)<1e-8)continue;
   const poly=clip(clip(tri,slab.lo,true),slab.hi,false);
   for(let j=1;j<poly.length-1;j++){
    const verts=[poly[0],poly[j],poly[j+1]],a=verts[0],b=verts[1],c=verts[2],ab=b.slice(0,3).map((v,k)=>v-a[k]),ac=c.slice(0,3).map((v,k)=>v-a[k]);
    if(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])<1e-10)continue;
    for(const v of verts){p.push(v[0]+slab.shift,v[1],v[2]);const len=Math.hypot(...v.slice(3,6))||1;n.push(v[3]/len,v[4]/len,v[5]/len);u.push(v[6],v[7])}
   }
  }
 }
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 if(normal)out.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));else out.computeVertexNormals();
 if(uv)out.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));out.computeBoundingSphere();return out;
}
function numberTexture(THREE,original,number){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=96;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#e5cc32';ctx.fillRect(0,0,128,96);
 ctx.strokeStyle='#26382b';ctx.lineWidth=5;ctx.strokeRect(3,3,122,90);
 ctx.font='bold 70px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#17251a';ctx.fillText(String(number),64,49,112);
 const tex=new THREE.CanvasTexture(canvas);tex.flipY=original.flipY;tex.colorSpace=original.colorSpace;return tex;
}
export function createRaceGate(THREE,source,{count=18,pitch=APPROVED_PITCH,venue='tokyo',insideRight=true}={}){
 if(![8,18].includes(count)||!Number.isFinite(pitch)||pitch<.98||pitch>2)throw Error('発馬機の枠設定が範囲外');
 const root=new THREE.Group(),nodes=new Map(),ownedGeometries=[],ownedMaterials=[],ownedTextures=[],doors=[];
 source.traverse(o=>nodes.set(o.name,o));
 const extra=(count-8)*APPROVED_PITCH/2,numberTextures=new Map();
 for(const [name,o] of nodes){
  if(!o.isMesh)continue;
  if(name.startsWith('fixed_')){
   const mesh=o.clone(false);if(count!==8){mesh.geometry=repeatFixedGeometry(THREE,o.geometry,count);ownedGeometries.push(mesh.geometry)}root.add(mesh);
  }else if(/^brand_(front|rear)$/.test(name)){
   const mesh=o.clone(false);mesh.position.x-=extra;root.add(mesh);
  }else if(/^venue_(front|rear)$/.test(name)){
   const mesh=o.clone(false);if(extra){
    mesh.geometry=o.geometry.clone();ownedGeometries.push(mesh.geometry);
    const a=mesh.geometry.getAttribute('position'),left=-2.235,right=3.815;
    for(let i=0;i<a.count;i++)a.setX(i,left-extra+(a.getX(i)-left)/(right-left)*(right-left+2*extra));
    a.needsUpdate=true;mesh.geometry.computeBoundingSphere();
   }root.add(mesh);
  }else if(/^geometry_15[89]$/.test(name))root.add(o.clone(false));
 }
 // Copy complete hinge groups and their original child meshes, not scaled
 // copies of the whole eight-stall gate. Each hinge remains at its stall edge.
 for(let i=0;i<count;i++){
  const x=stallCenter(count,i),number=stallNumber(count,i,insideRight);
  for(const side of ['front','rear']){
   for(const lr of ['L','R']){
    const src=nodes.get(side+'_'+(count===8?String(i+1).padStart(2,'0'):'04')+'_'+lr);if(!src)throw Error('元モデルの扉不足');
    const leaf=src.clone(true);leaf.name=side+'_'+String(i+1).padStart(2,'0')+'_'+lr;
    leaf.position.x=x+(lr==='L'?-.45:.45);root.add(leaf);doors.push(leaf);
   }
   const src=nodes.get('number_'+side+'_'+(count===8?String(i+1).padStart(2,'0'):'04'));if(!src?.material?.map)throw Error('元モデルの番号板不足');
   const plate=src.clone(false);plate.position.x+=count===8?0:x-stallCenter(8,3);
   plate.name='number_'+side+'_'+String(number).padStart(2,'0');plate.material=src.material.clone();ownedMaterials.push(plate.material);
   let tex=numberTextures.get(number);
   if(!tex){tex=numberTexture(THREE,src.material.map,number);numberTextures.set(number,tex);ownedTextures.push(tex)}
   plate.material.map=tex;plate.material.needsUpdate=true;root.add(plate);
  }
 }
 const venueController=createGateVenueController(THREE,root,count);
 venueController.setVenue(venue);
 root.scale.x=pitch/APPROVED_PITCH;
 function setDoors(front=0,rear=0){for(const p of doors){const f=p.name.startsWith('front'),left=p.name.endsWith('_L');p.rotation.y=(left?-1:1)*(f?1:-1)*Math.PI*.48*Math.max(0,Math.min(1,f?front:rear))}}
 function dispose(){venueController.dispose();ownedGeometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose())}
 return {root,doors,setDoors,setVenue:venueController.setVenue,dispose,count,pitch};
}
