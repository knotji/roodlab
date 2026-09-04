# Source liveness audit

Freeze date: 2026-09-04
Code baseline: `main@e427e3a` plus the uncommitted all-lottery foundation
Provider catalog fingerprint: `7610259990b52af9`

## Scope

Read-only operational audit of sources whose stored latest complete draw predates 2026-09-02. This does not change Global Daily eligibility, scoring, weights, or source membership and does not evaluate predictive performance.

Provider/cache synchronization and current series liveness are separate concepts.

## Pre-registered classification

- Cadence uses calendar-day gaps between unique complete draws from that source only.
- Median and P90 use nearest-rank percentiles.
- Active-like: at least 10 gap samples and age/P90 <= 2.
- Dormant-like: at least 10 gap samples and age/P90 >= 5.
- Unknown: between thresholds, insufficient history, absent from current catalog, or provider page unreachable.
- Labels are operational triage only. Production exclusion is **not authorized** by this audit.

## Results

- Current provider catalog: 151
- Candidates: 16
- Active-like: 4; dormant-like: 11; unknown: 1
- The 13 sources highlighted in the review are the 2 dated 2026-08-16 plus 11 dated 2026-06-22/23. The literal "before 2026-09-02" rule also includes two sources dated 2026-09-01 and one dated 2026-08-31, so this audit reports all 16 rather than silently dropping the boundary-near cases.

| ID | Name | Stored latest complete | In current catalog | Page reachable | Provider latest complete | Complete draws | Median gap | P90 gap | Age/P90 | Status |
|---|---|---:|:---:|:---:|---:|---:|---:|---:|---:|---|
| `baac` | ธ.ก.ส. | 2026-08-16 | yes | yes | 2026-08-16 | 42 | 31 | 31 | 0.6× | **active-like** |
| `goverment` | หวยรัฐบาล | 2026-08-16 | yes | yes | 2026-08-16 | 99 | 15 | 16 | 1.2× | **active-like** |
| `gsb` | ออมสิน | 2026-09-01 | yes | yes | 2026-09-01 | 100 | 16 | 31 | 0.1× | **active-like** |
| `laomaekhong` | แม่โขงปกติ | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `laopremium` | ลาวพรีเมี่ยม | 2026-09-01 | yes | yes | 2026-09-01 | 99 | 1 | 2 | 1.5× | **active-like** |
| `maekhonggold` | แม่โขงโกลด์ | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `maekhonghd` | แม่โขง HD | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `maekhongmega` | แม่โขงเมก้า | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `maekhongnight` | แม่โขงไนท์ | 2026-06-22 | yes | yes | -- | 27 | 1 | 1 | 74.0× | **dormant-like** |
| `maekhongphatthana` | แม่โขงพัฒนา | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `maekhongplus` | แม่โขงพลัส | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `maekhongspecial` | แม่โขงพิเศษ | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `maekhongstar` | แม่โขงสตาร์ | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `maekhongtoday` | แม่โขงทูเดย์ | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `maekhongvip` | แม่โขง VIP | 2026-06-23 | yes | yes | -- | 28 | 1 | 1 | 73.0× | **dormant-like** |
| `xstachroi` | ฮานอยเฉพาะกิจ | 2026-08-31 | yes | yes | 2026-08-31 | 93 | 1 | 1 | 4.0× | **unknown** |

## Interpretation boundary

Presence in the current provider catalog means the provider still exposes the series; it does not prove draws are ongoing. A reachable page with an old latest result plus an age far beyond its own historical P90 is evidence of dormant-like behavior, not proof of permanent discontinuation. Review is required before any eligibility migration.

All 11 dormant-like rows belong to the Maekhong group. Their provider pages remain reachable and expose current-dated rows through 2026-09-03, but the raw provider hero and table explicitly display "งด" instead of top3, top2, and bottom2 values; their last complete outcomes remain 2026-06-22/23. This rules out a parser miss for the sampled pages. Operationally this is "catalog/page alive, usable result series dormant-like", not proof that the provider entry has been removed.
