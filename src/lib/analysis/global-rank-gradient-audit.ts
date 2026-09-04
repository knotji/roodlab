export const RANK_BANDS = [
  { id: "r1_2", label: "Ranks 1-2", ranks: [1, 2] },
  { id: "r3_4", label: "Ranks 3-4", ranks: [3, 4] },
  { id: "r5_6", label: "Ranks 5-6", ranks: [5, 6] },
  { id: "r7_8", label: "Ranks 7-8", ranks: [7, 8] },
  { id: "r9_10", label: "Ranks 9-10", ranks: [9, 10] },
] as const;

export const RANK_SUMMARY_GROUPS = {
  high: [1, 2],
  middle: [5, 6],
  low: [9, 10],
} as const;

export function digitPresence(pair: string, digit: string) {
  return new Set(pair.split("")).has(digit);
}

function averageRanks(values: readonly number[]) {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value), ranks = Array(values.length).fill(0) as number[];
  for (let start = 0; start < indexed.length;) {
    let end = start + 1;
    while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) ranks[indexed[index].index] = rank;
    start = end;
  }
  return ranks;
}

export function spearmanAssociation(xs: readonly number[], ys: readonly number[]) {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const x = averageRanks(xs), y = averageRanks(ys), mx = x.reduce((a,b)=>a+b,0)/x.length, my = y.reduce((a,b)=>a+b,0)/y.length,
    numerator=x.reduce((sum,value,index)=>sum+(value-mx)*(y[index]-my),0), left=Math.sqrt(x.reduce((sum,value)=>sum+(value-mx)**2,0)), right=Math.sqrt(y.reduce((sum,value)=>sum+(value-my)**2,0));
  return left && right ? numerator/(left*right) : 0;
}

export function chronologicalSplit<T>(rows: readonly T[], developmentShare = .75) {
  const split = Math.floor(rows.length * developmentShare);
  return { development: rows.slice(0, split), holdout: rows.slice(split) };
}

export function marginalResidual(observed: number, priorAppearances: number, priorOpportunities: number) {
  return priorOpportunities > 0 ? observed - priorAppearances / priorOpportunities : null;
}
