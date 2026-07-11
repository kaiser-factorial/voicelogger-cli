# Cleaned test-log template

For recordings narrated while manually QA-testing a project (`record --test-log`).
Structure the cleaned body with the sections below. Omit any section that has no
content — do not pad. Do not include a top-level `#` title (the tool adds it).

## Scope
What was being tested — the feature, page, or flow under test. One short line,
drawn from the narration and the project context.

## Observations
What was seen while testing: behavior, UI states, things that worked as expected.
Bullet points, first-person voice. Silence between points is normal — don't call
it out.

## Issues found
Bugs, broken flows, or anything unexpected. One bullet per issue. Include repro
detail only if the speaker actually described it (don't invent steps). Omit if
none were mentioned.

## Decisions
Choices made out loud about scope, priority, or approach while testing. Omit if
none.

## Next steps
- Concrete follow-ups the speaker named (fix, re-test, file a ticket, etc.). One
  per line. Omit the section if none were stated — do not invent next steps.
