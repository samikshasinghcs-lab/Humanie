import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

INDICATORS = {
    "undernourishment_pct": "SN.ITK.DEFC.ZS",
    "population": "SP.POP.TOTL",
    "gdp_pc_ppp_2021": "NY.GDP.PCAP.PP.KD",
    "unemployment_pct": "SL.UEM.TOTL.ZS",
}
BASE = "https://api.worldbank.org/v2/country/all/indicator/{code}"
session = requests.Session()
session.headers.update({"User-Agent": "HUMANIE-Research-Demo/0.2 (educational use)"})

def fetch(code):
    url = BASE.format(code=code)
    params = {"format": "json", "per_page": 20000, "date": "2000:2024"}
    response = session.get(url, params=params, timeout=90)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list) or len(payload) < 2:
        raise RuntimeError(f"Unexpected World Bank API response for {code}: {payload}")
    rows = []
    for item in payload[1] or []:
        country = item.get("country") or {}
        region = (item.get("region") or {}).get("id")
        iso3 = item.get("countryiso3code")
        if not iso3 or len(iso3) != 3 or region == "NA":
            continue
        rows.append({"iso3": iso3, "country": country.get("value"), "year": int(item["date"]), "value": item.get("value")})
    return pd.DataFrame(rows), response.url

frames = []
urls = {}
for name, code in INDICATORS.items():
    frame, url = fetch(code)
    frame = frame.rename(columns={"value": name})
    frames.append(frame)
    urls[name] = url

merged = frames[0]
for frame in frames[1:]:
    merged = merged.merge(frame[["iso3", "year", frame.columns[-1]]], on=["iso3", "year"], how="outer", suffixes=("", "_dup"))
    if "country_dup" in merged:
        merged["country"] = merged["country"].fillna(merged["country_dup"])
        merged = merged.drop(columns=["country_dup"])
merged = merged.sort_values(["iso3", "year"])
merged.to_csv(DATA / "world_bank_country_year.csv", index=False)

manifest = {
    "dataset": "World Bank Indicators API country-year panel",
    "downloaded_at_utc": datetime.now(timezone.utc).isoformat(),
    "api_base": "https://api.worldbank.org/v2/",
    "indicator_codes": INDICATORS,
    "request_urls": urls,
    "row_count": int(len(merged)),
    "non_null_counts": {c: int(merged[c].notna().sum()) for c in INDICATORS},
    "target_source": "FAO, exposed through World Bank WDI indicator SN.ITK.DEFC.ZS",
    "target_definition": "Prevalence of undernourishment (% of population), national-level model-based estimate",
    "target_limitations": "National indicator; cannot identify individuals or generally provide subnational estimates.",
    "license": "World Bank Data license CC BY 4.0; verify source-specific attribution and terms before redistribution.",
    "data_quality": "Missing observations are preserved as null; country aggregates are excluded.",
}
(DATA / "data_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(f"Saved {len(merged):,} country-year rows to {DATA / 'world_bank_country_year.csv'}")
print(json.dumps(manifest["non_null_counts"], indent=2))
