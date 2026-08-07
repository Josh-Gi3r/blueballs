# FX architecture

The model, as agreed. Written down so it stops being re-derived from memory.

**In one line:** off-chain book · atomic on-chain settlement · 1:1 stablecoin ramps
replacing correspondent FX · liquidity from parties already long the currency, with the
operator as backstop · imbalance-priced deterministically · open-sourced so the liquidity
network compounds.

---

## 1. The trust boundary

| Layer | What lives there | Why |
|---|---|---|
| **Off-chain** | orderbook, matching, KYC/AML, accounts, ledger, LP management, address rotation | none of it needs to be trustless, and on-chain it would leak every customer's flow |
| **On-chain** | vault custody + the atomic swap | the only part where two parties who don't trust each other exchange value |

Do not put the book on-chain. There is nothing to gain and a customer-privacy problem to lose.

## 2. What the ramps actually replace

```
fiat in → [issuer mint 1:1] → stablecoin → [atomic swap] → stablecoin → [issuer redeem 1:1] → fiat out
        └── local rail ──┘                └── replaces ──┘             └── local rail ──┘
                                        CORRESPONDENT BANKING
```

Local on/off-ramps stay — they're cheap and fast. What dies is the correspondent middle:
SWIFT, nostro/vostro, two to three days, a spread at every hop.

**The honest pitch is "we replace correspondent FX", not "we replace banking."** That is
still the whole prize, because correspondent FX is where the money is made.

**Implemented:** `POST /v2/ramps/on`, `POST /v2/ramps/off` at 0 bps — no currency changes on
a ramp, so nothing is priced. Only the corridor carries a spread.

## 3. Privacy: opaque to the world, attributable to compliance

Rotating addresses makes a customer pseudonymous **to the public and to other LPs** — nobody
can cluster their flow. It does **not** hide them from the operator or the regulator: the
off-chain layer maps every address to a KYC'd identity.

That is not a weakness. It is precisely the profile a bank needs, and it should be described
that way rather than apologised for.

**Implemented:** peers see `ctp_…` pseudonyms; `taker_customer` is stripped from every
response; depth reports maker count *bands*, never a fingerprintable number.

## 4. Disclosure tiers — visibility scales with KYC role

Because every participant is verified, we can do what a permissionless venue cannot.

| Tier | Sees | Status |
|---|---|---|
| **Public** | aggregated netted depth per corridor, price levels, no identity, no per-order rows | ✅ `GET /v2/fx/depth` |
| **Permissioned** | a bank integrator gets firm quotes for its own flow (RFQ) | ❌ **not built** |
| **Private** | a maker sees only their own orders | ✅ |
| **Engine only** | the full L3 book | ✅ |

**Why aggregate depth is published rather than hidden:** anyone who can request a quote can
ladder sizes and reconstruct the depth curve anyway. Hiding it buys no privacy and costs
best-execution proof. What probing *cannot* recover — maker identity, resting and
out-of-range orders — stays private, and that privacy is therefore real.

## 5. Pricing is a thermostat, not a table

A corridor is never blocked, only priced. Spread is **derived** from live imbalance applied
to a reference mid — deterministic, so a bank can reproduce any quote it was given.

- Taking the scarce side costs more → pays whoever holds the hard currency
- Taking the abundant side costs less, and past 35% one-sidedness earns a **rebate** → pulls
  the correcting flow in with no intervention

**Verified:** balanced 4 bps → 100% one-sided 124 bps with the flow / 0 bps + 8 bps rebate
against it → counter-flow arrives → 28 bps. Self-corrected.

**Implemented:** `apps/api/src/pricing.js`, `GET /v2/fx/price` (public, so anyone can check
the arithmetic).

## 6. The fallback ladder

| | Source | Price |
|---|---|---|
| 1 | P2P match against a resting maker | tightest |
| 2 | LP fills | +25% |
| 3 | Operator fills as principal | +100% + markup |

A corridor is never dead — only expensive. **Principal appetite** is the one discretionary
knob and it belongs to the operator: max position per corridor and a markup for taking the
risk. At its limit the backstop **declines with a reason** rather than silently warehousing.

**Implemented:** `POST /v2/fx/intents` walks the ladder; `GET/PUT /v2/fx/appetite`.

## 7. Who provides liquidity, and why they aren't stuck

Two risks that are easy to conflate:

- **Passive-pool inventory risk** — funds sitting exposed, adversely selected. **This model
  does not have it.** Intents are signed off-chain and only lock at commit; there is no pool.
- **Flow imbalance** — survives, and lands on whoever is long. That is an economics fact.

It doesn't bite, because the LPs that matter are already long:

| LP | Position | Risk |
|---|---|---|
| **Stablecoin issuer** | its reserves *are* that currency | near zero — it's their business |
| **Bank from deposits** | already carries its customers' currency | monetises exposure it has anyway |
| **Speculative yield-only LP** | no native position, must round-trip | **real** — the only class that gets stuck |

The third class is the one that fails, and it's optional. Price the spread wide enough to pay
them for round-trip risk, or don't court them.

## 8. The flywheel

```
more neobanks on the stack → more deposit bases → more natively-long LPs
   → deeper two-sided book → tighter FX → more neobanks
```

This is why open-sourcing is strategically correct and not just ideological: every
participant becomes a native LP for the currency they already hold. The liquidity is the
network, and the network is everyone.

## 9. Netting

Liquidity covers the **net** imbalance, not the gross. This is the difference between needing
a balance sheet and needing a clearing house.

**Implemented:** `POST /v2/fx/net`. Note it only shows a saving when flow genuinely offsets —
a same-direction batch nets to zero saving, and the number should be read that way.

---

## Open decisions — Josh's calls, not the engine's

1. **Who holds the float?** The neobank (needs an EMI/bank licence or a BaaS partner per
   market), the stablecoin issuer, or a custodian. This one answer sets the entire
   regulatory posture. Nothing downstream is decidable until it is.
2. **Stablecoin coverage map.** FX quality is capped by which currencies have a redeemable
   1:1 stablecoin. USD and EUR are easy; the value is in thin corridors — MYR, SGD, THB, IDR,
   PHP. This is BD, not engineering.
3. **LP classes to court.** Resolved in principle (issuers + banks). Open: whether to court
   speculative LPs at all, and at what spread.
4. **Edge leg-risk.** ⚠️ **The swap is atomic; the fiat ramps are not atomic with it.** Fiat
   can land while a mint fails, or the rate can move between the two ramps. Someone bears
   that gap. Options: issuer guarantee, an escrow window, or a locked quote held across the
   whole route. **Not yet modelled in code.**

## Not built yet

- **RFQ tier** (§4) — firm quotes for a bank integrator's own flow
- **Edge leg-risk handling** (open decision 4) — the atomicity gap at the ramps
- **Self-hostable indexer** — resting-book aggregation, which quote-probing cannot reach
- **Batch auction** — discrete clearing windows; would let the book be lit safely. Proposed,
  not agreed.
- **Commit-reveal orders** — only if a specific integrator demands full dark. Deliberately
  deferred.
