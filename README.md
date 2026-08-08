# CurriMap 🎓

**CurriMap** is an interactive, privacy-first, browser-based visual curriculum planning and dependency mapping tool. Designed for academic program heads, department chairs, and educators, it allows you to visualize degree pathways, map prerequisite connections, track accreditation metrics, and export complete, policy-compliant course syllabus packages—all in a zero-backend, browser-native workspace.

Use it here https://majikatz.github.io/CurricuMap/

---

## ✨ Features

* 🗺️ **Visual Canvas & Degree Mapping:** Organizes courses across chronological academic year columns with native support for pre-university years (Year 0) through upper years.
* 🔗 **Dynamic Dependencies (Connect Mode):** Interactive SVG rendering to visually link prerequisite courses, modules, and granular learning objectives with customizable connection strengths (*Strong, Related, Weak*).
* 📝 **Comprehensive Course & Schedule Editor:** Built-in modal to manage course codes, names, semester lengths, weekly lecture formats, and dynamic cascading dropdowns to link prerequisites across courses and modules.
 🧪 **Labs, Midterms & Modules:** Dedicated tabbed editor to schedule unit modules, granular per-topic lecture hours, nested learning objectives, textbook practice questions, midterm evaluations, and laboratory practical hours.
* 📅 **Course Calendar Matrix View:** Auto-generated, week-by-week timetable breaking down every individual lecture topic, exam, and lab session across the semester duration.
* 📄 **Accreditation-Ready RTF Syllabus Export:** Instantly generate formatted Word/RTF course outlines incorporating per-topic schedule breakdowns, total contact hours, and accreditation metrics.
* ⚙️ **Global Institutional Policy Defaults:** Configure department-wide grading schemes, missed work policies, and academic integrity/accommodation statements once in global settings to auto-populate all exported syllabi.
* ❓ **Interactive Onboarding Guide:** Integrated step-by-step modal guide walking new users through features, connection drawing, scheduling, and exports.
* 🔒 **100% Private & Local Storage:** No server required and zero data collected. Everything runs locally in your browser. Save and load complete degree map states anytime using `.json` workspace files.
* 🔍 **Slide-Out Detail Drawer:** Inspect module details, learning objectives, textbook references, and cross-course prerequisite links instantly.

---

## 🚀 Quick Start

Because CurriMap is built using standard ES modules, it runs natively in any modern browser without heavy build steps, npm dependencies, or package managers.

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/currimap.git](https://github.com/your-username/currimap.git)
   cd currimap
Run locally:
Serve the root folder using any local HTTP server (required for ES Module support).
Using Python 3:
Bash
python3 -m http.server 8000
Using Node / npx:
Bash
npx serve .
Open in browser:
Navigate to http://localhost:8000.
📂 Project Structure
Plaintext
currimap/
├── index.html          # Main application interface & modal containers
├── css/
│   └── style.css       # Core design system, layout, and dark-theme overlay styles
├── js/
│   ├── main.js         # Core initialization & event orchestration
│   ├── render.js       # Board, card, drawer, and legend DOM rendering
│   ├── courseEditor.js # Course, module, topic, lab, exam, and cascading connection editor
│   ├── connections.js  # SVG line calculation & interactive Connect Mode
│   ├── calendarView.js # Per-topic week-by-week timetable matrix renderer
│   ├── settings.js     # Institutional & department policy default state
│   ├── exportRtf.js    # Per-topic RTF syllabus generation & accreditation summary compiler
│   ├── introModal.js   # Interactive onboarding guide & step-by-step tour
│   └── data-loader.js  # Workspace save/load (JSON) & LocalStorage management
└── data/
    └── curriculum.json # Default curriculum dataset & fallback schema
📊 Data Format
CurriMap uses a clean, human-readable JSON schema to represent courses, schedule parameters, modules, labs, exams, and prerequisite links:

JSON
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
      "name": "Introductory Chemistry I",
      "year": 1,
      "yearLabel": "Year 1 (Fall)",
      "textbook": {
        "title": "Chemistry: The Central Science",
        "author": "Brown et al.",
        "edition": "14th"
      },
      "modules": [
        {
          "id": "chem1010-m1",
          "label": "MOD 01",
          "title": "Chemical Bonding & Structure",
          "lectureCount": 3,
          "isExam": false,
          "isLab": false,
          "topics": [
            {
              "title": "Lewis Structures & VSEPR",
              "description": "Introduction to resonance, formal charge, and molecular geometry.",
              "lectureCount": 2,
              "learningObjectives": [
                "Draw valid Lewis structures for polyatomic ions",
                "Predict molecular geometry using VSEPR theory"
              ],
              "textbookQuestions": ["Ch. 8 #12", "Ch. 8 #15-20"]
            }
          ]
        },
        {
          "id": "chem1010-midterm-1",
          "label": "MIDTERM",
          "title": "Midterm Examination 1",
          "isExam": true,
          "weightPercent": 20,
          "coveredModuleIds": ["chem1010-m1"]
        },
        {
          "id": "chem1010-labs",
          "label": "LABS",
          "title": "Laboratory Component",
          "isLab": true,
          "weightPercent": 20,
          "labs": [
            { "title": "Lab 1: Acid-Base Titration", "hours": 3, "weightPercent": 5 }
          ]
        }
      ]
    }
  ],
  "connections": [
    {
      "id": "c1001",
      "from": "chem1010-m1",
      "to": "chem2210-m4",
      "level": "strong",
      "note": "Required foundational geometry concept"
    }
  ]
}

🛡️ Data Privacy
CurriMap is designed with a privacy-first architecture. All operations—including workspace editing, graph drawing, calendar rendering, and RTF document generation—happen entirely inside your browser's JavaScript runtime. No course data, personal information, or institutional materials are ever sent to external servers.