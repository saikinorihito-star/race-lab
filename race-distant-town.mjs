// Original approximate suburban skyline, not a surveyed map of Fuchu.
// A few instanced batches and one shared facade texture, no external assets.
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
const WALLS=[0xb3b2a7,0xb2b8b5,0xc1b9a9,0x9fa8a7,0xb6b0a4,0xaeb4ad];
const ROOFS=[0x68747a,0x737b78,0x797672,0x64737b,0x8b8276];
export function planDistantTown(seed=261126){
 const random=rng(seed),buildings=[],occupied=[],terrain=[],roads=[];
 const add=(x,z,w,d,h,type,yaw)=>{
  const rx=(Math.abs(Math.cos(yaw))*w+Math.abs(Math.sin(yaw))*d)/2;
  const rz=(Math.abs(Math.sin(yaw))*w+Math.abs(Math.cos(yaw))*d)/2;
  // The original scene ground is x +/-950, z +/-450. No new structure
  // may extend into that rectangle, which contains the approved course.
  if(Math.abs(x)-rx<975&&Math.abs(z)-rz<470)return false;
  if(occupied.some(p=>Math.abs(x-p.x)<rx+p.rx+7&&Math.abs(z-p.z)<rz+p.rz+7))return false;
  const wall=WALLS[Math.floor(random()*WALLS.length)],roof=ROOFS[Math.floor(random()*ROOFS.length)];
  occupied.push({x,z,rx,rz});buildings.push({x,z,w,d,h,type,yaw,wall,roof});return true;
 };
 // Two suburban belts, interrupted by wide green gaps, not a continuous wall.
 for(const sign of [-1,1]){
  for(let row=0;row<3;row++){
   const z=sign*(535+row*88);
   for(let cluster=0;cluster<7;cluster++){
    const cx=-825+cluster*275+(row%2?38:0);
    if((cluster+row+(sign===1?1:0))%7===3)continue;
    for(let j=0;j<4;j++){
     const x=cx+(j-1.5)*48+(random()-.5)*9,zz=z+(random()-.5)*16;
     const apt=row>0&&random()<.27,w=apt?28+random()*12:13+random()*12,d=apt?17+random()*8:10+random()*9;
     const h=apt?15+random()*11:5.8+random()*4.8;
     add(x,zz,w,d,h,apt?'apartment':'house',random()<.15?Math.PI/2:0);
    }
   }
  }
 }
 // Side districts complete the skyline even when the camera looks along
 // the track at either turn.
 for(const sign of [-1,1])for(let row=0;row<2;row++)for(let i=0;i<11;i++){
  if((i+row)%5===2)continue;
  const x=sign*(1025+row*83)+(random()-.5)*13,z=-475+i*95+(random()-.5)*16;
  const apt=row===1&&i%3===0;
  add(x,z,apt?29:17+random()*8,apt?23:14+random()*8,apt?16+random()*9:6+random()*4.3,apt?'apartment':'house',Math.PI/2);
 }
 // The ground extension is outside the racing model. Road strips lie only
 // on the added land, with a small separation from the old scene boundary.
 for(const sign of [-1,1]){
  terrain.push({x:0,z:sign*700,w:2600,d:500});
  terrain.push({x:sign*1125,z:0,w:350,d:900});
  for(const z of [484,578,666,765])roads.push({x:0,z:sign*z,w:2500,d:5.5});
  for(const x of [980,1076])roads.push({x:sign*x,z:0,w:5.5,d:900});
 }
 return {buildings,terrain,roads};
}
function facadeTexture(THREE){
 const c=document.createElement('canvas');c.width=128;c.height=128;
 const ctx=c.getContext('2d');if(!ctx)throw Error('facade canvas');
 ctx.fillStyle='#dbdcd4';ctx.fillRect(0,0,128,128);
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
  const a=x*32+8,b=y*32+6;
  ctx.fillStyle='#b3b5ae';ctx.fillRect(a-2,b-2,20,22);
  ctx.fillStyle=(x+y)%3===0?'#8a9b9d':'#697d85';ctx.fillRect(a,b,16,18);
  ctx.fillStyle='#aab7b5';ctx.fillRect(a+7,b,1,18);
  ctx.fillStyle='#9ba5a3';ctx.fillRect(a,b+17,16,2);
 }
 ctx.fillStyle='rgba(75,85,80,.14)';for(let y=31;y<128;y+=32)ctx.fillRect(0,y,128,1);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;return t;
}
function gableGeometry(THREE){
 // A closed triangular prism, unit footprint, bottom at -.5, ridge +.5.
 const p=[-.5,-.5,-.5,.5,-.5,-.5,0,.5,-.5,-.5,-.5,.5,.5,-.5,.5,0,.5,.5];
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);
 g.computeVertexNormals();return g;
}
export function installDistantTown(THREE,scene,plan=planDistantTown()){
 const root=new THREE.Group();root.name='DistantSuburbanSkyline';
 const dummy=new THREE.Object3D();
 const boxGeo=new THREE.BoxGeometry(1,1,1);
 const tint=new THREE.Color(0xa5b6b6);
 const air=(c,amount)=>new THREE.Color(c).lerp(tint,amount);
 function batch(name,geo,mat,items){
  if(!items.length)return;
  const mesh=new THREE.InstancedMesh(geo,mat,items.length);mesh.name=name;
  items.forEach((p,i)=>{
   dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw||0,0);dummy.scale.set(p.w,p.h,p.d);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,air(p.color,p.haze??.26));
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
 }
 // Top of the extension sits slightly below y=0, avoiding z-fighting at
 // the original terrain's shared edge.
 batch('town-land',boxGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),
  plan.terrain.map(p=>({...p,y:-.54,h:1,color:0x648b66,haze:.16})));
 batch('town-roads',boxGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),
  plan.roads.map(p=>({...p,y:-.01,h:.045,color:0x929993,haze:.30})));
 const tex=facadeTexture(THREE);
 const facadeMat=new THREE.MeshStandardMaterial({color:0xffffff,map:tex,roughness:1});
 // Plain roof/bottom keeps the window texture off horizontal surfaces.
 const plainMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
 const walls=plan.buildings.map(p=>({...p,y:p.h/2-.04,color:p.wall}));
 batch('town-facades',boxGeo,[facadeMat,facadeMat,plainMat,plainMat,facadeMat,facadeMat],walls);
 const houses=plan.buildings.filter(p=>p.type==='house');
 const apartments=plan.buildings.filter(p=>p.type==='apartment');
 batch('house-roofs',gableGeometry(THREE),plainMat,houses.map(p=>({...p,w:p.w+1.4,d:p.d+1.2,h:2.5,y:p.h+1.21,color:p.roof})));
 batch('apartment-roofs',boxGeo,plainMat,apartments.map(p=>({...p,w:p.w+.55,d:p.d+.55,h:.65,y:p.h+.285,color:p.roof})));
 batch('rooftop-services',boxGeo,plainMat,apartments.map(p=>({...p,w:p.w*.29,d:p.d*.31,h:1.8,y:p.h+1.51,color:0x9a9f9a})));
 scene.add(root);root.userData.buildingCount=plan.buildings.length;
 return root;
}
