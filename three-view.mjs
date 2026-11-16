// Design 01 sculpted race display. Uses the same synthetic race data as 2D.
import {interpolateRaceFrame} from './visual.mjs';
import {getHorseAppearance} from './appearance.mjs';
import {gallopCycle,gallopLegPose,gallopDynamics} from './gait.mjs';
import {makeDesign01Builder} from './design01-race.mjs';
import {loadDesign01GLB,updateDesign01GLBAppearance} from './design01-loader.mjs';
import {coursePoint,lengthAtMetres,TRACK_OUTER_OFFSET,INSIDE_MARGIN,LANE_WIDTH,raceDisplayPositions,getTurfProfile,furlongMarkerPositions,courseHeightMetres,courseSlope,raceCoursePoint,startPocket,raceCourseHeightMetres,raceCourseSlope} from './course.mjs';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js';
export async function createThreeView(host){
 const THREE = await import(THREE_URL);
 const renderer = new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.setSize(1000,560,false);
 renderer.setClearColor(0x93cbea);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.15;
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
 // Sculpted character models are kept separate from camera, track geometry
 // and racing physics. Geometry/jersey textures are generated on the device.
 const horseBuilder=makeDesign01Builder(THREE,scene,getHorseAppearance);
 const models=Array.from({length:18},(_,i)=>horseBuilder.build(i+1));
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
   if(model.nativeDesign01){
     updateDesign01GLBAppearance(THREE,model,getHorseAppearance(model.id,count),count);
   }else horseBuilder.updateAppearance(model,count);
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
   const focusHorse=Number(options.focusHorse)||0;
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
     // Pin one requested horse's name to its actual moving 3D model.
     // Avoid constantly switching the labelled horse with every lead change.
     const shouldLabel=!!race && (focusHorse>0?
       model.id===focusHorse:leaders.some(v=>v.id===model.id));
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
     if(model.nativeDesign01 && model.assetMixer){
       // GLB contains 13 native animation tracks: four hip/knee pairs,
       // neck, head, tail, rider and the vertical body movement.
       model.assetMixer.update(deltaTime*Math.max(.55,dynamics.hz/1.25));
     }else{
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
     model.neckPivot.position.x=(model.neckRestX??.71)+Math.cos(theta+.40)*.082;
     model.neckPivot.position.y=(model.neckRestY??1.39)-Math.sin(theta+.90)*.073;
     model.headPivot.rotation.z=-.035+Math.sin(theta+1.55)*.105;
     model.tailPivot.rotation.y=Math.sin(theta+.34)*.135;
     model.riderPivot.rotation.z=-.018-Math.sin(theta+.56)*.030;
     model.riderPivot.position.y=(model.riderRestY??1.94)-Math.max(0,Math.sin(theta+.85))*.026;
     }
     model.shadow.position.x=model.group.position.x;
     model.shadow.position.z=model.group.position.z;
     model.shadow.position.y=trackHeight+.023;
     const shadowSize=1-lift*.20;
     model.shadow.scale.set(1.42*shadowSize*horseScale,.60*shadowSize*horseScale,1);
   }
   // Broadcast-style tracking camera: normally frame a readable 2/3 of the
   // pack, and scan smoothly from leaders to rear runners at the first bend.
   // The dedicated 'fit entire video' mode really includes every runner.
   // Distance is fitted to 3D positions and the actual screen aspect ratio.
   const smooth01=v=>{
     const t=Math.max(0,Math.min(1,Number(v)||0));
     return t*t*(3-2*t);
   };
   const runners=[...frame.horses].sort((a,b)=>b.x-a.x);
   // In the normal shot keep horses big enough to identify their position.
   // Follow mode centers a smaller subgroup; the full-view toggle overrides
   // both and fits the entire field, including the last horse.
   const followedIndex=focusHorse>0?runners.findIndex(h=>h.id===focusHorse):-1;
   const fit=!!options.fitEntireVideo;
   const coverageCount=fit?entrants:followedIndex>=0?
     Math.min(entrants,Math.max(2,Math.ceil(entrants*.48))):
     Math.max(2,Math.min(entrants,Math.ceil(entrants*.68)));
   const firstIncluded=followedIndex>=0?
     Math.max(0,Math.min(entrants-coverageCount,
       followedIndex-Math.floor((coverageCount-1)/2))):0;
   const runnerPoint=h=>{
     const m=models.find(model=>model.id===h.id);
     const p=m?.group.position;
     return p?new THREE.Vector3(p.x,p.y+1.55,p.z):null;
   };
   const fullPoints=runners.slice(firstIncluded,firstIncluded+coverageCount)
      .map(runnerPoint).filter(Boolean);
   const midpoint=points=>{
     let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,
       minZ=Infinity,maxZ=-Infinity;
     for(const p of points){
       minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
       minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
       minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
     }
     return new THREE.Vector3((minX+maxX)*.5,
       (minY+maxY)*.5,(minZ+maxZ)*.5);
   };
   // Hold the first-bend camera insert for 48 simulated seconds (12 seconds
   // at 4x). Panning from the leaders to the rear takes about 5 seconds at
   // 4x, so horse identities remain easy to follow. Never interrupt an
   // explicitly selected horse or the full-field view with a cinematic cut.
   const firstBend=followedIndex>=0||fit?null:
     firstTurnCueTime(race,raceDistance,course,venue,layout);
   const shotU=firstBend===null?-1:(frame.t-(firstBend-1.5))/48;
   const inTurnShot=shotU>0&&shotU<1;
   const insertLevel=inTurnShot
     ?smooth01(shotU/.12)*(1-smooth01((shotU-.84)/.16)):0;
   const rearSweep=inTurnShot?smooth01((shotU-.30)/.44):0;
   // A medium shot, not the old close-up of only four horses.
   const closeCount=Math.min(entrants,Math.max(3,Math.ceil(entrants*.53)));
   const frontGroup=runners.slice(0,closeCount);
   const backGroup=runners.slice(-closeCount);
   const frontIndex=Math.max(0,Math.min(closeCount-1,Math.floor(closeCount*.48)));
   const rearIndex=Math.max(0,Math.min(closeCount-1,Math.floor(closeCount*.48)));
   const frontTarget=frontGroup[frontIndex]?.x??runners[0].x;
   const backTarget=backGroup[rearIndex]?.x??runners[runners.length-1].x;
   const focusX=frontTarget*(1-rearSweep)+backTarget*rearSweep;
   const focusS=lengthAtMetres(focusX,raceDistance);
   const frontPoints=frontGroup.map(runnerPoint).filter(Boolean);
   const backPoints=backGroup.map(runnerPoint).filter(Boolean);
   const fullAim=midpoint(fullPoints);
   // Leave visible track ahead of the front runner. Offset the viewing
   // target in the direction of travel instead of centering the horses.
   const anchorRunner=followedIndex>=0?runners[followedIndex]:runners[0];
   const leaderS=lengthAtMetres(anchorRunner.x,raceDistance);
   const leadDirection=raceCoursePoint(leaderS,0,raceDistance,course,venue,layout);
   const aheadRoom=fit?5.6:4.7; // Leave track visible ahead without shrinking the runners
   fullAim.x+=leadDirection.dx*aheadRoom;
   fullAim.z+=leadDirection.dz*aheadRoom;
   const frontAim=midpoint(frontPoints.length?frontPoints:fullPoints);
   const backAim=midpoint(backPoints.length?backPoints:fullPoints);
   const isPortrait=camera.aspect<.90;
   // Keep a practical field of view with a lower, trackside perspective.
   const fov=(isPortrait?54:43)+(fit?6:0);
   if(Math.abs(camera.fov-fov)>.05){
     camera.fov=fov;
     camera.updateProjectionMatrix();
   }
   const poseFor=(aim,points,progress,close=false)=>{
     const s=lengthAtMetres(progress,raceDistance);
     const dir=raceCoursePoint(s,0,raceDistance,course,venue,layout);
     const sign=venue==='kyoto'?-1:1;
     const sideX=sign*dir.dz,sideZ=-sign*dir.dx;
     // Low three-quarter-front angle: the horse bodies, jockey silks and turf
     // are readable together. Moderate forward offset reveals their faces,
     // while the reduced elevation avoids the previous aerial impression.
     let ox=sideX+dir.dx*(close?.43:.36);
     let oy=close?.21:.26;
     let oz=sideZ+dir.dz*(close?.43:.36);
     const norm=Math.hypot(ox,oy,oz)||1;
     ox/=norm;oy/=norm;oz/=norm;
     // Orthonormal camera axes. Positive camera-out vector points from
     // aim towards camera, so depth is distance - dot(delta,cameraOut).
     const rightNorm=Math.hypot(oz,ox)||1;
     const rx=oz/rightNorm,rz=-ox/rightNorm;
     const upx=-oy*ox/rightNorm;
     const upy=(ox*ox+oz*oz)/rightNorm;
     const upz=-oy*oz/rightNorm;
     const tanY=Math.tan(camera.fov*Math.PI/360);
     const tanX=tanY*Math.max(.38,camera.aspect);
     let distance=close?14.5:17;
     const padding=close?2.4:3.0;
     for(const p of points){
       const x=p.x-aim.x,y=p.y-aim.y,z=p.z-aim.z;
       const forwardOffset=x*ox+y*oy+z*oz;
       const horizontal=Math.abs(x*rx+z*rz)+padding;
       const vertical=Math.abs(x*upx+y*upy+z*upz)+padding*.82;
       const needed=forwardOffset+Math.max(horizontal/(tanX*.86),vertical/(tanY*.82));
       distance=Math.max(distance,needed);
     }
     if(fit)distance*=1.17;
     return {
       pos:new THREE.Vector3(aim.x+ox*distance,aim.y+oy*distance,aim.z+oz*distance),
       aim
     };
   };
   // Normal coverage is ~68% of runners, with a slower first-bend pan to the
   // rear before returning to this medium-wide shot. Full view shows 100%.
   const included=runners.slice(firstIncluded,firstIncluded+coverageCount);
   const fullMidX=(included[0].x+included[included.length-1].x)*.5;
   const wide=poseFor(fullAim,fullPoints,fullMidX,false);
   const closeFront=poseFor(frontAim,frontPoints.length?frontPoints:fullPoints,frontTarget,true);
   const closeRear=poseFor(backAim,backPoints.length?backPoints:fullPoints,backTarget,true);
   // Move the close-up continuously from leaders to the rear group, with
   // no instant jump between two different camera positions.
   const closePos=closeFront.pos.lerp(closeRear.pos,rearSweep);
   const closeAim=closeFront.aim.clone().lerp(closeRear.aim,rearSweep);
   const wanted=wide.pos.lerp(closePos,insertLevel);
   const wantedAim=wide.aim.clone().lerp(closeAim,insertLevel);
   // Gentle smoothing prevents abrupt camera shifts during lane changes.
   // Smooth continuous tracking throughout the race. Snap only when loading
   // a new race or explicitly seeking the video (not during normal playback).
   const raceTime=Number(frame.t)||0;
   const delta=lastCameraTime===null?0:raceTime-lastCameraTime;
   const manuallySeeked=lastCameraTime!==null && (delta<-.25||delta>2.0);
   if(!cameraReady||race!==lastCameraRace||venue+':'+layout+':'+course!==lastCameraCourse||manuallySeeked){
     camera.position.copy(wanted);cameraAim.copy(wantedAim);cameraReady=true;
   }else{
     // Track at the default 4x replay rate without letting the camera lag
     // behind and lose horses at the front or back of the pack.
     // Smooth lens and target transitions without slowing the actual
     // running horses. Keep sufficient response for default 4x playback.
     const follow=Math.min(.44,1-Math.exp(-Math.max(0,delta)*2.8));
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
     turnShot:insertLevel>.05,
     scanProgress:rearSweep,
     frameMode:followedIndex>=0?'注目馬を追跡':
       insertLevel>.05?(rearSweep<.5?'先頭寄り':'後方寄り'):(fit?'全頭表示':'馬群・前方'),
     focusHorse:followedIndex>=0?focusHorse:0,
     coverageCount,
     aheadRoom
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
     m.silkTexture?.dispose();
     m.nameLabel.sprite.material.dispose();
     m.nameLabel.tex.dispose();
   }
   if(trackGroup){scene.remove(trackGroup);trackGroup.traverse(node=>{node.geometry?.dispose();if(node.material){if(Array.isArray(node.material))node.material.forEach(m=>{m.map?.dispose();m.dispose();});else {node.material.map?.dispose();node.material.dispose();}}})}
   renderer.dispose();renderer.domElement.remove();
 }
 render(null,null,0);
 loadDesign01GLB(THREE,models,getHorseAppearance).then(()=>{
   if(!disposed)renderer.render(scene,camera);
 }).catch(error=>{
   console.error('Design01 GLB load error; fallback kept',error);
   const elem=document.getElementById('design-glb-status');
   if(elem){elem.textContent='GLB読込失敗：簡易3Dで表示中';elem.style.color='#ffc6a3';}
 });
 return {render,resize,dispose,canvas:renderer.domElement,getViewState:()=>viewState};
}
