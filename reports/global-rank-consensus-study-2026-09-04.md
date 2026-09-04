# Global Rank Consensus study

Freeze date: 2026-09-04  
Code baseline: `main@ae43052`  
Protocol fingerprint: `94cda607a7652f13`  
History fingerprint: `d3cfc005aae69edb`

## Research question

Does aggregating per-lottery digit ranks using fixed 10-to-1 points perform differently from the current production aggregation of normalized historical frequency scores?

## Production source of truth and pool

- Source: `src/lib/analysis/global-daily-sources.ts#GLOBAL_DAILY_SOURCE_IDS`
- Resolved active lotteries: **46**
- Exact IDs: `nikkei-vip-morning`, `hanoiasean`, `nikkei-morning`, `szse-vip-morning`, `szse-morning`, `laotv`, `hsi-vip-morning`, `hsi-morning`, `xosohd`, `twse-vip`, `minhngocstar`, `twse`, `ktop30-vip`, `ktop30`, `nikkei-afternoon`, `nikkei-vip-afternoon`, `laoshd`, `szse-afternoon`, `minhngoctv`, `szse-vip-afternoon`, `hsi-vip-afternoon`, `hsi-afternoon`, `laostars`, `sgx`, `xosoredcross`, `set`, `sgx-vip`, `laounion`, `laosasean`, `laosvip`, `laounionvip`, `laostarsvip`, `england-vip`, `moexbc`, `xosoextra`, `gdaxi`, `ftse100`, `germany-vip`, `laoredcross`, `russia-vip`, `dowjones-vip`, `dowjonestar`, `dji`, `laocitizen`, `laosantipap`, `laopatuxay`

## Frozen protocol

- Strategy A calls the production `buildGlobalWeekdayWin` implementation and selects overall ranks 1-6.
- Both strategies use the same eligible lotteries, same weekday, at most 12 prior same-weekday observations per lottery, per-draw digit presence, duplicate digits counted once per side, per-lottery normalization, and available top/bottom sides with equal weighting.
- Strategy B ranks 0-9 within each eligible lottery, awards fixed points 10 through 1, gives every eligible lottery one equal ballot, averages points globally, and selects ranks 1-6.
- Within-lottery ties: score descending, top+bottom rate descending, digit ascending. Global point ties: digit ascending. No random tie breaking.
- Targets and future draws are excluded. Missing histories receive no ballot and are not imputed.
- Primary metric: full two-digit hit on either top2 or bottom2. Exact random baseline enumerates all 6-of-10 sets and handles doubles exactly.
- Chronological split: oldest 75% Development, newest 25% Holdout. Confidence intervals use 10,000 target-date clustered bootstrap iterations.
- One comparison only; no tuning or production change is permitted.

## Data

- Range: 2026-04-16 to 2026-09-02
- Eligible target dates: 124
- Complete outcomes: 4411
- Stored sources: 46/46; read-only hydration: none

## Primary result

| Section | Dates | Outcomes | Production | Rank Consensus | Exact random | Production uplift | Production uplift 95% CI | Consensus uplift | Consensus uplift 95% CI | Paired B-A | Paired 95% CI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| development | 93 | 3208 | 58.98% | 59.88% | 59.34% | -0.37pp | -1.80pp to +1.11pp | +0.54pp | -0.94pp to +2.02pp | +0.90pp | -0.96pp to +2.76pp |
| holdout | 31 | 1203 | 62.34% | 60.68% | 59.67% | +2.67pp | +0.93pp to +4.32pp | +1.01pp | -1.04pp to +2.97pp | -1.66pp | -3.49pp to +0.09pp |
| all | 124 | 4411 | 59.90% | 60.10% | 59.43% | +0.46pp | -0.75pp to +1.63pp | +0.67pp | -0.55pp to +1.87pp | +0.20pp | -1.22pp to +1.67pp |

## Secondary metrics - all data

