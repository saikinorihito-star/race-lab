// Tokyo west turf vision: 2022 manufacturer specifications.
// Coordinate convention: meters, +Y up, +Z faces grandstand.
// All non-display dimensions are visual estimates, not surveyed measurements.
export const VISION_SPECS=Object.freeze({
 'tokyo-west':Object.freeze({venue:'東京',label:'西側',width:66.4,height:11.2,pixelsX:5312,pixelsY:896,year:2022}),
 'tokyo-east':Object.freeze({venue:'東京',label:'東側',width:26.4,height:11.2,pixelsX:2112,pixelsY:896,year:2022}),
});
export const VISION_SOURCE='https://www.mitsubishielectric.co.jp/ja/pr/2022/pdf/1006.pdf';
export function visionDimensions(key='tokyo-west'){
 const spec=VISION_SPECS[key];if(!spec)throw Error('未対応のターフビジョン');
 const side=.52,bottom=1.14,top=.43,depth=2.45;
 return {...spec,outerWidth:spec.width+2*side,outerHeight:bottom+spec.height+top,
  depth,screenBottom:bottom,screenY:bottom+spec.height/2,screenZ:depth/2+.022,
  rearY:(bottom+spec.height+top+.38)/2,rearH:bottom+spec.height+top-.38};
}
const PALETTE=Object.freeze({
 concrete:{color:0x9c9d97,roughness:.92},base:{color:0x626969,roughness:.87},
 frame:{color:0x67757a,metalness:.48,roughness:.51},edge:{color:0x9da9ad,metalness:.5,roughness:.42},
 dark:{color:0x252e33,metalness:.30,roughness:.73},seam:{color:0x4c595f,roughness:.75},
 vent:{color:0x222d32,roughness:.9},steel:{color:0x89969a,metalness:.58,roughness:.52},
 rubber:{color:0x151d20,roughness:.96},door:{color:0x59676d,metalness:.38,roughness:.62}
});
// Low-slung enclosed housing, no fictitious tall exposed support columns.
export function visionParts(key='tokyo-west'){
 const d=visionDimensions(key),w=d.outerWidth,h=d.outerHeight,z=d.depth/2,parts=[];
 const add=(id,mat,x,y,zz,sx,sy,sz)=>parts.push({id,mat,center:[x,y,zz],size:[sx,sy,sz]});
 add('foundation','concrete',0,.17,0,w+.72,.34,d.depth+.72);
 add('low-plinth','base',0,.55,0,w,.42,d.depth+.12);
 add('enclosed-cabinet','dark',0,(h+.76)/2,0,w-.15,h-.76,d.depth-.18);
 add('bottom-fascia','frame',0,.95,z-.08,w,.38,.19);
 add('top-fascia','frame',0,h-.215,z-.08,w,.43,.19);
 for(const s of [-1,1]){
  add('side-fascia-'+s,'frame',s*(d.width/2+.26),d.screenY,z-.08,.52,d.height,.19);
  add('side-shell-'+s,'frame',s*(w/2-.08),(h+.76)/2,0,.16,h-.76,d.depth);
  add('front-edge-'+s,'edge',s*(w/2-.055),d.screenY,z+.009,.065,d.height+.69,.035);
  add('screen-gasket-'+s,'rubber',s*(d.width/2+.045),d.screenY,z+.012,.09,d.height,.035);
  // Narrow side maintenance hatch and ventilation, not exposed on the mural.
  add('service-door-'+s,'door',s*(w/2+.013),1.85,-.25,.045,2.10,.85);
  add('door-handle-'+s,'steel',s*(w/2+.045),1.75,-.54,.06,.16,.045);
  for(let i=0;i<14;i++)add('side-vent-'+s+'-'+i,'vent',s*(w/2+.006),3.1+i*.11,-.25,.024,.036,.92);
 }
 for(const sy of [d.screenBottom-.035,d.screenBottom+d.height+.035])
  add('horizontal-gasket-'+sy,'rubber',0,sy,z+.012,d.width,.07,.035);
 add('roof','frame',0,h-.04,0,w+.08,.08,d.depth+.09);
 add('roof-front-drip','edge',0,h-.085,z+.02,w+.08,.07,.06);
 add('roof-rear-drip','edge',0,h-.085,-z-.02,w+.08,.07,.06);
 // Fine cabinet seams are on the housing, not black bars over the LED.
 const cols=Math.ceil(w/3.2);
 for(let i=1;i<cols;i++){
  const x=-w/2+i*w/cols;
  add('top-joint-'+i,'seam',x,h-.215,z+.018,.018,.41,.012);
  add('bottom-joint-'+i,'seam',x,.95,z+.018,.018,.34,.012);
  add('roof-joint-'+i,'seam',x,h+.002,0,.023,.008,d.depth);
 }
 add('rear-panel-frame','frame',0,d.rearY,-z-.008,w,d.rearH,.055);
 add('rear-bottom-trim','edge',0,.41,-z-.058,w,.075,.065);
 add('rear-top-trim','edge',0,h-.035,-z-.058,w,.075,.065);
 return parts;
}
export function createTurfVision(THREE,{key='tokyo-west',screenTexture=null,rearTexture=null}={}){
 const d=visionDimensions(key),root=new THREE.Group();root.name=key+'-vision';
 const geom=new THREE.BoxGeometry(1,1,1),owned=[geom],mats=[];
 const parts=visionParts(key),dummy=new THREE.Object3D();
 for(const [name,params] of Object.entries(PALETTE)){
  const list=parts.filter(p=>p.mat===name);if(!list.length)continue;
  const mat=new THREE.MeshStandardMaterial(params);mats.push(mat);
  const mesh=new THREE.InstancedMesh(geom,mat,list.length);mesh.name='housing-'+name;
  list.forEach((p,i)=>{dummy.position.set(...p.center);dummy.scale.set(...p.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
 }
 const screenGeo=new THREE.PlaneGeometry(d.width,d.height);owned.push(screenGeo);
 const screenMat=new THREE.MeshBasicMaterial({color:screenTexture?0xffffff:0x11171c,map:screenTexture,side:THREE.FrontSide,toneMapped:false});mats.push(screenMat);
 const screen=new THREE.Mesh(screenGeo,screenMat);screen.name='active-led-screen';screen.position.set(0,d.screenY,d.screenZ);root.add(screen);
 // Rear art is separate; production can use a verified/licensed texture.
 const rearGeo=new THREE.PlaneGeometry(d.outerWidth-.12,d.rearH-.12);owned.push(rearGeo);
 const rearMat=new THREE.MeshStandardMaterial({color:rearTexture?0xffffff:0x687c84,map:rearTexture,roughness:.96,side:THREE.FrontSide});mats.push(rearMat);
 const rear=new THREE.Mesh(rearGeo,rearMat);rear.name='rear-artwork';rear.position.set(0,d.rearY,-d.depth/2-.065);rear.rotation.y=Math.PI;root.add(rear);
 function setScreenTexture(texture){screenMat.map=texture;screenMat.color.setHex(texture?0xffffff:0x11171c);screenMat.needsUpdate=true}
 function setRearTexture(texture){rearMat.map=texture;rearMat.color.setHex(texture?0xffffff:0x687c84);rearMat.needsUpdate=true}
 function dispose(){owned.forEach(g=>g.dispose());mats.forEach(m=>m.dispose())}
 return {root,screen,rear,dimensions:d,parts,setScreenTexture,setRearTexture,dispose};
}
