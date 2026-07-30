/* ============================================================
   js/courseEditor.js
   Handles course modal interactions, module management, nested
   topics/objectives editing, and connections.
   ============================================================ */

let currentCourse = null;
let editingModules = [];
let editingConnections = [];

/**
 * Global handler triggered by clicking gear/pencil icon or Add Course button.
 * Accepts either a Course ID or a Module ID.
 */
function openCourseEditor(targetId = null) {
  let course = null;
  let connections = [];

  if (targetId && window.DATA) {
    let courseId = targetId;

    // Check if passed targetId is actually a module ID and resolve parent course ID
    if (window.DATA.courseByModuleId && window.DATA.courseByModuleId[targetId]) {
      courseId = window.DATA.courseByModuleId[targetId].id;
    } else {
      const matchedCourse = (window.DATA.courses || []).find((c) =>
        (c.modules || []).some((m) => m.id === targetId)
      );
      if (matchedCourse) {
        courseId = matchedCourse.id;
      }
    }

    if (typeof window.getCourseById === 'function') {
      const res = window.getCourseById(courseId);
      course = res.course;
      connections = res.connections;
    } else {
      course = (window.DATA.courses || []).find((c) => c.id === courseId);
      connections = window.DATA.connections || [];
    }
  } else if (window.DATA) {
    connections = window.DATA.connections || [];
  }

  openCourseModal(course, connections);
}

function openCourseModal(courseData = null, connectionsData = []) {
  currentCourse = courseData || {
    id: `course-${Date.now()}`,
    code: '',
    name: '',
    year: 1,
    yearLabel: 'Year 1',
    textbook: {}
  };

  // Deep clone modules to safely edit nested array attributes
  editingModules = courseData && courseData.modules 
    ? JSON.parse(JSON.stringify(courseData.modules)) 
    : [];

  const moduleIds = editingModules.map((m) => m.id);
  editingConnections = Array.isArray(connectionsData)
    ? connectionsData.filter(
        (c) =>
          c.from === currentCourse.id ||
          c.to === currentCourse.id ||
          moduleIds.includes(c.from) ||
          moduleIds.includes(c.to)
      )
    : [];

  const titleEl = document.getElementById('modalTitle');
  if (titleEl) titleEl.textContent = courseData ? 'Edit Course' : 'Add Course';

  // Safely evaluate courseYear so numeric 0 is preserved
  const courseYear = (currentCourse.year !== undefined && currentCourse.year !== null) 
    ? currentCourse.year 
    : 1;

  const idInput = document.getElementById('courseId');
  if (idInput) idInput.value = currentCourse.id || '';

  const codeInput = document.getElementById('courseCode');
  if (codeInput) codeInput.value = currentCourse.code || '';

  const nameInput = document.getElementById('courseName');
  if (nameInput) nameInput.value = currentCourse.name || '';
  
  const yearInput = document.getElementById('courseYear');
  if (yearInput) yearInput.value = courseYear;

  const yearLabelInput = document.getElementById('courseYearLabel');
  if (yearLabelInput) yearLabelInput.value = currentCourse.yearLabel || (courseYear === 0 ? 'Pre-University' : `Year ${courseYear}`);

  const tb = currentCourse.textbook || {};
  const tbTitle = document.getElementById('tbTitle');
  if (tbTitle) tbTitle.value = typeof tb === 'string' ? tb : tb.title || '';

  const tbAuthor = document.getElementById('tbAuthor');
  if (tbAuthor) tbAuthor.value = tb.author || '';

  const tbEdition = document.getElementById('tbEdition');
  if (tbEdition) tbEdition.value = tb.edition || '';

  renderModulesList();
  renderConnectionsList();
  switchTab('general');

  const modal = document.getElementById('courseModal');
  if (modal) modal.classList.remove('hidden');
}

function closeCourseModal() {
  const modal = document.getElementById('courseModal');
  if (modal) modal.classList.add('hidden');
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));

  const activeBtns = document.querySelectorAll('.tab-btn');
  activeBtns.forEach((btn) => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
      btn.classList.add('active');
    }
  });

  const activeTab = document.getElementById(`tab-${tabName}`);
  if (activeTab) activeTab.classList.add('active');
}

