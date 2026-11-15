// Optional low-poly 3D race display. Uses the same synthetic race data as 2D.
import {interpolateRaceFrame} from './visual.mjs';
import {getHorseAppearance} from './appearance.mjs';
import {gallopCycle,gallopLegPose} from './gait.mjs';
import {coursePoint,lengthAtMetres,HALF_LAP_LENGTH,TRACK_OUTER_OFFSET,INSIDE_MARGIN,LANE_WIDTH,raceDisplayPositions} from './course.mjs';
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
 scene.fog=new THREE.Fog(0x8dd0f4,65,155);
 // Low, close television-style camera. The original aerial view made the horses tiny.
 const camera=new THREE.PerspectiveCamera(44,1000/560,0.1,210);
 camera.position.set(8,4.3,11.5);
 camera.lookAt(-1.4,1.65,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x416e50,2.15));
 const sun=new THREE.DirectionalLight(0xffffff,2.2);
 sun.position.set(-18,35,10);scene.add(sun);
 const material=(color)=>new THREE.MeshLambertMaterial({color});
 // Shared half-lap: lower straight -> counterclockwise 180° turn -> upper straight.
 const surroundings=new THREE.Mesh(new THREE.PlaneGeometry(410,260),material(0x317e48));
 surroundings.rotation.x=-Math.PI/2;surroundings.position.y=-.085;scene.add(surroundings);
 function strip(offsetA,offsetB,color){
   const pos=[],indices=[],steps=160;
   for(let i=0;i<=steps;i++){
     const s=-45+i*(HALF_LAP_LENGTH+75)/steps;
     const a=coursePoint(s,offsetA),b=coursePoint(s,offsetB);
     pos.push(a.x,-.035,a.z,b.x,-.035,b.z);
     if(i<steps){const j=2*i;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
   }
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   geometry.setIndex(indices);geometry.computeVertexNormals();
   const mat=material(color);mat.side=THREE.DoubleSide;
   const mesh=new THREE.Mesh(geometry,mat);scene.add(mesh);
 }
 // All racing surface is turf. Alternate mowing shades across the track width.
 for(let i=0;i<16;i++)strip(i*2,Math.min(TRACK_OUTER_OFFSET,(i+1)*2),i%2?0x83c77a:0x73bb70);
 const lineMat=new THREE.MeshBasicMaterial({color:0xf6f6ee});
 function rail(offset){
   for(const y of [.52,.94]){
     const points=Array.from({length:106},(_,i)=>{
       const p=coursePoint(-45+i*(HALF_LAP_LENGTH+75)/105,offset);
       return new THREE.Vector3(p.x,y,p.z);
     });
     const curve=new THREE.CatmullRomCurve3(points);
     const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,192,.043,5,false),lineMat);
     scene.add(mesh);
   }
   const postMat=material(0xf8f9f2);
   for(let d=-45;d<=HALF_LAP_LENGTH+30;d+=5.8){
     const p=coursePoint(d,offset);
     const post=new THREE.Mesh(new THREE.CylinderGeometry(.047,.047,1,6),postMat);
     post.position.set(p.x,.50,p.z);scene.add(post);
   }
 }
 rail(0);rail(TRACK_OUTER_OFFSET);
 // White starting and finishing lines, independent from the camera.
 const paint=new THREE.MeshBasicMaterial({color:0xfbfbf4,side:THREE.DoubleSide});
 for(const d of [0,HALF_LAP_LENGTH]){
   const a=coursePoint(d,0),b=coursePoint(d,TRACK_OUTER_OFFSET);
   const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
   const stripe=new THREE.Mesh(new THREE.PlaneGeometry(.16,length),paint);
   stripe.rotation.x=-Math.PI/2;
   stripe.rotation.z=-Math.atan2(dx,dz);
   stripe.position.set((a.x+b.x)*.5,-.020,(a.z+b.z)*.5);
   scene.add(stripe);
 }
 // Fixed distant scenery provides a sense of rotation without shaking the view.
 const trees=material(0x256a3d);
 for(let i=0;i<32;i++){
   const angle=i*Math.PI*2/32;
   const x=Math.cos(angle)*117,z=Math.sin(angle)*72;
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
   const silk=material(appearance.silk);
   const helmetMat=material(appearance.helmet);
   // Short, round body and a broad chest.
   outlinedBall(group,bodyMat,-.08,1.25,0,1.18,.65,.64);
   part(group,sphere,bodyMat,-.92,1.28,0,.57,.58,.59);
   part(group,sphere,bodyMat,.71,1.42,0,.56,.57,.59);
   // Big head is about 70 percent of the body length; this is intentionally cartoonish.
   part(group,sphere,bodyMat,1.00,1.82,0,.43,.59,.45);
   const headPivot=new THREE.Group();headPivot.position.set(1.08,2.00,0);group.add(headPivot);
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
     const tuft=part(group,sphere,mane,.63-i*.20,2.18-i*.075,0,.21,.20,.29);
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
   group.add(riderPivot);
   const breeches=material(0xf4f5f0),boots=material(0x262a30);
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
   const chest=part(riderPivot,sphere,silk,.19,.27,0,.32,.41,.29);
   chest.rotation.z=-.62;
   const uniformAccent=material(appearance.silkAccent);
   // Contrasting narrow stripe lets black/white/yellow jackets remain readable.
   for(const side of [-1,1]){
     const flash=part(riderPivot,sphere,uniformAccent,.24,.33,side*.27,.19,.075,.04);
     flash.rotation.z=-.62;
   }
   part(riderPivot,sphere,skin,.51,.73,0,.235,.25,.235);
   part(riderPivot,sphere,helmetMat,.52,.97,0,.32,.16,.31);
   part(riderPivot,sphere,steel,.53,.875,0,.29,.028,.288);
   part(riderPivot,sphere,helmetMat,.67,.865,-.05,.25,.055,.255);
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
   return {group,legs,headPivot,riderPivot,tailPivot,id,numberTexture,numberMat,silkMat:silk,helmetMat,accentMat:uniformAccent,appearanceCount:18};
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
   model.silkMat.color.set(colors.silk);
   model.helmetMat.color.set(colors.helmet);
   model.accentMat.color.set(colors.silkAccent);
   const oldTex=model.numberTexture;
   const nextTex=raceNumberTexture(model.id,colors);
   model.numberMat.map=nextTex;model.numberMat.needsUpdate=true;
   model.numberTexture=nextTex;oldTex.dispose();
   model.appearanceCount=count;
 }
 const neutral=Array.from({length:18},(_,i)=>({id:i+1,x:0,lane:i}));
 let disposed=false;
 let cameraReady=false,lastLeadS=0,lastCameraRace=null,lastCameraTime=null;
 let viewState=null;
 const cameraAim=new THREE.Vector3();
 function render(race,horses,time){
   if(disposed)return;
   const entrants=horses?.length?horses.length:18;
   const frame=race?.frames?.length ? interpolateRaceFrame(race.frames,time)
      : {t:time,horses:horses?.length?horses.map(h=>({id:h.id,x:0,lane:h.id-1})):neutral};
   const lead=Math.max(...frame.horses.map(h=>h.x));
   const raceDistance=race?.distance||2200;
   const leadS=lengthAtMetres(lead,raceDistance);
   const leaders=[...frame.horses].sort((a,b)=>b.x-a.x).slice(0,2);
   const displayed=raceDisplayPositions(race,frame,raceDistance);
   // Use wall-clock time for leg cadence so 8x replay does not become frantic.
   const motionTime=performance.now()*.001;
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
     // A single four-beat gallop pattern and cadence for all 18 horses.
     // Left/right footfalls remain staggered; no per-horse random phase.
     const cycle=gallopCycle(motionTime);
     const theta=cycle*Math.PI*2;
     // Brief suspension follows the fourth footfall; the horse lifts as one body.
     const airborne=cycle>.66&&cycle<.91
       ?Math.sin(Math.PI*(cycle-.66)/.25):0;
     const lift=Math.max(0,airborne);
     model.group.position.y=.020+lift*.093+Math.sin(theta-.50)*.013;
     model.group.rotation.z=-.014+Math.sin(theta+.42)*.049;
     model.group.rotation.x=Math.sin(theta*.50+model.id)*.008;
     for(const leg of model.legs){
       const pose=gallopLegPose(leg.front,leg.side,cycle);
       leg.hip.rotation.z=pose.hip;
       leg.knee.rotation.z=pose.knee;
     }
     model.headPivot.rotation.z=-.014+Math.sin(theta+.94)*.044;
     model.tailPivot.rotation.y=Math.sin(theta+.34)*.108;
     model.riderPivot.rotation.z=-.015-Math.sin(theta+.56)*.024;
     model.riderPivot.position.y=1.94-Math.max(0,Math.sin(theta+.85))*.016;
     model.shadow.position.x=model.group.position.x;
     model.shadow.position.z=model.group.position.z;
     const shadowSize=1-lift*.14;
     model.shadow.scale.set(1.42*shadowSize,.60*shadowSize,1);
   }
   // Start: diagonal front view, high enough to show all 18 horses side by side.
   // The camera gradually becomes a closer diagonal-front tracking shot.
   // Keep it forward of the horse's running direction throughout the half-lap.
   const focusS=Math.min(leadS,HALF_LAP_LENGTH);
   const visible=frame.horses.filter(h=>lead-h.x<70);
   const meanLane=visible.length
      ?visible.reduce((sum,h)=>sum+h.lane,0)/visible.length:(entrants-1)/2;
   const direction=coursePoint(focusS,0);
   const insideX=direction.dz,insideZ=-direction.dx;
   const startCenter=coursePoint(focusS,INSIDE_MARGIN+(entrants-1)*LANE_WIDTH*.5);
   const trackCenter=coursePoint(focusS,INSIDE_MARGIN+meanLane*LANE_WIDTH);
   const startCamera=new THREE.Vector3(
     startCenter.x+direction.dx*(23+entrants*1.12)+insideX*(9+entrants*.5),6.8+entrants*.25,
     startCenter.z+direction.dz*(23+entrants*1.12)+insideZ*(9+entrants*.5)
   );
   const followCamera=new THREE.Vector3(
     trackCenter.x+direction.dx*17+insideX*18,7.5,
     trackCenter.z+direction.dz*17+insideZ*18
   );
   const startAim=new THREE.Vector3(
     startCenter.x-direction.dx*1.8,1.80,
     startCenter.z-direction.dz*1.8
   );
   const followAim=new THREE.Vector3(
     trackCenter.x+direction.dx*2.8,1.75,
     trackCenter.z+direction.dz*2.8
   );
   // 0-7s: front diagonal, 7-21s: ease to the race tracking camera.
   const transition=Math.max(0,Math.min(1,(frame.t-7)/14));
   const ease=transition*transition*(3-2*transition);
   const wanted=startCamera.lerp(followCamera,ease);
   const wantedAim=startAim.lerp(followAim,ease);
   // Gentle smoothing prevents abrupt camera shifts during lane changes.
   // Smooth continuous tracking throughout the race. Snap only when loading
   // a new race or explicitly seeking the video (not during normal playback).
   const raceTime=Number(frame.t)||0;
   const delta=lastCameraTime===null?0:raceTime-lastCameraTime;
   const manuallySeeked=lastCameraTime!==null && (delta<-.25||delta>2.0);
   if(!cameraReady||race!==lastCameraRace||manuallySeeked){
     camera.position.copy(wanted);cameraAim.copy(wantedAim);cameraReady=true;
   }else{
     const follow=Math.min(.36,1-Math.exp(-Math.max(0,delta)*1.2));
     camera.position.lerp(wanted,follow);cameraAim.lerp(wantedAim,follow);
   }
   lastLeadS=focusS;lastCameraRace=race;lastCameraTime=raceTime;
   camera.lookAt(cameraAim);
   camera.updateMatrixWorld();
   // Share the ACTUAL 3D camera position and frustum with the upper overview.
   // Its dots therefore match the horses on this exact frame, not a separate
   // second approximation of race positions.
   const visibleIds=[];
   const center=new THREE.Vector3();
   for(const model of models){
     if(!model.group.visible)continue;
     center.set(model.group.position.x,1.40,model.group.position.z).project(camera);
     if(center.z>=-1&&center.z<=1&&Math.abs(center.x)<=1.03&&Math.abs(center.y)<=1.03){
       visibleIds.push(model.id);
     }
   }
   viewState={
     camera:{x:camera.position.x,z:camera.position.z},
     target:{x:cameraAim.x,z:cameraAim.z},
     visibleIds
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
   renderer.dispose();renderer.domElement.remove();
 }
 render(null,null,0);
 return {render,dispose,canvas:renderer.domElement,getViewState:()=>viewState};
}
