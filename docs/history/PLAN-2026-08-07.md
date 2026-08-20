# Blueballs — PLAN v3: what's left (scoped 2026-08-07)

Read `SCOPE.md` first. M1 (persistence) and M2 (144/144 endpoints) are done and committed.
This plan covers everything between here and a public repo someone can actually use.

**Rules unchanged:** evidence command per task · one owner per shared surface · scope changes
go through Josh · re-read the Design project each milestone · never name the FX provider.

**Metric shifts.** Endpoints-responding hit 100%, so it no longer measures anything.
The new headline metric is **untrue claims remaining on the site → 0**.

---

## M-TRUTH · Stop the site lying  ← highest priority, it's the only actively harmful thing
Every item below is a claim the site makes that isn't true. A public repo carrying these
is worse than no repo.

| # | Claim on the page | Reality | Fix | Evidence |
|---|---|---|---|---|
| T1 | `$4.2B settled` · `318k accounts` · `99.98% uptime` | invented | derive from the live ledger, or label "sample data" | tiles show real numbers or carry a visible SAMPLE badge |
| T2 | `4.1k ★` / `4.1K STARS` | invented | remove until the repo has stars | string absent from `src/` |
| T3 | `SOC 2 CONTROLS` | no audit exists | remove | string absent |
| T4 | `340MS QUOTES` | unmeasured | measure or remove | string absent or backed by a real timing |
| T5 | `CARDS ISSUED TODAY 12,408`, `SETTLED TODAY $12.4M` (ticker) | invented | drive from `/v2/events` + ledger, or label the ticker as sample | ticker values trace to an API call |
| T6 | `npm i @blueballs/sdk` | package doesn't exist | publish it, or change copy to the real clone-and-run | command in the docs actually works |
| T7 | `blueballs auth login` (CLI) | no CLI | remove or build | ditto |
| T8 | `api.blueballs.dev` | domain doesn't exist | show the real base URL | matches what TryIt calls |
| T9 | `github.com/blueballs`, `security@blueballs.dev` | neither exists | point at the real repo once it's up | links resolve |
| T10 | Hero FX widget | hardcoded rates | call `POST /v2/quotes` | widget shows a real quote id + expiry |
| T11 | Phone screens | static mock-ups | label as illustrative, or drive from the API | honest either way |

**Exit:** zero invented claims. Every number on the site is either real or visibly labelled.

---

## M3 · Backend's last structural gap
The state machine only walks the happy path. A bank integrating this can't handle a return.

| # | Task | Evidence |
|---|---|---|
| 3.1 | Exception branches: `in_review`, `compliance_hold`, `undeliverable`, `rejected`, `failed`, `timed_out`, `returned`, `reversed`, `refund_pending`, `refunded`, `refund_failed` | a transfer reaches `refund_failed` through the API |
| 3.2 | Webhook fires on every state change | listener receives `transfer.status_changed` for a reversal |
| 3.3 | Sandbox scenario per branch | forcing a compliance hold is one call |

---

## M-DOCS · The sidebar links that go nowhere
Six entries in the docs contents resolve to nothing: Overview, Authentication, Quickstart,
Errors, Webhooks, Self-hosting.

| # | Task | Evidence |
|---|---|---|
| D1 | Write those six sections | every sidebar link scrolls to real content |
| D2 | Per-endpoint request/response examples | each endpoint shows a real sample response |
| D3 | `spec/openapi.yaml` generated from the catalogue | spec validates; an SDK generates from it |

---

## M-SHIP · Make it public
| # | Task | Evidence |
|---|---|---|
| S1 | `README.md` — what it is, quickstart that works, honest status | a stranger can clone and run from it alone |
| S2 | `LICENSE` (MIT) | file present |
| S3 | `CONTRIBUTING.md` + `.env.example` | |
| S4 | One-command dev (`pnpm dev` runs site + API together) | single command, both up |
| S5 | **Banned-string sweep before push** | zero hits for the FX provider — currently 0, re-verify at push time |
| S6 | Push to GitHub | URL exists, clone works from clean |

**S6 is Josh's call — public vs private, and the repo name. Do not create a remote without it.**

---

## Sequencing
1. **M-TRUTH** — nothing else ships on top of a lying page
2. **M-SHIP S1–S5** — README/LICENSE/one-command, ready to publish
3. **M-DOCS D1–D2** — so the docs page is complete when people arrive
4. **M3** — correctness, matters for integrators not for launch
5. **D3 + FX adapter** — after

## Also outstanding
- **Design divergence:** the Design project still has one-product-per-row; the site now uses a
  responsive grid per Josh's instruction. Update the design or a re-sync will wipe it.
- `PersistentMap` read cache doesn't invalidate — fine at one process, not at two.
- PDF statements are a labelled plaintext stand-in.

## Progress log — PM updates this
| Date | Untrue claims | Milestone | Note |
|---|---|---|---|
| 2026-08-07 | 11 | M-TRUTH starting | scoped from a live audit of the running site |
| 2026-08-07 | 0 of 11 scoped (T1–T11 done) · ~7 more found outside scope | M-TRUTH done, M-SHIP S1–S5 done | T1–T11 all fixed and verified live (see report). Also fixed adjacent duplicate claims sharing the same fact (34→6 currencies in 3 more spots, fake Docker/Postgres self-hosting runbook claim, fake "production keys in 1 business day" + "maintainers respond Mon–Fri" on the contact page, invented Discord/Sponsorship counters). **Not fixed, flagged for a follow-up pass:** Products page — RAILS "11" (real: 6), PAIRS "340+" (unbacked), Transfers "FROM 4 SECONDS" (RAILS only says "seconds"), Vaults "3.9–7.2% AER" (code default is 3%, no range enforced), Credit "MAX LTV 62%" (code default is 80%) and "APR FROM 5.9%" (no APR field exists in the credit implementation at all); Products page rails chip list shows 14 rail names, only 6 exist in the RAILS registry; Bulletin page's 8 blog posts are fabricated editorial content. None of these were in the T1–T11 list — raised to Josh rather than silently expanding scope. S1–S5 also done: README, LICENSE, CONTRIBUTING.md, .env.example, `pnpm dev` runs site+API together, banned-string sweep is zero hits. |
