# CurriMap 

**CurriMap** is an interactive, browser-based visual curriculum planning and dependency mapping tool. Designed for educators, course coordinators, and academic advisors, it allows you to visualize degree pathways, map prerequisite connections, manage course topics, and export publication-ready syllabus documents—all in a responsive, drag-and-drop workspace.

---

## 🚀 Features

* **Visual Canvas:** Organizes courses across academic years with native support for Year 0 (Pre-University).
* **Drag-and-Drop:** Free-form card positioning with canvas auto-sizing and persistent position caching.
* **Dynamic Connections:** Interactive SVG rendering to link prerequisite courses, modules, and topics with custom connection levels (Strong, Related, Weak). Click a line to cycle its strength. Link whole courses with a rose dashed line.
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
| assessment | `durationMode: "hours"`, `durationHours` | Quiz/test that shares a class (e.g. 0.5 h) instead of taking a whole one |

### Fields added in v1.2 (all optional)

| Where | Field | Meaning |
|---|---|---|
| course | `startDate` | `"2026-09-09"` — first day of classes; the calendar and RTF then show real dates |
| course | `classDays` | `["MO","WE","FR"]` — weekdays classes meet (must match classes per week; otherwise sensible defaults) |
| course | `importantDates` | `[{ "date": "2026-10-12", "endDate": "2026-10-16", "label": "Reading week", "skipsClass": true }]` — a skipped day costs one class slot, everything after slides later |
| module | `electiveGroup`, `electiveTaught` | Modules sharing a group name are alternatives; `electiveTaught` marks the ones taught this offering |
| course | `electiveGroups` | `{ "Advanced topics": { "pick": 2, "basis": "professor" \| "time" \| "votes" \| "other" } }` — teach `pick` of the group's modules; the rest drop out of the schedule and hour totals |
| file | `outcomes` | Top level, beside `courses`. A tree: `[{ "id": "po-1", "parent_id": null \| "<id>", "title": "…", "description": "…", "status": "active" \| "archived", "codeOverride": "optional" }]`. Sibling order = array order; codes (1, 1.A, 1.A.1…) are generated from position. Old flat files are upgraded on load |
| file | `programs` | Top level. `[{ "id": "prog-1", "name": "Chemistry Major", "type": "major" \| "honours" \| "minor" \| "specialization" \| "other", "description": "" }]` |
| course | `programs` | `[{ "id": "prog-1", "required": true \| false }]`: which programs include the course, and whether it is required or an elective there. Edited in the course editor (General) or the Outcomes modal (Programs tab) |
| outcome | `programId`, `area` | `programId` null = overall (applies to everyone; children inherit their parent's). `area` = subject-area tag (e.g. "Physical"), also inherited. The matrix can be filtered by program and area. With a program selected it shows required courses, then electives, plus Guaranteed (required only) and Possible (with electives) columns |
| file | `calendar` | Program-wide term calendar: `{ "enabled": true, "startDate": "2027-01-08", "importantDates": [{ "date", "endDate", "label", "skipsClass" }], "extraDays": [{ "date": "2027-01-12", "actsAs": "WE", "label": "" }] }`. `extraDays` are day swaps: that date runs another weekday's schedule |
| course | `dateMode` | `"inherit"` (default): the program calendar, plus this course's own changes: `startDate` replaces the program's first day, `importantDates` and `extraDays` are added, and `skipGlobal` (e.g. `["swap|2027-01-12"]`) switches off individual program entries. `"custom"`: only the course's own dates, ignoring the program calendar. `"off"`: outline without dates. Class days (`classDays`) are always per course. Older files with a `startDate` and no mode count as custom |
| course module | `isSession`, `sessionType`, `speaker` | A non-topic item that uses class time: `sessionType` is `"review"`, `"reflection"`, `"guest"` or `"other"`; `lectureCount` is its hours; `label`, `title`, `description` (notes), `speaker` (guest lectures) and `startsFreshClass` are optional. Not numbered as a module and not connectable in outlines; drawn in green on the map |
| topic | `selfDirected` | `true` = 0 lecture hours (`lectureCount: 0`). No class time is used; it is listed under "Self-directed" in the week the schedule has reached, and marked in the outline |
| topic | `outcomes` | `[{ "id": "po-1", "level": "I" \| "R" \| "A" }]` — Introduced / Reinforced / Advanced (older D/M levels become R/A on load). The matrix is read-only and computed from these tags |
| connection | `from`/`to` = two **course** ids | Whole-course link (`level: "course"`); outlines say "This course builds strongly upon …" |

🛡️ Data Privacy
CurriMap is designed with a privacy-first architecture. All operations—including workspace editing, graph drawing, calendar rendering, and RTF document generation—happen entirely inside your browser's JavaScript runtime. No course data, personal information, or institutional materials are ever sent to external servers.

### Which dates does an export use?
- Card outline button and the **Download this outline** button in the course calendar window: the course's own setting by default; the calendar window's *Dates* switch can instead use the program calendar only, or a generic version without dates.
- **Download All Outlines (RTF)**: the program calendar only. Course-level date changes, independent calendars and "no dates" are ignored there.
