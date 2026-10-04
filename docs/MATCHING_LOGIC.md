# Matching Logic

The matcher uses a deterministic eligibility gate before ranking; a match is not a promise of admission or funding.

## Tier caps

Scholarship IELTS tiers: `0` = no IELTS, `1` = 6+, `2` = 7+, `3` = 8+. Student IELTS choices cap tiers at 0, 1, 2, or 3 respectively. GPA thresholds then cap eligible tiers by target degree: Undergraduate 3.0/3.5, Master's 3.2/3.6, PhD 3.4/3.7. The final cap is the smaller cap; `not_taking` always yields tier 0. Missing GPA does not block matches.

## Filters and ranking

Require active status, target level, and `ielts_tier <= final_cap`. Apply host-country filters only when selected. For selected study fields, include scholarships tagged `General / Any Field of Study`. Origin country, funding preference, and nice-to-haves are stored only. Rank by Pakistani selection ratio descending, then nearest deadline, then funding score. Selection rates are labeled estimates, never guaranteed personal probabilities.

## Configuration

The thresholds and the optional `SEVEN_PLUS_SEES_ALL` flag will be centralized in matching configuration. Required matching tests are enumerated in the master prompt's Section 9.9.