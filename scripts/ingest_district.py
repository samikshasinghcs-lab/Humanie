"""Import district-locality CSV only when coordinates and provenance fields are provided.
CSV columns: district,locality,latitude,longitude,source,source_date,vulnerability_proxy
This script does not fabricate or fetch ward/census data.
"""
import csv,sys,json
from pathlib import Path
if len(sys.argv)<3: raise SystemExit('Usage: python scripts/ingest_district.py INPUT.csv OUTPUT.json')
rows=[]
with open(sys.argv[1],encoding='utf-8-sig',newline='') as f:
 for r in csv.DictReader(f):
  lat=float(r['latitude']); lon=float(r['longitude'])
  if not (-90<=lat<=90 and -180<=lon<=180): raise ValueError(f"Invalid coordinates: {r}")
  if not r.get('source') or not r.get('source_date'): raise ValueError('Every row must include source and source_date provenance.')
  rows.append({**r,'latitude':lat,'longitude':lon,'vulnerability_proxy':float(r.get('vulnerability_proxy') or 0)})
if not rows: raise SystemExit('No rows found.')
Path(sys.argv[2]).write_text(json.dumps({'rows':rows,'provenance_required':True},indent=2,ensure_ascii=False),encoding='utf-8')
print(f'Validated {len(rows)} locality records; import-ready, not independently verified.')
