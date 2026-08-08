// js/calendarView.js

function getModuleLecturesCount(mod) {
  if (!mod) return 0;
  const val = mod.lectureCount ?? mod.lectures ?? mod.totalLectures ?? mod.lecture_count;
  return parseInt(val, 10) || 0;
}

// Calculate calendar structure dynamically based on config
window.calculateCalendarLayout = function (course, config) {
  console.log('CALCULATE CALENDAR CALLED', course, config);
  const { weeksInSemester, meetingsPerWeek, minutesPerMeeting } = config;
  const totalSlots = weeksInSemester * meetingsPerWeek;
  
  const allLectures = [];

  (course.modules || []).forEach((mod) => {
    if (mod.isLab) return;

    if (mod.isExam) {
      const examTitle = mod.title || mod.label || 'Midterm Examination';
      const examObj = {
        id: mod.id,
        moduleId: mod.id,
        moduleLabel: mod.label || 'EXAM',
        moduleTitle: mod.title || 'Exam',
        lectureNumber: 1,
        totalInModule: 1,
        title: examTitle,
        topicTitle: examTitle,
        description: `Covers: ${(mod.coveredModuleIds || []).join(', ')}`,
        topicDescription: `Covers: ${(mod.coveredModuleIds || []).join(', ')}`,
        isExam: true,
        isPlaceholder: false,
        topic: { title: examTitle, description: `Covers: ${(mod.coveredModuleIds || []).join(', ')}` },
        rawTopic: { title: examTitle, description: `Covers: ${(mod.coveredModuleIds || []).join(', ')}` }
      };
      allLectures.push(examObj);
      return;
    }

    // Expand defined topics according to their topic-level lecture counts
    const expandedTopicSlots = [];
    (mod.topics || []).forEach((topic) => {
      let tObj = topic;
      if (typeof topic === 'string') {
        tObj = { title: topic, description: '', lectureCount: 1, learningObjectives: [], textbookQuestions: [] };
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

    console.log(
  'CALENDAR MODULE:',
  mod.label,
  'lectureCount =',
  mod.lectureCount,
  'lectures =',
  mod.lectures,
  'topics =',
  mod.topics
);

    const configuredLectures = getModuleLecturesCount(mod);

    // Module capacity must be max of target lectureCount or sum of defined topics
    const targetModuleLectures = Math.max(configuredLectures, expandedTopicSlots.length);

    // Build the full module stream
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
    weeks.push({ weekNumber: w, slots: weekSlots });
  }

  return { weeks, totalCapacity: totalSlots, totalAssigned: allLectures.length };
};

// Global helper function to handle dropdown changes in the course editor modal
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

// Generate schedule fallback / simple generator
window.generateCalendarSchedule = function (course, lecturesPerWeek = 3, totalWeeks = 12) {
  const lectureStream = [];

  (course.modules || []).forEach((mod) => {
    if (mod.isLab) return;

    if (mod.isExam) {
      const examTitle = mod.title || mod.label || 'Midterm Examination';
      lectureStream.push({
        moduleLabel: mod.label || 'EXAM',
        moduleTitle: mod.title || 'Examination',
        moduleId: mod.id,
        lectureNumber: 1,
        totalInModule: 1,
        topicTitle: examTitle,
        title: examTitle,
        isExam: true,
        isPlaceholder: false
      });
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
        isPlaceholder: !topic
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
    weeks.push({ weekNumber: w, lectures: weekLectures });
  }

  return weeks;
};