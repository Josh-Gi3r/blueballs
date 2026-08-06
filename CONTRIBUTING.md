# Contributing

Thanks for looking. This is a young project — read `SCOPE.md` and `PLAN-V3.md` first so you
know what's actually in scope right now versus deliberately deferred.

## Ground rules

1. **The contract is the product.** `spec/conventions.md` and `src/endpoints.ts` are frozen.
   If a change needs to touch either, open an issue and discuss it before writing code —
   changing them invalidates work in every resource family at once.
2. **Money is never a float.** Amounts are decimal strings with an explicit currency. Use the
   `toMinor` / `fromMinor` helpers in `apps/api/src/kernel.js`.
3. **Double-entry or it doesn't post.** Every ledger movement goes through `post()`. Entries
   that don't sum to zero are rejected — don't work around that.
4. **No vendor names.** Providers sit behind adapters. Don't name a third-party FX, KYC, or
   rail provider anywhere — code, comments, commit messages, or docs.
5. **One family, one file.** Each resource family lives in exactly one file under
   `apps/api/src/routes/`. Don't edit `kernel.js` or `server.js` to add a family — import from
   `kernel.js` and register routes with `route(...)`.
6. **Honest states, not generic errors.** Compliance holds, quote expiry, closed rails, tier
   blocks, refunds and reversals should be modelled as real states, not swallowed into a
   catch-all failure.

## Local dev

```bash
pnpm install
pnpm dev          # site :5280 + API :5290 together
pnpm exec tsc -b  # type-check the site before opening a PR
```

The API is Node stdlib + `node:sqlite` — no external services, no Docker.

## Adding an endpoint

1. Check `src/endpoints.ts` — if the route is catalogued but unimplemented, it currently
   answers a deliberate `501`. Implement it in the owning family's file under
   `apps/api/src/routes/`.
2. If the route isn't catalogued at all, that's a scope question — raise it before building,
   don't quietly extend the surface.
3. Run the server and hit your new route with `curl` or the docs page's "Try it" console
   before opening a PR.

## Reporting bugs / security issues

There's no public repo yet, so there's no issue tracker or disclosure address live either.
Both get set up as part of publishing — check back once this ships, or ask whoever gave you
this codebase directly.
