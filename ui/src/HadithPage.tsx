import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, ExternalLink, LoaderCircle, Search, Trash2, X } from 'lucide-react';
import { HADITH_COLLECTIONS, narrationId, narrationText, type DownloadedHadith, type HadithStatus } from '../../src/hadith-library.js';
import { getLanguage, tr } from './i18n/runtime';
import { Panel, useApp } from './shared';

const normalize = (text:string) => text.normalize('NFKD').replace(/[\p{M}\u0640]/gu,'').toLowerCase();
export function HadithPage() {
  const { act } = useApp();
  const [revision,setRevision]=useState(0);
  const [status,setStatus]=useState<HadithStatus|null>(null),[error,setError]=useState('');
  const [selected,setSelected]=useState('bukhari'),[data,setData]=useState<DownloadedHadith|null>(null);
  const [book,setBook]=useState('all'),[chapter,setChapter]=useState('all'),[query,setQuery]=useState(''),[number,setNumber]=useState(''),[limit,setLimit]=useState(100);
  const arabic=['ar','ur'].includes(getLanguage());
  useEffect(()=>{let live=true;const update=()=>window.athan.hadithStatus().then(s=>{if(live)setStatus(s);}).catch(e=>{if(live)setError(String(e));});void update();const timer=setInterval(()=>void update(),1500);return()=>{live=false;clearInterval(timer);};},[]);
  const saved=status?.collections.find(c=>c.id===selected);
  useEffect(()=>{let live=true;void window.athan.hadithRead(selected).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(String(e));});return()=>{live=false;};},[selected,saved?.updated,saved?.source,revision]);
  const choose=(id:string)=>{setSelected(id);setBook('all');setChapter('all');setQuery('');setNumber('');setData(null);setLimit(100);};
  const entries=useMemo(()=>data?.entries.filter(e=>(book==='all'||e.bookNumber===book)&&(chapter==='all'||(chapter==='unmapped'?!e.chapterId:e.chapterId===chapter))&&(!query||normalize(`${e.hadithNumber} ${e.reference??''} ${e.references?.map(r=>r.text).join(' ')} ${e.narrator??''} ${e.hadith.map(t=>`${t.chapterTitle} ${narrationText(t.body)} ${t.grades.map(g=>g.grade+' '+g.graded_by).join(' ')}`).join(' ')}`).includes(normalize(query))))??[],[data,book,chapter,query]);
  const current=entries.find(e=>narrationId(e)===number)??entries[0];
  const books=data?.books??[...new Set(data?.entries.map(e=>e.bookNumber))].map(number=>({number,name:tr('Book {0}',number),arabic:'',chapters:[]}));
  const selectedBook=books.find(b=>b.number===book),currentBook=books.find(b=>b.number===current?.bookNumber);
  const named=(item:{name:string;arabic:string})=>arabic&&item.arabic?item.arabic:item.name;
  const chapters=selectedBook?.chapters.filter(c=>data?.entries.some(e=>e.bookNumber===book&&e.chapterId===c.id))??[];
  const collection=HADITH_COLLECTIONS.find(c=>c.id===selected)!;
  return <>
    <Panel title="Your hadith library" subtitle="Choose the collections you would like to keep on this device.">
      <p className="devotion-note">Collection packs combine public Sunnah.com datasets. No API key is needed. Downloads stay on this device for offline reading.</p>
      <p className="devotion-note">Arabic and English source wording is preserved. Missing translations, chapter mappings and grades remain marked as unavailable.</p>
      <details className="hadith-sources"><summary>Sources and coverage</summary><p className="devotion-note">Records are matched by their text and references, never by row position. Musnad Ahmad is partial in the source catalogue.</p>
        <div className="export-actions">{[['cheese','CheeseWithSauce'],['sehal','Sehal Hussain'],['jaguar','Open Hadith Data']].map(([id,name])=><button key={id} className="text-button" onClick={()=>void act(()=>window.athan.hadithSource(`source:${id}`))}>{name}<ExternalLink size={13}/></button>)}</div>
      </details>
      {(error||status?.error)&&<p className="inline-warning" role="alert">{error||status?.error}</p>}
      {status?.downloading&&<div className="hadith-progress" role="status"><LoaderCircle className="spin" size={18}/><span>Preparing collection for offline reading…</span><button className="text-button" onClick={()=>void window.athan.hadithCancel()}><X size={14}/>Cancel download</button></div>}
    </Panel>
    <div className="hadith-collections">{HADITH_COLLECTIONS.map(c=>{const installed=status?.collections.find(s=>s.id===c.id);return <article key={c.id} className={`panel hadith-collection ${selected===c.id?'selected':''}`}>
      <button className="collection-title" onClick={()=>choose(c.id)}><BookOpen size={21}/><h3>{arabic?c.arabic:c.name}</h3></button>
      <p>{tr('{0} narrations · {1} MB',c.count,(c.bytes/1e6).toFixed(1))}</p><small>{c.partial?'Partial source collection':'Source catalogue snapshot'}</small>
      {installed&&<p className="installed-coverage">{tr('{0} saved on this device',installed.count)}{installed.source!=='community'&&<small>Legacy API download · refresh to use the collection pack</small>}</p>}
      <div><button className="text-button" disabled={!!status?.downloading} onClick={()=>{choose(c.id);setError('');void window.athan.hadithDownload(c.id).then(async()=>{setStatus(await window.athan.hadithStatus());setRevision(v=>v+1);}).catch(e=>setError(String(e)));}}><Download size={14}/>{installed?'Refresh':'Download'}</button><button className="text-button" onClick={()=>void act(()=>window.athan.hadithSource(c.id))}>Online<ExternalLink size={13}/></button>{installed&&<button className="icon-button" aria-label={`Remove downloaded ${c.name}`} disabled={!!status?.downloading} onClick={()=>void act(async()=>{await window.athan.hadithRemove(c.id);setStatus(await window.athan.hadithStatus());if(selected===c.id)setData(null);})}><Trash2 size={14}/></button>}</div>
    </article>;})}</div>
    <Panel title={arabic?collection.arabic:collection.name} subtitle={data?'Browse by book and chapter, or search wording, grades and references.':'Download this collection to read and search it offline, or open it online.'}>
      {data&&<>
        {data.collection&&<p className="devotion-note" data-source-text dir="auto">{arabic?data.collection.author_ar:data.collection.author_en}</p>}
        <div className="reading-filter hadith-filters"><label className="reading-search"><Search size={16}/><input aria-label="Search hadith" placeholder="Search wording, grade or reference…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(100);}}/></label>
          <select aria-label="Hadith book" value={book} onChange={e=>{setBook(e.target.value);setChapter('all');setNumber('');setLimit(100);}}><option value="all">All books</option>{books.map(b=><option key={b.number} value={b.number} data-source-text dir="auto">{b.number}. {named(b)}</option>)}</select>
          <select aria-label="Hadith chapter" value={chapter} disabled={book==='all'} onChange={e=>{setChapter(e.target.value);setNumber('');setLimit(100);}}><option value="all">All chapters</option>{chapters.map(c=><option value={c.id} key={c.id} data-source-text dir="auto">{named(c)}</option>)}<option value="unmapped">Chapter not supplied</option></select>
        </div>
        <div className="reading-layout"><div className="reading-index"><p>{entries.length} narrations</p><div>{entries.slice(0,limit).map(e=><button key={narrationId(e)} aria-pressed={current&&narrationId(current)===narrationId(e)} onClick={()=>setNumber(narrationId(e))}><span data-source-text dir="auto">{e.hadithNumber}. {narrationText(e.hadith.find(t=>t.lang===(arabic?'ar':'en'))?.chapterTitle??'')}</span><small>Book {e.bookNumber}</small></button>)}</div>{entries.length>limit&&<button className="text-button" onClick={()=>setLimit(n=>n+100)}>Show more</button>}</div>
          <article className="hadith-reader">{current?<>
            <h2 data-source-text dir="auto">{current.reference??`${collection.name} ${current.hadithNumber}`}</h2>
            {currentBook&&<p className="hadith-book-heading" data-source-text dir="auto">{named(currentBook)}</p>}
            {!current.chapterId&&<p className="devotion-note">Chapter not supplied</p>}
            {current.hadith.map((text,i)=><section key={`${text.lang}-${i}`}><h3 lang={text.lang} dir="auto">{narrationText(text.chapterTitle)}</h3><small className="pill">{text.lang==='ar'?'Original Arabic narration':text.lang==='en'?'Published English translation':text.lang}</small><p lang={text.lang} dir={['ar','ur'].includes(text.lang)?'rtl':'ltr'} className={text.lang==='ar'?'dua-arabic':''}>{narrationText(text.body)}</p>{text.grades.map((g,n)=><p className="devotion-note source-grade" data-source-text dir="auto" key={n}>{narrationText(g.grade)}{g.graded_by&&!g.grade.includes(g.graded_by)?` · ${g.graded_by}`:''}</p>)}</section>)}
            {!current.hadith.some(t=>t.grades.length)&&<p className="devotion-note">No grade supplied by the source</p>}
            {!current.hadith.some(t=>t.lang==='en')&&<p className="devotion-note">English translation unavailable in this source</p>}
            {current.references&&<div className="hadith-references"><h3>References</h3>{current.references.map((r,i)=><p key={i}><strong>{r.label}</strong><span data-source-text dir="auto">{r.text}</span></p>)}</div>}
            {current.structure&&Object.values(current.structure).some(Boolean)&&<details className="hadith-structure"><summary>Narration details</summary>{Object.entries(current.structure).filter(([,v])=>v).map(([k,v])=><div key={k}><h4>{({isnad_ar:'Arabic chain of narration',isnad_en:'Narrator introduction',matn_ar:'Arabic hadith text',matn_en:'English hadith text',closing_ar:'Closing narration',source_reference:'Source reference',source_grade:'Source grade'} as Record<string,string>)[k]??k}</h4><p lang={k.endsWith('_ar')?'ar':'en'} dir="auto">{v}</p></div>)}</details>}
            <button className="text-button" onClick={()=>void act(()=>window.athan.hadithSource(selected,narrationId(current)))}>Read on Sunnah.com<ExternalLink size={14}/></button>
            {current.provenance&&<details className="hadith-provenance"><summary>Record provenance</summary>{current.provenance.map((p,i)=><p key={i} data-source-text>{data.sources?.[p.source]?.name??p.source}<br/>{p.record}<br/>{data.sources?.[p.source]?.revision}</p>)}</details>}
          </>:<p>No matching readings</p>}</article>
        </div>
      </>}
    </Panel>
  </>;
}
