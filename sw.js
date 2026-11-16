const CACHE='race-lab-v33';
const ASSETS=['./','./index.html','./styles.css','./app.mjs','./engine.mjs','./visual.mjs','./gait.mjs','./course.mjs','./appearance.mjs','./three-view.mjs','./worker.mjs','./manifest.webmanifest','./icon.svg','./apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin)return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(e.request);
   if(response.ok)cache.put(e.request,response.clone()).catch(()=>{});
   return response;
  }catch{
   const cached=await cache.match(e.request);
   if(cached)return cached;
   throw new Error('ネットワーク接続を確認してください。');
  }
 })());
});
