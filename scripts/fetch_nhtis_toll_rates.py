'''
fetch_nhtis_toll_rates.py
─────────────────────────────────────────────────────────────────────────
Fetches authoritative, current toll rate data directly from NHAI's own
National Highways Toll Information System (NHTIS) at tis.nhai.gov.in.

WHY THIS INSTEAD OF GOOGLE SEARCH PER TOLL:
You have 1,185+ toll plazas in your dataset. There is no practical way to
verify each one via individual Google searches - rates are published as
separate per-plaza gazette notifications (over a thousand distinct
documents across years), not one searchable source. NHTIS is NHAI's own
live system and the actual source those gazette notifications come from -
this is the correct bulk source, confirmed via the open-source
geohacker/toll-plazas-india project which scrapes this exact endpoint.

I can't run this myself - tis.nhai.gov.in isn't reachable from my
sandbox's network - so run it locally.

Usage:
    pip install requests
    python fetch_nhtis_toll_rates.py

Output:
    nhtis_raw.json — every toll plaza NHTIS knows about, with current
    official rates by vehicle class. Cross-reference this against your
    existing js/shared/tollSeedData.js by plaza name + lat/lng proximity
    to update rates in bulk instead of one at a time.
'''
import requests
import json
import time

NHTIS_ENDPOINT = "http://tis.nhai.gov.in/TollPlazaService.asmx/GetTollPlazaInfoForMapOnPC"

HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "http://tis.nhai.gov.in/map1.htm",
    "X-Requested-With": "XMLHttpRequest",
}

def fetch_all_plazas():
    print("Fetching plaza list from NHTIS...")
    resp = requests.post(NHTIS_ENDPOINT, headers=HEADERS, data="", timeout=30)
    resp.raise_for_status()
    data = resp.json()
    with open("nhtis_raw.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved nhtis_raw.json")
    return data

def fetch_plaza_detail(plaza_id):
    '''Individual plaza detail page has the full per-vehicle-class rate
    table. Only needed if the bulk endpoint doesn't include rates inline -
    check nhtis_raw.json's structure first before looping this over all
    1,185 plazas (that WOULD take a while - rate-limit yourself, e.g.
    time.sleep(0.5) between calls, if you do need to loop it).'''
    url = f"http://tis.nhai.gov.in/TollInformation?TollPlazaID={plaza_id}"
    resp = requests.get(url, headers=HEADERS, timeout=15)
    return resp.text

if __name__ == "__main__":
    plazas = fetch_all_plazas()
    print(f"Retrieved {len(plazas) if isinstance(plazas, list) else '?'} plaza records.")
    print("Next: inspect nhtis_raw.json's structure, then write a matching")
    print("script against your tollSeedData.js (match on name + lat/lng)")
    print("to bulk-update rates instead of touching each entry by hand.")
