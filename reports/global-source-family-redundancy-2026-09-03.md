# Global source-family redundancy audit

Freeze date: 2026-09-03  
Code baseline: `main@f0b28b4`  
Protocol fingerprint: `33daef6e562e6511`  
History fingerprint: `b81983030358d616`

## Audit goal

Measure source-level outcome similarity separately from family-level structural and production-signal similarity. This is a read-only data-quality audit, not model selection or predictive-performance research.

Structural family similarity does not equal predictive redundancy, and this audit does not permit interpreting any family as better or worse.

## Frozen production universe and classification

- Exact current production pool: **39 lotteries** from `GLOBAL_DAILY_SOURCE_IDS`.
- Ambiguous names are retained as singleton families. Structural grouping does not itself imply statistical redundancy.

| Lottery ID | Display name | Family ID | Family | Variant | Rationale | Live provider metadata |
|---|---|---|---|---|---|---|
| nikkei-vip-morning | หุ้นนิคเคอิ VIP เช้า | nikkei | Nikkei | VIP / morning | stable Nikkei identifier with morning/afternoon and VIP variants | https://nikkeivipstock.com/ |
| hanoiasean | ฮานอยอาเซียน | source:hanoiasean | ฮานอยอาเซียน | standalone | no conservative structural family match; retained as its own family | https://hanoiasean.com/ |
| nikkei-morning | หุ้นนิคเคอิเช้า | nikkei | Nikkei | standard / morning | stable Nikkei identifier with morning/afternoon and VIP variants | not recorded |
| szse-vip-morning | หุ้นจีน VIP เช้า | china | China / SZSE | VIP / morning | stable SZSE identifier with morning/afternoon and VIP variants | https://shenzhenindex.com/ |
| szse-morning | หุ้นจีนเช้า | china | China / SZSE | standard / morning | stable SZSE identifier with morning/afternoon and VIP variants | not recorded |
| laotv | ลาวทีวี | source:laotv | ลาวทีวี | standalone | no conservative structural family match; retained as its own family | https://lao-tv.com/ |
| hsi-vip-morning | หุ้นฮั่งเส็ง VIP เช้า | hang-seng | Hang Seng / HSI | VIP / morning | stable HSI identifier with morning/afternoon and VIP variants | https://hangsengvip.com/ |
| hsi-morning | หุ้นฮั่งเส็งเช้า | hang-seng | Hang Seng / HSI | standard / morning | stable HSI identifier with morning/afternoon and VIP variants | not recorded |
| xosohd | ฮานอย HD | source:xosohd | ฮานอย HD | standalone | no conservative structural family match; retained as its own family | https://xosohd.com/ |
| twse-vip | หุ้นไต้หวัน VIP | taiwan | Taiwan / TWSE | VIP / single session | same TWSE market with standard and VIP variants | https://tsecvipindex.com/ |
| minhngocstar | ฮานอยสตาร์ | source:minhngocstar | ฮานอยสตาร์ | standalone | no conservative structural family match; retained as its own family | https://minhngocstar.com/ |
| twse | หุ้นไต้หวัน | taiwan | Taiwan / TWSE | standard / single session | same TWSE market with standard and VIP variants | not recorded |
| ktop30-vip | หุ้นเกาหลี VIP | korea | Korea / KTOP30 | VIP / single session | same KTOP30 market with standard and VIP variants | https://ktopvipindex.com/ |
| ktop30 | หุ้นเกาหลี | korea | Korea / KTOP30 | standard / single session | same KTOP30 market with standard and VIP variants | not recorded |
| nikkei-afternoon | หุ้นนิคเคอิบ่าย | nikkei | Nikkei | standard / afternoon | stable Nikkei identifier with morning/afternoon and VIP variants | not recorded |
| nikkei-vip-afternoon | หุ้นนิคเคอิ VIP บ่าย | nikkei | Nikkei | VIP / afternoon | stable Nikkei identifier with morning/afternoon and VIP variants | https://nikkeivipstock.com/ |
| laoshd | ลาว HD | source:laoshd | ลาว HD | standalone | no conservative structural family match; retained as its own family | https://laoshd.com/ |
| szse-afternoon | หุ้นจีนบ่าย | china | China / SZSE | standard / afternoon | stable SZSE identifier with morning/afternoon and VIP variants | not recorded |
| minhngoctv | ฮานอยทีวี | source:minhngoctv | ฮานอยทีวี | standalone | no conservative structural family match; retained as its own family | https://minhngoctv.com/ |
| szse-vip-afternoon | หุ้นจีน VIP บ่าย | china | China / SZSE | VIP / afternoon | stable SZSE identifier with morning/afternoon and VIP variants | https://shenzhenindex.com/ |
| hsi-vip-afternoon | หุ้นฮั่งเส็ง VIP บ่าย | hang-seng | Hang Seng / HSI | VIP / afternoon | stable HSI identifier with morning/afternoon and VIP variants | https://hangsengvip.com/ |
| hsi-afternoon | หุ้นฮั่งเส็งบ่าย | hang-seng | Hang Seng / HSI | standard / afternoon | stable HSI identifier with morning/afternoon and VIP variants | not recorded |
| laostars | ลาวสตาร์ | lao-stars | Lao Stars | standard / single session | same named Lao Stars source with standard and VIP variants | https://www.laostars.com/ |
| sgx | หุ้นสิงคโปร์ | singapore | Singapore / SGX | standard / single session | same SGX market with standard and VIP variants | not recorded |
| xosoredcross | ฮานอยกาชาด | source:xosoredcross | ฮานอยกาชาด | standalone | no conservative structural family match; retained as its own family | https://xosoredcross.com/ |
| sgx-vip | หุ้นสิงคโปร์ VIP | singapore | Singapore / SGX | VIP / single session | same SGX market with standard and VIP variants | https://stocks-vip.com/ |
| laounion | ลาวสามัคคี | lao-union | Lao Union | standard / single session | same named Lao Union source with standard and VIP variants | https://www.laounion.com/ |
| laosasean | ลาวอาเซียน | source:laosasean | ลาวอาเซียน | standalone | no conservative structural family match; retained as its own family | https://lotterylaosasean.com/ |
| laosvip | ลาว VIP | source:laosvip | ลาว VIP | standalone | no conservative structural family match; retained as its own family | not recorded |
| laounionvip | ลาวสามัคคี VIP | lao-union | Lao Union | VIP / single session | same named Lao Union source with standard and VIP variants | https://laounionvip.com/ |
| laostarsvip | ลาวสตาร์ VIP | lao-stars | Lao Stars | VIP / single session | same named Lao Stars source with standard and VIP variants | https://www.laostarsvip.com/ |
| england-vip | อังกฤษ VIP | superrich-vip | Superrich international VIP | VIP / single session | shared live-result provider lottosuperrich.com | https://lottosuperrich.com/ |
| xosoextra | ฮานอย Extra | source:xosoextra | ฮานอย Extra | standalone | no conservative structural family match; retained as its own family | https://www.xosoextra.com/ |
| germany-vip | เยอรมัน VIP | superrich-vip | Superrich international VIP | VIP / single session | shared live-result provider lottosuperrich.com | https://lottosuperrich.com/ |
| laoredcross | ลาวกาชาด | source:laoredcross | ลาวกาชาด | standalone | no conservative structural family match; retained as its own family | https://lao-redcross.com/ |
| russia-vip | รัสเซีย VIP | superrich-vip | Superrich international VIP | VIP / single session | shared live-result provider lottosuperrich.com | https://lottosuperrich.com/ |
| laocitizen | ประชาชนลาว | source:laocitizen | ประชาชนลาว | standalone | no conservative structural family match; retained as its own family | https://laocitizen.com/ |
| laosantipap | ลาวสันติภาพ | source:laosantipap | ลาวสันติภาพ | standalone | no conservative structural family match; retained as its own family | https://laosantipap.com/ |
| laopatuxay | ลาวประตูชัย | source:laopatuxay | ลาวประตูชัย | standalone | no conservative structural family match; retained as its own family | https://laopatuxay.com/ |

