/* ============================================================
   data-loader.js
   Fetches the two source-of-truth JSON files and does light
   normalization (lookup maps) so the rest of the app never has
   to search arrays by id.
   ============================================================ */

async function loadCurriculumData() {
  const [curriculumRes, connectionsRes] = await Promise.all([
    fetch('data/curriculum.json'),
    fetch('data/connections.json'),
  ]);

  if (!curriculumRes.ok || !connectionsRes.ok) {
    throw new Error('Failed to load curriculum data files.');
  }

  const curriculum = await curriculumRes.json();
  const connectionData = await connectionsRes.json();

  return buildLookups(curriculum, connectionData);
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
