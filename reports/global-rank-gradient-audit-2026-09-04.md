# Global production rank-gradient audit

Freeze date: 2026-09-04  
Code baseline: `main@05fb4e2`  
Protocol fingerprint: `3e82ebb4d742b66e`  
History fingerprint: `d3cfc005aae69edb`

## Research question

Does the complete Production rank 1-10 contain stable ordinal information about subsequent digit appearance? This is not a Win-set strategy test.

## Difference from prior frozen work

The miss-structure audit compared only ranks 7-10 after exclusion from Win 6. This audit measures the full rank 1-10 gradient. Rank Consensus, score-gap, Hot/Cold, and family audits remain frozen and are not reinterpreted.

## Production contract and pool

- Source: `src/lib/analysis/global-daily-sources.ts#GLOBAL_DAILY_SOURCE_IDS`; **46 lotteries at main@05fb4e2**.
- Exact IDs: `nikkei-vip-morning`, `hanoiasean`, `nikkei-morning`, `szse-vip-morning`, `szse-morning`, `laotv`, `hsi-vip-morning`, `hsi-morning`, `xosohd`, `twse-vip`, `minhngocstar`, `twse`, `ktop30-vip`, `ktop30`, `nikkei-afternoon`, `nikkei-vip-afternoon`, `laoshd`, `szse-afternoon`, `minhngoctv`, `szse-vip-afternoon`, `hsi-vip-afternoon`, `hsi-afternoon`, `laostars`, `sgx`, `xosoredcross`, `set`, `sgx-vip`, `laounion`, `laosasean`, `laosvip`, `laounionvip`, `laostarsvip`, `england-vip`, `moexbc`, `xosoextra`, `gdaxi`, `ftse100`, `germany-vip`, `laoredcross`, `russia-vip`, `dowjones-vip`, `dowjonestar`, `dji`, `laocitizen`, `laosantipap`, `laopatuxay`
- Exact `buildGlobalWeekdayWin`: same weekday, maximum 12 prior observations per lottery, presence per draw/side, per-lottery normalization, equal available-side weighting, deterministic score/top+bottom/digit ordering.

## Frozen analysis

- Primary statistic: unweighted mean target-date Spearman correlation between ranks 1-10 and future either-side appearance rates; negative indicates expected ordinal direction.
- Uniform references: 19.00% per side and 34.39% either-side for independent uniform digits.
- Digit adjustment: prior-only expanding marginal for each digit; residual observed either presence minus prior marginal.
- Adjacent tie tolerance: exactly zero. Chronological 75/25 split; 10,000 target-date cluster bootstrap iterations.
- No alternative strategy, weight, window, pool, threshold, or model was tested.

## Data

- Range: 2026-04-16 to 2026-09-02
- Dates: 124; outcomes: 4411; sides: 8822
- Stored sources: 46/46; read-only hydration: none

## Full rank table - all

| Rank | Opportunities | Top | Top rate | Bottom | Bottom rate | Either | Either rate | Marginal-adjusted |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 4411 | 859 | 19.47% | 836 | 18.95% | 1558 | 35.32% | -0.09pp |
| 2 | 4411 | 912 | 20.68% | 811 | 18.39% | 1584 | 35.91% | +0.88pp |
| 3 | 4411 | 850 | 19.27% | 835 | 18.93% | 1554 | 35.23% | +0.18pp |
| 4 | 4411 | 857 | 19.43% | 865 | 19.61% | 1583 | 35.89% | +0.98pp |
| 5 | 4411 | 811 | 18.39% | 824 | 18.68% | 1511 | 34.26% | -0.58pp |
| 6 | 4411 | 844 | 19.13% | 871 | 19.75% | 1577 | 35.75% | +0.93pp |
| 7 | 4411 | 817 | 18.52% | 856 | 19.41% | 1528 | 34.64% | -0.20pp |
| 8 | 4411 | 855 | 19.38% | 844 | 19.13% | 1563 | 35.43% | +0.91pp |
| 9 | 4411 | 794 | 18.00% | 858 | 19.45% | 1516 | 34.37% | -0.10pp |
| 10 | 4411 | 814 | 18.45% | 841 | 19.07% | 1542 | 34.96% | +0.62pp |

Development and Holdout full tables follow.

