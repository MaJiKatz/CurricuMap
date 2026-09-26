/* ============================================================
   js/settings.js
   Global defaults used by every exported outline unless a course
   overrides them in its Outline tab. Stored in localStorage.
   ============================================================ */

window.DEFAULT_GLOBAL_SETTINGS = {
  // Instructor & term defaults
  instructorName: '',
  instructorEmail: '',
  instructorOffice: '',
  officeHours: 'TBD / By Appointment',
  term: '',
  version: '',

  // Policies
  gradingSystem: 'Numeric Grade System (0-100%, pass mark 50%) in accordance with University Senate regulations.',
  missedWorkPolicy: 'In accordance with University Regulations (Exemptions from Parts of the Evaluation), students unable to complete an evaluation due to acceptable cause must notify the instructor promptly. Where acceptable cause is established, an alternate evaluation or reweighting will be offered.',
  aiPolicy: 'Permissible use of assistive technologies and Generative Artificial Intelligence (e.g., ChatGPT, Claude) in this course will be explicitly stated for each assignment. Unless explicitly permitted by the instructor, the use of generative AI tools to produce coursework, code, or written assignments is unauthorized and constitutes academic misconduct.',
  academicIntegrity: 'Students are expected to adhere strictly to standards of academic honesty. Please refer to the entry on Academic Misconduct in the University Calendar for definitions, procedures, and penalties regarding plagiarism, cheating, and misrepresentation.',
  accommodations: 'The institution is committed to accommodating students with disabilities. Students requiring academic accommodations are encouraged to register with Student Accessibility Services (SAS) and inform the instructor as early as possible in the semester.',
  privacyAtipp: 'Methods used for the notification of grades earned in all parts of the evaluation and for the return of graded evaluative instruments will adhere strictly to the Access to Information and Protection of Privacy Act (ATIPP) of the local Government. Grades will only be posted or communicated via secure, University-approved channels (e.g., Brightspace or official university email).'
};

// Field definitions drive the settings modal (and the per-course override placeholders).
window.SETTINGS_FIELDS = [
  { group: 'Instructor & term (used when a course leaves these blank)' },
  { key: 'instructorName', label: 'Instructor name', type: 'text', half: true },
  { key: 'instructorEmail', label: 'Instructor email', type: 'text', half: true },
  { key: 'instructorOffice', label: 'Office location', type: 'text', half: true },
  { key: 'officeHours', label: 'Consultation hours', type: 'text', half: true },
  { key: 'term', label: 'Term (page header, e.g. Fall 2026)', type: 'text', half: true },
  { key: 'version', label: 'Outline version (page header, e.g. V1.0)', type: 'text', half: true },
  { group: 'Institutional policies' },
  { key: 'gradingSystem', label: 'Section 3.2: Grading system', rows: 2 },
  { key: 'missedWorkPolicy', label: 'Section 3.3: Alternate evaluation & missed work', rows: 3 },
  { key: 'aiPolicy', label: 'Section 6: Assistive tools & generative AI', rows: 3 },
  { key: 'academicIntegrity', label: 'Section 8.1: Academic integrity', rows: 3 },
  { key: 'accommodations', label: 'Section 8.2: Student accommodations', rows: 3 },
  { key: 'privacyAtipp', label: 'Section 8.3: Student privacy & ATIPP', rows: 3 }
];

function getGlobalSettings() {
  const saved = localStorage.getItem('app_global_settings');
  if (!saved) return { ...window.DEFAULT_GLOBAL_SETTINGS };
  try {
    return { ...window.DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) };
  } catch (e) {
    return { ...window.DEFAULT_GLOBAL_SETTINGS };
  }
}

function renderSettingsForm() {
  const host = document.getElementById('settingsFields');
  if (!host) return;
  const current = getGlobalSettings();
  host.innerHTML = window.SETTINGS_FIELDS.map((f) => {
    if (f.group) return `<h3 class="settings-group">${f.group}</h3>`;
    const val = escapeSettingsHtml(current[f.key] || '');
    const control = f.type === 'text'
      ? `<input type="text" id="setting-${f.key}" value="${val}">`
      : `<textarea id="setting-${f.key}" rows="${f.rows || 3}">${val}</textarea>`;
    return `<div class="form-group ${f.half ? '' : 'full-width'}"><label for="setting-${f.key}">${f.label}</label>${control}</div>`;
  }).join('');
}

function saveGlobalSettings() {
  const settings = {};
  window.SETTINGS_FIELDS.forEach((f) => {
    if (!f.key) return;
    const el = document.getElementById(`setting-${f.key}`);
    if (el) settings[f.key] = el.value.trim();
  });
  localStorage.setItem('app_global_settings', JSON.stringify(settings));
  closeSettingsModal();
}

function openSettingsModal() {
  renderSettingsForm();
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function escapeSettingsHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.getGlobalSettings = getGlobalSettings;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveGlobalSettings = saveGlobalSettings;
