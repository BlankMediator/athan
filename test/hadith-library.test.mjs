import test from 'node:test';
import assert from 'node:assert/strict';
import { HadithLibrary, narrationText } from '../dist/hadith-library.js';
const row=n=>({collection:'bukhari',bookNumber:'1',hadithNumber:String(n),hadith:[{lang:'en',body:'<p>Words &amp; meaning</p>',chapterTitle:'Beginning',grades:[]}]});
function setup(fetcher) {
 const files=new Map();let key='test-key';
 const library=new HadithLibrary({persistentKey:false,async key(value){if(value!==undefined)key=value;return key;},async read(id){return files.get(id)??null;},async write(id,value){files.set(id,structuredClone(value));}},fetcher);
 return {library,files};
}
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('official API download retains page checkpoints and resumes after a rate limit',async()=>{
 let fail=true, pages=[];
 const {library,files}=setup(async(url,options)=>{
  assert.equal(new URL(url).origin,'https://api.sunnah.com');assert.equal(options.headers['X-API-Key'],'test-key');assert.equal(options.redirect,'error');
  if(url.includes('/collections/'))return json({name:'bukhari',totalHadith:7000,totalAvailableHadith:2});
  const page=+new URL(url).searchParams.get('page');pages.push(page);
  if(page===2&&fail)return new Response('',{status:429});
  return json({data:[row(page)],next:page===1?2:null,total:2});
 });
 await library.download('bukhari');assert.equal(files.get('bukhari').nextPage,2);assert.match((await library.status()).error,/limit/);
 fail=false;await library.download('bukhari');assert.deepEqual(pages,[1,2,2]);
 const status=await library.status();assert.equal(status.collections[0].count,2);assert.equal(status.collections[0].total,7000);assert.equal(status.collections[0].complete,true);
 assert.equal(status.connected,true);assert.equal(status.downloading,null);
});
test('bad responses never advance checkpoints or accept another collection',async()=>{
 const {library,files}=setup(async url=>url.includes('/collections/')?json({name:'bukhari',totalHadith:2,totalAvailableHadith:2}):json({data:[{...row(1),collection:'muslim'}],next:null,total:2}));
 await library.download('bukhari');assert.equal(files.size,0);assert.match((await library.status()).error,/different collection/);
 await assert.rejects(library.read('../secrets'),/Unknown/);
});
test('cancelling preserves saved pages, disconnect drops key and text never executes HTML',async()=>{
 let library;
 ({library}=setup(async url=>{if(url.includes('/collections/'))return json({name:'bukhari',totalHadith:2,totalAvailableHadith:2});setTimeout(()=>library.cancel(),30);return json({data:[row(1)],next:2,total:2});}));
 await library.download('bukhari');assert.equal((await library.read('bukhari')).entries.length,1);assert.equal((await library.status()).downloading,null);
 await library.connect('');assert.equal((await library.status()).connected,false);await assert.rejects(library.download('bukhari'),/API key/);
 assert.equal(narrationText('<script>bad()</script><p>A &amp; B<br>words &#x627;</p>'),'A & B\nwords ا');
});
