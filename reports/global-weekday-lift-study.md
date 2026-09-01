# Global weekday lift walk-forward study

Freeze date: 2026-09-01
Protocol fingerprint: `763738995f526b19`
History fingerprint: `b0e3fb1ec15f04af`

## Frozen protocol

- One shared digit set per calendar date, evaluated against every complete lottery result on that date.
- Every ranking uses only draws with `drawDate < targetDate`; the target date and future are excluded.
- Weekday history: up to 12 matching weekdays per lottery; all-days reference: up to 84 prior draws per lottery.
- Minimum training: 4 matching weekdays and 28 all-days draws per lottery, at least 10 training lotteries and 10 target lotteries.
- Top2 and bottom2 have equal weight. Each lottery has equal weight inside a ranking. Doubles count once for digit presence.
- Methods were fixed before result generation: current weekday frequency, weekday lift, all-days frequency, duplicate-group weighting, three-block stability, per-lottery consensus, and top-bottom balance.
- Sizes: 5, 6, 7. Exact random baselines enumerate all equally likely digit subsets, including double-specific probabilities.
- Pair costs are fixed at 15, 21, and 28 pairs including doubles; exact random four-position recall is 50%, 60%, and 70% respectively.
- Primary metric: complete coverage of an actual top2 or bottom2 pair. Secondary: both sides covered and four-position digit recall.
- Confidence intervals: 10,000 deterministic bootstrap resamples clustered by target date, seed 20260901.
- Chronological split: oldest 75% development (68 dates), newest 25% untouched holdout (23 dates).

## Development

| Win | Method | Dates | Outcomes | Side pair | Random | Uplift | Date-clustered 95% CI | Both sides | Digit recall | Lift vs current |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | พบบ่อยตามวัน | 68 | 2693 | 24.36% | 24.74% | -0.38pp | -1.26pp to +0.49pp | 6.05% | 49.52% | — |
| 5 | เด่นกว่าวันอื่น | 68 | 2693 | 24.64% | 24.74% | -0.10pp | -1.03pp to +0.84pp | 5.83% | 49.85% | +0.28pp (-0.45pp to +1.11pp) |
| 5 | ความถี่รวมทุกวัน | 68 | 2693 | 24.77% | 24.74% | +0.03pp | -1.03pp to +1.13pp | 5.68% | 50.00% | — |
| 5 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 68 | 2693 | 24.36% | 24.74% | -0.38pp | -1.27pp to +0.48pp | 6.05% | 49.52% | — |
| 5 | เสถียรข้าม 3 ช่วง | 68 | 2693 | 24.29% | 24.74% | -0.45pp | -1.42pp to +0.52pp | 6.24% | 49.80% | — |
| 5 | Consensus รายหวย | 68 | 2693 | 24.86% | 24.74% | +0.12pp | -0.98pp to +1.25pp | 6.09% | 50.27% | — |
| 5 | สมดุลบนและล่าง | 68 | 2693 | 24.45% | 24.74% | -0.29pp | -1.21pp to +0.61pp | 6.16% | 49.62% | — |
| 5 | Global 4+1+1 | 68 | 2693 | 24.32% | 24.74% | -0.42pp | -1.33pp to +0.49pp | 5.90% | 49.54% | — |
| 6 | พบบ่อยตามวัน | 68 | 2693 | 35.04% | 35.75% | -0.71pp | -1.86pp to +0.41pp | 12.74% | 59.81% | — |
| 6 | เด่นกว่าวันอื่น | 68 | 2693 | 35.37% | 35.75% | -0.38pp | -1.35pp to +0.57pp | 11.88% | 60.00% | +0.33pp (-0.60pp to +1.30pp) |
| 6 | ความถี่รวมทุกวัน | 68 | 2693 | 35.65% | 35.75% | -0.10pp | -1.28pp to +1.08pp | 12.33% | 59.99% | — |
| 6 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 68 | 2693 | 35.04% | 35.75% | -0.71pp | -1.87pp to +0.42pp | 12.74% | 59.81% | — |
| 6 | เสถียรข้าม 3 ช่วง | 68 | 2693 | 34.72% | 35.75% | -1.03pp | -2.28pp to +0.23pp | 12.44% | 59.48% | — |
| 6 | Consensus รายหวย | 68 | 2693 | 35.67% | 35.75% | -0.08pp | -1.31pp to +1.12pp | 12.59% | 60.26% | — |
| 6 | สมดุลบนและล่าง | 68 | 2693 | 35.22% | 35.75% | -0.53pp | -1.64pp to +0.52pp | 12.66% | 59.92% | — |
| 6 | Global 4+1+1 | 68 | 2693 | 34.70% | 35.75% | -1.05pp | -2.09pp to -0.05pp | 12.14% | 59.12% | — |
| 7 | พบบ่อยตามวัน | 68 | 2693 | 48.44% | 48.78% | -0.34pp | -1.41pp to +0.69pp | 23.54% | 69.78% | — |
| 7 | เด่นกว่าวันอื่น | 68 | 2693 | 48.64% | 48.78% | -0.14pp | -1.05pp to +0.78pp | 22.76% | 70.09% | +0.20pp (-0.66pp to +1.02pp) |
| 7 | ความถี่รวมทุกวัน | 68 | 2693 | 48.94% | 48.78% | +0.16pp | -0.90pp to +1.23pp | 23.88% | 70.35% | — |
| 7 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 68 | 2693 | 48.44% | 48.78% | -0.34pp | -1.40pp to +0.68pp | 23.54% | 69.78% | — |
| 7 | เสถียรข้าม 3 ช่วง | 68 | 2693 | 48.14% | 48.78% | -0.64pp | -1.80pp to +0.45pp | 23.10% | 69.59% | — |
| 7 | Consensus รายหวย | 68 | 2693 | 48.61% | 48.78% | -0.17pp | -1.38pp to +1.01pp | 24.06% | 70.03% | — |
| 7 | สมดุลบนและล่าง | 68 | 2693 | 48.64% | 48.78% | -0.14pp | -1.17pp to +0.92pp | 23.47% | 70.04% | — |
| 7 | Global 4+1+1 | 68 | 2693 | 48.31% | 48.78% | -0.47pp | -1.38pp to +0.43pp | 23.25% | 69.56% | — |

