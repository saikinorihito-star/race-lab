// Private device sync: only published client key, authenticated RLS, revision compare-and-swap.
const URL='https://kqkcmfmchrrapglabwwr.supabase.co';
const KEY='sb_publishable_HHoS-1l2FSMJFh6-pXrLOA_UToQluHE';
const TABLE='race_lab_sync', BIND='race-lab-cloud-binding-v1', BACKUP='race-lab-cloud-before-receive-v1';
export function stable(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}

// Named races are independent snapshots of the 18 starting slots, not
// references to mutable registry objects. A later edit never changes a saved race.
export const RACE_ARCHIVE_LIMIT=30;
const RACE_KEYS=['speed','stamina','acceleration','course','distance','composure','traffic','going','hill','start'];
const DISTANCES=[1400,1600,1800,2000,2300,2400,2500,2600,3400];
const ROLES=['逃げ','先行','中団','差し','追込'];
const GOINGS=['good','slightlyHeavy','heavy','bad'];
const WEATHERS=['sunny','cloudy','rain'];
function validStartRisk(a){return !a||!Object.hasOwn(a,'startRisk')||(Number.isInteger(a.startRisk)&&a.startRisk>=1&&a.startRisk<=10)}
function validAppearance(a){
 return a===undefined||a===null||(typeof a==='object'&&!Array.isArray(a)&&
  ['original','bay','darkBay','brown','black','chestnut','darkChestnut','gray','white'].includes(a.coat)&&
  ['small','standard','large'].includes(a.size)&&Number.isInteger(a.gear)&&a.gear>=0&&a.gear<=7);
}
function validRaceHorse(h){
 const a=h?.ability;
 return Number.isSafeInteger(h?.id)&&h.id>=0&&h.id<10000&&typeof h.name==='string'&&
  h.name.trim().length>0&&h.name.length<=24&&a&&validAppearance(h.appearance)&&
  validStartRisk(a)&&RACE_KEYS.every(k=>Number.isInteger(a[k])&&a[k]>=1&&a[k]<=10)&&ROLES.includes(a.role)&&
  Number.isInteger(a.preferredDistance)&&a.preferredDistance>=1000&&a.preferredDistance<=4000&&a.preferredDistance%50===0;
}
export function validRacePreset(r){
 const s=r?.conditions;
 return typeof r?.id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(r.id)&&
  typeof r.name==='string'&&r.name.trim().length>0&&r.name.length<=60&&
  Array.isArray(r.horses)&&r.horses.length===18&&r.horses.every(validRaceHorse)&&
  new Set(r.horses.map(h=>h.id)).size===18&&s&&DISTANCES.includes(s.distance)&&
  WEATHERS.includes(s.weather)&&GOINGS.includes(s.going)&&['standard','varied'].includes(s.flowMode)&&
  Number.isInteger(s.flowSeed)&&s.flowSeed>=1&&s.flowSeed<=999999;
}
export function validRaceArchive(a){
 return a?.version===1&&Array.isArray(a.races)&&a.races.length<=RACE_ARCHIVE_LIMIT&&
  a.races.every(validRacePreset)&&new Set(a.races.map(r=>r.id)).size===a.races.length&&
  (a.activeId===null||a.races.some(r=>r.id===a.activeId));
}
export function makeRacePreset(id,name,payload){
 const l=payload.library,s=payload.settings;
 const r={id,name:String(name).trim(),horses:l.lineup.map(id=>{
  const h=l.horses.find(h=>h.id===id);
  if(!h)throw Error('出走馬のデータがありません');
  return {id:h.id,name:h.name,ability:structuredClone(h.ability),...(h.appearance?{appearance:structuredClone(h.appearance)}:{})};
 }),conditions:{distance:s.distance,weather:s.weather,going:s.going,flowMode:s.flowMode,flowSeed:s.flowSeed}};
 if(!validRacePreset(r))throw Error('レース名または出走馬・条件を確認してください');
 return r;
}
export function saveRacePreset(archive,preset,replace=false){
 if(!validRaceArchive(archive)||!validRacePreset(preset))throw Error('レースデータの形式が正しくありません');
 const exists=archive.races.some(r=>r.id===preset.id);
 if(exists!==replace)throw Error('保存先を確認してください');
 if(!exists&&archive.races.length>=RACE_ARCHIVE_LIMIT)throw Error('保存できるのは30レースまでです');
 const races=exists?archive.races.map(r=>r.id===preset.id?structuredClone(preset):r):
  [...archive.races,structuredClone(preset)];
 return {version:1,races,activeId:preset.id};
}
export function restoreRacePreset(library,preset){
 if(!validRacePreset(preset))throw Error('保存済みレースの形式が正しくありません');
 // Preserve reserves and stable registry IDs. Restore only the 18 race entries.
 const horses=new Map(library.horses.map(h=>[h.id,structuredClone(h)]));
 for(const h of preset.horses){const previous=horses.get(h.id);horses.set(h.id,{...(previous?.appearance?{appearance:structuredClone(previous.appearance)}:{}),...structuredClone(h)});}
 if(horses.size>100)throw Error('登録馬が100頭を超えるため呼び出せません。控え馬を整理してください。');
 return {version:1,horses:[...horses.values()],lineup:preset.horses.map(h=>h.id),
  nextId:Math.max(library.nextId,...preset.horses.map(h=>h.id+1))};
}

