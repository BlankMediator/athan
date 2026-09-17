import { z } from 'zod';
import { COMMUNITY_COLLECTIONS } from './hadith-catalogue.js';

export const HADITH_COLLECTIONS = [...COMMUNITY_COLLECTIONS].sort((a,b)=>['bukhari','muslim','abudawud','tirmidhi','nasai','ibnmajah','malik','ahmad','darimi','riyadussalihin','adab','bulugh','mishkat','shamail','nawawi40','qudsi40','shahwaliullah40'].indexOf(a.id)-['bukhari','muslim','abudawud','tirmidhi','nasai','ibnmajah','malik','ahmad','darimi','riyadussalihin','adab','bulugh','mishkat','shamail','nawawi40','qudsi40','shahwaliullah40'].indexOf(b.id));
export const HADITH_SOURCES:Record<string,string> = {cheese:'https://github.com/CheeseWithSauce/HadithsJSONFormat',sehal:'https://github.com/sehalhussain/Hadith-Dua-assets',jaguar:'https://github.com/Jaguar16/open-hadith-data'};
export const collectionId = z.string().refine(id => HADITH_COLLECTIONS.some(c => c.id === id), 'Unknown hadith collection');
const numberText = z.union([z.string(), z.number()]).transform(String);
const narrationSchema = z.object({
  collection: collectionId, bookNumber: numberText, chapterId: numberText.optional(), hadithNumber: numberText.pipe(z.string().min(1).max(100)),
  id: z.string().optional(), reference: z.string().optional(), url: z.string().url().refine(url => { const u=new URL(url);return u.protocol==='https:' && u.hostname==='sunnah.com' && !u.username && !u.password; }).optional(),
  references: z.array(z.object({ label:z.string(), text:z.string(), source:z.string() })).optional(),
  narrator: z.string().optional(), missingEnglish:z.boolean().optional(),
  provenance: z.array(z.object({source:z.string(),record:z.string()})).optional(),
  structure: z.record(z.string(),z.string()).optional(),
  hadith: z.array(z.object({ lang: z.string().max(20), chapterNumber: numberText.optional(), chapterTitle: z.string().default(''), body: z.string().max(200000),
    grades: z.array(z.object({ graded_by: z.string(), grade: z.string(), source:z.string().optional() })).default([]) })).min(1),
});
export type Narration = z.infer<typeof narrationSchema>;
export interface HadithBook { number:string; name:string; arabic:string; chapters:{id:string;name:string;arabic:string}[]; }
export interface DownloadedHadith { id: string; updated: string; total: number; available: number; nextPage: number | null; entries: Narration[];
  source?:string; books?:HadithBook[]; coverageNote?:string; collection?:{author_en:string;author_ar:string};
  sources?:Record<string,{name:string;url:string;revision:string;license:string;role:string}>;
}
export const narrationId = (entry:Narration) => entry.id ?? entry.hadithNumber;
export function validateCommunityPack(id:string, value:unknown):DownloadedHadith {
  const meta=HADITH_COLLECTIONS.find(c=>c.id===collectionId.parse(id))!;
  const data=z.object({id:z.literal(id),schemaVersion:z.literal(2),updated:z.string(),total:z.literal(meta.count),available:z.literal(meta.count),nextPage:z.null(),source:z.literal('community'),entries:z.array(narrationSchema).length(meta.count),
    books:z.array(z.object({number:z.string(),name:z.string(),arabic:z.string(),chapters:z.array(z.object({id:z.string(),name:z.string(),arabic:z.string()}))})),coverageNote:z.string(),collection:z.object({author_en:z.string(),author_ar:z.string()}),
    sources:z.record(z.string(),z.object({name:z.string(),url:z.string(),revision:z.string(),license:z.string(),role:z.string()}))}).parse(value);
  if(data.entries.some(e=>e.collection!==id)||new Set(data.entries.map(narrationId)).size!==data.entries.length)throw new Error('Invalid collection records.');
  return data;
}
export interface HadithStatus {
  connected: boolean; persistentKey: boolean;
  downloading: { id: string; count: number; available: number } | null; error: string | null;
  collections: { id: string; count: number; total: number; available: number; complete: boolean; updated: string; source?:string }[];
}
export interface HadithStorage {
  read(id: string): Promise<DownloadedHadith | null>;
  write(id: string, value: DownloadedHadith | null): Promise<void>;
  key(value?: string): Promise<string>;
  persistentKey: boolean;
}
export const narrationUrl = (id: string, number: string) => `https://sunnah.com/${collectionId.parse(id)}:${encodeURIComponent(number)}`;
export function narrationText(html: string): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => { const cp = n.toLowerCase().startsWith('x') ? parseInt(n.slice(1), 16) : +n; return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''; })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[name]!)
    .replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Validated optional collection packs, with legacy official API compatibility. */
