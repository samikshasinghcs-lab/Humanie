import pytest
from app.extraordinary_upgrade import AuditLedger, Governance, Community, allocation, sensitivity

def test_audit_chain_detects_valid_chain(tmp_path):
    ledger=AuditLedger(str(tmp_path/'audit.db'))
    ledger.append('EVENT','case-1','actor-1','operator',{'x':1})
    assert ledger.verify()['valid'] is True
    assert ledger.verify()['records']==1

def test_governance_requires_distinct_reviewer_and_approver(tmp_path):
    ledger=AuditLedger(str(tmp_path/'audit.db')); gov=Governance(ledger)
    gov.review('case-1','reviewer','reviewer','reviewed evidence')
    with pytest.raises(PermissionError):
        gov.decide('case-1','reviewer','approver','approve','provider',2,'reason')
    result=gov.decide('case-1','approver','approver','approve','provider',2,'reason')
    assert result['kind']=='ALLOCATION_APPROVE'

def test_floor_allocation_feasibility_and_result():
    nodes=[Community('A',100,90,2),Community('B',100,50,3)]
    result=allocation(nodes,150,400,.25)
    assert result['feasible'] is True
    assert result['min_community_coverage_pct'] >= 25

def test_sensitivity_is_seeded_and_repeatable():
    cs=[{'id':'a','x':1,'y':0},{'id':'b','x':0,'y':1}]
    first=sensitivity(cs,{'x':1,'y':0},draws=50)
    second=sensitivity(cs,{'x':1,'y':0},draws=50)
    assert first==second
