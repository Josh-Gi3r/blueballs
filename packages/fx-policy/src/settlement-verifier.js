function invalid(reason) {
  return { valid: false, reason };
}

export function createSettlementAuthorizationVerifier(policyEngine) {
  if (!policyEngine || typeof policyEngine.verifyAuthorization !== 'function') {
    throw new TypeError('policyEngine with verifyAuthorization is required');
  }

  return (authorizationId, context = {}) => {
    const status = policyEngine.verifyAuthorization(authorizationId);
    if (!status.valid) return status;

    const row = policyEngine.db
      .prepare('SELECT * FROM fx_authorizations WHERE authorization_id = ?')
      .get(authorizationId);
    if (!row) return invalid('NOT_FOUND');

    if (row.action !== 'SETTLE_FIAT_EDGE') return invalid('ACTION_MISMATCH');
    if (context.providerId && row.participant_id !== context.providerId) {
      return invalid('PROVIDER_MISMATCH');
    }
    if (context.inputAsset && row.input_asset !== context.inputAsset) {
      return invalid('INPUT_ASSET_MISMATCH');
    }
    if (context.outputAsset && row.output_asset !== context.outputAsset) {
      return invalid('OUTPUT_ASSET_MISMATCH');
    }
    if (context.amount !== undefined && BigInt(String(context.amount)) > BigInt(row.max_amount)) {
      return invalid('AMOUNT_EXCEEDS_AUTHORIZATION');
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
