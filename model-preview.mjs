import * as THREE from 'three';
const $=id=>document.getElementById(id);
const host=$('model-stage'),status=$('model-status');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.2;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#99d9fd');
scene.fog=new THREE.Fog('#99d9fd',26,85);
scene.add(new THREE.HemisphereLight(0xffffff,0x528058,2.4));
const sun=new THREE.DirectionalLight(0xfff4e3,3.0);
sun.position.set(-5,10,8);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-7;sun.shadow.camera.right=7;
sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;
scene.add(sun);
const camera=new THREE.PerspectiveCamera(39,16/9,.1,130);
const mat=(c,r=.53,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const coat=mat('#583930'),coatLight=mat('#704b3b'),nose=mat('#926c59'),
white=mat('#fff7ec'),hair=mat('#30201d'),hairLight=mat('#57382e'),
eyeRim=mat('#201715'),eyeWhite=mat('#fffafa',.22),iris=mat('#89552c',.22),
pupil=mat('#120c0b',.1),blue=mat('#1370ea',.25),blueDark=mat('#092f83',.32),
helmet=mat('#194fd5',.20),silver=mat('#cfdbe0',.18,.62),
hoof=mat('#25252c'),skin=mat('#f1c09b'),suit=mat('#155cdf'),
grass=mat('#67bd58'),boot=mat('#151e2a');
const floor=new THREE.Mesh(new THREE.PlaneGeometry(170,170),grass);
floor.rotation.x=-Math.PI/2;floor.position.y=-.032;
floor.receiveShadow=true;scene.add(floor);
const rail=mat('#f2f6f0',.35);
for(const z of [-3.4,-6]){
 for(const y of [.68,.94]){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,110,10),rail);
  m.rotation.z=Math.PI/2;m.position.set(0,y,z);scene.add(m);
 }
 for(let x=-50;x<50;x+=3.8){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,1.12,10),rail);
  m.position.set(x,.56,z);scene.add(m);
 }
}
const backdrop=new THREE.Mesh(new THREE.SphereGeometry(15,30,12),mat('#4d9c60'));
backdrop.position.set(0,-9,-48);backdrop.scale.set(5,.7,.9);scene.add(backdrop);
const ball=new THREE.SphereGeometry(1,24,18);
function ell(parent,ma,x,y,z,sx,sy,sz,rot=0){
 const m=new THREE.Mesh(ball,ma);
 m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rot;
 m.castShadow=true;parent.add(m);return m;
}
function join(parent,a,b,ma,r){
 const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),v=bb.clone().sub(aa);
 const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.86,r,v.length(),10),ma);
 m.position.copy(aa).add(bb).multiplyScalar(.5);
 m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
 m.castShadow=true;parent.add(m);return m;
}
function tube(parent,pts,ma,r=.03){
 const curve=new THREE.CatmullRomCurve3(pts.map(x=>new THREE.Vector3(...x)));
 const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(12,pts.length*10),r,6),ma);
 parent.add(m);return m;
}
function hairSpike(parent,a,b,r,ma){
 const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);
 const m=new THREE.Mesh(new THREE.ConeGeometry(r,dir.length(),10),ma);
 m.position.copy(start).add(end).multiplyScalar(.5);
 m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
 m.castShadow=true;parent.add(m);
}
function loft(parent,outline,ma){
 const rows=[],widths=[],points=[];
 const N=5,rad=24,idx=[],vertices=[];
 for(let i=0;i<outline.length-1;i++){
  const a=outline[i],b=outline[i+1];
  for(let j=0;j<N;j++){
   const t=j/N,u=t*t*(3-2*t);
   rows.push(a.map((v,k)=>v+(b[k]-v)*u));
  }
 }
 rows.push(outline[outline.length-1]);
 for(const [x,cy,ry,rz] of rows){
  for(let k=0;k<rad;k++){
   const th=k*2*Math.PI/rad;
   vertices.push(x,cy+ry*Math.cos(th),rz*Math.sin(th));
  }
 }
 for(let i=0;i<rows.length-1;i++)for(let k=0;k<rad;k++){
  const a=i*rad+k,b=(i+1)*rad+k,c=i*rad+(k+1)%rad,d=(i+1)*rad+(k+1)%rad;
  idx.push(a,c,b,b,c,d);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setIndex(idx);geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,ma);mesh.castShadow=true;parent.add(mesh);return mesh;
}
const horse=new THREE.Group();horse.name='Design01_Horse';scene.add(horse);
loft(horse,[[-1.61,1.50,.04,.04],[-1.39,1.51,.48,.48],
 [-.98,1.52,.69,.64],[-.42,1.53,.75,.69],
 [.15,1.54,.72,.68],[.68,1.57,.66,.61],
 [1.12,1.64,.52,.42],[1.32,1.69,.05,.06]],coat);
