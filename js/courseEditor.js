/* ============================================================
   js/courseEditor.js
   Handles course modal interactions, module/midterm/lab management, 
   nested topics/objectives/questions editing, and connections.
   ============================================================ */

let currentCourse = null;
let editingModules = [];
let editingConnections = [];

// Helper to reliably read total lecture count across property variations
function getModuleLectureCount(mod) {
  if (!mod) return 0;
  const val = mod.lectureCount ?? mod.lectures ?? mod.totalLectures ?? mod.lecture_count;
  return parseInt(val, 10) || 0;
}

// Helper to calculate sum of topic lectures in a module
function getModuleTopicsSum(module) {
  if (!module || !Array.isArray(module.topics)) return 0;
  return module.topics.reduce((sum, topic) => {
    if (typeof topic === 'string') return sum + 1;
    const val = parseFloat(topic.lectureCount ?? topic.lectures ?? topic.hours) || 1;
    return sum + val;
  }, 0);
}

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
    ? JSON.parse(JSON.stringify(courseData.modules)).map(mod => {
        const topicSum = getModuleTopicsSum(mod);
        const existingLec = getModuleLectureCount(mod);
        const targetLec = Math.max(existingLec, topicSum, 1);
        return {
          ...mod,
          lectureCount: targetLec,
          lectures: targetLec
        };
      })
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

function handleModuleLecturesInputChange(modIdx, inputElement) {
  syncModulesFromDOM();
  const mod = editingModules[modIdx];
  if (!mod) return;

  const topicSum = getModuleTopicsSum(mod);
  let newVal = parseInt(inputElement.value, 10) || 0;

  if (newVal < topicSum) {
    newVal = topicSum;
    inputElement.value = newVal;
  }

  mod.lectureCount = newVal;
  mod.lectures = newVal;
}

// Scrapes DOM inputs into memory before re-rendering or saving
function syncModulesFromDOM() {
  const container = document.getElementById('moduleList');
  if (!container) return;

  const moduleContainers = container.querySelectorAll('.module-row-container');
  moduleContainers.forEach((wrapper, modIdx) => {
    const mod = editingModules[modIdx];
    if (!mod || mod.isExam || mod.isLab) return;

    const modLecturesInput = wrapper.querySelector('.input-module-lectures');
    const topicCards = wrapper.querySelectorAll('.topic-editor-card');
    const updatedTopics = [];

    topicCards.forEach((card) => {
      const titleIn = card.querySelector('.input-topic-title');
      const descIn = card.querySelector('.input-topic-desc');
      const lecIn = card.querySelector('.input-topic-lectures');

      const objInputs = card.querySelectorAll('.input-topic-obj');
      const objectives = [];
      objInputs.forEach((i) => objectives.push(i.value));

      const questInputs = card.querySelectorAll('.input-topic-quest');
      const questions = [];
      questInputs.forEach((i) => questions.push(i.value));

      updatedTopics.push({
        title: titleIn ? titleIn.value : '',
        description: descIn ? descIn.value : '',
        lectureCount: lecIn ? (parseInt(lecIn.value, 10) || 1) : 1,
        learningObjectives: objectives,
        textbookQuestions: questions
      });
    });

    mod.topics = updatedTopics;

    const topicSum = getModuleTopicsSum(mod);
    const existingVal = getModuleLectureCount(mod);
    const domVal = modLecturesInput ? parseInt(modLecturesInput.value, 10) : NaN;
    
    let explicitModLectures = !isNaN(domVal) ? domVal : existingVal;
    if (explicitModLectures < topicSum) {
      explicitModLectures = topicSum;
    }

    mod.lectureCount = explicitModLectures;
    mod.lectures = explicitModLectures;
  });
}

