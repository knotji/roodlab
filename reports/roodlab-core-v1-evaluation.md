# RoodLab Core v1 evaluation

Generated: 2026-08-27T08:06:02.033Z

## Frozen protocol

- Canonical complete draws only; 30-draw training window.
- Per lottery: oldest 75% development, newest 25% untouched holdout.
- Candidate definitions were frozen before holdout evaluation.
- Robustness = 35% cross-lottery consistency + 25% long-horizon aggregate + 20% pair ranking quality + 10% standout + 10% downside protection. It is not a probability.
- Promotion requires higher Top10, non-worse Top1/Top4/Top20/worst quartile, non-higher mean rank, and non-higher dispersion than Balanced v1.

## Dataset (19 lotteries)

Only 19 cached lotteries met the 80-complete-draw requirement; BAAC had 41 and was excluded.

- `goverment` (หวยรัฐบาล): 2022-06-16 to 2026-08-01; dev 75, holdout 25; historyVersion `14a5025b998cad`
- `hsi-afternoon` (หุ้นฮั่งเส็งบ่าย): 2026-04-09 to 2026-08-26; dev 72, holdout 24; historyVersion `0ee7e6f69ffae8`
- `hsi-morning` (หุ้นฮั่งเส็งเช้า): 2026-04-09 to 2026-08-26; dev 72, holdout 24; historyVersion `00f6f72074ecbd`
- `hsi-vip-morning` (หุ้นฮั่งเส็ง VIP เช้า): 2026-05-19 to 2026-08-26; dev 71, holdout 24; historyVersion `0c26b2d844a6c5`
- `laosdevelops` (ลาวพัฒนา): 2026-03-02 to 2026-08-25; dev 71, holdout 24; historyVersion `0a39619e8ec0c2`
- `laoshd` (ลาว HD): 2026-05-20 to 2026-08-27; dev 75, holdout 25; historyVersion `14a239eccc7c56`
- `laotv` (ลาวทีวี): 2026-05-19 to 2026-08-26; dev 75, holdout 25; historyVersion `18470448a04a3e`
- `minhngocstar` (ฮานอยสตาร์): 2026-05-18 to 2026-08-25; dev 75, holdout 25; historyVersion `0f26945180cedb`
- `minhngoctv` (ฮานอยทีวี): 2026-05-19 to 2026-08-26; dev 75, holdout 25; historyVersion `1cf1a15d8cddd2`
- `nikkei-morning` (หุ้นนิคเคอิเช้า): 2026-04-01 to 2026-08-25; dev 73, holdout 25; historyVersion `14a7df65437411`
- `nikkei-vip-afternoon` (หุ้นนิคเคอิ VIP บ่าย): 2026-05-19 to 2026-08-26; dev 75, holdout 25; historyVersion `014afba4b506d6`
- `nikkei-vip-morning` (หุ้นนิคเคอิ VIP เช้า): 2026-05-19 to 2026-08-26; dev 75, holdout 25; historyVersion `077eb0305dc57a`
- `szse-afternoon` (หุ้นจีนบ่าย): 2026-04-09 to 2026-08-26; dev 72, holdout 25; historyVersion `1cb8703fbd9fbc`
- `szse-morning` (หุ้นจีนเช้า): 2026-04-09 to 2026-08-26; dev 72, holdout 25; historyVersion `1047a46d50dd58`
- `szse-vip-afternoon` (หุ้นจีน VIP บ่าย): 2026-05-19 to 2026-08-26; dev 75, holdout 25; historyVersion `1b2f87bedc79c2`
- `szse-vip-morning` (หุ้นจีน VIP เช้า): 2026-05-20 to 2026-08-27; dev 75, holdout 25; historyVersion `166e9e41d52ac8`
- `twse` (หุ้นไต้หวัน): 2026-03-20 to 2026-08-26; dev 74, holdout 25; historyVersion `0aec5ffa11b0f4`
- `twse-vip` (หุ้นไต้หวัน VIP): 2026-05-19 to 2026-08-26; dev 75, holdout 25; historyVersion `1270f975901d34`
- `xosohd` (ฮานอย HD): 2026-05-19 to 2026-08-26; dev 75, holdout 25; historyVersion `15eb99ef38186c`

