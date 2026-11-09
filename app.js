
        function readStoredJSON(key, fallback) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : fallback;
            } catch (error) {
                return fallback;
            }
        }

        function readLegacyTheme() {
            try {
                const legacyTheme = localStorage.getItem('theme');
                return ['light', 'dark'].includes(legacyTheme) ? legacyTheme : 'system';
            } catch (error) {
                return 'system';
            }
        }

        const storedStorageOptions = readStoredJSON('taskmaster_storage', {});
        let storageOptions = {
            saveData: !storedStorageOptions || typeof storedStorageOptions !== 'object' || storedStorageOptions.saveData !== false,
            savePreferences: !storedStorageOptions || typeof storedStorageOptions !== 'object' || storedStorageOptions.savePreferences !== false
        };
        const savedSettings = storageOptions.savePreferences ? readStoredJSON('taskmaster_settings', {}) : {};
        let settings = { language: 'system', theme: storageOptions.savePreferences ? readLegacyTheme() : 'system', notifications: false, sound: false, pomodoroWorkMinutes: 25, pomodoroBreakMinutes: 5, ...savedSettings };
        let activeLanguage = 'en';

        function detectedLanguage() {
            const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
            if (nav === 'en-gb' || nav.startsWith('en-gb-')) return 'en-GB';
            const base = nav.slice(0, 2);
            return TaskFlowI18n.CODES.includes(base) ? base : 'en';
        }

        function tr(text) {
            return TaskFlowI18n.tr(text, activeLanguage);
        }

        function i18nReplacements() {
            if (i18nReplacements.cache && i18nReplacements.cache.lang === activeLanguage) return i18nReplacements.cache.map;
            const map = {};
            TaskFlowI18n.sourceStrings.forEach(source => { map[source] = TaskFlowI18n.tr(source, activeLanguage); });
            i18nReplacements.cache = { lang: activeLanguage, map };
            return map;
        }

        function translateStaticUI() {
            const replacements = i18nReplacements();
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const value = node.nodeValue.trim();
                if (!value || !replacements[value]) continue;
                const start = node.nodeValue.indexOf(value);
                node.nodeValue = node.nodeValue.slice(0, start) + replacements[value] + node.nodeValue.slice(start + value.length);
            }
            document.querySelectorAll('[placeholder], [data-tooltip], [aria-label]').forEach(element => {
                ['placeholder', 'data-tooltip', 'aria-label'].forEach(attribute => {
                    const value = element.getAttribute(attribute);
                    if (value && replacements[value]) element.setAttribute(attribute, replacements[value]);
                });
            });
            document.documentElement.lang = TaskFlowI18n.htmlLang(activeLanguage);
            document.title = `TaskFlow - ${tr('Kanban & Productivité Custom')}`;
        }

        /* State Variables */
        let tasks = storageOptions.saveData ? readStoredJSON('taskmaster_tasks', null) : null;
        if (!Array.isArray(tasks)) tasks = [
            {
                id: '1',
                title: 'Concevoir la maquette Kanban',
                description: 'Créer le design system responsive et les effets glassmorphism.',
                status: 'done',
                priority: 'high',
                category: 'Design',
                color: '#6366f1',
                dueDate: '2026-09-28',
                duration: 60,
                recurrence: 'none',
                subtasks: [
                    { id: 's1', title: 'Choisir la palette de couleurs', completed: true },
                    { id: 's2', title: 'Créer les composants custom', completed: true }
                ]
            },
            {
                id: '2',
                title: 'Implémenter le Pomodoro',
                description: 'Associer les minuteurs aux tâches Kanban pour mesurer le temps.',
                status: 'in_progress',
                priority: 'medium',
                category: 'Dev',
                color: '#ec4899',
                dueDate: '2026-09-30',
                duration: 45,
                recurrence: 'daily',
                subtasks: [
                    { id: 's3', title: 'Logique du compte à rebours', completed: true },
                    { id: 's4', title: 'Alerte sonore de fin', completed: false }
                ]
            }
        ];

        let categories = storageOptions.saveData ? readStoredJSON('taskmaster_categories', null) : null;
        if (!Array.isArray(categories) || !categories.every(category => typeof category === 'string')) categories = ['Travail', 'Dev', 'Design', 'Personnel'];
        categories = [...new Set(categories.filter(category => category.trim() && category.length <= 60))];
        if (!categories.length) categories = ['Travail', 'Dev', 'Design', 'Personnel'];
        let pomodoroSessions = storageOptions.saveData ? readStoredJSON('taskmaster_sessions', []) : [];
        if (!Array.isArray(pomodoroSessions)) pomodoroSessions = [];
        let storedTasksInvalid = false;
        if (Array.isArray(tasks)) {
            const validatedTasks = normalizeImportedTasks(tasks);
            if (validatedTasks) tasks = validatedTasks;
            else {
                tasks = [];
                storedTasksInvalid = true;
            }
        }
        pomodoroSessions = normalizeSessionHistory(pomodoroSessions);
        let activeFilters = { category: 'all', priority: 'all', sortBy: 'default', due: 'all', tag: 'all' };
        let draggedTaskId = null;
        let tempSubtasks = [];
        let activeCustomColor = '#6366f1';
        let selectedDatePickerDate = localDateString();

        // Pomodoro State
        let pomodoroTimer = null;
        const storedPomodoroState = storageOptions.saveData ? readStoredJSON('taskmaster_timer', {}) : {};
        const savedPomodoroState = storedPomodoroState && typeof storedPomodoroState === 'object' && !Array.isArray(storedPomodoroState) ? storedPomodoroState : {};
        let pomodoroMode = savedPomodoroState.mode === 'break' ? 'break' : 'work';
        let pomodoroSeconds = Number.isInteger(savedPomodoroState.remainingSeconds) ? savedPomodoroState.remainingSeconds : settings.pomodoroWorkMinutes * 60;
        let pomodoroEndTime = Number.isFinite(savedPomodoroState.endTime) ? savedPomodoroState.endTime : null;
        let pomodoroCompletedCycles = Number.isInteger(savedPomodoroState.completedCycles) ? savedPomodoroState.completedCycles : 0;
        let pomodoroRunning = false;
        let pomodoroHasStarted = savedPomodoroState.hasStarted === true || savedPomodoroState.running === true;
        let pomodoroActiveTaskId = null;
        let pomodoroWidgetPosition = {
            left: Number.isFinite(savedPomodoroState.widgetLeft) ? savedPomodoroState.widgetLeft : null,
            top: Number.isFinite(savedPomodoroState.widgetTop) ? savedPomodoroState.widgetTop : null
        };
        let pomodoroDragState = null;
        let pendingImport = null;
        let searchResultIndex = -1;
        let mobileBoardIndex = 0;
        let boardTouchStart = null;

        /* Initialization */
        window.onload = function() {
            applySettings();
            if (storedTasksInvalid) showToast(tr('Stored task data is invalid'), 'error');
            refreshSystemSettingLabels();
            renderCustomFilterSelects();
            renderCustomModalSelects();
            renderCustomColorPicker();
            renderCustomDatePicker();
            renderDueFilterButtons();
            renderTasks();
            updateMobileBoard();

            const board = document.getElementById('kanban-board');
            board.addEventListener('touchstart', handleBoardTouchStart, { passive: true });
            board.addEventListener('touchend', handleBoardTouchEnd, { passive: true });

            const themePreference = window.matchMedia('(prefers-color-scheme: dark)');
            themePreference.addEventListener('change', () => {
                if (settings.theme === 'system') applyTheme();
            });
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', refreshSystemSettingLabels);
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshSystemSettingLabels);
            restorePomodoroTimer();
            registerOfflineSupport();

            document.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                    e.preventDefault();
                    openSearchModal();
                }
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n' && !e.target.matches('input, textarea, select')) {
                    e.preventDefault();
                    openTaskModal();
                }
                if (!document.getElementById('search-modal').classList.contains('hidden')) {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        moveSearchSelection(e.key === 'ArrowDown' ? 1 : -1);
                    } else if (e.key === 'Enter' && searchResultIndex >= 0) {
                        e.preventDefault();
                        openSearchResult(searchResultIndex);
                    }
                }
                const activeSettingsTab = e.target.closest && e.target.closest('[role="tab"][id^="settings-tab-"]');
                if (activeSettingsTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                    e.preventDefault();
                    const tabs = [...document.querySelectorAll('#settings-modal [role="tab"]')];
                    const currentIndex = tabs.indexOf(activeSettingsTab);
                    const nextIndex = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (currentIndex + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
                    const nextTab = tabs[nextIndex];
                    showSettingsTab(nextTab.id.replace('settings-tab-', ''));
                    nextTab.focus();
                }
                const activeModal = [...document.querySelectorAll('[role="dialog"]')].find(modal => !modal.classList.contains('hidden'));
                if (e.key === 'Tab' && activeModal) {
                    const focusable = [...activeModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    if (first && e.shiftKey && (document.activeElement === first || !activeModal.contains(document.activeElement))) {
                        e.preventDefault();
                        last.focus();
                    } else if (last && !e.shiftKey && (document.activeElement === last || !activeModal.contains(document.activeElement))) {
                        e.preventDefault();
                        first.focus();
                    }
                }
                if (e.key === 'Escape') {
                    closeSearchModal();
                    closeTaskModal();
                    toggleStatsModal(false);
                    closeSettingsModal();
                    cancelImport();
                    document.getElementById('custom-dialog-modal').classList.add('hidden');
                    document.querySelectorAll('.custom-select-dropdown').forEach(dropdown => dropdown.classList.add('hidden'));
                }
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('#data-menu') && !e.target.closest('button[onclick="toggleDataMenu()"]')) {
                    document.getElementById('data-menu').classList.add('hidden');
                }
                // Close custom select dropdowns
                if (!e.target.closest('.custom-select-container')) {
                    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
                }
                // Close datepicker popup
                if (!e.target.closest('#custom-datepicker-wrapper')) {
                    const dpPopup = document.getElementById('datepicker-popup');
                    if (dpPopup) dpPopup.classList.add('hidden');
                }
            });

            document.addEventListener('pointerover', e => {
                const tooltipTarget = e.target.closest && e.target.closest('[data-tooltip]');
                if (tooltipTarget) positionTooltip(tooltipTarget);
            });
            document.addEventListener('focusin', e => {
                const tooltipTarget = e.target.closest && e.target.closest('[data-tooltip]');
                if (tooltipTarget) positionTooltip(tooltipTarget);
            });
            const clearTooltip = e => {
                const tooltipTarget = e.target.closest && e.target.closest('[data-tooltip]');
                if (!tooltipTarget || tooltipTarget.contains(e.relatedTarget) || tooltipTarget.matches(':hover, :focus-visible')) return;
                tooltipTarget.removeAttribute('data-tooltip-placement');
                tooltipTarget.style.removeProperty('--tooltip-left');
                tooltipTarget.style.removeProperty('--tooltip-top');
            };
            document.addEventListener('pointerout', clearTooltip);
            document.addEventListener('focusout', clearTooltip);
            window.addEventListener('resize', () => {
                updateMobileBoard();
                document.querySelectorAll('[data-tooltip-placement]').forEach(positionTooltip);
            });
        };

        function positionTooltip(element) {
            element.setAttribute('data-tooltip-placement', 'top');
            const tooltip = getComputedStyle(element, '::after');
            const width = Math.min(parseFloat(tooltip.width) || 140, window.innerWidth - 16);
            const height = Math.min(parseFloat(tooltip.height) || 30, window.innerHeight - 16);
            const trigger = element.getBoundingClientRect();
            const left = Math.max(width / 2 + 8, Math.min(window.innerWidth - width / 2 - 8, trigger.left + trigger.width / 2));
            const placeBelow = trigger.top < height + 16 && trigger.bottom + height + 16 <= window.innerHeight;
            element.dataset.tooltipPlacement = placeBelow ? 'bottom' : 'top';
            element.style.setProperty('--tooltip-left', `${left}px`);
            element.style.setProperty('--tooltip-top', `${placeBelow ? trigger.bottom + 8 : Math.max(height + 8, trigger.top - 8)}px`);
        }

        /* Local Storage Helper */
        function persistState(next = { tasks, categories, settings, pomodoroSessions }) {
            const entries = TaskFlowCore.buildStorageEntries(storageOptions, next, getPomodoroState());
            const previous = {};
            try {
                Object.keys(entries).forEach(key => { previous[key] = localStorage.getItem(key); });
                Object.entries(entries).forEach(([key, value]) => {
                    if (value === null) localStorage.removeItem(key);
                    else localStorage.setItem(key, JSON.stringify(value));
                });
                return true;
            } catch (error) {
                Object.entries(previous).forEach(([key, value]) => {
                    try {
                        if (value === null) localStorage.removeItem(key);
                        else localStorage.setItem(key, value);
                    } catch (rollbackError) {
                        return;
                    }
                });
                showToast('Could not save changes. Browser storage may be full.', 'error');
                return false;
            }
        }

        function saveToLocalStorage() {
            return persistState();
        }

        function getPomodoroState() {
            return {
                mode: pomodoroMode,
                remainingSeconds: pomodoroSeconds,
                endTime: pomodoroEndTime,
                running: pomodoroRunning,
                hasStarted: pomodoroHasStarted,
                completedCycles: pomodoroCompletedCycles,
                taskId: pomodoroActiveTaskId,
                widgetLeft: pomodoroWidgetPosition.left,
                widgetTop: pomodoroWidgetPosition.top
            };
        }

        function restorePomodoroTimer() {
            const state = savedPomodoroState;
            if (state.taskId != null && tasks.some(task => task.id === state.taskId)) {
                pomodoroActiveTaskId = state.taskId;
                const task = tasks.find(item => item.id === state.taskId);
                document.getElementById('pomo-task-title').textContent = `${tr('Task')}: ${task.title}`;
            }
            const widget = document.getElementById('pomodoro-widget');
            if (Number.isFinite(pomodoroWidgetPosition.left) && Number.isFinite(pomodoroWidgetPosition.top)) {
                const widgetWidth = widget.offsetWidth || Math.min(288, window.innerWidth - 24);
                const widgetHeight = widget.offsetHeight || Math.min(320, window.innerHeight - 24);
                widget.style.left = `${Math.max(0, Math.min(window.innerWidth - widgetWidth, pomodoroWidgetPosition.left))}px`;
                widget.style.top = `${Math.max(0, Math.min(window.innerHeight - widgetHeight, pomodoroWidgetPosition.top))}px`;
                widget.style.right = 'auto';
                widget.style.bottom = 'auto';
            }
            pomodoroSeconds = Math.max(0, Math.min(120 * 60, Number(pomodoroSeconds) || 0));
            updatePomodoroDisplay();
            if (state.running === true && Number.isFinite(pomodoroEndTime)) {
                pomodoroRunning = true;
                pomodoroSeconds = Math.max(0, Math.ceil((pomodoroEndTime - Date.now()) / 1000));
                document.getElementById('pomo-start-btn').classList.add('opacity-50');
                if (pomodoroSeconds === 0) completePomodoro();
                else pomodoroTimer = setInterval(tickPomodoro, 250);
            }
            updatePomodoroDisplay();
        }

        function registerOfflineSupport() {
            const isSecureOrigin = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
            if (!isSecureOrigin || !('serviceWorker' in navigator)) return;
            navigator.serviceWorker.register('./service-worker.js').catch(() => {
                showToast(tr('Offline support could not be enabled'), 'error');
            });
        }

        function applyTheme() {
            const root = document.documentElement;
            const theme = settings.theme === 'system'
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : settings.theme;
            root.classList.remove('dark', 'theme-taskmaster');
            if (theme === 'dark') root.classList.add('dark');
            if (theme === 'taskmaster') root.classList.add('theme-taskmaster');
            root.dataset.theme = theme;
        }

        function refreshSystemSettingLabels() {
            const detected = TaskFlowI18n.nativeName(detectedLanguage());
            const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light';
            const languageOption = document.querySelector('#language-setting option[value="system"]');
            const themeOption = document.querySelector('#theme-setting option[value="system"]');
            if (languageOption) languageOption.textContent = `System (${detected})`;
            if (themeOption) themeOption.textContent = `System (${theme})`;
        }

        function renderLanguageOptions() {
            const select = document.getElementById('language-setting');
            if (!select || select.dataset.populated) return;
            select.innerHTML = [
                '<option value="system">System</option>',
                ...TaskFlowI18n.LANGUAGES.map(lang => `<option value="${lang.code}">${escapeHTML(lang.native)}</option>`)
            ].join('');
            select.dataset.populated = 'true';
        }

        function applySettings() {
            settings.language = ['system', ...TaskFlowI18n.CODES].includes(settings.language) ? settings.language : 'system';
            settings.theme = ['system', 'light', 'dark', 'taskmaster'].includes(settings.theme) ? settings.theme : 'system';
            settings.notifications = settings.notifications === true;
            settings.sound = settings.sound === true;
            settings.pomodoroWorkMinutes = Number.isInteger(settings.pomodoroWorkMinutes) ? Math.min(120, Math.max(1, settings.pomodoroWorkMinutes)) : 25;
            settings.pomodoroBreakMinutes = Number.isInteger(settings.pomodoroBreakMinutes) ? Math.min(60, Math.max(1, settings.pomodoroBreakMinutes)) : 5;
            activeLanguage = settings.language === 'system' ? detectedLanguage() : settings.language;
            applyTheme();
            translateStaticUI();
            refreshSystemSettingLabels();
            renderLanguageOptions();
            const languageSelect = document.getElementById('language-setting');
            const themeSelect = document.getElementById('theme-setting');
            if (languageSelect) languageSelect.value = settings.language;
            if (themeSelect) themeSelect.value = settings.theme;
            const notificationToggle = document.getElementById('notifications-setting');
            const soundToggle = document.getElementById('sound-setting');
            if (notificationToggle) notificationToggle.checked = settings.notifications;
            if (soundToggle) soundToggle.checked = settings.sound;
            const workDurationInput = document.getElementById('pomodoro-work-setting');
            const breakDurationInput = document.getElementById('pomodoro-break-setting');
            if (workDurationInput) workDurationInput.value = settings.pomodoroWorkMinutes;
            if (breakDurationInput) breakDurationInput.value = settings.pomodoroBreakMinutes;
            const saveDataToggle = document.getElementById('save-data-setting');
            const savePreferencesToggle = document.getElementById('save-preferences-setting');
            if (saveDataToggle) saveDataToggle.checked = storageOptions.saveData;
            if (savePreferencesToggle) savePreferencesToggle.checked = storageOptions.savePreferences;
            const searchShortcut = document.querySelector('#search-trigger kbd');
            if (searchShortcut) searchShortcut.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K';
        }

        function updateSetting(key, value) {
            if (key === 'saveData' || key === 'savePreferences') {
                const previousOptions = { ...storageOptions };
                storageOptions[key] = value === true;
                if (!saveToLocalStorage()) {
                    storageOptions = previousOptions;
                    applySettings();
                    return;
                }
                applySettings();
                showToast(tr(storageOptions[key] ? 'Storage enabled' : 'Storage disabled'), 'success');
                return;
            }
            if (key === 'pomodoroWorkMinutes') value = Math.min(120, Math.max(1, Number(value) || 25));
            if (key === 'pomodoroBreakMinutes') value = Math.min(60, Math.max(1, Number(value) || 5));
            if (key === 'notifications' && value && !('Notification' in window)) {
                settings.notifications = false;
                applySettings();
                showToast(tr('Notifications are blocked by the browser'), 'error');
                return;
            }
            if (key === 'notifications' && value && 'Notification' in window && Notification.permission !== 'granted') {
                Notification.requestPermission().then(permission => {
                    settings.notifications = permission === 'granted';
                    applySettings();
                    saveToLocalStorage();
                    if (!settings.notifications) showToast(tr('Notifications are blocked by the browser'), 'error');
                }).catch(() => showToast(tr('Notifications are blocked by the browser'), 'error'));
                return;
            }
            settings[key] = value;
            if (!pomodoroRunning && key === 'pomodoroWorkMinutes' && pomodoroMode === 'work') pomodoroSeconds = value * 60;
            if (!pomodoroRunning && key === 'pomodoroBreakMinutes' && pomodoroMode === 'break') pomodoroSeconds = value * 60;
            applySettings();
            if (!pomodoroRunning && (key === 'pomodoroWorkMinutes' || key === 'pomodoroBreakMinutes')) updatePomodoroDisplay();
            renderCategoryManager();
            renderCustomFilterSelects();
            renderCustomModalSelects();
            renderDueFilterButtons();
            renderTasks();
            saveToLocalStorage();
        }

        function stepSettingDuration(key, increment) {
            const limits = key === 'pomodoroWorkMinutes' ? { min: 1, max: 120 } : { min: 1, max: 60 };
            const nextValue = Math.max(limits.min, Math.min(limits.max, settings[key] + increment));
            updateSetting(key, nextValue);
        }

        function showSettingsTab(tabName) {
            const sections = ['general', 'pomodoro', 'data'];
            if (!sections.includes(tabName)) return;
            sections.forEach(section => {
                const selected = section === tabName;
                const tab = document.getElementById(`settings-tab-${section}`);
                const panel = document.getElementById(`settings-panel-${section}`);
                tab.setAttribute('aria-selected', String(selected));
                tab.tabIndex = selected ? 0 : -1;
                tab.className = `px-2 py-2 rounded-md text-xs font-semibold ${selected ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`;
                panel.classList.toggle('hidden', !selected);
            });
        }

        function openSettingsModal() {
            applySettings();
            renderCategoryManager();
            const modal = document.getElementById('settings-modal');
            modal.classList.remove('hidden');
            modal.querySelector('select').focus();
        }

        function closeSettingsModal() {
            const modal = document.getElementById('settings-modal');
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
                document.getElementById('settings-trigger').focus();
            }
        }

        function renderCategoryManager() {
            const container = document.getElementById('category-manager');
            if (!container) return;
            container.innerHTML = categories.map((category, index) => `
                <div class="flex items-center gap-2">
                    <label class="sr-only" for="managed-category-${index}">${escapeHTML(tr('Rename category'))}</label>
                    <input id="managed-category-${index}" maxlength="60" value="${escapeHTML(category)}" class="min-w-0 flex-1 px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm">
                    <button type="button" onclick="renameCategory(${index})" aria-label="${escapeHTML(tr('Save category'))}" class="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-emerald-500/10"><i class="fa-solid fa-check"></i></button>
                    <button type="button" onclick="deleteCategory(${index})" aria-label="${escapeHTML(tr('Delete category'))}" class="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-rose-500/10"><i class="fa-solid fa-trash"></i></button>
                </div>
            `).join('');
        }

        function addCategory() {
            const input = document.getElementById('new-category-input');
            const category = input.value.trim();
            if (!category || category.length > 60) return;
            if (categories.some(existing => existing.toLocaleLowerCase() === category.toLocaleLowerCase())) {
                showToast(tr('Category already exists'), 'error');
                return;
            }
            if (categories.length >= 100) return;
            categories.push(category);
            input.value = '';
            saveToLocalStorage();
            renderCategoryManager();
            renderCustomFilterSelects();
            renderCustomModalSelects();
            showToast(tr('Category added'), 'success');
        }

        function renameCategory(index) {
            const input = document.getElementById(`managed-category-${index}`);
            const nextName = input.value.trim();
            const previousName = categories[index];
            if (!nextName || nextName.length > 60) {
                showToast(tr('Invalid category'), 'error');
                return;
            }
            if (categories.some((category, categoryIndex) => categoryIndex !== index && category.toLocaleLowerCase() === nextName.toLocaleLowerCase())) {
                showToast(tr('Category already exists'), 'error');
                return;
            }
            categories[index] = nextName;
            tasks.forEach(task => { if (task.category === previousName) task.category = nextName; });
            if (activeFilters.category === previousName) activeFilters.category = nextName;
            if (modalFormValues.category === previousName) modalFormValues.category = nextName;
            saveToLocalStorage();
            renderCategoryManager();
            renderCustomFilterSelects();
            renderCustomModalSelects();
            renderTasks();
            showToast(tr('Category updated'), 'success');
        }

        function deleteCategory(index) {
            if (categories.length <= 1) {
                showToast(tr('Cannot delete the last category'), 'error');
                return;
            }
            const removedCategory = categories[index];
            const fallbackCategory = categories[index === 0 ? 1 : 0];
            categories.splice(index, 1);
            tasks.forEach(task => { if (task.category === removedCategory) task.category = fallbackCategory; });
            if (activeFilters.category === removedCategory) activeFilters.category = 'all';
            if (modalFormValues.category === removedCategory) modalFormValues.category = fallbackCategory;
            saveToLocalStorage();
            renderCategoryManager();
            renderCustomFilterSelects();
            renderCustomModalSelects();
            renderTasks();
            showToast(tr('Category deleted'), 'success');
        }

        /* Toast Notification System */
        function showToast(message, type = 'info', actionLabel = null, onAction = null) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold backdrop-blur-md animate-fade-in transition-all border ${
                type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' :
                'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
            }`;
            
            const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
            const iconElement = document.createElement('i');
            iconElement.className = `fa-solid ${icon} text-sm`;
            const messageElement = document.createElement('span');
            messageElement.textContent = message;
            toast.append(iconElement, messageElement);

            let timeoutId = null;
            if (actionLabel && onAction) {
                const actionButton = document.createElement('button');
                actionButton.type = 'button';
                actionButton.textContent = actionLabel;
                actionButton.className = 'ml-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wide transition';
                actionButton.onclick = () => {
                    clearTimeout(timeoutId);
                    toast.remove();
                    onAction();
                };
                toast.appendChild(actionButton);
            }

            container.appendChild(toast);
            timeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, actionLabel ? 6000 : 3000);
        }

        /* Custom Dialog Confirmation System */
        function showCustomConfirm(title, message, onConfirm) {
            const modal = document.getElementById('custom-dialog-modal');
            document.getElementById('dialog-title').innerText = title;
            document.getElementById('dialog-message').innerText = message;
            modal.classList.remove('hidden');

            const cancelBtn = document.getElementById('dialog-cancel-btn');
            const confirmBtn = document.getElementById('dialog-confirm-btn');
            const previousFocus = document.activeElement;

            const close = () => modal.classList.add('hidden');
            
            cancelBtn.onclick = () => {
                close();
                if (previousFocus && previousFocus.isConnected) previousFocus.focus();
            };
            confirmBtn.onclick = () => {
                close();
                onConfirm();
                document.getElementById('new-task-trigger').focus();
            };
            confirmBtn.focus();
        }

        /* Custom Color Picker Engine */
        function renderCustomColorPicker() {
            const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6'];
            const container = document.getElementById('custom-color-picker');
            container.innerHTML = colors.map(c => `
                <button type="button" aria-label="${escapeHTML(tr('Select task color'))} ${c}" onclick="selectCustomColor('${c}')"
                        class="w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${activeCustomColor === c ? 'border-indigo-500 scale-110 shadow-md' : 'border-transparent'}"
                        style="background-color: ${c}">
                    ${activeCustomColor === c ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
                </button>
            `).join('');
        }

        function selectCustomColor(color) {
            activeCustomColor = color;
            renderCustomColorPicker();
        }

        /* Custom DatePicker Component Engine */
        function renderCustomDatePicker() {
            const wrapper = document.getElementById('custom-datepicker-wrapper');
            wrapper.innerHTML = `
                <button type="button" onclick="toggleDatePickerPopup()" class="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs text-left">
                    <span id="datepicker-display-text">${escapeHTML(selectedDatePickerDate || tr('Sélectionner une date'))}</span>
                    <i class="fa-regular fa-calendar text-indigo-500"></i>
                </button>
                
                <div id="datepicker-popup" class="hidden absolute top-full left-0 mt-2 w-64 glass-panel rounded-2xl p-3 shadow-2xl border border-slate-200 dark:border-slate-700 z-50">
                    <div class="flex items-center justify-between mb-2">
                        <button type="button" onclick="quickSetDate('today')" class="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-semibold">${tr("Aujourd'hui")}</button>
                        <button type="button" onclick="quickSetDate('tomorrow')" class="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-semibold">${tr('Demain')}</button>
                    </div>
                    <input type="date" id="native-hidden-date" value="${escapeHTML(selectedDatePickerDate)}" onchange="onDatePickerChange(this.value)" class="w-full text-xs p-1 bg-transparent border rounded text-slate-800 dark:text-slate-100">
                </div>
            `;
        }

        function toggleDatePickerPopup() {
            const popup = document.getElementById('datepicker-popup');
            popup.classList.toggle('hidden');
        }

        function onDatePickerChange(val) {
            selectedDatePickerDate = val;
            document.getElementById('datepicker-display-text').innerText = val;
            document.getElementById('datepicker-popup').classList.add('hidden');
        }

        function quickSetDate(option) {
            const today = new Date();
            if (option === 'tomorrow') today.setDate(today.getDate() + 1);
            const formatted = localDateString(today);
            onDatePickerChange(formatted);
        }

        /* Custom Select Component Utility */
        function escapeHTML(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[character]);
        }

        function createCustomSelect(containerId, options, selectedValue, onChangeCallback) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const selectedOpt = options.find(o => o.value === selectedValue) || options[0];

            container.innerHTML = `
                <button type="button" onclick="toggleCustomDropdown('${containerId}')" 
                        class="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-200/60 dark:bg-slate-800/80 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition">
                    <span class="flex items-center gap-2 truncate">
                        ${selectedOpt.icon ? `<i class="${selectedOpt.icon}"></i>` : ''}
                        <span>${escapeHTML(selectedOpt.label)}</span>
                    </span>
                    <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i>
                </button>
                <div class="custom-select-dropdown hidden absolute left-0 right-0 mt-1 rounded-xl glass-panel border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50 max-h-48 overflow-y-auto">
                    ${options.map(opt => `
                        <button type="button" onclick="selectCustomOption('${containerId}', '${encodeURIComponent(String(opt.value))}', '${onChangeCallback}')"
                                class="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2 transition ${opt.value === selectedValue ? 'font-bold text-indigo-600' : ''}">
                            ${opt.icon ? `<i class="${opt.icon}"></i>` : ''}
                            <span>${escapeHTML(opt.label)}</span>
                        </button>
                    `).join('')}
                </div>
            `;
        }

        function toggleCustomDropdown(containerId) {
            document.querySelectorAll('.custom-select-dropdown').forEach(d => {
                if (d.parentElement.id !== containerId) d.classList.add('hidden');
            });
            const dropdown = document.querySelector(`#${containerId} .custom-select-dropdown`);
            dropdown.classList.toggle('hidden');
        }

        function selectCustomOption(containerId, value, callbackName) {
            document.querySelector(`#${containerId} .custom-select-dropdown`).classList.add('hidden');
            window[callbackName](decodeURIComponent(value));
        }

        /* Filter Select Options Renderers */
        function renderCustomFilterSelects() {
            createCustomSelect('filter-category-select', [
                { value: 'all', label: tr('Toutes catégories'), icon: 'fa-solid fa-layer-group' },
                ...categories.map(c => ({ value: c, label: tr(c), icon: 'fa-solid fa-tag' }))
            ], activeFilters.category, 'onCategoryFilterChange');

            createCustomSelect('filter-priority-select', [
                { value: 'all', label: tr('Toutes priorités'), icon: 'fa-solid fa-flag' },
                { value: 'high', label: tr('Haute'), icon: 'fa-solid fa-circle text-rose-500' },
                { value: 'medium', label: tr('Moyenne'), icon: 'fa-solid fa-circle text-amber-500' },
                { value: 'low', label: tr('Basse'), icon: 'fa-solid fa-circle text-emerald-500' }
            ], activeFilters.priority, 'onPriorityFilterChange');

            const allTags = [...new Set(tasks.flatMap(task => task.tags || []))].sort((a, b) => a.localeCompare(b, TaskFlowI18n.localeFor(activeLanguage)));
            createCustomSelect('filter-tag-select', [
                { value: 'all', label: tr('Tous les tags'), icon: 'fa-solid fa-tags' },
                ...allTags.map(tag => ({ value: tag, label: `#${tag}`, icon: 'fa-solid fa-tag' }))
            ], activeFilters.tag, 'onTagFilterChange');

            createCustomSelect('sort-by-select', [
                { value: 'default', label: tr('Tri par défaut'), icon: 'fa-solid fa-arrow-down-short-wide' },
                { value: 'dueDate', label: tr("Date d'échéance"), icon: 'fa-regular fa-calendar' },
                { value: 'priority', label: tr('Priorité'), icon: 'fa-solid fa-arrow-up-wide-short' }
            ], activeFilters.sortBy, 'onSortChange');
        }

        function renderDueFilterButtons() {
            const labels = { all: 'Toutes les tâches', today: 'Échéance aujourd\'hui', overdue: 'En retard', upcoming: 'À échéance bientôt' };
            document.querySelectorAll('[data-due-filter]').forEach(button => {
                const selected = button.dataset.dueFilter === activeFilters.due;
                button.textContent = tr(labels[button.dataset.dueFilter]);
                button.setAttribute('aria-pressed', String(selected));
                button.className = `due-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`;
            });
        }

        function setDueFilter(value) {
            activeFilters.due = value;
            renderDueFilterButtons();
            renderTasks();
        }

        function onCategoryFilterChange(val) { activeFilters.category = val; renderCustomFilterSelects(); renderTasks(); }
        function onPriorityFilterChange(val) { activeFilters.priority = val; renderCustomFilterSelects(); renderTasks(); }
        function onTagFilterChange(val) { activeFilters.tag = val; renderCustomFilterSelects(); renderTasks(); }
        function onSortChange(val) { activeFilters.sortBy = val; renderCustomFilterSelects(); renderTasks(); }
        function filterByTag(tag) { activeFilters.tag = tag; renderCustomFilterSelects(); renderTasks(); }

        function resetFilters() {
            activeFilters = { category: 'all', priority: 'all', sortBy: 'default', due: 'all', tag: 'all' };
            renderCustomFilterSelects();
            renderDueFilterButtons();
            renderTasks();
            showToast(tr('Filtres réinitialisés'));
        }

        /* Modal Custom Selects Configuration */
        let modalFormValues = { status: 'todo', priority: 'medium', category: 'Travail', recurrence: 'none', tags: [] };

        function renderCustomModalSelects() {
            createCustomSelect('modal-status-select', [
                { value: 'todo', label: tr('À faire'), icon: 'fa-regular fa-circle' },
                { value: 'in_progress', label: tr('En cours'), icon: 'fa-solid fa-spinner' },
                { value: 'done', label: tr('Terminé'), icon: 'fa-regular fa-circle-check' }
            ], modalFormValues.status, 'onModalStatusChange');

            createCustomSelect('modal-priority-select', [
                { value: 'low', label: tr('Basse'), icon: 'fa-solid fa-circle text-emerald-500' },
                { value: 'medium', label: tr('Moyenne'), icon: 'fa-solid fa-circle text-amber-500' },
                { value: 'high', label: tr('Haute'), icon: 'fa-solid fa-circle text-rose-500' }
            ], modalFormValues.priority, 'onModalPriorityChange');

            createCustomSelect('modal-category-select', categories.map(c => ({ value: c, label: tr(c), icon: 'fa-solid fa-tag' })), modalFormValues.category, 'onModalCategoryChange');

            createCustomSelect('modal-recurrence-select', [
                { value: 'none', label: tr('Aucune'), icon: 'fa-solid fa-slash' },
                { value: 'daily', label: tr('Quotidienne'), icon: 'fa-solid fa-arrows-rotate' },
                { value: 'weekly', label: tr('Hebdomadaire'), icon: 'fa-solid fa-calendar-week' },
                { value: 'monthly', label: tr('Mensuelle'), icon: 'fa-solid fa-calendar-days' }
            ], modalFormValues.recurrence, 'onModalRecurrenceChange');
        }

        function onModalStatusChange(val) { modalFormValues.status = val; renderCustomModalSelects(); }
        function onModalPriorityChange(val) { modalFormValues.priority = val; renderCustomModalSelects(); }
        function onModalCategoryChange(val) { modalFormValues.category = val; renderCustomModalSelects(); }
        function onModalRecurrenceChange(val) { modalFormValues.recurrence = val; renderCustomModalSelects(); }

        /* Task Cards Rendering Engine */
        function renderTasks() {
            const filtered = tasks.filter(t => {
                if (activeFilters.category !== 'all' && t.category !== activeFilters.category) return false;
                if (activeFilters.priority !== 'all' && t.priority !== activeFilters.priority) return false;
                if (activeFilters.tag !== 'all' && !(t.tags || []).includes(activeFilters.tag)) return false;
                if (!matchesDueFilter(t, activeFilters.due)) return false;
                return true;
            }).sort((a, b) => {
                if (activeFilters.sortBy === 'dueDate') return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
                if (activeFilters.sortBy === 'priority') {
                    const pMap = { high: 3, medium: 2, low: 1 };
                    return pMap[b.priority] - pMap[a.priority];
                }
                return 0;
            });

            ['todo', 'in_progress', 'done'].forEach(status => {
                const colTasks = filtered.filter(t => t.status === status);
                const listContainer = document.getElementById(`list-${status}`);
                document.getElementById(`badge-count-${status}`).innerText = colTasks.length;

                listContainer.innerHTML = colTasks.map(t => createTaskCardHTML(t)).join('');
            });
        }

        function localDateString(date = new Date()) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function matchesDueFilter(task, filter) {
            return TaskFlowCore.matchesDueFilter(task.dueDate, task.status, filter, localDateString());
        }

        function formatDueDate(value) {
            if (!value) return tr('No due date');
            const date = new Date(`${value}T00:00:00`);
            return Number.isNaN(date.getTime()) ? escapeHTML(value) : new Intl.DateTimeFormat(TaskFlowI18n.localeFor(activeLanguage), { month: 'short', day: 'numeric' }).format(date);
        }

        function formatTrackedDuration(seconds) {
            if (seconds >= 3600) return `${new Intl.NumberFormat(TaskFlowI18n.localeFor(activeLanguage), { maximumFractionDigits: 1 }).format(seconds / 3600)}h`;
            return `${Math.round(seconds / 60)}m`;
        }

        function createTaskCardHTML(task) {
            const completedSubtasks = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
            const totalSubtasks = task.subtasks ? task.subtasks.length : 0;
            const trackedSeconds = pomodoroSessions.filter(session => session.taskId === task.id).reduce((total, session) => total + session.durationSeconds, 0);
            const priorityBadge = task.priority === 'high' ? 'bg-rose-500/20 text-rose-500' :
                                  task.priority === 'medium' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500';
            const statuses = ['todo', 'in_progress', 'done'];
            const statusLabels = { todo: tr('À Faire'), in_progress: tr('En cours'), done: tr('Terminé') };
            const statusIndex = statuses.indexOf(task.status);
            const previousStatus = statuses[statusIndex - 1];
            const nextStatus = statuses[statusIndex + 1];
            const today = localDateString();
            const dueClass = task.status !== 'done' && task.dueDate < today ? 'text-rose-600 dark:text-rose-400 font-semibold' :
                task.status !== 'done' && task.dueDate && task.dueDate <= localDateString(new Date(new Date(`${today}T00:00:00`).setDate(new Date(`${today}T00:00:00`).getDate() + 7))) ? 'text-amber-600 dark:text-amber-400 font-semibold' : '';
            const safeColor = /^#[0-9a-f]{6}$/i.test(task.color || '') ? task.color : '#6366f1';

            return `
                <article role="group" aria-label="${escapeHTML(task.title)}" draggable="true"
                     ondragstart="handleDragStart(event, '${task.id}')" 
                     ondragend="handleDragEnd(event)"
                     class="group relative glass-panel rounded-xl p-3.5 border-l-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing animate-fade-in"
                     style="border-left-color: ${safeColor}">
                    
                    <!-- Card Top Header -->
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityBadge}">
                            ${escapeHTML(tr(({ high: 'Haute', medium: 'Moyenne', low: 'Basse' })[task.priority] || task.priority))}
                        </span>
                        
                        <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                            ${previousStatus ? `<button type="button" onclick="moveTask('${task.id}', -1)" aria-label="${escapeHTML(tr('Move task to') + ' ' + statusLabels[previousStatus])}" data-tooltip="${escapeHTML(tr('Move to') + ' ' + statusLabels[previousStatus])}" class="p-1 hover:text-indigo-500 text-slate-400 text-xs"><i class="fa-solid fa-arrow-left"></i></button>` : ''}
                            ${nextStatus ? `<button type="button" onclick="moveTask('${task.id}', 1)" aria-label="${escapeHTML(tr('Move task to') + ' ' + statusLabels[nextStatus])}" data-tooltip="${escapeHTML(tr('Move to') + ' ' + statusLabels[nextStatus])}" class="p-1 hover:text-indigo-500 text-slate-400 text-xs"><i class="fa-solid fa-arrow-right"></i></button>` : ''}
                            <button type="button" onclick="attachPomodoroToTask('${task.id}')" aria-label="${escapeHTML(tr('Pomodoro timer'))}" data-tooltip="${escapeHTML(tr('Pomodoro timer'))}" class="p-1 hover:text-indigo-500 text-slate-400 text-xs">
                                <i class="fa-solid fa-stopwatch"></i>
                            </button>
                            <button type="button" onclick="editTask('${task.id}')" aria-label="${escapeHTML(tr('Edit task'))}" data-tooltip="${escapeHTML(tr('Edit task'))}" class="p-1 hover:text-indigo-500 text-slate-400 text-xs">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button type="button" onclick="duplicateTask('${task.id}')" aria-label="${escapeHTML(tr('Dupliquer la tâche'))}" data-tooltip="${escapeHTML(tr('Dupliquer la tâche'))}" class="p-1 hover:text-indigo-500 text-slate-400 text-xs">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                            <button type="button" onclick="confirmDeleteTask('${task.id}')" aria-label="${escapeHTML(tr('Delete task'))}" data-tooltip="${escapeHTML(tr('Delete task'))}" class="p-1 hover:text-rose-500 text-slate-400 text-xs">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Title & Description -->
                    <h4 class="font-semibold text-xs text-slate-800 dark:text-slate-100 mb-1 leading-snug">${escapeHTML(task.title)}</h4>
                    ${task.description ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 font-normal">${escapeHTML(task.description)}</p>` : ''}

                    ${(task.tags || []).length ? `<div class="flex flex-wrap gap-1 mb-2">${task.tags.slice(0, 4).map(tag => `<button type="button" onclick="filterByTag(decodeURIComponent('${encodeURIComponent(tag)}'))" class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-[9px] font-semibold hover:bg-indigo-500/20 transition">#${escapeHTML(tag)}</button>`).join('')}${task.tags.length > 4 ? `<span class="px-1.5 py-0.5 text-[9px] text-slate-400">+${task.tags.length - 4}</span>` : ''}</div>` : ''}

                    <!-- Subtasks Progress Minimal Bar -->
                    ${totalSubtasks > 0 ? `
                        <div class="mb-3">
                            <div class="flex justify-between text-[10px] text-slate-400 mb-1">
                                <span>${tr('Sous-tâches')}</span>
                                <span>${completedSubtasks}/${totalSubtasks}</span>
                            </div>
                            <div class="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div class="h-full bg-indigo-500" style="width: ${(completedSubtasks/totalSubtasks)*100}%"></div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Card Footer Meta Info -->
                    <div class="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                            <span class="flex items-center gap-1 ${dueClass}">
                            <i class="fa-regular fa-calendar text-[10px]"></i> ${escapeHTML(formatDueDate(task.dueDate))}
                        </span>
                        <div class="flex items-center gap-2">
                            ${trackedSeconds ? `<span data-tooltip="${escapeHTML(tr('Actual tracked time'))}" class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-stopwatch"></i> ${formatTrackedDuration(trackedSeconds)}</span>` : ''}
                            ${task.duration ? `<span class="flex items-center gap-1"><i class="fa-regular fa-clock"></i> ${task.duration}m</span>` : ''}
                            <span class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${escapeHTML(tr(task.category))}</span>
                        </div>
                    </div>
                </article>
            `;
        }

        /* Mobile board swipe paging */
        function isMobileBoard() {
            return window.innerWidth < 768;
        }

        function setMobileBoardColumn(index) {
            mobileBoardIndex = Math.max(0, Math.min(2, index));
            updateMobileBoard();
        }

        function updateMobileBoard() {
            const mobile = isMobileBoard();
            document.querySelectorAll('.board-column').forEach(column => {
                const index = Number(column.dataset.boardIndex);
                column.classList.toggle('mobile-board-hidden', mobile && index !== mobileBoardIndex);
            });
            document.querySelectorAll('.board-dot').forEach((dot, index) => {
                const active = mobile && index === mobileBoardIndex;
                dot.className = `board-dot w-2.5 h-2.5 rounded-full transition ${active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`;
            });
        }

        function handleBoardTouchStart(event) {
            if (!isMobileBoard() || event.touches.length !== 1) return;
            boardTouchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }

        function handleBoardTouchEnd(event) {
            if (!boardTouchStart || !isMobileBoard()) return;
            const touch = event.changedTouches[0];
            const dx = touch.clientX - boardTouchStart.x;
            const dy = touch.clientY - boardTouchStart.y;
            boardTouchStart = null;
            if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            setMobileBoardColumn(mobileBoardIndex + (dx < 0 ? 1 : -1));
        }

        /* Drag and Drop Kanban Handlers */
        function handleDragStart(e, taskId) {
            draggedTaskId = taskId;
            e.target.classList.add('dragging');
        }

        function handleDragEnd(e) {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        }

        function handleDragOver(e) {
            e.preventDefault();
            const col = e.currentTarget;
            col.classList.add('drag-over');
        }

        function handleDragLeave(e) {
            const col = e.currentTarget;
            col.classList.remove('drag-over');
        }

        function handleDrop(e, targetStatus) {
            e.preventDefault();
            const col = e.currentTarget;
            col.classList.remove('drag-over');

            if (draggedTaskId) {
                const task = tasks.find(t => t.id === draggedTaskId);
                if (task && task.status !== targetStatus) {
                    updateTaskStatus(task, targetStatus);
                }
            }
        }

        function moveTask(taskId, direction) {
            const task = tasks.find(item => item.id === taskId);
            const statuses = ['todo', 'in_progress', 'done'];
            if (!task) return;
            const nextStatus = statuses[statuses.indexOf(task.status) + direction];
            if (nextStatus) updateTaskStatus(task, nextStatus);
        }

        function updateTaskStatus(task, nextStatus) {
            const wasDone = task.status === 'done';
            task.status = nextStatus;
            if (!wasDone && nextStatus === 'done') createNextRecurringTask(task);
            saveToLocalStorage();
            renderTasks();
            const statusLabel = { todo: tr('À Faire'), in_progress: tr('En cours'), done: tr('Terminé') }[nextStatus];
            showToast(`${tr('Task moved to')} "${statusLabel}"`, 'success');
        }

        function incrementDueDate(value, recurrence) {
            return TaskFlowCore.nextDueDate(value, recurrence, localDateString());
        }

        function createNextRecurringTask(task) {
            if (!['daily', 'weekly', 'monthly'].includes(task.recurrence)) return;
            if (task.nextOccurrenceId && tasks.some(item => item.id === task.nextOccurrenceId)) return;
            const nextId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const nextTask = {
                ...task,
                id: nextId,
                status: 'todo',
                dueDate: incrementDueDate(task.dueDate, task.recurrence),
                recurrenceSeriesId: task.recurrenceSeriesId || task.id,
                generatedFromId: task.id,
                nextOccurrenceId: null,
                subtasks: (task.subtasks || []).map(subtask => ({
                    ...subtask,
                    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    completed: false
                }))
            };
            task.nextOccurrenceId = nextId;
            tasks.push(nextTask);
        }

        /* Task Modal Operations */
        function openTaskModal(taskId = null) {
            const modal = document.getElementById('task-modal');
            const form = document.getElementById('task-form');
            form.reset();
            tempSubtasks = [];

            if (taskId) {
                const t = tasks.find(x => x.id === taskId);
                document.getElementById('modal-title').innerText = tr('Éditer la tâche');
                document.getElementById('task-id').value = t.id;
                document.getElementById('task-title-input').value = t.title;
                document.getElementById('task-desc-input').value = t.description || '';
                document.getElementById('task-duration-input').value = t.duration || 30;
                modalFormValues = { status: t.status, priority: t.priority, category: t.category, recurrence: t.recurrence || 'none', tags: [...(t.tags || [])] };
                activeCustomColor = t.color || '#6366f1';
                selectedDatePickerDate = t.dueDate;
                tempSubtasks = (t.subtasks || []).map(subtask => ({ ...subtask }));
                document.getElementById('task-tags-input').value = (t.tags || []).join(', ');
            } else {
                document.getElementById('modal-title').innerText = tr('Créer une nouvelle tâche');
                document.getElementById('task-id').value = '';
                modalFormValues = { status: 'todo', priority: 'medium', category: categories[0], recurrence: 'none', tags: [] };
                document.getElementById('task-tags-input').value = '';
                activeCustomColor = '#6366f1';
                selectedDatePickerDate = localDateString();
            }

            renderCustomModalSelects();
            renderCustomColorPicker();
            renderCustomDatePicker();
            renderSubtasksList();

            modal.classList.remove('hidden');
            document.getElementById('task-title-input').focus();
        }

        function closeTaskModal() {
            const modal = document.getElementById('task-modal');
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
                document.getElementById('new-task-trigger').focus();
            }
        }

        function addSubtask() {
            const input = document.getElementById('new-subtask-input');
            if (!input.value.trim()) return;
            tempSubtasks.push({
                id: 'sub_' + Date.now(),
                title: input.value.trim(),
                completed: false
            });
            input.value = '';
            renderSubtasksList();
        }

        function toggleSubtask(id) {
            const st = tempSubtasks.find(x => x.id === id);
            if (st) st.completed = !st.completed;
            renderSubtasksList();
        }

        function removeSubtask(id) {
            tempSubtasks = tempSubtasks.filter(x => x.id !== id);
            renderSubtasksList();
        }

        function renderSubtasksList() {
            const container = document.getElementById('subtasks-container');
            container.innerHTML = tempSubtasks.map(s => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 text-xs">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="toggleSubtask('${s.id}')" class="rounded text-indigo-600 focus:ring-0">
                        <span class="${s.completed ? 'line-through text-slate-400' : ''}">${escapeHTML(s.title)}</span>
                    </label>
                    <button type="button" aria-label="${escapeHTML(tr('Remove subtask'))}" onclick="removeSubtask('${s.id}')" class="text-slate-400 hover:text-rose-500">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `).join('');
        }

        function saveTask(e) {
            e.preventDefault();
            const id = document.getElementById('task-id').value;
            const title = document.getElementById('task-title-input').value.trim();
            const description = document.getElementById('task-desc-input').value.trim();
            const duration = parseInt(document.getElementById('task-duration-input').value) || 30;
            const tags = parseTaskTags(document.getElementById('task-tags-input').value);

            if (id) {
                const t = tasks.find(x => x.id === id);
                const wasDone = t.status === 'done';
                t.title = title;
                t.description = description;
                t.status = modalFormValues.status;
                t.priority = modalFormValues.priority;
                t.category = modalFormValues.category;
                t.recurrence = modalFormValues.recurrence;
                t.color = activeCustomColor;
                t.dueDate = selectedDatePickerDate;
                t.duration = duration;
                t.tags = tags;
                t.subtasks = tempSubtasks;
                if (!wasDone && t.status === 'done') createNextRecurringTask(t);
                showToast(tr('Tâche mise à jour avec succès'), 'success');
            } else {
                const newTask = {
                    id: 'task_' + Date.now(),
                    title,
                    description,
                    status: modalFormValues.status,
                    priority: modalFormValues.priority,
                    category: modalFormValues.category,
                    recurrence: modalFormValues.recurrence,
                    color: activeCustomColor,
                    dueDate: selectedDatePickerDate,
                    duration,
                    tags,
                    subtasks: tempSubtasks
                };
                tasks.push(newTask);
                if (newTask.status === 'done') createNextRecurringTask(newTask);
                showToast(tr('Nouvelle tâche créée'), 'success');
            }

            saveToLocalStorage();
            renderTasks();
            renderCustomFilterSelects();
            closeTaskModal();
        }

        function editTask(id) {
            openTaskModal(id);
        }

        function parseTaskTags(value) {
            const seen = new Set();
            return String(value || '').split(',')
                .map(tag => tag.trim())
                .filter(tag => tag && tag.length <= 30 && !seen.has(tag.toLocaleLowerCase()) && seen.add(tag.toLocaleLowerCase()))
                .slice(0, 10);
        }

        function duplicateTask(id) {
            const source = tasks.find(t => t.id === id);
            if (!source) return;
            const copy = {
                ...source,
                id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                status: 'todo',
                recurrence: 'none',
                recurrenceSeriesId: null,
                generatedFromId: null,
                nextOccurrenceId: null,
                tags: [...(source.tags || [])],
                subtasks: (source.subtasks || []).map(subtask => ({
                    ...subtask,
                    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
                }))
            };
            tasks.push(copy);
            saveToLocalStorage();
            renderTasks();
            renderCustomFilterSelects();
            showToast(tr('Tâche dupliquée'), 'success');
        }

        function confirmDeleteTask(id) {
            showCustomConfirm(tr('Supprimer la tâche'), tr('Êtes-vous sûr de vouloir supprimer définitivement cette tâche ?'), () => {
                const index = tasks.findIndex(t => t.id === id);
                if (index === -1) return;
                const [removed] = tasks.splice(index, 1);
                saveToLocalStorage();
                renderTasks();
                showToast(tr('Tâche supprimée'), 'error', tr('Rétablir'), () => {
                    tasks.splice(Math.min(index, tasks.length), 0, removed);
                    saveToLocalStorage();
                    renderTasks();
                });
            });
        }

        /* Pomodoro Engine */
        function togglePomodoroWidget() {
            const widget = document.getElementById('pomodoro-widget');
            widget.classList.toggle('hidden');
        }

        function startPomodoroWidgetDrag(event) {
            if (event.button !== 0 || event.target.closest('button')) return;
            const widget = document.getElementById('pomodoro-widget');
            const bounds = widget.getBoundingClientRect();
            pomodoroDragState = {
                pointerId: event.pointerId,
                offsetX: event.clientX - bounds.left,
                offsetY: event.clientY - bounds.top
            };
            widget.style.left = `${bounds.left}px`;
            widget.style.top = `${bounds.top}px`;
            widget.style.right = 'auto';
            widget.style.bottom = 'auto';
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        function movePomodoroWidgetDrag(event) {
            if (!pomodoroDragState || pomodoroDragState.pointerId !== event.pointerId) return;
            const widget = document.getElementById('pomodoro-widget');
            const maxLeft = Math.max(0, window.innerWidth - widget.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - widget.offsetHeight);
            const left = Math.max(0, Math.min(maxLeft, event.clientX - pomodoroDragState.offsetX));
            const top = Math.max(0, Math.min(maxTop, event.clientY - pomodoroDragState.offsetY));
            widget.style.left = `${left}px`;
            widget.style.top = `${top}px`;
            pomodoroWidgetPosition = { left, top };
        }

        function endPomodoroWidgetDrag(event) {
            if (!pomodoroDragState || pomodoroDragState.pointerId !== event.pointerId) return;
            pomodoroDragState = null;
            saveToLocalStorage();
        }

        function attachPomodoroToTask(taskId) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                pomodoroActiveTaskId = taskId;
                document.getElementById('pomo-task-title').textContent = `${tr('Task')}: ${task.title}`;
                document.getElementById('pomodoro-widget').classList.remove('hidden');
                saveToLocalStorage();
                showToast(`${tr('Minuteur lié à')} "${task.title}"`);
            }
        }

        function startPomodoro() {
            if (pomodoroRunning) return;
            if (pomodoroSeconds <= 0) pomodoroSeconds = pomodoroDurationSeconds();
            pomodoroRunning = true;
            pomodoroHasStarted = true;
            pomodoroEndTime = Date.now() + pomodoroSeconds * 1000;
            document.getElementById('pomo-start-btn').classList.add('opacity-50');
            updatePomodoroDisplay();
            saveToLocalStorage();
            pomodoroTimer = setInterval(tickPomodoro, 250);
        }

        function togglePomodoro() {
            if (pomodoroRunning) pausePomodoro();
            else startPomodoro();
        }

        function adjustPomodoroDuration(increment) {
            const key = pomodoroMode === 'work' ? 'pomodoroWorkMinutes' : 'pomodoroBreakMinutes';
            const maximum = pomodoroMode === 'work' ? 120 : 60;
            const nextDuration = Math.max(1, Math.min(maximum, settings[key] + increment));
            if (pomodoroRunning) {
                pomodoroSeconds = Math.max(1, pomodoroSeconds + increment * 60);
                pomodoroEndTime = Date.now() + pomodoroSeconds * 1000;
            }
            updateSetting(key, nextDuration);
            updatePomodoroDisplay();
        }

        function pomodoroDurationSeconds(mode = pomodoroMode) {
            return (mode === 'work' ? settings.pomodoroWorkMinutes : settings.pomodoroBreakMinutes) * 60;
        }

        function tickPomodoro() {
            if (!pomodoroRunning || !Number.isFinite(pomodoroEndTime)) return;
            pomodoroSeconds = Math.max(0, Math.ceil((pomodoroEndTime - Date.now()) / 1000));
            updatePomodoroDisplay();
            if (pomodoroSeconds === 0) completePomodoro();
        }

        function setPomodoroMode(mode) {
            if (!['work', 'break'].includes(mode)) return;
            if (pomodoroRunning) pausePomodoro();
            pomodoroMode = mode;
            pomodoroHasStarted = false;
            pomodoroSeconds = pomodoroDurationSeconds();
            updatePomodoroDisplay();
            saveToLocalStorage();
        }

        function completePomodoro() {
            clearInterval(pomodoroTimer);
            pomodoroRunning = false;
            pomodoroEndTime = null;
            pomodoroHasStarted = false;
            const completedMode = pomodoroMode;
            if (completedMode === 'work') {
                pomodoroSessions.push({
                    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    taskId: pomodoroActiveTaskId,
                    durationSeconds: pomodoroDurationSeconds('work'),
                    completedAt: new Date().toISOString()
                });
                pomodoroCompletedCycles++;
            }
            pomodoroMode = completedMode === 'work' ? 'break' : 'work';
            pomodoroSeconds = pomodoroDurationSeconds();
            updatePomodoroDisplay();
            saveToLocalStorage();
            renderTasks();
            showToast(completedMode === 'work' ? tr('Pomodoro terminé ! Prenez une pause.') : tr('Break complete. Ready to focus?'), 'success');
            if (settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
                const task = tasks.find(item => item.id === pomodoroActiveTaskId);
                try {
                    new Notification('TaskFlow', { body: task ? `${tr('Pomodoro complete for')} ${task.title}` : tr('Pomodoro terminé ! Prenez une pause.') });
                } catch (error) {
                    showToast(tr('Pomodoro terminé ! Prenez une pause.'), 'success');
                }
            }
            if (settings.sound) playCompletionSound();
        }

        function playCompletionSound() {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return false;
                const context = new AudioContextClass();
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.frequency.value = 880;
                gain.gain.setValueAtTime(0.12, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.6);
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start();
                oscillator.stop(context.currentTime + 0.6);
                oscillator.onended = () => context.close();
                return true;
            } catch (error) {
                return false;
            }
        }

        async function testBrowserNotification() {
            if (!('Notification' in window)) {
                showToast(tr('Notifications are not supported by this browser'), 'error');
                return;
            }
            try {
                const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
                if (permission !== 'granted') throw new Error('notification permission denied');
                new Notification('TaskFlow', { body: tr('Test notification sent') });
                showToast(tr('Test notification sent'), 'success');
            } catch (error) {
                showToast(tr('Notifications are blocked by the browser'), 'error');
            }
        }

        function testSoundAlert() {
            if (!playCompletionSound()) {
                showToast(tr('Sound alerts are not supported by this browser'), 'error');
                return;
            }
            showToast(tr('Test sound played'), 'success');
        }

        function pausePomodoro() {
            if (pomodoroRunning && Number.isFinite(pomodoroEndTime)) {
                pomodoroSeconds = Math.max(0, Math.ceil((pomodoroEndTime - Date.now()) / 1000));
                if (pomodoroSeconds === 0) {
                    completePomodoro();
                    return;
                }
            }
            clearInterval(pomodoroTimer);
            pomodoroRunning = false;
            pomodoroHasStarted = true;
            pomodoroEndTime = null;
            document.getElementById('pomo-start-btn').classList.remove('opacity-50');
            updatePomodoroDisplay();
            saveToLocalStorage();
        }

        function resetPomodoro() {
            clearInterval(pomodoroTimer);
            pomodoroRunning = false;
            pomodoroHasStarted = false;
            pomodoroEndTime = null;
            pomodoroSeconds = pomodoroDurationSeconds();
            document.getElementById('pomo-start-btn').classList.remove('opacity-50');
            updatePomodoroDisplay();
            saveToLocalStorage();
        }

        function updatePomodoroDisplay() {
            const m = Math.floor(pomodoroSeconds / 60).toString().padStart(2, '0');
            const s = (pomodoroSeconds % 60).toString().padStart(2, '0');
            document.getElementById('pomo-timer-display').innerText = `${m}:${s}`;
            document.getElementById('pomo-mode-label').textContent = tr(pomodoroMode === 'work' ? 'Work session' : 'Break session');
            const workButton = document.getElementById('pomo-work-mode');
            const breakButton = document.getElementById('pomo-break-mode');
            workButton.setAttribute('aria-pressed', String(pomodoroMode === 'work'));
            breakButton.setAttribute('aria-pressed', String(pomodoroMode === 'break'));
            workButton.className = `px-2.5 py-1 rounded-lg text-[10px] font-semibold ${pomodoroMode === 'work' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`;
            breakButton.className = `px-2.5 py-1 rounded-lg text-[10px] font-semibold ${pomodoroMode === 'break' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`;
            document.getElementById('pomo-duration-label').textContent = `${settings[pomodoroMode === 'work' ? 'pomodoroWorkMinutes' : 'pomodoroBreakMinutes']} ${tr('min')}`;
            const startButton = document.getElementById('pomo-start-btn');
            const buttonText = pomodoroRunning ? 'Pause' : pomodoroHasStarted ? 'Resume' : 'Start';
            const buttonIcon = pomodoroRunning ? 'fa-pause' : 'fa-play';
            startButton.innerHTML = `<i class="fa-solid ${buttonIcon} mr-1"></i><span id="pomo-start-label">${escapeHTML(tr(buttonText))}</span>`;
            startButton.setAttribute('aria-label', tr(buttonText));
        }

        /* Productivity Statistics Modal */
        function toggleStatsModal(forceOpen) {
            const modal = document.getElementById('stats-modal');
            if (forceOpen === false) {
                const wasOpen = !modal.classList.contains('hidden');
                modal.classList.add('hidden');
                if (wasOpen) document.getElementById('stats-trigger').focus();
                return;
            }

            const total = tasks.length;
            const completed = tasks.filter(t => t.status === 'done').length;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
            const totalDuration = tasks.reduce((acc, t) => acc + (t.duration || 0), 0);
            const actualSeconds = pomodoroSessions.reduce((totalSeconds, session) => totalSeconds + session.durationSeconds, 0);

            document.getElementById('stat-completion-rate').innerText = `${rate}%`;
            document.getElementById('stat-total-time').innerText = `${Math.round(totalDuration / 60)}h`;
            document.getElementById('stat-actual-time').innerText = formatTrackedDuration(actualSeconds);
            document.getElementById('stat-progress-text').innerText = `${completed} / ${total} ${tr('Tâches')}`;
            document.getElementById('stat-progress-bar').style.width = `${rate}%`;

            const stats = TaskFlowCore.computeProductivityStats(tasks, pomodoroSessions, localDateString());

            const categoryContainer = document.getElementById('stat-by-category');
            categoryContainer.innerHTML = stats.completionByCategory.length
                ? stats.completionByCategory.map(entry => `
                    <div>
                        <div class="flex justify-between mb-1"><span class="truncate">${escapeHTML(tr(entry.category))}</span><span class="text-slate-400">${entry.done}/${entry.total} · ${entry.rate}%</span></div>
                        <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div class="h-full bg-indigo-500" style="width: ${entry.rate}%"></div></div>
                    </div>`).join('')
                : `<p class="text-slate-400">${escapeHTML(tr('Aucune tâche'))}</p>`;

            const taskTitleById = new Map(tasks.map(task => [task.id, task.title]));
            const timeRows = Object.entries(stats.timeByTask)
                .map(([taskId, seconds]) => ({ title: taskTitleById.get(taskId) || taskId, seconds }))
                .sort((a, b) => b.seconds - a.seconds)
                .slice(0, 5);
            document.getElementById('stat-time-by-task').innerHTML = timeRows.length
                ? timeRows.map(row => `<div class="flex justify-between gap-2"><span class="truncate">${escapeHTML(row.title)}</span><span class="text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">${formatTrackedDuration(row.seconds)}</span></div>`).join('')
                : `<p class="text-slate-400">${escapeHTML(tr('Aucune session'))}</p>`;

            const maxDayCount = Math.max(1, ...stats.sessionsByDay.map(day => day.count));
            document.getElementById('stat-sessions-chart').innerHTML = stats.sessionsByDay.map(day => `
                <div class="flex-1 flex flex-col items-center gap-1" title="${escapeHTML(day.date)}: ${day.count}">
                    <div class="w-full rounded-t bg-indigo-500/70" style="height: ${Math.max(4, Math.round((day.count / maxDayCount) * 64))}px"></div>
                </div>`).join('');

            document.getElementById('stat-streak').innerText = `${stats.streakDays}`;

            modal.classList.toggle('hidden');
            if (!modal.classList.contains('hidden')) modal.querySelector('button').focus();
        }

        /* Quick Search Engine */
        function openSearchModal() {
            const modal = document.getElementById('search-modal');
            modal.classList.remove('hidden');
            document.getElementById('search-input').focus();
        }

        function closeSearchModal() {
            const modal = document.getElementById('search-modal');
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
                document.getElementById('search-trigger').focus();
            }
        }

        function handleSearch(query) {
            const container = document.getElementById('search-results');
            searchResultIndex = -1;
            if (!query.trim()) {
                container.innerHTML = '';
                document.getElementById('search-input').setAttribute('aria-expanded', 'false');
                document.getElementById('search-input').removeAttribute('aria-activedescendant');
                return;
            }

            const normalizedQuery = query.toLocaleLowerCase(TaskFlowI18n.localeFor(activeLanguage));
            const matches = tasks.filter(task => {
                const status = { todo: tr('À Faire'), in_progress: tr('En cours'), done: tr('Terminé') }[task.status];
                const priority = tr(({ high: 'Haute', medium: 'Moyenne', low: 'Basse' })[task.priority] || task.priority);
                const searchable = [task.title, task.description, task.category, tr(task.category), task.priority, priority, status, ...(task.tags || []), ...(task.subtasks || []).map(subtask => subtask.title)];
                return searchable.some(value => String(value || '').toLocaleLowerCase(TaskFlowI18n.localeFor(activeLanguage)).includes(normalizedQuery));
            });
            window.searchResults = matches;
            container.innerHTML = matches.map((task, index) => `
                <button id="search-result-${index}" type="button" role="option" aria-selected="false" onclick="openSearchResult(${index})" class="w-full text-left p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-500/10 cursor-pointer transition flex justify-between items-center text-xs">
                    <div>
                        <div class="font-semibold text-slate-800 dark:text-slate-100">${escapeHTML(task.title)}</div>
                        <div class="text-[10px] text-slate-400">${escapeHTML(task.category)} • ${escapeHTML(({ todo: tr('À Faire'), in_progress: tr('En cours'), done: tr('Terminé') })[task.status])}</div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-slate-400"></i>
                </button>
            `).join('');
            if (!matches.length) container.innerHTML = `<p class="p-3 text-xs text-slate-500">${escapeHTML(tr('No matching tasks'))}</p>`;
            document.getElementById('search-input').setAttribute('aria-expanded', String(matches.length > 0));
        }

        function moveSearchSelection(direction) {
            const results = document.querySelectorAll('#search-results [role="option"]');
            if (!results.length) return;
            searchResultIndex = (searchResultIndex + direction + results.length) % results.length;
            results.forEach((result, index) => {
                const selected = index === searchResultIndex;
                result.setAttribute('aria-selected', String(selected));
                result.classList.toggle('bg-indigo-500/10', selected);
            });
            document.getElementById('search-input').setAttribute('aria-activedescendant', `search-result-${searchResultIndex}`);
            results[searchResultIndex].scrollIntoView({ block: 'nearest' });
        }

        function openSearchResult(index) {
            const task = (window.searchResults || [])[index];
            if (!task) return;
            closeSearchModal();
            openTaskModal(task.id);
        }

        /* Theme Toggle Handler */
        function toggleTheme() {
            const html = document.documentElement;
            const icon = document.getElementById('theme-icon');

            if (html.classList.contains('dark')) {
                html.classList.remove('dark');
                icon.className = 'fa-solid fa-sun text-amber-500';
                localStorage.setItem('theme', 'light');
            } else {
                html.classList.add('dark');
                icon.className = 'fa-solid fa-moon text-slate-300';
                localStorage.setItem('theme', 'dark');
            }
        }

        /* Export & Import JSON Operations */
        function toggleDataMenu() {
            document.getElementById('data-menu').classList.toggle('hidden');
        }

        function normalizeImportedTasks(value) {
            return TaskFlowCore.normalizeImportedTasks(value, categories);
        }

        function normalizeSessionHistory(value) {
            return TaskFlowCore.normalizeSessionHistory(value);
        }

        function normalizeImportedSettings(value) {
            return TaskFlowCore.normalizeImportedSettings(value);
        }

        function validateImportPayload(value) {
            return TaskFlowCore.validateImportPayload(value, categories);
        }

        function exportData() {
            const backup = { version: 2, exportedAt: new Date().toISOString(), tasks, categories, settings, pomodoroSessions };
            const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `taskflow_backup_${localDateString()}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast(tr('Backup exported as JSON'), 'success');
        }

        function downloadBlob(content, filename, mimeType) {
            const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function exportCsv() {
            downloadBlob(TaskFlowCore.buildCsv(tasks), `taskflow_tasks_${localDateString()}.csv`, 'text/csv;charset=utf-8');
            showToast(tr('Sauvegarde exportée au format CSV'), 'success');
        }

        function exportIcs() {
            downloadBlob(TaskFlowCore.buildIcs(tasks), `taskflow_tasks_${localDateString()}.ics`, 'text/calendar;charset=utf-8');
            showToast(tr('Sauvegarde exportée au format iCalendar'), 'success');
        }

        function importData(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const fileReader = new FileReader();
            fileReader.onload = function(loadEvent) {
                try {
                    const payload = validateImportPayload(JSON.parse(loadEvent.target.result));
                    if (!payload) throw new Error('invalid backup');
                    pendingImport = payload;
                    const preview = TaskFlowCore.buildImportPreview(tasks, payload.tasks);
                    document.getElementById('import-preview').textContent = `${tr('Tasks in backup')}: ${preview.incomingCount} | ${tr('New tasks')}: ${preview.newCount} | ${tr('Existing ID conflicts')}: ${preview.conflictCount}. ${tr('Replace keeps imported tasks')}: ${preview.replaceCount}.`;
                    const importModal = document.getElementById('import-modal');
                    importModal.classList.remove('hidden');
                    importModal.querySelector('button').focus();
                } catch (err) {
                    showToast(tr('Import contains invalid task data'), 'error');
                    event.target.value = '';
                }
            };
            fileReader.onerror = () => showToast(tr('Erreur lors de la lecture du fichier'), 'error');
            fileReader.readAsText(file);
        }

        function applyImport(mode) {
            if (!pendingImport || !['replace', 'merge'].includes(mode)) return;
            let nextTasks = pendingImport.tasks;
            let nextCategories = pendingImport.categories;
            let nextSettings = pendingImport.settings || settings;
            let nextSessions = pendingImport.pomodoroSessions || pomodoroSessions;
            if (mode === 'merge') {
                nextTasks = TaskFlowCore.mergeTasks(tasks, pendingImport.tasks);
                nextCategories = [...new Set([...categories, ...pendingImport.categories])];
                const existingSessionIds = new Set(pomodoroSessions.map(session => session.id));
                nextSessions = [...pomodoroSessions, ...(pendingImport.pomodoroSessions || []).filter(session => !existingSessionIds.has(session.id))];
                nextSettings = settings;
            }
            const nextState = { tasks: nextTasks, categories: nextCategories, settings: nextSettings, pomodoroSessions: nextSessions };
            if (!persistState(nextState)) return;
            tasks = nextTasks;
            categories = nextCategories;
            settings = nextSettings;
            pomodoroSessions = nextSessions;
            pendingImport = null;
            document.getElementById('import-modal').classList.add('hidden');
            document.getElementById('import-file').value = '';
            applySettings();
            if (!pomodoroRunning) {
                pomodoroSeconds = pomodoroDurationSeconds();
                updatePomodoroDisplay();
                saveToLocalStorage();
            }
            renderCustomFilterSelects();
            renderCustomModalSelects();
            renderCategoryManager();
            renderTasks();
            showToast(tr('Backup imported'), 'success');
        }

        function confirmImportReplace() {
            if (!pendingImport) return;
            const preview = TaskFlowCore.buildImportPreview(tasks, pendingImport.tasks);
            const message = `${tr('Replace backup confirmation')} ${preview.replaceCount} ${tr('tasks will remain')}.`;
            showCustomConfirm(tr('Replace current tasks?'), message, () => applyImport('replace'));
        }

        function confirmDeleteAllData() {
            showCustomConfirm(
                tr('Supprimer toutes les données'),
                tr('Toutes les tâches, réglages et historiques seront définitivement effacés. Cette action est irréversible.'),
                deleteAllData
            );
        }

        function deleteAllData() {
            try {
                Object.keys(localStorage)
                    .filter(key => key.startsWith('taskmaster_') || key === 'theme')
                    .forEach(key => localStorage.removeItem(key));
            } catch (error) {
                return;
            }
            location.reload();
        }

        function cancelImport() {
            pendingImport = null;
            const modal = document.getElementById('import-modal');
            if (modal) modal.classList.add('hidden');
            const preview = document.getElementById('import-preview');
            if (preview) preview.textContent = '';
            const fileInput = document.getElementById('import-file');
            if (fileInput) fileInput.value = '';
        }
