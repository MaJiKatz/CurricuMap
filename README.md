# Curriculum Map

A cross-year concept map for the chemistry program: courses → modules → topics,
with connections between modules across any number of years, color- and
line-style-coded by how strong the dependency is.

Open `index.html` directly in a browser, or serve the folder locally:

```
python3 -m http.server 8000
```

(It needs to be served, not opened via `file://`, because the JS fetches the
JSON data files.)

Here is a breakdown of what you can add to your `README.md` to document the new dynamic schedule configuration feature.

You can append this section under **Features** or **The data model** (or add it near the bottom of your README file):

---

```markdown
## Dynamic Schedule & Calendar Configuration (added July 2026)

Courses can now be configured with flexible semester durations and weekly meeting formats. This updates the course capacity and calendar grid views dynamically without forcing fixed 36-lecture assumptions.

### Configurable Settings
- **Semester Duration**: Supports 10, 12, 14, 15, or 16-week terms.
- **Weekly Format Modes**:
  - **3x/week** (50 mins per lecture — e.g., MWF style)
  - **2x/week** (~90 mins per lecture — e.g., TTh style)
  - **1x/week** (3-hour block / seminar style)

### Data Structure & Usage
A default configuration is initialized globally in `js/main.js` and managed per course:

```javascript
const defaultScheduleConfig = {
  weeksInSemester: 12,
  meetingsPerWeek: 3,
  minutesPerMeeting: 50,
  startWeekDay: 'Monday'
};

```

* **Course Editor Modal (`index.html`)**: Features dropdown controls under the *General Info* tab to select semester duration and weekly layout.
* **Calendar Layout Engine (`js/calendarView.js`)**: `calculateCalendarLayout()` dynamically calculates total lecture slots ($\text{Weeks} \times \text{Meetings/Week}$) and formats the calendar grid depending on the selected mode.

```

---

### How it's organized

If you want to keep your project structure file tree in the README up to date, you can also update the `js/` section in the file structure diagram like this:

```markdown
curriculum-map/
  ...
  js/
    data-loader.js     fetches & indexes the JSON
    exportRtf.js.      creates course outlines in RTF format
    render.js          pure DOM-building functions
    connections.js     SVG line drawing
    courseEditor.js    modal logic for editing course properties & schedule settings
    calendarView.js    dynamic calendar grid calculation & rendering logic
    main.js            state + event wiring & global schedule defaults
  ...

```

## The data model

**curriculum.json** — one entry per course, each with a flat list of modules,
each with a flat list of topics:

```json
{
  "id": "chem1051-m5",
  "label": "Module 5",
  "title": "Acids and Bases",
  "topics": [
    { "id": "chem1051-m5-t1", "title": "...", "objectives": ["..."] }
  ]
}
```

`year` on the course controls which column it appears in (0 = pre-university,
1/2/3 = year). `objectives` is an array so a topic can eventually carry more
than one learning objective — right now most topics have a single
placeholder objective auto-generated from the topic title. Treat those as a
first draft, not final wording.

**connections.json** — a flat list of edges between module ids, plus the
`legend` object that defines the three tiers in one place:

```json
{
  "id": "c15",
  "from": "chem1051-m4",
  "to": "chem2301-m5",
  "level": "strong",
  "note": "Why this connection matters, shown in the side panel."
}
```

`level` is one of `strong` / `related` / `weak`. The names, descriptions, and
line styles all come from `legend` — rename or re-describe a tier in one
place and it updates the toggle buttons, the footer legend, and the badges
in the side panel automatically.

### Why three tiers, named this way

Connections are drawn using real bond-strength language, since that's
already the vocabulary this map's audience thinks in:

| Tier | Analogy | Meaning | Line |
|---|---|---|---|
| **Strong Connection** | Covalent | Direct prerequisite — real fluency assumed | thick double stroke |
| **Related Topic** | Ionic | Meaningful overlap, not a hard dependency | single solid stroke |
| **Weak Interaction** | van der Waals | Helpful background, low urgency | solid stroke |

If "Weak Interaction" doesn't stick, other options in the same spirit:
"Background Context," "Peripheral Overlap," "Enrichment Only." It's a
one-line edit in `connections.json`'s `legend` block.

## Extending it

- **Add a course**: append a course object to `curriculum.json` with a
  unique `id`, the right `year`, and its modules/topics. No other file needs
  to change — the board renders whatever `year` values it finds and groups
  them into columns automatically.
- **Add topic-level connections** (not just module-level): connections just
  reference ids — if you give a topic its own connection entry pointing at
  `chem1051-m5-t2` instead of `chem1051-m5`, it'll work as long as you also
  add a matching `data-module-id`-style anchor for topics in the DOM (right
  now only modules are drawn as nodes; topics only show up in the side
  panel). That's the natural next step if you want topic-level lines later.
- **Change what counts as "connected"**: the tier toggles in the header
  filter which connections are drawn/counted at all, so you can hide the
  "weak" tier entirely while planning a syllabus, for instance.
- **Fill in real learning objectives**: `objectives` is already an array per
  topic — swap the placeholder for the actual outcomes as you write them.


## Interaction model

- Click a module to open its topics + connections in the right-hand panel.
- Click a linked module inside that panel to jump straight to it.
- "All connections" mode draws every visible link at once (dimming
  unrelated ones once you've selected a module); "Focus on selection" mode
  only draws lines touching the selected module and dims everything else.
- The tier checkboxes in the header show/hide each bond tier independently.
- Click to drag a module within a course or to another course. (added July 24)

## Dynamic Schedule & Calendar Configuration (added July 2026)

Courses can now be configured with flexible semester durations and weekly meeting formats. This updates the course capacity and calendar grid views dynamically without forcing fixed 36-lecture assumptions.

### Configurable Settings
- **Semester Duration**: Supports 10, 12, 14, 15, or 16-week terms.
- **Weekly Format Modes**:
  - **3x/week** (50 mins per lecture — e.g., MWF style)
  - **2x/week** (~90 mins per lecture — e.g., TTh style)
  - **1x/week** (3-hour block / seminar style)

### Data Structure & Usage
A default configuration is initialized globally in `js/main.js` and managed per course:

```javascript
const defaultScheduleConfig = {
  weeksInSemester: 12,
  meetingsPerWeek: 3,
  minutesPerMeeting: 50,
  startWeekDay: 'Monday'
};

## Exporting Course Outlines (RTF Format)

Courses can be exported directly to Rich Text Format (`.rtf`), which can be opened natively in Microsoft Word, Google Docs, or Apple Pages for faculty customization.

### Included Outline Sections
1. **Header (Centered)**: Course Code, Course Title, and Credit Count.
2. **Textbook & Required Materials**: Formatted listing for Title, Author, ISBN, or place-holders.
3. **Course Schedule / Calendar**: Dynamic weekly breakdown calculated from active term configuration.
4. **Modules & Learning Objectives**:
   - Chapter reading assignments per module.
   - Bulleted learning objectives and topics.
   - **Curriculum Connections**: Sub-sections indicating prerequisite or forward-facing modules across other courses (including direction and contextual connection notes).