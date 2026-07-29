// ══════════════════════════════════════════════
//  EduTrack Dashboard JS  –  Django Backend Edition
// ══════════════════════════════════════════════

// ── CSRF Helper ──
function getCookie(name) {
    let v = null;
    if (document.cookie) {
        document.cookie.split(';').forEach(c => {
            c = c.trim();
            if (c.startsWith(name + '=')) v = decodeURIComponent(c.slice(name.length + 1));
        });
    }
    return v;
}

// ── API Helper ──
async function api(method, url, body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        credentials: 'same-origin',
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 401) { window.location.href = '/login/'; return null; }
    return res.json();
}

// ── STATE ──
const S = {
    tasks: [], notes: [],
    streak: { count: 0, best: 0, logged: [], badges: [] },
    attendance: [],
    marks: [],
    skills: { communication: 0, teamwork: 0, timeManagement: 0, problemSolving: 0 },
    quizAnswers: [], currentQ: 0, assessmentDone: false, charts: {},
    feedbacks: [], feedbackRating: 0, feedbackMood: '',
    tt: { base64: null, results: null },
    cal: { base64: null, results: null },
    prefs: { voiceSpeed: 0.9, attAlert: true },
    ocrPending: [],
    user: {}
};

const BADGES = [
    { id: 'first_login', icon: '🌟', name: 'First Login', desc: 'Welcome aboard!' },
    { id: 'streak_3', icon: '🔥', name: '3-Day Streak', desc: '3 days in a row' },
    { id: 'streak_7', icon: '💎', name: '7-Day Streak', desc: 'One full week!' },
    { id: 'streak_14', icon: '🏆', name: '2-Week Warrior', desc: '14 days streak' },
    { id: 'streak_30', icon: '👑', name: 'Monthly Master', desc: '30 days streak' },
    { id: 'perfect_week', icon: '⭐', name: 'Perfect Week', desc: '7 tasks in a week' },
    { id: 'task_10', icon: '✅', name: 'Task Master', desc: 'Complete 10 tasks' },
    { id: 'assess_done', icon: '🧠', name: 'Self Aware', desc: 'Finish assessment' },
    { id: 'notes_5', icon: '📖', name: 'Journal Keeper', desc: '5 practice entries' }
];

const QUOTES = [
    "The secret of getting ahead is getting started. – Mark Twain",
    "Don't watch the clock; do what it does. Keep going. – Sam Levenson",
    "Success is the sum of small efforts repeated day in and day out. – R. Collier",
    "The future belongs to those who believe in the beauty of their dreams.",
    "Push yourself, because no one else is going to do it for you.",
    "Dream it. Wish it. Do it.",
    "It always seems impossible until it's done. – Nelson Mandela",
    "Great things never come from comfort zones.",
    "Strive for progress, not perfection.",
    "Stay consistent. Small steps every day."
];

const QS = [
    { cat: 'Communication', text: 'How often do you clearly express your ideas in group discussions?', type: 'rating' },
    { cat: 'Communication', text: 'When receiving feedback, I typically:', type: 'mcq', opts: ['Get defensive immediately', 'Listen and reflect before responding', 'Ignore it', 'Accept everything without question'] },
    { cat: 'Communication', text: 'Describe a situation where clear communication helped you resolve a problem.', type: 'short' },
    { cat: 'Teamwork', text: 'In a group project, I usually take the role of:', type: 'mcq', opts: ['The leader who delegates', 'A collaborative contributor', 'A silent executor', 'The critic who evaluates'] },
    { cat: 'Teamwork', text: 'Rate your ability to work effectively in diverse teams.', type: 'rating' },
    { cat: 'Teamwork', text: 'How do you handle disagreements with team members?', type: 'short' },
    { cat: 'Time Management', text: 'How well do you manage deadlines?', type: 'rating' },
    { cat: 'Time Management', text: 'When a task takes longer than expected, I:', type: 'mcq', opts: ['Panic and give up', 'Reprioritize and push through', 'Ask for help immediately', 'Wait for others to step in'] },
    { cat: 'Time Management', text: 'Describe your daily study routine or planning method.', type: 'short' },
    { cat: 'Problem Solving', text: 'Rate your ability to break complex problems into smaller steps.', type: 'rating' },
    { cat: 'Problem Solving', text: 'When facing a new technical challenge, I:', type: 'mcq', opts: ['Research multiple approaches', 'Ask someone immediately', 'Try random solutions', 'Avoid it until deadline'] },
    { cat: 'Problem Solving', text: 'What strategy do you use when stuck on a difficult problem?', type: 'short' }
];

const TAB_TITLES = { home: 'Home', tasks: 'Task Planner', practice: 'Practice Log', attendance: 'Attendance', cgpa: 'CGPA Predictor', timetable: 'Timetable & Calendar', streaks: 'Streaks & Badges', skills: 'Soft Skills', analytics: 'Analytics', feedback: 'Feedback', settings: 'Settings' };

let _synthReady = false;
function warmSpeech() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) { _synthReady = true; return; }
    window.speechSynthesis.onvoiceschanged = () => { _synthReady = true; };
    const u = new SpeechSynthesisUtterance(''); u.volume = 0; u.rate = 1;
    window.speechSynthesis.speak(u);
}

// ══════════════════════════════════════════════
//  INIT – load all data from Django API
// ══════════════════════════════════════════════
async function init() {
    warmSpeech();
    await loadAllFromServer();
    renderTaskList('all'); renderNoteList();
    renderAttTable(); renderMarksTable();
    renderAttendanceBars(); calcCGPA();
    renderBadges(); renderStreakCalendar();
    updateHomeSummary(); newQuote();
    setupEvents();
    loadSettingsUI();
    renderFeedbackHistory();
    loadPrefs();
    registerNotifications();
    startReminderScheduler();
    syncEmptyHints();
}

async function loadAllFromServer() {
    try {
        // Load user info
        const me = await api('GET', '/api/me/');
        if (me) {
            S.user = me;
            const name = me.fullname || 'Student';
            document.getElementById('welcome-name').textContent = name.split(' ')[0];
            document.getElementById('sb-name').textContent = name;
            document.getElementById('sb-avatar').textContent = name.charAt(0).toUpperCase();
        }

        // Load all features in parallel
        const [tasksRes, notesRes, attRes, skillsRes, fbRes, streakRes, marksRes] = await Promise.all([
            api('GET', '/api/tasks/'),
            api('GET', '/api/notes/'),
            api('GET', '/api/attendance/'),
            api('GET', '/api/skills/'),
            api('GET', '/api/feedback/'),
            api('GET', '/api/streaks/'),
            api('GET', '/api/marks/'),
        ]);

        if (tasksRes?.tasks) {
            S.tasks = tasksRes.tasks.map(t => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
                due: t.due_date || '',
                done: t.is_completed,
                created: t.created_at?.slice(0, 10) || '',
                _serverId: t.id
            }));
        }

        if (notesRes?.notes) {
            S.notes = notesRes.notes.map(n => ({
                id: n.id,
                title: n.title,
                category: n.category || 'General',
                content: n.content,
                date: new Date(n.created_at).toLocaleDateString(),
                _serverId: n.id
            }));
        }

        if (attRes?.attendance) {
            S.attendance = attRes.attendance.map(a => ({
                sub: a.subject,
                held: a.classes_held,
                attended: a.classes_attended,
                _serverId: a.id
            }));
        }

        if (skillsRes?.skills) {
            const sk = skillsRes.skills;
            S.skills = {
                communication: sk.communication || 0,
                teamwork: sk.teamwork || 0,
                timeManagement: sk.time_management || 0,
                problemSolving: sk.problem_solving || 0
            };
        }

        if (fbRes?.feedbacks) {
            S.feedbacks = fbRes.feedbacks.map(f => ({
                id: f.id,
                rating: f.rating,
                mood: f.mood,
                category: f.category,
                subject: f.subject,
                message: f.message,
                date: new Date(f.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                _serverId: f.id
            }));
        }

        if (streakRes?.streak) {
            S.streak = {
                count: streakRes.streak.count || 0,
                best: streakRes.streak.best || 0,
                logged: streakRes.streak.logged || [],
                badges: streakRes.streak.badges || []
            };
        }

        if (marksRes?.marks) {
            S.marks = marksRes.marks.map(m => ({
                sub: m.subject,
                max: m.max_marks,
                obt: m.obtained_marks,
                credits: m.credits,
                _serverId: m.id
            }));
        }

        // Award first login badge
        awardBadge('first_login');

    } catch (e) {
        console.error('Failed to load data from server:', e);
        showToast('Could not load data. Please refresh.', 'error');
    }
}

