/* ============================================================
   js/exportRtf.js
   Generates and triggers RTF downloads for individual or all course outlines.
   ============================================================ */

// --- 1. EXPORT SINGLE COURSE ---
function downloadCourseOutlineRTF(courseId) {
  const { course, connections } = window.getCourseById(courseId);
  if (!course) {
    alert("Course data not found.");
    return;
  }

  let rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033\n`;
  rtf += `{\\fonttbl{\\f0\\fswiss\\fprq2\\fcharset0 Arial;}}\n`;
  rtf += `{\\colortbl ;\\red15\\green23\\blue42;\\red100\\green116\\blue139;}\n`;
  rtf += `\\viewkind4\\uc1\\f0\\fs22\n\n`;

  rtf += buildCourseRtfContent(course, connections || []);

  rtf += `}\n`; // Close RTF block

  triggerRtfDownload(rtf, `${course.code.replace(/\s+/g, '_')}_Course_Outline.rtf`);
}

// --- 2. EXPORT ALL COURSES (PAGE BREAK SEPARATED) ---
function downloadAllCourseOutlinesRTF() {
  if (!window.DATA || !window.DATA.courses || window.DATA.courses.length === 0) {
    alert("No course data found.");
    return;
  }

  let rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033\n`;
  rtf += `{\\fonttbl{\\f0\\fswiss\\fprq2\\fcharset0 Arial;}}\n`;
  rtf += `{\\colortbl ;\\red15\\green23\\blue42;\\red100\\green116\\blue139;}\n`;
  rtf += `\\viewkind4\\uc1\\f0\\fs22\n\n`;

  const connections = window.DATA.connections || [];

  window.DATA.courses.forEach((course, index) => {
    if (index > 0) {
      rtf += `\\page\n`; // Insert hard page break between courses
    }
    rtf += buildCourseRtfContent(course, connections);
  });

  rtf += `}\n`; // Close master RTF block

  triggerRtfDownload(rtf, `Complete_Curriculum_Outlines.rtf`);
}