Development evaluation draws per formula: 832. Holdout evaluation draws per finalist: 471.

## Candidate definitions

- **Candidate A — Balanced Refined** `core-candidate-a@1.0.0`: digit {"frequency":0.35,"recentFrequency":0.25,"momentum":0.1,"positionStrength":0.2,"gapPattern":0.1}; pair {"digitA":0.35,"digitB":0.35,"pairFrequency":0.05,"recentPairTrend":0.05,"positionMatch":0.2}
- **Candidate B — Recent + Position** `core-candidate-b@1.0.0`: digit {"frequency":0.15,"recentFrequency":0.4,"momentum":0.1,"positionStrength":0.3,"gapPattern":0.05}; pair {"digitA":0.25,"digitB":0.25,"pairFrequency":0.05,"recentPairTrend":0.1,"positionMatch":0.35}
- **Candidate C — Stable Digit First** `core-candidate-c@1.0.0`: digit {"frequency":0.4,"recentFrequency":0.2,"momentum":0.05,"positionStrength":0.3,"gapPattern":0.05}; pair {"digitA":0.4,"digitB":0.4,"pairFrequency":0.05,"recentPairTrend":0,"positionMatch":0.15}
- **Candidate D — Position Stable** `core-candidate-d@1.0.0`: digit {"frequency":0.45,"recentFrequency":0.15,"momentum":0,"positionStrength":0.35,"gapPattern":0.05}; pair {"digitA":0.3,"digitB":0.3,"pairFrequency":0.05,"recentPairTrend":0,"positionMatch":0.35}
- **Candidate E — Long Horizon** `core-candidate-e@1.0.0`: digit {"frequency":0.5,"recentFrequency":0.1,"momentum":0,"positionStrength":0.35,"gapPattern":0.05}; pair {"digitA":0.35,"digitB":0.35,"pairFrequency":0.05,"recentPairTrend":0,"positionMatch":0.25}

## Feature ablation and sparsity findings

Prior registered ablations plus this tournament show exact/recent ordered-pair evidence is sparse and unstable; digit marginals and positional compatibility are the defensible candidate family. Across development 30-draw windows, mean unseen exact-pair share was 74.5%; median was 74.0%. Median exact-pair frequency across 00–99 is 0 by construction in a 30-draw window. Candidate formulas therefore cap exact-pair weight at 5%.

Development pair ablations used 1,664 side-specific evaluation pairs across all 19 lotteries:

| Ablation | Top4 | Top10 | Top20 | Median | Mean | MRR |
|---|---:|---:|---:|---:|---:|---:|
| Digit + Position | 4.27% | 10.58% | 19.59% | 51 | 50.48 | 5.28% |
| Position First | 4.15% | 10.46% | 20.01% | 52 | 50.64 | 5.23% |
| Position only | 4.09% | 10.40% | 18.39% | 52 | 50.66 | 5.39% |
| Recent Pair only | 4.09% | 9.98% | 19.47% | 50 | 50.58 | 5.04% |
| Smoothed + unordered | 2.82% | 9.44% | 19.77% | 50 | 50.61 | 4.85% |
| Exact Pair only | 2.76% | 9.31% | 19.11% | 51 | 50.84 | 4.53% |
| Current Pair | 3.49% | 9.13% | 19.83% | 50 | 50.60 | 4.80% |

Digit + Position was the strongest development ablation. Exact ordered pair evidence hurt Top4, Top10, and MRR. The tested unordered smoothing also failed to improve ranking. Recent-pair evidence stayed near baseline. Momentum and gap effects remained mixed in the whole-formula tournament, so no causal feature claim is made.

## Horizon coverage

After reserving the newest 25% as untouched holdout, development provided approximately 42–45 evaluation draws per lottery. Horizon 30 and maximum-valid were available; clean 50/70 development horizons were not. Holdout provided 24–25 draws per lottery. No observations were reused to manufacture longer horizons.

## Development tournament

