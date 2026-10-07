/* ============================================================
   js/courseEditor.js
   Course modal: general info + schedule pattern, modules/topics
   (fractional lecture hours), assessments, labs, connections, and
   the Outline & Policies tab. A live time budget shows exactly what
   fits in the term, using the same Scheduler as the calendar & RTF.
   ============================================================ */

let currentCourse = null;       // the course as it was when the editor opened
let originalCourseId = null;    // so an edited ID replaces rather than duplicates
let editingModules = [];
let editingConnections = [];
let editingOutline = {};

const S = () => window.Scheduler;

// ------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hoursVal(v, fallback = 1) {
  const n = parseFloat(v);
  return n > 0 ? Math.round(n * 100) / 100 : fallback;
}

function fmtH(h) { return S().formatHours(h); }

function uniqueId(prefix) {
  const taken = new Set();
  (window.DATA && window.DATA.courses || []).forEach((c) => (c.modules || []).forEach((m) => taken.add(m.id)));
  editingModules.forEach((m) => taken.add(m.id));
  let id;
  do { id = `${prefix}-${Math.random().toString(36).slice(2, 7)}`; } while (taken.has(id));
  return id;
}

function courseIdValue() {
  const el = document.getElementById('courseId');
  return (el && el.value.trim()) || (currentCourse && currentCourse.id) || 'course';
}

// ------------------------------------------------------------
// Textbooks (unchanged behaviour)
// ------------------------------------------------------------
function textbookRowHtml(tb = {}) {
  return `
    <input type="text" class="tb-title" placeholder="Title" value="${escapeHtml(tb.title || '')}">
    <input type="text" class="tb-author" placeholder="Author(s)" value="${escapeHtml(tb.author || '')}">
    <input type="text" class="tb-isbn" placeholder="ISBN / Edition" value="${escapeHtml(tb.isbn || tb.edition || '')}">
    <select class="tb-status">
      <option value="required" ${tb.isRequired !== false ? 'selected' : ''}>Required</option>
      <option value="recommended" ${tb.isRequired === false ? 'selected' : ''}>Recommended</option>
    </select>
    <button type="button" class="btn-remove-tb" title="Remove textbook">✕</button>`;
}

function appendTextbookRow(container, tb) {
  const row = document.createElement('div');
  row.className = 'textbook-input-row';
  row.innerHTML = textbookRowHtml(tb);
  row.querySelector('.btn-remove-tb').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function renderTextbookInputs(textbooks = []) {
  const container = document.getElementById('editorTextbooksContainer');
  if (!container) return;
  let list = Array.isArray(textbooks) ? textbooks : [];
  if (!list.length && textbooks && typeof textbooks === 'object' && !Array.isArray(textbooks)) list = [textbooks];
  else if (!list.length && typeof textbooks === 'string' && textbooks.trim()) list = [{ title: textbooks, isRequired: true }];
  container.innerHTML = '';
  list.forEach((tb) => appendTextbookRow(container, tb));
}

document.getElementById('btnAddTextbook')?.addEventListener('click', () => {
  const container = document.getElementById('editorTextbooksContainer');
  if (container) appendTextbookRow(container, {});
});

function getModalTextbooksData() {
  const rows = document.querySelectorAll('#editorTextbooksContainer .textbook-input-row');
  const out = [];
  rows.forEach((row) => {
    const title = row.querySelector('.tb-title')?.value.trim();
    if (!title) return;
    out.push({
      title,
      author: row.querySelector('.tb-author')?.value.trim() || '',
      isbn: row.querySelector('.tb-isbn')?.value.trim() || '',
      isRequired: row.querySelector('.tb-status')?.value === 'required',
    });
  });
  return out;
}

// ------------------------------------------------------------
// Schedule config (per course)
// ------------------------------------------------------------
function readScheduleFromForm() {
  const weeks = parseInt(document.getElementById('weeksInSemester')?.value, 10) || 12;
  const format = document.getElementById('weeklyFormat')?.value || '3x50';
  const schedule = { weeks, format };
  if (format === 'custom') schedule.pattern = S().parsePattern(document.getElementById('customPattern')?.value || '');
  return schedule;
}

function writeScheduleToForm(course) {
  const cfg = S().getCourseSchedule(course);
  const weeksEl = document.getElementById('weeksInSemester');
  const fmtEl = document.getElementById('weeklyFormat');
  const patEl = document.getElementById('customPattern');
  if (weeksEl) weeksEl.value = cfg.weeks;
  if (fmtEl) fmtEl.value = cfg.format;
  if (patEl) patEl.value = cfg.format === 'custom' ? cfg.pattern.join(', ') : '';
  updateScheduleUi();
}

function updateScheduleUi() {
  const fmtEl = document.getElementById('weeklyFormat');
  const group = document.getElementById('customPatternGroup');
  if (group && fmtEl) group.hidden = fmtEl.value !== 'custom';
  const note = document.getElementById('scheduleCapacityNote');
  if (note) {
    const cfg = S().getCourseSchedule({ schedule: readScheduleFromForm() });
    renderClassDaysPicker();
    note.textContent = `${cfg.weeks} weeks × ${fmtH(cfg.hoursPerWeek)} lecture h/week = ${fmtH(cfg.capacityHours)} lecture hours of class time.`;
  }
  refreshBudget();
}


// ------------------------------------------------------------
// Start date, class days, important dates
// ------------------------------------------------------------
let editingClassDays = [];
let editingImportantDates = [];

function currentPerWeek() {
  return S().getCourseSchedule({ schedule: readScheduleFromForm() }).pattern.length;
}

function renderClassDaysPicker() {
  const el = document.getElementById('classDaysPicker');
  if (!el) return;
  const perWeek = currentPerWeek();
  const resolved = S().resolveClassDays({ classDays: editingClassDays }, perWeek);
  const order = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const chosen = new Set(resolved.map((n) => S().WEEKDAY_CODES[n]));
  el.innerHTML = order.map((code) =>
    `<button type="button" class="day-chip ${chosen.has(code) ? 'is-on' : ''}" data-day="${code}" onclick="toggleClassDay('${code}')">${code.charAt(0) + code.charAt(1).toLowerCase()}</button>`
  ).join('') + `<span class="day-hint">${perWeek} class${perWeek === 1 ? '' : 'es'}/week &mdash; pick ${perWeek}</span>`;
}

function toggleClassDay(code) {
  const perWeek = currentPerWeek();
  const resolved = S().resolveClassDays({ classDays: editingClassDays }, perWeek).map((n) => S().WEEKDAY_CODES[n]);
  let next = resolved.includes(code) ? resolved.filter((c) => c !== code) : [...resolved, code];
  if (next.length > perWeek) next = next.slice(next.length - perWeek); // drop the oldest pick
  editingClassDays = next;
  renderClassDaysPicker();
  refreshBudget();
}

function renderImportantDatesRows() {
  const box = document.getElementById('editorImportantDatesContainer');
  if (!box) return;
  if (!editingImportantDates.length) {
    box.innerHTML = '<p class="empty-note">No important dates yet.</p>';
    return;
  }
  box.innerHTML = editingImportantDates.map((d, i) => `
    <div class="important-date-row">
      <input type="date" value="${escapeHtml(d.date || '')}" data-idx="${i}" data-f="date" title="Date (or first day)">
      <input type="date" value="${escapeHtml(d.endDate || '')}" data-idx="${i}" data-f="endDate" title="Last day (optional, for a range)">
      <input type="text" value="${escapeHtml(d.label || '')}" data-idx="${i}" data-f="label" placeholder="e.g. Reading week">
      <label class="skip-check"><input type="checkbox" data-idx="${i}" data-f="skipsClass" ${d.skipsClass ? 'checked' : ''}> no class</label>
      <button type="button" class="btn btn-cancel btn-sm" onclick="removeImportantDate(${i})" title="Remove">&times;</button>
    </div>`).join('');
}

function syncImportantDatesFromDom() {
  document.querySelectorAll('#editorImportantDatesContainer [data-f]').forEach((el) => {
    const d = editingImportantDates[+el.dataset.idx];
    if (!d) return;
    d[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
  });
}

function addImportantDate() {
  syncImportantDatesFromDom();
  editingImportantDates.push({ date: '', endDate: '', label: '', skipsClass: true });
  renderImportantDatesRows();
}

function removeImportantDate(i) {
  syncImportantDatesFromDom();
  editingImportantDates.splice(i, 1);
  renderImportantDatesRows();
}

/** Only the date fields that have values, so courses without dates stay unchanged. */
function readDatesFromForm() {
  syncImportantDatesFromDom();
  const out = {};
  const start = document.getElementById('courseStartDate')?.value;
  if (start) out.startDate = start;
  const perWeek = currentPerWeek();
  if (editingClassDays.length === perWeek) out.classDays = editingClassDays.slice();
  const dates = editingImportantDates
    .filter((d) => d.date)
    .map((d) => {
      const row = { date: d.date, label: (d.label || '').trim(), skipsClass: !!d.skipsClass };
      if (d.endDate && d.endDate !== d.date) row.endDate = d.endDate;
      return row;
    });
  if (dates.length) out.importantDates = dates;
  return out;
}

function writeDatesToForm(course) {
  const el = document.getElementById('courseStartDate');
  if (el) el.value = course.startDate || '';
  editingClassDays = Array.isArray(course.classDays) ? course.classDays.slice() : [];
  editingImportantDates = (course.importantDates || []).map((d) => ({ ...d }));
  renderClassDaysPicker();
  renderImportantDatesRows();
}

document.getElementById('btnAddImportantDate')?.addEventListener('click', addImportantDate);
document.getElementById('courseStartDate')?.addEventListener('change', refreshBudget);

['weeksInSemester', 'weeklyFormat', 'customPattern'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateScheduleUi);
    el.addEventListener('change', updateScheduleUi);
  }
});

