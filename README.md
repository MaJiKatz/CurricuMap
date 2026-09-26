# CurriMap 

**CurriMap** is an interactive, browser-based visual curriculum planning and dependency mapping tool. Designed for educators, course coordinators, and academic advisors, it allows you to visualize degree pathways, map prerequisite connections, manage course topics, and export publication-ready syllabus documents—all in a responsive, drag-and-drop workspace.

---

## 🚀 Features

* **Visual Canvas:** Organizes courses across academic years with native support for Year 0 (Pre-University).
* **Drag-and-Drop:** Free-form card positioning with canvas auto-sizing and persistent position caching.
* **Dynamic Connections:** Interactive SVG rendering to link prerequisite courses, modules, and topics with custom connection levels (Strong, Related, Weak).
* **Course CRUD Editor:** Built-in modal to add, edit, or delete courses, modules, learning objectives, and textbook details.
* **Topic Drawer:** Slide-out inspection drawer for detailed module and objective breakdowns.
* **RTF Document & Syllabus Exporter:** Generate formatted `.rtf` course outlines for individual courses or complete program curriculum packages. Includes:
  * Automatic aggregate workload stats (lecture hours, lab hours, contact hours).
  * Per-topic lecture scheduling & calendar calculation.
  * Hierarchical allocation of marks and assessment scopes with smart resolution for compound IDs (e.g., `Chem 1050-m4`).
* **Time-based scheduling:** Topics are measured in lecture hours and may be fractional (1.5, 0.5). Each course has its own teaching weeks and weekly class pattern (3×50 min, 2×75 min, a 3 h block, or a custom mix such as 1 h + 2 h). Topics flow continuously across classes, so a 1.5 h topic fills one class and half the next.
* **Time budget & overflow flags:** The editor shows required vs. available class time live, badges every topic with its week(s), and marks anything that runs past the end of term in red — on the board, in the calendar, and in the exported outline. Modules can be marked *time permitting* so they fill leftover time without counting as over.
* **Outline & Policies tab:** Instructor details, term/version page header, prerequisites, per-category assessment descriptions, "Scheduled" text overrides (e.g. "October 21"), lab info, and per-course policy overrides. Blank fields fall back to the defaults in ⚙️ Settings.
* **Autosave:** The board is saved to this browser automatically and restored on reload. Use Save Workspace to keep a file.
* **Local & File Storage:** Export curriculum data to JSON or save/restore state locally.
  * **Selective Import:** Loading a JSON file when courses are already on the board prompts a choice — replace the entire workspace, or pick specific course(s) from the file to merge in. Merged courses overwrite any existing course with a matching ID; connections are only merged in when both endpoints belong to the imported course(s), so nothing dangles.

---

## 🏁 Quick Start

Because CurriMap is built using standard ES modules, it runs natively in any modern browser without heavy build steps or package managers.

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/currimap.git](https://github.com/your-username/currimap.git)
   cd currimap
   ```

2. **Run locally:**  
   Serve the root folder using any local HTTP server (required for ES Module support).
   
   *Using Python 3:*
   ```bash
   python3 -m http.server 8000
   ```
   
   *Using Node / npx:*
   ```bash
   npx serve .
   ```

3. **Open in browser:**  
   Navigate to `http://localhost:8000`.

---

## 📁 Project Structure

```plaintext
index.html          # Main application entry point
css/
   style.css       # Core styles & dark theme modal CSS
js/
   scheduler.js    # The single scheduler used by the calendar, editor, board and RTF export
   calendarView.js # Week-by-week term calendar
   settings.js     # Global outline defaults (instructor, term, policies)
   main.js         # Core initialization, autosave & event orchestration
   render.js       # Board, card, and drawer DOM rendering
   courseEditor.js # Modal editor logic & data mutation
   exportRtf.js    # RTF syllabus engine & curriculum summary generator
   storage.js      # JSON import/export & LocalStorage helpers
data/
   curriculum.json # Default curriculum dataset / fallback template
```

---

## 📊 Data Format

CurriMap uses a standard JSON schema to represent courses, modules, and prerequisite links:

```json
{
  "legend": {
    "strong": { "label": "Strong Connection", "color": "#ef4444" },
    "related": { "label": "Related Topic", "color": "#3b82f6" },
    "weak": { "label": "Weak Connection", "color": "#10b981" }
  },
  "courses": [
    {
      "id": "chem1010",
      "code": "CHEM 1010",
      "name": "Pre-University Chemistry",
      "year": 0,
      "yearLabel": "Pre-University",
      "labHours": 36,
      "modules": [
        {
          "id": "m1",
          "title": "Atomic Structure & Bonding",
          "lectureCount": 6,
          "topics": [
            {
              "title": "Quantum Numbers & Orbitals",
              "lectureCount": 2,
              "description": "Introduction to wave functions and orbital shapes."
            }
          ]
        },
        {
          "id": "exam1",
          "isExam": true,
          "title": "Midterm Examination 1",
          "weightPercent": 20,
          "coveredModuleIds": ["m1"]
        }
      ]
    }
  ],
  "connections": []
}
```
### Fields added in v1.1 (all optional, old files load unchanged)

| Where | Field | Meaning |
|---|---|---|
| course | `schedule` | `{ "weeks": 12, "format": "3x50" \| "2x75" \| "1x180" \| "custom", "pattern": [1, 2] }` |
| course | `term`, `version`, `credits` | Page header and title line of the outline |
| course | `instructor` | `{ name, email, office, officeHours }` |
| course | `prerequisites`, `corequisites`, `software`, `otherResources`, `labInfo`, `additionalInfo` | Outline text |
| course | `gradingSystem`, `missedWorkPolicy`, `aiPolicy`, `academicIntegrity`, `accommodations`, `privacyAtipp` | Per-course policy overrides |
| course | `assessmentNotes` | `{ "Quiz": "Quizzes are based on…" }` — paragraph under each 3.1 category |
| course | `noFinalExam`, `x`, `y` | No final exam; saved card position |
| topic | `lectureCount` | Lecture hours; fractions allowed |
| module | `timePermitting`, `startsFreshClass` | Scheduled after required content; start on a new class |
| assessment | `lectureCount` | Number of whole classes used (in-class only) |
| assessment | `scheduleNote`, `scopeNote` | Override the "Scheduled:" and "Scope:" lines |

🛡️ Data Privacy
CurriMap is designed with a privacy-first architecture. All operations—including workspace editing, graph drawing, calendar rendering, and RTF document generation—happen entirely inside your browser's JavaScript runtime. No course data, personal information, or institutional materials are ever sent to external servers.