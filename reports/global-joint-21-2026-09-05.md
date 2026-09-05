# Global Joint 21 frozen study

Freeze date: 2026-09-05  
Baseline: `main@25d75de`  
Protocol: `e48adff58c7dddc8`  
History: `dc614cb92513a4ed`

## Frozen protocol

Deterministic greedy maximum joint-coverage over exactly 21 canonical reverse-pairs. Every lottery is normalized internally before equal-source aggregation; same weekday, maximum 12 strictly prior observations, complete top/bottom events only. No target or future result enters selection. Frequency Top 21 is the single comparator. Random both-side reference uses the actual reverse-expanded count K: `(K/100)^2`. It is an independence reference, not a model of lottery dependence.

## Sample set

- Pairs: 13 14 05 57 12 24 78 56 36 59 03 49 06 09 18 27 38 45 37 29 08
- Doubles: none
- Expanded actual numbers: 42
- Historical both-side coverage: 25.21%; top 45.73%; bottom 47.92%
- Historical source coverage: 100.00%

## Walk-forward results

| Section | Dates | Outcomes | Joint both | Frequency both | Paired diff | Paired 95% CI | Random reference | Joint vs random |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| development | 89 | 7641 | 17.85% | 18.54% | -0.69pp | -1.72pp to +0.34pp | 17.41% | +0.44pp |
| holdout | 30 | 3710 | 19.08% | 18.87% | +0.22pp | -0.96pp to +1.35pp | 17.58% | +1.50pp |
| all | 119 | 11351 | 18.25% | 18.65% | -0.40pp | -1.20pp to +0.38pp | 17.47% | +0.79pp |

### Joint 21 outcome classification

| Section | Top coverage | Bottom coverage | Top only | Bottom only | Miss |
|---|---:|---:|---:|---:|---:|
| development | 42.46% | 43.32% | 24.60% | 25.47% | 32.08% |
| holdout | 42.40% | 43.99% | 23.32% | 24.91% | 32.70% |
| all | 42.44% | 43.54% | 24.18% | 25.28% | 32.28% |

## Decision

**REJECT**. Joint 21 does not provide stable holdout evidence sufficient to alter production.

## Contract confirmation

- Production Global Win changed: **NO**
- Production weights or eligibility changed: **NO**
- Gemini contract changed: **NO**
- Prospective tracking added: **NO**
- Predictive/probability claim: **NO**
