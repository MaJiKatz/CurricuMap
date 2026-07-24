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

    reindexData();

    // 1. SET ALL COURSES TO COLLAPSED BY DEFAULT & LOAD POSITIONS
    (DATA.courses || []).forEach((course) => {
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

        // RESET COLLAPSED STATE FOR NEWLY LOADED COURSES
        state.collapsedCourses.clear();
        (DATA.courses || []).forEach((course) => {
          state.collapsedCourses.add(course.id);
          if (course.x !== undefined && course.y !== undefined) {
            state.positions[course.id] = { x: course.x, y: course.y };
          }
        });

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

    // --- CONNECT MODE STATE ---
    let isConnectMode = false;
    let connectingSource = null;
    let tempLine = null;

    // 1. Connect Mode Toggle Button Listener
    const connectBtn = document.getElementById('connectModeBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        isConnectMode = !isConnectMode;
        connectBtn.textContent = isConnectMode ? '🔗 Connect Mode: ON' : '🔗 Connect Mode: OFF';
        connectBtn.classList.toggle('btn-primary', isConnectMode);
        document.body.classList.toggle('connect-mode-active', isConnectMode);
      });
    }

    // --- BOARD POINTER DOWN (Handles both Card Dragging & Connect Drawing) ---
    board.addEventListener('pointerdown', (e) => {
      // A. CONNECT MODE DRAWING START
      if (isConnectMode) {
        const node = e.target.closest('.module-chip, .course-card');
        if (!node) return;

        e.stopPropagation();

        const nodeId = node.dataset.moduleId || node.dataset.courseId;
        const rect = node.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();

        const startX = rect.left + rect.width / 2 - boardRect.left;
        const startY = rect.top + rect.height / 2 - boardRect.top;

        connectingSource = { id: nodeId, x: startX, y: startY };

        const svg = document.getElementById('connectionLayer');
        if (svg) {
          tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          tempLine.setAttribute('x1', startX);
          tempLine.setAttribute('y1', startY);
          tempLine.setAttribute('x2', startX);
          tempLine.setAttribute('y2', startY);
          tempLine.setAttribute('stroke', '#3b82f6');
          tempLine.setAttribute('stroke-width', '3');
          tempLine.setAttribute('stroke-dasharray', '5,5');
          svg.appendChild(tempLine);
        }
        return;
      }

      // B. STANDARD COURSE CARD DRAGGING
      const handle = e.target.closest('.drag-handle, .course-card-head');
      // FIX: Ignore click events on delete button as well so dragging isn't triggered
      if (!handle || e.target.closest('.collapse-btn, .btn-edit-course, .edit-course-btn, .btn-delete-course')) return;

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

    // --- POINTER MOVE (Handles both Card Dragging & Line Drawing) ---
    document.addEventListener('pointermove', (e) => {
      // Handle Line Drawing Preview
      if (isConnectMode && connectingSource && tempLine) {
        const boardRect = board.getBoundingClientRect();
        const currentX = e.clientX - boardRect.left;
        const currentY = e.clientY - boardRect.top;

        tempLine.setAttribute('x2', currentX);
        tempLine.setAttribute('y2', currentY);
        return;
      }

      // Handle Card Dragging
      if (draggingState) {
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
        if (typeof drawConnections === 'function') drawConnections(DATA, state);
      }
    });

    // --- POINTER UP / STOP DRAG ---
    const stopDrag = (e) => {
      // 1. Finish Drawing Connection
      if (isConnectMode && connectingSource) {
        if (tempLine) {
          tempLine.remove();
          tempLine = null;
        }

        const targetNode = document.elementFromPoint(e.clientX, e.clientY)?.closest('.module-chip, .course-card');
        const targetId = targetNode?.dataset.moduleId || targetNode?.dataset.courseId;

        if (targetId && targetId !== connectingSource.id) {
          const exists = DATA.connections.some(
            (c) => (c.from === connectingSource.id && c.to === targetId) ||
                   (c.from === targetId && c.to === connectingSource.id)
          );

          if (!exists) {
            const selectedLevel = document.getElementById('connectionTypeSelect')?.value || 'related';

            const newConn = {
              id: `conn-${Date.now()}`,
              from: connectingSource.id,
              to: targetId,
              level: selectedLevel,
              note: 'Created via Drawing Mode'
            };

            DATA.connections.push(newConn);
            refreshVisuals();
          }
        }

        connectingSource = null;
        return;
      }

      // 2. Finish Dragging Card
      if (draggingState) {
        fitCanvasToContent(draggingState.canvas);
        draggingState.card.classList.remove('is-dragging');
        draggingState = null;
        refreshVisuals();
      }
    };

    board.addEventListener('pointerup', stopDrag);
    board.addEventListener('pointercancel', stopDrag);

    // --- BOARD CLICK INTERACTIONS ---
    board.addEventListener('click', (e) => {
      if (isConnectMode) return;

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

      // Delete Button Clicked (Delegated Backup Handler)
      const deleteBtn = e.target.closest('.btn-delete-course');
      if (deleteBtn) {
        e.stopPropagation();
        const card = deleteBtn.closest('.course-card');
        if (card && card.dataset.courseId && typeof window.deleteCourse === 'function') {
          window.deleteCourse(card.dataset.courseId);
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

    // --- TIER TOGGLES ---
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

    window.addEventListener('resize', () => {
      if (typeof drawConnections === 'function') drawConnections(DATA, state);
    });
  }

  // Explicitly assign deleteCourse globally
  window.deleteCourse = function (courseId) {
    if (!DATA || !DATA.courses) return;

    const courseToDelete = DATA.courses.find((c) => c.id === courseId);
    if (!courseToDelete) return;

    const confirmMsg = `Are you sure you want to delete "${courseToDelete.code} - ${courseToDelete.name}"?`;
    if (!confirm(confirmMsg)) return;

    // 1. Gather all module IDs belonging to this course
    const moduleIds = (courseToDelete.modules || []).map((m) => m.id);
    const targetIds = new Set([courseId, ...moduleIds]);

    // 2. Filter out the course
    DATA.courses = DATA.courses.filter((c) => c.id !== courseId);

    // 3. Remove connections involving this course or its modules
    if (Array.isArray(DATA.connections)) {
      DATA.connections = DATA.connections.filter(
        (conn) => !targetIds.has(conn.from) && !targetIds.has(conn.to)
      );
    }

    // 4. Remove stored state
    if (state.positions) delete state.positions[courseId];
    if (state.collapsedCourses) state.collapsedCourses.delete(courseId);

    // 5. Re-index and re-render
    reindexData();
    renderBoard(DATA, state.collapsedCourses, state.positions);

    requestAnimationFrame(() => {
      document.querySelectorAll('.year-canvas').forEach((canvas) => fitCanvasToContent(canvas));
      refreshVisuals();
    });
  };

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