/* ============================================================
   js/courseEditor.js
   Handles course modal interactions, module/midterm/lab management, 
   nested topics/objectives editing, and connections.
   ============================================================ */

let currentCourse = null;
let editingModules = [];
let editingConnections = [];

function openCourseEditor(targetId = null) {
  let course = null;
  let connections = [];

  if (targetId && window.DATA) {
    let courseId = targetId;

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

  const availableModules = editingModules.filter(m => !m.isExam && !m.isLab);

  editingModules.forEach((mod, modIdx) => {
    const wrapper = document.createElement('div');
    wrapper.className = `module-row-container ${mod.isExam ? 'midterm-row-container' : ''} ${mod.isLab ? 'lab-row-container' : ''}`;

    if (mod.isExam) {
      // MIDTERM ROW
      if (!Array.isArray(mod.coveredModuleIds)) mod.coveredModuleIds = [];

      let optionsHtml = availableModules.map(m => {
        const isChecked = mod.coveredModuleIds.includes(m.id);
        return `
          <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.85rem; background: #1e293b; padding: 2px 8px; border-radius: 4px; border: 1px solid #334155; color: #f1f5f9;">
            <input type="checkbox" value="${m.id}" ${isChecked ? 'checked' : ''} onchange="toggleMidtermModule(${modIdx}, '${m.id}', this.checked)">
            ${m.label || m.id}
          </label>
        `;
      }).join(' ');

      wrapper.innerHTML = `
        <div class="module-header-row" style="background: rgba(107, 33, 168, 0.25); border-left: 4px solid #a855f7; padding: 6px;">
          <span style="font-size:1.1rem;">📝</span>
          <input type="text" placeholder="ID" value="${mod.id || ''}" style="width: 90px;" onchange="editingModules[${modIdx}].id = this.value">
          <input type="text" placeholder="Label (e.g. EXAM 1)" value="${mod.label || ''}" style="width: 100px;" onchange="editingModules[${modIdx}].label = this.value">
          <input type="text" placeholder="Title (e.g. Midterm 1)" value="${mod.title || ''}" style="flex: 1;" onchange="editingModules[${modIdx}].title = this.value">
          <input type="number" placeholder="Grade %" value="${mod.weightPercent ?? 20}" style="width: 80px;" title="Grade Weight %" onchange="editingModules[${modIdx}].weightPercent = parseFloat(this.value) || 0" />
          <input type="number" class="mod-lectures-input" min="1" max="5" placeholder="Slots" value="${mod.lectureCount || 1}" title="Calendar slots taken" onchange="editingModules[${modIdx}].lectureCount = parseInt(this.value, 10) || 1" />
          <button type="button" class="btn btn-cancel" onclick="removeModuleRow(${modIdx})">&times;</button>
        </div>
        <div class="nested-section" style="padding: 8px; background: rgba(0,0,0,0.2);">
          <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 6px; color: #c084fc;">Modules Covered in this Midterm:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${optionsHtml || '<em style="font-size:0.8rem; color:#94a3b8;">Add standard modules first to assign them here.</em>'}
          </div>
        </div>
      `;
    } else if (mod.isLab) {
      // LAB MODULE ROW
      if (!Array.isArray(mod.labs)) mod.labs = [];

      let labItemsHtml = mod.labs.map((lab, lIdx) => `
        <div class="nested-item-row" style="gap: 8px;">
          <span style="font-size:0.85rem; color:#a5f3fc; font-weight:600; min-width: 50px;">Lab ${lIdx + 1}:</span>
          <input type="text" placeholder="Lab Title / Experiment Name..." value="${lab.title || ''}" style="flex: 1;" onchange="editingModules[${modIdx}].labs[${lIdx}].title = this.value">
          <input type="number" step="0.5" placeholder="Hours" value="${lab.hours ?? 3}" style="width: 75px;" title="Lab Duration (Hours)" onchange="editingModules[${modIdx}].labs[${lIdx}].hours = parseFloat(this.value) || 0;">
          <input type="number" placeholder="Weight %" value="${lab.weightPercent ?? 0}" style="width: 85px;" title="Lab Weight %" onchange="editingModules[${modIdx}].labs[${lIdx}].weightPercent = parseFloat(this.value) || 0; updateLabTotalGrade(${modIdx});">
          <button type="button" class="btn btn-cancel btn-sm" onclick="removeLabItem(${modIdx}, ${lIdx})">&times;</button>
        </div>
      `).join('');

      wrapper.innerHTML = `
        <div class="module-header-row" style="background: rgba(6, 182, 212, 0.15); border-left: 4px solid #06b6d4; padding: 6px;">
          <span style="font-size:1.1rem;">🧪</span>
          <input type="text" placeholder="ID" value="${mod.id || ''}" style="width: 90px;" onchange="editingModules[${modIdx}].id = this.value">
          <input type="text" placeholder="Label (e.g. LABS)" value="${mod.label || ''}" style="width: 100px;" onchange="editingModules[${modIdx}].label = this.value">
          <input type="text" placeholder="Section Title (e.g. Practical Chemistry Labs)" value="${mod.title || ''}" style="flex: 1;" onchange="editingModules[${modIdx}].title = this.value">
          <div style="display:flex; align-items:center; gap:4px; font-size:0.85rem; color:#67e8f9; font-weight:600;">
            Total Grade: <span id="labTotalGrade-${modIdx}">${mod.weightPercent || 0}%</span>
          </div>
          <button type="button" class="btn btn-cancel" onclick="removeModuleRow(${modIdx})">&times;</button>
        </div>
        <div class="nested-section" style="padding: 8px; background: rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 600; font-size: 0.85rem; color: #67e8f9;">Individual Experiments (${mod.labs.length})</div>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-sm" style="border-color:#06b6d4; color:#67e8f9;" onclick="equalizeLabWeights(${modIdx})">⚖️ Equalize Weights</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="addLabItem(${modIdx})">+ Add Experiment</button>
            </div>
          </div>
          <div id="labs-${modIdx}">
            ${labItemsHtml || '<em style="font-size:0.8rem; color:#94a3b8;">No individual experiments added yet.</em>'}
          </div>
        </div>
      `;
    } else {
      // STANDARD MODULE ROW
      if (!Array.isArray(mod.topics)) mod.topics = [];
      if (!Array.isArray(mod.objectives)) mod.objectives = [];

      let html = `
        <div class="module-header-row">
          <input type="text" placeholder="ID" value="${mod.id || ''}" style="width: 100px;" onchange="editingModules[${modIdx}].id = this.value">
          <input type="text" placeholder="Label" value="${mod.label || ''}" style="width: 100px;" onchange="editingModules[${modIdx}].label = this.value">
          <input type="text" placeholder="Module Title" value="${mod.title || ''}" style="flex: 1;" onchange="editingModules[${modIdx}].title = this.value">
          <input type="number" class="mod-lectures-input" min="1" max="20" placeholder="Lectures" value="${mod.lectureCount || 1}" onchange="editingModules[${modIdx}].lectureCount = parseInt(this.value, 10) || 1" />
          <button type="button" class="btn btn-cancel" onclick="removeModuleRow(${modIdx})">&times;</button>
        </div>
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
            <input type="text" placeholder="Topic description..." value="${topicVal || ''}" style="flex: 1;" onchange="editingModules[${modIdx}].topics[${tIdx}] = this.value">
            <button type="button" class="btn btn-cancel btn-sm" onclick="removeTopicRow(${modIdx}, ${tIdx})">&times;</button>
          </div>
        `;
      });

      html += `</div></div><div class="nested-section">
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
            <input type="text" placeholder="Objective description..." value="${objVal || ''}" style="flex: 1;" onchange="editingModules[${modIdx}].objectives[${oIdx}] = this.value">
            <button type="button" class="btn btn-cancel btn-sm" onclick="removeObjectiveRow(${modIdx}, ${oIdx})">&times;</button>
          </div>
        `;
      });

      html += `</div></div>`;
      wrapper.innerHTML = html;
    }

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
    objectives: [],
    isExam: false,
    isLab: false
  });
  renderModulesList();
}

