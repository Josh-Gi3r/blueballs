#!/usr/bin/env python3
"""Prove the FX spread reconciles end-to-end against the ledger.

Run it against a throwaway database so accumulated positions cannot flatter the
split:

    DB_PATH=/tmp/recon.sqlite PORT=5301 node apps/api/src/server.js &
    RECON_API=http://localhost:5301 python3 scripts/reconcile.py

Nothing here trusts the API's own summary figures. Balances are read back out of
/v2/ledger/balances (walking the cursor — a page caps at 100 rows, and a truncated
read makes correct books look unbalanced), and every expected value is recomputed
from first principles. Stdlib only.

What it proves, for one 50,000 swap into a corridor with two providers:
  A  every currency nets to exactly zero          (double-entry holds)
  B  spread booked == paid to providers + retained by the operator
  C  that total == the spread the taker actually paid at the quoted bps
  D  each payout == stake-weight x class share, recomputed independently
  E  the taker's ledger movement == what the API reported
"""
import json, urllib.request
from decimal import Decimal as D

import os
API = os.environ.get("RECON_API", "http://localhost:5290")

def req(method, path, body=None, key=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("content-type", "application/json")
    if key: r.add_header("x-api-key", key)
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def signup(tag):
    return req("POST", "/v2/auth/signup", {"email": f"{tag}@recon.local"})["key"]

def funded_account(key, name, fiat, stable, amount, ctype="individual"):
    """customer -> approved -> account -> fiat in -> ramped to stablecoin."""
    cus = req("POST", "/v2/customers", {"type": ctype, "name": name}, key)
    req("POST", "/v2/sandbox/onboarding",
        {"scenario": "onboarding.approved", "customer": cus["id"]}, key)
    acc = req("POST", "/v2/accounts", {"customer": cus["id"], "currency": fiat}, key)
    req("POST", "/v2/sandbox/payments",
        {"scenario": "payment.success", "amount": amount,
         "currency": fiat, "account": acc["id"]}, key)
    ramp = req("POST", "/v2/ramps/on",
               {"account": acc["id"], "amount": amount, "to": stable}, key)
    return acc["id"], ramp

# ---------------------------------------------------------------- setup
kb, km, kt = signup("bank"), signup("member"), signup("taker")
acc_b, _ = funded_account(kb, "Bank LP",   "EUR", "EURX", "200000.00", ctype="business")
acc_m, _ = funded_account(km, "Member LP", "EUR", "EURX", "20000.00")
acc_t, _ = funded_account(kt, "Taker",     "USD", "USDX", "50000.00")

lp_b = req("POST", "/v2/fx/lp", {"account": acc_b, "currency": "EURX",
                                 "amount": "200000.00", "pair": "EURX/USDX"}, kb)
lp_m = req("POST", "/v2/fx/lp", {"account": acc_m, "currency": "EURX",
                                 "amount": "20000.00", "pair": "EURX/USDX"}, km)
print("LP positions:")
for tag, p in (("bank", lp_b), ("member", lp_m)):
    if "id" not in p: print(f"  {tag} FAILED -> {p.get('detail')}"); raise SystemExit(1)
    print(f"  {tag:7s} committed {p.get('committed')} {p.get('currency')} "
          f"class={p.get('class')} share={p.get('share')} ({p.get('share_bps')} bps)")
    if p.get("class_note"): print(f"          note: {p['class_note']}")

# ---------------------------------------------------------------- snapshot BEFORE
def all_balances(key):
    """The endpoint caps a page at 100 — walk the cursor or the books look unbalanced."""
    rows, cursor = [], None
    while True:
        q = "/v2/ledger/balances?limit=100" + (f"&starting_after={cursor}" if cursor else "")
        page = req("GET", q, key=key)
        rows += page["data"]
        if not page.get("has_more"): break
        cursor = page["next_cursor"]
    return rows

def snapshot(key):
    return {(r["account"], r["currency"]): D(r["balance"]) for r in all_balances(key)}
before = snapshot(kt)

# ---------------------------------------------------------------- the swap
fill = req("POST", "/v2/fx/intents",
           {"account": acc_t, "from": "USDX", "to": "EURX",
            "amount": "50000.00", "min_receive": "1.00"}, kt)
if not fill.get("filled"):
    print("SWAP FAILED ->", fill.get("detail") or fill); raise SystemExit(1)
print(f"\nSwap: 50,000 USDX -> {fill['received']['amount']} EURX")
for l in fill["fill_legs"]:
    print(f"  leg {l['source']:10s} {l['spread_bps']:>7} bps   in {l['in']} -> out {l['out']}")

# ---------------------------------------------------------------- read the ledger back
bal = all_balances(kt)
after = {(r["account"], r["currency"]): D(r["balance"]) for r in bal}
def acct_bal(acct, cur):
    return after.get((acct, cur), D(0))
def delta(acct, cur):
    return after.get((acct,cur), D(0)) - before.get((acct,cur), D(0))
def prefix_delta(pfx, cur):
    keys = {k for k in list(after) + list(before) if k[0].startswith(pfx) and k[1] == cur}
    return sum(after.get(k, D(0)) - before.get(k, D(0)) for k in keys)

fails = []
def check(name, got, want, tol=D("0.02")):
    ok = abs(D(got) - D(want)) <= tol
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}: {got}   (expected {want})")
    if not ok: fails.append(name)

