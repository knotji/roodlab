# Global Hot 3 + Cold 3 study

Freeze date: 2026-09-03  
Protocol fingerprint: `25e1427fd0daee60`  
History fingerprint: `b81983030358d616`

## Research question

Does selecting digits from both extremes of the historical production ranking change out-of-sample coverage versus Overall Top 6? Hot and cold are historical rank labels only; no due-number interpretation is made.

## Pre-registered protocol

- Universe: exact current production pool at `main@37da122`: **39 lotteries** from `GLOBAL_DAILY_SOURCE_IDS`.
- Previous frozen 46-lottery studies are historical archives. Their results are not combined with or used to select this conclusion.
- Ranking: existing production `buildGlobalWeekdayWin`; same weekday; at most 12 prior matching weekdays per lottery; presence per draw; per-lottery normalization; top/bottom 50:50; unchanged deterministic comparator.
- A Overall Top 6: ranks 1-6.
- B Hot3Cold3: ranks 1-3 and 8-10; rank 7 intentionally excluded.
- Primary metric: full two-digit hit on either top2 or bottom2.
- Exact random baseline: all 210 six-of-ten sets, including double-aware coverage.
- Development/holdout: oldest 75% / newest 25% of eligible target dates.
- Uncertainty: 10,000 target-date cluster bootstrap iterations.
- No other strategy, rank set, window, weight, or pool was evaluated.

## Data

- Range: 2026-05-26 to 2026-09-01
- Target dates: 99
- Complete target outcomes: 3516
- Sources already stored: 39/39
- Read-only hydration: none

Absolute rates are not directly comparable with previous 46-lottery reports because this study intentionally uses the current 39-lottery production universe.

## Primary result

| Section | Dates | Outcomes | Overall Top 6 | Hot3Cold3 | Exact random | A uplift | A uplift 95% CI | B uplift | B uplift 95% CI | Paired B - A | Paired 95% CI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| development | 74 | 2683 | 60.79% | 58.33% | 59.50% | +1.29pp | -0.20pp to +2.78pp | -1.17pp | -2.70pp to +0.34pp | -2.46pp | -4.51pp to -0.45pp |
| holdout | 25 | 833 | 60.86% | 57.74% | 59.71% | +1.16pp | -1.70pp to +3.95pp | -1.96pp | -4.67pp to +0.81pp | -3.12pp | -6.42pp to +0.49pp |
| all | 99 | 3516 | 60.81% | 58.19% | 59.55% | +1.26pp | -0.06pp to +2.59pp | -1.36pp | -2.69pp to -0.03pp | -2.62pp | -4.36pp to -0.86pp |

## Secondary metrics - all data

| Metric | Overall Top 6 | Hot3Cold3 | Exact random | A uplift | B uplift |
|---|---:|---:|---:|---:|---:|
| top | 37.68% | 35.07% | 35.82% | +1.86pp | -0.75pp |
| bottom | 35.86% | 34.41% | 35.64% | +0.23pp | -1.22pp |
| either | 60.81% | 58.19% | 59.55% | +1.26pp | -1.36pp |
| both | 12.74% | 11.29% | 11.91% | +0.83pp | -0.62pp |
| recall | 60.83% | 59.18% | 60.00% | +0.83pp | -0.82pp |

Secondary metrics are descriptive and are not used to select a strategy.

## Paired outcome decomposition - all data

- Both hit: **1119** (31.83%)
- Overall Top 6 only: **1019** (28.98%)
- Hot3Cold3 only: **927** (26.37%)
- Neither: **451** (12.83%)

## Unique-rank occurrence diagnostic

Digit-position recall for the non-shared ranks, descriptive only:

- Ranks 4-6: **30.98%**
- Ranks 8-10: **29.33%**

This is out-of-sample occurrence, not evidence that low-ranked digits are due.

## Time consistency

| Month | Dates | Outcomes | Overall Top 6 | Hot3Cold3 | Paired B - A |
|---|---:|---:|---:|---:|---:|
| 2026-05 | 6 | 215 | 60.00% | 58.14% | -1.86pp |
| 2026-06 | 30 | 1093 | 61.12% | 57.37% | -3.75pp |
| 2026-07 | 31 | 1120 | 60.18% | 59.11% | -1.07pp |
| 2026-08 | 31 | 1071 | 61.34% | 57.89% | -3.45pp |
| 2026-09 | 1 | 17 | 58.82% | 70.59% | +11.76pp |

## Conclusion

**Hot3Cold3 did not improve the primary metric; keep Overall Top 6.**

## Limitations

- Retrospective historical analysis cannot establish future predictive advantage.
- Related lottery families may be correlated.
- Month-level estimates can be noisy, especially when few target dates are eligible.
- This is exactly one pre-registered comparison on the current 39-lottery universe.

## Contract confirmation

- Production formula changed: **NO**
- Production UI changed: **NO**
- Prospective tracking added: **NO**
- Production promotion authorized: **NO**
