# All-lottery operational sync report

Freeze date: 2026-09-04
Code baseline before implementation: `main@e427e3a`
Catalog fingerprint: `7ba6f0ee0334b88a`
History fingerprint after sync: `f04f0356d17d7b45`

> Dynamic all-lottery eligibility; not directly comparable to frozen 39/46-pool studies without a separate controlled experiment.

## Scope

Operational data foundation only. No retrospective performance comparison, formula tuning, source weighting, or prediction claim was performed.

## Catalog

- Provider: AllHuay canonical catalog discovered from `https://www.allhuay.com/lotto`
- Catalog: 151; supported: 151
- Unique canonical IDs: 151; unique slugs: 151
- Display names do not define identity. No duplicate canonical ID or slug was accepted.

## First real sync

attempted 151; updated 148; unchanged 3; failed 0; partial 46; invalid 0; stale 0; complete 151; duration 57.5s

## Second idempotency sync

attempted 151; updated 0; unchanged 151; failed 0; partial 46; invalid 0; stale 0; complete 151; duration 56.3s

- History versions stable between runs: **YES**
- Failed sources: none

## Storage quality

- Stored: 151/151
- At least one complete draw: 151
- Sources retaining partial draws: 46
- Integrity-invalid sources: 0
- Draw count min / median / max: 28 / 100 / 100
- Latest-complete distribution: 2026-06-22: 1, 2026-06-23: 10, 2026-08-16: 2, 2026-08-31: 1, 2026-09-01: 2, 2026-09-02: 3, 2026-09-03: 116, 2026-09-04: 16

## Current Global Daily eligibility

- Target date: 2026-09-04; weekday index: 5
- Catalog: 151; histories available: 151
- Eligible/contributing: 150; excluded: 1

Exclusion reasons:

- insufficient-same-weekday-history: 1

Eligibility is based only on canonical support, valid complete pre-target data, same-weekday availability, integrity, and positively known cache-behind state. Historical target-date eligibility does not inspect today's freshness.

## Preserved scoring contract

- Same weekday only
- Maximum 12 prior same-weekday draws per lottery
- Digit presence per draw; doubles count once per side
- Per-lottery normalization
- Equal available top/bottom weighting
- Deterministic score, combined-rate, digit ordering
- Ten ranked digits; Win 6 is ranks 1-6
- Target and future results excluded

## Freshness limitation

The catalog has no complete schedule model. `up-to-date` means provider and cache agree at sync time; it does not mean every lottery was scheduled today. Unknown schedule freshness is not fabricated and is not used to exclude historical sources.

## Safety confirmation

- Production scoring formula changed: **NO**
- Scoring weights changed: **NO**
- History window changed: **NO**
- Win size changed: **NO**
- Performance tuning performed: **NO**
- Prospective tracking added: **NO**
- Frozen 39/46-lottery research rewritten: **NO**