// ------------------------------------------------------------
// Open / close
// ------------------------------------------------------------
function openCourseEditor(target = null) {
  let course = null;
  const data = window.DATA;
  if (typeof target === 'string' && data) {
    let courseId = target;
    const owner = data.courseByModuleId && data.courseByModuleId[target];
    if (owner) courseId = owner.id;
    course = (data.courses || []).find((c) => c.id === courseId) || null;
  } else if (target && typeof target === 'object') {
    course = target;
  }
  openCourseModal(course, (data && data.connections) || []);
}

function openCourseModal(courseData = null, connectionsData = []) {
  currentCourse = courseData
    ? JSON.parse(JSON.stringify(courseData))
    : { id: `course-${Date.now()}`, code: '', name: '', year: 1, yearLabel: 'Year 1', textbooks: [], modules: [] };
  originalCourseId = courseData ? courseData.id : null;
  connScopeMode = 'module';

  editingModules = JSON.parse(JSON.stringify(currentCourse.modules || [])).map((mod) => {
    if (mod.isExam || mod.isLab) return mod;
    const target = S().moduleHours(mod);
    return { ...mod, lectureCount: target, lectures: target };
  });

  const moduleIds = new Set(editingModules.map((m) => m.id));
  editingConnections = JSON.parse(JSON.stringify(connectionsData || [])).filter(
    (c) => c.from === currentCourse.id || c.to === currentCourse.id || moduleIds.has(c.from) || moduleIds.has(c.to)
  );

  editingOutline = extractOutline(currentCourse);

  document.getElementById('modalTitle').textContent = courseData ? `Edit ${courseData.code || 'Course'}` : 'Add Course';
  const year = currentCourse.year ?? 1;
  document.getElementById('courseId').value = currentCourse.id || '';
  document.getElementById('courseCode').value = currentCourse.code || '';
  document.getElementById('courseName').value = currentCourse.name || '';
  document.getElementById('courseYear').value = year;
  document.getElementById('courseYearLabel').value = currentCourse.yearLabel || (year === 0 ? 'Pre-University' : `Year ${year}`);

  renderTextbookInputs(currentCourse.textbooks || currentCourse.textbook || []);
  writeScheduleToForm(currentCourse);
  writeDatesToForm(currentCourse);
  renderModulesList();
  renderConnectionsList();
  renderOutlineTab();
  switchTab('general');

  const modal = document.getElementById('courseModal');
  if (modal) { modal.classList.remove('hidden'); modal.style.display = 'block'; }
}

function closeCourseModal() {
  const modal = document.getElementById('courseModal');
  if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
}

function switchTab(tabName) {
  if (document.getElementById('moduleList')) syncModulesFromDOM();
  document.querySelectorAll('#courseModal .tab-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn.getAttribute('onclick') || '').includes(`'${tabName}'`));
  });
  document.querySelectorAll('#courseModal .tab-content').forEach((c) => c.classList.remove('active'));
  const active = document.getElementById(`tab-${tabName}`);
  if (active) active.classList.add('active');
  if (tabName === 'modules') refreshBudget();
  if (tabName === 'outline') renderOutlineTab();
}

// ------------------------------------------------------------
// DOM -> editingModules
// ------------------------------------------------------------
function syncModulesFromDOM() {
  const container = document.getElementById('moduleList');
  if (!container) return;

  container.querySelectorAll('.module-row-container').forEach((wrapper) => {
    const modIdx = parseInt(wrapper.dataset.modIdx, 10);
    const mod = editingModules[modIdx];
    if (!mod) return;

    const val = (sel) => wrapper.querySelector(sel);

    if (mod.isExam) {
      if (val('.input-eval-label')) mod.label = val('.input-eval-label').value;
      if (val('.input-eval-title')) mod.title = val('.input-eval-title').value;
      if (val('.input-eval-weight')) mod.weightPercent = parseFloat(val('.input-eval-weight').value) || 0;
      if (val('.input-eval-classes')) mod.lectureCount = mod.lectures = Math.max(1, parseInt(val('.input-eval-classes').value, 10) || 1);
      if (val('.input-eval-duration-mode')) mod.durationMode = val('.input-eval-duration-mode').value;
      if (val('.input-eval-hours')) mod.durationHours = hoursVal(val('.input-eval-hours').value, 0.5);
      if (val('.input-eval-fresh')) mod.startsFreshClass = val('.input-eval-fresh').checked;
      if (val('.input-eval-when')) mod.scheduleNote = val('.input-eval-when').value;
      if (val('.input-eval-scope')) mod.scopeNote = val('.input-eval-scope').value;
      if (val('.input-eval-takehome')) mod.isTakeHome = val('.input-eval-takehome').checked;
      return;
    }

    if (mod.isLab) {
      if (val('.input-lab-label')) mod.label = val('.input-lab-label').value;
      if (val('.input-lab-title')) mod.title = val('.input-lab-title').value;
      return;
    }

    if (val('.input-module-label')) mod.label = val('.input-module-label').value;
    if (val('.input-module-title')) mod.title = val('.input-module-title').value;
    if (val('.input-module-tp')) mod.timePermitting = val('.input-module-tp').checked;
    if (val('.input-module-fresh')) mod.startsFreshClass = val('.input-module-fresh').checked;

    // If the module total was simply the sum of its topics, keep it tracking that sum.
    const prevSum = S().topicsHours(mod);
    const prevTotal = parseFloat(mod.lectureCount) || 0;
    const wasAuto = Math.abs(prevTotal - prevSum) < 0.001;

    const topics = [];
    wrapper.querySelectorAll('.topic-editor-card').forEach((card) => {
      topics.push({
        title: card.querySelector('.input-topic-title')?.value || '',
        description: card.querySelector('.input-topic-desc')?.value || '',
        lectureCount: hoursVal(card.querySelector('.input-topic-lectures')?.value, 1),
        learningObjectives: Array.from(card.querySelectorAll('.input-topic-obj')).map((i) => i.value),
        textbookQuestions: Array.from(card.querySelectorAll('.input-topic-quest')).map((i) => i.value),
      });
    });
    mod.topics = topics;

    const topicSum = S().topicsHours(mod);
    const modIn = val('.input-module-lectures');
    let total = modIn ? parseFloat(modIn.value) : NaN;
    const userEditedTotal = modIn && Math.abs((parseFloat(modIn.value) || 0) - prevTotal) > 0.001;
    if (wasAuto && !userEditedTotal) total = topicSum;
    if (!(total > 0)) total = topicSum;
    if (total < topicSum) total = topicSum;
    total = Math.round(total * 100) / 100;
    mod.lectureCount = mod.lectures = total;
    if (modIn && document.activeElement !== modIn) {
      modIn.value = total;
      modIn.min = topicSum;
    }
  });
}

