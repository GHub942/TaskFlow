# TaskFlow

A self-contained HTML page for task management — featuring **Kanban workflow**, **Pomodoro timer**, and **dark/light themes**. No server, no dependencies, no tracking.

Available in French and English (default), with an in-page language switch — no build step, no dependencies.

## What's inside

- **Kanban Board** — three-column workflow (To Do → In Progress → Done) with drag-and-drop task movement
- **Task Management** — create, edit, delete tasks with metadata (priority, category, deadline, duration, subtasks)
- **Pomodoro Timer** — integrated productivity timer linked to individual tasks
- **Statistics Dashboard** — completion rates, estimated time tracking, progress bars
- **Global Search** — quick find with `⌘K` shortcut
- **Data Export/Import** — backup and restore via JSON files
- **Customization** — color picker, dark mode toggle, category filters, sorting options

## Features

| Feature | Description |
|---------|-------------|
| Drag & Drop | Move tasks between columns visually |
| Local Storage | All data stays in browser |
| Keyboard Shortcuts | `⌘K` for search, `Esc` to close modals |
| Glassmorphism UI | Modern translucent panel design |
| Responsive Layout | Works on desktop and mobile |

## Usage

This is a static, single-file site: open `v1.1.html` directly in a browser, or host it on any static file host (GitHub Pages, Netlify, plain web server). There is no server-side component and no build process.

## Data & accuracy

Task data persists in browser `localStorage`. Founding categories, feature lists, and technical specs were accurate as of the last update noted in the page footer. LocalStorage quotas vary by browser (typically 5MB per domain) — export regularly for backups. See [SECURITY.md](SECURITY.md) for limitations and [CONTRIBUTING.md](CONTRIBUTING.md) if you'd like to help keep this up to date.

## License

Released under the [MIT License](LICENSE.md).
