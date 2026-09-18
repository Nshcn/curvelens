import BN from "bn.js";
import {
  ActivationType,
  BaseFeeMode,
  buildCurveWithMarketCap,
  CollectFeeMode,
  getMigrationThresholdPrice,
  getPriceFromSqrtPrice,
  MigrationFeeOption,
  MigrationOption,
  swapQuotePartialFill,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  type PoolConfig,
  type VirtualPool,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

export type QuoteAsset = "SOL" | "USDC";

export type CurveInputs = {
  quoteAsset: QuoteAsset;
  initialMarketCap: number;
  migrationMarketCap: number;
  totalSupply: number;
  baseFeeBps: number;
  dynamicFeeEnabled: boolean;
  creatorTradingFeePercentage: number;
  dammFeeBps: 25 | 30 | 100 | 200 | 400 | 600;
  lockedLiquidityPercentage: number;
  creatorLiquidityPercentage: number;
};

export type CurvePoint = {
  progress: number;
  reserve: number;
  marketCap: number;
  tokenPrice: number;
  tokensSold: number;
};

export type CurveSnapshot = {
  points: CurvePoint[];
  migrationQuoteThreshold: number;
  startPrice: number;
  migrationPrice: number;
  priceMultiple: number;
  tokensSoldAtMigration: number;
  creatorLockedLiquidityPercentage: number;
  partnerLockedLiquidityPercentage: number;
  exportPayload: Record<string, unknown>;
};

const PROGRAM_ID = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
const SDK_VERSION = "1.5.12";

const migrationFeeOptions = {
  25: MigrationFeeOption.FixedBps25,
  30: MigrationFeeOption.FixedBps30,
  100: MigrationFeeOption.FixedBps100,
  200: MigrationFeeOption.FixedBps200,
  400: MigrationFeeOption.FixedBps400,
  600: MigrationFeeOption.FixedBps600,
} as const;

function serialize(value: unknown): unknown {
  if (BN.isBN(value)) return (value as BN).toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serialize(entry)]),
    );
  }
  return value;
}

function toTokenUnits(value: BN, decimals: number) {
  return Number(value.toString()) / 10 ** decimals;
}

function liquiditySplit(inputs: CurveInputs) {
  const creatorLocked = Math.round(
    (inputs.lockedLiquidityPercentage * inputs.creatorLiquidityPercentage) / 100,
  );
  const partnerLocked = inputs.lockedLiquidityPercentage - creatorLocked;

  return {
    creatorLocked,
    partnerLocked,
    creatorClaimable: inputs.creatorLiquidityPercentage - creatorLocked,
    partnerClaimable:
      100 - inputs.creatorLiquidityPercentage - partnerLocked,
  };
}