function addMidtermRow() {
  const courseIdEl = document.getElementById('courseId');
  const courseId = (courseIdEl && courseIdEl.value) ? courseIdEl.value : 'course';
  
  editingModules.push({
    id: `${courseId}-midterm-${editingModules.length + 1}`,
    label: `MIDTERM`,
    title: 'Midterm Examination',
    lectureCount: 1,
    weightPercent: 20,
    isExam: true,
    isLab: false,
    coveredModuleIds: []
  });
  renderModulesList();
}

function addLabRow() {
  const courseIdEl = document.getElementById('courseId');
  const courseId = (courseIdEl && courseIdEl.value) ? courseIdEl.value : 'course';

  editingModules.push({
    id: `${courseId}-labs`,
    label: `LABS`,
    title: 'Laboratory Component',
    isLab: true,
    isExam: false,
    weightPercent: 20,
    labs: [
      { title: 'Lab 1: Safety & Techniques', hours: 3, weightPercent: 5 },
      { title: 'Lab 2: Gravimetric Analysis', hours: 3, weightPercent: 5 },
      { title: 'Lab 3: Titration Practice', hours: 3, weightPercent: 5 },
      { title: 'Lab 4: Spectroscopy', hours: 3, weightPercent: 5 }
    ]
  });
  renderModulesList();
}

