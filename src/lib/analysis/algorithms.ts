import type { AlgorithmDefinition, DigitWeights, PairWeights } from "./types";
import { DEFAULT_DIGIT_WEIGHTS, DEFAULT_PAIR_WEIGHTS } from "./types";
export const ALGORITHMS: readonly AlgorithmDefinition[] = [
  {
    id: "balanced-v1",
    name: "Balanced v1",
    version: "1.0.0",
    description: "สมดุลความถี่ แนวโน้ม ตำแหน่ง และช่วงห่าง",
    digitWeights: DEFAULT_DIGIT_WEIGHTS,
    pairWeights: DEFAULT_PAIR_WEIGHTS,
  },
  {
    id: "frequency",
    name: "Frequency",
    version: "1.0.0",
    description: "ให้น้ำหนักกับความถี่ระยะยาวเป็นหลัก",
    digitWeights: {
      frequency: 0.65,
      recentFrequency: 0.15,
      momentum: 0,
      positionStrength: 0.15,
      gapPattern: 0.05,
    },
    pairWeights: {
      digitA: 0.25,
      digitB: 0.25,
      pairFrequency: 0.35,
      recentPairTrend: 0,
      positionMatch: 0.15,
    },
  },
  {
    id: "recent-weighted",
    name: "Recent Weighted",
    version: "1.0.0",
    description: "เน้น 10 งวดล่าสุดมากกว่าข้อมูลเก่า",
    digitWeights: {
      frequency: 0.15,
      recentFrequency: 0.5,
      momentum: 0.15,
      positionStrength: 0.15,
      gapPattern: 0.05,
    },
    pairWeights: {
      digitA: 0.2,
      digitB: 0.2,
      pairFrequency: 0.1,
      recentPairTrend: 0.35,
      positionMatch: 0.15,
    },
  },
  {
    id: "momentum",
    name: "Momentum",
    version: "1.0.0",
    description: "เน้นการเปลี่ยนแปลงระหว่างสองช่วง 10 งวด",
    digitWeights: {
      frequency: 0.15,
      recentFrequency: 0.2,
      momentum: 0.45,
      positionStrength: 0.15,
      gapPattern: 0.05,
    },
    pairWeights: {
      digitA: 0.2,
      digitB: 0.2,
      pairFrequency: 0.1,
      recentPairTrend: 0.35,
      positionMatch: 0.15,
    },
  },
  {
    id: "position-pair",
    name: "Position + Pair",
    version: "1.0.0",
    description: "เน้นตำแหน่งหลักและประวัติคู่ตรง",
    digitWeights: {
      frequency: 0.2,
      recentFrequency: 0.1,
      momentum: 0.05,
      positionStrength: 0.55,
      gapPattern: 0.1,
    },
    pairWeights: {
      digitA: 0.15,
      digitB: 0.15,
      pairFrequency: 0.35,
      recentPairTrend: 0.1,
      positionMatch: 0.25,
    },
  },
] as const;
export function getAlgorithm(
  id: string,
  custom?: { digitWeights: DigitWeights; pairWeights: PairWeights },
): AlgorithmDefinition {
  if (id === "custom" && custom)
    return {
      id: "custom",
      name: "Custom",
      version: "local",
      description: "ค่าน้ำหนักที่ผู้ใช้กำหนด",
      ...custom,
    };
  return ALGORITHMS.find((x) => x.id === id) ?? ALGORITHMS[0];
}
export function validateWeights(weights: Record<string, number>) {
  return (
    Object.values(weights).every((x) => Number.isFinite(x) && x >= 0) &&
    Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) < 0.0001
  );
}
