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
 camera.lookAt(-5,1,0);
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
 function horseModel(id){
   const group=new THREE.Group();scene.add(group);
   const bodyMat=material(coat[(id*3+Math.floor(id/4))%coat.length]);
   const dark=material(0x382a22), silk=material(jackets[(id-1)%18]);
   part(group,sphere,bodyMat,0,1.30,0,1.25,.53,.47);
   part(group,sphere,bodyMat,1.02,1.66,0,.38,.60,.36);
   part(group,sphere,bodyMat,1.39,1.91,0,.47,.33,.32);
   part(group,sphere,dark,1.70,1.78,0,.26,.19,.24);
   for(const z of [-.22,.22])part(group,sphere,dark,1.60,2.04,z,.06,.06,.05);
   const ears=part(group,sphere,bodyMat,1.35,2.24,-.16,.08,.25,.1);
   ears.rotation.z=-.18;
   const ear2=part(group,sphere,bodyMat,1.35,2.24,.16,.08,.25,.1);
   ear2.rotation.z=-.18;
   const tail=part(group,sphere,dark,-1.35,1.48,0,.48,.16,.16);
   tail.rotation.z=-.33;
   const legs=[];
   for(const x of [-.84,.82])for(const z of [-.29,.29]){
     const pivot=new THREE.Group();pivot.position.set(x,1.04,z);group.add(pivot);
     part(pivot,capsule,bodyMat,.01,-.39,0,.6,.83,.62);
     part(pivot,sphere,dark,.10,-.84,0,.24,.14,.20);
     legs.push(pivot);
   }
   // Rider, with contrasting jacket and helmet plus white saddle cloth.
   part(group,sphere,material(0xf8f7ed),-.25,1.84,0,.50,.12,.48);
   const rider=part(group,sphere,silk,-.16,2.35,0,.36,.54,.30);
   rider.rotation.z=-.38;
   part(group,sphere,material(0xf0c7a2),.03,2.86,0,.18,.24,.20);
   part(group,sphere,silk,.03,3.05,0,.26,.16,.25);
   const rightArm=part(group,capsule,silk,.33,2.40,-.31,.43,.56,.39);
   rightArm.rotation.z=.6;
   const leftArm=part(group,capsule,silk,.33,2.40,.31,.43,.56,.39);
   leftArm.rotation.z=.6;
   return {group,legs,id};
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
     model.group.position.set(-gap*.24,.025+Math.sin(frame.t*13+model.id)*.045,(item.lane-3)*2.4);
     model.group.visible=gap<180;
     for(let j=0;j<model.legs.length;j++)
       model.legs[j].rotation.z=Math.sin(frame.t*12+model.id*.7+j*Math.PI*.84)*.43;
   }
   camera.position.set(14+Math.sin(frame.t*.12)*.45,18,34);
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
   renderer.dispose();renderer.domElement.remove();
 }
 render(null,null,0);
 return {render,dispose};
}