// ------------------------------------------------------------
// Module list rendering
// ------------------------------------------------------------
function renderModulesList() {
  const container = document.getElementById('moduleList');
  const countEl = document.getElementById('moduleCount');
  if (countEl) countEl.textContent = editingModules.length;
  if (!container) return;

  if (!editingModules.length) {
    container.innerHTML = '<p class="empty-note">No modules yet. Add a module, an assessment, or a lab section above.</p>';
    refreshBudget();
    return;
  }

  container.innerHTML = editingModules.map((mod, modIdx) => {
    if (mod.isExam) return examRowHtml(mod, modIdx);
    if (mod.isLab) return labRowHtml(mod, modIdx);
    return moduleRowHtml(mod, modIdx);
  }).join('');

  editingModules.forEach((mod, modIdx) => { if (mod.isLab) refreshLabWeightSumIndicator(modIdx); });
  refreshBudget();
}

function examRowHtml(mod, modIdx) {
  const covered = new Set(mod.coveredModuleIds || []);
  const boxes = editingModules.filter((m) => !m.isExam && !m.isLab).map((m) => `
    <label class="chip-check">
      <input type="checkbox" ${covered.has(m.id) ? 'checked' : ''} onchange="toggleMidtermModule(${modIdx}, '${m.id}', this.checked)">
      ${escapeHtml(m.label || m.id)}
    </label>`).join('');

  return `
    <div class="module-row-container exam-row" data-mod-idx="${modIdx}">
      <div class="row-line">
        <span class="row-kind kind-exam">Assessment</span>
        <input type="text" class="input-eval-label" value="${escapeHtml(mod.label || '')}" placeholder="Category (e.g. Quiz)" title="Category — assessments with the same category are grouped in the outline" style="width: 130px;">
        <input type="text" class="input-eval-title" value="${escapeHtml(mod.title || '')}" placeholder="Title" style="flex: 1; min-width: 140px;">
        <label class="inline-field">Weight %
          <input type="number" class="input-eval-weight" step="0.5" min="0" value="${mod.weightPercent ?? 0}" style="width: 70px;">
        </label>
        <button type="button" class="btn btn-cancel btn-sm" onclick="removeModuleRow(${modIdx})" title="Delete assessment">&times;</button>
      </div>
      <div class="row-line">
        <label class="inline-field">
          <input type="checkbox" class="input-eval-takehome" ${mod.isTakeHome ? 'checked' : ''} onchange="syncModulesFromDOM(); renderModulesList();">
          Take-home (doesn't use class time)
        </label>
        ${mod.isTakeHome ? '' : `
        <label class="inline-field">Time used
          <select class="input-eval-duration-mode" onchange="syncModulesFromDOM(); renderModulesList();">
            <option value="classes" ${mod.durationMode !== 'hours' ? 'selected' : ''}>Whole class(es)</option>
            <option value="hours" ${mod.durationMode === 'hours' ? 'selected' : ''}>Part of a class</option>
          </select>
        </label>
        ${mod.durationMode === 'hours' ? `
        <label class="inline-field" title="How much of a class this needs, in lecture hours — e.g. 0.25 for 15 minutes of a 1-hour class.">Hours needed
          <input type="number" class="input-eval-hours" min="0.25" step="0.25" value="${S().examHours(mod)}" style="width: 65px;">
        </label>
        <label class="inline-field">
          <input type="checkbox" class="input-eval-fresh" ${mod.startsFreshClass ? 'checked' : ''}> Start in a fresh class
        </label>` : `
        <label class="inline-field">Classes used
          <input type="number" class="input-eval-classes" min="1" step="1" value="${S().examClasses(mod)}" style="width: 60px;">
        </label>`}`}
        <label class="inline-field grow">"Scheduled" text
          <input type="text" class="input-eval-when" value="${escapeHtml(mod.scheduleNote || '')}" placeholder="Leave blank to use the computed week (e.g. October 21, TBD)">
        </label>
        <span class="sched-badge" data-mod="${escapeHtml(mod.id)}"></span>
      </div>
      <div class="row-line">
        <span class="field-caption">Covers</span>
        <div class="chip-check-group">${boxes || '<span class="empty-note">Add teaching modules to map scope.</span>'}</div>
      </div>
      <div class="row-line">
        <label class="inline-field grow">Scope text (optional)
          <input type="text" class="input-eval-scope" value="${escapeHtml(mod.scopeNote || '')}" placeholder="Overrides the auto-generated scope line in the outline">
        </label>
      </div>
    </div>`;
}

function labRowHtml(mod, modIdx) {
  const labs = mod.labs || [];
  const items = labs.map((lab, labIdx) => `
    <div class="lab-item-row">
      <input type="text" value="${escapeHtml(lab.title || '')}" onchange="editingModules[${modIdx}].labs[${labIdx}].title = this.value" placeholder="Lab title" style="flex: 1;">
      <label class="inline-field">Hours
        <input type="number" step="0.5" min="0" value="${lab.hours ?? 3}" onchange="editingModules[${modIdx}].labs[${labIdx}].hours = parseFloat(this.value) || 0; refreshBudget();" style="width: 60px;">
      </label>
      <label class="inline-field">Weight %
        <input type="number" step="0.25" min="0" value="${lab.weightPercent ?? 0}" onchange="editingModules[${modIdx}].labs[${labIdx}].weightPercent = parseFloat(this.value) || 0; refreshLabWeightSumIndicator(${modIdx}); refreshBudget();" style="width: 70px;">
      </label>
      <button type="button" class="btn btn-cancel btn-sm" onclick="removeLabItem(${modIdx}, ${labIdx})" title="Delete lab">&times;</button>
    </div>`).join('');

  return `
    <div class="module-row-container lab-row" data-mod-idx="${modIdx}">
      <div class="row-line">
        <span class="row-kind kind-lab">Labs</span>
        <input type="text" class="input-lab-label" value="${escapeHtml(mod.label || 'LABS')}" placeholder="Category" style="width: 110px;">
        <input type="text" class="input-lab-title" value="${escapeHtml(mod.title || '')}" placeholder="Lab section title" style="flex: 1;">
        <label class="inline-field">Section weight %
          <input type="number" step="0.5" value="${mod.weightPercent ?? 0}" onchange="editingModules[${modIdx}].weightPercent = parseFloat(this.value) || 0; refreshLabWeightSumIndicator(${modIdx});" style="width: 70px;">
        </label>
        <button type="button" class="btn btn-cancel btn-sm" onclick="removeModuleRow(${modIdx})" title="Delete lab section">&times;</button>
      </div>
      <div class="row-line">
        <span id="labWeightSumIndicator-${modIdx}" class="field-caption"></span>
        <span style="flex:1"></span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="equalizeLabWeights(${modIdx})">Equalize weights</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addLabItem(${modIdx})">+ Add experiment</button>
      </div>
      ${items || '<p class="empty-note">No experiments yet.</p>'}
    </div>`;
}

