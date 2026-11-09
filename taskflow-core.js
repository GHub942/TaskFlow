(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TaskFlowCore = api;
})(globalThis, function() {
    const taskStatuses = ['todo', 'in_progress', 'done'];
    const priorities = ['low', 'medium', 'high'];
    const recurrenceOptions = ['none', 'daily', 'weekly', 'monthly'];
    const settingLanguages = ['system', 'en', 'en-GB', 'fr', 'es', 'it', 'de', 'ru', 'uk', 'zh', 'ko', 'ja'];
    const settingThemes = ['system', 'light', 'dark', 'taskmaster'];

    function normalizeImportedTasks(value, categories = []) {
        if (!Array.isArray(value) || value.length > 10000) return null;
        const ids = new Set();
        const normalized = [];
        for (const [index, task] of value.entries()) {
            if (!task || typeof task !== 'object' || Array.isArray(task)) return null;
            const id = String(task.id ?? '');
            if (!/^[\w-]{1,100}$/.test(id) || ids.has(id)) return null;
            if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 500) return null;
            if (task.status != null && !taskStatuses.includes(task.status)) return null;
            if (task.priority != null && !priorities.includes(task.priority)) return null;
            if (task.recurrence != null && !recurrenceOptions.includes(task.recurrence)) return null;
            const dueDate = task.dueDate == null ? '' : String(task.dueDate);
            if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(new Date(`${dueDate}T00:00:00Z`).getTime()) || new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate)) return null;
            if (task.description != null && (typeof task.description !== 'string' || task.description.length > 10000)) return null;
            const rawTags = task.tags == null ? [] : task.tags;
            if (!Array.isArray(rawTags) || rawTags.length > 10) return null;
            const tags = [];
            const tagKeys = new Set();
            for (const rawTag of rawTags) {
                if (typeof rawTag !== 'string') return null;
                const tag = rawTag.trim();
                if (!tag || tag.length > 30) return null;
                const tagKey = tag.toLocaleLowerCase();
                if (!tagKeys.has(tagKey)) {
                    tagKeys.add(tagKey);
                    tags.push(tag);
                }
            }
            if (task.category != null && (typeof task.category !== 'string' || !task.category.trim() || task.category.length > 60)) return null;
            if (task.duration != null && (!Number.isFinite(Number(task.duration)) || Number(task.duration) < 0 || Number(task.duration) > 100000)) return null;
            const subtasks = task.subtasks == null ? [] : task.subtasks;
            if (!Array.isArray(subtasks) || subtasks.length > 500) return null;
            const subtaskIds = new Set();
            const normalizedSubtasks = [];
            for (const [subtaskIndex, subtask] of subtasks.entries()) {
                if (!subtask || typeof subtask.title !== 'string' || !subtask.title.trim() || subtask.title.length > 500) return null;
                if (subtask.completed != null && typeof subtask.completed !== 'boolean') return null;
                const subtaskId = String(subtask.id ?? `sub_${index}_${subtaskIndex}`);
                if (!/^[\w-]{1,100}$/.test(subtaskId) || subtaskIds.has(subtaskId)) return null;
                subtaskIds.add(subtaskId);
                normalizedSubtasks.push({ id: subtaskId, title: subtask.title, completed: subtask.completed === true });
            }
            ids.add(id);
            normalized.push({
                ...task,
                id,
                title: task.title.trim(),
                description: task.description || '',
                status: task.status || 'todo',
                priority: task.priority || 'medium',
                category: task.category || categories[0] || 'General',
                color: /^#[0-9a-f]{6}$/i.test(task.color || '') ? task.color : '#6366f1',
                dueDate,
                duration: Number(task.duration) || 30,
                recurrence: task.recurrence || 'none',
                tags,
                subtasks: normalizedSubtasks
            });
        }
        return normalized;
    }

    function normalizeSessionHistory(value) {
        if (!Array.isArray(value)) return [];
        const ids = new Set();
        return value.filter(session => {
            if (!session || typeof session.id !== 'string' || !/^[\w-]{1,100}$/.test(session.id) || ids.has(session.id)) return false;
            if (!Number.isInteger(session.durationSeconds) || session.durationSeconds < 1 || session.durationSeconds > 3600) return false;
            if (typeof session.completedAt !== 'string' || Number.isNaN(Date.parse(session.completedAt))) return false;
            if (session.taskId != null && !/^[\w-]{1,100}$/.test(String(session.taskId))) return false;
            ids.add(session.id);
            return true;
        }).map(session => ({
            id: session.id,
            taskId: session.taskId == null ? null : String(session.taskId),
            durationSeconds: session.durationSeconds,
            completedAt: session.completedAt
        }));
    }

    function normalizeImportedSettings(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        if (value.language != null && !settingLanguages.includes(value.language)) return null;
        if (value.theme != null && !settingThemes.includes(value.theme)) return null;
        if (value.notifications != null && typeof value.notifications !== 'boolean') return null;
        if (value.sound != null && typeof value.sound !== 'boolean') return null;
        if (value.pomodoroWorkMinutes != null && (!Number.isInteger(value.pomodoroWorkMinutes) || value.pomodoroWorkMinutes < 1 || value.pomodoroWorkMinutes > 120)) return null;
        if (value.pomodoroBreakMinutes != null && (!Number.isInteger(value.pomodoroBreakMinutes) || value.pomodoroBreakMinutes < 1 || value.pomodoroBreakMinutes > 60)) return null;
        return {
            ...value,
            language: settingLanguages.includes(value.language) ? value.language : 'system',
            theme: settingThemes.includes(value.theme) ? value.theme : 'system',
            notifications: value.notifications === true,
            sound: value.sound === true,
            pomodoroWorkMinutes: Number.isInteger(value.pomodoroWorkMinutes) ? value.pomodoroWorkMinutes : 25,
            pomodoroBreakMinutes: Number.isInteger(value.pomodoroBreakMinutes) ? value.pomodoroBreakMinutes : 5
        };
    }

    function validateImportPayload(value, categories = []) {
        const isLegacy = Array.isArray(value);
        if (!isLegacy && (!value || typeof value !== 'object' || value.version !== 2 || !Array.isArray(value.tasks))) return null;
        const importedTasks = normalizeImportedTasks(isLegacy ? value : value.tasks, categories);
        if (!importedTasks) return null;
        const importedCategories = isLegacy || value.categories == null
            ? [...new Set(importedTasks.map(task => task.category))]
            : value.categories;
        if (!Array.isArray(importedCategories) || importedCategories.length > 100 || importedCategories.some(category => typeof category !== 'string' || !category.trim() || category.length > 60)) return null;
        const importedSettings = !isLegacy && value.settings != null ? normalizeImportedSettings(value.settings) : null;
        if (!isLegacy && value.settings != null && !importedSettings) return null;
        const rawSessions = isLegacy || value.pomodoroSessions == null ? null : value.pomodoroSessions;
        if (rawSessions !== null && (!Array.isArray(rawSessions) || rawSessions.length > 100000)) return null;
        const sessions = rawSessions === null ? null : normalizeSessionHistory(rawSessions);
        if (rawSessions !== null && sessions.length !== rawSessions.length) return null;
        const normalizedCategories = [...new Set(importedCategories)];
        if (!normalizedCategories.length) normalizedCategories.push(...(categories.length ? categories : ['Travail', 'Dev', 'Design', 'Personnel']));
        return { tasks: importedTasks, categories: normalizedCategories, settings: importedSettings, pomodoroSessions: sessions };
    }

    function buildImportPreview(localTasks, importedTasks) {
        const localIds = new Set(localTasks.map(task => task.id));
        const conflicts = importedTasks.filter(task => localIds.has(task.id));
        return {
            incomingCount: importedTasks.length,
            newCount: importedTasks.length - conflicts.length,
            conflictCount: conflicts.length,
            replaceCount: importedTasks.length
        };
    }

    function mergeTasks(localTasks, importedTasks) {
        const localIds = new Set(localTasks.map(task => task.id));
        return [...localTasks, ...importedTasks.filter(task => !localIds.has(task.id))];
    }

    function localDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function nextDueDate(value, recurrence, fallbackDate = localDateString()) {
        const date = new Date(`${value || fallbackDate}T00:00:00Z`);
        if (Number.isNaN(date.getTime())) return fallbackDate;
        if (recurrence === 'daily') date.setUTCDate(date.getUTCDate() + 1);
        if (recurrence === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
        if (recurrence === 'monthly') {
            const day = date.getUTCDate();
            date.setUTCDate(1);
            date.setUTCMonth(date.getUTCMonth() + 1);
            const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
            date.setUTCDate(Math.min(day, lastDay));
        }
        return date.toISOString().slice(0, 10);
    }

    function matchesDueFilter(dueDate, status, filter, today = localDateString()) {
        if (filter === 'all') return true;
        if (status === 'done' || !dueDate) return false;
        if (filter === 'overdue') return dueDate < today;
        if (filter === 'today') return dueDate === today;
        if (filter === 'upcoming') {
            const limit = new Date(`${today}T00:00:00Z`);
            limit.setUTCDate(limit.getUTCDate() + 7);
            return dueDate >= today && dueDate <= limit.toISOString().slice(0, 10);
        }
        return true;
    }

    function computeProductivityStats(tasks, sessions, today = localDateString()) {
        const byCategory = new Map();
        for (const task of tasks) {
            const category = task.category || 'General';
            const entry = byCategory.get(category) || { category, total: 0, done: 0 };
            entry.total += 1;
            if (task.status === 'done') entry.done += 1;
            byCategory.set(category, entry);
        }
        const completionByCategory = [...byCategory.values()]
            .map(entry => ({ ...entry, rate: entry.total ? Math.round((entry.done / entry.total) * 100) : 0 }))
            .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));

        const timeByTask = new Map();
        for (const session of sessions) {
            if (!session.taskId) continue;
            timeByTask.set(session.taskId, (timeByTask.get(session.taskId) || 0) + session.durationSeconds);
        }

        const sessionsByDay = [];
        const dayCounts = new Map();
        for (const session of sessions) {
            const day = String(session.completedAt || '').slice(0, 10);
            if (day) dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
        }
        const todayDate = new Date(`${today}T00:00:00Z`);
        for (let offset = 13; offset >= 0; offset -= 1) {
            const date = new Date(todayDate);
            date.setUTCDate(date.getUTCDate() - offset);
            const key = date.toISOString().slice(0, 10);
            sessionsByDay.push({ date: key, count: dayCounts.get(key) || 0 });
        }

        const sessionDays = new Set(sessions.map(session => String(session.completedAt || '').slice(0, 10)).filter(Boolean));
        let streakDays = 0;
        const streakCursor = new Date(todayDate);
        if (!sessionDays.has(localDateString(streakCursor))) streakCursor.setUTCDate(streakCursor.getUTCDate() - 1);
        while (sessionDays.has(localDateString(streakCursor))) {
            streakDays += 1;
            streakCursor.setUTCDate(streakCursor.getUTCDate() - 1);
        }

        return {
            completionByCategory,
            timeByTask: Object.fromEntries(timeByTask),
            sessionsByDay,
            streakDays,
            totals: {
                tasks: tasks.length,
                done: tasks.filter(task => task.status === 'done').length,
                sessions: sessions.length,
                trackedSeconds: sessions.reduce((total, session) => total + session.durationSeconds, 0)
            }
        };
    }

    function escapeCsvCell(value) {
        const text = String(value ?? '');
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    function buildCsv(tasks) {
        const header = ['id', 'title', 'status', 'priority', 'category', 'dueDate', 'duration', 'tags', 'subtasks'];
        const rows = tasks.map(task => [
            task.id,
            task.title,
            task.status,
            task.priority,
            task.category,
            task.dueDate || '',
            task.duration ?? '',
            (task.tags || []).join(';'),
            (task.subtasks || []).length
        ].map(escapeCsvCell).join(','));
        return `\uFEFF${[header.join(','), ...rows].join('\r\n')}`;
    }

    function escapeIcsText(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r?\n/g, '\\n');
    }

    function icsDate(value) {
        return String(value).replace(/-/g, '');
    }

    function buildIcs(tasks) {
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const events = tasks.filter(task => /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || '')).map(task => [
            'BEGIN:VEVENT',
            `UID:${escapeIcsText(task.id)}@taskflow`,
            `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${icsDate(task.dueDate)}`,
            `SUMMARY:${escapeIcsText(task.title)}`,
            `DESCRIPTION:${escapeIcsText([task.description, task.category, task.priority, (task.tags || []).join(', ')].filter(Boolean).join(' — '))}`,
            'END:VEVENT'
        ].join('\r\n'));
        return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//TaskFlow//Kanban//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            ...events,
            'END:VCALENDAR',
            ''
        ].join('\r\n');
    }

    function buildStorageEntries(policy, state, timer) {
        const saveData = policy.saveData !== false;
        const savePreferences = policy.savePreferences !== false;
        return {
            taskmaster_tasks: saveData ? state.tasks : null,
            taskmaster_categories: saveData ? state.categories : null,
            taskmaster_sessions: saveData ? state.pomodoroSessions : null,
            taskmaster_timer: saveData ? timer : null,
            taskmaster_settings: savePreferences ? state.settings : null,
            theme: null,
            taskmaster_storage: saveData || savePreferences ? { saveData, savePreferences } : null
        };
    }

    return {
        buildCsv,
        buildIcs,
        buildStorageEntries,
        buildImportPreview,
        computeProductivityStats,
        localDateString,
        matchesDueFilter,
        mergeTasks,
        nextDueDate,
        normalizeImportedSettings,
        normalizeImportedTasks,
        normalizeSessionHistory,
        validateImportPayload
    };
});
