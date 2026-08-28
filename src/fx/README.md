# FX page source map

`../FxPage.tsx` is the public `/fx` entry point and renders `FinalFxPage.tsx`.
That is the only maintained FX page.

The page is split by responsibility:

- `FinalFxPage.tsx` owns state and composes the page;
- `FinalFxSectionsA.tsx`, `FinalFxSectionsB.tsx`, and `FinalFxSectionsC.tsx`
  render the product, market, settlement, treasury, lab, and evidence sections;
- `final-fx-definitions.ts`, `final-fx-engine.ts`, and
  `final-fx-scenarios.ts` define the website simulation;
- `FxProductBuilder.tsx` presents the builder-facing configuration surface;
- the remaining CSS files support only this route.

The website is a simulation. Runtime FX behavior lives in `apps/fx-node` and
the `packages/fx-*` modules. Product controls must not be described as live
pricing, executable liquidity, or settlement evidence unless they are wired to
that runtime and the response proves those properties.

Superseded page versions are available in Git history rather than duplicated in
the source tree.
