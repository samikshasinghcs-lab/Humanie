from pathlib import Path
from app.phase2 import AuditLedger,haversine_km

def test_hash_chain_and_tamper(tmp_path):
 l=AuditLedger(tmp_path/'audit.db'); l.append('a','C-1','1','test',{'x':1}); l.append('b','C-1','1','test',{'x':2}); assert l.verify()['valid']
 with l.conn() as c: c.execute("UPDATE audit_chain SET details='tampered' WHERE seq=1")
 assert l.verify()['valid'] is False and l.verify()['altered_seq']==1

def test_haversine():
 assert round(haversine_km((0,0),(0,1)),1)==111.2
 assert haversine_km(None,(0,0)) is None
