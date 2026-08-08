# Blueballs FX — Compliance and Policy Authorization

Status: FX-5 engineering contract

## Core principle

Compliance precedes liquidity.

A participant or source that fails institutional policy is not poor-quality liquidity. It is **not executable liquidity at all** and must never reach matching, pricing, routing or settlement preparation.

Blueballs owns the authorization framework. External providers such as KYC/KYB, sanctions and AML vendors supply verified facts through adapters; they do not define Blueballs' financial policy model.

## Data boundary

PII remains outside the FX policy core. The core stores participant IDs, jurisdiction/risk metadata, wallet attribution and credential status/references needed for decisioning and audit.

Never store passports, identity documents, raw sanctions results or payment credentials in the on-chain layer.

## Participants

Initial participant classes:

- `CUSTOMER`
- `INDIVIDUAL_LP`
- `INSTITUTIONAL_LP`
- `ISSUER`
- `NEOBANK`
- `BANK_TREASURY`
- `BANK_PRINCIPAL`
- `FIAT_PROVIDER`

A participant has status, jurisdiction, risk tier and a monotonically increasing participant epoch. Any material change to eligibility facts increments the epoch and invalidates previously issued short-lived authorizations.

## Credentials

Credential classes are provider-neutral, for example:

- `KYC`
- `KYB`
- `SANCTIONS`
- `AML`
- `ACCREDITATION`
- `LICENSE`

A credential records status, issuance/expiry and an opaque provider reference. Raw provider payloads are not part of the policy core.

## Wallet/account attribution

A settlement wallet/account must map to the participant that policy authorized. Changing attribution increments participant epoch.

## Policy

A deployment policy defines at minimum:

- policy ID and monotonically increasing policy version;
- enabled source/participant classes;
- required credentials by participant class;
- allowed assets and corridors;
- blocked jurisdictions;
- maximum ticket by participant class;
- authorization TTL.

More advanced rules may later include risk tiers, counterparty-specific allow/deny lists, velocity limits, enhanced due diligence, purpose-of-payment rules and source-of-funds requirements.

## Authorization

The policy engine evaluates a concrete action such as liquidity admission or quote participation and either rejects it with explicit reasons or issues a short-lived `FxAuthorization` containing:

- authorization ID;
- participant ID;
- action;
- source/participant class;
- assets/corridor;
- maximum authorized amount;
- participant epoch;
- policy ID/version;
- policy snapshot hash;
- issued/expiry timestamps.

The snapshot hash must be deterministic over the non-PII decision inputs and rules that produced the authorization.

## Revalidation

An authorization is valid only if:

- not expired;
- participant remains active;
- participant epoch still matches;
- policy version still matches;
- authorization record has not been revoked.

Therefore credential expiry, sanctions/AML change, wallet-attribution change, participant suspension or policy update can invalidate future execution without editing historical audit records.

## Invariants

- policy rejection never produces an authorization ID;
- expired/failed required credentials block authorization;
- blocked jurisdictions block authorization;
- disabled participant/source classes block authorization;
- disallowed corridors/assets block authorization;
- ticket limits cannot be bypassed by pricing or liquidity routing;
- materially changed participant facts invalidate old authorizations;
- changed policy version invalidates old authorizations;
- authorization audit history is append-only in meaning;
- no PII is needed to verify an authorization.
