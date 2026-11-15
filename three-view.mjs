// Optional low-poly 3D race display. Uses the same synthetic race data as 2D.
import {interpolateRaceFrame} from './visual.mjs';
import {getHorseAppearance} from './appearance.mjs';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js';
// Four-beat transverse gallop: trailing hind -> leading hind -> trailing fore -> leading fore.
// The right/left lead determines which side touches down first. Each leg gets its
// own contact time, support phase and lifted recovery instead of a mirrored sine wave.
function gallopLegPose(front, nearSide, rightLead, cycle) {
 const isLeading=nearSide===rightLead;
 const contact=front?(isLeading?.50:.35):(isLeading?.14:0);
 const t=((cycle-contact)%1+1)%1;
 // Keyframes: ground contact, support, push-off, knee tuck, forward reach, landing.
 const keys=[
  [0,.43,.025],
  [.12,-.04,-.045],
  [.24,-.40,.015],
  [.43,-.22,.34],
  [.68,.24,.34],
  [.87,.41,.09],
  [1,.43,.025]
 ];
 for(let i=0;i<keys.length-1;i++){
  const a=keys[i],b=keys[i+1];
  if(t<=b[0]){
   const u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
   const smooth=u*u*(3-2*u);
   const hip=a[1]+(b[1]-a[1])*smooth;
   const knee=a[2]+(b[2]-a[2])*smooth;
   return {hip:hip*(front?1:.89),knee:knee*(front?1:-.75)};
  }
 }
 return {hip:.43,knee:.025};
}

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
 const grass=material(0x45a965), turf=material(0x7bc77e);
 const base=new THREE.Mesh(new THREE.PlaneGeometry(330,120),grass);
 base.rotation.x=-Math.PI/2;base.position.y=-0.09;scene.add(base);
 const track=new THREE.Mesh(new THREE.PlaneGeometry(330,37),turf);
 track.rotation.x=-Math.PI/2;track.position.y=-0.05;scene.add(track);
 // The reference shows turf and sandy dirt side-by-side, not one vast empty field.
 const dirt=new THREE.Mesh(new THREE.PlaneGeometry(330,21),material(0xd8b879));
 dirt.rotation.x=-Math.PI/2;dirt.position.set(0,-0.037,12);scene.add(dirt);
 const turfBorder=new THREE.Mesh(new THREE.BoxGeometry(330,.035,.075),material(0xf4f6ef));
 turfBorder.position.set(0,.018,1.48);scene.add(turfBorder);
 // Gentle low-contrast ground movement conveys speed without shaking the camera.
 const speedMarks=[];
 const markGeometry=new THREE.PlaneGeometry(1.2,.075);
 const markMaterial=new THREE.MeshBasicMaterial({color:0xd4eabc,transparent:true,opacity:.24,depthWrite:false});
 for(const z of [-7.6,6.7]){
   for(let i=0;i<16;i++){
     const mark=new THREE.Mesh(markGeometry,markMaterial);
     mark.rotation.x=-Math.PI/2;
     mark.position.set(-45+i*6,.018,z);
     scene.add(mark);
     speedMarks.push({mark,base:-45+i*6,z});
   }
 }
 // Thin white racecourse fences on the near and far edges.
 const railMat=material(0xfaf9f3);
 for(const z of [-17,9]){
   for(const h of [.46,.90]){
     const rail=new THREE.Mesh(new THREE.BoxGeometry(280,.082,.085),railMat);
     rail.position.set(0,h,z);scene.add(rail);
   }
   for(let x=-130;x<=130;x+=5){
     const post=new THREE.Mesh(new THREE.BoxGeometry(.075,1.05,.075),railMat);
     post.position.set(x,.52,z);scene.add(post);
   }
 }
 // Push the grandstand into the background so it cannot overpower the horses.
 const building=new THREE.Mesh(new THREE.BoxGeometry(105,7,12),material(0xe9edf1));
 building.position.set(-10,4,-58);scene.add(building);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(110,1.5,16),material(0x233c56));
 roof.position.set(-10,8,-58);scene.add(roof);
 const windows=new THREE.Mesh(new THREE.BoxGeometry(104,2.5,.25),material(0x39596b));
 windows.position.set(-10,5.6,-51.9);scene.add(windows);
 const foliage=material(0x3a8858),trunkMat=material(0x6a523d);
 for(let i=0;i<30;i++){
   const x=-115+i*8.5;
   const tree=new THREE.Mesh(new THREE.SphereGeometry(1,7,5),foliage);
   tree.position.set(x,2.0+(i%3)*.15,-33-(i%4)*1.1);
   tree.scale.set(1.8,2.1,1.5);scene.add(tree);
 }
 const sphere=new THREE.SphereGeometry(1,18,12);
 const capsule=new THREE.CylinderGeometry(.23,.26,1,8);
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
     tackCurve(group,[[2.02,1.66,side*.41],[1.48,1.86,side*.55],[.95,2.06,side*.49],[.46,2.21,side*.30]],leather,.030);
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
   // Oversized jockey helmet and face, compact colorful torso and bent arms.
   const riderPivot=new THREE.Group();riderPivot.position.set(-.30,2.00,0);group.add(riderPivot);
   const chest=part(riderPivot,sphere,silk,.15,.30,0,.39,.46,.34);
   chest.rotation.z=-.30;
   const uniformAccent=material(appearance.silkAccent);
   // A slim racing-silk band and shoulder flashes, not a solid frame-colored jacket.
   part(riderPivot,sphere,uniformAccent,.20,.43,-.308,.24,.105,.035);
   part(riderPivot,sphere,uniformAccent,.20,.43,.308,.24,.105,.035);
   part(riderPivot,sphere,skin,.29,.91,0,.29,.30,.285);
   part(riderPivot,sphere,helmetMat,.27,1.14,0,.40,.20,.37);
   // Contrasting cap edging makes the white and black frames readable.
   part(riderPivot,sphere,steel,.27,1.045,0,.38,.042,.358);
   part(riderPivot,sphere,helmetMat,.35,1.035,-.10,.37,.065,.30);
   part(riderPivot,sphere,hoofMat,.35,.98,-.23,.31,.068,.085);
   for(const side of [-1,1]){
     const arm=part(riderPivot,sphere,silk,.52,.30,side*.27,.19,.38,.18);
     arm.rotation.z=.75;
     part(riderPivot,sphere,skin,.73,.10,side*.24,.13,.13,.12);
     part(riderPivot,sphere,hoofMat,-.20,-.28,side*.35,.20,.27,.13);
   }
   return {group,legs,headPivot,riderPivot,tailPivot,id,numberTexture};
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
 function makeNameLabel(text,id){
   const image=document.createElement('canvas');image.width=512;image.height=104;
   const ctx=image.getContext('2d');
   const safe=String(text||'競走馬').slice(0,12);
   ctx.fillStyle='rgba(10,18,18,.91)';
   ctx.beginPath();ctx.roundRect(14,10,484,84,16);ctx.fill();
   ctx.lineWidth=4;ctx.strokeStyle='#f7f5e8';ctx.stroke();
   // A small colored frame badge is readable even when helmet details are distant.
   const appearance=getHorseAppearance(id);
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
   model.lastName='';
 }
 const neutral=Array.from({length:18},(_,i)=>({id:i+1,x:0,lane:i%6}));
 let disposed=false;
 function render(race,horses,time){
   if(disposed)return;
   const frame=race?.frames?.length ? interpolateRaceFrame(race.frames,time) : {t:time,horses:neutral};
   const lead=Math.max(...frame.horses.map(h=>h.x));
   const leaders=[...frame.horses].sort((a,b)=>b.x-a.x).slice(0,2);
   // Use wall-clock time for leg cadence so 8x replay does not become frantic.
   const motionTime=performance.now()*.001;
   for(const model of models){
     const item=frame.horses.find(h=>h.id===model.id);
     if(!item)continue;
     const gap=Math.max(0,lead-item.x);
     // Include the rear pack; maintain a stable camera following the leaders.
     // Distance/placing follow simulated race data; gallop motion is purely visual.
     model.group.position.set(-gap*.32,.018,(item.lane-3)*1.25);
     model.group.visible=gap<180;
     model.shadow.visible=model.group.visible;
     const shouldLabel=!!race && leaders.some(v=>v.id===model.id);
     model.nameLabel.sprite.visible=shouldLabel;
     if(shouldLabel){
       const name=horses?.find(v=>v.id===model.id)?.name || 'サンプル'+model.id;
       if(name!==model.lastName){
         model.group.remove(model.nameLabel.sprite);
         model.nameLabel.sprite.material.dispose();
         model.nameLabel.tex.dispose();
         model.nameLabel=makeNameLabel(name,model.id);
         model.group.add(model.nameLabel.sprite);
         model.lastName=name;
       }
     }
     // Racing gallop at about 2.4-2.7 strides per wall-clock second, even at 8x replay.
     // Keep camera stable; unequal left/right touchdown timing provides realism.
     const pace=Math.max(.95,Math.min(1.08,(item.speed || 16.5)/16.5));
     const cycle=(motionTime*2.48*pace+model.id*.071)%1;
     const theta=cycle*Math.PI*2;
     const rightLead=model.id%2===0;
     // Brief suspension follows the fourth footfall; the horse lifts as one body.
     const airborne=cycle>.66&&cycle<.91
       ?Math.sin(Math.PI*(cycle-.66)/.25):0;
     const lift=Math.max(0,airborne);
     model.group.position.y=.020+lift*.093+Math.sin(theta-.50)*.013;
     model.group.rotation.z=-.014+Math.sin(theta+.42)*.049;
     model.group.rotation.x=Math.sin(theta*.50+model.id)*.008;
     for(const leg of model.legs){
       const pose=gallopLegPose(leg.front,leg.side,rightLead,cycle);
       leg.hip.rotation.z=pose.hip;
       leg.knee.rotation.z=pose.knee;
     }
     model.headPivot.rotation.z=-.014+Math.sin(theta+.94)*.044;
     model.tailPivot.rotation.y=Math.sin(theta+.34)*.108;
     model.riderPivot.rotation.z=-.055-Math.sin(theta+.56)*.046;
     model.riderPivot.position.y=2.00-Math.max(0,Math.sin(theta+.85))*.044;
     model.shadow.position.x=model.group.position.x;
     model.shadow.position.z=model.group.position.z;
     const shadowSize=1-lift*.14;
     model.shadow.scale.set(1.42*shadowSize,.60*shadowSize,1);
   }
   // Stabilize the viewpoint; the track marks and horses convey speed.
   camera.position.set(8,4.25,11.5);
   camera.lookAt(-1.4,1.72,0);
   const scroll=motionTime*7.5;
   for(const {mark,base,z} of speedMarks){
     const pos=((base-scroll+48)%96+96)%96-48;
     mark.position.set(pos,.018,z);
   }
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
 return {render,dispose,canvas:renderer.domElement};
}
