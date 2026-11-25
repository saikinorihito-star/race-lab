// Shared approved JSS50-style gate. Keep geometry and door pivots unchanged.
export const VENUE_NAMES=Object.freeze({"sapporo":"札幌","hakodate":"函館","fukushima":"福島","niigata":"新潟","tokyo":"東京","nakayama":"中山","chukyo":"中京","kyoto":"京都","hanshin":"阪神","kokura":"小倉"});
export const VENUES=Object.freeze({"sapporo":"SAPPORO RACECOURSE","hakodate":"HAKODATE RACECOURSE","fukushima":"FUKUSHIMA RACECOURSE","niigata":"NIIGATA RACECOURSE","tokyo":"TOKYO RACECOURSE","nakayama":"NAKAYAMA RACECOURSE","chukyo":"CHUKYO RACECOURSE","kyoto":"KYOTO RACECOURSE","hanshin":"HANSHIN RACECOURSE","kokura":"KOKURA RACECOURSE"});
export function venueKey(value){
 const v=String(value??'').trim().toLowerCase();
 if(Object.hasOwn(VENUES,v))return v;
 return Object.keys(VENUE_NAMES).find(k=>v===VENUE_NAMES[k]||v===VENUE_NAMES[k]+'競馬場'||v===VENUES[k].toLowerCase())??'nakayama';
}
export async function loadApprovedGate(loader){
 const response=await fetch(new URL('./assets/jss50-approved.glb.b64',import.meta.url));
 if(!response.ok)throw Error('発馬機データ取得失敗');
 const bytes=Uint8Array.from(atob((await response.text()).trim()),c=>c.charCodeAt(0));
 if(bytes.byteLength!==321636||new DataView(bytes.buffer).getUint32(0,true)!==0x46546c67)throw Error('承認済みGLBの形式が異なります');
 const gltf=await new Promise((resolve,reject)=>loader.parse(bytes.buffer,'',resolve,reject));
 return gltf.scene;
}
export function createGateVenueController(THREE,root,expectedStalls=8){
 const boards=[],doors=[];
 root.traverse(o=>{
  if(o.isMesh&&/^venue_(front|rear)$/.test(o.name)){
   const original=o.material.map;
   if(!original)throw Error('看板テクスチャがありません');
   o.material=o.material.clone();
   boards.push({mesh:o,original});
  }
  if(/^(front|rear)_\d{2}_[LR]$/.test(o.name))doors.push(o);
 });
 if(boards.length!==2||doors.length!==expectedStalls*4)throw Error('発馬機の部品数が異なります');
 let selected='nakayama';const generated=new Map();
 function setVenue(value){
  const key=venueKey(value);
  for(const {mesh,original} of boards){
   if(key==='nakayama'){mesh.material.map=original;mesh.material.needsUpdate=true;continue}
   let tex=generated.get(key);
   if(!tex){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=64;
    const c=canvas.getContext('2d');c.fillStyle='#1b5a40';c.fillRect(0,0,1024,64);
    c.fillStyle='#f2f9f5';c.font='bold 50px sans-serif';c.textAlign='center';c.textBaseline='middle';
    c.fillText(VENUES[key],512,32,990);
    tex=new THREE.CanvasTexture(canvas);tex.flipY=original.flipY;tex.colorSpace=original.colorSpace;
    tex.anisotropy=original.anisotropy;generated.set(key,tex);
   }
   mesh.material.map=tex;mesh.material.needsUpdate=true;
  }
  selected=key;return key;
 }
 function setDoors(front=0,rear=0){
  for(const p of doors){
   const f=p.name.startsWith('front'),left=p.name.endsWith('_L');
   p.rotation.y=(left?-1:1)*(f?1:-1)*Math.PI*.48*Math.max(0,Math.min(1,f?front:rear));
  }
 }
 function dispose(){for(const t of generated.values())t.dispose();for(const b of boards){b.mesh.material.map=b.original;b.mesh.material.dispose()}}
 return {setVenue,setDoors,dispose,get venue(){return selected},boards,doors};
}
