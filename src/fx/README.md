# FX page source map

`../FxPage.tsx` is the public `/fx` entry point and renders `FinalFxPage.tsx`.
That is the maintained Blueballs FX product page.

The route is split by responsibility:

- `FinalFxPage.tsx` owns interactive market state and page composition;
- `FinalFxSectionsA.tsx`, `FinalFxSectionsB.tsx`, and `FinalFxSectionsC.tsx` render the market, routing, privacy, settlement, treasury, scenario and inspector surfaces;
- `final-fx-definitions.ts`, `final-fx-engine.ts`, and `final-fx-scenarios.ts` provide the deterministic architecture-lab model;
- `FxProductBuilder.tsx` exposes the builder-facing configuration surface;
- the remaining CSS files support this route.

The interactive page is designed to make the Blueballs FX architecture visible: policy, source eligibility, exact pricing, reservation, execution planes, treasury controls and mixed finality. Canonical server-side execution lives in `apps/fx-node` and `packages/fx-*`, including adapter-driven production composition.

Market data presented by the architecture lab remains deterministic unless the page is explicitly wired to the runtime/provider data source. Keep that provenance clear while leading the public experience with implemented capabilities rather than internal development status.

Superseded page versions live in Git history rather than parallel source trees.
