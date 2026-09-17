"""Build optional, reproducible collection packs from pinned community snapshots.

No positional joins: enrichment requires identical normalized Arabic/English text.
Source records and reference strings are retained; missing metadata stays missing.
"""
import gzip, hashlib, html, json, re, sqlite3, unicodedata, zipfile
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / 'tmp/hadith-research'
OUTPUT = ROOT / 'assets/hadith'
OUTPUT.mkdir(parents=True, exist_ok=True)
def load(name): return json.loads((INPUT/name).read_text(encoding='utf-8'))
def sha(value): return hashlib.sha256(value).hexdigest()
def natural_number(value):
    return tuple((0,int(p)) if p.isdigit() else (1,p.lower()) for p in re.findall(r'\d+|[^\d]+',value))
def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', '', str(value or '')))).strip()
def match_text(value):
    value = unicodedata.normalize('NFKD', clean(value))
    return ''.join(c.lower() for c in value if c.isalnum() and not unicodedata.combining(c))
def valid_grade(value):
    value=clean(value)
    # One source accidentally stores the reference in its grade column.
    return value if re.search(r'sahih|hasan|da.?if|weak|mawdu|صحيح|حسن|ضعيف', value, re.I) and not re.match(r'^(?:Grade\s*:\s*)?Sahih (?:Muslim|al-Bukhari)\b', value) else ''
def grade(value, source):
    value=valid_grade(value)
    if not value:return []
    return [{'grade':value,'graded_by': (re.search(r'\(([^)]+)\)',value).group(1) if re.search(r'\(([^)]+)\)',value) else ''),'source':source}]

sources = {
 'cheese': {'name':'CheeseWithSauce/HadithsJSONFormat', 'url':'https://github.com/CheeseWithSauce/HadithsJSONFormat', 'revision':load('cheese-commit.json')['sha'], 'license':'MIT', 'role':'Full Arabic/English records, collection/book references and grades'},
 'sehal': {'name':'sehalhussain/Hadith-Dua-assets', 'url':'https://github.com/sehalhussain/Hadith-Dua-assets', 'revision':load('sehal-commit.json')['sha'], 'license':'Explicit reuse permission in README', 'role':'Additional variants, chapter titles, narrators, in-book and USC-MSA references'},
 'jaguar': {'name':'Jaguar16/open-hadith-data', 'url':'https://github.com/Jaguar16/open-hadith-data', 'revision':load('jaguar-commit.json')['sha'], 'release':'v1.1.0', 'license':'CC0 structure; source translation terms retained', 'role':'Collection authors, bilingual book/chapter metadata and content-matched isnad/matn fields'},
}
cheese=zipfile.ZipFile(INPUT/'cheese.zip'); jaguar=zipfile.ZipFile(INPUT/'collections-json-v1.1.0.zip')
meta={n[:-5]:json.loads(jaguar.read(n)) for n in jaguar.namelist() if n.endswith('.json') and n!='hisn.json'}
records=defaultdict(list); books=defaultdict(dict); skipped=[]
for cid,d in meta.items():
    for b in d.get('books') or []:
        books[cid][str(b['book_number'])]={'number':str(b['book_number']),'key':b.get('book_key'), 'name':b['name_en'],'arabic':b.get('name_ar') or '',
            'chapters':[{'id':str(c['chapter_number']),'name':c.get('name_en') or '', 'arabic':c.get('name_ar') or ''} for c in b['chapters']]}

def add(cid, number, book, ar, en, refs, url, provenance, title='', narrator='', raw_grade=''):
    if not clean(ar) and not clean(en):return
    entry={'collection':cid,'bookNumber':str(book),'hadithNumber':str(number),'reference':refs[0]['text'] if refs else str(number),
      'references':refs,'url':url,'provenance':[provenance],'narrator':clean(narrator),'hadith':[
        {'lang':'ar','body':clean(ar),'chapterTitle':'','grades':[]},
        {'lang':'en','body':clean(en),'chapterTitle':clean(title),'grades':grade(raw_grade,provenance['source'])}]}
    entry['hadith']=[t for t in entry['hadith'] if t['body']]
    records[cid].append(entry)

