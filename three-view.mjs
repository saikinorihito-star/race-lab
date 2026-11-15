// Optional low-poly 3D race display. Uses the same synthetic race data as 2D.
import {interpolateRaceFrame} from './visual.mjs';
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
 const coat=[0x805136,0x5e3c2c,0x9a6445,0x563c32,0x966949,0x724933];
 const jackets=[0xf2f4f7,0x34383f,0xea535d,0x4886d8,0xf0c653,0x51a86c,
  0xf39c4b,0xe589b4,0xaaaaaa,0x9b7945,0x8074be,0x35a7ac,
  0xb8546f,0xadd757,0x4b8194,0xd7a884,0x6766ab,0xc5cbd3];
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
 function raceNumberTexture(id,color){
   const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
   const context=canvas.getContext('2d');
   context.fillStyle='#f7f6ee';context.fillRect(0,0,96,96);
   context.fillStyle='#'+color.toString(16).padStart(6,'0');
   context.fillRect(0,0,96,13);context.fillRect(0,83,96,13);
   context.font='900 60px Arial';context.textAlign='center';
   context.textBaseline='middle';context.fillStyle='#152235';
   context.fillText(String(id),48,50);
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
 function horseModel(id){
   const group=new THREE.Group();scene.add(group);
   const coatColor=coat[(id*3+Math.floor(id/4))%coat.length];
   const bodyMat=material(coatColor);
   const muzzleMat=material(new THREE.Color(coatColor).multiplyScalar(1.14));
   const mane=maneMats[(id-1)%maneMats.length];
   const silk=material(jackets[(id-1)%18]);
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
   // Flat saddlecloth, showing the horse number on both sides without external image files.
   part(group,sphere,saddleMat,-.23,1.77,0,.55,.15,.56);
   const numberTexture=raceNumberTexture(id,jackets[(id-1)%18]);
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
   part(riderPivot,sphere,skin,.29,.91,0,.29,.30,.285);
   part(riderPivot,sphere,silk,.27,1.14,0,.39,.19,.36);
   part(riderPivot,sphere,hoofMat,.35,1.025,-.08,.34,.080,.31);
   for(const side of [-1,1]){
     const arm=part(riderPivot,sphere,silk,.52,.30,side*.27,.19,.38,.18);
     arm.rotation.z=.75;
     part(riderPivot,sphere,skin,.73,.10,side*.24,.13,.13,.12);
     part(riderPivot,sphere,hoofMat,-.20,-.28,side*.35,.20,.27,.13);
   }
   return {group,legs,headPivot,riderPivot,tailPivot,id,numberTexture};
 }
 const models=Array.from({length:18},(_,i)=>horseModel(i+1));
 // Reference-style black horse nameplates are billboard sprites, drawn in the 3D video as well.
 function makeNameLabel(text){
   const image=document.createElement('canvas');image.width=512;image.height=104;
   const ctx=image.getContext('2d');
   const safe=String(text||'競走馬').slice(0,12);
   ctx.fillStyle='rgba(10,18,18,.91)';
   ctx.beginPath();ctx.roundRect(14,10,484,84,16);ctx.fill();
   ctx.lineWidth=4;ctx.strokeStyle='#f7f5e8';ctx.stroke();
   ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font='bold 51px -apple-system, Hiragino Sans, sans-serif';
   ctx.fillText(safe,256,55,451);
   const tex=new THREE.CanvasTexture(image);
   tex.colorSpace=THREE.SRGBColorSpace;
   const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
   sprite.position.set(.05,4.03,0);
   sprite.scale.set(3.8,.77,1);
   sprite.visible=false;
   return {sprite,tex};
 }
 for(const model of models){
   const nameLabel=makeNameLabel('');
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
   for(const model of models){
     const item=frame.horses.find(h=>h.id===model.id);
     if(!item)continue;
     const gap=Math.max(0,lead-item.x);
     // Include the rear pack; maintain a stable camera following the leaders.
     model.group.position.set(-gap*.32,.03+Math.sin(frame.t*22+model.id)*.038,(item.lane-3)*1.25);
     model.group.visible=gap<180;
     const shouldLabel=!!race && leaders.some(v=>v.id===model.id);
     model.nameLabel.sprite.visible=shouldLabel;
     if(shouldLabel){
       const name=horses?.find(v=>v.id===model.id)?.name || 'サンプル'+model.id;
       if(name!==model.lastName){
         model.group.remove(model.nameLabel.sprite);
         model.nameLabel.sprite.material.dispose();
         model.nameLabel.tex.dispose();
         model.nameLabel=makeNameLabel(name);
         model.group.add(model.nameLabel.sprite);
         model.lastName=name;
       }
     }
     const gait=frame.t*11.4+model.id*.52;
     for(let j=0;j<model.legs.length;j++){
       const leg=model.legs[j];
       const phase=gait+(leg.front?0:Math.PI)+(leg.side?Math.PI:0);
       leg.hip.rotation.z=Math.sin(phase)*.42;
       leg.knee.rotation.z=Math.max(0,Math.cos(phase))*.40-.10;
     }
     model.headPivot.rotation.z=Math.sin(gait*2)*.025;
     model.tailPivot.rotation.y=Math.sin(gait*.56)*.22;
     model.riderPivot.rotation.z=-.035+Math.sin(gait*2+.3)*.035;
   }
   camera.position.set(8.0+Math.sin(frame.t*.12)*.22,4.3,11.5);
   camera.lookAt(-1.4,1.65,0);
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
