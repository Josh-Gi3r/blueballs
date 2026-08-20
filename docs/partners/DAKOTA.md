# Dakota capability mapping

Status as of 2026-08-20:

| Dimension | Status |
| --- | --- |
| Relationship | No relationship claimed |
| Technical maturity | Included descriptor; not connected |
| Network calls in Blueballs | None |
| Credential evidence | None |
| Sandbox verification | Not performed |
| Production evidence | None |

Dakota documents stablecoin-backed business accounts, wallets, on/off ramps and
global money movement. Its quickstart says dashboard access follows account
approval and then exposes sandbox credentials. That is a gated onboarding path,
not a self-serve integration Blueballs can claim to have tested.

Potential provider-neutral mappings:

| Dakota capability | Blueballs contract surface |
| --- | --- |
| Business/customer records | Customers, onboarding applications |
| Stablecoin-backed accounts | Accounts, receiving details |
| Wallets | Wallets, policies, approvals |
| On/off ramps and movement | Transfers, quotes, events |

Sources:

- Dakota documentation and access steps: <https://docs.dakota.xyz/>
- Dakota company site: <https://www.dakota.xyz/>

No code in the repository imports a Dakota SDK, sends Dakota HTTP requests or
claims schema compatibility. A future adapter requires approved access,
recorded sandbox evidence, webhook/reconciliation tests and a separate review.