export function validPayload(p){
 const l=p?.library;
 if(p?.version!==1||l?.version!==1||!Array.isArray(l.horses)||l.horses.length<18||l.horses.length>100||
  !Array.isArray(l.lineup)||l.lineup.length!==18||new Set(l.lineup).size!==18||
  !Number.isSafeInteger(l.nextId)||l.nextId<18||l.nextId>10000||
  !p.settings||typeof p.settings!=='object'||Array.isArray(p.settings)||
  (Object.hasOwn(p.settings,'raceArchive')&&!validRaceArchive(p.settings.raceArchive)))return false;
 const ids=l.horses.map(h=>h?.id);
 return new Set(ids).size===ids.length&&l.horses.every(h=>Number.isSafeInteger(h?.id)&&h.id>=0&&h.id<10000&&h.id<l.nextId&&
  typeof h.name==='string'&&h.name.trim().length>0&&h.name.length<=24&&
  validAppearance(h.appearance)&&(h.ability===null||typeof h.ability==='object'&&!Array.isArray(h.ability)&&validStartRisk(h.ability)))&&l.lineup.every(i=>ids.includes(i));
}
export function syncDecision(binding,uid,local,remote){
 if(!binding||binding.uid!==uid||!Number.isSafeInteger(binding.revision)||typeof binding.base!=='string')return 'setup';
 const localChanged=stable(local)!==binding.base;
 if(!remote)return 'setup';
 if(remote.revision===binding.revision){
  return localChanged?'upload':'equal';
 }
 if(stable(remote.payload)===stable(local))return 'ack';
 return localChanged?'conflict':'download';
}
// Older snapshots omit appearance; omission is not a request to reset it.
export function preserveMissingAppearance(local,remote){
 const next=structuredClone(local);
 const previous=new Map((remote?.library?.horses||[]).map(h=>[h.id,h]));
 for(const h of next.library.horses){
  const old=previous.get(h.id);
  if(!h.appearance&&old?.appearance&&h.name===old.name)h.appearance=structuredClone(old.appearance);
 }
 return next;
}
function withoutAppearance(payload){
 const p=structuredClone(payload);
 for(const h of p.library.horses)delete h.appearance;
 return p;
}
// Three-way merge only when the non-appearance data is compatible.
// A simultaneous conflicting change to the same horse still requires user choice.
export function mergeAppearanceConflict(binding,local,remote){
 let base;try{base=JSON.parse(binding?.base||'null')}catch{return null}
 if(!validPayload(base)||!validPayload(local)||!validPayload(remote))return null;
 const bCore=stable(withoutAppearance(base)),lCore=stable(withoutAppearance(local)),rCore=stable(withoutAppearance(remote));
 if(lCore!==bCore&&rCore!==bCore&&lCore!==rCore)return null;
 const next=structuredClone(lCore===bCore?remote:local);
 const bm=new Map(base.library.horses.map(h=>[h.id,h])),lm=new Map(local.library.horses.map(h=>[h.id,h])),rm=new Map(remote.library.horses.map(h=>[h.id,h]));
 for(const h of next.library.horses){
  const b=bm.get(h.id),l=lm.get(h.id),r=rm.get(h.id);
  if(!l||!r)continue;
  if(!b&&l.name!==r.name)return null;
  const bv=b?.appearance||null,lv=l.appearance||bv,rv=r.appearance||bv;
  const lc=stable(lv)!==stable(bv),rc=stable(rv)!==stable(bv);
  if(lc&&rc&&stable(lv)!==stable(rv))return null;
  const value=lc?lv:rv;
  if(value)h.appearance=structuredClone(value);else delete h.appearance;
 }
 return validPayload(next)?next:null;
}
function appearanceCount(payload){return (payload?.library?.horses||[]).filter(h=>h.appearance).length}
function readBinding(){try{return JSON.parse(localStorage.getItem(BIND)||'null')}catch{return null}}
// Bound stalled reads/auth calls without allowing an expired task to update local data.
export function syncDeadline(promise,label,ms=12000){
 let timer;
 return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(Error(label+'がタイムアウトしました。再試行してください。')),ms);
 })]).finally(()=>clearTimeout(timer));
}
async function syncFetch(input,init={}){
 const controller=new AbortController(),signal=init.signal||input?.signal;
 const abort=()=>controller.abort();
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,12000);
 try{return await fetch(input,{...init,signal:controller.signal})}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export async function startPrivateSync({capture,restore,safe,status,ui}){
 let client=null,busy=false,user=null,latest=null,queuedRefresh=false;
 const say=t=>status.textContent=t;
 const finish=()=>{
  busy=false;ui.refresh.textContent='今すぐ同期';ui.refresh.removeAttribute('aria-busy');
  if(queuedRefresh){queuedRefresh=false;void tick('refresh')}
 };
 const show=(logged,manual)=>{
  ui.auth.hidden=logged;ui.auth.style.display=logged?'none':'flex';ui.actions.hidden=!logged;
  ui.email.disabled=logged;ui.password.disabled=logged;
  ui.send.hidden=!manual;ui.receive.hidden=!manual||!latest;
  ui.receive.disabled=!latest;
 };
 const ready=async()=>{
  if(client)return client;
  const {createClient}=await syncDeadline(import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm'),'同期ライブラリの読み込み');
  client=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:syncFetch}});
  return client;
 };
 const read=async()=>{
  const {data,error}=await syncDeadline(client.from(TABLE).select('revision,payload,updated_at').eq('user_id',user.id).maybeSingle(),'クラウドの読み込み');
  if(error)throw error;
  if(data&&(!validPayload(data.payload)||!Number.isSafeInteger(data.revision)))throw Error('クラウドデータが不正です。端末のデータは保持しました。');
  return data;
 };
 function bind(row){
  localStorage.setItem(BIND,JSON.stringify({uid:user.id,revision:row.revision,base:stable(row.payload)}));
 }
 async function upload(local,remote){
  if(!validPayload(local))throw Error('端末データを確認できません。送信を中止しました。');
  const next={user_id:user.id,revision:remote?remote.revision+1:1,payload:local,updated_at:new Date().toISOString()};
  const request=remote?client.from(TABLE).update(next).eq('user_id',user.id).eq('revision',remote.revision):
   client.from(TABLE).insert(next);
  say('同期中：クラウドへ保存しています…');
  const {data,error}=await request.select('revision,payload,updated_at').maybeSingle();
  if(error||!data){latest=await read();show(true,true);throw Error('同期先が変更されたか、保存に失敗しました。端末データは保持されています。')}
  bind(data);latest=data;show(true,false);
  say('同期済み（クラウドに保存・外見設定 '+appearanceCount(data.payload)+'頭）');
  return data;
 }
 function receive(local,remote){
  if(!remote||!safe())throw Error('発馬機に戻り、入力・編集中の項目を保存してから同期してください。');
  localStorage.setItem(BACKUP,JSON.stringify({at:new Date().toISOString(),payload:local}));
  // restore persists a validated complete snapshot, then reloads at the safe starting gate.
  restore(remote.payload,()=>bind(remote));
 }
 async function tick(mode='auto'){
  if(busy){
   if(mode==='refresh'){queuedRefresh=true;say('同期通信中です。終了後にもう一度確認します…');ui.refresh.textContent='同期中…'}
   else if(mode==='send'||mode==='receive')say('同期通信中です。終了後にもう一度押してください。');
   return;
  }
  if(document.visibilityState==='hidden'&&mode==='auto')return;
  busy=true;ui.refresh.setAttribute('aria-busy','true');ui.refresh.textContent='同期中…';
  say('同期中：接続を確認しています…');
  try{
   await ready();
   const {data,error}=await syncDeadline(client.auth.getSession(),'ログイン状態の確認');
   if(error)throw error;
   user=data.session?.user||null;
   if(!user){latest=null;show(false,false);say('未接続：端末内に保存しています');return}
   say('同期中：クラウドの登録馬を確認しています…');
   const local=capture(),remote=await read();latest=remote;
   if(!validPayload(local))throw Error('端末のデータ形式を確認できません。');
   // Never replace or upload an unseen local edit while a request was in flight.
   if(stable(capture())!==stable(local)){say('編集中：次回の同期で反映します');return}
   const binding=readBinding(),decision=syncDecision(binding,user.id,local,remote);
   if(mode==='send'){
    if(!safe())throw Error('発馬機に戻り、編集中の項目を保存してから同期してください。');
    if(remote&&!confirm('クラウドの内容をこの端末の登録馬・設定で置き換えますか？'))return;
    const next=preserveMissingAppearance(local,remote?.payload);
    const saved=await upload(next,remote);
    if(stable(next)!==stable(local))receive(local,saved);
    return;
   }
   if(mode==='receive'){
    if(!remote)return;
    if(!confirm('この端末の内容をバックアップし、クラウドの内容に切り替えますか？'))return;
    receive(local,remote);return;
   }
   if(decision==='conflict'&&safe()){
    const merged=mergeAppearanceConflict(binding,local,remote?.payload);
    if(merged){
     if(stable(merged)===stable(remote.payload)){receive(local,remote);return}
     const saved=await upload(merged,remote);
     if(stable(merged)!==stable(local))receive(local,saved);
     return;
    }
   }
   if(decision==='setup'||decision==='conflict'){
    show(true,true);
    say(decision==='conflict'?'両端末に変更があります。上書き先を選んでください。':
     remote?'初回同期：クラウドを受信するか、この端末を基準にするか選択してください。':
     '初回同期：登録済みのiPhoneから「この端末をクラウドに保存」を押してください。');
    return;
   }
   show(true,false);
   if(decision==='equal'){say('同期済み（外見設定 '+appearanceCount(local)+'頭）');return}
   if(decision==='ack'){bind(remote);say('同期済み（外見設定 '+appearanceCount(local)+'頭）');return}
   if(!safe()){say('同期保留：発馬機に戻し、未保存の馬名・能力・外見などを保存してください。');return}
   if(decision==='download'){receive(local,remote);return}
   if(decision==='upload'){
    const next=preserveMissingAppearance(local,remote?.payload),saved=await upload(next,remote);
    if(stable(next)!==stable(local))receive(local,saved);
   }
  }catch(e){say('同期できません：'+String(e?.message||e)+'（端末保存は継続）')}
  finally{finish()}
 }
 async function auth(signup){
  if(busy){say('同期通信中です。終了後にもう一度押してください。');return}busy=true;
  say('認証中…');
  try{
   await ready();
   const email=ui.email.value.trim(),password=ui.password.value;
   if(!email||password.length<8)throw Error('メールアドレスと8文字以上のパスワードを入力してください。');
   const credentials={email,password};
   const {data,error}=await syncDeadline(signup?client.auth.signUp(credentials):client.auth.signInWithPassword(credentials),'認証');
   if(error)throw error;
   ui.password.value='';
   if(signup&&!data.session){say('確認メールを開いて認証し、この画面でログインしてください。');return}
  }catch(e){say('認証できません：'+String(e?.message||e));return}
  finally{finish()}
  await tick();
 }
 ui.login.addEventListener('click',()=>auth(false));ui.signup.addEventListener('click',()=>auth(true));
 ui.logout.addEventListener('click',async()=>{
  if(busy){say('同期通信中です。終了後にもう一度押してください。');return}busy=true;
  try{await ready();const {error}=await syncDeadline(client.auth.signOut({scope:'local'}),'ログアウト');if(error)throw error;show(false,false);say('ログアウトしました。端末データは残っています。')}
  catch(e){say('ログアウトできません：'+String(e?.message||e))}finally{finish()}
 });
 const manual=mode=>{document.activeElement?.blur?.();return tick(mode)};
 ui.send.addEventListener('click',()=>manual('send'));ui.receive.addEventListener('click',()=>manual('receive'));
 ui.refresh.addEventListener('click',()=>manual('refresh'));
 document.addEventListener('race-lab:appearance-saved',()=>manual('refresh'));
 window.addEventListener('online',()=>tick());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick()});
 // Do not make a network request on every animation frame.
 setInterval(()=>tick(),12000);
 await tick();
}
