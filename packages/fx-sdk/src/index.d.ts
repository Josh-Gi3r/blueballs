export type AtomicAmount = string | bigint | number;

export type FxSourceType =
  | 'PRIVATE_MARKET'
  | 'ISSUER'
  | 'INSTITUTIONAL_LP'
  | 'NEOBANK'
  | 'BANK_TREASURY'
  | 'BANK_PRINCIPAL';

export type FxQuoteState = 'RESERVED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';

export interface SourceAllocation {
  type: FxSourceType;
  sourceId: string;
  input: string;
  output: string;
}

export interface FxQuote {
  id: string;
  routeId: string;
  state: FxQuoteState;
  inputAsset: string;
  outputAsset: string;
  inputSymbol?: string;
  outputSymbol?: string;
  maxInput: string;
  output: string;
  expiresAt: number;
  participantId?: string;
  sources: SourceAllocation[];
  finality?: Record<string, unknown>;
  submissionRef?: string | null;
  eventId?: string | null;
  failureReason?: string | null;
  customerAuthorization?: {
    authorizationId: string;
    expiresAt: number;
    policyId: string;
    policyVersion: number;
  };
}

export interface FxRoute {
  routeId: string;
  quoteId: string;
  state: FxQuoteState;
  createdAt: number;
  expiresAt: number;
  submissionRef?: string | null;
  eventId?: string | null;
  failureReason?: string | null;
  inputAsset: string;
  outputAsset: string;
  totalInput: string;
  totalOutput: string;
  sources: SourceAllocation[];
  finality?: Record<string, unknown>;
}

export interface QuoteRequest {
  inputAsset: string;
  outputAsset: string;
  exactOutput: AtomicAmount;
  expiresInMs?: number;
  participantId?: string;
  accountRef?: string;
}

export interface ReferenceAsset {
  id: string;
  symbol: string;
  decimals: number;
  kind: 'token' | 'fiat';
}

export interface ReferenceStatus {
  mode: 'REFERENCE_SANDBOX';
  canonicalFxRuntime: true;
  assets: ReferenceAsset[];
  sourceTypes: FxSourceType[];
  policy: {
    policyId: string;
    version: number;
    snapshotHash: string;
  };
  execution: {
    configured: boolean;
    note: string;
  };
}

export interface ReferenceLiquiditySlice {
  sourceType: FxSourceType;
  sourceId: string;
  inputAsset: string;
  outputAsset: string;
  maxOutput: string;
  inputNumerator: string;
  inputDenominator: string;
  expiresAt: number;
}

export interface FiatIntent {
  intentId: string;
  routeId: string;
  edgeId: string;
  edgeType: string;
  finalityClass: string;
  payerParticipantId: string;
  payeeParticipantId: string;
  payerAccountRef: string;
  payeeAccountRef: string;
  currency: string;
  amount: string;
  rail: string;
  providerId: string;
  policyAuthorizationId: string;
  createdAt: number;
  expiresAt: number;
  nonce: string;
  intentHash?: string;
  state?: string;
  submissionRef?: string | null;
  paymentObservedAt?: number | null;
  attestationId?: string | null;
  settledAt?: number | null;
  failureReason?: string | null;
  [key: string]: unknown;
}

export interface BlueballsFxClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class BlueballsFxError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(message: string, options?: { code?: string; status?: number; details?: unknown });
}

export class BlueballsFxClient {
  constructor(options: BlueballsFxClientOptions);

  health(): Promise<{ status: string; service: string; runtime?: string }>;
  referenceStatus(): Promise<ReferenceStatus>;
  referencePolicy(): Promise<Record<string, unknown>>;
  referenceLiquidity(args: {
    inputAsset: string;
    outputAsset: string;
    exactOutput?: AtomicAmount;
  }): Promise<{ object: 'list'; data: ReferenceLiquiditySlice[] }>;
  referenceSettlementRoute(): Promise<Record<string, unknown>>;

  createOrder(order: Record<string, unknown>): Promise<Record<string, unknown>>;
  listOrders(maker: string): Promise<{ object: 'list'; data: Record<string, unknown>[] }>;
  cancelOrder(orderHash: string, options?: { onChainInvalidated?: boolean }): Promise<Record<string, unknown>>;
  depth(args: { inputAsset: string; outputAsset: string }): Promise<Record<string, unknown>>;

  quote(request: QuoteRequest): Promise<FxQuote>;
  getQuote(quoteId: string): Promise<FxQuote>;
  execute(quoteId: string): Promise<FxQuote & { execution: Record<string, unknown> }>;
  getRoute(routeId: string): Promise<FxRoute>;

  createFiatIntent(intent: Record<string, unknown>): Promise<FiatIntent>;
  getFiatIntent(intentId: string): Promise<FiatIntent>;
  reserveFiatIntent(intentId: string): Promise<FiatIntent>;
  submitFiatIntent(intentId: string, submissionRef: string): Promise<FiatIntent>;
  attestFiat(attestation: Record<string, unknown>): Promise<Record<string, unknown>>;
  settleFiatIntent(intentId: string, eventId?: string): Promise<Record<string, unknown>>;
}
