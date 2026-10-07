/* ============================================================
   js/calendarView.js
   Week-by-week term calendar, driven by window.Scheduler.
   Shows split topics, partial classes, catch-up time, take-home
   due dates, and anything that doesn't fit in the term.
   ============================================================ */

(function () {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function teachingNumbers(course) {
    const map = {};
    let n = 0;
    (course.modules || []).forEach((m) => { if (!m.isExam && !m.isLab) map[m.id] = ++n; });
    return map;
  }

  function segHtml(seg, nums, fmt) {
    if (seg.kind === 'exam') {
      const w = seg.weightPercent ? ` · ${fmt(seg.weightPercent)}%` : '';
      const partial = seg.meeting && !seg.fillsClass;
      const bits = [];
      if (seg.parts > 1) bits.push(`${seg.part}/${seg.parts}`);
      if (partial) bits.push(`${fmt(seg.hours)} h`);
      return `<div class="cal-seg cal-seg-exam"><span class="cal-seg-tag">${esc(seg.moduleLabel)}${w}</span><span class="cal-seg-title">${esc(seg.title)}${bits.length ? ` <span class="cal-seg-part">(${bits.join(', ')})</span>` : ''}</span></div>`;
    }
    if (seg.kind === 'buffer') {
      return `<div class="cal-seg cal-seg-buffer"><span class="cal-seg-title">Catch-up / review · ${fmt(seg.hours)} h</span></div>`;
    }
    const partial = seg.meeting && !seg.fillsClass;
    const bits = [];
    if (seg.parts > 1) bits.push(`${seg.part}/${seg.parts}`);
    if (partial) bits.push(`${fmt(seg.hours)} h`);
    const modTag = nums[seg.moduleId] ? `Module ${nums[seg.moduleId]}` : seg.moduleLabel;
    const cls = ['cal-seg', seg.kind === 'unassigned' ? 'cal-seg-unassigned' : '', seg.optional ? 'cal-seg-optional' : ''].join(' ');
    return `<div class="${cls}">
      <span class="cal-seg-tag">${esc(modTag)}${seg.optional ? ' · time permitting' : ''}</span>
      <span class="cal-seg-title">${esc(seg.title)}${bits.length ? ` <span class="cal-seg-part">(${bits.join(', ')})</span>` : ''}</span>
    </div>`;
  }

  function mergePieces(segs) {
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

  function openCalendarModal(course) {
    const S = window.Scheduler;
    const fmt = S.formatHours;
    const r = S.build(course);
    const cfg = r.config;
    const nums = teachingNumbers(course);

    let modal = document.getElementById('calendar-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'calendar-modal';
      modal.className = 'modal-overlay hidden';
      document.body.appendChild(modal);
    }

    const weeksHtml = r.weeks.map((week) => {
      const meetings = week.meetings.map((m) => `
        <div class="cal-meeting">
          <div class="cal-meeting-label">${m.dateLabel ? `${esc(m.dateLabel)} · ` : ''}Class ${m.day}${cfg.uniform ? '' : ` · ${fmt(m.hours)} h`}</div>
          ${m.segs.length ? m.segs.map((s) => segHtml(s, nums, fmt)).join('') : '<div class="cal-seg cal-seg-buffer"><span class="cal-seg-title">Open</span></div>'}
        </div>`).join('');
      const due = week.takeHome.map((mod) => `
        <div class="cal-seg cal-seg-due"><span class="cal-seg-tag">Due ${r.assessmentDate && r.assessmentDate[mod.id] ? esc(S.formatDateLabel(r.assessmentDate[mod.id])) : 'this week'}${mod.weightPercent ? ` · ${fmt(mod.weightPercent)}%` : ''}</span><span class="cal-seg-title">${esc(mod.title || mod.label)}</span></div>`).join('');
      const range = week.startDate
        ? `<span class="cal-week-range">${esc(S.formatDateLabel(week.startDate, false))}${week.endDate !== week.startDate ? ' – ' + esc(S.formatDateLabel(week.endDate, false)) : ''}</span>` : '';
      const notes = (week.skipNotes || []).map((n) =>
        `<div class="${n.skipsClass ? 'cal-skip-note' : 'cal-flag-note'}">${esc(n.text)}</div>`).join('');
      return `
        <div class="cal-week-card">
          <div class="cal-week-header">Week ${week.weekNumber}${range}</div>
          <div class="cal-week-body">${notes}${meetings}${due}</div>
        </div>`;
    }).join('');

    const listRows = (segs) => mergePieces(segs).map((s) => {
      const tag = s.kind === 'exam' ? s.moduleLabel : (nums[s.moduleId] ? `Module ${nums[s.moduleId]}` : s.moduleLabel);
      return `<li><span class="cal-seg-tag">${esc(tag)}</span> ${esc(s.title)} <span class="cal-seg-part">(${fmt(s.hours)} h)</span></li>`;
    }).join('');

    const overflowHtml = r.overflow.length ? `
      <section class="cal-leftover cal-leftover-over">
        <h3>Doesn't fit in the term — ${fmt(r.overByHours)} h over</h3>
        <p>Shorten topics, mark a module as time permitting, move an assessment to take-home, or add class time.</p>
        <ul>${listRows(r.overflow)}</ul>
      </section>` : '';

    const optionalHtml = r.unreachedOptional.length ? `
      <section class="cal-leftover cal-leftover-optional">
        <h3>Time permitting — not reached</h3>
        <ul>${listRows(r.unreachedOptional)}</ul>
      </section>` : '';

    const noDateHint = r.hasDates ? '' : ' · set a start date in the course editor to see real dates';
    const summaryCls = r.isOver ? 'is-over' : 'is-ok';
    const summary = `${esc(cfg.label)} · ${cfg.weeks} weeks · ${fmt(r.requiredHours)} h required${r.optionalHours ? ` + ${fmt(r.optionalHours)} h time permitting` : ''} of ${fmt(cfg.capacityHours)} h` +
      (r.isOver ? ` · <strong>${fmt(r.overByHours)} h over</strong>` : '') + noDateHint;

    modal.innerHTML = `
      <div class="calendar-modal-card" role="dialog" aria-label="${esc(course.code)} term calendar">
        <div class="calendar-header">
          <div>
            <h2 class="calendar-title">${esc(course.code)}: ${esc(course.name)}</h2>
            <p class="calendar-summary ${summaryCls}">${summary}</p>
          </div>
          <button type="button" class="close-modal-btn" onclick="closeCalendarModal()" aria-label="Close">&times;</button>
        </div>
        <div class="calendar-scroll">
          ${overflowHtml}
          <div class="calendar-grid">${weeksHtml}</div>
          ${optionalHtml}
        </div>
      </div>`;

    modal.classList.remove('hidden');
    modal.onclick = (e) => { if (e.target === modal) closeCalendarModal(); };
  }

  function closeCalendarModal() {
    const modal = document.getElementById('calendar-modal');
    if (modal) modal.classList.add('hidden');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCalendarModal();
  });

  window.openCalendarModal = openCalendarModal;
  window.closeCalendarModal = closeCalendarModal;
})();
