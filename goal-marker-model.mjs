// Tokyo turf finish marker, visual reconstruction. All dimensions are estimates in metres.
// +Y up, +Z grandstand-facing, local X=0 is the finish plane.
export const GOAL_SPECS=Object.freeze({
 'tokyo-turf':Object.freeze({venue:'東京',surface:'芝',width:2.85,bodyHeight:4.8,totalHeight:6.3,depth:.29,face:0x17264f,status:'写真からの推定',
 sources:['https://jra-fun.jp/event/tokyo/202305/img/202305tokyo.pdf','https://jra-fun.jp/event/tokyo/202605/','https://www.tokyokeibajo.com/2025/20250201.html']})
});
export function createGoalMarker(THREE,{key='tokyo-turf',scale=1,decor=0x17264f}={}){
 const spec=GOAL_SPECS[key];if(!spec)throw Error('未対応のゴール板');
 if(!Number.isFinite(scale)||scale<=0)throw Error('invalid scale');
 const root=new THREE.Group();root.name=key+'-goal-marker';root.scale.setScalar(scale);
 const mat=(color,metalness=0,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const ivory=mat(0xf3f2e8,.08,.55),green=mat(0x226248,.38,.48),dark=mat(0x202b2c,.35,.56),silver=mat(0xaebabc,.65,.28),face=mat(decor,.03,.76);
 const geometries=new Set(),materials=new Set([ivory,green,dark,silver,face]),textures=new Set();
 function mesh(geo,m,x=0,y=0,z=0){geometries.add(geo);materials.add(m);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);root.add(o);return o}
 function box(w,h,d,m,x,y,z){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z)}
 function contour(inset=0){
  const s=new THREE.Shape();
  // Continuous horseshoe with tapered feet and an open lower centre.
  s.moveTo(-.46-inset,.94);s.bezierCurveTo(-.76-inset,.86,-.89-inset,.96,-.94-inset,1.27);
  s.lineTo(-1.37-inset,3.30);s.bezierCurveTo(-1.68-inset,4.68,-.78,5.03,0,5.03);
  s.bezierCurveTo(.78,5.03,1.68+inset,4.68,1.37+inset,3.30);
  s.lineTo(.94+inset,1.27);s.bezierCurveTo(.89+inset,.96,.76+inset,.86,.46+inset,.94);
  s.bezierCurveTo(.24+inset,.99,.29+inset,1.23,.34+inset,1.48);
  s.lineTo(.76+inset,3.38);s.bezierCurveTo(.91+inset,4.08,.50,4.45,0,4.45);
  s.bezierCurveTo(-.50,4.45,-.91-inset,4.08,-.76-inset,3.38);
  s.lineTo(-.34-inset,1.48);s.bezierCurveTo(-.29-inset,1.23,-.24-inset,.99,-.46-inset,.94);
  s.closePath();return s;
 }
 // White shell, navy faces on both sides; shrink each face into its shell.
 const shell=mesh(new THREE.ExtrudeGeometry(contour(0),{depth:spec.depth,bevelEnabled:true,bevelSize:.045,bevelThickness:.035,bevelSegments:3,curveSegments:36}),ivory,0,0,-spec.depth/2);
 for(const side of [-1,1]){
  const panel=mesh(new THREE.ShapeGeometry(contour(-.065),36),face,0,0,side*(spec.depth/2+.05));panel.scale.y=.981;panel.position.y=.055;panel.material.side=THREE.DoubleSide;
 }
 // Separate bases, green central mirror column and narrow reflective insert.
 for(const x of [-.67,.67]){box(.78,.94,.72,ivory,x,.47,0);box(.84,.075,.78,silver,x,.0375,0)}
 box(.32,.37,.49,dark,0,.185,0);box(.24,3.13,.25,green,0,1.93,0);
 box(.12,2.83,.025,silver,0,2.05,.14);
 box(.12,2.83,.025,dark,0,2.05,-.14);
 for(const side of [-1,1]){box(.065,2.96,.08,green,side*.12,2.0,.09);box(.12,.12,.38,dark,side*.13,.48,0)}
 // Upper oval plate, white edge and blue inset.
 function oval(w,h,depth,m,z){const o=mesh(new THREE.CylinderGeometry(1,1,depth,80),m,0,4.83,z);o.rotation.x=Math.PI/2;o.scale.set(w/2,1,h/2);return o}
 oval(1.87,1.20,.34,ivory,0);oval(1.76,1.10,.035,face,.19);oval(1.76,1.10,.035,face,-.19);
 function texture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;textures.add(t);return t}
 function decal(w,h,t,x,y,z,side,angle=0){const o=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.FrontSide}),x,y,z);o.rotation.y=side===-1?Math.PI:0;o.rotateZ(angle);return o}
 const lettering=texture(512,128,(c,w,h)=>{c.fillStyle='#f4f5ef';c.font='900 102px Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('TOKYO',w/2,h/2,w*.97)});
 const logo=texture(512,320,(c,w,h)=>{c.strokeStyle='#f3f3eb';c.lineWidth=12;c.lineCap='round';c.lineJoin='round';c.beginPath();c.arc(256,77,46,.35,Math.PI*1.91);c.stroke();c.beginPath();c.moveTo(226,106);c.lineTo(249,75);c.lineTo(282,86);c.lineTo(260,48);c.lineTo(236,60);c.stroke();c.fillStyle='#f3f3eb';c.textAlign='center';c.font='bold 76px Georgia,serif';c.fillText('JRA',256,195);c.font='bold 49px sans-serif';c.fillText('東 京',256,260)});
 for(const side of [-1,1]){
  decal(1.62,1.01,logo,0,4.83,side*.218,side);
  for(const leg of [-1,1])decal(2.05,.46,lettering,leg*1.00,2.72,side*(spec.depth/2+.064),side,side*leg*-1.77);
 }
 // Two galvanized uprights and three rows of twin floodlights.
 for(const x of [-.13,.13])box(.072,2.38,.09,silver,x,5.07,-.12);
 for(const y of [5.49,5.85,6.21]){
  box(.62,.06,.1,silver,0,y,-.12);
  for(const x of [-.19,.19]){
   box(.28,.18,.18,dark,x,y,.01);
   box(.23,.13,.025,ivory,x,y,.112);
  }
 }
 root.userData={spec,finishPlaneX:0,estimated:true};
 function dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 return {root,spec,dispose};
}
