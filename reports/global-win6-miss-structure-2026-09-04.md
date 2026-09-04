# Global Win 6 miss-structure audit

Freeze date: 2026-09-04  
Code baseline: `main@3c6a70c`  
Protocol fingerprint: `516b95e1c619557d`  
History fingerprint: `d3cfc005aae69edb`

## Research question

When Production Win 6 fails to cover a two-digit side, are outside digits approximately exchangeable or is there repeatable structure? This audit does not test Win 7 or any guard strategy.

## Production contract and pool

- Source: `src/lib/analysis/global-daily-sources.ts#GLOBAL_DAILY_SOURCE_IDS`; **46 active lotteries at main@3c6a70c**.
- Exact IDs: `nikkei-vip-morning`, `hanoiasean`, `nikkei-morning`, `szse-vip-morning`, `szse-morning`, `laotv`, `hsi-vip-morning`, `hsi-morning`, `xosohd`, `twse-vip`, `minhngocstar`, `twse`, `ktop30-vip`, `ktop30`, `nikkei-afternoon`, `nikkei-vip-afternoon`, `laoshd`, `szse-afternoon`, `minhngoctv`, `szse-vip-afternoon`, `hsi-vip-afternoon`, `hsi-afternoon`, `laostars`, `sgx`, `xosoredcross`, `set`, `sgx-vip`, `laounion`, `laosasean`, `laosvip`, `laounionvip`, `laostarsvip`, `england-vip`, `moexbc`, `xosoextra`, `gdaxi`, `ftse100`, `germany-vip`, `laoredcross`, `russia-vip`, `dowjones-vip`, `dowjonestar`, `dji`, `laocitizen`, `laosantipap`, `laopatuxay`
- Production `buildGlobalWeekdayWin`: same weekday, maximum 12 prior observations per lottery, digit presence per side/draw, per-lottery normalization, equal available-side weighting, deterministic score/top+bottom/digit tie order, overall ranks 1-6.
- Every target and future draw is excluded. Doubles contribute one unique outside digit.

## Data

- Range: 2026-04-16 to 2026-09-02
- Target dates: 124; outcomes: 4411; sides: 8822
- Stored sources: 46/46; read-only hydration: none

## Side-level miss structure

| Section | Sides | Full | One outside | Two outside | Rank 7 among one-outside |
|---|---:|---:|---:|---:|---:|
| development | 6416 | 35.86% | 51.84% | 12.30% | 832 (25.02%) |
| holdout | 2406 | 37.91% | 50.42% | 11.68% | 299 (24.65%) |
| all | 8822 | 36.42% | 51.45% | 12.13% | 1131 (24.92%) |

95% date-cluster bootstrap intervals: one-outside 50.58% to 52.33%, two-outside 11.52% to 12.74%; one-outside shares rank 7 23.86% to 25.96%, rank 8 24.25% to 26.41%, rank 9 23.91% to 25.92%, rank 10 23.76% to 25.88%; rank 7 minus mean ranks 8-10 -1.51% to 1.27%.

## Outcome-level structure

- Coverage: bothFull=571, topOnlyFull=1074, bottomOnlyFull=997, neitherFull=1769
- Unique outside digits across both sides: 0=571, 1=1885, 2=1612, 3=332, 4=11

## Outside ranks 7-10

| Global rank | Opportunities | Appearances | Conditional rate | Empirical expected | Top appearances | Bottom appearances | One-outside | Two-outside involvement |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7 | 8822 | 1673 | 18.96% | 18.40% | 817 | 856 | 1131 | 542 |
| 8 | 8822 | 1699 | 19.26% | 17.91% | 855 | 844 | 1150 | 549 |
| 9 | 8822 | 1652 | 18.73% | 17.18% | 794 | 858 | 1132 | 520 |
| 10 | 8822 | 1655 | 18.76% | 16.10% | 814 | 841 | 1126 | 529 |

Simple structural reference for one-outside rank share is 25% per position. The empirical expected column is leakage-safe and averages the production historical side rate only when that digit was outside.

Mean missed outside rank: 8.492; median: 8.0; distribution 7=1673, 8=1699, 9=1652, 10=1655.

## Two-outside position pairs

| Global rank pair | Count | Share |
|---|---:|---:|
| 7+8 | 203 | 18.97% |
| 7+9 | 171 | 15.98% |
| 7+10 | 168 | 15.70% |
| 8+9 | 167 | 15.61% |
| 8+10 | 179 | 16.73% |
| 9+10 | 182 | 17.01% |

Simple structural reference across six pairs is 16.67%; it is descriptive because outcome digit marginals are not uniform.

## Digit conditional outside rates

