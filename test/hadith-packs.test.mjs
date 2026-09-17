import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { HADITH_COLLECTIONS, HadithLibrary, validateCommunityPack, narrationId } from '../dist/hadith-library.js';

const pack = id => {
  const meta=HADITH_COLLECTIONS.find(c=>c.id===id);
  const bytes=readFileSync(new URL(`../assets/hadith/${meta.file}`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);
  return validateCommunityPack(id,JSON.parse(gunzipSync(bytes)));
};

test('all public packs have verified hashes, unique identities, valid provenance and resolvable chapter mappings',()=>{
  let count=0;
  for(const meta of HADITH_COLLECTIONS) {
    const data=pack(meta.id);count+=data.entries.length;
    for(const e of data.entries) {
      assert.ok(e.references.length && e.provenance.length && e.url.startsWith('https://sunnah.com/'));
      assert.ok(e.hadith.some(t=>t.body.length>0));
      for(const p of e.provenance)assert.ok(data.sources[p.source]);
      if(e.chapterId)assert.ok(data.books.some(b=>b.number===e.bookNumber&&b.chapters.some(c=>c.id===e.chapterId)),`${e.id} chapter`);
      for(const t of e.hadith)for(const g of t.grades) {
        assert.ok(data.sources[g.source]);
        assert.doesNotMatch(g.grade,/^Reference\s*:/i);
      }
    }
    assert.equal(new Set(data.entries.map(narrationId)).size,data.entries.length);
  }
  assert.equal(count,51776);assert.equal(HADITH_COLLECTIONS.length,17);
  assert.equal(HADITH_COLLECTIONS.find(c=>c.id==='ahmad').partial,true);
});

test('reference variants and book-based numbering remain intact and naturally ordered',()=>{
  const malik=pack('malik');
  assert.deepEqual(malik.entries.slice(0,3).map(e=>e.hadithNumber),['1/1','1/2','1/3']);
  assert.equal(malik.entries[0].url,'https://sunnah.com/malik/1/1');
  const muslim=pack('muslim');
  const compound=muslim.entries.filter(e=>/[,–-]/.test(e.hadithNumber));
  assert.ok(compound.length>0);
  for(const e of compound)assert.match(e.url,/muslim:\d+[a-z]?$/);
  assert.ok(muslim.entries.some(e=>e.bookNumber==='0'&&e.url==='https://sunnah.com/muslim/introduction'));
  const first=pack('bukhari').entries[0];
  assert.equal(first.url,'https://sunnah.com/bukhari:1');assert.ok(first.chapterId);
  assert.ok(first.references.some(r=>/In-book/i.test(r.label)));
  assert.match(first.hadith.find(t=>t.lang==='en').body,/intentions/);
});

test('pack downloads need no API key, preserve old readings on invalid data or cancellation, and remove cleanly',async()=>{
  const original=pack('qudsi40');let saved=original,mode='valid';
  const library=new HadithLibrary({persistentKey:false,key:async()=>'',read:async id=>id==='qudsi40'?saved:null,write:async(_,v)=>{saved=v;}},async()=>{throw Error('Network should not be called');},()=>{},async()=>{
    if(mode==='cancel')library.cancel();
    return mode==='invalid'?{...original,entries:original.entries.slice(1)}:original;
  });
  await library.download('qudsi40');assert.equal(saved.entries.length,40);
  mode='invalid';const before=saved;await library.download('qudsi40');assert.equal(saved,before);assert.match((await library.status()).error,/validation/);
  mode='cancel';await library.download('qudsi40');assert.equal(saved,before);assert.equal((await library.status()).downloading,null);
  await library.remove('qudsi40');assert.equal(saved,null);
  const malicious=structuredClone(original);malicious.entries[0].url='https://example.com/phishing';assert.throws(()=>validateCommunityPack('qudsi40',malicious));
});
