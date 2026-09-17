"""Rebuild the twelve selected readings from their saved individual Sunnah.com pages."""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re

class NarrationParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.active = {}
        self.text = {'arabic': [], 'english': []}

    def handle_starttag(self, tag, attrs):
        if tag == 'div':
            self.depth += 1
            classes = dict(attrs).get('class', '').split()
            for kind, name in [('arabic', 'arabic_hadith_full'), ('english', 'english_hadith_full')]:
                if name in classes:
                    assert not self.text[kind], 'Expected exactly one narration per page'
                    self.active[kind] = self.depth
        if tag in ('p', 'br', 'div'):
            for kind in self.active:
                self.text[kind].append('\n')

    def handle_data(self, value):
        for kind in self.active:
            # HTML source wrapping is not a paragraph break.
            self.text[kind].append(re.sub(r'\s+', ' ', value))

    def handle_endtag(self, tag):
        if tag in ('p', 'div'):
            for kind in self.active:
                self.text[kind].append('\n')
        if tag == 'div':
            for kind in list(self.active):
                if self.active[kind] == self.depth:
                    del self.active[kind]
            self.depth -= 1

    def result(self, kind):
        lines = [re.sub(r'\s+', ' ', line).strip() for line in ''.join(self.text[kind]).splitlines()]
        return '\n\n'.join(line for line in lines if line)

path = Path('assets/devotion/hadiths.json')
items = json.loads(path.read_text(encoding='utf-8'))
metadata = {'source': 'https://sunnah.com', 'permission': 'https://sunnah.com/about#reproduction',
            'scope': 'Twelve individual narrations for reading and personal study; not a book or collection download.',
            'textPolicy': 'Original Arabic and published English wording, including narration context; only HTML markup and whitespace are normalized.', 'entries': []}
for item in items:
    raw = Path(f'tmp/sources/daily-{item["id"]}.html').read_bytes()
    parser = NarrationParser()
    parser.feed(raw.decode('utf-8'))
    item['arabic'] = parser.result('arabic')
    item['meaning'] = parser.result('english')
    item['wording'] = 'source-verbatim'
    assert len(item['arabic']) > 30 and len(item['meaning']) > 20, item['id']
    metadata['entries'].append({'id': item['id'], 'url': item['url'], 'htmlSha256': hashlib.sha256(raw).hexdigest(),
        'arabicSha256': hashlib.sha256(item['arabic'].encode()).hexdigest(), 'englishSha256': hashlib.sha256(item['meaning'].encode()).hexdigest()})
path.write_text(json.dumps(items, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
path.with_name('hadith-sources.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Preserved source Arabic and English for all twelve narrations.')