Ambiguous singleton classifications: **14**.

## Data and sample guards

- Period: 2026-03-20 to 2026-09-02
- Historical target dates used for leakage-safe signals: 99
- Source pairs: 741; pairs with >=10 aligned complete dates: 741
- Outcome overlap distribution: mean 85.661, median 95.000, P75 98.000, P90 99.000, max 100.000 dates.
- <10 aligned dates: insufficient; 10-29: descriptive; >=30: stronger-sample interpretation.
- Exact top/bottom agreement uses a 1% uniform null and either-side agreement a 1.99% null. Digit overlap and signal similarities are descriptive because no single clean universal null was imposed.
- Stored sources: 39/39; read-only hydration: none.

## Within-family vs between-family distributions

| Metric | Relation | Pair count | Mean | Median | P75 | P90 | Max |
|---|---|---:|---:|---:|---:|---:|---:|
| Exact either-side agreement | within | 26 | 1.51% | 1.22% | 1.92% | 4.51% | 5.97% |
| Exact either-side agreement | between | 715 | 1.92% | 1.54% | 3.03% | 4.12% | 7.81% |
| Combined digit-set Jaccard | within | 26 | 21.46% | 21.38% | 22.64% | 23.98% | 26.98% |
| Combined digit-set Jaccard | between | 715 | 22.89% | 22.86% | 24.30% | 25.46% | 29.38% |
| Signal cosine | within | 26 | 80.88% | 80.35% | 82.46% | 83.13% | 87.46% |
| Signal cosine | between | 715 | 81.80% | 81.96% | 83.56% | 84.99% | 89.48% |
| Signal Top-6 overlap | within | 26 | 61.44% | 62.03% | 64.05% | 67.50% | 68.55% |
| Signal Top-6 overlap | between | 715 | 60.75% | 60.80% | 62.85% | 64.79% | 71.47% |

