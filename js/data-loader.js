/* ============================================================
   data-loader.js
   Fetches the two source-of-truth JSON files and does light
   normalization (lookup maps) so the rest of the app never has
   to search arrays by id.
   ============================================================ */

async function loadCurriculumData() {
  const defaultEmptyData = {
    legend: {
      strong: { label: 'Strong Connection', color: '#ef4444', description: 'Core prerequisite' },
      related: { label: 'Related Topic', color: '#3b82f6', description: 'Shared concepts' },
      weak: { label: 'Weak Connection', color: '#10b981', description: 'Minor overlap' }
    },
    courses: [],
    connections: []
  };

  try {
    const res = await fetch('./data/curriculum.json');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    
    // Ensure critical arrays exist
    data.courses = data.courses || [];
    data.connections = data.connections || [];
    data.legend = data.legend || defaultEmptyData.legend;
    
    return data;
  } catch (err) {
    console.warn('Could not load curriculum.json, initializing empty board:', err);
    // Return empty fallback instead of crashing the UI
    return defaultEmptyData;
  }
}

function buildLookups(curriculum, connectionData) {
  const moduleById = {};
  const courseByModuleId = {};
  const courseById = {};

  curriculum.courses.forEach((course) => {
    courseById[course.id] = course;
    course.modules.forEach((mod) => {
      moduleById[mod.id] = mod;
      courseByModuleId[mod.id] = course;
    });
  });

  // index connections by module id (both directions) for fast lookup
  const connectionsByModule = {};
  connectionData.connections.forEach((conn) => {
    if (!connectionsByModule[conn.from]) connectionsByModule[conn.from] = [];
    if (!connectionsByModule[conn.to]) connectionsByModule[conn.to] = [];
    connectionsByModule[conn.from].push(conn);
    connectionsByModule[conn.to].push(conn);
  });

  return {
    courses: curriculum.courses,
    connections: connectionData.connections,
    legend: connectionData.legend,
    moduleById,
    courseById,
    courseByModuleId,
    connectionsByModule,
  };
}

// plain-script global export, matching the rest of the app's module style
window.loadCurriculumData = loadCurriculumData;
