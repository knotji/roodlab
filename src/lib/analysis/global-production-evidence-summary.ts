/**
 * Frozen read-only summary from reports/current-global-win6-evidence-2026-09-11.json.
 * This is descriptive retrospective evidence, not a live probability estimate.
 */
export const CURRENT_GLOBAL_WIN6_EVIDENCE = {
  freezeDate: "2026-09-11",
  evaluatedDates: 117,
  outcomes: 3465,
  productionEitherRate: 0.602020202020202,
  exactRandomEitherRate: 0.5944011544011543,
  uplift: 0.007619047619047747,
  uplift95: [-0.007490238252571319, 0.022400009874712228] as const,
  decision: "NO_CLEAR_EDGE_OVER_EXACT_RANDOM_BASELINE",
  report: "reports/current-global-win6-evidence-2026-09-11.md",
} as const;
