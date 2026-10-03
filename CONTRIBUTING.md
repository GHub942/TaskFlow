# Contributing to TaskFlow

Thanks for considering a contribution. This project is a single static HTML page, so most changes are simple text or data edits.

## Ways to help

- **Fix outdated information** — a feature description, bug, or security detail needs updating.
- **Add a new feature** — propose functionality that fits the existing pattern (filters, task metadata, export options).
- **Improve a translation** — the French and English versions should stay equivalent in meaning; point out anything that drifted.
- **Accessibility and design** — color contrast, keyboard navigation, screen-reader labels, responsive layout.
- **Bugs** — anything that doesn't behave as expected (drag-and-drop, Pomodoro timer, localStorage persistence, filters).

## Before you open a pull request

1. **Check your facts.** For data changes (feature specs, browser support dates, security claims), link to a source in your PR description — ideally official docs, release notes, or reputable testing.
2. **Keep entries balanced.** Don't turn documentation into marketing copy, for or against any feature or approach.
3. **Update both languages.** If you change English copy that has a French equivalent (or vice versa), update both, or flag in your PR that a translation update is still needed.
4. **Test in a browser.** Since this is a single HTML file with no build step, just open it directly and click through all features (Kanban board, Pomodoro, stats modal, search, theme toggle) in both languages before submitting.

## Adding a new feature

Each addition should fit the existing code pattern. Changes go in one of these areas:

- **Task data structure** — add fields to the `tasks` array schema (near top of script)
- **UI labels/text** — update strings in the HTML (keep parallel French/English copies)
- **Filter/options arrays** — expand `categories`, priorities, recurrence options
- **Function logic** — modify JavaScript functions while preserving existing behavior

An entry needs:
- Unique identifier if applicable
- Consistent naming with existing patterns
- Matching UI labels in both languages
- Test coverage for new paths

## Reporting an issue

Open an issue describing what's wrong and, where relevant, a screenshot or reproduction steps. There's no formal template — clarity matters more than format.

Include:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

## Code of conduct

Be respectful and assume good faith. Disagreements about feature priority or implementation approach are expected — resolve them with reasoning and examples, not volume.

## No build process

This project has no npm, webpack, or compilation. Changes are made directly to `index.html`. To test:
1. Save your changes
2. Open `index.html` in multiple browsers
3. Verify nothing broke in existing features
