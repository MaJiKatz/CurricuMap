/* ============================================================
   js/render.js
   DOM rendering for courses, modules, midterms, labs, and calendar view.
   ============================================================ */

function formatTopic(topic) {
  if (!topic) return '';
  if (typeof topic === 'string') return topic;
  return topic.title || topic.name || topic.description || JSON.stringify(topic);
}

function formatTextbook(tb) {
  if (!tb) return 'None listed';
  if (typeof tb === 'string') return tb;
  
  const parts = [];
  if (tb.title) parts.push(`${tb.title}`);
  if (tb.author) parts.push(`by ${tb.author}`);
  if (tb.edition) parts.push(`(${tb.edition} ed.)`);

  return parts.length > 0 ? parts.join(' ') : 'None listed';
}

function renderBoard(data, collapsedCourses = new Set(), positions = {}) {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';

  if (!data || !data.courses || data.courses.length === 0) {
    board.innerHTML = `
      <div class="empty-board-message" style="text-align: center; padding: 60px 20px; color: #a0aec0;">
        <h2>No courses found</h2>
        <p>Get started by building your first course.</p>
        <button class="btn btn-primary" onclick="if(window.openCourseEditor) window.openCourseEditor()" style="margin-top: 15px; padding: 10px 20px; font-size: 1rem;">
          + Add First Course
        </button>
      </div>
    `;
    return;
  }

  const years = groupCoursesByYear(data.courses);

  years.forEach(({ year, yearLabel, courses }) => {
    const yearBox = document.createElement('div');
    yearBox.className = 'year-box';
    yearBox.dataset.year = year;

    const header = document.createElement('div');
    header.className = 'year-box-header';
    header.textContent = yearLabel || `Year ${year}`;
    yearBox.appendChild(header);

    const canvas = document.createElement('div');
    canvas.className = 'year-canvas';
    canvas.dataset.year = year;

    courses.forEach((course, index) => {
      const pos = positions[course.id] || {
        x: 20 + (index % 2) * 230,
        y: 20 + Math.floor(index / 2) * 90,
      };

      const card = renderCourseCard(course, collapsedCourses.has(course.id));
      card.style.left = `${pos.x}px`;
      card.style.top = `${pos.y}px`;
      canvas.appendChild(card);
    });

    yearBox.appendChild(canvas);
    board.appendChild(yearBox);
  });
}

function groupCoursesByYear(courses) {
  const map = new Map();

  courses.forEach((course) => {
    const rawYear = course.year;
    const yr = (rawYear !== undefined && rawYear !== null && !isNaN(rawYear)) ? Number(rawYear) : 1;
    const yrLabel = course.yearLabel || (yr === 0 ? 'Pre-University' : `Year ${yr}`);
    const key = `year-${yr}`;

    if (!map.has(key)) {
      map.set(key, { year: yr, yearLabel: yrLabel, courses: [] });
    }
    map.get(key).courses.push(course);
  });

  return Array.from(map.values()).sort((a, b) => a.year - b.year);
}

