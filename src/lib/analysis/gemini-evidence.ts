export type GeminiEvidenceHistory = {
  lotteryId: string;
  lotteryName: string;
  draws: Array<{ drawDate: string; top2?: string; bottom2?: string }>;
};

const canonicalPair = (value: string) => [...value].sort().join("");

export function buildEqualSourceEvidence(histories: GeminiEvidenceHistory[]) {
  const summarize = (keys: string[], matches: (value: string, key: string) => boolean) => keys.map((key) => {
    const sourceRates = histories.map((source) => {
      const top = source.draws.flatMap((draw) => draw.top2 ? [draw.top2] : []),
        bottom = source.draws.flatMap((draw) => draw.bottom2 ? [draw.bottom2] : []);
      return {
        topRate: top.length ? top.filter((value) => matches(value, key)).length / top.length : null,
        bottomRate: bottom.length ? bottom.filter((value) => matches(value, key)).length / bottom.length : null,
      };
    }),
      topRates = sourceRates.flatMap((item) => item.topRate === null ? [] : [item.topRate]),
      bottomRates = sourceRates.flatMap((item) => item.bottomRate === null ? [] : [item.bottomRate]),
      average = (rates: number[]) => rates.length ? rates.reduce((total, value) => total + value, 0) / rates.length : 0,
      topRate = average(topRates), bottomRate = average(bottomRates),
      availableSides = Number(topRates.length > 0) + Number(bottomRates.length > 0);
    return {
      key,
      equalSourceRate: availableSides ? (topRate + bottomRate) / availableSides : 0,
      topRate,
      bottomRate,
      sourceCoverage: sourceRates.filter((item) => (item.topRate ?? 0) > 0 || (item.bottomRate ?? 0) > 0).length,
      topSources: topRates.length,
      bottomSources: bottomRates.length,
    };
  }).sort((a, b) => b.equalSourceRate - a.equalSourceRate || b.sourceCoverage - a.sourceCoverage || a.key.localeCompare(b.key));
  const pairKeys = Array.from({ length: 10 }, (_, first) => Array.from({ length: 10 - first }, (_, offset) => `${first}${first + offset}`)).flat(),
    digitSummary = summarize(Array.from({ length: 10 }, (_, value) => String(value)), (value, key) => new Set(value).has(key))
      .map(({ key: digit, ...item }) => ({ digit, ...item })),
    pairSummary = summarize(pairKeys, (value, key) => canonicalPair(value) === key)
      .map(({ key: pair, ...item }) => ({ pair, ...item }));
  return { digitSummary, pairSummary };
}
