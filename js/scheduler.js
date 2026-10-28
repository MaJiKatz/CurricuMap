/* ============================================================
   js/scheduler.js
   The ONE place that decides what gets taught when.

   Everything is measured in *lecture hours* (1 = one standard
   50-minute lecture). Topics may be fractional (e.g. 1.5), and a
   week can be any pattern of class blocks (e.g. [1,1,1], [1.5,1.5],
   [1,2]). Topics are packed continuously, so a 1.5 h topic in 1 h
   classes fills one class and half of the next.

   Used by: calendar view, course editor (budget bar), board badges,
   and the RTF exporter — so they can never disagree again.
   ============================================================ */

(function () {
  const MIN_PER_HOUR = 60; // internal integer resolution (1 lecture hour = 60 units)

  const FORMAT_PRESETS = {
    '3x50':  { label: '3 classes / week (50 min each)', pattern: [1, 1, 1], minutes: [50, 50, 50] },
    '2x75':  { label: '2 classes / week (75 min each)', pattern: [1.5, 1.5], minutes: [75, 75] },
    '1x180': { label: '1 class / week (3 h block)',     pattern: [3],       minutes: [170] },
  };
  const FORMAT_ALIASES = { '2x90': '2x75' };

  const DEFAULT_SCHEDULE = { weeks: 12, format: '3x50', pattern: null };

  // ---------- small helpers ----------
  function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  }
  function toUnits(hours) { return Math.round(hours * MIN_PER_HOUR); }
  function toHours(units) { return Math.round((units / MIN_PER_HOUR) * 100) / 100; }

  function formatHours(h) {
    const r = Math.round(h * 100) / 100;
    return Number.isInteger(r) ? String(r) : String(r).replace(/0+$/, '');
  }

  function parsePattern(input) {
    if (Array.isArray(input)) return input.map(num).filter((n) => n > 0);
    if (typeof input !== 'string') return [];
    return input.split(/[,;\s]+/).map(num).filter((n) => n > 0);
  }

  // ---------- durations ----------
  function topicHours(topic) {
    if (typeof topic === 'number') return topic > 0 ? topic : 1;
    if (!topic || typeof topic === 'string') return 1;
    if (topic.selfDirected) return 0; // self-directed: students work on it outside class
    const v = num(topic.lectureCount ?? topic.lectures ?? topic.hours ?? topic.duration);
    return v > 0 ? v : 1;
  }

  function topicsHours(mod) {
    return (mod && Array.isArray(mod.topics) ? mod.topics : []).reduce((s, t) => s + topicHours(t), 0);
  }

  // Non-topic items that still use class time: review, reflection, guest lecture...
  const SESSION_TYPES = {
    review:     { label: 'Review',          icon: '\uD83D\uDD01' },
    reflection: { label: 'Self-reflection', icon: '\uD83D\uDCAD' },
    guest:      { label: 'Guest lecture',   icon: '\uD83C\uDFA4' },
    other:      { label: 'Other session',   icon: '\uD83D\uDCCC' },
  };
  function isSession(mod) { return !!(mod && mod.isSession); }
  function sessionType(mod) { return SESSION_TYPES[mod && mod.sessionType] ? mod.sessionType : 'other'; }
  function sessionHours(mod) {
    const v = num(mod && (mod.lectureCount ?? mod.lectures ?? mod.hours));
    return v > 0 ? v : 1;
  }

  /** Total teaching hours for a regular module: max(explicit total, sum of topics). */
  function moduleHours(mod) {
    if (!mod || mod.isExam || mod.isLab) return 0;
    if (mod.isSession) return sessionHours(mod);
    const explicit = num(mod.lectureCount ?? mod.lectures ?? mod.totalLectures);
    return Math.max(explicit > 0 ? explicit : 0, topicsHours(mod));
  }

  /** Number of whole classes an in-class assessment occupies (whole-class mode). */
  function examClasses(mod) {
    const n = parseInt(mod.lectureCount ?? mod.lectures, 10);
    return n > 0 ? n : 1;
  }

  /** True if this assessment shares a class instead of occupying whole ones. */
  function isPartialExam(mod) {
    return mod.durationMode === 'hours';
  }

  /** Hours an assessment needs when it shares a class rather than filling one. */
  function examHours(mod) {
    const h = num(mod.durationHours);
    return h > 0 ? h : 0.5;
  }

  function isTimePermitting(mod) {
    return !!(mod && (mod.timePermitting || mod.optional));
  }

  // ---------- elective groups ("teach n of m modules") ----------
  const ELECTIVE_BASES = {
    professor: 'instructor choice',
    time: 'available time',
    votes: 'student vote',
    other: 'other',
  };

  /**
   * Resolves each elective group: which modules are taught in this offering.
   * Modules the instructor ticked "taught" come first (up to `pick`); remaining
   * places are filled by the earliest modules in course order.
   */
  function electiveSelection(course) {
    const mods = ((course && course.modules) || []).filter((m) => !m.isExam && !m.isLab && m.electiveGroup && String(m.electiveGroup).trim());
    const defs = (course && course.electiveGroups) || {};
    const byName = new Map();
    mods.forEach((m) => {
      const name = String(m.electiveGroup).trim();
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(m);
    });
    const groups = [];
    const notTaughtIds = new Set();
    byName.forEach((members, name) => {
      const def = defs[name] || {};
      const total = members.length;
      let pick = parseInt(def.pick, 10);
      if (!(pick >= 0)) pick = total;
      pick = Math.min(pick, total);
      const flagged = members.filter((m) => m.electiveTaught);
      const chosen = flagged.slice(0, pick);
      members.forEach((m) => { if (chosen.length < pick && !chosen.includes(m)) chosen.push(m); });
      const taught = members.filter((m) => chosen.includes(m));
      const notTaught = members.filter((m) => !chosen.includes(m));
      notTaught.forEach((m) => notTaughtIds.add(m.id));
      groups.push({
        name, pick, total,
        basis: def.basis || 'professor',
        basisLabel: ELECTIVE_BASES[def.basis || 'professor'] || ELECTIVE_BASES.other,
        taught, notTaught,
      });
    });
    return { groups, notTaughtIds };
  }

  // ---------- course schedule config ----------
  function getCourseSchedule(course) {
    const s = Object.assign({}, DEFAULT_SCHEDULE, (course && course.schedule) || {});
    let format = FORMAT_ALIASES[s.format] || s.format || '3x50';

    let pattern;
    let minutes;
    if (format === 'custom') {
      pattern = parsePattern(s.pattern);
      if (pattern.length === 0) { format = '3x50'; }
    }
    if (format !== 'custom') {
      const preset = FORMAT_PRESETS[format] || FORMAT_PRESETS['3x50'];
      pattern = preset.pattern.slice();
      minutes = preset.minutes.slice();
    } else {
      minutes = pattern.map((h) => Math.round(h * 50));
    }

    const weeks = Math.max(1, parseInt(s.weeks ?? (course && course.weeksInSemester), 10) || 12);
    const hoursPerWeek = pattern.reduce((a, b) => a + b, 0);
    const uniform = pattern.every((h) => h === pattern[0]);

    return {
      weeks,
      format,
      pattern,
      minutes,
      hoursPerWeek,
      uniform,
      allOneHour: pattern.every((h) => h === 1),
      capacityHours: weeks * hoursPerWeek,
      label: describeFormat(format, pattern, minutes),
    };
  }

  function describeFormat(format, pattern, minutes) {
    if (format !== 'custom' && FORMAT_PRESETS[format]) return FORMAT_PRESETS[format].label;
    const n = pattern.length;
    return `${n} class${n === 1 ? '' : 'es'} / week (${pattern.map((h) => formatHours(h) + ' h').join(' + ')})`;
  }

  // ---------- the scheduler ----------
  /**
   * Builds the full term layout for a course.
   * Returns {
   *   config, meetings[], weeks[], overflow[], unreachedOptional[],
   *   requiredHours, optionalHours, capacityHours, usedHours, overByHours,
   *   assessmentWeek{modId: week|null}, topicStatus{`${modId}::${tIdx}`: {...}},
   *   moduleStatus{modId: 'ok'|'partial'|'overflow'|'optional-unreached'}
   * }
   */
  function build(course) {
    const config = getCourseSchedule(course);
    const modules = (course && course.modules) || [];
    const elective = electiveSelection(course);

    const meetings = [];
    for (let w = 1; w <= config.weeks; w++) {
      config.pattern.forEach((h, d) => {
        meetings.push({
          week: w,
          day: d + 1,
          hours: h,
          minutes: config.minutes[d],
          cap: toUnits(h),
          used: 0,
          segs: [],
        });
      });
    }

    let mi = 0;
    const overflow = [];
    const unreachedOptional = [];
    const selfDirectedList = [];
    const takeHomeByWeek = {};
    const assessmentWeek = {};
    const topicStatus = {};
    const moduleStatus = {};

    const advance = () => { while (mi < meetings.length && meetings[mi].used >= meetings[mi].cap) mi++; };
    const currentWeek = () => {
      advance();
      return mi < meetings.length ? meetings[mi].week : null;
    };

    function padToFreshClass() {
      if (mi < meetings.length && meetings[mi].used > 0 && meetings[mi].used < meetings[mi].cap) {
        const m = meetings[mi];
        const left = m.cap - m.used;
        m.segs.push({ kind: 'buffer', units: left, hours: toHours(left), title: 'Catch-up / review' });
        m.used = m.cap;
        mi++;
      }
    }

    function placeTimed(base, hours, isOptional) {
      const pieces = [];
      let rem = toUnits(hours);
      while (rem > 0) {
        advance();
        if (mi >= meetings.length) {
          const seg = Object.assign({}, base, { units: rem, hours: toHours(rem), overflow: true, optional: !!isOptional });
          pieces.push(seg);
          (isOptional ? unreachedOptional : overflow).push(seg);
          rem = 0;
          break;
        }
        const m = meetings[mi];
        const take = Math.min(rem, m.cap - m.used);
        const seg = Object.assign({}, base, { units: take, hours: toHours(take), meeting: m, optional: !!isOptional });
        seg.fillsClass = take === m.cap;
        m.segs.push(seg);
        m.used += take;
        rem -= take;
        pieces.push(seg);
      }
      pieces.forEach((p, i) => { p.part = i + 1; p.parts = pieces.length; });
      return pieces;
    }

    function summarise(pieces) {
      const placed = pieces.filter((p) => !p.overflow);
      const over = pieces.filter((p) => p.overflow);
      const weeks = placed.map((p) => p.meeting.week);
      return {
        status: over.length === 0 ? 'ok' : placed.length === 0 ? 'overflow' : 'partial',
        startWeek: weeks.length ? Math.min(...weeks) : null,
        endWeek: weeks.length ? Math.max(...weeks) : null,
        overHours: toHours(over.reduce((s, p) => s + p.units, 0)),
      };
    }

    function placeModule(mod, modIndex, isOptional) {
      if (mod.startsFreshClass) padToFreshClass();
      const label = mod.label || `Module ${modIndex + 1}`;
      const base = { moduleId: mod.id, moduleLabel: label, moduleTitle: mod.title || '', moduleIndex: modIndex };
      const all = [];

      (mod.topics || []).forEach((topic, tIdx) => {
        const title = typeof topic === 'string' ? topic : (topic.title || topic.name || `Topic ${tIdx + 1}`);
        if (topic && typeof topic === 'object' && topic.selfDirected) {
          // No class time: listed in the week where the schedule has reached this point.
          const wk = currentWeek() || config.weeks;
          selfDirectedList.push({ week: wk, moduleId: mod.id, moduleLabel: label, moduleIndex: modIndex, topicIndex: tIdx, title, optional: !!isOptional });
          topicStatus[`${mod.id}::${tIdx}`] = { status: 'self-directed', startWeek: wk, endWeek: wk, overHours: 0 };
          return;
        }
        const pieces = placeTimed(
          Object.assign({}, base, { kind: 'topic', topicIndex: tIdx, title, totalHours: topicHours(topic) }),
          topicHours(topic),
          isOptional
        );
        const st = summarise(pieces);
        if (isOptional && st.status !== 'ok') st.status = st.status === 'overflow' ? 'optional-unreached' : 'optional-partial';
        topicStatus[`${mod.id}::${tIdx}`] = st;
        all.push(...pieces);
      });

      const extra = moduleHours(mod) - topicsHours(mod);
      if (extra > 0.001) {
        const pieces = placeTimed(
          Object.assign({}, base, { kind: 'unassigned', title: mod.title || label, totalHours: extra }),
          extra,
          isOptional
        );
        all.push(...pieces);
      }

      const st = summarise(all);
      moduleStatus[mod.id] = isOptional && st.status !== 'ok'
        ? (st.status === 'overflow' ? 'optional-unreached' : 'optional-partial')
        : st.status;
    }

    const deferred = [];

    modules.forEach((mod, modIndex) => {
      if (mod.isLab) return;
      if (elective.notTaughtIds.has(mod.id)) { moduleStatus[mod.id] = 'not-selected'; return; }

      if (mod.isExam) {
        if (mod.isTakeHome) {
          let wk = currentWeek();
          if (wk === null) wk = config.weeks; // due at the end if we're already out of room
          (takeHomeByWeek[wk] = takeHomeByWeek[wk] || []).push(mod);
          assessmentWeek[mod.id] = wk;
          moduleStatus[mod.id] = 'ok';
          return;
        }

        if (isPartialExam(mod)) {
          // Shares a class with whatever else is scheduled there, instead of
          // claiming the whole meeting — e.g. a 20-minute quiz at the top of a lecture.
          if (mod.startsFreshClass) padToFreshClass();
          const base = {
            kind: 'exam', moduleId: mod.id, moduleLabel: mod.label || 'Assessment',
            title: mod.title || 'Assessment',
            weightPercent: parseFloat(mod.weightPercent) || 0, moduleIndex: modIndex,
          };
          const pieces = placeTimed(base, examHours(mod), false);
          const st = summarise(pieces);
          assessmentWeek[mod.id] = st.startWeek;
          moduleStatus[mod.id] = st.status;
          return;
        }

        padToFreshClass();
        const n = examClasses(mod);
        let firstWeek = null;
        let placedAll = true;
        for (let k = 0; k < n; k++) {
          advance();
          const seg = {
            kind: 'exam', moduleId: mod.id, moduleLabel: mod.label || 'Assessment',
            title: n > 1 ? `${mod.title || 'Assessment'} (Part ${k + 1})` : (mod.title || 'Assessment'),
            weightPercent: parseFloat(mod.weightPercent) || 0, moduleIndex: modIndex,
          };
          if (mi >= meetings.length) {
            placedAll = false;
            seg.overflow = true;
            seg.units = toUnits(config.pattern[0]);
            seg.hours = config.pattern[0];
            overflow.push(seg);
            continue;
          }
          const m = meetings[mi];
          seg.units = m.cap; seg.hours = m.hours; seg.meeting = m; seg.fillsClass = true;
          m.segs.push(seg);
          m.used = m.cap;
          if (firstWeek === null) firstWeek = m.week;
          mi++;
        }
        assessmentWeek[mod.id] = firstWeek;
        moduleStatus[mod.id] = placedAll ? 'ok' : (firstWeek ? 'partial' : 'overflow');
        return;
      }

      if (mod.isSession) {
        if (mod.startsFreshClass) padToFreshClass();
        const label = mod.label || (SESSION_TYPES[sessionType(mod)].label);
        const pieces = placeTimed({
          kind: 'session', sessionType: sessionType(mod), moduleId: mod.id, moduleLabel: label,
          title: mod.title || label, speaker: mod.speaker || '', moduleIndex: modIndex, totalHours: sessionHours(mod),
        }, sessionHours(mod), false);
        moduleStatus[mod.id] = summarise(pieces).status;
        return;
      }

      if (isTimePermitting(mod)) { deferred.push([mod, modIndex]); return; }
      placeModule(mod, modIndex, false);
    });

    // Time-permitting modules fill whatever is left at the end of term.
    deferred.forEach(([mod, idx]) => placeModule(mod, idx, true));

    // Assemble weeks
    const weeks = [];
    for (let w = 1; w <= config.weeks; w++) {
      weeks.push({
        weekNumber: w,
        meetings: meetings.filter((m) => m.week === w),
        takeHome: takeHomeByWeek[w] || [],
        selfDirected: selfDirectedList.filter((x) => x.week === w),
      });
    }

    // Required = teaching hours + the class time exams actually occupy (an exam in a
    // 2 h block uses 2 h). Catch-up gaps are reported separately so the numbers add up:
    // required + catch-up - capacity = over.
    let requiredHours = 0;
    let optionalHours = 0;
    modules.forEach((mod) => {
      if (mod.isLab || mod.isExam || elective.notTaughtIds.has(mod.id)) return;
      if (isTimePermitting(mod)) optionalHours += moduleHours(mod);
      else requiredHours += moduleHours(mod);
    });
    const examUnits = meetings.reduce((s, m) => s + m.segs.filter((x) => x.kind === 'exam').reduce((a, x) => a + x.units, 0), 0)
      + overflow.filter((x) => x.kind === 'exam').reduce((a, x) => a + x.units, 0);
    requiredHours += toHours(examUnits);
    const catchUpHours = toHours(meetings.reduce((s, m) => s + m.segs.filter((x) => x.kind === 'buffer').reduce((a, x) => a + x.units, 0), 0));

    const overUnits = overflow.reduce((s, seg) => s + seg.units, 0);
    const usedUnits = meetings.reduce((s, m) => s + m.segs.filter((x) => x.kind !== 'buffer').reduce((a, x) => a + x.units, 0), 0);

    const dated = attachDates(meetings, weeks, course, assessmentWeek, takeHomeByWeek);

    return {
      config,
      meetings,
      weeks,
      electiveGroups: elective.groups,
      hasDates: dated.hasDates,
      skipNotes: dated.skipNotes,
      assessmentDate: dated.assessmentDate,
      overflow,
      unreachedOptional,
      selfDirected: selfDirectedList,
      requiredHours: Math.round(requiredHours * 100) / 100,
      catchUpHours,
      optionalHours: Math.round(optionalHours * 100) / 100,
      capacityHours: config.capacityHours,
      usedHours: toHours(usedUnits),
      overByHours: toHours(overUnits),
      isOver: overflow.length > 0,
      assessmentWeek,
      topicStatus,
      moduleStatus,
    };
  }

  // ---------- calendar dates (start date, class days, important dates) ----------
  const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']; // index = Date.getUTCDay()
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DEFAULT_CLASS_DAYS = { 1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] }; // 1 = Mon

  function parseISODate(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function isoDate(d) { return d.toISOString().slice(0, 10); }
  function formatDateLabel(iso, withWeekday = true) {
    const d = parseISODate(iso);
    if (!d) return '';
    const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
    return withWeekday ? `${WEEKDAY_NAMES[d.getUTCDay()].slice(0, 3)} ${base}` : base;
  }

  /** Weekday numbers (0=Sun..6=Sat) the course meets on, honouring course.classDays when valid. */
  function resolveClassDays(course, perWeek) {
    const codes = Array.isArray(course && course.classDays) ? course.classDays : [];
    const nums = codes.map((c) => WEEKDAY_CODES.indexOf(String(c).toUpperCase())).filter((n) => n >= 0);
    const uniq = Array.from(new Set(nums));
    if (uniq.length === perWeek) return uniq.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const fallback = DEFAULT_CLASS_DAYS[Math.min(5, Math.max(1, perWeek))] || [1, 3, 5];
    return fallback.slice(0, perWeek);
  }

  /**
   * Which calendar a course uses. course.dateMode: 'inherit' (program calendar, the
   * default), 'custom' (the course's own startDate/importantDates/extraDays) or 'off'
   * (no dates at all). Older files with a startDate and no mode count as custom.
   */
  function dateMode(course) {
    if (course && course.dateMode) return course.dateMode;
    return course && course.startDate ? 'custom' : 'inherit';
  }
  function programCalendar() {
    const d = typeof window !== 'undefined' && window.DATA && window.DATA.calendar;
    return d || null;
  }
  /**
   * A copy of the course with its calendar forced to one of three views:
   *  'course'  -> as saved (program calendar + this course's own changes)
   *  'global'  -> the program calendar only, ignoring this course's date changes
   *  'generic' -> no dates at all
   */
  function withDateView(course, view) {
    if (!view || view === 'course') return course;
    const c = { ...course };
    delete c.startDate; delete c.importantDates; delete c.extraDays; delete c.skipGlobal;
    c.dateMode = view === 'generic' ? 'off' : 'inherit';
    return c;
  }

  /** Stable key used by a course to switch off one program-calendar entry. */
  function globalKey(kind, item) {
    return kind === 'swap' ? `swap|${item.date || ''}` : `date|${item.date || ''}|${item.label || ''}`;
  }
  /**
   * Calendar a course actually uses:
   *  - 'off'     -> none
   *  - 'custom'  -> only the course's own startDate / importantDates / extraDays
   *  - 'inherit' -> the program calendar, plus this course's changes: its own startDate
   *                 replaces the program's, its dates and swaps are added, and entries
   *                 listed in course.skipGlobal are left out
   */
  function effectiveCalendar(course) {
    const mode = dateMode(course);
    if (mode === 'off') return null;
    if (mode === 'custom') {
      return { startDate: course.startDate, importantDates: course.importantDates || [], extraDays: course.extraDays || [] };
    }
    const g = programCalendar();
    const on = !!(g && g.enabled !== false);
    const skip = new Set((course && course.skipGlobal) || []);
    const startDate = (course && course.startDate) || (on ? g.startDate : '');
    if (!startDate) return null;
    return {
      startDate,
      importantDates: [
        ...(on ? (g.importantDates || []).filter((d) => !skip.has(globalKey('date', d))) : []),
        ...((course && course.importantDates) || []),
      ],
      extraDays: [
        ...(on ? (g.extraDays || []).filter((d) => !skip.has(globalKey('swap', d))) : []),
        ...((course && course.extraDays) || []),
      ],
    };
  }

  function parseImportantDates(cal) {
    return ((cal && cal.importantDates) || []).map((d) => {
      const start = parseISODate(d.date);
      if (!start) return null;
      const end = parseISODate(d.endDate) || start;
      return {
        start: end < start ? end : start,
        end: end < start ? start : end,
        label: d.label || 'Important date',
        skipsClass: !!d.skipsClass,
      };
    }).filter(Boolean);
  }

  function inRange(date, ranges) {
    return ranges.some((r) => date >= r.start && date <= r.end);
  }

  /**
   * Walks the calendar day by day from the start date; each class-day that is not
   * inside a "no class" range takes the next meeting. A skipped day costs exactly
   * one meeting slot — the rest of the term just slides later.
   */
  function attachDates(meetings, weeks, course, assessmentWeek, takeHomeByWeek) {
    const none = { skipNotes: [], hasDates: false, assessmentDate: {} };
    const cal = effectiveCalendar(course);
    const start = parseISODate(cal && cal.startDate);
    if (!start || !meetings.length) return none;

    const perWeek = meetings.filter((m) => m.week === meetings[0].week).length;
    const weekdaySet = new Set(resolveClassDays(course, perWeek));
    const all = parseImportantDates(cal);
    const skipRanges = all.filter((d) => d.skipsClass);

    // Day swaps / extra days: a date that runs another weekday's schedule.
    const swaps = new Map();
    ((cal && cal.extraDays) || []).forEach((x) => {
      const d = parseISODate(x.date);
      const dow = WEEKDAY_CODES.indexOf(String(x.actsAs || '').toUpperCase());
      if (d && dow >= 0) swaps.set(isoDate(d), { dow, label: x.label || '' });
    });

    let cursor = addDays(start, -1);
    let mi = 0;
    for (let guard = 0; guard < 3000 && mi < meetings.length; guard++) {
      cursor = addDays(cursor, 1);
      const iso = isoDate(cursor);
      const swapped = swaps.has(iso);
      const dow = swapped ? swaps.get(iso).dow : cursor.getUTCDay();
      if (!weekdaySet.has(dow)) continue;
      if (inRange(cursor, skipRanges)) continue;
      const m = meetings[mi++];
      m.date = iso;
      m.dateLabel = formatDateLabel(iso);
      if (swapped && dow !== cursor.getUTCDay()) {
        m.actsAs = WEEKDAY_NAMES[dow];
        m.dateLabel += ` (${WEEKDAY_NAMES[dow]} schedule)`;
      }
    }

    weeks.forEach((w) => {
      const dated = w.meetings.filter((m) => m.date);
      if (dated.length) {
        w.startDate = dated[0].date;
        w.endDate = dated[dated.length - 1].date;
      }
    });

    // One note per configured important date, shown on the week whose classes follow it.
    const notes = [];
    all.forEach((d) => {
      if (d.end < start) return; // before the first class: nothing to note
      const next = meetings.find((m) => m.date && parseISODate(m.date) >= d.start);
      const week = next ? next.week : weeks[weeks.length - 1].weekNumber;
      const note = {
        week,
        label: d.label,
        date: isoDate(d.start),
        endDate: isoDate(d.end),
        skipsClass: d.skipsClass,
        text: `${d.label} (${formatDateLabel(isoDate(d.start), true)}${d.end > d.start ? ' – ' + formatDateLabel(isoDate(d.end), true) : ''})`
          + (d.skipsClass ? ' — no class' : ''),
      };
      notes.push(note);
      const wk = weeks.find((x) => x.weekNumber === week);
      if (wk) (wk.skipNotes = wk.skipNotes || []).push(note);
    });

    // Notes for swap days, on the week whose classes follow them.
    swaps.forEach((sw, iso) => {
      const d = parseISODate(iso);
      if (d < start) return;
      const hit = meetings.find((m) => m.date === iso);
      const next = hit || meetings.find((m) => m.date && parseISODate(m.date) >= d);
      const week = next ? next.week : weeks[weeks.length - 1].weekNumber;
      const dayName = WEEKDAY_NAMES[sw.dow];
      const actual = WEEKDAY_NAMES[d.getUTCDay()];
      let text = `${formatDateLabel(iso, true)} follows a ${dayName} schedule${sw.label ? ' (' + sw.label + ')' : ''}`;
      let skipsClass = false;
      if (!hit && !weekdaySet.has(sw.dow)) { text += ` \u2014 no ${actual} class`; skipsClass = true; }
      if (actual === dayName) return;
      const note = { week, label: sw.label || 'Schedule swap', date: iso, endDate: iso, skipsClass, text, isSwap: true };
      notes.push(note);
      const wk = weeks.find((x) => x.weekNumber === week);
      if (wk) (wk.skipNotes = wk.skipNotes || []).push(note);
    });

    // Dates for assessments: in-class = its meeting date; take-home = last class of its week.
    const assessmentDate = {};
    meetings.forEach((m) => {
      m.segs.forEach((seg) => {
        if (seg.kind === 'exam' && m.date && !assessmentDate[seg.moduleId]) assessmentDate[seg.moduleId] = m.date;
      });
    });
    Object.keys(takeHomeByWeek || {}).forEach((wkNum) => {
      const wk = weeks.find((x) => x.weekNumber === Number(wkNum));
      if (!wk || !wk.endDate) return;
      takeHomeByWeek[wkNum].forEach((mod) => { assessmentDate[mod.id] = wk.endDate; });
    });

    return { skipNotes: notes, hasDates: true, assessmentDate };
  }

  // ---------- lab / weight helpers used by editor + export ----------
  function labHours(course) {
    if (course && course.labHours !== undefined && course.labHours !== '') return num(course.labHours) || 0;
    let h = 0;
    ((course && course.modules) || []).forEach((m) => {
      if (!m.isLab) return;
      (m.labs || []).forEach((l) => { h += num(l.hours) || 0; });
      if (!(m.labs || []).length) h += num(m.labHours ?? m.hours) || 0;
    });
    return h;
  }

  function weightSummary(course) {
    let assessments = 0;
    let labs = 0;
    ((course && course.modules) || []).forEach((m) => {
      if (m.isExam) assessments += num(m.weightPercent ?? m.weight) || 0;
      if (m.isLab) {
        const items = m.labs || [];
        labs += items.length
          ? items.reduce((s, l) => s + (num(l.weightPercent ?? l.weight) || 0), 0)
          : (num(m.weightPercent ?? m.weight) || 0);
      }
    });
    const defined = Math.round((assessments + labs) * 100) / 100;
    const hasFinal = !(course && course.noFinalExam);
    return {
      assessments: Math.round(assessments * 100) / 100,
      labs: Math.round(labs * 100) / 100,
      defined,
      finalExam: hasFinal ? Math.max(0, Math.round((100 - defined) * 100) / 100) : 0,
      hasFinal,
      isOver: defined > 100.001,
      isShort: !hasFinal && defined < 99.999,
    };
  }

  window.Scheduler = {
    FORMAT_PRESETS,
    DEFAULT_SCHEDULE,
    getCourseSchedule,
    parsePattern,
    build,
    topicHours,
    topicsHours,
    moduleHours,
    examClasses,
    isPartialExam,
    examHours,
    isTimePermitting,
    electiveSelection,
    ELECTIVE_BASES,
    labHours,
    weightSummary,
    formatHours,
    parseISODate,
    addDays,
    isoDate,
    formatDateLabel,
    SESSION_TYPES, isSession, sessionType, sessionHours, resolveClassDays, dateMode, effectiveCalendar, globalKey, withDateView,
    WEEKDAY_CODES,
    WEEKDAY_NAMES,
  };
})();
