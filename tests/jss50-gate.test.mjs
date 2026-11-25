import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {venueKey,createGateVenueController} from '../jss50-gate.mjs';
const raw=Buffer.from(readFileSync(new URL('../assets/jss50-approved.glb.b64',import.meta.url),'utf8'),'base64');
test('approved gate is byte-for-byte identical, with 32 doors and separate venue signs',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'35f85d7c7cfd40fba7be6c5d2238d30e845598026515703a89f9a7bd7a93db05');
 const data=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
 assert.equal(data.nodes.filter(x=>/^(front|rear)_\d{2}_[LR]$/.test(x.name)).length,32);
 assert.equal(data.nodes.filter(x=>/^venue_(front|rear)$/.test(x.name)).length,2);
});
test('venue changes only the two signs and preserves door state; original texture restored',()=>{
 const original={flipY:false,colorSpace:'srgb',anisotropy:1};
 const sign=name=>({name,isMesh:true,material:{map:original,clone(){return {...this}},dispose(){}}});
 const signs=[sign('venue_front'),sign('venue_rear')],doors=[];
 for(const prefix of ['front','rear'])for(let i=1;i<=8;i++)for(const side of ['L','R'])doors.push({name:prefix+'_'+String(i).padStart(2,'0')+'_'+side,rotation:{y:0}});
 const frame={name:'fixed_green',isMesh:true,material:{name:'unchanged'}};
 const root={traverse(fn){[...signs,...doors,frame].forEach(fn)}};
 const calls=[];globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(s){calls.push(s)}})})};
 const ctl=createGateVenueController({CanvasTexture:class{dispose(){}}},root);
 ctl.setDoors(1,0);const before=doors.map(x=>x.rotation.y);
 assert.equal(ctl.setVenue('東京'),'tokyo');assert.deepEqual(calls,['TOKYO RACECOURSE']);assert.notEqual(signs[0].material.map,original);
 assert.equal(signs[0].material.map,signs[1].material.map);assert.equal(signs[0].material.map.flipY,false);
 assert.deepEqual(doors.map(x=>x.rotation.y),before);assert.deepEqual(frame.material,{name:'unchanged'});
 assert.equal(ctl.setVenue('中山'),'nakayama');assert.ok(signs.every(x=>x.material.map===original));
 assert.equal(venueKey('unknown'),'nakayama');ctl.dispose();delete globalThis.document;
});
test('both racecourse pages open their own gate viewer; viewer contains fallback image',()=>{
 for(const [file,key] of [['tokyo-turf-a-elevation-rebuild.html','tokyo'],['nakayama-course-preview.html','nakayama']]){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.ok(html.includes('jss50-gate-preview.html?venue='+key));
 }
 const html=readFileSync(new URL('../jss50-gate-preview.html',import.meta.url),'utf8');
 assert.match(html,/data:image\/jpeg;base64,/);assert.match(html,/ctl.setVenue\(select.value\)/);
 assert.doesNotThrow(()=>new (Object.getPrototypeOf(async function(){}).constructor)(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'')));
});