ell(horse,coatLight,-1.12,1.50,0,.42,.56,.56);
ell(horse,coat,.76,1.50,0,.48,.56,.55);
const neck=new THREE.Group();neck.position.set(.72,1.62,0);
neck.name='NeckPivot';horse.add(neck);
loft(neck,[[-.31,-.08,.20,.25],[-.05,.10,.48,.47],
 [.25,.31,.56,.55],[.52,.55,.54,.47],
 [.86,.74,.36,.36],[1.06,.83,.04,.05]],coat);
const head=new THREE.Group();head.position.set(.79,.72,0);
head.name='HeadPivot';neck.add(head);
loft(head,[[-.52,.08,.06,.06],[-.35,.08,.49,.48],
 [-.12,.10,.70,.63],[.16,.07,.74,.68],
 [.38,.01,.64,.61],[.60,-.08,.51,.51],
 [.86,-.24,.39,.47],[1.13,-.30,.40,.45],
 [1.34,-.30,.07,.08]],coat);
ell(head,nose,1.11,-.35,0,.36,.35,.43);
for(const side of [-1,1]){
 ell(head,coatLight,.32,-.12,side*.34,.37,.33,.30);
 ell(head,eyeRim,.18,.25,side*.646,.28,.315,.18,-.13);
 ell(head,eyeWhite,.19,.25,side*.739,.249,.28,.124,-.12);
 ell(head,iris,.275,.23,side*.839,.17,.20,.064);
 ell(head,pupil,.31,.22,side*.879,.101,.131,.040);
 ell(head,white,.34,.33,side*.906,.061,.064,.015);
 ell(head,white,.22,.17,side*.902,.024,.031,.015);
 ell(head,eyeRim,1.29,-.25,side*.34,.073,.095,.043);
 hairSpike(head,[-.24,.72,side*.41],[-.34,1.14,side*.45],.17,coat);
 hairSpike(head,[-.22,.77,side*.50],[-.29,1.02,side*.51],.075,nose);
 tube(head,[[-.34,.52,side*.38],[.03,.60,side*.59],[.25,.46,side*.62]],blue,.05);
 tube(head,[[-.05,.47,side*.64],[.29,.12,side*.65],[.80,-.31,side*.47]],blue,.05);
 tube(head,[[.93,-.33,side*.45],[1.20,-.31,side*.42],[1.31,-.25,side*.30]],blue,.06);
 ell(head,silver,.94,-.34,side*.49,.086,.085,.044);
}
tube(head,[[1.08,-.535,-.28],[1.17,-.545,0],[1.08,-.535,.28]],eyeRim,.021);
// A white forehead mark and nose bridge, curved to follow the muzzle.
const blazeCoords=[[-.32,.58,0],[-.08,.77,0],[.14,.84,0],
 [.30,.75,0],[.48,.56,0],[.65,.34,0],[.83,.13,0],[1.0,.09,0]];
tube(head,blazeCoords,white,.085);
for(let i=0;i<7;i++){
 const z=(i%3-1)*.10;
 hairSpike(head,[-.41+i*.095,.80-i*.035,z],[-.21+i*.12,1.00-i*.065,z],
  .15,i%2?hairLight:hair);
}
for(let i=0;i<9;i++){
 const z=(i%3-1)*.115,t=i/8;
 hairSpike(neck,[-.22+t*.77,.83-t*.12,z],[-.45+t*.69,1.05-t*.06,z],
  .17,i%3?hair:hairLight);
}
const tail=new THREE.Group();tail.name='TailPivot';
tail.position.set(-1.54,1.73,0);horse.add(tail);
ell(tail,hair,-.17,.02,0,.32,.22,.23,.2);
for(let i=-3;i<=3;i++)
 hairSpike(tail,[-.26,0,i*.069],[-.99,-.22+Math.abs(i)*.04,i*.094],
  .16,i%3?hair:hairLight);
