# Standout random-baseline study

Freeze date: 2026-08-27

## Production hit definition

The production metric selects two distinct standout digits. It inspects the concatenation of `top3` and `bottom2`; `top2` is not inspected separately. Positions do not matter. Duplicate outcome digits collapse for baseline purposes. A hit occurs when either selected digit appears at least once. Missing fields contribute no digits; this study uses canonical complete draws only. The implementation is shared by production backtest and this evaluator.

## Exact baseline

All 45 unordered distinct pairs from 0–9 are enumerated. For a target containing k unique digits, enumeration is asserted equal to `1 - C(10-k,2)/C(10,2)` per draw. Expected random hits are summed per draw; no Monte Carlo baseline is used.

## Evaluation protocol

Reused the Core study's newest 25% holdout for 21 lotteries (520 draws per algorithm), with a 30-draw strictly prior training window. Algorithms were frozen: Balanced v1, Momentum, Recent Weighted. Bootstrap CI uses paired excess `y_i-p_i`, seed 20260827, 10,000 resamples.

## Aggregate

| Algorithm | N | Observed | Exact baseline | Uplift | Excess hits | Bootstrap 95% CI | z |
|---|---:|---:|---:|---:|---:|---:|---:|
| Balanced v1 | 520 | 64.23% | 66.35% | -2.12pp | -11.0 | -6.15pp to +1.82pp | -1.04 |
| Momentum | 520 | 67.50% | 66.35% | +1.15pp | 6.0 | -2.89pp to +5.06pp | 0.57 |
| Recent Weighted | 520 | 64.42% | 66.35% | -1.92pp | -10.0 | -5.99pp to +2.04pp | -0.95 |

## Lottery consistency (tolerance ±2pp)

- Balanced: above 8, approximately baseline 6, below 7; median uplift +0.80pp; worst quartile -2.49pp.
- Momentum: above 10, approximately baseline 4, below 7; median uplift +1.69pp; worst quartile -2.50pp.

| Lottery | N | Baseline | Balanced | Uplift | Momentum | Uplift |
|---|---:|---:|---:|---:|---:|---:|
| goverment | 25 | 64.62% | 64.00% | -0.62pp | 72.00% | +7.38pp |
| hsi-afternoon | 24 | 66.57% | 45.83% | -20.74pp | 54.17% | -12.41pp |
| hsi-morning | 24 | 65.56% | 66.67% | +1.11pp | 79.17% | +13.61pp |
| hsi-vip-afternoon | 24 | 65.00% | 66.67% | +1.67pp | 62.50% | -2.50pp |
| hsi-vip-morning | 24 | 66.76% | 75.00% | +8.24pp | 66.67% | -0.09pp |
| laosdevelops | 24 | 55.46% | 58.33% | +2.87pp | 58.33% | +2.87pp |
| laoshd | 25 | 72.00% | 72.00% | +0.00pp | 76.00% | +4.00pp |
| laostars | 25 | 69.60% | 48.00% | -21.60pp | 56.00% | -13.60pp |
| laotv | 25 | 67.29% | 48.00% | -19.29pp | 60.00% | -7.29pp |
| minhngocstar | 25 | 69.96% | 68.00% | -1.96pp | 80.00% | +10.04pp |
| minhngoctv | 25 | 68.62% | 76.00% | +7.38pp | 72.00% | +3.38pp |
| nikkei-morning | 25 | 63.20% | 72.00% | +8.80pp | 64.00% | +0.80pp |
| nikkei-vip-afternoon | 25 | 63.73% | 68.00% | +4.27pp | 60.00% | -3.73pp |
| nikkei-vip-morning | 25 | 65.33% | 52.00% | -13.33pp | 76.00% | +10.67pp |
| szse-afternoon | 25 | 68.89% | 72.00% | +3.11pp | 80.00% | +11.11pp |
| szse-morning | 25 | 70.31% | 68.00% | -2.31pp | 72.00% | +1.69pp |
| szse-vip-afternoon | 25 | 67.20% | 68.00% | +0.80pp | 68.00% | +0.80pp |
| szse-vip-morning | 25 | 66.40% | 60.00% | -6.40pp | 64.00% | -2.40pp |
| twse | 25 | 64.18% | 68.00% | +3.82pp | 56.00% | -8.18pp |
| twse-vip | 25 | 66.49% | 64.00% | -2.49pp | 72.00% | +5.51pp |
| xosohd | 25 | 65.60% | 68.00% | +2.40pp | 68.00% | +2.40pp |

## Field availability

- top3+bottom2: n=520, baseline 66.35%, Balanced 64.23%, Momentum 67.50%.

## Unique target digits

| k | N | Baseline | Balanced | Uplift | Momentum | Uplift |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 20.00% | 0.00% | -20.00pp | 0.00% | -20.00pp |
| 2 | 12 | 37.78% | 33.33% | -4.44pp | 41.67% | +3.89pp |
| 3 | 98 | 53.33% | 52.04% | -1.29pp | 53.06% | -0.27pp |
| 4 | 271 | 66.67% | 63.47% | -3.20pp | 67.53% | +0.86pp |
| 5 | 138 | 77.78% | 77.54% | -0.24pp | 80.43% | +2.66pp |

## Sanity examples

- `goverment` 2026-08-01: target {4, 6, 7, 9}; 30/45 random pairs hit = 66.67%; Balanced selected 7 · 4 → hit.
- `goverment` 2026-07-16: target {1, 2, 4, 7}; 30/45 random pairs hit = 66.67%; Balanced selected 7 · 6 → hit.
- `goverment` 2026-07-01: target {2, 4, 5, 6, 9}; 35/45 random pairs hit = 77.78%; Balanced selected 7 · 0 → miss.

## Interpretation

No meaningful evidence: the evaluated standout ranking does not establish stable uplift over the exact random baseline.

Recommended product copy: **เลขที่โดดเด่นจากสถิติย้อนหลัง**. Do not use probability, confidence, or prediction-confidence language.

## FORMULA RESEARCH FROZEN

Balanced v1 remains default. No algorithm weights or definitions were changed. Further formula changes require genuinely unseen draws arriving after 2026-08-27.

Prospective protocol: keep algorithms frozen; accumulate at least 30 new complete draws per lottery where feasible; evaluate Balanced v1 and Momentum sequentially using only prior draws; compare each outcome with its exact per-draw 45-pair baseline; publish all eligible lotteries and do not auto-promote.

## History versions

- `goverment`: `14a5025b998cad`
- `hsi-afternoon`: `0ee7e6f69ffae8`
- `hsi-morning`: `00f6f72074ecbd`
- `hsi-vip-afternoon`: `1ddb122508bbfb`
- `hsi-vip-morning`: `0c26b2d844a6c5`
- `laosdevelops`: `0a39619e8ec0c2`
- `laoshd`: `14a239eccc7c56`
- `laostars`: `02a7ff182d2324`
- `laotv`: `18470448a04a3e`
- `minhngocstar`: `0f26945180cedb`
- `minhngoctv`: `1cf1a15d8cddd2`
- `nikkei-morning`: `14a7df65437411`
- `nikkei-vip-afternoon`: `014afba4b506d6`
- `nikkei-vip-morning`: `077eb0305dc57a`
- `szse-afternoon`: `1cb8703fbd9fbc`
- `szse-morning`: `1047a46d50dd58`
- `szse-vip-afternoon`: `1b2f87bedc79c2`
- `szse-vip-morning`: `166e9e41d52ac8`
- `twse`: `0aec5ffa11b0f4`
- `twse-vip`: `1270f975901d34`
- `xosohd`: `15eb99ef38186c`