## Final holdout

| Win | Method | Dates | Outcomes | Side pair | Random | Uplift | Date-clustered 95% CI | Both sides | Digit recall | Lift vs current |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | พบบ่อยตามวัน | 23 | 860 | 25.29% | 24.79% | +0.50pp | -1.19pp to +2.06pp | 6.28% | 50.99% | — |
| 5 | เด่นกว่าวันอื่น | 23 | 860 | 25.87% | 24.79% | +1.08pp | -0.30pp to +2.40pp | 5.70% | 51.22% | +0.58pp (-0.98pp to +2.18pp) |
| 5 | ความถี่รวมทุกวัน | 23 | 860 | 24.01% | 24.79% | -0.78pp | -2.79pp to +1.45pp | 5.23% | 50.26% | — |
| 5 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 23 | 860 | 25.76% | 24.79% | +0.97pp | -0.39pp to +2.27pp | 6.40% | 51.10% | — |
| 5 | เสถียรข้าม 3 ช่วง | 23 | 860 | 26.63% | 24.79% | +1.84pp | -0.58pp to +4.07pp | 6.16% | 51.54% | — |
| 5 | Consensus รายหวย | 23 | 860 | 25.70% | 24.79% | +0.91pp | -1.11pp to +2.95pp | 5.58% | 50.84% | — |
| 5 | สมดุลบนและล่าง | 23 | 860 | 25.70% | 24.79% | +0.91pp | -0.94pp to +2.55pp | 6.05% | 51.02% | — |
| 5 | Global 4+1+1 | 23 | 860 | 25.58% | 24.79% | +0.79pp | -0.58pp to +2.12pp | 6.51% | 51.02% | — |
| 6 | พบบ่อยตามวัน | 23 | 860 | 37.27% | 35.80% | +1.47pp | -0.17pp to +3.05pp | 12.56% | 61.45% | — |
| 6 | เด่นกว่าวันอื่น | 23 | 860 | 37.79% | 35.80% | +1.99pp | +0.43pp to +3.46pp | 12.56% | 62.15% | +0.52pp (-0.94pp to +1.97pp) |
| 6 | ความถี่รวมทุกวัน | 23 | 860 | 36.16% | 35.80% | +0.36pp | -2.02pp to +2.89pp | 12.44% | 60.81% | — |
| 6 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 23 | 860 | 37.27% | 35.80% | +1.47pp | -0.16pp to +3.05pp | 12.56% | 61.45% | — |
| 6 | เสถียรข้าม 3 ช่วง | 23 | 860 | 36.57% | 35.80% | +0.77pp | -1.80pp to +3.13pp | 11.98% | 61.10% | — |
| 6 | Consensus รายหวย | 23 | 860 | 37.27% | 35.80% | +1.47pp | -0.55pp to +3.41pp | 13.26% | 61.02% | — |
| 6 | สมดุลบนและล่าง | 23 | 860 | 36.98% | 35.80% | +1.18pp | -0.11pp to +2.53pp | 11.86% | 60.96% | — |
| 6 | Global 4+1+1 | 23 | 860 | 37.21% | 35.80% | +1.41pp | -0.19pp to +2.86pp | 13.37% | 61.05% | — |
| 7 | พบบ่อยตามวัน | 23 | 860 | 50.64% | 48.82% | +1.82pp | +0.15pp to +3.26pp | 23.60% | 71.48% | — |
| 7 | เด่นกว่าวันอื่น | 23 | 860 | 50.17% | 48.82% | +1.35pp | -0.40pp to +3.10pp | 23.37% | 71.45% | -0.47pp (-1.87pp to +0.94pp) |
| 7 | ความถี่รวมทุกวัน | 23 | 860 | 49.77% | 48.82% | +0.94pp | -1.54pp to +3.57pp | 24.53% | 71.13% | — |
| 7 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 23 | 860 | 50.64% | 48.82% | +1.82pp | +0.15pp to +3.30pp | 23.60% | 71.48% | — |
| 7 | เสถียรข้าม 3 ช่วง | 23 | 860 | 49.65% | 48.82% | +0.83pp | -1.65pp to +3.25pp | 23.26% | 70.70% | — |
| 7 | Consensus รายหวย | 23 | 860 | 49.65% | 48.82% | +0.83pp | -1.25pp to +2.67pp | 24.07% | 71.28% | — |
| 7 | สมดุลบนและล่าง | 23 | 860 | 50.52% | 48.82% | +1.70pp | -0.12pp to +3.52pp | 23.72% | 71.63% | — |
| 7 | Global 4+1+1 | 23 | 860 | 50.81% | 48.82% | +1.99pp | +0.16pp to +3.57pp | 23.37% | 71.34% | — |

