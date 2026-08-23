# NEXUS Setup Outcome Sample Sufficiency v0.1

## Status

Implementation stage.

This is an offline governance and data-readiness layer over
`Setup Outcome Dataset / Validation v0.1`.

It does not run inside production Setup detection.

## Purpose

Define an explicit minimum factual sample requirement before NEXUS may
move from raw post-anchor measurements to research of possible
success/failure labeling rules.

The policy is fixed before a large factual sample is observed so that
future measured outcomes do not silently redefine the gate.

## Source

Input:

- `Setup Outcome Dataset / Validation v0.1`;
- factual production lifecycle history;
- factual measured post-anchor Binance 1m windows.

No generated trading cases are accepted as factual sample.

## v0.1 minimum sample policy

Overall minimum:

- 100 eligible measured candidates.

Required primary cohorts:

- `level_breakout:long` — minimum 25;
- `level_breakout:short` — minimum 25;
- `level_bounce:long` — minimum 25;
- `level_bounce:short` — minimum 25.

An eligible measured candidate must:

- have `measurementStatus = measured`;
- retain complete lifecycle history;
- contain measured metrics.

The 100/25 policy is a governance threshold for research readiness.

It is not a claim of statistical power, profitability, predictive
validity, or production trading quality.

## Data-integrity blockers

The sample is blocked regardless of count when the current source
report contains:

- dropped retained history events;
- multiple terminal lifecycle anomalies;
- insufficient candle coverage;
- market-history errors;
- measured-count inconsistency;
- a measured item with incomplete retained lifecycle history;
- a measured item without metrics;
- a violation of the Outcome Dataset safety contract.

`pending_window` does not itself invalidate completed measured cases.

`missing_third_touch_anchor` does not itself invalidate the sample,
because a terminal candidate may legitimately expire before
`THIRD_TOUCH_CONFIRMED`.

## Statuses

- `blocked_data_integrity`
- `insufficient_total_sample`
- `insufficient_cohort_sample`
- `sufficient_for_next_research_stage`

`sufficient_for_next_research_stage` means only that research into
possible labeling rules may begin.

It does not apply a label.

## Explicitly excluded

This layer does not produce or apply:

- successful/failed labels;
- win/loss labels;
- PnL;
- profitability thresholds;
- stop loss;
- take profit;
- position sizing;
- Setup Score changes;
- ranking changes;
- production trading-rule changes;
- automatic tuning;
- model training;
- Self-Learning.

## Safety contract

Every report keeps:

- `observationalOnly: true`
- `profitabilityLabelApplied: false`
- `changesProductionSetup: false`
- `changesTradingRules: false`
- `tradeExecution: false`
- `trainingApplied: false`
- `statisticalPowerClaimed: false`

## CLI

Focused tests:

`npm run test:setup-outcome-sample-sufficiency`

Offline analysis:

`npm run analyze:setup-outcome-sample-sufficiency`

Default input:

`./.tmp/setup-outcome-dataset-validation/latest.json`

Default output:

`./.tmp/setup-outcome-sample-sufficiency/latest.json`

## Next stage

Keep factual collection running.

When the sufficiency report reaches
`sufficient_for_next_research_stage`, perform a separate explicit
research task for possible label definitions.

No success/failure labeling is authorized by this document.
