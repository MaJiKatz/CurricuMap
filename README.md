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

## How it's organized

```
curriculum-map/
  index.html
  css/style.css
  js/
    data-loader.js   fetches & indexes the JSON
    render.js        pure DOM-building functions
    connections.js   SVG line drawing
    main.js          state + event wiring
  data/
    curriculum.json    courses -> modules -> topics -> objectives
    connections.json   the cross-year links + the tier legend
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
| **Weak Interaction** | van der Waals | Helpful background, low urgency | dotted |

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
- Click to drag a module within a course or to another course.
