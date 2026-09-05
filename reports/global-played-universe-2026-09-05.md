# Global Played Universe study (Saturday only)

Freeze date: 2026-09-05
Code baseline: `main@25d75de`
Protocol fingerprint: `08a14ed4b66a41c1`
History fingerprint: `bdc06bc4cbd2c8cc`

## Research question

Which source universe (dynamic All Eligible, frozen Legacy 46, or weekday-scoped Played Universe) produces the best Win 6 for the lotteries actually played on Saturday?

## Scope

Saturday only - the only weekday with a real user-provided operational list as of this freeze date. Monday-Friday and Sunday are not evaluated.

## Universes compared

- **All Eligible**: identical to /api/global-weekday-win in production.
- **Legacy 46**: frozen, `src/lib/analysis/global-daily-sources.ts#GLOBAL_DAILY_SOURCE_IDS (frozen)`, 46 ids.
- **Played**: frozen, `src/lib/analysis/played-universe.ts#PLAYED_UNIVERSE_BY_WEEKDAY[6] (frozen, user-provided operational list)`, 25 ids: `nikkei-vip-morning`, `hanoiasean`, `szse-vip-morning`, `dji`, `hsi-vip-morning`, `xosohd`, `twse-vip`, `minhngocstar`, `ktop30-vip`, `nikkei-vip-afternoon`, `laoshd`, `minhngoctv`, `szse-vip-afternoon`, `hsi-vip-afternoon`, `laostars`, `xosoredcross`, `laounion`, `laosasean`, `laosvip`, `laounionvip`, `laoredcross`, `england-vip`, `xosoextra`, `germany-vip`, `dowjonestar`.

Average resolved universe size (post target-date eligibility, mean over evaluated dates):

| Universe | Avg. eligible sources |
|---|---:|
| all_eligible | 151.0 |
| legacy_46 | 46.0 |
| played | 25.0 |

## Frozen protocol

- All three strategies call the **same, unmodified** `buildGlobalWeekdayWin` scoring engine with equal-source weighting and at most 12 prior same-weekday observations per lottery.
- The only difference between strategies is which canonical lotteries reach the eligibility/scoring pipeline (`resolveUniverseCatalog` in `src/lib/analysis/global-universe.ts`).
- Fixed per date: the Played Universe intersected with sources that report a complete top2 and bottom2 outcome on the target date. Identical for all three strategies - each strategy is graded on the same outcomes, never on its own universe.
- Primary metric: full two-digit hit on either top2 or bottom2 (played-universe outcomes only). Exact random baseline enumerates all 6-of-10 sets and handles doubles exactly.
- Chronological split: oldest 75% Development, newest 25% Holdout. Confidence intervals use 10,000 target-date clustered bootstrap iterations.
- Decision rule pre-registered before reading results: Played improves over All Eligible in Development, Holdout, and All; Played improves over or approximately ties Legacy 46 (within a 0.5pp tie band); the paired-difference 95% CI vs All Eligible excludes zero on the low side.
- One frozen comparison only; no tuning of played-universe lists, no production, UI, pool, or scoring change is authorized by this study.

## Data

- Saturday target dates evaluated: 13 (range 2026-06-06 to 2026-08-29)
- Complete played-universe outcomes: 310
- Live-hydrated (read-only) sources: none

## Primary result - primary metric (full 2-digit hit, either side)

| Section | Dates | Outcomes | All Eligible | Legacy 46 | Played | Random | Played - All Eligible | 95% CI | Played - Legacy 46 | 95% CI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| development | 9 | 214 | 57.94% | 56.07% | 60.28% | 59.53% | +2.34pp | -6.02pp to +10.65pp | +4.21pp | -5.61pp to +15.57pp |
| holdout | 4 | 96 | 67.71% | 56.25% | 55.21% | 58.36% | -12.50pp | -20.83pp to -4.17pp | -1.04pp | -4.17pp to +2.08pp |
| all | 13 | 310 | 60.97% | 56.13% | 58.71% | 59.17% | -2.26pp | -9.29pp to +5.16pp | +2.58pp | -4.17pp to +10.97pp |

## Secondary metrics - all data

| Metric | All Eligible | Legacy 46 | Played | Random |
|---|---:|---:|---:|---:|
| top | 38.71% | 37.10% | 37.74% | 35.74% |
| bottom | 35.16% | 33.55% | 32.58% | 35.48% |
| either | 60.97% | 56.13% | 58.71% | 59.17% |
| both | 12.90% | 14.52% | 11.61% | 12.06% |
| recall | 61.37% | 60.08% | 59.84% | 60.00% |

## Conclusion

**INCONCLUSIVE**

- Played vs All Eligible, paired difference (all data): -2.26pp, 95% CI -9.29pp to +5.16pp
- Played vs Legacy 46, paired difference (all data): +2.58pp, 95% CI -4.17pp to +10.97pp
- Development/Holdout direction vs All Eligible: +2.34pp / -12.50pp

## Limitations

- Saturday-only history yields a thin sample (13 target dates); confidence intervals are wide and this is not a high-power result.
- Monday-Friday and Sunday Played Universe lists are not populated and are not evaluated here.
- Retrospective analysis does not establish future predictive advantage.
- Related sources can be correlated; date-clustered bootstrap reflects date variation only.

## Contract confirmation

- Production formula changed: **NO**
- Production universe/pool changed: **NO**
- Production UI changed: **NO**
- Weekday lists tuned from this result: **NO**
- Production promotion authorized: **NO**
