# Production sync read-only audit — 2026-09-13

## Scope and deployment

- Production alias: `https://roodlab.vercel.app`
- Latest GitHub Production deployment: commit `9beccc4a86e357a1f1a943c64e9dcb77c9613656`
- Deployment URL: `https://roodlab-rb8yle5el-innerlands-projects.vercel.app`
- Deployment status: success at `2026-09-11T02:45:57Z`
- This audit used GET/read paths only. It did not invoke an authorized production write.

## Neon and catalog state

At `2026-09-13T00:24:19Z` (`07:24` Asia/Bangkok):

- `/api/system/status`: storage `neon`, connected `true`
- Catalog: 151
- Readable snapshots: 151/151
- Last successful sync range: `2026-09-13T00:12:42.860Z` to `2026-09-13T00:13:46.798Z`
- Snapshot freshness: 151 `up-to-date`, 0 `cache-behind`, 0 `unknown`
- Latest complete record in every snapshot contains both `top2` and `bottom2`
- Provider status: 139 normal, 11 suspended, 1 unknown

The immediately preceding all-catalog synchronization evidence recorded 151 attempts, 136 updated, 15 unchanged, and 0 failed. Its verification run recorded 151 unchanged and 0 failed. This is per-item evidence; HTTP 200 alone was not used.

The application preserves the last valid snapshot when a later sync fails. It does not currently persist an append-only per-run/per-lottery failure ledger, so historical cron failures cannot be reconstructed from snapshots alone.

## Schedule-aware interpretation

- 106 catalog entries have no verified schedule metadata and were not labelled stale from calendar age.
- 17 have a verified schedule but are not scheduled on Sunday.
- 28 have a configured Sunday result time.
- At audit time: 24 were not due, 2 had a complete result for the target date, and 2 after-midnight entries had no target-date result.
- The two after-midnight entries are `dowjones-vip` and `dowjonestar`; their provider/date boundary is explicitly unverified, so they are not counted as ordinary missing results.

Current Daily Lock comparison contract:

- Target lotteries with a Sunday schedule: 28
- Historically date-verifiable targets / B contributors ready: 26/26
- Schedule-boundary limitations: 2 (`dowjones-vip`, `dowjonestar`)
- Locked/default A scope: 25 configured, 24 ready
- A exclusion: `dji` (`insufficient-same-weekday-history`)

Eleven Maekhong-family snapshots are synchronized with the provider but explicitly marked `suspended`; their latest complete dates remain 2026-06-22/23. They are not treated as failed syncs or current eligible sources.

## Cron status

The deployed source contains one Vercel cron schedule:

```text
30 16 * * * -> /api/cron/prospective-sync
```

This is 23:30 Asia/Bangkok. The live route returned HTTP 503 with `CRON_SECRET is not configured`. Therefore the cron is configured in source but operationally unable to run successfully. Vercel dashboard run history was not accessible, and the application has no durable run ledger, so the latest actual scheduled invocation and its per-lottery results are not verifiable.

The route processes at most 12 lotteries sequentially per invocation. With 151 catalog entries, full rotating coverage needs at least 13 successful daily invocations. One invocation per day means a non-prioritized source may wait about 13 days; this is not sufficient evidence that all sources needed before the Daily Lock deadline are fresh.

## Operational implementation prepared locally — not deployed

The uncommitted implementation now builds the union of A and B candidate sources, processes deterministic batches of at most 12 with two per-source retries, and persists a run plus every attempt in `daily_sync_runs` / `daily_sync_run_items`. A lock is rejected unless the latest run is `ready` for the exact source union. Formula, weights, ranking, tie-break and the default A scope are unchanged.

The added schedule is `0 14 * * *` (21:00 Asia/Bangkok) and prepares the following Bangkok date. This leaves margin for Vercel Hobby's documented within-hour timing variance. It is source configuration only: it has not been deployed, its tables have not been migrated in Production, and `CRON_SECRET` has not been configured or exercised there.

Full-catalog background rotation remains separate. Readiness is decided from durable per-source outcomes and both A/B scope checks, never from the round-level HTTP status alone.

## Daily Lock acceptance status

- No disposable Neon `TEST_DATABASE_URL` was present.
- Production `DATABASE_URL` was not substituted.
- Exact Neon HTTP transport acceptance: not run.
- Current Production deployment does not contain the uncommitted Daily Lock POST/UI. Browser read-only verification found the Global Daily UI, but no Daily Lock action; POST returned 405.
- Therefore browser -> API -> Neon lock/reload/authorization/failure acceptance remains pending.

To close it, provide a disposable Neon branch/database through a secure environment configuration as `TEST_DATABASE_URL`, distinct from Production. Also configure test-only Daily Lock signing/authorization secrets outside chat. Deploy or run the current uncommitted build against that disposable environment, then execute the full lock/reload/unauthorized/failure browser sequence.

The 90-day protocol has not started. None of these operational checks changes formula accuracy.