function moduleRowHtml(mod, modIdx) {
  const topicSum = S().topicsHours(mod);
  const total = Math.max(S().moduleHours(mod), topicSum);
  mod.lectureCount = mod.lectures = total;

  const topics = (mod.topics || []).map((topic, tIdx) => {
    if (typeof topic !== 'object' || topic === null) {
      topic = { title: typeof topic === 'string' ? topic : '', description: '', lectureCount: 1, learningObjectives: [], textbookQuestions: [] };
      mod.topics[tIdx] = topic;
    }
    const objs = Array.isArray(topic.learningObjectives) ? topic.learningObjectives : [];
    const qs = Array.isArray(topic.textbookQuestions) ? topic.textbookQuestions : [];
    return `
      <div class="topic-editor-card">
        <button type="button" class="btn btn-cancel btn-sm topic-remove" onclick="removeTopicRow(${modIdx}, ${tIdx})" title="Delete topic">&times;</button>
        <div class="row-line">
          <label class="stack-field grow">Topic title
            <input type="text" class="input-topic-title" value="${escapeHtml(topic.title || '')}" placeholder="e.g. First Law of Thermodynamics">
          </label>
          <label class="stack-field" style="width: 96px;" title="In lecture hours: 1 = one 50-minute lecture. Fractions like 1.5 or 0.5 are fine.">Lecture hrs
            <input type="number" class="input-topic-lectures" min="0.25" step="0.25" value="${S().topicHours(topic)}">
          </label>
          <span class="sched-badge topic-badge" data-key="${escapeHtml(mod.id)}::${tIdx}"></span>
        </div>
        <label class="stack-field">Description
          <textarea class="input-topic-desc" rows="2" placeholder="Brief overview of the topic">${escapeHtml(topic.description || '')}</textarea>
        </label>
        <div class="nested-block">
          <div class="nested-head"><span class="nested-title obj">Learning objectives</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addTopicObjective(${modIdx}, ${tIdx})">+ Add</button></div>
          ${objs.map((o, oIdx) => `
            <div class="nested-item-row">
              <input type="text" class="input-topic-obj" value="${escapeHtml(o || '')}" placeholder="Objective" style="flex: 1;">
              <button type="button" class="btn btn-cancel btn-sm" onclick="removeTopicObjective(${modIdx}, ${tIdx}, ${oIdx})">&times;</button>
            </div>`).join('')}
        </div>
        <div class="nested-block">
          <div class="nested-head"><span class="nested-title q">Recommended questions &amp; resources</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addTopicQuestion(${modIdx}, ${tIdx})">+ Add</button></div>
          ${qs.map((q, qIdx) => `
            <div class="nested-item-row">
              <input type="text" class="input-topic-quest" value="${escapeHtml(q || '')}" placeholder="e.g. Ch. 5, #12, #18" style="flex: 1;">
              <button type="button" class="btn btn-cancel btn-sm" onclick="removeTopicQuestion(${modIdx}, ${tIdx}, ${qIdx})">&times;</button>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="module-row-container ${mod.timePermitting ? 'is-time-permitting' : ''}" data-mod-idx="${modIdx}">
      <div class="row-line">
        <input type="text" class="input-module-label" value="${escapeHtml(mod.label || '')}" placeholder="Module 1" style="width: 100px;">
        <input type="text" class="input-module-title" value="${escapeHtml(mod.title || '')}" placeholder="Module title" style="flex: 1;">
        <label class="inline-field" title="Anything above the sum of the topics becomes unassigned class time for this module.">Total lecture hrs
          <input type="number" class="input-module-lectures" min="${topicSum}" step="0.25" value="${total}" style="width: 72px;">
        </label>
        <button type="button" class="btn btn-cancel btn-sm" onclick="removeModuleRow(${modIdx})" title="Delete module">&times;</button>
      </div>
      <div class="row-line">
        <label class="inline-field" title="Scheduled after all required content, in whatever class time is left. Never counted as over budget.">
          <input type="checkbox" class="input-module-tp" ${mod.timePermitting ? 'checked' : ''}> Time permitting
        </label>
        <label class="inline-field" title="If the previous topic ends part-way through a class, the rest of that class is left as catch-up time.">
          <input type="checkbox" class="input-module-fresh" ${mod.startsFreshClass ? 'checked' : ''}> Start in a fresh class
        </label>
        <span style="flex:1"></span>
        <span class="sched-badge" data-mod="${escapeHtml(mod.id)}"></span>
      </div>
      <div class="row-line">
        <span class="field-caption">Topics (${(mod.topics || []).length})</span>
        <span style="flex:1"></span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addTopicRow(${modIdx})">+ Add topic</button>
      </div>
      ${topics || '<p class="empty-note">No topics yet.</p>'}
    </div>`;
}

// Live updates without re-rendering (keeps focus while typing)
(function wireModuleListEvents() {
  const list = document.getElementById('moduleList');
  if (!list) return;
  let t = null;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { syncModulesFromDOM(); refreshBudget(); }, 150); };
  list.addEventListener('input', kick);
  list.addEventListener('change', kick);
})();

// ------------------------------------------------------------
// Time budget + checks
// ------------------------------------------------------------
function draftCourse() {
  return {
    ...currentCourse,
    id: courseIdValue(),
    schedule: readScheduleFromForm(),
    ...readDatesFromForm(),
    noFinalExam: !!editingOutline.noFinalExam,
    modules: editingModules,
  };
}

function refreshBudget() {
  const panel = document.getElementById('budgetPanel');
  if (!panel || !currentCourse || !window.Scheduler) return;

  const course = draftCourse();
  const r = S().build(course);
  const ws = S().weightSummary(course);
  const cap = r.capacityHours;
  const req = r.requiredHours;
  const opt = r.optionalHours;
  const scale = Math.max(cap, req + opt, 1);
  const pct = (h) => `${(h / scale) * 100}%`;
  const fitReq = Math.min(req, cap);
  const overReq = Math.max(0, req - cap);
  const optFit = Math.max(0, Math.min(opt, cap - req));
  const optOut = Math.max(0, opt - optFit);

  let status;
  const gap = r.catchUpHours > 0 ? ` (${fmtH(r.catchUpHours)} h of class time is left as catch-up where a topic ends mid-class before an exam or fresh start)` : '';
  if (r.isOver) status = `<span class="bad">${fmtH(r.overByHours)} h doesn't fit</span>${gap}.`;
  else if (r.unreachedOptional.length) status = `<span class="ok">Required content fits.</span> Some time-permitting material won't be reached.`;
  else status = `<span class="ok">Everything fits</span> with ${fmtH(Math.max(0, cap - req - opt))} h to spare.`;

  const checks = [];
  if (ws.isOver) checks.push(`<li class="bad">Assessment weights add up to ${fmtH(ws.defined)}% — over 100%.</li>`);
  editingModules.forEach((m) => {
    if (m.isExam && !(m.coveredModuleIds || []).length && !m.scopeNote && (parseFloat(m.weightPercent) || 0) > 0) {
      checks.push(`<li>"${escapeHtml(m.title || m.label)}" is worth ${fmtH(m.weightPercent)}% but covers no modules.</li>`);
    }
    if (!m.isExam && !m.isLab) {
      (m.topics || []).forEach((t) => {
        const objs = (t.learningObjectives || []).map((o) => String(o).trim().toLowerCase()).filter(Boolean);
        const dup = objs.find((o, i) => objs.indexOf(o) !== i);
        if (dup) checks.push(`<li>"${escapeHtml(t.title)}" lists the same learning objective twice.</li>`);
      });
    }
  });

  panel.innerHTML = `
    <div class="budget-head">
      <strong>Class time</strong>
      <span>${fmtH(req)} h required${opt ? ` + ${fmtH(opt)} h time permitting` : ''} of ${fmtH(cap)} h available · ${status}</span>
    </div>
    <div class="budget-bar" role="img" aria-label="${fmtH(req + opt)} of ${fmtH(cap)} lecture hours used">
      <span class="seg fit" style="width:${pct(fitReq)}"></span>
      <span class="seg opt" style="width:${pct(optFit)}"></span>
      <span class="seg free" style="width:${pct(Math.max(0, cap - fitReq - optFit))}"></span>
      <span class="seg over" style="width:${pct(overReq)}"></span>
      <span class="seg opt-out" style="width:${pct(optOut)}"></span>
      <span class="cap-mark" style="left:${pct(cap)}"></span>
    </div>
    <div class="budget-weights ${ws.isOver ? 'bad' : ''}">
      Grades: assessments ${fmtH(ws.assessments)}% + labs ${fmtH(ws.labs)}% = ${fmtH(ws.defined)}%
      ${ws.hasFinal ? `→ final exam ${fmtH(ws.finalExam)}%` : '(no final exam)'}
    </div>
    ${checks.length ? `<ul class="budget-checks">${checks.join('')}</ul>` : ''}`;

  // Per-topic / per-module / per-assessment badges
  document.querySelectorAll('#moduleList .sched-badge').forEach((el) => {
    el.className = el.className.replace(/\bst-\S+/g, '').trim();
    let text = '';
    let cls = '';
    if (el.dataset.key) {
      const st = r.topicStatus[el.dataset.key];
      if (st) ({ text, cls } = badgeFor(st));
    } else if (el.dataset.mod) {
      const id = el.dataset.mod;
      const mod = editingModules.find((m) => m.id === id);
      if (mod && mod.isExam) {
        const wk = r.assessmentWeek[id];
        const ms = r.moduleStatus[id];
        if (mod.isTakeHome) { if (wk) { text = `Week ${wk}`; cls = 'st-ok'; } }
        else if (ms === 'ok') { text = `Week ${wk}`; cls = 'st-ok'; }
        else if (ms === 'partial') { text = wk ? `Week ${wk} (runs over)` : 'Runs past term'; cls = 'st-partial'; }
        else { text = "Doesn't fit in term"; cls = 'st-overflow'; }
      } else {
        const ms = r.moduleStatus[id];
        const map = { overflow: ["Doesn't fit", 'st-overflow'], partial: ['Runs past term', 'st-partial'], 'optional-unreached': ['Not reached', 'st-optional'], 'optional-partial': ['Partly reached', 'st-optional'] };
        if (map[ms]) [text, cls] = map[ms];
      }
    }
    el.textContent = text;
    if (cls) el.classList.add(cls);
    el.closest('.topic-editor-card')?.classList.toggle('is-overflow', cls === 'st-overflow' || cls === 'st-partial');
  });
}

function badgeFor(st) {
  if (st.status === 'ok') {
    return { text: st.startWeek === st.endWeek ? `Wk ${st.startWeek}` : `Wk ${st.startWeek}–${st.endWeek}`, cls: 'st-ok' };
  }
  if (st.status === 'partial') return { text: `${fmtH(st.overHours)} h past term`, cls: 'st-partial' };
  if (st.status === 'overflow') return { text: "Doesn't fit", cls: 'st-overflow' };
  if (st.status === 'optional-partial') return { text: 'Partly reached', cls: 'st-optional' };
  return { text: 'Not reached', cls: 'st-optional' };
}

// ------------------------------------------------------------
// Add / remove rows
// ------------------------------------------------------------
function addModuleRow() {
  syncModulesFromDOM();
  const n = editingModules.filter((m) => !m.isExam && !m.isLab).length + 1;
  editingModules.push({
    id: uniqueId(`${courseIdValue()}-m`), label: `Module ${n}`, title: 'New Module',
    lectureCount: 1, lectures: 1, topics: [], isExam: false, isLab: false,
  });
  renderModulesList();
  renderConnectionsList();
}

function addEvaluationRow() {
  syncModulesFromDOM();
  editingModules.push({
    id: uniqueId(`${courseIdValue()}-eval`), label: 'Quiz', title: 'New Assessment',
    lectureCount: 1, lectures: 1, weightPercent: 0,
    isExam: true, isLab: false, isTakeHome: false, coveredModuleIds: [],
  });
  renderModulesList();
  renderConnectionsList();
}

function addLabRow() {
  syncModulesFromDOM();
  editingModules.push({
    id: uniqueId(`${courseIdValue()}-labs`), label: 'LABS', title: 'Laboratory Component',
    isLab: true, isExam: false, weightPercent: 20,
    labs: [1, 2, 3, 4].map((i) => ({ title: `Lab ${i}`, hours: 3, weightPercent: 5 })),
  });
  renderModulesList();
  renderConnectionsList();
}

function addLabItem(modIdx) {
  syncModulesFromDOM();
  const m = editingModules[modIdx];
  m.labs = m.labs || [];
  m.labs.push({ title: `Lab ${m.labs.length + 1}`, hours: 3, weightPercent: 0 });
  renderModulesList();
}

function removeLabItem(modIdx, labIdx) {
  syncModulesFromDOM();
  editingModules[modIdx].labs.splice(labIdx, 1);
  renderModulesList();
}

function equalizeLabWeights(modIdx) {
  syncModulesFromDOM();
  const m = editingModules[modIdx];
  const labs = m.labs || [];
  if (!labs.length) return;
  const each = Math.round(((parseFloat(m.weightPercent) || 0) / labs.length) * 100) / 100;
  labs.forEach((l) => { l.weightPercent = each; });
  renderModulesList();
}

function refreshLabWeightSumIndicator(modIdx) {
  const mod = editingModules[modIdx];
  const el = document.getElementById(`labWeightSumIndicator-${modIdx}`);
  if (!mod || !el) return;
  const labs = mod.labs || [];
  const target = parseFloat(mod.weightPercent) || 0;
  if (!labs.length) { el.textContent = 'No experiments yet — section weight still applies.'; el.style.color = ''; return; }
  const sum = Math.round(labs.reduce((t, l) => t + (parseFloat(l.weightPercent) || 0), 0) * 100) / 100;
  const diff = Math.round((target - sum) * 100) / 100;
  if (Math.abs(diff) < 0.01) { el.textContent = `Experiments sum to ${sum}% ✓`; el.style.color = '#4ade80'; }
  else if (diff > 0) { el.textContent = `Experiments sum to ${sum}% — ${diff}% unassigned`; el.style.color = '#fbbf24'; }
  else { el.textContent = `Experiments sum to ${sum}% — ${Math.abs(diff)}% over`; el.style.color = '#f87171'; }
}

function toggleMidtermModule(midtermIdx, moduleId, isChecked) {
  const m = editingModules[midtermIdx];
  const set = new Set(m.coveredModuleIds || []);
  if (isChecked) set.add(moduleId); else set.delete(moduleId);
  // keep course order
  m.coveredModuleIds = editingModules.map((x) => x.id).filter((id) => set.has(id));
  refreshBudget();
}

function removeModuleRow(index) {
  syncModulesFromDOM();
  const removed = editingModules.splice(index, 1)[0];
  if (removed) {
    editingConnections = editingConnections.filter((c) => c.from !== removed.id && c.to !== removed.id);
    editingModules.forEach((m) => {
      if (m.coveredModuleIds) m.coveredModuleIds = m.coveredModuleIds.filter((id) => id !== removed.id);
    });
  }
  renderModulesList();
  renderConnectionsList();
}

function addTopicRow(modIndex) {
  syncModulesFromDOM();
  const mod = editingModules[modIndex];
  if (!mod) return;
  mod.topics = mod.topics || [];
  mod.topics.push({ title: '', description: '', lectureCount: 1, learningObjectives: [], textbookQuestions: [] });
  const sum = S().topicsHours(mod);
  mod.lectureCount = mod.lectures = Math.max(parseFloat(mod.lectureCount) || 0, sum);
  renderModulesList();
}

function removeTopicRow(modIndex, topicIndex) {
  syncModulesFromDOM();
  editingModules[modIndex].topics.splice(topicIndex, 1);
  renderModulesList();
}

function addTopicObjective(modIdx, topicIdx) {
  syncModulesFromDOM();
  const t = editingModules[modIdx].topics[topicIdx];
  if (!t) return;
  t.learningObjectives = t.learningObjectives || [];
  t.learningObjectives.push('');
  renderModulesList();
}

function removeTopicObjective(modIdx, topicIdx, objIdx) {
  syncModulesFromDOM();
  const t = editingModules[modIdx].topics[topicIdx];
  if (t && t.learningObjectives) { t.learningObjectives.splice(objIdx, 1); renderModulesList(); }
}

function addTopicQuestion(modIdx, topicIdx) {
  syncModulesFromDOM();
  const t = editingModules[modIdx].topics[topicIdx];
  if (!t) return;
  t.textbookQuestions = t.textbookQuestions || [];
  t.textbookQuestions.push('');
  renderModulesList();
}

function removeTopicQuestion(modIdx, topicIdx, qIdx) {
  syncModulesFromDOM();
  const t = editingModules[modIdx].topics[topicIdx];
  if (t && t.textbookQuestions) { t.textbookQuestions.splice(qIdx, 1); renderModulesList(); }
}

// ------------------------------------------------------------
// Outline & Policies tab
// ------------------------------------------------------------
const OUTLINE_FIELDS = [
  { group: 'Header & instructor', hint: 'Blank fields use the defaults from ⚙️ Settings.' },
  { key: 'term', label: 'Term (page header)', half: true, def: 'term', ph: 'e.g. Fall 2026' },
  { key: 'version', label: 'Version (page header)', half: true, def: 'version', ph: 'e.g. V1.0' },
  { key: 'instructor.name', label: 'Instructor name', half: true, def: 'instructorName' },
  { key: 'instructor.email', label: 'Instructor email', half: true, def: 'instructorEmail' },
  { key: 'instructor.office', label: 'Office location', half: true, def: 'instructorOffice' },
  { key: 'credits', label: 'Credit hours (optional)', half: true },
  { key: 'instructor.officeHours', label: 'Availability / consultation hours', rows: 2, def: 'officeHours' },
  { key: 'prerequisites', label: 'Required prerequisites', rows: 2, ph: 'None' },
  { key: 'corequisites', label: 'Required co-requisites', half: true, ph: 'None' },
  { key: 'software', label: 'Required software / tools', half: true },
  { key: 'otherResources', label: 'Other resources (section 1)', rows: 2 },
  { group: 'Sections 5 and 7' },
  { key: 'labInfo', label: 'Section 5: Laboratory information & safety', rows: 2, ph: 'This information will be provided by your laboratory instructor.' },
  { key: 'additionalInfo', label: 'Section 7: Additional course information', rows: 4 },
  { group: 'Policy overrides', hint: 'Only fill these in if this course differs from the department default.' },
  { key: 'gradingSystem', label: 'Section 3.2: Grading system', rows: 2, def: 'gradingSystem' },
  { key: 'missedWorkPolicy', label: 'Section 3.3: Alternate evaluation & missed work', rows: 3, def: 'missedWorkPolicy' },
  { key: 'aiPolicy', label: 'Section 6: Assistive tools & generative AI', rows: 3, def: 'aiPolicy' },
  { key: 'academicIntegrity', label: 'Section 8.1: Academic integrity', rows: 3, def: 'academicIntegrity' },
  { key: 'accommodations', label: 'Section 8.2: Student accommodations', rows: 3, def: 'accommodations' },
  { key: 'privacyAtipp', label: 'Section 8.3: Student privacy & ATIPP', rows: 3, def: 'privacyAtipp' },
];

const getPath = (o, p) => p.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), o);
function setPath(o, p, v) {
  const keys = p.split('.');
  let cur = o;
  keys.slice(0, -1).forEach((k) => { if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; });
  cur[keys[keys.length - 1]] = v;
}

