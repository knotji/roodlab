# Current Production Global Win 6 evidence

Freeze date: 2026-09-11  
Protocol: `b32c2e36a4820f06`  
History: `e807f4ad9acc4b35`

## Frozen question

Does the current Production Global Win 6 beat the exact random-set baseline under the identical hit definition? This evaluator validates one existing strategy. It does not search candidates, tune weights, or change Production.

## Exact production contract

- Uses the weekday-specific Played Universe from the current production source of truth.
- Calls `buildProductionGlobalWeekdayWin`; no parallel scoring implementation.
- Same weekday only, at most 12 prior observations per lottery.
- Equal-source aggregation and available-side equal weighting.
- Selects the first 6 digits from the Production ranking.
- Target and future draws are excluded from training.
- Historical runs ignore today's provider suspension/freshness state; current state is not back-propagated.
- Outcomes are complete top2+bottom2 draws from the same Played Universe.
- Exact random baseline enumerates all 210 Win 6 subsets separately for every outcome, including doubles and shared digits.
- Confidence intervals use 10,000 target-date clustered bootstrap resamples.

## Results

- Evaluated dates: **117** (2026-05-06 to 2026-09-10)
- Complete outcomes: **3465**

| Metric | Production | Exact random | Uplift | Clustered 95% CI of uplift |
|---|---:|---:|---:|---:|
| Full pair covered - top | 37.52% | 35.98% | +1.54pp | +0.08pp to +3.02pp |
| Full pair covered - bottom | 35.61% | 35.63% | -0.02pp | -1.48pp to +1.45pp |
| Full pair covered - either side | 60.20% | 59.44% | +0.76pp | -0.75pp to +2.24pp |
| Full pair covered - both sides | 12.93% | 12.18% | +0.75pp | -0.29pp to +1.81pp |
| Digit recall across four positions | 60.24% | 60.00% | +0.24pp | -0.42pp to +0.91pp |

## Monthly consistency - primary either-side metric

| Month | Dates | Outcomes | Production | Exact random | Uplift |
|---|---:|---:|---:|---:|---:|
| 2026-05 | 17 | 185 | 60.54% | 58.76% | +1.78pp |
| 2026-06 | 28 | 910 | 57.80% | 59.01% | -1.21pp |
| 2026-07 | 31 | 1031 | 60.43% | 59.50% | +0.93pp |
| 2026-08 | 31 | 1012 | 61.26% | 59.58% | +1.68pp |
| 2026-09 | 10 | 327 | 62.69% | 60.39% | +2.30pp |

## Decision

**NO_CLEAR_EDGE_OVER_EXACT_RANDOM_BASELINE**

The primary metric is full two-digit coverage on either top or bottom. Retrospective evidence alone does not establish a future probability claim. A positive interval would require confirmation on independent, untouched future data before any predictive wording.

## Change boundary

- Production formula changed: **NO**
- Weights/window/source lists changed: **NO**
- Analyze UI changed by this study: **NO**
- Candidate search performed: **NO**
