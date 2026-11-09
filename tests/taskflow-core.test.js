const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../taskflow-core.js');

const sampleTask = (overrides = {}) => ({
    id: 'task-1',
    title: 'Review release',
    status: 'todo',
    priority: 'medium',
    category: 'Work',
    dueDate: '2026-11-07',
    duration: 30,
    recurrence: 'none',
    subtasks: [],
    ...overrides
});

test('validates legacy task-array backups and supplies missing defaults', () => {
    const payload = core.validateImportPayload([{ id: 'legacy-1', title: 'Old task' }], ['Personal']);
    assert.equal(payload.tasks[0].status, 'todo');
    assert.equal(payload.tasks[0].category, 'Personal');
    assert.equal(payload.settings, null);
});

test('rejects duplicate IDs, invalid calendar dates, and malformed subtasks', () => {
    assert.equal(core.normalizeImportedTasks([sampleTask(), sampleTask()]), null);
    assert.equal(core.normalizeImportedTasks([sampleTask({ dueDate: '2026-02-30' })]), null);
    assert.equal(core.normalizeImportedTasks([sampleTask({ subtasks: [{ id: 'sub-1', title: 'Step', completed: 'yes' }] })]), null);
});

test('validates versioned backup data including preferences and sessions', () => {
    const payload = core.validateImportPayload({
        version: 2,
        tasks: [sampleTask()],
        categories: ['Work'],
        settings: { language: 'fr', theme: 'taskmaster', pomodoroWorkMinutes: 45, pomodoroBreakMinutes: 10 },
        pomodoroSessions: [{ id: 'session-1', taskId: 'task-1', durationSeconds: 2700, completedAt: '2026-11-07T12:00:00.000Z' }]
    });
    assert.equal(payload.settings.pomodoroWorkMinutes, 45);
    assert.equal(payload.pomodoroSessions[0].durationSeconds, 2700);
    assert.equal(core.validateImportPayload({ version: 3, tasks: [] }), null);
});

test('previews import collisions and merges with local tasks taking precedence', () => {
    const local = [sampleTask({ title: 'Local copy' })];
    const imported = [sampleTask({ title: 'Backup copy' }), sampleTask({ id: 'task-2', title: 'New task' })];
    assert.deepEqual(core.buildImportPreview(local, imported), { incomingCount: 2, newCount: 1, conflictCount: 1, replaceCount: 2 });
    assert.deepEqual(core.mergeTasks(local, imported).map(task => task.title), ['Local copy', 'New task']);
});

test('advances daily, weekly, and month-end recurrence dates', () => {
    assert.equal(core.nextDueDate('2026-11-07', 'daily'), '2026-11-08');
    assert.equal(core.nextDueDate('2026-11-07', 'weekly'), '2026-11-14');
    assert.equal(core.nextDueDate('2026-01-31', 'monthly'), '2026-02-28');
    assert.equal(core.nextDueDate('2024-01-31', 'monthly'), '2024-02-29');
});

test('matches overdue and upcoming tasks using inclusive local-date strings', () => {
    assert.equal(core.matchesDueFilter('2026-11-06', 'todo', 'overdue', '2026-11-07'), true);
    assert.equal(core.matchesDueFilter('2026-11-14', 'todo', 'upcoming', '2026-11-07'), true);
    assert.equal(core.matchesDueFilter('2026-11-15', 'todo', 'upcoming', '2026-11-07'), false);
    assert.equal(core.matchesDueFilter('2026-11-06', 'done', 'overdue', '2026-11-07'), false);
});

test('normalizes task tags with trimming, deduplication, and limits', () => {
    const payload = core.normalizeImportedTasks([sampleTask({ tags: ['  Urgent ', 'urgent', 'Backend'] })]);
    assert.deepEqual(payload[0].tags, ['Urgent', 'Backend']);
    assert.deepEqual(core.normalizeImportedTasks([sampleTask()])[0].tags, []);
    assert.equal(core.normalizeImportedTasks([sampleTask({ tags: 'not-array' })]), null);
    assert.equal(core.normalizeImportedTasks([sampleTask({ tags: Array(11).fill('x') })]), null);
    assert.equal(core.normalizeImportedTasks([sampleTask({ tags: ['x'.repeat(31)] })]), null);
});

test('matches tasks due today using the today filter', () => {
    assert.equal(core.matchesDueFilter('2026-11-07', 'todo', 'today', '2026-11-07'), true);
    assert.equal(core.matchesDueFilter('2026-11-08', 'todo', 'today', '2026-11-07'), false);
    assert.equal(core.matchesDueFilter('2026-11-07', 'done', 'today', '2026-11-07'), false);
});

test('accepts all supported interface languages in imported settings', () => {
    for (const language of ['en', 'en-GB', 'fr', 'es', 'it', 'de', 'ru', 'uk', 'zh', 'ko', 'ja']) {
        const payload = core.validateImportPayload({ version: 2, tasks: [sampleTask()], settings: { language } });
        assert.equal(payload.settings.language, language);
    }
    assert.equal(core.validateImportPayload({ version: 2, tasks: [sampleTask()], settings: { language: 'pt' } }), null);
});

