// js/calendarView.js

/**
 * Helper to safely retrieve configured lecture count across various potential property names.
 */
function getModuleLecturesCount(mod) {
  if (!mod) return 0;
  const val = mod.lectureCount ?? mod.lectures ?? mod.totalLectures ?? mod.lecture_count;
  return parseInt(val, 10) || 0;
}

/**
 * Dynamically computes the full calendar layout.
 * - In-Class Assessments (isTakeHome: false) occupy standard class slots.
 * - Take-Home Assessments (isTakeHome: true) sit in the week's due box without taking class slots.
 */
window.calculateCalendarLayout = function (course, config) {
  console.log('CALCULATE CALENDAR CALLED', course, config);
  const { weeksInSemester, meetingsPerWeek, minutesPerMeeting } = config;
  const totalSlots = weeksInSemester * meetingsPerWeek;

  const allLectures = [];
  const weekAssessments = {}; // Maps week number -> array of take-home assessment items

  (course.modules || []).forEach((mod) => {
    if (mod.isLab) return;

    // -------------------------------------------------------------
    // 1. Handle Exams / Assessments
    // -------------------------------------------------------------
    if (mod.isExam) {
      const examTitle = mod.title || mod.label || 'Midterm Examination';

      if (mod.isTakeHome) {
        // TAKE-HOME: Attach to the current week, do NOT consume a class slot
        const currentLectureCount = allLectures.length;
        const mappedWeek = Math.min(
          weeksInSemester,
          Math.max(1, Math.ceil((currentLectureCount + 1) / meetingsPerWeek))
        );

        if (!weekAssessments[mappedWeek]) {
          weekAssessments[mappedWeek] = [];
        }

        weekAssessments[mappedWeek].push({
          id: mod.id,
          moduleId: mod.id,
          label: mod.label || 'Midterm',
          title: examTitle,
          weightPercent: mod.weightPercent || 0,
          isTakeHome: true,
          coveredModuleIds: mod.coveredModuleIds || [],
          description: `Covers: ${(mod.coveredModuleIds || []).join(', ')}`
        });

        return; // Early return: no class meeting slot consumed
      } else {
        // IN-CLASS: Consumes 1 (or configured) class meeting slot in the sequence
        const examSlotsCount = getModuleLecturesCount(mod) || 1;
        for (let e = 0; e < examSlotsCount; e++) {
          allLectures.push({
            moduleId: mod.id,
            moduleLabel: mod.label || 'EXAM',
            moduleTitle: mod.title || 'In-Class Assessment',
            lectureNumber: e + 1,
            totalInModule: examSlotsCount,
            title: examSlotsCount > 1 ? `${examTitle} (Part ${e + 1})` : examTitle,
            topicTitle: examTitle,
            description: `In-Class Assessment. Covers: ${(mod.coveredModuleIds || []).join(', ')}`,
            topicDescription: `In-Class Assessment. Covers: ${(mod.coveredModuleIds || []).join(', ')}`,
            learningObjectives: [],
            textbookQuestions: [],
            isPlaceholder: false,
            isExam: true,
            isTakeHome: false,
            weightPercent: mod.weightPercent || 0
          });
        }
        return;
      }
    }

    // -------------------------------------------------------------
    // 2. Expand topics within teaching modules
    // -------------------------------------------------------------
    const expandedTopicSlots = [];
    (mod.topics || []).forEach((topic) => {
      let tObj = topic;
      if (typeof topic === 'string') {
        tObj = { 
          title: topic, 
          description: '', 
          lectureCount: 1, 
          learningObjectives: [], 
          textbookQuestions: [] 
        };
      }
      const tLectures = parseInt(tObj.lectureCount ?? tObj.lectures ?? tObj.hours, 10) || 1;
      for (let k = 0; k < tLectures; k++) {
        expandedTopicSlots.push({
          topic: tObj,
          partIndex: tLectures > 1 ? k + 1 : null,
          totalParts: tLectures > 1 ? tLectures : null
        });
      }
    });

    const configuredLectures = getModuleLecturesCount(mod);
    const targetModuleLectures = Math.max(configuredLectures, expandedTopicSlots.length);

    // Build module lecture stream
    for (let i = 0; i < targetModuleLectures; i++) {
      const slotTopicInfo = expandedTopicSlots[i] || null;

      if (slotTopicInfo) {
        const { topic, partIndex, totalParts } = slotTopicInfo;
        const displayTitle = partIndex 
          ? `${topic.title || 'Untitled Topic'} (${partIndex}/${totalParts})`
          : (topic.title || 'Untitled Topic');

        allLectures.push({
          moduleId: mod.id,
          moduleLabel: mod.label || '',
          moduleTitle: mod.title || '',
          lectureNumber: i + 1,
          totalInModule: targetModuleLectures,
          title: displayTitle,
          topicTitle: displayTitle,
          description: topic.description || '',
          topicDescription: topic.description || '',
          learningObjectives: topic.learningObjectives || [],
          textbookQuestions: topic.textbookQuestions || [],
          isPlaceholder: false,
          isExam: false,
          topic: topic,
          rawTopic: topic
        });
      } else {
        const placeholderTitle = `${mod.label || 'MOD'} - Lecture ${i + 1}`;
        const placeholderTopic = {
          title: placeholderTitle,
          description: 'Unassigned lecture slot',
          learningObjectives: [],
          textbookQuestions: []
        };

        allLectures.push({
          moduleId: mod.id,
          moduleLabel: mod.label || '',
          moduleTitle: mod.title || '',
          lectureNumber: i + 1,
          totalInModule: targetModuleLectures,
          title: placeholderTitle,
          topicTitle: placeholderTitle,
          description: 'Unassigned lecture slot',
          topicDescription: 'Unassigned lecture slot',
          learningObjectives: [],
          textbookQuestions: [],
          isPlaceholder: true,
          isExam: false,
          topic: placeholderTopic,
          rawTopic: placeholderTopic
        });
      }
    }
  });

  // -------------------------------------------------------------
  // 3. Assemble weekly calendar structure
  // -------------------------------------------------------------
  const weeks = [];
  let lectureIdx = 0;

  for (let w = 1; w <= weeksInSemester; w++) {
    const weekSlots = [];
    for (let m = 1; m <= meetingsPerWeek; m++) {
      const lecture = allLectures[lectureIdx] || null;
      weekSlots.push({
        slotNumber: lectureIdx + 1,
        dayLabel: meetingsPerWeek === 2 ? `Day ${m}` : `Class ${m}`,
        durationMin: minutesPerMeeting,
        lectureData: lecture
      });
      lectureIdx++;
    }
    weeks.push({ 
      weekNumber: w, 
      slots: weekSlots,
      assessments: weekAssessments[w] || []
    });
  }

  return { 
    weeks, 
    totalCapacity: totalSlots, 
    totalAssigned: allLectures.length 
  };
};