for path in sorted(cheese.namelist()):
    if not path.endswith('.json') or '/Sunnah/' not in path:continue
    cid=path.split('/')[2]
    if cid=='hisn':continue
    if cid=='forty':cid='nawawi40' if 'nawawi' in path else 'shahwaliullah40' if 'waliullah' in path else 'qudsi40'
    for i,row in enumerate(json.loads(cheese.read(path))):
        raw=clean(row.get('reference')); refparts=re.split(r'(Sunnah\.com reference|USC-MSA web \(English\) reference|Arabic/English book reference|In-book reference|English translation|Arabic reference|Reference)\s*:\s*',raw,flags=re.I)
        refs=[{'label':refparts[n].strip(),'text':refparts[n+1].strip(),'source':'cheese'} for n in range(1,len(refparts)-1,2)]
        if not refs: skipped.append({'file':path,'row':i,'reason':'No source reference'});continue
        canonical=next((r['text'] for r in refs if r['label'].lower()=='reference'),'')
        ib=next((r['text'] for r in refs if r['label'].lower()=='in-book reference'),'')
        book_match=re.search(r'Book\s+(\d+)',ib or raw,re.I)
        book=book_match.group(1) if book_match else '0'
        number_match=re.search(r'(\d+[a-z]?(?:\s*[,\-–]\s*(?:\d+[a-z]?|[a-z]))*)(?:\s|$)',canonical,re.I)
        number=number_match.group(1) if number_match else ''
        if cid in ['nawawi40','qudsi40','shahwaliullah40']:url=f'https://sunnah.com/{cid}:{number}'
        elif cid=='muslim' and ('Introduction' in raw):
            number='introduction'+number;url='https://sunnah.com/muslim/introduction';book='0'
        elif canonical and number:url=f'https://sunnah.com/{cid}:{re.match(r"\d+[a-z]?",number,re.I).group()}'
        else:
            preferred=next((r['text'] for r in refs if r['label'].lower() in ['sunnah.com reference','arabic/english book reference','in-book reference']),refs[0]['text'])
            m=re.search(r'Book\s+(\d+),?\s+Hadith\s+(\d+[a-z]?)',preferred,re.I)
            if not m:skipped.append({'file':path,'row':i,'reason':'Unrecognized reference','value':raw});continue
            book,number=m.groups();number=f'{book}/{number}'
            url=f'https://sunnah.com/{cid}/{number}' if cid!='darimi' else f'https://sunnah.com/darimi/{book}'
        add(cid,number,book,row.get('arabic'),row.get('english'),refs,url,{'source':'cheese','record':f'{path.split("/Sunnah/")[1]}#{i+1}'},raw_grade=row.get('grade'))

# Index exact source texts. These joins cannot silently move a grade or translation to another narration.
def text_key(entry,lang):return match_text(next((t['body'] for t in entry['hadith'] if t['lang']==lang),''))
def index_rows(rows):
    index=defaultdict(list)
    for e in rows:
        for lang in ['ar','en']:
            key=text_key(e,lang)
            if len(key)>35:index[(lang,key)].append(e)
    return index

sehal_files={'bukhari':'bukhari_hadith_db_with_reference.db','muslim':'sehal-muslim.db','riyadussalihin':'riyadassalihin_hadith_db_reference.db',
 'tirmidhi':'jami_at_tirmidhi.db','abudawud':'sunan_abi_dawud.db','nasai':'sunan_an_nasai.db','ibnmajah':'sunan_ibn_majah.db'}
for cid,file in sehal_files.items():
    db=sqlite3.connect(INPUT/file);db.row_factory=sqlite3.Row
    table=db.execute("select name from sqlite_master where type='table'").fetchone()[0]
    index=index_rows(records[cid])
    for row in db.execute(f'SELECT * FROM {table}'):
        row=dict(row); ar=clean(row['arabic_text']);en=clean(row['narrator']+' '+row['english_text'])
        candidates=index.get(('ar',match_text(ar)),[]) or index.get(('en',match_text(en)),[])
        # Repeated wordings in different books remain independent.
        candidates=[e for e in candidates if e['bookNumber']==str(row['book_num'])]
        key=str(row.get('raw_ref_key',row.get('sr_no')))
        provenance={'source':'sehal','record':f'{file}#{key}'}
        if not candidates and 'raw_ref_key' in row:
            intro=key.startswith('intro_'); number='introduction'+re.sub(r'\D','',key) if intro else key
            refs=[{'label':'Reference','text':row['local_num'],'source':'sehal'}]
            for field,label in [('in_book_reference','In-book reference'),('usc_msa_reference','USC-MSA reference')]:
                if row.get(field):refs.append({'label':label,'text':clean(row[field]),'source':'sehal'})
            add(cid,number,row['book_num'],ar,en,refs,'https://sunnah.com/muslim/introduction' if intro else f'https://sunnah.com/{cid}:{number}',provenance,title=row['title'],narrator=row['narrator'],raw_grade=row['grade'])
            candidates=[records[cid][-1]]
        for e in candidates:
            if provenance not in e['provenance']:e['provenance'].append(provenance)
            e['narrator']=clean(row['narrator'])
            if 'raw_ref_key' in row:
                title=clean(row['title']); e['chapterId']='title-'+sha(title.encode())[:12]
                for t in e['hadith']:
                    if t['lang']=='en':t['chapterTitle']=title
                b=books[cid].setdefault(e['bookNumber'],{'number':e['bookNumber'],'name':'Introduction','arabic':'المقدمة','chapters':[]})
                found=[c for c in b['chapters'] if match_text(c['name'].removeprefix('Chapter: '))==match_text(title.removeprefix('Chapter: '))]
                if len(found)==1:
                    e['chapterId']=found[0]['id']
                    for t in e['hadith']:
                        if t['lang']=='ar':t['chapterTitle']=found[0]['arabic']
                elif not any(c['id']==e['chapterId'] for c in b['chapters']):b['chapters'].append({'id':e['chapterId'],'name':title,'arabic':''})
            for t in e['hadith']:
                if t['lang']=='en' and not t['grades']:t['grades']=grade(row.get('grade'),'sehal')
            for field,label in [('in_book_reference','In-book reference'),('usc_msa_reference','USC-MSA reference')]:
                value=clean(row.get(field))
                if value and not any(r['text']==value for r in e['references']):e['references'].append({'label':label,'text':value,'source':'sehal'})
    db.close()

