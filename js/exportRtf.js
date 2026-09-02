/* ============================================================
   js/exportRtf.js
   Generates and triggers RTF downloads for individual or all course outlines.
   Includes global institutional policy resolution and curriculum stats summaries.
   ============================================================ */

// --- HELPER: RESOLVE RAW MODULE IDs / COMPOUND CODES TO HUMAN-READABLE TITLES ---
function resolveCoveredModulesText(course, rawInput) {
  if (!rawInput) return '';

  let idList = [];
  if (Array.isArray(rawInput)) {
    idList = rawInput;
  } else if (typeof rawInput === 'number') {
    idList = [String(rawInput)];
  } else if (typeof rawInput === 'string') {
    idList = rawInput.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  }

  if (idList.length === 0) return '';

  const allCourses = (window.DATA && Array.isArray(window.DATA.courses)) 
    ? window.DATA.courses 
    : (course ? [course] : []);

  const resolved = idList.map((rawId) => {
    const idStr = String(rawId).trim();
    const cleanId = idStr.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (course && Array.isArray(course.modules)) {
      const matchedModIdx = course.modules.findIndex((m, mIdx) => {
        const mIdClean = String(m.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const mCodeClean = String(m.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const mLabelClean = String(m.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const mTitleClean = String(m.title || m.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const mNum = String(mIdx + 1);

        return (
          mIdClean === cleanId ||
          mCodeClean === cleanId ||
          mLabelClean === cleanId ||
          (mTitleClean && cleanId.includes(mTitleClean)) ||
          cleanId === `m${mNum}` ||
          cleanId === `module${mNum}` ||
          cleanId.endsWith(`m${mNum}`) ||
          cleanId.endsWith(`module${mNum}`)
        );
      });

      if (matchedModIdx !== -1) {
        const m = course.modules[matchedModIdx];
        const label = m.label || m.code || `Module ${matchedModIdx + 1}`;
        const title = m.title || m.name;
        return title ? `${label}: ${title}` : label;
      }
    }

    for (const c of allCourses) {
      if (!Array.isArray(c.modules)) continue;

      const cCodeClean = String(c.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      for (let mIdx = 0; mIdx < c.modules.length; mIdx++) {
        const m = c.modules[mIdx];
        const mIdClean = String(m.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const mNum = String(mIdx + 1);

        const isMatch = (
          cleanId === `${cCodeClean}${mIdClean}` ||
          cleanId === `${cCodeClean}m${mNum}` ||
          cleanId === `${cCodeClean}module${mNum}` ||
          (mIdClean && cleanId === mIdClean)
        );

        if (isMatch) {
          const label = m.label || m.code || `Module ${mIdx + 1}`;
          const title = m.title || m.name || '';
          const coursePrefix = (course && c.id !== course.id && c.code) ? `${c.code} ` : '';
          const modText = title ? `${label}: ${title}` : label;
          return `${coursePrefix}${modText}`;
        }
      }
    }

    return idStr;
  });

  return resolved.join('; ');
}

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

  rtf += `}\n`;

  triggerRtfDownload(rtf, `${course.code.replace(/\s+/g, '_')}_Course_Outline.rtf`);
}

// --- 2. EXPORT ALL COURSES (WITH DEDICATED SUMMARY PAGE & SECTION BREAKS) ---
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

  // PAGE 1: PROGRAM SUMMARY
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
  rtf += `\\pard\\qj\\li360\\'95  \\b Total Courses:\\b0  ${courses.length}\\par\n`;
  rtf += `\\pard\\qj\\li360\\'95  \\b Total Program Lecture Hours:\\b0  ${grandTotalLectureHours} hrs\\par\n`;
  rtf += `\\pard\\qj\\li360\\'95  \\b Total Program Laboratory Hours:\\b0  ${grandTotalLabHours} hrs\\par\n`;
  rtf += `\\pard\\qj\\li360\\'95  \\b Total Combined Contact Hours:\\b0  ${grandTotalHours} hrs\\par\n`;
  rtf += `\\pard\\qj\\par\n\n`;

  rtf += `\\pard\\qj\\b\\fs28 Course-by-Course Hours Breakdown\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  rtf += courseStatsListRtf;

  rtf += `\\sect\\page\\sectd\n\n`;

  courses.forEach((course, index) => {
    if (index > 0) {
      rtf += `\\page\n`;
    }
    rtf += buildCourseRtfContent(course, connections);
  });

  rtf += `}\n`;

  triggerRtfDownload(rtf, `Complete_Curriculum_Outlines.rtf`);
}

// --- HELPER: EXTRACT PER-TOPIC LECTURE COUNT ---
function getTopicLectureCount(topic) {
  if (typeof topic === 'number') return topic;
  if (!topic || typeof topic === 'string') return 1;
  const val = parseFloat(
    topic.lectureCount ?? 
    topic.lectures ?? 
    topic.hours ?? 
    topic.count ?? 
    topic.numLectures ?? 
    topic.duration
  );
  return (!isNaN(val) && val > 0) ? val : 1;
}

// --- 3. HELPER: CALCULATE COURSE HOURS & EVALUATION SCHEME ---
function calculateCourseHoursAndStats(course) {
  let lectureCount = 0;
  let labHours = 0;
  let definedWeightTotal = 0;
  const midterms = [];
  const labs = [];

  if (course.labHours !== undefined) {
    labHours = parseFloat(course.labHours) || 0;
  }

  (course.modules || []).forEach((mod) => {
    if (mod.isExam) {
      const w = parseFloat(mod.weightPercent || mod.weight) || 0;
      midterms.push({ 
        title: mod.title || mod.label || 'Midterm Examination', 
        weight: w, 
        date: mod.date || mod.scheduledWeek 
      });
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

      labs.push({ title: mod.title || mod.label || 'Laboratory / Practical Work', weight: w, hours: modLabHours });
    } else {
      let topicSum = 0;
      if (Array.isArray(mod.topics) && mod.topics.length > 0) {
        mod.topics.forEach((topic) => {
          topicSum += getTopicLectureCount(topic);
        });
      }

      const explicitModCount = parseFloat(mod.lectureCount || mod.lectures || mod.hours) || 0;
      const effectiveModLectures = Math.max(explicitModCount, topicSum);

      lectureCount += effectiveModLectures;
    }
  });

  const config = window.currentCourseConfig || window.defaultScheduleConfig || { weeksInSemester: 12, meetingsPerWeek: 3 };
  const meetingsPerWeek = config.meetingsPerWeek || config.lecturesPerWeek || 3;
  const weeksInSemester = config.weeksInSemester || 12;
  
  const lectureHours = lectureCount > 0 ? lectureCount : (meetingsPerWeek * weeksInSemester);
  const totalHours = lectureHours + labHours;

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

  const finalExamWeight = Math.max(0, parseFloat((100 - definedWeightTotal).toFixed(2)));

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

// --- HELPER: BUILD HIERARCHICAL ALLOCATION OF MARKS RTF ---
function buildEvaluationSchemeRtf(course, config) {
  const meetingsPerWeek = (config && config.meetingsPerWeek) || 
                          (window.currentCourseConfig && window.currentCourseConfig.meetingsPerWeek) || 3;
  const weeksInSemester = (config && config.weeksInSemester) || 
                          (window.currentCourseConfig && window.currentCourseConfig.weeksInSemester) || 12;

  let currentClassCount = 0;
  const examMetadata = [];

  (course.modules || []).forEach((mod) => {
    if (mod.isLab) return;

    if (mod.isExam) {
      const mappedWeek = Math.min(
        weeksInSemester,
        Math.max(1, Math.ceil((currentClassCount + 1) / meetingsPerWeek))
      );

      examMetadata.push({
        module: mod,
        mappedWeek: mappedWeek
      });

      if (!mod.isTakeHome) {
        const examSlots = parseInt(mod.lectureCount || mod.lectures, 10) || 1;
        currentClassCount += examSlots;
      }
      return;
    }

    let topicSum = 0;
    if (Array.isArray(mod.topics) && mod.topics.length > 0) {
      mod.topics.forEach((topic) => {
        topicSum += getTopicLectureCount(topic);
      });
    }
    const explicitModCount = parseFloat(mod.lectureCount || mod.lectures || mod.hours) || 0;
    const effectiveModLectures = Math.max(explicitModCount, topicSum, 1);

    currentClassCount += effectiveModLectures;
  });

  const categories = {};
  let totalDefinedWeight = 0;

  examMetadata.forEach(({ module: mod, mappedWeek }) => {
    const typeLabel = (mod.label || 'Assessment').trim();
    if (!categories[typeLabel]) {
      categories[typeLabel] = {
        totalWeight: 0,
        items: []
      };
    }

    const weight = parseFloat(mod.weightPercent || mod.weight) || 0;
    categories[typeLabel].totalWeight += weight;
    totalDefinedWeight += weight;

    const rawCovered = mod.coveredModuleIds || mod.coveredModules || mod.modulesCovered || mod.scope || mod.covered;
    const coveredStr = resolveCoveredModulesText(course, rawCovered);

    categories[typeLabel].items.push({
      title: mod.title || `${typeLabel} Item`,
      weight: weight,
      isTakeHome: !!mod.isTakeHome,
      coveredModules: coveredStr,
      week: mappedWeek
    });
  });

  (course.modules || []).forEach((mod) => {
    if (mod.isLab) {
      const labLabel = (mod.label || 'Laboratory Component').trim();
      if (!categories[labLabel]) {
        categories[labLabel] = { totalWeight: 0, items: [] };
      }

      if (Array.isArray(mod.labs) && mod.labs.length > 0) {
        mod.labs.forEach((lab) => {
          const w = parseFloat(lab.weightPercent || lab.weight) || 0;
          categories[labLabel].totalWeight += w;
          totalDefinedWeight += w;
          categories[labLabel].items.push({
            title: lab.title || 'Lab Experiment',
            weight: w,
            isTakeHome: false,
            coveredModules: '',
            week: null
          });
        });
      } else {
        const w = parseFloat(mod.weightPercent || mod.weight) || 0;
        categories[labLabel].totalWeight += w;
        totalDefinedWeight += w;
        categories[labLabel].items.push({
          title: mod.title || 'Laboratory Section',
          weight: w,
          isTakeHome: false,
          coveredModules: '',
          week: null
        });
      }
    }
  });

  const customEval = course.evaluationScheme || course.evaluation || course.gradingScheme;
  if (Object.keys(categories).length === 0 && Array.isArray(customEval) && customEval.length > 0) {
    customEval.forEach((item) => {
      const typeLabel = item.component || item.name || 'Evaluation';
      const w = parseFloat(item.weight || item.allocation) || 0;
      totalDefinedWeight += w;

      const rawCovered = item.coveredModules || item.coveredModuleIds || item.modulesCovered || item.scope;

      categories[typeLabel] = {
        totalWeight: w,
        items: [{
          title: item.title || item.component || item.name,
          weight: w,
          isTakeHome: !!item.isTakeHome,
          coveredModules: resolveCoveredModulesText(course, rawCovered),
          week: item.week || item.scheduledWeek || null
        }]
      };
    });
  }

  const finalExamWeight = Math.max(0, parseFloat((100 - totalDefinedWeight).toFixed(2)));

  let rtf = `\\pard\\qj\\li360\\b 3.1 Allocation of Marks:\\b0\\par\n\n`;

  const categoryKeys = Object.keys(categories);
  if (categoryKeys.length === 0 && finalExamWeight === 100) {
    rtf += `\\pard\\qj\\li720\\\'95  \\b Final Examination:\\b0  100% \\cf2 (Scheduled by Registrar)\\cf1\\par\n`;
    return rtf;
  }

  categoryKeys.forEach((catType) => {
    const catData = categories[catType];
    const totalWeightText = catData.totalWeight > 0 ? ` (${catData.totalWeight}%)` : '';

    rtf += `\\pard\\qj\\li360\\b\\fs24 ${escapeRtf(catType)}${totalWeightText}\\b0\\fs22\\par\n`;

    catData.items.forEach((item) => {
      const modeBadge = item.isTakeHome ? 'Take-Home' : 'In-Person';
      const itemWeightText = item.weight > 0 ? `: ${item.weight}%` : '';

      rtf += `\\pard\\qj\\li720\\\'95  \\b ${escapeRtf(item.title)}\\b0${itemWeightText} \\cf2(${modeBadge})\\cf1\\par\n`;

      if (item.coveredModules) {
        rtf += `\\pard\\qj\\li1080\\i\\cf2 Scope: ${escapeRtf(item.coveredModules)}\\cf1\\i0\\par\n`;
      }
      if (item.week) {
        rtf += `\\pard\\qj\\li1080\\i\\cf2 Scheduled: Week ${item.week}\\cf1\\i0\\par\n`;
      }
    });

    rtf += `\\par\n`;
  });

  if (finalExamWeight > 0) {
    rtf += `\\pard\\qj\\li360\\b\\fs24 Final Examination (${finalExamWeight}%)\\b0\\fs22\\par\n`;
    rtf += `\\pard\\qj\\li720\\\'95  \\b Comprehensive Final Exam\\b0: ${finalExamWeight}% \\cf2(In-Person)\\cf1\\par\n`;
    rtf += `\\pard\\qj\\li1080\\i\\cf2 Scheduled: By University Registrar during examination period\\cf1\\i0\\par\n`;
  }

  return rtf;
}

// --- HELPER: BUILD SCHEDULE SLOTS ---
function buildCourseSchedule(course, meetingsPerWeek, weeksInSemester) {
  const slots = [];

  (course.modules || []).forEach((mod, mIdx) => {
    const modLabel = mod.label || mod.code || `M${mIdx + 1}`;
    const modTitle = mod.title || mod.label || `Module ${mIdx + 1}`;

    if (mod.isExam) {
      if (!mod.isTakeHome) {
        const examSlots = parseInt(mod.lectureCount || mod.lectures, 10) || 1;
        for (let e = 0; e < examSlots; e++) {
          slots.push({
            isExam: true,
            title: examSlots > 1 ? `${modTitle} (Part ${e + 1})` : modTitle,
            moduleLabel: modLabel
          });
        }
      }
    } else if (mod.isLab) {
      slots.push({
        isLab: true,
        title: modTitle,
        moduleLabel: modLabel
      });
    } else {
      let assignedTopicLectures = 0;

      if (Array.isArray(mod.topics) && mod.topics.length > 0) {
        mod.topics.forEach((topic, tIdx) => {
          const topicTitle = typeof topic === 'string' 
            ? topic 
            : (topic.title || topic.name || topic.label || `Topic ${tIdx + 1}`);
          
          const count = getTopicLectureCount(topic);
          assignedTopicLectures += count;

          for (let i = 1; i <= count; i++) {
            slots.push({
              topicTitle: topicTitle,
              moduleLabel: modLabel,
              partInfo: count > 1 ? `(Lec ${i}/${count})` : ''
            });
          }
        });
      }

      const explicitModCount = parseFloat(mod.lectureCount || mod.lectures || mod.hours) || 0;
      const totalModLectures = Math.max(explicitModCount, assignedTopicLectures);
      const remainingUnassignedSlots = totalModLectures - assignedTopicLectures;

      for (let r = 0; r < remainingUnassignedSlots; r++) {
        slots.push({
          topicTitle: modTitle,
          moduleLabel: modLabel,
          partInfo: '',
          isUnassignedModuleSlot: true
        });
      }
    }
  });

  const schedule = [];
  let currentSlotIdx = 0;

  for (let w = 1; w <= weeksInSemester; w++) {
    const weekLectures = [];
    for (let d = 1; d <= meetingsPerWeek; d++) {
      if (currentSlotIdx < slots.length) {
        weekLectures.push(slots[currentSlotIdx]);
        currentSlotIdx++;
      }
    }
    schedule.push({
      weekNumber: w,
      lectures: weekLectures
    });
  }

  return schedule;
}

// --- 4. HELPER: BUILD COURSE RTF STRING ---
function buildCourseRtfContent(course, connections) {
  let rtf = '';
  const stats = calculateCourseHoursAndStats(course);

  const globalSettings = typeof window.getGlobalSettings === 'function' 
    ? window.getGlobalSettings() 
    : (window.DEFAULT_GLOBAL_SETTINGS || {});

  // HEADER
  rtf += `\\pard\\qc\\b\\fs36 ${escapeRtf(course.code)}: ${escapeRtf(course.name)}\\b0\\fs22\\par\n`;
  if (course.credits) {
    rtf += `\\pard\\qc\\cf2\\fs20 (${course.credits} Credit Hours | Total Contact Hours: ${stats.totalHours} hrs)\\cf1\\fs22\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // INSTRUCTOR & PREREQUISITES
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
  
  const prereqs = course.prerequisites || course.prereqs || 'None';
  const coreqs = course.corequisites || course.coreqs || 'None';
  rtf += `\\pard\\qj\\li360\\b Required Prerequisites:\\b0  ${escapeRtf(prereqs)}\\par\n`;
  rtf += `\\pard\\qj\\li360\\b Required Co-requisites:\\b0  ${escapeRtf(coreqs)}\\par\n`;
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 1. TEXTBOOKS & RESOURCES
  rtf += `\\pard\\qj\\b\\fs28 1. Textbooks & Course Resources\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;

  let textbookList = Array.isArray(course.textbooks) ? course.textbooks : [];
  if (textbookList.length === 0 && course.textbook) {
    if (typeof course.textbook === 'string') {
      textbookList = [{ title: course.textbook, isRequired: true }];
    } else if (typeof course.textbook === 'object') {
      textbookList = [course.textbook];
    }
  }

  const requiredBooks = textbookList.filter(b => b.isRequired !== false);
  const recommendedBooks = textbookList.filter(b => b.isRequired === false);

  if (textbookList.length > 0) {
    if (requiredBooks.length > 0) {
      rtf += `\\pard\\qj\\li360\\b Required Textbooks:\\b0\\par\n`;
      requiredBooks.forEach((tb) => {
        const title = tb.title || 'Untitled Textbook';
        const authorStr = tb.author ? ` by ${tb.author}` : '';
        const isbnStr = (tb.isbn || tb.edition) ? ` (ISBN/Edition: ${tb.isbn || tb.edition})` : '';
        rtf += `\\pard\\qj\\li720\\'95  \\b ${escapeRtf(title)}\\b0${escapeRtf(authorStr)}${escapeRtf(isbnStr)}\\par\n`;
      });
      rtf += `\\par\n`;
    }

    if (recommendedBooks.length > 0) {
      rtf += `\\pard\\qj\\li360\\b Supplementary / Recommended Readings:\\b0\\par\n`;
      recommendedBooks.forEach((tb) => {
        const title = tb.title || 'Untitled Book';
        const authorStr = tb.author ? ` by ${tb.author}` : '';
        const isbnStr = (tb.isbn || tb.edition) ? ` (ISBN/Edition: ${tb.isbn || tb.edition})` : '';
        rtf += `\\pard\\qj\\li720\\'95  ${escapeRtf(title)}${escapeRtf(authorStr)}${escapeRtf(isbnStr)}\\par\n`;
      });
      rtf += `\\par\n`;
    }
  } else {
    rtf += `\\pard\\qj\\li360\\i [No required textbooks assigned for this course.]\\i0\\par\n\n`;
  }

  if (course.software || course.otherResources) {
    if (course.software) rtf += `\\pard\\qj\\li360\\b Required Software/Tools:\\b0  ${escapeRtf(course.software)}\\par\n`;
    if (course.otherResources) rtf += `\\pard\\qj\\li360\\b Other Required Resources:\\b0  ${escapeRtf(course.otherResources)}\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 2. CALENDAR & SCHEDULE
  rtf += `\\pard\\qj\\b\\fs28 2. Course Schedule Overview\\b0\\fs22\\par\n`;
  
  const config = window.currentCourseConfig || window.defaultScheduleConfig || { weeksInSemester: 12, meetingsPerWeek: 3, minutesPerBlock: 50 };
  const meetingsPerWeek = config.meetingsPerWeek || config.lecturesPerWeek || 3;
  const minutesPerBlock = config.minutesPerBlock || config.lectureLength || 50;
  const weeksInSemester = config.weeksInSemester || 12;

  rtf += `\\pard\\qj\\li360\\cf2 Class Format: ${meetingsPerWeek} lectures/week (${minutesPerBlock} min/block, ${stats.lectureHours} total lecture hrs) | ${stats.labHours} lab hrs across ${weeksInSemester} weeks.\\cf1\\par\n`;
  rtf += `\\line\\par\n`;
  
  const schedule = buildCourseSchedule(course, meetingsPerWeek, weeksInSemester);
  if (schedule && schedule.length > 0) {
    schedule.forEach((week) => {
      rtf += `\\pard\\qj\\li360\\b Week ${week.weekNumber}:\\b0\\par\n`;

      if (week.lectures && week.lectures.length > 0) {
        week.lectures.forEach((lec, idx) => {
          let lineText = '';

          if (lec.isExam) {
            lineText = `\\b [EXAM]\\b0  ${escapeRtf(lec.title || 'Midterm Examination')}`;
          } else if (lec.isLab) {
            lineText = `\\b [LAB]\\b0  ${escapeRtf(lec.title || 'Laboratory Session')}`;
          } else if (lec.isUnassignedModuleSlot) {
            lineText = `\\b ${escapeRtf(lec.topicTitle)}\\b0`;
          } else {
            const topicName = escapeRtf(lec.topicTitle || 'Topic Lecture');
            const part = lec.partInfo ? ` \\cf2${escapeRtf(lec.partInfo)}\\cf1` : '';
            const modTag = lec.moduleLabel ? ` \\cf2[${escapeRtf(lec.moduleLabel)}]\\cf1` : '';

            lineText = `\\b ${topicName}\\b0${part}${modTag}`;
          }

          rtf += `\\pard\\qj\\li720 Day ${idx + 1}: ${lineText}\\par\n`;
        });
      } else {
        rtf += `\\pard\\qj\\li720\\cf2 Independent Study / Term Break / Review\\cf1\\par\n`;
      }
      
      rtf += `\\par\n`;
    });
  } else {
    rtf += `\\pard\\qj\\li360\\i [Calendar generated based on topic schedule]\\i0\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 3. EVALUATION & GRADING SYSTEM
  rtf += `\\pard\\qj\\b\\fs28 3. Method of Evaluation & Grading System\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;

  rtf += buildEvaluationSchemeRtf(course, config);
  rtf += `\\par\n`;

  const gradingSys = course.gradingSystem || globalSettings.gradingSystem || "Numeric Grade System (0-100%, pass mark 50%) in accordance with University Senate regulations.";
  rtf += `\\pard\\qj\\li360\\b 3.2 Grading System:\\b0  ${escapeRtf(gradingSys)}\\par\n`;

  const missedWork = course.alternateEvaluationPolicy || course.missedWorkPolicy || globalSettings.missedWorkPolicy || "In accordance with University Regulations (Exemptions from Parts of the Evaluation), students unable to complete an evaluation due to acceptable cause must notify the instructor promptly. Where acceptable cause is established, an alternate evaluation or reweighting will be offered.";
  rtf += `\\pard\\qj\\li360\\b 3.3 Alternate Evaluation & Missed Work Policy:\\b0\\par\n`;
  rtf += `\\pard\\qj\\li720 ${escapeRtf(missedWork)}\\par\n`;
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 4. MODULES & TOPICS
  rtf += `\\pard\\qj\\b\\fs28 4. Course Modules & Detailed Topics\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;

  (course.modules || []).forEach((mod, idx) => {
    const modNum = idx + 1;
    
    let topicSum = 0;
    if (Array.isArray(mod.topics) && mod.topics.length > 0) {
      mod.topics.forEach((topic) => {
        topicSum += getTopicLectureCount(topic);
      });
    }
    const explicitModCount = parseFloat(mod.lectureCount || mod.lectures || mod.hours) || 0;
    const moduleLectureSum = Math.max(explicitModCount, topicSum);

    const lecTag = ` [${moduleLectureSum} ${moduleLectureSum === 1 ? 'lecture' : 'lectures'}]`;

    rtf += `\\pard\\qj\\li360\\b\\fs24 4.${modNum} Module ${modNum}: ${escapeRtf(mod.title || mod.label)}${escapeRtf(lecTag)}\\b0\\fs22\\par\n`;
    
    if (mod.chapter) {
      rtf += `\\pard\\qj\\li360\\cf2 Reading Reference: Chapter ${escapeRtf(mod.chapter)}\\cf1\\par\n`;
    }

    if (Array.isArray(mod.topics) && mod.topics.length > 0) {
      mod.topics.forEach((topic, tIdx) => {
        const topicTitle = typeof topic === 'string' ? topic : (topic.title || topic.label || topic.name || '');
        const topicLecCount = getTopicLectureCount(topic);
        const lecInfo = topicLecCount ? ` \\cf2 (${topicLecCount} lecture${topicLecCount > 1 ? 's' : ''})\\cf1` : '';

        if (topicTitle) {
          rtf += `\\pard\\qj\\li720\\b Topic 4.${modNum}.${tIdx + 1}: ${escapeRtf(topicTitle)}\\b0${lecInfo}\\par\n`;
        }

        if (topic.description) {
          rtf += `\\pard\\qj\\li1080\\i ${escapeRtf(topic.description)}\\i0\\par\n`;
        }

        const objs = topic.learningObjectives || topic.objectives || [];
        if (objs.length > 0) {
          rtf += `\\pard\\qj\\li1080\\b Learning Objectives:\\b0\\par\n`;
          objs.forEach((obj) => {
            const objText = typeof obj === 'string' ? obj : (obj.text || obj.title || obj.description || '');
            if (objText) {
              rtf += `\\pard\\qj\\li1440\\cf2 - ${escapeRtf(objText)}\\cf1\\par\n`;
            }
          });
        }

        const questions = topic.textbookQuestions || topic.questions || [];
        if (questions.length > 0) {
          rtf += `\\pard\\qj\\li1080\\b Recommended Practice Questions:\\b0\\par\n`;
          questions.forEach((quest) => {
            const questText = typeof quest === 'string' ? quest : (quest.text || quest.title || '');
            if (questText) {
              rtf += `\\pard\\qj\\li1440\\cf2 - ${escapeRtf(questText)}\\cf1\\par\n`;
            }
          });
        }

        rtf += `\\par\n`;
      });
    } else {
      rtf += `\\pard\\qj\\li720\\'95  ${escapeRtf(mod.description || 'Core topics and competencies for this unit.')}\\par\n`;
    }

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

  // SECTION 6. GENERATIVE AI POLICY
  rtf += `\\pard\\qj\\b\\fs28 6. Use of Assistive Tools & Generative AI Policy\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  if (course.aiPolicy) {
    rtf += `\\pard\\qj\\li360 ${escapeRtf(course.aiPolicy)}\\par\n`;
  } else {
    rtf += `\\pard\\qj\\li360 Permissible use of assistive technologies and Generative Artificial Intelligence (e.g., ChatGPT, Claude) in this course will be explicitly stated for each assignment. Unless explicitly permitted by the instructor, the use of generative AI tools to produce coursework, code, or written assignments is unauthorized and constitutes academic misconduct.\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 7. ADDITIONAL INFO
  rtf += `\\pard\\qj\\b\\fs28 7. Additional Course Information\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;
  if (course.additionalInfo) {
    rtf += `\\pard\\qj\\li360 ${escapeRtf(course.additionalInfo)}\\par\n`;
  } else {
    rtf += `\\pard\\qj\\li360\\i [Faculty notes on attendance, communication guidelines, late submission penalties, or supplementary learning resources]\\i0\\par\n`;
  }
  rtf += `\\pard\\qj\\par\n\n`;

  // SECTION 8. UNIVERSITY POLICIES
  rtf += `\\pard\\qj\\b\\fs28 8. University Statements & Institutional Policies\\b0\\fs22\\par\n`;
  rtf += `\\line\\par\n`;

  const academicIntegrity = course.academicIntegrity || globalSettings.academicIntegrity || "Students are expected to adhere strictly to standards of academic honesty. Please refer to the entry on Academic Misconduct in the University Calendar for definitions, procedures, and penalties regarding plagiarism, cheating, and misrepresentation.";
  rtf += `\\pard\\qj\\li360\\b 8.1 Academic Integrity:\\b0  ${escapeRtf(academicIntegrity)}\\par\n\n`;

  const accommodations = course.accommodations || globalSettings.accommodations || "The institution is committed to accommodating students with disabilities. Students requiring academic accommodations are encouraged to register with Student Accessibility Services (SAS) and inform the instructor as early as possible in the semester.";
  rtf += `\\pard\\qj\\li360\\b 8.2 Student Accommodations:\\b0  ${escapeRtf(accommodations)}\\par\n\n`;

  const privacyAtipp = course.privacyAtipp || globalSettings.privacyAtipp || "Methods used for the notification of grades earned in all parts of the evaluation and for the return of graded evaluative instruments will adhere strictly to the Access to Information and Protection of Privacy Act (ATIPP) of the local Government. Grades will only be posted or communicated via secure, University-approved channels (e.g., Brightspace or official university email).";
  rtf += `\\pard\\qj\\li360\\b 8.3 Student Privacy & Grade Notification (ATIPP):\\b0  ${escapeRtf(privacyAtipp)}\\par\n`;
  
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