## All eligible walk-forward dates (descriptive)

| Win | Method | Dates | Outcomes | Side pair | Random | Uplift | Date-clustered 95% CI | Both sides | Digit recall | Lift vs current |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | พบบ่อยตามวัน | 91 | 3553 | 24.58% | 24.75% | -0.17pp | -0.96pp to +0.61pp | 6.11% | 49.87% | — |
| 5 | เด่นกว่าวันอื่น | 91 | 3553 | 24.94% | 24.75% | +0.19pp | -0.59pp to +0.98pp | 5.80% | 50.18% | +0.35pp (-0.33pp to +1.09pp) |
| 5 | ความถี่รวมทุกวัน | 91 | 3553 | 24.58% | 24.75% | -0.17pp | -1.14pp to +0.80pp | 5.57% | 50.06% | — |
| 5 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 91 | 3553 | 24.70% | 24.75% | -0.05pp | -0.81pp to +0.70pp | 6.14% | 49.90% | — |
| 5 | เสถียรข้าม 3 ช่วง | 91 | 3553 | 24.85% | 24.75% | +0.10pp | -0.86pp to +1.03pp | 6.22% | 50.22% | — |
| 5 | Consensus รายหวย | 91 | 3553 | 25.06% | 24.75% | +0.31pp | -0.66pp to +1.30pp | 5.97% | 50.41% | — |
| 5 | สมดุลบนและล่าง | 91 | 3553 | 24.75% | 24.75% | +0.00pp | -0.83pp to +0.84pp | 6.14% | 49.96% | — |
| 5 | Global 4+1+1 | 91 | 3553 | 24.63% | 24.75% | -0.12pp | -0.89pp to +0.66pp | 6.05% | 49.89% | — |
| 6 | พบบ่อยตามวัน | 91 | 3553 | 35.58% | 35.76% | -0.19pp | -1.15pp to +0.79pp | 12.69% | 60.21% | — |
| 6 | เด่นกว่าวันอื่น | 91 | 3553 | 35.96% | 35.76% | +0.19pp | -0.65pp to +1.01pp | 12.05% | 60.52% | +0.38pp (-0.40pp to +1.18pp) |
| 6 | ความถี่รวมทุกวัน | 91 | 3553 | 35.77% | 35.76% | +0.01pp | -1.08pp to +1.12pp | 12.36% | 60.19% | — |
| 6 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 91 | 3553 | 35.58% | 35.76% | -0.19pp | -1.16pp to +0.77pp | 12.69% | 60.21% | — |
| 6 | เสถียรข้าม 3 ช่วง | 91 | 3553 | 35.17% | 35.76% | -0.59pp | -1.75pp to +0.52pp | 12.33% | 59.87% | — |
| 6 | Consensus รายหวย | 91 | 3553 | 36.05% | 35.76% | +0.29pp | -0.74pp to +1.33pp | 12.75% | 60.44% | — |
| 6 | สมดุลบนและล่าง | 91 | 3553 | 35.65% | 35.76% | -0.12pp | -1.02pp to +0.78pp | 12.47% | 60.17% | — |
| 6 | Global 4+1+1 | 91 | 3553 | 35.31% | 35.76% | -0.45pp | -1.36pp to +0.43pp | 12.44% | 59.58% | — |
| 7 | พบบ่อยตามวัน | 91 | 3553 | 48.97% | 48.79% | +0.18pp | -0.74pp to +1.08pp | 23.56% | 70.19% | — |
| 7 | เด่นกว่าวันอื่น | 91 | 3553 | 49.01% | 48.79% | +0.22pp | -0.61pp to +1.05pp | 22.91% | 70.42% | +0.04pp (-0.69pp to +0.78pp) |
| 7 | ความถี่รวมทุกวัน | 91 | 3553 | 49.14% | 48.79% | +0.35pp | -0.67pp to +1.36pp | 24.04% | 70.54% | — |
| 7 | ถ่วงน้ำหนักกลุ่มแหล่งข้อมูล | 91 | 3553 | 48.97% | 48.79% | +0.18pp | -0.71pp to +1.07pp | 23.56% | 70.19% | — |
| 7 | เสถียรข้าม 3 ช่วง | 91 | 3553 | 48.51% | 48.79% | -0.28pp | -1.33pp to +0.76pp | 23.14% | 69.86% | — |
| 7 | Consensus รายหวย | 91 | 3553 | 48.86% | 48.79% | +0.07pp | -0.96pp to +1.08pp | 24.06% | 70.33% | — |
| 7 | สมดุลบนและล่าง | 91 | 3553 | 49.10% | 48.79% | +0.31pp | -0.60pp to +1.22pp | 23.53% | 70.43% | — |
| 7 | Global 4+1+1 | 91 | 3553 | 48.92% | 48.79% | +0.13pp | -0.72pp to +0.97pp | 23.28% | 69.99% | — |