export class HadithLibrary {
  private controller: AbortController | null = null;
  private progress: HadithStatus['downloading'] = null;
  private error: string | null = null;
  constructor(private storage: HadithStorage, private fetcher: typeof fetch, private changed = () => {}, private pack?: (id:string,signal:AbortSignal)=>Promise<unknown>) {}
  async status(): Promise<HadithStatus> {
    const collections: HadithStatus['collections'] = [];
    for (const { id } of HADITH_COLLECTIONS) {
      const data = await this.storage.read(id);
      if (data) collections.push({ id, count: data.entries.length, total: data.total, available: data.available, complete: data.nextPage === null, updated: data.updated, source:data.source ?? 'official-api' });
    }
    return { connected: !!await this.storage.key(), persistentKey: this.storage.persistentKey, downloading: this.progress, error: this.error, collections };
  }
  async connect(key: string) {
    if (this.controller) throw new Error('Cancel the current download before changing the connection.');
    const value = z.string().trim().max(1024).regex(/^[\x21-\x7e]*$/).parse(key);
    if (value) await this.request('/collections?limit=1&page=1', value, AbortSignal.timeout(20000));
    await this.storage.key(value); this.error = null; this.changed();
  }
  async read(id: string) { return this.storage.read(collectionId.parse(id)); }
  async remove(id: string) {
    collectionId.parse(id);
    if (this.progress?.id === id) throw new Error('Cancel this download before removing it.');
    await this.storage.write(id, null); this.changed();
  }
  cancel() { this.controller?.abort(); }
  async download(id: string) {
    if(this.pack)return this.downloadPack(id);
    return this.downloadOfficial(id);
  }
  private async downloadPack(id:string) {
    const meta=HADITH_COLLECTIONS.find(c=>c.id===collectionId.parse(id))!;
    if(this.controller)throw new Error('A collection is already downloading.');
    const controller=new AbortController();this.controller=controller;this.error=null;this.progress={id,count:0,available:meta.count};this.changed();
    try {
      const data=validateCommunityPack(id,await this.pack!(id,controller.signal));controller.signal.throwIfAborted();
      // Atomic replacement: cancellation or a bad pack never removes an existing download.
      await this.storage.write(id,data);
    } catch(error) {if(!controller.signal.aborted)this.error=error instanceof z.ZodError?'The collection pack failed validation. Existing readings are unchanged.':String(error).replace(/^Error: /,'');}
    finally {this.controller=null;this.progress=null;this.changed();}
  }
  async downloadOfficial(id: string) {
    collectionId.parse(id);
    if (this.controller) throw new Error('A collection is already downloading.');
    const key = await this.storage.key(); if (!key) throw new Error('Connect your Sunnah.com API key first.');
    const controller = new AbortController(); this.controller = controller; this.error = null;
    this.progress = { id, count: 0, available: 0 }; this.changed();
    try {
      const meta = z.object({ name: z.literal(id), totalHadith: z.number().int().min(0), totalAvailableHadith: z.number().int().min(0) }).parse(await this.request(`/collections/${id}`, key, controller.signal));
      if (!meta.totalAvailableHadith) throw new Error('This collection is not currently available through the Sunnah.com API.');
      const existing = await this.storage.read(id);
      const resume = existing && existing.nextPage !== null && existing.available === meta.totalAvailableHadith && existing.total === meta.totalHadith;
      let data: DownloadedHadith = resume ? existing : { id, total: meta.totalHadith, available: meta.totalAvailableHadith, nextPage: 1, entries: [], updated: new Date().toISOString() };
      const entries = new Map(data.entries.map(e => [e.hadithNumber, e]));
      const visited = new Set<number>();
      while (data.nextPage !== null) {
        controller.signal.throwIfAborted();
        const page = data.nextPage;
        if (visited.has(page) || visited.size >= 1500) throw new Error('The API returned an invalid page sequence.'); visited.add(page);
        const response = z.object({ data: z.array(narrationSchema).max(100), next: z.number().int().positive().nullable(), total: z.number().int().nonnegative() }).parse(await this.request(`/hadiths?collection=${id}&limit=100&page=${page}`, key, controller.signal));
        if (response.next !== null && (response.next <= page || !response.data.length)) throw new Error('The API returned an invalid next page.');
        for (const row of response.data) { if (row.collection !== id) throw new Error('The API returned a different collection.'); entries.set(row.hadithNumber, row); }
        if (entries.size > 100000) throw new Error('Collection download exceeds the supported size.');
        data = { ...data, entries: [...entries.values()], nextPage: response.next, updated: new Date().toISOString() };
        await this.storage.write(id, data);
        this.progress = { id, count: entries.size, available: data.available }; this.changed();
        // Sequential requests keep load modest and make cancellation responsive.
        if (data.nextPage !== null) await new Promise<void>(resolve => { const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); }; const timer = setTimeout(finish, 250); controller.signal.addEventListener('abort', finish, { once: true }); });
      }
      if (entries.size < data.available) { this.error = 'The API returned fewer entries than advertised. Saved entries are readable; coverage is shown below.'; }
    } catch (error) {
      if (!controller.signal.aborted) this.error = error instanceof z.ZodError ? 'Sunnah.com returned an unsupported response. Previously downloaded entries are safe.' : String(error).replace(/^Error: /, '');
    } finally { this.controller = null; this.progress = null; this.changed(); }
  }
  private async request(path: string, key: string, signal: AbortSignal): Promise<unknown> {
    const response = await this.fetcher(`https://api.sunnah.com/v1${path}`, { headers: { 'X-API-Key': key, Accept: 'application/json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]), redirect: 'error' });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Sunnah.com did not accept this API key.' : response.status === 404 ? 'This collection is not currently available through the Sunnah.com API.' : response.status === 429 ? 'Sunnah.com request limit reached. Resume the download later.' : `Sunnah.com request failed (${response.status}). Resume the download later.`);
    const text = await response.text(); if (text.length > 15000000) throw new Error('The API response was too large.');
    try { return JSON.parse(text); } catch { throw new Error('Sunnah.com returned an unreadable response.'); }
  }
}
