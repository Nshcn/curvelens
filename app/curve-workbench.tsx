"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  Braces,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Gauge,
  Info,
  LockKeyhole,
  Orbit,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type {
  CurveInputs,
  CurveSnapshot,
  QuoteAsset,
} from "@/lib/curve-model";

const presets: Record<string, CurveInputs> = {
  community: {
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
  },
  efficient: {
    quoteAsset: "SOL",
    initialMarketCap: 50,
    migrationMarketCap: 500,
    totalSupply: 1_000_000_000,
    baseFeeBps: 50,
    dynamicFeeEnabled: true,
    creatorTradingFeePercentage: 25,
    dammFeeBps: 100,
    lockedLiquidityPercentage: 10,
    creatorLiquidityPercentage: 40,
  },
  rwa: {
    quoteAsset: "USDC",
    initialMarketCap: 250_000,
    migrationMarketCap: 2_500_000,
    totalSupply: 100_000_000,
    baseFeeBps: 30,
    dynamicFeeEnabled: false,
    creatorTradingFeePercentage: 20,
    dammFeeBps: 30,
    lockedLiquidityPercentage: 25,
    creatorLiquidityPercentage: 60,
  },
};

const presetLabels: Record<string, string> = {
  community: "Community",
  efficient: "Efficient",
  rwa: "RWA discovery",
};

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const configurableNumericFields = [
  "initialMarketCap",
  "migrationMarketCap",
  "totalSupply",
  "baseFeeBps",
  "creatorTradingFeePercentage",
  "dammFeeBps",
  "lockedLiquidityPercentage",
  "creatorLiquidityPercentage",
] as const;

