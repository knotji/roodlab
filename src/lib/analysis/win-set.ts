export type WinSet = {
  digits: string[];
  orderedPairs: string[];
  uniquePairs: string[];
  doubles: string[];
  uniquePairsWithDoubles: string[];
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
