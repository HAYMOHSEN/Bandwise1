# Changelog

## 1.1.0 — 16 October 2026

### Added

- Bilingual Study coach with configurable daily study budgets and automatic completion from saved activities.
- Personal mistake notebook with search, skill/type/status filters, learning notes and original source context.
- Scheduled active-recall reviews with appropriate controls for gap fills, multiple choice, multiple selections, matching, headings and diagram/map labelling.
- Recent skill averages, score provenance, target gaps, activity history and local-date streaks.
- CSV results export and print layouts.
- Repeatable core tests, browser smoke tests and a GitHub Actions validation workflow.

### Fixed

- Rebind Reading/Listening frame controls after answer checking or display changes.
- Separate Academic and General Reading evidence and Task 1 records; keep Reading drills within the selected module.
- Reject duplicate multi-answer credit and over-selection.
- Prevent transcript-only Speaking feedback from supplying invented pronunciation/fluency/overall scores; retain self-assessment as a separate source.
- Validate AI feedback before saving scores and discard corrections that do not quote the response.
- Deep-merge legacy backups, reject malformed records, preserve the locally configured API key during import and apply restored language/theme settings.
- Trap dialog focus, return it on close, and clean up confirmation listeners.
- Use relative PWA installation paths and include the learning workspace and guide fallback in the offline cache.
