// Private device sync: only published client key, authenticated RLS, revision compare-and-swap.
const URL='https://kqkcmfmchrrapglabwwr.supabase.co';
const KEY='sb_publishable_HHoS-1l2FSMJFh6-pXrLOA_UToQluHE';
const TABLE='race_lab_sync', BIND='race-lab-cloud-binding-v1', BACKUP='race-lab-cloud-before-receive-v1';
export function stable(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}
export function validPayload(p){
 const l=p?.library;
 if(p?.version!==1||l?.version!==1||!Array.isArray(l.horses)||l.horses.length<18||l.horses.length>100||
  !Array.isArray(l.lineup)||l.lineup.length!==18||new Set(l.lineup).size!==18||
  !Number.isSafeInteger(l.nextId)||l.nextId<18||l.nextId>10000||
  !p.settings||typeof p.settings!=='object'||Array.isArray(p.settings))return false;
 const ids=l.horses.map(h=>h?.id);
 return new Set(ids).size===ids.length&&l.horses.every(h=>Number.isSafeInteger(h?.id)&&h.id>=0&&h.id<10000&&h.id<l.nextId&&
  typeof h.name==='string'&&h.name.trim().length>0&&h.name.length<=24&&
  (h.ability===null||typeof h.ability==='object'&&!Array.isArray(h.ability)))&&l.lineup.every(i=>ids.includes(i));
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
function readBinding(){try{return JSON.parse(localStorage.getItem(BIND)||'null')}catch{return null}}
export async function startPrivateSync({capture,restore,safe,status,ui}){
 let client=null,busy=false,user=null,latest=null;
 const say=t=>status.textContent=t;
 const show=(logged,manual)=>{
  ui.auth.hidden=logged;ui.auth.style.display=logged?'none':'flex';ui.actions.hidden=!logged;
  ui.email.disabled=logged;ui.password.disabled=logged;
  ui.send.hidden=!manual;ui.receive.hidden=!manual||!latest;
  ui.receive.disabled=!latest;
 };
 const ready=async()=>{
  if(client)return client;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm');
  client=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
 };
 const read=async()=>{
  const {data,error}=await client.from(TABLE).select('revision,payload,updated_at').eq('user_id',user.id).maybeSingle();
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
  const {data,error}=await request.select('revision,payload,updated_at').maybeSingle();
  if(error||!data){latest=await read();show(true,true);throw Error('同期先が変更されたか、保存に失敗しました。端末データは保持されています。')}
  bind(data);latest=data;show(true,false);
  say('同期済み（クラウドに保存）');
 }
 function receive(local,remote){
  if(!remote||!safe())throw Error('発馬機に戻り、入力・編集中の項目を保存してから同期してください。');
  localStorage.setItem(BACKUP,JSON.stringify({at:new Date().toISOString(),payload:local}));
  // restore persists a validated complete snapshot, then reloads at the safe starting gate.
  restore(remote.payload,()=>bind(remote));
 }
 async function tick(mode='auto'){
  if(busy)return;
  if(document.visibilityState==='hidden'&&mode==='auto')return;
  busy=true;
  try{
   await ready();
   const {data,error}=await client.auth.getSession();
   if(error)throw error;
   user=data.session?.user||null;
   if(!user){latest=null;show(false,false);say('未接続：端末内に保存しています');return}
   const local=capture(),remote=await read();latest=remote;
   if(!validPayload(local))throw Error('端末のデータ形式を確認できません。');
   // Never replace or upload an unseen local edit while a request was in flight.
   if(stable(capture())!==stable(local)){say('編集中：次回の同期で反映します');return}
   const decision=syncDecision(readBinding(),user.id,local,remote);
   if(mode==='send'){
    if(!safe())throw Error('発馬機に戻り、編集中の項目を保存してから同期してください。');
    if(remote&&!confirm('クラウドの内容をこの端末の登録馬・設定で置き換えますか？'))return;
    await upload(local,remote);return;
   }
   if(mode==='receive'){
    if(!remote)return;
    if(!confirm('この端末の内容をバックアップし、クラウドの内容に切り替えますか？'))return;
    receive(local,remote);return;
   }
   if(decision==='setup'||decision==='conflict'){
    show(true,true);
    say(decision==='conflict'?'両端末に変更があります。上書き先を選んでください。':
     remote?'初回同期：クラウドを受信するか、この端末を基準にするか選択してください。':
     '初回同期：登録済みのiPhoneから「この端末をクラウドに保存」を押してください。');
    return;
   }
   show(true,false);
   if(decision==='equal'){say('同期済み');return}
   if(decision==='ack'){bind(remote);say('同期済み');return}
   if(!safe()){say('同期保留：レース・編集終了後に反映します');return}
   if(decision==='download'){receive(local,remote);return}
   if(decision==='upload')await upload(local,remote);
  }catch(e){say('同期できません：'+String(e?.message||e)+'（端末保存は継続）')}
  finally{busy=false}
 }
 async function auth(signup){
  if(busy)return;busy=true;
  try{
   await ready();
   const email=ui.email.value.trim(),password=ui.password.value;
   if(!email||password.length<8)throw Error('メールアドレスと8文字以上のパスワードを入力してください。');
   const credentials={email,password};
   const {data,error}=signup?await client.auth.signUp(credentials):await client.auth.signInWithPassword(credentials);
   if(error)throw error;
   ui.password.value='';
   if(signup&&!data.session){say('確認メールを開いて認証し、この画面でログインしてください。');return}
  }catch(e){say('認証できません：'+String(e?.message||e));return}
  finally{busy=false}
  await tick();
 }
 ui.login.addEventListener('click',()=>auth(false));ui.signup.addEventListener('click',()=>auth(true));
 ui.logout.addEventListener('click',async()=>{
  if(busy)return;busy=true;
  try{await ready();const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;show(false,false);say('ログアウトしました。端末データは残っています。')}
  catch(e){say('ログアウトできません：'+String(e?.message||e))}finally{busy=false}
 });
 ui.send.addEventListener('click',()=>tick('send'));ui.receive.addEventListener('click',()=>tick('receive'));
 ui.refresh.addEventListener('click',()=>tick());
 window.addEventListener('online',()=>tick());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick()});
 // Do not make a network request on every animation frame.
 setInterval(()=>tick(),12000);
 await tick();
}
