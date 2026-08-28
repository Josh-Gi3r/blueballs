function source(sourceType, sourceId, priceBps, capacity = "100000") {
  const numerator = BigInt(10_000 + priceBps).toString();
  return {
    sourceType,
    sourceId,
    online: true,
    capacityBuy: capacity,
    capacitySell: capacity,
    inputNumeratorBuy: numerator,
    inputDenominatorBuy: "10000",
    inputNumeratorSell: numerator,
    inputDenominatorSell: "10000",
  };
}

function requests(count, oneWayPct = 50, amount = "1000") {
  return Array.from({ length: count }, (_, i) => ({
    direction: i % 100 < oneWayPct ? "BUY_B" : "SELL_B",
    outputAmount: amount,
  }));
}

const baseSources = () => [
  source("PRIVATE_MARKET", "market", 5, "250"),
  source("ISSUER", "issuer", 8, "200"),
  source("INSTITUTIONAL_LP", "lp", 10, "200"),
  source("NEOBANK", "neobank", 12, "100"),
  source("BANK_TREASURY", "treasury", 15, "100"),
  source("BANK_PRINCIPAL", "principal", 20, "1000000"),
];

export function baselineScenarios() {
  return {
    balanced: {
      seed: 11,
      principalHardLimit: "50000",
      sources: baseSources(),
      requests: requests(200, 50),
      events: [],
    },
    oneWay90: {
      seed: 12,
      principalHardLimit: "30000",
      sources: baseSources(),
      requests: requests(300, 90),
      events: [],
    },
    lpDisappears: {
      seed: 13,
      principalHardLimit: "50000",
      sources: baseSources(),
      requests: requests(200, 60),
      events: [{ at: 80, type: "SOURCE_OFFLINE", sourceId: "lp" }],
    },
    issuerDisappears: {
      seed: 14,
      principalHardLimit: "50000",
      sources: baseSources(),
      requests: requests(200, 60),
      events: [{ at: 80, type: "SOURCE_OFFLINE", sourceId: "issuer" }],
    },
    principalLimit: {
      seed: 15,
      principalHardLimit: "10000",
      sources: [source("BANK_PRINCIPAL", "principal", 20, "1000000")],
      requests: requests(50, 100, "1000"),
      events: [],
    },
    referenceOutage: {
      seed: 16,
      principalHardLimit: "50000",
      sources: [
        source("INSTITUTIONAL_LP", "lp", 10, "400"),
        source("BANK_PRINCIPAL", "principal", 20, "1000000"),
      ],
      requests: requests(100, 100, "1000"),
      events: [
        { at: 20, type: "REFERENCE_UNAVAILABLE" },
        { at: 70, type: "REFERENCE_AVAILABLE" },
      ],
    },
    priceShock: {
      seed: 17,
      principalHardLimit: "50000",
      sources: baseSources(),
      requests: requests(120, 50),
      events: [{ at: 60, type: "PRICE_SHOCK", multiplier: 1.05 }],
    },
    cancellationStorm: {
      seed: 18,
      principalHardLimit: "50000",
      sources: baseSources(),
      requests: requests(150, 50),
      events: [
        {
          at: 30,
          type: "CANCELLATION_STORM",
          sourceId: "market",
          remainingBps: 500,
        },
        { at: 100, type: "CANCELLATION_RECOVERY", sourceId: "market" },
      ],
    },
    chainCongestion: {
      seed: 19,
      principalHardLimit: "50000",
      sources: baseSources(),
      requests: requests(150, 50),
      events: [
        { at: 30, type: "CHAIN_CONGESTION", failureProbability: 0.4 },
        { at: 100, type: "CHAIN_RECOVERY", failureProbability: 0 },
      ],
    },
    recovery: {
      seed: 20,
      principalHardLimit: "50000",
      sources: baseSources(),
      requests: requests(200, 65),
      events: [
        { at: 40, type: "SOURCE_OFFLINE", sourceId: "lp" },
        { at: 40, type: "REFERENCE_UNAVAILABLE" },
        { at: 100, type: "SOURCE_ONLINE", sourceId: "lp" },
        { at: 100, type: "REFERENCE_AVAILABLE" },
      ],
    },
  };
}
