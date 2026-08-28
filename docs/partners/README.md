# Provider inclusion policy

Blueballs keeps its canonical banking and FX contracts provider-neutral. Named
companies can appear in the research directory and in optional adapter
descriptors without becoming dependencies of the core.

Two statuses are always separate:

- **Relationship:** whether Blueballs claims a commercial relationship. The
  current repository claims none.
- **Technical maturity:** `Link only` or `Included descriptor`. Neither means
  integrated, sandbox-verified or production-evidenced.

An included descriptor is a source-cited mapping exercise with zero provider
HTTP calls. It exists to make future adapter work reviewable. A logo, link,
sandbox listing or module mapping must never be read as endorsement,
partnership, certification or production readiness.

Current included descriptors:

- [Dakota](./DAKOTA.md)
- [Bridge](./BRIDGE.md)
