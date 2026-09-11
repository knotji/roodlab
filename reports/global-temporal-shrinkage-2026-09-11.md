# Global temporal shrinkage study

Freeze date: 2026-09-11  
Code baseline: main@8a21e88  
Protocol: `abf14911ccffd461`  
History: `9baaf69f4ad8d1e4`

## Pre-registered question

Can a hierarchical, time-decayed per-lottery digit estimate improve Global Win 6 over frozen same-weekday frequency? This is a research-only model family. Production is not modified.

Each lottery is normalized before equal-source aggregation. Recent same-weekday observations receive exponential decay, then shrink toward that lottery's prior 84-draw all-days rate. The target date and all future draws are excluded. Doubles count once per side. Available top/bottom sides receive equal weight.

Development evaluates the fixed 12-candidate grid below and selects exactly one candidate. Holdout is the newest 25% of dates and is used once for the final decision.

## Development selection

| Half-life | Prior strength | Either-side hit | vs Production | vs exact random |
|---:|---:|---:|---:|---:|
| 8 | 6 | 60.07% | +0.36pp | +0.67pp |
| flat | 6 | 60.04% | +0.34pp | +0.64pp |
| 4 | 2 | 60.03% | +0.33pp | +0.63pp |
| 4 | 12 | 59.97% | +0.27pp | +0.57pp |
| flat | 2 | 59.95% | +0.24pp | +0.54pp |
| 8 | 2 | 59.89% | +0.18pp | +0.48pp |
| flat | 12 | 59.76% | +0.06pp | +0.36pp |
| 2 | 12 | 59.70% | +0.00pp | +0.30pp |
| 4 | 6 | 59.62% | -0.09pp | +0.22pp |
| 2 | 6 | 59.61% | -0.10pp | +0.20pp |
| 8 | 12 | 59.61% | -0.10pp | +0.20pp |
| 2 | 2 | 59.48% | -0.22pp | +0.08pp |

Selected: **half-life 8, prior strength 6**.

## Final results

| Section | Dates | Outcomes | Candidate | Production | Exact random | Candidate - Production | Candidate - random | Top | Bottom | Both |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Development | 69 | 8224 | 60.07% | 59.70% | 59.40% | +0.36pp | +0.67pp | 36.53% | 35.77% | 12.23% |
| Holdout | 23 | 2873 | 58.37% | 59.48% | 59.93% | -1.11pp | -1.56pp | 35.99% | 33.83% | 11.45% |
| All descriptive | 92 | 11097 | 59.63% | 59.65% | 59.54% | -0.02pp | +0.09pp | 36.39% | 35.27% | 12.03% |

- Holdout paired 95% CI vs Production: **-2.22pp to -0.27pp**
- Holdout uplift 95% CI vs exact random: **-3.03pp to -0.04pp**
- Positive holdout weekdays: **2/7**
- Worst holdout weekday: **-4.11pp**

## Decision

**REJECT_NO_STABLE_HOLDOUT_EDGE**

Passing would authorize a separate review only, never automatic production promotion. Development selection creates winner's-curse risk; holdout evidence must independently clear both comparison intervals and weekday consistency gates.

## Contract confirmation

- Production formula changed: **NO**
- Production pool or eligibility changed: **NO**
- Analyze UI changed: **NO**
- Gemini contract changed: **NO**
- Prospective tracking added: **NO**
