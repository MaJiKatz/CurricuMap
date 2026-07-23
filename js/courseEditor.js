/* ============================================================
   js/courseEditor.js
   ============================================================ */

let currentCourse = null;
let editingModules = [];
let editingConnections = [];

/**
 * Global handler triggered by clicking the gear icon or Add Course button.
 */
/**
 * Global handler triggered by clicking the gear/pencil icon or Add Course button.
 * Accepts either a Course ID (e.g. 'chem1010') or a Module ID (e.g. 'chem1010-m1').
 */
function openCourseEditor(targetId = null) {
  let course = null;
  let connections = [];

  if (targetId && window.DATA) {
    let courseId = targetId;

    // 1. If targetId belongs to a module, resolve it to the parent Course ID
    if (window.DATA.courseByModuleId && window.DATA.courseByModuleId[targetId]) {
      courseId = window.DATA.courseByModuleId[targetId].id;
    } else {
      // Fallback check if passed ID is inside a course's module list
      const matchedCourse = window.DATA.courses.find((c) =>
        (c.modules || []).some((m) => m.id === targetId)
      );
      if (matchedCourse) {
        courseId = matchedCourse.id;
      }
    }

    // 2. Retrieve Course & Connections Data
    if (typeof window.getCourseById === 'function') {
      const res = window.getCourseById(courseId);
      course = res.course;
      connections = res.connections;
    } else {
      course = window.DATA.courses.find((c) => c.id === courseId);
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

  editingModules = courseData && courseData.modules ? [...courseData.modules] : [];

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

  // Populate form fields
  const titleEl = document.getElementById('modalTitle');
  if (titleEl) titleEl.textContent = courseData ? 'Edit Course' : 'Add Course';

  document.getElementById('courseId').value = currentCourse.id || '';
  document.getElementById('courseCode').value = currentCourse.code || '';
  document.getElementById('courseName').value = currentCourse.name || '';
  document.getElementById('courseYear').value = currentCourse.year || 1;
  document.getElementById('courseYearLabel').value = currentCourse.yearLabel || `Year ${currentCourse.year || 1}`;

  const tb = currentCourse.textbook || {};
  document.getElementById('tbTitle').value = typeof tb === 'string' ? tb : tb.title || '';
  document.getElementById('tbAuthor').value = tb.author || '';
  document.getElementById('tbEdition').value = tb.edition || '';

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

  const activeBtn = document.querySelectorAll('.tab-btn');
  activeBtn.forEach((btn) => {
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

  editingModules.forEach((mod, idx) => {
    const row = document.createElement('div');
    row.className = 'manager-row';
    row.innerHTML = `
      <input type="text" placeholder="ID" value="${mod.id || ''}" style="width: 100px;" onchange="editingModules[${idx}].id = this.value">
      <input type="text" placeholder="Label" value="${mod.label || ''}" style="width: 100px;" onchange="editingModules[${idx}].label = this.value">
      <input type="text" placeholder="Module Title" value="${mod.title || ''}" style="flex: 1;" onchange="editingModules[${idx}].title = this.value">
      <button type="button" class="btn btn-cancel" onclick="removeModuleRow(${idx})">&times;</button>
    `;
    container.appendChild(row);
  });
}

function addModuleRow() {
  const courseId = document.getElementById('courseId').value || 'course';
  editingModules.push({
    id: `${courseId}-m${editingModules.length + 1}`,
    label: `MOD 0${editingModules.length + 1}`,
    title: 'New Module',
    topics: []
  });
  renderModulesList();
}

function removeModuleRow(index) {
  editingModules.splice(index, 1);
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
  editingConnections.push({
    id: `c${Date.now().toString().slice(-4)}`,
    from: document.getElementById('courseId').value || '',
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
  const yearVal = parseInt(document.getElementById('courseYear').value, 10) || 1;
  const updatedCourse = {
    id: document.getElementById('courseId').value || `course-${Date.now()}`,
    code: document.getElementById('courseCode').value || 'NEW 100',
    name: document.getElementById('courseName').value || 'New Course',
    year: yearVal,
    yearLabel: document.getElementById('courseYearLabel').value || `Year ${yearVal}`,
    textbook: {
      title: document.getElementById('tbTitle').value,
      author: document.getElementById('tbAuthor').value,
      edition: document.getElementById('tbEdition').value
    },
    modules: editingModules
  };

  if (typeof window.onCourseSave === 'function') {
    window.onCourseSave(updatedCourse, editingConnections);
  }

  closeCourseModal();
}

// Assign explicitly to window
window.openCourseEditor = openCourseEditor;
window.openCourseModal = openCourseModal;
window.closeCourseModal = closeCourseModal;
window.switchTab = switchTab;
window.addModuleRow = addModuleRow;
window.removeModuleRow = removeModuleRow;
window.addConnectionRow = addConnectionRow;
window.removeConnectionRow = removeConnectionRow;
window.saveCourseData = saveCourseData;