"""Basic smoke checks without requiring a running service or external datasets."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app.phase2 import haversine_km, AuditLedger
assert abs(haversine_km((0,0),(0,1))-111.195)<1
ledger=AuditLedger(ROOT/'data'/'smoke_test_audit.db')
ledger.append('SMOKE','C-101','tester','test',{'note':'smoke'})
assert ledger.verify()['valid']
print('smoke checks passed')