function renderModulesList() {
  const container = document.getElementById('moduleList');
  const countEl = document.getElementById('moduleCount');
  if (countEl) countEl.textContent = editingModules.length;
  if (!container) return;

  container.innerHTML = '';

  editingModules.forEach((mod, modIdx) => {
    if (!Array.isArray(mod.topics)) mod.topics = [];
    if (!Array.isArray(mod.objectives)) mod.objectives = [];

    const wrapper = document.createElement('div');
    wrapper.className = 'module-row-container';

    // Module Header Info
    let html = `
      <div class="module-header-row">
        <input type="text" placeholder="ID" value="${mod.id || ''}" style="width: 100px;" onchange="editingModules[${modIdx}].id = this.value">
        <input type="text" placeholder="Label" value="${mod.label || ''}" style="width: 100px;" onchange="editingModules[${modIdx}].label = this.value">
        <input type="text" placeholder="Module Title" value="${mod.title || ''}" style="flex: 1;" onchange="editingModules[${modIdx}].title = this.value">
        <input type="number" class="mod-lectures-input" min="1" max="20" placeholder="Lectures (e.g., 3)" value="${mod.lectureCount || 1}" onchange="editingModules[${modIdx}].lectureCount = parseInt(this.value, 10) || 1" />
        <button type="button" class="btn btn-cancel" onclick="removeModuleRow(${modIdx})">&times;</button>
      </div>
    `;

    // Nested Topics Editor Section
    html += `
      <div class="nested-section">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h5>Topics</h5>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addTopicRow(${modIdx})">+ Add Topic</button>
        </div>
        <div id="topics-${modIdx}">
    `;

    mod.topics.forEach((topic, tIdx) => {
      const topicVal = typeof topic === 'object' ? (topic.title || topic.name || topic.description || '') : topic;

      html += `
        <div class="nested-item-row">
          <input type="text" 
                 placeholder="Topic description..." 
                 value="${topicVal || ''}" 
                 style="flex: 1;" 
                 onchange="editingModules[${modIdx}].topics[${tIdx}] = this.value">
          <button type="button" class="btn btn-cancel btn-sm" onclick="removeTopicRow(${modIdx}, ${tIdx})">&times;</button>
        </div>
      `;
    });

    html += `</div></div>`;

    // Nested Objectives Editor Section
    html += `
      <div class="nested-section">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h5>Learning Objectives</h5>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addObjectiveRow(${modIdx})">+ Add Objective</button>
        </div>
        <div id="objectives-${modIdx}">
    `;

    mod.objectives.forEach((obj, oIdx) => {
      const objVal = typeof obj === 'object' ? (obj.title || obj.statement || obj.description || '') : obj;

      html += `
        <div class="nested-item-row">
          <input type="text" 
                 placeholder="Objective description..." 
                 value="${objVal || ''}" 
                 style="flex: 1;" 
                 onchange="editingModules[${modIdx}].objectives[${oIdx}] = this.value">
          <button type="button" class="btn btn-cancel btn-sm" onclick="removeObjectiveRow(${modIdx}, ${oIdx})">&times;</button>
        </div>
      `;
    });

    html += `</div></div>`;

    wrapper.innerHTML = html;
    container.appendChild(wrapper);
  });
}

function addModuleRow() {
  const courseIdEl = document.getElementById('courseId');
  const courseId = (courseIdEl && courseIdEl.value) ? courseIdEl.value : 'course';
  
  editingModules.push({
    id: `${courseId}-m${editingModules.length + 1}`,
    label: `MOD 0${editingModules.length + 1}`,
    title: 'New Module',
    lectureCount: 3,
    topics: [],
    objectives: []
  });
  renderModulesList();
}

function removeModuleRow(index) {
  editingModules.splice(index, 1);
  renderModulesList();
}

// Helpers for Topics
function addTopicRow(modIndex) {
  if (!editingModules[modIndex].topics) editingModules[modIndex].topics = [];
  editingModules[modIndex].topics.push('');
  renderModulesList();
}

function removeTopicRow(modIndex, topicIndex) {
  editingModules[modIndex].topics.splice(topicIndex, 1);
  renderModulesList();
}

// Helpers for Objectives
function addObjectiveRow(modIndex) {
  if (!editingModules[modIndex].objectives) editingModules[modIndex].objectives = [];
  editingModules[modIndex].objectives.push('');
  renderModulesList();
}

function removeObjectiveRow(modIndex, objIndex) {
  editingModules[modIndex].objectives.splice(objIndex, 1);
  renderModulesList();
}

