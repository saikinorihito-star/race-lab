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
 scene.background=new THREE.Color(0x9ccde6);
 scene.fog=new THREE.Fog(0x9ccde6,80,175);
 const camera=new THREE.PerspectiveCamera(46,1000/560,0.1,210);
 camera.position.set(14,18,34);
 camera.lookAt(-4,1.25,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x416e50,2.15));
 const sun=new THREE.DirectionalLight(0xffffff,2.2);
 sun.position.set(-18,35,10);scene.add(sun);
 const material=(color)=>new THREE.MeshLambertMaterial({color});
 const grass=material(0x41895d), turf=material(0x70b477);
 const base=new THREE.Mesh(new THREE.PlaneGeometry(330,120),grass);
 base.rotation.x=-Math.PI/2;base.position.y=-0.09;scene.add(base);
 const track=new THREE.Mesh(new THREE.PlaneGeometry(330,37),turf);
 track.rotation.x=-Math.PI/2;track.position.y=-0.05;scene.add(track);
 // White lane guides and distance markers support depth perception.
 for(let lane=-3;lane<=3;lane++){
   const line=new THREE.Mesh(new THREE.BoxGeometry(330,.025,.035),material(0xdcece2));
   line.position.set(0,0.025,lane*2.4);scene.add(line);
 }
 for(let x=-140;x<=140;x+=15){
   for(const z of [-17,17]){
     const post=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.9,6),material(0xf2eee6));
     post.position.set(x,.43,z);scene.add(post);
   }
 }
 // A simple distant grandstand: no heavyweight models or textures.
 const building=new THREE.Mesh(new THREE.BoxGeometry(125,14,16),material(0xe9edf1));
 building.position.set(-10,6,-54);scene.add(building);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(131,2.2,21),material(0x233c56));
 roof.position.set(-10,14,-54);scene.add(roof);
 const windows=new THREE.Mesh(new THREE.BoxGeometry(124,5.4,.25),material(0x39596b));
 windows.position.set(-10,8.5,-45.86);scene.add(windows);
 const sphere=new THREE.SphereGeometry(1,10,8);
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
 function horseModel(id){
   const group=new THREE.Group();scene.add(group);
   const coatColor=coat[(id*3+Math.floor(id/4))%coat.length];
   const bodyMat=material(coatColor);
   const muzzleMat=material(new THREE.Color(coatColor).multiplyScalar(1.14));
   const mane=maneMats[(id-1)%maneMats.length];
   const silk=material(jackets[(id-1)%18]);
   // Short, round body and a broad chest.
   part(group,sphere,bodyMat,-.08,1.25,0,1.18,.65,.64);
   part(group,sphere,bodyMat,-.92,1.28,0,.57,.58,.59);
   part(group,sphere,bodyMat,.71,1.42,0,.56,.57,.59);
   // Big head is about 70 percent of the body length; this is intentionally cartoonish.
   part(group,sphere,bodyMat,1.00,1.82,0,.43,.59,.45);
   const headPivot=new THREE.Group();headPivot.position.set(1.13,2.00,0);group.add(headPivot);
   part(headPivot,sphere,bodyMat,.19,.01,0,.72,.59,.57);
   part(headPivot,sphere,muzzleMat,.65,-.25,0,.55,.36,.47);
   part(headPivot,sphere,material(0x6b4939),1.09,-.26,0,.12,.23,.33);
   // Big eyes on each side with pupils facing outwards toward the camera.
   for(const side of [-1,1]){
     part(headPivot,sphere,eyeWhite,.33,.17,side*.50,.21,.25,.125);
     part(headPivot,sphere,pupil,.40,.16,side*.605,.125,.17,.063);
     part(headPivot,sphere,glint,.44,.23,side*.665,.047,.060,.027);
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
 const neutral=Array.from({length:18},(_,i)=>({id:i+1,x:0,lane:i%6}));
 let disposed=false;
 function render(race,horses,time){
   if(disposed)return;
   const frame=race?.frames?.length ? interpolateRaceFrame(race.frames,time) : {t:time,horses:neutral};
   const lead=Math.max(...frame.horses.map(h=>h.x));
   for(const model of models){
     const item=frame.horses.find(h=>h.id===model.id);
     if(!item)continue;
     const gap=Math.max(0,lead-item.x);
     // Include the rear pack; maintain a stable camera following the leaders.
     model.group.position.set(-gap*.24,.03+Math.sin(frame.t*22+model.id)*.038,(item.lane-3)*2.4);
     model.group.visible=gap<180;
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
   camera.position.set(12+Math.sin(frame.t*.12)*.32,13.5,29.5);
   camera.lookAt(-5,1,0);
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
   for(const m of models)m.numberTexture.dispose();
   renderer.dispose();renderer.domElement.remove();
 }
 render(null,null,0);
 return {render,dispose,canvas:renderer.domElement};
}
