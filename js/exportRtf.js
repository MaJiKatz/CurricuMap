/* ============================================================
   js/exportRtf.js
   Generates and triggers RTF downloads for individual or all course outlines,
   compliant with Memorial University of Newfoundland (MUN) syllabus regulations.
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

// --- 2. EXPORT ALL COURSES (WITH DEDICATED SUMMARY PAGE & PAGE BREAKS) ---
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
  const courses = window.DATA.courses;

  // ==========================================
  // PAGE 1: STANDALONE SUMMARY COVER PAGE
  // ==========================================
  rtf += `\\pard\\qc\\b\\fs36 Program Curriculum & Workload Summary\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n\n`;

  let grandTotalLectureHours = 0;
  let grandTotalLabHours = 0;
  let courseStatsListRtf = '';

  courses.forEach((c) => {
    const stats = calculateCourseHoursAndStats(c);
    grandTotalLectureHours += stats.lectureHours;
    grandTotalLabHours += stats.labHours;

    courseStatsListRtf += `\\pard\\qj\\li360\\b ${escapeRtf(c.code)}: ${escapeRtf(c.name)}\\b0\\par\n`;
    courseStatsListRtf += `\\pard\\qj\\li720\\cf2 Lecture Hours: ${stats.lectureHours} hrs | Lab Hours: ${stats.labHours} hrs | Total Contact Hours: ${stats.totalHours} hrs\\cf1\\par\n`;
  });

  const grandTotalHours = grandTotalLectureHours + grandTotalLabHours;

  rtf += `\\pard\\qj\\b\\fs28 Aggregate Program Statistics\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  rtf += `\\pard\\qj\\li360\\\'95  \\b Total Courses:\\b0  ${courses.length}\\par\n`;
  rtf += `\\pard\\qj\\li360\\\'95  \\b Total Program Lecture Hours:\\b0  ${grandTotalLectureHours} hrs\\par\n`;
  rtf += `\\pard\\qj\\li360\\\'95  \\b Total Program Laboratory Hours:\\b0  ${grandTotalLabHours} hrs\\par\n`;
  rtf += `\\pard\\qj\\li360\\\'95  \\b Total Combined Contact Hours:\\b0  ${grandTotalHours} hrs\\par\n`;
  rtf += `\\pard\\qj\\par\n\n`;

  rtf += `\\pard\\qj\\b\\fs28 Course-by-Course Stats\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  rtf += courseStatsListRtf;

  // HARD PAGE BREAK & SECTION RESET TO KEEP SUMMARY EXCLUSIVELY ON PAGE 1
  rtf += `\\sect\\page\\sectd\n\n`;

  // ==========================================
  // INDIVIDUAL COURSE OUTLINES
  // ==========================================
  courses.forEach((course, index) => {
    if (index > 0) {
      rtf += `\\page\n`; // Insert hard page break between consecutive outlines
    }
    rtf += buildCourseRtfContent(course, connections);
  });

  rtf += `}\n`; // Close master RTF block

  triggerRtfDownload(rtf, `Complete_Curriculum_Outlines.rtf`);
}

// --- 3. HELPER: CALCULATE COURSE HOURS & EVALUATION ---
function calculateCourseHoursAndStats(course) {
  let lectureCount = 0;
  let labHours = 0;
  let definedWeightTotal = 0;
  const midterms = [];
  const labs = [];

  // Check if hours/schedule are explicitly provided on course root
  if (course.labHours !== undefined) {
    labHours = parseFloat(course.labHours) || 0;
  }

  // Iterate modules/evaluations to aggregate items and hours
  (course.modules || []).forEach((mod) => {
    if (mod.isExam) {
      const w = parseFloat(mod.weightPercent || mod.weight) || 0;
      midterms.push({ title: mod.title || mod.label || 'Midterm Exam', weight: w, date: mod.date || mod.scheduledWeek });
      definedWeightTotal += w;
    } else if (mod.isLab) {
      const w = parseFloat(mod.weightPercent || mod.weight) || 0;
      definedWeightTotal += w;
      
      let modLabHours = parseFloat(mod.labHours || mod.hours) || 0;
      if (Array.isArray(mod.labs)) {
        mod.labs.forEach((l) => {
          modLabHours += parseFloat(l.hours) || 0;
        });
      }
      if (!course.labHours) labHours += modLabHours;

      labs.push({ title: mod.title || mod.label || 'Practical / Laboratory Work', weight: w, hours: modLabHours });
    } else {
      lectureCount += parseInt(mod.lectureCount || mod.lectures, 10) || 0;
    }
  });

  // Default lecture hours calculation based on semester config if lectureCount not on modules
  const config = window.currentCourseConfig || window.defaultScheduleConfig || { weeksInSemester: 12, meetingsPerWeek: 3 };
  const meetingsPerWeek = config.meetingsPerWeek || config.lecturesPerWeek || 3;
  const weeksInSemester = config.weeksInSemester || 12;
  
  const lectureHours = lectureCount > 0 ? lectureCount : (meetingsPerWeek * weeksInSemester);
  const totalHours = lectureHours + labHours;

  // Check custom evaluation scheme if defined on course directly
  const customEval = course.evaluationScheme || course.evaluation || course.gradingScheme;
  if (Array.isArray(customEval)) {
    let customDefinedWeight = 0;
    customEval.forEach(item => {
      const w = parseFloat(item.weight || item.allocation || item.percent) || 0;
      const name = String(item.component || item.name || '').toLowerCase();
      if (!name.includes('final')) {
        customDefinedWeight += w;
      }
    });
    if (customDefinedWeight > 0) {
      definedWeightTotal = customDefinedWeight;
    }
  }

  const finalExamWeight = Math.max(0, 100 - definedWeightTotal);

  return {
    lectureHours,
    labHours,
    totalHours,
    midterms,
    labs,
    definedWeightTotal,
    finalExamWeight
  };
}

// --- 4. HELPER: BUILD COURSE RTF STRING ---
function buildCourseRtfContent(course, connections) {
  let rtf = '';
  const stats = calculateCourseHoursAndStats(course);

  // HEADER: COURSE NAME & NUMBER (CENTERED)
  rtf += `\\pard\\qc\\b\\fs36 ${escapeRtf(course.code)}: ${escapeRtf(course.name)}\\b0\\fs22\\par\n`;
  if (course.credits) {
    rtf += `\\pard\\qc\\cf2\\fs20 (${course.credits} Credit Hours | Total Contact Hours: ${stats.totalHours} hrs)\\cf1\\fs22\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // --- INSTRUCTOR, CONSULTATION & PREREQUISITES ---
  rtf += `\\pard\\qj\\b\\fs28 Course & Instructor Information\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  
  const instructor = course.instructor || {};
  const instName = typeof instructor === 'string' ? instructor : (instructor.name || 'TBD');
  const instEmail = instructor.email || 'TBD';
  const instOffice = instructor.office || 'TBD';
  const officeHours = instructor.officeHours || course.officeHours || 'TBD / By Appointment';

  rtf += `\\pard\\qj\\li360\\b Instructor Name:\\b0  ${escapeRtf(instName)}\\par\n`;
  rtf += `\\pard\\qj\\li360\\b Instructor Email:\\b0  ${escapeRtf(instEmail)}\\par\n`;
  rtf += `\\pard\\qj\\li360\\b Office Location:\\b0  ${escapeRtf(instOffice)}\\par\n`;
  rtf += `\\pard\\qj\\li360\\b Instructor Availability / Consultation Hours:\\b0  ${escapeRtf(officeHours)}\\par\n`;
  
  // Prerequisites & Co-requisites
  const prereqs = course.prerequisites || course.prereqs || 'None';
  const coreqs = course.corequisites || course.coreqs || 'None';
  rtf += `\\pard\\qj\\li360\\b Required Prerequisites:\\b0  ${escapeRtf(prereqs)}\\par\n`;
  rtf += `\\pard\\qj\\li360\\b Required Co-requisites:\\b0  ${escapeRtf(coreqs)}\\par\n`;
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 1. TEXTBOOKS & REQUIRED PURCHASES
  rtf += `\\pard\\qj\\b\\fs28 1. Required Textbooks & Course Resources\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  
  if (course.textbook) {
    const title = typeof course.textbook === 'string' ? course.textbook : (course.textbook.title || 'TBD');
    rtf += `\\pard\\qj\\li360\\b Title:\\b0  ${escapeRtf(title)}\\par\n`;
    if (course.textbook.author) rtf += `\\pard\\qj\\li360\\b Author(s):\\b0  ${escapeRtf(course.textbook.author)}\\par\n`;
    if (course.textbook.isbn) rtf += `\\pard\\qj\\li360\\b ISBN / Edition:\\b0  ${escapeRtf(course.textbook.isbn)}\\par\n`;
  } else {
    rtf += `\\pard\\qj\\li360\\i [Faculty to list required textbooks or items that must be purchased]\\i0\\par\n`;
  }
  if (course.software || course.otherResources) {
    if (course.software) rtf += `\\pard\\qj\\li360\\b Required Software/Tools:\\b0  ${escapeRtf(course.software)}\\par\n`;
    if (course.otherResources) rtf += `\\pard\\qj\\li360\\b Other Required Resources:\\b0  ${escapeRtf(course.otherResources)}\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 2. COURSE CALENDAR & SCHEDULE OVERVIEW
  rtf += `\\pard\\qj\\b\\fs28 2. Course Schedule Overview\\b0\\fs22\\par\n`;
  
  const config = window.currentCourseConfig || window.defaultScheduleConfig || { weeksInSemester: 12, meetingsPerWeek: 3, minutesPerBlock: 50 };
  const meetingsPerWeek = config.meetingsPerWeek || config.lecturesPerWeek || 3;
  const minutesPerBlock = config.minutesPerBlock || config.lectureLength || 50;
  const weeksInSemester = config.weeksInSemester || 12;

  rtf += `\\pard\\qj\\li360\\cf2 Class Format: ${meetingsPerWeek} lectures/week (${minutesPerBlock} min/block, ${stats.lectureHours} total lecture hrs) | ${stats.labHours} lab hrs across ${weeksInSemester} weeks.\\cf1\\par\n`;
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

  // SECTION 3. METHOD OF EVALUATION & GRADING SYSTEM
  rtf += `\\pard\\qj\\b\\fs28 3. Method of Evaluation & Grading System\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;

  // Allocation of Marks
  rtf += `\\pard\\qj\\li360\\b 3.1 Allocation of Marks:\\b0\\par\n`;
  
  const evalBreakdown = course.evaluationScheme || course.evaluation || course.gradingScheme;
  if (Array.isArray(evalBreakdown) && evalBreakdown.length > 0) {
    evalBreakdown.forEach(item => {
      rtf += `\\pard\\qj\\li720\\\'95  ${escapeRtf(item.component || item.name)}: ${escapeRtf(item.weight || item.allocation)}`;
      if (item.date) rtf += ` \\cf2 (Probable Date/Due: ${escapeRtf(item.date)})\\cf1`;
      rtf += `\\par\n`;
    });
  } else {
    // Dynamic breakdown generated from course modules & calculated remaining final exam
    if (stats.midterms.length > 0) {
      stats.midterms.forEach((m) => {
        rtf += `\\pard\\qj\\li720\\\'95  ${escapeRtf(m.title)}: ${m.weight}%`;
        if (m.date) rtf += ` \\cf2 (Probable Date: ${escapeRtf(m.date)})\\cf1`;
        rtf += `\\par\n`;
      });
    } else {
      rtf += `\\pard\\qj\\li720\\\'95  Midterm Examination(s): 25% (Probable Date: Week 6)\\par\n`;
    }

    if (stats.labs.length > 0) {
      stats.labs.forEach((l) => {
        rtf += `\\pard\\qj\\li720\\\'95  ${escapeRtf(l.title)}: ${l.weight}%`;
        if (l.hours) rtf += ` \\cf2 (${l.hours} Laboratory Hours)\\cf1`;
        rtf += `\\par\n`;
      });
    } else if (stats.labHours > 0) {
      rtf += `\\pard\\qj\\li720\\\'95  Laboratory / Practical Work: 25% (${stats.labHours} Total Lab Hours)\\par\n`;
    }

    // Final Exam rendered as calculated difference
    rtf += `\\pard\\qj\\li720\\\'95  Final Examination: ${stats.finalExamWeight}% (Scheduled by Registrar; calculated remaining balance)\\par\n`;
  }

  // Grading System Statement
  const gradingSys = course.gradingSystem || "Numeric Grade System (0-100%, pass mark 50%) in accordance with University Senate regulations.";
  rtf += `\\pard\\qj\\li360\\b 3.2 Grading System:\\b0  ${escapeRtf(gradingSys)}\\par\n`;

  // Alternate Evaluation / Missed Work
  rtf += `\\pard\\qj\\li360\\b 3.3 Alternate Evaluation & Missed Work Policy:\\b0\\par\n`;
  if (course.alternateEvaluationPolicy) {
    rtf += `\\pard\\qj\\li720 ${escapeRtf(course.alternateEvaluationPolicy)}\\par\n`;
  } else {
    rtf += `\\pard\\qj\\li720 In accordance with University Regulations (Exemptions from Parts of the Evaluation), students unable to complete an evaluation due to acceptable cause must notify the instructor promptly. Where acceptable cause is established, an alternate evaluation or reweighting will be offered.\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 4. COURSE MODULES, LEARNING OBJECTIVES & CONNECTIONS
  rtf += `\\pard\\qj\\b\\fs28 4. Course Modules & Learning Objectives\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;

  (course.modules || []).forEach((mod, idx) => {
    const modNum = idx + 1;
    rtf += `\\pard\\qj\\li360\\b\\fs24 4.${modNum} Module ${modNum}: ${escapeRtf(mod.title || mod.label)}\\b0\\fs22\\par\n`;
    
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

  // SECTION 5. LAB INFORMATION & SAFETY
  rtf += `\\pard\\qj\\b\\fs28 5. Laboratory Information & Safety\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  if (course.labInfo || course.lab) {
    const lab = course.labInfo || course.lab;
    if (typeof lab === 'string') {
      rtf += `\\pard\\qj\\li360 ${escapeRtf(lab)}\\par\n`;
    } else {
      if (lab.schedule) rtf += `\\pard\\qj\\li360\\b Schedule/Format:\\b0  ${escapeRtf(lab.schedule)}\\par\n`;
      if (lab.location) rtf += `\\pard\\qj\\li360\\b Location:\\b0  ${escapeRtf(lab.location)}\\par\n`;
      if (lab.safety) rtf += `\\pard\\qj\\li360\\b Safety & Personal Protective Equipment (PPE):\\b0  ${escapeRtf(lab.safety)}\\par\n`;
      if (lab.description) rtf += `\\pard\\qj\\li360 ${escapeRtf(lab.description)}\\par\n`;
    }
  } else {
    rtf += `\\pard\\qj\\li360\\i [Laboratory schedules, safety requirements, PPE standards, and experiment lists to be inserted if applicable]\\i0\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 6. USE OF ASSISTIVE TOOLS & GENERATIVE AI
  rtf += `\\pard\\qj\\b\\fs28 6. Use of Assistive Tools & Generative AI Policy\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  if (course.aiPolicy) {
    rtf += `\\pard\\qj\\li360 ${escapeRtf(course.aiPolicy)}\\par\n`;
  } else {
    rtf += `\\pard\\qj\\li360 Permissible use of assistive technologies and Generative Artificial Intelligence (e.g., ChatGPT, Claude) in this course will be explicitly stated for each assignment. Unless explicitly permitted by the instructor, the use of generative AI tools to produce coursework, code, or written assignments is unauthorized and constitutes academic misconduct.\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 7. ADDITIONAL INFORMATION
  rtf += `\\pard\\qj\\b\\fs28 7. Additional Course Information\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  if (course.additionalInfo) {
    rtf += `\\pard\\qj\\li360 ${escapeRtf(course.additionalInfo)}\\par\n`;
  } else {
    rtf += `\\pard\\qj\\li360\\i [Faculty notes on attendance, communication guidelines, late submission penalties, or supplementary learning resources]\\i0\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 8. UNIVERSITY STATEMENTS & POLICIES (MUN COMPLIANT)
  rtf += `\\pard\\qj\\b\\fs28 8. University Statements & Institutional Policies\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;

  // Academic Integrity Statement
  rtf += `\\pard\\qj\\li360\\b 8.1 Academic Integrity:\\b0  Students are expected to adhere strictly to Memorial University of Newfoundland's standards of academic honesty. Please refer to the entry on \\i Academic Misconduct\\i0  in the University Calendar for definitions, procedures, and penalties regarding plagiarism, cheating, and misrepresentation.\\par\n\n`;

  // Accommodations Statement
  rtf += `\\pard\\qj\\li360\\b 8.2 Student Accommodations:\\b0  Memorial University of Newfoundland is committed to accommodating students with disabilities. Students requiring academic accommodations are encouraged to register with Student Accessibility Services (SAS) and inform the instructor as early as possible in the semester.\\par\n\n`;

  // ATIPP Privacy Statement
  rtf += `\\pard\\qj\\li360\\b 8.3 Student Privacy & Grade Notification (ATIPP):\\b0  Methods used for the notification of grades earned in all parts of the evaluation and for the return of graded evaluative instruments will adhere strictly to the Access to Information and Protection of Privacy Act (ATIPP) of the Government of Newfoundland and Labrador. Grades will only be posted or communicated via secure, University-approved channels (e.g., Brightspace or official university email).\\par\n`;
  
  rtf += `\\pard\\qj\\par\n\n`;

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