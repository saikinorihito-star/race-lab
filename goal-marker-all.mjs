import {createGoalMarker as createTokyo,GOAL_SPECS as TOKYO} from './goal-marker-model.mjs?v=2';
// All non-Tokyo presets are preliminary visual reconstructions, not surveyed dimensions.
// Coordinate convention: Y up, +Z grandstand; X=0 finish plane.
const collection='https://www.tokyokeibajo.com/p/goal-jra.html';
const definitions=[
 ['sapporo','札幌','SAPPORO','iron','bell',0x214c43,0xb69a55,'洋風門・装飾鉄工','時計台風の枠',3.1,5.0],
 ['hakodate','函館','HAKODATE','sun','sun',0x479dcc,0xf06c4e,'放射状アーチと梯子状フレーム','放射状アーチ（仮）',2.8,5.2],
 ['fukushima','福島','FUKUSHIMA','horse','horse',0x858d87,0xdd572e,'三春駒と金属支柱','三春駒・色違い（仮）',2.4,5.0],
 ['niigata','新潟','NIIGATA','ibis','ibis',0x206c48,0xeb8540,'トキと白い円柱','トキ・色違い（仮）',2.6,5.1],
 ['tokyo','東京','TOKYO','tokyo','oval',0x17264f,0x4e9db9,'既存の馬蹄形','水色のアーチ（仮）',2.85,5.43],
 ['nakayama','中山','NAKAYAMA','portal','rider',0x235c94,0xc44546,'矩形フレーム（通常仕様仮）','騎馬シルエットの枠（仮）',2.7,5.0],
 ['chukyo','中京','CHUKYO','cup','cup',0x235c91,0x64a8d7,'曲線の脚と上部プレート','曲線の脚・色違い（仮）',2.7,5.0],
 ['kyoto','京都','KYOTO','loop','loop',0x174f43,0x77a76a,'2023年改装後の二重アーチ','緑色のアーチ（仮）',2.8,5.1],
 ['hanshin','阪神','HANSHIN','h','h',0xc8373d,0x2874ad,'赤いH型','青いH型',2.1,4.9],
 ['kokura','小倉','KOKURA','spire','rider',0x27774f,0xc35f63,'三角形の塔と曲線脚','騎馬シルエット（仮）',2.5,5.1]
];
export const GOAL_VENUES=Object.freeze(definitions.map(([id,venue])=>Object.freeze({id,venue})));
export const GOAL_SPECS=Object.freeze(Object.fromEntries(definitions.flatMap(([id,venue,english,shape,dirtShape,color,accent,description,dirtDescription,width,bodyHeight])=>['turf','dirt'].map(surface=>{
 const dirt=surface==='dirt',key=id+'-'+surface;
 return [key,Object.freeze({key,id,venue,english,surface:dirt?'ダート':'芝',shape:dirt?dirtShape:shape,color:dirt?(id==='hanshin'?accent: id==='tokyo'?0x4e9db9:color):color,accent,description:dirt?dirtDescription:description,width:dirt?width*.88:width,bodyHeight:dirt?bodyHeight*.9:bodyHeight,totalHeight:(dirt?bodyHeight*.9:bodyHeight)+1.15,status:id==='tokyo'&&!dirt?'既存モデル・推定寸法':'暫定モデル・外観／寸法要確認',official:'https://www.jra.go.jp/facilities/race/'+id+'/course/',reference:collection})];
}))));
export function createGoalMarker(THREE,{key='tokyo-turf',scale=1}={}){
 const s=GOAL_SPECS[key];if(!s)throw Error('Unknown goal preset: '+key);
 if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid scale');
 if(key==='tokyo-turf'){const model=createTokyo(THREE,{key,scale});return {...model,spec:s}}
 const root=new THREE.Group();root.name=key+'-goal-marker';root.scale.setScalar(scale);
 const geos=new Set(),mats=new Set(),texs=new Set();
 const mat=(color,metalness=0,roughness=.65)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness});mats.add(m);return m};
 const white=mat(0xf1f1e8,.12),dark=mat(0x253033,.25),metal=mat(0x9aa7a7,.6),green=mat(0x25634e,.3),mirror=mat(0xc6d8df,.8,.16),main=mat(s.color,.18),accent=mat(s.accent,.1),gold=mat(0xc5a25f,.3),black=mat(0x222626,.2);
 function mesh(g,m,x=0,y=0,z=0){geos.add(g);mats.add(m);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);root.add(o);return o}
 function box(w,h,d,m,x,y,z=0){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z)}
 function tube(points,r,m,z=0){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,z))),Math.max(16,points.length*12),r,10,false),m)}
 function rod(a,b,r,m,z=0){const v=new THREE.Vector3(b[0]-a[0],b[1]-a[1],0);const o=mesh(new THREE.CylinderGeometry(r,r,v.length(),12),m,(a[0]+b[0])/2,(a[1]+b[1])/2,z);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o}
 function poly(points,m,depth=.16,z=0){const p=new THREE.Shape();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();return mesh(new THREE.ExtrudeGeometry(p,{depth,bevelEnabled:false}),m,0,0,z-depth/2)}
 function oval(w,h,m,x,y,z=0){const o=mesh(new THREE.CylinderGeometry(1,1,.15,48),m,x,y,z);o.rotation.x=Math.PI/2;o.scale.set(w/2,1,h/2);return o}
 function text(word,w,h,x,y,z,color='#f3f4ee',vertical=false){
  const c=document.createElement('canvas');c.width=1024;c.height=vertical?1024:256;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
  if(vertical){const step=c.height/(word.length+.35);ctx.font='bold '+Math.floor(step*.91)+'px Arial';[...word].forEach((ch,i)=>ctx.fillText(ch,c.width/2,step*(i+.67)))}
  else{ctx.font='bold 170px Arial';ctx.fillText(word,c.width/2,c.height/2,c.width*.91)}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;texs.add(t);
  for(const side of [-1,1]){const m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});const o=mesh(new THREE.PlaneGeometry(w,h),m,x,y,z*side);o.rotation.y=side===-1?Math.PI:0;}
 }
 const W=s.width/2,H=s.bodyHeight,D=.25,leg=.18;
 const foot=(x)=>{box(.55,.42,.63,white,x,.21);box(.61,.05,.69,metal,x,.025)};
 const posts=(m=main)=>{for(const x of [-W*.7,W*.7]){foot(x);box(leg,H-.75,D,m,x,(H-.75)/2+.42)}};
 function arch(m,r=.14,z=0,scale=1){const w=W*.76*scale,top=H-.2;let p=[[-w,.42],[-w,top-w]];for(let i=0;i<=20;i++){const a=Math.PI-i*Math.PI/20;p.push([w*Math.cos(a),top-w+w*Math.sin(a)])}p.push([w,.42]);tube(p,r,m,z)}
 function horse(x,y,m,kind='horse'){// stylized local wooden horse / rider silhouette
  const P=[[x-.52,y+.1],[x-.52,y+.63],[x-.70,y+.86],[x-.64,y+1.16],[x-.38,y+1.27],[x-.28,y+1.04],[x+.34,y+.92],[x+.53,y+1.12],[x+.62,y+.96],[x+.43,y+.58],[x+.45,y+.08],[x+.22,y+.08],[x+.13,y+.52],[x-.22,y+.52],[x-.3,y+.1]];
  poly(P,m,.13);if(kind==='horse'){for(let i=0;i<4;i++)box(.31,.06,.02,gold,x+.04,y+.6+i*.085,.08)}else{oval(.22,.22,m,x-.04,y+1.43);rod([x-.04,y+1.34],[x-.2,y+.94],.08,m)}
 }
 // central mirror assembly, fixed on finish plane
 box(.42,.44,.63,white,0,.22);box(.22,3.05,.23,green,0,1.92);box(.115,2.78,.025,mirror,0,2.04,.135);box(.12,2.78,.025,dark,0,2.04,-.135);
 switch(s.shape){
 case 'iron':{
  posts();const y=H-.75;poly([[-W,y-.35],[-W*.94,y+.35],[-W*.45,y+.51],[0,y+.56],[W*.45,y+.51],[W*.94,y+.35],[W,y-.35]],main,.24);text(s.english,W*1.85,.50,0,y,.14,'#d7b76b');
  for(let i=0;i<7;i++){const x=(i-3)*W*.26,yy=y+.55+Math.cos((i-3)/3*Math.PI/2)*.32;const pts=[];for(let j=0;j<=26;j++){let a=j/26*Math.PI*2,r=.19*j/26;pts.push([x+r*Math.cos(a),yy+r*Math.sin(a)])}tube(pts,.026,main);}
  for(const x of [-W*.7,W*.7])for(let i=0;i<13;i++)for(let j=0;j<3;j++){let a=i*2.4+j*2.1;const o=mesh(new THREE.SphereGeometry(.075,7,5),i%3?accent:mat(0xb92e39),x+Math.cos(a)*.15,.67+i*.18,Math.sin(a)*.16);o.scale.y=.78}break;}
 case 'bell':{posts(metal);arch(metal,.065);box(W*1.4,.10,.16,accent,0,H-1.1);oval(.65,.65,accent,0,H-1.6);oval(.49,.49,dark,0,H-1.6,.10);text(s.english,W*1.5,.35,0,H-.48,.14);break;}
 case 'sun':{
  const x=W*.78,y=H-x-.4;for(const a of [-x,x]){foot(a);box(.11,y-.42,.15,main,a,(y+.42)/2);for(let j=0;j<9;j++)box(x*.79,.065,.085,main,a*.58,.65+j*(y-.65)/9)}
  for(const r of [x,x*.88]){const p=[];for(let i=0;i<=28;i++){const a=i*Math.PI/28;p.push([r*Math.cos(a),y+r*Math.sin(a)])}tube(p,.065,accent);}
  for(let i=0;i<=10;i++){const a=i*Math.PI/10;rod([0,y],[x*Math.cos(a),y+x*Math.sin(a)],.034,accent)}
  text(s.english,W*1.75,.38,0,H-.16,.14,'#e67658');break;}
 case 'horse':{
  const x=W*.65,y=H-1.2;for(const a of [-x,x]){foot(a);rod([a,.42],[a,y-.5],.095,metal);rod([a,y-.5],[a*.53,y],.095,metal)}
  rod([-x*.53,y],[x*.53,y],.095,metal);horse(0,y-.03,s.surface==='芝'?black:white);
  text(s.english,W*1.6,.25,0,y-.20,.15,'#263d37');break;}
 case 'ibis':{
  const x=W*.72,y=H-1.13;for(const a of [-x,x]){foot(a);rod([a,.42],[a,y],.13,white);for(const yy of [.52,y-.08])box(.40,.16,.38,white,a,yy)}
  poly([[-x,y-.35],[-x,y],[0,y+.51],[x,y],[x,y-.35],[.42,y-.35],[0,y-.11],[-.42,y-.35]],main,.22);
  poly([[-.72,y+.53],[-.29,y+.55],[-.10,y+.85],[.03,y+.62],[.35,y+1.05],[.89,y+.84],[.67,y+.52],[.95,y+.45],[.35,y+.22],[.11,y+.36],[-.29,y+.29]],white,.14,.13);
  poly([[.08,y+.57],[.36,y+.93],[.80,y+.77],[.55,y+.55],[.85,y+.45],[.3,y+.35]],accent,.03,.22);rod([-.66,y+.55],[-.97,y+.65],.026,dark,.15);break;}
 case 'portal':{
  posts();box(W*1.56,1.02,.31,main,0,H-.52);text(s.english,W*1.5,.36,0,H-.49,.18);for(const x of [-W*.7,W*.7])box(.28,H-.9,.08,white,x,(H-.9)/2+.42,.14);break;}
 case 'rider':{
  posts();const y=H-1.35;rod([-W*.7,y],[0,y+.62],.105,main);rod([0,y+.62],[W*.7,y],.105,main);rod([-W*.7,y],[W*.7,y],.105,main);horse(0,y-.24,accent,'rider');break;}
 case 'cup':{
  for(const sign of [-1,1]){foot(sign*W*.74);tube([[sign*W*.76,.47],[sign*W*.41,H*.31],[sign*W*.33,H*.57],[sign*W*.68,H-.65]],.115,metal);
   poly([[sign*W*.82,.58],[sign*W*.59,.55],[sign*W*.26,H*.49],[sign*W*.33,H-.75],[sign*W*.85,H-.25],[sign*W*.97,H-.30],[sign*W*.65,H-1.22],[sign*W*.46,H*.43]],main,.19)}
  poly([[-W*.92,H-.25],[-W*.47,H-.52],[0,H-.62],[W*.47,H-.52],[W*.92,H-.25],[W*.68,H-1.24],[-W*.68,H-1.24]],main,.23);text(s.english,W*1.25,.34,0,H-.89,.14);break;}
 case 'loop':{for(const x of [-W*.73,W*.73])foot(x);arch(main,.20);arch(white,.115,.22,.85);arch(main,.08,.26,.70);text(s.english,.18,2.0,W*.66,2.40,.36,'#315e4d',true);break;}
 case 'h':{const x=W*.59;for(const a of [-x,x]){foot(a);box(.23,H-.42,.27,main,a,(H+.42)/2);box(.12,H-.55,.035,white,a,(H+.42)/2,.153);box(.12,H-.55,.035,white,a,(H+.42)/2,-.153);box(.53,.20,.28,main,a*1.27,.83)}box(x*2,.22,.25,main,0,H*.73);text(s.english,.22,2.65,-x,2.3,.19,s.surface==='芝'?'#c8373d':'#2874ad',true);break;}
 case 'spire':{for(const sign of [-1,1]){foot(sign*W*.55);tube([[sign*W*.52,.48],[sign*W*.17,H*.43],[sign*W*.55,H*.60]],.145,main);rod([sign*W*.3,H*.4],[sign*W*.7,H*.49],.08,main)}
  poly([[-W*.9,H*.58],[0,H],[W*.9,H*.58]],main,.23);poly([[-W*.55,H*.67],[0,H*.94],[W*.55,H*.67]],accent,.025,.135);text(s.english,W*1.47,.35,0,H*.63,.15);break;}
 default:{for(const x of [-W*.75,W*.75])foot(x);arch(main,.23);arch(white,.065,.25);oval(W*1.2,.63,main,0,H-.3,.06);text(s.english,W*1.05,.29,0,H-.3,.19);break;}
 }
 // Light bracket. Provisional where not verified by photos.
 const mastY=H+.5;box(.10,1.25,.12,metal,0,mastY-.12,-.23);
 for(let i=0;i<3;i++){let y=H+.2+i*.32;box(.62,.055,.1,metal,0,y,-.19);for(const x of [-.19,.19]){box(.26,.17,.18,dark,x,y,-.03);box(.20,.12,.02,white,x,y,.073)}}
 root.userData={spec:s,finishPlaneX:0,estimated:true};
 return {root,spec:s,dispose(){geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());texs.forEach(t=>t.dispose())}};
}
