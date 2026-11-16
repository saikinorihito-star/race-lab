// Race Lab — sculpted, image-reference-inspired 3D horse & jockey.
// Geometry, textures and race numbers are all generated locally (no external assets).
// Simulation data and camera control live in three-view.mjs.
export function makeHorseCharacterBuilder(THREE,scene,getHorseAppearance){
 const sphere=new THREE.SphereGeometry(1,24,16);
 const limbCylinder=new THREE.CylinderGeometry(1,1,1,10);
 const roundedHoof=new THREE.SphereGeometry(1,14,10);
 const earShape=new THREE.ConeGeometry(1,1,10);
 const maneShape=new THREE.ConeGeometry(1,1,7);
 const eyeWhite=new THREE.MeshPhongMaterial({color:0xfff9ee,shininess:90,specular:0x888888});
 const iris=new THREE.MeshPhongMaterial({color:0x58351e,shininess:105,specular:0xaaa3a0});
 const pupil=new THREE.MeshPhongMaterial({color:0x090f14,shininess:95,specular:0x666666});
 const glint=new THREE.MeshBasicMaterial({color:0xffffff});
 const eyelid=new THREE.MeshPhongMaterial({color:0x241913,shininess:12});
 const nostril=new THREE.MeshPhongMaterial({color:0x2a1b19,shininess:16});
 const hoofMat=new THREE.MeshPhongMaterial({color:0x2e2726,shininess:42,specular:0x444444});
 const saddleLeather=new THREE.MeshPhongMaterial({color:0x3a2521,shininess:22});
 const saddleWhite=new THREE.MeshPhongMaterial({color:0xf1ebe0,shininess:35});
 const whiteSock=new THREE.MeshPhongMaterial({color:0xf7f5ee,shininess:38,specular:0x525252});
 const blazeMat=new THREE.MeshPhongMaterial({color:0xfff5e7,side:THREE.DoubleSide,shininess:42,specular:0x666666});
 const steel=new THREE.MeshPhongMaterial({color:0xdde9e8,shininess:100,specular:0xffffff});
 const skin=new THREE.MeshPhongMaterial({color:0xefc09c,shininess:28});
 const bootMat=new THREE.MeshPhongMaterial({color:0x20252b,shininess:45});
 const goggleMat=new THREE.MeshPhongMaterial({color:0x18232c,shininess:100,specular:0x879bac});
 const outlineMat=new THREE.MeshBasicMaterial({color:0x281e1e,side:THREE.BackSide});
 const reinsMat=new THREE.MeshPhongMaterial({color:0x31211d,shininess:12});
 const maneColors=[0x251d19,0x2c2321,0x3e2721,0x332722].map(c=>new THREE.MeshPhongMaterial({color:c,shininess:36}));
 const clothPlane=new THREE.PlaneGeometry(.98,.82);

 function shape(parent,geo,mat,pos,scale,rotZ=0){
   const mesh=new THREE.Mesh(geo,mat);
   mesh.position.set(...pos);
   if(scale)mesh.scale.set(...scale);
   mesh.rotation.z=rotZ;parent.add(mesh);
   return mesh;
 }
 function line(parent,points,mat,radius=.028){
   const spline=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
   const m=new THREE.Mesh(new THREE.TubeGeometry(spline,Math.max(8,points.length*6),radius,5,false),mat);
   parent.add(m);return m;
 }
 function limb(parent,a,b,material,radiusA,radiusB){
   const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b);
   const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radiusB,radiusA,p.distanceTo(q),10,1),material);
   mesh.position.copy(p).add(q).multiplyScalar(.5);
   mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),q.sub(p).normalize());
   parent.add(mesh);return mesh;
 }
 function organicSurface(profiles,segments=22,muzzle=false,axis='x'){
   // A continuous ring-based mesh gives the horse a real 3D silhouette,
   // rather than the old pile of overlapping spheres.
   const vertices=[],colors=[],indices=[];
   const add=(u,a,b,c,f)=>{
     if(axis==='x')vertices.push(u,c+a*Math.sin(b),a*Math.cos(b)*f);
     else vertices.push(c+a*Math.cos(b),u,a*Math.sin(b)*f);
   };
   const samples=[];
   for(let k=0;k<profiles.length-1;k++){
     const start=profiles[k],end=profiles[k+1],N=4;
     for(let t=0;t<N;t++){
       const f=t/N,s=f*f*(3-2*f);
       samples.push(start.map((v,i)=>v+(end[i]-v)*s));
     }
   }
   samples.push(profiles[profiles.length-1]);
   for(let k=0;k<samples.length;k++){
     const [u,center,radA,radB]=samples[k];
     for(let j=0;j<segments;j++){
       const t=Math.PI*2*j/segments;
       add(u,radA,t,center,radB/Math.max(.001,radA));
       const bright=muzzle?1+.19*Math.max(0,Math.min(1,(u-.54)/.75)):1;
       const tone=bright*(.975+.025*Math.cos(t));
       colors.push(tone,tone,tone);
     }
   }
   for(let k=0;k<samples.length-1;k++)for(let j=0;j<segments;j++){
     const a=k*segments+j,b=(k+1)*segments+j,
           c=k*segments+(j+1)%segments,d=(k+1)*segments+(j+1)%segments;
     // In both X and Y ring constructions, the axis-first winding points outward.
     indices.push(a,b,c,b,d,c);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
   geo.setIndex(indices);geo.computeVertexNormals();
   return geo;
 }
 // Ring entries: forward/vertical station, cross-section centre, upper radius,
 // width. Geometry shared across all runners; only coat material differs.
 const bodyGeo=organicSurface([
   [-1.48,1.28,.06,.06],[-1.31,1.27,.47,.46],
   [-1.04,1.29,.59,.59],[-.67,1.32,.68,.65],
   [-.15,1.30,.73,.68],[.32,1.31,.69,.66],
   [.74,1.38,.69,.64],[1.03,1.42,.53,.49],
   [1.24,1.46,.08,.08]
 ]);
 const headGeo=organicSurface([
   [-.58,.02,.08,.08],[-.39,.04,.48,.48],
   [-.19,.08,.65,.61],[.09,.11,.74,.65],
   [.36,.03,.67,.62],[.59,-.11,.53,.51],
   [.85,-.25,.39,.45],[1.17,-.31,.40,.45],
   [1.40,-.32,.25,.35],[1.47,-.32,.05,.07]
 ],24,true);
 // A curved white facial blaze follows the forehead/bridge rather
 // than floating as a decal; it remains readable from the lower TV camera.
 const blazeGeo=new THREE.BufferGeometry();
 {
   const path=[
     [-.34,.60,.040],[-.17,.76,.105],[.04,.86,.125],[.22,.79,.122],
     [.40,.63,.095],[.58,.43,.090],[.79,.19,.070],
     [1.02,.105,.072],[1.22,.05,.075]
   ];
   const verts=[],normals=[],uv=[],indices=[];
   for(let k=0;k<path.length;k++){
     const [x,y,w]=path[k];
     for(let side=-1;side<=1;side++){
       verts.push(x,y-Math.abs(w)*.095,side*w);
       normals.push(0,1,0);uv.push(k/(path.length-1),(side+1)/2);
     }
     if(k<path.length-1){let j=k*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
   }
   blazeGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
   blazeGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   blazeGeo.setIndex(indices);blazeGeo.computeVertexNormals();
 }
 const neckGeo=organicSurface([
   [-.42,-.12,.06,.06],[-.28,-.07,.50,.53],
   [0,.02,.59,.56],[.24,.18,.56,.52],
   [.48,.27,.49,.47],[.70,.33,.39,.39],
   [.87,.36,.07,.08]
 ],20,false,'y');

 function makeNumberTexture(id,appearance){
   const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
   const c=canvas.getContext('2d');
   // All runners have the same royal-blue saddlecloth as design 1.
   // Their number, coat, cap and bridle still distinguish each entrant.
   c.fillStyle=appearance.saddleBase||'#1749ad';c.fillRect(0,0,128,128);
   c.strokeStyle='#ffffff';c.lineWidth=8;c.strokeRect(6,6,116,116);
   c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffffff';
   c.font='900 81px Arial';c.fillText(String(id),64,65);
   c.font='bold 11px Arial';c.fillText('RACE LAB',64,110);
   const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
   tex.anisotropy=2;return tex;
 }
 function jerseyTexture(id,a){
   const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
   const c=canvas.getContext('2d');
   const base=a.helmet,contrast=a.helmetNumberColor;
   c.fillStyle=base;c.fillRect(0,0,128,128);
   c.fillStyle=contrast;
   // Every jockey uses design 1's shared white-on-color diamond-check
   // motif, scaled identically; only the frame color changes.
   for(let row=-1;row<5;row++)for(let column=-1;column<5;column++){
     const x=column*42+(row%2)*21, y=row*42;
     c.beginPath();c.moveTo(x,y-17);c.lineTo(x+17,y);
     c.lineTo(x,y+17);c.lineTo(x-17,y);c.closePath();c.fill();
   }
   const texture=new THREE.CanvasTexture(canvas);
   texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;
   return texture;
 }
 // Static pieces within each animated joint are merged by material.
 // This keeps the detailed face/tack/silks while reducing mobile draw calls.
 // Hip/knee/neck/head/rider remain independent animated groups.
 function batchStaticPieces(root){
   for(const child of root.children.slice()){
     if(child.isGroup)batchStaticPieces(child);
   }
   const byMaterial=new Map();
   for(const mesh of root.children){
     if(!mesh.isMesh || Array.isArray(mesh.material))continue;
     const attrs=Object.keys(mesh.geometry.attributes).sort().join('|');
     let sets=byMaterial.get(mesh.material);
     if(!sets){sets=new Map();byMaterial.set(mesh.material,sets);}
     const meshes=sets.get(attrs)||[];
     meshes.push(mesh);sets.set(attrs,meshes);
   }
   for(const [mat,sets] of byMaterial)for(const [signature,meshes] of sets){
     if(meshes.length<2)continue;
     const keys=signature.split('|');
     const transformed=meshes.map(mesh=>{
       mesh.updateMatrix();
       const g=mesh.geometry.clone();
       g.applyMatrix4(mesh.matrix);
       return g;
     });
     const totalVertices=transformed.reduce((n,g)=>n+g.attributes.position.count,0);
     const merged=new THREE.BufferGeometry();
     for(const key of keys){
       const first=transformed[0].getAttribute(key);
       const itemSize=first.itemSize;
       const data=new Float32Array(totalVertices*itemSize);
       let cursor=0;
       for(const g of transformed){
         const attr=g.getAttribute(key);
         data.set(attr.array,cursor);
         cursor+=attr.array.length;
       }
       merged.setAttribute(key,new THREE.BufferAttribute(data,itemSize,first.normalized));
     }
     const indices=[];let offset=0;
     for(const g of transformed){
       const index=g.getIndex();
       if(index)for(const v of index.array)indices.push(v+offset);
       else for(let n=0;n<g.attributes.position.count;n++)indices.push(n+offset);
       offset+=g.attributes.position.count;
     }
     merged.setIndex(indices);
     merged.computeBoundingSphere();
     const combined=new THREE.Mesh(merged,mat);
     for(const mesh of meshes)root.remove(mesh);
     root.add(combined);
     for(const g of transformed)g.dispose();
   }
 }
 function build(id){
   const a=getHorseAppearance(id),group=new THREE.Group();scene.add(group);
   const coat=new THREE.MeshPhongMaterial({color:a.coat,shininess:52,specular:0x505050});
   const coatSculpt=new THREE.MeshPhongMaterial({
     color:a.coat,vertexColors:true,shininess:52,specular:0x505050
   });
   const muzzle=new THREE.MeshPhongMaterial({
     color:new THREE.Color(a.coat).multiplyScalar(1.16),
     shininess:58,specular:0x505050
   });
   const mane=maneColors[(id-1)%maneColors.length];
   const bridleMat=new THREE.MeshPhongMaterial({color:a.helmet,shininess:68,specular:0x686868});
   const uniformMat=new THREE.MeshPhongMaterial({color:a.helmet,shininess:45,specular:0x353535});
   const helmetTrimMat=new THREE.MeshPhongMaterial({color:a.helmetNumberColor,shininess:40});
   const silkTexture=jerseyTexture(id,a);
   const jerseyMat=new THREE.MeshPhongMaterial({map:silkTexture,shininess:42,specular:0x424242});
   const glossyEye=iris;

   // A single custom sculpt for the ribcage, with a slim silhouette contour.
   const body=new THREE.Mesh(bodyGeo,coatSculpt);group.add(body);
   const bodyStroke=new THREE.Mesh(bodyGeo,outlineMat);
   bodyStroke.position.set(0,-.055,0);bodyStroke.scale.set(1.048,1.048,1.05);
   group.add(bodyStroke);
   shape(group,sphere,coat,[-.95,1.28,0],[.56,.55,.54]);
   shape(group,sphere,coat,[.84,1.36,0],[.45,.58,.52]);
   const neckPivot=new THREE.Group();neckPivot.position.set(.68,1.39,0);group.add(neckPivot);
   shape(neckPivot,neckGeo,coatSculpt,[0,0,0],null);
   const headPivot=new THREE.Group();headPivot.position.set(.37,.61,0);
   headPivot.scale.set(.91,1.10,1.07);neckPivot.add(headPivot);
   shape(headPivot,headGeo,coatSculpt,[0,0,0],null);
   shape(headPivot,blazeGeo,blazeMat,[0,.012,0],null);
   const headContour=shape(headPivot,headGeo,outlineMat,[0,-.012,0],[1.037,1.042,1.047]);
   headContour.renderOrder=0;

   // Distinct cheek volume, smile, two shaped nostrils, glossy eyes with
   // shadowed upper eyelids. These parts stay attached during head animation.
   for(const side of [-1,1]){
     shape(headPivot,sphere,coat,[.36,-.16,side*.36],[.40,.33,.30]);
     shape(headPivot,sphere,muzzle,[1.16,-.32,side*.19],[.25,.28,.27]);
     shape(headPivot,sphere,nostril,[1.35,-.26,side*.315],[.070,.084,.035],-.15);
     shape(headPivot,sphere,eyelid,[.14,.28,side*.655],[.285,.315,.125]);
     shape(headPivot,sphere,eyeWhite,[.15,.26,side*.712],[.252,.278,.117]);
     shape(headPivot,sphere,glossyEye,[.23,.23,side*.809],[.166,.191,.062]);
     shape(headPivot,sphere,pupil,[.27,.224,side*.856],[.091,.122,.027]);
     shape(headPivot,sphere,glint,[.27,.31,side*.888],[.065,.07,.022]);
     shape(headPivot,sphere,glint,[.17,.17,side*.881],[.027,.034,.012]);
     // Short, soft horse ears instead of the previous rabbit silhouette.
     shape(headPivot,earShape,coat,[-.22,.80,side*.43],[.205,.37,.20],-.18);
     shape(headPivot,earShape,
       new THREE.MeshPhongMaterial({color:0xb46f70,shininess:15}),
       [-.186,.82,side*.478],[.106,.235,.079],-.18);
     // Bright bridle curves are above the eye instead of cutting through it.
     line(headPivot,[[-.38,.55,side*.36],[-.10,.55,side*.62],[.24,.45,side*.67]],
       bridleMat,.050);
     line(headPivot,[[-.16,.43,side*.62],[.42,.07,side*.67],[.84,-.24,side*.45]],
       bridleMat,.049);
     line(headPivot,[[.95,-.34,side*.42],[1.22,-.31,side*.42],[1.37,-.31,side*.24]],
       bridleMat,.065);
     shape(headPivot,sphere,steel,[.94,-.34,side*.47],[.084,.083,.045]);
   }
   // Mouth detail at the muzzle front.
   shape(headPivot,sphere,nostril,[1.39,-.51,0],[.055,.028,.22]);
   // Smooth windswept forelock and layered mane, not sharp spikes.
   for(let i=0;i<5;i++){
     const x=-.34+i*.15;
     shape(headPivot,sphere,mane,[x,.66-i*.077,(i%2?1:-1)*.075],
       [.18,.22,.22-i*.014],-.32);
   }
   for(let i=0;i<6;i++){
     shape(neckPivot,sphere,mane,
       [-.36+i*.14,.70-i*.033,(i%2?1:-1)*.07],
       [.20,.245,.23],-.39);
   }
   // Animated tufted tail.
   const tailPivot=new THREE.Group();tailPivot.position.set(-1.34,1.52,0);group.add(tailPivot);
   shape(tailPivot,sphere,mane,[-.17,-.02,0],[.39,.22,.24],.22);
   for(const side of [-1,0,1]){
     shape(tailPivot,sphere,mane,[-.48,-.12,side*.105],
       [.38,.17,.15],-.40);
     shape(tailPivot,maneShape,mane,[-.76,-.20,side*.155],
       [.16,.33,.14],.70);
   }

   // Four thick but articulated legs. The familiar gallopCycle drives the
   // hip and knee; this module changes only their shape, not their movement.
   const legs=[];
   for(const x of [-.85,.76])for(const z of [-.43,.43]){
     const hip=new THREE.Group();hip.position.set(x,1.05,z);group.add(hip);
     shape(hip,sphere,coat,[0,-.18,0],[.30,.39,.285],x>0?-.12:.10);
     const knee=new THREE.Group();knee.position.set(.025,-.48,0);hip.add(knee);
     shape(knee,sphere,coat,[.02,-.18,0],[.238,.29,.22]);
     // Consistent white socks on the near foreleg and off hindleg.
     if((x>0 && z>0)||(x<0 && z<0)){
       shape(knee,sphere,whiteSock,[.04,-.31,0],[.222,.165,.219]);
     }
     shape(knee,roundedHoof,hoofMat,[.115,-.43,.01],[.31,.15,.265]);
     shape(knee,sphere,steel,[.28,-.433,.01],[.025,.07,.15]);
     legs.push({hip,knee,front:x>0,side:z>0});
   }

   // A genuine colored saddlecloth with a framed racing number on either side.
   shape(group,sphere,saddleWhite,[-.24,1.88,0],[.65,.16,.59]);
   shape(group,sphere,saddleLeather,[-.32,1.94,0],[.49,.17,.51],-.12);
   const numberTexture=makeNumberTexture(id,a);
   const numberMat=new THREE.MeshBasicMaterial({map:numberTexture,side:THREE.DoubleSide});
   for(const side of [-1,1]){
     const cloth=shape(group,clothPlane,numberMat,[-.28,1.49,side*.724],null);
     if(side<0)cloth.rotation.y=Math.PI;
     line(group,[[-.21,1.89,side*.55],[-.23,1.47,side*.69],[-.22,1.04,side*.51]],
       reinsMat,.045);
     line(group,[[-.50,1.93,side*.58],[-.57,1.49,side*.70],[-.59,1.27,side*.74]],
       reinsMat,.034);
     line(group,[[-.78,1.30,side*.75],[-.78,1.20,side*.75],[-.45,1.20,side*.75]],
       steel,.036);
     line(group,[[1.96,1.69,side*.41],[1.41,1.95,side*.53],
       [.98,2.09,side*.44],[.36,2.11,side*.30]],reinsMat,.035);
   }

   // Compact forward-leaning jockey. Patterned silks and helmet stripe
   // produce distinguishable riders rather than single-color stick figures.
   const riderPivot=new THREE.Group();riderPivot.position.set(-.35,1.97,0);
   riderPivot.scale.set(1.03,1.03,1.03);group.add(riderPivot);
   shape(riderPivot,sphere,saddleWhite,[-.04,-.02,0],[.31,.20,.37]);
   for(const side of [-1,1]){
     limb(riderPivot,[-.04,-.09,side*.30],[.21,-.38,side*.60],saddleWhite,.17,.14);
     shape(riderPivot,sphere,saddleWhite,[.21,-.38,side*.60],[.16,.14,.15]);
     limb(riderPivot,[.21,-.38,side*.60],[-.25,-.63,side*.72],bootMat,.11,.10);
     shape(riderPivot,sphere,bootMat,[-.22,-.64,side*.72],[.23,.10,.13]);
   }
   const chest=shape(riderPivot,sphere,jerseyMat,[.18,.32,0],[.42,.44,.35],-.64);
   // Shoulder/sleeve panels continue the jersey design.
   for(const side of [-1,1]){
     shape(riderPivot,sphere,jerseyMat,[.30,.44,side*.29],[.23,.16,.18],-.55);
   }
   shape(riderPivot,sphere,skin,[.55,.77,0],[.28,.275,.25]);
   shape(riderPivot,sphere,eyelid,[.752,.74,0],[.078,.038,.13]);
   // Hard-shell cap with high-contrast ridge and centered stripe.
   shape(riderPivot,sphere,helmetTrimMat,[.50,1.035,0],[.438,.274,.416]);
   shape(riderPivot,sphere,uniformMat,[.50,1.055,0],[.420,.264,.400]);
   shape(riderPivot,sphere,helmetTrimMat,[.757,.916,0],[.30,.080,.295]);
   shape(riderPivot,sphere,uniformMat,[.752,.942,0],[.29,.062,.295]);
   line(riderPivot,[[.14,1.12,0],[.31,1.285,0],[.50,1.317,0],
     [.74,1.235,0],[.877,1.073,0]],helmetTrimMat,.047);
   // Deep glossy goggles and thick frames with a small reflective glint.
   for(const side of [-1,1]){
     shape(riderPivot,sphere,helmetTrimMat,[.755,.78,side*.145],[.163,.095,.116]);
     shape(riderPivot,sphere,goggleMat,[.797,.781,side*.145],[.140,.075,.102]);
     shape(riderPivot,sphere,glint,[.900,.808,side*.163],[.026,.025,.018]);
   }
   line(riderPivot,[[.61,.80,-.34],[.52,.83,-.35],[.43,.85,-.32]],bootMat,.031);
   line(riderPivot,[[.61,.80,.34],[.52,.83,.35],[.43,.85,.32]],bootMat,.031);
   for(const side of [-1,1]){
     const shoulder=[.31,.46,side*.25],elbow=[.52,.28,side*.36],
       hand=[.79,.17,side*.29];
     limb(riderPivot,shoulder,elbow,uniformMat,.145,.13);
     shape(riderPivot,sphere,uniformMat,elbow,[.133,.125,.127]);
     limb(riderPivot,elbow,hand,uniformMat,.12,.105);
     shape(riderPivot,sphere,uniformMat,hand,[.114,.095,.103]);
   }
   group.scale.set(.77,.88,.77);
   batchStaticPieces(group);
   return {id,group,legs,neckPivot,headPivot,riderPivot,tailPivot,
     gaitPhase:0,gaitLastTimestamp:null,gaitRace:null,numberTexture,numberMat,
     uniformMat,silkMat:uniformMat,helmetMat:uniformMat,helmetTrimMat,
     bridleMat,jerseyMat,silkTexture,appearanceCount:18};
 }
 function updateAppearance(model,count){
   if(model.appearanceCount===count)return;
   const a=getHorseAppearance(model.id,count);
   model.uniformMat.color.set(a.helmet);
   model.helmetTrimMat.color.set(a.helmetNumberColor);
   model.bridleMat.color.set(a.helmet);
   const nextNumber=makeNumberTexture(model.id,a);
   const oldNumber=model.numberTexture;
   model.numberMat.map=nextNumber;model.numberMat.needsUpdate=true;
   model.numberTexture=nextNumber;oldNumber.dispose();
   const nextSilk=jerseyTexture(model.id,a);
   const oldSilk=model.silkTexture;
   model.jerseyMat.map=nextSilk;model.jerseyMat.needsUpdate=true;
   model.silkTexture=nextSilk;oldSilk.dispose();
   model.appearanceCount=count;
 }
 return {build,updateAppearance};
}
