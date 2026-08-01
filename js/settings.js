/* ============================================================
   Global Application Settings Management
   ============================================================ */

// Default Fallbacks (MUN Compliant)
window.DEFAULT_GLOBAL_SETTINGS = {
  gradingSystem: "Numeric Grade System (0-100%, pass mark 50%) in accordance with University Senate regulations.",
  missedWorkPolicy: "In accordance with University Regulations (Exemptions from Parts of the Evaluation), students unable to complete an evaluation due to acceptable cause must notify the instructor promptly. Where acceptable cause is established, an alternate evaluation or reweighting will be offered.",
  academicIntegrity: "Students are expected to adhere strictly to Memorial University of Newfoundland's standards of academic honesty. Please refer to the entry on Academic Misconduct in the University Calendar for definitions, procedures, and penalties regarding plagiarism, cheating, and misrepresentation.",
  accommodations: "Memorial University of Newfoundland is committed to accommodating students with disabilities. Students requiring academic accommodations are encouraged to register with Student Accessibility Services (SAS) and inform the instructor as early as possible in the semester.",
  privacyAtipp: "Methods used for the notification of grades earned in all parts of the evaluation and for the return of graded evaluative instruments will adhere strictly to the Access to Information and Protection of Privacy Act (ATIPP) of the Government of Newfoundland and Labrador. Grades will only be posted or communicated via secure, University-approved channels (e.g., Brightspace or official university email)."
};

// Fetch current active settings (localStorage -> Fallbacks)
function getGlobalSettings() {
  const saved = localStorage.getItem('app_global_settings');
  if (!saved) return { ...window.DEFAULT_GLOBAL_SETTINGS };
  try {
    return { ...window.DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) };
  } catch (e) {
    return { ...window.DEFAULT_GLOBAL_SETTINGS };
  }
}

// Save settings from UI
function saveGlobalSettings() {
  const settings = {
    gradingSystem: document.getElementById('setting-gradingSystem').value.trim(),
    missedWorkPolicy: document.getElementById('setting-missedWorkPolicy').value.trim(),
    academicIntegrity: document.getElementById('setting-academicIntegrity').value.trim(),
    accommodations: document.getElementById('setting-accommodations').value.trim(),
    privacyAtipp: document.getElementById('setting-privacyAtipp').value.trim()
  };

  localStorage.setItem('app_global_settings', JSON.stringify(settings));
  closeSettingsModal();
}

// Modal open/close UI logic
function openSettingsModal() {
  const current = getGlobalSettings();
  document.getElementById('setting-gradingSystem').value = current.gradingSystem;
  document.getElementById('setting-missedWorkPolicy').value = current.missedWorkPolicy;
  document.getElementById('setting-academicIntegrity').value = current.academicIntegrity;
  document.getElementById('setting-accommodations').value = current.accommodations;
  document.getElementById('setting-privacyAtipp').value = current.privacyAtipp;

  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

window.getGlobalSettings = getGlobalSettings;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveGlobalSettings = saveGlobalSettings;