// ── SAVE HELPERS (debounced to avoid too many requests) ──
let _saveStreakTimer = null;
function saveStreak() {
    clearTimeout(_saveStreakTimer);
    _saveStreakTimer = setTimeout(() => {
        api('POST', '/api/streaks/', {
            streak: { count: S.streak.count, best: S.streak.best, logged: S.streak.logged, badges: S.streak.badges }
        });
    }, 500);
}

function setupEvents() {
    document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => { switchTab(n.dataset.tab); closeSidebar(); }));
    document.getElementById('menu-btn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('visible');
    });
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    document.querySelectorAll('.filter-tab').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        renderTaskList(t.dataset.filter);
    }));
    document.querySelectorAll('.analytics-subtab').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.analytics-subtab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        updateMainChart(t.dataset.chart);
    }));
    document.getElementById('task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

    document.querySelectorAll('.toggle-password-settings').forEach(icon => {
        icon.addEventListener('click', function () {
            const t = document.getElementById(this.dataset.target);
            if (t.type === 'password') { t.type = 'text'; this.classList.replace('fa-eye', 'fa-eye-slash'); }
            else { t.type = 'password'; this.classList.replace('fa-eye-slash', 'fa-eye'); }
        });
    });

    const np = document.getElementById('set-new-pass');
    if (np) np.addEventListener('input', function () {
        const val = this.value; let score = 0;
        if (val.length > 5) score++; if (val.length > 8) score++;
        if (/[A-Z]/.test(val)) score++; if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        const bar = document.getElementById('settings-strength-bar');
        let w = '0%', c = 'transparent';
        if (score > 0 && score <= 2) { w = '33%'; c = '#e74c3c'; }
        else if (score > 2 && score <= 4) { w = '66%'; c = '#f1c40f'; }
        else if (score === 5) { w = '100%'; c = '#2ecc71'; }
        bar.style.width = w; bar.style.backgroundColor = c;
    });

    const ttInput = document.getElementById('tt-file-input');
    ttInput.addEventListener('change', e => handleTTFile(e.target.files[0]));
    setupDragDrop('tt-drop-zone', ttInput, handleTTFile);
    const calInput = document.getElementById('cal-file-input');
    calInput.addEventListener('change', e => handleCalFile(e.target.files[0]));
    setupDragDrop('cal-drop-zone', calInput, handleCalFile);

    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('mouseover', () => highlightStars(+star.dataset.val));
        star.addEventListener('mouseleave', () => highlightStars(S.feedbackRating));
        star.addEventListener('click', () => { S.feedbackRating = +star.dataset.val; highlightStars(S.feedbackRating); updateStarLabel(); });
    });
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            S.feedbackMood = btn.dataset.mood;
        });
    });
}

function setupDragDrop(zoneId, input, handler) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handler(file);
    });
}

// ── NAV ──
function switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    document.getElementById('page-title').textContent = TAB_TITLES[tab] || tab;
    if (tab === 'analytics') setTimeout(renderAnalytics, 80);
    if (tab === 'streaks') { renderStreakCalendar(); renderBadges(); }
    if (tab === 'attendance') renderAttendanceBars();
    if (tab === 'settings') loadSettingsUI();
    if (tab === 'feedback') renderFeedbackHistory();
    if (tab === 'timetable') restoreTTResults();
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
}
function toggleTheme() { const dark = document.documentElement.getAttribute('data-theme') === 'dark'; applyTheme(!dark); setTimeout(renderAnalytics, 200); }
function toggleThemeFromSettings(isDark) { applyTheme(isDark); setTimeout(renderAnalytics, 200); }
function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.getElementById('theme-btn').innerHTML = dark ? '<i class="fas fa-sun"></i> Light' : '<i class="fas fa-moon"></i> Dark';
    const tog = document.getElementById('pref-dark-mode');
    if (tog) tog.checked = dark;
}

// ── TOAST ──
function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    t.className = 'toast ' + type;
    t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
}

// ── HOME ──
function updateHomeSummary() {
    if (typeof updateReminderBanner === 'function') updateReminderBanner();
    const done = S.tasks.filter(t => t.done).length;
    document.getElementById('home-streak').textContent = S.streak.count;
    document.getElementById('home-tasks').textContent = done;
    document.getElementById('home-tasks-total').textContent = S.tasks.length;
    document.getElementById('streak-count').textContent = S.streak.count;
    const today = new Date().toISOString().slice(0, 10);
    const tt = S.tasks.filter(t => !t.due || t.due === today).slice(0, 4);
    const c = document.getElementById('home-today-tasks');
    c.innerHTML = tt.length ? tt.map(t => `<div class="task-item ${t.done ? 'done' : ''}"><div class="task-check ${t.done ? 'checked' : ''}">${t.done ? '<i class="fas fa-check"></i>' : ''}</div><span class="task-title">${esc(t.title)}</span><span class="priority-badge p-${t.priority}">${t.priority}</span></div>`).join('') : '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No tasks for today!</p></div>';
    const earned = BADGES.filter(b => S.streak.badges.includes(b.id)).slice(0, 6);
    document.getElementById('home-badges').innerHTML = earned.length ? '<div class="badge-grid" style="grid-template-columns:repeat(3,1fr);">' + earned.map(b => `<div class="badge-card earned"><div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div></div>`).join('') + '</div>' : '<div class="empty-state"><i class="fas fa-medal"></i><p>No badges yet. Keep going!</p></div>';
}
function newQuote() { document.getElementById('quote-text').textContent = '"' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + '"'; }

// ══════════════════════════════════════════════
//  TASKS – Django API
// ══════════════════════════════════════════════
async function addTask() {
    const title = document.getElementById('task-input').value.trim();
    if (!title) return;
    const priority = document.getElementById('task-priority').value;
    const due_date = document.getElementById('task-due').value;

    try {
        const res = await api('POST', '/api/tasks/', { title, priority, due_date: due_date || null });
        if (res?.task) {
            S.tasks.unshift({ id: res.task.id, title: res.task.title, priority: res.task.priority, due: res.task.due_date || '', done: false, created: res.task.created_at?.slice(0, 10) || '', _serverId: res.task.id });
            document.getElementById('task-input').value = '';
            document.getElementById('task-due').value = '';
            renderTaskList(document.querySelector('.filter-tab.active')?.dataset.filter || 'all');
            updateTaskSummary(); updateHomeSummary(); checkBadges();
            showToast('Task added!', 'success');
        }
    } catch (e) { showToast('Failed to add task.', 'error'); }
}

