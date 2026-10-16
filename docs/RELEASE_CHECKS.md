# Release checks for 1.1.0

## Completed in development

- All JavaScript and JSON source files parse.
- 22 core tests cover legacy backup merging, malformed input, scoring, section/drill question mapping, duplicate mistakes, module isolation, scheduled review intervals, early retries, local dates and streaks, plan budgets/completion, CSV handling, transcript-only AI feedback, bilingual rendering and cache/manifest coverage.
- Chromium browser checks cover actual Reading practice submission, controls after checking, notebook search/notes, correct/revealed retry behavior, table/map/multiple-choice/multiple-selection/matching widgets, downloads, legacy restore and key retention, malformed restore rejection, 19 app routes, Arabic RTL, 390 px phone layouts and an offline reload under `/Bandwise/`.
- English desktop and Arabic dark phone screenshots were visually reviewed. Screenshots are test fixtures, not marketing material.

## Before publishing a production or Microsoft Store update

1. Merge the reviewed pull request and confirm the existing host publishes all changed/new files. There is no build output directory to upload.
2. In an installed Windows app, close all instances, reopen online, and check **1.1.0** in Settings. Confirm the host still uses the existing production URL.
3. Export a backup before updating, confirm saved attempts/essays/notes remain available, then verify restoring that backup in a separate test profile.
4. Run one Listening section with installed English voices and a Speaking session with microphone recording/playback on the target Windows device. Local headless tests do not verify a physical microphone or Windows voice quality.
5. If optional AI feedback is offered, verify one Writing and one Speaking request against the configured provider/model. No paid provider call was made during development. Confirm transcript-only Speaking feedback shows no pronunciation, fluency or overall AI band.
6. Verify installation, shortcuts, offline launch, Arabic/English switching, light/dark display, result export and print preview on the production origin.

Reference for the Speaking criteria: [official IELTS Speaking assessment criteria](https://ielts.org/cdn/Guides/ielts-speaking-key-assessment-criteria.pdf). Pronunciation and spoken delivery require audio evidence; text feedback is labelled separately in this release.
