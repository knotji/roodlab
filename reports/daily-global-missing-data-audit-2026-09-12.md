# Daily Global missing-data audit

Scope: the same 97 paired retrospective days evaluated through 2026-09-11. Current schedule metadata was applied descriptively; it is not historically versioned.

## Summary

- Expected historically evaluable target outcomes: 3,695
- Complete top2 + bottom2 outcomes: 3,145
- Missing or incomplete: 550 (14.88%)
- No record on target date: 531 (14.37% of expected)
- Record exists but top2 or bottom2 is incomplete: 19 (0.51% of expected)
- Post-midnight date-boundary uncertainty is excluded from these 550 records: `dowjones-vip` and `dowjonestar`, 97 candidate days each.

## Concentration

Five sources account for 457/550 missing records: `xosounion` 97/97, `england-vip` 97/97, `laoredcross` 97/97, `russia-vip` 97/97, and `ktop30` 69/69 expected dates. This does **not** prove those draws failed to occur: current schedules/catalog presence cannot establish that each series existed or was captured throughout the historical interval.

By verified result-time band:

| Time | Missing / expected | Rate |
| --- | ---: | ---: |
| 05:00–11:59 | 33 / 1,162 | 2.84% |
| 12:00–16:59 | 95 / 1,106 | 8.59% |
| 17:00–21:59 | 216 / 942 | 22.93% |
| 22:00–23:59 | 206 / 485 | 42.47% |

By weekday (Sunday through Saturday): 79/364 (21.70%), 69/559 (12.34%), 75/602 (12.46%), 74/602 (12.29%), 79/602 (13.12%), 98/602 (16.28%), and 76/364 (20.88%).

Largest date clusters were 2026-08-28: 30/43, 2026-08-30: 25/26, 2026-08-29: 24/26, and 2026-08-27: 13/43.

## Interpretation limits

- Missing results were never imputed and never counted as wins or losses.
- The observed late-time concentration is partly driven by sources with no matching historical records; it is not evidence that time of day causes missingness.
- Because schedule metadata is not time-versioned, the denominator may include current schedules that were not operational on every historical date. This limits generalization of the retrospective rates to the current daily target population.
- No source, window, formula or retrospective eligibility rule was changed after seeing this audit.
