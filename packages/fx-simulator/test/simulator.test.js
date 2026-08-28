import test from "node:test";
import assert from "node:assert/strict";

import { baselineScenarios, runSimulation } from "../src/index.js";

function asBig(value) {
  return BigInt(value);
}

function assertPrincipalInvariant(result) {
  assert.ok(
    asBig(result.peakPrincipalExposureAbs) <= asBig(result.principalHardLimit),
  );
  assert.ok((result.rejections.RISK_LIMIT ?? 0) >= 0);
}

test("same seed and scenario produce byte-for-byte equivalent metrics", () => {
  const scenario = baselineScenarios().chainCongestion;
  const first = runSimulation(scenario);
  const second = runSimulation(scenario);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("balanced flow fills and uses multiple authorized liquidity classes", () => {
  const result = runSimulation(baselineScenarios().balanced);
  assert.equal(result.fillRatePct, 100);
  assert.ok(asBig(result.routeComposition.PRIVATE_MARKET) > 0n);
  assert.ok(asBig(result.routeComposition.ISSUER) > 0n);
  assert.ok(asBig(result.routeComposition.INSTITUTIONAL_LP) > 0n);
  assert.ok(asBig(result.routeComposition.BANK_PRINCIPAL) > 0n);
  assertPrincipalInvariant(result);
});

test("90 percent one-way flow pushes principal exposure harder than balanced flow", () => {
  const scenarios = baselineScenarios();
  const balanced = runSimulation(scenarios.balanced);
  const oneWay = runSimulation(scenarios.oneWay90);
  assert.ok(
    asBig(oneWay.peakPrincipalExposureAbs) >
      asBig(balanced.peakPrincipalExposureAbs),
  );
  assertPrincipalInvariant(oneWay);
});

test("principal-only one-way flow reaches hard limit and rejects additional flow", () => {
  const result = runSimulation(baselineScenarios().principalLimit);
  assert.equal(result.peakPrincipalExposureAbs, result.principalHardLimit);
  assert.ok(result.rejections.RISK_LIMIT > 0);
  assertPrincipalInvariant(result);
});

test("reference outage removes bank principal instead of synthesizing stale bank liquidity", () => {
  const result = runSimulation(baselineScenarios().referenceOutage);
  assert.ok(result.referenceOutageRequests > 0);
  assert.ok(result.rejections.NO_LIQUIDITY > 0);
  assertPrincipalInvariant(result);
});

test("institutional LP outage reduces LP contribution after the outage", () => {
  const base = baselineScenarios();
  const control = runSimulation({ ...base.lpDisappears, events: [] });
  const outage = runSimulation(base.lpDisappears);
  assert.ok(
    asBig(outage.routeComposition.INSTITUTIONAL_LP) <
      asBig(control.routeComposition.INSTITUTIONAL_LP),
  );
  assertPrincipalInvariant(outage);
});

test("issuer outage reduces issuer contribution", () => {
  const base = baselineScenarios();
  const control = runSimulation({ ...base.issuerDisappears, events: [] });
  const outage = runSimulation(base.issuerDisappears);
  assert.ok(
    asBig(outage.routeComposition.ISSUER) <
      asBig(control.routeComposition.ISSUER),
  );
  assertPrincipalInvariant(outage);
});

test("price shock is recorded deterministically without violating exposure limits", () => {
  const result = runSimulation(baselineScenarios().priceShock);
  assert.equal(result.referenceIndex, 1.05);
  assertPrincipalInvariant(result);
});

test("cancellation storm reduces private-market routed volume", () => {
  const scenarios = baselineScenarios();
  const control = runSimulation({ ...scenarios.cancellationStorm, events: [] });
  const storm = runSimulation(scenarios.cancellationStorm);
  assert.ok(
    asBig(storm.routeComposition.PRIVATE_MARKET) <
      asBig(control.routeComposition.PRIVATE_MARKET),
  );
  assertPrincipalInvariant(storm);
});

test("chain congestion causes failed settlements and failed attempts do not count as fills", () => {
  const scenarios = baselineScenarios();
  const control = runSimulation({ ...scenarios.chainCongestion, events: [] });
  const congested = runSimulation(scenarios.chainCongestion);
  assert.ok(congested.settlementFailures > 0);
  assert.ok(congested.filledOrders < control.filledOrders);
  assert.ok(asBig(congested.filledVolume) < asBig(control.filledVolume));
  assertPrincipalInvariant(congested);
});

test("recovery scenario resumes filling after liquidity and reference service return", () => {
  const result = runSimulation(baselineScenarios().recovery);
  assert.ok(result.filledOrders > 0);
  assert.ok(result.referenceOutageRequests > 0);
  assert.ok(asBig(result.routeComposition.INSTITUTIONAL_LP) > 0n);
  assertPrincipalInvariant(result);
});
