# Bandwise

Independent IELTS Academic and General Training practice, in English and Arabic. A static PWA that keeps learning history on the learner's device. Published by Jotech.

## Version 1.1

- **Study coach:** a 15, 30, 45 or 60 minute daily plan, prioritised using saved skill results and recent question-type accuracy. Completed practice can tick off the relevant task. Learners can also mark independent study done.
- **Mistake notebook:** missed Reading and Listening questions are collected automatically from full tests, individual sections and drills. Search questions and personal notes; filter by skill, question type and review status.
- **Active recall:** retry the original question with its passage, transcript, table or map. Correct answers return after 1, 3, 7, 14 and 30 days. Wrong or revealed answers return after ten minutes. Early correct practice does not advance the retention streak. Three consecutive scheduled successes count as retained; retained questions continue to return.
- **Progress:** recent averages, sample counts, score sources, target gaps, seven-day activity and local-calendar study streaks. Export results to CSV or print a report from Study coach or Progress.
- **Reliable results:** Academic and General Reading and Task 1 scores stay separate. Partial tests do not receive a band. Transcript-only AI Speaking feedback supplies vocabulary/grammar indicators and comments, without inventing pronunciation, fluency or an overall Speaking score.
- **App reliability:** test controls work after answer checking and display changes, dialogs contain keyboard focus, backup imports merge older schemas, and installation URLs work under either `/Bandwise/` or `/bandwise/`.

The existing four-skill practice, mock tests, Writing checks, vocabulary cards, strategies and exam guide remain available. Test content stays in English; the interface and new learning features support English and Arabic, light and dark themes, and narrow screens.

## Run locally

There is no application build step or runtime dependency. Serve this directory over HTTP:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/`. Service workers require HTTPS or a trusted local origin such as localhost. Open the app online once to cache it before testing offline. Listening voices depend on the installed device/browser voices; the optional AI providers require their own configuration and connectivity.

## Validate changes

Node 20 or newer is required for development checks:

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite starts its own static server under `/Bandwise/`. It exercises real-bank questions, submission and post-check controls, notebook search and notes, retry widgets, scheduling, downloads, legacy imports, malformed-import rejection, Arabic RTL, phone layout and a cold offline reload. Screenshots are written to ignored `qa-output/`.

For an existing Chromium installation, set `BW_CHROMIUM_EXECUTABLE` to its executable path. Tests do not make paid AI requests or require microphone permission. GitHub Actions runs the syntax, core and browser checks for pull requests and pushes to main.

## Deploy

Serve the repository root from the existing static host. Do not change the existing production URL when updating an installed app. The manifest uses relative IDs, scope, start URL and shortcuts, so the resolved identity at an existing `/bandwise/` deployment is preserved while a `/Bandwise/` deployment also works. A new service-worker cache version includes all additional modules and the exam guide fallback.

After merging, verify the host has published the new files and reopen the installed app to check version **1.1.0** in Settings. See [the release checks](docs/RELEASE_CHECKS.md) before releasing a Store package.

## Data and assessment limits

- Existing `bandwise.v1` history is retained. New review schedules, notes, daily tasks and activity records use the same local store and are included in the existing backup export.
- Exported backups exclude the AI API key. Restore retains the key already configured on the destination device and supplies defaults for fields missing from older backups.
- Daily tasks stay stable within a day and are rebuilt for a new day, module, target or study budget. The mistake queue updates whenever practice is saved. Study minutes are planned budgets, not measured time on task.
- Reading notebook questions and Reading trends follow the selected module; CSV exports retain the whole history and identify each module/task.
- Band conversions and AI/offline indicators are practice guidance, not official IELTS results. Writing averages use Task 2 only; the home page's Writing estimate uses the existing Task 1/Task 2 weighting.
- Listening uses device text-to-speech. This update does not add human-recorded audio, cloud accounts, paid subscriptions, audio-based AI pronunciation assessment or additional test banks.

The original material and trademark notice are included in the app. IELTS is a registered trademark of its owners; Bandwise is independent and is not endorsed by IELTS, the British Council, IDP or Cambridge University Press & Assessment.
