/* ============================================================
   render.js
   DOM rendering without inline topic nodes on the map.
   ============================================================ */

/**
 * Helper to safely extract and render topic text whether stored 
 * as a string or an object.
 */
function formatTopic(topic) {
  if (!topic) return '';
  if (typeof topic === 'string') return topic;
  return topic.title || topic.name || topic.description || JSON.stringify(topic);
}

/**
 * Helper to format textbook string or object cleanly.
 */
function formatTextbook(tb) {
  if (!tb) return 'None listed';
  if (typeof tb === 'string') return tb;
  
  const parts = [];
  if (tb.title) parts.push(`${tb.title}`);
  if (tb.author) parts.push(`by ${tb.author}`);
  if (tb.edition) parts.push(`(${tb.edition} ed.)`);

  return parts.length > 0 ? parts.join(' ') : 'None listed';
}

/**
 * Renders the primary year boxes and course cards with positioning fallback.
 */
function renderBoard(data, collapsedCourses = new Set(), positions = {}) {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';

  // Handle empty state when starting with no courses
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
  
  // 1. Header meta container
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

  // --- Gear / Edit Button ---
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

  // 2. Calendar Button
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

  // --- NEW: Download Outline (RTF) Button ---
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

  // 3. Delete & Collapse Controls
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

  // 4. Module List
  const list = document.createElement('div');
  list.className = 'module-list';

  (course.modules || []).forEach((mod) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'module-chip';
    chip.draggable = true;
    chip.dataset.moduleId = mod.id;
    chip.dataset.courseId = course.id;
    chip.innerHTML = `
      <span class="m-label">${escapeHtml(mod.label)}</span>
      <span class="m-title">${escapeHtml(mod.title)}</span>
    `;

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

/**
 * Opens the calendar modal displaying course modules across weeks.
 */
function openCalendarModal(course) {
  let modal = document.getElementById('calendar-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'calendar-modal';
    document.body.appendChild(modal);
  }

  const lecturesPerWeek = 3;
  const totalWeeks = 12;

  // Flatten modules into lecture slots
  const lectureStream = [];
  (course.modules || []).forEach((mod) => {
    const count = parseInt(mod.lectureCount, 10) || 1;
    for (let i = 1; i <= count; i++) {
      lectureStream.push({
        label: mod.label || 'MOD',
        title: mod.title || 'Untitled Module',
        index: i,
        total: count
      });
    }
  });

  // Render Week Grid
  let weeksHTML = '';
  let currentIdx = 0;

  for (let w = 1; w <= totalWeeks; w++) {
    let weekLecturesHTML = '';
    for (let l = 0; l < lecturesPerWeek; l++) {
      if (currentIdx < lectureStream.length) {
        const item = lectureStream[currentIdx];
        weekLecturesHTML += `
          <div class="cal-lecture-item">
            <span class="cal-lec-tag">${escapeHtml(item.label)} (${item.index}/${item.total})</span>
            <div class="cal-lec-title">${escapeHtml(item.title)}</div>
          </div>
        `;
        currentIdx++;
      }
    }

    weeksHTML += `
      <div class="cal-week-card">
        <div class="cal-week-header">Week ${w}</div>
        <div class="cal-week-body">
          ${weekLecturesHTML || '<div class="cal-empty">No lectures</div>'}
        </div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="calendar-modal-card">
      <div class="modal-header">
        <h2>📅 ${escapeHtml(course.code)}: ${escapeHtml(course.name)} Timeline</h2>
        <button type="button" class="close-modal-btn" onclick="const m = document.getElementById('calendar-modal'); m.classList.remove('active'); m.classList.add('hidden');">&times;</button>
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

  const chaptersText = mod.chapters ? `Ch. ${mod.chapters.join(', ')}` : '';
  const formattedTb = formatTextbook(course.textbook);
  const textbookText = formattedTb && formattedTb !== 'None listed' 
    ? `<div class="drawer-textbook">📖 <strong>Textbook:</strong> ${escapeHtml(formattedTb)}</div>` 
    : '';

  const topicsHtml = mod.topics && mod.topics.length
    ? mod.topics.map((t) => {
        if (typeof t === 'string') {
          return `<div class="topic-item"><div class="topic-title-row"><span class="topic-title">${escapeHtml(t)}</span></div></div>`;
        }
        const sectionBadge = t.section ? `<span class="section-tag">Sec. ${escapeHtml(t.section)}</span>` : '';
        const objectivesHtml = t.objectives && t.objectives.length
          ? t.objectives.map((obj) => {
              const objText = typeof obj === 'string' ? obj : (obj.text || obj.statement || obj.title);
              const questions = obj.recommendedQuestions && obj.recommendedQuestions.length
                ? `<div class="obj-questions">💡 <em>Questions:</em> ${escapeHtml(obj.recommendedQuestions.join(', '))}</div>`
                : '';
              return `<div class="topic-objective">${escapeHtml(objText)}${questions}</div>`;
            }).join('')
          : '';

        return `
          <div class="topic-item">
            <div class="topic-title-row">
              <span class="topic-title">${escapeHtml(formatTopic(t))}</span>
              ${sectionBadge}
            </div>
            ${objectivesHtml}
          </div>
        `;
      }).join('')
    : `<p class="topic-objective">No topics listed for this module.</p>`;

  content.innerHTML = `
    <div class="drawer-header-actions">
      <span class="drawer-course-code">${escapeHtml(course.code)} · ${escapeHtml(mod.label)} ${chaptersText ? `(${chaptersText})` : ''}</span>
      <button class="btn-edit-course" onclick="if(window.openCourseEditor) window.openCourseEditor('${mod.id}')" title="Edit Course">
        ✏️
      </button>
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

// Explicit Window assignments
window.renderBoard = renderBoard;
window.renderTierToggles = renderTierToggles;
window.renderLegendBar = renderLegendBar;
window.renderDrawer = renderDrawer;
window.openCalendarModal = openCalendarModal;