| Metric | Production | Rank Consensus | Exact random | Production uplift | Consensus uplift |
|---|---:|---:|---:|---:|---:|
| top | 37.29% | 37.27% | 35.81% | +1.49pp | +1.46pp |
| bottom | 35.55% | 35.82% | 35.64% | -0.09pp | +0.18pp |
| either | 59.90% | 60.10% | 59.43% | +0.46pp | +0.67pp |
| both | 12.94% | 12.99% | 12.01% | +0.94pp | +0.98pp |
| recall | 60.46% | 60.51% | 60.00% | +0.46pp | +0.51pp |

## Paired decomposition - all data

- Both hit: **1900** (43.07%)
- Production only: **742** (16.82%)
- Rank Consensus only: **751** (17.03%)
- Neither: **1018** (23.08%)

## Win-set similarity

- Mean shared digits: **4.44/6**; median: **5.0/6**
- Mean changed digits: **1.56**
- Mean Jaccard: **0.6078**
- Shared-membership distribution: 0/6=0, 1/6=0, 2/6=1, 3/6=17, 4/6=41, 5/6=56, 6/6=9

## Consensus diagnostics

| Digit | Ballots | Mean rank | Median rank | Top 1 | Top 3 | Top 6 |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 4371 | 4.45 | 4.0 | 731 (16.72%) | 1859 (42.53%) | 3263 (74.65%) |
| 1 | 4371 | 4.69 | 4.0 | 633 (14.48%) | 1721 (39.37%) | 3145 (71.95%) |
| 2 | 4371 | 4.95 | 5.0 | 562 (12.86%) | 1600 (36.60%) | 2967 (67.88%) |
| 3 | 4371 | 5.25 | 5.0 | 434 (9.93%) | 1356 (31.02%) | 2804 (64.15%) |
| 4 | 4371 | 5.44 | 6.0 | 452 (10.34%) | 1319 (30.18%) | 2613 (59.78%) |
| 5 | 4371 | 5.53 | 6.0 | 388 (8.88%) | 1317 (30.13%) | 2592 (59.30%) |
| 6 | 4371 | 5.80 | 6.0 | 291 (6.66%) | 1093 (25.01%) | 2486 (56.87%) |
| 7 | 4371 | 6.03 | 6.0 | 314 (7.18%) | 1033 (23.63%) | 2313 (52.92%) |
| 8 | 4371 | 6.41 | 7.0 | 249 (5.70%) | 867 (19.84%) | 2045 (46.79%) |
| 9 | 4371 | 6.46 | 7.0 | 317 (7.25%) | 948 (21.69%) | 1998 (45.71%) |

These diagnostics explain rank aggregation only and are not used to alter Strategy B.

## Monthly consistency

| Month | Dates | Outcomes | Production | Rank Consensus | Paired B-A |
|---|---:|---:|---:|---:|---:|
| 2026-04 | 10 | 130 | 50.77% | 53.08% | +2.31pp |
| 2026-05 | 20 | 459 | 58.17% | 56.64% | -1.53pp |
| 2026-06 | 30 | 1261 | 59.95% | 60.19% | +0.24pp |
| 2026-07 | 31 | 1295 | 59.15% | 61.47% | +2.32pp |
| 2026-08 | 31 | 1237 | 62.33% | 60.87% | -1.46pp |
| 2026-09 | 2 | 29 | 55.17% | 48.28% | -6.90pp |

## Conclusion

**The pooled estimate favored Global Rank Consensus, but uncertainty includes no difference; retain the frozen production method.**

## Limitations

- Retrospective analysis does not establish future predictive advantage.
- Related sources can be correlated.
- Date-clustered intervals reflect date variation but do not remove all structural dependencies.
- Rank points discard score magnitude by design.

## Contract confirmation

- Production formula changed: **NO**
- Production pool changed: **NO**
- Production UI changed: **NO**
- Prospective tracking added: **NO**
- Production promotion authorized: **NO**
