/* ============================================================
   main.js
   Supports JSON loading, starting collapsed by default, 
   and free-form dragging with dynamic year-box sizing.
   ============================================================ */

import { initStorageUI } from './storage.js';

(function () {
  let DATA = null;

  const state = {
    activeTiers: new Set(['strong', 'related', 'weak']),
    mode: 'all',
    selectedModuleId: null,
    collapsedCourses: new Set(),
    positions: {},
  };

  let draggingState = null;

  async function init() {
    try {
      DATA = await loadCurriculumData();
      window.DATA = DATA;
    } catch (err) {
      document.getElementById('board').innerHTML = `<p style="padding:20px;color:#a33;">Failed to load curriculum data.</p>`;
      return;
    }

    // 1. SET ALL COURSES TO COLLAPSED BY DEFAULT & LOAD POSITIONS
    DATA.courses.forEach((course) => {
      state.collapsedCourses.add(course.id);
      if (course.x !== undefined && course.y !== undefined) {
        state.positions[course.id] = { x: course.x, y: course.y };
      }
    });

    // 2. RENDER BOARD & INTERFACE
    renderBoard(DATA, state.collapsedCourses, state.positions);
    renderTierToggles(DATA.legend, state.activeTiers);
    renderLegendBar(DATA.legend);
    renderDrawer(DATA, null);

    wireEvents();

    // 3. WIRE STORAGE SAVE / LOAD BUTTONS
    initStorageUI(
      () => ({ 
        courses: DATA.courses, 
        connectionsData: { legend: DATA.legend, connections: DATA.connections } 
      }),
      ({ courses, connections }) => {
        DATA.courses = courses;
        if (connections) {
          DATA.connections = connections.connections || connections;
          if (connections.legend) DATA.legend = connections.legend;
        }

        reindexData();
        renderBoard(DATA, state.collapsedCourses, state.positions);
        
        requestAnimationFrame(() => {
          document.querySelectorAll('.year-canvas').forEach((canvas) => fitCanvasToContent(canvas));
          refreshVisuals();
        });
      }
    );

    // 4. FIT CANVASES & DRAW CONNECTIONS
    requestAnimationFrame(() => {
      document.querySelectorAll('.year-canvas').forEach((canvas) => fitCanvasToContent(canvas));
      refreshVisuals();
    });
  }

  function fitCanvasToContent(canvas) {
    const cards = canvas.querySelectorAll('.course-card');
    let maxX = 0;
    let maxY = 0;

    cards.forEach((card) => {
      const left = parseFloat(card.style.left) || 0;
      const top = parseFloat(card.style.top) || 0;
      
      const right = left + card.offsetWidth;
      const bottom = top + card.offsetHeight;

      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    });

    const padding = 40;
    const minWidth = 480;
    const minHeight = 550;

    canvas.style.width = `${Math.max(minWidth, maxX + padding)}px`;
    canvas.style.height = `${Math.max(minHeight, maxY + padding)}px`;
  }

  function wireEvents() {
    const board = document.getElementById('board');

    board.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.drag-handle, .course-card-head');
      if (!handle || e.target.closest('.collapse-btn, .btn-edit-course, .edit-course-btn')) return;

      const card = handle.closest('.course-card');
      const canvas = card.closest('.year-canvas');
      if (!card || !canvas) return;

      const cardRect = card.getBoundingClientRect();

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

      x = Math.max(0, x);
      y = Math.max(0, y);

      card.style.left = `${x}px`;
      card.style.top = `${y}px`;

      state.positions[courseId] = { x, y };

      fitCanvasToContent(canvas);
      drawConnections(DATA, state);
    });

    const stopDrag = () => {
      if (draggingState) {
        fitCanvasToContent(draggingState.canvas);
        draggingState.card.classList.remove('is-dragging');
        draggingState = null;
        refreshVisuals();
      }
    };

    board.addEventListener('pointerup', stopDrag);
    board.addEventListener('pointercancel', stopDrag);

    // Single unified click listener for board interactions
    board.addEventListener('click', (e) => {
      // Gear Button Clicked
      const editBtn = e.target.closest('.btn-edit-course, .edit-course-btn');
      if (editBtn) {
        e.stopPropagation();
        const card = editBtn.closest('.course-card');
        if (card && card.dataset.courseId && typeof window.openCourseEditor === 'function') {
          window.openCourseEditor(card.dataset.courseId);
        }
        return;
      }

      // Collapse (+) / (-) Button Clicked
      const collapseBtn = e.target.closest('.collapse-btn');
      if (collapseBtn) {
        e.stopPropagation();
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

        if (canvas) fitCanvasToContent(canvas);
        refreshVisuals();
        return;
      }

      // Module Chip Clicked
      const chip = e.target.closest('.module-chip');
      if (chip) {
        const id = chip.dataset.moduleId;
        state.selectedModuleId = id === state.selectedModuleId ? null : id;
        renderDrawer(DATA, state.selectedModuleId);
        refreshVisuals();
      }
    });

    const tierToggles = document.getElementById('tierToggles');
    if (tierToggles) {
      tierToggles.addEventListener('change', (e) => {
        const input = e.target.closest('input[data-tier]');
        if (!input) return;
        const tier = input.dataset.tier;
        if (input.checked) state.activeTiers.add(tier);
        else state.activeTiers.delete(tier);

        input.closest('.tier-toggle').classList.toggle('is-off', !input.checked);
        refreshVisuals();
      });
    }

    window.addEventListener('resize', () => drawConnections(DATA, state));
  }

  function refreshVisuals() {
    if (typeof drawConnections === 'function') {
      drawConnections(DATA, state);
    }
  }

  function reindexData() {
    DATA.moduleById = {};
    DATA.courseByModuleId = {};

    (DATA.courses || []).forEach((course) => {
      (course.modules || []).forEach((mod) => {
        DATA.moduleById[mod.id] = mod;
        DATA.courseByModuleId[mod.id] = course;
      });
    });
  }

  // Helper for lookup
  window.getCourseById = function(courseId) {
    if (!DATA) return { course: null, connections: [] };
    const course = DATA.courses.find((c) => c.id === courseId);
    return { course, connections: DATA.connections || [] };
  };

  // Saved course callback
  window.onCourseSave = function (updatedCourse, updatedConnections) {
    const existingIndex = DATA.courses.findIndex((c) => c.id === updatedCourse.id);

    if (existingIndex >= 0) {
      DATA.courses[existingIndex] = updatedCourse;
    } else {
      DATA.courses.push(updatedCourse);
    }

    if (Array.isArray(updatedConnections)) {
      updatedConnections.forEach((newConn) => {
        const connIdx = DATA.connections.findIndex((c) => c.id === newConn.id);
        if (connIdx >= 0) {
          DATA.connections[connIdx] = newConn;
        } else {
          DATA.connections.push(newConn);
        }
      });
    }

    reindexData();
    renderBoard(DATA, state.collapsedCourses, state.positions);

    requestAnimationFrame(() => {
      document.querySelectorAll('.year-canvas').forEach((canvas) => fitCanvasToContent(canvas));
      refreshVisuals();
    });
  };

  document.addEventListener('DOMContentLoaded', init);
})();