import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VENUES,VENUE_NAMES,venueKey,createGateVenueController} from '../jss50-gate.mjs';
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

test('all ten official venue names resolve and replace both boards without touching doors',()=>{
 const expected={sapporo:'札幌',hakodate:'函館',fukushima:'福島',niigata:'新潟',tokyo:'東京',nakayama:'中山',chukyo:'中京',kyoto:'京都',hanshin:'阪神',kokura:'小倉'};
 assert.deepEqual(VENUE_NAMES,expected);
 assert.deepEqual(Object.keys(VENUES),Object.keys(expected));
 const original={flipY:false,colorSpace:'srgb',anisotropy:1};
 const signs=['venue_front','venue_rear'].map(name=>({name,isMesh:true,material:{map:original,clone(){return {...this}},dispose(){}}}));
 const doors=Array.from({length:32},(_,i)=>({name:(i<16?'front':'rear')+'_'+String(Math.floor(i%16/2)+1).padStart(2,'0')+'_'+(i%2?'R':'L'),rotation:{y:0}}));
 const root={traverse(fn){[...signs,...doors].forEach(fn)}};
 const calls=[];globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(s){calls.push(s)}})})};
 try{
  const ctl=createGateVenueController({CanvasTexture:class{dispose(){}}},root);ctl.setDoors(.7,.3);
  const before=doors.map(x=>x.rotation.y);
  for(const [key,jp] of Object.entries(expected)){
   const english=key.toUpperCase()+' RACECOURSE';
   for(const val of [key,key.toUpperCase(),jp,jp+'競馬場',english])assert.equal(venueKey(val),key);
   assert.equal(ctl.setVenue(jp),key);assert.equal(ctl.venue,key);
   assert.equal(signs[0].material.map,signs[1].material.map);
   if(key==='nakayama')assert.equal(signs[0].material.map,original);
   else assert.equal(calls.at(-1),english);
   assert.deepEqual(doors.map(x=>x.rotation.y),before);
  }
  assert.equal(calls.length,9);ctl.dispose();
 }finally{delete globalThis.document}
});
test('static fallback independently supports all venues and preselected query values',()=>{
 const html=readFileSync(new URL('../jss50-gate-preview.html',import.meta.url),'utf8');
 const options=[...html.matchAll(/<option value="([a-z]+)"(?: selected)?>([^<]+)<\/option>/g)].map(m=>({value:m[1],textContent:m[2]}));
 assert.deepEqual(options.map(o=>o.value),Object.keys(VENUES));
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 for(const key of Object.keys(VENUES)){
  const board={textContent:'',hidden:false};
  const select={options,value:'',addEventListener(event,fn){this.change=fn}};
  const doc={getElementById:id=>id==='venue'?select:board};
  new Function('document','location',script)(doc,{search:'?venue='+encodeURIComponent(VENUE_NAMES[key]+'競馬場')});
  assert.equal(select.value,key);assert.equal(board.textContent,VENUES[key]);assert.equal(board.hidden,key==='nakayama');
  for(const v of Object.keys(VENUES)){select.value=v;select.change();assert.equal(board.textContent,VENUES[v]);assert.equal(board.hidden,v==='nakayama')}
 }
});