## Most notable source-level outcome pairs

| Source A | Source B | Relation | Dates | Exact top | Exact bottom | Exact either | Either uplift vs uniform | Combined digit Jaccard |
|---|---|---|---:|---:|---:|---:|---:|---:|
| sgx | laopatuxay | between | 64 | 4.69% | 3.13% | 7.81% | 5.82% | 25.36% |
| szse-afternoon | laocitizen | between | 67 | 5.97% | 1.49% | 7.46% | 5.47% | 27.34% |
| twse | sgx-vip | between | 68 | 7.35% | 0.00% | 7.35% | 5.36% | 24.03% |
| hanoiasean | nikkei-afternoon | between | 69 | 7.25% | 0.00% | 7.25% | 5.26% | 23.36% |
| nikkei-vip-morning | laounionvip | between | 98 | 5.10% | 2.04% | 7.14% | 5.15% | 23.58% |
| laoshd | hsi-vip-afternoon | between | 92 | 1.09% | 5.43% | 6.52% | 4.53% | 24.55% |
| nikkei-vip-morning | minhngocstar | between | 97 | 4.12% | 2.06% | 6.19% | 4.20% | 23.45% |
| hanoiasean | laostarsvip | between | 97 | 3.09% | 3.09% | 6.19% | 4.20% | 26.66% |
| hsi-morning | twse-vip | between | 65 | 4.62% | 1.54% | 6.15% | 4.16% | 17.91% |
| nikkei-morning | xosohd | between | 67 | 2.99% | 2.99% | 5.97% | 3.98% | 19.94% |
| nikkei-morning | nikkei-vip-afternoon | within | 67 | 1.49% | 4.48% | 5.97% | 3.98% | 20.25% |
| twse | minhngoctv | between | 67 | 5.97% | 0.00% | 5.97% | 3.98% | 20.59% |
| szse-afternoon | sgx-vip | between | 68 | 4.41% | 1.47% | 5.88% | 3.89% | 26.21% |
| szse-vip-morning | szse-morning | within | 69 | 1.45% | 4.35% | 5.80% | 3.81% | 23.27% |
| szse-vip-morning | szse-afternoon | within | 69 | 2.90% | 2.90% | 5.80% | 3.81% | 19.77% |

