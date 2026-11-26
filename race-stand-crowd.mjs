// Lightweight race-day grandstand decoration. Procedural original textures;
// no photos of real spectators, external assets, or changes to race physics.
const CLOTHES=[0x293946,0x38434c,0x465a63,0x5a6265,0x818987,0xb4b5aa,0xc7c6bc,0x526f83,0x7c8a97,0x685b55,0x8e7564,0x7a4851,0x51644d,0x968660];
const SKIN=[0xe2c6a5,0xc9aa89,0xac8c75,0x967660,0x795a46];
const HAIR=[0x282723,0x403b36,0x675d52,0x98948a];
const hex=n=>'#'+n.toString(16).padStart(6,'0');
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
export function planCrowdPanel(seed,{columns=64,rows=5,occupancy=.78}={}){
 const random=rng(seed),people=[],aisles=[];
 for(let c=0;c<columns;c++)if(c%17===8||c%17===9)aisles.push(c);
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  if(aisles.includes(col)||random()>occupancy)continue;
  people.push({row,col,jitter:(random()-.5)*.43,height:.85+random()*.27,
   body:CLOTHES[Math.floor(random()*CLOTHES.length)],skin:SKIN[Math.floor(random()*SKIN.length)],
   hair:HAIR[Math.floor(random()*HAIR.length)],hat:random()<.13,
   turn:random()<.5?-1:1,shade:random()});
 }
 return {columns,rows,aisles,people};
}
function crowdCanvas(THREE,seed,occupancy){
 const W=1024,H=128,c=document.createElement('canvas');c.width=W;c.height=H;
 const ctx=c.getContext('2d'),plan=planCrowdPanel(seed,{occupancy});
 if(!ctx)throw Error('観客テクスチャの初期化失敗');
 const dx=W/plan.columns,dy=H/plan.rows;
 ctx.fillStyle='#33434a';ctx.fillRect(0,0,W,H);
 // Dark recesses, shallow stepped seats and aisle gaps; kept inside facade.
 for(let r=0;r<plan.rows;r++){
  ctx.fillStyle=r%2?'#465257':'#3e4b50';
  ctx.fillRect(0,r*dy,W,dy-2);
  ctx.fillStyle='#242f34';ctx.fillRect(0,(r+1)*dy-3,W,2);
  for(let col=0;col<plan.columns;col++){
   if(plan.aisles.includes(col))continue;
   ctx.fillStyle=col%4===0?'#72817d':'#5d706c';
   ctx.fillRect(col*dx+1,r*dy+dy*.54,dx-2,dy*.38);
  }
 }
 ctx.fillStyle='#63716e';
 for(const col of plan.aisles)ctx.fillRect(col*dx,0,dx,H);
 const oval=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()};
 for(const p of plan.people){
  const x=(p.col+.5+p.jitter)*dx,y=(p.row+.61)*dy,scale=p.height;
  // Subtle clothing silhouette, shoulders, neck, head and hair. No cartoon
  // outlines: from broadcast distance the irregular silhouettes read as people.
  oval(x+1,y+dy*.19,dx*.36,dy*.34,'#283238');
  oval(x,y+dy*.13,dx*.36*scale,dy*.32*scale,hex(p.body));
  ctx.fillStyle=hex(p.body);ctx.fillRect(x-dx*.22*scale,y,dx*.44*scale,dy*.32);
  oval(x+p.turn*.5,y-dy*.19*scale,dx*.16*scale,dy*.18*scale,hex(p.skin));
  oval(x-.4,y-dy*.24*scale,dx*.17*scale,dy*.105*scale,hex(p.hair));
  if(p.hat){oval(x,y-dy*.31*scale,dx*.20*scale,dy*.07*scale,p.shade<.5?'#ced0c5':'#40535e');}
 }
 // Very faint structural glass/rail reflection, not a solid white strip.
 ctx.fillStyle='rgba(181,202,202,.10)';ctx.fillRect(0,0,W,2);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.anisotropy=4;return {texture,people:plan.people.length,columns:plan.columns};
}
function glassCanvas(THREE){
 const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
 if(!x)throw Error('ガラスの初期化失敗');
 const gradient=x.createLinearGradient(0,0,0,128);
 gradient.addColorStop(0,'#72939e');gradient.addColorStop(.31,'#496f7c');
 gradient.addColorStop(.74,'#34505d');gradient.addColorStop(1,'#536c74');
 x.fillStyle=gradient;x.fillRect(0,0,512,128);
 for(let i=0;i<16;i++){
  const px=i*32;
  x.fillStyle=i%3===0?'rgba(189,215,214,.15)':'rgba(188,209,205,.045)';
  x.fillRect(px+3,5,27,118);
  x.fillStyle='#8da4a8';x.fillRect(px,0,1.5,128);
  x.fillStyle='rgba(22,45,56,.24)';x.fillRect(px+3,94,27,29);
 }
 x.fillStyle='rgba(207,222,219,.13)';x.fillRect(0,35,512,3);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=4;
 return t;
}
export function planStandBands(len,height){
 // Match the five existing facade recesses exactly. Max projection 0.8m
 // beyond original z=29.22 facade, no large terrace or protruding platform.
 return Array.from({length:5},(_,floor)=>({
  floor,width:len*.942,height:height*.077,y:height*(.19+floor*.148),
  z:29.60,repeat:len*.942/51.2,kind:floor<3?'crowd':'glass'
 }));
}
export function addRaceDayStandDetail(THREE,stands){
 const panels=[crowdCanvas(THREE,261126,.84),crowdCanvas(THREE,92143,.75),crowdCanvas(THREE,74065,.69)];
 const glass=glassCanvas(THREE);
 const materials=panels.map(p=>new THREE.MeshStandardMaterial({map:p.texture,color:0xffffff,roughness:.88,metalness:0,emissive:0xffffff,emissiveMap:p.texture,emissiveIntensity:.10}));
 const glassMat=new THREE.MeshStandardMaterial({map:glass,color:0xffffff,roughness:.53,metalness:.12});
 let bandCount=0,crowdBands=0,glassBands=0,depicted=0;
 for(const stand of stands){
  const root=new THREE.Group();root.name='RaceDaySpectatorFacade';
  for(const band of planStandBands(stand.len,stand.height)){
   const geo=new THREE.PlaneGeometry(band.width,band.height),uv=geo.attributes.uv;
   for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*band.repeat+(band.floor*.173));
   uv.needsUpdate=true;
   const crowd=band.kind==='crowd',mesh=new THREE.Mesh(geo,crowd?materials[band.floor]:glassMat);
   mesh.name=crowd?'spectators-floor-'+(band.floor+1):'glass-floor-'+(band.floor+1);
   mesh.position.set(0,band.y,band.z);root.add(mesh);bandCount++;
   if(crowd){crowdBands++;depicted+=Math.round(panels[band.floor].people*band.repeat);}else glassBands++;
  }
  stand.group.add(root);
 }
 return {bandCount,crowdBands,glassBands,depicted,textureCount:4};
}
