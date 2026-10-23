/* ============================================================
   js/outcomes.js
   Program-level learning outcomes: a hierarchy (any depth), tagged
   from the topics inside each course, shown in a read-only matrix.

   DATA.outcomes = [{ id, parent_id|null, title, description,
                      status:'active'|'archived', codeOverride? }]
   Sibling order = order in the array. Codes are generated from
   position (1, 1.A, 1.A.1 ...) unless codeOverride is set.

   Optional per outcome: area (subject area, e.g. "Physical chemistry"),
   programId (null = overall outcome that applies to every program;
   otherwise specific to one program / speciality).

   DATA.programs = [{ id, name, type, description }]
   A course's membership lives ON THE COURSE: course.programs =
   [{ id: <program id>, required: true|false }]
   (a student in the program is only guaranteed the required courses).

   Topic tags (set in the course editor):
     topic.outcomes = [{ id: <outcome id>, level: 'I'|'R'|'A' }]
   ============================================================ */

(function () {
  const LEVELS = {
    I: { label: 'Introduced', rank: 1, color: '#fde68a', ink: '#78350f' },
    R: { label: 'Reinforced', rank: 2, color: '#86efac', ink: '#14532d' },
    A: { label: 'Advanced', rank: 3, color: '#93c5fd', ink: '#1e3a8a' },
  };
  const PROGRAM_TYPES = { major: 'Major', honours: 'Honours', minor: 'Minor', specialization: 'Speciality / stream', other: 'Other' };
  const LEGACY_LEVEL = { D: 'R', M: 'A' }; // earlier build used Introduced / Developed / Mastered
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const save = () => { if (typeof window.scheduleAutosave === 'function') window.scheduleAutosave(); };

  // ---------------- data + tree helpers ----------------
  function getOutcomes() {
    const d = window.DATA;
    if (!d) return [];
    if (!Array.isArray(d.outcomes)) d.outcomes = [];
    return d.outcomes;
  }

  /** Idempotent upgrade of older files: flat outcomes -> tree fields, D/M -> R/A. */
  function normalize(data) {
    const d = data || window.DATA;
    if (!d) return;
    if (!Array.isArray(d.outcomes)) d.outcomes = [];
    if (!Array.isArray(d.programs)) d.programs = [];
    d.programs.forEach((p) => { if (!p.type) p.type = 'major'; if (p.description === undefined) p.description = ''; });
    d.outcomes.forEach((o) => {
      if (!('programId' in o)) o.programId = null;
      if (o.area === undefined) o.area = '';
      if (!('parent_id' in o)) o.parent_id = null;
      if (!o.status) o.status = 'active';
      if (o.code && !o.codeOverride) o.codeOverride = o.code; // keep codes people typed
      delete o.code;
      if (o.description === undefined) o.description = '';
    });
    (d.courses || []).forEach((c) => (c.modules || []).forEach((m) => (m.topics || []).forEach((t) => {
      if (t && Array.isArray(t.outcomes)) t.outcomes.forEach((tag) => { if (LEGACY_LEVEL[tag.level]) tag.level = LEGACY_LEVEL[tag.level]; });
    })));
  }

  function getPrograms() {
    const d = window.DATA;
    if (!d) return [];
    if (!Array.isArray(d.programs)) d.programs = [];
    return d.programs;
  }

  function membership(course, programId) {
    return (course.programs || []).find((x) => x.id === programId) || null;
  }

  function setMembership(course, programId, mode) { // mode: '' | 'required' | 'elective'
    course.programs = (course.programs || []).filter((x) => x.id !== programId);
    if (mode) course.programs.push({ id: programId, required: mode === 'required' });
    if (!course.programs.length) delete course.programs;
  }

  function programCourses(programId) {
    return sortedCourses(((window.DATA && window.DATA.courses) || []).filter((c) => membership(c, programId)))
      .map((c) => ({ course: c, required: !!membership(c, programId).required }));
  }

  /** Program an outcome belongs to: its own, else the nearest ancestor's (null = overall). */
  function effProgram(outcomes, o) {
    let cur = o;
    for (let i = 0; cur && i < 50; i++) {
      if (cur.programId) return cur.programId;
      cur = outcomes.find((x) => x.id === cur.parent_id);
    }
    return null;
  }

  function effArea(outcomes, o) {
    let cur = o;
    for (let i = 0; cur && i < 50; i++) {
      if (cur.area) return cur.area;
      cur = outcomes.find((x) => x.id === cur.parent_id);
    }
    return '';
  }

  function areas(outcomes) {
    return [...new Set(outcomes.map((o) => (o.area || '').trim()).filter(Boolean))].sort();
  }

  function kids(outcomes, parentId) {
    return outcomes.filter((o) => (o.parent_id || null) === (parentId || null));
  }

  function descendantIds(outcomes, id) {
    const out = [];
    kids(outcomes, id).forEach((k) => { out.push(k.id, ...descendantIds(outcomes, k.id)); });
    return out;
  }

  function letters(n) { // 0 -> A
    let s = '';
    n += 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  /**
   * Depth-first rows with computed codes. Codes use position among ALL siblings
   * (archived ones included) so archiving never renumbers anything.
   */
  function flatten(outcomes, opts) {
    const showArchived = !!(opts && opts.showArchived);
    const rows = [];
    (function walk(parentId, depth, prefix) {
      kids(outcomes, parentId).forEach((o, i) => {
        const auto = depth % 2 === 0 ? String(i + 1) : letters(i);
        const code = o.codeOverride || (prefix ? `${prefix}.${auto}` : auto);
        const archived = o.status === 'archived';
        const hasKids = kids(outcomes, o.id).length > 0;
        if (!archived || showArchived) rows.push({ o, depth, code, hasKids, archived });
        if (!archived || showArchived) walk(o.id, depth + 1, code);
      });
    })(null, 0, '');
    return rows;
  }

  function codeMap(outcomes) {
    const m = {};
    flatten(outcomes, { showArchived: true }).forEach((r) => { m[r.o.id] = r.code; });
    return m;
  }

  function maxLevel(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return LEVELS[b].rank > LEVELS[a].rank ? b : a;
  }

  function sortedCourses(courses) {
    return (courses || []).slice().sort((x, y) =>
      (Number(x.year) || 0) - (Number(y.year) || 0) || String(x.code).localeCompare(String(y.code), undefined, { numeric: true }));
  }

  /**
   * Read-only matrix built from the course topics.
   * cell(outcomeId, courseId) = { level, derived, direct, entries[] }:
   *   direct  = highest level tagged on this outcome itself in that course
   *   derived = true when the shown level only comes from descendants (roll-up)
   */
  function buildMatrix(courses, outcomes, opts) {
    const showArchived = !!(opts && opts.showArchived);
    const programId = (opts && opts.programId) || null;
    const area = (opts && opts.area) || '';
    let cs = sortedCourses(courses);
    const requiredIds = new Set();
    if (programId) {
      const pc = programCourses(programId);
      pc.forEach((x) => { if (x.required) requiredIds.add(x.course.id); });
      cs = [...pc.filter((x) => x.required), ...pc.filter((x) => !x.required)].map((x) => x.course);
    }
    let rows = flatten(outcomes, { showArchived });
    if (programId) {
      rows = rows.filter((r) => { const ep = effProgram(outcomes, r.o); return !ep || ep === programId; });
    }
    if (area) {
      const keep = new Set();
      outcomes.forEach((o) => {
        if (effArea(outcomes, o) !== area) return;
        let cur = o;
        for (let i = 0; cur && i < 50; i++) { keep.add(cur.id); cur = outcomes.find((x) => x.id === cur.parent_id); }
      });
      rows = rows.filter((r) => keep.has(r.o.id));
    }
    const direct = {}; // outcomeId -> courseId -> { level, entries[] }
    cs.forEach((course) => {
      (course.modules || []).forEach((mod) => {
        if (mod.isExam || mod.isLab) return;
        (mod.topics || []).forEach((topic) => {
          if (!topic || typeof topic !== 'object') return;
          (topic.outcomes || []).forEach((tag) => {
            if (!LEVELS[tag.level]) return;
            const byCourse = direct[tag.id] || (direct[tag.id] = {});
            const cell = byCourse[course.id] || (byCourse[course.id] = { level: null, entries: [] });
            cell.level = maxLevel(cell.level, tag.level);
            cell.entries.push({ outcomeId: tag.id, moduleLabel: mod.label || '', moduleTitle: mod.title || '', topicTitle: topic.title || '', level: tag.level });
          });
        });
      });
    });

    const cells = {};
    const idsNeeded = outcomes.map((o) => o.id);
    idsNeeded.forEach((id) => {
      cells[id] = {};
      const family = [id, ...descendantIds(outcomes, id)];
      cs.forEach((course) => {
        let level = null;
        let own = null;
        const entries = [];
        family.forEach((fid) => {
          const c = direct[fid] && direct[fid][course.id];
          if (!c) return;
          level = maxLevel(level, c.level);
          if (fid === id) own = c.level;
          entries.push(...c.entries);
        });
        if (level) cells[id][course.id] = { level, direct: own, derived: !own, entries };
      });
    });

    const coverage = {};
    rows.forEach((r) => {
      const cv = { courses: 0, max: null, guaranteed: null, possible: null };
      cs.forEach((c) => {
        const cell = cells[r.o.id][c.id];
        if (!cell) return;
        cv.courses++;
        cv.max = maxLevel(cv.max, cell.level);
        cv.possible = maxLevel(cv.possible, cell.level);
        if (!programId || requiredIds.has(c.id)) cv.guaranteed = maxLevel(cv.guaranteed, cell.level);
      });
      coverage[r.o.id] = cv;
    });
    return { courses: cs, rows, cells, coverage, programId, requiredIds };
  }

  function pruneTags(outcomeId) {
    ((window.DATA && window.DATA.courses) || []).forEach((course) => {
      (course.modules || []).forEach((mod) => (mod.topics || []).forEach((t) => {
        if (t && Array.isArray(t.outcomes)) {
          t.outcomes = t.outcomes.filter((x) => x.id !== outcomeId);
          if (!t.outcomes.length) delete t.outcomes;
        }
      }));
    });
  }

  function tagCount(outcomeId) {
    let n = 0;
    ((window.DATA && window.DATA.courses) || []).forEach((c) => (c.modules || []).forEach((m) => (m.topics || []).forEach((t) => {
      if (t && Array.isArray(t.outcomes) && t.outcomes.some((x) => x.id === outcomeId)) n++;
    })));
    return n;
  }

  /** Options for pickers in the course editor: active outcomes, indented, with codes. */
  function pickerOptions() {
    return flatten(getOutcomes(), { showArchived: false }).map((r) => ({
      id: r.o.id, depth: r.depth, code: r.code, title: r.o.title || '',
      label: `${'  '.repeat(r.depth)}${r.code} – ${(r.o.title || '').slice(0, 44)}`,
    }));
  }

  // ---------------- structure editing ----------------
  function move(id, dir) { // dir -1 up, +1 down among siblings
    const list = getOutcomes();
    const o = list.find((x) => x.id === id);
    if (!o) return;
    const sibs = kids(list, o.parent_id);
    const i = sibs.indexOf(o);
    const other = sibs[i + dir];
    if (!other) return;
    const a = list.indexOf(o); const b = list.indexOf(other);
    [list[a], list[b]] = [list[b], list[a]];
    save(); render();
  }
  function reparent(id, newParentId) {
    const list = getOutcomes();
    const o = list.find((x) => x.id === id);
    if (!o) return;
    newParentId = newParentId || null;
    if (newParentId === id || descendantIds(list, id).includes(newParentId)) return;
    o.parent_id = newParentId;
    list.splice(list.indexOf(o), 1);
    list.push(o);
    save(); render();
  }
  function indent(id) {
    const list = getOutcomes();
    const o = list.find((x) => x.id === id);
    if (!o) return;
    const sibs = kids(list, o.parent_id).filter((s) => s.status !== 'archived' || s === o);
    const prev = sibs[sibs.indexOf(o) - 1];
    if (prev) reparent(id, prev.id);
  }
  function outdent(id) {
    const list = getOutcomes();
    const o = list.find((x) => x.id === id);
    const parent = o && list.find((x) => x.id === o.parent_id);
    if (!parent) return;
    o.parent_id = parent.parent_id || null;
    list.splice(list.indexOf(o), 1);
    list.splice(list.indexOf(parent) + 1, 0, o);
    save(); render();
  }
  function add(parentId) {
    const list = getOutcomes();
    const o = { id: `po-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, parent_id: parentId || null, title: '', description: '', status: 'active' };
    list.push(o);
    if (parentId) collapsed.delete(parentId);
    save(); render();
    const titles = document.querySelectorAll('#outcomes-modal .po-title');
    const target = [...titles].find((el) => el.dataset.id === o.id);
    if (target) target.focus();
  }
  function archive(id) {
    const list = getOutcomes();
    const o = list.find((x) => x.id === id);
    if (!o) return;
    const ids = [id, ...descendantIds(list, id)];
    if (ids.length > 1 && !confirm(`Archive this outcome and its ${ids.length - 1} sub-outcome(s)? Archived outcomes keep their tags and can be restored.`)) return;
    list.forEach((x) => { if (ids.includes(x.id)) x.status = 'archived'; });
    save(); render();
  }
  function restore(id) {
    const list = getOutcomes();
    let cur = list.find((x) => x.id === id);
    while (cur) { cur.status = 'active'; cur = list.find((x) => x.id === cur.parent_id); }
    save(); render();
  }
  function remove(id) {
    const list = getOutcomes();
    const o = list.find((x) => x.id === id);
    if (!o) return;
    if (kids(list, id).length || tagCount(id)) {
      alert('This outcome has sub-outcomes or is tagged on topics, so it can’t be deleted. Archive it instead.');
      return;
    }
    list.splice(list.indexOf(o), 1);
    save(); render();
  }

  // ---------------- modal ----------------
  let tab = 'matrix';
  let detail = null;
  let showArchived = false;
  let selProgram = '';
  let selArea = '';
  const collapsed = new Set();

  function ensureModal() {
    let modal = document.getElementById('outcomes-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'outcomes-modal';
      modal.className = 'modal-overlay hidden';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }
    return modal;
  }

  function legendHtml() {
    return Object.entries(LEVELS).map(([k, v]) =>
      `<span class="po-legend"><span class="po-swatch" style="background:${v.color};color:${v.ink}">${k}</span>${v.label}</span>`).join('') +
      '<span class="po-legend"><span class="po-swatch po-derived" style="background:#e5e7eb;color:#374151">i</span>rolled up from sub-outcomes</span>';
  }

  function visibleRows(rows) {
    // hide rows whose ancestor is collapsed
    const hidden = new Set();
    return rows.filter((r) => {
      if (r.o.parent_id && (collapsed.has(r.o.parent_id) || hidden.has(r.o.parent_id))) { hidden.add(r.o.id); return false; }
      return true;
    });
  }

  function matrixHtml() {
    const outcomes = getOutcomes();
    if (!outcomes.length) return '<p class="empty-note">No program outcomes yet. Add them on the "Define outcomes" tab, then tag topics in the course editor.</p>';
    const courses = (window.DATA && window.DATA.courses) || [];
    if (selProgram && !getPrograms().some((p) => p.id === selProgram)) selProgram = '';
    const m = buildMatrix(courses, outcomes, { showArchived, programId: selProgram || null, area: selArea });
    const prog = selProgram ? getPrograms().find((p) => p.id === selProgram) : null;
    const rows = visibleRows(m.rows);

    // year-grouped header
    const groups = [];
    m.courses.forEach((c) => {
      const key = prog ? (m.requiredIds.has(c.id) ? 'req' : 'el') : c.year;
      const label = prog ? (key === 'req' ? 'Required' : 'Electives') : (c.yearLabel || `Year ${c.year}`);
      const g = groups[groups.length - 1];
      if (g && g.year === key) g.n++; else groups.push({ year: key, label, n: 1 });
    });
    const head1 = groups.map((g) => `<th colspan="${g.n}" class="po-yr">${esc(g.label)}</th>`).join('');
    const head2 = m.courses.map((c) => `<th class="po-ch" title="${esc(c.name)}"><span>${esc(c.code)}</span></th>`).join('');
    const footHead = prog
      ? '<th rowspan="2" class="po-ch" title="Highest level reached using required courses only"><span>Guaranteed</span></th><th rowspan="2" class="po-ch" title="Highest level reached if electives are taken"><span>Possible</span></th>'
      : '<th rowspan="2" class="po-ch"><span>Courses</span></th>';
    const pill = (lv) => lv ? `<span class="po-swatch" style="background:${LEVELS[lv].color};color:${LEVELS[lv].ink}">${lv}</span>` : '<span class="po-none">–</span>';

    const body = rows.map((r) => {
      const toggle = r.hasKids
        ? `<button type="button" class="po-toggle" data-toggle="${esc(r.o.id)}" aria-label="Expand or collapse">${collapsed.has(r.o.id) ? '▸' : '▾'}</button>`
        : '<span class="po-toggle-gap"></span>';
      const cells = m.courses.map((c) => {
        const cell = m.cells[r.o.id][c.id];
        if (!cell) return '<td class="po-cell po-empty"></td>';
        const L = LEVELS[cell.level];
        const sel = detail && detail.courseId === c.id && detail.outcomeId === r.o.id ? ' is-selected' : '';
        const tip = `${L.label}${cell.derived ? ' (rolled up from sub-outcomes)' : ''} – ${cell.entries.length} topic tag${cell.entries.length === 1 ? '' : 's'}`;
        return `<td class="po-cell${cell.derived ? ' po-derived' : ''}${sel}" style="background:${L.color};color:${L.ink}" data-course="${esc(c.id)}" data-outcome="${esc(r.o.id)}" title="${esc(tip)}">${cell.derived ? cell.level.toLowerCase() : cell.level}</td>`;
      }).join('');
      const cv = m.coverage[r.o.id];
      const cls = !cv.courses ? 'po-gap' : '';
      return `<tr class="${r.archived ? 'po-archived-row' : ''}">
        <th class="po-label" style="padding-left:${8 + r.depth * 18}px">${toggle}<strong>${esc(r.code)}</strong> ${esc(r.o.title)}${r.archived ? ' <em>(archived)</em>' : ''}</th>
        ${cells}${prog
          ? `<td class="po-foot ${cv.guaranteed ? '' : (cv.possible ? 'po-warn' : 'po-gap')}">${pill(cv.guaranteed)}</td><td class="po-foot ${cv.possible ? '' : 'po-gap'}">${pill(cv.possible)}</td>`
          : `<td class="po-foot ${cls}">${cv.courses || 'none'}</td>`}</tr>`;
    }).join('');

    const active = m.rows.filter((r) => !r.archived);
    const leafGaps = active.filter((r) => !m.coverage[r.o.id].courses);
    const notAdvanced = active.filter((r) => m.coverage[r.o.id].courses && m.coverage[r.o.id].max !== 'A');
    const rank = (l) => (l ? LEVELS[l].rank : 0);
    const electiveOnly = prog ? active.filter((r) => m.coverage[r.o.id].possible && !m.coverage[r.o.id].guaranteed) : [];
    const lowerGuar = prog ? active.filter((r) => m.coverage[r.o.id].guaranteed && rank(m.coverage[r.o.id].possible) > rank(m.coverage[r.o.id].guaranteed)) : [];
    const notes = [
      prog && !m.courses.length ? `<li class="po-warn-note">No courses are assigned to ${esc(prog.name)} yet. Use the Programs tab.</li>` : '',
      electiveOnly.length ? `<li class="po-warn-note"><strong>Only reached through electives in ${esc(prog.name)}:</strong> ${electiveOnly.map((r) => esc(r.code)).join(', ')}</li>` : '',
      lowerGuar.length ? `<li class="po-warn-note"><strong>Higher level only possible with electives:</strong> ${lowerGuar.map((r) => `${esc(r.code)} (${m.coverage[r.o.id].guaranteed}→${m.coverage[r.o.id].possible})`).join(', ')}</li>` : '',
      leafGaps.length ? `<li class="po-gap-note"><strong>Not addressed by any course:</strong> ${leafGaps.map((r) => esc(r.code)).join(', ')}</li>` : '',
      notAdvanced.length ? `<li class="po-warn-note"><strong>Never reaches Advanced:</strong> ${notAdvanced.map((r) => esc(r.code)).join(', ')}</li>` : '',
    ].join('');

    let detailHtml = '';
    if (detail) {
      const cell = m.cells[detail.outcomeId] && m.cells[detail.outcomeId][detail.courseId];
      const course = m.courses.find((c) => c.id === detail.courseId);
      const row = m.rows.find((r) => r.o.id === detail.outcomeId);
      const codes = codeMap(outcomes);
      if (cell && course && row) {
        detailHtml = `<div class="po-detail"><strong>${esc(course.code)} → ${esc(row.code)} ${esc(row.o.title)}</strong>
          <small> &mdash; to change this, edit the topic tags in the course editor.</small><ul>` +
          cell.entries.map((e) => `<li><span class="po-swatch" style="background:${LEVELS[e.level].color};color:${LEVELS[e.level].ink}">${e.level}</span> ${esc(e.moduleLabel)} – ${esc(e.topicTitle)}${e.outcomeId !== detail.outcomeId ? ` <span class="po-via">via ${esc(codes[e.outcomeId] || '')}</span>` : ''}</li>`).join('') + '</ul></div>';
      }
    }

    return `
      <div class="po-legend-row">${legendHtml()}</div>
      <div class="po-toolbar">
        <button type="button" class="btn btn-secondary btn-sm" data-act="expand">Expand all</button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="collapse">Collapse all</button>
        <label class="inline-field">View <select data-sel="program"><option value="">All courses (overall)</option>${getPrograms().map((p) => `<option value="${esc(p.id)}" ${p.id === selProgram ? 'selected' : ''}>${esc(p.name)} (${esc(PROGRAM_TYPES[p.type] || p.type)})</option>`).join('')}</select></label>
        <label class="inline-field">Subject area <select data-sel="area"><option value="">All</option>${areas(outcomes).map((a) => `<option ${a === selArea ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
        <label class="inline-field"><input type="checkbox" data-act="archived" ${showArchived ? 'checked' : ''}> Show archived</label>
        <span class="po-legend-note">Read-only: levels come from the topics tagged in each course. Click a cell to see which.</span>
      </div>
      <div class="po-scroll"><table class="po-table">
        <thead><tr><th class="po-corner" rowspan="2">Outcome</th>${head1}${footHead}</tr><tr>${head2}</tr></thead>
        <tbody>${body}</tbody>
      </table></div>
      ${notes ? `<ul class="po-notes">${notes}</ul>` : ''}
      ${detailHtml}`;
  }

  function programsHtml() {
    const progs = getPrograms();
    const courses = sortedCourses((window.DATA && window.DATA.courses) || []);
    const list = progs.map((p) => `
      <div class="po-prog-row" data-pid="${esc(p.id)}">
        <input type="text" class="pp-name" value="${esc(p.name)}" placeholder="Program name, e.g. Chemistry Major">
        <select class="pp-type">${Object.entries(PROGRAM_TYPES).map(([k, v]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
        <input type="text" class="pp-desc" value="${esc(p.description || '')}" placeholder="Notes (optional)">
        <button type="button" class="btn btn-cancel btn-sm" onclick="Outcomes.removeProgram('${esc(p.id)}')" title="Delete program">&times;</button>
      </div>`).join('');
    const head = progs.map((p) => `<th class="po-ch" data-pid="${esc(p.id)}" title="${esc(p.name)}"><span>${esc((p.name || '').slice(0, 22))}</span></th>`).join('');
    const body = courses.map((c) => `<tr><th class="po-label">${esc(c.code)} <span class="po-via">${esc(c.name)}</span></th>${progs.map((p) => {
      const mem = membership(c, p.id);
      const v = mem ? (mem.required ? 'required' : 'elective') : '';
      return `<td class="po-cell-sel"><select class="pp-mem" data-course="${esc(c.id)}" data-pid="${esc(p.id)}"><option value="">–</option><option value="required" ${v === 'required' ? 'selected' : ''}>Required</option><option value="elective" ${v === 'elective' ? 'selected' : ''}>Elective</option></select></td>`;
    }).join('')}</tr>`).join('');
    return `
      <p class="hint-text">Define each major, honours, minor or speciality once, then say which courses belong to it and whether they are <strong>required</strong> or <strong>elective</strong> there. The matrix then shows what each program guarantees (required courses only) and what is possible if electives are taken. You can also set this per course in the course editor.</p>
      <div class="po-toolbar"><button type="button" class="btn btn-primary btn-sm" onclick="Outcomes.addProgram()">+ Add program</button></div>
      <div class="po-prog-list">${list || '<p class="empty-note">No programs yet. Outcomes without a program apply to everyone.</p>'}</div>
      ${progs.length ? `<div class="po-scroll"><table class="po-table po-mem-table"><thead><tr><th class="po-corner">Course</th>${head}</tr></thead><tbody>${body}</tbody></table></div>` : ''}`;
  }

  function addProgram() {
    getPrograms().push({ id: `prog-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, name: '', type: 'major', description: '' });
    save(); render();
  }
  function removeProgram(id) {
    const ps = getPrograms();
    const p = ps.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`Delete program “${p.name || 'untitled'}”? Course memberships are removed; outcomes tied to it become overall outcomes.`)) return;
    ps.splice(ps.indexOf(p), 1);
    ((window.DATA && window.DATA.courses) || []).forEach((c) => setMembership(c, id, ''));
    getOutcomes().forEach((o) => { if (o.programId === id) o.programId = null; });
    if (selProgram === id) selProgram = '';
    save(); render();
  }

  function defineHtml() {
    const outcomes = getOutcomes();
    const flat = flatten(outcomes, { showArchived });
    const parentOptions = (selfId) => {
      const banned = new Set([selfId, ...descendantIds(outcomes, selfId)]);
      return flatten(outcomes, { showArchived: false }).filter((r) => !banned.has(r.o.id))
        .map((r) => ({ id: r.o.id, label: `${'  '.repeat(r.depth)}${r.code} ${(r.o.title || '').slice(0, 36)}` }));
    };
    const rows = flat.map((r) => {
      const o = r.o;
      const opts = [`<option value="">(top level)</option>`].concat(parentOptions(o.id).map((p) => `<option value="${esc(p.id)}" ${o.parent_id === p.id ? 'selected' : ''}>${p.label}</option>`)).join('');
      const canDelete = !r.hasKids && !tagCount(o.id);
      return `
      <div class="po-edit-row ${r.archived ? 'is-archived' : ''}" data-id="${esc(o.id)}" style="margin-left:${r.depth * 24}px">
        <span class="po-code-label" title="Generated from position">${esc(r.code)}</span>
        <input type="text" class="po-title" data-id="${esc(o.id)}" value="${esc(o.title)}" placeholder="${r.depth === 0 ? 'Program outcome, e.g. Disciplinary knowledge' : 'Sub-outcome'}">
        <span class="po-row-btns">
          <button type="button" class="btn btn-secondary btn-sm" onclick="Outcomes.move('${esc(o.id)}',-1)" title="Move up">↑</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Outcomes.move('${esc(o.id)}',1)" title="Move down">↓</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Outcomes.outdent('${esc(o.id)}')" title="Move out one level" ${o.parent_id ? '' : 'disabled'}>←</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Outcomes.indent('${esc(o.id)}')" title="Make a sub-outcome of the one above">→</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Outcomes.add('${esc(o.id)}')" title="Add a sub-outcome">+ Sub</button>
          ${r.archived
            ? `<button type="button" class="btn btn-secondary btn-sm" onclick="Outcomes.restore('${esc(o.id)}')">Restore</button>`
            : `<button type="button" class="btn btn-secondary btn-sm" onclick="Outcomes.archive('${esc(o.id)}')" title="Hide it but keep its tags">Archive</button>`}
          ${canDelete ? `<button type="button" class="btn btn-cancel btn-sm" onclick="Outcomes.remove('${esc(o.id)}')" title="Delete (only possible while unused)">&times;</button>` : ''}
        </span>
        <textarea class="po-desc" rows="2" placeholder="Full statement, e.g. “Graduates will be able to …”">${esc(o.description)}</textarea>
        <label class="po-parent">Parent <select class="po-parent-sel">${opts}</select></label>
        <label class="po-parent">Applies to <select class="po-prog-sel"><option value="">${o.parent_id ? '(inherit from parent)' : 'Overall (all programs)'}</option>${getPrograms().map((p) => `<option value="${esc(p.id)}" ${o.programId === p.id ? 'selected' : ''}>${esc(p.name)} only</option>`).join('')}</select></label>
        <label class="po-parent">Subject area <input type="text" class="po-area" list="po-area-list" value="${esc(o.area || '')}" placeholder="${esc(effArea(outcomes, o) || 'none')}" style="width:130px"></label>
        <label class="po-parent">Code <input type="text" class="po-override" value="${esc(o.codeOverride || '')}" placeholder="auto" style="width:70px"></label>
      </div>`;
    }).join('');
    return `
      <p class="hint-text">Outcomes can have sub-outcomes to any depth. Codes (1, 1.A, 1.A.1…) are generated from position. These are program-wide, saved in the workspace file, and printed with the matrix in "Download All Outlines (RTF)". Tag topics with them in the course editor (Modules tab). Archive instead of deleting: tags are kept.</p>
      <div class="po-toolbar">
        <button type="button" class="btn btn-primary btn-sm" onclick="Outcomes.add(null)">+ Add outcome</button>
        <label class="inline-field"><input type="checkbox" data-act="archived" ${showArchived ? 'checked' : ''}> Show archived</label>
      </div>
      <datalist id="po-area-list">${areas(outcomes).map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
      <div class="po-edit-list">${rows || '<p class="empty-note">No outcomes yet.</p>'}</div>`;
  }

  function render() {
    const modal = ensureModal();
    const outcomes = getOutcomes();
    const nActive = outcomes.filter((o) => o.status !== 'archived').length;
    const scrollEl = modal.querySelector('.po-body');
    const keepScroll = scrollEl ? scrollEl.scrollTop : 0;
    modal.innerHTML = `
      <div class="calendar-modal-card po-card" role="dialog" aria-label="Program outcomes">
        <div class="calendar-header">
          <div><h2 class="calendar-title">Program Outcomes</h2>
            <p class="calendar-summary">${nActive} active outcome${nActive === 1 ? '' : 's'}${outcomes.length > nActive ? `, ${outcomes.length - nActive} archived` : ''}</p></div>
          <button type="button" class="close-modal-btn" onclick="Outcomes.close()" aria-label="Close">&times;</button>
        </div>
        <div class="po-tabs">
          <button type="button" class="po-tab ${tab === 'matrix' ? 'is-on' : ''}" onclick="Outcomes.setTab('matrix')">Matrix</button>
          <button type="button" class="po-tab ${tab === 'define' ? 'is-on' : ''}" onclick="Outcomes.setTab('define')">Define outcomes</button>
          <button type="button" class="po-tab ${tab === 'programs' ? 'is-on' : ''}" onclick="Outcomes.setTab('programs')">Programs</button>
        </div>
        <div class="calendar-scroll po-body">${tab === 'matrix' ? matrixHtml() : tab === 'programs' ? programsHtml() : defineHtml()}</div>
      </div>`;
    modal.classList.remove('hidden');
    const body = modal.querySelector('.po-body');
    if (body) body.scrollTop = keepScroll;

    modal.querySelectorAll('.po-cell[data-course]').forEach((td) => {
      td.addEventListener('click', () => { detail = { courseId: td.dataset.course, outcomeId: td.dataset.outcome }; render(); });
    });
    modal.querySelectorAll('[data-toggle]').forEach((b) => {
      b.addEventListener('click', () => { const id = b.dataset.toggle; if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); render(); });
    });
    modal.querySelectorAll('[data-sel]').forEach((el) => {
      el.addEventListener('change', () => { if (el.dataset.sel === 'program') selProgram = el.value; else selArea = el.value; render(); });
    });
    modal.querySelectorAll('.po-prog-row').forEach((row) => {
      const p = getPrograms().find((x) => x.id === row.dataset.pid);
      if (!p) return;
      row.addEventListener('input', (e) => {
        if (e.target.classList.contains('pp-name')) p.name = e.target.value;
        else if (e.target.classList.contains('pp-desc')) p.description = e.target.value;
        else return;
        save();
      });
      row.addEventListener('change', (e) => {
        if (e.target.classList.contains('pp-type')) { p.type = e.target.value; save(); }
        // no re-render here: it would swallow the click that caused the blur
        const th = document.querySelector(`#outcomes-modal th[data-pid="${p.id}"]`);
        if (th) { th.title = p.name; th.firstElementChild.textContent = (p.name || '').slice(0, 22); }
      });
    });
    modal.querySelectorAll('.pp-mem').forEach((el) => {
      el.addEventListener('change', () => {
        const c = ((window.DATA && window.DATA.courses) || []).find((x) => x.id === el.dataset.course);
        if (c) { setMembership(c, el.dataset.pid, el.value); save(); }
      });
    });
    modal.querySelectorAll('[data-act]').forEach((el) => {
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'click', () => {
        const act = el.dataset.act;
        if (act === 'archived') showArchived = el.checked;
        if (act === 'expand') collapsed.clear();
        if (act === 'collapse') outcomes.forEach((o) => { if (kids(outcomes, o.id).length) collapsed.add(o.id); });
        render();
      });
    });
    modal.querySelectorAll('.po-edit-row').forEach((row) => {
      const o = outcomes.find((x) => x.id === row.dataset.id);
      if (!o) return;
      row.addEventListener('input', (e) => {
        if (e.target.classList.contains('po-title')) o.title = e.target.value;
        else if (e.target.classList.contains('po-desc')) o.description = e.target.value;
        else if (e.target.classList.contains('po-area')) { const v = e.target.value.trim(); if (v) o.area = v; else o.area = ''; }
        else if (e.target.classList.contains('po-override')) { const v = e.target.value.trim(); if (v) o.codeOverride = v; else delete o.codeOverride; }
        else return;
        save();
      });
      row.addEventListener('change', (e) => {
        if (e.target.classList.contains('po-prog-sel')) { o.programId = e.target.value || null; save(); render(); }
        else if (e.target.classList.contains('po-parent-sel')) reparent(o.id, e.target.value || null);
        else if (e.target.classList.contains('po-override')) render();
      });
    });
  }

  function open(which) {
    tab = which || (getOutcomes().length ? 'matrix' : 'define');
    detail = null;
    render();
  }
  function close() {
    const m = document.getElementById('outcomes-modal');
    if (m) m.classList.add('hidden');
  }
  function setTab(t) { tab = t; render(); }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  window.Outcomes = {
    LEVELS, PROGRAM_TYPES, getOutcomes, getPrograms, programCourses, membership, setMembership, effProgram, effArea, areas, normalize, flatten, codeMap, descendantIds, buildMatrix, pickerOptions, pruneTags,
    open, close, setTab, add, addProgram, removeProgram, move, indent, outdent, archive, restore, remove,
  };
  window.openOutcomesModal = open;
  window.closeOutcomesModal = close;
})();
