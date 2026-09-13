# Daily Global Win 6 — prospective protocol v1

Status: preregistered draft. Counting has **not started**. Day 1 may begin only after code, isolated persistence and browser acceptance all pass.

## Fixed duration and population

- Evaluate exactly 90 eligible Bangkok calendar days. Ninety days is a fixed operational evaluation period, not a guarantee of statistical power.
- Do not stop early because results look favorable. Do not extend because results are unfavorable.
- A day is eligible only when one atomic A/B lock was persisted before the verified server deadline and, after the waiting period, at least 80% of historically evaluable target lotteries have a complete top2 and bottom2 outcome. The 80% threshold is frozen before Day 1; days below it are logged but do not increment the 90 eligible days.
- Every scheduled day receives an audit event: locked, lock failed, deadline missed, schedule unverified, insufficient source data, waiting for outcomes, eligible, or outcome incomplete. Events are never silently deleted.

## Lock and outcomes

- A and B use the same pre-lock snapshot and are stored in one immutable record.
- A uses the existing Production source scope; B uses scheduled-today eligible sources. Formula, weights, ranking, tie-break and Win 6 remain unchanged.
- Wait until the final target's verified result time plus 24 hours before deciding day eligibility and marking still-missing outcomes. Unverified date-boundary targets remain separate and cannot enter the completeness denominator or decide eligibility.
- Provider corrections received within 72 hours of first observation replace the outcome in an append-only correction event; the prediction lock never changes. Corrections after 72 hours are reported separately and do not silently rewrite the frozen primary analysis.

## Metrics

- Primary: per-day proportion of available targets with a full two-digit hit on either top or bottom, averaged equally across eligible days.
- Secondary: full top, full bottom and both-side proportions, also daily means.
- A/B comparison is paired by day on the same target outcomes.
- Exact random baselines enumerate all six-of-ten digit sets and preserve doubles and shared top/bottom digits.
- Report sample days, expected targets, complete outcomes, missing/incomplete outcomes, paired differences and confidence intervals. Hit coverage is not profit.

## Freeze

- No formula or scope tuning during the 90-day period.
- Any operational code change is versioned and disclosed; a material contract change invalidates subsequent days for v1 rather than being hidden.
