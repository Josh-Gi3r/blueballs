# Blueballs

An MIT-licensed, self-hostable **open-source neobank stack**. Fork it, run it, and you have
the primitives a modern bank runs on — multi-currency accounts, issued cards, transfers,
savings, credit and FX — behind one API.

## Honest status

- **API: 144/144 catalogued endpoints respond.** Every endpoint either does the real thing
  or returns a deliberate `501` — never a generic 404 for something that just isn't wired up.
  (There is no endpoint returning 501 right now; the catalogue and the implementation match.)
- **App flows are not built.** This ships the API and a marketing/docs site, not consumer
  apps. The ~80 app flows across 18 domains described in `SCOPE.md` are explicitly deferred.
- **Statements: the PDF is a stand-in.** `POST /v2/statements` with `format: "pdf"` returns a
  base64-encoded plaintext string, not a rendered PDF binary. The response says so
  (`note` field). CSV and JSON exports are real.
- **Single-process only.** Storage is SQLite via Node's built-in `node:sqlite`, read into an
  in-memory cache per process. Fine for one API process; if you run more than one against the
  same database file, the in-memory cache won't see writes from the other process. There's no
  clustering story yet.
- **No licensed activity.** This is software, not a bank. There's no KYC vendor wired in beyond
  a sandbox-only hosted-redirect stub, and nothing here is regulated or insured.
- **Not yet published.** This repo doesn't have a public URL yet — that's a separate, deliberate
  step. Nothing on the site or in these docs points at a GitHub org, npm package, or domain that
  doesn't exist.

Read `SCOPE.md` for the full frozen scope and definition of done, and `PLAN-V3.md` for what's
still outstanding.

## Quickstart

Requires Node 22+ (for `node:sqlite`) and [pnpm](https://pnpm.io).

```bash
git clone <this repo>
cd blueballs
pnpm install
pnpm dev
```

That starts both processes:

- Site → http://localhost:5280
- API → http://localhost:5290/v2

Get a sandbox key — no signup form, no approval, no waiting:

```bash
curl -X POST http://localhost:5290/v2/auth/signup \
  -H "content-type: application/json" \
  -d '{"email":"you@example.com"}'

# → { "key": "bb_sandbox_…", "scope": "sandbox", "note": "…only time the key is shown." }
```

Use the key against any authenticated endpoint:

```bash
curl -X POST http://localhost:5290/v2/customers \
  -H "content-type: application/json" \
  -H "x-api-key: bb_sandbox_…" \
  -d '{"type":"individual","name":"Ada Lovelace"}'
```

Or skip the terminal entirely — the docs page (`/developers`) issues you a key and lets you
run every endpoint against the live API from the browser.

Only need one half of the stack?

```bash
pnpm dev:site   # vite only, :5280
pnpm dev:api    # API only, :5290
```

## Architecture

```
blueballs/
├─ src/              the site — marketing + full API docs, runs real requests
│                     against the live API (Vite + React, no framework magic)
├─ apps/api/          the API — Node stdlib only, SQLite via node:sqlite,
│                     zero runtime dependencies
│  └─ src/
│     ├─ kernel.js    frozen shared surface: route registry, money helpers,
│     │                identifiers, the RAILS/RATES reference tables
│     ├─ lib.js        storage primitives (SQLite-backed Map-shaped collections,
│     │                double-entry ledger, event log)
│     ├─ server.js     boots the HTTP server, wires the request pipeline,
│     │                auto-loads every family module in routes/
│     └─ routes/*.js   one file per resource family — each owns exactly one
│                      file so parallel work can't collide
├─ packages/          shared building blocks (money formatting, IBAN/ABA
│                     validation, ledger primitives) used by apps/api
├─ spec/conventions.md the frozen API contract every family is written against
└─ scripts/dev.mjs    starts the site and the API together for `pnpm dev`
```

Money is always a decimal string plus an explicit currency — never a float. Every ledger
posting is double-entry; entries that don't sum to zero are rejected. See
`spec/conventions.md` for the full contract.

## Contributing

See `CONTRIBUTING.md`.

## License

MIT — see `LICENSE`.