async function toggleTask(id) {
    const task = S.tasks.find(t => t.id === id);
    if (!task) return;
    const newState = !task.done;
    try {
        await api('PATCH', `/api/tasks/${id}/`, { is_completed: newState });
        task.done = newState;
        renderTaskList(document.querySelector('.filter-tab.active')?.dataset.filter || 'all');
        updateTaskSummary(); updateHomeSummary(); checkBadges();
    } catch (e) { showToast('Could not update task.', 'error'); }
}

async function deleteTask(id) {
    try {
        await api('DELETE', `/api/tasks/${id}/`);
        S.tasks = S.tasks.filter(t => t.id !== id);
        renderTaskList(document.querySelector('.filter-tab.active')?.dataset.filter || 'all');
        updateTaskSummary(); updateHomeSummary();
    } catch (e) { showToast('Could not delete task.', 'error'); }
}

function renderTaskList(f = 'all') {
    let tasks = [...S.tasks];
    if (f === 'pending') tasks = tasks.filter(t => !t.done);
    else if (f === 'done') tasks = tasks.filter(t => t.done);
    else if (f === 'high') tasks = tasks.filter(t => t.priority === 'high');
    const c = document.getElementById('task-list');
    c.innerHTML = tasks.length ? tasks.map(t => `<div class="task-item ${t.done ? 'done' : ''}"><div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask(${t.id})">${t.done ? '<i class="fas fa-check"></i>' : ''}</div><span class="task-title">${esc(t.title)}</span><div class="task-meta"><span class="priority-badge p-${t.priority}">${t.priority}</span>${t.due ? `<span class="task-due"><i class="fas fa-clock"></i> ${t.due}</span>` : ''}</div><button class="task-del" onclick="deleteTask(${t.id})"><i class="fas fa-trash"></i></button></div>`).join('') : '<div class="empty-state"><i class="fas fa-tasks"></i><p>No tasks found.</p></div>';
}
function updateTaskSummary() { const d = S.tasks.filter(t => t.done).length; document.getElementById('task-summary').textContent = `${d} of ${S.tasks.length} done`; }

// ══════════════════════════════════════════════
//  NOTES (Practice Log) – Django API
// ══════════════════════════════════════════════
async function saveNote() {
    const content = document.getElementById('note-content').value.trim();
    if (!content) return;
    const title = document.getElementById('note-title-input').value.trim() || 'Untitled';
    const category = document.getElementById('note-category').value.trim() || 'General';

    try {
        const res = await api('POST', '/api/notes/', { title, category, content });
        if (res?.note) {
            S.notes.unshift({ id: res.note.id, title: res.note.title, category: res.note.category, content: res.note.content, date: new Date(res.note.created_at).toLocaleDateString(), _serverId: res.note.id });
            clearNote(); renderNoteList(); checkBadges();
            showToast('Entry saved! 📖', 'success');
        }
    } catch (e) { showToast('Failed to save note.', 'error'); }
}
function clearNote() { document.getElementById('note-title-input').value = ''; document.getElementById('note-content').value = ''; document.getElementById('note-category').value = ''; }
function renderNoteList() {
    const c = document.getElementById('note-list-container');
    c.innerHTML = S.notes.length ? '<div class="note-list">' + S.notes.slice(0, 10).map(n => `<div class="note-entry"><div class="note-entry-header"><div style="display:flex;gap:5px;align-items:center;"><span class="note-tag">📝 ${esc(n.category)}</span><span style="font-size:0.82rem;font-weight:600;">${esc(n.title)}</span></div><span class="note-date">${n.date}</span></div><div style="color:var(--muted);">${esc(n.content.slice(0, 120))}${n.content.length > 120 ? '…' : ''}</div></div>`).join('') + '</div>' : '<div class="empty-state"><i class="fas fa-journal-whills"></i><p>No entries yet. Start writing!</p></div>';
}

function syncEmptyHints() {
    const attHint = document.getElementById('att-empty-hint');
    const cgpaHint = document.getElementById('cgpa-empty-hint');
    if (attHint) attHint.style.display = S.attendance.length === 0 ? 'block' : 'none';
    if (cgpaHint) cgpaHint.style.display = S.marks.length === 0 ? 'block' : 'none';
}

