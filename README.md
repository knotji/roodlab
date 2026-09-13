This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Backfill lottery history to Neon

Put `DATABASE_URL` in `.env.local` (this file is ignored by Git). Preview the eligible catalog without writing anything:

Daily A/B locking additionally requires `DAILY_LOCK_SECRET`. `DAILY_LOCK_SIGNING_SECRET` is optional; when omitted, the lock secret signs preview fingerprints. The browser asks for the lock secret only when the user confirms a lock and does not persist it locally. Persistence acceptance must use a separate `TEST_DATABASE_URL`; never point that variable at Production.

Daily Lock preparation also requires `CRON_SECRET`. The scheduled endpoint builds the union of A and B source candidates for the next Bangkok date, synchronizes it in bounded batches with per-source retries, persists per-source results, and only enables locking after both scopes pass readiness. Vercel invokes cron routes with `GET`; authenticated operators can inspect the latest run without starting sync at `/api/cron/daily-lock-prepare?status=1&date=YYYY-MM-DD`.

The checked-in schedule is `0 14 * * *` (21:00 Asia/Bangkok). On Vercel Hobby it may start at any point during that hour, so it intentionally targets the following Bangkok date and leaves margin before the earliest verified deadline. Cron runs only on Production deployments. Before enabling it:

1. Run `npm.cmd run storage:migrate` against a disposable Neon database and complete Daily Lock/PostgreSQL acceptance.
2. Configure `CRON_SECRET`, `DAILY_LOCK_SECRET`, optional `DAILY_LOCK_SIGNING_SECRET`, and `DATABASE_URL` through protected environment settings.
3. Invoke the preparation route in the disposable environment and verify its durable run/items ledger and UI readiness state.
4. Only then run the migration and enable the cron in Production; verify per-lottery results, not only the HTTP status.

Do not begin the 90-day comparison until isolated persistence, browser, and first real pre-deadline operational acceptance all pass.

```powershell
npm.cmd run sync:backfill
```

Run a bounded first batch:

```powershell
npm.cmd run sync:backfill -- --execute --limit=15 --concurrency=2
```

Repeat the command until `items` is empty. Successful lottery IDs are stored in `.backfill/checkpoint.json`; the latest run report is stored in `.backfill/latest-report.json`. Both files are ignored by Git. Failed items are retried twice by default and remain eligible for the next run.

Useful options:

- `--retries=3` changes per-lottery retries (0-5).
- `--force` refreshes already hydrated Neon snapshots.
- `--reset-checkpoint` starts a new local checkpoint while preserving Neon data.

The runner only selects active catalog entries that are not marked `failed` by the catalog audit. Sync validation remains fail-safe: invalid or suspicious source responses do not replace the last valid snapshot.

## Research reports

See the [research report index](reports/README.md) for frozen protocols, universe boundaries, and decisions. Reports are offline diagnostics and do not modify the production formula.