| Digit | Outside opportunities | Appearances | Conditional rate | Empirical expected | Top rate | Bottom rate | One-outside | Two-outside |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 2598 | 503 | 19.36% | 17.33% | 18.63% | 20.09% | 337 | 166 |
| 1 | 2174 | 448 | 20.61% | 16.78% | 20.98% | 20.24% | 296 | 152 |
| 2 | 2992 | 557 | 18.62% | 16.59% | 19.39% | 17.85% | 399 | 158 |
| 3 | 5036 | 923 | 18.33% | 17.37% | 18.55% | 18.11% | 631 | 292 |
| 4 | 3302 | 620 | 18.78% | 16.80% | 18.78% | 18.78% | 417 | 203 |
| 5 | 2482 | 469 | 18.90% | 17.74% | 17.00% | 20.79% | 309 | 160 |
| 6 | 3716 | 714 | 19.21% | 17.72% | 19.16% | 19.27% | 498 | 216 |
| 7 | 4304 | 803 | 18.66% | 17.83% | 17.66% | 19.66% | 532 | 271 |
| 8 | 5290 | 1014 | 19.17% | 17.77% | 18.34% | 20.00% | 695 | 319 |
| 9 | 3394 | 628 | 18.50% | 17.41% | 18.33% | 18.68% | 425 | 203 |

## Score-gap context

| Side class | Count | Mean rank 6-7 gap | Median gap |
|---|---:|---:|---:|
| FULL_COVERAGE | 3213 | 0.00400 | 0.00234 |
| ONE_OUTSIDE_DIGIT | 4539 | 0.00421 | 0.00241 |
| TWO_OUTSIDE_DIGITS | 1070 | 0.00420 | 0.00241 |

This is a consistency diagnostic only; no threshold is derived and the frozen score-distribution study is not reopened.

## Monthly stability

| Month | Sides | Full | One outside | Two outside | One-outside shares rank 7/8/9/10 |
|---|---:|---:|---:|---:|---|
| 2026-04 | 260 | 30.38% | 58.08% | 11.54% | 29.14% / 27.15% / 22.52% / 21.19% |
| 2026-05 | 918 | 35.84% | 51.09% | 13.07% | 26.87% / 24.52% / 25.16% / 23.45% |
| 2026-06 | 2522 | 35.73% | 52.10% | 12.17% | 25.04% / 26.26% / 24.28% / 24.43% |
| 2026-07 | 2590 | 36.41% | 51.16% | 12.43% | 23.77% / 24.30% / 25.58% / 26.34% |
| 2026-08 | 2474 | 38.12% | 50.53% | 11.36% | 24.80% / 25.52% / 25.12% / 24.56% |
| 2026-09 | 58 | 31.03% | 51.72% | 17.24% | 23.33% / 26.67% / 26.67% / 23.33% |

## Weekday diagnostic

| Weekday | Sides | Full | One outside | Two outside | One-outside shares rank 7/8/9/10 |
|---|---:|---:|---:|---:|---|
| วันอาทิตย์ | 872 | 36.24% | 52.87% | 10.89% | 23.21% / 22.78% / 26.25% / 27.77% |
| วันจันทร์ | 1398 | 36.34% | 51.36% | 12.30% | 23.96% / 26.88% / 25.35% / 23.82% |
| วันอังคาร | 1422 | 36.92% | 50.77% | 12.31% | 24.24% / 25.90% / 25.62% / 24.24% |
| วันพุธ | 1398 | 35.12% | 52.50% | 12.37% | 25.20% / 25.48% / 25.34% / 23.98% |
| วันพฤหัสบดี | 1434 | 37.10% | 50.91% | 11.99% | 25.21% / 24.93% / 22.60% / 27.26% |
| วันศุกร์ | 1410 | 37.73% | 49.79% | 12.48% | 26.64% / 27.07% / 24.36% / 21.94% |
| วันเสาร์ | 888 | 34.80% | 53.15% | 12.05% | 25.64% / 22.46% / 25.85% / 26.06% |

## Lottery-level heterogeneity

All rows are descriptive; no lottery is removed or reweighted. Interpret low sample counts cautiously.

