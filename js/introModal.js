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
    content: "Designed for academic program heads and faculty to visually design multi-year degree programs, map cross-course prerequisites, track accreditation metrics, and export complete syllabus packages in seconds.",
    badge: "1 of 7"
  },
  {
    title: "1. Adding Courses & Degree Years",
    content: "Get started by clicking <b>+ Add Course</b> or double-clicking an existing course card if you loaded a previous workspace. Define the course code, assign it to an academic year column (e.g., Year 1 Fall), set the semester length (10–16 weeks), and configure weekly lecture schedules (3x50m, 2x90m, or 1x3h).",
    badge: "2 of 7"
  },
  {
    title: "2. Modules, Objectives, Books & Labs",
    content: "Inside the Course Editor's <b>Modules tab</b>, build out the detailed syllabus content: add unit modules, granular learning objectives, required textbook details, laboratory practical hours, and midterm evaluation schemes.",
    badge: "3 of 7"
  },
  {
    title: "3. Interactive Map & Detail Drawer",
    content: "Courses display visually in chronological year columns. Click any topic module card to open the <b>Detail Drawer</b> on the right to inspect its learning objectives, textbook references, and prerequisite connections across the entire degree map.",
    badge: "4 of 7"
  },
  {
    title: "4. Drawing Prerequisites (Connect Mode)",
    content: "Enable <b>🔗 Connect Mode</b> in the top header toolbar, pick a dependency tier (<i>Strong, Related, or Weak</i>), and click two modules across different courses to draw visual pedagogical connection lines across academic years.",
    badge: "5 of 7"
  },
  {
    title: "5. Course Calendar View",
    content: "Click the <b>📅 Calendar icon</b> on any course card to open an auto-generated, week-by-week timetable breaking down every lecture topic, midterm, and lab section across the full semester duration.",
    badge: "6 of 7"
  },
  {
    title: "6. Privacy, Workspaces & RTF Exports",
    content: "🔒 <b>100% Private & Local:</b> Nothing is stored or transmitted to a external server—your data remains entirely in your browser. Use <b>⬇️ Save Workspace</b> to download a <code>.json</code> file to share with colleagues or reload later. Set institutional policies in <b>⚙️ Settings</b>, then click <b>📄 Download All Outlines (RTF)</b> to generate an accreditation-ready document bundle.",
    badge: "7 of 7"
  }
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