// Optional low-poly 3D race display. Uses the same synthetic race data as 2D.
import {interpolateRaceFrame} from './visual.mjs';
import {getHorseAppearance} from './appearance.mjs';
import {gallopCycle,gallopLegPose,gallopDynamics} from './gait.mjs';
import {coursePoint,lengthAtMetres,TRACK_OUTER_OFFSET,INSIDE_MARGIN,LANE_WIDTH,raceDisplayPositions,getTurfProfile,furlongMarkerPositions,courseHeightMetres,courseSlope,raceCoursePoint,startPocket,raceCourseHeightMetres,raceCourseSlope} from './course.mjs';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js';
export async function createThreeView(host){
 const THREE = await import(THREE_URL);
 const renderer = new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.setSize(1000,560,false);
 renderer.setClearColor(0x93cbea);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.className='three-canvas';
 renderer.domElement.setAttribute('aria-label','立体的に馬群を表示する3Dレースビュー');
 host.appendChild(renderer.domElement);
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x8dd0f4);
 scene.fog=new THREE.Fog(0x8dd0f4,80,200);
 // Low, close television-style camera. The original aerial view made the horses tiny.
 const camera=new THREE.PerspectiveCamera(44,1000/560,0.1,300);
 camera.position.set(8,4.3,11.5);
 camera.lookAt(-1.4,1.65,0);
 let viewportWidth=1000,viewportHeight=560;
 function resize(){
   // Reallocate only when dimensions change. This is important on iPhone
   // portrait fullscreen: the WebGL camera must not remain 1000/560.
   const rect=host.getBoundingClientRect?.();
   const w=Math.round(rect?.width||host.clientWidth||0);
   const h=Math.round(rect?.height||host.clientHeight||0);
   if(w<64||h<64)return;
   if(Math.abs(w-viewportWidth)<2&&Math.abs(h-viewportHeight)<2)return;
   viewportWidth=w;viewportHeight=h;
   renderer.setSize(w,h,false);
   camera.aspect=w/h;
   camera.updateProjectionMatrix();
 }
 scene.add(new THREE.HemisphereLight(0xffffff,0x416e50,2.15));
 const sun=new THREE.DirectionalLight(0xffffff,2.2);
 sun.position.set(-18,35,10);scene.add(sun);
 const material=(color)=>new THREE.MeshLambertMaterial({color});
 // Tokyo turf oval is a schematic closed loop. The A-D circumference
 // and the 525.9m home straight are official JRA dimensions.
 const surroundings=new THREE.Mesh(new THREE.PlaneGeometry(620,360),new THREE.MeshLambertMaterial({color:0x317e48}));
 surroundings.rotation.x=-Math.PI/2;surroundings.position.y=-.085;scene.add(surroundings);
 let trackGroup=null,renderedTrackKey='',scoreboard=null;
 function rebuildTrack(venue,layout,course,distance){
   const key=venue+':'+layout+':'+course+':'+distance;
   if(key===renderedTrackKey)return;
   renderedTrackKey=key;
   if(trackGroup){
     scene.remove(trackGroup);
     trackGroup.traverse(node=>{
       node.geometry?.dispose();
       if(node.material){
         if(Array.isArray(node.material))node.material.forEach(m=>{m.map?.dispose();m.dispose();});
         else {node.material.map?.dispose();node.material.dispose();}
       }
     });
   }
   const lap=getTurfProfile(venue,course,layout).lap;
   scoreboard=null;
   trackGroup=new THREE.Group();scene.add(trackGroup);
   // Track height follows the continuous, periodic Tokyo/Kyoto elevation
   // profile. Turf and shoulders share precisely the same y at each lap point.
   const groundAt=metre=>courseHeightMetres(-metre,venue,layout,course);
   const turfY=(metre,offset)=>{
     const h=groundAt(metre);
     if(offset<0)return h*Math.max(0,1+offset/24);
     if(offset>TRACK_OUTER_OFFSET)return h*Math.max(0,1-(offset-TRACK_OUTER_OFFSET)/24);
     return h;
   };
   const strip=(a,b,color)=>{
     const coords=[],faces=[],steps=240;
     for(let i=0;i<=steps;i++){
       const metre=i*lap/steps;
       const inside=coursePoint(metre,a,course,venue,layout),outside=coursePoint(metre,b,course,venue,layout);
       coords.push(inside.x,turfY(metre,a)-.035,inside.z,
          outside.x,turfY(metre,b)-.035,outside.z);
       if(i<steps){const j=i*2;faces.push(j,j+2,j+1,j+1,j+2,j+3);}
     }
     const geometry=new THREE.BufferGeometry();
     geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
     geometry.setIndex(faces);geometry.computeVertexNormals();
     const mat=material(color);mat.side=THREE.DoubleSide;
     trackGroup.add(new THREE.Mesh(geometry,mat));
   };
   // Rolling embankments hide the edge of raised turf instead of floating
   // the racing surface above a perfectly flat background plane.
   strip(-24,0,0x438d4b);
   for(let i=0;i<16;i++)strip(i*2,Math.min(TRACK_OUTER_OFFSET,(i+1)*2),i%2?0x83c77a:0x73bb70);
   strip(TRACK_OUTER_OFFSET,TRACK_OUTER_OFFSET+24,0x438d4b);
   const railMat=new THREE.MeshBasicMaterial({color:0xf6f6ee});
   const postMat=material(0xf8f9f2);
   for(const offset of [0,TRACK_OUTER_OFFSET]){
     for(const y of [.52,.94]){
       const points=Array.from({length:144},(_,i)=>{
         const p=coursePoint(i*lap/144,offset,course,venue,layout);
         return new THREE.Vector3(p.x,groundAt(i*lap/144)+y,p.z);
       });
       const curve=new THREE.CatmullRomCurve3(points,true);
       const rail=new THREE.Mesh(new THREE.TubeGeometry(curve,240,.043,5,true),railMat);
       trackGroup.add(rail);
     }
     for(let d=0;d<lap;d+=15){
       const p=coursePoint(d,offset,course,venue,layout);
       const post=new THREE.Mesh(new THREE.CylinderGeometry(.047,.047,1,6),postMat);
       post.position.set(p.x,groundAt(d)+.50,p.z);trackGroup.add(post);
     }
   }
   // Kyoto inner/outer routes share the first two bends and back straight.
   // The alternate line is visible as a subtle rail around turns three/four.
   if(venue==='kyoto'){
     const otherLayout=layout==='inner'?'outer':'inner';
     const other=getTurfProfile(venue,course,otherLayout);
     const ref=[];
     for(let j=0;j<=72;j++){
       const q=1090+(other.lap-other.straight-1090)*j/72;
       const p=coursePoint(q,0,course,venue,otherLayout);
       ref.push(new THREE.Vector3(p.x,
         courseHeightMetres(-q,venue,otherLayout,course)+.78,p.z));
     }
     trackGroup.add(new THREE.Mesh(
       new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ref),94,.033,4,false),
       material(0xa7c9ce)
     ));
   }
   const pocket=startPocket(venue,layout,distance);
   if(pocket){
     const steps=54,start=-distance,finish=-pocket.joinRemaining;
     // Separate chute surface, same path and exact join as the horses.
     const coords=[],faces=[];
     for(let i=0;i<=steps;i++){
       const metre=start+(finish-start)*i/steps;
       const height=raceCourseHeightMetres(-metre,distance,venue,layout,course);
       const a=raceCoursePoint(metre,0,distance,course,venue,layout);
       const b=raceCoursePoint(metre,TRACK_OUTER_OFFSET,distance,course,venue,layout);
       coords.push(a.x,height-.031,a.z,b.x,height-.031,b.z);
       if(i<steps){const j=2*i;faces.push(j,j+2,j+1,j+1,j+2,j+3);}
     }
     const geom=new THREE.BufferGeometry();
     geom.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
     geom.setIndex(faces);geom.computeVertexNormals();
     const mat=material(0x71b770);mat.side=THREE.DoubleSide;
     trackGroup.add(new THREE.Mesh(geom,mat));
     for(const offset of [0,TRACK_OUTER_OFFSET]){
       const points=[];
       for(let i=0;i<=steps;i++){
         const metre=start+(finish-start)*i/steps;
         const p=raceCoursePoint(metre,offset,distance,course,venue,layout);
         const h=raceCourseHeightMetres(-metre,distance,venue,layout,course);
         points.push(new THREE.Vector3(p.x,h+.74,p.z));
       }
       trackGroup.add(new THREE.Mesh(
         new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),72,.048,5,false),
         railMat
       ));
     }
   }
   // Race-specific start line, permanent finish line.
   const paint=new THREE.MeshBasicMaterial({color:0xfbfbf4,side:THREE.DoubleSide});
   for(const d of [-distance,0]){
     const a=raceCoursePoint(d,0,distance,course,venue,layout),b=raceCoursePoint(d,TRACK_OUTER_OFFSET,distance,course,venue,layout);
     const dx=b.x-a.x,dz=b.z-a.z;
     const stripe=new THREE.Mesh(new THREE.PlaneGeometry(.20,Math.hypot(dx,dz)),paint);
     stripe.rotation.x=-Math.PI/2;
     stripe.rotation.z=-Math.atan2(dx,dz);
     stripe.position.set((a.x+b.x)*.5,raceCourseHeightMetres(-d,distance,venue,layout,course)-.020,(a.z+b.z)*.5);
     trackGroup.add(stripe);
   }
   // Red/white JRA-style turf furlong posts: 6=600m, 4=400m, 2=200m.
   // Marker coordinates are shared with both course maps.
   const stripeRed=material(0xd7242f),stripeWhite=material(0xfff9ed);
   for(const marker of furlongMarkerPositions(course,venue,layout)){
     const post=new THREE.Group();
     post.position.set(marker.point.x,turfY(-marker.remaining,-3.2),marker.point.z);
     trackGroup.add(post);
     for(let band=0;band<6;band++){
       const segment=new THREE.Mesh(
         new THREE.CylinderGeometry(.105,.12,.51,10),
         band%2===0?stripeWhite:stripeRed
       );
       segment.position.y=.34+band*.51;
       post.add(segment);
     }
     // Two restrained diagonal braces, as seen on real turf marker posts.
     for(const side of [-1,1]){
       const end=new THREE.Vector3(side*.50,.08,.29);
       const upper=new THREE.Vector3(0,1.18,0);
       const brace=upper.clone().sub(end);
       const support=new THREE.Mesh(
         new THREE.CylinderGeometry(.026,.026,brace.length(),6),
         material(0x345c42)
       );
       support.position.copy(end).add(upper).multiplyScalar(.5);
       support.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),brace.normalize());
       post.add(support);
     }
     // White round sign, red digit, crimson border; always faces the camera.
     const signCanvas=document.createElement('canvas');
     signCanvas.width=192;signCanvas.height=192;
     const sign=signCanvas.getContext('2d');
     sign.beginPath();sign.arc(96,96,86,0,Math.PI*2);
     sign.fillStyle='#fffdf3';sign.fill();
     sign.lineWidth=9;sign.strokeStyle='#cf2932';sign.stroke();
     sign.textAlign='center';sign.textBaseline='middle';
     sign.fillStyle='#d52232';sign.font='900 136px Arial,sans-serif';
     sign.fillText(marker.number,96,102);
     const texture=new THREE.CanvasTexture(signCanvas);
     texture.colorSpace=THREE.SRGBColorSpace;
     const label=new THREE.Sprite(new THREE.SpriteMaterial({
       map:texture,transparent:true,depthWrite:false
     }));
     label.scale.set(1.72,1.72,1);
     label.position.set(0,3.90,0);
     post.add(label);
   }
   // Finish line: photo-finish pillars and an elevated cross-frame.
   // The real-world finish architecture varies; these are recognisable
   // unbranded low-poly racing fixtures, not an exact JRA reconstruction.
   const steelWhite=material(0xf2f5ef),steelRed=material(0xc62b32),
         concrete=material(0xadb7bd),seatDark=material(0x395367),
         glazed=material(0x24455b),roof=material(0x65727b);
   const finishIn=coursePoint(0,-3.3,course,venue,layout),
         finishOut=coursePoint(0,TRACK_OUTER_OFFSET+3.3,course,venue,layout);
   const finishH=turfY(0,-3.3);
   const fixture=(geometry,mat,x,y,z)=>{
     const item=new THREE.Mesh(geometry,mat);
     item.position.set(x,y,z);trackGroup.add(item);return item;
   };
   for(const at of [finishIn,finishOut]){
     fixture(new THREE.BoxGeometry(.34,8.5,.42),steelWhite,
       at.x,finishH+4.25,at.z);
     fixture(new THREE.BoxGeometry(.55,.50,.57),steelRed,
       at.x,finishH+8.22,at.z);
   }
   fixture(new THREE.BoxGeometry(.32,.35,
     Math.hypot(finishOut.x-finishIn.x,finishOut.z-finishIn.z)),
     steelWhite,(finishIn.x+finishOut.x)*.5,finishH+8.3,
     (finishIn.z+finishOut.z)*.5);
   // A photo-finish equipment box at the outside rail, facing the infield.
   const photo=fixture(new THREE.BoxGeometry(1.0,2.8,1.5),steelWhite,
     finishOut.x+.1,finishH+5.35,finishOut.z);
   const photoWindow=new THREE.Mesh(new THREE.BoxGeometry(1.04,1.05,.75),glazed);
   photoWindow.position.set(.0,.42,0);
   photo.add(photoWindow);
   // Stand modules beside the home straight. A few broad structures and
   // long seating bands provide a grandstand silhouette cheaply on iPhone.
   const standSide=venue==='kyoto'?-1:1;
   for(const station of [-75,-170,-265]){
     const p=coursePoint(station,TRACK_OUTER_OFFSET+44,course,venue,layout);
     const z=p.z,front=standSide;
     fixture(new THREE.BoxGeometry(46,10,24),concrete,p.x,5,z);
     fixture(new THREE.BoxGeometry(46.8,4.0,24.8),glazed,p.x,11.9,z);
     fixture(new THREE.BoxGeometry(50,1.0,30),roof,p.x,17.0,z+front*1.5);
     fixture(new THREE.BoxGeometry(50,.72,1.2),steelWhite,
       p.x,17.2,z-front*13.0);
     for(let tier=0;tier<6;tier++){
       const row=coursePoint(station,TRACK_OUTER_OFFSET+29+tier*3.3,course,venue,layout);
       const elevation=5.0+tier*1.55;
       fixture(new THREE.BoxGeometry(44,.40,3.2),tier%2?seatDark:glazed,
          row.x,elevation,row.z);
       fixture(new THREE.BoxGeometry(44,.16,.22),steelWhite,
          row.x,elevation+.22,row.z-front*1.4);
     }
     // Concrete aisle divider between sections.
     fixture(new THREE.BoxGeometry(1.2,13,25),steelWhite,p.x+23,7,z);
   }
   // Outdoor LED monitor next to the grandstand, angled towards the horses.
   const boardPoint=coursePoint(-115,TRACK_OUTER_OFFSET+22,course,venue,layout);
   const boardBase=turfY(-115,TRACK_OUTER_OFFSET+22);
   for(const dx of [-6.8,6.8]){
     fixture(new THREE.BoxGeometry(.40,11,.52),steelWhite,
       boardPoint.x+dx,boardBase+5.5,boardPoint.z);
   }
   fixture(new THREE.BoxGeometry(18.0,10.5,1.1),roof,
     boardPoint.x,boardBase+15,boardPoint.z);
   const boardCanvas=document.createElement('canvas');
   boardCanvas.width=640;boardCanvas.height=360;
   const boardTexture=new THREE.CanvasTexture(boardCanvas);
   boardTexture.colorSpace=THREE.SRGBColorSpace;
   const display=new THREE.Mesh(new THREE.PlaneGeometry(17.0,9.55),
       new THREE.MeshBasicMaterial({map:boardTexture,side:THREE.DoubleSide}));
   display.rotation.y=venue==='kyoto'?0:Math.PI;
   display.position.set(boardPoint.x,boardBase+15,boardPoint.z-standSide*.59);
   trackGroup.add(display);
   scoreboard={ctx:boardCanvas.getContext('2d'),texture:boardTexture,
       venue,layout,course,distance,lastText:null};
   // Finish-post board can be read from any camera angle.
   const finishCanvas=document.createElement('canvas');
   finishCanvas.width=320;finishCanvas.height=96;
   const finCtx=finishCanvas.getContext('2d');
   finCtx.fillStyle='#fffef4';finCtx.fillRect(0,0,320,96);
   finCtx.fillStyle='#d12231';finCtx.fillRect(0,0,12,96);
   finCtx.fillRect(308,0,12,96);
   finCtx.fillStyle='#223447';finCtx.textAlign='center';
   finCtx.textBaseline='middle';finCtx.font='900 54px sans-serif';
   finCtx.fillText('GOAL',160,53);
   const finishTex=new THREE.CanvasTexture(finishCanvas);
   finishTex.colorSpace=THREE.SRGBColorSpace;
   const finishLabel=new THREE.Sprite(new THREE.SpriteMaterial({
     map:finishTex,transparent:false,depthWrite:false
   }));
   finishLabel.position.set(finishOut.x,finishH+9.6,finishOut.z);
   finishLabel.scale.set(4.0,1.2,1);
   trackGroup.add(finishLabel);
 }
 // Trees stay outside the racing surface as fixed visual landmarks.
 const trees=material(0x256a3d);
 for(let i=0;i<32;i++){
   const angle=i*Math.PI*2/32;
   const x=Math.cos(angle)*248,z=Math.sin(angle)*140;
   const tree=new THREE.Mesh(new THREE.SphereGeometry(1,7,5),trees);
   tree.position.set(x,2.4,z);tree.scale.set(2.0,2.1,2.0);scene.add(tree);
 }
 const sphere=new THREE.SphereGeometry(1,18,12);
 const capsule=new THREE.CylinderGeometry(.23,.26,1,8);
 const limbCylinder=new THREE.CylinderGeometry(1,1,1,8);
 function jointBetween(parent,start,end,mat,radius){
   const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end);
   const obj=new THREE.Mesh(limbCylinder,mat);
   obj.position.copy(a).add(b).multiplyScalar(.5);
   obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
   obj.scale.set(radius,a.distanceTo(b),radius);
   parent.add(obj);return obj;
 }
 function part(parent,geo,mat,x,y,z,sx=1,sy=1,sz=1){
   const obj=new THREE.Mesh(geo,mat);
   obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);
   parent.add(obj);return obj;
 }

 // Rounded chibi racehorses: deliberately oversized heads, short sturdy legs and brightly dressed jockeys.
 // Everything is procedural geometry, keeping mobile downloads and rendering inexpensive.
 const eyeWhite=material(0xfffcf4), pupil=material(0x172232), glint=material(0xffffff);
 const hoofMat=material(0x30251f), skin=material(0xf1c9a6);
 const maneMats=[0x29211e,0x35261f,0x453126,0x251c19].map(material);
 const earInner=material(0xbd7d78), saddleMat=material(0xfaf5e9);
 const clothGeom=new THREE.PlaneGeometry(.64,.54);
 const strokeMat=new THREE.MeshBasicMaterial({color:0x30251e,side:THREE.BackSide});
 const hoofGeom=new THREE.BoxGeometry(.48,.23,.43);
 const cone=new THREE.ConeGeometry(1,1,8);
 function raceNumberTexture(id,appearance){
   const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
   const context=canvas.getContext('2d');
   context.fillStyle=appearance.saddleBase;context.fillRect(0,0,96,96);
   context.strokeStyle=appearance.saddleBorder;context.lineWidth=10;
   context.strokeRect(6,6,84,84);
   context.font='900 60px Arial';context.textAlign='center';
   context.textBaseline='middle';context.fillStyle=appearance.numberColor;
   context.fillText(String(id),48,51);
   const texture=new THREE.CanvasTexture(canvas);
   texture.colorSpace=THREE.SRGBColorSpace;
   return texture;
 }
 function outlinedBall(parent,innerMat,x,y,z,sx,sy,sz){
   const outline=part(parent,sphere,strokeMat,x,y,z,sx*1.055,sy*1.055,sz*1.055);
   outline.renderOrder=0;
   const face=part(parent,sphere,innerMat,x,y,z,sx,sy,sz);
   face.renderOrder=1;
   return face;
 }

 // Lightweight tack curves, parented to the moving head or horse body.
 const leather=material(0x241c1b), saddleLeather=material(0x3c3029), steel=material(0xcbd7d8);
 const trim=material(0xe6d9bc);
 const tackCurve=(parent,points,mat=leather,thickness=.032)=>{
   const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
   const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,10,thickness,5,false),mat);
   parent.add(tube);return tube;
 };
 function horseModel(id){
   const group=new THREE.Group();scene.add(group);
   const appearance=getHorseAppearance(id);
   const bodyMat=material(appearance.coat);
   const muzzleMat=material(new THREE.Color(appearance.coat).multiplyScalar(1.14));
   const mane=maneMats[(id-1)%maneMats.length];
   // The helmet, jacket and sleeves SHARE one material instance, so their
   // rendered pixels are identically colored in every field-size configuration.
   // Do not use different lighting or independent material color state.
   const uniformMat=new THREE.MeshBasicMaterial({color:appearance.helmet});
   const silk=uniformMat,helmetMat=uniformMat;
   const helmetTrimMat=new THREE.MeshBasicMaterial({color:appearance.helmetNumberColor});
   // Short, round body and a broad chest.
   outlinedBall(group,bodyMat,-.08,1.25,0,1.18,.65,.64);
   part(group,sphere,bodyMat,-.92,1.28,0,.57,.58,.59);
   // Head and chest have a common moving neck root, allowing visible
   // extension, lift and dip with each stride.
   const neckPivot=new THREE.Group();
   neckPivot.position.set(.71,1.39,0);group.add(neckPivot);
   part(neckPivot,sphere,bodyMat,0,.03,0,.56,.57,.59);
   part(neckPivot,sphere,bodyMat,.29,.43,0,.43,.59,.45);
   const headPivot=new THREE.Group();
   headPivot.position.set(.37,.61,0);neckPivot.add(headPivot);
   outlinedBall(headPivot,bodyMat,.19,.01,0,.77,.65,.63);
   outlinedBall(headPivot,muzzleMat,.69,-.28,0,.61,.40,.50);
   part(headPivot,sphere,material(0x6b4939),1.09,-.26,0,.12,.23,.33);
   // Big eyes on each side with pupils facing outwards toward the camera.
   for(const side of [-1,1]){
     part(headPivot,sphere,eyeWhite,.37,.19,side*.57,.23,.27,.134);
     part(headPivot,sphere,pupil,.45,.16,side*.684,.141,.175,.064);
     part(headPivot,sphere,glint,.48,.24,side*.747,.050,.062,.028);
     part(headPivot,sphere,hoofMat,.94,-.20,side*.345,.06,.075,.033);
     const ear=part(headPivot,cone,bodyMat,-.14,.67,side*.33,.18,.35,.16);
     ear.rotation.z=side*.09;
     const inner=part(headPivot,cone,earInner,-.12,.70,side*.34,.085,.21,.075);
     inner.rotation.z=side*.09;
   }
   // Bridle: browband, noseband, cheekpieces and a visible bit on both sides.
   for(const side of [-1,1]){
     tackCurve(headPivot,[[-.13,.40,side*.39],[.04,.42,side*.58],[.21,.28,side*.61]],leather,.040);
     tackCurve(headPivot,[[.05,.40,side*.56],[.29,.05,side*.62],[.66,-.31,side*.43]],leather,.040);
     tackCurve(headPivot,[[.67,-.32,side*.44],[.90,-.31,side*.44],[1.02,-.26,side*.31]],leather,.055);
     part(headPivot,sphere,steel,.93,-.34,side*.42,.085,.075,.060);
   }
   // Small tufts on the forehead and a fluffy mane along the neck.
   for(let i=0;i<4;i++){
     const tuft=part(headPivot,sphere,mane,-.30+i*.17,.53-i*.075,0,.14,.20,.29-i*.028);
     tuft.rotation.z=-.30;
   }
   for(let i=0;i<4;i++){
     const tuft=part(neckPivot,sphere,mane,-.08-i*.20,.79-i*.075,0,.21,.20,.29);
     tuft.rotation.z=.45;
   }
   const tailPivot=new THREE.Group();tailPivot.position.set(-1.20,1.44,0);group.add(tailPivot);
   part(tailPivot,sphere,mane,-.25,-.01,0,.40,.22,.23);
   part(tailPivot,sphere,mane,-.51,-.12,0,.31,.26,.24);
   // Four short, chunky articulated legs with recognizable hooves.
   const legs=[];
   for(const x of [-.83,.75])for(const z of [-.43,.43]){
     const hip=new THREE.Group();hip.position.set(x,1.00,z);group.add(hip);
     part(hip,sphere,bodyMat,0,-.22,0,.25,.41,.24);
     const knee=new THREE.Group();knee.position.set(0,-.49,0);hip.add(knee);
     part(knee,sphere,bodyMat,.035,-.18,0,.22,.31,.20);
     part(knee,hoofGeom,hoofMat,.12,-.43,0,1,1,1);
     legs.push({hip,knee,front:x>0,side:z>0});
   }
   // Racing saddle and colored saddlecloth, with girth and visible stirrups.
   part(group,sphere,saddleMat,-.23,1.77,0,.55,.15,.56);
   const seat=part(group,sphere,saddleLeather,-.29,1.86,0,.46,.18,.48);
   seat.rotation.z=-.09;
   for(const side of [-1,1]){
     part(group,sphere,saddleLeather,-.35,1.56,side*.57,.38,.29,.095);
     // Girth, under the belly behind the forelegs.
     tackCurve(group,[[-.19,1.83,side*.49],[-.19,1.43,side*.62],[-.19,.98,side*.54]],leather,.057);
     // Stirrup leather and a silver stirrup loop next to the jockey boot.
     tackCurve(group,[[-.49,1.82,side*.52],[-.60,1.50,side*.71],[-.61,1.30,side*.75]],leather,.031);
     tackCurve(group,[[-.76,1.34,side*.75],[-.76,1.22,side*.75],[-.45,1.22,side*.75],[-.45,1.34,side*.75]],steel,.030);
     // Reins from the bit toward the jockey's hands.
     tackCurve(group,[[2.02,1.66,side*.41],[1.48,1.86,side*.55],[.95,2.06,side*.49],[.48,2.12,side*.27]],leather,.030);
     // Breastplate strap below neck.
     tackCurve(group,[[.60,1.86,side*.53],[.47,1.25,side*.62],[.08,1.10,side*.52]],leather,.039);
   }
   const numberTexture=raceNumberTexture(id,appearance);
   const numberMat=new THREE.MeshBasicMaterial({map:numberTexture,side:THREE.DoubleSide});
   for(const side of [-1,1]){
     const num=new THREE.Mesh(clothGeom,numberMat);
     num.position.set(-.27,1.46,side*.656);
     if(side<0)num.rotation.y=Math.PI;
     group.add(num);
   }
   // Race jockey in a forward two-point crouch. Hips stay centered over the
   // saddle, each thigh wraps the horse's flank and each boot rests in a stirrup.
   const riderPivot=new THREE.Group();
   riderPivot.position.set(-.30,1.94,0);
   riderPivot.scale.set(1.12,1.12,1.12); // Rider only; keep the horse unchanged.
   group.add(riderPivot);
   // For this demo the whole riding outfit, including breeches, is one
   // frame color; otherwise the visible white trousers can look like a
   // different uniform when the jockey is small on an iPhone screen.
   const breeches=uniformMat,boots=material(0x262a30);
   const gloves=material(0x302d2c);
   // Seat and pelvis make contact with the saddle, not floating above the horse.
   part(riderPivot,sphere,breeches,-.04,-.02,0,.30,.20,.37);
   for(const side of [-1,1]){
     const hip=[-.04,-.08,side*.30];
     const knee=[.21,-.37,side*.60];
     const boot=[-.25,-.63,side*.74];
     jointBetween(riderPivot,hip,knee,breeches,.155);
     part(riderPivot,sphere,breeches,...knee,.145,.15,.14);
     jointBetween(riderPivot,knee,boot,boots,.112);
     part(riderPivot,sphere,boots,boot[0]+.03,boot[1]-.015,boot[2],.21,.085,.125);
   }
   // Chest leans forwards naturally from the pelvis toward the horse's neck.
   // A larger, uninterrupted color panel prevents the white breeches
   // and dark gloves from making the uniform look different from the cap.
   const chest=part(riderPivot,sphere,uniformMat,.19,.31,0,.365,.435,.325);
   chest.rotation.z=-.62;
   const uniformAccent=uniformMat;
   for(const side of [-1,1]){
     const flash=part(riderPivot,sphere,uniformMat,.24,.33,side*.292,.25,.115,.062);
     flash.rotation.z=-.62;
   }
   part(riderPivot,sphere,skin,.51,.73,0,.235,.25,.235);
   // The colored dome occupies almost the whole cap. Only a thin contrasting
   // edge remains; the trim must never be mistaken for the helmet color.
   part(riderPivot,sphere,helmetTrimMat,.52,.976,0,.352,.191,.348);
   part(riderPivot,sphere,uniformMat,.52,1.004,0,.346,.183,.342);
   part(riderPivot,sphere,helmetTrimMat,.688,.879,-.05,.276,.063,.279);
   part(riderPivot,sphere,uniformMat,.688,.895,-.05,.268,.055,.273);
   // Slim riding goggles and a downward-looking face.
   part(riderPivot,sphere,hoofMat,.71,.78,-.16,.20,.057,.09);
   // Shoulders and elbows bend down towards both reins, with hands well forward.
   for(const side of [-1,1]){
     const shoulder=[.31,.47,side*.25];
     const elbow=[.51,.27,side*.35];
     const hand=[.77,.17,side*.27];
     jointBetween(riderPivot,shoulder,elbow,silk,.13);
     part(riderPivot,sphere,silk,...elbow,.125,.12,.12);
     jointBetween(riderPivot,elbow,hand,silk,.105);
     part(riderPivot,sphere,gloves,...hand,.112,.095,.10);
   }
   // Reduce mesh footprint relative to collision-safe lane spacing.
   group.scale.set(.77,.88,.77);
   return {group,legs,neckPivot,headPivot,riderPivot,tailPivot,id,
     gaitPhase:0,gaitLastTimestamp:null,gaitRace:null,
     numberTexture,numberMat,uniformMat,silkMat:silk,helmetMat,helmetTrimMat,
     accentMat:uniformAccent,appearanceCount:18};
 }
 const models=Array.from({length:18},(_,i)=>horseModel(i+1));
 // Subtle floor shadows provide a clear takeoff/landing cue.
 const shadowGeometry=new THREE.CircleGeometry(1,20);
 const shadowMaterial=new THREE.MeshBasicMaterial({color:0x25412c,transparent:true,opacity:.16,depthWrite:false});
 for(const model of models){
   const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);
   shadow.rotation.x=-Math.PI/2;
   shadow.position.y=.023;
   scene.add(shadow);
   model.shadow=shadow;
 }
 // Reference-style black horse nameplates are billboard sprites, drawn in the 3D video as well.
 function makeNameLabel(text,id,fieldCount=18){
   const image=document.createElement('canvas');image.width=512;image.height=104;
   const ctx=image.getContext('2d');
   const safe=String(text||'競走馬').slice(0,12);
   ctx.fillStyle='rgba(10,18,18,.91)';
   ctx.beginPath();ctx.roundRect(14,10,484,84,16);ctx.fill();
   ctx.lineWidth=4;ctx.strokeStyle='#f7f5e8';ctx.stroke();
   // A small colored frame badge is readable even when helmet details are distant.
   const appearance=getHorseAppearance(id,fieldCount);
   ctx.fillStyle=appearance.helmet;
   ctx.beginPath();ctx.roundRect(27,23,94,58,10);ctx.fill();
   ctx.strokeStyle='#fafafa';ctx.lineWidth=3;ctx.stroke();
   ctx.fillStyle=appearance.helmetNumberColor;
   ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font='bold 31px -apple-system, Hiragino Sans, sans-serif';
   ctx.fillText(appearance.frame+'枠',74,53,89);
   ctx.fillStyle='#fff';ctx.font='bold 46px -apple-system, Hiragino Sans, sans-serif';
   ctx.fillText(safe,308,55,346);
   const tex=new THREE.CanvasTexture(image);
   tex.colorSpace=THREE.SRGBColorSpace;
   const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
   sprite.position.set(.05,4.03,0);
   sprite.scale.set(3.8,.77,1);
   sprite.visible=false;
   return {sprite,tex};
 }
 for(const model of models){
   const nameLabel=makeNameLabel('',model.id);
   model.group.add(nameLabel.sprite);
   model.nameLabel=nameLabel;
   model.lastName='';model.labelCount=18;
 }
 // Refresh only the appearance-specific materials when the field size changes.
 // Unused models stay hidden rather than remaining at their previous position.
 function setFieldAppearance(model,count){
   if(model.appearanceCount===count)return;
   const colors=getHorseAppearance(model.id,count);
   // One update colors the helmet, jacket AND sleeves because all share
   // the same Three.js material object.
   model.uniformMat.color.set(colors.helmet);
   model.helmetTrimMat.color.set(colors.helmetNumberColor);
   const oldTex=model.numberTexture;
   const nextTex=raceNumberTexture(model.id,colors);
   model.numberMat.map=nextTex;model.numberMat.needsUpdate=true;
   model.numberTexture=nextTex;oldTex.dispose();
   model.appearanceCount=count;
 }
 const neutral=Array.from({length:18},(_,i)=>({id:i+1,x:0,lane:i}));
 let disposed=false;
 let cameraReady=false,lastLeadS=0,lastCameraRace=null,lastCameraTime=null,lastCameraCourse='A';
 let turnCueRace=null,turnCueKey='',turnCueTime=null;
 function firstTurnCueTime(race,distance,course,venue,layout){
   if(!race?.frames?.length)return null;
   const key=[distance,course,venue,layout].join(':');
   if(race===turnCueRace&&key===turnCueKey)return turnCueTime;
   turnCueRace=race;turnCueKey=key;turnCueTime=null;
   // Detect the first substantial course bend using the actual route
   // heading, rather than guessing a time/distance for each start pocket.
   const frames=race.frames,stride=Math.max(1,Math.floor(frames.length/350));
   for(let i=0;i<frames.length;i+=stride){
     const snap=frames[i];
     if(snap.t<4)continue;
     const leadX=Math.max(...snap.horses.map(h=>h.x));
     if(leadX<Math.min(75,distance*.04)||leadX>distance*.70)continue;
     const p=lengthAtMetres(leadX,distance);
     const a=raceCoursePoint(p-32,0,distance,course,venue,layout);
     const b=raceCoursePoint(p+32,0,distance,course,venue,layout);
     const dot=Math.max(-1,Math.min(1,a.dx*b.dx+a.dz*b.dz));
     if(Math.acos(dot)>.15){turnCueTime=snap.t;break;}
   }
   return turnCueTime;
 }
 let viewState=null;
 const cameraAim=new THREE.Vector3();
 function render(race,horses,time,options={}){
   if(disposed)return;
   resize();
   const entrants=horses?.length?horses.length:18;
   const raceDistance=race?.distance||options.distance||2400;
   const course=race?.course||options.course||'A';
   const venue=race?.venue||options.venue||'tokyo';
   const layout=race?.layout||options.layout||'outer';
   const horseScale=Math.sqrt(getTurfProfile(venue,course,layout).maxWidth/41);
   rebuildTrack(venue,layout,course,raceDistance);
   const frame=race?.frames?.length ? interpolateRaceFrame(race.frames,time)
      : {t:time,horses:horses?.length?horses.map(h=>({id:h.id,x:0,lane:h.id-1})):neutral};
   const lead=Math.max(...frame.horses.map(h=>h.x));
   if(scoreboard){
     const remaining=Math.max(0,Math.ceil(raceDistance-lead));
     // Redraw the monitor only every 25 racing metres.
     const label=remaining===0?'GOAL':remaining+'m';
     const bucket=remaining===0?'GOAL':String(Math.ceil(remaining/25)*25);
     if(scoreboard.lastText!==bucket){
       scoreboard.lastText=bucket;
       const ctx=scoreboard.ctx;
       const w=640,h=360;
       ctx.fillStyle='#091e32';ctx.fillRect(0,0,w,h);
       ctx.fillStyle='#23c8aa';ctx.fillRect(0,0,w,13);
       ctx.fillStyle='#d9e7ed';ctx.font='bold 34px sans-serif';
       ctx.fillText('RACE LAB  /  '+(venue==='kyoto'?'KYOTO':'TOKYO'),32,70);
       ctx.strokeStyle='#436172';ctx.lineWidth=3;
       ctx.beginPath();ctx.moveTo(32,104);ctx.lineTo(607,104);ctx.stroke();
       ctx.textAlign='center';ctx.fillStyle='#ffffff';
       ctx.font='bold 114px sans-serif';ctx.fillText(label,320,241);
       ctx.font='bold 34px sans-serif';ctx.fillStyle='#c8e3d7';
       ctx.fillText('TURF  /  '+course+' COURSE',320,314);
       ctx.textAlign='left';
       scoreboard.texture.needsUpdate=true;
     }
   }
   const leadS=lengthAtMetres(lead,raceDistance);
   const leaders=[...frame.horses].sort((a,b)=>b.x-a.x).slice(0,1);
   const displayed=raceDisplayPositions(race,frame,raceDistance,course,venue,layout);
   // Playback speed affects screen motion. Faster legs remain visually readable
   // instead of matching an unrealistic 12x hoof-strike rate.
   const motionTime=performance.now()*.001;
   const replaySpeed=Number(options.replaySpeed)||4;
   for(const model of models){
     const item=frame.horses.find(h=>h.id===model.id);
     if(!item){
       model.group.visible=false;model.shadow.visible=false;
       model.nameLabel.sprite.visible=false;
       continue;
     }
     setFieldAppearance(model,entrants);
     const gap=Math.max(0,lead-item.x);
     // Display-only safety spacing prevents long 3D bodies intersecting in bends.
     // Simulation order and lane decisions are still determined by the race engine.
     const point=displayed.get(item.id).point;
     model.group.position.set(point.x,.018,point.z);
     model.group.rotation.y=point.yaw;
     // Never abruptly hide a runner when it falls 92m behind the leader.
     // Let camera clipping and distance fog handle out-of-frame horses.
     model.group.visible=true;
     model.group.scale.set(horseScale,horseScale,horseScale);
     model.shadow.visible=model.group.visible;
     const shouldLabel=!!race && leaders.some(v=>v.id===model.id);
     model.nameLabel.sprite.visible=shouldLabel;
     if(shouldLabel){
       const name=horses?.find(v=>v.id===model.id)?.name || 'サンプル'+model.id;
       if(name!==model.lastName||model.labelCount!==entrants){
         model.group.remove(model.nameLabel.sprite);
         model.nameLabel.sprite.material.dispose();
         model.nameLabel.tex.dispose();
         model.nameLabel=makeNameLabel(name,model.id,entrants);
         model.group.add(model.nameLabel.sprite);
         model.lastName=name;model.labelCount=entrants;
       }
     }
     // All horses share a four-beat sequence; velocity changes the stride.
     // Continuous phase integration prevents animation snaps at speed changes.
     const dynamics=gallopDynamics(item.speedNow,replaySpeed);
     if(model.gaitRace!==race){
       model.gaitRace=race;model.gaitPhase=0;model.gaitLastTimestamp=motionTime;
     }
     const deltaTime=Math.max(0,Math.min(.08,motionTime-(model.gaitLastTimestamp??motionTime)));
     model.gaitLastTimestamp=motionTime;
     model.gaitPhase=(model.gaitPhase+deltaTime*dynamics.hz)%1;
     const cycle=gallopCycle(model.gaitPhase,1);
     const theta=cycle*Math.PI*2;
     const airborne=cycle>.60&&cycle<.91
       ?Math.sin(Math.PI*(cycle-.60)/.31):0;
     const lift=Math.max(0,airborne);
     const thrust=Math.sin(theta-.55);
     const displayedS=displayed.get(item.id).s;
     const trackHeight=raceCourseHeightMetres(-displayedS,raceDistance,venue,layout,course);
     model.group.position.y=trackHeight+.020+lift*dynamics.bob+thrust*.032;
     // The horse leans into the local grade; the animated stride is additive.
     const grade=raceCourseSlope(-displayedS,raceDistance,venue,layout,course);
     model.group.rotation.z=-.019+Math.sin(theta+.32)*.075+
       Math.max(-.12,Math.min(.12,grade*2.2));
     model.group.rotation.x=Math.sin(theta*.5+model.id)*.007;
     for(const leg of model.legs){
       const pose=gallopLegPose(leg.front,leg.side,cycle,dynamics.stride);
       // The front legs reach forward; rear legs actively kick backward.
       const thrustStep=Math.sin(theta+(leg.front?-.3:1.2)+(leg.side?.22:0));
       leg.hip.rotation.z=pose.hip+thrustStep*(leg.front?.16:-.20);
       leg.knee.rotation.z=pose.knee+Math.max(0,-thrustStep)*(leg.front?.18:-.13);
     }
     // Distinct neck pump: extends/lifts during front-leg recovery and
     // dips during ground contact. Head follows the moving neck naturally.
     model.neckPivot.rotation.z=.025+Math.sin(theta+.90)*dynamics.neck;
     model.neckPivot.position.x=.71+Math.cos(theta+.40)*.082;
     model.neckPivot.position.y=1.39-Math.sin(theta+.90)*.073;
     model.headPivot.rotation.z=-.035+Math.sin(theta+1.55)*.105;
     model.tailPivot.rotation.y=Math.sin(theta+.34)*.135;
     model.riderPivot.rotation.z=-.018-Math.sin(theta+.56)*.030;
     model.riderPivot.position.y=1.94-Math.max(0,Math.sin(theta+.85))*.026;
     model.shadow.position.x=model.group.position.x;
     model.shadow.position.z=model.group.position.z;
     model.shadow.position.y=trackHeight+.023;
     const shadowSize=1-lift*.20;
     model.shadow.scale.set(1.42*shadowSize*horseScale,.60*shadowSize*horseScale,1);
   }
   // Race-broadcast framing. Prefer a stable side / three-quarter view
   // that keeps jockeys legible. Most of the frame should contain horses,
   // rather than empty sky and turf. The exact JRA camera rigs aren't
   // reproduced: this is a cinematic framing inspired by broadcast stills.
   const smooth01=value=>{
     const t=Math.max(0,Math.min(1,value));
     return t*t*(3-2*t);
   };
   const runners=[...frame.horses].sort((a,b)=>b.x-a.x);
   const leader=runners[0];
   const last=runners[runners.length-1];
   const remaining=Math.max(0,raceDistance-leader.x);
   const finalRun=smooth01((650-remaining)/470);
   const intro=smooth01((frame.t-3)/11);
   // Always favour the race-relevant pack, not an empty point several
   // horse-lengths ahead of the leader.
   const groupSize=Math.min(entrants,Math.max(2,Math.round(entrants*.54)));
   const topGroup=runners.slice(0,groupSize);
   const frontMiddle=topGroup[Math.floor((topGroup.length-1)*.48)];
   const raceMiddle=runners[Math.floor((runners.length-1)*.46)];
   const packTarget=frontMiddle.x*.77+raceMiddle.x*.23;
   const topTarget=runners[Math.min(2,runners.length-1)].x;
   const targetLead=packTarget*(1-finalRun*.84)+topTarget*finalRun*.84;
   // Short first-turn coverage: gently move from the leaders to the
   // middle / rear of the field and return. Avoid the previous 23s sweep.
   const firstBend=firstTurnCueTime(race,raceDistance,course,venue,layout);
   const shotU=firstBend===null?-1:(frame.t-(firstBend-1.6))/12;
   const inTurnShot=shotU>0&&shotU<1;
   const rearSweep=inTurnShot
      ?(shotU<.5?smooth01(shotU*2):1-smooth01((shotU-.5)*2)):0;
   const bendTarget=runners[Math.floor((runners.length-1)*.70)].x;
   const focusX=Math.max(0,targetLead*(1-rearSweep*.68)+bendTarget*rearSweep*.68);
   const focusS=lengthAtMetres(focusX,raceDistance);
   const nearRunners=runners.filter(h=>Math.abs(h.x-focusX)<32);
   const meanLane=nearRunners.length
     ?nearRunners.reduce((sum,h)=>sum+h.lane,0)/nearRunners.length
     :(entrants-1)/2;
   const direction=raceCoursePoint(focusS,0,raceDistance,course,venue,layout);
   const insideSign=venue==='kyoto'?-1:1;
   const insideX=insideSign*direction.dz,insideZ=-insideSign*direction.dx;
   const trackCenter=raceCoursePoint(focusS,
      INSIDE_MARGIN+meanLane*LANE_WIDTH,raceDistance,course,venue,layout);
   const gateCenter=raceCoursePoint(focusS,
      INSIDE_MARGIN+(entrants-1)*LANE_WIDTH*.5,raceDistance,course,venue,layout);
   const focusHeight=raceCourseHeightMetres(-focusS,raceDistance,venue,layout,course);
   const fit=!!options.fitEntireVideo;
   const isPortrait=camera.aspect<.90;
   // Medium-telephoto broadcast lens. On tall phones a deliberately
   // narrower horizontal view focuses on the current pack.
   const fov=(isPortrait?45:36)+(fit?11:0)+
     (1-intro)*6-finalRun*2;
   if(Math.abs(camera.fov-fov)>.05){
     camera.fov=fov;
     camera.updateProjectionMatrix();
   }
   // In world units: 3/4 front, mainly side-on through the back straight,
   // elevated slightly for bends to make lanes and passing visible.
   const bendBefore=raceCoursePoint(focusS-35,0,raceDistance,course,venue,layout);
   const bendAfter=raceCoursePoint(focusS+35,0,raceDistance,course,venue,layout);
   const turnCos=Math.max(-1,Math.min(1,
     bendBefore.dx*bendAfter.dx+bendBefore.dz*bendAfter.dz));
   const onBend=smooth01((Math.acos(turnCos)-.11)/.35);
   const packSpan=Math.max(0,leader.x-topGroup[topGroup.length-1].x);
   const spreadScale=Math.max(0,Math.min(1,packSpan/50));
   const backOff=fit?1.42:1;
   // These tight distances make riders and caps visibly larger while
   // preserving a few horses side-by-side on phone screens.
   const side=backOff*(11.4+spreadScale*2.5+onBend*.7);
   const ahead=backOff*(4.7+finalRun*5+onBend*1.5);
   const rise=backOff*(5.0+onBend*1.9);
   const followPos=new THREE.Vector3(
     trackCenter.x+direction.dx*ahead+insideX*side,
     focusHeight+rise,
     trackCenter.z+direction.dz*ahead+insideZ*side
   );
   const followAim=new THREE.Vector3(
     trackCenter.x+direction.dx*.6,focusHeight+1.56,
     trackCenter.z+direction.dz*.6
   );
   // A broader starting-gate shot, then a gradual lens move into the
   // moving pack. No arbitrary camera snap after the first corner.
   const gateScale=backOff*(1+entrants*.022);
   const gatePos=new THREE.Vector3(
     gateCenter.x+direction.dx*18*gateScale+insideX*16.5*gateScale,
     focusHeight+7.7*gateScale,
     gateCenter.z+direction.dz*18*gateScale+insideZ*16.5*gateScale
   );
   const gateAim=new THREE.Vector3(
     gateCenter.x,focusHeight+1.52,gateCenter.z
   );
   const wanted=gatePos.lerp(followPos,intro);
   const wantedAim=gateAim.lerp(followAim,intro);
   // Gentle smoothing prevents abrupt camera shifts during lane changes.
   // Smooth continuous tracking throughout the race. Snap only when loading
   // a new race or explicitly seeking the video (not during normal playback).
   const raceTime=Number(frame.t)||0;
   const delta=lastCameraTime===null?0:raceTime-lastCameraTime;
   const manuallySeeked=lastCameraTime!==null && (delta<-.25||delta>2.0);
   if(!cameraReady||race!==lastCameraRace||venue+':'+layout+':'+course!==lastCameraCourse||manuallySeeked){
     camera.position.copy(wanted);cameraAim.copy(wantedAim);cameraReady=true;
   }else{
     const follow=Math.min(.36,1-Math.exp(-Math.max(0,delta)*1.2));
     camera.position.lerp(wanted,follow);cameraAim.lerp(wantedAim,follow);
   }
   lastLeadS=focusS;lastCameraRace=race;lastCameraTime=raceTime;lastCameraCourse=venue+':'+layout+':'+course;
   camera.lookAt(cameraAim);
   camera.updateMatrixWorld();
   // Share the ACTUAL 3D camera position and frustum with the upper overview.
   // Its dots therefore match the horses on this exact frame, not a separate
   // second approximation of race positions.
   const visibleIds=[];
   const center=new THREE.Vector3();
   for(const model of models){
     if(!model.group.visible)continue;
     center.set(model.group.position.x,model.group.position.y+1.40,model.group.position.z).project(camera);
     if(center.z>=-1&&center.z<=1&&Math.abs(center.x)<=1.03&&Math.abs(center.y)<=1.03){
       visibleIds.push(model.id);
     }
   }
   viewState={
     camera:{x:camera.position.x,z:camera.position.z},
     target:{x:cameraAim.x,z:cameraAim.z},
     visibleIds,
     turnShot:inTurnShot,
     scanProgress:rearSweep,
     frameMode:intro<.99?'スタート':finalRun>.6?'直線':'馬群追跡'
   };
   renderer.render(scene,camera);
 }
 function dispose(){
   disposed=true;scene.traverse(obj=>{
     obj.geometry?.dispose();
     if(obj.material){
       if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());
       else obj.material.dispose();
     }
   });
   for(const m of models){
     m.numberTexture.dispose();
     m.nameLabel.sprite.material.dispose();
     m.nameLabel.tex.dispose();
   }
   if(trackGroup){scene.remove(trackGroup);trackGroup.traverse(node=>{node.geometry?.dispose();if(node.material){if(Array.isArray(node.material))node.material.forEach(m=>{m.map?.dispose();m.dispose();});else {node.material.map?.dispose();node.material.dispose();}}})}
   renderer.dispose();renderer.domElement.remove();
 }
 render(null,null,0);
 return {render,resize,dispose,canvas:renderer.domElement,getViewState:()=>viewState};
}
