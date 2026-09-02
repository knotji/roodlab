# Global Win 6 score-distribution diagnostic

Freeze date: 2026-09-03  
Protocol fingerprint: `2b1bc6e29c03d3fe`  
History fingerprint: `7e8168eee826c46a`

## Protocol

- Exact frozen production ranking: curated 46 lotteries, same weekday, maximum 12 prior same-weekday observations per lottery, presence per draw, per-lottery normalization, top/bottom 50:50, overall Top 6.
- Target and future draws are excluded. No weights, windows, pool membership, strategies, or production interpretation were tuned.
- Gap bands use development-only tertiles and are applied unchanged to the chronological holdout.
- Labels require monotonic low-to-high side-pair uplift in development and holdout plus a holdout high-minus-low target-date bootstrap CI entirely above zero.
- Rank-bucket recall is normalized per digit position. Random expectations are 30%, 30%, and 40% for bucket sizes 3, 3, and 4.
- Pair baselines use exact combinatorial probabilities with double handling. Confidence intervals use 10,000 target-date clustered resamples.

## Data

- Period: 2026-04-16 to 2026-09-01
- Walk-forward dates: 123 (92 development / 31 holdout)
- Complete target outcomes: 4400

## Score-distribution metrics

- Rank 6–7 gap: min 0.0000, p25 0.0011, median 0.0024, p75 0.0071, max 0.0298, mean 0.0047.
- Mean Top-6 spread: 0.0393.
- Mean all-digit spread: 0.0712.
- Mean normalized entropy: 0.9959 (1 = flat).
- Mean concentration: 0.0041 (0 = flat).
- Development gap cuts: low <= 0.0015; middle <= 0.0048; otherwise high.

## Gap-band results

### Development

| Gap band | Dates | Outcomes | Side-pair hit | Exact random | Uplift | Either-side hit |
|---|---:|---:|---:|---:|---:|---:|
| low | 31 | 1108 | 36.15% | 35.82% | +0.32pp | 59.93% |
| middle | 31 | 1164 | 37.24% | 35.73% | +1.51pp | 60.65% |
| high | 30 | 906 | 33.39% | 35.66% | -2.27pp | 55.63% |

### Holdout

| Gap band | Dates | Outcomes | Side-pair hit | Exact random | Uplift | Either-side hit |
|---|---:|---:|---:|---:|---:|---:|
| low | 10 | 389 | 37.28% | 35.70% | +1.58pp | 63.24% |
| middle | 11 | 439 | 39.98% | 35.61% | +4.37pp | 63.55% |
| high | 10 | 394 | 37.06% | 35.67% | +1.39pp | 60.41% |

- Holdout high-minus-low side-pair uplift: -0.19pp; 95% CI -2.47pp to +2.64pp.
- Gap/date-level uplift correlation: development -0.225 (-0.451 to 0.032); holdout -0.100 (-0.460 to 0.171).

## Ranking bucket analysis

### Development

| Bucket | Digits | Top recall | Bottom recall | Combined | Random | Uplift | 95% CI uplift |
|---|---:|---:|---:|---:|---:|---:|---:|
| Rank 1–3 | 3 | 30.85% | 29.30% | 30.07% | 30.00% | +0.07pp | -0.68pp to +0.85pp |
| Rank 4–6 | 3 | 29.55% | 30.33% | 29.94% | 30.00% | -0.06pp | -0.78pp to +0.67pp |
| Rank 7–10 | 4 | 39.60% | 40.37% | 39.99% | 40.00% | -0.01pp | -0.83pp to +0.80pp |

### Holdout

| Bucket | Digits | Top recall | Bottom recall | Combined | Random | Uplift | 95% CI uplift |
|---|---:|---:|---:|---:|---:|---:|---:|
| Rank 1–3 | 3 | 32.45% | 28.64% | 30.54% | 30.00% | +0.54pp | -0.47pp to +1.54pp |
| Rank 4–6 | 3 | 30.56% | 31.87% | 31.22% | 30.00% | +1.22pp | +0.29pp to +2.07pp |
| Rank 7–10 | 4 | 36.99% | 39.48% | 38.24% | 40.00% | -1.76pp | -2.54pp to -0.93pp |

### All dates (descriptive)

| Bucket | Digits | Top recall | Bottom recall | Combined | Random | Uplift | 95% CI uplift |
|---|---:|---:|---:|---:|---:|---:|---:|
| Rank 1–3 | 3 | 31.30% | 29.11% | 30.20% | 30.00% | +0.20pp | -0.41pp to +0.83pp |
| Rank 4–6 | 3 | 29.83% | 30.76% | 30.30% | 30.00% | +0.30pp | -0.29pp to +0.88pp |
| Rank 7–10 | 4 | 38.88% | 40.13% | 39.50% | 40.00% | -0.50pp | -1.14pp to +0.15pp |

## Label decision

Labels justified: **NO**.

**No stable evidence that score concentration should change interpretation of the Top 6.**

No production concentration label or threshold is added. UI may expose only the mathematically raw rank 6–7 score gap.

## Contract confirmation

- Production formula changed: **none**.
- Prospective tracking added: **none**.
- Decision: **FROZEN_DIAGNOSTIC_ONLY_NO_TUNING**.
