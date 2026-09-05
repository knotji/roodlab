export type WinSet = {
  digits: string[];
  orderedPairs: string[];
  uniquePairs: string[];
  doubles: string[];
  uniquePairsWithDoubles: string[];
};

export type FocusedWinSet = {
  coreDigits: string[];
  supportDigits: string[];
  focusedPairs: string[];
  supportPairs: string[];
};

export type TieredWinSet = {
  mainDigits: string[];
  secondaryDigits: string[];
  coverDigits: string[];
  primaryPairs: string[];
  secondaryPairs: string[];
  coverPairs: string[];
};

export function buildWinSet(rankedDigits: readonly string[], size = 4): WinSet {
  const digits = Array.from(new Set(rankedDigits)).slice(0, size);
  const orderedPairs = digits.flatMap((first) =>
    digits.filter((second) => second !== first).map((second) => first + second),
  );
  const uniquePairs = digits.flatMap((first, index) =>
    digits.slice(index + 1).map((second) => first + second),
    ),
    doubles = digits.map((digit) => digit + digit);
  return {
    digits,
    orderedPairs,
    uniquePairs,
    doubles,
    uniquePairsWithDoubles: [...uniquePairs, ...doubles],
  };
}

export type Win6PairSet = {
  winDigits: readonly string[];
  nonDoublePairs: readonly string[];
  doubles: readonly string[];
  totalItems: number;
  expandedNumbers: readonly string[];
};

/**
 * Pure derivation of the actionable play set from Production Win 6 - the single
 * source of truth is the caller-supplied win digits, never historical/Gemini
 * evidence. Requires exactly 6 distinct digits so the result is always C(6,2) = 15
 * non-double pairs + 6 doubles = 21 items, expanding to 15*2 + 6 = 36 actual numbers
 * (both directions for non-doubles, doubles counted once). Delegates the actual
 * combinatorics to `buildWinSet`, which the Win 5/6/7 hero selector also uses and
 * which this function does not modify.
 */
export function deriveWin6PairSet(winDigits: readonly string[]): Win6PairSet {
  if (winDigits.length !== 6) throw new Error(`deriveWin6PairSet requires exactly 6 Win digits, got ${winDigits.length}`);
  if (new Set(winDigits).size !== 6) throw new Error("deriveWin6PairSet requires 6 distinct Win digits");
  const winSet = buildWinSet(winDigits, 6);
  return {
    winDigits: winSet.digits,
    nonDoublePairs: winSet.uniquePairs,
    doubles: winSet.doubles,
    totalItems: winSet.uniquePairs.length + winSet.doubles.length,
    expandedNumbers: [...winSet.orderedPairs, ...winSet.doubles],
  };
}

export function buildFocusedWinSet(
  rankedDigits: readonly string[],
  size = 6,
  coreSize = 2,
): FocusedWinSet {
  const winSet = buildWinSet(rankedDigits, size),
    coreDigits = winSet.digits.slice(0, coreSize),
    supportDigits = winSet.digits.slice(coreSize),
    core = new Set(coreDigits),
    focusedPairs = winSet.uniquePairs.filter(
      (pair) => core.has(pair[0]) || core.has(pair[1]),
    ),
    supportPairs = winSet.uniquePairs.filter(
      (pair) => !core.has(pair[0]) && !core.has(pair[1]),
    );
  return { coreDigits, supportDigits, focusedPairs, supportPairs };
}

export function buildTieredWinSet(
  rankedDigits: readonly string[],
  size: 5 | 6 = 6,
): TieredWinSet {
  const winSet = buildWinSet(rankedDigits, size),
    mainDigits = winSet.digits.slice(0, 2),
    secondaryDigits = winSet.digits.slice(2, 4),
    coverDigits = winSet.digits.slice(4, 6),
    main = new Set(mainDigits),
    secondary = new Set(secondaryDigits),
    cover = new Set(coverDigits),
    belongs = (pair: string, left: Set<string>, right: Set<string>) =>
      (left.has(pair[0]) && right.has(pair[1])) ||
      (left.has(pair[1]) && right.has(pair[0])),
    primaryPairs = winSet.uniquePairs.filter(
      (pair) => belongs(pair, main, main) || belongs(pair, main, secondary),
    ),
    secondaryPairs = winSet.uniquePairs.filter(
      (pair) => belongs(pair, main, cover) || belongs(pair, secondary, secondary),
    ),
    coverPairs = winSet.uniquePairs.filter(
      (pair) => belongs(pair, secondary, cover) || belongs(pair, cover, cover),
    );
  return {
    mainDigits,
    secondaryDigits,
    coverDigits,
    primaryPairs,
    secondaryPairs,
    coverPairs,
  };
}
