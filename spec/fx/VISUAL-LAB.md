# Blueballs FX page contract

Status: **source-grounded product and technical overview**

The FX page explains the open-source FX infrastructure to technical and semi-technical builders. It answers what can be built, how an exchange moves through the system, which product and operating choices exist, which mechanisms are implemented and where the code lives.

It is not a customer story, a correspondent-banking lesson, a marketing campaign, an architecture catalogue or a disclaimer page.

## One runtime-backed exchange

One BRL to EUR response supplies every visible amount, allocation, capacity and state across the live parts of the page. React must not create a second pricing, policy, risk or settlement model.

Other route selectors may show their route shape, but they must not display an invented price. Stablecoin-to-stablecoin visibly removes fiat legs.

## Page sequence

1. **Products and routes** — fiat-to-fiat, fiat-to-stablecoin, stablecoin-to-fiat and stablecoin-to-stablecoin through one product and API.
2. **From request to settlement** — request, eligibility, candidates, exact-output plan, reservation, execution and reconciliation.
3. **Market and liquidity options** — customer and business orders, issuers, institutions, market makers, treasury, principal and connected sources; resting orders, inventory and firm quotes.
4. **Pricing, routing and risk** — executable prices, exact allocation, reservation state, reference availability and hard balance-sheet capacity.
5. **Private market and token settlement** — private identity, orders, pricing and limits above; selected policy-authorised fills below.
6. **Fiat settlement and operations** — provider, verified customer/business transfers, issuer and external peer-to-peer edges, each with its own finality and reconciliation.
7. **Implemented mechanisms** — current behaviour linked directly to source and adjacent tests.
8. **Inside the repository** — request and response beside the packages that implement the exchange.

## Interaction and visual language

- Use interactive HTML and CSS for system state. Do not use generated diagrams or page SVG.
- Keep a persistent transaction/status rail on desktop and inline evidence on mobile.
- Use the site's light product surface, navy implementation surface and restrained blue accent.
- Controls must change the route, source detail, scenario, amount or implementation detail they label.
- Avoid isolated capability cards and a sequence of architecture posters.
- Do not use `START / GROW / OWN` as a maturity story. Operating models are choices.
- Public prose does not use `reference`, `sandbox`, `seeded`, `preview`, `inspect the model` or similar self-describing demo language.

## Current source boundary

Current behaviour is grounded in:

- `apps/fx-node`
- `packages/fx-market`
- `packages/fx-liquidity`
- `packages/fx-pricing`
- `packages/fx-policy`
- `packages/fx-fiat`
- `packages/fx-contracts`
- `packages/fx-sdk`
- `packages/fx-simulator`

Do not restore legacy-only claims such as a public pricing thermostat, a never-dead corridor, advanced netting, fixed yield, universal spread distribution or the assertion that nothing locks before commit.

Peer is an external fiat-edge adapter. It is not part of the current atomic token kernel and must not be shown as a current commercial Blueballs connection.

## Accuracy rules

- A quote is not a fill.
- Submission is not confirmation.
- Token fills in one router transaction are atomic; external fiat legs retain external finality.
- Policy is checked again at execution.
- Outstanding reservations consume risk capacity.
- An incomplete route is refused.
- An ambiguous external submission is reconciled from canonical evidence and is not retried blindly.
- Generated participant data demonstrates the runtime; it does not imply a commercial integration.

## Review gate

Every FX page change must:

- pass the full repository FX test command and production build at the reviewed commit;
- render against the FX runtime;
- be reviewed at desktop and mobile widths;
- verify every meaningful control;
- contain no page-specific inline or imported SVG;
- contain no standalone disclaimer section;
- link differentiators to current source and tests.
