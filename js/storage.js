/* ============================================================
   storage.js
   Handles single-file JSON Export, Import, and Validation
   ============================================================ */

/**
 * Exports all courses and connections into a single JSON file.
 * @param {Array} coursesData - Array of course objects
 * @param {Object} connectionsData - Object containing legend & connections array
 * @param {string} filename - Output filename
 */
export function exportBoardState(coursesData, connectionsData, filename = 'curriculum-data.json') {
  const unifiedPayload = {
    meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0'
    },
    courses: coursesData,
    connections: connectionsData
  };

  const jsonString = JSON.stringify(unifiedPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); // Fixed: added 'create'
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Reads and parses a user-selected JSON file.
 * @param {File} file - The file object from input[type="file"]
 * @returns {Promise<{courses: Array, connections: Object}>}
 */
export function importBoardState(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided.'));

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);

        // Validation checks
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON structure.');
        }

        if (!Array.isArray(parsed.courses)) {
          throw new Error('Missing or invalid "courses" array in JSON file.');
        }

        if (!parsed.connections || !Array.isArray(parsed.connections.connections)) {
          throw new Error('Missing or invalid "connections" data in JSON file.');
        }

        resolve({
          courses: parsed.courses,
          connections: parsed.connections
        });
      } catch (err) {
        reject(new Error(`Failed to parse file: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('File reading error.'));
    reader.readAsText(file);
  });
}

/**
 * Shows a modal letting the user choose how to handle an import when the
 * board already has courses loaded: replace everything, import only
 * specific courses from the file, or cancel.
 *
 * @param {Array} importedCourses - courses parsed from the incoming file
 * @param {Array} existingCourses - courses currently on the board
 * @returns {Promise<{mode: 'replace'} | {mode: 'merge', selectedCourseIds: string[]} | {mode: 'cancel'}>}
 */
function showImportChoiceModal(importedCourses, existingCourses) {
  return new Promise((resolve) => {
    const existingIds = new Set(existingCourses.map((c) => c.id));

    const backdrop = document.createElement('div');
    backdrop.className = 'import-modal-backdrop';
    backdrop.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #1e293b; border: 1px solid #334155; border-radius: 8px;
      padding: 20px; width: 440px; max-width: 90vw; max-height: 80vh;
      display: flex; flex-direction: column; gap: 12px; color: #f8fafc;
      font-family: inherit; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    `;

    const title = document.createElement('h3');
    title.textContent = 'Import Curriculum File';
    title.style.cssText = 'margin: 0; font-size: 1.05rem;';
    modal.appendChild(title);

    const desc = document.createElement('p');
    desc.textContent = `You already have courses loaded. This file contains ${importedCourses.length} course(s). Replace everything, or pick specific course(s) to bring in.`;
    desc.style.cssText = 'margin: 0; font-size: 0.85rem; color: #cbd5e1; line-height: 1.4;';
    modal.appendChild(desc);

    const listWrap = document.createElement('div');
    listWrap.style.cssText = `
      border: 1px solid #334155; border-radius: 6px; padding: 8px;
      overflow-y: auto; max-height: 260px; display: flex; flex-direction: column; gap: 6px;
    `;

    const checkboxes = [];
    importedCourses.forEach((course) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = course.id;
      checkboxes.push(cb);

      const willReplace = existingIds.has(course.id);
      const nameBits = [course.code, course.name].filter(Boolean).join(' — ') || course.id;
      const labelText = document.createElement('span');
      labelText.textContent = willReplace ? `${nameBits} (already exists — will be overwritten)` : nameBits;
      if (willReplace) labelText.style.color = '#fbbf24';

      row.appendChild(cb);
      row.appendChild(labelText);
      listWrap.appendChild(row);
    });

    modal.appendChild(listWrap);

    const selectRow = document.createElement('div');
    selectRow.style.cssText = 'display:flex; gap:12px; font-size:0.78rem;';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.textContent = 'Select all';
    selectAllBtn.style.cssText = 'background:none;border:none;color:#60a5fa;cursor:pointer;padding:0;text-decoration:underline;';
    selectAllBtn.addEventListener('click', () => checkboxes.forEach((cb) => (cb.checked = true)));

    const selectNoneBtn = document.createElement('button');
    selectNoneBtn.type = 'button';
    selectNoneBtn.textContent = 'Select none';
    selectNoneBtn.style.cssText = 'background:none;border:none;color:#60a5fa;cursor:pointer;padding:0;text-decoration:underline;';
    selectNoneBtn.addEventListener('click', () => checkboxes.forEach((cb) => (cb.checked = false)));

    selectRow.appendChild(selectAllBtn);
    selectRow.appendChild(selectNoneBtn);
    modal.appendChild(selectRow);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:8px; flex-wrap: wrap;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 12px; border-radius:4px; border:1px solid #334155; background:transparent; color:#f8fafc; cursor:pointer;';

    const replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.textContent = 'Replace Everything';
    replaceBtn.style.cssText = 'padding:6px 12px; border-radius:4px; border:1px solid #ef4444; background:transparent; color:#f87171; cursor:pointer;';

    const importSelectedBtn = document.createElement('button');
    importSelectedBtn.type = 'button';
    importSelectedBtn.textContent = 'Import Selected';
    importSelectedBtn.style.cssText = 'padding:6px 12px; border-radius:4px; border:none; background:#2563eb; color:white; cursor:pointer;';

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(replaceBtn);
    btnRow.appendChild(importSelectedBtn);
    modal.appendChild(btnRow);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function cleanup() {
      backdrop.remove();
    }

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve({ mode: 'cancel' });
    });

    replaceBtn.addEventListener('click', () => {
      cleanup();
      resolve({ mode: 'replace' });
    });

    importSelectedBtn.addEventListener('click', () => {
      const selectedCourseIds = checkboxes.filter((cb) => cb.checked).map((cb) => cb.value);
      if (selectedCourseIds.length === 0) {
        alert('Select at least one course to import, or choose "Replace Everything".');
        return;
      }
      cleanup();
      resolve({ mode: 'merge', selectedCourseIds });
    });

    // Click outside the modal box cancels, same as the Cancel button.
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup();
        resolve({ mode: 'cancel' });
      }
    });
  });
}

