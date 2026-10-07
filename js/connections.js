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

const CONNECTION_TIER_CYCLE = ['strong', 'related', 'weak'];
const COURSE_LINK_TIER = 'course';

function resolveAnchorNode(id) {
  const chip = document.querySelector(`.module-chip[data-module-id="${cssEscape(id)}"]`);
  if (chip) {
    const card = chip.closest('.course-card');
    if (card && card.classList.contains('is-collapsed')) {
      return { el: card.querySelector('.course-card-head'), isCollapsed: true };
    }
    return { el: chip, isCollapsed: false };
  }

  // Whole-course link: anchor on the course card header
  const courseCard = document.querySelector(`.course-card[data-course-id="${cssEscape(id)}"]`);
  if (courseCard) {
    const head = courseCard.querySelector('.course-card-head') || courseCard;
    return { el: head, isCollapsed: false };
  }
  return null;
}

/** A course-level link has course ids at both ends (no module chip matches either). */
function isCourseLink(conn) {
  const isCourse = (id) => !!document.querySelector(`.course-card[data-course-id="${cssEscape(id)}"]`);
  return isCourse(conn.from) && isCourse(conn.to);
}

/**
 * Calculates optimal connection points adjusted for canvas/board scroll offsets.
 */
function getAnchorPoints(rectA, rectB, wrapEl, wrapRect, xThreshold = 40) {
  const centerA = { x: rectA.left + rectA.width / 2, y: rectA.top + rectA.height / 2 };
  const centerB = { x: rectB.left + rectB.width / 2, y: rectB.top + rectB.height / 2 };

  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;

  let pointA = { x: centerA.x, y: centerA.y };
  let pointB = { x: centerB.x, y: centerB.y };

  // 1. Top / Bottom connection for vertical alignment within threshold
  if (Math.abs(dx) <= xThreshold) {
    if (dy > 0) {
      pointA = { x: centerA.x, y: rectA.bottom };
      pointB = { x: centerB.x, y: rectB.top };
    } else {
      pointA = { x: centerA.x, y: rectA.top };
      pointB = { x: centerB.x, y: rectB.bottom };
    }
  } 
  // 2. Left / Right connection for horizontal alignment
  else {
    if (dx > 0) {
      pointA = { x: rectA.right, y: centerA.y };
      pointB = { x: rectB.left, y: centerB.y };
    } else {
      pointA = { x: rectA.left, y: centerA.y };
      pointB = { x: rectB.right, y: centerB.y };
    }
  }

  // Convert client viewport coordinates to wrap canvas scroll coordinates
  const toCanvasCoords = (pt) => ({
    x: pt.x - wrapRect.left + wrapEl.scrollLeft,
    y: pt.y - wrapRect.top + wrapEl.scrollTop
  });

  return {
    p1: toCanvasCoords(pointA),
    p2: toCanvasCoords(pointB)
  };
}

function drawConnections(data, viewState) {
  const svg = document.getElementById('connectionLayer');
  const wrap = document.querySelector('.board-wrap');
  if (!svg || !wrap) return;

  resizeConnectionLayer();
  svg.innerHTML = '';

  const wrapRect = wrap.getBoundingClientRect();
  const { activeTiers, mode, selectedModuleId } = viewState;

  const tierOf = (conn) => (isCourseLink(conn) ? COURSE_LINK_TIER : conn.level);

  const visible = data.connections.filter((conn) => {
    if (!activeTiers.has(tierOf(conn))) return false;
    if (mode === 'focus' && selectedModuleId) {
      return conn.from === selectedModuleId || conn.to === selectedModuleId;
    }
    return true;
  });

  visible.forEach((conn) => {
    const fromAnchor = resolveAnchorNode(conn.from);
    const toAnchor = resolveAnchorNode(conn.to);
    if (!fromAnchor || !toAnchor) return;

    const courseLink = isCourseLink(conn);
    const isCollapsedLine = !courseLink && (fromAnchor.isCollapsed || toAnchor.isCollapsed);
    const isDimmed = selectedModuleId && conn.from !== selectedModuleId && conn.to !== selectedModuleId && mode === 'all';

    const rectA = fromAnchor.el.getBoundingClientRect();
    const rectB = toAnchor.el.getBoundingClientRect();
    const { p1, p2 } = getAnchorPoints(rectA, rectB, wrap, wrapRect, 50);

    drawLine(svg, p1, p2, conn, courseLink, isCollapsedLine, isDimmed);
  });
}

function connectionTooltip(conn, courseLink) {
  const label = courseLink ? 'Whole-course link' : conn.level;
  const next = courseLink ? '' : ` (click to change to ${CONNECTION_TIER_CYCLE[(CONNECTION_TIER_CYCLE.indexOf(conn.level) + 1) % 3]})`;
  return `${label}${next}`;
}

function drawLine(svg, p1, p2, conn, courseLink, isCollapsedLine, isDimmed) {
  const level = conn.level;
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('opacity', isDimmed ? '0.15' : '0.85');
  group.setAttribute('class', 'conn-group');
  group.dataset.connId = conn.id || '';

  const color = courseLink ? 'var(--course-link)' : (isCollapsedLine ? '#8892b0' : (TIER_COLOR[level] || '#999'));

  const mk = (cls) => {
    const l = document.createElementNS(SVG_NS, 'line');
    l.setAttribute('x1', p1.x);
    l.setAttribute('y1', p1.y);
    l.setAttribute('x2', p2.x);
    l.setAttribute('y2', p2.y);
    l.setAttribute('class', cls);
    return l;
  };

  // Wide invisible line = easy click target
  const hit = mk('conn-hit-area');
  hit.setAttribute('stroke', 'transparent');
  hit.setAttribute('stroke-width', '16');
  hit.setAttribute('stroke-linecap', 'round');
  hit.style.pointerEvents = 'stroke';
  hit.style.cursor = courseLink ? 'pointer' : 'pointer';
  hit.dataset.connId = conn.id || '';

  const line = mk('conn-visible-line');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', courseLink ? '4.5' : '3.5');
  line.setAttribute('stroke-linecap', 'round');
  line.style.pointerEvents = 'none';
  if (courseLink) line.setAttribute('stroke-dasharray', '10,5');
  else if (isCollapsedLine) line.setAttribute('stroke-dasharray', '4,4');

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = connectionTooltip(conn, courseLink);
  hit.appendChild(title);

  group.appendChild(line);
  group.appendChild(hit);
  svg.appendChild(group);
}

function cssEscape(str) {
  if (window.CSS && CSS.escape) return CSS.escape(str);
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

window.drawConnections = drawConnections;
window.resizeConnectionLayer = resizeConnectionLayer;
window.CONNECTION_TIER_CYCLE = CONNECTION_TIER_CYCLE;
window.COURSE_LINK_TIER = COURSE_LINK_TIER;
window.isCourseLinkConn = isCourseLink;