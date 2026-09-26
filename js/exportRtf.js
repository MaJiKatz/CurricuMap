/* ============================================================
   js/exportRtf.js
   Generates RTF course outlines (single course or full program).

   All scheduling comes from window.Scheduler, so the outline's
   week-by-week plan, "Scheduled: Week N" lines and hour totals are
   identical to the calendar view and the editor's time budget.
   ============================================================ */

(function () {
  // Color table indices: 1 ink, 2 grey, 3 red (warnings), 4 amber
  const COLOR_TABLE = '{\\colortbl ;\\red15\\green23\\blue42;\\red100\\green116\\blue139;\\red190\\green30\\blue30;\\red150\\green105\\blue15;}';
  const FONT_TABLE = '{\\fonttbl{\\f0\\fswiss\\fprq2\\fcharset0 Arial;}}';

  const FALLBACK_AI_POLICY = 'Permissible use of assistive technologies and Generative Artificial Intelligence (e.g., ChatGPT, Claude) in this course will be explicitly stated for each assignment. Unless explicitly permitted by the instructor, the use of generative AI tools to produce coursework, code, or written assignments is unauthorized and constitutes academic misconduct.';

  // ---------------- basic RTF helpers ----------------
  function escapeRtf(text) {
    if (text === null || text === undefined) return '';
    let out = '';
    const s = String(text).replace(/\r\n?/g, '\n');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const code = s.charCodeAt(i);
      if (ch === '\\') out += '\\\\';
      else if (ch === '{') out += '\\{';
      else if (ch === '}') out += '\\}';
      else if (ch === '\n') out += '\\line ';
      else if (ch === '\t') out += '\\tab ';
      else if (code > 127) out += `\\u${code > 32767 ? code - 65536 : code}?`;
      else out += ch;
    }
    return out;
  }

  // Inline styling via groups, so spacing is never swallowed by control-word delimiters.
  const B = (t) => `{\\b ${t}}`;
  const I = (t) => `{\\i ${t}}`;
  const G = (t) => `{\\cf2 ${t}}`;
  const R = (t) => `{\\cf3 ${t}}`;

  const P = (indent, body, extra = '') => `\\pard\\ql\\sa40\\li${indent}${extra} ${body}\\par\n`;
  const blank = () => `\\pard\\ql\\par\n`;
  const heading = (text) => `\\pard\\ql\\sb240\\sa120\\keepn\\b\\fs28 ${escapeRtf(text)}\\b0\\fs22\\par\n`;
  const bullet = (indent, body) => `\\pard\\ql\\sa40\\li${indent + 360}\\fi-360 \\'95\\tab ${body}\\par\n`;

  function docStart() {
    return `{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033\n${FONT_TABLE}\n${COLOR_TABLE}\n` +
      `\\viewkind4\\uc1\\paperw12240\\paperh15840\\margl1440\\margr1440\\margt1440\\margb1440\\f0\\fs22\\cf1\n`;
  }

  function pageHeader(course, g) {
    const bits = [course.term || g.term, course.version || g.version].filter(Boolean).join(' ');
    return bits ? `{\\header \\pard\\qr\\f0\\cf2\\fs18 ${escapeRtf(bits)}\\cf1\\fs22\\par}\n` : '';
  }

  function globals() {
    return typeof window.getGlobalSettings === 'function'
      ? window.getGlobalSettings()
      : (window.DEFAULT_GLOBAL_SETTINGS || {});
  }

  function pick(...vals) {
    for (const v of vals) if (typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null) return v;
    return '';
  }

  const fmt = (h) => (window.Scheduler ? window.Scheduler.formatHours(h) : String(h));

  // ---------------- lookups ----------------
  function allCourses() {
    return (window.DATA && Array.isArray(window.DATA.courses)) ? window.DATA.courses : [];
  }

  function findModuleAnywhere(id) {
    for (const c of allCourses()) {
      const idx = (c.modules || []).findIndex((m) => m.id === id);
      if (idx !== -1) return { course: c, module: c.modules[idx], index: idx };
    }
    return null;
  }

  /** Teaching modules only (no exams/labs), numbered 1..n in course order. */
  function teachingNumbers(course) {
    const map = {};
    let n = 0;
    (course.modules || []).forEach((m) => { if (!m.isExam && !m.isLab) map[m.id] = ++n; });
    return map;
  }

  function moduleDisplayName(course, mod) {
    const nums = teachingNumbers(course);
    const label = nums[mod.id] ? `Module ${nums[mod.id]}` : (mod.label || 'Module');
    return mod.title ? `${label}: ${mod.title}` : label;
  }

  /** Exact-id scope resolution (the old fuzzy matcher confused array positions with module numbers). */
  function resolveScope(course, raw) {
    let ids = [];
    if (Array.isArray(raw)) ids = raw;
    else if (typeof raw === 'string') ids = raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return '';

    const order = (course.modules || []).map((m) => m.id);
    const local = [];
    const external = [];
    ids.forEach((id) => {
      const inCourse = (course.modules || []).find((m) => m.id === id);
      if (inCourse) { local.push(inCourse); return; }
      const hit = findModuleAnywhere(id);
      if (hit) external.push(`${hit.course.code} ${moduleDisplayName(hit.course, hit.module)}`);
      else {
        // Last resort: user typed a label like "Module 3"
        const byLabel = (course.modules || []).find((m) => (m.label || '').toLowerCase() === String(id).toLowerCase());
        external.push(byLabel ? moduleDisplayName(course, byLabel) : String(id));
      }
    });
    local.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return [...local.map((m) => moduleDisplayName(course, m)), ...external].join('; ');
  }

  function pedagogicalTag(conn) {
    const s = String(conn.strength || conn.level || '').toLowerCase();
    if (s === 'strong' || s === 'high' || s === '3') return 'Essential Prerequisite';
    if (s === 'weak' || s === 'low' || s === '1') return 'Contextual Background';
    return null; // "related" renders untagged, as in the current outlines
  }

  // ---------------- schedule section ----------------
  function segmentText(seg, course, nums, cfg) {
    const tag = (s) => (nums[s.moduleId] ? ' ' + G(`[Module ${nums[s.moduleId]}]`) : '');
    const partial = seg.meeting && !seg.fillsClass;
    const tp = seg.optional ? ' ' + G(I('(time permitting)')) : '';

    if (seg.kind === 'exam') {
      return `${B('[EXAM]')} ${escapeRtf(seg.title)}`;
    }
    if (seg.kind === 'buffer') {
      return G(I(`Catch-up / review (${fmt(seg.hours)} h)`));
    }
    let info = '';
    const unit = cfg.allOneHour ? 'Lec' : 'Part';
    if (seg.parts > 1) info = ` (${unit} ${seg.part}/${seg.parts}${partial ? `, ${fmt(seg.hours)} h` : ''})`;
    else if (partial) info = ` (${fmt(seg.hours)} h)`;

    const title = seg.kind === 'unassigned' ? escapeRtf(seg.title) : B(escapeRtf(seg.title));
    return `${title}${info ? ' ' + G(escapeRtf(info.trim())) : ''}${tag(seg)}${tp}`;
  }

  function mergePieces(segs) {
    // Collapse the pieces of one topic/exam into a single line for the overflow lists.
    const out = [];
    const seen = new Map();
    segs.forEach((s) => {
      const key = `${s.moduleId}|${s.kind}|${s.topicIndex ?? ''}|${s.title}`;
      if (seen.has(key)) { seen.get(key).hours += s.hours; return; }
      const row = { ...s };
      seen.set(key, row);
      out.push(row);
    });
    return out;
  }

  function buildScheduleRtf(course, sched, labHrs) {
    const cfg = sched.config;
    const nums = teachingNumbers(course);
    let rtf = heading('2. Course Schedule Overview');

    const perWeek = cfg.pattern.length;
    const blockText = cfg.uniform
      ? `${cfg.minutes[0]} min/block`
      : `${cfg.pattern.map((h) => fmt(h) + ' h').join(' + ')} blocks`;
    const noun = cfg.allOneHour ? 'lectures' : 'classes';
    let format = `Class Format: ${perWeek} ${noun}/week (${blockText}, ${fmt(cfg.capacityHours)} total lecture hrs)`;
    if (labHrs > 0) format += ` | ${fmt(labHrs)} lab hrs`;
    format += ` across ${cfg.weeks} weeks.`;
    rtf += P(360, `\\cf2 ${escapeRtf(format)}\\cf1`);
    rtf += blank();

    sched.weeks.forEach((week) => {
      rtf += P(360, `\\b Week ${week.weekNumber}:\\b0`, '\\keepn');
      week.meetings.forEach((m) => {
        const dayLabel = cfg.uniform ? `Day ${m.day}` : `Day ${m.day} (${fmt(m.hours)} h)`;
        const body = m.segs.length
          ? m.segs.map((s) => segmentText(s, course, nums, cfg)).join('; ')
          : G(I('Open / review'));
        rtf += P(720, `${dayLabel}: ${body}`);
      });
      week.takeHome.forEach((mod) => {
        const w = parseFloat(mod.weightPercent) ? ` (${mod.weightPercent}%)` : '';
        rtf += P(720, `${G('Due this week:')} ${B(escapeRtf(mod.title || mod.label))}${escapeRtf(w)}`);
      });
    });

    if (sched.overflow.length) {
      rtf += blank();
      rtf += P(360, `\\cf3\\b Not yet scheduled \\endash  exceeds the ${fmt(cfg.capacityHours)} available lecture hours by ${fmt(sched.overByHours)} h:\\b0\\cf1`, '\\keepn');
      mergePieces(sched.overflow).forEach((s) => {
        const label = s.kind === 'exam' ? `[EXAM] ${s.title}` : s.title;
        const mod = nums[s.moduleId] ? ` [Module ${nums[s.moduleId]}]` : '';
        rtf += bullet(720, `\\cf3 ${escapeRtf(label + mod)} (${fmt(s.hours)} h)\\cf1`);
      });
    }
    if (sched.unreachedOptional.length) {
      rtf += blank();
      rtf += P(360, `\\cf2\\b Time permitting (covered if the schedule allows):\\b0\\cf1`, '\\keepn');
      mergePieces(sched.unreachedOptional).forEach((s) => {
        const mod = nums[s.moduleId] ? ` [Module ${nums[s.moduleId]}]` : '';
        rtf += bullet(720, `\\cf2 ${escapeRtf(s.title + mod)} (${fmt(s.hours)} h)\\cf1`);
      });
    }
    return rtf;
  }

  // ---------------- evaluation section ----------------
  function buildEvaluationRtf(course, sched) {
    const notes = course.assessmentNotes || {};
    const categories = new Map();
    const cat = (label) => {
      if (!categories.has(label)) categories.set(label, { total: 0, items: [] });
      return categories.get(label);
    };

    (course.modules || []).forEach((mod) => {
      if (mod.isExam) {
        const label = (mod.label || 'Assessment').trim();
        const w = parseFloat(mod.weightPercent ?? mod.weight) || 0;
        const c = cat(label);
        c.total += w;
        const week = sched.assessmentWeek[mod.id];
        let when = pick(mod.scheduleNote);
        if (!when) {
          if (week) when = `Week ${week}`;
          else if (!mod.isTakeHome) when = `Not yet scheduled (beyond Week ${sched.config.weeks})`;
        }
        c.items.push({
          title: mod.title || label,
          weight: w,
          mode: mod.isTakeHome ? 'Take-Home' : 'In-Person',
          scope: pick(mod.scopeNote, resolveScope(course, mod.coveredModuleIds || mod.coveredModules)),
          when,
          warn: !mod.scheduleNote && !week && !mod.isTakeHome,
        });
      } else if (mod.isLab) {
        const label = (mod.label || 'Laboratory').trim();
        const c = cat(label);
        const labs = Array.isArray(mod.labs) ? mod.labs : [];
        if (labs.length) {
          labs.forEach((lab) => {
            const w = parseFloat(lab.weightPercent ?? lab.weight) || 0;
            c.total += w;
            c.items.push({ title: lab.title || 'Lab Experiment', weight: w, mode: 'In-Person', scope: '', when: pick(lab.scheduleNote) });
          });
        } else {
          const w = parseFloat(mod.weightPercent) || 0;
          c.total += w;
          c.items.push({ title: mod.title || 'Laboratory Section', weight: w, mode: 'In-Person', scope: '', when: '' });
        }
      }
    });

    const ws = window.Scheduler.weightSummary(course);
    let rtf = P(360, '\\b 3.1 Allocation of Marks:\\b0');

    categories.forEach((c, label) => {
      const total = Math.round(c.total * 100) / 100;
      rtf += P(360, `\\b\\fs24 ${escapeRtf(label)}${total ? ` (${fmt(total)}%)` : ''}\\b0\\fs22`, '\\sb120\\keepn');
      if (notes[label]) rtf += P(360, escapeRtf(notes[label]));
      c.items.forEach((it) => {
        const w = it.weight ? `: ${fmt(it.weight)}%` : '';
        rtf += bullet(720, `${B(escapeRtf(it.title))}${escapeRtf(w)} ${G(`(${it.mode})`)}`);
        if (it.scope) rtf += P(1080, `\\i\\cf2 Scope: ${escapeRtf(it.scope)}\\cf1\\i0`);
        if (it.when) rtf += P(1080, `\\i${it.warn ? '\\cf3' : '\\cf2'} Scheduled: ${escapeRtf(it.when)}\\cf1\\i0`);
      });
    });

    if (ws.hasFinal && ws.finalExam > 0) {
      rtf += P(360, `\\b\\fs24 Final Examination (${fmt(ws.finalExam)}%)\\b0\\fs22`, '\\sb120\\keepn');
      if (notes['Final Examination']) rtf += P(360, escapeRtf(notes['Final Examination']));
      rtf += bullet(720, `${B('Comprehensive Final Exam')}: ${fmt(ws.finalExam)}% ${G('(In-Person)')}`);
      rtf += P(1080, '\\i\\cf2 Scheduled: By University Registrar during examination period\\cf1\\i0');
    }
    if (ws.isOver) {
      rtf += P(360, `\\cf3\\b Note:\\b0  assessment weights total ${fmt(ws.defined)}%, which is over 100%.\\cf1`, '\\sb120');
    } else if (ws.isShort) {
      rtf += P(360, `\\cf3\\b Note:\\b0  assessment weights total ${fmt(ws.defined)}% and this course has no final exam.\\cf1`, '\\sb120');
    }
    return rtf;
  }

  // ---------------- modules section ----------------
  function buildModulesRtf(course, connections, sched) {
    const cfg = sched.config;
    const S = window.Scheduler;
    const unit = (n) => (cfg.allOneHour ? (n === 1 ? 'lecture' : 'lectures') : (n === 1 ? 'hour' : 'hours'));
    const nums = teachingNumbers(course);
    let rtf = heading('4. Course Modules & Detailed Topics');

    (course.modules || []).forEach((mod) => {
      if (mod.isExam || mod.isLab) return;
      const k = nums[mod.id];
      const hrs = S.moduleHours(mod);
      let title = mod.title || mod.label || `Module ${k}`;
      if (S.isTimePermitting(mod) && !/time permitting/i.test(title)) title += ' (Time Permitting)';

      rtf += P(360, `\\b\\fs24 4.${k} Module ${k}: ${escapeRtf(title)} [${fmt(hrs)} ${unit(hrs)}]\\b0\\fs22`, '\\sb200\\keepn');
      if (mod.chapter) rtf += P(360, `\\cf2 Reading Reference: Chapter ${escapeRtf(mod.chapter)}\\cf1`);

      const topics = Array.isArray(mod.topics) ? mod.topics : [];
      if (!topics.length) {
        rtf += P(720, escapeRtf(mod.description || 'Core topics and competencies for this unit.'));
      }
      topics.forEach((topic, tIdx) => {
        const t = typeof topic === 'string' ? { title: topic } : topic;
        const th = S.topicHours(t);
        rtf += P(720, `${B(`Topic 4.${k}.${tIdx + 1}: ${escapeRtf(t.title || t.name || '')}`)} ${G(`(${fmt(th)} ${unit(th)})`)}`, '\\sb120\\keepn');
        if (t.description) rtf += P(1080, `\\i ${escapeRtf(t.description)}\\i0`);

        const objs = (t.learningObjectives || t.objectives || [])
          .map((o) => (typeof o === 'string' ? o : (o.text || o.title || '')))
          .filter((o) => o && o.trim());
        if (objs.length) {
          rtf += P(1080, '\\b Learning Objectives:\\b0', '\\keepn');
          objs.forEach((o) => { rtf += P(1440, `\\cf2 - ${escapeRtf(o)}\\cf1`); });
        }
        const qs = (t.textbookQuestions || t.questions || [])
          .map((q) => (typeof q === 'string' ? q : (q.text || q.title || '')))
          .filter((q) => q && q.trim());
        if (qs.length) {
          rtf += P(1080, '\\b Recommended Practice Questions:\\b0', '\\keepn');
          qs.forEach((q) => { rtf += P(1440, `\\cf2 - ${escapeRtf(q)}\\cf1`); });
        }
      });

      rtf += buildConnectionsRtf(course, mod, connections);
    });
    return rtf;
  }

  /** "Builds upon" vs "Leads to" is decided by course year, not by click order. */
  function buildConnectionsRtf(course, mod, connections) {
    const mine = (connections || []).filter((c) => c.from === mod.id || c.to === mod.id);
    if (!mine.length) return '';

    const buildsUpon = [];
    const leadsTo = [];
    mine.forEach((conn) => {
      const otherId = conn.from === mod.id ? conn.to : conn.from;
      const hit = findModuleAnywhere(otherId);
      const otherCourse = hit ? hit.course : allCourses().find((c) => c.id === otherId);
      const myYear = Number(course.year) || 0;
      const otherYear = otherCourse ? Number(otherCourse.year) || 0 : myYear;
      let earlier;
      if (otherYear !== myYear) earlier = otherYear < myYear;
      else earlier = conn.to === mod.id;
      const text = otherCourse
        ? `${otherCourse.code} (${hit ? (hit.module.title || hit.module.label) : otherCourse.name})`
        : String(otherId);
      (earlier ? buildsUpon : leadsTo).push({ conn, text });
    });

    const line = ({ conn, text }) => {
      const tag = pedagogicalTag(conn);
      const note = conn.note && conn.note !== 'Created via Connect Mode' ? ` \\endash  ${escapeRtf(conn.note)}` : '';
      return P(1440, G(`- ${tag ? `[${escapeRtf(tag)}] ` : ''}${escapeRtf(text)}${note}`));
    };

    let rtf = P(720, '\\b Curriculum Connections:\\b0', '\\sb120\\keepn');
    if (buildsUpon.length) {
      rtf += P(1080, '\\b\\cf2 Prior Foundations (Builds Upon):\\b0\\cf1', '\\keepn');
      buildsUpon.forEach((x) => { rtf += line(x); });
    }
    if (leadsTo.length) {
      rtf += P(1080, '\\b\\cf2 Target Applications (Leads To):\\b0\\cf1', '\\keepn');
      leadsTo.forEach((x) => { rtf += line(x); });
    }
    return rtf;
  }

  // ---------------- one course ----------------
  function buildCourseRtfContent(course, connections) {
    const g = globals();
    const S = window.Scheduler;
    const sched = S.build(course);
    const labHrs = S.labHours(course);
    let rtf = '';

    // Title
    rtf += `\\pard\\qc\\sa120\\b\\fs36 ${escapeRtf(course.code)}: ${escapeRtf(course.name)}\\b0\\fs22\\par\n`;
    if (course.credits) {
      rtf += `\\pard\\qc\\cf2\\fs20 (${escapeRtf(course.credits)} credit hours)\\cf1\\fs22\\par\n`;
    }

    // Instructor block
    rtf += heading('Course & Instructor Information');
    const inst = typeof course.instructor === 'string' ? { name: course.instructor } : (course.instructor || {});
    const row = (label, value) => P(360, `\\b ${label}:\\b0  ${escapeRtf(value)}`);
    rtf += row('Instructor Name', pick(inst.name, g.instructorName, 'TBD'));
    rtf += row('Instructor Email', pick(inst.email, g.instructorEmail, 'TBD'));
    rtf += row('Office Location', pick(inst.office, g.instructorOffice, 'TBD'));
    rtf += row('Instructor Availability / Consultation Hours', pick(inst.officeHours, course.officeHours, g.officeHours, 'TBD / By Appointment'));
    rtf += row('Required Prerequisites', pick(course.prerequisites, course.prereqs, 'None'));
    rtf += row('Required Co-requisites', pick(course.corequisites, course.coreqs, 'None'));

    // 1. Textbooks
    rtf += heading('1. Textbooks & Course Resources');
    let books = Array.isArray(course.textbooks) ? course.textbooks : [];
    if (!books.length && course.textbook) {
      books = typeof course.textbook === 'string' ? [{ title: course.textbook, isRequired: true }] : [course.textbook];
    }
    const bookLine = (tb, boldTitle) => {
      const title = escapeRtf(tb.title || 'Untitled');
      const by = tb.author ? ` by ${escapeRtf(tb.author)}` : '';
      const isbn = (tb.isbn || tb.edition) ? ` (${escapeRtf(tb.isbn || tb.edition)})` : '';
      return boldTitle ? `${B(title)}${by}${isbn}` : `${title}${by}${isbn}`;
    };
    const req = books.filter((b) => b.isRequired !== false);
    const rec = books.filter((b) => b.isRequired === false);
    if (req.length) {
      rtf += P(360, '\\b Required Textbooks:\\b0', '\\keepn');
      req.forEach((b) => { rtf += bullet(720, bookLine(b, true)); });
    }
    if (rec.length) {
      rtf += P(360, '\\b Supplementary / Recommended Readings:\\b0', '\\keepn');
      rec.forEach((b) => { rtf += bullet(720, bookLine(b, false)); });
    }
    if (!books.length) rtf += P(360, '\\i No required textbooks for this course.\\i0');
    if (course.software) rtf += P(360, `\\b Required Software/Tools:\\b0  ${escapeRtf(course.software)}`);
    if (course.otherResources) rtf += P(360, `\\b Other Resources:\\b0  ${escapeRtf(course.otherResources)}`);

    // 2. Schedule
    rtf += buildScheduleRtf(course, sched, labHrs);

    // 3. Evaluation
    rtf += heading('3. Method of Evaluation & Grading System');
    rtf += buildEvaluationRtf(course, sched);
    rtf += P(360, `\\b 3.2 Grading System:\\b0  ${escapeRtf(pick(course.gradingSystem, g.gradingSystem))}`, '\\sb200');
    rtf += P(360, '\\b 3.3 Alternate Evaluation & Missed Work Policy:\\b0', '\\sb120\\keepn');
    rtf += P(720, escapeRtf(pick(course.missedWorkPolicy, course.alternateEvaluationPolicy, g.missedWorkPolicy)));

    // 4. Modules
    rtf += buildModulesRtf(course, connections, sched);

    // 5. Lab
    rtf += heading('5. Laboratory Information & Safety');
    const lab = course.labInfo || course.lab;
    if (typeof lab === 'string' && lab.trim()) {
      rtf += P(360, escapeRtf(lab));
    } else if (lab && typeof lab === 'object') {
      if (lab.schedule) rtf += P(360, `\\b Schedule/Format:\\b0  ${escapeRtf(lab.schedule)}`);
      if (lab.location) rtf += P(360, `\\b Location:\\b0  ${escapeRtf(lab.location)}`);
      if (lab.safety) rtf += P(360, `\\b Safety & PPE:\\b0  ${escapeRtf(lab.safety)}`);
      if (lab.description) rtf += P(360, escapeRtf(lab.description));
    } else {
      rtf += P(360, `\\i ${escapeRtf(labHrs > 0 ? 'This information will be provided by your laboratory instructor.' : 'This course has no laboratory component.')}\\i0`);
    }

    // 6. AI policy
    rtf += heading('6. Use of Assistive Tools & Generative AI Policy');
    rtf += P(360, escapeRtf(pick(course.aiPolicy, g.aiPolicy, FALLBACK_AI_POLICY)));

    // 7. Additional
    rtf += heading('7. Additional Course Information');
    rtf += course.additionalInfo
      ? P(360, escapeRtf(course.additionalInfo))
      : P(360, '\\i\\cf2 [Notes on attendance, communication, late submissions, or supplementary resources]\\cf1\\i0');

    // 8. Policies
    rtf += heading('8. University Statements & Institutional Policies');
    rtf += P(360, `\\b 8.1 Academic Integrity:\\b0  ${escapeRtf(pick(course.academicIntegrity, g.academicIntegrity))}`, '\\sa120');
    rtf += P(360, `\\b 8.2 Student Accommodations:\\b0  ${escapeRtf(pick(course.accommodations, g.accommodations))}`, '\\sa120');
    rtf += P(360, `\\b 8.3 Student Privacy & Grade Notification (ATIPP):\\b0  ${escapeRtf(pick(course.privacyAtipp, g.privacyAtipp))}`);

    return rtf;
  }

  // ---------------- downloads ----------------
  function fileSafe(s) {
    return String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
  }

  function outlineFileName(course) {
    const g = globals();
    const term = course.term || g.term;
    const base = `${course.code}-${course.name}_--_Course_Outline`;
    return fileSafe(term ? `${term} - ${base}` : base) + '.rtf';
  }

  function triggerRtfDownload(rtfContent, fileName) {
    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCourseOutlineRTF(courseId) {
    const { course, connections } = window.getCourseById(courseId);
    if (!course) { alert('Course data not found.'); return; }
    const rtf = buildSingleCourseDocument(course, connections || []);
    triggerRtfDownload(rtf, outlineFileName(course));
  }

  function buildSingleCourseDocument(course, connections) {
    return docStart() + '\\sectd\n' + pageHeader(course, globals()) + buildCourseRtfContent(course, connections) + '}\n';
  }

  function downloadAllCourseOutlinesRTF() {
    const courses = (window.DATA && window.DATA.courses) || [];
    if (!courses.length) { alert('No course data found.'); return; }
    triggerRtfDownload(buildProgramDocument(courses, window.DATA.connections || []), 'Complete_Curriculum_Outlines.rtf');
  }

  function buildProgramDocument(courses, connections) {
    const S = window.Scheduler;
    const g = globals();
    let rtf = docStart() + '\\sectd\n';

    rtf += `\\pard\\qc\\sa240\\b\\fs36 Program Curriculum & Workload Summary\\b0\\fs22\\par\n`;

    let lec = 0;
    let lab = 0;
    const rows = [];
    const overCourses = [];
    courses.forEach((c) => {
      const sch = S.build(c);
      const lh = S.labHours(c);
      lec += sch.capacityHours;
      lab += lh;
      rows.push({ c, sch, lh });
      if (sch.isOver) overCourses.push({ c, sch });
    });

    rtf += heading('Aggregate Program Statistics');
    rtf += bullet(360, `\\b Total Courses:\\b0  ${courses.length}`);
    rtf += bullet(360, `\\b Total Program Lecture Hours:\\b0  ${fmt(lec)} hrs`);
    rtf += bullet(360, `\\b Total Program Laboratory Hours:\\b0  ${fmt(lab)} hrs`);
    rtf += bullet(360, `\\b Total Combined Contact Hours:\\b0  ${fmt(lec + lab)} hrs`);

    if (overCourses.length) {
      rtf += heading('Schedule Warnings');
      overCourses.forEach(({ c, sch }) => {
        rtf += bullet(360, `\\cf3\\b ${escapeRtf(c.code)}\\b0 : ${fmt(sch.requiredHours)} h of required content for ${fmt(sch.capacityHours)} h of class time (${fmt(sch.overByHours)} h over${sch.catchUpHours ? `, including ${fmt(sch.catchUpHours)} h of catch-up gaps` : ''}).\\cf1`);
      });
    }

    rtf += heading('Course-by-Course Hours Breakdown');
    rows.forEach(({ c, sch, lh }) => {
      rtf += P(360, `\\b ${escapeRtf(c.code)}: ${escapeRtf(c.name)}\\b0`, '\\keepn');
      rtf += P(720, `\\cf2 Lecture: ${fmt(sch.capacityHours)} hrs (${escapeRtf(sch.config.label)}, ${sch.config.weeks} wks) | Lab: ${fmt(lh)} hrs | Total contact: ${fmt(sch.capacityHours + lh)} hrs\\cf1`);
    });

    courses.forEach((course) => {
      rtf += '\\sect\\sectd\\sbkpage\n' + pageHeader(course, g) + buildCourseRtfContent(course, connections);
    });

    return rtf + '}\n';
  }

  // ---------------- exports ----------------
  window.escapeRtf = escapeRtf;
  window.buildCourseRtfContent = buildCourseRtfContent;
  window.buildSingleCourseDocument = buildSingleCourseDocument;
  window.buildProgramDocument = buildProgramDocument;
  window.downloadCourseOutlineRTF = downloadCourseOutlineRTF;
  window.downloadAllCourseOutlinesRTF = downloadAllCourseOutlinesRTF;
})();
