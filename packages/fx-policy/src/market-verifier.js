function parseSnapshot(value) {
  return JSON.parse(value);
}

function invalid(reason) {
  return { valid: false, reason };
}

export function createMarketAuthorizationVerifier(policyEngine) {
  if (!policyEngine || typeof policyEngine.verifyAuthorization !== "function") {
    throw new TypeError("policyEngine with verifyAuthorization is required");
  }

  return (authorizationId, context = {}) => {
    const status = policyEngine.verifyAuthorization(authorizationId);
    if (!status.valid) return status;

    const row = policyEngine.db
      .prepare("SELECT * FROM fx_authorizations WHERE authorization_id = ?")
      .get(authorizationId);
    if (!row) return invalid("NOT_FOUND");

    if (row.action !== "PROVIDE_LIQUIDITY") return invalid("ACTION_MISMATCH");
    if (context.inputAsset && row.input_asset !== context.inputAsset) {
      return invalid("INPUT_ASSET_MISMATCH");
    }
    if (context.outputAsset && row.output_asset !== context.outputAsset) {
      return invalid("OUTPUT_ASSET_MISMATCH");
    }
    if (
      context.amount !== undefined &&
      BigInt(String(context.amount)) > BigInt(row.max_amount)
    ) {
      return invalid("AMOUNT_EXCEEDS_AUTHORIZATION");
    }
    if (
      context.policySnapshotHash &&
      row.policy_snapshot_hash !== context.policySnapshotHash
    ) {
      return invalid("POLICY_SNAPSHOT_MISMATCH");
    }

    const snapshot = parseSnapshot(row.decision_snapshot_json);
    if (context.accountRef && snapshot.accountRef !== context.accountRef) {
      return invalid("ACCOUNT_ATTRIBUTION_MISMATCH");
    }

    return {
      valid: true,
      authorizationId,
      participantId: row.participant_id,
      participantType: row.participant_type,
      expiresAt: row.expires_at,
    };
  };
}
