/**
 * Campus Map SVG Renderer
 * Renders the interactive campus map with incident highlighting and route animation
 */

const MapRenderer = (() => {
  let campusData = null;
  let incidentBlockId = null;
  let svgEl = null;
  let routeLines = [];

  const COLORS = {
    hostel:   { fill: '#2a050f', stroke: '#881337', text: '#fda4af' },
    medical:  { fill: '#06201b', stroke: '#059669', text: '#34d399' },
    security: { fill: '#3b0717', stroke: '#be123c', text: '#ff3355' },
    academic: { fill: '#1a0d14', stroke: '#4c0519', text: '#fecdd3' },
    admin:    { fill: '#311005', stroke: '#78350f', text: '#fbbf24' },
    amenity:  { fill: '#140308', stroke: '#4c0519', text: '#fb7185' },
    incident: { fill: '#4c0519', stroke: '#ff0033', text: '#ff3355' }
  };

  function init(svgId, data) {
    svgEl = document.getElementById(svgId);
    campusData = data;
    render();
  }

  function render() {
    if (!svgEl || !campusData) return;

    const blocks = campusData.blocks;
    const gates = campusData.gates;

    // Compute SVG bounds
    const maxX = Math.max(...blocks.map(b => b.x + b.width)) + 40;
    const maxY = Math.max(...blocks.map(b => b.y + b.height)) + 80;

    svgEl.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);
    svgEl.innerHTML = '';

    // ── Defs (filters) ───────────────────────────────────────────────
    const defs = createSVGEl('defs');
    defs.innerHTML = `
      <filter id="glow-red">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow-green">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <marker id="arrow-red" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#cc0000"/>
      </marker>
      <marker id="arrow-orange" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#ff6600"/>
      </marker>
    `;
    svgEl.appendChild(defs);

    // ── Background ───────────────────────────────────────────────────
    const bg = createSVGEl('rect');
    setAttrs(bg, { x: 0, y: 0, width: maxX, height: maxY, fill: '#050000' });
    svgEl.appendChild(bg);

    // Grid lines
    const gridG = createSVGEl('g');
    for (let x = 0; x < maxX; x += 40) {
      const line = createSVGEl('line');
      setAttrs(line, { x1: x, y1: 0, x2: x, y2: maxY, stroke: 'rgba(180,0,0,0.06)', 'stroke-width': 1 });
      gridG.appendChild(line);
    }
    for (let y = 0; y < maxY; y += 40) {
      const line = createSVGEl('line');
      setAttrs(line, { x1: 0, y1: y, x2: maxX, y2: y, stroke: 'rgba(180,0,0,0.06)', 'stroke-width': 1 });
      gridG.appendChild(line);
    }
    svgEl.appendChild(gridG);

    // ── Roads ────────────────────────────────────────────────────────
    const roadG = createSVGEl('g');
    // Horizontal main road
    const hRoad = createSVGEl('rect');
    setAttrs(hRoad, { x: 0, y: 155, width: maxX, height: 75, fill: '#0d0000', rx: 0 });
    roadG.appendChild(hRoad);
    // Vertical connector road
    const vRoad = createSVGEl('rect');
    setAttrs(vRoad, { x: (maxX / 2) - 30, y: 0, width: 60, height: maxY, fill: '#0d0000', rx: 0 });
    roadG.appendChild(vRoad);
    // Road center lines
    const centerH = createSVGEl('line');
    setAttrs(centerH, { x1: 0, y1: 192, x2: maxX, y2: 192, stroke: 'rgba(180,0,0,0.15)', 'stroke-width': 1, 'stroke-dasharray': '8,6' });
    roadG.appendChild(centerH);
    svgEl.appendChild(roadG);

    // ── Route lines (dynamic, drawn later) ──────────────────────────
    const routeGroup = createSVGEl('g');
    routeGroup.id = 'route-group';
    svgEl.appendChild(routeGroup);

    // ── Blocks ───────────────────────────────────────────────────────
    const blocksG = createSVGEl('g');
    blocks.forEach(block => {
      const isIncident = block.id === incidentBlockId;
      const colors = isIncident ? COLORS.incident : (COLORS[block.type] || COLORS.amenity);

      const g = createSVGEl('g');
      g.classList.add('map-block');
      if (isIncident) g.classList.add('incident-location');
      g.setAttribute('data-id', block.id);

      // Block rect
      const rect = createSVGEl('rect');
      setAttrs(rect, {
        x: block.x, y: block.y,
        width: block.width, height: block.height,
        fill: colors.fill,
        stroke: colors.stroke,
        'stroke-width': isIncident ? 2 : 1,
        rx: 6
      });
      if (isIncident) rect.setAttribute('filter', 'url(#glow-red)');
      g.appendChild(rect);

      // Block name
      const text = createSVGEl('text');
      setAttrs(text, {
        x: block.x + block.width / 2,
        y: block.y + block.height / 2 - 6,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        fill: colors.text,
        'font-size': 9,
        'font-weight': '700',
        'font-family': 'Inter, sans-serif',
        'letter-spacing': '0.5'
      });
      text.textContent = block.name;
      g.appendChild(text);

      // Block label
      const label = createSVGEl('text');
      setAttrs(label, {
        x: block.x + block.width / 2,
        y: block.y + block.height / 2 + 10,
        'text-anchor': 'middle',
        fill: 'rgba(255,255,255,0.3)',
        'font-size': 7,
        'font-family': 'Inter, sans-serif'
      });
      label.textContent = block.label;
      g.appendChild(label);

      // Incident pin
      if (isIncident) {
        const pin = createSVGEl('text');
        setAttrs(pin, {
          x: block.x + block.width / 2,
          y: block.y - 12,
          'text-anchor': 'middle',
          'font-size': 16,
          class: 'incident-pin'
        });
        pin.textContent = '📍';
        g.appendChild(pin);
      }

      // Click block to select it
      g.addEventListener('click', () => {
        if (window.onBlockClick) {
          window.onBlockClick(block.id);
        }
      });

      blocksG.appendChild(g);
    });
    svgEl.appendChild(blocksG);

    // ── Gates ────────────────────────────────────────────────────────
    const gatesG = createSVGEl('g');
    gates.forEach(gate => {
      const g = createSVGEl('g');
      const circle = createSVGEl('circle');
      setAttrs(circle, { cx: gate.x, cy: gate.y, r: 10, fill: '#1a0000', stroke: '#660000', 'stroke-width': 1.5 });
      g.appendChild(circle);
      const t = createSVGEl('text');
      setAttrs(t, { x: gate.x, y: gate.y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#cc4444', 'font-size': 6, 'font-weight': '700', 'font-family': 'Inter, sans-serif' });
      t.textContent = gate.name;
      g.appendChild(t);
      gatesG.appendChild(g);
    });
    svgEl.appendChild(gatesG);

    // ── Vehicle Parking ──────────────────────────────────────────────
    const parking = campusData.vehicleParking;
    if (parking) {
      const pg = createSVGEl('g');
      const pr = createSVGEl('rect');
      setAttrs(pr, { x: parking.x - 25, y: parking.y - 14, width: 50, height: 28, fill: '#001a1a', stroke: '#006666', 'stroke-width': 1, rx: 4 });
      pg.appendChild(pr);
      const pt = createSVGEl('text');
      setAttrs(pt, { x: parking.x, y: parking.y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#00aaaa', 'font-size': 7, 'font-family': 'Inter, sans-serif' });
      pt.textContent = '🚑 ' + parking.label;
      pg.appendChild(pt);
      svgEl.appendChild(pg);
    }

    // ── Campus label ─────────────────────────────────────────────────
    const campusLabel = createSVGEl('text');
    setAttrs(campusLabel, {
      x: maxX / 2,
      y: maxY - 12,
      'text-anchor': 'middle',
      fill: 'rgba(180,0,0,0.3)',
      'font-size': 8,
      'font-family': 'Inter, sans-serif',
      'letter-spacing': '2'
    });
    campusLabel.textContent = campusData.campus.toUpperCase();
    svgEl.appendChild(campusLabel);
  }

  function highlightIncident(blockId) {
    incidentBlockId = blockId;
    render();
  }

  function drawRoute(fromBlockId, toBlockId, color = '#cc0000', label = '') {
    const blocks = campusData?.blocks || [];
    const from = blocks.find(b => b.id === fromBlockId);
    const to = blocks.find(b => b.id === toBlockId);
    if (!from || !to || !svgEl) return;

    const routeGroup = svgEl.querySelector('#route-group');
    if (!routeGroup) return;

    const fx = from.x + from.width / 2;
    const fy = from.y + from.height / 2;
    const tx = to.x + to.width / 2;
    const ty = to.y + to.height / 2;

    const line = createSVGEl('line');
    setAttrs(line, {
      x1: fx, y1: fy, x2: tx, y2: ty,
      stroke: color,
      'stroke-width': 2,
      'stroke-dasharray': '6,3',
      'marker-end': color === '#cc0000' ? 'url(#arrow-red)' : 'url(#arrow-orange)',
      opacity: 0.7
    });
    line.classList.add('route-line');
    routeGroup.appendChild(line);
    routeLines.push(line);

    // Label midpoint
    if (label) {
      const mx = (fx + tx) / 2;
      const my = (fy + ty) / 2;
      const lt = createSVGEl('text');
      setAttrs(lt, { x: mx, y: my - 6, 'text-anchor': 'middle', fill: color, 'font-size': 7, 'font-family': 'Inter, sans-serif' });
      lt.textContent = label;
      routeGroup.appendChild(lt);
      routeLines.push(lt);
    }
  }

  function clearRoutes() {
    routeLines.forEach(el => el.remove());
    routeLines = [];
  }

  function reset() {
    incidentBlockId = null;
    clearRoutes();
    render();
  }

  // Helpers
  function createSVGEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

  function setAttrs(el, attrs) {
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  }

  return { init, render, highlightIncident, drawRoute, clearRoutes, reset };
})();

window.MapRenderer = MapRenderer;
