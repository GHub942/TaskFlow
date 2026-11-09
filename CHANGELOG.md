# Changelog

## Unreleased

- Add task tags with card chips, search, and a dedicated filter.
- Add a "due today" filter, task duplication, and undo for task deletion.
- Add enriched productivity statistics: completion by category, tracked time per task, 14-day session chart, and streak.
- Add CSV and iCalendar exports alongside JSON backups.
- Add a "Delete all data" action in Settings > Data that clears tasks and preferences.
- Add swipe navigation between board columns on mobile with page indicators.
- Expand the interface to 12 languages: English (US/UK), French, Spanish, Italian, German, Russian, Ukrainian, Chinese, Korean, and Japanese.
- Extract the inline application script into `app.js` and move translations into `i18n.js`.
- Self-host Tailwind CSS, Font Awesome, and the Inter font under `vendor/` so the app makes no third-party requests and works fully offline.
- Import CSV and iCalendar files in addition to JSON backups, and round-trip TaskFlow iCalendar exports.
- Switch default category names to English (`Work`, `Dev`, `Design`, `Personal`) with a one-time migration for untouched defaults.
- Close dialogs when clicking the backdrop and hide the tag filter until a task uses tags.
- Use fixed-width filter controls and non-wrapping, scrollable due-date filter buttons on small screens.
- Fix tooltip positioning inside glass panels (backdrop-filter containing block) and translate the default seed tasks to English.
- Reorganize settings into tabs with independent task-data and preference retention controls.
- Replace number spinners with custom duration steppers and add Start/Pause/Resume Pomodoro controls.
- Make the Pomodoro widget draggable and restore its position when task data is saved.
- Fix tooltip dismissal after pointer/focus leaves and keep tooltips viewport-clamped.
- Add dependency-free automated tests and CI checks for core behavior and offline caching.
- Add managed categories, configurable resumable Pomodoro timers, and import previews.
- Add explicit notification and sound tests, accessible form controls, and viewport-clamped tooltips.
- Add service-worker caching for the app shell and CDN resources on localhost/HTTPS.
- Add persistent system-aware language and theme settings, including a TaskMaster palette.
- Add versioned backups with validation, safe merge/replace, and legacy array import support.
- Track completed Pomodoro sessions by task and add optional browser and sound alerts.
- Generate recurring task occurrences, overdue/upcoming filters, and accessible task movement controls.
- Expand search to categories and status with keyboard result navigation.
- Rename the visible product branding to TaskFlow.
- Correct usage, privacy, contributor, and agent documentation.