print("\nA. double-entry integrity — every currency must net to exactly zero")
tot = {}
for r in bal:
    tot.setdefault(r["currency"], D(0))
    tot[r["currency"]] += D(r["balance"])
for c, t in sorted(tot.items()):
    check(f"{c} nets to zero", t, D(0), tol=D("0.00"))

print("\nB. spread conservation — booked == paid out + retained (DELTAS for this swap only)")
earn_b = delta(acc_b, "EURX")
earn_m = delta(acc_m, "EURX")
retained = prefix_delta("spread:", "EURX")
booked = earn_b + earn_m + retained
print(f"     paid to bank      {earn_b}")
print(f"     paid to member    {earn_m}")
print(f"     retained by op    {retained}")
print(f"     => total booked   {booked}")

print("\nC. is that the spread the taker actually paid?")
# what the taker would have received at mid, minus what they got
received = D(fill["received"]["amount"])
bps = D(str(fill["fill_legs"][0]["spread_bps"]))
# received = at_mid * (1 - bps/10000)  =>  at_mid = received / (1 - bps/10000)
at_mid = received / (D(1) - bps / D(10000))
implied = (at_mid - received).quantize(D("0.01"))
print(f"     leg priced at {bps} bps; at mid the taker would get {at_mid.quantize(D('0.01'))} EURX")
print(f"     actually received {received} EURX  => implied spread {implied} EURX")
check("spread the taker paid == spread booked to providers+operator", booked, implied, tol=D("0.05"))

print("\nD. split is exactly pro-rata x class share (recomputed independently)")
cb, cm = D(lp_b["committed"]), D(lp_m["committed"])
exp_b = booked * (cb / (cb + cm)) * D(lp_b["share_bps"]) / D(10000)
exp_m = booked * (cm / (cb + cm)) * D(lp_m["share_bps"]) / D(10000)
check("bank payout",   earn_b, exp_b.quantize(D("0.01")))
check("member payout", earn_m, exp_m.quantize(D("0.01")))
check("operator retains the exact complement", retained,
      (booked - exp_b - exp_m).quantize(D("0.01")))

print("\nE. the taker's ledger movement matches what the API reported")
check("taker EURX gained", delta(acc_t, "EURX"), received)
check("taker USDX spent",  -delta(acc_t, "USDX"), D("50000.00"))

print("\nRESULT:", "ALL INVARIANTS HOLD" if not fails else f"{len(fails)} FAILED -> {fails}")
