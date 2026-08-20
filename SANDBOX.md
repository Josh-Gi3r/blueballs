# Sandbox Builder

The Blueballs Builder turns a financial-product brief into a tenant-owned test
environment. It is a working sandbox flow, not a wait-list screen and not an
arbitrary code generator.

Open `http://localhost:5280/sandbox` after starting the repository with
`pnpm dev`.

## Product journey

1. **Brief** — name the product, describe its users, then choose markets,
   currencies, capabilities, rails and a simple brand direction.
2. **Blueprint** — inspect the structured product surface, provider model,
   commercial plan and protected-core boundary before anything is provisioned.
3. **Build** — create three approved test identities, up to nine currency
   accounts and exact opening balances for the authenticated tenant.
4. **Test** — send a simulated payment. The debit and offsetting credit pass
   through the same double-entry ledger used by the banking API.
5. **Launch** — connect deployment-owned identity, sponsor-bank, card, wallet,
   payment and compliance providers. This step is deliberately not automated by
   the public sandbox.

Projects, test users, accounts, balances and payment history survive API runtime
restarts. A direct project URL resumes the same environment for the same tenant.
Another tenant receives `404`, not a resource-existence disclosure.

## Builder API

All routes require a tenant sandbox key created through `/v2/auth/signup`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v2/builder/projects` | Validate a brief and create its blueprint |
| `GET` | `/v2/builder/projects` | List projects visible to the tenant |
| `GET` | `/v2/builder/projects/:id` | Resume one project |
| `PATCH` | `/v2/builder/projects/:id` | Revise an unprovisioned blueprint |
| `POST` | `/v2/builder/projects/:id/provision` | Provision deterministic test data once |
| `POST` | `/v2/builder/projects/:id/test-payments` | Settle a test payment through the ledger |

The generated banking OpenAPI includes the request and response contracts for
these operations.

### Minimal API flow

```bash
BASE=http://localhost:5290
KEY=$(curl -sS -X POST "$BASE/v2/auth/signup" \
  -H 'content-type: application/json' \
  -d '{"email":"builder@example.test"}' | jq -r .key)

PROJECT=$(curl -sS -X POST "$BASE/v2/builder/projects" \
  -H "x-api-key: $KEY" \
  -H 'content-type: application/json' \
  -d '{
    "name":"Maker Bank",
    "brief":"Accounts and cards for independent designers in Singapore",
    "audience":"Independent designers and small studios",
    "markets":["SG"],
    "currencies":["SGD","USD","USDX"],
    "capabilities":["accounts","onboarding","transfers","cards","fx"],
    "rails":["paynow","wire"]
  }')

PROJECT_ID=$(printf '%s' "$PROJECT" | jq -r .id)
curl -sS -X POST "$BASE/v2/builder/projects/$PROJECT_ID/provision" \
  -H "x-api-key: $KEY"
```

## Trust boundary

The builder may configure product presentation, customer journeys, branding,
product rules and provider-adapter choices. It cannot directly set a balance,
write a ledger row, alter idempotency state, change transaction state or reserve
FX liquidity. Provisioning and test payments cross trusted server routes and
post balanced ledger legs.

The browser stores no model credential. The current blueprint engine is
deterministic and structured; a deployer may connect a model through a
server-side adapter without giving generated output authority over the protected
financial core.

## Commercial and provider boundary

- The reference plan shown in the builder is free through 10,000 monthly active
  users.
- AI is bring-your-own; no model provider is silently bundled.
- Identity, bank, card, wallet, payment and other provider charges are
  pass-through deployment costs.
- Every included identity and rail record is simulated. No real money moves and
  no production provider relationship is implied.

Read [`KNOWN-LIMITATIONS.md`](KNOWN-LIMITATIONS.md), [`SECURITY.md`](SECURITY.md)
and [`ARCHITECTURE.md`](ARCHITECTURE.md) before extending the sandbox toward a
production deployment.
