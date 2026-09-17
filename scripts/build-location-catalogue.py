"""Build the bundled GeoNames catalogue from official UTF-8 exports.

Download cities500.zip, countryInfo.txt and admin1CodesASCII.txt from
https://download.geonames.org/export/dump/ into .cache/geonames first.
Run from the project root: python scripts/build-location-catalogue.py
"""
import collections
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / '.cache' / 'geonames'
target = root / 'assets' / 'locations'
target.mkdir(parents=True, exist_ok=True)

def rows(filename):
    return (line.split('\t') for line in (source / filename).read_text(encoding='utf-8').splitlines()
            if line and not line.startswith('#'))

countries = {r[0]: r[4] for r in rows('countryInfo.txt') if r[0] not in ('AN', 'CS')}
regions = {r[0]: r[1] for r in rows('admin1CodesASCII.txt')}
cities = []
with zipfile.ZipFile(source / 'cities500.zip') as archive:
    for line in archive.read('cities500.txt').decode('utf-8').splitlines():
        r = line.split('\t')
        if r[8] not in countries or not r[17] or not -89.9 <= float(r[4]) <= 89.9:
            continue
        name = r[1]
        region = regions.get(r[8] + '.' + r[10], '')
        label = ', '.join(dict.fromkeys(part for part in (name, region) if part))
        if len(label) > 150:
            label = name[:150]
        aliases = ','.join(dict.fromkeys(part for part in (r[2] + ',' + r[3]).split(',') if part != name))
        cities.append([int(r[0]), label, r[8], float(r[4]), float(r[5]), r[17], aliases])

counts = collections.Counter(city[2] for city in cities)
metadata = {
    'version': 1,
    'generated': datetime.date.today().isoformat(),
    'source': 'https://download.geonames.org/export/dump/',
    'license': 'https://creativecommons.org/licenses/by/4.0/',
    'sha256': {name: hashlib.sha256((source / name).read_bytes()).hexdigest()
               for name in ('cities500.zip', 'countryInfo.txt', 'admin1CodesASCII.txt')},
    'cityCount': len(cities),
    'countries': sorted([{'code': code, 'name': name, 'cityCount': counts[code]}
                         for code, name in countries.items()], key=lambda c: c['name']),
}
(target / 'countries.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(target / 'cities.json.gz').write_bytes(gzip.compress(json.dumps(cities, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), mtime=0))
print(f"Built {len(cities):,} cities, {len(countries)} countries/territories ({len(counts)} with cities), "
      f"{(target / 'cities.json.gz').stat().st_size:,} compressed bytes")
