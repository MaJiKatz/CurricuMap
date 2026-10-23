/* ============================================================
   js/introModal.js
   Interactive quick-start guide modal with step-by-step navigation.
   Uses localStorage to auto-trigger on first-time visits only.
   ============================================================ */

/* ============================================================
   js/introModal.js - Updated Guided Tour Steps
   ============================================================ */

const INTRO_STEPS = [
  {
    title: "Welcome to Curriculum Map",
    content: "Design a whole degree program in one place: map courses and the connections between them, build week-by-week course outlines, track program learning outcomes, and export everything as one document package. This quick tour covers each area. Reopen it any time with <b>\u2753 Guide</b>.",
    badge: "1 of 11"
  },
  {
    title: "1. Adding Courses & Year Columns",
    content: "Click <b>+ Add Course</b>, or double-click a card to edit it. On the <b>General Info</b> tab set the code, name, year column, number of teaching weeks and weekly class pattern (3\u00d750 min, 2\u00d775 min, a 3 h block, or a custom mix such as 1 h + 2 h). Choose the class days (e.g. Tue/Thu) and say which <b>Programs</b> the course belongs to and whether it is required or an elective there. Each card has buttons to move, edit, open the calendar, open the course outline, collapse, and delete (red, last).",
    badge: "2 of 11"
  },
  {
    title: "2. Modules, Topics, Assessments & Labs",
    content: "On the <b>Modules</b> tab add modules and topics (in lecture hours; 0.25 or 1.5 is fine), learning objectives, practice questions, assessments (in class or take-home, with weights) and lab sections. A live time budget shows what fits in the term and flags anything over. Mark a module <b>time permitting</b> and it is only scheduled if there is room. <b>Outline &amp; Policies</b> holds the instructor details, prerequisites and policy text that appear in the printed outline.",
    badge: "3 of 11"
  },
  {
    title: "3. Optional Topic Groups",
    content: "When different instructors teach different options, give modules the same <b>group name</b> and choose how many to teach (\"teach 2 of 5\") and why: time, instructor or student vote. Tick which ones are taught this year. Untaught modules drop out of the schedule and hours, and the outline lists the group and what is taught.",
    badge: "4 of 11"
  },
  {
    title: "4. Interactive Map & Detail Drawer",
    content: "Courses sit in year columns. Click a module to open the <b>Detail Drawer</b> with its objectives, textbooks, exam date and connections across the degree. Use a card's move handle to rearrange it; positions are saved with the workspace.",
    badge: "5 of 11"
  },
  {
    title: "5. Connections (Connect Mode)",
    content: "Turn on <b>\ud83d\udd17 Connect Mode</b>, pick a tier (<i>Strong, Related, Weak</i>) and click two modules to draw a line. Click two <i>course cards</i> to link whole courses (rose dashed line, written in the outline as \"This course builds strongly upon\u2026\"). Click any line later to cycle strong \u2192 related \u2192 weak. The legend at the bottom filters which tiers are shown.",
    badge: "6 of 11"
  },
  {
    title: "6. Term Calendar & Course Calendar",
    content: "<b>\ud83d\udcc5 Term Calendar</b> holds the program-wide first day of classes, <b>important dates</b> (tick <i>no class</i> to skip them; the term slides later) and <b>day swaps</b>: a date that runs another weekday's schedule, such as a Tuesday that follows a Wednesday schedule. In each course you can use the program calendar, set <b>custom dates</b>, or choose <b>no dates</b> for an outline without dates. The <b>calendar icon</b> on a card opens the week-by-week timetable with dates, topics, exams and due dates.",
    badge: "7 of 11"
  },
  {
    title: "7. Program Outcomes & the Matrix",
    content: "Under <b>\ud83c\udfaf Outcomes \u2192 Define outcomes</b> write each outcome once, with sub-outcomes to any depth (codes like 1, 1.A, 1.A.1 are generated). Give an outcome a <b>Subject area</b> (e.g. Physical) or restrict it to one program. In the course editor's Modules tab, tag topics with an outcome and a level: <b>I</b> Introduced, <b>R</b> Reinforced or <b>A</b> Advanced (\"Apply to all\" tags a whole module). The <b>Matrix</b> tab is read-only: it is computed from those tags, rolls sub-outcomes up into their parent, and flags outcomes no course covers or that never reach Advanced.",
    badge: "8 of 11"
  },
  {
    title: "8. Majors, Minors, Honours & Specialities",
    content: "On the <b>Programs</b> tab add each major, honours, minor or speciality, then mark every course <b>Required</b> or <b>Elective</b> in it. In the Matrix, pick a program in <b>View</b> to see its required courses, then its electives, with <b>Guaranteed</b> (required courses only) and <b>Possible</b> (if electives are taken) levels. Filter by subject area, and see which outcomes a minor may only reach through electives.",
    badge: "9 of 11"
  },
  {
    title: "9. Saving, Sharing & Merging",
    content: "\ud83d\udd12 <b>100% private and local:</b> nothing leaves your browser, and your work autosaves. Use <b>\u2b07\ufe0f Save Workspace</b> to download a <code>.json</code> file with courses, connections, outcomes, programs and the term calendar. <b>\u2b06\ufe0f Load Workspace</b> replaces the board, or, if one is already open, lets you merge in just the courses you pick.",
    badge: "10 of 11"
  },
  {
    title: "10. Settings & Exporting Outlines",
    content: "Set institutional policies and defaults in <b>\u2699\ufe0f Settings</b>. The document icon on a card downloads one course outline (RTF). <b>\ud83d\udcc4 Download All Outlines (RTF)</b> builds the full package: program hour totals and warnings, the outcome list, the curriculum matrix (overall and for each program), then every course outline with schedule, evaluation, modules and connections. Word opens the RTF directly.",
    badge: "11 of 11"
  },
];

