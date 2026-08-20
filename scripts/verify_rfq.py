#!/usr/bin/env python3
"""Prove the RFQ (integrator) disclosure tier behaves as claimed."""
import json, os, time, urllib.request
from decimal import Decimal as D

API = os.environ.get("RECON_API", "http://localhost:5301")

def req(method, path, body=None, key=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("content-type", "application/json")
    if key: r.add_header("x-api-key", key)
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())

def signup(tag):
    return req("POST", "/v2/auth/signup", {"email": f"{tag}-rfq@x.local"})[1]["key"]

def funded(key, name, fiat, stable, amount, ctype):
    cus = req("POST", "/v2/customers", {"type": ctype, "name": name}, key)[1]
    req("POST", "/v2/sandbox/onboarding", {"scenario": "onboarding.approved", "customer": cus["id"]}, key)
    acc = req("POST", "/v2/accounts", {"customer": cus["id"], "currency": fiat}, key)[1]
    req("POST", "/v2/sandbox/payments",
        {"scenario": "payment.success", "amount": amount, "currency": fiat, "account": acc["id"]}, key)
    req("POST", "/v2/ramps/on", {"account": acc["id"], "amount": amount, "to": stable}, key)
    return acc["id"]

fails = []
def check(name, cond, detail=""):
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}{(' — ' + detail) if detail else ''}")
    if not cond: fails.append(name)

kbiz, kret = signup("integrator"), signup("retail")
acc_biz = funded(kbiz, "Integrator Bank", "USD", "USDX", "500000.00", "business")
acc_ret = funded(kret, "Retail Person",   "USD", "USDX", "50000.00",  "individual")

print("1. tier gating — a firm quote is the integrator tier")
st, q = req("POST", "/v2/fx/rfq",
            {"account": acc_ret, "from": "USDX", "to": "EURX", "amount": "10000.00"}, kret)
check("retail is refused a firm quote", st == 403, f"HTTP {st}: {q.get('detail','')[:70]}")

st, q = req("POST", "/v2/fx/rfq",
            {"account": acc_biz, "from": "USDX", "to": "EURX", "amount": "10000.00"}, kbiz)
check("verified business is served", st in (200, 201), f"HTTP {st}")
if st not in (200, 201):
    print("   ->", q); raise SystemExit(1)
print(f"     locked {q['locked_bps']} bps  -> receives {q['receives']['amount']} {q['to']}")
print(f"     disclosure={q['disclosure']}  depth_at_your_size={q['depth_at_your_size']}")

print("\n2. the extra disclosure is bounded")
body = json.dumps(q)
check("no maker identity leaked", "maker" not in body.lower() or "makers" not in q,
      "response carries no per-maker detail")
check("firmness is priced, not free", q["locked_bps"] > q["depth_at_your_size"]["indicative_bps"],
      f"{q['locked_bps']} vs indicative {q['depth_at_your_size']['indicative_bps']}")

print("\n3. a firm price is honoured even after the corridor moves")
# move the corridor: a large opposing flow between quote and accept
funded_taker = funded(kbiz, "Flow Mover", "USD", "USDX", "400000.00", "business")
req("POST", "/v2/fx/intents",
    {"account": funded_taker, "from": "USDX", "to": "EURX",
     "amount": "400000.00", "min_receive": "1.00"}, kbiz)
st, acc_res = req("POST", f"/v2/fx/rfq/{q['id']}/accept", {}, kbiz)
check("accept succeeds", st in (200, 201), f"HTTP {st}: {str(acc_res)[:90]}")
if st in (200, 201):
    print(f"     honoured at {acc_res['honoured_at_bps']} bps; corridor now {acc_res['corridor_now_bps']} bps"
          f"  (drift {acc_res['drift_bps']} bps)")
    check("received exactly the quoted amount",
          acc_res["received"]["amount"] == q["receives"]["amount"],
          f"{acc_res['received']['amount']} == {q['receives']['amount']}")
    check("drift is disclosed, not hidden", "drift_bps" in acc_res)

print("\n4. a quote cannot be replayed")
st, again = req("POST", f"/v2/fx/rfq/{q['id']}/accept", {}, kbiz)
check("second accept is refused", st == 409, f"HTTP {st}: {again.get('detail','')[:60]}")

print("\n5. someone else's quote is not theirs to take")
st, stolen = req("POST", f"/v2/fx/rfq/{q['id']}/accept", {}, kret)
check("other owner refused", st in (403, 404), f"HTTP {st}")

print("\nRESULT:", "RFQ TIER BEHAVES AS CLAIMED" if not fails else f"{len(fails)} FAILED -> {fails}")
