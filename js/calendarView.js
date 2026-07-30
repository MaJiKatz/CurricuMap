// js/calendarView.js

// Calculate calendar structure dynamically based on config
window.calculateCalendarLayout = function (course, config) {
  const { weeksInSemester, meetingsPerWeek, minutesPerMeeting } = config;
  const totalSlots = weeksInSemester * meetingsPerWeek;
  
  // Flatten topics / lectures across the module list
  const allLectures = course.modules ? course.modules.flatMap(m => m.topics || []) : [];
  
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
    const count = parseInt(mod.lectureCount, 10) || 1;
    for (let i = 1; i <= count; i++) {
      lectureStream.push({
        moduleLabel: mod.label,
        moduleTitle: mod.title,
        lectureNumber: i,
        totalInModule: count,
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