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
 * Attaches import/export event listeners to toolbar buttons
 */
export function initStorageUI(getAppState, onUpdateState) {
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
        onUpdateState(data); // Callback to update state & trigger redraws
        alert('Workspace loaded successfully!');
      } catch (err) {
        alert(`Error loading workspace: ${err.message}`);
      } finally {
        fileInput.value = '';
      }
    });
  }
}