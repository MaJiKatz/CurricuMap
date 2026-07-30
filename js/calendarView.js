export function generateCalendarSchedule(course, lecturesPerWeek = 3, totalWeeks = 12) {
  // 1. Flatten all modules into an ordered stream of individual lecture slots
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

  // 2. Map the stream into week slots
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
}