/* Term calendar: start date, important dates and day swaps.
 * One editor component used in two places: the program-wide "Term Calendar"
 * modal (DATA.calendar) and a course's own "custom dates" panel.
 *   cal = { startDate, importantDates: [{date,endDate,label,skipsClass}],
 *           extraDays: [{date, actsAs:'WE', label}] }
 */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = [['MO', 'Monday'], ['TU', 'Tuesday'], ['WE', 'Wednesday'], ['TH', 'Thursday'], ['FR', 'Friday'], ['SA', 'Saturday'], ['SU', 'Sunday']];
  const NAMES3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const save = () => { if (typeof window.scheduleAutosave === 'function') window.scheduleAutosave(); };

  function weekdayOf(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? NAMES3[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : '';
  }

  function blank() { return { startDate: '', importantDates: [], extraDays: [] }; }

  function copy(cal) {
    return {
      startDate: (cal && cal.startDate) || '',
      importantDates: ((cal && cal.importantDates) || []).map((d) => ({ ...d })),
      extraDays: ((cal && cal.extraDays) || []).map((d) => ({ ...d })),
    };
  }

  /** Strip empty rows so saved files stay tidy. */
  function clean(cal) {
    const out = {};
    if (cal.startDate) out.startDate = cal.startDate;
    const dates = (cal.importantDates || []).filter((d) => d.date).map((d) => {
      const row = { date: d.date, label: (d.label || '').trim(), skipsClass: !!d.skipsClass };
      if (d.endDate && d.endDate !== d.date) row.endDate = d.endDate;
      return row;
    });
    if (dates.length) out.importantDates = dates;
    const extra = (cal.extraDays || []).filter((d) => d.date && d.actsAs).map((d) => ({ date: d.date, actsAs: d.actsAs, label: (d.label || '').trim() }));
    if (extra.length) out.extraDays = extra;
    return out;
  }

  function mount(container, cal, onChange) {
    cal.importantDates = cal.importantDates || [];
    cal.extraDays = cal.extraDays || [];
    const changed = () => { if (onChange) onChange(); };

    function draw() {
      container.innerHTML = `
        <div class="form-group tc-start"><label>First day of classes</label>
          <input type="date" data-k="startDate" value="${esc(cal.startDate || '')}"></div>

        <h4 class="tc-h">Important dates</h4>
        <p class="hint-text">Holidays, reading weeks, study days. Tick "no class" and those days are skipped; the rest of the term slides later.</p>
        <div class="important-dates-list">${cal.importantDates.length ? cal.importantDates.map((d, i) => `
          <div class="important-date-row">
            <input type="date" value="${esc(d.date || '')}" data-list="importantDates" data-i="${i}" data-f="date" title="Date (or first day)">
            <input type="date" value="${esc(d.endDate || '')}" data-list="importantDates" data-i="${i}" data-f="endDate" title="Last day (optional, for a range)">
            <input type="text" value="${esc(d.label || '')}" data-list="importantDates" data-i="${i}" data-f="label" placeholder="e.g. Reading week">
            <label class="skip-check"><input type="checkbox" data-list="importantDates" data-i="${i}" data-f="skipsClass" ${d.skipsClass ? 'checked' : ''}> no class</label>
            <button type="button" class="btn btn-cancel btn-sm" data-rm="importantDates" data-i="${i}" title="Remove">&times;</button>
          </div>`).join('') : '<p class="empty-note">None yet.</p>'}</div>
        <button type="button" class="btn btn-secondary btn-sm" data-add="importantDates">+ Add important date</button>

        <h4 class="tc-h">Day swaps &amp; extra days</h4>
        <p class="hint-text">A date that runs another weekday's schedule, e.g. a Tuesday that follows a Wednesday schedule so every weekday meets the same number of times. Courses that meet on that weekday get a class on the date; the date's own weekday class is displaced.</p>
        <div class="important-dates-list">${cal.extraDays.length ? cal.extraDays.map((d, i) => `
          <div class="important-date-row tc-swap-row">
            <input type="date" value="${esc(d.date || '')}" data-list="extraDays" data-i="${i}" data-f="date">
            <span class="tc-dow">${esc(weekdayOf(d.date))}</span>
            <select data-list="extraDays" data-i="${i}" data-f="actsAs">
              <option value="">follows…</option>${DAYS.map(([c, n]) => `<option value="${c}" ${d.actsAs === c ? 'selected' : ''}>${n} schedule</option>`).join('')}</select>
            <input type="text" value="${esc(d.label || '')}" data-list="extraDays" data-i="${i}" data-f="label" placeholder="Note (optional)">
            <button type="button" class="btn btn-cancel btn-sm" data-rm="extraDays" data-i="${i}" title="Remove">&times;</button>
          </div>`).join('') : '<p class="empty-note">None yet.</p>'}</div>
        <button type="button" class="btn btn-secondary btn-sm" data-add="extraDays">+ Add day swap</button>`;
    }

    container.onclick = (e) => {
      const add = e.target.closest('[data-add]');
      const rm = e.target.closest('[data-rm]');
      if (add) {
        cal[add.dataset.add].push(add.dataset.add === 'importantDates' ? { date: '', endDate: '', label: '', skipsClass: true } : { date: '', actsAs: '', label: '' });
        draw(); changed();
      } else if (rm) {
        cal[rm.dataset.rm].splice(+rm.dataset.i, 1);
        draw(); changed();
      }
    };
    const onEdit = (e) => {
      const el = e.target;
      if (el.dataset.k === 'startDate') { cal.startDate = el.value; changed(); return; }
      if (!el.dataset.list) return;
      const row = cal[el.dataset.list][+el.dataset.i];
      if (!row) return;
      row[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.list === 'extraDays' && el.dataset.f === 'date') {
        const dow = el.closest('.important-date-row').querySelector('.tc-dow');
        if (dow) dow.textContent = weekdayOf(el.value);
      }
      changed();
    };
    container.oninput = onEdit;
    container.onchange = onEdit;
    draw();
  }

  // ---------------- program-wide modal ----------------
  function programCal() {
    const d = window.DATA;
    if (!d.calendar) d.calendar = { enabled: true, startDate: '', importantDates: [], extraDays: [] };
    return d.calendar;
  }

  function ensureModal() {
    let modal = document.getElementById('term-calendar-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'term-calendar-modal';
      modal.className = 'modal-overlay hidden';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }
    return modal;
  }

  function open() {
    const S = window.Scheduler;
    const cal = programCal();
    const modal = ensureModal();
    const courses = (window.DATA.courses || []).slice().sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0) || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
    modal.innerHTML = `
      <div class="calendar-modal-card po-card" role="dialog" aria-label="Term calendar">
        <div class="calendar-header">
          <div><h2 class="calendar-title">Term Calendar</h2>
            <p class="calendar-summary">One start date, holidays and day swaps for every course. A course can override it in its own editor.</p></div>
          <button type="button" class="close-modal-btn" id="tcClose" aria-label="Close">&times;</button>
        </div>
        <div class="calendar-scroll po-body">
          <label class="inline-field"><input type="checkbox" id="tcEnabled" ${cal.enabled === false ? '' : 'checked'}> Use program dates (untick to produce all outlines without dates)</label>
          <div id="tcEditor"></div>
          <h4 class="tc-h">Courses</h4>
          <p class="hint-text">Class days (e.g. Tue/Thu) are set per course. Here you choose which calendar each course follows.</p>
          <div class="tc-courses">${courses.map((c) => `
            <label class="course-program-row"><span>${esc(c.code)} <em>${esc(c.name)}</em></span>
              <select data-course="${esc(c.id)}">${[['inherit', 'Program calendar'], ['custom', 'Its own dates'], ['off', 'No dates']].map(([v, n]) => `<option value="${v}" ${S.dateMode(c) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`).join('')}</div>
        </div>
      </div>`;
    modal.classList.remove('hidden');
    modal.querySelector('#tcClose').onclick = close;
    mount(modal.querySelector('#tcEditor'), cal, save);
    modal.querySelector('#tcEnabled').onchange = (e) => { cal.enabled = e.target.checked; save(); };
    modal.querySelectorAll('select[data-course]').forEach((sel) => {
      sel.onchange = () => {
        const c = window.DATA.courses.find((x) => x.id === sel.dataset.course);
        if (!c) return;
        c.dateMode = sel.value;
        if (sel.value === 'custom' && !c.startDate) { Object.assign(c, clean(copy(cal))); } // start from the program's dates
        save();
      };
    });
  }
  function close() { const m = document.getElementById('term-calendar-modal'); if (m) m.classList.add('hidden'); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  window.TermCalendar = { mount, clean, copy, blank, open, close, programCal };
  window.openTermCalendar = open;
})();