// ══════════════════════════════════════════════
//  ATTENDANCE – Django API
// ══════════════════════════════════════════════
function renderAttTable() {
    document.getElementById('att-tbody').innerHTML = S.attendance.map((r, i) => `<tr>
        <td><input type="text" value="${esc(r.sub)}" onchange="S.attendance[${i}].sub=this.value" style="width:100%;padding:4px 7px;border:1px solid var(--border);border-radius:6px;background:var(--glass-bg);color:var(--text-color);font-size:0.83rem;outline:none;"></td>
        <td><input type="number" value="${r.held}" min="0" onchange="S.attendance[${i}].held=+this.value;updateAttPct(${i})" style="width:65px;padding:4px 7px;border:1px solid var(--border);border-radius:6px;background:var(--glass-bg);color:var(--text-color);font-size:0.83rem;outline:none;"></td>
        <td><input type="number" value="${r.attended}" min="0" onchange="S.attendance[${i}].attended=+this.value;updateAttPct(${i})" style="width:65px;padding:4px 7px;border:1px solid var(--border);border-radius:6px;background:var(--glass-bg);color:var(--text-color);font-size:0.83rem;outline:none;"></td>
        <td id="att-pct-${i}" style="font-weight:700;">${r.held > 0 ? Math.round(r.attended / r.held * 100) : 0}%</td>
        <td><button class="task-del" onclick="removeAttRow(${i})"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
    syncEmptyHints();
}
function updateAttPct(i) { const r = S.attendance[i]; const el = document.getElementById('att-pct-' + i); if (el) el.textContent = (r.held > 0 ? Math.round(r.attended / r.held * 100) : 0) + '%'; }
function addAttSubject() { S.attendance.push({ sub: 'New Subject', held: 30, attended: 25 }); renderAttTable(); }
function removeAttRow(i) { S.attendance.splice(i, 1); renderAttTable(); renderAttendanceBars(); }

async function saveAttendance() {
    try {
        const records = S.attendance.map(a => ({ subject: a.sub, classes_held: a.held, classes_attended: a.attended }));
        const res = await api('POST', '/api/attendance/', { records });
        if (res?.attendance) {
            S.attendance = res.attendance.map(a => ({ sub: a.subject, held: a.classes_held, attended: a.classes_attended, _serverId: a.id }));
            renderAttTable();
        }
        renderAttendanceBars(); updateHomeSummary(); showToast('Attendance saved! ✅', 'success'); checkAttendanceAlerts();
    } catch (e) { showToast('Failed to save attendance.', 'error'); }
}

function renderAttendanceBars() {
    let tot = 0;
    const withData = S.attendance.filter(r => r.held > 0);
    document.getElementById('att-bars').innerHTML = S.attendance.map(r => {
        const p = r.held > 0 ? Math.round(r.attended / r.held * 100) : 0; tot += p;
        const cls = p >= 75 ? 'good' : p >= 65 ? 'warn' : 'bad';
        return `<div class="att-row"><span class="att-sub">${esc(r.sub)}</span><div class="att-bar-wrap"><div class="att-bar-fill ${cls}" style="width:${p}%"></div></div><span class="att-pct" style="color:${p >= 75 ? 'var(--success)' : p >= 65 ? 'var(--warning)' : 'var(--error)'}">${p}%</span></div>`;
    }).join('');
    const avg = S.attendance.length > 0 ? Math.round(tot / S.attendance.length) : 0;
    document.getElementById('home-att').textContent = withData.length > 0 ? avg + '%' : '—';
    const sub = document.getElementById('home-att-sub');
    if (withData.length === 0) { sub.textContent = 'Update records'; sub.className = 'stat-sub sub-yellow'; }
    else if (avg >= 75) { sub.textContent = '✅ Good standing'; sub.className = 'stat-sub sub-green'; }
    else if (avg >= 65) { sub.textContent = '⚠️ At risk'; sub.className = 'stat-sub sub-yellow'; }
    else { sub.textContent = '🚨 Critical'; sub.className = 'stat-sub sub-red'; }
    if (S.attendance.length === 0) {
        document.getElementById('att-prediction').innerHTML = '<span style="color:var(--muted);">Add subjects and enter attendance data to see predictions.</span>';
    } else if (withData.length === 0) {
        document.getElementById('att-prediction').innerHTML = '<span style="color:var(--muted);">⏳ Enter values above, then click Save.</span>';
    } else {
        document.getElementById('att-prediction').innerHTML = withData.map(r => {
            const p = Math.round(r.attended / r.held * 100);
            if (p >= 75) { const canSkip = Math.floor((r.attended - 0.75 * r.held) / 0.75); return `<div style="margin-bottom:4px;">✅ <strong>${esc(r.sub)}</strong>: ${p}% — Good standing. Can skip <strong>${Math.max(0, canSkip)}</strong> more class${canSkip === 1 ? '' : 'es'}.</div>`; }
            else { const n = Math.ceil((0.75 * r.held - r.attended) / (1 - 0.75)); return `<div style="margin-bottom:4px;">⚠️ <strong>${esc(r.sub)}</strong>: ${p}% — Need <strong>${Math.max(0, n)} more consecutive</strong> class${n === 1 ? '' : 'es'} to reach 75%.</div>`; }
        }).join('');
    }
}

// ── CGPA ──
function renderMarksTable() {
    document.getElementById('marks-tbody').innerHTML = S.marks.map((r, i) => `<tr>
        <td><input type="text" value="${esc(r.sub)}" onchange="S.marks[${i}].sub=this.value" style="width:115px;padding:4px 7px;border:1px solid var(--border);border-radius:6px;background:var(--glass-bg);color:var(--text-color);font-size:0.83rem;outline:none;"></td>
        <td><input type="number" value="${r.max}" min="0" max="100" onchange="S.marks[${i}].max=Math.min(100,Math.max(0,+this.value));this.value=S.marks[${i}].max"></td>
        <td><input type="number" value="${r.obt}" min="0" max="100" onchange="S.marks[${i}].obt=Math.min(100,Math.max(0,+this.value));this.value=S.marks[${i}].obt"></td>
        <td><input type="number" value="${r.credits !== '' ? r.credits : ''}" min="1" max="4" onchange="S.marks[${i}].credits=Math.min(4,Math.max(1,+this.value));this.value=S.marks[${i}].credits"></td>
        <td><button class="task-del" onclick="S.marks.splice(${i},1);renderMarksTable();"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
    syncEmptyHints();
}
function addMarkRow() { S.marks.push({ sub: 'New Subject', max: 100, obt: 0, credits: 3 }); renderMarksTable(); }

async function calcCGPA() {
    let tp = 0, tc = 0;
    S.marks.forEach(r => { if (r.max > 0) { const p = r.obt / r.max * 100; const g = p >= 90 ? 10 : p >= 80 ? 9 : p >= 70 ? 8 : p >= 60 ? 7 : p >= 50 ? 6 : p >= 45 ? 5 : p >= 40 ? 4 : 0; tp += g * r.credits; tc += r.credits; } });
    const c = tc > 0 ? (tp / tc).toFixed(2) : null;
    document.getElementById('cgpa-val').textContent = c || '—';
    if (c) {
        document.getElementById('cgpa-dial').style.background = `conic-gradient(var(--primary) 0deg,var(--primary) ${(c / 10) * 360}deg,var(--border) ${(c / 10) * 360}deg)`;
        document.getElementById('cgpa-feedback').textContent = ['Keep pushing hard!', 'You can do better!', 'Good performance!', 'Very good! Almost excellent.', 'Outstanding! 🎉'][c < 5 ? 0 : c < 6 ? 1 : c < 7 ? 2 : c < 9 ? 3 : 4];
        const g = c >= 9 ? 'O (Outstanding)' : c >= 8 ? 'A+ (Excellent)' : c >= 7 ? 'A (Very Good)' : c >= 6 ? 'B+ (Good)' : c >= 5 ? 'B (Average)' : 'C (Below Average)';
        const el = document.getElementById('cgpa-grade'); el.textContent = 'Grade: ' + g; el.className = 'stat-sub ' + (c >= 7 ? 'sub-green' : c >= 5 ? 'sub-yellow' : 'sub-red');
        document.getElementById('home-cgpa').textContent = c; document.getElementById('home-cgpa-sub').textContent = g;
    }
    // Save marks to server
    const records = S.marks.map(m => ({ subject: m.sub, max_marks: +m.max || 100, obtained_marks: +m.obt || 0, credits: +m.credits || 3 }));
    api('POST', '/api/marks/', { records });
}

// ── STREAKS ──
function logToday() {
    const today = new Date().toISOString().slice(0, 10);
    if (S.streak.logged.includes(today)) { showToast('Already logged today! Come back tomorrow. 🔥', 'info'); return; }
    S.streak.logged.push(today);
    let streak = 1;
    const sd = [...S.streak.logged].sort().reverse();
    for (let i = 1; i < sd.length; i++) { const d = (new Date(sd[i - 1]) - new Date(sd[i])) / 86400000; if (d === 1) streak++; else break; }
    S.streak.count = streak; S.streak.best = Math.max(S.streak.best, streak);
    checkBadges(); updateStreakUI(); renderStreakCalendar(); saveStreak();
    showToast(`🔥 Logged! Streak: ${streak} days`, 'success');
}
function updateStreakUI() {
    ['cur-streak', 'best-streak'].forEach((id, i) => document.getElementById(id).textContent = i === 0 ? S.streak.count : S.streak.best);
    document.getElementById('home-streak').textContent = S.streak.count;
    document.getElementById('streak-count').textContent = S.streak.count;
}
function renderStreakCalendar() {
    const today = new Date(), days = [];
    for (let i = 27; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
    const ts = today.toISOString().slice(0, 10);
    document.getElementById('streak-cal').innerHTML = days.map(d => `<div class="streak-day ${S.streak.logged.includes(d) ? 'logged' : ''} ${d === ts ? 'today' : ''}" title="${d}">${new Date(d).getDate()}</div>`).join('');
}
function checkBadges() {
    const done = S.tasks.filter(t => t.done).length;
    if (S.streak.count >= 3) awardBadge('streak_3');
    if (S.streak.count >= 7) awardBadge('streak_7');
    if (S.streak.count >= 14) awardBadge('streak_14');
    if (S.streak.count >= 30) awardBadge('streak_30');
    if (done >= 10) awardBadge('task_10');
    if (S.notes.length >= 5) awardBadge('notes_5');
    if (S.assessmentDone) awardBadge('assess_done');
    document.getElementById('earned-badges-count').textContent = S.streak.badges.length;
    updateHomeSummary();
}
function awardBadge(id) {
    if (!S.streak.badges.includes(id)) {
        S.streak.badges.push(id);
        saveStreak();
    }
}
function renderBadges() {
    document.getElementById('badge-grid').innerHTML = BADGES.map(b => `<div class="badge-card ${S.streak.badges.includes(b.id) ? 'earned' : ''}"><div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div><div style="font-size:0.63rem;color:var(--muted);margin-top:2px;">${b.desc}</div></div>`).join('');
    document.getElementById('earned-badges-count').textContent = S.streak.badges.length;
}

// ── SOFT SKILLS ──
function startAssessment() {
    S.currentQ = 0; S.quizAnswers = new Array(QS.length).fill(null);
    document.getElementById('skills-intro').style.display = 'none';
    document.getElementById('skills-quiz').style.display = 'block';
    document.getElementById('skills-result').style.display = 'none';
    renderQ();
}
function renderQ() {
    const q = QS[S.currentQ], total = QS.length, saved = S.quizAnswers[S.currentQ];
    document.getElementById('quiz-category-chip').textContent = q.cat;
    document.getElementById('quiz-q-num').textContent = `Question ${S.currentQ + 1} of ${total}`;
    document.getElementById('quiz-q-text').textContent = q.text;
    document.getElementById('quiz-progress-fill').style.width = ((S.currentQ + 1) / total * 100) + '%';
    const prev = document.getElementById('quiz-prev'); prev.disabled = S.currentQ === 0; prev.style.opacity = S.currentQ === 0 ? '0.4' : '1';
    document.getElementById('quiz-next').innerHTML = S.currentQ === total - 1 ? 'Submit <i class="fas fa-check"></i>' : 'Next <i class="fas fa-arrow-right"></i>';
    const opt = document.getElementById('quiz-options-container');
    if (q.type === 'mcq') opt.innerHTML = `<div class="quiz-options">${q.opts.map((o, i) => `<div class="quiz-option ${saved === i ? 'selected' : ''}" onclick="selMCQ(${i})">${o}</div>`).join('')}</div>`;
    else if (q.type === 'rating') opt.innerHTML = `<div><p style="font-size:0.78rem;color:var(--muted);margin-bottom:0.55rem;">1 = Very Poor · 10 = Excellent</p><div class="rating-row">${Array.from({ length: 10 }, (_, i) => `<button class="rating-btn ${saved === i + 1 ? 'selected' : ''}" onclick="selRating(${i + 1})">${i + 1}</button>`).join('')}</div></div>`;
    else opt.innerHTML = `<textarea class="quiz-short" rows="3" placeholder="Write your answer..." onchange="selShort(this.value)">${saved || ''}</textarea>`;
    document.getElementById('quiz-dots').innerHTML = QS.map((_, i) => `<div style="width:7px;height:7px;border-radius:50%;background:${i === S.currentQ ? 'var(--primary)' : S.quizAnswers[i] != null ? 'var(--success)' : 'var(--border)'}"></div>`).join('');
}
function selMCQ(i) { S.quizAnswers[S.currentQ] = i; renderQ(); }
function selRating(v) { S.quizAnswers[S.currentQ] = v; renderQ(); }
function selShort(v) { S.quizAnswers[S.currentQ] = v || ''; }
function nextQ() { if (S.currentQ < QS.length - 1) { S.currentQ++; renderQ(); } else finishAssessment(); }
function prevQ() { if (S.currentQ > 0) { S.currentQ--; renderQ(); } }

async function finishAssessment() {
    const cm = { Communication: [0, 1, 2], Teamwork: [3, 4, 5], 'Time Management': [6, 7, 8], 'Problem Solving': [9, 10, 11] };
    const sk = ['communication', 'teamwork', 'timeManagement', 'problemSolving'];
    const cn = ['Communication', 'Teamwork', 'Time Management', 'Problem Solving'];
    cn.forEach((cat, ci) => {
        let s = 0, c = 0; cm[cat].forEach(qi => {
            const a = S.quizAnswers[qi], q = QS[qi];
            if (q.type === 'rating' && typeof a === 'number') { s += a * 10; c++; }
            else if (q.type === 'mcq' && a !== null) { s += [100, 75, 25, 50][a] || 50; c++; }
            else if (q.type === 'short' && a) { s += 70; c++; }
        });
        S.skills[sk[ci]] = c > 0 ? Math.round(s / c) : 0;
    });
    S.assessmentDone = true; checkBadges();

    // Save to server
    await api('POST', '/api/skills/', {
        skills: {
            communication: S.skills.communication,
            teamwork: S.skills.teamwork,
            time_management: S.skills.timeManagement,
            problem_solving: S.skills.problemSolving
        }
    });

    document.getElementById('skills-quiz').style.display = 'none';
    document.getElementById('skills-result').style.display = 'block';
    document.getElementById('skill-result-grid').innerHTML = cn.map((cat, i) => { const v = S.skills[sk[i]]; return `<div class="skill-result-item"><div class="skill-name">${cat}</div><div class="skill-bar-wrap"><div class="skill-bar-fill" style="width:${v}%"></div></div><div class="skill-pct">${v}%</div></div>`; }).join('');
    if (S.charts.skills) S.charts.skills.destroy();
    const ctx = document.getElementById('skills-chart').getContext('2d');
    const tc = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#333';
    S.charts.skills = new Chart(ctx, { type: 'radar', data: { labels: cn, datasets: [{ label: 'Skills', data: sk.map(k => S.skills[k]), backgroundColor: 'rgba(74,144,226,0.18)', borderColor: 'rgba(74,144,226,0.8)', pointBackgroundColor: 'rgba(74,144,226,1)', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: 'rgba(128,128,128,0.14)' }, pointLabels: { color: tc } } }, plugins: { legend: { display: false } } } });
    showToast('Skills assessment saved! 🧠', 'success');
}
function retakeAssessment() { document.getElementById('skills-result').style.display = 'none'; document.getElementById('skills-intro').style.display = 'block'; }

let _currentUtterance = null;
function readQuestion() {
    if (!('speechSynthesis' in window)) { showToast('Voice not supported.', 'error'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(QS[S.currentQ].text);
    u.rate = parseFloat(document.getElementById('pref-voice-speed')?.value || S.prefs.voiceSpeed || 0.9);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith('en') && v.localService) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (preferred) u.voice = preferred;
    const btn = document.getElementById('voice-btn');
    if (btn) btn.classList.add('speaking');
    u.onend = u.onerror = () => { if (btn) btn.classList.remove('speaking'); _currentUtterance = null; };
    _currentUtterance = u;
    window.speechSynthesis.speak(u);
}

// ── ANALYTICS ──
function renderAnalytics() {
    const done = S.tasks.filter(t => t.done).length, pending = S.tasks.length - done;
    if (S.charts.pie) S.charts.pie.destroy();
    const tc2 = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#333';
    const tc = document.getElementById('task-pie-chart');
    if (tc) { S.charts.pie = new Chart(tc, { type: 'doughnut', data: { labels: ['Completed', 'Pending'], datasets: [{ data: [done || 1, pending], backgroundColor: ['rgba(46,204,113,0.8)', 'rgba(74,144,226,0.4)'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc2, padding: 10, font: { size: 11 } } } } } }); }
    document.getElementById('weekly-summary-grid').innerHTML = [
        { l: 'Tasks Done', v: S.tasks.filter(t => t.done).length, e: '✅' },
        { l: 'Notes Logged', v: S.notes.length, e: '📖' },
        { l: 'Current Streak', v: S.streak.count, e: '🔥' },
        { l: 'Badges Earned', v: S.streak.badges.length, e: '🏆' }
    ].map(s => `<div class="card stat-card" style="padding:1rem;"><div style="font-size:1.4rem;">${s.e}</div><div class="stat-value" style="font-size:1.45rem;">${s.v}</div><div class="stat-label">${s.l}</div></div>`).join('');
    updateMainChart('scores');
}
function updateMainChart(type) {
    const titles = { scores: 'Score Trend', attendance: 'Attendance %', streaks: 'Login Activity', skills: 'Skill Scores' };
    document.getElementById('main-chart-title').textContent = titles[type] || '';
    if (S.charts.main) S.charts.main.destroy();
    const ctx = document.getElementById('main-analytics-chart');
    const tc = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#333';
    const baseOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: tc }, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { ticks: { color: tc }, grid: { display: false } } } };
    let cfg;
    if (type === 'scores') { cfg = { type: 'bar', data: { labels: S.marks.map(m => m.sub.split(' ')[0]), datasets: [{ label: 'Score %', data: S.marks.map(m => m.max > 0 ? Math.round(m.obt / m.max * 100) : 0), backgroundColor: 'rgba(74,144,226,0.72)', borderRadius: 6, borderSkipped: false }] }, options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, min: 0, max: 100 } } } }; }
    else if (type === 'attendance') { cfg = { type: 'bar', data: { labels: S.attendance.map(a => a.sub.split(' ')[0]), datasets: [{ label: 'Attendance %', data: S.attendance.map(a => a.held > 0 ? Math.round(a.attended / a.held * 100) : 0), backgroundColor: S.attendance.map(a => { const p = a.held > 0 ? Math.round(a.attended / a.held * 100) : 0; return p >= 75 ? 'rgba(46,204,113,0.72)' : p >= 65 ? 'rgba(243,156,18,0.72)' : 'rgba(231,76,60,0.72)'; }), borderRadius: 6, borderSkipped: false }] }, options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, min: 0, max: 100 } } } }; }
    else if (type === 'streaks') { const today = new Date(); const ls = [], ds = []; for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); const s = d.toISOString().slice(0, 10); ls.push(d.toLocaleDateString('en', { weekday: 'short' })); ds.push(S.streak.logged.includes(s) ? 1 : 0); } cfg = { type: 'bar', data: { labels: ls, datasets: [{ label: 'Logged', data: ds, backgroundColor: ds.map(v => v ? 'rgba(74,144,226,0.8)' : 'rgba(128,128,128,0.15)'), borderRadius: 6, borderSkipped: false }] }, options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, min: 0, max: 1, ticks: { display: false } } } } }; }
    else { cfg = { type: 'bar', data: { labels: ['Communication', 'Teamwork', 'Time Mgmt', 'Problem Solving'], datasets: [{ label: 'Score', data: [S.skills.communication, S.skills.teamwork, S.skills.timeManagement, S.skills.problemSolving], backgroundColor: 'rgba(118,75,162,0.72)', borderRadius: 6, borderSkipped: false }] }, options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, min: 0, max: 100 } } } }; }
    S.charts.main = new Chart(ctx, cfg);
}

