# RoodLab UI migration map

## Frozen boundaries

- Keep every calculation, canonical-history, sync, cache, API, Zustand, persistence, and statistical contract in `src/lib` and `src/app/api` unchanged.
- Keep pair and draw values as strings so leading zeroes survive rendering and copy actions.
- Keep hydration guarded by the existing explicit Zustand rehydration flow.

## Current architecture

- `src/app/page.tsx` loads the catalog, snapshots, audit state, and Bangkok weekday on the server.
- `src/components/dashboard.tsx` owns client orchestration and contains all six product surfaces plus shared controls and dialogs.
- `src/components/lottery-selector.tsx` already uses Radix Popover and cmdk, but needs a separate mobile presentation.
- `src/app/globals.css` and `src/app/polish.css` contain nearly all presentation rules.
- Domain calculations are already isolated under `src/lib/analysis`; the redesign will consume their current return values unchanged.

## Migration boundaries

1. Add semantic tokens and reusable shadcn primitives.
2. Extract the responsive shell and navigation while retaining section state in `Dashboard`.
3. Extract Analyze presentation components using already-computed `analysis`, `consensus`, integrity, and win-set values.
4. Extract Statistics, History, Backtest, Formula Lab, and Settings one surface at a time.
5. Remove a legacy selector only after `rg` confirms it has no references.

## Unsafe moves

- Do not move or duplicate the `useMemo` analysis/backtest/consensus graph during the visual migration.
- Do not alter window options, strategy IDs, day filtering, copy payloads, or prospective snapshot payloads.
- Do not replace persisted store fields or URL lottery selection.
- Do not infer missing values in loading, partial-data, or integrity states.

## Component targets

- `app-shell`: desktop sidebar, mobile header/navigation, page header.
- `analyze`: controls, standout hero, win set, pairs, reasons, integrity disclosure.
- `statistics`, `history`, `backtest`, `settings`: page-level presentation boundaries.
- `ui`: button, card, badge, tabs/toggle group, drawer, dialog, tooltip, separator, skeleton, alert, switch, scroll area, collapsible.

## Regression evidence

Existing domain tests remain the primary output contract. Each phase must pass typecheck, lint, the complete Vitest suite, build, and `git diff --check`. Browser acceptance is reported separately from static gates.
