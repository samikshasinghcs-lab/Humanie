import tempfile, unittest
from pathlib import Path
from app.extraordinary_upgrade import AuditLedger, Governance, Community, allocation, sensitivity

class TestUpgrade(unittest.TestCase):
 def test_chain_and_tamper(self):
  with tempfile.TemporaryDirectory() as d:
   l=AuditLedger(Path(d)/"x.db"); l.append("TEST","C","a","role",{"x":1}); self.assertTrue(l.verify()["valid"])
   with l.connect() as c: c.execute("UPDATE audit_chain SET details='{}'"); c.commit()
   self.assertFalse(l.verify()["valid"])
 def test_separation(self):
  with tempfile.TemporaryDirectory() as d:
   g=Governance(AuditLedger(Path(d)/"x.db")); g.review("c","r","reviewer","notes")
   with self.assertRaises(PermissionError): g.decide("c","r","approver","approve","p",1,"why")
   g.decide("c","a","approver","approve","p",1,"why")
 def test_floor(self):
  ns=[Community("A",10,.8,1),Community("B",10,.2,2)]
  self.assertTrue(allocation(ns,15,20,.5)["feasible"])
  self.assertFalse(allocation(ns,5,5,.8)["feasible"])
 def test_sensitivity(self):
  res=sensitivity([{"id":"a","x":2},{"id":"b","x":1}],{"x":1},draws=20)
  self.assertEqual(res["baseline_top_candidate"],"a")
if __name__=="__main__": unittest.main()
