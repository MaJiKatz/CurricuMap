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
        <button class="btn btn-primary" onclick="window.openCourseEditor()" style="margin-top: 15px; padding: 10px 20px; font-size: 1rem;">
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
      // Default initial layout spacing optimized for collapsed card height (~70px)
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
    // Parse year accurately without defaulting 0 to 1
    const rawYear = course.year;
    const yr = (rawYear !== undefined && rawYear !== null && !isNaN(rawYear)) ? Number(rawYear) : 1;

    // Use explicit fallback for yearLabel based on numeric yr
    const yrLabel = course.yearLabel || (yr === 0 ? 'Pre-University' : `Year ${yr}`);
    
    // Key strictly by numeric year so year 0 and year 1 NEVER mix
    const key = `year-${yr}`;

    if (!map.has(key)) {
      map.set(key, { year: yr, yearLabel: yrLabel, courses: [] });
    }
    map.get(key).courses.push(course);
  });

  // Sort sequentially: Year 0 (Pre-Uni), Year 1, Year 2, etc.
  return Array.from(map.values()).sort((a, b) => a.year - b.year);
}

function renderCourseCard(course, isCollapsed) {
  const card = document.createElement('div');
  card.className = `course-card ${isCollapsed ? 'is-collapsed' : ''}`;
  card.dataset.courseId = course.id;

  const head = document.createElement('div');
  head.className = 'course-card-head';
  head.innerHTML = `
    <div class="head-meta">
      <span class="drag-handle" title="Drag anywhere in year box">✢</span>
      <div class="course-code">${escapeHtml(course.code)}</div>
      <button type="button" class="btn-edit-course" title="Edit Course" onclick="event.stopPropagation(); if(window.openCourseEditor) window.openCourseEditor('${course.id}')">⚙️</button>
      <button type="button" class="btn-delete-course" title="Delete Course" onclick="event.stopPropagation(); if(window.deleteCourse) window.deleteCourse('${course.id}')">&times;</button>
      <button type="button" class="collapse-btn" aria-label="Toggle expansion">
        ${isCollapsed ? '+' : '−'}
      </button>
    </div>
    <h3 class="course-name">${escapeHtml(course.name)}</h3>
  `;
  card.appendChild(head);

  const list = document.createElement('div');
  list.className = 'module-list';

  (course.modules || []).forEach((mod) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'module-chip';
    chip.dataset.moduleId = mod.id;
    chip.innerHTML = `
      <span class="m-label">${escapeHtml(mod.label)}</span>
      <span class="m-title">${escapeHtml(mod.title)}</span>
    `;
    list.appendChild(chip);
  });

  card.appendChild(list);
  return card;
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
      <button class="btn-edit-course" onclick="window.openCourseEditor('${mod.id}')" title="Edit Course">
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

window.renderBoard = renderBoard;
window.renderTierToggles = renderTierToggles;
window.renderLegendBar = renderLegendBar;
window.renderDrawer = renderDrawer;