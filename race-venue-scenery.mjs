// Tokyo-style venue detail. Visual approximation, not a surveyed site plan.
// All dimensions are metres; scenery has no race-physics dependency.
export function planVenueScenery({stands,boards,surfaceAt}){
 const pieces=[],counts={entries:0,benches:0,planters:0,lights:0,flags:0,signs:0,visionBeds:0,visionCabinets:0,paths:0};
 const emit=(kind,zone,x,y,z,w,h,d,color,yaw=0,hide=true)=>{
  pieces.push({kind,zone,x,y,z,w,h,d,color,yaw,hide});
 };
 const box=(zone,x,y,z,w,h,d,color,yaw=0,hide=true)=>emit('box',zone,x,y,z,w,h,d,color,yaw,hide);
 const leaf=(zone,x,y,z,w,h,d,color)=>emit('leaf',zone,x,y,z,w,h,d,color);
 const pole=(zone,x,y,z,w,h,color)=>emit('pole',zone,x,y,z,w,h,w,color);
 const greens=[0x365e36,0x4a743b,0x628341],flowers=[0xe9e0b5,0xa34d68,0xdab65f,0xc9d9d0];
 const at=(zone,x,z,r)=>surfaceAt(zone,x,z,r);
 function planter(zone,x,z,y,w=4){
  box(zone,x,y+.30,z,w,.6,2.25,0xa9aaa0);
  box(zone,x,y+.63,z,w-.18,.12,2.05,0x534b36);
  for(let i=0;i<3;i++){
   leaf(zone,x+(i-1)*w*.27,y+.94,z,w*.37,.86,1.65,greens[i]);
   leaf(zone,x+(i-1)*w*.27,y+1.30,z+.22,.38,.30,.36,flowers[i]);
  }
 }
 for(const g of stands){
  const zone='stand',wall=g.backZ-28.9;
  // Doorways and dark recesses stay against the existing facade.
  const doors=Math.max(2,Math.floor(g.len/34));
  for(let i=0;i<doors;i++){
   const x=g.x-g.len*.43+i*g.len*.86/(doors-1);
   const z=wall-.78,y=at(zone,x,z,4.1);
   if(y==null)continue;
   box(zone,x,y+2.1,z,6.9,4.2,.45,0x667b80);
   box(zone,x,y+1.84,z-.27,5.45,3.68,.18,0x304a51);
   for(const dx of [-1.82,0,1.82])box(zone,x+dx,y+1.84,z-.39,.12,3.65,.13,0xc0c9c7);
   box(zone,x,y+4.48,z-.42,7.8,.52,1.4,0xd0d6d2);
   counts.entries++;
  }
  // Grounded promenade equipment in small repeated clusters, not the raceway.
  const groups=Math.max(2,Math.floor(g.len/42));
  for(let i=0;i<groups;i++){
   const x=g.x-g.len*.41+i*g.len*.82/(groups-1),z=wall-5.6;
   const y=at(zone,x,z,6.0);if(y==null)continue;
   box(zone,x,(y+.16)/2,z,11,.16+y,5.2,0xb7b6a9,0,false);counts.paths++;
   // Seat, backrest, two legs, and planted container.
   box(zone,x-2.9,y+.67,z,3.6,.22,.78,0x8d7356);
   box(zone,x-2.9,y+1.12,z+.35,3.6,.64,.16,0x8d7356);
   for(const dx of [-1.28,1.28])box(zone,x-2.9+dx,y+.32,z,.20,.64,.64,0x5d6869);
   counts.benches++;
   planter(zone,x+2.9,z,y,3.6);counts.planters++;
   if(i%2===0){
    const lx=x+5.5,lz=z+1.3,ly=at(zone,lx,lz,1.1);
    if(ly!=null){pole(zone,lx,ly+2.35,lz,.19,4.7,0x77878a);
     box(zone,lx,ly+4.77,lz,.85,.22,.47,0xd7dfd5);counts.lights++;}
   }else{
    const fx=x+5.4,fz=z+1.2,fy=at(zone,fx,fz,1.6);
    if(fy!=null){
     pole(zone,fx,fy+2.1,fz,.12,4.2,0xd0d6d1);
     box(zone,fx+.76,fy+3.69,fz,1.52,.86,.06,[0x386a57,0x376e86,0xb6b994][i%3]);
     counts.flags++;
    }
   }
   if(i%3===0){
    const sx=x-5.3,sz=z+1.3,sy=at(zone,sx,sz,1.4);
    if(sy!=null){
     pole(zone,sx,sy+.95,sz,.13,1.9,0x738080);
     box(zone,sx,sy+1.75,sz,2.0,.66,.19,0x28584e);
     box(zone,sx,sy+1.75,sz-.11,1.40,.13,.025,0xdce6d9);counts.signs++;
    }
   }
  }
 }
 for(const b of boards){
  const zone='vision',x=b.p.x,z=b.p.z-23,half=b.d.outerWidth/2;
  // The screen faces +Z. Plant ONLY behind it, outside the raised foundation.
  for(const side of [-1,1]){
   const px=x+side*(half+8),pz=z+1,y=at(zone,px,pz,4.2);
   if(y==null)continue;
   planter(zone,px,pz,y,6);counts.visionBeds++;
   const cx=px+side*3.9,cz=pz+3,cy=at(zone,cx,cz,2);
   if(cy!=null){
    box(zone,cx,cy+.62,cz,1.7,1.24,.82,0x778484);
    box(zone,cx,cy+.62,cz-.43,1.43,1.05,.07,0x5c6a6b);
    box(zone,cx+.49,cy+.62,cz-.48,.07,.27,.05,0xc5ccbf);counts.visionCabinets++;
   }
  }
  const y=at(zone,x,z,half+1);
  if(y!=null){
   box(zone,x,y+.06,z,b.d.outerWidth+2,.12,2.0,0xb2b6a8,0,false);counts.paths++;
  }
  const n=Math.max(3,Math.floor(b.d.outerWidth/7));
  for(let i=0;i<n;i++){
   const px=x-half+3+i*(b.d.outerWidth-6)/Math.max(1,n-1),pz=z-3.8,py=at(zone,px,pz,2.6);
   if(py==null)continue;
   leaf(zone,px,py+.58,pz,4.6,1.16,2.25,greens[i%3]);
   for(let j=0;j<3;j++)leaf(zone,px+(j-1)*1.05,py+1.10,pz+.45,.52,.35,.48,flowers[(i+j)%4]);
   counts.visionBeds++;
  }
 }
 return {pieces,counts};
}
export function installVenueScenery(THREE,scene,plan,occlusionRecords){
 const root=new THREE.Group();root.name='TokyoVenueDetails';
 const geometries={box:new THREE.BoxGeometry(1,1,1),leaf:new THREE.IcosahedronGeometry(.5,1),pole:new THREE.CylinderGeometry(.5,.5,1,7)};
 const dummy=new THREE.Object3D();
 for(const kind of Object.keys(geometries)){
  const parts=plan.pieces.filter(p=>p.kind===kind);
  if(!parts.length)continue;
  const mesh=new THREE.InstancedMesh(geometries[kind],new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,flatShading:kind==='leaf'}),parts.length);
  mesh.name='venue-'+kind;mesh.frustumCulled=false;
  parts.forEach((p,i)=>{
   dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();
   mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(p.color));
   if(p.hide){
    const original=new THREE.Matrix4();mesh.getMatrixAt(i,original);
    occlusionRecords.push({meshes:[mesh],index:i,originalMatrices:[original],hidden:false,holdUntil:0,
     center:new THREE.Vector3(p.x,p.y,p.z),radius:Math.hypot(p.w,p.h,p.d)*.5});
   }
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;root.add(mesh);
 }
 root.userData.counts=plan.counts;scene.add(root);return root;
}