### Development
| 1 | 3208 | 612 | 19.08% | 610 | 19.01% | 1123 | 35.01% | -0.27pp |
| 2 | 3208 | 658 | 20.51% | 591 | 18.42% | 1146 | 35.72% | +0.79pp |
| 3 | 3208 | 613 | 19.11% | 602 | 18.77% | 1125 | 35.07% | +0.08pp |
| 4 | 3208 | 626 | 19.51% | 628 | 19.58% | 1146 | 35.72% | +0.92pp |
| 5 | 3208 | 592 | 18.45% | 591 | 18.42% | 1088 | 33.92% | -0.80pp |
| 6 | 3208 | 601 | 18.73% | 624 | 19.45% | 1120 | 34.91% | +0.24pp |
| 7 | 3208 | 608 | 18.95% | 632 | 19.70% | 1123 | 35.01% | +0.17pp |
| 8 | 3208 | 624 | 19.45% | 618 | 19.26% | 1140 | 35.54% | +1.17pp |
| 9 | 3208 | 590 | 18.39% | 632 | 19.70% | 1118 | 34.85% | +0.48pp |
| 10 | 3208 | 602 | 18.77% | 598 | 18.64% | 1114 | 34.73% | +0.54pp |

### Holdout
| 1 | 1203 | 247 | 20.53% | 226 | 18.79% | 435 | 36.16% | +0.39pp |
| 2 | 1203 | 254 | 21.11% | 220 | 18.29% | 438 | 36.41% | +1.10pp |
| 3 | 1203 | 237 | 19.70% | 233 | 19.37% | 429 | 35.66% | +0.46pp |
| 4 | 1203 | 231 | 19.20% | 237 | 19.70% | 437 | 36.33% | +1.15pp |
| 5 | 1203 | 219 | 18.20% | 233 | 19.37% | 423 | 35.16% | +0.02pp |
| 6 | 1203 | 243 | 20.20% | 247 | 20.53% | 457 | 37.99% | +2.75pp |
| 7 | 1203 | 209 | 17.37% | 224 | 18.62% | 405 | 33.67% | -1.20pp |
| 8 | 1203 | 231 | 19.20% | 226 | 18.79% | 423 | 35.16% | +0.24pp |
| 9 | 1203 | 204 | 16.96% | 226 | 18.79% | 398 | 33.08% | -1.65pp |
| 10 | 1203 | 212 | 17.62% | 243 | 20.20% | 428 | 35.58% | +0.82pp |

## Primary ordinal statistic and uncertainty

- All mean date-level Spearman: **-0.020**, 95% CI **-0.078 to 0.038**.
- Development: 0.005; Holdout: -0.096.
- Pooled-rank Spearman (descriptive): -0.455.

## Adjacent monotonicity

Decreases 4/9; exact ties 0/9; reversals 5/9. Largest expected step after rank 4: +1.63pp; largest reversal after rank 5: -1.50pp.

## Five equal rank bands

| Band | Top | Bottom | Either | Marginal-adjusted either |
|---|---:|---:|---:|---:|
| Ranks 1-2 | 20.07% | 18.67% | 35.62% | +0.39pp |
| Ranks 3-4 | 19.35% | 19.27% | 35.56% | +0.58pp |
| Ranks 5-6 | 18.76% | 19.21% | 35.00% | +0.17pp |
| Ranks 7-8 | 18.95% | 19.27% | 35.04% | +0.35pp |
| Ranks 9-10 | 18.23% | 19.26% | 34.66% | +0.26pp |

## High / Middle / Low and split

| Section | Dates | Outcomes | Mean Spearman | High 1-2 | Middle 5-6 | Low 9-10 | High-Low | Adjusted High-Low |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| development | 93 | 3208 | 0.005 | 35.36% | 34.41% | 34.79% | +0.58pp | -0.25pp |
| holdout | 31 | 1203 | -0.096 | 36.28% | 36.58% | 34.33% | +1.95pp | +1.16pp |
| all | 124 | 4411 | -0.020 | 35.62% | 35.00% | 34.66% | +0.95pp | +0.14pp |

All-data 95% CIs: High 34.70% to 36.52%; Middle 34.18% to 35.87%; Low 33.79% to 35.52%; High-Low -0.42pp to +2.31pp; adjusted High-Low -1.25pp to +1.51pp.

## Digit identity confound