test('computes productivity stats by category, task time, days, and streak', () => {
    const tasks = [
        sampleTask({ id: 'a', category: 'Work', status: 'done' }),
        sampleTask({ id: 'b', category: 'Work', status: 'todo' }),
        sampleTask({ id: 'c', category: 'Home', status: 'done' })
    ];
    const sessions = [
        { id: 's1', taskId: 'a', durationSeconds: 1500, completedAt: '2026-11-06T10:00:00Z' },
        { id: 's2', taskId: 'a', durationSeconds: 600, completedAt: '2026-11-07T10:00:00Z' },
        { id: 's3', taskId: null, durationSeconds: 300, completedAt: '2026-11-07T11:00:00Z' }
    ];
    const stats = core.computeProductivityStats(tasks, sessions, '2026-11-07');
    assert.equal(stats.totals.tasks, 3);
    assert.equal(stats.totals.done, 2);
    assert.equal(stats.timeByTask.a, 2100);
    assert.equal(stats.sessionsByDay.length, 14);
    assert.equal(stats.sessionsByDay.at(-1).count, 2);
    assert.equal(stats.sessionsByDay.at(-2).count, 1);
    assert.equal(stats.streakDays, 2);
    const work = stats.completionByCategory.find(entry => entry.category === 'Work');
    assert.deepEqual({ total: work.total, done: work.done, rate: work.rate }, { total: 2, done: 1, rate: 50 });
});

test('builds escaped CSV output with a UTF-8 BOM', () => {
    const csv = core.buildCsv([sampleTask({ title: 'Say "hi", ok', tags: ['a', 'b'], subtasks: [{ id: 's', title: 'x', completed: false }] })]);
    assert.ok(csv.startsWith('﻿id,title'));
    assert.ok(csv.includes('"Say ""hi"", ok"'));
    assert.ok(csv.includes('a;b'));
});

test('builds iCalendar output with one event per dated task', () => {
    const ics = core.buildIcs([
        sampleTask({ id: 'task-1', title: 'Meeting, with team', dueDate: '2026-11-10', description: 'Line1\nLine2' }),
        sampleTask({ id: 'task-2', title: 'No date', dueDate: '' })
    ]);
    assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('DTSTART;VALUE=DATE:20261110'));
    assert.ok(ics.includes('SUMMARY:Meeting\\, with team'));
    assert.ok(ics.includes('UID:task-1@taskflow'));
    assert.ok(!ics.includes('No date'));
    assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
});

test('parses CSV exports back into tasks with headers, quotes, and defaults', () => {
    const csv = core.buildCsv([
        sampleTask({ id: 'csv-1', title: 'Say "hi", ok', tags: ['a', 'b'], dueDate: '2026-11-10' }),
        sampleTask({ id: 'csv-2', title: 'Second', status: 'done', priority: 'high' })
    ]);
    const parsed = core.parseCsvTasks(csv);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].id, 'csv-1');
    assert.equal(parsed[0].title, 'Say "hi", ok');
    assert.equal(parsed[0].dueDate, '2026-11-10');
    assert.deepEqual(parsed[0].tags.sort(), ['a', 'b']);
    assert.equal(parsed[1].status, 'done');
    assert.equal(parsed[1].priority, 'high');
    const normalized = core.normalizeImportedTasks(parsed, ['Work']);
    assert.equal(normalized.length, 2);
    assert.equal(core.parseCsvTasks('title\n'), null);
});

test('parses iCalendar VEVENTs and round-trips TaskFlow exports', () => {
    const ics = core.buildIcs([
        sampleTask({ id: 'ics-1', title: 'Meeting, with team', dueDate: '2026-11-10', description: 'Bring notes', category: 'Work', priority: 'high' }),
        sampleTask({ id: 'ics-2', title: 'No date', dueDate: '' })
    ]);
    const parsed = core.parseIcsTasks(ics);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, 'ics-1');
    assert.equal(parsed[0].title, 'Meeting, with team');
    assert.equal(parsed[0].dueDate, '2026-11-10');
    assert.equal(parsed[0].description, 'Bring notes');
    assert.equal(parsed[0].category, 'Work');
    assert.equal(parsed[0].priority, 'high');
    assert.equal(core.parseIcsTasks('not a calendar'), null);
});

test('stores tasks independently from preferences', () => {
    const state = { tasks: ['task'], categories: ['Work'], pomodoroSessions: ['session'], settings: { theme: 'dark' } };
    const noTaskData = core.buildStorageEntries({ saveData: false, savePreferences: true }, state, { running: false });
    assert.equal(noTaskData.taskmaster_tasks, null);
    assert.equal(noTaskData.taskmaster_timer, null);
    assert.deepEqual(noTaskData.taskmaster_settings, { theme: 'dark' });

    const noPreferences = core.buildStorageEntries({ saveData: true, savePreferences: false }, state, { running: false });
    assert.deepEqual(noPreferences.taskmaster_tasks, ['task']);
    assert.equal(noPreferences.taskmaster_settings, null);
    assert.equal(noPreferences.theme, null);
    assert.deepEqual(noPreferences.taskmaster_storage, { saveData: true, savePreferences: false });

    const noPersistence = core.buildStorageEntries({ saveData: false, savePreferences: false }, state, {});
    assert.equal(noPersistence.taskmaster_storage, null);
    assert.equal(noPersistence.taskmaster_settings, null);
    assert.equal(noPersistence.theme, null);
});