function renderModulesList() {
  const container = document.getElementById('moduleList');
  const countEl = document.getElementById('moduleCount');
  if (countEl) countEl.textContent = editingModules.length;
  if (!container) return;

  if (editingModules.length === 0) {
    container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; padding: 12px; text-align: center;">No modules added yet. Click a button above to add one.</p>';
    return;
  }

  let html = '';

  editingModules.forEach((mod, modIdx) => {
    if (mod.isExam) {
      const allOtherMods = editingModules.filter((m) => !m.isExam && !m.isLab);
      const coveredSet = new Set(mod.coveredModuleIds || []);

      const coveredCheckboxesHtml = allOtherMods.map((m) => {
        const isChecked = coveredSet.has(m.id) ? 'checked' : '';
        return `
          <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; color: #cbd5e1; background: #1e293b; padding: 2px 6px; border-radius: 4px; border: 1px solid #334155;">
            <input type="checkbox" ${isChecked} onchange="toggleMidtermModule(${modIdx}, '${m.id}', this.checked)">
            ${escapeHtml(m.label || m.id)}
          </label>
        `;
      }).join(' ');

      html += `
        <div class="module-row-container exam-row" style="border-left: 4px solid #a855f7; background: rgba(168, 85, 247, 0.05); padding: 12px; margin-bottom: 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 700; color: #c084fc;">📝 EXAM</span>
            <input type="text" value="${escapeHtml(mod.label || 'MIDTERM')}" onchange="editingModules[${modIdx}].label = this.value" placeholder="Label" style="width: 100px;">
            <input type="text" value="${escapeHtml(mod.title || '')}" onchange="editingModules[${modIdx}].title = this.value" placeholder="Exam Title" style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <label style="font-size: 0.75rem; color: #94a3b8;">Weight %:</label>
              <input type="number" value="${mod.weightPercent ?? 20}" onchange="editingModules[${modIdx}].weightPercent = parseFloat(this.value) || 0" style="width: 60px;">
            </div>
            <button type="button" class="btn btn-cancel btn-sm" onclick="removeModuleRow(${modIdx})" title="Delete Exam">&times;</button>
          </div>
          <div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">Covered Modules:</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${coveredCheckboxesHtml || '<span style="font-size: 0.75rem; color: #64748b;">No regular modules available to map yet.</span>'}
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (mod.isLab) {
      const labs = mod.labs || [];
      let labsListHtml = '';

      labs.forEach((lab, labIdx) => {
        labsListHtml += `
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px; background: #0f172a; padding: 6px; border-radius: 4px; border: 1px solid #334155;">
            <input type="text" value="${escapeHtml(lab.title || '')}" onchange="editingModules[${modIdx}].labs[${labIdx}].title = this.value" placeholder="Lab Title" style="flex: 1; font-size: 0.85rem;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Hours:</label>
              <input type="number" value="${lab.hours ?? 3}" onchange="editingModules[${modIdx}].labs[${labIdx}].hours = parseFloat(this.value) || 0" style="width: 50px; font-size: 0.85rem;">
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Weight %:</label>
              <input type="number" value="${lab.weightPercent ?? 0}" step="0.5" onchange="editingModules[${modIdx}].labs[${labIdx}].weightPercent = parseFloat(this.value) || 0; updateLabTotalGrade(${modIdx});" style="width: 60px; font-size: 0.85rem;">
            </div>
            <button type="button" class="btn btn-cancel btn-sm" onclick="removeLabItem(${modIdx}, ${labIdx})" title="Delete Lab">&times;</button>
          </div>
        `;
      });

      html += `
        <div class="module-row-container lab-row" style="border-left: 4px solid #06b6d4; background: rgba(6, 182, 212, 0.05); padding: 12px; margin-bottom: 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 700; color: #67e8f9;">🧪 LABS</span>
            <input type="text" value="${escapeHtml(mod.label || 'LABS')}" onchange="editingModules[${modIdx}].label = this.value" placeholder="Label" style="width: 90px;">
            <input type="text" value="${escapeHtml(mod.title || '')}" onchange="editingModules[${modIdx}].title = this.value" placeholder="Lab Section Title" style="flex: 1;">
            <div style="font-size: 0.85rem; font-weight: 600; color: #67e8f9; padding: 0 6px;">
              Total: <span id="labTotalGrade-${modIdx}">${mod.weightPercent ?? 0}%</span>
            </div>
            <button type="button" class="btn btn-cancel btn-sm" onclick="removeModuleRow(${modIdx})" title="Delete Lab Section">&times;</button>
          </div>

          <div style="margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Experiments / Modules</span>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="equalizeLabWeights(${modIdx})" style="font-size: 0.7rem;">Equalize Weights</button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="addLabItem(${modIdx})" style="font-size: 0.7rem;">+ Add Experiment</button>
              </div>
            </div>
            ${labsListHtml || '<p style="font-size: 0.8rem; color: #64748b;">No experiments added yet.</p>'}
          </div>
        </div>
      `;
      return;
    }

    const topicSum = getModuleTopicsSum(mod);
    const existingLec = getModuleLectureCount(mod);
    const effectiveModLectures = Math.max(existingLec, topicSum);

    mod.lectureCount = effectiveModLectures;
    mod.lectures = effectiveModLectures;

    let topicsHtml = '';
    if (Array.isArray(mod.topics)) {
      mod.topics.forEach((topic, tIdx) => {
        if (typeof topic !== 'object' || topic === null) {
          topic = { title: typeof topic === 'string' ? topic : '', description: '', lectureCount: 1, learningObjectives: [], textbookQuestions: [] };
          mod.topics[tIdx] = topic;
        }
        if (!Array.isArray(topic.learningObjectives)) topic.learningObjectives = [];
        if (!Array.isArray(topic.textbookQuestions)) topic.textbookQuestions = [];

        topicsHtml += `
          <div class="topic-editor-card" style="background: rgba(15, 23, 42, 0.5); border: 1px solid #334155; border-radius: 6px; padding: 10px; margin-bottom: 12px; position: relative;">
            <button type="button" class="btn btn-cancel btn-sm" style="position: absolute; top: 8px; right: 8px;" onclick="removeTopicRow(${modIdx}, ${tIdx})" title="Delete Topic">&times;</button>
            
            <div style="display: flex; gap: 8px; margin-bottom: 8px; padding-right: 28px;">
              <div style="flex: 1;">
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px;">Topic Title</label>
                <input type="text" class="input-topic-title" placeholder="e.g. First Law of Thermodynamics" value="${escapeHtml(topic.title || '')}" style="width: 100%;">
              </div>
              <div style="width: 90px;">
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px;">Lectures</label>
                <input type="number" class="input-topic-lectures" min="1" max="20" placeholder="1" value="${topic.lectureCount || 1}" style="width: 100%;">
              </div>
            </div>

            <div style="margin-bottom: 8px;">
              <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px;">Description</label>
              <textarea class="input-topic-desc" placeholder="Brief overview of topic..." rows="2" style="width: 100%; font-size: 0.85rem; padding: 4px 6px; background: #0f172a; border: 1px solid #334155; color: #f8fafc; border-radius: 4px;">${escapeHtml(topic.description || '')}</textarea>
            </div>

            <div style="margin-bottom: 8px; padding: 6px; background: rgba(0, 0, 0, 0.2); border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #38bdf8;">🎯 Learning Objectives</span>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 1px 6px;" onclick="addTopicObjective(${modIdx}, ${tIdx})">+ Add</button>
              </div>
              <div id="topic-objectives-${modIdx}-${tIdx}">
                ${topic.learningObjectives.map((obj, oIdx) => `
                  <div class="nested-item-row" style="display: flex; margin-bottom: 4px; gap: 4px;">
                    <input type="text" class="input-topic-obj" placeholder="Objective..." value="${escapeHtml(obj || '')}" style="flex: 1; font-size: 0.8rem;">
                    <button type="button" class="btn btn-cancel btn-sm" onclick="removeTopicObjective(${modIdx}, ${tIdx}, ${oIdx})">&times;</button>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="padding: 6px; background: rgba(0, 0, 0, 0.2); border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #a7f3d0;">📖 Recommended Questions</span>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 1px 6px;" onclick="addTopicQuestion(${modIdx}, ${tIdx})">+ Add</button>
              </div>
              <div id="topic-questions-${modIdx}-${tIdx}">
                ${topic.textbookQuestions.map((quest, qIdx) => `
                  <div class="nested-item-row" style="display: flex; margin-bottom: 4px; gap: 4px;">
                    <input type="text" class="input-topic-quest" placeholder="e.g., Ch. 5, #12, #18..." value="${escapeHtml(quest || '')}" style="flex: 1; font-size: 0.8rem;">
                    <button type="button" class="btn btn-cancel btn-sm" onclick="removeTopicQuestion(${modIdx}, ${tIdx}, ${qIdx})">&times;</button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      });
    }

    html += `
      <div class="module-row-container" style="background: #1e293b; padding: 12px; margin-bottom: 12px; border-radius: 6px; border: 1px solid #334155;">
        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
          <input type="text" value="${escapeHtml(mod.label || '')}" onchange="editingModules[${modIdx}].label = this.value" placeholder="MOD 01" style="width: 90px;">
          <input type="text" value="${escapeHtml(mod.title || '')}" onchange="editingModules[${modIdx}].title = this.value" placeholder="Module Title" style="flex: 1;">
          
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Total Lectures:</label>
            <input 
              type="number" 
              class="input-module-lectures" 
              min="${topicSum}" 
              value="${effectiveModLectures}" 
              onchange="handleModuleLecturesInputChange(${modIdx}, this)" 
              style="width: 65px;"
              title="Total Module Lectures (Min: ${topicSum} based on topics)"
            />
          </div>

          <button type="button" class="btn btn-cancel btn-sm" onclick="removeModuleRow(${modIdx})" title="Delete Module">&times;</button>
        </div>

        <div style="margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Topics (${(mod.topics || []).length})</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addTopicRow(${modIdx})" style="font-size: 0.7rem;">+ Add Topic</button>
          </div>
          ${topicsHtml || '<p style="font-size: 0.8rem; color: #64748b; margin-bottom: 8px;">No topics defined for this module.</p>'}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function addModuleRow() {
  syncModulesFromDOM();
  const courseIdEl = document.getElementById('courseId');
  const courseId = (courseIdEl && courseIdEl.value) ? courseIdEl.value : 'course';
  
  editingModules.push({
    id: `${courseId}-m${editingModules.length + 1}`,
    label: `MOD 0${editingModules.length + 1}`,
    title: 'New Module',
    lectureCount: 3,
    lectures: 3,
    topics: [],
    isExam: false,
    isLab: false
  });
  renderModulesList();
}

function addMidtermRow() {
  syncModulesFromDOM();
  const courseIdEl = document.getElementById('courseId');
  const courseId = (courseIdEl && courseIdEl.value) ? courseIdEl.value : 'course';
  
  editingModules.push({
    id: `${courseId}-midterm-${editingModules.length + 1}`,
    label: `MIDTERM`,
    title: 'Midterm Examination',
    lectureCount: 1,
    lectures: 1,
    weightPercent: 20,
    isExam: true,
    isLab: false,
    coveredModuleIds: []
  });
  renderModulesList();
}

function addLabRow() {
  syncModulesFromDOM();
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
  syncModulesFromDOM();
  if (!editingModules[modIdx].labs) editingModules[modIdx].labs = [];
  editingModules[modIdx].labs.push({
    title: `Lab ${editingModules[modIdx].labs.length + 1}`,
    hours: 3,
    weightPercent: 0
  });
  renderModulesList();
}

function removeLabItem(modIdx, labIdx) {
  syncModulesFromDOM();
  editingModules[modIdx].labs.splice(labIdx, 1);
  updateLabTotalGrade(modIdx);
  renderModulesList();
}

function equalizeLabWeights(modIdx) {
  syncModulesFromDOM();
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
  syncModulesFromDOM();
  editingModules.splice(index, 1);
  renderModulesList();
}

function addTopicRow(modIndex) {
  syncModulesFromDOM();

  const mod = editingModules[modIndex];
  if (!mod) return;

  if (!mod.topics) mod.topics = [];

  // Preserve the module's existing lecture allocation.
  // Adding a topic should never reduce the number of lectures.
  const existingLectures = getModuleLectureCount(mod);

  mod.topics.push({
    title: '',
    description: '',
    lectureCount: 1,
    learningObjectives: [],
    textbookQuestions: []
  });

  // Only increase the module allocation if the topics
  // now require more lectures than were originally allocated.
  const topicSum = getModuleTopicsSum(mod);
  const finalLectures = Math.max(existingLectures, topicSum, 1);

  mod.lectureCount = finalLectures;
  mod.lectures = finalLectures;

  renderModulesList();
}

function removeTopicRow(modIndex, topicIndex) {
  syncModulesFromDOM();
  editingModules[modIndex].topics.splice(topicIndex, 1);
  renderModulesList();
}

function addTopicObjective(modIdx, topicIdx) {
  syncModulesFromDOM();
  const topic = editingModules[modIdx].topics[topicIdx];
  if (topic) {
    if (!Array.isArray(topic.learningObjectives)) topic.learningObjectives = [];
    topic.learningObjectives.push('');
    renderModulesList();
  }
}

function removeTopicObjective(modIdx, topicIdx, objIdx) {
  syncModulesFromDOM();
  const topic = editingModules[modIdx].topics[topicIdx];
  if (topic && topic.learningObjectives) {
    topic.learningObjectives.splice(objIdx, 1);
    renderModulesList();
  }
}

function addTopicQuestion(modIdx, topicIdx) {
  syncModulesFromDOM();
  const topic = editingModules[modIdx].topics[topicIdx];
  if (topic) {
    if (!Array.isArray(topic.textbookQuestions)) topic.textbookQuestions = [];
    topic.textbookQuestions.push('');
    renderModulesList();
  }
}

function removeTopicQuestion(modIdx, topicIdx, qIdx) {
  syncModulesFromDOM();
  const topic = editingModules[modIdx].topics[topicIdx];
  if (topic && topic.textbookQuestions) {
    topic.textbookQuestions.splice(qIdx, 1);
    renderModulesList();
  }
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
  syncModulesFromDOM();

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
        lectures: parseInt(mod.lectureCount, 10) || 1,
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

    const cleanedTopics = (mod.topics || [])
      .map((t) => {
        if (typeof t === 'string') {
          return { title: t, description: '', lectureCount: 1, learningObjectives: [], textbookQuestions: [] };
        }
        return {
          title: t.title || '',
          description: t.description || '',
          lectureCount: parseInt(t.lectureCount, 10) || 1,
          learningObjectives: (t.learningObjectives || []).filter((o) => typeof o === 'string' && o.trim() !== ''),
          textbookQuestions: (t.textbookQuestions || []).filter((q) => typeof q === 'string' && q.trim() !== '')
        };
      })
      .filter((t) => t.title.trim() !== '' || t.description.trim() !== '' || t.learningObjectives.length > 0 || t.textbookQuestions.length > 0);

    const topicSum = getModuleTopicsSum({ topics: cleanedTopics });
    const existingLec = getModuleLectureCount(mod);
    const finalLec = Math.max(existingLec, topicSum);

    return {
      ...mod,
      lectureCount: finalLec,
      lectures: finalLec,
      isExam: false,
      isLab: false,
      topics: cleanedTopics
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
window.addTopicObjective = addTopicObjective;
window.removeTopicObjective = removeTopicObjective;
window.addTopicQuestion = addTopicQuestion;
window.removeTopicQuestion = removeTopicQuestion;
window.addConnectionRow = addConnectionRow;
window.removeConnectionRow = removeConnectionRow;
window.saveCourseData = saveCourseData;
window.renderModulesList = renderModulesList;
window.handleModuleLecturesInputChange = handleModuleLecturesInputChange;