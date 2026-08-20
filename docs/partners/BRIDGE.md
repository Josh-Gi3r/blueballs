# Bridge capability mapping

Status as of 2026-08-20:

| Dimension | Status |
| --- | --- |
| Relationship | No relationship claimed |
| Technical maturity | Included descriptor; not connected |
| Network calls in Blueballs | None |
| Credential evidence | None |
| Sandbox verification | Not performed |
| Production evidence | None |

Bridge documents customers, virtual accounts, liquidation addresses, transfers,
stablecoin orchestration and webhooks. Its general sandbox requires developer
onboarding. Bridge also documents important sandbox differences: payment objects
can contain dummy data, there is no real money movement, and payments-related
webhooks are not fired in that sandbox. Separate card-sandbox documentation may
have different webhook capabilities; evidence must therefore name the exact
product and environment tested.

Potential provider-neutral mappings:

| Bridge capability | Blueballs contract surface |
| --- | --- |
| Customers and KYC | Customers, onboarding applications |
| Virtual accounts | Accounts, receiving details |
| Transfers and liquidation addresses | Destinations, transfers |
| Stablecoin conversion | Quotes, FX adapter boundary |
| Webhooks | Events, webhook targets and deliveries |

Sources:

- Bridge sandbox setup and limitations: <https://apidocs.bridge.xyz/get-started/introduction/quick-start/setting-up-sandbox>
- Bridge authentication: <https://apidocs.bridge.xyz/api-reference/introduction/introduction>
- Bridge webhook overview: <https://apidocs.bridge.xyz/platform/additional-information/webhooks/overview>

No code in the repository imports a Bridge SDK, sends Bridge HTTP requests or
claims schema compatibility. A future adapter requires environment-specific
sandbox evidence, webhook tests, reconciliation semantics and a separate review.
