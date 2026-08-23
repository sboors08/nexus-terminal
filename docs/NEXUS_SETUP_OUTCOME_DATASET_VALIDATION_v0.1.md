# NEXUS Setup Outcome Dataset / Validation v0.1

## Status

Foundation implemented.

Current live source status at task start:

- Persistent Setup Event History runtime: `running`;
- persistence adapter: `json_file`;
- persistence state: `ready`;
- persistence version: `1`;
- persistence hydrated: `true`;
- persistence writable: `true`;
- persistence errors: `0`;
- retained lifecycle events: `0`;
- current factual validation status: `insufficient_sample`.

The absence of `setup-event-history-v1.json` while event count is zero is expected. The JSON persistence adapter returns `null` for `ENOENT` and creates the snapshot only when the first lifecycle event is persisted.

## Purpose

Build a factual offline dataset for completed production Setup Engine candidates.

This stage measures what the market did after a causal Setup confirmation.

It does not decide whether a setup was profitable or unprofitable.

## Source of truth

Setup identity and lifecycle source:

- Persistent Setup Event History;
- production candidate identity;
- production episode identity;
- causal `lineId`;
- factual lifecycle events.

Post-event price source:

- Binance USD-M Futures;
- real closed `1m` klines;
- no generated candles;
- no fixture market path.

## Eligible sample

A candidate becomes measurable only when:

1. a retained factual `THIRD_TOUCH_CONFIRMED` event exists;
2. a later factual terminal event exists:
   - `breakout_confirmed`;
   - `rejection_confirmed`;
   - `setup_expired`;
3. the full measurement window has elapsed;
4. the required closed Binance `1m` candles are available.

Terminal lifecycle and market outcome measurement are separate facts.

`breakout_confirmed` is not automatically `successful`.

`rejection_confirmed` is not automatically `failed`.

`setup_expired` is not automatically profitable or unprofitable.

## Anchor

The measurement anchor is the last retained `THIRD_TOUCH_CONFIRMED` event before the terminal event.

Anchor price:

- persisted `candidate.currentPrice` from that factual lifecycle event.

To prevent same-minute pre-anchor contamination:

- the complete one-minute candle containing the anchor timestamp is excluded;
- measurement starts at the next exact one-minute boundary;
- `anchorGapMs` records the omitted partial-minute interval.

This means candle `high` or `low` that happened before the exact confirmation timestamp cannot leak into post-anchor excursion metrics.

## Observation horizons

v0.1 records analytical checkpoints at:

- 5 minutes;
- 15 minutes;
- 30 minutes;
- 60 minutes.

These are measurement horizons only.

They do not change:

- Setup creation;
- Observation;
- Approach;
- Confirmation;
- breakout detection;
- rejection detection;
- expiry;
- ranking;
- level detection;
- trade execution.

No trading threshold is derived from these horizons in v0.1.

## Direction-aware measurements

For each complete sample:

- max favorable excursion percentage;
- max adverse excursion percentage;
- max favorable price;
- max adverse price;
- signed close return at 5m;
- signed close return at 15m;
- signed close return at 30m;
- signed close return at 60m.

For LONG:

- rising price is favorable;
- falling price is adverse.

For SHORT:

- falling price is favorable;
- rising price is adverse.

All percentages are measured relative to the factual third-touch anchor price.

## Measurement states

Each terminal candidate is classified only by data availability:

- `measured`;
- `pending_window`;
- `missing_third_touch_anchor`;
- `insufficient_candle_coverage`;
- `market_history_error`.

These are data-quality / measurement states.

They are not trading quality labels.

## Dataset-level status

v0.1 uses:

- `insufficient_sample` when there are zero complete measured candidates;
- `sample_available` when at least one complete measured candidate exists.

No statistical sufficiency threshold is applied yet.

The existence of one measured item does not mean the sample is large enough for Self-Learning or production rule changes.

## Explicitly not included

v0.1 does not produce:

- `successful`;
- `failed`;
- win rate;
- loss rate;
- profitability;
- PnL;
- fees;
- slippage;
- entry execution;
- stop loss;
- take profit;
- position sizing;
- trading recommendations;
- automatic parameter changes;
- model training;
- Self-Learning.

## Safety flags

The report explicitly records:

- `observationalOnly: true`;
- `profitabilityLabelApplied: false`;
- `sampleSufficiencyThresholdApplied: false`;
- `changesProductionSetup: false`;
- `changesTradingRules: false`;
- `tradeExecution: false`;
- `trainingApplied: false`;
- `futureMarketDataUsedForDetection: false`.

Post-event market candles may be used only for offline outcome measurement.

They are never fed back into the historical Setup detection decision.

## CLI

Command:

`npm run validate:setup-outcome-dataset`

Default History source:

`./data/setup-event-history-v1.json`

Default report:

`./.tmp/setup-outcome-dataset-validation/latest.json`

With the current zero-event runtime, the expected factual result is:

- History snapshot not yet present;
- retained events `0`;
- measured candidates `0`;
- status `insufficient_sample`.

That result is valid and must not be replaced with fixture or frozen validation data.

## Next stage

After a real sample exists:

1. inventory factual terminal candidates;
2. measure complete post-anchor windows;
3. inspect coverage and anomalies;
4. determine an explicit minimum sample requirement;
5. only then discuss possible success/failure labeling rules.

Self-Learning remains blocked until a later explicit decision.