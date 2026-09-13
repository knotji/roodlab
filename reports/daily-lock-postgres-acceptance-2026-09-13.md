# Daily Lock PostgreSQL persistence acceptance

Date: 2026-09-13. Production database was not used or written.

## Disposable database

A separate PostgreSQL 16 cluster was initialized under `.codex-tmp/pg-daily-lock`, listened on `127.0.0.1:55439`, used trust authentication only on that isolated local cluster, and created database `roodlab_daily_lock_test`. The acceptance runner refuses `TEST_DATABASE_URL === DATABASE_URL` and refuses remote URLs unless explicitly allowed.

Reproducible command shape (contains no credential):

```powershell
$env:TEST_DATABASE_URL='postgresql://roodlab_test@127.0.0.1:55439/roodlab_daily_lock_test'
$env:PSQL_PATH='C:\Program Files\PostgreSQL\16\bin\psql.exe'
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm.cmd run accept:daily-lock-postgres
```

## Result

- A+B stored atomically in one row: PASS
- Retry returned the same record: PASS
- Concurrent calls using separate `psql` connections produced one row and one record id: PASS
- New lock after deadline rejected with no row: PASS
- Existing record remained readable after deadline: PASS
- Changed source preview returned the original persisted record: PASS
- Fresh Node/tsx process read the same record and digits: PASS
- Deliberately failed PostgreSQL statement left no partial row: PASS

Acceptance record id: `8bf289a1-108d-4fd1-8b9f-5386d35e8597` (disposable local database only).

## Boundary

This proves PostgreSQL constraints and the application's `DailyLockStore` persistence contract using a `psql` adapter with separate connections. Production uses `@neondatabase/serverless` over Neon HTTP. A fully transport-identical API-to-Neon acceptance still requires a disposable Neon `TEST_DATABASE_URL`; Production is not an acceptable substitute.