let currentIntroStep = 0;

function initIntroModal() {
  const hasSeenIntro = localStorage.getItem('hasSeenCurriculumIntro');
  if (!hasSeenIntro) {
    openIntroModal();
  }
}

function openIntroModal() {
  currentIntroStep = 0;
  renderIntroStep();
  const modal = document.getElementById('introModal');
  if (modal) modal.classList.remove('hidden');
}

function closeIntroModal() {
  const modal = document.getElementById('introModal');
  if (modal) modal.classList.add('hidden');
  localStorage.setItem('hasSeenCurriculumIntro', 'true');
}

function renderIntroStep() {
  const step = INTRO_STEPS[currentIntroStep];
  if (!step) return;

  document.getElementById('introTitle').innerHTML = step.title;
  document.getElementById('introContent').innerHTML = step.content;
  document.getElementById('introBadge').textContent = step.badge;

  // Toggle prev/next button states
  const prevBtn = document.getElementById('introPrevBtn');
  const nextBtn = document.getElementById('introNextBtn');

  if (prevBtn) {
    prevBtn.style.visibility = currentIntroStep === 0 ? 'hidden' : 'visible';
  }

  if (nextBtn) {
    if (currentIntroStep === INTRO_STEPS.length - 1) {
      nextBtn.textContent = "Get Started 🚀";
      nextBtn.classList.add('btn-primary');
      nextBtn.classList.remove('btn-secondary');
    } else {
      nextBtn.textContent = "Next →";
      nextBtn.classList.remove('btn-primary');
      nextBtn.classList.add('btn-secondary');
    }
  }

  // Update step indicators / dots
  const dotsContainer = document.getElementById('introDots');
  if (dotsContainer) {
    dotsContainer.innerHTML = INTRO_STEPS.map((_, i) => 
      `<span class="intro-dot ${i === currentIntroStep ? 'active' : ''}" onclick="jumpToIntroStep(${i})"></span>`
    ).join('');
  }
}

function nextIntroStep() {
  if (currentIntroStep < INTRO_STEPS.length - 1) {
    currentIntroStep++;
    renderIntroStep();
  } else {
    closeIntroModal();
  }
}

function prevIntroStep() {
  if (currentIntroStep > 0) {
    currentIntroStep--;
    renderIntroStep();
  }
}

function jumpToIntroStep(stepIndex) {
  currentIntroStep = stepIndex;
  renderIntroStep();
}

// Auto-initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  initIntroModal();
});

// Global Bindings
window.openIntroModal = openIntroModal;
window.closeIntroModal = closeIntroModal;
window.nextIntroStep = nextIntroStep;
window.prevIntroStep = prevIntroStep;
window.jumpToIntroStep = jumpToIntroStep;