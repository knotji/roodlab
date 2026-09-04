# All-lottery dynamic production freeze acceptance

Freeze date: 2026-09-04
Code baseline before the uncommitted implementation: `main@e427e3a`
Catalog fingerprint: `7ba6f0ee0334b88a`
History fingerprint: `dc614cb92513a4ed`

## Decision

**Dynamic Global Daily production freeze: PASS**

This is operational/data-quality acceptance only. No hit-rate evaluation or performance tuning was performed.

## Current state

- Catalog: 151; stored/synced: 151; provider synchronized: 151
- Target: 2026-09-04; eligible/contributing: 137; excluded: 14
- Previous contributors before operational suspension: 150; current contributors: 137
- Exclusion reasons: provider-results-suspended: 13, insufficient-same-weekday-history: 1
- Current Win 6 for acceptance only: 0 · 5 · 1 · 2 · 4 · 7

## Explicit provider suspension

- Count: 13
- IDs: `laomaekhong`, `maekhonggold`, `maekhonghd`, `maekhongmega`, `maekhongnight`, `maekhongphatthana`, `maekhongplus`, `maekhongspecial`, `maekhongstar`, `maekhongtoday`, `maekhongvip`, `xosokqxvip`, `xstachroi`
- Exact AllHuay signal: every recognized current result field is the literal `งด`; no fuzzy page-wide match.
- Suspended rows remain partial/non-complete provenance. Prior complete history is preserved.
- Partial alone is not suspended; malformed/mixed/insufficient evidence is unknown.

The audit expectation named 11 Maekhong sources. Production parsing additionally found explicit current `งด` for `xosokqxvip` and `xstachroi`. The latter is excluded because of explicit provider evidence, not its cadence anomaly.

## Sync acceptance

- First accepted sync: attempted 151; updated 14; unchanged 137; failed 0; partial 46; invalid 0; suspended 13; duration 47.9s
- Second sync: attempted 151; updated 0; unchanged 151; failed 0; partial 46; invalid 0; suspended 13; duration 47.9s
- History versions stable across the accepted first/second runs: **YES**
- Suspended treated as sync success: **YES**
- Partial sources: 46; invalid histories: 0

## Historical safety

Current provider suspension is consulted only when `historical !== true`. Historical target-date eligibility ignores today's snapshot provider status and still filters all training draws strictly before the target date. Cadence metrics are absent from the production exclusion path.

## Frozen scoring contract

- Same weekday; maximum 12 prior same-weekday draws per lottery
- Digit presence, doubles once per side, per-lottery normalization
- Equal available-side weighting and existing deterministic tie-break
- Rank 1-10; Win 6 is ranks 1-6
- Formula, weights, history window, and Win size changed: **NO**
- Performance tuning and prospective tracking added: **NO**
