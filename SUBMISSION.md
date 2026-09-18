# CurveLens — submission draft

## Links

- Demo URL: https://curvelens-dbc.coral-cow-0547.chatgpt.site/
- Source repository: https://github.com/Nshcn/curvelens
- Main Colosseum project: https://colosseum.com/arena/projects/curvelens
- Demo video: https://curvelens-dbc.coral-cow-0547.chatgpt.site/media/CurveLens-demo-v1.mp4
- Pitch video: https://curvelens-dbc.coral-cow-0547.chatgpt.site/media/CurveLens-pitch-video-v2.mp4

Local submission assets:

- `public/media/CurveLens-demo-v1.mp4`
- `public/media/CurveLens-pitch-v1.pptx`
- `public/media/CurveLens-pitch-video-v2.mp4`

## One-line pitch

CurveLens is a protocol-native preflight workbench that turns Meteora DBC configuration into an inspectable capital path before a launch team signs a transaction.

## Problem

Meteora DBC gives launch partners deep control over curve shape, fees, migration, and post-graduation liquidity. Those parameters are powerful but tightly coupled: a small input change can alter the quote reserve required for graduation, purchaser distribution, market-cap path, and the LP that reaches DAMM v2. Today, teams often reason from raw config values or scripts instead of a decision surface.

## Solution

CurveLens lets a team choose a launch profile, tune the economically meaningful inputs, and immediately inspect:

- the SDK-derived migration quote threshold;
- the market-cap path across reserve checkpoints;
- the tokens distributed before graduation;
- the creator/partner permanent-liquidity split;
- the resulting DAMM v2 fee tier; and
- a portable JSON payload containing the original human inputs and resolved `ConfigParameters` values.

## Meteora integration

CurveLens uses `@meteora-ag/dynamic-bonding-curve-sdk@1.5.12` as its calculation engine rather than reproducing the protocol formulas:

1. `buildCurveWithMarketCap` creates the resolved DBC config.
2. `getMigrationThresholdPrice` derives the graduation boundary.
3. `getPriceFromSqrtPrice` converts protocol Q64.64 prices into human units.
4. `swapQuotePartialFill` simulates cumulative launch-state purchases across the curve.
5. The configuration targets `MigrationOption.MET_DAMM_V2` and supported fixed DAMM v2 fee tiers.

## What is original

Most launch interfaces start at “create token” or “buy.” CurveLens starts one step earlier: market design. It makes DBC a configuration space that teams can compare, audit, and share. The signature graduation rail connects pre-launch curve decisions to the post-graduation DAMM v2 outcome.

## Current status

- Working responsive web application
- Three launch presets and custom parameter editing
- SDK-native curve and quote calculation
- Constraint and invalid-state handling
- Versioned JSON export
- WebMCP read/configure interface for agent workflows
- Focused tests, TypeScript checks, and production build passing

## Next milestone

Add multi-builder comparison (`buildCurveWithTwoSegments`, `buildCurveWithMidPrice`, and `buildCurveWithLiquidityWeights`), then import a devnet pool to compare proposed versus deployed economics.

## Submission description

CurveLens is a Meteora DBC configuration and risk workbench for launchpad builders. Instead of asking teams to reason from raw config files, it turns official SDK output into a live capital path: graduation quote threshold, price expansion, token distribution, fee structure, and the creator/partner liquidity split that migrates to DAMM v2. Every checkpoint is generated with the Meteora DBC SDK, and the export preserves both human inputs and resolved BN values. The current release is intentionally read-only—no wallet, no hidden transaction—so teams can evaluate a launch before moving on-chain.