/**
 * Format change handler for modal config dropdowns.
 */
window.handleFormatChange = function (value) {
  let meetings = 3;
  let minutes = 50;

  if (value === '2x90') {
    meetings = 2;
    minutes = 90;
  } else if (value === '1x180') {
    meetings = 1;
    minutes = 180;
  }

  if (!window.currentCourseConfig) {
    window.currentCourseConfig = Object.assign({}, window.defaultScheduleConfig);
  }

  window.currentCourseConfig.meetingsPerWeek = meetings;
  window.currentCourseConfig.minutesPerMeeting = minutes;
};

/**
 * Fallback schedule generator.
 */
window.generateCalendarSchedule = function (course, lecturesPerWeek = 3, totalWeeks = 12) {
  const lectureStream = [];
  const weekAssessments = {};

  (course.modules || []).forEach((mod) => {
    if (mod.isLab) return;

    if (mod.isExam) {
      const examTitle = mod.title || mod.label || 'Midterm Examination';
      if (mod.isTakeHome) {
        const mappedWeek = Math.min(
          totalWeeks,
          Math.max(1, Math.ceil((lectureStream.length + 1) / lecturesPerWeek))
        );
        if (!weekAssessments[mappedWeek]) weekAssessments[mappedWeek] = [];
        weekAssessments[mappedWeek].push({
          label: mod.label || 'Midterm',
          title: examTitle,
          weightPercent: mod.weightPercent || 0
        });
      } else {
        lectureStream.push({
          moduleLabel: mod.label || 'EXAM',
          moduleTitle: mod.title || 'In-Class Exam',
          topicTitle: examTitle,
          title: examTitle,
          isExam: true,
          weightPercent: mod.weightPercent || 0
        });
      }
      return;
    }

    const topicSlots = [];
    (mod.topics || []).forEach((t) => {
      let tObj = t;
      if (typeof t === 'string') {
        tObj = { title: t, description: '', lectureCount: 1 };
      }
      const tCount = parseInt(tObj.lectureCount ?? tObj.lectures ?? tObj.hours, 10) || 1;
      for (let tc = 0; tc < tCount; tc++) {
        topicSlots.push(tObj);
      }
    });

    const configuredLectures = getModuleLecturesCount(mod);
    const targetCount = Math.max(configuredLectures, topicSlots.length);

    for (let i = 0; i < targetCount; i++) {
      const topic = topicSlots[i] || null;
      const titleText = topic 
        ? (topic.title || `Lecture ${i + 1}`)
        : `${mod.label || 'MOD'} - Lecture ${i + 1}`;

      lectureStream.push({
        moduleLabel: mod.label,
        moduleTitle: mod.title,
        moduleId: mod.id,
        lectureNumber: i + 1,
        totalInModule: targetCount,
        topicTitle: titleText,
        title: titleText,
        topicDescription: topic ? topic.description : 'Unassigned lecture slot',
        learningObjectives: topic ? topic.learningObjectives || [] : [],
        textbookQuestions: topic ? topic.textbookQuestions || [] : [],
        isPlaceholder: !topic,
        isExam: false
      });
    }
  });

  const weeks = [];
  let currentLectureIdx = 0;

  for (let w = 1; w <= totalWeeks; w++) {
    const weekLectures = [];
    for (let l = 0; l < lecturesPerWeek; l++) {
      if (currentLectureIdx < lectureStream.length) {
        weekLectures.push(lectureStream[currentLectureIdx]);
        currentLectureIdx++;
      }
    }
    weeks.push({ 
      weekNumber: w, 
      lectures: weekLectures, 
      assessments: weekAssessments[w] || [] 
    });
  }

  return weeks;
};