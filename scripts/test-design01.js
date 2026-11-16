const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push('page:'+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text());});
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#design-glb-status').waitFor({timeout:30000});
 await page.waitForFunction(()=>document.getElementById('design-glb-status')?.textContent?.includes('適用済み')
   ||document.getElementById('design-glb-status')?.textContent?.includes('失敗'),{timeout:45000});
 const text=await page.locator('#design-glb-status').innerText();
 const canvas=await page.locator('#three-host canvas').count();
 await page.screenshot({path:'design01-smoke.png',fullPage:false});
 console.log(JSON.stringify({glbStatus:text,threeCanvas:canvas,errors:errors.slice(0,8)},null,2));
 await browser.close();
 if(!text.includes('適用済み')||!canvas)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});