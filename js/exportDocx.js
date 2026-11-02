/* ============================================================
   js/exportDocx.js
   Word (.docx) course outlines: a one-page colourful "dashboard" for each
   course, then the full outline with real heading styles (navigation pane),
   headers/footers with page numbers, shaded tables and a grade donut chart.

   Uses the bundled docx library (js/vendor/docx.iife.js, MIT) so it still
   works offline in the browser. All scheduling comes from window.Scheduler,
   exactly like the calendar view and the RTF export.
   ============================================================ */

(function () {
  const D = () => window.docx;
  const X = () => window.ExportShared;
  const S = () => window.Scheduler;

  // ---------------- palette (matches the map) ----------------
  const C = {
    ink: '0F172A', mun: 'CC0033', grey: '64748B', mute: '94A3B8', line: 'CBD5E1', pale: 'F1F5F9', white: 'FFFFFF',
    accent: '2563EB', accentBg: 'DBEAFE', red: 'BE1E1E', amber: 'B45309',
    exam: '7E22CE', examFill: 'A855F7', examBg: 'F3E8FF',
    lab: '0E7490', labFill: '06B6D4', labBg: 'CFFAFE',
    sess: '047857', sessFill: '10B981', sessBg: 'D1FAE5',
    self: '4338CA', selfFill: '6366F1', selfBg: 'E0E7FF',
    I: 'FDE68A', R: '86EFAC', A: '93C5FD',
  };
  const MOD_COLORS = ['2563EB', 'F97316', 'E11D48', 'CA8A04', '65A30D', '0EA5E9', 'DB2777', '78716C'];
  const GRADE_COLORS = ['A855F7', '06B6D4', '2563EB', 'F97316', '10B981', 'E11D48', 'CA8A04', '64748B'];
  const FONT = 'Calibri';

  const PAGE_W = 12240; // US Letter, twips
  const PAGE_H = 15840;

  // ---------------- tiny builders ----------------
  function textRuns(text, o = {}) {
    // Two spaces in a row trigger grammar underlines in Word, so a run of spaces becomes one em space.
    const parts = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/ {2,}/g, '\u2003').split('\n');
    const out = [];
    parts.forEach((part, i) => {
      out.push(new (D().TextRun)({
        text: part, bold: o.b, italics: o.i, color: o.c, size: o.s, font: o.f || FONT,
        break: i > 0 ? 1 : undefined,
        shading: o.fill ? { type: D().ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
        allCaps: o.caps, characterSpacing: o.sp,
      }));
    });
    return out;
  }
  const t = (text, o) => textRuns(text, o);

  /** children: string | run | array of (string|run|array) */
  function norm(children) {
    if (children == null) return [];
    const arr = Array.isArray(children) ? children : [children];
    const out = [];
    arr.forEach((c) => {
      if (Array.isArray(c)) out.push(...norm(c));
      else if (typeof c === 'string') out.push(...textRuns(c));
      else out.push(c);
    });
    return out;
  }

  // Numbering for headings is linked to the heading styles themselves. Courses after the first in a
  // combined file get their own list instance so numbering restarts at 1 for each course.
  let CUR_INST = 0; let PLAIN_H1 = false;
  // While a module's paragraphs are being built, each one carries the module's colour bar so it runs the whole length of the module.
  let MOD_COLOR = null;
  const modBorder = () => ({ left: { style: D().BorderStyle.SINGLE, size: 36, color: MOD_COLOR, space: 8 } });
  const HEAD_LVL = { Heading1: 0, Heading2: 1, Heading3: 2 };
  const headNum = (st) => (CUR_INST > 0 && st in HEAD_LVL ? { reference: 'heads', level: HEAD_LVL[st], instance: CUR_INST } : undefined);

  function para(children, o = {}) {
    const d = D();
    return new d.Paragraph({
      children: norm(children),
      style: o.bullet !== undefined ? (o.bullet ? 'ListBullet2' : 'ListBullet') : o.style,
      alignment: o.align,
      spacing: { before: o.before ?? 0, after: o.after ?? 60, line: o.line, lineRule: o.line ? (o.exactLine ? D().LineRuleType.EXACT : D().LineRuleType.AUTO) : undefined },
      indent: MOD_COLOR ? (o.bullet !== undefined ? { left: 620, hanging: 260 } : { left: 360 }) : (o.indent !== undefined ? (typeof o.indent === 'number' ? { left: o.indent } : o.indent) : undefined),
      keepNext: o.keepNext,
      keepLines: o.keepLines,
      pageBreakBefore: o.pageBreakBefore,
      shading: o.fill ? { type: d.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
      border: MOD_COLOR && !o.border ? modBorder() : o.border,
      numbering: headNum(o.style),
      tabStops: o.tabs,
    });
  }

  const NONE = { style: 'none', size: 0, color: 'FFFFFF' };
  const NO_BORDERS = () => { const d = D(); const n = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }; return { top: n, bottom: n, left: n, right: n }; };
  const lineB = (color = C.line, size = 4) => ({ style: D().BorderStyle.SINGLE, size, color });

  function cell(children, o = {}) {
    const d = D();
    return new d.TableCell({
      children: (() => { const k = (Array.isArray(children) ? children : [children]).flat().filter(Boolean); return k.length ? k : [para('')]; })(),
      width: { size: o.w, type: d.WidthType.DXA },
      shading: o.fill ? { type: d.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
      borders: o.borders || NO_BORDERS(),
      margins: o.margins || { top: 50, bottom: 50, left: 100, right: 100 },
      verticalAlign: o.v || d.VerticalAlign.TOP,
      columnSpan: o.span,
      verticalMerge: o.vmerge,
    });
  }

  function table(rows, widths, o = {}) {
    const d = D();
    return new d.Table({
      width: { size: widths.reduce((a, b) => a + b, 0), type: d.WidthType.DXA },
      columnWidths: widths,
      rows,
      borders: o.borders || { top: NONE_B(), bottom: NONE_B(), left: NONE_B(), right: NONE_B(), insideHorizontal: NONE_B(), insideVertical: NONE_B() },
      layout: d.TableLayoutType.FIXED,
      alignment: o.align,
    });
  }
  function NONE_B() { return { style: D().BorderStyle.NONE, size: 0, color: 'FFFFFF' }; }
  const row = (cells, o = {}) => new (D().TableRow)({
    children: cells,
    cantSplit: o.cantSplit !== false,
    tableHeader: o.header,
    height: o.h ? { value: o.h, rule: o.exact ? D().HeightRule.EXACT : D().HeightRule.ATLEAST } : undefined,
  });
  const spacer = (after = 120) => para('', { after, line: 120, exactLine: true });

  const hex = (n) => MOD_COLORS[(n - 1 + MOD_COLORS.length * 10) % MOD_COLORS.length];

  // headings (real Word heading styles, so the Navigation Pane works)
  const H1 = (text, o = {}) => para(t(text), { style: (o.plain || PLAIN_H1) ? 'Heading1Plain' : 'Heading1', keepNext: true, before: o.before, pageBreakBefore: o.pageBreakBefore });
  const H2 = (text, color) => new (D().Paragraph)({
    children: textRuns(text),
    style: 'Heading2', keepNext: true, numbering: headNum('Heading2'),
    border: color ? { left: { style: D().BorderStyle.SINGLE, size: 36, color, space: 8 } } : undefined,
    indent: color ? { left: 360 } : undefined,
    spacing: color ? { before: 0, after: 80 } : undefined,
  });
  const H3 = (text, o = {}) => para(t(text), { style: 'Heading3', keepNext: true, indent: o.indent });
  const body = (text, o = {}) => para(typeof text === 'string' ? t(text, o.run) : text, { after: o.after ?? 80, indent: o.indent, keepNext: o.keepNext, fill: o.fill });
  const bullet = (children, level = 0) => para(children, { bullet: level, after: 40 });

  // ---------------- chart: grade donut (PNG via canvas) ----------------
  function donutPng(slices, centerTop, centerBottom) {
    const size = 520;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2; const cy = size / 2;
    const R0 = 205; const R1 = 120; const OUT = 30;
    const total = slices.reduce((s, x) => s + x.value, 0);
    if (total <= 0) {
      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.arc(cx, cy, R1, Math.PI * 2, 0, true);
      ctx.fillStyle = '#E2E8F0'; ctx.fill();
    } else {
      let a = -Math.PI / 2;
      slices.forEach((sl) => {
        const sweep = (sl.value / total) * Math.PI * 2;
        const mid = a + sweep / 2;
        const ox = sl.explode ? Math.cos(mid) * OUT : 0; const oy = sl.explode ? Math.sin(mid) * OUT : 0;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, R0, a, a + sweep);
        ctx.arc(cx + ox, cy + oy, R1, a + sweep, a, true);
        ctx.closePath();
        ctx.fillStyle = '#' + sl.color;
        ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
        if (sl.value / total >= 0.04) {
          const rm = (R0 + R1) / 2;
          ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = 'bold 28px Arial, Helvetica, sans-serif';
          ctx.fillText(`${Math.round(sl.value * 10) / 10}`, cx + ox + Math.cos(mid) * rm, cy + oy + Math.sin(mid) * rm);
        }
        a += sweep;
      });
    }
    ctx.fillStyle = '#0F172A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 74px Arial, Helvetica, sans-serif';
    ctx.fillText(centerTop, cx, cy - 14);
    ctx.fillStyle = '#64748B';
    ctx.font = '30px Arial, Helvetica, sans-serif';
    ctx.fillText(centerBottom, cx, cy + 42);
    const b64 = cv.toDataURL('image/png').split(',')[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  const mix = (hexc, k) => { const n = parseInt(hexc, 16); const m = (sh) => Math.round(((n >> sh) & 255) * (1 - k) + 255 * k).toString(16).padStart(2, '0'); return (m(16) + m(8) + m(0)).toUpperCase(); };
  const inkOn = (hexc) => { const n = parseInt(hexc, 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 165 ? C.ink : C.white; };
  /** A colour swatch that does not depend on any font (a shaded em space). */
  const swatch = (color) => new (D().TextRun)({ text: '\u2003', shading: { type: D().ShadingType.CLEAR, fill: color, color: 'auto' }, font: FONT, size: 18 });

  /** One colour scheme for every assessment: category colour from the donut, shaded per item. */
  let CUR_ITEM_COLOR = new Map();
  function gradePlan(ev) {
    const slices = []; const legend = []; const itemColor = new Map(); const catColor = new Map();
    let gi = 0;
    const addCat = (label, items, explode) => {
      const its = items.filter((it) => it.weight > 0);
      const color = GRADE_COLORS[(its.length ? gi++ : gi) % GRADE_COLORS.length];
      catColor.set(label, color);
      items.forEach((it) => { if (it.key !== undefined) itemColor.set(it.key, color); });
      its.forEach((it, i) => {
        const c2 = mix(color, its.length > 1 ? Math.min(0.5, (i % 4) * 0.17) : 0);
        if (it.key !== undefined) itemColor.set(it.key, c2);
        slices.push({ label: it.title, value: it.weight, color: c2, explode });
      });
      const total = its.reduce((a2, it) => a2 + it.weight, 0);
      if (total > 0) legend.push({ label, total, color, items: its });
    };
    ev.categories.forEach((cat, label) => addCat(label, cat.items, true));
    if (ev.ws.hasFinal && ev.ws.finalExam > 0) addCat('Final examination', [{ title: 'Final examination', weight: ev.ws.finalExam }], false);
    return { slices, legend, itemColor, catColor };
  }

  // ---------------- course facts shared by dashboard + outline ----------------
  function courseFacts(course) {
    const x = X(); const s = S();
    const sched = s.build(course);
    const nums = x.teachingNumbers(course);
    const inst = typeof course.instructor === 'string' ? { name: course.instructor } : (course.instructor || {});
    const g = x.globals();
    const ev = x.collectEvaluation(course, sched);
    const notTaught = new Set((sched.electiveGroups || []).flatMap((gr) => gr.notTaught.map((m) => m.id)));
    const teaching = (course.modules || []).filter((m) => !m.isExam && !m.isLab && !m.isSession && !notTaught.has(m.id));
    const topicCount = teaching.reduce((n, m) => n + (m.topics || []).length, 0);
    const plan = S().labPlan(course, sched);
    const gp = gradePlan(ev);
    CUR_ITEM_COLOR = gp.itemColor;
    return { course, sched, nums, inst, g, ev, teaching, topicCount, plan, gp, labHrs: s.labHours(course), notTaught,
      term: [course.term || g.term, course.version || g.version].filter(Boolean).join(' · ') };
  }

  /** Other courses this one builds on / leads to (course links and module links, de-duplicated). */
  const STRENGTH = {
    strong: { label: 'Essential', color: 'DC2626', rank: 3 },
    related: { label: 'Related', color: '2563EB', rank: 2 },
    weak: { label: 'Background', color: '0F9F6E', rank: 1 },
  };
  const strengthOf = (conn) => { const k = String(conn.strength || conn.level || 'related').toLowerCase(); return STRENGTH[k] ? k : 'related'; };

  /**
   * Other courses this one builds on / leads to. Each group is one course: `whole` is set when the course itself is
   * linked, and `modules` lists the specific modules linked, each with how strong the connection is.
   */
  function relatedCourses(course, connections) {
    const x = X();
    const myIds = new Set([course.id, ...(course.modules || []).map((m) => m.id)]);
    const groups = new Map();
    (connections || []).forEach((conn) => {
      const fromMine = myIds.has(conn.from); const toMine = myIds.has(conn.to);
      if (fromMine === toMine) return;
      const otherId = fromMine ? conn.to : conn.from;
      const wholeCourse = x.allCourses().find((cc) => cc.id === otherId);
      const hit = wholeCourse ? null : x.findModuleAnywhere(otherId);
      const other = wholeCourse || (hit && hit.course);
      if (!other || other.id === course.id) return;
      const myYear = Number(course.year) || 0; const otherYear = Number(other.year) || 0;
      const earlier = otherYear !== myYear ? otherYear < myYear : toMine;
      const st = strengthOf(conn);
      const key = `${earlier ? 'e' : 'l'}|${other.id}`;
      if (!groups.has(key)) groups.set(key, { other, earlier, whole: null, modules: new Map(), best: 'weak' });
      const g = groups.get(key);
      const keep = (cur) => (!cur || STRENGTH[st].rank > STRENGTH[cur.strength].rank ? { strength: st, note: conn.note } : cur);
      if (wholeCourse) g.whole = keep(g.whole);
      else g.modules.set(otherId, { ...keep(g.modules.get(otherId)), module: hit.module });
      if (STRENGTH[st].rank > STRENGTH[g.best].rank) g.best = st;
    });
    const all = [...groups.values()].map((g) => ({ ...g, strength: g.best, modules: [...g.modules.values()].sort((a, b) => STRENGTH[b.strength].rank - STRENGTH[a.strength].rank) }))
      .sort((a, b) => STRENGTH[b.best].rank - STRENGTH[a.best].rank || String(a.other.code).localeCompare(String(b.other.code)));
    return { buildsOn: all.filter((r) => r.earlier), leadsTo: all.filter((r) => !r.earlier) };
  }

  /** Items for one Builds on / Leads to list, grouped by connection strength (Essential first). */
  function relLines(list, cap) {
    const x = X(); const tiers = { strong: [], related: [], weak: [] };
    list.forEach((r) => {
      const nums = x.teachingNumbers(r.other);
      if (r.whole) tiers[r.whole.strength].push({ course: r.other, whole: true });
      r.modules.forEach((m) => {
        const k = nums[m.module.id];
        const title = m.module.title || m.module.label || '';
        tiers[m.strength].push({ course: r.other, text: `${k ? `Module ${k}: ` : (m.module.label ? m.module.label + ': ' : '')}${title}` });
      });
    });
    let left = cap; const out = []; let total = 0;
    ['strong', 'related', 'weak'].forEach((st) => {
      total += tiers[st].length;
      const items = tiers[st].slice(0, Math.max(0, left)); left -= items.length;
      if (items.length) out.push({ st, items });
    });
    const shown = out.reduce((n, g) => n + g.items.length, 0);
    return { tiers: out, shown: Array(shown).fill(0), more: total - shown };
  }
  const strengthPill = (st, sz = 13) => new (D().TextRun)({ text: `\u00A0${STRENGTH[st].label}\u00A0`, size: sz, bold: true, color: C.white, font: FONT, shading: { type: D().ShadingType.CLEAR, fill: STRENGTH[st].color, color: 'auto' } });

  /** Outcomes this course touches, with highest level: [{code,title,level,derived}] */
  function courseOutcomes(course) {
    const O = window.Outcomes;
    if (!O) return [];
    const outcomes = O.getOutcomes();
    if (!outcomes.length) return [];
    const m = O.buildMatrix([course], outcomes, { showArchived: false });
    return m.rows.filter((r) => m.cells[r.o.id] && m.cells[r.o.id][course.id])
      .map((r) => ({ code: r.code, title: r.o.title, depth: r.depth, level: m.cells[r.o.id][course.id].level, derived: m.cells[r.o.id][course.id].derived }));
  }

  // ---------------- page 1: the dashboard ----------------
  function buildDashboard(course, connections) {
    const d = D(); const s = S(); const x = X();
    const f = courseFacts(course);
    const { sched, nums, inst } = f;
    const cfg = sched.config;
    const W = 10512; // text width with 0.6in margins
    const blocks = [];

    // --- banner ---
    const subtitle = [inst.name ? `Instructor: ${inst.name}` : '', course.year !== undefined && course.yearLabel ? course.yearLabel : '', course.credits ? `${course.credits} credit hours` : ''].filter(Boolean).join('   ·   ');
    blocks.push(table([row([cell([
      para(t(`COURSE OUTLINE${f.term ? '   ·   ' + f.term : ''}`, { s: 18, c: 'FECDD3', b: true, sp: 30 }), { after: 40 }),
      para(t(course.code || '', { s: 68, c: C.white, b: true }), { after: 0, line: 240 }),
      para(t(course.name || '', { s: 40, c: 'FFE4E6' }), { after: 60 }),
      subtitle ? para(t(subtitle, { s: 20, c: 'FECDD3' }), { after: 0 }) : para(''),
    ], { w: W, fill: C.mun, margins: { top: 150, bottom: 130, left: 280, right: 280 } })], { cantSplit: true })], [W]));
    blocks.push(spacer(100));

    // --- stat tiles ---
    const nTiles = 5; const tileW = Math.floor(W / nTiles);
    const patternText = cfg.uniform ? `${cfg.pattern.length} × ${cfg.minutes[0]} min` : cfg.pattern.map((h) => s.formatHours(h) + ' h').join(' + ');
    const nAssess = (course.modules || []).filter((m) => m.isExam).length + (f.ev.ws.hasFinal && f.ev.ws.finalExam > 0 ? 1 : 0);
    const tiles = [
      { big: s.formatHours(cfg.capacityHours), label: 'LECTURE HOURS', color: C.accent },
      { big: String(cfg.weeks), label: 'WEEKS', color: 'F97316' },
      { big: patternText, label: 'CLASSES PER WEEK', color: C.sessFill, small: true },
      { big: String(f.topicCount), label: `TOPICS IN ${f.teaching.length} MODULE${f.teaching.length === 1 ? '' : 'S'}`, color: 'E11D48' },
      f.labHrs > 0
        ? { big: s.formatHours(f.labHrs), label: 'LAB HOURS', color: C.labFill }
        : { big: String(nAssess), label: `ASSESSMENT${nAssess === 1 ? '' : 'S'}`, color: C.examFill },
    ];
    blocks.push(table([row(tiles.map((tl, i) => cell([
      para(t(tl.big, { s: tl.small ? 36 : 56, b: true, c: tl.color }), { after: 0, align: d.AlignmentType.CENTER, line: 240 }),
      para(t(tl.label, { s: 15, b: true, c: C.grey, sp: 20 }), { after: 0, align: d.AlignmentType.CENTER }),
    ], {
      w: tileW, fill: C.pale, v: d.VerticalAlign.CENTER,
      borders: { top: { style: d.BorderStyle.SINGLE, size: 24, color: tl.color }, bottom: NONE_B(), left: { style: d.BorderStyle.SINGLE, size: 12, color: C.white }, right: { style: d.BorderStyle.SINGLE, size: 12, color: C.white } },
      margins: { top: 100, bottom: 100, left: 60, right: 60 },
    })), { h: 880 })], tiles.map(() => tileW)));
    blocks.push(spacer(120));

    // --- grade donut + module list ---
    const { slices, legend } = f.gp;
    const sum = slices.reduce((a, b) => a + b.value, 0);
    const leftW = 4300; const rightW = W - leftW;

    const donutCell = [para(t('HOW YOU ARE GRADED', { s: 17, b: true, c: C.accent, sp: 30 }), { after: 60 })];
    if (slices.length) {
      donutCell.push(para([new d.ImageRun({
        type: 'png', data: donutPng(slices, `${s.formatHours(Math.round(sum * 10) / 10)}%`, 'of final grade'),
        transformation: { width: 160, height: 160 },
        altText: { title: 'Grade breakdown', description: 'Donut chart of the grade breakdown', name: 'grade-donut' },
      })], { after: 40, align: d.AlignmentType.CENTER }));
      legend.forEach((lg) => {
        donutCell.push(para([swatch(lg.color), ...t(` ${lg.label}`, { s: 19, b: true }), ...t(`\u2003${s.formatHours(Math.round(lg.total * 100) / 100)}%`, { s: 19, b: true, c: lg.color })], { before: 30, after: 10, indent: 120 }));
        const same = lg.items.every((it) => it.weight === lg.items[0].weight);
        if (lg.items.length === 1 && lg.items[0].title === lg.label) {
          if (lg.items[0].scope) donutCell.push(para(t(lg.items[0].scope, { s: 15, c: C.grey, i: true }), { after: 10, indent: 360 }));
          return;
        }
        if (lg.items.length > 3 && same) { donutCell.push(para(t(`${lg.items.length} \u00D7 ${s.formatHours(lg.items[0].weight)}%`, { s: 16, c: C.grey }), { after: 10, indent: 360 })); return; }
        lg.items.forEach((it) => {
          donutCell.push(para([...t(`${it.title}  ${s.formatHours(it.weight)}%`, { s: 16, c: C.grey }), ...(it.scope ? t(`  \u00B7  ${it.scope}`, { s: 15, c: C.mute, i: true }) : [])], { after: 10, indent: 360 }));
        });
      });
    } else {
      donutCell.push(para(t('Assessment weights have not been set for this course yet.', { i: true, c: C.grey, s: 19 })));
    }

    const midW = rightW - 160 - 160 - 640;
    const modRows = [];
    f.teaching.slice(0, 8).forEach((m) => {
      const n = nums[m.id];
      modRows.push(row([
        cell(para(''), { w: 160, fill: hex(n), margins: { top: 20, bottom: 20, left: 0, right: 0 } }),
        cell(para([...t(`M${n}  `, { b: true, s: 18, c: hex(n) }), ...t(m.title || m.label || `Module ${n}`, { s: 19 })], { after: 0 }), { w: midW, margins: { top: 40, bottom: 40, left: 120, right: 60 }, borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } }),
        cell(para(t(`${s.formatHours(s.moduleHours(m))} h`, { s: 18, b: true, c: C.grey }), { after: 0, align: d.AlignmentType.RIGHT }), { w: 640, margins: { top: 40, bottom: 40, left: 40, right: 60 }, borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } }),
      ], { h: 300 }));
    });
    if (f.teaching.length > 8) modRows.push(row([cell(para(''), { w: 160 }), cell(para(t(`+ ${f.teaching.length - 8} more modules`, { i: true, c: C.grey, s: 18 }), { after: 0 }), { w: midW }), cell(para(''), { w: 640 })]));
    const sessions = (course.modules || []).filter((m) => m.isSession);
    sessions.slice(0, 4).forEach((m) => {
      const T = s.SESSION_TYPES[s.sessionType(m)];
      modRows.push(row([
        cell(para(''), { w: 160, fill: C.sessFill, margins: { top: 20, bottom: 20, left: 0, right: 0 } }),
        cell(para([...t(`${m.label || T.label}  `, { b: true, s: 18, c: C.sess }), ...t(m.title || '', { s: 19 })], { after: 0 }), { w: midW, margins: { top: 40, bottom: 40, left: 120, right: 60 }, borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } }),
        cell(para(t(`${s.formatHours(s.sessionHours(m))} h`, { s: 18, b: true, c: C.grey }), { after: 0, align: d.AlignmentType.RIGHT }), { w: 640, margins: { top: 40, bottom: 40, left: 40, right: 60 }, borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } }),
      ], { h: 300 }));
    });
    const nSelf = (sched.selfDirected || []).length;
    const rightCell = [para(t('WHAT WE COVER', { s: 17, b: true, c: C.accent, sp: 30 }), { after: 60 })];
    if (modRows.length) rightCell.push(table(modRows, [160, midW, 640]), para('', { after: 0, line: 20, exactLine: true }));
    else rightCell.push(para(t('No modules yet.', { i: true, c: C.grey })));
    if (nSelf) rightCell.push(para([swatch(C.selfFill), ...t(` ${nSelf} self-directed topic${nSelf === 1 ? '' : 's'} (no class time)`, { s: 18, c: C.self })], { before: 60, after: 0 }));

    blocks.push(table([row([
      cell(donutCell, { w: leftW, margins: { top: 40, bottom: 40, left: 0, right: 160 } }),
      cell(rightCell, { w: rightW, margins: { top: 40, bottom: 40, left: 160, right: 0 }, borders: { ...NO_BORDERS(), left: lineB('E2E8F0', 6) } }),
    ])], [leftW, rightW]));
    blocks.push(spacer(100));

    const rel = relatedCourses(course, connections);
    const REL_CAP = 12;
    const relB = relLines(rel.buildsOn, REL_CAP); const relL = relLines(rel.leadsTo, REL_CAP);
    const relRows = Math.max(relB.shown.length + (relB.more ? 1 : 0), relL.shown.length + (relL.more ? 1 : 0));
    // --- term timeline: one row per module, assessments underneath ---
    blocks.push(para(t('TERM AT A GLANCE', { s: 17, b: true, c: C.accent, sp: 30 }), { after: 60, keepNext: true }));
    const nW = sched.weeks.length;
    const labW = 2500;
    const cw = Math.floor((W - labW) / nW);
    const widths = [labW, ...Array.from({ length: nW }, () => cw)];
    // Wide white gaps between the coloured blocks, so neighbours stay distinct in grey-scale or similar colours.
    const gap = (size) => ({ style: d.BorderStyle.SINGLE, size, color: C.white });
    const cb = { ...NO_BORDERS(), left: gap(18), right: gap(18), top: gap(8), bottom: gap(8) };
    const abbr = (title) => {
      const m = String(title || '').trim();
      const num = (m.match(/(\d+)\s*$/) || [])[1] || '';
      const map = [[/mid/i, 'Mid'], [/quiz/i, 'Quiz'], [/final/i, 'Final'], [/exam/i, 'Exam'], [/test/i, 'Test'], [/assign/i, 'Asn'], [/lab/i, 'Lab'], [/project/i, 'Proj'], [/report/i, 'Rpt']];
      const hit = map.find(([re]) => re.test(m));
      return (hit ? hit[1] : m.replace(/[^A-Za-z]/g, '').slice(0, 4)) + num;
    };
    const perWeek = sched.weeks.map((wk) => {
      const hours = {}; const exams = []; const sess = []; const keyBits = [];
      wk.meetings.forEach((m) => m.segs.forEach((sg) => {
        if (sg.kind === 'exam') { if (!exams.some((e) => e.title === sg.title)) { exams.push({ title: sg.title, date: m.dateLabel, color: f.gp.itemColor.get(sg.moduleId) || C.examFill }); } }
        else if (sg.kind === 'session') sess.push(sg.moduleLabel || (s.SESSION_TYPES[sg.sessionType] || {}).label || 'Session');
        else if (sg.kind === 'topic' || sg.kind === 'unassigned') hours[sg.moduleId] = (hours[sg.moduleId] || 0) + sg.hours;
      }));
      const wn = wk.weekNumber;
      return { wk, hours, exams, sess, due: wk.takeHome.map((mod) => ({ title: mod.title || mod.label || 'Due', color: f.gp.itemColor.get(mod.id) || '7C3AED' })), self: wk.selfDirected || [],
        labs: (f.plan.byWeek[wn] || []).map((x) => ({ text: x.entry.label.replace(/^Lab /, 'L') + (x.share < 100 ? '\u00BD' : ''), color: f.gp.itemColor.get(x.entry.lab) || C.labFill })),
        labDue: f.plan.labs.filter((e) => e.dueWeek === wn).map((e) => ({ text: e.label.replace(/^Lab /, 'L') + ' due', color: f.gp.itemColor.get(e.lab) || C.labFill })) };
    });
    const head = [cell(para('', { after: 0 }), { w: labW, borders: cb }), ...perWeek.map((p, i) => cell([
      para(t(String(p.wk.weekNumber), { s: 16, b: true, c: C.ink }), { after: 0, align: d.AlignmentType.CENTER }),
      ...(sched.hasDates && p.wk.startDate ? [para(t(s.formatDateLabel(p.wk.startDate, false), { s: 11, c: C.grey }), { after: 0, align: d.AlignmentType.CENTER })] : []),
    ], { w: cw, borders: cb, margins: { top: 10, bottom: 10, left: 0, right: 0 } }))];
    const tlRows = [row(head, { h: sched.hasDates ? 330 : 200 })];
    const nMarkers = [perWeek.some((p) => p.exams.length), perWeek.some((p) => p.labs.length), perWeek.some((p) => p.due.length || p.labDue.length), perWeek.some((p) => p.sess.length), perWeek.some((p) => p.self.length)].filter(Boolean).length;
    const maxMods = Math.max(5, 14 - nMarkers);
    f.teaching.slice(0, maxMods).forEach((m) => {
      const n = nums[m.id]; const color = hex(n);
      tlRows.push(row([
        cell(para([...t(`M${n}  `, { b: true, s: 14, c: color }), ...t((() => { const ti = m.title || m.label || ''; return ti.length > 30 ? ti.slice(0, 29).trim() + '\u2026' : ti; })(), { s: 14 })], { after: 0 }), { w: labW, borders: cb, margins: { top: 0, bottom: 0, left: 40, right: 40 }, v: d.VerticalAlign.CENTER }),
        ...perWeek.map((p) => {
          const h = p.hours[m.id];
          return cell(para(h ? t(s.formatHours(Math.round(h * 100) / 100), { s: 13, b: true, c: C.white }) : '', { after: 0, align: d.AlignmentType.CENTER }), { w: cw, fill: h ? color : 'F1F5F9', borders: cb, margins: { top: 0, bottom: 0, left: 0, right: 0 }, v: d.VerticalAlign.CENTER });
        }),
      ], { h: 215, exact: true }));
    });
    if (f.teaching.length > maxMods) tlRows.push(row([cell(para(t(`+ ${f.teaching.length - maxMods} more modules`, { i: true, s: 13, c: C.grey }), { after: 0 }), { w: W, span: nW + 1, borders: cb })]));
    // Every row has the same grey background; each item is a small block in its own colour.
    const markerRow = (label, pick) => {
      if (!perWeek.some((p) => pick(p).length)) return;
      tlRows.push(row([
        cell(para(t(label, { s: 14, b: true, c: C.grey }), { after: 0 }), { w: labW, borders: cb, margins: { top: 0, bottom: 0, left: 40, right: 40 }, v: d.VerticalAlign.CENTER }),
        ...perWeek.map((p) => {
          const items = pick(p);
          // One colour in the cell: fill the whole cell. Mixed colours: each item is a full-width shaded block.
          const same = items.length > 0 && items.every((x2) => x2.color === items[0].color);
          const kids = items.length ? items.map((x2) => para(t(x2.text, { s: 12, b: true, c: inkOn(x2.color) }), { after: same ? 0 : 10, align: d.AlignmentType.CENTER, fill: same ? undefined : x2.color })) : para('', { after: 0 });
          return cell(kids, { w: cw, fill: same ? items[0].color : 'F1F5F9', borders: cb, margins: { top: 10, bottom: 10, left: 0, right: 0 }, v: d.VerticalAlign.CENTER });
        }),
      ], { h: 260 }));
    };
    markerRow('In-class assessments', (p) => p.exams.map((e) => ({ text: abbr(e.title), color: e.color })));
    markerRow('Laboratory', (p) => p.labs);
    markerRow('Take-home / lab due', (p) => [...p.due.map((x2) => ({ text: abbr(x2.title), color: x2.color })), ...p.labDue]);
    markerRow('Review / guest / workshop', (p) => p.sess.map((x2) => ({ text: String(x2).split(/[\s-]+/)[0].slice(0, 8), color: C.sessFill })));
    markerRow('Self-directed topic', (p) => p.self.map(() => ({ text: 'SD', color: C.selfFill })));
    blocks.push(table(tlRows, widths));

    // key dates line
    const keyBits = [];
    perWeek.forEach((p) => {
      p.exams.forEach((e) => keyBits.push([`${e.title}`, `wk ${p.wk.weekNumber}${e.date ? ', ' + e.date : ''}`, e.color]));
      p.due.forEach((x2) => keyBits.push([`${x2.title} due`, `wk ${p.wk.weekNumber}`, x2.color]));
      f.plan.labs.filter((e) => e.dueWeek === p.wk.weekNumber).forEach((e) => keyBits.push([`${e.label} due`, `wk ${p.wk.weekNumber}${e.dueDate ? ', ' + s.formatDateLabel(e.dueDate) : ''}`, f.gp.itemColor.get(e.lab) || C.lab]));
    });
    if (keyBits.length) {
      const runs = [];
      keyBits.slice(0, 10).forEach(([name, when, color], i) => { runs.push(...t(i ? '    ·    ' : '', { c: C.mute, s: 15 }), ...t(name, { b: true, s: 15, c: color }), ...t(` ${when}`, { s: 15, c: C.grey })); });
      if (keyBits.length > 10) runs.push(...t(`    +${keyBits.length - 10} more`, { i: true, s: 15, c: C.grey }));
      blocks.push(para(runs, { before: 60, after: 100 }));
    } else blocks.push(spacer(100));

    // --- bottom row: builds on / leads to / outcomes ---
    const relCell = (title, lines, accent) => {
      const kids = [para(t(title, { s: 17, b: true, c: accent, sp: 30 }), { after: 60 })];
      if (!lines.tiers.length) kids.push(para(t('\u2014', { c: C.mute })));
      const clip = (txt, n) => (txt.length > n ? txt.slice(0, n - 1).trim() + '\u2026' : txt);
      lines.tiers.forEach((g) => {
        const stt = STRENGTH[g.st]; const tint = mix(stt.color, 0.9);
        kids.push(para(t(` ${stt.label.toUpperCase()}`, { s: 14, b: true, c: C.white, sp: 20 }), { after: 0, before: 50, fill: stt.color, keepNext: true }));
        g.items.forEach((it, i) => {
          const runs = it.whole
            ? [...t(` ${it.course.code}`, { b: true, s: 18 }), ...t(`  ${clip(it.course.name || '', 24)}`, { s: 16, c: C.grey })]
            : [...t(` ${it.course.code}`, { b: true, s: 16 }), ...t(`  ${clip(it.text, 30)}`, { s: 16 })];
          kids.push(para(runs, { after: 0, before: 0, fill: tint, keepNext: i < g.items.length - 1 }));
        });
      });
      if (lines.more) kids.push(para(t(`+ ${lines.more} more`, { i: true, c: C.grey, s: 16 }), { before: 40 }));
      return kids;
    };
    const outs = courseOutcomes(course);
    const outCell = [para(t('PROGRAM OUTCOMES', { s: 17, b: true, c: C.accent, sp: 30 }), { after: 60 })];
    if (!outs.length) outCell.push(para(t('Not tagged yet.', { i: true, c: C.mute, s: 18 })));
    outs.filter((o) => o.depth === 0).slice(0, 6).forEach((o) => {
      outCell.push(para([...t(` ${o.derived ? o.level.toLowerCase() : o.level} `, { b: true, s: 17, fill: C[o.level], c: C.ink }), ...t(`  ${o.code}  ${o.title}`, { s: 18 })], { after: 30 }));
    });
    if (outs.length) outCell.push(para(t('I introduced  ·  R reinforced  ·  A advanced', { c: C.mute, s: 14 }), { before: 20, after: 0 }));
    const bw = Math.floor(W / 3);
    const sep = { ...NO_BORDERS(), left: lineB('E2E8F0', 6) };
    blocks.push(table([row([
      cell(relCell('BUILDS ON', relB, C.accent), { w: bw, margins: { top: 40, bottom: 40, left: 0, right: 140 } }),
      cell(relCell('LEADS TO', relL, 'E11D48'), { w: bw, borders: sep, margins: { top: 40, bottom: 40, left: 160, right: 140 } }),
      cell(outCell, { w: W - 2 * bw, borders: sep, margins: { top: 40, bottom: 40, left: 160, right: 0 } }),
    ])], [bw, bw, W - 2 * bw]));

    // --- textbook footer ---
    const books = Array.isArray(course.textbooks) ? course.textbooks : (course.textbook ? [typeof course.textbook === 'string' ? { title: course.textbook } : course.textbook] : []);
    const req = books.filter((b) => b.isRequired !== false);
    if (req.length) {
      blocks.push(para([...t('TEXTBOOK  ', { s: 15, b: true, c: C.accent, sp: 30 }), ...t(req.map((b) => `${b.title || 'Untitled'}${b.author ? ' – ' + b.author : ''}`).join('   ·   '), { s: 18, c: C.grey })], { before: 120, after: 0, border: { top: { style: d.BorderStyle.SINGLE, size: 4, color: C.line, space: 6 } } }));
    }
    return blocks;
  }

  // =====================================================================
  //  Pages 2+: the full outline
  // =====================================================================
  const OW = 10080; // outline text width (0.75in margins)
  const unitWord = (cfg, n) => (cfg.allOneHour ? (n === 1 ? 'lecture' : 'lectures') : (n === 1 ? 'hour' : 'hours'));
  const fmt = (h) => S().formatHours(h);

  function segRuns(seg, nums, cfg, sz) {
    const t = (x, o = {}) => textRuns(x, { s: sz, ...o });
    const partial = seg.meeting && !seg.fillsClass;
    const unit = cfg.allOneHour ? 'Lec' : 'Part';
    const info = () => {
      if (seg.parts > 1) return ` (${unit} ${seg.part}/${seg.parts}${partial ? `, ${fmt(seg.hours)} h` : ''})`;
      if (partial) return ` (${fmt(seg.hours)} h)`;
      return '';
    };
    if (seg.kind === 'exam') return [...t('[EXAM] ', { b: true, c: CUR_ITEM_COLOR.get(seg.moduleId) || C.exam }), ...t(seg.title || '', { b: true }), ...t(info(), { c: C.grey })];
    if (seg.kind === 'buffer') return t(`Catch-up / review (${fmt(seg.hours)} h)`, { i: true, c: C.grey });
    if (seg.kind === 'session') {
      const T = S().SESSION_TYPES[seg.sessionType] || S().SESSION_TYPES.other;
      const head = seg.moduleLabel || T.label;
      const named = seg.title && seg.title !== seg.moduleLabel ? seg.title : '';
      return [...t(`${T.icon || ''} [${head.toUpperCase()}] `, { b: true, c: C.sess }), ...t(named), ...(seg.speaker ? t(` – ${seg.speaker}`, { c: C.grey }) : []), ...t(info(), { c: C.grey })];
    }
    const out = [...t(seg.title || '', { b: seg.kind !== 'unassigned' }), ...t(info(), { c: C.grey })];
    if (nums[seg.moduleId]) out.push(...t(` [Module ${nums[seg.moduleId]}]`, { c: hex(nums[seg.moduleId]), b: true, s: 18 }));
    if (seg.optional) out.push(...t(' (time permitting)', { i: true, c: C.grey }));
    return out;
  }

  function shortSegRuns(seg, nums) {
    if (seg.kind === 'exam') return t(`[EXAM] ${seg.title}`, { b: true, c: C.exam, s: 17 });
    if (seg.kind === 'buffer') return t('Catch-up', { i: true, c: C.grey, s: 17 });
    if (seg.kind === 'session') {
      const T = S().SESSION_TYPES[seg.sessionType] || S().SESSION_TYPES.other;
      return t(`${seg.moduleLabel || T.label}${seg.title && seg.title !== seg.moduleLabel ? ': ' + seg.title : ''}`, { b: true, c: C.sess, s: 17 });
    }
    return [...t(seg.title || '', { s: 17 }), ...(nums[seg.moduleId] ? t(` M${nums[seg.moduleId]}`, { b: true, c: hex(nums[seg.moduleId]), s: 15 }) : [])];
  }

  const hdrCell = (text, w, fill = C.ink, align) => cell(para(t(text, { b: true, c: C.white, s: 18 }), { after: 0, align }), { w, fill, v: D().VerticalAlign.CENTER });
  const gridBorders = () => ({ top: lineB(), bottom: lineB(), left: lineB(), right: lineB() });

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function calendarGrid(f) {
    const d = D(); const { course, sched, nums } = f; const cfg = sched.config; const s = S();
    const per = cfg.pattern.length; const first = 1300;
    const cw = Math.floor((OW - first) / per);
    const widths = [first, ...Array(per).fill(cw)];
    // With dates, each cell carries its own weekday/date, and a week can start mid-week, so columns stay "Class n".
    const named = !sched.hasDates && Array.isArray(course.classDays) && course.classDays.length === per;
    const days = named ? s.resolveClassDays(course, per).map((n) => DOW[n]) : [];
    const head = ['Week', ...cfg.pattern.map((h, i) => (named ? days[i] : `Class ${i + 1}`) + (cfg.uniform ? '' : ` (${fmt(h)} h)`))];
    const rows = [row(head.map((h, i) => hdrCell(h, i ? cw : first)), { header: true })];
    const span = (kids, fill) => row([cell(kids, { w: OW, span: per + 1, borders: gridBorders(), fill, margins: { top: 40, bottom: 40, left: 120, right: 100 } })]);
    sched.weeks.forEach((wk, wi) => {
      const fill = wi % 2 ? 'F8FAFC' : undefined;
      const range = wk.startDate ? (wk.endDate && wk.endDate !== wk.startDate ? `${s.formatDateLabel(wk.startDate, false)} \u2013 ${s.formatDateLabel(wk.endDate, false)}` : s.formatDateLabel(wk.startDate, false)) : '';
      const wcell = cell([para(t(`Week ${wk.weekNumber}`, { b: true, s: 20, c: C.accent }), { after: 0 }), ...(range ? [para(t(range, { s: 14, c: C.grey }), { after: 0 })] : [])], { w: first, fill: C.pale, borders: gridBorders() });
      const cells = [wcell];
      for (let i = 0; i < per; i++) {
        const m = wk.meetings[i];
        if (!m) { cells.push(cell(para(t('\u2014', { c: C.mute }), { after: 0 }), { w: cw, borders: gridBorders(), fill })); continue; }
        const kids = [];
        if (m.dateLabel) kids.push(para(t(m.dateLabel, { s: 14, c: C.grey }), { after: 20 }));
        if (!m.segs.length) kids.push(para(t('Open / review', { i: true, c: C.grey, s: 17 }), { after: 0 }));
        m.segs.forEach((sg) => {
          const k = sg.kind;
          const bar = k === 'exam' ? (CUR_ITEM_COLOR.get(sg.moduleId) || C.examFill) : k === 'session' ? C.sessFill : (nums[sg.moduleId] ? hex(nums[sg.moduleId]) : C.line);
          kids.push(new d.Paragraph({ children: segRuns(sg, nums, cfg, 17), spacing: { after: 30 }, border: { left: { style: d.BorderStyle.SINGLE, size: 18, color: bar, space: 4 } } }));
        });
        cells.push(cell(kids, { w: cw, borders: gridBorders(), fill: m.segs.some((sg) => sg.kind === 'exam') ? mix(CUR_ITEM_COLOR.get((m.segs.find((sg) => sg.kind === 'exam') || {}).moduleId) || C.examFill, 0.82) : m.segs.some((sg) => sg.kind === 'session') ? C.sessBg : fill }));
      }
      rows.push(row(cells));
      (wk.skipNotes || []).filter((n) => n.skipsClass).forEach((n) => rows.push(span(para(t(n.text, { i: true, c: C.red, s: 17 }), { after: 0 }), 'FEF2F2')));
      const extra = [];
      (wk.skipNotes || []).filter((n) => !n.skipsClass).forEach((n) => extra.push(para(t(n.text, { i: true, c: C.grey, s: 17 }), { after: 10 })));
      (wk.selfDirected || []).forEach((x) => extra.push(para([...t('Self-directed (no class time): ', { b: true, c: C.self, s: 17 }), ...t(x.title || '', { s: 17 }), ...(nums[x.moduleId] ? t(` [Module ${nums[x.moduleId]}]`, { c: C.grey, s: 15 }) : []), ...(x.optional ? t(' (time permitting)', { i: true, c: C.grey, s: 17 }) : [])], { after: 10 })));
      wk.takeHome.forEach((mod) => {
        const w = parseFloat(mod.weightPercent) ? ` (${mod.weightPercent}%)` : '';
        const due = sched.assessmentDate && sched.assessmentDate[mod.id] ? ` \u2013 due ${s.formatDateLabel(sched.assessmentDate[mod.id])}` : '';
        extra.push(para([...t('Due this week: ', { b: true, c: '7C3AED', s: 17 }), ...t(mod.title || mod.label || '', { b: true, s: 17 }), ...t(w + due, { s: 17 })], { after: 10 }));
      });
      if (extra.length) rows.push(span(extra, 'FAFAFF'));
      const labKids = [];
      (f.plan.byWeek[wk.weekNumber] || []).forEach((x) => {
        const bits = [];
        if (x.parts > 1) bits.push(`week ${x.part} of ${x.parts}`);
        if (x.share < 100) bits.push(`${fmt(x.share)}% of block`);
        bits.push(`${fmt(x.hours)} h`);
        labKids.push(para([...t('Lab: ', { b: true, c: C.lab, s: 17 }), ...t(x.entry.display, { s: 17, b: true }), ...t(`  (${bits.join(' \u00B7 ')})`, { s: 16, c: C.grey })], { after: 10 }));
      });
      f.plan.labs.filter((e) => e.dueWeek === wk.weekNumber).forEach((e) => {
        labKids.push(para([...t('Lab report due: ', { b: true, c: C.lab, s: 17 }), ...t(e.display, { s: 17 }), ...(e.dueDate ? t(` \u2013 ${s.formatDateLabel(e.dueDate)}`, { s: 17, c: C.grey }) : [])], { after: 10 }));
      });
      if (labKids.length) rows.push(span(labKids, 'ECFEFF'));
    });
    return table(rows, widths, { borders: { top: lineB(), bottom: lineB(), left: lineB(), right: lineB(), insideHorizontal: lineB(), insideVertical: lineB() } });
  }

  function scheduleSection(f) {
    const { course, sched, nums } = f; const cfg = sched.config; const s = S();
    const out = [H1('Course Schedule Overview')];
    const blockText = cfg.uniform ? `${cfg.minutes[0]} min/block` : `${cfg.pattern.map((h) => fmt(h) + ' h').join(' + ')} blocks`;
    let format = `Class Format: ${cfg.pattern.length} ${cfg.allOneHour ? 'lectures' : 'classes'}/week (${blockText}, ${fmt(cfg.capacityHours)} total lecture hrs)`;
    if (f.labHrs > 0) format += ` | ${fmt(f.labHrs)} lab hrs`;
    format += ` across ${cfg.weeks} weeks.`;
    out.push(body(t(format, { c: C.grey })));
    out.push(H2('Weekly Schedule'));
    out.push(calendarGrid(f));
    out.push(spacer(120));
    if (sched.overflow.length) {
      out.push(para(t(`Not yet scheduled – exceeds the ${fmt(cfg.capacityHours)} available lecture hours by ${fmt(sched.overByHours)} h:`, { b: true, c: C.red }), { before: 160, keepNext: true }));
      X().mergePieces(sched.overflow).forEach((sg) => out.push(bullet(t(`${sg.kind === 'exam' ? '[EXAM] ' : ''}${sg.title}${nums[sg.moduleId] ? ` [Module ${nums[sg.moduleId]}]` : ''} (${fmt(sg.hours)} h)`, { c: C.red }))));
    }
    if (sched.unreachedOptional.length) {
      out.push(para(t('Time permitting (covered if the schedule allows):', { b: true, c: C.grey }), { before: 160, keepNext: true }));
      X().mergePieces(sched.unreachedOptional).forEach((sg) => out.push(bullet(t(`${sg.title}${nums[sg.moduleId] ? ` [Module ${nums[sg.moduleId]}]` : ''} (${fmt(sg.hours)} h)`, { c: C.grey }))));
    }
    return out;
  }

  function evaluationSection(f) {
    const d = D(); const { course, ev } = f; const x = X();
    const out = [H1('Method of Evaluation & Grading System'), H2('Allocation of Marks')];
    const widths = [5000, 900, 1300, 2880];
    const block = (label, total, notes, items, color) => {
      const rows = [row([cell(para([...t(label, { b: true, c: C.white, s: 22 }), ...(total ? t(`   ${fmt(total)}%`, { b: true, c: C.white, s: 22 }) : [])], { after: 0 }), { w: OW, span: 4, fill: color, v: d.VerticalAlign.CENTER })], { header: true })];
      if (notes) rows.push(row([cell(para(t(notes, { i: true, c: C.grey, s: 19 }), { after: 0 }), { w: OW, span: 4, fill: C.pale })]));
      items.forEach((it) => {
        const kids = [para(t(it.title, { b: true }), { after: 0 })];
        if (it.scope) kids.push(para(t(`Scope: ${it.scope}`, { i: true, c: C.grey, s: 18 }), { after: 0 }));
        rows.push(row([
          cell(kids, { w: widths[0], borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } }),
          cell(para(t(it.weight ? `${fmt(it.weight)}%` : '', { b: true, c: color }), { after: 0, align: d.AlignmentType.RIGHT }), { w: widths[1], borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } }),
          cell(para(t(it.mode || '', { c: C.grey, s: 18 }), { after: 0 }), { w: widths[2], borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } }),
          cell(para(t(it.when ? it.when : '', { i: true, s: 18, c: it.warn ? C.red : C.grey }), { after: 0 }), { w: widths[3], borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } }),
        ]));
      });
      out.push(table(rows, widths), spacer(100));
    };
    ev.categories.forEach((c, label) => {
      const total = Math.round(c.total * 100) / 100;
      block(label, total, ev.notes[label], c.items, f.gp.catColor.get(label) || C.accent);
    });
    const ws = ev.ws;
    if (ws.hasFinal && ws.finalExam > 0) {
      block('Final Examination', ws.finalExam, ev.notes['Final Examination'], [{ title: 'Comprehensive Final Exam', weight: ws.finalExam, mode: 'In-Person', when: 'By University Registrar during examination period' }], f.gp.catColor.get('Final examination') || C.accent);
    }
    if (ws.isOver) out.push(body(t(`Note: assessment weights total ${fmt(ws.defined)}%, which is over 100%.`, { c: C.red, b: true })));
    else if (ws.isShort) out.push(body(t(`Note: assessment weights total ${fmt(ws.defined)}% and this course has no final exam.`, { c: C.red, b: true })));
    out.push(H2('Grading System'), body(x.pick(course.gradingSystem, f.g.gradingSystem)));
    out.push(H2('Alternate Evaluation & Missed Work Policy'), body(x.pick(course.missedWorkPolicy, course.alternateEvaluationPolicy, f.g.missedWorkPolicy)));
    return out;
  }

  function connectionLines(course, mod, connections) {
    const x = X();
    const mine = (connections || []).filter((c) => c.from === mod.id || c.to === mod.id);
    if (!mine.length) return [];
    const up = []; const down = [];
    mine.forEach((conn) => {
      const otherId = conn.from === mod.id ? conn.to : conn.from;
      const hit = x.findModuleAnywhere(otherId);
      const oc = hit ? hit.course : x.allCourses().find((c) => c.id === otherId);
      const my = Number(course.year) || 0; const oy = oc ? Number(oc.year) || 0 : my;
      const earlier = oy !== my ? oy < my : conn.to === mod.id;
      const text = oc ? `${oc.code} (${hit ? (hit.module.title || hit.module.label) : oc.name})` : String(otherId);
      const tag = x.pedagogicalTag(conn);
      const note = conn.note && conn.note !== 'Created via Connect Mode' ? ` – ${conn.note}` : '';
      (earlier ? up : down).push(bullet([...(tag ? t(`[${tag}] `, { b: true, c: C.accent, s: 17 }) : []), ...t(text + note, { c: C.grey })], 1));
    });
    const out = [para(t('Curriculum Connections'), { style: 'ConnLabel' })];
    if (up.length) out.push(para(t('Prior Foundations (Builds Upon)'), { style: 'ConnSub' }), ...up);
    if (down.length) out.push(para(t('Target Applications (Leads To)'), { style: 'ConnSub' }), ...down);
    return out;
  }

  function modulesSection(f, connections) {
    const { course, sched, nums } = f; const cfg = sched.config; const s = S();
    const out = [H1('Course Modules & Detailed Topics')];
    (sched.electiveGroups || []).forEach((g) => {
      const names = (list) => list.map((m) => `Module ${nums[m.id]}`).join(', ');
      out.push(para([...t(`Elective group – ${g.name}: `, { b: true }), ...t(`${g.total === g.pick ? 'all' : g.pick} of the ${g.total} modules in this group are taught each term, depending on ${g.basisLabel}. This offering: ${names(g.taught) || 'none'}.`), ...(g.notTaught.length ? t(` Not taught this offering: ${names(g.notTaught)}.`, { c: C.grey }) : [])]));
    });
    // A short unbordered paragraph between modules puts a white break in the colour bar (4.1 | 4.2 | ... 4.n).
    const breaker = () => new (D().Paragraph)({ children: [new (D().TextRun)({ text: '', size: 8 })], spacing: { before: 0, after: 0, line: 280, lineRule: D().LineRuleType.EXACT } });
    let started = false;
    (course.modules || []).forEach((mod) => {
      MOD_COLOR = null;
      if (!(mod.isExam || mod.isLab)) { if (started) out.push(breaker()); started = true; }
      if (mod.isSession) {
        const T = s.SESSION_TYPES[s.sessionType(mod)];
        const hrs = s.sessionHours(mod);
        out.push(new (D().Paragraph)({ children: [...t(`${T.icon || ''} ${(mod.label || T.label)}${mod.title ? ': ' + mod.title : ''}`, { c: C.sess }), ...t(`   [${fmt(hrs)} ${unitWord(cfg, hrs)}, not a topic]`, { c: C.grey, b: false, s: 21 })], style: 'SessionHeading', spacing: { before: 0, after: 80 } }));
        if (mod.speaker) out.push(para([...t('Speaker: ', { b: true }), ...t(mod.speaker)], { indent: 360 }));
        if (mod.description) out.push(para(t(mod.description, { i: true }), { indent: 360 }));
        return;
      }
      if (mod.isExam || mod.isLab) return;
      const k = nums[mod.id]; const hrs = s.moduleHours(mod);
      let title = mod.title || mod.label || `Module ${k}`;
      if (s.isTimePermitting(mod) && !/time permitting/i.test(title)) title += ' (Time Permitting)';
      if (mod.electiveGroup) title += f.notTaught.has(mod.id) ? ' (Elective – not taught this offering)' : ' (Elective)';
      MOD_COLOR = hex(k);
      out.push(H2(`Module ${k}: ${title}   [${fmt(hrs)} ${unitWord(cfg, hrs)}]`, hex(k)));
      if (mod.chapter) out.push(para(t(`Reading Reference: Chapter ${mod.chapter}`, { c: C.grey }), { indent: 360 }));
      const topics = Array.isArray(mod.topics) ? mod.topics : [];
      if (!topics.length) out.push(body(mod.description || 'Core topics and competencies for this unit.', { indent: 360 }));
      topics.forEach((topic, ti) => {
        const tp = typeof topic === 'string' ? { title: topic } : topic;
        const th = s.topicHours(tp);
        out.push(para([...t(`${tp.title || tp.name || ''}`), ...(tp.selfDirected ? t('  (self-directed, no class time)', { c: C.self, s: 19 }) : t(`  (${fmt(th)} ${unitWord(cfg, th)})`, { c: C.grey, b: false, s: 19 }))], { style: 'Heading3' }));
        if (tp.description) out.push(para(t(tp.description, { i: true }), { style: 'TopicDetail' }));
        const objs = (tp.learningObjectives || tp.objectives || []).map((o) => (typeof o === 'string' ? o : (o.text || o.title || ''))).filter((o) => o && o.trim());
        if (objs.length) { out.push(para(t('Learning Objectives'), { style: 'DetailLabel' })); objs.forEach((o) => out.push(bullet(t(o, { c: C.grey }), 1))); }
        const qs = (tp.textbookQuestions || tp.questions || []).map((q) => (typeof q === 'string' ? q : (q.text || q.title || ''))).filter((q) => q && q.trim());
        if (qs.length) { out.push(para(t('Recommended Practice Questions'), { style: 'DetailLabel' })); qs.forEach((q) => out.push(bullet(t(q, { c: C.grey }), 1))); }
      });
      out.push(...connectionLines(course, mod, connections));
      MOD_COLOR = null;
    });
    MOD_COLOR = null;
    return out;
  }

  /** Lab plan table. Only the columns that have information are shown. */
  function labTable(f) {
    const d = D(); const s = S(); const plan = f.plan;
    if (!plan.any) return [];
    const labs = plan.labs;
    const cols = [{ k: 'lab', h: 'Laboratory', w: 0 }];
    if (labs.some((e) => e.scheduled)) cols.push({ k: 'weeks', h: 'Weeks', w: 1100 });
    if (labs.some((e) => e.scheduled && e.share < 100)) cols.push({ k: 'share', h: 'Block share', w: 1300 });
    if (labs.some((e) => e.scheduled)) cols.push({ k: 'hours', h: 'Hours', w: 900 });
    if (labs.some((e) => e.dueDate || e.dueWeek)) cols.push({ k: 'due', h: 'Report due', w: 2200 });
    if (labs.some((e) => parseFloat(e.lab.weightPercent) > 0)) cols.push({ k: 'wt', h: 'Weight', w: 900 });
    cols[0].w = OW - cols.slice(1).reduce((a, c) => a + c.w, 0);
    const widths = cols.map((c) => c.w);
    const text = (e, k) => {
      if (k === 'lab') return e.display;
      if (k === 'weeks') return e.scheduled ? (e.weeks > 1 ? `${e.startWeek}\u2013${e.endWeek}` : String(e.startWeek)) : '\u2014';
      if (k === 'share') return e.scheduled ? `${fmt(e.share)}%` : '';
      if (k === 'hours') return fmt(e.totalHours);
      if (k === 'due') return e.dueDate ? `${s.formatDateLabel(e.dueDate)}${e.dueWeek ? ` (wk ${e.dueWeek})` : ''}` : (e.dueWeek ? `Week ${e.dueWeek}` : '');
      return parseFloat(e.lab.weightPercent) > 0 ? `${fmt(parseFloat(e.lab.weightPercent))}%` : '';
    };
    const rows = [row(cols.map((c) => hdrCell(c.h, c.w, C.lab)), { header: true })];
    labs.forEach((e, i) => rows.push(row(cols.map((c) => cell(para(t(text(e, c.k), { b: c.k === 'lab', s: 19 }), { after: 0 }), { w: c.w, fill: i % 2 ? 'F8FAFC' : undefined, borders: { ...NO_BORDERS(), bottom: lineB('E2E8F0', 4) } })))));
    const out = [para([...t('Lab block: ', { b: true }), ...t(`${fmt(plan.blockHours)} h per session. `), ...t('Experiments that run at the same time share the block as shown.', { c: C.grey })], { keepNext: true }), table(rows, widths), spacer(80)];
    if (plan.overbooked.length) out.push(para(t(`Check: ${plan.overbooked.map((o) => `week ${o.week} books ${fmt(o.share)}% of the lab block`).join('; ')}.`, { b: true, c: C.red }), { after: 80 }));
    return out;
  }

  function outlineChildren(course, connections) {
    const x = X(); const f = courseFacts(course); const { inst, g } = f;
    const out = [];
    out.push(para(t(`${course.code}: Course & Instructor Information`), { style: 'Heading1Plain', keepNext: true }));
    const info = [
      ['Instructor Name', x.pick(inst.name, 'TBD')], ['Instructor Email', x.pick(inst.email, 'TBD')], ['Office Location', x.pick(inst.office, 'TBD')],
      ['Availability / Consultation Hours', x.pick(inst.officeHours, course.officeHours, 'TBD / By Appointment')],
      ['Required Prerequisites', x.pick(course.prerequisites, course.prereqs, 'None')], ['Required Co-requisites', x.pick(course.corequisites, course.coreqs, 'None')],
    ];
    out.push(table(info.map(([k, v]) => row([cell(para(t(k, { b: true, c: C.accent, s: 19 }), { after: 0 }), { w: 3000, fill: C.accentBg, borders: { ...NO_BORDERS(), bottom: lineB(C.white, 8) } }), cell(para(t(v), { after: 0 }), { w: OW - 3000, fill: C.pale, borders: { ...NO_BORDERS(), bottom: lineB(C.white, 8) } })])), [3000, OW - 3000]));

    out.push(H1('Textbooks & Course Resources'));
    let books = Array.isArray(course.textbooks) ? course.textbooks : [];
    if (!books.length && course.textbook) books = typeof course.textbook === 'string' ? [{ title: course.textbook, isRequired: true }] : [course.textbook];
    const bookRuns = (b, bold) => [...t(b.title || 'Untitled', { b: bold }), ...t(`${b.author ? ' by ' + b.author : ''}${b.isbn || b.edition ? ' (' + (b.isbn || b.edition) + ')' : ''}`, { c: C.grey })];
    const req = books.filter((b) => b.isRequired !== false); const rec = books.filter((b) => b.isRequired === false);
    if (req.length) { out.push(para(t('Required Textbooks', { b: true }), { keepNext: true })); req.forEach((b) => out.push(bullet(bookRuns(b, true)))); }
    if (rec.length) { out.push(para(t('Supplementary / Recommended Readings', { b: true }), { keepNext: true, before: 80 })); rec.forEach((b) => out.push(bullet(bookRuns(b, false)))); }
    if (!books.length) out.push(body(t('No required textbooks for this course.', { i: true })));
    if (course.software) out.push(para([...t('Required Software/Tools: ', { b: true }), ...t(course.software)], { before: 80 }));
    if (course.otherResources) out.push(para([...t('Other Resources: ', { b: true }), ...t(course.otherResources)]));

    out.push(...scheduleSection(f));
    out.push(...evaluationSection(f));
    out.push(...modulesSection(f, connections));

    out.push(H1('Laboratory Information & Safety'));
    out.push(...labTable(f));
    const lab = course.labInfo || course.lab;
    if (typeof lab === 'string' && lab.trim()) out.push(body(lab));
    else if (lab && typeof lab === 'object') {
      if (lab.schedule) out.push(para([...t('Schedule/Format: ', { b: true }), ...t(lab.schedule)]));
      if (lab.location) out.push(para([...t('Location: ', { b: true }), ...t(lab.location)]));
      if (lab.safety) out.push(para([...t('Safety & PPE: ', { b: true }), ...t(lab.safety)]));
      if (lab.description) out.push(body(lab.description));
    } else out.push(body(t(f.labHrs > 0 ? 'This information will be provided by your laboratory instructor.' : 'This course has no laboratory component.', { i: true })));

    out.push(H1('Use of Assistive Tools & Generative AI Policy'));
    out.push(body(x.pick(course.aiPolicy, g.aiPolicy, x.FALLBACK_AI_POLICY)));
    out.push(H1('Additional Course Information'));
    out.push(course.additionalInfo ? body(course.additionalInfo) : body(t('[Notes on attendance, communication, late submissions, or supplementary resources]', { i: true, c: C.grey })));
    out.push(H1('University Statements & Institutional Policies'));
    out.push(H2('Academic Integrity'), body(x.pick(course.academicIntegrity, g.academicIntegrity)));
    out.push(H2('Student Accommodations'), body(x.pick(course.accommodations, g.accommodations)));
    out.push(H2('Student Privacy & Grade Notification (ATIPP)'), body(x.pick(course.privacyAtipp, g.privacyAtipp)));
    return out;
  }

  // =====================================================================
  //  Program-level pages
  // =====================================================================
  function summaryChildren(courses) {
    const d = D(); const s = S();
    const out = [];
    const W = 10512;
    out.push(table([row([cell([
      para(t('PROGRAM CURRICULUM', { s: 18, c: 'FECDD3', b: true, sp: 30 }), { after: 40 }),
      para(t('Curriculum & Workload Summary', { s: 56, c: C.white, b: true }), { after: 40 }),
      para(t(`${courses.length} course${courses.length === 1 ? '' : 's'}`, { s: 22, c: 'FECDD3' }), { after: 0 }),
    ], { w: W, fill: C.mun, margins: { top: 240, bottom: 220, left: 280, right: 280 } })])], [W]));
    out.push(spacer(120));
    let lec = 0; let lab = 0; const rows = []; const over = [];
    courses.forEach((c) => { const sc = s.build(c); const lh = s.labHours(c); lec += sc.capacityHours; lab += lh; rows.push({ c, sc, lh }); if (sc.isOver) over.push({ c, sc }); });
    const tiles = [[String(courses.length), 'COURSES', C.accent], [fmt(lec), 'LECTURE HOURS', 'F97316'], [fmt(lab), 'LAB HOURS', C.labFill], [fmt(lec + lab), 'CONTACT HOURS', 'E11D48']];
    const tw = Math.floor(W / tiles.length);
    out.push(table([row(tiles.map(([big, label, color]) => cell([
      para(t(big, { s: 60, b: true, c: color }), { after: 0, align: d.AlignmentType.CENTER, line: 240 }),
      para(t(label, { s: 15, b: true, c: C.grey, sp: 20 }), { after: 0, align: d.AlignmentType.CENTER }),
    ], { w: tw, fill: C.pale, v: d.VerticalAlign.CENTER, margins: { top: 120, bottom: 120, left: 60, right: 60 }, borders: { top: { style: d.BorderStyle.SINGLE, size: 24, color }, bottom: NONE_B(), left: { style: d.BorderStyle.SINGLE, size: 12, color: C.white }, right: { style: d.BorderStyle.SINGLE, size: 12, color: C.white } } })))], tiles.map(() => tw)));
    if (over.length) {
      out.push(H1('Schedule Warnings', { before: 240 }));
      over.forEach(({ c, sc }) => out.push(bullet([...t(c.code, { b: true, c: C.red }), ...t(`: ${fmt(sc.requiredHours)} h of required content for ${fmt(sc.capacityHours)} h of class time (${fmt(sc.overByHours)} h over${sc.catchUpHours ? `, including ${fmt(sc.catchUpHours)} h of catch-up gaps` : ''}).`, { c: C.red })])));
    }
    out.push(H1('Course-by-Course Hours', { before: 240 }));
    const cw = [1300, 3400, 3000, 900, 900, 1012];
    const hrow = row(['Course', 'Title', 'Pattern', 'Lecture', 'Lab', 'Contact'].map((h, i) => hdrCell(h, cw[i], C.ink, i >= 3 ? d.AlignmentType.RIGHT : undefined)), { header: true });
    const body2 = rows.map(({ c, sc, lh }, ri) => {
      const fill = ri % 2 ? 'F8FAFC' : undefined;
      const R = (txt, i, o = {}) => cell(para(t(txt, o), { after: 0, align: i >= 3 ? d.AlignmentType.RIGHT : undefined }), { w: cw[i], fill });
      return row([R(c.code, 0, { b: true }), R(c.name || '', 1), R(`${sc.config.label || ''}, ${sc.config.weeks} wk`, 2, { c: C.grey, s: 18 }), R(fmt(sc.capacityHours), 3), R(fmt(lh), 4), R(fmt(sc.capacityHours + lh), 5, { b: true })]);
    });
    out.push(table([hrow, ...body2], cw));
    return out;
  }

  function outcomesChildren(courses) {
    const O = window.Outcomes; const d = D();
    const outcomes = O ? O.getOutcomes() : [];
    if (!outcomes.length) return null;
    const TW = 13680; // landscape, 0.75in margins
    const m = O.buildMatrix(courses, outcomes, { showArchived: false });
    const levelName = { I: 'Introduced', R: 'Reinforced', A: 'Advanced' };
    const out = [para(t('Program Learning Outcomes', { b: true, s: 40, c: C.ink }), { style: 'Heading1Plain', keepNext: true })];
    const progs = O.getPrograms();
    m.rows.forEach((r) => {
      const tags = [];
      if (r.o.programId) { const p = progs.find((x) => x.id === r.o.programId); if (p) tags.push(`${p.name} only`); }
      if (r.o.area) tags.push(`Area: ${r.o.area}`);
      out.push(para([...t(r.code + '  ', { b: true, c: C.accent }), ...t(r.o.title, { b: r.depth === 0 }), ...(tags.length ? t(` [${tags.join('; ')}]`, { c: C.red, s: 18 }) : []), ...(r.o.description ? t(` – ${r.o.description}`, { c: C.grey }) : [])], { indent: 240 + r.depth * 360, after: 30 }));
    });
    if (progs.length) {
      out.push(H1('Programs', { before: 240 }));
      progs.forEach((p) => {
        const pc = O.programCourses(p.id);
        out.push(para([...t(p.name || 'Untitled', { b: true, s: 24 }), ...t(` (${O.PROGRAM_TYPES[p.type] || p.type})`, { c: C.grey }), ...(p.description ? t(` – ${p.description}`, { c: C.grey }) : [])], { keepNext: true, before: 80 }));
        out.push(para([...t('Required: ', { b: true }), ...t(pc.filter((x) => x.required).map((x) => x.course.code).join(', ') || 'none')], { indent: 360, after: 20 }));
        out.push(para([...t('Electives: ', { b: true }), ...t(pc.filter((x) => !x.required).map((x) => x.course.code).join(', ') || 'none')], { indent: 360 }));
      });
    }
    const matrix = (mx, prog) => {
      const o2 = [H1(prog ? `Curriculum Map: ${prog.name || 'Program'} (${O.PROGRAM_TYPES[prog.type] || prog.type})` : 'Curriculum Map: Outcomes by Course', { pageBreakBefore: true })];
      o2.push(body(t('Each cell shows the highest level the course reaches for the outcome, taken from the topics tagged in that course: I = Introduced, R = Reinforced, A = Advanced. Lower-case italic letters are rolled up from sub-outcomes. Blank = not addressed.', { c: C.grey, s: 18 })));
      const labelW = 4200; const sumW = prog ? 1300 : 950;
      const nChunks = Math.max(1, Math.ceil(mx.courses.length / 12)); const per = Math.ceil(mx.courses.length / nChunks);
      for (let st = 0; st < mx.courses.length; st += per) {
        const chunk = mx.courses.slice(st, st + per);
        const cwid = Math.floor((TW - labelW - sumW * (prog ? 2 : 1)) / chunk.length);
        const widths = [labelW, ...chunk.map(() => cwid), sumW, ...(prog ? [sumW] : [])];
        const head = [hdrCell('Outcome', widths[0]), ...chunk.map((c, i) => hdrCell(`${c.code}${prog && !mx.requiredIds.has(c.id) ? '*' : ''}`, cwid, C.ink, d.AlignmentType.CENTER)), ...(prog ? [hdrCell('Guaranteed', sumW, C.ink, d.AlignmentType.CENTER), hdrCell('Possible', sumW, C.ink, d.AlignmentType.CENTER)] : [hdrCell('Courses', sumW, C.ink, d.AlignmentType.CENTER)])];
        const rows = [row(head, { header: true })];
        mx.rows.forEach((r) => {
          const cells = [cell(para([...t(r.code + ' ', { b: true, s: 17 }), ...t(r.o.title, { s: 17 })], { after: 0, indent: r.depth * 200 }), { w: widths[0], borders: gridBorders() })];
          chunk.forEach((c) => {
            const cl = mx.cells[r.o.id][c.id];
            cells.push(cell(para(cl ? t(cl.derived ? cl.level.toLowerCase() : cl.level, { b: !cl.derived, i: cl.derived, s: 18 }) : '', { after: 0, align: d.AlignmentType.CENTER }), { w: cwid, fill: cl ? C[cl.level] : undefined, borders: gridBorders(), v: d.VerticalAlign.CENTER }));
          });
          const cv = mx.coverage[r.o.id];
          const sumCell = (txt, lvl, w, red) => cell(para(t(txt, { b: true, s: 17, c: red ? C.red : C.ink }), { after: 0, align: d.AlignmentType.CENTER }), { w, fill: lvl ? C[lvl] : undefined, borders: gridBorders(), v: d.VerticalAlign.CENTER });
          if (prog) {
            cells.push(sumCell(cv.guaranteed || (cv.possible ? 'elective only' : 'none'), cv.guaranteed, sumW, !cv.guaranteed));
            cells.push(sumCell(cv.possible || 'none', cv.possible, sumW, !cv.possible));
          } else cells.push(sumCell(cv.courses ? String(cv.courses) : 'none', null, sumW, !cv.courses));
          rows.push(row(cells));
        });
        o2.push(table(rows, widths, { borders: { top: lineB(), bottom: lineB(), left: lineB(), right: lineB(), insideHorizontal: lineB(), insideVertical: lineB() } }), spacer(100));
      }
      if (prog) {
        o2.push(body(t('* = elective in this program. Guaranteed = highest level reached through required courses only; Possible = highest level if electives are taken.', { c: C.grey, s: 18 })));
        o2.push(para([...t('Required: ', { b: true }), ...t(mx.courses.filter((c) => mx.requiredIds.has(c.id)).map((c) => c.code).join(', ') || 'none')]));
        o2.push(para([...t('Electives: ', { b: true }), ...t(mx.courses.filter((c) => !mx.requiredIds.has(c.id)).map((c) => c.code).join(', ') || 'none')]));
        const eo = mx.rows.filter((r) => mx.coverage[r.o.id].possible && !mx.coverage[r.o.id].guaranteed);
        if (eo.length) o2.push(para([...t('Only reached through electives: ', { b: true, c: C.red }), ...t(eo.map((r) => r.code).join(', '))]));
      }
      const gaps = mx.rows.filter((r) => !mx.coverage[r.o.id].courses);
      const notA = mx.rows.filter((r) => mx.coverage[r.o.id].courses && mx.coverage[r.o.id].max !== 'A');
      if (gaps.length) o2.push(para([...t('Not addressed by any course: ', { b: true, c: C.red }), ...t(gaps.map((r) => r.code).join(', '))]));
      if (notA.length) o2.push(para([...t('Never reaches Advanced: ', { b: true }), ...t(notA.map((r) => r.code).join(', '))]));
      return o2;
    };
    out.push(...matrix(m, null));
    progs.forEach((p) => { const pm = O.buildMatrix(courses, outcomes, { showArchived: false, programId: p.id }); if (pm.courses.length) out.push(...matrix(pm, p)); });
    out.push(H1('Outcome Detail by Course', { pageBreakBefore: true }));
    m.rows.forEach((r) => {
      out.push(para(t(`${r.code} ${r.o.title}`, { b: true }), { indent: 240 + r.depth * 360, before: 140, keepNext: true, after: 20 }));
      const any = m.courses.filter((c) => m.cells[r.o.id][c.id]);
      if (!any.length) { out.push(para(t('Not addressed in any course.', { i: true, c: C.grey }), { indent: 600 + r.depth * 360 })); return; }
      any.forEach((c) => {
        const cl = m.cells[r.o.id][c.id];
        out.push(para([...t(c.code, { b: true }), ...t(` (${levelName[cl.level]}${cl.derived ? ', rolled up from sub-outcomes' : ''})`, { c: C.grey })], { indent: 600 + r.depth * 360, keepNext: true, after: 10, shading: { type: d.ShadingType.CLEAR, fill: C[cl.level], color: 'auto' } }));
        cl.entries.forEach((e) => out.push(para(t(`${e.topicTitle || e.moduleTitle} [${e.level}]`, { c: C.grey }), { bullet: 1, after: 10 })));
      });
    });
    return out;
  }

  // =====================================================================
  //  Document assembly + downloads
  // =====================================================================
  function headerFooter(course) {
    const d = D(); const g = X().globals();
    const bits = course ? [course.code, course.term || g.term, course.version || g.version].filter(Boolean).join('  ·  ') : 'Curriculum Summary';
    return {
      headers: { default: new d.Header({ children: [para(t(bits, { c: C.grey, s: 17 }), { align: d.AlignmentType.RIGHT, after: 0 })] }) },
      footers: { default: new d.Footer({ children: [para([new d.TextRun({ children: ['Page ', d.PageNumber.CURRENT, ' of ', d.PageNumber.TOTAL_PAGES], size: 17, color: C.grey, font: FONT })], { align: d.AlignmentType.CENTER, after: 0 })] }) },
    };
  }
  const page = (m, landscape) => ({ page: { size: { width: PAGE_W, height: PAGE_H, orientation: landscape ? D().PageOrientation.LANDSCAPE : D().PageOrientation.PORTRAIT }, margin: { top: m, bottom: m, left: m, right: m, header: 400, footer: 400 } } });

  function courseSections(course, connections) {
    const hf = headerFooter(course);
    return [
      { properties: page(864), ...hf, children: buildDashboard(course, connections) },
      { properties: page(1080), ...hf, children: outlineChildren(course, connections) },
    ];
  }

  function makeDocument(sections, title) {
    const d = D();
    const hd = (id, name, size, color, extra = {}) => ({ id, name, basedOn: extra.basedOn || 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size, bold: true, color }, paragraph: { spacing: { before: extra.before ?? 280, after: extra.after ?? 100 }, outlineLevel: extra.level, keepNext: true, border: extra.border, indent: extra.indent, numbering: extra.numbering, shading: extra.shading } });
    const sty = (id, name, run, paragraph) => ({ id, name, basedOn: 'Normal', quickFormat: true, run: { font: FONT, ...run }, paragraph });
    const h1Border = { bottom: { style: d.BorderStyle.SINGLE, size: 12, color: C.accent, space: 4 } };
    return new d.Document({
      creator: 'CurriMap', title,
      styles: {
        default: {
          document: { run: { font: FONT, size: 21 } },
          heading1: { run: { font: FONT, size: 32, bold: true, color: C.ink }, paragraph: { spacing: { before: 360, after: 120 }, keepNext: true, border: h1Border, numbering: { reference: 'heads', level: 0 } } },
          heading2: { run: { font: FONT, size: 26, bold: true, color: C.ink }, paragraph: { spacing: { before: 280, after: 80 }, keepNext: true, numbering: { reference: 'heads', level: 1 } } },
          heading3: { run: { font: FONT, size: 22, bold: true, color: C.ink }, paragraph: { spacing: { before: 200, after: 60 }, keepNext: true, numbering: { reference: 'heads', level: 2 } } },
        },
        paragraphStyles: [
          hd('Heading1Plain', 'Heading 1 (no number)', 32, C.ink, { level: 0, before: 360, after: 120, border: h1Border }),
          hd('SessionHeading', 'Session Heading', 24, C.sess, { level: 1, before: 280, after: 80, shading: { type: d.ShadingType.CLEAR, fill: C.sessBg, color: 'auto' }, border: { left: { style: d.BorderStyle.SINGLE, size: 36, color: C.sessFill, space: 8 } } }),
          sty('TopicDetail', 'Topic Description', { italics: true }, { indent: { left: 720 }, spacing: { after: 30 } }),
          sty('DetailLabel', 'Topic Detail Label', { bold: true, size: 19 }, { indent: { left: 720 }, spacing: { after: 20 }, keepNext: true }),
          sty('ConnLabel', 'Connections Label', { bold: true }, { indent: { left: 360 }, spacing: { before: 100, after: 30 }, keepNext: true }),
          sty('ConnSub', 'Connections Sublabel', { bold: true, size: 19, color: C.grey }, { indent: { left: 720 }, spacing: { after: 20 }, keepNext: true }),
          sty('ListBullet', 'List Bullet', {}, { numbering: { reference: 'bul', level: 0 }, spacing: { after: 40 } }),
          sty('ListBullet2', 'List Bullet 2', {}, { numbering: { reference: 'bul', level: 1 }, spacing: { after: 40 } }),
        ],
      },
      numbering: { config: [
        { reference: 'bul', levels: [0, 1].map((lv) => ({ level: lv, format: d.LevelFormat.BULLET, text: lv ? '\u2013' : '\u2022', alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 + lv * 360, hanging: 260 } } } })) },
        { reference: 'heads', levels: [
          { level: 0, format: d.LevelFormat.DECIMAL, text: '%1.', alignment: d.AlignmentType.LEFT, suffix: d.LevelSuffix.SPACE },
          { level: 1, format: d.LevelFormat.DECIMAL, text: '%1.%2', alignment: d.AlignmentType.LEFT, suffix: d.LevelSuffix.SPACE },
          { level: 2, format: d.LevelFormat.DECIMAL, text: 'Topic %1.%2.%3:', alignment: d.AlignmentType.LEFT, suffix: d.LevelSuffix.SPACE },
        ] },
      ] },
      sections,
    });
  }

  /** The docx library writes a pStyle element inside numbered styles, which Word does not allow there. Remove it. */
  async function tidyDocx(blob) {
    if (!window.JSZip) return blob;
    try {
      const zip = await window.JSZip.loadAsync(blob);
      const f = zip.file('word/styles.xml');
      if (!f) return blob;
      let xml = await f.async('string');
      xml = xml.replace(/(<w:style [^>]*>(?:(?!<\/w:style>).)*?<w:pPr>)<w:pStyle w:val="ListParagraph"\/>/gs, '$1');
      zip.file('word/styles.xml', xml);
      return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
    } catch (e) { console.warn('docx tidy skipped', e); return blob; }
  }

  async function saveDoc(doc, fileName) {
    let blob = await D().Packer.toBlob(doc);
    blob = await tidyDocx(blob);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return blob;
  }

  function outlineFileName(course) {
    const x = X(); const term = course.term || x.globals().term;
    const base = `${course.code}-${course.name}_--_Course_Outline`;
    return x.fileSafe(term ? `${term} - ${base}` : base) + '.docx';
  }

  async function downloadCourseOutlineDocx(courseId, view) {
    if (!D()) { alert('The Word export library failed to load.'); return; }
    const { course, connections } = window.getCourseById(courseId);
    if (!course) { alert('Course data not found.'); return; }
    const used = S().withDateView(course, view);
    CUR_INST = 0;
    const doc = makeDocument(courseSections(used, connections || []), `${course.code} Course Outline`);
    return saveDoc(doc, outlineFileName(course));
  }

  async function downloadAllCourseOutlinesDocx() {
    if (!D()) { alert('The Word export library failed to load.'); return; }
    const courses = (window.DATA && window.DATA.courses) || [];
    if (!courses.length) { alert('No course data found.'); return; }
    // The combined package uses the program calendar only.
    const used = courses.map((c) => S().withDateView(c, 'global'));
    const conns = window.DATA.connections || [];
    PLAIN_H1 = true;
    const sections = [{ properties: page(864), headers: headerFooter(null).headers, footers: headerFooter(null).footers, children: summaryChildren(used) }];
    const oc = outcomesChildren(used);
    PLAIN_H1 = false;
    if (oc) sections.push({ properties: page(1080, true), ...headerFooter(null), children: oc });
    used.forEach((c, i) => { CUR_INST = i; sections.push(...courseSections(c, conns)); });
    CUR_INST = 0;
    return saveDoc(makeDocument(sections, 'Complete Curriculum Outlines'), 'Complete_Curriculum_Outlines.docx');
  }

  window.downloadCourseOutlineDocx = downloadCourseOutlineDocx;
  window.downloadAllCourseOutlinesDocx = downloadAllCourseOutlinesDocx;
  window.__DocxInternals = { makeDocument, courseSections, summaryChildren, outcomesChildren };
})();