| Digit | Mean rank | Median rank | Rank 1-2 share | Rank 1-6 share | Target either rate | Within-digit Spearman |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 4.83 | 5.0 | 32.26% | 67.74% | 35.86% | -0.157 |
| 1 | 5.01 | 5.0 | 20.16% | 70.97% | 36.11% | 0.010 |
| 2 | 5.01 | 4.0 | 37.10% | 66.13% | 35.28% | -0.181 |
| 3 | 6.21 | 7.0 | 16.94% | 45.97% | 34.28% | -0.035 |
| 4 | 5.31 | 5.0 | 25.00% | 64.52% | 35.84% | 0.045 |
| 5 | 4.90 | 4.5 | 16.94% | 70.97% | 35.09% | -0.038 |
| 6 | 5.93 | 6.0 | 5.65% | 58.87% | 35.34% | 0.143 |
| 7 | 5.78 | 6.0 | 20.16% | 52.42% | 34.57% | 0.034 |
| 8 | 6.57 | 7.0 | 3.23% | 42.74% | 34.46% | 0.199 |
| 9 | 5.46 | 5.5 | 22.58% | 59.68% | 34.91% | -0.109 |

The prior-only adjusted gradient distinguishes daily ordering from persistent digit identity without fitting a prediction model.

## Monthly stability

| Month | Dates | Outcomes | Spearman | High | Middle | Low | High-Low |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-04 | 10 | 130 | 0.074 | 34.62% | 31.54% | 32.31% | +2.31pp |
| 2026-05 | 20 | 459 | -0.047 | 35.40% | 33.01% | 34.20% | +1.20pp |
| 2026-06 | 30 | 1261 | -0.000 | 35.45% | 35.01% | 34.42% | +1.03pp |
| 2026-07 | 31 | 1295 | 0.041 | 35.14% | 34.67% | 35.75% | -0.62pp |
| 2026-08 | 31 | 1237 | -0.127 | 36.54% | 36.30% | 34.16% | +2.38pp |
| 2026-09 | 2 | 29 | 0.170 | 32.76% | 41.38% | 36.21% | -3.45pp |

## Weekday stability

| Weekday | Dates | Outcomes | Spearman | High | Middle | Low | High-Low |
|---|---:|---:|---:|---:|---:|---:|---:|
| วันอาทิตย์ | 14 | 436 | -0.057 | 36.93% | 35.78% | 36.70% | +0.23pp |
| วันจันทร์ | 19 | 699 | -0.045 | 35.62% | 33.69% | 33.91% | +1.72pp |
| วันอังคาร | 19 | 711 | -0.031 | 35.30% | 35.16% | 33.97% | +1.34pp |
| วันพุธ | 19 | 699 | 0.124 | 34.98% | 36.62% | 35.91% | -0.93pp |
| วันพฤหัสบดี | 20 | 717 | -0.033 | 33.68% | 35.43% | 33.96% | -0.28pp |
| วันศุกร์ | 19 | 705 | -0.158 | 37.73% | 33.55% | 33.05% | +4.68pp |
| วันเสาร์ | 14 | 444 | 0.071 | 35.59% | 35.14% | 36.71% | -1.13pp |

## Top versus bottom

The full table reports top and bottom separately for every rank and every band. Existing 50:50 Production weighting is unchanged.

## Lottery heterogeneity

Minimum 30 outcomes: 46/46 eligible; positive High-Low 26, zero 0, negative 20; median +0.57pp. Extremes are inspection-only.

| Lottery | Outcomes | High-Low |
|---|---:|---:|
| laosantipap | 99 | -9.09pp |
| set | 93 | -8.06pp |
| szse-vip-afternoon | 100 | -6.00pp |
| nikkei-vip-morning | 98 | -5.61pp |
| laocitizen | 98 | -5.61pp |
| laoshd | 100 | +14.50pp |
| szse-morning | 91 | +9.34pp |
| nikkei-afternoon | 92 | +7.61pp |
| laounionvip | 100 | +7.00pp |
| nikkei-morning | 89 | +6.18pp |

## Frozen interpretation

**RAW_GRADIENT_MAINLY_EXPLAINED_BY_DIGIT_IDENTITY**

UX implication for descriptive High/Middle/Low labels: **NOT SUPPORTED**. A higher Production score may be described as a higher historical rank; it must not be translated into a greater probability of appearing unless the evidence supports that separate claim. No UI change is authorized.

## Limitations

- Rankings are relative among only ten digits; identities have unequal marginals and scores are often flat.
- Adjacent ranks can have tiny score differences; repeated ranks and outcomes on the same date are correlated.
- Lotteries and shared market sessions may not be independent.
- Storage completeness limits the period; all 46 sources were available here.
- Monthly, weekday, side, digit, and lottery slices are descriptive and can show chance patterns.
- Ordinal association is not probability or proof of prediction; retrospective evidence need not persist.

## Contract confirmation

- Production formula changed: **NO**
- Production pool changed: **NO**
- Production UI changed: **NO**
- Prospective tracking added: **NO**
- New strategy tested: **NO**