function extractOutline(course) {
  const o = {};
  OUTLINE_FIELDS.forEach((f) => {
    if (!f.key) return;
    let v = getPath(course, f.key);
    if (f.key === 'instructor.name' && typeof course.instructor === 'string') v = course.instructor;
    if (f.key === 'missedWorkPolicy' && !v) v = course.alternateEvaluationPolicy;
    if (f.key === 'prerequisites' && !v) v = course.prereqs;
    if (f.key === 'corequisites' && !v) v = course.coreqs;
    if (f.key === 'labInfo' && v && typeof v === 'object') v = [v.schedule, v.location, v.safety, v.description].filter(Boolean).join('\n');
    setPath(o, f.key, v === undefined || v === null ? '' : String(v));
  });
  o.assessmentNotes = { ...(course.assessmentNotes || {}) };
  o.noFinalExam = !!course.noFinalExam;
  return o;
}

function renderOutlineTab() {
  const host = document.getElementById('tab-outline');
  if (!host || !currentCourse) return;
  const g = typeof window.getGlobalSettings === 'function' ? window.getGlobalSettings() : {};

  const fieldHtml = OUTLINE_FIELDS.map((f) => {
    if (f.group) return `<h3 class="outline-group full-width">${f.group}${f.hint ? `<small>${f.hint}</small>` : ''}</h3>`;
    const val = getPath(editingOutline, f.key) || '';
    const defText = f.def && g[f.def] ? `Default: ${g[f.def]}` : (f.ph || '');
    const ph = escapeHtml(defText.length > 140 ? defText.slice(0, 137) + '…' : defText);
    const id = `outline-${f.key.replace('.', '-')}`;
    const control = f.rows
      ? `<textarea id="${id}" data-key="${f.key}" rows="${f.rows}" placeholder="${ph}">${escapeHtml(val)}</textarea>`
      : `<input type="text" id="${id}" data-key="${f.key}" value="${escapeHtml(val)}" placeholder="${ph}">`;
    return `<div class="form-group ${f.half ? '' : 'full-width'}"><label for="${id}">${f.label}</label>${control}</div>`;
  }).join('');

  // Assessment category descriptions — one per distinct category label
  const labels = [];
  editingModules.forEach((m) => {
    if (!(m.isExam || m.isLab)) return;
    const l = (m.label || (m.isLab ? 'Laboratory' : 'Assessment')).trim();
    if (!labels.includes(l)) labels.push(l);
  });
  if (!editingOutline.noFinalExam) labels.push('Final Examination');
  const notesHtml = labels.map((l) => `
    <div class="form-group full-width">
      <label>${escapeHtml(l)}</label>
      <textarea data-note="${escapeHtml(l)}" rows="2" placeholder="Optional paragraph shown under this category in 3.1">${escapeHtml(editingOutline.assessmentNotes[l] || '')}</textarea>
    </div>`).join('');

  host.innerHTML = `
    <div class="form-grid outline-grid">
      ${fieldHtml}
      <h3 class="outline-group full-width">Section 3.1 category descriptions<small>Categories come from the assessment and lab labels on the Modules tab.</small></h3>
      <div class="form-group full-width">
        <label class="inline-field"><input type="checkbox" id="outline-noFinal" ${editingOutline.noFinalExam ? 'checked' : ''}> This course has no final exam</label>
      </div>
      ${notesHtml || '<p class="empty-note full-width">Add assessments on the Modules tab to describe them here.</p>'}
    </div>`;

  host.querySelectorAll('[data-key]').forEach((el) => {
    el.addEventListener('input', () => setPath(editingOutline, el.dataset.key, el.value));
  });
  host.querySelectorAll('[data-note]').forEach((el) => {
    el.addEventListener('input', () => { editingOutline.assessmentNotes[el.dataset.note] = el.value; });
  });
  host.querySelector('#outline-noFinal')?.addEventListener('change', (e) => {
    editingOutline.noFinalExam = e.target.checked;
    renderOutlineTab();
  });
}

