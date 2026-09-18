import assert from "node:assert/strict";
import test from "node:test";

import { buildCurveSnapshot, type CurveInputs } from "../lib/curve-model.ts";

const communityLaunch: CurveInputs = {
  quoteAsset: "SOL",
  initialMarketCap: 20,
  migrationMarketCap: 600,
  totalSupply: 1_000_000_000,
  baseFeeBps: 100,
  dynamicFeeEnabled: true,
  creatorTradingFeePercentage: 50,
  dammFeeBps: 200,
  lockedLiquidityPercentage: 15,
  creatorLiquidityPercentage: 50,
};

test("builds an SDK-backed community launch curve", () => {
  const snapshot = buildCurveSnapshot(communityLaunch);

  assert.equal(snapshot.points.length, 25);
  assert.ok(
    Math.abs(snapshot.migrationQuoteThreshold - 92.632253276) < 0.000000001,
  );
  assert.ok(Math.abs(snapshot.points[0].marketCap - 20) < 0.0001);
  assert.ok(Math.abs(snapshot.migrationPrice * 1_000_000_000 - 600) < 0.01);
  assert.equal(snapshot.points.at(-1)?.progress, 100);
  assert.equal(snapshot.creatorLockedLiquidityPercentage, 8);
  assert.equal(snapshot.partnerLockedLiquidityPercentage, 7);
  assert.match(String(snapshot.exportPayload.sdk), /1\.5\.12$/);
});

test("rejects a graduation cap below the initial cap", () => {
  assert.throws(
    () =>
      buildCurveSnapshot({
        ...communityLaunch,
        migrationMarketCap: 10,
      }),
    /must exceed the initial market cap/,
  );
});
