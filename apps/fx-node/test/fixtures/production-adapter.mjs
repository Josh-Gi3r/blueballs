function service(methods) {
  return Object.fromEntries(methods.map((name) => [name, async () => ({})]));
}

export async function createBlueballsFxProductionRuntime() {
  return {
    market: service([
      "aggregateDepth",
      "admitOrder",
      "listOrdersForMaker",
      "cancelOrderOffchain",
      "getRoute",
    ]),
    quotes: service([
      "reserveExactOutput",
      "getQuote",
      "getPrivateQuote",
      "markSubmitted",
      "confirm",
      "fail",
    ]),
    fiat: service([
      "createIntent",
      "getIntent",
      "reserveIntent",
      "submitIntent",
      "acceptAttestation",
      "settleVerifiedIntent",
    ]),
    executionAdapter: service(["submit"]),
    publicDepth: false,
    close() {},
  };
}
