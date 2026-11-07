# TaskFlow

TaskFlow is a static browser-based Kanban task manager. Its interface is in `index.html`, with small local JavaScript modules for tested domain rules and offline caching. It keeps task data in the browser and does not require an account or application backend.

The interface supports English (US) and French (France), with system-language detection. Appearance can follow the system or use Light, Dark, or TaskMaster themes.

## Features

- Three-column Kanban board with drag-and-drop and accessible task-move controls
- Task priorities, managed categories, due dates, recurrence, estimates, and subtasks
- Configurable Pomodoro work and break lengths, resumable timer, and task-linked session history
- Search across task titles, descriptions, categories, and statuses
- Overdue and upcoming due-date filters
- Versioned JSON backup and restore with import preview and replace/merge options
- Keyboard navigation, responsive accessible controls, and testable notification/sound alerts
- Offline app-shell caching when hosted on localhost or HTTPS

## Settings and shortcuts

- Language: `System (Detected_language)`, `English (US)`, or `Français (FR)`
- Theme: `System (Detected_theme)`, `Light`, `Dark`, or `TaskMaster`
- `Ctrl+K` / `Cmd+K`: open search; use the arrow keys and Enter to open a result
- `Ctrl+N` / `Cmd+N`: create a task; `Esc` closes the active dialog
- Browser notifications require permission; sound alerts are separately optional
- Settings include explicit test actions for browser notifications and sound

JSON backups can replace current data or merge into it. The preview summarizes new tasks and ID conflicts before applying changes; during a merge, existing local tasks take precedence. Older task-array backups remain supported.

## Run

Open `index.html` in a modern browser. No build step or package manager is required. The page loads Tailwind CSS, Font Awesome, and the Inter font from third-party CDNs, so the first visit requires an internet connection. For offline app-shell caching, serve the static files from localhost or HTTPS; browsers do not allow service workers for `file://` pages. Task data always stays local to the browser.

## Data and privacy

Tasks, settings, and timer sessions are stored in browser `localStorage`. They are not synchronized between browsers or devices. Export backups regularly; browser storage can be cleared or limited. Review [SECURITY.md](SECURITY.md) for the external-resource and data-handling details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project conventions and browser verification guidance.

## Tests

Run the dependency-free core behavior tests with `node --test tests/*.test.js`. GitHub Actions also checks the inline application JavaScript syntax.

## License

Released under the [MIT License](LICENSE.md).
