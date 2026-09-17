"""Build a numbered Hisn edition from the user-selected repository's pinned snapshot.
No web scraping is performed. Keep the source archive and its AGPL licence.
"""
from html.parser import HTMLParser
from pathlib import Path
from zipfile import ZipFile
import hashlib, json, re, sys
sys.stdout.reconfigure(encoding='utf-8')

class Node:
    def __init__(self, tag='', attrs=()): self.tag, self.attrs, self.children = tag, dict(attrs), []
    def has(self, name): return name in self.attrs.get('class', '').split()
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node): yield from child.walk()
    def find(self, cls): return [n for n in self.walk() if n.has(cls)]
    def text(self):
        return ''.join(c.text() if isinstance(c, Node) else c for c in self.children)
    def clean(self): return re.sub(r'\s+', ' ', self.text()).strip()

class Parser(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.root=Node(); self.stack=[self.root]
    def handle_starttag(self, tag, attrs):
        node=Node(tag, attrs); self.stack[-1].children.append(node)
        if tag not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']: self.stack.append(node)
        if tag == 'br': self.stack[-1].children.append('\n')
    def handle_endtag(self, tag):
        for index in range(len(self.stack)-1,0,-1):
            if self.stack[index].tag == tag: self.stack=self.stack[:index]; break
    def handle_data(self, data): self.stack[-1].children.append(data)

archive=Path('tmp/sources/hisn.zip'); z=ZipFile(archive) if archive.exists() else None
source=next(n for n in z.namelist() if n.endswith('sunnah-com-hisnu-al-muslim.html')) if z else 'source/packages/helpers/scripts/sunnah-com-hisnu-al-muslim.html'
source_bytes=z.read(source) if z else Path('assets/devotion/hisn/source-edition.html').read_bytes()
archive_hash=hashlib.sha256(archive.read_bytes()).hexdigest() if z else json.loads(Path('assets/devotion/hisn/source-metadata.json').read_text())['archiveSha256']
parser=Parser(); parser.feed(source_bytes.decode('utf-8'))
chapters=[]; items=[]; chapter=None
def text(node, cls): return '\n\n'.join(n.clean() for n in node.find(cls) if n.clean())
for node in parser.root.walk():
    if node.has('chapter'):
        number=int(re.sub(r'\D','',text(node,'echapno')))
        chapter={'number':number,'title':text(node,'englishchapter'),'arabicTitle':text(node,'arabicchapter')}
        chapters.append(chapter)
    if node.has('actualHadithContainer'):
        anchors=[n.attrs.get('href','') for n in node.walk() if n.tag=='a' and re.fullmatch(r'/hisn:\d+[a-z]?',n.attrs.get('href',''))]
        assert len(anchors)==1, (node.attrs, [n.attrs.get("href") for n in node.walk() if n.tag=="a"], text(node,"hadith_reference_sticky"))
        number=anchors[0].split(':')[1]; assert chapter
        meaning=text(node,'translation'); transliteration=text(node,'transliteration')
        englishInstructions=text(node,'hisn_english_instructions')
        if not meaning:
            details=node.find('text_details')[0]
            excluded={'transliteration','reference_label','hisn_english_reference'}
            def unmarked(n):
                if isinstance(n,str): return n
                if any(n.has(c) for c in excluded): return ''
                return ''.join(unmarked(c) for c in n.children)
            meaning=re.sub(r'\s+',' ',unmarked(details)).strip()
        arabic=text(node,'arabic_hadith_full')
        reference=text(node,'hisn_english_reference')
        items.append({'id':f'hisn-{number}','number':number,'chapter':chapter['number'],'category':f'chapter-{chapter["number"]}',
            'categoryName':chapter['title'],'title':chapter['title'],'arabicTitle':chapter['arabicTitle'],
            'arabic':arabic,'transliteration':transliteration,'meaning':meaning,'notes':englishInstructions or None,
            'reference':f'Hisn al-Muslim {number}'+(f' · {reference}' if reference else ''),
            'url':'https://sunnah.com'+anchors[0]})
assert len(chapters)==132, len(chapters)
assert len(items)==268, len(items)
assert {d['number'] for d in items} == {str(n) for n in range(1,268)} | {'75a'}
assert len({d['number'] for d in items}) == len(items)
print('entry count',len(items),'last',[d['number'] for d in items][-10:])
assert all(d['arabic'] and d['meaning'] and d['reference'] and d['url'] for d in items)
out=Path('assets/devotion/hisn'); out.mkdir(parents=True,exist_ok=True)
(out/'edition.json').write_text(json.dumps({'chapters':chapters,'duas':items},ensure_ascii=False,indent=2),encoding='utf-8')
(out/'source-edition.html').write_bytes(source_bytes)
if z: (out/'LICENSE-AGPL-3.0.txt').write_bytes(z.read(next(n for n in z.namelist() if n.endswith('/LICENSE'))))
(out/'source-metadata.json').write_text(json.dumps({'repository':'https://github.com/majmoo-io/hisnu-al-muslim-data','revision':'8786672f2a89115f13d5a27765066378993bd358','file':source.split('/',1)[1], 'archiveSha256':archive_hash,'source':'https://sunnah.com/hisn','licence':'AGPL-3.0','chapters':len(chapters),'entries':len(items)},indent=2),encoding='utf-8')
print(json.dumps({'chapters':len(chapters),'entries':len(items),'missingTransliterations':[d['number'] for d in items if not d['transliteration']]}))
