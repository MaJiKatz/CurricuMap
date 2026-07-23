/* ============================================================
   main.js
   Supports JSON loading, starting collapsed by default, 
   and free-form dragging with dynamic year-box sizing.
   ============================================================ */

(function () {
  let DATA = null;

  const state = {
    activeTiers: new Set(['strong', 'related', 'weak']),
    mode: 'all',
    selectedModuleId: null,
    collapsedCourses: new Set(), // Will be populated with all IDs on init
    positions: {},
  };

  let draggingState = null;

  async function init() {
    try {
      DATA = await loadCurriculumData();
    } catch (err) {
      document.getElementById('board').innerHTML = `<p style="padding:20px;color:#a33;">Failed to load curriculum data.</p>`;
      return;
    }

    // 1. SET ALL COURSES TO BE COLLAPSED BY DEFAULT
    DATA.courses.forEach((course) => {
      state.collapsedCourses.add(course.id);
    });

    // 2. RENDER BOARD & INTERFACE
    renderBoard(DATA, state.collapsedCourses, state.positions);
    renderTierToggles(DATA.legend, state.activeTiers);
    renderLegendBar(DATA.legend);
    renderDrawer(DATA, null);

    wireEvents();

    // 3. FIT CANVASES & DRAW CONNECTIONS
    // Uses requestAnimationFrame so DOM layout is finalized before calculating card sizes
    requestAnimationFrame(() => {
      document.querySelectorAll('.year-canvas').forEach((canvas) => fitCanvasToContent(canvas));
      refreshVisuals();
    });
  }

  /**
   * Recalculates the bounding box of all course cards inside a canvas
   * and resizes the canvas to expand or shrink dynamically.
   */
  function fitCanvasToContent(canvas) {
    const cards = canvas.querySelectorAll('.course-card');
    let maxX = 0;
    let maxY = 0;

    cards.forEach((card) => {
      const left = parseFloat(card.style.left) || 0;
      const top = parseFloat(card.style.top) || 0;
      
      // Use offsetWidth / offsetHeight so collapsed height is measured accurately
      const right = left + card.offsetWidth;
      const bottom = top + card.offsetHeight;

      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    });

    const padding = 40; // Spacing margin around outer edges
    const minWidth = 480;
    const minHeight = 550;

    canvas.style.width = `${Math.max(minWidth, maxX + padding)}px`;
    canvas.style.height = `${Math.max(minHeight, maxY + padding)}px`;
  }

  function wireEvents() {
    const board = document.getElementById('board');

    board.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.drag-handle, .course-card-head');
      if (!handle || e.target.closest('.collapse-btn')) return;

      const card = handle.closest('.course-card');
      const canvas = card.closest('.year-canvas');
      if (!card || !canvas) return;

      const cardRect = card.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      draggingState = {
        card,
        canvas,
        courseId: card.dataset.courseId,
        offsetX: e.clientX - cardRect.left,
        offsetY: e.clientY - cardRect.top,
      };

      card.classList.add('is-dragging');
      card.setPointerCapture(e.pointerId);
    });

    board.addEventListener('pointermove', (e) => {
      if (!draggingState) return;

      const { card, canvas, offsetX, offsetY, courseId } = draggingState;
      const canvasRect = canvas.getBoundingClientRect();

      let x = e.clientX - canvasRect.left - offsetX;
      let y = e.clientY - canvasRect.top - offsetY;

      // Keep within top-left origin
      x = Math.max(0, x);
      y = Math.max(0, y);

      card.style.left = `${x}px`;
      card.style.top = `${y}px`;

      state.positions[courseId] = { x, y };

      // Dynamically shrink/grow canvas box while dragging
      fitCanvasToContent(canvas);
      drawConnections(DATA, state);
    });

    const stopDrag = (e) => {
      if (draggingState) {
        fitCanvasToContent(draggingState.canvas);
        draggingState.card.classList.remove('is-dragging');
        draggingState = null;
        refreshVisuals();
      }
    };

    board.addEventListener('pointerup', stopDrag);
    board.addEventListener('pointercancel', stopDrag);

    board.addEventListener('click', (e) => {
      const collapseBtn = e.target.closest('.collapse-btn');
      if (collapseBtn) {
        const card = collapseBtn.closest('.course-card');
        const canvas = card.closest('.year-canvas');
        const courseId = card.dataset.courseId;

        if (state.collapsedCourses.has(courseId)) {
          state.collapsedCourses.delete(courseId);
          card.classList.remove('is-collapsed');
          collapseBtn.textContent = '−';
        } else {
          state.collapsedCourses.add(courseId);
          card.classList.add('is-collapsed');
          collapseBtn.textContent = '+';
        }

        // Adjust canvas dimensions after collapse/expand height change
        if (canvas) fitCanvasToContent(canvas);
        refreshVisuals();
        return;
      }

      const chip = e.target.closest('.module-chip');
      if (chip) {
        const id = chip.dataset.moduleId;
        state.selectedModuleId = id === state.selectedModuleId ? null : id;
        renderDrawer(DATA, state.selectedModuleId);
        refreshVisuals();
      }
    });

    document.getElementById('tierToggles').addEventListener('change', (e) => {
      const input = e.target.closest('input[data-tier]');
      if (!input) return;
      const tier = input.dataset.tier;
      if (input.checked) state.activeTiers.add(tier);
      else state.activeTiers.delete(tier);

      input.closest('.tier-toggle').classList.toggle('is-off', !input.checked);
      refreshVisuals();
    });

    window.addEventListener('resize', () => drawConnections(DATA, state));
  }

  function refreshVisuals() {
    if (typeof drawConnections === 'function') {
      drawConnections(DATA, state);
    }
  }