const legs=[];
for(const x of [-1.00,.71])for(const side of [-1,1]){
 const hip=new THREE.Group();hip.position.set(x,1.22,side*.45);
 hip.name=(x>0?'Fore':'Hind')+(side>0?'Near':'Far');horse.add(hip);
 ell(hip,coat,0,-.20,0,.29,.41,.272,x>0?-.12:.13);
 const knee=new THREE.Group();knee.position.set(.02,-.54,0);hip.add(knee);
 ell(knee,coat,.015,-.16,0,.23,.29,.218);
 if((x>0&&side>0)||(x<0&&side<0))
  ell(knee,white,.03,-.29,0,.22,.15,.21);
 ell(knee,hoof,.10,-.43,0,.26,.155,.25);
 ell(knee,silver,.28,-.43,0,.016,.075,.14);
 legs.push({hip,knee,front:x>0,side});
}
ell(horse,white,-.31,2.17,0,.63,.15,.57);
ell(horse,hoof,-.35,2.22,0,.49,.16,.48,-.11);
for(const side of [-1,1]){
 ell(horse,white,-.39,1.69,side*.62,.60,.38,.055);
 ell(horse,blue,-.39,1.69,side*.678,.55,.35,.054);
 tube(horse,[[-.15,2.16,side*.54],[-.20,1.53,side*.67],[-.21,1.17,side*.51]],hoof,.05);
 tube(horse,[[-.55,2.17,side*.54],[-.59,1.69,side*.75],[-.62,1.44,side*.79]],hoof,.032);
 join(horse,[-.79,1.4,side*.79],[-.42,1.4,side*.79],silver,.029);
 tube(horse,[[2.53,2.02,side*.38],[1.86,2.22,side*.55],
  [1.10,2.49,side*.45],[.36,2.55,side*.27]],blueDark,.028);
}
const rider=new THREE.Group();rider.name='JockeyPivot';
rider.position.set(-.38,2.15,0);horse.add(rider);
ell(rider,white,-.02,-.03,0,.31,.205,.35);
for(const side of [-1,1]){
 join(rider,[-.04,-.04,side*.28],[.24,-.38,side*.55],white,.16);
 ell(rider,white,.24,-.38,side*.55,.15,.14,.15);
 join(rider,[.24,-.38,side*.55],[-.21,-.66,side*.72],boot,.108);
 ell(rider,boot,-.20,-.65,side*.72,.21,.095,.13);
}
ell(rider,suit,.22,.37,0,.42,.44,.35,-.60);
for(const side of [-1,1]){
 ell(rider,suit,.31,.48,side*.29,.24,.16,.18,-.52);
 for(let k=0;k<4;k++)
  ell(rider,white,.18+k*.098,.58-k*.080,side*.442,.069,.071,.018,-.75);
}
ell(rider,skin,.58,.87,0,.28,.275,.27);
ell(rider,blueDark,.53,1.14,0,.445,.28,.42);
ell(rider,helmet,.53,1.18,0,.426,.26,.401);
ell(rider,helmet,.80,1.045,0,.31,.075,.305);
tube(rider,[[.14,1.18,0],[.29,1.40,0],[.53,1.45,0],
 [.78,1.38,0],[.90,1.20,0]],white,.049);
for(const side of [-1,1]){
 ell(rider,hoof,.77,.89,side*.15,.16,.095,.12);
 ell(rider,blueDark,.805,.89,side*.15,.14,.077,.104);
 ell(rider,white,.9,.915,side*.165,.023,.024,.016);
 const shoulder=[.29,.56,side*.22],elbow=[.53,.38,side*.34],hand=[.79,.27,side*.28];
 join(rider,shoulder,elbow,suit,.13);
 join(rider,elbow,hand,suit,.115);
 ell(rider,blue,hand[0],hand[1],hand[2],.115,.099,.105);
}
const numCanvas=document.createElement('canvas');numCanvas.width=128;numCanvas.height=128;
const ctx=numCanvas.getContext('2d');ctx.font='900 110px Arial';
ctx.textAlign='center';ctx.textBaseline='middle';
ctx.strokeStyle='#14429c';ctx.lineWidth=4;ctx.strokeText('4',64,67);
ctx.fillStyle='#fff';ctx.fillText('4',64,67);
const numTex=new THREE.CanvasTexture(numCanvas);numTex.colorSpace=THREE.SRGBColorSpace;
const numMat=new THREE.MeshBasicMaterial({map:numTex,transparent:true,side:THREE.DoubleSide});
for(const side of [-1,1]){
 const m=new THREE.Mesh(new THREE.PlaneGeometry(.65,.71),numMat);
 m.position.set(-.39,1.71,side*.756);if(side<0)m.rotation.y=Math.PI;horse.add(m);
}
horse.scale.set(.85,.85,.85);
const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.4,48),
 new THREE.MeshBasicMaterial({color:'#233f2b',transparent:true,opacity:.19,depthWrite:false}));
