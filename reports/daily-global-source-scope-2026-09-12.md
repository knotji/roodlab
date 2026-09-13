# Daily Global Win 6 — source-scope comparison

Frozen descriptive run: 2026-09-12. Data evaluated through 2026-09-11.

## Protocol

- One Win 6 per Bangkok calendar day.
- Target population: the same lotteries with an explicit schedule for that Bangkok weekday in both modes.
- A: existing locked Production source scope.
- B: scheduled-today sources that pass the unchanged data eligibility rules.
- Same Production scoring, weights, rank order, tie-break, Win 6 and maximum 12 same-weekday histories.
- Every source uses complete history strictly before the target date.
- Primary metric: the proportion of available target outcomes fully covered on either top or bottom, calculated per day and then averaged across days.
- Missing outcomes are reported and omitted, never counted as wins or losses.
- Exact random comparison enumerates all 210 six-digit subsets, including doubles and shared top/bottom digits.

## Results

97 paired days, 3,145 complete target outcomes, 550 scheduled outcomes missing or incomplete.

| Full-hit metric, daily mean | A | B | Exact random | B - A (95% paired day bootstrap CI) |
| --- | ---: | ---: | ---: | ---: |
| Top | 35.83% | 36.81% | 35.75% | +0.98pp (-0.98, +3.09) |
| Bottom | 35.85% | 36.39% | 35.57% | +0.55pp (-1.36, +2.32) |
| Either top or bottom | 59.79% | 60.89% | 59.30% | +1.10pp (-0.54, +2.71) |
| Both top and bottom | 11.88% | 12.31% | 12.02% | +0.43pp (-0.97, +1.92) |

The paired intervals cross zero. This run does not establish that B is better than A. A remains the product default while new, genuinely pre-result locked records accumulate under the frozen protocol.

## Limitations

- This is a retrospective simulation, not a prospective record. Historical snapshots do not prove the exact data arrival state at each historical lock time.
- Schedule metadata is current and is not historically versioned.
- Results between 00:00 and 04:59 are current Bangkok-day targets, but are excluded from retrospective outcome scoring until provider draw-date boundary conventions are verified.
- The rates are hit coverage, not profit or expected return. “At least one hit somewhere in the day” is not used as evidence.
- No formula, weight, window, tie-break or Production default was changed from this result.
