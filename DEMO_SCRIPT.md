# CurveLens demo script

Target length: 75–90 seconds.

## 0–12s — the problem

“A Meteora DBC config can be valid and still be hard to reason about. Before launching, teams need to understand how fees, market-cap targets, and migrated liquidity change the path to graduation.”

Show the full CurveLens workbench with the Community preset selected.

## 12–32s — the working surface

“CurveLens is a preflight market-design workbench powered directly by Meteora’s DBC SDK. Here the token starts at a 20 SOL market cap and graduates at 600 SOL.”

Point to the parameter column, the capital-path chart, and the 92.632 SOL migration threshold.

## 32–52s — protocol calculation

“The chart is not a visual approximation. CurveLens calls `buildCurveWithMarketCap`, then samples the launch with `swapQuotePartialFill`. Each checkpoint shows real SDK quote reserve, market cap, and token distribution.”

Move the graduation cap from 600 to 750 SOL and show the chart and threshold update.

## 52–68s — migration integrity

“The graduation brief checks the decisions that survive into DAMM v2: fee tier, creator and partner LP ownership, total allocation, and the protocol’s day-one liquidity lock floor.”

Show the 4/4 integrity block and graduation rail.

## 68–82s — developer handoff

“When the design is ready, CurveLens exports the original human inputs alongside the resolved BN config values. A launchpad can review, version, or feed this payload into its own transaction builder.”

Click Copy JSON or Download.

## Closing

“CurveLens makes DBC market design inspectable before it becomes irreversible.”