export function buildCurveSnapshot(inputs: CurveInputs): CurveSnapshot {
  if (inputs.initialMarketCap <= 0) {
    throw new Error("Initial market cap must be greater than zero.");
  }
  if (inputs.migrationMarketCap <= inputs.initialMarketCap) {
    throw new Error("Graduation market cap must exceed the initial market cap.");
  }
  if (inputs.lockedLiquidityPercentage < 10) {
    throw new Error("At least 10% of migrated liquidity must remain locked.");
  }

  const quoteDecimals =
    inputs.quoteAsset === "SOL" ? TokenDecimal.NINE : TokenDecimal.SIX;
  const split = liquiditySplit(inputs);
  const builderInput = {
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: quoteDecimals,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: inputs.totalSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: inputs.baseFeeBps,
          endingFeeBps: inputs.baseFeeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: inputs.dynamicFeeEnabled,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: inputs.creatorTradingFeePercentage,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: true,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: migrationFeeOptions[inputs.dammFeeBps],
      migrationFee: {
        feePercentage: 0,
        creatorFeePercentage: 0,
      },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: split.partnerClaimable,
      partnerPermanentLockedLiquidityPercentage: split.partnerLocked,
      creatorLiquidityPercentage: split.creatorClaimable,
      creatorPermanentLockedLiquidityPercentage: split.creatorLocked,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Slot,
    initialMarketCap: inputs.initialMarketCap,
    migrationMarketCap: inputs.migrationMarketCap,
  } as const;

  const config = buildCurveWithMarketCap(builderInput);
  const migrationSqrtPrice = getMigrationThresholdPrice(
    config.migrationQuoteThreshold,
    config.sqrtStartPrice,
    config.curve,
  );
  const startPrice = getPriceFromSqrtPrice(
    config.sqrtStartPrice,
    TokenDecimal.SIX,
    quoteDecimals,
  ).toNumber();
  const migrationPrice = getPriceFromSqrtPrice(
    migrationSqrtPrice,
    TokenDecimal.SIX,
    quoteDecimals,
  ).toNumber();
  const quoteScale = 10 ** quoteDecimals;
  const baseScale = 10 ** TokenDecimal.SIX;
  const migrationQuoteThreshold = toTokenUnits(
    config.migrationQuoteThreshold,
    quoteDecimals,
  );
  const feeDenominator = new BN(10_000 - inputs.baseFeeBps);
  const maxGrossInput = config.migrationQuoteThreshold
    .mul(new BN(10_000))
    .div(feeDenominator)
    .mul(new BN(102))
    .div(new BN(100));
  const poolConfig = {
    ...config,
    migrationSqrtPrice,
    poolFees: {
      ...config.poolFees,
      dynamicFee: config.poolFees.dynamicFee
        ? { ...config.poolFees.dynamicFee, initialized: 1 }
        : { initialized: 0, binStep: 0, variableFeeControl: 0 },
    },
  } as unknown as PoolConfig;
  const virtualPool = {
    poolState: {
      sqrtPrice: new BN(config.sqrtStartPrice),
      baseReserve: new BN(0),
      quoteReserve: new BN(0),
      activationPoint: new BN(0),
      volatilityTracker: {
        lastUpdateTimestamp: new BN(0),
        sqrtPriceReference: new BN(0),
        volatilityAccumulator: new BN(0),
        volatilityReference: new BN(0),
        padding: [],
      },
    },
  } as unknown as VirtualPool;
  const points: CurvePoint[] = [
    {
      progress: 0,
      reserve: 0,
      marketCap: startPrice * inputs.totalSupply,
      tokenPrice: startPrice,
      tokensSold: 0,
    },
  ];

  for (let step = 1; step <= 24; step += 1) {
    const amountIn = maxGrossInput.mul(new BN(step)).div(new BN(24));
    const quote = swapQuotePartialFill(
      virtualPool,
      poolConfig,
      false,
      amountIn,
      0,
      false,
      new BN(0),
      false,
    ) as unknown as {
      excludedFeeInputAmount: BN;
      nextSqrtPrice: BN;
      outputAmount: BN;
    };
    const reserve = Math.min(
      toTokenUnits(quote.excludedFeeInputAmount, quoteDecimals),
      migrationQuoteThreshold,
    );
    const tokenPrice = getPriceFromSqrtPrice(
      quote.nextSqrtPrice,
      TokenDecimal.SIX,
      quoteDecimals,
    ).toNumber();
    points.push({
      progress: Math.min(100, (reserve / migrationQuoteThreshold) * 100),
      reserve,
      marketCap: tokenPrice * inputs.totalSupply,
      tokenPrice,
      tokensSold: Number(quote.outputAmount.toString()) / baseScale,
    });
  }

  const finalPoint = points.at(-1) ?? points[0];
  const exportPayload = {
    schema: "curvelens.meteora-dbc.v1",
    generatedAt: new Date().toISOString(),
    programId: PROGRAM_ID,
    sdk: `@meteora-ag/dynamic-bonding-curve-sdk@${SDK_VERSION}`,
    builder: "buildCurveWithMarketCap",
    quoteAsset: inputs.quoteAsset,
    humanInputs: inputs,
    builderInput,
    resolvedConfig: serialize(config),
    summary: {
      migrationQuoteThreshold,
      quoteUnitScale: quoteScale,
      startPrice,
      migrationPrice,
      priceMultiple: migrationPrice / startPrice,
    },
  };

  return {
    points,
    migrationQuoteThreshold,
    startPrice,
    migrationPrice,
    priceMultiple: migrationPrice / startPrice,
    tokensSoldAtMigration: finalPoint.tokensSold,
    creatorLockedLiquidityPercentage: split.creatorLocked,
    partnerLockedLiquidityPercentage: split.partnerLocked,
    exportPayload,
  };
}
