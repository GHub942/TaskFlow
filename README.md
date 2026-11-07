# TaskFlow

TaskFlow is a browser-based Kanban task manager delivered as a single HTML file. It keeps task data in the browser and does not require an account or application server.

The interface supports English (US) and French (France), with system-language detection. Appearance can follow the system or use Light, Dark, or TaskMaster themes.

## Features

- Three-column Kanban board with drag-and-drop and accessible task-move controls
- Task priorities, categories, due dates, recurrence, estimates, and subtasks
- Pomodoro timer with task-linked session history and productivity statistics
- Search across task titles, descriptions, categories, and statuses
- Overdue and upcoming due-date filters
- Versioned JSON backup and restore, including task data and preferences
- Keyboard navigation, responsive layout, and optional completion notifications

## Settings and shortcuts

- Language: `System (Detected_language)`, `English (US)`, or `Français (FR)`
- Theme: `System (Detected_theme)`, `Light`, `Dark`, or `TaskMaster`
- `Ctrl+K` / `Cmd+K`: open search; use the arrow keys and Enter to open a result
- `Ctrl+N` / `Cmd+N`: create a task; `Esc` closes the active dialog
- Browser notifications require permission; sound alerts are separately optional

JSON backups can replace current data or merge into it. During a merge, existing local tasks take precedence when IDs conflict. Older task-array backups remain supported.

## Run

Open `index.html` in a modern browser. No build step or package manager is required. The page loads Tailwind CSS, Font Awesome, and the Inter font from third-party CDNs, so those resources require an internet connection; the core task data remains local to the browser.

## Data and privacy

Tasks, settings, and timer sessions are stored in browser `localStorage`. They are not synchronized between browsers or devices. Export backups regularly; browser storage can be cleared or limited. Review [SECURITY.md](SECURITY.md) for the external-resource and data-handling details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project conventions and browser verification guidance.

## License

Released under the [MIT License](LICENSE.md).