report={};catalogue=[]
for cid,d in meta.items():
    index=index_rows(records[cid]);enriched=0
    for b in d.get('books') or [{'hadiths':d.get('hadiths',[])}]:
        for h in b['hadiths']:
            candidates=index.get(('ar',match_text(h['text_ar'])),[]) or index.get(('en',match_text(h['text_en'])),[])
            for e in candidates:
                if 'book_number' in b and e['bookNumber']!=str(b['book_number']):continue
                e['structure']={k:clean(h.get(k)) for k in ['isnad_ar','isnad_en','matn_ar','matn_en','closing_ar','source_reference','source_grade'] if h.get(k)}
                e['provenance'].append({'source':'jaguar','record':f'{cid}/{b.get("book_number",0)}/{h["hadith_number"]}'})
                for t in e['hadith']:
                    if not t['grades']:t['grades']=grade(h.get('grade_ar' if t['lang']=='ar' else 'grade_en'),'jaguar')
                enriched+=1
    # Collapse exact repeated source rows only when reference + book + both texts agree.
    unique={};duplicates=0
    for e in records[cid]:
        key=(e['bookNumber'],e['hadithNumber'],text_key(e,'ar'),text_key(e,'en'))
        if key in unique:
            unique[key]['provenance']+=e['provenance'];duplicates+=1
        else:unique[key]=e
    entries=list(unique.values()); ids=set()
    for e in entries:
        eid=f'{cid}:{e["hadithNumber"]}'
        if eid in ids:eid+=':'+sha(json.dumps(e,ensure_ascii=False).encode())[:12]
        ids.add(eid);e['id']=eid
        e['provenance']=list({(p['source'],p['record']):p for p in e['provenance']}.values())
        # Keep explicit content language coverage, never insert a generated translation.
        e['missingEnglish']=not any(t['lang']=='en' and t['body'] for t in e['hadith'])
    entries.sort(key=lambda e:(int(e['bookNumber']),natural_number(e['hadithNumber'])))
    assert entries and len(ids)==len(entries),cid
    data={'id':cid,'schemaVersion':2,'updated':'2026-09-17T00:00:00.000Z','total':len(entries),'available':len(entries),'nextPage':None,'entries':entries,
      'books':list(books[cid].values()),'source':'community','sources':sources,'collection':d['collection'],
      'coverageNote':'Source snapshots; missing chapters, grades or translations are shown as unavailable. Musnad Ahmad is partial in these Sunnah.com datasets.' if cid=='ahmad' else 'Source snapshots; missing chapters, grades or translations are shown as unavailable.'}
    raw=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode(); compressed=gzip.compress(raw,mtime=0)
    file=f'{cid}-{sha(compressed)[:12]}.json.gz';(OUTPUT/file).write_bytes(compressed)
    chapters=sum('chapterId' in e for e in entries);graded=sum(any(t['grades'] for t in e['hadith']) for e in entries)
    catalogue.append({'id':cid,'name':d['collection']['name_en'],'arabic':d['collection']['name_ar'],'count':len(entries),'books':len(books[cid]),'chapterMappings':chapters,'graded':graded,'bytes':len(compressed),'sha256':sha(compressed),'file':file,'partial':cid=='ahmad'})
    report[cid]={'entries':len(entries),'chapterMappings':chapters,'graded':graded,'missingEnglish':sum(e['missingEnglish'] for e in entries),'structuredMatches':enriched,'exactDuplicatesRemoved':duplicates}
    print(cid,len(entries),chapters,graded)
inputs={p.name:sha(p.read_bytes()) for p in [INPUT/'cheese.zip',INPUT/'collections-json-v1.1.0.zip',*(INPUT/n for n in sehal_files.values())]}
(OUTPUT/'manifest.json').write_text(json.dumps({'sources':sources,'inputSha256':inputs,'collections':catalogue},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUTPUT/'quality-report.json').write_text(json.dumps({'collections':report,'skipped':skipped},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'src/hadith-catalogue.ts').write_text('// Generated by scripts/build-hadith-catalogue.py\nexport const COMMUNITY_COLLECTIONS = '+json.dumps(catalogue,ensure_ascii=False,indent=2)+' as const;\n',encoding='utf-8')
(OUTPUT/'LICENSE-CheeseWithSauce.txt').write_bytes(cheese.read(next(n for n in cheese.namelist() if n.endswith('/LICENSE'))))
(OUTPUT/'LICENSE-Sehal.md').write_bytes((INPUT/'sehal-README.md').read_bytes())
(OUTPUT/'LICENSE-Jaguar.md').write_bytes((INPUT/'jaguar-DATA_LICENSE.md').read_bytes())
print('Total',sum(c['count'] for c in catalogue),'Skipped',len(skipped),'Compressed MB',round(sum(c['bytes'] for c in catalogue)/1e6,2))