function applyOutline(course) {
  OUTLINE_FIELDS.forEach((f) => {
    if (!f.key) return;
    const v = String(getPath(editingOutline, f.key) || '').trim();
    if (f.key.startsWith('instructor.')) {
      if (typeof course.instructor !== 'object' || course.instructor === null) course.instructor = {};
      const k = f.key.split('.')[1];
      if (v) course.instructor[k] = v; else delete course.instructor[k];
    } else if (v) {
      course[f.key] = v;
    } else {
      delete course[f.key];
    }
  });
  if (course.instructor && !Object.keys(course.instructor).length) delete course.instructor;
  // legacy aliases the old exporter used
  ['alternateEvaluationPolicy', 'prereqs', 'coreqs', 'lab'].forEach((k) => delete course[k]);

  const notes = {};
  Object.entries(editingOutline.assessmentNotes || {}).forEach(([k, v]) => { if (String(v).trim()) notes[k] = String(v).trim(); });
  if (Object.keys(notes).length) course.assessmentNotes = notes; else delete course.assessmentNotes;
  if (editingOutline.noFinalExam) course.noFinalExam = true; else delete course.noFinalExam;
}

// ------------------------------------------------------------
// Connections tab
// ------------------------------------------------------------
function courseYearOf(moduleOrCourseId) {
  const data = window.DATA || {};
  if (moduleOrCourseId === currentCourse.id) return parseInt(document.getElementById('courseYear')?.value, 10) || 0;
  if (editingModules.some((m) => m.id === moduleOrCourseId)) return parseInt(document.getElementById('courseYear')?.value, 10) || 0;
  const c = (data.courseByModuleId && data.courseByModuleId[moduleOrCourseId]) || (data.courses || []).find((x) => x.id === moduleOrCourseId);
  return c ? Number(c.year) || 0 : 0;
}