function renderCourseCard(course, isCollapsed) {
  const card = document.createElement('div');
  card.className = `course-card ${isCollapsed ? 'is-collapsed' : ''}`;
  card.dataset.courseId = course.id;

  const head = document.createElement('div');
  head.className = 'course-card-head';
  
  const headMeta = document.createElement('div');
  headMeta.className = 'head-meta';
  
  const dragHandle = document.createElement('span');
  dragHandle.className = 'drag-handle';
  dragHandle.title = 'Drag anywhere in year box';
  dragHandle.textContent = '✢';
  headMeta.appendChild(dragHandle);

  const courseCode = document.createElement('div');
  courseCode.className = 'course-code';
  courseCode.textContent = course.code;
  headMeta.appendChild(courseCode);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'edit-course-btn btn-edit-course';
  editBtn.title = 'Edit Course';
  editBtn.innerHTML = '⚙️';
  editBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  editBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (typeof window.openCourseEditor === 'function') {
      window.openCourseEditor(course.id);
    }
  });
  headMeta.appendChild(editBtn);

  const calBtn = document.createElement('button');
  calBtn.type = 'button';
  calBtn.className = 'icon-btn cal-btn btn-calendar';
  calBtn.title = 'View Term Calendar';
  calBtn.style.background = 'none';
  calBtn.style.border = 'none';
  calBtn.style.cursor = 'pointer';
  calBtn.style.padding = '0 2px';
  calBtn.innerHTML = '📅';
  calBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  calBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (typeof window.openCalendarModal === 'function') {
      window.openCalendarModal(course);
    }
  });
  headMeta.appendChild(calBtn);

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'icon-btn btn-download-outline';
  downloadBtn.title = 'Download Course Outline (RTF)';
  downloadBtn.style.background = 'none';
  downloadBtn.style.border = 'none';
  downloadBtn.style.cursor = 'pointer';
  downloadBtn.style.padding = '0 2px';
  downloadBtn.innerHTML = '📄';
  downloadBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (typeof window.downloadCourseOutlineRTF === 'function') {
      window.downloadCourseOutlineRTF(course.id);
    }
  });
  headMeta.appendChild(downloadBtn);

  const actionControls = document.createElement('div');
  actionControls.style.display = 'inline-flex';
  actionControls.style.gap = '4px';
  actionControls.style.alignItems = 'center';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-delete-course';
  deleteBtn.title = 'Delete Course';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof window.deleteCourse === 'function') {
      window.deleteCourse(course.id);
    }
  });
  actionControls.appendChild(deleteBtn);

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'collapse-btn';
  collapseBtn.setAttribute('aria-label', 'Toggle expansion');
  collapseBtn.textContent = isCollapsed ? '+' : '−';
  actionControls.appendChild(collapseBtn);

  headMeta.appendChild(actionControls);
  head.appendChild(headMeta);
  
  const courseTitle = document.createElement('h3');
  courseTitle.className = 'course-name';
  courseTitle.textContent = course.name;
  head.appendChild(courseTitle);

  card.appendChild(head);

  // Module, Evaluation & Lab List Rendering
  const list = document.createElement('div');
  list.className = 'module-list';

  (course.modules || []).forEach((mod) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `module-chip ${mod.isExam ? 'midterm-chip' : ''} ${mod.isLab ? 'lab-chip' : ''}`;
    chip.draggable = true;
    chip.dataset.moduleId = mod.id;
    chip.dataset.courseId = course.id;

    const deleteBtnHtml = `
      <span 
        class="btn-delete-module" 
        title="Delete Item" 
        onclick="deleteModuleFromViewer('${course.id}', '${mod.id}', event)" 
        style="padding: 0 4px; font-weight: bold; cursor: pointer; opacity: 0.6; font-size: 1.1rem; line-height: 1;" 
        onmouseover="this.style.opacity='1'; this.style.color='#f87171';" 
        onmouseout="this.style.opacity='0.6'; this.style.color='inherit';"
      >&times;</span>
    `;

    if (mod.isExam) {
      chip.style.borderColor = '#a855f7';
      chip.style.background = 'rgba(107, 33, 168, 0.35)';
      const takeHomeBadge = mod.isTakeHome ? ' 🏠' : '';
      const weightBadge = mod.weightPercent ? ` <span style="font-size:0.75rem; background:#6b21a8; padding:1px 4px; border-radius:3px; color:#f3e8ff;">${mod.weightPercent}%</span>` : '';
      chip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span class="m-label" style="color: black; font-weight: 600;">📝 ${escapeHtml(mod.label)}${takeHomeBadge}${weightBadge}</span>
          ${deleteBtnHtml}
        </div>
        <span class="m-title" style="font-weight: 600; color: black;">${escapeHtml(mod.title)}</span>
      `;
    } else if (mod.isLab) {
      chip.style.borderColor = '#06b6d4';
      chip.style.background = 'rgba(6, 182, 212, 0.2)';
      const totalWeight = mod.weightPercent ? ` <span style="font-size:0.75rem; background:#0891b2; padding:1px 4px; border-radius:3px; color:#cffaffe0;">${mod.weightPercent}%</span>` : '';
      chip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span class="m-label" style="color: black; font-weight: 600;">🧪 ${escapeHtml(mod.label)}${totalWeight}</span>
          ${deleteBtnHtml}
        </div>
        <span class="m-title" style="font-weight: 600; color: black;">${escapeHtml(mod.title)}</span>
      `;
    } else {
      chip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span class="m-label">${escapeHtml(mod.label)}</span>
          ${deleteBtnHtml}
        </div>
        <span class="m-title">${escapeHtml(mod.title)}</span>
      `;
    }

    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        moduleId: mod.id,
        fromCourseId: course.id
      }));
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => chip.classList.add('is-dragging-chip'), 0); 
    });

    chip.addEventListener('dragend', () => {
      chip.classList.remove('is-dragging-chip');
    });

    list.appendChild(chip);
  });

  card.appendChild(list);
  return card;
}

// ==========================================
// CALENDAR MODAL FUNCTIONS
// (Paste/Replace this section inside your full render.js)
// ==========================================

function openCalendarModal(course) {
  let modal = document.getElementById('calendar-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'calendar-modal';
    modal.className = 'modal-backdrop hidden';
    document.body.appendChild(modal);
  }

  const config = window.currentCourseConfig || window.defaultScheduleConfig || {
    weeksInSemester: 12,
    meetingsPerWeek: 3,
    minutesPerMeeting: 50
  };

  const layout = typeof window.calculateCalendarLayout === 'function'
    ? window.calculateCalendarLayout(course, config)
    : { weeks: [] };

  let weeksHTML = '';

  (layout.weeks || []).forEach((week) => {
    let weekLecturesHTML = '';

    (week.slots || []).forEach((slot) => {
      const item = slot.lectureData;
      if (!item) return;

      // Handle In-Class Assessments inside class meeting slots
      if (item.isExam) {
        const weightText = item.weightPercent ? ` (${item.weightPercent}%)` : '';
        weekLecturesHTML += `
          <div class="cal-lecture-item cal-inclass-exam" style="background: rgba(220, 38, 38, 0.15); border-left: 3px solid #ef4444; padding: 6px 8px; border-radius: 4px; margin-bottom: 4px;">
            <span class="cal-lec-tag" style="color: #fca5a5; font-weight: 700;">
              📝 ${escapeHtml(item.moduleLabel || 'EXAM')}${weightText}
            </span>
            <div class="cal-lec-title" style="color: #fef2f2; font-weight: 600;">
              ${escapeHtml(item.title)}
            </div>
          </div>
        `;
      } else {
        // Standard Lecture Topic Slot
        const countLabel = item.totalInModule 
          ? ` (${item.lectureNumber}/${item.totalInModule})` 
          : '';

        let tagText = item.moduleLabel || '';
        if (item.moduleTitle) {
          tagText = `${item.moduleLabel}: ${item.moduleTitle}`;
        }

        let displayTitle = item.title;
        if (item.isPlaceholder) {
          displayTitle = item.moduleTitle || item.title;
        }

        weekLecturesHTML += `
          <div class="cal-lecture-item">
            <span class="cal-lec-tag">
              ${escapeHtml(tagText)}${countLabel}
            </span>
            <div class="cal-lec-title">${escapeHtml(displayTitle)}</div>
          </div>
        `;
      }
    });

    // Render Take-Home Assessments attached to this week
    let assessmentsHTML = '';
    if (week.assessments && week.assessments.length > 0) {
      const itemsList = week.assessments.map(asm => {
        const weightText = asm.weightPercent ? ` (${asm.weightPercent}%)` : '';
        return `
          <div class="cal-assessment-item" style="background: rgba(168, 85, 247, 0.2); border-left: 3px solid #a855f7; padding: 4px 8px; margin-top: 4px; border-radius: 4px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #d8b4fe;">
              🏠 ${escapeHtml(asm.label || 'Take-Home')}${weightText}
            </div>
            <div style="font-size: 0.85rem; color: #f3e8ff; font-weight: 600;">
              ${escapeHtml(asm.title)}
            </div>
          </div>
        `;
      }).join('');

      assessmentsHTML = `
        <div class="cal-assessments-block" style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #475569;">
          <div style="font-size: 0.7rem; font-weight: 700; color: #c084fc; text-transform: uppercase; margin-bottom: 2px;">
            📌 Take-Home / Due This Week
          </div>
          ${itemsList}
        </div>
      `;
    }

    weeksHTML += `
      <div class="cal-week-card">
        <div class="cal-week-header">Week ${week.weekNumber}</div>
        <div class="cal-week-body">
          ${weekLecturesHTML || '<div class="cal-empty">No lectures scheduled</div>'}
          ${assessmentsHTML}
        </div>
      </div>
    `;
  });

  modal.innerHTML = `
    <div class="calendar-modal-card">
      <div class="modal-header">
        <h2>📅 ${escapeHtml(course.code || 'Course')}: ${escapeHtml(course.name || 'Schedule')} Timeline</h2>
        <button type="button" class="close-modal-btn" onclick="closeCalendarModal()">&times;</button>
      </div>
      <div class="modal-body" style="overflow-y: auto;">
        <div class="calendar-grid">
          ${weeksHTML}
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('active');
}

function closeCalendarModal() {
  const modal = document.getElementById('calendar-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }
}



function renderTierToggles(legend, activeTiers) {
  const container = document.getElementById('tierToggles');
  if (!container || !legend) return;
  container.innerHTML = '';

  Object.entries(legend).forEach(([tierKey, tier]) => {
    const label = document.createElement('label');
    label.className = `tier-toggle tier-${tierKey}` + (activeTiers.has(tierKey) ? '' : ' is-off');
    label.innerHTML = `
      <input type="checkbox" data-tier="${tierKey}" ${activeTiers.has(tierKey) ? 'checked' : ''}>
      ${escapeHtml(tier.label)}
    `;
    container.appendChild(label);
  });
}

function renderLegendBar(legend) {
  const bar = document.getElementById('legendBar');
  if (!bar || !legend) return;
  bar.innerHTML = '';

  Object.entries(legend).forEach(([tierKey, tier]) => {
    const entry = document.createElement('div');
    entry.className = 'legend-entry';
    entry.innerHTML = `
      <span class="legend-swatch ${tierKey}"></span>
      <span><strong>${escapeHtml(tier.label)}</strong> — ${escapeHtml(tier.description)}</span>
    `;
    bar.appendChild(entry);
  });
}

function renderDrawer(data, moduleId) {
  const empty = document.getElementById('drawerEmpty');
  const content = document.getElementById('drawerContent');
  if (!empty || !content) return;

  if (!moduleId || !data) {
    empty.hidden = false;
    content.hidden = true;
    return;
  }

  const mod = data.moduleById ? data.moduleById[moduleId] : null;
  const course = data.courseByModuleId ? data.courseByModuleId[moduleId] : null;
  if (!mod || !course) {
    empty.hidden = false;
    content.hidden = true;
    return;
  }

  empty.hidden = true;
  content.hidden = false;

  if (mod.isExam) {
    const coveredMods = (mod.coveredModuleIds || [])
      .map(id => data.moduleById ? data.moduleById[id] : null)
      .filter(Boolean);

    const coveredHtml = coveredMods.length > 0
      ? coveredMods.map(m => `
          <div class="topic-item exam-covered-item">
            <strong>${escapeHtml(m.label)}:</strong> ${escapeHtml(m.title)}
          </div>
        `).join('')
      : '<p class="topic-objective">No specific modules mapped to this evaluation yet.</p>';

    content.innerHTML = `
      <div class="drawer-header-actions">
        <span class="drawer-course-code">${escapeHtml(course.code)} · 📝 ${escapeHtml(mod.label)}</span>
        <button class="btn-edit-course" onclick="if(window.openCourseEditor) window.openCourseEditor('${course.id}')" title="Edit Course">✏️</button>
      </div>
      <h2 class="drawer-title">${escapeHtml(mod.title)} ${mod.isTakeHome ? '<span style="font-size: 0.9rem; font-weight: normal;">(🏠 Take-Home)</span>' : ''}</h2>
      <div class="drawer-banner exam-banner">
        🎯 <strong>Grade Evaluation Weight:</strong> ${mod.weightPercent ?? 0}% of final grade.<br>
        ⏱️ <strong>Schedule Allocation:</strong> ${mod.lectureCount || 1} lecture block(s).
      </div>
      <div class="drawer-section-label">Scope & Covered Modules</div>
      ${coveredHtml}
    `;
    return;
  }

  if (mod.isLab) {
    const labsList = (mod.labs || []);
    const labsHtml = labsList.length > 0
      ? labsList.map((lab, i) => `
          <div class="topic-item lab-item">
            <div>
              <strong>Lab ${i + 1}:</strong> ${escapeHtml(lab.title)}
              <div class="lab-subtext">⏳ ${lab.hours ?? 3} hours per session</div>
            </div>
            <span class="lab-weight">${lab.weightPercent ?? 0}%</span>
          </div>
        `).join('')
      : '<p class="topic-objective">No individual experiments listed.</p>';

    content.innerHTML = `
      <div class="drawer-header-actions">
        <span class="drawer-course-code">${escapeHtml(course.code)} · 🧪 ${escapeHtml(mod.label)}</span>
        <button class="btn-edit-course" onclick="if(window.openCourseEditor) window.openCourseEditor('${course.id}')" title="Edit Course">✏️</button>
      </div>
      <h2 class="drawer-title">${escapeHtml(mod.title)}</h2>
      <div class="drawer-banner lab-banner">
        🧪 <strong>Total Laboratory Weight:</strong> ${mod.weightPercent ?? 0}% of final grade.
      </div>
      <div class="drawer-section-label">Laboratory Experiments (${labsList.length})</div>
      ${labsHtml}
    `;
    return;
  }

  const chaptersText = mod.chapters ? `Ch. ${mod.chapters.join(', ')}` : '';
  const formattedTb = typeof formatTextbook === 'function' ? formatTextbook(course.textbook) : '';
  const textbookText = formattedTb && formattedTb !== 'None listed' 
    ? `<div class="drawer-textbook">📖 <strong>Textbook:</strong> ${escapeHtml(formattedTb)}</div>` 
    : '';

  const topicsHtml = mod.topics && mod.topics.length
    ? mod.topics.map((t, idx) => {
        if (typeof t === 'string') {
          return `
            <div class="drawer-topic-block">
              <div class="topic-title-row"><span class="topic-title">${escapeHtml(t)}</span></div>
            </div>
            ${idx < mod.topics.length - 1 ? '<hr class="topic-divider">' : ''}
          `;
        }

        const titleText = t.title || t.name || 'Untitled Topic';
        
        const descHtml = t.description 
          ? `<div class="topic-description">${escapeHtml(t.description)}</div>` 
          : '';

        const rawObjectives = t.learningObjectives || t.objectives || [];
        const objectivesHtml = rawObjectives.length
          ? `
            <div class="topic-section">
              <span class="topic-section-label label-objectives">🎯 Learning Objectives</span>
              <ul class="topic-list">
                ${rawObjectives.map((obj) => {
                  const objText = typeof obj === 'string' ? obj : (obj.text || obj.statement || obj.title || '');
                  return `<li class="topic-list-item">${escapeHtml(objText)}</li>`;
                }).join('')}
              </ul>
            </div>
          `
          : '';

        const rawQuestions = t.textbookQuestions || [];
        const questionsHtml = rawQuestions.length
          ? `
            <div class="topic-section">
              <span class="topic-section-label label-questions">📖 Recommended Questions</span>
              <ul class="topic-list">
                ${rawQuestions.map((q) => `<li class="topic-list-item">${escapeHtml(q)}</li>`).join('')}
              </ul>
            </div>
          `
          : '';

        return `
          <div class="drawer-topic-block">
            <div class="topic-title-row">
              <span class="topic-title">${escapeHtml(titleText)}</span>
            </div>
            ${descHtml}
            ${objectivesHtml}
            ${questionsHtml}
          </div>
          ${idx < mod.topics.length - 1 ? '<hr class="topic-divider">' : ''}
        `;
      }).join('')
    : `<p class="topic-objective">No topics listed for this module.</p>`;

  content.innerHTML = `
    <div class="drawer-header-actions">
      <span class="drawer-course-code">${escapeHtml(course.code)} · ${escapeHtml(mod.label)} ${chaptersText ? `(${chaptersText})` : ''}</span>
      <button class="btn-edit-course" onclick="if(window.openCourseEditor) window.openCourseEditor('${course.id}')" title="Edit Course">✏️</button>
    </div>
    <h2 class="drawer-title">${escapeHtml(mod.title)}</h2>
    ${textbookText}
    <div class="drawer-section-label">Topics & Learning Objectives</div>
    ${topicsHtml}
  `;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function deleteModuleFromViewer(courseId, moduleId, event) {
  if (event) {
    event.stopPropagation();
  }

  const course = (window.DATA.courses || []).find((c) => c.id === courseId);
  if (!course || !course.modules) return;

  const targetModule = course.modules.find((m) => m.id === moduleId);
  if (!targetModule) return;

  const moduleName = targetModule.title || targetModule.label || 'this item';

  const confirmed = window.confirm(
    `Are you sure you want to delete "${moduleName}"?\n\nThis will remove it from the course timeline and clear its connections.`
  );
  if (!confirmed) return;

  course.modules = course.modules.filter((m) => m.id !== moduleId);

  const updatedConnections = (window.DATA.connections || []).filter(
    (c) => c.from !== moduleId && c.to !== moduleId
  );

  if (typeof window.onCourseSave === 'function') {
    window.onCourseSave(course, updatedConnections);
  } else if (typeof window.renderApp === 'function') {
    window.renderApp();
  }
}

window.deleteModuleFromViewer = deleteModuleFromViewer;
window.renderBoard = renderBoard;
window.renderTierToggles = renderTierToggles;
window.renderLegendBar = renderLegendBar;
window.renderDrawer = renderDrawer;
window.openCalendarModal = openCalendarModal;
window.closeCalendarModal = closeCalendarModal;