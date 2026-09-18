# CurveLens

CurveLens is a preflight market-design workbench for [Meteora Dynamic Bonding Curve](https://docs.meteora.ag/developer-guides/dbc/overview) launches. It lets launchpad teams change market-cap, fee, and post-graduation liquidity parameters, inspect the resulting curve, and export the resolved on-chain configuration before creating a pool.

## Why it exists

DBC exposes powerful configuration primitives, but a valid configuration is not the same thing as an understandable launch. Teams still need to answer practical questions before signing a transaction:

- How much quote liquidity must the curve capture before graduation?
- How quickly does price expand across the curve?
- How many tokens reach buyers before migration?
- Does the partner/creator LP split total 100% and meet the day-one lock rule?
- Which human inputs produced the BN values that will be submitted on-chain?

CurveLens puts those answers in one working surface.

## Protocol-native simulation

The application uses `@meteora-ag/dynamic-bonding-curve-sdk@1.5.12` directly:

- `buildCurveWithMarketCap` resolves a complete DBC configuration.
- `getMigrationThresholdPrice` and `getPriceFromSqrtPrice` expose start and graduation economics.
- `swapQuotePartialFill` produces each pre-launch quote checkpoint against an in-memory launch-state pool.
- The exported JSON contains both human-readable inputs and the serialized SDK `ConfigParameters` result.

No wallet is connected and no transaction is created. The current release is deliberately a deterministic configuration and risk-analysis tool.

## Product surface

- Community, capital-efficient, and RWA price-discovery presets
- SOL and USDC quote assets
- Editable market caps, base fee, creator fee share, permanent LP lock, creator LP share, dynamic fee, and DAMM v2 fee tier
- SDK-derived market-cap curve, reserve checkpoints, token distribution, and graduation threshold
- Protocol constraint checks and clear invalid-configuration state
- Copy/download of a versioned `curvelens.meteora-dbc.v1` payload
- Page-scoped WebMCP tools for reading and configuring the same visible simulation

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Verify

```bash
npm test
npx tsc --noEmit
npm run build
```

The focused model tests pin the default 20 → 600 SOL scenario to the SDK-derived `92.632253276 SOL` migration threshold and verify invalid market-cap ordering.

## Roadmap

- Compare official two-segment, mid-price, and liquidity-weight builders side by side
- Import an existing config or pool and diff it against a proposed configuration
- Optional devnet transaction builder with explicit wallet review
- Shareable, immutable simulation snapshots and curve preset marketplace

## Sources

- [Meteora DBC SDK](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk)
- [Meteora DBC program](https://github.com/MeteoraAg/dynamic-bonding-curve)
- [Meteora DBC developer guide](https://docs.meteora.ag/developer-guides/dbc/overview)