// ── TIMETABLE / CALENDAR (OCR stays client-side, no change needed) ──
function fileToBase64(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
}
function handleTTFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('tt-preview-img').src = e.target.result; document.getElementById('tt-preview-wrap').style.display = 'block'; document.getElementById('tt-drop-zone').style.display = 'none'; };
    reader.readAsDataURL(file);
    fileToBase64(file).then(b64 => { S.tt.base64 = b64; });
}
function handleCalFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('cal-preview-img').src = e.target.result; document.getElementById('cal-preview-wrap').style.display = 'block'; document.getElementById('cal-drop-zone').style.display = 'none'; };
    reader.readAsDataURL(file);
    fileToBase64(file).then(b64 => { S.cal.base64 = b64; });
}
function clearTTUpload() { S.tt = { base64: null, results: null }; document.getElementById('tt-preview-wrap').style.display = 'none'; document.getElementById('tt-drop-zone').style.display = 'block'; document.getElementById('tt-results').style.display = 'none'; document.getElementById('tt-file-input').value = ''; }
function clearCalUpload() { S.cal = { base64: null, results: null }; document.getElementById('cal-preview-wrap').style.display = 'none'; document.getElementById('cal-drop-zone').style.display = 'block'; document.getElementById('cal-results').style.display = 'none'; document.getElementById('cal-file-input').value = ''; }