// --- 3. HELPER: BUILD COURSE RTF STRING ---
function buildCourseRtfContent(course, connections) {
  let rtf = '';

  // HEADER: COURSE NAME & NUMBER (CENTERED)
  rtf += `\\pard\\qc\\b\\fs36 ${escapeRtf(course.code)}: ${escapeRtf(course.name)}\\b0\\fs22\\par\n`;
  if (course.credits) {
    rtf += `\\pard\\qc\\cf2\\fs20 (${course.credits} Credits)\\cf1\\fs22\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 1. TEXTBOOK INFORMATION
  rtf += `\\pard\\qj\\b\\fs28 1. Required Textbook & Course Materials\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  
  if (course.textbook) {
    const title = typeof course.textbook === 'string' ? course.textbook : (course.textbook.title || 'TBD');
    rtf += `\\pard\\qj\\li360\\b Title:\\b0  ${escapeRtf(title)}\\par\n`;
    if (course.textbook.author) rtf += `\\pard\\qj\\li360\\b Author(s):\\b0  ${escapeRtf(course.textbook.author)}\\par\n`;
    if (course.textbook.isbn) rtf += `\\pard\\qj\\li360\\b ISBN:\\b0  ${escapeRtf(course.textbook.isbn)}\\par\n`;
  } else {
    rtf += `\\pard\\qj\\li360\\i [Faculty to insert textbook / open educational resources information here]\\i0\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 2. COURSE CALENDAR / SCHEDULE & FORMAT
  rtf += `\\pard\\qj\\b\\fs28 2. Course Schedule Overview\\b0\\fs22\\par\n`;
  
  const config = window.currentCourseConfig || window.defaultScheduleConfig || { weeksInSemester: 12, meetingsPerWeek: 3, minutesPerBlock: 50 };
  const meetingsPerWeek = config.meetingsPerWeek || config.lecturesPerWeek || 3;
  const minutesPerBlock = config.minutesPerBlock || config.lectureLength || 50;
  const weeksInSemester = config.weeksInSemester || 12;

  rtf += `\\pard\\qj\\li360\\cf2 Class Format: ${meetingsPerWeek} lectures per week (${minutesPerBlock} minutes per block) over ${weeksInSemester} weeks.\\cf1\\par\n`;
  rtf += `\\line\\par\n`;
  
  if (typeof window.generateCalendarSchedule === 'function') {
    const schedule = window.generateCalendarSchedule(course, meetingsPerWeek, weeksInSemester);
    schedule.forEach(week => {
      rtf += `\\pard\\qj\\li360\\b Week ${week.weekNumber}:\\b0  `;
      if (week.lectures && week.lectures.length > 0) {
        const topicsList = week.lectures.map(l => `${l.moduleLabel} (${l.moduleTitle})`).join('; ');
        rtf += `${escapeRtf(topicsList)}\\par\n`;
      } else {
        rtf += `\\cf2 Independent Study / Review\\cf1\\par\n`;
      }
    });
  } else {
    rtf += `\\pard\\qj\\li360\\i [Calendar generated based on term configuration]\\i0\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 3. MODULES, LEARNING OBJECTIVES & CURRICULUM CONNECTIONS
  rtf += `\\pard\\qj\\b\\fs28 3. Course Modules & Learning Objectives\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;

  (course.modules || []).forEach((mod, idx) => {
    const modNum = idx + 1;
    rtf += `\\pard\\qj\\li360\\b\\fs24 3.${modNum} Module ${modNum}: ${escapeRtf(mod.title || mod.label)}\\b0\\fs22\\par\n`;
    
    if (mod.chapter) {
      rtf += `\\pard\\qj\\li360\\cf2 Reading Reference: Chapter ${escapeRtf(mod.chapter)}\\cf1\\par\n`;
    }

    // Learning Objectives
    rtf += `\\pard\\qj\\li720\\b Learning Objectives:\\b0\\par\n`;
    if (mod.topics && mod.topics.length > 0) {
      mod.topics.forEach(topic => {
        const topicTitle = typeof topic === 'string' ? topic : (topic.title || topic.label || topic.name || '');
        if (topicTitle) {
          rtf += `\\pard\\qj\\li720\\\'95  ${escapeRtf(topicTitle)}\\par\n`;
        }
        
        if (topic.objectives && topic.objectives.length > 0) {
          topic.objectives.forEach(obj => {
            const objText = typeof obj === 'string' 
              ? obj 
              : (obj.text || obj.title || obj.description || obj.label || JSON.stringify(obj));
              
            rtf += `\\pard\\qj\\li1080\\cf2 - ${escapeRtf(objText)}\\cf1\\par\n`;
          });
        }
      });
    } else {
      rtf += `\\pard\\qj\\li720\\\'95  ${escapeRtf(mod.description || 'Core topics and competencies for this unit.')}\\par\n`;
    }

    // Curriculum Connections
    const modConnections = (connections || []).filter(c => c.from === mod.id || c.to === mod.id);
    if (modConnections.length > 0) {
      rtf += `\\pard\\qj\\li720\\b Curriculum Connections:\\b0\\par\n`;
      
      const buildsUpon = modConnections.filter(c => c.to === mod.id);
      const leadsTo = modConnections.filter(c => c.from === mod.id);

      if (buildsUpon.length > 0) {
        rtf += `\\pard\\qj\\li1080\\b\\cf2 Prior Foundations (Builds Upon):\\b0\\cf1\\par\n`;
        buildsUpon.forEach(conn => {
          const details = findConnectionDetails(conn.from);
          const strengthTerm = getPedagogicalStrength(conn);
          
          rtf += `\\pard\\qj\\li1440\\cf2 - `;
          if (strengthTerm) rtf += `\\b [${escapeRtf(strengthTerm)}]\\b0  `;
          rtf += `${escapeRtf(details.courseCode)} (${escapeRtf(details.moduleTitle)})`;
          if (conn.note) rtf += ` -- ${escapeRtf(conn.note)}`;
          rtf += `\\cf1\\par\n`;
        });
      }

      if (leadsTo.length > 0) {
        rtf += `\\pard\\qj\\li1080\\b\\cf2 Target Applications (Leads To):\\b0\\cf1\\par\n`;
        leadsTo.forEach(conn => {
          const details = findConnectionDetails(conn.to);
          const strengthTerm = getPedagogicalStrength(conn);
          
          rtf += `\\pard\\qj\\li1440\\cf2 - `;
          if (strengthTerm) rtf += `\\b [${escapeRtf(strengthTerm)}]\\b0  `;
          rtf += `${escapeRtf(details.courseCode)} (${escapeRtf(details.moduleTitle)})`;
          if (conn.note) rtf += ` -- ${escapeRtf(conn.note)}`;
          rtf += `\\cf1\\par\n`;
        });
      }
    }

    rtf += `\\pard\\qj\\par\n`;
  });

  return rtf;
}

// --- UTILITY HELPERS ---

function triggerRtfDownload(rtfContent, fileName) {
  const blob = new Blob([rtfContent], { type: 'application/rtf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getPedagogicalStrength(conn) {
  const s = String(conn.strength || conn.weight || conn.level || '').toLowerCase();
  
  if (s === 'high' || s === 'strong' || s === '3') {
    return 'Essential Prerequisite';
  } else if (s === 'medium' || s === 'med' || s === '2') {
    return 'Integrative Concept';
  } else if (s === 'low' || s === 'weak' || s === '1') {
    return 'Contextual Background';
  }
  
  return null;
}

function escapeRtf(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/[^\x00-\x7F]/g, char => `\\u${char.charCodeAt(0)}?`);
}

function findConnectionDetails(targetId) {
  if (!window.DATA || !window.DATA.courses) {
    return { courseCode: 'Connected Course', moduleTitle: targetId };
  }

  for (const c of window.DATA.courses) {
    if (c.id === targetId) {
      return { courseCode: c.code, moduleTitle: c.name };
    }
    const m = (c.modules || []).find(mod => mod.id === targetId);
    if (m) {
      return { courseCode: c.code, moduleTitle: m.title || m.label };
    }
  }

  return { courseCode: 'Related Topic', moduleTitle: targetId };
}

// --- GLOBAL BINDINGS ---
window.downloadCourseOutlineRTF = downloadCourseOutlineRTF;
window.downloadAllCourseOutlinesRTF = downloadAllCourseOutlinesRTF;