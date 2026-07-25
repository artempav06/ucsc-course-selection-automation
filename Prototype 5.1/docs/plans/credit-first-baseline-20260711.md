# Credit-First Scheduler Baseline

Updated: 2026-07-11 before implementing the first credit-first staged-engine phases.

## Commands run

```bash
cd "/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code"
node test_combo_matrix.js > /tmp/prototype4-combo-before.txt
node test_schedule_regression.js > /tmp/prototype4-regression-before.txt
```

Both commands exited 0.

## Baseline combo matrix

- Scenarios checked: 3,531
- Hard failures: 0
- Warnings: 2,121

Warning buckets:

- `schedule length exceeds selected window`: 1,981
  - Example: `AM_BS/***/none/freshman-fall/standard/winter-gap: years=5 units=181 :: schedule length 5>window 4`
  - Example: `AM_BS/***/none/freshman-fall/standard/full-year-gap: years=5 units=184 :: schedule length 5>window 4`
- `major-course density exceeds target`: 520
  - Example: `BMEB_BI/bi_computational/none/freshman-fall/standard/winter-gap: years=5 units=180 :: max major quarter 4>3`
  - Example: `BMEB_BI/bi_computational/none/freshman-winter/standard/no-gap: years=4 units=185 :: max major quarter 4>3`

Interpretation: the current broad warning policy still uses course-count/density language (`max major quarter 4>3`), which should be replaced or supplemented by the new credit-first diagnostics.

## Baseline schedule regression

Representative regression cases passed:

- `AM_BS/am_modeling`: 4 years, 180 units
- `TIM_BS/tim_entrepreneurship`: 4 years, 183 units
- `TIM_BS/tim_systems_eng`: 4 years, 188 units
- `TIM_BS/tim_finance_econ`: 4 years, 183 units
- `RE_BS/re_autonomous`: 4 years, 193 units
- `EE_BS/ee_signals_comm`: 4 years, 200 units
- `CS_BS/cs_ai_ml`: 4 years, 181 units
- Aggregate: 12/12 supported majors have a <=4-year default plan

## Representative scenarios to keep watching

Use these as inspection fixtures while implementing phases 1-4:

1. `CS_BS / cs_ai_ml / ge_tech_society / freshman fall / maxUnits 19`
   - Good for testing major/elective + GE interest scoring.
2. `EE_BS / ee_signals_comm / freshman fall / maxUnits 19`
   - Good for testing dense engineering load and soft-20 avoidance.
3. `TIM_BS / tim_entrepreneurship or tim_data_analytics / freshman fall / maxUnits 19`
   - Good for testing elective-interest choice and business/tech elective ranking.
4. `BMEB_BI / bi_computational / freshman fall / maxUnits 19`
   - Good for testing lab-heavy major behavior and whether low-unit labs are treated correctly.
5. `AM_BS / am_modeling / gap scenarios`
   - Good for testing long-window warnings after credit-first placement phases.

## Baseline files

Raw command outputs were captured temporarily at:

- `/tmp/prototype4-combo-before.txt`
- `/tmp/prototype4-regression-before.txt`

If needed later, re-run the commands above rather than relying on `/tmp` persistence.