| Formula | Robust | Standout | Top1 | Top4 T/B | Top10 T/B | Top20 | Median rank | Mean rank | Worst Q Top10 | SD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Recent Weighted | 60.6 | 65.63% | 0.54% | 3.73% / 3.85% | 10.22% / 9.62% | 19.83% | 50 | 50.5 | 6.16% | 2.86% |
| Momentum | 59.6 | 66.23% | 0.66% | 3.37% / 3.73% | 10.10% / 9.74% | 19.71% | 50 | 50.3 | 6.38% | 2.80% |
| Candidate D — Position Stable | 59.4 | 65.14% | 1.08% | 3.25% / 3.85% | 9.01% / 10.58% | 19.41% | 52 | 51.2 | 6.30% | 2.93% |
| Candidate B — Recent + Position | 59.0 | 64.90% | 0.66% | 4.21% / 3.73% | 9.01% / 9.38% | 19.83% | 51 | 50.8 | 5.41% | 3.07% |
| Frequency | 58.7 | 64.42% | 0.84% | 3.49% / 2.76% | 10.34% / 9.25% | 19.47% | 52 | 51.0 | 4.89% | 3.77% |
| Candidate A — Balanced Refined | 58.4 | 64.78% | 0.84% | 3.37% / 3.37% | 9.25% / 9.74% | 19.05% | 51 | 50.7 | 5.44% | 3.12% |
| Candidate E — Long Horizon | 58.4 | 66.35% | 1.02% | 3.00% / 3.73% | 9.01% / 10.58% | 19.05% | 52 | 51.1 | 5.78% | 3.48% |
| Balanced v1 | 57.8 | 65.38% | 0.48% | 3.61% / 3.37% | 9.13% / 9.13% | 19.89% | 50 | 50.6 | 5.36% | 3.14% |
| Candidate C — Stable Digit First | 57.7 | 64.30% | 0.84% | 2.88% / 4.09% | 8.77% / 10.22% | 19.89% | 51 | 50.9 | 5.84% | 3.02% |
| Position + Pair | 56.8 | 65.38% | 0.96% | 3.25% / 3.37% | 8.89% / 9.25% | 19.29% | 51 | 51.2 | 5.14% | 3.73% |

Development finalists frozen: Balanced v1 (balanced-v1@1.0.0), Recent Weighted (recent-weighted@1.0.0), Momentum (momentum@1.0.0), Candidate D — Position Stable (core-candidate-d@1.0.0).

## Final holdout (opened once)

| Formula | Robust | Standout | Top1 | Top4 T/B | Top10 T/B | Top20 | Median rank | Mean rank | Worst Q Top10 | SD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Candidate D — Position Stable | 62.4 | 64.76% | 0.96% | 5.10% / 4.67% | 10.83% / 11.25% | 19.53% | 52 | 51.2 | 4.80% | 4.82% |
| Momentum | 62.2 | 68.37% | 0.85% | 2.55% / 4.88% | 9.55% / 11.89% | 19.53% | 52 | 51.2 | 4.45% | 4.74% |
| Balanced v1 | 61.6 | 64.97% | 1.27% | 2.76% / 4.88% | 9.34% / 11.04% | 20.06% | 52 | 51.0 | 3.63% | 4.62% |
| Recent Weighted | 60.7 | 65.39% | 1.17% | 3.18% / 4.88% | 9.34% / 11.89% | 20.17% | 51 | 50.8 | 4.45% | 4.76% |

Mathematical references for 100 ordered pairs: Top1 1%, Top4 4%, Top10 10%, Top20 20%; expected random MRR approximately 5.19%. No standalone standout baseline is claimed.

## Promotion decision

**No Core v1 promotion yet. Balanced v1 remains default.**

Best holdout finalist was Candidate D — Position Stable; it did not satisfy all frozen consistency/downside conditions versus Balanced v1. No production definition or persisted default was changed.

## Limitations

- Available cache contained 19 eligible lotteries, not 20.
- Most histories are capped at 100 draws, limiting development evaluation to about 45 draws and holdout to 25 per lottery.
- Results are historical ranking diagnostics, not evidence that lottery outcomes are predictable.
- Pair sparsity and short holdouts make Top1/Top4 noisy; rank distribution and downside metrics are included for that reason.
