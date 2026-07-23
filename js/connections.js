/* ============================================================
   connections.js
   Connects module chips (or collapsed course headers).
   ============================================================ */

const SVG_NS = 'http://www.w3.org/2000/svg';

const TIER_COLOR = {
  strong: 'var(--strong)',
  related: 'var(--related)',
  weak: 'var(--weak)',
};

function resizeConnectionLayer() {
  const wrap = document.querySelector('.board-wrap');
  const svg = document.getElementById('connectionLayer');
  if (!wrap || !svg) return;

  const w = Math.max(wrap.scrollWidth, wrap.clientWidth);
  const h = Math.max(wrap.scrollHeight, wrap.clientHeight);

  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.style.width = w + 'px';
  svg.style.height = h + 'px';
}

function getElementCenter(el, wrapEl, wrapRect) {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - wrapRect.left + wrapEl.scrollLeft + r.width / 2,
    y: r.top - wrapRect.top + wrapEl.scrollTop + r.height / 2,
  };
}

function resolveAnchorNode(moduleId) {
  const chip = document.querySelector(`.module-chip[data-module-id="${cssEscape(moduleId)}"]`);
  if (!chip) return null;

  const card = chip.closest('.course-card');
  if (card && card.classList.contains('is-collapsed')) {
    return { el: card.querySelector('.course-card-head'), isCollapsed: true };
  }

  return { el: chip, isCollapsed: false };
}

function drawConnections(data, viewState) {
  const svg = document.getElementById('connectionLayer');
  const wrap = document.querySelector('.board-wrap');
  if (!svg || !wrap) return;

  resizeConnectionLayer();
  svg.innerHTML = '';

  const wrapRect = wrap.getBoundingClientRect();
  const { activeTiers, mode, selectedModuleId } = viewState;

  const visible = data.connections.filter((conn) => {
    if (!activeTiers.has(conn.level)) return false;
    if (mode === 'focus' && selectedModuleId) {
      return conn.from === selectedModuleId || conn.to === selectedModuleId;
    }
    return true;
  });

  visible.forEach((conn) => {
    const fromAnchor = resolveAnchorNode(conn.from);
    const toAnchor = resolveAnchorNode(conn.to);
    if (!fromAnchor || !toAnchor) return;

    const isCollapsedLine = fromAnchor.isCollapsed || toAnchor.isCollapsed;
    const isDimmed = selectedModuleId && conn.from !== selectedModuleId && conn.to !== selectedModuleId && mode === 'all';

    const p1 = getElementCenter(fromAnchor.el, wrap, wrapRect);
    const p2 = getElementCenter(toAnchor.el, wrap, wrapRect);

    drawLine(svg, p1, p2, conn.level, isCollapsedLine, isDimmed);
  });
}

function drawLine(svg, p1, p2, level, isCollapsedLine, isDimmed) {
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('opacity', isDimmed ? '0.15' : '0.85');

  // Non-specific neutral line for collapsed courses
  const color = isCollapsedLine ? '#8892b0' : (TIER_COLOR[level] || '#999');

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', p1.x);
  line.setAttribute('y1', p1.y);
  line.setAttribute('x2', p2.x);
  line.setAttribute('y2', p2.y);
  line.setAttribute('stroke', color);
line.setAttribute('stroke-width', isCollapsedLine ? '2' : (level === 'strong' ? '3.5' : '2.5'));  line.setAttribute('stroke-linecap', 'round');

  if (isCollapsedLine) {
    line.setAttribute('stroke-dasharray', '4,4');
  } else if (level === 'weak') {
    line.setAttribute('stroke-dasharray', '2,4');
  }

  group.appendChild(line);
  svg.appendChild(group);
}

function cssEscape(str) {
  if (window.CSS && CSS.escape) return CSS.escape(str);
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

window.drawConnections = drawConnections;
window.resizeConnectionLayer = resizeConnectionLayer;