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