/**
 * Opens a modal or prompt to Add or Edit a course.
 * @param {string|null} courseId - Pass ID to edit, or null/undefined to create new.
 */
window.openCourseModal = function(courseId = null) {
  let course = DATA.courses.find(c => c.id === courseId);

  const isEditing = !!course;
  const code = prompt(isEditing ? "Edit Course Code:" : "New Course Code (e.g. CHEM 304):", course ? course.code : "");
  if (!code) return;

  const name = prompt("Course Name:", course ? course.name : "");
  if (!name) return;

  const year = parseInt(prompt("Year Number (1, 2, 3, etc.):", course ? course.year : "1"), 10) || 1;
  const textbook = prompt("Textbook Name/Edition:", course ? course.textbook || "" : "");

  if (isEditing) {
    // Update existing course
    course.code = code;
    course.name = name;
    course.year = year;
    course.yearLabel = `Year ${year}`;
    course.textbook = textbook;
  } else {
    // Create new course
    const newId = `course-${Date.now()}`;
    const newCourse = {
      id: newId,
      code: code,
      name: name,
      year: year,
      yearLabel: `Year ${year}`,
      textbook: textbook,
      modules: [
        {
          id: `m-${newId}-1`,
          label: "MOD 01",
          title: "Introduction",
          chapters: [1],
          topics: []
        }
      ]
    };
    DATA.courses.push(newCourse);
    
    // Default the new course card to collapsed state
    state.collapsedCourses.add(newId);
  }

  // Re-index data maps
  reindexData();

  // Re-render board with updated dataset
  renderBoard(DATA, state.collapsedCourses, state.positions);
  
  // Re-fit canvas layout & redraw SVG connection lines
  requestAnimationFrame(() => {
    document.querySelectorAll('.year-canvas').forEach((canvas) => fitCanvasToContent(canvas));
    if (typeof drawConnections === 'function') drawConnections(DATA, state);
  });
};

/**
 * Re-indexes lookup tables when courses are added or modified.
 */
function reindexData() {
  DATA.moduleById = {};
  DATA.courseByModuleId = {};

  DATA.courses.forEach((course) => {
    course.modules.forEach((mod) => {
      DATA.moduleById[mod.id] = mod;
      DATA.courseByModuleId[mod.id] = course;
    });
  });
}

  document.addEventListener('DOMContentLoaded', init);
})();