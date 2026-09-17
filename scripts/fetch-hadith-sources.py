"""Fetch pinned inputs for build-hadith-catalogue.py (Python standard library only)."""
import hashlib, json, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'tmp/hadith-research';DEST.mkdir(parents=True,exist_ok=True)
manifest=json.loads((ROOT/'assets/hadith/manifest.json').read_text(encoding='utf-8'))
sources=manifest['sources'];hashes=manifest['inputSha256']

def fetch(name,url):
    path=DEST/name
    if path.exists() and name in hashes and hashlib.sha256(path.read_bytes()).hexdigest()==hashes[name]:return
    request=urllib.request.Request(url,headers={'User-Agent':'Athan-source-importer','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(request,timeout=120) as response:data=response.read()
    if name in hashes and hashlib.sha256(data).hexdigest()!=hashes[name]:raise ValueError(f'{name}: upstream checksum changed')
    path.write_bytes(data);print(name,flush=True)

for key,source in sources.items():
    (DEST/f'{key}-commit.json').write_text(json.dumps({'sha':source['revision']}),encoding='utf-8')
cheese=sources['cheese'];fetch('cheese.zip',f'https://codeload.github.com/CheeseWithSauce/HadithsJSONFormat/zip/{cheese["revision"]}')
fetch('collections-json-v1.1.0.zip','https://github.com/Jaguar16/open-hadith-data/releases/download/v1.1.0/collections-json.zip')
sehal=sources['sehal'];revision=sehal['revision'];base=f'https://raw.githubusercontent.com/sehalhussain/Hadith-Dua-assets/{revision}'
fetch('sehal-tree.json',f'https://api.github.com/repos/sehalhussain/Hadith-Dua-assets/git/trees/{revision}?recursive=1')
tree=json.loads((DEST/'sehal-tree.json').read_text(encoding='utf-8'))['tree']
for filename in hashes:
    if not filename.endswith('.db'):continue
    remote='muslim_hadith_db_with_reference.db' if filename=='sehal-muslim.db' else filename
    matches=[e['path'] for e in tree if e['path'].split('/')[-1]==remote]
    if len(matches)!=1:raise ValueError(f'Ambiguous source path for {remote}: {matches}')
    fetch(filename,base+'/'+urllib.parse.quote(matches[0]))
fetch('sehal-README.md',base+'/README.md')
fetch('jaguar-DATA_LICENSE.md',f'https://raw.githubusercontent.com/Jaguar16/open-hadith-data/{sources["jaguar"]["revision"]}/DATA_LICENSE.md')