| Lottery | Outcomes | Full sides | One outside | Two outside | Mean unique outside digits/outcome |
|---|---:|---:|---:|---:|---:|
| nikkei-vip-morning | 98 | 32.65% | 54.59% | 12.76% | 1.40 |
| hanoiasean | 98 | 35.71% | 52.55% | 11.73% | 1.30 |
| nikkei-morning | 89 | 35.96% | 55.06% | 8.99% | 1.25 |
| szse-vip-morning | 98 | 37.24% | 53.57% | 9.18% | 1.27 |
| szse-morning | 91 | 45.60% | 43.41% | 10.99% | 1.22 |
| laotv | 98 | 36.73% | 52.04% | 11.22% | 1.35 |
| hsi-vip-morning | 93 | 37.10% | 47.85% | 15.05% | 1.28 |
| hsi-morning | 88 | 34.66% | 53.41% | 11.93% | 1.35 |
| xosohd | 100 | 37.00% | 48.50% | 14.50% | 1.41 |
| twse-vip | 100 | 39.50% | 50.00% | 10.50% | 1.34 |
| minhngocstar | 100 | 39.50% | 46.50% | 14.00% | 1.42 |
| twse | 82 | 37.80% | 52.44% | 9.76% | 1.29 |
| ktop30-vip | 100 | 36.00% | 50.00% | 14.00% | 1.34 |
| ktop30 | 91 | 36.81% | 47.80% | 15.38% | 1.48 |
| nikkei-afternoon | 92 | 33.15% | 58.70% | 8.15% | 1.34 |
| nikkei-vip-afternoon | 100 | 38.50% | 47.00% | 14.50% | 1.27 |
| laoshd | 100 | 36.50% | 53.50% | 10.00% | 1.47 |
| szse-afternoon | 91 | 34.07% | 50.00% | 15.93% | 1.45 |
| minhngoctv | 100 | 36.00% | 53.00% | 11.00% | 1.35 |
| szse-vip-afternoon | 100 | 37.50% | 55.00% | 7.50% | 1.22 |
| hsi-vip-afternoon | 93 | 36.56% | 53.76% | 9.68% | 1.27 |
| hsi-afternoon | 88 | 31.82% | 54.55% | 13.64% | 1.45 |
| laostars | 98 | 38.78% | 46.94% | 14.29% | 1.40 |
| sgx | 88 | 32.39% | 51.14% | 16.48% | 1.51 |
| xosoredcross | 100 | 40.50% | 47.50% | 12.00% | 1.29 |
| set | 93 | 32.80% | 45.70% | 21.51% | 1.49 |
| sgx-vip | 98 | 38.27% | 50.00% | 11.73% | 1.28 |
| laounion | 100 | 38.00% | 52.00% | 10.00% | 1.41 |
| laosasean | 100 | 39.00% | 47.50% | 13.50% | 1.47 |
| laosvip | 98 | 36.22% | 51.53% | 12.24% | 1.48 |
| laounionvip | 100 | 41.50% | 47.50% | 11.00% | 1.31 |
| laostarsvip | 100 | 36.50% | 53.50% | 10.00% | 1.47 |
| england-vip | 100 | 40.50% | 46.00% | 13.50% | 1.46 |
| moexbc | 87 | 36.78% | 52.87% | 10.34% | 1.34 |
| xosoextra | 98 | 36.22% | 52.04% | 11.73% | 1.48 |
| gdaxi | 93 | 38.71% | 47.31% | 13.98% | 1.33 |
| ftse100 | 91 | 37.36% | 52.75% | 9.89% | 1.37 |
| germany-vip | 98 | 37.24% | 52.55% | 10.20% | 1.46 |
| laoredcross | 99 | 32.83% | 54.55% | 12.63% | 1.55 |
| russia-vip | 99 | 32.32% | 55.05% | 12.63% | 1.61 |
| dowjones-vip | 99 | 33.33% | 54.04% | 12.63% | 1.47 |
| dowjonestar | 98 | 31.12% | 60.20% | 8.67% | 1.54 |
| dji | 90 | 34.44% | 56.67% | 8.89% | 1.34 |
| laocitizen | 98 | 29.59% | 54.59% | 15.82% | 1.59 |
| laosantipap | 99 | 33.84% | 50.00% | 16.16% | 1.57 |
| laopatuxay | 97 | 39.69% | 52.58% | 7.73% | 1.34 |

## Conclusion

**Some descriptive differences may exist, but they are not stable enough across splits and time to justify action.**

## Limitations

- Exactly four digits are outside by construction; digit marginals are not uniform and ranks change daily.
- Production scores are often flat and rank 7 can be numerically close to rank 6.
- Outcomes across lotteries on a date are not independent and shared market effects may exist.
- Historical completeness limits the eligible range; this run had 46/46 sources stored.
- Multiple descriptive comparisons can create false-looking patterns; no individual table authorizes a strategy.
- Empirical baselines use leakage-safe historical production marginals but are descriptive, not a generative null model.

## Contract confirmation

- Production formula changed: **NO**
- Production pool changed: **NO**
- Production UI changed: **NO**
- Prospective tracking added: **NO**
- Win 7 or guard strategy evaluated: **NO**
