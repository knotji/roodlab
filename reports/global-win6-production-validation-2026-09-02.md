# Frozen production validation — Global Win 6

Freeze date: 2026-09-02  
Protocol fingerprint: `60c58d469de69be1`  
History fingerprint: `d928fbac36f7629f`

## Frozen production contract

- Curated production pool: exactly 46 lotteries.
- Overall ranking; select top 6 digits.
- Same weekday only; maximum 12 prior matching weekdays per lottery.
- Top2 and bottom2 weight 50:50; every lottery has equal weight.
- Digit presence is counted once per side/result, including doubles.
- Every target and future draw is excluded from its ranking.
- Walk-forward dates require at least 10 complete target lotteries.
- Exact random baselines enumerate all 210 possible six-digit subsets and preserve double-specific coverage.
- Confidence intervals use 10,000 deterministic target-date clustered bootstrap samples.
- This report validates the frozen formula only; no tuning or promotion is permitted from its results.

## Data availability

- Historical snapshots already stored: **35/46**.
- Missing snapshots hydrated read-only from the canonical source for this report: **11** (ktop30, set, england-vip, moexbc, gdaxi, ftse100, laoredcross, russia-vip, dowjones-vip, dowjonestar, dji).
- Validation hydration did not write snapshots or alter production storage.

## Results

- Walk-forward dates: **120**
- Complete lottery outcomes: **4366**

| Metric | Actual | Actual 95% CI | Exact random | Uplift | Date-clustered 95% CI of uplift |
|---|---:|---:|---:|---:|---:|
| เข้าเต็มบน 2 ตัว | 38.32% | 36.80% ถึง 39.82% | 35.81% | +2.51pp | +1.06pp ถึง +3.96pp |
| เข้าเต็มล่าง 2 ตัว | 34.52% | 33.32% ถึง 35.77% | 35.63% | -1.11pp | -2.32pp ถึง +0.13pp |
| เข้าเต็มอย่างน้อยหนึ่งฝั่ง | 59.46% | 58.06% ถึง 60.86% | 59.43% | +0.03pp | -1.28pp ถึง +1.37pp |
| เข้าเต็มทั้งสองฝั่ง | 13.38% | 12.53% ถึง 14.24% | 12.02% | +1.36pp | +0.53pp ถึง +2.20pp |
| Digit recall 4 ตำแหน่ง | 60.49% | 59.85% ถึง 61.14% | 60.00% | +0.49pp | -0.15pp ถึง +1.14pp |

## Decision

**FROZEN_VALIDATION_ONLY_NO_TUNING**

The production formula remains unchanged. Point estimates are not treated as predictive evidence when the uplift interval includes zero or lacks stability across future independent data.

## Per-lottery sample coverage

| Lottery ID | Prediction dates with history | Mean same-weekday training draws | Min-max | Target outcomes |
|---|---:|---:|---:|---:|
| nikkei-vip-morning | 95 | 7.1 | 1-12 | 98 |
| hanoiasean | 95 | 7.1 | 1-12 | 98 |
| nikkei-morning | 94 | 9.0 | 2-12 | 87 |
| szse-vip-morning | 95 | 7.1 | 1-12 | 98 |
| szse-morning | 94 | 8.6 | 1-12 | 91 |
| laotv | 95 | 7.1 | 1-12 | 98 |
| hsi-vip-morning | 96 | 7.0 | 1-12 | 93 |
| hsi-morning | 94 | 8.7 | 1-12 | 88 |
| xosohd | 96 | 7.2 | 1-12 | 98 |
| twse-vip | 96 | 7.2 | 1-12 | 98 |
| minhngocstar | 96 | 7.2 | 1-12 | 98 |
| twse | 94 | 9.1 | 2-12 | 82 |
| ktop30-vip | 96 | 7.2 | 1-12 | 98 |
| ktop30 | 93 | 8.5 | 1-12 | 90 |
| nikkei-afternoon | 94 | 9.0 | 1-12 | 88 |
| nikkei-vip-afternoon | 95 | 7.1 | 1-12 | 98 |
| laoshd | 95 | 7.1 | 1-12 | 98 |
| szse-afternoon | 94 | 8.6 | 1-12 | 91 |
| minhngoctv | 95 | 7.1 | 1-12 | 98 |
| szse-vip-afternoon | 95 | 7.1 | 1-12 | 98 |
| hsi-vip-afternoon | 96 | 6.9 | 1-12 | 93 |
| hsi-afternoon | 94 | 8.7 | 1-12 | 88 |
| laostars | 96 | 7.2 | 1-12 | 98 |
| sgx | 94 | 8.7 | 1-12 | 88 |
| xosoredcross | 96 | 7.2 | 1-12 | 98 |
| set | 91 | 8.7 | 1-12 | 92 |
| sgx-vip | 96 | 7.2 | 1-12 | 98 |
| laounion | 97 | 7.2 | 1-12 | 98 |
| laosasean | 97 | 7.2 | 1-12 | 98 |
| laosvip | 97 | 7.2 | 1-12 | 98 |
| laounionvip | 97 | 7.2 | 1-12 | 98 |
| laostarsvip | 97 | 7.2 | 1-12 | 98 |
| england-vip | 91 | 6.9 | 1-12 | 98 |
| moexbc | 94 | 8.6 | 2-12 | 87 |
| xosoextra | 97 | 7.2 | 1-12 | 98 |
| gdaxi | 94 | 8.6 | 1-12 | 93 |
| ftse100 | 94 | 8.5 | 1-12 | 91 |
| germany-vip | 97 | 7.2 | 1-12 | 98 |
| laoredcross | 91 | 6.9 | 1-12 | 98 |
| russia-vip | 91 | 6.9 | 1-12 | 98 |
| dowjones-vip | 91 | 6.9 | 1-12 | 98 |
| dowjonestar | 91 | 6.9 | 1-12 | 97 |
| dji | 92 | 8.4 | 1-12 | 90 |
| laocitizen | 95 | 7.0 | 1-12 | 96 |
| laosantipap | 96 | 7.1 | 1-12 | 97 |
| laopatuxay | 95 | 7.1 | 1-12 | 96 |

## Potential source redundancy diagnostic

Exact top2+bottom2 agreement on aligned dates; diagnostic only. A duplicate flag requires at least 10 aligned dates and >=80% exact agreement.

| Source A | Source B | Aligned dates | Exact agreement |
|---|---|---:|---:|
| laotv | minhngocstar | 99 | 2.02% |
| nikkei-afternoon | russia-vip | 67 | 1.49% |
| hsi-afternoon | laosasean | 69 | 1.45% |
| england-vip | dji | 71 | 1.41% |
| szse-morning | xosohd | 72 | 1.39% |
| szse-afternoon | laostars | 72 | 1.39% |
| hsi-morning | twse | 84 | 1.19% |
| twse | gdaxi | 87 | 1.15% |
| hsi-afternoon | moexbc | 87 | 1.15% |
| laostars | laocitizen | 97 | 1.03% |

Duplicate pairs at the frozen 80% threshold: **0**. No family weighting or production change is made from this diagnostic.