/**
 * Attaches import/export event listeners to toolbar buttons.
 *
 * @param {Function} getAppState - () => { courses, connectionsData }
 * @param {Function} onUpdateState - ({ courses, connections }) => void  — full replace
 * @param {Function} [onMergeState] - ({ coursesToImport, connectionsToImport, legend }) => void
 *   Called instead of onUpdateState when the user chooses to import only specific
 *   courses from a file while other courses are already on the board. Optional —
 *   if omitted, imports always fall back to a full replace (previous behavior).
 */
export function initStorageUI(getAppState, onUpdateState, onMergeState) {
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const fileInput = document.getElementById('importFileInput');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const state = getAppState();
      exportBoardState(state.courses, state.connectionsData, 'my-curriculum-board.json');
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const data = await importBoardState(file);
        const existingCourses = getAppState().courses || [];

        // Nothing on the board yet (or caller doesn't support partial import) —
        // no ambiguity, just load the file as before.
        if (existingCourses.length === 0 || typeof onMergeState !== 'function') {
          onUpdateState(data);
          alert('Workspace loaded successfully!');
          return;
        }

        const choice = await showImportChoiceModal(data.courses, existingCourses);

        if (choice.mode === 'cancel') {
          return;
        }

        if (choice.mode === 'replace') {
          onUpdateState(data);
          alert('Workspace loaded successfully!');
          return;
        }

        // choice.mode === 'merge'
        const selectedIds = new Set(choice.selectedCourseIds);
        const coursesToImport = data.courses.filter((c) => selectedIds.has(c.id));

        // Only bring in connections that are entirely internal to the imported
        // course(s) — a connection pointing at a module that wasn't imported
        // would dangle and could crash rendering.
        const importedModuleIds = new Set();
        coursesToImport.forEach((c) => (c.modules || []).forEach((m) => importedModuleIds.add(m.id)));

        const allConnections = (data.connections && data.connections.connections) || [];
        const connectionsToImport = allConnections.filter(
          (conn) => importedModuleIds.has(conn.from) && importedModuleIds.has(conn.to)
        );

        onMergeState({
          coursesToImport,
          connectionsToImport,
          legend: data.connections ? data.connections.legend : null
        });

        alert(`Imported ${coursesToImport.length} course(s) successfully!`);
      } catch (err) {
        alert(`Error loading workspace: ${err.message}`);
      } finally {
        fileInput.value = '';
      }
    });
  }
}