function addLabItem(modIdx) {
  if (!editingModules[modIdx].labs) editingModules[modIdx].labs = [];
  editingModules[modIdx].labs.push({
    title: `Lab ${editingModules[modIdx].labs.length + 1}`,
    hours: 3,
    weightPercent: 0
  });
  renderModulesList();
}

function removeLabItem(modIdx, labIdx) {
  editingModules[modIdx].labs.splice(labIdx, 1);
  updateLabTotalGrade(modIdx);
  renderModulesList();
}

function equalizeLabWeights(modIdx) {
  const labs = editingModules[modIdx].labs || [];
  if (labs.length === 0) return;

  const total = editingModules[modIdx].weightPercent || 20;
  const equalWeight = parseFloat((total / labs.length).toFixed(2));

  labs.forEach(lab => {
    lab.weightPercent = equalWeight;
  });

  renderModulesList();
}

function updateLabTotalGrade(modIdx) {
  const labs = editingModules[modIdx].labs || [];
  const total = labs.reduce((sum, l) => sum + (parseFloat(l.weightPercent) || 0), 0);
  editingModules[modIdx].weightPercent = parseFloat(total.toFixed(2));
  
  const labelEl = document.getElementById(`labTotalGrade-${modIdx}`);
  if (labelEl) labelEl.textContent = `${editingModules[modIdx].weightPercent}%`;
}

function toggleMidtermModule(midtermIdx, moduleId, isChecked) {
  if (!editingModules[midtermIdx].coveredModuleIds) {
    editingModules[midtermIdx].coveredModuleIds = [];
  }
  const set = new Set(editingModules[midtermIdx].coveredModuleIds);
  if (isChecked) {
    set.add(moduleId);
  } else {
    set.delete(moduleId);
  }
  editingModules[midtermIdx].coveredModuleIds = Array.from(set);
}

function removeModuleRow(index) {
  editingModules.splice(index, 1);
  renderModulesList();
}

function addTopicRow(modIndex) {
  if (!editingModules[modIndex].topics) editingModules[modIndex].topics = [];
  editingModules[modIndex].topics.push('');
  renderModulesList();
}

function removeTopicRow(modIndex, topicIndex) {
  editingModules[modIndex].topics.splice(topicIndex, 1);
  renderModulesList();
}

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

  const cleanedModules = editingModules.map((mod) => {
    if (mod.isExam) {
      return {
        id: mod.id || `midterm-${Date.now()}`,
        label: mod.label || 'MIDTERM',
        title: mod.title || 'Midterm Examination',
        lectureCount: parseInt(mod.lectureCount, 10) || 1,
        weightPercent: parseFloat(mod.weightPercent) || 0,
        isExam: true,
        isLab: false,
        coveredModuleIds: mod.coveredModuleIds || []
      };
    }
    if (mod.isLab) {
      const labs = (mod.labs || []).map(l => ({
        title: l.title || 'Lab Experiment',
        hours: parseFloat(l.hours) || 3,
        weightPercent: parseFloat(l.weightPercent) || 0
      }));
      const totalWeight = labs.reduce((sum, l) => sum + l.weightPercent, 0);

      return {
        id: mod.id || `labs-${Date.now()}`,
        label: mod.label || 'LABS',
        title: mod.title || 'Laboratory Component',
        weightPercent: parseFloat(totalWeight.toFixed(2)),
        isLab: true,
        isExam: false,
        labs: labs
      };
    }
    return {
      ...mod,
      isExam: false,
      isLab: false,
      topics: (mod.topics || [])
        .map((t) => (typeof t === 'object' ? (t.title || t.name || t.description || '') : t))
        .filter((t) => typeof t === 'string' && t.trim() !== ''),
      objectives: (mod.objectives || [])
        .map((o) => (typeof o === 'object' ? (o.title || o.statement || o.description || '') : o))
        .filter((o) => typeof o === 'string' && o.trim() !== '')
    };
  });

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

window.openCourseEditor = openCourseEditor;
window.openCourseModal = openCourseModal;
window.closeCourseModal = closeCourseModal;
window.switchTab = switchTab;
window.addModuleRow = addModuleRow;
window.addMidtermRow = addMidtermRow;
window.addLabRow = addLabRow;
window.addLabItem = addLabItem;
window.removeLabItem = removeLabItem;
window.equalizeLabWeights = equalizeLabWeights;
window.updateLabTotalGrade = updateLabTotalGrade;
window.toggleMidtermModule = toggleMidtermModule;
window.removeModuleRow = removeModuleRow;
window.addTopicRow = addTopicRow;
window.removeTopicRow = removeTopicRow;
window.addObjectiveRow = addObjectiveRow;
window.removeObjectiveRow = removeObjectiveRow;
window.addConnectionRow = addConnectionRow;
window.removeConnectionRow = removeConnectionRow;
window.saveCourseData = saveCourseData;