const OCR_API_KEY = 'K84895014788957';
async function analyzeTimetable() {
    if (!S.tt.base64) { showToast('Please upload a timetable image first.', 'error'); return; }
    const loading = document.getElementById('tt-loading'); const wrap = document.getElementById('tt-preview-wrap');
    loading.style.display = 'flex'; wrap.style.display = 'none';
    try {
        const formData = new FormData(); formData.append('base64Image', `data:image/jpeg;base64,${S.tt.base64}`); formData.append('apikey', OCR_API_KEY); formData.append('isOverlayRequired', 'false'); formData.append('filetype', 'jpg');
        const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.OCRExitCode !== 1) throw new Error(data.ErrorMessage || 'OCR Failed');
        const subjects = parseSubjectsFromText(data.ParsedResults[0].ParsedText);
        if (subjects.length === 0) { showToast('No subjects detected. Try a clearer image or add manually.', 'info'); }
        else { openOCRVerificationModal(subjects, 'timetable'); }
    } catch (e) { showToast('Error: ' + (e.message || 'OCR failed'), 'error'); }
    finally { loading.style.display = 'none'; document.getElementById('tt-preview-wrap').style.display = 'block'; }
}
async function analyzeCalendar() {
    if (!S.cal.base64) { showToast('Please upload a calendar image first.', 'error'); return; }
    const loading = document.getElementById('cal-loading'); const wrap = document.getElementById('cal-preview-wrap');
    loading.style.display = 'flex'; wrap.style.display = 'none';
    try {
        const formData = new FormData(); formData.append('base64Image', `data:image/jpeg;base64,${S.cal.base64}`); formData.append('apikey', OCR_API_KEY); formData.append('isOverlayRequired', 'false'); formData.append('filetype', 'jpg');
        const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.OCRExitCode !== 1) throw new Error(data.ErrorMessage || 'OCR Failed');
        const events = parseEventsFromText(data.ParsedResults[0].ParsedText);
        if (events.length === 0) { showToast('No events detected in the image.', 'info'); }
        else { openOCRVerificationModal(events, 'calendar'); }
    } catch (e) { showToast('Error: ' + (e.message || 'OCR failed'), 'error'); }
    finally { loading.style.display = 'none'; document.getElementById('cal-preview-wrap').style.display = 'block'; }
}
function parseSubjectsFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    const commonWords = ['time', 'date', 'room', 'batch', 'sem', 'faculty', 'professor', 'lec', 'lab'];
    return Array.from(new Set(lines.filter(line => /[A-Za-z]{3,}/.test(line) && !commonWords.some(w => line.toLowerCase().includes(w))).map(l => l))).map(name => ({ name, type: 'subject' }));
}
function parseEventsFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    const dateRegex = /(\d{1,2}[\/\-\.\s]([A-Za-z]{3}|\d{1,2})[\/\-\.\s]?\d{0,4})/;
    const events = [];
    lines.forEach(line => { const match = line.match(dateRegex); if (match) { const date = match[0]; const name = line.replace(date, '').trim().replace(/^[^\w]+|[^\w]+$/g, ''); if (name.length > 3) events.push({ name, sub: date, type: 'event' }); } });
    return events;
}
function openOCRVerificationModal(items, source) { S.ocrPending = items.map((it, idx) => ({ ...it, id: idx, source })); renderOCRItems(); document.getElementById('ocr-modal').style.display = 'flex'; }
function renderOCRItems() {
    document.getElementById('ocr-items-container').innerHTML = S.ocrPending.map(it => `<div class="ocr-item" id="ocr-item-${it.id}"><div class="ocr-item-icon"><i class="fas ${it.type === 'subject' ? 'fa-book' : 'fa-calendar-day'}"></i></div><div class="ocr-item-info"><input type="text" class="ocr-item-title" value="${esc(it.name)}" onchange="updateOCRItem(${it.id}, this.value)"><div class="ocr-item-sub">${esc(it.sub || (it.type === 'subject' ? 'New Subject' : 'Academic Event'))}</div></div><button class="ocr-item-del" onclick="deleteOCRItem(${it.id})"><i class="fas fa-trash"></i></button></div>`).join('');
}
function updateOCRItem(id, val) { const it = S.ocrPending.find(x => x.id === id); if (it) it.name = val; }
function deleteOCRItem(id) { S.ocrPending = S.ocrPending.filter(x => x.id !== id); renderOCRItems(); if (S.ocrPending.length === 0) closeOCRModal(); }
function closeOCRModal() { document.getElementById('ocr-modal').style.display = 'none'; S.ocrPending = []; }
async function confirmOCRDetails() {
    if (S.ocrPending.length === 0) return;
    let subCount = 0, taskCount = 0;
    const newSubjects = S.ocrPending.filter(it => it.type === 'subject');
    const newEvents = S.ocrPending.filter(it => it.type === 'event');
    if (newSubjects.length > 0) { S.attendance = []; S.marks = []; }
    newSubjects.forEach(it => { const name = it.name.trim(); if (!name) return; S.attendance.push({ sub: name, held: 0, attended: 0 }); S.marks.push({ sub: name, max: 100, obt: 0, credits: 3 }); subCount++; });
    for (const it of newEvents) {
        try {
            const res = await api('POST', '/api/tasks/', { title: it.name, priority: 'medium', due_date: formatToIsoDate(it.sub) || null });
            if (res?.task) { S.tasks.unshift({ id: res.task.id, title: res.task.title, priority: res.task.priority, due: res.task.due_date || '', done: false, created: res.task.created_at?.slice(0, 10) || '', _serverId: res.task.id }); taskCount++; }
        } catch (e) { }
    }
    if (subCount > 0) { renderAttTable(); renderAttendanceBars(); renderMarksTable(); calcCGPA(); }
    if (taskCount > 0) renderTaskList('all');
    updateHomeSummary(); closeOCRModal();
    let msg = '';
    if (subCount > 0) msg += `✅ ${subCount} subjects added. `;
    if (taskCount > 0) msg += `📅 ${taskCount} events added to tasks. `;
    showToast(msg || 'Details confirmed!', 'success');
}
function formatToIsoDate(text) { try { const d = new Date(text); if (isNaN(d.getTime())) return ''; return d.toISOString().slice(0, 10); } catch (e) { return ''; } }
function restoreTTResults() {
    if (S.tt.base64) { document.getElementById('tt-preview-img').src = `data:image/jpeg;base64,${S.tt.base64}`; document.getElementById('tt-preview-wrap').style.display = 'block'; document.getElementById('tt-drop-zone').style.display = 'none'; }
    if (S.cal.base64) { document.getElementById('cal-preview-img').src = `data:image/jpeg;base64,${S.cal.base64}`; document.getElementById('cal-preview-wrap').style.display = 'block'; document.getElementById('cal-drop-zone').style.display = 'none'; }
}
function tryShowCombined() { }

