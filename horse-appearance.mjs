// Appearance changes are runtime-only. The original GLB and skeleton remain intact.
export const COAT_COLORS=Object.freeze({original:null,bay:'#874a29',darkBay:'#503021',brown:'#34302b',black:'#202024',chestnut:'#b86d38',darkChestnut:'#794322',gray:'#b1b3b0',white:'#e0ddd3'});
export const SIZE_FACTORS=Object.freeze({small:.94,standard:1,large:1.04});
export function normalizeHorseAppearance(raw){
 return {coat:Object.hasOwn(COAT_COLORS,raw?.coat)?raw.coat:'original',
  size:Object.hasOwn(SIZE_FACTORS,raw?.size)?raw.size:'standard',
  gear:Number.isInteger(raw?.gear)&&raw.gear>=0&&raw.gear<=7?raw.gear:0};
}
export function prepareHeadZone(THREE,node){
 const g=node.geometry,p=g?.getAttribute('position'),si=g?.getAttribute('skinIndex'),sw=g?.getAttribute('skinWeight');
 if(!p||!si||!sw)return null;
 if(g.userData.raceHeadBounds)return g.userData.raceHeadBounds;
 const isHead=bone=>{for(let b=bone;b?.isBone;b=b.parent)if(/(^|[_.:\\-])head($|[_.:\\-])/i.test(b.name)||/^head$/i.test(b.name))return true;return false};
 const headIndices=new Set(node.skeleton.bones.map((b,i)=>isHead(b)?i:-1).filter(i=>i>=0));
 const data=new Uint8Array(p.count);let minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity,maxX=0,count=0;
 const getters=['getX','getY','getZ','getW'];
 for(let i=0;i<p.count;i++){
  let w=0;for(const get of getters)if(headIndices.has(si[get](i)))w+=sw[get](i);
  data[i]=Math.round(Math.min(1,Math.max(0,w))*255);
  if(w>.65){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);minY=Math.min(minY,y);maxY=Math.max(maxY,y);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);maxX=Math.max(maxX,Math.abs(x));count++}
 }
 g.setAttribute('raceHeadZone',new THREE.Uint8BufferAttribute(data,1,true));
 const bounds=count>20&&maxY-minY>.02&&maxZ-minZ>.02?[minY,maxY,minZ,maxZ,Math.max(.02,maxX),1]:[0,1,0,1,1,0];
 g.userData.raceHeadBounds=bounds;return bounds;
}
export function createAppearanceUniforms(THREE,bounds){
 const b=bounds||[0,1,0,1,1,0];
 return {raceCoat:{value:new THREE.Color('#874a29')},raceCoatEnabled:{value:0},
  raceHeadBounds:{value:new THREE.Vector4(b[0],b[1],b[2],b[3])},
  raceHeadWidth:{value:b[4]},raceGearAvailable:{value:b[5]},
  raceGear:{value:new THREE.Vector3(0,0,0)}};
}
export function applyAppearanceUniforms(u,raw){
 const a=normalizeHorseAppearance(raw);
 u.raceCoatEnabled.value=a.coat==='original'?0:1;
 if(a.coat!=='original')u.raceCoat.value.set(COAT_COLORS[a.coat]);
 u.raceGear.value.set(a.gear&1?1:0,a.gear&2?1:0,a.gear&4?1:0);
 return a;
}
export const APPEARANCE_FRAGMENT=`
 // Restrict coat tint to brown horse hair, away from the rider and cloth.
 float coatRed=diffuseColor.r-diffuseColor.b;
 float coatGreen=diffuseColor.g-diffuseColor.b;
 float hair=smoothstep(.012,.055,coatRed)*smoothstep(.004,.025,coatGreen);
 float horseRegion=max(1.0-smoothstep(.26,.43,vRaceBindPos.y),smoothstep(.35,.80,vRaceHeadZone));
 float coatMask=hair*horseRegion*(1.0-smoothstep(.25,.48,vRaceTintZone))*raceCoatEnabled;
 float hairLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 vec3 coatColor=raceCoat*clamp(.48+hairLight*2.9,.48,1.35);
 diffuseColor.rgb=mix(diffuseColor.rgb,coatColor,coatMask);
 // Surface-style optional head gear follows the skinned head.
 // Original bridle, eyes, and muzzle remain visible; no detached floating shapes.
 vec2 headUV=clamp(vec2((vRaceBindPos.z-raceHeadBounds.z)/max(.001,raceHeadBounds.w-raceHeadBounds.z),
 (vRaceBindPos.y-raceHeadBounds.x)/max(.001,raceHeadBounds.y-raceHeadBounds.x)),0.0,1.0);
 float sideX=abs(vRaceBindPos.x)/max(.001,raceHeadWidth);
 float headMask=smoothstep(.47,.83,vRaceHeadZone)*raceGearAvailable;
 float eyeHole=1.0-smoothstep(.13,.23,length((headUV-vec2(.46,.68))*vec2(1.0,1.3)));
 float hood=raceGear.x*smoothstep(.43,.64,headUV.y)*(1.0-smoothstep(.72,.86,headUV.x))*(1.0-eyeHole);
 float blinker=raceGear.y*(1.0-smoothstep(.14,.22,length((headUV-vec2(.30,.65))*vec2(1.0,1.4))))*smoothstep(.50,.75,sideX);
 float band=raceGear.z*(1.0-smoothstep(.035,.065,abs(headUV.x-.78)))*smoothstep(.08,.19,headUV.y)*(1.0-smoothstep(.56,.70,headUV.y));
 float gearMask=clamp(max(max(hood,blinker),band)*headMask,0.0,1.0);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.022,.044,.075)*(0.78+hairLight*.65),gearMask);
`;