function renderConnectionsList() {
  const container = document.getElementById('connectionList');
  const countEl = document.getElementById('connCount');
  if (countEl) countEl.textContent = editingConnections.length;
  if (!container) return;

  container.innerHTML = '';

  editingConnections.forEach((conn, idx) => {
    const row = document.createElement('div');
    row.className = 'manager-row';
    row.innerHTML = `
      <input type="text" placeholder="From ID" value="${conn.from || ''}" style="flex: 1;" onchange="editingConnections[${idx}].from = this.value">
      <span style="color:#8892b0">&rarr;</span>
      <input type="text" placeholder="To ID" value="${conn.to || ''}" style="flex: 1;" onchange="editingConnections[${idx}].to = this.value">
      <select onchange="editingConnections[${idx}].level = this.value">
        <option value="strong" ${conn.level === 'strong' ? 'selected' : ''}>Strong</option>
        <option value="related" ${conn.level === 'related' ? 'selected' : ''}>Related</option>
        <option value="weak" ${conn.level === 'weak' ? 'selected' : ''}>Weak</option>
      </select>
      <button type="button" class="btn btn-cancel" onclick="removeConnectionRow(${idx})">&times;</button>
    `;
    container.appendChild(row);
  });
}

function addConnectionRow() {
  const courseIdEl = document.getElementById('courseId');
  editingConnections.push({
    id: `c${Date.now().toString().slice(-4)}`,
    from: (courseIdEl && courseIdEl.value) ? courseIdEl.value : '',
    to: '',
    level: 'strong',
    note: ''
  });
  renderConnectionsList();
}

function removeConnectionRow(index) {
  editingConnections.splice(index, 1);
  renderConnectionsList();
}

function saveCourseData() {
  const yearEl = document.getElementById('courseYear');
  const rawYear = yearEl ? yearEl.value : '';
  const yearVal = rawYear !== '' && !isNaN(rawYear) ? parseInt(rawYear, 10) : 1;

  // Clean empty topic/objective strings before saving
  const cleanedModules = editingModules.map((mod) => ({
    ...mod,
    topics: (mod.topics || [])
      .map((t) => (typeof t === 'object' ? (t.title || t.name || t.description || '') : t))
      .filter((t) => typeof t === 'string' && t.trim() !== ''),
    objectives: (mod.objectives || [])
      .map((o) => (typeof o === 'object' ? (o.title || o.statement || o.description || '') : o))
      .filter((o) => typeof o === 'string' && o.trim() !== '')
  }));

  const courseIdEl = document.getElementById('courseId');
  const courseCodeEl = document.getElementById('courseCode');
  const courseNameEl = document.getElementById('courseName');
  const courseYearLabelEl = document.getElementById('courseYearLabel');
  const tbTitleEl = document.getElementById('tbTitle');
  const tbAuthorEl = document.getElementById('tbAuthor');
  const tbEditionEl = document.getElementById('tbEdition');

  const updatedCourse = {
    id: (courseIdEl && courseIdEl.value) ? courseIdEl.value : `course-${Date.now()}`,
    code: (courseCodeEl && courseCodeEl.value) ? courseCodeEl.value : 'NEW 100',
    name: (courseNameEl && courseNameEl.value) ? courseNameEl.value : 'New Course',
    year: yearVal,
    yearLabel: (courseYearLabelEl && courseYearLabelEl.value) ? courseYearLabelEl.value : (yearVal === 0 ? 'Pre-University' : `Year ${yearVal}`),
    textbook: {
      title: tbTitleEl ? tbTitleEl.value : '',
      author: tbAuthorEl ? tbAuthorEl.value : '',
      edition: tbEditionEl ? tbEditionEl.value : ''
    },
    modules: cleanedModules
  };

  if (typeof window.onCourseSave === 'function') {
    window.onCourseSave(updatedCourse, editingConnections);
  }

  closeCourseModal();
}

// Assign explicitly to window scope
window.openCourseEditor = openCourseEditor;
window.openCourseModal = openCourseModal;
window.closeCourseModal = closeCourseModal;
window.switchTab = switchTab;
window.addModuleRow = addModuleRow;
window.removeModuleRow = removeModuleRow;
window.addTopicRow = addTopicRow;
window.removeTopicRow = removeTopicRow;
window.addObjectiveRow = addObjectiveRow;
window.removeObjectiveRow = removeObjectiveRow;
window.addConnectionRow = addConnectionRow;
window.removeConnectionRow = removeConnectionRow;
window.saveCourseData = saveCourseData;