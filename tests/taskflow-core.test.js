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