/** Earlier year → later year, so "Builds upon / Leads to" reads correctly. */
function orientConnection(from, to) {
  return courseYearOf(from) > courseYearOf(to) ? [to, from] : [from, to];
}

let connScopeMode = 'module'; // 'module' = topic-to-topic, 'course' = whole-course link

function isCourseLevelConn(conn) {
  const data = window.DATA || {};
  const isCourseId = (id) => id === currentCourse.id || (data.courses || []).some((c) => c.id === id);
  return isCourseId(conn.from) && isCourseId(conn.to);
}

function setConnScopeMode(mode) {
  connScopeMode = mode === 'course' ? 'course' : 'module';
  renderConnectionsList();
}

function courseLabel(id) {
  const c = id === currentCourse.id
    ? { code: document.getElementById('courseCode')?.value || currentCourse.code, name: document.getElementById('courseName')?.value || currentCourse.name }
    : ((window.DATA && window.DATA.courses) || []).find((x) => x.id === id);
  return c ? `${c.code || ''}${c.name ? ' — ' + c.name : ''}` : id;
}

function renderConnectionsList() {
  const container = document.getElementById('connectionList');
  const countEl = document.getElementById('connCount');
  if (countEl) countEl.textContent = editingConnections.length;
  if (!container) return;

  const allCourses = (window.DATA && window.DATA.courses) || [];
  const moduleById = (window.DATA && window.DATA.moduleById) || {};
  const localIds = new Set(editingModules.map((m) => m.id));

  const fromOptions = editingModules.filter((m) => !m.isLab).map((m) => `<option value="${m.id}">${escapeHtml(m.label)}: ${escapeHtml(m.title)}</option>`).join('')
    || '<option value="">No modules in this course yet</option>';
  const courseOptions = allCourses.filter((c) => c.id !== originalCourseId)
    .map((c) => `<option value="${c.id}">${escapeHtml(c.code)} — ${escapeHtml(c.name)}</option>`).join('');

  const rows = editingConnections.length ? editingConnections.map((conn, idx) => {
    if (isCourseLevelConn(conn)) {
      const fromLocal = conn.from === currentCourse.id;
      const remoteId = fromLocal ? conn.to : conn.from;
      const dir = courseYearOf(remoteId) < courseYearOf(currentCourse.id) ? 'Builds upon' : courseYearOf(remoteId) > courseYearOf(currentCourse.id) ? 'Leads to' : 'Same year';
      return `
      <tr>
        <td><em>Whole course</em></td>
        <td class="conn-dir">${dir}</td>
        <td><span class="course-pill">${escapeHtml(courseLabel(remoteId))}</span> <em>(entire course)</em></td>
        <td><span class="badge tier-course">course link</span></td>
        <td style="text-align:right;"><button type="button" class="btn btn-cancel btn-sm" onclick="removeConnectionRow(${idx})" title="Delete connection">&times;</button></td>
      </tr>`;
    }
    const fromLocal = localIds.has(conn.from) || conn.from === currentCourse.id;
    const localId = fromLocal ? conn.from : conn.to;
    const remoteId = fromLocal ? conn.to : conn.from;
    const localMod = editingModules.find((m) => m.id === localId) || moduleById[localId];
    const remoteMod = moduleById[remoteId];
    const remoteCourse = (window.DATA && window.DATA.courseByModuleId && window.DATA.courseByModuleId[remoteId])
      || allCourses.find((c) => c.id === remoteId);
    const dir = courseYearOf(remoteId) < courseYearOf(localId) ? 'Builds upon' : courseYearOf(remoteId) > courseYearOf(localId) ? 'Leads to' : 'Same year';
    return `
      <tr>
        <td>${localMod ? `<strong>${escapeHtml(localMod.label || '')}</strong>: ${escapeHtml(localMod.title || '')}` : escapeHtml(localId)}</td>
        <td class="conn-dir">${dir}</td>
        <td><span class="course-pill">${escapeHtml(remoteCourse ? remoteCourse.code : 'Missing')}</span>
          ${remoteMod ? `<strong>${escapeHtml(remoteMod.label || '')}</strong>: ${escapeHtml(remoteMod.title || '')}` : escapeHtml(remoteId)}</td>
        <td><span class="badge tier-${conn.level}">${escapeHtml(conn.level)}</span></td>
        <td style="text-align:right;"><button type="button" class="btn btn-cancel btn-sm" onclick="removeConnectionRow(${idx})" title="Delete connection">&times;</button></td>
      </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty-note" style="text-align:center;">No connections for this course yet.</td></tr>';

  const isCourseMode = connScopeMode === 'course';
  const form = isCourseMode ? `
      <div class="add-connection-form">
        <label class="stack-field grow">From
          <select disabled><option>This whole course</option></select></label>
        <label class="stack-field grow">To course (entire course)
          <select id="conn-to-course-only">
            <option value="">Select a course…</option>${courseOptions}</select></label>
        <button type="button" class="btn btn-primary" onclick="addCourseLinkFromDropdowns()">Add course link</button>
      </div>` : `
      <div class="add-connection-form">
        <label class="stack-field grow">From (this course)
          <select id="conn-from-module">${fromOptions}</select></label>
        <label class="stack-field grow">To course
          <select id="conn-to-course" onchange="handleConnectionCourseChange(this.value)">
            <option value="">Select a course…</option>${courseOptions}</select></label>
        <label class="stack-field grow">To module
          <select id="conn-to-module" disabled><option value="">Select a course first</option></select></label>
        <label class="stack-field" style="width: 110px;">Type
          <select id="conn-level">
            <option value="strong">Strong</option>
            <option value="related" selected>Related</option>
            <option value="weak">Weak</option>
          </select></label>
        <button type="button" class="btn btn-primary" onclick="addConnectionFromDropdowns()">Add link</button>
      </div>`;

  container.innerHTML = `
    <div class="connection-editor-box">
      <div class="conn-scope-toggle" role="tablist">
        <button type="button" class="btn btn-sm ${isCourseMode ? 'btn-secondary' : 'btn-primary'}" onclick="setConnScopeMode('module')">Topic ↔ topic</button>
        <button type="button" class="btn btn-sm ${isCourseMode ? 'btn-primary' : 'btn-secondary'}" onclick="setConnScopeMode('course')">Whole course ↔ whole course</button>
      </div>
      ${form}
      <table class="conn-table">
        <thead><tr><th>This course</th><th></th><th>Connected to</th><th>Type</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function addCourseLinkFromDropdowns() {
  const target = document.getElementById('conn-to-course-only')?.value;
  if (!target) { alert('Choose the course to link to.'); return; }
  const me = currentCourse.id;
  if (editingConnections.some((c) => (c.from === me && c.to === target) || (c.from === target && c.to === me))) {
    alert('These two courses are already linked.');
    return;
  }
  const [from, to] = orientConnection(me, target);
  editingConnections.push({ id: `conn-${Date.now()}`, from, to, level: 'course', note: '' });
  renderConnectionsList();
}

function handleConnectionCourseChange(courseId) {
  const sel = document.getElementById('conn-to-module');
  if (!sel) return;
  const course = ((window.DATA && window.DATA.courses) || []).find((c) => c.id === courseId);
  const mods = course ? (course.modules || []).filter((m) => !m.isLab) : [];
  sel.innerHTML = mods.length
    ? mods.map((m) => `<option value="${m.id}">${escapeHtml(m.label)}: ${escapeHtml(m.title)}</option>`).join('')
    : `<option value="">${courseId ? 'No modules in this course' : 'Select a course first'}</option>`;
  sel.disabled = !mods.length;
}

function addConnectionFromDropdowns() {
  const a = document.getElementById('conn-from-module')?.value;
  const b = document.getElementById('conn-to-module')?.value;
  const level = document.getElementById('conn-level')?.value || 'related';
  if (!a || !b) { alert('Choose a module in this course and a module to connect it to.'); return; }
  if (editingConnections.some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a))) {
    alert('These two modules are already connected.');
    return;
  }
  const [from, to] = orientConnection(a, b);
  editingConnections.push({ id: `conn-${Date.now()}`, from, to, level, note: '' });
  renderConnectionsList();
}

function removeConnectionRow(index) {
  editingConnections.splice(index, 1);
  renderConnectionsList();
}

// ------------------------------------------------------------
// Save
// ------------------------------------------------------------
function saveCourseData() {
  syncModulesFromDOM();

  const rawYear = document.getElementById('courseYear')?.value;
  const yearVal = rawYear !== '' && !isNaN(rawYear) ? parseInt(rawYear, 10) : 1;

  const cleanedModules = editingModules.map((mod) => {
    if (mod.isExam) {
      const partial = !mod.isTakeHome && S().isPartialExam(mod);
      const out = {
        ...mod,
        label: mod.label || 'Assessment',
        title: mod.title || 'Assessment',
        lectureCount: S().examClasses(mod),
        lectures: S().examClasses(mod),
        weightPercent: parseFloat(mod.weightPercent) || 0,
        isExam: true, isLab: false,
        isTakeHome: !!mod.isTakeHome,
        coveredModuleIds: mod.coveredModuleIds || [],
      };
      if (partial) {
        out.durationMode = 'hours';
        out.durationHours = S().examHours(mod);
        if (!out.startsFreshClass) delete out.startsFreshClass;
      } else {
        delete out.durationMode;
        delete out.durationHours;
        delete out.startsFreshClass;
      }
      ['scheduleNote', 'scopeNote'].forEach((k) => { if (!String(out[k] || '').trim()) delete out[k]; });
      return out;
    }
    if (mod.isLab) {
      const labs = (mod.labs || []).map((l) => ({
        ...l,
        title: l.title || 'Lab Experiment',
        hours: parseFloat(l.hours) >= 0 ? parseFloat(l.hours) : 3,
        weightPercent: parseFloat(l.weightPercent) || 0,
      }));
      const sum = labs.reduce((s, l) => s + l.weightPercent, 0);
      return {
        ...mod,
        label: mod.label || 'LABS',
        title: mod.title || 'Laboratory Component',
        weightPercent: labs.length ? Math.round(sum * 100) / 100 : (parseFloat(mod.weightPercent) || 0),
        isLab: true, isExam: false, labs,
      };
    }
    const topics = (mod.topics || [])
      .map((t) => (typeof t === 'string'
        ? { title: t, description: '', lectureCount: 1, learningObjectives: [], textbookQuestions: [] }
        : {
          ...t,
          title: t.title || '',
          description: t.description || '',
          lectureCount: hoursVal(t.lectureCount, 1),
          learningObjectives: (t.learningObjectives || []).filter((o) => typeof o === 'string' && o.trim()),
          textbookQuestions: (t.textbookQuestions || []).filter((q) => typeof q === 'string' && q.trim()),
        }))
      .filter((t) => t.title.trim() || t.description.trim() || t.learningObjectives.length || t.textbookQuestions.length);
    const total = Math.max(parseFloat(mod.lectureCount) || 0, S().topicsHours({ topics }));
    const out = { ...mod, lectureCount: total, lectures: total, isExam: false, isLab: false, topics };
    if (!out.timePermitting) delete out.timePermitting;
    if (!out.startsFreshClass) delete out.startsFreshClass;
    return out;
  });

  // Start from the original course so fields this editor doesn't show (positions,
  // custom keys from other tools) survive a save.
  const updatedCourse = {
    ...currentCourse,
    id: courseIdValue() || `course-${Date.now()}`,
    code: document.getElementById('courseCode')?.value.trim() || 'NEW 100',
    name: document.getElementById('courseName')?.value.trim() || 'New Course',
    year: yearVal,
    yearLabel: document.getElementById('courseYearLabel')?.value.trim() || (yearVal === 0 ? 'Pre-University' : `Year ${yearVal}`),
    textbooks: getModalTextbooksData(),
    schedule: readScheduleFromForm(),
    modules: cleanedModules,
  };
  delete updatedCourse.textbook; // migrated to textbooks[]
  delete updatedCourse.startDate; delete updatedCourse.classDays; delete updatedCourse.importantDates;
  Object.assign(updatedCourse, readDatesFromForm());
  applyOutline(updatedCourse);

  const conflict = ((window.DATA && window.DATA.courses) || []).find((c) => c.id === updatedCourse.id && c.id !== originalCourseId);
  if (conflict) {
    alert(`Another course (${conflict.code}) already uses the ID "${updatedCourse.id}". Choose a different Course ID.`);
    switchTab('general');
    return;
  }

  if (typeof window.onCourseSave === 'function') {
    window.onCourseSave(updatedCourse, editingConnections, { originalId: originalCourseId, replaceConnections: true });
  }
  closeCourseModal();
}

// ------------------------------------------------------------
// Globals for inline handlers
// ------------------------------------------------------------
Object.assign(window, {
  openCourseEditor, openCourseModal, closeCourseModal, switchTab,
  renderTextbookInputs, getModalTextbooksData,
  addModuleRow, addEvaluationRow, addMidtermRow: addEvaluationRow, addLabRow,
  addLabItem, removeLabItem, equalizeLabWeights, refreshLabWeightSumIndicator,
  toggleMidtermModule, removeModuleRow, addTopicRow, removeTopicRow,
  addTopicObjective, removeTopicObjective, addTopicQuestion, removeTopicQuestion,
  toggleClassDay, removeImportantDate, handleConnectionCourseChange, addConnectionFromDropdowns, addCourseLinkFromDropdowns, setConnScopeMode, removeConnectionRow,
  saveCourseData, renderModulesList, renderConnectionsList, syncModulesFromDOM,
  refreshBudget, orientConnection,
  editingModulesRef: () => editingModules,
});
