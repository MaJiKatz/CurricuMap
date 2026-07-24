/* ============================================================
   render.js
   DOM rendering without inline topic nodes on the map.
   ============================================================ */

  // Helper to format textbook string cleanly
  function formatTextbook(tb) {
    if (!tb) return 'None listed';
    if (typeof tb === 'string') return tb; // Handles simple string legacy data
    
    // Handles object format: { title, author, edition }
    const parts = [];
    if (tb.title) parts.push(`${tb.title}`);
    if (tb.author) parts.push(`by ${tb.author}`);
    if (tb.edition) parts.push(`(${tb.edition} ed.)`);

    return parts.length > 0 ? parts.join(' ') : 'None listed';
  }

  // In your drawer or card HTML template, replace:
  // ${course.textbook}
  // WITH:
  // ${formatTextbook(course.textbook)}

function renderBoard(data, collapsedCourses = new Set(), positions = {}) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  const years = groupCoursesByYear(data.courses);

  years.forEach(({ year, yearLabel, courses }) => {
    const yearBox = document.createElement('div');
    yearBox.className = 'year-box';
    yearBox.dataset.year = year;

    const header = document.createElement('div');
    header.className = 'year-box-header';
    header.textContent = yearLabel;
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
    if (!map.has(course.year)) {
      map.set(course.year, { year: course.year, yearLabel: course.yearLabel, courses: [] });
    }
    map.get(course.year).courses.push(course);
  });
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
  if (!container) return;
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
  if (!bar) return;
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

  if (!moduleId) {
    empty.hidden = false;
    content.hidden = true;
    return;
  }

  const mod = data.moduleById[moduleId];
  const course = data.courseByModuleId[moduleId];
  if (!mod || !course) return;

  empty.hidden = true;
  content.hidden = false;

  const chaptersText = mod.chapters ? `Ch. ${mod.chapters.join(', ')}` : '';
  const textbookText = formatTextbook(course.textbook) ? `<div class="drawer-textbook">📖 <strong>Textbook:</strong> ${escapeHtml(formatTextbook(course.textbook))}</div>` : '';

  const topicsHtml = mod.topics && mod.topics.length
    ? mod.topics.map((t) => {
        const sectionBadge = t.section ? `<span class="section-tag">Sec. ${escapeHtml(t.section)}</span>` : '';
        const objectivesHtml = t.objectives && t.objectives.length
          ? t.objectives.map((obj) => {
              const objText = typeof obj === 'string' ? obj : obj.text;
              const questions = obj.recommendedQuestions && obj.recommendedQuestions.length
                ? `<div class="obj-questions">💡 <em>Questions:</em> ${escapeHtml(obj.recommendedQuestions.join(', '))}</div>`
                : '';
              return `<div class="topic-objective">${escapeHtml(objText)}${questions}</div>`;
            }).join('')
          : '';

        return `
          <div class="topic-item">
            <div class="topic-title-row">
              <span class="topic-title">${escapeHtml(t.title)}</span>
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