// ══════════════════════════════════════════════
//  FEEDBACK – Django API
// ══════════════════════════════════════════════
function highlightStars(val) { document.querySelectorAll('.star').forEach(s => s.classList.toggle('active', +s.dataset.val <= val)); }
function updateStarLabel() { const labels = ['', '😞 Poor', '😕 Below Average', '😐 Average', '😊 Good', '🤩 Excellent!']; document.getElementById('star-label').textContent = labels[S.feedbackRating] || ''; }

async function submitFeedback() {
    const message = document.getElementById('fb-message').value.trim();
    if (!message) { showToast('Please write a message.', 'error'); return; }
    if (!S.feedbackRating) { showToast('Please give a star rating.', 'error'); return; }
    if (!S.feedbackMood) { showToast('Please select your mood.', 'error'); return; }

    try {
        const res = await api('POST', '/api/feedback/', {
            rating: S.feedbackRating,
            mood: S.feedbackMood,
            category: document.getElementById('fb-category').value,
            subject: document.getElementById('fb-subject').value.trim() || 'General Feedback',
            message
        });
        if (res?.feedback) {
            S.feedbacks.unshift({ ...res.feedback, date: new Date(res.feedback.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) });
            S.feedbackRating = 0; S.feedbackMood = '';
            highlightStars(0); document.getElementById('star-label').textContent = '';
            document.getElementById('fb-subject').value = ''; document.getElementById('fb-message').value = '';
            document.getElementById('fb-category').value = 'general';
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
            renderFeedbackHistory(); showToast('Feedback submitted! Thank you 🙏', 'success');
        }
    } catch (e) { showToast('Failed to submit feedback.', 'error'); }
}

