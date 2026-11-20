"""HUMANIE v0.9 smoke checks. Run from project root: python scripts/smoke_test.py"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)
email = "smoke-v07@example.invalid"
password = "LocalOnly-Test-Password-123!"
r = client.post("/api/auth/register", json={"email": email, "password": password})
if r.status_code == 409:
    r = client.post("/api/auth/token", data={"username": email, "password": password})
assert r.status_code == 200, r.text
headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
for scenario in ("urban", "rural", "low_capacity"):
    response = client.get(f"/api/evaluation/allocation?scenario={scenario}&floor_pct=30", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["floor_sweep"]) == 11
    assert [x["floor_pct"] for x in data["floor_sweep"]] == list(range(0, 51, 5))
    assert data["floored"]["minimum_community_coverage_pct"] >= 29.99
    assert len(data["community_results"]) == 10
    for policy in ("baseline", "unconstrained", "floored"):
        assert data[policy]["allocated_units"] <= data["constraints"]["available_stock_units"] + 1e-5
        assert data[policy]["transport_cost"] <= data["constraints"]["transport_budget_cost_units"] + 1e-5
print("HUMANIE v0.9 API smoke checks passed for all three scenarios and floor sweeps.")