## Most similar leakage-safe signal pairs

Signals use only same-weekday history strictly before each target date, maximum 12 observations per lottery, and at least 4 observations.

| Source A | Source B | Relation | Dates | Cosine | Pearson | Top-6 overlap |
|---|---|---|---:|---:|---:|---:|
| nikkei-afternoon | laounion | between | 52 | 0.895 | 0.298 | 71.47% |
| nikkei-afternoon | laosvip | between | 53 | 0.894 | 0.163 | 66.98% |
| sgx | russia-vip | between | 52 | 0.887 | 0.152 | 65.38% |
| hsi-morning | nikkei-afternoon | between | 71 | 0.886 | 0.259 | 67.14% |
| twse | laosvip | between | 53 | 0.879 | 0.033 | 65.09% |
| laounion | laosvip | between | 72 | 0.878 | 0.204 | 68.29% |
| twse | laounion | between | 52 | 0.878 | 0.197 | 66.35% |
| laostarsvip | xosoextra | between | 72 | 0.877 | 0.204 | 67.13% |
| germany-vip | russia-vip | within | 73 | 0.875 | 0.155 | 68.26% |
| nikkei-afternoon | xosoextra | between | 54 | 0.874 | 0.093 | 64.81% |
| xosohd | xosoextra | between | 71 | 0.874 | 0.177 | 65.73% |
| nikkei-morning | hsi-vip-afternoon | between | 52 | 0.873 | 0.306 | 64.10% |
| xosoextra | laocitizen | between | 71 | 0.873 | 0.224 | 68.31% |
| ktop30 | laosvip | between | 53 | 0.873 | 0.143 | 66.04% |
| minhngocstar | laosvip | between | 71 | 0.872 | 0.186 | 65.26% |

## Family contribution diagnostic

| Family | Sources | Pool share | Avg eligible sources/date | Avg history | Within signal cosine | Within Top-6 overlap | Rule flag |
|---|---:|---:|---:|---:|---:|---:|---|
| China / SZSE | 4 | 10.26% | 2.91 | 9.51 | 0.800 | 62.68% | no |
| Hang Seng / HSI | 4 | 10.26% | 2.94 | 9.40 | 0.810 | 62.53% | no |
| Nikkei | 4 | 10.26% | 2.90 | 9.49 | 0.802 | 61.01% | no |
| Superrich international VIP | 3 | 7.69% | 2.25 | 8.61 | 0.822 | 58.48% | no |
| Korea / KTOP30 | 2 | 5.13% | 1.43 | 9.35 | 0.795 | 54.90% | no |
| Lao Stars | 2 | 5.13% | 1.47 | 8.55 | 0.813 | 57.18% | no |
| Lao Union | 2 | 5.13% | 1.45 | 8.50 | 0.822 | 67.36% | no |
| Singapore / SGX | 2 | 5.13% | 1.46 | 9.54 | 0.816 | 62.82% | no |
| Taiwan / TWSE | 2 | 5.13% | 1.43 | 9.57 | 0.836 | 62.42% | no |
| ฮานอยอาเซียน | 1 | 2.56% | 0.76 | 8.64 | 0.000 | 0.00% | no |
| ประชาชนลาว | 1 | 2.56% | 0.72 | 8.38 | 0.000 | 0.00% | no |
| ลาวประตูชัย | 1 | 2.56% | 0.74 | 8.55 | 0.000 | 0.00% | no |
| ลาวกาชาด | 1 | 2.56% | 0.74 | 8.55 | 0.000 | 0.00% | no |
| ลาวสันติภาพ | 1 | 2.56% | 0.72 | 8.38 | 0.000 | 0.00% | no |
| ลาวอาเซียน | 1 | 2.56% | 0.73 | 8.50 | 0.000 | 0.00% | no |
| ลาว HD | 1 | 2.56% | 0.72 | 8.45 | 0.000 | 0.00% | no |
| ลาว VIP | 1 | 2.56% | 0.76 | 8.64 | 0.000 | 0.00% | no |
| ลาวทีวี | 1 | 2.56% | 0.76 | 8.64 | 0.000 | 0.00% | no |
| ฮานอยสตาร์ | 1 | 2.56% | 0.72 | 8.45 | 0.000 | 0.00% | no |
| ฮานอยทีวี | 1 | 2.56% | 0.72 | 8.45 | 0.000 | 0.00% | no |
| ฮานอย Extra | 1 | 2.56% | 0.77 | 8.68 | 0.000 | 0.00% | no |
| ฮานอย HD | 1 | 2.56% | 0.72 | 8.45 | 0.000 | 0.00% | no |
| ฮานอยกาชาด | 1 | 2.56% | 0.75 | 8.59 | 0.000 | 0.00% | no |