function renderFeedbackHistory() {
    const el = document.getElementById('feedback-list');
    const moodEmoji = { love: '😍', happy: '😊', neutral: '😐', sad: '😕', frustrated: '😤' };
    const catIcon = { general: '💬', bug: '🐛', feature: '✨', ui: '🎨', performance: '⚡' };
    if (!S.feedbacks.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>No feedback submitted yet.</p></div>'; updateFeedbackStats(); return; }
    el.innerHTML = `<div class="feedback-history-scroll">${S.feedbacks.slice(0, 10).map(f => `<div class="feedback-entry"><div class="feedback-entry-header"><div style="display:flex;align-items:center;gap:6px;"><span class="fb-cat-badge">${catIcon[f.category] || '💬'} ${f.category}</span><span style="font-size:0.9rem;">${moodEmoji[f.mood] || ''}</span></div><div style="display:flex;align-items:center;gap:8px;"><span class="fb-stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span><span class="fb-date">${f.date}</span></div></div><div style="font-weight:600;font-size:0.82rem;margin-bottom:3px;">${esc(f.subject)}</div><div class="fb-entry-body">${esc(f.message.slice(0, 130))}${f.message.length > 130 ? '…' : ''}</div></div>`).join('')}</div>`;
    updateFeedbackStats();
}
function updateFeedbackStats() {
    const fb = S.feedbacks;
    document.getElementById('fb-count').textContent = fb.length;
    if (fb.length) {
        document.getElementById('fb-avg-rating').textContent = (fb.reduce((a, f) => a + f.rating, 0) / fb.length).toFixed(1);
        const catCounts = {}; fb.forEach(f => catCounts[f.category] = (catCounts[f.category] || 0) + 1);
        const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
        document.getElementById('fb-top-cat').textContent = topCat ? topCat[0] : '—';
        const moodCounts = {}; fb.forEach(f => moodCounts[f.mood] = (moodCounts[f.mood] || 0) + 1);
        const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
        const moodEmoji = { love: '😍', happy: '😊', neutral: '😐', sad: '😕', frustrated: '😤' };
        document.getElementById('fb-top-mood').textContent = topMood ? moodEmoji[topMood[0]] || topMood[0] : '—';
    }
}

// ══════════════════════════════════════════════
//  SETTINGS – Django API
// ══════════════════════════════════════════════
function loadSettingsUI() {
    const u = S.user;
    if (!u) return;
    const fields = { 'set-fullname': 'fullname', 'set-email': 'email', 'set-phone': 'phone', 'set-dob': 'dob', 'set-gender': 'gender', 'set-address': 'address', 'set-course': 'course' };
    Object.entries(fields).forEach(([id, key]) => { const el = document.getElementById(id); if (el && u[key]) el.value = u[key]; });
    const name = u.fullname || 'Student';
    const av = document.getElementById('settings-avatar'); if (av) av.textContent = name.charAt(0).toUpperCase();
    const dn = document.getElementById('settings-display-name'); if (dn) dn.textContent = name;
    const de = document.getElementById('settings-display-email'); if (de) de.textContent = u.email || '';
    const dc = document.getElementById('settings-display-course'); if (dc) dc.textContent = u.course ? u.course.toUpperCase() + (u.branch ? ' · ' + u.branch : '') : '';
}

async function saveProfileSettings() {
    const payload = {
        fullname: document.getElementById('set-fullname').value.trim(),
        email: document.getElementById('set-email').value.trim(),
        phone: document.getElementById('set-phone').value.trim(),
        dob: document.getElementById('set-dob').value,
        gender: document.getElementById('set-gender').value,
        address: document.getElementById('set-address').value.trim(),
        course: document.getElementById('set-course').value,
    };

    try {
        const res = await api('POST', '/api/profile/', payload);
        if (res?.success) {
            Object.assign(S.user, payload);
            const name = payload.fullname || 'Student';
            document.getElementById('welcome-name').textContent = name.split(' ')[0];
            document.getElementById('sb-name').textContent = name;
            document.getElementById('sb-avatar').textContent = name.charAt(0).toUpperCase();
            loadSettingsUI();
            const msg = document.getElementById('profile-save-msg');
            msg.textContent = '✅ Profile updated successfully!'; msg.style.color = 'var(--success)';
            setTimeout(() => { msg.textContent = ''; }, 3000);
            showToast('Profile saved!', 'success');
        } else {
            showToast(res?.error || 'Could not save profile.', 'error');
        }
    } catch (e) { showToast('Network error.', 'error'); }
}

async function resetPassword() {
    const curPass = document.getElementById('set-cur-pass').value;
    const newPass = document.getElementById('set-new-pass').value;
    const confPass = document.getElementById('set-confirm-pass').value;
    const msg = document.getElementById('pass-msg');

    if (!curPass || !newPass || !confPass) { msg.textContent = 'Please fill all fields.'; msg.style.color = 'var(--error)'; return; }
    if (newPass.length < 6) { msg.textContent = 'New password must be at least 6 characters.'; msg.style.color = 'var(--error)'; return; }
    if (newPass !== confPass) { msg.textContent = 'New passwords do not match.'; msg.style.color = 'var(--error)'; return; }

    try {
        const res = await api('POST', '/api/change-password/', { current_password: curPass, new_password: newPass });
        if (res?.success) {
            document.getElementById('set-cur-pass').value = ''; document.getElementById('set-new-pass').value = ''; document.getElementById('set-confirm-pass').value = '';
            document.getElementById('settings-strength-bar').style.width = '0%';
            msg.textContent = '✅ Password updated!'; msg.style.color = 'var(--success)';
            setTimeout(() => { msg.textContent = ''; }, 3500);
            showToast('Password updated!', 'success');
        } else {
            msg.textContent = res?.error || 'Failed to update password.'; msg.style.color = 'var(--error)';
        }
    } catch (e) { msg.textContent = 'Network error.'; msg.style.color = 'var(--error)'; }
}

function savePrefs() { S.prefs.voiceSpeed = parseFloat(document.getElementById('pref-voice-speed')?.value || 0.9); S.prefs.attAlert = document.getElementById('pref-att-alert')?.checked || true; }
function loadPrefs() {
    const sp = document.getElementById('pref-voice-speed'); if (sp) sp.value = S.prefs.voiceSpeed || 0.9;
    const aa = document.getElementById('pref-att-alert'); if (aa) aa.checked = S.prefs.attAlert !== false;
    const dm = document.getElementById('pref-dark-mode'); if (dm) dm.checked = document.documentElement.getAttribute('data-theme') === 'dark';
}

async function confirmClearData() {
    if (!confirm('Are you sure you want to clear ALL data and log out? This cannot be undone.')) return;
    try {
        await api('POST', '/api/clear-data/');
        showToast('Data cleared. Redirecting...', 'info');
        setTimeout(() => { window.location.href = '/login/'; }, 1500);
    } catch (e) { showToast('Failed to clear data.', 'error'); }
}

// ── UTIL ──
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ── NOTIFICATIONS ──
async function registerNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    let permission = Notification.permission;
    if (permission === 'default') { try { permission = await Notification.requestPermission(); } catch (e) { } }
    if (permission === 'granted') { try { await navigator.serviceWorker.register('/static/js/sw.js'); } catch (e) { } }
    const btn = document.getElementById('btn-enable-notif');
    if (btn) btn.style.display = Notification.permission === 'default' ? 'inline-flex' : 'none';
}
function checkAttendanceAlerts() {
    if (!S.prefs.attAlert || Notification.permission !== 'granted') return;
    S.attendance.forEach(r => { if (r.held > 0) { const pct = Math.round((r.attended / r.held) * 100); if (pct < 75) { const needed = Math.ceil((0.75 * r.held - r.attended) / 0.25); try { new Notification('⚠️ Low Attendance – EduTrack', { body: `${r.sub}: ${pct}% — need ${needed} more classes` }); } catch (e) { } } } });
}
function updateReminderBanner() {
    const banner = document.getElementById('reminder-banner'); if (!banner) return;
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = S.tasks.filter(t => !t.done && t.due === today).length;
    if (dueToday > 0) { document.getElementById('rb-text-content').innerHTML = `⚡ You have ${dueToday} task(s) due today. <span class="rb-link" onclick="switchTab('tasks')">[View Tasks →]</span>`; banner.style.display = 'flex'; }
    else { banner.style.display = 'none'; }
}
function dismissReminderBanner() { document.getElementById('reminder-banner').style.display = 'none'; }
function checkDeadlineReminders() {
    if (Notification.permission !== 'granted') return;
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const dueSoon = S.tasks.filter(t => !t.done && (t.due === today || t.due === tomorrow));
    dueSoon.forEach(t => { try { new Notification('📋 Task Due – EduTrack', { body: `${t.title} is due ${t.due === today ? 'today' : 'tomorrow'}!` }); } catch (e) { } });
}
function checkStreakReminder() {
    const today = new Date().toISOString().slice(0, 10);
    if (S.streak.logged.includes(today)) return;
    if (new Date().getHours() >= 19 && Notification.permission === 'granted') {
        try { new Notification('🔥 Don\'t break your streak!', { body: `Log today to keep your ${S.streak.count}-day streak alive!` }); } catch (e) { }
    }
}
function startReminderScheduler() { checkDeadlineReminders(); checkStreakReminder(); setInterval(checkDeadlineReminders, 30 * 60 * 1000); setInterval(checkStreakReminder, 60 * 60 * 1000); }

document.addEventListener('DOMContentLoaded', init);