function validateCurvePatch(input: unknown): Partial<CurveInputs> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Curve parameters must be provided as an object.");
  }

  const record = input as Record<string, unknown>;
  const patch: Partial<CurveInputs> = {};

  if (record.quoteAsset !== undefined) {
    if (record.quoteAsset !== "SOL" && record.quoteAsset !== "USDC") {
      throw new Error("quoteAsset must be SOL or USDC.");
    }
    patch.quoteAsset = record.quoteAsset;
  }

  if (record.dynamicFeeEnabled !== undefined) {
    if (typeof record.dynamicFeeEnabled !== "boolean") {
      throw new Error("dynamicFeeEnabled must be a boolean.");
    }
    patch.dynamicFeeEnabled = record.dynamicFeeEnabled;
  }

  for (const field of configurableNumericFields) {
    const value = record[field];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${field} must be a finite number.`);
    }
    Object.assign(patch, { [field]: value });
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("Provide at least one curve parameter to configure.");
  }
  if (
    patch.dammFeeBps !== undefined &&
    ![25, 30, 100, 200, 400, 600].includes(patch.dammFeeBps)
  ) {
    throw new Error("dammFeeBps must be one of 25, 30, 100, 200, 400, or 600.");
  }

  return patch;
}

function formatAmount(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function ParameterRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="parameter-row">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label className="text-[0.78rem] font-medium text-[var(--muted-foreground)]">
          {label}
        </Label>
        {value ? <span className="data-value text-xs">{value}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="metric-block">
      <p className="eyebrow">{label}</p>
      <p className={accent ? "metric-value text-signal" : "metric-value"}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
        {detail}
      </p>
    </div>
  );
}

function ChartTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      marketCap: number;
      reserve: number;
      tokensSold: number;
      progress: number;
    };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="chart-tip">
      <span>{point.progress.toFixed(0)}% to graduation</span>
      <strong>{compactNumber.format(point.marketCap)} market cap</strong>
      <small>{formatAmount(point.reserve, 3)} quote reserve</small>
    </div>
  );
}

export function CurveWorkbench() {
  const [inputs, setInputs] = useState<CurveInputs>(presets.community);
  const [activePreset, setActivePreset] = useState("community");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    snapshot: CurveSnapshot | null;
    error: string | null;
  }>({ snapshot: null, error: null });
  const stateRef = useRef({ inputs, result });

  useEffect(() => {
    stateRef.current = { inputs, result };
  }, [inputs, result]);

  useEffect(() => {
    let active = true;

    void import("@/lib/curve-model").then(({ buildCurveSnapshot }) => {
      if (!active) return;
      try {
        setResult({ snapshot: buildCurveSnapshot(inputs), error: null });
      } catch (error) {
        setResult({
          snapshot: null,
          error:
            error instanceof Error
              ? error.message
              : "Invalid curve configuration.",
        });
      }
    });

    return () => {
      active = false;
    };
  }, [inputs]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const options = { signal: lifecycle.signal };

    const registrations = [
      context.registerTool(
        {
          name: "read_curve_simulation",
          title: "Read curve simulation",
          description:
            "Read the current CurveLens inputs and the latest SDK-calculated graduation summary without changing the page.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
            untrustedContentHint: false,
          },
          execute() {
            const current = stateRef.current;
            const snapshot = current.result.snapshot;
            return {
              inputs: current.inputs,
              status: snapshot
                ? "ready"
                : current.result.error
                  ? "invalid"
                  : "calculating",
              summary: snapshot
                ? {
                    migrationQuoteThreshold:
                      snapshot.migrationQuoteThreshold,
                    priceMultiple: snapshot.priceMultiple,
                    tokensSoldAtMigration: snapshot.tokensSoldAtMigration,
                  }
                : null,
              error: current.result.error,
            };
          },
        },
        options,
      ),
      context.registerTool(
        {
          name: "configure_curve_simulation",
          title: "Configure curve simulation",
          description:
            "Stage one or more Meteora DBC simulation parameters in the visible CurveLens workbench. This never submits a transaction.",
          inputSchema: {
            type: "object",
            properties: {
              quoteAsset: { type: "string", enum: ["SOL", "USDC"] },
              initialMarketCap: { type: "number", exclusiveMinimum: 0 },
              migrationMarketCap: { type: "number", exclusiveMinimum: 0 },
              totalSupply: { type: "number", exclusiveMinimum: 0 },
              baseFeeBps: { type: "number", minimum: 25, maximum: 300 },
              dynamicFeeEnabled: { type: "boolean" },
              creatorTradingFeePercentage: {
                type: "number",
                minimum: 0,
                maximum: 100,
              },
              dammFeeBps: {
                type: "number",
                enum: [25, 30, 100, 200, 400, 600],
              },
              lockedLiquidityPercentage: {
                type: "number",
                minimum: 10,
                maximum: 60,
              },
              creatorLiquidityPercentage: {
                type: "number",
                minimum: 10,
                maximum: 90,
              },
            },
            minProperties: 1,
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: false,
            untrustedContentHint: false,
          },
          async execute(input) {
            const patch = validateCurvePatch(input);
            const nextInputs = { ...stateRef.current.inputs, ...patch };
            stateRef.current = {
              inputs: nextInputs,
              result: { snapshot: null, error: null },
            };
            setActivePreset("custom");
            setInputs(nextInputs);
            await new Promise<void>((resolve) =>
              window.requestAnimationFrame(() => resolve()),
            );
            return { status: "configured", inputs: nextInputs };
          },
        },
        options,
      ),
    ];

    for (const registration of registrations) {
      void Promise.resolve(registration).catch((error) => {
        console.warn("WebMCP tool registration failed", error);
      });
    }

    return () => lifecycle.abort();
  }, []);

  const update = <Key extends keyof CurveInputs>(
    key: Key,
    value: CurveInputs[Key],
  ) => {
    setActivePreset("custom");
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const applyPreset = (key: string) => {
    setActivePreset(key);
    setInputs(presets[key]);
  };

  const configJson = result.snapshot
    ? JSON.stringify(result.snapshot.exportPayload, null, 2)
    : "";

  const copyConfig = async () => {
    if (!configJson) return;
    await navigator.clipboard.writeText(configJson);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadConfig = () => {
    if (!configJson) return;
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "curvelens-dbc-config.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const snapshot = result.snapshot;
  const quote = inputs.quoteAsset;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="app-header">
        <div className="flex min-w-0 items-center gap-3">
          <span className="brand-mark" aria-hidden="true">
            <Orbit className="size-5" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="brand-title">CurveLens</h1>
              <span className="hidden text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-signal sm:inline">
                DBC lab
              </span>
            </div>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              Preflight launch economics before touching the chain
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-chip hidden md:inline-flex">
            <span className="status-dot" /> SDK 1.5.12
          </span>
          <span className="status-chip inline-flex">
            <ShieldCheck className="size-3.5" /> Simulation · no tx
          </span>
        </div>
      </header>

      <section className="workbench-shell">
        <aside className="control-panel" aria-label="Curve parameters">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">01 / Configure</p>
              <h2>Launch parameters</h2>
            </div>
            <Gauge className="size-5 text-signal" aria-hidden="true" />
          </div>

          <div className="preset-grid" aria-label="Configuration presets">
            {Object.entries(presetLabels).map(([key, label]) => (
              <button
                className="preset-button"
                data-active={activePreset === key}
                key={key}
                onClick={() => applyPreset(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="control-stack">
            <ParameterRow label="Quote asset">
              <Select
                value={inputs.quoteAsset}
                onValueChange={(value) =>
                  update("quoteAsset", value as QuoteAsset)
                }
              >
                <SelectTrigger className="h-10 w-full border-[var(--line)] bg-[var(--surface-raised)] font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOL">SOL · 9 decimals</SelectItem>
                  <SelectItem value="USDC">USDC · 6 decimals</SelectItem>
                </SelectContent>
              </Select>
            </ParameterRow>

            <div className="grid grid-cols-2 gap-3">
              <ParameterRow label={`Initial cap (${quote})`}>
                <Input
                  aria-label={`Initial market cap in ${quote}`}
                  className="parameter-input"
                  min={0.001}
                  onChange={(event) =>
                    update("initialMarketCap", Number(event.target.value))
                  }
                  step="any"
                  type="number"
                  value={inputs.initialMarketCap}
                />
              </ParameterRow>
              <ParameterRow label={`Graduation cap (${quote})`}>
                <Input
                  aria-label={`Graduation market cap in ${quote}`}
                  className="parameter-input"
                  min={0.001}
                  onChange={(event) =>
                    update("migrationMarketCap", Number(event.target.value))
                  }
                  step="any"
                  type="number"
                  value={inputs.migrationMarketCap}
                />
              </ParameterRow>
            </div>

            <ParameterRow
              label="Base trading fee"
              value={`${inputs.baseFeeBps} bps · ${(inputs.baseFeeBps / 100).toFixed(2)}%`}
            >
              <Slider
                aria-label="Base trading fee"
                className="signal-slider"
                max={300}
                min={25}
                onValueChange={([value]) => update("baseFeeBps", value)}
                step={5}
                value={[inputs.baseFeeBps]}
              />
            </ParameterRow>

            <ParameterRow
              label="Creator fee share"
              value={`${inputs.creatorTradingFeePercentage}%`}
            >
              <Slider
                aria-label="Creator trading fee share"
                className="signal-slider"
                max={100}
                min={0}
                onValueChange={([value]) =>
                  update("creatorTradingFeePercentage", value)
                }
                step={5}
                value={[inputs.creatorTradingFeePercentage]}
              />
            </ParameterRow>

            <ParameterRow
              label="Permanent liquidity lock"
              value={`${inputs.lockedLiquidityPercentage}%`}
            >
              <Slider
                aria-label="Permanent locked liquidity"
                className="signal-slider"
                max={60}
                min={10}
                onValueChange={([value]) =>
                  update("lockedLiquidityPercentage", value)
                }
                step={1}
                value={[inputs.lockedLiquidityPercentage]}
              />
            </ParameterRow>

            <ParameterRow
              label="Creator share of migrated LP"
              value={`${inputs.creatorLiquidityPercentage}%`}
            >
              <Slider
                aria-label="Creator share of migrated liquidity"
                className="signal-slider"
                max={90}
                min={10}
                onValueChange={([value]) =>
                  update("creatorLiquidityPercentage", value)
                }
                step={5}
                value={[inputs.creatorLiquidityPercentage]}
              />
            </ParameterRow>

            <ParameterRow label="DAMM v2 pool fee">
              <Select
                value={String(inputs.dammFeeBps)}
                onValueChange={(value) =>
                  update(
                    "dammFeeBps",
                    Number(value) as CurveInputs["dammFeeBps"],
                  )
                }
              >
                <SelectTrigger className="h-10 w-full border-[var(--line)] bg-[var(--surface-raised)] font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 30, 100, 200, 400, 600].map((fee) => (
                    <SelectItem key={fee} value={String(fee)}>
                      {fee} bps · {(fee / 100).toFixed(2)}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ParameterRow>

            <div className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-2.5">
              <div>
                <Label className="text-sm font-medium">Dynamic fee</Label>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Volatility-aware fee layer
                </p>
              </div>
              <Switch
                aria-label="Enable dynamic fees"
                checked={inputs.dynamicFeeEnabled}
                onCheckedChange={(checked) =>
                  update("dynamicFeeEnabled", checked)
                }
              />
            </div>
          </div>
        </aside>

        <section className="analysis-panel" aria-label="Curve analysis">
          <div className="panel-heading border-b border-[var(--line)]">
            <div>
              <p className="eyebrow">02 / Simulate</p>
              <h2>Capital path</h2>
            </div>
            <div className="legend">
              <span>
                <i className="bg-signal" /> Market cap
              </span>
              <span>
                <i className="bg-[var(--risk)]" /> Graduation
              </span>
            </div>
          </div>

          {snapshot ? (
            <>
              <div className="chart-stage">
                <div className="chart-stamp" aria-hidden="true">
                  SDK QUOTE TRACE / {quote}
                </div>
                <ResponsiveContainer
                  height="100%"
                  minHeight={320}
                  minWidth={0}
                  width="100%"
                >
                  <AreaChart
                    data={snapshot.points}
                    margin={{ bottom: 8, left: 6, right: 8, top: 22 }}
                  >
                    <defs>
                      <linearGradient
                        id="curveFill"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--signal)"
                          stopOpacity={0.34}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--signal)"
                          stopOpacity={0.015}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--chart-grid)"
                      strokeDasharray="2 7"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="progress"
                      domain={[0, 100]}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 11,
                      }}
                      tickFormatter={(value) => `${Math.round(value)}%`}
                      tickLine={false}
                      type="number"
                    />
                    <YAxis
                      axisLine={false}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 11,
                      }}
                      tickFormatter={(value) => compactNumber.format(value)}
                      tickLine={false}
                      width={58}
                    />
                    <ChartTooltip
                      content={<ChartTip />}
                      cursor={{
                        stroke: "var(--paper)",
                        strokeOpacity: 0.26,
                      }}
                    />
                    <ReferenceLine
                      label={{
                        fill: "var(--risk)",
                        fontSize: 10,
                        position: "insideTopRight",
                        value: "DAMM V2",
                      }}
                      stroke="var(--risk)"
                      strokeDasharray="4 5"
                      x={100}
                    />
                    <Area
                      animationDuration={420}
                      dataKey="marketCap"
                      fill="url(#curveFill)"
                      stroke="var(--signal)"
                      strokeWidth={2.4}
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="checkpoint-table-wrap">
                <table className="checkpoint-table">
                  <thead>
                    <tr>
                      <th>Curve state</th>
                      <th>Quote reserve</th>
                      <th>Market cap</th>
                      <th>Tokens distributed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 6, 12, 18, 24].map((index) => {
                      const point = snapshot.points[index];
                      return (
                        <tr key={index}>
                          <td>{Math.round(point.progress)}%</td>
                          <td>
                            {formatAmount(point.reserve, 3)} {quote}
                          </td>
                          <td>
                            {compactNumber.format(point.marketCap)} {quote}
                          </td>
                          <td>{compactNumber.format(point.tokensSold)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="graduation-rail">
                <div className="rail-line">
                  <span />
                </div>
                <div className="rail-labels">
                  <span>
                    <b>01</b> DBC active
                  </span>
                  <span>
                    <b>02</b>{" "}
                    {formatAmount(snapshot.migrationQuoteThreshold, 3)} {quote}{" "}
                    captured
                  </span>
                  <span className="text-right">
                    <b>03</b> DAMM v2 liquidity
                  </span>
                </div>
              </div>
            </>
          ) : result.error ? (
            <div className="error-state" role="alert">
              <Info className="size-5 text-[var(--risk)]" />
              <div>
                <strong>Curve cannot be built</strong>
                <p>{result.error}</p>
              </div>
            </div>
          ) : (
            <div className="loading-state" role="status">
              <span className="loading-trace" aria-hidden="true" />
              <div>
                <strong>Loading official SDK trace</strong>
                <p>Resolving curve points and graduation liquidity.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="decision-panel" aria-label="Graduation summary">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">03 / Inspect</p>
              <h2>Graduation brief</h2>
            </div>
            <Sparkles className="size-5 text-signal" aria-hidden="true" />
          </div>

          {snapshot ? (
            <div className="decision-content">
              <Metric
                accent
                detail="Net quote reserve required before the migrator can graduate the pool."
                label="Migration threshold"
                value={`${formatAmount(snapshot.migrationQuoteThreshold, 3)} ${quote}`}
              />
              <div className="grid grid-cols-2 border-y border-[var(--line)]">
                <Metric
                  detail="From launch to migration"
                  label="Price expansion"
                  value={`${formatAmount(snapshot.priceMultiple, 1)}×`}
                />
                <Metric
                  detail="Permanent at day one"
                  label="Liquidity locked"
                  value={`${inputs.lockedLiquidityPercentage}%`}
                />
              </div>
              <Metric
                detail={`${snapshot.creatorLockedLiquidityPercentage}% creator locked · ${snapshot.partnerLockedLiquidityPercentage}% partner locked`}
                label="Tokens distributed on curve"
                value={compactNumber.format(snapshot.tokensSoldAtMigration)}
              />

              <div className="integrity-block">
                <div className="mb-3 flex items-center justify-between">
                  <p className="eyebrow">Config integrity</p>
                  <span className="integrity-score">4 / 4</span>
                </div>
                {[
                  "Built by the official DBC SDK",
                  "DAMM v2 migration target",
                  "Liquidity allocation totals 100%",
                  "Day-one lock meets protocol floor",
                ].map((item) => (
                  <div className="integrity-row" key={item}>
                    <Check
                      className="size-3.5 text-signal"
                      strokeWidth={2.5}
                    />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="export-block">
                <div className="mb-3 flex items-start gap-2">
                  <Braces className="mt-0.5 size-4 text-signal" />
                  <div>
                    <p className="text-sm font-semibold">
                      Builder payload ready
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--muted-foreground)]">
                      Includes human inputs and resolved BN config values.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="export-primary" onClick={copyConfig}>
                    {copied ? <Check /> : <Copy />}
                    {copied ? "Copied" : "Copy JSON"}
                  </Button>
                  <Button
                    className="export-secondary"
                    onClick={downloadConfig}
                    variant="outline"
                  >
                    <ArrowDownToLine /> Download
                  </Button>
                </div>
              </div>
            </div>
          ) : result.error ? (
            <div className="px-5 py-8 text-sm text-[var(--muted-foreground)]">
              Correct the curve inputs to restore the graduation brief.
            </div>
          ) : (
            <div className="px-5 py-8 text-sm text-[var(--muted-foreground)]">
              Calculating the protocol-native graduation brief…
            </div>
          )}

          <footer className="decision-footer">
            <a
              href="https://github.com/MeteoraAg/dynamic-bonding-curve-sdk"
              rel="noreferrer"
              target="_blank"
            >
              <Code2 /> Source SDK <ChevronRight />
            </a>
            <span>
              <LockKeyhole /> Read-only simulation
            </span>
          </footer>
        </aside>
      </section>
    </main>
  );
}