Families meeting the pre-registered diagnostic rule: **none**. A flag means only potential redundancy worth knowing about.

## Leave-one-family-out Top 6 sensitivity

No outcomes or hit rates are evaluated after removal.

| Family | Sources | Dates | Avg membership overlap | Avg changed digits | Exact same order |
|---|---:|---:|---:|---:|---:|
| China / SZSE | 4 | 99 | 5.44/6 | 0.56 | 4.04% |
| Hang Seng / HSI | 4 | 99 | 5.39/6 | 0.61 | 3.03% |
| Nikkei | 4 | 99 | 5.41/6 | 0.59 | 4.04% |
| Superrich international VIP | 3 | 99 | 5.56/6 | 0.44 | 7.07% |
| Korea / KTOP30 | 2 | 99 | 5.61/6 | 0.39 | 13.13% |
| Lao Stars | 2 | 99 | 5.57/6 | 0.43 | 10.10% |
| Lao Union | 2 | 99 | 5.57/6 | 0.43 | 12.12% |
| Singapore / SGX | 2 | 99 | 5.58/6 | 0.42 | 6.06% |
| Taiwan / TWSE | 2 | 99 | 5.58/6 | 0.42 | 7.07% |
| ฮานอยอาเซียน | 1 | 99 | 5.69/6 | 0.31 | 15.15% |
| ประชาชนลาว | 1 | 99 | 5.71/6 | 0.29 | 17.17% |
| ลาวประตูชัย | 1 | 99 | 5.58/6 | 0.42 | 16.16% |
| ลาวกาชาด | 1 | 99 | 5.62/6 | 0.38 | 19.19% |
| ลาวสันติภาพ | 1 | 99 | 5.69/6 | 0.31 | 25.25% |
| ลาวอาเซียน | 1 | 99 | 5.68/6 | 0.32 | 24.24% |
| ลาว HD | 1 | 99 | 5.55/6 | 0.45 | 13.13% |
| ลาว VIP | 1 | 99 | 5.65/6 | 0.35 | 16.16% |
| ลาวทีวี | 1 | 99 | 5.62/6 | 0.38 | 18.18% |
| ฮานอยสตาร์ | 1 | 99 | 5.66/6 | 0.34 | 22.22% |
| ฮานอยทีวี | 1 | 99 | 5.67/6 | 0.33 | 19.19% |
| ฮานอย Extra | 1 | 99 | 5.73/6 | 0.27 | 20.20% |
| ฮานอย HD | 1 | 99 | 5.75/6 | 0.25 | 23.23% |
| ฮานอยกาชาด | 1 | 99 | 5.65/6 | 0.35 | 15.15% |

## Conclusion

**No meaningful evidence of source-family redundancy under the pre-registered diagnostic rule.**

No production action is justified by this audit. It does not test whether removing or reweighting a family improves future results.

## Limitations

- Structural families are conservative metadata classifications, not causal relationships.
- Uniform exact-agreement nulls do not model source-specific marginal digit distributions.
- Vector similarity is descriptive and can be high because all ten digits have broadly similar base rates.
- Related schedules and market labels do not prove shared result generation.
- Leave-one-family-out measures ranking sensitivity only, never predictive performance.

## Contract confirmation

- Production formula changed: **NO**
- Production pool changed: **NO**
- Production UI changed: **NO**
- Prospective tracking added: **NO**