shadow.rotation.x=-Math.PI/2;shadow.scale.set(1.4,.74,1);
shadow.position.y=.008;scene.add(shadow);
let playing=true,time=0,last=0,yaw=.79,pitch=.18,dist=7.5;
const target=new THREE.Vector3(.18,1.56,0);
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
function updateCamera(){
 camera.position.set(target.x+dist*Math.cos(pitch)*Math.cos(yaw),
 target.y+dist*Math.sin(pitch),target.z+dist*Math.cos(pitch)*Math.sin(yaw));
 camera.lookAt(target);
}
function setCamera(preset){
 if(preset==='front'){yaw=.12;pitch=.10;dist=7}
 else if(preset==='side'){yaw=Math.PI/2;pitch=.13;dist=8.2}
 else {yaw=.78;pitch=.18;dist=7.5}
 updateCamera();document.querySelectorAll('[data-camera]').forEach(btn=>
  btn.setAttribute('aria-pressed',String(btn.dataset.camera===preset)));
}
document.querySelectorAll('[data-camera]').forEach(btn=>
 btn.addEventListener('click',()=>setCamera(btn.dataset.camera)));
$('motion').addEventListener('click',()=>{
 playing=!playing;$('motion').textContent=playing?'一時停止':'走らせる';
 $('motion').setAttribute('aria-pressed',String(playing));
});
$('reset').addEventListener('click',()=>{time=0;setCamera('three')});
let dragging=null;
const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{dragging=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{
 if(!dragging)return;
 yaw=clamp(yaw+(e.clientX-dragging[0])*.007,-2.9,2.9);
 pitch=clamp(pitch+(e.clientY-dragging[1])*.006,.03,.75);
 dragging=[e.clientX,e.clientY];updateCamera();
 document.querySelectorAll('[data-camera]').forEach(btn=>btn.setAttribute('aria-pressed','false'));
});
canvas.addEventListener('pointerup',()=>dragging=null);
canvas.addEventListener('pointercancel',()=>dragging=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();dist=clamp(dist+e.deltaY*.012,4.4,12);updateCamera()},{passive:false});
let pinch=null;
canvas.addEventListener('touchmove',e=>{
 if(e.touches.length!==2)return;
 e.preventDefault();const p=e.touches;
 const d=Math.hypot(p[0].clientX-p[1].clientX,p[0].clientY-p[1].clientY);
 if(pinch!==null){dist=clamp(dist+(pinch-d)*.012,4.4,12);updateCamera()}
 pinch=d;
},{passive:false});
canvas.addEventListener('touchend',()=>pinch=null);
function resize(){
 const rc=host.getBoundingClientRect(),w=Math.floor(rc.width),h=Math.floor(rc.height);
 if(w<64||h<64)return;
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);setCamera('three');resize();
function frame(t){
 requestAnimationFrame(frame);
 const dt=last?Math.min(.06,(t-last)/1000):0;last=t;if(playing)time+=dt;
 const ph=time*9.8;
 for(const leg of legs){
  const offset=leg.front?(leg.side>0?0:.30):(leg.side>0?Math.PI:Math.PI+.30);
  const k=ph+offset;
  leg.hip.rotation.z=.57*Math.sin(k);
  leg.knee.rotation.z=-.28-.40*Math.max(0,Math.sin(k+.68));
 }
 neck.rotation.z=.05*Math.sin(ph);
 head.rotation.z=.06*Math.sin(ph+.5);
 rider.position.y=2.15+.035*Math.sin(ph*2);
 rider.rotation.z=-.047+.027*Math.sin(ph+.7);
 tail.rotation.y=.12*Math.sin(ph*.60);
 tail.rotation.z=.08*Math.sin(ph*.77);
 horse.position.y=.055+.070*Math.abs(Math.sin(ph));
 horse.rotation.z=.012*Math.sin(ph*2);
 shadow.material.opacity=.21-.09*Math.abs(Math.sin(ph));
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
status.textContent='新しい1頭の3D試作を表示中。既存のレースは変更していません。';
$('export').addEventListener('click',async()=>{
 $('export').disabled=true;status.textContent='静止3Dモデルを書き出しています…';
 try{
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  const exporter=new GLTFExporter();
  const model=await exporter.parseAsync(horse,{binary:true,onlyVisible:true});
  const url=URL.createObjectURL(new Blob([model],{type:'model/gltf-binary'}));
  const a=document.createElement('a');a.href=url;a.download='RaceLab-design01-prototype.glb';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  status.textContent='GLBを書き出しました。現在の静止ポーズです（アニメーションは未収録）。';
 }catch(e){console.error(e);status.textContent='GLB書き出しに失敗しました。'}
 finally{$('export').disabled=false}
});
