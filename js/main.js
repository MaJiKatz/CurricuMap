/* ============================================================
   main.js
   Supports JSON loading, starting collapsed by default, 
   and free-form dragging with dynamic year-box sizing.
   ============================================================ */

import { initStorageUI } from './storage.js';

// Default schedule configuration made globally accessible
window.defaultScheduleConfig = {
  weeksInSemester: 12,       // e.g., 10, 12, 14, 15, or 16 weeks
  meetingsPerWeek: 3,         // 2 or 3 lectures per week
  minutesPerMeeting: 50,      // 50 min (3x/wk) or 90 min (2x/wk)
  startWeekDay: 'Monday'      // optional anchor
};

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
    let isDraggingConnection = false;

    // Ensure SVG layer never blocks clicks
    const svg = document.getElementById('connectionLayer');
    if (svg) svg.style.pointerEvents = 'none';

    // Helper to toggle native draggable state on chips
    function setNativeDraggable(enabled) {
      document.querySelectorAll('.module-chip').forEach((chip) => {
        if (enabled) chip.setAttribute('draggable', 'true');
        else chip.removeAttribute('draggable');
      });
    }

    // 1. Connect Mode Toggle Button Listener
    const connectBtn = document.getElementById('connectModeBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        isConnectMode = !isConnectMode;
        connectBtn.textContent = isConnectMode ? '🔗 Connect Mode: ON' : '🔗 Connect Mode: OFF';
        connectBtn.classList.toggle('btn-primary', isConnectMode);
        document.body.classList.toggle('connect-mode-active', isConnectMode);

        setNativeDraggable(!isConnectMode);
        cancelConnection();
      });
    }

    function cancelConnection() {
      if (tempLine) {
        tempLine.remove();
        tempLine = null;
      }
      document.querySelectorAll('.is-connecting-source').forEach((el) => el.classList.remove('is-connecting-source'));
      connectingSource = null;
      isDraggingConnection = false;
    }

    // --- PREVENT NATIVE HTML5 DRAG IN CONNECT MODE ---
    board.addEventListener('dragstart', (e) => {
      if (isConnectMode) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // --- BOARD POINTER DOWN ---
    board.addEventListener('pointerdown', (e) => {
      if (isConnectMode) {
        const node = e.target.closest('.module-chip, .course-card');

        if (node) {
          e.stopPropagation();
          e.preventDefault();

          if (document.activeElement) document.activeElement.blur();
          if (window.getSelection) window.getSelection().removeAllRanges();

          const nodeId = node.dataset.moduleId || node.dataset.courseId;

          if (connectingSource && connectingSource.id !== nodeId && !isDraggingConnection) {
            completeConnection(nodeId);
            return;
          }

          cancelConnection();

          const svgEl = document.getElementById('connectionLayer');
          const svgRect = svgEl ? svgEl.getBoundingClientRect() : { left: 0, top: 0 };
          const rect = node.getBoundingClientRect();

          const startX = rect.left + rect.width / 2 - svgRect.left;
          const startY = rect.top + rect.height / 2 - svgRect.top;

          connectingSource = { id: nodeId, x: startX, y: startY, node };
          isDraggingConnection = true;
          node.classList.add('is-connecting-source');

          const selectedLevel = document.getElementById('connectionTypeSelect')?.value || 'related';

          if (svgEl) {
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tempLine.setAttribute('x1', startX);
            tempLine.setAttribute('y1', startY);
            tempLine.setAttribute('x2', startX);
            tempLine.setAttribute('y2', startY);
            tempLine.setAttribute('stroke', `var(--${selectedLevel}, #0066cc)`);
            tempLine.setAttribute('stroke-width', '3.5');
            tempLine.setAttribute('stroke-dasharray', '5,5');
            tempLine.style.pointerEvents = 'none';
            svgEl.appendChild(tempLine);
          }
          return;
        } else {
          cancelConnection();
          return;
        }
      }

      if (e.target.closest('.collapse-btn, .btn-edit-course, .edit-course-btn, .btn-delete-course, .btn-calendar, .btn-download-outline')) {
        return;
      }

      const handle = e.target.closest('.drag-handle, .course-card-head');
      if (!handle) return;
      
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

    window.addEventListener('pointermove', (e) => {
      if (isConnectMode && connectingSource && tempLine) {
        const svgEl = document.getElementById('connectionLayer');
        const svgRect = svgEl ? svgEl.getBoundingClientRect() : { left: 0, top: 0 };

        const currentX = e.clientX - svgRect.left;
        const currentY = e.clientY - svgRect.top;

        tempLine.setAttribute('x2', currentX);
        tempLine.setAttribute('y2', currentY);
        return;
      }

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

    function completeConnection(targetId) {
      if (!connectingSource || !targetId || targetId === connectingSource.id) {
        cancelConnection();
        return;
      }

      const exists = DATA.connections.some(
        (c) => (c.from === connectingSource.id && c.to === targetId) ||
               (c.from === targetId && c.to === connectingSource.id)
      );

      if (!exists) {
        const selectedLevel = document.getElementById('connectionTypeSelect')?.value || 'related';
        state.activeTiers.add(selectedLevel);

        const newConn = {
          id: `conn-${Date.now()}`,
          from: connectingSource.id,
          to: targetId,
          level: selectedLevel,
          note: 'Created via Connect Mode'
        };

        if (!Array.isArray(DATA.connections)) DATA.connections = [];
        DATA.connections.push(newConn);
        refreshVisuals();
      }

      cancelConnection();
    }

    const stopDrag = (e) => {
      if (isConnectMode && connectingSource) {
        if (isDraggingConnection) {
          const stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
          let targetNode = null;

          for (const el of stack) {
            const found = el.closest('.module-chip, .course-card');
            if (found && found !== connectingSource.node) {
              targetNode = found;
              break;
            }
          }

          if (targetNode) {
            const targetId = targetNode.dataset.moduleId || targetNode.dataset.courseId;
            completeConnection(targetId);
          } else {
            isDraggingConnection = false;
          }
        }
        return;
      }

      if (draggingState) {
        fitCanvasToContent(draggingState.canvas);
        draggingState.card.classList.remove('is-dragging');
        draggingState = null;
        refreshVisuals();
      }
    };

    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    board.addEventListener('dragover', (e) => {
      if (isConnectMode) {
        e.preventDefault();
        return;
      }

      const targetCard = e.target.closest('.course-card');
      if (targetCard) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        document.querySelectorAll('.module-chip.drag-over-top, .module-chip.drag-over-bottom').forEach(el => {
          el.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        const targetChip = e.target.closest('.module-chip');
        if (targetChip && !targetChip.classList.contains('is-dragging-chip')) {
           const rect = targetChip.getBoundingClientRect();
           const midPoint = rect.top + rect.height / 2;
           if (e.clientY < midPoint) {
             targetChip.classList.add('drag-over-top');
           } else {
             targetChip.classList.add('drag-over-bottom');
           }
        }
      }
    });

    board.addEventListener('dragleave', (e) => {
       const targetChip = e.target.closest('.module-chip');
       if (targetChip) {
          targetChip.classList.remove('drag-over-top', 'drag-over-bottom');
       }
    });

    board.addEventListener('drop', (e) => {
      if (isConnectMode) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const targetCard = e.target.closest('.course-card');
      if (!targetCard) return;

      e.preventDefault();
      
      document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
          el.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      const targetCourseId = targetCard.dataset.courseId;
      const dropChip = e.target.closest('.module-chip');
      const rect = dropChip ? dropChip.getBoundingClientRect() : null;
      const insertAfter = dropChip ? (e.clientY > rect.top + rect.height / 2) : false;

      // Identify the exact chip being dragged by its DOM element, not by id/title.
      // Module ids are supposed to be unique but bad data can violate that; comparing
      // elements instead of ids means a duplicate id can no longer be mistaken for a
      // "dropped on itself" self-drop (which was silently sending items to the bottom).
      const sourceChip = document.querySelector('.module-chip.is-dragging-chip');

      try {
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;
        
        const payload = JSON.parse(rawData);
        const { moduleId, fromCourseId, title } = payload;
        if (!moduleId || !targetCourseId) return; 

        const sourceCourse = DATA.courses.find((c) => c.id === fromCourseId);
        const targetCourse = DATA.courses.find((c) => c.id === targetCourseId);
        if (!sourceCourse || !targetCourse) return;

        // Prefer locating the dragged module by its DOM position within its source
        // list (unambiguous even with duplicate ids). Fall back to id/title matching
        // only if the source chip reference is unavailable for some reason.
        let moduleIndex = -1;
        if (sourceChip) {
          const sourceList = sourceChip.closest('.module-list');
          if (sourceList) {
            moduleIndex = Array.prototype.indexOf.call(sourceList.children, sourceChip);
          }
        }
        if (moduleIndex === -1 || !sourceCourse.modules[moduleIndex] || sourceCourse.modules[moduleIndex].id !== moduleId) {
          // EXACT MATCHING LOOKUP FOR UNIQUE IDENTIFICATION ("Quiz 1" vs "Quiz 2")
          moduleIndex = (sourceCourse.modules || []).findIndex((m) => {
            if (m.id && m.id === moduleId) return true;
            return m.title === title && m.id === moduleId;
          });
        }

        if (moduleIndex === -1) return;

        const [movedModule] = sourceCourse.modules.splice(moduleIndex, 1);

        if (!targetCourse.modules) targetCourse.modules = [];
        
        // Only treat this as a self-drop if it's literally the same chip element.
        if (dropChip && dropChip !== sourceChip) {
           const dropList = dropChip.closest('.module-list');
           let dropIndex = -1;

           if (dropList) {
             // DOM position of the drop target, taken before this module was spliced
             // out above. If we removed the dragged module from earlier in this same
             // list, everything after it shifted down by one, so adjust to match.
             dropIndex = Array.prototype.indexOf.call(dropList.children, dropChip);
             if (sourceCourse === targetCourse && moduleIndex !== -1 && moduleIndex < dropIndex) {
               dropIndex -= 1;
             }
           } else {
             dropIndex = targetCourse.modules.findIndex((m) => m.id === dropChip.dataset.moduleId);
           }

           if (dropIndex !== -1) {
              const finalIndex = insertAfter ? dropIndex + 1 : dropIndex;
              targetCourse.modules.splice(finalIndex, 0, movedModule);
           } else {
              targetCourse.modules.push(movedModule);
           }
        } else {
           targetCourse.modules.push(movedModule);
        }

        reindexData();
        renderBoard(DATA, state.collapsedCourses, state.positions);

        requestAnimationFrame(() => {
          document.querySelectorAll('.year-canvas').forEach((canvas) => fitCanvasToContent(canvas));
          refreshVisuals();
        });
      } catch (err) {
        console.error('Failed to move module:', err);
      }
    });

    board.addEventListener('click', (e) => {
      const downloadBtn = e.target.closest('.btn-download-outline');
      if (downloadBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = downloadBtn.closest('.course-card');
        if (card && card.dataset.courseId) {
          if (typeof window.downloadCourseOutlineRTF === 'function') {
            window.downloadCourseOutlineRTF(card.dataset.courseId);
          }
        }
        return;
      }

      if (isConnectMode) return;

      const editBtn = e.target.closest('.btn-edit-course, .edit-course-btn');
      if (editBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = editBtn.closest('.course-card');
        const courseId = card ? card.dataset.courseId : null;
        if (courseId && typeof window.openCourseEditor === 'function') {
          window.openCourseEditor(courseId);
        }
        return;
      }

      const calBtn = e.target.closest('.btn-calendar');
      if (calBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = calBtn.closest('.course-card');
        if (card && card.dataset.courseId) {
          const course = DATA.courses.find((c) => c.id === card.dataset.courseId);
          if (course && typeof window.openCalendarModal === 'function') {
            window.openCalendarModal(course);
          }
        }
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-course');
      if (deleteBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = deleteBtn.closest('.course-card');
        if (card && card.dataset.courseId && typeof window.deleteCourse === 'function') {
          window.deleteCourse(card.dataset.courseId);
        }
        return;
      }

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

    window.addEventListener('resize', () => {
      if (typeof drawConnections === 'function') drawConnections(DATA, state);
    });
  }

  window.deleteCourse = function (courseId) {
    if (!DATA || !DATA.courses) return;

    const courseToDelete = DATA.courses.find((c) => c.id === courseId);
    if (!courseToDelete) return;

    const confirmMsg = `Are you sure you want to delete "${courseToDelete.code} - ${courseToDelete.name}"?`;
    if (!confirm(confirmMsg)) return;

    const moduleIds = (courseToDelete.modules || []).map((m) => m.id);
    const targetIds = new Set([courseId, ...moduleIds]);

    DATA.courses = DATA.courses.filter((c) => c.id !== courseId);

    if (Array.isArray(DATA.connections)) {
      DATA.connections = DATA.connections.filter(
        (conn) => !targetIds.has(conn.from) && !targetIds.has(conn.to)
      );
    }

    if (state.positions) delete state.positions[courseId];
    if (state.collapsedCourses) state.collapsedCourses.delete(courseId);

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

  window.getCourseById = function(courseId) {
    if (!DATA) return { course: null, connections: [] };
    const course = DATA.courses.find((c) => c.id === courseId);
    return { course, connections: DATA.connections || [] };
  };

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