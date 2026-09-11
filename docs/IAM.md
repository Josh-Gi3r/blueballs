# Identity, sessions and privileged approvals

Blueballs deliberately does **not** embed a username/password database or become
an identity provider. Production institutions already have workforce/customer IAM
requirements that vary by jurisdiction and organisation. The core owns API
credential authorization, financial policy and audit evidence; the deployment
owns human authentication through an IdP such as OIDC/SAML/passkeys.

## Machine credentials

Blueballs API keys are machine credentials. Secondary keys can be restricted by
domain and read/write permission, cannot grant permissions they do not possess,
and are always bound to one tenant.

Never use a shared unrestricted API key as proof that a particular employee
approved a treasury action.

### Production bootstrap and credential recovery

A completely fresh production database requires `BANK_BOOTSTRAP_API_KEY` from the
deployment secret manager. Blueballs creates the first production tenant/admin
credential and that bootstrap secret should normally be removed after scoped
machine credentials/IAM have been established.

Revoking every credential does **not** make an existing database “fresh.” On the
next restart Blueballs refuses to create a second tenant implicitly. Credential
recovery is explicit:

```text
BANK_BOOTSTRAP_TENANT_ID=<existing tenant id>
BANK_BOOTSTRAP_API_KEY=<new high-entropy recovery secret>
```

The tenant ID must already exist. Recovery attaches the new admin credential to
that tenant; an unknown ID fails closed. Remove the recovery values again after
normal credentials have been issued. This prevents an incident-response key
revocation from silently orphaning money under one tenant while bootstrapping a
new administrative tenant beside it.

## Named human actor assertions

An authenticated deployment gateway may attach a short-lived signed human actor
assertion to an API-key-authenticated request:

```text
X-Blueballs-Actor-Id: idp:alice@example.org
X-Blueballs-Actor-Timestamp: 1789156800
X-Blueballs-Actor-Assurance: normal | step_up
X-Blueballs-Actor-Signature: v1=<hmac-sha256>
```

Configure the banking runtime with a secret available only to the trusted IAM
edge and Blueballs:

```text
BANK_TRUSTED_ACTOR_SECRET=<minimum 32 character secret>
BANK_TRUSTED_ACTOR_MAX_SKEW_SECONDS=300
```

The signature covers the timestamp, authenticated machine credential ID, HTTP
method, exact request path, actor ID and assurance level. This binds the human
identity to one credential and one operation. Partial, stale or forged
assertions fail closed with `401`.

When valid, command audit evidence records the human subject as `actor_id`. The
`actor_scope` retains both the assurance level and the underlying machine
credential ID, for example:

```text
actor_id: idp:alice@example.org
actor_scope: human:step_up;credential:key_...
```

The assertion is **attribution**, not a replacement for API authentication or
route permission checks. A valid human assertion attached to an under-privileged
API key does not grant more permissions.

## Step-up

`step_up` means the deployment IAM gateway has performed the institution's
stronger authentication ceremony before signing the request. Blueballs does not
pretend to know whether that means WebAuthn, hardware token, device posture,
manager confirmation or another control.

Deployment policy should require `step_up` before sensitive human-operated
changes such as:

- treasury/approval decisions above institution limits;
- changing privileged policy/approval configuration;
- credential/secret administration;
- manual reconciliation resolution;
- emergency operational actions.

The assertion gives the core a tamper-resistant audit field for that decision;
the institution/IAM gateway owns the actual authentication ceremony and its
policy thresholds.

## Dual control

Blueballs approval chains already require distinct approver credentials and
prevent the same credential from deciding twice. This is the core mechanism for
N-of-M procedural controls.

For human-operated treasury workflows, deployments should issue separate scoped
credentials/session-gateway principals for each approval authority and attach the
named human assertion on every decision. Do not let two employees share one API
credential and call that dual control.

Where a deployment centralizes human access behind one backend gateway
credential, the gateway must additionally enforce distinct IdP subjects for each
required approval before issuing the second command. Blueballs audit records then
preserve the human subject on each command even though the gateway credential is
shared.

## Session lifecycle

Human browser/mobile sessions terminate at the deployment IAM/application layer,
not the Blueballs banking API. The gateway should:

1. validate the IdP session/token;
2. evaluate role/entitlement and required assurance;
3. use a narrowly-scoped Blueballs machine credential;
4. sign the actor assertion immediately before forwarding the command;
5. never expose the assertion signing secret or backend API key to the browser;
6. expire/revoke sessions using the institution's IdP controls.

This keeps Blueballs composable with enterprise IAM without building a second,
weaker password and MFA system inside the financial core.