## Frozen promotion gate

For a size to be promoted, holdout weekday lift must have: (1) CI above exact random, (2) paired CI above the current weekday-frequency method, (3) positive paired uplift on at least four weekdays, and (4) worst weekday no lower than -3pp.

- Win 5: **FAIL**; random CI -0.30pp to +2.40pp; versus current CI -0.98pp to +2.18pp; positive weekdays 3/7; worst weekday -3.23pp.
- Win 6: **FAIL**; random CI +0.43pp to +3.46pp; versus current CI -0.94pp to +1.97pp; positive weekdays 3/7; worst weekday -4.84pp.
- Win 7: **FAIL**; random CI -0.40pp to +3.10pp; versus current CI -1.87pp to +0.94pp; positive weekdays 2/7; worst weekday -3.18pp.

## Decision

**RESEARCH_ONLY_NO_PROMOTION**

## Experimental tournament

- three-block-stability win 5: 26.63%; vs current +1.34pp (-0.82pp to +3.39pp); FAIL.
- three-block-stability win 6: 36.57%; vs current -0.70pp (-2.78pp to +1.33pp); FAIL.
- three-block-stability win 7: 49.65%; vs current -0.99pp (-3.03pp to +0.81pp); FAIL.
- lottery-consensus win 5: 25.70%; vs current +0.41pp (-1.66pp to +2.39pp); FAIL.
- lottery-consensus win 6: 37.27%; vs current +0.00pp (-1.89pp to +1.74pp); FAIL.
- lottery-consensus win 7: 49.65%; vs current -0.99pp (-3.06pp to +0.92pp); FAIL.
- top-bottom-balance win 5: 25.70%; vs current +0.41pp (-0.46pp to +1.28pp); FAIL.
- top-bottom-balance win 6: 36.98%; vs current -0.29pp (-1.35pp to +0.82pp); FAIL.
- top-bottom-balance win 7: 50.52%; vs current -0.12pp (-1.09pp to +0.82pp); FAIL.
- global-4-1-1 win 5: 25.58%; vs current +0.29pp (-1.06pp to +1.82pp); FAIL.
- global-4-1-1 win 6: 37.21%; vs current -0.06pp (-1.65pp to +1.56pp); FAIL.
- global-4-1-1 win 7: 50.81%; vs current +0.17pp (-1.19pp to +1.71pp); FAIL.

**RESEARCH_ONLY_NO_PROMOTION**

No production formula, weight, or Analyze option is changed by this study. A positive point estimate without the frozen consistency gates is not treated as predictive evidence.
